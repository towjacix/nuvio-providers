import { CONFIG } from './config.js';
import { fetchText, fetchJson, fetchDoc, postForm } from './http.js';
import { extractAvsToken, processEncryptedM3u8 } from './decrypt.js';

let cachedBaseUrl = null;
export function resetBaseUrlCache() {
    cachedBaseUrl = null;
}

const decodeEntities = (s) => String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');

/**
 * Base URL: fetch ENTRY_URL (shortlink) lấy origin cuối cùng như CS3 getBaseUrl.
 * CS3 cũng có fallback "https://animevietsub.site" — domain hiện live là .li
 * (xác nhận từ bit.ly). Cache chỉ khi resolve được.
 */
export async function resolveBaseUrl() {
    if (cachedBaseUrl) return cachedBaseUrl;
    try {
        const r = await fetch(CONFIG.ENTRY_URL, {
            redirect: 'follow',
            headers: CONFIG.HEADERS,
        });
        const finalUrl = r && r.url ? r.url : '';
        if (finalUrl.startsWith('http') && !finalUrl.includes('bit.ly')) {
            const u = new URL(finalUrl);
            cachedBaseUrl = `${u.protocol}//${u.host}`;
            return cachedBaseUrl;
        }
    } catch (e) {
        // entry fail → thử fallback trực tiếp
    }
    try {
        await fetchText(CONFIG.FALLBACK_BASE_URL + '/');
        cachedBaseUrl = CONFIG.FALLBACK_BASE_URL;
        return cachedBaseUrl;
    } catch (e) {
        try {
            await fetchText(CONFIG.LEGACY_FALLBACK + '/');
            cachedBaseUrl = CONFIG.LEGACY_FALLBACK;
            return cachedBaseUrl;
        } catch (e2) {
            cachedBaseUrl = CONFIG.FALLBACK_BASE_URL; // site CF — cứ trả, request sau tự fail
            return cachedBaseUrl;
        }
    }
}

const IMDB_ID_RE = /^tt\d+$/i;

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
    const hit = (kind === 'tv' ? json.tv_results : json.movie_results) || [];
    if (!hit.length || !hit[0].id) throw new Error(`không resolve được imdb ${raw}`);
    return hit[0].id;
}

export async function tmdbMeta(numericId, mediaType) {
    const kind = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `${CONFIG.TMDB_API_BASE}/${kind}/${numericId}` +
        `?api_key=${CONFIG.TMDB_API_KEY}&append_to_response=external_ids`;
    const json = await fetchJson(url);
    const title = json && (json.title || json.name) ? String(json.title || json.name) : '';
    const orig = json && (json.original_title || json.original_name)
        ? String(json.original_title || json.original_name) : '';
    const dateStr = String((json && (json.release_date || json.first_air_date)) || '');
    const year = /^\d{4}/.test(dateStr) ? dateStr.slice(0, 4) : '';
    const imdbId = json && json.external_ids && typeof json.external_ids.imdb_id === 'string'
        ? json.external_ids.imdb_id : '';
    return { title, originalTitle: orig, year, imdbId };
}

// ---------- search ----------

const stripTags = (s) => decodeEntities(String(s || '').replace(/<[^>]+>/g, '').trim());

/** POST /ajax/suggest → [{title, href}]. HTML fragment trong response. */
export async function searchSuggest(base, query) {
    const html = await postForm(`${base}/ajax/suggest`, { ajaxSearch: '1', keysearch: query }, base + '/');
    const items = [];
    const liRe = /<li[\s>]([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = liRe.exec(html)) !== null) {
        const block = m[1];
        if (/ss-bottom/.test(block)) continue;
        const hrefM = block.match(/<a[^>]*class="thumb"[^>]*href="([^"]+)"/i)
            || block.match(/<a[^>]*href="([^"]+)"[^>]*class="thumb"/i);
        if (!hrefM) continue;
        const titleM = block.match(/class="ss-title"[^>]*>([\s\S]*?)<\//i);
        const title = stripTags(titleM ? titleM[1] : '');
        if (!title) continue;
        let href = hrefM[1];
        if (href.startsWith('/')) href = base + href;
        items.push({ title, href });
    }
    return items;
}

/** GET /tim-kiem/{q}/ → ul.MovieList li.TPostMv → [{title, href}] (fallback). */
export function parseSearchPage(html, base) {
    const items = [];
    const liRe = /<li[^>]*class="[^"]*TPostMv[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = liRe.exec(html)) !== null) {
        const block = m[1];
        const hrefM = block.match(/<a[^>]*href="([^"]+)"/i);
        const titleM = block.match(/<h2[^>]*class="[^"]*Title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)
            || block.match(/class="[^"]*Title[^"]*"[^>]*>([\s\S]*?)<\//i);
        if (!hrefM || !titleM) continue;
        const title = stripTags(titleM[1]);
        if (!title) continue;
        let href = hrefM[1];
        if (href.startsWith('/')) href = base + href;
        items.push({ title, href });
    }
    return items;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9à-ỹ]+/g, ' ').trim();
