import { withTimeout } from '../lib/withTimeout.mjs';
import { logger } from '../lib/logger.mjs';

import { getRecoStore } from './store.mjs';
import { searchYouTubeSongs } from './youtubeSearch.mjs';
import { dedupeSongs, rankSongs } from './rank.mjs';

const RECO_CACHE_TTL_SECONDS = Math.max(30, Number(process.env.RECO_CACHE_TTL_SECONDS || 300));
const RECO_TIMEOUT_MS = Math.max(500, Number(process.env.RECO_TIMEOUT_MS || 8000));

function recommendCacheKey(userId) {
  return `recommend:${userId}`;
}

export async function trackUserAction({ userId, song, action }) {
  if (!userId || !action) return;
  if (action !== 'play') return;

  const store = await getRecoStore();
  await store.trackPlay({ userId, song });
}

export async function getUserProfile(userId) {
  const store = await getRecoStore();
  const [topSongs, recent] = await Promise.all([
    store.getTopSongs(userId, 10),
    store.getRecent(userId, 10),
  ]);

  return { topSongs, recent };
}

async function hydrateSongsById(ids) {
  const store = await getRecoStore();
  const out = [];
  for (const id of ids || []) {
    const meta = await store.getSongMeta(id);
    if (meta) out.push(meta);
  }
  return out;
}

export async function getRecommendations({ userId, innertube, cache }) {
  if (!userId) throw new Error('userId required');

  const cacheKey = recommendCacheKey(userId);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const store = await getRecoStore();
  const profile = await getUserProfile(userId);

  // Cold start → trending
  const trendingIds = await store.getTrending(20);
  const trendingSongs = await hydrateSongsById(trendingIds);

  if ((!profile.topSongs?.length && !profile.recent?.length) || !innertube) {
    const payload = {
      madeForYou: [],
      basedOnRecent: [],
      trending: trendingSongs,
    };

    const ttl = RECO_CACHE_TTL_SECONDS + Math.floor(Math.random() * 60);
    await cache.set(cacheKey, payload, ttl);
    return payload;
  }

  const trendingSet = new Set(trendingIds);

  // Candidate generation from recent plays (artist-based)
  const recentArtists = Array.from(
    new Set((profile.recent || []).map((s) => s?.artist).filter(Boolean))
  ).slice(0, 4);

  const candidateQueries = recentArtists.flatMap((artist) => [
    `${artist} songs`,
    `${artist} similar songs`,
  ]);

  const candidateChunks = await withTimeout(
    Promise.all(candidateQueries.map((q) => searchYouTubeSongs(innertube, q, 8))),
    RECO_TIMEOUT_MS
  ).catch((err) => {
    logger.warn('reco', 'candidate generation timed out', { userId, error: err?.message });
    return [];
  });

  const candidates = dedupeSongs(candidateChunks.flat());

  // Ranking
  const ranked = rankSongs({ candidates, profile, trendingSet });

  const madeForYou = ranked.slice(0, 20);
  const basedOnRecent = ranked
    .filter((song) => recentArtists.includes(song.artist))
    .slice(0, 20);

  const payload = {
    madeForYou,
    basedOnRecent,
    trending: trendingSongs,
  };

  const ttl = RECO_CACHE_TTL_SECONDS + Math.floor(Math.random() * 60);
  await cache.set(cacheKey, payload, ttl);
  return payload;
}
