import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import UpdateModal from '../components/UpdateModal';
import { API_BASE, WS_BASE } from '../config';
import './SecretSettings.css';
import {
  Sliders,
  Sparkles,
  Save,
  Loader2,
  Eye,
  Megaphone,
  Play,
  RotateCw,
  RotateCcw,
  Maximize2,
  Copy,
  Check,
  Info,
  Dices,
  Skull,
  Crosshair,
  Award,
  Music,
  Volume2,
  ArrowLeft,
  Search,
  ExternalLink,
  Power,
  Calculator,
  Plus,
  Minus,
  Trophy,
  Palette,
  Layers,
  Monitor,
  Flame,
  Tv,
  CheckCircle2,
  HelpCircle,
  Hash,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  LayoutGrid,
  ShieldCheck,
  RefreshCw,
  Ticket,
  X,
  History,
  Trash2,
  Pause,
  SkipForward,
  Undo,
  AlertCircle,
  ListMusic,
  CalendarCheck,
  Users,
  Gift,
  Clock,
  LogOut,
  Zap,
  Radio,
  Link as LinkIcon
} from 'lucide-react';

const WIDGET_CATEGORIES = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'game', label: 'เกม & สุ่ม' },
  { id: 'twitch', label: 'แชท & คอมมูนิตี้' },
  { id: 'music', label: 'เพลง & มีเดีย' }
];

const socket = io(WS_BASE);

const WIDGET_META = {
  'dbd-perks': {
    name: 'DBD Random Perk',
    icon: <Dices size={20} />,
    desc: 'สุ่มเปิร์ค Survivor & Killer สำหรับ Dead by Daylight',
    gradient: 'linear-gradient(135deg, #ea580c, #c2410c)',
    category: 'game',
    color: '#ea580c'
  },
  'random-killer': {
    name: 'DBD Random Killer',
    icon: <Skull size={20} />,
    desc: 'สุ่มฆาตกร Dead by Daylight พร้อมรูปภาพและแฟ้มประวัติ',
    gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)',
    category: 'game',
    color: '#ef4444'
  },
  'custom-counter': {
    name: 'Custom Counter',
    icon: <Calculator size={20} />,
    desc: 'นับยอดสถิติ ควบคุมผ่านเว็บ และสั่งเพิ่มลดผ่านแชท/แต้มช่อง',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    category: 'twitch',
    color: '#f59e0b'
  },
  'valorant-agent': {
    name: 'Valorant Agent Roulette',
    icon: <Crosshair size={20} />,
    desc: 'สุ่มตัวละคร Valorant พร้อมเสียงพากย์และ Role คัดกรอง',
    gradient: 'linear-gradient(135deg, #ff4655, #0f1923)',
    category: 'game',
    color: '#ff4655'
  },
  'spotify-sr': {
    name: 'Spotify Song Request',
    icon: <Music size={20} />,
    desc: 'ขอเพลง Spotify ผ่านแชท !sr หรือใช้ Channel Points พร้อมคิวเพลง',
    gradient: 'linear-gradient(135deg, #10b981, #047857)',
    category: 'music',
    color: '#10b981'
  },
  'twitch-shoutout': {
    name: 'Twitch Shoutout',
    icon: <Megaphone size={20} />,
    desc: 'ป็อปอัปแนะนำและโปรโมทช่องสตรีมเมอร์ พร้อมวิดีโอและคลิป',
    gradient: 'linear-gradient(135deg, #0284c7, #0369a1)',
    category: 'twitch',
    color: '#0284c7'
  },
  'loyalty-card': {
    name: 'Loyalty Card',
    icon: <Ticket size={20} />,
    desc: 'การ์ดสะสมแต้มแชทและเช็คอินสตรีมเมอร์',
    gradient: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
    category: 'twitch',
    color: '#7c3aed'
  },
  'dbd-scoreboard': {
    name: 'DBD Scoreboard',
    icon: <Trophy size={20} />,
    desc: 'สกอร์บอร์ดสถิติ Killer DBD (Kills / Draws / Escapes)',
    gradient: 'linear-gradient(135deg, #b91c1c, #450a0a)',
    category: 'game',
    color: '#b91c1c'
  }
};

const THEME_PRESETS = {
  'cyberpunk': { name: 'Neon Cyberpunk', bg: 'linear-gradient(135deg, #00f0ff, #ff0055)' },
  'minimal-glass': { name: 'Glassmorphism', bg: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(0,0,0,0.4))' },
  'clean-hud': { name: 'Clean HUD', bg: 'linear-gradient(135deg, #1e293b, #0f172a)' },
  'souls': { name: 'Dark Souls', bg: 'linear-gradient(135deg, #78350f, #1c1917)' },
  'arcade': { name: 'Retro 80s', bg: 'linear-gradient(135deg, #f43f5e, #8b5cf6)' },
  'vinyl': { name: 'Retro Vinyl', bg: 'linear-gradient(135deg, #18181b, #27272a)' },
  'minimal': { name: 'Stealth Black', bg: 'linear-gradient(135deg, #111827, #030712)' }
};

