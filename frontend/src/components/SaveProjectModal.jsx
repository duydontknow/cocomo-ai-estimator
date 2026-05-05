import React, { useState } from "react";
import { X, Save } from "lucide-react";

export default function SaveProjectModal({ onClose, onSave, isSaving }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState(null);

    const handleSave = () => {
        if (!name.trim()) {
            setError("Tên dự án không được để trống.");
            return;
        }
        setError(null);
        onSave(name.trim(), description.trim());
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{ maxWidth: '500px', width: '90%' }}>
                <div className="modal-header">
                    <h2>Lưu Dự Án</h2>
                    <button className="btn-icon" onClick={onClose} disabled={isSaving}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    
                    {error && <div className="error-message warn" style={{ color: 'var(--accent-red)', fontSize: '0.9rem' }}>{error}</div>}
                    
                    <div className="form-group">
                        <label className="form-label">Tên dự án *</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Vd: Hệ thống quản lý kho"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isSaving}
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Mô tả dự án (Tuỳ chọn)</label>
                        <textarea
                            className="form-input"
                            placeholder="Ghi chú thêm về dự án này..."
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={isSaving}
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                    <button className="btn-secondary" onClick={onClose} disabled={isSaving}>
                        Hủy
                    </button>
                    <button 
                        className="btn-primary btn-calculate" 
                        onClick={handleSave} 
                        disabled={isSaving}
                        style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {isSaving ? <span className="spinner"></span> : <Save size={18} />}
                        {isSaving ? "Đang lưu..." : "Lưu dự án"}
                    </button>
                </div>
            </div>
        </div>
    );
}
