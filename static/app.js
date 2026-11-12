/**
 * Earth System Trend Detective - Frontend Application Logic
 * Offline-first, pure JavaScript interface with Leaflet, Chart.js, and Zarr Canvas.
 * Styled in White, Yellow, and Black aesthetic with full Dark/Light Theme support,
 * Language Switcher (English / বাংলা), and Standard Feature Summary Banners.
 */

let mapInstance = null;
let cartoTileLayer = null;
let districtMarkers = {};
let trendChartInstance = null;
let compareChartInstance = null;
let forecastChartInstance = null;
let currentTrendData = null;
let currentDistricts = [];
let currentActiveMarker = null;

// User Preferences (Theme & Language)
let currentTheme = localStorage.getItem("app-theme") || "dark";
let currentLang = localStorage.getItem("app-lang") || "en";

// Request abort controllers to cancel in-flight requests on rapid interaction
let trendAbortCtrl = null;
let narrationAbortCtrl = null;
let griddedAbortCtrl = null;
let forecastAbortCtrl = null;
let sliderThrottleTimer = null;

// High-speed client-side caches for instant zero-lag response
const trendCache = new Map();
const narrationCache = new Map();
const forecastCache = new Map();
const sensitivityCache = new Map();
const compareCache = new Map();
const griddedCache = new Map();
let fdrCache = new Map();

// CARTO API Key provided by user
const CARTO_API_KEY = "cb1_4do5_1_fe36f1854b4cfdde4ab86fd2";

// White, Yellow, Black Palette Constants
const COLOR_YELLOW = "#facc15";
const COLOR_YELLOW_BRIGHT = "#fef08a";
const COLOR_WHITE = "#ffffff";
const COLOR_GRAY = "#a3a3a3";
const COLOR_CHARCOAL = "#525252";
const COLOR_BLACK = "#000000";

