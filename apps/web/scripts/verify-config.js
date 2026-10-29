/** 配置不变式校验（无依赖，node直跑）：范围/联动/P0红线，失败即非0退出 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'config');
const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const files = {
  app: read('app.config.ts'),
  auth: read('auth.config.ts'),
  stats: read('stats.config.ts'),
  comments: read('comments.config.ts'),
  assist: read('assist.config.ts'),
  ui: read('ui.config.ts'),
  tasks: read('tasks.config.ts'),
  settings: read('settings.config.ts'),
};
let fail = 0;
const num = (src, key) => { const m = src.match(new RegExp(key + '\\s*:\\s*(\\d+)')); return m ? Number(m[1]) : NaN; };
const check = (ok, name) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) fail++; };

// 联动：轮询超时必须大于二维码过期
check(num(files.auth, 'pollTimeoutSec') > num(files.auth, 'qrcodeExpireSec'), 'auth.pollTimeoutSec > qrcodeExpireSec');
// 范围
check(num(files.auth, 'pollIntervalMs') >= 1000 && num(files.auth, 'pollIntervalMs') <= 3000, 'auth.pollIntervalMs 1000-3000');
check(num(files.auth, 'refreshLockTtlSec') >= 3 && num(files.auth, 'refreshLockTtlSec') <= 10, 'auth.refreshLockTtlSec 3-10');
check(num(files.comments, 'batchReadMax') >= 1 && num(files.comments, 'batchReadMax') <= 200, 'comments.batchReadMax 1-200');
check(num(files.comments, 'pageSize') >= 10 && num(files.comments, 'pageSize') <= 50, 'comments.pageSize 10-50');
check(num(files.stats, 'trendBatchMax') >= 1 && num(files.stats, 'trendBatchMax') <= 20, 'stats.trendBatchMax 1-20');
check(num(files.stats, 'manualSyncCooldownSec') >= 30 && num(files.stats, 'manualSyncCooldownSec') <= 300, 'stats.manualSyncCooldownSec 30-300');
check(num(files.tasks, 'maxConcurrentTasks') >= 1 && num(files.tasks, 'maxConcurrentTasks') <= 3, 'tasks.maxConcurrentTasks 1-3');
check(num(files.tasks, 'switchIntervalMin') >= 3 && num(files.tasks, 'switchIntervalMin') <= 30, 'tasks.switchIntervalMin 3-30');
check(num(files.tasks, 'groupFollowIntervalMin') >= 3 && num(files.tasks, 'groupFollowIntervalMin') <= 30, 'tasks.groupFollowIntervalMin 3-30');
check(num(files.tasks, 'followBatchSize') >= 1 && num(files.tasks, 'followBatchSize') <= 5, 'tasks.followBatchSize 1-5');
check(num(files.tasks, 'dailySyncCap') >= 1 && num(files.tasks, 'dailySyncCap') <= 48, 'tasks.dailySyncCap 1-48');
check(num(files.tasks, 'maxRetries') >= 0 && num(files.tasks, 'maxRetries') <= 5, 'tasks.maxRetries 0-5');
check(num(files.tasks, 'fuseFailThreshold') >= 3 && num(files.tasks, 'fuseFailThreshold') <= 10, 'tasks.fuseFailThreshold 3-10');
check(num(files.assist, 'defaultRemindHour') >= 0 && num(files.assist, 'defaultRemindHour') <= 23, 'assist.defaultRemindHour 0-23');
// 枚举完整性
check(files.comments.includes("'垃圾'") && files.comments.includes("'默认'"), 'comments.intentOptions/intentColors 含垃圾+默认');
check(files.assist.includes("'待回访'"), 'assist.followStatuses 含待回访');
// P0红线：私信总开关必须关闭
check(/imEnabled:\s*false/.test(files.app), 'P0红线 app.imEnabled=false');

check(num(files.settings, 'fontSizeStep') >= 1, 'settings字号步长≥1');
check(num(files.settings, 'fontSizeMin') < num(files.settings, 'fontSizeDefault') && num(files.settings, 'fontSizeDefault') < num(files.settings, 'fontSizeMax'), 'settings字号min<默认<max');
check(num(files.settings, 'fontZoomBase') <= num(files.settings, 'fontSizeDefault'), 'settings zoom基准≤默认字号（S111解耦：默认即带全局放大）');
check(num(files.settings, 'shopNameMinLen') < num(files.settings, 'shopNameMaxLen'), 'settings店名min<max');
check(num(files.settings, 'passwordMinLen') >= 6, 'settings密码长≥6');
check(files.settings.includes('#1A1A18'), 'settings默认主题在候选内');
// 路由审计：无参GET + 无force-dynamic = 构建期静态快照，内存态读接口必挂（S12教训）
const apiDir = path.join(__dirname, '..', 'app', 'api');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
walk(apiDir).filter((f) => f.endsWith('route.ts')).forEach((f) => {
  const src = fs.readFileSync(f, 'utf8');
  const staticGet = /export async function GET\(\)/.test(src) && !src.includes('force-dynamic');
  check(!staticGet, `route dynamic ${path.relative(apiDir, f)}`);
});

console.log(fail === 0 ? 'VERIFY ALL GREEN' : `VERIFY ${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
