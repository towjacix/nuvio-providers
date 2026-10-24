import { CONFIG } from './config.js';
import { fetchJson, fetchText } from './http.js';

const IMDB_ID_RE = /^tt\d+$/i;
const PHAN_NAME_RE = /\(Ph\u1ea7n\s*(\d+)\)/i;
const PHAN_SLUG_RE = /-phan-(\d+)$/i;
const SEASON_EN_RE = /\(season\s*(\d+)\)/i;
const HASH_RE = /[?&]hash=([a-f0-9]+)/i;

const VN_DIACRITICS = [
    ['\u00e0', 'a'], ['\u00e1', 'a'], ['\u1ea3', 'a'], ['\u00e3', 'a'], ['\u1ea1', 'a'], ['\u0103', 'a'], ['\u1eb1', 'a'], ['\u1eaf', 'a'], ['\u1eb3', 'a'], ['\u1eb5', 'a'], ['\u1eb7', 'a'],
    ['\u00e2', 'a'], ['\u1ea7', 'a'], ['\u1ea5', 'a'], ['\u1ea9', 'a'], ['\u1eab', 'a'], ['\u1ead', 'a'],
    ['\u00e8', 'e'], ['\u00e9', 'e'], ['\u1ebb', 'e'], ['\u1ebd', 'e'], ['\u1eb9', 'e'], ['\u00ea', 'e'], ['\u1ec1', 'e'], ['\u1ebf', 'e'], ['\u1ec3', 'e'], ['\u1ec5', 'e'], ['\u1ec7', 'e'],
    ['\u00ec', 'i'], ['\u00ed', 'i'], ['\u1ec9', 'i'], ['\u0129', 'i'], ['\u1ecb', 'i'],
    ['\u00f2', 'o'], ['\u00f3', 'o'], ['\u1ecf', 'o'], ['\u00f5', 'o'], ['\u1ecd', 'o'], ['\u00f4', 'o'], ['\u1ed3', 'o'], ['\u1ed1', 'o'], ['\u1ed5', 'o'], ['\u1ed7', 'o'], ['\u1ed9', 'o'],
    ['\u01a1', 'o'], ['\u1edd', 'o'], ['\u1edb', 'o'], ['\u1edf', 'o'], ['\u1ee1', 'o'], ['\u1ee3', 'o'],
    ['\u00f9', 'u'], ['\u00fa', 'u'], ['\u1ee7', 'u'], ['\u0169', 'u'], ['\u1ee5', 'u'], ['\u01b0', 'u'], ['\u1eeb', 'u'], ['\u1ee9', 'u'], ['\u1eed', 'u'], ['\u1eef', 'u'], ['\u1ef1', 'u'],
    ['\u1ef3', 'y'], ['\u00fd', 'y'], ['\u1ef7', 'y'], ['\u1ef9', 'y'], ['\u1ef5', 'y'],
    ['\u0111', 'd'],
    ['(', ''], [')', ''], ['[', ''], [']', ''], [':', ''], ['?', ''], ['!', ''], ['.', ''], [',', ''], ["'", ''], ['"', ''], ['&', ''],
];

/** Extract part number from item name/slug. Defaults to part 1 if unmarked. */
export function parsePhan(name, slug) {
    const mName = PHAN_NAME_RE.exec(String(name || ''));
    if (mName) return Number(mName[1]);
    const mSlug = PHAN_SLUG_RE.exec(String(slug || ''));
    return mSlug ? Number(mSlug[1]) : 1;
}

