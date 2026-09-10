import { CONFIG } from './config.js';
import { fetchJson, fetchText } from './http.js';

const IMDB_ID_RE = /^tt\d+$/i;
const PHAN_NAME_RE = /\(Phần\s*(\d+)\)/i;
const PHAN_SLUG_RE = /-phan-(\d+)$/i;
const SEASON_EN_RE = /\(season\s*(\d+)\)/i;
const HASH_RE = /[?&]hash=([a-f0-9]+)/i;

const VN_DIACRITICS = [
    ['à', 'a'], ['á', 'a'], ['ả', 'a'], ['ã', 'a'], ['ạ', 'a'], ['ă', 'a'], ['ằ', 'a'], ['ắ', 'a'], ['ẳ', 'a'], ['ẵ', 'a'], ['ặ', 'a'],
    ['â', 'a'], ['ầ', 'a'], ['ấ', 'a'], ['ẩ', 'a'], ['ẫ', 'a'], ['ậ', 'a'],
    ['è', 'e'], ['é', 'e'], ['ẻ', 'e'], ['ẽ', 'e'], ['ẹ', 'e'], ['ê', 'e'], ['ề', 'e'], ['ế', 'e'], ['ể', 'e'], ['ễ', 'e'], ['ệ', 'e'],
    ['ì', 'i'], ['í', 'i'], ['ỉ', 'i'], ['ĩ', 'i'], ['ị', 'i'],
    ['ò', 'o'], ['ó', 'o'], ['ỏ', 'o'], ['õ', 'o'], ['ọ', 'o'], ['ô', 'o'], ['ồ', 'o'], ['ố', 'o'], ['ổ', 'o'], ['ỗ', 'o'], ['ộ', 'o'],
    ['ơ', 'o'], ['ờ', 'o'], ['ớ', 'o'], ['ở', 'o'], ['ỡ', 'o'], ['ợ', 'o'],
    ['ù', 'u'], ['ú', 'u'], ['ủ', 'u'], ['ũ', 'u'], ['ụ', 'u'], ['ư', 'u'], ['ừ', 'u'], ['ứ', 'u'], ['ử', 'u'], ['ữ', 'u'], ['ự', 'u'],
    ['ỳ', 'y'], ['ý', 'y'], ['ỷ', 'y'], ['ỹ', 'y'], ['ỵ', 'y'],
    ['đ', 'd'],
    ['(', ''], [')', ''], ['[', ''], [']', ''], [':', ''], ['?', ''], ['!', ''], ['.', ''], [',', ''], ["'", ''], ['"', ''], ['&', ''],
];

/** Đọc số Phần từ name/slug của item nguonc. Không marker → Phần 1. */
export function parsePhan(name, slug) {
    const mName = PHAN_NAME_RE.exec(String(name || ''));
    if (mName) return Number(mName[1]);
    const mSlug = PHAN_SLUG_RE.exec(String(slug || ''));
    return mSlug ? Number(mSlug[1]) : 1;
}

