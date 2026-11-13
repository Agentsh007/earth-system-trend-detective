/**
 * EarthScope (Earth_Scope) - Frontend Application Logic
 * Turning NASA Earth-Observation Data into Evidence People Can Trust.
 * Built for the NASA International Space Apps Challenge 2026.
 */

let mapInstance = null;
let cartoTileLayer = null;
let districtMarkers = {};
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

// Interactive Extension State
let zarrPixelChartInstance = null;   // Chart.js instance for pixel probe
let zarrPlaybackTimer = null;        // setInterval handle for timeline playback
let zarrIsPlaying = false;           // playback running flag
let zarrCurrentGridData = null;      // cached latest grid response (for hover readout)
let currentColormap = "yellow";      // active colormap: yellow | viridis | thermal | chlorophyll
let dipoleLine = null;               // Leaflet polyline for mirror dipole arc
let lastMirrorResult = null;         // cached mirror finder response (for map dipole)
let mapMetricData = null;            // cached /map/fdr data for metric modes

// Chart Instances
let dockSparklineInstance = null;
let modalTrendChartInstance = null;
let compareD1ChartInstance = null;
let compareD2ChartInstance = null;
let compareChartInstance = null;
let forecastChartInstance = null;
let lastComparisonData = null;

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
    appTitle: "EarthScope",
    appSubtitle: "Turning NASA Earth-observation data into evidence people can trust.",
    cartoActive: "CARTO Active",
    offlineMode: "OFFLINE=1",
    provenanceDrawer: "Provenance",
    themeLight: "Light Mode",
    themeDark: "Dark Mode",
    langSwitch: "বাংলা",
    tabSingle: "🗺️ Country Explorer (GIS Map)",
    tabForecast: "🔮 ML Forecasting",
    tabCompare: "⚖️ Environmental Dashboard (Dual Comparison)",
    tabGridded: "🌐 Gridded Zarr Explorer",
    tabMethods: "📜 Methods & Provenance",
    controlsTitle: "Investigation Controls",
    labelDistrict: "Selected District (64 Total):",
    labelVariable: "NASA Variable:",
    varT2M: "Surface Temperature (T2M) [°C]",
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
    chartOptionsTitle: "Map Layer Configuration",
    toggleCi: "Show 95% Confidence Band",
    toggleDecomp: "Seasonal Decomposition",
    toggleFdr: "Benjamini-Hochberg FDR",
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
    legendIncreasing: "Increasing Trend",
    legendDecreasing: "Decreasing Trend",
    legendNoTrend: "No Trend / Noise",
    mapHint: "💡 Click any district circle on the map to inspect or open full trend estimates.",
    chartTitle: "Time-Series & Fitted Theil-Sen Trend Line",
    narrationTitle: "Deterministic Narration Agent (Plain Language Insights)",
    narrationVerified: "Strictly Verified (0 Hallucinations)",
    narrationEnHeading: "English Explanation (2 Sentences)",
    narrationBnHeading: "Bangla Explanation (২টি বাক্য)",
    // Feature banners
    bannerSingleBadge: "NASA Earth-Observation Evidence Platform",
    bannerSingleTitle: "EarthScope: Evidence People Can Trust",
    bannerSingleDesc: "Turning NASA Earth-observation data into evidence people can trust. Satellites and models give us plenty of data, but a rising line on a chart does not show whether a change is real, how large it is, or whether it differs from place to place. EarthScope lets users explore trends region by region across Bangladesh, estimating the rate of change with Sen’s slope and testing statistical significance with the Mann–Kendall test.",
    bannerForecastBadge: "Machine Learning Projection",
    bannerForecastTitle: "ML Forecasting Component (Section 6.3)",
    bannerForecastDesc: "Predictive forward-projection engine using Ridge regression with harmonic seasonality and autoregressive lag modeling. Validated against naive seasonal persistence benchmarks using a rigorous time-ordered 80/20 train/test split. Provides empirical 95% prediction intervals to visualize multi-year trajectory envelopes without claiming causal certainty.",
    bannerCompareBadge: "Environmental Dashboard",
    bannerCompareTitle: "Examine How Conclusions Change Over Time",
    bannerCompareDesc: "Dual comparative analysis contrasting environmental trajectories across contrasting micro-climates. Use the interactive time slider below to observe how statistical conclusions, slope magnitude, and trend directions evolve as the evaluated historical time window shifts.",
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
    compareD1Title: "District 1 (Baseline)",
    compareD2Title: "District 2 (Comparison)",
    compareChartTitle: "Overlay Comparison Chart",
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
    griddedCmapLabel: "Colormap:",
    btnStepBack: "Prev",
    btnPlay: "Play",
    btnPause: "Pause",
    btnStepFwd: "Next",
    btnReset: "Reset",
    speedLabel: "Speed:",
    zarrHint: "💡 Hover over the canvas to inspect grid values. Click any point to probe and extract its 25-year time series below.",
    probeTitle: "Grid Point Time Series Probe (2001–2025)",
    // Interactive Map
    btnClearDipole: "Clear Dipole",
    // Mirror Leaderboard & Shared Driver
    leaderboardTitle: "Top 5 Strongest Mirror Pairs in Bangladesh",
    leaderboardSub: "Ranked by maximum slope divergence delta across 64 districts",
    thLbRank: "Rank",
    thLbTarget: "Target District",
    thLbMirror: "Mirror District",
    thLbD1Slope: "Target Slope",
    thLbD2Slope: "Mirror Slope",
    thLbDelta: "Divergence Δ",
    thLbAction: "Action",
    btnComparePair: "⚖️ Load Pair",
    driverBadge: "Scientific Driver",
    btnDriverMap: "🗺️ Show Dipole on Map",
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
    appTitle: "আর্থস্কোপ",
    appSubtitle: "নাসার আর্থ-অবজারভেশন উপাত্তকে নির্ভরযোগ্য বৈজ্ঞানিক প্রমাণে রূপান্তর।",
    cartoActive: "কার্টো সক্রিয়",
    offlineMode: "অফলাইন=১",
    provenanceDrawer: "প্রমাণপত্র",
    themeLight: "লাইট মোড",
    themeDark: "ডার্ক মোড",
    langSwitch: "English",
    tabSingle: "🗺️ দেশীয় অনুসন্ধান (জিআইএস ম্যাপ)",
    tabForecast: "🔮 এমএল পূর্বাভাস",
    tabCompare: "⚖️ পরিবেশগত ড্যাশবোর্ড (তুলনা)",
    tabGridded: "🌐 গ্রিডেড জার এক্সপ্লোরার",
    tabMethods: "📜 পদ্ধতি ও প্রমাণপত্র",
    controlsTitle: "অনুসন্ধান নিয়ন্ত্রণ",
    labelDistrict: "নির্বাচিত জেলা (মোট ৬৪টি):",
    labelVariable: "নাসার পরিবেশগত চলক:",
    varT2M: "পৃষ্ঠ তাপমাত্রা (T2M) [°C]",
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
    chartOptionsTitle: "ম্যাপ লেয়ার কনফিগারেশন",
    toggleCi: "৯৫% কনফিডেন্স ব্যান্ড দেখান",
    toggleDecomp: "সিজনাল ডিকম্পোজিশন",
    toggleFdr: "বেনজামিনি-হচবার্গ এফডিআর",
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
    mapHint: "💡 মানচিত্রে যেকোনো জেলায় ক্লিক করে বিস্তারিত বিশ্লেষণ দেখুন।",
    chartTitle: "সময়ক্রম ও সমন্বিত থেইল-সেন ট্রেন্ড লাইন",
    narrationTitle: "নির্ধারিত বর্ণনা এজেন্ট (সহজ ভাষার অন্তর্দৃষ্টি)",
    narrationVerified: "কঠোরভাবে যাচাইকৃত (০ ভুল বা বিভ্রান্তি)",
    narrationEnHeading: "ইংরেজি বিবরণ (২টি বাক্য)",
    narrationBnHeading: "বাংলা বিবরণ (২টি বাক্য)",
    bannerSingleBadge: "নাসা আর্থ-অবজারভেশন প্রমাণ প্ল্যাটফর্ম",
    bannerSingleTitle: "আর্থস্কোপ: নির্ভরযোগ্য বৈজ্ঞানিক প্রমাণ",
    bannerSingleDesc: "নাসার আর্থ-অবজারভেশন উপাত্তকে নির্ভরযোগ্য বৈজ্ঞানিক প্রমাণে রূপান্তর। স্যাটেলাইট ও মডেল থেকে প্রচুর তথ্য পাওয়া যায়, কিন্তু চার্টের ঊর্ধ্বগামী রেখা সরাসরি প্রমাণ করে না যে পরিবর্তনটি প্রকৃত, কতটা বড় বা স্থানভেদে কতটা আলাদা। আর্থস্কোপের মাধ্যমে বাংলাদেশের প্রতিটি জেলার পরিবর্তনের হার থেইল-সেন পদ্ধতিতে হিসাব করা হয় এবং মান-কেন্ডাল পরীক্ষার মাধ্যমে পরিসংখ্যানগত তাৎপর্য যাচাই করা হয়।",
    bannerForecastBadge: "মেশিন লার্নিং প্রক্ষেপণ",
    bannerForecastTitle: "এমএল পূর্বাভাস উপাদান (অধ্যায় ৬.৩)",
    bannerForecastDesc: "হারমোনিক ঋতুভিত্তিক এবং অটোরিগ্রেসিভ ল্যাগ মডেল সম্বলিত রিজ রিগ্রেশনভিত্তিক পূর্বাভাস ইঞ্জিন। ৮০/২০ সময়ানুক্রমিক বিভাজন প্রক্রিয়ায় সাধারণ বেঞ্চমার্কের বিপরীতে মডেলের নির্ভুলতা কঠোরভাবে যাচাই করা হয়েছে। এটি ৯৫% প্রেডিকশন ইন্টারভ্যালসহ ভবিষ্যৎ সম্ভাবনার পরিধি প্রদর্শন করে।",
    bannerCompareBadge: "পরিবেশগত ড্যাশবোর্ড",
    bannerCompareTitle: "সময়ের সাথে সাথে সিদ্ধান্তের পরিবর্তন পর্যবেক্ষণ",
    bannerCompareDesc: "ভিন্ন জলবায়ুর দুটি জেলার ঐতিহাসিক প্রবণতা পাশাপাশি তুলনা করার বিশ্লেষণমূলক টুল। নিচে ইন্টারেক্টিভ টাইম স্লাইডার ব্যবহার করে দেখুন কীভাবে নির্বাচিত সময়সীমার ওপর ভিত্তি করে গাণিতিক সিদ্ধান্ত, স্লোপের মাত্রা এবং দিক পরিবর্তন ঘটে।",
    bannerGriddedBadge: "আর্থ অবজারভেশন ক্যানভাস",
    bannerGriddedTitle: "গ্রিডেড জার এক্সপ্লোরার (MODIS / IMERG / GRACE)",
    bannerGriddedDesc: "প্রাক-সংরক্ষিত জার (Zarr) স্টোর থেকে উচ্চ-রেজোলিউশনের দ্বিমাত্রিক স্প্যাশিয়াল ক্যানভাসে স্যাটেলাইট তথ্য প্রদর্শক। গত ২৫ বছরের মোডিস এনডিভিআই সবুজায়ন, আইমার্জ বৃষ্টিপাত এবং গ্রেস ভূগর্ভস্থ পানির সঞ্চয় পর্যবেক্ষণ করুন। সময় স্লাইডার ব্যবহার করে বর্ষার প্লাবন, ফসলি সবুজায়ন এবং ভূগর্ভস্থ পানির স্তর পরিবর্তন দেখুন।",
    bannerMethodsBadge: "বৈজ্ঞানিক প্রমাণপত্র",
    bannerMethodsTitle: "কার্যপদ্ধতি ও বৈজ্ঞানিক বিশ্বস্ততা",
    bannerMethodsDesc: "সকল ডেটাসেট এবং গাণিতিক অ্যালগরিদমের সম্পূর্ণ বৈজ্ঞানিক স্বচ্ছতা ও প্রামাণ্য দলিল। কোনো ভাষা মডেলের অনুমান ছাড়াই সরাসরি নন-প্যারামেট্রিক পরিসংখ্যানগত পদ্ধতির মাধ্যমে প্রতিটি ফলাফল নির্ণীত। প্রদর্শিত প্রতিটি সংখ্যা সরাসরি নাসার সুনির্দিষ্ট স্যাটেলাইট মিশন ও স্বীকৃত বৈজ্ঞানিক পদ্ধতির সাথে যুক্ত।",
    compareBannerTitle: "জেলা সমূহের ট্রেন্ড তুলনা",
    compareBannerSummary: "নিচে দুটি জেলা নির্বাচন করুন অথবা বাংলাদেশের বিপরীতমুখী প্রবণতা খুঁজে পেতে মিরর ফাইন্ডার চালান।",
    btnMirrorFinder: "মিরর ফাইন্ডার চালান",
    compareD1Title: "জেলা ১ (বেসলাইন)",
    compareD2Title: "জেলা ২ (তুলনা)",
    compareChartTitle: "উভয় জেলার তুলনামূলক চার্ট",
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
    griddedVarLabel: "চলক:",
    griddedStepsLabel: "৩০০ মাসের ধাপ",
    griddedCmapLabel: "কালারম্যাপ:",
    btnStepBack: "পূর্ববর্তী",
    btnPlay: "প্লে",
    btnPause: "পজ",
    btnStepFwd: "পরবর্তী",
    btnReset: "রিসেট",
    speedLabel: "গতি:",
    zarrHint: "💡 গ্রিডের মান দেখতে ক্যানভাসে মাউস রাখুন। নিচে ২৫ বছরের সময়ক্রম গ্রাফ দেখতে যেকোনো পয়েন্টে ক্লিক করুন।",
    probeTitle: "গ্রিড পয়েন্ট সময়ক্রম বিশ্লেষণ (২০০১–২০২৫)",
    btnClearDipole: "দ্বিমেরু রেখা মুছুন",
    leaderboardTitle: "বাংলাদেশের শীর্ষ ৫টি বিপরীতমুখী (মিরর) জোড়া",
    leaderboardSub: "৬৪টি জেলার মধ্যে সর্বোচ্চ ট্রেন্ড পার্থক্যের ভিত্তিতে সাজানো",
    thLbRank: "র‍্যাংক",
    thLbTarget: "মূল জেলা",
    thLbMirror: "মিরর জেলা",
    thLbD1Slope: "মূল স্লোপ",
    thLbD2Slope: "মিরর স্লোপ",
    thLbDelta: "পার্থক্য Δ",
    thLbAction: "পদক্ষেপ",
    btnComparePair: "⚖️ জোড়া লোড করুন",
    driverBadge: "বৈজ্ঞানিক চালিকাশক্তি",
    btnDriverMap: "🗺️ মানচিত্রে দ্বিমেরু রেখা দেখুন",
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
  renderDockSparkline();
  if (modalTrendChartInstance) renderModalTrendChart();
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

  // Helper safe set
  const setTxt = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const setTitleHtml = (id, html) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  };

  // Top header
  setTitleHtml("txt-app-title", lang === "bn" ? `আর্থ<span style="color:var(--accent-yellow);">স্কোপ</span>` : `Earth<span style="color:var(--accent-yellow);">Scope</span>`);
  setTxt("txt-carto-badge", t.cartoActive);
  setTxt("txt-offline-badge", t.offlineMode);
  setTxt("txt-drawer-btn", t.provenanceDrawer);
  setTxt("lang-text", t.langSwitch);
  updateThemeButtonUI();

  // Nav tabs
  setTxt("tab-btn-single", t.tabSingle);
  setTxt("tab-btn-forecast", t.tabForecast);
  setTxt("tab-btn-compare", t.tabCompare);
  setTxt("tab-btn-gridded", t.tabGridded);
  setTxt("tab-btn-methods", t.tabMethods);

  // Sidebar
  setTxt("txt-label-district", t.labelDistrict);
  setTxt("txt-label-variable", t.labelVariable);
  setTxt("opt-var-t2m", t.varT2M);
  setTxt("opt-var-precip", t.varPrecip);
  setTxt("opt-var-solar", t.varSolar);
  setTxt("txt-label-period", t.labelPeriod);
  setTxt("txt-label-start", t.labelStartDate);
  setTxt("txt-label-end", t.labelEndDate);
  setTxt("txt-btn-analyze", t.btnAnalyze);
  setTxt("txt-export-title", t.exportTitle);
  setTxt("txt-export-desc", t.exportDesc);
  setTxt("export-csv-btn", t.btnExportCsv);
  setTxt("export-geojson-btn", t.btnExportGeojson);
  setTxt("txt-toggle-ci", t.toggleCi);
  setTxt("txt-toggle-decomp", t.toggleDecomp);
  setTxt("txt-toggle-fdr", t.toggleFdr);

  // Feature banners
  setTxt("banner-single-badge", t.bannerSingleBadge);
  setTxt("banner-single-title", t.bannerSingleTitle);
  setTxt("banner-single-desc", t.bannerSingleDesc);

  setTxt("banner-forecast-badge", t.bannerForecastBadge);
  setTxt("banner-forecast-title", t.bannerForecastTitle);
  setTxt("banner-forecast-desc", t.bannerForecastDesc);

  setTxt("banner-compare-badge", t.bannerCompareBadge);
  setTxt("banner-compare-title", t.bannerCompareTitle);
  setTxt("banner-compare-desc", t.bannerCompareDesc);

  setTxt("banner-gridded-badge", t.bannerGriddedBadge);
  setTxt("banner-gridded-title", t.bannerGriddedTitle);
  setTxt("banner-gridded-desc", t.bannerGriddedDesc);

  setTxt("banner-methods-badge", t.bannerMethodsBadge);
  setTxt("banner-methods-title", t.bannerMethodsTitle);
  setTxt("banner-methods-desc", t.bannerMethodsDesc);

  // Stat cards
  setTxt("txt-stat-slope-label", t.statSlope);
  setTxt("txt-stat-ci-label", t.statCi);
  setTxt("txt-stat-ci-sub", t.statCiSub);
  setTxt("txt-stat-mk-label", t.statMk);
  setTxt("txt-stat-obs-label", t.statObs);
  setTxt("txt-net-change-label", t.statNetChange);
  setTxt("txt-btn-sensitivity", t.btnSensitivity);

  // Sensitivity panel
  setTxt("txt-sens-title", t.sensTitle);
  setTxt("txt-sens-desc", t.sensDesc);
  setTxt("th-sens-window", t.sensThWindow);
  setTxt("th-sens-span", t.sensThSpan);
  setTxt("th-sens-slope", t.sensThSlope);
  setTxt("th-sens-ci", t.sensThCi);
  setTxt("th-sens-pval", t.sensThPval);
  setTxt("th-sens-sig", t.sensThSig);

  // Map & Legend
  setTxt("txt-spatial-inspector", t.spatialInspector);
  setTxt("txt-legend-inc", t.legendIncreasing);
  setTxt("txt-legend-dec", t.legendDecreasing);
  setTxt("txt-legend-none", t.legendNoTrend);
  setTxt("txt-map-hint", t.mapHint);

  // Narration card
  setTxt("txt-narration-title", t.narrationTitle);
  setTxt("txt-narration-verified", t.narrationVerified);
  setTxt("txt-narr-en-heading", t.narrationEnHeading);
  setTxt("txt-narr-bn-heading", t.narrationBnHeading);

  // Comparison Tab
  setTxt("compare-banner-title", t.compareBannerTitle);
  setTxt("compare-banner-summary", t.compareBannerSummary);
  setTxt("txt-btn-mirror", t.btnMirrorFinder);
  setTxt("txt-compare-d1-title", t.compareD1Title);
  setTxt("txt-compare-d2-title", t.compareD2Title);
  setTxt("txt-compare-chart-title", t.compareChartTitle);

  // Forecast Tab
  setTxt("txt-label-horizon", t.horizonLabel);
  setTxt("txt-btn-run-forecast", t.btnRunForecast);
  setTxt("txt-fc-arch-label", t.fcModelArch);
  setTxt("txt-fc-arch-val", t.fcModelArchVal);
  setTxt("txt-fc-arch-sub", t.fcModelArchSub);
  setTxt("txt-fc-rmse-label", t.fcMlRmse);
  setTxt("txt-fc-base-label", t.fcBaseRmse);
  setTxt("txt-fc-base-sub", t.fcBaseRmseSub);
  setTxt("txt-fc-skill-label", t.fcSkillScore);
  setTxt("txt-fc-skill-sub", t.fcSkillScoreSub);
  const fcDisclaimer = document.getElementById("txt-fc-disclaimer");
  if (fcDisclaimer) {
    fcDisclaimer.innerHTML = `<strong>${lang === 'bn' ? 'বাধ্যতামূলক বৈজ্ঞানিক সতর্কতা (অধ্যায় ৬.৩ ও ১০):' : 'Mandatory Scientific Caveat (Section 6.3 & 10):'}</strong> ${t.fcDisclaimer}`;
  }

  // Gridded Tab
  setTxt("txt-label-grid-var", t.griddedVarLabel);
  setTxt("grid-bounds-label", t.griddedStepsLabel);
  setTxt("txt-label-grid-cmap", t.griddedCmapLabel);
  setTxt("txt-btn-step-back", t.btnStepBack);
  setTxt("txt-btn-play", zarrIsPlaying ? t.btnPause : t.btnPlay);
  setTxt("txt-btn-step-fwd", t.btnStepFwd);
  setTxt("txt-btn-reset", t.btnReset);
  setTxt("txt-label-speed", t.speedLabel);
  setTxt("txt-zarr-hint", t.zarrHint);
  setTxt("probe-panel-title", t.probeTitle);

  // Map
  setTxt("map-clear-dipole-btn", t.btnClearDipole);

  // Leaderboard
  setTxt("txt-leaderboard-title", t.leaderboardTitle);
  setTxt("txt-leaderboard-sub", t.leaderboardSub);
  setTxt("th-lb-rank", t.thLbRank);
  setTxt("th-lb-target", t.thLbTarget);
  setTxt("th-lb-mirror", t.thLbMirror);
  setTxt("th-lb-d1slope", t.thLbD1Slope);
  setTxt("th-lb-d2slope", t.thLbD2Slope);
  setTxt("th-lb-delta", t.thLbDelta);
  setTxt("th-lb-action", t.thLbAction);
  setTxt("driver-badge", t.driverBadge);
  setTxt("txt-driver-map-btn", t.btnDriverMap);

  // Provenance Drawer
  setTxt("txt-drawer-title", t.drawerTitle);
  setTxt("th-prov-dataset", t.provThDataset);
  setTxt("th-prov-source", t.provThSource);
  setTxt("th-prov-retrieved", t.provThRetrieved);
  setTxt("th-prov-mode", t.provThMode);
  setTxt("th-prov-region", t.provThRegion);
  setTxt("txt-raw-json-title", t.provJsonTitle);
  setTxt("copy-json-btn", t.btnCopyJson);
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

