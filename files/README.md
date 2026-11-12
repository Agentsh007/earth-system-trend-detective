# 🌍 Earth System Trend Detective

**From "what the data appears to show" to "what the evidence actually supports."**

An interactive web app that turns NASA Earth-observation data into trends you can investigate, test and trust, region by region. Built for the **NASA Space Apps Challenge 2026** — challenge: *Be an Earth System Trend Detective*.

> **Project status:** This repository describes a student prototype that is **in development**. The features below are our intended design unless marked otherwise. No scientific finding is claimed until it has been computed from real data, quality-checked and reviewed.

---

## 📖 The story behind the project

A farmer in Bangladesh stands in his field. The seasons feel unpredictable: some years bring too little rain, others more than the land can handle. He wonders, *"Is this just a bad year, or is something changing?"*

He searches for answers and finds colorful maps, charts full of numbers and reports about environmental change. Some say conditions are getting worse. Others show a different picture. One question stays unanswered: **how do we know what is really happening?**

- A rising line may look alarming. But is the change **statistically significant**?
- A falling trend may be a long-term problem, or just a temporary natural cycle.
- One region may be getting wetter while another gets drier. A **national average can hide the changes that matter most.**

The problem isn't a lack of data. Satellites observe our planet, datasets track its changes and models help explain its behavior. **The problem is turning all that data into evidence we can trust.**

Earth System Trend Detective is our answer: investigate change region by region, measure how fast it is happening, test whether the trend is statistically credible, compare regions, and explore what might come next.

---

## 🎯 What the app answers

| Question | How the app addresses it |
|---|---|
| **What** is changing? | Variable selector, trend map and time-series chart |
| **Where** is it changing? | Interactive map and region inspector |
| **How much** is it changing? | Sen's slope (rate of change) and baseline-vs-recent comparison, in real units |
| **Is it significant?** | Mann–Kendall test, p-values, confidence intervals (where valid) and coverage status |
| **Can we trust it?** | Data-quality checks, observation coverage, sensitivity to the time window, and a transparent methods panel |
| **Do places behave differently?** | Side-by-side regional comparison using identical methods |

Our purpose is global. **Bangladesh is our first case study**, where changes in rainfall and temperature matter directly to agriculture and livelihoods. The method is designed to extend to other regions and variables.

---

## ✨ Planned features

### Core (MVP)

1. **Trend Explorer map** – Choose a variable, time period and region. The map shows trend direction and size, and separates *significant*, *not significant* and *insufficient data* results using patterns as well as color (colorblind-aware palette). Bangladesh is masked with an official boundary polygon.
2. **Region inspector and time-series chart** – Click a region to see its observations over time, units, estimated trend, observation count and missing-data coverage. A confidence band is shown only when a documented method supports it.
3. **Statistical trend engine** – Sen's slope for rate and direction, Mann–Kendall for evidence of a monotonic trend, tested on synthetic increasing, decreasing and flat series. Benjamini–Hochberg correction is considered when many map cells are tested.
4. **ML forecast** – A machine-learning model estimates possible future values for the selected variable. It uses time-ordered train/validation/test splits, is compared against simple baseline forecasts, and reports forecast error and prediction intervals. Forecasts are shown as possibilities, never as certainties or causal explanations.
5. **Significance, coverage and uncertainty** – Valid-observation counts, missing-data coverage and quality status are always visible. Regions with too little data are labeled *insufficient data*, not *no trend*.
6. **Regional comparison** – Compare two or more regions over the same period, variable, units and method. Incompatible comparisons are blocked or clearly qualified.
7. **Methods panel and plain-language insights** – Dataset and version, units, resolution, date range, quality-control choices, assumptions and limitations. Summaries are rule-based and written from already-computed values.
8. **Export** – Download filtered results as CSV and, for spatial data, GeoJSON.

### Optional / later

- **Mirror Finder:** detect regions where the same variable moves in opposite directions (needs enough comparable regions and careful multiple-testing control).
- **Window sensitivity view:** show how a trend changes when the start and end years change.
- **Additional variables:** vegetation greenness (MODIS NDVI) and GPM precipitation, after the first pipeline is validated.
- **Global map view:** after the Bangladesh pipeline works reliably.
- **Trend Detective game:** an educational "guess the trend" mode.

### Deliberately deferred or excluded

- **Risk scores or hazard warnings.** A trend alone is not a validated risk forecast.
- **Shared-driver explanations.** Opposite trends do not prove a common cause.
- **ENSO-removal toggle**, unless we have a defensible dataset and tested method.

---