const slugOf = (href) => {
    const m = String(href || '').match(/\/([a-z0-9-]+?)(?:\.html)?\/?$/i);
    return m ? m[1].replace(/-/g, ' ') : '';
};

/** Chọn candidate: khớp title gốc/original TMDB với title site hoặc slug href (token subset). */
export function pickCandidate(candidates, meta) {
    if (!candidates.length) return null;
    const wantTitles = [meta.title, meta.originalTitle].filter(Boolean).map(norm);
    for (const c of candidates) {
        const hay = `${norm(c.title)} ${slugOf(c.href)}`;
        for (const t of wantTitles) {
            if (!t) continue;
            const tokens = t.split(' ').filter((w) => w.length > 1);
            if (!tokens.length) continue;
            if (tokens.every((w) => hay.includes(w))) return c;
        }
    }
    return null;
}

// ---------- episodes / servers ----------

/**
 * Watch page → {epNum: [{groupName, hash, id, href}]}.
 * Selector CS3: div.server-group (h3.server-name) × a.btn-episode[data-hash,data-id];
 * fallback flat .list-episode a.
 */
export function parseEpisodeServers(html) {
    const map = new Map();
    const addEp = (epNum, groupName, hash, id, href) => {
        if (!hash) return;
        const key = String(epNum || '').trim();
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ groupName: groupName || 'VIP', hash, id: id || '', href: href || '' });
    };

    // 1) server-group → per-server episode buttons
    const groupRe = /<div[^>]*class="[^"]*server-group[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*server-group|$)/gi;
    let gm;
    let sawGroup = false;
    while ((gm = groupRe.exec(html)) !== null) {
        sawGroup = true;
        const block = gm[1];
        const gNameM = block.match(/<h3[^>]*class="[^"]*server-(?:name|title)[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
        const groupName = gNameM ? stripTags(gNameM[1]) : 'VIP';
        const aRe = /<a\b([^>]*class="[^"]*btn-episode[^"]*"[^>]*)>/gi;
        let am;
        while ((am = aRe.exec(block)) !== null) {
            const attrs = am[1];
            const hash = (attrs.match(/data-hash="([^"]*)"/i) || [])[1] || '';
            const id = (attrs.match(/data-id="([^"]*)"/i) || [])[1] || '';
            const href = (attrs.match(/href="([^"]*)"/i) || [])[1] || '';
            const titleM = attrs.match(/title="([^"]*)"/i);
            // text sau thẻ mở — tìm đóng </a> gần nhất
            const rest = block.slice(am.index + am[0].length);
            const closeIdx = rest.indexOf('</a>');
            const inner = closeIdx >= 0 ? rest.slice(0, closeIdx) : '';
            const epNum = (titleM ? titleM[1] : stripTags(inner)) || stripTags(inner);
            addEp(epNum, groupName, hash, id, href);
        }
    }

    // 2) fallback: flat .list-episode a (không group)
    if (!sawGroup || map.size === 0) {
        const aRe = /<a\b([^>]*href="[^"]*"[^>]*data-hash="[^"]*"[^>]*)>|<a\b([^>]*data-hash="[^"]*"[^>]*href="[^"]*"[^>]*)>/gi;
        let am;
        while ((am = aRe.exec(html)) !== null) {
            const attrs = am[1] || am[2] || '';
            const hash = (attrs.match(/data-hash="([^"]*)"/i) || [])[1] || '';
            const id = (attrs.match(/data-id="([^"]*)"/i) || [])[1] || '';
            const href = (attrs.match(/href="([^"]*)"/i) || [])[1] || '';
            const titleM = attrs.match(/title="([^"]*)"/i);
            const rest = html.slice(am.index + am[0].length);
            const closeIdx = rest.indexOf('</a>');
            const inner = closeIdx >= 0 ? rest.slice(0, closeIdx) : '';
            const epNum = (titleM ? titleM[1] : stripTags(inner)) || stripTags(inner);
            addEp(epNum, 'VIP', hash, id, href);
        }
    }
    return map;
}

const EP_NUM_RE = /\d+([.,]\d+)?/g;

/** epName (title/text nút tập) → số; lấy số CUỐI như CS3 (vd "Tập 12 Full" → 12). */
function epNumberOf(epName) {
    const matches = String(epName || '').match(EP_NUM_RE);
    if (!matches || !matches.length) return null;
    return parseFloat(matches[matches.length - 1].replace(',', '.'));
}

/** Watch href của phim → url trang xem (CS3: href đã là xem-phim.html hoặc info → +/xem-phim.html). */
function toWatchUrl(base, href) {
    let u = String(href || '');
    if (u.startsWith('/')) u = base + u;
    if (u.includes('xem-phim.html')) return u;
    return u.replace(/\/$/, '') + '/xem-phim.html';
}

/**
 * POST /ajax/player per server → link.
 * Trả [{groupName, url, isGoogleCdn, playTech}].
 */
