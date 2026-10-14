import { ok, fail } from '@/lib/response';
import { statsConfig } from '@/config/stats.config';

/** GET /api/stats/trend?ids=a,b&days=7 — S29: 无真实每日序列数据（live同步未接），全部返回空，不画伪随机假线 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);
  if (ids.length === 0) return fail('FATAL', '缺少 ids 参数');
  if (ids.length > statsConfig.trendBatchMax) return fail('FATAL', `批量上限${statsConfig.trendBatchMax}，请分批查询`);
  const out: Record<string, { date: string; play: number; like: number }[]> = {};
  ids.forEach((id) => { out[id] = []; });
  return ok(out);
}
