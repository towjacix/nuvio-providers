import { extractStreams, resetBaseUrlCache } from './extractor.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        return await extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
        console.error('[BluPhim] Error:', error && error.message ? error.message : String(error));
        return [];
    }
}

module.exports = { getStreams, resetBaseUrlCache };
