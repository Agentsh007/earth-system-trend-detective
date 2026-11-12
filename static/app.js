/**
 * Earth System Trend Detective - Frontend Application Logic
 * Offline-first, pure JavaScript interface with Leaflet, Chart.js, and Zarr Canvas.
 * Styled in White, Yellow, and Black aesthetic.
 * Includes CARTO basemap integration with provided API key,
 * ML Forecasting, Benjamini-Hochberg FDR, Mirror Finder, and Window Sensitivity.
 */

let mapInstance = null;
let districtMarkers = {};
let trendChartInstance = null;
let compareChartInstance = null;
let forecastChartInstance = null;
let currentTrendData = null;
let currentDistricts = [];

// CARTO API Key provided by user
const CARTO_API_KEY = "cb1_4do5_1_fe36f1854b4cfdde4ab86fd2";

// White, Yellow, Black Palette Constants
const COLOR_YELLOW = "#facc15";
const COLOR_YELLOW_BRIGHT = "#fef08a";
const COLOR_WHITE = "#ffffff";
const COLOR_GRAY = "#a3a3a3";
const COLOR_CHARCOAL = "#525252";
const COLOR_BLACK = "#000000";

document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initDrawer();
  initMap();
  await loadDistricts();
  await loadTrend();
  initEventListeners();
});

// Tab switching
function initTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const targetId = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.style.display = pane.id === targetId ? "block" : "none";
      });

      if (targetId === "tab-compare") {
        loadComparison();
      } else if (targetId === "tab-forecast") {
        loadForecast();
      } else if (targetId === "tab-gridded") {
        loadGridded();
      } else if (targetId === "tab-single" && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 200);
      }
    });
  });
}

// Provenance Drawer
function initDrawer() {
  const drawer = document.getElementById("provenance-drawer");
  const backdrop = document.getElementById("drawer-backdrop");
  const openBtn = document.getElementById("open-drawer-btn");
  const closeBtn = document.getElementById("close-drawer-btn");
  const copyBtn = document.getElementById("copy-json-btn");

  const openDrawer = () => {
    drawer.classList.add("open");
    backdrop.classList.add("open");
  };

  const closeDrawer = () => {
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
  };

  openBtn.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);

  copyBtn.addEventListener("click", () => {
    if (currentTrendData) {
      navigator.clipboard.writeText(JSON.stringify(currentTrendData, null, 2));
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = "Copy JSON"; }, 2000);
    }
  });
}

