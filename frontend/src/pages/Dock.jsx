import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  Music,
  Hash,
  Skull,
  Dices,
  Ticket,
  Crosshair,
  Megaphone,
  Play,
  Pause,
  SkipForward,
  Trash2,
  RefreshCw,
  Radio,
  Sliders,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Inbox,
  Clock,
  Award,
  Users,
  Check,
  Search,
  MessageSquare
} from 'lucide-react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import './Dock.css';

const TAB_ICONS = {
  'spotify-sr': Music,
  'custom-counter': Hash,
  'dbd-scoreboard': Skull,
  'dbd-perks': Dices,
  'random-killer': Skull,
  'loyalty-card': Ticket,
  'valorant-agent': Crosshair,
  'twitch-shoutout': Megaphone
};

export default function Dock() {
  const [searchParams] = useSearchParams();
  const { user: authUser } = useAuth();

  // Target Secret Token or User
  const dockToken = searchParams.get('token') || searchParams.get('key') || '';
  const fallbackUser = searchParams.get('user') || searchParams.get('userId') || authUser?.userId || authUser?.username || '';
  const [resolvedUserId, setResolvedUserId] = useState('');
  const targetUser = resolvedUserId || fallbackUser;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [userData, setUserData] = useState(null);
  const [activeTabs, setActiveTabs] = useState([]);
  const [currentTab, setCurrentTab] = useState('');

  // Live Widget States
  const [spotifyData, setSpotifyData] = useState({ isPlaying: false, track: null, queue: [], connected: false });
  const [counterData, setCounterData] = useState({ title: 'สถิติ', count: 0, unit: 'ครั้ง', stepAmount: 1 });
  const [scoreboardData, setScoreboardData] = useState({ killerKills: 0, killerDraws: 0, killerEscapes: 0, title: 'DBD Scoreboard', stat1Title: 'WINS', stat2Title: 'LOSES', stat3Title: 'DRAWS' });
  const [dbdPerksHistory, setDbdPerksHistory] = useState([]);
  const [perksMap, setPerksMap] = useState({});
  const [loyaltyHistory, setLoyaltyHistory] = useState([]);
  const [randomKillerHistory, setRandomKillerHistory] = useState([]);
  const [streamChatters, setStreamChatters] = useState([]);
  const [chatterSearch, setChatterSearch] = useState('');
  const [customSoUser, setCustomSoUser] = useState('');

  // Action feedback states
  const [actionLoading, setActionLoading] = useState(false);
  const socketRef = useRef(null);

  // 1. Fetch Dock Overview
  const fetchOverview = useCallback(async () => {
    if (!dockToken && !targetUser && !authUser) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const query = new URLSearchParams();
      if (dockToken) query.set('token', dockToken);
      if (targetUser) query.set('user', targetUser);

      const res = await fetch(`${API_BASE}/api/dock/overview?${query.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUserData(data.user);
      if (data.user?.userId) {
        setResolvedUserId(data.user.userId);
      }
      setActiveTabs(data.activeTabs || []);
      if (data.data) {
        if (data.data.spotify) setSpotifyData(data.data.spotify);
        if (data.data.counter) setCounterData(data.data.counter);
        if (data.data.scoreboard) setScoreboardData(data.data.scoreboard);
        const dedupeHistory = (items) => {
          if (!Array.isArray(items)) return [];
          const seen = new Set();
          return items.filter(it => {
            const k = it.id || `${it.username}_${it.killer || it.result}_${it.timestamp}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        };
        if (data.data.dbdPerksHistory) setDbdPerksHistory(dedupeHistory(data.data.dbdPerksHistory));
        if (data.data.loyaltyHistory) setLoyaltyHistory(dedupeHistory(data.data.loyaltyHistory));
        if (data.data.randomKillerHistory) setRandomKillerHistory(dedupeHistory(data.data.randomKillerHistory));
        if (data.data.streamChatters) setStreamChatters(data.data.streamChatters);
      }
      // Set initial tab if not already selected or if currentTab is no longer active
      if (data.activeTabs && data.activeTabs.length > 0) {
        setCurrentTab(prev => {
          if (prev && data.activeTabs.some(t => t.id === prev)) return prev;
          return data.activeTabs[0].id;
        });
      } else {
        setCurrentTab('');
      }
    } catch (err) {
      console.error('Error fetching dock overview:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dockToken, targetUser, authUser]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Load DBD perks database to enrich perk metadata (such as character/owner name)
  useEffect(() => {
    fetch(`${API_BASE}/api/widgets/dbd-perks/perks`)
      .then(r => r.json())
      .then(data => {
        if (!data) return;
        const map = {};
        const allList = [...(data.survivor || []), ...(data.killer || [])];
        allList.forEach(p => {
          if (!p) return;
          if (p.id) map[p.id.toLowerCase()] = p;
          if (p.name) map[p.name.toLowerCase().trim()] = p;
        });
        setPerksMap(map);
      })
      .catch(() => {});
  }, []);

  // Helper to verify if an incoming real-time socket payload belongs to this Dock's streamer
  const isTargetUserEvent = useCallback((eventUserId) => {
    if (!eventUserId) return true;
    const cleanEvent = String(eventUserId).trim().toLowerCase().replace('@', '');
    const cleanTarget = String(targetUser).trim().toLowerCase().replace('@', '');
    const cleanUserId = userData?.userId ? String(userData.userId).trim().toLowerCase().replace('@', '') : '';
    const cleanUsername = userData?.username ? String(userData.username).trim().toLowerCase().replace('@', '') : '';
    return cleanEvent === cleanTarget || (cleanUserId && cleanEvent === cleanUserId) || (cleanUsername && cleanEvent === cleanUsername);
  }, [targetUser, userData]);

  // 2. Setup Socket.io Real-time connection
  useEffect(() => {
    if (!dockToken && !targetUser) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    socketRef.current = socket;
    const cleanUser = String(targetUser).trim().toLowerCase().replace('@', '');

    const joinRooms = () => {
      const ids = new Set([cleanUser]);
      if (userData?.userId) ids.add(String(userData.userId).trim().toLowerCase());
      if (userData?.username) ids.add(String(userData.username).trim().toLowerCase());
      ids.forEach(id => {
        if (dockToken) {
          socket.emit('join_user', { overlayToken: dockToken, userId: id });
          socket.emit('join_channel', { overlayToken: dockToken, channel: id });
        } else {
          socket.emit('join_user', { userId: id });
          socket.emit('join_channel', id);
        }
        socket.emit('join_user_room', id);
      });
    };

    socket.on('connect', () => {
      setConnected(true);
      joinRooms();
    });

    joinRooms();

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('overlay_token_revoked', () => {
      setError('Secret Token นี้ถูกรีเซ็ตหรือเพิกถอนสิทธิ์แล้ว กรุณาคัดลอกลิงก์ใหม่จาก Dashboard');
    });

    // Real-time Widget Status Changes
    socket.on('user_widget_status_changed', (data) => {
      if (!data?.userId || isTargetUserEvent(data.userId)) {
        fetchOverview();
      }
    });

    socket.on('widget_status_updated', (data) => {
      if (!data?.userId || isTargetUserEvent(data.userId)) {
        fetchOverview();
      }
    });

    // Real-time Spotify Events (Strictly filtered by owner user)
    socket.on('spotify_now_playing', (data) => {
      if (!data) return;
      if (data.userId && !isTargetUserEvent(data.userId)) return;
      setSpotifyData(prev => ({
        ...prev,
        isPlaying: Boolean(data.isPlaying),
        track: data.track !== undefined ? data.track : prev.track,
        progressMs: data.progressMs || 0,
        durationMs: data.durationMs || prev.durationMs || 0
      }));
    });

    socket.on('spotify_queue_updated', (data) => {
      if (!data) return;
      if (data.userId && !isTargetUserEvent(data.userId)) return;
      if (Array.isArray(data.queue)) {
        setSpotifyData(prev => ({ ...prev, queue: data.queue }));
      }
    });

    // Real-time Counter Events
    socket.on('counter_updated', (data) => {
      if (!data || data.count === undefined) return;
      if (data.userId && !isTargetUserEvent(data.userId)) return;
      setCounterData(prev => ({
        ...prev,
        count: Number(data.count),
        title: data.title || prev.title
      }));
    });

    // Real-time DBD Scoreboard Events
    socket.on('dbd_scoreboard_updated', (data) => {
      if (!data || !data.scoreData) return;
      if (data.userId && !isTargetUserEvent(data.userId)) return;
      setScoreboardData(prev => ({
        ...prev,
        killerKills: Number(data.scoreData.killerKills) || 0,
        killerDraws: Number(data.scoreData.killerDraws) || 0,
        killerEscapes: Number(data.scoreData.killerEscapes) || 0
      }));
    });

    // Real-time DBD Perks & Loyalty Card Roll History Events
    socket.on('widget_roll_history_item', (data) => {
      if (!data || !data.item) return;
      if (data.userId && !isTargetUserEvent(data.userId)) return;

      const isDuplicate = (list, item) => {
        if (!item || !Array.isArray(list)) return false;
        return list.some(h => {
          if (h.id && item.id && h.id === item.id) return true;
          const sameUser = (h.username || '').toLowerCase() === (item.username || '').toLowerCase();
          const sameResult = (h.killer || h.result || '') === (item.killer || item.result || '');
          const timeDiff = Math.abs(Number(h.timestamp || 0) - Number(item.timestamp || 0));
          return sameUser && sameResult && timeDiff < 3000;
        });
      };

      if (data.widgetId === 'dbd-perks') {
        setDbdPerksHistory(prev => {
          if (isDuplicate(prev, data.item)) return prev;
          return [data.item, ...prev].slice(0, 50);
        });
      }
      if (data.widgetId === 'loyalty-card') {
        setLoyaltyHistory(prev => {
          if (isDuplicate(prev, data.item)) return prev;
          return [data.item, ...prev].slice(0, 50);
        });
      }
      if (data.widgetId === 'random-killer') {
        setRandomKillerHistory(prev => {
          if (isDuplicate(prev, data.item)) return prev;
          return [data.item, ...prev].slice(0, 50);
        });
      }
    });

    socket.on('widget_roll_history_cleared', (data) => {
      if (!data) return;
      if (data.userId && !isTargetUserEvent(data.userId)) return;
      if (data.widgetId === 'dbd-perks') {
        setDbdPerksHistory([]);
      }
      if (data.widgetId === 'loyalty-card') {
        setLoyaltyHistory([]);
      }
      if (data.widgetId === 'random-killer') {
        setRandomKillerHistory([]);
      }
    });

    // Real-time Stream Chatters for Shoutout Dock
    socket.on('dock_stream_chatter_updated', (data) => {
      if (!data) return;
      if (data.userId && !isTargetUserEvent(data.userId)) return;
      if (Array.isArray(data.chatters)) {
        setStreamChatters(data.chatters);
      }
    });

    socket.on('dock_stream_chatter_cleared', (data) => {
      if (!data) return;
      if (data.userId && !isTargetUserEvent(data.userId)) return;
      setStreamChatters([]);
    });

    // Real-time DBD Perks Database Update
    socket.on('dbd_perks_updated', (data) => {
      if (!data) return;
      const map = {};
      const allList = [...(data.survivor || []), ...(data.killer || [])];
      allList.forEach(p => {
        if (!p) return;
        if (p.id) map[p.id.toLowerCase()] = p;
        if (p.name) map[p.name.toLowerCase().trim()] = p;
      });
      setPerksMap(map);
    });

    return () => {
      socket.disconnect();
    };
  }, [targetUser, userData?.userId, userData?.username, isTargetUserEvent, fetchOverview]);

  // --- Spotify Actions ---
  const handleTogglePlayback = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/api/spotify/playback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: targetUser, token: dockToken, userId: userData?.userId || targetUser, action: 'toggle' })
      });
      setSpotifyData(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkipTrack = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/api/spotify/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: targetUser, token: dockToken, userId: userData?.userId || targetUser })
      });
      setTimeout(fetchOverview, 1000);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteQueueItem = async (itemId) => {
    try {
      const q = new URLSearchParams({ user: targetUser, userId: userData?.userId || targetUser });
      if (dockToken) q.set('token', dockToken);
      await fetch(`${API_BASE}/api/spotify/queue/${itemId}?${q.toString()}`, {
        method: 'DELETE'
      });
      setSpotifyData(prev => ({
        ...prev,
        queue: prev.queue.filter(q => q.id !== itemId)
      }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearQueue = async () => {
    if (!window.confirm('คุณต้องการล้างคิวเพลงทั้งหมดใช่หรือไม่?')) return;
    try {
      const q = new URLSearchParams({ user: targetUser, userId: userData?.userId || targetUser });
      if (dockToken) q.set('token', dockToken);
      await fetch(`${API_BASE}/api/spotify/queue?${q.toString()}`, {
        method: 'DELETE'
      });
      setSpotifyData(prev => ({ ...prev, queue: [] }));
    } catch (e) {
      console.error(e);
    }
  };

  // --- Counter Actions ---
  const handleCounterUpdate = async (action, delta = undefined) => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/custom-counter/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: targetUser, token: dockToken, action, delta, updatedBy: 'OBS Dock' })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.count !== undefined) {
          setCounterData(prev => ({ ...prev, count: Number(result.count) }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- Scoreboard Actions ---
  const handleScoreboardUpdate = async (action) => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/dbd-scoreboard/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: targetUser, token: dockToken, action, updatedBy: 'OBS Dock' })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.scores) {
          setScoreboardData(prev => ({
            ...prev,
            killerKills: Number(result.scores.killerKills) || 0,
            killerDraws: Number(result.scores.killerDraws) || 0,
            killerEscapes: Number(result.scores.killerEscapes) || 0
          }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- DBD Perks Actions ---

  const handleClearDbdPerksHistory = async () => {
    if (!window.confirm('คุณต้องการล้างประวัติการสุ่มเปิร์คทั้งหมดใช่หรือไม่?')) return;
    try {
      const q = new URLSearchParams({ user: targetUser });
      if (dockToken) q.set('token', dockToken);
      await fetch(`${API_BASE}/api/widgets/dbd-perks/history?${q.toString()}`, {
        method: 'DELETE'
      });
      setDbdPerksHistory([]);
    } catch (e) {
      console.error(e);
    }
  };

  // สรุปยอดเช็คอินของผู้ใช้แต่ละคน (Loyalty Card Leaderboard)
  const loyaltyUserSummary = useMemo(() => {
    const map = new Map();
    for (const item of loyaltyHistory) {
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
  }, [loyaltyHistory]);

  // --- Loyalty Card Actions ---
  const handleSimulateLoyaltyCard = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/widgets/loyalty-card/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: targetUser, token: dockToken, username: userData?.displayName || targetUser })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.item) {
          setLoyaltyHistory(prev => {
            const exists = prev.some(it => it.id === result.item.id);
            if (exists) return prev;
            return [result.item, ...prev].slice(0, 50);
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearLoyaltyHistory = async () => {
    if (!window.confirm('คุณต้องการล้างประวัติการแลกแต้ม Loyalty Card ทั้งหมดใช่หรือไม่?')) return;
    try {
      const q = new URLSearchParams({ user: targetUser });
      if (dockToken) q.set('token', dockToken);
      await fetch(`${API_BASE}/api/widgets/loyalty-card/history?${q.toString()}`, {
        method: 'DELETE'
      });
      setLoyaltyHistory([]);
    } catch (e) {
      console.error(e);
    }
  };

  // --- DBD Random Killer Actions ---

  const handleClearRandomKillerHistory = async () => {
    if (!window.confirm('คุณต้องการล้างประวัติการสุ่มคิลเลอร์ทั้งหมดใช่หรือไม่?')) return;
    try {
      const q = new URLSearchParams({ user: targetUser });
      if (dockToken) q.set('token', dockToken);
      await fetch(`${API_BASE}/api/widgets/random-killer/history?${q.toString()}`, {
        method: 'DELETE'
      });
      setRandomKillerHistory([]);
    } catch (e) {
      console.error(e);
    }
  };

  // --- Twitch Shoutout Actions ---
  const handleTriggerShoutout = async (targetUsername) => {
    if (!targetUsername || actionLoading) return;
    setActionLoading(true);
    try {
      setStreamChatters(prev => prev.map(c => {
        if (c.username.toLowerCase() === targetUsername.toLowerCase()) {
          return { ...c, isShoutedOut: true, shoutedOutTime: Date.now() };
        }
        return c;
      }));

      await fetch(`${API_BASE}/api/dock/shoutout/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: targetUser,
          token: dockToken,
          targetUsername: targetUsername
        })
      });
    } catch (e) {
      console.error('Error triggering shoutout:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearStreamChatters = async () => {
    if (!window.confirm('ล้างรายชื่อผู้ชมของสตรีมปัจจุบันทั้งหมดหรือไม่?')) return;
    if (actionLoading) return;
    setActionLoading(true);
    try {
      setStreamChatters([]);
      await fetch(`${API_BASE}/api/dock/shoutout/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: targetUser, token: dockToken })
      });
    } catch (e) {
      console.error('Error clearing stream chatters:', e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateChatter = async () => {
    const name = window.prompt('พิมพ์ชื่อ Twitch ของคนดูที่ต้องการจำลอง:');
    if (!name || !name.trim()) return;
    const cleanName = name.trim().replace(/^@/, '');
    try {
      await fetch(`${API_BASE}/api/dock/shoutout/simulate-chatter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: targetUser,
          token: dockToken,
          username: cleanName,
          message: 'สวัสดีครับ มาดูสตรีมแล้ว!'
        })
      });
    } catch (e) {
      console.error('Error simulating chatter:', e);
    }
  };

  const handleQuickCustomShoutout = async (e) => {
    if (e) e.preventDefault();
    if (!customSoUser || !customSoUser.trim()) return;
    const target = customSoUser.trim().replace(/^@/, '');
    await handleTriggerShoutout(target);
    setCustomSoUser('');
  };

  const filteredChatters = useMemo(() => {
    if (!chatterSearch.trim()) return streamChatters;
    const q = chatterSearch.trim().toLowerCase();
    return streamChatters.filter(c =>
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.displayName && c.displayName.toLowerCase().includes(q)) ||
      (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
    );
  }, [streamChatters, chatterSearch]);

  // Helper time formatters
  const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatRelativeTime = (ts) => {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - Number(ts)) / 1000);
    if (diff < 60) return 'เมื่อสักครู่';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีก่อน`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ก่อน`;
    return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  // 3. Render Empty / Missing user state
  if (!dockToken && !targetUser) {
    return (
      <div className="dock-container">
        <div className="dock-state-center">
          <div className="dock-state-icon">
            <Radio size={32} />
          </div>
          <div className="dock-state-title">ไม่พบ Secret Token สำหรับ OBS Dock</div>
          <div className="dock-state-desc">
            ระบบได้ยกเลิกรูปแบบลิงก์เก่าแล้วเพื่อความปลอดภัย<br />
            กรุณาไปที่ Dashboard และคัดลอกลิงก์ OBS Quick Dock ใหม่ที่มี Secret Token
          </div>
          <Link to="/dashboard" className="dock-btn dock-btn-primary" style={{ textDecoration: 'none', marginTop: '0.5rem' }}>
            ไปยัง Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dock-container">
        <div className="dock-state-center">
          <div className="dock-state-icon">
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <div className="dock-state-title">กำลังโหลด OBS Dock...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dock-container">
        <div className="dock-state-center">
          <div className="dock-state-icon">
            <AlertTriangle size={32} />
          </div>
          <div className="dock-state-title">เกิดข้อผิดพลาด</div>
          <div className="dock-state-desc">{error}</div>
          <button onClick={fetchOverview} className="dock-btn dock-btn-primary">ลองใหม่อีกครั้ง</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dock-container">
      {/* 1. Header Bar */}
      <div className="dock-header">
        <div className="dock-brand">
          <img
            src="/electric-chicken.webp"
            alt="FASTCHICK"
            style={{
              width: '18px',
              height: '18px',
              objectFit: 'contain'
            }}
          />
          <span className="dock-logo-text">FASTCHICK</span>
          <span className="dock-badge">DOCK</span>
        </div>
        <div className="dock-user-info">
          <span className={`dock-status-dot ${connected ? '' : 'offline'}`} title={connected ? 'Connected to stream' : 'Reconnecting...'} />
          <span className="dock-username">@{userData?.displayName || targetUser}</span>
          <button onClick={fetchOverview} className="dock-refresh-btn" title="Refresh data">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* 2. Auto-Detected Dynamic Tabs */}
      {activeTabs.length > 0 ? (
        <div className="dock-tabs-nav">
          {activeTabs.map(tab => {
            const isSpotify = tab.id === 'spotify-sr';
            const queueCount = isSpotify && spotifyData?.queue ? spotifyData.queue.length : 0;
            const isShoutout = tab.id === 'twitch-shoutout';
            const pendingSoCount = isShoutout ? streamChatters.filter(c => !c.isShoutedOut).length : 0;
            const badgeCount = queueCount || pendingSoCount;
            const TabIcon = TAB_ICONS[tab.id] || Sliders;
            return (
              <button
                key={tab.id}
                className={`dock-tab-btn ${currentTab === tab.id ? 'active' : ''}`}
                onClick={() => setCurrentTab(tab.id)}
              >
                <TabIcon size={14} style={{ flexShrink: 0 }} />
                <span>{tab.name}</span>
                {badgeCount > 0 && <span className="dock-tab-badge">{badgeCount}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="dock-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', opacity: 0.6 }}>
            <Inbox size={32} />
          </div>
          <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>ยังไม่มี Widget ที่เปิดใช้งาน</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--dock-text-muted)', marginBottom: '1rem' }}>
            เมื่อคุณเปิดใช้งานหรือตั้งค่า Widget (เช่น Spotify, Counter, DBD) ใน Dashboard ระบบจะแสดงแท็บควบคุมตรงนี้ให้อัตโนมัติ
          </div>
          <Link to="/dashboard" className="dock-btn dock-btn-primary" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            เปิด Dashboard เพื่อตั้งค่า
          </Link>
        </div>
      )}

      {/* 3. Tab Contents */}
      <div className="dock-content">
        {/* --- TAB: Spotify Song Request --- */}
        {currentTab === 'spotify-sr' && (
          <>
            <div className="dock-card">
              <div className="dock-card-title">
                <span>กำลังเล่น (Now Playing)</span>
                <span style={{ color: spotifyData.isPlaying ? 'var(--dock-spotify)' : 'var(--dock-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {spotifyData.isPlaying ? (
                    <><Play size={12} fill="currentColor" /> กำลังเล่น</>
                  ) : (
                    <><Pause size={12} fill="currentColor" /> หยุดชั่วคราว</>
                  )}
                </span>
              </div>

              {spotifyData.track ? (
                <div className="dock-player">
                  <img
                    src={spotifyData.track.albumArt || 'https://via.placeholder.com/64?text=Spotify'}
                    alt="Album Art"
                    className="dock-album-art"
                  />
                  <div className="dock-track-info">
                    <div className="dock-track-name" title={spotifyData.track.name}>
                      {spotifyData.track.name}
                    </div>
                    <div className="dock-track-artist" title={spotifyData.track.artists}>
                      {spotifyData.track.artists}
                    </div>
                    <div className="dock-progress-bar-wrap">
                      <div
                        className="dock-progress-bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((spotifyData.progressMs || 0) / (spotifyData.durationMs || 1)) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="dock-empty-hint">
                  {spotifyData.connected ? 'ไม่มีเพลงกำลังเล่นใน Spotify ตอนนี้' : 'ยังไม่ได้เชื่อมต่อบัญชี Spotify'}
                </div>
              )}

              <div className="dock-controls-grid">
                <button
                  className={`dock-btn ${spotifyData.isPlaying ? 'dock-btn-secondary' : 'dock-btn-spotify'}`}
                  onClick={handleTogglePlayback}
                  disabled={actionLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {spotifyData.isPlaying ? (
                    <><Pause size={14} /> หยุดเพลง</>
                  ) : (
                    <><Play size={14} /> เล่นเพลง</>
                  )}
                </button>
                <button
                  className="dock-btn dock-btn-secondary"
                  onClick={handleSkipTrack}
                  disabled={actionLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <SkipForward size={14} /> ข้ามเพลง (Skip)
                </button>
              </div>
            </div>

            {/* Queue List */}
            <div className="dock-card">
              <div className="dock-card-title">
                <span>คิวขอเพลง ({spotifyData.queue?.length || 0})</span>
                {spotifyData.queue?.length > 0 && (
                  <button
                    onClick={handleClearQueue}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    ล้างคิวทั้งหมด
                  </button>
                )}
              </div>

              {spotifyData.queue && spotifyData.queue.length > 0 ? (
                <div className="dock-queue-list">
                  {spotifyData.queue.map((item, idx) => (
                    <div key={item.id || idx} className="dock-queue-item">
                      <div className="dock-queue-item-info">
                        <div className="dock-queue-track-name">
                          {idx + 1}. {item.track?.name || 'เพลงที่ขอ'}
                        </div>
                        <div className="dock-queue-requester">
                          @{item.requester || 'แชท'} • {item.track?.artists || ''}
                        </div>
                      </div>
                      <button
                        className="dock-queue-del-btn"
                        onClick={() => handleDeleteQueueItem(item.id)}
                        title="ลบเพลงนี้ออกจากคิว"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dock-empty-hint">
                  ยังไม่มีคิวเพลงในขณะนี้
                  <br /><span style={{ fontSize: '0.72rem', color: '#64748b' }}>คนดูสามารถขอเพลงด้วย !sr หรือแต้มช่อง</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* --- TAB: Custom Counter --- */}
        {currentTab === 'custom-counter' && (
          <div className="dock-card">
            <div className="dock-counter-display">
              <div className="dock-counter-title">{counterData.title}</div>
              <div className="dock-counter-number">{counterData.count}</div>
              <div className="dock-counter-unit">{counterData.unit}</div>
            </div>

            {/* Big Action Buttons */}
            <div className="dock-counter-actions">
              <button
                className="dock-btn dock-btn-primary"
                style={{ fontSize: '1.2rem', padding: '0.85rem' }}
                onClick={() => handleCounterUpdate('inc', counterData.stepAmount || 1)}
              >
                +{counterData.stepAmount || 1}
              </button>
              <button
                className="dock-btn dock-btn-secondary"
                style={{ fontSize: '1.2rem', padding: '0.85rem' }}
                onClick={() => handleCounterUpdate('dec', counterData.stepAmount || 1)}
              >
                -{counterData.stepAmount || 1}
              </button>
            </div>

            <div className="dock-counter-actions-row">
              <button className="dock-btn dock-btn-secondary" onClick={() => handleCounterUpdate('inc', 5)}>
                +5
              </button>
              <button className="dock-btn dock-btn-secondary" onClick={() => handleCounterUpdate('inc', 10)}>
                +10
              </button>
              <button className="dock-btn dock-btn-danger" onClick={() => handleCounterUpdate('reset')}>
                Reset (0)
              </button>
            </div>
          </div>
        )}

        {/* --- TAB: DBD Scoreboard --- */}
        {currentTab === 'dbd-scoreboard' && (
          <div className="dock-card">
            <div className="dock-card-title">
              <span>{scoreboardData.title || 'Dead by Daylight Scoreboard'}</span>
            </div>

            <div className="dock-scoreboard-grid">
              {/* Wins */}
              <div className="dock-stat-box win">
                <span className="dock-stat-label">{scoreboardData.stat1Title || 'WINS'}</span>
                <span className="dock-stat-value" style={{ color: '#34d399' }}>{scoreboardData.killerKills}</span>
                <button
                  className="dock-btn dock-btn-secondary"
                  style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem', marginTop: '0.35rem' }}
                  onClick={() => handleScoreboardUpdate('win')}
                >
                  +1 Win
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--dock-text-muted)', fontSize: '0.68rem', cursor: 'pointer', marginTop: '0.25rem' }}
                  onClick={() => handleScoreboardUpdate('undo_win')}
                >
                  Undo
                </button>
              </div>

              {/* Draws */}
              <div className="dock-stat-box draw">
                <span className="dock-stat-label">{scoreboardData.stat3Title || 'DRAWS'}</span>
                <span className="dock-stat-value" style={{ color: '#fbbf24' }}>{scoreboardData.killerDraws}</span>
                <button
                  className="dock-btn dock-btn-secondary"
                  style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem', marginTop: '0.35rem' }}
                  onClick={() => handleScoreboardUpdate('draw')}
                >
                  +1 Draw
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--dock-text-muted)', fontSize: '0.68rem', cursor: 'pointer', marginTop: '0.25rem' }}
                  onClick={() => handleScoreboardUpdate('undo_draw')}
                >
                  Undo
                </button>
              </div>

              {/* Loses */}
              <div className="dock-stat-box lose">
                <span className="dock-stat-label">{scoreboardData.stat2Title || 'LOSES'}</span>
                <span className="dock-stat-value" style={{ color: '#f87171' }}>{scoreboardData.killerEscapes}</span>
                <button
                  className="dock-btn dock-btn-secondary"
                  style={{ width: '100%', padding: '0.35rem', fontSize: '0.75rem', marginTop: '0.35rem' }}
                  onClick={() => handleScoreboardUpdate('lose')}
                >
                  +1 Lose
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--dock-text-muted)', fontSize: '0.68rem', cursor: 'pointer', marginTop: '0.25rem' }}
                  onClick={() => handleScoreboardUpdate('undo_lose')}
                >
                  Undo
                </button>
              </div>
            </div>

            <button
              className="dock-btn dock-btn-danger"
              style={{ width: '100%', fontSize: '0.78rem', padding: '0.45rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={() => {
                if (window.confirm('รีเซ็ตสถิติทั้งหมดในตาราง DBD หรือไม่?')) {
                  handleScoreboardUpdate('reset');
                }
              }}
            >
              <RotateCcw size={14} /> รีเซ็ตสถิติทั้งหมด (0-0-0)
            </button>
          </div>
        )}

        {/* --- TAB: DBD Perks with Roll History --- */}
        {currentTab === 'dbd-perks' && (
          <div className="dock-card">
            <div className="dock-card-title">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Dices size={14} style={{ color: 'var(--dock-accent, #6366f1)' }} />
                ประวัติการสุ่มเปิร์ค ({dbdPerksHistory.length})
              </span>
              {dbdPerksHistory.length > 0 && (
                  <button
                    onClick={handleClearDbdPerksHistory}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    ล้างประวัติ
                  </button>
                )}
              </div>

              {dbdPerksHistory.length > 0 ? (
                <div className="dock-history-list">
                  {dbdPerksHistory.map((item, idx) => (
                    <div key={item.id || idx} className="dock-history-item">
                      <div className="dock-history-header">
                        <div className="dock-history-user">
                          {item.avatar && (
                            <img
                              src={item.avatar}
                              alt={item.username || 'User'}
                              className="dock-history-avatar"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          )}
                          <span className="dock-history-username">@{item.username || 'ผู้ชม'}</span>
                          <span className={`dock-role-badge ${item.role === 'killer' ? 'killer' : 'survivor'}`}>
                            {item.role === 'killer' ? 'Killer' : 'Survivor'}
                          </span>
                          {item.rewardTitle && (
                            <span className="dock-reward-tag">{item.rewardTitle}</span>
                          )}
                        </div>
                        <span className="dock-history-time">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      {/* 4 Perks Grid */}
                      {Array.isArray(item.perks) && item.perks.length > 0 ? (
                        <div className="dock-perks-grid">
                          {item.perks.map((p, pIdx) => {
                            const enrichedPerk = perksMap[p.id?.toLowerCase()] || perksMap[p.name?.toLowerCase().trim()] || p;
                            const charName = p.character || enrichedPerk.character || '';
                            const iconUrl = p.icon ? (p.icon.startsWith('http') ? p.icon : `${API_BASE}${p.icon}`) : (enrichedPerk.icon ? (enrichedPerk.icon.startsWith('http') ? enrichedPerk.icon : `${API_BASE}${enrichedPerk.icon}`) : '');
                            return (
                              <div key={p.id || pIdx} className="dock-perk-badge" title={`${p.name}${charName ? ` (${charName})` : ''}`}>
                                {iconUrl ? (
                                  <img
                                    src={iconUrl}
                                    alt={p.name}
                                    className="dock-perk-icon"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="dock-perk-icon-fallback" />
                                )}
                                <div className="dock-perk-info">
                                  <div className="dock-perk-name">{p.name}</div>
                                  {charName && (
                                    <div className="dock-perk-char">{charName}</div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="dock-history-raw-result">
                          {item.result || item.killer || 'สุ่มสำเร็จ'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dock-empty-hint">
                  ยังไม่มีประวัติการสุ่มเปิร์ค
                  <br /><span style={{ fontSize: '0.72rem', color: '#64748b' }}>เมื่อผู้ชมพิมพ์สุ่มเปิร์ค รายการจะแสดงตรงนี้แบบ Real-time</span>
                </div>
              )}
            </div>
        )}

        {/* --- TAB: Loyalty Card with Redemption History & Summary --- */}
        {currentTab === 'loyalty-card' && (
          <>
            <div className="dock-card">
              <div className="dock-card-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Ticket size={14} style={{ color: '#FF9F0A' }} />
                  Loyalty Stamp Card
                </span>
                <span className="dock-badge" style={{ background: 'rgba(255, 159, 10, 0.15)', color: '#FF9F0A', borderColor: 'rgba(255, 159, 10, 0.3)' }}>
                  STAMP
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--dock-text-muted)', marginBottom: '0.75rem' }}>
                บันทึกการสะสมแสตมป์และการเช็คอินของผู้ชมจาก Twitch Channel Points แบบเรียลไทม์
              </div>
              <div className="dock-controls-grid" style={{ gridTemplateColumns: '1fr' }}>
                <button
                  className="dock-btn dock-btn-primary"
                  onClick={handleSimulateLoyaltyCard}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Ticket size={14} /> จำลองการแลกแต้มเช็คอิน
                </button>
              </div>
            </div>

            {/* Top Viewers / Leaderboard Summary */}
            {loyaltyUserSummary.length > 0 && (
              <div className="dock-card">
                <div className="dock-card-title">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={13} style={{ color: '#FF9F0A' }} />
                    ยอดเช็คอินสะสม ({loyaltyUserSummary.length} คน)
                  </span>
                </div>
                <div className="dock-loyalty-leaderboard">
                  {loyaltyUserSummary.slice(0, 6).map((u, idx) => (
                    <div key={u.username || idx} className="dock-loyalty-user-row">
                      <div className="dock-loyalty-user-left">
                        <img
                          src={u.avatar || `/api/twitch/avatar/${encodeURIComponent(u.username)}`}
                          alt={u.username}
                          className="dock-history-avatar"
                          onError={(e) => {
                            e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                          }}
                        />
                        <span className="dock-history-username">@{u.username}</span>
                      </div>
                      <span className="dock-loyalty-count-badge">
                        <Award size={11} /> {u.count} แต้ม
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Redemption History Card */}
            <div className="dock-card">
              <div className="dock-card-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={13} style={{ color: 'var(--dock-accent, #6366f1)' }} />
                  ประวัติการแลกแต้ม ({loyaltyHistory.length})
                </span>
                {loyaltyHistory.length > 0 && (
                  <button
                    onClick={handleClearLoyaltyHistory}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    ล้างประวัติ
                  </button>
                )}
              </div>

              {loyaltyHistory.length > 0 ? (
                <div className="dock-history-list">
                  {loyaltyHistory.map((item, idx) => (
                    <div key={item.id || idx} className="dock-history-item">
                      <div className="dock-history-header">
                        <div className="dock-history-user">
                          <img
                            src={item.avatar || `/api/twitch/avatar/${encodeURIComponent(item.username || '')}`}
                            alt={item.username || 'User'}
                            className="dock-history-avatar"
                            onError={(e) => {
                              e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                            }}
                          />
                          <span className="dock-history-username">@{item.username || 'ผู้ชม'}</span>
                          <span className="dock-role-badge survivor" style={{ background: 'rgba(255, 159, 10, 0.15)', color: '#FF9F0A', borderColor: 'rgba(255, 159, 10, 0.3)' }}>
                            แต้มที่ {item.count !== undefined ? item.count : 1}
                          </span>
                          {item.rewardTitle && (
                            <span className="dock-reward-tag">{item.rewardTitle}</span>
                          )}
                        </div>
                        <span className="dock-history-time">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>
                      <div className="dock-loyalty-history-result">
                        {item.result || `เช็คอินครั้งที่ ${item.count || 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dock-empty-hint">
                  ยังไม่มีประวัติการแลกแต้ม
                  <br /><span style={{ fontSize: '0.72rem', color: '#64748b' }}>เมื่อผู้ชมแลกแต้มสะสมบน Twitch รายการจะแสดงตรงนี้แบบ Real-time</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* --- TAB: DBD Random Killer with Roll History --- */}
        {currentTab === 'random-killer' && (
          <div className="dock-card">
            <div className="dock-card-title">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Skull size={14} style={{ color: '#ef4444' }} />
                ประวัติการสุ่ม Killer Roulette ({randomKillerHistory.length})
              </span>
              {randomKillerHistory.length > 0 && (
                  <button
                    onClick={handleClearRandomKillerHistory}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    ล้างประวัติ
                  </button>
                )}
              </div>

              {randomKillerHistory.length > 0 ? (
                <div className="dock-history-list">
                  {randomKillerHistory.map((item, idx) => (
                    <div key={item.id || idx} className="dock-history-item">
                      <div className="dock-history-header">
                        <div className="dock-history-user">
                          <img
                            src={item.avatar || `/api/twitch/avatar/${encodeURIComponent(item.username || '')}`}
                            alt={item.username || 'User'}
                            className="dock-history-avatar"
                            onError={(e) => {
                              e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                            }}
                          />
                          <span className="dock-history-username">@{item.username || 'ผู้ชม'}</span>
                          <span className="dock-role-badge killer">
                            Killer
                          </span>
                          {item.rewardTitle && (
                            <span className="dock-reward-tag">{item.rewardTitle}</span>
                          )}
                        </div>
                        <span className="dock-history-time">
                          {formatRelativeTime(item.timestamp)}
                        </span>
                      </div>

                      {/* Killer Display Card */}
                      <div className="dock-killer-card">
                        {item.killerImg ? (
                          <img
                            src={item.killerImg}
                            alt={item.killer || item.result || 'Killer'}
                            className="dock-killer-thumb"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="dock-killer-fallback">
                            <Skull size={18} />
                          </div>
                        )}
                        <div className="dock-killer-info">
                          <div className="dock-killer-name">
                            {item.killer || item.result || 'ไม่ทราบผลลัพธ์'}
                          </div>
                          <div className="dock-killer-role">Dead by Daylight Killer</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dock-empty-hint">
                  ยังไม่มีประวัติการสุ่มคิลเลอร์
                  <br /><span style={{ fontSize: '0.72rem', color: '#64748b' }}>เมื่อผู้ชมแลกสุ่มคิลเลอร์บน Twitch รายการจะแสดงตรงนี้แบบ Real-time</span>
                </div>
              )}
            </div>
        )}

        {/* --- TAB: Twitch Shoutout Stream Chatters --- */}
        {currentTab === 'twitch-shoutout' && (
          <>
            <div className="dock-card">
              <div className="dock-card-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Megaphone size={14} style={{ color: '#a855f7' }} />
                  Twitch Shoutout
                </span>
                <span className="dock-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                  STREAM CHATTERS
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--dock-text-muted)', marginBottom: '0.75rem' }}>
                แสดงรายชื่อผู้ชมที่พิมพ์ในแชทสตรีมปัจจุบันแบบ Real-time เพื่อให้กดปุ่ม SO แนะนำช่องได้ทันที
              </div>


              {/* Quick Actions Bar */}
              <div className="dock-so-quick-actions">
                <button
                  type="button"
                  className="dock-btn dock-btn-danger"
                  onClick={handleClearStreamChatters}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                  title="ล้างรายชื่อคนดูทั้งหมดเพื่อเริ่มสตรีมรอบใหม่"
                >
                  <RotateCcw size={13} /> ล้างรายชื่อ (เริ่มสตรีมใหม่)
                </button>
              </div>

              {/* Quick Custom Shoutout Form */}
              <form onSubmit={handleQuickCustomShoutout} className="dock-so-custom-form">
                <input
                  type="text"
                  value={customSoUser}
                  onChange={(e) => setCustomSoUser(e.target.value)}
                  placeholder="พิมพ์ชื่อ Twitch ช่องที่ต้องการ SO..."
                  className="dock-so-custom-input"
                />
                <button
                  type="submit"
                  disabled={!customSoUser.trim() || actionLoading}
                  className="dock-btn dock-btn-primary"
                  style={{ whiteSpace: 'nowrap', padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                >
                  <Megaphone size={13} /> ยิง SO
                </button>
              </form>
            </div>

            {/* Stream Chatters List Card */}
            <div className="dock-card">
              <div className="dock-card-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={13} style={{ color: 'var(--dock-accent, #6366f1)' }} />
                  ผู้ชมที่พิมพ์ในสตรีมนี้ ({filteredChatters.length})
                </span>
                {streamChatters.length > 0 && (
                  <button
                    onClick={handleClearStreamChatters}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    ล้าง
                  </button>
                )}
              </div>

              {/* Search filter if more than 3 chatters */}
              {streamChatters.length > 3 && (
                <div className="dock-so-search-wrap">
                  <Search size={13} className="dock-so-search-icon" />
                  <input
                    type="text"
                    value={chatterSearch}
                    onChange={(e) => setChatterSearch(e.target.value)}
                    placeholder="ค้นหาชื่อผู้ชม..."
                    className="dock-so-search-input"
                  />
                  {chatterSearch && (
                    <button
                      type="button"
                      onClick={() => setChatterSearch('')}
                      className="dock-so-search-clear"
                    >
                      ล้าง
                    </button>
                  )}
                </div>
              )}

              {filteredChatters.length > 0 ? (
                <div className="dock-so-list">
                  {filteredChatters.map((item, idx) => (
                    <div key={item.username || idx} className={`dock-so-item ${item.isShoutedOut ? 'shouted' : ''}`}>
                      <div className="dock-so-item-main">
                        <img
                          src={item.avatar || `/api/twitch/avatar/${encodeURIComponent(item.username)}`}
                          alt={item.username}
                          className="dock-so-avatar"
                          onError={(e) => {
                            e.target.src = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png';
                          }}
                        />
                        <div className="dock-so-info">
                          <div className="dock-so-name-row">
                            <span className="dock-so-username">@{item.displayName || item.username}</span>
                            {item.displayName?.toLowerCase() !== item.username?.toLowerCase() && (
                              <span className="dock-so-login">({item.username})</span>
                            )}
                            <span className="dock-so-time">{formatRelativeTime(item.lastSeen)}</span>
                          </div>
                          {item.lastMessage && (
                            <div className="dock-so-msg" title={item.lastMessage}>
                              &ldquo;{item.lastMessage}&rdquo;
                            </div>
                          )}
                          <div className="dock-so-tags-row">
                            {item.isShoutedOut ? (
                              <span className="dock-so-tag done">
                                <Check size={11} /> SO แล้ว {item.shoutedOutTime ? `(${formatRelativeTime(item.shoutedOutTime)})` : ''}
                              </span>
                            ) : (
                              <span className="dock-so-tag pending">
                                รอ SO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="dock-so-item-action">
                        {item.isShoutedOut ? (
                          <button
                            type="button"
                            className="dock-btn dock-btn-secondary dock-so-action-btn done"
                            onClick={() => handleTriggerShoutout(item.username)}
                            disabled={actionLoading}
                            title="คลิกเพื่อส่ง Shoutout อีกครั้ง"
                          >
                            <RotateCcw size={12} /> SO ซ้ำ
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="dock-btn dock-btn-primary dock-so-action-btn"
                            onClick={() => handleTriggerShoutout(item.username)}
                            disabled={actionLoading}
                            title="คลิกเพื่อส่ง Shoutout แนะนำช่องของคนนี้"
                          >
                            <Megaphone size={13} /> SO
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dock-empty-hint">
                  {chatterSearch ? (
                    'ไม่พบชื่อผู้ชมที่ตรงกับการค้นหา'
                  ) : (
                    <>
                      ยังไม่มีคนดูพิมพ์ในแชทสตรีมปัจจุบัน
                      <br /><span style={{ fontSize: '0.72rem', color: '#64748b' }}>เมื่อผู้ชมพิมพ์ข้อความในแชท Twitch รายชื่อจะเด้งขึ้นตรงนี้ทันทีเพื่อให้กด SO ได้สะดวกรวดเร็ว</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* --- TAB: Generic/Roulette/Other widgets --- */}
        {currentTab && currentTab !== 'spotify-sr' && currentTab !== 'custom-counter' && currentTab !== 'dbd-scoreboard' && currentTab !== 'dbd-perks' && currentTab !== 'loyalty-card' && currentTab !== 'random-killer' && currentTab !== 'twitch-shoutout' && (
          <div className="dock-card" style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem', color: 'var(--dock-accent, #6366f1)' }}>
              {(() => {
                const IconComponent = TAB_ICONS[currentTab] || Sliders;
                return <IconComponent size={36} />;
              })()}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.35rem' }}>
              {activeTabs.find(t => t.id === currentTab)?.name}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--dock-text-muted)', marginBottom: '1rem' }}>
              Widget นี้ทำงานผ่านการพิมพ์แชทหรือคำสั่งของผู้ชมโดยอัตโนมัติบนจอ OBS
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
