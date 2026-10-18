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
  // S66 防呆去重：活跃管线（待回访/已手动回复）内同昵称直接返回已有——防重复加入；已转化等终态允许开新一轮
  const ACTIVE = ['待回访', '已手动回复'];
  const existing = getRepos().follows.list('').find((f) => f.peer_nick === body.peer_nick && ACTIVE.includes(f.status));
  if (existing) return ok({ ...existing, deduped: true });
  return ok(getRepos().follows.create({ peer_nick: body.peer_nick, source_video_id: body.source_video_id, next_remind_at: body.next_remind_at || `明天 ${assistConfig.defaultRemindHour}:00`, status }));
}