// Leaflet Map Initialization with CARTO Basemap API Key
function initMap() {
  mapInstance = L.map("map-container", {
    center: [23.8, 90.3],
    zoom: 7,
    minZoom: 6,
    maxZoom: 10,
  });

  // CARTO dark raster basemap with authenticated API key (param is ?key=, not ?api_key=)
  const cartoTileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
  
  L.tileLayer(cartoTileUrl, {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> & NASA Open Data',
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(mapInstance);
}

// Load 64 Bangladesh Districts
async function loadDistricts() {
  try {
    const res = await fetch("/districts");
    currentDistricts = await res.json();

    const distSelect = document.getElementById("district-select");
    const compD1 = document.getElementById("compare-d1-select");
    const compD2 = document.getElementById("compare-d2-select");

    distSelect.innerHTML = "";
    compD1.innerHTML = "";
    compD2.innerHTML = "";

    currentDistricts.forEach(d => {
      const opt1 = new Option(`${d.name} (${d.division})`, d.name);
      const opt2 = new Option(`${d.name} (${d.division})`, d.name);
      const opt3 = new Option(`${d.name} (${d.division})`, d.name);

      if (d.name === "Rajshahi") opt1.selected = true;
      if (d.name === "Rajshahi") opt2.selected = true;
      if (d.name === "Dhaka") opt3.selected = true;

      distSelect.add(opt1);
      compD1.add(opt2);
      compD2.add(opt3);

      // Add circle marker on map in yellow/white scheme
      const marker = L.circleMarker([d.lat, d.lon], {
        radius: 7,
        fillColor: COLOR_YELLOW,
        color: COLOR_WHITE,
        weight: 1.5,
        opacity: 0.95,
        fillOpacity: 0.85
      }).addTo(mapInstance);

      marker.bindTooltip(`<b>${d.name}</b><br>${d.division} Division`, {
        direction: "top",
        offset: [0, -5]
      });

      marker.on("click", () => {
        distSelect.value = d.name;
        loadTrend();
      });

      districtMarkers[d.name] = marker;
    });

  } catch (err) {
    console.error("Error loading districts:", err);
  }
}

// Event Listeners for UI Controls
function initEventListeners() {
  document.getElementById("analyze-btn").addEventListener("click", () => loadTrend());
  document.getElementById("district-select").addEventListener("change", () => loadTrend());
  document.getElementById("variable-select").addEventListener("change", () => loadTrend());

  document.getElementById("compare-d1-select").addEventListener("change", () => loadComparison());
  document.getElementById("compare-d2-select").addEventListener("change", () => loadComparison());

  document.getElementById("toggle-ci").addEventListener("change", () => renderTrendChart());
  document.getElementById("toggle-decomp").addEventListener("change", () => renderTrendChart());
  document.getElementById("toggle-fdr").addEventListener("change", (e) => toggleFDR(e.target.checked));

  // Sensitivity panel toggle
  document.getElementById("toggle-sensitivity-btn").addEventListener("click", () => {
    const p = document.getElementById("sensitivity-panel");
    if (p.style.display === "none") {
      p.style.display = "block";
      loadSensitivity();
    } else {
      p.style.display = "none";
    }
  });

  // Mirror Finder button
  document.getElementById("mirror-finder-btn").addEventListener("click", () => runMirrorFinder());

  // ML Forecast button & horizon
  document.getElementById("run-forecast-btn").addEventListener("click", () => loadForecast());
  document.getElementById("forecast-horizon-select").addEventListener("change", () => loadForecast());

  // Gridded explorer controls
  const slider = document.getElementById("grid-time-slider");
  slider.addEventListener("input", (e) => {
    loadGridded(e.target.value);
  });
  document.getElementById("gridded-var-select").addEventListener("change", () => {
    loadGridded(slider.value);
  });

  // Export buttons
  document.getElementById("export-csv-btn").addEventListener("click", () => {
    const d = document.getElementById("district-select").value;
    const v = document.getElementById("variable-select").value;
    const s = document.getElementById("start-date").value;
    const e = document.getElementById("end-date").value;
    window.location.href = `/export?district=${encodeURIComponent(d)}&variable=${encodeURIComponent(v)}&start=${s}&end=${e}&format=csv`;
  });

  document.getElementById("export-geojson-btn").addEventListener("click", () => {
    const d = document.getElementById("district-select").value;
    const v = document.getElementById("variable-select").value;
    const s = document.getElementById("start-date").value;
    const e = document.getElementById("end-date").value;
    window.location.href = `/export?district=${encodeURIComponent(d)}&variable=${encodeURIComponent(v)}&start=${s}&end=${e}&format=geojson`;
  });
}

// Load and Render Trend Analysis for Single District
async function loadTrend() {
  const district = document.getElementById("district-select").value || "Rajshahi";
  const variable = document.getElementById("variable-select").value || "T2M";
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;

  try {
    const url = `/trend?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}&start=${startDate}&end=${endDate}&include_series=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Trend fetch failed");
    currentTrendData = await res.json();

    updateStatCards(currentTrendData);
    updateProvenanceDrawer(currentTrendData);
    renderTrendChart();
    highlightMapMarker(district);
    loadNarration(district, variable, startDate, endDate);

    // If sensitivity panel is open, refresh it
    if (document.getElementById("sensitivity-panel").style.display !== "none") {
      loadSensitivity();
    }

  } catch (err) {
    console.error("Error loading trend:", err);
  }
}

// Update Top Stat Cards (Including QA/QC & Baseline-to-Recent)
function updateStatCards(data) {
  const slope = data.slope.slope_per_year;
  const sign = slope > 0 ? "+" : "";
  document.getElementById("stat-slope").textContent = `${sign}${slope}`;
  document.getElementById("stat-slope-units").textContent = data.slope.units;

  document.getElementById("stat-ci").textContent = `[${data.slope.ci_low}, ${data.slope.ci_high}]`;
  document.getElementById("stat-mk").textContent = `Z = ${data.trend.Z}`;
  document.getElementById("stat-p-val").textContent = `p = ${data.trend.p_value} (S = ${data.trend.S})`;
  document.getElementById("stat-n-obs").textContent = data.n_observations.toLocaleString();

  // QA/QC Status
  if (data.quality_control) {
    document.getElementById("stat-qa-qc").textContent = `Coverage: ${data.quality_control.coverage_percentage}% | Status: ${data.quality_control.status.toUpperCase()}`;
  } else {
    document.getElementById("stat-qa-qc").textContent = data.period;
  }

  // Baseline-to-Recent Change (Sections 4 & 7.3)
  if (data.baseline_recent) {
    const br = data.baseline_recent;
    const brSign = br.total_change > 0 ? "+" : "";
    document.getElementById("baseline-recent-text").textContent = 
      `Baseline (${br.baseline_period}): ${br.baseline_mean} → Recent (${br.recent_period}): ${br.recent_mean} | Net: ${brSign}${br.total_change} (${brSign}${br.percentage_change}%)`;
  }

  document.getElementById("chart-subtitle").textContent = `${data.district} (${data.period}) — ${data.variable}`;
}

// Highlight Selected District on Map in Yellow & White
function highlightMapMarker(selectedDistrict) {
  Object.keys(districtMarkers).forEach(name => {
    const marker = districtMarkers[name];
    if (name === selectedDistrict) {
      marker.setStyle({
        radius: 12,
        fillColor: currentTrendData.trend.direction === "increasing" ? COLOR_YELLOW : COLOR_WHITE,
        color: COLOR_YELLOW,
        weight: 4,
        fillOpacity: 1.0
      });
      if (mapInstance) {
        mapInstance.panTo(marker.getLatLng(), { animate: true, duration: 0.6 });
      }
    } else {
      marker.setStyle({
        radius: 6,
        fillColor: COLOR_YELLOW,
        color: COLOR_BLACK,
        weight: 1.5,
        fillOpacity: 0.75
      });
    }
  });
}

// Toggle Benjamini-Hochberg FDR Multiple Testing Correction on Map
async function toggleFDR(applyFDR) {
  const variable = document.getElementById("variable-select").value || "T2M";
  if (!applyFDR) {
    highlightMapMarker(document.getElementById("district-select").value);
    return;
  }

  try {
    const res = await fetch(`/map/fdr?variable=${variable}`);
    const fdrList = await res.json();
    fdrList.forEach(item => {
      const marker = districtMarkers[item.district];
      if (marker) {
        if (item.significant_fdr) {
          marker.setStyle({
            fillColor: item.direction === "increasing" ? COLOR_YELLOW : COLOR_WHITE,
            color: COLOR_YELLOW_BRIGHT,
            weight: 2
          });
          marker.setTooltipContent(`<b>${item.district}</b><br>Slope: ${item.slope_per_year}/yr<br>FDR q: ${item.adjusted_p_value} (Significant)`);
        } else {
          marker.setStyle({
            fillColor: COLOR_CHARCOAL,
            color: "#333333",
            weight: 1
          });
          marker.setTooltipContent(`<b>${item.district}</b><br>Slope: ${item.slope_per_year}/yr<br>FDR q: ${item.adjusted_p_value} (Not Sig after FDR)`);
        }
      }
    });
  } catch (err) {
    console.error("FDR error:", err);
  }
}

// Load Window Sensitivity Robustness Check
async function loadSensitivity() {
  const district = document.getElementById("district-select").value || "Rajshahi";
  const variable = document.getElementById("variable-select").value || "T2M";

  try {
    const res = await fetch(`/sensitivity?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}`);
    const sensData = await res.json();
    const tbody = document.getElementById("sensitivity-tbody");
    tbody.innerHTML = "";

    sensData.windows.forEach(w => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #1f1f1f";
      const sigColor = w.significant ? COLOR_YELLOW : COLOR_GRAY;
      tr.innerHTML = `
        <td style="padding:6px 8px; font-weight:700;">${w.window_years}-Year</td>
        <td style="padding:6px 8px; color:var(--text-muted);">${w.period}</td>
        <td style="padding:6px 8px; font-weight:700; color:${w.slope_per_year > 0 ? COLOR_YELLOW : COLOR_WHITE};">${w.slope_per_year > 0 ? "+" : ""}${w.slope_per_year}</td>
        <td style="padding:6px 8px; color:var(--text-muted);">[${w.ci_low}, ${w.ci_high}]</td>
        <td style="padding:6px 8px;">p = ${w.p_value}</td>
        <td style="padding:6px 8px; color:${sigColor}; font-weight:600;">${w.significant ? "Yes (p < 0.05)" : "No"}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Sensitivity error:", err);
  }
}

// Render Time-Series & Theil-Sen Chart in White, Yellow, Black
function renderTrendChart() {
  if (!currentTrendData || !currentTrendData.series) return;

  const showCI = document.getElementById("toggle-ci").checked;
  const showDecomp = document.getElementById("toggle-decomp").checked;
  const ctx = document.getElementById("trendChart").getContext("2d");

  const dates = currentTrendData.series.map(pt => pt.date);
  const observed = currentTrendData.series.map(pt => pt.observed);
  const fitted = currentTrendData.series.map(pt => pt.fitted);
  const ciLower = currentTrendData.series.map(pt => pt.ci_lower);
  const ciUpper = currentTrendData.series.map(pt => pt.ci_upper);

  const datasets = [];

  if (showDecomp && currentTrendData.decomposition) {
    // Show seasonal decomposition components
    datasets.push({
      label: "Long-term Trend",
      data: currentTrendData.decomposition.trend,
      borderColor: COLOR_YELLOW,
      borderWidth: 2.5,
      pointRadius: 0,
      tension: 0.2
    });
    datasets.push({
      label: "Seasonal Component",
      data: currentTrendData.decomposition.seasonal,
      borderColor: COLOR_WHITE,
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3
    });
    datasets.push({
      label: "Residuals",
      data: currentTrendData.decomposition.residual,
      borderColor: COLOR_CHARCOAL,
      borderWidth: 1,
      pointRadius: 0,
      borderDash: [3, 3]
    });
  } else {
    // Observed values in soft white
    datasets.push({
      label: `Observed ${currentTrendData.variable}`,
      data: observed,
      borderColor: "rgba(255, 255, 255, 0.45)",
      backgroundColor: "rgba(255, 255, 255, 0.08)",
      pointBackgroundColor: "#ffffff",
      borderWidth: 1.2,
      pointRadius: 1.5,
      tension: 0.1
    });

    // Fitted Theil-Sen Line in Vibrant Yellow
    datasets.push({
      label: `Theil-Sen Fit (${currentTrendData.slope.slope_per_year} ${currentTrendData.slope.units})`,
      data: fitted,
      borderColor: COLOR_YELLOW,
      borderWidth: 3.5,
      pointRadius: 0
    });

    // 95% Confidence Band in Shaded Yellow
    if (showCI) {
      datasets.push({
        label: "95% CI Upper",
        data: ciUpper,
        borderColor: "transparent",
        backgroundColor: "rgba(250, 204, 21, 0.16)",
        fill: "+1",
        pointRadius: 0
      });
      datasets.push({
        label: "95% CI Lower",
        data: ciLower,
        borderColor: "transparent",
        backgroundColor: "transparent",
        pointRadius: 0
      });
    }
  }

  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  trendChartInstance = new Chart(ctx, {
    type: "line",
    data: { labels: dates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#ededed", font: { size: 11, weight: "600" } }
        },
        tooltip: {
          backgroundColor: "#0d0d0d",
          titleColor: COLOR_YELLOW,
          bodyColor: "#ffffff",
          borderColor: "#333333",
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          ticks: { color: COLOR_GRAY, maxTicksLimit: 12 },
          grid: { color: "#222222" }
        },
        y: {
          ticks: { color: COLOR_GRAY },
          grid: { color: "#222222" },
          title: {
            display: true,
            text: currentTrendData.slope.units,
            color: COLOR_YELLOW
          }
        }
      }
    }
  });
}

