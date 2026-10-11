import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** PATCH /api/video-tasks/:id {follow?,like_done?,fav_done?,paused?,interval_min?}（本地状态，不触发自动执行） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body) return fail('FATAL', '请求体非法');
  const item = getRepos().videoTasks.update(params.id, body);
  if (!item) return fail('FATAL', '任务不存在', 404);
  return ok(item);
}

/** DELETE /api/video-tasks/:id（移出队列） */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const okDel = getRepos().videoTasks.remove(params.id);
  if (!okDel) return fail('FATAL', '任务不存在', 404);
  return ok({ removed: true, id: params.id });
}
