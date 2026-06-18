"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const ripemd128_js_1 = require("js-mdict/dist/esm/ripemd128.js");
const REGEXP_STRIPKEY = {
    mdx: /[().,\-&、 '/\\@_$\\!]()/g,
    mdd: /([.][^.]*$)|[()., '/@]/g,
};
let UTF_16LE_DECODER;
try {
    UTF_16LE_DECODER = new TextDecoder('utf-16le');
}
catch (e) {
    UTF_16LE_DECODER = {
        decode: (buf) => {
            let str = '';
            const array = new Uint8Array(buf.buffer || buf, buf.byteOffset || 0, buf.byteLength || buf.length);
            for (let i = 0; i < array.length; i += 2) {
                str += String.fromCharCode(array[i] | (array[i + 1] << 8));
            }
            return str;
        }
    };
}
const UTF16 = 'UTF-16';
function newUint8Array(buf, offset, len) {
    return new Uint8Array(buf.buffer || buf, (buf.byteOffset || 0) + offset, len);
}
function readUTF16(buf, offset, length) {
    return UTF_16LE_DECODER.decode(new Uint8Array(newUint8Array(buf, offset, length)));
}
function getExtension(filename, defaultExt) {
    var _a;
    return ((_a = /(?:\.([^.]+))?$/.exec(filename)) === null || _a === void 0 ? void 0 : _a[1]) || defaultExt;
}
function triple_min(a, b, c) {
    const temp = a < b ? a : b;
    return temp < c ? temp : c;
}
function levenshteinDistance(a, b) {
    if (!a || a == undefined) {
        return 9999;
    }
    if (!b || b == undefined) {
        return 9999;
    }
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] !== b[j - 1]) {
                dp[i][j] = triple_min(1 + dp[i - 1][j], 1 + dp[i][j - 1], 1 + dp[i - 1][j - 1]);
            }
            else {
                dp[i][j] = dp[i - 1][j - 1];
            }
        }
    }
    return dp[m][n];
}
function parseHeader(header_text) {
    const headerAttr = {};
    Array.from(header_text.matchAll(/(\w+)="((.|\r|\n)*?)"/g)).forEach((tag) => {
        headerAttr[tag[1]] = unescapeEntities(tag[2]);
    });
    if (headerAttr['StyleSheet'] && typeof headerAttr['StyleSheet'] == 'string') {
        const styleSheet = {};
        const lines = headerAttr['StyleSheet'].split(/[\r\n]+/g);
        for (let i = 0; i < lines.length; i += 3) {
            styleSheet[lines[i]] = [lines[i + 1], lines[i + 2]];
        }
        headerAttr['StyleSheet'] = styleSheet;
    }
    return headerAttr;
}
function uint8BEtoNumber(bytes) {
    return bytes[0] & 0xff;
}
function uint16BEtoNumber(bytes) {
    let n = 0;
    for (let i = 0; i < 1; i++) {
        n |= bytes[i];
        n <<= 8;
    }
    n |= bytes[1];
    return n;
}
function uint32BEtoNumber(bytes) {
    let n = 0;
    for (let i = 0; i < 3; i++) {
        n |= bytes[i];
        n <<= 8;
    }
    n |= bytes[3];
    return n;
}
function uint64BEtoNumber(bytes) {
    if (bytes[1] >= 0x20 || bytes[0] > 0) {
        throw new Error('Error: uint64 larger than 2^53, JS may lost accuracy');
    }
    let high = 0;
    for (let i = 0; i < 3; i++) {
        high |= bytes[i] & 0xff;
        high <<= 8;
    }
    high |= bytes[3] & 0xff;
    high = (high & 0x001fffff) * 0x100000000;
    high += bytes[4] * 0x1000000;
    high += bytes[5] * 0x10000;
    high += bytes[6] * 0x100;
    high += bytes[7] & 0xff;
    return high;
}
const NUMFMT_UINT8 = Symbol('NUM_FMT_UINT8');
const NUMFMT_UINT16 = Symbol('NUM_FMT_UINT16');
const NUMFMT_UINT32 = Symbol('NUM_FMT_UINT32');
const NUMFMT_UINT64 = Symbol('NUM_FMT_UINT64');
function readNumber(bf, numfmt) {
    const value = new Uint8Array(bf);
    if (numfmt === NUMFMT_UINT32) {
        return uint32BEtoNumber(value);
    }
    else if (numfmt === NUMFMT_UINT64) {
        return uint64BEtoNumber(value);
    }
    else if (numfmt === NUMFMT_UINT16) {
        return uint16BEtoNumber(value);
    }
    else if (numfmt === NUMFMT_UINT8) {
        return uint8BEtoNumber(value);
    }
    return 0;
}
function b2n(data) {
    switch (data.length) {
        case 1:
            return uint8BEtoNumber(data);
        case 2:
            return uint16BEtoNumber(data);
        case 4:
            return uint32BEtoNumber(data);
        case 8:
            return uint64BEtoNumber(data);
    }
    return 0;
}
function fast_decrypt(b, key) {
    let previous = 0x36;
    for (let i = 0; i < b.length; ++i) {
        let t = ((b[i] >> 4) | (b[i] << 4)) & 0xff;
        t = t ^ previous ^ (i & 0xff) ^ key[i % key.length];
        previous = b[i];
        b[i] = t;
    }
    return b;
}
function salsa_decrypt(data, k) {
    return data;
}
function mdxDecrypt(comp_block) {
    const keyinBuffer = new Uint8Array(8);
    keyinBuffer.set(comp_block.slice(4, 8), 0);
    keyinBuffer[4] ^= 0x95;
    keyinBuffer[5] ^= 0x36;
    keyinBuffer[6] ^= 0x00;
    keyinBuffer[7] ^= 0x00;
    const key = (0, ripemd128_js_1.ripemd128)(keyinBuffer.buffer.slice(keyinBuffer.byteOffset, keyinBuffer.byteOffset + keyinBuffer.length));
    const compPart = comp_block.subarray(0, 8);
    const decryptedPart = fast_decrypt(Uint8Array.from(comp_block.slice(8)), key);
    const result = new Uint8Array(compPart.length + decryptedPart.length);
    result.set(compPart, 0);
    result.set(decryptedPart, compPart.length);
    return result;
}
function appendBuffer(buffer1, buffer2) {
    const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp;
}
function isTrue(v) {
    if (!v)
        return false;
    v = v.toLowerCase();
    return v === 'yes' || v === 'true';
}
function wordCompare(word1, word2) {
    if (!word1 || !word2) {
        throw new Error(`invalid word comparation ${word1} and ${word2}`);
    }
    if (word1 === word2) {
        return 0;
    }
    const len = word1.length > word2.length ? word2.length : word1.length;
    for (let i = 0; i < len; i++) {
        const w1 = word1[i];
        const w2 = word2[i];
        if (w1 == w2) {
            continue;
        }
        else if (w1.toLowerCase() == w2.toLowerCase()) {
            continue;
        }
        else if (w1.toLowerCase() < w2.toLowerCase()) {
            return -1;
        }
        else if (w1.toLowerCase() > w2.toLowerCase()) {
            return 1;
        }
    }
    return word1.length < word2.length ? -1 : 1;
}
function unescapeEntities(text) {
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&amp;/g, '&');
    return text;
}
function substituteStylesheet(styleSheet, txt) {
    const txtTag = Array.from(txt.matchAll(/`(\d+)`/g));
    const txtList = Array.from(txt.split(/`\d+`/g)).slice(1);
    let styledTxt = '';
    for (let i = 0; i < txtList.length; i++) {
        const style = styleSheet[txtTag[i][1]];
        styledTxt += style[0] + txtList[i] + style[1];
    }
    return styledTxt;
}
exports.default = {
    getExtension,
    readUTF16,
    newUint8Array,
    levenshteinDistance,
    parseHeader,
    readNumber,
    b2n,
    mdxDecrypt,
    ripemd128: ripemd128_js_1.ripemd128,
    fast_decrypt,
    salsa_decrypt,
    appendBuffer,
    isTrue,
    wordCompare,
    substituteStylesheet,
    UTF16,
    REGEXP_STRIPKEY,
    NUMFMT_UINT8,
    NUMFMT_UINT16,
    NUMFMT_UINT32,
    NUMFMT_UINT64,
};
