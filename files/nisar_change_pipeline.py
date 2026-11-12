#!/usr/bin/env python3
"""
NISAR surface-change pipeline  (NASA Space Apps 2026 - "Dancing with the SARs")

Turns NISAR L2 GCOV backscatter files (HDF5) into web-ready change layers:
  * per-date backscatter (dB), open-water mask, water gain/loss, and dB change vs. the first date
  * GeoTIFFs (EPSG:4326) for GIS use, RGBA PNG overlays for the web viewer, and meta.json statistics

Commands
  demo      Build a fully synthetic dataset (no network, no NISAR data needed) and process it.
  inspect   Print the HDF5 group/dataset tree of one file (use this first on real data).
  search    Find NISAR GCOV scenes for a bounding box + date range (needs asf_search).
  download  Download scenes listed by `search` (needs asf_search + EARTHDATA_TOKEN env var).
  process   Convert local GCOV .h5 files for one area of interest into viewer-ready output.

Quick start (no data needed):
  python nisar_change_pipeline.py demo --out demo_output
  python -m http.server 8000      # then open http://localhost:8000/viewer/?data=../demo_output

Notes on correctness
  * Averaging (multilooking) is done on LINEAR power, then converted to dB.
  * Pixel areas are computed per latitude row, so km2 statistics are not biased by projection.
  * NISAR data are provisional; thresholds are heuristics. Treat results as indicative.
"""
from __future__ import annotations

import argparse
import json
import logging
import math
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np

try:
    import h5py
    import matplotlib
    from PIL import Image
    from pyproj import CRS, Transformer
    from rasterio.crs import CRS as RioCRS
    from rasterio.enums import Resampling
    from rasterio.transform import Affine
    from rasterio.warp import reproject
    import rasterio
except ImportError as exc:  # pragma: no cover - exercised only on broken installs
    sys.exit(
        f"Missing dependency: {exc.name}. Install everything with:\n"
        "    pip install -r requirements.txt"
    )

log = logging.getLogger("nisar")

# --------------------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------------------
M_PER_DEG_LAT = 111_320.0          # metres per degree of latitude (spherical approximation)
MAX_GRID_DIM = 4000                # refuse to build output grids larger than this (pixels)
MAX_AOI_SPAN_DEG = 1.0             # keep web overlays accurate (see README)
DEFAULT_WATER_DB = {"HHHH": -18.0, "VVVV": -18.0, "HVHV": -24.0, "VHVH": -24.0}
DB_DISPLAY_RANGE = (-25.0, 0.0)    # grey-scale stretch for backscatter PNGs
CHANGE_DISPLAY_DB = 6.0            # +/- range of the diverging change colour ramp
INVALID_MASK_VALUES = (0, 255)     # GCOV mask: 0 = invalid, 255 = fill (see README, assumption A3)

SCENE_RE = re.compile(
    r"NISAR_L2_[A-Z]{2}_GCOV_(?P<cycle>\d{3})_(?P<track>\d{3})_(?P<direction>[AD])_"
    r"(?P<frame>\d{3})_\d+_(?P<pols>[A-Z]{4})_[A-Z]_"
    r"(?P<start>\d{8}T\d{6})_(?P<end>\d{8}T\d{6})"
)


class PipelineError(Exception):
    """Raised for user-fixable problems; the CLI prints the message without a traceback."""


# --------------------------------------------------------------------------------------
# Small, pure helpers (unit-tested)
# --------------------------------------------------------------------------------------
@dataclass(frozen=True)
class Scene:
    path: Path
    cycle: int
    track: int
    direction: str
    frame: int
    start: datetime

    @property
    def date_key(self) -> str:
        return self.start.strftime("%Y-%m-%d")


