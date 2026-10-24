/**
 * animevietsub - Built from src/animevietsub/
 * Generated: 2026-10-24T16:22:57.784Z
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

// src/animevietsub/config.js
var CONFIG = {
  // Shortlink entry giống CS3; fetch lấy final origin. Fallback khi request fail.
  ENTRY_URL: "https://bit.ly/animevietsubtv",
  FALLBACK_BASE_URL: "https://animevietsub.li",
  LEGACY_FALLBACK: "https://animevietsub.site",
  // fallback của CS3
  HEADERS: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
    "Upgrade-Insecure-Requests": "1"
  },
  PROVIDER_NAME: "AnimeVietSub",
  TMDB_API_BASE: "https://api.themoviedb.org/3",
  TMDB_API_KEY: "1865f43a0549ca50d341dd9ab8b29f49",
  // Số server tối đa resolve qua /ajax/player mỗi episode
  MAX_SERVERS: 6
};

// src/animevietsub/http.js
var TIMEOUT_MS = 15e3;
var globalCookies = "";
function mergeCookies(setCookies) {
  if (!setCookies || !setCookies.length)
    return;
  const jar = /* @__PURE__ */ new Map();
  for (const pair of String(globalCookies).split("; ")) {
    const eq = pair.indexOf("=");
    if (eq > 0)
      jar.set(pair.slice(0, eq), pair);
  }
  for (const raw of setCookies) {
    const first = String(raw).split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0)
      jar.set(first.slice(0, eq), first);
  }
  globalCookies = Array.from(jar.values()).join("; ");
}
function readSetCookies(response) {
  if (!response || !response.headers)
    return [];
  try {
    if (typeof response.headers.getSetCookie === "function") {
      return response.headers.getSetCookie() || [];
    }
  } catch (e) {
  }
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(/,(?=\s*[^;,\s]+=)/) : [];
}
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
    const headers = __spreadValues(__spreadValues({}, CONFIG.HEADERS), options.headers || {});
    if (globalCookies && !headers.Cookie)
      headers.Cookie = globalCookies;
    try {
      const response = yield fetch(url, __spreadValues(__spreadProps(__spreadValues({
        redirect: options.redirect || "follow"
      }, options), {
        headers
      }), controller ? { signal: controller.signal } : {}));
      if (timer !== null) {
        try {
          clearTimeout(timer);
        } catch (e) {
        }
      }
      mergeCookies(readSetCookies(response));
      if (!response.ok) {
        const err = new Error(`HTTP ${response.status} for ${url}`);
        err.status = response.status;
        throw err;
      }
      return response;
    } catch (e) {
      if (timer !== null) {
        try {
          clearTimeout(timer);
        } catch (e2) {
        }
      }
      if (e && e.status)
        throw e;
      const msg = e && e.name === "AbortError" ? `timeout sau ${TIMEOUT_MS}ms` : e && e.message || "fetch error";
      const err = new Error(msg);
      if (/^HTTP (\d+)/.test(msg))
        err.status = Number(msg.match(/^HTTP (\d+)/)[1]);
      throw err;
    }
  });
}
var RETRYABLE = (e) => !(e && e.status && e.status >= 400 && e.status < 500);
function requestWithRetry(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    try {
      return yield request(url, options);
    } catch (e) {
      if (!RETRYABLE(e))
        throw e;
      return yield request(url, options);
    }
  });
}
function fetchJson(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield requestWithRetry(url, options);
    return yield response.json();
  });
}
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const response = yield requestWithRetry(url, options);
    return yield response.text();
  });
}
var JS_REDIRECT_RE = /window\.location\.href\s*=\s*["']([^"']+)["']/;
function fetchDoc(url, referer) {
  return __async(this, null, function* () {
    let currentUrl = url;
    let text = "";
    for (let hop = 0; hop < 4; hop++) {
      const options = referer ? { headers: { Referer: referer } } : {};
      const response = yield requestWithRetry(currentUrl, options);
      text = yield response.text();
      const m = text.match(JS_REDIRECT_RE);
      if (!m || !text.includes("window.location.href"))
        return { text, url: currentUrl };
      let next = m[1];
      if (!next.startsWith("http")) {
        try {
          next = new URL(next, currentUrl).toString();
        } catch (e) {
          return { text, url: currentUrl };
        }
      }
      currentUrl = next;
    }
    return { text, url: currentUrl };
  });
}
function postForm(url, params, referer) {
  return __async(this, null, function* () {
    const body = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    const response = yield requestWithRetry(url, {
      method: "POST",
      headers: __spreadValues({
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Accept: "*/*"
      }, referer ? { Referer: referer, Origin: new URL(referer).origin } : {}),
      body
    });
    return yield response.text();
  });
}

