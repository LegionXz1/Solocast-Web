import React, { useEffect, useState, useRef, useMemo } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE, WS_BASE } from '../config';
import {
  Sliders,
  History,
  CalendarCheck,
  Save,
  Loader2,
  Eye,
  Megaphone,
  Play,
  RotateCw,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Link,
  Zap,
  Copy,
  Check,
  Info,
  Trash2,
  Users,
  Ticket,
  Dices,
  Skull,
  User,
  Award,
  Gift,
  Clock,
  UserCheck,
  Grid,
  Square,
  X,
  ShieldCheck,
  Star,
  LogOut,
  Search,
  Ban
} from 'lucide-react';

const socket = io(WS_BASE);

const WIDGET_META = {
  'dbd-perks': {
    icon: <Dices size={20} />,
    desc: 'สุ่มเปิร์คผู้รอดชีวิตและฆาตกร',
    gradient: 'linear-gradient(135deg, #2B70F7, #06B6D4)'
  },
  'random-killer': {
    icon: <Skull size={20} />,
    desc: 'สุ่มฆาตกร',
    gradient: 'linear-gradient(135deg, #EF4444, #B91C1C)'
  },
  'loyalty-card': {
    icon: <Ticket size={20} />,
    desc: 'ระบบการ์ดสะสมแต้มแชทและเช็คอิน',
    gradient: 'linear-gradient(135deg, #10B981, #047857)'
  },
  'twitch-shoutout': {
    icon: <Megaphone size={20} />,
    desc: 'ป็อปอัปแนะนำ & โปรโมทช่องสตรีม',
    gradient: 'linear-gradient(135deg, #9146FF, #6D28D9)'
  }
};

function Dashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem('solocast_user_token') || '');
  const [status, setStatus] = useState({ connected: false, username: '', isAdmin: false, userId: '' });
  const [events, setEvents] = useState([]);

  // Widget Data
  const [widgets, setWidgets] = useState([]);
  const [selectedWidget, setSelectedWidget] = useState('');
  const [schema, setSchema] = useState(null);
  const [fieldData, setFieldData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const saveTimeoutRef = useRef(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Tab & History State
  const [activeTab, setActiveTab] = useState('workspace'); // 'workspace' | 'history'
  const [rollHistory, setRollHistory] = useState([]);

  // Live Preview State
  const [previewKey, setPreviewKey] = useState(0);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [bgMode, setBgMode] = useState('checker'); // 'checker' | 'dark-solid' | 'green-screen'
  const [shoutoutChannel, setShoutoutChannel] = useState('legionxiz');
  const hasRollHistory = selectedWidget && selectedWidget !== 'twitch-shoutout';

  // DBD Perks State & Search
  const [dbdPerksList, setDbdPerksList] = useState({ survivor: [], killer: [] });
  const [dbdSearchQuery, setDbdSearchQuery] = useState('');
  const [isSyncingPerks, setIsSyncingPerks] = useState(false);
  const [syncPerksSuccess, setSyncPerksSuccess] = useState('');

  // Random Killer State & Search
  const [killersList, setKillersList] = useState([]);
  const [killerSearchQuery, setKillerSearchQuery] = useState('');

  // สรุปยอดนับการเช็คอินของผู้ใช้แต่ละคน (สำหรับ Loyalty Card)
  const loyaltyUserSummary = useMemo(() => {
    if (selectedWidget !== 'loyalty-card') return [];
    const map = new Map();
    for (const item of rollHistory) {
      const u = (item.username || '').toLowerCase();
      if (!u) continue;
      const countVal = item.count !== undefined ? Number(item.count) : 1;
      if (!map.has(u)) {
        map.set(u, {
          username: item.username,
          count: countVal,
          avatar: item.avatar || `/api/twitch/avatar/${encodeURIComponent(item.username)}`,
          lastTime: item.timestamp
        });
      } else {
        const existing = map.get(u);
        if (countVal > existing.count) {
          existing.count = countVal;
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [rollHistory, selectedWidget]);

  // 1. ดักจับ Token ที่ส่งกลับมาจาก Twitch OAuth Redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('auth_token');
    if (urlToken) {
      localStorage.setItem('solocast_user_token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // 2. ตรวจสอบ Session ของเบราว์เซอร์นี้
  useEffect(() => {
    const activeToken = token || localStorage.getItem('solocast_user_token');
    if (!activeToken) {
      setStatus({ connected: false, username: '', isAdmin: false, userId: '' });
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${activeToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.loggedIn && data.user) {
          setStatus({
            connected: true,
            username: data.user.displayName || data.user.username,
            isAdmin: data.user.isAdmin,
            userId: data.user.userId
          });
          socket.emit('join_user', { token: activeToken, userId: data.user.userId });
        } else {
          localStorage.removeItem('solocast_user_token');
          setToken('');
          setStatus({ connected: false, username: '', isAdmin: false, userId: '' });
        }
      })
      .catch(() => {
        setStatus({ connected: false, username: '', isAdmin: false, userId: '' });
      });
  }, [token]);

  // 3. โหลด Widgets รายการทั้งหมด
  useEffect(() => {
    fetch(`${API_BASE}/api/widgets`)
      .then(res => res.json())
      .then(data => {
        setWidgets(data);
        if (data.length > 0) setSelectedWidget(data[0].id);
      })
      .catch(err => console.error("Error fetching widgets:", err));
  }, []);

  // 4. โหลด Schema และ ค่าการตั้งค่าที่บันทึกไว้ (เช่น Reward Name)
  useEffect(() => {
    if (!selectedWidget) return;

    Promise.all([
      fetch(`${API_BASE}/api/widgets/${selectedWidget}/schema`).then(res => res.ok ? res.json() : null),
      fetch(`${API_BASE}/api/widgets/${selectedWidget}/settings?user=${status.userId || ''}`).then(res => res.ok ? res.json() : null)
    ])
      .then(([schemaData, savedSettings]) => {
        setSchema(schemaData);
        const merged = {};
        if (schemaData) {
          for (const key in schemaData) {
            merged[key] = schemaData[key].value;
          }
        }
        if (savedSettings && Object.keys(savedSettings).length > 0) {
          Object.assign(merged, savedSettings);
        }
        setFieldData(merged);
      })
      .catch(err => {
        console.error("Error loading widget data:", err);
      });
  }, [selectedWidget, status.userId]);

  // 4.1 โหลดข้อมูลเปิร์ค DBD เมื่อเปิด Widget dbd-perks
  useEffect(() => {
    if (selectedWidget === 'dbd-perks' && (!dbdPerksList.survivor || dbdPerksList.survivor.length === 0)) {
      fetch(`${API_BASE}/api/widgets/dbd-perks/perks`)
        .then(res => res.ok ? res.json() : { survivor: [], killer: [] })
        .then(data => {
          if (data && (data.survivor || data.killer)) {
            setDbdPerksList(data);
          }
        })
        .catch(err => console.error('Error fetching DBD perks:', err));
    }
  }, [selectedWidget, dbdPerksList]);

  // 4.2 โหลดข้อมูล Killers เมื่อเลือก Random Killer Widget
  useEffect(() => {
    if (selectedWidget === 'random-killer' && killersList.length === 0) {
      fetch(`${API_BASE}/api/widgets/random-killer/killers`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setKillersList(data);
          }
        })
        .catch(err => console.error('Error fetching DBD killers:', err));
    }
  }, [selectedWidget, killersList]);

  // 5. โหลดประวัติการสุ่ม (Roll History) ของ Widget นี้
  useEffect(() => {
    if (!selectedWidget || selectedWidget === 'twitch-shoutout') {
      setRollHistory([]);
      return;
    }
    fetch(`${API_BASE}/api/widgets/${selectedWidget}/history?user=${encodeURIComponent(status.userId || '')}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setRollHistory(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error('Error fetching roll history:', err));
  }, [selectedWidget, status.userId]);

  // 6. ฟัง Event เข้ามา (Twitch Live Events & Real-time Roll History)
  useEffect(() => {
    const handleEvent = (event) => {
      setEvents((prev) => [event, ...prev].slice(0, 5));
    };
    const handleNewRoll = (payload) => {
      if (payload && payload.widgetId === selectedWidget && payload.item) {
        setRollHistory(prev => {
          // ป้องกันไอเทมซ้ำ
          if (prev.some(it => it.id === payload.item.id)) return prev;
          return [payload.item, ...prev].slice(0, 100);
        });
      }
    };
    const handleClearedHistory = (payload) => {
      if (payload && payload.widgetId === selectedWidget) {
        setRollHistory([]);
      }
    };

    const handleDbdPerksUpdated = (newData) => {
      if (newData) setDbdPerksList(newData);
    };

    socket.on('onEventReceived', handleEvent);
    socket.on('widget_roll_history_item', handleNewRoll);
    socket.on('widget_roll_history_cleared', handleClearedHistory);
    socket.on('dbd_perks_updated', handleDbdPerksUpdated);

    return () => {
      socket.off('onEventReceived', handleEvent);
      socket.off('widget_roll_history_item', handleNewRoll);
      socket.off('widget_roll_history_cleared', handleClearedHistory);
      socket.off('dbd_perks_updated', handleDbdPerksUpdated);
    };
  }, [selectedWidget]);

  // ฟังก์ชันบันทึกการตั้งค่าลง Backend พร้อมส่ง Signal ไปยัง OBS แบบ Real-time
  const handleSaveSettings = async (dataToSave = fieldData) => {
    if (!selectedWidget) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/widgets/${selectedWidget}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: status.userId,
          settings: dataToSave
        })
      });
      if (res.ok) {
        setSaveSuccess('ซิงค์ไปยัง OBS เรียบร้อยแล้ว');
        setTimeout(() => setSaveSuccess(''), 2500);
      }
    } catch (e) {
      console.error('Save settings error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // เปลี่ยนค่า Field พร้อม Debounce Auto-Save ภายใน 600ms
  const handleFieldChange = (key, value) => {
    const updated = { ...fieldData, [key]: value };
    setFieldData(updated);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSaveSettings(updated);
    }, 600);
  };

  const handleLogout = async () => {
    const activeToken = token || localStorage.getItem('solocast_user_token');
    if (activeToken) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });
      } catch (e) { }
    }
    localStorage.removeItem('solocast_user_token');
    setToken('');
    setStatus({ connected: false, username: '', isAdmin: false, userId: '' });
  };

  const handleSimulate = () => {
    socket.emit('test_event', {
      userId: status.userId,
      type: 'follower',
      data: { name: 'TestUser123' }
    });
  };

  const handleSimulateRedemption = () => {
    const title = (fieldData['rewardName'] || 'สุ่มคิลเลอร์').trim();
    // บันทึกค่าล่าสุดทันทีเพื่อให้มั่นใจว่า Widget ได้รับการอัพเดท
    handleSaveSettings(fieldData);

    const testUser = status.username || 'legionxiz';
    const simEvent = {
      userId: status.userId,
      type: 'redemption',
      isTest: true,
      data: {
        name: testUser,
        displayName: testUser,
        rewardTitle: title,
        avatar: `/api/twitch/avatar/${encodeURIComponent(testUser)}`,
        profileImage: `/api/twitch/avatar/${encodeURIComponent(testUser)}`,
        isTest: true
      }
    };

    socket.emit('test_event', simEvent);
    // แสดงผลใน Live Logs ฝั่งหน้าเว็บทันที
    setEvents((prev) => [simEvent, ...prev].slice(0, 5));
  };

  const handleReloadPreview = () => {
    setPreviewKey(prev => prev + 1);
  };

  const handleTriggerPreview = () => {
    if (selectedWidget === 'twitch-shoutout') {
      const ch = (shoutoutChannel || status.username || 'legionxiz').trim().toLowerCase().replace('@', '');
      socket.emit('simulate_shoutout', {
        userId: status.userId,
        channel: ch
      });
      setEvents((prev) => [{
        userId: status.userId,
        type: 'shoutout',
        data: { username: ch, channel: ch }
      }, ...prev].slice(0, 5));
    } else if (selectedWidget === 'dbd-perks') {
      const curRole = fieldData.role || 'survivor';
      const testUser = status.username || 'Streamer';
      socket.emit('simulate_dbd_perk', {
        userId: status.userId,
        role: curRole,
        username: testUser
      });
    } else {
      handleSimulateRedemption();
    }
  };

  const handleSyncDbdPerks = async () => {
    setIsSyncingPerks(true);
    setSyncPerksSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/widgets/dbd-perks/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        setDbdPerksList(data.data);
        setSyncPerksSuccess(`อัปเดตเปิร์คเรียบร้อย! (ทั้งหมด ${data.data.total} เปิร์ค)`);
        setTimeout(() => setSyncPerksSuccess(''), 4000);
      } else {
        alert('ไม่สามารถอัปเดตเปิร์คได้: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error syncing DBD perks:', err);
      alert('เกิดข้อผิดพลาดในการดึงข้อมูลเปิร์คจาก Wiki: ' + err.message);
    } finally {
      setIsSyncingPerks(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('คุณต้องการล้างประวัติการสุ่มทั้งหมดใช่หรือไม่?')) return;
    try {
      await fetch(`${API_BASE}/api/widgets/${selectedWidget}/history?user=${encodeURIComponent(status.userId || '')}`, {
        method: 'DELETE'
      });
      setRollHistory([]);
    } catch (err) {
      console.error('Failed to clear roll history:', err);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    const secs = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${mins}:${secs} น.`;
  };

  let widgetUrl = '';
  let previewUrl = '';
  if (selectedWidget) {
    const params = new URLSearchParams();
    if (status.userId) params.append('user', status.userId);
    if (status.username) params.append('channel', status.username);
    // ลิงก์ Browser Source ของ OBS จะคงที่ถาวร ไม่ต้องมี Query parameters ของการตั้งค่า
    // เพราะระบบจะซิงค์การตั้งค่าล่าสุดผ่าน Database & WebSocket แบบเรียลไทม์อัตโนมัติ
    widgetUrl = `${API_BASE}/widgets/${selectedWidget}/index.html?${params.toString()}`;
    previewUrl = `${API_BASE}/widgets/${selectedWidget}/index.html?user=${encodeURIComponent(status.userId || '')}&preview=1&_k=${previewKey}`;
  }

  const handleCopyUrl = () => {
    if (!widgetUrl) return;
    navigator.clipboard.writeText(widgetUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const renderSchemaForm = () => {
    if (!schema) return <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>กำลังโหลดหน้าจอตั้งค่า...</p>;

    const groups = {};
    for (const key in schema) {
      const field = schema[key];
      const g = field.group || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push({ key, ...field });
    }

    return Object.keys(groups).map(groupName => {
      const visibleFields = groups[groupName].filter(f => f.type !== 'custom');
      if (visibleFields.length === 0) return null;

      return (
        <div key={groupName} style={{ marginBottom: '1.75rem', padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.15rem' }}>
            <span style={{ width: '4px', height: '14px', background: 'var(--accent-color)', display: 'inline-block' }}></span>
            <h4 style={{ margin: 0, fontSize: '0.85rem', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>{groupName}</h4>
          </div>
          {visibleFields.map(field => (
            <div key={field.key} className="input-group">
              <label title={field.key}>{field.label}</label>
              {(field.type === 'text' || field.type === 'number') && (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={fieldData[field.key] !== undefined ? fieldData[field.key] : ''}
                  onChange={e => handleFieldChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                />
              )}
              {(field.type === 'dropdown' || field.type === 'select') && (
                <select
                  value={fieldData[field.key] !== undefined ? fieldData[field.key] : (field.value || '')}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                >
                  {field.options && (
                    Array.isArray(field.options)
                      ? field.options.map((opt, idx) => {
                        const val = typeof opt === 'object' && opt !== null ? (opt.value ?? opt.id ?? idx) : opt;
                        const lbl = typeof opt === 'object' && opt !== null ? (opt.label ?? opt.name ?? val) : opt;
                        return <option key={val} value={val}>{lbl}</option>;
                      })
                      : Object.entries(field.options).map(([optVal, optLabel]) => (
                        <option key={optVal} value={optVal}>{optLabel}</option>
                      ))
                  )}
                </select>
              )}
              {field.type === 'colorpicker' && (
                <div className="color-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="color"
                    value={fieldData[field.key] || '#000000'}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                  />
                  <span style={{ fontFamily: 'Consolas, monospace', fontSize: '0.85rem', color: '#E2E8F0', background: 'rgba(0,0,0,0.4)', padding: '0.35rem 0.75rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {fieldData[field.key] || '#000000'}
                  </span>
                </div>
              )}
              {field.type === 'slider' && (
                <div className="slider-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={fieldData[field.key] !== undefined ? fieldData[field.key] : 0}
                    onChange={e => handleFieldChange(field.key, Number(e.target.value))}
                  />
                  <span style={{ fontFamily: 'Consolas, monospace', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: '40px', textAlign: 'right', background: 'var(--surface-3)', padding: '0.2rem 0.5rem', border: '1px solid var(--border-secondary)' }}>
                    {fieldData[field.key] !== undefined ? fieldData[field.key] : 0}
                  </span>
                </div>
              )}
              {field.type === 'checkbox' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer', marginTop: '0.35rem', userSelect: 'none' }}>
                  <div style={{
                    width: '36px',
                    height: '20px',
                    borderRadius: '10px',
                    background: (fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? 'var(--accent-color)' : 'var(--surface-3)',
                    border: '1px solid var(--border-secondary)',
                    position: 'relative',
                    transition: 'all 150ms ease'
                  }}>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: (fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? 'var(--accent-contrast)' : 'var(--text-muted)',
                      position: 'absolute',
                      top: '2px',
                      left: (fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? '18px' : '2px',
                      transition: 'all 150ms ease'
                    }} />
                  </div>
                  <input
                    type="checkbox"
                    style={{ display: 'none' }}
                    checked={fieldData[field.key] !== undefined ? Boolean(fieldData[field.key]) : Boolean(field.value)}
                    onChange={e => handleFieldChange(field.key, e.target.checked)}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: (fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {(fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? 'เปิดใช้งาน (Enabled)' : 'ปิดใช้งาน (Disabled)'}
                  </span>
                </label>
              )}
              {field.type === 'sound-input' && (
                <input
                  type="text"
                  placeholder="URL ของไฟล์เสียง (เว้นว่างไว้ถ้าไม่ต้องการเสียง)"
                  value={fieldData[field.key] || ''}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                />
              )}
              {(field.type === 'image-input' || field.type === 'image') && (
                <input
                  type="text"
                  placeholder="URL รูปภาพ (เช่น https://... หรือเว้นว่างไว้)"
                  value={fieldData[field.key] !== undefined ? fieldData[field.key] : (field.value || '')}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                />
              )}
              {field.type === 'textarea' && (
                <textarea
                  rows={3}
                  placeholder="กรอกข้อความ..."
                  value={fieldData[field.key] !== undefined ? fieldData[field.key] : (field.value || '')}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                />
              )}
              {field.type === 'button' && (
                <button
                  type="button"
                  className="btn-island"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', width: 'fit-content' }}
                  onClick={() => {
                    socket.emit('test_event', {
                      userId: status.userId,
                      type: 'button_action',
                      action: field.value || field.key
                    });
                  }}
                >
                  <span>{field.label}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      );
    });
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-title-bar animate-fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <span className="eyebrow" style={{ marginBottom: '0.35rem' }}>LIVE STUDIO DASHBOARD</span>
          <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            แผงควบคุมสตรีมเมอร์
          </h1>
        </div>
      </div>

      <div className="bento-grid">
        {/* Left Column: Twitch Status, Widget Selector & Customization Settings */}
        <div className="doppel-shell sidebar-sticky animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="doppel-core">
            {status.connected ? (
              <>
                {/* Compact Twitch Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div className="status-dot connected" style={{ width: '8px', height: '8px' }}></div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>ช่อง TWITCH</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                        @{status.username}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'rgba(48, 209, 88, 0.12)',
                    color: '#30D158',
                    border: '1px solid rgba(48, 209, 88, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#30D158' }}></span>
                    Online
                  </span>
                </div>

                {/* Section 1: Widget Selector */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="eyebrow" style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800 }}>เลือก WIDGET สตรีม</span>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: 'var(--surface-3)',
                        color: 'var(--text-secondary)',
                        padding: '1px 8px',
                        borderRadius: '999px',
                        border: '1px solid var(--border-primary)'
                      }}>
                        {widgets.length}
                      </span>
                    </div>
                  </div>

                  <div className="sidebar-widget-list">
                    {widgets.map(w => {
                      const isSelected = selectedWidget === w.id;
                      const meta = WIDGET_META[w.id] || {
                        icon: <Zap size={20} />,
                        desc: w.id,
                        gradient: 'linear-gradient(135deg, var(--accent-color), #7C3AED)'
                      };
                      return (
                        <div
                          key={w.id}
                          className={`sidebar-widget-card ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedWidget(w.id)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="card-content">
                            <div className="card-title-row">
                              <span className="card-title">{w.name}</span>
                              {isSelected && (
                                <span className="card-active-pill">
                                  <Check size={11} strokeWidth={3} />
                                  <span>กำลังเลือก</span>
                                </span>
                              )}
                            </div>
                            <div className="card-desc">{meta.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <hr className="divider" style={{ margin: '1rem 0' }} />

                {/* Section 2: Widget Settings & Customization Form */}
                {selectedWidget && (
                  <div className="sidebar-settings-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <span className="eyebrow" style={{ margin: '0 0 0.25rem 0' }}>ปรับแต่ง WIDGET</span>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {widgets.find(w => w.id === selectedWidget)?.name}
                        </h3>
                      </div>
                      <button
                        onClick={() => handleSaveSettings(fieldData)}
                        className="btn-island accent"
                        style={{ padding: '0.4rem 0.95rem', fontSize: '0.8rem' }}
                        disabled={isSaving}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                          {isSaving ? 'กำลังบันทึก...' : 'บันทึก'}
                        </span>
                      </button>
                    </div>

                    {saveSuccess && (
                      <div style={{
                        marginBottom: '0.75rem',
                        padding: '0.4rem 0.65rem',
                        background: 'rgba(48, 209, 88, 0.1)',
                        border: '1px solid rgba(48, 209, 88, 0.25)',
                        color: '#30D158',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: 'var(--radius-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}>
                        <Check size={13} /> {saveSuccess}
                      </div>
                    )}

                    {/* Schema Customization Form Fields */}
                    <div className="schema-container">
                      {renderSchemaForm()}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Compact not-connected status — no button here */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem', background: 'var(--surface-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>สถานะ</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ยังไม่ได้เข้าสู่ระบบ</div>
                  </div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', lineHeight: 1.6 }}>
                  เข้าสู่ระบบด้วย Twitch เพื่อเริ่มใช้งาน widget และ customization ได้เต็มรูปแบบ
                </p>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Studio Workspace (Preview, OBS URL, Content Tabs & History) */}
        {status.connected ? (
          <div className="doppel-shell animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div className="doppel-core">
              {selectedWidget && (
                <div>
                  {/* Live Preview Canvas Box */}
                  <div className="live-preview-box">
                    <div className="live-preview-header">
                      <div className="live-preview-title">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Eye size={16} /> ตัวอย่างผลลัพธ์สด (Live Preview)
                        </span>
                        <span className="live-preview-badge">Real-Time Sync</span>
                      </div>

                      <div className="live-preview-actions">
                        {selectedWidget === 'twitch-shoutout' ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="text"
                              value={shoutoutChannel}
                              onChange={(e) => setShoutoutChannel(e.target.value)}
                              placeholder="ชื่อช่อง (เช่น legionxiz)"
                              style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                color: '#fff',
                                padding: '4px 8px',
                                fontSize: '0.78rem',
                                width: '130px'
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleTriggerPreview}
                              className="btn-preview-action accent"
                              title="ทดสอบยิง Shoutout ช่องนี้ทันที"
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Megaphone size={14} /> ยิง Shoutout
                              </span>
                            </button>
                          </div>
                        ) : selectedWidget === 'dbd-perks' ? (
                          <button
                            type="button"
                            onClick={handleTriggerPreview}
                            className="btn-preview-action accent"
                            title="ทดสอบสุ่มเปิร์ค DBD ทันที"
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Dices size={14} /> สุ่มเปิร์ค DBD (Test Roll)
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleTriggerPreview}
                            className="btn-preview-action accent"
                            title="ทดสอบแสดงผล Roulette ทันที"
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Play size={14} /> ทดสอบสุ่ม (Trigger)
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleReloadPreview}
                          className="btn-preview-action"
                          title="รีเฟรชหน้าต่าง Preview"
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <RotateCw size={14} /> รีเฟรช
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowFullscreenPreview(true)}
                          className="btn-preview-action"
                          title="เปิดดูแบบขยายเต็มจอ"
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Maximize2 size={14} /> ขยายเต็มจอ
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)}
                          className="btn-preview-action"
                          title={isPreviewCollapsed ? "แสดงตัวอย่าง" : "ย่อตัวอย่าง"}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            {isPreviewCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                            {isPreviewCollapsed ? 'แสดง' : 'ย่อ'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {!isPreviewCollapsed && (
                      <div className={`live-preview-canvas ${bgMode}`}>
                        <iframe
                          key={`preview-${previewKey}`}
                          src={previewUrl}
                          className="live-preview-iframe"
                          title="Live Widget Preview"
                        />
                      </div>
                    )}
                  </div>

                  {/* OBS URL Box (Static & Auto-Syncing) */}
                  <div className="url-box" style={{
                    marginTop: '1.25rem',
                    marginBottom: '1.5rem',
                    padding: '1.25rem',
                    background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.1))'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Link size={16} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ลิงก์ Browser Source สำหรับ OBS
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          background: 'rgba(48, 209, 88, 0.12)',
                          color: '#30D158',
                          border: '1px solid rgba(48, 209, 88, 0.25)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <Zap size={12} /> ซิงค์ค่าอัตโนมัติ Real-Time
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="btn-island"
                        style={{
                          padding: '0.4rem 0.85rem',
                          fontSize: '0.8rem',
                          background: '#FFFFFF',
                          color: '#000000',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontWeight: 600,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
                          {copiedUrl ? 'คัดลอกสำเร็จแล้ว!' : 'คัดลอกลิงก์ OBS'}
                        </span>
                      </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        readOnly
                        value={widgetUrl}
                        onClick={e => e.target.select()}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          background: 'rgba(0, 0, 0, 0.35)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem',
                          fontFamily: 'monospace',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{
                      marginTop: '0.65rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.55,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.45rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '0.5rem 0.75rem',
                    }}>
                      <Info size={16} style={{ color: '#A3A3A3', flexShrink: 0, marginTop: '2px' }} />
                      <span>
                        <strong>ใส่เพียงครั้งเดียวจบ:</strong> ลิงก์นี้จะคงที่ถาวร เมื่อคุณเปลี่ยนสี, ปรับฟอนต์, สลับไอคอน หรือแก้ไขข้อความใดๆ ใน Sidebar ระบบจะบันทึกและส่งข้อมูลไปอัปเดตหน้าจอ OBS แบบ <strong>Real-time ทันที</strong> โดยไม่ต้องคัดลอกลิงก์ใหม่ และไม่ต้องกด Refresh ใน OBS
                      </span>
                    </div>
                  </div>

                  {/* Tab Navigation: Workspace vs Roll History */}
                  {hasRollHistory && (
                    <div className="widget-tab-nav" style={{ marginBottom: '1.25rem' }}>
                      <button
                        type="button"
                        onClick={() => setActiveTab('workspace')}
                        className={`widget-tab-btn ${activeTab === 'workspace' ? 'active' : ''}`}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          {selectedWidget === 'loyalty-card' ? <Award size={16} /> : <Ban size={16} />}
                          {selectedWidget === 'loyalty-card'
                            ? 'สรุปยอดสะสม (Leaderboard)'
                            : selectedWidget === 'dbd-perks'
                              ? 'จัดการเปิร์ค & Blacklist'
                              : 'จัดการคิลเลอร์ & Blacklist'}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`widget-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          {selectedWidget === 'loyalty-card' ? <CalendarCheck size={16} /> : <History size={16} />}
                          {selectedWidget === 'loyalty-card' ? 'ประวัติการเช็คอิน (Check-in History)' : 'ประวัติการสุ่ม (Roll History)'}
                        </span>
                        {rollHistory.length > 0 && (
                          <span className="tab-badge">{rollHistory.length}</span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* TAB 1: WORKSPACE / BLACKLIST CONTENT */}
                  {(!hasRollHistory || activeTab === 'workspace') && (
                    <>
                      {/* DBD Perks Searchable Blacklist / Exclude Section */}
                      {selectedWidget === 'dbd-perks' && (() => {
                        const currentRole = fieldData.role || 'survivor';
                        const rolePerks = dbdPerksList[currentRole] || [];
                        const excludedList = Array.isArray(fieldData.excludedPerks) ? fieldData.excludedPerks : [];
                        const query = (dbdSearchQuery || '').trim().toLowerCase();

                        const filteredPerks = rolePerks.filter(p => {
                          if (!query) return true;
                          return (p.name && p.name.toLowerCase().includes(query)) ||
                            (p.character && p.character.toLowerCase().includes(query));
                        });

                        const excludedCount = rolePerks.filter(p => excludedList.includes(p.id) || excludedList.includes(p.name)).length;
                        const activeCount = rolePerks.length - excludedCount;

                        const handleTogglePerk = (pId) => {
                          let next;
                          if (excludedList.includes(pId)) {
                            next = excludedList.filter(id => id !== pId);
                          } else {
                            next = [...excludedList, pId];
                          }
                          handleFieldChange('excludedPerks', next);
                        };

                        const handleExcludeAllSearch = () => {
                          const toAdd = filteredPerks.map(p => p.id).filter(id => !excludedList.includes(id));
                          if (toAdd.length > 0) {
                            handleFieldChange('excludedPerks', [...excludedList, ...toAdd]);
                          }
                        };

                        const handleResetRoleExclusions = () => {
                          const roleIds = new Set(rolePerks.map(p => p.id));
                          const next = excludedList.filter(id => !roleIds.has(id));
                          handleFieldChange('excludedPerks', next);
                        };

                        return (
                          <div className="dbd-blacklist-box">
                            <div className="dbd-blacklist-header">
                              <div>
                                <div className="dbd-blacklist-title">
                                  <Ban size={18} style={{ color: '#FF453A' }} />
                                  <span>เลือกเปิร์คที่ไม่ต้องการ / ยังไม่มี (Blacklist)</span>
                                </div>
                                <div className="dbd-blacklist-desc">
                                  ค้นหาเปิร์คหรือตัวละคร แล้วคลิกเพื่อติ๊ก <strong>"ตัดออก"</strong> จากการสุ่ม ระบบจะบันทึกและซิงค์ไปยัง OBS ทันที
                                </div>
                              </div>

                              {/* Role Switcher & Sync Button Row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                                {/* Role Switcher Pills */}
                                <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.05)', padding: '3px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleFieldChange('role', 'survivor')}
                                    style={{
                                      border: 'none',
                                      padding: '6px 14px',
                                      fontSize: '0.8rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      background: currentRole === 'survivor' ? 'var(--accent-color)' : 'transparent',
                                      color: currentRole === 'survivor' ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    ผู้รอดชีวิต ({dbdPerksList.survivor?.length || 179})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleFieldChange('role', 'killer')}
                                    style={{
                                      border: 'none',
                                      padding: '6px 14px',
                                      fontSize: '0.8rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      background: currentRole === 'killer' ? '#FF453A' : 'transparent',
                                      color: currentRole === 'killer' ? '#FFFFFF' : 'var(--text-secondary)',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    ฆาตกร ({dbdPerksList.killer?.length || 151})
                                  </button>
                                </div>

                                {/* Admin Management Shortcut */}
                                {status.isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => navigate('/admin?tab=dbd_perks')}
                                    className="btn-preview-action"
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '0.8rem',
                                      borderColor: 'var(--border-secondary)',
                                      color: '#FFFFFF'
                                    }}
                                    title="ไปที่หน้า Admin เพื่อเพิ่ม, ลบ หรือซิงค์เปิร์ค DBD"
                                  >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                      <ShieldCheck size={13} /> จัดการเปิร์ค (Admin)
                                    </span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Search Bar */}
                            <div className="dbd-search-bar">
                              <Search size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
                              <input
                                type="text"
                                className="dbd-search-input"
                                placeholder={`ค้นหาชื่อเปิร์ค หรือชื่อตัวละคร (เช่น Sprint Burst, Meg Thomas)...`}
                                value={dbdSearchQuery}
                                onChange={(e) => setDbdSearchQuery(e.target.value)}
                              />
                              {dbdSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setDbdSearchQuery('')}
                                  style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                >
                                  <X size={15} />
                                </button>
                              )}
                            </div>

                            {/* Status & Quick Actions */}
                            <div className="dbd-stats-row">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span className="dbd-stat-badge" style={{ background: 'rgba(48, 209, 88, 0.12)', color: '#30D158', border: '1px solid rgba(48, 209, 88, 0.25)' }}>
                                  <Check size={12} /> สุ่มได้: <strong>{activeCount}</strong> เปิร์ค
                                </span>
                                {excludedCount > 0 && (
                                  <span className="dbd-stat-badge" style={{ background: 'rgba(255, 69, 58, 0.12)', color: '#FF453A', border: '1px solid rgba(255, 69, 58, 0.25)' }}>
                                    <Ban size={12} /> ตัดออก: <strong>{excludedCount}</strong> เปิร์ค
                                  </span>
                                )}
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  (แสดง {filteredPerks.length} จาก {rolePerks.length} เปิร์ค)
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {dbdSearchQuery && filteredPerks.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={handleExcludeAllSearch}
                                    className="btn-preview-action"
                                    style={{ fontSize: '0.75rem', color: 'var(--text-primary)', borderColor: 'var(--border-secondary)' }}
                                    title="ตัดเปิร์คทั้งหมดในผลการค้นหานี้ออกจากการสุ่ม"
                                  >
                                    <Ban size={12} /> ตัดออกทั้งหมดในคำค้นหานี้ ({filteredPerks.length})
                                  </button>
                                )}
                                {excludedCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={handleResetRoleExclusions}
                                    className="btn-preview-action"
                                    style={{ fontSize: '0.75rem' }}
                                    title="รีเซ็ตให้สุ่มได้ทุกเปิร์คของบทบาทนี้"
                                  >
                                    <RotateCw size={12} /> รีเซ็ต (เปิดสุ่มทุกเปิร์ค)
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Perks Scrollable Grid */}
                            {filteredPerks.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                                <Search size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                                <p style={{ margin: 0, fontSize: '0.85rem' }}>ไม่พบเปิร์คที่ตรงกับ "{dbdSearchQuery}"</p>
                              </div>
                            ) : (
                              <div className="dbd-perk-grid">
                                {filteredPerks.map((perk) => {
                                  const isExcluded = excludedList.includes(perk.id) || excludedList.includes(perk.name);
                                  return (
                                    <div
                                      key={perk.id}
                                      className={`dbd-perk-card ${isExcluded ? 'excluded' : ''}`}
                                      onClick={() => handleTogglePerk(perk.id)}
                                      title={perk.description ? `${perk.name}\n${perk.description}` : perk.name}
                                    >
                                      <div className="dbd-check-indicator">
                                        {isExcluded ? <Ban size={12} /> : null}
                                      </div>

                                      <div className="dbd-perk-icon-wrapper">
                                        <div className="dbd-perk-diamond-bg" />
                                        <img
                                          src={perk.icon}
                                          alt={perk.name}
                                          className="dbd-perk-img"
                                          loading="lazy"
                                          onError={(e) => { e.target.style.opacity = '0.3'; }}
                                        />
                                      </div>

                                      <div className="dbd-perk-info">
                                        <div className="dbd-perk-name">{perk.name}</div>
                                        <div className="dbd-perk-char">
                                          {perk.character || 'เปิร์คทั่วไป (General)'}
                                        </div>
                                      </div>

                                      {isExcluded && (
                                        <span style={{
                                          fontSize: '0.68rem',
                                          color: '#FF453A',
                                          fontWeight: 600,
                                          background: 'rgba(255, 69, 58, 0.12)',
                                          border: '1px solid rgba(255, 69, 58, 0.25)',
                                          padding: '2px 6px',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          ตัดออก
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Random Killer Searchable Blacklist / Exclude Section */}
                      {selectedWidget === 'random-killer' && (() => {
                        const excludedList = Array.isArray(fieldData.excludedKillers) ? fieldData.excludedKillers : [];
                        const query = (killerSearchQuery || '').trim().toLowerCase();

                        const filteredKillers = killersList.filter(k => {
                          if (!query) return true;
                          return (k.name && k.name.toLowerCase().includes(query)) ||
                            (k.id && k.id.toLowerCase().includes(query));
                        });

                        const excludedCount = killersList.filter(k => excludedList.includes(k.id) || excludedList.includes(k.name)).length;
                        const activeCount = Math.max(0, killersList.length - excludedCount);

                        const handleToggleKiller = (killer) => {
                          let next;
                          if (excludedList.includes(killer.name) || excludedList.includes(killer.id)) {
                            next = excludedList.filter(id => id !== killer.name && id !== killer.id);
                          } else {
                            next = [...excludedList, killer.name];
                          }
                          handleFieldChange('excludedKillers', next);
                        };

                        const handleExcludeAllSearch = () => {
                          const toAdd = filteredKillers
                            .map(k => k.name)
                            .filter(name => !excludedList.includes(name));
                          if (toAdd.length > 0) {
                            handleFieldChange('excludedKillers', [...excludedList, ...toAdd]);
                          }
                        };

                        const handleResetExclusions = () => {
                          handleFieldChange('excludedKillers', []);
                        };

                        return (
                          <div className="dbd-blacklist-box">
                            <div className="dbd-blacklist-header">
                              <div>
                                <div className="dbd-blacklist-title">
                                  <Ban size={18} style={{ color: '#FF453A' }} />
                                  <span>เลือกคิลเลอร์ที่ไม่ต้องการให้สุ่ม (Blacklist & Exclude)</span>
                                </div>
                                <div className="dbd-blacklist-desc">
                                  ค้นหาชื่อคิลเลอร์ แล้วคลิกเพื่อติ๊ก <strong>"ตัดออก"</strong> จากการสุ่ม ระบบจะบันทึกและซิงค์ไปยัง OBS ทันที (คิลเลอร์ที่ถูกตัดออกจะไม่ถูกสุ่มได้)
                                </div>
                              </div>
                            </div>

                            {/* Search Bar */}
                            <div className="dbd-search-bar">
                              <Search size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
                              <input
                                type="text"
                                className="dbd-search-input"
                                placeholder="ค้นหาชื่อคิลเลอร์ (เช่น The Nurse, The Trapper, Blight, Chucky)..."
                                value={killerSearchQuery}
                                onChange={(e) => setKillerSearchQuery(e.target.value)}
                              />
                              {killerSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setKillerSearchQuery('')}
                                  style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                >
                                  <X size={15} />
                                </button>
                              )}
                            </div>

                            {/* Status & Quick Actions */}
                            <div className="dbd-stats-row">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span className="dbd-stat-badge" style={{ background: 'rgba(48, 209, 88, 0.12)', color: '#30D158', border: '1px solid rgba(48, 209, 88, 0.25)' }}>
                                  <Check size={12} /> สุ่มได้: <strong>{activeCount}</strong> คิลเลอร์
                                </span>
                                {excludedCount > 0 && (
                                  <span className="dbd-stat-badge" style={{ background: 'rgba(255, 69, 58, 0.12)', color: '#FF453A', border: '1px solid rgba(255, 69, 58, 0.25)' }}>
                                    <Ban size={12} /> ตัดออก: <strong>{excludedCount}</strong> คิลเลอร์
                                  </span>
                                )}
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  (แสดง {filteredKillers.length} จาก {killersList.length} คิลเลอร์)
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {killerSearchQuery && filteredKillers.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={handleExcludeAllSearch}
                                    className="btn-preview-action"
                                    style={{ fontSize: '0.75rem', color: '#FFFFFF', borderColor: 'var(--border-secondary)' }}
                                    title="ตัดคิลเลอร์ทั้งหมดในผลการค้นหานี้ออกจากการสุ่ม"
                                  >
                                    <Ban size={12} /> ตัดออกทั้งหมดในคำค้นหานี้ ({filteredKillers.length})
                                  </button>
                                )}
                                {excludedCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={handleResetExclusions}
                                    className="btn-preview-action"
                                    style={{ fontSize: '0.75rem' }}
                                    title="รีเซ็ตให้สุ่มได้ทุกคิลเลอร์"
                                  >
                                    <RotateCw size={12} /> รีเซ็ต (เปิดสุ่มทุกตัว)
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Killers Scrollable Grid */}
                            {filteredKillers.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                                <Search size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                                <p style={{ margin: 0, fontSize: '0.85rem' }}>ไม่พบคิลเลอร์ที่ตรงกับ "{killerSearchQuery}"</p>
                              </div>
                            ) : (
                              <div className="killer-blacklist-grid">
                                {filteredKillers.map((killer) => {
                                  const isExcluded = excludedList.includes(killer.name) || excludedList.includes(killer.id);
                                  return (
                                    <div
                                      key={killer.id || killer.name}
                                      className={`killer-card ${isExcluded ? 'excluded' : ''}`}
                                      onClick={() => handleToggleKiller(killer)}
                                      title={killer.name}
                                    >
                                      <div className="dbd-check-indicator">
                                        {isExcluded ? <Ban size={12} /> : null}
                                      </div>

                                      <div className="killer-portrait-wrapper">
                                        <img
                                          src={killer.img}
                                          alt={killer.name}
                                          className="killer-portrait-img"
                                          loading="lazy"
                                          onError={(e) => { e.target.style.opacity = '0.3'; }}
                                        />
                                      </div>

                                      <div className="killer-card-info">
                                        <div className="killer-card-name">{killer.name}</div>
                                        <div className="killer-card-sub">Dead by Daylight Killer</div>
                                      </div>

                                      {isExcluded && (
                                        <span style={{
                                          fontSize: '0.68rem',
                                          color: '#FF453A',
                                          fontWeight: 600,
                                          background: 'rgba(255, 69, 58, 0.12)',
                                          border: '1px solid rgba(255, 69, 58, 0.25)',
                                          padding: '2px 6px',
                                          whiteSpace: 'nowrap'
                                        }}>
                                          ตัดออก
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Loyalty Card Leaderboard Summary */}
                      {selectedWidget === 'loyalty-card' && (
                        <div style={{
                          marginBottom: '1.25rem',
                          padding: '1.25rem',
                          background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
                          border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))',
                          borderRadius: 'var(--radius-md)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Award size={18} style={{ color: '#FF9F0A' }} />
                              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                กระดานผู้นำการเช็คอินสะสม (Loyalty Leaderboard)
                              </h4>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              เรียงตามจำนวนครั้งที่เช็คอินมากที่สุด ({loyaltyUserSummary.length} ผู้ใช้)
                            </span>
                          </div>

                          {loyaltyUserSummary.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
                              <Ticket size={36} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                              <p style={{ margin: 0, fontSize: '0.85rem' }}>ยังไม่มีข้อมูลการเช็คอินสะสม เมื่อผู้ชมแลกแต้ม ระบบจะจัดอันดับผู้ที่เช็คอินมากที่สุดที่นี่</p>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                              {loyaltyUserSummary.map((u, idx) => (
                                <div
                                  key={u.username}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.65rem',
                                    padding: '0.65rem 0.85rem',
                                    background: 'var(--surface-1)',
                                    border: idx === 0 ? '1px solid rgba(255, 159, 10, 0.35)' : '1px solid var(--border-secondary)',
                                    borderRadius: 'var(--radius-sm)',
                                    position: 'relative'
                                  }}
                                >
                                  {idx === 0 && (
                                    <span style={{ position: 'absolute', top: '-7px', right: '8px', fontSize: '0.62rem', fontWeight: 800, background: '#FF9F0A', color: '#000', padding: '1px 5px', borderRadius: 'var(--radius-xs)' }}>
                                      #1 TOP
                                    </span>
                                  )}
                                  <img
                                    src={u.avatar || `/api/twitch/avatar/${encodeURIComponent(u.username)}`}
                                    alt={u.username}
                                    style={{
                                      width: '38px',
                                      height: '38px',
                                      objectFit: 'cover',
                                      border: '1px solid var(--border-secondary)',
                                      borderRadius: 'var(--radius-xs)',
                                      flexShrink: 0
                                    }}
                                    onError={(e) => {
                                      e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                                    }}
                                  />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      fontSize: '0.85rem',
                                      fontWeight: 700,
                                      color: 'var(--text-primary)',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      @{u.username}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                      เช็คอิน: <strong style={{ color: 'var(--text-primary)' }}>{u.count}</strong> ครั้ง
                                    </div>
                                  </div>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: 'rgba(255, 159, 10, 0.12)',
                                    color: '#FF9F0A',
                                    padding: '3px 8px',
                                    border: '1px solid rgba(255, 159, 10, 0.25)',
                                    borderRadius: 'var(--radius-xs)',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    {u.count} <Ticket size={12} />
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* TAB 2: ROLL HISTORY LOG */}
                  {hasRollHistory && activeTab === 'history' && (
                    <div className="roll-history-container">
                      <div className="roll-history-header">
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            {selectedWidget === 'loyalty-card' ? <CalendarCheck size={18} style={{ color: '#FFFFFF' }} /> : <History size={18} style={{ color: '#FFFFFF' }} />}
                            {selectedWidget === 'loyalty-card' ? 'ประวัติการเช็คอินสะสมแต้ม' : 'ประวัติการแลกและการสุ่มผลลัพธ์'}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {selectedWidget === 'loyalty-card'
                              ? `บันทึกการเช็คอินแบบเรียลไทม์ (ทั้งหมด ${rollHistory.length} รายการ)`
                              : `บันทึกผลลัพธ์แบบเรียลไทม์ (ทั้งหมด ${rollHistory.length} รายการ)`}
                          </span>
                        </div>

                        {rollHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearHistory}
                            className="btn-preview-action"
                            style={{ color: '#FFFFFF', borderColor: 'var(--border-secondary)' }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Trash2 size={13} /> ล้างประวัติทั้งหมด
                            </span>
                          </button>
                        )}
                      </div>

                      {/* สรุปยอดเช็คอินสะสมของผู้ใช้แต่ละคน (Leaderboard / Summary Cards) สำหรับ Loyalty Card */}
                      {selectedWidget === 'loyalty-card' && loyaltyUserSummary.length > 0 && (
                        <div style={{
                          marginBottom: '1.25rem',
                          padding: '1rem',
                          background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
                          border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <Users size={16} style={{ color: '#FFFFFF' }} /> ยอดเช็คอินสะสมรวม ({loyaltyUserSummary.length} คน)
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              เรียงตามจำนวนครั้งที่เช็คอินมากที่สุด
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.75rem' }}>
                            {loyaltyUserSummary.map((u) => (
                              <div
                                key={u.username}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.65rem',
                                  padding: '0.6rem 0.75rem',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}
                              >
                                <img
                                  src={u.avatar || `/api/twitch/avatar/${encodeURIComponent(u.username)}`}
                                  alt={u.username}
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    objectFit: 'cover',
                                    border: '1px solid var(--border-secondary)',
                                    flexShrink: 0
                                  }}
                                  onError={(e) => {
                                    e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                                  }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    @{u.username}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    เช็คอินไปแล้ว: <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{u.count}</strong> ครั้ง
                                  </div>
                                </div>
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: 'rgba(255, 159, 10, 0.12)',
                                  color: '#FF9F0A',
                                  padding: '3px 8px',
                                  border: '1px solid rgba(255, 159, 10, 0.25)',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  {u.count} <Ticket size={12} />
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rollHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem', opacity: 0.35 }}>
                            {selectedWidget === 'loyalty-card' ? <Ticket size={44} /> : <Dices size={44} />}
                          </div>
                          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                            {selectedWidget === 'loyalty-card' ? 'ยังไม่มีประวัติการเช็คอิน' : 'ยังไม่มีประวัติการสุ่ม'}
                          </h4>
                          <p style={{ fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
                            {selectedWidget === 'loyalty-card'
                              ? 'เมื่อมีผู้ชมแลกแต้มในช่อง Twitch หรือคุณกดปุ่ม "จำลองการแลกแต้ม" รายชื่อและจำนวนครั้งที่เช็คอินจะถูกบันทึกและแสดงที่นี่แบบเรียลไทม์ทันที'
                              : 'เมื่อมีผู้ชมแลกแต้มในช่อง Twitch หรือคุณกดปุ่ม "จำลองการแลกแต้ม" รายชื่อและผลลัพธ์ที่สุ่มได้จะถูกบันทึกและแสดงที่นี่แบบเรียลไทม์ทันที'}
                          </p>
                        </div>
                      ) : (
                        <div className="roll-history-list">
                          {rollHistory.map((item) => {
                            const isLoyalty = selectedWidget === 'loyalty-card' || item.count !== undefined;
                            const isDbd = selectedWidget === 'dbd-perks' || Array.isArray(item.perks);

                            if (isDbd && Array.isArray(item.perks) && item.perks.length > 0) {
                              return (
                                <div key={item.id} className="roll-history-card" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                      <img
                                        src={item.avatar || `/api/twitch/avatar/${encodeURIComponent(item.username || '')}`}
                                        alt={item.username || 'User'}
                                        style={{ width: '38px', height: '38px', objectFit: 'cover', border: '1px solid var(--border-secondary)' }}
                                        onError={(e) => {
                                          e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                                        }}
                                      />
                                      <div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                          @{item.username || 'Streamer'}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px' }}>
                                          <span style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            padding: '2px 7px',
                                            background: item.role === 'killer' ? 'rgba(255, 69, 58, 0.12)' : 'rgba(41, 151, 255, 0.12)',
                                            color: item.role === 'killer' ? '#FF453A' : '#2997FF',
                                            border: item.role === 'killer' ? '1px solid rgba(255, 69, 58, 0.25)' : '1px solid rgba(41, 151, 255, 0.25)'
                                          }}>
                                            {item.role === 'killer' ? 'ฆาตกร (Killer)' : 'ผู้รอดชีวิต (Survivor)'}
                                          </span>
                                          {item.rewardTitle && (
                                            <span className="roll-info-reward" style={{ fontSize: '0.72rem' }}>
                                              <Gift size={11} /> {item.rewardTitle}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="roll-time" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <Clock size={13} style={{ color: 'var(--text-secondary)' }} /> {formatTime(item.timestamp)}
                                    </div>
                                  </div>

                                  <div className="roll-dbd-perks" style={{ width: '100%' }}>
                                    {item.perks.map((p, idx) => (
                                      <div key={idx} className="roll-dbd-perk-item" title={p.description || p.name}>
                                        <img src={p.icon} alt={p.name} className="roll-dbd-perk-thumb" />
                                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                                        {p.character && (
                                          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.85 }}>({p.character})</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={item.id} className="roll-history-card">
                                <div className="roll-card-left">
                                  {isLoyalty ? (
                                    <img
                                      src={item.avatar || `/api/twitch/avatar/${encodeURIComponent(item.username || '')}`}
                                      alt={item.username || 'User'}
                                      className="roll-killer-thumb"
                                      style={{ objectFit: 'cover', border: '1px solid var(--border-secondary)' }}
                                      onError={(e) => {
                                        e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                                      }}
                                    />
                                  ) : item.killerImg ? (
                                    <img
                                      src={item.killerImg}
                                      alt={item.killer || 'Killer'}
                                      className="roll-killer-thumb"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="roll-killer-placeholder">
                                      <Skull size={20} style={{ opacity: 0.6 }} />
                                    </div>
                                  )}
                                  <div>
                                    <div className="roll-info-name">
                                      {isLoyalty ? (
                                        item.result || `เช็คอินครั้งที่ ${item.count || 1}`
                                      ) : (
                                        item.killer || item.result || 'ไม่ทราบผลลัพธ์'
                                      )}
                                    </div>
                                    <div className="roll-info-meta">
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <User size={13} style={{ color: 'var(--text-secondary)' }} />
                                        ผู้แลก: <strong className="roll-info-user">@{item.username || 'นิรนาม'}</strong>
                                      </span>
                                      {isLoyalty && item.count !== undefined && (
                                        <span className="roll-info-reward" style={{ background: 'var(--surface-3)', color: 'var(--text-primary)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                          <Award size={13} /> เช็คอินไปแล้ว {item.count} ครั้ง
                                        </span>
                                      )}
                                      {item.rewardTitle && (
                                        <span className="roll-info-reward" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                          <Gift size={13} /> {item.rewardTitle}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="roll-time" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={13} style={{ color: 'var(--text-secondary)' }} /> {formatTime(item.timestamp)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="doppel-shell animate-fade-up" style={{ animationDelay: '150ms' }}>
            <div className="doppel-core" style={{ padding: 0, overflow: 'hidden', position: 'relative', minHeight: '560px', display: 'flex', alignItems: 'stretch' }}>
              {/* Gradient BG Layer */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, rgba(43,112,247,0.12) 0%, transparent 50%, rgba(139,92,246,0.08) 100%)',
                pointerEvents: 'none'
              }} />
              {/* Grid pattern overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'radial-gradient(circle, rgba(43,112,247,0.06) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
                pointerEvents: 'none'
              }} />

              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2.5rem', width: '100%', gap: '0' }}>

                {/* Icon badge */}
                <div style={{
                  width: '72px', height: '72px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, var(--accent-color), #7C3AED)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '1.75rem',
                  boxShadow: '0 8px 32px rgba(43,112,247,0.35), 0 0 0 1px rgba(43,112,247,0.2)'
                }}>
                  <Zap size={34} color="#FFFFFF" />
                </div>

                {/* Headline */}
                <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--accent-color)', textTransform: 'uppercase', marginBottom: '0.85rem', opacity: 0.9 }}>
                  FastChick Overlay Studio
                </div>
                <h2 style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: '1rem', maxWidth: '500px' }}>
                  เริ่มต้นสตรีมที่
                  {' '}<span style={{ background: 'linear-gradient(135deg, #2B70F7, #7C3AED)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ระดับโปร</span>
                </h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', lineHeight: 1.7, marginBottom: '2.25rem', fontSize: '0.95rem' }}>
                  เชื่อมต่อบัญชี Twitch เพื่อปลดล็อก widget แบบเรียลไทม์ ควบคุม OBS ผ่านเบราว์เซอร์ และติดตาม channel events ทันที
                </p>

                {/* Single CTA Button */}
                <a
                  href={`${API_BASE}/auth/twitch`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.75rem',
                    background: 'linear-gradient(135deg, #9146FF, #6441A5)',
                    color: '#FFFFFF', fontWeight: 700, fontSize: '1rem',
                    padding: '0.9rem 2rem', borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none', border: 'none',
                    boxShadow: '0 4px 20px rgba(145,70,255,0.4)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(145,70,255,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(145,70,255,0.4)'; }}
                >
                  {/* Twitch logo SVG */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
                  </svg>
                  <span>เข้าสู่ระบบด้วย Twitch</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </a>

                {/* Feature pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginTop: '2.5rem', justifyContent: 'center' }}>
                  {[
                    { icon: <Zap size={13} />, label: 'Real-Time OBS Sync' },
                    { icon: <Sliders size={13} />, label: 'Widget Customization' },
                    { icon: <Users size={13} />, label: 'Twitch EventSub' },
                  ].map(({ icon, label }) => (
                    <div key={label} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.35rem 0.85rem', borderRadius: '999px',
                      background: 'var(--accent-surface)', border: '1px solid rgba(43,112,247,0.2)',
                      fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-color)'
                    }}>
                      {icon} {label}
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Live Preview Modal */}
      {showFullscreenPreview && selectedWidget && (
        <div className="modal-overlay" onClick={() => setShowFullscreenPreview(false)}>
          <div className="modal-card fullscreen-preview-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Eye size={18} /> Live Preview: {widgets.find(w => w.id === selectedWidget)?.name}
                </h3>
                <span className="live-preview-badge">Real-Time Sync</span>
              </div>

              {/* Background Theme Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setBgMode('checker')}
                  className={`btn-preview-action ${bgMode === 'checker' ? 'accent' : ''}`}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Grid size={13} /> โปร่งใส
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setBgMode('dark-solid')}
                  className={`btn-preview-action ${bgMode === 'dark-solid' ? 'accent' : ''}`}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Square size={13} style={{ fill: '#000' }} /> พื้นหลังสีดำ
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setBgMode('green-screen')}
                  className={`btn-preview-action ${bgMode === 'green-screen' ? 'accent' : ''}`}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Square size={13} style={{ color: "#FFFFFF", fill: "#FFFFFF" }} /> กรีนสกรีน
                  </span>
                </button>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleTriggerPreview}
                  className="btn-preview-action accent"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Play size={13} /> ทดสอบสุ่ม (Trigger)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleReloadPreview}
                  className="btn-preview-action"
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RotateCw size={13} /> รีเฟรช
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullscreenPreview(false)}
                  className="btn-island"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', background: 'var(--surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border-secondary)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <X size={14} /> ปิด
                  </span>
                </button>
              </div>
            </div>

            <div className={`live-preview-canvas ${bgMode}`} style={{ flex: 1, minHeight: 0, height: '100%' }}>
              <iframe
                key={`fs-${previewKey}`}
                src={previewUrl}
                className="live-preview-iframe"
                title="Fullscreen Widget Live Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
