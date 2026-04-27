"""
schemas.py — Pydantic models cho toàn bộ API endpoints.

Modules:
  - ProjectInput         : Input cho /api/estimate/cocomo
  - ProjectDescriptionInput : Input cho /api/suggest (AI gợi ý cost drivers)
  - AIAdvisorInput       : Input cho /api/advise (AI phân tích kết quả)
  - ChatMessage / ChatRequest : Input cho /api/chat (chatbot)
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Literal, Any

# ============================================================
# /api/estimate/cocomo
# ============================================================
class ProjectInput(BaseModel):
    """Đầu vào để tính toán COCOMO Intermediate."""
    kloc: Optional[float] = Field(None, gt=0, description="Kilo Lines of Code")
    fp: Optional[float] = Field(None, gt=0, description="Function Points")
    language: Optional[str] = Field(None, description="Ngôn ngữ lập trình để chuyển đổi FP → KLOC")
    project_mode: str = Field(..., description="Loại dự án: organic | semi-detached | embedded")
    cost_drivers: Dict[str, float] = Field(..., description="Từ điển 15 cost drivers với giá trị multiplier")
    avg_salary: float = Field(..., gt=0, description="Lương trung bình/tháng (USD)")


# ============================================================
# /api/suggest  (AI tự động gợi ý 15 cost drivers)
# ============================================================
class ProjectDescriptionInput(BaseModel):
    """Đầu vào để AI gợi ý cost drivers từ mô tả dự án."""
    description: str = Field(
        ...,
        min_length=20,
        max_length=5000,
        description="Mô tả dự án bằng ngôn ngữ tự nhiên (tiếng Anh hoặc tiếng Việt)"
    )
    project_mode: str = Field("organic", description="Loại dự án gợi ý")
    kloc: Optional[float] = Field(None, gt=0, description="Quy mô ước tính (nếu có)")


# ============================================================
# /api/advise  (AI phân tích sau khi tính COCOMO)
# ============================================================
class AIAdvisorInput(BaseModel):
    """Đầu vào để AI phân tích kết quả COCOMO và đưa ra khuyến nghị."""
    kloc: float = Field(..., description="Quy mô dự án (KLOC)")
    project_mode: str = Field(..., description="Loại dự án")
    effort: float = Field(..., description="Nỗ lực ước tính (Person-Months)")
    time: float = Field(..., description="Thời gian phát triển (Months)")
    cost: float = Field(..., description="Chi phí ước tính (USD)")
    cost_drivers: Dict[str, float] = Field(..., description="15 cost drivers với multiplier hiện tại")
    project_description: Optional[str] = Field(None, description="Mô tả dự án (tùy chọn, cho context tốt hơn)")


# ============================================================
# /api/chat  (AI Chatbot multi-turn)
# ============================================================
class ChatMessage(BaseModel):
    """Một tin nhắn trong cuộc hội thoại."""
    role: Literal["user", "assistant"] = Field(..., description="Vai trò người gửi")
    content: str = Field(..., description="Nội dung tin nhắn")


class ChatRequest(BaseModel):
    """Yêu cầu gửi tới chatbot."""
    messages: List[ChatMessage] = Field(..., description="Lịch sử hội thoại")
    context: Optional[Dict] = Field(None, description="Context dự án (effort, cost, drivers, v.v.)")


# ============================================================
# /api/estimate/fp  (Tính UFP thủ công từ 5 IFPUG components)
# ============================================================
class FPComponent(BaseModel):
    """Số lượng function points theo 3 mức độ phức tạp của một component."""
    simple:  int = Field(0, ge=0, description="Số lượng mức Simple")
    average: int = Field(0, ge=0, description="Số lượng mức Average")
    complex: int = Field(0, ge=0, description="Số lượng mức Complex")


class FPCalculationInput(BaseModel):
    """Đầu vào để tính UFP từ 5 FP components chuẩn IFPUG."""
    EI:  FPComponent = Field(default_factory=FPComponent, description="External Input")
    EO:  FPComponent = Field(default_factory=FPComponent, description="External Output")
    EQ:  FPComponent = Field(default_factory=FPComponent, description="External Query")
    ILF: FPComponent = Field(default_factory=FPComponent, description="Internal Logical File")
    EIF: FPComponent = Field(default_factory=FPComponent, description="External Interface File")


# ============================================================
# /api/estimate/fp/ai  (AI ước tính FP từ mô tả dự án)
# ============================================================
class FPAIEstimateInput(BaseModel):
    """Đầu vào để AI ước tính function point counts từ mô tả dự án."""
    description: str = Field(
        ...,
        min_length=20,
        max_length=5000,
        description="Mô tả dự án để AI phân tích"
    )
    project_mode: str = Field("organic", description="Loại dự án")

# ============================================================
# /api/projects  (CRUD Dự án)
# ============================================================
from datetime import datetime

class ProjectCreate(BaseModel):
    """Thông tin đầu vào khi tạo dự án mới lưu vào database."""
    name: str = Field(..., max_length=200, description="Tên dự án")
    description: Optional[str] = Field(None, description="Mô tả dự án")
    kloc: Optional[float] = None
    fp: Optional[float] = None
    language: Optional[str] = None
    project_mode: str
    cost_drivers: Dict[str, Any]
    avg_salary: float
    effort: Optional[float] = None
    time: Optional[float] = None
    cost: Optional[float] = None

class ProjectUpdate(BaseModel):
    """Thông tin đầu vào khi cập nhật dự án."""
    name: Optional[str] = None
    description: Optional[str] = None
    kloc: Optional[float] = None
    fp: Optional[float] = None
    language: Optional[str] = None
    project_mode: Optional[str] = None
    cost_drivers: Optional[Dict[str, Any]] = None
    avg_salary: Optional[float] = None
    effort: Optional[float] = None
    time: Optional[float] = None
    cost: Optional[float] = None

class ProjectResponse(ProjectCreate):
    """Đối tượng dự án trả về từ database."""
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime
