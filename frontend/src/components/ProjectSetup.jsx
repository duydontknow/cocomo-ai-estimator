// components/ProjectSetup.jsx
// Module nhập liệu dự án: KLOC / FP (chuẩn IFPUG), loại dự án, lương, mô tả

import { useState } from "react";
import axios from "axios";
import { ChevronDown } from "lucide-react";

// ── IFPUG Weights (Boehm / IFPUG 4.3) ────────────────────────────────────────
export const FP_WEIGHTS = {
    EI:  { simple: 3, average: 4,  complex: 6  },
    EO:  { simple: 4, average: 5,  complex: 7  },
    EQ:  { simple: 3, average: 4,  complex: 6  },
    ILF: { simple: 7, average: 10, complex: 15 },
    EIF: { simple: 5, average: 7,  complex: 10 },
};

export const FP_COMPONENT_META = {
    EI:  { label: "EI",  name: "External Input",         desc: "Form nhập, file upload, API nhận data để thêm/sửa/xóa" },
    EO:  { label: "EO",  name: "External Output",        desc: "Báo cáo, màn hình có tính toán, export có derived data" },
    EQ:  { label: "EQ",  name: "External Query",         desc: "Tìm kiếm, lấy danh sách, get by ID không có tính toán" },
    ILF: { label: "ILF", name: "Internal Logical File",  desc: "Bảng CSDL nội bộ hệ thống này quản lý (create/update/delete)" },
    EIF: { label: "EIF", name: "External Interface File", desc: "File/DB hệ thống ngoài mà hệ thống này chỉ đọc" },
};

// Tính UFP từ fpComponents object
export function calcUFP(fpComponents) {
    return Object.entries(fpComponents).reduce((total, [comp, counts]) => {
        const w = FP_WEIGHTS[comp];
        if (!w) return total;
        return total
            + (parseInt(counts.simple)  || 0) * w.simple
            + (parseInt(counts.average) || 0) * w.average
            + (parseInt(counts.complex) || 0) * w.complex;
    }, 0);
}

function calcRowSubtotal(comp, counts) {
    const w = FP_WEIGHTS[comp];
    return (parseInt(counts.simple) || 0) * w.simple
         + (parseInt(counts.average) || 0) * w.average
         + (parseInt(counts.complex) || 0) * w.complex;
}

// ── Project Mode Info ─────────────────────────────────────────────────────────
const PROJECT_MODE_INFO = {
    organic: {
        label: "Organic",
        description: "Nhóm nhỏ, kinh nghiệm tốt, yêu cầu linh hoạt. Ví dụ: ứng dụng nội bộ, script tự động hóa.",
        badge: "Đơn giản nhất", badgeClass: "badge-green",
    },
    "semi-detached": {
        label: "Semi-detached",
        description: "Nhóm hỗn hợp, yêu cầu trung bình. Ví dụ: hệ thống thông tin, ứng dụng doanh nghiệp.",
        badge: "Trung bình", badgeClass: "badge-yellow",
    },
    embedded: {
        label: "Embedded",
        description: "Ràng buộc nghiêm ngặt về hardware/realtime. Ví dụ: firmware, hệ thống điều khiển.",
        badge: "Phức tạp nhất", badgeClass: "badge-red",
    },
};

export const LANGUAGE_BACKFIRING = {
    "Assembly":   320,
    "C":          128,
    "HTML":        40,
    "C++":         64,
    "Java":        53,
    "Python":      40,
    "C#":          58,
    "SQL":         21,
    "JavaScript":  47,
};

const LANGUAGES = Object.keys(LANGUAGE_BACKFIRING).sort();

