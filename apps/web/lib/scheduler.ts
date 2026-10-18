/**
 * S28 进程内定时调度器：按 syncConfig 节奏自动触发 statsSync
 * 设计：globalThis 单例防 Next 热更新重复挂载；不引 Redis（单机部署够用，分布式再升级）。
 * 红线：只调度同步类任务；mock 模式只入队（保持行为不变），live 模式真实拉取。
 */
import { syncConfig } from '@/config/sync.config';
import { tasksConfig } from '@/config/tasks.config';
import { getRepos } from './repo';
import { runLiveSync, liveSyncEnabled } from './liveSync';
import { autoReplyTick } from './autoReply';
import { autoCfgOf } from './autoCfg';
import type { AutoConfig } from './autoCfg';

export interface SchedulerStatus {
  enabled: boolean;
  running: boolean;
  startedAt: string | null;
  lastTickAt: string | null;
  lastSyncAt: string | null;
  lastResult: string | null;
  todayRunCount: number;
  todayDate: string;
  nextInSec: number | null;
  failStreak: number;
  fused: boolean;
  minIntervalMin: number;
  /** S75 生效中的自动化配置（面板回显） */
  auto_config?: AutoConfig;
  /** S40 执行历史（最新在前，环形保留20条，内存态） */
  history: { at: string; trigger: string; ok: boolean; detail: string }[];
}

interface State {
  running: boolean;
  startedAt: number | null;
  lastTickAt: string | null;
  lastSyncAt: string | null;
  lastResult: string | null;
  todayDate: string;
  todayRunCount: number;
  failStreak: number;
  fused: boolean;
  history: { at: string; trigger: string; ok: boolean; detail: string }[];
}

const g = globalThis as unknown as { __scheduler?: { timer: NodeJS.Timeout | null; state: State } };

function freshState(): State {
  return {
    running: false,
    startedAt: null,
    lastTickAt: null,
    lastSyncAt: null,
    lastResult: null,
    todayDate: '',
    todayRunCount: 0,
    failStreak: 0,
    fused: false,
    history: [],
  };
}

/** S40 执行历史入账（最新在前，环形20条） */
function pushHistory(st: State, trigger: string, ok: boolean, detail: string) {
  st.history.unshift({ at: new Date().toISOString(), trigger, ok, detail });
  if (st.history.length > 20) st.history.length = 20;
}

function ensure(): { timer: NodeJS.Timeout | null; state: State } {
  if (!g.__scheduler) g.__scheduler = { timer: null, state: freshState() };
  return g.__scheduler;
}

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function inQuietHours(cfg?: { quiet_enabled: boolean; quiet_start: number; quiet_end: number }): boolean {
  if (cfg) {
    if (!cfg.quiet_enabled) return false;
    const h = new Date().getHours();
    return cfg.quiet_start > cfg.quiet_end ? h >= cfg.quiet_start || h < cfg.quiet_end : h >= cfg.quiet_start && h < cfg.quiet_end;
  }
  if (!tasksConfig.quietHoursEnabled) return false;
  const h = new Date().getHours();
  const { start, end } = tasksConfig.quietHours;
  return start > end ? h >= start || h < end : h >= start && h < end;
}

function minutesSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 60_000;
}

/** 启动调度器（幂等，重复调用不重复挂载） */
export function ensureScheduler(): SchedulerStatus {
  const s = ensure();
  if (!syncConfig.autoSyncEnabled) return status();
  if (s.timer) return status();
  s.state.startedAt = Date.now();
  s.state.running = true;
  s.state.todayDate = todayStr();
  s.timer = setInterval(() => { void tick(); }, syncConfig.tickIntervalMs);
  // 启动后先跑一次 tick（不立即同步，只刷新状态），避免"启动后空等一个周期"
  void tick();
  return status();
}

export function stopScheduler(): SchedulerStatus {
  const s = ensure();
  if (s.timer) clearInterval(s.timer);
  s.timer = null;
  s.state.running = false;
  return status();
}

