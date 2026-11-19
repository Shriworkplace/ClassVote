const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode buffer into RFC 4648 Base32 string (without padding)
 */
function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}

/**
 * Decode RFC 4648 Base32 string into Buffer
 */
function base32Decode(input) {
    if (!input || typeof input !== 'string') {
        throw new Error('Invalid Base32 string');
    }
    const cleaned = input.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
    let bits = 0;
    let value = 0;
    const output = [];
    for (let i = 0; i < cleaned.length; i++) {
        const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
        if (idx === -1) {
            throw new Error(`Invalid base32 character: ${cleaned[i]}`);
        }
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(output);
}

/**
 * Generate a cryptographically random 20-byte (160-bit) Base32 secret for TOTP
 */
function generateSecret(byteLength = 20) {
    const bytes = crypto.randomBytes(byteLength);
    return base32Encode(bytes);
}

/**
 * Generate an RFC 6238 6-digit TOTP code for a given timestamp
 */
function generateTotp(secret, timeMs = Date.now()) {
    const key = base32Decode(secret);
    const counter = Math.floor(timeMs / 1000 / 30);
    const buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return String(otp).padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP code against a secret with clock drift tolerance
 * @param {string} secret - Base32 encoded secret
 * @param {string} token - 6-digit candidate code
 * @param {number} window - Number of 30-second steps before and after to check (default 1 = ±30s)
 */
function verifyTotp(secret, token, window = 1) {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.trim().replace(/\s+/g, '');
    if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

    const now = Date.now();
    const stepMs = 30 * 1000;

    for (let i = -window; i <= window; i++) {
        try {
            const expected = generateTotp(secret, now + i * stepMs);
            if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
                return true;
            }
        } catch {
            return false;
        }
    }
    return false;
}

/**
 * Generate standard otpauth URI for QR code scanning
 */
function generateOtpAuthUrl({ issuer = 'ClassVote', account, secret }) {
    const safeIssuer = encodeURIComponent(issuer);
    const safeAccount = encodeURIComponent(account);
    return `otpauth://totp/${safeIssuer}:${safeAccount}?secret=${secret}&issuer=${safeIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate 8 single-use alphanumeric backup codes formatted as XXXX-XXXX
 */
function generateBackupCodes(count = 8) {
    const codes = [];
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without easily confused 0, O, 1, I
    for (let i = 0; i < count; i++) {
        const bytes = crypto.randomBytes(8);
        let code = '';
        for (let j = 0; j < 8; j++) {
            code += alphabet[bytes[j] % alphabet.length];
            if (j === 3) code += '-';
        }
        codes.push(code);
    }
    return codes;
}

/**
 * Hash a backup code with SHA-256 for secure database storage
 */
function hashBackupCode(code) {
    if (!code || typeof code !== 'string') return '';
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Verify a candidate backup code against a stored hash
 */
function verifyBackupCode(candidate, storedHash) {
    if (!candidate || !storedHash) return false;
    const candidateHash = hashBackupCode(candidate);
    try {
        return crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));
    } catch {
        return false;
    }
}

module.exports = {
    generateSecret,
    generateTotp,
    verifyTotp,
    generateOtpAuthUrl,
    generateBackupCodes,
    hashBackupCode,
    verifyBackupCode,
    base32Encode,
    base32Decode
};
