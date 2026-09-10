import { extractStreams, resetSeedCache } from './extractor.js';

async function getStreams(tmdbId, mediaType, season, episode) {
    try {
        return await extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
        console.error('[VidKing] Error:', error && error.message ? error.message : String(error));
        return [];
    }
}

module.exports = { getStreams, resetSeedCache };