# P5 · AI-Assisted Software Effort Estimation using COCOMO

> **Môn học**: Software Measurement & Analysis (CMU-CS 462)  
> **Mô hình**: Intermediate COCOMO (Boehm, 1981)  
> **AI Engine**: Google Gemini 2.5 Flash

---

## 🚀 Tính năng chính

| Tính năng                  | Mô tả                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| **COCOMO Engine**          | Intermediate COCOMO: Effort (PM), TDEV (Months), Cost (USD), Staff     |
| **FP → KLOC**              | Chuyển đổi Function Points sang KLOC qua backfiring table (9 ngôn ngữ) |
| **AI Cost Driver Suggest** | Gemini tự động gợi ý 15 cost drivers từ mô tả dự án tự nhiên           |
| **Risk Analysis**          | Phát hiện và phân loại rủi ro (HIGH/MEDIUM/LOW) theo 5 nhóm            |
| **AI Deep Advisor**        | Phân tích chuyên sâu kết quả + chiến lược tối ưu hóa                   |
| **AI Chatbot**             | ChatGPT-style assistant giải thích kết quả multi-turn                  |
| **3 Biểu đồ**              | Radar (EAF phân bổ), Bar (Baseline vs Actual), Gauge (Staff)           |
| **Dark/Light Mode**        | Tự động theo system preference                                         |

---

## 🏗️ Kiến trúc dự án

```
cocomo-ai-estimator/
├── backend/                     # FastAPI server
│   ├── main.py                  # Entry point — 4 API endpoints
│   ├── schemas.py               # Pydantic input/output models
│   ├── requirements.txt
│   ├── services/
│   │   ├── cocomo.py            # COCOMO Intermediate engine
│   │   ├── ai.py                # Gemini AI (suggest + advise + chat)
│   │   └── risk.py              # Risk analysis module
│   └── tests/
│       └── test_cocomo.py       # 20+ test cases
│
├── frontend/                    # React + Vite
│   └── src/
│       ├── App.jsx              # Main layout (4-tab)
│       ├── App.css              # Component styles
│       ├── index.css            # Design system tokens
│       └── components/
│           ├── ProjectSetup.jsx       # Input form
│           ├── CostDriverPanel.jsx    # 15 cost drivers + AI suggest
│           ├── ResultsDashboard.jsx   # Metrics + 3 charts + risk
│           └── AIChatbot.jsx          # Chatbot interface
│
└── .env                         # API keys
```

---

## ⚙️ Cài đặt & Chạy

### Prerequisites

