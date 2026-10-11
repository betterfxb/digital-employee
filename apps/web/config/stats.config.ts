/**
 * 看板/流量模块配置 | 默认 | 范围 | 联动
 */
export const statsConfig = {
  /** 概览缓存TTL(秒) | 默认：3600 | 范围：600–7200 | 联动：手动同步后清缓存 */
  overviewCacheTtlSec: 3600,
  /** 每日同步cron | 默认：每天6点 | 联动：跑video.list→stat.daily(T+1) */
  dailySyncCron: '0 6 * * *',
  /** 筛选条默认日期 | 默认：yesterday | 范围：yesterday/7d/30d */
  defaultDateRange: 'yesterday' as 'yesterday' | '7d' | '30d',
  /** 趋势天数选项 | 默认：[7,14,30] | 范围：1–30 | 联动：趋势抽屉下拉 */
  trendDaysOptions: [7, 14, 30] as number[],
  /** 趋势批量上限 | 默认：10 | 范围：1–20 | 联动：?ids=a,b,c，防N+1 */
  trendBatchMax: 10,
  /** 作品表默认排序 | 联动：表头排序 */
  videoSortDefault: 'publishTime_desc' as string,
  /** 手动同步冷却(秒) | 默认：60 | 范围：30–300 | 联动：按钮倒计时 */
  manualSyncCooldownSec: 60,
  /** 竞品来源下拉 | 联动：competitorImportEnabled关闭则隐藏 */
  competitorSources: ['feigua', 'xindou', 'manual'] as string[],
} as const;

export type StatsConfig = typeof statsConfig;
