/**
 * KKPhim Provider - HTTP Utilities
 * Chỉ dùng global fetch (Hermes-safe), không cần axios/node-fetch.
 */

import { CONFIG } from './config.js';

const TIMEOUT_MS = 15000;

/**
 * Fetch có giới hạn thời gian THẬT: abort signal để đóng socket khi treo —
 * nếu chỉ Promise.race với setTimeout, request bên dưới vẫn rò (event loop
 * không thoát, player/app leak). QuickJS/Hermes: feature-detect AbortController,
 * không có thì vẫn timeout bằng timer (bỏ sót abort, chấp nhận được).
 */
export async function fetchJson(url, options = {}) {
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

    return await response.json();
}