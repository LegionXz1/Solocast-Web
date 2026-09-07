// Solocast Adapter - StreamElements Compatible Bridge & Real-Time Sync

const socket = io('/');

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

// เก็บ Fields ปัจจุบัน
let activeFields = { ...getUrlParams() };

// ฟังก์ชันส่งอีเวนต์ onWidgetLoad และ onFieldsUpdate ไปยัง Custom Widget
function dispatchWidgetLoad(fieldsToApply) {
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
      activeFields = { ...saved, ...getUrlParams() };
      dispatchWidgetLoad(activeFields);
      console.log('[Solocast Adapter] Synchronized saved settings from server:', activeFields);
    }
  } catch (err) {
    console.warn('[Solocast Adapter] Could not fetch saved settings:', err);
  }
}

// ยิง onWidgetLoad ทันที และซิงค์การตั้งค่าจากเซิร์ฟเวอร์
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    dispatchWidgetLoad(activeFields);
    syncSavedSettings();
  });
} else {
  setTimeout(() => {
    dispatchWidgetLoad(activeFields);
    syncSavedSettings();
  }, 50);
}

// ฟัง Live Update จาก Dashboard แบบ Real-time ทันทีที่ผู้ใช้กดบันทึกหรือเปลี่ยนค่า
socket.on('widget_settings_updated', (payload) => {
  if (!payload || payload.widgetId !== currentWidgetId) return;
  if (payload.userId && targetUser && payload.userId !== targetUser) return;

  console.log('[Solocast Adapter] ⚡ Live settings update received from Dashboard:', payload.settings);
  activeFields = { ...activeFields, ...payload.settings, ...getUrlParams() };
  dispatchWidgetLoad(activeFields);
});

// รองรับการยิงซ้ำหากได้รับสถานะเชื่อมต่อ
socket.on('backend_status', (status) => {
  if (status && status.connected) {
    dispatchWidgetLoad(activeFields);
  }
});

// จำลอง Event 'onEventReceived' ของ StreamElements
socket.on('onEventReceived', (event) => {
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

    seEventDetail = {
      listener: 'redemption-latest',
      event: {
        type: 'redemption',
        rewardTitle: rTitle,
        redemption: rTitle,
        title: rTitle,
        name: uName,
        username: uName,
        displayName: uName,
        data: {
          name: uName,
          rewardTitle: rTitle,
          redemption: rTitle,
          title: rTitle
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
