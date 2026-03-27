import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { findCachedFilePath, getCacheStatus } from '../backend/cache/audioCache.mjs';

test('findCachedFilePath picks a completed cached file and ignores partial artifacts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-cache-'));

  fs.writeFileSync(path.join(dir, 'abc123.partial.webm'), 'partial');
  fs.writeFileSync(path.join(dir, 'abc123.webm'), 'cached-audio');

  const cachedPath = findCachedFilePath('abc123', dir);
  assert.equal(cachedPath, path.join(dir, 'abc123.webm'));

  fs.rmSync(dir, { recursive: true, force: true });
});

test('getCacheStatus reports warming when a lock file exists and cached when final audio exists', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-cache-'));
  const lockPath = path.join(dir, 'song001.lock');

  fs.writeFileSync(lockPath, '');
  const warming = getCacheStatus('song001', dir);
  assert.equal(warming.cached, false);
  assert.equal(warming.warming, true);

  fs.unlinkSync(lockPath);
  const finalPath = path.join(dir, 'song001.m4a');
  fs.writeFileSync(finalPath, 'ready');

  const cached = getCacheStatus('song001', dir);
  assert.equal(cached.cached, true);
  assert.equal(cached.warming, false);
  assert.equal(cached.path, finalPath);
  assert.equal(cached.ext, '.m4a');
  assert.ok(cached.sizeBytes > 0);

  fs.rmSync(dir, { recursive: true, force: true });
});
