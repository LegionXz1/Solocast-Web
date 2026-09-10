import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogIn,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Lock,
  Radio,
  ExternalLink,
  ArrowRight,
  LogOut,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();

  const handleTwitchLogin = () => {
    window.location.href = 'http://localhost:3000/auth/twitch';
  };

  return (
    <div className="landing-container animate-fade-up" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div className="hero-section" style={{ textAlign: 'center', alignItems: 'center', marginBottom: '1.5rem' }}>
        <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Lock size={12} /> ระบบความปลอดภัย TWITCH OAUTH
        </span>
        <h1 className="hero-title" style={{ fontSize: '2.4rem' }}>เข้าสู่ระบบ HyperCast</h1>
        <p className="hero-desc" style={{ textAlign: 'center', maxWidth: 520 }}>
          เชื่อมต่อบัญชี Twitch ของคุณเพื่อเข้าถึงการตั้งค่า Widgets
        </p>
      </div>
      {/* Main Login Shell */}
      <div className="doppel-shell" style={{ marginBottom: '2rem' }}>
        <div className="doppel-core" style={{ padding: '2.25rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-secondary)' }}>กำลังตรวจสอบสถานะการเข้าสู่ระบบ...</p>
            </div>
          ) : user ? (
            /* Already Logged In View */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1rem',
                background: 'var(--surface-1)',
                border: '1px solid var(--border-secondary)',
                padding: '1rem 1.5rem',
                marginBottom: '1.75rem'
              }}>
                <img
                  src={`http://localhost:3000/api/twitch/avatar/${encodeURIComponent(user.username)}`}
                  alt={user.displayName || user.username}
                  style={{ width: 56, height: 56, objectFit: 'cover', border: '1px solid var(--border-secondary)' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                      {user.displayName || user.username}
                    </h3>
                    {user.isAdmin && (
                      <span style={{ fontSize: '0.7rem', background: 'var(--accent-color)', color: 'var(--accent-contrast)', padding: '1px 6px', fontWeight: 700 }}>
                        ADMIN
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--apple-green)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <CheckCircle2 size={13} /> เข้าสู่ระบบเรียบร้อยแล้ว
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-island accent"
                  style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
                >
                  <LayoutDashboard size={16} />
                  <span>ไปยังแผงควบคุม (Dashboard)</span>
                </button>
                <button
                  onClick={async () => { await logout(); }}
                  className="btn-island"
                  style={{ padding: '0.75rem 1.25rem', fontSize: '0.95rem' }}
                >
                  <LogOut size={16} />
                  <span>ออกจากระบบ / สลับบัญชี</span>
                </button>
              </div>
            </div>
          ) : (
            /* Login Form / CTA */
            <div>
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                  กดปุ่มด้านล่างเพื่อเข้าสู่ระบบผ่าน Twitch
                </p>
                <button
                  onClick={handleTwitchLogin}
                  className="btn-island accent"
                  style={{
                    width: '100%',
                    padding: '0.85rem 1.5rem',
                    fontSize: '1rem',
                    justifyContent: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <LogIn size={18} />
                  <span>เข้าสู่ระบบด้วย Twitch</span>
                  <div className="btn-icon-wrapper">
                    <ArrowRight size={14} />
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
