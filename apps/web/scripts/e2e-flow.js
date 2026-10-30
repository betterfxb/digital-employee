/**
 * S148 全流程 E2E 走查（第六套门禁，自管服务器生命周期）：
 * 在临时 DATA_DIR 里以全新安装姿态起服务，一口气走完客户真实的一天：
 * 冷启动 → 首跑三连导入（作品/评论/名单+去重） → 未读/已读 → 登记线索 → 成交+成本+记联系
 * → 草稿收件箱 → 备份→验证→**写坏 local.json 重启自愈** → 400+评论体量完整性 → 健康读数。
 * 断言格式与其他套一致（PASS/FAIL 行），可 node scripts/e2e-flow.js 独立跑。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3022;
const BASE = `http://localhost:${PORT}`;
const TMP = 'D:/_project/.cache-tmp/e2e-data';
const WEB = 'D:/_project/apps/web';

let passN = 0; let failN = 0;
const logLines = [];
const pass = (cond, name) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); logLines.push(`${cond ? 'PASS' : 'FAIL'} ${name}`); cond ? passN++ : failN++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let server = null;

function startServer() {
  const child = spawn(process.execPath, [path.join(WEB, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', String(PORT)], {
    cwd: WEB, env: { ...process.env, DATA_DIR: TMP, NODE_OPTIONS: '--max-old-space-size=1536', NEXT_TELEMETRY_DISABLED: '1' }, windowsHide: true,
  });
  return child;
}
async function waitReady(limitSec = 60) {
  for (let i = 0; i < limitSec * 2; i++) {
    try { const r = await fetch(`${BASE}/api/license/status`, { signal: AbortSignal.timeout(3000) }); if (r.status === 200) return true; } catch { /* up */ }
    await sleep(500);
  }
  return false;
}
async function stopServer(child) {
  if (!child) return;
  child.kill();
  for (let i = 0; i < 20; i++) {
    try { const r = await fetch(`${BASE}/api/license/status`, { signal: AbortSignal.timeout(1500) }); if (!(await r.text())) continue; } catch { return; }
    await sleep(400);
  }
}
const G = async (u) => { const r = await fetch(BASE + u); return { s: r.status, j: await r.json().catch(() => null) }; };
const J = async (m, u, b) => { const r = await fetch(BASE + u, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) }; };

