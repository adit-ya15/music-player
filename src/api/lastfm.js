import { friendlyErrorMessage, logError } from '../utils/logger';

const LASTFM_PROXY_ENDPOINT = String(import.meta?.env?.VITE_LASTFM_PROXY_ENDPOINT || '/api/plugins/lastfm').trim();

async function send(method, payload) {
  if (!LASTFM_PROXY_ENDPOINT) {
    return { ok: false, error: 'Last.fm proxy endpoint is not configured.' };
  }

  try {
    const response = await fetch(LASTFM_PROXY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ method, ...payload }),
    });

    if (!response.ok) {
      return { ok: false, error: `Last.fm proxy responded with ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    return { ok: true, data, error: null };
  } catch (error) {
    logError('lastfm.send', error, { method });
    return { ok: false, error: friendlyErrorMessage(error, 'Last.fm proxy is unavailable right now.') };
  }
}

export const lastfmApi = {
  isConfigured: () => Boolean(LASTFM_PROXY_ENDPOINT),

  sendNowPlayingSafe: async ({ track, artist, album, durationSec } = {}) => {
    return send('track.updateNowPlaying', { track, artist, album, durationSec });
  },

  scrobbleSafe: async ({ track, artist, album, timestamp } = {}) => {
    return send('track.scrobble', { track, artist, album, timestamp });
  },
};
