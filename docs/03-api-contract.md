# 03 接口/数据模型契约（P0冻结）

## 通用规范
- 分页：`{items, next_cursor, has_more}`，评论 `cursor=create_time+id` keyset，count默认20
- 错误：`{code, message, trace_id}`，code分 `RETRYABLE/FATAL/AUTH_EXPIRED`

## Auth
```
GET /api/auth/douyin/qrcode -> {qrcode_url, qr_data_url(dataURL图片), state, expire_in:60, mode:mock|live} // S31真二维码；mode见docs/10（S23）
GET /api/auth/douyin/mock-consent?state -> 200演示确认页(mock) / 404(live) / 410(state过期) // S31弹窗流，无密码输入不仿官方UI
GET /api/auth/douyin/authorize?nick=&popup=1 -> 302 mock确认页|live官方授权页 // S31弹窗授权
GET /api/auth/poll?state&t -> {status:pending/success}（t为演示轮询计数器，生产换真授权码）
GET /api/accounts/me -> Account{id, open_id_mask, nickname, avatar, auth_type:personal, expires_at}
POST /api/auth/refresh -> {expires_at} // live模式走refresh_token（S23）
GET /api/auth/logs -> AuthLog[{at,op,by,result}] // 初始3条+绑定/导入实时追加，保留90天（S23起动态）
GET /api/auth/douyin/authorize?nick -> 302→callback?state=...（S23：mock占位密钥本地闭环，live跳抖音官方授权页）
GET /api/auth/douyin/callback?state&code -> 302 /auth?bind=ok|err（open_id按昵称哈希幂等，绑定后自动切为当前账号）
```

## Stats / Videos
```
GET /api/videos?account_id&start&end&page,sort,order -> Video[]
GET /api/stats/overview?account_id&date[&all=1] -> {play,like,comment,note}（S29删无据硬编码指标只留真聚合；S63 ?all=1 →全部账号汇总+share+accounts明细行）
GET /api/stats/trend?ids=a,b,c&days=7 -> {[id]:[{date,play,like}]}（键为请求传入id；imp_导入作品返回[]不画假线，S23b）
POST /api/stats/sync -> {task_id, live_sync?} // S26: live模式入队后实际拉开放平台作品+评论（mock纯入队不变）；live_sync={mode,videos,comments,pages,error?}
GET/POST /api/competitors -> {url,source,play,like,remark} // 手动导入区
POST /api/import {kind:videos|comments, csv} -> {created,updated,skipped?} | {code:FATAL}（S23：按账号+标题/昵称upsert，imp_前缀，首行表头，≤200行；S79容错：csv字段为解码后文本——客户端file.arrayBuffer→UTF-8严格失败转GBK嗅探，服务端TSV自动识别、列名别名表（lib/csvParse同表前后端共用）、2026-10-18/2026年10月8日等绝对日期归一MM-DD、千分位/百分号剥离，缺列报错回显用户实际表头）
```

## Comments / Follows
```
GET /api/comments?video_id&intent&keyword&unread_only&cursor,count=20
POST /api/comments/read {ids[] | all_video_id}
PATCH /api/comments/:id {intent:高意向/咨询/留电话/普通/垃圾, ignore:bool} // S68起落盘，重启不丢
GET /api/comments/keywords/hot?days=7 -> {items:[{kw,count}], history:{date:{kw:n}}}（S51附每日快照30天）
GET /api/comments/:id/replies -> {items} / POST /api/comments/:id/replies {content} // 回评记录（S19，S25补进契约）
POST /api/follows {peer_nick, source_video_id, next_remind_at?, status?} // S66活跃管线同昵称幂等返回{...follow,deduped:true}
GET /api/follows?status&tag&tags=1 // S48 tag筛选；tags=1返回标签库[{tag,n}]（频次排序）
PATCH /api/follows/:id {status?, amount?, tags?, note?, next_remind_at?} // 至少一项；金额0-10亿、标签≤10个≤8字、纪要≤500字、提醒≤40字；变更入history（S43/48/49/65）
```

## Assist（私信占位）
```
GET /api/scripts?type=私信 -> [{title,content}]
GET/POST /api/follows {peer_nick, source_video_id, next_remind_at}
feature_flag: im_enabled=false，全局预留
```

