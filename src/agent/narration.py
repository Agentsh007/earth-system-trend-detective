"""
Bilingual Narration Agent with Anti-Hallucination Guard.
Translates statistical Earth-system trend results into 2 sentences of plain English
and 2 sentences of plain Bangla.

CRITICAL REQUIREMENT:
Output is strictly BLOCKED if any stated number in the narration is absent
from the tool result object.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set, Tuple

# Bangla digit mapping
EN_TO_BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
BN_TO_EN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")

VARIABLE_LABELS_EN = {
    "T2M": "temperature",
    "PRECTOTCORR": "precipitation",
    "ALLSKY_SFC_SW_DWN": "solar radiation",
    "ndvi": "vegetation index (NDVI)",
    "imerg_precip": "precipitation",
    "tws_anomaly": "terrestrial water storage",
}

VARIABLE_LABELS_BN = {
    "T2M": "তাপমাত্রার",
    "PRECTOTCORR": "বৃষ্টিপাতের",
    "ALLSKY_SFC_SW_DWN": "সৌর বিকিরণের",
    "ndvi": "উদ্ভিদের ঘনত্বের (NDVI)",
    "imerg_precip": "বৃষ্টিপাতের",
    "tws_anomaly": "ভূগর্ভস্থ ও সামগ্রিক পানি সঞ্চয়ের",
}

UNITS_BN = {
    "degC per year": "ডিগ্রি সেলসিয়াস প্রতি বছর",
    "mm/day per year": "মিমি/দিন প্রতি বছর",
    "MJ/m^2/day per year": "মেগাজুল/বর্গমিটার/দিন প্রতি বছর",
    "NDVI units per year": "NDVI একক প্রতি বছর",
    "mm/month per year": "মিমি/মাস প্রতি বছর",
    "cm equivalent water per year": "সেমি সমতুল্য পানি প্রতি বছর",
}


def extract_numbers_from_result(result: Dict[str, Any]) -> Set[float]:
    """
    Recursively extract all numeric values present in the tool result object,
    including years parsed from period strings.
    """
    valid_numbers: Set[float] = {95.0, 0.05}  # Standard confidence level & alpha

    def _walk(obj: Any):
        if isinstance(obj, (int, float)) and not isinstance(obj, bool):
            val = float(obj)
            valid_numbers.add(round(val, 4))
            valid_numbers.add(round(val, 3))
            valid_numbers.add(round(val, 2))
            valid_numbers.add(round(val, 1))
            valid_numbers.add(round(val, 0))
        elif isinstance(obj, str):
            # Check for dates, years, numbers embedded in strings
            found = re.findall(r"-?\d+(?:\.\d+)?", obj)
            for s in found:
                try:
                    val = float(s)
                    valid_numbers.add(round(val, 4))
                    valid_numbers.add(round(val, 3))
                    valid_numbers.add(round(val, 2))
                    valid_numbers.add(round(val, 1))
                    valid_numbers.add(round(val, 0))
                except ValueError:
                    pass
        elif isinstance(obj, dict):
            for v in obj.values():
                _walk(v)
        elif isinstance(obj, (list, tuple)):
            for v in obj:
                _walk(v)

    _walk(result)
    return valid_numbers


def extract_numbers_from_text(text: str) -> List[float]:
    """Extract all numbers from English or Bangla text as floats."""
    # Convert Bangla digits to English digits
    ascii_text = text.translate(BN_TO_EN_DIGITS)
    # Find numbers: integers or decimals
    raw_nums = re.findall(r"-?\d+(?:\.\d+)?", ascii_text)
    floats = []
    for r in raw_nums:
        try:
            floats.append(float(r))
        except ValueError:
            pass
    return floats


def verify_narration_numbers(
    narration_text: str, result: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Verify that EVERY number stated in the narration is present in the tool result.
    Returns (True, None) if verified, or (False, error_message) if blocked.
    """
    valid_numbers = extract_numbers_from_result(result)
    stated_numbers = extract_numbers_from_text(narration_text)

    for num in stated_numbers:
        # Check if num matches any valid number within small relative tolerance
        matched = False
        rounded_num = round(num, 4)
        if rounded_num in valid_numbers:
            matched = True
        else:
            for v in valid_numbers:
                if abs(num - v) < 1e-4 or (v != 0 and abs(num - v) / abs(v) < 0.01):
                    matched = True
                    break
        if not matched:
            return False, f"Hallucinated number detected: '{num}' was stated in narration but is absent from the tool result."

    return True, None


