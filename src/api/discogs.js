import { friendlyErrorMessage, logError } from '../utils/logger';

const DISCOGS_BASE = 'https://api.discogs.com';
const DISCOGS_TOKEN = String(import.meta?.env?.VITE_DISCOGS_TOKEN || '').trim();

export const discogsApi = {
  isConfigured: () => Boolean(DISCOGS_TOKEN),

  enrichTrackSafe: async ({ title, artist } = {}) => {
    const t = String(title || '').trim();
    const a = String(artist || '').trim();
    if (!t || !a) return { ok: false, data: null, error: 'Missing track title or artist.' };
    if (!DISCOGS_TOKEN) {
      return { ok: false, data: null, error: 'Discogs token is not configured.' };
    }

    try {
      const url = new URL(`${DISCOGS_BASE}/database/search`);
      url.searchParams.set('q', `${a} ${t}`);
      url.searchParams.set('type', 'release');
      url.searchParams.set('per_page', '1');
      url.searchParams.set('token', DISCOGS_TOKEN);

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'NullMusicPlayer/1.0'
        }
      });

      if (!response.ok) {
        return { ok: false, data: null, error: `Discogs responded with ${response.status}` };
      }

      const payload = await response.json();
      const result = Array.isArray(payload?.results) ? payload.results[0] : null;
      if (!result) return { ok: false, data: null, error: 'No Discogs match found.' };

      return {
        ok: true,
        data: {
          source: 'discogs',
          releaseId: result.id || null,
          resourceUrl: result.resource_url || null,
          year: Number(result.year || 0) || null,
          genre: Array.isArray(result.genre) ? result.genre.join(', ') : null,
          style: Array.isArray(result.style) ? result.style.join(', ') : null,
          coverArt: String(result.cover_image || '').trim() || null,
          title: String(result.title || '').trim() || null,
          label: Array.isArray(result.label) ? result.label.join(', ') : null,
        },
        error: null,
      };
    } catch (error) {
      logError('discogs.enrichTrackSafe', error, { title: t, artist: a });
      return { ok: false, data: null, error: friendlyErrorMessage(error, 'Discogs is unavailable right now.') };
    }
  },
};
