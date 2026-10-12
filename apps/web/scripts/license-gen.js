#!/usr/bin/env node
/**
 * S25 发证工具（node直跑）：
 *   node scripts/license-gen.js keypair                          生成密钥对到 data/（私钥永不进仓）
 *   node scripts/license-gen.js issue --customer 萌络网络 --days 365 --features videos,comments,assist --seats 5
 * 签名canonical与lib/license.ts同算法（key排序），保证跨语言验签一致
 */
const { generateKeyPairSync, createPrivateKey, sign, createHash } = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const KEY = path.join(DATA, 'license_key.pem');
const PUB = path.join(DATA, 'license_pub.pem');
const LIC = path.join(DATA, 'license.license');

function canonical(p) {
  const out = {};
  Object.keys(p).sort().forEach((k) => { out[k] = p[k]; });
  return Buffer.from(JSON.stringify(out));
}

function arg(name, dft) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dft;
}

const cmd = process.argv[2];
if (cmd === 'keypair') {
  fs.mkdirSync(DATA, { recursive: true });
  if (fs.existsSync(KEY)) { console.log('已存在密钥对（如需重置请先删除 data/license_*.pem）'); process.exit(0); }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  fs.writeFileSync(KEY, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  fs.writeFileSync(PUB, publicKey.export({ type: 'spki', format: 'pem' }));
  console.log('keypair OK → data/license_key.pem（私钥，勿进仓） + data/license_pub.pem（公钥，随部署分发）');
} else if (cmd === 'issue') {
  if (!fs.existsSync(KEY) || !fs.existsSync(PUB)) { console.error('先跑 keypair 生成密钥对'); process.exit(1); }
  const customer = arg('customer', '');
  if (!customer) { console.error('缺少 --customer 客户标识'); process.exit(1); }
  const days = Number(arg('days', '0')); // 0=买断长期
  const features = (arg('features', '') || '').split(',').filter(Boolean);
  const seats = Number(arg('seats', '5'));
  const slots = Number(arg('slots', '2'));
  const watermark = arg('watermark', `wl-${createHash('sha256').update(customer).digest('hex').slice(0, 8)}`);
  const now = new Date();
  const yyyyMMdd = (d) => d.toISOString().slice(0, 10);
  const payload = {
    customer,
    issued_at: yyyyMMdd(now),
    expires_at: days > 0 ? yyyyMMdd(new Date(now.getTime() + days * 86400000)) : null,
    features,
    seats,
    machine_slots: slots,
    watermark,
    v: 1,
  };
  const key = createPrivateKey(fs.readFileSync(KEY));
  const sig = sign(null, canonical(payload), key);
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(LIC, JSON.stringify({ payload, sig: sig.toString('base64') }, null, 2));
  console.log(`license OK → data/license.license`);
  console.log(`  客户=${customer} 到期=${payload.expires_at || '买断长期'} 席位=${seats} 槽位=${slots}`);
  console.log(`  features=${features.length ? features.join(',') : '(全开)'} watermark=${watermark}`);
} else {
  console.log('用法: keypair | issue --customer <客户> [--days 365] [--features a,b] [--seats 5] [--slots 2] [--watermark wl-xxxxxxxx]');
}
