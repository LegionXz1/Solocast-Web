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
  MonitorPlay,
  Music,
  ShieldAlert,
  KeyRound,
  AlertTriangle,
  Link2
} from 'lucide-react';
import { API_BASE } from '../config';

const STORAGE_KEY = 'fastchick_dismissed_update_id';

// Default announcement fallback in case API is offline
const DEFAULT_ANNOUNCEMENT = {
  id: 'v1.4.0-security-token-upgrade',
  version: '1.4.0',
  date: '6 ตุลาคม 2026',
  badge: 'แจ้งเตือนสำคัญ',
  title: 'อัปเดตระบบความปลอดภัย: รบกวนเปลี่ยนลิงก์ใน OBS ใหม่นะครับ',
  subtitle: 'เพื่อความปลอดภัยของช่องสตรีม ลิงก์ Widget แบบเดิมจะใช้งานไม่ได้แล้ว สตรีมเมอร์ต้องคัดลอกลิงก์ใหม่ไปใส่ใน OBS Studio เพื่อให้หน้าจอแสดงผลได้ตามปกติ',
  sections: [
    {
      title: 'ทำไมถึงต้องเปลี่ยนลิงก์?',
      badge: 'เพื่อความปลอดภัย',
      color: '#EF4444',
      icon: 'ShieldAlert',
      items: [
        'ป้องกันคนอื่นแอบส่องหรือกดปุ่มแกล้ง: ลิงก์แบบเก่าใครรู้ชื่อช่องก็อาจเปิดดูหรือกดปุ่มสุ่มเล่นได้ ตอนนี้ระบบเพิ่มกุญแจลับเฉพาะตัวของแต่ละคนแล้ว',
        'ลิงก์เก่าปิดใช้งานแล้ว: ถ้าไม่เปลี่ยน ลิงก์เดิมใน OBS จะขึ้นจอดำหรือไม่แสดงผล'
      ]
    },
    {
      title: 'วิธีเปลี่ยนลิงก์ง่ายๆ ใน 3 ขั้นตอน',
      badge: 'ทำตามนี้ได้เลย',
      color: '#F59E0B',
      icon: 'KeyRound',
      items: [
        '1. เข้าหน้าเว็บนี้: ไปที่หน้ารวม Widget หรือหน้าตั้งค่า',
        '2. กดปุ่มคัดลอก: มองหา Widget ที่ใช้อยู่ แล้วกดปุ่ม "คัดลอกลิงก์ OBS"',
        '3. วางใน OBS: เปิดโปรแกรม OBS ดับเบิ้ลคลิกตัว Browser Source เดิม ลบของเก่าออกแล้ววางลิงก์ใหม่ลงไป กด OK เป็นอันเสร็จเรียบร้อย (รวมถึงหน้าจอควบคุม Custom Dock ด้วยนะ)'
      ]
    },
    {
      title: 'ถ้าเผลอทำลิงก์หลุดในสตรีม ทำยังไงดี?',
      badge: 'มีปุ่มกดเปลี่ยนใหม่ได้',
      color: '#3B82F6',
      icon: 'Link2',
      items: [
        'กดปุ่ม "รีเซ็ต Key" ได้ทันที: อยู่ที่หน้าแรกหรือหน้าตั้งค่า กดปุ๊บระบบจะเปลี่ยนรหัสลับใหม่ให้ทันที คนที่เห็นลิงก์เก่าจะเข้าไม่ได้อีกเลย ปลอดภัยหายห่วงครับ'
      ]
    }
  ],
  cta: {
    text: 'ไปคัดลอกลิงก์ใหม่กันเลย',
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
              const renderSectionIcon = () => {
                if (sec.icon === 'ShieldAlert') return <ShieldAlert size={18} />;
                if (sec.icon === 'KeyRound') return <KeyRound size={18} />;
                if (sec.icon === 'Link2') return <Link2 size={18} />;
                if (sec.icon === 'AlertTriangle') return <AlertTriangle size={18} />;
                if (sec.icon === 'Music') return <Music size={18} />;
                if (sec.icon === 'Layers') return <Layers size={18} />;
                if (sec.icon === 'MonitorPlay') return <MonitorPlay size={18} />;
                if (sec.icon === 'Dices' || sec.badge?.includes('Gaming')) return <Dices size={18} />;
                return <Sparkles size={18} />;
              };

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
                      {renderSectionIcon()}
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
