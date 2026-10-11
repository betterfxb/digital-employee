# 05 评审改进清单（架构+UI）

## 架构 P0
- A1 端口隔离：Service依赖IDouyinPort，蓝V加Adapter，收益：零改业务
- A2 幂等对账：comment_id唯一+source/synced_at+DLQ，收益：不丢不重
- A3 刷新锁：Redis锁+预刷新，收益：消灭掉线误报
- A4 数据层：React Query staleTime + 趋势批量接口，收益：请求-60%
- A5 熔断：令牌桶+30s熔断+trace，收益：限流不雪崩

## 架构 P1/P2
- A6 索引/keyset/缓存overview 1h，万级<200ms
- A7 信封加密+脱敏+secret双key轮换

## UI P0
- U1 去卡片化：Metric Strip+2px意图竖条，密度+40%
- U2 语义Token锁死（见02）
- U3 文字优先：禁装饰icon，页头左对齐
- U4 表格筛选单行sticky，未读圆点

## UI P1/P2
- U5 折叠右栏+快捷键j/k/e/1/2/3/c
- U6 120-180ms ease-out+骨架屏
- U7 只做一处记忆点：等宽数字+按天sticky

## 总改造排序 Top10
1 A1+A3 → 2 U1+U2 → 3 A2+A4 → 4 U3+U4 → 5 A5 → 6 U5 → 7 A6 → 8 U6 → 9 A7 → 10 U7
