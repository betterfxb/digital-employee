# 01 整体架构方案

## 1.1 模块划分
```
apps/web (Next.js 单体先行)
├─ auth / dashboard / comments / messages
server (Next Route Handlers + Service层)
├─ AuthService / SyncService / CommentService / Script+FollowService
└─ DouyinGateway：DouyinClient + AuthStore + WebhookVerifier + RateLimiter
infra：Postgres + Prisma / Redis + BullMQ / Cron + Webhook入口
```

IM预留：`feature_flag=im_enabled=false`，表结构留空壳，蓝V后接 `EnterpriseDouyinAdapter`。

## 1.2 层次关系
```
UI(Page/Component) → API Route(鉴权/校验/分页) → Service(去重/已读/意图) → Gateway/Repo(外部API+DB)
```
- 页面禁直调抖音，一律走Gateway
- Service只依赖 `IDouyinPort` 接口，便于mock和换蓝V实现

## 1.3 数据流
1. **授权**：取state+qrcode → 轮询poll → 换token(AES-GCM加密) → 写Account+AuthLog
2. **流量**：Cron每日拉 `video.list → stat.daily(T+1)` 入库，前端只读DB
3. **评论**：webhook增量 `INSERT ON CONFLICT DO NOTHING` + 每小时按min_id补漏，关键词初筛→人工标
4. **私信**：P0无同步流，话术复制→App手动发→回系统点已跟进

## 1.4 关键设计点
- 评论唯一键 `comment_id`，写入幂等，带 `source/synced_at`
- Token刷新用 Redis 分布式锁 `lock:refresh:{account_id}`，Cron提前3天预刷新
- 错误分级：RETRYABLE(限流/超时退避3次) / FATAL( scope不足直接告警) / AUTH_EXPIRED(触发重扫)，统一带 `trace_id`
- 性能：趋势走 `?ids=a,b,c` 批量接口；评论用 keyset `cursor=create_time+id`，不用offset；overview缓存1h
- 安全：信封加密（主密钥+数据密钥+版本），电话脱敏，webhook secret双key轮换