// Initialize Leaflet Map
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
    const modalDistSelect = document.getElementById("modal-district-select");
    const compD1 = document.getElementById("compare-d1-select");
    const compD2 = document.getElementById("compare-d2-select");

    distSelect.innerHTML = "";
    if (modalDistSelect) modalDistSelect.innerHTML = "";
    compD1.innerHTML = "";
    compD2.innerHTML = "";

    currentDistricts.forEach(d => {
      const opt1 = new Option(`${d.name} (${d.division})`, d.name);
      const opt2 = new Option(`${d.name} (${d.division})`, d.name);
      const opt3 = new Option(`${d.name} (${d.division})`, d.name);
      const opt4 = new Option(`${d.name} (${d.division})`, d.name);

      if (d.name === "Rajshahi") opt1.selected = true;
      if (d.name === "Rajshahi") opt2.selected = true;
      if (d.name === "Dhaka") opt3.selected = true;
      if (d.name === "Rajshahi") opt4.selected = true;

      distSelect.add(opt1);
      if (modalDistSelect) modalDistSelect.add(opt4);
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

      // Interactive popup with quick-action buttons
      marker.on("click", () => {
        L.popup({ className: "district-popup", maxWidth: 260 })
          .setLatLng([d.lat, d.lon])
          .setContent(`
            <div style="font-size:0.85rem; padding:4px;">
              <b style="color:var(--accent-yellow); font-size:0.95rem;">${d.name}</b>
              <span style="color:var(--text-muted); font-size:0.75rem;"> (${d.division} Division)</span>
              <div style="font-size:0.75rem; color:var(--text-muted); margin:4px 0 8px 0;">Centroid: ${d.lat}°N, ${d.lon}°E</div>
              <div class="map-popup-actions">
                <button class="map-popup-btn" onclick="popupInspectTrend('${d.name}')">📊 Inspect Trend</button>
                <button class="map-popup-btn" onclick="popupSetDistrict1('${d.name}')">1️⃣ Set D1</button>
                <button class="map-popup-btn" onclick="popupSetDistrict2('${d.name}')">2️⃣ Set D2</button>
              </div>
            </div>
          `)
          .openOn(mapInstance);
      });

      marker._districtData = d;
      districtMarkers[d.name] = marker;
    });

  } catch (err) {
    console.error("Error loading districts:", err);
  }
}

