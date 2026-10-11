/** Token加密（AES-GCM信封简化版，P0演示；生产需KMS+版本轮换，见01-architecture） */
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';

function key() {
  const master = process.env.TOKEN_MASTER_KEY;
  if (!master) {
    // M4修复：缺key在production直接失败，dev用固定常量（禁止上线，见01-architecture）
    if (process.env.NODE_ENV === 'production') throw new Error('缺少TOKEN_MASTER_KEY，拒绝启动加密');
    return createHash('sha256').update('local-dev-only-do-not-use-in-prod').digest();
  }
  return createHash('sha256').update(master).digest(); // 32B
}

/** 加密：返回 {cipher, iv, v:1} */
export function encryptToken(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { cipher: Buffer.concat([enc, tag]).toString('base64'), iv: iv.toString('base64'), v: 1 };
}

/** 解密（与上对应） */
export function decryptToken(payload: { cipher: string; iv: string }) {
  const raw = Buffer.from(payload.cipher, 'base64');
  const enc = raw.subarray(0, raw.length - 16);
  const tag = raw.subarray(raw.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
