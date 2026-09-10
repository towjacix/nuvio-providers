import { CONFIG } from './config.js';

const TIMEOUT_MS = 15000;

async function request(url, options = {}) {
    let controller = null;
    let signal;
    if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
        signal = controller.signal;
    }

    const timer = setTimeout(() => {
        if (controller) controller.abort();
    }, TIMEOUT_MS);

    let response;
    try {
        response = await fetch(url, {
            ...options,
            headers: {
                ...CONFIG.HEADERS,
                ...(options.headers || {}),
            },
            signal,
        });
    } catch (e) {
        clearTimeout(timer);
        throw new Error((e && e.name === 'AbortError')
            ? `timeout sau ${TIMEOUT_MS}ms`
            : (e && e.message) || 'fetch error');
    }
    clearTimeout(timer);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return response;
}

export async function fetchJson(url, options = {}) {
    const response = await request(url, options);
    return await response.json();
}

export async function fetchText(url, options = {}) {
    const response = await request(url, options);
    return await response.text();
}
