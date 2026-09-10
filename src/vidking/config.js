/**
 * VidKing provider — nguồn Anh đa ngôn ngữ (backend SpeedRacelight, kế thừa Videasy/Cineby).
 *
 * Flow:
 *   getStreams(tmdbId, mediaType, season, episode)
 *     ├─ TMDB API → title / year / imdbId           (mọi phim TMDB đều có metadata)
 *     ├─ api.speedracelight.com/seed?mediaId=…      → seed (TTL 30s, cache 25s)
 *     ├─ /cdn/sources-with-title?...&seed=…&_t=…    → payload base64url (mã hoá XOR)
 *     ├─ decrypt XOR (magic "mvm1")                 → { sources[], subtitles[] }
 *     └─ map → items { title, url, type:'hls', headers, subtitles[] }
 *
 * Video segments public (không cần headers), sub VTT cần Referer vidking.
 */

export const CONFIG = {
    // Backend stream (SpeedRacelight — cùng hạ tầng cineby/videasy-vidking)
    SPEED_API: 'https://api.speedracelight.com',
    SUBS_API: 'https://subs.videasy.to',

    // Referer bắt buộc khi tải VTT sub từ moon.peakstorm.top (403 nếu thiếu)
    REFERER: 'https://www.vidking.net/',

    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
    },

    PROVIDER_NAME: 'VidKing',

    // Metadata TMDB (title/year/imdbId) — app chỉ truyền tmdbId
    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',

    // Seed cache: TTL server 30s → cache 25s (tránh retry seed-invalid)
    SEED_TTL_MS: 25000,

    // Giới hạn sub gắn vào item (JSON nhẹ, dedupe url)
    MAX_SUBTITLES: 12,
};