import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Dices,
  CheckCircle2,
  X,
  ArrowRight,
  BellRing,
  Layers,
  MonitorPlay
} from 'lucide-react';
import { API_BASE } from '../config';

const STORAGE_KEY = 'fastchick_dismissed_update_id';

// Default announcement fallback in case API is offline
const DEFAULT_ANNOUNCEMENT = {
  id: 'v1.2.0-dbd-hd-broadcast',
  version: '1.2.0',
  date: '12 กันยายน 2026',
  badge: '🔥 NEW MAJOR UPDATE',
  title: 'อัปเดตใหม่! DBD Perks Ultra HD & Broadcast Scale',
  subtitle: 'ยกระดับภาพเปิร์คคมชัดระดับ 512px Super-Resolution, ขยายขนาดใหญ่สะใจ และระบบแยก Channel Points อิสระ',
  sections: [
    {
      title: 'Dead by Daylight Perks Overlay',
      badge: 'Gaming Overlay',
      color: '#A855F7',
      icon: 'Dices',
      items: [
        'AI Super-Resolution 512x512: อัปสเกลรูปเปิร์คทั้งหมด 321 รายการ คมชัดระดับ Ultra HD ไม่แตก ไม่เบลอบนจอ 1080p และ 4K',
        'Broadcast Scale (ขยายใหญ่ขึ้น ~200%): ปรับขนาดเริ่มต้นเป็น 280px พร้อมกรอบเพชร Tier-3 สีม่วงนีออนเรืองแสงสะดุดตา',
        'แยก Channel Points อิสระ: ตั้งชื่อรางวัลแต้มช่องสำหรับ Survivor และ Killer แยกกันได้โดยตรง ไม่ต้องคอยสลับในเว็บ',
        'ปรับสเกลได้อิสระ: สไลเดอร์ปรับขนาดไอคอนได้ตั้งแต่ 120px ถึง 450px พร้อมตัวอักษรขยายตามสัดส่วนอัตโนมัติ'
      ]
    },
    {
      title: 'ระบบและการแสดงผล (System & Studio)',
      badge: 'Core System',
      color: '#0EA5E9',
      icon: 'Sparkles',
      items: [
        'Live Preview Studio เต็มจอ: ขยายดูพรีวิวสดแบบเต็มจอ 16:9 ก่อนนำไปใช้งานจริงบน OBS Studio',
        'Zero-Latency WebSockets: ซิงค์คำสั่งแลกแต้มและการสุ่มขึ้นจอ OBS ทันทีแบบเรียลไทม์ ไร้ดีเลย์',
        'ระบบประวัติการสุ่ม (Roll History): บันทึกประวัติการสุ่มของผู้ใช้แต่ละคนอัตโนมัติ'
      ]
    }
  ],
  cta: {
    text: 'เข้าสู่แผงควบคุมสตรีมเมอร์',
    link: '/dashboard'
  }
};

