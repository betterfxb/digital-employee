export const dynamic = 'force-dynamic'; // 读本机数据目录实况，禁静态预渲染
import fs from 'fs';
import path from 'path';
import { ok } from '@/lib/response';
import { getRecoveryInfo, currentCounts, getLastImportAt } from '@/lib/localData';
import { listBackups } from '@/lib/autoBackup';

/**
 * S122 数据健康探针：GET /api/data/health
 * recovery 非空=本次启动发生过自愈（local.json 损坏已从 backups/ 快照恢复）；
 * Shell 顶栏黄条据此提示用户，并建议立即手动备份留证。
 * S146 扩读数（同端点加字段不破契约语义）：writable 磁盘试笔 / counts 集合规模 /
 * backups 份数与最近一份时间 / last_import_at——供设置页"系统健康自检"体检单。
 */
export async function GET() {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  let writable = false;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.health-probe');
    fs.writeFileSync(probe, '1', 'utf8');
    fs.unlinkSync(probe);
    writable = true;
  } catch { /* 不可写由体检单亮红 */ }
  const backs = listBackups();
  return ok({
    recovery: getRecoveryInfo(),
    writable,
    counts: currentCounts(),
    last_import_at: getLastImportAt() ?? null,
    backups: { count: backs.length, latest: backs[0] ? { name: backs[0].name, mtime: backs[0].mtime } : null },
  });
}
