import { friendlyErrorMessage, logError } from '../utils/logger';
import { validateStreamUrl } from './endpointClient';

const SOUNDCLOUD_API_BASE = String(import.meta?.env?.VITE_SOUNDCLOUD_API_BASE || 'https://api-v2.soundcloud.com').replace(/\/+$/, '');
const SOUNDCLOUD_CLIENT_ID = String(import.meta?.env?.VITE_SOUNDCLOUD_CLIENT_ID || '').trim();

function normalizeArtwork(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return raw
    .replace('-large.jpg', '-t500x500.jpg')
    .replace('-large.png', '-t500x500.png');
}

function normalizeTrack(track = {}) {
  const id = String(track.id || '').trim();
  const title = String(track.title || 'Unknown Title').trim();
  const artist = String(track.user?.username || track.publisher_metadata?.artist || 'Unknown Artist').trim();
  const coverArt = normalizeArtwork(track.artwork_url || track.user?.avatar_url || '');
  const duration = Math.max(0, Math.round(Number(track.duration || 0) / 1000));

  return {
    id: id ? `sc-${id}` : `sc-${title.replace(/\s+/g, '-').toLowerCase()}`,
    originalId: id,
    title,
    artist,
    album: '',
    coverArt,
    duration,
    source: 'soundcloud',
    streamUrl: null,
    permalinkUrl: String(track.permalink_url || '').trim() || null,
    transcodings: Array.isArray(track?.media?.transcodings) ? track.media.transcodings : [],
  };
}

function parseTrackId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/^sc-/, '');
}

async function soundcloudRequest(path, params = {}) {
  if (!SOUNDCLOUD_CLIENT_ID) {
    return {
      ok: false,
      data: null,
      error: 'SoundCloud is not configured. Set VITE_SOUNDCLOUD_CLIENT_ID.',
    };
  }

  try {
    const url = new URL(`${SOUNDCLOUD_API_BASE}${path}`);
    url.searchParams.set('client_id', SOUNDCLOUD_CLIENT_ID);
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === '') return;
      url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        data: null,
        error: `SoundCloud responded with ${response.status}`,
      };
    }

    return {
      ok: true,
      data: await response.json(),
      error: null,
    };
  } catch (error) {
    logError('soundcloud.request', error, { path, base: SOUNDCLOUD_API_BASE });
    return {
      ok: false,
      data: null,
      error: friendlyErrorMessage(error, 'SoundCloud is unavailable right now.'),
    };
  }
}

function pickBestTranscoding(transcodings = []) {
  const rows = Array.isArray(transcodings) ? transcodings : [];
  return (
    rows.find((item) => String(item?.format?.protocol || '').toLowerCase() === 'progressive')
    || rows.find((item) => String(item?.format?.protocol || '').toLowerCase() === 'hls')
    || rows[0]
    || null
  );
}

async function resolveFromTranscoding(transcoding) {
  const url = String(transcoding?.url || '').trim();
  if (!url || !SOUNDCLOUD_CLIENT_ID) return null;

  const response = await fetch(`${url}?client_id=${encodeURIComponent(SOUNDCLOUD_CLIENT_ID)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
    },
  });

  if (!response.ok) return null;
  const payload = await response.json();
  const streamUrl = String(payload?.url || '').trim();
  if (!streamUrl) return null;

  const valid = await validateStreamUrl(streamUrl);
  if (!valid) return null;

  return {
    streamUrl,
    streamSource: 'soundcloud',
    verified: true,
    protocol: String(transcoding?.format?.protocol || '').toLowerCase() || null,
  };
}

export const soundcloudApi = {
  searchSongsSafe: async (query, limit = 20) => {
    const result = await soundcloudRequest('/search/tracks', {
      q: query,
      limit,
      offset: 0,
      linked_partitioning: 1,
    });

    if (!result.ok) {
      return { ok: false, data: [], error: result.error };
    }

    const rows = Array.isArray(result.data?.collection) ? result.data.collection : [];
    return {
      ok: true,
      data: rows.map(normalizeTrack),
      error: null,
    };
  },

  resolveStreamSafe: async ({ trackId, transcodings = [] } = {}) => {
    if (!SOUNDCLOUD_CLIENT_ID) {
      return { ok: false, data: null, error: 'SoundCloud is not configured.' };
    }

    const id = parseTrackId(trackId);

    let resolvedTranscodings = Array.isArray(transcodings) && transcodings.length
      ? transcodings
      : [];

    if (!resolvedTranscodings.length && id) {
      const trackRes = await soundcloudRequest(`/tracks/${encodeURIComponent(id)}`);
      if (trackRes.ok) {
        resolvedTranscodings = Array.isArray(trackRes.data?.media?.transcodings)
          ? trackRes.data.media.transcodings
          : [];
      }
    }

    const first = pickBestTranscoding(resolvedTranscodings);
    if (!first) {
      return { ok: false, data: null, error: 'SoundCloud stream unavailable.' };
    }

    const resolved = await resolveFromTranscoding(first);
    if (!resolved?.streamUrl) {
      return { ok: false, data: null, error: 'SoundCloud stream unavailable.' };
    }

    return { ok: true, data: resolved, error: null };
  },
};
