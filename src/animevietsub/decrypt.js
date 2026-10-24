/**
 * AnimeVietSub decrypt pipeline — port nguyên văn từ h0dev/0cs3 AnimeVietsubProvider.
 * Runtime quickjs-kt KHÔNG có WebCrypto/atob/TextDecoder → mọi thứ thuần JS.
 *
 * Pipeline CS3 (interceptor; Nuvio KHÔNG dùng được phần m3u8 trả về vì
 * stream item chỉ nhận URL — giữ đây để unit-test + tái dùng nếu sau này
 * app có cách inject playlist):
 *
 *   1. extractAvsToken(playerHtml): const avsToken = "..."(+"..."...)  → JWT
 *   2. playlistUrl = {playerBase}/playlist/{videoHash}/playlist.m3u8?token=JWT
 *   3. processEncryptedM3u8(m3u8Text, headers, avsToken):
 *      - jtiOdd = các ký tự vị trí lẻ của claim "jti" trong JWT
 *      - envelope từ header x-envelope|x-avs-envelope|x-stream-envelope
 *        (base64url "USDK\x01" + len16be + urlencoded JSON {cn,sk,ts,uid})
 *        hoặc headers x-edge-tag(cn)/x-cache-node(sk)/x-request-trace(ts)/
 *        x-proxy-digest(uid, urlencoded)
 *      - gom các giá trị ?..._t= trên dòng không-comment → concat
 *      - thử 2 unshuffle × 2 format HMAC data:
 *          data = uid:ts:sk:0  |  uid:ts:sk
 *          key  = HMAC-SHA256(key=cnBytes, data)
 *          body = AES-256-GCM(encryptedBlob, key, iv=cn[0..12], tag128)
 *        unshuffle: stringUnshuffle(s, sk) hoặc identity
 *      - nếu body không chứa "#EXTINF" và không chứa "/hls/" → descramble(raw, sk, ts)
 *      - ghép headerLines + body, đảm bảo #EXT-X-ENDLIST
 *   4. decryptM3u8SegmentUrls(text, jtiOdd):
 *      với mỗi dòng /hls/{24hex}.ts?e={b64url}&i={n}:
 *          key = HMAC-SHA256(key=jtiOdd, "url-cipher|"+fileId)
 *          URL = AES-256-CTR(key, counter[16B, 4B cuối = i big-endian])(b64url(e))
 *      drop dòng urn:avs:shield và .ts còn lại chưa giải được.
 *   5. Segment thật có thể phủ vỏ PNG: bỏ prefix tới vị trí i sao cho
 *      byte[i + k*188] == 0x47 với k=1..7 (TS sync) — findAvsPngPrefixLength.
 */

// ---------- base64url / bytes ----------

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function b64UrlDecode(str) {
    let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4 !== 0) s += '=';
    const out = [];
    for (let i = 0; i < s.length;) {
        const a = B64_CHARS.indexOf(s[i++]);
        const b = B64_CHARS.indexOf(s[i++]);
        const c = s[i] === '=' ? -1 : B64_CHARS.indexOf(s[i++]);
        const d = s[i] === '=' ? -1 : B64_CHARS.indexOf(s[i++]);
        if (a < 0 || b < 0) break;
        out.push((a << 2) | (b >> 4));
        if (c >= 0) out.push(((b & 15) << 4) | (c >> 2));
        if (d >= 0) out.push(((c & 3) << 6) | d);
    }
    return out;
}

const UTF8_CHARS = [];
for (let i = 0; i < 128; i++) UTF8_CHARS.push(String.fromCharCode(i));

export function bytesToUtf8(bytes) {
    let out = '';
    const n = bytes.length;
    for (let i = 0; i < n; i++) {
        const b = bytes[i] & 0xff;
        if (b < 0x80) {
            out += UTF8_CHARS[b];
        } else if (b < 0xe0) {
            out += String.fromCharCode(((b & 31) << 6) | (bytes[++i] & 63));
        } else if (b < 0xf0) {
            out += String.fromCharCode(((b & 15) << 12) | ((bytes[++i] & 63) << 6) | (bytes[++i] & 63));
        } else {
            i += 3;
            out += '?';
        }
    }
    return out;
}