/** Normalize title for matching: strip "(Part N)"/"(Season N)", lowercase, collapse whitespace. */
export function normalizeTitle(s) {
    return String(s || '')
        .replace(PHAN_NAME_RE, ' ')
        .replace(SEASON_EN_RE, ' ')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** NguonC slugify: strip Vietnamese diacritics, lowercase, hyphen-separated. */
export function slugify(title) {
    let s = String(title || '').toLowerCase();
    VN_DIACRITICS.forEach(([from, to]) => {
        s = s.split(from).join(to);
    });
    return s
        .replace(/[^a-z0-9-]/g, '-')
        .split('-')
        .filter((p) => p.length > 0)
        .join('-');
}

/**
 * TMDB metadata → query name for nguonc (nguonc lacks tmdb/imdb IDs).
 * Supports numeric IDs (movie/tv) and IMDB "tt..." via TMDB Find API.
 * Fetches en-US for original_name/search and vi for name → slugify matches nguonc slugs
 * (slug is stripped from Vietnamese name, e.g. "Sieu Nhien" -> "sieu-nhien").
 */
export async function tmdbMeta(tmdbId, mediaType) {
    let id = tmdbId;
    if (IMDB_ID_RE.test(String(tmdbId))) {
        const find = await fetchJson(
            `${CONFIG.TMDB_API_BASE}/find/${tmdbId}?external_source=imdb_id&api_key=${CONFIG.TMDB_API_KEY}`,
        );
        const list = mediaType === 'tv' ? find.tv_results : find.movie_results;
        const first = (list || [])[0];
        if (!first) throw new Error(`TMDB find returned empty for ${tmdbId}`);
        id = first.id;
    }
    const [docEn, docVi] = await Promise.all([
        fetchJson(`${CONFIG.TMDB_API_BASE}/${mediaType}/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=en-US`),
        fetchJson(`${CONFIG.TMDB_API_BASE}/${mediaType}/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=vi`),
    ]);
    const doc = docEn || docVi || {};
    if (!doc.name && !doc.title) throw new Error(`TMDB ${mediaType}/${id} has no metadata`);
    const enName = doc.name || doc.title;
    const viName = (docVi && (docVi.name || docVi.title)) || null;
    return {
        id: String(doc.id || id),
        name: enName,
        originalName: doc.original_name || doc.original_title || enName,
        nameVi: viName && viName !== enName ? viName : null,
        year: String(doc.release_date || doc.first_air_date || '').slice(0, 4),
        seasons: Number(doc.number_of_seasons || 1),
    };
}

/** Search nguonc by keyword (EN original_name verified to return all parts). */
export async function searchNguonc(keyword, base = CONFIG.BASE_URL) {
    const data = await fetchJson(`${base}/films/search?keyword=${encodeURIComponent(keyword)}`);
    return (data && data.items) || [];
}

/** Safe search: returns [] on endpoint error without failing the flow. */
export async function searchNguoncSafe(keyword, base = CONFIG.BASE_URL) {
    try {
        return await searchNguonc(keyword, base);
    } catch (e) {
        console.warn(`[Ngu\u1ed3nC] search "${keyword}" error: ${e.message}`);
        return [];
    }
}

/** Trailing text after title is only valid if it is a season/part marker (prevents false matches like "Supernatural Events"). */
function titleMatches(t, want) {
    if (t === want) return true;
    if (!t.startsWith(want)) return false;
    const rest = t.slice(want.length).trim();
    if (!rest) return true;
    return /^(\d+(st|nd|rd|th)?\s*season|season\s*\d+|s\d+|part\s*\d+|p\d+|\(\d{4}\)|\d{4}|\d+)$/i.test(rest);
}

function aliasMatches(originalName, want) {
    const aliases = String(originalName || '').split(/\s*,\s*/).filter(Boolean);
    if (!aliases.length) return false;
    return aliases.some((a) => titleMatches(normalizeTitle(a), want));
}

/**
 * Select matching item: normalized title == TMDB original_name AND part == requested season.
 * nguonc original_name can be a comma-separated alias list → test each alias;
 * trailing text after title must be a season/part marker ("2nd Season", "Season 2", "4").
 * STRICT → season mismatch returns null. Non-strict falls back to matching title.
 */
export function pickItem(items, meta, season, strict = true) {
    const want = normalizeTitle(meta.originalName);
    let titleCandidate = null;
    for (const it of items || []) {
        if (!aliasMatches(it.original_name, want)) continue;
        const phan = parsePhan(it.name, it.slug);
        if (phan === season) return it;
        if (!titleCandidate) titleCandidate = it;
    }
    if (strict) return null;
    return titleCandidate;
}

/** Candidate slugs: Vietnamese name (priority) + EN original_name + EN name, with "-phan-N" for multi-season. */
export function slugCandidates(meta, season) {
    const names = [meta.nameVi, meta.originalName, meta.name].filter(Boolean);
    const base = [];
    names.forEach((t) => {
        const s = slugify(t);
        if (s && base.indexOf(s) === -1) base.push(s);
    });
    const out = [];
    base.forEach((b) => {
        out.push(b);
        if (season > 1) {
            out.push(`${b}-phan-${season}`);
            out.push(`${b}-season-${season}`);
        }
    });
    return out;
}

/** Fallback slug: fetch detail directly by candidate slugs when search misses. */
export async function fetchDetailBySlugCandidates(candidates, base = CONFIG.BASE_URL) {
    const seen = {};
    for (const slug of candidates) {
        if (!slug || seen[slug]) continue;
        seen[slug] = true;
        try {
            const detail = await fetchJson(`${base}/film/${slug}`);
            if (detail && detail.movie && detail.movie.name) {
                return { item: { name: detail.movie.name, slug }, movie: detail.movie };
            }
        } catch (e) { /* invalid slug → continue */ }
    }
    return null;
}

/** Extract {server, embed} entries for requested episode from movie detail (items: [{name, slug, embed}]). */
export function pickEpisodeEntries(movie, episode, season) {
    const out = [];
    const eps = Number(episode) || 0;
    for (const server of (movie && movie.episodes) || []) {
        const items = (server && server.items) || [];
        const entry = items.find((e) => matchEpisodeName(e, eps, season));
        if (entry) {
            out.push({ server: server.server_name || '', embed: entry.embed, entryName: entry.name });
        }
    }
    return out;
}

function matchEpisodeName(e, episode, season) {
    const name = String(e && e.name || '');
    if (name === String(episode)) return true;
    // First episode / movie: accept "1" or "Full" for episode <= 1 (season 1).
    if (episode <= 1 && season <= 1 && (name === '1' || /full/i.test(name))) return true;
    return false;
}

/** Base origin of embed URL (https://host). */
export function embedBase(url) {
    const m = /^(https?:\/\/[^/]+)/i.exec(String(url || ''));
    return m ? m[1] : null;
}

const embedHash = (url) => {
    const m = HASH_RE.exec(String(url || ''));
    return m ? m[1] : null;
};

/**
 * Resolve streamc.xyz embed → real HLS playlist (verified with live HTTP):
 *   1. POST embed.php?hash=... {action:"bootstrap", playlist_format:"hls", path_chunks:true}
 *      (requires Origin/Referer = embed origin; returns {"error":"wrong_origin"} otherwise).
 *   2. POST {action:"issue", bootstrap:<JWT>, turnstile_response:null, ...} → {playlist, expiresAt}.
 * Returned playlist URL lacks .m3u8 extension (long path) → stream MUST declare type: 'hls'.
 * Direct .m3u8 URLs are used directly without bootstrapping.
 */
export async function resolveEmbedPlaylist(embed) {
    const origin = embedBase(embed);
    if (!origin) throw new Error(`invalid embed: ${embed}`);
    if (/\.m3u8/i.test(embed) || !/embed\.php/i.test(embed)) {
        return { url: embed, origin };
    }
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: origin,
        Referer: `${origin}/`,
        'User-Agent': CONFIG.STREAM_UA,
    };
    const post = (body) => fetchJson(embed, { method: 'POST', headers, body: JSON.stringify(body) });

    const bs = await post({
        action: 'bootstrap',
        referrer: '',
        frame_origins: [origin],
        request_grant: true,
        playlist_format: 'hls',
        pretty_url: true,
        path_chunks: true,
    });
    if (!bs || !bs.bootstrap) throw new Error('bootstrap failed (streamc.xyz)');

    const issue = await post({
        action: 'issue',
        bootstrap: bs.bootstrap,
        turnstile_response: null,
        playlist_format: 'hls',
        pretty_url: true,
        path_chunks: true,
        frame_origins: [origin],
    });
    if (!issue || !issue.playlist) throw new Error('issue failed (streamc.xyz)');

    // Verify playlist: streamc returns plain "#EXTM3U" for playlist_format=hls;
    // "#ENC-AESGCM" (encrypted) cannot be parsed by player → drop stream.
    try {
        playlistText = await fetchText(issue.playlist, {
            headers: { Origin: origin, Referer: `${origin}/`, 'User-Agent': CONFIG.STREAM_UA, Accept: '*/*' },
        });
    } catch (e) {
        // Ignore verify errors — app will re-fetch.
    }
    if (playlistText && /^#ENC-/m.test(playlistText)) {
        throw new Error('playlist is encrypted (#ENC-AESGCM) — unplayable');
    }
    if (playlistText && !/^#EXTM3U/m.test(playlistText)) {
        throw new Error('returned playlist is not HLS');
    }

    return { url: issue.playlist, origin };
}

