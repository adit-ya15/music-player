import { retry } from '../lib/retry.mjs';
import { logger } from '../lib/logger.mjs';
import { withTimeout } from '../lib/withTimeout.mjs';
import { dedupe } from '../lib/dedupe.mjs';
import { metrics } from '../lib/metrics.mjs';
import { invidiousGetAudioUrl } from '../providers/invidiousProvider.mjs';
import { pipedGetAudioUrl } from '../providers/pipedProvider.mjs';
import { saavnGetAudioUrl } from '../providers/saavnProvider.mjs';
import { ytdlCoreGetAudioUrl } from '../providers/ytdlCoreProvider.mjs';
import { youtubeiGetAudioUrl } from '../providers/youtubeiProvider.mjs';
import { ytdlpGetUrl } from '../providers/ytdlpProvider.mjs';
import { ytdlpQueue } from '../queue/ytdlpQueue.mjs';
import { isStreamAlive } from '../utils/validateStream.mjs';

const TTL_SECONDS = Math.max(60, Number(process.env.STREAM_CACHE_TTL_SECONDS || 1800));
const CACHE_NAMESPACE = (process.env.CACHE_NAMESPACE || 'aura').trim() || 'aura';
const VALIDATION_TIMEOUT_MS = Math.max(500, Number(process.env.STREAM_VALIDATE_TIMEOUT_MS || 4000));
const PRIMARY_TIMEOUT_MS = Math.max(500, Number(process.env.PRIMARY_TIMEOUT_MS || 8000));
const QUICK_FALLBACK_TIMEOUT_MS = Math.max(500, Number(process.env.QUICK_FALLBACK_TIMEOUT_MS || 2500));
const FALLBACK_TIMEOUT_MS = Math.max(500, Number(process.env.YTDLP_TIMEOUT_MS || process.env.YTDLP_TIMEOUT || 9000));
const ENABLE_YT_FALLBACKS = String(process.env.ENABLE_YT_FALLBACKS || 'true').trim().toLowerCase() !== 'false';
const YTDLP_CLIENTS = String(process.env.YT_DLP_FALLBACK_CLIENTS || 'android,ios,mweb')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

let ytdlpFailureCount = 0;
const YTDLP_CB_THRESHOLD = Math.max(1, Number(process.env.YTDLP_CB_THRESHOLD || 5));
const YTDLP_CB_COOLDOWN_MS = Math.max(5_000, Number(process.env.YTDLP_CB_COOLDOWN_MS || 60_000));
let ytdlpCircuitOpenedAt = 0;

function isQueueTimeoutError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('task timed out');
}

async function resolveProvider(name, provider, { timeoutMs, videoId, metric, validate = true }) {
  logger.info('resolver', `${name} fallback started`, { videoId });

  try {
    const url = await withTimeout(
      retry(provider, 1, {
        delayMs: 0,
        onError: (err) => logger.warn('resolver', `${name} attempt failed`, {
          videoId,
          error: err?.message,
        }),
      }),
      timeoutMs,
    );

    if (!url) {
      logger.info('resolver', `${name} returned no stream`, { videoId });
      return null;
    }

    if (validate) {
      const ok = await withTimeout(isStreamAlive(url), VALIDATION_TIMEOUT_MS).catch(() => false);
      if (!ok) {
        logger.warn('resolver', `${name} returned an invalid stream URL`, { videoId });
        return null;
      }
    }

    logger.info('resolver', `${name} fallback resolved stream`, { videoId });
    if (metric) metrics.increment(metric);
    return { url, source: name };
  } catch (error) {
    logger.warn('resolver', `${name} fallback failed`, {
      videoId,
      error: error?.message,
    });
    return null;
  }
}

function streamKey(videoId) {
  return `${CACHE_NAMESPACE}:stream:${videoId}`;
}

