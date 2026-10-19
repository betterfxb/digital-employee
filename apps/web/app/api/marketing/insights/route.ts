export const dynamic = 'force-dynamic'; // S83: 实时内存态+快照文件，禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { computeInsights } from '@/lib/marketing';
import { loadBizHistory } from '@/lib/businessHistory';

/** GET /api/marketing/insights（S85 机会雷达：商机简报条目，无数据=少一条，绝不造假） */
export async function GET() {
  const repos = getRepos();
  const comments = repos.comments.list({ video_id: '', intent: '', keyword: '', unreadOnly: false });
  const follows = repos.follows.list('');
  return ok({ items: computeInsights(comments as never, follows as never, loadBizHistory()) });
}
