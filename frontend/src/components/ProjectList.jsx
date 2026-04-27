import React, { useState, useEffect } from "react";
import axios from "axios";
import { FolderOpen, Trash2, Calendar, Clock, DollarSign, FileSpreadsheet, FileText } from "lucide-react";

export default function ProjectList({ onLoadProject }) {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchProjects = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get("http://localhost:8000/api/projects");
            setProjects(response.data);
        } catch (err) {
            setError("Không thể tải danh sách dự án. Vui lòng kiểm tra kết nối mạng.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa dự án "${name}" không? Hành động này không thể hoàn tác.`)) {
            return;
        }

        try {
            await axios.delete(`http://localhost:8000/api/projects/${id}`);
            setProjects(projects.filter(p => p.id !== id));
            // You can optionally trigger a global toast here if you implement it via context
        } catch (err) {
            alert("Lỗi khi xóa dự án: " + (err.response?.data?.detail || err.message));
        }
    };

    const exportToExcel = (project) => {
        // Dùng định dạng HTML Table ép sang đuôi Excel (.xls)
        // Đây là cách duy nhất "perfect" cho cả Tiếng Việt (Font) và Regional (Tránh gộp cột)
        const kloc = project.kloc ? Number(project.kloc).toFixed(2) : "";
        const fp = project.fp ? Number(project.fp).toFixed(2) : "";
        const date = new Date(project.created_at).toLocaleDateString("vi-VN");

        let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8" />
            <style>
                table, th, td { border: 1px solid black; border-collapse: collapse; padding: 5px; }
                th { background-color: #f2f2f2; font-weight: bold; text-align: left; }
            </style>
        </head>
        <body>
            <table>
                <tr>
                    <th style="width: 200px;">THÔNG TIN TRƯỜNG</th>
                    <th style="width: 400px;">GIÁ TRỊ</th>
                </tr>
                <tr><td>Tên dự án</td><td>${project.name || ""}</td></tr>
                <tr><td>Ngày tạo</td><td>${date}</td></tr>
                <tr><td>Loại dự án</td><td>${project.project_mode || ""}</td></tr>
                <tr><td>Lương trung bình ($)</td><td>${project.avg_salary || ""}</td></tr>
                <tr><td>Quy mô (KLOC)</td><td>${kloc}</td></tr>
                <tr><td>Quy mô (FP)</td><td>${fp}</td></tr>
                <tr><td>Ngôn ngữ</td><td>${project.language || ""}</td></tr>
                <tr><td>Effort (PM)</td><td>${project.effort || ""}</td></tr>
                <tr><td>Thời gian (Tháng)</td><td>${project.time || ""}</td></tr>
                <tr><td>Tổng chi phí ($)</td><td>${project.cost || ""}</td></tr>
                <tr><td>Mô tả chi tiết</td><td>${project.description ? project.description.replace(/\n/g, '<br style="mso-data-placement:same-cell;" />') : ""}</td></tr>
                <tr><td colspan="2"></td></tr>
                <tr>
                    <th>MÃ HỆ SỐ (COST DRIVERS)</th>
                    <th>GIÁ TRỊ MỨC ĐỘ</th>
                </tr>`;

        const drivers = project.cost_drivers || {};
        for (const [key, value] of Object.entries(drivers)) {
            if (!key.startsWith("__")) {
                html += `<tr><td>${key}</td><td>${value}</td></tr>`;
            }
        }

        if (drivers.__aiAdvice) {
            const formattedAi = drivers.__aiAdvice
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\n/g, '<br style="mso-data-placement:same-cell;" />');
            
            html += `
                <tr><td colspan="2"></td></tr>
                <tr>
                    <th colspan="2">ĐÁNH GIÁ TỪ CHUYÊN GIA AI (AI INSIGHTS)</th>
                </tr>
                <tr>
                    <td colspan="2" style="vertical-align: top;">${formattedAi}</td>
                </tr>`;
        }

        html += `
            </table>
        </body>
        </html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `COCOMO_${project.name.replace(/\s+/g, '_')}_${Date.now()}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = (project) => {
        const kloc = project.kloc ? Number(project.kloc).toFixed(2) : "--";
        const fp = project.fp ? Number(project.fp).toFixed(2) : "--";
        const date = new Date(project.created_at).toLocaleDateString("vi-VN", { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric', year: 'numeric' });
        
        let driversHtml = '';
        let aiAdviceHtml = '';
        const drivers = project.cost_drivers || {};
        
        for (const [key, value] of Object.entries(drivers)) {
            if (!key.startsWith("__")) {
                driversHtml += `<div class="driver-item"><span class="driver-key">${key}</span><span>${value}</span></div>`;
            }
        }
        
        if (drivers.__aiAdvice) {
            aiAdviceHtml = `
                <div class="section">
                    <div class="section-title">Đánh Giá Từ Chuyên Gia AI (AI Insights)</div>
                    <div class="ai-insights">${drivers.__aiAdvice}</div>
                </div>`;
        }

        const printContent = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Báo Cáo COCOMO - ${project.name}</title>
            <style>
                body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; max-width: 900px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6; }
                .title { font-size: 28px; font-weight: 800; color: #0f172a; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px; }
                .subtitle { font-size: 14px; color: #64748b; margin: 0; }
                .section { margin-bottom: 30px; }
                .section-title { font-size: 16px; font-weight: 700; color: #0f172a; border-left: 4px solid #3b82f6; padding-left: 12px; margin-bottom: 15px; text-transform: uppercase; }
                .desc-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; font-size: 14px; color: #334155; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }
                th { background-color: #f1f5f9; font-weight: 600; color: #475569; width: 35%; }
                td { color: #0f172a; font-weight: 500; }
                
                .card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
                .stat-card { background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .stat-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 5px; }
                .stat-value { font-size: 22px; font-weight: 800; color: #2563eb; }
                .stat-value.accent { color: #10b981; }
                
                .drivers-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .driver-item { display: flex; justify-content: space-between; padding: 10px 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; }
                .driver-key { font-weight: 700; color: #334155; }
                
                .ai-insights { background: #f0fdf4; padding: 20px; border-radius: 8px; border: 1px solid #bbf7d0; border-left: 4px solid #22c55e; white-space: pre-wrap; font-size: 14px; color: #166534; }
                
                @media print {
                    body { padding: 0; max-width: 100%; } 
                    .stat-card { border: 1px solid #cbd5e1 !important; break-inside: avoid; }
                    .driver-item { border: 1px solid #e2e8f0 !important; break-inside: avoid; }
                    .ai-insights { break-inside: avoid; }
                    @page { margin: 2cm; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 class="title">Báo Cáo Phân Tích COCOMO</h1>
                <p class="subtitle">Dự án: <strong>${project.name}</strong> &nbsp;|&nbsp; Trích xuất lúc: ${date}</p>
            </div>

            <div class="section">
                <div class="card-grid">
                    <div class="stat-card">
                        <div class="stat-label">Effort (PM)</div>
                        <div class="stat-value">${project.effort ? Number(project.effort).toFixed(2) : '--'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Thời Gian (Tháng)</div>
                        <div class="stat-value">${project.time ? Number(project.time).toFixed(2) : '--'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Chi Phí ($)</div>
                        <div class="stat-value accent">${project.cost ? Number(project.cost).toLocaleString() : '--'}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Quy mô KLOC</div>
                        <div class="stat-value">${kloc}</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Thông Tin Cơ Bản</div>
                ${project.description ? `<div class="desc-box" style="margin-bottom: 15px;">${project.description.replace(/\n/g, '<br/>')}</div>` : ''}
                <table>
                    <tr><th>Loại dự án (Mode)</th><td>${project.project_mode === 'organic' ? 'Organic' : project.project_mode === 'semi-detached' ? 'Semi-detached' : 'Embedded'}</td></tr>
                    <tr><th>Quy mô từ Function Points (UFP)</th><td>${fp !== '--' ? fp + ' UFP' : 'Không sử dụng FP'}</td></tr>
                    <tr><th>Ngôn ngữ chuyển đổi / lập trình</th><td>${project.language || 'Không xác định'}</td></tr>
                    <tr><th>Lương trung bình / người / tháng</th><td>$${project.avg_salary ? Number(project.avg_salary).toLocaleString() : '--'}</td></tr>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Hệ Số Chi Phí Thẩm Định (Cost Drivers)</div>
                <div class="drivers-grid">
                    ${driversHtml}
                </div>
            </div>

            ${aiAdviceHtml}

            <div style="text-align: center; margin-top: 50px; font-size: 12px; color: #94a3b8;">
                <p>Báo cáo được sinh tự động từ Hệ thống Môi trường Ước lượng COCOMO AI.</p>
            </div>

            <script>
                // Đợi load xong giao diện (CSS) mượt mà rồi tự bung cửa sổ in
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(printContent);
            printWindow.document.close();
        } else {
            alert('Vui lòng cho phép trình duyệt hiển thị pop-up để tải file PDF!');
        }
    };

    if (isLoading) {
        return (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="spinner" style={{ display: 'inline-block', width: '24px', height: '24px', borderWidth: '3px', marginRight: '10px' }}></span>
                Đang tải danh sách dự án...
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-panel warn" style={{ padding: '2rem', textAlign: 'center' }}>
                <p>{error}</p>
                <button className="btn-secondary" onClick={fetchProjects} style={{ marginTop: '1rem' }}>Thử lại</button>
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FolderOpen size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <h3>Chưa có dự án nào</h3>
                <p>Khởi tạo dự án và tính toán COCOMO, sau đó lưu lại để xem ở đây.</p>
            </div>
        );
    }

    return (
        <div className="project-list-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', alignContent: 'start' }}>
            {projects.map((project) => (
                <div key={project.id} className="project-card glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 600 }}>{project.name}</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar size={14} /> 
                                {new Date(project.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    </div>

                    {project.description && (
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-dark)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {project.description}
                        </p>
                    )}

                    <div className="project-card-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--panel-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Effort</span>
                            <strong style={{ color: 'var(--primary)' }}>{project.effort ? Number(project.effort).toFixed(1) : '--'} <span style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>PM</span></strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Size</span>
                            <strong style={{ color: 'var(--accent-yellow)' }}>{project.kloc ? Number(project.kloc).toFixed(2) : '--'} <span style={{ fontSize: '0.75rem', fontWeight: 'normal' }}>KLOC</span></strong>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>
                                <Clock size={14} className="text-muted" /> {project.time ? Number(project.time).toFixed(1) : '--'} M
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cost</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)' }}>
                                <DollarSign size={14} className="text-muted" /> {project.cost ? Number(project.cost).toLocaleString() : '--'}
                            </span>
                        </div>
                    </div>

                    <div className="project-card-actions" style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                        <button 
                            className="btn-primary" 
                            style={{ flex: 1, padding: '6px 12px', fontSize: '0.9rem' }}
                            onClick={() => onLoadProject(project)}
                        >
                            Xem lại
                        </button>
                        <button 
                            className="btn-icon"
                            title="Xuất Excel"
                            onClick={() => exportToExcel(project)}
                        >
                            <FileSpreadsheet size={18} style={{ color: 'var(--accent-green, #10b981)' }} />
                        </button>
                        <button 
                            className="btn-icon"
                            title="In Báo cáo (PDF)"
                            onClick={() => exportToPDF(project)}
                        >
                            <FileText size={18} style={{ color: 'var(--accent-red, #ef4444)' }} />
                        </button>
                        <button 
                            className="btn-icon"
                            title="Xóa dự án"
                            onClick={() => handleDelete(project.id, project.name)}
                        >
                            <Trash2 size={18} style={{ color: 'var(--accent-red)' }} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
