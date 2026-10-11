/**
 * 评论模块配置 | 默认 | 范围 | 联动
 */
export const commentsConfig = {
  /** 分页条数 | 默认：20 | 范围：10–50 | 联动：keyset cursor=create_time+id */
  pageSize: 20,
  /** 只看未读默认态 | 默认：true | 联动：工具条开关 */
  onlyUnreadDefault: true as boolean,
  /** 意图选项（不可删除“垃圾”，颜色见下） */
  intentOptions: ['高意向', '咨询', '留电话', '垃圾', '普通'] as string[],
  /** 意图颜色映射（见02-ui-spec，左侧2px竖条） */
  intentColors: {
    '高意向': '#9A6B2F',
    '垃圾': '#B42318',
    '默认': '#D8D5CF',
  } as Record<string, string>,
  /** 热点关键词（点即筛，运营可改） */
  hotKeywords: ['多少钱', '怎么下单', '留个电话', '包赔吗', '什么段位', 'V我'] as string[],
  /** 热词统计窗口(天) | 默认：7 | 范围：1–30 */
  hotWindowDays: 7,
  /** 批量标已读上限 | 默认：100 | 范围：1–200 */
  batchReadMax: 100,
  /** 评论对账间隔(秒) | 默认：3600 | 范围：900–7200 | 联动：webhook之外的补漏 */
  commentPollSec: 3600,
  /** 是否自动忽略垃圾 | 默认：false | 联动：为true才自动忽略，P0默认人工 */
  autoIgnoreSpam: false as boolean,
} as const;

export type CommentsConfig = typeof commentsConfig;
