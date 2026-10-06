// Solocast Adapter - StreamElements Compatible Bridge & Real-Time Sync

const socket = io('/', {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

// ฟังก์ชันสำหรับดึง Query Parameters จาก URL
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const fieldData = {};
  for(const [key, value] of params.entries()) {
    fieldData[key] = value;
  }
  return fieldData;
}

// ตรวจจับ Widget ID จาก URL เช่น /widgets/random-killer/index.html -> random-killer
function getWidgetId() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('widgets');
  if (idx !== -1 && parts[idx + 1]) {
    return parts[idx + 1];
  }
  return '';
}

const currentWidgetId = getWidgetId();
const initialParams = new URLSearchParams(window.location.search);
const secretOverlayToken = initialParams.get('token') || initialParams.get('key') || '';
const isPreviewMode = initialParams.get('preview') === '1';
let targetUser = initialParams.get('user') || initialParams.get('channel') || '';

function isUserMatchingTarget(data) {
  const currentTarget = String(targetUser || window.SolocastTargetUser || '').trim().toLowerCase().replace(/^@/, '');
  if (!currentTarget) return true;
  if (!data) return true;

  if (typeof data === 'string' || typeof data === 'number') {
    return String(data).trim().toLowerCase().replace(/^@/, '') === currentTarget;
  }

  const uid = String(data.userId || '').trim().toLowerCase().replace(/^@/, '');
  const uname = String(data.username || data.name || data.channel || '').trim().toLowerCase().replace(/^@/, '');
  if (uid && uid === currentTarget) return true;
  if (uname && uname === currentTarget) return true;

  if (Array.isArray(data.associatedUserIds)) {
    return data.associatedUserIds.some(id => String(id || '').trim().toLowerCase().replace(/^@/, '') === currentTarget);
  }

  return false;
}

function joinAllUserRooms() {
  const u = targetUser || window.SolocastTargetUser || '';
  if (socket.connected) {
    if (secretOverlayToken) {
      socket.emit('join_user', { overlayToken: secretOverlayToken, userId: u });
      socket.emit('join_channel', { overlayToken: secretOverlayToken, channel: u });
    } else if (u) {
      socket.emit('join_user', { userId: u });
      socket.emit('join_channel', u);
    }
    console.log('[Solocast Adapter] Room membership refreshed for user & channel:', u);
  }
}

socket.on('connect', () => {
  console.log('[Solocast Adapter] Socket connected/reconnected:', socket.id);
  joinAllUserRooms();
  checkLiveStatus();
  syncSavedSettings();
});

socket.on('reconnect', () => {
  console.log('[Solocast Adapter] Socket reconnected, resyncing rooms and settings...');
  joinAllUserRooms();
  checkLiveStatus();
  syncSavedSettings();
});

socket.on('overlay_token_revoked', () => {
  console.warn('[Solocast Adapter] Overlay token was revoked or regenerated. Deactivating overlay.');
  applyOverlayVisibility(false, 'Token revoked');
});

console.log('[Solocast Adapter] Initialized');

// จัดการสถานะเปิด/ปิดการทำงานของ Widget Overlay (ทั้งจาก Admin Global Lock และ User Setting)
const statusStyle = document.createElement('style');
statusStyle.id = 'solocast-overlay-status-style';
if (document.head) {
  document.head.appendChild(statusStyle);
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('solocast-overlay-status-style')) {
      document.head.appendChild(statusStyle);
    }
  });
}

let isWidgetActive = (typeof window !== 'undefined' && window.__SOLOCAST_INITIAL_ACTIVE !== undefined)
  ? Boolean(window.__SOLOCAST_INITIAL_ACTIVE)
  : true;
let disabledReason = '';
let hasInitialLoaded = false;

