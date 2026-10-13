import { ok, fail } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { tasksConfig } from '@/config/tasks.config';
import { resetFuse } from '@/lib/scheduler';

/** POST /api/tasks/control {type, action: pause|resume}（只启停同步类任务；resume 时解除调度熔断） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.type || !['pause', 'resume'].includes(body.action)) return fail('FATAL', '缺少 type/action（pause|resume）');
  if (!tasksConfig.taskTypes.includes(body.type)) return fail('FATAL', `任务非法，仅支持 ${tasksConfig.taskTypes.join('/')}`);
  getRepos().tasks.setPaused(body.type, body.action === 'pause');
  if (body.action === 'resume' && body.type === 'statsSync') resetFuse();
  return ok({ type: body.type, paused: body.action === 'pause' });
}