// Load and Render ML Forecasting Component (Section 6.3 & 10)
async function loadForecast() {
  const district = document.getElementById("district-select").value || "Rajshahi";
  const variable = document.getElementById("variable-select").value || "T2M";
  const horizon = document.getElementById("forecast-horizon-select").value || 36;

  try {
    const res = await fetch(`/forecast?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}&horizon_months=${horizon}`);
    const fcData = await res.json();

    // Update Validation Scorecard
    const val = fcData.validation_results;
    document.getElementById("fc-ml-rmse").textContent = val.ml_model_rmse;
    document.getElementById("fc-ml-mae").textContent = `MAE: ${val.ml_model_mae} ${fcData.units}`;
    document.getElementById("fc-base-rmse").textContent = val.baseline_rmse;
    document.getElementById("fc-skill-score").textContent = `${val.skill_score_vs_baseline_pct > 0 ? "+" : ""}${val.skill_score_vs_baseline_pct}%`;

    // Render Historical + Forecast Projection Chart
    const histDates = currentTrendData && currentTrendData.series ? currentTrendData.series.map(p => p.date) : [];
    const histObs = currentTrendData && currentTrendData.series ? currentTrendData.series.map(p => p.observed) : [];

    const fcDates = fcData.forecast_points.map(p => p.date);
    const fcPred = fcData.forecast_points.map(p => p.predicted);
    const fcLow = fcData.forecast_points.map(p => p.pi_low);
    const fcHigh = fcData.forecast_points.map(p => p.pi_high);

    const allDates = [...histDates, ...fcDates];
    const padHist = new Array(fcDates.length).fill(null);
    const padPred = new Array(histDates.length).fill(null);

    const fullHist = [...histObs, ...padHist];
    const fullPred = [...padPred, ...fcPred];
    const fullHigh = [...padPred, ...fcHigh];
    const fullLow = [...padPred, ...fcLow];

    // Connect the last historical point with first forecast point for seamless continuity
    if (histObs.length > 0 && fcPred.length > 0) {
      fullPred[histDates.length - 1] = histObs[histObs.length - 1];
      fullHigh[histDates.length - 1] = histObs[histObs.length - 1];
      fullLow[histDates.length - 1] = histObs[histObs.length - 1];
    }

    const ctx = document.getElementById("forecastChart").getContext("2d");
    if (forecastChartInstance) forecastChartInstance.destroy();

    forecastChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: allDates,
        datasets: [
          {
            label: "Historical Observations",
            data: fullHist,
            borderColor: "rgba(255, 255, 255, 0.4)",
            borderWidth: 1.2,
            pointRadius: 0
          },
          {
            label: `ML Forecast Projection (${horizon} Months)`,
            data: fullPred,
            borderColor: COLOR_YELLOW,
            borderWidth: 3,
            pointRadius: 0
          },
          {
            label: "95% Prediction Interval Upper",
            data: fullHigh,
            borderColor: "transparent",
            backgroundColor: "rgba(250, 204, 21, 0.18)",
            fill: "+1",
            pointRadius: 0
          },
          {
            label: "95% Prediction Interval Lower",
            data: fullLow,
            borderColor: "transparent",
            backgroundColor: "transparent",
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: COLOR_GRAY, maxTicksLimit: 14 }, grid: { color: "#222222" } },
          y: { ticks: { color: COLOR_GRAY }, grid: { color: "#222222" } }
        }
      }
    });

  } catch (err) {
    console.error("Forecast error:", err);
  }
}

