# 09 代码质量评审报告

> 评审时间：2026-10-09 / 范围：`apps/web` 全仓（挖地三尺式：读码+grep度量+构建/测试基线复核）/ 基线：53个源码文件约1600行，Next 14 + React 18 + TS strict
> 方法：静态读码（全部页面+路由+lib/config）＋ 度量脚本 ＋ `pnpm test`/`verify`/`build`/`smoke` 基线（事前已全绿）＋ 两轮真机e2e回放

## 1. 总体结论

| 维度 | 评分 | 一句话 |
|---|---|---|
| 功能正确性 | A- | 主链路两轮e2e 0错；修过1崩溃+2展示错，根因都已定位 |
| 类型安全 | B- | strict开了，但 `any` 37处，领域无共享类型 |
| 错误处理 | B- | 契约错误码齐，15处前端静默catch，用户无感知 |
| 安全 | B | 展示层无XSS（React转义）；**生产三件套缺失**（限流/真验签/密钥管理） |
| 可维护性 | B+ | 分层干净（config/store/repo/route），命名注释一致；有3处小坏味道 |
| 可测性 | B- | API冒烟43项强；缺UI自动化，真单测为0 |
| 文档一致性 | A- | 03契约与实现基本对齐，有3处小漂移 |

**一句话：mock演示水准优秀，生产上线前有4个必修缺口（见M1/M4/M5），其余可排期还。**

## 2. 优点（保持）
1. 分层 discipline 好：页面→Route→Repository→store，S9后无越层调用（抽查8路由全经 `getRepos()`）。
2. 配置即文档：7份config含默认值/范围/联动，verify 30项含路由审计，曾真实拦截1次漏网（competitors）。
3. 错误契约统一：`{code,message,trace_id}` + RETRYABLE/FATAL/AUTH_EXPIRED，负例冒烟全覆盖。
4. 设计语言克制：中性token、无渐变卡片堆叠，e2e确认信息密度可用。
5. 无`console.*`业务日志、无TODO裸奔（仅scripts测试输出）。

## 3. 问题清单

### Major（排期必还）
- **M1 token加密无人调用（S1验收名存实亡）**：`lib/crypto.ts` 的 encrypt/decrypt 全仓仅定义处引用，路由/登录流全走明文mock。影响：S1“token加密”验收是纸面达标。建议：S14把 `AuthStore` 接上（Aquorum：内存态至少走一遍加密存取+单测真import；等生产改KMS）。工作量：0.5天。
- **M2 15处静默catch**：`.catch(() => {})` 遍布页面fetch，用户侧失败=没反应（如任务启停、同步、意图标定）。建议：统一 `flash()`/toast + 失败保留旧态，已有 `msg` 通道，改量小。工作量：0.5天。
- **M3 any泛滥37处＋无共享领域类型**：`useState<any[]>`、` (x: any)` 满天飞，`Account/Video/Comment/Follow` 无interface（repo只有Input）。影响：重构必踩雷。建议：抽 `lib/types.ts`，先给Comment/Follow/Video建模。工作量：1天。
- **M4 生产三件套缺失**：①服务端零限流（只有前端60s冷却）；②webhook验签桩恒过（任意x-signature）；③`TOKEN_MASTER_KEY` 缺失时静默用内置默认key。影响：演示无碍，上线即漏洞。建议：限流中间件＋真验签＋缺key启动失败，三者进“生产门禁”而非功能排期。工作量：1.5天。
- **M5 测试金字塔倒置**：43项冒烟全是API层；`crypto-test` 未import真模块（只做参数一致性）；UI零自动化（两轮e2e全靠人工开Playwright）。建议：crypto改真import（需先解决ts执行环境，如tsx）；关键链（标已读→跟进→台账）补1条Playwright脚本进仓。工作量：1.5天。

### Minor（顺手还）
- **m1 未用import**：`app/api/scripts/route.ts` 引了 `ok` 没用（noUnusedLocals关闭所以构建不拦）。顺手删。
- **m2 CSV公式注入**：`lib/csv.ts` 未转义首字符 `=+-@`，单元格内容可疑时Excel会执行。内部工具风险低，建议导出时前缀 `'` 或空格。工作量：0.5h。
- **m3 03契约3处漂移**：①`GET /api/auth/logs?page` 未实现分页（恒3行）；②poll的 `t` 参数契约未定义；③trend返回键是请求传入的aweme_id而非契约`video_id`。建议：改文档贴实现（mock阶段以实现为准）。
- **m4 双轨维护**：`prototype/index.html` 已被app替代，仅留档，建议README标注冻结， DONE（已标注）。
- **m5 仓库杂物**：`.playwright-mcp/`、`screenshots/` 进仓，建议进 `.gitignore`（当前非git仓，建仓前处理）。
- **m6 重复请求**：Shell 60s轮询＋各页独立fetch，未做合并/退避；mock量级无感，数据量上来先加 `staleTime`（React Query或手写）。
- **m7 无障碍**：`msg` flash非aria-live，色盲仅靠2px竖条＋文字（已有文字兜底，OK）。

## 4. 度量附录
- 源码：53文件 / ~1600行（不含lock），最大单文件 `comments/page.tsx` 178行，尚健康。
- `any`：37处（app tsx）；静默catch：15处；`suppressHydrationWarning`：0（ Hydration靠mounted门，已验证）。
- 基线：`test` 7项 ✅ / `verify` 30项 ✅ / `smoke` 43项 ✅ / 构建 ✅ / e2e两轮0错 ✅。

## 5. 行动项（建议S14排序）
1. M1＋M4密钥项（半天，安全红线）
2. M2静默catch改flash（半天，体验）
3. m1＋m2＋m3（1h，顺手）
4. M3类型抽取（1天）
5. M5补Playwright进仓＋crypto真import（1.5天）
6. M4限流/真验签（生产门禁，接入真实抖音时同批做）

## 6. 复查（S14还债结果）
- M1 ✅：`lib/tokenVault.ts` 接线（poll存→me验`token_bound`），缺key生产fail-fast，单测改真import（tsc编译）。
- M2 ✅：用户触发链路全部可见反馈；后台轮询保留静默＋自愈注释（Shell/TaskBar/角标）。
- m1 ✅：删未用import。m2 ✅：CSV公式注入转义。m3 ✅：03三处漂移已贴实现。
- M3 ✅：`lib/types.ts` 12个领域类型，页面/仓库显式any清零（37→0；路由`req.json()`隐式any残留，TS不报错，接受）。
- M5 半 ✅：`journey-test.js` 进仓（J1-J4闭环断言）；Playwright仍人工，crypto已真import。
- M4/M6 限流/真验签：仍为生产门禁，未动。
