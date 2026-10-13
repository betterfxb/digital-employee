/**
 * 自动同步调度配置 | 默认 | 范围 | 联动
 * 与 tasksConfig 分离：tasksConfig 管"手动同步冷却/风控"，本文件管"定时调度器"。
 * 红线：只调度同步类（statsSync），不含自动点赞/评论/私信执行。
 */
export const syncConfig = {
  /** 自动调度总开关 | 默认：true | 联动：关闭则不挂定时器，只留手动同步 */
  autoSyncEnabled: true as boolean,
  /** 调度检查间隔(毫秒) | 默认：60000 | 范围：10000–300000 | 联动：tick精度，非同步频率 */
  tickIntervalMs: 60_000,
  /** 自动同步最小间隔(分) | 默认：30 | 范围：5–1440 | 联动：两次同步之间至少隔这么久，避免打满限额 */
  minIntervalMin: 30,
  /** 夜间静默自动同步 | 默认：true | 联动：22-8点不自动跑，与tasksConfig.quietHours一致 */
  respectQuietHours: true as boolean,
} as const;

export type SyncConfig = typeof syncConfig;