export function utf8ToBytes(s) {
    const str = String(s);
    const out = [];
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i);
        if (c < 0x80) {
            out.push(c);
        } else if (c < 0x800) {
            out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
        } else {
            out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        }
    }
    return out;
}

// ---------- SHA-256 ----------

const K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

export function sha256(bytes) {
    const bitLen = bytes.length * 8;
    const msg = bytes.slice();
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    for (let i = 7; i >= 0; i--) msg.push((bitLen / Math.pow(2, i * 8)) & 0xff);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Array(64);

    for (let off = 0; off < msg.length; off += 64) {
        for (let i = 0; i < 16; i++) {
            const j = off + i * 4;
            w[i] = ((msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3]) >>> 0;
        }
        for (let i = 16; i < 64; i++) {
            const x = w[i - 15], y = w[i - 2];
            const s0 = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) >>> 0;
            const s1 = (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) >>> 0;
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
        for (let i = 0; i < 64; i++) {
            const S1 = (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) >>> 0;
            const ch = ((e & f) ^ (~e & g)) >>> 0;
            const t1 = (h + S1 + ch + K256[i] + w[i]) >>> 0;
            const S0 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) >>> 0;
            const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
            const t2 = (S0 + maj) >>> 0;
            h = g; g = f; f = e; e = (d + t1) >>> 0;
            d = c; c = b; b = a; a = (t1 + t2) >>> 0;
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const out = [];
    for (const v of [h0, h1, h2, h3, h4, h5, h6, h7]) {
        out.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
    }
    return out;
}

export function hmacSha256(keyBytes, dataBytes) {
    let key = keyBytes.length > 64 ? sha256(keyBytes) : keyBytes.slice();
    while (key.length < 64) key.push(0);
    const ipad = key.map((b) => b ^ 0x36);
    const opad = key.map((b) => b ^ 0x5c);
    return sha256(opad.concat(sha256(ipad.concat(dataBytes))));
}

// ---------- AES-256 (decrypt block, CTR & GCM) ----------

const SBOX = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];

const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function xtime(b) { return ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff; }
function gmul2(b) { return xtime(b); }
function gmul3(b) { return xtime(b) ^ b; }

function aesExpandKey(key) {
    const nk = key.length / 4; // 8 cho AES-256
    const nr = nk + 6;
    const w = key.slice();
    for (let i = nk; i < 4 * (nr + 1); i++) {
        let t = w.slice((i - 1) * 4, i * 4);
        if (i % nk === 0) {
            t = [SBOX[t[1]], SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
            t[0] ^= RCON[i / nk];
        } else if (nk > 6 && i % nk === 4) {
            t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]];
        }
        for (let j = 0; j < 4; j++) w[i * 4 + j] = w[(i - nk) * 4 + j] ^ t[j];
    }
    return { w, nr };
}

function aesEncryptBlock(exp, input) {
    const { w, nr } = exp;
    const s = input.slice();
    const addRound = (r) => {
        for (let i = 0; i < 16; i++) s[i] ^= w[r * 16 + i];
    };
    const subShift = () => {
        // State column-major: s[r + 4c]; ShiftRows output s'[r][c] = SBOX[s[r][(c+r)%4]]
        const t = [
            0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12, 1, 6, 11,
        ];
        const o = s.slice();
        for (let i = 0; i < 16; i++) s[i] = SBOX[o[t[i]]];
    };
    const mixCols = () => {
        for (let c = 0; c < 4; c++) {
            const i = c * 4;
            const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
            s[i] = gmul2(a0) ^ gmul3(a1) ^ a2 ^ a3;
            s[i + 1] = a0 ^ gmul2(a1) ^ gmul3(a2) ^ a3;
            s[i + 2] = a0 ^ a1 ^ gmul2(a2) ^ gmul3(a3);
            s[i + 3] = gmul3(a0) ^ a1 ^ a2 ^ gmul2(a3);
        }
    };
    addRound(0);
    for (let r = 1; r < nr; r++) {
        subShift();
        mixCols();
        addRound(r);
    }
    subShift();
    addRound(nr);
    return s;
}

