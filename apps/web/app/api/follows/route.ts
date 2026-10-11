import { ok, fail, page } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { assistConfig } from '@/config/assist.config';

/** GET /api/follows?status（手动台账，经Repository） */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  return page(getRepos().follows.list(status || ''), null);
}

/** POST /api/follows {peer_nick, source_video_id, next_remind_at?, status?}（状态必须在followStatuses内） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.peer_nick || !body?.source_video_id) return fail('FATAL', '缺少 peer_nick/source_video_id');
  const status = body.status || '待回访';
  if (!assistConfig.followStatuses.includes(status)) return fail('FATAL', `状态非法，仅支持 ${assistConfig.followStatuses.join('/')}`);
  return ok(getRepos().follows.create({ peer_nick: body.peer_nick, source_video_id: body.source_video_id, next_remind_at: body.next_remind_at || `明天 ${assistConfig.defaultRemindHour}:00`, status }));
}
