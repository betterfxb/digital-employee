export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染，否则GET返回构建期快照
import { page } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { tasksConfig } from '@/config/tasks.config';

/** GET /api/tasks（任务中心列表：类型/状态/上次执行/下次节奏，只含合规同步类任务） */
const LABELS: Record<string, string> = { statsSync: '流量同步', commentPoll: '评论对账', followRemind: '跟进提醒' };
export async function GET() {
  const repos = getRepos();
  const items = tasksConfig.taskTypes.map((t: string, i: number) => ({
    no: i + 1,
    type: t,
    label: LABELS[t] || t,
    paused: repos.tasks.isPaused(t),
    lastRun: repos.tasks.lastRun(t),
    nextInMin: tasksConfig.switchIntervalMin,
    priority: tasksConfig.defaultPriority[t as keyof typeof tasksConfig.defaultPriority] ?? 9,
  }));
  return page(items, null);
}
