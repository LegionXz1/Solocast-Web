import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, X, ExternalLink } from 'lucide-react';

const API_BASE = 'http://localhost:3000';

const SAMPLE_TEMPLATE = {
  html: `<div id="widget-container">
  <div class="card">
    <h2 id="event-title">พร้อมรับการแจ้งเตือน</h2>
    <p id="event-user">รออีเวนต์จาก Twitch...</p>
  </div>
</div>`,
  css: `body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: sans-serif;
  background: transparent;
}

#widget-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

.card {
  background: rgba(15, 23, 42, 0.9);
  color: white;
  padding: 1.5rem 2.5rem;
  border-radius: 1rem;
  border: 2px solid #8B5CF6;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

h2 { margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #C084FC; }
p { margin: 0; font-size: 1.1rem; }`,
  js: `// รับอีเวนต์เมื่อมีคน Follow หรือ ซับสไครบ์ หรือ แลกแต้ม
window.addEventListener('onEventReceived', function (obj) {
  const event = obj.detail;
  console.log("ได้รับ Event:", event);
  
  const titleEl = document.getElementById('event-title');
  const userEl = document.getElementById('event-user');

  if (event.type === 'follower') {
    titleEl.textContent = 'ผู้ติดตามใหม่!';
    userEl.textContent = event.data.name;
  } else if (event.type === 'redemption') {
    titleEl.textContent = 'แลกของรางวัล!';
    userEl.textContent = event.data.name + ' (' + event.data.rewardTitle + ')';
  } else if (event.type === 'subscriber') {
    titleEl.textContent = 'ผู้ซับสไครบ์!';
    userEl.textContent = event.data.name;
  }
});`,
  fields: JSON.stringify({
    headerText: {
      type: "text",
      label: "ข้อความหัวข้อเริ่มต้น",
      value: "Solocast Widget",
      group: "ตั้งค่าทั่วไป"
    },
    accentColor: {
      type: "colorpicker",
      label: "สีธีมหลัก",
      value: "#8B5CF6",
      group: "รูปแบบการแสดงผล"
    }
  }, null, 2)
};

