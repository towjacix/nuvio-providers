import { CONFIG } from './config.js';
import { fetchJson, fetchText } from './http.js';

/** Cached base URL (domain changes rarely; tests reset via resetBaseUrlCache). */
let cachedBaseUrl = null;

export function resetBaseUrlCache() {
    cachedBaseUrl = null;
}

/** Normalize domain read from TXT (first line, trim trailing slash). */
export function normalizeBaseUrl(raw) {
    const m = String(raw || '').trim().match(/^https?:\/\/[^\s"'<>]+/);
    if (!m) return null;
    return m[0].replace(/\/+$/, '');
}

/**
 * Dynamically resolve base URL from bluphim.txt (kkphim pattern):
 * TXT yields live domain (currently https://freetube.com.mx). TXT error → BASE_URL;
 * probe failure → FALLBACK_BASE_URL.
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

    // Only cache when probe succeeds. On failure try fallback for THIS request,
    // but do NOT cache it (site often resets connections; next call must re-probe primary).
    try {
        await fetchText(base + '/');
        cachedBaseUrl = base;
        return base;
    } catch (e) {
        try {
            await fetchText(CONFIG.FALLBACK_BASE_URL + '/');
            return CONFIG.FALLBACK_BASE_URL;
        } catch (e2) {
            return base;
        }
    }
}

const IMDB_ID_RE = /^tt\d+$/i;

/** Keep numeric IDs as-is; resolve IMDB "tt..." via TMDB Find API. Throws on failure. */
export async function resolveTmdbId(tmdbId, mediaType) {
    const raw = String(tmdbId || '').trim();
    if (!raw) throw new Error('missing tmdbId');
    if (!IMDB_ID_RE.test(raw)) {
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n)) throw new Error(`invalid tmdbId: ${raw}`);
        return n;
    }
    const kind = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${CONFIG.TMDB_API_BASE}/find/${encodeURIComponent(raw)}` +
        `?api_key=${CONFIG.TMDB_API_KEY}&external_source=imdb_id`;
    const json = await fetchJson(url);
    const list = (json && Array.isArray(json[kind === 'tv' ? 'tv_results' : 'movie_results']))
        ? json[kind === 'tv' ? 'tv_results' : 'movie_results'] : [];
    if (!list.length || typeof list[0].id !== 'number') {
        throw new Error(`could not resolve IMDB ${raw}`);
    }
    return list[0].id;
}

/** TMDB metadata: original title, year, imdbId. */
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

/** Decode numeric (&#226;) and common named HTML entities in site titles. */
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
 * Parse search results → {href, name, year}.
 * True search hits live in `li.item` (div.name > span, no year).
 * `li.film-item-ver` is a "recent movies" widget at the bottom — fallback ONLY
 * (CS3 also scraped film-item-ver, but on the search page that is just a secondary list).
 * year: film-item-ver has .real-name; item does not → ''.
 */
export function parseSearchResults(html) {
    const src = String(html || '');
    const items = [];
    const seen = new Set();
    const push = (href, name, year, isResult) => {
        if (!href || seen.has(href)) return;
        seen.add(href);
        items.push({ href, name, year, isResult });
    };

    // 1) True results: <li class="item ..."> — "item" or "item" with extra class
    //    (grid appends "no-margin-left" each row; avoids matching menu-item/sub-menu-item).
    const itemRe = /<li[^>]*class="item(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = itemRe.exec(src)) !== null) {
        const block = m[1];
        const hrefM = block.match(/<a[^>]*href="(\/phim\/[^"]+)"/i);
        if (!hrefM) continue;
        const nameM = block.match(/<div[^>]*class="name"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i);
        const name = decodeEntities(nameM ? nameM[1].replace(/<[^>]+>/g, '').trim() : '').trim();
        if (name) push(hrefM[1], name, '', true);
    }

    // 2) Fallback: film-item-ver ("recent movies" widget / legacy layout) — isResult=false.
    const verRe = /<li[^>]*class="film-item-ver"[^>]*>([\s\S]*?)<\/li>/gi;
    while ((m = verRe.exec(src)) !== null) {
        const block = m[1];
        const hrefM = block.match(/<a[^>]*href="(\/phim\/[^"]+)"/i);
        if (!hrefM) continue;
        const nameM = block.match(/<p[^>]*class="name"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
        const yearM = block.match(/<p[^>]*class="real-name"[^>]*>([\s\S]*?)<\/p>/i);
        const name = decodeEntities(nameM ? nameM[1].replace(/<[^>]+>/g, '').trim() : '').trim();
        const yearRaw = decodeEntities(yearM ? yearM[1].replace(/<[^>]+>/g, '').trim() : '').trim();
        const year = /^\d{4}$/.test(yearRaw) ? yearRaw : '';
        if (name) push(hrefM[1], name, year, false);
    }
    return items;
}

/** Extract imdb.com/title/tt... from detail page. */
export function parseDetailImdb(html) {
    const m = String(html || '').match(/imdb\.com\/title\/(tt\d+)/i);
    return m ? m[1] : '';
}

/** First watch link: a[href^=/xem-phim/]. */
export function parseWatchHref(html) {
    const m = String(html || '').match(/href="(\/xem-phim\/[^"]+)"/i);
    return m ? m[1] : '';
}

/** Player iframe: iframe#iframeStream[src] (entity &amp; → &). */
export function parseIframeSrc(html) {
    const m = String(html || '').match(/<iframe[^>]*id="iframeStream"[^>]*src="([^"]+)"/i)
        || String(html || '').match(/<iframe[^>]*src="([^"]+)"[^>]*id="iframeStream"/i);
    if (!m) return '';
    return decodeEntities(m[1]).replace(/&amp;/g, '&');
}

/** Nested iframe inside embed page (embedIframe → streaming3rd). */
export function parseNestedIframeSrc(html) {
    const m = String(html || '').match(/<iframe[^>]*src='([^']+)'/i)
        || String(html || '').match(/<iframe[^>]*src="([^"]+streaming[^"]*)"/i);
    return m ? m[1].replace(/&amp;/g, '&') : '';
}

/** Extract m3u8 URL from streaming page: var url = '...m3u8'. */
export function parseStreamUrl(html) {
    const m = String(html || '').match(/var\s+url\s*=\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i)
        || String(html || '').match(/(https?:\/\/[^'"\\\s]+\.m3u8[^'"\\\s]*)/i);
    return m ? m[1] : '';
}

const TITLE_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'vs']);

/** Match score between slug and TMDB title (site search returns broad noise; rank before verify). */
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

/** Highest stream resolution from master playlist (2160p/1080p/720p/480p). */
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


/** Site search breaks on punctuation (e.g. "Avengers: Endgame" returns noise): keep only alphanumeric and whitespace. */
export function searchKeyword(title) {
    return String(title || '').replace(/[^a-zA-Z0-9\u00C0-\u1EF9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function pickCandidate(base, candidates, meta) {
    if (!candidates.length) return null;
    // isResult (li.item = true hit) +3 — sidebar film-item-ver matching year reaches at most 2.
    const score = (c) => (c.isResult ? 3 : 0) + slugScore(c.href, meta.title)
        + (meta.year && c.year === meta.year ? 2 : 0);
    const ranked = candidates
        .map((c) => ({ c, score: score(c) }))
        .sort((a, b) => b.score - a.score)
        .map((x) => x.c);
    // Pure noise (no candidate matches slug or year) → drop early to avoid wasted verification.
    if (ranked.length && score(ranked[0]) === 0) return null;
    const ordered = ranked.slice(0, CONFIG.MAX_VERIFY_CANDIDATES);

    if (meta.imdbId) {
        for (const c of ordered) {
            try {
                const detail = await fetchText(base + c.href);
                const imdb = parseDetailImdb(detail);
                if (imdb && meta.imdbId && imdb.toLowerCase() === meta.imdbId.toLowerCase()) {
                    return c;
                }
            } catch (e) { /* try next candidate */ }
        }
        return null;
    }
    return ordered[0] || null;
}


/** Follow embed chain (up to 2 hops) to the page hosting var url m3u8. */
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
 * TV requires episode number; returns [] if missing.
 */
export async function extractStreams(tmdbId, mediaType, season, episode) {
    if (!tmdbId) return [];
    const tv = mediaType === 'tv';
    if (tv && (episode === undefined || episode === null || episode === '')) return [];

    const base = await resolveBaseUrl();
    const numericId = await resolveTmdbId(tmdbId, mediaType);
    const meta = await tmdbMeta(numericId, mediaType);
    if (!meta.title) {
        console.warn(`[BluPhim] TMDB has no title for ${mediaType} ${tmdbId}`);
        return [];
    }

    // Site search often returns "recent updates" instead of query hits — retry up to 3 times
    // if no candidates returned, or none match slug/year against meta.
    let candidates = [];
    const maxScore = (list) => list.reduce((m, c) => {
        const s = (c.isResult ? 3 : 0) + slugScore(c.href, meta.title)
            + (meta.year && c.year === meta.year ? 2 : 0);
        return s > m ? s : m;
    }, 0);
    for (let attempt = 0; attempt < 3; attempt++) {
        const searchHtml = await fetchText(
            `${base}/search?k=${encodeURIComponent(searchKeyword(meta.title))}`
        );
        candidates = parseSearchResults(searchHtml);
        if (candidates.length && (attempt === 2 || maxScore(candidates) > 0)) break;
    }
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

    let watchHtml = await fetchText(watchUrl);
    let iframeSrc = parseIframeSrc(watchHtml);
    // Default server = moviking /embed (FingerprintJS + WebGL + anti-devtools — cannot replicate
    // in quickjs). Server 3rd = /embed3rd (no fingerprint) via ?sv2=true. Only force sv2 when
    // iframe is bare /embed.
    if (/\/embed\?/i.test(iframeSrc) && !/embed3rd/i.test(iframeSrc)) {
        const sv2 = `${watchUrl}${watchUrl.includes('?') ? '&' : '?'}sv2=true`;
        try {
            const html2 = await fetchText(sv2);
            const src2 = parseIframeSrc(html2);
            if (src2) { watchHtml = html2; iframeSrc = src2; }
        } catch (e) { /* keep default server */ }
    }
    if (!iframeSrc) return [];

    const streamUrl = await resolveEmbedStream(iframeSrc, watchUrl);

    let quality = '';
    try {
        const master = await fetchText(streamUrl, { headers: { Referer: watchUrl } });
        quality = parseQuality(master);
    } catch (e) { /* keep stream, drop quality tag */ }

    // Public m3u8/segment host (verified 200 without Referer) → omit headers.
    const label = quality ? `BluPhim [${quality}]` : 'BluPhim [Auto]';
    return [{
        title: label,
        name: quality ? `BluPhim (${quality})` : 'BluPhim',
        url: streamUrl,
        quality: quality && quality !== 'Auto' ? quality : undefined,
        type: 'hls',
    }];
}