// ฟังก์ชันปรับการแสดงผลและปิดเสียง Overlay เมื่อ Widget ถูกปิดใช้งาน
function applyOverlayVisibility(active, reason) {
  isWidgetActive = Boolean(active);
  disabledReason = reason || '';

  if (!isWidgetActive) {
    document.documentElement.setAttribute('data-solocast-disabled', 'true');
    statusStyle.textContent = `
      html[data-solocast-disabled="true"] body, body {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    if (document.body) {
      document.body.style.display = 'none';
    }
    // ปิดเสียงหรือวิดีโอที่กำลังเล่นอยู่ทันที
    try {
      document.querySelectorAll('audio, video').forEach(media => {
        media.pause();
        media.currentTime = 0;
      });
    } catch (_) {}
    console.warn(`[Solocast Adapter] Widget "${currentWidgetId}" is DISABLED (${disabledReason || 'inactive'}). Overlay hidden from stream.`);
  } else {
    document.documentElement.removeAttribute('data-solocast-disabled');
    statusStyle.textContent = '';
    if (document.body) {
      document.body.style.display = '';
    }
    console.log(`[Solocast Adapter] Widget "${currentWidgetId}" is ACTIVE.`);
    // หากก่อนหน้านี้ปิดอยู่แล้วเพิ่งเปิด ให้โหลดข้อมูลและแสดงผลทันที
    if (!hasInitialLoaded && typeof dispatchWidgetLoad === 'function') {
      hasInitialLoaded = true;
      dispatchWidgetLoad(activeFields);
      syncSavedSettings();
    }
  }
}

// ตรวจสอบสถานะ Live Status จากเซิร์ฟเวอร์แบบเจาะจง User และ Widget
async function checkLiveStatus() {
  if (!currentWidgetId) return;
  try {
    const query = new URLSearchParams();
    if (secretOverlayToken) {
      query.set('token', secretOverlayToken);
    } else {
      const u = targetUser || window.SolocastTargetUser || '';
      const ch = initialParams.get('channel') || initialParams.get('username') || '';
      if (u) query.set('user', u);
      if (ch) query.set('channel', ch);
    }
    const res = await fetch(`/api/widgets/${currentWidgetId}/live-status?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      applyOverlayVisibility(data.active, data.reason);
    } else if (res.status === 401) {
      applyOverlayVisibility(false, 'Unauthorized: Missing or invalid Secret Token');
    }
  } catch (err) {
    console.warn('[Solocast Adapter] Failed to fetch live status:', err);
  }
}

// ตรวจสอบและระบุตัวตนผู้ใช้ผ่าน Secret Overlay Token
async function initIdentityAndStatus() {
  if (secretOverlayToken) {
    try {
      const res = await fetch(`/api/overlay/resolve?token=${encodeURIComponent(secretOverlayToken)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.valid && data.userId) {
          targetUser = data.userId;
          window.SolocastTargetUser = data.userId;
          joinAllUserRooms();
          checkLiveStatus();
          syncSavedSettings();
          return;
        }
      }
    } catch (e) {
      console.warn('[Solocast Adapter] Token resolve failed:', e);
    }
    // หาก Token ไม่ถูกต้อง ให้บล็อกการแสดงผล
    applyOverlayVisibility(false, 'Unauthorized: Invalid Secret Token');
    return;
  }

  // หากไม่มี Token และไม่ใช่โหมด Preview ให้ปฏิเสธการเข้าถึงทันที (ยกเลิกแบบเก่า)
  if (!isPreviewMode) {
    applyOverlayVisibility(false, 'Unauthorized: Missing Secret Token. Please copy the new URL from dashboard.');
    return;
  }

  // โหมด Preview ใน Dashboard (มี session)
  window.SolocastTargetUser = targetUser;
  if (targetUser) {
    joinAllUserRooms();
    checkLiveStatus();
    syncSavedSettings();
  }
}

initIdentityAndStatus();

// 🛡️ Auto-healer: ตรวจสอบสถานะและความพร้อมของการเชื่อมต่อห้องทุกๆ 30 วินาที
// ช่วยแก้ปัญหาเวลา OBS พักหน้าจอ (Sleep/Hidden Scene) หรือเครือข่ายกระตุก ทำให้ Widget กลับมาทำงานได้เองอัตโนมัติ
setInterval(() => {
  if (socket.connected) {
    joinAllUserRooms();
  }
  checkLiveStatus();
}, 30000);

// ฟังก์ชันส่งข้อความแชท Twitch ในนามของสตรีมเมอร์เจ้าของช่อง
window.sendTwitchChat = async function(message) {
  if (!message) return;
  console.log('[Solocast Adapter] Requesting to send Twitch chat:', message);
  try {
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: targetUser,
        token: secretOverlayToken,
        message: message
      })
    });
    const data = await res.json();
    if (data.success) {
      console.log('[Solocast Adapter] Twitch chat sent successfully as streamer:', data);
    } else {
      console.warn('[Solocast Adapter] Twitch chat send response:', data.error);
    }
    return data;
  } catch (err) {
    console.error('[Solocast Adapter] Failed to call /api/chat/send:', err);
  }
};

// ฟังก์ชันบันทึกประวัติการสุ่มผลลัพธ์
window.recordRollHistory = async function(item) {
  if (!item || !currentWidgetId) return;
  if (!isWidgetActive) {
    console.log('[Solocast Adapter] Skipped recording roll history because widget is disabled');
    return { success: false, disabled: true };
  }

  // หากผู้ส่งแต้มเป็น GamerGod88 ให้ไม่เก็บประวัติ
  if (item.username && item.username.toLowerCase() === 'gamergod88') {
    console.log('[Solocast Adapter] Skipped recording roll history because user is GamerGod88');
    return { success: true, skipped: true };
  }

  console.log('[Solocast Adapter] Recording roll history:', item);
  try {
    const res = await fetch(`/api/widgets/${currentWidgetId}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: targetUser,
        token: secretOverlayToken,
        item: item
      })
    });
    return await res.json();
  } catch (err) {
    console.error('[Solocast Adapter] Failed to record roll history:', err);
  }
};

