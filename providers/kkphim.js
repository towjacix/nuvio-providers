/**
 * kkphim - Built from src/kkphim/
 * Generated: 2026-09-10T08:52:44.294Z
 */
var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/kkphim/config.js
var CONFIG = {
  // Base URL của KKPhim API (public, GET-only, JSON)
  BASE_URL: "https://phimapi.com",
  // Header mặc định cho mọi request
  HEADERS: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json"
  },
  // Tên hiển thị trên stream list
  PROVIDER_NAME: "KKPhim",
  /**
   * Strict season matching cho TV shows.
   * KKPhim's /tmdb/tv/{id} chỉ map tới MỘT entry (season mà họ cập nhật gần nhất),
   * param ?season= bị bỏ qua (đã verify 2026-09-10: /tmdb/tv/1622 luôn trả Season 10).
   *
   * true  → season không khớp thì trả [] (chính xác nội dung)
   * false → vẫn trả stream nhưng title ghi rõ "[Phần {N}]" để user tự quyết
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
  TMDB_API_BASE: "https://api.themoviedb.org/3",
  TMDB_API_KEY: "1865f43a0549ca50d341dd9ab8b29f49"
};

// src/kkphim/http.js
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield fetch(url, __spreadProps(__spreadValues({}, options), {
      headers: __spreadValues(__spreadValues({}, CONFIG.HEADERS), options.headers || {})
    }));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return yield response.json();
  });
}

// src/kkphim/extractor.js
var QUALITY_MAP = {
  FHD: "1080p",
  FULLHD: "1080p",
  HD: "720p",
  SD: "480p",
  CAM: "CAM"
};
var IMDB_ID_RE = /^tt\d+$/i;
function resolveTmdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const raw = String(tmdbId || "").split(":")[0].trim();
    if (/^\d+$/.test(raw))
      return raw;
    if (!IMDB_ID_RE.test(raw))
      throw new Error(`id kh\xF4ng h\u1EE3p l\u1EC7: "${raw}"`);
    const url = `${CONFIG.TMDB_API_BASE}/find/${raw}?api_key=${CONFIG.TMDB_API_KEY}&external_source=imdb_id`;
    const data = yield fetchJson(url);
    const results = mediaType === "movie" ? data.movie_results : data.tv_results;
    const id = Array.isArray(results) && results[0] && results[0].id;
    if (!id)
      throw new Error(`kh\xF4ng resolve \u0111\u01B0\u1EE3c TMDB id t\u1EEB "${raw}"`);
    return String(id);
  });
}
function extractStreams(_0, _1, _2, _3) {
  return __async(this, arguments, function* (tmdbId, mediaType, season, episode, options = {}) {
    const resolved = yield resolveTmdbId(tmdbId, mediaType);
    const url = `${CONFIG.BASE_URL}/tmdb/${mediaType}/${resolved}`;
    const data = yield fetchJson(url);
    return toStreams(data, mediaType, season, episode, options);
  });
}
function toStreams(data, mediaType, season, episode, options = {}) {
  if (!data || data.status !== true)
    return [];
  const movie = data.movie || {};
  const episodes = data.episodes;
  if (!Array.isArray(episodes) || episodes.length === 0)
    return [];
  const strictSeason = options.strictSeason !== void 0 ? options.strictSeason : CONFIG.STRICT_SEASON;
  const tmdbSeason = movie.tmdb && movie.tmdb.season != null ? Number(movie.tmdb.season) : null;
  if (mediaType === "tv" && tmdbSeason != null && Number(season) !== tmdbSeason) {
    if (strictSeason) {
      console.warn(
        `[KKPhim] TV ${movie.tmdb ? movie.tmdb.id : "?"}: y\xEAu c\u1EA7u Season ${season} nh\u01B0ng KKPhim ch\u1EC9 c\xF3 Season ${tmdbSeason} -> [] (strict). Ch\u1ECDn \u0111\xFAng season trong app, ho\u1EB7c STRICT_SEASON=false \u0111\u1EC3 l\u1EA5y stream k\xE8m nh\xE3n "[Ph\u1EA7n N]".`
      );
      return [];
    }
  }
  const isMovie = mediaType === "movie";
  const wantEp = Number(episode);
  const streams = [];
  const seen = /* @__PURE__ */ new Set();
  episodes.forEach((group) => {
    const server = group && group.server_name || CONFIG.PROVIDER_NAME;
    const serverData = group && Array.isArray(group.server_data) ? group.server_data : [];
    serverData.forEach((ep) => {
      const url = ep && (ep.link_m3u8 || ep.link_embed) || "";
      if (!url || seen.has(url))
        return;
      if (!isMovie) {
        const epNum = parseInt(String(ep.name || "").replace(/\D/g, ""), 10);
        if (epNum !== wantEp)
          return;
      }
      seen.add(url);
      streams.push({
        name: CONFIG.PROVIDER_NAME,
        title: buildTitle(ep, server, isMovie ? null : labelFor(tmdbSeason, season, strictSeason)),
        url,
        quality: parseQuality(ep.filename, movie.quality)
      });
    });
  });
  if (!isMovie && streams.length === 0) {
    console.warn(`[KKPhim] TV ${movie.tmdb ? movie.tmdb.id : "?"}: kh\xF4ng c\xF3 stream cho S${season}E${episode} (KKPhim \u0111ang gi\u1EEF S${tmdbSeason != null ? tmdbSeason : "?"}).`);
  }
  return streams;
}
function labelFor(tmdbSeason, season, strictSeason) {
  if (strictSeason)
    return null;
  if (tmdbSeason == null || Number(season) === tmdbSeason)
    return null;
  return `[Ph\u1EA7n ${tmdbSeason}]`;
}
function buildTitle(ep, server, label) {
  const base = (ep.filename || ep.name || CONFIG.PROVIDER_NAME).trim();
  const suffix = label ? `${label} ` : "";
  return `${suffix}${base} \xB7 ${server}`;
}
function parseQuality(filename, movieQuality) {
  if (filename) {
    const m = String(filename).match(/(\d{3,4})p/i);
    if (m)
      return m[1] + "p";
    if (/4k/i.test(filename))
      return "4K";
  }
  const q = String(movieQuality || "").toUpperCase();
  return QUALITY_MAP[q] || void 0;
}

// src/kkphim/index.js
function getStreams(tmdbId, mediaType, season, episode, options) {
  return __async(this, null, function* () {
    try {
      return yield extractStreams(tmdbId, mediaType, season, episode, options);
    } catch (error) {
      console.error("[KKPhim] Error:", error && error.message ? error.message : String(error));
      return [];
    }
  });
}
module.exports = { getStreams };
