/**
 * S14a Token保管库：内存Map存加密token，加解密走lib/crypto真模块
 * 生产换KMS/DB时接口不变（save/has/load），见01-architecture。
 */
import { encryptToken, decryptToken } from './crypto';

const vault = new Map<string, { cipher: string; iv: string; v: number }>();

/** 存token（加密后存） */
export function saveToken(accountId: string, token: string) {
  vault.set(accountId, encryptToken(token));
}

/** 是否已托管（不泄露原文，用于me接口自证链路） */
export function hasToken(accountId: string) {
  return vault.has(accountId);
}

/** 取token（解密；缺失返回null） */
export function loadToken(accountId: string): string | null {
  const p = vault.get(accountId);
  if (!p) return null;
  return decryptToken(p);
}