/** Chuẩn hóa tiêu đề để so khớp: bỏ "(Phần N)"/"(Season N)", lowercase, gom khoảng trắng. */
export function normalizeTitle(s) {
    return String(s || '')
        .replace(PHAN_NAME_RE, ' ')
        .replace(SEASON_EN_RE, ' ')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Slugify kiểu nguonc: bỏ dấu tiếng Việt, lowercase, nối "-". */
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
 * TMDB metadata → tên để search nguonc (nguonc KHÔNG có tmdb/imdb id nào).
 * Hỗ trợ id số (movie/tv) và imdb "tt..." (qua TMDB Find API - imdb cung cấp tên → OK).
 * Lấy cả 2 ngôn ngữ: en-US cho original_name/search, vi cho name → slugify khớp slug thật
 * của nguonc (slug = strip từ name tiếng Việt, vd "Siêu Nhiên" -> "sieu-nhien").
 */
export async function tmdbMeta(tmdbId, mediaType) {
    let id = tmdbId;
    if (IMDB_ID_RE.test(String(tmdbId))) {
        const find = await fetchJson(
            `${CONFIG.TMDB_API_BASE}/find/${tmdbId}?external_source=imdb_id&api_key=${CONFIG.TMDB_API_KEY}`,
        );
        const list = mediaType === 'tv' ? find.tv_results : find.movie_results;
        const first = (list || [])[0];
        if (!first) throw new Error(`TMDB find rỗng cho ${tmdbId}`);
        id = first.id;
    }
    const [docEn, docVi] = await Promise.all([
        fetchJson(`${CONFIG.TMDB_API_BASE}/${mediaType}/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=en-US`),
        fetchJson(`${CONFIG.TMDB_API_BASE}/${mediaType}/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=vi`),
    ]);
    const doc = docEn || docVi || {};
    if (!doc.name && !doc.title) throw new Error(`TMDB ${mediaType}/${id} không có metadata`);
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

/** Search nguonc theo keyword (original_name EN đã verify trả đủ "Phần N"). */
export async function searchNguonc(keyword, base = CONFIG.BASE_URL) {
    const data = await fetchJson(`${base}/films/search?keyword=${encodeURIComponent(keyword)}`);
    return (data && data.items) || [];
}

/** Search an toàn: endpoint lỗi → [] (không làm chết luồng). */
export async function searchNguoncSafe(keyword, base = CONFIG.BASE_URL) {
    try {
        return await searchNguonc(keyword, base);
    } catch (e) {
        console.warn(`[NguồnC] search "${keyword}" lỗi: ${e.message}`);
        return [];
    }
}

/** Phần dư sau tên gốc chỉ hợp lệ nếu là marker season/phần (tránh nhầm "Supernatural Events"). */
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
 * Chọn item khớp: title chuẩn hóa == original_name TMDB VÀ Phần == season yêu cầu.
 * original_name nguonc có thể là danh sách alias (", " ngăn cách) → match từng alias,
 * phần dư sau tên gốc phải là marker season/phần ("2nd Season", "Season 2", "4").
 * STRICT → không khớp season = null. KHÔNG strict → rơi về item đúng title (dù sai Phần).
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

/** Candidate slugs: từ name Việt (ưu tiên) + original_name EN + name EN, kèm "-phan-N" khi multi-season. */
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

/** Fallback slug: gọi detail trực tiếp theo từng candidate slug (bao quát khi search không ra). */
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
        } catch (e) { /* slug sai → thử tiếp */ }
    }
    return null;
}

/** Lấy entry {server, embed} của tập cần từ detail movie (items: [{name, slug, embed}]). */
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
    // Tập đầu / phim lẻ: chấp nhận "1" hoặc "Full" khi yêu cầu episode <= 1 (season 1).
    if (episode <= 1 && season <= 1 && (name === '1' || /full/i.test(name))) return true;
    return false;
}

/** Base origin của URL embed (https://host). */
export function embedBase(url) {
    const m = /^(https?:\/\/[^/]+)/i.exec(String(url || ''));
    return m ? m[1] : null;
}

const embedHash = (url) => {
    const m = HASH_RE.exec(String(url || ''));
    return m ? m[1] : null;
};

/**
 * Chuyển embed streamc.xyz → playlist HLS thật (đã verify bằng HTTP thật):
 *   1. POST embed.php?hash=... {action:"bootstrap", playlist_format:"hls", path_chunks:true}
 *      (cần Origin/Referer = origin của embed; thiếu → {"error":"wrong_origin"}).
 *   2. POST {action:"issue", bootstrap:<JWT>, turnstile_response:null, ...} → {playlist, expiresAt}.
 * Playlist URL trả về KHÔNG có đuôi .m3u8 (path dài) → stream phải khai "type":"hls".
 * Nếu URL đã là m3u8 trực tiếp → dùng thẳng (không qua bootstrap).
 */
