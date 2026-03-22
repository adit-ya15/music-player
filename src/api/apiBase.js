// Base URL for API calls.
//
// - Default: same-origin `/api` (works in dev with Vite proxy and in prod when served by server.mjs)
// - Override at build-time with: VITE_API_BASE=https://example.com/api
export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
