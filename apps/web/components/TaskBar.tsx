'use client';
import { useEffect, useState } from 'react';
import { tasksConfig } from '../config/tasks.config';
import { statsConfig } from '../config/stats.config';

/**
 * 任务队列状态条（频控次数读 /api/stats/usage 真实值，其余读配置）
 */
export function TaskBar() {
  const [usedToday, setUsedToday] = useState(0);
  useEffect(() => {
    fetch('/api/stats/usage').then((r) => r.json()).then((d) => setUsedToday(d.usedToday || 0)).catch(() => { /* 后台读数自愈：60s级刷新，失败沿用上次值，不打扰用户 */ });
  }, []);
  if (!tasksConfig.taskQueueEnabled) return null;
  const left = Math.max(0, tasksConfig.dailySyncCap - usedToday);
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 4, padding: '9px 14px', fontSize: 12, color: '#6B6862', marginBottom: 16 }}>
      <span><b style={{ color: '#1A1A18' }}>任务队列</b> · 运行中</span>
      <span className="num">并发{tasksConfig.maxConcurrentTasks} · 今日同步 {usedToday}/{tasksConfig.dailySyncCap}（剩{left}）</span>
      <span className="num">下次对账约{tasksConfig.switchIntervalMin}分钟后 · 每日{statsConfig.dailySyncCron === '0 6 * * *' ? '6点' : statsConfig.dailySyncCron}全量</span>
      <span style={{ marginLeft: 'auto' }}>
        {tasksConfig.quietHoursEnabled ? `夜间${tasksConfig.quietHours.start}-${tasksConfig.quietHours.end}点静默` : '静默关闭'}
        {' · '}熔断{tasksConfig.riskFuseEnabled ? `开（连失${tasksConfig.fuseFailThreshold}停）` : '关'}
      </span>
    </div>
  );
}
