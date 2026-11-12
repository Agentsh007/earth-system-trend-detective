"""
Unit tests for deterministic trend computation engine (Mann-Kendall, Theil-Sen, Seasonal Decomposition).
Tests against:
1. A known increasing series
2. A known flat series
3. A series with missing values (NaNs)
4. A known decreasing series
5. Seasonal decomposition properties
6. Edge cases and tie corrections
"""

import math
import numpy as np
import pytest

from src.compute.trend import (
    mann_kendall_test,
    theil_sen_slope,
    seasonal_decomposition,
)


def test_known_increasing_series():
    """Test Mann-Kendall and Theil-Sen on a known strictly increasing series."""
    # 15 strictly increasing numbers
    y = np.linspace(10.0, 25.0, 15)
    
    # 1. Mann-Kendall test
    mk = mann_kendall_test(y, alpha=0.05)
    
    # For n=15 strictly increasing, S = n*(n-1)/2 = 105
    assert mk["S"] == 105
    assert mk["Z"] > 0
    assert mk["p_value"] < 0.001
    assert mk["direction"] == "increasing"
    assert mk["significant_at_0.05"] is True
    assert mk["tau"] == 1.0
    assert mk["n"] == 15

    # 2. Theil-Sen slope
    # With is_daily=False to test pure unit slope
    ts = theil_sen_slope(y, alpha=0.05, is_daily=False, units="units per step")
    expected_slope = (25.0 - 10.0) / 14.0
    assert math.isclose(ts["slope_per_year"], round(expected_slope, 4), abs_tol=1e-4)
    assert ts["ci_low"] > 0.0
    assert ts["ci_high"] >= ts["slope_per_year"]
    assert ts["units"] == "units per step"


def test_known_flat_series():
    """Test Mann-Kendall and Theil-Sen on a known flat (constant) series."""
    y = np.array([5.0] * 20)
    
    # 1. Mann-Kendall test
    mk = mann_kendall_test(y, alpha=0.05)
    assert mk["S"] == 0
    assert mk["Z"] == 0.0
    assert mk["p_value"] == 1.0
    assert mk["direction"] == "no trend"
    assert mk["significant_at_0.05"] is False
    assert mk["tau"] == 0.0
    assert mk["n"] == 20

    # 2. Theil-Sen slope
    ts = theil_sen_slope(y, alpha=0.05, is_daily=False)
    assert ts["slope_per_year"] == 0.0
    assert ts["ci_low"] == 0.0
    assert ts["ci_high"] == 0.0
    assert math.isclose(ts["intercept"], 5.0, abs_tol=1e-5)


def test_series_with_missing_values():
    """Test that missing values (NaNs) are handled gracefully without errors."""
    y = np.array([
        1.0, np.nan, 2.5, 3.8, np.nan,
        5.1, 6.4, np.nan, 8.0, 9.5, 10.9
    ])
    
    # 1. Mann-Kendall test
    mk = mann_kendall_test(y, alpha=0.05)
    # Total valid points: 11 - 3 = 8
    assert mk["n"] == 8
    assert mk["S"] > 0
    assert mk["direction"] == "increasing"
    assert mk["significant_at_0.05"] is True

    # 2. Theil-Sen slope with NaNs
    ts = theil_sen_slope(y, alpha=0.05, is_daily=False)
    assert ts["slope_per_year"] > 0.0
    assert ts["ci_low"] > 0.0
    assert ts["ci_high"] > ts["ci_low"]


def test_known_decreasing_series():
    """Test Mann-Kendall and Theil-Sen on a known strictly decreasing series."""
    y = np.array([50.0, 45.0, 40.0, 35.0, 30.0, 25.0, 20.0, 15.0, 10.0, 5.0])
    
    mk = mann_kendall_test(y, alpha=0.05)
    assert mk["S"] == -45
    assert mk["Z"] < 0
    assert mk["p_value"] < 0.01
    assert mk["direction"] == "decreasing"
    assert mk["significant_at_0.05"] is True

    ts = theil_sen_slope(y, alpha=0.05, is_daily=False)
    assert ts["slope_per_year"] < 0.0
    assert ts["ci_high"] < 0.0


def test_seasonal_decomposition():
    """Test seasonal decomposition on synthetic additive series."""
    np.random.seed(42)
    n = 365 * 3
    t = np.arange(n)
    
    trend_comp = 0.02 * t + 10.0
    seasonal_comp = 5.0 * np.sin(2.0 * np.pi * t / 365.0)
    noise = np.random.normal(0.0, 0.2, n)
    y = trend_comp + seasonal_comp + noise

    decomp = seasonal_decomposition(y, period=365, model="additive")
    
    trend = np.array(decomp["trend"])
    seasonal = np.array(decomp["seasonal"])
    residual = np.array(decomp["residual"])
    
    # Check dimensions
    assert len(trend) == n
    assert len(seasonal) == n
    assert len(residual) == n

    # Check additive reconstruction: y ~ trend + seasonal + residual
    reconstructed = trend + seasonal + residual
    max_err = np.max(np.abs(y - reconstructed))
    assert max_err < 1e-3, f"Additive reconstruction error too high: {max_err}"

    # Check that seasonal component averages to approximately zero over a cycle
    cycle_mean = np.mean(seasonal[:365])
    assert abs(cycle_mean) < 0.01, f"Seasonal cycle mean is not zero: {cycle_mean}"


def test_insufficient_data_error():
    """Test that ValueError is raised when series has fewer than 3 points."""
    with pytest.raises(ValueError):
        mann_kendall_test([1.0, 2.0])
    with pytest.raises(ValueError):
        theil_sen_slope([1.0])

