# 06 配置项总表（命名统一：camelCase + 中文注释 | 默认 | 范围 | 联动，S6并入tasks/S18并入settings）

> 落盘位置：`apps/web/config/*.ts`（类型即文档）。UI只读配置，不硬编码。
> 命名规则：`{模块}.{子项}.{属性}`，布尔一律 `enabled/visible/onlyUnread` 前缀，时间一律秒/天带单位后缀。

## 1. 全局 app.config.ts
| 配置项 | 默认 | 范围 | 联动 | 说明 |
|---|---|---|---|---|
| appName | 获客中台 | — | 页头/logo | 产品名 |
| imEnabled | false | bool | 为true才渲染会话页+IM接口 | 蓝V总开关，P0必须false |
| competitorImportEnabled | true | bool | 关闭则隐藏竞品区块 | 竞品手动导入开关 |
| defaultPageSize | 20 | 10/20/50 | 视频表/评论流共用 | 服务端分页默认条数 |
| timezone | Asia/Shanghai | IANA | 所有相对时间展示 | 时区 |
| dataDelayNote | 昨日数据・今晨6点更新 | 文案 | 看板/授权页同步显示 | T+1心智统一 |

## 2. 授权 auth.config.ts
| 配置项 | 默认 | 范围 | 联动 |
|---|---|---|---|
| qrcodeExpireSec=60 | 60 | 30–120 | pollTimeoutSec必须>expire |
| pollIntervalMs=1500 | 1500 | 1000–3000 | 过小会被限流 |
| pollTimeoutSec=90 | 90 | >expire | 超时显示“二维码过期” |
| tokenRefreshLeadDays=3 | 3 | 1–7 | Cron提前预刷新 |
| refreshLockTtlSec=5 | 5 | 3–10 | 防并发刷新覆盖 |
| maxAccountsPerTenant=5 | 5 | 1–10 | 超限提示解绑 |
| requiredScopes=[user_info,video.list,data] | — | 审核用 | 按自用客服申报 |
| authLogRetentionDays=90 | 90 | 30–180 | 日志页分页 |

## 3. 看板 stats.config.ts
| 配置项 | 默认 | 范围 | 联动 |
|---|---|---|---|
| overviewCacheTtlSec=3600 | 3600 | 600–7200 | 手动同步后清缓存 |
| dailySyncCron=0 6 * * * | 每天6点 | cron | 跑video.list→stat.daily |
| defaultDateRange=yesterday | yesterday/7d/30d | — | 筛选条默认昨天 |
| trendDaysOptions=[7,14,30] | [7,14,30] | 1–30 | 趋势抽屉下拉 |
| trendBatchMax=10 | 10 | 1–20 | ?ids批量上限，防N+1 |
| videoSortDefault=publishTime_desc | — | 发布时间/播放/点赞 | 表头排序 |
| manualSyncCooldownSec=60 | 60 | 30–300 | 防连点，按钮倒计时 |
| competitorSources=[feigua,xindou,manual] | — | 下拉 | 关闭import则隐藏 |

