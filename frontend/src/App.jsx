// App.jsx — Main application entry point
// Layout: Header + 2-column grid (Left: tabs config, Right: results/chat)

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { Sun, Moon, CheckCircle, AlertCircle, LogOut } from "lucide-react";
import { COST_DRIVERS_META } from "./components/CostDriverPanel";
import ProjectSetup, { calcUFP } from "./components/ProjectSetup";
import CostDriverPanel from "./components/CostDriverPanel";
import ResultsDashboard from "./components/ResultsDashboard";
import AIChatbot from "./components/AIChatbot";
import AuthModal from "./components/AuthModal";
import SaveProjectModal from "./components/SaveProjectModal";
import ProjectList from "./components/ProjectList";
import { useAuth } from "./context/AuthContext";
import "./App.css";

// ─── Initial state helpers ──────────────────────────────────────────────
const DEFAULT_DRIVERS = Object.fromEntries(
    COST_DRIVERS_META.map((d) => [d.id, "1.00"])
);

const DEFAULT_SETUP = {
    sizeType: "KLOC",
    kloc: "10",
    language: "Python",
    mode: "organic",
    salary: "2000",
    description: "",
    fpMode: "manual",
    fpComponents: {
        EI: { simple: 0, average: 0, complex: 0 },
        EO: { simple: 0, average: 0, complex: 0 },
        EQ: { simple: 0, average: 0, complex: 0 },
        ILF: { simple: 0, average: 0, complex: 0 },
        EIF: { simple: 0, average: 0, complex: 0 },
    },
};

// ─── Tab definitions ────────────────────────────────────────────────────
const TABS = [
    { id: "setup", label: "Project Setup", desc: "KLOC, Mode, Lương" },
    { id: "drivers", label: "Cost Drivers", desc: "15 yếu tố COCOMO" },
    { id: "results", label: "Dashboard", desc: "Kết quả & biểu đồ" },
    { id: "chat", label: "AI Assistant", desc: "Chatbot giải thích" },
    { id: "projects", label: "My Projects", desc: "Lịch sử dự án" },
];

