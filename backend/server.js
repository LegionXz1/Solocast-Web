import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { RefreshingAuthProvider, exchangeCode, getTokenInfo } from '@twurple/auth';
import { ApiClient } from '@twurple/api';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { syncDbdPerks } from './scripts/scrape_dbd_perks.js';
import { initDatabase, syncStore, saveAllItems, syncTickets, saveAllTickets, deleteTicketFromMongo } from './database.js';
import * as spotify from './spotify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());

// 🛡️ Security Headers via Helmet (tuned for OBS Studio widgets & iframe embedding)
app.use(helmet({
  contentSecurityPolicy: false, // Allow widgets to load fonts, wiki images, Twitch CDN, sounds
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow OBS and web frontend to load widget assets
  frameguard: false // Allow widgets to be previewed in Dashboard iframes
}));

// 🛡️ Rate Limiting: General API Limiter (prevents DDoS & spam)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1500, // 1500 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api/', apiLimiter);

// 🛡️ Rate Limiting: Stricter Limiter for Auth & Admin endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});
app.use('/api/auth/', authLimiter);
app.use('/api/admin/', authLimiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// File-based Session Database (บันทึกข้อมูล Session ลงฮาร์ดดิสก์)
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (e) { }
  return {};
}

function saveSessions(sessionsData) {
  try {
    const dir = path.dirname(SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2), 'utf8');
  } catch (e) { }
  saveAllItems('sessions', sessionsData);
}

const sessions = loadSessions();

function isUserAdmin(userId, username) {
  if (!userId) return false;
  // 1. Matches Broadcaster TWITCH_USER_ID
  if (process.env.TWITCH_USER_ID && String(userId) === String(process.env.TWITCH_USER_ID)) {
    return true;
  }
  // 2. Matches ADMIN_TWITCH_USERS whitelist
  if (process.env.ADMIN_TWITCH_USERS) {
    const list = process.env.ADMIN_TWITCH_USERS.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (list.includes(String(userId).toLowerCase())) return true;
    if (username && list.includes(String(username).toLowerCase())) return true;
  }
  return false;
}

function getSessionFromReq(req) {
  const authHeader = req.headers['authorization'];
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query.auth_token) {
    token = req.query.auth_token;
  }
  if (token && sessions[token]) {
    const s = sessions[token];
    return {
      token,
      ...s,
      isAdmin: isUserAdmin(s.userId, s.username)
    };
  }
  return null;
}

function checkAdminAuth(req, res, next) {
  const session = getSessionFromReq(req);
  if (session && session.isAdmin) {
    req.user = session;
    return next();
  }
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  if (adminKey && process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY) {
    req.user = { username: 'Admin', isAdmin: true };
    return next();
  }
  return res.status(403).json({
    error: '403 Forbidden: เฉพาะผู้ดูแลระบบ (Admin / Broadcaster) เท่านั้นที่มีสิทธิ์เข้าถึง',
    loggedIn: Boolean(session)
  });
}

// ตรวจสอบว่า Login อยู่ (ไม่จำเป็นต้องเป็น Admin) — สำหรับ Route ที่ผู้ใช้ทั่วไปเข้าถึงได้
function checkUserAuth(req, res, next) {
  const session = getSessionFromReq(req);
  if (session) {
    req.user = session;
    return next();
  }
  return res.status(401).json({
    error: '401 Unauthorized: กรุณาเข้าสู่ระบบก่อนใช้งาน',
    loggedIn: false
  });
}

// ตรวจสอบข้อมูล Session ของผู้ใช้ในเบราว์เซอร์นี้
app.get('/api/auth/me', (req, res) => {
  const session = getSessionFromReq(req);
  if (session) {
    return res.json({
      loggedIn: true,
      user: {
        userId: session.userId,
        username: session.username,
        displayName: session.displayName,
        isAdmin: session.isAdmin
      }
    });
  }
  return res.json({ loggedIn: false });
});

// ออกจากระบบ
app.post('/api/auth/logout', (req, res) => {
  const session = getSessionFromReq(req);
  if (session && session.token) {
    delete sessions[session.token];
    saveSessions(sessions);
  }
  res.json({ success: true });
});

// Verify Admin Status สำหรับ Admin Page
app.get('/api/admin/verify', (req, res) => {
  const session = getSessionFromReq(req);
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  const isKeyValid = Boolean(adminKey && process.env.ADMIN_KEY && adminKey === process.env.ADMIN_KEY);
  const isAdmin = Boolean((session && session.isAdmin) || isKeyValid);

  res.json({
    success: true,
    authorized: isAdmin,
    isTwitchConnected: Boolean(session),
    connectedUsername: session ? session.username : (isKeyValid ? 'Admin (Key)' : null),
    isBroadcaster: isAdmin,
    authMethod: isKeyValid ? 'admin_key' : 'twitch'
  });
});

