import { CONFIG } from './config.js';

const TIMEOUT_MS = 15000;

/**
 * Environment-dependent fetch timeout (same as kkphim):
 * - Node (test/e2e): has setTimeout/clearTimeout → abort after 15s.
 * - Nuvio app runtime (quickjs-kt): setTimeout is NOT injected → calling it throws
 *   TypeError before fetch. __native_fetch runs synchronously (runBlocking) so a JS timer
 *   never fires in time anyway — omit the timer when unavailable.
 * Any !ok response → throw "HTTP {status} for {url}".
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