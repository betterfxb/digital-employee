export const dynamic = 'force-dynamic'; // S12: 每次扫码需新state，禁静态预渲染
import QRCode from 'qrcode';
import { ok } from '@/lib/response';
import { authConfig } from '@/config/auth.config';
import { douyinConfig } from '@/config/douyin.config';
import { buildAuthorizeUrl } from '@/lib/douyinPort';

/**
 * GET /api/auth/douyin/qrcode（S31: 真二维码图片dataURL）
 * 二维码内容=授权链接：live为开放平台官方授权页（redirect_uri按配置登记）；
 * mock取【请求来源origin】而非配置默认3001（桌面端随机端口/服务器部署下内容才自洽）
 */
export async function GET(req: Request) {
  const state = Math.random().toString(36).slice(2, 8);
  const qrcode_url = buildAuthorizeUrl(state) || `${new URL(req.url).origin}/api/auth/douyin/authorize?state=${state}`;
  const qr_data_url = await QRCode.toDataURL(qrcode_url, {
    margin: 1, width: 240, errorCorrectionLevel: 'M',
    color: { dark: '#1A1A18', light: '#FFFFFF' },
  });
  return ok({ qrcode_url, qr_data_url, state, expire_in: authConfig.qrcodeExpireSec, mode: douyinConfig.mode });
}
