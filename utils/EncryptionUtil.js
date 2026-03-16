'use strict';

const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-cbc';
// Ensure key is 32 bytes
const KEY_STRING = process.env.KEY || 'OBSERVATORIO-IOT-DEFAULT-KEY';
const SECRET_KEY = crypto.createHash('sha256').update(KEY_STRING).digest();

class EncryptionUtil {
    encrypt(text) {
        if (!text) return text;
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    decrypt(text) {
        if (!text) return text;
        const textParts = text.split(':');
        if (textParts.length < 2) return text; // Not encrypted or invalid format

        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
}

module.exports = new EncryptionUtil();
