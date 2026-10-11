export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok } from '@/lib/response';
import { mockComments } from '@/lib/mock';

/** GET /api/comments/keywords/hot?days=7（P0 mock：按keywords[]计数） */
export async function GET() {
  const counts = new Map<string, number>();
  mockComments.forEach((c) => c.keywords.forEach((k: string) => counts.set(k, (counts.get(k) || 0) + 1)));
  const items = [...counts.entries()].map(([kw, count]) => ({ kw, count })).sort((a, b) => b.count - a.count);
  return ok({ items });
}