// Mirror Finder: Opposite-Trend Detector across Bangladesh (Section 6.5 & 11)
async function runMirrorFinder() {
  const d1 = document.getElementById("compare-d1-select").value || "Rajshahi";
  const variable = document.getElementById("variable-select").value || "T2M";

  try {
    const res = await fetch(`/mirror-finder?district=${encodeURIComponent(d1)}&variable=${encodeURIComponent(variable)}`);
    const mirror = await res.json();

    // Automatically set district 2 to the mirror district
    document.getElementById("compare-d2-select").value = mirror.mirror_district;
    document.getElementById("compare-banner-summary").textContent = mirror.explanation;

    // Reload comparison view
    loadComparison();
  } catch (err) {
    console.error("Mirror finder error:", err);
  }
}

// Update Provenance Drawer Content
function updateProvenanceDrawer(data) {
  document.getElementById("prov-dataset-id").textContent = data.provenance.dataset_id;
  document.getElementById("prov-source-url").innerHTML = `<a href="${data.provenance.source_url}" target="_blank" style="color:var(--accent-yellow); text-decoration: underline;">${data.provenance.source_url}</a>`;
  document.getElementById("prov-retrieved").textContent = data.provenance.retrieved;
  document.getElementById("prov-mode").textContent = data.provenance.mode;
  document.getElementById("prov-district").textContent = `${data.district} (${data.period})`;
  document.getElementById("raw-json-display").textContent = JSON.stringify(data, null, 2);
}

