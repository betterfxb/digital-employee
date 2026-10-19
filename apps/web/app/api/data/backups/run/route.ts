export const dynamic = 'force-dynamic'; // S80: 写盘操作禁静态
import { ok, fail } from '@/lib/response';
import { runBackup } from '@/lib/autoBackup';
import { pushAuthLog } from '@/lib/localData';

/** POST /api/data/backups/run（S80 立即备份一份 manual-*.json，返回新条目） */
export async function POST() {
  const entry = runBackup('manual');
  if (!entry) return fail('FATAL', '还没有业务数据文件（先导入或操作一次数据）', 400);
  pushAuthLog('手动本地备份', '店长', entry.name);
  return ok({ created: true, entry });
}
