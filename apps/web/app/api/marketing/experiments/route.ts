export const dynamic = 'force-dynamic'; // S83: 实时内存态，禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { computeExperiments } from '@/lib/marketing';

/** GET /api/marketing/experiments（S86 话术A/B：按候选位次聚合登记率/成交率；样本<20如实标注不足） */
export async function GET() {
  const repos = getRepos();
  const comments = repos.comments.list({ video_id: '', intent: '', keyword: '', unreadOnly: false });
  const byId = new Map(comments.map((c) => [c.id, c]));
  return ok(computeExperiments(repos.replies.all() as never, byId as never, repos.follows.list('') as never));
}