function Admin() {
  const navigate = useNavigate();

  // Auth State
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authStatus, setAuthStatus] = useState({
    checked: false,
    isTwitchConnected: false,
    connectedUsername: null,
    isBroadcaster: false
  });

  // Widget State
  const [widgets, setWidgets] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    html: '',
    css: '',
    js: '',
    fields: '{}'
  });

  // UI State
  const [activeTab, setActiveTab] = useState('html'); // 'html' | 'css' | 'js' | 'fields'
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: '' }
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('solocast_user_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Verify Admin Access purely via Twitch Broadcaster session
  const verifyAuth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify`, {
        headers: getAuthHeader()
      });
      const data = await res.json();
      setAuthStatus({
        checked: true,
        isTwitchConnected: data.isTwitchConnected,
        connectedUsername: data.connectedUsername,
        isBroadcaster: data.isBroadcaster
      });

      if (data.authorized) {
        setIsAuthorized(true);
        fetchWidgets();
      } else {
        setIsAuthorized(false);
      }
    } catch (err) {
      setAuthStatus(p => ({ ...p, checked: true }));
      setIsAuthorized(false);
    }
  };

  useEffect(() => {
    verifyAuth();
  }, []);

  // Fetch all widgets
  const fetchWidgets = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets`);
      const data = await res.json();
      setWidgets(data);
      if (data.length > 0 && !selectedId && !isCreatingNew) {
        loadWidget(data[0].id);
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการโหลด Widget: ' + err.message, 'error');
    }
  };

  // Load a single widget
  const loadWidget = async (widgetId) => {
    setIsLoading(true);
    setIsCreatingNew(false);
    setSelectedId(widgetId);
    try {
      const res = await fetch(`${API_BASE}/api/widgets/${widgetId}`);
      if (!res.ok) throw new Error('ไม่พบข้อมูล Widget');
      const data = await res.json();
      setFormData({
        id: data.id,
        name: data.name || data.id,
        html: data.html || '',
        css: data.css || '',
        js: data.js || '',
        fields: data.fields || '{}'
      });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Start new widget
  const handleStartNew = () => {
    setIsCreatingNew(true);
    setSelectedId('');
    setFormData({
      id: '',
      name: '',
      html: SAMPLE_TEMPLATE.html,
      css: SAMPLE_TEMPLATE.css,
      js: SAMPLE_TEMPLATE.js,
      fields: SAMPLE_TEMPLATE.fields
    });
    setActiveTab('html');
  };

  // Load Sample Template
  const handleLoadSample = () => {
    setFormData(prev => ({
      ...prev,
      html: SAMPLE_TEMPLATE.html,
      css: SAMPLE_TEMPLATE.css,
      js: SAMPLE_TEMPLATE.js,
      fields: SAMPLE_TEMPLATE.fields
    }));
    showToast('โหลดเทมเพลตตัวอย่างเรียบร้อย');
  };

  // Format JSON
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(formData.fields);
      setFormData(prev => ({ ...prev, fields: JSON.stringify(parsed, null, 2) }));
      showToast('จัดรูปแบบ JSON สำเร็จ');
    } catch (err) {
      showToast('JSON ไม่ถูกต้อง: ' + err.message, 'error');
    }
  };

  // Save / Update
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim()) {
      return showToast('กรุณากรอกชื่อ Widget (Widget Name)', 'error');
    }

    setIsLoading(true);
    try {
      if (isCreatingNew) {
        // POST create
        const res = await fetch(`${API_BASE}/api/widgets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify(formData)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'สร้าง Widget ไม่สำเร็จ');

        showToast(`สร้าง Widget "${result.widget.name}" สำเร็จ!`);
        setIsCreatingNew(false);
        await fetchWidgets();
        loadWidget(result.widget.id);
      } else {
        // PUT update
        const res = await fetch(`${API_BASE}/api/widgets/${formData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader()
          },
          body: JSON.stringify({
            name: formData.name,
            html: formData.html,
            css: formData.css,
            js: formData.js,
            fields: formData.fields
          })
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'บันทึกการแก้ไขไม่สำเร็จ');

        showToast(`บันทึก Widget "${formData.name}" เรียบร้อย!`);
        await fetchWidgets();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!selectedId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/widgets/${selectedId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'ลบ Widget ไม่สำเร็จ');

      showToast(`ลบ Widget "${selectedId}" สำเร็จ`);
      setShowDeleteModal(false);
      setSelectedId('');
      const listRes = await fetch(`${API_BASE}/api/widgets`);
      const newList = await listRes.json();
      setWidgets(newList);
      if (newList.length > 0) {
        loadWidget(newList[0].id);
      } else {
        handleStartNew();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Auth Gate Screen
  if (!isAuthorized) {
    return (
      <div className="dashboard-container" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="doppel-shell animate-fade-up" style={{ maxWidth: 480, width: '100%' }}>
          <div className="doppel-core" style={{ textAlign: 'center' }}>
            <span className="eyebrow" style={{ color: authStatus.isTwitchConnected && !authStatus.isBroadcaster ? '#EF4444' : 'var(--text-secondary)' }}>
              {authStatus.isTwitchConnected && !authStatus.isBroadcaster ? '403 FORBIDDEN' : 'ระบบรักษาความปลอดภัย'}
            </span>

            <h2>{authStatus.isTwitchConnected && !authStatus.isBroadcaster ? 'ไม่มีสิทธิ์เข้าถึงหน้านี้' : 'แผงควบคุมผู้ดูแลระบบ'}</h2>

            {!authStatus.checked ? (
              <p style={{ color: 'var(--text-secondary)', padding: '2rem 0' }}>กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</p>
            ) : !authStatus.isTwitchConnected ? (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
                  หน้านี้สงวนสิทธิ์เฉพาะ **เจ้าของช่องสตรีม (Broadcaster)** เท่านั้น กรุณาเข้าสู่ระบบด้วยบัญชี Twitch ของคุณเพื่อตรวจสอบสิทธิ์
                </p>

                <a href={`${API_BASE}/auth/twitch`} className="btn-island accent" style={{ width: '100%', justifyContent: 'center' }}>
                  <span>เข้าสู่ระบบด้วย Twitch แอดมิน</span>
                  <div className="btn-icon-wrapper">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </div>
                </a>
              </>
            ) : !authStatus.isBroadcaster ? (
              <>
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '1rem', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#DC2626', lineHeight: 1.5 }}>
                    คุณกำลังเข้าสู่ระบบด้วยบัญชี <strong>@{authStatus.connectedUsername}</strong> ซึ่งไม่ตรงกับบัญชี Broadcaster หรือ Whitelist ที่ได้รับอนุญาต
                  </p>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  หากคุณเป็นเจ้าของช่อง กรุณาเข้าสู่ระบบด้วยบัญชีสตรีมเมอร์หลักของคุณ
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <a href={`${API_BASE}/auth/twitch`} className="btn-island" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)', justifyContent: 'center' }}>
                    <span>สลับบัญชี Twitch อื่น</span>
                  </a>
                  <button onClick={() => navigate('/dashboard')} className="btn-island accent" style={{ justifyContent: 'center' }}>
                    <span>กลับสู่หน้าแดชบอร์ดหลัก</span>
                  </button>
                </div>
              </>
            ) : null}

            <div style={{ marginTop: '2rem', borderTop: '1px solid var(--shell-border)', paddingTop: '1.25rem' }}>
              <button onClick={() => navigate('/dashboard')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600 }}>
                ← กลับสู่หน้าแดชบอร์ด
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="admin-header-nav animate-fade-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="floating-nav" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>SoloCast Powered by LegionX</span>
            <span style={{ fontSize: '0.75rem', background: 'var(--accent-color)', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '9999px' }}>Admin</span>
          </div>
        </div>

        <div className="admin-nav-actions">
          <button onClick={() => navigate('/dashboard')} className="btn-island" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)' }}>
            <span>แดชบอร์ดผู้ใช้</span>
          </button>
          {selectedId && !isCreatingNew && (
            <button onClick={() => setShowPreviewModal(true)} className="btn-island" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)' }}>
              <span>ดูตัวอย่าง Widget</span>
            </button>
          )}
          <button onClick={handleSave} disabled={isLoading} className="btn-island accent">
            <span>{isLoading ? 'กำลังบันทึก...' : isCreatingNew ? 'สร้าง Widget ใหม่' : 'บันทึกการแก้ไข'}</span>
            <div className="btn-icon-wrapper">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </div>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="admin-grid">
        {/* Left Column: Widgets List */}
        <div className="doppel-shell animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="doppel-core">
            <span className="eyebrow">คลังวิดเจ็ต</span>
            <h2>รายการ Widget</h2>

            <button
              onClick={handleStartNew}
              className="btn-island accent"
              style={{ width: '100%', justifyContent: 'center', marginBottom: '1.25rem', padding: '0.75rem 1rem' }}
            >
              <span>+ สร้าง Widget ใหม่</span>
            </button>

            <div className="admin-sidebar-list">
              {widgets.map(w => (
                <div
                  key={w.id}
                  className={`admin-widget-item ${selectedId === w.id && !isCreatingNew ? 'active' : ''}`}
                  onClick={() => loadWidget(w.id)}
                >
                  <div className="admin-widget-info">
                    <h5>{w.name}</h5>
                    <span>ID: {w.id}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    →
                  </div>
                </div>
              ))}
              {widgets.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                  ยังไม่มี Widget ในระบบ
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Code & Fields Editor */}
        <div className="doppel-shell animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="doppel-core">
            <span className="eyebrow">
              {isCreatingNew ? 'สร้าง Widget ใหม่' : `แก้ไข: ${formData.name || formData.id}`}
            </span>
            <h2>{isCreatingNew ? 'เพิ่ม Widget เข้าสู่ระบบ' : 'ตัวจัดการโค้ดและคุณสมบัติ'}</h2>

            {/* Widget Meta Fields */}
            <div className="admin-form-row">
              <div className="input-group">
                <label>ชื่อ Widget (Display Name)</label>
                <input
                  type="text"
                  placeholder="เช่น Loyalty Card, แจ้งเตือนสุ่มคิลเลอร์"
                  value={formData.name}
                  onChange={e => {
                    const val = e.target.value;
                    setFormData(p => ({
                      ...p,
                      name: val,
                      id: isCreatingNew && (!p.id || p.id === p.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'))
                        ? val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                        : p.id
                    }));
                  }}
                />
              </div>

              <div className="input-group">
                <label>Widget ID (Slug สำหรับโฟลเดอร์และ URL)</label>
                <input
                  type="text"
                  placeholder="เช่น loyalty-card"
                  value={formData.id}
                  disabled={!isCreatingNew}
                  onChange={e => setFormData(p => ({ ...p, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  style={!isCreatingNew ? { opacity: 0.6, cursor: 'not-allowed', background: 'var(--shell-bg)' } : {}}
                />
              </div>
            </div>

            {/* Editor Tabs */}
            <div className="editor-tabs-bar">
              <button
                type="button"
                className={`editor-tab-btn ${activeTab === 'html' ? 'active' : ''}`}
                onClick={() => setActiveTab('html')}
              >
                <span>HTML (โครงสร้าง)</span>
                <span className="editor-badge">html.txt</span>
              </button>

              <button
                type="button"
                className={`editor-tab-btn ${activeTab === 'css' ? 'active' : ''}`}
                onClick={() => setActiveTab('css')}
              >
                <span>CSS (สไตล์ตกแต่ง)</span>
                <span className="editor-badge">css.txt</span>
              </button>

              <button
                type="button"
                className={`editor-tab-btn ${activeTab === 'js' ? 'active' : ''}`}
                onClick={() => setActiveTab('js')}
              >
                <span>JavaScript (การทำงาน)</span>
                <span className="editor-badge">js.txt</span>
              </button>

              <button
                type="button"
                className={`editor-tab-btn ${activeTab === 'fields' ? 'active' : ''}`}
                onClick={() => setActiveTab('fields')}
              >
                <span>Fields Schema (การตั้งค่า)</span>
                <span className="editor-badge">fields.json</span>
              </button>
            </div>

            {/* Code Window Container */}
            <div className="code-window">
              <div className="code-window-bar">
                <div className="code-window-dots">
                  <div className="code-window-dot red"></div>
                  <div className="code-window-dot yellow"></div>
                  <div className="code-window-dot green"></div>
                </div>

                <div className="code-window-title">
                  {activeTab === 'html' && 'html.txt'}
                  {activeTab === 'css' && 'css.txt'}
                  {activeTab === 'js' && 'js.txt'}
                  {activeTab === 'fields' && 'fields.json'}
                </div>

                <div className="code-window-actions">
                  <button type="button" onClick={handleLoadSample} className="code-action-btn" title="โหลดตัวอย่างเริ่มต้น">
                    โหลดเทมเพลตตัวอย่าง
                  </button>
                  {activeTab === 'fields' && (
                    <button type="button" onClick={handleFormatJson} className="code-action-btn">
                      จัดรูปแบบ JSON
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const val = formData[activeTab];
                      navigator.clipboard.writeText(val);
                      showToast('คัดลอกโค้ดลงคลิปบอร์ดแล้ว');
                    }}
                    className="code-action-btn"
                  >
                    คัดลอก
                  </button>
                </div>
              </div>

              {activeTab === 'html' && (
                <textarea
                  className="code-textarea"
                  placeholder="วางโค้ด HTML ที่นี่..."
                  value={formData.html}
                  onChange={e => setFormData(p => ({ ...p, html: e.target.value }))}
                />
              )}

              {activeTab === 'css' && (
                <textarea
                  className="code-textarea"
                  placeholder="วางโค้ด CSS ที่นี่..."
                  value={formData.css}
                  onChange={e => setFormData(p => ({ ...p, css: e.target.value }))}
                />
              )}

              {activeTab === 'js' && (
                <textarea
                  className="code-textarea"
                  placeholder="วางโค้ด JavaScript ที่นี่..."
                  value={formData.js}
                  onChange={e => setFormData(p => ({ ...p, js: e.target.value }))}
                />
              )}

              {activeTab === 'fields' && (
                <textarea
                  className="code-textarea"
                  placeholder="วาง Fields JSON Schema ที่นี่..."
                  value={formData.fields}
                  onChange={e => setFormData(p => ({ ...p, fields: e.target.value }))}
                />
              )}
            </div>

            {/* Danger Zone: Delete Widget */}
            {!isCreatingNew && selectedId && (
              <div className="admin-danger-zone">
                <div>
                  <h4 style={{ color: '#EF4444', margin: 0, fontSize: '0.95rem' }}>ลบ Widget นี้</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>
                    การลบจะลบโฟลเดอร์ <code>public/widgets/{selectedId}</code> ออกจากเซิร์ฟเวอร์ทันที
                  </p>
                </div>
                <button type="button" onClick={() => setShowDeleteModal(true)} className="btn-danger">
                  ลบ Widget
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#EF4444', marginBottom: '0.75rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} /> ยืนยันการลบ Widget
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              คุณแน่ใจหรือไม่ว่าต้องการลบ <strong>{formData.name}</strong> (<code>{selectedId}</code>)?
              การกระทำนี้ไม่สามารถย้อนกลับได้ และลิงก์ Browser Source ที่ใช้อยู่ใน OBS จะหยุดทำงานทันที
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn-island"
                style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)' }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-danger"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {showPreviewModal && selectedId && (
        <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
          <div className="modal-card preview-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>ตัวอย่างสด (Live Preview): {formData.name}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {`${API_BASE}/widgets/${selectedId}/index.html`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={`${API_BASE}/widgets/${selectedId}/index.html`}
                  target="_blank"
                  rel="noreferrer"
                  className="code-action-btn"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <ExternalLink size={14} /> เปิดแท็บใหม่
                </a>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="code-action-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <X size={14} /> ปิดหน้าต่าง
                </button>
              </div>
            </div>
            <iframe
              className="preview-iframe"
              src={`${API_BASE}/widgets/${selectedId}/index.html`}
              title="Widget Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
