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
     * true  → season không khớp thì trả [] (chính xác nội dung)
     * false → vẫn trả stream nhưng title ghi rõ "[Phần {N}]" để user tự quyết
     */
    STRICT_SEASON: true,
};