export const dynamic = 'force-dynamic'; // S80: 实时读备份目录，禁静态预渲染
import { ok } from '@/lib/response';
import { listBackups } from '@/lib/autoBackup';

/** GET /api/data/backups（S80 本地自动备份列表：保留14份，含容量与时间） */
export async function GET() {
  const list = listBackups();
  return ok({ list, keep: 14, total_size: list.reduce((s, b) => s + b.size, 0), last_auto: list.find((b) => b.kind === 'auto')?.name ?? null });
}
