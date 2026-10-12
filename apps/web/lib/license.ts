/**
 * S25 买断制license验签（docs/11 §2/§5）：Ed25519签名文件 + 模块级缓存
 * 红线：demo宽松不锁功能、数据可导出、误伤先提示——占位期只展示状态，功能闸挂载点见 requireLicense
 */
import fs from 'fs';
import path from 'path';
import { createPublicKey, createHash, verify as edVerify } from 'crypto';

export interface LicensePayload {
  customer: string;
  issued_at: string;
  /** null=买断长期；有值=维护期/授权截止 */
  expires_at: string | null;
  features: string[];
  seats: number;
  machine_slots: number;
  watermark: string;
  v: 1;
}

export interface LicenseState {
  mode: 'demo' | 'licensed';
  valid: boolean;
  customer: string | null;
  expires_at: string | null;
  features: string[];
  seats: number;
  machine_slots: number;
  watermark: string;
  error: string | null;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const LICENSE_FILE = path.join(DATA_DIR, 'license.license');
const PUB_FILE = path.join(DATA_DIR, 'license_pub.pem');

/** 溯源水印：客户ID→wl-<sha256前8>（防不了复制，能定位泄露源，docs/11§3.4） */
export function watermarkOf(customerId: string): string {
  return `wl-${createHash('sha256').update(customerId).digest('hex').slice(0, 8)}`;
}

/** 签名canonical：key排序后序列化（与scripts/license-gen.js同算法，防key顺序漂移） */
export function canonicalPayload(p: LicensePayload): Buffer {
  const out: Record<string, unknown> = {};
  Object.keys(p).sort().forEach((k) => { out[k] = (p as unknown as Record<string, unknown>)[k]; });
  return Buffer.from(JSON.stringify(out));
}

function demoState(error: string | null): LicenseState {
  return {
    mode: 'demo',
    valid: true, // 红线：demo不锁功能（docs/11§5）
    customer: null,
    expires_at: null,
    features: [],
    seats: 0,
    machine_slots: 0,
    watermark: process.env.WATERMARK_ID ? watermarkOf(process.env.WATERMARK_ID) : 'wl-demo0000',
    error,
  };
}

let cache: LicenseState | null = null;

export function getLicenseState(): LicenseState {
  if (cache) return cache;
  try {
    if (!fs.existsSync(LICENSE_FILE) || !fs.existsSync(PUB_FILE)) {
      cache = demoState(null);
      return cache;
    }
    const raw = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8')) as { payload: LicensePayload; sig: string };
    const pub = createPublicKey(fs.readFileSync(PUB_FILE, 'utf8'));
    const sigOk = edVerify(null, canonicalPayload(raw.payload), pub, Buffer.from(raw.sig, 'base64'));
    if (!sigOk) {
      cache = { ...demoState('license签名校验失败，按演示模式运行'), mode: 'licensed', valid: false };
      return cache;
    }
    const p = raw.payload;
    const expired = p.expires_at !== null && new Date(p.expires_at) < new Date();
    cache = {
      mode: 'licensed',
      valid: !expired,
      customer: p.customer,
      expires_at: p.expires_at,
      features: p.features,
      seats: p.seats,
      machine_slots: p.machine_slots,
      watermark: p.watermark || watermarkOf(p.customer),
      error: expired ? `授权已于${p.expires_at}到期（占位期不锁功能，正式期启用功能闸）` : null,
    };
    return cache;
  } catch (e) {
    cache = demoState(`license读取异常：${(e as Error).message}`);
    return cache;
  }
}

/**
 * 功能闸挂载点（live接真实API时在受保护路由调用）
 * demo恒放行；licensed需valid且feature在features清单（空清单=全开）
 */
export function requireLicense(feature: string): { allowed: boolean; state: LicenseState } {
  const s = getLicenseState();
  if (s.mode === 'demo') return { allowed: true, state: s };
  if (!s.valid) return { allowed: false, state: s };
  if (s.features.length > 0 && !s.features.includes(feature)) return { allowed: false, state: s };
  return { allowed: true, state: s };
}
