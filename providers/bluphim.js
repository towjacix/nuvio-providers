/**
 * bluphim - Built from src/bluphim/
 * Generated: 2026-09-10T17:04:36.320Z
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

// src/bluphim/config.js
var CONFIG = {
  BASE_URL: "https://freetube.com.mx",
  FALLBACK_BASE_URL: "https://bluphim5.com",
  DOMAIN_TXT_URL: "https://raw.githubusercontent.com/Datj0000/domain/refs/heads/main/bluphim.txt",
  HEADERS: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  },
  PROVIDER_NAME: "BluPhim",
  // Metadata TMDB (title/year/imdbId) — app chỉ truyền tmdbId
  TMDB_API_BASE: "https://api.themoviedb.org/3",
  TMDB_API_KEY: "1865f43a0549ca50d341dd9ab8b29f49",
  // Số ứng viên detail tối đa để verify imdb
  MAX_VERIFY_CANDIDATES: 4
};

// src/bluphim/http.js
var TIMEOUT_MS = 15e3;
function request(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const hasTimers = typeof setTimeout === "function" && typeof clearTimeout === "function";
    let controller = null;
    if (hasTimers) {
      try {
        controller = new AbortController();
      } catch (e) {
        controller = null;
      }
    }
    let timer = null;
    if (controller) {
      timer = setTimeout(() => {
        try {
          controller.abort();
        } catch (e) {
        }
      }, TIMEOUT_MS);
    }
    try {
      const response = yield fetch(url, __spreadValues(__spreadProps(__spreadValues({}, options), {
        headers: __spreadValues(__spreadValues({}, CONFIG.HEADERS), options.headers || {})
      }), controller ? { signal: controller.signal } : {}));
      if (timer !== null) {
        try {
          clearTimeout(timer);
        } catch (e) {
        }
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response;
    } catch (e) {
      if (timer !== null) {
        try {
          clearTimeout(timer);
        } catch (e2) {
        }
      }
      throw new Error(e && e.name === "AbortError" ? `timeout sau ${TIMEOUT_MS}ms` : e && e.message || "fetch error");
    }
  });
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield request(url, options);
    return yield response.json();
  });
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield request(url, options);
    return yield response.text();
  });
}

// src/bluphim/extractor.js
var cachedBaseUrl = null;
function resetBaseUrlCache() {
  cachedBaseUrl = null;
}
function normalizeBaseUrl(raw) {
  const m = String(raw || "").trim().match(/^https?:\/\/[^\s"'<>]+/);
  if (!m)
    return null;
  return m[0].replace(/\/+$/, "");
}
function resolveBaseUrl() {
  return __async(this, null, function* () {
    if (cachedBaseUrl)
      return cachedBaseUrl;
    let base = null;
    try {
      const txt = yield fetchText(CONFIG.DOMAIN_TXT_URL);
      base = normalizeBaseUrl(txt);
    } catch (e) {
      base = null;
    }
    if (!base)
      base = CONFIG.BASE_URL;
    try {
      yield fetchText(base + "/");
      cachedBaseUrl = base;
      return base;
    } catch (e) {
      cachedBaseUrl = CONFIG.FALLBACK_BASE_URL;
      return cachedBaseUrl;
    }
  });
}
var IMDB_ID_RE = /^tt\d+$/i;
function resolveTmdbId(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const raw = String(tmdbId || "").trim();
    if (!raw)
      throw new Error("thi\u1EBFu tmdbId");
    if (!IMDB_ID_RE.test(raw)) {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n))
        throw new Error(`tmdbId l\u1EA1: ${raw}`);
      return n;
    }
    const kind = mediaType === "tv" ? "tv" : "movie";
    const url = `${CONFIG.TMDB_API_BASE}/find/${encodeURIComponent(raw)}?api_key=${CONFIG.TMDB_API_KEY}&external_source=imdb_id`;
    const json = yield fetchJson(url);
    const list = json && Array.isArray(json[kind === "tv" ? "tv_results" : "movie_results"]) ? json[kind === "tv" ? "tv_results" : "movie_results"] : [];
    if (!list.length || typeof list[0].id !== "number") {
      throw new Error(`kh\xF4ng resolve \u0111\u01B0\u1EE3c IMDB ${raw}`);
    }
    return list[0].id;
  });
}
function tmdbMeta(numericId, mediaType) {
  return __async(this, null, function* () {
    const kind = mediaType === "tv" ? "tv" : "movie";
    const url = `${CONFIG.TMDB_API_BASE}/${kind}/${numericId}?api_key=${CONFIG.TMDB_API_KEY}&language=en-US&append_to_response=external_ids`;
    const json = yield fetchJson(url);
    const title = json && (json.title || json.name) ? String(json.title || json.name) : "";
    const dateStr = String(json && (json.release_date || json.first_air_date) || "");
    const year = /^\d{4}/.test(dateStr) ? dateStr.slice(0, 4) : "";
    const imdbId = json && json.external_ids && typeof json.external_ids.imdb_id === "string" ? json.external_ids.imdb_id : "";
    return { title, year, imdbId };
  });
}
function decodeEntities(s) {
  return String(s || "").replace(/&#(\d+);/g, (_, code) => {
    const n = parseInt(code, 10);
    return Number.isFinite(n) ? String.fromCharCode(n) : _;
  }).replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function parseSearchResults(html) {
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  const liRe = /<li[^>]*class="film-item-ver"[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html)) !== null) {
    const block = m[1];
    const hrefM = block.match(/<a[^>]*href="(\/phim\/[^"]+)"/i);
    if (!hrefM)
      continue;
    const href = hrefM[1];
    if (seen.has(href))
      continue;
    seen.add(href);
    const nameM = block.match(/<p[^>]*class="name"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
    const yearM = block.match(/<p[^>]*class="real-name"[^>]*>([\s\S]*?)<\/p>/i);
    const name = decodeEntities(nameM ? nameM[1].replace(/<[^>]+>/g, "").trim() : "").trim();
    const yearRaw = decodeEntities(yearM ? yearM[1].replace(/<[^>]+>/g, "").trim() : "").trim();
    const year = /^\d{4}$/.test(yearRaw) ? yearRaw : "";
    if (!name)
      continue;
    items.push({ href, name, year });
  }
  return items;
}
function parseDetailImdb(html) {
  const m = String(html || "").match(/imdb\.com\/title\/(tt\d+)/i);
  return m ? m[1] : "";
}
function parseWatchHref(html) {
  const m = String(html || "").match(/href="(\/xem-phim\/[^"]+)"/i);
  return m ? m[1] : "";
}
function parseIframeSrc(html) {
  const m = String(html || "").match(/<iframe[^>]*id="iframeStream"[^>]*src="([^"]+)"/i) || String(html || "").match(/<iframe[^>]*src="([^"]+)"[^>]*id="iframeStream"/i);
  if (!m)
    return "";
  return decodeEntities(m[1]).replace(/&amp;/g, "&");
}
function parseNestedIframeSrc(html) {
  const m = String(html || "").match(/<iframe[^>]*src='([^']+)'/i) || String(html || "").match(/<iframe[^>]*src="([^"]+streaming[^"]*)"/i);
  return m ? m[1].replace(/&amp;/g, "&") : "";
}
function parseStreamUrl(html) {
  const m = String(html || "").match(/var\s+url\s*=\s*['"](https?:\/\/[^'"]+\.m3u8[^'"]*)['"]/i) || String(html || "").match(/(https?:\/\/[^'"\\\s]+\.m3u8[^'"\\\s]*)/i);
  return m ? m[1] : "";
}
var TITLE_STOPWORDS = /* @__PURE__ */ new Set(["the", "a", "an", "of", "and", "vs"]);
function slugScore(href, title) {
  const slugM = String(href || "").match(/\/phim\/([a-z0-9-]+?)(?:-\d+)?$/i);
  if (!slugM)
    return 0;
  const slugWords = new Set(slugM[1].toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const titleWords = String(title || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w));
  let score = 0;
  for (const w of titleWords) {
    if (slugWords.has(w))
      score += 1;
  }
  return score;
}
function parseQuality(masterText) {
  let maxH = 0;
  const re = /RESOLUTION=\d+x(\d+)/gi;
  let m;
  while ((m = re.exec(String(masterText || ""))) !== null) {
    const h = parseInt(m[1], 10);
    if (Number.isFinite(h) && h > maxH)
      maxH = h;
  }
  if (maxH >= 2e3)
    return "2160p";
  if (maxH >= 1e3)
    return "1080p";
  if (maxH >= 700)
    return "720p";
  if (maxH > 0)
    return "480p";
  return "";
}
function searchKeyword(title) {
  return String(title || "").replace(/[^a-zA-Z0-9À-ỹ\s]/g, " ").replace(/\s+/g, " ").trim();
}
function pickCandidate(base, candidates, meta) {
  return __async(this, null, function* () {
    if (!candidates.length)
      return null;
    const ranked = candidates.map((c) => ({
      c,
      score: slugScore(c.href, meta.title) + (meta.year && c.year === meta.year ? 2 : 0)
    })).sort((a, b) => b.score - a.score).map((x) => x.c);
    if (ranked.length && slugScore(ranked[0].href, meta.title) === 0 && !(meta.year && ranked[0].year === meta.year)) {
      const anyYear = candidates.some((c) => meta.year && c.year === meta.year);
      if (!anyYear)
        return null;
    }
    const ordered = ranked.slice(0, CONFIG.MAX_VERIFY_CANDIDATES);
    if (meta.imdbId) {
      for (const c of ordered) {
        try {
          const detail = yield fetchText(base + c.href);
          const imdb = parseDetailImdb(detail);
          if (imdb && meta.imdbId && imdb.toLowerCase() === meta.imdbId.toLowerCase()) {
            return c;
          }
        } catch (e) {
        }
      }
      return null;
    }
    return ordered[0] || null;
  });
}
function resolveEmbedStream(iframeSrc, referer) {
  return __async(this, null, function* () {
    let html = yield fetchText(iframeSrc, { headers: { Referer: referer } });
    for (let hop = 0; hop < 2; hop += 1) {
      const direct = parseStreamUrl(html);
      if (direct)
        return direct;
      const nested = parseNestedIframeSrc(html);
      if (!nested)
        return "";
      html = yield fetchText(nested, { headers: { Referer: iframeSrc } });
      iframeSrc = nested;
    }
    return parseStreamUrl(html);
  });
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId)
      return [];
    const tv = mediaType === "tv";
    if (tv && (episode === void 0 || episode === null || episode === ""))
      return [];
    const base = yield resolveBaseUrl();
    const numericId = yield resolveTmdbId(tmdbId, mediaType);
    const meta = yield tmdbMeta(numericId, mediaType);
    if (!meta.title) {
      console.warn(`[BluPhim] TMDB kh\xF4ng c\xF3 title cho ${mediaType} ${tmdbId}`);
      return [];
    }
    const searchHtml = yield fetchText(`${base}/search?k=${encodeURIComponent(searchKeyword(meta.title))}`);
    const candidates = parseSearchResults(searchHtml);
    if (!candidates.length)
      return [];
    const picked = yield pickCandidate(base, candidates, meta);
    if (!picked)
      return [];
    const detailHtml = yield fetchText(base + picked.href);
    const watchHref = parseWatchHref(detailHtml);
    if (!watchHref)
      return [];
    let watchUrl = base + watchHref;
    if (tv) {
      const ep = parseInt(episode, 10);
      if (!Number.isFinite(ep) || ep < 1)
        return [];
      watchUrl = `${base + watchHref}/tap-${ep}`;
    }
    const watchHtml = yield fetchText(watchUrl);
    const iframeSrc = parseIframeSrc(watchHtml);
    if (!iframeSrc)
      return [];
    const streamUrl = yield resolveEmbedStream(iframeSrc, watchUrl);
    if (!streamUrl)
      return [];
    let quality = "";
    try {
      const master = yield fetchText(streamUrl, { headers: { Referer: watchUrl } });
      quality = parseQuality(master);
    } catch (e) {
    }
    const label = quality ? `BluPhim [${quality}]` : "BluPhim [Auto]";
    return [{
      title: label,
      name: quality ? `BluPhim (${quality})` : "BluPhim",
      url: streamUrl,
      quality: quality && quality !== "Auto" ? quality : void 0,
      type: "hls"
    }];
  });
}

// src/bluphim/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error("[BluPhim] Error:", error && error.message ? error.message : String(error));
      return [];
    }
  });
}
module.exports = { getStreams, resetBaseUrlCache };
