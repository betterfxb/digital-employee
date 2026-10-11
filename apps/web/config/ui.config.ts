/**
 * 界面全局配置（去AI味tokens，见docs/02-ui-spec.md）
 */
export const uiConfig = {
  /** 表格密度默认 | 默认：comfy | 范围：comfy(44px)/compact(36px) */
  densityDefault: 'comfy' as 'comfy' | 'compact',
  /** 侧栏宽(px) | 默认：208 | 范围：200–240 */
  sidebarWidth: 208,
  /** 工作台左/右宽(px) | 联动：<1100px时右栏变抽屉 */
  workLeftWidth: 240,
  workRightWidth: 320,
  /** 动效时长(ms) | 默认：150 | 范围：120–180 ease-out，禁bounce */
  animMs: 150,
  /** 空状态统一文案 */
  tableEmptyText: '暂无数据',
  /** 评论页快捷键（展示用，P0可仅提示） */
  shortcuts: { next: 'j', prev: 'k', read: 'e', intent1: '1', intent2: '2', intent3: '3', copy: 'c' } as Record<string, string>,
  /** 设计tokens（CSS变量同步，改此处需同步globals.css） */
  tokens: {
    bg: '#FAFAF8', surface: '#FFFFFF', border: '#E8E6E1', borderStrong: '#D8D5CF',
    text1: '#1A1A18', text2: '#6B6862', text3: '#A8A5A0',
    accent: '#1A1A18', accentInk: '#FFFFFF', danger: '#B42318', warnBg: '#FBF3E4',
    radius: 4,
  },
} as const;

export type UiConfig = typeof uiConfig;
