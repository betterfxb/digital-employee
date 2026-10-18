export const dynamic = 'force-dynamic'; // S38: 恢复写内存+文件，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { restoreBackup } from '@/lib/localData';
import { decryptBackup, type EncPack } from '@/lib/backupCrypto';

/** 恢复前预览：结构/口令校验 + 计数，绝不写盘（S64 覆盖确认防线） */
function previewOf(data: Record<string, unknown>) {
  const arr = (k: string) => (Array.isArray(data[k]) ? (data[k] as unknown[]).length : 0);
  return {
    accounts: arr('accounts'),
    videos: arr('videos'),
    comments: arr('comments'),
    follows: arr('follows'),
    customScripts: arr('customScripts'),
    cleared: typeof data.cleared_at === 'string',
  };
}

/**
 * POST /api/data/restore {data, pass?, preview?}
 * S38 从备份恢复；S61 data.__enc 用 pass 解密（错口令拒）；S64 preview=1 只校验计数不落盘
 */
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
  if (!['accounts', 'videos', 'comments'].every((k) => k in data)) return fail('FATAL', '不是本系统的备份文件');
  if (body.preview === true) {
    return ok({ preview: true, ...previewOf(data) });
  }
  const r = restoreBackup(data);
  if (!r.ok) return fail('FATAL', r.error || '恢复失败');
  return ok({ restored: true });
}
