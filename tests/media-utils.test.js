import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLocalRecommendations, dedupeTracks } from '../src/utils/recommendationFallback.js';
import { getActiveLyricIndex, parseSyncedLyrics } from '../src/utils/lyrics.js';

const history = [
  { id: '1', title: 'Saiyaara', artist: 'Faheem Abdullah', album: 'Saiyaara', source: 'youtube' },
  { id: '2', title: 'Saiyaara Reprise', artist: 'Faheem Abdullah', album: 'Saiyaara', source: 'downloaded' },
  { id: '3', title: 'Hotel California', artist: 'Eagles', album: 'Hotel California', source: 'youtube' },
];

test('buildLocalRecommendations prioritizes tracks that match the current artist/title tokens', () => {
  const recs = buildLocalRecommendations({
    seedTrack: { id: 'seed', title: 'Saiyaara', artist: 'Faheem Abdullah', album: 'Saiyaara' },
    history,
    favorites: [{ id: '4', title: 'Another Saiyaara', artist: 'Faheem Abdullah', source: 'youtube' }],
    limit: 3,
  });

  assert.equal(recs[0].artist, 'Faheem Abdullah');
  assert.equal(recs.length, 3);
});

test('dedupeTracks keeps the first occurrence of each track id', () => {
  const deduped = dedupeTracks([history[0], history[1], history[0]]);
  assert.deepEqual(deduped.map((track) => track.id), ['1', '2']);
});

test('parseSyncedLyrics extracts ordered time-coded lines and active line lookup follows progress', () => {
  const lines = parseSyncedLyrics('[00:01.00]First\n[00:03.50]Second\n[00:07.00]Third');
  assert.equal(lines.length, 3);
  assert.equal(lines[1].text, 'Second');
  assert.equal(getActiveLyricIndex(lines, 0.5), -1);
  assert.equal(getActiveLyricIndex(lines, 1.2), 0);
  assert.equal(getActiveLyricIndex(lines, 4.0), 1);
});