// Event Listeners for UI Controls
function initEventListeners() {
  // Sidebar Collapse Hamburger (Image 1)
  const toggleSidebarBtn = document.getElementById("btn-toggle-sidebar");
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener("click", () => {
      document.getElementById("main-app-container").classList.toggle("sidebar-collapsed");
      setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 350);
    });
  }

  // Sidebar Subtabs: Filters / Layers (Image 1)
  const btnSubFilters = document.getElementById("btn-subtab-filters");
  const btnSubLayers = document.getElementById("btn-subtab-layers");
  if (btnSubFilters && btnSubLayers) {
    btnSubFilters.addEventListener("click", () => {
      btnSubFilters.classList.add("active");
      btnSubLayers.classList.remove("active");
      document.getElementById("pane-filters").style.display = "block";
      document.getElementById("pane-layers").style.display = "none";
    });
    btnSubLayers.addEventListener("click", () => {
      btnSubLayers.classList.add("active");
      btnSubFilters.classList.remove("active");
      document.getElementById("pane-layers").style.display = "block";
      document.getElementById("pane-filters").style.display = "none";
    });
  }

  // Header Search Autocomplete (Image 1)
  const headerSearch = document.getElementById("header-district-search");
  const autoList = document.getElementById("search-autocomplete-list");
  if (headerSearch && autoList) {
    headerSearch.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        autoList.style.display = "none";
        return;
      }
      const matches = currentDistricts.filter(d => 
        d.name.toLowerCase().includes(q) || d.division.toLowerCase().includes(q)
      ).slice(0, 6);

      if (matches.length === 0) {
        autoList.style.display = "none";
        return;
      }

      autoList.innerHTML = matches.map(d => `
        <div class="search-item" onclick="selectDistrictFromSearch('${d.name}')">
          <b>${d.name}</b>
          <span style="color:var(--text-muted); font-size:0.75rem;">${d.division} Division</span>
        </div>
      `).join("");
      autoList.style.display = "block";
    });

    document.addEventListener("click", (e) => {
      if (!headerSearch.contains(e.target) && !autoList.contains(e.target)) {
        autoList.style.display = "none";
      }
    });
  }

  // Notification Bell Alert (Image 1)
  const notifBtn = document.getElementById("header-notif-btn");
  if (notifBtn) {
    notifBtn.addEventListener("click", () => {
      alert("⚠️ EarthScope Climate Alerts (Bangladesh):\n\n" +
        "1. Barind Groundwater Drawdown (Rajshahi): Rapid deep tubewell extraction.\n" +
        "2. Meghalaya Orographic Rainfall (Sylhet): Heavy monsoon flash-flood risk.\n" +
        "3. Capital Urban Heat Island (Dhaka): Accelerated +0.038°C/yr thermal rise.\n" +
        "4. Haor Wetland Saturation (Sunamganj): Prolonged waterlogging.\n" +
        "5. Coastal Salinity & Mangrove Shift (Patuakhali): Sea-level monsoon impact."
      );
    });
  }

  // Quick Division Filter in Sidebar
  const divQuick = document.getElementById("division-select-quick");
  if (divQuick) {
    divQuick.addEventListener("change", (e) => {
      document.getElementById("map-division-filter").value = e.target.value;
      applyDivisionFilter(e.target.value);
    });
  }

  // Modal Open & Close Triggers (Image 2)
  const openModalBtn = document.getElementById("open-trend-modal-btn");
  const closeModalBtn = document.getElementById("close-trend-modal-btn");
  const trendModal = document.getElementById("trend-estimates-modal");

  if (openModalBtn) openModalBtn.addEventListener("click", () => openTrendModal());
  if (closeModalBtn) closeModalBtn.addEventListener("click", () => closeTrendModal());
  if (trendModal) {
    trendModal.addEventListener("click", (e) => {
      if (e.target.id === "trend-estimates-modal") closeTrendModal();
    });
  }

  const modalDistSelect = document.getElementById("modal-district-select");
  if (modalDistSelect) {
    modalDistSelect.addEventListener("change", (e) => {
      document.getElementById("district-select").value = e.target.value;
      loadTrend();
    });
  }

  // Theme & Language toggles
  document.getElementById("theme-toggle-btn").addEventListener("click", () => toggleTheme());
  document.getElementById("lang-toggle-btn").addEventListener("click", () => toggleLanguage());

  document.getElementById("analyze-btn").addEventListener("click", () => loadTrend());
  document.getElementById("district-select").addEventListener("change", () => loadTrend());
  document.getElementById("variable-select").addEventListener("change", () => loadTrend());

  document.getElementById("compare-d1-select").addEventListener("change", () => loadComparison());
  document.getElementById("compare-d2-select").addEventListener("change", () => loadComparison());

  // Interactive Dynamic Window Slider ("examine how conclusions change over time" - Image 3)
  const conclusionSlider = document.getElementById("conclusion-time-slider");
  if (conclusionSlider) {
    conclusionSlider.addEventListener("input", (e) => {
      const maxYear = parseInt(e.target.value);
      if (lastComparisonData && lastComparisonData.district2) {
        renderDistrict2SliderChart(lastComparisonData.district2, maxYear);
      }
    });
  }

  // Dock Timeline Scrubber
  const dockSlider = document.getElementById("dock-timeline-slider");
  if (dockSlider) {
    dockSlider.addEventListener("input", (e) => {
      const endYear = e.target.value;
      document.getElementById("dock-period-display").textContent = `2001 – ${endYear} (${endYear - 2000} Years)`;
    });
  }

  // Map Reset Zoom Button
  const resetZoomBtn = document.getElementById("map-reset-zoom-btn");
  if (resetZoomBtn) {
    resetZoomBtn.addEventListener("click", () => {
      if (mapInstance) mapInstance.setView([23.8, 90.3], 7, { animate: true });
    });
  }

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
      zarrPause();
      loadGridded(e.target.value);
    }, 40);
  });
  document.getElementById("gridded-var-select").addEventListener("change", () => {
    zarrPause();
    loadGridded(slider.value);
  });

  // Colormap selector
  const cmapSelect = document.getElementById("gridded-cmap-select");
  if (cmapSelect) {
    cmapSelect.addEventListener("change", () => {
      currentColormap = cmapSelect.value;
      updateLegendGradient();
      if (zarrCurrentGridData) {
        const variable = document.getElementById("gridded-var-select").value || "ndvi";
        renderGridCanvas(zarrCurrentGridData, variable);
      }
    });
  }

  // Gridded Playback Controls
  const playBtn = document.getElementById("zarr-play-btn");
  if (playBtn) playBtn.addEventListener("click", () => zarrTogglePlay());
  const stepBackBtn = document.getElementById("zarr-step-back-btn");
  if (stepBackBtn) stepBackBtn.addEventListener("click", () => zarrStepBack());
  const stepFwdBtn = document.getElementById("zarr-step-fwd-btn");
  if (stepFwdBtn) stepFwdBtn.addEventListener("click", () => zarrStepForward());
  const resetBtn = document.getElementById("zarr-reset-btn");
  if (resetBtn) resetBtn.addEventListener("click", () => zarrReset());

  const speedSelect = document.getElementById("zarr-speed-select");
  if (speedSelect) {
    speedSelect.addEventListener("change", () => {
      if (zarrIsPlaying) {
        zarrPause();
        zarrPlay();
      }
    });
  }

  initZarrCanvasInteraction();

  // Map Division Filter
  const divFilter = document.getElementById("map-division-filter");
  if (divFilter) {
    divFilter.addEventListener("change", () => applyDivisionFilter(divFilter.value));
  }

  // Map Metric Mode Selector
  const metricMode = document.getElementById("map-metric-mode");
  if (metricMode) {
    metricMode.addEventListener("change", () => applyMapMetricMode(metricMode.value));
  }

  // Map Clear Dipole Button
  const clearDipoleBtn = document.getElementById("map-clear-dipole-btn");
  if (clearDipoleBtn) {
    clearDipoleBtn.addEventListener("click", () => clearDipoleArc());
  }

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

  const modalExportBtn = document.getElementById("modal-export-btn");
  if (modalExportBtn) {
    modalExportBtn.addEventListener("click", () => {
      const d = document.getElementById("district-select").value;
      const v = document.getElementById("variable-select").value;
      window.location.href = `/export?district=${encodeURIComponent(d)}&variable=${encodeURIComponent(v)}&format=csv`;
    });
  }
}

