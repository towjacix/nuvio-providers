/**
 * BluPhim provider — nguồn Việt FullHD (site freetube.com.mx / mirror bluphim5.com).
 *
 * RE từ CloudStream plugin com.anhdaden.BluPhimProvider (repo gitlab.com/tearrs/movie):
 * - domainUrl động: fetch bluphim.txt (github Datj0000/domain) → domain live
 *   (decode custom-base64 hashUrl nếu cần; hiện tại = https://freetube.com.mx)
 * - search:  GET {base}/search?k={title} → li.film-item-ver (.name, .real-name year, a[href^=/phim/])
 * - detail:  GET {base}/phim/{slug} → link imdb.com/title/tt... + a[href^=/xem-phim/]
 * - watch:   GET {base}/xem-phim/{slug}[/tap-{ep}] → iframe#iframeStream[src]
 * - embed:   moviking.neuronix.sbs/embed3rd → cdn.codexa.fun/streaming3rd → var url = '...m3u8'
 * - m3u8 host kkphimplayer7 (v7): master/variant/segment PUBLIC, không cần Referer (verify 200)
 *
 * TV: /xem-phim/{slug}/tap-{episode}. Multi-season (nhiều Phần/slug riêng) — ngoài scope v1.
 * Sub: luồng embed không expose sub rời → v1 video-only (CẤM gắn sub chết).
 */
export const CONFIG = {
    BASE_URL: 'https://freetube.com.mx',
    FALLBACK_BASE_URL: 'https://bluphim5.com',
    DOMAIN_TXT_URL: 'https://raw.githubusercontent.com/Datj0000/domain/refs/heads/main/bluphim.txt',

    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },

    PROVIDER_NAME: 'BluPhim',

    // Metadata TMDB (title/year/imdbId) — app chỉ truyền tmdbId
    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',

    // Số ứng viên detail tối đa để verify imdb
    MAX_VERIFY_CANDIDATES: 4,
};
