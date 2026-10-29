/**
 * 系统设置模块配置 | 默认 | 范围 | 联动
 * 字体用body zoom全局缩放（基准14px，见lib/settings-client.ts；生产建议迁rem）
 */
export const settingsConfig = {
  /** 基准字号(px) | 默认：16（S111：高密度小字被用户反馈“太小”，新用户默认整体放大≈14%）| 联动：zoom=fontSize/fontZoomBase */
  fontSizeDefault: 16,
  /** 字号下限 | 默认：14 | 保留“标准14”紧凑选项 */
  fontSizeMin: 14,
  /** 字号上限 | 默认：24 | 大字体友好 */
  fontSizeMax: 24,
  /** 字号步长 | 默认：1 */
  fontSizeStep: 1,
  /** zoom换算基准=globals body设计字号14（刻意与默认解耦：默认16→新用户全局zoom≈1.14） */
  fontZoomBase: 14,
  /** 默认主题色 | 必须在themePresets内 */
  themeDefault: '#1A1A18',
  /** 主题候选（服务端白名单，PATCH越界→FATAL） */
  themePresets: [
    { name: '墨黑', value: '#1A1A18' },
    { name: '藏青', value: '#23415E' },
    { name: '墨绿', value: '#1F4D3A' },
    { name: '赭石', value: '#7A4A21' },
  ] as { name: string; value: string }[],
  /** 店铺名称长度 | 默认2–20 | 联动：改的是当前主账号展示名 */
  shopNameMinLen: 2,
  shopNameMaxLen: 20,
  /** 服务名称长度上限 | 默认：30 | 联动：话术{product}默认值 */
  serviceNameMaxLen: 30,
  /** 新密码最小长度 | 默认：6 */
  passwordMinLen: 6,
  /** S133 周成交目标上限（元）| 默认：1000万 | 联动：0=不启用今日目标卡 */
  weeklyGoalMax: 10000000,
} as const;

export type SettingsConfig = typeof settingsConfig;