(async () => {
  // ── 全新数据域 ──
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  fs.mkdirSync(TMP, { recursive: true });

  server = startServer();
  if (!(await waitReady())) { console.log('FAIL e2e 服务器未能启动（全新数据域）'); process.exit(1); }
  pass(true, 'e2e 全新数据域冷启动');

  // ── A 冷启动读数 ──
  const lic = await G('/api/license/status');
  pass(lic.s === 200 && lic.j.mode === 'demo' && lic.j.valid === false, `A1 未导入license=demo锁定态（S30设计：mode=demo valid=false，UI激活门拦截API开放）（实:mode=${lic.j && lic.j.mode} valid=${lic.j && lic.j.valid}）`);
  const ov0 = await G('/api/stats/overview');
  pass(ov0.j.last_import_at === null, 'A2 新鲜度起点=从未导入');
  const st0 = await G('/api/settings');
  pass(st0.s === 200 && st0.j.weekly_goal === 0, 'A3 周目标默认0=不启用');
  const h0 = await G('/api/data/health');
  pass(h0.j.writable === true && h0.j.recovery === null && h0.j.backups.count === 0, 'A4 健康读数：可写/无自愈/零备份');
  const pages = ['/', '/today', '/dashboard', '/comments', '/messages', '/tasks', '/report', '/marketing', '/settings', '/auth', '/guide'];
  let pageAll = true; const pageDetail = [];
  for (const p of pages) {
    try {
      const r = await fetch(BASE + p, { signal: AbortSignal.timeout(8000) });
      if (p === '/' && r.status === 307) { pageDetail.push('/=307→auth✓'); continue; } // S1设计：根路径跳授权
      pageDetail.push(p + '=' + r.status);
      if (r.status !== 200) pageAll = false;
    } catch (e) { pageDetail.push(p + '=ERR'); pageAll = false; }
  }
  pass(pageAll, `A5 十一页面可达（${pageDetail.join(' ')}）`);

  // ── B 首跑三连导入 ──
  const iv = await J('POST', '/api/import', { kind: 'videos', csv: '作品标题\t发布日期\t播放量\t获赞数\nE2E爆仓实录\t2026-10-20\t1,234\t56\nE2E契约陪玩\t2026-10-21\t800\t40\nE2E上分日记\t2026-10-22\t600\t21' });
  pass(iv.s === 200 && iv.j.created === 3, 'B1 作品TSV+别名+千分位导入3条');
  const unBase = (await G('/api/comments?unread_only=1')).j.items.length; // 基线：新装自带示例评论（种子不算进断言）
  const ic = await J('POST', '/api/import', { kind: 'comments', csv: '昵称,内容,视频标题,时间,点赞\n甲哥,跑刀一单多少钱？怎么下单,E2E爆仓实录,2小时前,5\n乙姐,带带我怎么收费,E2E契约陪玩,1小时前,2\n丙哥,好帅啊,E2E上分日记,刚刚,9' });
  pass(ic.s === 200 && ic.j.created === 3, 'B2 评论导入3条');
  const cs = await G('/api/comments?unread_only=0');
  const cjia = (cs.j.items || []).find((x) => x.user_nick === '甲哥');
  pass(!!cjia && cjia.intent === '高意向' && (cjia.keywords || []).length > 0, 'B3 导入即自动分意图+提词（甲哥=高意向）');
  const il1 = await J('POST', '/api/import', { kind: 'leads', csv: '昵称,状态,金额,联系方式\n丁总,待回访,,wx_ding\n戊婆,已转化,888,\n丁总,待回访,,wx_ding' });
  pass(il1.s === 200 && il1.j.created === 2 && il1.j.skipped === 1, 'B4 名单导入：新建2+批内同名去重跳过1');
  const fl = await G('/api/follows');
  const ding = (fl.j.items || []).find((f) => f.peer_nick === '丁总');
  pass(!!ding && ding.source === 'import', 'B5 导入线索带归因排除标记');
  const ov1 = await G('/api/stats/overview');
  pass(typeof ov1.j.last_import_at === 'string', 'B6 导入成功即盖新鲜度时间戳');

  // ── C 线索处理链 ──
  const un = await G('/api/comments?unread_only=1');
  pass((un.j.items || []).length === unBase + 3, `C1 新导3条全部未读（基线${unBase}→实${(un.j.items || []).length}）`);
  const rd = await J('POST', '/api/comments/read', { ids: [cjia.id] });
  const un2 = await G('/api/comments?unread_only=1');
  pass(rd.s === 200 && (un2.j.items || []).length === unBase + 2, `C2 标记已读一条→未读恰减1（实${(un2.j.items || []).length} 期望${unBase + 2}）`);
  const vid = (await G('/api/videos')).j.items.find((v) => v.title === 'E2E爆仓实录');
  const nf = await J('POST', '/api/follows', { peer_nick: '甲哥', source_video_id: vid.id, next_remind_at: '明天 09:00' });
  pass(nf.s === 200 && nf.j.id, 'C3 评论→登记跟进');
  const p1 = await J('PATCH', `/api/follows/${nf.j.id}`, { status: '已转化', amount: 298 });
  pass(p1.s === 200 && p1.j.amount === 298 && p1.j.history[0].act.indexOf('已转化') > -1 && p1.j.history[0].act.indexOf('记成交 ¥298') > -1, 'C4 状态+金额一次PATCH双动作入史');
  const p2 = await J('PATCH', `/api/follows/${nf.j.id}`, { cost: 100 });
  pass(p2.s === 200 && p2.j.cost === 100, 'C5 成本记账（净利298-100成立）');
  const p3 = await J('PATCH', `/api/follows/${nf.j.id}`, { touch: '已联系' });
  pass(p3.s === 200 && p3.j.history[0].act.indexOf('记了联系：已联系') === 0, 'C6 一键记联系入史（提醒解铃入口）');
  const prof = await G('/api/leads/profile?nick=' + encodeURIComponent('甲哥'));
  pass(prof.s === 200 && prof.j.stats.done_n === 1 && prof.j.stats.amount_sum === 298, 'C7 360档案聚合成交数与金额');
  const bad = await J('PATCH', `/api/follows/${nf.j.id}`, { cost: -5 });
  pass(bad.s === 400, 'C8 负成本拒');

  // ── D 草稿收件箱 ──
  const dr = await J('POST', '/api/drafts', { comment_id: cjia.id, nick: '甲哥', text: '在的兄弟，跑刀按约定交付', via: 'E2E' });
  const dp = await G('/api/drafts?status=pending');
  pass(dr.s === 200 && (dp.j.items || []).length === 1, 'D1 回复草拟入箱待确认');
  const dd = await J('PATCH', `/api/drafts/${dr.j.id}`, { status: 'done' });
  const dp2 = await G('/api/drafts?status=pending');
  pass(dd.s === 200 && (dp2.j.items || []).length === 0, 'D2 标已处理→待确认清零');

  // ── E 备份→验证→自愈演练 ──
  const bk = await J('POST', '/api/data/backups/run', {});
  pass(bk.s === 200 && bk.j.created === true, 'E1 手动备份落盘');
  const bv = await G('/api/data/backups/verify');
  pass(bv.s === 200 && bv.j.sane === true && bv.j.lostTotal === 0, 'E2 备份验证：健全+零流失');
  const countsBefore = (await G('/api/data/health')).j.counts;
  fs.writeFileSync(path.join(TMP, 'local.json'), '{"accounts": [ {"broken', 'utf8');
  await stopServer(server);
  server = startServer();
  const up2 = await waitReady();
  pass(up2, 'E3 写坏local.json后重启成功');
  const h1 = await G('/api/data/health');
  pass(h1.j.recovery && /local\.json|\.json$/.test(h1.j.recovery.from), 'E4 自愈报恢复来源快照');
  const fl2 = await G('/api/follows');
  pass((fl2.j.items || []).find((f) => f.peer_nick === '甲哥' && f.amount === 298 && f.cost === 100) != null, 'E5 恢复后成交账目分毫未丢');
  const evs = fs.readdirSync(TMP).filter((x) => x.includes('corrupt'));
  pass(evs.length === 1, 'E6 损坏文件改名留证');
  const h2 = await G('/api/data/health');
  pass(h2.j.counts.follows === countsBefore.follows && h2.j.counts.comments === countsBefore.comments, 'E7 恢复计数=灾前计数');

  // ── F 体量完整性（列表不截断→聚合不虚小） ──
  const mkCsv = (b) => {
    let s = '昵称,内容,视频标题,点赞\n';
    for (let i = 0; i < 200; i++) s += `量${b}大${i},多少钱能跑,E2E爆仓实录,1\n`;
    return s;
  };
  const totalMid = (await G('/api/comments?unread_only=0')).j.items.length;
  const ib1 = await J('POST', '/api/import', { kind: 'comments', csv: mkCsv(1) });
  const ib2 = await J('POST', '/api/import', { kind: 'comments', csv: mkCsv(2) });
  const all = await G('/api/comments?unread_only=0');
  pass(ib1.s === 200 && ib2.s === 200 && (all.j.items || []).length === totalMid + 400, `F1 两批200条全量返回不截断（${totalMid}+400=实${(all.j.items || []).length}）`);
  const kw = await G('/api/comments/keywords/hot');
  pass(kw.s === 200, 'F2 热词聚合端点健康');

  // ── G 收尾读数 ──
  const wg = await J('PATCH', '/api/settings', { weekly_goal: 5000 });
  pass(wg.s === 200 && wg.j.weekly_goal === 5000, 'G1 周目标设置生效');
  const segs = await G('/api/marketing/segments');
  pass(segs.s === 200 && (segs.j.segments || []).length === 5, 'G2 智能客群五群在位');
  const sn = await J('POST', '/api/report/snapshot', {});
  pass(sn.s === 200, 'G3 日报快照生成');
  const fin = await G('/api/data/health');
  pass(fin.j.counts.follows >= 2 && fin.j.counts.videos === 3 && fin.j.backups.count >= 1, 'G4 终态健康读数吻合');

  await stopServer(server);
  console.log(failN === 0 ? `E2E ALL GREEN (${passN})` : `E2E ${failN} FAILED (${passN} pass)`);
  logLines.push(failN === 0 ? `E2E ALL GREEN (${passN})` : `E2E ${failN} FAILED (${passN} pass)`);
  fs.writeFileSync('D:/_project/.cache-tmp/e2e-last.log', logLines.join('\n'), 'utf8');
  process.exit(failN === 0 ? 0 : 1);
})().catch(async (e) => { console.log('FAIL e2e 脚本异常', e.message); if (server) server.kill(); process.exit(1); });
