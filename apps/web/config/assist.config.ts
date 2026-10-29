/**
 * 私信辅助（占位）配置 | P0仅话术+台账，imEnabled=true后才接会话
 */
export const assistConfig = {
  /** 话术分组 */
  scriptCategories: ['欢迎语', '报价', '留资引导'] as string[],
  /** 跟进台账状态机 */
  followStatuses: ['待回访', '已手动回复', '已转化', '无效'] as string[],
  /** “已去App回复”默认提醒小时 | 默认：18 | 范围：0–23 */
  defaultRemindHour: 18,
  /** S129 老客复购回访阈值（天）| 默认：30 | 范围：7–180 | 已转化线索超此天数无接触即进回访提醒 */
  revisitDays: 30,
  /** 蓝V指南锚点 | 联动：imEnabled=true后隐藏占位 */
  upgradeGuideUrl: '/messages#upgrade' as string,
} as const;

export type AssistConfig = typeof assistConfig;
