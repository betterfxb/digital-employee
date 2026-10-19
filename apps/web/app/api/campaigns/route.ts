export const dynamic = 'force-dynamic'; // S83: 实时内存态，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { campaignStats } from '@/lib/marketing';

/** GET /api/campaigns（S87 活动列表+期间复盘：命中/新跟进/成交/进度，可信口径注明） */
export async function GET() {
  const repos = getRepos();
  const comments = repos.comments.list({ video_id: '', intent: '', keyword: '', unreadOnly: false });
  const follows = repos.follows.list('');
  const list = repos.campaigns.list().map((c) => campaignStats(c as never, comments as never, follows as never));
  return ok({ items: list });
}

/** POST /api/campaigns {name, start_at, end_at, note?, keyword?, checklist?} */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.start_at || !body?.end_at) return fail('FATAL', '名称与起止日期必填', 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.start_at)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.end_at))) return fail('FATAL', '日期格式需YYYY-MM-DD', 400);
  const c = getRepos().campaigns.create(body);
  if (!c) return fail('FATAL', '创建失败（检查名称非空且开始日≤结束日）', 400);
  return ok(c);
}
