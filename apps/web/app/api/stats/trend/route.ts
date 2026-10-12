import { ok, fail } from '@/lib/response';
import { statsConfig } from '@/config/stats.config';

/** GET /api/stats/trend?ids=a,b&days=7（P0 mock：确定性伪序列，便于抽屉展示） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);
  const days = Math.min(Math.max(Number(searchParams.get('days') || 7), 1), 30);
  if (ids.length === 0) return fail('FATAL', '缺少 ids 参数');
  if (ids.length > statsConfig.trendBatchMax) return fail('FATAL', `批量上限${statsConfig.trendBatchMax}，请分批查询`);
  const out: Record<string, { date: string; play: number; like: number }[]> = {};
  ids.forEach((id, vi) => {
    if (id.startsWith('imp_')) { out[id] = []; return; } // S23b: 导入作品无同步序列，返回空（UI显示"—"），不画伪随机假线
    const seed = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) + vi * 7;
    out[id] = Array.from({ length: days }, (_, i) => ({
      date: `D-${days - 1 - i}`,
      play: 800 + ((seed * (i + 3)) % 4000),
      like: 60 + ((seed * (i + 5)) % 320),
    }));
  });
  return ok(out);
}
