/**
 * S25 买断制license验签（docs/11 §2/§5）：Ed25519签名文件 + 模块级缓存
 * S30 商用策略：无license/绑定不符 → UI激活门锁核心功能（API保持开放供导入与自动化）；机器绑定见 machineId.matchBind
 */
import fs from 'fs';
import path from 'path';
import { createPublicKey, createHash, verify as edVerify } from 'crypto';
import { currentFactors, machineCode, matchBind, type MachineFactors } from './machineId';

export interface LicensePayload {
  customer: string;
  issued_at: string;
  /** null=买断长期；有值=维护期/授权截止 */
  expires_at: string | null;
  features: string[];
  seats: number;
  machine_slots: number;
  watermark: string;
  /** S30 机器绑定三因子哈希（缺省=不绑定，兼容旧license） */
  machine_bind?: Partial<MachineFactors>;
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
  /** S30 本机机器码（激活页展示）与绑定是否通过 */
  machine_code: string;
  machine_ok: boolean;
  error: string | null;
}

/** S30 数据目录外置（桌面端指向 %APPDATA%，默认兼容 cwd/data） */
function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}
const LICENSE_FILE = () => path.join(dataDir(), 'license.license');
const PUB_FILE = () => path.join(dataDir(), 'license_pub.pem');

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
    valid: false, // S30 商用：demo锁核心功能（UI激活门拦截），API保持开放
    customer: null,
    expires_at: null,
    features: [],
    seats: 0,
    machine_slots: 0,
    watermark: process.env.WATERMARK_ID ? watermarkOf(process.env.WATERMARK_ID) : 'wl-demo0000',
    machine_code: machineCode(),
    machine_ok: true,
    error,
  };
}

/** 纯验签（不落盘不缓存）：候选内容 → 状态；供导入前校验复用 */
export function verifyLicenseContent(rawText: string, pubPem?: string): { state: LicenseState | null; error: string | null } {
  let raw: { payload: LicensePayload; sig: string };
  try { raw = JSON.parse(rawText) as { payload: LicensePayload; sig: string }; } catch { return { state: null, error: 'license文件不是合法JSON' }; }
  if (!raw.payload || typeof raw.sig !== 'string') return { state: null, error: 'license结构缺失（payload/sig）' };
  let pubPemFinal = pubPem;
  if (!pubPemFinal) {
    if (!fs.existsSync(PUB_FILE())) return { state: null, error: '公钥缺失，无法验签' };
    pubPemFinal = fs.readFileSync(PUB_FILE(), 'utf8');
  }
  let sigOk = false;
  try { sigOk = edVerify(null, canonicalPayload(raw.payload), createPublicKey(pubPemFinal), Buffer.from(raw.sig, 'base64')); } catch { sigOk = false; }
  if (!sigOk) return { state: null, error: 'license签名校验失败（文件被篡改或非本产品授权）' };
  const p = raw.payload;
  const bindOk = matchBind(p.machine_bind, currentFactors());
  const expired = p.expires_at !== null && new Date(p.expires_at) < new Date();
  const state: LicenseState = {
    mode: 'licensed',
    valid: !expired && bindOk,
    customer: p.customer || null,
    expires_at: p.expires_at,
    features: p.features || [],
    seats: p.seats || 0,
    machine_slots: p.machine_slots || 0,
    watermark: p.watermark || watermarkOf(p.customer),
    machine_code: machineCode(),
    machine_ok: bindOk,
    error: expired ? `授权已于${p.expires_at}到期` : (!bindOk ? '授权绑定的机器码与本机不符（换机请联系重新签发）' : null),
  };
  return { state, error: null };
}

let cache: LicenseState | null = null;

export function getLicenseState(): LicenseState {
  if (cache) return cache;
  try {
    if (!fs.existsSync(LICENSE_FILE()) || !fs.existsSync(PUB_FILE())) {
      cache = demoState(null);
      return cache;
    }
    const r = verifyLicenseContent(fs.readFileSync(LICENSE_FILE(), 'utf8'));
    if (!r.state) {
      cache = { ...demoState(r.error), mode: 'licensed' };
      return cache;
    }
    cache = r.state;
    return cache;
  } catch (e) {
    cache = demoState(`license读取异常：${(e as Error).message}`);
    return cache;
  }
}

/** 导入license：验签+机器绑定全过后落盘并刷新缓存（S30 激活流） */
export function importLicense(rawText: string): { ok: boolean; error: string | null; state: LicenseState | null } {
  const r = verifyLicenseContent(rawText);
  if (!r.state) return { ok: false, error: r.error, state: null };
  if (!r.state.valid) return { ok: false, error: r.state.error, state: null }; // 过期/绑定不符不落盘
  fs.mkdirSync(dataDir(), { recursive: true });
  const tmp = `${LICENSE_FILE()}.tmp`;
  fs.writeFileSync(tmp, rawText, 'utf8');
  fs.renameSync(tmp, LICENSE_FILE());
  cache = r.state;
  return { ok: true, error: null, state: r.state };
}

export function resetLicenseCache(): void {
  cache = null;
}

/**
 * 功能闸挂载点（保留给API侧细粒度管控；当前策略：API开放、UI激活门锁核心功能）
 * demo放行由S25红线改为S30商用锁定：无license仅激活门可见
 */
export function requireLicense(feature: string): { allowed: boolean; state: LicenseState } {
  const s = getLicenseState();
  if (s.mode === 'demo') return { allowed: false, state: s };
  if (!s.valid) return { allowed: false, state: s };
  if (s.features.length > 0 && !s.features.includes(feature)) return { allowed: false, state: s };
  return { allowed: true, state: s };
}
