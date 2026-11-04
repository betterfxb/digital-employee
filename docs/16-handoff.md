# 16 · 项目交接文档（给接手的 Agent）

> 交接日期：2026-11-05 / 交接时状态：**v1.16.1 已封包+tag、六套门禁全绿、工作区干净**
> 读法：本文件=全景+纪律+现状；`MEMORY.md`=项目记忆（历史脉络）；`docs/00-15`=各专题深读。
> 口径：本文所有"实测"均为 2026-11-05 当天在本机实跑核对，不是转述。

---

## 0. 十分钟上手（先读这节就能干活）

**项目一句话**：抖音获客中台——Electron 桌面版（Windows NSIS 安装包）+ 离线机器码授权，服务端是 Next.js 14 单体（只监听 127.0.0.1）。中台主体（导入→看板→意向→话术→台账→报告→营销→备份）**今天就是生产可用**；"扫码绑定/自动同步/自动回复真发送"三层卡在抖音开放平台入驻资质上，代码 100% 就绪，密钥到手当天切真。

**接手后按场景行动：**

| 你要做什么 | 怎么做 |
|---|---|
| 继续开发新功能 | 先读 §5 铁律 → §6 门禁 → 在 `apps/web` 改码 → 跑门禁 → 按 §7 封包（功能包必 bump 版本） |
| 给客户发新版 | §7 封包 SOP 逐步走，别跳步；发前核对 `docs/14` 的"当前应发版本" |
| 客户问入驻/扫码 | `docs/15`（入驻指南）+ §9（客户已踩的坑：个人认证不能建应用） |
| 客户问功能/话术 | `docs/14`（交付手册：20分钟剧本 + FAQ 应答表） |
| 只想了解项目 | 本文件 §1-§4 + `docs/00-overview.md` |

**红线速览（违反=事故，详见 §5）**：不爬虫/RPA/cookie/绕检测；自动外呼与批量主动私信**永不做**；接口没有的数据不展示；license 私钥永不进仓；构建必须串行；用户文件绝不入库。

---

## 1. 项目全景