/** AES-CTR giải (encrypt == decrypt). counter = 16B, tăng big-endian từ vị trí 12..15 mỗi block. */
export function aesCtrCrypt(key, data, counter) {
    const exp = aesExpandKey(key);
    const ctr = counter.slice();
    const out = new Array(data.length);
    for (let off = 0; off < data.length; off += 16) {
        const ks = aesEncryptBlock(exp, ctr);
        const n = Math.min(16, data.length - off);
        for (let i = 0; i < n; i++) out[off + i] = data[off + i] ^ ks[i];
        // tăng counter ở 4 byte cuối (Java AES/CTR tăng toàn bộ 128bit, nhưng
        // segment decrypt của AVS chỉ đặt 4B cuối và đếm tuần tự → tăng BE 4B cuối đủ)
        for (let i = 15; i >= 0; i--) {
            ctr[i] = (ctr[i] + 1) & 0xff;
            if (ctr[i] !== 0) break;
        }
    }
    return out;
}

// ---------- GCM ----------

function ghash(hBytes, data) {
    // GF(2^128) nhân; H là 16B
    const toLongs = (b) => [
        ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0,
        ((b[4] << 24) | (b[5] << 16) | (b[6] << 8) | b[7]) >>> 0,
        ((b[8] << 24) | (b[9] << 16) | (b[10] << 8) | b[11]) >>> 0,
        ((b[12] << 24) | (b[13] << 16) | (b[14] << 8) | b[15]) >>> 0,
    ];
    const H = toLongs(hBytes);
    const mul = (X, Y) => {
        // X, Y: mảng 4 word 32-bit, MSB-first. Nhân GF(2^128) rồi giảm modulo poly GCM.
        const z = [0, 0, 0, 0];
        let v = Y.slice();
        for (let i = 0; i < 128; i++) {
            const word = i >>> 5, bit = 31 - (i & 31);
            if ((X[word] >>> bit) & 1) {
                z[0] ^= v[0]; z[1] ^= v[1]; z[2] ^= v[2]; z[3] ^= v[3];
            }
            // v = v >> 1, nếu LSB v trước = 1 thì v ^= R (0xe1<<120)
            const carry = v[3] & 1;
            v[3] = (v[3] >>> 1) | ((v[2] & 1) << 31);
            v[2] = (v[2] >>> 1) | ((v[1] & 1) << 31);
            v[1] = (v[1] >>> 1) | ((v[0] & 1) << 31);
            v[0] = v[0] >>> 1;
            if (carry) v[0] ^= 0xe1000000;
        }
        return z;
    };
    const fromLongs = (l) => [
        (l[0] >>> 24) & 0xff, (l[0] >>> 16) & 0xff, (l[0] >>> 8) & 0xff, l[0] & 0xff,
        (l[1] >>> 24) & 0xff, (l[1] >>> 16) & 0xff, (l[1] >>> 8) & 0xff, l[1] & 0xff,
        (l[2] >>> 24) & 0xff, (l[2] >>> 16) & 0xff, (l[2] >>> 8) & 0xff, l[2] & 0xff,
        (l[3] >>> 24) & 0xff, (l[3] >>> 16) & 0xff, (l[3] >>> 8) & 0xff, l[3] & 0xff,
    ];
    let x = [0, 0, 0, 0];
    for (let off = 0; off < data.length; off += 16) {
        const block = new Array(16).fill(0);
        const n = Math.min(16, data.length - off);
        for (let i = 0; i < n; i++) block[i] = data[off + i];
        const xb = toLongs(block);
        for (let i = 0; i < 4; i++) x[i] ^= xb[i];
        x = mul(x, H);
    }
    return fromLongs(x);
}

