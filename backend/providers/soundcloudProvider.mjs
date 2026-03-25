import play from 'play-dl';
import { logger } from '../lib/logger.mjs';

/**
 * Validates a SoundCloud URL and ensures it's playable.
 * Used internally by the provider.
 */
async function getSoundcloudStreamUrl(scUrl) {
    try {
        const streamInfo = await play.stream(scUrl);
        if (streamInfo && streamInfo.url) {
            return streamInfo.url;
        }
    } catch (err) {
        logger.debug('soundcloud', `Failed to extract stream from ${scUrl}`, { error: err.message });
    }
    return null;
}

/**
 * Tries to fetch an audio stream URL from SoundCloud by searching for the track.
 * Used as a highly reliable fallback when YouTube/Piped fails.
 * @param {string} videoId For logging
 * @param {string} title Song title
 * @param {string} artist Artist name
 * @returns {Promise<string|null>} Stream URL or null
 */
export async function soundcloudGetAudioUrl(videoId, title, artist) {
    if (!title) return null;

    const query = `${artist ? artist + ' ' : ''}${title}`.trim();
    if (!query) return null;

    try {
        // Search SoundCloud for top 5 tracks
        const results = await play.search(query, {
            source: { soundcloud: 'tracks' },
            limit: 5
        });

        if (!Array.isArray(results) || results.length === 0) {
            logger.debug('soundcloud', `No search results for query: ${query}`);
            return null;
        }

        // Try to get a stream URL for the best match. 
        // Iterate through the top results in case the first is region-locked or paywalled (GO+).
        for (const track of results) {
            if (!track.url) continue;

            const streamUrl = await getSoundcloudStreamUrl(track.url);
            if (streamUrl) {
                logger.info('soundcloud', `Resolved stream via SoundCloud for: ${query}`, { videoId });
                return streamUrl;
            }
        }

        logger.debug('soundcloud', `Failed to extract a playable stream for query: ${query}`);
    } catch (err) {
        logger.warn('soundcloud', 'SoundCloud search failed', { query, error: err.message });
    }

    return null;
}
