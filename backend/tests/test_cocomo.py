"""
tests/test_cocomo.py — Test suite cho COCOMO Calculation Engine + Risk Analyzer.

Test Cases:
  1.  Organic 10 KLOC, all Nominal EAF (hand-calculated)
  2.  Semi-detached 50 KLOC với elevated drivers (yêu cầu đồ án)
  3.  FP → KLOC Backfiring (Python)
  4.  FP → KLOC Backfiring (Java)
  5.  Invalid mode → ValueError
  6.  No size input → ValueError
  7.  Embedded high-stress (sanity check)
  8.  Organic 50 KLOC all Nominal (benchmark từ đồ án)
  9.  EAF < 1.0 (tất cả drivers tích cực)
  10. Risk analyzer nhận diện CPLX high
  11. Risk analyzer nhận diện dự án lớn
  12. Risk analyzer với EAF tổng hợp cao > 1.5
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.cocomo import calculate_cocomo
from services.risk import analyze_risks

# ─── Helper: All-Nominal EAF dict ───────────────────────────────────────────
NOMINAL = {k: 1.0 for k in
           ["RELY", "DATA", "CPLX", "TIME", "STOR", "VIRT", "TURN",
            "ACAP", "AEXP", "PCAP", "VEXP", "LEXP", "MODP", "TOOL", "SCED"]}


# ════════════════════════════════════════════════════════════════════════════
# COCOMO ENGINE TESTS
# ════════════════════════════════════════════════════════════════════════════

class TestOrganicProject:
    """Test cases cho dự án Organic."""

    def test_10_kloc_all_nominal(self):
        """
        Tính tay:
          EAF  = 1.0
          E    = 3.2 × 10^1.05 × 1.0 = 3.2 × 11.220 ≈ 35.90 PM
          TDEV = 2.5 × 35.90^0.38    ≈ 9.75 months
          Cost = 35.90 × 2000        = $71,800
        """
        r = calculate_cocomo(kloc=10, mode="organic", eaf_dict=NOMINAL, salary=2000)
        assert abs(r["effort_person_months"]    - 35.90) < 0.2,  f"Effort sai: {r['effort_person_months']}"
        assert abs(r["development_time_months"] -  9.75) < 0.15, f"TDEV sai: {r['development_time_months']}"
        assert r["eaf_applied"] == 1.0, "EAF should be exactly 1.0"
        assert r["final_kloc"]  == 10.0

    def test_50_kloc_all_nominal(self):
        """
        Benchmark đồ án: 50 KLOC Organic, all Nominal.
        Tính tay:
          50^1.05 = e^(1.05 × ln 50) = e^(1.05 × 3.912) = e^4.108 ≈ 60.80
          E    = 3.2 × 60.80 × 1.0 ≈ 194.57 PM
          TDEV = 2.5 × 194.57^0.38   ≈ 18.53 months
        """
        r = calculate_cocomo(kloc=50, mode="organic", eaf_dict=NOMINAL, salary=3000)
        assert abs(r["effort_person_months"]    - 194.57) < 0.5, f"Effort sai: {r['effort_person_months']}"
        assert abs(r["development_time_months"] -  18.53) < 0.5, f"TDEV sai: {r['development_time_months']}"
        assert r["eaf_applied"] == 1.0

    def test_strong_team_reduces_effort(self):
        """Nhóm mạnh (ACAP VH=0.71, PCAP VH=0.70) nên giảm effort đáng kể."""
        strong_drivers = dict(NOMINAL, ACAP=0.71, PCAP=0.70)
        r_strong  = calculate_cocomo(kloc=20, mode="organic", eaf_dict=strong_drivers, salary=2000)
        r_nominal = calculate_cocomo(kloc=20, mode="organic", eaf_dict=NOMINAL,       salary=2000)
        assert r_strong["effort_person_months"] < r_nominal["effort_person_months"] * 0.65


class TestSemiDetachedProject:
    """Test cases cho dự án Semi-detached."""

    def test_50_kloc_elevated_drivers(self):
        """
        EAF = CPLX(1.15) × TIME(1.08) = 1.2420
        E   = 3.0 × 50^1.12 × 1.2420 = 3.0 × 79.92 × 1.2420 ≈ 297.9 PM
        TDEV= 2.5 × 297.9^0.35        ≈ 18.4 months
        """
        eaf_dict = dict(NOMINAL, CPLX=1.15, TIME=1.08)
        r = calculate_cocomo(kloc=50, mode="semi-detached", eaf_dict=eaf_dict, salary=3000)
        assert abs(r["effort_person_months"]    - 297.9) < 1.0
        assert abs(r["development_time_months"] -  18.4) < 0.5
        assert abs(r["eaf_applied"] - 1.2420)   < 0.0005


class TestEmbeddedProject:
    """Test cases cho dự án Embedded."""

    def test_100_kloc_high_stress(self):
        """Embedded với complexity và real-time constraints cực cao."""
        eaf_dict = dict(NOMINAL, CPLX=1.65, TIME=1.66, ACAP=1.46)
        r = calculate_cocomo(kloc=100, mode="embedded", eaf_dict=eaf_dict, salary=5000)
        # Sanity checks — chỉ kiểm tra các output có hợp lý không
        assert r["effort_person_months"]    > 500, "Effort phải rất cao với EAF > 4"
        assert r["development_time_months"] > 0
        assert r["estimated_cost"]          > 0
        assert r["eaf_applied"]             > 3.0   # 1.65 × 1.66 × 1.46 ≈ 4.0


class TestFPBackfiring:
    """Test cases cho chuyển đổi Function Points → KLOC."""

    def test_python_250fp(self):
        """Python: 40 SLOC/FP → 250 FP × 40 / 1000 = 10.0 KLOC."""
        r = calculate_cocomo(kloc=None, mode="organic", eaf_dict=NOMINAL, salary=2000,
                             fp=250, language="Python")
        assert r["final_kloc"] == 10.0
        assert abs(r["effort_person_months"] - 35.90) < 0.2

    def test_java_200fp(self):
        """Java: 53 SLOC/FP → 200 FP × 53 / 1000 = 10.6 KLOC."""
        r = calculate_cocomo(kloc=None, mode="organic", eaf_dict=NOMINAL, salary=2000,
                             fp=200, language="Java")
        assert r["final_kloc"] == 10.6

    def test_cpp_150fp(self):
        """C++: 64 SLOC/FP → 150 FP × 64 / 1000 = 9.6 KLOC."""
        r = calculate_cocomo(kloc=None, mode="organic", eaf_dict=NOMINAL, salary=2000,
                             fp=150, language="C++")
        assert r["final_kloc"] == 9.6

    def test_unknown_language_defaults_to_50(self):
        """Ngôn ngữ không xác định → dùng factor mặc định 50."""
        r = calculate_cocomo(kloc=None, mode="organic", eaf_dict=NOMINAL, salary=2000,
                             fp=100, language="COBOL")
        assert r["final_kloc"] == 5.0  # 100 × 50 / 1000


class TestValidation:
    """Test cases cho validation và error handling."""

    def test_invalid_mode_raises(self):
        with pytest.raises(ValueError, match="không hợp lệ"):
            calculate_cocomo(kloc=10, mode="waterfall", eaf_dict=NOMINAL, salary=2000)

    def test_no_size_input_raises(self):
        with pytest.raises(ValueError, match="Thiếu dữ liệu"):
            calculate_cocomo(kloc=None, mode="organic", eaf_dict=NOMINAL, salary=2000)

    def test_kloc_takes_priority_over_fp(self):
        """Nếu có cả KLOC và FP, ưu tiên dùng KLOC."""
        r = calculate_cocomo(kloc=10, mode="organic", eaf_dict=NOMINAL, salary=2000,
                             fp=999, language="Python")
        assert r["final_kloc"] == 10.0

    def test_staff_calculation(self):
        """Staff = Effort / TDEV."""
        r = calculate_cocomo(kloc=10, mode="organic", eaf_dict=NOMINAL, salary=2000)
        expected_staff = round(r["effort_person_months"] / r["development_time_months"], 1)
        assert r["required_staff"] == expected_staff


# ════════════════════════════════════════════════════════════════════════════
# RISK ANALYZER TESTS
# ════════════════════════════════════════════════════════════════════════════

class TestRiskAnalyzer:
    """Test cases cho Risk Analysis Module."""

    def test_no_risks_for_nominal_small_project(self):
        """Dự án nhỏ, tất cả drivers Nominal → không có risk HIGH."""
        risks = analyze_risks(kloc=5, mode="organic", cost_drivers=NOMINAL)
        high_risks = [r for r in risks if r["level"] == "HIGH"]
        assert len(high_risks) == 0, f"Không nên có HIGH risk: {high_risks}"

    def test_detects_high_cplx(self):
        """CPLX Extra High (1.65) phải sinh ra HIGH Technical risk."""
        drivers = dict(NOMINAL, CPLX=1.65)
        risks = analyze_risks(kloc=10, mode="organic", cost_drivers=drivers)
        technical_high = [r for r in risks if r["level"] == "HIGH" and r["driver"] == "CPLX"]
        assert len(technical_high) == 1, "Phải có đúng 1 HIGH risk từ CPLX Extra High"

    def test_detects_large_project_risk(self):
        """Dự án > 100 KLOC phải có size risk."""
        risks = analyze_risks(kloc=150, mode="semi-detached", cost_drivers=NOMINAL)
        size_risks = [r for r in risks if r["driver"] == "Size"]
        assert len(size_risks) == 1, "Phải có risk về quy mô lớn"
        assert size_risks[0]["level"] == "HIGH"

    def test_detects_high_eaf_composite_risk(self):
        """EAF tổng hợp > 1.5 phải sinh cảnh báo riêng."""
        drivers = dict(NOMINAL, CPLX=1.30, TIME=1.30, RELY=1.15)  # EAF ≈ 1.95
        risks = analyze_risks(kloc=20, mode="embedded", cost_drivers=drivers)
        eaf_risks = [r for r in risks if r["driver"] == "EAF"]
        assert len(eaf_risks) == 1, "Phải có composite EAF risk khi EAF > 1.5"

    def test_risks_sorted_high_first(self):
        """Risks phải được sắp xếp HIGH → MEDIUM → LOW."""
        drivers = dict(NOMINAL, CPLX=1.65, VIRT=1.15, AEXP=1.13)
        risks = analyze_risks(kloc=50, mode="semi-detached", cost_drivers=drivers)
        if len(risks) > 1:
            order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
            levels = [order[r["level"]] for r in risks]
            assert levels == sorted(levels), "Risks phải theo thứ tự HIGH → MEDIUM → LOW"

    def test_personnel_risk_detected(self):
        """Analyst Very Low (ACAP=1.46) phải sinh HIGH Personnel risk."""
        drivers = dict(NOMINAL, ACAP=1.46)
        risks = analyze_risks(kloc=10, mode="organic", cost_drivers=drivers)
        personnel = [r for r in risks if r["driver"] == "ACAP" and r["level"] == "HIGH"]
        assert len(personnel) == 1
