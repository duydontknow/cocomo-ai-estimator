from typing import Dict, Optional

# ====================== LANGUAGE BACKFIRING TABLE ======================
# Source: QSM/ISBSG - 1 FP equals how many SLOC in each language
LANGUAGE_BACKFIRING = {
    "Assembly":   320,
    "C":          128,
    "HTML":        40,
    "C++":         64,
    "Java":        53,
    "Python":      40,
    "C#":          58,
    "SQL":         21,
    "JavaScript":  47,
}

# ====================== INTERMEDIATE COCOMO CONSTANTS ======================
# Intermediate COCOMO formulas:
#   Effort (PM) = a * (KLOC)^b * EAF
#   TDEV  (Mo) = c * (E)^d
#   Staff (FSP) = E / TDEV
#
# Coefficients per Boehm 1981, Table 8.1 (Intermediate COCOMO)
COCOMO_CONSTANTS = {
    "organic":       {"a": 2.4, "b": 1.05, "c": 2.5, "d": 0.38},
    "semi-detached": {"a": 3.0, "b": 1.12, "c": 2.5, "d": 0.35},
    "embedded":      {"a": 3.6, "b": 1.20, "c": 2.5, "d": 0.32},
}

# ====================== STANDARD EAF RATINGS TABLE ======================
# Maps cost driver IDs to valid rating multipliers (Boehm 1981, Table 8.2)
COST_DRIVER_RATINGS = {
    "RELY": {"Very Low": 0.75, "Low": 0.88, "Nominal": 1.00, "High": 1.15, "Very High": 1.40},
    "DATA": {                  "Low": 0.94, "Nominal": 1.00, "High": 1.08, "Very High": 1.16},
    "CPLX": {"Very Low": 0.70, "Low": 0.85, "Nominal": 1.00, "High": 1.15, "Very High": 1.30, "Extra High": 1.65},
    "TIME": {                               "Nominal": 1.00, "High": 1.11, "Very High": 1.30, "Extra High": 1.66},
    "STOR": {                               "Nominal": 1.00, "High": 1.06, "Very High": 1.21, "Extra High": 1.56},
    "VIRT": {                  "Low": 0.87, "Nominal": 1.00, "High": 1.15, "Very High": 1.30},
    "TURN": {                  "Low": 0.87, "Nominal": 1.00, "High": 1.07, "Very High": 1.15},
    "ACAP": {"Very Low": 1.46, "Low": 1.19, "Nominal": 1.00, "High": 0.86, "Very High": 0.71},
    "AEXP": {"Very Low": 1.29, "Low": 1.13, "Nominal": 1.00, "High": 0.91, "Very High": 0.82},
    "PCAP": {"Very Low": 1.42, "Low": 1.17, "Nominal": 1.00, "High": 0.86, "Very High": 0.70},
    "VEXP": {"Very Low": 1.21, "Low": 1.10, "Nominal": 1.00, "High": 0.90},
    "LEXP": {"Very Low": 1.14, "Low": 1.07, "Nominal": 1.00, "High": 0.95},
    "MODP": {"Very Low": 1.24, "Low": 1.10, "Nominal": 1.00, "High": 0.91, "Very High": 0.82},
    "TOOL": {"Very Low": 1.24, "Low": 1.10, "Nominal": 1.00, "High": 0.91, "Very High": 0.83},
    "SCED": {"Very Low": 1.23, "Low": 1.08, "Nominal": 1.00, "High": 1.04, "Very High": 1.10},
}


def calculate_cocomo(
    kloc: Optional[float],
    mode: str,
    eaf_dict: Dict[str, float],
    salary: float,
    fp: Optional[float] = None,
    language: Optional[str] = None,
) -> dict:
    """
    Intermediate COCOMO estimation.

    STEP 1: Determine size (KLOC) — directly or via FP Backfiring
    STEP 2: Select project mode (Organic / Semi-detached / Embedded)
    STEP 3: Evaluate 15 Cost Drivers
    STEP 4: Compute EAF (product of all cost driver multipliers)
    STEP 5: Apply COCOMO formulas → Effort, Time, Cost, Staff
    STEP 6: Return estimation report
    """

    # ── STEP 1: Determine size ───────────────────────────────────────────
    if kloc is not None and kloc > 0:
        final_kloc = kloc
    elif fp is not None and fp > 0 and language:
        factor = LANGUAGE_BACKFIRING.get(language, 50)
        final_kloc = (fp * factor) / 1000.0
    else:
        raise ValueError(
            "Thiếu dữ liệu kích thước dự án — cung cấp KLOC hoặc cặp (FP + Language)"
        )

    # ── STEP 2: Resolve project mode ─────────────────────────────────────
    constants = COCOMO_CONSTANTS.get(mode.lower())
    if not constants:
        raise ValueError(
            f"Project mode '{mode}' không hợp lệ. Chọn: organic, semi-detached, embedded"
        )

    # ── STEP 3 & 4: Compute EAF ──────────────────────────────────────────
    # EAF = product of all 15 cost driver multiplier values
    eaf = 1.0
    for value in eaf_dict.values():
        eaf *= float(value)

    # ── STEP 5: Apply Intermediate COCOMO formulas ───────────────────────
    # Effort E  = a × (KLOC)^b × EAF          [Person-Months]
    effort = constants["a"] * (final_kloc ** constants["b"]) * eaf

    # Dev Time TDEV = c × (E)^d               [Months]
    time = constants["c"] * (effort ** constants["d"])

    # Estimated Cost = E × avg monthly salary  [USD]
    cost = effort * salary

    # Required Staff (FSP) = E / TDEV
    staff = effort / time if time > 0 else 0

    # ── STEP 6: Return structured estimation report ───────────────────────
    return {
        "final_kloc":               round(final_kloc, 2),
        "effort_person_months":     round(effort, 2),
        "development_time_months":  round(time, 2),
        "estimated_cost":           round(cost, 2),
        "required_staff":           round(staff, 1),
        "eaf_applied":              round(eaf, 4),   # keep 4dp so test assertions can be tighter
    }
