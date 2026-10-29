import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** POST /api/scripts {category?,title,content}（自定义话术，见docs/10-A9） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.title?.trim() || !body?.content?.trim()) return fail('FATAL', '缺少 title/content');
  return ok(getRepos().scripts.create(body.category || '自定义', body.title, body.content));
}

/** PATCH /api/scripts/:id {action:'use'|'pin'|'unpin'}（S107 效果闭环：复制计一次/置顶开关；仅自定义话术） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action !== 'use' && action !== 'pin' && action !== 'unpin') return fail('FATAL', 'action需为use/pin/unpin');
  const repos = getRepos();
  const s = action === 'use' ? repos.scripts.use(params.id) : repos.scripts.pin(params.id, action === 'pin');
  if (!s) return fail('FATAL', '不存在或为内置话术', 404);
  return ok(s);
}

/** DELETE /api/scripts/:id（S57 仅自定义软删进回收站，内置404；?restore=1 恢复） */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const restore = new URL(req.url).searchParams.get('restore') === '1';
  const okOp = restore ? getRepos().scripts.restore(params.id) : getRepos().scripts.remove(params.id);
  if (!okOp) return fail('FATAL', restore ? '不存在或不在回收站' : '不存在或为内置话术', 404);
  return ok({ [restore ? 'restored' : 'removed']: true, id: params.id });
}
