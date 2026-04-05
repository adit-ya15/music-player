import { validateStreamUrl } from '../api/endpointClient.js';

const DEFAULT_TIMEOUT_MS = 7000;
const DEFAULT_MAX_CANDIDATES = 24;

function splitCsv(value = '') {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(value = '') {
  return String(value || '').replace(/\/+$/, '');
}

function getApiBase() {
  const base = String(import.meta?.env?.VITE_API_BASE || '/api');
  return base.replace(/\/+$/, '');
}

function pickUrl(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') {
    return /^https?:\/\//i.test(payload.trim()) ? payload.trim() : '';
  }

  const candidate = [
    payload.streamUrl,
    payload.url,
    payload.directUrl,
    payload?.data?.streamUrl,
    payload?.data?.url,
    payload?.result?.url,
    payload?.result?.streamUrl,
  ].find((value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim()));

  return candidate ? candidate.trim() : '';
}

function buildCandidates(videoId, endpointsCsv, options = {}) {
  const envEndpoints = import.meta?.env?.VITE_YTDLP_ENDPOINTS || '';
  const configured = splitCsv(endpointsCsv || envEndpoints || '');
  if (!configured.length) {
    const fallbackPath = `${getApiBase()}/yt/stream/${encodeURIComponent(videoId)}`;
    const url = new URL(fallbackPath, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (options?.title) url.searchParams.set('title', String(options.title));
    if (options?.artist) url.searchParams.set('artist', String(options.artist));
    return [url.toString()];
  }

  const candidates = [];
  for (const endpoint of configured) {
    if (!endpoint) continue;

    if (endpoint.includes('{videoId}')) {
      candidates.push(endpoint.replaceAll('{videoId}', encodeURIComponent(videoId)));
      continue;
    }

    const base = normalizeBaseUrl(endpoint);
    if (!base) continue;
    candidates.push(base);
    candidates.push(`${base}/stream/${encodeURIComponent(videoId)}`);
    candidates.push(`${base}/api/stream/${encodeURIComponent(videoId)}`);
    candidates.push(`${base}/resolve/${encodeURIComponent(videoId)}`);
  }

  return [...new Set(candidates)].slice(0, DEFAULT_MAX_CANDIDATES);
}

async function fetchCandidate(endpointUrl, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const payload = await response.json();
      return pickUrl(payload);
    }

    const text = (await response.text()).trim();
    if (!text) return null;

    if (/^https?:\/\//i.test(text)) return text;

    try {
      return pickUrl(JSON.parse(text));
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveYtdlpEndpointStream(videoId, options = {}) {
  if (!videoId) return null;

  const candidates = buildCandidates(videoId, options.endpoints, options);
  if (!candidates.length) return null;

  const timeoutMs = Math.max(1500, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));

  for (const endpointUrl of candidates) {
    const streamUrl = await fetchCandidate(endpointUrl, timeoutMs);
    if (!streamUrl) continue;

    const valid = await validateStreamUrl(streamUrl, timeoutMs);
    if (!valid) continue;

    return {
      streamUrl,
      streamSource: 'yt-dlp',
      endpoint: endpointUrl,
      verified: true,
    };
  }

  return null;
}