// Comprehensive Bilingual Dictionaries (English / বাংলা)
const TRANSLATIONS = {
  en: {
    appTitle: "Earth System Trend Detective",
    appSubtitle: "Offline-First Bangladesh Climate & Remote Sensing Trend Investigation",
    cartoActive: "CARTO Basemap Active",
    offlineMode: "OFFLINE=1 (Cache Only)",
    provenanceDrawer: "Provenance Drawer",
    themeLight: "Light Mode",
    themeDark: "Dark Mode",
    langSwitch: "বাংলা",
    tabSingle: "District Explorer",
    tabForecast: "ML Forecasting",
    tabCompare: "Comparison & Mirror Finder",
    tabGridded: "Gridded Zarr Explorer",
    tabMethods: "Methods & Provenance",
    controlsTitle: "Investigation Controls",
    labelDistrict: "District (64 Total):",
    labelVariable: "Environmental Variable:",
    varT2M: "Temperature at 2m (T2M) [°C]",
    varPrecip: "Precipitation (PRECTOTCORR) [mm/day]",
    varSolar: "Solar Radiation (SW Downward) [MJ/m²]",
    labelPeriod: "Time Period (2001 - 2025):",
    labelStartDate: "Start Date",
    labelEndDate: "End Date",
    btnAnalyze: "Run Trend Analysis",
    exportTitle: "Export Evidence",
    exportDesc: "Download filtered dataset with full scientific provenance and Theil-Sen fit values.",
    btnExportCsv: "Export CSV",
    btnExportGeojson: "Export GeoJSON",
    chartOptionsTitle: "Chart Display Options",
    toggleCi: "Show 95% Confidence Band",
    toggleDecomp: "Show Seasonal Decomposition",
    toggleFdr: "Apply Benjamini-Hochberg FDR",
    statSlope: "Theil-Sen Slope",
    statCi: "95% Confidence Interval",
    statCiSub: "Rank-based exact bounds",
    statMk: "Mann-Kendall Test",
    statObs: "Observations & QA/QC",
    statNetChange: "Total Period Net Change:",
    btnSensitivity: "Window Sensitivity ↓",
    sensTitle: "Time Window Sensitivity Analysis (Robustness Check)",
    sensDesc: "Testing trend consistency across 10-year, 15-year, 20-year, and 25-year windows up to 2025 to verify whether change is persistent or cyclic.",
    sensThWindow: "Window",
    sensThSpan: "Span",
    sensThSlope: "Theil-Sen Slope",
    sensThCi: "95% CI",
    sensThPval: "p-value",
    sensThSig: "Significant?",
    spatialInspector: "Bangladesh Spatial Inspector",
    legendIncreasing: "Increasing",
    legendDecreasing: "Decreasing",
    legendNoTrend: "No Trend",
    mapHint: "Click any district circle to instantly inspect its time series, trend statistics, and provenance.",
    chartTitle: "Time-Series & Fitted Theil-Sen Trend Line",
    narrationTitle: "Deterministic Narration Agent (Plain Language Insights)",
    narrationVerified: "Strictly Verified (0 Hallucinations)",
    narrationEnHeading: "English Explanation (2 Sentences)",
    narrationBnHeading: "Bangla Explanation (২টি বাক্য)",
    // Feature banners (2-3 sentences each)
    bannerSingleBadge: "Spatial & Temporal Analysis",
    bannerSingleTitle: "District Trend Explorer (64 Districts)",
    bannerSingleDesc: "Interactive spatial and temporal trend detector for all 64 districts in Bangladesh across 2001–2025. Combines non-parametric Mann-Kendall monotonic testing with Theil-Sen robust slope estimation and additive seasonal decomposition. Click any district on the map or use the sidebar controls to inspect climate trends with full scientific data provenance.",
    bannerForecastBadge: "Machine Learning Projection",
    bannerForecastTitle: "ML Forecasting Component (Section 6.3)",
    bannerForecastDesc: "Predictive forward-projection engine using Ridge regression with harmonic seasonality and autoregressive lag modeling. Validated against naive seasonal persistence benchmarks using a rigorous time-ordered 80/20 train/test split. Provides empirical 95% prediction intervals to visualize multi-year trajectory envelopes without claiming causal certainty.",
    bannerCompareBadge: "Comparative Climatology",
    bannerCompareTitle: "Two-District Comparison & Mirror Finder",
    bannerCompareDesc: "Dual-district comparative analysis tool designed to contrast historical trajectories across contrasting micro-climates. The integrated Mirror Finder scans all 64 districts to discover the region exhibiting the highest divergence or opposite trend. Enables rapid identification of regional climate shifts, from dry western bars to coastal monsoon zones.",
    bannerGriddedBadge: "Earth Observation Canvas",
    bannerGriddedTitle: "Gridded Zarr Explorer (MODIS / IMERG / GRACE)",
    bannerGriddedDesc: "High-resolution 2D spatial canvas rendering gridded Earth observation data from pre-cached Zarr multidimensional stores. Explores 25 years of monthly MODIS NDVI vegetation greenness, GPM IMERG precipitation, and GRACE terrestrial water storage anomalies. Use the time slider to track seasonal monsoon flooding, vegetative vigor, and groundwater depletion across Bangladesh.",
    bannerMethodsBadge: "Scientific Provenance",
    bannerMethodsTitle: "Methodology & Scientific Integrity",
    bannerMethodsDesc: "Complete scientific transparency and provenance documentation for all datasets and computational algorithms. Implements exact rank-based non-parametric statistics without reliance on language model calculations or stochastic heuristics. Every displayed metric traces back directly to authoritative NASA satellite missions and peer-reviewed methodologies.",
    // Comparison tab
    compareBannerTitle: "Comparing District Trends",
    compareBannerSummary: "Select two districts below or use the Mirror Finder to discover opposite trends across Bangladesh.",
    btnMirrorFinder: "Run Mirror Finder",
    compareD1Title: "District 1",
    compareD2Title: "District 2",
    compareChartTitle: "Dual District Comparison Chart",
    // Forecast tab
    horizonLabel: "Horizon:",
    btnRunForecast: "Generate",
    fcModelArch: "Model Architecture",
    fcModelArchVal: "Ridge AR + Harmonic",
    fcModelArchSub: "Time-ordered 80/20 split",
    fcMlRmse: "ML Validation RMSE",
    fcBaseRmse: "Baseline (Seasonal) RMSE",
    fcBaseRmseSub: "Naive persistence benchmark",
    fcSkillScore: "Skill Score vs. Baseline",
    fcSkillScoreSub: "RMSE error reduction",
    fcDisclaimer: "Machine learning forecasts estimate possible future trajectory ranges from historical patterns under stationarity assumptions. Predictions are shown alongside empirical 95% prediction intervals and validation metrics, and must never be interpreted as certainty, causal attribution, or emergency risk warnings.",
    // Gridded tab
    griddedVarLabel: "Variable:",
    griddedStepsLabel: "300 Monthly Steps",
    // Provenance drawer
    drawerTitle: "Scientific Provenance & Raw JSON",
    provThDataset: "Dataset ID:",
    provThSource: "Source URL:",
    provThRetrieved: "Retrieval Timestamp:",
    provThMode: "Data Mode:",
    provThRegion: "Selected Region:",
    provJsonTitle: "Exact Tool Result JSON",
    btnCopyJson: "Copy JSON",
    btnCopied: "Copied!",
  },
  bn: {
    appTitle: "আর্থ সিস্টেম ট্রেন্ড ডিটেকটিভ",
    appSubtitle: "বাংলাদেশের অফলাইন-ফার্স্ট জলবায়ু ও রিমোট সেন্সিং প্রবণতা অনুসন্ধান প্ল্যাটফর্ম",
    cartoActive: "কার্টো ম্যাপ সক্রিয়",
    offlineMode: "অফলাইন=১ (শুধুমাত্র ক্যাশ)",
    provenanceDrawer: "প্রমাণপত্র ড্রয়ার",
    themeLight: "লাইট মোড",
    themeDark: "ডার্ক মোড",
    langSwitch: "English",
    tabSingle: "জেলা অনুসন্ধানকারী",
    tabForecast: "এমএল পূর্বাভাস",
    tabCompare: "তুলনা ও মিরর ফাইন্ডার",
    tabGridded: "গ্রিডেড জার এক্সপ্লোরার",
    tabMethods: "পদ্ধতি ও প্রমাণপত্র",
    controlsTitle: "অনুসন্ধান নিয়ন্ত্রণ",
    labelDistrict: "জেলা (মোট ৬৪টি):",
    labelVariable: "পরিবেশগত চলক:",
    varT2M: "২ মিটার উচ্চতায় তাপমাত্রা (T2M) [°C]",
    varPrecip: "বৃষ্টিপাত (PRECTOTCORR) [মিমি/দিন]",
    varSolar: "সৌর বিকিরণ (SW Downward) [MJ/m²]",
    labelPeriod: "সময়সীমা (২০০১ - ২০২৫):",
    labelStartDate: "শুরুর তারিখ",
    labelEndDate: "শেষের তারিখ",
    btnAnalyze: "ট্রেন্ড বিশ্লেষণ শুরু করুন",
    exportTitle: "উপাত্ত এক্সপোর্ট করুন",
    exportDesc: "সম্পূর্ণ বৈজ্ঞানিক প্রমাণপত্র ও থেইল-সেন ফিটসহ ফিল্টার করা উপাত্ত ডাউনলোড করুন।",
    btnExportCsv: "CSV এক্সপোর্ট",
    btnExportGeojson: "GeoJSON এক্সপোর্ট",
    chartOptionsTitle: "চার্ট প্রদর্শনের অপশন",
    toggleCi: "৯৫% কনফিডেন্স ব্যান্ড দেখান",
    toggleDecomp: "সিজনাল ডিকম্পোজিশন দেখান",
    toggleFdr: "বেনজামিনি-হচবার্গ এফডিআর প্রয়োগ",
    statSlope: "থেইল-সেন স্লোপ",
    statCi: "৯৫% কনফিডেন্স ইন্টারভ্যাল",
    statCiSub: "র‍্যাংক-ভিত্তিক নির্ভুল সীমা",
    statMk: "মান-কেন্ডাল পরীক্ষা",
    statObs: "পর্যবেক্ষণ ও মান যাচাই",
    statNetChange: "মোট মেয়াদের নিট পরিবর্তন:",
    btnSensitivity: "উইন্ডো সংবেদনশীলতা ↓",
    sensTitle: "সময় উইন্ডো সংবেদনশীলতা বিশ্লেষণ (রোবাস্টনেস চেক)",
    sensDesc: "পরিবর্তনটি দীর্ঘস্থায়ী নাকি সাময়িক চক্রাকার তা যাচাই করতে ২০২৫ সাল পর্যন্ত ১০, ১৫, ২০ এবং ২৫ বছরের উইন্ডোতে ট্রেন্ডের স্থায়িত্ব পরীক্ষা।",
    sensThWindow: "উইন্ডো",
    sensThSpan: "সময়কাল",
    sensThSlope: "থেইল-সেন স্লোপ",
    sensThCi: "৯৫% কনফিডেন্স সীমা",
    sensThPval: "পি-ভ্যালু (p-value)",
    sensThSig: "তাৎপর্যপূর্ণ?",
    spatialInspector: "বাংলাদেশ স্থানিক পর্যবেক্ষক",
    legendIncreasing: "বৃদ্ধি পাচ্ছে",
    legendDecreasing: "হ্রাস পাচ্ছে",
    legendNoTrend: "পরিবর্তনহীন",
    mapHint: "যেকোনো জেলা সার্কেলে ক্লিক করে তাত্ক্ষণিক সময়ক্রম, ট্রেন্ড পরিসংখ্যান এবং প্রমাণপত্র দেখুন।",
    chartTitle: "সময়ক্রম ও সমন্বিত থেইল-সেন ট্রেন্ড লাইন",
    narrationTitle: "নির্ধারিত বর্ণনা এজেন্ট (সহজ ভাষার অন্তর্দৃষ্টি)",
    narrationVerified: "কঠোরভাবে যাচাইকৃত (০ ভুল বা বিভ্রান্তি)",
    narrationEnHeading: "ইংরেজি বিবরণ (২টি বাক্য)",
    narrationBnHeading: "বাংলা বিবরণ (২টি বাক্য)",
    // Feature banners (2-3 sentences each)
    bannerSingleBadge: "স্থানিক ও সময়ক্রম বিশ্লেষণ",
    bannerSingleTitle: "জেলা ট্রেন্ড অনুসন্ধানকারী (৬৪টি জেলা)",
    bannerSingleDesc: "২০০১ থেকে ২০২৫ সাল পর্যন্ত বাংলাদেশের ৬৪টি জেলার ইন্টারঅ্যাক্টিভ জলবায়ু ও স্থানিক পরিবর্তন পর্যবেক্ষণ ব্যবস্থা। এটি নন-প্যারামেট্রিক মান-কেন্ডাল পরীক্ষা, থেইল-সেন রোবাস্ট স্লোপ এবং সিজনাল ডিকম্পোজিশন প্রক্রিয়ার মাধ্যমে হিসাব করা হয়। সম্পূর্ণ বৈজ্ঞানিক প্রমাণপত্রসহ ফলাফল দেখতে মানচিত্রে যেকোনো জেলায় ক্লিক করুন।",
    bannerForecastBadge: "মেশিন লার্নিং প্রক্ষেপণ",
    bannerForecastTitle: "এমএল পূর্বাভাস উপাদান (অধ্যায় ৬.৩)",
    bannerForecastDesc: "হারমোনিক ঋতুভিত্তিক এবং অটোরিগ্রেসিভ ল্যাগ মডেল সম্বলিত রিজ রিগ্রেশনভিত্তিক পূর্বাভাস ইঞ্জিন। ৮০/২০ সময়ানুক্রমিক বিভাজন প্রক্রিয়ায় সাধারণ বেঞ্চমার্কের বিপরীতে মডেলের নির্ভুলতা কঠোরভাবে যাচাই করা হয়েছে। এটি ৯৫% প্রেডিকশন ইন্টারভ্যালসহ ভবিষ্যৎ সম্ভাবনার পরিধি প্রদর্শন করে।",
    bannerCompareBadge: "তুলনামূলক জলবায়ুবিদ্যা",
    bannerCompareTitle: "দুই জেলার তুলনা ও মিরর ফাইন্ডার",
    bannerCompareDesc: "ভিন্ন জলবায়ুর দুটি জেলার ঐতিহাসিক প্রবণতা পাশাপাশি তুলনা করার বিশ্লেষণমূলক টুল। এতে যুক্ত মিরর ফাইন্ডার ৬৪টি জেলা স্ক্যান করে সর্বাধিক বিপরীত বা ভিন্নধর্মী পরিবর্তনের জেলা খুঁজে বের করে। এর মাধ্যমে পশ্চিমাঞ্চলীয় খরাপ্রবণ বরেন্দ্র অঞ্চল থেকে শুরু করে উপকূলীয় অঞ্চলের বৈচিত্র্য সহজে শনাক্ত করা যায়।",
    bannerGriddedBadge: "আর্থ অবজারভেশন ক্যানভাস",
    bannerGriddedTitle: "গ্রিডেড জার এক্সপ্লোরার (MODIS / IMERG / GRACE)",
    bannerGriddedDesc: "প্রাক-সংরক্ষিত জার (Zarr) স্টোর থেকে উচ্চ-রেজোলিউশনের দ্বিমাত্রিক স্প্যাশিয়াল ক্যানভাসে স্যাটেলাইট তথ্য প্রদর্শক। গত ২৫ বছরের মোডিস এনডিভিআই সবুজায়ন, আইমার্জ বৃষ্টিপাত এবং গ্রেস ভূগর্ভস্থ পানির সঞ্চয় পর্যবেক্ষণ করুন। সময় স্লাইডার ব্যবহার করে বর্ষার প্লাবন, ফসলি সবুজায়ন এবং ভূগর্ভস্থ পানির স্তর পরিবর্তন দেখুন।",
    bannerMethodsBadge: "বৈজ্ঞানিক প্রমাণপত্র",
    bannerMethodsTitle: "কার্যপদ্ধতি ও বৈজ্ঞানিক বিশ্বস্ততা",
    bannerMethodsDesc: "সকল ডেটাসেট এবং গাণিতিক অ্যালগরিদমের সম্পূর্ণ বৈজ্ঞানিক স্বচ্ছতা ও প্রামাণ্য দলিল। কোনো ভাষা মডেলের অনুমান ছাড়াই সরাসরি নন-প্যারামেট্রিক পরিসংখ্যানগত পদ্ধতির মাধ্যমে প্রতিটি ফলাফল নির্ণীত। প্রদর্শিত প্রতিটি সংখ্যা সরাসরি নাসার সুনির্দিষ্ট স্যাটেলাইট মিশন ও স্বীকৃত বৈজ্ঞানিক পদ্ধতির সাথে যুক্ত।",
    // Comparison tab
    compareBannerTitle: "জেলা সমূহের ট্রেন্ড তুলনা",
    compareBannerSummary: "নিচে দুটি জেলা নির্বাচন করুন অথবা বাংলাদেশের বিপরীতমুখী প্রবণতা খুঁজে পেতে মিরর ফাইন্ডার চালান।",
    btnMirrorFinder: "মিরর ফাইন্ডার চালান",
    compareD1Title: "জেলা ১",
    compareD2Title: "জেলা ২",
    compareChartTitle: "উভয় জেলার তুলনামূলক চার্ট",
    // Forecast tab
    horizonLabel: "মেয়াদ:",
    btnRunForecast: "পূর্বাভাস দেখুন",
    fcModelArch: "মডেল আর্কিটেকচার",
    fcModelArchVal: "রিজ এআর + হারমোনিক",
    fcModelArchSub: "সময়ানুক্রমিক ৮০/২০ বিভাজন",
    fcMlRmse: "এমএল ভ্যালিডেশন RMSE",
    fcBaseRmse: "বেঞ্চমার্ক (ঋতুভিত্তিক) RMSE",
    fcBaseRmseSub: "নাইভ পারসিসটেন্স বেঞ্চমার্ক",
    fcSkillScore: "বেঞ্চমার্কের তুলনায় স্কিল স্কোর",
    fcSkillScoreSub: "RMSE ত্রুটি হ্রাস",
    fcDisclaimer: "মেশিন লার্নিং পূর্বাভাস পূর্বের ঐতিহাসিক প্যাটার্নের ওপর ভিত্তি করে সম্ভাব্য গতিপথের পূর্বাভাস দেয়। এটি ৯৫% প্রেডিকশন ইন্টারভ্যাল ও যাচাইকরণ মেট্রিক্সসহ প্রদর্শিত হয় এবং এটিকে কখনোই পরম নিশ্চয়তা বা জরুরি সতর্কবার্তা হিসেবে বিবেচনা করা যাবে না।",
    // Gridded tab
    griddedVarLabel: "চলক:",
    griddedStepsLabel: "৩০০ মাসের ধাপ",
    // Provenance drawer
    drawerTitle: "বৈজ্ঞানিক প্রমাণপত্র ও মূল JSON",
    provThDataset: "ডেটাসেট আইডি:",
    provThSource: "উৎস লিঙ্ক (URL):",
    provThRetrieved: "সংগ্রহের সময়কাল:",
    provThMode: "ডাটা মোড:",
    provThRegion: "নির্বাচিত অঞ্চল:",
    provJsonTitle: "টুল ফলাফলের মূল JSON",
    btnCopyJson: "JSON কপি করুন",
    btnCopied: "কপি সম্পন্ন!",
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initLanguage();
  initTabs();
  initDrawer();
  initMap();
  await loadDistricts();
  await loadTrend();
  initEventListeners();
});

