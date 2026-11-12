"""
Pydantic schemas for Earth System Trend Detective API.
Strictly matches the challenge result object and provenance specifications,
with extensions for ML forecasting, Benjamini-Hochberg FDR, QA/QC, and Mirror Finder.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TrendStats(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    S: int = Field(..., description="Mann-Kendall score")
    Z: float = Field(..., description="Standardized Mann-Kendall test statistic")
    p_value: float = Field(..., description="Two-sided p-value")
    direction: str = Field(..., description="'increasing' | 'decreasing' | 'no trend'")
    significant_at_0_05: bool = Field(..., alias="significant_at_0.05", description="Whether p_value < 0.05")
    adjusted_p_value: Optional[float] = Field(None, description="Benjamini-Hochberg FDR adjusted p-value")


class SlopeStats(BaseModel):
    slope_per_year: float = Field(..., description="Theil-Sen slope converted to change per year")
    ci_low: float = Field(..., description="Lower bound of 95% confidence interval")
    ci_high: float = Field(..., description="Upper bound of 95% confidence interval")
    units: str = Field(..., description="Physical units of rate of change")


class Provenance(BaseModel):
    dataset_id: str = Field(..., description="Identifier of the NASA dataset")
    source_url: str = Field(..., description="Source URL of the data product")
    retrieved: str = Field(..., description="ISO 8601 retrieval timestamp")
    mode: str = Field(..., description="'cache' | 'fixture' | 'live'")


class TimeSeriesPoint(BaseModel):
    date: str
    observed: float
    fitted: Optional[float] = None
    ci_lower: Optional[float] = None
    ci_upper: Optional[float] = None


class TrendResult(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    district: str
    variable: str
    period: str
    n_observations: int
    trend: TrendStats
    slope: SlopeStats
    provenance: Provenance
    # Scientific extensions specified in project documentation
    quality_control: Optional[Dict[str, Any]] = None
    baseline_recent: Optional[Dict[str, Any]] = None
    series: Optional[List[TimeSeriesPoint]] = None
    decomposition: Optional[Dict[str, Any]] = None


class DistrictInfo(BaseModel):
    name: str
    lat: float
    lon: float
    division: str
    code: str


class ComparisonResult(BaseModel):
    district1: TrendResult
    district2: TrendResult
    delta_slope: float
    comparison_summary: str
    same_period: bool
    same_units: bool


class NarrationResult(BaseModel):
    verified: bool
    blocked: bool
    block_reason: Optional[str] = None
    narration: Dict[str, Optional[str]]
    sentences: Dict[str, List[str]]


class ForecastResult(BaseModel):
    district: str
    variable: str
    units: str
    model_metadata: Dict[str, Any]
    validation_results: Dict[str, Any]
    forecast_points: List[Dict[str, Any]]


class MirrorFinderResult(BaseModel):
    target_district: str
    mirror_district: str
    variable: str
    target_slope: float
    mirror_slope: float
    divergence_delta: float
    mirror_direction: str
    explanation: str


class SensitivityResult(BaseModel):
    district: str
    variable: str
    units: str
    windows: List[Dict[str, Any]]
