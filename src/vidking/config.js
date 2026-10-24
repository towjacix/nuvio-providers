/**
 * VidKing provider — multi-language source (SpeedRacelight backend, Videasy/Cineby lineage).
 *
 * Flow:
 *   getStreams(tmdbId, mediaType, season, episode)
 *     ├─ TMDB API → title / year / imdbId           (every TMDB title has metadata)
 *     ├─ api.speedracelight.com/seed?mediaId=…      → seed (TTL 30s, cached 25s)
 *     ├─ /cdn/sources-with-title?...&seed=…&_t=…    → base64url payload (XOR-encrypted)
 *     ├─ XOR decrypt (magic "mvm1")                 → { sources[], subtitles[] }
 *     └─ map → items { title, url, type:'hls', headers, subtitles[] }
 *
 * Video segments are public (no headers); VTT subs require vidking Referer.
 */

export const CONFIG = {
    // Stream backend (SpeedRacelight — same infra as cineby/videasy-vidking)
    SPEED_API: 'https://api.speedracelight.com',
    SUBS_API: 'https://subs.videasy.to',

    // Referer required to fetch VTT subs from moon.peakstorm.top (403 without it)
    REFERER: 'https://www.vidking.net/',

    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
    },

    PROVIDER_NAME: 'VidKing',

    // TMDB metadata (title/year/imdbId) — app only passes tmdbId
    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',

    // Seed cache: server TTL 30s → cache 25s (avoids seed-invalid retries)
    SEED_TTL_MS: 25000,

    // Cap on subs attached to each item (light JSON, dedupe by url)
    MAX_SUBTITLES: 12,
};