// Theme Management
function initTheme() {
  const isLight = currentTheme === "light";
  document.body.classList.toggle("light-theme", isLight);
  updateThemeButtonUI();
}

function updateThemeButtonUI() {
  const themeIcon = document.getElementById("theme-icon");
  const themeText = document.getElementById("theme-text");
  if (!themeIcon || !themeText) return;
  const isLight = currentTheme === "light";
  themeIcon.textContent = isLight ? "🌙" : "☀️";
  themeText.textContent = isLight ? TRANSLATIONS[currentLang].themeDark : TRANSLATIONS[currentLang].themeLight;
}

function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("app-theme", currentTheme);
  const isLight = currentTheme === "light";
  document.body.classList.toggle("light-theme", isLight);
  updateThemeButtonUI();

  // Switch CARTO tile layer between dark_all and light_all
  if (cartoTileLayer && mapInstance) {
    const style = isLight ? "light_all" : "dark_all";
    cartoTileLayer.setUrl(`https://{s}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`);
  }

  // Refresh active charts with proper contrast
  renderTrendChart();
  if (compareChartInstance) loadComparison();
  if (forecastChartInstance) loadForecast();
}

// Language Management
function initLanguage() {
  setLanguage(currentLang);
}

function toggleLanguage() {
  const nextLang = currentLang === "en" ? "bn" : "en";
  setLanguage(nextLang);
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("app-lang", lang);
  const t = TRANSLATIONS[lang];

  // Top header
  document.getElementById("txt-app-title").textContent = t.appTitle;
  document.getElementById("txt-app-subtitle").textContent = t.appSubtitle;
  document.getElementById("txt-carto-badge").textContent = t.cartoActive;
  document.getElementById("txt-offline-badge").textContent = t.offlineMode;
  document.getElementById("txt-drawer-btn").textContent = t.provenanceDrawer;

  // Language & Theme buttons
  document.getElementById("lang-text").textContent = t.langSwitch;
  updateThemeButtonUI();

  // Nav tabs
  document.getElementById("tab-btn-single").textContent = t.tabSingle;
  document.getElementById("tab-btn-forecast").textContent = t.tabForecast;
  document.getElementById("tab-btn-compare").textContent = t.tabCompare;
  document.getElementById("tab-btn-gridded").textContent = t.tabGridded;
  document.getElementById("tab-btn-methods").textContent = t.tabMethods;

  // Sidebar
  document.getElementById("txt-controls-title").textContent = t.controlsTitle;
  document.getElementById("txt-label-district").textContent = t.labelDistrict;
  document.getElementById("txt-label-variable").textContent = t.labelVariable;
  document.getElementById("opt-var-t2m").textContent = t.varT2M;
  document.getElementById("opt-var-precip").textContent = t.varPrecip;
  document.getElementById("opt-var-solar").textContent = t.varSolar;
  document.getElementById("txt-label-period").textContent = t.labelPeriod;
  document.getElementById("txt-label-start").textContent = t.labelStartDate;
  document.getElementById("txt-label-end").textContent = t.labelEndDate;
  document.getElementById("txt-btn-analyze").textContent = t.btnAnalyze;
  document.getElementById("txt-export-title").textContent = t.exportTitle;
  document.getElementById("txt-export-desc").textContent = t.exportDesc;
  document.getElementById("export-csv-btn").textContent = t.btnExportCsv;
  document.getElementById("export-geojson-btn").textContent = t.btnExportGeojson;
  document.getElementById("txt-chart-options-title").textContent = t.chartOptionsTitle;
  document.getElementById("txt-toggle-ci").textContent = t.toggleCi;
  document.getElementById("txt-toggle-decomp").textContent = t.toggleDecomp;
  document.getElementById("txt-toggle-fdr").textContent = t.toggleFdr;

  // Feature banners
  document.getElementById("banner-single-badge").textContent = t.bannerSingleBadge;
  document.getElementById("banner-single-title").textContent = t.bannerSingleTitle;
  document.getElementById("banner-single-desc").textContent = t.bannerSingleDesc;

  document.getElementById("banner-forecast-badge").textContent = t.bannerForecastBadge;
  document.getElementById("banner-forecast-title").textContent = t.bannerForecastTitle;
  document.getElementById("banner-forecast-desc").textContent = t.bannerForecastDesc;

  document.getElementById("banner-compare-badge").textContent = t.bannerCompareBadge;
  document.getElementById("banner-compare-title").textContent = t.bannerCompareTitle;
  document.getElementById("banner-compare-desc").textContent = t.bannerCompareDesc;

  document.getElementById("banner-gridded-badge").textContent = t.bannerGriddedBadge;
  document.getElementById("banner-gridded-title").textContent = t.bannerGriddedTitle;
  document.getElementById("banner-gridded-desc").textContent = t.bannerGriddedDesc;

  document.getElementById("banner-methods-badge").textContent = t.bannerMethodsBadge;
  document.getElementById("banner-methods-title").textContent = t.bannerMethodsTitle;
  document.getElementById("banner-methods-desc").textContent = t.bannerMethodsDesc;

  // Stat cards
  document.getElementById("txt-stat-slope-label").textContent = t.statSlope;
  document.getElementById("txt-stat-ci-label").textContent = t.statCi;
  document.getElementById("txt-stat-ci-sub").textContent = t.statCiSub;
  document.getElementById("txt-stat-mk-label").textContent = t.statMk;
  document.getElementById("txt-stat-obs-label").textContent = t.statObs;
  document.getElementById("txt-net-change-label").textContent = t.statNetChange;
  document.getElementById("txt-btn-sensitivity").textContent = t.btnSensitivity;

  // Sensitivity panel
  document.getElementById("txt-sens-title").textContent = t.sensTitle;
  document.getElementById("txt-sens-desc").textContent = t.sensDesc;
  document.getElementById("th-sens-window").textContent = t.sensThWindow;
  document.getElementById("th-sens-span").textContent = t.sensThSpan;
  document.getElementById("th-sens-slope").textContent = t.sensThSlope;
  document.getElementById("th-sens-ci").textContent = t.sensThCi;
  document.getElementById("th-sens-pval").textContent = t.sensThPval;
  document.getElementById("th-sens-sig").textContent = t.sensThSig;

  // Map & Chart
  document.getElementById("txt-spatial-inspector").textContent = t.spatialInspector;
  document.getElementById("txt-legend-inc").textContent = t.legendIncreasing;
  document.getElementById("txt-legend-dec").textContent = t.legendDecreasing;
  document.getElementById("txt-legend-none").textContent = t.legendNoTrend;
  document.getElementById("txt-map-hint").textContent = t.mapHint;
  document.getElementById("txt-chart-title").textContent = t.chartTitle;

  // Narration card
  document.getElementById("txt-narration-title").textContent = t.narrationTitle;
  document.getElementById("txt-narration-verified").textContent = t.narrationVerified;
  document.getElementById("txt-narr-en-heading").textContent = t.narrationEnHeading;
  document.getElementById("txt-narr-bn-heading").textContent = t.narrationBnHeading;

  // Comparison Tab
  document.getElementById("compare-banner-title").textContent = t.compareBannerTitle;
  document.getElementById("compare-banner-summary").textContent = t.compareBannerSummary;
  document.getElementById("txt-btn-mirror").textContent = t.btnMirrorFinder;
  document.getElementById("txt-compare-d1-title").textContent = t.compareD1Title;
  document.getElementById("txt-compare-d2-title").textContent = t.compareD2Title;
  document.getElementById("txt-compare-chart-title").textContent = t.compareChartTitle;

  // Forecast Tab
  document.getElementById("txt-label-horizon").textContent = t.horizonLabel;
  document.getElementById("txt-btn-run-forecast").textContent = t.btnRunForecast;
  document.getElementById("txt-fc-arch-label").textContent = t.fcModelArch;
  document.getElementById("txt-fc-arch-val").textContent = t.fcModelArchVal;
  document.getElementById("txt-fc-arch-sub").textContent = t.fcModelArchSub;
  document.getElementById("txt-fc-rmse-label").textContent = t.fcMlRmse;
  document.getElementById("txt-fc-base-label").textContent = t.fcBaseRmse;
  document.getElementById("txt-fc-base-sub").textContent = t.fcBaseRmseSub;
  document.getElementById("txt-fc-skill-label").textContent = t.fcSkillScore;
  document.getElementById("txt-fc-skill-sub").textContent = t.fcSkillScoreSub;
  document.getElementById("txt-fc-disclaimer").innerHTML = `<strong>${lang === 'bn' ? 'বাধ্যতামূলক বৈজ্ঞানিক সতর্কতা (অধ্যায় ৬.৩ ও ১০):' : 'Mandatory Scientific Caveat (Section 6.3 & 10):'}</strong> ${t.fcDisclaimer}`;

  // Gridded Tab
  document.getElementById("txt-label-grid-var").textContent = t.griddedVarLabel;
  document.getElementById("grid-bounds-label").textContent = t.griddedStepsLabel;

  // Provenance Drawer
  document.getElementById("txt-drawer-title").textContent = t.drawerTitle;
  document.getElementById("th-prov-dataset").textContent = t.provThDataset;
  document.getElementById("th-prov-source").textContent = t.provThSource;
  document.getElementById("th-prov-retrieved").textContent = t.provThRetrieved;
  document.getElementById("th-prov-mode").textContent = t.provThMode;
  document.getElementById("th-prov-region").textContent = t.provThRegion;
  document.getElementById("txt-raw-json-title").textContent = t.provJsonTitle;
  document.getElementById("copy-json-btn").textContent = t.btnCopyJson;
}

