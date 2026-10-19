import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** PATCH /api/campaigns/:id {name?,note?,keyword?,start_at?,end_at?,checklist?}（S87） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body) return fail('FATAL', '缺请求体', 400);
  const patch: Record<string, unknown> = {};
  for (const k of ['name', 'note', 'keyword', 'start_at', 'end_at', 'checklist']) if (body[k] !== undefined) patch[k] = body[k];
  const c = getRepos().campaigns.update(params.id, patch as never);
  if (!c) return fail('FATAL', '更新失败（活动不存在或校验不过：名称非空/开始日≤结束日）', 400);
  return ok(c);
}

/** DELETE /api/campaigns/:id（S87 活动直接删除——计划类数据无回溯价值，与话术软删区分） */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!getRepos().campaigns.remove(params.id)) return fail('FATAL', '活动不存在', 404);
  return ok({ removed: true });
}
