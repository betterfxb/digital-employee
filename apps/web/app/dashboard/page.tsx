'use client';
import { useEffect, useState } from 'react';
import { statsConfig } from '@/config/stats.config';
import type { Video, Competitor, Overview, TrendPoint, CommentItem } from '@/lib/types';
import { TaskBar } from '@/components/TaskBar';

/** S2 看板：指标条+作品表+趋势抽屉+竞品导入+手动同步冷却 */
export default function Dashboard() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [cool, setCool] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');
  const [emsg, setEmsg] = useState('');
  const [derr, setDerr] = useState(false);
  const [trend, setTrend] = useState<{ id: string; title: string; rows: TrendPoint[] } | null>(null);
  const [trendDays, setTrendDays] = useState(7);
  const [comps, setComps] = useState<Competitor[]>([]);
  const [allTrend, setAllTrend] = useState<Record<string, TrendPoint[]>>({});
  const [intents, setIntents] = useState<{ intent: string; n: number }[]>([]);
  const [topHigh, setTopHigh] = useState<CommentItem[]>([]);
  const [curl, setCurl] = useState('');
  const [csource, setCsource] = useState('manual');
  const [ckind, setCkind] = useState('note');
  const KINDS: [string, string][] = [['note', '笔记'], ['author', '作者'], ['comment', '评论'], ['user', '用户']];
  const [cmsg, setCmsg] = useState('');

  const loadComps = () => fetch('/api/competitors').then((r) => r.json()).then((d) => setComps(d.items || [])).catch(() => {});

  useEffect(() => {
    fetch('/api/stats/overview').then((r) => r.json()).then((d) => { setDerr(false); setOv(d); }).catch(() => setDerr(true));
    fetch('/api/videos').then((r) => r.json()).then((d) => {
      const vs: Video[] = d.items || [];
      setVideos(vs);
      const ids = vs.map((v) => v.aweme_id || v.id).join(',');
      if (ids) fetch(`/api/stats/trend?ids=${ids}&days=7`).then((r) => r.json()).then(setAllTrend).catch(() => {});
    }).catch(() => setDerr(true));
    fetch('/api/comments?unread_only=0').then((r) => r.json()).then((d) => {
      const items = (d.items || []) as CommentItem[];
      const m = new Map<string, number>();
      items.forEach((x) => m.set(x.intent, (m.get(x.intent) || 0) + 1));
      setIntents([...m.entries()].map(([intent, n]) => ({ intent, n })).sort((a, b) => b.n - a.n));
      setTopHigh(items.filter((x) => x.intent === '高意向').sort((a, b) => b.like_count - a.like_count).slice(0, 3));
    }).catch(() => {});
    loadComps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadStats = () => {
    fetch('/api/stats/overview').then((r) => r.json()).then(setOv).catch(() => {});
    fetch('/api/videos').then((r) => r.json()).then((d) => setVideos(d.items || [])).catch(() => {});
    loadComps();
  };

  const sync = async () => {
    if (cool > 0) return;
    setSyncMsg('');
    const r = await fetch('/api/stats/sync', { method: 'POST' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { setSyncMsg('同步失败，请重试'); return; }
    reloadStats();
    setCool(statsConfig.manualSyncCooldownSec);
    const id = setInterval(() => setCool((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1; }), 1000);
  };

  const openTrend = (id: string, title: string, days = trendDays) => {
    setTrend({ id, title, rows: [] });
    fetch(`/api/stats/trend?ids=${id}&days=${days}`).then((r) => r.json()).then((d) => setTrend({ id, title, rows: d[id] || [] })).catch(() => { setTrend(null); setEmsg('趋势加载失败，请重试'); });
  };

  const addComp = async () => {
    if (!curl.trim()) { setCmsg('请填写链接/备注'); return; }
    const r = await fetch('/api/competitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: curl.trim(), source: csource, kind: ckind }) }).then((x) => x.json());
    if (r.code) { setCmsg(r.message); return; }
    setCurl(''); setCmsg('已加入'); loadComps();
  };

  // 趋势迷你线：rows→100x36折线点串（纯展示，无动画）
  const spark = (rows: TrendPoint[]) => {
    const max = Math.max(...rows.map((r) => r.play), 1);
    return rows.map((r, i: number) => `${(i / Math.max(rows.length - 1, 1)) * 100},${34 - (r.play / max) * 32}`).join(' ');
  };

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1', display: 'flex', alignItems: 'center' }}>
        <div><b style={{ fontSize: 15 }}>数据看板</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>昨日数据・今晨6点更新</div></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>{emsg && <span style={{ fontSize: 12, color: '#6B6862' }}>{emsg}</span>}<button className="btn ghost small" onClick={sync}>{cool > 0 ? `${cool}s后可同步` : '手动同步'}</button></div>
      </div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        <TaskBar />
        {!ov ? (derr ? <div className="card" style={{ padding: 24, marginBottom: 16 }}>数据加载失败 <button className="btn ghost small" style={{ marginLeft: 8 }} onClick={() => { setDerr(false); reloadStats(); }}>重试</button></div> : <div className="skel" style={{ height: 96 }}>loading</div>) : (
          <div style={{ display: 'flex', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 4, marginBottom: 16 }}>
          {(() => {
            const tp = videos.reduce((a, v) => a + v.play, 0);
            const tl = videos.reduce((a, v) => a + v.like, 0);
            const ts = videos.reduce((a, v) => a + v.share, 0);
            const cells: [string, string][] = [['总播放', ov.play.toLocaleString()], ['总点赞', ov.like.toLocaleString()], ['总评论', ov.comment.toLocaleString()], ['净增粉', `+${ov.fans_new.toLocaleString()}`], ['转发总数', ts.toLocaleString()], ['平均点赞率', tp ? `${(tl / tp * 100).toFixed(1)}%` : '—']];
            return cells.map(([k, v], i) => (
              <div key={k} style={{ flex: 1, padding: '16px 20px', borderLeft: i ? '1px solid #E8E6E1' : 'none', minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#6B6862' }}>{k}</div>
                <div className="num" style={{ fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            ));
          })()}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 16, marginBottom: 16, marginTop: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <b>近7天播放总览</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>全账号作品汇总 · T+1</span>
            {(() => {
              const days = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'D-0'];
              const totals = days.map((d) => Object.values(allTrend).reduce((a, rows) => a + (rows.find((r) => r.date === d)?.play || 0), 0));
              if (totals.every((t) => t === 0)) return <div className="skel" style={{ height: 120, marginTop: 12 }}>loading</div>;
              const max = Math.max(...totals, 1);
              const pts = totals.map((t, i) => `${(i / 6) * 300},${86 - (t / max) * 78}`).join(' ');
              return (
                <div>
                  <svg viewBox="0 0 300 90" style={{ width: '100%', height: 130, marginTop: 12 }} role="img" aria-label="全账号播放总览">
                    <polyline points={pts} fill="none" stroke="#1A1A18" strokeWidth="2" />
                  </svg>
                  <div className="num" style={{ display: 'flex', gap: 16, fontSize: 12, color: '#6B6862', flexWrap: 'wrap' }}>
                    {videos.map((v) => <span key={v.id}>{v.title.slice(0, 8)}… <b style={{ color: '#1A1A18' }}>{(allTrend[v.aweme_id || v.id]?.[6]?.play || 0).toLocaleString()}</b></span>)}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="card" style={{ padding: 18 }}>
            <b>评论意图分布</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>全部评论累计</span>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {intents.length === 0 && <div style={{ fontSize: 12, color: '#A8A5A0' }}>加载中…</div>}
              {(() => { const max = Math.max(...intents.map((x) => x.n), 1); return intents.map((x) => (
                <div key={x.intent} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ width: 52 }}>{x.intent}</span>
                  <div style={{ flex: 1, height: 8, background: '#F0EEEA', borderRadius: 4 }}><div style={{ width: `${(x.n / max) * 100}%`, height: 8, background: '#1A1A18', borderRadius: 4 }} /></div>
                  <span className="num" style={{ width: 32, textAlign: 'right' }}>{x.n}</span>
                </div>
              )); })()}
            </div>
            <div style={{ marginTop: 14, borderTop: '1px solid #E8E6E1', paddingTop: 10 }}>
              <div style={{ fontSize: 12, color: '#6B6862', marginBottom: 6 }}>高意向 TOP3（按赞排序）</div>
              {topHigh.length === 0 && <div style={{ fontSize: 12, color: '#A8A5A0' }}>暂无</div>}
              {topHigh.map((c) => <div key={c.id} style={{ fontSize: 13, padding: '6px 0', borderBottom: '1px solid #F0EEEA' }}><b>{c.user_nick}</b> · {c.content.slice(0, 22)}{c.content.length > 22 ? '…' : ''} <span className="num" style={{ color: '#A8A5A0', fontSize: 12 }}>赞{c.like_count}</span></div>)}
            </div>
          </div>
        </div>
        <div className="card">
          <table><thead><tr><th>作品</th><th>发布时间</th><th>播放</th><th>点赞</th><th>点赞率</th><th>评论</th><th>转发</th><th>近7天</th><th></th></tr></thead>
            <tbody className="num">{videos.map((v) => { const rows = allTrend[v.aweme_id || v.id] || []; return (<tr key={v.id}><td>{v.title}</td><td>{v.publish_time}</td><td>{v.play.toLocaleString()}</td><td>{v.like.toLocaleString()}</td><td>{v.play ? `${(v.like / v.play * 100).toFixed(1)}%` : '—'}</td><td>{v.comment}</td><td>{v.share}</td><td>{rows.length ? <svg viewBox="0 0 90 28" style={{ width: 90, height: 28 }} aria-hidden="true"><polyline points={spark(rows)} fill="none" stroke="#1A1A18" strokeWidth="1.6" /></svg> : '—'}</td><td><button className="btn ghost small" onClick={() => openTrend(v.aweme_id || v.id, v.title, trendDays)}>趋势</button></td></tr>); })}</tbody></table>
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#A8A5A0' }}>服务端分页 · 20/页 · 趋势批量上限{statsConfig.trendBatchMax}</div>
        </div>
        <div className="card" style={{ marginTop: 16, padding: 16, background: '#F7F6F3' }}>
          <b>竞品手动导入</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>官方不给全平台数据，此区与自有数据隔离</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input value={curl} onChange={(e) => setCurl(e.target.value)} placeholder="链接/备注，如 同城店B·契约陪玩" style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px', width: 280 }} />
            <select value={csource} onChange={(e) => setCsource(e.target.value)} style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px' }}>
              {statsConfig.competitorSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={ckind} onChange={(e) => setCkind(e.target.value)} style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '7px 10px' }}>
              {KINDS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <button className="btn small" onClick={addComp}>加入</button>
            {cmsg && <span style={{ fontSize: 12, color: '#6B6862', alignSelf: 'center' }}>{cmsg}</span>}
          </div>
          <table style={{ marginTop: 10, background: '#fff', border: '1px solid #E8E6E1', borderRadius: 4 }}><thead><tr><th>来源</th><th>槽位</th><th>链接/备注</th><th>播放</th><th>点赞</th></tr></thead>
            <tbody className="num">{comps.map((c) => <tr key={c.id}><td>{c.source}</td><td>{({ note: '笔记', author: '作者', comment: '评论', user: '用户' } as Record<string, string>)[c.kind || 'note'] || c.kind}</td><td>{c.url}</td><td>{c.play.toLocaleString()}</td><td>{c.like.toLocaleString()}</td></tr>)}</tbody></table>
        </div>
        {trend && (
          <div style={{ position: 'fixed', right: 0, top: 60, bottom: 0, width: 380, background: '#fff', borderLeft: '1px solid #E8E6E1', borderTop: '1px solid #E8E6E1', padding: 20, zIndex: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><b>{trend.title}</b><span style={{ flex: 1 }} />
              <select value={trendDays} onChange={(e) => { const d = Number(e.target.value); setTrendDays(d); if (trend) openTrend(trend.id, trend.title, d); }} style={{ border: '1px solid #D8D5CF', borderRadius: 4, padding: '6px 8px', fontSize: 12 }}>
                {statsConfig.trendDaysOptions.map((d) => <option key={d} value={d}>近{d}天</option>)}
              </select>
            </div><div style={{ fontSize: 12, color: '#A8A5A0' }}>T+1</div>
            {trend.rows.length === 0 ? <div className="skel" style={{ height: 120, marginTop: 12 }}>loading</div> : (
              <div>
                <svg viewBox="0 0 100 36" style={{ width: '100%', height: 72, marginTop: 12 }} role="img" aria-label="播放趋势迷你线">
                  <polyline points={spark(trend.rows)} fill="none" stroke="#1A1A18" strokeWidth="1.6" />
                </svg>
                <table style={{ marginTop: 8 }}><thead><tr><th>日期</th><th>播放</th><th>点赞</th></tr></thead>
                  <tbody className="num">{trend.rows.map((r: TrendPoint) => <tr key={r.date}><td>{r.date}</td><td>{r.play.toLocaleString()}</td><td>{r.like.toLocaleString()}</td></tr>)}</tbody></table>
              </div>
            )}
            <div style={{ marginTop: 12 }}><button className="btn ghost small" onClick={() => setTrend(null)}>关闭</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