## Webhook
```
POST /api/webhooks/douyin // 验签+幂等，只处理评论，失败进DLQ
  - 缺 x-signature → 401 FATAL；重复 event_id → {deduped:true}；非法JSON → 400 RETRYABLE并进DLQ
GET /api/webhooks/dlq -> {items} // 死信查看（S7新增）
```

## 账号/任务/模板（S12新增）
```
GET /api/accounts -> {items[{id,nickname,expires_at,days_left,active}], active_id}
POST /api/accounts/switch {id} // 未知id→FATAL；数据按账号隔离展示
GET /api/tasks -> {items[{no,type,label,paused,lastRun,nextInMin,priority}]} // 仅同步类
POST /api/tasks/control {type, action:pause|resume} // 非法type→FATAL
GET /api/scripts/templates?intent&nick&product -> {items} // 变量填充；垃圾意图返回处理建议
GET /api/stats/usage -> {usedToday,cap,left} // 频控余量
```

## License（S25新增）
```
GET /api/license/status -> {mode:demo|licensed, valid, customer, expires_at, features[], seats, machine_slots, watermark, machine_code, machine_ok, error, app_version}
// S30起demo=UI激活门锁核心功能（API按策略开放）；验签Ed25519+机器绑定命中≥2因子
// S39 app_version=桌面端版本透出；S54 features白名单分版（[]=专业版全开；basic七页面白名单，UI五处锁）
// 溯源水印：响应头 X-Vendor-Watermark；发证：license-gen issue --tier pro|basic --bind 机器码（私钥不进仓）
```

## 表结构要点
- Account(open_id唯一, token_enc, key_version, expires_at)
- Video(aweme_id唯一, account_id, title, cover, create_time)
- VideoStatDaily(video_id,date唯一, play,like,comment,share,fans_total)
- Comment(comment_id唯一, video_id, content, user_nick, is_read_local, intent, keywords[])
- Follow(peer_nick, source_video_id, next_remind_at, status, amount?, created_at?, tags?[], note?, history?[])
- LocalState版本增量（local.json）：cleared_at(S37) / read_ids+all_read_videos+intent_overrides(S68协作态持久化) / settings.password_hash(S69) / settings.price_list(S45)