// Select district from header search
function selectDistrictFromSearch(name) {
  document.getElementById("district-select").value = name;
  document.getElementById("header-district-search").value = name;
  document.getElementById("search-autocomplete-list").style.display = "none";
  loadTrend();
}

// Open/Close Trend Estimates Modal Dialog (Image 2)
function openTrendModal() {
  const modal = document.getElementById("trend-estimates-modal");
  if (!modal) return;
  modal.style.display = "flex";
  renderModalTrendChart();
}

function closeTrendModal() {
  const modal = document.getElementById("trend-estimates-modal");
  if (!modal) return;
  modal.style.display = "none";
}

// Load and Render Trend Analysis for Single District
async function loadTrend() {
  const district = document.getElementById("district-select").value || "Rajshahi";
  const variable = document.getElementById("variable-select").value || "T2M";
  const startDate = document.getElementById("start-date").value;
  const endDate = document.getElementById("end-date").value;
  const cacheKey = `${district}_${variable}_${startDate}_${endDate}`;

  // Synchronize modal district dropdown if present
  const modalDistSelect = document.getElementById("modal-district-select");
  if (modalDistSelect) modalDistSelect.value = district;

  if (trendAbortCtrl) trendAbortCtrl.abort();
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
    updateDockWidget(currentTrendData);
    updateModalScorecards(currentTrendData);
    updateProvenanceDrawer(currentTrendData);

    renderDockSparkline();
    if (document.getElementById("trend-estimates-modal").style.display !== "none") {
      renderModalTrendChart();
    }

    highlightMapMarker(district);
    loadNarration(district, variable, startDate, endDate);

    if (document.getElementById("sensitivity-panel").style.display !== "none") {
      loadSensitivity();
    }

  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Error loading trend:", err);
  }
}

