/**
 * KKPhim Provider - HTTP Utilities
 * Chỉ dùng global fetch (Hermes-safe), không cần axios/node-fetch.
 */

import { CONFIG } from './config.js';

/**
 * Fetch JSON từ KKPhim API.
 * @param {string} url
 * @param {object} [options] - fetch options; options.headers được merge
 * @returns {Promise<object>} parsed JSON
 */
export async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...CONFIG.HEADERS,
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.json();
}