/** Entry point: TMDB → search nguonc (EN, fallback VI, fallback slug) → detail → bootstrap/issue. */
export async function extractStreams(tmdbId, mediaType, season, episode, options = {}) {
    if (mediaType !== 'movie' && mediaType !== 'tv') return [];
    const meta = await tmdbMeta(tmdbId, mediaType);
    const reqSeason = Number(season) > 0 ? Number(season) : 1;

    let items = await searchNguoncSafe(meta.originalName);
    let item = pickItem(items, meta, reqSeason, CONFIG.STRICT_SEASON);

    // EN search missed → try Vietnamese name from TMDB (language=vi).
    if (!item && meta.nameVi && meta.nameVi !== meta.originalName) {
        const viItems = await searchNguoncSafe(meta.nameVi);
        item = pickItem(viItems, meta, reqSeason, CONFIG.STRICT_SEASON);
    }

    if (item) {
        const detail = await fetchJson(`${CONFIG.BASE_URL}/film/${item.slug}`);
        return await buildStreams((detail && detail.movie) || {}, item, episode, reqSeason);
    }

    // Fallback slug: build slug candidates from name (EN or VI) and fetch detail directly.
    const slugHit = await fetchDetailBySlugCandidates(slugCandidates(meta, reqSeason));
    if (slugHit) {
        console.warn(`[Ngu\u1ed3nC] search missed, using slug fallback: ${slugHit.slug}`);
        return await buildStreams(slugHit.movie, slugHit.item, episode, reqSeason);
    }

    console.warn(`[Ngu\u1ed3nC] No "${meta.originalName}" season ${reqSeason} on nguonc.`);
    return [];
}

