/**
 * 授权模块配置 | 默认 | 范围 | 联动
 */
export const authConfig = {
  /** 二维码有效期(秒) | 默认：60 | 范围：30–120 | 联动：pollTimeoutSec必须大于此值 */
  qrcodeExpireSec: 60,
  /** 轮询间隔(ms) | 默认：1500 | 范围：1000–3000 | 联动：过小会被限流 */
  pollIntervalMs: 1500,
  /** 轮询总超时(秒) | 默认：90 | 范围：必须>qrcodeExpireSec | 联动：超时显示“二维码过期” */
  pollTimeoutSec: 90,
  /** token提前预刷新(天) | 默认：3 | 范围：1–7 | 联动：Cron任务 */
  tokenRefreshLeadDays: 3,
  /** 刷新分布式锁TTL(秒) | 默认：5 | 范围：3–10 | 联动：防并发覆盖refresh_token */
  refreshLockTtlSec: 5,
  /** 单租户最大绑定账号数 | 默认：5 | 范围：1–10 | 联动：超限提示解绑 */
  maxAccountsPerTenant: 5,
  /** 必选scope（按自用客服申报，改动需重审） */
  requiredScopes: ['user_info', 'video.list', 'data'] as string[],
  /** 授权日志保留(天) | 默认：90 | 范围：30–180 | 联动：日志页分页 */
  authLogRetentionDays: 90,
} as const;

export type AuthConfig = typeof authConfig;
