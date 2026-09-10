import { CONFIG } from './config.js';
import { fetchJson, fetchText } from './http.js';

let cachedBaseUrl = null;

/** Bỏ suffix /v1/api để về root legacy endpoint. */
export function normalizeBaseUrl(raw) {
    const m = String(raw || '').trim().match(/^https?:\/\/[^\s]+/);
    if (!m) return null;
    return m[0].replace(/\/+$/, '').replace(/\/v1\/api$/i, '');
}

/**
 * Resolve base URL động từ TXT; TXT lỗi hoặc base mới probe fail → fallback BASE_URL.
 * Probe chỉ chạy khi TXT trả domain khác hardcode (nếu bằng thì skip → 0 extra request).
 */
export async function resolveBaseUrl() {
    if (cachedBaseUrl) return cachedBaseUrl;

    let base = null;
    try {
        base = normalizeBaseUrl(await fetchText(CONFIG.DOMAIN_TXT_URL));
    } catch (e) { /* fallback hardcode */ }
    if (!base) base = CONFIG.BASE_URL;

    if (base === CONFIG.BASE_URL) {
        cachedBaseUrl = base;
        return base;
    }

    try {
        await fetchJson(`${base}/tim-kiem?keyword=phim`);
        cachedBaseUrl = base;
    } catch (e) {
        cachedBaseUrl = CONFIG.BASE_URL;
    }
    return cachedBaseUrl;
}

/** Reset cache (chỉ dùng trong unit test). */
export function resetBaseUrlCache() {
    cachedBaseUrl = null;
}

const QUALITY_MAP = {
    FHD: '1080p',
    FULLHD: '1080p',
    HD: '720p',
    SD: '480p',
    CAM: 'CAM',
};

const IMDB_ID_RE = /^tt\d+$/i;

/** Số nguyên giữ nguyên; IMDB "tt..." → TMDB Find API. throw nếu không resolve được. */
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

const PHAN_NAME_RE = /\(Phần\s*(\d+)\)/i;
const PHAN_SLUG_RE = /-phan-(\d+)$/i;

/** Đọc số Phần từ tên/slug KKPhim. Không marker → Phần 1. */
export function parsePhan(item) {
    const name = (item && item.name) || '';
    const slug = (item && item.slug) || '';
    const m = PHAN_NAME_RE.exec(name) || PHAN_SLUG_RE.exec(slug);
    return m ? Number(m[1]) : 1;
}

export function seasonKeyword(name) {
    return String(name || '')
        .replace(/\s*\(Phần\s*\d+\)\s*$/i, '')
        .replace(/\s*\(Season\s*\d+\)\s*$/i, '')
        .trim();
}

/** Search tên VN → tìm item "Phần N" phù hợp trên KKPhim. */
export async function searchSeasonFallback(movie, season, episode, options, base) {
    const keyword = seasonKeyword(movie && movie.name);
    if (!keyword) return [];

    const search = await fetchJson(`${base}/tim-kiem?keyword=${encodeURIComponent(keyword)}`);
    const items = (search && search.data && Array.isArray(search.data.items)) ? search.data.items : [];
    const want = Number(season);

    for (const it of items.slice(0, 3)) {
        if (!it || typeof it.slug !== 'string' || parsePhan(it) !== want) continue;
        try {
            const d = await fetchJson(`${base}/phim/${it.slug}`);
            if (d && d.status === true && parsePhan(d.movie) === want) {
                const s = toStreams(d, 'tv', season, episode, options);
                if (s.length) return s;
            }
        } catch (e) { /* skip */ }
    }
    return [];
}
const isAdSegmentUrl = (url) => !!url
    && (url.indexOf('/adjump/') !== -1
        || ((url.indexOf('/v7/') !== -1 || url.indexOf('/v8/') !== -1) && url.indexOf('segment_') !== -1));