// Dynamic Chart Theming Colors
function getThemeChartColors() {
  const isLight = currentTheme === "light";
  return {
    textColor: isLight ? "#1e293b" : "#ededed",
    gridColor: isLight ? "#e2e8f0" : "#222222",
    tickColor: isLight ? "#64748b" : "#a3a3a3",
    tooltipBg: isLight ? "#ffffff" : "#0d0d0d",
    tooltipTitle: isLight ? "#d97706" : "#facc15",
    tooltipBody: isLight ? "#0f172a" : "#ffffff",
    tooltipBorder: isLight ? "#cbd5e1" : "#333333",
    obsBorder: isLight ? "rgba(15, 23, 42, 0.45)" : "rgba(255, 255, 255, 0.45)",
    obsBg: isLight ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
    yellowLine: isLight ? "#d97706" : "#facc15",
    yellowBand: isLight ? "rgba(217, 119, 6, 0.18)" : "rgba(250, 204, 21, 0.16)",
  };
}

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
        setTimeout(() => mapInstance.invalidateSize(), 150);
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
      copyBtn.textContent = TRANSLATIONS[currentLang].btnCopied;
      setTimeout(() => { copyBtn.textContent = TRANSLATIONS[currentLang].btnCopyJson; }, 2000);
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

  const isLight = currentTheme === "light";
  const mapStyle = isLight ? "light_all" : "dark_all";
  const cartoTileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/${mapStyle}/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;
  
  cartoTileLayer = L.tileLayer(cartoTileUrl, {
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
        color: currentTheme === "light" ? "#1e293b" : COLOR_WHITE,
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
  // Theme & Language toggles
  document.getElementById("theme-toggle-btn").addEventListener("click", () => toggleTheme());
  document.getElementById("lang-toggle-btn").addEventListener("click", () => toggleLanguage());

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

  // Gridded explorer controls with 40ms throttling
  const slider = document.getElementById("grid-time-slider");
  slider.addEventListener("input", (e) => {
    if (sliderThrottleTimer) clearTimeout(sliderThrottleTimer);
    sliderThrottleTimer = setTimeout(() => {
      loadGridded(e.target.value);
    }, 40);
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
  const cacheKey = `${district}_${variable}_${startDate}_${endDate}`;

  // Abort previous in-flight request if user rapidly changed selection
  if (trendAbortCtrl) {
    trendAbortCtrl.abort();
  }
  trendAbortCtrl = new AbortController();

  try {
    let trendData;
    if (trendCache.has(cacheKey)) {
      trendData = trendCache.get(cacheKey);
    } else {
      const url = `/trend?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}&start=${startDate}&end=${endDate}&include_series=true`;
      const res = await fetch(url, { signal: trendAbortCtrl.signal });
      if (!res.ok) throw new Error("Trend fetch failed");
      trendData = await res.json();
      trendCache.set(cacheKey, trendData);
    }

    currentTrendData = trendData;
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
    if (err.name === "AbortError") return;
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

// Efficiently highlight Selected District on Map in Yellow & White
function highlightMapMarker(selectedDistrict) {
  const newMarker = districtMarkers[selectedDistrict];
  if (!newMarker) return;

  const isLight = currentTheme === "light";

  // Reset previous marker
  if (currentActiveMarker && currentActiveMarker !== newMarker) {
    currentActiveMarker.setStyle({
      radius: 7,
      fillColor: COLOR_YELLOW,
      color: isLight ? "#1e293b" : COLOR_WHITE,
      weight: 1.5,
      fillOpacity: 0.85
    });
  }

  // Highlight new marker
  const isIncreasing = currentTrendData && currentTrendData.trend && currentTrendData.trend.direction === "increasing";
  newMarker.setStyle({
    radius: 12,
    fillColor: isIncreasing ? COLOR_YELLOW : COLOR_WHITE,
    color: isLight ? "#d97706" : COLOR_YELLOW,
    weight: 4,
    fillOpacity: 1.0
  });

  currentActiveMarker = newMarker;

  if (mapInstance) {
    mapInstance.panTo(newMarker.getLatLng(), { animate: true, duration: 0.4 });
  }
}

// Toggle Benjamini-Hochberg FDR Multiple Testing Correction on Map
async function toggleFDR(applyFDR) {
  const variable = document.getElementById("variable-select").value || "T2M";
  if (!applyFDR) {
    highlightMapMarker(document.getElementById("district-select").value);
    return;
  }

  try {
    let fdrList;
    if (fdrCache.has(variable)) {
      fdrList = fdrCache.get(variable);
    } else {
      const res = await fetch(`/map/fdr?variable=${variable}`);
      fdrList = await res.json();
      fdrCache.set(variable, fdrList);
    }

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
  const cacheKey = `${district}_${variable}`;

  try {
    let sensData;
    if (sensitivityCache.has(cacheKey)) {
      sensData = sensitivityCache.get(cacheKey);
    } else {
      const res = await fetch(`/sensitivity?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}`);
      sensData = await res.json();
      sensitivityCache.set(cacheKey, sensData);
    }

    const tbody = document.getElementById("sensitivity-tbody");
    tbody.innerHTML = "";

    sensData.windows.forEach(w => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border-color)";
      const sigColor = w.significant ? (currentTheme === "light" ? "#d97706" : COLOR_YELLOW) : COLOR_GRAY;
      tr.innerHTML = `
        <td style="padding:6px 8px; font-weight:700;">${w.window_years}-Year</td>
        <td style="padding:6px 8px; color:var(--text-muted);">${w.period}</td>
        <td style="padding:6px 8px; font-weight:700; color:${w.slope_per_year > 0 ? (currentTheme === "light" ? "#d97706" : COLOR_YELLOW) : "var(--text-main)"};">${w.slope_per_year > 0 ? "+" : ""}${w.slope_per_year}</td>
        <td style="padding:6px 8px; color:var(--text-muted);">[${w.ci_low}, ${w.ci_high}]</td>
        <td style="padding:6px 8px;">p = ${w.p_value}</td>
        <td style="padding:6px 8px; color:${sigColor}; font-weight:600;">${w.significant ? (currentLang === 'bn' ? "হ্যাঁ (p < ০.০৫)" : "Yes (p < 0.05)") : (currentLang === 'bn' ? "না" : "No")}</td>
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
  const colors = getThemeChartColors();

  const dates = currentTrendData.series.map(pt => pt.date);
  const observed = currentTrendData.series.map(pt => pt.observed);
  const fitted = currentTrendData.series.map(pt => pt.fitted);
  const ciLower = currentTrendData.series.map(pt => pt.ci_lower);
  const ciUpper = currentTrendData.series.map(pt => pt.ci_upper);

  const datasets = [];

  if (showDecomp && currentTrendData.decomposition) {
    // Show seasonal decomposition components
    datasets.push({
      label: currentLang === 'bn' ? "দীর্ঘমেয়াদী ট্রেন্ড" : "Long-term Trend",
      data: currentTrendData.decomposition.trend,
      borderColor: colors.yellowLine,
      borderWidth: 2.5,
      pointRadius: 0,
      tension: 0.2
    });
    datasets.push({
      label: currentLang === 'bn' ? "ঋতুভিত্তিক পরিবর্তন" : "Seasonal Component",
      data: currentTrendData.decomposition.seasonal,
      borderColor: colors.textColor,
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3
    });
    datasets.push({
      label: currentLang === 'bn' ? "অবশিষ্টাংশ (Residuals)" : "Residuals",
      data: currentTrendData.decomposition.residual,
      borderColor: COLOR_CHARCOAL,
      borderWidth: 1,
      pointRadius: 0,
      borderDash: [3, 3]
    });
  } else {
    // Observed values in soft white / slate
    datasets.push({
      label: `${currentLang === 'bn' ? 'পর্যবেক্ষিত' : 'Observed'} ${currentTrendData.variable}`,
      data: observed,
      borderColor: colors.obsBorder,
      backgroundColor: colors.obsBg,
      pointBackgroundColor: colors.textColor,
      borderWidth: 1.2,
      pointRadius: 1.5,
      tension: 0.1
    });

    // Fitted Theil-Sen Line in Vibrant Yellow / Gold
    datasets.push({
      label: `${currentLang === 'bn' ? 'থেইল-সেন ফিট' : 'Theil-Sen Fit'} (${currentTrendData.slope.slope_per_year} ${currentTrendData.slope.units})`,
      data: fitted,
      borderColor: colors.yellowLine,
      borderWidth: 3.5,
      pointRadius: 0
    });

    // 95% Confidence Band in Shaded Yellow
    if (showCI) {
      datasets.push({
        label: currentLang === 'bn' ? "৯৫% কনফিডেন্স ঊর্ধ্বসীমা" : "95% CI Upper",
        data: ciUpper,
        borderColor: "transparent",
        backgroundColor: colors.yellowBand,
        fill: "+1",
        pointRadius: 0
      });
      datasets.push({
        label: currentLang === 'bn' ? "৯৫% কনফিডেন্স নিম্নসীমা" : "95% CI Lower",
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
      animation: { duration: 250 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: colors.textColor, font: { size: 11, weight: "600" } }
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          ticks: { color: colors.tickColor, maxTicksLimit: 12 },
          grid: { color: colors.gridColor }
        },
        y: {
          ticks: { color: colors.tickColor },
          grid: { color: colors.gridColor },
          title: {
            display: true,
            text: currentTrendData.slope.units,
            color: colors.yellowLine
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
  const cacheKey = `${district}_${variable}_${horizon}`;
  const colors = getThemeChartColors();

  if (forecastAbortCtrl) forecastAbortCtrl.abort();
  forecastAbortCtrl = new AbortController();

  try {
    let fcData;
    if (forecastCache.has(cacheKey)) {
      fcData = forecastCache.get(cacheKey);
    } else {
      const res = await fetch(`/forecast?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}&horizon_months=${horizon}`, { signal: forecastAbortCtrl.signal });
      fcData = await res.json();
      forecastCache.set(cacheKey, fcData);
    }

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
            label: currentLang === 'bn' ? "ঐতিহাসিক পর্যবেক্ষণ" : "Historical Observations",
            data: fullHist,
            borderColor: colors.obsBorder,
            borderWidth: 1.2,
            pointRadius: 0
          },
          {
            label: `${currentLang === 'bn' ? 'এমএল পূর্বাভাস প্রক্ষেপণ' : 'ML Forecast Projection'} (${horizon} ${currentLang === 'bn' ? 'মাস' : 'Months'})`,
            data: fullPred,
            borderColor: colors.yellowLine,
            borderWidth: 3,
            pointRadius: 0
          },
          {
            label: currentLang === 'bn' ? "৯৫% প্রেডিকশন ইন্টারভ্যাল ঊর্ধ্বসীমা" : "95% Prediction Interval Upper",
            data: fullHigh,
            borderColor: "transparent",
            backgroundColor: colors.yellowBand,
            fill: "+1",
            pointRadius: 0
          },
          {
            label: currentLang === 'bn' ? "৯৫% প্রেডিকশন ইন্টারভ্যাল নিম্নসীমা" : "95% Prediction Interval Lower",
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
        animation: { duration: 250 },
        plugins: {
          legend: { labels: { color: colors.textColor } },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipTitle,
            bodyColor: colors.tooltipBody,
            borderColor: colors.tooltipBorder,
            borderWidth: 1
          }
        },
        scales: {
          x: { ticks: { color: colors.tickColor, maxTicksLimit: 14 }, grid: { color: colors.gridColor } },
          y: { ticks: { color: colors.tickColor }, grid: { color: colors.gridColor } }
        }
      }
    });

  } catch (err) {
    if (err.name === "AbortError") return;
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
  const cacheKey = `${district}_${variable}_${start}_${end}`;

  if (narrationAbortCtrl) narrationAbortCtrl.abort();
  narrationAbortCtrl = new AbortController();

  try {
    let narr;
    if (narrationCache.has(cacheKey)) {
      narr = narrationCache.get(cacheKey);
    } else {
      const url = `/narration?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}&start=${start}&end=${end}`;
      const res = await fetch(url, { signal: narrationAbortCtrl.signal });
      narr = await res.json();
      narrationCache.set(cacheKey, narr);
    }

    const enElem = document.getElementById("narration-en");
    const bnElem = document.getElementById("narration-bn");
    const badge = document.getElementById("narration-badge");

    if (narr.verified) {
      enElem.textContent = narr.narration.english;
      bnElem.textContent = narr.narration.bangla;
      badge.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> <span id="txt-narration-verified">${TRANSLATIONS[currentLang].narrationVerified}</span>`;
      badge.style.backgroundColor = "var(--yellow-glow-subtle)";
      badge.style.color = "var(--accent-yellow)";
      badge.style.borderColor = "var(--accent-yellow)";
    } else {
      enElem.textContent = `[OUTPUT BLOCKED]: ${narr.block_reason}`;
      bnElem.textContent = `[ব্লক করা হয়েছে]: টুল রেজাল্টে অপ্রমাণিত সংখ্যা সনাক্ত হয়েছে।`;
      badge.textContent = currentLang === 'bn' ? "ব্লক করা হয়েছে: বিভ্রান্তিকর সংখ্যা সনাক্ত" : "BLOCKED: Hallucination Detected";
      badge.style.backgroundColor = "var(--bg-primary)";
      badge.style.color = "var(--text-main)";
      badge.style.borderColor = "var(--border-color)";
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Narration error:", err);
  }
}

// Load Two-District Comparison in Yellow vs White
async function loadComparison() {
  const d1 = document.getElementById("compare-d1-select").value || "Rajshahi";
  const d2 = document.getElementById("compare-d2-select").value || "Dhaka";
  const variable = document.getElementById("variable-select").value || "T2M";
  const cacheKey = `${d1}_${d2}_${variable}`;
  const colors = getThemeChartColors();

  try {
    let comp;
    if (compareCache.has(cacheKey)) {
      comp = compareCache.get(cacheKey);
    } else {
      const res = await fetch(`/compare?district1=${encodeURIComponent(d1)}&district2=${encodeURIComponent(d2)}&variable=${encodeURIComponent(variable)}`);
      comp = await res.json();
      compareCache.set(cacheKey, comp);
    }

    document.getElementById("compare-banner-title").textContent = `${comp.district1.district} vs. ${comp.district2.district}`;
    if (!document.getElementById("compare-banner-summary").textContent.includes("highest divergence")) {
      document.getElementById("compare-banner-summary").textContent = comp.comparison_summary;
    }

    document.getElementById("comp-d1-slope").textContent = `${comp.district1.slope.slope_per_year} ${comp.district1.slope.units}`;
    document.getElementById("comp-d1-sub").textContent = `Mann-Kendall Z = ${comp.district1.trend.Z} (p = ${comp.district1.trend.p_value})`;

    document.getElementById("comp-d2-slope").textContent = `${comp.district2.slope.slope_per_year} ${comp.district2.slope.units}`;
    document.getElementById("comp-d2-sub").textContent = `Mann-Kendall Z = ${comp.district2.trend.Z} (p = ${comp.district2.trend.p_value})`;

    // Comparison Chart in Yellow vs White/Dark
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
            borderColor: colors.yellowLine,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: `${comp.district2.district} (Slope: ${comp.district2.slope.slope_per_year})`,
            data: d2Obs,
            borderColor: currentTheme === "light" ? "#1e293b" : COLOR_WHITE,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { labels: { color: colors.textColor } },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipTitle,
            bodyColor: colors.tooltipBody,
            borderColor: colors.tooltipBorder,
            borderWidth: 1
          }
        },
        scales: {
          x: { ticks: { color: colors.tickColor, maxTicksLimit: 12 }, grid: { color: colors.gridColor } },
          y: { ticks: { color: colors.tickColor }, grid: { color: colors.gridColor } }
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
  const cacheKey = `${variable}_${timeIdx}`;

  if (griddedAbortCtrl) griddedAbortCtrl.abort();
  griddedAbortCtrl = new AbortController();

  try {
    let gridData;
    if (griddedCache.has(cacheKey)) {
      gridData = griddedCache.get(cacheKey);
    } else {
      const res = await fetch(`/gridded?variable=${variable}&time_index=${timeIdx}`, { signal: griddedAbortCtrl.signal });
      gridData = await res.json();
      griddedCache.set(cacheKey, gridData);
    }

    document.getElementById("grid-date-label").textContent = `${currentLang === 'bn' ? 'পর্যবেক্ষণ মাস:' : 'Observation Month:'} ${gridData.date}`;
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
          ctx.fillStyle = currentTheme === "light" ? "#f1f5f9" : COLOR_BLACK;
        } else {
          // Normalize 0 to 1
          const norm = Math.max(0, Math.min(1, (val - gridData.min_value) / (gridData.max_value - gridData.min_value || 1)));
          ctx.fillStyle = getHeatmapColor(variable, norm);
        }
        ctx.fillRect(c * cellW, r * cellH, cellW - 1, cellH - 1);
      }
    }
  } catch (err) {
    if (err.name === "AbortError") return;
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
