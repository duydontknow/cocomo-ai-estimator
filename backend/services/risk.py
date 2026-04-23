"""
services/risk.py — Phân tích Risk Factors từ Cost Drivers và quy mô dự án.

Module này tự động phân loại và đánh giá rủi ro dự án dựa trên:
  - Giá trị các cost drivers (so với ngưỡng nguy hiểm)
  - Quy mô dự án (KLOC)
  - Loại dự án (organic / semi-detached / embedded)

Output: Danh sách RiskFactor objects phân loại theo mức độ: HIGH / MEDIUM / LOW
"""

from typing import Dict, List
from dataclasses import dataclass


# ============================================================
# Data Classes
# ============================================================

@dataclass
class RiskFactor:
    """Đại diện cho một yếu tố rủi ro được phát hiện."""
    category: str        # Schedule | Cost | Quality | Technical | Personnel
    level: str           # HIGH | MEDIUM | LOW
    driver: str          # Tên cost driver gây ra rủi ro (hoặc "Size")
    title: str           # Tiêu đề ngắn gọn
    description: str     # Mô tả chi tiết bằng tiếng Việt
    recommendation: str  # Khuyến nghị khắc phục


# ============================================================
# Ngưỡng cảnh báo theo từng cost driver
# ============================================================

# Mỗi entry: (threshold, level, category, title_vn, desc_vn, rec_vn)
DRIVER_RISK_RULES: Dict[str, List[tuple]] = {
    "RELY": [
        (1.40, "HIGH", "Quality",
         "Yêu cầu độ tin cậy CỰC CAO",
         "Phần mềm yêu cầu độ tin cậy rất cao → tăng 40% effort. Rủi ro trễ deadline và vượt ngân sách.",
         "Đầu tư mạnh vào test tự động, code review nghiêm ngặt và CI/CD pipeline."),
        (1.15, "MEDIUM", "Quality",
         "Yêu cầu độ tin cậy CAO",
         "Yêu cầu reliability cao hơn nominal, cần thêm effort cho testing.",
         "Thiết lập test coverage ≥ 80%, thực hiện integration testing đầy đủ."),
    ],
    "CPLX": [
        (1.65, "HIGH", "Technical",
         "Độ phức tạp NGOÀI MỨC",
         "Sản phẩm có độ phức tạp cực cao (Extra High) → tăng 65% effort. Nguy cơ delay rất lớn.",
         "Chia nhỏ thành microservices, dùng design patterns phù hợp, tăng thời gian cho kiến trúc."),
        (1.30, "HIGH", "Technical",
         "Độ phức tạp RẤT CAO",
         "Sản phẩm phức tạp (Very High) → tăng 30% effort.",
         "Tăng thời gian thiết kế. Phân tách module. Tuyển senior developers."),
        (1.15, "MEDIUM", "Technical",
         "Độ phức tạp CAO",
         "Sản phẩm có độ phức tạp cao hơn mức trung bình.",
         "Dành thêm sprint cho refactoring và technical debt reduction."),
    ],
    "TIME": [
        (1.66, "HIGH", "Schedule",
         "Ràng buộc thời gian CỰC KỲ NGHIÊM NGẶT",
         "Hệ thống phải sử dụng ≥ 95% CPU → rủi ro bottleneck nghiêm trọng.",
         "Cân nhắc scale-out kiến trúc, dùng async/concurrent processing, profiling kỹ."),
        (1.30, "HIGH", "Schedule",
         "Ràng buộc thời gian RT NGHIÊM NGẶT",
         "Hệ thống dùng 70-85% tài nguyên thời gian → có thể gây bottleneck.",
         "Tối ưu hóa performance sớm, không để đến giai đoạn cuối."),
        (1.11, "MEDIUM", "Schedule",
         "Ràng buộc thời gian TRÊN TRUNG BÌNH",
         "Hệ thống cần 70% tài nguyên thời gian thực thi.",
         "Giám sát performance liên tục từ giai đoạn đầu."),
    ],
    "STOR": [
        (1.56, "HIGH", "Technical",
         "Ràng buộc bộ nhớ CỰC KỲ NGHIÊM NGẶT",
         "Hệ thống yêu cầu ≥ 95% RAM → rủi ro OOM và crash không dự đoán được.",
         "Thiết kế memory-efficient từ đầu. Dùng streaming thay vì load toàn bộ."),
        (1.21, "MEDIUM", "Technical",
         "Ràng buộc bộ nhớ NGHIÊM NGẶT",
         "Hệ thống cần dùng 70-85% RAM. Cần quản lý bộ nhớ cẩn thận.",
         "Dùng lazy loading, implement caching thông minh, monitor memory usage."),
    ],
    "VIRT": [
        (1.30, "HIGH", "Technical",
         "Môi trường ảo hóa THAY ĐỔI NHIỀU",
         "Platform/VM thay đổi thường xuyên → rủi ro re-testing liên tục.",
         "Containerize với Docker để tách biệt môi trường. Dùng Infrastructure as Code."),
        (1.15, "MEDIUM", "Technical",
         "Môi trường ảo hóa KHÔNG ỔN ĐỊNH",
         "Virtual machine có thay đổi định kỳ.",
         "Viết integration tests tốt để phát hiện breaking changes sớm."),
    ],
    "ACAP": [
        (1.46, "HIGH", "Personnel",
         "Năng lực Analyst RẤT YẾU",
         "Team phân tích không có kinh nghiệm → rủi ro sai requirements, phải làm lại nhiều.",
         "Thuê senior BA hoặc mentor. Thực hiện requirement review kỹ lưỡng với stakeholders."),
        (1.19, "MEDIUM", "Personnel",
         "Năng lực Analyst DƯỚI TRUNG BÌNH",
         "Khả năng phân tích yêu cầu còn hạn chế.",
         "Tổ chức workshop requirements với product owner. Dùng user story mapping."),
    ],
    "PCAP": [
        (1.42, "HIGH", "Personnel",
         "Năng lực Lập trình viên RẤT YẾU",
         "Developer chưa có kinh nghiệm → effort tăng 42%, rủi ro bugs và technical debt cao.",
         "Tăng cường code review, pair programming. Cân nhắc thuê thêm senior dev."),
        (1.17, "MEDIUM", "Personnel",
         "Năng lực Lập trình viên DƯỚI TRUNG BÌNH",
         "Trình độ lập trình viên chưa đủ mạnh.",
         "Tổ chức training nội bộ, áp dụng pair programming với senior leads."),
    ],
    "AEXP": [
        (1.29, "HIGH", "Personnel",
         "Kinh nghiệm nghiệp vụ RẤT THẤP",
         "Team thiếu kinh nghiệm trong domain này → mất thời gian học domain knowledge.",
         "Mời domain expert tham gia dự án. Dành sprint đầu để team nghiên cứu domain."),
        (1.13, "MEDIUM", "Personnel",
         "Kinh nghiệm nghiệp vụ THẤP",
         "Team còn ít kinh nghiệm với loại ứng dụng này.",
         "Tổ chức knowledge sharing sessions, đọc case studies tương tự."),
    ],
    "SCED": [
        (1.23, "HIGH", "Schedule",
         "Lịch trình BỊ RÚT NGẮN NHIỀU",
         "Deadline quá gấp → áp lực cao, dễ bỏ qua quality.",
         "Cắt giảm scope thay vì cắt chất lượng. Đàm phán lại deadline với stakeholders."),
        (1.10, "MEDIUM", "Schedule",
         "Lịch trình HƠPÁP LỰC",
         "Timeline bị nén tương đối, có thể ảnh hưởng chất lượng.",
         "Ưu tiên must-have features, defer nice-to-have sang phase sau."),
    ],
}

