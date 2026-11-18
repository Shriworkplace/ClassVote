const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;

function hashPassword(plainPassword) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');
        crypto.scrypt(plainPassword, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(`${salt}:${derivedKey.toString('hex')}`);
        });
    });
}

function verifyPassword(plainPassword, storedHash) {
    return new Promise((resolve, reject) => {
        if (typeof storedHash !== 'string' || !storedHash.includes(':')) {
            return resolve(false);
        }
        const [salt, keyHex] = storedHash.split(':');
        if (!salt || !keyHex) {
            return resolve(false);
        }
        crypto.scrypt(plainPassword, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
            if (err) return reject(err);
            const expectedBuf = Buffer.from(keyHex, 'hex');
            if (expectedBuf.length !== derivedKey.length) {
                return resolve(false);
            }
            resolve(crypto.timingSafeEqual(expectedBuf, derivedKey));
        });
    });
}

module.exports = {
    hashPassword,
    verifyPassword,
};
