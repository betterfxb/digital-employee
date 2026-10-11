# 03 接口/数据模型契约（P0冻结）

## 通用规范
- 分页：`{items, next_cursor, has_more}`，评论 `cursor=create_time+id` keyset，count默认20
- 错误：`{code, message, trace_id}`，code分 `RETRYABLE/FATAL/AUTH_EXPIRED`

## Auth
```
GET /api/auth/douyin/qrcode -> {qrcode_url, state, expire_in:60}
GET /api/auth/poll?state&t -> {status:pending/success}（t为演示轮询计数器，生产换真授权码）
GET /api/accounts/me -> Account{id, open_id_mask, nickname, avatar, auth_type:personal, expires_at}
POST /api/auth/refresh -> {expires_at}
GET /api/auth/logs -> AuthLog[{at,op,by,result}]（P0 mock恒3行，分页待真实DB）
```

## Stats / Videos
```
GET /api/videos?account_id&start&end&page,sort,order -> Video[]
GET /api/stats/overview?account_id&date -> {play,like,comment,fans,环比}
GET /api/stats/trend?ids=a,b,c&days=7 -> {[id]:[{date,play,like}]}（键为请求传入id，mock传aweme_id）
POST /api/stats/sync -> {task_id}
GET/POST /api/competitors -> {url,source,play,like,remark} // 手动导入区
```

## Comments / Follows
```
GET /api/comments?video_id&intent&keyword&unread_only&cursor,count=20
POST /api/comments/read {ids[] | all_video_id}
PATCH /api/comments/:id {intent:高/中/低/垃圾, ignore:bool}
GET /api/comments/keywords/hot?days=7 -> [{kw,count}]
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

## 表结构要点
- Account(open_id唯一, token_enc, key_version, expires_at)
- Video(aweme_id唯一, account_id, title, cover, create_time)
- VideoStatDaily(video_id,date唯一, play,like,comment,share,fans_total)
- Comment(comment_id唯一, video_id, content, user_nick, is_read_local, intent, keywords[])
- Follow(peer_nick, source_video_id, next_remind_at, status)
