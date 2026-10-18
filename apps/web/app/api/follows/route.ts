import { ok, fail, page } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { assistConfig } from '@/config/assist.config';

/** GET /api/follows?status&tag（手动台账，经Repository；S48支持标签筛选与全量标签库聚合） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const tag = searchParams.get('tag');
  let items = getRepos().follows.list(status || '');
  if (tag) items = items.filter((f) => (f.tags || []).includes(tag));
  // ?tags=1 返回全量标签库（已用标签聚合，去重按频次排序）
  if (searchParams.get('tags') === '1') {
    const counts = new Map<string, number>();
    getRepos().follows.list('').forEach((f) => (f.tags || []).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return ok({ items: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag2, n]) => ({ tag: tag2, n })) });
  }
  return page(items, null);
}

/** POST /api/follows {peer_nick, source_video_id, next_remind_at?, status?}（状态必须在followStatuses内） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.peer_nick || !body?.source_video_id) return fail('FATAL', '缺少 peer_nick/source_video_id');
  const status = body.status || '待回访';
  if (!assistConfig.followStatuses.includes(status)) return fail('FATAL', `状态非法，仅支持 ${assistConfig.followStatuses.join('/')}`);
  return ok(getRepos().follows.create({ peer_nick: body.peer_nick, source_video_id: body.source_video_id, next_remind_at: body.next_remind_at || `明天 ${assistConfig.defaultRemindHour}:00`, status }));
}