# Ngưỡng cảnh báo dựa trên quy mô dự án (KLOC)
SIZE_RISK_RULES = [
    (500, "HIGH", "Schedule",
     "Dự án SIÊU LỚN (>500 KLOC)",
     "Dự án cực kỳ lớn → rủi ro coordination, communication và integration nghiêm trọng.",
     "Chia thành nhiều sub-projects độc lập. Dùng microservices architecture."),
    (100, "HIGH", "Cost",
     "Dự án RẤT LỚN (>100 KLOC)",
     "Độ phức tạp quản lý tăng phi tuyến. Rủi ro scope creep và overrun ngân sách rất cao.",
     "Áp dụng Agile với sprint rõ ràng. Review ngân sách định kỳ mỗi tháng."),
    (50, "MEDIUM", "Cost",
     "Dự án LỚN (>50 KLOC)",
     "Quy mô đáng kể, cần quản lý rủi ro chủ động.",
     "Chia milestone rõ ràng. Duy trì buffer 20% trong ngân sách."),
    (20, "LOW", "Schedule",
     "Dự án CỠ VỪA (>20 KLOC)",
     "Quy mô vừa phải, cần quản lý tốt để tránh scope creep.",
     "Thiết lập change control process rõ ràng."),
]


# ============================================================
# Public API
# ============================================================

