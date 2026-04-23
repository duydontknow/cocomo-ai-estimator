// components/ResultsDashboard.jsx
// Dashboard kết quả: Metric cards, 3 biểu đồ (Radar, Bar, Gauge), Risk Panel

import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Cell,
} from "recharts";
import { COST_DRIVERS_META } from "./CostDriverPanel";

// ── Helper: Nhóm drivers theo category cho radar chart ──────────────────
const CATEGORY_EAF = (drivers) => {
    const cats = { Product: 1, Computer: 1, Personnel: 1, Project: 1 };
    COST_DRIVERS_META.forEach((d) => {
        cats[d.category] *= parseFloat(drivers[d.id] ?? 1.0);
    });
    return Object.entries(cats).map(([name, value]) => ({
        subject: name,
        value: parseFloat(value.toFixed(3)),
        fullMark: 2.5,
    }));
};

// ── Helper: Tính baseline (all Nominal) vs AI-adjusted effort ────────────
function buildComparisonData(result, drivers) {
    if (!result) return [];
    const nominalEAF = 1.0;
    const actualEAF = result.eaf_applied;
    const baselineEffort = parseFloat((result.effort_person_months / actualEAF * nominalEAF).toFixed(1));
    return [
        { name: "Baseline\n(All Nominal)", effort: baselineEffort, fill: "var(--chart-fill-2)" },
        { name: "Actual\n(With EAF)",      effort: result.effort_person_months, fill: "var(--chart-fill-1)" },
    ];
}

// ── Risk Level Badge ─────────────────────────────────────────────────────
const RISK_COLORS = { HIGH: "risk-high", MEDIUM: "risk-medium", LOW: "risk-low" };
const RISK_ICONS  = { HIGH: "", MEDIUM: "", LOW: "" };

// ── Staff Gauge ──────────────────────────────────────────────────────────
function StaffGauge({ staff }) {
    const maxStaff = Math.max(20, staff * 1.5);
    const pct = Math.min((staff / maxStaff) * 100, 100);
    const color =
        staff <= 5  ? "var(--chart-fill-2)" :
        staff <= 15 ? "var(--accent-yellow)" :
                      "var(--accent-red)";

    return (
        <div className="gauge-container">
            <div className="gauge-label">Required Staff</div>
            <div className="gauge-value" style={{ color }}>{staff}</div>
            <div className="gauge-unit">people simultaneously</div>
            <div className="gauge-bar-bg">
                <div
                    className="gauge-bar-fill"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>
            <div className="gauge-scale">
                <span>0</span>
                <span>{Math.round(maxStaff / 2)}</span>
                <span>{Math.round(maxStaff)}</span>
            </div>
        </div>
    );
}

// ── Custom Tooltip for Bar Chart ─────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }) {
    if (active && payload && payload.length) {
        return (
            <div className="chart-tooltip">
                <p className="tooltip-label">{label}</p>
                <p className="tooltip-value">{payload[0].value.toFixed(1)} PM</p>
            </div>
        );
    }
    return null;
}

