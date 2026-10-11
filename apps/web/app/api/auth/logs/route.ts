export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { page } from '@/lib/response';

/** GET /api/auth/logs（P0 mock操作日志，保留authLogRetentionDays=90天语义） */
export async function GET() {
  return page([
    { at: '10-09 09:41', op: '扫码授权成功', by: '店长', result: '有效期30天' },
    { at: '10-08 06:02', op: '每日STAT同步', by: '系统', result: '38视频 · 成功' },
    { at: '10-07 22:14', op: 'token预刷新', by: '系统', result: '成功' },
  ], null);
}
