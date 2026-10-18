/**
 * S69 本地访问密码（S18占位收口）：scrypt + 随机salt 哈希存储，格式 s1$salt$hash（base64）
 * 口令原文永不落盘；校验用 timingSafeEqual 防时序侧信道；仅服务端引用
 */
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const h = scryptSync(pw, salt, 32);
  return `s1$${salt.toString('base64')}$${h.toString('base64')}`;
}

/** 校验：无记录/格式错/口令错 一律 false（零抛出） */
export function verifyPassword(pw: string, stored: string | null | undefined): boolean {
  if (!stored || !pw) return false;
  try {
    const parts = stored.split('$');
    if (parts.length !== 3 || parts[0] !== 's1') return false;
    const h = scryptSync(pw, Buffer.from(parts[1], 'base64'), 32);
    const want = Buffer.from(parts[2], 'base64');
    return h.length === want.length && timingSafeEqual(h, want);
  } catch {
    return false;
  }
}
