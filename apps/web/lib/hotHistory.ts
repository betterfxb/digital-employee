/**
 * S51 热词趋势快照：独立小文件 hot-history.json（date→词→次数，保留30天）
 * 独立于 local.json（快照语义；备份/清空不联动，一天最多记一次）
 * 注意：只记录真实运行数据，绝不造历史——首日只有当天，随使用自然积累
 */
import fs from 'fs';
import path from 'path';

type Hist = Record<string, Record<string, number>>;

const FILE = () => path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'hot-history.json');

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function loadHistory(): Hist {
  try {
    if (fs.existsSync(FILE())) {
      const raw = JSON.parse(fs.readFileSync(FILE(), 'utf8')) as Hist;
      if (raw && typeof raw === 'object') return raw;
    }
  } catch { /* 损坏则重新积累 */ }
  return {};
}

/** 记录今日快照（当日已有则原样返回）；返回最近N天 */
export function appendToday(counts: Record<string, number>, keepDays = 30): Hist {
  const today = todayStr();
  const h = loadHistory();
  if (!h[today]) {
    h[today] = counts;
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

/** S71 恢复备份时整份回写（保留30天裁剪）；损坏/缺字段由调用方过滤 */
export function writeHistory(h: Hist): void {
  try {
    const keys = Object.keys(h).sort().slice(-30);
    const trimmed: Hist = {};
    keys.forEach((k) => { if (h[k] && typeof h[k] === 'object') trimmed[k] = h[k]; });
    fs.mkdirSync(path.dirname(FILE()), { recursive: true });
    const tmp = `${FILE()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(trimmed), 'utf8');
    fs.renameSync(tmp, FILE());
  } catch { /* 尽力恢复，失败不阻断主恢复流程 */ }
}