const pad16 = (b) => {
    const r = b.slice();
    while (r.length % 16) r.push(0);
    return r;
};

const len64be = (bitLen) => {
    const hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    return [
        (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
        (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff,
    ];
};

function gcmTag(key, iv, ciphertext, aad) {
    const exp = aesExpandKey(key);
    const H = aesEncryptBlock(exp, new Array(16).fill(0));
    let j0;
    if (iv.length === 12) {
        j0 = iv.concat([0, 0, 0, 1]);
    } else {
        // IV khác 12B: J0 = GHASH(pad16(iv) || len64(ivbits))
        j0 = ghash(H, pad16(iv).concat(len64be(iv.length * 8)));
    }
    const s = ghash(H, pad16(aad).concat(pad16(ciphertext))
        .concat(len64be(aad.length * 8)).concat(len64be(ciphertext.length * 8)));
    const eJ0 = aesEncryptBlock(exp, j0);
    return s.map((b, i) => b ^ eJ0[i]);
}

/** AES-GCM decrypt (tag 16B cuối data). Trả null nếu tag sai — giống cipher.doFinal throw. */
export function aesGcmDecrypt(key, iv, blob) {
    if (blob.length < 16) return null;
    const ct = blob.slice(0, blob.length - 16);
    const tag = blob.slice(blob.length - 16);
    const expect = gcmTag(key, iv, ct, []);
    for (let i = 0; i < 16; i++) {
        if ((expect[i] ^ tag[i]) !== 0) return null;
    }
    // CTR từ J0+1 (Java GCM counter bắt đầu = J0 + 1)
    const j0 = iv.length === 12 ? iv.concat([0, 0, 0, 2]) : null;
    if (!j0) return null; // AVS luôn iv 12B
    return aesCtrCrypt(key, ct, j0);
}

// ---------- PRNG / unshuffle / descramble ----------

const lcgNext = (state) => (((Math.imul(state, 1664525) >>> 0) + 1013904223) >>> 0);

function deriveSeed(sk) {
    const sub = String(sk || '').slice(0, 8);
    let end = 0;
    while (end < sub.length) {
        const c = sub[end];
        const isHex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
        if (!isHex) break;
        end++;
    }
    const hex = sub.slice(0, end);
    return hex.length ? (parseInt(hex, 16) >>> 0) : 0;
}

export function stringUnshuffle(str, seed) {
    const chars = String(str).split('');
    let state = deriveSeed(seed);
    const swaps = [];
    for (let i = chars.length - 1; i > 0; i--) {
        state = lcgNext(state);
        swaps.push([i, state % (i + 1)]);
    }
    for (let k = swaps.length - 1; k >= 0; k--) {
        const [a, b] = swaps[k];
        const t = chars[a]; chars[a] = chars[b]; chars[b] = t;
    }
    return chars.join('');
}

function createPrng(seedStr) {
    let h = 2166136261 >>> 0;
    const s = String(seedStr);
    for (let i = 0; i < s.length; i++) {
        h = (Math.imul(16777619, (s.charCodeAt(i) ^ h) >>> 0)) >>> 0;
    }
    let state = h === 0 ? 1 : h;
    return () => {
        state ^= (state << 13) >>> 0; state >>>= 0;
        state ^= state >>> 17; state >>>= 0;
        state ^= (state << 5) >>> 0; state >>>= 0;
        return state;
    };
}

export function descramble(data, permKey, permSalt) {
    const len = data.length;
    if (!len) return [];
    const rng = createPrng(permKey + '|' + permSalt);
    const perm = data.map((_, i) => i);
    for (let i = len - 1; i > 0; i--) {
        const j = rng() % (i + 1);
        const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    const out = new Array(len);
    let xorState = 0;
    for (let i = 0; i < len; i++) {
        if ((i & 3) === 0) xorState = rng();
        out[perm[i]] = data[i] ^ ((xorState >>> ((i & 3) * 8)) & 0xff);
    }
    return out;
}

// ---------- envelope / token / pipeline ----------

export function parseEnvelope(envB64) {
    try {
        const bytes = b64UrlDecode(envB64);
        if (bytes.length < 11 || bytes[0] !== 0x55 || bytes[1] !== 0x53 ||
            bytes[2] !== 0x44 || bytes[3] !== 0x4b || bytes[4] !== 0x01) return null;
        const payloadLen = ((bytes[5] & 0xff) << 8) | (bytes[6] & 0xff);
        if (bytes.length < payloadLen + 7 + 4) return null;
        const payload = bytes.slice(7, 7 + payloadLen);
        const decoded = decodeURIComponent(payload.map((b) => '%' + b.toString(16).padStart(2, '0')).join(''));
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

const AVS_TOKEN_DECL_RE = /const\s+avsToken\s*=\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+)\s*;/;
const AVS_TOKEN_CHUNK_RE = /"((?:[^"\\]|\\.)*)"/g;
const AVS_TOKEN_SIMPLE_RE = /const\s+avsToken\s*=\s*"([^"]+)/;