### 1.1 交付形态
- **产品**：`获客中台-Setup-x.y.z.exe`（NSIS，约 80MB，按用户装、无需管理员），桌面/开始菜单快捷方式「获客中台」。
- **授权**：离线机器码绑定（CPU/磁盘/网卡 MAC 三因子哈希，命中 ≥2 认）+ Ed25519 签名 license + 每客户唯一水印 `wl-xxxxxxxx`（溯源）。
- **分档**：`--tier pro`（全开）/ `--tier basic`（七页面白名单，锁的功能可见但锁定=ProLock 引导升级）。
- **数据**：全部在客户本机（`%APPDATA%\获客中台\data\`），不上传任何第三方。

### 1.2 功能模块（页面级）
| 路由 | 功能 |
|---|---|
| `/auth` | 扫码授权页（真二维码+弹窗流）、账号列表、操作日志、授权状态卡 |
| `/dashboard` | 看板：指标条、作品表+趋势、带货榜、关键词钱表、漏斗、心跳曲线、导入向导（两步预览确认制） |
| `/today` | 今日工作台（纯客户端聚合已有端点，红线：不造数据） |
| `/comments` | 评论三栏工作台：意向分类、未读、关键词、保存视图、快捷键 j/k/e/1/2/3/c |
| `/messages` | 私信辅助：话术库+跟进台账（**占位态**，`imEnabled=false`，见 §5 红线） |
| `/tasks` | 任务中心：同步/自动回复开关、自动化参数（12 旋钮） |
| `/marketing` | 智能营销：机会雷达、智能客群、话术 A/B、活动方案（只出主意，不触达） |
| `/report` | 经营报告：日/周报快照、月度复盘、分享图（canvas 长图） |
| `/settings` | 系统设置：授权/备份/恢复/健康自检/密码/自动化/诊断包 |
| `/guide` | 客户指南 FAQ |

### 1.3 五态清单（对客户说什么、不说什么）
| 能力 | 状态 | 依赖 |
|---|---|---|
| CSV 导入真数据→全链路 | ✅ **今天生产可用** | 无 |
| 看板/意向/话术/台账/报告/营销/备份/发证 | ✅ 真实运转（吃导入数据） | 无 |
| 扫码绑定（真官方 OAuth 弹窗） | ⛔ 代码就绪，等 client_key | 开放平台入驻（§9） |
| T+1 自动同步（免手工导 CSV） | ⛔ 同上 | 同上 |
| 评论自动回复**真发送** | ⛔ 三重门：live通道+能力审核+用户开关 | 第二批能力审核 |
| 模拟登录/爬网页/cookie 操作 | ❌ **永不做**（红线） | — |

---

## 2. 交接时实况快照（2026-11-05 实测）

### 2.1 版本与仓库
| 项 | 值 |
|---|---|
| 当前版本 | **1.16.1**（源：`apps/desktop/package.json`，侧栏底部 vX.Y.Z 与之一致） |
| HEAD | `9216cfa` "S153 close: v1.16.1 hotfix package sealed + tagged" |
| 远端 | `git@github.com:betterfxb/digital-employee.git`（main，已同步，unpushed=0） |
| Tags | 16 个：v1.1.0…v1.16.1（**无 v1.7.1/v1.8.0——从未出货，内容并入 v1.9.0，属正常**） |
| 跟踪文件 | 193 个：apps 167 / docs 16（+本文件=17）/ root 4 / screenshots 4 / prisma 1 / prototype 1 |
| 工作区 | 干净，**唯一游离物：根目录 `monkey-moto.html`**（untracked+unignored=漏网，用户文件，见 §12） |
| dist | `apps/desktop/dist/获客中台-Setup-1.16.1.exe`（+blockmap+win-unpacked），**唯一包，旧版已清** |
| BUILD_ID | `BwCGmQFsh9ieDwuFj2UI6`（`apps/web/.next` 与 `resources/standalone` 一致=包内即当前码） |

### 2.2 六套门禁（2026-11-05 实跑，全绿）
| 套件 | 命令 | 前置 | 计数 |
|---|---|---|---|
| crypto 真单测 | `pnpm test`（tsc 编译真模块） | 无 | **144/0** |
| verify 配置不变式 | `pnpm verify` | 无 | **92/0** |
| smoke 全链路冒烟 | `pnpm smoke` | 需服务 + `SMOKE_BASE` | **116/0** |
| journey 用户旅程 | `pnpm test:journey` | 需服务 + `SMOKE_BASE` | **11/0** |
| port 开放平台映射单测 | `node scripts/port-test.js` | 无 | **9/0** |
| e2e 全流程走查 | `npm run e2e` | **自管服务，必须串行独占 3022** | **35/0** |

> 计数格式 `PASS/FAIL`。历史每批封包前跑**双轮全绿**（§7 步骤 4）。

### 2.3 运行环境（本机实测）
| 项 | 值 |
|---|---|
| Node / pnpm | v20.5.0 / 12.4.1 |
| 端口 3021 | **本项目验证服务在跑**（`node next start -p 3021`，PID 56912） |
| 端口 3001 | 用户 AnythingLLM 领地——**勿杀其进程、勿依赖 3001**（package.json 里 dev/start 写的是 3001，实际一律 `-p 3021` 覆盖 + `SMOKE_BASE=http://localhost:3021`） |
| 端口 3022 | e2e-flow 专用临时服务（自起自停，**跑 e2e 时不能有第二个实例**） |
| 内存 | freeGB 常在 4–8 波动；**next build 瞬态崩溃是常态**（attempt1 崩属预期，循环重试即可） |
| `.env.local` | 只有 `TOKEN_MASTER_KEY`（64字符）与 `DOUYIN_MODE=mock` 两个键；真实密钥永不进仓 |
| 私钥 | `apps/web/data/license_key.pem`——**发证专用，永不出本机、永不提交**；公钥随包分发 |

---

## 3. 仓库地图

```
D:\_project\
├─ MEMORY.md              项目记忆（给后续 Agent 看，勿删；行3是追加式状态史）
├─ README.md              运行说明（dev/门禁命令）
├─ docker-compose.yml     P0 单服务壳（PG/Redis 未接，见 §12 backlog）
├─ NOTICE                 空文件（0字节，已 ignore，勿动）
├─ monkey-moto.html       ⚠️ 用户游离文件（untracked+unignored，勿提交勿删）
├─ docs/                  00-16 号文档（见 §11 索引）
├─ prisma/schema.prisma   PG 目标态表结构（未执行 migrate，现走内存 repo）
├─ prototype/index.html   早期静态原型（仅留档，已被 app 替代）
├─ screenshots/           4 张参考截图（跟踪）
├─ apps/
│  ├─ web/                ★ 主战场：Next.js 14 单体
│  │  ├─ app/             12 路由页 + ~70 个 API Route Handler
│  │  ├─ components/      ActivationGate/AntdProvider/CommandPalette/ImportWizard/ProLock/Shell/TaskBar
│  │  ├─ config/          11 个配置文件（类型即文档，UI 禁硬编码）
│  │  ├─ lib/             50+ 模块：repo抽象/store/localData/douyinPort/liveSync/autoReply/license/…
│  │  ├─ scripts/         10 个脚本：6套门禁 + license-gen + live-switch + live-check + load-test
│  │  ├─ data/            ⚠️ gitignored：local.json/备份/license私钥/公钥（运行时与发证材料）
│  │  ├─ .env.local       ⚠️ gitignored：TOKEN_MASTER_KEY、DOUYIN_MODE
│  │  └─ .npmrc           node-linker=hoisted（Windows 打包 EPERM 的解，勿改回）
│  └─ desktop/            Electron 壳
│     ├─ main.js          启动序：选空闲端口→起 standalone→探活→开窗；托盘/自启/崩溃日志/窗口记忆
│     ├─ package.json     ★ 版本源（当前 1.16.1）+ electron-builder 配置
│     ├─ scripts/         build-web.js（web构建→拷 standalone+公钥）、make-icon.js
│     ├─ resources/       ⚠️ gitignored：standalone/（打包产物）、icon.ico、license_pub.pem
│     └─ dist/            ⚠️ gitignored：Setup exe + win-unpacked
└─ .cache-tmp/            ⚠️ gitignored：Agent 临时脚本区（发布链脚本在这，见 §7 附录）
```

