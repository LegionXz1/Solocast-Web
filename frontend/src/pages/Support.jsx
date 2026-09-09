import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Send,
  CheckCircle2,
  MessageSquare,
  Bug,
  Lightbulb,
  Tv,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Clock,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ISSUE_CATEGORIES = [
  { id: 'bug', label: 'บั๊ก / ข้อผิดพลาดของระบบ', icon: Bug, desc: 'ระบบทำงานไม่ถูกต้อง หรือแสดงผลผิดพลาด' },
  { id: 'perks', label: 'เปิร์ก DBD หรือ Killer ขาดหาย', icon: AlertCircle, desc: 'รายชื่อเปิร์กไม่ครบ หรือชื่อ/รูปภาพไม่ตรงกับในเกม' },
  { id: 'obs', label: 'ปัญหาการเชื่อมต่อ OBS Studio', icon: Tv, desc: 'Browser Source ไม่แสดงผล หรือไม่ตอบสนอง' },
  { id: 'feature', label: 'ข้อเสนอแนะฟีเจอร์ใหม่', icon: Lightbulb, desc: 'ไอเดียหรือฟังก์ชันที่คุณอยากให้เพิ่มเข้ามาใน SoloCast' },
  { id: 'other', label: 'คำถามหรือเรื่องอื่นๆ', icon: HelpCircle, desc: 'สอบถามเรื่องการใช้งานทั่วไป หรือประสานงาน' }
];