async function buildStreams(movie, item, episode, reqSeason) {
    const entries = pickEpisodeEntries(movie, episode, reqSeason);
    if (!entries.length) {
        console.warn(`[Ngu\u1ed3nC] ${item.name} (${item.slug}): missing episode ${episode}.`);
        return [];
    }
    const streams = [];
    for (const ent of entries) {
        try {
            const { url, origin } = await resolveEmbedPlaylist(ent.embed);
            // TOP-LEVEL headers: PluginRuntime.parseJsonResults only keeps whitelisted
            // item["headers"] and StreamFetchSupport maps them to proxyHeaders — storing
            // only in behaviorHints.proxyHeaders causes local runtime to drop them.
            const headers = {
                Referer: `${origin}/`,
                Origin: origin,
                'User-Agent': CONFIG.STREAM_UA,
                Accept: '*/*',
            };
            streams.push({
                name: CONFIG.PROVIDER_NAME,
                title: `${ent.server} · T\u1eadp ${ent.entryName}`,
                url,
                type: 'hls',
                headers,
                behaviorHints: {
                    proxyHeaders: { request: headers },
                    videoHash: embedHash(ent.embed),
                },
            });
        } catch (e) {
            console.warn(`[Ngu\u1ed3nC] ${item.name} E${episode} [${ent.server}]: ${e.message}`);
        }
    }
    return streams;
}