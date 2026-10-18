/**
 * S75 自动化统一配置（纯函数，client/server 双端安全，无 node 依赖）
 * 存于 settings.auto_config（原始对象）；所有读取一律过 mergeAutoCfg：
 * 缺字段补默认、坏值钳制到合法域、间隔倒挂自动修正——旧文件/手改脏数据免疫
 */
export interface AutoConfig {
  /** 定时同步总开关（与config级autoSyncEnabled双闸：任一关=不自动） */
  sync_enabled: boolean;
  sync_interval_min: number;
  sync_daily_cap: number;
  quiet_enabled: boolean;
  quiet_start: number;
  quiet_end: number;
  /** 自动回复拟人节奏 */
  reply_gap_min_sec: number;
  reply_gap_max_sec: number;
  reply_daily_cap: number;
  reply_tone: string;
  /** 日报提醒时点（0-23） */
  report_hour: number;
  /** 看板自动刷新秒数（0=关） */
  dashboard_refresh_sec: number;
}

export const AUTO_DEFAULTS: AutoConfig = {
  sync_enabled: true, sync_interval_min: 30, sync_daily_cap: 24,
  quiet_enabled: true, quiet_start: 22, quiet_end: 8,
  reply_gap_min_sec: 60, reply_gap_max_sec: 240, reply_daily_cap: 12, reply_tone: '亲切',
  report_hour: 9, dashboard_refresh_sec: 60,
};

export const REPLY_TONES = ['亲切', '专业', '简洁'];

const num = (v: unknown, d: number, lo: number, hi: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.floor(n))) : d;
};

export function mergeAutoCfg(raw?: Partial<AutoConfig> | null): AutoConfig {
  const d = AUTO_DEFAULTS;
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: AutoConfig = {
    sync_enabled: typeof r.sync_enabled === 'boolean' ? r.sync_enabled : d.sync_enabled,
    sync_interval_min: num(r.sync_interval_min, d.sync_interval_min, 5, 240),
    sync_daily_cap: num(r.sync_daily_cap, d.sync_daily_cap, 1, 48),
    quiet_enabled: typeof r.quiet_enabled === 'boolean' ? r.quiet_enabled : d.quiet_enabled,
    quiet_start: num(r.quiet_start, d.quiet_start, 0, 23),
    quiet_end: num(r.quiet_end, d.quiet_end, 0, 23),
    reply_gap_min_sec: num(r.reply_gap_min_sec, d.reply_gap_min_sec, 10, 3600),
    reply_gap_max_sec: num(r.reply_gap_max_sec, d.reply_gap_max_sec, 30, 7200),
    reply_daily_cap: num(r.reply_daily_cap, d.reply_daily_cap, 1, 50),
    reply_tone: REPLY_TONES.includes(String(r.reply_tone)) ? String(r.reply_tone) : d.reply_tone,
    report_hour: num(r.report_hour, d.report_hour, 0, 23),
    dashboard_refresh_sec: num(r.dashboard_refresh_sec, d.dashboard_refresh_sec, 0, 600),
  };
  if (out.reply_gap_min_sec > out.reply_gap_max_sec) out.reply_gap_min_sec = out.reply_gap_max_sec;
  return out;
}

/** 从settings快照取规范化配置（双端通用入口） */
export function autoCfgOf(settings: { auto_config?: unknown } | null | undefined): AutoConfig {
  return mergeAutoCfg((settings?.auto_config || {}) as Partial<AutoConfig>);
}
