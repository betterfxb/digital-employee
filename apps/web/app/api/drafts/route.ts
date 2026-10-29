export const dynamic = 'force-dynamic'; // S108: 实时内存态+落盘读写，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/**
 * GET  /api/drafts[?status=pending|done|discarded] -> {items,pending}（S108 草稿收件箱，新在前）
 * POST /api/drafts {comment_id, nick, text, via?} -> 手动暂存一条（评论页「存草稿箱」）
 */
export async function GET(req: Request) {
  const st = new URL(req.url).searchParams.get('status') || '';
  if (st && !['pending', 'done', 'discarded'].includes(st)) return fail('FATAL', 'status需为pending/done/discarded');
  const repos = getRepos();
  return ok({ items: st ? repos.drafts.list(st) : repos.drafts.list(), pending: repos.drafts.pendingCount() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.text?.trim()) return fail('FATAL', '缺少 text', 400);
  if (!body?.comment_id?.trim() || !body?.nick?.trim()) return fail('FATAL', '缺少 comment_id/nick', 400);
  if (!getRepos().comments.exists(String(body.comment_id))) return fail('FATAL', '评论不存在', 404);
  const d = getRepos().drafts.create({ comment_id: String(body.comment_id), nick: String(body.nick), text: String(body.text), via: '手动' });
  if (!d) return fail('FATAL', '该评论已有在途草稿（或内容超长被裁后为空）', 400);
  return ok(d);
}
