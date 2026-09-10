export const CONFIG = {
    BASE_URL: 'https://phim.nguonc.com/api',
    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
    },
    // UA giống CloudStream port — dùng cho mọi request embed/playlist/segment streamc.xyz
    // (server trả 403 nếu thiếu Referer/Origin; UA Firefox là chuẩn mà embed dùng).
    STREAM_UA: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0',

    PROVIDER_NAME: 'NguồnC',

    // true  → season lệch thì tìm item "Phần N" khác; cuối cùng ko có → []
    // false → dùng item tìm được dù lệch season, title ghi "[Phần {N}]" để user tự quyết
    STRICT_SEASON: true,

    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',
};