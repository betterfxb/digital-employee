/**
 * S80 自动备份轮转（仅服务端）：每日凌晨后把 local.json 快照到 data/backups/，保留最近14份
 * 动机：local.json 是单点文件，损坏/坏恢复=客户数据全灭；手动下载依赖人的自觉，调度器兜底
 * 命名：auto-YYYY-MM-DD.json（每日幂等一份）/ manual-YYYY-MM-DD-HHMMSS.json（手动触发）
 */
import fs from 'fs';
import path from 'path';

const KEEP = 14;
const NAME_RE = /^(auto-\d{4}-\d{2}-\d{2}|manual-\d{4}-\d{2}-\d{2}-\d{6})\.json$/;

const dataDir = () => process.env.DATA_DIR || path.join(process.cwd(), 'data');
const backupDir = () => path.join(dataDir(), 'backups');
const localFile = () => path.join(dataDir(), 'local.json');

const dstr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface BackupEntry { name: string; size: number; mtime: string; kind: 'auto' | 'manual' }

export function listBackups(): BackupEntry[] {
  const dir = backupDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => NAME_RE.test(n))
    .map((n) => {
      const st = fs.statSync(path.join(dir, n));
      return { name: n, size: st.size, mtime: st.mtime.toISOString(), kind: n.startsWith('auto') ? 'auto' as const : 'manual' as const };
    })
    .sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
}

/** 生成一份快照；auto 当日已存在则跳过（幂等）。返回 null=源数据还没出现过 */
export function runBackup(kind: 'auto' | 'manual'): BackupEntry | null {
  const src = localFile();
  if (!fs.existsSync(src)) return null;
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const now = new Date();
  const name = kind === 'auto'
    ? `auto-${dstr(now)}.json`
    : `manual-${dstr(now)}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}.json`;
  const dst = path.join(dir, name);
  // auto=当日幂等不覆盖；manual=即时快照语义，同秒再点也要刷到最新（J9抓出的bug：同秒existsSync静默跳过）
  if (kind === 'manual' || !fs.existsSync(dst)) fs.copyFileSync(src, dst);
  // 轮转：两类合计只留最近KEEP份
  const all = listBackups();
  for (const old of all.slice(KEEP)) {
    try { fs.unlinkSync(path.join(dir, old.name)); } catch { /* 被占用则下轮再清 */ }
  }
  return listBackups().find((b) => b.name === name) ?? null;
}

/** 调度器心跳入口：本地3点后且今日auto未落盘则补一份（跨天自动再触发） */
export function backupTick(): void {
  const h = new Date().getHours();
  if (h < 3) return;
  const today = `auto-${dstr(new Date())}.json`;
  if (listBackups().some((b) => b.name === today)) return;
  runBackup('auto');
}

/** 按名安全读文件（仅白名单命名），供下载端点 */
export function readBackup(name: string): { body: string } | { error: string } {
  if (!NAME_RE.test(name)) return { error: '非法备份名' };
  const p = path.join(backupDir(), name);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return { error: '备份不存在' };
  return { body: fs.readFileSync(p, 'utf8') };
}
