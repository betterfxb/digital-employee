export const dynamic = 'force-dynamic'; // S30: 读写license文件+机器指纹，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { importLicense } from '@/lib/license';

/** POST /api/license/import {license:<license文件文本>}（S30 激活流：验签+机器绑定全过才落盘） */
export async function POST(req: Request) {
  let raw: unknown;
  try { raw = (await req.json()).license; } catch { return fail('FATAL', '请求体解析失败'); }
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 65536) return fail('FATAL', '缺少或超长的license内容');
  const r = importLicense(raw);
  if (!r.ok || !r.state) return fail('FATAL', r.error || '导入失败');
  return ok({ imported: true, ...r.state });
}
