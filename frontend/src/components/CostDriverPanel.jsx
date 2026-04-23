// components/CostDriverPanel.jsx
// Hiển thị 15 Cost Drivers với grouping, badges màu sắc, AI suggest integration

import { useState } from "react";
import axios from "axios";

// Metadata 15 Cost Drivers với valid values và grouping
export const COST_DRIVERS_META = [
    // Product Category
    { id: "RELY", label: "Required Reliability",      category: "Product",    values: { "0.75": "Very Low", "0.88": "Low", "1.00": "Nominal", "1.15": "High", "1.40": "Very High" } },
    { id: "DATA", label: "Data Base Size",            category: "Product",    values: { "0.94": "Low", "1.00": "Nominal", "1.08": "High", "1.16": "Very High" } },
    { id: "CPLX", label: "Product Complexity",        category: "Product",    values: { "0.70": "Very Low", "0.85": "Low", "1.00": "Nominal", "1.15": "High", "1.30": "Very High", "1.65": "Extra High" } },
    // Computer Category
    { id: "TIME", label: "Execution Time Constraint", category: "Computer",   values: { "1.00": "Nominal", "1.11": "High", "1.30": "Very High", "1.66": "Extra High" } },
    { id: "STOR", label: "Main Storage Constraint",   category: "Computer",   values: { "1.00": "Nominal", "1.06": "High", "1.21": "Very High", "1.56": "Extra High" } },
    { id: "VIRT", label: "VM Volatility",             category: "Computer",   values: { "0.87": "Low", "1.00": "Nominal", "1.15": "High", "1.30": "Very High" } },
    { id: "TURN", label: "Turnaround Time",           category: "Computer",   values: { "0.87": "Low", "1.00": "Nominal", "1.07": "High", "1.15": "Very High" } },
    // Personnel Category
    { id: "ACAP", label: "Analyst Capability",        category: "Personnel",  values: { "1.46": "Very Low", "1.19": "Low", "1.00": "Nominal", "0.86": "High", "0.71": "Very High" } },
    { id: "AEXP", label: "App. Experience",           category: "Personnel",  values: { "1.29": "Very Low", "1.13": "Low", "1.00": "Nominal", "0.91": "High", "0.82": "Very High" } },
    { id: "PCAP", label: "Programmer Capability",     category: "Personnel",  values: { "1.42": "Very Low", "1.17": "Low", "1.00": "Nominal", "0.86": "High", "0.70": "Very High" } },
    { id: "VEXP", label: "VM Experience",             category: "Personnel",  values: { "1.21": "Very Low", "1.10": "Low", "1.00": "Nominal", "0.90": "High" } },
    { id: "LEXP", label: "Language Experience",       category: "Personnel",  values: { "1.14": "Very Low", "1.07": "Low", "1.00": "Nominal", "0.95": "High" } },
    // Project Category
    { id: "MODP", label: "Modern Prog. Practices",   category: "Project",    values: { "1.24": "Very Low", "1.10": "Low", "1.00": "Nominal", "0.91": "High", "0.82": "Very High" } },
    { id: "TOOL", label: "Software Tools",            category: "Project",    values: { "1.24": "Very Low", "1.10": "Low", "1.00": "Nominal", "0.91": "High", "0.83": "Very High" } },
    { id: "SCED", label: "Development Schedule",      category: "Project",    values: { "1.23": "Very Low", "1.08": "Low", "1.00": "Nominal", "1.04": "High", "1.10": "Very High" } },
];

const CATEGORY_COLORS = {
    Product:   "cat-product",
    Computer:  "cat-computer",
    Personnel: "cat-personnel",
    Project:   "cat-project",
};

const CATEGORIES = ["Product", "Computer", "Personnel", "Project"];

// Lấy màu badge dựa on multiplier value
function getBadgeClass(value) {
    const v = parseFloat(value);
    if (v < 1.0)         return "badge-good";   // Xanh lá — giảm effort
    if (v === 1.0)       return "badge-neutral"; // Xám — nominal
    if (v >= 1.30)       return "badge-danger";  // Đỏ — tăng nhiều
    return "badge-warn";                          // Vàng — tăng nhẹ
}

// Tính EAF realtime từ dict hiện tại
function calcEAF(drivers) {
    return Object.values(drivers).reduce((acc, v) => acc * parseFloat(v), 1.0);
}

