import { CONFIG } from './config.js';

const TIMEOUT_MS = 15000;

/**
 * Fetch with environment-dependent timeout (kkphim/vidking pattern):
 * - Node (test/e2e): setTimeout/clearTimeout available → abort after 15s.
 * - Nuvio app runtime (quickjs-kt): setTimeout NOT injected → must not call it (TypeError kills
 *   the script); __native_fetch runs synchronously (runBlocking) so a JS timer could never fire
 *   in time to abort anyway.
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
        const msg = (e && e.name === 'AbortError')
            ? `timeout after ${TIMEOUT_MS}ms`
            : (e && e.message) || 'fetch error';
        const err = new Error(msg);
        // Keep HTTP status so the caller can tell network errors (retryable) from 4xx (not).
        if (/^HTTP (\d+)/.test(msg)) err.status = Number(msg.match(/^HTTP (\d+)/)[1]);
        throw err;
    }
}

const RETRYABLE = (e) => !(e && e.status && e.status >= 400 && e.status < 500);

/** Site is slow (~6s/hop) and often resets connections → retry once for network/timeout errors. */
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