## 🛰️ Data plan

We plan to use **NASA open data APIs**. Our first candidate is **NASA POWER** (temperature or precipitation). Before committing, we will confirm the exact variable, product version, temporal coverage, quality information and fit with the official challenge data list (due October 28, 2026). The app will state clearly whether a field comes from satellite observations, data assimilation or model/reanalysis inputs. If the challenge favors a mission-specific product, we will use that instead.

For each region or cell we keep: identifier, variable, product and version, date or period, value and unit, valid-observation count and coverage, baseline and recent values, Sen's slope, p-value (and adjusted p-value), confidence interval if valid, and the method/configuration version.

---

## 🧪 Methods at a glance

- **Sen's slope** – a robust estimate of change per unit of time.
- **Mann–Kendall test** – evidence for a monotonic trend.
- **Quality checks** – seasonality, serial correlation, missing data and outliers are assessed before trends are reported.
- **Multiple testing** – false-discovery-rate correction (Benjamini–Hochberg) where many cells are tested.
- **Forecasting** – time-ordered validation and baseline comparison; uncertainty reported.
- **Validation** – statistical outputs are tested on synthetic data and independently checked against sample calculations before display.

A p-value below 0.05 is **not** proof of cause, and statistical significance does not automatically mean a change matters in practice.

---

## 🧱 Proposed technical stack

| Part | Tools |
|---|---|
| App interface | Python, Streamlit |
| Map | Folium, streamlit-folium |
| Charts | Plotly |
| Data processing | pandas, NumPy |
| Geospatial | GeoPandas, Shapely, h3-py |
| Gridded data (if needed) | xarray, rasterio |
| Trend statistics | A verified Mann–Kendall / Sen's slope package |
| ML forecasting | scikit-learn (final model to be documented) |

This is the planned stack, not a record of what is already implemented.

---

## 🗺️ Roadmap

1. Confirm official challenge data requirements; select one variable and product.
2. Download a sample; document units, quality rules, coverage and resolution.
3. Build regional time series and summaries with a Bangladesh boundary mask.
4. Test Sen's slope and Mann–Kendall on synthetic data.
5. Build the map, time-series chart, region inspector, coverage states and methods panel.
6. Add two-region comparison and the ML forecast with validation.
7. Add CSV/GeoJSON export and rule-based summaries.
8. Only after validation: second variable, Mirror Finder, or global view.

### MVP definition of done

A user can choose a supported variable and period, see where a trend appears on the Bangladesh map, open a region to view observations and the trend in real units with its statistical evidence and coverage, see an ML forecast with validation results, compare regions, read the methods and limitations, and export results without the app making unsupported claims.

---

## ⚠️ Limitations and responsible use

- Satellite, assimilation and reanalysis products differ in resolution and uncertainty. A finer display grid does not improve the source data's true resolution.
- Seasonal cycles, missing data, sensor changes and natural variability can resemble long-term trends.
- A statistical trend does not identify its cause or predict the future.
- Satellite records are relatively short, so some trends may reflect natural cycles.
- Any language-model component may only rephrase computed results; it must never invent or calculate scientific values.

---

## 👥 Team

| Name | Role |
|---|---|
| Shanto Islam | Team Leader, Web Developer |
| Sayfullah Mansur Sujon Sarkar | ML Researcher |
| Salma Fariha Koly | Idea Generation |
| Jamema Joty | UI/UX Designer |
| Zerin Islam | UI/UX Designer |
| Al Fahad Uthso | Presenter, Content Lead |

---

## 🏆 Challenge mapping

**NASA Space Apps Challenge 2026: Be an Earth System Trend Detective.** Find and examine variables measured by NASA missions or produced by NASA models, visualize how they change over time, and determine what is changing, where, by how much, and whether the change is statistically significant.

| Challenge requirement | Our approach |
|---|---|
| NASA-measured or NASA-modeled variables | NASA open data (first candidate: NASA POWER) |
| Visualize change over time | Trend map, time-series charts, forecast view |
| What / where / how much | Variable selector, region inspector, Sen's slope in real units |
| Is it significant? | Mann–Kendall, p-values, confidence intervals, multiple-testing correction |
| Different trends in different regions | Regional comparison (Mirror Finder planned as a bonus) |

---

## 🤖 AI use disclosure

AI tools were used to help with brainstorming, planning and drafting project documentation. All scientific results shown in the app must come from real NASA data processed by our own code and verified by the team.

## 🙏 Acknowledgements

NASA and the NASA Space Apps Challenge, NASA open-data providers, and the open-source scientific Python community.
