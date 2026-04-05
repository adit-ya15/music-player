import { resolveMonochromeStream } from './monochromeSource.js';
import { resolveYtdlpEndpointStream } from './ytdlpSource.js';

const STREAM_CACHE_TTL_MS = 10 * 60 * 1000;
const MONOCHROME_HEDGE_DELAY_MS = 120;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toCandidate(promise, source) {
  return promise.then((result) => {
    if (result?.streamUrl) {
      return {
        ...result,
        streamSource: result.streamSource || source,
      };
    }
    throw new Error(`${source} stream unavailable`);
  });
}

function firstSuccessfulStream(promises) {
  return new Promise((resolve) => {
    if (!Array.isArray(promises) || promises.length === 0) {
      resolve(null);
      return;
    }

    let settled = false;
    let pending = promises.length;

    for (const candidatePromise of promises) {
      Promise.resolve(candidatePromise)
        .then((value) => {
          if (settled) return;
          if (value?.streamUrl) {
            settled = true;
            resolve(value);
          }
        })
        .catch(() => {
          // Swallow individual provider failures; winner may still arrive.
        })
        .finally(() => {
          pending -= 1;
          if (!settled && pending <= 0) {
            resolve(null);
          }
        });
    }
  });
}

function normalizeVideoId(track) {
  const raw = track?.videoId || track?.id || '';
  return String(raw).replace(/^yt-/, '').trim();
}

export function createMusicSources({
  youtubeApi,
  jamendoApi,
  soundcloudApi,
  ytdlpResolver = resolveYtdlpEndpointStream,
  monochromeResolver = resolveMonochromeStream,
}) {
  const streamCache = new Map();
  const sourcePreference = new Map();

  function getCachedStream(videoId) {
    const cached = streamCache.get(videoId);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      streamCache.delete(videoId);
      return null;
    }
    return {
      streamUrl: cached.streamUrl,
      streamSource: cached.streamSource,
      verified: true,
      cacheState: 'memory',
    };
  }

  function setCachedStream(videoId, resolved) {
    if (!videoId || !resolved?.streamUrl) return;
    streamCache.set(videoId, {
      streamUrl: resolved.streamUrl,
      streamSource: resolved.streamSource || 'unknown',
      expiresAt: Date.now() + STREAM_CACHE_TTL_MS,
    });

    if (streamCache.size > 400) {
      const oldestKey = streamCache.keys().next().value;
      if (oldestKey) streamCache.delete(oldestKey);
    }
  }

  function setPreferredSource(videoId, source) {
    if (!videoId || !source) return;
    sourcePreference.set(videoId, source);
    if (sourcePreference.size > 1000) {
      const oldestKey = sourcePreference.keys().next().value;
      if (oldestKey) sourcePreference.delete(oldestKey);
    }
  }

  async function resolveYoutubeFast(videoId, track) {
    const preferred = sourcePreference.get(videoId);

    const createYtdlpTask = () => toCandidate(
      ytdlpResolver(videoId, {
        title: track?.title,
        artist: track?.artist,
      }),
      'yt-dlp'
    );

    const createMonochromeTask = () => toCandidate(
      monochromeResolver(videoId, {
        title: track?.title,
        artist: track?.artist,
      }),
      'monochrome'
    );

    // Hedge requests like Nuclear-style resolver: start preferred source first,
    // then trigger the other shortly after to reduce tail latency.
    const raced = preferred === 'monochrome'
      ? [
          createMonochromeTask(),
          delay(MONOCHROME_HEDGE_DELAY_MS).then(() => createYtdlpTask()),
        ]
      : [
          createYtdlpTask(),
          delay(MONOCHROME_HEDGE_DELAY_MS).then(() => createMonochromeTask()),
        ];

    const resolved = await firstSuccessfulStream(raced);
    if (resolved?.streamUrl) {
      setPreferredSource(videoId, resolved.streamSource);
      setCachedStream(videoId, resolved);
      return resolved;
    }

    return null;
  }

  async function resolveJamendoLegalFallback(track) {
    if (!jamendoApi) return null;

    const query = [track?.title, track?.artist].filter(Boolean).join(' ').trim();
    if (!query) return null;

    const search = await jamendoApi.searchSongsSafe(query, 6);
    if (!search.ok || !Array.isArray(search.data) || !search.data.length) return null;

    for (const candidate of search.data) {
      const resolved = await jamendoApi.resolveStreamSafe({
        url: candidate?.streamUrl || candidate?.url,
        trackId: candidate?.originalId,
      });
      if (resolved.ok && resolved.data?.streamUrl) {
        const jamendoResolved = {
          streamUrl: resolved.data.streamUrl,
          streamSource: resolved.data.streamSource || 'jamendo',
          verified: true,
        };
        return jamendoResolved;
      }
    }

    return null;
  }

  const youtubeSource = {
    id: 'youtube',
    async search(query, limit = 20) {
      return youtubeApi.searchSongsSafe(query, limit);
    },
    async getStreamUrl(track) {
      const videoId = normalizeVideoId(track);
      if (!videoId) return null;

      const cached = getCachedStream(videoId);
      if (cached?.streamUrl) {
        return cached;
      }

      const resolvedFast = await resolveYoutubeFast(videoId, track);
      if (resolvedFast?.streamUrl) {
        return resolvedFast;
      }

      const jamendoLegal = await resolveJamendoLegalFallback(track);
      if (jamendoLegal?.streamUrl) {
        setCachedStream(videoId, jamendoLegal);
        return jamendoLegal;
      }

      return null;
    },
  };

  const monochromeSource = {
    id: 'monochrome',
    async search() {
      return { ok: true, data: [], error: null };
    },
    async getStreamUrl(track) {
      const videoId = normalizeVideoId(track);
      if (!videoId) return null;
      return monochromeResolver(videoId, {
        title: track?.title,
        artist: track?.artist,
      });
    },
  };

  const jamendoSource = {
    id: 'jamendo',
    async search(query, limit = 20) {
      if (!jamendoApi) return { ok: false, data: [], error: 'Jamendo is unavailable.' };
      return jamendoApi.searchSongsSafe(query, limit);
    },
    async getStreamUrl(track) {
      if (!jamendoApi) return null;

      const resolved = await jamendoApi.resolveStreamSafe({
        url: track?.streamUrl || track?.url,
        title: track?.title,
        artist: track?.artist,
        trackId: track?.originalId || normalizeVideoId(track),
      });

      if (!resolved.ok || !resolved.data?.streamUrl) return null;

      return {
        streamUrl: resolved.data.streamUrl,
        streamSource: resolved.data.streamSource || 'jamendo',
        verified: true,
      };
    },
  };

  const soundcloudSource = {
    id: 'soundcloud',
    async search(query, limit = 20) {
      if (!soundcloudApi) return { ok: false, data: [], error: 'SoundCloud is unavailable.' };
      return soundcloudApi.searchSongsSafe(query, limit);
    },
    async getStreamUrl(track) {
      if (!soundcloudApi) return null;

      const resolved = await soundcloudApi.resolveStreamSafe({
        trackId: track?.originalId || String(track?.id || '').replace(/^sc-/, ''),
        transcodings: Array.isArray(track?.transcodings) ? track.transcodings : [],
      });

      if (!resolved.ok || !resolved.data?.streamUrl) return null;

      return {
        streamUrl: resolved.data.streamUrl,
        streamSource: resolved.data.streamSource || 'soundcloud',
        verified: true,
      };
    },
  };

  return {
    youtube: youtubeSource,
    monochrome: monochromeSource,
    jamendo: jamendoSource,
    soundcloud: soundcloudSource,
  };
}
