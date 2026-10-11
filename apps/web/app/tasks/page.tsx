'use client';
import { useEffect, useState } from 'react';
import { tasksConfig } from '@/config/tasks.config';
import type { TaskItem, VideoTask, Video } from '@/lib/types';

/** S12a 任务中心：同步类任务队列（编号/对象/状态/上次执行/启停），只管同步节奏，不做自动执行 */
export default function Tasks() {
  const [items, setItems] = useState<TaskItem[]>([]);
  const [vtasks, setVtasks] = useState<VideoTask[]>([]);
  const [vvideos, setVvideos] = useState<Video[]>([]);
  const [vsel, setVsel] = useState('');
  const [vmsg, setVmsg] = useState('');
  const [notify, setNotify] = useState(false);
  const [tmsg, setTmsg] = useState('');
  // 挂载门：权限文案首屏与服务端一致，消灭hydration mismatch
  const [mounted, setMounted] = useState(false);
  const load = () => fetch('/api/tasks').then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => setTmsg('任务列表加载失败，请重试'));
  const loadV = () => {
    fetch('/api/video-tasks').then((r) => r.json()).then((d) => setVtasks(d.items || [])).catch(() => setVmsg('队列加载失败，请重试'));
    fetch('/api/videos').then((r) => r.json()).then((d) => setVvideos(d.items || [])).catch(() => {});
  };
  useEffect(() => {
    setMounted(true);
    load();
    loadV();
    if (typeof window !== 'undefined') setNotify(localStorage.getItem('notify_new_comment') === '1');
  }, []);
  const control = async (type: string, action: 'pause' | 'resume') => {
    const r = await fetch('/api/tasks/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, action }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setTmsg(r?.message || '操作失败，请重试'); return; }
    setTmsg(''); load();
  };
  const addV = async () => {
    if (!vsel) { setVmsg('请先选择视频'); return; }
    const r = await fetch('/api/video-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video_id: vsel }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setVmsg(r?.message || '添加失败'); return; }
    setVmsg(''); loadV();
  };
  const patchV = async (id: string, patch: object) => {
    const r = await fetch(`/api/video-tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setVmsg(r?.message || '操作失败，请重试'); return; }
    loadV();
  };
  const delV = async (id: string) => {
    const r = await fetch(`/api/video-tasks/${id}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setVmsg('删除失败，请重试'); return; }
    loadV();
  };
  const toggleNotify = async () => {
    if (!notify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    const v = !notify;
    setNotify(v);
    if (typeof window !== 'undefined') localStorage.setItem('notify_new_comment', v ? '1' : '0');
  };
  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1', display: 'flex', alignItems: 'center' }}><div><b style={{ fontSize: 15 }}>任务中心</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>只调度同步类任务 · 自动点赞/评论/私信不在此列</div></div><div style={{ marginLeft: 'auto', fontSize: 12, color: '#6B6862' }}>{tmsg}</div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <table><thead><tr><th>编号</th><th>任务</th><th>状态</th><th>上次执行</th><th>节奏</th><th></th></tr></thead>
            <tbody className="num">{items.map((t) => (
              <tr key={t.type}>
                <td>{t.no}</td><td>{t.label}</td>
                <td>{t.paused ? '已暂停' : '运行中'}</td>
                <td>{t.lastRun || '—'}</td>
                <td>约{tasksConfig.switchIntervalMin}分钟</td>
                <td>{t.paused
                  ? <button className="btn small" onClick={() => control(t.type, 'resume')}>开始</button>
                  : <button className="btn ghost small" onClick={() => control(t.type, 'pause')}>停止</button>}</td>
              </tr>
            ))}</tbody></table>
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#A8A5A0' }}>{tmsg ? <span style={{ color: '#B42318' }}>{tmsg}</span> : '就绪 · 改动即时生效'}</div>
        </div>
        <div>
        <div className="card" style={{ padding: 16 }}>
          <b>新评论通知</b>
          <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>仅看自己号的未读增长，浏览器授权后推送（60s轮询）。{!mounted ? '…' : ('Notification' in window ? `当前权限：${Notification.permission}` : '当前浏览器不支持')}</div>
          <button className={notify ? 'btn small' : 'btn ghost small'} onClick={toggleNotify}>{notify ? '已开启，点击关闭' : '开启通知'}</button>
        </div>
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <b>调度与风控</b>
          <div className="num" style={{ fontSize: 12, color: '#6B6862', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>并发{tasksConfig.maxConcurrentTasks} · 每日上限{tasksConfig.dailySyncCap}次</span>
            <span>夜间{tasksConfig.quietHours.start}-{tasksConfig.quietHours.end}点静默 · 熔断连失{tasksConfig.fuseFailThreshold}停</span>
            <span>失败重试{tasksConfig.maxRetries}次 · 节奏约{tasksConfig.switchIntervalMin}分钟</span>
          </div>
        </div>
        </div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ padding: '12px 14px', fontWeight: 700 }}>视频跟进队列 <span style={{ fontSize: 12, color: '#A8A5A0', fontWeight: 400 }}>只做提醒+手动清单，不自动执行{vmsg ? ` · ${vmsg}` : ''}</span></div>
          <div style={{ padding: '0 14px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={vsel} onChange={(e) => setVsel(e.target.value)} style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px', minWidth: 240 }}>
              <option value="">选择视频加入…</option>
              {vvideos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
            <button className="btn small" onClick={addV}>加入队列</button>
          </div>
          <table><thead><tr><th>视频</th><th>跟进</th><th>点赞✓</th><th>收藏✓</th><th>间隔(分)</th><th>状态</th><th></th></tr></thead>
            <tbody>{vtasks.length === 0 ? <tr><td colSpan={7} style={{ color: '#A8A5A0' }}>暂无，请先加入视频</td></tr> : vtasks.map((t) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td><input type="checkbox" checked={t.follow} onChange={(e) => patchV(t.id, { follow: e.target.checked })} /></td>
                <td><input type="checkbox" checked={t.like_done} onChange={(e) => patchV(t.id, { like_done: e.target.checked })} /></td>
                <td><input type="checkbox" checked={t.fav_done} onChange={(e) => patchV(t.id, { fav_done: e.target.checked })} /></td>
                <td><select value={t.interval_min} onChange={(e) => patchV(t.id, { interval_min: Number(e.target.value) })} style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '5px 6px', fontSize: 12 }}>{[5, 15, 30, 60].map((n) => <option key={n} value={n}>{n}</option>)}</select></td>
                <td>{t.paused ? '已暂停' : '跟进中'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{t.paused
                  ? <button className="btn ghost small" onClick={() => patchV(t.id, { paused: false })}>开始</button>
                  : <button className="btn ghost small" onClick={() => patchV(t.id, { paused: true })}>停止</button>}
                  <button className="btn ghost small" style={{ marginLeft: 6 }} onClick={() => delV(t.id)}>删除</button></td>
              </tr>
            ))}</tbody></table>
        </div>
      </div>
    </div>
  );
}
