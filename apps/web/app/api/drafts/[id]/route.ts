import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** PATCH /api/drafts/:id {status:'pending'|'done'|'discarded'}（S108 收件箱处理动作） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const st = body?.status;
  if (st !== 'pending' && st !== 'done' && st !== 'discarded') return fail('FATAL', 'status需为pending/done/discarded');
  const d = getRepos().drafts.setStatus(params.id, st);
  if (!d) return fail('FATAL', '草稿不存在', 404);
  return ok(d);
}
