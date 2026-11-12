"""
Benjamini-Hochberg False Discovery Rate (FDR) Multiple Testing Correction.
Used across multiple spatial regions/cells to control false positive rates
when simultaneously evaluating trends across all 64 districts in Bangladesh.
"""

from __future__ import annotations

from typing import Any, Dict, List
import numpy as np


def benjamini_hochberg_correction(
    results: List[Dict[str, Any]],
    alpha: float = 0.05,
    p_key: str = "p_value",
) -> List[Dict[str, Any]]:
    """
    Apply Benjamini-Hochberg procedure to adjust p-values and control FDR at rate alpha.

    Parameters
    ----------
    results : List of district trend dictionaries, each containing p-value.
    alpha : Desired False Discovery Rate threshold (default 0.05).
    p_key : Key where p-value is located (e.g., 'p_value' or nested).

    Returns
    -------
    List of results with added 'adjusted_p_value' and 'significant_fdr' fields.
    """
    m = len(results)
    if m == 0:
        return []

    # Extract p-values
    p_vals = []
    for r in results:
        val = r.get(p_key)
        if val is None and "trend" in r:
            val = r["trend"].get("p_value", 1.0)
        p_vals.append(float(val if val is not None else 1.0))

    p_arr = np.array(p_vals, dtype=float)
    # Sort order
    sorted_indices = np.argsort(p_arr)
    sorted_p = p_arr[sorted_indices]

    # Adjusted p-value formula: p_adj(i) = min_{k >= i} (p(k) * m / k)
    q_vals = np.zeros(m, dtype=float)
    cumulative_min = 1.0

    # Step down from highest rank to lowest
    for k in range(m, 0, -1):
        idx = k - 1
        raw_q = sorted_p[idx] * (float(m) / float(k))
        cumulative_min = min(cumulative_min, raw_q)
        q_vals[idx] = min(1.0, cumulative_min)

    # Map adjusted values back to original ordering
    adj_p_ordered = np.zeros(m, dtype=float)
    adj_p_ordered[sorted_indices] = q_vals

    enriched_results = []
    for i, item in enumerate(results):
        item_copy = dict(item)
        adj_p = round(float(adj_p_ordered[i]), 6)
        item_copy["adjusted_p_value"] = adj_p
        item_copy["significant_fdr"] = bool(adj_p < alpha)
        enriched_results.append(item_copy)

    return enriched_results