// ────────────────────────────────────────────────────────────────────────
export default function App() {
    const { user, session, logout } = useAuth();

    // ── State ────────────────────────────────────────────────────────
    const [activeTab, setActiveTab] = useState("setup");
    const [setup, setSetup] = useState(DEFAULT_SETUP);
    const [drivers, setDrivers] = useState(DEFAULT_DRIVERS);
    const [result, setResult] = useState(null);
    const [aiAdvice, setAiAdvice] = useState("");
    const [isCalculating, setIsCalculating] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Project Save/Load state
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Toast state
    const [toast, setToast] = useState({ visible: false, message: "", type: "success" });
    const toastTimeoutRef = useRef(null);

    const showToast = (message, type = "success") => {
        setToast({ visible: true, message, type });
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
    };
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem("cocomo-theme");
        if (saved) return saved;
        return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
    });

    // ── Theme & Axios Auth ───────────────────────────────────────────
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("cocomo-theme", theme);
    }, [theme]);

    useEffect(() => {
        if (session?.access_token) {
            axios.defaults.headers.common["Authorization"] = `Bearer ${session.access_token}`;
        } else {
            delete axios.defaults.headers.common["Authorization"];
        }
    }, [session]);

    // ── Validate inputs ──────────────────────────────────────────────
    const validateInputs = useCallback(() => {
        const salary = parseFloat(setup.salary);
        if (isNaN(salary) || salary <= 0) {
            return "Vui lòng nhập mức lương hợp lệ (> 0)!";
        }
        if (setup.sizeType === "KLOC") {
            const kloc = parseFloat(setup.kloc);
            if (isNaN(kloc) || kloc <= 0) return "Vui lòng nhập số KLOC hợp lệ (> 0)!";
        } else {
            const ufp = calcUFP(setup.fpComponents);
            if (ufp <= 0) return "Vui lòng nhập ít nhất 1 Function Point trong bảng FP Calculator!";
        }
        return null;
    }, [setup]);

    // ── Build API payload ────────────────────────────────────────────
    const buildPayload = useCallback(() => {
        const payload = {
            project_mode: setup.mode,
            avg_salary: parseFloat(setup.salary),
            cost_drivers: Object.fromEntries(
                Object.entries(drivers).map(([k, v]) => [k, parseFloat(v)])
            ),
        };
        if (setup.sizeType === "KLOC") {
            payload.kloc = parseFloat(setup.kloc);
        } else {
            // Tính UFP từ fpComponents rồi dùng backfiring
            payload.fp = calcUFP(setup.fpComponents);
            payload.language = setup.language;
        }
        return payload;
    }, [setup, drivers]);

    // ── Calculate COCOMO ─────────────────────────────────────────────
    const handleEstimate = async () => {
        const err = validateInputs();
        if (err) { showToast(err, "error"); return; }

        setIsCalculating(true);
        setAiAdvice("");

        try {
            const response = await axios.post(
                "http://localhost:8000/api/estimate/cocomo",
                buildPayload()
            );

            if (response.data.status === "success") {
                setResult(response.data.data);
                setActiveTab("results"); // Auto-navigate to results
            } else {
                showToast("Lỗi: " + response.data.detail, "error");
            }
        } catch (error) {
            const msg = error.response?.data?.detail || "Backend không phản hồi. Kiểm tra server!";
            showToast("❌ " + msg, "error");
        } finally {
            setIsCalculating(false);
        }
    };

    // ── AI Analyze (deep analysis) ───────────────────────────────────
    const handleAnalyze = async () => {
        if (!result) return;
        setIsAnalyzing(true);
        setAiAdvice("");

        try {
            const payload = {
                kloc: result.final_kloc,
                project_mode: setup.mode,
                effort: result.effort_person_months,
                time: result.development_time_months,
                cost: result.estimated_cost,
                cost_drivers: Object.fromEntries(
                    Object.entries(drivers).map(([k, v]) => [k, parseFloat(v)])
                ),
                project_description: setup.description || undefined,
            };
            const response = await axios.post("http://localhost:8000/api/advise", payload);
            setAiAdvice(response.data.advice || "");
        } catch {
            setAiAdvice("❌ AI không phản hồi. Kiểm tra backend và API key.");
            showToast("Lỗi kết nối đến AI Advisor", "error");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // ── Project Management ───────────────────────────────────────────
    const handleSaveProject = async (name, description) => {
        setIsSaving(true);
        try {
            const payload = buildPayload();
            const projectData = {
                name,
                description,
                kloc: payload.kloc,
                fp: payload.fp,
                language: payload.language,
                project_mode: payload.project_mode,
                cost_drivers: {
                    ...payload.cost_drivers,
                    __fpComponents: setup.sizeType === "FP" ? setup.fpComponents : undefined,
                    __aiAdvice: aiAdvice || undefined
                },
                avg_salary: payload.avg_salary,
                effort: result?.effort_person_months,
                time: result?.development_time_months,
                cost: result?.estimated_cost
            };

            await axios.post("http://localhost:8000/api/projects", projectData);
            showToast("Đã lưu dự án thành công!", "success");
            setShowSaveModal(false);
        } catch (error) {
            const msg = error.response?.data?.detail || "Không thể lưu dự án. Thử lại sau.";
            showToast("❌ " + msg, "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadProject = (project) => {
        // Restore drivers and extract internal __fpComponents if any
        let loadedDrivers = project.cost_drivers || {};
        let loadedFpComponents = null;
        let loadedAiAdvice = "";

        if (loadedDrivers.__fpComponents) {
            loadedFpComponents = loadedDrivers.__fpComponents;
            delete loadedDrivers.__fpComponents;
        }

        if (loadedDrivers.__aiAdvice) {
            loadedAiAdvice = loadedDrivers.__aiAdvice;
            delete loadedDrivers.__aiAdvice;
        }

        if (Object.keys(loadedDrivers).length > 0) {
            setDrivers(loadedDrivers);
        }

        // Restore setup
        setSetup(prev => ({
            ...prev,
            mode: project.project_mode || "organic",
            salary: project.avg_salary ? String(project.avg_salary) : "2000",
            description: project.description || "",
            sizeType: project.kloc ? "KLOC" : "FP",
            kloc: project.kloc ? String(project.kloc) : "10",
            language: project.language || "Python",
            ...(loadedFpComponents && { fpComponents: loadedFpComponents })
        }));

        // Restore result conceptually by recalculating or displaying saved stats
        if (project.effort != null && project.time != null && project.cost != null) {
            // Tái tạo lại EAF từ mảng drivers
            const eaf = Object.values(loadedDrivers).reduce((acc, curr) => acc * parseFloat(curr), 1);

            setResult({
                final_kloc: project.kloc,
                effort_person_months: project.effort,
                development_time_months: project.time,
                estimated_cost: project.cost,
                eaf_applied: eaf.toFixed(2),
                required_staff: Math.ceil(project.effort / project.time)
            });
            setActiveTab("results");
            showToast(`Đã tải dự án "${project.name}". Xem kết quả ngay trên Dashboard!`, "info");
        } else {
            setResult(null);
            setActiveTab("setup");
            showToast(`Đã tải dự án "${project.name}". Vui lòng bấm Tính toán để xem lại kết quả.`, "info");
        }

        setAiAdvice(loadedAiAdvice);
    };

    // ── Export JSON ──────────────────────────────────────────────────
    const handleExport = () => {
        const ufp = setup.sizeType === "FP" ? calcUFP(setup.fpComponents) : null;
        const report = {
            projectName: "COCOMO Estimation Report",
            generatedAt: new Date().toISOString(),
            parameters: {
                sizeInput: setup.sizeType === "KLOC"
                    ? `${setup.kloc} KLOC`
                    : `${ufp} UFP (${setup.language})`,
                finalKloc: result?.final_kloc,
                mode: setup.mode,
                avgSalary: setup.salary,
                costDrivers: drivers,
                description: setup.description,
                ...(setup.sizeType === "FP" && {
                    fpComponents: setup.fpComponents,
                    ufp,
                }),
            },
            results: result,
            aiInsights: aiAdvice,
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
        const a = document.createElement("a");
        a.href = dataStr;
        a.download = `cocomo_report_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    // ── Chat context ─────────────────────────────────────────────────
    const chatContext = result
        ? {
            kloc: result.final_kloc,
            mode: setup.mode,
            effort: result.effort_person_months,
            time: result.development_time_months,
            cost: result.estimated_cost,
            eaf: result.eaf_applied,
            cost_drivers: Object.fromEntries(
                Object.entries(drivers).map(([k, v]) => [k, parseFloat(v)])
            ),
        }
        : null;

    // ── Render ───────────────────────────────────────────────────────
    if (!user) {
        return (
            <div className="app-container" style={{ position: "relative", minHeight: "100vh" }}>
                <AuthModal />
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* ════ HEADER ════════════════════════════════════════════ */}
            <header className="header">
                <div className="header-left">
                    <div className="header-logo">
                        <div>
                            <h1 className="title">COCOMO AI Estimator</h1>
                        </div>
                    </div>
                </div>

                <div className="header-right">
                    <div className="user-profile-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 14px', background: 'var(--panel-bg)', borderRadius: '30px', border: '1px solid var(--panel-border)', marginRight: '1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                        <div className="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1rem' }}>
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Tài khoản</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.email}
                            </span>
                        </div>
                        <div style={{ width: '1px', height: '24px', background: 'var(--panel-border)', margin: '0 4px' }}></div>
                        <button
                            className="btn-icon"
                            style={{ padding: '6px', color: 'var(--accent-red)', margin: 0 }}
                            onClick={logout}
                            title="Đăng xuất"
                        >
                            <LogOut size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    {result && (
                        <div className="header-summary">
                            <span className="hs-item">
                                <span className="hs-label">Effort</span>
                                <strong>{result.effort_person_months} PM</strong>
                            </span>
                            <span className="hs-divider">·</span>
                            <span className="hs-item">
                                <span className="hs-label">Time</span>
                                <strong>{result.development_time_months}M</strong>
                            </span>
                            <span className="hs-divider">·</span>
                            <span className="hs-item">
                                <span className="hs-label">Cost</span>
                                <strong>${result.estimated_cost?.toLocaleString()}</strong>
                            </span>
                        </div>
                    )}
                    <button
                        id="btn-theme-toggle"
                        className="theme-toggle"
                        onClick={() => setTheme((p) => (p === "dark" ? "light" : "dark"))}
                        title="Chuyển giao diện"
                    >
                        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                </div>
            </header>

            {/* ════ MAIN LAYOUT: Left panel + Right panel ═════════════ */}
            <main className="main-content">

                {/* ── LEFT: Tab Navigation + Content ─────────────────── */}
                <aside className="left-panel glass-panel">
                    {/* Tab nav */}
                    <nav className="tab-nav">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                id={`tab-${tab.id}`}
                                className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <span className="tab-label">{tab.label}</span>
                                <span className="tab-desc">{tab.desc}</span>
                            </button>
                        ))}
                    </nav>

                    {/* Tab content */}
                    <div className="tab-content">
                        {activeTab === "setup" && (
                            <ProjectSetup
                                values={setup}
                                onChange={setSetup}
                            />
                        )}
                        {activeTab === "drivers" && (
                            <CostDriverPanel
                                drivers={drivers}
                                onChange={setDrivers}
                                description={setup.description}
                                mode={setup.mode}
                                kloc={setup.sizeType === "KLOC" ? setup.kloc : null}
                            />
                        )}
                        {activeTab === "results" && (
                            <div className="side-summary">
                                {result ? (
                                    <>
                                        <p className="summary-hint">Kết quả đã tính. Xem Dashboard bên phải.</p>
                                        <div className="summary-mini">
                                            <div className="sm-row"><span>KLOC</span><strong>{result.final_kloc}</strong></div>
                                            <div className="sm-row"><span>EAF</span><strong>{result.eaf_applied}</strong></div>
                                            <div className="sm-row"><span>Effort</span><strong>{result.effort_person_months} PM</strong></div>
                                            <div className="sm-row"><span>Time</span><strong>{result.development_time_months} M</strong></div>
                                            <div className="sm-row"><span>Staff</span><strong>{result.required_staff} người</strong></div>
                                        </div>
                                    </>
                                ) : (
                                    <p className="summary-hint">Chưa có kết quả. Hãy tính toán COCOMO trước.</p>
                                )}
                            </div>
                        )}
                        {activeTab === "chat" && (
                            <div className="side-summary">
                                <p className="summary-hint">Chat AI ở bên phải. Hỏi về kết quả COCOMO, cost drivers, strategies...</p>
                                {!result && (
                                    <p className="summary-hint warn">Tính toán COCOMO trước để AI có context cụ thể.</p>
                                )}
                            </div>
                        )}
                        {activeTab === "projects" && (
                            <div className="side-summary">
                                <p className="summary-hint">Quản lý lịch sử phân tích tĩnh và các dự án đã lưu.</p>
                            </div>
                        )}
                    </div>

                    {/* ── Calculate Button ─────────────────────────── */}
                    <div className="left-panel-footer">
                        <button
                            id="btn-calculate"
                            className={`btn-primary btn-calculate ${isCalculating ? "loading" : ""}`}
                            onClick={handleEstimate}
                            disabled={isCalculating}
                        >
                            {isCalculating ? (
                                <><span className="spinner" /> Đang tính toán...</>
                            ) : (
                                "Tính toán COCOMO"
                            )}
                        </button>
                    </div>
                </aside>

                {/* ── RIGHT: Dashboard / Chat / Projects ─────────────────────────── */}
                <section className="right-panel">
                    {activeTab === "projects" ? (
                        <div className="dashboard-wrapper">
                            <div className="glass-panel" style={{ padding: '24px', marginBottom: '20px' }}>
                                <h2 style={{ margin: '0 0 10px 0' }}>Dự án của tôi</h2>
                                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Quản lý và xem lại những setup, kết quả bạn đã lưu.</p>
                            </div>
                            <ProjectList onLoadProject={handleLoadProject} />
                        </div>
                    ) : activeTab === "chat" ? (
                        <AIChatbot projectContext={chatContext} />
                    ) : (
                        <div className="dashboard-wrapper">
                            <ResultsDashboard
                                result={result}
                                drivers={drivers}
                                onExport={handleExport}
                                onAnalyze={handleAnalyze}
                                onSave={() => setShowSaveModal(true)}
                                isAnalyzing={isAnalyzing}
                                isSaving={isSaving}
                            />

                            {/* AI Deep Analysis output */}
                            {aiAdvice && (
                                <div className="glass-panel ai-advice-panel">
                                    <h3 className="ai-advice-title">Phân tích AI chuyên sâu</h3>
                                    <div className="ai-advice markdown-body">
                                        <ReactMarkdown>{aiAdvice}</ReactMarkdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </main>

            {/* Modal & Overlays */}
            {showSaveModal && (
                <SaveProjectModal
                    onClose={() => setShowSaveModal(false)}
                    onSave={handleSaveProject}
                    isSaving={isSaving}
                />
            )}

            {/* Custom Toast Notification */}
            <div className={`toast-container ${toast.type} ${toast.visible ? 'show' : ''}`}>
                {toast.type === "success" ? <CheckCircle className="toast-icon" size={20} /> : <AlertCircle className="toast-icon" size={20} />}
                <span className="toast-message">{toast.message}</span>
            </div>
        </div>
    );
}
