"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptToken = exports.encryptToken = void 0;
/** Token加密（AES-GCM信封简化版，P0演示；生产需KMS+版本轮换，见01-architecture） */
const crypto_1 = require("crypto");
function key() {
    const master = process.env.TOKEN_MASTER_KEY;
    if (!master) {
        // M4修复：缺key在production直接失败，dev用固定常量（禁止上线，见01-architecture）
        if (process.env.NODE_ENV === 'production')
            throw new Error('缺少TOKEN_MASTER_KEY，拒绝启动加密');
        return (0, crypto_1.createHash)('sha256').update('local-dev-only-do-not-use-in-prod').digest();
    }
    return (0, crypto_1.createHash)('sha256').update(master).digest(); // 32B
}
/** 加密：返回 {cipher, iv, v:1} */
function encryptToken(plain) {
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', key(), iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { cipher: Buffer.concat([enc, tag]).toString('base64'), iv: iv.toString('base64'), v: 1 };
}
exports.encryptToken = encryptToken;
/** 解密（与上对应） */
function decryptToken(payload) {
    const raw = Buffer.from(payload.cipher, 'base64');
    const enc = raw.subarray(0, raw.length - 16);
    const tag = raw.subarray(raw.length - 16);
    const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key(), Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
exports.decryptToken = decryptToken;
