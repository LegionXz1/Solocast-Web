import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CheckCircle2, AlertTriangle, X, ExternalLink, Plus, Trash2, 
  RotateCw, Loader2, Search, Skull, UserCheck, Layers, Ban, Check, Key, Lock,
  LifeBuoy, MessageSquare, Clock, ShieldCheck, MessageCircle, Send, Edit3, Filter
} from 'lucide-react';

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
  border: 2px solid #FFFFFF;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

h2 { margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #FFFFFF; }
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
      value: "HyperCast Widget",
      group: "ตั้งค่าทั่วไป"
    },
    accentColor: {
      type: "colorpicker",
      label: "สีธีมหลัก",
      value: "#FFFFFF",
      group: "รูปแบบการแสดงผล"
    }
  }, null, 2)
};

function Admin() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Section Selector ('widgets' | 'dbd_perks')
  const [adminSection, setAdminSection] = useState(
    searchParams.get('tab') === 'dbd_perks' ? 'dbd_perks' : 'widgets'
  );

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

  // DBD Perks Management State
  const [dbdData, setDbdData] = useState({ survivor: [], killer: [], total: 0, survivorCount: 0, killerCount: 0, updatedAt: '' });
  const [dbdRole, setDbdRole] = useState('all'); // 'all' | 'survivor' | 'killer'
  const [dbdSearch, setDbdSearch] = useState('');
  const [isSyncingDbd, setIsSyncingDbd] = useState(false);
  const [showAddPerkModal, setShowAddPerkModal] = useState(false);
  const [newPerkForm, setNewPerkForm] = useState({
    name: '',
    role: 'survivor',
    character: '',
    icon: '',
    description: ''
  });
  const [isSubmittingPerk, setIsSubmittingPerk] = useState(false);
  const [deleteConfirmPerk, setDeleteConfirmPerk] = useState(null);
  const [isDeletingPerk, setIsDeletingPerk] = useState(false);

  // Support Tickets Management State
  const [ticketsList, setTicketsList] = useState([]);
  const [ticketCounts, setTicketCounts] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState('all');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [activeManageTicket, setActiveManageTicket] = useState(null);
  const [editTicketStatus, setEditTicketStatus] = useState('pending');
  const [editTicketReply, setEditTicketReply] = useState('');
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [deleteConfirmTicket, setDeleteConfirmTicket] = useState(null);
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [adminKeyInput, setAdminKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');

  const getAuthHeader = () => {
    const token = localStorage.getItem('solocast_user_token');
    const adminKey = localStorage.getItem('solocast_admin_key');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (adminKey) headers['x-admin-key'] = adminKey;
    return headers;
  };

  const handleKeyLogin = async (e) => {
    if (e) e.preventDefault();
    if (!adminKeyInput.trim()) return;
    setKeyError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify`, {
        headers: { 'x-admin-key': adminKeyInput.trim() }
      });
      const data = await res.json();
      if (data.authorized) {
        localStorage.setItem('solocast_admin_key', adminKeyInput.trim());
        setIsAuthorized(true);
        setAuthStatus({
          checked: true,
          isTwitchConnected: true,
          connectedUsername: 'Admin Key',
          isBroadcaster: true
        });
        fetchWidgets();
        fetchDbdPerks();
        showToast('เข้าสู่ระบบแอดมินด้วย Admin Key สำเร็จ!', 'success');
      } else {
        setKeyError('รหัสผ่าน Admin Key ไม่ถูกต้อง (ค่าเริ่มต้น: solocast_admin_2026)');
      }
    } catch (err) {
      setKeyError('เกิดข้อผิดพลาดในการตรวจสอบรหัส');
    }
  };

  // Fetch DBD Perks
  const fetchDbdPerks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/dbd-perks/perks`);
      if (res.ok) {
        const data = await res.json();
        setDbdData(data);
      }
    } catch (err) {
      console.error('Error fetching DBD perks:', err);
    }
  };

  // Fetch Support Tickets
  const fetchSupportTickets = async () => {
    setIsLoadingTickets(true);
    try {
      const adminKey = localStorage.getItem('solocast_admin_key') || 'solocast_admin_2026';
      const res = await fetch(`${API_BASE}/api/support/tickets?adminKey=${encodeURIComponent(adminKey)}`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTicketsList(data.tickets || []);
          setTicketCounts(data.counts || { total: 0, pending: 0, in_progress: 0, resolved: 0, closed: 0 });
        }
      }
    } catch (err) {
      console.error('Error fetching support tickets:', err);
    } finally {
      setIsLoadingTickets(false);
    }
  };

  const handleOpenManageTicket = (ticket) => {
    setActiveManageTicket(ticket);
    setEditTicketStatus(ticket.status || 'pending');
    setEditTicketReply(ticket.adminReply || '');
  };

  const handleUpdateTicket = async () => {
    if (!activeManageTicket) return;
    setIsSavingTicket(true);
    try {
      const res = await fetch(`${API_BASE}/api/support/tickets/${activeManageTicket.ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({
          status: editTicketStatus,
          adminReply: editTicketReply.trim(),
          adminUser: authStatus.connectedUsername || 'Admin'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`อัปเดตเรื่อง #${activeManageTicket.ticketId} สำเร็จ!`, 'success');
        setActiveManageTicket(null);
        fetchSupportTickets();
      } else {
        showToast(data.error || 'เกิดข้อผิดพลาดในการอัปเดต', 'error');
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    } finally {
      setIsSavingTicket(false);
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    setIsDeletingTicket(true);
    try {
      const res = await fetch(`${API_BASE}/api/support/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('ลบเรื่องแจ้งปัญหาเรียบร้อยแล้ว', 'success');
        setDeleteConfirmTicket(null);
        if (activeManageTicket?.ticketId === ticketId) setActiveManageTicket(null);
        fetchSupportTickets();
      } else {
        showToast(data.error || 'ลบไม่สำเร็จ', 'error');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    } finally {
      setIsDeletingTicket(false);
    }
  };

  // Sync DBD Perks from Wiki
  const handleSyncDbd = async () => {
    setIsSyncingDbd(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dbd-perks/sync`, {
        method: 'POST',
        headers: getAuthHeader()
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to sync perks');
      setDbdData(result.data);
      showToast(`อัปเดตเปิร์คจาก Wiki สำเร็จ! รวม ${result.data.total} เปิร์ค`, 'success');
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการซิงค์: ' + err.message, 'error');
    } finally {
      setIsSyncingDbd(false);
    }
  };

  // Add New Perk
  const handleSubmitAddPerk = async (e) => {
    if (e) e.preventDefault();
    if (!newPerkForm.name.trim()) {
      showToast('กรุณาระบุชื่อเปิร์ค', 'error');
      return;
    }
    setIsSubmittingPerk(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dbd-perks`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPerkForm)
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to add perk');
      if (result.data) setDbdData(result.data);
      setShowAddPerkModal(false);
      setNewPerkForm({ name: '', role: dbdRole === 'killer' ? 'killer' : 'survivor', character: '', icon: '', description: '' });
      showToast(`เพิ่มเปิร์ค "${result.perk.name}" สำเร็จ!`, 'success');
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    } finally {
      setIsSubmittingPerk(false);
    }
  };

  // Delete Perk
  const handleConfirmDeletePerk = async () => {
    if (!deleteConfirmPerk) return;
    setIsDeletingPerk(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dbd-perks/${deleteConfirmPerk.role}/${encodeURIComponent(deleteConfirmPerk.id)}`, {
        method: 'DELETE',
        headers: getAuthHeader()
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || 'Failed to delete perk');
      if (result.data) setDbdData(result.data);
      showToast(`ลบเปิร์ค "${deleteConfirmPerk.name}" เรียบร้อยแล้ว`, 'success');
      setDeleteConfirmPerk(null);
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการลบเปิร์ค: ' + err.message, 'error');
    } finally {
      setIsDeletingPerk(false);
    }
  };

  // Filtered DBD Perks calculation
  const filteredDbdPerks = useMemo(() => {
    const list = [];
    if (dbdRole === 'all' || dbdRole === 'survivor') {
      (dbdData.survivor || []).forEach(p => list.push({ ...p, role: 'survivor' }));
    }
    if (dbdRole === 'all' || dbdRole === 'killer') {
      (dbdData.killer || []).forEach(p => list.push({ ...p, role: 'killer' }));
    }

    if (!dbdSearch.trim()) return list;
    const q = dbdSearch.toLowerCase().trim();
    return list.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.character && p.character.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  }, [dbdData, dbdRole, dbdSearch]);

  // Filtered Support Tickets calculation
  const filteredTicketsList = useMemo(() => {
    return ticketsList.filter(t => {
      // Status filter
      if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false;
      // Category filter
      if (ticketCategoryFilter !== 'all' && t.category !== ticketCategoryFilter) return false;
      // Text search
      if (ticketSearchQuery.trim()) {
        const q = ticketSearchQuery.toLowerCase().trim();
        const matchId = (t.ticketId || '').toLowerCase().includes(q);
        const matchSub = (t.subject || '').toLowerCase().includes(q);
        const matchUser = (t.username || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        if (!matchId && !matchSub && !matchUser && !matchDesc) return false;
      }
      return true;
    });
  }, [ticketsList, ticketStatusFilter, ticketCategoryFilter, ticketSearchQuery]);

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
        fetchDbdPerks();
        fetchSupportTickets();
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
            <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>
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
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#FFFFFF', lineHeight: 1.5 }}>
                    คุณกำลังเข้าสู่ระบบด้วยบัญชี <strong>@{authStatus.connectedUsername}</strong> ซึ่งไม่ตรงกับบัญชี Broadcaster หรือ Whitelist ที่ได้รับอนุญาต
                  </p>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  หากคุณเป็นเจ้าของช่อง กรุณาเข้าสู่ระบบด้วยบัญชีสตรีมเมอร์หลักของคุณ
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <a href={`${API_BASE}/auth/twitch`} className="btn-island" style={{ background: 'var(--surface-1)', color: 'var(--text-primary)', border: '1px solid var(--border-secondary)', justifyContent: 'center' }}>
                    <span>สลับบัญชี Twitch อื่น</span>
                  </a>
                  <button onClick={() => navigate('/dashboard')} className="btn-island accent" style={{ justifyContent: 'center' }}>
                    <span>กลับสู่หน้าแดชบอร์ดหลัก</span>
                  </button>
                </div>
              </>
            ) : null}

            
            {/* Admin Key Login Section */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-primary)', textAlign: 'left' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.65rem' }}>
                หรือ เข้าใช้งานด้วย Admin Secret Key (Developer / Backup)
              </span>
              <form onSubmit={handleKeyLogin} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="password"
                  placeholder="กรอก Admin Key (เช่น solocast_admin_2026)"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
                <button type="submit" className="btn-island accent" style={{ flexShrink: 0, padding: '0.55rem 1rem' }}>
                  <Key size={14} />
                  <span>ปลดล็อค</span>
                </button>
              </form>
              {keyError && (
                <p style={{ color: 'var(--apple-red)', fontSize: '0.8rem', marginTop: '0.5rem', margin: '0.5rem 0 0 0' }}>
                  {keyError}
                </p>
              )}
            </div>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-primary)', paddingTop: '1.25rem' }}>
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

      {/* Admin Title & Section Switcher */}
      <div className="admin-title-bar animate-fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <span className="eyebrow" style={{ marginBottom: '0.35rem' }}>SYSTEM ADMINISTRATION</span>
          <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            แผงควบคุมผู้ดูแลระบบ
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Section Switcher Tabs */}
          <div className="admin-section-nav">
            <button
              type="button"
              className={`admin-section-btn ${adminSection === 'widgets' ? 'active' : ''}`}
              onClick={() => {
                setAdminSection('widgets');
                setSearchParams({ tab: 'widgets' });
              }}
            >
              <Layers size={15} />
              <span>จัดการ Widgets</span>
            </button>
            <button
              type="button"
              className={`admin-section-btn ${adminSection === 'dbd_perks' ? 'active' : ''}`}
              onClick={() => {
                setAdminSection('dbd_perks');
                setSearchParams({ tab: 'dbd_perks' });
              }}
            >
              <Skull size={15} />
              <span>จัดการเปิร์ค DBD</span>
              <span style={{
                fontSize: '0.7rem',
                background: adminSection === 'dbd_perks' ? 'var(--accent-contrast)' : 'var(--surface-3)',
                color: adminSection === 'dbd_perks' ? 'var(--accent-color)' : 'var(--text-primary)',
                padding: '1px 6px',
                marginLeft: '2px',
                borderRadius: 'var(--radius-xs)'
              }}>
                {dbdData.total || 0}
              </span>
            </button>
            <button
              type="button"
              className={`admin-section-btn ${adminSection === 'tickets' ? 'active' : ''}`}
              onClick={() => {
                setAdminSection('tickets');
                setSearchParams({ tab: 'tickets' });
                fetchSupportTickets();
              }}
            >
              <LifeBuoy size={15} />
              <span>จัดการเรื่องแจ้งปัญหา</span>
              {ticketCounts.pending > 0 && (
                <span style={{
                  fontSize: '0.7rem',
                  background: '#EF4444',
                  color: '#FFFFFF',
                  padding: '1px 6px',
                  marginLeft: '2px',
                  borderRadius: '999px',
                  fontWeight: 800
                }}>
                  {ticketCounts.pending}
                </span>
              )}
            </button>
          </div>

          {adminSection === 'widgets' && (
            <>
              {selectedId && !isCreatingNew && (
                <button onClick={() => setShowPreviewModal(true)} className="btn-island">
                  <span>ดูตัวอย่าง Widget</span>
                </button>
              )}
              <button onClick={handleSave} disabled={isLoading} className="btn-island accent">
                <span>{isLoading ? 'กำลังบันทึก...' : isCreatingNew ? 'สร้าง Widget ใหม่' : 'บันทึกการแก้ไข'}</span>
                <div className="btn-icon-wrapper">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </div>
              </button>
            </>
          )}

          {adminSection === 'dbd_perks' && (
            <button
              onClick={() => setShowAddPerkModal(true)}
              className="btn-island accent"
            >
              <Plus size={15} />
              <span>เพิ่มเปิร์คใหม่</span>
            </button>
          )}

          {adminSection === 'tickets' && (
            <button
              onClick={fetchSupportTickets}
              disabled={isLoadingTickets}
              className="btn-island"
            >
              <RotateCw size={14} className={isLoadingTickets ? 'spin' : ''} />
              <span>รีเฟรชข้อมูล</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Widgets View */}
      {adminSection === 'widgets' && (
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
                  <h4 style={{ color: '#FFFFFF', margin: 0, fontSize: '0.95rem' }}>ลบ Widget นี้</h4>
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
    )}

      {/* Main Content: DBD Perks View */}
      {adminSection === 'dbd_perks' && (
        <div className="admin-perks-dashboard animate-fade-up">
          {/* Top Stat Cards */}
          <div className="admin-stats-card-group">
            <div className="admin-stat-card">
              <div className="admin-stat-card-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-color)' }}>
                <Skull size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เปิร์คทั้งหมดในฐานข้อมูล</span>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.4rem', fontWeight: 700 }}>
                  {dbdData.total || ((dbdData.survivor?.length || 0) + (dbdData.killer?.length || 0))} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>เปิร์ค</span>
                </h3>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-card-icon">
                <UserCheck size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ผู้รอดชีวิต (Survivor)</span>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {dbdData.survivor?.length || 0} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>เปิร์ค</span>
                </h3>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-card-icon">
                <Skull size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ฆาตกร (Killer)</span>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#FFFFFF' }}>
                  {dbdData.killer?.length || 0} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>เปิร์ค</span>
                </h3>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-card-icon">
                <RotateCw size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>อัปเดตล่าสุด</span>
                <h4 style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {dbdData.updatedAt ? new Date(dbdData.updatedAt).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'ซิงค์แล้ว'}
                </h4>
              </div>
            </div>
          </div>

          {/* Perks Toolbar */}
          <div className="admin-perks-toolbar">
            <div className="admin-perks-filter-group">
              {/* Role Switcher */}
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', padding: '3px', border: '1px solid var(--shell-border)' }}>
                <button
                  type="button"
                  onClick={() => setDbdRole('all')}
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: dbdRole === 'all' ? 'var(--accent-color)' : 'transparent',
                    color: dbdRole === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ทั้งหมด ({dbdData.total || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setDbdRole('survivor')}
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: dbdRole === 'survivor' ? 'var(--accent-color)' : 'transparent',
                    color: dbdRole === 'survivor' ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Survivor ({dbdData.survivor?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setDbdRole('killer')}
                  style={{
                    border: 'none',
                    padding: '5px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: dbdRole === 'killer' ? '#FF453A' : 'transparent',
                    color: dbdRole === 'killer' ? '#FFFFFF' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Killer ({dbdData.killer?.length || 0})
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อเปิร์ค หรือ ตัวละคร..."
                  value={dbdSearch}
                  onChange={e => setDbdSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 32px',
                    fontSize: '0.8rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--shell-border)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
                {dbdSearch && (
                  <button
                    type="button"
                    onClick={() => setDbdSearch('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                (แสดง {filteredDbdPerks.length} รายการ)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleSyncDbd}
                disabled={isSyncingDbd}
                className="btn-island"
                style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)', padding: '0.45rem 0.95rem' }}
                title="ดึงเปิร์คทั้งหมดจาก deadbydaylight.wiki.gg"
              >
                {isSyncingDbd ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={15} />}
                <span>{isSyncingDbd ? 'กำลังซิงค์...' : 'อัปเดตเปิร์คจาก Wiki'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewPerkForm({
                    name: '',
                    role: dbdRole === 'killer' ? 'killer' : 'survivor',
                    character: '',
                    icon: '',
                    description: ''
                  });
                  setShowAddPerkModal(true);
                }}
                className="btn-island accent"
                style={{ padding: '0.45rem 1rem' }}
              >
                <Plus size={15} />
                <span>เพิ่มเปิร์คใหม่</span>
              </button>
            </div>
          </div>

          {/* Perks Grid Cards */}
          <div className="admin-perk-table-wrap">
            {filteredDbdPerks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <Search size={36} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
                <h4>ไม่พบเปิร์คที่ตรงกับคำค้นหา "{dbdSearch}"</h4>
                <p style={{ fontSize: '0.85rem' }}>ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "เพิ่มเปิร์คใหม่" ด้านบนเพื่อเพิ่มเปิร์คนี้เข้าระบบ</p>
              </div>
            ) : (
              <div className="admin-perk-grid-cards">
                {filteredDbdPerks.map(perk => (
                  <div key={`${perk.role}_${perk.id}`} className="admin-perk-card-item">
                    <div className="admin-perk-card-thumb">
                      <img
                        src={perk.icon || 'https://deadbydaylight.wiki.gg/images/thumb/IconPerks_unknown.png/96px-IconPerks_unknown.png'}
                        alt={perk.name}
                        loading="lazy"
                        onError={e => { e.target.src = 'https://deadbydaylight.wiki.gg/images/thumb/IconPerks_unknown.png/96px-IconPerks_unknown.png'; }}
                      />
                    </div>
                    <div className="admin-perk-card-content">
                      <div className="admin-perk-card-title">
                        <span>{perk.name}</span>
                        <span style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          fontWeight: 700,
                          background: perk.role === 'killer' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: '#FFFFFF',
                          border: `1px solid ${perk.role === 'killer' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                        }}>
                          {perk.role === 'killer' ? 'Killer' : 'Survivor'}
                        </span>
                      </div>
                      <div className="admin-perk-card-char">
                        👤 {perk.character || 'General (เปิร์คทั่วไป)'}
                      </div>
                      {perk.description && (
                        <div className="admin-perk-card-desc" title={perk.description}>
                          {perk.description.replace(/<[^>]*>?/gm, '')}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="admin-perk-delete-btn"
                      onClick={() => setDeleteConfirmPerk(perk)}
                      title={`ลบเปิร์ค "${perk.name}"`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content: Support Tickets View */}
      {adminSection === 'tickets' && (
        <div className="admin-perks-dashboard animate-fade-up">
          {/* Top Stat Cards */}
          <div className="admin-stats-card-group" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
            <div className="admin-stat-card">
              <div className="admin-stat-card-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-color)' }}>
                <LifeBuoy size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>เรื่องแจ้งปัญหาทั้งหมด</span>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.4rem', fontWeight: 700 }}>
                  {ticketCounts.total} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>เรื่อง</span>
                </h3>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#F59E0B' }}>
                <Clock size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>รอดำเนินการ (Pending)</span>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#F59E0B' }}>
                  {ticketCounts.pending} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>เรื่อง</span>
                </h3>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6' }}>
                <RotateCw size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>กำลังตรวจสอบ (In Progress)</span>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#3B82F6' }}>
                  {ticketCounts.in_progress} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>เรื่อง</span>
                </h3>
              </div>
            </div>

            <div className="admin-stat-card">
              <div className="admin-stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>แก้ไขแล้ว (Resolved)</span>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.4rem', fontWeight: 700, color: '#10B981' }}>
                  {ticketCounts.resolved} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>เรื่อง</span>
                </h3>
              </div>
            </div>
          </div>

          {/* Tickets Toolbar */}
          <div className="admin-perks-toolbar" style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="admin-perks-filter-group" style={{ flexWrap: 'wrap', gap: '0.65rem' }}>
              {/* Status Switcher */}
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', padding: '3px', border: '1px solid var(--shell-border)' }}>
                {[
                  { id: 'all', label: `ทั้งหมด (${ticketCounts.total})` },
                  { id: 'pending', label: `รอดำเนินการ (${ticketCounts.pending})` },
                  { id: 'in_progress', label: `กำลังตรวจ (${ticketCounts.in_progress})` },
                  { id: 'resolved', label: `แก้ไขแล้ว (${ticketCounts.resolved})` },
                  { id: 'closed', label: `ปิดเรื่อง (${ticketCounts.closed})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTicketStatusFilter(tab.id)}
                    style={{
                      border: 'none',
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: ticketStatusFilter === tab.id ? 'var(--accent-color)' : 'transparent',
                      color: ticketStatusFilter === tab.id ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Category Filter */}
              <select
                value={ticketCategoryFilter}
                onChange={e => setTicketCategoryFilter(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--shell-border)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all" style={{ background: '#0F172A' }}>ทุกหมวดหมู่ (All Categories)</option>
                <option value="bug" style={{ background: '#0F172A' }}>บั๊ก / ข้อผิดพลาด</option>
                <option value="perks" style={{ background: '#0F172A' }}>เปิร์ก DBD ขาดหาย</option>
                <option value="obs" style={{ background: '#0F172A' }}>ปัญหา OBS Studio</option>
                <option value="feature" style={{ background: '#0F172A' }}>ข้อเสนอแนะฟีเจอร์ใหม่</option>
                <option value="other" style={{ background: '#0F172A' }}>คำถามหรือเรื่องอื่นๆ</option>
              </select>

              {/* Search Bar */}
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="ค้นหา Ticket ID, ผู้ส่ง, หรือหัวข้อ..."
                  value={ticketSearchQuery}
                  onChange={e => setTicketSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 32px',
                    fontSize: '0.8rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--shell-border)',
                    color: 'var(--text-primary)',
                    outline: 'none'
                  }}
                />
                {ticketSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTicketSearchQuery('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tickets List */}
          <div className="admin-perk-table-wrap">
            {isLoadingTickets ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem auto' }} />
                <p>กำลังโหลดรายการเรื่องแจ้งปัญหา...</p>
              </div>
            ) : filteredTicketsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-secondary)' }}>
                <LifeBuoy size={36} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
                <h4>ไม่พบเรื่องแจ้งปัญหาในเงื่อนไขนี้</h4>
                <p style={{ fontSize: '0.85rem' }}>ลองเปลี่ยนตัวกรองสถานะ หรือล้างคำค้นหา</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {filteredTicketsList.map(ticket => {
                  const statusInfo = {
                    pending: { label: 'รอดำเนินการ', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' },
                    in_progress: { label: 'กำลังตรวจสอบ', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)' },
                    resolved: { label: 'แก้ไขแล้ว', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)' },
                    closed: { label: 'ปิดเรื่องแล้ว', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.15)', border: 'rgba(107, 114, 128, 0.35)' }
                  }[ticket.status] || { label: 'รอดำเนินการ', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)' };

                  const hasReply = Boolean(ticket.adminReply && ticket.adminReply.trim());

                  return (
                    <div
                      key={ticket.ticketId}
                      style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-primary)',
                        padding: '1.25rem',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}
                    >
                      {/* Row 1: Header tags */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {/* Status Pill */}
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: statusInfo.bg,
                            border: `1px solid ${statusInfo.border}`,
                            color: statusInfo.color,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '999px'
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusInfo.color }} />
                            {statusInfo.label}
                          </span>

                          {/* Ticket ID */}
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            color: 'var(--text-primary)'
                          }}>
                            #{ticket.ticketId}
                          </span>

                          {/* Category */}
                          <span style={{
                            fontSize: '0.75rem',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--shell-border)',
                            color: 'var(--text-secondary)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {ticket.category}
                          </span>

                          {/* Reply status */}
                          {hasReply ? (
                            <span style={{ fontSize: '0.72rem', color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                              <CheckCircle2 size={12} /> ตอบกลับแล้ว
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#F59E0B', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} /> รอตอบกลับ
                            </span>
                          )}
                        </div>

                        {/* Date */}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(ticket.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>

                      {/* Row 2: Subject & Description preview */}
                      <div>
                        <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                          {ticket.subject}
                        </h4>
                        <p style={{
                          margin: 0,
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          maxHeight: '4.5em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {ticket.description}
                        </p>
                      </div>

                      {/* Row 3: User Info & Actions */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px solid var(--border-primary)',
                        paddingTop: '0.75rem',
                        marginTop: '0.25rem',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                      }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <span>ผู้ส่ง: <strong style={{ color: 'var(--text-primary)' }}>@{ticket.username || 'Guest'}</strong></span>
                          {ticket.contact && <span>ติดต่อ: <span style={{ color: 'var(--text-secondary)' }}>{ticket.contact}</span></span>}
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmTicket(ticket)}
                            className="code-action-btn danger"
                            style={{ padding: '4px 8px' }}
                            title="ลบเรื่องนี้"
                          >
                            <Trash2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenManageTicket(ticket)}
                            className="btn-island accent"
                            style={{ padding: '0.45rem 0.95rem', fontSize: '0.8rem' }}
                          >
                            <Edit3 size={13} />
                            <span>จัดการ & ตอบกลับ</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      {/* Add New Perk Modal */}
      {showAddPerkModal && (
        <div className="modal-overlay" onClick={() => setShowAddPerkModal(false)}>
          <div className="modal-card admin-add-perk-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} style={{ color: 'var(--accent-color)' }} /> เพิ่มเปิร์คใหม่ (Add Perk)
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPerkModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAddPerk}>
              {/* Role Radio Pills */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  บทบาทของเปิร์ค (Role) *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setNewPerkForm(p => ({ ...p, role: 'survivor' }))}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: newPerkForm.role === 'survivor' ? '1px solid var(--accent-color)' : '1px solid var(--border-primary)',
                      background: newPerkForm.role === 'survivor' ? 'var(--accent-color)' : 'transparent',
                      color: newPerkForm.role === 'survivor' ? 'var(--accent-contrast)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    🏃 ผู้รอดชีวิต (Survivor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPerkForm(p => ({ ...p, role: 'killer' }))}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: newPerkForm.role === 'killer' ? '1px solid #FF453A' : '1px solid var(--border-primary)',
                      background: newPerkForm.role === 'killer' ? '#FF453A' : 'transparent',
                      color: newPerkForm.role === 'killer' ? '#FFFFFF' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    🔪 ฆาตกร (Killer)
                  </button>
                </div>
              </div>

              {/* Perk Name */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  ชื่อเปิร์ค (Perk Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น Sprint Burst หรือ Dead Hard"
                  value={newPerkForm.name}
                  onChange={e => setNewPerkForm(p => ({ ...p, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--shell-border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {/* Character Name */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  ตัวละครเจ้าของเปิร์ค (Character)
                </label>
                <input
                  type="text"
                  placeholder="เช่น Meg Thomas, The Trapper, หรือ General (เปิร์คทั่วไป)"
                  value={newPerkForm.character}
                  onChange={e => setNewPerkForm(p => ({ ...p, character: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--shell-border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {/* Icon URL with Preview */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  ลิงก์รูปไอคอนเปิร์ค (Icon URL)
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="https://... หรือปล่อยว่างเพื่อใช้ไอคอนเริ่มต้น"
                    value={newPerkForm.icon}
                    onChange={e => setNewPerkForm(p => ({ ...p, icon: e.target.value }))}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--shell-border)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: '0.9rem'
                    }}
                  />
                  <div style={{
                    width: '42px',
                    height: '42px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid var(--shell-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    padding: '2px'
                  }}>
                    <img
                      src={newPerkForm.icon || 'https://deadbydaylight.wiki.gg/images/thumb/IconPerks_unknown.png/96px-IconPerks_unknown.png'}
                      alt="Preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={e => { e.target.src = 'https://deadbydaylight.wiki.gg/images/thumb/IconPerks_unknown.png/96px-IconPerks_unknown.png'; }}
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  คำอธิบายหรือความสามารถเปิร์ค (Description)
                </label>
                <textarea
                  rows={3}
                  placeholder="รายละเอียดเอฟเฟกต์ของเปิร์ค..."
                  value={newPerkForm.description}
                  onChange={e => setNewPerkForm(p => ({ ...p, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--shell-border)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontSize: '0.85rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddPerkModal(false)}
                  className="btn-island"
                  style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)' }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPerk}
                  className="btn-island accent"
                  style={{ padding: '0.65rem 1.25rem' }}
                >
                  {isSubmittingPerk ? 'กำลังบันทึก...' : 'บันทึกเปิร์คใหม่'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Perk Confirm Modal */}
      {deleteConfirmPerk && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmPerk(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ color: '#FFFFFF', marginBottom: '0.75rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} /> ยืนยันการลบเปิร์ค
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.85rem', marginBottom: '1.25rem' }}>
              <img
                src={deleteConfirmPerk.icon || 'https://deadbydaylight.wiki.gg/images/thumb/IconPerks_unknown.png/96px-IconPerks_unknown.png'}
                alt={deleteConfirmPerk.name}
                style={{ width: '40px', height: '40px', objectFit: 'contain' }}
              />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{deleteConfirmPerk.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>บทบาท: {deleteConfirmPerk.role} | {deleteConfirmPerk.character || 'General'}</div>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              คุณแน่ใจหรือไม่ว่าต้องการลบเปิร์ค <strong>{deleteConfirmPerk.name}</strong> ออกจากระบบ?
              เมื่อลบแล้ว เปิร์คนี้จะไม่สามารถสุ่มได้ใน OBS จนกว่าจะเพิ่มใหม่หรือซิงค์จาก Wiki
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmPerk(null)}
                className="btn-island"
                style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)' }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeletingPerk}
                onClick={handleConfirmDeletePerk}
                className="btn-danger"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                {isDeletingPerk ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage / Reply Support Ticket Modal */}
      {activeManageTicket && (
        <div className="modal-overlay" onClick={() => setActiveManageTicket(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', width: '90%' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-primary)', paddingBottom: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  TICKET #{activeManageTicket.ticketId}
                </span>
                <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  จัดการและตอบกลับเรื่องแจ้งปัญหา
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveManageTicket(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Ticket Info Card */}
            <div style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-secondary)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  ผู้ส่ง: <strong>@{activeManageTicket.username || 'Guest'}</strong> {activeManageTicket.contact && `(${activeManageTicket.contact})`}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {new Date(activeManageTicket.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>
              <h4 style={{ margin: '0 0 0.45rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
                {activeManageTicket.subject}
              </h4>
              <p style={{
                margin: 0,
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap'
              }}>
                {activeManageTicket.description}
              </p>
              {activeManageTicket.screenshotUrl && (
                <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-primary)' }}>
                  <a
                    href={activeManageTicket.screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent, #3B82F6)', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>เปิดดูรูปภาพ/ลิงก์ที่แนบมา</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            {/* Edit Form */}
            <form onSubmit={e => { e.preventDefault(); handleUpdateTicket(); }}>
              {/* Status Selector */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  สถานะของปัญหา (Ticket Status) *
                </label>
                <select
                  value={editTicketStatus}
                  onChange={e => setEditTicketStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-secondary)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    outline: 'none'
                  }}
                >
                  <option value="pending" style={{ background: '#0F172A' }}>🟡 รอดำเนินการ (Pending)</option>
                  <option value="in_progress" style={{ background: '#0F172A' }}>🔵 กำลังตรวจสอบ (In Progress)</option>
                  <option value="resolved" style={{ background: '#0F172A' }}>🟢 แก้ไขเรียบร้อยแล้ว (Resolved)</option>
                  <option value="closed" style={{ background: '#0F172A' }}>⚪ ปิดเรื่องแล้ว (Closed)</option>
                </select>
              </div>

              {/* Admin Reply */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  ข้อความตอบกลับจากแอดมิน (Admin Reply)
                </label>
                <textarea
                  rows={4}
                  placeholder="พิมพ์ข้อความตอบกลับไปยังผู้แจ้งเรื่อง เช่น ทางเราได้ตรวจสอบและอัปเดตระบบแล้ว หรือแนะนำขั้นตอนแก้ปัญหา... (ข้อความนี้จะแสดงในหน้า ติดตามสถานะ ของผู้ใช้ทันที)"
                  value={editTicketReply}
                  onChange={e => setEditTicketReply(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '0.85rem',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-secondary)',
                    color: 'var(--text-primary)',
                    borderRadius: '6px',
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: 1.5
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmTicket(activeManageTicket);
                  }}
                  className="code-action-btn danger"
                  style={{ padding: '0.55rem 0.85rem', fontSize: '0.8rem' }}
                >
                  <Trash2 size={14} />
                  <span>ลบเรื่องนี้</span>
                </button>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveManageTicket(null)}
                    className="btn-island"
                    style={{ padding: '0.6rem 1.15rem' }}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingTicket}
                    className="btn-island accent"
                    style={{ padding: '0.6rem 1.35rem' }}
                  >
                    {isSavingTicket ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>{isSavingTicket ? 'กำลังบันทึก...' : 'บันทึก & ส่งการตอบกลับ'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Ticket Confirm Modal */}
      {deleteConfirmTicket && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmTicket(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ color: '#FFFFFF', marginBottom: '0.75rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} /> ยืนยันการลบเรื่องแจ้งปัญหา
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              คุณแน่ใจหรือไม่ว่าต้องการลบเรื่อง <strong>#{deleteConfirmTicket.ticketId}</strong>: "{deleteConfirmTicket.subject}"?
              การกระทำนี้จะลบข้อมูลออกจากระบบอย่างถาวร
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmTicket(null)}
                className="btn-island"
                style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--shell-border)' }}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeletingTicket}
                onClick={() => handleDeleteTicket(deleteConfirmTicket.ticketId)}
                className="btn-danger"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                {isDeletingTicket ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
