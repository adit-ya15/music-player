import fs from 'node:fs/promises';
import path from 'node:path';

import { spawnWithTimeout } from './spawnWithTimeout.mjs';
import { logger } from './logger.mjs';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function parseBool(value, defaultValue = false) {
  if (value == null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function clampNumber(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

async function readStamp(stampPath) {
  try {
    const raw = await fs.readFile(stampPath, 'utf8');
    const data = JSON.parse(raw);
    return Number(data?.updatedAt || 0) || 0;
  } catch {
    return 0;
  }
}

async function writeStamp(stampPath, updatedAt) {
  await fs.mkdir(path.dirname(stampPath), { recursive: true });
  await fs.writeFile(stampPath, JSON.stringify({ updatedAt }, null, 2), 'utf8');
}

async function runYtdlpUpdate(bin, timeoutMs) {
  const { proc, done } = spawnWithTimeout(bin, ['-U'], {
    timeoutMs,
  });

  let stdout = '';
  let stderr = '';
  proc.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
    if (stdout.length > 6000) stdout = stdout.slice(-6000);
  });
  proc.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 6000) stderr = stderr.slice(-6000);
  });

  const { code } = await done;
  return {
    code,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

export function scheduleYtdlpAutoUpdate(bin) {
  const enabled = parseBool(process.env.YTDLP_AUTO_UPDATE_ENABLED, true);
  if (!enabled) {
    logger.info('ytdlp-updater', 'Auto-update disabled by env');
    return;
  }

  const intervalMs = clampNumber(process.env.YTDLP_AUTO_UPDATE_INTERVAL_MS, ONE_WEEK_MS, 60_000, 90 * ONE_WEEK_MS);
  const timeoutMs = clampNumber(process.env.YTDLP_AUTO_UPDATE_TIMEOUT_MS, 180_000, 5_000, 900_000);
  const stateDir = String(process.env.YTDLP_AUTO_UPDATE_STATE_DIR || '.cache').trim();
  const stampPath = path.join(stateDir, 'ytdlp-auto-update.json');

  let running = false;

  const maybeUpdate = async () => {
    if (running) return;
    running = true;

    try {
      const lastUpdatedAt = await readStamp(stampPath);
      const ageMs = Date.now() - lastUpdatedAt;
      if (lastUpdatedAt > 0 && ageMs < intervalMs) {
        return;
      }

      logger.info('ytdlp-updater', 'Running yt-dlp auto-update', {
        bin,
        intervalMs,
        timeoutMs,
      });

      const result = await runYtdlpUpdate(bin, timeoutMs);
      if (result.code === 0) {
        await writeStamp(stampPath, Date.now());
        logger.info('ytdlp-updater', 'yt-dlp auto-update completed', {
          code: result.code,
          stdoutPreview: result.stdout.slice(0, 300),
        });
      } else {
        logger.warn('ytdlp-updater', 'yt-dlp auto-update returned non-zero', {
          code: result.code,
          stderrPreview: result.stderr.slice(0, 300),
          stdoutPreview: result.stdout.slice(0, 300),
        });
      }
    } catch (error) {
      logger.warn('ytdlp-updater', 'yt-dlp auto-update failed', {
        error: error?.message,
      });
    } finally {
      running = false;
    }
  };

  // Run once shortly after startup, then on schedule.
  setTimeout(() => {
    maybeUpdate();
  }, 8_000).unref?.();

  const timer = setInterval(() => {
    maybeUpdate();
  }, intervalMs);
  timer.unref?.();

  logger.info('ytdlp-updater', 'Auto-update scheduler started', {
    intervalMs,
    timeoutMs,
    stampPath,
  });
}