const absolutizeUrl = (segUrl, playUrl) => {
    if (/^https?:\/\//i.test(segUrl)) return segUrl;
    if (segUrl.charAt(0) === '/') {
        const m = /^(https?:\/\/[^/]+)/.exec(playUrl);
        return m ? m[1] + segUrl : segUrl;
    }
    return playUrl.slice(0, playUrl.lastIndexOf('/') + 1) + segUrl;
};
// Port InterceptorUtilKt.removeAdsKKphim (CloudStream): drop block DISCONTINUITY có /v7/|/v8/+segment_|/adjump/,
// giữ nguyên block sạch; convertv7/8 = content → strip prefix. Trả về {playlist, changed}.
export function removeAdsFromPlaylist(playlist, playUrl) {
    const out = [];
    let block = [];
    let inBlock = false;
    let blockHasAd = false;
    let changed = false;

    String(playlist || '').split('\n').forEach((ln) => {
        const line = ln.trim();
        if (!line) return;

        if (line.indexOf('convertv7/') === 0 || line.indexOf('convertv8/') === 0) {
            out.push(absolutizeUrl(line.replace(/^convertv7\//, '').replace(/^convertv8\//, ''), playUrl));
            changed = true;
            return;
        }

        if (!inBlock && line.charAt(0) !== '#' && line !== '') {
            out.push(absolutizeUrl(line, playUrl));
            return;
        }

        if (line === '#EXT-X-DISCONTINUITY') {
            if (inBlock) {
                if (!blockHasAd) out.push.apply(out, block);
                else changed = true;
                block = [];
                blockHasAd = false;
            }
            inBlock = !inBlock;
            if (inBlock) block.push(line);
            return;
        }

        if (inBlock) {
            block.push(line.charAt(0) === '#' ? line : absolutizeUrl(line, playUrl));
            if (isAdSegmentUrl(line)) blockHasAd = true;
            return;
        }

        out.push(line);
    });

    if (inBlock && !blockHasAd) out.push.apply(out, block);
    if (inBlock && blockHasAd) changed = true;
    return { playlist: out.join('\n'), changed };
}

// Giải master playlist (#EXT-X-STREAM-INF) → các variant, chọn bandwidth cao nhất.
function pickTopVariant(masterText, masterUrl) {
    let bw = 0;
    const variants = [];
    String(masterText || '').split('\n').forEach((ln) => {
        const line = ln.trim();
        if (line.indexOf('#EXT-X-STREAM-INF') === 0) {
            const m = line.match(/BANDWIDTH=(\d+)/i);
            bw = m ? Number(m[1]) : 0;
        } else if (bw > 0 && line && line.charAt(0) !== '#') {
            variants.push({ url: absolutizeUrl(line, masterUrl), bw });
            bw = 0;
        }
    });
    variants.sort((a, b) => b.bw - a.bw);
    return variants.length ? variants[0].url : null;
}

// Lọc ad cho stream HLS: master → variant cao nhất (nếu có) → removeAdsFromPlaylist.
// Playlist đổi → data: URI, không đổi/lỗi → giữ URL gốc.
export async function adFilterStream(stream) {
    if (!/m3u8/i.test(stream.url || '')) return stream;
    try {
        let playUrl = stream.url;
        let text = await fetchText(playUrl);
        if (!text || text.indexOf('#EXTM3U') === -1) return stream;
        if (text.indexOf('#EXT-X-STREAM-INF') !== -1) {
            playUrl = pickTopVariant(text, playUrl);
            if (!playUrl) return stream;
            text = await fetchText(playUrl);
            if (!text || text.indexOf('#EXTM3U') === -1) return stream;
        }
        const { playlist, changed } = removeAdsFromPlaylist(text, playUrl);
        if (!changed) return stream;
        return Object.assign({}, stream, {
            url: 'data:application/vnd.apple.mpegurl;charset=utf-8,' + encodeURIComponent(playlist),
            // App Nuvio sniff MIME theo extension — data: URI không có .m3u8 nên phải
            // khai báo type="hls" (StreamParser đọc key "type") để chọn HlsMediaSource.
            type: 'hls',
        });
    } catch (e) {
        console.warn(`[KKPhim] ad-filter giữ URL gốc (${e.message})`);
        return stream;
    }
}

/** /tmdb 404 → lấy title EN từ TMDB API → search /tim-kiem → verify candidate. */
export async function titleSearchFallback(resolved, mediaType, season, episode, options, base) {
    const info = await fetchJson(`${CONFIG.TMDB_API_BASE}/${mediaType}/${resolved}?api_key=${CONFIG.TMDB_API_KEY}`);
    const name = mediaType === 'movie' ? info.title : info.name;
    const orig = mediaType === 'movie' ? info.original_title : info.original_name;
    const keywords = [];
    if (name) keywords.push(String(name));
    if (orig && String(orig) !== String(name)) keywords.push(String(orig));
    if (!keywords.length) return [];

    const want = Number(season);
    const seen = new Set();
    for (const kw of keywords) {
        const kwL = kw.toLowerCase();
        const search = await fetchJson(`${base}/tim-kiem?keyword=${encodeURIComponent(kw)}`);
        const items = (search && search.data && Array.isArray(search.data.items)) ? search.data.items : [];
        const plausible = items.filter((it) => {
            const hay = `${it.name || ''} ${it.origin_name || ''}`.toLowerCase();
            return hay.indexOf(kwL) !== -1;
        });
        const ordered = plausible
            .filter((it) => it && typeof it.slug === 'string')
            .sort((a, b) => ((parsePhan(a) === want) ? 0 : 1) - ((parsePhan(b) === want) ? 0 : 1));

        for (const it of ordered.slice(0, 3)) {
            if (seen.has(it.slug)) continue;
            seen.add(it.slug);
            try {
                const d = await fetchJson(`${base}/phim/${it.slug}`);
                if (!d || d.status !== true) continue;
                const mv = d.movie || {};
                const exact = String((mv.tmdb && mv.tmdb.id) || '') === String(resolved);
                const kwHit = String(mv.origin_name || '')
                    .toLowerCase()
                    .indexOf(kw.toLowerCase()) === 0;
                if (mediaType === 'tv' && parsePhan(mv) !== want) continue;
                if (!exact && !kwHit) continue;
                const s = toStreams(d, mediaType, season, episode, options);
                if (s.length) return s;
            } catch (e) { /* skip */ }
        }
    }
    return [];
}

/** Entry point: fetch /tmdb → map streams; retry timeout, fallback tên VN, fallback title EN. */
export async function extractStreams(tmdbId, mediaType, season, episode, options = {}) {
    const resolved = await resolveTmdbId(tmdbId, mediaType);
    const base = await resolveBaseUrl();

    let data = null;
    try {
        data = await fetchJson(`${base}/tmdb/${mediaType}/${resolved}`);
    } catch (e) {
        if (!String(e.message).startsWith('HTTP ')) {
            try {
                data = await fetchJson(`${base}/tmdb/${mediaType}/${resolved}`);
            } catch (e2) { /* title fallback */ }
        }
    }

    let streams = toStreams(data, mediaType, season, episode, options);

    if (mediaType === 'tv' && streams.length === 0 && data && data.status === true && data.movie) {
        try {
            streams = await searchSeasonFallback(data.movie, season, episode, options, base);
            if (streams.length) {
                console.warn(`[KKPhim] TV ${resolved}: fallback theo tên VN lấy được ${streams.length} streams cho Season ${season}.`);
            }
        } catch (e) {
            console.warn(`[KKPhim] TV ${resolved}: fallback search lỗi: ${e.message}`);
        }
    }

    if (streams.length === 0 && (!data || data.status !== true || !data.movie)) {
        try {
            streams = await titleSearchFallback(resolved, mediaType, season, episode, options, base);
            if (streams.length) {
                console.warn(`[KKPhim] ${mediaType} ${resolved}: không có tag tmdb trên KKPhim, tìm theo title -> ${streams.length} streams.`);
            }
        } catch (e) {
            console.warn(`[KKPhim] ${mediaType} ${resolved}: title fallback lỗi: ${e.message}`);
        }
    }

    if (CONFIG.AD_FILTER && streams.length) {
        streams = await Promise.all(streams.map((s) => adFilterStream(s)));
        const dataUris = streams.filter((s) => (s.url || '').indexOf('data:') === 0).length;
        if (dataUris) console.warn(`[KKPhim] ad-filter: ${dataUris}/${streams.length} stream chứa ad đã drop (data: URI).`);
    }
    return streams;
}

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

    if (mediaType === 'tv' && tmdbSeason != null && Number(season) !== tmdbSeason) {
        if (strictSeason) {
            console.warn(
                `[KKPhim] TV ${movie.tmdb ? movie.tmdb.id : '?'}: yêu cầu Season ${season} ` +
                `nhưng item /tmdb chỉ có Season ${tmdbSeason} -> thử tìm item Phần ${season} theo tên...`
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
            if (!url || seen.has(url)) return;

            if (!isMovie) {
                const epNum = parseInt(String(ep.name || '').replace(/\D/g, ''), 10);
                if (epNum !== wantEp) return;
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

export function parseQuality(filename, movieQuality) {
    if (filename) {
        const m = String(filename).match(/(\d{3,4})p/i);
        if (m) return m[1] + 'p';
        if (/4k/i.test(filename)) return '4K';
    }
    const q = String(movieQuality || '').toUpperCase();
    return QUALITY_MAP[q] || undefined;
}
