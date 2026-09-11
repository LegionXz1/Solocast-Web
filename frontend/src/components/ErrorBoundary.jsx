import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: '#f8fafc'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'linear-gradient(165deg, rgba(24, 28, 42, 0.95), rgba(15, 18, 26, 0.98))',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '18px',
            padding: '2.25rem',
            textAlign: 'center',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              color: '#f87171'
            }}>
              <AlertCircle size={28} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
              เกิดข้อผิดพลาดในการแสดงผล
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
              หน้าเว็บพบปัญหาขัดข้องชั่วคราว คุณสามารถกดลองใหม่อีกครั้งเพื่อโหลดข้อมูลล่าสุด
            </p>

            {this.state.error?.message && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.78rem',
                color: '#cbd5e1',
                textAlign: 'left',
                fontFamily: 'monospace',
                overflowX: 'auto',
                marginBottom: '1.5rem'
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '0.6rem 1.35rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <RotateCcw size={14} />
                <span>ลองใหม่อีกครั้ง</span>
              </button>

              <a
                href="/"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f1f5f9',
                  borderRadius: '9999px',
                  padding: '0.6rem 1.35rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem'
                }}
              >
                <Home size={14} />
                <span>กลับหน้าแรก</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
