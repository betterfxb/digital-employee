export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok } from '@/lib/response';

/** GET /api/stats/overview（P0 mock T+1） */
export async function GET() {
  return ok({ play: 128430, like: 9812, comment: 1204, fans_new: 342, fans_total: 48201, mom_play: 12.4, mom_like: 6.1, date: '昨天', note: '昨日数据・今晨6点更新' });
}
