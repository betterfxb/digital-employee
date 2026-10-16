export const dynamic = 'force-dynamic'; // S31: 按state渲染演示授权页，禁静态预渲染
import { douyinConfig } from '@/config/douyin.config';
import { pendingAuthStates } from '@/lib/localData';

/**
 * GET /api/auth/douyin/mock-consent?state — S31 mock模式弹窗内的授权确认演示页
 * 红线：仅确认/取消两个动作，无任何密码手机号输入、不仿制抖音登录界面（live模式该页404，弹窗内是抖音官方页）
 */
export async function GET(req: Request) {
  if (douyinConfig.mode === 'live') return new Response('Not Found', { status: 404 });
  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state') || '';
  const pending = pendingAuthStates.get(state);
  const headers = { 'Content-Type': 'text/html; charset=utf-8' };
  if (!pending) {
    return new Response(page('授权已过期', '该授权请求已失效，请回到工作台重新点击「抖音登录授权」。', '', true), { status: 410, headers });
  }
  const nick = pending.nick || douyinConfig.testNick;
  const confirm = `/api/auth/douyin/callback?code=mock_${state}&state=${state}`;
  return new Response(page('授权确认', `「获客中台」请求获取你的抖音账号公开信息、作品与评论数据，用于工作台聚合管理。`, `
    <div class="row"><span class="k">将登录账号</span><b>${escapeHtml(nick)}</b></div>
    <div class="row"><span class="k">有效期</span><b>30天（可刷新）</b></div>
    <div class="row"><span class="k">权限范围</span><b>个人信息 · 作品列表 · 评论读取</b></div>
    <a class="btn" href="${confirm}">确认授权</a>
    <a class="cancel" href="/auth?err=${encodeURIComponent('已取消授权')}">取消</a>`), { headers });
}

function page(title: string, desc: string, body: string, expired = false): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${title} · 演示</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, "Microsoft YaHei", sans-serif; background: #F7F6F3; color: #1A1A18; display: flex; min-height: 100vh; align-items: center; justify-content: center; }
  .card { width: 360px; background: #fff; border: 1px solid #E8E6E1; border-radius: 8px; padding: 28px 28px 24px; }
  .tag { display: inline-block; font-size: 11px; color: #8A6D1F; background: #FBF3E4; border: 1px solid #EADFBE; border-radius: 3px; padding: 2px 8px; margin-bottom: 14px; }
  h1 { font-size: 17px; margin: 0 0 8px; }
  p { font-size: 13px; color: #6B6862; line-height: 1.7; margin: 0 0 16px; }
  .row { display: flex; justify-content: space-between; font-size: 13px; padding: 9px 0; border-top: 1px solid #F0EEE9; }
  .row .k { color: #A8A5A0; }
  .btn { display: block; margin-top: 18px; background: #1A1A18; color: #fff; text-align: center; padding: 11px 0; border-radius: 5px; font-size: 14px; text-decoration: none; }
  .btn:hover { background: #33312D; }
  .cancel { display: block; margin-top: 12px; text-align: center; font-size: 13px; color: #A8A5A0; text-decoration: none; }
  .foot { margin-top: 16px; font-size: 11px; color: #A8A5A0; line-height: 1.7; border-top: 1px solid #F0EEE9; padding-top: 12px; }
</style></head><body><div class="card">
  <div class="tag">演示环境 · 非抖音官方页面</div>
  <h1>${title}</h1><p>${desc}</p>${body}
  ${expired ? '' : '<div class="foot">真实部署（live模式）时此弹窗即为抖音官方登录页，账号密码只在抖音侧填写。</div>'}
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
