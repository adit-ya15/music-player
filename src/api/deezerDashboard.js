import { friendlyErrorMessage, logError } from '../utils/logger';

const DEEZER_BASE = String(import.meta?.env?.VITE_DEEZER_API_BASE || 'https://api.deezer.com').replace(/\/+$/, '');

function normalizeTrack(item = {}) {
  const id = String(item.id || '').trim();
  return {
    id: id ? `dz-${id}` : `dz-${String(item.title || '').toLowerCase().replace(/\s+/g, '-')}`,
    originalId: id,
    title: String(item.title || 'Unknown Title').trim(),
    artist: String(item.artist?.name || 'Unknown Artist').trim(),
    album: String(item.album?.title || '').trim(),
    coverArt: String(item.album?.cover_xl || item.album?.cover_big || '').trim(),
    streamUrl: null,
    duration: Number(item.duration || 0),
    source: 'deezer',
  };
}

async function fetchSection(path) {
  const url = `${DEEZER_BASE}${path}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Deezer responded with ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map(normalizeTrack).filter((track) => track.title && track.artist);
}

export const deezerDashboardApi = {
  getSectionsSafe: async () => {
    try {
      const [chartTracks, newReleases] = await Promise.all([
        fetchSection('/chart/0/tracks?limit=15'),
        fetchSection('/editorial/0/releases?limit=15'),
      ]);

      return {
        ok: true,
        data: [
          { id: 'deezer-chart', title: 'Deezer Charts', tracks: chartTracks },
          { id: 'deezer-releases', title: 'Deezer New Releases', tracks: newReleases },
        ].filter((section) => section.tracks.length > 0),
        error: null,
      };
    } catch (error) {
      logError('deezerDashboard.getSectionsSafe', error);
      return { ok: false, data: [], error: friendlyErrorMessage(error, 'Deezer dashboard is unavailable right now.') };
    }
  },
};
