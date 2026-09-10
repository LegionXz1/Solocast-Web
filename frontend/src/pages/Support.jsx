import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  ChevronRight,
  Search,
  RefreshCw,
  Copy,
  Check,
  Filter,
  User,
  Calendar,
  MessageCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ISSUE_CATEGORIES = [
  { id: 'bug', label: 'บั๊ก / ข้อผิดพลาดของระบบ', icon: Bug, desc: 'ระบบทำงานไม่ถูกต้อง หรือแสดงผลผิดพลาด' },
  { id: 'perks', label: 'เปิร์ก DBD หรือ Killer ขาดหาย', icon: AlertCircle, desc: 'รายชื่อเปิร์กไม่ครบ หรือชื่อ/รูปภาพไม่ตรงกับในเกม' },
  { id: 'obs', label: 'ปัญหาการเชื่อมต่อ OBS Studio', icon: Tv, desc: 'Browser Source ไม่แสดงผล หรือไม่ตอบสนอง' },
  { id: 'feature', label: 'ข้อเสนอแนะฟีเจอร์ใหม่', icon: Lightbulb, desc: 'ไอเดียหรือฟังก์ชันที่คุณอยากให้เพิ่มเข้ามาใน HyperCast' },
  { id: 'other', label: 'คำถามหรือเรื่องอื่นๆ', icon: HelpCircle, desc: 'สอบถามเรื่องการใช้งานทั่วไป หรือประสานงาน' }
];

const STATUS_MAP = {
  pending: { label: 'รอดำเนินการ', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)' },
  in_progress: { label: 'กำลังตรวจสอบ', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.35)' },
  resolved: { label: 'แก้ไขแล้ว', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)' },
  closed: { label: 'ปิดเรื่องแล้ว', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.35)' }
};

