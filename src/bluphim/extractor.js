import { CONFIG } from './config.js';
import { fetchJson, fetchText } from './http.js';

/** Cache base URL (domain đổi hiếm; test reset qua resetBaseUrlCache). */
let cachedBaseUrl = null;

export function resetBaseUrlCache() {
    cachedBaseUrl = null;
}

/** Chuẩn hoá domain lấy từ TXT (dòng đầu, trim slash). */
export function normalizeBaseUrl(raw) {
    const m = String(raw || '').trim().match(/^https?:\/\/[^\s"'<>]+/);
    if (!m) return null;
    return m[0].replace(/\/+$/, '');
}

/**
 * Resolve base URL động từ bluphim.txt (pattern kkphim):
 * TXT trả domain live (hiện = https://freetube.com.mx). TXT lỗi → BASE_URL,
 * probe fail → FALLBACK_BASE_URL.
 */
export async function resolveBaseUrl() {
    if (cachedBaseUrl) return cachedBaseUrl;

    let base = null;
    try {
        const txt = await fetchText(CONFIG.DOMAIN_TXT_URL);
        base = normalizeBaseUrl(txt);
    } catch (e) {
        base = null;
    }
    if (!base) base = CONFIG.BASE_URL;

    try {
        await fetchText(base + '/');
        cachedBaseUrl = base;
        return base;
    } catch (e) {
        cachedBaseUrl = CONFIG.FALLBACK_BASE_URL;
        return cachedBaseUrl;
    }
}

const IMDB_ID_RE = /^tt\d+$/i;

/** Số nguyên giữ nguyên; IMDB "tt..." → TMDB Find API. throw nếu không resolve được. */
export async function resolveTmdbId(tmdbId, mediaType) {
    const raw = String(tmdbId || '').trim();
    if (!raw) throw new Error('thiếu tmdbId');
    if (!IMDB_ID_RE.test(raw)) {
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n)) throw new Error(`tmdbId lạ: ${raw}`);
        return n;
    }
    const kind = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${CONFIG.TMDB_API_BASE}/find/${encodeURIComponent(raw)}` +
        `?api_key=${CONFIG.TMDB_API_KEY}&external_source=imdb_id`;
    const json = await fetchJson(url);
    const list = (json && Array.isArray(json[kind === 'tv' ? 'tv_results' : 'movie_results']))
        ? json[kind === 'tv' ? 'tv_results' : 'movie_results'] : [];
    if (!list.length || typeof list[0].id !== 'number') {
        throw new Error(`không resolve được IMDB ${raw}`);
    }
    return list[0].id;
}

/** Metadata TMDB: title gốc, năm, imdbId. */
export async function tmdbMeta(numericId, mediaType) {
    const kind = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${CONFIG.TMDB_API_BASE}/${kind}/${numericId}` +
        `?api_key=${CONFIG.TMDB_API_KEY}&language=en-US&append_to_response=external_ids`;
    const json = await fetchJson(url);
    const title = json && (json.title || json.name) ? String(json.title || json.name) : '';
    const dateStr = String((json && (json.release_date || json.first_air_date)) || '');
    const year = /^\d{4}/.test(dateStr) ? dateStr.slice(0, 4) : '';
    const imdbId = json && json.external_ids && typeof json.external_ids.imdb_id === 'string'
        ? json.external_ids.imdb_id : '';
    return { title, year, imdbId };
}

/** Decode HTML entities số (&#226;) + vài named cơ bản trong title site. */
export function decodeEntities(s) {
    return String(s || '')
        .replace(/&#(\d+);/g, (_, code) => {
            const n = parseInt(code, 10);
            return Number.isFinite(n) ? String.fromCharCode(n) : _;
        })
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/**
 * Parse kết quả search: li.film-item-ver → {href, name, year}.
 * .real-name chứa năm (vd "2026").
 */
