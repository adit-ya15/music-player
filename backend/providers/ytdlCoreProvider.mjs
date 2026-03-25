import ytdl from '@distube/ytdl-core';
import { readFile } from 'node:fs/promises';
import { logger } from '../lib/logger.mjs';

const DEFAULT_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

function parseNetscapeCookiesToHeader(text) {
  // Netscape cookies.txt format (tab-separated):
  // domain, includeSubdomains, path, secure, expiry, name, value
  const pairs = [];

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split('\t');
    if (parts.length < 7) continue;
    const name = parts[5];
    const value = parts[6];
    if (!name) continue;
    pairs.push(`${name}=${value || ''}`);
  }

  // Keep header reasonably sized.
  const joined = pairs.join('; ');
  if (joined.length > 8000) return joined.slice(0, 8000);
  return joined;
}

async function loadCookieHeaderFromFile(cookiesFile) {
  if (!cookiesFile) return null;
  try {
    const buf = await readFile(cookiesFile);
    const cookie = parseNetscapeCookiesToHeader(buf.toString('utf8'));
    return cookie || null;
  } catch (err) {
    logger.warn('provider.ytdlcore', 'Failed to read cookies file', { file: cookiesFile, error: err?.message });
    return null;
  }
}

function scoreAudioFormat(fmt) {
  // Prefer audio-only formats with higher bitrate.
  const mime = (fmt.mimeType || fmt.mime_type || '').toString();
  const bitrate = Number(fmt.bitrate || fmt.averageBitrate || fmt.average_bitrate || 0);
  const isAudioOnly = !fmt.hasVideo && !fmt.has_video && mime.startsWith('audio/');
  const isOpus = mime.includes('opus');
  return (isAudioOnly ? 1_000_000 : 0) + (isOpus ? 10_000 : 0) + bitrate;
}

export async function ytdlCoreGetAudioUrl(videoId) {
  if (!videoId) return null;

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const cookiesFile = process.env.YT_COOKIES_FILE;
    const cookieHeader = await loadCookieHeaderFromFile(cookiesFile);

    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          'user-agent': process.env.YT_USER_AGENT || DEFAULT_UA,
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
      },
    });

    const formats = Array.isArray(info?.formats) ? info.formats : [];
    const audio = formats
      .filter((f) => {
        const mime = (f?.mimeType || '').toString();
        return mime.startsWith('audio/') || (!f?.hasVideo && f?.audioBitrate);
      })
      .sort((a, b) => scoreAudioFormat(b) - scoreAudioFormat(a));

    const best = audio[0];
    const audioUrl = best?.url;
    if (!audioUrl) {
      logger.warn('provider.ytdlcore', 'No audio format URL', { videoId });
      return null;
    }

    return audioUrl;
  } catch (err) {
    logger.warn('provider.ytdlcore', 'ytdl-core failed', { videoId, error: err?.message });
    return null;
  }
}
