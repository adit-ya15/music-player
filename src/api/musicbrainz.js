import { friendlyErrorMessage, logError } from '../utils/logger';

const MB_BASE = 'https://musicbrainz.org/ws/2';

function pickReleaseDate(releases = []) {
  const dates = (Array.isArray(releases) ? releases : [])
    .map((release) => String(release?.date || '').trim())
    .filter(Boolean)
    .sort();
  return dates[0] || '';
}

export const musicbrainzApi = {
  enrichTrackSafe: async ({ title, artist } = {}) => {
    const t = String(title || '').trim();
    const a = String(artist || '').trim();
    if (!t || !a) return { ok: false, data: null, error: 'Missing track title or artist.' };

    try {
      const query = `recording:${JSON.stringify(t)} AND artist:${JSON.stringify(a)}`;
      const searchUrl = `${MB_BASE}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=3`;
      const response = await fetch(searchUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'NullMusicPlayer/1.0 (open-source plugin runtime)'
        }
      });

      if (!response.ok) {
        return { ok: false, data: null, error: `MusicBrainz responded with ${response.status}` };
      }

      const payload = await response.json();
      const row = Array.isArray(payload?.recordings) ? payload.recordings[0] : null;
      if (!row) return { ok: false, data: null, error: 'No MusicBrainz match found.' };

      const release = Array.isArray(row.releases) ? row.releases[0] : null;
      const releaseId = String(release?.id || '').trim();
      const coverArt = releaseId ? `https://coverartarchive.org/release/${releaseId}/front-500` : '';

      return {
        ok: true,
        data: {
          source: 'musicbrainz',
          recordingMbid: String(row.id || '').trim() || null,
          releaseMbid: releaseId || null,
          artistCredit: (Array.isArray(row['artist-credit']) ? row['artist-credit'] : [])
            .map((item) => String(item?.name || '').trim())
            .filter(Boolean)
            .join(', ') || null,
          firstReleaseDate: pickReleaseDate(row.releases),
          coverArt: coverArt || null,
          canonicalTitle: String(row.title || '').trim() || null,
          canonicalLengthSec: Number(row.length || 0) > 0 ? Math.round(Number(row.length) / 1000) : null,
        },
        error: null,
      };
    } catch (error) {
      logError('musicbrainz.enrichTrackSafe', error, { title: t, artist: a });
      return { ok: false, data: null, error: friendlyErrorMessage(error, 'MusicBrainz is unavailable right now.') };
    }
  },
};
