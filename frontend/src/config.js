// Centralized API and WebSocket Base URLs
// In development, defaults to backend on http://localhost:3000
// In production, uses window.location.origin (if hosted together) or VITE_API_BASE_URL / VITE_WS_BASE_URL env vars
export const API_BASE = import.meta.env.VITE_API_BASE_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin
);

export const WS_BASE = import.meta.env.VITE_WS_BASE_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin
);
