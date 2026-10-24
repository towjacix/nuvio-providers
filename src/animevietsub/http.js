import { CONFIG } from './config.js';

const TIMEOUT_MS = 15000;

/** Cookie jar đơn giản (CS3 globalCookies) — CF/redirect đôi khi set cookie cần mang theo. */
let globalCookies = '';

function mergeCookies(setCookies) {
    if (!setCookies || !setCookies.length) return;
    const jar = new Map();
    for (const pair of String(globalCookies).split('; ')) {
        const eq = pair.indexOf('=');
        if (eq > 0) jar.set(pair.slice(0, eq), pair);
    }
    for (const raw of setCookies) {
        const first = String(raw).split(';')[0];
        const eq = first.indexOf('=');
        if (eq > 0) jar.set(first.slice(0, eq), first);
    }
    globalCookies = Array.from(jar.values()).join('; ');
}

function readSetCookies(response) {
    if (!response || !response.headers) return [];
    try {
        if (typeof response.headers.getSetCookie === 'function') {
            return response.headers.getSetCookie() || [];
        }
    } catch (e) { /* fallthrough */ }
    const raw = response.headers.get('set-cookie');
    return raw ? raw.split(/,(?=\s*[^;,\s]+=)/) : [];
}

/**
 * Fetch với timeout TÙY MÔI TRƯỜNG (pattern kkphim/bluphim):
 * - Node (test/e2e): setTimeout có sẵn → abort sau 15s.
 * - Runtime app Nuvio (quickjs-kt): KHÔNG có setTimeout → bỏ qua (gọi là TypeError).
 */
async function request(url, options = {}) {
    const hasTimers = typeof setTimeout === 'function' && typeof clearTimeout === 'function';
    let controller = null;
    if (hasTimers) {
        try { controller = new AbortController(); } catch (e) { controller = null; }
    }
    let timer = null;
    if (controller) {
        timer = setTimeout(() => {
            try { controller.abort(); } catch (e) { /* noop */ }
        }, TIMEOUT_MS);
    }

    const headers = {
        ...CONFIG.HEADERS,
        ...(options.headers || {}),
    };
    if (globalCookies && !headers.Cookie) headers.Cookie = globalCookies;

    try {
        const response = await fetch(url, {
            redirect: options.redirect || 'follow',
            ...options,
            headers,
            ...(controller ? { signal: controller.signal } : {}),
        });
        if (timer !== null) {
            try { clearTimeout(timer); } catch (e) { /* noop */ }
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
            try { clearTimeout(timer); } catch (e2) { /* noop */ }
        }
        if (e && e.status) throw e;
        const msg = (e && e.name === 'AbortError')
            ? `timeout sau ${TIMEOUT_MS}ms`
            : (e && e.message) || 'fetch error';
        const err = new Error(msg);
        if (/^HTTP (\d+)/.test(msg)) err.status = Number(msg.match(/^HTTP (\d+)/)[1]);
        throw err;
    }
}

const RETRYABLE = (e) => !(e && e.status && e.status >= 400 && e.status < 500);

async function requestWithRetry(url, options = {}) {
    try {
        return await request(url, options);
    } catch (e) {
        if (!RETRYABLE(e)) throw e;
        return await request(url, options);
    }
}

export async function fetchJson(url, options = {}) {
    const response = await requestWithRetry(url, options);
    return await response.json();
}

export async function fetchText(url, options = {}) {
    const response = await requestWithRetry(url, options);
    return await response.text();
}

/**
 * fetchText + theo dõi redirect kiểu CS3 fetchWithBypass:
 * - merge Set-Cookie vào jar chung
 * - HTML chứa window.location.href = "..." → follow (tối đa 3 hop, JS-redirect của CF anti-bot)
 * Trả { text, url } (url = URL cuối cùng).
 */
const JS_REDIRECT_RE = /window\.location\.href\s*=\s*["']([^"']+)["']/;

export async function fetchDoc(url, referer) {
    let currentUrl = url;
    let text = '';
    for (let hop = 0; hop < 4; hop++) {
        const options = referer ? { headers: { Referer: referer } } : {};
        const response = await requestWithRetry(currentUrl, options);
        text = await response.text();
        const m = text.match(JS_REDIRECT_RE);
        if (!m || !text.includes('window.location.href')) return { text, url: currentUrl };
        let next = m[1];
        if (!next.startsWith('http')) {
            try { next = new URL(next, currentUrl).toString(); } catch (e) { return { text, url: currentUrl }; }
        }
        currentUrl = next;
    }
    return { text, url: currentUrl };
}

/** POST form-urlencoded (ajax/suggest, ajax/player). */
export async function postForm(url, params, referer) {
    const body = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const response = await requestWithRetry(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            Accept: '*/*',
            ...(referer ? { Referer: referer, Origin: new URL(referer).origin } : {}),
        },
        body,
    });
    return await response.text();
}

export function resetCookies() {
    globalCookies = '';
}
