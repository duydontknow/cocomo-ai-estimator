"""
main.py — FastAPI application entry point cho COCOMO AI Estimator.

Endpoints:
  GET  /api/health              → Health check
  POST /api/estimate/cocomo     → Tính toán COCOMO Intermediate + Risk Analysis
  POST /api/estimate/fp         → Tính UFP từ 5 IFPUG components (thủ công)
  POST /api/estimate/fp/ai      → AI ước tính FP counts từ mô tả dự án
  POST /api/suggest             → AI gợi ý 15 cost drivers từ mô tả dự án
  POST /api/advise              → AI phân tích kết quả và khuyến nghị chiến lược
  POST /api/chat                → AI Chatbot multi-turn
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from schemas import (
    ProjectInput, ProjectDescriptionInput, AIAdvisorInput, ChatRequest,
    FPCalculationInput, FPAIEstimateInput,
    ProjectCreate, ProjectUpdate, ProjectResponse
)
from typing import List
from dependencies import get_current_user
from database import supabase
from services.cocomo import calculate_cocomo
from services.ai import suggest_cost_drivers, get_ai_advice, chat_with_ai
from services.risk import analyze_risks
from services.fp import calculate_ufp, estimate_fp_with_ai

# ====================== APP SETUP ======================
app = FastAPI(
    title="COCOMO AI Estimator API",
    description="API cho hệ thống ước lượng nỗ lực phần mềm thông minh (P5 - CMU-CS 462)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ====================== HEALTH CHECK ======================

@app.get("/api/health")
def health_check():
    """Kiểm tra trạng thái server."""
    return {"status": "ok", "version": "2.0.0", "message": "COCOMO AI Estimator đang hoạt động!"}


# ====================== COCOMO CALCULATION ======================

@app.post("/api/estimate/cocomo")
def estimate_cocomo(data: ProjectInput):
    """
    Tính toán Intermediate COCOMO.

    Nhận: KLOC hoặc FP+Language, project mode, 15 cost drivers, lương trung bình.
    Trả về: Effort (PM), TDEV (months), Cost (USD), Staff, EAF, Risk Factors.
    """
    try:
        # Tính COCOMO
        results = calculate_cocomo(
            kloc=data.kloc,
            mode=data.project_mode,
            eaf_dict=data.cost_drivers,
            salary=data.avg_salary,
            fp=data.fp,
            language=data.language,
        )

        # Phân tích rủi ro đi kèm (không blocking)
        try:
            risks = analyze_risks(
                kloc=results["final_kloc"],
                mode=data.project_mode,
                cost_drivers=data.cost_drivers,
            )
        except Exception:
            risks = []

        return {
            "status": "success",
            "data": {**results, "risk_factors": risks},
            "message": "Tính toán COCOMO Intermediate thành công!",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tính toán: {str(e)}")


# ====================== AI SUGGEST COST DRIVERS ======================

@app.post("/api/suggest")
def suggest_drivers(data: ProjectDescriptionInput):
    """
    Dùng AI (Gemini) để gợi ý 15 Cost Drivers từ mô tả dự án bằng ngôn ngữ tự nhiên.

    Input: Mô tả dự án, loại dự án (optional), KLOC (optional)
    Output: 15 cost drivers với rating, value, reasoning + EAF + risk summary
    """
    try:
        result = suggest_cost_drivers(
            description=data.description,
            project_mode=data.project_mode,
            kloc=data.kloc,
        )
        return {
            "status": "success",
            "suggestion": result,
            "message": "AI đã phân tích và gợi ý cost drivers thành công!",
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi AI Suggest: {str(e)}")


# ====================== AI ADVISOR (POST-CALCULATION) ======================

@app.post("/api/advise")
def get_advice(data: AIAdvisorInput):
    """
    Phân tích kết quả COCOMO và đưa ra khuyến nghị chiến lược bằng AI.

    Input: Kết quả COCOMO (effort, time, cost) + cost drivers
    Output: Báo cáo Markdown phân tích risk, tối ưu hóa, khuyến nghị
    """
    try:
        advice = get_ai_advice(data)
        return {
            "status": "success",
            "advice": advice,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi AI Advice: {str(e)}")


# ====================== AI CHATBOT ======================

@app.post("/api/chat")
def chat(data: ChatRequest):
    """
    Chatbot AI giải thích kết quả COCOMO và trả lời câu hỏi (multi-turn).

    Input: Lịch sử hội thoại + context dự án hiện tại
    Output: Câu trả lời của AI (Markdown)
    """
    try:
        if not data.messages:
            raise HTTPException(status_code=400, detail="Cần ít nhất 1 tin nhắn!")

        reply = chat_with_ai(
            messages=data.messages,
            context=data.context,
        )
        return {
            "status": "success",
            "reply": reply,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi Chatbot: {str(e)}")


# ====================== FP CALCULATION (MANUAL) ======================

@app.post("/api/estimate/fp")
def estimate_fp(data: FPCalculationInput):
    """
    Tính UFP (Unadjusted Function Points) từ 5 IFPUG components thủ công.

    Input:  EI, EO, EQ, ILF, EIF — mỗi component có simple/average/complex counts
    Output: ufp (tổng), breakdown chi tiết từng component
    """
    try:
        components = {
            "EI":  {"simple": data.EI.simple,  "average": data.EI.average,  "complex": data.EI.complex},
            "EO":  {"simple": data.EO.simple,  "average": data.EO.average,  "complex": data.EO.complex},
            "EQ":  {"simple": data.EQ.simple,  "average": data.EQ.average,  "complex": data.EQ.complex},
            "ILF": {"simple": data.ILF.simple, "average": data.ILF.average, "complex": data.ILF.complex},
            "EIF": {"simple": data.EIF.simple, "average": data.EIF.average, "complex": data.EIF.complex},
        }
        result = calculate_ufp(components)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tính FP: {str(e)}")


# ====================== FP ESTIMATION (AI) ======================

@app.post("/api/estimate/fp/ai")
def estimate_fp_ai(data: FPAIEstimateInput):
    """
    Dùng AI (Gemini) để ước tính counts cho 5 FP components từ mô tả dự án.

    Input:  Mô tả dự án, loại dự án
    Output: Components với counts + reasoning + UFP tổng + breakdown
    """
    try:
        result = estimate_fp_with_ai(
            description=data.description,
            project_mode=data.project_mode,
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi AI FP Estimation: {str(e)}")


# ====================== PROJECT CRUD ======================

@app.post("/api/projects", response_model=ProjectResponse)
def create_project(project: ProjectCreate, auth_data: dict = Depends(get_current_user)):
    """Tạo mới một dự án và lưu vào CSDL."""
    try:
        user_id = auth_data["user_id"]
        user_client = auth_data["client"]
        data = project.model_dump() if hasattr(project, "model_dump") else project.dict()
        data["user_id"] = user_id
        
        # Gọi SDK Supabase với client đã được xác thực
        response = user_client.table("projects").insert(data).execute()
        if response.data:
            return response.data[0]
        raise HTTPException(status_code=400, detail="Không thể tạo dự án")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects", response_model=List[ProjectResponse])
def get_all_projects(auth_data: dict = Depends(get_current_user)):
    """Lấy danh sách các dự án của phiên đăng nhập hiện tại."""
    try:
        user_id = auth_data["user_id"]
        user_client = auth_data["client"]
        response = user_client.table("projects").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, auth_data: dict = Depends(get_current_user)):
    """Lấy chi tiết một dự án."""
    try:
        user_id = auth_data["user_id"]
        user_client = auth_data["client"]
        response = user_client.table("projects").select("*").eq("id", project_id).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, project: ProjectUpdate, auth_data: dict = Depends(get_current_user)):
    """Cập nhật thông tin dự án."""
    try:
        user_id = auth_data["user_id"]
        user_client = auth_data["client"]
        # Lọc ra các key none
        project_dict = project.model_dump() if hasattr(project, "model_dump") else project.dict()
        data = {k: v for k, v in project_dict.items() if v is not None}
        if not data:
            raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

        response = user_client.table("projects").update(data).eq("id", project_id).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án hoặc không có quyền sửa")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, auth_data: dict = Depends(get_current_user)):
    """Xóa dự án."""
    try:
        user_id = auth_data["user_id"]
        user_client = auth_data["client"]
        response = user_client.table("projects").delete().eq("id", project_id).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án hoặc không có quyền xóa")
        return {"status": "success", "message": "Đã xóa dự án thành công"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))