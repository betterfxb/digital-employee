#!/usr/bin/env node
/**
 * S42 live切换自检：对运行中服务打三项（mode/authorize跳转/qrcode内容），全PASS即就绪
 * 用法：node scripts/live-check.js [base]   （默认 http://localhost:3001）
 */
const base = process.argv[2] || 'http://localhost:3001';
let fail = 0;
const pass = (ok, name, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra}`); if (!ok) fail++; };

(async () => {
  // 1) 模式
  const st = await fetch(`${base}/api/license/status`).then((r) => r.json()).catch(() => null);
  const mode = st ? 'unknown' : 'down';
  // mode 在 qrcode 接口透传
  const qr = await fetch(`${base}/api/auth/douyin/qrcode`).then((r) => r.json()).catch(() => null);
  pass(qr?.mode === 'live', '① 模式已切live', ` (mode=${qr?.mode})`);

  // 2) authorize 302 指向抖音官方域名（live 且密钥齐时）
  const a = await fetch(`${base}/api/auth/douyin/authorize?nick=自检`, { redirect: 'manual' }).catch(() => null);
  const loc = a?.headers?.get('location') || '';
  pass(loc.startsWith('https://open.douyin.com'), '② 授权跳转=抖音官方', ` (${loc.slice(0, 60) || '无跳转'})`);

  // 3) 二维码内容指向官方
  const qurl = qr?.qrcode_url || '';
  pass(qurl.startsWith('https://open.douyin.com'), '③ 二维码=官方授权链接', ` (${qurl.slice(0, 60) || '空'})`);

  console.log(fail === 0 ? 'LIVE READY 全部就绪：授权页弹窗内即抖音官方登录页' : `LIVE ${fail} 项未过：核对 .env.local 密钥后重启再检`);
  process.exit(fail === 0 ? 0 : 1);
})();
