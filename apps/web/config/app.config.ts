/**
 * 全局应用配置 | 默认 | 范围 | 联动
 * 位置：apps/web/config/app.config.ts（类型即文档，UI禁硬编码）
 */
export const appConfig = {
  /** 产品名 | 默认：获客中台 | 联动：页头/logo/标题 */
  appName: '获客中台',
  /** 蓝V总开关 | 默认：false | 联动：为true才渲染会话页+IM接口，P0必须false */
  imEnabled: false as boolean,
  /** 竞品导入开关 | 默认：true | 联动：关闭则隐藏看板竞品区块 */
  competitorImportEnabled: true as boolean,
  /** 服务端分页默认条数 | 默认：20 | 范围：10/20/50 | 联动：视频表/评论流共用 */
  defaultPageSize: 20 as number,
  /** 时区 | 默认：Asia/Shanghai | 范围：IANA | 联动：所有相对时间展示 */
  timezone: 'Asia/Shanghai',
  /** T+1心智文案（全局统一） | 联动：看板/授权页同步显示 */
  dataDelayNote: '昨日数据・今晨6点更新',
} as const;

export type AppConfig = typeof appConfig;
