"""
services/ai.py — Tích hợp Gemini AI cho 3 chức năng:

  1. suggest_cost_drivers()  → AI gợi ý 15 cost drivers từ mô tả dự án
  2. get_ai_advice()         → AI phân tích kết quả COCOMO và đưa ra khuyến nghị
  3. chat_with_ai()          → Chatbot giải thích kết quả (multi-turn conversation)

Tất cả output tiếng Việt để phù hợp với đồ án.
"""

import os
import json
import re
from typing import Dict, List, Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types
from schemas import AIAdvisorInput, ChatMessage

# ====================== CONFIGURE GEMINI ======================
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY or GEMINI_API_KEY == "NHAP_API_KEY_CUA_BAN_VAO_DAY":
    raise ValueError("GEMINI_API_KEY chưa được thiết lập! Vui lòng kiểm tra file .env")

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = "gemini-2.5-flash"


# ====================== COST DRIVER METADATA ======================
# Dùng để validate output AI và cung cấp context cho system prompt

COST_DRIVER_INFO = {
    "RELY": {
        "name": "Required Software Reliability",
        "category": "Product",
        "valid_ratings": {"Very Low": 0.75, "Low": 0.88, "Nominal": 1.00, "High": 1.15, "Very High": 1.40},
        "description": "Mức độ thiệt hại nếu phần mềm bị lỗi (từ bất tiện nhỏ đến mất mạng người)"
    },
    "DATA": {
        "name": "Data Base Size",
        "category": "Product",
        "valid_ratings": {"Low": 0.94, "Nominal": 1.00, "High": 1.08, "Very High": 1.16},
        "description": "Tỷ lệ kích thước DB (bytes) / độ lớn chương trình (SLOC)"
    },
    "CPLX": {
        "name": "Product Complexity",
        "category": "Product",
        "valid_ratings": {"Very Low": 0.70, "Low": 0.85, "Nominal": 1.00, "High": 1.15, "Very High": 1.30, "Extra High": 1.65},
        "description": "Độ phức tạp của module điều khiển, tính toán, thiết bị, quản lý data, UI"
    },
    "TIME": {
        "name": "Execution Time Constraint",
        "category": "Computer",
        "valid_ratings": {"Nominal": 1.00, "High": 1.11, "Very High": 1.30, "Extra High": 1.66},
        "description": "% CPU thời gian thực thi so với tổng available: Nominal<50%, High 70%, VH 85%, EH≥95%"
    },
    "STOR": {
        "name": "Main Storage Constraint",
        "category": "Computer",
        "valid_ratings": {"Nominal": 1.00, "High": 1.06, "Very High": 1.21, "Extra High": 1.56},
        "description": "% RAM sử dụng so với tổng available: Nominal<50%, High 70%, VH 85%, EH≥95%"
    },
    "VIRT": {
        "name": "Virtual Machine Volatility",
        "category": "Computer",
        "valid_ratings": {"Low": 0.87, "Nominal": 1.00, "High": 1.15, "Very High": 1.30},
        "description": "Mức độ thay đổi của OS/platform bên dưới: Nominal = thay đổi lớn mỗi 6 tháng"
    },
    "TURN": {
        "name": "Computer Turnaround Time",
        "category": "Computer",
        "valid_ratings": {"Low": 0.87, "Nominal": 1.00, "High": 1.07, "Very High": 1.15},
        "description": "Thời gian chờ compile/test: Nominal = interactive (< 1h), High = < 4h, VH = overnight"
    },
    "ACAP": {
        "name": "Analyst Capability",
        "category": "Personnel",
        "valid_ratings": {"Very Low": 1.46, "Low": 1.19, "Nominal": 1.00, "High": 0.86, "Very High": 0.71},
        "description": "Khả năng phân tích, thiết kế, giao tiếp của đội BA/Architect (15th → 90th percentile)"
    },
    "AEXP": {
        "name": "Applications Experience",
        "category": "Personnel",
        "valid_ratings": {"Very Low": 1.29, "Low": 1.13, "Nominal": 1.00, "High": 0.91, "Very High": 0.82},
        "description": "Kinh nghiệm với loại ứng dụng cụ thể này: VL < 2 tháng, L = 6 tháng, N = 1 năm, H = 3 năm, VH ≥ 6 năm"
    },
    "PCAP": {
        "name": "Programmer Capability",
        "category": "Personnel",
        "valid_ratings": {"Very Low": 1.42, "Low": 1.17, "Nominal": 1.00, "High": 0.86, "Very High": 0.70},
        "description": "Năng lực lập trình viên (15th → 90th percentile) - teamwork và coding ability"
    },
    "VEXP": {
        "name": "Virtual Machine Experience",
        "category": "Personnel",
        "valid_ratings": {"Very Low": 1.21, "Low": 1.10, "Nominal": 1.00, "High": 0.90},
        "description": "Kinh nghiệm với OS/platform: VL < 1 tháng, L = 4 tháng, N = 1 năm, H ≥ 3 năm"
    },
    "LEXP": {
        "name": "Programming Language Experience",
        "category": "Personnel",
        "valid_ratings": {"Very Low": 1.14, "Low": 1.07, "Nominal": 1.00, "High": 0.95},
        "description": "Kinh nghiệm với ngôn ngữ lập trình cụ thể: VL < 1 tháng, L = 4 tháng, N = 1 năm, H ≥ 3 năm"
    },
    "MODP": {
        "name": "Modern Programming Practices",
        "category": "Project",
        "valid_ratings": {"Very Low": 1.24, "Low": 1.10, "Nominal": 1.00, "High": 0.91, "Very High": 0.82},
        "description": "Sử dụng Structured Programming, Design Reviews, Code Reviews, Unit Testing, v.v."
    },
    "TOOL": {
        "name": "Use of Software Tools",
        "category": "Project",
        "valid_ratings": {"Very Low": 1.24, "Low": 1.10, "Nominal": 1.00, "High": 0.91, "Very High": 0.83},
        "description": "Mức độ sử dụng CASE tools, IDE, CM tools, debuggers: VL=edit/debug only, VH=full lifecycle automation"
    },
    "SCED": {
        "name": "Required Development Schedule",
        "category": "Project",
        "valid_ratings": {"Very Low": 1.23, "Low": 1.08, "Nominal": 1.00, "High": 1.04, "Very High": 1.10},
        "description": "% schedule so với nominal COCOMO (TDEV): VL=75%, L=85%, N=100%, H=130%, VH=160%"
    },
}


