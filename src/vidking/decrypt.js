/**
 * Giải mã payload sources của SpeedRacelight (port nguyên văn từ vidking.net
 * assets/VideoPlayer-*.js, hàm Pf). Thuần JS — KHÔNG dùng atob/TextDecoder/
 * Buffer (không chắc có trong quickjs-kt runtim của app).
 *
 * Sơ đồ (từ bundle):
 *   payload = base64url( ciphertext )  — chữ ký 4 byte đầu "mvm1" (Ys)
 *   keystream = xorStream(seedString, mediaId, len)  — PRNG kiểu RC4/SHA trộn seed
 *   plain = (ciphertext XOR keystream) bỏ prefix "mvm1" → UTF-8 JSON
 */

// ---- Hằng số verbatim từ vk-player.js ----
const Hl = [
    1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
    2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
    1925078388, 2162078206, 2614888103, 3248222580,
];
const _f = [1732584193, 4023233417, 2562383102, 271733878];
const Js = 61;
const Sf = 8;
const ms = 2654435769; // 0x9E3779B9
const Ys = [109, 118, 109, 49]; // "mvm1"

const bf = (l) => (l * (l + 1) & 1) === 0;
const If = (l) => (l * (l + 1) & 1) === 1;

function ci(l) {
    l = l >>> 0;
    l ^= l >>> 16;
    l = Math.imul(l, 2246822507) >>> 0;
    l ^= l >>> 13;
    l = Math.imul(l, 3266489909) >>> 0;
    l ^= l >>> 16;
    return l >>> 0;
}

function ps(l, o) {
    l = l >>> 0;
    o &= 31;
    return o === 0 ? l >>> 0 : ((l << o) | (l >>> (32 - o))) >>> 0;
}

function Af(l) {
    let o = _f[0] >>> 0;
    for (let e = 0; e < l.length; e++) {
        o = ps((o ^ Math.imul(l.charCodeAt(e), Hl[e & 15])) >>> 0, 5);
    }
    return ci(o);
}

function wf(l) {
    const o = new Array(256);
    for (let i = 0; i < 256; i++) o[i] = i;
    let e = 0;
    for (let i = 0; i < 256; i++) {
        e = (e + o[i] + l.charCodeAt(i % l.length)) & 255;
        const r = o[i];
        o[i] = o[e];
        o[e] = r;
    }
    return o;
}

function vf(l) {
    let o = 2166136261;
    for (let e = 0; e < l.length; e++) {
        o = Math.imul(o ^ l.charCodeAt(e), 16777619) >>> 0;
    }
    return ci(o);
}

function Nf(l, o, e) {
    return ((l ^ o) >>> 0 | (l & o & e) >>> 0) >>> 0;
}

function Rf(l, o) {
    if (If(l.length)) {
        return { S: wf(l), acc: Af(l) };
    }
    const e = new Array(Js);
    let i = ci((vf(l) ^ ci((o >>> 0) ^ ms)) >>> 0) >>> 0;
    for (let r = 0; r < Sf; r++) {
        if (bf(r)) {
            const n = i % Js;
            i = ps((i + ms) >>> 0, 7 + (r & 7));
            e[n] = (i ^ ci(i)) >>> 0;
            i = ci((i + n) >>> 0) >>> 0;
        } else {
            e[r] = Hl[r & 15];
        }
    }
    return { S: e, acc: ci((i ^ 2779096485) >>> 0) >>> 0 };
}

function Cf(l, o) {
    const e = l.S;
    let i = l.acc >>> 0;
    const r = i % Js;
    const n = 0 - +(r in e);
    const u = (e[r] || 0) >>> 0;
    const d = Math.imul(ms, o + 1) >>> 0;
    let g = Nf(i, (u ^ d) >>> 0, n) >>> 0;
    g = (ps((g + i) >>> 0, r & 31) ^ ps(i, Math.imul(r, 7) & 31)) >>> 0;
    i = ci((g + ms) >>> 0) >>> 0;
    e[r] = i >>> 0;
    l.acc = i >>> 0;
    return i >>> 0;
}

function xf(l, o, e) {
    const i = Rf(l, o);
    const r = new Array(e);
    let n = 0;
    for (let u = 0; u < e;) {
        const d = Cf(i, n++);
        r[u++] = d & 255;
        if (u < e) r[u++] = (d >>> 8) & 255;
        if (u < e) r[u++] = (d >>> 16) & 255;
        if (u < e) r[u++] = (d >>> 24) & 255;
    }
    return r;
}

// ---- base64url -> byte array (thủ công, không atob) ----
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64urlToBytes(s) {
    const t = String(s).replace(/-/g, '+').replace(/_/g, '/');
    const rem = t.length % 4;
    const padded = rem === 2 ? t + '==' : (rem === 3 ? t + '=' : (rem === 1 ? t + '===' : t));
    const out = [];
    let buf = 0;
    let bits = 0;
    for (let i = 0; i < padded.length; i++) {
        const ch = padded.charAt(i);
        if (ch === '=') break;
        const v = B64_CHARS.indexOf(ch);
        if (v < 0) continue;
        buf = (buf << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push((buf >>> bits) & 0xff);
        }
    }
    return out;
}

// ---- UTF-8 byte array -> string (thủ công, không TextDecoder) ----
function utf8ToString(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length;) {
        const b = bytes[i];
        if (b < 0x80) {
            s += String.fromCharCode(b);
            i += 1;
        } else if ((b >> 5) === 0x6) {
            s += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
            i += 2;
        } else if ((b >> 4) === 0xe) {
            s += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
            i += 3;
        } else {
            const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
            s += String.fromCharCode(cp & 0xffff);
            i += 4;
        }
    }
    return s;
}

/**
 * Giải mã payload sources.
 * @param {string} payload  response text từ /cdn/sources-with-title (base64url)
 * @param {string} seed     seed từ /seed?mediaId=
 * @param {number|string} mediaId  tmdbId int (tham số PRNG)
 * @returns {object} { sources, subtitles, thumbnail, ... } — throw nếu bad seed
 */
export function decryptPayload(payload, seed, mediaId) {
    const bytes = base64urlToBytes(payload);
    const key = xf(String(seed), parseInt(String(mediaId), 10) || 0, bytes.length);
    for (let n = 0; n < bytes.length; n++) bytes[n] ^= key[n];
    for (let n = 0; n < Ys.length; n++) {
        if (bytes[n] !== Ys[n]) {
            throw new Error('decrypt failed: bad seed or tampered payload');
        }
    }
    const json = utf8ToString(bytes.slice(Ys.length));
    return JSON.parse(json);
}