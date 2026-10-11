import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { assistConfig } from '@/config/assist.config';

/** PATCH /api/follows/:id {status}（台账状态流转，状态必须在followStatuses内） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body?.status) return fail('FATAL', '缺少 status');
  if (!assistConfig.followStatuses.includes(body.status)) return fail('FATAL', `状态非法，仅支持 ${assistConfig.followStatuses.join('/')}`);
  const item = getRepos().follows.update(params.id, body.status);
  if (!item) return fail('FATAL', '跟进不存在', 404);
  return ok(item);
}
