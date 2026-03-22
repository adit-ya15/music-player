function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function dedupeSongs(candidates) {
  const unique = new Map();
  for (const song of candidates || []) {
    if (!song?.id) continue;
    if (!unique.has(song.id)) unique.set(song.id, song);
  }
  return Array.from(unique.values());
}

export function rankSongs({ candidates, profile, trendingSet }) {
  const topSongIds = new Set(profile?.topSongs || []);
  const recent = Array.isArray(profile?.recent) ? profile.recent : [];

  return (candidates || [])
    .map((song) => {
      let score = 0;

      // userPreferenceScore
      if (song?.id && topSongIds.has(song.id)) score += 5;

      // recencyScore (artist overlap)
      if (song?.artist && recent.some((s) => s?.artist && s.artist === song.artist)) score += 3;

      // popularityScore (in trending)
      if (song?.id && trendingSet?.has?.(song.id)) score += 2;

      // diversity (small jitter)
      score += clamp01(Math.random());

      return { ...song, score };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}