export default function Support() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  // Active Tab: 'new' (แจ้งปัญหา) or 'track' (ติดตามสถานะ)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'new');

  // Form states
  const [category, setCategory] = useState('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [username, setUsername] = useState(user?.displayName || user?.username || '');
  const [contact, setContact] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  // Tracking states
  const [trackedTickets, setTrackedTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketSearchInput, setTicketSearchInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedTicketId, setExpandedTicketId] = useState(null);

  // Sync tab with URL
  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Helper to save ticket to localStorage
  const saveTicketToLocal = (id) => {
    try {
      const saved = JSON.parse(localStorage.getItem('hypercast_saved_tickets') || '[]');
      if (!saved.includes(id)) {
        saved.unshift(id);
        localStorage.setItem('hypercast_saved_tickets', JSON.stringify(saved));
      }
    } catch (e) {}
  };

  // Load user tickets for tracking
  const fetchUserTickets = async () => {
    setLoadingTickets(true);
    setSearchError('');
    try {
      const localIds = JSON.parse(localStorage.getItem('hypercast_saved_tickets') || '[]');
      const params = new URLSearchParams();
      if (user?.username) {
        params.set('username', user.username);
      }
      if (localIds.length > 0) {
        params.set('ticketIds', localIds.join(','));
      }

      // If user has no username and no local tickets, wait for manual search
      if (!user?.username && localIds.length === 0) {
        setTrackedTickets([]);
        setLoadingTickets(false);
        return;
      }

      const res = await fetch(`http://localhost:3000/api/support/tickets?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTrackedTickets(data.tickets || []);
          if (data.tickets?.length > 0 && !expandedTicketId) {
            setExpandedTicketId(data.tickets[0].ticketId);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  // Fetch when switching to track tab
  useEffect(() => {
    if (activeTab === 'track') {
      fetchUserTickets();
    }
  }, [activeTab, user?.username]);

  // Handle single ticket ID search
  const handleSearchSingleTicket = async (e) => {
    if (e) e.preventDefault();
    const query = ticketSearchInput.trim().toUpperCase();
    if (!query) return;

    setLoadingTickets(true);
    setSearchError('');
    try {
      const res = await fetch(`http://localhost:3000/api/support/tickets?ticketId=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && data.success && data.ticket) {
        // Save to local storage for quick access
        saveTicketToLocal(data.ticket.ticketId);
        // Merge into list
        setTrackedTickets(prev => {
          const filtered = prev.filter(t => t.ticketId.toUpperCase() !== data.ticket.ticketId.toUpperCase());
          return [data.ticket, ...filtered];
        });
        setExpandedTicketId(data.ticket.ticketId);
        setTicketSearchInput('');
      } else {
        setSearchError(data.error || 'ไม่พบหมายเลขเรื่องแจ้งปัญหานี้ในระบบ');
      }
    } catch (err) {
      setSearchError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setLoadingTickets(false);
    }
  };

  // Submit Issue
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
        saveTicketToLocal(data.ticketId);
      } else {
        setErrorMessage(data.error || 'เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      console.error('Support submission error:', err);
      const fallbackId = 'HYPER-' + Math.floor(100000 + Math.random() * 900000);
      setSubmittedTicket(fallbackId);
      saveTicketToLocal(fallbackId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTicketId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Filtered tickets in track view
  const filteredTickets = trackedTickets.filter(t => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  return (
    <div className="landing-container animate-fade-up" style={{ maxWidth: 880 }}>
      {/* Header */}
      <div className="hero-section" style={{ marginBottom: '1.25rem' }}>
        <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <AlertCircle size={13} /> ศูนย์รับแจ้งปัญหา & บริการผู้ใช้ HyperCast
        </span>
        <h1 className="hero-title">ศูนย์แจ้งปัญหาและช่วยเหลือ</h1>
        <p className="hero-desc">
          แจ้งข้อผิดพลาดของระบบ, สอบถามการเชื่อมต่อ หรือติดตามสถานะเรื่องที่คุณเคยแจ้งไว้ พร้อมดูคำตอบจากทีมงานได้แบบเรียลไทม์
        </p>

        {/* Tab Switcher */}
        <div style={{
          display: 'inline-flex',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-primary)',
          borderRadius: '999px',
          padding: '4px',
          marginTop: '1.25rem',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => handleTabSwitch('new')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.25rem',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: activeTab === 'new' ? 'var(--text-primary)' : 'transparent',
              color: activeTab === 'new' ? 'var(--bg-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <Send size={14} />
            <span>แจ้งปัญหาใหม่</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('track')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.25rem',
              borderRadius: '999px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: activeTab === 'track' ? 'var(--text-primary)' : 'transparent',
              color: activeTab === 'track' ? 'var(--bg-primary)' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={14} />
            <span>ติดตามสถานะ & การตอบกลับ</span>
            {trackedTickets.filter(t => t.adminReply && t.status !== 'closed').length > 0 && (
              <span style={{
                background: '#10B981',
                color: '#FFFFFF',
                fontSize: '0.68rem',
                padding: '1px 6px',
                borderRadius: '999px',
                fontWeight: 800
              }}>
                ตอบกลับแล้ว
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: SUBMIT NEW ISSUE */}
      {activeTab === 'new' && (
        submittedTicket ? (
          /* Success Confirmation View */
          <div className="doppel-shell animate-fade-up" style={{ marginBottom: '2rem' }}>
            <div className="doppel-core" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{
                width: 60,
                height: 60,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
                borderRadius: '50%',
                marginBottom: '1.25rem'
              }}>
                <CheckCircle2 size={32} />
              </div>

              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                ส่งข้อมูลแจ้งปัญหาเรียบร้อยแล้ว
              </h2>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: 500, margin: '0 auto 1.5rem auto', lineHeight: 1.6 }}>
                ทีมงานได้รับเรื่องของคุณแล้ว และจะเร่งตรวจสอบอย่างเร็วที่สุด คุณสามารถนำหมายเลข Ticket นี้ไปติดตามความคืบหน้าและการตอบกลับได้ทันที
              </p>

              {/* Ticket ID Box */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-secondary)',
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                marginBottom: '2rem'
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  color: 'var(--text-primary)'
                }}>
                  #{submittedTicket}
                </span>
                <button
                  type="button"
                  onClick={() => copyTicketId(submittedTicket)}
                  className="btn-island"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', borderRadius: '6px' }}
                  title="คัดลอกหมายเลขตั๋ว"
                >
                  {copiedId ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                  <span>{copiedId ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    handleTabSwitch('track');
                    setExpandedTicketId(submittedTicket);
                    fetchUserTickets();
                  }}
                  className="btn-island accent"
                  style={{ padding: '0.7rem 1.5rem' }}
                >
                  <Clock size={15} />
                  <span>ดูสถานะตั๋วนี้ทันที</span>
                </button>

                <button
                  onClick={() => {
                    setSubmittedTicket(null);
                    setSubject('');
                    setDescription('');
                    setScreenshotUrl('');
                  }}
                  className="btn-island"
                  style={{ padding: '0.7rem 1.25rem' }}
                >
                  <span>แจ้งปัญหาเรื่องอื่นเพิ่มเติม</span>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem', marginTop: '0.45rem' }}>
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
                          borderRadius: '8px',
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
                  placeholder="เช่น เปิร์ก DBD บางอันไม่ขึ้นในวงล้อ หรือ Browser Source ไม่แสดงใน OBS"
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
                  placeholder="กรุณาระบุขั้นตอนที่เกิดปัญหา หรือสิ่งที่ต้องการให้แอดมินช่วยตรวจสอบอย่างละเอียด..."
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
                    placeholder="เช่น legionxiz"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ margin: 0 }}>
                  <label htmlFor="contact">ช่องทางติดต่อกลับ (Discord / Email / เบอร์โทร)</label>
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
                  placeholder="วางลิงก์รูปภาพ เช่น https://imgur.com/... หรือ Google Drive"
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
        )
      )}

      {/* TAB 2: TRACK STATUS & ADMIN REPLIES */}
      {activeTab === 'track' && (
        <div className="animate-fade-up">
          {/* Lookup Search Bar */}
          <div className="doppel-shell" style={{ marginBottom: '1.5rem' }}>
            <div className="doppel-core" style={{ padding: '1.25rem' }}>
              <form onSubmit={handleSearchSingleTicket} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="ค้นหาด้วยหมายเลขตั๋ว เช่น HYPER-123456 หรือ SOLO-761869..."
                    value={ticketSearchInput}
                    onChange={(e) => setTicketSearchInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem 1rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingTickets}
                  className="btn-island accent"
                  style={{ padding: '0.7rem 1.25rem' }}
                >
                  <Search size={15} />
                  <span>ค้นหาเรื่อง</span>
                </button>
                <button
                  type="button"
                  onClick={fetchUserTickets}
                  disabled={loadingTickets}
                  className="btn-island"
                  style={{ padding: '0.7rem 1rem' }}
                  title="รีเฟรชข้อมูล"
                >
                  <RefreshCw size={15} className={loadingTickets ? 'spin' : ''} />
                  <span>รีเฟรช</span>
                </button>
              </form>

              {searchError && (
                <div style={{ color: 'var(--apple-red)', fontSize: '0.85rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  <span>{searchError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Filters */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: statusFilter === 'all' ? '1px solid var(--text-primary)' : '1px solid var(--border-primary)',
                background: statusFilter === 'all' ? 'var(--surface-3)' : 'var(--surface-1)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              ทั้งหมด ({trackedTickets.length})
            </button>
            {Object.entries(STATUS_MAP).map(([stKey, stInfo]) => {
              const count = trackedTickets.filter(t => t.status === stKey).length;
              const isSelected = statusFilter === stKey;
              return (
                <button
                  key={stKey}
                  type="button"
                  onClick={() => setStatusFilter(stKey)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: isSelected ? `1px solid ${stInfo.color}` : '1px solid var(--border-primary)',
                    background: isSelected ? stInfo.bg : 'var(--surface-1)',
                    color: isSelected ? stInfo.color : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {stInfo.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Tickets List */}
          {loadingTickets ? (
            <div className="doppel-shell" style={{ marginBottom: '2rem' }}>
              <div className="doppel-core" style={{ textAlign: 'center', padding: '3rem' }}>
                <RefreshCw size={24} className="spin" style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }} />
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>กำลังดึงข้อมูลรายการเรื่องที่คุณแจ้งไว้...</p>
              </div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="doppel-shell" style={{ marginBottom: '2rem' }}>
              <div className="doppel-core" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
                <HelpCircle size={36} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                  {statusFilter === 'all' ? 'ยังไม่มีประวัติการแจ้งปัญหา' : 'ไม่พบเรื่องในสถานะนี้'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: 420, margin: '0 auto 1.5rem auto' }}>
                  {statusFilter === 'all'
                    ? 'หากคุณเคยแจ้งปัญหาไว้บนอุปกรณ์นี้ หรือเข้าสู่ระบบด้วย Twitch ระบบจะแสดงรายการที่นี่โดยอัตโนมัติ หรือกรอกหมายเลขตั๋วในช่องค้นหาด้านบนได้ทันที'
                    : 'ลองเลือกตัวกรองสถานะอื่น หรือรีเฟรชข้อมูล'}
                </p>
                <button
                  onClick={() => handleTabSwitch('new')}
                  className="btn-island accent"
                  style={{ padding: '0.65rem 1.25rem' }}
                >
                  <Send size={14} />
                  <span>แจ้งปัญหาใหม่ตอนนี้</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {filteredTickets.map((ticket) => {
                const statusInfo = STATUS_MAP[ticket.status] || STATUS_MAP.pending;
                const isExpanded = expandedTicketId === ticket.ticketId;
                const catInfo = ISSUE_CATEGORIES.find(c => c.id === ticket.category) || ISSUE_CATEGORIES[0];
                const CatIcon = catInfo.icon;
                const hasReply = Boolean(ticket.adminReply && ticket.adminReply.trim());

                return (
                  <div key={ticket.ticketId} className="doppel-shell">
                    <div className="doppel-core" style={{ padding: '1.5rem' }}>
                      {/* Top Bar: Status Badge + Category + Ticket ID */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                          {/* Status Pill */}
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: statusInfo.bg,
                            border: `1px solid ${statusInfo.border}`,
                            color: statusInfo.color,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '999px'
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusInfo.color }} />
                            {statusInfo.label}
                          </span>

                          {/* Category Tag */}
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--surface-2)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: '4px'
                          }}>
                            <CatIcon size={12} />
                            {catInfo.label}
                          </span>

                          {/* Reply Notification Badge */}
                          {hasReply && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: '#10B981',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '4px'
                            }}>
                              <MessageCircle size={11} /> แอดมินตอบกลับแล้ว
                            </span>
                          )}
                        </div>

                        {/* Ticket ID & Copy */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)'
                          }}>
                            #{ticket.ticketId}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyTicketId(ticket.ticketId)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px'
                            }}
                            title="คัดลอก Ticket ID"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Subject */}
                      <h3 style={{
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '0.45rem',
                        lineHeight: 1.4
                      }}>
                        {ticket.subject}
                      </h3>

                      {/* Meta date & requester */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={13} />
                          {new Date(ticket.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        {ticket.username && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <User size={13} />
                            @{ticket.username}
                          </span>
                        )}
                      </div>

                      {/* Description Preview or Full */}
                      <div style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-secondary)',
                        borderRadius: '8px',
                        padding: '1rem',
                        fontSize: '0.88rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        marginBottom: '1rem'
                      }}>
                        {isExpanded ? ticket.description : (
                          ticket.description.length > 180 ? `${ticket.description.slice(0, 180)}...` : ticket.description
                        )}
                        {ticket.screenshotUrl && isExpanded && (
                          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-primary)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>ลิงก์ภาพประกอบ:</span>
                            <a
                              href={ticket.screenshotUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--accent, #3B82F6)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <span>{ticket.screenshotUrl}</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* ADMIN REPLY BOX */}
                      {hasReply ? (
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.05)',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                          borderRadius: '10px',
                          padding: '1.15rem',
                          marginBottom: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <ShieldCheck size={16} color="#10B981" />
                              <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                การตอบกลับจากทีมงาน HyperCast ({ticket.adminUser || 'Admin'})
                              </strong>
                            </div>
                            {ticket.adminRepliedAt && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {new Date(ticket.adminRepliedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                              </span>
                            )}
                          </div>
                          <p style={{
                            margin: 0,
                            fontSize: '0.9rem',
                            color: 'var(--text-primary)',
                            lineHeight: 1.65,
                            whiteSpace: 'pre-wrap'
                          }}>
                            {ticket.adminReply}
                          </p>
                        </div>
                      ) : (
                        <div style={{
                          background: 'var(--surface-2)',
                          border: '1px dashed var(--border-primary)',
                          borderRadius: '8px',
                          padding: '0.85rem 1rem',
                          fontSize: '0.825rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '0.5rem'
                        }}>
                          <Clock size={15} style={{ flexShrink: 0 }} />
                          <span>เรื่องของคุณอยู่ในคิวตรวจสอบของทีมงาน เมื่อแอดมินตอบกลับ ข้อความจะปรากฏที่นี่ทันที</span>
                        </div>
                      )}

                      {/* Toggle Expand / Collapse Button */}
                      {ticket.description.length > 180 && (
                        <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedTicketId(isExpanded ? null : ticket.ticketId)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>{isExpanded ? 'ย่อรายละเอียด' : 'ดูรายละเอียดเต็ม'}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
