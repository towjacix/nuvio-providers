import { extractStreams, resolveEmbedPlaylist } from './extractor.js';

async function getStreams(tmdbId, mediaType, season, episode, options) {
    try {
        return await extractStreams(tmdbId, mediaType, season, episode, options);
    } catch (error) {
        console.error('[NguồnC] Error:', error && error.message ? error.message : String(error));
        return [];
    }
}

module.exports = { getStreams, resolveEmbedPlaylist };