# 02 UI 设计规范（去AI味）

## 设计语言：线+面、文字优先、克制
参考：Linear密度、Vercel指标条、Raycast列表详情、抖音创作者中心数据表。

## 禁止清单
- 禁紫蓝渐变、大圆角彩色卡片、卡片堆叠
- 禁无意义装饰图标（数据区只许操作图标 Lucide 16px/1.5）
- 禁居中大标题+副标题，所有页头左对齐 `15px标题 + 12px灰描述 + 右侧主操作`

## Token
```
--bg:#FAFAF8 --surface:#FFF --border:#E8E6E1 --border-strong:#D8D5CF
--text-1:#1A1A18 --text-2:#6B6862 --text-3:#A8A5A0
--accent:#1A1A18 --accent-ink:#FFF --danger:#B42318 --warn-bg:#FBF3E4
圆角全局4px，阴影只用 0 1px 2px rgba(0,0,0,.04)，聚焦环2px黑
字体 Inter + Noto Sans SC，数字 Tabular-nums，标题15/20 semibold，正文13，辅助12
```

## 组件规范
- 指标：通栏 Metric Strip，4格纯文字大数字28px + 1px竖线分隔，无背景卡
- 意图：左侧2px竖条（赭石#9A6B2F=高/灰=普通/红=垃圾）+小字，不用药丸徽章墙
- 表格：行高44 comfy / 36 compact可切，标题12灰大写，悬停 #F5F4F1，未读用空心圆点
- 筛选条：单行sticky，搜索200px + 下拉 + 开关 + 右侧批量
- 三栏工作台：左240固定，中自适应，右320默认折叠为抽屉；快捷键 j/k/e/1/2/3/c
- 动效：只许120-180ms ease-out位移/透明度，禁scale bounce；加载用骨架屏
- 记忆点（只做一处）：数字等宽 + 评论按天sticky日期
