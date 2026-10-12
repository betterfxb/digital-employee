export const dynamic = 'force-dynamic'; // S12: 授权状态在内存，禁静态预渲染
import { douyinConfig } from '@/config/douyin.config';
import { createState } from '@/lib/localData';
import { buildAuthorizeUrl } from '@/lib/douyinPort';

/**
 * GET /api/auth/douyin/authorize?nick= — S23 预真机授权入口
 * mock：占位密钥，直接302到本地callback跑通全流程；live：302开放平台授权页（缺密钥给明确错误）
 */
export async function GET(req: Request) {
  const nick = (new URL(req.url).searchParams.get('nick') || '').slice(0, 20);
  const state = createState(nick);
  const url = buildAuthorizeUrl(state);
  if (douyinConfig.mode === 'live' && !url) {
    return Response.redirect(new URL('/auth?err=' + encodeURIComponent('live模式缺少DOUYIN_CLIENT_KEY/SECRET'), req.url), 302);
  }
  const target = url || `/api/auth/douyin/callback?code=mock_${state}&state=${state}`;
  return Response.redirect(new URL(target, req.url), 302);
}
