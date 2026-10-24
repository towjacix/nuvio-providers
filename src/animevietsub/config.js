/**
 * AnimeVietSub provider — Vietsub anime source (animevietsub.li).
 *
 * Ported from CloudStream plugin recloudstream.AnimeVietsubProvider (github.com/h0dev/0cs3, movie branch).
 *
 * Flow:
 * - domain: GET entry shortlink → take final origin (CS3: bit.ly/animevietsubtv →
 *   animevietsub.li). Site sits behind Cloudflare — datacenter IPs get 403, residential usually pass.
 * - search: POST {base}/ajax/suggest (ajaxSearch=1&keysearch={q}) → <li> a.thumb[href] + .ss-title
 *   fallback: GET {base}/tim-kiem/{q}/ → ul.MovieList li.TPostMv (a[href] + h2.Title)
 * - watch:  {href} + /xem-phim.html → div.server-group (h3.server-name) ×
 *   a.btn-episode[data-hash,data-id] (epNum from title/text)
 * - links:  POST {base}/ajax/player (link={hash}&id={id}) → JSON {link, playTech}
 *   + direct link (.m3u8/mp4) → return as-is
 *   + playTech=iframe + googleapiscdn.com → avsToken/envelope/AES-GCM+CTR pipeline
 *     (see decrypt.js). THIS BRANCH cannot be delivered in Nuvio: CS3 decrypts the playlist
 *     inside an OkHttp interceptor (serves content directly); Nuvio stream items only accept
 *     a URL — the encrypted playlist fetched raw won't play → skip that server.
 *
 * Sub: CS3 exposes no separate subtitle tracks → v1 is video-only.
 */
export const CONFIG = {
    // CS3 shortlink entry; fetch to get final origin. Used as fallback when request fails.
    ENTRY_URL: 'https://bit.ly/animevietsubtv',
    FALLBACK_BASE_URL: 'https://animevietsub.li',
    LEGACY_FALLBACK: 'https://animevietsub.site', // CS3 fallback

    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        'Upgrade-Insecure-Requests': '1',
    },

    PROVIDER_NAME: 'AnimeVietSub',

    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',

    // Max servers resolved via /ajax/player per episode
    MAX_SERVERS: 6,
};
