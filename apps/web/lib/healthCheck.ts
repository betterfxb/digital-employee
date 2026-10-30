/**
 * S146 系统健康自检判定纯函数（零IO，入 crypto 单测）：
 * 输入=各端点读数打包（health/license），输出=逐项 ✓/⚠/✗ 体检单，每项带一句"怎么办"。
 * 客户报障时点一下把结果读给服务商，替代来回截图；阈值口径全在这里，可单测防漂移。
 */

export interface HealthInput {
  unreachable: boolean;
  writable: boolean;
  recovery: { from: string; at: string } | null;
  counts: Record<string, number>;
  backups: { count: number; latest: { name: string; mtime: string } | null };
  lastImportAt: string | null;
  lic: { valid: boolean; mode?: string; expires_at?: string | null } | null;
  now?: number;
}

export interface CheckRow { key: string; label: string; level: 'ok' | 'warn' | 'bad'; msg: string; fix: string }

const DAY = 86_400_000;

export function evaluateHealth(i: HealthInput): CheckRow[] {
  const now = i.now ?? Date.now();
  const out: CheckRow[] = [];
  out.push(i.unreachable
    ? { key: 'svc', label: '服务连通', level: 'bad', msg: '✗ 读不到本机服务', fix: '重启软件；仍不行把右下角版本号发给服务商' }
    : { key: 'svc', label: '服务连通', level: 'ok', msg: '✓ 本机服务应答正常', fix: '' });
  out.push(i.writable
    ? { key: 'disk', label: '数据盘写入', level: 'ok', msg: '✓ 可正常保存', fix: '' }
    : { key: 'disk', label: '数据盘写入', level: 'bad', msg: '✗ 数据目录写不进去', fix: '检查磁盘是否满了/软件是否被安全软件拦截；先把「下载备份」存好再处理' });
  out.push(i.recovery
    ? { key: 'heal', label: '数据自愈', level: 'warn', msg: `⚠ 本次启动曾从 ${i.recovery.from} 自动恢复`, fix: '建议立即点一次「立即备份一份」留证，并核对关键台账' }
    : { key: 'heal', label: '数据自愈', level: 'ok', msg: '✓ 数据文件健康', fix: '' });
  const bc = i.backups.count;
  out.push(bc >= 1
    ? { key: 'bcount', label: '备份存量', level: 'ok', msg: `✓ 本机已有 ${bc} 份快照`, fix: '' }
    : { key: 'bcount', label: '备份存量', level: 'warn', msg: '⚠ 还没有任何备份', fix: '点上面「立即备份一份」，此后每日自动兜底' });
  const bAge = i.backups.latest ? Math.floor((now - Date.parse(i.backups.latest.mtime)) / DAY) : null;
  out.push(bAge === null
    ? { key: 'bnew', label: '备份新鲜度', level: 'warn', msg: '⚠ 从未自动备份过', fix: '自动备份在每天凌晨3点后跑——保持软件开机常驻即可' }
    : bAge <= 2
      ? { key: 'bnew', label: '备份新鲜度', level: 'ok', msg: `✓ 最近备份 ${bAge === 0 ? '就是今天' : bAge + ' 天前'}`, fix: '' }
      : bAge <= 7
        ? { key: 'bnew', label: '备份新鲜度', level: 'warn', msg: `⚠ 最近备份在 ${bAge} 天前`, fix: '软件可能这几天没开机；点「立即备份一份」补一次' }
        : { key: 'bnew', label: '备份新鲜度', level: 'bad', msg: `✗ 备份已停滞 ${bAge} 天`, fix: '软件长期没运行或磁盘问题——立即手动备份并自检' });
  const dataN = (i.counts.videos ?? 0) + (i.counts.comments ?? 0) + (i.counts.follows ?? 0);
  out.push(dataN > 0
    ? { key: 'size', label: '数据规模', level: 'ok', msg: `✓ 作品 ${i.counts.videos ?? 0} · 评论 ${i.counts.comments ?? 0} · 线索 ${i.counts.follows ?? 0}`, fix: '' }
    : { key: 'size', label: '数据规模', level: 'warn', msg: '⚠ 还没导入过真实数据', fix: '按看板「首跑三步引导」导入作品/评论' });
  const iAge = i.lastImportAt ? Math.floor((now - Date.parse(i.lastImportAt)) / DAY) : null;
  out.push(iAge === null
    ? { key: 'imp', label: '导入节奏', level: 'warn', msg: '⚠ 从未导入过数据', fix: '去创作者中心导出最新表格，看板拖进来' }
    : iAge <= 3
      ? { key: 'imp', label: '导入节奏', level: 'ok', msg: `✓ ${iAge === 0 ? '今天刚导过' : `上次导入 ${iAge} 天前`}`, fix: '' }
      : iAge <= 7
        ? { key: 'imp', label: '导入节奏', level: 'warn', msg: `⚠ ${iAge} 天没导新数据`, fix: '评论台看到的是旧世界——每周导一次是底线节奏' }
        : { key: 'imp', label: '导入节奏', level: 'bad', msg: `✗ ${iAge} 天没导新数据`, fix: '系统正在吃灰——今天就导一批，价值从数据新鲜开始' });
  if (!i.lic) {
    out.push({ key: 'lic', label: '授权状态', level: 'warn', msg: '⚠ 读不到授权信息', fix: '去「授权管理」页看状态；异常发截图给服务商' });
  } else if (!i.lic.valid) {
    out.push({ key: 'lic', label: '授权状态', level: 'bad', msg: '✗ 授权未生效或已失效', fix: '联系服务商续期/重新导入授权文件' });
  } else if (i.lic.mode === 'demo') {
    out.push({ key: 'lic', label: '授权状态', level: 'ok', msg: '✓ 演示版运行中', fix: '' });
  } else if (!i.lic.expires_at) {
    out.push({ key: 'lic', label: '授权状态', level: 'ok', msg: '✓ 正式授权 · 不过期', fix: '' });
  } else {
    const d = Math.floor((new Date(`${i.lic.expires_at}T23:59:59`).getTime() - now) / DAY);
    out.push(d >= 30
      ? { key: 'lic', label: '授权状态', level: 'ok', msg: `✓ 剩余 ${d} 天`, fix: '' }
      : d >= 7
        ? { key: 'lic', label: '授权状态', level: 'warn', msg: `⚠ 剩余 ${d} 天`, fix: '提前找服务商续期，别等过期才想起' }
        : { key: 'lic', label: '授权状态', level: 'bad', msg: d >= 0 ? `✗ ${d} 天后到期` : '✗ 已过期', fix: '立即联系服务商续期，到期后功能受限' });
  }
  return out;
}

/** 体检总结：worst level 一句话 */
export function healthVerdict(rows: CheckRow[]): { level: 'ok' | 'warn' | 'bad'; text: string } {
  const bad = rows.filter((r) => r.level === 'bad');
  const warn = rows.filter((r) => r.level === 'warn');
  if (bad.length > 0) return { level: 'bad', text: `有 ${bad.length} 项需要马上处理` };
  if (warn.length > 0) return { level: 'warn', text: `整体正常，${warn.length} 项建议改进` };
  return { level: 'ok', text: '全部健康，保持这个节奏' };
}
