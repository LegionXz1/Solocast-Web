// Solocast Adapter - StreamElements Compatible Bridge & Real-Time Sync

const socket = io('/');

socket.on('connect', () => {
  const u = targetUser || window.SolocastTargetUser || '';
  if (u) {
    socket.emit('join_channel', u);
  }
});

console.log('[Solocast Adapter] Initialized');

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
let targetUser = initialParams.get('user') || initialParams.get('channel') || '';

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
    console.warn(`[Solocast Adapter] ⛔ Widget "${currentWidgetId}" is DISABLED (${disabledReason || 'inactive'}). Overlay hidden from stream.`);
  } else {
    document.documentElement.removeAttribute('data-solocast-disabled');
    statusStyle.textContent = '';
    if (document.body) {
      document.body.style.display = '';
    }
    console.log(`[Solocast Adapter] ✅ Widget "${currentWidgetId}" is ACTIVE.`);
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
    const u = targetUser || window.SolocastTargetUser || '';
    const ch = initialParams.get('channel') || initialParams.get('username') || '';
    const query = new URLSearchParams({ user: u });
    if (ch) query.set('channel', ch);
    const res = await fetch(`/api/widgets/${currentWidgetId}/live-status?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      applyOverlayVisibility(data.active, data.reason);
    }
  } catch (err) {
    console.warn('[Solocast Adapter] Failed to fetch live status:', err);
  }
}

// ตรวจสอบสถานะทันทีเมื่อโหลดสคริปต์
checkLiveStatus();

// เข้าร่วมห้องของผู้ใช้
window.SolocastTargetUser = targetUser;
if (targetUser) {
  socket.emit('join_user', { userId: targetUser });
  console.log('[Solocast Adapter] Joined room for user:', targetUser);
} else {
  // หากไม่ได้ระบุ user ใน URL ให้พยายามดึง user เริ่มต้นของเซิร์ฟเวอร์
  fetch('/api/default-user')
    .then(r => r.json())
    .then(d => {
      if (d.userId) {
        targetUser = d.userId;
        window.SolocastTargetUser = targetUser;
        socket.emit('join_user', { userId: targetUser });
        console.log('[Solocast Adapter] Auto-joined room for default user:', targetUser);
        checkLiveStatus();
        syncSavedSettings();
      }
    })
    .catch(() => {});
}

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
        message: message
      })
    });
    const data = await res.json();
    if (data.success) {
      console.log('[Solocast Adapter] ✅ Twitch chat sent successfully as streamer:', data);
    } else {
      console.warn('[Solocast Adapter] ⚠️ Twitch chat send response:', data.error);
    }
    return data;
  } catch (err) {
    console.error('[Solocast Adapter] ❌ Failed to call /api/chat/send:', err);
  }
};

// ฟังก์ชันบันทึกประวัติการสุ่มผลลัพธ์
window.recordRollHistory = async function(item) {
  if (!item || !currentWidgetId) return;
  if (!isWidgetActive) {
    console.log('[Solocast Adapter] 🚫 Skipped recording roll history because widget is disabled');
    return { success: false, disabled: true };
  }

  // หากผู้ส่งแต้มเป็น GamerGod88 ให้ไม่เก็บประวัติ
  if (item.username && item.username.toLowerCase() === 'gamergod88') {
    console.log('[Solocast Adapter] 🚫 Skipped recording roll history because user is GamerGod88');
    return { success: true, skipped: true };
  }

  console.log('[Solocast Adapter] Recording roll history:', item);
  try {
    const res = await fetch(`/api/widgets/${currentWidgetId}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: targetUser,
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
      const userParam = `?user=${encodeURIComponent(u)}`;
      const localKey = `se_store_${currentWidgetId}_${u}_${key}`;

      let cachedVal = null;
      try {
        cachedVal = localStorage.getItem(localKey);
      } catch (e) {}

      fetch(`/api/widgets/${currentWidgetId}/store/${encodeURIComponent(key)}${userParam}`)
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
          console.log(`[Solocast Adapter] 📦 SE_API.store.get "${key}":`, data.value);
          try {
            localStorage.setItem(localKey, String(data.value));
          } catch (e) {}
          resolve({ value: data.value });
        })
        .catch(err => {
          if (cachedVal !== null) {
            console.log(`[Solocast Adapter] 📦 SE_API.store.get (cached) "${key}":`, cachedVal);
            resolve({ value: cachedVal });
          } else {
            console.log(`[Solocast Adapter] ℹ️ SE_API.store.get "${key}": not found (initial state)`);
            reject(err);
          }
        });
    });
  },
  set: function(key, payload) {
    return new Promise((resolve) => {
      if (!isWidgetActive) {
        console.log(`[Solocast Adapter] 🚫 SE_API.store.set "${key}" skipped because widget is disabled`);
        return resolve({ success: false, disabled: true });
      }

      const val = (payload && payload.value !== undefined) ? payload.value : payload;
      const u = targetUser || window.SolocastTargetUser || getUrlParams().user || getUrlParams().channel || 'default';
      const localKey = `se_store_${currentWidgetId}_${u}_${key}`;

      console.log(`[Solocast Adapter] 💾 SE_API.store.set "${key}":`, val);
      try {
        localStorage.setItem(localKey, String(val));
      } catch (e) {}

      fetch(`/api/widgets/${currentWidgetId}/store/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: u,
          value: val
        })
      })
      .then(res => res.json())
      .then(() => resolve({ success: true }))
      .catch(() => resolve({ success: true }));
    });
  }
};


// เก็บ Fields ปัจจุบัน
let activeFields = { ...getUrlParams() };

// ฟังก์ชันส่งอีเวนต์ onWidgetLoad และ onFieldsUpdate ไปยัง Custom Widget
function dispatchWidgetLoad(fieldsToApply) {
  if (!isWidgetActive) {
    console.log('[Solocast Adapter] ⏸️ Skipping onWidgetLoad because widget is disabled.');
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
    const userParam = targetUser ? `?user=${encodeURIComponent(targetUser)}` : '';
    const res = await fetch(`/api/widgets/${currentWidgetId}/settings${userParam}`);
    if (res.ok) {
      const saved = await res.json();
      // การตั้งค่าจากฐานข้อมูลเซิร์ฟเวอร์จะมีความสำคัญกว่า URL Query Params แบบเดิม
      activeFields = { ...getUrlParams(), ...saved };
      if (isWidgetActive) {
        dispatchWidgetLoad(activeFields);
      }
      console.log('[Solocast Adapter] Synchronized saved settings from server:', activeFields);
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
  if (payload.userId && targetUser && payload.userId !== targetUser) return;

  console.log('[Solocast Adapter] ⚡ Live settings update received from Dashboard:', payload.settings);
  activeFields = { ...activeFields, ...payload.settings };
  if (isWidgetActive) {
    dispatchWidgetLoad(activeFields);
  }
});

// ฟัง Live Update สถานะเปิด/ปิด Widget ของ User จาก Dashboard แบบ Real-time
socket.on('user_widget_status_changed', (payload) => {
  if (!payload || payload.widgetId !== currentWidgetId) return;
  if (payload.userId && targetUser && String(payload.userId) !== String(targetUser)) return;
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
  if (payload.userId && targetUser && String(payload.userId) !== String(targetUser)) return;
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
  if (targetUser && event.userId && String(event.userId) !== String(targetUser)) {
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
        data: {
          name: uName,
          rewardTitle: rTitle,
          redemption: rTitle,
          title: rTitle,
          avatar: av,
          profileImage: av,
          profileImageUrl: av
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
  if (targetUser && data?.userId && String(data.userId) !== String(targetUser)) return;
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
  if (targetUser && data?.userId && String(data.userId) !== String(targetUser)) return;
  const seEvent = new CustomEvent('onEventReceived', {
    detail: {
      type: 'spotify_new_request',
      listener: 'spotify_new_request',
      data: data
    }
  });
  window.dispatchEvent(seEvent);
});

