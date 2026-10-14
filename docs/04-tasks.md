# 04 分阶段任务拆解

| 阶段 | 任务 | 依赖 | 优先级 | 验收标准 |
|---|---|---|---|---|
| S0 契约 | API+表+UI文案冻结 | 无 | P0 | 本目录4份文档评审通过 |
| S1 骨架+授权 | 工程初始化、主题tokens、空/加载/过期态、扫码轮询 | S0 | P0 | 扫码→看板闭环，token加密，掉线通栏 |
| S2 看板 | 作品表+指标条+趋势抽屉+竞品导入+手动同步 | S1 | P0 | 20条分页排序正确，刷新文案正确 |
| S3 评论 | 三栏+筛选+批量已读+意图+热词+复制话术 | S1 | P0 | 500条不卡，对账无丢，已读仅本地 |
| S4 私信占位 | 置灰说明+话术库+台账CRUD+蓝V指南 | S1 | P0 | 无假会话，flag预留 |
| S5 打磨 | 日志、E2E冒烟、compose一键起、部署文档 | S2-S4 | P1 | 冒烟全绿 |
| S6 截图参考落地 | 任务倒计时条接S2展示+跟进分批接S4展示+tasks并入06总表 | S5 | P1 | 纯展示、无自动执行，构建+冒烟绿 |
| S7 缺口补齐 | 趋势/已读PATCH/刷新/webhook桩/台账读写API+UI接通+配置校验+冒烟扩展 | S6 | P1 | verify+smoke全绿 |
| S8 评论三栏补齐 | 左作品未读角标+中流+右详情（意图PATCH/跟进登记）+快捷键j/k/e/1/2/3/c | S7 | P0 | 补足S3三栏验收 |
| S9 持久化抽象 | Repository接口+内存实现+prisma目标态，有态路由全切，DATA_BACKEND预留 | S8 | P1 | 行为不变，verify+smoke全绿 |
| S10 全链路实测修复 | 真机走完全链：修私信页对象渲染崩溃/话术静态源/+342丢失/抽屉压顶栏 | S9 | P0 | e2e复验+smoke30绿+0控制台错 |
| S11 体验补齐 | 授权刷新+日志表/同步后重载/趋势迷你线/忽略开关/新增跟进+crypto单测 | S10 | P1 | test+verify+smoke全绿 |
| S12 合规追平 | 任务中心/多账号隔离/健康看板/意图文案模板/未读角标通知；08暂缓全自动 | S11 | P0 | e2e复验+全绿（含修静态预渲染快照Bug） |
| S13 体验收尾 | 趋势天数可选/评论+台账CSV导出/跟进状态流转/根README更新 | S12 | P1 | test+verify+smoke全绿 |
| S14 还债 | M1密钥接线/M2可见反馈/m1m2m3/类型抽取/journey进仓 | S13 | P0 | test+verify+smoke+journey全绿 |
| S15 版式铺开 | 全页1680流式+看板6指标/双栏总览/点赞率/行内走势+三栏加宽拉高+任务授权私信双栏 | S14 | P1 | e2e截图验收+全绿 |
| S16 客户数据替换 | 萌络网络（三角洲跑刀+无畏契约）：账号/作品/评论/话术/模板/竞品/跟进全量换皮，id不断言不动 | S15 | P0 | 源码零残留+全绿+截图验收 |
| S17 契约视角加厚 | acc_002加3作品+6评论，产品默认值随号切换，断言同步更新 | S16 | P0 | 双视角截图0错+全绿 |
| S18 系统设置 | 改密/店名/服务名/字号全局zoom/主题CSS变量，保存持久化即时生效 | S17 | P0 | e2e(调节/保存/重载/改密)+全绿 |
| S19 设置页改版 | 刻度滑杆（重点标记+大读数）+主题预览卡片（微缩UI+说明+选中态） | S18 | P1 | 截图验收+全绿 |
| S20 截图功能合规落地 | 视频任务队列/采集四槽/手动清单/休眠规则/自定义话术/评论回评；C封存docs/10 | 客户截图 | P0 | A+B交付e2e 0错，C不编码 |
| S22 买断制授权方案 | 校验/绑定/检测/边界/对比+落地路线，见docs/11 | 授权规划 | P1 | 框架落盘，不含代码 |
| S23 预真机A+B | IDouyinPort占位/回调换token/token加密落盘/绑定切号 + CSV真实数据导入（作品/评论upsert+意图分类） | 真机测试前置 | P0 | mock全流程e2e绿，live等密钥即切 |
| S24 蓝V升级路径 | 解锁清单B1-B5/开关位置/申请顺序/边界，见docs/12 | 客户蓝V规划 | P1 | 框架落盘，不含代码，触发后再立项 |
| S25 授权落地一期 | license文件格式+Ed25519验签(lib/license)+溯源水印(构建期头+meta)+/api/license/status+授权状态卡+发证工具license-gen.js，见docs/11§7 | S24 | P0 | demo宽松红线已验（无license不锁功能）；含docs/03契约补齐 |
| S25b 全流程测试整改 | 全页面UI巡检+业务链路实测；修2缺陷：①评论页标已读后选中静默漂移致回评/跟进记错条（操作刷新保持选中+详情缓存）②台账/回评/竞品/队列/设置/话术/规则重启丢失（S25b集合持久化data/local.json+按id去重） | S25 | P0 | test11+verify61+冒烟70+journey5全绿；持久化跨重启验证通过 |
| S26 live拉取预写 | 开放平台作品/评论拉取（fetchVideoList/fetchCommentList+纯映射douyinMappers）+live同步编排liveSync+sync路由live分支+共享upsert层importData+open_id落盘；密钥一到DOUYIN_MODE=live即通自动同步 | S25b | P0 | port9+test11+verify61+冒烟70+journey5全绿；mock行为不变；端点标注联调复核 |
| S21 GitHub同步 | 本地commit+私有仓digital-employee，SSH推送 | 上线 | P1 | 已推送，远端main同步 |
| S14 代码质量评审 | 全仓评审+报告docs/09（5 Major+7 Minor+行动项） | S13 | P1 | 报告落盘 |

