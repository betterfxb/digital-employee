/**
 * 统一任务/节流/风控配置 | 默认 | 范围 | 联动
 * 作用域：只管同步类任务（STAT同步/评论对账/手动跟进提醒节奏）。
 * 红线：不含自动点赞/评论/收藏/艾特/私信执行开关，截图中对应能力我方拒绝照搬（见docs/07）。
 */
export const tasksConfig = {
  /** 任务队列总开关 | 默认：true | 联动：关闭则隐藏各页任务倒计时/启停条 */
  taskQueueEnabled: true as boolean,
  /** 最大并发任务数 | 默认：1 | 范围：1–3 | 联动：同步与对账互斥，防止限流 */
  maxConcurrentTasks: 1,
  /** 任务类型（仅同步类） */
  taskTypes: ['statsSync', 'commentPoll', 'followRemind'] as string[],
  /** 任务默认优先级（数字越小越先跑） */
  defaultPriority: { statsSync: 1, commentPoll: 2, followRemind: 3 } as Record<string, number>,
  /** 对象切换间隔(分) | 默认：5 | 范围：3–30 | 联动：视频/评论对象轮询节流，截图“笔记切换间隔”合规版 */
  switchIntervalMin: 5,
  /** 分组跟进间隔(分) | 默认：5 | 范围：3–30 | 联动：手动跟进每批提醒节奏，截图“每组艾特间隔”合规版（不自动@） */
  groupFollowIntervalMin: 5,
  /** 每批跟进提醒数 | 默认：2 | 范围：1–5 | 联动：S4台账批量提醒，截图“@每组2用户”合规版 */
  followBatchSize: 2,
  /** 夜间静默开关 | 默认：true | 联动：22-8点只跑statsSync，不跑commentPoll打扰展示 */
  quietHoursEnabled: true as boolean,
  /** 静默起止（小时） | 默认：22-8 | 范围：0–23 */
  quietHours: { start: 22, end: 8 } as { start: number; end: number },
  /** 每日同步上限(次) | 默认：24 | 范围：1–48 | 联动：超限按钮置灰+倒计时 */
  dailySyncCap: 24,
  /** 失败重试次数 | 默认：3 | 范围：0–5 | 联动：仅RETRYABLE错误重试，指数退避 */
  maxRetries: 3,
  /** 风控熔断开关 | 默认：true | 联动：触发后自动暂停commentPoll并通栏告警 */
  riskFuseEnabled: true as boolean,
  /** 熔断阈值：连续失败N次即停 | 默认：5 | 范围：3–10 */
  fuseFailThreshold: 5,
} as const;

export type TasksConfig = typeof tasksConfig;
