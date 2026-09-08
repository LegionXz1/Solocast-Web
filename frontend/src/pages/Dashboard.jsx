import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
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
  LogOut
} from 'lucide-react';

const socket = io('http://localhost:3000');

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
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'history'
  const [rollHistory, setRollHistory] = useState([]);

  // Live Preview State
  const [previewKey, setPreviewKey] = useState(0);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [bgMode, setBgMode] = useState('checker'); // 'checker' | 'dark-solid' | 'green-screen'
  const [shoutoutChannel, setShoutoutChannel] = useState('legionxiz');
  const hasRollHistory = selectedWidget && selectedWidget !== 'twitch-shoutout';

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

    fetch('http://localhost:3000/api/auth/me', {
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
    fetch('http://localhost:3000/api/widgets')
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
      fetch(`http://localhost:3000/api/widgets/${selectedWidget}/schema`).then(res => res.ok ? res.json() : null),
      fetch(`http://localhost:3000/api/widgets/${selectedWidget}/settings?user=${status.userId || ''}`).then(res => res.ok ? res.json() : null)
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

  // 5. โหลดประวัติการสุ่ม (Roll History) ของ Widget นี้
  useEffect(() => {
    if (!selectedWidget || selectedWidget === 'twitch-shoutout') {
      setRollHistory([]);
      return;
    }
    fetch(`http://localhost:3000/api/widgets/${selectedWidget}/history?user=${encodeURIComponent(status.userId || '')}`)
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

    socket.on('onEventReceived', handleEvent);
    socket.on('widget_roll_history_item', handleNewRoll);
    socket.on('widget_roll_history_cleared', handleClearedHistory);

    return () => {
      socket.off('onEventReceived', handleEvent);
      socket.off('widget_roll_history_item', handleNewRoll);
      socket.off('widget_roll_history_cleared', handleClearedHistory);
    };
  }, [selectedWidget]);

  // ฟังก์ชันบันทึกการตั้งค่าลง Backend พร้อมส่ง Signal ไปยัง OBS แบบ Real-time
  const handleSaveSettings = async (dataToSave = fieldData) => {
    if (!selectedWidget) return;
    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:3000/api/widgets/${selectedWidget}/settings`, {
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
        await fetch('http://localhost:3000/api/auth/logout', {
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
    } else {
      handleSimulateRedemption();
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('คุณต้องการล้างประวัติการสุ่มทั้งหมดใช่หรือไม่?')) return;
    try {
      await fetch(`http://localhost:3000/api/widgets/${selectedWidget}/history?user=${encodeURIComponent(status.userId || '')}`, {
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
    widgetUrl = `http://localhost:3000/widgets/${selectedWidget}/index.html?${params.toString()}`;
    previewUrl = `http://localhost:3000/widgets/${selectedWidget}/index.html?user=${encodeURIComponent(status.userId || '')}&preview=1&_k=${previewKey}`;
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

    return Object.keys(groups).map(groupName => (
      <div key={groupName} style={{ marginBottom: '1.75rem', padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1.15rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.15rem' }}>
          <span style={{ width: '4px', height: '14px', background: 'var(--accent-color)', borderRadius: '2px', display: 'inline-block' }}></span>
          <h4 style={{ margin: 0, fontSize: '0.85rem', letterSpacing: '0.08em', color: '#C084FC' }}>{groupName}</h4>
        </div>
        {groups[groupName].map(field => (
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
                <span style={{ fontFamily: 'Consolas, monospace', fontSize: '0.85rem', color: '#E2E8F0', background: 'rgba(0,0,0,0.4)', padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
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
                <span style={{ fontFamily: 'Consolas, monospace', fontSize: '0.85rem', fontWeight: 600, color: '#A78BFA', minWidth: '40px', textAlign: 'right', background: 'rgba(139, 92, 246, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                  {fieldData[field.key] !== undefined ? fieldData[field.key] : 0}
                </span>
              </div>
            )}
            {field.type === 'checkbox' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer', marginTop: '0.35rem', userSelect: 'none' }}>
                <div style={{
                  width: '40px',
                  height: '22px',
                  borderRadius: '11px',
                  background: (fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? 'var(--accent-color)' : 'rgba(255,255,255,0.15)',
                  position: 'relative',
                  transition: 'all 200ms ease',
                  boxShadow: (fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? '0 0 10px var(--accent-glow)' : 'none'
                }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: (fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? '21px' : '3px',
                    transition: 'all 200ms cubic-bezier(0.32, 0.72, 0, 1)'
                  }} />
                </div>
                <input
                  type="checkbox"
                  style={{ display: 'none' }}
                  checked={fieldData[field.key] !== undefined ? Boolean(fieldData[field.key]) : Boolean(field.value)}
                  onChange={e => handleFieldChange(field.key, e.target.checked)}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: (fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? '#FFFFFF' : 'var(--text-secondary)' }}>
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
    ));
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header animate-fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="floating-nav" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          SoloCast Powered by LegionX
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {status.isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="btn-island"
              style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)', padding: '0.6rem 1.25rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <ShieldCheck size={16} /> ผู้ดูแลระบบ (Admin)
              </span>
            </button>
          )}
          {status.connected && (
            <button
              onClick={handleLogout}
              className="btn-island"
              style={{ background: 'var(--bg-color)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.6rem 1rem' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <LogOut size={15} /> ออกจากระบบ
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="bento-grid">
        {/* Left Column: Status & Logs */}
        <div className="doppel-shell animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="doppel-core">
            <span className="eyebrow">การเชื่อมต่อ</span>
            <h2>สถานะ Twitch</h2>

            <div className="status-badge">
              <div className={`status-dot ${status.connected ? 'connected' : ''}`}></div>
              <div className="status-text">
                {status.connected ? `กำลังดักจับข้อมูลช่อง @${status.username}` : 'ไม่ได้เชื่อมต่อ'}
              </div>
            </div>

            {!status.connected ? (
              <a href="http://localhost:3000/auth/twitch" className="btn-island accent">
                <span>เข้าสู่ระบบด้วย Twitch</span>
                <div className="btn-icon-wrapper">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </div>
              </a>
            ) : (
              <div style={{ marginTop: '2rem' }}>
                <span className="eyebrow">ระบบจำลอง</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button onClick={handleSimulate} className="btn-island" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)' }}>
                    <span>จำลองคนกดติดตาม (Follow)</span>
                  </button>
                  <button onClick={handleSimulateRedemption} className="btn-island accent">
                    <span>จำลองการแลกแต้ม (Redemption)</span>
                    <div className="btn-icon-wrapper">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </div>
                  </button>
                </div>

                <div style={{ marginTop: '2rem' }}>
                  <span className="eyebrow">ประวัติล่าสุด (Live Logs)</span>
                  <div className="event-log">
                    {events.map((ev, idx) => (
                      <div key={idx} className="event-card" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {ev.type === 'follower' ? (
                          <>
                            <UserCheck size={14} style={{ color: '#10B981', flexShrink: 0 }} />
                            <span><strong>{ev.data.name}</strong> กดติดตาม!</span>
                          </>
                        ) : ev.type === 'redemption' ? (
                          <>
                            <Gift size={14} style={{ color: '#8e90f6', flexShrink: 0 }} />
                            <span><strong>{ev.data.name}</strong> แลกรางวัล: {ev.data.rewardTitle}</span>
                          </>
                        ) : (
                          <>
                            <Star size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
                            <span><strong>{ev.data.name}</strong> กดซับสไครบ์!</span>
                          </>
                        )}
                      </div>
                    ))}
                    {events.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>รอรับข้อมูล...</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Configurator & Roll History */}
        {status.connected ? (
          <div className="doppel-shell animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div className="doppel-core">
              <span className="eyebrow">แผงควบคุมอัจฉริยะ</span>
              <h2>ปรับแต่ง Widget</h2>

              <div className="widget-grid">
                {widgets.map(w => (
                  <div
                    key={w.id}
                    className={`widget-card ${selectedWidget === w.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedWidget(w.id);
                      setActiveTab('settings');
                    }}
                  >
                    <h4>{w.name}</h4>
                    <p>ID: {w.id}</p>
                  </div>
                ))}
              </div>

              {selectedWidget && (
                <div className="animate-fade-up">
                  <hr className="divider" />
                  
                  {/* Top Bar: Title & Save */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                      {widgets.find(w => w.id === selectedWidget)?.name}
                    </h3>
                    {(activeTab === 'settings' || !hasRollHistory) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {saveSuccess && (
                          <span style={{ color: '#10B981', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Check size={14} /> {saveSuccess}
                          </span>
                        )}
                        <button
                          onClick={() => handleSaveSettings(fieldData)}
                          className="btn-island accent"
                          style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem' }}
                          disabled={isSaving}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            {isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tab Navigation: Settings vs Roll History */}
                  {hasRollHistory && (
                    <div className="widget-tab-nav">
                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className={`widget-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Sliders size={16} /> ตั้งค่า Widget (Settings)
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

                  {/* TAB 1: SETTINGS & LIVE PREVIEW */}
                  {(!hasRollHistory || activeTab === 'settings') && (
                    <>
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
                                    borderRadius: '6px',
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

                      {/* Schema Settings Form */}
                      <div className="schema-container">
                        {renderSchemaForm()}
                      </div>

                      {/* OBS URL Box (Static & Auto-Syncing) */}
                      <div className="url-box" style={{
                        marginTop: '1.5rem',
                        padding: '1.25rem',
                        background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
                        borderRadius: '12px',
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
                              borderRadius: '10px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10B981',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
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
                              background: copiedUrl ? '#10B981' : 'var(--accent-color, #8e90f6)',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
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
                              borderRadius: '8px',
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
                          borderRadius: '8px'
                        }}>
                          <Info size={16} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
                          <span>
                            <strong>ใส่เพียงครั้งเดียวจบ:</strong> ลิงก์นี้จะคงที่ถาวร เมื่อคุณเปลี่ยนสี, ปรับฟอนต์, สลับไอคอน หรือแก้ไขข้อความใดๆ ในหน้านี้ ระบบจะบันทึกและส่งข้อมูลไปอัปเดตหน้าจอ OBS แบบ <strong>Real-time ทันที</strong> โดยไม่ต้องคัดลอกลิงก์ใหม่ และไม่ต้องกด Refresh ใน OBS ครับ
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* TAB 2: ROLL HISTORY LOG */}
                  {hasRollHistory && activeTab === 'history' && (
                    <div className="roll-history-container">
                      <div className="roll-history-header">
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            {selectedWidget === 'loyalty-card' ? <CalendarCheck size={18} style={{ color: '#8e90f6' }} /> : <History size={18} style={{ color: '#8e90f6' }} />}
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
                            style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
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
                          borderRadius: '12px',
                          border: '1px solid var(--shell-border, rgba(255, 255, 255, 0.08))'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <Users size={16} style={{ color: '#8e90f6' }} /> ยอดเช็คอินสะสมรวม ({loyaltyUserSummary.length} คน)
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
                                  borderRadius: '10px',
                                  border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}
                              >
                                <img
                                  src={u.avatar || `/api/twitch/avatar/${encodeURIComponent(u.username)}`}
                                  alt={u.username}
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '2px solid rgba(142, 144, 246, 0.5)',
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
                                    เช็คอินไปแล้ว: <strong style={{ color: '#8e90f6', fontSize: '0.9rem' }}>{u.count}</strong> ครั้ง
                                  </div>
                                </div>
                                <span style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  background: 'rgba(142, 144, 246, 0.15)',
                                  color: '#8e90f6',
                                  padding: '3px 8px',
                                  borderRadius: '12px',
                                  border: '1px solid rgba(142, 144, 246, 0.3)',
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
                            return (
                              <div key={item.id} className="roll-history-card">
                                <div className="roll-card-left">
                                  {isLoyalty ? (
                                    <img 
                                      src={item.avatar || `/api/twitch/avatar/${encodeURIComponent(item.username || '')}`} 
                                      alt={item.username || 'User'} 
                                      className="roll-killer-thumb"
                                      style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(142, 144, 246, 0.4)' }}
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
                                        <span className="roll-info-reward" style={{ background: 'rgba(142, 144, 246, 0.15)', color: '#8e90f6', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
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
            <div className="doppel-core" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '1.25rem',
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem',
                boxShadow: '0 0 30px -5px var(--accent-glow)'
              }}>
                <Zap size={32} color="#A78BFA" />
              </div>
              <h2 style={{
                fontSize: '1.85rem',
                fontWeight: 800,
                marginBottom: '0.75rem',
                color: '#FFFFFF',
                letterSpacing: '-0.03em'
              }}>
                Solocast Overlay Studio
              </h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', lineHeight: 1.6, marginBottom: '2rem', fontSize: '0.95rem' }}>
                เชื่อมต่อบัญชี Twitch ของคุณเพื่อเริ่มปรับแต่ง Widget แบบเรียลไทม์ ซิงค์การตั้งค่าเข้ากับ OBS ทันทีโดยไม่ต้องคอยเปลี่ยน URL
              </p>
              <a href="http://localhost:3000/auth/twitch" className="btn-island accent" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
                <span>เชื่อมต่อบัญชี Twitch ตอนนี้</span>
                <div className="btn-icon-wrapper">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </div>
              </a>

              {/* Feature Highlights Bento Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', width: '100%', maxWidth: '700px', marginTop: '3.5rem', textAlign: 'left' }}>
                <div style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Zap size={16} color="#F59E0B" />
                    <h5 style={{ color: '#F8FAFC', margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Real-Time OBS Sync</h5>
                  </div>
                  <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.8rem', lineHeight: 1.5 }}>
                    เปลี่ยนสี ข้อความ รูปแบบในแดชบอร์ด อัปเดตสดใน OBS Browser Source ทันที
                  </p>
                </div>
                <div style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Sliders size={16} color="#8B5CF6" />
                    <h5 style={{ color: '#F8FAFC', margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Exclusive Widgets</h5>
                  </div>
                  <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.8rem', lineHeight: 1.5 }}>
                    Loyalty Card สมุดเช็กอิน, สุ่ม Killer Roulette, และระบบ Twitch Shoutout
                  </p>
                </div>
                <div style={{ padding: '1.25rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Users size={16} color="#10B981" />
                    <h5 style={{ color: '#F8FAFC', margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Twitch EventSub</h5>
                  </div>
                  <p style={{ color: '#94A3B8', margin: 0, fontSize: '0.8rem', lineHeight: 1.5 }}>
                    ดักจับ Follow, Subscribe, Channel Points แลกของรางวัลโดยตรง ไม่มีดีเลย์
                  </p>
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
                    <Square size={13} style={{ color: '#10B981', fill: '#10B981' }} /> กรีนสกรีน
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
                  style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', background: '#EF4444', color: '#fff', border: 'none' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <X size={14} /> ปิด
                  </span>
                </button>
              </div>
            </div>

            <div className={`live-preview-canvas ${bgMode}`} style={{ height: '100%' }}>
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
