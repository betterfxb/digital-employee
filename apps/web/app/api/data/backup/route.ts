export const dynamic = 'force-dynamic'; // S38: 备份读实时数据，禁静态预渲染
import { backupAll } from '@/lib/localData';

/** GET /api/data/backup — S38 全量业务数据JSON下载（换机迁移/误删兜底） */
export async function GET() {
  const body = JSON.stringify(backupAll(), null, 2);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="huoke-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