export async function resolveServers(base, servers, referer) {
    const out = [];
    for (const s of servers.slice(0, CONFIG.MAX_SERVERS)) {
        try {
            const text = await postForm(`${base}/ajax/player`, { link: s.hash, id: s.id }, referer);
            let json;
            try { json = JSON.parse(text); } catch (e) { continue; }
            const link = json && json.link ? String(json.link) : '';
            const playTech = json && json.playTech ? String(json.playTech) : '';
            if (!link) continue;
            out.push({
                groupName: s.groupName,
                url: link,
                playTech,
                isGoogleCdn: playTech === 'iframe' && link.includes('googleapiscdn.com'),
            });
        } catch (e) { /* server tiếp */ }
    }
    return out;
}

/**
 * Nhánh googleapiscdn: player page → avsToken → playlist encrypted → processEncryptedM3u8.
 * KẾT QUẢ KHÔNG DELIVER được (Nuvio stream item chỉ nhận URL; playlist đã giải
 * chỉ tồn tại trong interceptor của CS3). Giữ hàm để test + nếu sau này app có
 * cơ chế inject playlist thì bật lại.
 */
export async function decryptGoogleApisCdn(playerUrl, referer) {
    const hashM = playerUrl.match(/\/player\/([0-9a-f]+)/);
    const baseM = playerUrl.match(/^(https?:\/\/[^/]+)/);
    if (!hashM || !baseM) return null;
    const videoHash = hashM[1];
    const cdnBase = baseM[1];
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const { text: html } = await fetchDoc(playerUrl, referer);
            const avsToken = extractAvsToken(html);
            if (!avsToken) continue;
            const m3u8Url = `${cdnBase}/playlist/${videoHash}/playlist.m3u8?token=${encodeURIComponent(avsToken)}`;
            const resp = await fetch(m3u8Url, { headers: { Referer: playerUrl } });
            if (!resp || !resp.ok) continue;
            const body = await resp.text();
            const headers = {};
            if (resp.headers && typeof resp.headers.forEach === 'function') {
                resp.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
            }
            const text = processEncryptedM3u8(body, headers, avsToken);
            if (text) return { url: m3u8Url, text };
        } catch (e) { /* thử lại */ }
    }
    return null;
}

// ---------- entry point ----------

export async function extractStreams(tmdbId, mediaType, season, episode) {
    if (!tmdbId) return [];
    const tv = mediaType === 'tv';
    if (tv && (episode === undefined || episode === null || episode === '')) return [];

    const base = await resolveBaseUrl();
    const numericId = await resolveTmdbId(tmdbId, mediaType);
    const meta = await tmdbMeta(numericId, mediaType);
    if (!meta.title) {
        console.warn(`[AnimeVietSub] TMDB không có title cho ${mediaType} ${tmdbId}`);
        return [];
    }

    // Search: suggest trước (nhanh, theo CS3), rỗng → trang tim-kiem.
    let candidates = [];
    const queries = [meta.title, meta.originalTitle].filter(Boolean);
    for (const q of queries) {
        try {
            candidates = await searchSuggest(base, q);
        } catch (e) { candidates = []; }
        if (candidates.length) break;
    }
    if (!candidates.length) {
        for (const q of queries) {
            try {
                const { text } = await fetchDoc(`${base}/tim-kiem/${encodeURIComponent(q)}/`, base + '/');
                candidates = parseSearchPage(text, base);
            } catch (e) { candidates = []; }
            if (candidates.length) break;
        }
    }
    if (!candidates.length) return [];

    const picked = pickCandidate(candidates, meta);
    if (!picked) return [];

    const watchUrl = toWatchUrl(base, picked.href);
    const { text: watchHtml } = await fetchDoc(watchUrl, base + '/');
    const epMap = parseEpisodeServers(watchHtml);
    if (!epMap.size) return [];

    // Chọn tập: so khớp epNumber(title/text) với episode yêu cầu; movie → entry đầu.
    let servers = null;
    if (tv) {
        const want = parseFloat(episode);
        for (const [epName, list] of epMap) {
            const n = epNumberOf(epName);
            if (n !== null && Math.abs(n - want) < 0.001) { servers = list; break; }
        }
    } else {
        // Movie: ưu tiên epName có "Full"/"Hoàn tất", không thì entry đầu
        for (const [epName, list] of epMap) {
            if (/full|ho[aà]n t[aấ]t|tap full/i.test(epName)) { servers = list; break; }
        }
        if (!servers) servers = epMap.values().next().value;
    }
    if (!servers || !servers.length) return [];

    const links = await resolveServers(base, servers, watchUrl);
    const items = [];
    const seen = new Set();
    for (const l of links) {
        if (l.isGoogleCdn) {
            // Nhánh decrypt: playlist sau giải mã không có URL riêng → không emit.
            // (processEncryptedM3u8 đã port trong decrypt.js; bật lại khi app hỗ trợ.)
            continue;
        }
        if (!/^https?:/i.test(l.url)) continue;
        if (seen.has(l.url)) continue;
        seen.add(l.url);
        const isHls = l.url.includes('.m3u8');
        items.push({
            title: `AnimeVietSub [${l.groupName}]`,
            name: `AnimeVietSub (${l.groupName})`,
            url: l.url,
            type: isHls ? 'hls' : undefined,
            headers: { Referer: base + '/', 'User-Agent': CONFIG.HEADERS['User-Agent'] },
        });
    }
    return items;
}
