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

/** DELETE /api/reply-rules/:id（S57 软删进回收站；?restore=1 恢复） */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const restore = new URL(req.url).searchParams.get('restore') === '1';
  const okOp = restore ? getRepos().replyRules.restore(params.id) : getRepos().replyRules.remove(params.id);
  if (!okOp) return fail('FATAL', restore ? '不存在或不在回收站' : '规则不存在', 404);
  return ok({ [restore ? 'restored' : 'removed']: true, id: params.id });
}
