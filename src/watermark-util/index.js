const AES_IV = new TextEncoder().encode('0123456789abcdef');

async function importKey(key) {
    // If key is already a Uint8Array, use it directly
    const keyBytes = key instanceof Uint8Array ? key : new TextEncoder().encode(key);

    return crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-CBC' },
        false,
        ['encrypt', 'decrypt']
    );
}

async function aesDecrypt(base64Text, aesKey, aesIv = AES_IV) {
    const cryptoKey = await importKey(aesKey);

    // base64 decode
    const ciphertext = base64ToBytes(base64Text);

    const plaintextBuf = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: aesIv },
        cryptoKey,
        ciphertext
    );

    return new TextDecoder().decode(new Uint8Array(plaintextBuf));
}

async function sha256Digest(passwd) {
    const data = new TextEncoder().encode(passwd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    return new Uint8Array(hashBuffer);
}

const checkTimeStamp = (timeStamp, interval) => {
    if (0 === interval) {
        return true;
    }
    const now = new Date();
    const checkTime = new Date(timeStamp);
    const currentMilliSeconds = now.getTime();
    const checkMilliSeconds = checkTime.getTime();
    const period = (currentMilliSeconds - checkMilliSeconds) / 1000;

    return (interval * 60) > period && period > 0;
}

function bytesToBase64(u8) {
    let bin = '';
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
}

function base64ToBytes(b64) {
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function hexToUtf8(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder().decode(bytes);
}

function base64ToHex(b64) {
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    const bin = atob(b64);
    let hex = '';
    for (let i = 0; i < bin.length; i++) {
        hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
}

function base64Decode(str, outputFormat = 'String') {
    return base64.decode(str, 'String');
}

// UTF-8 문자열 → Hex 문자열
function utf8ToHex(str) {
    const bytes = new TextEncoder().encode(str); // 문자열을 UTF-8 바이트로 변환
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''); // 각 바이트를 두 자리 16진수로 변환 후 합침
}

export default {aesDecrypt, sha256Digest, checkTimeStamp, bytesToBase64, base64ToBytes, hexToUtf8, base64ToHex, base64Decode, utf8ToHex }
