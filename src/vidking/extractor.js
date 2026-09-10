import { CONFIG } from './config.js';
import { fetchJson, fetchText } from './http.js';
import { decryptPayload } from './decrypt.js';

/** Cache seed (server TTL 30s → cache 25s để tránh seed-invalid khi retry). */
let seedCache = { value: null, at: 0 };

export function resetSeedCache() {
    seedCache = { value: null, at: 0 };
}

async function fetchSeed(mediaId) {
    const now = Date.now();
    if (seedCache.value && now - seedCache.at < CONFIG.SEED_TTL_MS) {
        return seedCache.value;
    }
    const json = await fetchJson(`${CONFIG.SPEED_API}/seed?mediaId=${encodeURIComponent(String(mediaId))}`);
    const seed = json && typeof json.seed === 'string' && json.seed.length ? json.seed : null;
    if (!seed) {
        throw new Error('seed rỗng từ SpeedRacelight');
    }
    seedCache = { value: seed, at: now };
    return seed;
}

/**
 * Metadata TMDB: title/name, year (YYYY), imdbId. App chỉ truyền tmdbId,
 * nên provider tự lấy title để gọi sources-with-title + subs.
 */
export async function tmdbMeta(tmdbId, mediaType) {
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const rawId = String(tmdbId || '').trim();
    const isImdb = /^tt\d+$/i.test(rawId);

    let info;
    if (isImdb) {
        // IMDB ID → resolve qua TMDB /3/find/ (giống nguonc/kkphim)
        const find = await fetchJson(
            `${CONFIG.TMDB_API_BASE}/find/${encodeURIComponent(rawId)}?external_source=imdb_id&api_key=${CONFIG.TMDB_API_KEY}`,
        );
        const list = type === 'tv' ? (find.tv_results || []) : (find.movie_results || []);
        info = list[0];
        if (!info) {
            console.warn(`[VidKing] TMDB find không có kết quả cho IMDB ${rawId}`);
            return { title: '', year: '', imdbId: rawId };
        }
    } else {
        info = await fetchJson(
            `${CONFIG.TMDB_API_BASE}/${type}/${encodeURIComponent(rawId)}`
            + `?api_key=${CONFIG.TMDB_API_KEY}&append_to_response=external_ids`,
        );
    }

    const tmdbNumericId = info.id ? Number(info.id) : 0;
    const title = type === 'movie' ? (info.title || info.original_title) : (info.name || info.original_name);
    const date = type === 'movie' ? info.release_date : info.first_air_date;
    const year = date ? String(date).slice(0, 4) : '';
    const imdbId = isImdb ? rawId : String((info.external_ids || {}).imdb_id || '');
    return {
        title: title ? String(title) : '',
        year,
        imdbId,
        tmdbNumericId,
    };
}

/** Nối URL sources-with-title (giữ nguyên thứ tự tham số như bundle). */
function buildSourcesUrl(meta, mediaType, season, episode, seed) {
    const tv = mediaType === 'tv';
    const qs = [
        `title=${encodeURIComponent(meta.title || '')}`,
        `mediaType=${tv ? 'tv' : 'movie'}`,
        `year=${encodeURIComponent(meta.year || '')}`,
        `episodeId=${episode ? Number(episode) : 1}`,
        `seasonId=${season ? Number(season) : 1}`,
        `tmdbId=${encodeURIComponent(String(meta.tmdbId || ''))}`,
        `imdbId=${encodeURIComponent(meta.imdbId || '0')}`,
        'enc=2',
        `seed=${encodeURIComponent(seed)}`,
        `_t=${Date.now()}`,
    ].join('&');
    return `${CONFIG.SPEED_API}/cdn/sources-with-title?${qs}`;
}

const SUB_HEADERS = { Referer: CONFIG.REFERER };

const SUB_PRIORITY = { vi: 0, vietnamese: 0, en: 1, english: 1 };