**绝不入库清单**（用户文件/他项目，已 ignore 或需保持 ignore）：`xingzhou-site*/`、`easel-*`、`starboat-shorts/`、`preview/`、`rehearsal4/`、根目录全部 `*.png`、`NOTICE`、`apps/web/data/`、`.env.local`、`.cache-tmp/`。**提交永远显式列路径**，禁 `git add -A`。

---

## 4. 技术架构

### 4.1 服务端（apps/web）
```
UI(Page/Component) → API Route Handler（鉴权/校验/分页/trace_id）→ Service 层（去重/已读/意图）
                    → IDouyinPort 接口（mock | live 双实现）    → lib/repo.ts（Repository 抽象）
                                                            → lib/store.ts（内存态）+ localData.ts（local.json 原子写）
```
- **Next.js 14 App Router + React 18 + TS strict + antd 6**（AntdProvider 保羊皮纸主题）。
- **持久化**：账号/导入数据/token密文/台账/回评/竞品/设置等业务集合 → `data/local.json`（原子写，重启不丢）；授权状态机与操作日志仅内存（可接受）。
- **`DATA_BACKEND=memory|prisma`**：当前 memory；`prisma/schema.prisma` 是目标态，等 DB 环境才 migrate。
- **mock/live 双态**：`DOUYIN_MODE=mock`（默认，占位密钥全流程跑通）/ `live`（真实开放平台）。切换只改 env，代码同一条路径。
- **调度器** `lib/scheduler.ts`：进程内单例（globalThis 防热更新重复挂载），只调度同步类任务；mock 只入队，live 真拉。
- **自动回复** `lib/autoReply.ts`：三重门（live + 官方能力 env + 用户开关），缺一只起草进草稿箱不外发。

### 4.2 桌面壳（apps/desktop）
- 启动序：单实例锁 → 选空闲端口（**用 `http` 模块，Electron 内置 `net` 会阴影 Node 的 net**）→ 起 `resources/standalone` 内嵌 Next（`ELECTRON_RUN_AS_NODE=1`，只听 127.0.0.1）→ 探活 → 开窗。
- 数据在 `%APPDATA%\获客中台\data\`（Program Files 非管理员不可写）；主密钥首启随机生成于 `.master_key`。
- 关窗=hide 进托盘常驻（提醒/起草/备份不断），托盘菜单「退出」才真退出并杀内嵌服务。
- 开机自启：真源在 `settings.desktop_autostart`，主进程每 30s 轮读执行 `setLoginItemSettings`（仅 `app.isPackaged`）。

### 4.3 授权链路
```
license-gen.js issue --customer X --days 0|365 --bind "机器码" --tier pro|basic
  → 生成 data/license.license（Ed25519 签名，canonical=key排序JSON，与 lib/license.ts 同算法）
  → 客户激活门导入 → POST /api/license/import → 验签+机绑命中 → 落盘
  → 无 license/demo → ActivationGate 锁核心 UI（API 保持开放，供导入与自动化）