export function extractAvsToken(html) {
    const src = String(html || '');
    const decl = src.match(AVS_TOKEN_DECL_RE);
    if (decl) {
        let token = '';
        let m;
        const re = new RegExp(AVS_TOKEN_CHUNK_RE.source, 'g');
        while ((m = re.exec(decl[1])) !== null) token += m[1];
        if (token) return token;
    }
    const simple = src.match(AVS_TOKEN_SIMPLE_RE);
    return simple ? simple[1] : '';
}

function jwtJtiOdd(token) {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    try {
        const payload = bytesToUtf8(b64UrlDecode(parts[1]));
        const jti = (JSON.parse(payload) || {}).jti || '';
        if (!jti) return null;
        let odd = '';
        for (let i = 1; i < jti.length; i += 2) odd += jti[i];
        return odd;
    } catch (e) {
        return null;
    }
}

/** headers: {name: value} lowercase-keyed (mình chuẩn hóa trong http.js). */
export function processEncryptedM3u8(m3u8Text, headers, avsToken) {
    const jtiOdd = jwtJtiOdd(avsToken);
    if (jtiOdd === null) return null;

    const hdr = (k) => (headers && headers[k]) || '';
    let cn = '', sk = '', ts = '0', uid = 'anon';
    const envHeader = hdr('x-envelope') || hdr('x-avs-envelope') || hdr('x-stream-envelope');
    if (envHeader) {
        const env = parseEnvelope(envHeader);
        if (env) {
            cn = env.cn || '';
            sk = env.sk || '';
            ts = env.ts || '0';
            uid = env.uid || 'anon';
        }
    }
    if (!cn) cn = hdr('x-edge-tag');
    if (!sk) sk = hdr('x-cache-node');
    if (ts === '0') ts = hdr('x-request-trace') || '0';
    if (uid === 'anon' && hdr('x-proxy-digest')) {
        try { uid = decodeURIComponent(hdr('x-proxy-digest')); } catch (e) { /* giữ anon */ }
    }
    if (!cn || !sk) return null;

    const tValues = [];
    const headerLines = [];
    for (const line of String(m3u8Text).split('\n')) {
        if (line.startsWith('#') || !line.trim()) {
            if (line.startsWith('#EXTINF:') || line.startsWith('#EXT-X-ENDLIST') || line.startsWith('#EXT-X-KEY')) {
                // bỏ — phần body giải mã sẽ cung cấp
            } else {
                headerLines.push(line);
            }
        } else {
            const tm = line.match(/[?&]_t=([^&\s]+)/);
            if (tm) tValues.push(tm[1]);
        }
    }
    if (!tValues.length) return null;

    const concatenated = tValues.join('');
    const cnBytes = b64UrlDecode(cn);
    const iv = cnBytes.slice(0, Math.min(12, cnBytes.length));
    const unshuffleFns = [(s) => stringUnshuffle(s, sk), (s) => s];
    const hmacFormats = [`${uid}:${ts}:${sk}:0`, `${uid}:${ts}:${sk}`];

    for (const unshuffleFn of unshuffleFns) {
        for (const hmacData of hmacFormats) {
            let rawResult;
            let m3u8Body;
            try {
                const blob = b64UrlDecode(unshuffleFn(concatenated));
                const gcmKey = hmacSha256(cnBytes, utf8ToBytes(hmacData));
                rawResult = aesGcmDecrypt(gcmKey, iv, blob);
                if (!rawResult) continue;
                m3u8Body = bytesToUtf8(rawResult);
            } catch (e) {
                continue;
            }
            if (!m3u8Body.includes('#EXTINF') && !m3u8Body.includes('/hls/')) {
                m3u8Body = bytesToUtf8(descramble(rawResult, sk, ts));
            }
            let full = headerLines.join('\n') + '\n' + m3u8Body;
            if (!full.includes('#EXT-X-ENDLIST')) full += '\n#EXT-X-ENDLIST';
            if (/\/hls\/[0-9a-f]{24}\.ts\?e=/.test(full)) {
                return decryptM3u8SegmentUrls(full, jtiOdd);
            }
            if (m3u8Body.includes('#EXTINF')) return full;
        }
    }
    return null;
}

