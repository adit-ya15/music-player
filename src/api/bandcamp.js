import { friendlyErrorMessage, logError } from '../utils/logger';

const BANDCAMP_SEARCH_ENDPOINT = String(import.meta?.env?.VITE_BANDCAMP_SEARCH_ENDPOINT || '').trim();

function normalizeTrack(item = {}) {
  const id = String(item.id || item.trackId || item.slug || '').trim();
  const title = String(item.title || 'Unknown Title').trim();
  const artist = String(item.artist || item.artistName || 'Unknown Artist').trim();
  const streamUrl = String(item.streamUrl || item.url || '').trim();

  return {
    id: id ? `bc-${id}` : `bc-${title.toLowerCase().replace(/\s+/g, '-')}`,
    originalId: id,
    title,
    artist,
    album: String(item.album || '').trim(),
    coverArt: String(item.coverArt || item.cover || '').trim() || null,
    duration: Number(item.duration || 0) || 0,
    source: 'bandcamp',
    streamUrl: streamUrl || null,
  };
}

export const bandcampApi = {
  isConfigured: () => Boolean(BANDCAMP_SEARCH_ENDPOINT),

  searchSongsSafe: async (query, limit = 12) => {
    if (!BANDCAMP_SEARCH_ENDPOINT) {
      return { ok: false, data: [], error: 'Bandcamp endpoint is not configured.' };
    }

    try {
      const url = new URL(BANDCAMP_SEARCH_ENDPOINT);
      url.searchParams.set('q', String(query || '').trim());
      url.searchParams.set('limit', String(limit || 12));

      const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        return { ok: false, data: [], error: `Bandcamp endpoint responded with ${response.status}` };
      }

      const payload = await response.json();
      const rows = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      const normalized = rows.map(normalizeTrack).filter((track) => track.title && track.artist);
      return { ok: true, data: normalized, error: null };
    } catch (error) {
      logError('bandcamp.searchSongsSafe', error);
      return { ok: false, data: [], error: friendlyErrorMessage(error, 'Bandcamp search is unavailable right now.') };
    }
  },
};