// จำลอง StreamElements Store API (SE_API.store) เพื่อรองรับ Widget ที่มีการนับแต้ม (เช่น Loyalty Card)
window.SE_API = window.SE_API || {};
window.SE_API.store = {
  get: function(key) {
    return new Promise((resolve, reject) => {
      const u = targetUser || window.SolocastTargetUser || getUrlParams().user || getUrlParams().channel || 'default';
      const query = new URLSearchParams();
      if (secretOverlayToken) query.set('token', secretOverlayToken);
      if (u) query.set('user', u);
      const localKey = `se_store_${currentWidgetId}_${u}_${key}`;

      let cachedVal = null;
      try {
        cachedVal = localStorage.getItem(localKey);
      } catch (e) {}

      fetch(`/api/widgets/${currentWidgetId}/store/${encodeURIComponent(key)}?${query.toString()}`)
        .then(res => {
          if (res.ok) {
            return res.json();
          }
          if (res.status === 404) {
            // ไม่พบ Key บนเซิร์ฟเวอร์
            if (cachedVal !== null) {
              return { value: cachedVal };
            }
            throw new Error('Key not found');
          }
          throw new Error('Store request failed');
        })
        .then(data => {
          console.log(`[Solocast Adapter] SE_API.store.get "${key}":`, data.value);
          let parsed = data.value;
          if (typeof parsed === 'string') {
            try {
              if (parsed.startsWith('{') || parsed.startsWith('[')) {
                parsed = JSON.parse(parsed);
              }
            } catch (e) {}
          }
          try {
            localStorage.setItem(localKey, typeof parsed === 'object' ? JSON.stringify(parsed) : String(parsed));
          } catch (e) {}
          let resObj = parsed;
          if (resObj && typeof resObj === 'object' && resObj.value === undefined) {
            resObj.value = parsed;
          } else if (typeof resObj !== 'object' || resObj === null) {
            resObj = { value: resObj };
          }
          resolve(resObj);
        })
        .catch(err => {
          if (cachedVal !== null) {
            console.log(`[Solocast Adapter] SE_API.store.get (cached) "${key}":`, cachedVal);
            let parsed = cachedVal;
            if (typeof parsed === 'string') {
              try {
                if (parsed.startsWith('{') || parsed.startsWith('[')) parsed = JSON.parse(parsed);
              } catch (e) {}
            }
            let resObj = parsed;
            if (resObj && typeof resObj === 'object' && resObj.value === undefined) {
              resObj.value = parsed;
            } else if (typeof resObj !== 'object' || resObj === null) {
              resObj = { value: resObj };
            }
            resolve(resObj);
          } else {
            console.log(`[Solocast Adapter] SE_API.store.get "${key}": not found (initial state)`);
            reject(err);
          }
        });
    });
  },
  set: function(key, payload) {
    return new Promise((resolve) => {
      if (!isWidgetActive) {
        console.log(`[Solocast Adapter] SE_API.store.set "${key}" skipped because widget is disabled`);
        return resolve({ success: false, disabled: true });
      }

      const val = (payload && payload.value !== undefined) ? payload.value : payload;
      const u = targetUser || window.SolocastTargetUser || getUrlParams().user || getUrlParams().channel || 'default';
      const localKey = `se_store_${currentWidgetId}_${u}_${key}`;

      console.log(`[Solocast Adapter] SE_API.store.set "${key}":`, val);
      try {
        localStorage.setItem(localKey, typeof val === 'object' ? JSON.stringify(val) : String(val));
      } catch (e) {}

      fetch(`/api/widgets/${currentWidgetId}/store/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: u,
          token: secretOverlayToken,
          value: val
        })
      })
      .then(res => res.json())
      .then(() => resolve({ success: true }))
      .catch(() => resolve({ success: true }));
    });
  }
};


// เก็บ Fields ปัจจุบัน พร้อมโหลดค่าแคชจาก LocalStorage เพื่อให้ Widget ใช้งานได้ทันที 100% แม้เซิร์ฟเวอร์ยังตอบสนองไม่เสร็จ
let activeFields = { ...getUrlParams() };
try {
  const initialStorageKey = `solocast_settings_${currentWidgetId}_${targetUser || 'default'}`;
  const cachedSettings = localStorage.getItem(initialStorageKey);
  if (cachedSettings) {
    const parsed = JSON.parse(cachedSettings);
    if (parsed && typeof parsed === 'object') {
      activeFields = { ...parsed, ...activeFields };
      console.log('[Solocast Adapter] Loaded cached settings from localStorage:', activeFields);
    }
  }
} catch (_) {}

// ฟังก์ชันส่งอีเวนต์ onWidgetLoad และ onFieldsUpdate ไปยัง Custom Widget
function dispatchWidgetLoad(fieldsToApply) {
  if (!isWidgetActive) {
    console.log('[Solocast Adapter] Skipping onWidgetLoad because widget is disabled.');
    return;
  }
  hasInitialLoaded = true;

  const fields = fieldsToApply || activeFields;
  const chName = fields.channel || fields.user || targetUser || 'SolocastUser';

  const loadEvent = new CustomEvent('onWidgetLoad', {
    detail: {
      channel: {
        id: targetUser || '',
        username: chName
      },
      fieldData: fields
    }
  });
  window.dispatchEvent(loadEvent);

  const updateEvent = new CustomEvent('onFieldsUpdate', {
    detail: {
      fieldData: fields,
      ...fields
    }
  });
  window.dispatchEvent(updateEvent);

  console.log('[Solocast Adapter] Dispatched onWidgetLoad & onFieldsUpdate with:', fields);
}

// ดึงการตั้งค่าที่บันทึกไว้ในระบบ (เช่น Reward Name) จาก Backend
async function syncSavedSettings() {
  if (!currentWidgetId) return;
  try {
    const query = new URLSearchParams();
    if (secretOverlayToken) query.set('token', secretOverlayToken);
    const u = targetUser || window.SolocastTargetUser || '';
    if (u) query.set('user', u);
    const res = await fetch(`/api/widgets/${currentWidgetId}/settings?${query.toString()}`);
    if (res.ok) {
      const saved = await res.json();
      if (saved && typeof saved === 'object') {
        // ในโหมด Preview ของ Dashboard ให้ URL Query Params ล่าสุดมีความสำคัญสูงสุด
        // ใน OBS ปกติ (ไม่มี preview=1) การตั้งค่าจากเซิร์ฟเวอร์จะสำคัญกว่า URL Query Params แบบเดิม
        if (getUrlParams().preview === '1') {
          activeFields = { ...saved, ...getUrlParams() };
        } else {
          activeFields = { ...getUrlParams(), ...saved };
        }
        try {
          const storeUser = u || 'default';
          localStorage.setItem(`solocast_settings_${currentWidgetId}_${storeUser}`, JSON.stringify(activeFields));
        } catch (_) {}
        if (isWidgetActive) {
          dispatchWidgetLoad(activeFields);
        }
        console.log('[Solocast Adapter] ✅ Synchronized saved settings from server:', activeFields);
      }
    }
  } catch (err) {
    console.warn('[Solocast Adapter] Could not fetch saved settings:', err);
  }
}

// ยิง onWidgetLoad ทันที และซิงค์การตั้งค่าจากเซิร์ฟเวอร์
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (isWidgetActive) {
      dispatchWidgetLoad(activeFields);
      syncSavedSettings();
    }
  });
} else {
  setTimeout(() => {
    if (isWidgetActive) {
      dispatchWidgetLoad(activeFields);
      syncSavedSettings();
    }
  }, 50);
}

// ฟัง Live Update จาก Dashboard แบบ Real-time ทันทีที่ผู้ใช้กดบันทึกหรือเปลี่ยนค่า
socket.on('widget_settings_updated', (payload) => {
  if (!payload || payload.widgetId !== currentWidgetId) return;
  if (!isUserMatchingTarget(payload)) return;

  console.log('[Solocast Adapter] ⚡ Live settings update received from Dashboard:', payload.settings);
  activeFields = { ...activeFields, ...payload.settings };
  try {
    const storeUser = targetUser || window.SolocastTargetUser || 'default';
    localStorage.setItem(`solocast_settings_${currentWidgetId}_${storeUser}`, JSON.stringify(activeFields));
  } catch (_) {}
  if (isWidgetActive) {
    dispatchWidgetLoad(activeFields);
  }
});

// รองรับ Live Settings Update จาก Dashboard ผ่าน postMessage ใน iframe preview
window.addEventListener('message', (e) => {
  if (e.data && (e.data.type === 'onWidgetLoad' || e.data.type === 'onFieldsUpdate') && e.data.fieldData) {
    activeFields = { ...activeFields, ...e.data.fieldData };
    if (isWidgetActive) {
      dispatchWidgetLoad(activeFields);
    }
  }
});

// ฟัง Live Update สถานะเปิด/ปิด Widget ของ User จาก Dashboard แบบ Real-time
socket.on('user_widget_status_changed', (payload) => {
  if (!payload || payload.widgetId !== currentWidgetId) return;
  if (!isUserMatchingTarget(payload)) return;
  console.log(`[Solocast Adapter] 👤 Real-time user widget status changed for "${currentWidgetId}":`, payload.enabled);
  checkLiveStatus();
});

// ฟัง Live Update สถานะเปิด/ปิด Widget ทั้งระบบของ Admin (Global Lock) แบบ Real-time
socket.on('widget_global_status_changed', (payload) => {
  if (!payload || payload.widgetId !== currentWidgetId) return;
  console.log(`[Solocast Adapter] 🛡️ Real-time global widget status changed for "${currentWidgetId}":`, payload.enabled);
  checkLiveStatus();
});

// ฟัง Live Update ทั่วไปของ Widget Status
socket.on('widget_status_updated', (payload) => {
  if (!payload || payload.widgetId !== currentWidgetId) return;
  if (!isUserMatchingTarget(payload)) return;
  console.log(`[Solocast Adapter] ⚡ Real-time widget status updated for "${currentWidgetId}":`, payload);
  checkLiveStatus();
});

// รองรับการยิงซ้ำหากได้รับสถานะเชื่อมต่อ
socket.on('backend_status', (status) => {
  if (status && status.connected && isWidgetActive) {
    dispatchWidgetLoad(activeFields);
  }
});

// จำลอง Event 'onEventReceived' ของ StreamElements
socket.on('onEventReceived', (event) => {
  if (!isWidgetActive) {
    console.log(`[Solocast Adapter] ⏸️ Event "${event.type}" suppressed because widget "${currentWidgetId}" is disabled`);
    return;
  }
  if (!isUserMatchingTarget(event)) {
    return; // ข้ามอีเวนต์ที่ไม่ใช่ของช่องนี้
  }

  let seEventDetail = {};

  if (event.type === 'follower') {
    seEventDetail = {
      listener: 'follower-latest',
      event: {
        type: 'follower',
        name: event.data.name,
        amount: 1,
        message: '',
        isTest: event.isTest !== undefined ? event.isTest : true
      }
    };
  } else if (event.type === 'subscriber') {
    seEventDetail = {
      listener: 'subscriber-latest',
      event: {
        type: 'subscriber',
        name: event.data.name,
        amount: 1,
        tier: event.data.tier,
        message: '',
        isTest: event.isTest !== undefined ? event.isTest : true
      }
    };
  } else if (event.type === 'redemption') {
    const rTitle = event.data.rewardTitle || event.data.title || event.data.redemption || '';
    const uName = event.data.name || event.data.user || event.data.username || 'User';
    const av = event.data.avatar || event.data.profileImage || event.data.profileImageUrl || `/api/twitch/avatar/${encodeURIComponent(uName)}`;
    const rInput = event.data.input || event.data.user_input || event.data.message || event.input || '';

    seEventDetail = {
      listener: 'redemption-latest',
      event: {
        type: 'redemption',
        rewardTitle: rTitle,
        redemption: rTitle,
        title: rTitle,
        name: uName,
        username: uName,
        displayName: event.data.displayName || uName,
        avatar: av,
        profileImage: av,
        profileImageUrl: av,
        message: rInput,
        user_input: rInput,
        input: rInput,
        data: {
          name: uName,
          rewardTitle: rTitle,
          redemption: rTitle,
          title: rTitle,
          avatar: av,
          profileImage: av,
          profileImageUrl: av,
          message: rInput,
          user_input: rInput,
          input: rInput
        },
        user: {
          name: uName,
          avatar: av
        },
        author: {
          name: uName,
          avatar: av
        },
        reward: {
          title: rTitle,
          name: rTitle
        },
        isTest: event.isTest !== undefined ? event.isTest : true
      }
    };
  } else if (event.type === 'shoutout') {
    const chName = event.channel || event.targetChannel || event.data?.channel || event.data?.username || 'streamer';
    seEventDetail = {
      listener: 'shoutout-latest',
      event: {
        type: 'shoutout',
        channel: chName,
        targetChannel: chName,
        username: chName,
        displayName: event.data?.displayName || chName,
        data: event.data || {}
      }
    };
  } else if (event.type === 'dbd_perk_roll') {
    seEventDetail = {
      listener: 'dbd_perk_roll',
      event: {
        type: 'dbd_perk_roll',
        role: event.role || 'survivor',
        username: event.username || 'Streamer',
        avatar: event.avatar || '',
        timestamp: event.timestamp || Date.now()
      }
    };
  } else {
    seEventDetail = {
      listener: event.type || 'custom',
      event: event
    };
  }

  // ส่งต่อให้ Widget ของ StreamElements
  if (seEventDetail.listener) {
    const seEvent = new CustomEvent('onEventReceived', {
      detail: seEventDetail
    });
    window.dispatchEvent(seEvent);
    console.log('[Solocast Adapter] Dispatched onEventReceived:', seEventDetail);
  }
});

// 🎵 Spotify Now Playing & Requests Bridge
socket.on('spotify_now_playing', (data) => {
  if (!isWidgetActive) return;
  if (!isUserMatchingTarget(data)) return;
  const seEvent = new CustomEvent('onEventReceived', {
    detail: {
      type: 'spotify_now_playing',
      listener: 'spotify_now_playing',
      data: data
    }
  });
  window.dispatchEvent(seEvent);
});

socket.on('spotify_new_request', (data) => {
  if (!isWidgetActive) return;
  if (!isUserMatchingTarget(data)) return;
  const seEvent = new CustomEvent('onEventReceived', {
    detail: {
      type: 'spotify_new_request',
      listener: 'spotify_new_request',
      data: data
    }
  });
  window.dispatchEvent(seEvent);
});

