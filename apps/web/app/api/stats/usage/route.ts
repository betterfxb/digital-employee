export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { tasksConfig } from '@/config/tasks.config';

/** GET /api/stats/usage（频控余量：今日同步次数/上限，供任务条与健康看板） */
export async function GET() {
  const usedToday = getRepos().sync.count();
  return ok({ usedToday, cap: tasksConfig.dailySyncCap, left: Math.max(0, tasksConfig.dailySyncCap - usedToday) });
}