export default function SecretSettings() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem('solocast_user_token') || '');
  const [status, setStatus] = useState({ connected: false, username: '', isAdmin: false, userId: '' });
  const [showUpdateModal, setShowUpdateModal] = useState(null);

  // Widget Selection & List
  const [widgets, setWidgets] = useState([]);
  const [selectedWidget, setSelectedWidget] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('widget');
      return (p && WIDGET_META[p]) ? p : 'dbd-perks';
    } catch {
      return 'dbd-perks';
    }
  });
  const [widgetStatusOverview, setWidgetStatusOverview] = useState({ user: {}, global: {}, access: {} });

  // Sync URL search param when selected widget changes
  useEffect(() => {
    try {
      const url = new URL(window.location);
      if (url.searchParams.get('widget') !== selectedWidget) {
        url.searchParams.set('widget', selectedWidget);
        window.history.replaceState({}, '', url.toString());
      }
    } catch { }
  }, [selectedWidget]);

  // Widget Switcher Modal State
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [switcherCategory, setSwitcherCategory] = useState('all');
  const [switcherSearch, setSwitcherSearch] = useState('');

  // Close switcher on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isSwitcherOpen) {
        setIsSwitcherOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSwitcherOpen]);

  // Quick Prev / Next Widget Navigation
  const handlePrevWidget = () => {
    const currentIndex = widgets.findIndex(w => w.id === selectedWidget);
    if (currentIndex > 0) {
      setSelectedWidget(widgets[currentIndex - 1].id);
    } else if (widgets.length > 0) {
      setSelectedWidget(widgets[widgets.length - 1].id);
    }
  };

  const handleNextWidget = () => {
    const currentIndex = widgets.findIndex(w => w.id === selectedWidget);
    if (currentIndex !== -1 && currentIndex < widgets.length - 1) {
      setSelectedWidget(widgets[currentIndex + 1].id);
    } else if (widgets.length > 0) {
      setSelectedWidget(widgets[0].id);
    }
  };

  // Filtered widgets for switcher modal
  const filteredWidgets = useMemo(() => {
    return widgets.filter(w => {
      const meta = WIDGET_META[w.id] || {};
      const matchesCat = switcherCategory === 'all' || meta.category === switcherCategory;
      const q = switcherSearch.toLowerCase().trim();
      const matchesSearch = !q ||
        (meta.name && meta.name.toLowerCase().includes(q)) ||
        (w.name && w.name.toLowerCase().includes(q)) ||
        (w.id && w.id.toLowerCase().includes(q)) ||
        (meta.desc && meta.desc.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [widgets, switcherCategory, switcherSearch]);

  // Active Category Tab
  // 'quick' | 'design' | 'twitch' | 'content' | 'audio' | 'obs' | 'history' | 'all'
  const [activeCategory, setActiveCategory] = useState('quick');
  const [searchQuery, setSearchQuery] = useState('');

  // Schema & Fields
  const [schema, setSchema] = useState(null);
  const [fieldData, setFieldData] = useState({});
  const [originalFieldData, setOriginalFieldData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedReward, setCopiedReward] = useState('');

  // Preview State
  const [previewBg, setPreviewBg] = useState('checker'); // 'checker' | 'black' | 'green' | 'magenta'
  const [previewKey, setPreviewKey] = useState(0);
  const previewIframeRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Content Data for Specific Widgets
  const [killersList, setKillersList] = useState([]);
  const [dbdPerksList, setDbdPerksList] = useState({ survivor: [], killer: [] });
  const [dbdRole, setDbdRole] = useState('survivor');
  const [dbdSearchQuery, setDbdSearchQuery] = useState('');
  const [agentsList, setAgentsList] = useState([]);
  const [isRollingValorant, setIsRollingValorant] = useState(false);
  const [syncValSuccess, setSyncValSuccess] = useState('');
  const [syncPerksSuccess, setSyncPerksSuccess] = useState('');
  const [isSyncingPerks, setIsSyncingPerks] = useState(false);
  const [isSyncingValorant, setIsSyncingValorant] = useState(false);
  const [counterCount, setCounterCount] = useState(0);
  const [counterCustomInput, setCounterCustomInput] = useState('');

  // DBD Scoreboard State
  const [scoreboardData, setScoreboardData] = useState({ killerKills: 0, killerDraws: 0, killerEscapes: 0 });
  const [showDbdCmdEditor, setShowDbdCmdEditor] = useState(false);
  const [dbdCmdSaveSuccess, setDbdCmdSaveSuccess] = useState('');

  // Spotify Song Request State
  const [spotifyStatus, setSpotifyStatus] = useState({ configured: false, connected: false, displayName: null, product: null });
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [spotifyQueue, setSpotifyQueue] = useState([]);
  const [spotifyMsg, setSpotifyMsg] = useState({ type: '', text: '' });
  const [srSearchQuery, setSrSearchQuery] = useState('');
  const [srIsRequesting, setSrIsRequesting] = useState(false);

  // Roll History State
  const [rollHistory, setRollHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');

  // Check URL query parameters (e.g. Spotify Auth Return)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify_connected') === '1') {
      setSelectedWidget('spotify-sr');
      setSpotifyMsg({ type: 'success', text: 'เชื่อมต่อบัญชี Spotify สำเร็จแล้ว! พร้อมใช้งาน' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('spotify_error')) {
      setSelectedWidget('spotify-sr');
      setSpotifyMsg({ type: 'error', text: `การเชื่อมต่อ Spotify ไม่สำเร็จ: ${params.get('spotify_error')}` });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Check Session
  useEffect(() => {
    const activeToken = token || localStorage.getItem('solocast_user_token');
    if (!activeToken) return;

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
            userId: data.user.userId,
            overlayToken: data.user.overlayToken || ''
          });
          socket.emit('join_user', { token: activeToken, userId: data.user.userId, overlayToken: data.user.overlayToken });
        }
      })
      .catch(() => { });
  }, [token]);

  // Load Widgets
  useEffect(() => {
    fetch(`${API_BASE}/api/widgets`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setWidgets(data);
          if (!selectedWidget && data.length > 0) {
            setSelectedWidget(data[0].id);
          }
        }
      })
      .catch(() => { });
  }, []);

  // Fetch Status Overview
  const fetchStatusOverview = useCallback(() => {
    if (!status.userId) return;
    fetch(`${API_BASE}/api/widgets/status-overview?user=${encodeURIComponent(status.userId)}&username=${encodeURIComponent(status.username || '')}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          setWidgetStatusOverview(data);
        }
      })
      .catch(() => { });
  }, [status.userId, status.username]);

  useEffect(() => {
    fetchStatusOverview();
  }, [fetchStatusOverview]);

  // Spotify Data Fetcher
  const fetchSpotifyData = useCallback(async () => {
    if (selectedWidget !== 'spotify-sr') return;
    try {
      const u = encodeURIComponent(status.userId || '');
      const [resStatus, resQueue, resCurrent] = await Promise.all([
        fetch(`${API_BASE}/api/spotify/status?userId=${u}`).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/api/spotify/queue?userId=${u}`).then(r => r.ok ? r.json() : { queue: [] }),
        fetch(`${API_BASE}/api/spotify/current?userId=${u}`).then(r => r.ok ? r.json() : null)
      ]);
      if (resStatus) setSpotifyStatus(resStatus);
      if (resQueue && Array.isArray(resQueue.queue)) setSpotifyQueue(resQueue.queue);
      if (resCurrent) setNowPlaying(resCurrent);
    } catch (_) { }
  }, [selectedWidget, status.userId]);

  // Load Schema and Saved Settings for Active Widget
  useEffect(() => {
    if (!selectedWidget) return;
    setSchema(null);

    const u = status.userId || status.username || '';
    const activeToken = token || localStorage.getItem('solocast_user_token');
    const tokenQuery = status.overlayToken ? `&token=${encodeURIComponent(status.overlayToken)}` : '';
    Promise.all([
      fetch(`${API_BASE}/api/widgets/${selectedWidget}/schema`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/api/widgets/${selectedWidget}/settings?user=${encodeURIComponent(u)}${tokenQuery}`, {
        headers: activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}
      }).then(r => r.ok ? r.json() : null)
    ]).then(([sch, setts]) => {
      setSchema(sch || {});
      const defaults = {};
      if (sch) {
        for (const k in sch) {
          defaults[k] = sch[k].value !== undefined ? sch[k].value : '';
        }
      }
      const combined = { ...defaults, ...(setts || {}) };
      setFieldData(combined);
      setOriginalFieldData(combined);
    });

    // Special Content data
    if (selectedWidget === 'random-killer') {
      fetch(`${API_BASE}/api/widgets/random-killer/killers`).then(r => r.json()).then(setKillersList).catch(() => { });
    } else if (selectedWidget === 'dbd-perks') {
      fetch(`${API_BASE}/api/widgets/dbd-perks/perks`).then(r => r.json()).then(setDbdPerksList).catch(() => { });
    } else if (selectedWidget === 'valorant-agent') {
      fetch(`${API_BASE}/api/widgets/valorant-agent/agents`).then(r => r.json()).then(setAgentsList).catch(() => { });
    } else if (selectedWidget === 'custom-counter') {
      fetch(`${API_BASE}/api/widgets/custom-counter/data?user=${encodeURIComponent(status.userId || status.username || '')}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.count !== undefined) setCounterCount(d.count);
        }).catch(() => { });
    } else if (selectedWidget === 'dbd-scoreboard') {
      fetch(`${API_BASE}/api/widgets/dbd-scoreboard/data?user=${encodeURIComponent(status.userId || status.username || '')}`)
        .then(r => r.json())
        .then(d => {
          if (d && d.scoreData) setScoreboardData(d.scoreData);
        }).catch(() => { });
    } else if (selectedWidget === 'spotify-sr') {
      fetchSpotifyData();
    }

    // Load Roll History
    if (selectedWidget !== 'twitch-shoutout') {
      fetch(`${API_BASE}/api/widgets/${selectedWidget}/history?user=${encodeURIComponent(status.userId || status.username || '')}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })
        .then(r => r.ok ? r.json() : [])
        .then(d => {
          setRollHistory(Array.isArray(d) ? d : []);
        }).catch(() => { });
    } else {
      setRollHistory([]);
    }
  }, [selectedWidget, status.userId, status.username, fetchSpotifyData]);

  // Keep Socket in sync with user & channel rooms on connect / reconnect
  useEffect(() => {
    const target = status.userId || status.username;
    if (!target) return;
    const handleConnect = () => {
      if (status.userId) socket.emit('join_user', { userId: status.userId, token });
      if (status.username || status.userId) socket.emit('join_channel', status.username || status.userId);
    };
    socket.on('connect', handleConnect);
    if (socket.connected) {
      handleConnect();
    }
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [status.userId, status.username, token]);

  // Real-time Socket Event Listeners
  useEffect(() => {
    const handleNewRoll = (payload) => {
      if (payload && payload.widgetId === selectedWidget && payload.item) {
        setRollHistory(prev => {
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

    const handleSpotifyNowPlaying = (data) => {
      if (data && (!data.userId || String(data.userId) === String(status.userId))) {
        setNowPlaying(data);
      }
    };

    const handleSpotifyQueueUpdated = (data) => {
      if (data && (!data.userId || String(data.userId) === String(status.userId)) && Array.isArray(data.queue)) {
        setSpotifyQueue(data.queue);
      }
    };

    const handleSpotifyNewRequest = (data) => {
      if (data && (!data.userId || String(data.userId) === String(status.userId))) {
        fetchSpotifyData();
      }
    };

    const handleCounterUpdated = (data) => {
      if (!data) return;
      if (status.userId && data.userId && String(data.userId).toLowerCase() !== String(status.userId).toLowerCase()) {
        return;
      }
      if (data.count !== undefined) {
        setCounterCount(data.count);
        setFieldData(prev => ({ ...prev, currentCount: data.count }));
      }
    };

    const handleScoreboardUpdated = (data) => {
      if (!data) return;
      const targetUser = String(status.userId || status.username || '').toLowerCase();
      if (targetUser) {
        const match = String(data.userId || '').toLowerCase() === targetUser ||
          String(data.username || '').toLowerCase() === targetUser ||
          (Array.isArray(data.associatedUserIds) && data.associatedUserIds.some(id => String(id).toLowerCase() === targetUser));
        if (!match) return;
      }
      if (data.scoreData) {
        setScoreboardData(data.scoreData);
      }
    };

    const handleWidgetStatusUpdated = (payload) => {
      if (!payload) return;
      if (payload.type === 'access') {
        fetchStatusOverview();
        return;
      }
      setWidgetStatusOverview(prev => {
        const updated = { ...prev };
        if (payload.type === 'global') {
          updated.global = { ...updated.global, [payload.widgetId]: { ...(updated.global[payload.widgetId] || {}), enabled: payload.enabled, reason: payload.reason || '' } };
        } else if (payload.type === 'user' && (payload.userId === status.userId || payload.userId === status.username)) {
          updated.user = { ...updated.user, [payload.widgetId]: payload.enabled };
        }
        return updated;
      });
    };

    const handleAccessChanged = () => {
      fetchStatusOverview();
    };

    socket.on('widget_roll_history_item', handleNewRoll);
    socket.on('widget_roll_history_cleared', handleClearedHistory);
    socket.on('dbd_perks_updated', handleDbdPerksUpdated);
    socket.on('spotify_now_playing', handleSpotifyNowPlaying);
    socket.on('spotify_queue_updated', handleSpotifyQueueUpdated);
    socket.on('spotify_new_request', handleSpotifyNewRequest);
    socket.on('counter_updated', handleCounterUpdated);
    socket.on('dbd_scoreboard_updated', handleScoreboardUpdated);
    socket.on('widget_status_updated', handleWidgetStatusUpdated);
    socket.on('widget_access_changed', handleAccessChanged);

    return () => {
      socket.off('widget_roll_history_item', handleNewRoll);
      socket.off('widget_roll_history_cleared', handleClearedHistory);
      socket.off('dbd_perks_updated', handleDbdPerksUpdated);
      socket.off('spotify_now_playing', handleSpotifyNowPlaying);
      socket.off('spotify_queue_updated', handleSpotifyQueueUpdated);
      socket.off('spotify_new_request', handleSpotifyNewRequest);
      socket.off('counter_updated', handleCounterUpdated);
      socket.off('dbd_scoreboard_updated', handleScoreboardUpdated);
      socket.off('widget_status_updated', handleWidgetStatusUpdated);
      socket.off('widget_access_changed', handleAccessChanged);
    };
  }, [selectedWidget, status.userId, status.username, fetchSpotifyData, fetchStatusOverview]);

  // Handle Field Value Change with Debounced Auto-Save
  const handleFieldChange = (key, value) => {
    setFieldData(prev => {
      const next = { ...prev, [key]: value };
      // Real-time postMessage to preview iframe
      if (previewIframeRef.current && previewIframeRef.current.contentWindow) {
        try {
          previewIframeRef.current.contentWindow.postMessage({
            type: 'onFieldsUpdate',
            fieldData: next,
            ...next
          }, '*');
        } catch (_) { }
      }

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        handleSave(next, true);
      }, 700);

      return next;
    });
  };

  // Has Unsaved Changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(fieldData) !== JSON.stringify(originalFieldData);
  }, [fieldData, originalFieldData]);

  // Save Settings
  const handleSave = async (dataToSave = fieldData, isSilent = false) => {
    if (!isSilent) setIsSaving(true);
    try {
      const u = status.userId || status.username || 'default';
      const res = await fetch(`${API_BASE}/api/widgets/${selectedWidget}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: u,
          settings: dataToSave
        })
      });
      const data = await res.json();
      if (data.success) {
        setOriginalFieldData(dataToSave);
        if (!isSilent) {
          setSaveSuccess('บันทึกการตั้งค่าสำเร็จและซิงค์ไปยัง OBS เรียบร้อยแล้ว!');
          setTimeout(() => setSaveSuccess(''), 3000);
        }
      }
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      if (!isSilent) setIsSaving(false);
    }
  };

  // Reset to original saved
  const handleReset = () => {
    setFieldData(originalFieldData);
    if (previewIframeRef.current && previewIframeRef.current.contentWindow) {
      previewIframeRef.current.contentWindow.postMessage({
        type: 'onFieldsUpdate',
        fieldData: originalFieldData,
        ...originalFieldData
      }, '*');
    }
  };

  // Reset to schema defaults
  const handleResetToDefaults = () => {
    if (!schema) return;
    if (!window.confirm('คุณต้องการรีเซ็ตการตั้งค่าทั้งหมดของ Widget นี้กลับเป็นค่าเริ่มต้นใช่หรือไม่?')) return;
    const defaults = {};
    for (const k in schema) {
      defaults[k] = schema[k].value !== undefined ? schema[k].value : '';
    }
    setFieldData(defaults);
    if (previewIframeRef.current && previewIframeRef.current.contentWindow) {
      previewIframeRef.current.contentWindow.postMessage({
        type: 'onFieldsUpdate',
        fieldData: defaults,
        ...defaults
      }, '*');
    }
  };

  // Toggle Widget Active/Inactive
  const handleToggleWidget = async () => {
    const isCurrentlyActive = widgetStatusOverview.user[selectedWidget] === true;
    const newEnabled = !isCurrentlyActive;
    try {
      const res = await fetch(`${API_BASE}/api/user/widgets/${selectedWidget}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          user: status.userId || status.username || 'default',
          username: status.username || '',
          enabled: newEnabled
        })
      });
      const data = await res.json();
      if (res.ok) {
        setWidgetStatusOverview(prev => ({
          ...prev,
          user: {
            ...prev.user,
            [selectedWidget]: newEnabled
          }
        }));
      } else if (data.globallyDisabled) {
        alert('Widget นี้ถูกปิดโดยผู้ดูแลระบบ ไม่สามารถเปิดใช้งานได้ในขณะนี้');
      } else if (data.accessDenied) {
        alert('คุณไม่ได้รับสิทธิ์ให้ใช้งาน Widget นี้');
      } else {
        alert(data.error || 'ไม่สามารถเปลี่ยนสถานะ Widget ได้');
      }
    } catch (_) { }
  };

  // DBD Scoreboard Update Handler
  const handleScoreboardUpdate = async (action, target, value) => {
    const u = status.userId || status.username || 'default';
    try {
      const res = await fetch(`${API_BASE}/api/widgets/dbd-scoreboard/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: u,
          action,
          target,
          value,
          updatedBy: status.username || 'SecretSettings'
        })
      });
      const data = await res.json();
      if (data.success && data.scoreData) {
        setScoreboardData(data.scoreData);
      }
    } catch (e) {
      console.error('Error updating scoreboard:', e);
    }
  };

  // Custom Counter update handler
  const handleCounterUpdate = async (action, delta, value) => {
    const u = status.userId || status.username || 'default';
    try {
      const res = await fetch(`${API_BASE}/api/widgets/custom-counter/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: u,
          action,
          delta,
          value,
          updatedBy: status.username || 'SecretSettings'
        })
      });
      const data = await res.json();
      if (data.success && data.count !== undefined) {
        setCounterCount(data.count);
        setFieldData(prev => ({ ...prev, currentCount: data.count }));
      }
    } catch (e) {
      console.error('Error updating counter:', e);
    }
  };

  const handleCounterStep = (delta) => {
    handleCounterUpdate(delta > 0 ? 'inc' : 'dec', Math.abs(delta));
  };

  const handleCounterSet = (val) => {
    if (val === '' || isNaN(val)) return;
    handleCounterUpdate('set', undefined, Number(val));
  };

  // Roll Valorant
  const handleRollValorant = async (overrideMode) => {
    setIsRollingValorant(true);
    try {
      const res = await fetch(`${API_BASE}/api/widgets/valorant-agent/roll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: status.userId,
          username: status.username || 'Streamer',
          roleFilter: fieldData.roleFilter || 'all',
          mode: overrideMode || fieldData.mode || 'single',
          excludedAgents: fieldData.excludedAgents || []
        })
      });
      const data = await res.json();
      if (data.success && data.historyItem) {
        setRollHistory(prev => [data.historyItem, ...prev].slice(0, 100));
      }
    } catch (err) {
      console.error('Error rolling Valorant agent:', err);
    } finally {
      setTimeout(() => setIsRollingValorant(false), 800);
    }
  };

  // Sync Valorant Agents
  const handleSyncValorant = async () => {
    setIsSyncingValorant(true);
    setSyncValSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/widgets/valorant-agent/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        setAgentsList(data.data.agents || []);
        setSyncValSuccess(`อัปเดตตัวละครสำเร็จ! (ทั้งหมด ${data.data.total} ตัว)`);
        setTimeout(() => setSyncValSuccess(''), 4000);
      }
    } catch (err) {
      console.error('Error syncing Valorant agents:', err);
    } finally {
      setIsSyncingValorant(false);
    }
  };

  // Sync DBD Perks
  const handleSyncDbdPerks = async () => {
    if (!status.isAdmin) {
      alert('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถซิงค์เปิร์คได้');
      return;
    }
    setIsSyncingPerks(true);
    setSyncPerksSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/widgets/dbd-perks/sync`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success && data.data) {
        setDbdPerksList(data.data);
        setSyncPerksSuccess(`อัปเดตเปิร์คเรียบร้อย! (ทั้งหมด ${data.data.total} เปิร์ค)`);
        setTimeout(() => setSyncPerksSuccess(''), 4000);
      } else {
        alert('ไม่สามารถอัปเดตเปิร์คได้: ' + (data.error || 'ไม่มีสิทธิ์เข้าถึง'));
      }
    } catch (err) {
      console.error('Error syncing DBD perks:', err);
    } finally {
      setIsSyncingPerks(false);
    }
  };

  // Clear Roll History
  const handleClearHistory = async () => {
    if (!window.confirm('คุณต้องการล้างประวัติกิจกรรมทั้งหมดใช่หรือไม่?')) return;
    try {
      await fetch(`${API_BASE}/api/widgets/${selectedWidget}/history?user=${encodeURIComponent(status.userId || status.username || '')}`, {
        method: 'DELETE',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      setRollHistory([]);
    } catch (err) {
      console.error('Failed to clear roll history:', err);
    }
  };

  // Spotify Control Handlers
  const handleConnectSpotify = async () => {
    setSpotifyLoading(true);
    setSpotifyMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/spotify/auth-url?userId=${encodeURIComponent(status.userId || '')}&returnTo=${encodeURIComponent('/settings?widget=spotify-sr')}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setSpotifyMsg({ type: 'error', text: data.error || 'ไม่สามารถสร้างลิงก์เข้าสู่ระบบ Spotify ได้ (ตรวจสอบ .env)' });
      }
    } catch (e) {
      setSpotifyMsg({ type: 'error', text: e.message });
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleDisconnectSpotify = async () => {
    if (!window.confirm('คุณต้องการยกเลิกการเชื่อมต่อ Spotify ใช่หรือไม่?')) return;
    setSpotifyLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/spotify/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSpotifyStatus({ configured: true, connected: false, displayName: null, product: null });
        setNowPlaying(null);
        setSpotifyQueue([]);
        setSpotifyMsg({ type: 'success', text: 'ยกเลิกการเชื่อมต่อ Spotify สำเร็จแล้ว' });
      }
    } catch (e) {
      setSpotifyMsg({ type: 'error', text: e.message });
    } finally {
      setSpotifyLoading(false);
    }
  };

  const handleSkipTrack = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/spotify/skip`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'ไม่สามารถข้ามเพลงได้');
      } else {
        fetchSpotifyData();
      }
    } catch (e) {
      alert('ข้ามเพลงไม่สำเร็จ: ' + e.message);
    }
  };

  const handleManualSongRequest = async (e) => {
    if (e) e.preventDefault();
    if (!srSearchQuery.trim()) return;
    setSrIsRequesting(true);
    setSpotifyMsg({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/spotify/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: srSearchQuery.trim(),
          requester: status.username || 'Dashboard'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSrSearchQuery('');
        setSpotifyMsg({ type: 'success', text: `เพิ่มเพลง "${data.track.name} - ${data.track.artist}" เข้าคิวแล้ว!` });
        fetchSpotifyData();
      } else {
        setSpotifyMsg({ type: 'error', text: data.error || 'เพิ่มเพลงไม่สำเร็จ' });
      }
    } catch (err) {
      setSpotifyMsg({ type: 'error', text: err.message });
    } finally {
      setSrIsRequesting(false);
    }
  };

  const handleDeleteQueueItem = async (itemId) => {
    try {
      const res = await fetch(`${API_BASE}/api/spotify/queue/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSpotifyQueue(prev => prev.filter(it => it.id !== itemId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearQueue = async () => {
    if (!window.confirm('คุณต้องการล้างคิวเพลงทั้งหมดใช่หรือไม่?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/spotify/queue`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSpotifyQueue([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Simulate/Test Trigger
  const handleSimulate = () => {
    const targetReward = fieldData.rewardName || fieldData.rewardNameSurvivor || fieldData.rewardNameKiller || fieldData.channelPointsReward || 'สุ่มเปิร์ค';
    const payload = {
      userId: status.userId,
      isTest: true,
      type: 'redemption',
      data: {
        name: status.username || 'TestViewer',
        userName: status.username || 'testviewer',
        rewardTitle: targetReward,
        input: fieldData.commandPrefix || '!sr Sunflower',
        isTest: true
      }
    };
    socket.emit('test_event', payload);

    if (selectedWidget === 'dbd-perks') {
      socket.emit('simulate_dbd_perk', {
        userId: status.userId,
        role: dbdRole,
        username: status.username || 'Streamer'
      });
    } else if (selectedWidget === 'valorant-agent') {
      handleRollValorant('single');
    }
  };

  // Preview Triggers
  const handleTriggerPreview = (overrideRole, isRaid = false) => {
    if (selectedWidget === 'twitch-shoutout') {
      const ch = (status.username || 'legionxiz').trim().toLowerCase().replace('@', '');
      socket.emit('simulate_shoutout', {
        userId: status.userId,
        channel: ch,
        isRaid: !!isRaid,
        viewers: 25
      });
    } else if (selectedWidget === 'dbd-perks') {
      const curRole = typeof overrideRole === 'string' ? overrideRole : dbdRole;
      const testUser = status.username || 'Streamer';
      socket.emit('simulate_dbd_perk', {
        userId: status.userId,
        role: curRole,
        username: testUser
      });
    } else if (selectedWidget === 'spotify-sr') {
      const mockTrack = {
        isPlaying: true,
        progressMs: 65000,
        track: {
          id: 'test-preview-track',
          name: 'Shape of You',
          artist: 'Ed Sheeran',
          artists: 'Ed Sheeran',
          album: '÷ (Divide)',
          albumArt: 'https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96',
          durationMs: 233712,
          uri: 'spotify:track:7qiZfU4dY1lWllzX7mPBI3'
        },
        requester: status.username || 'ChatViewer',
        timestamp: Date.now()
      };
      socket.emit('spotify_now_playing', mockTrack);
      if (previewIframeRef.current && previewIframeRef.current.contentWindow) {
        previewIframeRef.current.contentWindow.postMessage({
          type: 'spotify_now_playing',
          data: mockTrack
        }, '*');
      }
      socket.emit('test_event', {
        userId: status.userId,
        type: 'spotify_new_request',
        data: {
          track: mockTrack.track,
          requester: status.username || 'ChatViewer',
          source: 'channel_points'
        }
      });
    } else if (selectedWidget === 'custom-counter') {
      handleCounterStep(1);
    } else if (selectedWidget === 'valorant-agent') {
      handleRollValorant(typeof overrideRole === 'string' ? overrideRole : (fieldData.mode || 'single'));
    } else if (selectedWidget === 'dbd-scoreboard') {
      handleScoreboardUpdate('win');
    } else {
      handleSimulate();
    }
  };

  // Test Sound via Web Audio API
  const handleTestSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vol = Math.max(0.05, Math.min(1, (fieldData.soundVolume || 60) / 100)) * 0.3;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.15); // C6
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.31);
    } catch (_) { }
  };

  // Format Helpers
  const formatDuration = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    const secs = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${mins}:${secs} น.`;
  };

  // Loyalty Card User Summary
  const loyaltyUserSummary = useMemo(() => {
    if (selectedWidget !== 'loyalty-card') return [];
    const map = {};
    rollHistory.forEach(item => {
      const u = item.username || 'unknown';
      if (!map[u]) {
        map[u] = { username: u, count: 0, avatar: item.avatar };
      }
      map[u].count += 1;
      if (item.avatar) map[u].avatar = item.avatar;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [selectedWidget, rollHistory]);

  // Filtered Roll History for Search
  const filteredRollHistory = useMemo(() => {
    if (!historySearch.trim()) return rollHistory;
    const q = historySearch.toLowerCase().trim();
    return rollHistory.filter(item => {
      const u = (item.username || '').toLowerCase();
      const r = (item.rewardTitle || '').toLowerCase();
      const res = (item.result || '').toLowerCase();
      const killer = (item.killer || '').toLowerCase();
      const agent = (item.agent || '').toLowerCase();
      const role = (item.role || '').toLowerCase();
      const perksMatch = Array.isArray(item.perks) && item.perks.some(p =>
        (p.name || '').toLowerCase().includes(q) || (p.character || '').toLowerCase().includes(q)
      );
      const agentsMatch = Array.isArray(item.agents) && item.agents.some(a =>
        (a.name || '').toLowerCase().includes(q) || (a.role || '').toLowerCase().includes(q)
      );
      const trackMatch = item.track && (
        (item.track.name || '').toLowerCase().includes(q) ||
        (item.track.artists || item.track.artist || '').toLowerCase().includes(q) ||
        (item.track.albumName || '').toLowerCase().includes(q)
      );
      return u.includes(q) || r.includes(q) || res.includes(q) || killer.includes(q) || agent.includes(q) || role.includes(q) || perksMatch || agentsMatch || trackMatch;
    });
  }, [rollHistory, historySearch]);

  // OBS URL Generation
  const obsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status.overlayToken) {
      params.append('token', status.overlayToken);
    } else if (status.userId) {
      params.append('user', status.userId);
    } else {
      params.append('user', 'default');
    }
    return `${API_BASE}/widgets/${selectedWidget}/index.html?${params.toString()}`;
  }, [selectedWidget, status.overlayToken, status.userId]);

  const previewUrl = useMemo(() => {
    const params = new URLSearchParams({
      preview: '1'
    });
    if (status.overlayToken) params.set('token', status.overlayToken);
    if (status.userId) params.set('user', status.userId);
    if (status.username) params.set('channel', status.username);
    for (const [k, v] of Object.entries(fieldData)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        params.set(k, String(v));
      }
    }
    return `${API_BASE}/widgets/${selectedWidget}/index.html?${params.toString()}`;
  }, [selectedWidget, status.overlayToken, status.userId, status.username, fieldData]);

  const [isRegeneratingToken, setIsRegeneratingToken] = useState(false);
  const handleRegenerateToken = async () => {
    const confirmed = window.confirm(
      'คำเตือนสำคัญ: การรีเซ็ตนี้จะเป็นการเปลี่ยน Secret Key "ทั้งระบบของบัญชีคุณ"\n\n' +
      '- ไม่ใช่แค่เฉพาะ Widget นี้ แต่จะมีผลกับ "ทุก Widget และ OBS Dock ทั้งหมดของคุณ"\n' +
      '- ลิงก์ Browser Source และ Dock เดิมทั้งหมดที่ใส่ไว้ใน OBS จะหยุดทำงานทันที\n' +
      '- ข้อมูลการตั้งค่าต่างๆ (ชื่อแต้ม, สถิติตัวนับ ฯลฯ) จะยังอยู่ครบ ไม่สูญหาย\n' +
      '- คุณจะต้องคัดลอกลิงก์ใหม่ของแต่ละ Widget ไปอัปเดตใน OBS Studio อีกครั้ง\n\n' +
      'คุณต้องการยืนยันการรีเซ็ต Key ทั้งระบบใช่หรือไม่?'
    );
    if (!confirmed) return;
    setIsRegeneratingToken(true);
    try {
      const activeToken = token || localStorage.getItem('solocast_user_token');
      const res = await fetch(`${API_BASE}/api/user/overlay-token/regenerate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      const data = await res.json();
      if (data.success && data.overlayToken) {
        setStatus(prev => ({ ...prev, overlayToken: data.overlayToken }));
        alert('รีเซ็ต Secret Key สำเร็จแล้ว กรุณาคัดลอกลิงก์ใหม่ไปใส่ใน OBS');
      } else {
        alert(data.error || 'รีเซ็ตไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
    } finally {
      setIsRegeneratingToken(false);
    }
  };

  // Copy helper
  const copyText = (txt, type) => {
    navigator.clipboard.writeText(txt);
    if (type === 'obs') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedReward(type);
      setTimeout(() => setCopiedReward(''), 2000);
    }
  };

  const activeWidgetMeta = WIDGET_META[selectedWidget] || {
    name: selectedWidget,
    desc: 'ปรับแต่งการแสดงผลและคำสั่ง',
    icon: <Sliders size={20} />,
    color: '#fd5825'
  };

  const isWidgetUserActive = widgetStatusOverview.user[selectedWidget] === true;

  // Filter fields by query
  const isFieldMatching = (fieldKey, field) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const lbl = (field.label || '').toLowerCase();
    const grp = (field.group || '').toLowerCase();
    const k = fieldKey.toLowerCase();
    return lbl.includes(q) || grp.includes(q) || k.includes(q);
  };

  // Evaluate a field's showIf condition against current fieldData
  const isFieldVisible = (field) => {
    if (!field.showIf) return true;
    for (const [condKey, condVal] of Object.entries(field.showIf)) {
      const currentVal = fieldData[condKey];
      if (Array.isArray(condVal)) {
        if (!condVal.includes(currentVal)) return false;
      } else {
        if (currentVal !== condVal) return false;
      }
    }
    return true;
  };

  // Render Full Dynamic Schema Form
  const renderFullSchemaForm = () => {
    if (!schema) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>กำลังโหลดโครงสร้างการตั้งค่า...</p>
        </div>
      );
    }

    const groups = {};
    for (const key in schema) {
      const field = schema[key];
      const g = field.group || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push({ key, ...field });
    }

    return Object.keys(groups).map(groupName => {
      const visibleFields = groups[groupName].filter(f => f.type !== 'custom' && isFieldVisible(f) && isFieldMatching(f.key, f));
      if (visibleFields.length === 0) return null;

      return (
        <div key={groupName} className="setting-card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ width: '4px', height: '14px', background: 'var(--accent-color)', display: 'inline-block', borderRadius: '2px' }} />
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{groupName}</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {visibleFields.map(field => (
              <div key={field.key} className="schema-field-group">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }} title={field.key}>
                  {field.label}
                </label>

                {(field.type === 'text' || field.type === 'number') && (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={fieldData[field.key] !== undefined ? fieldData[field.key] : ''}
                    onChange={e => handleFieldChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-input)',
                      border: '1px solid var(--border-primary)',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)'
                    }}
                  />
                )}

                {(field.type === 'dropdown' || field.type === 'select') && (
                  <select
                    value={fieldData[field.key] !== undefined ? fieldData[field.key] : (field.value || '')}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-input)',
                      border: '1px solid var(--border-primary)',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)'
                    }}
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
                  <div className="color-swatch-picker">
                    <div className="color-swatch-preview" style={{ background: fieldData[field.key] || '#000000' }}>
                      <input
                        type="color"
                        value={fieldData[field.key] || '#000000'}
                        onChange={e => handleFieldChange(field.key, e.target.value)}
                      />
                    </div>
                    <span className="color-hex-tag">{fieldData[field.key] || '#000000'}</span>
                  </div>
                )}

                {field.type === 'slider' && (
                  <div className="slider-row">
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={fieldData[field.key] !== undefined ? fieldData[field.key] : 0}
                      onChange={e => handleFieldChange(field.key, Number(e.target.value))}
                    />
                    <span className="slider-value-pill">{fieldData[field.key] !== undefined ? fieldData[field.key] : 0}</span>
                  </div>
                )}

                {field.type === 'checkbox' && (
                  <div
                    className="switch-card"
                    style={{ margin: 0 }}
                    onClick={() => handleFieldChange(field.key, !fieldData[field.key])}
                  >
                    <span className="switch-card-label" style={{ fontSize: '0.82rem' }}>
                      {(fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? 'เปิดใช้งาน (Enabled)' : 'ปิดใช้งาน (Disabled)'}
                    </span>
                    <div className={`switch-pill ${(fieldData[field.key] !== undefined ? fieldData[field.key] : field.value) ? 'is-on' : ''}`}>
                      <div className="switch-pill-knob" />
                    </div>
                  </div>
                )}

                {field.type === 'sound-input' && (
                  <input
                    type="text"
                    placeholder="URL ไฟล์เสียง (เว้นว่างไว้ถ้าไม่ต้องการเสียง)"
                    value={fieldData[field.key] || ''}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-input)',
                      border: '1px solid var(--border-primary)',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem'
                    }}
                  />
                )}

                {(field.type === 'image-input' || field.type === 'image') && (
                  <input
                    type="text"
                    placeholder="URL รูปภาพ (เช่น https://... หรือเว้นว่างไว้)"
                    value={fieldData[field.key] !== undefined ? fieldData[field.key] : (field.value || '')}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-input)',
                      border: '1px solid var(--border-primary)',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem'
                    }}
                  />
                )}

                {field.type === 'textarea' && (
                  <textarea
                    rows={3}
                    placeholder="กรอกข้อความ..."
                    value={fieldData[field.key] !== undefined ? fieldData[field.key] : (field.value || '')}
                    onChange={e => handleFieldChange(field.key, e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--surface-input)',
                      border: '1px solid var(--border-primary)',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)'
                    }}
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
        </div>
      );
    });
  };

  // Spotify Account Connection Banner
  const renderSpotifyConnectionBanner = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
      {/* Spotify Notification Alert */}
      {spotifyMsg.text && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: 'var(--radius-sm)',
          background: spotifyMsg.type === 'error' ? 'rgba(255, 69, 58, 0.12)' : 'rgba(48, 209, 88, 0.12)',
          border: spotifyMsg.type === 'error' ? '1px solid rgba(255, 69, 58, 0.3)' : '1px solid rgba(48, 209, 88, 0.3)',
          color: spotifyMsg.type === 'error' ? '#FF453A' : '#30D158',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {spotifyMsg.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
            <span>{spotifyMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSpotifyMsg({ type: '', text: '' })}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Spotify Connection Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(29, 185, 84, 0.08), rgba(20, 20, 26, 0.8))',
        border: '1px solid rgba(29, 185, 84, 0.25)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1DB954, #158a3e)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(29, 185, 84, 0.35)',
            flexShrink: 0
          }}>
            <Music size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#fff', fontWeight: 700 }}>
                Spotify Song Request
              </h4>
              {spotifyStatus.connected ? (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#1DB954',
                  background: 'rgba(29, 185, 84, 0.15)',
                  border: '1px solid rgba(29, 185, 84, 0.35)',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1DB954' }} />
                  เชื่อมต่อแล้ว
                </span>
              ) : (
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  padding: '2px 8px',
                  borderRadius: '100px'
                }}>
                  ยังไม่ได้เชื่อมต่อ
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              {spotifyStatus.connected
                ? `บัญชี Spotify: ${spotifyStatus.displayName || 'กำลังใช้งาน'} ${spotifyStatus.product ? `(${spotifyStatus.product})` : ''}`
                : 'เชื่อมต่อกับบัญชี Spotify ของคุณเพื่อให้ผู้ชมสามารถพิมพ์ !sr ในแชท Twitch ได้ทันที'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {spotifyStatus.connected ? (
            <>
              <button
                type="button"
                onClick={handleConnectSpotify}
                disabled={spotifyLoading}
                className="btn-island"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                title="เชื่อมต่อใหม่อีกครั้ง"
              >
                <RotateCw size={13} />
                <span>เชื่อมต่อใหม่</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnectSpotify}
                disabled={spotifyLoading}
                className="btn-island"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', color: '#FF453A', borderColor: 'rgba(255, 69, 58, 0.3)' }}
              >
                <LogOut size={13} />
                <span>ยกเลิกการเชื่อมต่อ</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnectSpotify}
              disabled={spotifyLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 1.15rem',
                background: 'linear-gradient(135deg, #1DB954, #158a3e)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(29, 185, 84, 0.3)'
              }}
            >
              {spotifyLoading ? <Loader2 size={16} className="spin" /> : <Music size={16} />}
              <span>เชื่อมต่อกับ Spotify</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="secret-settings-page">
      {/* Update Announcement Modal */}
      <UpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
      />

      {/* Prominent Security Notice Banner */}
      <div
        className="animate-fade-up"
        style={{
          margin: '0 0 1rem 0',
          padding: '0.8rem 1.25rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.1))',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.88rem', color: '#f87171' }}>
                แจ้งเตือนสำคัญ: รบกวนเปลี่ยนลิงก์ใน OBS ใหม่นะครับ
              </strong>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '999px',
                  background: 'rgba(239, 68, 68, 0.25)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.5)'
                }}
              >
                ต้องเปลี่ยนลิงก์
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              ระบบเพิ่มกุญแจลับป้องกันคนอื่นแกล้ง ลิงก์เดิมใช้งานไม่ได้แล้ว รบกวนคัดลอกลิงก์ใหม่จากแท็บนี้ไปใส่ใน OBS Studio นะครับ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowUpdateModal(true)}
          className="btn-island"
          style={{
            padding: '0.4rem 0.85rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            background: 'rgba(239, 68, 68, 0.18)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            cursor: 'pointer'
          }}
        >
          ดูวิธีเปลี่ยนลิงก์แบบง่ายๆ
        </button>
      </div>

      {/* ── Top Header ── */}
      <div className="secret-header">
        <div className="secret-header-left">
          <div className="secret-header-icon">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="secret-header-title">
              <span>แผงควบคุม</span>
              <span className="secret-badge">Pro Studio</span>
              <button
                type="button"
                onClick={() => setShowUpdateModal(true)}
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  cursor: 'pointer',
                  marginLeft: '6px'
                }}
                title="คลิกเพื่อดูประกาศความปลอดภัย v1.4.0"
              >
                v1.4.0 UPDATE
              </button>
            </div>
            <p className="secret-header-desc">
              ระบบตั้งค่าวิดเจ็ตสตรีมเมอร์แบบเต็มรูปแบบ
            </p>
          </div>
        </div>

        <div className="secret-header-actions">
          {/* Reset to Defaults button */}
          <button
            type="button"
            className="btn-island"
            onClick={handleResetToDefaults}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            title="คืนค่าการตั้งค่าทั้งหมดของ Widget นี้กลับเป็นค่าเริ่มต้น"
          >
            <RotateCcw size={15} />
            <span>คืนค่าเริ่มต้น</span>
          </button>

          {/* Switcher Button */}
          <button
            type="button"
            className="btn-island select-widget-btn"
            onClick={() => setIsSwitcherOpen(true)}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            title="เปิดหน้าต่างเลือก Widget ทั้งหมด"
          >
            <LayoutGrid size={16} />
            <span>เลือก Widget ({widgets.length})</span>
          </button>

          {/* Back to Overlays Gallery */}
          <button
            type="button"
            className="btn-island"
            onClick={() => navigate('/dashboard')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} />
            <span>กลับหน้ารวม Overlays</span>
          </button>
        </div>
      </div>

      {/* ── Main Split Studio ── */}
      <div className="studio-split-container">
        {/* Left Column: Redesigned Settings Panel */}
        <div className="settings-outer-shell">
          <div className="settings-inner-core">
            {/* Active Widget Hero Bar */}
            <div className="active-widget-bar">
              <div className="active-widget-top-row">
                <button
                  type="button"
                  className="active-widget-trigger-card"
                  onClick={() => setIsSwitcherOpen(true)}
                  title="คลิกเพื่อเลือกหรือสลับ Widget อื่น"
                >
                  <div className="active-widget-icon-large" style={{ background: activeWidgetMeta.gradient || activeWidgetMeta.color }}>
                    {activeWidgetMeta.icon}
                  </div>
                  <div className="active-widget-details">
                    <div className="active-widget-title-row">
                      <h2 className="active-widget-title">{activeWidgetMeta.name}</h2>
                      <ChevronDown size={18} className="switcher-dropdown-chevron" />
                      <span className="secret-badge" style={{
                        background: isWidgetUserActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: isWidgetUserActive ? '#10b981' : '#f87171',
                        borderColor: isWidgetUserActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                      }}>
                        {isWidgetUserActive ? 'Live บน Stream' : 'ปิดอยู่'}
                      </span>
                    </div>
                    <p className="active-widget-desc">{activeWidgetMeta.desc}</p>
                  </div>
                </button>

                {/* History Button - Positioned in the top right corner as requested */}
                <button
                  type="button"
                  className={`active-widget-history-btn ${activeCategory === 'history' ? 'active' : ''}`}
                  onClick={() => {
                    if (activeCategory === 'history') {
                      setActiveCategory('quick');
                    } else {
                      setActiveCategory('history');
                    }
                  }}
                  title="คลิกเพื่อดูประวัติการแลกแต้มและการสุ่มทั้งหมด"
                >
                  <History size={16} />
                  <span>ประวัติแลกแต้ม</span>
                  <span className="active-widget-history-badge">
                    {rollHistory.length}
                  </span>
                </button>
              </div>

              <div className="active-widget-bottom-row">
                <div className="widget-quick-nav">
                  <button
                    type="button"
                    className="widget-nav-arrow-btn"
                    onClick={handlePrevWidget}
                    title="วิดเจ็ตก่อนหน้า"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className="widget-nav-picker-btn"
                    onClick={() => setIsSwitcherOpen(true)}
                    title="เปิดหน้าต่างเลือก Widget"
                  >
                    <LayoutGrid size={15} />
                    <span>เปลี่ยน Widget</span>
                  </button>
                  <button
                    type="button"
                    className="widget-nav-arrow-btn"
                    onClick={handleNextWidget}
                    title="วิดเจ็ตถัดไป"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Status Toggle Button */}
                <button
                  type="button"
                  onClick={handleToggleWidget}
                  className="btn-island"
                  style={{
                    padding: '0.45rem 0.95rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    background: isWidgetUserActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: isWidgetUserActive ? '#f87171' : '#34d399',
                    borderColor: isWidgetUserActive ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Power size={14} />
                  <span>{isWidgetUserActive ? 'ปิดวิดเจ็ตนี้' : 'เปิดใช้งานวิดเจ็ต'}</span>
                </button>
              </div>
            </div>

            {/* Category Navigation Tabs */}
            <div className="category-tabs-nav">
              <button
                type="button"
                className={`category-tab-btn ${activeCategory === 'quick' ? 'active' : ''}`}
                onClick={() => setActiveCategory('quick')}
              >
                <Flame size={16} />
                <span>ตั้งค่าด่วน (Quick)</span>
              </button>
              <button
                type="button"
                className={`category-tab-btn ${activeCategory === 'design' ? 'active' : ''}`}
                onClick={() => setActiveCategory('design')}
              >
                <Palette size={16} />
                <span>ธีม & รูปลักษณ์</span>
              </button>
              <button
                type="button"
                className={`category-tab-btn ${activeCategory === 'twitch' ? 'active' : ''}`}
                onClick={() => setActiveCategory('twitch')}
              >
                <Megaphone size={16} />
                <span>แต้ม Twitch & แชท</span>
              </button>
              <button
                type="button"
                className={`category-tab-btn ${activeCategory === 'content' ? 'active' : ''}`}
                onClick={() => setActiveCategory('content')}
              >
                <Layers size={16} />
                <span>กฎ & ตัวควบคุม</span>
              </button>
              <button
                type="button"
                className={`category-tab-btn ${activeCategory === 'audio' ? 'active' : ''}`}
                onClick={() => setActiveCategory('audio')}
              >
                <Volume2 size={16} />
                <span>เสียง & SFX</span>
              </button>
              <button
                type="button"
                className={`category-tab-btn ${activeCategory === 'obs' ? 'active' : ''}`}
                onClick={() => setActiveCategory('obs')}
              >
                <Tv size={16} />
                <span>นำไปใช้ใน OBS</span>
              </button>
              <button
                type="button"
                className={`category-tab-btn ${activeCategory === 'history' ? 'active' : ''}`}
                onClick={() => setActiveCategory('history')}
              >
                <History size={16} />
                <span>ประวัติกิจกรรม</span>
                {rollHistory.length > 0 && (
                  <span className="tab-badge">{rollHistory.length}</span>
                )}
              </button>
              <button
                type="button"
                className={`category-tab-btn ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                <Sliders size={16} />
                <span>การตั้งค่าทั้งหมด</span>
              </button>
            </div>

            {/* Quick Search inside settings */}
            <div className="settings-search-bar">
              <Search size={16} />
              <input
                type="text"
                placeholder="ค้นหาการตั้งค่าทั้งหมดในหน้านี้ (เช่น สี, เสียง, ขนาด, reward, คำสั่ง)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* ── TAB 1: QUICK START ── */}
            {activeCategory === 'quick' && (
              <div className="animate-fade-up">
                {/* Spotify Account Connection Card (Quick Start) */}
                {selectedWidget === 'spotify-sr' && renderSpotifyConnectionBanner()}

                {/* Spotify Chat Command (Quick Start) */}
                {selectedWidget === 'spotify-sr' && schema?.commandPrefix && (
                  <div className="setting-card">
                    <div className="setting-card-header">
                      <div>
                        <h4 className="setting-card-title">คำสั่งพิมพ์ขอผ่าน Twitch Chat</h4>
                        <p className="setting-card-desc">
                          ผู้ชมสามารถพิมพ์คำสั่งนี้ใน Twitch Chat เพื่อขอเพลง (เช่น <code>{fieldData.commandPrefix || '!sr'} Sunflower</code> หรือวางลิงก์ Spotify)
                        </p>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.65rem' }}>
                      <input
                        type="text"
                        value={fieldData.commandPrefix || '!sr'}
                        onChange={e => handleFieldChange('commandPrefix', e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--surface-input)',
                          border: '1px solid var(--border-primary)',
                          padding: '0.6rem 0.85rem',
                          borderRadius: 'var(--radius-md)',
                          fontFamily: 'monospace',
                          fontSize: '0.9rem',
                          color: 'var(--accent-color)'
                        }}
                        placeholder="!sr"
                      />
                    </div>
                  </div>
                )}

                {/* 1. Twitch Channel Point Reward Banner */}
                {(schema?.rewardName || schema?.rewardNameSurvivor || schema?.channelPointsReward) && selectedWidget !== 'custom-counter' && selectedWidget !== 'spotify-sr' && (
                  <div className="reward-setup-banner">
                    <div className="reward-setup-title">
                      <Sparkles size={18} />
                      <span>ชื่อรางวัล Twitch Channel Points ที่ใช้แลก</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#e9d5ff', lineHeight: 1.5 }}>
                      เมื่อผู้ชมกดแลกแต้มใน Twitch ด้วยชื่อนี้ ระบบจะตอบสนองและแสดงผลบนจอ OBS ทันที
                    </p>

                    {schema?.rewardName && (
                      <div className="reward-input-box">
                        <input
                          type="text"
                          value={fieldData.rewardName || ''}
                          onChange={e => handleFieldChange('rewardName', e.target.value)}
                          placeholder="ชื่อ Reward ใน Twitch..."
                        />
                        <button
                          type="button"
                          className="btn-island"
                          onClick={() => copyText(fieldData.rewardName || '', 'rewardName')}
                          style={{ padding: '0.65rem 1rem', fontSize: '0.82rem', background: '#9146ff', color: '#fff' }}
                        >
                          {copiedReward === 'rewardName' ? <Check size={15} /> : <Copy size={15} />}
                          <span>{copiedReward === 'rewardName' ? 'คัดลอกแล้ว' : 'คัดลอกชื่อ'}</span>
                        </button>
                        <button
                          type="button"
                          className="btn-island accent"
                          onClick={handleSimulate}
                          title="จำลองว่ามีผู้ชมกดแลกแต้ม"
                          style={{ padding: '0.65rem 1rem', fontSize: '0.82rem' }}
                        >
                          <Play size={15} />
                          <span>ลองจำลอง</span>
                        </button>
                      </div>
                    )}

                    {schema?.rewardNameSurvivor && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                          สุ่ม Survivor (ผู้รอดชีวิต):
                        </label>
                        <div className="reward-input-box">
                          <input
                            type="text"
                            value={fieldData.rewardNameSurvivor || ''}
                            onChange={e => handleFieldChange('rewardNameSurvivor', e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn-island"
                            onClick={() => copyText(fieldData.rewardNameSurvivor || '', 'rewardSurvivor')}
                            style={{ padding: '0.65rem 1rem', fontSize: '0.82rem' }}
                          >
                            {copiedReward === 'rewardSurvivor' ? <Check size={15} /> : <Copy size={15} />}
                            <span>คัดลอก</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {schema?.rewardNameKiller && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                          สุ่ม Killer (ฆาตกร):
                        </label>
                        <div className="reward-input-box">
                          <input
                            type="text"
                            value={fieldData.rewardNameKiller || ''}
                            onChange={e => handleFieldChange('rewardNameKiller', e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn-island"
                            onClick={() => copyText(fieldData.rewardNameKiller || '', 'rewardKiller')}
                            style={{ padding: '0.65rem 1rem', fontSize: '0.82rem' }}
                          >
                            {copiedReward === 'rewardKiller' ? <Check size={15} /> : <Copy size={15} />}
                            <span>คัดลอก</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Quick Test & Roll Action Card */}
                {selectedWidget !== 'spotify-sr' && (
                  <div className="setting-card">
                    <div className="setting-card-header">
                      <div>
                        <h4 className="setting-card-title">ทดสอบการทำงานและสุ่มผลลัพธ์ (Quick Actions & Test Roll)</h4>
                        <p className="setting-card-desc">คลิกปุ่มเพื่อทดสอบให้กราฟิกแสดงผลขึ้นบน OBS หรือ Live Preview ทันที</p>
                      </div>
                    </div>
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
                    {selectedWidget === 'dbd-perks' && (
                      <>
                        <button
                          type="button"
                          className="btn-island accent"
                          onClick={() => handleTriggerPreview('survivor')}
                        >
                          <Play size={15} />
                          <span>สุ่มเปิร์ค Survivor</span>
                        </button>
                        <button
                          type="button"
                          className="btn-island"
                          onClick={() => handleTriggerPreview('killer')}
                        >
                          <Skull size={15} />
                          <span>สุ่มเปิร์ค Killer</span>
                        </button>
                      </>
                    )}
                    {selectedWidget === 'random-killer' && (
                      <button
                        type="button"
                        className="btn-island accent"
                        onClick={() => handleTriggerPreview()}
                      >
                        <Skull size={15} />
                        <span>สุ่มฆาตกร (Roll Killer)</span>
                      </button>
                    )}
                    {selectedWidget === 'valorant-agent' && (
                      <>
                        <button
                          type="button"
                          className="btn-island accent"
                          onClick={() => handleRollValorant('single')}
                          disabled={isRollingValorant}
                        >
                          <Crosshair size={15} />
                          <span>สุ่มเดี่ยว (Solo Agent)</span>
                        </button>
                        <button
                          type="button"
                          className="btn-island"
                          onClick={() => handleRollValorant('team')}
                          disabled={isRollingValorant}
                        >
                          <Users size={15} />
                          <span>สุ่มทีม 5 คน (Team Comp)</span>
                        </button>
                      </>
                    )}
                    {selectedWidget === 'custom-counter' && (
                      <>
                        <button
                          type="button"
                          className="btn-island accent"
                          onClick={() => handleCounterStep(1)}
                        >
                          <Plus size={15} />
                          <span>+1 เพิ่มคะแนน</span>
                        </button>
                        <button
                          type="button"
                          className="btn-island"
                          onClick={() => handleCounterStep(-1)}
                        >
                          <Minus size={15} />
                          <span>-1 ลดคะแนน</span>
                        </button>
                      </>
                    )}
                    {selectedWidget === 'loyalty-card' && (
                      <button
                        type="button"
                        className="btn-island accent"
                        onClick={handleSimulate}
                      >
                        <Ticket size={15} />
                        <span>จำลองการเช็คอิน (Test Check-in)</span>
                      </button>
                    )}
                    {selectedWidget === 'twitch-shoutout' && (
                      <>
                        <button
                          type="button"
                          className="btn-island accent"
                          onClick={() => handleTriggerPreview(null, false)}
                        >
                          <Megaphone size={15} />
                          <span>ทดสอบ Shoutout แนะนำช่อง</span>
                        </button>
                        <button
                          type="button"
                          className="btn-island"
                          style={{ borderColor: 'rgba(168, 85, 247, 0.4)', color: '#c084fc' }}
                          onClick={() => handleTriggerPreview(null, true)}
                        >
                          <Radio size={15} />
                          <span>จำลองมีคนเรดมา (Test Raid)</span>
                        </button>
                      </>
                    )}
                    {selectedWidget === 'spotify-sr' && (
                      <button
                        type="button"
                        className="btn-island accent"
                        onClick={() => handleTriggerPreview()}
                      >
                        <Music size={15} />
                        <span>ส่งเพลงตัวอย่างขึ้นหน้าจอ</span>
                      </button>
                    )}
                    {selectedWidget === 'dbd-scoreboard' && (
                      <>
                        <button
                          type="button"
                          className="btn-island accent"
                          onClick={() => handleScoreboardUpdate('win')}
                        >
                          <Trophy size={15} />
                          <span>+1 Win (Kills)</span>
                        </button>
                        <button
                          type="button"
                          className="btn-island"
                          onClick={() => handleScoreboardUpdate('draw')}
                        >
                          <span>+1 Draw</span>
                        </button>
                        <button
                          type="button"
                          className="btn-island"
                          onClick={() => handleScoreboardUpdate('lose')}
                        >
                          <span>+1 Escape</span>
                        </button>
                      </>
                    )}
                    </div>
                    <div style={{
                      marginTop: '0.85rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)'
                    }}>
                      <Info size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                      <span>หากเทสแล้วผลลัพธ์ไม่ขึ้น โปรดตรวจเช็คว่าได้เปิดใช้งาน widget นั้นแล้วหรือไม่</span>
                    </div>
                  </div>
                )}

                {/* 3. Visual Overlay Toggle Card */}
                {schema?.enableVisualOverlay && (
                  <div
                    className="switch-card"
                    style={{ marginBottom: '1rem' }}
                    onClick={() => handleFieldChange('enableVisualOverlay', !fieldData.enableVisualOverlay)}
                  >
                    <div className="switch-card-info">
                      <span className="switch-card-label">แสดงกราฟิก Pop-up บนจอ OBS</span>
                      <span className="switch-card-desc">หากปิดไว้ จะทำงานเฉพาะเสียงหรือส่งผลลงแชทเท่านั้น ไม่บังหน้าจอเกม</span>
                    </div>
                    <div className={`switch-pill ${fieldData.enableVisualOverlay ? 'is-on' : ''}`}>
                      <div className="switch-pill-knob" />
                    </div>
                  </div>
                )}

                {/* 4. Send to Twitch Chat Toggle Card */}
                {(schema?.enableChat || schema?.enableChatMsg || schema?.enableChatReply) && (
                  <div
                    className="switch-card"
                    style={{ marginBottom: '1rem' }}
                    onClick={() => {
                      const chatKey = schema?.enableChatMsg ? 'enableChatMsg' : schema?.enableChatReply ? 'enableChatReply' : 'enableChat';
                      handleFieldChange(chatKey, !fieldData[chatKey]);
                    }}
                  >
                    <div className="switch-card-info">
                      <span className="switch-card-label">ส่งผลลัพธ์หรือข้อความตอบกลับลง Twitch Chat</span>
                      <span className="switch-card-desc">ให้บอทพิมพ์ข้อความยืนยันลงในแชทให้ผู้ชมเห็นทันที</span>
                    </div>
                    <div className={`switch-pill ${(schema?.enableChatMsg ? fieldData.enableChatMsg : schema?.enableChatReply ? fieldData.enableChatReply : fieldData.enableChat) ? 'is-on' : ''}`}>
                      <div className="switch-pill-knob" />
                    </div>
                  </div>
                )}

                {/* 5. Quick OBS Setup Card */}
                <div className="setting-card">
                  <div className="setting-card-header">
                    <div>
                      <h4 className="setting-card-title">ลิงก์สำหรับใส่ใน OBS Studio</h4>
                      <p className="setting-card-desc">คัดลอกลิงก์นี้ไปใส่ใน Browser Source ของ OBS</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={obsUrl}
                      style={{
                        flex: 1,
                        background: 'var(--surface-input)',
                        border: '1px solid var(--border-primary)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace',
                        color: 'var(--text-secondary)'
                      }}
                    />
                    <button
                      type="button"
                      className="btn-island"
                      onClick={handleRegenerateToken}
                      disabled={isRegeneratingToken}
                      title="รีเซ็ต Secret Key ใหม่ (ลิงก์เดิมที่เคยแชร์จะหยุดทำงานทันที)"
                      style={{
                        padding: '0.65rem 0.95rem',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <RefreshCw size={14} className={isRegeneratingToken ? 'spin' : ''} />
                      <span>{isRegeneratingToken ? 'กำลังรีเซ็ต...' : 'รีเซ็ต Key'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-island accent"
                      onClick={() => copyText(obsUrl, 'obs')}
                      style={{ padding: '0.65rem 1.15rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                    >
                      {copiedUrl ? <Check size={15} /> : <Copy size={15} />}
                      <span>{copiedUrl ? 'คัดลอกแล้ว!' : 'คัดลอก URL'}</span>
                    </button>
                  </div>
                </div>

                {/* 6. All Settings Guidance Notice */}
                <div className="quick-all-settings-notice" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Info size={17} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                      <span>หากหาการตั้งค่าไหนไม่เจอ ให้ดูที่แท็บ <strong>"การตั้งค่าทั้งหมด"</strong></span>
                    </div>
                    <button
                      type="button"
                      className="btn-island"
                      onClick={() => setActiveCategory('all')}
                      style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      <Sliders size={14} />
                      <span>ไปที่การตั้งค่าทั้งหมด</span>
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.65rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <AlertCircle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span>หากเทสแล้วผลลัพธ์ไม่ขึ้น โปรดตรวจเช็คว่าได้เปิดใช้งาน widget นั้นแล้วหรือไม่</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: DESIGN & THEMES ── */}
            {activeCategory === 'design' && (
              <div className="animate-fade-up">
                {/* Theme Presets */}
                {(schema?.themePreset || schema?.theme) && (
                  <div className="setting-card">
                    <h4 className="setting-card-title">สกินและธีมการแสดงผล (Theme Presets)</h4>
                    <p className="setting-card-desc">คลิกเลือกธีมที่เข้ากับสไตล์การสตรีมของคุณ</p>
                    <div className="preset-grid">
                      {Object.entries((schema.themePreset || schema.theme).options || {}).map(([val, label]) => {
                        const currentVal = fieldData.themePreset || fieldData.theme;
                        const isSelected = currentVal === val;
                        const preset = THEME_PRESETS[val] || { bg: 'linear-gradient(135deg, #334155, #0f172a)' };

                        return (
                          <div
                            key={val}
                            className={`preset-card ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              if (schema.themePreset) handleFieldChange('themePreset', val);
                              if (schema.theme) handleFieldChange('theme', val);
                            }}
                          >
                            <div className="preset-card-preview" style={{ background: preset.bg }} />
                            <span className="preset-card-name">{typeof label === 'string' ? label : val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sizing & Scale Slider */}
                {(schema?.photoSize || schema?.iconScale || schema?.scale) && (() => {
                  const sizeKey = schema.photoSize ? 'photoSize' : schema.iconScale ? 'iconScale' : 'scale';
                  const field = schema[sizeKey];
                  const currentSize = fieldData[sizeKey] !== undefined ? fieldData[sizeKey] : field.value;

                  return (
                    <div className="setting-card">
                      <div className="setting-card-header">
                        <div>
                          <h4 className="setting-card-title">{field.label || 'ขนาดกราฟิก (Size / Scale)'}</h4>
                          <p className="setting-card-desc">ปรับขนาดการแสดงผลให้พอดีกับจอเกมของคุณ</p>
                        </div>
                        <div className="slider-presets-row">
                          <button
                            type="button"
                            className="slider-preset-btn"
                            onClick={() => handleFieldChange(sizeKey, field.min || 200)}
                          >
                            เล็ก
                          </button>
                          <button
                            type="button"
                            className="slider-preset-btn"
                            onClick={() => handleFieldChange(sizeKey, Math.round(((field.min || 200) + (field.max || 600)) / 2))}
                          >
                            กลาง
                          </button>
                          <button
                            type="button"
                            className="slider-preset-btn"
                            onClick={() => handleFieldChange(sizeKey, field.max || 600)}
                          >
                            ใหญ่
                          </button>
                        </div>
                      </div>

                      <div className="slider-row">
                        <input
                          type="range"
                          min={field.min || 100}
                          max={field.max || 800}
                          step={field.step || 10}
                          value={currentSize}
                          onChange={e => handleFieldChange(sizeKey, Number(e.target.value))}
                        />
                        <span className="slider-value-pill">{currentSize}px</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Color Swatches Grid */}
                <div className="setting-card">
                  <h4 className="setting-card-title">สีและแสงออร่า (Color Palette)</h4>
                  <p className="setting-card-desc">ปรับแต่งโทนสีของข้อความและเส้นขอบ</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.85rem' }}>
                    {Object.entries(schema || {}).filter(([k, f]) => f.type === 'colorpicker' && isFieldMatching(k, f)).map(([key, field]) => (
                      <div key={key} className="color-field-row">
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {field.label}
                        </span>
                        <div className="color-swatch-picker">
                          <div className="color-swatch-preview" style={{ background: fieldData[key] || '#ffffff' }}>
                            <input
                              type="color"
                              value={fieldData[key] || '#ffffff'}
                              onChange={e => handleFieldChange(key, e.target.value)}
                            />
                          </div>
                          <span className="color-hex-tag">{fieldData[key] || '#ffffff'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Display Toggles */}
                <div className="setting-card">
                  <h4 className="setting-card-title">การแสดงองค์ประกอบบนหน้าจอ (Display Components)</h4>
                  <p className="setting-card-desc">เปิดหรือปิดเฉพาะส่วนที่ต้องการให้แสดง</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.85rem' }}>
                    {Object.entries(schema || {}).filter(([k, f]) => f.type === 'checkbox' && (k.startsWith('show') || k === 'enableTextShadow' || k === 'enableVisualOverlay' || k.toLowerCase().includes('display')) && isFieldMatching(k, f)).map(([key, field]) => (
                      <div
                        key={key}
                        className="switch-card"
                        onClick={() => handleFieldChange(key, !fieldData[key])}
                      >
                        <span className="switch-card-label">{field.label}</span>
                        <div className={`switch-pill ${fieldData[key] ? 'is-on' : ''}`}>
                          <div className="switch-pill-knob" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: TWITCH & CHAT ── */}
            {activeCategory === 'twitch' && (
              <div className="animate-fade-up">
                {/* Reward Matching Instructions */}
                {selectedWidget !== 'custom-counter' && selectedWidget !== 'spotify-sr' && (schema?.rewardName || schema?.rewardNameSurvivor || schema?.channelPointsReward) && (
                  <div className="setting-card" style={{ borderLeft: '4px solid #9146ff' }}>
                    <h4 className="setting-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#c084fc' }}>
                      <Sparkles size={18} />
                      <span>คำแนะนำการผูกกับ Twitch Channel Points</span>
                    </h4>
                    <ol style={{ margin: '0.5rem 0 0 1.25rem', padding: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <li>ไปที่ <strong>Twitch Creator Dashboard &gt; Viewer Rewards &gt; Channel Points</strong></li>
                      <li>กด <strong>Create a Custom Reward</strong></li>
                      <li>ตั้งชื่อให้ <strong>ตรงกับชื่อในกล่องด้านล่างนี้ 100%</strong> (สามารถกดปุ่ม "คัดลอก" เพื่อนำไปวางได้ทันที)</li>
                    </ol>
                  </div>
                )}

                {/* Chat Command Prefix */}
                {schema?.commandPrefix && (
                  <div className="setting-card">
                    <h4 className="setting-card-title">คำสั่งพิมพ์ขอผ่าน Twitch Chat</h4>
                    <p className="setting-card-desc">ผู้ชมสามารถพิมพ์คำสั่งนี้ในแชทเพื่อใช้งานได้</p>
                    <div style={{ marginTop: '0.65rem' }}>
                      <input
                        type="text"
                        value={fieldData.commandPrefix || '!sr'}
                        onChange={e => handleFieldChange('commandPrefix', e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--surface-input)',
                          border: '1px solid var(--border-primary)',
                          padding: '0.6rem 0.85rem',
                          borderRadius: 'var(--radius-md)',
                          fontFamily: 'monospace',
                          fontSize: '0.9rem',
                          color: 'var(--accent-color)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Triggers & Chat Switches */}
                {Object.entries(schema || {}).filter(([k, f]) => f.type === 'checkbox' && (k.toLowerCase().includes('chat') || k.toLowerCase().includes('channelpoints') || k.toLowerCase().includes('trigger')) && isFieldMatching(k, f)).length > 0 && (
                  <div className="setting-card">
                    <h4 className="setting-card-title">การเปิดใช้งานในแชทและแต้มช่อง (Triggers & Commands)</h4>
                    <p className="setting-card-desc">เลือกเปิดหรือปิดระบบการตอบสนองต่อผู้ชม</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.85rem' }}>
                      {Object.entries(schema || {}).filter(([k, f]) => f.type === 'checkbox' && (k.toLowerCase().includes('chat') || k.toLowerCase().includes('channelpoints') || k.toLowerCase().includes('trigger')) && isFieldMatching(k, f)).map(([key, field]) => (
                        <div
                          key={key}
                          className="switch-card"
                          onClick={() => handleFieldChange(key, !fieldData[key])}
                        >
                          <span className="switch-card-label">{field.label}</span>
                          <div className={`switch-pill ${fieldData[key] ? 'is-on' : ''}`}>
                            <div className="switch-pill-knob" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat Template */}
                {(schema?.chatTemplate || schema?.chatMsgTemplate) && (
                  <div className="setting-card">
                    <h4 className="setting-card-title">ข้อความที่บอทจะพิมพ์ตอบกลับในแชท (Chat Template)</h4>
                    <p className="setting-card-desc">ใช้ตัวแปรในวงเล็บปีกกาเพื่อแทนที่ค่าที่สุ่มหรือเช็คอินได้</p>
                    <div style={{ marginTop: '0.65rem' }}>
                      <input
                        type="text"
                        value={fieldData[schema?.chatMsgTemplate ? 'chatMsgTemplate' : 'chatTemplate'] || ''}
                        onChange={e => handleFieldChange(schema?.chatMsgTemplate ? 'chatMsgTemplate' : 'chatTemplate', e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--surface-input)',
                          border: '1px solid var(--border-primary)',
                          padding: '0.6rem 0.85rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.85rem'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
                      {['{user}', '{count}', '{remaining}', '{username}', '{role}', '{killer}', '{perks}', '{agent}'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          className="slider-preset-btn"
                          onClick={() => {
                            const tKey = schema?.chatMsgTemplate ? 'chatMsgTemplate' : 'chatTemplate';
                            handleFieldChange(tKey, (fieldData[tKey] || '') + ' ' + tag);
                          }}
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 4: CONTENT & LIVE CONTROLLERS / RULES ── */}
            {activeCategory === 'content' && (
              <div className="animate-fade-up">
                {/* 1. DBD Scoreboard Live Controller Pad */}
                {selectedWidget === 'dbd-scoreboard' && (
                  <div className="dbd-scoreboard-control-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #e11d48, #9f1239)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          boxShadow: '0 4px 12px rgba(225, 29, 72, 0.35)'
                        }}>
                          <Trophy size={20} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            แผงควบคุมสถิติ DBD Scoreboard (Live Killer Scores)
                          </h4>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            คลิกเพื่อปรับสกอร์ หรือพิมพ์คำสั่งในแชท Twitch เพื่อซิงค์ขึ้น OBS ทันที
                          </span>
                        </div>
                      </div>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-secondary)',
                        borderRadius: '9999px',
                        padding: '0.35rem 0.85rem'
                      }}>
                        <span style={{ fontSize: '0.78rem', color: '#e11d48', fontWeight: 700 }}>คำสั่งหลัก:</span>
                        <code style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 800 }}>
                          {fieldData.scoreCmd || '!score'} ({fieldData.kwinCmd || '!kwin'} / {fieldData.kdrawCmd || '!kdraw'} / {fieldData.kloseCmd || '!klose'})
                        </code>
                      </div>
                    </div>

                    {/* 3 Big Stat Cards */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1.25rem'
                    }}>
                      {/* KILLS */}
                      <div className="dbd-score-stat-card" style={{ borderTop: '3px solid #ef4444' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          {fieldData.killerStat1Title || 'KILLS'}
                        </span>
                        <span className="dbd-score-number">
                          {scoreboardData.killerKills || 0}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                          <button
                            type="button"
                            onClick={() => handleScoreboardUpdate('win')}
                            className="dbd-score-btn-main"
                          >
                            +1 Win
                          </button>
                          <button
                            type="button"
                            onClick={() => handleScoreboardUpdate('undo_win')}
                            className="dbd-score-btn-undo"
                            title="Undo 1 Kill"
                          >
                            -1
                          </button>
                        </div>
                      </div>

                      {/* DRAWS */}
                      <div className="dbd-score-stat-card" style={{ borderTop: '3px solid #f59e0b' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#d97706', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          {fieldData.killerStat3Title || 'DRAWS'}
                        </span>
                        <span className="dbd-score-number">
                          {scoreboardData.killerDraws || 0}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                          <button
                            type="button"
                            onClick={() => handleScoreboardUpdate('draw')}
                            className="dbd-score-btn-main"
                          >
                            +1 Draw
                          </button>
                          <button
                            type="button"
                            onClick={() => handleScoreboardUpdate('undo_draw')}
                            className="dbd-score-btn-undo"
                            title="Undo 1 Draw"
                          >
                            -1
                          </button>
                        </div>
                      </div>

                      {/* ESCAPES */}
                      <div className="dbd-score-stat-card" style={{ borderTop: '3px solid #3b82f6' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#2563eb', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                          {fieldData.killerStat2Title || 'ESCAPES'}
                        </span>
                        <span className="dbd-score-number">
                          {scoreboardData.killerEscapes || 0}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                          <button
                            type="button"
                            onClick={() => handleScoreboardUpdate('lose')}
                            className="dbd-score-btn-main"
                          >
                            +1 Loss
                          </button>
                          <button
                            type="button"
                            onClick={() => handleScoreboardUpdate('undo_lose')}
                            className="dbd-score-btn-undo"
                            title="Undo 1 Escape"
                          >
                            -1
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Reset & Cheatsheet Bar */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                      paddingTop: '0.75rem',
                      borderTop: '1px solid var(--border-primary)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>คำสั่งแชท:</span>
                        {[
                          fieldData.scoreCmd || '!score',
                          fieldData.kwinCmd || '!kwin',
                          fieldData.kdrawCmd || '!kdraw',
                          fieldData.kloseCmd || '!klose',
                          fieldData.kresetCmd || '!kreset'
                        ].map(cmd => (
                          <button
                            key={cmd}
                            type="button"
                            onClick={() => copyText(cmd, cmd)}
                            className="dbd-cmd-chip"
                            title="คลิกเพื่อคัดลอกคำสั่ง"
                          >
                            {cmd}
                          </button>
                        ))}

                        <button
                          type="button"
                          onClick={() => setShowDbdCmdEditor(prev => !prev)}
                          className="btn-island"
                          style={{
                            padding: '0.3rem 0.75rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: showDbdCmdEditor ? 'rgba(225, 29, 72, 0.15)' : 'var(--surface-3)',
                            color: showDbdCmdEditor ? '#f43f5e' : 'var(--text-primary)',
                            border: showDbdCmdEditor ? '1px solid #f43f5e' : '1px solid var(--border-secondary)'
                          }}
                        >
                          <Sliders size={12} /> {showDbdCmdEditor ? 'ซ่อนตั้งค่าคำสั่ง' : 'ตั้งค่าคำสั่งแชท'}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตสกอร์บอร์ดทั้งหมดเป็น 0?')) {
                            handleScoreboardUpdate('reset');
                          }
                        }}
                        className="dbd-score-btn-undo"
                        style={{ padding: '0.4rem 0.85rem', gap: '0.4rem' }}
                      >
                        <RotateCw size={13} /> รีเซ็ตกระดานคะแนน (Reset 0-0-0)
                      </button>
                    </div>

                    {/* Collapsible Custom Chat Command Editor */}
                    {showDbdCmdEditor && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1.25rem',
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-secondary)',
                        borderRadius: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <Zap size={15} style={{ color: '#e11d48' }} /> กำหนดคำสั่ง Twitch Chat ด้วยตนเอง
                            </h4>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              ระบบรองรับคำสั่งทั้งภาษาไทยและอังกฤษ เช่น <code>!win</code>, <code>!ชนะ</code>, <code>!คะแนน</code>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleSave(fieldData);
                              setDbdCmdSaveSuccess('บันทึกคำสั่งแชทเรียบร้อยแล้ว!');
                              setTimeout(() => setDbdCmdSaveSuccess(''), 2500);
                            }}
                            className="btn-island accent"
                            style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: 700 }}
                          >
                            <Save size={13} style={{ marginRight: '4px' }} /> บันทึกคำสั่ง
                          </button>
                        </div>

                        {dbdCmdSaveSuccess && (
                          <div style={{
                            marginBottom: '0.85rem',
                            padding: '0.45rem 0.75rem',
                            background: 'rgba(48, 209, 88, 0.12)',
                            border: '1px solid rgba(48, 209, 88, 0.3)',
                            borderRadius: '6px',
                            color: '#30D158',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                          }}>
                            <Check size={14} /> {dbdCmdSaveSuccess}
                          </div>
                        )}

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '0.85rem'
                        }}>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>ดูคะแนน</label>
                            <input
                              type="text"
                              value={fieldData.scoreCmd !== undefined ? fieldData.scoreCmd : '!score'}
                              onChange={e => handleFieldChange('scoreCmd', e.target.value)}
                              placeholder="!score"
                              style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', fontFamily: 'monospace' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444' }}>นับชนะ (+1 Kill)</label>
                            <input
                              type="text"
                              value={fieldData.kwinCmd !== undefined ? fieldData.kwinCmd : '!kwin'}
                              onChange={e => handleFieldChange('kwinCmd', e.target.value)}
                              placeholder="!kwin"
                              style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', fontFamily: 'monospace' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>นับเสมอ (+1 Draw)</label>
                            <input
                              type="text"
                              value={fieldData.kdrawCmd !== undefined ? fieldData.kdrawCmd : '!kdraw'}
                              onChange={e => handleFieldChange('kdrawCmd', e.target.value)}
                              placeholder="!kdraw"
                              style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', fontFamily: 'monospace' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>นับแพ้ (+1 Escape)</label>
                            <input
                              type="text"
                              value={fieldData.kloseCmd !== undefined ? fieldData.kloseCmd : '!klose'}
                              onChange={e => handleFieldChange('kloseCmd', e.target.value)}
                              placeholder="!klose"
                              style={{ width: '100%', padding: '0.45rem 0.65rem', fontSize: '0.82rem', fontFamily: 'monospace' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Spotify Song Request Workspace */}
                {selectedWidget === 'spotify-sr' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {renderSpotifyConnectionBanner()}

                    {/* Now Playing Card */}
                    <div className="setting-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Volume2 size={18} style={{ color: '#1DB954' }} />
                          <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            กำลังเล่นอยู่ (Now Playing)
                          </h4>
                        </div>
                        {nowPlaying?.track && (
                          <button
                            type="button"
                            onClick={handleSkipTrack}
                            className="btn-island accent"
                            style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                            title="ข้ามไปเพลงถัดไปบน Spotify"
                          >
                            <SkipForward size={14} />
                            <span>ข้ามเพลง (Skip)</span>
                          </button>
                        )}
                      </div>

                      {nowPlaying?.track ? (
                        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img
                              src={nowPlaying.track.albumArt || 'https://via.placeholder.com/100?text=Spotify'}
                              alt={nowPlaying.track.name}
                              style={{
                                width: '84px',
                                height: '84px',
                                borderRadius: 'var(--radius-sm)',
                                objectFit: 'cover',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                border: '1px solid rgba(255,255,255,0.1)'
                              }}
                            />
                            {nowPlaying.isPlaying && (
                              <span style={{
                                position: 'absolute',
                                bottom: '6px',
                                right: '6px',
                                background: '#1DB954',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Volume2 size={11} />
                              </span>
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                              {nowPlaying.track.name}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                              {nowPlaying.track.artists || nowPlaying.track.artist} {nowPlaying.track.album ? `• ${nowPlaying.track.album}` : ''}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                {formatDuration(nowPlaying.progressMs)}
                              </span>
                              <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${nowPlaying.track.durationMs ? Math.min(100, Math.max(0, (nowPlaying.progressMs / nowPlaying.track.durationMs) * 100)) : 0}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #1DB954, #2ebd59)',
                                  borderRadius: '10px'
                                }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                {formatDuration(nowPlaying.track.durationMs)}
                              </span>
                            </div>

                            {nowPlaying.requester && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                ขอเพลงโดย: <strong style={{ color: '#1DB954' }}>@{nowPlaying.requester}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--text-secondary)' }}>
                          <Music size={32} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            ไม่มีเพลงที่กำลังเล่นอยู่ในขณะนี้
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: '0.76rem' }}>
                            เปิด Spotify บนคอมของคุณแล้วกดเล่นเพลง หรือรอผู้ชมขอเพลงผ่านคำสั่ง <code>!sr &lt;ชื่อเพลง&gt;</code> ในแชท
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Manual Request Form & Queue */}
                    <div className="setting-card">
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
                          <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            เพิ่มเพลงเข้าคิวเอง (Manual Song Request)
                          </h4>
                        </div>
                        <form onSubmit={handleManualSongRequest} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={srSearchQuery}
                            onChange={(e) => setSrSearchQuery(e.target.value)}
                            placeholder="พิมพ์ชื่อเพลง, ศิลปิน หรือวางลิงก์ Spotify..."
                            style={{
                              flex: 1,
                              minWidth: '200px',
                              padding: '0.55rem 0.85rem',
                              background: 'var(--surface-input)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem'
                            }}
                          />
                          <button
                            type="submit"
                            disabled={srIsRequesting || !srSearchQuery.trim()}
                            className="btn-island accent"
                            style={{ padding: '0.55rem 1.15rem', fontSize: '0.85rem' }}
                          >
                            {srIsRequesting ? <Loader2 size={15} className="spin" /> : <Music size={15} />}
                            <span>เพิ่มเข้าคิว</span>
                          </button>
                        </form>
                      </div>

                      {/* Queue List Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '0.85rem',
                        borderTop: '1px solid var(--border-subtle)',
                        marginBottom: '0.75rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <ListMusic size={16} style={{ color: 'var(--text-secondary)' }} />
                          <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            คิวเพลงที่รอเล่น ({spotifyQueue.length})
                          </h4>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => setActiveCategory('history')}
                            className="btn-island"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                            title="ดูประวัติเพลงที่ขอเข้ามาทั้งหมด"
                          >
                            <History size={12} />
                            <span>ประวัติขอเพลง ({rollHistory.length})</span>
                          </button>
                          {spotifyQueue.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearQueue}
                              className="btn-island"
                              style={{ fontSize: '0.75rem', color: '#FF453A', borderColor: 'rgba(255, 69, 58, 0.25)', padding: '0.35rem 0.65rem' }}
                              title="ล้างคิวเพลงทั้งหมด"
                            >
                              <Trash2 size={12} />
                              <span>ล้างคิว</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {spotifyQueue.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-secondary)' }}>
                          <ListMusic size={28} style={{ opacity: 0.3, marginBottom: '0.4rem' }} />
                          <p style={{ margin: 0, fontSize: '0.82rem' }}>ยังไม่มีเพลงในคิวรอ</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '320px', overflowY: 'auto' }}>
                          {spotifyQueue.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.55rem 0.75rem',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)'
                              }}
                            >
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', width: '22px' }}>
                                #{idx + 1}
                              </span>
                              <img
                                src={item.track?.albumArt || 'https://via.placeholder.com/40?text=Song'}
                                alt={item.track?.name}
                                style={{ width: '38px', height: '38px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.track?.name}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.track?.artists || item.track?.artist}
                                </div>
                              </div>
                              <span style={{ fontSize: '0.7rem', color: '#1DB954', background: 'rgba(29, 185, 84, 0.12)', padding: '2px 6px', borderRadius: '4px' }}>
                                @{item.requester || 'แชท'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteQueueItem(item.id)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                                title="ลบออกจากคิว"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Custom Counter Live Stepper Card */}
                {selectedWidget === 'custom-counter' && (
                  <div className="setting-card">
                    <h4 className="setting-card-title">แผงควบคุมยอดสถิติ Real-Time (Live Counter Pad)</h4>
                    <p className="setting-card-desc">คลิกเพื่อเพิ่มลดคะแนน หรือทดสอบขึ้นจอ OBS ทันที</p>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '1.5rem',
                      padding: '1.5rem',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-lg)',
                      margin: '1rem 0'
                    }}>
                      <button
                        type="button"
                        className="btn-island"
                        onClick={() => handleCounterStep(-1)}
                        style={{ width: '46px', height: '46px', borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                      >
                        <Minus size={20} />
                      </button>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--accent-color)', lineHeight: 1 }}>
                          {counterCount}
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {fieldData.unitText || 'ครั้ง'}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="btn-island accent"
                        onClick={() => handleCounterStep(1)}
                        style={{ width: '46px', height: '46px', borderRadius: '50%', padding: 0, justifyContent: 'center' }}
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button type="button" className="slider-preset-btn" onClick={() => handleCounterStep(5)}>+5</button>
                      <button type="button" className="slider-preset-btn" onClick={() => handleCounterStep(-5)}>-5</button>
                      <button type="button" className="slider-preset-btn" onClick={() => handleCounterUpdate('reset')}>รีเซ็ตเป็น 0</button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                      <input
                        type="number"
                        min="0"
                        placeholder="กำหนดค่า เช่น 10"
                        value={counterCustomInput}
                        onChange={e => setCounterCustomInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && counterCustomInput !== '') {
                            handleCounterSet(counterCustomInput);
                            setCounterCustomInput('');
                          }
                        }}
                        style={{
                          padding: '0.45rem 0.75rem',
                          background: 'var(--surface-input)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          width: '140px'
                        }}
                      />
                      <button
                        type="button"
                        className="btn-island"
                        onClick={() => {
                          if (counterCustomInput !== '') {
                            handleCounterSet(counterCustomInput);
                            setCounterCustomInput('');
                          }
                        }}
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                      >
                        ตั้งค่าตัวเลข
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. DBD Perks Searchable Blacklist */}
                {selectedWidget === 'dbd-perks' && (
                  <div className="setting-card">
                    <div className="setting-card-header">
                      <div>
                        <h4 className="setting-card-title">คัดกรองเปิร์ค DBD ที่ไม่ต้องการให้สุ่ม (Perk Blacklist)</h4>
                        <p className="setting-card-desc">คลิกที่เปิร์คเพื่อสลับระหว่าง "สุ่มได้" กับ "คัดออก"</p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button
                          type="button"
                          className={`category-tab-btn ${dbdRole === 'survivor' ? 'active' : ''}`}
                          onClick={() => setDbdRole('survivor')}
                        >
                          Survivor ({dbdPerksList.survivor?.length || 0})
                        </button>
                        <button
                          type="button"
                          className={`category-tab-btn ${dbdRole === 'killer' ? 'active' : ''}`}
                          onClick={() => setDbdRole('killer')}
                        >
                          Killer ({dbdPerksList.killer?.length || 0})
                        </button>
                        {status.isAdmin && (
                          <button
                            type="button"
                            onClick={handleSyncDbdPerks}
                            disabled={isSyncingPerks}
                            className="btn-island"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                            title="ดึงข้อมูลเปิร์คล่าสุดจาก Dead by Daylight Wiki (เฉพาะแอดมิน)"
                          >
                            {isSyncingPerks ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                            <span>ซิงค์เปิร์ค</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {syncPerksSuccess && (
                      <div style={{ marginTop: '0.5rem', color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>
                        {syncPerksSuccess}
                      </div>
                    )}

                    <div style={{ marginTop: '0.75rem' }}>
                      <input
                        type="text"
                        placeholder="ค้นหาชื่อเปิร์ค หรือชื่อตัวละคร..."
                        value={dbdSearchQuery}
                        onChange={e => setDbdSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--surface-input)',
                          border: '1px solid var(--border-primary)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem'
                        }}
                      />
                    </div>

                    <div style={{
                      maxHeight: '380px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '0.65rem',
                      padding: '0.5rem',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-md)',
                      marginTop: '0.85rem'
                    }}>
                      {(dbdPerksList[dbdRole] || [])
                        .filter(p => {
                          if (!dbdSearchQuery) return true;
                          const q = dbdSearchQuery.toLowerCase();
                          return (p.name && p.name.toLowerCase().includes(q)) || (p.character && p.character.toLowerCase().includes(q));
                        })
                        .map(p => {
                          const excludedList = Array.isArray(fieldData.excludedPerks) ? fieldData.excludedPerks : [];
                          const isExcluded = excludedList.includes(p.name) || excludedList.includes(p.id);

                          return (
                            <div
                              key={p.id || p.name}
                              onClick={() => {
                                const targetId = p.id || p.name;
                                const next = isExcluded
                                  ? excludedList.filter(x => x !== targetId && x !== p.name && x !== p.id)
                                  : [...excludedList, targetId];
                                handleFieldChange('excludedPerks', next);
                              }}
                              style={{
                                padding: '0.5rem',
                                background: isExcluded ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface-1)',
                                border: isExcluded ? '1.5px solid #ef4444' : '1px solid var(--border-primary)',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'center',
                                cursor: 'pointer',
                                transition: 'var(--transition-fast)'
                              }}
                            >
                              <img
                                src={p.icon ? (p.icon.startsWith('http') ? p.icon : `${API_BASE}${p.icon}`) : ''}
                                alt={p.name}
                                style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                              />
                              <div style={{ fontSize: '0.74rem', fontWeight: 700, marginTop: '4px', color: isExcluded ? '#f87171' : 'var(--text-primary)' }}>
                                {p.name}
                              </div>
                              <span style={{ fontSize: '0.65rem', color: isExcluded ? '#ef4444' : 'var(--text-muted)' }}>
                                {isExcluded ? 'คัดออก' : 'สุ่มได้'}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 5. Random Killer Blacklist */}
                {selectedWidget === 'random-killer' && (
                  <div className="setting-card">
                    <h4 className="setting-card-title">คัดกรองฆาตกรที่ไม่ต้องการให้สุ่ม (Killer Blacklist)</h4>
                    <p className="setting-card-desc">คลิกที่ภาพคิลเลอร์เพื่อเปิด/ปิดการสุ่ม</p>

                    <div style={{
                      maxHeight: '380px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '0.65rem',
                      padding: '0.5rem',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-md)',
                      marginTop: '0.85rem'
                    }}>
                      {killersList.map(k => {
                        const excludedList = Array.isArray(fieldData.excludedKillers) ? fieldData.excludedKillers : [];
                        const isExcluded = excludedList.includes(k.name);

                        return (
                          <div
                            key={k.id || k.name}
                            onClick={() => {
                              const next = isExcluded
                                ? excludedList.filter(x => x !== k.name)
                                : [...excludedList, k.name];
                              handleFieldChange('excludedKillers', next);
                            }}
                            style={{
                              padding: '0.5rem',
                              background: isExcluded ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface-1)',
                              border: isExcluded ? '1.5px solid #ef4444' : '1px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              textAlign: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <img src={k.img} alt={k.name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: isExcluded ? '#f87171' : 'var(--text-primary)' }}>
                              {k.name}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: isExcluded ? '#ef4444' : 'var(--text-muted)' }}>
                              {isExcluded ? 'คัดออก' : 'สุ่มได้'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 6. Valorant Agents Blacklist */}
                {selectedWidget === 'valorant-agent' && (
                  <div className="setting-card">
                    <div className="setting-card-header">
                      <div>
                        <h4 className="setting-card-title">คัดกรองตัวละคร Valorant (Agent Blacklist)</h4>
                        <p className="setting-card-desc">คลิกที่ตัวละครเพื่อเปิด/ปิดการสุ่ม</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSyncValorant}
                        disabled={isSyncingValorant}
                        className="btn-island"
                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                      >
                        {isSyncingValorant ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                        <span>ซิงค์ตัวละคร</span>
                      </button>
                    </div>

                    {syncValSuccess && (
                      <div style={{ marginTop: '0.5rem', color: '#10b981', fontSize: '0.8rem', fontWeight: 600 }}>
                        {syncValSuccess}
                      </div>
                    )}

                    <div style={{
                      maxHeight: '380px',
                      overflowY: 'auto',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                      gap: '0.65rem',
                      padding: '0.5rem',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-md)',
                      marginTop: '0.85rem'
                    }}>
                      {agentsList.map(ag => {
                        const excludedList = Array.isArray(fieldData.excludedAgents) ? fieldData.excludedAgents : [];
                        const isExcluded = excludedList.includes(ag.name);

                        return (
                          <div
                            key={ag.uuid || ag.name}
                            onClick={() => {
                              const next = isExcluded
                                ? excludedList.filter(x => x !== ag.name)
                                : [...excludedList, ag.name];
                              handleFieldChange('excludedAgents', next);
                            }}
                            style={{
                              padding: '0.5rem',
                              background: isExcluded ? 'rgba(239, 68, 68, 0.15)' : 'var(--surface-1)',
                              border: isExcluded ? '1.5px solid #ef4444' : '1px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              textAlign: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <img src={ag.icon || ag.displayIcon} alt={ag.name} style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: isExcluded ? '#f87171' : 'var(--text-primary)' }}>
                              {ag.name}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: isExcluded ? '#ef4444' : 'var(--text-muted)' }}>
                              {isExcluded ? 'คัดออก' : 'สุ่มได้'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 5: AUDIO & SFX ── */}
            {activeCategory === 'audio' && (
              <div className="animate-fade-up">
                {/* Enable Sound Toggle Switch */}
                {schema?.enableSound && (
                  <div
                    className="switch-card"
                    style={{ marginBottom: '1rem' }}
                    onClick={() => handleFieldChange('enableSound', !fieldData.enableSound)}
                  >
                    <div className="switch-card-info">
                      <span className="switch-card-label">{schema.enableSound.label || 'เปิดเสียงเอฟเฟกต์ (Sound Effects)'}</span>
                      <span className="switch-card-desc">เปิดหรือปิดเสียงเอฟเฟกต์ทั้งหมดของ Widget นี้</span>
                    </div>
                    <div className={`switch-pill ${fieldData.enableSound ? 'is-on' : ''}`}>
                      <div className="switch-pill-knob" />
                    </div>
                  </div>
                )}

                {/* Volume Slider Card */}
                <div className="setting-card">
                  <div className="setting-card-header">
                    <div>
                      <h4 className="setting-card-title">ระดับความดังเสียงเอฟเฟกต์ (SFX Volume)</h4>
                      <p className="setting-card-desc">ปรับความดังเสียงเตือนเมื่อมีการสุ่มหรือทำรายการ</p>
                    </div>
                    <button
                      type="button"
                      className="btn-island"
                      onClick={handleTestSound}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                    >
                      <Play size={14} />
                      <span>ลองฟังเสียง</span>
                    </button>
                  </div>

                  <div className="slider-row">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={fieldData.soundVolume !== undefined ? fieldData.soundVolume : 60}
                      onChange={e => handleFieldChange('soundVolume', Number(e.target.value))}
                    />
                    <span className="slider-value-pill">{fieldData.soundVolume !== undefined ? fieldData.soundVolume : 60}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 6: OBS STUDIO SETUP ── */}
            {activeCategory === 'obs' && (
              <div className="animate-fade-up">
                <div className="setting-card">
                  <h4 className="setting-card-title">1. คัดลอก OBS Browser Source URL</h4>
                  <p className="setting-card-desc">นำ URL นี้ไปใส่ในช่อง URL ของ Browser Source ใน OBS Studio</p>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
                    <input
                      type="text"
                      readOnly
                      value={obsUrl}
                      style={{
                        flex: 1,
                        background: 'var(--surface-input)',
                        border: '1px solid var(--border-primary)',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace'
                      }}
                    />
                    <button
                      type="button"
                      className="btn-island"
                      onClick={handleRegenerateToken}
                      disabled={isRegeneratingToken}
                      title="รีเซ็ต Secret Key ใหม่ (ลิงก์เดิมที่เคยแชร์จะหยุดทำงานทันที)"
                      style={{
                        padding: '0.65rem 0.95rem',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <RefreshCw size={14} className={isRegeneratingToken ? 'spin' : ''} />
                      <span>{isRegeneratingToken ? 'กำลังรีเซ็ต...' : 'รีเซ็ต Key'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-island accent"
                      onClick={() => copyText(obsUrl, 'obs')}
                    >
                      {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copiedUrl ? 'คัดลอกแล้ว!' : 'คัดลอก'}</span>
                    </button>
                  </div>
                </div>

                <div className="setting-card">
                  <h4 className="setting-card-title">2. ขนาดความกว้าง x ความสูงที่แนะนำสำหรับ OBS</h4>
                  <p className="setting-card-desc">คลิกเลือกความละเอียดที่เข้ากับหน้าจอของคุณ</p>

                  <div className="obs-resolution-grid">
                    <div className="obs-resolution-card" onClick={() => copyText('1920x1080', 'res1')}>
                      <div className="obs-res-title">Full HD มาตรฐาน</div>
                      <div className="obs-res-dims">1920 × 1080</div>
                    </div>
                    <div className="obs-resolution-card" onClick={() => copyText('1080x1920', 'res2')}>
                      <div className="obs-res-title">แนวตั้ง TikTok / Shorts</div>
                      <div className="obs-res-dims">1080 × 1920</div>
                    </div>
                    <div className="obs-resolution-card" onClick={() => copyText('800x600', 'res3')}>
                      <div className="obs-res-title">กล่องเล็กมุมจอ</div>
                      <div className="obs-res-dims">800 × 600</div>
                    </div>
                  </div>
                </div>

                <div className="setting-card" style={{ borderLeft: '4px solid var(--apple-blue)' }}>
                  <h4 className="setting-card-title" style={{ color: 'var(--apple-blue)' }}>คำแนะนำเพิ่มเติมสำหรับ OBS</h4>
                  <ul style={{ margin: '0.4rem 0 0 1.25rem', padding: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <li>ติ๊กถูกที่ <strong>"Shutdown source when not visible"</strong> เพื่อประหยัด CPU เมื่อซ่อน Scene</li>
                    <li>ติ๊กถูกที่ <strong>"Refresh browser when scene becomes active"</strong> เพื่อให้โหลดสถิติตรงเป๊ะทุกครั้งที่เปิดฉาก</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ── TAB 7: ACTIVITY / ROLL HISTORY ── */}
            {activeCategory === 'history' && (
              <div className="animate-fade-up">
                <div className="setting-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h4 className="setting-card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <History size={18} />
                        <span>ประวัติการแลกแต้มและกิจกรรมล่าสุด ({rollHistory.length})</span>
                      </h4>
                      <p className="setting-card-desc">บันทึกผลการสุ่ม, การเช็คอิน และคำสั่งแชทแบบ Real-time</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setActiveCategory('quick')}
                        className="btn-island"
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                      >
                        <ArrowLeft size={14} />
                        <span>กลับไปหน้าตั้งค่า</span>
                      </button>

                      {rollHistory.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearHistory}
                          className="btn-island"
                          style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                        >
                          <Trash2 size={14} />
                          <span>ล้างประวัติทั้งหมด</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* History Search Bar */}
                  {rollHistory.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                      background: 'var(--surface-input)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.5rem 0.75rem'
                    }}>
                      <Search size={15} style={{ color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        placeholder="ค้นหาในประวัติ (ชื่อผู้ชม, รางวัล, เปิร์ค, ฆาตกร, เอเจนท์)..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                          width: '100%'
                        }}
                      />
                      {historySearch && (
                        <button
                          type="button"
                          onClick={() => setHistorySearch('')}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                          ล้าง
                        </button>
                      )}
                    </div>
                  )}

                  {/* Loyalty Card User Summary Leaderboard */}
                  {selectedWidget === 'loyalty-card' && loyaltyUserSummary.length > 0 && (
                    <div style={{
                      marginBottom: '1.25rem',
                      padding: '1rem',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Users size={16} /> ยอดเช็คอินสะสมรายบุคคล ({loyaltyUserSummary.length} คน)
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.65rem' }}>
                        {loyaltyUserSummary.map((u) => (
                          <div
                            key={u.username}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.65rem',
                              padding: '0.5rem 0.75rem',
                              background: 'var(--surface-1)',
                              border: '1px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            <img
                              src={u.avatar || `/api/twitch/avatar/${encodeURIComponent(u.username)}`}
                              alt={u.username}
                              style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }}
                              onError={(e) => {
                                e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                @{u.username}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                เช็คอิน: <strong>{u.count}</strong> ครั้ง
                              </div>
                            </div>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#f59e0b',
                              padding: '2px 7px',
                              borderRadius: '4px'
                            }}>
                              {u.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {rollHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                      <History size={36} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        ยังไม่มีประวัติกิจกรรมในขณะนี้
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>
                        เมื่อผู้ชมแลกแต้มในช่อง หรือคุณกดปุ่ม "จำลองการแลกแต้ม" ผลลัพธ์จะถูกบันทึกและแสดงที่นี่ทันที
                      </p>
                    </div>
                  ) : filteredRollHistory.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                      <Search size={30} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        ไม่พบผลการค้นหาที่ตรงกับ "{historySearch}"
                      </p>
                      <button
                        type="button"
                        onClick={() => setHistorySearch('')}
                        className="btn-island"
                        style={{ marginTop: '0.5rem', fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                      >
                        ล้างคำค้นหา
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {filteredRollHistory.map((item) => {
                        const isValorant = selectedWidget === 'valorant-agent' || Boolean(item.agent || item.agents);
                        const isDbd = selectedWidget === 'dbd-perks' || Array.isArray(item.perks);
                        const isKiller = selectedWidget === 'random-killer' || Boolean(item.killer || item.killerImg);
                        const isLoyalty = selectedWidget === 'loyalty-card' || item.count !== undefined;
                        const isSpotify = selectedWidget === 'spotify-sr' || Boolean(item.track);
                        const isTeam = item.mode === 'team' || (Array.isArray(item.agents) && item.agents.length > 0);

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: '0.75rem 1rem',
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <img
                                  src={item.avatar || `/api/twitch/avatar/${encodeURIComponent(item.username || '')}`}
                                  alt={item.username || 'User'}
                                  style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }}
                                  onError={(e) => {
                                    e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                                  }}
                                />
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                      @{item.username || item.requester || 'Streamer'}
                                    </span>
                                    {isDbd && item.role && (
                                      <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 700,
                                        padding: '1px 6px',
                                        borderRadius: '3px',
                                        background: item.role === 'killer' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                        color: item.role === 'killer' ? '#f87171' : '#60a5fa',
                                        border: item.role === 'killer' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)'
                                      }}>
                                        {item.role === 'killer' ? 'ฝั่งฆาตกร (Killer)' : 'ฝั่งผู้รอดชีวิต (Survivor)'}
                                      </span>
                                    )}
                                    {isSpotify && (
                                      <span style={{
                                        fontSize: '0.68rem',
                                        fontWeight: 700,
                                        padding: '1px 6px',
                                        borderRadius: '3px',
                                        background: 'rgba(29, 185, 84, 0.15)',
                                        color: '#1db954',
                                        border: '1px solid rgba(29, 185, 84, 0.3)'
                                      }}>
                                        {item.source === 'channel_points' ? 'ขอเพลงผ่านแต้มช่อง' : item.source === 'dashboard' ? 'ขอผ่านแผงควบคุม' : 'ขอเพลงผ่านแชท !sr'}
                                      </span>
                                    )}
                                  </div>
                                  {item.rewardTitle && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                                      รางวัล: {item.rewardTitle}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} />
                                {formatTime(item.timestamp)}
                              </span>
                            </div>

                            {/* Valorant Result */}
                            {isValorant && (
                              <div>
                                {isTeam && Array.isArray(item.agents) ? (
                                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                                    {item.agents.map((ag, aIdx) => (
                                      <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface-1)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                        <img src={ag.icon} alt={ag.name} style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{ag.name}</span>
                                        <span className={`val-agent-role-pill ${(ag.role || '').toLowerCase()}`}>{ag.role}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    {item.agentImg && (
                                      <img src={item.agentImg} alt="" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                                    )}
                                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                      {item.agent || item.result}
                                    </span>
                                    {item.role && (
                                      <span className={`val-agent-role-pill ${(item.role || '').toLowerCase()}`}>{item.role}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* DBD Perks Result */}
                            {isDbd && Array.isArray(item.perks) && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', marginTop: '0.25rem' }}>
                                {item.perks.map((p, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: 'var(--surface-1)', padding: '0.35rem 0.55rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                                    <img
                                      src={p.icon ? (p.icon.startsWith('http') ? p.icon : `${API_BASE}${p.icon}`) : ''}
                                      alt={p.name}
                                      style={{ width: '28px', height: '28px', objectFit: 'contain', flexShrink: 0 }}
                                    />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                      {p.character && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.character}</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Random Killer Result */}
                            {isKiller && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem', background: 'var(--surface-1)', padding: '0.45rem 0.65rem', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                                {item.killerImg ? (
                                  <img
                                    src={item.killerImg.startsWith('http') ? item.killerImg : `${API_BASE}${item.killerImg}`}
                                    alt={item.killer || 'Killer'}
                                    style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div style={{ width: '38px', height: '38px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                                    <Skull size={20} />
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    {item.killer || item.result || 'ไม่ระบุชื่อ'}
                                  </div>
                                  <span style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 600 }}>ฆาตกรที่สุ่มได้</span>
                                </div>
                              </div>
                            )}

                            {/* Loyalty Card Result */}
                            {isLoyalty && !isDbd && !isKiller && !isValorant && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                                เช็คอินสะสมครั้งที่ <strong>{item.count || 1}</strong> {item.result ? `(${item.result})` : ''}
                              </div>
                            )}

                            {/* Spotify Song Request Result */}
                            {isSpotify && (item.track || item.result) && (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                marginTop: '0.25rem',
                                background: 'var(--surface-1)',
                                padding: '0.55rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-subtle)'
                              }}>
                                <img
                                  src={item.track?.albumArt || 'https://via.placeholder.com/44?text=Music'}
                                  alt={item.track?.name || 'Track'}
                                  style={{ width: '44px', height: '44px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                                  onError={(e) => { e.target.src = 'https://via.placeholder.com/44?text=Music'; }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {item.track?.name || item.result}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                                    {item.track?.artists || item.track?.artist || 'ศิลปิน'}
                                  </div>
                                </div>
                                {item.track?.externalUrl && (
                                  <a
                                    href={item.track.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      background: 'rgba(29, 185, 84, 0.12)',
                                      color: '#1db954',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                      flexShrink: 0
                                    }}
                                    title="เปิดฟังบน Spotify"
                                  >
                                    <span>Spotify</span>
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Generic Result */}
                            {!isValorant && !isDbd && !isKiller && !isLoyalty && !isSpotify && (
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                                {item.result || item.action || JSON.stringify(item.data || '')}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 8: ALL SETTINGS (FULL DYNAMIC SCHEMA WITH SHOWIF) ── */}
            {activeCategory === 'all' && (
              <div className="animate-fade-up">
                <div className="setting-card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--accent-color)' }}>
                  <h4 className="setting-card-title">การตั้งค่าทั้งหมด (Full Schema Editor)</h4>
                  <p className="setting-card-desc">
                    เข้าถึงทุกตัวเลือกการตั้งค่าของ Widget นี้โดยตรง พร้อมการตรวจสอบเงื่อนไขการแสดงผล (showIf) แบบไดนามิก
                  </p>
                </div>
                {renderFullSchemaForm()}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sticky Studio Live Preview */}
        <div className="studio-preview-column">
          <div className="preview-outer-shell">
            {/* Preview Toolbar */}
            <div className="preview-toolbar">
              <div className="preview-toolbar-left">
                <span className="preview-live-indicator">
                  <span className="live-pulse-dot" />
                  <span>Live Preview</span>
                </span>
              </div>

              {/* Background Color Switchers */}
              <div className="preview-bg-switchers">
                <button
                  type="button"
                  title="พื้นหลังโปร่งใส (Checkerboard)"
                  className={`preview-bg-btn ${previewBg === 'checker' ? 'active' : ''}`}
                  onClick={() => setPreviewBg('checker')}
                  style={{ background: '#27272a' }}
                />
                <button
                  type="button"
                  title="พื้นหลังมืดสนิท (OLED Black)"
                  className={`preview-bg-btn ${previewBg === 'black' ? 'active' : ''}`}
                  onClick={() => setPreviewBg('black')}
                  style={{ background: '#000000' }}
                />
                <button
                  type="button"
                  title="กรีนสกรีน (Green Screen)"
                  className={`preview-bg-btn ${previewBg === 'green' ? 'active' : ''}`}
                  onClick={() => setPreviewBg('green')}
                  style={{ background: '#00ff00' }}
                />
                <button
                  type="button"
                  title="มาเจนต้าสกรีน (Magenta Screen)"
                  className={`preview-bg-btn ${previewBg === 'magenta' ? 'active' : ''}`}
                  onClick={() => setPreviewBg('magenta')}
                  style={{ background: '#ff00ff' }}
                />
              </div>
            </div>

            {/* Preview Screen Box */}
            <div className={`preview-screen-box bg-${previewBg}`}>
              <iframe
                ref={previewIframeRef}
                key={`${selectedWidget}-${previewKey}`}
                src={previewUrl}
                className="preview-iframe"
                title="Widget Live Preview"
              />
            </div>

            {/* Quick Actions under preview */}
            <div className="preview-quick-actions">
              <button
                type="button"
                className="btn-island accent"
                onClick={handleSimulate}
                style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem' }}
              >
                <Play size={14} />
                <span>จำลองการแลกแต้ม</span>
              </button>

              <button
                type="button"
                className="btn-island"
                onClick={() => setPreviewKey(k => k + 1)}
                title="รีเฟรชหน้าพรีวิว"
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
              >
                <RefreshCw size={14} />
                <span>รีโหลด</span>
              </button>

              <a
                href={obsUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-island"
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem', textDecoration: 'none' }}
              >
                <ExternalLink size={14} />
                <span>เปิดในแท็บใหม่</span>
              </a>
            </div>

            {/* Dedicated OBS Browser Source URL Box */}
            <div className="preview-obs-box" style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  OBS Browser Source URL
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'rgba(48, 209, 88, 0.12)',
                  color: '#30D158',
                  border: '1px solid rgba(48, 209, 88, 0.25)'
                }}>
                  Auto-Sync Real-Time
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  readOnly
                  value={obsUrl}
                  onClick={(e) => e.target.select()}
                  style={{
                    flex: 1,
                    background: 'var(--surface-input)',
                    border: '1px solid var(--border-primary)',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace',
                    color: 'var(--text-secondary)'
                  }}
                />
                <button
                  type="button"
                  className="btn-island"
                  onClick={handleRegenerateToken}
                  disabled={isRegeneratingToken}
                  title="รีเซ็ต Secret Key ใหม่ (ลิงก์เดิมที่เคยแชร์จะหยุดทำงานทันที)"
                  style={{
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.8rem',
                    whiteSpace: 'nowrap',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <RefreshCw size={13} className={isRegeneratingToken ? 'spin' : ''} />
                  <span>{isRegeneratingToken ? 'รีเซ็ต...' : 'รีเซ็ต Key'}</span>
                </button>
                <button
                  type="button"
                  className="btn-island accent"
                  onClick={() => copyText(obsUrl, 'obs')}
                  style={{ padding: '0.55rem 0.95rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  title="คัดลอก OBS URL"
                >
                  {copiedUrl ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedUrl ? 'คัดลอกแล้ว' : 'คัดลอก URL'}</span>
                </button>
              </div>
            </div>

            {/* Quick History Status Box in Right Column */}
            <div className="preview-history-quick-box">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <History size={15} style={{ color: 'var(--accent-color)' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ประวัติกิจกรรมล่าสุด
                  </span>
                  <span className="studio-view-count-badge">{rollHistory.length}</span>
                </div>
                <button
                  type="button"
                  className="btn-island"
                  onClick={() => setActiveCategory('history')}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                >
                  <span>ดูประวัติทั้งหมด</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              {rollHistory.length > 0 ? (
                <div style={{ marginTop: '0.65rem', padding: '0.5rem', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      @{rollHistory[0]?.username || 'Streamer'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {formatTime(rollHistory[0]?.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600, marginTop: '2px' }}>
                    {rollHistory[0]?.killer || rollHistory[0]?.agent || (rollHistory[0]?.track ? `${rollHistory[0].track.name} - ${rollHistory[0].track.artists || rollHistory[0].track.artist}` : null) || (Array.isArray(rollHistory[0]?.perks) ? `${rollHistory[0].perks.length} เปิร์ค DBD` : rollHistory[0]?.result || 'กิจกรรมล่าสุด')}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ยังไม่มีประวัติการแลกแต้มในขณะนี้
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky Bottom Action Bar (Save & Unsaved Changes) ── */}
      <div className="sticky-bottom-bar">
        {hasUnsavedChanges ? (
          <div className="dirty-indicator">
            <span className="dirty-dot" />
            <span>มีการแก้ไขที่ยังไม่ได้บันทึก</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>
            <CheckCircle2 size={16} />
            <span>การตั้งค่าเป็นปัจจุบันแล้ว</span>
          </div>
        )}

        {hasUnsavedChanges && (
          <button
            type="button"
            className="btn-island"
            onClick={handleReset}
            style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem', borderRadius: '9999px' }}
          >
            รีเซ็ต
          </button>
        )}

        <button
          type="button"
          className="save-action-btn"
          onClick={() => handleSave(fieldData)}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
          <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}</span>
        </button>
      </div>

      {/* Save Success Toast */}
      {saveSuccess && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#fff',
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 700,
          fontSize: '0.88rem',
          zIndex: 9999
        }}>
          <Check size={18} />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* ── Widget Switcher Modal ── */}
      {isSwitcherOpen && (
        <div className="widget-switcher-overlay" onClick={() => setIsSwitcherOpen(false)}>
          <div className="widget-switcher-modal" onClick={e => e.stopPropagation()}>
            <div className="widget-switcher-header">
              <div className="widget-switcher-header-left">
                <div className="widget-switcher-header-icon">
                  <LayoutGrid size={20} />
                </div>
                <div>
                  <h3 className="widget-switcher-title">เลือก Widget ที่ต้องการตั้งค่า</h3>
                  <p className="widget-switcher-subtitle">คลิกที่การ์ดเพื่อสลับไปยังการตั้งค่าของวิดเจ็ตนั้นทันที</p>
                </div>
              </div>
              <button
                type="button"
                className="widget-switcher-close-btn"
                onClick={() => setIsSwitcherOpen(false)}
                title="ปิด (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Bar & Search */}
            <div className="widget-switcher-toolbar">
              <div className="widget-switcher-search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ Widget หรือความสามารถ..."
                  value={switcherSearch}
                  onChange={e => setSwitcherSearch(e.target.value)}
                  autoFocus
                />
                {switcherSearch && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setSwitcherSearch('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="widget-switcher-categories">
                {WIDGET_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`switcher-cat-pill ${switcherCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setSwitcherCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Widgets Grid */}
            <div className="widget-switcher-grid">
              {filteredWidgets.length === 0 ? (
                <div className="widget-switcher-empty">
                  <Search size={32} />
                  <p>ไม่พบ Widget ที่ตรงกับ "{switcherSearch}"</p>
                  <button
                    type="button"
                    className="btn-island"
                    onClick={() => { setSwitcherSearch(''); setSwitcherCategory('all'); }}
                  >
                    ล้างการค้นหา
                  </button>
                </div>
              ) : (
                filteredWidgets.map(w => {
                  const meta = WIDGET_META[w.id] || { icon: <Sliders size={18} />, color: '#6366f1' };
                  const isSelected = selectedWidget === w.id;
                  const isLive = widgetStatusOverview.user[w.id] === true;

                  return (
                    <div
                      key={w.id}
                      className={`widget-switcher-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedWidget(w.id);
                        setIsSwitcherOpen(false);
                      }}
                    >
                      <div className="widget-card-left">
                        <div
                          className="widget-card-icon"
                          style={{ background: meta.gradient || meta.color }}
                        >
                          {meta.icon}
                        </div>
                      </div>

                      <div className="widget-card-body">
                        <div className="widget-card-top-row">
                          <span className="widget-card-title">{meta.name || w.name}</span>
                          <span className={`widget-card-status-badge ${isLive ? 'live' : 'off'}`}>
                            <span className="widget-card-dot" />
                            {isLive ? 'Live บน Stream' : 'ปิดอยู่'}
                          </span>
                        </div>
                        <p className="widget-card-desc">{meta.desc}</p>
                      </div>

                      {isSelected && (
                        <div className="widget-card-active-indicator" title="กำลังเปิดตั้งค่าวิดเจ็ตนี้">
                          <Check size={16} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="widget-switcher-footer">
              <span className="footer-count">แสดง {filteredWidgets.length} จาก {widgets.length} วิดเจ็ต</span>
              <span className="footer-hint">กด ESC หรือคลิกด้านนอกเพื่อปิด</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
