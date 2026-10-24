/**
 * BluPhim provider — Vietnamese FullHD source (freetube.com.mx / mirror bluphim5.com).
 *
 * Port of CloudStream plugin com.anhdaden.BluPhimProvider (repo gitlab.com/tearrs/movie):
 * - dynamic domainUrl: fetch bluphim.txt (github Datj0000/domain) → live domain
 *   (custom-base64 hashUrl decode if needed; currently = https://freetube.com.mx)
 * - search:  GET {base}/search?k={title} → li.film-item-ver (.name, .real-name year, a[href^=/phim/])
 * - detail:  GET {base}/phim/{slug} → link imdb.com/title/tt... + a[href^=/xem-phim/]
 * - watch:   GET {base}/xem-phim/{slug}[/tap-{ep}] → iframe#iframeStream[src]
 * - embed:   moviking.neuronix.sbs/embed3rd → cdn.codexa.fun/streaming3rd → var url = '...m3u8'
 * - m3u8 host kkphimplayer7 (v7): master/variant/segment PUBLIC, no Referer needed (verify 200)
 *
 * TV: /xem-phim/{slug}/tap-{episode}. Multi-season (separate parts/slugs) — out of scope for v1.
 * Sub: embed flow does not expose separate subs → v1 video-only (never attach a dead sub).
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

    // TMDB metadata (title/year/imdbId) — app only passes tmdbId
    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',

    // Max detail candidates to verify against imdb
    // (search returns ~10 real li.item entries; correct one often sits behind 4-5 near-name titles)
    MAX_VERIFY_CANDIDATES: 10,
};
