/**
 * KKPhim Provider - Configuration
 * Nguồn: https://kkphim.com/api-document (base URL: https://phimapi.com)
 */

export const CONFIG = {
    // Base URL của KKPhim API (public, GET-only, JSON)
    BASE_URL: 'https://phimapi.com',

    // Header mặc định cho mọi request
    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
    },

    // Tên hiển thị trên stream list
    PROVIDER_NAME: 'KKPhim',

    /**
     * Strict season matching cho TV shows.
     * KKPhim's /tmdb/tv/{id} chỉ map tới MỘT entry (season mà họ cập nhật gần nhất),
     * param ?season= bị bỏ qua (đã verify 2026-09-10: /tmdb/tv/1622 luôn trả Season 10).
     *
     * true  → item /tmdb lệch season thì không dùng nó; provider tự fallback
     *         tìm item "Phần N" khác trên KKPhim qua search theo tên (nếu có).
     *         Cuối cùng vẫn không có → [].
     * false → dùng luôn item /tmdb, title ghi rõ "[Phần {N}]" để user tự quyết
     */
    STRICT_SEASON: true,

    /**
     * TMDB Find API — resolve IMDB id ("tt...") sang TMDB id số.
     * App Nuvio truyền IMDB id (từ Stremio catalogs) vào tmdbId, nhưng
     * phimapi.com chỉ nhận TMDB id số -> 404 (verify 2026-09-10 qua app log:
     * phimapi.com/tmdb/tv/tt9054364 -> 404, /tmdb/tv/82684 -> status:true).
     * API key là key công khai dùng chung trong cộng đồng Nuvio providers
     * (phisher98 AllWish dùng key này, đã verify find/tt9054364 -> 200).
     */
    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',
};