async function resolveStreamWithMetaInternal({
  innertube,
  ytdlpBin,
  cache,
  videoId,
  title,
  artist,
}) {
  const key = streamKey(videoId);

  return dedupe(key, async () => {
    const cached = await cache.get(key);
    if (cached && typeof cached === 'string' && cached.trim()) {
      const ok = await withTimeout(isStreamAlive(cached), VALIDATION_TIMEOUT_MS).catch(() => false);
      if (ok) {
        metrics.increment('resolver.cache.hit');
        return { url: cached, source: 'resolver-cache' };
      }
      metrics.increment('resolver.cache.stale');
    } else {
      metrics.increment('resolver.cache.miss');
    }

    const youtubeiFallback = async () => {
      if (!innertube) return null;
      return await youtubeiGetAudioUrl(innertube, videoId);
    };

    const ytdlCoreFallback = async () => await ytdlCoreGetAudioUrl(videoId);

    const ytdlpFallback = async () => {
      if (!ytdlpBin) return null;
      const now = Date.now();
      if (ytdlpCircuitOpenedAt && (now - ytdlpCircuitOpenedAt) >= YTDLP_CB_COOLDOWN_MS) {
        ytdlpCircuitOpenedAt = 0;
        ytdlpFailureCount = 0;
      }

      if (ytdlpFailureCount > YTDLP_CB_THRESHOLD) {
        metrics.increment('resolver.circuit.open');
        throw new Error('yt-dlp temporarily disabled');
      }

      try {
        for (const playerClient of YTDLP_CLIENTS) {
          const url = await ytdlpQueue.add(() => ytdlpGetUrl(ytdlpBin, videoId, { playerClient }));
          if (url) {
            ytdlpFailureCount = 0;
            ytdlpCircuitOpenedAt = 0;
            return url;
          }
        }

        ytdlpFailureCount += 1;
        if (ytdlpFailureCount > YTDLP_CB_THRESHOLD && !ytdlpCircuitOpenedAt) {
          ytdlpCircuitOpenedAt = Date.now();
        }
        return null;
      } catch (error) {
        ytdlpFailureCount += 1;
        if (ytdlpFailureCount > YTDLP_CB_THRESHOLD && !ytdlpCircuitOpenedAt) {
          ytdlpCircuitOpenedAt = Date.now();
        }
        if (isQueueTimeoutError(error)) {
          logger.warn('resolver', 'yt-dlp queue timeout; continuing to fallback providers', {
            videoId,
            error: error?.message,
          });
          return null;
        }
        throw error;
      }
    };

    const pipedFallback = async () => await pipedGetAudioUrl(videoId);
    const invidiousFallback = async () => await invidiousGetAudioUrl(videoId);
    const saavnFallback = async () => await saavnGetAudioUrl(videoId, title, artist);

    const candidateResolvers = [
      { name: 'youtubei', metric: 'resolver.secondary.success', fn: youtubeiFallback, timeoutMs: PRIMARY_TIMEOUT_MS },
      { name: 'ytdl-core', metric: 'resolver.secondary.success', fn: ytdlCoreFallback, timeoutMs: PRIMARY_TIMEOUT_MS },
      { name: 'yt-dlp', metric: 'resolver.primary.success', fn: ytdlpFallback, timeoutMs: FALLBACK_TIMEOUT_MS },
      { name: 'piped', metric: 'resolver.fallback.used', fn: pipedFallback, timeoutMs: QUICK_FALLBACK_TIMEOUT_MS },
      { name: 'invidious', metric: 'resolver.fallback.used', fn: invidiousFallback, timeoutMs: QUICK_FALLBACK_TIMEOUT_MS },
      { name: 'saavn', metric: 'resolver.fallback.used', fn: saavnFallback, timeoutMs: PRIMARY_TIMEOUT_MS },
    ];

    if (!ENABLE_YT_FALLBACKS) {
      logger.info('resolver', 'Non-yt-dlp fallbacks are disabled (yt-dlp only mode)', { videoId });
    }

    let resolved = null;
    for (const candidate of candidateResolvers) {
      if (!ENABLE_YT_FALLBACKS && candidate.name !== 'yt-dlp') continue;
      const result = await resolveProvider(candidate.name, candidate.fn, {
        timeoutMs: candidate.timeoutMs,
        videoId,
        metric: candidate.metric,
      });

      if (result?.url) {
        resolved = result;
        break;
      }
    }

    if (!resolved?.url) {
      metrics.increment('resolver.failure');
      throw new Error('Stream unavailable');
    }

    const ttl = TTL_SECONDS + Math.floor(Math.random() * 120);
    await cache.set(key, resolved.url, ttl);
    return resolved;
  });
}

export async function resolveStreamWithMeta(options) {
  return await resolveStreamWithMetaInternal(options);
}

export async function resolveStreamUrl(options) {
  const resolved = await resolveStreamWithMetaInternal(options);
  return resolved?.url || null;
}
