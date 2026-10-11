/** 用户旅程测试（需先起服务）：跨接口状态流转断言，补冒烟单点检查之间的空白 */
const base = process.env.SMOKE_BASE || 'http://localhost:3001';
let fail = 0;
const pass = (ok, name, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra}`); if (!ok) fail++; };
const get = async (p) => (await fetch(base + p)).json();
const send = async (m, p, body) => { const r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => null) }; };
const tag = Date.now().toString(36);
(async () => {
  // J1 标已读→改意图→登记跟进→台账可见（含提醒默认值）
  try {
    const list = await get('/api/comments?unread_only=0');
    const c = list.items[0];
    const intent = await send('PATCH', `/api/comments/${c.id}`, { intent: '咨询' });
    const read = await send('POST', '/api/comments/read', { ids: [c.id] });
    const nick = `旅程${tag}`;
    const f = await send('POST', '/api/follows', { peer_nick: nick, source_video_id: c.video_id });
    const back = await get(`/api/follows?status=${encodeURIComponent('待回访')}`);
    pass(intent.s === 200 && read.j.updated === 1 && !!f.j.id && back.items.some((x) => x.peer_nick === nick) && f.j.next_remind_at.includes('18:00'), 'J1 评论→跟进闭环');
  } catch (e) { pass(false, 'J1 评论→跟进闭环', ` ${e.message}`); }
  // J2 任务暂停→列表可见→恢复→列表可见
  try {
    await send('POST', '/api/tasks/control', { type: 'followRemind', action: 'pause' });
    const a = await get('/api/tasks');
    await send('POST', '/api/tasks/control', { type: 'followRemind', action: 'resume' });
    const b = await get('/api/tasks');
    pass(a.items.find((t) => t.type === 'followRemind').paused === true && b.items.find((t) => t.type === 'followRemind').paused === false, 'J2 任务启停回读');
  } catch (e) { pass(false, 'J2 任务启停回读', ` ${e.message}`); }
  // J3 切号→数据隔离→切回
  try {
    await send('POST', '/api/accounts/switch', { id: 'acc_002' });
    const v2 = await get('/api/videos');
    const me2 = await get('/api/accounts/me');
    await send('POST', '/api/accounts/switch', { id: 'acc_001' });
    const v1 = await get('/api/videos');
    pass(v2.items.length === 3 && v2.items.some((v) => v.id === 'v3') && me2.id === 'acc_002' && v1.items.length === 2 && v1.items.every((v) => v.id !== 'v3'), 'J3 切号隔离往返');
  } catch (e) { pass(false, 'J3 切号隔离往返', ` ${e.message}`); }
  // J4 垃圾意图返回处理建议而非话术
  try {
    const g = await get('/api/scripts/templates?intent=%E5%9E%83%E5%9C%BE');
    pass(g.items.length === 1 && g.items[0].scene === '处理建议', 'J4 垃圾意图建议');
  } catch (e) { pass(false, 'J4 垃圾意图建议', ` ${e.message}`); }
  console.log(fail === 0 ? 'JOURNEY ALL GREEN' : `JOURNEY ${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
})();
