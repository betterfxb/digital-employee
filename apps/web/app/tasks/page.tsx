'use client';
import { useEffect, useState } from 'react';
import { App, Button, Checkbox, Select, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { tasksConfig } from '@/config/tasks.config';
import type { TaskItem, VideoTask, Video } from '@/lib/types';

interface SchedStatus {
  enabled: boolean; running: boolean; lastSyncAt: string | null; lastResult: string | null;
  todayRunCount: number; nextInSec: number | null; failStreak: number; fused: boolean; minIntervalMin: number;
  history?: { at: string; trigger: string; ok: boolean; detail: string }[];
  /** S74 自动回复执行器 */
  auto_reply?: { enabled: boolean; ready: boolean; gate: string; sentToday: number; cap: number; nextInSec: number | null; log: { at: string; nick: string; text: string; via: string; status: string; note: string }[] };
}

/** S12a 任务中心：同步类任务队列（编号/对象/状态/上次执行/启停），只管同步节奏，不做自动执行 */
export default function Tasks() {
  const { message } = App.useApp();
  const [items, setItems] = useState<TaskItem[]>([]);
  const [vtasks, setVtasks] = useState<VideoTask[]>([]);
  const [vvideos, setVvideos] = useState<Video[]>([]);
  const [vsel, setVsel] = useState('');
  const [notify, setNotify] = useState(false);
  const [followNotify, setFollowNotify] = useState(false);
  const [reportNotify, setReportNotify] = useState(false);
  const [tmsg, setTmsg] = useState('');
  const [sched, setSched] = useState<SchedStatus | null>(null);
  const [mounted, setMounted] = useState(false);
  const flash = (t: string) => message.error(t);
  const load = () => fetch('/api/tasks').then((r) => r.json()).then((d) => setItems(d.items || [])).catch(() => setTmsg('任务列表加载失败，请重试'));
  const loadSched = () => fetch('/api/tasks/status').then((r) => r.json()).then(setSched).catch(() => {});
  const loadV = () => {
    fetch('/api/video-tasks').then((r) => r.json()).then((d) => setVtasks(d.items || [])).catch(() => flash('队列加载失败，请重试'));
    fetch('/api/videos').then((r) => r.json()).then((d) => setVvideos(d.items || [])).catch(() => {});
  };
  useEffect(() => {
    setMounted(true);
    load();
    loadV();
    loadSched();
    const id = setInterval(loadSched, 15_000);
    if (typeof window !== 'undefined') setNotify(localStorage.getItem('notify_new_comment') === '1');
    if (typeof window !== 'undefined') setFollowNotify(localStorage.getItem('notify_follow_due') === '1');
    if (typeof window !== 'undefined') setReportNotify(localStorage.getItem('notify_report') === '1');
    return () => clearInterval(id);
  }, []);
  const control = async (type: string, action: 'pause' | 'resume') => {
    const r = await fetch('/api/tasks/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, action }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setTmsg(r?.message || '操作失败，请重试'); return; }
    setTmsg(''); load();
  };
  const addV = async () => {
    if (!vsel) { flash('请先选择视频'); return; }
    const r = await fetch('/api/video-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ video_id: vsel }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '添加失败'); return; }
    loadV();
  };
  const patchV = async (id: string, patch: object) => {
    const r = await fetch(`/api/video-tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '操作失败，请重试'); return; }
    loadV();
  };
  const delV = async (id: string) => {
    const r = await fetch(`/api/video-tasks/${id}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash('删除失败，请重试'); return; }
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
  /** S44 跟进到期提醒开关（每分钟检查台账待回访里的到期项） */
  const toggleFollowNotify = async () => {
    if (!followNotify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    const v = !followNotify;
    setFollowNotify(v);
    if (typeof window !== 'undefined') localStorage.setItem('notify_follow_due', v ? '1' : '0');
  };
  /** S56 日报提醒开关（每天9点提醒看经营报告） */
  const toggleReportNotify = async () => {
    if (!reportNotify && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
    const v = !reportNotify;
    setReportNotify(v);
    if (typeof window !== 'undefined') localStorage.setItem('notify_report', v ? '1' : '0');
  };
  /** S74 自动回复总开关（服务端settings持久化，三重门之一） */
  const toggleAutoReply = async (v: boolean) => {
    const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto_reply_enabled: v }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '开关保存失败'); return; }
    loadSched();
    if (v) message.success('已开启：通道就绪后按拟人节奏自动执行（当前会先开始自动起草）');
    else message.success('已关闭自动回复');
  };

  const taskCols: ColumnsType<TaskItem> = [
    { title: '编号', dataIndex: 'no', key: 'no', onCell: () => ({ className: 'num' }) },
    { title: '任务', dataIndex: 'label', key: 'label' },
    { title: '状态', key: 'st', render: (_, t) => (t.paused ? '已暂停' : '运行中') },
    { title: '上次执行', key: 'last', onCell: () => ({ className: 'num' }), render: (_, t) => t.lastRun || '—' },
    { title: '节奏', key: 'pace', onCell: () => ({ className: 'num' }), render: () => <>约{tasksConfig.switchIntervalMin}分钟</> },
    { title: '', key: 'act', width: 90, render: (_, t) => (t.paused
      ? <Button size="small" type="primary" onClick={() => control(t.type, 'resume')}>开始</Button>
      : <Button size="small" onClick={() => control(t.type, 'pause')}>停止</Button>) },
  ];

  const vtCols: ColumnsType<VideoTask> = [
    { title: '视频', dataIndex: 'title', key: 'title' },
    { title: '跟进', key: 'follow', width: 70, render: (_, t) => <Checkbox checked={t.follow} onChange={(e) => patchV(t.id, { follow: e.target.checked })} /> },
    { title: '点赞✓', key: 'like', width: 80, render: (_, t) => <Checkbox checked={t.like_done} onChange={(e) => patchV(t.id, { like_done: e.target.checked })} /> },
    { title: '收藏✓', key: 'fav', width: 80, render: (_, t) => <Checkbox checked={t.fav_done} onChange={(e) => patchV(t.id, { fav_done: e.target.checked })} /> },
    { title: '间隔(分)', key: 'iv', width: 100, render: (_, t) => <Select size="small" value={t.interval_min} onChange={(v) => patchV(t.id, { interval_min: v })} style={{ width: '100%' }} options={[5, 15, 30, 60].map((n) => ({ value: n, label: String(n) }))} /> },
    { title: '状态', key: 'st', render: (_, t) => (t.paused ? '已暂停' : '跟进中') },
    { title: '', key: 'act', width: 140, render: (_, t) => (<>
      {t.paused
        ? <Button size="small" onClick={() => patchV(t.id, { paused: false })}>开始</Button>
        : <Button size="small" onClick={() => patchV(t.id, { paused: true })}>停止</Button>}
      <Button size="small" danger style={{ marginLeft: 6 }} onClick={() => delV(t.id)}>删除</Button>
    </>) },
  ];

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1', display: 'flex', alignItems: 'center' }}><div><b style={{ fontSize: 15 }}>任务中心</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>只调度同步类任务 · 自动点赞/评论/私信不在此列</div></div><div style={{ marginLeft: 'auto', fontSize: 12, color: '#6B6862' }}>{tmsg}</div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        {sched && (
          <div className="card" style={{ padding: 16, marginBottom: 16, borderLeft: sched.fused ? '3px solid #B42318' : sched.enabled ? '3px solid #1A1A18' : '3px solid #D8D5CF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <b>自动同步调度</b>
              {sched.fused
                ? <Tag color="error">已熔断</Tag>
                : !sched.enabled ? <Tag>已关闭</Tag>
                : items.find((x) => x.type === 'statsSync')?.paused ? <Tag color="warning">任务已暂停</Tag>
                : <Tag color="success">运行中</Tag>}
              <span style={{ flex: 1 }} />
              <Button size="small" onClick={() => { loadSched(); load(); }}>刷新</Button>
            </div>
            <div className="num" style={{ fontSize: 12, color: '#6B6862', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>今日已自动同步 {sched.todayRunCount}/{tasksConfig.dailySyncCap} 次 · 最小间隔 {sched.minIntervalMin} 分钟</span>
              <span>上次同步：{sched.lastSyncAt ? new Date(sched.lastSyncAt).toLocaleString('zh-CN') : '尚未同步'}</span>
              {sched.nextInSec !== null && sched.nextInSec > 0 && <span>下次自动同步约 {Math.ceil(sched.nextInSec / 60)} 分钟后</span>}
              {sched.lastResult && <span style={{ color: sched.fused ? '#B42318' : undefined }}>{sched.lastResult}</span>}
              {sched.fused && <span style={{ color: '#B42318' }}>连续失败{sched.failStreak}次已熔断，点上方「开始」恢复</span>}
            </div>
            {sched.history && sched.history.length > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid #F0EEEA', paddingTop: 8 }}>
                <div style={{ fontSize: 12, color: '#6B6862', marginBottom: 4 }}>执行记录（最近5条）</div>
                {sched.history.slice(0, 5).map((h, i) => (
                  <div key={i} className="num" style={{ fontSize: 12, color: '#6B6862', display: 'flex', gap: 10, padding: '2px 0' }}>
                    <span style={{ width: 138, flexShrink: 0 }}>{new Date(h.at).toLocaleString('zh-CN', { hour12: false })}</span>
                    <span style={{ width: 44, flexShrink: 0, color: h.ok ? '#1A1A18' : '#B4443C' }}>{h.ok ? '✓ 成功' : '✕ 失败'}</span>
                    <span style={{ width: 40, flexShrink: 0 }}>{h.trigger === 'auto' ? '自动' : h.trigger === 'manual' ? '手动' : '系统'}</span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <Table<TaskItem> size="small" pagination={false} columns={taskCols} dataSource={items} rowKey="type" locale={{ emptyText: '暂无任务' }} />
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#A8A5A0' }}>{tmsg ? <span style={{ color: '#B42318' }}>{tmsg}</span> : '就绪 · 改动即时生效'}</div>
        </div>
        <div>
        <div className="card" style={{ padding: 16 }}>
          <b>消息通知</b>
          <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>浏览器系统通知（60s检查）。{!mounted ? '…' : ('Notification' in window ? `当前权限：${Notification.permission}` : '当前浏览器不支持')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ fontSize: 13, flex: 1 }}>新评论提醒</span>
            <Switch checked={notify} onChange={toggleNotify} checkedChildren="已开启" unCheckedChildren="关闭" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ fontSize: 13, flex: 1 }}>跟进到期提醒<span style={{ fontSize: 11, color: '#A8A5A0', marginLeft: 6 }}>待回访到点提醒你</span></span>
            <Switch checked={followNotify} onChange={toggleFollowNotify} checkedChildren="已开启" unCheckedChildren="关闭" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ fontSize: 13, flex: 1 }}>日报提醒<span style={{ fontSize: 11, color: '#A8A5A0', marginLeft: 6 }}>每天9点提示看经营报告（页面开着时）</span></span>
            <Switch checked={reportNotify} onChange={toggleReportNotify} checkedChildren="已开启" unCheckedChildren="关闭" />
          </div>
        </div>
        <div className="card" style={{ padding: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b>评论自动回复</b>
            {!sched?.auto_reply ? <Tag style={{ marginLeft: 0 }}>…</Tag>
              : sched.auto_reply.ready && sched.auto_reply.enabled ? <Tag color="success">运行中</Tag>
              : sched.auto_reply.enabled ? <Tag color="warning">{sched.auto_reply.gate}</Tag>
              : <Tag>未开启</Tag>}
          </div>
          <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px', lineHeight: 1.8 }}>
            规则命中优先用<b>接待规则</b>文案，否则自动起草话术；<b>live通道 + 官方评论回复能力 + 本开关</b>三门齐备才真发送。
            节奏：随机60-240秒/条 · 每日≤{sched?.auto_reply?.cap ?? 12}条 · 夜间22-8静默——像人，但只在平台给的通道里像。
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ fontSize: 13, flex: 1 }}>
              自动回复总开关
              {sched?.auto_reply && sched.auto_reply.enabled && !sched.auto_reply.ready && <span style={{ fontSize: 11, color: '#8A6D1F', marginLeft: 6 }}>已开启 · {sched.auto_reply.gate}后自动生效</span>}
            </span>
            <Switch checked={sched?.auto_reply?.enabled ?? false} onChange={toggleAutoReply} checkedChildren="已开启" unCheckedChildren="关闭" />
          </div>
          {sched?.auto_reply && (
            <div className="num" style={{ fontSize: 12, color: '#6B6862', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>今日已自动发送 {sched.auto_reply.sentToday}/{sched.auto_reply.cap}{sched.auto_reply.nextInSec !== null && sched.auto_reply.nextInSec > 0 ? ` · 下次检查 ${sched.auto_reply.nextInSec}s 后` : ''}</span>
              {sched.auto_reply.log.length === 0 && <span style={{ color: '#A8A5A0' }}>尚无执行记录（开关打开后，收到新评论即开始自动起草）</span>}
              {sched.auto_reply.log.map((l, i) => (
                <span key={i} style={{ color: l.status === 'sent' ? '#1A1A18' : '#8A6D1F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {new Date(l.at).toLocaleString('zh-CN', { hour12: false }).slice(5)} · {l.status === 'sent' ? '已发送' : '已起草待人工'} · {l.via} · {l.nick}：{l.text.slice(0, 24)}…（{l.note}）
                </span>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 8 }}>私信自动回复：等蓝V与IM能力审核（同架构预留，开通后并入本卡）</div>
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
          <div style={{ padding: '12px 14px', fontWeight: 700 }}>视频跟进队列 <span style={{ fontSize: 12, color: '#A8A5A0', fontWeight: 400 }}>只做提醒+手动清单，不自动执行</span></div>
          <div style={{ padding: '0 14px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select size="small" value={vsel || undefined} onChange={setVsel} style={{ minWidth: 240 }} placeholder="选择视频加入…" options={vvideos.map((v) => ({ value: v.id, label: v.title }))} />
            <Button size="small" type="primary" onClick={addV}>加入队列</Button>
          </div>
          <Table<VideoTask> size="small" pagination={false} columns={vtCols} dataSource={vtasks} rowKey="id" locale={{ emptyText: '暂无，请先加入视频' }} />
        </div>
      </div>
    </div>
  );
}
