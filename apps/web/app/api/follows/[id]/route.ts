import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { assistConfig } from '@/config/assist.config';

/** PATCH /api/follows/:id {status?, amount?, tags?, note?, next_remind_at?}（S43记账+S48标签+S49纪要+S65提醒时间；至少一项） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body?.status && body?.amount === undefined && !body?.tags && body?.note === undefined && !body?.next_remind_at && body?.contact === undefined) return fail('FATAL', '缺少 status/amount/tags/note/next_remind_at/contact');
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
  // S65 提醒时间：非空≤40字（解析失败的文本只影响该条提醒，宁可漏提醒不误报——remind已有此语义）
  if (body.next_remind_at !== undefined) {
    const t = String(body.next_remind_at).trim();
    if (!t || t.length > 40) return fail('FATAL', '提醒时间需1-40字（如：明天 18:00 / 10-20 09:30）');
    body.next_remind_at = t;
  }
  // S115 联系方式：≤32字，空串=清除（仅本机存储，不外传）
  if (body.contact !== undefined) {
    const c = String(body.contact).trim();
    if (c.length > 32) return fail('FATAL', '联系方式最多32字');
    body.contact = c;
  }
  const item = getRepos().follows.update(params.id, { status: body.status, amount: body.amount, tags: body.tags, note: body.note, next_remind_at: body.next_remind_at, contact: body.contact });
  if (!item) return fail('FATAL', '跟进不存在', 404);
  return ok(item);
}
