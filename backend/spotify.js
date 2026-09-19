import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { saveAllItems } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/auth/spotify/callback';

const SPOTIFY_TOKENS_FILE = path.join(__dirname, 'data', 'spotify_tokens.json');
const SPOTIFY_QUEUE_FILE = path.join(__dirname, 'data', 'spotify_queue.json');

// In-memory caches
let spotifyTokens = loadSpotifyTokens();
let spotifyQueue = loadSpotifyQueue();
const userCooldowns = new Map(); // key: `${userId}:${chatterName}` => timestamp

function loadSpotifyTokens() {
  try {
    if (fs.existsSync(SPOTIFY_TOKENS_FILE)) {
      return JSON.parse(fs.readFileSync(SPOTIFY_TOKENS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Spotify] Error reading tokens file:', e.message);
  }
  return {};
}

export function saveSpotifyTokens(tokens) {
  try {
    const dir = path.dirname(SPOTIFY_TOKENS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SPOTIFY_TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
    spotifyTokens = tokens;
    saveAllItems('spotify_tokens', tokens);
  } catch (e) {
    console.error('[Spotify] Error saving tokens file:', e.message);
  }
}

function loadSpotifyQueue() {
  try {
    if (fs.existsSync(SPOTIFY_QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(SPOTIFY_QUEUE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Spotify] Error reading queue file:', e.message);
  }
  return [];
}

export function saveSpotifyQueue(queue) {
  try {
    const dir = path.dirname(SPOTIFY_QUEUE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SPOTIFY_QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
    spotifyQueue = queue;
    const queueObj = {};
    queue.slice(0, 100).forEach(q => { queueObj[q.id] = q; });
    saveAllItems('spotify_queue', queueObj);
  } catch (e) {
    console.error('[Spotify] Error saving queue file:', e.message);
  }
}

export function setHydratedSpotifyData(tokens, queue) {
  if (tokens && typeof tokens === 'object') {
    spotifyTokens = { ...spotifyTokens, ...tokens };
  }
  if (Array.isArray(queue)) {
    spotifyQueue = queue;
  }
}

export function isSpotifyConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

export function getSpotifyUserToken(userId) {
  if (!userId) return null;
  // 1. Direct exact key match
  if (spotifyTokens[userId]) return spotifyTokens[userId];
  // 2. Case-insensitive or spotifyUserId/displayName match
  const lower = String(userId).toLowerCase();
  for (const [key, token] of Object.entries(spotifyTokens)) {
    if (key.toLowerCase() === lower) return token;
    if (token.spotifyUserId && token.spotifyUserId.toLowerCase() === lower) return token;
    if (token.spotifyDisplayName && token.spotifyDisplayName.toLowerCase() === lower) return token;
  }
  return null;
}

/** Return all stored tokens (admin/merge use only) */
export function getAllSpotifyTokens() {
  return { ...spotifyTokens };
}

/**
 * Generate Spotify OAuth Authorize URL
 */
export function getSpotifyAuthUrl(userId = '', customRedirect = '') {
  const clientId = process.env.SPOTIFY_CLIENT_ID || '';
  const redirectUri = customRedirect || process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/auth/spotify/callback';

  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-read-recently-played'
  ].join(' ');

  const state = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: state,
    show_dialog: 'true'
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Exchange Authorization Code for Access & Refresh Tokens
 */
export async function exchangeSpotifyCode(code, customRedirect = '') {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = customRedirect || process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/auth/spotify/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Spotify Client ID or Client Secret not configured in .env');
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Spotify token exchange failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const tokenData = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    expiresAt: Date.now() + (data.expires_in * 1000) - 30000, // 30s buffer
    scope: data.scope,
    tokenType: data.token_type
  };

  // Fetch Spotify User Profile to store display name / id
  try {
    const userRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${tokenData.accessToken}` }
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      tokenData.spotifyUserId = userData.id;
      tokenData.spotifyDisplayName = userData.display_name || userData.id;
      tokenData.product = userData.product; // 'premium' or 'free'
      tokenData.images = userData.images;
    }
  } catch (e) {
    console.warn('[Spotify] Could not fetch user profile:', e.message);
  }

  return tokenData;
}

/**
 * Refresh expired Spotify Access Token
 */
export async function refreshSpotifyToken(userId) {
  const userToken = getSpotifyUserToken(userId);
  if (!userToken || !userToken.refreshToken) {
    throw new Error('No refresh token available for user');
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: userToken.refreshToken
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Spotify refresh failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  userToken.accessToken = data.access_token;
  userToken.expiresIn = data.expires_in;
  userToken.expiresAt = Date.now() + (data.expires_in * 1000) - 30000;
  if (data.refresh_token) {
    userToken.refreshToken = data.refresh_token;
  }

  const targetKey = userId;
  if (targetKey && spotifyTokens[targetKey]) {
    spotifyTokens[targetKey] = userToken;
    saveSpotifyTokens(spotifyTokens);
  }

  console.log(`[Spotify] 🔄 Successfully refreshed access token for user: ${targetKey || '?'}`);
  return userToken.accessToken;
}

/**
 * Get guaranteed valid Access Token
 */
export async function getValidAccessToken(userId) {
  try {
    const userToken = getSpotifyUserToken(userId);
    if (!userToken) return null;

    if (Date.now() >= (userToken.expiresAt || 0)) {
      return await refreshSpotifyToken(userId);
    }
    return userToken.accessToken;
  } catch (err) {
    console.warn(`[Spotify] ⚠️ Failed to get valid access token for user ${userId}:`, err?.message || err);
    return null;
  }
}

/**
 * Search track or parse directly from Spotify URL/URI
 */
export async function searchSpotifyTrack(query, accessToken) {
  if (!query || !accessToken) return null;
  const trimmed = query.trim();

  // 1. Direct Spotify Track URL match: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=...
  const urlMatch = trimmed.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/i);
  // 2. Direct Spotify URI match: spotify:track:4cOdK2wGLETKBW3PvgPWqT
  const uriMatch = trimmed.match(/spotify:track:([a-zA-Z0-9]+)/i);

  const trackId = urlMatch ? urlMatch[1] : (uriMatch ? uriMatch[1] : null);

  if (trackId) {
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const t = await res.json();
      return formatTrackObject(t);
    }
  }

  // 3. Search query
  const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmed)}&type=track&limit=3`;
  const res = await fetch(searchUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('TOKEN_EXPIRED');
    }
    const errText = await res.text();
    throw new Error(`Spotify search failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const items = data?.tracks?.items || [];
  if (items.length === 0) return null;

  return formatTrackObject(items[0]);
}

function formatTrackObject(t) {
  if (!t) return null;
  const albumArt = t.album?.images?.[0]?.url || t.album?.images?.[1]?.url || '';
  const artists = (t.artists || []).map(a => a.name).join(', ');
  return {
    id: t.id,
    name: t.name,
    artists: artists,
    albumName: t.album?.name || '',
    albumArt: albumArt,
    durationMs: t.duration_ms || 0,
    uri: t.uri,
    externalUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
    explicit: Boolean(t.explicit)
  };
}

/**
 * Add track to Spotify Player Queue
 */
export async function addTrackToSpotifyQueue(trackUri, accessToken) {
  if (!trackUri || !accessToken) throw new Error('Missing trackUri or accessToken');

  const res = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('NO_ACTIVE_DEVICE'); // Spotify must be open & playing on a device
    }
    if (res.status === 403) {
      throw new Error('PREMIUM_REQUIRED'); // Spotify requires Premium to modify player state
    }
    const errText = await res.text();
    throw new Error(`Queue addition failed (${res.status}): ${errText}`);
  }

  return true;
}

/**
 * Get Currently Playing track
 */
export async function getCurrentlyPlaying(accessToken) {
  if (!accessToken) return null;

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (res.status === 204 || res.status === 404) {
    return { isPlaying: false, track: null };
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error('TOKEN_EXPIRED');
    return null;
  }

  const data = await res.json();
  if (!data || !data.item) {
    return { isPlaying: false, track: null };
  }

  return {
    isPlaying: Boolean(data.is_playing),
    progressMs: data.progress_ms || 0,
    durationMs: data.item?.duration_ms || 0,
    timestamp: data.timestamp || Date.now(),
    track: formatTrackObject(data.item)
  };
}

/**
 * Skip to next song in Spotify
 */
export async function skipSpotifyTrack(accessToken) {
  if (!accessToken) throw new Error('Missing accessToken');

  const res = await fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (!res.ok && res.status !== 204) {
    if (res.status === 404) throw new Error('NO_ACTIVE_DEVICE');
    if (res.status === 403) throw new Error('PREMIUM_REQUIRED');
    const err = await res.text();
    throw new Error(`Skip failed (${res.status}): ${err}`);
  }
  return true;
}

/**
 * Check user cooldown
 */
export function checkUserCooldown(userId, chatterName, cooldownSeconds = 60) {
  if (!chatterName) return 0;
  const key = `${userId || 'all'}:${chatterName.toLowerCase()}`;
  const now = Date.now();
  const lastTime = userCooldowns.get(key) || 0;
  const elapsed = (now - lastTime) / 1000;

  if (elapsed < cooldownSeconds) {
    return Math.ceil(cooldownSeconds - elapsed);
  }
  return 0;
}

export function recordUserCooldown(userId, chatterName) {
  if (!chatterName) return;
  const key = `${userId || 'all'}:${chatterName.toLowerCase()}`;
  userCooldowns.set(key, Date.now());
}

/**
 * Manage Song Queue
 */
export function addToSongQueue(userId, requester, track, source = 'chat') {
  const item = {
    id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId: userId || 'default',
    requester: requester || 'Anonymous',
    track: track,
    source: source,
    requestedAt: Date.now(),
    status: 'queued'
  };

  spotifyQueue.unshift(item);
  if (spotifyQueue.length > 200) spotifyQueue = spotifyQueue.slice(0, 200);
  saveSpotifyQueue(spotifyQueue);
  return item;
}

export function getSongQueueList(userId, limit = 50) {
  if (!userId) return spotifyQueue.slice(0, limit);
  return spotifyQueue.filter(q => q.userId === userId || q.userId === 'default').slice(0, limit);
}

export function removeQueueItem(itemId, userId) {
  const initial = spotifyQueue.length;
  spotifyQueue = spotifyQueue.filter(q => {
    if (q.id !== itemId) return true; // ไม่ใช่ item นี้ — เก็บไว้
    // ถ้าระบุ userId ให้ลบได้เฉพาะ item ที่เป็นของ userId นั้น
    if (userId && q.userId && q.userId !== userId) return true;
    return false; // ลบออก
  });
  if (spotifyQueue.length !== initial) {
    saveSpotifyQueue(spotifyQueue);
    return true;
  }
  return false;
}

export function clearSongQueue(userId) {
  if (!userId) {
    spotifyQueue = [];
  } else {
    spotifyQueue = spotifyQueue.filter(q => q.userId !== userId);
  }
  saveSpotifyQueue(spotifyQueue);
}
