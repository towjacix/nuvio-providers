/**
 * KKPhim Provider - Extractor
 * Logic mapping API response -> Nuvio stream objects.
 *
 * API response shape (verified live 2026-09-10):
 * {
 *   "status": true,
 *   "movie": { "quality": "FHD", "tmdb": { "id", "type", "season" }, ... },
 *   "episodes": [ { "server_name": "Vietsub", "server_data": [
 *       { "name": "Tập 01", "slug": "tap-01", "filename": "...|1080p|...",
 *         "link_embed": "...", "link_m3u8": "https://...index.m3u8" }
 *   ] } ]
 * }
 */

import { CONFIG } from './config.js';
import { fetchJson } from './http.js';

const QUALITY_MAP = {
    FHD: '1080p',
    FULLHD: '1080p',
    HD: '720p',
    SD: '480p',
    CAM: 'CAM',
};


const IMDB_ID_RE = /^tt\d+$/i;

/**
 * Resolve ID về dạng số TMDB mà phimapi.com yêu cầu.
 * - Số nguyên ("12345") -> giữ nguyên (không tốn request)
 * - IMDB id ("tt9054364") -> TMDB Find API (external_source=imdb_id)
 * App Nuvio (Stremio catalogs) truyền IMDB id dạng "tt..." — phimapi.com
 * trả 404 cho dạng này (verify 2026-09-10: /tmdb/tv/tt9054364 -> 404).
 * Không resolve được thì throw (getStreams bắt -> []).
 */
export async function resolveTmdbId(tmdbId, mediaType) {
    const raw = String(tmdbId || '').split(':')[0].trim();
    if (/^\d+$/.test(raw)) return raw;
    if (!IMDB_ID_RE.test(raw)) throw new Error(`id không hợp lệ: "${raw}"`);

    const url = `${CONFIG.TMDB_API_BASE}/find/${raw}?api_key=${CONFIG.TMDB_API_KEY}&external_source=imdb_id`;
    const data = await fetchJson(url);
    const results = mediaType === 'movie' ? data.movie_results : data.tv_results;
    const id = Array.isArray(results) && results[0] && results[0].id;
    if (!id) throw new Error(`không resolve được TMDB id từ "${raw}"`);
    return String(id);
}
/**
 * Entry point: fetch chi tiết phim theo TMDB ID rồi map sang streams.
 * @param {string} tmdbId
 * @param {string} mediaType - 'movie' | 'tv'
 * @param {number} [season]
 * @param {number} [episode]
 * @param {object} [options] - { strictSeason } override cho test
 * @returns {Promise<Array>}
 */
export async function extractStreams(tmdbId, mediaType, season, episode, options = {}) {
    const resolved = await resolveTmdbId(tmdbId, mediaType);
    const url = `${CONFIG.BASE_URL}/tmdb/${mediaType}/${resolved}`;
    const data = await fetchJson(url);
    return toStreams(data, mediaType, season, episode, options);
}

/**
 * Thuần mapping (network-free, unit-test được).
 */
export function toStreams(data, mediaType, season, episode, options = {}) {
    if (!data || data.status !== true) return [];

    const movie = data.movie || {};
    const episodes = data.episodes;
    if (!Array.isArray(episodes) || episodes.length === 0) return [];

    const strictSeason = options.strictSeason !== undefined
        ? options.strictSeason
        : CONFIG.STRICT_SEASON;

    const tmdbSeason = movie.tmdb && movie.tmdb.season != null
        ? Number(movie.tmdb.season)
        : null;

    // Gate season: KKPhim chỉ có 1 entry/season; nếu không khớp và strict -> từ chối
    if (mediaType === 'tv' && tmdbSeason != null && Number(season) !== tmdbSeason) {
        if (strictSeason) {
            console.warn(
                `[KKPhim] TV ${movie.tmdb ? movie.tmdb.id : '?'}: yêu cầu Season ${season} ` +
                `nhưng KKPhim chỉ có Season ${tmdbSeason} -> [] (strict). ` +
                `Chọn đúng season trong app, hoặc STRICT_SEASON=false để lấy stream kèm nhãn "[Phần N]".`
            );
            return [];
        }
    }

    const isMovie = mediaType === 'movie';
    const wantEp = Number(episode);

    const streams = [];
    const seen = new Set();

    episodes.forEach((group) => {
        const server = (group && group.server_name) || CONFIG.PROVIDER_NAME;
        const serverData = (group && Array.isArray(group.server_data)) ? group.server_data : [];

        serverData.forEach((ep) => {
            const url = (ep && (ep.link_m3u8 || ep.link_embed)) || '';
            if (!url || seen.has(url)) return; // dedupe theo URL

            if (!isMovie) {
                const epNum = parseInt(String(ep.name || '').replace(/\D/g, ''), 10);
                if (epNum !== wantEp) return; // chỉ đúng tập yêu cầu
            }

            seen.add(url);
            streams.push({
                name: CONFIG.PROVIDER_NAME,
                title: buildTitle(ep, server, isMovie ? null : labelFor(tmdbSeason, season, strictSeason)),
                url,
                quality: parseQuality(ep.filename, movie.quality),
            });
        });
    });
    if (!isMovie && streams.length === 0) {
        console.warn(`[KKPhim] TV ${movie.tmdb ? movie.tmdb.id : '?'}: không có stream cho S${season}E${episode} (KKPhim đang giữ S${tmdbSeason ?? '?'}).`);
    }


    return streams;
}

/**
 * Nhãn season khi lenient-mode và season không khớp:
 * "[Phần 10] " — để user thấy rõ stream thuộc season nào.
 */
function labelFor(tmdbSeason, season, strictSeason) {
    if (strictSeason) return null;
    if (tmdbSeason == null || Number(season) === tmdbSeason) return null;
    return `[Phần ${tmdbSeason}]`;
}

function buildTitle(ep, server, label) {
    const base = (ep.filename || ep.name || CONFIG.PROVIDER_NAME).trim();
    const suffix = label ? `${label} ` : '';
    return `${suffix}${base} · ${server}`;
}

/**
 * Parse quality từ filename ("... - 1080p - ...") với fallback movie.quality ("FHD").
 */
export function parseQuality(filename, movieQuality) {
    if (filename) {
        const m = String(filename).match(/(\d{3,4})p/i);
        if (m) return m[1] + 'p';
        if (/4k/i.test(filename)) return '4K';
    }
    const q = String(movieQuality || '').toUpperCase();
    return QUALITY_MAP[q] || undefined;
}