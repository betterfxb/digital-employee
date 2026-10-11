import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { mockComments } from '@/lib/mock';
import { commentsConfig } from '@/config/comments.config';

/** POST /api/comments/read {ids[] | all_video_id}（本地已读，不反写抖音） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return fail('FATAL', '请求体非法');
  if (body.all_video_id) {
    getRepos().comments.markAllRead(body.all_video_id as string);
    return ok({ updated: 'all', video_id: body.all_video_id });
  }
  const ids = (body.ids || []) as string[];
  if (ids.length === 0) return fail('FATAL', '缺少 ids');
  if (ids.length > commentsConfig.batchReadMax) return fail('FATAL', `批量上限${commentsConfig.batchReadMax}，请分批`);
  const valid = new Set(mockComments.map((c) => c.id));
  return ok({ updated: getRepos().comments.markRead(ids, valid) });
}
