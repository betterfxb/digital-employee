import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { assistConfig } from '@/config/assist.config';

/** PATCH /api/follows/:id {status?, amount?}（S43 状态流转+成交记账；至少一项） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body?.status && body?.amount === undefined) return fail('FATAL', '缺少 status 或 amount');
  if (body.status && !assistConfig.followStatuses.includes(body.status)) return fail('FATAL', `状态非法，仅支持 ${assistConfig.followStatuses.join('/')}`);
  if (body.amount !== undefined) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return fail('FATAL', '成交金额需为0-10亿的数字');
    body.amount = Math.round(n * 100) / 100;
  }
  const item = getRepos().follows.update(params.id, { status: body.status, amount: body.amount });
  if (!item) return fail('FATAL', '跟进不存在', 404);
  return ok(item);
}
