import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** PATCH /api/reply-rules/:id {reply?,enabled?} */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body) return fail('FATAL', '请求体非法');
  const item = getRepos().replyRules.update(params.id, body);
  if (!item) return fail('FATAL', '规则不存在', 404);
  return ok(item);
}

/** DELETE /api/reply-rules/:id */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const okDel = getRepos().replyRules.remove(params.id);
  if (!okDel) return fail('FATAL', '规则不存在', 404);
  return ok({ removed: true, id: params.id });
}