# ====================== 1. AI SUGGEST COST DRIVERS ======================

def suggest_cost_drivers(
    description: str,
    project_mode: str = "organic",
    kloc: Optional[float] = None,
) -> dict:
    """
    Phân tích mô tả dự án và gợi ý giá trị cho 15 Cost Drivers COCOMO.

    Args:
        description: Mô tả dự án (tiếng Anh hoặc tiếng Việt)
        project_mode: Loại dự án (organic/semi-detached/embedded)
        kloc: Quy mô ước tính (nếu có)

    Returns:
        Dict gồm: cost_drivers, eaf, risk_summary, analysis_notes
    """
    # Chuẩn bị thông tin cost drivers cho prompt
    driver_list = "\n".join([
        f"- {did} ({info['name']}, {info['category']}): {info['description']}\n"
        f"  Valid ratings (name → multiplier): {json.dumps(info['valid_ratings'])}"
        for did, info in COST_DRIVER_INFO.items()
    ])

    size_context = f"Estimated size: {kloc} KLOC" if kloc else "Size not specified"

    system_prompt = """You are an expert software project estimator with 20+ years of experience applying 
the Intermediate COCOMO model (Boehm 1981). Your task is to analyze a software project description 
and assign appropriate ratings to all 15 COCOMO cost drivers.

CRITICAL RULES:
1. Return ONLY valid JSON, no markdown, no explanation outside the JSON
2. Each driver's rating MUST be from its valid_ratings list (no other values allowed)
3. Be conservative: when uncertain, prefer Nominal rating
4. Consider the project type when rating personnel drivers (organic = smaller experienced team)
5. Think step by step before assigning each rating"""

    user_prompt = f"""## SOFTWARE PROJECT TO ANALYZE

Project Mode: {project_mode.upper()}
{size_context}

### Project Description:
{description}

---

## TASK: Assign ratings for all 15 COCOMO Intermediate Cost Drivers

### Available Cost Drivers and Valid Ratings:
{driver_list}

---

## REQUIRED JSON OUTPUT FORMAT:
{{
  "drivers": {{
    "RELY": {{
      "rating": "<one of the valid rating names>",
      "value": <the numeric multiplier>,
      "reasoning": "<1-2 sentences explaining why this rating based on the description>",
      "confidence": "high|medium|low"
    }},
    "DATA": {{ ... }},
    ... (all 15 drivers)
  }},
  "eaf": <product of all 15 multiplier values, rounded to 4 decimal places>,
  "risk_summary": "<2-3 sentences overall risk assessment in Vietnamese>",
  "analysis_notes": "<key insights about the project in Vietnamese, 3-5 bullet points starting with •>"
}}

Analyze the project description carefully and return the JSON now:"""

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            types.Content(role="user", parts=[types.Part(text=system_prompt + "\n\n" + user_prompt)])
        ],
        config=types.GenerateContentConfig(
            temperature=0.3,  # Thấp hơn để kết quả ổn định/nhất quán
            response_mime_type="application/json",
        )
    )

    # Parse và validate JSON response
    raw = response.text.strip()
    # Xử lý trường hợp AI wrap JSON trong ```json``` code block
    if raw.startswith("```"):
        raw = re.sub(r"```(?:json)?\n?", "", raw).replace("```", "").strip()

    data = json.loads(raw)

    # Validate và normalize: đảm bảo tất cả 15 drivers có mặt
    drivers_out = {}
    eaf = 1.0
    for driver_id, info in COST_DRIVER_INFO.items():
        if driver_id in data.get("drivers", {}):
            d = data["drivers"][driver_id]
            rating = d.get("rating", "Nominal")
            # Fallback nếu rating không hợp lệ
            if rating not in info["valid_ratings"]:
                rating = "Nominal"
            value = info["valid_ratings"][rating]
            drivers_out[driver_id] = {
                "rating": rating,
                "value": value,
                "reasoning": d.get("reasoning", ""),
                "confidence": d.get("confidence", "medium"),
            }
        else:
            # Driver bị thiếu → Nominal
            drivers_out[driver_id] = {
                "rating": "Nominal",
                "value": COST_DRIVER_INFO[driver_id]["valid_ratings"]["Nominal"],
                "reasoning": "Không đủ thông tin, sử dụng Nominal.",
                "confidence": "low",
            }
        eaf *= drivers_out[driver_id]["value"]

    return {
        "drivers": drivers_out,
        "eaf": round(eaf, 4),
        "risk_summary": data.get("risk_summary", ""),
        "analysis_notes": data.get("analysis_notes", ""),
    }


