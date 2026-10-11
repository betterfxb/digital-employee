import { ok } from '@/lib/response';
import { getRepos } from '@/lib/repo';

/** POST /api/stats/sync（入队即返回，冷却由前端按manualSyncCooldownSec控制） */
export async function POST() {
  return ok(getRepos().sync.enqueue());
}
