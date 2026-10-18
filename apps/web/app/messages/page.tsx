'use client';
import { useEffect, useState } from 'react';
import { App, Button, Checkbox, Input, Popconfirm, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { assistConfig } from '@/config/assist.config';
import { tasksConfig } from '@/config/tasks.config';
import { mockScripts } from '@/lib/mock';
import { downloadCsv } from '@/lib/csv';
import type { ScriptItem, Follow, Video } from '@/lib/types';

/** S4 私信辅助占位：话术+台账走API（失败回退静态），无假会话，imEnabled=false */
export default function Messages() {
  const { message } = App.useApp();
  const [scripts, setScripts] = useState<ScriptItem[]>(mockScripts);
  const [rows, setRows] = useState<Follow[] | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [fstatus, setFstatus] = useState('');
  const [fpeer, setFpeer] = useState('');
  const [fsource, setFsource] = useState('v1');
  const [fsearch, setFsearch] = useState('');
  const [amtEdit, setAmtEdit] = useState<{ id: string; val: string } | null>(null);
  const [stitle, setStitle] = useState('');
  const [scontent, setScontent] = useState('');
  const [rules, setRules] = useState<{ id: string; keyword: string; reply: string; enabled: boolean }[]>([]);
  const [rkw, setRkw] = useState('');
  const [rrp, setRrp] = useState('');
  const flash = (t: string, ok = false) => (ok ? message.success(t) : message.error(t));
  const loadFollows = (st = fstatus) => fetch(`/api/follows${st ? `?status=${encodeURIComponent(st)}` : ''}`).then((r) => r.json()).then((d) => setRows(d.items || [])).catch(() => { setRows([]); flash('台账加载失败，请刷新重试'); });
  const loadRules = () => fetch('/api/reply-rules').then((r) => r.json()).then((d) => setRules(d.items || [])).catch(() => flash('规则加载失败，请重试'));
  useEffect(() => {
    fetch('/api/scripts').then((r) => r.json()).then((d) => { if (d.items?.length) setScripts(d.items); }).catch(() => {});
    loadFollows('');
    loadRules();
    fetch('/api/videos').then((r) => r.json()).then((d) => setVideos(d.items || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const addFollow = async () => {
    if (!fpeer.trim()) { flash('请填写对方昵称'); return; }
    const r = await fetch('/api/follows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ peer_nick: fpeer.trim(), source_video_id: fsource }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '添加失败'); return; }
    setFpeer(''); flash('已加入台账', true); loadFollows();
  };
  const changeStatus = async (id: string, status: string) => {
    const r = await fetch(`/api/follows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '状态更新失败'); return; }
    loadFollows();
  };
  /** S43 成交记账 */
  const saveAmount = async (id: string) => {
    const n = Number(amtEdit?.val);
    if (!amtEdit || amtEdit.id !== id || !Number.isFinite(n) || n < 0) { flash('请输入有效金额'); return; }
    const r = await fetch(`/api/follows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: n }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '记账失败'); return; }
    setAmtEdit(null); flash('已记账', true); loadFollows();
  };
  const batches: Follow[][] = [];
  (rows || []).forEach((f, i) => {
    const g = Math.floor(i / tasksConfig.followBatchSize);
    (batches[g] = batches[g] || []).push(f);
  });
  const batchLabel = new Map<string, string>();
  batches.forEach((g, gi) => { if (g[0]) batchLabel.set(g[0].id, `第${gi + 1}批`); });
  const exportFollows = () => {
    const flat = batches.flat();
    if (flat.length === 0) { flash('暂无数据可导出'); return; }
    downloadCsv('跟进台账.csv', ['对方', '状态', '下次提醒', '来源视频', '成交金额'], flat.map((f) => [f.peer_nick, f.status, f.next_remind_at, f.source_video_id, f.amount ?? '']));
  };
  const addScript = async () => {
    if (!stitle.trim() || !scontent.trim()) { flash('请填写标题与内容'); return; }
    const r = await fetch('/api/scripts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: stitle.trim(), content: scontent.trim() }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '添加失败'); return; }
    setStitle(''); setScontent('');
    fetch('/api/scripts').then((x) => x.json()).then((d) => { if (d.items?.length) setScripts(d.items); }).catch(() => {});
  };
  const delScript = async (id: string) => {
    const r = await fetch(`/api/scripts/${id}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '删除失败'); return; }
    fetch('/api/scripts').then((x) => x.json()).then((d) => setScripts(d.items || [])).catch(() => {});
  };
  const addRule = async () => {
    if (!rkw.trim() || !rrp.trim()) { flash('请填写关键词与回复'); return; }
    const r = await fetch('/api/reply-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: rkw.trim(), reply: rrp.trim() }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '添加失败'); return; }
    setRkw(''); setRrp(''); loadRules();
  };
  const toggleRule = async (id: string, enabled: boolean) => {
    const r = await fetch(`/api/reply-rules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash('操作失败'); return; }
    loadRules();
  };
  const delRule = async (id: string) => {
    const r = await fetch(`/api/reply-rules/${id}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash('删除失败'); return; }
    loadRules();
  };

  const followCols: ColumnsType<Follow> = [
    { title: '批次', key: 'batch', width: 80, onCell: () => ({ className: 'num' }), render: (_, f) => batchLabel.get(f.id) || '' },
    { title: '对方', dataIndex: 'peer_nick', key: 'nick' },
    { title: '状态', key: 'status', width: 120, render: (_, f) => <Select size="small" value={f.status} onChange={(v) => changeStatus(f.id, v)} style={{ width: '100%' }} options={assistConfig.followStatuses.map((s) => ({ value: s, label: s }))} /> },
    { title: '成交', key: 'amt', width: 130, render: (_, f) => (
      f.status !== '已转化' ? <span className="num" style={{ color: '#A8A5A0' }}>—</span>
      : f.amount != null ? <span className="num">¥{f.amount.toLocaleString()}</span>
      : (
        <Popconfirm
          title="记一笔成交"
          description={<Input size="small" placeholder="金额（元）" value={amtEdit?.id === f.id ? amtEdit.val : ''} onChange={(e) => setAmtEdit({ id: f.id, val: e.target.value })} onPressEnter={() => saveAmount(f.id)} style={{ marginTop: 6 }} />}
          okText="记账" cancelText="取消" onConfirm={() => saveAmount(f.id)}
        >
          <Button size="small">记账</Button>
        </Popconfirm>
      )
    ) },
    { title: '下次提醒', dataIndex: 'next_remind_at', key: 'remind', onCell: () => ({ className: 'num' }) },
  ];

  const ruleCols: ColumnsType<{ id: string; keyword: string; reply: string; enabled: boolean }> = [
    { title: '关键词', dataIndex: 'keyword', key: 'kw', render: (v) => <b>{v}</b> },
    { title: '回复', dataIndex: 'reply', key: 'reply' },
    { title: '启用', key: 'on', width: 70, render: (_, r) => <Checkbox checked={r.enabled} onChange={(e) => toggleRule(r.id, e.target.checked)} /> },
    { title: '', key: 'act', width: 70, render: (_, r) => <Button size="small" onClick={() => delRule(r.id)}>删除</Button> },
  ];

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1' }}><b style={{ fontSize: 15 }}>私信辅助</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>需蓝V · 当前仅话术+台账</div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        <div className="card" id="upgrade" style={{ padding: 28, background: '#FCFBF9' }}>
          <b>私信需蓝V后开通</b>
          <p style={{ color: '#6B6862' }}>个人号官方不开放IM接口，无法同步会话与已读。升级后本页直接切换官方会话（im_enabled=false 预留）。</p>
          <div style={{ fontSize: 12, color: '#6B6862' }}>分类：{assistConfig.scriptCategories.join(' / ')} · 默认提醒 {assistConfig.defaultRemindHour}:00</div>
        </div>
        <div style={{ display: 'flex', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 4, marginBottom: 16 }}>
          {(() => {
            const done = rows ? rows.filter((f) => f.status === '已转化') : [];
            const revenue = done.reduce((a, f) => a + (f.amount || 0), 0);
            const rate = rows && rows.length ? Math.round((done.length / rows.length) * 100) : 0;
            const cells: [string, string, string][] = [
              ['待回访', rows ? String(rows.filter((f) => f.status === '待回访').length) : '—', ''],
              ['已转化', rows ? String(done.length) : '—', ''],
              ['跟进总数', rows ? String(rows.length) : '—', ''],
              ['成交额', `¥${revenue.toLocaleString()}`, `转化率 ${rate}%`],
            ];
            return cells.map(([k, v, sub], i) => (
              <div key={k} style={{ flex: 1, padding: '12px 18px', borderLeft: i ? '1px solid #E8E6E1' : 'none' }}>
                <div style={{ fontSize: 12, color: '#6B6862' }}>{k}</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{v}{sub && <span style={{ fontSize: 12, fontWeight: 400, color: '#6B6862', marginLeft: 8 }}>{sub}</span>}</div>
              </div>
            ));
          })()}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: 16, flex: 1 }}>
            <b>话术库</b><div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 4 }}>内置3条＋自定义（删除仅删自定义）</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Input size="small" value={stitle} onChange={(e) => setStitle(e.target.value)} placeholder="标题" style={{ width: 90 }} />
              <Input size="small" value={scontent} onChange={(e) => setScontent(e.target.value)} placeholder="话术内容" onPressEnter={addScript} />
              <Button size="small" type="primary" onClick={addScript}>添加</Button>
            </div>
            {scripts.map((s) => <div key={s.id} style={{ border: '1px solid #E8E6E1', borderRadius: 4, padding: '10px 12px', marginTop: 10 }}>{s.content}<div style={{ display: 'flex', gap: 6, marginTop: 6 }}>{!['s1', 's2', 's3'].includes(s.id) && <Button size="small" type="text" onClick={() => delScript(s.id)}>删除</Button>}</div></div>)}</div>
          <div className="card" style={{ padding: 16, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b>手动跟进台账</b>
              <span style={{ flex: 1 }} />
              <Select size="small" value={fstatus} onChange={(v) => { setFstatus(v); loadFollows(v); }} style={{ width: 120 }} options={[{ value: '', label: '全部状态' }, ...assistConfig.followStatuses.map((s) => ({ value: s, label: s }))]} />
            </div>
            <div className="num" style={{ fontSize: 12, color: '#6B6862', marginTop: 4 }}>每批{tasksConfig.followBatchSize}个 · 每{tasksConfig.groupFollowIntervalMin}分钟一批 · 默认{assistConfig.defaultRemindHour}:00提醒（纯展示，不自动发送）</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Input size="small" value={fpeer} onChange={(e) => setFpeer(e.target.value)} placeholder="对方昵称" style={{ width: 130 }} onPressEnter={addFollow} />
              <Select size="small" value={fsource} onChange={setFsource} style={{ minWidth: 200 }} options={videos.map((v) => ({ value: v.id, label: v.title }))} />
              <Button size="small" type="primary" onClick={addFollow}>加入跟进</Button>
              <Input size="small" value={fsearch} onChange={(e) => setFsearch(e.target.value)} placeholder="搜对方昵称" style={{ width: 120 }} allowClear />
              <Button size="small" onClick={exportFollows}>导出CSV</Button>
            </div>
            <Table<Follow> size="small" pagination={false} style={{ marginTop: 8 }} columns={followCols} dataSource={(rows || []).filter((f) => !fsearch.trim() || f.peer_nick.includes(fsearch.trim()))} rowKey="id" loading={rows === null} locale={{ emptyText: '暂无跟进' }} />
          </div>
        </div>
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b>接待规则</b>
            <span style={{ fontSize: 11, color: '#fff', background: '#A8A5A0', borderRadius: 10, padding: '1px 8px' }}>休眠中 · 企业号授权后方可执行</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Input size="small" value={rkw} onChange={(e) => setRkw(e.target.value)} placeholder="关键词，如 价格" style={{ width: 150 }} />
            <Input size="small" value={rrp} onChange={(e) => setRrp(e.target.value)} placeholder="自动回复内容" onPressEnter={addRule} />
            <Button size="small" type="primary" onClick={addRule}>添加规则</Button>
          </div>
          <Table size="small" pagination={false} style={{ marginTop: 10 }} columns={ruleCols} dataSource={rules} rowKey="id" locale={{ emptyText: '暂无规则' }} />
        </div>
      </div>
    </div>
  );
}
