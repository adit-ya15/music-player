import { buildApiUrl } from './apiBase';
import { getStoredAuthSession } from '../utils/authSession';

export async function recordTrackPlaySafe({ track, completionRatio = 0, reason = 'unknown' } = {}) {
  const session = getStoredAuthSession();
  const token = session?.token ? String(session.token).trim() : '';
  const trackId = String(track?.id || '').trim();

  if (!token || !trackId) {
    return { ok: false, skipped: true };
  }

  try {
    const response = await fetch(buildApiUrl('/track/play'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        track: {
          id: trackId,
          title: track?.title || 'Unknown',
          artist: track?.artist || 'Unknown',
          features: track?.features || null,
        },
        completionRatio,
        reason,
      }),
    });

    if (!response.ok) {
      return { ok: false, skipped: false, status: response.status };
    }

    return { ok: true, skipped: false, status: response.status };
  } catch {
    return { ok: false, skipped: false };
  }
}
