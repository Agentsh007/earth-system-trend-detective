"""
Unit tests for the Bilingual Narration Agent and Anti-Hallucination Guard.
Verifies:
1. Exact 2-sentence English and Bangla output from tool result
2. Verification passes when all numbers match the tool result
3. Verification strictly BLOCKS output if any number is hallucinated
"""

from src.agent.narration import generate_bilingual_narration, verify_narration_numbers

BENCHMARK_RESULT = {
    "district": "Rajshahi",
    "variable": "T2M",
    "period": "2001-01-01 to 2025-12-31",
    "n_observations": 9131,
    "trend": {
        "S": 41230,
        "Z": 3.61,
        "p_value": 0.0003,
        "direction": "increasing",
        "significant_at_0.05": True,
    },
    "slope": {
        "slope_per_year": 0.031,
        "ci_low": 0.014,
        "ci_high": 0.048,
        "units": "degC per year",
    },
    "provenance": {
        "dataset_id": "NASA POWER daily point",
        "source_url": "https://power.larc.nasa.gov/api/temporal/daily/point",
        "retrieved": "2026-11-02T09:14:00Z",
        "mode": "cache",
    },
}


def test_narration_generation_and_verification():
    """Test standard narration generation on benchmark result."""
    out = generate_bilingual_narration(BENCHMARK_RESULT)
    assert out["verified"] is True
    assert out["blocked"] is False
    assert out["block_reason"] is None

    # Check English narration
    en_sentences = out["sentences"]["english"]
    assert len(en_sentences) == 2
    assert "Rajshahi" in out["narration"]["english"]
    assert "0.031" in out["narration"]["english"]
    assert "3.61" in out["narration"]["english"]
    assert "9131" in out["narration"]["english"]

    # Check Bangla narration
    bn_sentences = out["sentences"]["bangla"]
    assert len(bn_sentences) == 2
    assert "০.০৩১" in out["narration"]["bangla"]
    assert "৩.৬১" in out["narration"]["bangla"]
    assert "৯১৩১" in out["narration"]["bangla"]


def test_anti_hallucination_blocking():
    """Test that any stated number absent from result blocks the narration."""
    # Narration with hallucinated warming number 99.88
    hallucinated_text = (
        "Between 2001 and 2025, Rajshahi showed a temperature rise of 99.88 degC per year. "
        "The Mann-Kendall test recorded a Z-score of 3.61 across 9131 observations."
    )
    is_valid, err = verify_narration_numbers(hallucinated_text, BENCHMARK_RESULT)
    assert is_valid is False
    assert "Hallucinated number detected: '99.88'" in err

    # Narration with hallucinated Bangla number
    hallucinated_bn = (
        "২০০১ থেকে ২০২৫ সালের মধ্যে তাপমাত্রা ৭৭.৫৫ বৃদ্ধি পেয়েছে। "
        "জেড-স্কোর ছিল ৩.৬১।"
    )
    is_valid_bn, err_bn = verify_narration_numbers(hallucinated_bn, BENCHMARK_RESULT)
    assert is_valid_bn is False
    assert "Hallucinated number detected: '77.55'" in err_bn