/** Lấy/dedupe VTT sub từ payload sources (gắn headers Referer vidking — 403 nếu thiếu). */
function subsFromPayload(payload) {
    const raw = (payload && Array.isArray(payload.subtitles)) ? payload.subtitles : [];
    const seen = new Set();
    const out = [];
    const ranked = raw.slice().sort((a, b) => {
        const al = String(a.language || a.lang || '').toLowerCase();
        const bl = String(b.language || b.lang || '').toLowerCase();
        const ap = SUB_PRIORITY[al] !== undefined ? SUB_PRIORITY[al] : 2;
        const bp = SUB_PRIORITY[bl] !== undefined ? SUB_PRIORITY[bl] : 2;
        return ap - bp || a.url.localeCompare(b.url);
    });
    for (const s of ranked) {
        if (!s || typeof s.url !== 'string' || !s.url) continue;
        if (seen.has(s.url)) continue;
        seen.add(s.url);
        out.push({
            url: s.url,
            language: s.language || s.lang || 'Unknown',
            name: s.language || s.lang || undefined,
            headers: CONFIG.REFERER ? SUB_HEADERS : undefined,
        });
        if (out.length >= CONFIG.MAX_SUBTITLES) break;
    }
    return out;
}

/** Fallback: subs.videasy.to (SRT từ OpenSubtitles, download public). */
async function subsFromVideasy(imdbId) {
    if (!imdbId) return [];
    try {
        const list = await fetchJson(`${CONFIG.SUBS_API}/search?id=${encodeURIComponent(imdbId)}`);
        if (!Array.isArray(list)) return [];
        const seen = new Set();
        const out = [];
        for (const s of list) {
            if (!s || typeof s.url !== 'string' || !s.url) continue;
            if (seen.has(s.url)) continue;
            seen.add(s.url);
            out.push({
                url: s.url,
                language: s.language || 'en',
                name: s.display || s.language || undefined,
            });
        }
        return out;
    } catch (e) {
        console.warn(`[VidKing] subs.videasy fallback lỗi: ${e && e.message ? e.message : String(e)}`);
        return [];
    }
}

/** Map JSON đã giải mã → các stream items (video + sub gắn vào từng item). */
export function toStreamItems(payload, meta) {
    const sources = (payload && Array.isArray(payload.sources)) ? payload.sources : [];
    if (!sources.length) return [];

    const subs = subsFromPayload(payload);

    const items = [];
    for (const s of sources) {
        if (!s || typeof s.url !== 'string' || !s.url) continue;
        const quality = s.quality || '';
        items.push({
            title: `VidKing [${quality}]`,
            name: quality ? `VidKing (${quality})` : 'VidKing',
            url: s.url,
            quality: (quality && quality !== 'Auto') ? quality : undefined,
            type: 'hls',
            headers: {}, // segment public — không cần headers chơi
            ...(subs.length ? { subtitles: subs } : {}),
        });
    }
    return items;
}

/**
 * Entry point: metadata TMDB → seed → sources → decrypt → items.
 * TV thiếu season/episode → [] (không có cách biết tập nào).
 */
export async function extractStreams(tmdbId, mediaType, season, episode) {
    if (!tmdbId) return [];
    const tv = mediaType === 'tv';
    if (tv && !season) return [];

    const meta = await tmdbMeta(tmdbId, mediaType);
    if (!meta.title) {
        console.warn(`[VidKing] TMDB không có title cho ${mediaType} ${tmdbId}`);
        return [];
    }
    // tmdbNumericId: TMDB int ID thực (resolve từ IMDB nếu cần — seed/sources phải dùng số, không phải "tt...")
    const numericId = meta.tmdbNumericId || tmdbId;
    meta.tmdbId = numericId;

    const seed = await fetchSeed(numericId);
    const url = buildSourcesUrl(meta, mediaType, season, episode, seed);

    let payload = null;
    try {
        const text = await fetchText(url);
        payload = decryptPayload(text, seed, numericId);
    } catch (e) {
        // seed-invalid (TTL 30s) hoặc bad payload → thử lại 1 lần với seed mới
        if (/decrypt failed|seed/.test(String(e && e.message))) {
            seedCache = { value: null, at: 0 };
            const seed2 = await fetchSeed(numericId);
            const text2 = await fetchText(buildSourcesUrl(meta, mediaType, season, episode, seed2));
            payload = decryptPayload(text2, seed2, numericId);
            // retry thành công → KHÔNG throw
        } else {
            throw e;
        }
    }

    let items = toStreamItems(payload, meta);

    // Payload không kèm sub (movie thường rỗng) → fallback OpenSubtitles qua subs.videasy.to
    if (items.length && !(payload && Array.isArray(payload.subtitles) && payload.subtitles.length) && meta.imdbId) {
        const subs = await subsFromVideasy(meta.imdbId);
        if (subs.length) {
            items = items.map((it) => ({ ...it, subtitles: subs.slice(0, CONFIG.MAX_SUBTITLES) }));
        }
    }

    return items;
}