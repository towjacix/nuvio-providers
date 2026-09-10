/**
 * KKPhim Provider
 * Main entry point - Nuvio gọi getStreams(tmdbId, mediaType, season, episode).
 *
 * Flow: 1 request duy nhất tới https://phimapi.com/tmdb/{movie|tv}/{tmdbId}
 * - movie: lấy mọi server_data có link (link_m3u8 ưu tiên, fallback link_embed)
 * - tv:    chỉ lấy đúng tập yêu cầu; season check theo CONFIG.STRICT_SEASON
 */

import { extractStreams } from './extractor.js';
import { resetBaseUrlCache } from './extractor.js';

/**
 * Main function called by Nuvio
 * @param {string} tmdbId - TMDB ID của media
 * @param {string} mediaType - 'movie' hoặc 'tv'
 * @param {number} [season] - Season number (cho TV, 1-based)
 * @param {number} [episode] - Episode number (cho TV, 1-based)
 * @param {object} [options] - Chỉ dùng trong test (strictSeason override)
 */
async function getStreams(tmdbId, mediaType, season, episode, options) {
    try {
        return await extractStreams(tmdbId, mediaType, season, episode, options);
    } catch (error) {
        console.error('[KKPhim] Error:', error && error.message ? error.message : String(error));
        return [];
    }
}

// Chỉ dùng trong unit test: reset cache base URL động (isolation giữa các test case)
module.exports = { getStreams, resetBaseUrlCache };

