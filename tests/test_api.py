"""
Unit tests for FastAPI endpoints in Earth System Trend Detective.
Tests offline cache reads, provenance metadata, comparison, gridded Zarr data,
bilingual narration, and CSV/GeoJSON export.
"""

from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


def test_health_endpoint():
    """Test health check returns healthy and offline mode flag."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["offline_mode"] is True
    assert data["total_districts"] == 64


def test_districts_endpoint():
    """Test districts endpoint returns all 64 Bangladesh districts."""
    response = client.get("/districts")
    assert response.status_code == 200
    districts = response.json()
    assert len(districts) == 64
    names = [d["name"] for d in districts]
    assert "Rajshahi" in names
    assert "Dhaka" in names
    assert "Chattogram" in names
    assert "Sylhet" in names


def test_variables_endpoint():
    """Test variable catalog metadata."""
    response = client.get("/variables")
    assert response.status_code == 200
    data = response.json()
    assert "T2M" in data
    assert "PRECTOTCORR" in data
    assert "ALLSKY_SFC_SW_DWN" in data
    assert "ndvi" in data


def test_benchmark_trend_endpoint():
    """Test GET /trend for canonical benchmark query (Rajshahi T2M 2001-2025)."""
    response = client.get("/trend?district=Rajshahi&variable=T2M&start=2001-01-01&end=2025-12-31")
    assert response.status_code == 200
    data = response.json()

    assert data["district"] == "Rajshahi"
    assert data["variable"] == "T2M"
    assert data["period"] == "2001-01-01 to 2025-12-31"
    assert data["n_observations"] == 9131

    # Trend stats
    assert data["trend"]["S"] == 41230
    assert data["trend"]["Z"] == 3.61
    assert data["trend"]["p_value"] == 0.0003
    assert data["trend"]["direction"] == "increasing"
    assert data["trend"]["significant_at_0.05"] is True

    # Slope stats
    assert data["slope"]["slope_per_year"] == 0.031
    assert data["slope"]["ci_low"] == 0.014
    assert data["slope"]["ci_high"] == 0.048
    assert data["slope"]["units"] == "degC per year"

    # Provenance block
    assert data["provenance"]["dataset_id"] == "NASA POWER daily point"
    assert data["provenance"]["source_url"] == "https://power.larc.nasa.gov/api/temporal/daily/point"
    assert data["provenance"]["mode"] in ["cache", "fixture"]

    # Series & decomposition for UI
    assert "series" in data
    assert len(data["series"]) > 0
    assert "decomposition" in data


def test_custom_district_trend():
    """Test GET /trend on another district (e.g. Dhaka) runs deterministically."""
    response = client.get("/trend?district=Dhaka&variable=PRECTOTCORR&start=2010-01-01&end=2020-12-31")
    assert response.status_code == 200
    data = response.json()

    assert data["district"] == "Dhaka"
    assert data["variable"] == "PRECTOTCORR"
    assert "slope_per_year" in data["slope"]
    assert "direction" in data["trend"]
    assert data["provenance"]["mode"] in ["cache", "fixture"]


def test_compare_districts():
    """Test regional comparison endpoint."""
    response = client.get("/compare?district1=Rajshahi&district2=Dhaka&variable=T2M")
    assert response.status_code == 200
    data = response.json()

    assert data["district1"]["district"] == "Rajshahi"
    assert data["district2"]["district"] == "Dhaka"
    assert "delta_slope" in data
    assert data["same_period"] is True
    assert data["same_units"] is True
    assert len(data["comparison_summary"]) > 0


def test_gridded_zarr_endpoint():
    """Test reading 2D slice from gridded Zarr store."""
    response = client.get("/gridded?variable=ndvi&time_index=0")
    assert response.status_code == 200
    data = response.json()

    assert data["variable"] == "ndvi"
    assert len(data["lats"]) > 0
    assert len(data["lons"]) > 0
    assert len(data["grid"]) == len(data["lats"])
    assert len(data["grid"][0]) == len(data["lons"])
    assert data["provenance"]["mode"] == "cache"


def test_narration_endpoint():
    """Test bilingual narration endpoint with anti-hallucination verification."""
    response = client.get("/narration?district=Rajshahi&variable=T2M")
    assert response.status_code == 200
    data = response.json()

    assert data["verified"] is True
    assert data["blocked"] is False
    assert len(data["sentences"]["english"]) == 2
    assert len(data["sentences"]["bangla"]) == 2


def test_export_csv_and_geojson():
    """Test CSV and GeoJSON export endpoints."""
    # CSV
    res_csv = client.get("/export?district=Rajshahi&variable=T2M&format=csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]
    assert "date,observed,fitted_theil_sen" in res_csv.text

    # GeoJSON
    res_geojson = client.get("/export?district=Rajshahi&variable=T2M&format=geojson")
    assert res_geojson.status_code == 200
    assert "application/geo+json" in res_geojson.headers["content-type"]
    geo_data = res_geojson.json()
    assert geo_data["type"] == "FeatureCollection"
    assert geo_data["features"][0]["geometry"]["type"] == "Point"
    assert geo_data["features"][0]["properties"]["district"] == "Rajshahi"


def test_ml_forecast_endpoint():
    """Test ML forecasting endpoint with time-ordered split and prediction intervals."""
    res = client.get("/forecast?district=Rajshahi&variable=T2M&horizon_months=24")
    assert res.status_code == 200
    data = res.json()
    assert data["district"] == "Rajshahi"
    assert "model_metadata" in data
    assert "validation_results" in data
    assert "ml_model_rmse" in data["validation_results"]
    assert "baseline_rmse" in data["validation_results"]
    assert len(data["forecast_points"]) == 24
    assert "pi_low" in data["forecast_points"][0]
    assert "pi_high" in data["forecast_points"][0]


def test_mirror_finder_endpoint():
    """Test Mirror Finder opposite-trend detection across Bangladesh with leaderboard and driver card."""
    res = client.get("/mirror-finder?district=Rajshahi&variable=T2M")
    assert res.status_code == 200
    data = res.json()
    assert data["target_district"] == "Rajshahi"
    assert "mirror_district" in data
    assert "divergence_delta" in data
    assert len(data["explanation"]) > 0
    assert "top_pairs" in data
    assert len(data["top_pairs"]) == 5
    assert data["top_pairs"][0]["rank"] == 1
    assert "shared_driver" in data
    assert "title_en" in data["shared_driver"]
    assert "title_bn" in data["shared_driver"]
    assert "mechanism_en" in data["shared_driver"]
    assert "mechanism_bn" in data["shared_driver"]


def test_gridded_timeseries_endpoint():
    """Test gridded Zarr point-and-click time series extraction."""
    res = client.get("/gridded/timeseries?variable=ndvi&lat=23.8&lon=90.3")
    assert res.status_code == 200
    data = res.json()
    assert data["variable"] == "ndvi"
    assert data["n_steps"] == 300
    assert len(data["series"]) == 300
    assert "trend" in data
    assert "slope_per_year" in data["trend"]
    assert "summary" in data
    assert "mean" in data["summary"]


def test_window_sensitivity_endpoint():
    """Test moving/expanding window sensitivity analysis."""
    res = client.get("/sensitivity?district=Rajshahi&variable=T2M")
    assert res.status_code == 200
    data = res.json()
    assert data["district"] == "Rajshahi"
    assert len(data["windows"]) >= 3
    assert data["windows"][0]["window_years"] in [10, 15, 20, 25]


def test_qa_qc_and_baseline_recent():
    """Test that QA/QC coverage and baseline-recent metrics are present in /trend."""
    res = client.get("/trend?district=Rajshahi&variable=T2M")
    assert res.status_code == 200
    data = res.json()
    assert "quality_control" in data
    assert data["quality_control"]["status"] == "passed"
    assert data["quality_control"]["coverage_percentage"] > 90.0
    assert "baseline_recent" in data
    assert "total_change" in data["baseline_recent"]


def test_error_handling():
    """Test error handling for unrecognized district and variable."""
    res_bad_dist = client.get("/trend?district=Atlantis&variable=T2M")
    assert res_bad_dist.status_code == 404

    res_bad_var = client.get("/trend?district=Rajshahi&variable=KRYPTONITE")
    assert res_bad_var.status_code == 400
