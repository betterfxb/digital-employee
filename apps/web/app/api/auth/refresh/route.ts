import { ok, fail } from '@/lib/response';
import { douyinConfig } from '@/config/douyin.config';
import { getRepos } from '@/lib/repo';
import { readToken, recordToken } from '@/lib/localData';
import { refreshAccessToken, tokenExpiry } from '@/lib/douyinPort';

/**
 * POST /api/auth/refresh — mock：延长30天（原行为）；live：走开放平台refresh_token（S23）
 */
export async function POST() {
  if (douyinConfig.mode === 'live') {
    try {
      const aid = getRepos().accounts.getActive();
      const rec = readToken(aid);
      if (!rec.refresh) return fail('FATAL', '当前账号无刷新凭据，请重新授权', 400);
      const t = await refreshAccessToken(rec.refresh);
      const { expires_at, days_left } = tokenExpiry(t.expires_in);
      recordToken(aid, { access: t.access_token, refresh: t.refresh_token || rec.refresh, expires_at });
      const acc = getRepos().accounts.list().find((a) => a.id === aid);
      if (acc) { acc.expires_at = expires_at; acc.days_left = days_left; }
      return ok({ expires_at, refreshed: true, days_left });
    } catch (e) {
      return fail('FATAL', `刷新失败：${(e as Error).message}`, 502);
    }
  }
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return ok({ expires_at: d.toISOString().slice(0, 10), refreshed: true });
}
