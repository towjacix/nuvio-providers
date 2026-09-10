/**
 * vidking - Built from src/vidking/
 * Generated: 2026-09-10T13:55:20.609Z
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

// src/vidking/config.js
var CONFIG = {
  // Backend stream (SpeedRacelight — cùng hạ tầng cineby/videasy-vidking)
  SPEED_API: "https://api.speedracelight.com",
  SUBS_API: "https://subs.videasy.to",
  // Referer bắt buộc khi tải VTT sub từ moon.peakstorm.top (403 nếu thiếu)
  REFERER: "https://www.vidking.net/",
  HEADERS: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "*/*"
  },
  PROVIDER_NAME: "VidKing",
  // Metadata TMDB (title/year/imdbId) — app chỉ truyền tmdbId
  TMDB_API_BASE: "https://api.themoviedb.org/3",
  TMDB_API_KEY: "1865f43a0549ca50d341dd9ab8b29f49",
  // Seed cache: TTL server 30s → cache 25s (tránh retry seed-invalid)
  SEED_TTL_MS: 25e3,
  // Giới hạn sub gắn vào item (JSON nhẹ, dedupe url)
  MAX_SUBTITLES: 12
};

// src/vidking/http.js
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

// src/vidking/decrypt.js
var Hl = [
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580
];
var _f = [1732584193, 4023233417, 2562383102, 271733878];
var Js = 61;
var Sf = 8;
var ms = 2654435769;
var Ys = [109, 118, 109, 49];
var bf = (l) => (l * (l + 1) & 1) === 0;
var If = (l) => (l * (l + 1) & 1) === 1;
function ci(l) {
  l = l >>> 0;
  l ^= l >>> 16;
  l = Math.imul(l, 2246822507) >>> 0;
  l ^= l >>> 13;
  l = Math.imul(l, 3266489909) >>> 0;
  l ^= l >>> 16;
  return l >>> 0;
}
function ps(l, o) {
  l = l >>> 0;
  o &= 31;
  return o === 0 ? l >>> 0 : (l << o | l >>> 32 - o) >>> 0;
}
function Af(l) {
  let o = _f[0] >>> 0;
  for (let e = 0; e < l.length; e++) {
    o = ps((o ^ Math.imul(l.charCodeAt(e), Hl[e & 15])) >>> 0, 5);
  }
  return ci(o);
}
function wf(l) {
  const o = new Array(256);
  for (let i = 0; i < 256; i++)
    o[i] = i;
  let e = 0;
  for (let i = 0; i < 256; i++) {
    e = e + o[i] + l.charCodeAt(i % l.length) & 255;
    const r = o[i];
    o[i] = o[e];
    o[e] = r;
  }
  return o;
}
function vf(l) {
  let o = 2166136261;
  for (let e = 0; e < l.length; e++) {
    o = Math.imul(o ^ l.charCodeAt(e), 16777619) >>> 0;
  }
  return ci(o);
}
function Nf(l, o, e) {
  return ((l ^ o) >>> 0 | (l & o & e) >>> 0) >>> 0;
}
function Rf(l, o) {
  if (If(l.length)) {
    return { S: wf(l), acc: Af(l) };
  }
  const e = new Array(Js);
  let i = ci((vf(l) ^ ci(o >>> 0 ^ ms)) >>> 0) >>> 0;
  for (let r = 0; r < Sf; r++) {
    if (bf(r)) {
      const n = i % Js;
      i = ps(i + ms >>> 0, 7 + (r & 7));
      e[n] = (i ^ ci(i)) >>> 0;
      i = ci(i + n >>> 0) >>> 0;
    } else {
      e[r] = Hl[r & 15];
    }
  }
  return { S: e, acc: ci((i ^ 2779096485) >>> 0) >>> 0 };
}
function Cf(l, o) {
  const e = l.S;
  let i = l.acc >>> 0;
  const r = i % Js;
  const n = 0 - +(r in e);
  const u = (e[r] || 0) >>> 0;
  const d = Math.imul(ms, o + 1) >>> 0;
  let g = Nf(i, (u ^ d) >>> 0, n) >>> 0;
  g = (ps(g + i >>> 0, r & 31) ^ ps(i, Math.imul(r, 7) & 31)) >>> 0;
  i = ci(g + ms >>> 0) >>> 0;
  e[r] = i >>> 0;
  l.acc = i >>> 0;
  return i >>> 0;
}
function xf(l, o, e) {
  const i = Rf(l, o);
  const r = new Array(e);
  let n = 0;
  for (let u = 0; u < e; ) {
    const d = Cf(i, n++);
    r[u++] = d & 255;
    if (u < e)
      r[u++] = d >>> 8 & 255;
    if (u < e)
      r[u++] = d >>> 16 & 255;
    if (u < e)
      r[u++] = d >>> 24 & 255;
  }
  return r;
}
var B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64urlToBytes(s) {
  const t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  const rem = t.length % 4;
  const padded = rem === 2 ? t + "==" : rem === 3 ? t + "=" : rem === 1 ? t + "===" : t;
  const out = [];
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < padded.length; i++) {
    const ch = padded.charAt(i);
    if (ch === "=")
      break;
    const v = B64_CHARS.indexOf(ch);
    if (v < 0)
      continue;
    buf = buf << 6 | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push(buf >>> bits & 255);
    }
  }
  return out;
}
function utf8ToString(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b < 128) {
      s += String.fromCharCode(b);
      i += 1;
    } else if (b >> 5 === 6) {
      s += String.fromCharCode((b & 31) << 6 | bytes[i + 1] & 63);
      i += 2;
    } else if (b >> 4 === 14) {
      s += String.fromCharCode((b & 15) << 12 | (bytes[i + 1] & 63) << 6 | bytes[i + 2] & 63);
      i += 3;
    } else {
      const cp = (b & 7) << 18 | (bytes[i + 1] & 63) << 12 | (bytes[i + 2] & 63) << 6 | bytes[i + 3] & 63;
      s += String.fromCharCode(cp & 65535);
      i += 4;
    }
  }
  return s;
}
function decryptPayload(payload, seed, mediaId) {
  const bytes = base64urlToBytes(payload);
  const key = xf(String(seed), parseInt(String(mediaId), 10) || 0, bytes.length);
  for (let n = 0; n < bytes.length; n++)
    bytes[n] ^= key[n];
  for (let n = 0; n < Ys.length; n++) {
    if (bytes[n] !== Ys[n]) {
      throw new Error("decrypt failed: bad seed or tampered payload");
    }
  }
  const json = utf8ToString(bytes.slice(Ys.length));
  return JSON.parse(json);
}