// Load Bilingual Narration Agent
async function loadNarration(district, variable, start, end) {
  try {
    const url = `/narration?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}&start=${start}&end=${end}`;
    const res = await fetch(url);
    const narr = await res.json();

    const enElem = document.getElementById("narration-en");
    const bnElem = document.getElementById("narration-bn");
    const badge = document.getElementById("narration-badge");

    if (narr.verified) {
      enElem.textContent = narr.narration.english;
      bnElem.textContent = narr.narration.bangla;
      badge.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Strictly Verified (0 Hallucinations)`;
      badge.style.backgroundColor = "rgba(250, 204, 21, 0.12)";
      badge.style.color = COLOR_YELLOW;
      badge.style.borderColor = "rgba(250, 204, 21, 0.4)";
    } else {
      enElem.textContent = `[OUTPUT BLOCKED]: ${narr.block_reason}`;
      bnElem.textContent = `[ব্লক করা হয়েছে]: টুল রেজাল্টে অপ্রমাণিত সংখ্যা সনাক্ত হয়েছে।`;
      badge.textContent = "BLOCKED: Hallucination Detected";
      badge.style.backgroundColor = "#000000";
      badge.style.color = COLOR_WHITE;
      badge.style.borderColor = COLOR_WHITE;
    }
  } catch (err) {
    console.error("Narration error:", err);
  }
}

// Load Two-District Comparison in Yellow vs White
async function loadComparison() {
  const d1 = document.getElementById("compare-d1-select").value || "Rajshahi";
  const d2 = document.getElementById("compare-d2-select").value || "Dhaka";
  const variable = document.getElementById("variable-select").value || "T2M";

  try {
    const res = await fetch(`/compare?district1=${encodeURIComponent(d1)}&district2=${encodeURIComponent(d2)}&variable=${encodeURIComponent(variable)}`);
    const comp = await res.json();

    document.getElementById("compare-banner-title").textContent = `${comp.district1.district} vs. ${comp.district2.district}`;
    if (!document.getElementById("compare-banner-summary").textContent.includes("highest divergence")) {
      document.getElementById("compare-banner-summary").textContent = comp.comparison_summary;
    }

    document.getElementById("comp-d1-slope").textContent = `${comp.district1.slope.slope_per_year} ${comp.district1.slope.units}`;
    document.getElementById("comp-d1-sub").textContent = `Mann-Kendall Z = ${comp.district1.trend.Z} (p = ${comp.district1.trend.p_value})`;

    document.getElementById("comp-d2-slope").textContent = `${comp.district2.slope.slope_per_year} ${comp.district2.slope.units}`;
    document.getElementById("comp-d2-sub").textContent = `Mann-Kendall Z = ${comp.district2.trend.Z} (p = ${comp.district2.trend.p_value})`;

    // Comparison Chart in Yellow vs White
    const dates = comp.district1.series.map(p => p.date);
    const d1Obs = comp.district1.series.map(p => p.observed);
    const d2Obs = comp.district2.series.map(p => p.observed);

    const ctx = document.getElementById("compareChart").getContext("2d");
    if (compareChartInstance) compareChartInstance.destroy();

    compareChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          {
            label: `${comp.district1.district} (Slope: ${comp.district1.slope.slope_per_year})`,
            data: d1Obs,
            borderColor: COLOR_YELLOW,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: `${comp.district2.district} (Slope: ${comp.district2.slope.slope_per_year})`,
            data: d2Obs,
            borderColor: COLOR_WHITE,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#ededed" } }
        },
        scales: {
          x: { ticks: { color: COLOR_GRAY, maxTicksLimit: 12 }, grid: { color: "#222222" } },
          y: { ticks: { color: COLOR_GRAY }, grid: { color: "#222222" } }
        }
      }
    });

  } catch (err) {
    console.error("Comparison load error:", err);
  }
}

// Load and Render Gridded Zarr Heatmap
async function loadGridded(timeIdx = 0) {
  const variable = document.getElementById("gridded-var-select").value || "ndvi";
  try {
    const res = await fetch(`/gridded?variable=${variable}&time_index=${timeIdx}`);
    const gridData = await res.json();

    document.getElementById("grid-date-label").textContent = `Observation Month: ${gridData.date}`;
    document.getElementById("zarr-min-val").textContent = gridData.min_value;
    document.getElementById("zarr-max-val").textContent = gridData.max_value;
    document.getElementById("zarr-legend-title").textContent = `${gridData.long_name} (${gridData.units})`;

    // Render on Canvas
    const canvas = document.getElementById("zarrCanvas");
    const ctx = canvas.getContext("2d");
    const matrix = gridData.grid; // [lat][lon]
    const rows = matrix.length;
    const cols = matrix[0].length;

    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = matrix[rows - 1 - r][c]; // Flip vertically for lat
        if (val === null || isNaN(val)) {
          ctx.fillStyle = COLOR_BLACK; // Background
        } else {
          // Normalize 0 to 1
          const norm = Math.max(0, Math.min(1, (val - gridData.min_value) / (gridData.max_value - gridData.min_value || 1)));
          ctx.fillStyle = getHeatmapColor(variable, norm);
        }
        ctx.fillRect(c * cellW, r * cellH, cellW - 1, cellH - 1);
      }
    }
  } catch (err) {
    console.error("Gridded Zarr error:", err);
  }
}

// Perceptual Heatmap Color Gradient: Black -> Yellow -> White
function getHeatmapColor(variable, norm) {
  if (norm < 0.6) {
    // 0.0 to 0.6: Black (0,0,0) to Vibrant Yellow (250, 204, 21)
    const t = norm / 0.6;
    const r = Math.round(250 * t);
    const g = Math.round(204 * t);
    const b = Math.round(21 * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // 0.6 to 1.0: Vibrant Yellow (250, 204, 21) to Pure White (255, 255, 255)
    const t = (norm - 0.6) / 0.4;
    const r = Math.round(250 + 5 * t);
    const g = Math.round(204 + 51 * t);
    const b = Math.round(21 + 234 * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
}
