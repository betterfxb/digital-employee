'use client';
import { useEffect, useRef, useState } from 'react';
import { App, Button, Drawer, Input, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { statsConfig } from '@/config/stats.config';
import { downloadCsv } from '@/lib/csv';
import type { Video, Competitor, Overview, TrendPoint, CommentItem } from '@/lib/types';
import { TaskBar } from '@/components/TaskBar';

/** S2 看板：指标条+作品表+趋势抽屉+竞品导入+手动同步冷却 */
export default function Dashboard() {
  const { message } = App.useApp();
  const [ov, setOv] = useState<Overview | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [cool, setCool] = useState(0);
  const [syncMsg, setSyncMsg] = useState('');
  const [derr, setDerr] = useState(false);
  const [trend, setTrend] = useState<{ id: string; title: string; rows: TrendPoint[] | null } | null>(null);
  const [comps, setComps] = useState<Competitor[]>([]);
  const [allTrend, setAllTrend] = useState<Record<string, TrendPoint[]>>({});
  const [intents, setIntents] = useState<{ intent: string; n: number }[]>([]);
  const [topHigh, setTopHigh] = useState<CommentItem[]>([]);
  const [curl, setCurl] = useState('');
  const [csource, setCsource] = useState('manual');
  const [ckind, setCkind] = useState('note');
  const KINDS: [string, string][] = [['note', '笔记'], ['author', '作者'], ['comment', '评论'], ['user', '用户']];
  const [cmsg, setCmsg] = useState('');
  const [impMsg, setImpMsg] = useState('');
  const vFileRef = useRef<HTMLInputElement>(null);
  const cFileRef = useRef<HTMLInputElement>(null);

  const doImport = (kind: 'videos' | 'comments', file?: File) => {
    if (!file) return;
    file.text().then((csv) => fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, csv }),
    }).then((r) => r.json()).then((r) => {
      if (r.code) { message.error(r.message); return; }
      const n = (r.created || 0) + (r.updated || 0);
      setImpMsg(`导入${kind === 'videos' ? '作品' : '评论'}成功 ${n}条${r.skipped ? `（跳过${r.skipped}条，视频标题未匹配）` : ''}${r.updated ? ` · 更新${r.updated}` : ''}`);
      reloadStats();
    }).catch(() => message.error('导入失败，请重试')));
  };

  const dlTemplate = (kind: 'videos' | 'comments') => {
    if (kind === 'videos') downloadCsv('作品导入模板.csv', ['标题', '发布时间', '播放', '点赞', '评论', '转发'], [['三角洲跑刀实录 · 一局爆仓', '10-08', 48201, 4102, 312, 410]]);
    else downloadCsv('评论导入模板.csv', ['昵称', '内容', '视频标题', '时间', '点赞'], [['刀友老陈', '跑刀一单多少钱？怎么下单？', '三角洲跑刀实录 · 一局爆仓', '2小时前', 12]]);
  };

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
    fetch('/api/videos').then((r) => r.json()).then((d) => {
      const vs: Video[] = d.items || [];
      setVideos(vs);
      const ids = vs.map((v) => v.aweme_id || v.id).join(',');
      if (ids) fetch(`/api/stats/trend?ids=${ids}&days=7`).then((r) => r.json()).then(setAllTrend).catch(() => {});
    }).catch(() => {});
    loadComps();
  };

  const sync = async () => {
    if (cool > 0) return;
    setSyncMsg('');
    const r = await fetch('/api/stats/sync', { method: 'POST' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error('同步失败，请重试'); return; }
    reloadStats();
    setCool(statsConfig.manualSyncCooldownSec);
    const id = setInterval(() => setCool((c) => { if (c <= 1) { clearInterval(id); return 0; } return c - 1 }), 1000);
  };

  const openTrend = (id: string, title: string) => {
    setTrend({ id, title, rows: null });
    fetch(`/api/stats/trend?ids=${id}&days=7`).then((r) => r.json()).then((d) => setTrend({ id, title, rows: d[id] || [] })).catch(() => { setTrend(null); message.error('趋势加载失败，请重试'); });
  };

  const addComp = async () => {
    if (!curl.trim()) { setCmsg('请填写链接/备注'); return; }
    const r = await fetch('/api/competitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: curl.trim(), source: csource, kind: ckind }) }).then((x) => x.json());
    if (r.code) { setCmsg(r.message); return; }
    setCurl(''); setCmsg('已加入'); loadComps();
  };

  const spark = (rows: TrendPoint[]) => {
    const max = Math.max(...rows.map((r) => r.play), 1);
    return rows.map((r, i: number) => `${(i / Math.max(rows.length - 1, 1)) * 100},${34 - (r.play / max) * 32}`).join(' ');
  };

  const videoCols: ColumnsType<Video> = [
    { title: '作品', dataIndex: 'title', key: 'title' },
    { title: '发布时间', dataIndex: 'publish_time', key: 'pt', onCell: () => ({ className: 'num' }) },
    { title: '播放', key: 'play', onCell: () => ({ className: 'num' }), render: (_, v) => v.play.toLocaleString() },
    { title: '点赞', key: 'like', onCell: () => ({ className: 'num' }), render: (_, v) => v.like.toLocaleString() },
    { title: '点赞率', key: 'lr', onCell: () => ({ className: 'num' }), render: (_, v) => (v.play ? `${(v.like / v.play * 100).toFixed(1)}%` : '—') },
    { title: '评论', dataIndex: 'comment', key: 'cm', onCell: () => ({ className: 'num' }) },
    { title: '转发', dataIndex: 'share', key: 'sh', onCell: () => ({ className: 'num' }) },
    { title: '近7天', key: 'spark', render: (_, v) => { const rows = allTrend[v.aweme_id || v.id] || []; return rows.length ? <svg viewBox="0 0 90 28" style={{ width: 90, height: 28 }} aria-hidden="true"><polyline points={spark(rows)} fill="none" stroke="#1A1A18" strokeWidth="1.6" /></svg> : '—'; } },
    { title: '', key: 'act', width: 80, render: (_, v) => <Button size="small" onClick={() => openTrend(v.aweme_id || v.id, v.title)}>趋势</Button> },
  ];

  const compCols: ColumnsType<Competitor> = [
    { title: '来源', dataIndex: 'source', key: 'src', onCell: () => ({ className: 'num' }) },
    { title: '槽位', key: 'kind', onCell: () => ({ className: 'num' }), render: (_, c) => ({ note: '笔记', author: '作者', comment: '评论', user: '用户' } as Record<string, string>)[c.kind || 'note'] || c.kind },
    { title: '链接/备注', dataIndex: 'url', key: 'url' },
    { title: '播放', key: 'play', onCell: () => ({ className: 'num' }), render: (_, c) => c.play.toLocaleString() },
    { title: '点赞', key: 'like', onCell: () => ({ className: 'num' }), render: (_, c) => c.like.toLocaleString() },
  ];

  const trendRows: ColumnsType<TrendPoint> = [
    { title: '日期', dataIndex: 'date', key: 'd', onCell: () => ({ className: 'num' }) },
    { title: '播放', key: 'play', onCell: () => ({ className: 'num' }), render: (_, r) => r.play.toLocaleString() },
    { title: '点赞', key: 'like', onCell: () => ({ className: 'num' }), render: (_, r) => r.like.toLocaleString() },
  ];

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1', display: 'flex', alignItems: 'center' }}>
        <div><b style={{ fontSize: 15 }}>数据看板</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>{ov?.note || '昨日数据・今晨6点更新'}</div></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>{syncMsg && <span style={{ fontSize: 12, color: '#6B6862' }}>{syncMsg}</span>}<Button size="small" onClick={sync} disabled={cool > 0}>{cool > 0 ? `${cool}s后可同步` : '手动同步'}</Button></div>
      </div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        <TaskBar />
        {!ov ? (derr ? <div className="card" style={{ padding: 24, marginBottom: 16 }}>数据加载失败 <Button size="small" style={{ marginLeft: 8 }} onClick={() => { setDerr(false); reloadStats(); }}>重试</Button></div> : <div className="skel" style={{ height: 96 }}>loading</div>) : (
          <div style={{ display: 'flex', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 4, marginBottom: 16 }}>
          {(() => {
            const tp = videos.reduce((a, v) => a + v.play, 0);
            const tl = videos.reduce((a, v) => a + v.like, 0);
            const ts = videos.reduce((a, v) => a + v.share, 0);
            const cells: [string, string][] = [['总播放', ov.play.toLocaleString()], ['总点赞', ov.like.toLocaleString()], ['总评论', ov.comment.toLocaleString()], ['转发总数', ts.toLocaleString()], ['平均点赞率', tp ? `${(tl / tp * 100).toFixed(1)}%` : '—']];
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
            <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 12, padding: '32px 0', textAlign: 'center' }}>暂无趋势序列（需同步能力接入后生成），指标以作品表为准</div>
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
          <Table<Video> size="small" pagination={false} columns={videoCols} dataSource={videos} rowKey="id" locale={{ emptyText: '暂无作品' }} />
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#A8A5A0' }}>服务端分页 · 20/页 · 趋势批量上限{statsConfig.trendBatchMax}</div>
        </div>
        <div className="card" style={{ marginTop: 16, padding: 16, background: '#F7F6F3' }}>
          <b>真实数据导入</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>自己的账号数据手工入台（S23预真机）· 单次≤200行 · 按标题upsert不重复</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button size="small" type="primary" onClick={() => { if (vFileRef.current) vFileRef.current.value = ''; vFileRef.current?.click(); }}>导入作品CSV</Button>
            <Button size="small" onClick={() => { if (cFileRef.current) cFileRef.current.value = ''; cFileRef.current?.click(); }}>导入评论CSV</Button>
            <Button size="small" type="text" onClick={() => dlTemplate('videos')}>模板·作品</Button>
            <Button size="small" type="text" onClick={() => dlTemplate('comments')}>模板·评论</Button>
            {impMsg && <span style={{ fontSize: 12, color: '#6B6862' }}>{impMsg}</span>}
            <input ref={vFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => doImport('videos', e.target.files?.[0])} />
            <input ref={cFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => doImport('comments', e.target.files?.[0])} />
          </div>
          <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 6 }}>数据落本地 data/local.json 重启不丢 · 评论自动分五档意图 · 作品归属当前主账号（授权页绑定后自动切换）</div>
        </div>
        <div className="card" style={{ marginTop: 16, padding: 16, background: '#F7F6F3' }}>
          <b>竞品手动导入</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>官方不给全平台数据，此区与自有数据隔离</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Input size="small" value={curl} onChange={(e) => setCurl(e.target.value)} placeholder="链接/备注，如 同城店B·契约陪玩" style={{ width: 280 }} />
            <Select size="small" value={csource} onChange={setCsource} style={{ width: 110 }} options={statsConfig.competitorSources.map((s) => ({ value: s, label: s }))} />
            <Select size="small" value={ckind} onChange={setCkind} style={{ width: 100 }} options={KINDS.map(([v, label]) => ({ value: v, label }))} />
            <Button size="small" type="primary" onClick={addComp}>加入</Button>
            {cmsg && <span style={{ fontSize: 12, color: '#6B6862', alignSelf: 'center' }}>{cmsg}</span>}
          </div>
          <Table<Competitor> size="small" pagination={false} style={{ marginTop: 10 }} columns={compCols} dataSource={comps} rowKey="id" locale={{ emptyText: '暂无竞品' }} />
        </div>
        <Drawer title={trend?.title || ''} placement="right" width={380} open={!!trend} onClose={() => setTrend(null)}>
          <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 4 }}>T+1</div>
          {!trend ? null : trend.rows === null ? <div className="skel" style={{ height: 120, marginTop: 12 }}>loading</div> : trend.rows.length === 0 ? (
            <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 12, padding: '16px 0' }}>暂无趋势序列（需同步能力接入后生成），指标以作品表为准</div>
          ) : (
            <div>
              <svg viewBox="0 0 100 36" style={{ width: '100%', height: 72, marginTop: 12 }} role="img" aria-label="播放趋势迷你线">
                <polyline points={spark(trend.rows)} fill="none" stroke="#1A1A18" strokeWidth="1.6" />
              </svg>
              <Table<TrendPoint> size="small" pagination={false} style={{ marginTop: 8 }} columns={trendRows} dataSource={trend.rows} rowKey="date" />
            </div>
          )}
        </Drawer>
      </div>
    </div>
  );
}