- Python 3.10+
- Node.js 18+
- Google Gemini API Key (miễn phí tại [aistudio.google.com](https://aistudio.google.com))

### 1. Clone và cấu hình

```bash
# Tạo file .env ở thư mục gốc
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

### 2. Chạy Backend

```bash
cd backend

# Tạo virtual environment
python -m venv venv
.\venv\Scripts\activate       # Windows
# source venv/bin/activate    # Linux/Mac

# Cài dependencies
pip install -r requirements.txt

# Chạy server (port 8000)
uvicorn main:app --reload --port 8000
```

Backend sẽ chạy tại: `http://localhost:8000`  
API docs: `http://localhost:8000/docs`

### 3. Chạy Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173`

### 4. Chạy Tests

```bash
cd backend
pytest tests/ -v
```

---

## 🧮 API Endpoints

| Method | Endpoint               | Mô tả                                   |
| ------ | ---------------------- | --------------------------------------- |
| `GET`  | `/api/health`          | Health check                            |
| `POST` | `/api/estimate/cocomo` | Tính toán COCOMO Intermediate           |
| `POST` | `/api/suggest`         | AI gợi ý 15 cost drivers từ mô tả dự án |
| `POST` | `/api/advise`          | AI phân tích kết quả chuyên sâu         |
| `POST` | `/api/chat`            | Chatbot AI multi-turn                   |

---

## 📐 Công thức COCOMO Intermediate

```
E    = a × (KLOC)^b × EAF        [Person-Months]
TDEV = c × (E)^d                  [Months]
Cost = E × avg_monthly_salary     [USD]
Staff = E / TDEV                  [FSP]
EAF  = RELY × DATA × CPLX × ... (×15 drivers)
```

| Mode          | a   | b    | c   | d    |
| ------------- | --- | ---- | --- | ---- |
| Organic       | 3.2 | 1.05 | 2.5 | 0.38 |
| Semi-detached | 3.0 | 1.12 | 2.5 | 0.35 |
| Embedded      | 2.8 | 1.20 | 2.5 | 0.32 |

---

## 📊 Ví dụ Test Cases

### Test Case 1: 50 KLOC Organic (All Nominal)

```
Input:  KLOC=50, Mode=Organic, EAF=1.0, Salary=$3000
Output: E ≈ 196 PM, TDEV ≈ 18 months, Cost ≈ $588,000
```

### Test Case 2: Hệ thống bệnh viện (với AI Suggest)

```
Mô tả: "Hệ thống quản lý bệnh viện 300 giường, 5 khoa phòng,
        uptime 99.9%, team 8 junior dev, go-live 8 tháng"
→ AI gợi ý: RELY=High(1.15), TIME=High(1.11), ACAP=Low(1.19)...
→ EAF ≈ 1.35, Effort tăng 35% so với baseline
```

### Test Case 3: FP Backfiring (Python)

```
Input:  FP=250, Language=Python (40 SLOC/FP) → KLOC=10
Output: E ≈ 35.9 PM, TDEV ≈ 9.75 months
```

---

## 🎯 Sử dụng nhanh

1. **Project Setup**: Nhập KLOC (hoặc FP), chọn Mode, nhập lương
2. **Viết mô tả** (trong phần "Mô tả dự án") → Click "AI Gợi ý từ mô tả"
3. **Review Cost Drivers**: Kiểm tra và điều chỉnh nếu cần
4. **Tính toán**: Click "🧮 Tính toán COCOMO"
5. **Xem Dashboard**: Metric cards, 3 biểu đồ, Risk Analysis
6. **AI Analysis**: Click "Phân tích AI chuyên sâu" để báo cáo chi tiết
7. **Chat**: Chuyển tab Chat để hỏi thêm về kết quả

---

## 🔮 Cải tiến tiếp theo (nâng điểm đồ án)

| Tính năng            | Mô tả                                               | Độ khó |
| -------------------- | --------------------------------------------------- | ------ |
| **PDF Export**       | Xuất báo cáo PDF đẹp có logo, biểu đồ               | ★★★    |
| **Historical DB**    | SQLite lưu lịch sử ước lượng, so sánh               | ★★★    |
| **SRS Auto-extract** | Upload PDF SRS → AI trích xuất FP tự động           | ★★★★   |
| **ML Calibration**   | Scikit-learn calibrate hệ số COCOMO từ data lịch sử | ★★★★   |
| **JIRA Integration** | Nhập story points từ JIRA API                       | ★★★★   |
| **Multi-model**      | Dropdown chọn GPT-4/Claude/Gemini                   | ★★     |
| **Team Simulator**   | Mô phỏng phân bổ công việc theo nhân sự             | ★★★    |
| **COCOMO II**        | Nâng cấp lên COCOMO II.2000 model                   | ★★★★★  |

---

## 👥 Nhóm

- **Môn học**: Software Measurement & Analysis (CMU-CS 462)
- **Đề tài**: P5 — AI-assisted Software Effort Estimation using COCOMO

Xây dựng hệ thống quản lý bệnh viện với 300 giường bao gồm
quản lý bệnh nhân, lịch khám, kê đơn thuốc, thanh toán viện phí,
kết nối 5 khoa phòng. Team 8 developer junior, deadline 8 tháng.
Yêu cầu uptime 99.9%, tích hợp với hệ thống BHYT quốc gia.
