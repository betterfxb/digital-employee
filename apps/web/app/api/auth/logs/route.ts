export const dynamic = 'force-dynamic'; // S12: 内存态读接口禁静态预渲染
import { page } from '@/lib/response';
import { authLogs } from '@/lib/localData';

/** GET /api/auth/logs（操作日志：初始3条+绑定/导入实时追加，保留authLogRetentionDays=90天语义） */
export async function GET() {
  return page(authLogs, null);
}
