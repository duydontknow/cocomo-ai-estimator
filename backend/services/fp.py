"""
services/fp.py — Tính toán Function Points chuẩn IFPUG.

Hai chức năng chính:
  1. calculate_ufp()       → Tính UFP từ 5 components × 3 complexity levels
  2. estimate_fp_with_ai() → AI ước tính counts từ mô tả dự án (Gemini)

Nguồn: IFPUG 4.3 Counting Practices Manual / Boehm COCOMO reference
"""

import os
import json
import re
from typing import Dict
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-flash"


# ====================== IFPUG WEIGHTS ======================
# Nguồn: IFPUG 4.3 / Albrecht & Gaffney (1983)
FP_WEIGHTS = {
    "EI":  {"simple": 3, "average": 4, "complex": 6},   # External Input
    "EO":  {"simple": 4, "average": 5, "complex": 7},   # External Output
    "EQ":  {"simple": 3, "average": 4, "complex": 6},   # External Query
    "ILF": {"simple": 7, "average": 10, "complex": 15}, # Internal Logical File
    "EIF": {"simple": 5, "average": 7, "complex": 10},  # External Interface File
}

FP_COMPONENT_INFO = {
    "EI": {
        "name": "External Input",
        "description": (
            "Dữ liệu nhập từ bên ngoài hệ thống: form nhập liệu, file upload, "
            "API request nhận dữ liệu để thêm/sửa/xóa ILF. "
            "Simple: 1-4 DETs, 0-1 FTRs; Average: 2-5 DETs, 2 FTRs; Complex: 6+ DETs, 3+ FTRs."
        ),
    },
    "EO": {
        "name": "External Output",
        "description": (
            "Dữ liệu xuất ra có xử lý/tính toán: báo cáo, màn hình kết quả phân tích, "
            "file export có derived data, API response có business logic. "
            "Simple: 1-5 DETs, 0-1 FTRs; Average: 2-5 DETs, 2-3 FTRs; Complex: 6+ DETs, 4+ FTRs."
        ),
    },
    "EQ": {
        "name": "External Query",
        "description": (
            "Truy vấn không có tính toán thêm: tìm kiếm, lấy danh sách, get by ID, "
            "lookup tables. Input + output cùng transaction. "
            "Simple: 1-4 input DETs, 1-5 output DETs; Complex: nhiều hơn."
        ),
    },
    "ILF": {
        "name": "Internal Logical File",
        "description": (
            "File/bảng CSDL nội bộ do HỆ THỐNG NÀY quản lý (maintain): bảng users, "
            "orders, products, configurations... bất kỳ entity nào hệ thống Create/Update/Delete. "
            "Simple: 1-19 DETs, 1 RET; Average: 20-50 DETs, 2-5 RETs; Complex: 51+ DETs, 6+ RETs."
        ),
    },
    "EIF": {
        "name": "External Interface File",
        "description": (
            "File/DB của hệ thống NGOÀI mà hệ thống này chỉ đọc (không maintain): "
            "external APIs, legacy DB shared, third-party data feeds. "
            "Simple: 1-19 DETs, 1 RET; Average: 20-50 DETs, 2-5 RETs; Complex: 51+ DETs, 6+ RETs."
        ),
    },
}


# ====================== 1. CALCULATE UFP ======================

def calculate_ufp(components: Dict[str, Dict[str, int]]) -> dict:
    """
    Tính UFP (Unadjusted Function Points) từ 5 thành phần IFPUG.

    Args:
        components: {
            "EI":  {"simple": int, "average": int, "complex": int},
            "EO":  {...}, "EQ": {...}, "ILF": {...}, "EIF": {...}
        }

    Returns:
        {
            "ufp": float,
            "breakdown": {
                "EI": {
                    "name": str,
                    "simple": n, "average": n, "complex": n,
                    "simple_pts": n, "average_pts": n, "complex_pts": n,
                    "subtotal": n
                }, ...
            }
        }
    """
    breakdown = {}
    total_ufp = 0.0

    for comp_id, weights in FP_WEIGHTS.items():
        counts = components.get(comp_id, {"simple": 0, "average": 0, "complex": 0})
        s = max(0, int(counts.get("simple", 0)))
        a = max(0, int(counts.get("average", 0)))
        c = max(0, int(counts.get("complex", 0)))

        s_pts = s * weights["simple"]
        a_pts = a * weights["average"]
        c_pts = c * weights["complex"]
        subtotal = s_pts + a_pts + c_pts
        total_ufp += subtotal

        breakdown[comp_id] = {
            "name":        FP_COMPONENT_INFO[comp_id]["name"],
            "simple":      s,
            "average":     a,
            "complex":     c,
            "simple_pts":  s_pts,
            "average_pts": a_pts,
            "complex_pts": c_pts,
            "subtotal":    subtotal,
        }

    return {
        "ufp":       round(total_ufp, 2),
        "breakdown": breakdown,
    }


