import Redis from 'ioredis';

import { logger } from '../lib/logger.mjs';

class MemoryRecoStore {
  constructor() {
    this._userPlays = new Map(); // userId -> Map(songId -> count)
    this._userRecent = new Map(); // userId -> array of song JSON (most recent first)
    this._globalPlays = new Map(); // songId -> count
    this._songMeta = new Map(); // songId -> song JSON
  }

  async trackPlay({ userId, song }) {
    if (!userId || !song?.id) return;

    const userMap = this._userPlays.get(userId) || new Map();
    userMap.set(song.id, (userMap.get(song.id) || 0) + 1);
    this._userPlays.set(userId, userMap);

    this._globalPlays.set(song.id, (this._globalPlays.get(song.id) || 0) + 1);

    const rec = this._userRecent.get(userId) || [];
    rec.unshift(song);
    this._userRecent.set(userId, rec.slice(0, 50));

    this._songMeta.set(song.id, song);
  }

  async getTopSongs(userId, limit = 10) {
    const map = this._userPlays.get(userId);
    if (!map) return [];
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([songId]) => songId);
  }

  async getRecent(userId, limit = 10) {
    const rec = this._userRecent.get(userId) || [];
    return rec.slice(0, limit);
  }

  async getTrending(limit = 20) {
    return Array.from(this._globalPlays.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([songId]) => songId);
  }

  async getSongMeta(songId) {
    return this._songMeta.get(songId) || null;
  }
}

class RedisRecoStore {
  constructor(url) {
    this._redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  async _ensure() {
    if (this._redis.status === 'ready') return;
    if (this._redis.status === 'connecting') return;
    try {
      await this._redis.connect();
    } catch {
      // ignore
    }
  }

  async trackPlay({ userId, song }) {
    if (!userId || !song?.id) return;

    try {
      await this._ensure();
      const songId = String(song.id);

      await this._redis.zincrby(`user:plays:${userId}`, 1, songId);
      await this._redis.zincrby('global:plays', 1, songId);

      await this._redis.lpush(`user:recent:${userId}`, JSON.stringify(song));
      await this._redis.ltrim(`user:recent:${userId}`, 0, 49);

      // Store metadata for trending/topSongs hydration.
      await this._redis.set(`song:meta:${songId}`, JSON.stringify(song), 'EX', 7 * 24 * 60 * 60);
    } catch (err) {
      logger.warn('reco.store', 'trackPlay failed', { userId, error: err?.message });
    }
  }

  async getTopSongs(userId, limit = 10) {
    try {
      await this._ensure();
      return await this._redis.zrevrange(`user:plays:${userId}`, 0, Math.max(0, limit - 1));
    } catch (err) {
      logger.warn('reco.store', 'getTopSongs failed', { userId, error: err?.message });
      return [];
    }
  }

  async getRecent(userId, limit = 10) {
    try {
      await this._ensure();
      const raw = await this._redis.lrange(`user:recent:${userId}`, 0, Math.max(0, limit - 1));
      return raw.map((s) => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      }).filter(Boolean);
    } catch (err) {
      logger.warn('reco.store', 'getRecent failed', { userId, error: err?.message });
      return [];
    }
  }

  async getTrending(limit = 20) {
    try {
      await this._ensure();
      return await this._redis.zrevrange('global:plays', 0, Math.max(0, limit - 1));
    } catch (err) {
      logger.warn('reco.store', 'getTrending failed', { error: err?.message });
      return [];
    }
  }

  async getSongMeta(songId) {
    if (!songId) return null;
    try {
      await this._ensure();
      const raw = await this._redis.get(`song:meta:${songId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

let storePromise = null;

export function getRecoStore() {
  if (storePromise) return storePromise;

  storePromise = (async () => {
    const url = process.env.REDIS_URL;
    if (!url) {
      logger.info('reco.store', 'Using in-memory reco store');
      return new MemoryRecoStore();
    }

    logger.info('reco.store', 'Using Redis reco store');
    return new RedisRecoStore(url);
  })();

  return storePromise;
}