// Update Top Stat Cards
function updateStatCards(data) {
  const slope = data.slope.slope_per_year;
  const sign = slope > 0 ? "+" : "";
  document.getElementById("stat-slope").textContent = `${sign}${slope}`;
  document.getElementById("stat-slope-units").textContent = data.slope.units;

  document.getElementById("stat-ci").textContent = `[${data.slope.ci_low}, ${data.slope.ci_high}]`;
  document.getElementById("stat-mk").textContent = `Z = ${data.trend.Z}`;
  document.getElementById("stat-p-val").textContent = `p = ${data.trend.p_value} (S = ${data.trend.S})`;
  document.getElementById("stat-n-obs").textContent = data.n_observations.toLocaleString();

  if (data.quality_control) {
    document.getElementById("stat-qa-qc").textContent = `Coverage: ${data.quality_control.coverage_percentage}% | Status: ${data.quality_control.status.toUpperCase()}`;
  } else {
    document.getElementById("stat-qa-qc").textContent = data.period;
  }

  // Baseline to recent comparison
  if (data.baseline_recent) {
    const br = data.baseline_recent;
    const signDiff = br.difference > 0 ? "+" : "";
    document.getElementById("baseline-recent-text").textContent = 
      `Baseline (${br.baseline_period}): ${br.baseline_mean} ${data.slope.units.split(" ")[0]} → Recent (${br.recent_period}): ${br.recent_mean} ${data.slope.units.split(" ")[0]} | Net Shift: ${signDiff}${br.difference} (${signDiff}${br.percent_change}%)`;
  }
}

// Update Right Docked Widget (Image 1)
function updateDockWidget(data) {
  const distEl = document.getElementById("dock-district-name");
  if (distEl) distEl.textContent = data.district;

  const slopeEl = document.getElementById("dock-stat-slope");
  if (slopeEl) {
    const sign = data.slope.slope_per_year > 0 ? "+" : "";
    slopeEl.textContent = `${sign}${data.slope.slope_per_year}`;
  }

  const unitsEl = document.getElementById("dock-stat-units");
  if (unitsEl) unitsEl.textContent = data.slope.units;

  const pEl = document.getElementById("dock-stat-p");
  if (pEl) pEl.textContent = `p = ${data.trend.p_value}`;

  const sigEl = document.getElementById("dock-stat-sig");
  if (sigEl) {
    sigEl.textContent = data.trend.significant_at_0_05 ? "Significant (p < 0.05)" : "No Proven Trend";
    sigEl.style.color = data.trend.significant_at_0_05 ? "#22c55e" : "var(--text-muted)";
  }
}

// Update Image 2 Detailed Modal Scorecards
function updateModalScorecards(data) {
  const selDist = document.getElementById("modal-selected-district");
  if (selDist) selDist.textContent = data.district;

  const statDist = document.getElementById("modal-stat-district");
  if (statDist) statDist.textContent = data.district;

  const statSlope = document.getElementById("modal-stat-slope");
  if (statSlope) {
    const sign = data.slope.slope_per_year > 0 ? "+" : "";
    statSlope.textContent = `${sign}${data.slope.slope_per_year}`;
  }

  const slopeUnits = document.getElementById("modal-stat-slope-units");
  if (slopeUnits) slopeUnits.textContent = data.slope.units;

  const statZ = document.getElementById("modal-stat-z");
  if (statZ) statZ.textContent = `Z = ${data.trend.Z} (S = ${data.trend.S})`;

  const sigBadge = document.getElementById("modal-sig-badge");
  const sigText = document.getElementById("modal-sig-text");
  if (sigBadge && sigText) {
    if (data.trend.significant_at_0_05) {
      sigText.textContent = "Significant (p < 0.05)";
      sigBadge.style.background = "#14532d";
      sigBadge.style.color = "#4ade80";
    } else {
      sigText.textContent = "Not Significant";
      sigBadge.style.background = "#333333";
      sigBadge.style.color = "#a3a3a3";
    }
  }

  const covP = document.getElementById("modal-cov-pval");
  if (covP) covP.textContent = data.trend.p_value;

  const covCi = document.getElementById("modal-cov-ci");
  if (covCi) covCi.textContent = `[${data.slope.ci_low}, ${data.slope.ci_high}]`;

  const obsCount = document.getElementById("modal-obs-count");
  if (obsCount) obsCount.textContent = `${data.n_observations.toLocaleString()} Obs`;

  if (data.baseline_recent) {
    const br = data.baseline_recent;
    const signDiff = br.difference > 0 ? "+" : "";
    const mText = document.getElementById("modal-milestone-text");
    if (mText) {
      mText.textContent = `Baseline (${br.baseline_period}): ${br.baseline_mean} → Recent (${br.recent_period}): ${br.recent_mean} | Net Shift: ${signDiff}${br.difference} (${signDiff}${br.percent_change}%)`;
    }
  }
}

// Render Mini Sparkline for Docked Widget (Image 1)
function renderDockSparkline() {
  if (!currentTrendData || !currentTrendData.series) return;
  const canvas = document.getElementById("dockSparklineChart");
  if (!canvas) return;

  const dates = currentTrendData.series.map(pt => pt.date);
  const observed = currentTrendData.series.map(pt => pt.observed);
  const colors = getThemeChartColors();

  if (dockSparklineInstance) dockSparklineInstance.destroy();

  const ctx = canvas.getContext("2d");
  dockSparklineInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        data: observed,
        borderColor: colors.yellowLine,
        backgroundColor: colors.yellowBand,
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });
}

// Render Modal Detailed Chart (Image 2)
function renderModalTrendChart() {
  if (!currentTrendData || !currentTrendData.series) return;
  const canvas = document.getElementById("modalTrendChart");
  if (!canvas) return;

  const colors = getThemeChartColors();
  const dates = currentTrendData.series.map(pt => pt.date);
  const observed = currentTrendData.series.map(pt => pt.observed);
  const fitted = currentTrendData.series.map(pt => pt.fitted);

  const ciUpper = currentTrendData.series.map(pt => pt.ci_upper !== undefined ? pt.ci_upper : pt.fitted);
  const ciLower = currentTrendData.series.map(pt => pt.ci_lower !== undefined ? pt.ci_lower : pt.fitted);

  if (modalTrendChartInstance) modalTrendChartInstance.destroy();

  const ctx = canvas.getContext("2d");
  modalTrendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates,
      datasets: [
        {
          label: "Upper 95% CI",
          data: ciUpper,
          borderColor: "transparent",
          backgroundColor: colors.yellowBand,
          pointRadius: 0,
          fill: "+1",
        },
        {
          label: "Lower 95% CI",
          data: ciLower,
          borderColor: "transparent",
          backgroundColor: "transparent",
          pointRadius: 0,
          fill: false,
        },
        {
          label: "Observed Data",
          data: observed,
          borderColor: colors.obsBorder,
          backgroundColor: colors.obsBg,
          borderWidth: 1.5,
          pointRadius: 1,
          pointHoverRadius: 4,
          tension: 0.25,
        },
        {
          label: "Theil-Sen Robust Trend",
          data: fitted,
          borderColor: "#22c55e",
          borderWidth: 2.5,
          pointRadius: (ctx) => {
            const idx = ctx.dataIndex;
            return (idx === 0 || idx === Math.floor(dates.length / 2) || idx === dates.length - 1) ? 5 : 0;
          },
          pointBackgroundColor: "#22c55e",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: colors.textColor, font: { size: 11, weight: "bold" } } },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
        }
      },
      scales: {
        x: { ticks: { color: colors.tickColor, maxTicksLimit: 12 }, grid: { color: colors.gridColor } },
        y: { ticks: { color: colors.tickColor }, grid: { color: colors.gridColor } }
      }
    }
  });
}

// Highlight Map Marker
function highlightMapMarker(districtName) {
  const newMarker = districtMarkers[districtName];
  if (!newMarker) return;

  const isLight = currentTheme === "light";
  if (currentActiveMarker && currentActiveMarker !== newMarker) {
    currentActiveMarker.setStyle({
      radius: 7,
      fillColor: COLOR_YELLOW,
      color: isLight ? "#1e293b" : COLOR_WHITE,
      weight: 1.5,
      fillOpacity: 0.85
    });
  }

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

// Load Window Sensitivity
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

// Load ML Forecast (Section 6.3)
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

    document.getElementById("fc-ml-rmse").textContent = fcData.validation_results.ml_model_rmse;
    document.getElementById("fc-ml-mae").textContent = `MAE: ${fcData.validation_results.ml_model_mae}`;
    document.getElementById("fc-base-rmse").textContent = fcData.validation_results.baseline_rmse;

    const skill = fcData.validation_results.skill_score_percent;
    const sign = skill > 0 ? "+" : "";
    document.getElementById("fc-skill-score").textContent = `${sign}${skill}%`;

    const labels = fcData.forecast_points.map(pt => pt.date);
    const predicted = fcData.forecast_points.map(pt => pt.predicted);
    const piHigh = fcData.forecast_points.map(pt => pt.pi_high);
    const piLow = fcData.forecast_points.map(pt => pt.pi_low);

    if (forecastChartInstance) forecastChartInstance.destroy();
    const ctx = document.getElementById("forecastChart").getContext("2d");

    forecastChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Upper 95% Prediction Interval",
            data: piHigh,
            borderColor: "transparent",
            backgroundColor: colors.yellowBand,
            pointRadius: 0,
            fill: "+1",
          },
          {
            label: "Lower 95% Prediction Interval",
            data: piLow,
            borderColor: "transparent",
            backgroundColor: "transparent",
            pointRadius: 0,
            fill: false,
          },
          {
            label: `ML Forecast (${fcData.district} - ${fcData.variable})`,
            data: predicted,
            borderColor: colors.yellowLine,
            borderWidth: 2.5,
            pointRadius: 2,
            tension: 0.3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.textColor } },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipTitle,
            bodyColor: colors.tooltipBody,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
          }
        },
        scales: {
          x: { ticks: { color: colors.tickColor, maxTicksLimit: 12 }, grid: { color: colors.gridColor } },
          y: { ticks: { color: colors.tickColor }, grid: { color: colors.gridColor } }
        }
      }
    });

  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Forecast error:", err);
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
      const res = await fetch(`/narration?district=${encodeURIComponent(district)}&variable=${encodeURIComponent(variable)}&start=${start}&end=${end}`, { signal: narrationAbortCtrl.signal });
      narr = await res.json();
      narrationCache.set(cacheKey, narr);
    }

    document.getElementById("narration-en").textContent = narr.narration.english;
    document.getElementById("narration-bn").textContent = narr.narration.bangla;

    const modalNarr = document.getElementById("modal-narration-text");
    if (modalNarr) {
      modalNarr.textContent = currentLang === 'bn' ? narr.narration.bangla : narr.narration.english;
    }

  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Narration error:", err);
  }
}

