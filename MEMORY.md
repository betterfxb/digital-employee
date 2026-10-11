# 项目记忆（给后续开发/Agent看，勿删）

更新：2026-10-09 / 路径：D:\_project / 状态：S1-S22完成（S22买断制授权方案docs/11框架落盘，不含代码）。已推送github私有仓betterfxb/digital-employee。运维铁律：停服务确认端口FREE再起，构建后核产物再验UI；工具回执与落盘可能脱钩，关键写后必读验。注意：device-flow client_id在本环境404，GitHub操作走本机SSH（betterfxb）。

## 1. 一句话
非蓝V抖音中台：流量T+1看自己号 + 评论管自己视频 + 私信只辅助。禁爬虫/RPA自动私信。

## 2. 已确认约束（后续不要再问）
- 无企业号 → 无IM权限（enterprise.im只给蓝V），私信页必须置灰占位+话术库+手动台账
- 流量只能看已授权自己号，T+1，UI写死 `昨日数据・今晨6点更新`
- 已读/意图全是本地字段，不反写抖音
- 竞品只手动导入（飞瓜/新抖/手动），不自爬
- 单体Next先行，不拆Nest；PG+Prisma+Redis+BullMQ；pnpm+Compose

## 3. 设计语言（去AI味）
Token见 docs/02-ui-spec.md。禁紫蓝渐变/大圆角彩卡/装饰icon/居中大标题。
指标用Metric Strip，意图用左侧2px竖条，表格44/36双密度，动效120-180ms，加载骨架屏。

## 4. 契约冻结
接口/表见 docs/03-api-contract.md。分页 `{items,next_cursor,has_more}`，错误带trace_id，评论keyset，comment_id幂等。**铁律：读内存态的GET必须 `force-dynamic`（S12：无参GET会被构建期静态快照，verify-config含路由审计）。**

## 5. 任务状态
S0文档✅（docs/00-07）→ S1✅骨架+授权（apps/web/app/auth+API+AES-GCM）→ S2✅看板（含TaskBar+趋势抽屉+竞品导入） → S3✅评论三栏（作品角标+流+详情，快捷键，意图PATCH/跟进登记） → S4✅私信占位（话术/台账走API+分批展示） → S5✅（build✅ smoke✅ compose+Dockerfile就绪）→ S6✅（tasks.config+06总表合并）→ S7✅（refresh/webhook桩/verify-config）→ S8✅（三栏补足S3验收）→ S9✅（lib/repo.ts抽象，有态路由全切，prisma/schema.prisma目标态，DATA_BACKEND预留）→ S10✅（e2e修私信崩溃/话术源/+342/抽屉遮挡）→ S11✅（授权刷新+日志/同步重载/迷你线/忽略/新增跟进/crypto单测）。下一步：接真实开放平台授权、PG+migrate、Redis队列、webhook真验签。

## 6. 风险红线
scope申请按自用客服写；token提前3天预刷新；webhook验签+DLQ；电话脱敏；合同写明不支持个人号自动私信。
