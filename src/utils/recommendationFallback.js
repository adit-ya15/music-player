const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'by',
  'feat',
  'featuring',
  'from',
  'in',
  'live',
  'mix',
  'movie',
  'of',
  'official',
  'song',
  'the',
  'video',
  'with',
]);

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value) =>
  normalizeText(value)
    .split(' ')
    .filter((token) => token && token.length > 1 && !STOP_WORDS.has(token));

const sameArtist = (left, right) => normalizeText(left) === normalizeText(right);

export const dedupeTracks = (tracks = []) => {
  const seen = new Set();
  const output = [];

  for (const track of tracks) {
    if (!track?.id || seen.has(track.id)) continue;
    seen.add(track.id);
    output.push(track);
  }

  return output;
};

const similarityScore = (seedTrack, candidate, index = 0) => {
  if (!seedTrack || !candidate) return 0;

  let score = 0;

  if (sameArtist(seedTrack.artist, candidate.artist)) score += 8;
  if (normalizeText(seedTrack.album) && normalizeText(seedTrack.album) === normalizeText(candidate.album)) {
    score += 3;
  }

  const seedTokens = new Set([
    ...tokenize(seedTrack.title),
    ...tokenize(seedTrack.artist),
    ...tokenize(seedTrack.album),
  ]);
  const candidateTokens = [
    ...tokenize(candidate.title),
    ...tokenize(candidate.artist),
    ...tokenize(candidate.album),
  ];

  for (const token of candidateTokens) {
    if (seedTokens.has(token)) score += 2;
  }

  // Prefer recent local listens when scores are otherwise close.
  score += Math.max(0, 4 - Math.floor(index / 4));
  return score;
};

export const buildLocalRecommendations = ({
  seedTrack,
  history = [],
  favorites = [],
  limit = 20,
  excludeIds = [],
} = {}) => {
  const pool = dedupeTracks([...history, ...favorites]);
  const excluded = new Set([seedTrack?.id, ...excludeIds].filter(Boolean));

  const ranked = pool
    .filter((track) => track?.id && !excluded.has(track.id))
    .map((track, index) => ({
      track,
      score: similarityScore(seedTrack, track, index),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ track }) => track);

  if (ranked.length >= limit) {
    return ranked.slice(0, limit);
  }

  const seen = new Set(ranked.map((track) => track.id));
  for (const track of pool) {
    if (!track?.id || excluded.has(track.id) || seen.has(track.id)) continue;
    ranked.push(track);
    seen.add(track.id);
    if (ranked.length >= limit) break;
  }

  return ranked;
};

const parseStoredTracks = (rawValue) => {
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

export const loadStoredTrackCollections = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { history: [], favorites: [] };
  }

  return {
    history: parseStoredTracks(window.localStorage.getItem('aura-history')),
    favorites: parseStoredTracks(window.localStorage.getItem('aura-favorites')),
  };
};