# ====================== 2. AI FP ESTIMATION ======================

def estimate_fp_with_ai(description: str, project_mode: str = "organic") -> dict:
    """
    Dùng Gemini để ước tính counts cho 5 FP components từ mô tả dự án.

    Args:
        description:  Mô tả dự án (ngôn ngữ tự nhiên)
        project_mode: Loại dự án (organic/semi-detached/embedded)

    Returns:
        {
            "components": {
                "EI":  {"simple": n, "average": n, "complex": n, "reasoning": "..."},
                ...
            },
            "ufp":              float,
            "breakdown":        {...},   # same as calculate_ufp output
            "overall_reasoning": str,
        }
    """
    # Build component reference string for prompt
    comp_list = "\n".join([
        f"- **{cid}** ({info['name']}): {info['description']}"
        for cid, info in FP_COMPONENT_INFO.items()
    ])

    weights_str = "\n".join([
        f"  {cid} ({FP_COMPONENT_INFO[cid]['name']}): "
        f"Simple={w['simple']}pts | Average={w['average']}pts | Complex={w['complex']}pts"
        for cid, w in FP_WEIGHTS.items()
    ])

    system_prompt = """You are an expert IFPUG-certified Function Point Analyst with 15+ years of experience.
Your task: analyze a software project description and estimate the count of each FP transaction/data component at each complexity level.

COUNTING RULES:
- EI: Count each unique input transaction that updates/creates/deletes data
- EO: Count each unique output that includes derived/calculated data
- EQ: Count each unique retrieval that has no derived data
- ILF: Count each logical group of data maintained (owned) by this system
- EIF: Count each logical group of data referenced but not maintained by this system

CRITICAL:
1. Return ONLY valid JSON — no markdown, no text outside JSON
2. All counts must be non-negative integers
3. Be conservative — estimate what's described, not what could be added
4. Complexity based on number of Data Element Types (DETs) and Referenced Types (FTRs/RETs)"""

    user_prompt = f"""## PROJECT TO ANALYZE

Project Mode: {project_mode.upper()}

### Description:
{description}

---

## COMPONENT DEFINITIONS & WEIGHTS:
{comp_list}

### IFPUG Weights Reference:
{weights_str}

---

## REQUIRED JSON OUTPUT:
{{
  "EI": {{
    "simple": <int>,
    "average": <int>,
    "complex": <int>,
    "reasoning": "<Giải thích tại sao ước tính các con số này bằng tiếng Việt, 1-2 câu>"
  }},
  "EO": {{ "simple": <int>, "average": <int>, "complex": <int>, "reasoning": "<...>" }},
  "EQ": {{ "simple": <int>, "average": <int>, "complex": <int>, "reasoning": "<...>" }},
  "ILF": {{ "simple": <int>, "average": <int>, "complex": <int>, "reasoning": "<...>" }},
  "EIF": {{ "simple": <int>, "average": <int>, "complex": <int>, "reasoning": "<...>" }},
  "overall_reasoning": "<Tổng quan phân tích FP bằng tiếng Việt: đặc điểm nổi bật, 2-3 câu>"
}}

Analyze now and return JSON:"""

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[types.Part(text=system_prompt + "\n\n" + user_prompt)])
        ],
        config=types.GenerateContentConfig(
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )

    raw = response.text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"```(?:json)?\n?", "", raw).replace("```", "").strip()

    data = json.loads(raw)

    # Build validated components dict
    components_for_calc = {}
    components_out = {}

    for comp_id in FP_WEIGHTS:
        comp_data = data.get(comp_id, {})
        s = max(0, int(comp_data.get("simple", 0)))
        a = max(0, int(comp_data.get("average", 0)))
        c = max(0, int(comp_data.get("complex", 0)))

        components_for_calc[comp_id] = {"simple": s, "average": a, "complex": c}
        components_out[comp_id] = {
            "simple":    s,
            "average":   a,
            "complex":   c,
            "reasoning": comp_data.get("reasoning", ""),
        }

    result = calculate_ufp(components_for_calc)

    return {
        "components":        components_out,
        "ufp":               result["ufp"],
        "breakdown":         result["breakdown"],
        "overall_reasoning": data.get("overall_reasoning", ""),
    }