export async function resolveEmbedPlaylist(embed) {
    const origin = embedBase(embed);
    if (!origin) throw new Error(`embed không hợp lệ: ${embed}`);
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
    if (!bs || !bs.bootstrap) throw new Error('bootstrap thất bại (streamc.xyz)');

    const issue = await post({
        action: 'issue',
        bootstrap: bs.bootstrap,
        turnstile_response: null,
        playlist_format: 'hls',
        pretty_url: true,
        path_chunks: true,
        frame_origins: [origin],
    });
    if (!issue || !issue.playlist) throw new Error('issue thất bại (streamc.xyz)');

    // Verify playlist: với playlist_format=hls streamc trả plain "#EXTM3U"; nếu gặp
    // "#ENC-AESGCM" (mã hóa) thì player không đọc được → loại stream.
    let playlistText = null;
    try {
        playlistText = await fetchText(issue.playlist, {
            headers: { Origin: origin, Referer: `${origin}/`, 'User-Agent': CONFIG.STREAM_UA, Accept: '*/*' },
        });
    } catch (e) {
        // Cho qua nếu verify fail — app tự fetch lại.
    }
    if (playlistText && /^#ENC-/m.test(playlistText)) {
        throw new Error('playlist bị mã hóa (#ENC-AESGCM) — app không đọc được');
    }
    if (playlistText && !/^#EXTM3U/m.test(playlistText)) {
        throw new Error('playlist trả về không phải HLS');
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

    // Search EN không ra → thử name Việt từ TMDB (language=vi).
    if (!item && meta.nameVi && meta.nameVi !== meta.originalName) {
        const viItems = await searchNguoncSafe(meta.nameVi);
        item = pickItem(viItems, meta, reqSeason, CONFIG.STRICT_SEASON);
    }

    if (item) {
        const detail = await fetchJson(`${CONFIG.BASE_URL}/film/${item.slug}`);
        return await buildStreams((detail && detail.movie) || {}, item, episode, reqSeason);
    }

    // Fallback slug: dựng slug từ name (EN hay Việt đều được) rồi gọi detail trực tiếp.
    const slugHit = await fetchDetailBySlugCandidates(slugCandidates(meta, reqSeason));
    if (slugHit) {
        console.warn(`[NguồnC] search không ra, dùng slug fallback: ${slugHit.slug}`);
        return await buildStreams(slugHit.movie, slugHit.item, episode, reqSeason);
    }

    console.warn(`[NguồnC] Không có "${meta.originalName}" season ${reqSeason} trên nguonc.`);
    return [];
}

async function buildStreams(movie, item, episode, reqSeason) {
    const entries = pickEpisodeEntries(movie, episode, reqSeason);
    if (!entries.length) {
        console.warn(`[NguồnC] ${item.name} (${item.slug}): không có tập ${episode}.`);
        return [];
    }
    const streams = [];
    for (const ent of entries) {
        try {
            const { url, origin } = await resolveEmbedPlaylist(ent.embed);
            // headers TOP-LEVEL: PluginRuntime.parseJsonResults chỉ giữ whitelist
            // (item["headers"]) và StreamFetchSupport map sang proxyHeaders — nếu để
            // riêng behaviorHints.proxyHeaders thì runtime local sẽ VỨT MẤT headers.
            const headers = {
                Referer: `${origin}/`,
                Origin: origin,
                'User-Agent': CONFIG.STREAM_UA,
                Accept: '*/*',
            };
            streams.push({
                name: CONFIG.PROVIDER_NAME,
                title: `${ent.server} · Tập ${ent.entryName}`,
                url,
                type: 'hls',
                headers,
                behaviorHints: {
                    proxyHeaders: { request: headers },
                    videoHash: embedHash(ent.embed),
                },
            });
        } catch (e) {
            console.warn(`[NguồnC] ${item.name} T${episode} [${ent.server}]: ${e.message}`);
        }
    }
    return streams;
}