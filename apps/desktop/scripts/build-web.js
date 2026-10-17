/**
 * S30 打包前置：构建 web（standalone 模式）→ 拷贝到 apps/desktop/resources/standalone
 * standalone 需补 .next/static 与 public；验签公钥一并进包（私钥永不随包）
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const webDir = path.join(__dirname, '..', '..', 'web');
const r = spawnSync('pnpm', ['build'], {
  cwd: webDir,
  env: { ...process.env, NEXT_OUTPUT_STANDALONE: '1' },
  stdio: 'inherit',
  shell: true,
});
if (r.status !== 0) { console.error('web 构建失败'); process.exit(r.status || 1); }

const standaloneSrc = path.join(webDir, '.next', 'standalone');
if (!fs.existsSync(standaloneSrc)) { console.error('standalone 产物缺失：' + standaloneSrc); process.exit(1); }

const resDir = path.join(__dirname, '..', 'resources');
const dst = path.join(resDir, 'standalone');
fs.mkdirSync(resDir, { recursive: true });
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(standaloneSrc, dst, { recursive: true });
fs.cpSync(path.join(webDir, '.next', 'static'), path.join(dst, '.next', 'static'), { recursive: true });
const pub = path.join(webDir, 'public');
if (fs.existsSync(pub)) fs.cpSync(pub, path.join(dst, 'public'), { recursive: true });

const keySrc = path.join(webDir, 'data', 'license_pub.pem');
if (fs.existsSync(keySrc)) {
  fs.copyFileSync(keySrc, path.join(resDir, 'license_pub.pem'));
} else {
  console.warn('警告: data/license_pub.pem 缺失（先跑 web 的 license-gen.js keypair），桌面端将无法验签');
}

// ── S31安全硬校验：data目录（私钥/业务数据/license）绝不能进包 ──
// Next file-trace 会把 web/data 整个目录带进 standalone，打包前必须清除 + 违禁扫描兜底
fs.rmSync(path.join(dst, 'data'), { recursive: true, force: true });
const banned = [];
(function scan(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) scan(p);
    else if (/license_key\.pem$|\.license$|local\.json$|\.master_key$/.test(e.name)) banned.push(p);
  }
})(dst);
if (banned.length) { console.error('构建中止：产物中发现敏感文件 →', banned); process.exit(1); }
console.log('sensitive-data check OK：data/已清除，产物无私钥/license/业务数据');
console.log('resources ready →', dst);
