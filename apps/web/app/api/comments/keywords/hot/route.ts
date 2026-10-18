export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok } from '@/lib/response';
import { mockComments } from '@/lib/mock';
import { appendToday } from '@/lib/hotHistory';

/** GET /api/comments/keywords/hot（按keywords[]计数；S51附每日快照history：date→词→次数，最多30天） */
export async function GET() {
  const counts = new Map<string, number>();
  mockComments.forEach((c) => c.keywords.forEach((k: string) => counts.set(k, (counts.get(k) || 0) + 1)));
  const items = [...counts.entries()].map(([kw, count]) => ({ kw, count })).sort((a, b) => b.count - a.count);
  const history = appendToday(Object.fromEntries(items.map((x) => [x.kw, x.count])));
  return ok({ items, history });
}