| S27 组件库改造 | 全面换antd6：6页+侧栏75处原始input/select/button/table→Input/Select/Button/Table/Checkbox/Switch/Slider/Drawer/message(App.useApp)；AntdRegistry SSR + AntdProvider主题token保留羊皮纸风+zhCN；隐藏file input与主题预览卡有意保留 | S26 | P1 | 五套门禁全绿+六页浏览器验收console 0错；First Load JS增至~320KB可接受 |
| S28 自动化一期 | 话术引擎强化（模板库9→20条+三段式组合generateReply+关注点场景匹配）+定时调度框架（进程内scheduler：最小间隔/夜间静默/每日上限/熔断+resume解熔断+任务页调度状态卡）；不等资质先落地，live密钥到位自动接真数据 | S27 | P0 | 五套门禁全绿+评论页生成2候选实测+调度卡运行中console 0错 |
| S29 假数据清理 | 客户报两bug一并修：①删overview硬编码假指标（fans_new/fans_total/mom_play/mom_like）只留真聚合；②删trend伪随机假线全返回空；③看板删"净增粉"指标；④"近7天播放总览"改诚实空态（修永久loading）；⑤趋势抽屉删天数选择器（无序列切换无意义）；⑥auth页删"违规提醒"硬编码。原则：接口没有的数据一律不展示 | S28 | P0 | 五套门禁全绿+看板/auth浏览器验收console 0错；净增粉/违规提醒已删、图表与抽屉空态正确 |
- S1阻塞S2/S3/S4，S2/S3可并行
- 当前状态（2026-10-14）：S1✅ S2✅ S3✅ S4✅ S5✅ S6✅ S7✅ S8✅ S9✅ S10✅ S11✅ S12✅ S13✅ S14✅ S15✅ S16✅ S17✅ S18✅ S19✅ S20✅ S21✅ S22✅ S23✅ S24✅ S25✅ S25b✅ S26✅ S27✅ S28✅ S29✅（mock态，test11+verify61+冒烟70+journey5+port9全绿；已推送github私有仓betterfxb/digital-employee）