## 4. 评论 comments.config.ts
| 配置项 | 默认 | 范围 | 联动 |
|---|---|---|---|
| pageSize=20 | 20 | 10–50 | keyset cursor=create_time+id |
| onlyUnreadDefault=true | true | bool | 工具条开关默认态 |
| intentOptions=[高意向,咨询,留电话,垃圾,普通] | — | 不可删“垃圾” | 左侧2px竖条颜色映射 |
| intentColors={高意向:#9A6B2F,垃圾:#B42318,默认:#D8D5CF} | — | — | 02-ui-spec |
| hotKeywords=[求合作，怎么收费，留个电话，V我，地址，多少钱] | — | 可运营后台改 | 点即筛 |
| hotWindowDays=7 | 7 | 1–30 | 热词统计窗口 |
| batchReadMax=100 | 100 | 1–200 | 批量标已读上限 |
| commentPollSec=3600 | 3600 | 900–7200 | webhook之外的对账间隔 |
| autoIgnoreSpam=false | false | bool | 为true才自动忽略垃圾，P0默认人工 |

## 5. 私信辅助 assist.config.ts
| 配置项 | 默认 | 范围 | 联动 |
|---|---|---|---|
| scriptCategories=[欢迎语，报价，留资引导] | — | — | 话术库分组 |
| followStatuses=[待回访，已手动回复，已转化，无效] | — | — | 台账状态机 |
| defaultRemindHour=18 | 18 | 0–23 | “已去App回复”默认明天18点 |
| upgradeGuideUrl=/messages#upgrade | — | imEnabled=true后隐藏 | 蓝V指南锚点 |

## 6. 界面 ui.config.ts
| 配置项 | 默认 | 范围 | 联动 |
|---|---|---|---|
| densityDefault=comfy | comfy/compact | — | 行高44/36 |
| sidebarWidth=208 | 208 | 200–240 | 三栏左240/右320联动 |
| workLeftWidth=240 workRightWidth=320 | — | <1100px时右栏变抽屉 | 响应式断点 |
| animMs=150 | 120–180 | ease-out | 禁bounce |
| tableEmptyText=暂无数据 | 文案 | — | 空状态统一 |
| shortcuts={next:j,prev:k,read:e,intent1/2/3:1/2/3,copy:c} | — | 评论页生效 | 快捷键提示 |

## 7. 任务队列 tasks.config.ts（S6并入，只管同步类，不管自动骚扰）
| 配置项 | 默认 | 范围 | 联动 |
|---|---|---|---|
| taskQueueEnabled=true | true | bool | 关闭则隐藏各页任务倒计时/启停条 |
| maxConcurrentTasks=1 | 1 | 1–3 | 同步与对账互斥，防限流 |
| taskTypes=[statsSync,commentPoll,followRemind] | — | 仅同步类 | 优先级见下 |
| defaultPriority={statsSync:1,commentPoll:2,followRemind:3} | — | 数字越小越先跑 | 队列调度 |
| switchIntervalMin=5 | 5 | 3–30 | 对象轮询节流，看板倒计时展示 |
| groupFollowIntervalMin=5 | 5 | 3–30 | 手动跟进每批节奏，S4展示 |
| followBatchSize=2 | 2 | 1–5 | S4台账分批展示 |
| quietHoursEnabled=true | true | bool | 22-8点只跑statsSync |
| quietHours={start:22,end:8} | 22-8 | 0–23 | 静默窗口 |
| dailySyncCap=24 | 24 | 1–48 | 超限按钮置灰+倒计时 |
| maxRetries=3 | 3 | 0–5 | 仅RETRYABLE重试，指数退避 |
| riskFuseEnabled=true | true | bool | 触发后暂停commentPoll+通栏告警 |
| fuseFailThreshold=5 | 5 | 3–10 | 连续失败N次即停 |

## 8. 系统设置 settings.config.ts（S18新增）
| 配置项 | 默认 | 范围 | 联动 |
|---|---|---|---|
| fontSizeDefault=14 | 14 | 字号基准 | zoom=font/body同步14；globals body |
| fontSizeMin=12 / fontSizeMax=20 / fontSizeStep=1 | 12/20/1 | 10–14 / 16–24 | slider边界，越界PATCH→FATAL |
| fontZoomBase=14 | 14 | =fontSizeDefault | zoom换算分母 |
| themeDefault=#1A1A18 | 墨黑 | 必须在presets内 | --accent初值 |
| themePresets=墨黑/藏青/墨绿/赭石 | 4个 | 白名单 | 越界PATCH→FATAL |
| shopNameMinLen=2 / shopNameMaxLen=20 | 2/20 | 1–30 | 改主账号展示名 |
| serviceNameMaxLen=30 | 30 | 1–50 | 话术{product}默认值 |
| passwordMinLen=6 | 6 | ≥6 | 改密校验 |