export default function CostDriverPanel({ drivers, onChange, description, mode, kloc }) {
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestError, setSuggestError] = useState("");
    const [aiReasonings, setAiReasonings] = useState({});
    const [showReasoning, setShowReasoning] = useState(false);

    const eaf = calcEAF(drivers);

    // Gọi AI suggest từ mô tả dự án
    const handleAISuggest = async () => {
        if (!description || description.trim().length < 20) {
            setSuggestError("Vui lòng nhập mô tả dự án (ít nhất 20 ký tự) trong phần 'Project Setup'");
            return;
        }
        setSuggestError("");
        setIsSuggesting(true);

        try {
            const response = await axios.post("http://localhost:8000/api/suggest", {
                description: description.trim(),
                project_mode: mode,
                kloc: kloc ? parseFloat(kloc) : undefined,
            });

            if (response.data.status === "success") {
                const suggestion = response.data.suggestion;
                const newDrivers = {};
                const reasonings = {};

                COST_DRIVERS_META.forEach((meta) => {
                    const driverData = suggestion.drivers[meta.id];
                    if (driverData) {
                        newDrivers[meta.id] = String(driverData.value.toFixed(2));
                        reasonings[meta.id] = {
                            reasoning: driverData.reasoning,
                            rating: driverData.rating,
                            confidence: driverData.confidence,
                        };
                    } else {
                        newDrivers[meta.id] = "1.00";
                    }
                });

                onChange(newDrivers);
                setAiReasonings(reasonings);
                setShowReasoning(true);
            }
        } catch (err) {
            setSuggestError("AI Suggest thất bại. Kiểm tra backend và API key.");
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleDriverChange = (id, value) => {
        onChange({ ...drivers, [id]: value });
    };

    const resetToNominal = () => {
        const nominal = Object.fromEntries(COST_DRIVERS_META.map((d) => [d.id, "1.00"]));
        onChange(nominal);
        setAiReasonings({});
    };

    return (
        <div className="driver-panel">
            {/* ── Header: EAF + AI Suggest ───────────────────── */}
            <div className="driver-panel-header">
                <div className="eaf-display">
                    <span className="eaf-label">EAF</span>
                    <span className={`eaf-value ${eaf > 1.2 ? "eaf-warn" : eaf < 0.9 ? "eaf-good" : ""}`}>
                        {eaf.toFixed(4)}
                    </span>
                    <span className="eaf-hint">
                        {eaf > 1.2 ? "↑ Tăng effort" : eaf < 0.9 ? "↓ Giảm effort" : "Baseline"}
                    </span>
                </div>

                <div className="driver-actions">
                    <button
                        id="btn-ai-suggest"
                        className="btn-ai-suggest"
                        onClick={handleAISuggest}
                        disabled={isSuggesting}
                    >
                        {isSuggesting ? (
                            <>
                                <span className="spinner" /> Đang phân tích...
                            </>
                        ) : (
                            <>AI Gợi ý từ mô tả</>
                        )}
                    </button>
                    <button className="btn-reset" onClick={resetToNominal} title="Reset về Nominal">
                        ↺ Reset
                    </button>
                </div>
            </div>

            {/* ── Error message ──────────────────────────────── */}
            {suggestError && (
                <div className="suggest-error">{suggestError}</div>
            )}

            {/* ── AI Reasoning toggle ───────────────────────── */}
            {Object.keys(aiReasonings).length > 0 && (
                <button
                    className="reasoning-toggle"
                    onClick={() => setShowReasoning(!showReasoning)}
                >
                    {showReasoning ? "Ẩn giải thích AI" : "Xem giải thích AI"}
                </button>
            )}

            {/* ── Drivers by Category ───────────────────────── */}
            {CATEGORIES.map((cat) => {
                const catDrivers = COST_DRIVERS_META.filter((d) => d.category === cat);
                return (
                    <div key={cat} className={`driver-category ${CATEGORY_COLORS[cat]}`}>
                        <div className="category-header">
                            <span className="category-dot" />
                            <h4 className="category-title">{cat} Attributes</h4>
                            <span className="category-count">{catDrivers.length} drivers</span>
                        </div>

                        <div className="drivers-list">
                            {catDrivers.map((driver) => {
                                const currentVal = drivers[driver.id] ?? "1.00";
                                const reasoning = aiReasonings[driver.id];

                                return (
                                    <div key={driver.id} className="driver-row">
                                        <div className="driver-info">
                                            <span className="driver-id">{driver.id}</span>
                                            <span className="driver-name">{driver.label}</span>
                                        </div>

                                        <div className="driver-control">
                                            <select
                                                id={`driver-${driver.id}`}
                                                className="form-select driver-select"
                                                value={String(currentVal)}
                                                onChange={(e) => handleDriverChange(driver.id, e.target.value)}
                                            >
                                                {Object.entries(driver.values).map(([valStr, label]) => (
                                                    <option key={valStr} value={valStr}>
                                                        {label} ({parseFloat(valStr).toFixed(2)})
                                                    </option>
                                                ))}
                                            </select>

                                            <span className={`value-badge ${getBadgeClass(currentVal)}`}>
                                                {parseFloat(currentVal) >= 1.0 ? "▲" : "▼"} {parseFloat(currentVal).toFixed(2)}
                                            </span>
                                        </div>

                                        {/* AI reasoning tooltip */}
                                        {showReasoning && reasoning && (
                                            <div className="driver-reasoning">
                                                <span className={`confidence-dot confidence-${reasoning.confidence}`} />
                                                <span>{reasoning.reasoning}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
