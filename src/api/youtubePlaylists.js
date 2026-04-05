import { friendlyErrorMessage, logError } from '../utils/logger';
import { buildApiUrl, isAbsoluteUrl } from './apiBase';

const YT_PLAYLIST_IMPORT_ENDPOINT = String(import.meta?.env?.VITE_YOUTUBE_PLAYLIST_IMPORT_ENDPOINT || '/api/plugins/youtube-playlist').trim();

function resolvePlaylistImportEndpoint() {
  if (!YT_PLAYLIST_IMPORT_ENDPOINT) return '';
  if (isAbsoluteUrl(YT_PLAYLIST_IMPORT_ENDPOINT)) return YT_PLAYLIST_IMPORT_ENDPOINT;

  // `buildApiUrl` already includes `/api` when API_BASE uses that path.
  // Prevent accidental `/api/api/...` duplication.
  const normalizedPath = String(YT_PLAYLIST_IMPORT_ENDPOINT)
    .replace(/^\/api(?=\/|$)/i, '')
    .trim();

  return buildApiUrl(normalizedPath || '/plugins/youtube-playlist');
}

function buildPlaylistImportEndpoints() {
  const primary = resolvePlaylistImportEndpoint();
  const fallback = buildApiUrl('/plugins/youtube-playlist');

  const endpoints = [primary, fallback]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return [...new Set(endpoints)];
}

async function requestPlaylistImport(playlistId) {
  const endpoints = buildPlaylistImportEndpoints();
  if (!endpoints.length) {
    return { ok: false, data: null, error: 'YouTube playlist import endpoint is not configured.' };
  }

  let lastError = '';

  for (const endpointRoot of endpoints) {
    try {
      const endpoint = new URL(endpointRoot);
      endpoint.searchParams.set('list', playlistId);

      const response = await fetch(endpoint.toString(), {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        lastError = `Playlist importer responded with ${response.status}`;
        // Retry other configured endpoints for transient server failures.
        if (response.status >= 500) continue;
        return { ok: false, data: null, error: lastError };
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        lastError = 'Playlist importer returned non-JSON response. Check API base URL and server route.';
        continue;
      }

      const payload = await response.json();
      return { ok: true, data: payload, error: null };
    } catch (error) {
      lastError = error?.message || 'Playlist importer request failed.';
    }
  }

  return { ok: false, data: null, error: lastError || 'Playlist importer is unavailable right now.' };
}

function normalizePlaylistInput(value = '') {
  return String(value || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function extractYoutubePlaylistId(value = '') {
  const text = normalizePlaylistInput(value);
  if (!text) return '';

  const decoded = (() => {
    try {
      return decodeURIComponent(text);
    } catch {
      return text;
    }
  })();

  const match = decoded.match(/(?:[?&]list=|\blist=)([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];

  try {
    const parsed = new URL(decoded.startsWith('http') ? decoded : `https://www.youtube.com/playlist?list=${decoded}`);
    const id = String(parsed.searchParams.get('list') || '').trim();
    if (id) return id;
  } catch {
    // Ignore URL parse failures and continue with raw-id checks.
  }

  if (/^[a-zA-Z0-9_-]{10,}$/.test(text)) return text;
  return '';
}

export const youtubePlaylistsApi = {
  isConfigured: () => Boolean(YT_PLAYLIST_IMPORT_ENDPOINT),

  importByUrlSafe: async (urlOrId) => {
    if (!YT_PLAYLIST_IMPORT_ENDPOINT) {
      return { ok: false, data: [], error: 'YouTube playlist import endpoint is not configured.' };
    }

    const playlistId = extractYoutubePlaylistId(urlOrId);
    if (!playlistId) {
      return { ok: false, data: [], error: 'Invalid YouTube playlist URL or ID.' };
    }

    try {
      const result = await requestPlaylistImport(playlistId);
      if (!result.ok) {
        return { ok: false, data: [], error: result.error || 'YouTube playlist import is unavailable right now.' };
      }

      const payload = result.data || {};
      const entries = Array.isArray(payload?.entries) ? payload.entries : Array.isArray(payload) ? payload : [];
      return {
        ok: true,
        data: entries,
        error: null,
      };
    } catch (error) {
      logError('youtubePlaylists.importByUrlSafe', error);
      return { ok: false, data: [], error: friendlyErrorMessage(error, 'YouTube playlist import is unavailable right now.') };
    }
  },
};