def parse_scene_name(name: str) -> Optional[Dict[str, object]]:
    """Parse a NISAR GCOV file name. Returns None when the name does not match."""
    m = SCENE_RE.search(Path(name).name)
    if not m:
        return None
    d = m.groupdict()
    return {
        "cycle": int(d["cycle"]),
        "track": int(d["track"]),
        "direction": d["direction"],
        "frame": int(d["frame"]),
        "pols": d["pols"],
        "start": datetime.strptime(d["start"], "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc),
    }


def validate_bbox(bbox: Sequence[float]) -> Tuple[float, float, float, float]:
    if len(bbox) != 4:
        raise PipelineError("bbox needs 4 numbers: west south east north")
    w, s, e, n = (float(v) for v in bbox)
    if not all(math.isfinite(v) for v in (w, s, e, n)):
        raise PipelineError("bbox values must be finite numbers")
    if not (-180 <= w < e <= 180):
        raise PipelineError("bbox: require -180 <= west < east <= 180 (decimal degrees)")
    if not (-90 <= s < n <= 90):
        raise PipelineError("bbox: require -90 <= south < north <= 90 (decimal degrees)")
    if (e - w) > MAX_AOI_SPAN_DEG or (n - s) > MAX_AOI_SPAN_DEG:
        raise PipelineError(
            f"bbox is larger than {MAX_AOI_SPAN_DEG} degrees on one side. Use a smaller area "
            "(this keeps web overlays accurate and processing fast)."
        )
    return w, s, e, n


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    if not slug:
        raise PipelineError("name must contain at least one letter or digit")
    return slug


def make_grid(bbox: Sequence[float], res_m: float) -> Tuple[Affine, Tuple[int, int]]:
    """EPSG:4326 north-up grid covering bbox with ~res_m metre pixels. Returns (transform, (rows, cols))."""
    w, s, e, n = validate_bbox(bbox)
    if not (res_m > 0 and math.isfinite(res_m)):
        raise PipelineError("res-m must be a positive number")
    lat0 = (s + n) / 2.0
    dlat = res_m / M_PER_DEG_LAT
    dlon = res_m / (M_PER_DEG_LAT * math.cos(math.radians(lat0)))
    cols = max(1, math.ceil((e - w) / dlon))
    rows = max(1, math.ceil((n - s) / dlat))
    if rows > MAX_GRID_DIM or cols > MAX_GRID_DIM:
        raise PipelineError(
            f"Output grid would be {rows}x{cols} pixels (max {MAX_GRID_DIM}). Increase --res-m or shrink the bbox."
        )
    return Affine(dlon, 0.0, w, 0.0, -dlat, n), (rows, cols)


def pixel_area_km2(transform: Affine, shape: Tuple[int, int]) -> np.ndarray:
    """Per-pixel area (km2) for an EPSG:4326 grid, shape (rows, 1) so it broadcasts over columns."""
    rows, _ = shape
    lat = transform.f + transform.e * (np.arange(rows) + 0.5)
    dlat_m = abs(transform.e) * M_PER_DEG_LAT
    dlon_m = transform.a * M_PER_DEG_LAT * np.cos(np.radians(lat))
    return ((dlat_m * dlon_m) / 1e6).astype(np.float64)[:, None]


def to_db(power: np.ndarray) -> np.ndarray:
    """Linear power -> dB. Non-finite or non-positive values become NaN (never -inf)."""
    out = np.full(power.shape, np.nan, dtype=np.float32)
    ok = np.isfinite(power) & (power > 0)
    out[ok] = 10.0 * np.log10(power[ok])
    return out


def otsu_threshold(values_db: np.ndarray, lo: float = -40.0, hi: float = 10.0, bins: int = 256) -> float:
    """Otsu threshold on finite dB values. Raises PipelineError if there is nothing to threshold."""
    v = values_db[np.isfinite(values_db)]
    v = v[(v >= lo) & (v <= hi)]
    if v.size < 100:
        raise PipelineError("Not enough valid pixels to compute an automatic water threshold.")
    hist, edges = np.histogram(v, bins=bins, range=(lo, hi))
    p = hist.astype(np.float64) / hist.sum()
    centers = (edges[:-1] + edges[1:]) / 2.0
    w0 = np.cumsum(p)
    w1 = 1.0 - w0
    mu = np.cumsum(p * centers)
    mu_t = mu[-1]
    with np.errstate(divide="ignore", invalid="ignore"):
        between = (mu_t * w0 - mu) ** 2 / (w0 * w1)
    between[~np.isfinite(between)] = -1.0
    return float(centers[int(np.argmax(between))])


def classify_change(
    db_base: np.ndarray,
    db_now: np.ndarray,
    water_thr: float,
    change_thr: float,
    area_km2: np.ndarray,
) -> Dict[str, object]:
    """Compare one date with the baseline. Returns arrays and statistics (all areas in km2)."""
    both = np.isfinite(db_base) & np.isfinite(db_now)
    delta = np.where(both, db_now - db_base, np.nan).astype(np.float32)
    water_now = np.isfinite(db_now) & (db_now < water_thr)
    water_base = np.isfinite(db_base) & (db_base < water_thr)
    gain = both & water_now & ~water_base
    loss = both & ~water_now & water_base
    changed = both & (np.abs(np.nan_to_num(delta)) >= change_thr)
    area = np.broadcast_to(area_km2, db_now.shape)
    return {
        "delta": delta,
        "water_now": water_now,
        "gain": gain,
        "loss": loss,
        "stats": {
            "water_km2": round(float(area[water_now].sum()), 4),
            "gain_km2": round(float(area[gain].sum()), 4),
            "loss_km2": round(float(area[loss].sum()), 4),
            "changed_km2": round(float(area[changed].sum()), 4),
            "valid_pct": round(100.0 * float(np.isfinite(db_now).mean()), 2),
        },
    }


# --------------------------------------------------------------------------------------
# Reading GCOV HDF5
# --------------------------------------------------------------------------------------
def _grid_group_path(freq: str) -> str:
    return f"/science/LSAR/GCOV/grids/frequency{freq}"


def _read_epsg(grp: "h5py.Group") -> int:
    """GCOV stores the projection as a scalar dataset named `projection`; the EPSG code is the value
    and/or the `epsg_code` attribute. Try both (assumption A2 in README)."""
    if "projection" not in grp:
        raise PipelineError("GCOV file has no 'projection' dataset; run `inspect` and check the file layout.")
    ds = grp["projection"]
    candidates: List[object] = []
    if "epsg_code" in ds.attrs:
        candidates.append(ds.attrs["epsg_code"])
    try:
        candidates.append(ds[()])
    except Exception:  # noqa: BLE001 - dataset may be empty
        pass
    for c in candidates:
        try:
            code = int(np.asarray(c).reshape(-1)[0])
        except (TypeError, ValueError, IndexError):
            continue
        if 1024 <= code <= 60000:
            return code
    raise PipelineError("Could not read an EPSG code from the 'projection' dataset.")


def _bbox_in_crs(bbox: Sequence[float], crs: CRS) -> Tuple[float, float, float, float]:
    """Project bbox edges (densified) into the file CRS and return (xmin, ymin, xmax, ymax)."""
    w, s, e, n = bbox
    t = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    lons = np.concatenate([np.linspace(w, e, 25), np.full(25, e), np.linspace(e, w, 25), np.full(25, w)])
    lats = np.concatenate([np.full(25, s), np.linspace(s, n, 25), np.full(25, n), np.linspace(n, s, 25)])
    xs, ys = t.transform(lons, lats)
    xs, ys = np.asarray(xs), np.asarray(ys)
    if not (np.all(np.isfinite(xs)) and np.all(np.isfinite(ys))):
        raise PipelineError("bbox could not be projected into the file's coordinate system.")
    return float(xs.min()), float(ys.min()), float(xs.max()), float(ys.max())


def read_gcov_window(
    h5_path: Path, pol: str, freq: str, bbox: Sequence[float]
) -> Optional[Tuple[np.ndarray, Affine, CRS]]:
    """Read only the part of a GCOV file that overlaps bbox.

    Returns (linear power with NaN where invalid, affine transform of the window, CRS) or
    None if the file does not overlap bbox.
    """
    with h5py.File(h5_path, "r") as f:
        gpath = _grid_group_path(freq)
        if gpath not in f:
            raise PipelineError(f"{h5_path.name}: group {gpath} not found. Run `inspect` on this file.")
        grp = f[gpath]
        if pol not in grp:
            avail = sorted(k for k, v in grp.items() if isinstance(v, h5py.Dataset) and k.isupper() and len(k) == 4)
            raise PipelineError(f"{h5_path.name}: polarization {pol} not present. Available: {avail}")
        x = np.asarray(grp["xCoordinates"][:], dtype=np.float64)
        y = np.asarray(grp["yCoordinates"][:], dtype=np.float64)
        if x.size < 2 or y.size < 2:
            raise PipelineError(f"{h5_path.name}: coordinate arrays are too short.")
        dx = (x[-1] - x[0]) / (x.size - 1)
        dy = (y[-1] - y[0]) / (y.size - 1)
        if not (dx > 0 and dy < 0):
            raise PipelineError(
                f"{h5_path.name}: expected a north-up grid (x ascending, y descending); got dx={dx}, dy={dy}."
            )
        crs = CRS.from_epsg(_read_epsg(grp))
        xmin, ymin, xmax, ymax = _bbox_in_crs(bbox, crs)
        cols = np.where((x >= xmin - dx) & (x <= xmax + dx))[0]
        rows = np.where((y >= ymin + dy) & (y <= ymax - dy))[0]
        if cols.size == 0 or rows.size == 0:
            return None
        r0, r1, c0, c1 = int(rows.min()), int(rows.max()) + 1, int(cols.min()), int(cols.max()) + 1
        data = np.asarray(grp[pol][r0:r1, c0:c1], dtype=np.float32)
        valid = np.isfinite(data) & (data > 0)
        if "mask" in grp:
            mask = np.asarray(grp["mask"][r0:r1, c0:c1])
            mask_ok = ~np.isin(mask, INVALID_MASK_VALUES)
            # Safety net for assumption A3: ignore the mask if it would wipe out almost everything.
            if (valid & mask_ok).mean() < 0.01 and valid.mean() > 0.10:
                log.warning("%s: mask rejects nearly all valid pixels; ignoring the mask layer.", h5_path.name)
            else:
                valid &= mask_ok
        data[~valid] = np.nan
        transform = Affine(dx, 0.0, x[c0] - dx / 2.0, 0.0, dy, y[r0] - dy / 2.0)
        return data, transform, crs


def warp_to_grid(
    arr: np.ndarray, src_transform: Affine, src_crs: CRS, dst_transform: Affine, dst_shape: Tuple[int, int]
) -> np.ndarray:
    """Resample linear power to the common EPSG:4326 grid. Averages when downsampling."""
    dst = np.full(dst_shape, np.nan, dtype=np.float32)
    reproject(
        source=arr,
        destination=dst,
        src_transform=src_transform,
        src_crs=RioCRS.from_wkt(src_crs.to_wkt()),
        src_nodata=np.nan,
        dst_transform=dst_transform,
        dst_crs=RioCRS.from_epsg(4326),
        dst_nodata=np.nan,
        resampling=Resampling.average,
    )
    return dst


# --------------------------------------------------------------------------------------
# Stack building and rendering
# --------------------------------------------------------------------------------------
def collect_scenes(paths: Iterable[Path]) -> List[Scene]:
    scenes: List[Scene] = []
    for p in paths:
        info = parse_scene_name(p.name)
        if info is None:
            log.warning("Skipping %s: file name does not look like a NISAR L2 GCOV product.", p.name)
            continue
        scenes.append(
            Scene(p, info["cycle"], info["track"], info["direction"], info["frame"], info["start"])  # type: ignore[arg-type]
        )
    return scenes


def expand_inputs(inputs: Sequence[str]) -> List[Path]:
    files: List[Path] = []
    for item in inputs:
        p = Path(item)
        if p.is_dir():
            files.extend(sorted(p.rglob("*.h5")))
        elif p.is_file():
            files.append(p)
        else:
            raise PipelineError(f"Input not found: {item}")
    if not files:
        raise PipelineError("No .h5 files found in the given inputs.")
    return files


def select_consistent_stack(scenes: List[Scene]) -> List[Scene]:
    """Keep one imaging geometry (track + direction) so dates are comparable.
    Chooses the geometry with the most distinct dates (ties: lowest track number)."""
    groups: Dict[Tuple[int, str], List[Scene]] = {}
    for s in scenes:
        groups.setdefault((s.track, s.direction), []).append(s)
    if not groups:
        raise PipelineError("No usable scenes.")
    best_key = sorted(groups, key=lambda k: (-len({s.date_key for s in groups[k]}), k))[0]
    if len(groups) > 1:
        log.info("Multiple imaging geometries found; using track %s %s only.", best_key[0], best_key[1])
    return sorted(groups[best_key], key=lambda s: s.start)


def build_power_stack(
    scenes: List[Scene], pol: str, freq: str, bbox: Sequence[float], transform: Affine, shape: Tuple[int, int]
) -> List[Tuple[str, np.ndarray, List[str]]]:
    """Return [(date, linear-power grid, source file names)] sorted by date; same-date scenes are averaged."""
    by_date: Dict[str, List[Scene]] = {}
    for s in scenes:
        by_date.setdefault(s.date_key, []).append(s)
    stack: List[Tuple[str, np.ndarray, List[str]]] = []
    for date in sorted(by_date):
        acc = np.zeros(shape, dtype=np.float64)
        cnt = np.zeros(shape, dtype=np.int32)
        used: List[str] = []
        for s in by_date[date]:
            res = read_gcov_window(s.path, pol, freq, bbox)
            if res is None:
                log.info("%s does not overlap the area of interest; skipped.", s.path.name)
                continue
            arr, src_tf, src_crs = res
            warped = warp_to_grid(arr, src_tf, src_crs, transform, shape)
            ok = np.isfinite(warped)
            acc[ok] += warped[ok]
            cnt[ok] += 1
            used.append(s.path.name)
        if not used:
            continue
        merged = np.full(shape, np.nan, dtype=np.float32)
        good = cnt > 0
        merged[good] = (acc[good] / cnt[good]).astype(np.float32)
        stack.append((date, merged, used))
    return stack


def _rgba_gray_db(db: np.ndarray) -> np.ndarray:
    lo, hi = DB_DISPLAY_RANGE
    g = np.clip((np.nan_to_num(db, nan=lo) - lo) / (hi - lo), 0.0, 1.0)
    g8 = (g * 255).astype(np.uint8)
    a = np.where(np.isfinite(db), 255, 0).astype(np.uint8)
    return np.dstack([g8, g8, g8, a])


def _rgba_flags(layers: Sequence[Tuple[np.ndarray, Tuple[int, int, int], int]]) -> np.ndarray:
    """layers: (boolean array, (r,g,b), alpha). Later layers draw on top."""
    shape = layers[0][0].shape
    out = np.zeros(shape + (4,), dtype=np.uint8)
    for flag, rgb, alpha in layers:
        out[flag] = (rgb[0], rgb[1], rgb[2], alpha)
    return out


def _rgba_delta(delta: np.ndarray) -> np.ndarray:
    cmap = matplotlib.colormaps["RdBu_r"]  # increase = red, decrease = blue
    norm = (np.clip(np.nan_to_num(delta), -CHANGE_DISPLAY_DB, CHANGE_DISPLAY_DB) + CHANGE_DISPLAY_DB) / (
        2 * CHANGE_DISPLAY_DB
    )
    rgba = (cmap(norm) * 255).astype(np.uint8)
    rgba[..., 3] = np.where(np.isfinite(delta), 215, 0).astype(np.uint8)
    return rgba


def _save_png(rgba: np.ndarray, path: Path) -> None:
    Image.fromarray(rgba, mode="RGBA").save(path, optimize=True)


def _save_tif(arr: np.ndarray, transform: Affine, path: Path) -> None:
    with rasterio.open(
        path, "w", driver="GTiff", height=arr.shape[0], width=arr.shape[1], count=1, dtype="float32",
        crs="EPSG:4326", transform=transform, nodata=np.nan, compress="deflate",
    ) as dst:
        dst.write(arr.astype(np.float32), 1)


def write_outputs(
    out_dir: Path,
    name: str,
    title: str,
    bbox: Sequence[float],
    pol: str,
    freq: str,
    res_m: float,
    water_arg: str,
    change_thr: float,
    min_valid_pct: float,
    stack: List[Tuple[str, np.ndarray, List[str]]],
    transform: Affine,
    shape: Tuple[int, int],
    synthetic: bool = False,
) -> Path:
    """Classify every date against the first usable date and write TIFFs, PNGs and meta.json."""
    area = pixel_area_km2(transform, shape)
    dbs = [(d, to_db(p), src) for d, p, src in stack]
    dbs = [t for t in dbs if 100.0 * np.isfinite(t[1]).mean() >= min_valid_pct]
    if len(dbs) < 2:
        raise PipelineError(
            f"Need at least 2 dates with >= {min_valid_pct}% valid pixels over the area; found {len(dbs)}. "
            "Check the bbox, polarization, or date range."
        )
    base_db = dbs[0][1]
    if water_arg == "auto":
        water_thr = otsu_threshold(base_db)
        log.info("Automatic water threshold (Otsu on baseline): %.2f dB", water_thr)
    else:
        try:
            water_thr = float(water_arg)
        except ValueError as exc:
            raise PipelineError("--water-threshold-db must be a number or 'auto'") from exc

    aoi_dir = out_dir / name
    (aoi_dir / "frames").mkdir(parents=True, exist_ok=True)
    (aoi_dir / "geotiff").mkdir(parents=True, exist_ok=True)

    frames = []
    for i, (date, db, src) in enumerate(dbs):
        res = classify_change(base_db, db, water_thr, change_thr, area)
        _save_png(_rgba_gray_db(db), aoi_dir / "frames" / f"db_{i:03d}.png")
        _save_png(_rgba_flags([(res["water_now"], (30, 144, 255), 150)]), aoi_dir / "frames" / f"water_{i:03d}.png")
        _save_png(
            _rgba_flags([
                (res["water_now"], (140, 170, 200), 70),
                (res["gain"], (0, 200, 255), 220),
                (res["loss"], (255, 140, 0), 220),
            ]),
            aoi_dir / "frames" / f"waterchange_{i:03d}.png",
        )
        _save_png(_rgba_delta(res["delta"]), aoi_dir / "frames" / f"change_{i:03d}.png")
        _save_tif(db, transform, aoi_dir / "geotiff" / f"db_{i:03d}_{date}.tif")
        _save_tif(res["delta"], transform, aoi_dir / "geotiff" / f"change_vs_baseline_{i:03d}_{date}.tif")
        frames.append({"index": i, "date": date, "sources": src, **res["stats"]})

    w, s, e, n = bbox
    meta = {
        "name": name,
        "title": title,
        "synthetic": synthetic,
        "bounds": {"west": w, "south": s, "east": e, "north": n},
        "grid": {"rows": shape[0], "cols": shape[1], "res_m": res_m, "crs": "EPSG:4326"},
        "polarization": pol,
        "frequency": freq,
        "baseline_date": dbs[0][0],
        "params": {
            "water_threshold_db": round(float(water_thr), 3),
            "change_threshold_db": change_thr,
            "min_valid_pct": min_valid_pct,
        },
        "frames": frames,
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "notes": [
            "NISAR data are provisional; thresholds are heuristics, not calibrated classifiers.",
            "Open-water detection can miss flooded vegetation, which often brightens in L-band.",
        ],
    }
    (aoi_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    _update_index(out_dir, name, title)
    log.info("Wrote %d frames to %s", len(frames), aoi_dir)
    return aoi_dir


def _update_index(out_dir: Path, name: str, title: str) -> None:
    idx_path = out_dir / "index.json"
    index = {"aois": []}
    if idx_path.exists():
        try:
            index = json.loads(idx_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            log.warning("index.json was unreadable; recreating it.")
    aois = [a for a in index.get("aois", []) if a.get("name") != name]
    aois.append({"name": name, "title": title, "meta": f"{name}/meta.json"})
    index["aois"] = sorted(aois, key=lambda a: a["name"])
    idx_path.write_text(json.dumps(index, indent=2), encoding="utf-8")


def run_process(
    inputs: Sequence[str], name: str, title: Optional[str], bbox: Sequence[float], pol: str, freq: str,
    res_m: float, water_arg: str, change_thr: float, min_valid_pct: float, out_dir: Path, synthetic: bool = False,
) -> Path:
    bbox_t = validate_bbox(bbox)
    name = slugify(name)
    transform, shape = make_grid(bbox_t, res_m)
    scenes = select_consistent_stack(collect_scenes(expand_inputs(inputs)))
    log.info("Processing %d scene(s) on %d date(s)...", len(scenes), len({s.date_key for s in scenes}))
    stack = build_power_stack(scenes, pol.upper(), freq.upper(), bbox_t, transform, shape)
    return write_outputs(
        out_dir, name, title or name, bbox_t, pol.upper(), freq.upper(), res_m, water_arg, change_thr,
        min_valid_pct, stack, transform, shape, synthetic,
    )


# --------------------------------------------------------------------------------------
# Synthetic demo data (writes GCOV-shaped HDF5 so the real reader is exercised)
# --------------------------------------------------------------------------------------
DEMO_BBOX = (100.00, 14.90, 100.20, 15.10)   # fictional demo area, UTM zone 47N
DEMO_EPSG = 32647


def _demo_scene_name(cycle: int, date: datetime) -> str:
    t0 = date.strftime("%Y%m%dT%H%M%S")
    t1 = (date + timedelta(seconds=19)).strftime("%Y%m%dT%H%M%S")
    return f"NISAR_L2_PR_GCOV_{cycle:03d}_072_D_079_4005_DHDH_A_{t0}_{t1}_X05010_N_P_J_001.h5"


def make_synthetic_gcov(out_dir: Path, seed: int = 7) -> List[Path]:
    """Create 5 fake GCOV files 12 days apart: a river that floods then recedes, plus a crop-field change."""
    rng = np.random.default_rng(seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    tf = Transformer.from_crs("EPSG:4326", f"EPSG:{DEMO_EPSG}", always_xy=True)
    w, s, e, n = DEMO_BBOX
    x0, y0 = tf.transform(w - 0.02, s - 0.02)
    x1, y1 = tf.transform(e + 0.02, n + 0.02)
    spacing = 30.0
    xs = np.arange(math.floor(x0), math.ceil(x1), spacing) + spacing / 2
    ys = np.arange(math.ceil(y1), math.floor(y0), -spacing) - spacing / 2
    X, Y = np.meshgrid(xs, ys)
    cx, cy = (xs[0] + xs[-1]) / 2, (ys[0] + ys[-1]) / 2
    # Meandering river centre-line distance (metres), widening during the "flood" dates
    river_centre = cx + 2500 * np.sin((Y - cy) / 3500.0)
    dist = np.abs(X - river_centre)
    field = (np.abs(X - (cx - 4500)) < 1800) & (np.abs(Y - (cy + 3000)) < 1800)
    half_widths = [300.0, 300.0, 1400.0, 1900.0, 700.0]          # river half-width per date (m)
    field_boost = [0.0, 0.0, 0.0, 4.0, 4.0]                      # crop field brightening (dB)
    start = datetime(2026, 7, 1, 4, 58, 17, tzinfo=timezone.utc)
    paths: List[Path] = []
    for i, (hw, boost) in enumerate(zip(half_widths, field_boost)):
        base_db = np.full(X.shape, -10.0)
        base_db += 1.5 * np.sin(X / 900.0) * np.cos(Y / 1100.0)   # gentle land texture
        base_db[field] += boost
        base_db[dist < hw] = -23.0                                 # open water
        looks = 6
        speckle = rng.gamma(looks, 1.0 / looks, size=X.shape)
        power = (10 ** (base_db / 10.0) * speckle).astype(np.float32)
        mask = np.ones(X.shape, dtype=np.uint8)
        mask[:, :20] = 0                                           # invalid strip at the edge
        power[:, :20] = np.nan
        date = start + timedelta(days=12 * i)
        p = out_dir / _demo_scene_name(10 + i, date)
        with h5py.File(p, "w") as f:
            g = f.create_group("science/LSAR/GCOV/grids/frequencyA")
            g.create_dataset("xCoordinates", data=xs)
            g.create_dataset("yCoordinates", data=ys)
            proj = g.create_dataset("projection", data=np.uint32(DEMO_EPSG))
            proj.attrs["epsg_code"] = np.uint32(DEMO_EPSG)
            g.create_dataset("HHHH", data=power, chunks=(256, 256), compression="gzip")
            hv = (power * 10 ** (-7.0 / 10.0)).astype(np.float32)
            g.create_dataset("HVHV", data=hv, chunks=(256, 256), compression="gzip")
            g.create_dataset("mask", data=mask, chunks=(256, 256), compression="gzip")
        paths.append(p)
    return paths


# --------------------------------------------------------------------------------------
# Network commands (asf_search is imported lazily so offline use never needs it)
# --------------------------------------------------------------------------------------
def _import_asf():
    try:
        import asf_search as asf  # noqa: WPS433
    except ImportError as exc:
        raise PipelineError("asf_search is required for this command: pip install asf_search") from exc
    return asf


def cmd_search(args: argparse.Namespace) -> None:
    asf = _import_asf()
    w, s, e, n = validate_bbox(args.bbox)
    wkt = f"POLYGON(({w} {s},{e} {s},{e} {n},{w} {n},{w} {s}))"
    kwargs = dict(dataset=asf.DATASET.NISAR, processingLevel="GCOV", intersectsWith=wkt, maxResults=args.max_results)
    if args.start:
        kwargs["start"] = args.start
    if args.end:
        kwargs["end"] = args.end
    try:
        results = asf.search(**kwargs)
    except Exception as exc:  # noqa: BLE001 - surface any network/API error cleanly
        raise PipelineError(f"ASF search failed: {exc}") from exc
    scenes = []
    for r in results:
        p = r.properties
        url = p.get("url") or ""
        fname = p.get("fileName") or Path(url).name
        info = parse_scene_name(fname)
        if not url or not fname.endswith(".h5"):
            continue
        size = None
        b = p.get("bytes")
        if isinstance(b, dict) and fname in b and isinstance(b[fname], dict):
            size = b[fname].get("bytes")
        scenes.append({
            "file": fname, "url": url, "start": p.get("startTime"), "bytes": size,
            "track": info["track"] if info else p.get("pathNumber"),
            "direction": info["direction"] if info else p.get("flightDirection"),
            "frame": info["frame"] if info else p.get("frameNumber"),
        })
    Path(args.out).write_text(json.dumps({"bbox": [w, s, e, n], "scenes": scenes}, indent=2), encoding="utf-8")
    print(f"Found {len(scenes)} GCOV scene(s). Saved to {args.out}")
    if scenes and any(sc["bytes"] for sc in scenes):
        total = sum(sc["bytes"] or 0 for sc in scenes) / 1e9
        print(f"Total download size if you fetch them all: ~{total:.1f} GB")


def cmd_download(args: argparse.Namespace) -> None:
    asf = _import_asf()
    token = os.environ.get("EARTHDATA_TOKEN")
    if not token:
        raise PipelineError(
            "Set EARTHDATA_TOKEN to an Earthdata Login bearer token (create one at urs.earthdata.nasa.gov)."
        )
    data = json.loads(Path(args.scenes).read_text(encoding="utf-8"))
    scenes = data.get("scenes", [])
    if args.max_files:
        scenes = scenes[: args.max_files]
    if not scenes:
        raise PipelineError("No scenes to download.")
    dest = Path(args.data_dir)
    dest.mkdir(parents=True, exist_ok=True)
    todo = [sc["url"] for sc in scenes if not (dest / sc["file"]).exists()]
    print(f"Downloading {len(todo)} file(s) ({len(scenes) - len(todo)} already present)...")
    if todo:
        session = asf.ASFSession().auth_with_token(token)
        asf.download_urls(urls=todo, path=str(dest), session=session, processes=args.processes)
    print(f"Done. Files are in {dest}")


def cmd_inspect(args: argparse.Namespace) -> None:
    path = Path(args.file)
    if not path.is_file():
        raise PipelineError(f"File not found: {path}")
    with h5py.File(path, "r") as f:
        def visit(name: str, obj) -> None:
            depth = name.count("/")
            if depth > args.depth:
                return
            if isinstance(obj, h5py.Dataset):
                print(f"{'  ' * depth}{name.split('/')[-1]}  dataset shape={obj.shape} dtype={obj.dtype}")
            else:
                print(f"{'  ' * depth}{name.split('/')[-1]}/")
        f.visititems(visit)


def cmd_process(args: argparse.Namespace) -> None:
    run_process(
        args.input, args.name, args.title, args.bbox, args.pol, args.freq, args.res_m,
        args.water_threshold_db or str(DEFAULT_WATER_DB.get(args.pol.upper(), -18.0)),
        args.change_threshold_db, args.min_valid_pct, Path(args.out),
    )
    print(f"Done. View with:  python -m http.server 8000   ->  http://localhost:8000/viewer/?data=../{args.out}")


def cmd_demo(args: argparse.Namespace) -> None:
    out = Path(args.out)
    raw = out / "_synthetic_input"
    files = make_synthetic_gcov(raw)
    run_process(
        [str(p) for p in files], "demo-river-flood", "DEMO (synthetic): river flood and crop change",
        DEMO_BBOX, "HHHH", "A", 60.0, "-18", 3.0, 5.0, out, synthetic=True,
    )
    for p in files:                       # keep the output folder small; inputs are re-creatable
        p.unlink()
    raw.rmdir()
    print(f"Demo ready in {out}/. Serve with:  python -m http.server 8000  then open "
          f"http://localhost:8000/viewer/?data=../{out}")


# --------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("-v", "--verbose", action="store_true", help="debug logging")
    sub = ap.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("demo", help="build and process synthetic data (offline)")
    d.add_argument("--out", default="demo_output")
    d.set_defaults(func=cmd_demo)

    i = sub.add_parser("inspect", help="print the HDF5 tree of one file")
    i.add_argument("file")
    i.add_argument("--depth", type=int, default=6)
    i.set_defaults(func=cmd_inspect)

    s = sub.add_parser("search", help="find NISAR GCOV scenes (needs asf_search)")
    s.add_argument("--bbox", nargs=4, type=float, required=True, metavar=("W", "S", "E", "N"))
    s.add_argument("--start", help="e.g. 2026-06-17")
    s.add_argument("--end", help="e.g. 2026-10-31")
    s.add_argument("--max-results", type=int, default=200)
    s.add_argument("--out", default="scenes.json")
    s.set_defaults(func=cmd_search)

    dl = sub.add_parser("download", help="download scenes from scenes.json (needs EARTHDATA_TOKEN)")
    dl.add_argument("--scenes", default="scenes.json")
    dl.add_argument("--data-dir", default="data")
    dl.add_argument("--max-files", type=int, default=0, help="0 = all")
    dl.add_argument("--processes", type=int, default=2)
    dl.set_defaults(func=cmd_download)

    p = sub.add_parser("process", help="process local GCOV files for one area")
    p.add_argument("--input", nargs="+", required=True, help="files and/or folders containing .h5 files")
    p.add_argument("--name", required=True, help="short id, e.g. river-flood-a")
    p.add_argument("--title", help="human-readable title shown in the viewer")
    p.add_argument("--bbox", nargs=4, type=float, required=True, metavar=("W", "S", "E", "N"))
    p.add_argument("--pol", default="HHHH", help="HHHH, HVHV, VVVV or VHVH (default HHHH)")
    p.add_argument("--freq", default="A", choices=["A", "B", "a", "b"])
    p.add_argument("--res-m", type=float, default=50.0, help="output pixel size in metres (default 50)")
    p.add_argument("--water-threshold-db", default=None, help="dB value, or 'auto' (Otsu). Default depends on pol")
    p.add_argument("--change-threshold-db", type=float, default=3.0)
    p.add_argument("--min-valid-pct", type=float, default=5.0, help="drop dates with less coverage than this")
    p.add_argument("--out", default="out")
    p.set_defaults(func=cmd_process)
    return ap


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(levelname)s: %(message)s")
    try:
        args.func(args)
    except PipelineError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
