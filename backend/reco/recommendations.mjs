import { withTimeout } from '../lib/withTimeout.mjs';
import { logger } from '../lib/logger.mjs';

import { getRecoStore } from './store.mjs';
import { searchYouTubeSongs } from './youtubeSearch.mjs';
import { dedupeSongs, limitPerArtist, rankSongs } from './rank.mjs';

const RECO_CACHE_TTL_SECONDS = Math.max(30, Number(process.env.RECO_CACHE_TTL_SECONDS || 300));
const RECO_TIMEOUT_MS = Math.max(500, Number(process.env.RECO_TIMEOUT_MS || 8000));
const RECO_LIMIT = Math.max(5, Number(process.env.RECO_LIMIT || 20));
const RECO_MAX_PER_ARTIST = Math.max(1, Number(process.env.RECO_MAX_PER_ARTIST || 2));
const RECO_SEARCH_PER_QUERY = Math.max(3, Number(process.env.RECO_SEARCH_PER_QUERY || 10));
const RECO_INCLUDE_SCORES = ['1', 'true', 'yes', 'on'].includes(String(process.env.RECO_INCLUDE_SCORES || '').toLowerCase());

function normalizeArtistKey(artist) {
  if (!artist) return '';
  const s = String(artist);
  const primary = s.split(/,|&|x/i)[0] || s;
  return primary.trim().toLowerCase();
}

function uniqueArtistList(songs, max = 6) {
  const out = [];
  const seen = new Set();
  for (const s of songs || []) {
    const key = normalizeArtistKey(s?.artist);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s.artist);
    if (out.length >= max) break;
  }
  return out;
}

function computeBucketTargets(limit) {
  const total = Math.max(1, Number(limit) || 1);
  const same = Math.floor(total * 0.4);
  const recent = Math.floor(total * 0.3);
  const trending = total - same - recent;
  return { same, recent, trending };
}