// src/animevietsub/decrypt.js
var UTF8_CHARS = [];
for (let i = 0; i < 128; i++)
  UTF8_CHARS.push(String.fromCharCode(i));

// src/animevietsub/extractor.js
var cachedBaseUrl = null;
function resetBaseUrlCache() {
  cachedBaseUrl = null;
}
var decodeEntities = (s) => String(s || "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
function resolveBaseUrl() {
  return __async(this, null, function* () {
    if (cachedBaseUrl)
      return cachedBaseUrl;
    try {
      const r = yield fetch(CONFIG.ENTRY_URL, {
        redirect: "follow",
        headers: CONFIG.HEADERS
      });
      const finalUrl = r && r.url ? r.url : "";
      if (finalUrl.startsWith("http") && !finalUrl.includes("bit.ly")) {
        const u = new URL(finalUrl);
        cachedBaseUrl = `${u.protocol}//${u.host}`;
        return cachedBaseUrl;
      }
    } catch (e) {
    }
    try {
      yield fetchText(CONFIG.FALLBACK_BASE_URL + "/");
      cachedBaseUrl = CONFIG.FALLBACK_BASE_URL;
      return cachedBaseUrl;
    } catch (e) {
      try {
        yield fetchText(CONFIG.LEGACY_FALLBACK + "/");
        cachedBaseUrl = CONFIG.LEGACY_FALLBACK;
        return cachedBaseUrl;
      } catch (e2) {
        cachedBaseUrl = CONFIG.FALLBACK_BASE_URL;
        return cachedBaseUrl;
      }
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
    const hit = (kind === "tv" ? json.tv_results : json.movie_results) || [];
    if (!hit.length || !hit[0].id)
      throw new Error(`kh\xF4ng resolve \u0111\u01B0\u1EE3c imdb ${raw}`);
    return hit[0].id;
  });
}
function tmdbMeta(numericId, mediaType) {
  return __async(this, null, function* () {
    const kind = mediaType === "tv" ? "tv" : "movie";
    const url = `${CONFIG.TMDB_API_BASE}/${kind}/${numericId}?api_key=${CONFIG.TMDB_API_KEY}&append_to_response=external_ids`;
    const json = yield fetchJson(url);
    const title = json && (json.title || json.name) ? String(json.title || json.name) : "";
    const orig = json && (json.original_title || json.original_name) ? String(json.original_title || json.original_name) : "";
    const dateStr = String(json && (json.release_date || json.first_air_date) || "");
    const year = /^\d{4}/.test(dateStr) ? dateStr.slice(0, 4) : "";
    const imdbId = json && json.external_ids && typeof json.external_ids.imdb_id === "string" ? json.external_ids.imdb_id : "";
    return { title, originalTitle: orig, year, imdbId };
  });
}
var stripTags = (s) => decodeEntities(String(s || "").replace(/<[^>]+>/g, "").trim());
function searchSuggest(base, query) {
  return __async(this, null, function* () {
    const html = yield postForm(`${base}/ajax/suggest`, { ajaxSearch: "1", keysearch: query }, base + "/");
    const items = [];
    const liRe = /<li[\s>]([\s\S]*?)<\/li>/gi;
    let m;
    while ((m = liRe.exec(html)) !== null) {
      const block = m[1];
      if (/ss-bottom/.test(block))
        continue;
      const hrefM = block.match(/<a[^>]*class="thumb"[^>]*href="([^"]+)"/i) || block.match(/<a[^>]*href="([^"]+)"[^>]*class="thumb"/i);
      if (!hrefM)
        continue;
      const titleM = block.match(/class="ss-title"[^>]*>([\s\S]*?)<\//i);
      const title = stripTags(titleM ? titleM[1] : "");
      if (!title)
        continue;
      let href = hrefM[1];
      if (href.startsWith("/"))
        href = base + href;
      items.push({ title, href });
    }
    return items;
  });
}
function parseSearchPage(html, base) {
  const items = [];
  const liRe = /<li[^>]*class="[^"]*TPostMv[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html)) !== null) {
    const block = m[1];
    const hrefM = block.match(/<a[^>]*href="([^"]+)"/i);
    const titleM = block.match(/<h2[^>]*class="[^"]*Title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i) || block.match(/class="[^"]*Title[^"]*"[^>]*>([\s\S]*?)<\//i);
    if (!hrefM || !titleM)
      continue;
    const title = stripTags(titleM[1]);
    if (!title)
      continue;
    let href = hrefM[1];
    if (href.startsWith("/"))
      href = base + href;
    items.push({ title, href });
  }
  return items;
}
var norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9à-ỹ]+/g, " ").trim();
var slugOf = (href) => {
  const m = String(href || "").match(/\/([a-z0-9-]+?)(?:\.html)?\/?$/i);
  return m ? m[1].replace(/-/g, " ") : "";
};
function pickCandidate(candidates, meta) {
  if (!candidates.length)
    return null;
  const wantTitles = [meta.title, meta.originalTitle].filter(Boolean).map(norm);
  for (const c of candidates) {
    const hay = `${norm(c.title)} ${slugOf(c.href)}`;
    for (const t of wantTitles) {
      if (!t)
        continue;
      const tokens = t.split(" ").filter((w) => w.length > 1);
      if (!tokens.length)
        continue;
      if (tokens.every((w) => hay.includes(w)))
        return c;
    }
  }
  return null;
}
function parseEpisodeServers(html) {
  const map = /* @__PURE__ */ new Map();
  const addEp = (epNum, groupName, hash, id, href) => {
    if (!hash)
      return;
    const key = String(epNum || "").trim();
    if (!map.has(key))
      map.set(key, []);
    map.get(key).push({ groupName: groupName || "VIP", hash, id: id || "", href: href || "" });
  };
  const groupRe = /<div[^>]*class="[^"]*server-group[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*server-group|$)/gi;
  let gm;
  let sawGroup = false;
  while ((gm = groupRe.exec(html)) !== null) {
    sawGroup = true;
    const block = gm[1];
    const gNameM = block.match(/<h3[^>]*class="[^"]*server-(?:name|title)[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
    const groupName = gNameM ? stripTags(gNameM[1]) : "VIP";
    const aRe = /<a\b([^>]*class="[^"]*btn-episode[^"]*"[^>]*)>/gi;
    let am;
    while ((am = aRe.exec(block)) !== null) {
      const attrs = am[1];
      const hash = (attrs.match(/data-hash="([^"]*)"/i) || [])[1] || "";
      const id = (attrs.match(/data-id="([^"]*)"/i) || [])[1] || "";
      const href = (attrs.match(/href="([^"]*)"/i) || [])[1] || "";
      const titleM = attrs.match(/title="([^"]*)"/i);
      const rest = block.slice(am.index + am[0].length);
      const closeIdx = rest.indexOf("</a>");
      const inner = closeIdx >= 0 ? rest.slice(0, closeIdx) : "";
      const epNum = (titleM ? titleM[1] : stripTags(inner)) || stripTags(inner);
      addEp(epNum, groupName, hash, id, href);
    }
  }
  if (!sawGroup || map.size === 0) {
    const aRe = /<a\b([^>]*href="[^"]*"[^>]*data-hash="[^"]*"[^>]*)>|<a\b([^>]*data-hash="[^"]*"[^>]*href="[^"]*"[^>]*)>/gi;
    let am;
    while ((am = aRe.exec(html)) !== null) {
      const attrs = am[1] || am[2] || "";
      const hash = (attrs.match(/data-hash="([^"]*)"/i) || [])[1] || "";
      const id = (attrs.match(/data-id="([^"]*)"/i) || [])[1] || "";
      const href = (attrs.match(/href="([^"]*)"/i) || [])[1] || "";
      const titleM = attrs.match(/title="([^"]*)"/i);
      const rest = html.slice(am.index + am[0].length);
      const closeIdx = rest.indexOf("</a>");
      const inner = closeIdx >= 0 ? rest.slice(0, closeIdx) : "";
      const epNum = (titleM ? titleM[1] : stripTags(inner)) || stripTags(inner);
      addEp(epNum, "VIP", hash, id, href);
    }
  }
  return map;
}
var EP_NUM_RE = /\d+([.,]\d+)?/g;
function epNumberOf(epName) {
  const matches = String(epName || "").match(EP_NUM_RE);
  if (!matches || !matches.length)
    return null;
  return parseFloat(matches[matches.length - 1].replace(",", "."));
}
function toWatchUrl(base, href) {
  let u = String(href || "");
  if (u.startsWith("/"))
    u = base + u;
  if (u.includes("xem-phim.html"))
    return u;
  return u.replace(/\/$/, "") + "/xem-phim.html";
}
function resolveServers(base, servers, referer) {
  return __async(this, null, function* () {
    const out = [];
    for (const s of servers.slice(0, CONFIG.MAX_SERVERS)) {
      try {
        const text = yield postForm(`${base}/ajax/player`, { link: s.hash, id: s.id }, referer);
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          continue;
        }
        const link = json && json.link ? String(json.link) : "";
        const playTech = json && json.playTech ? String(json.playTech) : "";
        if (!link)
          continue;
        out.push({
          groupName: s.groupName,
          url: link,
          playTech,
          isGoogleCdn: playTech === "iframe" && link.includes("googleapiscdn.com")
        });
      } catch (e) {
      }
    }
    return out;
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
      console.warn(`[AnimeVietSub] TMDB kh\xF4ng c\xF3 title cho ${mediaType} ${tmdbId}`);
      return [];
    }
    let candidates = [];
    const queries = [meta.title, meta.originalTitle].filter(Boolean);
    for (const q of queries) {
      try {
        candidates = yield searchSuggest(base, q);
      } catch (e) {
        candidates = [];
      }
      if (candidates.length)
        break;
    }
    if (!candidates.length) {
      for (const q of queries) {
        try {
          const { text } = yield fetchDoc(`${base}/tim-kiem/${encodeURIComponent(q)}/`, base + "/");
          candidates = parseSearchPage(text, base);
        } catch (e) {
          candidates = [];
        }
        if (candidates.length)
          break;
      }
    }
    if (!candidates.length)
      return [];
    const picked = pickCandidate(candidates, meta);
    if (!picked)
      return [];
    const watchUrl = toWatchUrl(base, picked.href);
    const { text: watchHtml } = yield fetchDoc(watchUrl, base + "/");
    const epMap = parseEpisodeServers(watchHtml);
    if (!epMap.size)
      return [];
    let servers = null;
    if (tv) {
      const want = parseFloat(episode);
      for (const [epName, list] of epMap) {
        const n = epNumberOf(epName);
        if (n !== null && Math.abs(n - want) < 1e-3) {
          servers = list;
          break;
        }
      }
    } else {
      for (const [epName, list] of epMap) {
        if (/full|ho[aà]n t[aấ]t|tap full/i.test(epName)) {
          servers = list;
          break;
        }
      }
      if (!servers)
        servers = epMap.values().next().value;
    }
    if (!servers || !servers.length)
      return [];
    const links = yield resolveServers(base, servers, watchUrl);
    const items = [];
    const seen = /* @__PURE__ */ new Set();
    for (const l of links) {
      if (l.isGoogleCdn) {
        continue;
      }
      if (!/^https?:/i.test(l.url))
        continue;
      if (seen.has(l.url))
        continue;
      seen.add(l.url);
      const isHls = l.url.includes(".m3u8");
      items.push({
        title: `AnimeVietSub [${l.groupName}]`,
        name: `AnimeVietSub (${l.groupName})`,
        url: l.url,
        type: isHls ? "hls" : void 0,
        headers: { Referer: base + "/", "User-Agent": CONFIG.HEADERS["User-Agent"] }
      });
    }
    return items;
  });
}

// src/animevietsub/index.js
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      return yield extractStreams(tmdbId, mediaType, season, episode);
    } catch (error) {
      console.error("[AnimeVietSub] Error:", error && error.message ? error.message : String(error));
      return [];
    }
  });
}
module.exports = { getStreams, resetBaseUrlCache };
