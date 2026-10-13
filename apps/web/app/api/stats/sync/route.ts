export const dynamic = 'force-dynamic'; // S26: live同步写态，禁静态预渲染
import { ok } from '@/lib/response';
import { triggerManualSync } from '@/lib/scheduler';

/**
 * POST /api/stats/sync — 手动同步：经调度器统一执行（入队/计数/熔断/冷却）
 * S26: live模式实际拉取开放平台作品+评论（mock只入队，行为不变）
 * S28: 手动与自动共用 executeSync，今日次数/熔断状态一致；入队由调度器内部完成，此处不重复入队
 */
export async function POST() {
  const r = await triggerManualSync().catch((e: Error): { ok: boolean; detail: string; task_id?: string } => ({ ok: false, detail: e.message }));
  return ok({ task_id: r.task_id || null, scheduled: r.ok, sync: r });
}
