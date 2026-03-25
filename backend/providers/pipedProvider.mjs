import axios from 'axios';
import { logger } from '../lib/logger.mjs';

// Public Piped instances — highly reliable open-source YouTube frontends.
const PIPED_INSTANCES = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.in.projectsegfau.lt',
    'https://pipedapi.us.projectsegfau.lt',
    'https://pipedapi.r4fo.com'
];

/**
 * Shuffles an array in-place.
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Tries to fetch an audio stream URL for a given YouTube video ID from a pool of Piped API instances.
 * @param {string} videoId 
 * @returns {Promise<string|null>} Stream URL or null if unavailable everywhere.
 */
export async function pipedGetAudioUrl(videoId) {
    if (!videoId) return null;

    // Shuffle instances to distribute load and gracefully degrade if one is down
    const instances = shuffle([...PIPED_INSTANCES]);

    for (const baseUrl of instances) {
        try {
            const endpoint = `${baseUrl}/streams/${videoId}`;
            const response = await axios.get(endpoint, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'AuraMusicPlayer/1.0'
                }
            });

            if (response.data && response.data.audioStreams && response.data.audioStreams.length > 0) {
                const streams = response.data.audioStreams;
                
                // Prefer an m4a stream for compatibility with Android ExoPlayer / Web Audio
                let bestStream = streams.find(s => s.mimeType && s.mimeType.includes('audio/mp4'));
                if (!bestStream) {
                    // Fall back to webm
                    bestStream = streams.find(s => s.mimeType && s.mimeType.includes('audio/webm'));
                }
                
                if (bestStream && bestStream.url) {
                    logger.info('piped', `Resolved stream via ${baseUrl}`, { videoId });
                    return bestStream.url;
                }
            }
        } catch (error) {
            // Ignore instance failures and try the next one
            logger.debug('piped', `Failed to resolve on ${baseUrl}`, { videoId, error: error.message });
        }
    }

    return null;
}
