import { friendlyErrorMessage, logError } from '../utils/logger';

const SPOTIFY_METADATA_ENDPOINT = String(import.meta?.env?.VITE_SPOTIFY_METADATA_ENDPOINT || '/api/plugins/spotify-metadata').trim();

export const spotifyMetadataApi = {
  isConfigured: () => Boolean(SPOTIFY_METADATA_ENDPOINT),

  enrichTrackSafe: async ({ title, artist } = {}) => {
    if (!SPOTIFY_METADATA_ENDPOINT) {
      return { ok: false, data: null, error: 'Spotify metadata endpoint is not configured.' };
    }

    try {
      const url = new URL(SPOTIFY_METADATA_ENDPOINT);
      url.searchParams.set('title', String(title || '').trim());
      url.searchParams.set('artist', String(artist || '').trim());

      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!response.ok) return { ok: false, data: null, error: `Spotify metadata responded with ${response.status}` };

      const payload = await response.json();
      return {
        ok: true,
        data: {
          source: 'spotify',
          trackId: payload?.trackId || null,
          album: payload?.album || null,
          releaseDate: payload?.releaseDate || null,
          popularity: Number(payload?.popularity || 0) || null,
          coverArt: payload?.coverArt || null,
          previewUrl: payload?.previewUrl || null,
        },
        error: null,
      };
    } catch (error) {
      logError('spotifyMetadata.enrichTrackSafe', error);
      return { ok: false, data: null, error: friendlyErrorMessage(error, 'Spotify metadata is unavailable right now.') };
    }
  },
};
