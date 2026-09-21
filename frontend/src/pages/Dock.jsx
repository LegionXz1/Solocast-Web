import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import './Dock.css';

export default function Dock() {
  const [searchParams] = useSearchParams();
  const { user: authUser } = useAuth();

  // Target streamer user identifier (priority: ?user= query param, then logged-in user ID/username)
  const targetUser = searchParams.get('user') || searchParams.get('userId') || authUser?.userId || authUser?.username || '';

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

  // Action feedback states
  const [actionLoading, setActionLoading] = useState(false);
  const socketRef = useRef(null);

  // 1. Fetch Dock Overview
  const fetchOverview = useCallback(async () => {
    if (!targetUser) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/dock/overview?user=${encodeURIComponent(targetUser)}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUserData(data.user);
      setActiveTabs(data.activeTabs || []);
      if (data.data) {
        if (data.data.spotify) setSpotifyData(data.data.spotify);
        if (data.data.counter) setCounterData(data.data.counter);
        if (data.data.scoreboard) setScoreboardData(data.data.scoreboard);
      }
      // Set initial tab if not already selected
      if (data.activeTabs && data.activeTabs.length > 0) {
        setCurrentTab(prev => {
          if (prev && data.activeTabs.some(t => t.id === prev)) return prev;
          return data.activeTabs[0].id;
        });
      }
    } catch (err) {
      console.error('Error fetching dock overview:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUser]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // 2. Setup Socket.io Real-time connection
  useEffect(() => {
    if (!targetUser) return;

    const socket = io(API_BASE, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const cleanUser = String(targetUser).trim().toLowerCase().replace('@', '');
      socket.emit('join_user_room', cleanUser);
      if (userData?.userId) {
        socket.emit('join_user_room', String(userData.userId));
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Real-time Spotify Events
    socket.on('spotify_now_playing', (data) => {
      if (data) {
        setSpotifyData(prev => ({
          ...prev,
          isPlaying: Boolean(data.isPlaying),
          track: data.track || prev.track,
          progressMs: data.progressMs || 0,
          durationMs: data.durationMs || prev.durationMs || 0
        }));
      }
    });

    socket.on('spotify_queue_updated', (data) => {
      if (data && Array.isArray(data.queue)) {
        setSpotifyData(prev => ({ ...prev, queue: data.queue }));
      }
    });

    // Real-time Counter Events
    socket.on('counter_updated', (data) => {
      if (data && data.count !== undefined) {
        setCounterData(prev => ({
          ...prev,
          count: Number(data.count),
          title: data.title || prev.title
        }));
      }
    });

    // Real-time DBD Scoreboard Events
    socket.on('dbd_scoreboard_updated', (data) => {
      if (data && data.scoreData) {
        setScoreboardData(prev => ({
          ...prev,
          killerKills: Number(data.scoreData.killerKills) || 0,
          killerDraws: Number(data.scoreData.killerDraws) || 0,
          killerEscapes: Number(data.scoreData.killerEscapes) || 0
        }));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [targetUser, userData?.userId]);

  // --- Spotify Actions ---
  const handleTogglePlayback = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/api/spotify/playback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: targetUser, action: 'toggle' }),
        credentials: 'include'
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
        body: JSON.stringify({ user: targetUser }),
        credentials: 'include'
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
      await fetch(`${API_BASE}/api/spotify/queue/${itemId}?user=${encodeURIComponent(targetUser)}`, {
        method: 'DELETE',
        credentials: 'include'
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
      await fetch(`${API_BASE}/api/spotify/queue?user=${encodeURIComponent(targetUser)}`, {
        method: 'DELETE',
        credentials: 'include'
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
        body: JSON.stringify({ user: targetUser, action, delta, updatedBy: 'OBS Dock' })
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
        body: JSON.stringify({ user: targetUser, action, updatedBy: 'OBS Dock' })
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

  // Helper time formatter
  const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 3. Render Empty / Missing user state
  if (!targetUser) {
    return (
      <div className="dock-container">
        <div className="dock-state-center">
          <div className="dock-state-icon">📡</div>
          <div className="dock-state-title">ไม่พบชื่อผู้ใช้สำหรับ OBS Dock</div>
          <div className="dock-state-desc">
            กรุณาใส่ Parameter <code>?user=ชื่อTwitch</code> ที่ URL ของ Custom Dock ใน OBS
            <br />ตัวอย่าง: <code>/dock?user=legionxiz</code>
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
          <div className="dock-state-icon" style={{ animation: 'spin 1s linear infinite' }}>⏳</div>
          <div className="dock-state-title">กำลังโหลด OBS Dock...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dock-container">
        <div className="dock-state-center">
          <div className="dock-state-icon">⚠️</div>
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
          <span className="dock-logo-text">SOLOCAST</span>
          <span className="dock-badge">DOCK</span>
        </div>
        <div className="dock-user-info">
          <span className={`dock-status-dot ${connected ? '' : 'offline'}`} title={connected ? 'Connected to stream' : 'Reconnecting...'} />
          <span className="dock-username">@{userData?.displayName || targetUser}</span>
          <button onClick={fetchOverview} className="dock-refresh-btn" title="Refresh data">
            🔄
          </button>
        </div>
      </div>

      {/* 2. Auto-Detected Dynamic Tabs */}
      {activeTabs.length > 0 ? (
        <div className="dock-tabs-nav">
          {activeTabs.map(tab => {
            const isSpotify = tab.id === 'spotify-sr';
            const queueCount = isSpotify && spotifyData?.queue ? spotifyData.queue.length : 0;
            return (
              <button
                key={tab.id}
                className={`dock-tab-btn ${currentTab === tab.id ? 'active' : ''}`}
                onClick={() => setCurrentTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
                {queueCount > 0 && <span className="dock-tab-badge">{queueCount}</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="dock-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
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
                <span style={{ color: spotifyData.isPlaying ? 'var(--dock-spotify)' : 'var(--dock-text-muted)' }}>
                  {spotifyData.isPlaying ? '▶ กำลังเล่น' : '⏸ หยุดชั่วคราว'}
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
                >
                  {spotifyData.isPlaying ? '⏸ หยุดเพลง' : '▶ เล่นเพลง'}
                </button>
                <button
                  className="dock-btn dock-btn-secondary"
                  onClick={handleSkipTrack}
                  disabled={actionLoading}
                >
                  ⏭ ข้ามเพลง (Skip)
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
                        🗑
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
              style={{ width: '100%', fontSize: '0.78rem', padding: '0.45rem' }}
              onClick={() => {
                if (window.confirm('รีเซ็ตสถิติทั้งหมดในตาราง DBD หรือไม่?')) {
                  handleScoreboardUpdate('reset');
                }
              }}
            >
              🔄 รีเซ็ตสถิติทั้งหมด (0-0-0)
            </button>
          </div>
        )}

        {/* --- TAB: Generic/Roulette/Other widgets --- */}
        {(currentTab === 'dbd-perks' || currentTab === 'random-killer' || currentTab === 'loyalty-card') && (
          <div className="dock-card" style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
              {currentTab === 'dbd-perks' ? '🎲' : currentTab === 'random-killer' ? '🪓' : '🎫'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.35rem' }}>
              {activeTabs.find(t => t.id === currentTab)?.name}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--dock-text-muted)', marginBottom: '1rem' }}>
              Widget นี้ทำงานผ่านการพิมพ์แชทหรือแต้มช่องของผู้ชมโดยอัตโนมัติบนจอ OBS
            </div>
            {currentTab === 'dbd-perks' && (
              <button
                className="dock-btn dock-btn-primary"
                style={{ margin: '0 auto' }}
                onClick={() => {
                  fetch(`${API_BASE}/api/widgets/dbd-perks/simulate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: 'survivor', user: targetUser })
                  });
                }}
              >
                🎲 สุ่มเปิร์ค Survivor ทันที
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
