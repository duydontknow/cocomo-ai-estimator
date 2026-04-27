import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal() {
    const { login, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isLogin) {
                const { error } = await login(email, password);
                if (error) throw error;
            } else {
                const { error } = await register(email, password);
                if (error) throw error;
                // Nếu đăng ký thành công thường Supabase sẽ tự động login hoặc gửi email (tuỳ cấu hình)
                alert('Đăng ký thành công! Vui lòng kiểm tra email nếu cần xác thực.');
            }
        } catch (err) {
            setError(err.message || 'Đã xảy ra lỗi. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            backgroundColor: 'var(--bg, rgba(15, 23, 42, 0.8))',
            backdropFilter: 'blur(8px)'
        }}>
            <div className="glass-panel" style={{
                width: '100%', maxWidth: '400px',
                padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem',
                border: '1px solid var(--panel-border)', borderRadius: '12px',
                backgroundColor: 'var(--panel-bg)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <h2 className="title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                        COCOMO AI Estimator
                    </h2>
                    <p className="tab-desc">
                        {isLogin ? 'Đăng nhập để xem và lưu dự án của bạn' : 'Tạo tài khoản mới để lưu trữ kết quả'}
                    </p>
                </div>

                {error && (
                    <div style={{
                        padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px',
                        color: '#ef4444', fontSize: '0.9rem', textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="tab-label" style={{ fontSize: '0.9rem' }}>Email</label>
                        <input
                            type="email"
                            required
                            style={{
                                padding: '0.75rem', borderRadius: '6px',
                                border: '1px solid var(--panel-border)',
                                backgroundColor: 'var(--input-bg, transparent)',
                                color: 'var(--text-main)', outline: 'none'
                            }}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                        />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="tab-label" style={{ fontSize: '0.9rem' }}>Mật khẩu</label>
                        <input
                            type="password"
                            required
                            style={{
                                padding: '0.75rem', borderRadius: '6px',
                                border: '1px solid var(--panel-border)',
                                backgroundColor: 'var(--input-bg, transparent)',
                                color: 'var(--text-main)', outline: 'none'
                            }}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn-primary btn-calculate"
                        disabled={loading}
                        style={{ marginTop: '0.5rem', opacity: loading ? 0.7 : 1 }}
                    >
                        {loading 
                            ? (isLogin ? 'Đang đăng nhập...' : 'Đang đăng ký...') 
                            : (isLogin ? 'Đăng nhập' : 'Đăng ký')
                        }
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <button 
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(null); }}
                        style={{ 
                            background: 'none', border: 'none', color: 'var(--text-muted)',
                            cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline'
                        }}
                    >
                        {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
                    </button>
                </div>
            </div>
        </div>
    );
}
