import { logger } from '../lib/logger.mjs';

// Public Invidious instances — open-source YouTube frontends (separate pool from Piped).
const INVIDIOUS_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.jing.rocks',
    'https://invidious.privacyredirect.com',
    'https://iv.ggtyler.dev',
    'https://invidious.materialio.us',
    'https://yt.cdaut.de',
];

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Tries to fetch an audio stream URL from a pool of public Invidious instances.
 * @param {string} videoId
 * @returns {Promise<string|null>}
 */
export async function invidiousGetAudioUrl(videoId) {
    if (!videoId) return null;

    const instances = shuffle([...INVIDIOUS_INSTANCES]);

    for (const baseUrl of instances) {
        try {
            const endpoint = `${baseUrl}/api/v1/videos/${videoId}`;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 6000);

            const response = await fetch(endpoint, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'AuraMusicPlayer/1.0',
                    'Accept': 'application/json',
                },
            });
            clearTimeout(timer);

            if (!response.ok) continue;

            const data = await response.json();
            const streams = data?.adaptiveFormats || [];

            // Prefer audio-only m4a, then webm/opus
            let best = streams.find(
                (s) => s.type?.includes('audio/mp4') && !s.qualityLabel
            );
            if (!best) {
                best = streams.find(
                    (s) => s.type?.includes('audio/webm') && !s.qualityLabel
                );
            }
            // Fallback: any audio stream
            if (!best) {
                best = streams.find((s) => s.type?.startsWith('audio/'));
            }

            if (best?.url) {
                logger.info('invidious', `Resolved stream via ${baseUrl}`, { videoId });
                return best.url;
            }
        } catch (error) {
            logger.debug('invidious', `Failed on ${baseUrl}`, {
                videoId,
                error: error?.message,
            });
        }
    }

    return null;
}