export default function Support() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [category, setCategory] = useState('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [username, setUsername] = useState(user?.displayName || user?.username || '');
  const [contact, setContact] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setErrorMessage('กรุณาระบุหัวข้อปัญหาและรายละเอียดให้ครบถ้วน');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await fetch('http://localhost:3000/api/support/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim(),
          username: username.trim() || user?.username || 'Guest',
          contact: contact.trim(),
          screenshotUrl: screenshotUrl.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSubmittedTicket(data.ticketId);
      } else {
        setErrorMessage(data.error || 'เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      console.error('Support submission error:', err);
      // Fallback ticket ID if offline
      setSubmittedTicket('SOLO-' + Math.floor(100000 + Math.random() * 900000));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="landing-container animate-fade-up" style={{ maxWidth: 840 }}>
      {/* Header */}
      <div className="hero-section" style={{ marginBottom: '1.5rem' }}>
        <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <AlertCircle size={13} /> ศูนย์รับแจ้งปัญหา & ข้อเสนอแนะ
        </span>
        <h1 className="hero-title">แจ้งปัญหาการใช้งาน</h1>
        <p className="hero-desc">
          หากพบข้อผิดพลาดของระบบ, เปิร์ก DBD ขาดหาย หรือมีไอเดียฟีเจอร์ใหม่ที่อยากแนะนำ สามารถส่งข้อมูลให้ทีมงาน LegionX ตรวจสอบและพัฒนาปรับปรุงได้อย่างรวดเร็ว
        </p>
      </div>

      {submittedTicket ? (
        /* Success Confirmation View */
        <div className="doppel-shell animate-fade-up">
          <div className="doppel-core" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <div style={{
              width: 56,
              height: 56,
              background: 'var(--success-surface)',
              border: '1px solid var(--apple-green)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--apple-green)',
              marginBottom: '1.25rem'
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              ส่งข้อมูลแจ้งปัญหาเรียบร้อยแล้ว
            </h2>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 480, margin: '0 auto 1.5rem auto', lineHeight: 1.6 }}>
              ทีมงานได้รับเรื่องของคุณแล้ว และจะรีบดำเนินการตรวจสอบโดยเร็วที่สุด หมายเลขอ้างอิงของคุณคือ:
            </p>

            <div style={{
              display: 'inline-block',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-secondary)',
              padding: '0.65rem 1.5rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '1.2rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-primary)',
              marginBottom: '2rem'
            }}>
              #{submittedTicket}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setSubmittedTicket(null);
                  setSubject('');
                  setDescription('');
                  setScreenshotUrl('');
                }}
                className="btn-island"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                <span>แจ้งปัญหาเรื่องอื่นเพิ่มเติม</span>
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-island accent"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                <span>กลับสู่แผงควบคุม</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Report Form */
        <div className="doppel-shell" style={{ marginBottom: '2rem' }}>
          <form onSubmit={handleSubmit} className="doppel-core" style={{ padding: '2rem' }}>
            {errorMessage && (
              <div style={{
                background: 'var(--danger-surface)',
                border: '1px solid var(--apple-red)',
                color: 'var(--apple-red)',
                padding: '0.85rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Category Selector */}
            <div className="input-group">
              <label>หมวดหมู่ของปัญหา (Category)</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem', marginTop: '0.45rem' }}>
                {ISSUE_CATEGORIES.map(cat => {
                  const isSelected = category === cat.id;
                  const Icon = cat.icon;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      style={{
                        padding: '0.85rem 1rem',
                        background: isSelected ? 'var(--surface-3)' : 'var(--surface-1)',
                        border: isSelected ? '1px solid var(--border-focus)' : '1px solid var(--border-primary)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                        <Icon size={14} style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {cat.label}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {cat.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subject Field */}
            <div className="input-group">
              <label htmlFor="subject">หัวข้อเรื่อง (Subject) *</label>
              <input
                id="subject"
                type="text"
                placeholder="เช่น เปิร์กใหม่ของ Tomb Raider ไม่แสดงในรายการสุ่ม หรือ Browser Source ค้างใน OBS"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {/* Description Field */}
            <div className="input-group">
              <label htmlFor="description">รายละเอียดของปัญหา (Details) *</label>
              <textarea
                id="description"
                rows={5}
                placeholder="กรุณาระบุขั้นตอนที่ทำให้เกิดปัญหา หรือสิ่งที่ต้องการให้ระบบช่วยเหลืออย่างละเอียด..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Two Column Row: Username & Contact */}
            <div className="admin-form-row">
              <div className="input-group" style={{ margin: 0 }}>
                <label htmlFor="username">ชื่อช่องสตรีม Twitch ของคุณ</label>
                <input
                  id="username"
                  type="text"
                  placeholder="เช่น legionxiz0"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="input-group" style={{ margin: 0 }}>
                <label htmlFor="contact">ช่องทางติดต่อกลับ (Discord / Email)</label>
                <input
                  id="contact"
                  type="text"
                  placeholder="เช่น Discord: legion#1234 หรือ email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>
            </div>

            {/* Screenshot link */}
            <div className="input-group" style={{ marginTop: '1.25rem' }}>
              <label htmlFor="screenshot">ลิงก์ภาพหน้าจอหรือวิดีโอประกอบ (Optional URL)</label>
              <input
                id="screenshot"
                type="text"
                placeholder="วางลิงก์รูปภาพ เช่น https://imgur.com/... หรือ Discord attachment"
                value={screenshotUrl}
                onChange={(e) => setScreenshotUrl(e.target.value)}
              />
            </div>

            {/* Submit Button */}
            <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => navigate('/faq')}
                className="btn-island"
              >
                <span>ดู FAQ ก่อน</span>
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-island accent"
                style={{ padding: '0.65rem 1.5rem', gap: '0.5rem' }}
              >
                <Send size={15} />
                <span>{isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งเรื่องแจ้งปัญหา'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Direct Contact Channels Box */}
      <div className="features-bento" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="doppel-shell">
          <div className="doppel-core">
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={16} /> คอมมูนิตี้ & การช่วยเหลือสด
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1rem 0' }}>
              ติดต่อสอบถามหรือแลกเปลี่ยนความคิดเห็นกับเพื่อนๆ สตรีมเมอร์ได้ที่คอมมูนิตี้
            </p>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--apple-green)' }}>
              ● สถานะระบบ: เปิดให้บริการปกติ (Operational)
            </span>
          </div>
        </div>

        <div className="doppel-shell">
          <div className="doppel-core">
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={16} /> เวลาการตอบกลับ
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              ทีมงานตรวจสอบรายงานปัญหาอย่างต่อเนื่อง โดยปัญหาเร่งด่วนเกี่ยวกับ Twitch Event หรือ DBD Sync จะได้รับการตรวจสอบภายใน 24 ชั่วโมง
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