export function decryptM3u8SegmentUrls(text, jtiOdd) {
    const lines = String(text).split('\n');
    const out = lines.slice();
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#') || !line) continue;
        const m = line.match(/\/hls\/([0-9a-f]{24})\.ts/);
        if (!m) continue;
        const q = line.indexOf('?');
        const params = {};
        if (q >= 0) {
            for (const p of line.slice(q + 1).split('&')) {
                const eq = p.indexOf('=');
                if (eq >= 0) params[p.slice(0, eq)] = p.slice(eq + 1);
            }
        }
        if (!params.e) continue;
        const iParam = parseInt(params.i || '0', 10) || 0;
        const aesKey = hmacSha256(utf8ToBytes(jtiOdd), utf8ToBytes('url-cipher|' + m[1]));
        const counter = new Array(16).fill(0);
        counter[12] = (iParam >>> 24) & 0xff;
        counter[13] = (iParam >>> 16) & 0xff;
        counter[14] = (iParam >>> 8) & 0xff;
        counter[15] = iParam & 0xff;
        const decrypted = aesCtrCrypt(aesKey, b64UrlDecode(params.e), counter);
        const url = bytesToUtf8(decrypted);
        if (url.startsWith('http')) out[i] = url;
    }
    return out.filter((l) => {
        const s = String(l);
        return !(s.includes('urn:avs:shield') || /\/hls\/[0-9a-f]{24}\.ts/.test(s));
    }).join('\n');
}

/** Vị trí bắt đầu payload TS sau vỏ PNG (đầu file PNG rồi 8+ block sync 0x47 cách 188B). */
export function findAvsPngPrefixLength(head) {
    if (head.length < 4 || head[0] !== 0x89 || head[1] !== 0x50 || head[2] !== 0x4e || head[3] !== 0x47) {
        return 0;
    }
    const limit = Math.min(head.length, 4096);
    for (let i = 0; i <= limit; i++) {
        if (head[i] !== 0x47) continue;
        let ok = true;
        for (let k = 1; k < 8; k++) {
            const idx = k * 188 + i;
            if (idx >= head.length || head[idx] !== 0x47) { ok = false; break; }
        }
        if (ok) return i;
    }
    return 0;
}
