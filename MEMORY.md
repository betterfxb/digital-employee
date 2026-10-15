# 项目记忆（给后续开发/Agent看，勿删）

更新：2026-10-15 / 路径：D:\_project / 状态：S1-S30完成（S23预真机A+B：DOUYIN_MODE=mock占位密钥全流程跑通，live等企业资质密钥即切；CSV真实数据导入落data/local.json重启不丢。S23b：overview按当前账号实时聚合+趋势对imp_不画假线+J5真数据闭环旅程。S24蓝V升级路径docs/12。S25授权落地一期：lib/license.ts Ed25519验签+license-gen.js发证（私钥data/license_key.pem不进仓）+溯源水印构建期注入+auth页授权状态卡；demo无license宽松不锁功能已验。S25b全流程测试整改：修回评目标漂移（评论页操作刷新保持选中）+业务集合持久化（台账/回评等重启不丢，按id去重水合）。S26 live拉取预写：fetchVideoList/fetchCommentList+douyinMappers纯映射（port9单测）+liveSync编排+open_id落盘，密钥一到DOUYIN_MODE=live即通；端点/字段标注联调复核）。S27组件库改造：6页+侧栏75处原始控件换antd6（Input/Select/Button/Table/Checkbox/Switch/Slider/Drawer/message），AntdRegistry SSR+AntdProvider主题token保留羊皮纸风，隐藏file input与主题预览卡有意保留；First Load JS~320KB可接受）。S28自动化一期：话术三段式generateReply（破冰+按关注点选核心场景+行动引导，2候选人工确认）+定时调度scheduler（进程内单例，最小间隔30min/夜间静默/每日上限/熔断，resume解熔断，任务页状态卡）；live密钥到位自动接真数据。S29假数据清理：删overview硬编码fans_new/fans_total/mom_*只留真聚合+删trend伪随机假线全返回空+看板删净增粉+近7天总览改诚实空态（修永久loading）+趋势抽屉删天数选择器+auth删违规提醒硬编码；原则接口没有的数据一律不展示，live同步接入后趋势自然点亮。S30桌面端+机器绑定授权：apps/desktop Electron壳（standalone内嵌+127.0.0.1+首启随机主密钥+数据落%APPDATA%）；machineId三因子（CPU/磁盘/网卡MAC）命中≥2认，license机绑验签+POST /api/license/import+激活门UI（demo锁核心功能）；发证=客户报机器码→license-gen issue --bind→导入激活（docs/13）；安装包约80MB。S30坑：pnpm symlink在Windows standalone拷贝EPERM（.npmrc node-linker=hoisted解决）；electron-builder files滤node_modules（standalone须走extraResources）；Electron内置net阴影Node net（用http模块选端口探活）；打包态spawn必须ELECTRON_RUN_AS_NODE=1；electron/构建二进制走npmmirror镜像。质检：test19+verify62+冒烟71+journey5+port9全绿。真机前置：企业营业执照入驻开放平台（个人主体只能建小玩法）+客户端密钥+联调HTTPS。已推送github私有仓betterfxb/digital-employee。运维铁律：停服务确认端口FREE再起，构建后核产物再验UI；工具回执与落盘可能脱钩，关键写后必读验。注意：device-flow client_id在本环境404，GitHub操作走本机SSH（betterfxb）。

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
S0文档✅（docs/00-07）→ S1✅骨架+授权（apps/web/app/auth+API+AES-GCM）→ S2✅看板（含TaskBar+趋势抽屉+竞品导入） → S3✅评论三栏（作品角标+流+详情，快捷键，意图PATCH/跟进登记） → S4✅私信占位（话术/台账走API+分批展示） → S5✅（build✅ smoke✅ compose+Dockerfile就绪）→ S6✅（tasks.config+06总表合并）→ S7✅（refresh/webhook桩/verify-config）→ S8✅（三栏补足S3验收）→ S9✅（lib/repo.ts抽象，有态路由全切，prisma/schema.prisma目标态，DATA_BACKEND预留）→ S10✅（e2e修私信崩溃/话术源/+342/抽屉遮挡）→ S11✅（授权刷新+日志/同步重载/迷你线/忽略/新增跟进/crypto单测）→ S12✅（路由审计+force-dynamic铁律）→ S13-S14✅（骨架补足+全仓评审docs/09）→ S15-S19✅（契约双视角/账号数据/UI改版/设置页/滑杆主题卡）→ S20✅（客户截图A+B合规落地，C封存docs/10）→ S21✅（GitHub私有仓SSH同步）→ S22✅（买断制授权方案docs/11，只规划）→ S23✅（预真机A+B：占位密钥授权全流程+token落盘+CSV真实数据导入data/local.json）→ S23b✅（overview实时聚合+趋势诚实化+J5旅程）→ S24✅（蓝V升级路径docs/12，只规划）→ S25✅（授权落地一期：license验签+发证+水印+状态卡，docs/11§7第一项）→ S25b✅（全流程测试：修回评漂移+业务集合持久化）→ S26✅（live拉取预写：作品/评论API+映射单测+同步编排，密钥即通）。下一步：T5真数据演练（等用户CSV）、接真实开放平台授权（等企业资质→DOUYIN_MODE=live联调复核端点）、S25二期（激活向导/自助解绑，docs/11§7）、PG+migrate（等docker环境）、服务端限流+webhook真验签（生产门禁M4）、周期同步调度（Redis队列时做）。

## 6. 风险红线
scope申请按自用客服写；token提前3天预刷新；webhook验签+DLQ；电话脱敏；合同写明不支持个人号自动私信。
