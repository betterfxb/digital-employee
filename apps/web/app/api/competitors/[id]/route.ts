import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** PATCH /api/competitors/:id {play?, like?, remark?}（S53 竞品记录更新：有变化自动留历史） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body || (body.play === undefined && body.like === undefined && body.remark === undefined)) return fail('FATAL', '缺少 play/like/remark');
  const patch: { play?: number; like?: number; remark?: string } = {};
  if (body.play !== undefined) {
    const n = Number(body.play);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000_000) return fail('FATAL', '播放数非法');
    patch.play = Math.round(n);
  }
  if (body.like !== undefined) {
    const n = Number(body.like);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000_000) return fail('FATAL', '点赞数非法');
    patch.like = Math.round(n);
  }
  if (body.remark !== undefined) {
    const s = String(body.remark);
    if (s.length > 100) return fail('FATAL', '备注最多100字');
    patch.remark = s;
  }
  const item = getRepos().competitors.update(params.id, patch);
  if (!item) return fail('FATAL', '竞品不存在', 404);
  return ok(item);
}
