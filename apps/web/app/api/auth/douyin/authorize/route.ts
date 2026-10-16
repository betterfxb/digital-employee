export const dynamic = 'force-dynamic'; // S12: 授权状态在内存，禁静态预渲染
import { douyinConfig } from '@/config/douyin.config';
import { createState } from '@/lib/localData';
import { buildAuthorizeUrl } from '@/lib/douyinPort';

/**
 * GET /api/auth/douyin/authorize?nick=&popup= — S23 预真机授权入口
 * mock：占位密钥，非弹窗直接302到本地callback跑通全流程；popup=1先到确认演示页（S31弹窗流）
 * live：302开放平台授权页（弹窗内即抖音官方登录页；缺密钥给明确错误）
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const nick = (u.searchParams.get('nick') || '').slice(0, 20);
  const popup = u.searchParams.get('popup') === '1';
  const state = createState(nick);
  const url = buildAuthorizeUrl(state);
  if (douyinConfig.mode === 'live' && !url) {
    return Response.redirect(new URL('/auth?err=' + encodeURIComponent('live模式缺少DOUYIN_CLIENT_KEY/SECRET'), req.url), 302);
  }
  if (!url && popup) {
    return Response.redirect(new URL(`/api/auth/douyin/mock-consent?state=${state}`, req.url), 302);
  }
  const target = url || `/api/auth/douyin/callback?code=mock_${state}&state=${state}`;
  return Response.redirect(new URL(target, req.url), 302);
}
