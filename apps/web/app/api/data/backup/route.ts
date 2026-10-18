export const dynamic = 'force-dynamic'; // S38: 备份读实时数据，禁静态预渲染
import { backupAll } from '@/lib/localData';
import { encryptBackup } from '@/lib/backupCrypto';
import { loadHistory } from '@/lib/hotHistory';
import { loadBizHistory } from '@/lib/businessHistory';
import { fail } from '@/lib/response';

/** GET /api/data/backup[?pass=]（S38 全量业务数据；S61 ?pass=≥6位加密；S71 附带热词/业务趋势快照随备份走） */
export async function GET(req: Request) {
  const pass = new URL(req.url).searchParams.get('pass');
  const stamp = new Date().toISOString().slice(0, 10);
  const full = { ...backupAll(), snapshots: { hot: loadHistory(), biz: loadBizHistory() } };
  if (pass !== null) {
    if (pass.length < 6) return fail('FATAL', '加密口令至少6位');
    const body = encryptBackup(full, pass);
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="huoke-backup-enc-${stamp}.json"`,
      },
    });
  }
  const body = JSON.stringify(full, null, 2);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="huoke-backup-${stamp}.json"`,
    },
  });
}
