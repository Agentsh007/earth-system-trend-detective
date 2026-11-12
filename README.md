# 🌍 Earth System Trend Detective: Bangladesh

**Offline-First Scientific Earth-System Trend Investigation Platform**  
*Built for the NASA Space Apps Challenge 2026: Be an Earth System Trend Detective*

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Tests](https://img.shields.io/badge/Tests-Passing%20(22%2F22)-brightgreen.svg)]()
[![Offline Mode](https://img.shields.io/badge/Offline--First-OFFLINE%3D1-success.svg)]()

---

## 🏛️ System Architecture

```text
POWER / MODIS / IMERG / GRACE
             │  (pre-event)
             ▼
    cache: parquet + zarr
             │
             ▼
   src/compute/trend.py          ◄── tested, deterministic, no model
   Mann-Kendall · Theil-Sen · CI
             │
             ▼
        FastAPI /trend
             │
   ┌─────────┴──────────┐
   ▼                    ▼
map + chart        narration agent
                   (explains only)
   │                    │
   └────────┬───────────┘
            ▼
    provenance drawer
```

---

## 🛰️ Datasets & Sources

Every dataset utilized in this platform is listed with its official NASA URL, mission details, and spatial/temporal parameters:

| Dataset | Variables | Temporal Range & Res | Spatial Resolution | Official Source URL |
|---|---|---|---|---|
| **NASA POWER Daily Point** | `T2M` (Temperature at 2m, °C), `PRECTOTCORR` (Precipitation, mm/day), `ALLSKY_SFC_SW_DWN` (Solar Radiation, MJ/m²/day) | 2001-01-01 to 2025-12-31 (Daily, 9,131 days) | Point centroids across all 64 districts | [NASA POWER API](https://power.larc.nasa.gov/api/temporal/daily/point) |
| **NASA MODIS Terra/Aqua (MOD13Q1)** | `ndvi` (Normalized Difference Vegetation Index) | 2001 to 2025 (Monthly composite) | 0.25° Gridded Mask | [NASA AppEEARS / LP DAAC](https://appeears.earthdatacloud.nasa.gov/) |
| **NASA GPM IMERG** | `imerg_precip` (Multi-satellite precipitation, mm/month) | 2001 to 2025 (Monthly) | 0.25° Gridded Mask | [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg) |
| **NASA JPL GRACE / GRACE-FO** | `tws_anomaly` (Terrestrial water storage anomaly, cm equivalent water) | 2001 to 2025 (Monthly Mascon RL06) | 0.25° Gridded Mask | [NASA JPL GRACE](https://grace.jpl.nasa.gov/data/get-data/) |

---

## 🔬 Science Layer (`src/compute/trend.py`)

All statistical trend metrics are computed deterministically without language models or stochastic heuristics:

1. **Mann-Kendall Test ($S$, $Z$, $p$-value, direction, significance)**
   - Computes rank concordance score $S = \sum_{k < j} \text{sgn}(x_j - x_k)$ via an exact $O(N \log N)$ Fenwick binary indexed tree.
   - Strictly corrects for ties in observations in the variance formula:
     $$\text{Var}(S) = \frac{1}{18} \left[ n(n-1)(2n+5) - \sum_{i=1}^g t_i(t_i-1)(2t_i+5) \right]$$
   - Computes standardized $Z$-score and exact two-tailed $p$-value.
   - Classifies direction into `"increasing"`, `"decreasing"`, or `"no trend"`.

2. **Theil-Sen Robust Slope & 95% Confidence Interval**
   - Calculates the median of pairwise slopes, resistant to outliers (breakdown point $\approx 29.3\%$).
   - Computes rank-order $95\%$ confidence interval ($[CI_{\text{low}}, CI_{\text{high}}]$) following Gilbert and Hollander-Wolfe methods.
   - Scaled to annual rates of change (e.g. `degC per year`).

3. **Additive Seasonal Decomposition**
   - Decomposes series into $y(t) = \text{Trend}(t) + \text{Seasonal}(t) + \text{Residual}(t)$.
   - Validated to zero-mean cyclic sum and perfect reconstruction tolerance.

---

## 🤖 Bilingual Narration Agent with Anti-Hallucination Guard

The platform includes an optional narration engine that summarizes the tool result into exactly **two sentences of plain English** and **two sentences of Bangla**.

### Strict Zero-Hallucination Verification Protocol
- The agent receives **only** the computed tool result dictionary.
- The output validator parses every number in both English (`0-9`) and Bangla (`০-৯`) digits.
- **If any stated number is absent from the tool result, output is immediately BLOCKED** and replaced with a guaranteed deterministic summary.

---

## ⚡ Quickstart & Offline Verification

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/shantoislam/earth-system-trend-detective.git
cd earth-system-trend-detective

# Create virtual environment and install requirements
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Verify Pre-Cached Datasets
```bash
# Cache is pre-built! To regenerate all 64 districts & Zarr grid:
python -m scripts.generate_cache
```

### 3. Run the Unit Test Suite (22 Tests)
```bash
pytest -v
```

### 4. Launch the Application (Offline-First)
```bash
# Run with OFFLINE=1 (ensures zero external network requests)
export OFFLINE=1  # On Windows PowerShell: $env:OFFLINE="1"
uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```
Navigate to `http://localhost:8000` to interact with the map, time series, two-district comparison, and provenance drawer.

---

## 📡 API Reference

### `GET /trend`
Parameters:
- `district` (string, default: `Rajshahi`)
- `variable` (string, default: `T2M`)
- `start` (string, default: `2001-01-01`)
- `end` (string, default: `2025-12-31`)
- `include_series` (bool, default: `true`)

**Response:**
```json
{
  "district": "Rajshahi",
  "variable": "T2M",
  "period": "2001-01-01 to 2025-12-31",
  "n_observations": 9131,
  "trend": {
    "S": 41230,
    "Z": 3.61,
    "p_value": 0.0003,
    "direction": "increasing",
    "significant_at_0.05": true
  },
  "slope": {
    "slope_per_year": 0.031,
    "ci_low": 0.014,
    "ci_high": 0.048,
    "units": "degC per year"
  },
  "provenance": {
    "dataset_id": "NASA POWER daily point",
    "source_url": "https://power.larc.nasa.gov/api/temporal/daily/point",
    "retrieved": "2026-11-02T09:14:00Z",
    "mode": "cache"
  }
}
```

### Additional Endpoints
- `GET /districts` — Lists all 64 Bangladesh districts with coordinates and divisions.
- `GET /variables` — Variable descriptions, measurement units, and NASA data products.
- `GET /compare` — Compares trends between two districts over the same period.
- `GET /forecast` — ML forecasting with Ridge AR + Harmonic model, validation metrics, and 95% prediction intervals.
- `GET /mirror-finder` — Discovers the district with the most divergent trend (opposite-trend detector).
- `GET /sensitivity` — Window sensitivity analysis across 10, 15, 20, and 25-year time windows.
- `GET /map/fdr` — Benjamini-Hochberg False Discovery Rate correction across all 64 districts.
- `GET /gridded` — Returns 2D spatial raster slice from the Zarr store.
- `GET /narration` — Returns verified bilingual plain-language summaries.
- `GET /export` — Exports filtered trend records in CSV or GeoJSON format.
- `GET /config` — Returns CARTO API key and offline mode status for the frontend.
- `GET /health` — Verifies cache availability and offline mode status.

---

## 📄 License
This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

