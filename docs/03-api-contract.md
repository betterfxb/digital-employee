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
GET /api/stats/overview?account_id&date -> {play,like,comment,fans,环比,note}（S23b：作品指标按当前账号实时聚合，fans/mom仍mock口径，note=口径标注）
GET /api/stats/trend?ids=a,b,c&days=7 -> {[id]:[{date,play,like}]}（键为请求传入id；imp_导入作品返回[]不画假线，S23b）
POST /api/stats/sync -> {task_id, live_sync?} // S26: live模式入队后实际拉开放平台作品+评论（mock纯入队不变）；live_sync={mode,videos,comments,pages,error?}
GET/POST /api/competitors -> {url,source,play,like,remark} // 手动导入区
POST /api/import {kind:videos|comments, csv} -> {created,updated,skipped?} | {code:FATAL}（S23：按账号+标题/昵称upsert，imp_前缀，首行表头，≤200行）
```

## Comments / Follows
```
GET /api/comments?video_id&intent&keyword&unread_only&cursor,count=20
POST /api/comments/read {ids[] | all_video_id}
PATCH /api/comments/:id {intent:高/中/低/垃圾, ignore:bool}
GET /api/comments/keywords/hot?days=7 -> [{kw,count}]
GET /api/comments/:id/replies -> {items} / POST /api/comments/:id/replies {content} // 回评记录（S19，S25补进契约）
POST /api/follows {comment_id, note} / GET /api/follows?status
PATCH /api/follows/:id {status} // 状态流转，非法状态/未知id→FATAL（S13新增）
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
GET /api/license/status -> {mode:demo|licensed, valid, customer, expires_at, features[], seats, machine_slots, watermark, error}
// demo无license文件→宽松不锁功能（红线docs/11§5）；验签Ed25519，canonical=key排序JSON
// 溯源水印：响应头 X-Vendor-Watermark + HTML meta[name=x-vendor]，来源=license.watermark或WATERMARK_ID env
// 发证：node scripts/license-gen.js keypair|issue --customer ...（私钥data/license_key.pem不进仓）
// 功能闸挂载点 lib/license.ts requireLicense(feature)，live接真实API时启用
```

## 表结构要点
- Account(open_id唯一, token_enc, key_version, expires_at)
- Video(aweme_id唯一, account_id, title, cover, create_time)
- VideoStatDaily(video_id,date唯一, play,like,comment,share,fans_total)
- Comment(comment_id唯一, video_id, content, user_nick, is_read_local, intent, keywords[])
- Follow(peer_nick, source_video_id, next_remind_at, status)
