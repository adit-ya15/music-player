import { ytdlpGetUrl } from './backend/providers/ytdlpProvider.mjs';

const bin = process.env.YT_DLP_BIN ? process.env.YT_DLP_BIN : 'yt-dlp';
const videoId = 'dQw4w9WgXcQ';

process.env.YTDLP_TIMEOUT_MS = '15000';

try {
  const url = await ytdlpGetUrl(bin, videoId, { playerClient: 'android' });
  console.log(url ? 'YT-DLP_OK' : 'YT-DLP_EMPTY');
  if (url) {
    console.log(url);
  }
} catch (error) {
  console.error('YT-DLP_ERR');
  console.error(error && error.message ? error.message : String(error));
  process.exitCode = 1;
}
