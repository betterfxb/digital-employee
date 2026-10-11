'use client';
import { useEffect, useState } from 'react';
import { assistConfig } from '@/config/assist.config';
import { tasksConfig } from '@/config/tasks.config';
import { mockScripts } from '@/lib/mock';
import { downloadCsv } from '@/lib/csv';
import type { ScriptItem, Follow, Video } from '@/lib/types';

/** S4 私信辅助占位：话术+台账走API（失败回退静态），无假会话，imEnabled=false */
export default function Messages() {
  const [scripts, setScripts] = useState<ScriptItem[]>(mockScripts);
  const [rows, setRows] = useState<Follow[] | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [fstatus, setFstatus] = useState('');
  const [fpeer, setFpeer] = useState('');
  const [fsource, setFsource] = useState('v1');
  const [fmsg, setFmsg] = useState('');
  const [stitle, setStitle] = useState('');
  const [scontent, setScontent] = useState('');
  const [rules, setRules] = useState<{ id: string; keyword: string; reply: string; enabled: boolean }[]>([]);
  const [rkw, setRkw] = useState('');
  const [rrp, setRrp] = useState('');
  const [rmsg, setRmsg] = useState('');
  const loadFollows = (st = fstatus) => fetch(`/api/follows${st ? `?status=${encodeURIComponent(st)}` : ''}`).then((r) => r.json()).then((d) => setRows(d.items || [])).catch(() => { setRows([]); setFmsg('加载失败，请刷新重试'); });
  const loadRules = () => fetch('/api/reply-rules').then((r) => r.json()).then((d) => setRules(d.items || [])).catch(() => setRmsg('加载失败，请重试'));
  useEffect(() => {
    fetch('/api/scripts').then((r) => r.json()).then((d) => { if (d.items?.length) setScripts(d.items); }).catch(() => {});
    loadFollows('');
    loadRules();
    fetch('/api/videos').then((r) => r.json()).then((d) => setVideos(d.items || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const addFollow = async () => {
    if (!fpeer.trim()) { setFmsg('请填写对方昵称'); return; }
    const r = await fetch('/api/follows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ peer_nick: fpeer.trim(), source_video_id: fsource }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setFmsg(r?.message || '添加失败'); return; }
    setFpeer(''); setFmsg('已加入台账'); loadFollows();
  };
  const changeStatus = async (id: string, status: string) => {
    const r = await fetch(`/api/follows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setFmsg(r?.message || '状态更新失败'); return; }
    loadFollows();
  };
  const exportFollows = () => {
    const rows = batches.flat();
    if (rows.length === 0) { setFmsg('暂无数据可导出'); return; }
    downloadCsv('跟进台账.csv', ['对方', '状态', '下次提醒', '来源视频'], rows.map((f) => [f.peer_nick, f.status, f.next_remind_at, f.source_video_id]));
  };
  const addScript = async () => {
    if (!stitle.trim() || !scontent.trim()) { setFmsg('请填写标题与内容'); return; }
    const r = await fetch('/api/scripts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: stitle.trim(), content: scontent.trim() }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setFmsg(r?.message || '添加失败'); return; }
    setStitle(''); setScontent('');
    fetch('/api/scripts').then((x) => x.json()).then((d) => { if (d.items?.length) setScripts(d.items); }).catch(() => {});
  };
  const delScript = async (id: string) => {
    const r = await fetch(`/api/scripts/${id}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setFmsg(r?.message || '删除失败'); return; }
    fetch('/api/scripts').then((x) => x.json()).then((d) => setScripts(d.items || [])).catch(() => {});
  };
  const addRule = async () => {
    if (!rkw.trim() || !rrp.trim()) { setRmsg('请填写关键词与回复'); return; }
    const r = await fetch('/api/reply-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyword: rkw.trim(), reply: rrp.trim() }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setRmsg(r?.message || '添加失败'); return; }
    setRkw(''); setRrp(''); setRmsg(''); loadRules();
  };
  const toggleRule = async (id: string, enabled: boolean) => {
    const r = await fetch(`/api/reply-rules/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setRmsg('操作失败'); return; }
    loadRules();
  };
  const delRule = async (id: string) => {
    const r = await fetch(`/api/reply-rules/${id}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setRmsg('删除失败'); return; }
    loadRules();
  };
  // 展示用分批：将台账按 followBatchSize 切批（截图“@每组N用户”合规版，只分组提醒，不自动@）
  const batches: Follow[][] = [];
  (rows || []).forEach((f, i) => {
    const g = Math.floor(i / tasksConfig.followBatchSize);
    (batches[g] = batches[g] || []).push(f);
  });
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
          {[['待回访', rows ? rows.filter((f) => f.status === '待回访').length : '—'], ['已转化', rows ? rows.filter((f) => f.status === '已转化').length : '—'], ['跟进总数', rows ? rows.length : '—']].map(([k, v], i) => (
            <div key={k as string} style={{ flex: 1, padding: '12px 18px', borderLeft: i ? '1px solid #E8E6E1' : 'none' }}>
              <div style={{ fontSize: 12, color: '#6B6862' }}>{k}</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="card" style={{ padding: 16, flex: 1 }}>
            <b>话术库</b><div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 4 }}>内置3条＋自定义（删除仅删自定义）</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input value={stitle} onChange={(e) => setStitle(e.target.value)} placeholder="标题" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px', width: 90 }} />
              <input value={scontent} onChange={(e) => setScontent(e.target.value)} placeholder="话术内容" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px', flex: 1 }} />
              <button className="btn small" onClick={addScript}>添加</button>
            </div>
            {scripts.map((s) => <div key={s.id} style={{ border: '1px solid #E8E6E1', borderRadius: 4, padding: '10px 12px', marginTop: 10 }}>{s.content}<div style={{ display: 'flex', gap: 6, marginTop: 6 }}>{!['s1', 's2', 's3'].includes(s.id) && <button className="btn ghost small" onClick={() => delScript(s.id)}>删除</button>}</div></div>)}</div>
          <div className="card" style={{ padding: 16, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b>手动跟进台账</b>
              <span style={{ flex: 1 }} />
              <select value={fstatus} onChange={(e) => { setFstatus(e.target.value); loadFollows(e.target.value); }} style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}>
                <option value="">全部状态</option>
                {assistConfig.followStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="num" style={{ fontSize: 12, color: '#6B6862', marginTop: 4 }}>每批{tasksConfig.followBatchSize}个 · 每{tasksConfig.groupFollowIntervalMin}分钟一批 · 默认{assistConfig.defaultRemindHour}:00提醒（纯展示，不自动发送）</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={fpeer} onChange={(e) => setFpeer(e.target.value)} placeholder="对方昵称" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px', width: 130 }} />
              <select value={fsource} onChange={(e) => setFsource(e.target.value)} style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px' }}>
                {videos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
              <button className="btn small" onClick={addFollow}>加入跟进</button>
              <button className="btn ghost small" onClick={exportFollows}>导出CSV</button>
              {fmsg && <span style={{ fontSize: 12, color: '#6B6862', alignSelf: 'center' }}>{fmsg}</span>}
            </div>
            <table style={{ marginTop: 8 }}><thead><tr><th>批次</th><th>对方</th><th>状态</th><th>下次提醒</th></tr></thead><tbody>{rows === null ? <tr><td colSpan={4} style={{ color: '#A8A5A0' }}>加载中…</td></tr> : rows.length === 0 ? <tr><td colSpan={4} style={{ color: '#A8A5A0' }}>暂无跟进</td></tr> : batches.map((g, gi) => g.map((f, si) => <tr key={f.id}><td className="num">{si === 0 ? `第${gi + 1}批` : ''}</td><td>{f.peer_nick}</td><td><select value={f.status} onChange={(e) => changeStatus(f.id, e.target.value)} style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '5px 6px', fontSize: 12 }}>{assistConfig.followStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></td><td className="num">{f.next_remind_at}</td></tr>))}</tbody></table>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <b>接待规则</b>
            <span style={{ fontSize: 11, color: '#fff', background: '#A8A5A0', borderRadius: 10, padding: '1px 8px' }}>休眠中 · 企业号授权后方可执行</span>
            <span style={{ flex: 1 }} />
            {rmsg && <span style={{ fontSize: 12, color: '#6B6862' }}>{rmsg}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={rkw} onChange={(e) => setRkw(e.target.value)} placeholder="关键词，如 价格" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px', width: 150 }} />
            <input value={rrp} onChange={(e) => setRrp(e.target.value)} placeholder="自动回复内容" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px', flex: 1 }} />
            <button className="btn small" onClick={addRule}>添加规则</button>
          </div>
          <table style={{ marginTop: 10 }}><thead><tr><th>关键词</th><th>回复</th><th>启用</th><th></th></tr></thead>
            <tbody>{rules.length === 0 ? <tr><td colSpan={4} style={{ color: '#A8A5A0' }}>暂无规则</td></tr> : rules.map((r) => <tr key={r.id}><td><b>{r.keyword}</b></td><td>{r.reply}</td><td><input type="checkbox" checked={r.enabled} onChange={(e) => toggleRule(r.id, e.target.checked)} /></td><td><button className="btn ghost small" onClick={() => delRule(r.id)}>删除</button></td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}
