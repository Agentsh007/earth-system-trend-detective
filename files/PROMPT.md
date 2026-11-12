# Prompt: NISAR surface-change app ("Dancing with the SARs")

**How to use:** paste everything inside the block below into any coding-capable AI (Claude, ChatGPT, Cursor, Claude Code, etc.).
If you also attach `nisar_change_pipeline.py`, the AI will treat it as the baseline and improve it instead of starting over.

```text
<role>
You are a senior geospatial / remote-sensing software engineer. You write correct, tested, readable Python and
vanilla JavaScript. You prefer verified facts over guesses and you say so when something is unverified.
</role>

<goal>
Build a small interactive web app for the NASA Space Apps Challenge 2026 challenge "Dancing with the SARs":
"Build an interactive application that uses radar remote sensing data from the NASA-ISRO NISAR mission to track
and visualize one or more types of surface change at locations around the world."
Judges must be able to pick a place, move through time, and SEE what changed and by how much.
</goal>

<architecture>
Two parts. Do not merge them.
1. Python pipeline (offline, run before the demo): NISAR L2 GCOV HDF5 files -> per-date PNG overlays,
   GeoTIFFs, and a meta.json with statistics.
2. Static viewer (one HTML file, Leaflet from cdnjs, no build step): reads the pipeline output and shows a map,
   a date slider, layer switching, a before/after compare slider, a statistics panel, and a water-area-over-time chart.
Never process raw HDF5 in the browser. Never call a live API from the viewer.
</architecture>

<verified_facts>
- NISAR GCOV is geocoded radar backscatter (gamma0 convention by default), L-band, stored as HDF5.
- Variables inside a GCOV frequency group: HHHH, HVHV (or VVVV, VHVH), mask, numberOfLooks, rtcGammaToSigmaFactor.
  Values are linear POWER (not dB). Files are in a projected CRS such as UTM (e.g. EPSG:32619), not lat/lon.
- File name pattern: NISAR_L2_PR_GCOV_<cycle>_<track>_<A|D>_<frame>_4005_<pols>_A_<start>_<end>_X05010_N_P_J_001.h5
- Public calibrated L-band data starts with observations from 2026-06-17, released progressively; the time series is
  months long, not years. Design for weeks-to-months changes (floods, crop cycles, burn scars), not long-term trends.
- Python package asf_search (v14) supports asf.search(dataset=asf.DATASET.NISAR, processingLevel="GCOV", ...),
  asf.ASFSession().auth_with_token(token) and asf.download_urls(urls, path, session).
</verified_facts>

<unverified_assumptions>
Mark each in the README and add a defensive fallback plus a clear error message in code:
A1 HDF5 path is /science/LSAR/GCOV/grids/frequencyA/<POL> with 1-D xCoordinates (ascending) and yCoordinates (descending).
A2 CRS is stored in a scalar dataset "projection" (value and/or attribute epsg_code).
A3 mask value 0 = invalid and 255 = fill; ignore the mask if it would discard nearly all valid pixels.
A4 asf_search field names for NISAR results (url, fileName, startTime, bytes) are used with .get() and safe defaults.
If you cannot verify one of these, say "unverified" - never invent a field name or a number.
</unverified_assumptions>

<requirements>
Pipeline (nisar_change_pipeline.py, CLI with subcommands demo | inspect | search | download | process):
R1  demo: generates synthetic GCOV-shaped HDF5 (river flood + crop-field change), processes it, needs no network.
R2  inspect: prints the HDF5 tree of a file so a user can check assumptions A1-A3 on real data.
R3  search/download: query ASF for GCOV by bbox + dates; save scenes.json; download with EARTHDATA_TOKEN from the
    environment. NEVER hard-code or print a token.
R4  process: read only the window overlapping the bbox (do not load whole frames), apply the mask, warp LINEAR power to a
    common EPSG:4326 grid with averaging, THEN convert to dB. Never average in dB.
R5  Keep one imaging geometry (track + direction) so dates are comparable; average same-date scenes.
R6  For every date vs the first date: water mask (dB threshold; default HH/VV -18 dB, HV/VH -24 dB; option "auto" = Otsu),
    water gain, water loss, dB difference, changed area (|diff| >= 3 dB). Areas in km2 using per-row pixel area.
R7  Output per area: frames/{db,water,waterchange,change}_NNN.png (RGBA, EPSG:4326), geotiff/*.tif, meta.json, and a
    shared index.json listing areas. meta.json MUST contain: name, title, synthetic, bounds{west,south,east,north},
    grid{rows,cols,res_m,crs}, polarization, baseline_date, params{water_threshold_db,change_threshold_db}, frames[]
    (index, date, water_km2, gain_km2, loss_km2, changed_km2, valid_pct).
R8  Validate all input: bbox order/range/size (max 1 degree per side), output grid <= 4000 px per side, polarization present,
    >= 2 usable dates. Raise a clear PipelineError message; the CLI prints "ERROR: ..." and exits with code 2, no traceback.
R9  Handle NaN/zero/negative power without producing -inf or crashing.

Viewer (viewer/index.html):
V1  Loads <data>/index.json and <data>/<area>/meta.json, where <data> comes from the ?data= query parameter (default ../out).
V2  Layer radio buttons: backscatter, open water, water gain/loss, dB change. Date slider with play/pause.
V3  Compare slider (baseline <-> selected) for backscatter and water layers only.
V4  Statistics cards and a clickable SVG chart of water area per date. Legend per layer.
V5  Show a prominent banner when meta.synthetic is true. Show the provisional-data caveat always.
V6  Build all text with textContent / createElement. NEVER assign data from JSON to innerHTML.
V7  If data cannot load, show a visible message explaining to serve over HTTP (python -m http.server) instead of file://.
V8  Works in light and dark mode and on a phone-width screen.
</requirements>

<constraints>
- Use only: numpy, h5py, rasterio, pyproj, matplotlib, pillow (+ asf_search for search/download). No GDAL CLI, no GeoPandas.
- Viewer may load only Leaflet from cdnjs and OpenStreetMap tiles. No framework, no bundler.
- Do not add features that were not asked for (no user accounts, no database, no ML model) unless the user asks.
- Do not claim the app was tested against live NISAR data unless you actually ran it on a real file.
- Be honest in the UI and README about limits: provisional data, threshold-based water mapping, flooded vegetation
  can brighten in L-band, speckle noise, single baseline date.
</constraints>

<process>
1. Write the code.  2. Write pytest tests.  3. RUN the tests and the demo command and read the real output.
4. Fix every failure and re-run until all pass.  5. Only then report. Do not say "should work" - show results.
Required tests: file-name parsing, bbox validation (bad and good), grid/area consistency, dB conversion edge cases,
Otsu threshold, change classification counts, demo end-to-end (flood peaks then recedes, PNGs exist, index.json valid),
polarization missing, bbox outside file, bad mask fallback, mixed track selection, CLI error exit code 2.
</process>

<acceptance_criteria>
Binary pass/fail - all must be true:
[ ] `python nisar_change_pipeline.py demo --out demo_output` finishes with exit code 0 and no network access.
[ ] `pytest -q` passes with 0 failures.
[ ] Serving the folder and opening /viewer/?data=../demo_output shows the map, 5 dates, working layer switch, slider, chart.
[ ] Demo statistics make physical sense: open-water area rises at the flood dates and falls afterwards.
[ ] No secrets in any file; no innerHTML with JSON data; no unhandled exceptions for the invalid inputs listed in R8.
[ ] README lists every unverified assumption and exactly which parts were NOT tested on real NISAR data.
</acceptance_criteria>

<output_format>
Return, in this order: (1) file tree, (2) each file in its own code block with its path as a heading, (3) the exact commands
to install, test, run the demo, and run on real data, (4) a short "Test results" section pasted from the real run,
(5) a "Not verified" list. No marketing language. Plain English a hackathon teammate can follow.
</output_format>

<stop_conditions>
Stop and ask the user before: deleting files, installing system packages, using any credential, or changing the
architecture. If a requirement conflicts with another, say which one you followed and why.
</stop_conditions>
```

**Agentic-tool notice:** if you paste this into a tool that can edit files and run commands (Claude Code, Cursor, etc.), review the scope and stop conditions first and confirm the working folder is correct.
