export const dynamic = 'force-dynamic'; // S38: 恢复写内存+文件，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { restoreBackup } from '@/lib/localData';

/** POST /api/data/restore {data:{...}} — S38 从备份JSON恢复（校验结构+内存即时生效） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.data || typeof body.data !== 'object') return fail('FATAL', '缺少备份内容');
  const r = restoreBackup(body.data as Record<string, unknown>);
  if (!r.ok) return fail('FATAL', r.error || '恢复失败');
  return ok({ restored: true });
}
