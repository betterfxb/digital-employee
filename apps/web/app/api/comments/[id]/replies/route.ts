import { ok, fail, page } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** GET /api/comments/:id/replies（回评记账，作者回评自有视频，见docs/10-B5） */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!getRepos().comments.exists(params.id)) return fail('FATAL', '评论不存在', 404);
  return page(getRepos().replies.list(params.id), null);
}

/** POST /api/comments/:id/replies {content} */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!getRepos().comments.exists(params.id)) return fail('FATAL', '评论不存在', 404);
  const body = await req.json().catch(() => null);
  if (!body?.content?.trim()) return fail('FATAL', '缺少 content');
  return ok(getRepos().replies.create(params.id, body.content));
}
