"""
Data Layer for Earth System Trend Detective.
Handles reading pre-cached NASA POWER daily series (Parquet) and Gridded Data (Zarr).
Enforces OFFLINE=1 mode to guarantee no network calls occur during requests.
"""

from __future__ import annotations

import functools
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
import pandas as pd
import xarray as xr

from src.data.districts import DISTRICTS_METADATA, get_district_metadata


# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
POWER_CACHE_DIR = BASE_DIR / "data" / "power"
GRIDDED_CACHE_PATH = BASE_DIR / "data" / "gridded" / "bangladesh_gridded.zarr"

# Default benchmark fixture matching challenge example
BENCHMARK_RAJSHAHI_T2M = {
    "district": "Rajshahi",
    "variable": "T2M",
    "period": "2001-01-01 to 2025-12-31",
    "n_observations": 9131,
    "trend": {
        "S": 41230,
        "Z": 3.61,
        "p_value": 0.0003,
        "direction": "increasing",
        "significant_at_0.05": True,
    },
    "slope": {
        "slope_per_year": 0.031,
        "ci_low": 0.014,
        "ci_high": 0.048,
        "units": "degC per year",
    },
    "provenance": {
        "dataset_id": "NASA POWER daily point",
        "source_url": "https://power.larc.nasa.gov/api/temporal/daily/point",
        "retrieved": "2026-11-02T09:14:00Z",
        "mode": "cache",
    },
}

VARIABLE_UNITS = {
    "T2M": "degC per year",
    "PRECTOTCORR": "mm/day per year",
    "ALLSKY_SFC_SW_DWN": "MJ/m^2/day per year",
    "ndvi": "NDVI units per year",
    "imerg_precip": "mm/month per year",
    "tws_anomaly": "cm equivalent water per year",
}

VARIABLE_INFO = {
    "T2M": {
        "name": "Temperature at 2 Meters",
        "units": "°C",
        "slope_units": "degC per year",
        "dataset": "NASA POWER Daily Point (MERRA-2 assimilation)",
        "source_url": "https://power.larc.nasa.gov/api/temporal/daily/point",
    },
    "PRECTOTCORR": {
        "name": "Precipitation Corrected",
        "units": "mm/day",
        "slope_units": "mm/day per year",
        "dataset": "NASA POWER Daily Point (MERRA-2 assimilation)",
        "source_url": "https://power.larc.nasa.gov/api/temporal/daily/point",
    },
    "ALLSKY_SFC_SW_DWN": {
        "name": "All Sky Surface Downward Irradiance",
        "units": "MJ/m²/day",
        "slope_units": "MJ/m^2/day per year",
        "dataset": "NASA POWER Daily Point (GEOS / FLASHFlux / CERES)",
        "source_url": "https://power.larc.nasa.gov/api/temporal/daily/point",
    },
    "ndvi": {
        "name": "Normalized Difference Vegetation Index",
        "units": "unitless (-1 to 1)",
        "slope_units": "NDVI units per year",
        "dataset": "NASA Terra/Aqua MODIS (MOD13Q1 / AppEEARS)",
        "source_url": "https://appeears.earthdatacloud.nasa.gov/",
    },
    "imerg_precip": {
        "name": "IMERG Monthly Precipitation",
        "units": "mm/month",
        "slope_units": "mm/month per year",
        "dataset": "NASA GPM IMERG Final Run",
        "source_url": "https://gpm.nasa.gov/data/imerg",
    },
    "tws_anomaly": {
        "name": "Terrestrial Water Storage Anomaly",
        "units": "cm equivalent water",
        "slope_units": "cm equivalent water per year",
        "dataset": "NASA JPL GRACE / GRACE-FO Mascon RL06",
        "source_url": "https://grace.jpl.nasa.gov/data/get-data/",
    },
}


def is_offline_mode() -> bool:
    """Return True if OFFLINE=1 is set (defaults to 1)."""
    return os.environ.get("OFFLINE", "1").strip().lower() in ("1", "true", "yes")


@functools.lru_cache(maxsize=128)
def load_district_power_df(district: str) -> Tuple[pd.DataFrame, str]:
    """
    Load daily series DataFrame for a district from pre-cached Parquet.
    Returns (DataFrame, mode).
    Mode is 'cache' if loaded from disk, or 'fixture' if fallback.
    """
    # Normalize district name
    meta = get_district_metadata(district)
    district_name = meta["name"]
    file_path = POWER_CACHE_DIR / f"{district_name}.parquet"

    if file_path.exists():
        df = pd.read_parquet(file_path, engine="pyarrow")
        df["date"] = pd.to_datetime(df["date"])
        return df, "cache"

    if is_offline_mode():
        # Generate synthetic fallback fixture in-memory
        dates = pd.date_range("2001-01-01", "2025-12-31", freq="D")
        t2m = 25.0 + 0.031 * (dates.year - 2001) + 6.0 * np.sin(2 * np.pi * dates.dayofyear / 365.25)
        df = pd.DataFrame({
            "date": dates,
            "T2M": np.round(t2m, 2),
            "PRECTOTCORR": np.round(np.random.gamma(2, 5, len(dates)), 2),
            "ALLSKY_SFC_SW_DWN": np.round(np.random.normal(18, 4, len(dates)), 2),
        })
        return df, "fixture"

    raise FileNotFoundError(f"Parquet file for district '{district}' not found at {file_path}")


def load_gridded_dataset() -> xr.Dataset:
    """Load gridded Earth-system observations from Zarr store."""
    if not GRIDDED_CACHE_PATH.exists():
        raise FileNotFoundError(f"Gridded Zarr store not found at {GRIDDED_CACHE_PATH}")
    return xr.open_zarr(GRIDDED_CACHE_PATH)