## S36-S70 增补契约（数据管理/报告/诊断/分版/回收站）
```
GET  /api/data/backup[?pass=6+位] -> 备份JSON附件（S38；S61 pass=口令出AES-GCM密文包{__enc,v,salt,iv,tag,data}；S71附snapshots{hot,biz}趋势快照）
POST /api/data/restore {data, pass?, preview?} -> preview=1返回{preview,accounts,videos,comments,follows,customScripts,cleared}零副作用（S64）| 执行返回{restored,snapshots_restored}（S61/64/71）
GET  /api/data/backups -> {list:[{name,size,mtime,kind:auto|manual}],keep:14,last_auto,total_size}（S80 本地自动备份目录盘点）
GET  /api/marketing/segments -> {segments:[{key,label,desc,action,count,members[]}]}（S84 智能客群五规则群：hot_untracked/overdue/silent/repeat/hotkw，本地推导只出主意；lib/marketing纯函数可单测）
GET  /api/marketing/insights -> {items:[{label,value,sub,link}]}（S85 机会雷达：待处理高意向/逾期/可唤醒/7日成交/昨日新增/热词；无数据=少一条不造假）
GET  /api/marketing/experiments -> {buckets:[{variant,used,leads,done}],total,sufficient}（S86 话术A/B：POST /api/comments/:id/replies 可选variant=1-4候选位次，手改内容自动归零位次；样本<20如实不足）
GET  /api/campaigns -> {items:[Campaign+{status,match_count,follow_new,done_in_period,revenue_in_period,progress}]}（S87 期间复盘只用ISO可信字段） | POST /api/campaigns {name,start_at,end_at,keyword?,note?,checklist?} -> Campaign | PATCH /api/campaigns/:id | DELETE /api/campaigns/:id
GET  /api/drafts[?status=pending|done|discarded] -> {items,pending}（S108 草稿收件箱，pendingCount=全量在途数不受status过滤影响；items新在前，环形上限200）
POST /api/drafts {comment_id,nick,text,via?} -> Draft | 同comment在途重复→400、缺参→400、评论不存在→404（S108；自动起草经repo.drafts.create同队列入箱，autoReplyTick对已在箱评论跳过防重复起草）
PATCH /api/drafts/:id {status:'pending'|'done'|'discarded'} -> Draft（handled_at盖戳；不存在→404）
PATCH /api/scripts/:id {action:'use'|'pin'|'unpin'} -> Script（S107 效果闭环：复制即计数，仅自定义cs-前缀；内置s1-s3→404防伪造热度；list active按pinned>used降序排自定义段）
GET  /api/leads/profile?nick= -> {nick,comments[](≤30),replies[](≤30),follows[],stats:{comments_n,high_n,replied_n,follows_n,done_n,amount_sum,first_touch,last_touch}}（S109 360档案跨集合聚合；first/last只用ISO可信字段，评论create_time仅展示不参与计算；缺nick→400）
能力键新增 marketing（S83）：专业版专属；基础版白名单不含 → /marketing 页与侧栏显示ProLock（API按既有策略开放）；发证脚本无需改（白名单机制自动锁）
POST /api/data/backups/run -> {created,entry}立即存manual快照（S80；auto每日凌晨3点后由调度器心跳幂等落一份，轮转保留最近14份）
GET  /api/data/backups/download?name= -> 快照文件附件（S80；命名白名单auto-/manual-正则，穿越400）；恢复走既有/api/data/restore（客户端download→JSON→preview→覆盖确认）
POST /api/data/clear {confirm:'清空'} -> 缺确认词FATAL（S37；业务全清+seed不复活，账号授权设置保留）
GET  /api/diag/bundle -> text/plain附件（S59：版本/环境/授权状态/双日志近150行，不含业务数据）
POST /api/report/snapshot -> {snapshot, history}（S55：报告页打开记当日业务快照，每日一条30天）
POST /api/auth/unlock {password} -> {unlocked}（S69：未设密码直接放行；错口令401 FATAL）
GET  /api/scripts?trash=1 / DELETE /api/scripts/:id[?restore=1] -> 软删进回收站/恢复（S57；reply-rules同构）
PATCH /api/competitors/:id {play?,like?,remark?} -> 变化自动留history（S53）
PATCH /api/settings {auto_config:{sync_enabled,sync_interval_min,sync_daily_cap,quiet_enabled,quiet_start,quiet_end,reply_gap_min_sec,reply_gap_max_sec,reply_daily_cap,reply_tone,report_hour,dashboard_refresh_sec}} -> GET自动回显（S75读侧经mergeAutoCfg钳制，越界/倒挂/坏枚举/坏布尔回退默认；调度器+自动回复+日报+看板刷新共12旋钮）
PATCH /api/settings {comment_views:[{name,kw,intent,unreadOnly}]} -> 评论保存视图持久化（S93；非数组400；经sanitizeViews钳制：≤8个/名1-12字去重/kw≤20/intent≤8/坏布尔false；GET与PATCH回声同口径）。另S90纯前端操作层：Ctrl+K命令面板（导航/搜台账话术/快捷动作复用既有端点）、台账看板拖拽=PATCH /api/follows/:id、日历视图=parseRemind客户端推导——无新端点
PATCH /api/settings {desktop_autostart:bool} -> 桌面壳开机自启标志（S104；非布尔400；GET与PATCH回声）。真源在此文件：桌面主进程每30s轮读该标志执行setLoginItemSettings（仅app.isPackaged；字段缺失=null不碰用户登录项）。关窗=hide进托盘常驻（quitting标志区分真退出），提醒/起草/每日备份后台不断；托盘菜单「退出」才app.quit→before-quit杀内嵌服务。打印=S103客户端window.print+globals.css @media print（纸面隐藏侧栏/按钮/交互件）
```

## 红线（永续有效）
不爬虫/RPA/cookie/拟人化绕检测（S73用户令全自动化后仍保留此半——绕过平台技术措施是法律问题，不因风险自担而放开）；
自动外呼/批量主动私信永不做；**自动回复修订为三重门内可做（S74）：官方接口+能力审核+用户开关，缺一不外发**——未过门时执行器只起草入日志供人工发送；
license私钥data/不进仓；接口没有的数据不展示。
**智能营销套件（S83-87）合规边界**：segments/insights/experiments/campaigns 全部只从本地已有数据推导"建议与复盘"，不产生任何自动触达（无群发任务、不外呼、不自动私信）；campaigns 的 checklist 是人工动作清单，勾选=人做完了记一笔；话术A/B仅统计既有回评记账的位次分布，不改发送行为。
