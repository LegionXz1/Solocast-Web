import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

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

  // Tab & History State
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'history'
  const [rollHistory, setRollHistory] = useState([]);

  // Live Preview State
  const [previewKey, setPreviewKey] = useState(0);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [bgMode, setBgMode] = useState('checker'); // 'checker' | 'dark-solid' | 'green-screen'
  const [shoutoutChannel, setShoutoutChannel] = useState('legionxiz');

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
    if (!selectedWidget) return;
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
        setSaveSuccess('ซิงค์ไปยัง OBS เรียบร้อยแล้ว ✓');
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

    const simEvent = {
      userId: status.userId,
      type: 'redemption',
      isTest: true,
      data: { name: 'GamerGod88', rewardTitle: title, isTest: true }
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
    for (const key in fieldData) {
      if (fieldData[key] !== '') params.append(key, fieldData[key]);
    }
    widgetUrl = `http://localhost:3000/widgets/${selectedWidget}/index.html?${params.toString()}`;
    previewUrl = `http://localhost:3000/widgets/${selectedWidget}/index.html?user=${encodeURIComponent(status.userId || '')}&preview=1&_k=${previewKey}`;
  }

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
      <div key={groupName} style={{ marginBottom: '2rem' }}>
        <h4>{groupName}</h4>
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
            {field.type === 'colorpicker' && (
              <div className="color-wrapper">
                <input
                  type="color"
                  value={fieldData[field.key] || '#000000'}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                />
                <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{fieldData[field.key]}</span>
              </div>
            )}
            {field.type === 'slider' && (
              <div className="slider-wrapper">
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={fieldData[field.key] !== undefined ? fieldData[field.key] : 0}
                  onChange={e => handleFieldChange(field.key, Number(e.target.value))}
                />
                <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{fieldData[field.key]}</span>
              </div>
            )}
            {field.type === 'checkbox' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginTop: '0.35rem', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                  checked={fieldData[field.key] !== undefined ? Boolean(fieldData[field.key]) : Boolean(field.value)}
                  onChange={e => handleFieldChange(field.key, e.target.checked)}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: (fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                  {(fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? 'เปิดใช้งาน (ON)' : 'ปิดการใช้งาน (OFF)'}
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
              <span>⚙️ ผู้ดูแลระบบ (Admin)</span>
            </button>
          )}
          {status.connected && (
            <button
              onClick={handleLogout}
              className="btn-island"
              style={{ background: 'var(--bg-color)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.6rem 1rem' }}
            >
              <span>ออกจากระบบ</span>
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
                      <div key={idx} className="event-card">
                        {ev.type === 'follower' ? `🎉 ${ev.data.name} กดติดตาม!` :
                          ev.type === 'redemption' ? `🎁 ${ev.data.name} แลกของรางวัล ${ev.data.rewardTitle}` :
                            `⭐ ${ev.data.name} กดซับสไครบ์!`}
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
        {status.connected && (
          <div className="doppel-shell animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div className="doppel-core">
              <span className="eyebrow">แผงควบคุมอัจฉริยะ</span>
              <h2>ปรับแต่ง Widget</h2>

              <div className="widget-grid">
                {widgets.map(w => (
                  <div
                    key={w.id}
                    className={`widget-card ${selectedWidget === w.id ? 'active' : ''}`}
                    onClick={() => setSelectedWidget(w.id)}
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
                    {activeTab === 'settings' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {saveSuccess && (
                          <span style={{ color: '#10B981', fontSize: '0.85rem', fontWeight: 600 }}>
                            {saveSuccess}
                          </span>
                        )}
                        <button
                          onClick={() => handleSaveSettings(fieldData)}
                          className="btn-island accent"
                          style={{ padding: '0.5rem 1.15rem', fontSize: '0.85rem' }}
                          disabled={isSaving}
                        >
                          <span>{isSaving ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 📑 Tab Navigation: Settings vs Roll History */}
                  <div className="widget-tab-nav">
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className={`widget-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                    >
                      <span>⚙️ ตั้งค่า Widget (Settings)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className={`widget-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    >
                      <span>📜 ประวัติการสุ่ม (Roll History)</span>
                      {rollHistory.length > 0 && (
                        <span className="tab-badge">{rollHistory.length}</span>
                      )}
                    </button>
                  </div>

                  {/* TAB 1: SETTINGS & LIVE PREVIEW */}
                  {activeTab === 'settings' && (
                    <>
                      {/* 📺 Live Preview Canvas Box */}
                      <div className="live-preview-box">
                        <div className="live-preview-header">
                          <div className="live-preview-title">
                            <span>📺 ตัวอย่างผลลัพธ์สด (Live Preview)</span>
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
                                  <span>📢 ยิง Shoutout</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={handleTriggerPreview}
                                className="btn-preview-action accent"
                                title="ทดสอบแสดงผล Roulette ทันที"
                              >
                                <span>⚡ ทดสอบสุ่ม (Trigger)</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={handleReloadPreview}
                              className="btn-preview-action"
                              title="รีเฟรชหน้าต่าง Preview"
                            >
                              <span>🔄 รีเฟรช</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setShowFullscreenPreview(true)}
                              className="btn-preview-action"
                              title="เปิดดูแบบขยายเต็มจอ"
                            >
                              <span>⛶ ขยายเต็มจอ</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setIsPreviewCollapsed(!isPreviewCollapsed)}
                              className="btn-preview-action"
                              title={isPreviewCollapsed ? "แสดงตัวอย่าง" : "ย่อตัวอย่าง"}
                            >
                              <span>{isPreviewCollapsed ? '👁️ แสดง' : '▲ ย่อ'}</span>
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

                      {/* OBS URL Box */}
                      <div className="url-box">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                          ลิงก์สำหรับนำไปใส่ใน OBS (Browser Source)
                        </label>
                        <textarea readOnly value={widgetUrl} rows={4} onClick={e => e.target.select()} />
                      </div>
                    </>
                  )}

                  {/* TAB 2: ROLL HISTORY LOG */}
                  {activeTab === 'history' && (
                    <div className="roll-history-container">
                      <div className="roll-history-header">
                        <div>
                          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            📜 ประวัติการแลกและการสุ่มผลลัพธ์
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            บันทึกผลลัพธ์แบบเรียลไทม์ (ทั้งหมด {rollHistory.length} รายการ)
                          </span>
                        </div>

                        {rollHistory.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearHistory}
                            className="btn-preview-action"
                            style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            <span>🗑️ ล้างประวัติทั้งหมด</span>
                          </button>
                        )}
                      </div>

                      {rollHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎲</div>
                          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>ยังไม่มีประวัติการสุ่ม</h4>
                          <p style={{ fontSize: '0.875rem', maxWidth: '400px', margin: '0 auto', lineHeight: 1.6 }}>
                            เมื่อมีผู้ชมแลกแต้มในช่อง Twitch หรือคุณกดปุ่ม "จำลองการแลกแต้ม" รายชื่อและผลลัพธ์ที่สุ่มได้จะถูกบันทึกและแสดงที่นี่แบบเรียลไทม์ทันที
                          </p>
                        </div>
                      ) : (
                        <div className="roll-history-list">
                          {rollHistory.map((item) => (
                            <div key={item.id} className="roll-history-card">
                              <div className="roll-card-left">
                                {item.killerImg ? (
                                  <img 
                                    src={item.killerImg} 
                                    alt={item.killer || 'Killer'} 
                                    className="roll-killer-thumb"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="roll-killer-placeholder">☠️</div>
                                )}
                                <div>
                                  <div className="roll-info-name">
                                    {item.killer || item.result || 'ไม่ทราบผลลัพธ์'}
                                  </div>
                                  <div className="roll-info-meta">
                                    <span>
                                      👤 ผู้แลก: <strong className="roll-info-user">@{item.username || 'นิรนาม'}</strong>
                                    </span>
                                    {item.rewardTitle && (
                                      <span className="roll-info-reward">
                                        🎁 {item.rewardTitle}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="roll-time">
                                🕒 {formatTime(item.timestamp)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ⛶ Fullscreen Live Preview Modal */}
      {showFullscreenPreview && selectedWidget && (
        <div className="modal-overlay" onClick={() => setShowFullscreenPreview(false)}>
          <div className="modal-card fullscreen-preview-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                  📺 Live Preview: {widgets.find(w => w.id === selectedWidget)?.name}
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
                  🏁 ตารางโปร่งใส
                </button>
                <button
                  type="button"
                  onClick={() => setBgMode('dark-solid')}
                  className={`btn-preview-action ${bgMode === 'dark-solid' ? 'accent' : ''}`}
                >
                  ⬛ พื้นหลังสีดำ
                </button>
                <button
                  type="button"
                  onClick={() => setBgMode('green-screen')}
                  className={`btn-preview-action ${bgMode === 'green-screen' ? 'accent' : ''}`}
                >
                  🟩 กรีนสกรีน
                </button>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleTriggerPreview}
                  className="btn-preview-action accent"
                >
                  <span>⚡ ทดสอบสุ่ม (Trigger)</span>
                </button>
                <button
                  type="button"
                  onClick={handleReloadPreview}
                  className="btn-preview-action"
                >
                  <span>🔄 รีเฟรช</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullscreenPreview(false)}
                  className="btn-island"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', background: '#EF4444', color: '#fff', border: 'none' }}
                >
                  <span>✕ ปิด</span>
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
