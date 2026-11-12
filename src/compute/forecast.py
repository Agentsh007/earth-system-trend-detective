"""
Machine Learning Forecasting Component for Earth System Trend Detective.
Implements time-ordered train/test splits, baseline comparisons (seasonal persistence),
Ridge regression with harmonic seasonality and lag features, forecast horizons,
and 95% prediction intervals.
Documented as required by Section 6.3 of project specification.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, root_mean_squared_error


def build_forecasting_features(
    series: np.ndarray,
    dates: pd.DatetimeIndex,
    n_lags: int = 3,
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Construct time-ordered features for environmental forecasting:
    - Time trend (normalized index)
    - Harmonic seasonal features (sin/cos of 12-month and 6-month cycles)
    - Autoregressive lag features (lag-1, lag-2, lag-3)
    """
    n = len(series)
    feature_names = ["trend_norm", "sin_annual", "cos_annual", "sin_semiannual", "cos_semiannual"]
    for lag in range(1, n_lags + 1):
        feature_names.append(f"lag_{lag}")

    # Time trend normalized
    t_norm = np.arange(n) / float(n)
    month_of_year = dates.month.to_numpy()

    # Harmonic features
    sin_ann = np.sin(2.0 * np.pi * month_of_year / 12.0)
    cos_ann = np.cos(2.0 * np.pi * month_of_year / 12.0)
    sin_semi = np.sin(4.0 * np.pi * month_of_year / 12.0)
    cos_semi = np.cos(4.0 * np.pi * month_of_year / 12.0)

    # Base matrix
    X_list = []
    y_list = []

    for i in range(n_lags, n):
        row = [t_norm[i], sin_ann[i], cos_ann[i], sin_semi[i], cos_semi[i]]
        for lag in range(1, n_lags + 1):
            row.append(series[i - lag])
        X_list.append(row)
        y_list.append(series[i])

    return np.array(X_list, dtype=float), np.array(y_list, dtype=float), feature_names


def run_ml_forecast(
    series: np.ndarray,
    dates: pd.DatetimeIndex,
    horizon_months: int = 36,
    test_ratio: float = 0.20,
    variable_units: str = "degC",
) -> Dict[str, Any]:
    """
    Train and evaluate ML forecasting model with time-ordered split,
    compare against a naive seasonal persistence baseline, and generate
    future horizon predictions with uncertainty intervals.

    Parameters
    ----------
    series : 1D array of monthly aggregated values
    dates : DatetimeIndex matching series
    horizon_months : int, number of future months to project (default 36)
    test_ratio : float, portion of time series reserved for validation (default 20%)
    variable_units : physical units

    Returns
    -------
    dict containing model metadata, validation scores, baseline comparison,
    and historical + forecasted points with 95% prediction intervals.
    """
    clean_mask = ~np.isnan(series)
    clean_series = series[clean_mask]
    clean_dates = dates[clean_mask]
    n = len(clean_series)

    if n < 36:
        raise ValueError(f"Need at least 36 monthly observations for ML forecasting, got {n}")

    # Build features
    n_lags = 3
    X, y, feature_names = build_forecasting_features(clean_series, clean_dates, n_lags=n_lags)
    valid_dates = clean_dates[n_lags:]
    n_samples = len(y)

    # Time-ordered train/test split (no shuffling to prevent data leakage)
    split_idx = int(n_samples * (1.0 - test_ratio))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    test_dates = valid_dates[split_idx:]

    # Train Ridge Regression
    model = Ridge(alpha=1.0)
    model.fit(X_train, y_train)

    # Evaluate ML Model
    y_pred_test = model.predict(X_test)
    ml_mae = float(mean_absolute_error(y_test, y_pred_test))
    ml_rmse = float(root_mean_squared_error(y_test, y_pred_test))

    # Evaluate Baseline Model: Seasonal Persistence (value from 12 months prior)
    y_baseline = np.zeros_like(y_test)
    for i in range(len(y_test)):
        # Look back 12 steps if available, else mean
        curr_global_idx = split_idx + i
        if curr_global_idx >= 12:
            y_baseline[i] = y[curr_global_idx - 12]
        else:
            y_baseline[i] = np.mean(y_train)

    base_mae = float(mean_absolute_error(y_test, y_baseline))
    base_rmse = float(root_mean_squared_error(y_test, y_baseline))

    # Skill score: percentage reduction in RMSE over baseline
    skill_score_pct = round(((base_rmse - ml_rmse) / (base_rmse + 1e-6)) * 100.0, 1)

    # Fit model on all data for future projection
    model_full = Ridge(alpha=1.0)
    model_full.fit(X, y)
    residuals = y - model_full.predict(X)
    sigma_resid = float(np.std(residuals))

    # Generate Future Horizon Forecast
    future_dates = pd.date_range(clean_dates[-1] + pd.DateOffset(months=1), periods=horizon_months, freq="MS")
    last_known = list(clean_series[-n_lags:])

    future_points = []
    total_len = n + horizon_months

    for step_i, fdate in enumerate(future_dates):
        global_idx = n + step_i
        t_norm_val = global_idx / float(total_len)
        m = fdate.month

        sin_ann = math.sin(2.0 * math.pi * m / 12.0)
        cos_ann = math.cos(2.0 * math.pi * m / 12.0)
        sin_semi = math.sin(4.0 * math.pi * m / 12.0)
        cos_semi = math.cos(4.0 * math.pi * m / 12.0)

        row = [t_norm_val, sin_ann, cos_ann, sin_semi, cos_semi]
        for lag in range(1, n_lags + 1):
            row.append(last_known[-lag])

        x_row = np.array([row])
        pred_val = float(model_full.predict(x_row)[0])
        last_known.append(pred_val)

        # 95% Prediction interval grows slightly with horizon
        horizon_penalty = math.sqrt(1.0 + (step_i / 12.0) * 0.25)
        margin = 1.96 * sigma_resid * horizon_penalty
        pi_low = round(pred_val - margin, 3)
        pi_high = round(pred_val + margin, 3)

        future_points.append({
            "date": fdate.strftime("%Y-%m-%d"),
            "predicted": round(pred_val, 3),
            "pi_low": pi_low,
            "pi_high": pi_high,
        })

    return {
        "model_metadata": {
            "model_type": "Ridge Regression with Autoregressive & Harmonic Seasonality",
            "features_used": feature_names,
            "validation_method": "Time-ordered chronological train/test split (80/20)",
            "forecast_horizon_months": horizon_months,
            "prediction_interval_level": "95%",
            "disclaimer": (
                "Forecasting estimates future statistical possibilities based on historical relationships. "
                "Forecasts do not represent certainties, emergency risk forecasts, or causal explanations."
            ),
        },
        "validation_results": {
            "ml_model_mae": round(ml_mae, 4),
            "ml_model_rmse": round(ml_rmse, 4),
            "baseline_mae": round(base_mae, 4),
            "baseline_rmse": round(base_rmse, 4),
            "skill_score_vs_baseline_pct": skill_score_pct,
            "better_than_baseline": bool(ml_rmse < base_rmse),
        },
        "forecast_points": future_points,
    }