/** 单次调度判定：开关→任务未暂停→未熔断→未超今日上限→未到最小间隔→（静默期跳过）→执行 */
async function tick(): Promise<void> {
  const s = ensure();
  const st = s.state;
  st.lastTickAt = new Date().toISOString();
  // S74 评论自动回复独立心跳（冷却/上限/静默自判，与同步开关和熔断无关）
  try { autoReplyTick(); } catch { /* 执行器异常不拖垮调度 */ }
  // S75 自动化面板可调：同步总开关/间隔/日限/静默读用户配置（config为出厂默认）
  const cfg = autoCfgOf(getRepos().settings.get() as { auto_config?: unknown });
  if (!cfg.sync_enabled) return;
  if (!syncConfig.autoSyncEnabled || st.fused) return;

  const repos = getRepos();
  const type = 'statsSync';
  if (repos.tasks.isPaused(type)) return;

  // 跨天重置今日计数
  const t = todayStr();
  if (st.todayDate !== t) { st.todayDate = t; st.todayRunCount = 0; }

  if (st.todayRunCount >= cfg.sync_daily_cap) {
    st.lastResult = `已达今日上限${cfg.sync_daily_cap}次`;
    return;
  }
  if (minutesSince(st.lastSyncAt) < cfg.sync_interval_min) return;
  if (syncConfig.respectQuietHours && inQuietHours(cfg)) {
    st.lastResult = '夜间静默中，跳过本次自动同步';
    return;
  }

  await executeSync('auto');
}

/** 执行一次同步（auto=调度触发，manual=手动按钮） */
async function executeSync(trigger: 'auto' | 'manual'): Promise<{ ok: boolean; detail: string; task_id?: string }> {
  const s = ensure();
  const st = s.state;
  const repos = getRepos();
  try {
    const enq = repos.sync.enqueue();
    let detail = 'mock 模式已入队（live 密钥到位后自动拉取）';
    if (liveSyncEnabled()) {
      const live = await runLiveSync();
      if (live.mode === 'error') throw new Error(live.error || 'live同步失败');
      detail = `live 拉取：作品${live.videos.created + live.videos.updated} · 评论${live.comments.created + live.comments.updated}`;
    }
    st.todayRunCount++;
    st.lastSyncAt = new Date().toISOString();
    st.lastResult = `[${trigger}] ${detail}`;
    st.failStreak = 0;
    pushHistory(st, trigger, true, detail);
    return { ok: true, detail, task_id: enq.task_id };
  } catch (e) {
    st.failStreak++;
    st.lastResult = `[${trigger}] 失败：${(e as Error).message}`;
    pushHistory(st, trigger, false, (e as Error).message);
    if (st.failStreak >= tasksConfig.fuseFailThreshold && tasksConfig.riskFuseEnabled) {
      st.fused = true;
      repos.tasks.setPaused('statsSync', true);
      st.lastResult += ` · 连续失败${st.failStreak}次已熔断，任务自动暂停`;
      pushHistory(st, 'system', false, `连续失败${st.failStreak}次，已熔断并自动暂停任务`);
    }
    return { ok: false, detail: (e as Error).message };
  }
}

/** 手动同步入口（供 /api/stats/sync 复用调度器的计数/熔断逻辑） */
export async function triggerManualSync(): Promise<{ ok: boolean; detail: string; task_id?: string }> {
  const st = ensure().state;
  const t = todayStr();
  if (st.todayDate !== t) { st.todayDate = t; st.todayRunCount = 0; }
  if (st.fused) return { ok: false, detail: '已熔断，请先在任务中心恢复' };
  return executeSync('manual');
}

/** 解除熔断（任务中心 resume 时调用） */
export function resetFuse(): void {
  const st = ensure().state;
  st.fused = false;
  st.failStreak = 0;
  st.lastResult = '熔断已解除';
  pushHistory(st, 'system', true, '熔断已解除，调度恢复');
}

export function status(): SchedulerStatus {
  const st = ensure().state;
  const t = todayStr();
  const todayCount = st.todayDate === t ? st.todayRunCount : 0;
  const cfg = autoCfgOf(getRepos().settings.get() as { auto_config?: unknown });
  const nextInSec = st.fused || !syncConfig.autoSyncEnabled || !cfg.sync_enabled
    ? null
    : Math.max(0, Math.round((cfg.sync_interval_min * 60_000 - (Date.now() - (st.lastSyncAt ? new Date(st.lastSyncAt).getTime() : 0))) / 1000));
  return {
    enabled: syncConfig.autoSyncEnabled && cfg.sync_enabled,
    running: ensure().timer !== null,
    startedAt: st.startedAt ? new Date(st.startedAt).toISOString() : null,
    lastTickAt: st.lastTickAt,
    lastSyncAt: st.lastSyncAt,
    lastResult: st.lastResult,
    todayRunCount: todayCount,
    todayDate: t,
    nextInSec: nextInSec !== null && nextInSec <= cfg.sync_interval_min * 60 ? nextInSec : null,
    failStreak: st.failStreak,
    fused: st.fused,
    minIntervalMin: cfg.sync_interval_min,
    auto_config: cfg,
    history: st.history,
  };
}