def analyze_risks(
    kloc: float,
    mode: str,
    cost_drivers: Dict[str, float],
) -> List[dict]:
    """
    Phân tích rủi ro dự án dựa trên cost drivers và quy mô.

    Args:
        kloc: Quy mô dự án (Kilo Lines of Code)
        mode: Loại dự án (organic / semi-detached / embedded)
        cost_drivers: Dict {driver_id: multiplier_value}

    Returns:
        Danh sách các risk factors (có thể rỗng nếu dự án ổn định)
    """
    risks: List[RiskFactor] = []

    # ── Kiểm tra từng cost driver ──────────────────────────────────────
    for driver_id, value in cost_drivers.items():
        rules = DRIVER_RISK_RULES.get(driver_id, [])
        for threshold, level, category, title, desc, rec in rules:
            if value >= threshold:
                risks.append(RiskFactor(
                    category=category,
                    level=level,
                    driver=driver_id,
                    title=title,
                    description=desc,
                    recommendation=rec,
                ))
                break  # Chỉ lấy rule đầu tiên (cao nhất) khớp

    # ── Kiểm tra quy mô dự án ──────────────────────────────────────────
    for size_threshold, level, category, title, desc, rec in SIZE_RISK_RULES:
        if kloc >= size_threshold:
            risks.append(RiskFactor(
                category=category,
                level=level,
                driver="Size",
                title=title,
                description=f"{desc} (Dự án của bạn: {kloc} KLOC)",
                recommendation=rec,
            ))
            break

    # ── EAF tổng hợp: Nếu > 1.5, cảnh báo tổng thể ────────────────────
    eaf = 1.0
    for v in cost_drivers.values():
        eaf *= float(v)
    if eaf > 1.5:
        risks.append(RiskFactor(
            category="Cost",
            level="HIGH",
            driver="EAF",
            title=f"EAF rất cao ({eaf:.3f})",
            description=f"EAF tổng hợp = {eaf:.3f} > 1.5 → nỗ lực thực tế có thể cao hơn 50% so với baseline COCOMO. Dự án đang chịu áp lực đa chiều.",
            recommendation="Review lại tất cả cost drivers. Ưu tiên giải quyết nhân sự (ACAP, PCAP) vì có tác động lớn nhất.",
        ))

    # Sắp xếp: HIGH trước, MEDIUM sau, LOW cuối
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    risks.sort(key=lambda r: order.get(r.level, 3))

    # Chuyển về dict để serialization dễ hơn
    return [
        {
            "category": r.category,
            "level": r.level,
            "driver": r.driver,
            "title": r.title,
            "description": r.description,
            "recommendation": r.recommendation,
        }
        for r in risks
    ]