// 1. Get all widgets list
app.get('/api/widgets', (req, res) => {
  try {
    const widgetsDir = path.join(__dirname, 'public', 'widgets');
    if (!fs.existsSync(widgetsDir)) {
      fs.mkdirSync(widgetsDir, { recursive: true });
    }
    const folders = fs.readdirSync(widgetsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        let name = dirent.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const infoPath = path.join(widgetsDir, dirent.name, 'info.json');
        if (fs.existsSync(infoPath)) {
          try {
            const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
            if (info.name) name = info.name;
          } catch (e) { }
        }
        return { id: dirent.name, name: name };
      });
    res.json(folders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// 🔒 Widget Status Management (User Toggle & Admin Global Lock)
// ============================================================
const GLOBAL_WIDGET_STATUS_FILE = path.join(__dirname, 'data', 'global_widget_status.json');
const USER_WIDGET_STATUS_FILE = path.join(__dirname, 'data', 'user_widget_status.json');

function loadGlobalWidgetStatus() {
  try {
    if (fs.existsSync(GLOBAL_WIDGET_STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(GLOBAL_WIDGET_STATUS_FILE, 'utf8'));
    }
  } catch (e) { }
  return {};
}

function saveGlobalWidgetStatus(data) {
  try {
    const dir = path.dirname(GLOBAL_WIDGET_STATUS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(GLOBAL_WIDGET_STATUS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { }
  saveAllItems('global_widget_status', data);
}

function loadUserWidgetStatus() {
  try {
    if (fs.existsSync(USER_WIDGET_STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(USER_WIDGET_STATUS_FILE, 'utf8'));
    }
  } catch (e) { }
  return {};
}

function saveUserWidgetStatus(data) {
  try {
    const dir = path.dirname(USER_WIDGET_STATUS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USER_WIDGET_STATUS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { }
  saveAllItems('user_widget_status', data);
}

const globalWidgetStatus = loadGlobalWidgetStatus();
const userWidgetStatus = loadUserWidgetStatus();

function isWidgetGloballyEnabled(widgetId) {
  if (!widgetId) return true;
  if (globalWidgetStatus[widgetId] && globalWidgetStatus[widgetId].enabled === false) {
    return false;
  }
  return true;
}

function isWidgetUserEnabled(userId, widgetId) {
  if (!widgetId) return true;
  const u = userId || 'default';
  if (userWidgetStatus[u] && userWidgetStatus[u][widgetId] === false) {
    return false;
  }
  return true;
}

function isWidgetActiveForUser(userId, widgetId) {
  if (!isWidgetGloballyEnabled(widgetId)) return false;
  if (!isWidgetUserEnabled(userId, widgetId)) return false;
  return true;
}

// 1.5 GET /api/widgets/status-overview — สรุปสถานะเปิด/ปิดของทุก Widget (ต้องมาก่อน :id route)
app.get('/api/widgets/status-overview', (req, res) => {
  try {
    const user = req.query.user || req.query.userId || '';
    const userMap = user && userWidgetStatus[user] ? userWidgetStatus[user] : (userWidgetStatus['default'] || {});
    res.json({
      global: globalWidgetStatus,
      user: userMap
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. Get single widget detail (including code)
app.get('/api/widgets/:id', (req, res) => {
  const widgetId = req.params.id;
  const widgetDir = path.join(__dirname, 'public', 'widgets', widgetId);
  if (!fs.existsSync(widgetDir)) return res.status(404).json({ error: 'Widget not found' });

  try {
    let name = widgetId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const infoPath = path.join(widgetDir, 'info.json');
    if (fs.existsSync(infoPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
        if (info.name) name = info.name;
      } catch (e) { }
    }
    const html = fs.existsSync(path.join(widgetDir, 'html.txt')) ? fs.readFileSync(path.join(widgetDir, 'html.txt'), 'utf8') : '';
    const css = fs.existsSync(path.join(widgetDir, 'css.txt')) ? fs.readFileSync(path.join(widgetDir, 'css.txt'), 'utf8') : '';
    const js = fs.existsSync(path.join(widgetDir, 'js.txt')) ? fs.readFileSync(path.join(widgetDir, 'js.txt'), 'utf8') : '';
    let fields = '';
    const fieldsPath = path.join(widgetDir, 'fields.json');
    if (fs.existsSync(fieldsPath)) {
      fields = fs.readFileSync(fieldsPath, 'utf8');
    }
    res.json({ id: widgetId, name, html, css, js, fields });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create new widget
app.post('/api/widgets', checkAdminAuth, (req, res) => {
  try {
    let { id, name, html, css, js, fields } = req.body;
    if (!name) return res.status(400).json({ error: 'Widget name is required' });

    if (!id) {
      id = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    } else {
      id = id.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    }

    if (!id) return res.status(400).json({ error: 'Invalid Widget ID' });

    const widgetDir = path.join(__dirname, 'public', 'widgets', id);
    if (fs.existsSync(widgetDir)) {
      return res.status(400).json({ error: `Widget ID "${id}" already exists.` });
    }

    fs.mkdirSync(widgetDir, { recursive: true });
    fs.writeFileSync(path.join(widgetDir, 'info.json'), JSON.stringify({ id, name }, null, 2), 'utf8');
    fs.writeFileSync(path.join(widgetDir, 'html.txt'), html || '', 'utf8');
    fs.writeFileSync(path.join(widgetDir, 'css.txt'), css || '', 'utf8');
    fs.writeFileSync(path.join(widgetDir, 'js.txt'), js || '', 'utf8');

    let formattedFields = typeof fields === 'string' ? fields : JSON.stringify(fields || {}, null, 2);
    if (formattedFields.trim()) {
      try {
        const parsed = JSON.parse(formattedFields);
        formattedFields = JSON.stringify(parsed, null, 2);
      } catch (e) { }
    } else {
      formattedFields = '{}';
    }
    fs.writeFileSync(path.join(widgetDir, 'fields.json'), formattedFields, 'utf8');

    res.status(201).json({ success: true, widget: { id, name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update existing widget
app.put('/api/widgets/:id', checkAdminAuth, (req, res) => {
  try {
    const widgetId = req.params.id;
    const widgetDir = path.join(__dirname, 'public', 'widgets', widgetId);
    if (!fs.existsSync(widgetDir)) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    const { name, html, css, js, fields } = req.body;
    if (name) {
      fs.writeFileSync(path.join(widgetDir, 'info.json'), JSON.stringify({ id: widgetId, name }, null, 2), 'utf8');
    }
    if (html !== undefined) fs.writeFileSync(path.join(widgetDir, 'html.txt'), html, 'utf8');
    if (css !== undefined) fs.writeFileSync(path.join(widgetDir, 'css.txt'), css, 'utf8');
    if (js !== undefined) fs.writeFileSync(path.join(widgetDir, 'js.txt'), js, 'utf8');

    if (fields !== undefined) {
      let formattedFields = typeof fields === 'string' ? fields : JSON.stringify(fields || {}, null, 2);
      if (formattedFields.trim()) {
        try {
          const parsed = JSON.parse(formattedFields);
          formattedFields = JSON.stringify(parsed, null, 2);
        } catch (e) { }
      } else {
        formattedFields = '{}';
      }
      fs.writeFileSync(path.join(widgetDir, 'fields.json'), formattedFields, 'utf8');
    }

    res.json({ success: true, message: 'Widget updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete widget
app.delete('/api/widgets/:id', checkAdminAuth, (req, res) => {
  try {
    const widgetId = req.params.id;
    const widgetDir = path.join(__dirname, 'public', 'widgets', widgetId);
    if (!fs.existsSync(widgetDir)) {
      return res.status(404).json({ error: 'Widget not found' });
    }

    fs.rmSync(widgetDir, { recursive: true, force: true });
    res.json({ success: true, message: `Widget "${widgetId}" deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/widgets/:id/index.html', (req, res) => {
  const widgetId = req.params.id;
  const widgetDir = path.join(__dirname, 'public', 'widgets', widgetId);

  if (!fs.existsSync(widgetDir)) return res.status(404).send('Widget not found');

  try {
    // If index.html already exists, express.static would have served it.
    // So if we reach here, we dynamically compile it from .txt files
    const html = fs.existsSync(path.join(widgetDir, 'html.txt')) ? fs.readFileSync(path.join(widgetDir, 'html.txt'), 'utf8') : '';
    const css = fs.existsSync(path.join(widgetDir, 'css.txt')) ? fs.readFileSync(path.join(widgetDir, 'css.txt'), 'utf8') : '';
    const js = fs.existsSync(path.join(widgetDir, 'js.txt')) ? fs.readFileSync(path.join(widgetDir, 'js.txt'), 'utf8') : '';

    const renderedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${widgetId} Widget</title>
  <script src="/socket.io/socket.io.js"></script>
  <script src="/adapter.js"></script>
  <style>
${css}
  </style>
</head>
<body>
${html}
<script>
${js}
</script>
</body>
</html>`;
    res.send(renderedHtml);
  } catch (err) {
    res.status(500).send('Error rendering widget: ' + err.message);
  }
});

app.get('/api/widgets/:id/schema', (req, res) => {
  try {
    const schemaPath = path.join(__dirname, 'public', 'widgets', req.params.id, 'fields.json');
    if (fs.existsSync(schemaPath)) {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      res.json(schema);
    } else {
      res.status(404).json({ error: 'Schema not found' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// File-based Widget Settings Store
const WIDGET_SETTINGS_FILE = path.join(__dirname, 'data', 'widget_settings.json');

function loadWidgetSettings() {
  try {
    if (fs.existsSync(WIDGET_SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(WIDGET_SETTINGS_FILE, 'utf8'));
    }
  } catch (e) { }
  return {};
}

function saveWidgetSettings(data) {
  try {
    const dir = path.dirname(WIDGET_SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WIDGET_SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { }
  saveAllItems('widget_settings', data);
}

const widgetSettingsStore = loadWidgetSettings();

// ดึงการตั้งค่าของ Widget เฉพาะของ User คนนั้น (เช่น Reward Name)
app.get('/api/widgets/:id/settings', (req, res) => {
  try {
    const widgetId = req.params.id;
    let user = req.query.user || req.query.channel;

    // ถ้าไม่ได้ระบุ User ใน Query String ให้ค้นหาการตั้งค่าของ User ที่มีบันทึกไว้
    if (!user) {
      if (widgetSettingsStore[widgetId]) {
        const uids = Object.keys(widgetSettingsStore[widgetId]).filter(k => k !== 'default');
        if (uids.length > 0) user = uids[0];
      }
      if (!user) {
        const uids = Object.keys(userTokens);
        if (uids.length > 0) user = uids[0];
        else if (process.env.TWITCH_USER_ID) user = process.env.TWITCH_USER_ID;
      }
    }

    // 1. ถ้ามี User ID ให้ดึงการตั้งค่าเฉพาะของ User คนนั้น
    if (user && widgetSettingsStore[widgetId] && widgetSettingsStore[widgetId][user]) {
      return res.json(widgetSettingsStore[widgetId][user]);
    }

    // 2. ถ้ายังไม่เคยตั้งค่า ให้ดึงค่ามาตรฐานจาก fields.json (ไม่กระทบกับ User อื่น)
    const schemaPath = path.join(__dirname, 'public', 'widgets', widgetId, 'fields.json');
    if (fs.existsSync(schemaPath)) {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      const defaults = {};
      for (const key in schema) {
        defaults[key] = schema[key].value;
      }
      return res.json(defaults);
    }

    res.json({});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ดึงข้อมูล User ID เริ่มต้นของเซิร์ฟเวอร์
app.get('/api/default-user', (req, res) => {
  let defaultUserId = '';
  // 1. ตรวจหา User ที่มีการบันทึกการตั้งค่า Widget ไว้
  for (const wId in widgetSettingsStore) {
    for (const uId of Object.keys(widgetSettingsStore[wId])) {
      if (uId && uId !== 'default') {
        defaultUserId = uId;
        break;
      }
    }
    if (defaultUserId) break;
  }
  // 2. ถ้าไม่มี ให้ตรวจหาจาก Sessions ล่าสุด
  if (!defaultUserId) {
    const sList = Object.values(sessions).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (sList.length > 0 && sList[0].userId) {
      defaultUserId = sList[0].userId;
    }
  }
  // 3. ถ้าไม่มี ให้ใช้ TWITCH_USER_ID หรือ userTokens ตัวแรก
  if (!defaultUserId) {
    defaultUserId = process.env.TWITCH_USER_ID;
    if (!defaultUserId) {
      const uids = Object.keys(userTokens);
      if (uids.length > 0) defaultUserId = uids[0];
    }
  }
  res.json({ userId: defaultUserId || '' });
});

// บันทึกการตั้งค่าของ Widget แยกตาม User อย่างเด็ดขาด ไม่กระทบผู้ใช้อื่น
app.post('/api/widgets/:id/settings', (req, res) => {
  try {
    const widgetId = req.params.id;
    const { user, settings } = req.body;

    const userKey = user || 'default';

    if (!widgetSettingsStore[widgetId]) {
      widgetSettingsStore[widgetId] = {};
    }

    // บันทึกเฉพาะข้อมูลของ User คนนี้เท่านั้น!
    widgetSettingsStore[widgetId][userKey] = {
      ...(widgetSettingsStore[widgetId][userKey] || {}),
      ...(settings || {})
    };

    saveWidgetSettings(widgetSettingsStore);

    // ส่งสัญญาณ Real-time ไปเฉพาะห้องของ User คนนี้เท่านั้น (OBS ของคนอื่นจะไม่ได้รับ)
    if (user) {
      io.to('user_' + user).emit('widget_settings_updated', {
        widgetId,
        userId: user,
        settings: widgetSettingsStore[widgetId][userKey]
      });
    } else {
      io.emit('widget_settings_updated', {
        widgetId,
        userId: '',
        settings: widgetSettingsStore[widgetId][userKey]
      });
    }

    console.log(`[Settings] Updated isolated settings for user "${userKey}" on widget "${widgetId}":`, settings);
    res.json({ success: true, settings: widgetSettingsStore[widgetId][userKey] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/widgets/:id/live-status — ตรวจสอบสถานะว่า Widget นี้ Active อยู่หรือไม่ (ใช้โดย OBS Overlay)
app.get('/api/widgets/:id/live-status', (req, res) => {
  const widgetId = req.params.id;
  const user = req.query.user || req.query.channel || 'default';
  const globalEnabled = isWidgetGloballyEnabled(widgetId);
  const userEnabled = isWidgetUserEnabled(user, widgetId);
  const active = globalEnabled && userEnabled;
  const globalStatus = globalWidgetStatus[widgetId] || { enabled: true };

  res.json({
    widgetId,
    active,
    globalEnabled,
    userEnabled,
    reason: !globalEnabled ? (globalStatus.reason || 'ปิดปรับปรุงโดยผู้ดูแลระบบ') : (!userEnabled ? 'ปิดใช้งานโดยผู้ใช้' : '')
  });
});

// POST /api/user/widgets/:id/status — ผู้ใช้เลือกเปิด/ปิด Widget ของช่องตัวเอง
app.post('/api/user/widgets/:id/status', (req, res) => {
  try {
    const widgetId = req.params.id;
    const session = getSessionFromReq(req);
    const userId = req.body.user || req.body.userId || session?.userId || 'default';
    const enabled = Boolean(req.body.enabled);

    // หากผู้ดูแลระบบปิด Widget นี้ไว้ทั้งระบบ ไม่อนุญาตให้ผู้ใช้ทั่วไปเปิดใช้งาน
    if (!isWidgetGloballyEnabled(widgetId) && enabled) {
      return res.status(403).json({
        error: 'Widget นี้ถูกปิดปรับปรุงโดยผู้ดูแลระบบ (Admin Lock) ไม่สามารถเปิดใช้งานได้ในขณะนี้',
        globallyDisabled: true
      });
    }

    if (!userWidgetStatus[userId]) {
      userWidgetStatus[userId] = {};
    }
    userWidgetStatus[userId][widgetId] = enabled;
    saveUserWidgetStatus(userWidgetStatus);

    // ส่งสัญญาณ Real-time ไปยัง OBS Overlay และ Dashboard
    io.to('user_' + userId).emit('user_widget_status_changed', {
      userId,
      widgetId,
      enabled
    });
    io.emit('widget_status_updated', {
      userId,
      widgetId,
      enabled,
      type: 'user'
    });

    console.log(`[Widget Status] 👤 User ${userId} set widget "${widgetId}" to ${enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ success: true, widgetId, enabled });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/widgets/:id/global-status — ผู้ดูแลระบบสั่งเปิด/ปิด Widget ทั้งระบบ
app.post('/api/admin/widgets/:id/global-status', checkAdminAuth, (req, res) => {
  try {
    const widgetId = req.params.id;
    const enabled = Boolean(req.body.enabled);
    const reason = (req.body.reason || '').trim();
    const adminUser = req.user?.username || req.user?.displayName || 'Admin';

    globalWidgetStatus[widgetId] = {
      enabled,
      reason: enabled ? '' : (reason || 'ปิดปรับปรุงระบบชั่วคราวโดยผู้ดูแลระบบ'),
      updatedAt: Date.now(),
      updatedBy: adminUser
    };
    saveGlobalWidgetStatus(globalWidgetStatus);

    // แจ้งเตือนทุก OBS Overlay และทุก Dashboard ทันที
    io.emit('widget_global_status_changed', {
      widgetId,
      enabled,
      reason: globalWidgetStatus[widgetId].reason,
      updatedBy: adminUser
    });
    io.emit('widget_status_updated', {
      widgetId,
      enabled,
      type: 'global',
      reason: globalWidgetStatus[widgetId].reason
    });

    console.log(`[Widget Status] 🛡️ Admin ${adminUser} set global status for "${widgetId}" to ${enabled ? 'ENABLED' : 'DISABLED'} (${reason})`);
    res.json({ success: true, widgetId, status: globalWidgetStatus[widgetId] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// File-based Roll History Store (บันทึกประวัติการสุ่มของแต่ละ Widget แยกตาม User)
const ROLL_HISTORY_FILE = path.join(__dirname, 'data', 'roll_history.json');

function loadRollHistory() {
  try {
    if (fs.existsSync(ROLL_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(ROLL_HISTORY_FILE, 'utf8'));
    }
  } catch (e) { }
  return {};
}

function saveRollHistory(data) {
  try {
    const dir = path.dirname(ROLL_HISTORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ROLL_HISTORY_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { }
  saveAllItems('roll_history', data);
}

const rollHistoryStore = loadRollHistory();

// 1. ดึงประวัติการสุ่ม (Roll History)
app.get('/api/widgets/:id/history', (req, res) => {
  try {
    const widgetId = req.params.id;
    const user = req.query.user || req.query.channel || 'default';
    let list = rollHistoryStore[widgetId]?.[user] || [];

    // สำหรับ loyalty-card: หากประวัติยังว่างอยู่ ให้สร้างรายการจากยอดเช็คอินที่บันทึกไว้ใน widgetStore
    if (widgetId === 'loyalty-card' && list.length === 0 && widgetStore['loyalty-card']?.[user]) {
      const storeData = widgetStore['loyalty-card'][user];
      const items = [];
      for (const [k, v] of Object.entries(storeData)) {
        if (k.startsWith('ci_')) {
          const parts = k.split('_');
          const cleanUser = parts.slice(2).join('_');
          const count = parseInt(v) || 1;
          items.push({
            id: 'store_' + k,
            username: cleanUser,
            count: count,
            avatar: `/api/twitch/avatar/${encodeURIComponent(cleanUser)}`,
            rewardTitle: 'จุ่มๆๆๆ',
            result: `เช็คอินครั้งที่ ${count}`,
            timestamp: Date.now()
          });
        }
      }
      if (items.length > 0) {
        if (!rollHistoryStore[widgetId]) rollHistoryStore[widgetId] = {};
        rollHistoryStore[widgetId][user] = items;
        saveRollHistory(rollHistoryStore);
        list = items;
      }
    }

    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint ดึงสรุปยอดเช็คอินของผู้ใช้แต่ละคน (สำหรับ loyalty-card)
app.get('/api/widgets/:id/checkin-summary', (req, res) => {
  try {
    const widgetId = req.params.id;
    const user = req.query.user || req.query.channel || 'default';
    const storeObj = widgetStore[widgetId]?.[user] || {};
    const summary = [];
    for (const [k, v] of Object.entries(storeObj)) {
      if (k.startsWith('ci_')) {
        const parts = k.split('_');
        const username = parts.slice(2).join('_');
        const count = parseInt(v) || 0;
        summary.push({
          username,
          count,
          avatar: `/api/twitch/avatar/${encodeURIComponent(username)}`
        });
      }
    }
    summary.sort((a, b) => b.count - a.count);
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. บันทึกผลลัพธ์การสุ่มใหม่
app.post('/api/widgets/:id/history', (req, res) => {
  try {
    const widgetId = req.params.id;
    let { user, item } = req.body;
    if (!item) {
      const { user: u, userId, ...rest } = req.body;
      if (Object.keys(rest).length > 0) {
        item = rest;
        if (!user) user = u || userId;
      }
    }
    if (!item) return res.status(400).json({ error: 'Item data is required' });

    // หากผู้ส่งแต้มเป็น GamerGod88 ให้ไม่เก็บประวัติ
    if (item.username && item.username.toLowerCase() === 'gamergod88') {
      return res.json({ success: true, skipped: true, message: 'Skipped GamerGod88' });
    }

    const userKey = user || 'default';
    if (!rollHistoryStore[widgetId]) {
      rollHistoryStore[widgetId] = {};
    }
    if (!rollHistoryStore[widgetId][userKey]) {
      rollHistoryStore[widgetId][userKey] = [];
    }

    const newItem = {
      id: 'roll_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: Date.now(),
      ...item
    };

    // ใส่รายการใหม่ไว้บนสุด และจำกัดสูงสุด 100 รายการ
    rollHistoryStore[widgetId][userKey] = [newItem, ...rollHistoryStore[widgetId][userKey]].slice(0, 100);
    saveRollHistory(rollHistoryStore);

    // ส่งสัญญาณ Real-time ไปยังหน้า Dashboard ของผู้ใช้คนนั้น
    if (user) {
      io.to('user_' + user).emit('widget_roll_history_item', { widgetId, item: newItem });
    } else {
      io.emit('widget_roll_history_item', { widgetId, item: newItem });
    }

    console.log(`[Roll History] Recorded roll on "${widgetId}" for user "${userKey}": ${newItem.username} rolled ${newItem.killer || newItem.result}`);
    res.json({ success: true, item: newItem });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. ล้างประวัติการสุ่ม
app.delete('/api/widgets/:id/history', (req, res) => {
  try {
    const widgetId = req.params.id;
    const user = req.query.user || req.query.channel || 'default';
    if (rollHistoryStore[widgetId]?.[user]) {
      rollHistoryStore[widgetId][user] = [];
      saveRollHistory(rollHistoryStore);
    }
    if (user) {
      io.to('user_' + user).emit('widget_roll_history_cleared', { widgetId });
    } else {
      io.emit('widget_roll_history_cleared', { widgetId });
    }
    res.json({ success: true, message: 'History cleared' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// File-based Widget Key-Value Store (จำลอง kvstore เช่น ข้อมูลนับแต้มเช็คอินของ Loyalty Card)
const WIDGET_STORE_FILE = path.join(__dirname, 'data', 'widget_store.json');

function loadWidgetStore() {
  try {
    if (fs.existsSync(WIDGET_STORE_FILE)) {
      return JSON.parse(fs.readFileSync(WIDGET_STORE_FILE, 'utf8'));
    }
  } catch (e) { }
  return {};
}

function saveWidgetStore(data) {
  try {
    const dir = path.dirname(WIDGET_STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(WIDGET_STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { }
  saveAllItems('widget_store', data);
}

const widgetStore = loadWidgetStore();

// 1. ดึงค่า Key-Value
app.get('/api/widgets/:id/store/:key', (req, res) => {
  try {
    const widgetId = req.params.id;
    const key = req.params.key;
    const user = req.query.user || req.query.channel || 'default';
    const val = widgetStore[widgetId]?.[user]?.[key];
    if (val === undefined || val === null) {
      return res.status(404).json({ error: 'Key not found' });
    }
    res.json({ key, value: val });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. บันทึกค่า Key-Value
app.post('/api/widgets/:id/store/:key', (req, res) => {
  try {
    const widgetId = req.params.id;
    const key = req.params.key;
    const { user, value } = req.body;
    const userKey = user || 'default';

    if (!widgetStore[widgetId]) widgetStore[widgetId] = {};
    if (!widgetStore[widgetId][userKey]) widgetStore[widgetId][userKey] = {};

    widgetStore[widgetId][userKey][key] = String(value !== undefined ? value : '');
    saveWidgetStore(widgetStore);

    res.json({ success: true, key, value: widgetStore[widgetId][userKey][key] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. ล้างค่า Store ของ Widget
app.delete('/api/widgets/:id/store', (req, res) => {
  try {
    const widgetId = req.params.id;
    const user = req.query.user || req.query.channel || 'default';
    if (widgetStore[widgetId] && widgetStore[widgetId][user]) {
      delete widgetStore[widgetId][user];
      saveWidgetStore(widgetStore);
    }
    res.json({ success: true, message: `Store cleared for widget ${widgetId}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// จำลองการยิง Shoutout สำหรับทดสอบ Widget
app.post('/api/widgets/twitch-shoutout/simulate', (req, res) => {
  try {
    const { user, channel } = req.body;
    const targetChannel = (channel || 'legionxiz').trim().toLowerCase().replace('@', '');
    const ev = {
      type: 'shoutout',
      userId: user || '',
      channel: targetChannel,
      targetChannel: targetChannel,
      data: {
        channel: targetChannel,
        username: targetChannel,
        displayName: targetChannel
      }
    };
    if (user) {
      io.to('user_' + user).emit('onEventReceived', ev);
    } else {
      io.emit('onEventReceived', ev);
    }
    console.log(`[Shoutout API] 📢 Emitted test shoutout for: ${targetChannel}`);
    res.json({ success: true, channel: targetChannel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ดึงรายชื่อ Killers Dead by Daylight ทั้งหมดสำหรับ Random Killer Widget
app.get('/api/widgets/random-killer/killers', (req, res) => {
  try {
    const killersFile = path.join(__dirname, 'data', 'dbd_killers.json');
    if (fs.existsSync(killersFile)) {
      const data = JSON.parse(fs.readFileSync(killersFile, 'utf8'));
      return res.json(data);
    }
    res.json([]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ดึงฐานข้อมูลเปิร์ค Dead by Daylight ทั้งหมด
app.get('/api/widgets/dbd-perks/perks', (req, res) => {
  try {
    const perksFile = path.join(__dirname, 'data', 'dbd_perks.json');
    if (fs.existsSync(perksFile)) {
      const data = JSON.parse(fs.readFileSync(perksFile, 'utf8'));
      return res.json(data);
    }
    res.json({ survivor: [], killer: [], total: 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ซิงค์อัปเดตฐานข้อมูลเปิร์ค DBD สดๆ จาก deadbydaylight.wiki.gg (รองรับทั้ง /api/widgets/... และ /api/admin/...)
const handleDbdSync = async (req, res) => {
  try {
    console.log('[DBD Perks API] 🔄 Live syncing perks from Wiki...');
    const data = await syncDbdPerks();
    io.emit('dbd_perks_updated', data);
    res.json({ success: true, data });
  } catch (e) {
    console.error('[DBD Perks API] Sync error:', e);
    res.status(500).json({ error: e.message });
  }
};
app.post('/api/widgets/dbd-perks/sync', handleDbdSync);
app.post('/api/admin/dbd-perks/sync', checkAdminAuth, handleDbdSync);

// Admin: เพิ่มเปิร์คใหม่แบบกำหนดเอง (Add Perk)
app.post('/api/admin/dbd-perks', checkAdminAuth, (req, res) => {
  try {
    const { name, role, character, icon, description } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อเปิร์ค' });
    }

    const cleanRole = (role || 'survivor').toLowerCase().trim() === 'killer' ? 'killer' : 'survivor';
    const cleanName = name.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `perk-${Date.now()}`;
    const defaultIcon = 'https://deadbydaylight.wiki.gg/images/thumb/IconPerks_unknown.png/96px-IconPerks_unknown.png';

    const perksFile = path.join(__dirname, 'data', 'dbd_perks.json');
    let data = { updatedAt: new Date().toISOString(), total: 0, survivorCount: 0, killerCount: 0, survivor: [], killer: [] };
    if (fs.existsSync(perksFile)) {
      try {
        data = JSON.parse(fs.readFileSync(perksFile, 'utf8'));
      } catch (e) { }
    }
    if (!Array.isArray(data[cleanRole])) data[cleanRole] = [];

    const newPerk = {
      id: slug,
      name: cleanName,
      role: cleanRole,
      character: (character || 'General').trim(),
      icon: (icon && icon.trim()) ? icon.trim() : defaultIcon,
      description: (description || '').trim()
    };

    // ตรวจสอบว่ามีเปิร์คนี้อยู่แล้วหรือไม่ (ตาม id หรือ name)
    const existingIndex = data[cleanRole].findIndex(p => p.id === slug || p.name.toLowerCase() === cleanName.toLowerCase());
    if (existingIndex >= 0) {
      data[cleanRole][existingIndex] = { ...data[cleanRole][existingIndex], ...newPerk };
    } else {
      data[cleanRole].unshift(newPerk);
    }

    data.survivorCount = (data.survivor || []).length;
    data.killerCount = (data.killer || []).length;
    data.total = data.survivorCount + data.killerCount;
    data.updatedAt = new Date().toISOString();

    const dir = path.dirname(perksFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(perksFile, JSON.stringify(data, null, 2), 'utf8');

    io.emit('dbd_perks_updated', data);
    console.log(`[DBD Perks Admin] ➕ Added/Updated perk: "${newPerk.name}" (${cleanRole}) by admin`);

    res.json({ success: true, perk: newPerk, total: data.total, data });
  } catch (e) {
    console.error('[DBD Perks Admin] Error adding perk:', e);
    res.status(500).json({ error: e.message });
  }
});

// Admin: ลบเปิร์คออกจากระบบ (Delete Perk)
app.delete('/api/admin/dbd-perks/:role/:id', checkAdminAuth, (req, res) => {
  try {
    const { role, id } = req.params;
    const cleanRole = (role || '').toLowerCase().trim() === 'killer' ? 'killer' : 'survivor';
    const targetId = decodeURIComponent(id || '').trim();

    const perksFile = path.join(__dirname, 'data', 'dbd_perks.json');
    if (!fs.existsSync(perksFile)) {
      return res.status(404).json({ error: 'ไม่พบฐานข้อมูลเปิร์ค' });
    }

    let data = JSON.parse(fs.readFileSync(perksFile, 'utf8'));
    if (!Array.isArray(data[cleanRole])) data[cleanRole] = [];

    const initialLen = data[cleanRole].length;
    const removedPerk = data[cleanRole].find(p => p.id === targetId || p.name.toLowerCase() === targetId.toLowerCase());
    data[cleanRole] = data[cleanRole].filter(p => p.id !== targetId && p.name.toLowerCase() !== targetId.toLowerCase());

    if (data[cleanRole].length === initialLen) {
      return res.status(404).json({ error: `ไม่พบเปิร์ค "${targetId}" ในบทบาท ${cleanRole}` });
    }

    data.survivorCount = (data.survivor || []).length;
    data.killerCount = (data.killer || []).length;
    data.total = data.survivorCount + data.killerCount;
    data.updatedAt = new Date().toISOString();

    fs.writeFileSync(perksFile, JSON.stringify(data, null, 2), 'utf8');

    io.emit('dbd_perks_updated', data);
    console.log(`[DBD Perks Admin] 🗑️ Deleted perk: "${removedPerk?.name || targetId}" (${cleanRole}) by admin`);

    res.json({ success: true, deletedPerk: removedPerk, total: data.total, data });
  } catch (e) {
    console.error('[DBD Perks Admin] Error deleting perk:', e);
    res.status(500).json({ error: e.message });
  }
});

// จำลองการสุ่มเปิร์ค DBD สำหรับทดสอบ Widget
app.post('/api/widgets/dbd-perks/simulate', (req, res) => {
  try {
    const { user, role, username } = req.body || {};
    const ev = {
      type: 'dbd_perk_roll',
      role: role || 'survivor',
      username: username || 'Streamer',
      avatar: `/api/twitch/avatar/${encodeURIComponent(username || 'Streamer')}`,
      timestamp: Date.now()
    };
    if (user) {
      io.to('user_' + user).emit('onEventReceived', ev);
    } else {
      io.emit('onEventReceived', ev);
    }
    console.log(`[DBD Perks API] 🎲 Emitted test roll for: ${ev.username} (${ev.role})`);
    res.json({ success: true, event: ev });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const redirectUri = process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/twitch/callback';

// File-based Token Storage (บันทึก Twitch OAuth Token ลงฮาร์ดดิสก์เพื่อให้ใช้งานได้ต่อเนื่อง)
const TOKENS_FILE = path.join(__dirname, 'data', 'tokens.json');

function loadTokens() {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    }
  } catch (e) { }
  return {};
}

function saveTokens(tokensData) {
  try {
    const dir = path.dirname(TOKENS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokensData, null, 2), 'utf8');
  } catch (e) { }
  saveAllItems('tokens', tokensData);
}

const userTokens = loadTokens();

let authProvider;
let apiClient;
let eventSubListener;
const registeredEventSubUsers = new Set();

const requestedScopes = [
  'channel:manage:redemptions',
  'channel:read:redemptions',
  'channel:read:subscriptions',
  'user:read:subscriptions',
  'bits:read',
  'moderator:manage:shoutouts',
  'moderator:read:shoutouts',
  'moderator:read:followers',
  'chat:read',
  'chat:edit',
  'user:read:email',
  'user:read:chat',
  'user:write:chat',
  'user:bot',
  'channel:bot'
];

if (clientId && clientSecret) {
  authProvider = new RefreshingAuthProvider({ clientId, clientSecret });
  authProvider.onRefresh(async (userId, newTokenData) => {
    userTokens[userId] = newTokenData;
    saveTokens(userTokens);
    console.log(`[Twurple] Token refreshed and persisted for user: ${userId}`);
  });

  for (const [userId, tokenData] of Object.entries(userTokens)) {
    try {
      authProvider.addUser(userId, tokenData, requestedScopes);
      console.log(`[Twurple] Loaded persistent credentials for user: ${userId}`);
    } catch (e) {
      console.error(`[Twurple] Error loading user ${userId}:`, e.message);
    }
  }

  apiClient = new ApiClient({ authProvider });

  // เริ่มต้นฟัง EventSub อัตโนมัติสำหรับผู้ใช้ที่เคยล็อกอินไว้
  for (const userId of Object.keys(userTokens)) {
    startEventSub(userId);
  }
}

// 1. หน้าสำหรับ Login (Twitch OAuth)
app.get('/auth/twitch', (req, res) => {
  const scopes = requestedScopes.join(' ');
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${encodeURIComponent(scopes)}`;
  res.redirect(authUrl);
});

// 2. รับ Token กลับมาจาก Twitch
app.get('/auth/twitch/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("Error: No code provided");

  try {
    const tokenData = await exchangeCode(clientId, clientSecret, code, redirectUri);
    const tokenInfo = await getTokenInfo(tokenData.accessToken, clientId);
    const userId = tokenInfo.userId;

    userTokens[userId] = tokenData;
    saveTokens(userTokens);

    if (!authProvider) {
      authProvider = new RefreshingAuthProvider({ clientId, clientSecret });
      authProvider.onRefresh(async (uid, tData) => {
        userTokens[uid] = tData;
        saveTokens(userTokens);
      });
    }

    authProvider.addUser(userId, tokenData, requestedScopes);
    apiClient = new ApiClient({ authProvider });

    const user = await apiClient.users.getUserById(userId);
    const username = user?.displayName || user?.name || userId;
    const isAdmin = isUserAdmin(userId, username);

    // สร้าง Session Token เฉพาะสำหรับเบราว์เซอร์นี้
    const sessionToken = crypto.randomUUID();
    sessions[sessionToken] = {
      userId,
      username,
      displayName: user?.displayName || username,
      isAdmin,
      createdAt: Date.now()
    };
    saveSessions(sessions);

    startEventSub(userId);

    // Redirect กลับไปหน้า Dashboard พร้อม Session Token
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
    res.redirect(`${frontendUrl}/dashboard?auth_token=${sessionToken}`);
  } catch (error) {
    console.error("Auth Error:", error);
    res.send("Authentication failed. Please check console.");
  }
});

// ส่งข้อความลงแชท Twitch ในนามของสตรีมเมอร์เจ้าของช่อง
app.post('/api/chat/send', async (req, res) => {
  try {
    const { user, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    let targetUserId = user;
    if (!targetUserId) {
      const uids = Object.keys(userTokens);
      if (uids.length > 0) targetUserId = uids[0];
      else if (process.env.TWITCH_USER_ID) targetUserId = process.env.TWITCH_USER_ID;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'No Twitch user ID specified for sending chat' });
    }

    if (!apiClient) {
      return res.status(500).json({ error: 'Twitch API client is not initialized' });
    }

    // ส่งข้อความผ่าน Twitch Helix Chat API ด้วยสิทธิ์ของสตรีมเมอร์
    await apiClient.asUser(targetUserId, async (ctx) => {
      await ctx.chat.sendChatMessage(targetUserId, message);
    });

    console.log(`[Twitch Chat] 💬 Sent chat message to channel ${targetUserId} as user: "${message}"`);
    res.json({ success: true, user: targetUserId, message });
  } catch (err) {
    console.error(`[Twitch Chat] ❌ Error sending message:`, err?.message || err);
    res.status(500).json({ success: false, error: err?.message || 'Failed to send chat' });
  }
});

// Cache สำหรับเก็บรูป Avatar ผู้ใช้ Twitch เพื่อความรวดเร็ว
const avatarCache = new Map();

async function getTwitchUserAvatar(userIdOrName) {
  if (!userIdOrName) return '';
  const key = String(userIdOrName).trim().toLowerCase().replace(/^@/, '');
  if (avatarCache.has(key)) return avatarCache.get(key);

  if (!apiClient) return '';
  try {
    let user = null;
    if (/^\d+$/.test(key)) {
      user = await apiClient.users.getUserById(key);
    } else {
      user = await apiClient.users.getUserByName(key);
    }
    if (user && user.profilePictureUrl) {
      avatarCache.set(key, user.profilePictureUrl);
      if (user.name) avatarCache.set(user.name.toLowerCase(), user.profilePictureUrl);
      if (user.displayName) avatarCache.set(user.displayName.toLowerCase(), user.profilePictureUrl);
      return user.profilePictureUrl;
    }
  } catch (err) {
    console.warn(`[Avatar] Failed to fetch avatar for ${key}:`, err?.message || err);
  }
  return '';
}

// Endpoint เสิร์ฟ Avatar ของผู้ใช้ Twitch (Redirect ไปยัง Twitch CDN URL โดยตรง)
app.get('/api/twitch/avatar/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const cleanUser = (username || '').trim().toLowerCase().replace(/^@/, '');
    const avatar = await getTwitchUserAvatar(cleanUser);
    if (avatar) {
      return res.redirect(avatar);
    }
    res.redirect('https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png');
  } catch (e) {
    res.redirect('https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7ba-40d2-965a-52834b6f79e8-profile_image-300x300.png');
  }
});

function initEventSubListener() {
  if (!eventSubListener && apiClient) {
    eventSubListener = new EventSubWsListener({ apiClient });
    eventSubListener.start();
    console.log(`[EventSub] Global WebSocket Listener started successfully`);
  }
  return eventSubListener;
}

function startEventSub(userId) {
  if (!userId) return;
  const uidStr = String(userId);
  if (registeredEventSubUsers.has(uidStr)) {
    return;
  }

  const el = initEventSubListener();
  if (!el) {
    console.warn(`[EventSub] Cannot start EventSub, apiClient not ready`);
    return;
  }

  registeredEventSubUsers.add(uidStr);
  console.log(`✅ [EventSub] Subscribed for Twitch events for user ID: ${uidStr}...`);

  el.onChannelFollow(userId, userId, (e) => {
    console.log(`New Follower for ${userId}: ${e.userDisplayName}`);
    const ev = { type: 'follower', userId, data: { name: e.userDisplayName } };
    io.to('user_' + userId).emit('onEventReceived', ev);
    io.emit('onEventReceived', ev);
  });

  el.onChannelSubscription(userId, (e) => {
    console.log(`New Subscriber for ${userId}: ${e.userDisplayName}`);
    const ev = { type: 'subscriber', userId, data: { name: e.userDisplayName, tier: e.tier } };
    io.to('user_' + userId).emit('onEventReceived', ev);
    io.emit('onEventReceived', ev);
  });

  el.onChannelRedemptionAdd(userId, async (e) => {
    let avatar = '';
    try {
      const userObj = await e.getUser();
      avatar = userObj?.profilePictureUrl || '';
      if (avatar && e.userName) {
        avatarCache.set(e.userName.toLowerCase(), avatar);
      }
    } catch (err) {}

    if (!avatar && e.userName) {
      avatar = await getTwitchUserAvatar(e.userName);
    }

    console.log(`[EventSub] 🎁 Redemption received for user ${userId} by ${e.userName}: "${e.rewardTitle}" (avatar: ${avatar ? 'found' : 'none'})`);
    const ev = {
      type: 'redemption',
      userId,
      isTest: false,
      data: {
        name: e.userDisplayName || e.userName,
        userName: e.userName,
        userDisplayName: e.userDisplayName,
        userId: e.userId,
        avatar: avatar,
        profileImage: avatar,
        profileImageUrl: avatar,
        rewardTitle: e.rewardTitle,
        input: e.input,
        isTest: false
      }
    };
    io.to('user_' + userId).emit('onEventReceived', ev);
  });

  try {
    el.onChannelShoutoutCreate(userId, userId, (e) => {
      console.log(`[EventSub] 📢 Shoutout created on channel ${userId} for: ${e.shoutedOutBroadcasterName}`);
      const ev = {
        type: 'shoutout',
        userId,
        channel: e.shoutedOutBroadcasterName,
        targetChannel: e.shoutedOutBroadcasterName,
        data: {
          channel: e.shoutedOutBroadcasterName,
          username: e.shoutedOutBroadcasterName,
          displayName: e.shoutedOutBroadcasterDisplayName,
          viewerCount: e.viewerCount
        }
      };
      io.to('user_' + userId).emit('onEventReceived', ev);
    });
  } catch (err) {
    console.warn(`[EventSub] Shoutout listener setup warning for ${userId}:`, err?.message || err);
  }

  // ดักฟังข้อความแชทเพื่อตรวจจับคำสั่ง !so, !shoutout และ !sr (Song Request)
  try {
    el.onChannelChatMessage(userId, userId, async (e) => {
      const text = (e.messageText || '').trim();
      console.log(`[Twitch Chat] 💬 <${e.chatterName}> in channel ${userId}: "${text}"`);

      const parts = text.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const isSoCmd = parts.length >= 2 && (cmd === '!so' || cmd === '!shoutout');
      const isSrCmd = cmd === '!sr';

      if (isSoCmd) {
        // ตรวจสอบคำสั่ง !so <channel> หรือ !shoutout <channel>
        const targetChannel = parts[1].replace('@', '').toLowerCase();
        console.log(`[Twitch Chat Command] 📢 Detected ${parts[0]} for "${targetChannel}" from ${e.chatterName}`);
        const soEv = {
          type: 'shoutout',
          userId,
          channel: targetChannel,
          targetChannel: targetChannel,
          data: {
            channel: targetChannel,
            username: targetChannel,
            displayName: targetChannel,
            requestedBy: e.chatterDisplayName || e.chatterName
          }
        };
        io.to('user_' + userId).emit('onEventReceived', soEv);
      } else if (isSrCmd) {
        // คำสั่ง !sr <ชื่อเพลง / Spotify URL> — ขอเพลงจาก Spotify
        const query = parts.slice(1).join(' ').trim();
        const chatterName = e.chatterName || 'viewer';
        const displayName = e.chatterDisplayName || chatterName;

        // ถ้าพิมพ์แค่ !sr โดยไม่มีชื่อเพลง
        if (!query) {
          try {
            await apiClient?.asUser(userId, async (ctx) => {
              await ctx.chat.sendChatMessage(userId, `@${displayName} วิธีขอเพลง: พิมพ์ !sr <ชื่อเพลง หรือ ลิงก์ Spotify> 🎵`);
            });
          } catch (_) {}
          return;
        }

        // ตรวจสอบว่าตั้งค่า Spotify Client ID ใน .env หรือยัง
        if (!spotify.isSpotifyConfigured()) {
          console.warn(`[Spotify SR] ⚠️ Spotify Client ID / Secret is missing in .env`);
          try {
            await apiClient?.asUser(userId, async (ctx) => {
              await ctx.chat.sendChatMessage(userId, `@${displayName} ระบบขอเพลงยังไม่ได้ตั้งค่า Spotify Client ID/Secret ใน .env กรุณาตั้งค่าก่อนใช้งาน`);
            });
          } catch (_) {}
          return;
        }

        try {
          // ตรวจสอบ Cooldown
          const srSettings = widgetSettingsStore['spotify-sr']?.[userId] || {};
          const cooldownSec = parseInt(srSettings.cooldownSeconds ?? 60);
          const remaining = spotify.checkUserCooldown(userId, chatterName, cooldownSec);
          if (remaining > 0) {
            // บอก cooldown ในแชท
            try {
              await apiClient?.asUser(userId, async (ctx) => {
                await ctx.chat.sendChatMessage(userId, `@${displayName} โปรดรอ ${remaining} วินาทีก่อนขอเพลงอีกครั้ง! ⏳`);
              });
            } catch (_) {}
            return;
          }

          // ดึง Access Token ของ Spotify
          const accessToken = await spotify.getValidAccessToken(userId);
          if (!accessToken) {
            try {
              await apiClient?.asUser(userId, async (ctx) => {
                await ctx.chat.sendChatMessage(userId, `@${displayName} สตรีมเมอร์ยังไม่ได้เชื่อมต่อ Spotify กรุณากดปุ่ม "เชื่อมต่อกับ Spotify" ใน Dashboard ก่อนนะ 🎵`);
              });
            } catch (_) {}
            return;
          }

          // ค้นหาเพลงบน Spotify
          const track = await spotify.searchSpotifyTrack(query, accessToken);
          if (!track) {
            try {
              await apiClient?.asUser(userId, async (ctx) => {
                await ctx.chat.sendChatMessage(userId, `@${displayName} ไม่พบเพลง "${query}" ใน Spotify ลองพิมพ์ชื่อเพลงหรือชื่อศิลปินให้ชัดเจนขึ้นนะ 🔍`);
              });
            } catch (_) {}
            return;
          }

          // พยายามเพิ่มเพลงเข้า Spotify Player Queue
          let addedToSpotifyDevice = true;
          let spotifyDeviceWarning = '';
          try {
            await spotify.addTrackToSpotifyQueue(track.uri, accessToken);
          } catch (deviceErr) {
            addedToSpotifyDevice = false;
            if (deviceErr.message === 'NO_ACTIVE_DEVICE') {
              spotifyDeviceWarning = ' (⚠️ อย่าลืมเปิด Spotify และกดเล่นเพลงบนคอมหรือมือถือด้วยนะ)';
            } else if (deviceErr.message === 'PREMIUM_REQUIRED') {
              spotifyDeviceWarning = ' (⚠️ ต้องใช้บัญชี Spotify Premium ถึงจะเล่นเพลงต่อเนื่องอัตโนมัติได้)';
            }
          }

          // บันทึกลง Song Request Queue ของ Solocast เสมอ (เพื่อให้ขึ้นใน Dashboard และ OBS)
          spotify.recordUserCooldown(userId, chatterName);
          const queueItem = spotify.addToSongQueue(userId, displayName, track, 'chat');

          // ส่ง Real-time update ไปยัง Dashboard และ Widget Overlay
          io.to('user_' + userId).emit('spotify_queue_updated', {
            userId,
            queue: spotify.getSongQueueList(userId)
          });
          io.emit('spotify_new_request', {
            userId,
            track,
            requester: displayName
          });

          // ตอบกลับในแชท
          const trackName = track.name;
          const artists = track.artists;
          try {
            await apiClient?.asUser(userId, async (ctx) => {
              await ctx.chat.sendChatMessage(userId, `🎵 @${displayName} เพิ่ม "${trackName}" โดย ${artists} เข้า Queue เรียบร้อย!${spotifyDeviceWarning}`);
            });
          } catch (_) {}

          console.log(`[Spotify SR] 🎵 ${displayName} requested: "${trackName}" by ${artists} (device queued: ${addedToSpotifyDevice})`);
        } catch (srErr) {
          console.error(`[Spotify SR] ❌ Error processing !sr from ${chatterName}:`, srErr?.message || srErr);
          try {
            await apiClient?.asUser(userId, async (ctx) => {
              await ctx.chat.sendChatMessage(userId, `@${displayName} ไม่สามารถขอเพลงได้: ${srErr.message}`);
            });
          } catch (_) {}
        }
      } else {
        // ส่งข้อความแชททั่วไปเข้าห้อง Socket เผื่อ Widget อื่นใช้งาน
        const chatEv = {
          type: 'message',
          userId,
          data: {
            text: text,
            user: e.chatterName,
            displayName: e.chatterDisplayName
          }
        };
        io.to('user_' + userId).emit('onEventReceived', chatEv);
      }
    });
    console.log(`✅ [EventSub] Subscribed to chat messages for user ID: ${userId}`);
  } catch (err) {
    console.warn(`[EventSub] Chat message listener setup warning for ${userId}:`, err?.message || err);
  }
}

io.on('connection', (socket) => {
  console.log('🟢 Socket connected:', socket.id);

  // ให้เบราว์เซอร์หรือ Widget เข้าร่วมห้องเฉพาะของตนเอง
  socket.on('join_user', (payload) => {
    let targetUserId = payload?.userId;
    if (payload?.token && sessions[payload.token]) {
      targetUserId = sessions[payload.token].userId;
    }
    if (targetUserId) {
      socket.join('user_' + targetUserId);
      console.log(`Socket ${socket.id} joined room user_${targetUserId}`);
    }
  });

  socket.on('test_event', (payload) => {
    if (payload?.userId) {
      // ส่งเฉพาะห้องของผู้ใช้คนนี้เท่านั้น ไม่กวนจอของผู้ใช้อื่น
      io.to('user_' + payload.userId).emit('onEventReceived', payload);
    } else {
      io.emit('onEventReceived', payload);
    }
  });

  socket.on('simulate_shoutout', (payload) => {
    const { userId, channel } = payload || {};
    const targetChannel = (channel || 'legionxiz').trim().toLowerCase().replace('@', '');
    const ev = {
      type: 'shoutout',
      userId: userId || '',
      channel: targetChannel,
      targetChannel: targetChannel,
      data: {
        channel: targetChannel,
        username: targetChannel,
        displayName: targetChannel
      }
    };
    if (userId) {
      io.to('user_' + userId).emit('onEventReceived', ev);
    } else {
      io.emit('onEventReceived', ev);
    }
    console.log(`[Shoutout Socket] 📢 Simulated shoutout for: ${targetChannel}`);
  });

  socket.on('simulate_dbd_perk', (payload) => {
    const { userId, role, username } = payload || {};
    const ev = {
      type: 'dbd_perk_roll',
      role: role || 'survivor',
      username: username || 'Streamer',
      avatar: `/api/twitch/avatar/${encodeURIComponent(username || 'Streamer')}`,
      timestamp: Date.now()
    };
    if (userId) {
      io.to('user_' + userId).emit('onEventReceived', ev);
    } else {
      io.emit('onEventReceived', ev);
    }
    console.log(`[DBD Perks Socket] 🎲 Simulated perk roll for: ${ev.username} (${ev.role})`);
  });

  socket.on('send_twitch_chat', async (payload) => {
    try {
      const { userId, message } = payload || {};
      if (!message) return;
      let uid = userId || Object.keys(userTokens)[0] || process.env.TWITCH_USER_ID;
      if (!uid || !apiClient) return;

      await apiClient.asUser(uid, async (ctx) => {
        await ctx.chat.sendChatMessage(uid, message);
      });
      console.log(`[Twitch Chat Socket] 💬 Sent chat for user ${uid}: "${message}"`);
    } catch (err) {
      console.error(`[Twitch Chat Socket] ❌ Error:`, err?.message || err);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Socket disconnected:', socket.id);
  });
});

// Support Ticket / Issue Reporting Endpoint
const SUPPORT_FILE = path.join(__dirname, 'data', 'support_reports.json');

function loadSupportTickets() {
  if (!fs.existsSync(SUPPORT_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(SUPPORT_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveSupportTickets(tickets) {
  const dir = path.dirname(SUPPORT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SUPPORT_FILE, JSON.stringify(tickets, null, 2), 'utf8');
  saveAllTickets(tickets);
}

// 1. Submit a new support report
app.post('/api/support/report', (req, res) => {
  try {
    const { category, subject, description, username, contact, screenshotUrl } = req.body || {};
    if (!subject || !description) {
      return res.status(400).json({ error: 'กรุณากรอกหัวข้อและรายละเอียดปัญหา' });
    }
    const reports = loadSupportTickets();
    const ticketId = 'HYPER-' + Math.floor(100000 + Math.random() * 900000);
    const now = new Date().toISOString();
    const newReport = {
      ticketId,
      category: category || 'general',
      subject: subject.trim(),
      description: description.trim(),
      username: username ? username.trim() : 'Guest',
      contact: contact ? contact.trim() : '',
      screenshotUrl: screenshotUrl ? screenshotUrl.trim() : '',
      status: 'pending', // pending, in_progress, resolved, closed
      adminReply: '',
      adminRepliedAt: null,
      adminUser: null,
      createdAt: now,
      updatedAt: now
    };
    reports.unshift(newReport);
    saveSupportTickets(reports);
    console.log(`[Support] 📩 New ticket created: ${ticketId} - ${subject}`);
    res.json({ success: true, ticketId, report: newReport });
  } catch (err) {
    console.error('[Support] Error saving report:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการส่งข้อมูล' });
  }
});

// 2. Query tickets (for users tracking their tickets OR admin querying all tickets)
app.get('/api/support/tickets', (req, res) => {
  try {
    const tickets = loadSupportTickets();
    const { ticketId, username, ticketIds, status, search } = req.query;

    // Check if requester is Admin
    const session = getSessionFromReq(req);
    const adminKey = req.headers['x-admin-key'] || req.query.adminKey || req.query.admin_key;
    const configuredKey = process.env.ADMIN_KEY || 'solocast_admin_2026';
    const isAdmin = Boolean((session && session.isAdmin) || (adminKey && adminKey === configuredKey));

    if (ticketId) {
      // Direct ticket ID lookup
      const found = tickets.find(t => t.ticketId.toUpperCase() === ticketId.trim().toUpperCase());
      if (!found) {
        return res.status(404).json({ error: 'ไม่พบหมายเลขเรื่องแจ้งปัญหานี้ในระบบ' });
      }
      return res.json({ success: true, ticket: found });
    }

    if (!isAdmin) {
      // User mode: filter by username or list of ticketIds
      let filtered = [];
      if (username) {
        const u = username.trim().toLowerCase();
        filtered = tickets.filter(t => (t.username || '').toLowerCase() === u);
      }
      if (ticketIds) {
        const idList = ticketIds.split(',').map(id => id.trim().toUpperCase());
        const byIds = tickets.filter(t => idList.includes(t.ticketId.toUpperCase()));
        // Merge without duplicates
        const existingIds = new Set(filtered.map(t => t.ticketId));
        byIds.forEach(t => {
          if (!existingIds.has(t.ticketId)) {
            filtered.push(t);
          }
        });
      }
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json({ success: true, tickets: filtered });
    }

    // Admin mode: can filter by status, search query, and return counts
    let result = [...tickets];
    if (status && status !== 'all') {
      result = result.filter(t => t.status === status);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(t =>
        t.ticketId.toLowerCase().includes(q) ||
        (t.subject || '').toLowerCase().includes(q) ||
        (t.username || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const counts = {
      total: tickets.length,
      pending: tickets.filter(t => t.status === 'pending').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length
    };

    res.json({ success: true, tickets: result, counts });
  } catch (err) {
    console.error('[Support] Error retrieving tickets:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลรายการเรื่องแจ้งปัญหาได้' });
  }
});

// 3. Admin: Update ticket status and reply
app.put('/api/support/tickets/:ticketId', checkAdminAuth, (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, adminReply, adminUser } = req.body || {};
    const tickets = loadSupportTickets();
    const index = tickets.findIndex(t => t.ticketId.toUpperCase() === ticketId.toUpperCase());

    if (index === -1) {
      return res.status(404).json({ error: 'ไม่พบเรื่องแจ้งปัญหานี้' });
    }

    const ticket = tickets[index];
    const now = new Date().toISOString();

    if (status) {
      ticket.status = status;
    }
    if (adminReply !== undefined) {
      ticket.adminReply = adminReply;
      ticket.adminRepliedAt = adminReply ? now : null;
      ticket.adminUser = adminReply ? (adminUser || req.user?.displayName || req.user?.username || 'FastChick Admin') : null;
    }
    ticket.updatedAt = now;

    tickets[index] = ticket;
    saveSupportTickets(tickets);

    console.log(`[Support] ✏️ Ticket ${ticketId} updated by admin: status=${ticket.status}`);
    res.json({ success: true, ticket });
  } catch (err) {
    console.error('[Support] Error updating ticket:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
  }
});

// 4. Admin: Delete ticket
app.delete('/api/support/tickets/:ticketId', checkAdminAuth, (req, res) => {
  try {
    const { ticketId } = req.params;
    let tickets = loadSupportTickets();
    const initialLen = tickets.length;
    tickets = tickets.filter(t => t.ticketId.toUpperCase() !== ticketId.toUpperCase());

    if (tickets.length === initialLen) {
      return res.status(404).json({ error: 'ไม่พบเรื่องแจ้งปัญหานี้' });
    }

    saveSupportTickets(tickets);
    deleteTicketFromMongo(ticketId);
    console.log(`[Support] 🗑️ Ticket ${ticketId} deleted by admin`);
    res.json({ success: true, message: `ลบเรื่อง #${ticketId} เรียบร้อยแล้ว` });
  } catch (err) {
    console.error('[Support] Error deleting ticket:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});

// ============================================================
// 🎵 Spotify Song Request — API Routes
// ============================================================

// GET /api/spotify/status — ตรวจสอบสถานะการเชื่อมต่อ Spotify (ของตนเอง)
app.get('/api/spotify/status', (req, res) => {
  const session = getSessionFromReq(req);
  // ใช้ userId จาก session ก่อน ถ้าไม่มีค่อยใช้จาก query param
  const userId = session?.userId || req.query.userId || req.query.user || '';
  const configured = spotify.isSpotifyConfigured();
  const token = spotify.getSpotifyUserToken(userId || undefined);
  const connected = Boolean(token && token.accessToken);
  res.json({
    configured,
    connected,
    displayName: connected ? (token.spotifyDisplayName || token.spotifyUserId || 'Connected') : null,
    product: connected ? (token.product || 'unknown') : null
  });
});

// GET /api/spotify/auth-url — ดึง URL สำหรับ Login Spotify (ผู้ใช้ที่ Login แล้วทุกคนเข้าถึงได้)
app.get('/api/spotify/auth-url', checkUserAuth, (req, res) => {
  try {
    const userId = req.user?.userId || req.query.userId || '';
    if (!spotify.isSpotifyConfigured()) {
      return res.status(503).json({ error: 'Spotify Client ID/Secret ยังไม่ได้ตั้งค่าใน .env' });
    }
    const url = spotify.getSpotifyAuthUrl(userId);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /auth/spotify/callback — รับ Code กลับมาจาก Spotify OAuth
app.get('/auth/spotify/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.send(`<script>window.close();</script><p>Spotify authorization cancelled: ${error}</p>`);
  }
  if (!code) {
    return res.status(400).send('Missing code from Spotify');
  }
  try {
    // Decode state to get userId
    let userId = '';
    try {
      const stateObj = JSON.parse(Buffer.from(state || '', 'base64').toString('utf8'));
      userId = stateObj.userId || '';
    } catch (_) {}

    const tokenData = await spotify.exchangeSpotifyCode(code);
    const targetKey = userId || tokenData.spotifyUserId || 'default';

    // ✅ Merge with existing tokens — preserve all other users' tokens
    const existingAll = spotify.getAllSpotifyTokens();
    const allTokens = { ...existingAll, [targetKey]: tokenData };
    spotify.saveSpotifyTokens(allTokens);

    console.log(`[Spotify] ✅ Connected Spotify account for user "${targetKey}": ${tokenData.spotifyDisplayName} (${tokenData.product})`);
    const frontendUrl = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
    res.redirect(`${frontendUrl}/dashboard?spotify_connected=1`);
  } catch (err) {
    console.error('[Spotify] OAuth callback error:', err);
    res.status(500).send(`Spotify connection failed: ${err.message}`);
  }
});

// DELETE /api/spotify/disconnect — ยกเลิกการเชื่อมต่อ Spotify
app.delete('/api/spotify/disconnect', checkAdminAuth, (req, res) => {
  try {
    const userId = req.user?.userId || req.query.userId || '';
    if (userId) {
      // Remove only this user's token
      const allTokens = spotify.getAllSpotifyTokens();
      delete allTokens[userId];
      spotify.saveSpotifyTokens(allTokens);
    } else {
      // No userId — clear all (admin global reset)
      spotify.saveSpotifyTokens({});
    }
    res.json({ success: true, message: 'Spotify disconnected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/current & /api/spotify/currently-playing — เพลงที่กำลังเล่นอยู่ตอนนี้
app.get(['/api/spotify/current', '/api/spotify/currently-playing'], async (req, res) => {
  try {
    const userId = req.query.userId || req.query.user || '';
    const accessToken = await spotify.getValidAccessToken(userId || undefined);
    if (!accessToken) {
      return res.json({ isPlaying: false, track: null, connected: false });
    }
    const current = await spotify.getCurrentlyPlaying(accessToken);
    res.json({ ...current, connected: true });
  } catch (err) {
    if (err.message === 'TOKEN_EXPIRED') {
      return res.json({ isPlaying: false, track: null, connected: false, error: 'TOKEN_EXPIRED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/queue — รายการขอเพลงที่รอคิว
app.get('/api/spotify/queue', (req, res) => {
  try {
    const userId = req.query.userId || req.query.user || '';
    const limit = parseInt(req.query.limit || '50');
    const queue = spotify.getSongQueueList(userId || undefined, limit);
    res.json({ queue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/spotify/request — ขอเพลงจาก Dashboard (ผู้ใช้ที่ login แล้วทุกคน)
app.post('/api/spotify/request', checkUserAuth, async (req, res) => {
  try {
    const { query, requester } = req.body || {};
    if (!query) return res.status(400).json({ error: 'กรุณากรอกชื่อเพลงหรือ Spotify URL' });

    const userId = req.user?.userId || '';
    const accessToken = await spotify.getValidAccessToken(userId || undefined);
    if (!accessToken) {
      return res.status(503).json({ error: 'ยังไม่ได้เชื่อมต่อ Spotify กรุณา Connect ก่อน' });
    }

    const track = await spotify.searchSpotifyTrack(query, accessToken);
    if (!track) {
      return res.status(404).json({ error: `ไม่พบเพลง "${query}" ใน Spotify` });
    }

    await spotify.addTrackToSpotifyQueue(track.uri, accessToken);
    const queueItem = spotify.addToSongQueue(userId, requester || req.user?.username || 'Dashboard', track, 'dashboard');

    io.to('user_' + userId).emit('spotify_queue_updated', {
      userId,
      queue: spotify.getSongQueueList(userId)
    });
    io.emit('spotify_new_request', {
      userId,
      track,
      requester: requester || req.user?.username || 'Dashboard'
    });

    res.json({ success: true, track, queueItem });
  } catch (err) {
    let msg = err.message;
    if (msg === 'NO_ACTIVE_DEVICE') msg = 'กรุณาเปิด Spotify และเล่นเพลงก่อนนะ 🎧';
    if (msg === 'PREMIUM_REQUIRED') msg = 'ต้องการ Spotify Premium ถึงจะใช้งานได้';
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/spotify/queue/:id — ลบรายการออกจาก Queue (เจ้าของ Queue เท่านั้น)
app.delete('/api/spotify/queue/:id', checkUserAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || '';
    const removed = spotify.removeQueueItem(id, userId);
    if (!removed) return res.status(404).json({ error: 'ไม่พบรายการนี้ใน Queue หรือไม่มีสิทธิ์ลบ' });
    io.to('user_' + userId).emit('spotify_queue_updated', {
      userId,
      queue: spotify.getSongQueueList(userId)
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/spotify/queue — ล้าง Queue ของตัวเอง
app.delete('/api/spotify/queue', checkUserAuth, (req, res) => {
  try {
    const userId = req.user?.userId || '';
    spotify.clearSongQueue(userId || undefined);
    io.to('user_' + userId).emit('spotify_queue_updated', { userId, queue: [] });
    res.json({ success: true, message: 'Queue cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/spotify/skip — ข้ามเพลง (เจ้าของบัญชีนั้นเท่านั้น)
app.post('/api/spotify/skip', checkUserAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || '';
    const accessToken = await spotify.getValidAccessToken(userId || undefined);
    if (!accessToken) return res.status(503).json({ error: 'ยังไม่ได้เชื่อมต่อ Spotify' });
    await spotify.skipSpotifyTrack(accessToken);
    res.json({ success: true });
  } catch (err) {
    let msg = err.message;
    if (msg === 'NO_ACTIVE_DEVICE') msg = 'กรุณาเปิด Spotify และเล่นเพลงก่อน';
    if (msg === 'PREMIUM_REQUIRED') msg = 'ต้องการ Spotify Premium';
    res.status(500).json({ error: msg });
  }
});

// Function to hydrate all in-memory stores from MongoDB on startup
async function hydrateFromMongo() {
  try {
    const mongoSessions = await syncStore('sessions', sessions);
    Object.assign(sessions, mongoSessions);

    const mongoSettings = await syncStore('widget_settings', widgetSettingsStore);
    Object.assign(widgetSettingsStore, mongoSettings);

    const mongoRolls = await syncStore('roll_history', rollHistoryStore);
    Object.assign(rollHistoryStore, mongoRolls);

    const mongoStore = await syncStore('widget_store', widgetStore);
    Object.assign(widgetStore, mongoStore);

    const mongoTokens = await syncStore('tokens', userTokens);
    Object.assign(userTokens, mongoTokens);

    const mongoTickets = await syncTickets(loadSupportTickets());
    if (Array.isArray(mongoTickets) && mongoTickets.length > 0) {
      const dir = path.dirname(SUPPORT_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SUPPORT_FILE, JSON.stringify(mongoTickets, null, 2), 'utf8');
    }

    // 🎵 Hydrate Spotify Tokens & Queue from MongoDB
    const mongoSpotifyTokens = await syncStore('spotify_tokens', {});
    const mongoSpotifyQueue = await syncStore('spotify_queue', {});
    const queueList = Object.values(mongoSpotifyQueue || {}).sort((a, b) => (a.requestedAt || 0) - (b.requestedAt || 0));
    spotify.setHydratedSpotifyData(mongoSpotifyTokens, queueList);

    // 🔒 Hydrate Widget Status (Global Lock & User Toggle) from MongoDB
    const mongoGlobalStatus = await syncStore('global_widget_status', globalWidgetStatus);
    Object.assign(globalWidgetStatus, mongoGlobalStatus);

    const mongoUserStatus = await syncStore('user_widget_status', userWidgetStatus);
    Object.assign(userWidgetStatus, mongoUserStatus);

    console.log('✨ [Database] In-memory stores successfully synchronized with MongoDB Atlas!');
  } catch (err) {
    console.error('❌ [Database] Failed to hydrate stores from MongoDB:', err.message);
  }
}

// SPA Fallback: Serve React Frontend for non-API routes in production
if (fs.existsSync(frontendDist)) {
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/auth') && !req.path.startsWith('/widgets') && !req.path.startsWith('/socket.io')) {
      return res.sendFile(path.join(frontendDist, 'index.html'));
    }
    next();
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  await initDatabase();
  await hydrateFromMongo();

  // 🎵 Spotify Now Playing — Poll & Broadcast every 15 seconds
  if (spotify.isSpotifyConfigured()) {
    setInterval(async () => {
      try {
        const token = spotify.getSpotifyUserToken(undefined);
        if (!token) return;
        const uid = token.spotifyUserId || Object.keys({}).find(Boolean) || 'default';
        const accessToken = await spotify.getValidAccessToken(undefined);
        if (!accessToken) return;
        const current = await spotify.getCurrentlyPlaying(accessToken);
        if (current) {
          io.emit('spotify_now_playing', { ...current, timestamp: Date.now() });
        }
      } catch (e) {
        // Silently ignore polling errors
      }
    }, 15000);
    console.log('🎵 [Spotify] Now Playing polling started (15s interval)');
  }
});

