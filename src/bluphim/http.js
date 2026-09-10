import { CONFIG } from './config.js';

const TIMEOUT_MS = 15000;

/**
 * Fetch với timeout TÙY MÔI TRƯỜNG (pattern kkphim/vidking):
 * - Node (test/e2e): setTimeout/clearTimeout có sẵn → abort sau 15s.
 * - Runtime app Nuvio (quickjs-kt): KHÔNG inject setTimeout → không gọi (TypeError giết script),
 *   __native_fetch chạy đồng bộ (runBlocking) nên timer JS không bao giờ kịp abort.
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
            ? `timeout sau ${TIMEOUT_MS}ms`
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
