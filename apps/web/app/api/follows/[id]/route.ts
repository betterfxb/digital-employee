import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { assistConfig } from '@/config/assist.config';

/** PATCH /api/follows/:id {status?, amount?, tags?, note?}（S43记账+S48标签+S49纪要；至少一项） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body?.status && body?.amount === undefined && !body?.tags && body?.note === undefined) return fail('FATAL', '缺少 status/amount/tags/note');
  if (body.status && !assistConfig.followStatuses.includes(body.status)) return fail('FATAL', `状态非法，仅支持 ${assistConfig.followStatuses.join('/')}`);
  if (body.amount !== undefined) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return fail('FATAL', '成交金额需为0-10亿的数字');
    body.amount = Math.round(n * 100) / 100;
  }
  // S48 标签校验：≤10个、每个1-8字、去空白去重
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return fail('FATAL', 'tags需为数组');
    const tags = [...new Set((body.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean))];
    if (tags.length > 10) return fail('FATAL', '标签最多10个');
    if (tags.some((t: string) => t.length > 8)) return fail('FATAL', '单个标签最多8字');
    body.tags = tags;
  }
  if (body.note !== undefined) {
    const note = String(body.note);
    if (note.length > 500) return fail('FATAL', '纪要最多500字');
    body.note = note;
  }
  const item = getRepos().follows.update(params.id, { status: body.status, amount: body.amount, tags: body.tags, note: body.note });
  if (!item) return fail('FATAL', '跟进不存在', 404);
  return ok(item);
}
