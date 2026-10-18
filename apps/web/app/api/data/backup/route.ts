export const dynamic = 'force-dynamic'; // S38: 备份读实时数据，禁静态预渲染
import { backupAll } from '@/lib/localData';
import { encryptBackup } from '@/lib/backupCrypto';
import { fail } from '@/lib/response';

/** GET /api/data/backup（S38 全量业务数据JSON下载；S61 ?pass=口令≥6位 → AES-GCM加密备份） */
export async function GET(req: Request) {
  const pass = new URL(req.url).searchParams.get('pass');
  const stamp = new Date().toISOString().slice(0, 10);
  if (pass !== null) {
    if (pass.length < 6) return fail('FATAL', '加密口令至少6位');
    const body = encryptBackup(backupAll(), pass);
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="huoke-backup-enc-${stamp}.json"`,
      },
    });
  }
  const body = JSON.stringify(backupAll(), null, 2);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="huoke-backup-${stamp}.json"`,
    },
  });
}
