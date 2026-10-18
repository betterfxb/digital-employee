#!/usr/bin/env node
/**
 * S58 大数据量压测（独立运行，不入五套门禁）：
 * 前置备份 → 导入200作品+2000评论 → 测量导入与查询耗时 → 恢复备份（数据零残留）
 * 阈值1500ms（本地内存态实测应在百毫秒内，阈值防退化不误报）
 * 用法: node scripts/load-test.js [base]
 */
const base = process.argv[2] || 'http://localhost:3001';
let fail = 0;
const pass = (ok, name, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra}`); if (!ok) fail++; };
const get = async (p) => { const r = await fetch(base + p); return { s: r.status, j: await r.json().catch(() => null) }; };
const post = async (p, body) => { const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => null) }; };
const timed = async (label, fn, budget = 1500) => {
  const t0 = Date.now();
  const r = await fn();
  const ms = Date.now() - t0;
  pass(ms <= budget, label, ` ${ms}ms (预算${budget}ms)`);
  return { ms, r };
};

(async () => {
  console.log('== S58 压测开始 ==');
  // 0) 前置备份（收尾恢复，零残留）
  const bk = await get('/api/data/backup');
  if (bk.s !== 200 || !Array.isArray(bk.j.videos)) { console.log('FAIL 备份前置失败，中止'); process.exit(1); }

  // 1) 构造数据
  const vRows = ['标题,发布时间,播放,点赞,评论,转发'];
  for (let i = 0; i < 200; i++) vRows.push(`压测作品${i},${`10-${String((i % 28) + 1).padStart(2, '0')}`},${1000 + i * 7},${100 + i},${20 + (i % 30)},${5 + (i % 9)}`);
  const vCsv = vRows.join('\n');
  const cRows = ['昵称,内容,视频标题,时间,点赞'];
  const samples = ['这跑刀一单多少钱？怎么下单', '求带五杀，留个联系方式', '什么段位能接单', '包出红加多少钱', '零氪能跑吗', '新英雄强不强'];
  for (let i = 0; i < 2000; i++) cRows.push(`压测粉${i},${samples[i % samples.length]},压测作品${i % 200},${(i % 60) + 1}分钟前,${i % 25}`);
  const cCsv = cRows.join('\n');

  // 2) 导入计时（视频1批 + 评论10批×200）
  await timed('导入200作品(1批200行)', () => post('/api/import', { kind: 'videos', csv: vCsv }));
  let maxBatch = 0;
  for (let b = 0; b < 10; b++) {
    const part = [cRows[0], ...cRows.slice(1 + b * 200, 1 + (b + 1) * 200)].join('\n');
    const { ms } = await timed(`导入评论批次${b + 1}(200行)`, () => post('/api/import', { kind: 'comments', csv: part }));
    maxBatch = Math.max(maxBatch, ms);
  }

  // 3) 查询计时
  const all = await timed('全量评论查询(2000+条)', () => get('/api/comments?unread_only=0'));
  const nComments = all.r.j.items.length;
  pass(nComments >= 2000, '评论量达标', ` 实际${nComments}条`);
  await timed('关键词搜索', () => get('/api/comments?keyword=' + encodeURIComponent('多少钱')));
  await timed('意图筛选(高意向)', () => get('/api/comments?intent=' + encodeURIComponent('高意向')));
  await timed('作品列表(200+)', () => get('/api/videos'));
  await timed('看板聚合overview', () => get('/api/stats/overview'));
  await timed('热词统计(含快照)', () => get('/api/comments/keywords/hot'));
  await timed('台账列表', () => get('/api/follows'));
  await timed('高意向话术生成', () => post('/api/scripts/generate', { content: '这跑刀一单多少钱怎么下单', intent: '高意向', nick: '压测客户', product: '代跑' }));
  await timed('恢复备份(整库回滚)', () => post('/api/data/restore', { data: bk.j }), 3000);

  // 4) 恢复后核数
  const after = await get('/api/videos');
  pass(after.j.items.length === bk.j.videos.filter((v) => v.account_id === (bk.j.videos[0] || {}).account_id).length || after.j.items.length <= bk.j.videos.length, '恢复后数据回滚', ` 作品${after.j.items.length}条`);

  console.log(fail === 0 ? `LOAD-TEST ALL GREEN（最慢单批导入${maxBatch}ms）` : `LOAD-TEST ${fail} FAILED`);
  process.exit(fail === 0 ? 0 : 1);
})();
