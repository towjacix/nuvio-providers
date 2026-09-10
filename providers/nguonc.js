/**
 * nguonc - Built from src/nguonc/
 * Generated: 2026-09-10T12:27:43.644Z
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

// src/nguonc/config.js
var CONFIG = {
  BASE_URL: "https://phim.nguonc.com/api",
  HEADERS: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json"
  },
  // UA giống CloudStream port — dùng cho mọi request embed/playlist/segment streamc.xyz
  // (server trả 403 nếu thiếu Referer/Origin; UA Firefox là chuẩn mà embed dùng).
  STREAM_UA: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:143.0) Gecko/20100101 Firefox/143.0",
  PROVIDER_NAME: "Ngu\u1ED3nC",
  // true  → season lệch thì tìm item "Phần N" khác; cuối cùng ko có → []
  // false → dùng item tìm được dù lệch season, title ghi "[Phần {N}]" để user tự quyết
  STRICT_SEASON: true,
  TMDB_API_BASE: "https://api.themoviedb.org/3",
  TMDB_API_KEY: "1865f43a0549ca50d341dd9ab8b29f49"
};

// src/nguonc/http.js
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

// src/nguonc/extractor.js
var IMDB_ID_RE = /^tt\d+$/i;
var PHAN_NAME_RE = /\(Phần\s*(\d+)\)/i;
var PHAN_SLUG_RE = /-phan-(\d+)$/i;
var SEASON_EN_RE = /\(season\s*(\d+)\)/i;
var HASH_RE = /[?&]hash=([a-f0-9]+)/i;
var VN_DIACRITICS = [
  ["\xE0", "a"],
  ["\xE1", "a"],
  ["\u1EA3", "a"],
  ["\xE3", "a"],
  ["\u1EA1", "a"],
  ["\u0103", "a"],
  ["\u1EB1", "a"],
  ["\u1EAF", "a"],
  ["\u1EB3", "a"],
  ["\u1EB5", "a"],
  ["\u1EB7", "a"],
  ["\xE2", "a"],
  ["\u1EA7", "a"],
  ["\u1EA5", "a"],
  ["\u1EA9", "a"],
  ["\u1EAB", "a"],
  ["\u1EAD", "a"],
  ["\xE8", "e"],
  ["\xE9", "e"],
  ["\u1EBB", "e"],
  ["\u1EBD", "e"],
  ["\u1EB9", "e"],
  ["\xEA", "e"],
  ["\u1EC1", "e"],
  ["\u1EBF", "e"],
  ["\u1EC3", "e"],
  ["\u1EC5", "e"],
  ["\u1EC7", "e"],
  ["\xEC", "i"],
  ["\xED", "i"],
  ["\u1EC9", "i"],
  ["\u0129", "i"],
  ["\u1ECB", "i"],
  ["\xF2", "o"],
  ["\xF3", "o"],
  ["\u1ECF", "o"],
  ["\xF5", "o"],
  ["\u1ECD", "o"],
  ["\xF4", "o"],
  ["\u1ED3", "o"],
  ["\u1ED1", "o"],
  ["\u1ED5", "o"],
  ["\u1ED7", "o"],
  ["\u1ED9", "o"],
  ["\u01A1", "o"],
  ["\u1EDD", "o"],
  ["\u1EDB", "o"],
  ["\u1EDF", "o"],
  ["\u1EE1", "o"],
  ["\u1EE3", "o"],
  ["\xF9", "u"],
  ["\xFA", "u"],
  ["\u1EE7", "u"],
  ["\u0169", "u"],
  ["\u1EE5", "u"],
  ["\u01B0", "u"],
  ["\u1EEB", "u"],
  ["\u1EE9", "u"],
  ["\u1EED", "u"],
  ["\u1EEF", "u"],
  ["\u1EF1", "u"],
  ["\u1EF3", "y"],
  ["\xFD", "y"],
  ["\u1EF7", "y"],
  ["\u1EF9", "y"],
  ["\u1EF5", "y"],
  ["\u0111", "d"],
  ["(", ""],
  [")", ""],
  ["[", ""],
  ["]", ""],
  [":", ""],
  ["?", ""],
  ["!", ""],
  [".", ""],
  [",", ""],
  ["'", ""],
  ['"', ""],
  ["&", ""]
];
function parsePhan(name, slug) {
  const mName = PHAN_NAME_RE.exec(String(name || ""));
  if (mName)
    return Number(mName[1]);
  const mSlug = PHAN_SLUG_RE.exec(String(slug || ""));
  return mSlug ? Number(mSlug[1]) : 1;
}
function normalizeTitle(s) {
  return String(s || "").replace(PHAN_NAME_RE, " ").replace(SEASON_EN_RE, " ").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function slugify(title) {
  let s = String(title || "").toLowerCase();
  VN_DIACRITICS.forEach(([from, to]) => {
    s = s.split(from).join(to);
  });
  return s.replace(/[^a-z0-9-]/g, "-").split("-").filter((p) => p.length > 0).join("-");
}
function tmdbMeta(tmdbId, mediaType) {
  return __async(this, null, function* () {
    let id = tmdbId;
    if (IMDB_ID_RE.test(String(tmdbId))) {
      const find = yield fetchJson(
        `${CONFIG.TMDB_API_BASE}/find/${tmdbId}?external_source=imdb_id&api_key=${CONFIG.TMDB_API_KEY}`
      );
      const list = mediaType === "tv" ? find.tv_results : find.movie_results;
      const first = (list || [])[0];
      if (!first)
        throw new Error(`TMDB find r\u1ED7ng cho ${tmdbId}`);
      id = first.id;
    }
    const [docEn, docVi] = yield Promise.all([
      fetchJson(`${CONFIG.TMDB_API_BASE}/${mediaType}/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=en-US`),
      fetchJson(`${CONFIG.TMDB_API_BASE}/${mediaType}/${id}?api_key=${CONFIG.TMDB_API_KEY}&language=vi`)
    ]);
    const doc = docEn || docVi || {};
    if (!doc.name && !doc.title)
      throw new Error(`TMDB ${mediaType}/${id} kh\xF4ng c\xF3 metadata`);
    const enName = doc.name || doc.title;
    const viName = docVi && (docVi.name || docVi.title) || null;
    return {
      id: String(doc.id || id),
      name: enName,
      originalName: doc.original_name || doc.original_title || enName,
      nameVi: viName && viName !== enName ? viName : null,
      year: String(doc.release_date || doc.first_air_date || "").slice(0, 4),
      seasons: Number(doc.number_of_seasons || 1)
    };
  });
}
function searchNguonc(_0) {
  return __async(this, arguments, function* (keyword, base = CONFIG.BASE_URL) {
    const data = yield fetchJson(`${base}/films/search?keyword=${encodeURIComponent(keyword)}`);
    return data && data.items || [];
  });
}
function searchNguoncSafe(_0) {
  return __async(this, arguments, function* (keyword, base = CONFIG.BASE_URL) {
    try {
      return yield searchNguonc(keyword, base);
    } catch (e) {
      console.warn(`[Ngu\u1ED3nC] search "${keyword}" l\u1ED7i: ${e.message}`);
      return [];
    }
  });
}
function titleMatches(t, want) {
  if (t === want)
    return true;
  if (!t.startsWith(want))
    return false;
  const rest = t.slice(want.length).trim();
  if (!rest)
    return true;
  return /^(\d+(st|nd|rd|th)?\s*season|season\s*\d+|s\d+|part\s*\d+|p\d+|\(\d{4}\)|\d{4}|\d+)$/i.test(rest);
}
function aliasMatches(originalName, want) {
  const aliases = String(originalName || "").split(/\s*,\s*/).filter(Boolean);
  if (!aliases.length)
    return false;
  return aliases.some((a) => titleMatches(normalizeTitle(a), want));
}
function pickItem(items, meta, season, strict = true) {
  const want = normalizeTitle(meta.originalName);
  let titleCandidate = null;
  for (const it of items || []) {
    if (!aliasMatches(it.original_name, want))
      continue;
    const phan = parsePhan(it.name, it.slug);
    if (phan === season)
      return it;
    if (!titleCandidate)
      titleCandidate = it;
  }
  if (strict)
    return null;
  return titleCandidate;
}
function slugCandidates(meta, season) {
  const names = [meta.nameVi, meta.originalName, meta.name].filter(Boolean);
  const base = [];
  names.forEach((t) => {
    const s = slugify(t);
    if (s && base.indexOf(s) === -1)
      base.push(s);
  });
  const out = [];
  base.forEach((b) => {
    out.push(b);
    if (season > 1) {
      out.push(`${b}-phan-${season}`);
      out.push(`${b}-season-${season}`);
    }
  });
  return out;
}
function fetchDetailBySlugCandidates(_0) {
  return __async(this, arguments, function* (candidates, base = CONFIG.BASE_URL) {
    const seen = {};
    for (const slug of candidates) {
      if (!slug || seen[slug])
        continue;
      seen[slug] = true;
      try {
        const detail = yield fetchJson(`${base}/film/${slug}`);
        if (detail && detail.movie && detail.movie.name) {
          return { item: { name: detail.movie.name, slug }, movie: detail.movie };
        }
      } catch (e) {
      }
    }
    return null;
  });
}
function pickEpisodeEntries(movie, episode, season) {
  const out = [];
  const eps = Number(episode) || 0;
  for (const server of movie && movie.episodes || []) {
    const items = server && server.items || [];
    const entry = items.find((e) => matchEpisodeName(e, eps, season));
    if (entry) {
      out.push({ server: server.server_name || "", embed: entry.embed, entryName: entry.name });
    }
  }
  return out;
}
function matchEpisodeName(e, episode, season) {
  const name = String(e && e.name || "");
  if (name === String(episode))
    return true;
  if (episode <= 1 && season <= 1 && (name === "1" || /full/i.test(name)))
    return true;
  return false;
}
function embedBase(url) {
  const m = /^(https?:\/\/[^/]+)/i.exec(String(url || ""));
  return m ? m[1] : null;
}
var embedHash = (url) => {
  const m = HASH_RE.exec(String(url || ""));
  return m ? m[1] : null;
};
function resolveEmbedPlaylist(embed) {
  return __async(this, null, function* () {
    const origin = embedBase(embed);
    if (!origin)
      throw new Error(`embed kh\xF4ng h\u1EE3p l\u1EC7: ${embed}`);
    if (/\.m3u8/i.test(embed) || !/embed\.php/i.test(embed)) {
      return { url: embed, origin };
    }
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: origin,
      Referer: `${origin}/`,
      "User-Agent": CONFIG.STREAM_UA
    };
    const post = (body) => fetchJson(embed, { method: "POST", headers, body: JSON.stringify(body) });
    const bs = yield post({
      action: "bootstrap",
      referrer: "",
      frame_origins: [origin],
      request_grant: true,
      playlist_format: "hls",
      pretty_url: true,
      path_chunks: true
    });
    if (!bs || !bs.bootstrap)
      throw new Error("bootstrap th\u1EA5t b\u1EA1i (streamc.xyz)");
    const issue = yield post({
      action: "issue",
      bootstrap: bs.bootstrap,
      turnstile_response: null,
      playlist_format: "hls",
      pretty_url: true,
      path_chunks: true,
      frame_origins: [origin]
    });
    if (!issue || !issue.playlist)
      throw new Error("issue th\u1EA5t b\u1EA1i (streamc.xyz)");
    let playlistText = null;
    try {
      playlistText = yield fetchText(issue.playlist, {
        headers: { Origin: origin, Referer: `${origin}/`, "User-Agent": CONFIG.STREAM_UA, Accept: "*/*" }
      });
    } catch (e) {
    }
    if (playlistText && /^#ENC-/m.test(playlistText)) {
      throw new Error("playlist b\u1ECB m\xE3 h\xF3a (#ENC-AESGCM) \u2014 app kh\xF4ng \u0111\u1ECDc \u0111\u01B0\u1EE3c");
    }
    if (playlistText && !/^#EXTM3U/m.test(playlistText)) {
      throw new Error("playlist tr\u1EA3 v\u1EC1 kh\xF4ng ph\u1EA3i HLS");
    }
    return { url: issue.playlist, origin };
  });
}
function extractStreams(_0, _1, _2, _3) {
  return __async(this, arguments, function* (tmdbId, mediaType, season, episode, options = {}) {
    if (mediaType !== "movie" && mediaType !== "tv")
      return [];
    const meta = yield tmdbMeta(tmdbId, mediaType);
    const reqSeason = Number(season) > 0 ? Number(season) : 1;
    let items = yield searchNguoncSafe(meta.originalName);
    let item = pickItem(items, meta, reqSeason, CONFIG.STRICT_SEASON);
    if (!item && meta.nameVi && meta.nameVi !== meta.originalName) {
      const viItems = yield searchNguoncSafe(meta.nameVi);
      item = pickItem(viItems, meta, reqSeason, CONFIG.STRICT_SEASON);
    }
    if (item) {
      const detail = yield fetchJson(`${CONFIG.BASE_URL}/film/${item.slug}`);
      return yield buildStreams(detail && detail.movie || {}, item, episode, reqSeason);
    }
    const slugHit = yield fetchDetailBySlugCandidates(slugCandidates(meta, reqSeason));
    if (slugHit) {
      console.warn(`[Ngu\u1ED3nC] search kh\xF4ng ra, d\xF9ng slug fallback: ${slugHit.slug}`);
      return yield buildStreams(slugHit.movie, slugHit.item, episode, reqSeason);
    }
    console.warn(`[Ngu\u1ED3nC] Kh\xF4ng c\xF3 "${meta.originalName}" season ${reqSeason} tr\xEAn nguonc.`);
    return [];
  });
}
function buildStreams(movie, item, episode, reqSeason) {
  return __async(this, null, function* () {
    const entries = pickEpisodeEntries(movie, episode, reqSeason);
    if (!entries.length) {
      console.warn(`[Ngu\u1ED3nC] ${item.name} (${item.slug}): kh\xF4ng c\xF3 t\u1EADp ${episode}.`);
      return [];
    }
    const streams = [];
    for (const ent of entries) {
      try {
        const { url, origin } = yield resolveEmbedPlaylist(ent.embed);
        const headers = {
          Referer: `${origin}/`,
          Origin: origin,
          "User-Agent": CONFIG.STREAM_UA,
          Accept: "*/*"
        };
        streams.push({
          name: CONFIG.PROVIDER_NAME,
          title: `${ent.server} \xB7 T\u1EADp ${ent.entryName}`,
          url,
          type: "hls",
          headers,
          behaviorHints: {
            proxyHeaders: { request: headers },
            videoHash: embedHash(ent.embed)
          }
        });
      } catch (e) {
        console.warn(`[Ngu\u1ED3nC] ${item.name} T${episode} [${ent.server}]: ${e.message}`);
      }
    }
    return streams;
  });
}

// src/nguonc/index.js
function getStreams(tmdbId, mediaType, season, episode, options) {
  return __async(this, null, function* () {
    try {
      return yield extractStreams(tmdbId, mediaType, season, episode, options);
    } catch (error) {
      console.error("[Ngu\u1ED3nC] Error:", error && error.message ? error.message : String(error));
      return [];
    }
  });
}
module.exports = { getStreams, resolveEmbedPlaylist };