export function parseSearchResults(html) {
    const items = [];
    const seen = new Set();
    const liRe = /<li[^>]*class="film-item-ver"[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = liRe.exec(html)) !== null) {
        const block = m[1];
        const hrefM = block.match(/<a[^>]*href="(\/phim\/[^"]+)"/i);
        if (!hrefM) continue;
        const href = hrefM[1];
        if (seen.has(href)) continue;
        seen.add(href);
        const nameM = block.match(/<p[^>]*class="name"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
        const yearM = block.match(/<p[^>]*class="real-name"[^>]*>([\s\S]*?)<\/p>/i);
        const name = decodeEntities(nameM ? nameM[1].replace(/<[^>]+>/g, '').trim() : '').trim();
        const yearRaw = decodeEntities(yearM ? yearM[1].replace(/<[^>]+>/g, '').trim() : '').trim();
        const year = /^\d{4}$/.test(yearRaw) ? yearRaw : '';
        if (!name) continue;
        items.push({ href, name, year });
    }
    return items;
}

/** imdb.com/title/tt... trong trang detail. */
export function parseDetailImdb(html) {
    const m = String(html || '').match(/imdb\.com\/title\/(tt\d+)/i);
    return m ? m[1] : '';
}

/** Link xem phim đầu tiên: a[href^=/xem-phim/]. */
export function parseWatchHref(html) {
    const m = String(html || '').match(/href="(\/xem-phim\/[^"]+)"/i);
    return m ? m[1] : '';
}

/** Iframe player: iframe#iframeStream[src] (entity &amp; → &). */
export function parseIframeSrc(html) {
    const m = String(html || '').match(/<iframe[^>]*id="iframeStream"[^>]*src="([^"]+)"/i)
        || String(html || '').match(/<iframe[^>]*src="([^"]+)"[^>]*id="iframeStream"/i);
    if (!m) return '';
    return decodeEntities(m[1]).replace(/&amp;/g, '&');
}

/** Iframe lồng nhau trong trang embed (embedIframe → streaming3rd). */
export function parseNestedIframeSrc(html) {
    const m = String(html || '').match(/<iframe[^>]*src='([^']+)'/i)
        || String(html || '').match(/<iframe[^>]*src="([^"]+streaming[^"]*)"/i);
    return m ? m[1].replace(/&amp;/g, '&') : '';
}

/** URL m3u8 trong trang streaming: var url = '...m3u8'. */
export function parseStreamUrl(html) {
    const m = String(html || '').match(/var\s+url\s*=\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i)
        || String(html || '').match(/(https?:\/\/[^'"\\\s]+\.m3u8[^'"\\\s]*)/i);
    return m ? m[1] : '';
}

const TITLE_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'vs']);

/** Điểm khớp slug với title TMDB (site search trả lan man, cần xếp hạng trước khi verify). */
export function slugScore(href, title) {
    const slugM = String(href || '').match(/\/phim\/([a-z0-9-]+?)(?:-\d+)?$/i);
    if (!slugM) return 0;
    const slugWords = new Set(slugM[1].toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
    const titleWords = String(title || '').toLowerCase().split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w));
    let score = 0;
    for (const w of titleWords) {
        if (slugWords.has(w)) score += 1;
    }
    return score;
}

/** Chất lượng từ master playlist (RESOLUTION cao nhất → 2160p/1080p/720p/480p). */
export function parseQuality(masterText) {
    let maxH = 0;
    const re = /RESOLUTION=\d+x(\d+)/gi;
    let m;
    while ((m = re.exec(String(masterText || ''))) !== null) {
        const h = parseInt(m[1], 10);
        if (Number.isFinite(h) && h > maxH) maxH = h;
    }
    if (maxH >= 2000) return '2160p';
    if (maxH >= 1000) return '1080p';
    if (maxH >= 700) return '720p';
    if (maxH > 0) return '480p';
    return '';
}


