import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { commentsConfig } from '@/config/comments.config';

/** PATCH /api/comments/:id {intent?, ignore?}（本地标签，不反写抖音） */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const repos = getRepos();
  if (!repos.comments.exists(params.id)) return fail('FATAL', '评论不存在', 404);
  const body = await req.json().catch(() => null);
  if (!body) return fail('FATAL', '请求体非法');
  if (body.intent && !commentsConfig.intentOptions.includes(body.intent)) {
    return fail('FATAL', `意图非法，仅支持 ${commentsConfig.intentOptions.join('/')}`);
  }
  const patch: Record<string, unknown> = {};
  if (body.intent) patch.intent = body.intent;
  if (typeof body.ignore === 'boolean') patch.ignore = body.ignore;
  return ok(repos.comments.setIntent(params.id, patch));
}