// src/vidking/extractor.js
var seedCache = { value: null, at: 0 };
function resetSeedCache() {
  seedCache = { value: null, at: 0 };
}
function fetchSeed(mediaId) {
  return __async(this, null, function* () {
    const now = Date.now();
    if (seedCache.value && now - seedCache.at < CONFIG.SEED_TTL_MS) {
      return seedCache.value;
    }
    const json = yield fetchJson(`${CONFIG.SPEED_API}/seed?mediaId=${encodeURIComponent(String(mediaId))}`);
    const seed = json && typeof json.seed === "string" && json.seed.length ? json.seed : null;
    if (!seed) {
      throw new Error("seed r\u1ED7ng t\u1EEB SpeedRacelight");
    }
    seedCache = { value: seed, at: now };
    return seed;
  });
}
function tmdbMeta(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const type = mediaType === "tv" ? "tv" : "movie";
    const url = `${CONFIG.TMDB_API_BASE}/${type}/${encodeURIComponent(String(tmdbId))}?api_key=${CONFIG.TMDB_API_KEY}&append_to_response=external_ids`;
    const info = yield fetchJson(url);
    const title = type === "movie" ? info.title || info.original_title : info.name || info.original_name;
    const date = type === "movie" ? info.release_date : info.first_air_date;
    const year = date ? String(date).slice(0, 4) : "";
    const ex = info.external_ids || {};
    const imdbId = typeof ex.imdb_id === "string" ? ex.imdb_id : "";
    return {
      title: title ? String(title) : "",
      year,
      imdbId
    };
  });
}
function buildSourcesUrl(meta, mediaType, season, episode, seed) {
  const tv = mediaType === "tv";
  const qs = [
    `title=${encodeURIComponent(meta.title || "")}`,
    `mediaType=${tv ? "tv" : "movie"}`,
    `year=${encodeURIComponent(meta.year || "")}`,
    `episodeId=${episode ? Number(episode) : 1}`,
    `seasonId=${season ? Number(season) : 1}`,
    `tmdbId=${encodeURIComponent(String(meta.tmdbId || ""))}`,
    `imdbId=${encodeURIComponent(meta.imdbId || "0")}`,
    "enc=2",
    `seed=${encodeURIComponent(seed)}`,
    `_t=${Date.now()}`
  ].join("&");
  return `${CONFIG.SPEED_API}/cdn/sources-with-title?${qs}`;
}
var SUB_HEADERS = { Referer: CONFIG.REFERER };
var SUB_PRIORITY = { vi: 0, vietnamese: 0, en: 1, english: 1 };
function subsFromPayload(payload) {
  const raw = payload && Array.isArray(payload.subtitles) ? payload.subtitles : [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  const ranked = raw.slice().sort((a, b) => {
    const al = String(a.language || a.lang || "").toLowerCase();
    const bl = String(b.language || b.lang || "").toLowerCase();
    const ap = SUB_PRIORITY[al] !== void 0 ? SUB_PRIORITY[al] : 2;
    const bp = SUB_PRIORITY[bl] !== void 0 ? SUB_PRIORITY[bl] : 2;
    return ap - bp || a.url.localeCompare(b.url);
  });
  for (const s of ranked) {
    if (!s || typeof s.url !== "string" || !s.url)
      continue;
    if (seen.has(s.url))
      continue;
    seen.add(s.url);
    out.push({
      url: s.url,
      language: s.language || s.lang || "Unknown",
      name: s.language || s.lang || void 0,
      headers: CONFIG.REFERER ? SUB_HEADERS : void 0
    });
    if (out.length >= CONFIG.MAX_SUBTITLES)
      break;
  }
  return out;
}
function subsFromVideasy(imdbId) {
  return __async(this, null, function* () {
    if (!imdbId)
      return [];
    try {
      const list = yield fetchJson(`${CONFIG.SUBS_API}/search?id=${encodeURIComponent(imdbId)}`);
      if (!Array.isArray(list))
        return [];
      const seen = /* @__PURE__ */ new Set();
      const out = [];
      for (const s of list) {
        if (!s || typeof s.url !== "string" || !s.url)
          continue;
        if (seen.has(s.url))
          continue;
        seen.add(s.url);
        out.push({
          url: s.url,
          language: s.language || "en",
          name: s.display || s.language || void 0
        });
      }
      return out;
    } catch (e) {
      console.warn(`[VidKing] subs.videasy fallback l\u1ED7i: ${e && e.message ? e.message : String(e)}`);
      return [];
    }
  });
}
function toStreamItems(payload, meta) {
  const sources = payload && Array.isArray(payload.sources) ? payload.sources : [];
  if (!sources.length)
    return [];
  const subs = subsFromPayload(payload);
  const items = [];
  for (const s of sources) {
    if (!s || typeof s.url !== "string" || !s.url)
      continue;
    const quality = s.quality || "";
    items.push(__spreadValues({
      title: `VidKing [${quality}]`,
      name: quality ? `VidKing (${quality})` : "VidKing",
      url: s.url,
      quality: quality && quality !== "Auto" ? quality : void 0,
      type: "hls",
      headers: {}
    }, subs.length ? { subtitles: subs } : {}));
  }
  return items;
}
function extractStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    if (!tmdbId)
      return [];
    const tv = mediaType === "tv";
    if (tv && !season)
      return [];
    const meta = yield tmdbMeta(tmdbId, mediaType);
    if (!meta.title) {
      console.warn(`[VidKing] TMDB kh\xF4ng c\xF3 title cho ${mediaType} ${tmdbId}`);
      return [];
    }
    meta.tmdbId = tmdbId;
    const seed = yield fetchSeed(tmdbId);
    const url = buildSourcesUrl(meta, mediaType, season, episode, seed);
    let payload = null;
    try {
      const text = yield fetchText(url);
      payload = decryptPayload(text, seed, tmdbId);
    } catch (e) {
      if (/decrypt failed|seed/.test(String(e && e.message))) {
        seedCache = { value: null, at: 0 };
        const seed2 = yield fetchSeed(tmdbId);
        const text2 = yield fetchText(buildSourcesUrl(meta, mediaType, season, episode, seed2));
        payload = decryptPayload(text2, seed2, tmdbId);
      } else {
        throw e;
      }
    }
    let items = toStreamItems(payload, meta);
    if (items.length && !(payload && Array.isArray(payload.subtitles) && payload.subtitles.length) && meta.imdbId) {
      const subs = yield subsFromVideasy(meta.imdbId);
      if (subs.length) {
        items = items.map((it) => __spreadProps(__spreadValues({}, it), { subtitles: subs.slice(0, CONFIG.MAX_SUBTITLES) }));
      }
    }
    return items;
  });
}

// src/vidking/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error("[VidKing] Error:", error && error.message ? error.message : String(error));
      return [];
    }
  });
}
module.exports = { getStreams, resetSeedCache };
