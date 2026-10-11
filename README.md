# 抖音获客中台（非蓝V版）

> 只看自己号（T+1）+ 管自己视频评论 + 私信人工辅助。禁爬虫/RPA自动私信。文档见 `docs/`，记忆见 `MEMORY.md`。

## 运行（apps/web，Next.js单体，mock数据）
```powershell
cd apps/web
pnpm install
pnpm dev      # http://localhost:3001/auth
pnpm test     # crypto真单测（tsc编译真模块）
pnpm verify   # 配置不变式+路由审计
pnpm smoke    # 需先起服务（dev或start），全链路冒烟
pnpm test:journey  # 需先起服务，用户旅程断言（跟进闭环/启停回读/切号隔离）
```

## 演示顺序（给客户）
1. `/auth` —— 扫码轮询→成功、刷新有效期、健康看板、账号列表切换、操作日志
2. `/dashboard` —— 指标条、任务队列条、作品表**趋势**（天数可选+迷你线）、竞品手动添加、手动同步冷却
3. `/comments` —— 三栏：左切视频、意图/关键词/未读筛、右改意图/忽略/登记跟进、导出CSV；键盘 `j/k/e/1/2/3/c`
4. `/tasks` —— 任务启停、新评论通知开关
5. `/messages` —— 话术库、跟进台账（分批/筛选/新增/状态流转/导出CSV）

## 结构
`apps/web/{app,components,config,lib,scripts}` + `prisma/schema.prisma`（目标态）+ `prototype/index.html`（早期静态原型，已被app替代，仅留档）。全自动化版本见 `docs/08-roadmap.md`（暂缓）。
