#!/usr/bin/env node
/**
 * S42 live切换一键脚本：客户开放平台密钥到位后 5 分钟切换
 * 用法：node scripts/live-switch.js --key <client_key> --secret <client_secret> [--base https://你的回调域名]
 * 作用：写 .env.local（保留既有配置行）→ 提示重启 → 配套 live-check.js 自检
 */
const fs = require('fs');
const path = require('path');

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};

const key = arg('key', '');
const secret = arg('secret', '');
const base = arg('base', '');
const dry = process.argv.includes('--dry');

if (!key || !secret) {
  console.log('用法: node scripts/live-switch.js --key <client_key> --secret <client_secret> [--base https://回调域名] [--dry 演练不落盘]');
  console.log('  key/secret 来自抖音开放平台「管理中心→应用→开发配置」');
  console.log('  base = 开放平台登记的回调域名（桌面部署保持 http://localhost 或按联调约定）');
  console.log('  切换后重启服务，再跑 live-check.js 自检');
  process.exit(1);
}
if (key.length < 10 || secret.length < 8) { console.error('✗ key/secret 长度异常，请核对开放平台原值'); process.exit(1); }

const envPath = path.join(__dirname, '..', '.env.local');
let lines = [];
if (fs.existsSync(envPath)) {
  lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => l.trim());
}
const upsert = (k, v) => {
  const i = lines.findIndex((l) => l.startsWith(`${k}=`));
  const line = `${k}=${v}`;
  if (i > -1) lines[i] = line; else lines.push(line);
};
upsert('DOUYIN_MODE', 'live');
upsert('DOUYIN_CLIENT_KEY', key);
upsert('DOUYIN_CLIENT_SECRET', secret);
if (base) upsert('DOUYIN_REDIRECT_BASE', base.replace(/\/+$/, ''));
if (dry) {
  console.log('[dry] 将写入 .env.local：');
  console.log(`  DOUYIN_MODE=live\n  DOUYIN_CLIENT_KEY=${key.slice(0, 6)}…\n  DOUYIN_CLIENT_SECRET=${secret.slice(0, 4)}…${base ? `\n  DOUYIN_REDIRECT_BASE=${base}` : ''}`);
  process.exit(0);
}
fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
console.log('✓ 已写入 .env.local：DOUYIN_MODE=live + 密钥' + (base ? ' + 回调域名' : '（回调域名未改，按需编辑）'));
console.log('下一步：');
console.log('  1) 重启服务（开发机 pnpm start；桌面客户重启「获客中台」）');
console.log('  2) node scripts/live-check.js   ← 自检三项，全 PASS 即切换完成');
console.log('  3) 授权页点「抖音登录授权」——弹窗内应为抖音官方登录页');
