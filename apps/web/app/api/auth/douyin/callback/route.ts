export const dynamic = 'force-dynamic'; // S23: state一次一验+内存日志，禁静态预渲染
import { douyinConfig } from '@/config/douyin.config';
import { authConfig } from '@/config/auth.config';
import { mockAccounts } from '@/lib/mock';
import { pendingAuthStates, hash6, rememberAccount, recordToken, pushAuthLog, randomHex } from '@/lib/localData';
import { mockExchange, mockOpenId, exchangeCode, tokenExpiry } from '@/lib/douyinPort';
import { setActiveAccountId } from '@/lib/store';
import { saveToken } from '@/lib/tokenVault';
import type { Account } from '@/lib/types';

/**
 * GET /api/auth/douyin/callback?code&state — S23 授权回调
 * 校验state(10min一次性) → 换token(mock占位/live真实) → 账号落库+token加密落盘 → 302回授权页
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code') || '';
  const state = searchParams.get('state') || '';
  const failBack = (msg: string) => Response.redirect(new URL(`/auth?err=${encodeURIComponent(msg)}`, req.url), 302);

  const pending = pendingAuthStates.get(state);
  pendingAuthStates.delete(state);
  if (!pending || !code) return failBack('授权超时或状态无效，请重新扫码');
  if (douyinConfig.mode === 'live' && !process.env.TOKEN_MASTER_KEY) {
    return failBack('live模式需配置TOKEN_MASTER_KEY后重启');
  }

  let openId: string;
  let nickname: string;
  let access: string;
  let refresh: string | undefined;
  let expiresAt: string;
  let daysLeft: number;
  try {
    if (douyinConfig.mode === 'live') {
      const t = await exchangeCode(code);
      openId = t.open_id;
      nickname = t.nickname || '已绑定抖音号';
      access = t.access_token;
      refresh = t.refresh_token || undefined;
      ({ expires_at: expiresAt, days_left: daysLeft } = tokenExpiry(t.expires_in));
    } else {
      const t = mockExchange(code, pending.nick);
      openId = mockOpenId(pending.nick);
      nickname = t.nickname!;
      access = t.access_token;
      refresh = t.refresh_token;
      ({ expires_at: expiresAt, days_left: daysLeft } = tokenExpiry(t.expires_in));
    }
  } catch (e) {
    return failBack(`换取token失败：${(e as Error).message}`);
  }

  const id = `acc_${hash6(openId)}`;
  const exist = mockAccounts.find((a) => a.id === id);
  if (!exist && mockAccounts.length >= authConfig.maxAccountsPerTenant) {
    return failBack(`绑定账号数已达上限${authConfig.maxAccountsPerTenant}个，请先解绑`);
  }
  const acc: Account = exist || { id, open_id_mask: `${openId.slice(0, 4)}…${openId.slice(-4)}`, nickname, avatar: '', auth_type: 'personal', expires_at: expiresAt, days_left: daysLeft };
  acc.nickname = nickname;
  acc.expires_at = expiresAt;
  acc.days_left = daysLeft;
  if (!exist) mockAccounts.push(acc);
  rememberAccount(acc);
  recordToken(id, { access, refresh, expires_at: expiresAt });
  try { saveToken(id, access); } catch { /* 生产缺TOKEN_MASTER_KEY时vault不托管，不影响绑定 */ }
  setActiveAccountId(id);
  pushAuthLog('扫码授权成功', nickname, douyinConfig.mode === 'live' ? `真实授权 · 有效期${daysLeft}天` : `预真机(占位密钥) · 有效期${daysLeft}天`);
  return Response.redirect(new URL(`/auth?bind=ok&nick=${encodeURIComponent(nickname)}&t=${randomHex(2)}`, req.url), 302);
}
