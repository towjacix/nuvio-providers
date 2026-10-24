export const CONFIG = {
    BASE_URL: 'https://phim.nguonc.com/api',
    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
    },
    // UA matching the CloudStream port — used for all embed/playlist/segment requests
    // to streamc.xyz (server returns 403 without Referer/Origin; Firefox UA is what embeds use).
    STREAM_UA: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0',

    PROVIDER_NAME: 'Ngu\u1ed3nC',

    // true  → on season mismatch, look for a different "Part N" item; none found → []
    // false → use the found item despite season mismatch, title marked "[Part {N}]" for the user
    STRICT_SEASON: true,

    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',
};