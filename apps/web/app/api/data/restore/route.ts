export const dynamic = 'force-dynamic'; // S38: 恢复写内存+文件，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { restoreBackup } from '@/lib/localData';
import { decryptBackup, type EncPack } from '@/lib/backupCrypto';

/** POST /api/data/restore {data, pass?}（S38 从备份JSON恢复；S61 data.__enc 时用 pass 解密，口令错拒绝） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.data || typeof body.data !== 'object') return fail('FATAL', '缺少备份内容');
  let data = body.data as Record<string, unknown>;
  if ((data as { __enc?: number }).__enc === 1) {
    const pass = String(body.pass || '');
    if (pass.length < 6) return fail('FATAL', '这是加密备份，请输入口令（至少6位）');
    const decrypted = decryptBackup(data as unknown as EncPack, pass) as Record<string, unknown> | null;
    if (!decrypted) return fail('FATAL', '口令错误或备份文件损坏');
    data = decrypted;
  }
  const r = restoreBackup(data);
  if (!r.ok) return fail('FATAL', r.error || '恢复失败');
  return ok({ restored: true });
}
