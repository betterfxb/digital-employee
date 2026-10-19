export const dynamic = 'force-dynamic'; // S83: 实时内存态，禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { computeSegments } from '@/lib/marketing';

/** GET /api/marketing/segments（S84 智能客群：五规则群，全部本地数据推导，只出主意不触达） */
export async function GET() {
  const repos = getRepos();
  const comments = repos.comments.list({ video_id: '', intent: '', keyword: '', unreadOnly: false });
  const follows = repos.follows.list('');
  return ok({ segments: computeSegments(comments as never, follows as never) });
}
