export const dynamic = 'force-dynamic'; // S12教训：无参GET读内存态，禁静态快照
import { ok } from '@/lib/response';
import { status } from '@/lib/scheduler';
import { autoReplyStatus, autoReplyTick } from '@/lib/autoReply';

/** GET /api/tasks/status（S28调度器状态 + S74自动回复执行器状态；读时补一次幂等心跳） */
export async function GET() {
  try { autoReplyTick(); } catch { /* 心跳失败不阻断状态返回 */ }
  return ok({ ...status(), auto_reply: autoReplyStatus() });
}
