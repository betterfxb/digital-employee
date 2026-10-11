# S1-S5运行说明（P0 mock态，不连线上抖音）
1. `cd apps/web && pnpm install && pnpm dev` → http://localhost:3001/auth
2. 冒烟：先起dev，再 `pnpm smoke`（或 `SMOKE_BASE=http://localhost:3001 node ./scripts/smoke.js`）
3. 配置只改 `config/*.ts`，勿硬编码；tokens同步 `app/globals.css` + `docs/02-ui-spec.md`
4. 私信页保持占位（imEnabled=false），禁调IM
