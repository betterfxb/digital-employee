export const dynamic = 'force-dynamic'; // S12教训：无参GET读内存态，禁静态快照
import { ok } from '@/lib/response';
import { status } from '@/lib/scheduler';

/** GET /api/tasks/status（S28 调度器状态：开关/下次执行/今日次数/熔断态） */
export async function GET() {
  return ok(status());
}
