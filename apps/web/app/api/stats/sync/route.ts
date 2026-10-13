export const dynamic = 'force-dynamic'; // S26: live同步写态，禁静态预渲染
import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';
import { runLiveSync, liveSyncEnabled } from '@/lib/liveSync';

/**
 * POST /api/stats/sync — 入队即返回，冷却由前端按manualSyncCooldownSec控制
 * S26: live模式在入队后实际拉取开放平台作品+评论（mock保持纯入队，行为不变）
 */
export async function POST() {
  const enq = getRepos().sync.enqueue();
  if (!liveSyncEnabled()) return ok(enq);
  const live = await runLiveSync().catch((e: Error) => ({ mode: 'error' as const, error: e.message, videos: { created: 0, updated: 0 }, comments: { created: 0, updated: 0, skipped: 0 }, pages: 0 }));
  return ok({ ...enq, live_sync: live });
}
