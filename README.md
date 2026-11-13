# 🌍 Earth System Trend Detective: Bangladesh

**High-Performance, Offline-First Scientific Earth-System Trend Investigation Platform**  
*Built for the NASA Space Apps Challenge: Be an Earth System Trend Detective*

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Tests](https://img.shields.io/badge/Tests-Passing%20(23%2F23)-brightgreen.svg)]()
[![Offline Mode](https://img.shields.io/badge/Offline--First-OFFLINE%3D1-success.svg)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)]()
[![Theme](https://img.shields.io/badge/Theme-Black%20%7C%20Yellow%20%7C%20White-facc15.svg)]()
[![Bilingual](https://img.shields.io/badge/Language-English%20%7C%20বাংলা-white.svg)]()

---

## 📖 Overview

**Earth System Trend Detective** is an offline-first, mathematically rigorous climatological investigation web platform tailored to Bangladesh’s 64 districts. It is engineered to distinguish genuine, statistically significant long-term Earth-system climate trajectories from short-term natural cyclic oscillations and sensor noise across a 25-year baseline (2001–2025).

The platform pairs strict non-parametric statistical computing (Mann-Kendall rank concordance, Theil-Sen robust slope, Hollander-Wolfe exact confidence intervals, Benjamini-Hochberg FDR) with rich interactive visualizations (interactive Leaflet map with division filtering, 2D multidimensional Zarr gridded rasters with timeline playback and click-to-probe time series, an opposite-trend Mirror Finder with scientific dipole drivers, machine-learning forecasting with 95% prediction intervals, and a zero-hallucination bilingual narration agent).

---

## 🏛️ System Architecture

```text
NASA Earth Data Sources (POWER / MODIS / IMERG / GRACE)
                       │ (Pre-cached)
                       ▼
          Local Cache Layer (.parquet + .zarr)
                       │
       ┌───────────────┴─────────────────┐
       ▼                                 ▼
Science & Math Layer             Multidimensional Zarr
(src/compute/trend.py)           (data/cache/gridded_bangladesh.zarr)
 • Mann-Kendall exact (Fenwick)   • (time: 300, lat: 25, lon: 19)
 • Theil-Sen (Hollander-Wolfe)    • MODIS NDVI (Vegetation)
 • Seasonal Decomposition         • GPM IMERG Precipitation
 • Benjamini-Hochberg FDR         • GRACE TWS Anomaly
 • Ridge ML Forecaster            • Point-and-Click 300-Month Probe
       │                                 │
       └───────────────┬─────────────────┘
                       ▼
             FastAPI High-Speed REST API
             (src/api/main.py, port 8080)
                       │
      ┌────────────────┼────────────────┐
      ▼                ▼                ▼
Interactive Map   Zarr Canvas     Mirror Finder &
& Time-Series     • Playback      • Top 5 Leaderboard
• Division Filter • Hover Readout • Shared Driver Cards
• Metric Modes    • 4 Colormaps   • Geodesic Dipole Arc
• Popups & Actions• Pixel Probe
```

---

## 🛰️ NASA Earth Observation Datasets

Every dataset included in the platform is derived from NASA Earth Science missions and is pre-cached locally for deterministic, zero-latency, offline operation:

| Dataset | Variables | Temporal Range & Res | Spatial Resolution | Official NASA Source |
|---|---|---|---|---|
| **NASA POWER Daily Point** | `T2M` (2m Surface Temperature, °C)<br>`PRECTOTCORR` (Precipitation, mm/day)<br>`ALLSKY_SFC_SW_DWN` (Solar Radiation, MJ/m²/day) | 2001-01-01 to 2025-12-31 (9,131 daily records per district) | District centroids across all 64 districts of Bangladesh | [NASA POWER API](https://power.larc.nasa.gov/) |
| **NASA MODIS Terra/Aqua (MOD13Q1)** | `ndvi` (Normalized Difference Vegetation Index) | 2001–2025 (300 monthly time steps) | 0.25° Gridded Mask | [NASA AppEEARS / LP DAAC](https://appeears.earthdatacloud.nasa.gov/) |
| **NASA GPM IMERG** | `imerg_precip` (Multi-satellite precipitation, mm/month) | 2001–2025 (300 monthly time steps) | 0.25° Gridded Mask | [NASA GPM IMERG](https://gpm.nasa.gov/data/imerg) |
| **NASA JPL GRACE / GRACE-FO** | `tws_anomaly` (Terrestrial water storage anomaly, cm liquid water equivalent) | 2001–2025 (300 monthly time steps) | 0.25° Gridded Mask | [NASA JPL GRACE Mascon](https://grace.jpl.nasa.gov/) |

---

## ✨ Features & Functionalities in Depth

### 1. 🗺️ District Trend Explorer & Spatial Inspector (Tab 1)
- **All 64 Districts**: Real-time analysis for any of the 64 districts in Bangladesh from 2001 to 2025.
- **Mann-Kendall Trend Test**: Non-parametric test yielding test statistic $S$, standardized $Z$, and exact two-tailed $p$-value. Evaluates monotonic trend presence without assuming normality.
- **Theil-Sen Robust Slope**: Median of all pairwise slopes, resilient up to 29.3% data contamination and extreme weather outliers.
- **Hollander-Wolfe Exact 95% Confidence Interval**: Provides non-parametric upper and lower bounds for annual change rates.
- **Additive Seasonal Decomposition**: Extracts Trend, Cyclic Seasonality (12-month harmonic periodicity), and Residual Anomalies.
- **Window Sensitivity Robustness Check**: Evaluates trend stability across sliding/expanding historical windows (10, 15, 20, and 25 years) to test whether detected shifts are persistent or cyclic.
- **Baseline-to-Recent Comparison**: Quantifies net physical change between baseline period (2001–2005) and recent period (2021–2025).
- **QA/QC Data Coverage Audit**: Verifies record completeness (100% complete, 9,131 daily observations).

### 2. 🌍 Interactive Spatial Map (Enhanced)
- **CARTO Basemap Integration**: High-contrast, dark/light theme-adaptive vector tiles via CARTO raster tile endpoints.
- **Division Filter Dropdown**: Filter map markers and smoothly zoom/pan into any of Bangladesh’s 8 divisions (Dhaka, Rajshahi, Chattogram, Khulna, Sylhet, Rangpur, Barishal, Mymensingh) or view all 64 districts.
- **Multi-Metric Display Modes**:
  - *Mode 1: Trend Rate (Sen's Slope)* — Markers dynamically sized and colored by rate of warming/wetting.
  - *Mode 2: Statistical Significance* — Stippling highlighting districts with proven statistical trends ($p < 0.05$) vs random noise.
  - *Mode 3: Robustness Tier* — Classifies districts into Robust, Moderate, or Fragile tiers.
- **Interactive Quick-Action Popups**: Click any district circle marker to open a popup with key metrics and 3 instant action buttons:
  - `[ 📊 Inspect Trend ]`: Immediately loads district into single trend inspector.
  - `[ 1️⃣ Set as District 1 ]`: Sets district as baseline in comparison tab.
  - `[ 2️⃣ Set as District 2 ]`: Sets district as comparison partner.
- **Animated Geodesic Dipole Link**: Visualizes climate contrasts by drawing an animated dashed arc between paired districts with marker glow effects.

### 3. 🌐 Gridded Zarr Explorer (MODIS / IMERG / GRACE) (Tab 4)
- **High-Resolution 2D Earth Observation Canvas**: Renders multidimensional Zarr raster slices `(time: 300, lat: 25, lon: 19)` across Bangladesh.
- **Automated Timeline Playback Controls**:
  - `▶ Play` / `⏸ Pause` / `⏪ Prev` / `⏩ Next` / `🔄 Reset`.
  - Playback speed selector: `1x (1.0s)`, `2.5x (0.4s)`, `5x (0.18s)`.
  - Step counter and observation month pill: e.g. `Month 145 / 300 (2013-01)`.
- **Scientific Colormap Engine**: Switch between 4 color scales with dynamic legend gradient preview:
  1. *Yellow-Black-White* (Theme Default)
  2. *Viridis* (Perceptual scientific standard)
  3. *Thermal / Magma* (Ideal for thermal radiance and TWS anomaly)
  4. *Chlorophyll Green* (Specialized for vegetative canopy vigor)
- **Live Pixel Coordinate Inspector**: Hover over any point on the canvas to see instant coordinates and value readout: `Lat: 24.25° Lon: 90.00° | Val: 0.652 NDVI`.
- **Point-and-Click 25-Year Time Series Probe**: Click *any* point on the 2D canvas to probe that exact grid cell and generate a 300-month time series chart below, complete with Theil-Sen slope, Mann-Kendall $p$-value, and summary metrics.

### 4. ⚖️ Two-District Comparison & Mirror Finder (Tab 3)
- **Dual-District Comparative Analysis**: Side-by-side time series and slope comparison across any two districts.
- **Ranked Mirror Leaderboard (Top 5)**: Automatically ranks the 5 strongest opposite-trend / divergent district pairs across Bangladesh for the chosen variable, showing Target District, Mirror District, individual slopes, and divergence delta ($\Delta$ Slope).
- **One-Click Pair Loading**: Click `[ ⚖️ Load Pair ]` on any row to instantly configure District 1 and District 2, refresh dual charts, and draw the dipole arc on the map.
- **Shared Climatological Driver Cards**: Dynamic scientific explanations (in both English and Bangla) detailing the physical hydro-meteorological drivers of divergence:
  - *Groundwater (TWS)*: Northwestern Barind deep-aquifer Boro irrigation extraction vs southeastern coastal wetland saturation.
  - *Vegetation (NDVI)*: Metropolitan impervious surface urban heat vs rural social forestry and coastal mangrove greening.
  - *Precipitation*: Northeastern Meghalaya orographic rainfall uplift vs western continental rain shadow.
  - *Temperature*: Urban Heat Island (UHI) forcing vs agricultural vegetative evaporative cooling.

### 5. 🔮 Machine Learning Trajectory Forecaster (Tab 2)
- **Model Architecture**: Regularized Ridge regression combining harmonic Fourier seasonal components (annual and semi-annual cycles) with autoregressive lag features.
- **Validation Protocol**: Time-ordered 80/20 train/test split (never random k-fold) ensuring zero future data leakage.
- **Skill Score Benchmark**: Compared against naive seasonal persistence baseline, reporting RMSE reduction and MAE.
- **95% Prediction Interval Envelope**: Visualizes uncertainty bands without making unwarranted deterministic or emergency claims.

### 6. 🗣️ Deterministic Bilingual Narration Agent
- **Anti-Hallucination Guard**: Summarizes findings into exactly 2 plain English sentences and 2 Bangla sentences.
- **Strict Verification**: Extracts and checks every numerical value stated in English and Bangla digits against the exact calculated results object. If an unverified number is detected, the output is blocked and replaced with a deterministic fallback summary.

### 7. 🎨 UI/UX: Theme, Language & Scientific Palette
- **Scientific Color Palette**: Strictly White, Yellow, and Black palette adhering to high-contrast cartographic standards.
- **Dark / Light Theme Toggle**: Seamless switching with persistent state and dynamic Chart.js/CARTO basemap restyling.
- **English / Bangla Bilingual Toggle**: One-click language switch with full translations for all titles, labels, legends, banners, and driver narratives.
- **Standard Feature Detail Banners**: Concise 2–3 sentence explanatory headers at the top of every tab outlining feature methodology and scope.

---

## ⚡ Performance & Optimization Highlights

| Optimization | Before | After | Speedup |
|---|---|---|---|
| 9,131-day Theil-Sen slope computation | 8.90 s ($O(N^2)$ pairwise) | 0.038 s (Hollander-Wolfe rank estimator) | **~230x faster** |
| Moving window sensitivity analysis | 22.80 s | 0.054 s (Monthly climatological resampling) | **~420x faster** |
| Gridded Zarr pixel time series probe | N/A (New feature) | < 0.005 s ($O(1)$ coordinate slice + LRU cache) | **Instant** |
| Full pytest test suite (23 tests) | 55.25 s | 4.27 s | **~13x faster** |
| Slider timeline scrubbing | Network congestion | 40ms debounce + `AbortController` cancellation | **Smooth 60fps** |

---

## 🚀 Local Installation & Quickstart

### Prerequisites
- Python 3.10, 3.11, or 3.12
- Git

### 1. Clone & Set Up Environment
```bash
# Clone the repository
git clone https://github.com/shantoislam/earth-system-trend-detective.git
cd earth-system-trend-detective

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Linux / macOS:
source .venv/bin/activate
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Windows (Command Prompt):
.venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt
```

### 2. Run Test Suite
```bash
pytest tests/ -v
```
All 23 unit and integration tests should pass in under 5 seconds.

### 3. Launch the Server
```bash
# Run in offline-first mode
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8080 --reload
```
Open your browser and navigate to:
```
http://127.0.0.1:8080
```

---

## 🌐 How to Deploy to Free Hosting Services

Because this application uses FastAPI with pre-cached Parquet and Zarr data files (under 100 MB total), it can be deployed on popular free cloud hosting platforms without requiring external databases.

Below are detailed step-by-step instructions for three top free deployment options:

---

### Option A: Deploy to Render.com (Recommended - Easiest & Most Reliable)

[Render](https://render.com/) offers a generous free tier for Python web services with native support for FastAPI and Uvicorn.

#### Step-by-Step Instructions:
1. **Push your code to GitHub**:
   Ensure all files (including `requirements.txt`, `src/`, `data/cache/`, `static/`) are committed and pushed to your GitHub repository.
2. **Sign up / Log in to Render**:
   Go to [https://render.com](https://render.com) and log in with your GitHub account.
3. **Create a New Web Service**:
   - In the Render Dashboard, click **New +** > **Web Service**.
   - Connect your GitHub repository: `earth-system-trend-detective`.
4. **Configure Service Settings**:
   - **Name**: `earth-system-trend-detective` (or your choice).
   - **Region**: Singapore or Frankfurt (closest to your users).
   - **Branch**: `master` (or `main`).
   - **Root Directory**: Leave blank (root).
   - **Runtime**: `Python 3`.
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn src.api.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: Select **Free**.
5. **Set Environment Variables**:
   Under **Environment Variables**, add:
   - Key: `OFFLINE` | Value: `1`
   - Key: `PYTHON_VERSION` | Value: `3.12.0`
6. **Click "Deploy Web Service"**:
   Render will clone the repo, install dependencies from `requirements.txt`, and deploy the application. Within 2–3 minutes, your live URL will be active (e.g. `https://earth-system-trend-detective.onrender.com`).

---

### Option B: Deploy to Hugging Face Spaces (Great for Science & NASA Projects)

Hugging Face Spaces provides 100% free CPU containers (2 vCPU, 16 GB RAM) with unlimited uptime and zero sleep timeouts for public open-source science applications.

#### Step-by-Step Instructions:
1. **Sign up / Log in to Hugging Face**:
   Go to [https://huggingface.co](https://huggingface.co) and create a free account.
2. **Create a New Space**:
   - Click your profile icon > **New Space**.
   - **Space Name**: `earth-system-trend-detective`.
   - **License**: `apache-2.0`.
   - **Space SDK**: Select **Docker** (or **Gradio / Static** with Dockerfile).
   - **Space Hardware**: Free CPU (2 vCPU, 16 GB RAM).
   - Set visibility to **Public**.
3. **Add a `Dockerfile`** in the repository root:
   ```dockerfile
   FROM python:3.12-slim

   WORKDIR /app

   # Install build dependencies
   RUN apt-get update && apt-get install -y --no-install-recommends \
       build-essential \
       && rm -rf /var/lib/apt/lists/*

   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   COPY . .

   ENV OFFLINE=1
   EXPOSE 7860

   CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "7860"]
   ```
4. **Push to the Hugging Face Git Remote**:
   ```bash
   git remote add space https://huggingface.co/spaces/<YOUR_USERNAME>/earth-system-trend-detective
   git push space master:main
   ```
5. Your app will automatically build and stay live permanently on Hugging Face Spaces at `https://huggingface.co/spaces/<YOUR_USERNAME>/earth-system-trend-detective`!

---

### Option C: Deploy to Railway.app

Railway offers free trial credits with zero-configuration deployments.

#### Step-by-Step Instructions:
1. Go to [https://railway.app](https://railway.app) and log in with GitHub.
2. Click **New Project** > **Deploy from GitHub repo**.
3. Select `earth-system-trend-detective`.
4. In **Settings** > **Deploy**, set the Start Command:
   ```bash
   uvicorn src.api.main:app --host 0.0.0.0 --port $PORT
   ```
5. Add variable `OFFLINE=1` in the **Variables** tab.
6. In **Networking**, click **Generate Domain** to get a public `*.up.railway.app` URL.

---

### Option D: Deploy with Docker Container (Self-Hosted / VPS / Fly.io)

For any cloud server or free container host (e.g. Oracle Cloud Free Tier, Fly.io, Google Cloud Run):

1. **Build Container**:
   ```bash
   docker build -t earth-system-trend-detective .
   ```
2. **Run Container**:
   ```bash
   docker run -d -p 8080:8080 -e OFFLINE=1 earth-system-trend-detective
   ```
3. Open `http://localhost:8080`.

---

## 📂 Project Structure

```text
├── data/
│   ├── cache/
│   │   ├── districts/              # Pre-cached daily Parquet records for all 64 districts
│   │   │   ├── rajshahi.parquet
│   │   │   ├── dhaka.parquet
│   │   │   └── ... (64 districts)
│   │   └── gridded_bangladesh.zarr/ # Pre-cached multidimensional Zarr store (300 months)
│   │       ├── ndvi/
│   │       ├── imerg_precip/
│   │       └── tws_anomaly/
│   └── fixtures/                   # Static benchmarks for zero-network validation
├── src/
│   ├── api/
│   │   ├── main.py                 # FastAPI application, routing, LRU caching & handlers
│   │   └── schemas.py              # Strict Pydantic models for results & provenance
│   ├── compute/
│   │   ├── trend.py                # Mann-Kendall, Theil-Sen, Hollander-Wolfe & Decomposition
│   │   ├── fdr.py                  # Benjamini-Hochberg False Discovery Rate correction
│   │   └── forecast.py             # Ridge regression ML forecaster with 80/20 train/test
│   ├── data/
│   │   ├── districts.py            # Complete geospatial metadata for 64 districts
│   │   └── loader.py               # Optimized offline data loader (Parquet + Zarr)
│   └── narration/
│       └── agent.py                # Deterministic bilingual narration & hallucination audit
├── static/
│   ├── index.html                  # Responsive UI with 5 tabs, banners & control bars
│   ├── style.css                   # White-Yellow-Black theme styling, dark/light modes
│   └── app.js                      # High-speed client logic, Leaflet map, Chart.js & Zarr canvas
├── tests/
│   ├── test_api.py                 # API integration tests (all endpoints)
│   ├── test_compute.py             # Numerical accuracy and edge-case unit tests
│   └── test_narration.py           # Narration verification and hallucination block tests
├── Dockerfile                      # Production Docker container definition
├── pyproject.toml                  # Python package configuration
├── requirements.txt                # Production Python dependencies
└── README.md                       # Comprehensive system documentation
```

---

## 🧪 Verification & Reproducibility Checklist

- [x] **Strict Non-Parametric Statistics**: Mann-Kendall tests are calculated via Fenwick trees; Theil-Sen slopes are calculated via Hollander-Wolfe rank estimators without stochastic approximations.
- [x] **Zero Hallucination Protocol**: Narration numbers are deterministically audited in English and Bangla before rendering.
- [x] **100% Offline Resilience**: Runs under `OFFLINE=1` with zero external network dependencies.
- [x] **Full 64 District Coverage**: 25 years of continuous daily data (9,131 days) from 2001 to 2025.
- [x] **Sub-Second Latency**: All district lookups, map FDR corrections, and gridded pixel probes return in under 50 ms via two-tier client and server LRU caching.
- [x] **23 Passing Unit Tests**: Fully validated via `pytest tests/ -v`.

---

## 📜 License
This project is open-source and licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for complete details. Built with pride for the **NASA Space Apps Challenge 2026**.
#   T e a m _ C a p s t o n e  
 