// ═════════════════════════════════════════════════════════════════════════
// Sub-component: FP Manual Calculator (bảng 5×3)
// ═════════════════════════════════════════════════════════════════════════
function FPManualCalculator({ fpComponents, onChange }) {
    const ufp = calcUFP(fpComponents);

    const handleCell = (comp, level, val) => {
        const parsed = Math.max(0, parseInt(val) || 0);
        onChange({
            ...fpComponents,
            [comp]: { ...fpComponents[comp], [level]: parsed },
        });
    };

    return (
        <div className="fp-calculator">
            <div className="fp-table-wrap">
                <table className="fp-table">
                    <thead>
                        <tr>
                            <th className="col-label">Component</th>
                            <th>Simple<br /><span className="fp-weight-hint">(×weight)</span></th>
                            <th>Average<br /><span className="fp-weight-hint">(×weight)</span></th>
                            <th>Complex<br /><span className="fp-weight-hint">(×weight)</span></th>
                            <th className="col-pts">Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(FP_COMPONENT_META).map(([comp, meta]) => {
                            const w = FP_WEIGHTS[comp];
                            const counts = fpComponents[comp] || { simple: 0, average: 0, complex: 0 };
                            const subtotal = calcRowSubtotal(comp, counts);
                            return (
                                <tr key={comp}>
                                    <td>
                                        <span className="fp-comp-id">{meta.label}</span>
                                        <span className="fp-comp-full">{meta.name}</span>
                                        <div className="fp-comp-desc">{meta.desc}</div>
                                    </td>
                                    {["simple", "average", "complex"].map(level => (
                                        <td key={level}>
                                            <div className="fp-cell-wrap">
                                                <input
                                                    id={`fp-${comp}-${level}`}
                                                    type="number"
                                                    min="0"
                                                    className="fp-count-input"
                                                    value={counts[level] === 0 ? "" : counts[level]}
                                                    placeholder="0"
                                                    onChange={e => handleCell(comp, level, e.target.value)}
                                                />
                                                <span className="fp-weight-hint">×{w[level]}</span>
                                            </div>
                                        </td>
                                    ))}
                                    <td>
                                        <span className={`fp-subtotal ${subtotal > 0 ? "nonzero" : ""}`}>
                                            {subtotal}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="fp-total-row">
                            <td colSpan={4} className="fp-total-label">UFP Total (Unadjusted Function Points)</td>
                            <td><span className="ufp-badge">{ufp}</span></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            {ufp === 0 && (
                <p className="textarea-hint" style={{ marginTop: 8 }}>
                    Nhập số lượng của từng loại function. UFP sẽ tự động tính theo bảng trọng số IFPUG.
                </p>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Sub-component: FP AI Estimator
// ═════════════════════════════════════════════════════════════════════════
function FPAIEstimator({ description, projectMode, onApply }) {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");

    const hasDescription = description && description.trim().length >= 20;

    const handleEstimate = async () => {
        if (!hasDescription) {
            setError("Vui lòng nhập mô tả dự án (ít nhất 20 ký tự) ở phần 'Mô tả dự án' bên dưới trước.");
            return;
        }
        setError("");
        setIsLoading(true);
        setResult(null);
        try {
            const res = await axios.post("/api/estimate/fp/ai", {
                description: description.trim(),
                project_mode: projectMode,
            });
            setResult(res.data.data);
        } catch (err) {
            const msg = err.response?.data?.detail || "AI ước tính FP thất bại. Kiểm tra backend và API key.";
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (!result) return;
        const comps = {};
        Object.keys(FP_WEIGHTS).forEach(comp => {
            const c = result.components[comp] || {};
            comps[comp] = {
                simple:  c.simple  || 0,
                average: c.average || 0,
                complex: c.complex || 0,
            };
        });
        onApply(comps);
    };

    return (
        <div className="fp-ai-section">
            {/* Description status */}
            <div className="fp-ai-desc-hint">
                {hasDescription ? (
                    <>
                        <strong>Mô tả dự án hiện tại:</strong>
                        <p className="fp-ai-desc-preview">"{description.trim().slice(0, 150)}{description.length > 150 ? "..." : ""}"</p>
                    </>
                ) : (
                    <span style={{ color: "var(--accent-orange)" }}>
                        Chưa có mô tả dự án. Vui lòng nhập mô tả ở phần bên dưới (tối thiểu 20 ký tự) để AI có thể phân tích.
                    </span>
                )}
            </div>

            {/* Estimate button */}
            <button
                id="btn-fp-ai-estimate"
                className="btn-fp-ai"
                onClick={handleEstimate}
                disabled={isLoading || !hasDescription}
            >
                {isLoading ? (
                    <><span className="spinner" /> Đang phân tích FP...</>
                ) : (
                    "Ước tính Function Points bằng AI"
                )}
            </button>

            {/* Error */}
            {error && <div className="fp-error">{error}</div>}

            {/* Result */}
            {result && (
                <div className="fp-ai-result">
                    {result.overall_reasoning && (
                        <div className="fp-ai-overall">
                            <strong>Nhận xét tổng quan:</strong> {result.overall_reasoning}
                        </div>
                    )}

                    <table className="fp-table">
                        <thead>
                            <tr>
                                <th className="col-label">Component</th>
                                <th>Simple</th>
                                <th>Average</th>
                                <th>Complex</th>
                                <th className="col-pts">Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(FP_COMPONENT_META).map(([comp, meta]) => {
                                const c = result.components?.[comp] || {};
                                const bd = result.breakdown?.[comp] || {};
                                return (
                                    <>
                                        <tr key={comp}>
                                            <td>
                                                <span className="fp-comp-id">{meta.label}</span>
                                                <span className="fp-comp-full">{meta.name}</span>
                                            </td>
                                            <td style={{ textAlign: "center" }}>{c.simple ?? 0}</td>
                                            <td style={{ textAlign: "center" }}>{c.average ?? 0}</td>
                                            <td style={{ textAlign: "center" }}>{c.complex ?? 0}</td>
                                            <td>
                                                <span className={`fp-subtotal ${bd.subtotal > 0 ? "nonzero" : ""}`}>
                                                    {bd.subtotal ?? 0}
                                                </span>
                                            </td>
                                        </tr>
                                        {c.reasoning && (
                                            <tr key={`${comp}-reason`}>
                                                <td colSpan={5} className="fp-ai-row-reasoning">
                                                    {c.reasoning}
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="fp-total-row">
                                <td colSpan={4} className="fp-total-label">UFP Total</td>
                                <td><span className="ufp-badge">{result.ufp}</span></td>
                            </tr>
                        </tfoot>
                    </table>

                    <button id="btn-apply-fp" className="btn-apply-fp" onClick={handleApply}>
                        Áp dụng kết quả vào Manual Calculator
                    </button>
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════
// Main Component: ProjectSetup
// ═════════════════════════════════════════════════════════════════════════
export default function ProjectSetup({ values, onChange }) {
    const [showDescription, setShowDescription] = useState(!!values.description);

    const handleChange = (field, value) => onChange({ ...values, [field]: value });

    const modeInfo = PROJECT_MODE_INFO[values.mode] || PROJECT_MODE_INFO.organic;

    // Tính toán KLOC trực tiếp nếu đang ở chế độ FP
    const ufp = values.sizeType === "FP" ? calcUFP(values.fpComponents) : 0;
    const langFactor = LANGUAGE_BACKFIRING[values.language] || 50;
    const estimatedKloc = ufp > 0 ? (ufp * langFactor / 1000).toFixed(2) : 0;

    return (
        <div className="setup-form">
            {/* ── Sizing Method ─────────────────────────────────── */}
            <div className="form-group">
                <label className="form-label">Phương pháp đo lường</label>
                <div className="tab-group">
                    <button
                        id="btn-kloc"
                        className={`tab-btn ${values.sizeType === "KLOC" ? "active" : ""}`}
                        onClick={() => handleChange("sizeType", "KLOC")}
                    >
                        KLOC
                    </button>
                    <button
                        id="btn-fp"
                        className={`tab-btn ${values.sizeType === "FP" ? "active" : ""}`}
                        onClick={() => handleChange("sizeType", "FP")}
                    >
                        Function Points (IFPUG)
                    </button>
                </div>
            </div>

            {/* ── Size Input ────────────────────────────────────── */}
            {values.sizeType === "KLOC" ? (
                <div className="form-group">
                    <label className="form-label">
                        Quy mô ước tính (KLOC)
                        <span className="form-hint">Kilo Lines of Code</span>
                    </label>
                    <input
                        id="input-kloc"
                        type="number"
                        min="0.1"
                        step="0.1"
                        className="form-input"
                        value={values.kloc}
                        onChange={(e) => handleChange("kloc", e.target.value)}
                        placeholder="Ví dụ: 50"
                    />
                </div>
            ) : (
                <>
                    {/* ── FP Sub-tabs: Manual / AI ── */}
                    <div className="form-group">
                        <label className="form-label">
                            Function Points (IFPUG Standard)
                            <span className="form-hint">UFP = Σ (count × IFPUG weight)</span>
                        </label>
                        <div className="tab-group fp-sub-tabs">
                            <button
                                id="btn-fp-manual"
                                className={`tab-btn ${values.fpMode === "manual" ? "active" : ""}`}
                                onClick={() => handleChange("fpMode", "manual")}
                            >
                                Manual Calculator
                            </button>
                            <button
                                id="btn-fp-ai"
                                className={`tab-btn ${values.fpMode === "ai" ? "active" : ""}`}
                                onClick={() => handleChange("fpMode", "ai")}
                            >
                                AI Estimation
                            </button>
                        </div>

                        {/* Manual mode: 5x3 grid */}
                        {values.fpMode === "manual" ? (
                            <FPManualCalculator
                                fpComponents={values.fpComponents}
                                onChange={(comps) => handleChange("fpComponents", comps)}
                            />
                        ) : (
                            <FPAIEstimator
                                description={values.description}
                                projectMode={values.mode}
                                onApply={(comps) => {
                                    handleChange("fpComponents", comps);
                                    handleChange("fpMode", "manual");
                                }}
                            />
                        )}
                    </div>

                    {/* Language selector — always visible in FP mode */}
                    <div className="form-group">
                        <label className="form-label">
                            Ngôn ngữ lập trình
                            <span className="form-hint">Dùng để backfiring UFP → KLOC</span>
                        </label>
                        <select
                            id="select-language"
                            className="form-select"
                            value={values.language}
                            onChange={(e) => handleChange("language", e.target.value)}
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang} value={lang}>{lang}</option>
                            ))}
                        </select>
                        {ufp > 0 && (
                            <div className="mode-info-card" style={{ marginTop: '12px', background: 'var(--primary-light)', borderColor: 'var(--primary)', color: 'var(--primary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>KLOC tương đương:</span>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: '"JetBrains Mono", monospace' }}>
                                        {estimatedKloc}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '4px' }}>
                                    Công thức: ({ufp} UFP × {langFactor} SLOC/{values.language}) / 1000
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ── Development Mode ──────────────────────────────── */}
            <div className="form-group">
                <label className="form-label">Loại dự án (COCOMO Mode)</label>
                <select
                    id="select-mode"
                    className="form-select"
                    value={values.mode}
                    onChange={(e) => handleChange("mode", e.target.value)}
                >
                    {Object.entries(PROJECT_MODE_INFO).map(([key, info]) => (
                        <option key={key} value={key}>{info.label}</option>
                    ))}
                </select>
                <div className="mode-info-card">
                    <span className={`badge ${modeInfo.badgeClass}`}>{modeInfo.badge}</span>
                    <p className="mode-desc">{modeInfo.description}</p>
                </div>
            </div>

            {/* ── Average Salary ────────────────────────────────── */}
            <div className="form-group">
                <label className="form-label">
                    Lương trung bình/tháng (USD)
                    <span className="form-hint">Dùng để tính tổng chi phí</span>
                </label>
                <div className="input-prefix-group">
                    <span className="input-prefix">$</span>
                    <input
                        id="input-salary"
                        type="number"
                        min="1"
                        className="form-input has-prefix"
                        value={values.salary}
                        onChange={(e) => handleChange("salary", e.target.value)}
                        placeholder="Ví dụ: 2000"
                    />
                </div>
            </div>

            {/* ── Project Description (AI Input) ────────────────── */}
            <div className="form-group">
                <button
                    className="description-toggle"
                    onClick={() => setShowDescription(!showDescription)}
                >
                    <span>Mô tả dự án cho AI phân tích</span>
                    <ChevronDown
                        size={16}
                        style={{
                            transform: showDescription ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                        }}
                    />
                </button>

                {showDescription && (
                    <div className="description-area">
                        <textarea
                            id="input-description"
                            className="form-textarea"
                            value={values.description}
                            onChange={(e) => handleChange("description", e.target.value)}
                            placeholder="Mô tả dự án của bạn: mục đích, chức năng chính, yêu cầu kỹ thuật, đội ngũ, timeline...

Ví dụ: Xây dựng hệ thống quản lý bệnh viện với 300+ giường bao gồm quản lý bệnh nhân, lịch khám, kê đơn thuốc, kết nối 5 khoa phòng. Team 8 dev junior, cần go-live trong 8 tháng. Yêu cầu uptime 99.9%."
                            rows={5}
                        />
                        <p className="textarea-hint">
                            Mô tả càng chi tiết, AI gợi ý Cost Drivers và ước tính FP càng chính xác
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