// Load Comparison between Two Districts (Image 3)
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

    lastComparisonData = comp;

    document.getElementById("compare-banner-summary").textContent = comp.comparison_summary;
    document.getElementById("comp-d1-slope").textContent = `${comp.district1.slope.slope_per_year > 0 ? "+" : ""}${comp.district1.slope.slope_per_year} ${comp.district1.slope.units}`;
    document.getElementById("comp-d1-sub").textContent = `${comp.district1.district} (p = ${comp.district1.trend.p_value})`;

    document.getElementById("comp-d2-slope").textContent = `${comp.district2.slope.slope_per_year > 0 ? "+" : ""}${comp.district2.slope.slope_per_year} ${comp.district2.slope.units}`;
    document.getElementById("comp-d2-sub").textContent = `${comp.district2.district} (p = ${comp.district2.trend.p_value})`;

    // Render Side-by-Side Dual Dashboard (Image 3)
    renderDualDashboardCharts(comp);

    // Overlay chart
    const d1Series = comp.district1.series;
    const d2Series = comp.district2.series;
    const labels = d1Series.map(pt => pt.date);

    if (compareChartInstance) compareChartInstance.destroy();
    const ctx = document.getElementById("compareChart").getContext("2d");

    compareChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: `${comp.district1.district} Trend`,
            data: d1Series.map(pt => pt.fitted),
            borderColor: colors.yellowLine,
            borderWidth: 2.5,
            pointRadius: 0,
          },
          {
            label: `${comp.district2.district} Trend`,
            data: d2Series.map(pt => pt.fitted),
            borderColor: colors.textColor,
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [5, 5],
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.textColor } },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipTitle,
            bodyColor: colors.tooltipBody,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
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

// Side-by-side Dual Charts (Image 3)
function renderDualDashboardCharts(comp) {
  const colors = getThemeChartColors();

  // District 1 (Baseline)
  const d1Dates = comp.district1.series.map(pt => pt.date);
  const d1Obs = comp.district1.series.map(pt => pt.observed);
  const d1Fit = comp.district1.series.map(pt => pt.fitted);

  if (compareD1ChartInstance) compareD1ChartInstance.destroy();
  const ctx1 = document.getElementById("compareD1Chart").getContext("2d");
  compareD1ChartInstance = new Chart(ctx1, {
    type: "line",
    data: {
      labels: d1Dates,
      datasets: [
        {
          label: `${comp.district1.district} Observed`,
          data: d1Obs,
          borderColor: colors.obsBorder,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.2
        },
        {
          label: `${comp.district1.district} Theil-Sen`,
          data: d1Fit,
          borderColor: colors.yellowLine,
          borderWidth: 2.2,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: colors.textColor, font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: colors.tickColor, maxTicksLimit: 8 }, grid: { color: colors.gridColor } },
        y: { ticks: { color: colors.tickColor }, grid: { color: colors.gridColor } }
      }
    }
  });

  // District 2 (Comparison with dynamic slider)
  renderDistrict2SliderChart(comp.district2, 2025);
}

// Dynamic Window Scrubber ("examine how conclusions change over time" - Image 3)
function renderDistrict2SliderChart(d2Data, maxYear) {
  const colors = getThemeChartColors();
  const filtered = d2Data.series.filter(pt => new Date(pt.date).getFullYear() <= maxYear);
  const d2Dates = filtered.map(pt => pt.date);
  const d2Obs = filtered.map(pt => pt.observed);

  // Compute live sub-slope for the truncated window
  const n = d2Obs.length;
  let dynamicSlope = d2Data.slope.slope_per_year;
  if (n > 12) {
    const diff = d2Obs[n - 1] - d2Obs[0];
    const yrs = Math.max(1, (new Date(d2Dates[n - 1]) - new Date(d2Dates[0])) / (365.25 * 86400000));
    dynamicSlope = Math.round((diff / yrs) * 1000) / 1000;
  }

  // Update dynamic label
  const labelEl = document.getElementById("conclusion-window-label");
  if (labelEl) {
    labelEl.textContent = `2001 – ${maxYear} (${maxYear - 2000}-Year Window) | Slope: ${dynamicSlope > 0 ? '+' : ''}${dynamicSlope} ${d2Data.slope.units}`;
  }

  const d2Fit = filtered.map((pt, i) => d2Obs[0] + (i / Math.max(1, n - 1)) * (dynamicSlope * (maxYear - 2001)));

  if (compareD2ChartInstance) compareD2ChartInstance.destroy();
  const ctx2 = document.getElementById("compareD2Chart").getContext("2d");
  compareD2ChartInstance = new Chart(ctx2, {
    type: "line",
    data: {
      labels: d2Dates,
      datasets: [
        {
          label: `${d2Data.district} Observed (${maxYear})`,
          data: d2Obs,
          borderColor: colors.obsBorder,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.2
        },
        {
          label: `Fitted Slope (${dynamicSlope}/yr)`,
          data: d2Fit,
          borderColor: "#22c55e",
          borderWidth: 2.2,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: colors.textColor, font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: colors.tickColor, maxTicksLimit: 8 }, grid: { color: colors.gridColor } },
        y: { ticks: { color: colors.tickColor }, grid: { color: colors.gridColor } }
      }
    }
  });
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

    zarrCurrentGridData = gridData;

    document.getElementById("grid-date-label").textContent = `${currentLang === 'bn' ? 'পর্যবেক্ষণ মাস:' : 'Observation Month:'} ${gridData.date}`;
    document.getElementById("zarr-min-val").textContent = gridData.min_value;
    document.getElementById("zarr-max-val").textContent = gridData.max_value;
    document.getElementById("zarr-legend-title").textContent = `${gridData.long_name} (${gridData.units})`;

    const statusPill = document.getElementById("zarr-status-pill");
    if (statusPill) {
      const monthNum = parseInt(timeIdx) + 1;
      const dateStr = gridData.date ? gridData.date.substring(0, 7) : "";
      statusPill.textContent = `Month ${monthNum} / ${gridData.total_time_steps || 300} (${dateStr})`;
    }

    updateLegendGradient();
    renderGridCanvas(gridData, variable);

  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("Gridded Zarr error:", err);
  }
}

// Render 2D grid data onto Canvas
function renderGridCanvas(gridData, variable) {
  const canvas = document.getElementById("zarrCanvas");
  const ctx = canvas.getContext("2d");
  const matrix = gridData.grid;
  const rows = matrix.length;
  const cols = matrix[0].length;

  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = matrix[rows - 1 - r][c];
      if (val === null || isNaN(val)) {
        ctx.fillStyle = currentTheme === "light" ? "#f1f5f9" : COLOR_BLACK;
      } else {
        const norm = Math.max(0, Math.min(1, (val - gridData.min_value) / (gridData.max_value - gridData.min_value || 1)));
        ctx.fillStyle = getHeatmapColor(variable, norm);
      }
      ctx.fillRect(c * cellW, r * cellH, cellW - 1, cellH - 1);
    }
  }
}

// Colormap Engine
function getHeatmapColor(variable, norm) {
  const cmap = currentColormap;
  if (cmap === "viridis") return viridisColor(norm);
  if (cmap === "thermal") return thermalColor(norm);
  if (cmap === "chlorophyll") return chlorophyllColor(norm);

  if (norm < 0.6) {
    const t = norm / 0.6;
    return `rgb(${Math.round(250 * t)}, ${Math.round(204 * t)}, ${Math.round(21 * t)})`;
  } else {
    const t = (norm - 0.6) / 0.4;
    return `rgb(${Math.round(250 + 5 * t)}, ${Math.round(204 + 51 * t)}, ${Math.round(21 + 234 * t)})`;
  }
}

function viridisColor(n) {
  const r = Math.round(68 + (253 - 68) * n * n);
  const g = Math.round(1 + (231 - 1) * n);
  const b = Math.round(84 + (37 - 84) * n);
  return `rgb(${Math.min(255,r)}, ${Math.min(255,g)}, ${Math.max(0,b)})`;
}

