/** S5+S7冒烟：按04-tasks验收逐项打点（mock态） */
const base = process.env.SMOKE_BASE || 'http://localhost:3001';
let fail = 0;
const pass = (ok, name, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra}`); if (!ok) fail++; };
const get = async (p) => { const r = await fetch(base + p); return { s: r.status, j: await r.json().catch(() => null) }; };
const post = async (p, body, headers = {}) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => null) }; };
(async () => {
  for (const p of [
    '/api/auth/douyin/qrcode',
    '/api/accounts/me',
    '/api/auth/logs',
    '/api/stats/overview',
    '/api/videos',
    '/api/comments?keyword=&unread_only=0',
    '/api/stats/trend?ids=aw_001&days=7',
    '/api/comments/keywords/hot',
    '/api/competitors',
    '/api/scripts',
    '/api/follows',
    '/api/follows?status=%E5%BE%85%E5%9B%9E%E8%AE%BF',
    '/api/webhooks/dlq',
    '/api/accounts',
    '/api/tasks',
    '/api/stats/usage',
    '/api/settings',
    '/api/video-tasks',
    '/api/reply-rules',
  ]) {
    try { const { s, j } = await get(p); pass(s === 200 && j !== undefined, `GET ${p}`); }
    catch (e) { pass(false, `GET ${p}`, ` ${e.message}`); }
  }
  try { const { s, j } = await post('/api/comments/read', { ids: ['c1'] }); pass(s === 200 && j.updated === 1, 'POST read ok'); } catch (e) { pass(false, 'POST read ok'); }
  try { const { s, j } = await post('/api/comments/read', { ids: Array.from({ length: 101 }, (_, i) => `x${i}`) }); pass(s === 400 && j.code === 'FATAL', 'POST read over-limit FATAL'); } catch (e) { pass(false, 'POST read over-limit'); }
  try { const r = await fetch(base + '/api/comments/c1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: '咨询' }) }); const j = await r.json(); pass(r.status === 200 && j.intent === '咨询', 'PATCH intent ok'); } catch (e) { pass(false, 'PATCH intent ok'); }
  try { const r = await fetch(base + '/api/comments/c1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: '乱填' }) }); const j = await r.json(); pass(r.status === 400 && j.code === 'FATAL', 'PATCH intent invalid FATAL'); } catch (e) { pass(false, 'PATCH intent invalid'); }
  try { const { s, j } = await get('/api/comments?video_id=v2&unread_only=0'); pass(s === 200 && j.items.length === 2, 'GET comments video filter'); } catch (e) { pass(false, 'GET comments video filter'); }
  try { const { s, j } = await get('/api/comments?intent=%E5%9E%83%E5%9C%BE&unread_only=0'); pass(s === 200 && j.items.length === 1, 'GET comments intent filter'); } catch (e) { pass(false, 'GET comments intent filter'); }
  try { const { s, j } = await post('/api/comments/read', { all_video_id: 'smoke-v9' }); pass(s === 200 && j.updated === 'all', 'POST read all_video'); } catch (e) { pass(false, 'POST read all_video'); }
  try { const { s, j } = await post('/api/follows', { peer_nick: '冒烟', source_video_id: 'v1' }); pass(s === 200 && !!j.id && j.status === '待回访', 'POST follow valid'); } catch (e) { pass(false, 'POST follow valid'); }
  try { const { s, j } = await get('/api/scripts/templates?intent=%E9%AB%98%E6%84%8F%E5%90%91&nick=%E5%88%80%E5%8F%8B&product=%E8%B7%91%E5%88%80'); pass(s === 200 && j.items.length > 0 && j.items[0].content.includes('刀友') && j.items[0].content.includes('跑刀'), 'GET templates filled'); } catch (e) { pass(false, 'GET templates filled'); }
  try { const { s, j } = await post('/api/tasks/control', { type: 'commentPoll', action: 'pause' }); pass(s === 200 && j.paused === true, 'POST task pause'); } catch (e) { pass(false, 'POST task pause'); }
  try { const { s, j } = await post('/api/tasks/control', { type: 'commentPoll', action: 'resume' }); pass(s === 200 && j.paused === false, 'POST task resume'); } catch (e) { pass(false, 'POST task resume'); }
  try { const { s, j } = await post('/api/tasks/control', { type: 'nope', action: 'pause' }); pass(s === 400 && j.code === 'FATAL', 'POST task invalid FATAL'); } catch (e) { pass(false, 'POST task invalid'); }
  try { const { s, j } = await post('/api/accounts/switch', { id: 'acc_002' }); pass(s === 200 && j.active_id === 'acc_002', 'POST switch acc_002'); } catch (e) { pass(false, 'POST switch acc_002'); }
  try { const { s, j } = await get('/api/videos'); pass(s === 200 && j.items.length === 3 && j.items.some((v) => v.id === 'v3'), 'GET videos isolated acc_002'); } catch (e) { pass(false, 'GET videos isolated'); }
  try { const { s, j } = await post('/api/accounts/switch', { id: 'nope' }); pass(s === 400 && j.code === 'FATAL', 'POST switch invalid FATAL'); } catch (e) { pass(false, 'POST switch invalid'); }
  try { const { s, j } = await post('/api/accounts/switch', { id: 'acc_001' }); pass(s === 200 && j.active_id === 'acc_001', 'POST switch back acc_001'); } catch (e) { pass(false, 'POST switch back'); }
  try { const { s, j } = await get('/api/settings'); pass(s === 200 && j.font_size >= 14 && j.font_size <= 24 && j.theme_color === '#1A1A18' && !!j.shop_name, 'GET settings defaults'); } catch (e) { pass(false, 'GET settings defaults'); } // S113修：字号断言改范围——原硬编码===14遇默认16/测试写回即非幂等（自恢复纪律再犯自查）
  const patch = async (p, body) => { const r = await fetch(base + p, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => null) }; };
  try { const { s, j } = await patch('/api/settings', { font_size: 99 }); pass(s === 400 && j.code === 'FATAL', 'PATCH settings font FATAL'); } catch (e) { pass(false, 'PATCH settings font'); }
  try { const { s, j } = await patch('/api/settings', { theme_color: '#FF0000' }); pass(s === 400 && j.code === 'FATAL', 'PATCH settings theme FATAL'); } catch (e) { pass(false, 'PATCH settings theme'); }
  try { const { s, j } = await patch('/api/settings', { shop_name: 'a' }); pass(s === 400 && j.code === 'FATAL', 'PATCH settings shop FATAL'); } catch (e) { pass(false, 'PATCH settings shop'); }
  try { const { s, j } = await patch('/api/settings', { font_size: 16, service_name: '冒烟服务' }); pass(s === 200 && j.font_size === 16 && j.service_name === '冒烟服务', 'PATCH settings ok'); } catch (e) { pass(false, 'PATCH settings ok'); }
  try { const { s, j } = await patch('/api/settings', { font_size: 14, service_name: '跑刀代跑' }); pass(s === 200, 'PATCH settings restore'); } catch (e) { pass(false, 'PATCH settings restore'); }
  try {
    const add = await post('/api/video-tasks', { video_id: 'v3' });
    const dup = await post('/api/video-tasks', { video_id: 'v3' });
    const bad = await post('/api/video-tasks', { video_id: 'nope' });
    pass(add.s === 200 && !!add.j.id && dup.s === 400 && bad.s === 400, 'POST video-tasks add/dup/invalid');
    const id = add.j.id;
    const r1 = await fetch(base + `/api/video-tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: true, interval_min: 15 }) });
    const j1 = await r1.json();
    const r2 = await fetch(base + `/api/video-tasks/${id}`, { method: 'DELETE' });
    pass(j1.paused === true && j1.interval_min === 15 && r2.status === 200, 'PATCH/DELETE video-tasks');
  } catch (e) { pass(false, 'video-tasks flow'); }
  try {
    const a = await post('/api/scripts', { title: '冒烟话术', content: '冒烟内容' });
    const delBuiltin = await fetch(base + '/api/scripts/s1', { method: 'DELETE' });
    const delOwn = await fetch(base + `/api/scripts/${a.j.id}`, { method: 'DELETE' });
    pass(a.s === 200 && delBuiltin.status === 404 && delOwn.status === 200, 'scripts custom CRUD');
  } catch (e) { pass(false, 'scripts custom CRUD'); }
  try {
    const a = await post('/api/reply-rules', { keyword: '冒烟词', reply: '冒烟回复' });
    const t = await fetch(base + `/api/reply-rules/${a.j.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) }).then((r) => r.json());
    const d = await fetch(base + `/api/reply-rules/${a.j.id}`, { method: 'DELETE' });
    pass(a.s === 200 && t.enabled === false && d.status === 200, 'reply-rules CRUD');
  } catch (e) { pass(false, 'reply-rules CRUD'); }
  try {
    const bad = await post('/api/comments/nope/replies', { content: 'x' });
    const okk = await post('/api/comments/c1/replies', { content: '冒烟回评' });
    const list = await get('/api/comments/c1/replies');
    pass(bad.s === 404 && okk.s === 200 && list.j.items.some((x) => x.content === '冒烟回评'), 'replies flow');
  } catch (e) { pass(false, 'replies flow'); }
  try { const { s, j } = await post('/api/competitors', { url: '冒烟', source: 'manual', kind: 'nope' }); pass(s === 400 && j.code === 'FATAL', 'POST competitor kind FATAL'); } catch (e) { pass(false, 'POST competitor kind'); }
  try { const { s, j } = await post('/api/settings/password', { new_password: '123' }); pass(s === 400 && j.code === 'FATAL', 'POST password short FATAL'); } catch (e) { pass(false, 'POST password short'); }
  try { const { s, j } = await post('/api/settings/password', { new_password: 'smoke-123456' }); pass(s === 200 && j.changed === true && !!j.changed_at, 'POST password ok'); } catch (e) { pass(false, 'POST password ok'); }
  // S110修缺：测试写真实用户状态必须自恢复——设完立即清除并读验，防把开发机/演示机锁在门外（曾致用户无法访问的事故）
  try { const { s, j } = await post('/api/settings/password', { new_password: '' }); const v = await get('/api/settings'); pass(s === 200 && j.cleared === true && !v.j.password_hash, 'POST password clear-restore（测试自恢复纪律）'); } catch (e) { pass(false, 'POST password clear-restore'); }
  try { const { s, j } = await post('/api/auth/refresh', {}); pass(s === 200 && !!j.expires_at, 'POST refresh'); } catch (e) { pass(false, 'POST refresh'); }
  try { const { s, j } = await post('/api/stats/sync', {}); pass(s === 200 && !!j.task_id, 'POST sync'); } catch (e) { pass(false, 'POST sync'); }
  try { const { s, j } = await post('/api/competitors', { url: '冒烟店', source: 'nope' }); pass(s === 400 && j.code === 'FATAL', 'POST competitor invalid FATAL'); } catch (e) { pass(false, 'POST competitor invalid'); }
  try { const { s, j } = await post('/api/follows', { peer_nick: '冒烟', source_video_id: 'v1', status: '乱填' }); pass(s === 400 && j.code === 'FATAL', 'POST follow invalid FATAL'); } catch (e) { pass(false, 'POST follow invalid'); }
  try { const r = await fetch(base + '/api/follows/f1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: '已转化' }) }); const j = await r.json(); pass(r.status === 200 && j.status === '已转化', 'PATCH follow status'); } catch (e) { pass(false, 'PATCH follow status'); }
  try { const r = await fetch(base + '/api/follows/nope', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: '已转化' }) }); const j = await r.json(); pass(r.status === 404 && j.code === 'FATAL', 'PATCH follow 404 FATAL'); } catch (e) { pass(false, 'PATCH follow 404'); }
  try { const r = await fetch(base + '/api/webhooks/douyin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); pass(r.status === 401, 'webhook no-sig 401'); } catch (e) { pass(false, 'webhook no-sig'); }
  try {
    const h = { 'x-signature': 'smoke' };
    const a = await post('/api/webhooks/douyin', { event_id: 'smoke-1', comment_id: 'cm_9' }, h);
    const b = await post('/api/webhooks/douyin', { event_id: 'smoke-1', comment_id: 'cm_9' }, h);
    pass(a.s === 200 && a.j.received && b.j.deduped === true, 'webhook idempotent');
    const bad = await fetch(base + '/api/webhooks/douyin', { method: 'POST', headers: { 'Content-Type': 'text/plain', 'x-signature': 'smoke' }, body: '{oops' });
    pass(bad.status === 400, 'webhook bad-json DLQ');
  } catch (e) { pass(false, 'webhook flow'); }
  // S31 真二维码+弹窗授权：qrcode出PNG dataURL；popup授权302到mock确认页；确认页过期state给410
  try {
    const qrj = (await get('/api/auth/douyin/qrcode')).j;
    pass(typeof qrj?.qr_data_url === 'string' && qrj.qr_data_url.startsWith('data:image/png') && typeof qrj.qrcode_url === 'string' && qrj.qrcode_url.startsWith('http'), 'S31 真二维码dataURL');
    const ap = await fetch(base + '/api/auth/douyin/authorize?popup=1', { redirect: 'manual' });
    const locp = ap.headers.get('location') || '';
    pass(ap.status === 302 && locp.includes('/api/auth/douyin/mock-consent'), 'S31 popup→确认页');
    const cs = await fetch(base + '/api/auth/douyin/mock-consent?state=nope', { redirect: 'manual' });
    pass(cs.status === 410, 'S31 确认页过期state 410');
  } catch (e) { pass(false, 'S31 qr+popup flow', ` ${e.message}`); }
  // S37/S38 数据管理：backup下载结构 + clear确认词防线
  try {
    const bk = await fetch(base + '/api/data/backup');
    const bjt = bk.json().catch(() => null);
    pass(bk.status === 200 && (bk.headers.get('content-disposition') || '').includes('attachment') && !!(await bjt).accounts, 'S38 backup下载');
    const cl = await post('/api/data/clear', {});
    pass(cl.s === 400 && cl.j.code === 'FATAL', 'S37 clear确认防线');
  } catch (e) { pass(false, 'S37/S38 data mgmt', ` ${e.message}`); }
  // S53 竞品记录更新：非法值拒 + 变化留历史
  try {
    const cps = await get('/api/competitors');
    const cp = cps.j.items[0];
    if (!cp) throw new Error('无竞品数据');
    const patchCp = (body) => fetch(base + `/api/competitors/${cp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
    const bad = await patchCp({ play: -1 });
    const upd = await patchCp({ remark: 'S53冒烟备注' });
    pass(bad.code === 'FATAL' && upd.remark === 'S53冒烟备注' && Array.isArray(upd.history) && upd.history.length >= 1, 'S53 竞品记录留历史+非法拒');
  } catch (e) { pass(false, 'S53 竞品记录', ` ${e.message}`); }
  // S57 软删除闭环：删→active不见→trash可见→恢复→active回来（终态留trash不污染active列表）
  try {
    const a = await post('/api/scripts', { title: 'S57回收站话术', content: '软删测试内容' });
    const d = await fetch(base + `/api/scripts/${a.j.id}`, { method: 'DELETE' }).then((r) => r.json());
    const act1 = await get('/api/scripts');
    const trash = await get('/api/scripts?trash=1');
    const res = await fetch(base + `/api/scripts/${a.j.id}?restore=1`, { method: 'DELETE' }).then((r) => r.json());
    const act2 = await get('/api/scripts');
    const okChain = d.removed === true
      && !act1.j.items.some((x) => x.id === a.j.id)
      && trash.j.items.some((x) => x.id === a.j.id)
      && res.restored === true
      && act2.j.items.some((x) => x.id === a.j.id);
    await fetch(base + `/api/scripts/${a.j.id}`, { method: 'DELETE' }); // 终态：回回收站，不进active
    pass(okChain, 'S57 软删→回收站→恢复闭环');
  } catch (e) { pass(false, 'S57 软删闭环', ` ${e.message}`); }
  // S66 跟进去重防呆：活跃管线同昵称重复加入返回已有记录（幂等，多轮跑稳定）
  try {
    const f1 = await post('/api/follows', { peer_nick: '去重测试员', source_video_id: 'v1' });
    const f2 = await post('/api/follows', { peer_nick: '去重测试员', source_video_id: 'v2' });
    pass(f1.s === 200 && f2.s === 200 && f2.j.deduped === true && f2.j.id === f1.j.id, 'S66 跟进去重防呆');
  } catch (e) { pass(false, 'S66 去重', ` ${e.message}`); }
  // S74 自动回复执行器状态（tasks/status含auto_reply三门与日志结构）
  try {
    const ts2 = await get('/api/tasks/status');
    const ar = ts2.j.auto_reply;
    pass(ts2.s === 200 && ar && typeof ar.enabled === 'boolean' && typeof ar.gate === 'string' && Array.isArray(ar.log) && ar.cap > 0, 'S74 自动回复状态');
  } catch (e) { pass(false, 'S74 自动回复状态', ` ${e.message}`); }
  // S23 预真机闭环：授权→回调绑定→真实数据导入→意图分类→切回（全部mock占位密钥）
  try {
    const a1 = await fetch(base + '/api/auth/douyin/authorize?nick=' + encodeURIComponent('冒烟绑定'), { redirect: 'manual' });
    const loc1 = a1.headers.get('location') || '';
    pass(a1.status === 302 && loc1.includes('/api/auth/douyin/callback'), 'S23 authorize 302→callback');
    const cb = await fetch(loc1.startsWith('http') ? loc1 : base + loc1, { redirect: 'manual' });
    const loc2 = cb.headers.get('location') || '';
    pass(cb.status === 302 && loc2.includes('bind=ok'), 'S23 callback bind ok');
    const accs = await get('/api/accounts');
    const bound = accs.j.items.find((x) => x.nickname === '冒烟绑定');
    if (!bound) throw new Error('绑定账号未出现在列表');
    const csvV = '标题,发布时间,播放,点赞,评论,转发\n冒烟真机作品,10-09,1000,88,9,3';
    const iv1 = await post('/api/import', { kind: 'videos', csv: csvV });
    const iv2 = await post('/api/import', { kind: 'videos', csv: csvV });
    const vids = await get('/api/videos');
    pass(iv1.s === 200 && iv2.s === 200 && iv1.j.created + iv1.j.updated === 1 && iv2.j.created + iv2.j.updated === 1 && vids.j.items.filter((x) => x.title === '冒烟真机作品').length === 1 && vids.j.items.some((x) => x.title === '冒烟真机作品'), 'S23 import video upsert幂等');
    const ic = await post('/api/import', { kind: 'comments', csv: '昵称,内容,视频标题,时间,点赞\n烟友,跑刀怎么下单？多少钱,冒烟真机作品,1小时前,2' });
    const cmts = await get('/api/comments?unread_only=0');
    const mine = cmts.j.items.find((x) => x.user_nick === '烟友');
    pass(ic.s === 200 && mine && mine.intent === '高意向' && mine.keywords.includes('下单'), 'S23 import comment+意图分类');
    const bad1 = await post('/api/import', { kind: 'nope', csv: 'x' });
    const bad2 = await post('/api/import', { kind: 'videos', csv: '' });
    const bad3 = await post('/api/import', { kind: 'comments', csv: '昵称,内容\n烟友,没有视频标题列' });
    pass(bad1.s === 400 && bad1.j.code === 'FATAL' && bad2.s === 400 && bad3.s === 400, 'S23 import invalid FATAL');
    // S59 列名别名容错（常见导出格式：用户昵称/评论内容/所属视频/评论时间）
    const ali = await post('/api/import', { kind: 'comments', csv: '用户昵称,评论内容,所属视频,评论时间\n别名粉,跑刀怎么下单？多少钱,冒烟真机作品,2小时前,4' });
    const cmts2 = await get('/api/comments?unread_only=0');
    const aliNick = cmts2.j.items.find((x) => x.user_nick === '别名粉');
    pass(ali.s === 200 && ali.j.created + ali.j.updated === 1 && aliNick && aliNick.intent === '高意向', 'S59 列名别名容错');
    // S79 导入容错三件套：TSV（Excel复制粘贴）+ 别名表头 + 绝对日期归一
    const tsv = '作品标题\t发布日期\t播放量\t获赞数\n冒烟TSV作品\t2026-10-15 14:30:00\t1,234\t56';
    const it = await post('/api/import', { kind: 'videos', csv: tsv });
    const vidsT = await get('/api/videos');
    const tRow = vidsT.j.items.find((x) => x.title === '冒烟TSV作品');
    pass(it.s === 200 && tRow && tRow.publish_time === '10-15' && tRow.play === 1234 && tRow.like === 56, 'S79 TSV+别名+日期归一+千分位');
    // S79 缺列报错带用户表头回显（可自助修正）
    const miss = await post('/api/import', { kind: 'videos', csv: '名称,数据\nx,1' });
    pass(miss.s === 400 && String(miss.j.message).includes('你文件的表头是：名称,数据'), 'S79 缺列报错回显实际表头');
    // S118 存量客户导入：唯一昵称幂等（本次新建→同档重导去重跳过）+ 缺列拒 + S115联系方式往返后复原
    const leadNick = '冒烟客户' + Date.now().toString(36);
    const leadCsv = `昵称,状态,下次提醒,金额,联系方式\n${leadNick},已转化,明天 09:00,298,wx_smoke123`;
    const l1 = await post('/api/import', { kind: 'leads', csv: leadCsv });
    const l2 = await post('/api/import', { kind: 'leads', csv: leadCsv });
    const lBad = await post('/api/import', { kind: 'leads', csv: '名字,电话\n张三,138' });
    const fl = (await get('/api/follows')).j.items.find((x) => x.peer_nick === leadNick);
    pass(l1.s === 200 && l1.j.created === 1 && fl && fl.status === '已转化' && fl.amount === 298 && l2.s === 400 && String(l2.j.message).includes('跳过') && lBad.s === 400, 'S118 leads导入/去重跳过/缺列拒');
    pass(!!fl && fl.source === 'import', 'S128 导入线索带source=import归因排除标记');
    let contactOk = false;
    if (fl) {
      const c1 = await (async () => { const rr = await fetch(base + `/api/follows/${fl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: '13800001111' }) }); return rr.json(); })();
      const c2 = await (async () => { const rr = await fetch(base + `/api/follows/${fl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: '' }) }); return rr.json(); })();
      contactOk = c1.contact === '13800001111' && c2.contact === '';
    }
    pass(contactOk, 'S115 联系方式PATCH往返（测后清回）');
    // S132 成本往返：记成本→校验（含小数舍入）→清零（此行为冒烟产物行，清零即净）
    let costOk = false;
    if (fl) {
      const k1 = await (async () => { const rr = await fetch(base + `/api/follows/${fl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cost: 100.456 }) }); return rr.json(); })();
      const k2 = await (async () => { const rr = await fetch(base + `/api/follows/${fl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cost: 0 }) }); return rr.json(); })();
      const kBad = await (async () => { const rr = await fetch(base + `/api/follows/${fl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cost: -5 }) }); return { s: rr.status }; })();
      costOk = k1.cost === 100.46 && k2.cost === 0 && kBad.s === 400;
    }
    pass(costOk, 'S132 成本PATCH往返（两位舍入/清零/负值拒）');
    // S138 记了联系：动作入history（末条即证）；空/超长拒（历史只增不删，冒烟产物行可容）
    let touchOk = false;
    if (fl) {
      const t1 = await (async () => { const rr = await fetch(base + `/api/follows/${fl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ touch: '冒烟联系测试' }) }); return rr.json(); })();
      const t2 = await (async () => { const rr = await fetch(base + `/api/follows/${fl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ touch: '' }) }); return { s: rr.status }; })();
      const t3 = await (async () => { const rr = await fetch(base + `/api/follows/${fl.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ touch: '超'.repeat(21) }) }); return { s: rr.status }; })();
      touchOk = !t1.code && (t1.history || [])[0]?.act?.indexOf('记了联系：冒烟联系测试') === 0 && t2.s === 400 && t3.s === 400;
    }
    pass(touchOk, 'S138 记了联系动作往返（入history/空拒/超长拒）');
    // S133 周目标往返：记原值→设888888→验证→复原（自恢复纪律，双轮幂等）
    {
      const g0 = (await get('/api/settings')).j.weekly_goal;
      const g1 = await patch('/api/settings', { weekly_goal: 888888 });
      const g2 = await patch('/api/settings', { weekly_goal: -1 });
      const g3 = await patch('/api/settings', { weekly_goal: g0 === undefined ? 0 : g0 });
      pass(g1.s === 200 && g1.j.weekly_goal === 888888 && g2.s === 400 && g3.s === 200 && (await get('/api/settings')).j.weekly_goal === (g0 || 0), 'S133 weekly_goal往返+负值拒（测后复原）');
    }
    // S80 本地自动备份轮转三端点
    const bl = await get('/api/data/backups');
    pass(bl.s === 200 && Array.isArray(bl.j.list) && bl.j.keep === 14, 'S80 backups list 结构');
    const br = await post('/api/data/backups/run', {});
    pass(br.s === 200 && br.j.created === true && /^manual-\d{4}-\d{2}-\d{2}-\d{6}\.json$/.test(br.j.entry?.name || ''), 'S80 手动备份落盘命名规范');
    const dh = await get('/api/data/health');
    pass(dh.s === 200 && (dh.j.recovery === null || (typeof dh.j.recovery.from === 'string' && typeof dh.j.recovery.at === 'string')), 'S122 data/health 结构（recovery=null或{from,at}）');
    pass(dh.s === 200 && dh.j.writable === true && typeof dh.j.counts?.videos === 'number' && typeof dh.j.counts?.follows === 'number' && typeof dh.j.backups?.count === 'number' && 'last_import_at' in dh.j, 'S146 health扩读数（writable/counts/backups/last_import_at）');
    // S141 备份验证：刚落的manual备份=当前态，健全且零流失（此断言必须在S80备份块之后跑）
    const bv = await get('/api/data/backups/verify');
    pass(bv.s === 200 && bv.j.sane === true && bv.j.parseable === true && Array.isArray(bv.j.diff) && bv.j.lostTotal === 0 && bv.j.diff.some((d) => d.key === 'follows' && d.label), 'S141 备份验证结构（sane+diff带中文label+零流失）');
    const ovI = await get('/api/stats/overview');
    pass(ovI.s === 200 && typeof ovI.j.last_import_at === 'string' && !Number.isNaN(Date.parse(ovI.j.last_import_at)), 'S125 overview带last_import_at（本轮已多次导入，必非空）');
    const dl = await fetch(base + '/api/data/backups/download?name=' + encodeURIComponent(br.j.entry.name));
    const dlText = dl.status === 200 ? await dl.text() : '';
    let dlJson = null; try { dlJson = JSON.parse(dlText); } catch { /* invalid */ }
    pass(dl.status === 200 && dlJson && Array.isArray(dlJson.accounts) && Array.isArray(dlJson.videos), 'S80 备份下载=合法快照JSON');
    const evil = await fetch(base + '/api/data/backups/download?name=../local.json');
    pass(evil.status === 400, 'S80 备份名穿越拒绝');
    // S83-87 智能营销套件端点
    const mg = await get('/api/marketing/segments');
    const keys = (mg.j.segments || []).map((s) => s.key).join(',');
    pass(mg.s === 200 && mg.j.segments.length === 5 && ['hot_untracked', 'overdue', 'silent', 'repeat', 'hotkw'].every((k) => keys.includes(k)), 'S84 segments 五规则群齐');
    const mi = await get('/api/marketing/insights');
    pass(mi.s === 200 && Array.isArray(mi.j.items) && mi.j.items.every((x) => x.label && x.value && x.link), 'S85 insights 简报结构');
    const me = await get('/api/marketing/experiments');
    pass(me.s === 200 && (me.j.buckets || []).length === 4 && typeof me.j.sufficient === 'boolean', 'S86 experiments 四桶+样本如实');
    const cmt = (await get('/api/comments?unread_only=0')).j.items[0];
    const rv = await post(`/api/comments/${cmt.id}/replies`, { content: '冒烟位次回评', variant: 2 });
    const rvs = await get(`/api/comments/${cmt.id}/replies`);
    pass(rv.s === 200 && rv.j.variant === 2 && (rvs.j.items || []).some((x) => x.content === '冒烟位次回评' && x.variant === 2), 'S86 回评位次记录落账');
    const cp = await post('/api/campaigns', { name: '冒烟冲单周', start_at: '2026-01-01', end_at: '2099-12-31', keyword: '价格', checklist: [{ text: '发3条新作品', done: false }] });
    const cl = await get('/api/campaigns');
    const found = (cl.j.items || []).find((x) => x.id === (cp.j.id || ''));
    pass(cp.s === 200 && cp.j.id && found && found.status === '进行中' && typeof found.match_count === 'number' && found.progress === 0, 'S87 campaigns 创建与复盘口径');
    const cu = await (async () => { const rr = await fetch(base + `/api/campaigns/${cp.j.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checklist: [{ text: '发3条新作品', done: true }] }) }); return { s: rr.status, j: await rr.json() }; })();
    const cd = await fetch(base + `/api/campaigns/${cp.j.id}`, { method: 'DELETE' });
    const cl2 = await get('/api/campaigns');
    pass(cu.s === 200 && cu.j.checklist[0].done === true && cd.status === 200 && !(cl2.j.items || []).some((x) => x.id === cp.j.id), 'S87 campaigns 清单勾选+删除自清理');
    const cbad = await post('/api/campaigns', { name: '', start_at: '2026-01-01', end_at: '2099-12-31' });
    pass(cbad.s === 400, 'S87 campaigns 空名拒绝');
    // S93 保存视图：往返钳制（同名去重/坏项丢/越界截）+ 非数组拒 + 清空自恢复
    const vpatch = async (body) => { const rr = await fetch(base + '/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { s: rr.status, j: await rr.json() }; };
    const vr = await vpatch({ comment_views: [{ name: '冒烟高意向', intent: '高意向', unreadOnly: true }, { name: 'x'.repeat(20) }, 'bad', { name: '冒烟高意向', kw: 'dup' }] });
    pass(vr.s === 200 && vr.j.comment_views.length === 2 && vr.j.comment_views[0].unreadOnly === true && vr.j.comment_views[1].name.length === 12, 'S93 views 往返去重+钳制+坏项丢弃');
    const vbad = await vpatch({ comment_views: 'nope' });
    pass(vbad.s === 400, 'S93 views 非数组拒绝');
    const vclr = await vpatch({ comment_views: [] });
    pass(vclr.s === 200 && vclr.j.comment_views.length === 0, 'S93 views 清空自恢复');
    // S104 桌面常驻开关：布尔往返+坏类型拒
    const au1 = await vpatch({ desktop_autostart: true });
    const auG = await get('/api/settings');
    const auBad = await vpatch({ desktop_autostart: 'yes' });
    const au2 = await vpatch({ desktop_autostart: false });
    pass(au1.s === 200 && au1.j.desktop_autostart === true && auG.j.desktop_autostart === true, 'S104 自启开关布尔往返');
    pass(auBad.s === 400 && au2.s === 200 && au2.j.desktop_autostart === false, 'S104 坏类型拒+复位');
    // S111 界面比例：字号上限校验（25>max24拒）+ 新用户默认16可写回；S113：测后恢复原值（自恢复纪律）
    const fOrig = (await get('/api/settings')).j.font_size;
    const fBad25 = await vpatch({ font_size: 25 });
    const fOk16 = await vpatch({ font_size: 16 });
    const fBack = await vpatch({ font_size: fOrig });
    pass(fBad25.s === 400 && fOk16.s === 200 && fOk16.j.font_size === 16 && fBack.s === 200 && fBack.j.font_size === fOrig, 'S111 字号范围校验+默认16+测后复原');
    // S108 草稿收件箱：暂存→在途去重→标处理出队 + 非法参数
    const cListA = await get('/api/comments?unread_only=0');
    const anyC = (cListA.j.items || [])[0];
    const dp = async (path, body, m) => { const rr = await fetch(base + path, { method: m || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }); return { s: rr.status, j: await rr.json().catch(() => null) }; };
    const dCreate = await dp('/api/drafts', { comment_id: anyC.id, nick: anyC.user_nick, text: '冒烟草稿话术' });
    const dDup = await dp('/api/drafts', { comment_id: anyC.id, nick: anyC.user_nick, text: 'dup' });
    const dPend1 = await get('/api/drafts?status=pending');
    const dDone = await dp('/api/drafts/' + dCreate.j.id, { status: 'done' }, 'PATCH');
    const dPend2 = await get('/api/drafts?status=pending');
    pass(dCreate.s === 200 && dCreate.j.status === 'pending' && dDup.s === 400 && dPend1.j.items.some((x) => x.id === dCreate.j.id) && !dPend2.j.items.some((x) => x.id === dCreate.j.id) && dDone.j.status === 'done', 'S108 草稿暂存/去重/标处理出队');
    pass((await dp('/api/drafts/nope-x', { status: 'done' }, 'PATCH')).s === 404 && (await dp('/api/drafts', { comment_id: anyC.id, nick: '', text: 'x' })).s === 400, 'S108 草稿坏id/坏参数拒');
    // S107 话术效果：使用计数+置顶参与排序；内置不可统计
    const sNew = await post('/api/scripts', { title: '冒烟效果' + Date.now().toString(36), content: '测试话术内容' });
    const sId = sNew.j?.id;
    await dp('/api/scripts/' + sId, { action: 'use' }, 'PATCH');
    const sUse2 = await dp('/api/scripts/' + sId, { action: 'use' }, 'PATCH');
    const sPin = await dp('/api/scripts/' + sId, { action: 'pin' }, 'PATCH');
    const sBuiltin = await dp('/api/scripts/s1', { action: 'use' }, 'PATCH');
    const sList2 = await get('/api/scripts');
    const customs = (sList2.j.items || []).filter((s) => s.id.startsWith('cs-'));
    pass(sUse2.j.used === 2 && sPin.j.pinned === true && customs[0]?.id === sId && sBuiltin.s === 404, 'S107 话术使用计数+置顶排前+内置拒统计');
    await dp('/api/scripts/' + sId, {}, 'DELETE'); // 软删进回收站自清理
    // S109 线索360：按昵称聚合 + 缺参拒
    const lp = await get('/api/leads/profile?nick=' + encodeURIComponent(anyC.user_nick));
    const lpBad = await get('/api/leads/profile');
    pass(lp.s === 200 && lp.j.comments.some((x) => x.id === anyC.id) && typeof lp.j.stats.comments_n === 'number' && Array.isArray(lp.j.follows) && lpBad.s === 400, 'S109 360档案聚合与缺参拒');
    await post('/api/accounts/switch', { id: 'acc_001' });
    const back = await get('/api/accounts/me');
    pass(back.j.id === 'acc_001', 'S23 switch back acc_001');
  } catch (e) { pass(false, 'S23 flow', ` ${e.message}`); }
  // S25/S30 授权落地：license状态双态+机器码 + 溯源水印响应头 + 导入非法FATAL
  try {
    const ls = await get('/api/license/status');
    pass(ls.s === 200 && ['demo', 'licensed'].includes(ls.j.mode) && typeof ls.j.watermark === 'string' && ls.j.watermark.startsWith('wl-') && typeof ls.j.machine_code === 'string' && ls.j.machine_code.includes('.'), 'S25 license status双态+机器码');
    const home = await fetch(base + '/auth');
    const wm = home.headers.get('x-vendor-watermark') || '';
    pass(home.ok && wm.startsWith('wl-'), 'S25 watermark响应头', ` (${wm})`);
  } catch (e) { pass(false, 'S25 license flow', ` ${e.message}`); }
  try {
    const bad = await post('/api/license/import', { license: '{oops' });
    const none = await post('/api/license/import', {});
    pass(bad.s === 400 && bad.j.code === 'FATAL' && none.s === 400 && none.j.code === 'FATAL', 'S30 import非法FATAL');
  } catch (e) { pass(false, 'S30 import非法FATAL', ` ${e.message}`); }
  for (const p of ['/auth', '/dashboard', '/comments', '/messages']) {
    try { const r = await fetch(base + p); pass(r.ok, `page ${p}`, ` (${r.status})`); }
    catch (e) { pass(false, `page ${p}`); }
  }
  console.log(fail === 0 ? 'SMOKE ALL GREEN' : `SMOKE ${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
})();
