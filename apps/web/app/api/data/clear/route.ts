export const dynamic = 'force-dynamic'; // S37: 写内存+文件，禁静态预渲染
import { ok, fail } from '@/lib/response';
import { clearBusinessData } from '@/lib/localData';

/** POST /api/data/clear {confirm:'清空'} — S37 清空业务数据（保留账号授权与设置；误伤防线=确认词） */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (body?.confirm !== '清空') return fail('FATAL', '需在确认框输入「清空」（防误点丢数据）');
  clearBusinessData();
  return ok({ cleared: true });
}
