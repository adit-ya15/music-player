import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from '../lib/logger.mjs';

const CACHE_DIR = path.resolve('backend/cache/audio');
// Limit to 1GB
const MAX_CACHE_BYTES = 1024 * 1024 * 1024;

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Checks the size of the cache directory. If it exceeds MAX_CACHE_BYTES,
 * deletes the oldest files until it is under the limit.
 */
export async function enforceCacheLimit() {
    try {
        const files = await fs.promises.readdir(CACHE_DIR);
        const fileStats = await Promise.all(files.map(async file => {
            const filePath = path.join(CACHE_DIR, file);
            const stats = await fs.promises.stat(filePath);
            return { filePath, size: stats.size, mtime: stats.mtimeMs };
        }));

        let totalSize = fileStats.reduce((acc, curr) => acc + curr.size, 0);

        if (totalSize <= MAX_CACHE_BYTES) return;

        // Sort by oldest modified time first
        fileStats.sort((a, b) => a.mtime - b.mtime);

        for (const file of fileStats) {
            if (totalSize <= MAX_CACHE_BYTES) break;
            
            try {
                await fs.promises.unlink(file.filePath);
                totalSize -= file.size;
                logger.debug('cache', `Evicted ${path.basename(file.filePath)} (freed ${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            } catch (err) {
                logger.error('cache', `Failed to evict ${file.filePath}`, err);
            }
        }
        
        logger.info('cache', `Cache limit enforced. Current size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    } catch (err) {
        logger.error('cache', 'Error enforcing cache limit', err);
    }
}

/**
 * Spawns yt-dlp in the background to download the audio stream to the disk cache.
 * Does not block the main thread.
 */
export function downloadToCache(videoId, ytdlpBin) {
    if (!videoId || !ytdlpBin) return;

    const finalPath = path.join(CACHE_DIR, `${videoId}.m4a`);
    const tmpPath = path.join(CACHE_DIR, `${videoId}.tmp.m4a`);

    // If it's already downloaded or currently downloading, skip.
    if (fs.existsSync(finalPath) || fs.existsSync(tmpPath)) return;

    logger.debug('cache', `Starting background download for ${videoId}`);

    // Create a dummy tmp file to lock the download process
    fs.writeFileSync(tmpPath, '');

    const args = [
        videoId,
        '-f', 'bestaudio[ext=m4a]/bestaudio',
        '--extract-audio',
        '--audio-format', 'm4a',
        '--output', tmpPath,
        '--no-playlist',
        '--quiet'
    ];

    const proc = spawn(ytdlpBin, args, { stdio: 'ignore', detached: true });
    
    // Unref allows the parent node process to exit even if this child is still running
    proc.unref();

    proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(tmpPath)) {
            // Success: rename tmp to final and check size limit
            fs.renameSync(tmpPath, finalPath);
            logger.info('cache', `Successfully cached ${videoId}`);
            enforceCacheLimit();
        } else {
            // Failure: clean up tmp file
            logger.warn('cache', `Background download failed for ${videoId}`);
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        }
    });

    proc.on('error', () => {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    });
}

/**
 * Returns the path to the cached file if it exists, otherwise null.
 */
export function getCachedFilePath(videoId) {
    const finalPath = path.join(CACHE_DIR, `${videoId}.m4a`);
    if (fs.existsSync(finalPath)) {
        // Touch the file to update its modified time for the LRU cache
        const now = new Date();
        try { fs.utimesSync(finalPath, now, now); } catch { /* ignore */ }
        return finalPath;
    }
    return null;
}
