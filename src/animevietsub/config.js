/**
 * AnimeVietSub provider — nguồn anime Vietsub (animevietsub.li).
 *
 * RE từ CloudStream plugin recloudstream.AnimeVietsubProvider (github.com/h0dev/0cs3, nhánh movie).
 *
 * Flow:
 * - domain: GET entry shortlink → lấy origin cuối cùng (CS3: bit.ly/animevietsubtv →
 *   animevietsub.li). Site bọc Cloudflare — mạng datacenter bị 403, mạng dân cư thường qua.
 * - search: POST {base}/ajax/suggest (ajaxSearch=1&keysearch={q}) → <li> a.thumb[href] + .ss-title
 *   fallback: GET {base}/tim-kiem/{q}/ → ul.MovieList li.TPostMv (a[href] + h2.Title)
 * - watch:  {href} + /xem-phim.html → div.server-group (h3.server-name) ×
 *   a.btn-episode[data-hash,data-id] (epNum từ title/text)
 * - links:  POST {base}/ajax/player (link={hash}&id={id}) → JSON {link, playTech}
 *   + link trực tiếp (.m3u8/mp4) → trả về
 *   + playTech=iframe + googleapiscdn.com → pipeline avsToken/envelope/AES-GCM+CTR
 *     (xem decrypt.js). NHÁNH NÀY KHÔNG DELIVER được trong Nuvio: CS3 giải playlist
 *     trong OkHttp interceptor (trả content sẵn), Nuvio stream item chỉ nhận URL —
 *     playlist encrypted fetch về không play được → bỏ qua server đó.
 *
 * Sub: CS3 không expose subtitle rời → v1 video-only.
 */
export const CONFIG = {
    // Shortlink entry giống CS3; fetch lấy final origin. Fallback khi request fail.
    ENTRY_URL: 'https://bit.ly/animevietsubtv',
    FALLBACK_BASE_URL: 'https://animevietsub.li',
    LEGACY_FALLBACK: 'https://animevietsub.site', // fallback của CS3

    HEADERS: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        'Upgrade-Insecure-Requests': '1',
    },

    PROVIDER_NAME: 'AnimeVietSub',

    TMDB_API_BASE: 'https://api.themoviedb.org/3',
    TMDB_API_KEY: '1865f43a0549ca50d341dd9ab8b29f49',

    // Số server tối đa resolve qua /ajax/player mỗi episode
    MAX_SERVERS: 6,
};