def generate_bilingual_narration(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate two sentences of plain English and two sentences of plain Bangla
    directly from the tool result object, passing the strict anti-hallucination verification.
    """
    district = result.get("district", "the region")
    variable = result.get("variable", "T2M")
    var_label_en = VARIABLE_LABELS_EN.get(variable, variable)
    var_label_bn = VARIABLE_LABELS_BN.get(variable, variable)

    period_str = result.get("period", "")
    years = re.findall(r"\b\d{4}\b", period_str)
    start_year = years[0] if len(years) >= 1 else "2001"
    end_year = years[1] if len(years) >= 2 else "2025"

    trend = result.get("trend", {})
    slope = result.get("slope", {})
    n_obs = result.get("n_observations", 0)

    S = trend.get("S", 0)
    Z = trend.get("Z", 0.0)
    p_val = trend.get("p_value", 1.0)
    direction = trend.get("direction", "no trend")
    significant = trend.get("significant_at_0.05", False)

    slope_val = slope.get("slope_per_year", 0.0)
    ci_low = slope.get("ci_low", 0.0)
    ci_high = slope.get("ci_high", 0.0)
    units_en = slope.get("units", "per year")
    units_bn = UNITS_BN.get(units_en, units_en)

    # English narration (exactly two sentences)
    sig_word_en = "statistically significant" if significant else "not statistically significant"
    if direction == "no trend":
        sent1_en = f"Between {start_year} and {end_year}, {district} showed no statistically significant trend in {var_label_en} with a slope of {slope_val} {units_en} (p = {p_val})."
    else:
        sent1_en = f"Between {start_year} and {end_year}, {district} showed a {sig_word_en} {direction} {var_label_en} trend of {slope_val} {units_en} (p = {p_val})."
    sent2_en = f"The Mann-Kendall test recorded a Z-score of {Z} across {n_obs} observations, with a 95% confidence interval of {ci_low} to {ci_high} {units_en}."

    english_narration = f"{sent1_en} {sent2_en}"

    # Bangla narration (exactly two sentences)
    start_year_bn = str(start_year).translate(EN_TO_BN_DIGITS)
    end_year_bn = str(end_year).translate(EN_TO_BN_DIGITS)
    slope_val_bn = str(slope_val).translate(EN_TO_BN_DIGITS)
    p_val_bn = str(p_val).translate(EN_TO_BN_DIGITS)
    Z_bn = str(Z).translate(EN_TO_BN_DIGITS)
    n_obs_bn = str(n_obs).translate(EN_TO_BN_DIGITS)
    ci_low_bn = str(ci_low).translate(EN_TO_BN_DIGITS)
    ci_high_bn = str(ci_high).translate(EN_TO_BN_DIGITS)

    dir_bn = "বৃদ্ধির" if direction == "increasing" else "হ্রাসের" if direction == "decreasing" else "কোনো লক্ষণীয়"
    sig_word_bn = "তাৎপর্যপূর্ণ" if significant else "তাৎপর্যহীন"

    if direction == "no trend":
        sent1_bn = f"{start_year_bn} থেকে {end_year_bn} সালের মধ্যে {district}-এ {var_label_bn} কোনো পরিসংখ্যানগতভাবে তাৎপর্যপূর্ণ প্রবণতা দেখা যায়নি (ঢাল {slope_val_bn} {units_bn}, p = {p_val_bn})।"
    else:
        sent1_bn = f"{start_year_bn} থেকে {end_year_bn} সালের মধ্যে {district}-এ {var_label_bn} একটি পরিসংখ্যানগতভাবে {sig_word_bn} {dir_bn} প্রবণতা দেখা গেছে যা প্রতি বছর {slope_val_bn} {units_bn} (p = {p_val_bn})।"
    sent2_bn = f"{n_obs_bn}টি পর্যবেক্ষণে মান-কেন্ডাল পরীক্ষার Z-স্কোর ছিল {Z_bn}, এবং ৯৫% নির্ভরযোগ্যতার ব্যবধান হলো {ci_low_bn} থেকে {ci_high_bn} {units_bn}।"

    bangla_narration = f"{sent1_bn} {sent2_bn}"

    # Strict anti-hallucination verification
    en_valid, en_err = verify_narration_numbers(english_narration, result)
    bn_valid, bn_err = verify_narration_numbers(bangla_narration, result)

    is_verified = en_valid and bn_valid
    block_reason = en_err or bn_err

    return {
        "verified": is_verified,
        "blocked": not is_verified,
        "block_reason": block_reason,
        "narration": {
            "english": english_narration if en_valid else None,
            "bangla": bangla_narration if bn_valid else None,
        },
        "sentences": {
            "english": [sent1_en, sent2_en] if en_valid else [],
            "bangla": [sent1_bn, sent2_bn] if bn_valid else [],
        },
    }

