export const CONFIG = {
    BASE_URL: 'https://phimapi.com',
    DOMAIN_TXT_URL: 'https://raw.githubusercontent.com/Datj0000/domain/refs/heads/main/kkphim.txt',
    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
    },
    // Lọc ad playlist m3u8 (port removeAdsKKphim CloudStream) → data: URI. App phải hỗ trợ data: URI.
    AD_FILTER: true,

    PROVIDER_NAME: 'KKPhim',

    // true  → season lệch thì fallback tìm item "Phần N" khác; cuối cùng ko có → []
    // false → dùng item /tmdb dù lệch season, title ghi "[Phần {N}]" để user tự quyết
    STRICT_SEASON: true,

    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',
};