export default function UpdateModal({ isOpen: manualIsOpen, onClose: manualOnClose, customData }) {
  const navigate = useNavigate();
  const [data, setData] = useState(customData || DEFAULT_ANNOUNCEMENT);
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  // Sync with customData if passed (e.g. from Admin editor preview)
  useEffect(() => {
    if (customData) {
      setData(customData);
    }
  }, [customData]);

  // Fetch announcement data from API on load
  useEffect(() => {
    if (customData) return;
    fetch(`${API_BASE}/api/announcements/latest`)
      .then((res) => (res.ok ? res.json() : null))
      .then((ann) => {
        if (ann && ann.id) {
          setData(ann);
          checkShouldOpen(ann.id);
        } else {
          checkShouldOpen(DEFAULT_ANNOUNCEMENT.id);
        }
      })
      .catch(() => {
        checkShouldOpen(DEFAULT_ANNOUNCEMENT.id);
      });
  }, []);

  // Sync with manual open/close from parent (e.g. clicking badge)
  useEffect(() => {
    if (manualIsOpen === true) {
      setIsOpen(true);
    } else if (manualIsOpen === false) {
      setIsOpen(false);
    }
  }, [manualIsOpen]);

  const checkShouldOpen = (announcementId) => {
    try {
      const dismissedId = localStorage.getItem(STORAGE_KEY);
      if (dismissedId !== announcementId) {
        // Delay popup slightly for a silky-smooth entrance after page loads
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    } catch (e) {}
  };

  const handleClose = () => {
    if (dontShowAgain && data?.id) {
      try {
        localStorage.setItem(STORAGE_KEY, data.id);
      } catch (e) {}
    }
    setIsOpen(false);
    if (manualOnClose) manualOnClose();
  };

  const handleGoToDashboard = () => {
    handleClose();
    navigate(data?.cta?.link || '/dashboard');
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, dontShowAgain, data]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="update-modal-overlay" onClick={handleClose}>
      <div
        className="update-modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-modal-title"
      >
        {/* Glow Header Ambient */}
        <div className="update-modal-glow" />

        {/* Top Bar with Badge and Close */}
        <div className="update-modal-topbar">
          <div className="update-badge-group">
            <span className="update-pill-badge">
              <Sparkles size={13} className="update-pill-icon" />
              <span>{data.badge || 'NEW UPDATE'}</span>
            </span>
            <span className="update-version-tag">v{data.version}</span>
            <span className="update-date-text">{data.date}</span>
          </div>

          <button
            type="button"
            className="update-modal-close-btn"
            onClick={handleClose}
            aria-label="ปิดหน้าต่าง"
          >
            <X size={18} />
          </button>
        </div>

        {/* Header Title & Subtitle */}
        <div className="update-modal-header">
          <h2 id="update-modal-title" className="update-modal-title">
            {data.title}
          </h2>
          <p className="update-modal-subtitle">{data.subtitle}</p>
        </div>

        {/* Scrollable Features Content */}
        <div className="update-modal-body custom-scrollbar">
          {data.sections &&
            data.sections.map((sec, idx) => {
              const isDbd = sec.icon === 'Dices' || sec.badge?.includes('Gaming');
              return (
                <div key={idx} className="update-feature-card">
                  <div className="update-feature-header">
                    <div
                      className="update-feature-icon-box"
                      style={{
                        background: `${sec.color || '#6366F1'}1a`,
                        borderColor: `${sec.color || '#6366F1'}40`,
                        color: sec.color || '#6366F1'
                      }}
                    >
                      {isDbd ? <Dices size={18} /> : <Sparkles size={18} />}
                    </div>
                    <div>
                      <h4 className="update-feature-title">{sec.title}</h4>
                      {sec.badge && (
                        <span
                          className="update-feature-badge"
                          style={{
                            color: sec.color || '#6366F1',
                            background: `${sec.color || '#6366F1'}15`,
                            borderColor: `${sec.color || '#6366F1'}30`
                          }}
                        >
                          {sec.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="update-feature-list">
                    {sec.items &&
                      sec.items.map((item, itemIdx) => {
                        const parts = item.split(': ');
                        const hasHeader = parts.length > 1;
                        return (
                          <li key={itemIdx} className="update-feature-item">
                            <CheckCircle2
                              size={15}
                              className="update-check-icon"
                              style={{ color: sec.color || '#6366F1' }}
                            />
                            <span>
                              {hasHeader ? (
                                <>
                                  <strong className="update-item-strong">{parts[0]}:</strong>{' '}
                                  {parts.slice(1).join(': ')}
                                </>
                              ) : (
                                item
                              )}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              );
            })}
        </div>

        {/* Bottom Footer Actions */}
        <div className="update-modal-footer">
          <label className="update-modal-checkbox-label">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="update-checkbox-input"
            />
            <span>ไม่ต้องแสดงป๊อปอัปนี้อีกสำหรับเวอร์ชันนี้</span>
          </label>

          <div className="update-modal-btn-group">
            <button
              type="button"
              className="btn-island ghost update-btn-dismiss"
              onClick={handleClose}
            >
              เข้าใจแล้ว (ปิด)
            </button>
            <button
              type="button"
              className="btn-island accent update-btn-cta"
              onClick={handleGoToDashboard}
            >
              <span>{data?.cta?.text || 'เข้าสู่ Dashboard'}</span>
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
