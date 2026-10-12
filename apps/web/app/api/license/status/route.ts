export const dynamic = 'force-dynamic'; // S25: license状态读文件+缓存，禁静态预渲染
import { ok } from '@/lib/response';
import { getLicenseState } from '@/lib/license';

/** GET /api/license/status（S25：demo宽松/正式授权双态，占位期只展示不锁功能） */
export async function GET() {
  return ok(getLicenseState());
}
