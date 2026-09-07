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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

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
  return res.status(403).json({
    error: '403 Forbidden: เฉพาะผู้ดูแลระบบ (Admin / Broadcaster) เท่านั้นที่มีสิทธิ์เข้าถึง',
    loggedIn: Boolean(session)
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
  const isAdmin = Boolean(session && session.isAdmin);

  res.json({
    success: true,
    authorized: isAdmin,
    isTwitchConnected: Boolean(session),
    connectedUsername: session ? session.username : null,
    isBroadcaster: isAdmin
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
}

const rollHistoryStore = loadRollHistory();

// 1. ดึงประวัติการสุ่ม (Roll History)
app.get('/api/widgets/:id/history', (req, res) => {
  try {
    const widgetId = req.params.id;
    const user = req.query.user || req.query.channel || 'default';
    const list = rollHistoryStore[widgetId]?.[user] || [];
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. บันทึกผลลัพธ์การสุ่มใหม่
app.post('/api/widgets/:id/history', (req, res) => {
  try {
    const widgetId = req.params.id;
    const { user, item } = req.body;
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

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const redirectUri = 'http://localhost:3000/auth/twitch/callback';

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
    res.redirect(`http://localhost:5173/dashboard?auth_token=${sessionToken}`);
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

  el.onChannelRedemptionAdd(userId, (e) => {
    console.log(`[EventSub] 🎁 Redemption received for user ${userId} by ${e.userName}: "${e.rewardTitle}"`);
    const ev = {
      type: 'redemption',
      userId,
      isTest: false,
      data: {
        name: e.userName,
        rewardTitle: e.rewardTitle,
        input: e.input,
        isTest: false
      }
    };
    io.to('user_' + userId).emit('onEventReceived', ev);
    io.emit('onEventReceived', ev);
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
      io.emit('onEventReceived', ev);
    });
  } catch (err) {
    console.warn(`[EventSub] Shoutout listener setup warning for ${userId}:`, err?.message || err);
  }

  // ดักฟังข้อความแชทเพื่อตรวจจับคำสั่ง !so หรือ !shoutout
  try {
    el.onChannelChatMessage(userId, userId, (e) => {
      const text = (e.messageText || '').trim();
      console.log(`[Twitch Chat] 💬 <${e.chatterName}> in channel ${userId}: "${text}"`);

      // ส่งข้อความเข้าห้อง Socket เผื่อ Widget อื่นใช้งาน
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
      io.emit('onEventReceived', chatEv);

      // ตรวจสอบคำสั่ง !so <channel> หรือ !shoutout <channel>
      const parts = text.split(/\s+/);
      if (parts.length >= 2 && (parts[0].toLowerCase() === '!so' || parts[0].toLowerCase() === '!shoutout')) {
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
        io.emit('onEventReceived', soEv);
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
