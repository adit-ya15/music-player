import { friendlyErrorMessage, logError } from '../utils/logger';

const LISTENBRAINZ_BASE = String(import.meta?.env?.VITE_LISTENBRAINZ_API_BASE || 'https://api.listenbrainz.org').replace(/\/+$/, '');

function normalizeRecording(item = {}) {
  const title = String(item?.recording_name || item?.track_name || '').trim();
  const artist = String(item?.artist_name || '').trim();
  const release = String(item?.release_name || '').trim();
  const msid = String(item?.recording_msid || item?.recording_mbid || '').trim();
  return {
    id: msid ? `lb-${msid}` : `lb-${(title || 'track').toLowerCase().replace(/\s+/g, '-')}`,
    originalId: msid || '',
    title: title || 'Unknown Title',
    artist: artist || 'Unknown Artist',
    album: release || '',
    coverArt: '',
    streamUrl: null,
    duration: 0,
    source: 'listenbrainz',
  };
}

async function fetchRows(path) {
  const response = await fetch(`${LISTENBRAINZ_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`ListenBrainz responded with ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload?.payload?.recordings)
    ? payload.payload.recordings
    : Array.isArray(payload?.payload?.artists)
      ? payload.payload.artists
      : [];
  return rows;
}

export const listenbrainzDashboardApi = {
  getSectionsSafe: async () => {
    try {
      const [recordings] = await Promise.all([
        fetchRows('/1/stats/sitewide/recordings?count=20'),
      ]);

      return {
        ok: true,
        data: [
          {
            id: 'listenbrainz-recordings',
            title: 'ListenBrainz Top Recordings',
            tracks: recordings.map(normalizeRecording),
          },
        ],
        error: null,
      };
    } catch (error) {
      logError('listenbrainzDashboard.getSectionsSafe', error);
      return {
        ok: false,
        data: [],
        error: friendlyErrorMessage(error, 'ListenBrainz dashboard is unavailable right now.'),
      };
    }
  },
};