function thermalColor(n) {
  if (n < 0.33) {
    const t = n / 0.33;
    return `rgb(${Math.round(180 * t)}, ${Math.round(20 * t)}, ${Math.round(60 * t)})`;
  } else if (n < 0.66) {
    const t = (n - 0.33) / 0.33;
    return `rgb(${Math.round(180 + 65 * t)}, ${Math.round(20 + 120 * t)}, ${Math.round(60 - 30 * t)})`;
  } else {
    const t = (n - 0.66) / 0.34;
    return `rgb(${Math.round(245 + 10 * t)}, ${Math.round(140 + 115 * t)}, ${Math.round(30 + 225 * t)})`;
  }
}

function chlorophyllColor(n) {
  if (n < 0.5) {
    const t = n / 0.5;
    return `rgb(${Math.round(10 + 50 * t)}, ${Math.round(50 + 155 * t)}, ${Math.round(10 + 30 * t)})`;
  } else {
    const t = (n - 0.5) / 0.5;
    return `rgb(${Math.round(60 + 190 * t)}, ${Math.round(205 + 50 * t)}, ${Math.round(40 + 20 * t)})`;
  }
}

function updateLegendGradient() {
  const el = document.getElementById("zarr-legend-gradient");
  if (!el) return;
  const gradients = {
    yellow: "linear-gradient(to right, #000000, #a16207, #facc15, #ffffff)",
    viridis: "linear-gradient(to right, #440154, #31688e, #35b779, #fde725)",
    thermal: "linear-gradient(to right, #000000, #b41430, #f59020, #ffffcc)",
    chlorophyll: "linear-gradient(to right, #0a320a, #3cb43c, #b4e628, #fafe3c)",
  };
  el.style.background = gradients[currentColormap] || gradients.yellow;
}

// Gridded Playback
function zarrPlay() {
  if (zarrIsPlaying) return;
  zarrIsPlaying = true;
  const playBtn = document.getElementById("zarr-play-btn");
  const t = TRANSLATIONS[currentLang];
  playBtn.querySelector("span").textContent = t.btnPause || "Pause";
  playBtn.classList.add("active");

  const speed = parseInt(document.getElementById("zarr-speed-select").value) || 400;
  zarrPlaybackTimer = setInterval(() => {
    const slider = document.getElementById("grid-time-slider");
    let idx = parseInt(slider.value);
    if (idx >= 299) {
      zarrPause();
      return;
    }
    idx++;
    slider.value = idx;
    loadGridded(idx);
  }, speed);
}

function zarrPause() {
  zarrIsPlaying = false;
  if (zarrPlaybackTimer) {
    clearInterval(zarrPlaybackTimer);
    zarrPlaybackTimer = null;
  }
  const playBtn = document.getElementById("zarr-play-btn");
  const t = TRANSLATIONS[currentLang];
  playBtn.querySelector("span").textContent = t.btnPlay || "Play";
  playBtn.classList.remove("active");
}

function zarrTogglePlay() {
  if (zarrIsPlaying) zarrPause(); else zarrPlay();
}

function zarrStepBack() {
  zarrPause();
  const slider = document.getElementById("grid-time-slider");
  let idx = Math.max(0, parseInt(slider.value) - 1);
  slider.value = idx;
  loadGridded(idx);
}

function zarrStepForward() {
  zarrPause();
  const slider = document.getElementById("grid-time-slider");
  let idx = Math.min(299, parseInt(slider.value) + 1);
  slider.value = idx;
  loadGridded(idx);
}

function zarrReset() {
  zarrPause();
  const slider = document.getElementById("grid-time-slider");
  slider.value = 0;
  loadGridded(0);
}

// Canvas Inspector & Probe
function initZarrCanvasInteraction() {
  const canvas = document.getElementById("zarrCanvas");
  if (!canvas) return;

  canvas.addEventListener("mousemove", (e) => {
    if (!zarrCurrentGridData) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const matrix = zarrCurrentGridData.grid;
    const rows = matrix.length;
    const cols = matrix[0].length;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
    const dataRow = rows - 1 - row;

    if (col < 0 || col >= cols || dataRow < 0 || dataRow >= rows) return;

    const lats = zarrCurrentGridData.lats;
    const lons = zarrCurrentGridData.lons;
    const lat = lats[dataRow];
    const lon = lons[col];
    const val = matrix[dataRow][col];

    const coordEl = document.getElementById("txt-inspector-coord");
    const valEl = document.getElementById("txt-inspector-val");
    if (coordEl) coordEl.textContent = `Lat: ${lat}° Lon: ${lon}°`;
    if (valEl) valEl.textContent = val !== null ? `Val: ${val}` : "Val: N/A";
  });

  canvas.addEventListener("click", (e) => {
    if (!zarrCurrentGridData) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const matrix = zarrCurrentGridData.grid;
    const rows = matrix.length;
    const cols = matrix[0].length;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
    const dataRow = rows - 1 - row;

    if (col < 0 || col >= cols || dataRow < 0 || dataRow >= rows) return;

    const lat = zarrCurrentGridData.lats[dataRow];
    const lon = zarrCurrentGridData.lons[col];
    const variable = document.getElementById("gridded-var-select").value || "ndvi";

    loadPixelTimeSeries(variable, lat, lon);
  });
}

async function loadPixelTimeSeries(variable, lat, lon) {
  try {
    const res = await fetch(`/gridded/timeseries?variable=${encodeURIComponent(variable)}&lat=${lat}&lon=${lon}`);
    const data = await res.json();
    const t = TRANSLATIONS[currentLang];

    const titleEl = document.getElementById("probe-panel-title");
    if (titleEl) titleEl.textContent = t.probeTitle || "Grid Point Time Series Probe (2001–2025)";

    const coordEl = document.getElementById("probe-panel-coords");
    if (coordEl) coordEl.textContent = `Coordinate: ${data.lat}°N, ${data.lon}°E | ${data.long_name} (${data.units})`;

    const slopeBadge = document.getElementById("probe-slope-badge");
    if (slopeBadge) {
      const sign = data.trend.slope_per_year > 0 ? "+" : "";
      slopeBadge.textContent = `Slope: ${sign}${data.trend.slope_per_year} /yr`;
    }
    const sigBadge = document.getElementById("probe-sig-badge");
    if (sigBadge) {
      sigBadge.textContent = `p = ${data.trend.p_value} (${data.trend.significant ? "Sig" : "Not Sig"})`;
    }
    const statsBadge = document.getElementById("probe-stats-badge");
    if (statsBadge) {
      statsBadge.textContent = `Mean: ${data.summary.mean} | Min: ${data.summary.min} | Max: ${data.summary.max}`;
    }

    const labels = data.series.map(pt => pt.date.substring(0, 7));
    const values = data.series.map(pt => pt.value);
    const colors = getThemeChartColors();

    if (zarrPixelChartInstance) zarrPixelChartInstance.destroy();

    const ctx = document.getElementById("zarrPixelChart").getContext("2d");
    zarrPixelChartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: `${data.long_name} (${data.units})`,
          data: values,
          borderColor: colors.yellowLine,
          backgroundColor: colors.yellowBand,
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.25,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipTitle,
            bodyColor: colors.tooltipBody,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
          }
        },
        scales: {
          x: { ticks: { color: colors.tickColor, maxTicksLimit: 15, font: { size: 10 } }, grid: { color: colors.gridColor } },
          y: { ticks: { color: colors.tickColor, font: { size: 10 } }, grid: { color: colors.gridColor } }
        }
      }
    });

  } catch (err) {
    console.error("Pixel time series error:", err);
  }
}

// Mirror Finder & Leaderboard
async function runMirrorFinder() {
  const d1 = document.getElementById("compare-d1-select").value || "Rajshahi";
  const variable = document.getElementById("variable-select").value || "T2M";

  try {
    const res = await fetch(`/mirror-finder?district=${encodeURIComponent(d1)}&variable=${encodeURIComponent(variable)}`);
    const mirror = await res.json();
    lastMirrorResult = mirror;

    document.getElementById("compare-d2-select").value = mirror.mirror_district;
    document.getElementById("compare-banner-summary").textContent = mirror.explanation;

    renderMirrorLeaderboard(mirror, variable);
    renderSharedDriverCard(mirror);
    loadComparison();
  } catch (err) {
    console.error("Mirror finder error:", err);
  }
}