# ====================== 2. AI ADVISE (POST-CALCULATION) ======================

def get_ai_advice(data: AIAdvisorInput) -> str:
    """
    Phân tích kết quả COCOMO và đưa ra khuyến nghị chiến lược.

    Trả về Markdown string có cấu trúc rõ ràng (tiếng Việt).
    """
    elevated = {k: v for k, v in data.cost_drivers.items() if v > 1.0}
    reduced  = {k: v for k, v in data.cost_drivers.items() if v < 1.0}
    staff    = round(data.effort / data.time, 1) if data.time > 0 else 0

    elevated_str = "\n".join(
        [f"  - **{k}** ({COST_DRIVER_INFO.get(k, {}).get('name', k)}): {v:.2f}x"
         for k, v in sorted(elevated.items(), key=lambda x: -x[1])]
    ) or "  Không có."

    reduced_str = "\n".join(
        [f"  - **{k}** ({COST_DRIVER_INFO.get(k, {}).get('name', k)}): {v:.2f}x"
         for k, v in sorted(reduced.items(), key=lambda x: x[1])]
    ) or "  Không có."

    desc_context = f"\n**Mô tả dự án:** {data.project_description}" if data.project_description else ""

    prompt = f"""Bạn là Chuyên gia Quản trị Dự án Phần mềm cấp cao với kinh nghiệm sâu về mô hình COCOMO (đặc biệt là Intermediate COCOMO).
Phân tích kết quả ước lượng sau và đưa ra báo cáo bằng tiếng Việt:

## THÔNG TIN DỰ ÁN
| Thuộc tính | Giá trị |
|---|---|
| Quy mô | {data.kloc} KLOC |
| Loại dự án | {data.project_mode.upper()} |
| Nỗ lực (E) | {data.effort} Person-Months |
| Thời gian (TDEV) | {data.time} Tháng |
| Team size ước tính | {staff} người |
| Tổng chi phí | ${data.cost:,.0f} USD |
{desc_context}

## COST DRIVERS TĂNG EFFORT (> 1.0x):
{elevated_str}

## COST DRIVERS GIẢM EFFORT (< 1.0x):
{reduced_str}

---
Viết báo cáo theo định dạng Markdown sau. Mỗi phần phải cụ thể, thực tiễn:

### 🔍 1. ĐÁNH GIÁ TỔNG QUAN
- Đánh giá {staff} người trong {data.time} tháng có thực tế không?
- So sánh với benchmark ngành cho dự án {data.project_mode} ~{data.kloc} KLOC.
- Độ tin cậy của ước lượng (Cao/Trung bình/Thấp) và lý do.

### ⚠️ 2. PHÂN TÍCH RỦI RO CHÍNH
- Phân tích top 3 rủi ro nghiêm trọng nhất từ cost drivers trên.
- Với mỗi rủi ro: mô tả cụ thể, tác động định lượng, xác suất xảy ra.

### 🎯 3. CHIẾN LƯỢC TỐI ƯU HÓA
- Liệt kê 3 hành động cụ thể (với timeline và expected impact) để giảm Effort/Cost.
- Ưu tiên theo ROI (Return on Investment).

### 💡 4. KHUYẾN NGHỊ QUẢN LÝ DỰ ÁN
- Top 3 best practices phù hợp với dự án {data.project_mode} quy mô {data.kloc} KLOC.
- Đề xuất cấu trúc team và sprint cadence phù hợp."""

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.6)
    )
    return response.text.strip()


