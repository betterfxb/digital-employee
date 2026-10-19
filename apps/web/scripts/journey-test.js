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
    // 断言口径（S81防污染）：只数种子行（非imp-前缀），历史旅程导入残留不影响隔离判定
    pass(v2.items.filter((x) => !String(x.id).startsWith('imp-')).length === 3 && v2.items.some((v) => v.id === 'v3') && me2.id === 'acc_002' && v1.items.filter((x) => !String(x.id).startsWith('imp-')).length === 2 && v1.items.every((v) => v.id !== 'v3'), 'J3 切号隔离往返');
  } catch (e) { pass(false, 'J3 切号隔离往返', ` ${e.message}`); }
  // J4 垃圾意图返回处理建议而非话术
  try {
    const g = await get('/api/scripts/templates?intent=%E5%9E%83%E5%9C%BE');
    pass(g.items.length === 1 && g.items[0].scene === '处理建议', 'J4 垃圾意图建议');
  } catch (e) { pass(false, 'J4 垃圾意图建议', ` ${e.message}`); }
  // J5 预真机真数据闭环：授权绑定→导入→意图分类→高意向话术→跟进台账→回评（S23b）
  try {
    const b1 = await fetch(base + '/api/auth/douyin/authorize?nick=' + encodeURIComponent('旅程绑定'), { redirect: 'manual' });
    const l1 = b1.headers.get('location') || '';
    const b2 = await fetch(l1.startsWith('http') ? l1 : base + l1, { redirect: 'manual' });
    const accs = await get('/api/accounts');
    const bound = accs.items.find((x) => x.nickname === '旅程绑定');
    if (!bound) throw new Error('绑定账号缺失');
    await send('POST', '/api/accounts/switch', { id: bound.id });
    await send('POST', '/api/import', { kind: 'videos', csv: '标题,发布时间,播放,点赞,评论,转发\n旅程真机作品,10-10,2000,150,20,8' });
    await send('POST', '/api/import', { kind: 'comments', csv: '昵称,内容,视频标题,时间,点赞\n旅程粉,这跑刀怎么下单？多少钱,旅程真机作品,10分钟前,3' });
    const vids = await get('/api/videos');
    const vv = vids.items.find((v) => v.title === '旅程真机作品');
    const list = await get('/api/comments?unread_only=0');
    const c = list.items.find((x) => x.user_nick === '旅程粉');
    const tpl = await get('/api/scripts/templates?intent=' + encodeURIComponent('高意向'));
    const fol = await send('POST', '/api/follows', { peer_nick: '旅程粉', source_video_id: vv ? vv.id : 'nope' });
    const rep = await send('POST', `/api/comments/${c ? c.id : 'nope'}/replies`, { content: 'J5回评' });
    const reps = c ? await get(`/api/comments/${c.id}/replies`) : { items: [] };
    await send('POST', '/api/accounts/switch', { id: 'acc_001' });
    pass(b2.status === 302 && !!vv && !!c && c.intent === '高意向' && tpl.items.length > 0 && tpl.items[0].scene !== '处理建议' && fol.j.status === '待回访' && rep.s === 200 && reps.items.some((x) => x.content === 'J5回评'), 'J5 预真机真数据闭环');
  } catch (e) { pass(false, 'J5 预真机真数据闭环', ` ${e.message}`); }
  // J6 数据管理闭环（S37/S38）：备份→无确认词拒→清空→空→恢复→同口径一致（S47修：对比当前账号before/after而非全量）
  try {
    const bk = await fetch(base + '/api/data/backup').then((r) => r.json());
    if (!Array.isArray(bk.accounts) || !Array.isArray(bk.videos)) throw new Error('backup结构异常');
    const before = (await get('/api/videos')).items.length;
    const cl0 = await send('POST', '/api/data/clear', {});
    if (cl0.s !== 400) throw new Error('无确认词应400');
    const cl = await send('POST', '/api/data/clear', { confirm: '清空' });
    if (!cl.j.cleared) throw new Error('清空失败');
    const v0 = await get('/api/videos');
    if (v0.items.length !== 0) throw new Error('清空后应无作品');
    const rt = await send('POST', '/api/data/restore', { data: bk });
    if (!rt.j.restored) throw new Error('恢复失败');
    const after = (await get('/api/videos')).items.length;
    if (after !== before) throw new Error(`恢复后作品数不一致 before=${before} after=${after}`);
    pass(true, 'J6 备份→清空→恢复闭环');
  } catch (e) { pass(false, 'J6 备份→清空→恢复闭环', ` ${e.message}`); }
  // J7 批量操作底层链（S34）：多条意图PATCH→批量已读→批量入台账
  try {
    const cs = await get('/api/comments?unread_only=0');
    const pick = cs.items.slice(0, 3);
    if (pick.length < 2) throw new Error('评论不足');
    for (const c of pick) await send('PATCH', `/api/comments/${c.id}`, { intent: '咨询' });
    const rd = await send('POST', '/api/comments/read', { ids: pick.map((x) => x.id) });
    if (!rd.j.updated) throw new Error('批量已读失败');
    for (const c of pick) await send('POST', '/api/follows', { peer_nick: c.user_nick, source_video_id: c.video_id });
    const fl = await get('/api/follows');
    const okAll = pick.every((c) => fl.items.some((f) => f.peer_nick === c.user_nick));
    if (!okAll) throw new Error('批量入台账缺失');
    pass(true, 'J7 批量意图→已读→入台账');
  } catch (e) { pass(false, 'J7 批量意图→已读→入台账', ` ${e.message}`); }
  // J8 自动化参数（S75/S76）：越界钳制+调度器回声+三重门状态+恢复默认（自清理，不留脏配置）
  try {
    const pv = await send('PATCH', '/api/settings', { auto_config: { sync_interval_min: 999, reply_tone: '怪' } });
    if (pv.s !== 200 || pv.j.auto_config.sync_interval_min !== 240) throw new Error('越界未钳制240');
    if (pv.j.auto_config.reply_tone !== '亲切') throw new Error('坏枚举未回退亲切');
    const ts = await get('/api/tasks/status');
    if (!ts.auto_config || ts.auto_config.sync_interval_min !== 240) throw new Error('调度器未回声钳制值');
    if (ts.auto_reply.ready !== false || !ts.auto_reply.gate.includes('live')) throw new Error('mock态三重门应卡在live未就绪');
    const rst = await send('PATCH', '/api/settings', { auto_config: {} });
    if (rst.j.auto_config.sync_interval_min !== 30 || rst.j.auto_config.reply_daily_cap !== 12) throw new Error('恢复默认失败');
    pass(true, 'J8 自动化钳制+三重门+回默认');
  } catch (e) { pass(false, 'J8 自动化钳制与三重门', ` ${e.message}`); }
  // J9 S79/S80 导入容错与备份闭环：TSV建→CSV改（同规范列跨格式幂等）→备份快照含新值→preview可用
  try {
    const tagT = 'J9旅程作品' + tag;
    const r1 = await send('POST', '/api/import', { kind: 'videos', csv: `作品标题\t发布日期\t播放量\t获赞数\n${tagT}\t2026年10月16日\t100\t5` });
    if (r1.j.created + r1.j.updated !== 1) throw new Error('TSV建失败');
    const vidsA = await get('/api/videos');
    const rowA = vidsA.items.find((v) => v.title === tagT);
    if (!rowA || rowA.publish_time !== '10-16') throw new Error('中文日期未归一10-16');
    const r2 = await send('POST', '/api/import', { kind: 'videos', csv: `标题,发布时间,播放,点赞,评论,转发\n${tagT},10-16,300,9,0,0` });
    if (r2.j.updated !== 1 || r2.j.created !== 0) throw new Error('跨格式未走更新');
    const vidsB = await get('/api/videos');
    const rowB = vidsB.items.find((v) => v.title === tagT);
    if (!rowB || rowB.play !== 300) throw new Error('更新值未生效');
    const bk = await send('POST', '/api/data/backups/run', {});
    if (!bk.j.created) throw new Error('备份未落盘');
    const snapTxt = await (await fetch(base + '/api/data/backups/download?name=' + encodeURIComponent(bk.j.entry.name))).text();
    const snap = JSON.parse(snapTxt);
    const inSnap = (snap.videos || []).find((v) => v.title === tagT);
    if (!inSnap || inSnap.play !== 300) throw new Error('快照缺新值（备份非实时）');
    const pv = await send('POST', '/api/data/restore', { data: snap, preview: true });
    if (!pv.j.preview || pv.j.videos < 1) throw new Error('快照preview不可用');
    pass(true, 'J9 跨格式幂等+备份快照闭环');
  } catch (e) { pass(false, 'J9 跨格式幂等+备份闭环', ` ${e.message}`); }
  // J10 智能营销（S83-87）：回评位次进实验桶（before/after差值防污染）；活动创建→勾选→复盘数→删除自清理
  try {
    const listC = await get('/api/comments?unread_only=0');
    const cm = listC.items[0];
    const before = (await get('/api/marketing/experiments')).buckets.find((b) => b.variant === 3).used;
    await send('POST', `/api/comments/${cm.id}/replies`, { content: 'J10位次回评' + tag, variant: 3 });
    const after = (await get('/api/marketing/experiments')).buckets.find((b) => b.variant === 3).used;
    if (after !== before + 1) throw new Error(`位次3未+1（${before}->${after}）`);
    const camp = await send('POST', '/api/campaigns', { name: 'J10旅程活动' + tag, start_at: new Date(Date.now() - 86400000).toISOString().slice(0, 10), end_at: new Date(Date.now() + 86400000).toISOString().slice(0, 10), keyword: '价格', checklist: [{ text: '动作一', done: false }, { text: '动作二', done: false }] });
    if (!camp.j.id) throw new Error('活动创建失败');
    const ls1 = (await get('/api/campaigns')).items.find((x) => x.id === camp.j.id);
    if (!ls1 || ls1.status !== '进行中' || ls1.progress !== 0) throw new Error('活动初始复盘态不对');
    const up = await send('PATCH', `/api/campaigns/${camp.j.id}`, { checklist: [{ text: '动作一', done: true }, { text: '动作二', done: true }] });
    if (up.j.checklist.filter((x) => x.done).length !== 2) throw new Error('勾选未持久');
    await send('DELETE', `/api/campaigns/${camp.j.id}`, undefined);
    const ls2 = (await get('/api/campaigns')).items;
    if (ls2.some((x) => x.id === camp.j.id)) throw new Error('删除未生效');
    pass(true, 'J10 位次实验差值+活动生命周期');
  } catch (e) { pass(false, 'J10 位次实验+活动生命周期', ` ${e.message}`); }
  // J11 保存视图跨接口回声（S93）：存→settings回显→坏类型400不动原值→清空复原（自清理）
  try {
    const v1 = await send('PATCH', '/api/settings', { comment_views: [{ name: 'J11视图', kw: '价格', intent: '', unreadOnly: false }] });
    if (v1.s !== 200 || !v1.j.comment_views || v1.j.comment_views[0].kw !== '价格') throw new Error('存视图未回声');
    const st = await get('/api/settings');
    if (!st.comment_views || !st.comment_views.some((x) => x.name === 'J11视图')) throw new Error('GET不见视图');
    const vbad = await send('PATCH', '/api/settings', { comment_views: 42 });
    if (vbad.s !== 400) throw new Error('非数组未拒');
    const st2 = await get('/api/settings');
    if (!st2.comment_views.some((x) => x.name === 'J11视图')) throw new Error('坏请求动了原值');
    await send('PATCH', '/api/settings', { comment_views: [] });
    const st3 = await get('/api/settings');
    if (st3.comment_views.length !== 0) throw new Error('清空未复原');
    pass(true, 'J11 视图回声+坏请求不动原值+复原');
  } catch (e) { pass(false, 'J11 视图回声与复原', ` ${e.message}`); }
  console.log(fail === 0 ? 'JOURNEY ALL GREEN' : `JOURNEY ${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
})();
