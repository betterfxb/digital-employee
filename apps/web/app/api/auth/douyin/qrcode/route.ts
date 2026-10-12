export const dynamic = 'force-dynamic'; // S12: 每次扫码需新state，禁静态预渲染
import { ok } from '@/lib/response';
import { authConfig } from '@/config/auth.config';
import { douyinConfig } from '@/config/douyin.config';

/** GET /api/auth/douyin/qrcode（P0 mock：返回演示二维码state；mode=S23预真机模式供授权页展示） */
export async function GET() {
  const state = Math.random().toString(36).slice(2, 8);
  return ok({ qrcode_url: `mock://douyin/qr/${state}`, state, expire_in: authConfig.qrcodeExpireSec, mode: douyinConfig.mode });
}