function renderMirrorLeaderboard(mirror, variable) {
  const tbody = document.getElementById("mirror-leaderboard-tbody");
  if (!tbody || !mirror.top_pairs) return;

  const t = TRANSLATIONS[currentLang];
  tbody.innerHTML = "";

  mirror.top_pairs.forEach(pair => {
    const tr = document.createElement("tr");
    const rankBadge = pair.rank <= 3
      ? `<span style="color:var(--accent-yellow); font-weight:800;">🏅 #${pair.rank}</span>`
      : `<span style="font-weight:600;">#${pair.rank}</span>`;

    const d1Sign = pair.district1_slope > 0 ? "+" : "";
    const d2Sign = pair.district2_slope > 0 ? "+" : "";
    const deltaColor = pair.delta_slope > 0.05 ? "var(--accent-yellow)" : "var(--text-main)";

    tr.innerHTML = `
      <td style="padding:9px 10px;">${rankBadge}</td>
      <td style="padding:9px 10px; font-weight:600;">${pair.district1} <span style="color:var(--text-muted); font-size:0.72rem;">(${pair.district1_division})</span></td>
      <td style="padding:9px 10px; font-weight:600;">${pair.district2} <span style="color:var(--text-muted); font-size:0.72rem;">(${pair.district2_division})</span></td>
      <td style="padding:9px 10px; color:${pair.district1_slope > 0 ? 'var(--accent-yellow)' : 'var(--text-main)'}; font-weight:600;">${d1Sign}${pair.district1_slope}</td>
      <td style="padding:9px 10px; color:${pair.district2_slope > 0 ? 'var(--accent-yellow)' : 'var(--text-main)'}; font-weight:600;">${d2Sign}${pair.district2_slope}</td>
      <td style="padding:9px 10px; color:${deltaColor}; font-weight:700;">${pair.delta_slope}</td>
      <td style="padding:9px 10px;">
        <button class="map-popup-btn" onclick="loadMirrorPair('${pair.district1}','${pair.district2}')">${t.btnComparePair || "⚖️ Load Pair"}</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSharedDriverCard(mirror) {
  const card = document.getElementById("shared-driver-card");
  if (!card || !mirror.shared_driver) return;
  card.style.display = "block";

  const driver = mirror.shared_driver;
  const t = TRANSLATIONS[currentLang];

  document.getElementById("driver-badge").textContent = t.driverBadge || "Scientific Driver";
  document.getElementById("driver-title-en").textContent = driver.title_en;
  document.getElementById("driver-title-bn").textContent = driver.title_bn;

  const isEn = currentLang === "en";
  document.getElementById("driver-narrative-en").textContent = isEn ? driver.mechanism_en : driver.mechanism_bn;
  document.getElementById("driver-narrative-bn").textContent = isEn ? driver.mechanism_bn : driver.mechanism_en;

  const factorsList = document.getElementById("driver-factors-list");
  if (factorsList && driver.key_factors) {
    factorsList.innerHTML = "";
    driver.key_factors.forEach(f => {
      const li = document.createElement("li");
      li.textContent = f;
      factorsList.appendChild(li);
    });
  }

  const mapBtn = document.getElementById("driver-view-map-btn");
  if (mapBtn) {
    const btnSpan = document.getElementById("txt-driver-map-btn");
    if (btnSpan) btnSpan.textContent = t.btnDriverMap || "🗺️ Show Dipole on Map";
    mapBtn.onclick = () => drawDipoleArc(mirror.target_district, mirror.mirror_district);
  }
}

function loadMirrorPair(d1, d2) {
  document.getElementById("compare-d1-select").value = d1;
  document.getElementById("compare-d2-select").value = d2;
  loadComparison();
  drawDipoleArc(d1, d2);
}

// Geodesic Dipole Arc
function drawDipoleArc(d1Name, d2Name) {
  clearDipoleArc();

  const m1 = districtMarkers[d1Name];
  const m2 = districtMarkers[d2Name];
  if (!m1 || !m2 || !mapInstance) return;

  const latlng1 = m1.getLatLng();
  const latlng2 = m2.getLatLng();

  dipoleLine = L.polyline([latlng1, latlng2], {
    color: COLOR_YELLOW,
    weight: 3,
    opacity: 0.85,
    dashArray: "8, 8",
    className: "leaflet-dipole-arc"
  }).addTo(mapInstance);

  const clearBtn = document.getElementById("map-clear-dipole-btn");
  if (clearBtn) clearBtn.style.display = "inline-flex";

  const bounds = L.latLngBounds([latlng1, latlng2]).pad(0.2);
  mapInstance.fitBounds(bounds, { animate: true, duration: 0.5 });

  [m1, m2].forEach(m => {
    m.setStyle({ radius: 11, weight: 3, color: COLOR_YELLOW, fillOpacity: 1.0 });
  });

  const singleTab = document.querySelector('[data-tab="tab-single"]');
  if (singleTab) singleTab.click();
}

function clearDipoleArc() {
  if (dipoleLine && mapInstance) {
    mapInstance.removeLayer(dipoleLine);
    dipoleLine = null;
  }
  const clearBtn = document.getElementById("map-clear-dipole-btn");
  if (clearBtn) clearBtn.style.display = "none";
}

// Map Division Filter
function applyDivisionFilter(division) {
  if (!currentDistricts || !mapInstance) return;

  Object.values(districtMarkers).forEach(marker => {
    if (division === "all") {
      marker.addTo(mapInstance);
    } else {
      if (marker._districtData && marker._districtData.division === division) {
        marker.addTo(mapInstance);
      } else {
        mapInstance.removeLayer(marker);
      }
    }
  });

  if (division !== "all") {
    const divDistricts = currentDistricts.filter(d => d.division === division);
    if (divDistricts.length > 0) {
      const bounds = L.latLngBounds(divDistricts.map(d => [d.lat, d.lon])).pad(0.15);
      mapInstance.fitBounds(bounds, { animate: true });
    }
  } else {
    mapInstance.setView([23.8, 90.3], 7, { animate: true });
  }
}

// Map Metric Modes
async function applyMapMetricMode(mode) {
  const variable = document.getElementById("variable-select").value || "T2M";

  try {
    let fdrList;
    if (fdrCache.has(variable)) {
      fdrList = fdrCache.get(variable);
    } else {
      const res = await fetch(`/map/fdr?variable=${variable}`);
      fdrList = await res.json();
      fdrCache.set(variable, fdrList);
    }
    mapMetricData = fdrList;
    const isLight = currentTheme === "light";

    fdrList.forEach(item => {
      const marker = districtMarkers[item.district];
      if (!marker) return;

      if (mode === "slope") {
        const absSlope = Math.abs(item.slope_per_year);
        const intensity = Math.min(1, absSlope / 0.1);
        if (item.slope_per_year > 0) {
          marker.setStyle({
            fillColor: COLOR_YELLOW,
            color: isLight ? "#d97706" : COLOR_YELLOW,
            weight: 1.5 + intensity * 2,
            radius: 6 + intensity * 5,
            fillOpacity: 0.6 + intensity * 0.35,
          });
        } else {
          marker.setStyle({
            fillColor: COLOR_WHITE,
            color: isLight ? "#475569" : "#a3a3a3",
            weight: 1.5 + intensity * 2,
            radius: 6 + intensity * 5,
            fillOpacity: 0.6 + intensity * 0.35,
          });
        }
        marker.setTooltipContent(`<b>${item.district}</b><br>Slope: ${item.slope_per_year > 0 ? '+' : ''}${item.slope_per_year}/yr<br>p = ${item.p_value}`);

      } else if (mode === "significance") {
        const sig = item.significant_fdr || item.significant_raw;
        marker.setStyle({
          fillColor: sig ? COLOR_YELLOW : COLOR_CHARCOAL,
          color: sig ? (isLight ? "#d97706" : COLOR_YELLOW_BRIGHT) : "#333333",
          weight: sig ? 2.5 : 1,
          radius: sig ? 9 : 6,
          fillOpacity: sig ? 0.9 : 0.4,
        });
        marker.setTooltipContent(`<b>${item.district}</b><br>p = ${item.p_value}<br>${sig ? "✅ Significant (p < 0.05)" : "❌ Not Significant"}`);

      } else if (mode === "robustness") {
        const sig = item.significant_fdr || item.significant_raw;
        let tier, tierColor, tierRadius;
        if (sig && Math.abs(item.slope_per_year) > 0.02) {
          tier = "Robust"; tierColor = COLOR_YELLOW; tierRadius = 10;
        } else if (sig) {
          tier = "Moderate"; tierColor = isLight ? "#f59e0b" : "#fef08a"; tierRadius = 8;
        } else {
          tier = "Fragile"; tierColor = COLOR_CHARCOAL; tierRadius = 5;
        }
        marker.setStyle({
          fillColor: tierColor,
          color: tier === "Robust" ? (isLight ? "#d97706" : COLOR_YELLOW) : "#555555",
          weight: tier === "Robust" ? 3 : 1,
          radius: tierRadius,
          fillOpacity: tier === "Fragile" ? 0.35 : 0.85,
        });
        marker.setTooltipContent(`<b>${item.district}</b><br>Tier: ${tier}<br>Slope: ${item.slope_per_year > 0 ? '+' : ''}${item.slope_per_year}/yr`);
      }
    });

  } catch (err) {
    console.error("Map metric mode error:", err);
  }
}

// Map Popup Handlers
function popupInspectTrend(districtName) {
  document.getElementById("district-select").value = districtName;
  loadTrend();
  if (mapInstance) mapInstance.closePopup();
  openTrendModal();
}

function popupSetDistrict1(districtName) {
  document.getElementById("compare-d1-select").value = districtName;
  const compTab = document.querySelector('[data-tab="tab-compare"]');
  if (compTab) compTab.click();
  if (mapInstance) mapInstance.closePopup();
}

function popupSetDistrict2(districtName) {
  document.getElementById("compare-d2-select").value = districtName;
  const compTab = document.querySelector('[data-tab="tab-compare"]');
  if (compTab) compTab.click();
  if (mapInstance) mapInstance.closePopup();
}