# ====================== 3. AI CHATBOT (MULTI-TURN) ======================

def chat_with_ai(messages: List[ChatMessage], context: Optional[dict] = None) -> str:
    """
    Chatbot giải thích kết quả COCOMO và trả lời câu hỏi (multi-turn).

    Args:
        messages: Lịch sử hội thoại [{role, content}, ...]
        context: Context dự án (effort, time, cost, kloc, mode, cost_drivers)

    Returns:
        Câu trả lời của AI (Markdown string)
    """
    # Build system context từ project data hiện tại
    if context:
        kloc = context.get("kloc", "N/A")
        mode = context.get("mode", "N/A")
        effort = context.get("effort", "N/A")
        time_ = context.get("time", "N/A")
        cost = context.get("cost", 0)
        eaf = context.get("eaf", "N/A")
        drivers_summary = ", ".join(
            [f"{k}={v:.2f}" for k, v in context.get("cost_drivers", {}).items()]
        )
        context_block = f"""
## CONTEXT: Dự án đang phân tích
- **Quy mô**: {kloc} KLOC | **Loại**: {mode} | **EAF**: {eaf}
- **Effort**: {effort} PM | **TDEV**: {time_} tháng | **Chi phí**: ${cost:,.0f}
- **Cost Drivers**: {drivers_summary}
"""
    else:
        context_block = "\n(Chưa có dữ liệu dự án. Hãy tính toán COCOMO trước.)\n"

    system_instruction = f"""Bạn là AI Assistant chuyên về COCOMO và Software Project Management.
Nhiệm vụ: Giải thích kết quả ước lượng COCOMO, trả lời câu hỏi về cost drivers, và đưa ra tư vấn thực tiễn.

NGUYÊN TẮC:
- Trả lời bằng tiếng Việt (trừ khi user hỏi bằng tiếng Anh)
- Ngắn gọn, súc tích, thực tiễn
- Dùng Markdown (bold, bullets, tables khi cần)
- Nếu không chắc, thừa nhận giới hạn và suggest tham khảo thêm
- Luôn liên kết câu trả lời với dữ liệu dự án cụ thể (nếu có context)
{context_block}"""

    # Convert messages sang format của Gemini
    gemini_messages = []
    for msg in messages:
        role = "user" if msg.role == "user" else "model"
        gemini_messages.append(
            types.Content(role=role, parts=[types.Part(text=msg.content)])
        )

    response = client.models.generate_content(
        model=MODEL,
        contents=gemini_messages,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.7,
        )
    )
    return response.text.strip()
