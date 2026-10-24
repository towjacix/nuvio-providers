import { CONFIG } from './config.js';

const TIMEOUT_MS = 15000;

/**
 * Fetch with env-dependent timeout:
 * - Node (test/e2e): has setTimeout/clearTimeout → abort after 15s (avoid hangs on CDN throttle).
 * - Nuvio runtime (quickjs-kt): setTimeout NOT injected → calling it throws TypeError before
 *   fetch; also __native_fetch runs blocking so a JS timer could never fire — omit it.
 * Any !ok → throw "HTTP {status} for {url}".
 */
async function request(url, options = {}) {
    const hasTimers = typeof setTimeout === 'function' && typeof clearTimeout === 'function';
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
            try { controller.abort(); } catch (e) { /* noop */ }
        }, TIMEOUT_MS);
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...CONFIG.HEADERS,
                ...(options.headers || {}),
            },
            ...(controller ? { signal: controller.signal } : {}),
        });
        if (timer !== null) {
            try { clearTimeout(timer); } catch (e) { /* noop */ }
        }
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${url}`);
        }
        return response;
    } catch (e) {
        if (timer !== null) {
            try { clearTimeout(timer); } catch (e2) { /* noop */ }
        }
        throw new Error((e && e.name === 'AbortError')
            ? `timeout after ${TIMEOUT_MS}ms`
            : (e && e.message) || 'fetch error');
    }
}

export async function fetchJson(url, options = {}) {
    const response = await request(url, options);
    return await response.json();
}

export async function fetchText(url, options = {}) {
    const response = await request(url, options);
    return await response.text();
}
