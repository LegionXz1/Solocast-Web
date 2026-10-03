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
  Music
} from 'lucide-react';
import { API_BASE } from '../config';

const STORAGE_KEY = 'fastchick_dismissed_update_id';

// Default announcement fallback in case API is offline
const DEFAULT_ANNOUNCEMENT = {
  id: 'v1.3.0-settings-spotify-dock',
  version: '1.3.0',
  date: '2 ตุลาคม 2026',
  badge: 'NEW MAJOR UPDATE',
  title: 'อัปเดตใหม่ v1.3! หน้าจัดการ Widget โฉมใหม่ & Spotify Song Request',
  subtitle: 'ยกระดับประสบการณ์ใช้งานด้วยหน้าตั้งค่าแยกหมวดหมู่ 8 แท็บ, Widget ขอเพลง Spotify และ OBS Custom Dock',
  sections: [
    {
      title: 'หน้าจัดการและปรับแต่ง Widget โฉมใหม่ (Studio Settings)',
      badge: 'Studio UI',
      color: '#6366F1',
      icon: 'Layers',
      items: [
        'จัดระเบียบ 8 หมวดหมู่: แยกแท็บตั้งค่าด่วน (Quick), สกินและธีม (Design), Twitch & แชท, ตัวควบคุม (Content), เสียง, OBS, ประวัติ และการตั้งค่าทั้งหมดอย่างชัดเจน',
        'แท็บตั้งค่าด่วน (Quick Start): รวมการเชื่อมต่อบัญชี, คำสั่งแชท และลิงก์ OBS ไว้ในที่เดียว พร้อมข้อความแนะนำไปที่แท็บการตั้งค่าทั้งหมด',
        'ระบบค้นหาการตั้งค่า (Live Search): ค้นหาชื่อตัวเลือกหรือฟิลด์ที่ต้องการปรับแต่งได้ทันที',
        'ปุ่มประวัติกิจกรรม (History): ตรวจสอบรายการสุ่มและประวัติแลกแต้มได้จากหัวการ์ดวิดเจ็ตทันที'
      ]
    },
    {
      title: 'Spotify Song Request Widget',
      badge: 'Music Overlay',
      color: '#1DB954',
      icon: 'Music',
      items: [
        'เชื่อมต่อ Spotify ในคลิกเดียว: ผูกบัญชีและแสดงสถานะเพลง Now Playing แบบเรียลไทม์',
        'ขอเพลงผ่าน Twitch Chat: ผู้ชมพิมพ์ !sr ตามด้วยชื่อเพลงหรือลิงก์ Spotify ได้ทันที',
        'หลากหลายสไตล์ดีไซน์: ธีม Waveform Compact, Vinyl Record, Cyberpunk, Glassmorphism และ Clean Minimalist',
        'จัดการคิวเพลงแบบ Realtime: ดูคิวเพลง ลบเพลง หรือข้ามเพลงได้โดยตรงจากหน้าควบคุม'
      ]
    },
    {
      title: 'OBS Custom Dock & ประสิทธิภาพระบบ',
      badge: 'Core System',
      color: '#0EA5E9',
      icon: 'MonitorPlay',
      items: [
        'OBS Browser Dock (/dock): แผงควบคุมสตรีมเมอร์ขนาดย่อสำหรับใส่ใน Custom Browser Dock ของ OBS Studio ตรวจจับวิดเจ็ตที่เปิดอยู่อัตโนมัติ',
        'Live Preview Sync: พรีวิวการปรับแต่งขนาด สี และธีมสดทันทีแบบไม่ต้องรีเฟรชหน้าจอ',
        'ปรับปรุง Custom Counter: ปรับแต่งคำสั่ง Twitch Chat อิสระ และปรับปรุงฟอนต์ตัวเลขให้สวยงามคมชัด'
      ]
    }
  ],
  cta: {
    text: 'เข้าสู่หน้าจัดการ Overlays',
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