/** Site search gãy với dấu câu (vd "Avengers: Endgame" → trả rác): chỉ giữ chữ/số/khoảng trắng. */
export function searchKeyword(title) {
    return String(title || '').replace(/[^a-zA-Z0-9À-ỹ\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function pickCandidate(base, candidates, meta) {
    if (!candidates.length) return null;
    const ranked = candidates
        .map((c) => ({
            c,
            score: slugScore(c.href, meta.title) + (meta.year && c.year === meta.year ? 2 : 0),
        }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.c);
    // Không có dấu hiệu khớp nào (slug 0 điểm + lệch năm) → bỏ, tránh verify vô ích.
    if (ranked.length && slugScore(ranked[0].href, meta.title) === 0
        && !(meta.year && ranked[0].year === meta.year)) {
        const anyYear = candidates.some((c) => meta.year && c.year === meta.year);
        if (!anyYear) return null;
    }
    const ordered = ranked.slice(0, CONFIG.MAX_VERIFY_CANDIDATES);

    if (meta.imdbId) {
        for (const c of ordered) {
            try {
                const detail = await fetchText(base + c.href);
                const imdb = parseDetailImdb(detail);
                if (imdb && meta.imdbId && imdb.toLowerCase() === meta.imdbId.toLowerCase()) {
                    return c;
                }
            } catch (e) { /* thử ứng viên tiếp */ }
        }
        return null;
    }
    return ordered[0] || null;
}


/** Theo chuỗi embed (tối đa 2 hop) tới trang chứa var url m3u8. */
export async function resolveEmbedStream(iframeSrc, referer) {
    let html = await fetchText(iframeSrc, { headers: { Referer: referer } });
    for (let hop = 0; hop < 2; hop += 1) {
        const direct = parseStreamUrl(html);
        if (direct) return direct;
        const nested = parseNestedIframeSrc(html);
        if (!nested) return '';
        // eslint-disable-next-line no-await-in-loop
        html = await fetchText(nested, { headers: { Referer: iframeSrc } });
        iframeSrc = nested;
    }
    return parseStreamUrl(html);
}

/**
 * Entry point: TMDB meta → site search → verify imdb → watch → embed → m3u8.
 * TV thiếu episode → [] (không biết tập nào).
 */
export async function extractStreams(tmdbId, mediaType, season, episode) {
    if (!tmdbId) return [];
    const tv = mediaType === 'tv';
    if (tv && (episode === undefined || episode === null || episode === '')) return [];

    const base = await resolveBaseUrl();
    const numericId = await resolveTmdbId(tmdbId, mediaType);
    const meta = await tmdbMeta(numericId, mediaType);
    if (!meta.title) {
        console.warn(`[BluPhim] TMDB không có title cho ${mediaType} ${tmdbId}`);
        return [];
    }

    const searchHtml = await fetchText(`${base}/search?k=${encodeURIComponent(searchKeyword(meta.title))}`);
    const candidates = parseSearchResults(searchHtml);
    if (!candidates.length) return [];

    const picked = await pickCandidate(base, candidates, meta);
    if (!picked) return [];

    const detailHtml = await fetchText(base + picked.href);
    const watchHref = parseWatchHref(detailHtml);
    if (!watchHref) return [];

    let watchUrl = base + watchHref;
    if (tv) {
        const ep = parseInt(episode, 10);
        if (!Number.isFinite(ep) || ep < 1) return [];
        watchUrl = `${base + watchHref}/tap-${ep}`;
    }

    const watchHtml = await fetchText(watchUrl);
    const iframeSrc = parseIframeSrc(watchHtml);
    if (!iframeSrc) return [];

    const streamUrl = await resolveEmbedStream(iframeSrc, watchUrl);
    if (!streamUrl) return [];

    let quality = '';
    try {
        const master = await fetchText(streamUrl, { headers: { Referer: watchUrl } });
        quality = parseQuality(master);
    } catch (e) { /* giữ item, bỏ quality */ }

    // Host m3u8/segment public (verify 200 không Referer) → không gắn headers.
    const label = quality ? `BluPhim [${quality}]` : 'BluPhim [Auto]';
    return [{
        title: label,
        name: quality ? `BluPhim (${quality})` : 'BluPhim',
        url: streamUrl,
        quality: quality && quality !== 'Auto' ? quality : undefined,
        type: 'hls',
    }];
}
