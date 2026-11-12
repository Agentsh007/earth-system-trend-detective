"""
Deterministic Earth-System Trend Computation Engine.
Implements Mann-Kendall trend test, Theil-Sen robust slope estimator with 95% confidence intervals,
and seasonal time-series decomposition.
NOTE: Pure deterministic scientific computation; no language model computes these values.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Optional, Tuple, Union

import numpy as np
import pandas as pd
from scipy import stats


def mann_kendall_test(
    y: Union[np.ndarray, pd.Series, list],
    alpha: float = 0.05,
) -> Dict[str, Any]:
    """
    Perform the non-parametric Mann-Kendall test for monotonic trends.

    Handles missing values (NaNs) by filtering them out.
    Accounts for ties in observation values using Kendall's variance formula.

    Parameters
    ----------
    y : array-like
        Time series observations (1D). NaNs and None are filtered out.
    alpha : float, default 0.05
        Significance level (e.g., 0.05 for 95% confidence).

    Returns
    -------
    dict
        {
            "S": int,                  # Mann-Kendall score
            "Z": float,                # Standardized test statistic
            "p_value": float,          # Two-sided p-value
            "direction": str,          # "increasing" | "decreasing" | "no trend"
            "significant_at_0.05": bool,
            "tau": float,              # Kendall's tau rank correlation
            "var_s": float,            # Variance of S (accounting for ties)
            "n": int                   # Number of valid observations
        }
    """
    # Convert to numpy array and remove missing values
    arr = np.asarray(y, dtype=float)
    valid_mask = ~np.isnan(arr)
    valid_data = arr[valid_mask]
    n = len(valid_data)

    if n < 3:
        raise ValueError(f"Need at least 3 valid observations for Mann-Kendall test, got {n}")

    # Fast O(N log N) rank-based calculation of S using Fenwick Tree (Binary Indexed Tree)
    # S = concordant pairs - discordant pairs
    unique_vals, inverse = np.unique(valid_data, return_inverse=True)
    m = len(unique_vals)

    # Fenwick tree array (1-indexed, size m + 2)
    bit = np.zeros(m + 2, dtype=np.int64)

    def bit_add(idx: int, val: int) -> None:
        idx += 1
        while idx < len(bit):
            bit[idx] += val
            idx += idx & (-idx)

    def bit_query(idx: int) -> int:
        idx += 1
        s = 0
        while idx > 0:
            s += bit[idx]
            idx -= idx & (-idx)
        return s

    p_pairs = 0  # concordant (valid_data[j] > valid_data[i] for j > i)
    m_pairs = 0  # discordant (valid_data[j] < valid_data[i] for j > i)

    for i, rank in enumerate(inverse):
        less = bit_query(rank - 1)
        equal = bit_query(rank) - less
        greater = i - less - equal
        p_pairs += less
        m_pairs += greater
        bit_add(rank, 1)

    S = int(p_pairs - m_pairs)

    # Calculate variance of S with tie correction
    # Var(S) = [n(n-1)(2n+5) - sum(t_i * (t_i - 1) * (2*t_i + 5))] / 18
    _, counts = np.unique(valid_data, return_counts=True)
    tie_term = np.sum(counts * (counts - 1) * (2 * counts + 5))
    var_s = float((n * (n - 1) * (2 * n + 5) - tie_term) / 18.0)

    # Standardized test statistic Z
    if var_s <= 0.0 or n < 3:
        Z = 0.0
        p_val = 1.0
    else:
        std_s = math.sqrt(var_s)
        if S > 0:
            Z = (S - 1) / std_s
        elif S < 0:
            Z = (S + 1) / std_s
        else:
            Z = 0.0

        # Two-tailed p-value
        # p = 2 * (1 - norm.cdf(|Z|)) = erfc(|Z| / sqrt(2))
        p_val = math.erfc(abs(Z) / math.sqrt(2.0))

    significant = bool(p_val < alpha)

    if significant:
        if S > 0:
            direction = "increasing"
        elif S < 0:
            direction = "decreasing"
        else:
            direction = "no trend"
    else:
        direction = "no trend"

    # Kendall's tau
    total_pairs = (n * (n - 1)) / 2.0
    tau = float(S / total_pairs) if total_pairs > 0 else 0.0

    return {
        "S": int(S),
        "Z": round(float(Z), 4),
        "p_value": round(float(p_val), 6),
        "direction": direction,
        "significant_at_0.05": significant,
        "tau": round(float(tau), 5),
        "var_s": round(float(var_s), 4),
        "n": int(n),
    }


def theil_sen_slope(
    y: Union[np.ndarray, pd.Series, list],
    x: Optional[Union[np.ndarray, pd.Series, list]] = None,
    alpha: float = 0.05,
    is_daily: bool = True,
    units: str = "degC per year",
) -> Dict[str, Any]:
    """
    Compute Theil-Sen robust estimator of slope with 95% confidence interval.

    Handles missing values (NaNs) cleanly.
    If is_daily is True, scales the daily slope by 365.25 days to express
    the trend as change per year.

    Parameters
    ----------
    y : array-like
        Observed values.
    x : array-like, optional
        Time indices or steps. If None, uses np.arange(len(y)).
    alpha : float, default 0.05
        Alpha for (1 - alpha) * 100% confidence interval (default 95% CI).
    is_daily : bool, default True
        Whether time steps are daily (converts to annual slope via * 365.25).
    units : str
        Unit label for the rate of change (e.g. "degC per year", "mm per year").

    Returns
    -------
    dict
        {
            "slope_per_year": float,
            "ci_low": float,
            "ci_high": float,
            "slope_raw": float,
            "intercept": float,
            "units": str
        }
    """
    arr_y = np.asarray(y, dtype=float)
    if x is None:
        arr_x = np.arange(len(arr_y), dtype=float)
    else:
        arr_x = np.asarray(x, dtype=float)

    # Filter out NaNs
    valid = (~np.isnan(arr_y)) & (~np.isnan(arr_x))
    clean_y = arr_y[valid]
    clean_x = arr_x[valid]

    n = len(clean_y)
    if n < 2:
        raise ValueError(f"Need at least 2 valid points for Theil-Sen slope, got {n}")

    # Check for completely flat series
    if np.all(clean_y == clean_y[0]):
        return {
            "slope_per_year": 0.0,
            "ci_low": 0.0,
            "ci_high": 0.0,
            "slope_raw": 0.0,
            "intercept": float(clean_y[0]),
            "units": units,
        }

    # For datasets with n > 4000 points, scipy's O(N^2) theilslopes allocates >30M pairwise floats.
    # We can either use scipy.stats.theilslopes or a fast stratified block-sampled estimator.
    # For exactness with prompt expectations, we use scipy.stats.theilslopes with confidence interval.
    # If n > 3000 and is daily, we can aggregate monthly or calculate cleanly.
    res = stats.theilslopes(clean_y, clean_x, alpha=1.0 - alpha)

    slope_raw = float(res.slope)
    ci_low_raw = float(res.low_slope)
    ci_high_raw = float(res.high_slope)
    intercept = float(res.intercept)

    scale_factor = 365.25 if is_daily else 1.0

    slope_per_year = slope_raw * scale_factor
    ci_low = ci_low_raw * scale_factor
    ci_high = ci_high_raw * scale_factor

    return {
        "slope_per_year": round(float(slope_per_year), 4),
        "ci_low": round(float(ci_low), 4),
        "ci_high": round(float(ci_high), 4),
        "slope_raw": float(slope_raw),
        "intercept": round(float(intercept), 4),
        "units": units,
    }


def seasonal_decomposition(
    series: Union[np.ndarray, pd.Series, list],
    period: int = 365,
    model: str = "additive",
) -> Dict[str, Any]:
    """
    Classical additive or multiplicative seasonal decomposition.
    Decomposes series into: Observed = Trend + Seasonal + Residual (additive).

    Parameters
    ----------
    series : array-like
        Time series data.
    period : int, default 365
        Frequency of the seasonal cycle (e.g. 365 for daily, 12 for monthly).
    model : str, default "additive"
        "additive" (supported).

    Returns
    -------
    dict
        {
            "trend": list[float],
            "seasonal": list[float],
            "residual": list[float],
            "period": int
        }
    """
    arr = np.asarray(series, dtype=float)
    n = len(arr)

    # 1. Trend: centered rolling average
    s = pd.Series(arr)
    # Using window=period centered
    trend_s = s.rolling(window=period, center=True, min_periods=max(2, period // 4)).mean()
    trend = trend_s.bfill().ffill().to_numpy()

    # 2. Detrended series
    detrended = arr - trend

    # 3. Seasonal: average for each position in the period cycle
    indices = np.arange(n) % period
    seasonal_cycle = np.zeros(period, dtype=float)
    for p in range(period):
        vals = detrended[indices == p]
        vals = vals[~np.isnan(vals)]
        seasonal_cycle[p] = np.mean(vals) if len(vals) > 0 else 0.0

    seasonal_cycle -= np.mean(seasonal_cycle)
    seasonal = seasonal_cycle[indices]

    # 4. Residual
    residual = arr - trend - seasonal

    return {
        "trend": [round(float(v), 4) if not np.isnan(v) else None for v in trend],
        "seasonal": [round(float(v), 4) if not np.isnan(v) else None for v in seasonal],
        "residual": [round(float(v), 4) if not np.isnan(v) else None for v in residual],
        "period": period,
    }


def compute_baseline_recent_change(
    series: Union[np.ndarray, pd.Series],
    dates: pd.DatetimeIndex,
    n_years: int = 5,
) -> Dict[str, Any]:
    """
    Calculate baseline-to-recent comparison (Section 4 & 7.3 of project doc):
    Compares initial n_years (e.g. 2001-2005) against most recent n_years (e.g. 2021-2025).
    """
    df = pd.DataFrame({"val": np.asarray(series, dtype=float), "date": dates}).dropna()
    start_year = df["date"].dt.year.min()
    end_year = df["date"].dt.year.max()

    baseline_sub = df[df["date"].dt.year < start_year + n_years]["val"]
    recent_sub = df[df["date"].dt.year > end_year - n_years]["val"]

    base_mean = float(baseline_sub.mean()) if not baseline_sub.empty else 0.0
    rec_mean = float(recent_sub.mean()) if not recent_sub.empty else 0.0
    total_change = rec_mean - base_mean
    pct_change = (total_change / abs(base_mean) * 100.0) if base_mean != 0 else 0.0

    return {
        "baseline_period": f"{start_year}-{start_year + n_years - 1}",
        "baseline_mean": round(base_mean, 3),
        "recent_period": f"{end_year - n_years + 1}-{end_year}",
        "recent_mean": round(rec_mean, 3),
        "total_change": round(total_change, 3),
        "percentage_change": round(pct_change, 2),
    }


def compute_data_quality_coverage(
    series: Union[np.ndarray, pd.Series],
    expected_n: Optional[int] = None,
    min_coverage_pct: float = 70.0,
) -> Dict[str, Any]:
    """
    Evaluate observation coverage and QA/QC status (Section 6.4 of project doc).
    Regions below min_coverage_pct are marked 'insufficient data'.
    """
    arr = np.asarray(series, dtype=float)
    total_count = len(arr) if expected_n is None else expected_n
    valid_count = int(np.sum(~np.isnan(arr)))
    missing_count = int(total_count - valid_count)
    coverage_pct = round((valid_count / max(1, total_count)) * 100.0, 2)

    status = "passed" if coverage_pct >= min_coverage_pct else "insufficient_data"

    return {
        "valid_observations": valid_count,
        "missing_observations": missing_count,
        "coverage_percentage": coverage_pct,
        "status": status,
        "is_sufficient": bool(status == "passed"),
    }


def compute_window_sensitivity(
    series: Union[np.ndarray, pd.Series],
    dates: pd.DatetimeIndex,
    is_daily: bool = True,
    units: str = "degC per year",
) -> List[Dict[str, Any]]:
    """
    Evaluate sensitivity of trend estimates across variable time windows (Section 11).
    Tests 10-year, 15-year, 20-year, and full 25-year windows up to the present.
    """
    df = pd.DataFrame({"val": np.asarray(series, dtype=float), "date": dates}).dropna()
    end_date = df["date"].max()

    windows = [10, 15, 20, 25]
    results = []

    for w in windows:
        start_w = end_date - pd.DateOffset(years=w)
        sub_df = df[df["date"] >= start_w]
        if len(sub_df) < 30:
            continue
        sub_y = sub_df["val"].to_numpy()
        ts = theil_sen_slope(sub_y, is_daily=is_daily, units=units)
        mk = mann_kendall_test(sub_y)

        results.append({
            "window_years": w,
            "period": f"{sub_df['date'].min().strftime('%Y')} to {end_date.strftime('%Y')}",
            "slope_per_year": ts["slope_per_year"],
            "ci_low": ts["ci_low"],
            "ci_high": ts["ci_high"],
            "p_value": mk["p_value"],
            "direction": mk["direction"],
            "significant": mk["significant_at_0.05"],
        })

    return results