export default function ResultsDashboard({ result, drivers, onExport, onAnalyze, isAnalyzing }) {
    if (!result) {
        return (
            <div className="empty-state">

                <h2>Chưa có kết quả</h2>
                <p>Cấu hình tham số và nhấn <strong>Tính toán COCOMO</strong> để xem kết quả.</p>
            </div>
        );
    }

    const radarData    = CATEGORY_EAF(drivers);
    const compareData  = buildComparisonData(result, drivers);
    const risks        = result.risk_factors || [];
    const highRisks    = risks.filter((r) => r.level === "HIGH");
    const otherRisks   = risks.filter((r) => r.level !== "HIGH");

    return (
        <div className="results-layout">
            {/* ══ ROW 1: Metric Cards ═══════════════════════════════════ */}
            <div className="metrics-grid">
                <div className="metric-card metric-effort">

                    <h3 className="metric-label">Effort (E)</h3>
                    <div className="metric-value">{result.effort_person_months}</div>
                    <div className="metric-unit">Person-Months</div>
                </div>
                <div className="metric-card metric-time">

                    <h3 className="metric-label">Time (TDEV)</h3>
                    <div className="metric-value">{result.development_time_months}</div>
                    <div className="metric-unit">Months</div>
                </div>
                <div className="metric-card metric-cost">

                    <h3 className="metric-label">Total Cost</h3>
                    <div className="metric-value">${result.estimated_cost.toLocaleString()}</div>
                    <div className="metric-unit">USD</div>
                </div>
                <div className="metric-card metric-staff">

                    <h3 className="metric-label">Team Size</h3>
                    <div className="metric-value">{result.required_staff}</div>
                    <div className="metric-unit">Avg. Staff</div>
                </div>
                <div className="metric-card metric-eaf">

                    <h3 className="metric-label">EAF</h3>
                    <div className={`metric-value ${result.eaf_applied > 1.1 ? "text-warn" : result.eaf_applied < 0.9 ? "text-good" : ""}`}>
                        {result.eaf_applied}
                    </div>
                    <div className="metric-unit">Adjustment Factor</div>
                </div>
                <div className="metric-card metric-size">

                    <h3 className="metric-label">Final Size</h3>
                    <div className="metric-value">{result.final_kloc}</div>
                    <div className="metric-unit">KLOC</div>
                </div>
            </div>

            {/* ══ ROW 2: Charts ════════════════════════════════════════ */}
            <div className="charts-row">
                {/* Chart 1: Radar — EAF phân bổ theo category */}
                <div className="glass-panel chart-panel">
                    <h3 className="chart-title">EAF phân bổ theo nhóm</h3>
                    <p className="chart-subtitle">Product / Computer / Personnel / Project</p>
                    <ResponsiveContainer width="100%" height={260}>
                        <RadarChart data={radarData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                            <PolarGrid stroke="var(--panel-border)" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                            <PolarRadiusAxis angle={90} domain={[0, 2.5]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
                            <Radar
                                name="EAF"
                                dataKey="value"
                                stroke="var(--primary)"
                                fill="var(--primary)"
                                fillOpacity={0.25}
                                strokeWidth={2}
                            />
                            <Tooltip
                                contentStyle={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 8 }}
                                labelStyle={{ color: "var(--text-main)" }}
                                itemStyle={{ color: "var(--primary)" }}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 2: Bar — Baseline vs Actual Effort */}
                <div className="glass-panel chart-panel">
                    <h3 className="chart-title">Baseline vs Actual Effort</h3>
                    <p className="chart-subtitle">Tác động của EAF ({result.eaf_applied}x)</p>
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={compareData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--panel-border)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                            <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                            <Tooltip content={<CustomBarTooltip />} />
                            <Bar dataKey="effort" radius={[8, 8, 0, 0]} maxBarSize={80}>
                                {compareData.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 3: Staff Gauge */}
                <div className="glass-panel chart-panel">
                    <h3 className="chart-title">Staff Loading</h3>
                    <p className="chart-subtitle">Số nhân sự cần đồng thời</p>
                    <StaffGauge staff={result.required_staff} />
                    <div className="cocomo-formula">
                        <code>E={result.effort_person_months} ÷ TDEV={result.development_time_months}</code>
                    </div>
                </div>
            </div>

            {/* ══ ROW 3: Risk Panel ════════════════════════════════════ */}
            {risks.length > 0 && (
                <div className="glass-panel risk-panel">
                    <div className="risk-header">
                        <h3 className="risk-title">
                            Risk Analysis
                            {highRisks.length > 0 && (
                                <span className="risk-badge-count">{highRisks.length} HIGH</span>
                            )}
                        </h3>
                        <span className="risk-total">{risks.length} rủi ro được phát hiện</span>
                    </div>

                    <div className="risk-grid">
                        {[...highRisks, ...otherRisks].map((risk, idx) => (
                            <div key={idx} className={`risk-card ${RISK_COLORS[risk.level]}`}>
                                <div className="risk-card-header">

                                    <span className="risk-cat">{risk.category}</span>
                                    <span className={`risk-level-badge ${RISK_COLORS[risk.level]}`}>{risk.level}</span>
                                </div>
                                <div className="risk-driver-badge">{risk.driver}</div>
                                <h4 className="risk-title-text">{risk.title}</h4>
                                <p className="risk-desc">{risk.description}</p>
                                <div className="risk-rec">
                                    <span className="rec-label">Khuyến nghị:</span>
                                    <span className="rec-text">{risk.recommendation}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══ ROW 4: Action Buttons ════════════════════════════════ */}
            <div className="glass-panel action-panel">
                <button
                    id="btn-analyze"
                    className="btn-primary btn-ai-analyze"
                    onClick={onAnalyze}
                    disabled={isAnalyzing}
                >
                    {isAnalyzing ? (
                        <><span className="spinner" /> Đang phân tích chuyên sâu...</>
                    ) : (
                        "Phân tích AI chuyên sâu"
                    )}
                </button>
                <button id="btn-export" className="btn-secondary" onClick={onExport}>
                    Xuất báo cáo JSON
                </button>
            </div>
        </div>
    );
}