function mixBuckets({ sameArtist, recent, trending }, limit, maxPerArtist) {
  const targets = computeBucketTargets(limit);
  const pickedIds = new Set();
  const artistCounts = new Map();
  const out = [];

  function canTake(song) {
    if (!song?.id) return false;
    if (pickedIds.has(song.id)) return false;
    const key = normalizeArtistKey(song.artist);
    if (!key) return true;
    const n = artistCounts.get(key) || 0;
    return n < maxPerArtist;
  }

  function take(song) {
    out.push(song);
    pickedIds.add(song.id);
    const key = normalizeArtistKey(song.artist);
    if (key) artistCounts.set(key, (artistCounts.get(key) || 0) + 1);
  }

  const buckets = [
    { name: 'same', target: targets.same, list: sameArtist },
    { name: 'recent', target: targets.recent, list: recent },
    { name: 'trending', target: targets.trending, list: trending },
  ];

  // First pass: satisfy targets in order (stable).
  for (const bucket of buckets) {
    let count = 0;
    for (const song of bucket.list || []) {
      if (out.length >= limit) break;
      if (count >= bucket.target) break;
      if (!canTake(song)) continue;
      take(song);
      count += 1;
    }
  }

  // Second pass: fill any remaining slots from all buckets.
  if (out.length < limit) {
    for (const bucket of buckets) {
      for (const song of bucket.list || []) {
        if (out.length >= limit) break;
        if (!canTake(song)) continue;
        take(song);
      }
    }
  }

  return out;
}

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
    store.getTopSongs(userId, 12),
    store.getRecent(userId, 20),
  ]);

  // Hydrate top songs to derive strong artist preferences.
  const topMetas = [];
  for (const id of topSongs || []) {
    const meta = await store.getSongMeta(id);
    if (meta) topMetas.push(meta);
  }

  const topArtists = uniqueArtistList(topMetas, 6);
  const recentArtists = uniqueArtistList(recent, 8);

  return { topSongs, recent, topArtists, recentArtists };
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

  // Global trending signal (from tracked plays)
  const trendingIds = await store.getTrending(RECO_LIMIT);
  const trendingSet = new Set(trendingIds);
  let trendingSongs = await hydrateSongsById(trendingIds);

  // Cold-start fallback when there is no global trending data yet.
  if ((!trendingSongs || trendingSongs.length === 0) && innertube) {
    trendingSongs = await withTimeout(
      searchYouTubeSongs(innertube, 'trending songs', RECO_LIMIT),
      RECO_TIMEOUT_MS
    ).catch(() => []);
  }

  trendingSongs = limitPerArtist(trendingSongs, RECO_MAX_PER_ARTIST).slice(0, RECO_LIMIT);

  const hasHistory = Boolean(profile.topSongs?.length || profile.recent?.length);
  if (!hasHistory || !innertube) {
    const payload = {
      madeForYou: [],
      basedOnRecent: [],
      trending: trendingSongs,
    };

    const ttl = RECO_CACHE_TTL_SECONDS + Math.floor(Math.random() * 60);
    await cache.set(cacheKey, payload, ttl);
    return payload;
  }

  // Source balancing buckets
  const sameArtistArtists = (profile.topArtists || []).filter(Boolean).slice(0, 3);
  const recentArtists = (profile.recentArtists || []).filter(Boolean).slice(0, 4);
  const recentArtistKeySet = new Set(recentArtists.map(normalizeArtistKey).filter(Boolean));
  const trendingArtists = uniqueArtistList(trendingSongs, 3);

  const sameArtistQueries = sameArtistArtists.flatMap((artist) => [
    `${artist} songs`,
    `${artist} hits`,
  ]);

  const recentQueries = recentArtists.flatMap((artist) => [
    `${artist} similar songs`,
  ]);

  const trendingQueries = [
    ...trendingArtists.map((artist) => `${artist} top hits`),
    'top hits',
    'viral songs',
  ];

  const [sameChunks, recentChunks, trendingChunks] = await withTimeout(
    Promise.all([
      Promise.all(sameArtistQueries.map((q) => searchYouTubeSongs(innertube, q, RECO_SEARCH_PER_QUERY))),
      Promise.all(recentQueries.map((q) => searchYouTubeSongs(innertube, q, RECO_SEARCH_PER_QUERY))),
      Promise.all(trendingQueries.map((q) => searchYouTubeSongs(innertube, q, Math.max(6, Math.floor(RECO_SEARCH_PER_QUERY / 2))))),
    ]),
    RECO_TIMEOUT_MS
  ).catch((err) => {
    logger.warn('reco', 'candidate generation timed out', { userId, error: err?.message });
    return [[], [], []];
  });

  const sameCandidates = dedupeSongs((sameChunks || []).flat());
  const recentCandidates = dedupeSongs((recentChunks || []).flat());
  const trendingCandidates = dedupeSongs((trendingChunks || []).flat());

  const basedOnRecent = limitPerArtist(
    rankSongs({
      candidates: dedupeSongs([...recentCandidates, ...sameCandidates]),
      profile,
      trendingSet,
      userId,
      includeScore: RECO_INCLUDE_SCORES,
    }).filter((song) => {
      const key = normalizeArtistKey(song?.artist);
      return key && recentArtistKeySet.has(key);
    }),
    RECO_MAX_PER_ARTIST
  ).slice(0, RECO_LIMIT);

  const madeForYouScored = mixBuckets(
    {
      sameArtist: rankSongs({ candidates: sameCandidates, profile, trendingSet, userId, includeScore: RECO_INCLUDE_SCORES }),
      recent: rankSongs({ candidates: recentCandidates, profile, trendingSet, userId, includeScore: RECO_INCLUDE_SCORES }),
      trending: rankSongs({ candidates: trendingCandidates, profile, trendingSet, userId, includeScore: RECO_INCLUDE_SCORES }),
    },
    RECO_LIMIT,
    RECO_MAX_PER_ARTIST
  );

  const payload = {
    madeForYou: madeForYouScored,
    basedOnRecent,
    trending: trendingSongs,
  };

  const ttl = RECO_CACHE_TTL_SECONDS + Math.floor(Math.random() * 60);
  await cache.set(cacheKey, payload, ttl);
  return payload;
}