```
水印：`next.config.js` 构建期注入 `X-Vendor-Watermark`（license.watermark > WATERMARK_ID env > `wl-demo0000`）。

### 4.4 数据模型要点（详见 docs/03）
- 分页统一 `{items,next_cursor,has_more}`；错误带 `trace_id`；评论 keyset 分页（不用 offset）；`comment_id` 幂等。
- **铁律：读内存态的 GET 必须 `force-dynamic`**（S12——无参 GET 会被构建期静态快照，verify-config 含路由审计）。

---

## 5. 铁律（违反必出事，逐条都有血泪史）

### 5.1 构建串行铁律（最高优先级）
1. **先清场**：kill 所有 node/cmd 构建进程，**匹配名要含 `build-standalone` 本名**（孤儿进程会互相踩）。
2. `rm -rf apps/web/.next` → 确定性单线程重建。
3. 跑 `.cache-tmp/build-standalone.js`（§7 附录 A）：6 次重试循环，**attempt1 崩是常态**（瞬态 OOM），只有 `Type error / Module not found / sensitive-data check FAILED` 才算真错退出。
4. 构建 env 固定：`NODE_OPTIONS=--max-old-space-size=2560`、`NEXT_BUILD_CPUS=2`（防 Static worker OOM 0xC0000409）、`NEXT_TELEMETRY_DISABLED=1`。
5. **BUILD_ID 文件存在后才起服**；起服后**先路由探针**（`/api/license/status` 200）再跑门禁。
6. **服务在用中不热重建**——重建前必停服务。

### 5.2 版本与发布纪律
- **功能包必 bump** `apps/desktop/package.json` 的 `version`（纯文档/纯修复可不 bump，先例：S148）。
- **dist 永远唯一包**：出新版必须删旧 exe+blockmap（precheck 会验）。
- 每次封包 **git tag vX.Y.Z 并 push main+tag**。
- 发新版前更新 `docs/14` 的"当前应发版本"。

### 5.3 提交纪律
- **用户文件绝不入库**；提交**显式列路径**，禁 `git add -A`。
- `.env.local`、`apps/web/data/`（含 license 私钥）永不提交。

### 5.4 合规红线（对客户也这么讲）
- 不爬虫 / RPA / cookie 劫持 / 拟人化绕检测（绕过平台技术措施是法律问题，不因风险自担放开）。
- **自动外呼、批量主动私信永不做**；私信页保持占位（`imEnabled=false`，verify-config 有不变式校验：翻转需 B1 审批+MEMORY 红线流程+版本升级三前置）。
- 评论自动回复=三重门内可做：官方接口+能力审核+用户开关，缺一只起草不发送。
- **接口没有的数据一律不展示**（S29：删硬编码假数据，诚实空态）。
- 智能营销只出主意不触达；campaigns 的 checklist 是人工动作清单。

### 5.5 验收纪律
- **e2e 必须串行独占**：并行跑会 3022 端口互踩出假红（2026-10-30 踩过：两实例互踩报 RED，单跑即绿）。
- 封包前**六套门禁双轮全绿**（§6）。
- 宽屏验收前**全关旧 tab**（第九批教训）。
- UI/布局判断**视口优先**（用户级 AGENTS.md 全局生效）：
  - 面板浏览器固定约 1000×700，**窄窗截图不能当"布局坏了"的证据**；桌面结论必须 playwright `resize(1440,900)` 后再看，且结论要标注视口。
  - 滚动显现类动画（`.rv`）会让整页截图显空白/数字停半截——先滚动到底再截图；对外站点内容一律加载即全显。
  - 静态站改 JS/CSS 后复测要清缓存（CDP `Network.clearBrowserCache` + `setCacheDisabled`），否则拿旧代码假红/假绿。

### 5.6 已知高频坑（改码时留意）
- antd v6 Select 类名/交互怪 → 不纠缠，按既有模式绕。
- `rc-upload` 不认合成 DragEvent → 验收用 `DataTransfer` 直喂 `input[type=file]` + change 事件。
- PowerShell 内联 `node -e` 引号地狱 → **复杂脚本一律写进 `.cache-tmp/*.js` 再 `node 文件` 跑**。
- `git show ... > file` 在 PS 下会 UTF-16 污染 → 用 `encoding:'buffer'` 读。

---

## 6. 六套门禁（跑法与期望）

```powershell
cd D:\_project\apps\web
# 1) 起验证服务（3001 是别人的，永远用 3021）
Start-Process cmd -ArgumentList '/c','cd /d D:\_project\apps\web && node node_modules\next\dist\bin\next start -p 3021 > .next\start3021.log 2>&1' -WindowStyle Hidden
# 等探针 200 后：
$env:SMOKE_BASE='http://localhost:3021'
node scripts/crypto-test.js        # 144/0  无服务依赖
node scripts/verify-config.js      # 92/0   无服务依赖
node scripts/port-test.js          # 9/0    无服务依赖
node scripts/smoke.js              # 116/0  需服务
node scripts/journey-test.js       # 11/0   需服务
node scripts/e2e-flow.js           # 35/0   自管3022，独占串行，最后单独跑
```
- 断言格式统一 `PASS xxx` / `FAIL xxx` 行；计数口径=`node execSync UTF8 行计数`。
- **封包前跑双轮**（每套连续两次全绿）。
- 另有 `node scripts/load-test.js`（S58 压测：导入200作品+2000评论测耗时后恢复备份，**不入门禁**，手动跑）。

---

## 7. 封包发布 SOP（逐步，别跳步）

1. **清场**：kill 所有构建/服务进程（匹配名含 `build-standalone`）。
2. `rm apps/web/.next` → `node D:\_project\.cache-tmp\build-standalone.js`（后台跑，等 `STANDALONE READY attempt N`）。
3. BUILD_ID 存在 → 起服 3021 → 路由探针 200。
4. **六套门禁双轮全绿**（§6，e2e 串行最后跑）。
5. **bump 版本**（功能包）：`apps/desktop/package.json` → `version: x.y.z`。
6. `cd apps/desktop && npx electron-builder --win nsis --publish never`（前置 `build-web.js` 已由构建循环做过：web→standalone→拷 resources+公钥）。
7. **precheck**：`node D:\_project\.cache-tmp\precheck-release.js "dist\获客中台-Setup-旧版.exe"`（附录 B）
   - 期望：`SENSITIVE_HITS=0`（standalone 内无 .pem/license/local.json）
   - `CONTENT:` 后 40 个功能标记全 `true`（包里确实有这些新功能文案）
   - argv 传入的旧 exe 被删 → `dist` 只剩新版
8. **实机六验**：`powershell -ExecutionPolicy Bypass -File D:\_project\.cache-tmp\verify-release.ps1`（附录 C）
   - 期望：`alive=N`、`VER=x.y.z`、views/segs/drafts/lead360/fresh_import 全 True、`after-close: procs=0 service_alive=False`（托盘存活验证）
9. **提交+打 tag**：`git add <显式路径> && git commit && git tag vx.y.z && git push origin main && git push origin vx.y.z`
10. **收尾文档**：`docs/14` 更新"当前应发版本"；`MEMORY.md` 行3 追加状态；`docs/04` 台账行+tally 行更新。
11. **交付客户**：按 `docs/14` 发货 checklist（签发 license、私钥不出本机）。

> 历史批次命名规律：每批 4 个任务（S4n…S4n+3），前三=功能，末位=「门禁与vX.Y.Z封包」。

### 附录 A：`.cache-tmp/build-standalone.js`（gitignored，全新克隆需按此重建）
```js
const { spawnSync } = require('child_process');
for (let a = 1; a <= 6; a++) {
  console.log('build-web attempt', a, new Date().toISOString());
  const r = spawnSync('node', ['scripts/build-web.js'], {
    cwd: 'D:/_project/apps/desktop', encoding: 'utf8', shell: true, timeout: 2400000,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2560', NEXT_BUILD_CPUS: '2', NEXT_TELEMETRY_DISABLED: '1' },
  });
  const out = (r.stdout || '') + (r.stderr || '');
  if (r.status === 0 && out.includes('resources ready')) { console.log('STANDALONE READY attempt', a); process.exit(0); }
  if (/Type error|Module not found|sensitive-data check FAILED/.test(out)) {
    console.log('REAL ERROR:', out.split(/\r?\n/).filter((l) => /Type error|Module not found|sensitive/.test(l)).slice(0, 5).join(' | ').slice(0, 400));
    process.exit(2);
  }
  console.log('  transient crash, retry...');
}
console.log('ALL FAILED'); process.exit(1);
```

### 附录 B：`.cache-tmp/precheck-release.js`（完整源码，33 行）
> ⚠️ `.cache-tmp/` 是 gitignored 的——**这三个脚本不在 git 历史里**，全新克隆会丢。本文附录即备份。

```js
const fs = require('fs');
const path = require('path');
// 封包前检查：1) standalone 产物敏感文件扫描 2) 新功能关键文案在 chunks 里 3) dist 唯一包（旧包删除回执）
const ROOT = 'D:/_project/apps/desktop';
const hits = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.pem$|license\.license$|local\.json$/.test(e.name)) hits.push(p);
  }
};
walk(ROOT + '/resources/standalone');
console.log('SENSITIVE_HITS=' + hits.length, hits.slice(0, 5).join(' | '));
const marks = { palette: '输入指令或搜索', savedviews: '存当前筛选', board: '卡片在状态列之间拖动', calendar: '按「下次提醒」排布未来7天', ctxmenu: '搜此人全部评论', colset: '列设置', help: '命令面板：跳页', dealstrip: '成交总单数', followctx: '催办：明天 9 点提醒', deskcard: '桌面端常驻', engcol: '互动率', draftbox: '草稿收件箱', lead360: '360 接触全景', leadsimport: '老客户名单', contactcol: '联系方式', batchremind: '批量排提醒', todaydesk: '今日工作台', dupcheck: '查重', recovery: '自动从备份', attr: '作品带货榜', revisit: '老客户该回访了', comply: '合规体检', goal: '本周目标', clv: '高价值客户', costfld: '给刀手的交付费等', hb: '业务心跳', silent: '沉默线索该捞了', touch: '记了联系', monthly: '月度经营复盘', bverify: '数据可能在流失', tier: '培育中', kwmoney: '关键词钱表', autodet: '已识别为', checkup: '系统健康自检', wizard2: '确认导入', autolock: '挂机自动锁定', monthshare: '月度复盘分享图', funnel: '有下单意向', firstrun: '先花三分钟', freshness: '数据停留太久' };
const found = {};
const scan = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) scan(p);
    else if (e.name.endsWith('.js')) {
      const s = fs.readFileSync(p, 'utf8');
      for (const k in marks) if (!found[k] && s.includes(marks[k])) found[k] = true;
    }
  }
};
scan(ROOT + '/resources/standalone/.next/static/chunks');
console.log('CONTENT:', Object.keys(marks).map((k) => k + '=' + !!found[k]).join(' '));
const delOld = process.argv.slice(2);
for (const f of delOld) {
  try { fs.unlinkSync(f); console.log('deleted:', path.basename(f)); } catch (e) { console.log('del:', path.basename(f), e.code || e.message); }
}
console.log('dist exes now:', fs.readdirSync(ROOT + '/dist').filter((n) => n.endsWith('.exe')).join(','));
```
用法：`node D:\_project\.cache-tmp\precheck-release.js "dist\获客中台-Setup-旧版.exe" "dist\获客中台-Setup-旧版.exe.blockmap"`
期望：`SENSITIVE_HITS=0` + `CONTENT:` 40 项全 true + `dist exes now:` 只剩新版。

### 附录 C：`.cache-tmp/verify-release.ps1`（完整源码，32 行）

```powershell
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Get-Process -Name '获客中台' | Stop-Process -Force
Start-Process 'D:\_project\apps\desktop\dist\win-unpacked\获客中台.exe'
Start-Sleep 24
$procs = @(Get-Process -Name '获客中台')
Write-Output "alive=$($procs.Count)"
$pids = $procs.Id
$lines = netstat -ano | Select-String '127\.0\.0\.1:\d+\s.*LISTENING' | ForEach-Object { $_.ToString().Trim() }
$mine = $lines | Where-Object { $pids -contains [int](($_ -split '\s+')[-1]) }
foreach ($l in $mine) {
  $port = [regex]::Match($l, '127\.0\.0\.1:(\d+)').Groups[1].Value
  try {
    $st = (Invoke-WebRequest "http://127.0.0.1:$port/api/license/status" -UseBasicParsing -TimeoutSec 8).Content | ConvertFrom-Json
    $set = (Invoke-WebRequest "http://127.0.0.1:$port/api/settings" -UseBasicParsing -TimeoutSec 8).Content | ConvertFrom-Json
    $seg = (Invoke-WebRequest "http://127.0.0.1:$port/api/marketing/segments" -UseBasicParsing -TimeoutSec 8).Content | ConvertFrom-Json
    $dr = (Invoke-WebRequest "http://127.0.0.1:$port/api/drafts" -UseBasicParsing -TimeoutSec 8).Content | ConvertFrom-Json
    $lp = (Invoke-WebRequest "http://127.0.0.1:$port/api/leads/profile?nick=%E5%88%80%E5%8F%8B%E8%80%81%E9%99%88" -UseBasicParsing -TimeoutSec 8).Content | ConvertFrom-Json
    $ov = (Invoke-WebRequest "http://127.0.0.1:$port/api/stats/overview" -UseBasicParsing -TimeoutSec 8).Content | ConvertFrom-Json
    Write-Output "VER=$($st.app_version) views=$($null -ne $set.comment_views) segs=$(@($seg.segments).Count) drafts_ok=$($null -ne $dr.pending) lead360_ok=$($null -ne $lp.stats) fresh_import_field=$($ov.PSObject.Properties.Name -contains 'last_import_at')"
    break
  } catch { Write-Output "port $port fail: $($_.Exception.Message)" }
}
if ($port -ne '') {
  $app = Get-Process -Name '获客中台' | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($app) { $app.CloseMainWindow() | Out-Null; Start-Sleep 6 }
  $after = @(Get-Process -Name '获客中台')
  $svc = $false
  try { $x = Invoke-WebRequest "http://127.0.0.1:$port/api/license/status" -UseBasicParsing -TimeoutSec 5; $svc = ($x.StatusCode -eq 200) } catch {}
  Write-Output "after-close: procs=$($after.Count) service_alive=$svc"
}
Get-Process -Name '获客中台' | Stop-Process -Force
```
用法：`powershell -ExecutionPolicy Bypass -File D:\_project\.cache-tmp\verify-release.ps1`
期望：`alive≥1`、`VER=新版本`、五个字段全 True、`after-close: procs=0 service_alive=False`（关窗后服务还活着=托盘常驻正常，脚本最后会杀净）。

---

## 8. 发证 SOP（每客户一次，服务商侧）

```powershell
cd D:\_project\apps\web
# 首次（本机已做过，勿重复）：node scripts/license-gen.js keypair
# 客户装包后激活门复制机器码发你 → 签发：
node scripts/license-gen.js issue --customer 客户名 --days 0 --bind "cpuHash.diskHash.macHash" --tier pro
#   --days 0=买断长期；365=按年；--tier basic=基础版（专业版可省略=默认全开）
# 产出 apps/web/data/license.license → 发回客户（微信传完即撤回，别发群/网盘）
```
- **私钥 `data/license_key.pem` 永远只在你电脑上，谁来要都不发。**
- 换机=客户报新机器码重签；到期=重签导入即可。
- 详细与边界：`docs/13`（发证技术）、`docs/11`（买断制方案）。

---

## 9. 抖音接入现状（客户在办什么、卡在哪）

### 9.1 已就绪的（我们侧）
- **端点已按 2026-10-30 官方文档对齐**（S153 热修，v1.16.1）：
  - 授权 `https://open.douyin.com/platform/oauth/connect/`（旧值 `/oauth/authize/` 是错拼，联调首日即 404，已修）
  - 作品 `https://open.douyin.com/api/douyin/v1/video/video_list/`
  - 评论 `https://open.douyin.com/video/comment/list/`
  - scopes 环境可配 `DOUYIN_SCOPES`，默认 `user_info,video.list.bind,item.comment`（伪 scope `data` 已清）
  - `DOUYIN_COMMENT_REPLY` 拼写已正（原三连 U 笔误）
- `port-test` 9 断言**锁死这些值防漂移**。
- 切换脚本：`live-switch.js --key … --secret … --dry` 演练 → 正式写 env → 重启 → `live-check.js` 三项自检（mode=live / 跳转官方域名 / 二维码=官方授权链接）。

### 9.2 客户侧卡点（**2026-10-31 官方文档核实的硬规则**）
- **客户做了"个人认证"→ 不能创建应用**。官方入驻类型表：个人主体仅支持创建「小玩法/小游戏/小程序」；我们要的**移动应用/网站应用必须企业或个体工商户主体**。
- **解法两条（按客户实际）**：
  1. **有蓝V**：开放平台主体认证时「是否已认证抖音企业号」选**是** → 扫码 → **资质复用免重复填**（前提：蓝V认证在有效期内、主体名称与信用代码完全一致）→ 对公验证（法人脸/银行卡实名=实时）→ 约 3 工作日 → 建应用。
  2. **无蓝V/主体不符**：用企业或个体工商户主体重新注册开发者账号入驻（**主体类型审核通过后不可改**，个人已认证的账号需新注册）。
- 之后流程：建「移动/网站应用」→ 场景描述照 `docs/15` 模板 → **第一批能力**（视频数据+评论数据）→ 审核过 → **client_key/client_secret 交我们 → 当天切 live** → 真扫码+T+1 自动同步 → 第二批（评论回复）→ 真发送。
- **给客户的话术**："个人认证只支持小游戏小程序，不支持您这种需要授权+数据能力的系统。您要么用蓝V主体走资质复用（最快），要么用营业执照重新入驻企业/个体主体——走通后密钥到手当天，扫码和自动同步就变真。"

### 9.3 密钥到手后的我方动作（预计 1-2 天全落地）
1. `live-switch.js --dry` → 正式写 `DOUYIN_MODE=live` + key/secret → 重启 → `live-check.js` 三项 PASS。
2. **回调落地二选一**（OAuth `redirect_uri` 必须公网 HTTPS，桌面版无公网地址）：
   - 方案 A（推荐）：函数计算/轻量云部署几十行**回调中转**——抖音回调它→页面展示一次性授权码→客户粘回工作台（5 秒完成）。
   - 方案 B：客户有已备案域名→直接登记为回调域，静默完成。
3. 真绑定后账号出现即自动 T+1 同步，手工导 CSV 退役（导入保留补历史）。
4. 第二批能力批下来 → 三重门齐 → 自动回复从起草升级为真发送。
5. **联调复核项**（代码注释已标）：`lib/douyinPort.ts`、`lib/liveSync.ts`、`lib/douyinMappers.ts` 的端点路径/分页字段/能力权限，以真实响应复核。

---

## 10. 客户交付要点（详版在 docs/14）

- **当前应发：v1.16.1**（v1.16.0 含 live 端点错拼已废，勿发）。
- 20 分钟演示剧本：激活→导入他自己的真数据→看意向→生成话术→跟进台账→自动化三重门讲解→指南页。
- FAQ 应答表（docs/14 §三）：为什么扫码不能直登/安全吗/能自动回复吗/换电脑/未知发布者/私信灰的…。
- 测试期话术基调：**"现在体验的是完整工作流+他自己的真实数据；官方自动通道等入驻审核通过后开通。"** 切勿承诺扫码立即可用。
- 报障协议：先要「导出诊断包」txt，拿不到再要版本号+`%APPDATA%\获客中台\server.log`。

---

## 11. 文档索引（docs/）

| 文件 | 内容 | 何时读 |
|---|---|---|
| `00-overview.md` | 项目总览、功能边界（与客户对齐的表） | 第一天 |
| `01-architecture.md` | 架构方案、模块划分、性能口径 | 改架构前 |
| `02-ui-spec.md` | 设计规范（去AI味：禁紫蓝渐变/大圆角彩卡，Metric Strip，双密度表） | 写 UI 前必读 |
| `03-api-contract.md` | **契约冻结**：全部接口/表/红线段 | 加接口前必读 |
| `04-tasks.md` | **任务台账**：S0-S154 全部行 + 尾部 tally 汇总行 | 批次规划/查历史 |
| `05-review-improvements.md` | 评审改进清单（架构 P0 + UI） | 重构参考 |
| `06-config-catalog.md` | 配置项总表（11 文件，命名规则） | 改配置前 |
| `07-xiaohongshu-reference.md` | 竞品截图拆解（合规版：只借形态不照搬执行） | 需求讨论 |
| `08-roadmap.md` | 全自动化版本规划（**暂缓，前置条件未满足不编码**） | 被要求"全自动"时先读 |
| `09-code-review.md` | 代码质量评审报告（基线与结论） | 大改前 |
| `10-customer-demand.md` | 客户截图需求逐项分析（A+B 做、**C 类封存**） | 客户提新需求先对这里 |
| `11-licensing.md` | 买断制授权方案（防君子不防黑客，溯源代替防复制） | 发证相关 |
| `12-bluev-upgrade.md` | 蓝V升级路径（B1-B5 能力解锁清单，**只规划未编码**） | 蓝V能力批下来后 |
| `13-desktop-dist.md` | 桌面打包+发证+live切换 SOP | 封包/发证/切live |
| `14-client-delivery.md` | **客户交付手册**（剧本/FAQ/红线话术） | 见客户前必读 |
| `15-douyin-onboarding.md` | **入驻指南**（材料/模板/密钥后动作/风险告知） | 客户问入驻时 |
| `16-handoff.md` | 本文件 | 接手第一天 |

---

## 12. 未决事项 / 技术债 / 已知问题

### 等客户（外部依赖，代码侧无活）
1. **开放平台入驻**：个人认证死路 → 走蓝V资质复用或企业/个体重新入驻（§9.2）→ 建应用 → 第一批能力 → **client_key/secret**。
2. 密钥到手 → live 切换 + 回调方案 A/B 落地（§9.3）。
3. **第二批能力**（评论回复真发送）→ 三重门之二。
4. **B1 私信能力**（蓝V后）→ 才谈 `imEnabled` 翻转与 messages 页真会话（docs/12）。

### 代码/运维 backlog（按 MEMORY 既有清单）
- S25 二期：激活向导 / 自助解绑（docs/11 §7）。
- PG + prisma migrate（等 docker 环境）；服务端限流 + webhook 真验签（生产门禁 M4）。
- 周期同步调度升级 Redis 队列（现为进程内单例）。
- 自动更新、代码签名证书（现 SmartScreen 需"仍要运行"）。
- `imEnabled` 翻转三前置（verify-config 不变式已锁 `false`）。

### 已知问题（本机/文档层）
- **根目录 `monkey-moto.html`**：untracked + unignored（`git status` 会一直显示 `??`）。是用户文件——**勿提交、勿删**；若用户确认不要，再删或加 ignore。
- **发布链脚本在 `.cache-tmp/`（gitignored）**：全新克隆会缺 build-standalone/precheck/verify-release 三件套 → 按 §7 附录 A 重建（B/C 的逻辑摘要也在附录）。
- `NOTICE` 是 0 字节空文件（已 ignore）。
- 根目录堆了大量用户截图/他项目目录（§3 绝不入库清单）——保持 ignore，勿清理（用户资产）。
- `docs/04-tasks.md` 历史曾有合并行/重复块（wave 脚本写重），**2026-11-05 已修复**（4 行拆 16 行、删重复 S149-S152 块、S114 归位）；今后写台账行**每行独立、勿用 `||` 拼接**。

---

## 13. 端口与进程速查

| 端口 | 归属 | 规则 |
|---|---|---|
| 3001 | 用户 AnythingLLM / package.json 默认 | **勿杀、勿依赖**；实际服务一律 `-p 3021` |
| 3021 | 本项目验证服务 | 起服/跑 smoke/journey 都在这；`SMOKE_BASE=http://localhost:3021` |
| 3022 | e2e-flow 临时 | 自起自停；**e2e 必须串行独占** |

停/起 3021：
```powershell
# 停
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match '3021' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
# 起
Start-Process cmd -ArgumentList '/c','cd /d D:\_project\apps\web && node node_modules\next\dist\bin\next start -p 3021 > .next\start3021.log 2>&1' -WindowStyle Hidden
```

---

## 14. 工作流约定（与用户协作的既定节奏）

1. **批次制**：按规划依次执行 → **全部执行完才一次性汇报**（批次中途不汇报）。
2. 每批 4 任务（S4n…S4n+3），末位是封包任务；台账 `docs/04` 加行 + 尾部 tally 行追加 `Sxxx✅（…）`。
3. 功能包必 bump 版本、必打 tag、dist 必唯一包。
4. 提交显式列路径；用户文件绝不入库。
5. 封包前六套门禁双轮全绿 + precheck 四十标记 + 实机六验。
6. 复杂脚本写 `.cache-tmp/*.js` 文件跑，别在 PowerShell 里内联。
7. 布局结论必标视口（playwright 1440×900），窄窗截图不作数。

---

*交接完成。新 Agent 从 §0 开始，遇到没写的场景：先查 `docs/` 与 `MEMORY.md`，再查 git log，最后才问用户。*
