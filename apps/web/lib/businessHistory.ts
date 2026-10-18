/**
 * S55 业务趋势快照：独立文件 business-history.json（date→指标，保留30天）
 * 记录时机：经营报告页打开时（POST /api/report/snapshot），每日最多一次
 * 与 hotHistory 同原则：只记真实数据，绝不补造历史
 */
import fs from 'fs';
import path from 'path';
import type { BizSnapshot, BizHist } from './bizTrend';

export type { BizSnapshot, BizHist } from './bizTrend';
type Hist = BizHist;

const FILE = () => path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'business-history.json');

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function loadBizHistory(): Hist {
  try {
    if (fs.existsSync(FILE())) {
      const raw = JSON.parse(fs.readFileSync(FILE(), 'utf8')) as Hist;
      if (raw && typeof raw === 'object') return raw;
    }
  } catch { /* 损坏重新积累 */ }
  return {};
}

/** 记录今日业务快照（当日已有则原样）；返回最近N天 */
export function appendBizToday(s: BizSnapshot, keepDays = 30): Hist {
  const today = todayStr();
  const h = loadBizHistory();
  if (!h[today]) {
    h[today] = s;
    const keys = Object.keys(h).sort().slice(-keepDays);
    const trimmed: Hist = {};
    keys.forEach((k) => { trimmed[k] = h[k]; });
    try {
      fs.mkdirSync(path.dirname(FILE()), { recursive: true });
      const tmp = `${FILE()}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(trimmed), 'utf8');
      fs.renameSync(tmp, FILE());
    } catch { /* 写失败不影响请求 */ }
    return trimmed;
  }
  return h;
}

/** S71 恢复备份时整份回写业务趋势（保留30天裁剪；结构由调用方过滤） */
export function writeBizHistory(h: Record<string, unknown>): void {
  try {
    const keys = Object.keys(h).sort().slice(-30);
    const trimmed: Hist = {};
    keys.forEach((k) => { if (h[k] && typeof h[k] === 'object') trimmed[k] = h[k] as Partial<BizSnapshot>; });
    fs.mkdirSync(path.dirname(FILE()), { recursive: true });
    const tmp = `${FILE()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(trimmed), 'utf8');
    fs.renameSync(tmp, FILE());
  } catch { /* 尽力恢复，失败不阻断主恢复 */ }
}
