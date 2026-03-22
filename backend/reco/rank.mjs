function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeArtistKey(artist) {
  if (!artist) return '';
  const s = String(artist);
  // Common formats: "A, B", "A & B", "A x B". Use the first segment.
  const primary = s.split(/,|&|x/i)[0] || s;
  return primary.trim().toLowerCase();
}

// Deterministic pseudo-random jitter in [0, 1) from a string.
// Keeps results stable per user/song while still encouraging diversity.
function jitter01(seed) {
  const str = String(seed ?? '');
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Convert to unsigned and scale.
  return clamp01((h >>> 0) / 2 ** 32);
}

export function dedupeSongs(candidates) {
  const unique = new Map();
  for (const song of candidates || []) {
    if (!song?.id) continue;
    if (!unique.has(song.id)) unique.set(song.id, song);
  }
  return Array.from(unique.values());
}

export function limitPerArtist(songs, maxPerArtist = 2) {
  const limit = Math.max(1, Number(maxPerArtist) || 1);
  const counts = new Map();
  const out = [];

  for (const song of songs || []) {
    const key = normalizeArtistKey(song?.artist);
    if (!key) {
      out.push(song);
      continue;
    }

    const n = counts.get(key) || 0;
    if (n >= limit) continue;
    counts.set(key, n + 1);
    out.push(song);
  }

  return out;
}

export function scoreSong({ song, profile, trendingSet, userId }) {
  let score = 0;

  const topSongIds = new Set(profile?.topSongs || []);
  const recent = Array.isArray(profile?.recent) ? profile.recent : [];

  const topArtists = new Set((profile?.topArtists || []).map(normalizeArtistKey).filter(Boolean));
  const recentArtists = new Set((profile?.recentArtists || recent.map((s) => s?.artist)).map(normalizeArtistKey).filter(Boolean));

  const songArtistKey = normalizeArtistKey(song?.artist);

  // Strong preference signals
  if (song?.id && topSongIds.has(song.id)) score += 5;
  if (songArtistKey && topArtists.has(songArtistKey)) score += 4;
  if (songArtistKey && recentArtists.has(songArtistKey)) score += 3;

  // Popularity signal
  if (song?.id && trendingSet?.has?.(song.id)) score += 2;

  // Diversity jitter (deterministic)
  score += jitter01(`${userId || ''}:${song?.id || ''}`);

  return score;
}

export function rankSongs({ candidates, profile, trendingSet, userId, includeScore = false }) {
  const scored = (candidates || [])
    .map((song) => ({
      song,
      score: scoreSong({ song, profile, trendingSet, userId }),
    }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  if (includeScore) {
    return scored.map(({ song, score }) => ({ ...song, score }));
  }

  return scored.map(({ song }) => song);
}
