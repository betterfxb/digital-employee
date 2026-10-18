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
  try { const { s, j } = await get('/api/settings'); pass(s === 200 && j.font_size === 14 && j.theme_color === '#1A1A18' && !!j.shop_name, 'GET settings defaults'); } catch (e) { pass(false, 'GET settings defaults'); }
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
    pass(iv1.s === 200 && iv2.s === 200 && iv1.j.created + iv1.j.updated === 1 && iv2.j.created + iv2.j.updated === 1 && vids.j.items.length === 1 && vids.j.items[0].title === '冒烟真机作品', 'S23 import video upsert幂等');
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
