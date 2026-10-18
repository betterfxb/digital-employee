/**
 * S61 备份加密（仅服务端；node crypto，零依赖）：
 * scrypt(pass, salt, 32) → AES-256-GCM，GCM tag 兜篡改，口令错误解密必失败
 * 密文包: { __enc, v, salt, iv, tag, data }（base64），普通备份文件不含该结构可直接区分
 */
import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface EncPack { __enc: 1; v: 1; salt: string; iv: string; tag: string; data: string }

export function encryptBackup(obj: unknown, pass: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pass, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const pack: EncPack = { __enc: 1, v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: enc.toString('base64') };
  return JSON.stringify(pack, null, 2);
}

/** 解密：口令错误/被篡改/结构非法 → null（绝不抛给调用方） */
export function decryptBackup(raw: string | EncPack, pass: string): unknown | null {
  try {
    const pack: EncPack = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!pack || pack.__enc !== 1 || !pack.salt || !pack.iv || !pack.tag || !pack.data) return null;
    const key = scryptSync(pass, Buffer.from(pack.salt, 'base64'), 32);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(pack.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(pack.tag, 'base64'));
    const dec = Buffer.concat([decipher.update(Buffer.from(pack.data, 'base64')), decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
  } catch {
    return null;
  }
}
