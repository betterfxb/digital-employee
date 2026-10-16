export const dynamic = 'force-dynamic'; // S12: 每次扫码需新state，禁静态预渲染
import QRCode from 'qrcode';
import { ok } from '@/lib/response';
import { authConfig } from '@/config/auth.config';
import { douyinConfig } from '@/config/douyin.config';
import { buildAuthorizeUrl } from '@/lib/douyinPort';

/**
 * GET /api/auth/douyin/qrcode（S31: 真二维码图片dataURL）
 * 二维码内容=授权链接：live为开放平台官方授权页；mock为本机授权入口（部署态手机可扫，localhost仅演示外观）
 */
export async function GET() {
  const state = Math.random().toString(36).slice(2, 8);
  const qrcode_url = buildAuthorizeUrl(state) || `${douyinConfig.baseUrl}/api/auth/douyin/authorize?state=${state}`;
  const qr_data_url = await QRCode.toDataURL(qrcode_url, {
    margin: 1, width: 240, errorCorrectionLevel: 'M',
    color: { dark: '#1A1A18', light: '#FFFFFF' },
  });
  return ok({ qrcode_url, qr_data_url, state, expire_in: authConfig.qrcodeExpireSec, mode: douyinConfig.mode });
}
