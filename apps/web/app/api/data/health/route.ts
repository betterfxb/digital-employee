export const dynamic = 'force-dynamic'; // 读本机数据目录实况，禁静态预渲染
import { ok } from '@/lib/response';
import { getRecoveryInfo } from '@/lib/localData';

/**
 * S122 数据健康探针：GET /api/data/health
 * recovery 非空=本次启动发生过自愈（local.json 损坏已从 backups/ 快照恢复）；
 * Shell 顶栏黄条据此提示用户，并建议立即手动备份留证。只读，无参数。
 */
export async function GET() {
  return ok({ recovery: getRecoveryInfo() });
}
