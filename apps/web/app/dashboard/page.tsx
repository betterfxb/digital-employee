'use client';
import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Popconfirm, Segmented, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { statsConfig } from '@/config/stats.config';
import { downloadCsv } from '@/lib/csv';
import { engagementPct, topHot, lowWarn } from '@/lib/videoStats';
import { buildFunnel, funnelDrop } from '@/lib/funnel'; // S124
import { attribution } from '@/lib/attribution'; // S128
import { parseDealHistory } from '@/lib/dealMath'; // S134
import { buildHeartbeat } from '@/lib/heartbeat'; // S136
import { buildKwMoney } from '@/lib/kwMoney'; // S144
import { hasFeature, type ProFeature } from '@/lib/tiers';
import { autoCfgOf } from '@/lib/autoCfg';
import { ProLock } from '@/components/ProLock';
import type { Video, Competitor, Overview, TrendPoint, CommentItem, Follow } from '@/lib/types';
import { TaskBar } from '@/components/TaskBar';
import { ImportWizard } from '@/components/ImportWizard';

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
  const [allComments, setAllComments] = useState<CommentItem[]>([]);
  const [followNicks, setFollowNicks] = useState<Set<string>>(new Set());
  const [followRows, setFollowRows] = useState<Follow[]>([]);
  const [hotHist, setHotHist] = useState<Record<string, Record<string, number>>>({});
  const [priceOn, setPriceOn] = useState(true);
  /** S75 看板自动刷新（面板可配，0=关；页面隐藏时暂停） */
  const [refreshSec, setRefreshSec] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  /** S54 分版本能力（null=未加载按可用渲染防闪） */
  const [feats, setFeats] = useState<string[] | null>(null);
  const [fsHide, setFsHide] = useState(false); // S126 首跑引导条本地关闭态（挂载后读localStorage）
  useEffect(() => { try { if (localStorage.getItem('first_run_guide_dismissed') === '1') setFsHide(true); } catch { /* ignore */ } }, []);
  const can = (k: ProFeature) => feats === null || hasFeature(feats, k);
  /** S63 指标口径：当前账号/全部账号汇总 */
  const [scope, setScope] = useState<'active' | 'all'>('active');
  const [ovAll, setOvAll] = useState<{ play: number; like: number; comment: number; share: number; note: string; accounts: { id: string; nick: string; videos: number; play: number; like: number }[] } | null>(null);
  const switchScope = (v: 'active' | 'all') => {
    setScope(v);
    if (v === 'all' && !ovAll) fetch('/api/stats/overview?all=1').then((r) => r.json()).then(setOvAll).catch(() => {});
  };
  const [curl, setCurl] = useState('');
  const [csource, setCsource] = useState('manual');
  const [ckind, setCkind] = useState('note');
  const KINDS: [string, string][] = [['note', '笔记'], ['author', '作者'], ['comment', '评论'], ['user', '用户']];
  const [cmsg, setCmsg] = useState('');
  const [wiz, setWiz] = useState(false);
  /** S53 竞品记录 */
  const [cpEdit, setCpEdit] = useState<{ id: string; play: string; like: string } | null>(null);
  const [cpDetail, setCpDetail] = useState<Competitor | null>(null);

  const loadComps = () => fetch('/api/competitors').then((r) => r.json()).then((d) => setComps(d.items || [])).catch(() => {});

  useEffect(() => {
    fetch('/api/stats/overview').then((r) => r.json()).then((d) => { setDerr(false); setOv(d); }).catch(() => setDerr(true));
    fetch('/api/videos').then((r) => r.json()).then((d) => {
      const vs: Video[] = d.items || [];
      setVideos(vs);
      const ids = vs.slice(0, statsConfig.trendBatchMax).map((v) => v.aweme_id || v.id).join(','); // S105修：数据多于批量上限时400噪点，客户端截断
      if (ids) fetch(`/api/stats/trend?ids=${ids}&days=7`).then((r) => r.json()).then(setAllTrend).catch(() => {});
    }).catch(() => setDerr(true));
    fetch('/api/comments?unread_only=0').then((r) => r.json()).then((d) => {
      const items = (d.items || []) as CommentItem[];
      setAllComments(items);
      const m = new Map<string, number>();
      items.forEach((x) => m.set(x.intent, (m.get(x.intent) || 0) + 1));
      setIntents([...m.entries()].map(([intent, n]) => ({ intent, n })).sort((a, b) => b.n - a.n));
      setTopHigh(items.filter((x) => x.intent === '高意向').sort((a, b) => b.like_count - a.like_count).slice(0, 3));
    }).catch(() => {});
    fetch('/api/follows').then((r) => r.json()).then((d) => {
      const items = (d.items || []) as Follow[];
      setFollowRows(items);
      setFollowNicks(new Set(items.map((f) => f.peer_nick)));
    }).catch(() => {});
    fetch('/api/comments/keywords/hot').then((r) => r.json()).then((d) => setHotHist(d.history || {})).catch(() => {});
    fetch('/api/license/status').then((r) => r.json()).then((d) => setFeats(Array.isArray(d.features) ? d.features : [])).catch(() => {});
    fetch('/api/settings').then((r) => r.json()).then((s) => { setPriceOn(Array.isArray(s.price_list) && s.price_list.length > 0); setRefreshSec(autoCfgOf(s).dashboard_refresh_sec); }).catch(() => {});
    loadComps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadTick]);
  // S90 命令面板直达：/dashboard?import=1 自动开导入向导
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('import') === '1') setWiz(true);
  }, []);

  // S75 自动刷新（面板配置，页面隐藏时暂停）
  useEffect(() => {
    if (refreshSec <= 0) return;
    const id = setInterval(() => { if (typeof document !== 'undefined' && !document.hidden) setReloadTick((t) => t + 1); }, refreshSec * 1000);
    return () => clearInterval(id);
  }, [refreshSec]);

  const reloadStats = () => {
    fetch('/api/stats/overview').then((r) => r.json()).then(setOv).catch(() => {});
    fetch('/api/videos').then((r) => r.json()).then((d) => {
      const vs: Video[] = d.items || [];
      setVideos(vs);
      const ids = vs.slice(0, statsConfig.trendBatchMax).map((v) => v.aweme_id || v.id).join(','); // S105修：数据多于批量上限时400噪点，客户端截断
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

  /** S35 看板导出：作品明细CSV（指标均可由明细复算） */
  const exportVideos = () => {
    if (videos.length === 0) { message.info('暂无数据可导出'); return; }
    downloadCsv('作品数据.csv', ['标题', '发布时间', '播放', '点赞', '评论', '转发'], videos.map((v) => [v.title, v.publish_time, v.play, v.like, v.comment, v.share]));
  };

  /** S53 记录竞品最新数据（有变化自动留历史） */
  const saveCp = async () => {
    if (!cpEdit) return;
    const r = await fetch(`/api/competitors/${cpEdit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ play: Number(cpEdit.play) || 0, like: Number(cpEdit.like) || 0 }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '记录失败'); return; }
    setCpEdit(null); message.success('已记录，变化已留档'); loadComps();
  };

  const spark = (rows: TrendPoint[]) => {
    const max = Math.max(...rows.map((r) => r.play), 1);
    return rows.map((r, i: number) => `${(i / Math.max(rows.length - 1, 1)) * 100},${34 - (r.play / max) * 32}`).join(' ');
  };

  // S106 爆款Top3（互动率）与低效预警（播放<账号均值30%，样本≥3才判）——按id集合预计算，排序/翻页不串位
  const hotIds = topHot(videos); const lowIds = lowWarn(videos);
  const avgE = (() => { const rs = videos.map((v) => engagementPct(v)).filter((x): x is number => x !== null); return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null; })();
  const videoCols: ColumnsType<Video> = [
    { title: '作品', dataIndex: 'title', key: 'title', render: (v: string, rec) => <span>{hotIds.has(rec.id) && <span title="互动率Top3爆款" style={{ marginRight: 4 }}>🔥</span>}{lowIds.has(rec.id) && <span title="播放显著低于账号均值，选题/发布时段可复盘" style={{ marginRight: 4, opacity: 0.55 }}>▼</span>}<a href={`/comments?video=${encodeURIComponent(rec.id)}`} title="直达该作品评论流">{v}</a></span> },
    { title: '发布时间', dataIndex: 'publish_time', key: 'pt', onCell: () => ({ className: 'num' }) },
    { title: '播放', key: 'play', onCell: () => ({ className: 'num' }), sorter: (a, b) => a.play - b.play, render: (_, v) => v.play.toLocaleString() },
    { title: '点赞', key: 'like', onCell: () => ({ className: 'num' }), sorter: (a, b) => a.like - b.like, render: (_, v) => v.like.toLocaleString() },
    { title: '点赞率', key: 'lr', onCell: () => ({ className: 'num' }), render: (_, v) => (v.play ? `${(v.like / v.play * 100).toFixed(1)}%` : '—') },
    { title: '互动率', key: 'er', onCell: () => ({ className: 'num' }), sorter: (a, b) => (engagementPct(a) ?? -1) - (engagementPct(b) ?? -1), render: (_, v) => { const e = engagementPct(v); return e === null ? '—' : `${e.toFixed(1)}%`; } }, // S106 (赞+评+转)/播
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
    { title: '变化', key: 'delta', width: 130, render: (_, c) => {
      const h = c.history?.[0];
      if (!h) return <span style={{ color: '#A8A5A0', fontSize: 12 }}>首次记录</span>;
      const dp = c.play - h.play; const dl = c.like - h.like;
      if (dp === 0 && dl === 0) return <span style={{ color: '#A8A5A0', fontSize: 12 }}>—</span>;
      const txt = [dp !== 0 ? `播${dp > 0 ? '+' : ''}${dp.toLocaleString()}` : '', dl !== 0 ? `赞${dl > 0 ? '+' : ''}${dl}` : ''].filter(Boolean).join(' ');
      return <span className="num" style={{ fontSize: 12, color: dp > 0 || dl > 0 ? '#B4443C' : '#1677FF', fontWeight: 700 }}>{txt}</span>;
    } },
    { title: '', key: 'act', width: 190, render: (_, c) => (
      <>
        <Popconfirm
          title="记录竞品最新数据"
          open={cpEdit?.id === c.id}
          onOpenChange={(o) => { if (o) setCpEdit({ id: c.id, play: String(c.play), like: String(c.like) }); else setCpEdit(null); }}
          description={
            <div style={{ width: 210 }}>
              <Input size="small" type="number" placeholder="播放" value={cpEdit?.id === c.id ? cpEdit.play : ''} onChange={(e) => cpEdit && setCpEdit({ ...cpEdit, play: e.target.value })} />
              <Input size="small" type="number" placeholder="点赞" value={cpEdit?.id === c.id ? cpEdit.like : ''} onChange={(e) => cpEdit && setCpEdit({ ...cpEdit, like: e.target.value })} style={{ marginTop: 6 }} />
            </div>
          }
          okText="记录" cancelText="取消" onConfirm={saveCp}
        >
          {can('competitor') && <Button size="small" style={{ marginRight: 6 }}>记录数据</Button>}
        </Popconfirm>
        {can('competitor') && <Button size="small" type="text" onClick={() => setCpDetail(c)}>历史{c.history?.length ? `(${c.history.length})` : ''}</Button>}
      </>
    ) },
  ];

  const trendRows: ColumnsType<TrendPoint> = [
    { title: '日期', dataIndex: 'date', key: 'd', onCell: () => ({ className: 'num' }) },
    { title: '播放', key: 'play', onCell: () => ({ className: 'num' }), render: (_, r) => r.play.toLocaleString() },
    { title: '点赞', key: 'like', onCell: () => ({ className: 'num' }), render: (_, r) => r.like.toLocaleString() },
  ];

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1', display: 'flex', alignItems: 'center' }}>
        <div><b style={{ fontSize: 15 }}>数据看板</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>{scope === 'all' ? (ovAll?.note || '全部账号汇总加载中…') : (ov?.note || '昨日数据・今晨6点更新')}</div></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Segmented size="small" options={['当前账号', '全部账号']} value={scope === 'all' ? '全部账号' : '当前账号'} onChange={(v) => switchScope(v === '全部账号' ? 'all' : 'active')} />
          {syncMsg && <span style={{ fontSize: 12, color: '#6B6862' }}>{syncMsg}</span>}
          <Button size="small" onClick={sync} disabled={cool > 0}>{cool > 0 ? `${cool}s后可同步` : '手动同步'}</Button>
          <Button size="small" className="no-print" onClick={() => window.print()}>打印</Button>
        </div>
      </div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        <TaskBar />
        {ov && !videos.some((v) => v.id.startsWith('imp-')) && (
          <div className="card" style={{ padding: 18, marginBottom: 16 }}>
            <b>三步开始用</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>导入你自己的账号数据，这里立刻变成你的看板</span>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              {[
                { n: '①', t: '导入数据', d: '作品+评论 CSV，带模板照着填', btn: '现在导入', act: () => setWiz(true) },
                { n: '②', t: '看意向客户', d: '评论自动分五档意图，高意向置顶', btn: '去评论工作台', act: () => { window.location.href = '/comments'; } },
                { n: '③', t: '生成回复话术', d: '按场景出候选话术，复制即用', btn: '去话术库', act: () => { window.location.href = '/messages'; } },
              ].map((s) => (
                <div key={s.n} style={{ flex: 1, border: '1px solid #E8E6E1', borderRadius: 4, padding: 14 }}>
                  <div style={{ fontSize: 12, color: '#A8A5A0' }}>{s.n}</div>
                  <b style={{ fontSize: 13 }}>{s.t}</b>
                  <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px', minHeight: 34 }}>{s.d}</div>
                  <Button size="small" type={s.n === '①' ? 'primary' : 'default'} onClick={s.act}>{s.btn}</Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {ov && videos.some((v) => v.id.startsWith('imp-')) && (() => {
          const highUnfollowed = allComments.filter((c) => c.intent === '高意向' && !followNicks.has(c.user_nick)).length;
          const unread = allComments.filter((c) => !c.is_read_local).length;
          const tips: { t: string; d: string; btn: string; href: string }[] = [];
          if (highUnfollowed > 0) tips.push({ t: `${highUnfollowed} 条高意向还没跟进`, d: '意向客户等越久越凉', btn: '去处理', href: '/comments?intent=' + encodeURIComponent('高意向') });
          if (unread > 0) tips.push({ t: `${unread} 条未读评论`, d: '及时处理保持响应速度', btn: '去处理', href: '/comments' });
          if (!priceOn) tips.push({ t: '还没配置价目表', d: '配好后报价话术自动带参考价，客户问价报得快', btn: '去配置', href: '/settings' });
          if (tips.length === 0) return null;
          return (
            <div className="card" style={{ padding: 18, marginBottom: 16, borderLeft: '3px solid #1A1A18' }}>
              <b>运营建议</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>按你当前数据实时计算</span>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tips.map((x) => (
                  <div key={x.t} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, flexWrap: 'wrap' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: '#1A1A18', flexShrink: 0 }} />
                    <b>{x.t}</b><span style={{ color: '#6B6862', fontSize: 12 }}>{x.d}</span>
                    <span style={{ flex: 1 }} />
                    <Button size="small" href={x.href}>{x.btn}</Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        {/* S126 首跑三步引导：从未导入过数据(示例种子不算)时的一次性清单——让新店长不等服务商自己转起来 */}
        {ov && !ov.last_import_at && !fsHide && (
          <div className="card" style={{ padding: '16px 18px', marginBottom: 16, border: '1px solid #E3C9A6', background: '#FDF8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b>先花三分钟把你自己的数据放进来</b>
              <span style={{ fontSize: 12, color: '#8A8781' }}>现在看到的是示例演示数据，导入后全部替换为你的真实经营</span>
              <span style={{ flex: 1 }} />
              <Button size="small" type="text" onClick={() => { setFsHide(true); try { localStorage.setItem('first_run_guide_dismissed', '1'); } catch { /* 私密模式无所谓 */ } }}>先逛逛</Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 12 }}>
              {[
                { n: '1', t: '导作品数据', d: '抖音创作者中心 → 数据 → 作品数据 → 导出CSV', k: 'videos' },
                { n: '2', t: '导评论数据', d: '作品评论导出，系统自动分意向找潜在客户', k: 'comments' },
                { n: '3', t: '导老客户名单（可选）', d: '微信里已有客户导成CSV，直接进跟进台账', k: 'leads' },
              ].map((s) => (
                <div key={s.n} style={{ background: '#fff', border: '1px solid #EADFBE', borderRadius: 6, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className="num" style={{ fontWeight: 700, color: '#9A6B2F', fontSize: 16 }}>{s.n}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.t}</div>
                    <div style={{ fontSize: 12, color: '#8A8781', marginTop: 2 }}>{s.d}</div>
                    <Button size="small" style={{ marginTop: 8 }} onClick={() => setWiz(true)}>去导入</Button>
                  </div>
                </div>
              ))}
              <div style={{ background: '#fff', border: '1px dashed #C8D8CC', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>4. 每天看「今日工作台」</div>
                <div style={{ fontSize: 12, color: '#8A8781', marginTop: 2 }}>该回谁的评论、该跟谁的单，打开就有清单</div>
                <Button size="small" style={{ marginTop: 8 }} href="/today">打开工作台</Button>
              </div>
            </div>
          </div>
        )}
        {!ov ? (derr ? <div className="card" style={{ padding: 24, marginBottom: 16 }}>数据加载失败 <Button size="small" style={{ marginLeft: 8 }} onClick={() => { setDerr(false); reloadStats(); }}>重试</Button></div> : <div className="skel" style={{ height: 96 }}>loading</div>) : (
          <div style={{ display: 'flex', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 4, marginBottom: 16 }}>
          {(() => {
            const isAll = scope === 'all' && !!ovAll;
            const cur = (scope === 'all' && ovAll) ? ovAll : ov;
            const tp = isAll ? cur.play : videos.reduce((a, v) => a + v.play, 0);
            const tl = isAll ? cur.like : videos.reduce((a, v) => a + v.like, 0);
            const ts = scope === 'all' ? (ovAll?.share ?? 0) : videos.reduce((a, v) => a + v.share, 0);
            const cells: [string, string][] = [['总播放', cur.play.toLocaleString()], ['总点赞', cur.like.toLocaleString()], ['总评论', cur.comment.toLocaleString()], ['转发总数', ts.toLocaleString()], ['平均点赞率', tp ? `${(tl / tp * 100).toFixed(1)}%` : '—']];
            return cells.map(([k, v], i) => (
              <div key={k} style={{ flex: 1, padding: '16px 20px', borderLeft: i ? '1px solid #E8E6E1' : 'none', minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#6B6862' }}>{k}</div>
                <div className="num" style={{ fontSize: 26, fontWeight: 700, whiteSpace: 'nowrap' }}>{v}</div>
              </div>
            ));
          })()}
          </div>
        )}
        {/* S101 成交概览行：只用台账可信数据（status/amount/history ISO时窗），基础版可看 */}
        {followRows && followRows.length > 0 && (() => {
          const doneF = followRows.filter((f) => f.status === '已转化');
          const revAll = doneF.reduce((a, f) => a + (Number(f.amount) || 0), 0);
          const wkIso = new Date(Date.now() - 7 * 86400000).toISOString();
          const done7 = doneF.filter((f) => (f.history || []).some((h) => h.act.indexOf('已转化') > -1 && h.at >= wkIso));
          const rev7 = done7.reduce((a, f) => a + (Number(f.amount) || 0), 0);
          const pending = followRows.filter((f) => ['待回访', '已手动回复'].includes(f.status)).length;
          const costAll = doneF.reduce((a, f) => a + (Number(f.cost) || 0), 0);
          const netAll = revAll - costAll; // S132 净利=收入-已记成本（没记成本的不扣）
          const repN = doneF.filter((f) => parseDealHistory(f).n >= 2).length; // S134 按记账动作计
          const cells: [string, string, string][] = [
            ['成交总单数', String(doneF.length), '台账状态=已转化'],
            ['成交总金额', `¥${revAll.toLocaleString()}`, '金额为台账记账值'],
            ['成交总净利', `¥${netAll.toLocaleString()}`, '收入−已记成本'],
            ['复购客户', `${repN} 人`, doneF.length > 0 ? `占已转化 ${Math.round((repN / doneF.length) * 100)}%` : '按记账动作计'],
            ['近7天成交', `${done7.length} 单 · ¥${rev7.toLocaleString()}`, '按状态变更时间'],
            ['跟进进行中', String(pending), '待回访+已手动回复'],
          ];
          return (
            <div className="print-block" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', background: '#fff', border: '1px solid #E8E6E1', borderRadius: 4, marginBottom: 16 }}>
              {cells.map(([k, v, d], i) => (
                <div key={k} style={{ padding: '14px 20px', borderLeft: i ? '1px solid #E8E6E1' : 'none', minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#6B6862' }}>{k}</div>
                  <div className="num" style={{ fontSize: 24, fontWeight: 700, whiteSpace: 'nowrap' }}>{v}</div>
                  <div style={{ fontSize: 11, color: '#A8A5A0' }}>{d}</div>
                </div>
              ))}
            </div>
          );
        })()}
        {/* S136 业务心跳：本机ISO事件逐日聚合的14天曲线——生意在升温还是降温，一眼看穿 */}
        {(() => {
          const hb = buildHeartbeat(followRows, 14);
          const mx = (k: 'leads' | 'touches' | 'amount') => Math.max(1, ...hb.map((d) => d[k]));
          const rows: { k: 'leads' | 'touches' | 'amount'; label: string; color: string; fmt: (d: (typeof hb)[number]) => string }[] = [
            { k: 'leads', label: '新线索', color: '#9A6B2F', fmt: (d) => `${d.leads} 条` },
            { k: 'touches', label: '跟进动作', color: '#23415E', fmt: (d) => `${d.touches} 次` },
            { k: 'amount', label: '成交金额', color: '#1F4D3A', fmt: (d) => (d.amount > 0 ? `¥${d.amount.toLocaleString()}` : '0') },
          ];
          const anyActivity = hb.some((d) => d.leads + d.touches + d.deals > 0);
          return (
            <div className="card" style={{ padding: 18, marginBottom: 16 }}>
              <b>业务心跳</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>近14天本机操作逐日聚合 · 与播放数据无关，你自己的勤懒全在图上</span>
              {anyActivity ? (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rows.map((r) => (
                    <div key={r.k} style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                      <span style={{ width: 62, fontSize: 12, color: '#6B6862', flexShrink: 0 }}>{r.label}</span>
                      {hb.map((d) => (
                        <div key={d.date} title={`${d.date.slice(5)} · ${r.fmt(d)}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 34 }}>
                          <div style={{ height: Math.max(2, Math.round((34 * d[r.k]) / mx(r.k))), background: d[r.k] > 0 ? r.color : '#F0EEEA', borderRadius: 2 }} />
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 4, marginLeft: 66 }}>
                    {hb.map((d, i) => <span key={d.date} className="num" style={{ flex: 1, fontSize: 10, color: '#C8C5BE', textAlign: 'center' }}>{i % 3 === 2 ? d.date.slice(8) : ''}</span>)}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 10, padding: '18px 0', textAlign: 'center' }}>近14天本机还没有操作记录——登记线索、改状态、记成交都会在这里落点。</div>
              )}
              <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 10 }}>口径：新线索=建档时间；跟进动作=每次台账操作；成交=「记成交」动作金额（登记即成交的按现值计入客户榜但不进此线，宁漏不造）</div>
            </div>
          );
        })()}
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
        {/* S63 全部账号明细条（口径切到"全部账号"时展示每账号贡献） */}
        {scope === 'all' && ovAll && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {ovAll.accounts.map((a) => (
              <span key={a.id} style={{ border: '1px solid #E8E6E1', background: '#FCFBF9', borderRadius: 12, padding: '3px 10px', fontSize: 12 }}>
                <b>{a.nick}</b> · 播{a.play.toLocaleString()} · 赞{a.like.toLocaleString()} · {a.videos}条作品
              </span>
            ))}
          </div>
        )}
        {/* S51 转化漏斗 + 热词趋势（S54 基础版锁定为专业版占位） */}
        {!can('analytics') ? (
          <div style={{ marginBottom: 16 }}><ProLock feature="转化漏斗 + 热词趋势" desc="全链路转化分析与关键词每日趋势" /></div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', gap: 16, marginBottom: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <b>转化漏斗</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>评论→成交五级收窄 · 昵称匹配口径 · 已读为本机操作</span>
            {(() => {
              const tiers = buildFunnel(allComments, followRows);
              const drops = funnelDrop(tiers);
              const first = Math.max(tiers[0].n, 1);
              const w = (v: number) => (v <= 0 ? 0 : Math.max(6, (v / first) * 100));
              return tiers.map((s, i) => (
                <div key={s.key} title={s.hint} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: i ? 8 : 14 }}>
                  <span style={{ width: 84, fontSize: 12, color: '#6B6862', flexShrink: 0 }}>{s.label}</span>
                  <div style={{ flex: 1, height: 22, background: '#F0EEEA', borderRadius: 3, minWidth: 0 }}>
                    <div style={{ width: `${w(s.n)}%`, height: 22, background: i >= 3 ? '#1A1A18' : '#B5B0A8', borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                  <span className="num" style={{ width: 76, fontSize: 13, fontWeight: 700, textAlign: 'right', flexShrink: 0 }}>{s.n.toLocaleString()}</span>
                  <span className="num" style={{ width: 58, fontSize: 12, color: '#6B6862', textAlign: 'right', flexShrink: 0 }}>{i > 0 ? (tiers[i - 1].n > 0 ? `${Math.round((s.n / tiers[i - 1].n) * 100)}%` : '—') : ''}</span>
                  <span className="num" style={{ width: 52, fontSize: 12, color: drops[i] > 0 && i >= 1 ? '#B4443C' : '#C8C5BE', textAlign: 'right', flexShrink: 0 }}>{i > 0 && drops[i] > 0 ? `-${drops[i]}` : ''}</span>
                </div>
              ));
            })()}
            <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 10 }}>漏斗按当前累计数据实时计算；级间百分比=本级/上一级</div>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <b>热词趋势</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>每日首次访问自动快照</span>
            {(() => {
              const dates = Object.keys(hotHist).sort();
              if (dates.length === 0) return <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 12, padding: '20px 0', textAlign: 'center' }}>快照积累中，次日起显示每日变化</div>;
              const lastDates = dates.slice(-4);
              const agg = new Map<string, number>();
              lastDates.forEach((d) => Object.entries(hotHist[d]).forEach(([k, n]) => agg.set(k, (agg.get(k) || 0) + n)));
              const topKw = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
              if (topKw.length === 0) return <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 12, padding: '20px 0', textAlign: 'center' }}>暂无热词数据</div>;
              return (
                <div style={{ marginTop: 10, fontSize: 12 }}>
                  <div style={{ display: 'flex', gap: 8, color: '#A8A5A0', paddingBottom: 4, borderBottom: '1px solid #F0EEEA' }}>
                    <span style={{ width: 56 }}>关键词</span>
                    {lastDates.map((d) => <span key={d} className="num" style={{ flex: 1, textAlign: 'right' }}>{d.slice(5)}</span>)}
                  </div>
                  {topKw.map((k) => {
                    const vals = lastDates.map((d) => hotHist[d]?.[k] ?? null);
                    return (
                      <div key={k} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #F0EEEA' }}>
                        <span style={{ width: 56, fontWeight: 600 }}>{k}</span>
                        {vals.map((v, i) => {
                          const prev = i > 0 ? vals[i - 1] : null;
                          const up = v != null && prev != null && v > prev;
                          const down = v != null && prev != null && v < prev;
                          return <span key={i} className="num" style={{ flex: 1, textAlign: 'right', color: v == null ? '#D8D5CF' : up ? '#B4443C' : down ? '#1677FF' : '#1A1A18', fontWeight: up ? 700 : 400 }}>{v == null ? '·' : `${v}${up ? '↑' : down ? '↓' : ''}`}</span>;
                        })}
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 8 }}>只记真实数据 · 保留30天 · ↑↓=与前一日对比</div>
                </div>
              );
            })()}
          </div>
        </div>
        )}
        {/* S128 作品带货榜：内容↔钱的连线，选题抄自己的爆款（导入线索已排除，归因只信评论区走进台账的） */}
        {(() => {
          const rows = attribution(followRows, videos).filter((r) => r.leads > 0).slice(0, 8);
          const totalAmt = attribution(followRows, videos).reduce((s, r) => s + r.amount, 0);
          if (followRows.length === 0) return null;
          return (
            <div className="card" style={{ padding: 18, marginBottom: 16 }}>
              <b>作品带货榜</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>哪条视频把看客变成了客户 · 按成交额倒序</span>
              {rows.length === 0 ? (
                <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 10 }}>台账里还没有「从评论区登记进来」的线索——在评论工作台处理高意向评论时点「登记跟进」，这里就会长出来。</div>
              ) : (
                <div style={{ marginTop: 10 }}>
                  {rows.map((r, i) => (
                    <div key={r.videoId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F0EEEA', fontSize: 13 }}>
                      <span className="num" style={{ width: 22, color: i < 3 ? '#9A6B2F' : '#C8C5BE', fontWeight: 700 }}>{i + 1}</span>
                      <a href={`/comments?video=${encodeURIComponent(r.videoId)}`} title="直达该作品评论流" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</a>
                      <span className="num" style={{ width: 70, textAlign: 'right', color: '#6B6862' }}>{r.leads} 线索</span>
                      <span className="num" style={{ width: 58, textAlign: 'right', color: r.done > 0 ? '#1F4D3A' : '#C8C5BE' }}>{r.done} 成交</span>
                      <span className="num" style={{ width: 92, textAlign: 'right', fontWeight: 700, color: r.amount > 0 ? '#1A1A18' : '#C8C5BE' }}>{r.amount > 0 ? `¥${r.amount.toLocaleString()}` : '—'}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 8 }}>口径：仅计评论区登记进台账的线索（老客户名单导入无真实来源作品，已排除防虚胖）；金额=已转化记账值{totalAmt > 0 ? `，可归因成交合计 ¥${totalAmt.toLocaleString()}` : ''}</div>
                </div>
              )}
              {/* S134 高价值客户榜：按本机记账动作累计金额排——精力该砸在谁身上，一榜说清 */}
              {(() => {
                const clv = followRows
                  .filter((f) => f.status !== '无效')
                  .map((f) => ({ nick: f.peer_nick, ...parseDealHistory(f) }))
                  .filter((x) => x.total > 0)
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 8);
                if (clv.length === 0) return null;
                return (
                  <div style={{ marginTop: 14, borderTop: '1px dashed #E8E6E1', paddingTop: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>高价值客户 <span style={{ fontSize: 11, color: '#A8A5A0', fontWeight: 400 }}>按记账动作累计 · 🔁=复购2次以上</span></div>
                    {clv.map((c, i) => (
                      <div key={c.nick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid #F0EEEA', fontSize: 13 }}>
                        <span className="num" style={{ width: 22, color: i < 3 ? '#9A6B2F' : '#C8C5BE', fontWeight: 700 }}>{i + 1}</span>
                        <a href={`/messages?peer=${encodeURIComponent(c.nick)}`} title="打开该客户档案">{c.nick}</a>
                        {c.n >= 2 && <span title={`累计记账成交 ${c.n} 次`}>🔁</span>}
                        <span className="num" style={{ marginLeft: 'auto', fontWeight: 700 }}>¥{c.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })()}
        {/* S144 关键词钱表：哪个词背后站着肯掏钱的客户——选题与置顶评论该埋的词，看钱下注 */}
        {allComments.length > 0 && (() => {
          const kw = buildKwMoney(allComments, followRows).slice(0, 8);
          const withChain = kw.filter((r) => r.leads > 0);
          if (kw.length === 0) return null;
          return (
            <div className="card" style={{ padding: 18, marginBottom: 16 }}>
              <b>关键词钱表</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>评论关键词 → 台账 → 成交的链路统计 · 按成交额倒序</span>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#A8A5A0', paddingBottom: 4, borderBottom: '1px solid #F0EEEA' }}>
                  <span style={{ width: 24 }}>#</span><span style={{ flex: 1 }}>关键词</span><span style={{ width: 92, textAlign: 'right' }}>提及</span><span style={{ width: 78, textAlign: 'right' }}>进台账</span><span style={{ width: 64, textAlign: 'right' }}>成交</span><span style={{ width: 92, textAlign: 'right' }}>金额</span>
                </div>
                {kw.map((r, i) => (
                  <div key={r.kw} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F0EEEA', fontSize: 13 }}>
                    <span className="num" style={{ width: 24, color: i < 3 && r.leads > 0 ? '#9A6B2F' : '#C8C5BE', fontWeight: 700 }}>{i + 1}</span>
                    <a href={`/comments?kw=${encodeURIComponent(r.kw)}`} title="直达该词评论流" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.kw}</a>
                    <span className="num" style={{ width: 92, textAlign: 'right', color: '#6B6862' }}>{r.comments}{r.hi > 0 && <span style={{ color: '#9A6B2F' }} title="其中高意向/留电话"> 意向{r.hi}</span>}</span>
                    <span className="num" style={{ width: 78, textAlign: 'right' }}>{r.leads || '—'}</span>
                    <span className="num" style={{ width: 64, textAlign: 'right', color: r.deals > 0 ? '#1F4D3A' : '#C8C5BE' }}>{r.deals || '—'}</span>
                    <span className="num" style={{ width: 92, textAlign: 'right', fontWeight: 700, color: r.amount > 0 ? '#1A1A18' : '#C8C5BE' }}>{r.amount > 0 ? `¥${r.amount.toLocaleString()}` : '—'}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 8 }}>口径：昵称匹配到人、按人去重记账金额（同一客户多条评论不重复计钱）；导入的老客户不进此链（无真实来源评论）{withChain.length === 0 ? ' · 暂无「评论→台账」链路数据，先在评论台登记跟进' : ''}</div>
            </div>
          );
        })()}
        <div className="card">
          {videos.length > 0 && (
            <div style={{ padding: '10px 14px 0', fontSize: 11, color: '#A8A5A0' }}>
              🔥=互动率Top3爆款 · ▼=播放显著低于均值（≥3条作品才判定）{avgE !== null ? ` · 账号平均互动率 ${avgE.toFixed(1)}%` : ''}
            </div>
          )}
          <Table<Video> size="small" pagination={false} columns={videoCols} dataSource={videos} rowKey="id" locale={{ emptyText: '暂无作品' }} />
          <div style={{ padding: '12px 14px', fontSize: 12, color: '#A8A5A0', display: 'flex', alignItems: 'center' }}>
            <span>服务端分页 · 20/页 · 趋势批量上限{statsConfig.trendBatchMax}</span>
            <span style={{ flex: 1 }} />
            <Button size="small" onClick={exportVideos}>导出作品CSV</Button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 16, padding: 16, background: '#F7F6F3' }}>
          <b>我的数据导入</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>作品/评论 CSV 一键导入 · 带模板 · 自动去重 · 评论自动分五档意图</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <Button size="small" type="primary" onClick={() => setWiz(true)}>导入我的数据</Button>
            <span style={{ fontSize: 11, color: '#A8A5A0' }}>数据存本地，重启不丢；作品归属当前主账号（授权页绑定后自动切换）</span>
          </div>
        </div>
        <ImportWizard open={wiz} onClose={() => setWiz(false)} onDone={reloadStats} />
        <div className="card" style={{ marginTop: 16, padding: 16, background: '#F7F6F3' }}>
          <b>竞品手动导入</b> <span style={{ fontSize: 12, color: '#A8A5A0' }}>官方不给全平台数据，此区与自有数据隔离</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Input size="small" value={curl} onChange={(e) => setCurl(e.target.value)} placeholder="链接/备注，如 同城店B·契约陪玩" style={{ width: 280 }} />
            <Select size="small" value={csource} onChange={setCsource} style={{ width: 110 }} options={statsConfig.competitorSources.map((s) => ({ value: s, label: s }))} />
            <Select size="small" value={ckind} onChange={setCkind} style={{ width: 100 }} options={KINDS.map(([v, label]) => ({ value: v, label }))} />
            <Button size="small" type="primary" onClick={addComp}>加入</Button>
            {cmsg && <span style={{ fontSize: 12, color: '#6B6862', alignSelf: 'center' }}>{cmsg}</span>}
          </div>
          <Table<Competitor> size="small" pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }} style={{ marginTop: 10 }} columns={compCols} dataSource={comps} rowKey="id" locale={{ emptyText: '暂无竞品' }} />
        </div>
        {/* S53 竞品记录历史抽屉 */}
        <Drawer title={cpDetail ? `竞品历史 · ${cpDetail.url}` : ''} placement="right" width={400} open={!!cpDetail} onClose={() => setCpDetail(null)}>
          {cpDetail && (
            <div>
              <div style={{ fontSize: 13, lineHeight: 2 }}>
                <div>当前：播放 <b className="num">{cpDetail.play.toLocaleString()}</b> · 赞 <b className="num">{cpDetail.like.toLocaleString()}</b></div>
                <div>来源：{cpDetail.source} · {({ note: '笔记', author: '作者', comment: '评论', user: '用户' } as Record<string, string>)[cpDetail.kind || 'note']}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 8px' }}>记录历史（{cpDetail.history?.length || 0}）</div>
              {!cpDetail.history?.length && <div style={{ fontSize: 12, color: '#A8A5A0' }}>点「记录数据」更新竞品数值，每次变化自动留档，变化一目了然</div>}
              {(cpDetail.history || []).map((h, i, arr) => {
                const after = i === 0 ? { play: cpDetail.play, like: cpDetail.like } : { play: arr[i - 1].play, like: arr[i - 1].like };
                const dp = after.play - h.play; const dl = after.like - h.like;
                return (
                  <div key={i} style={{ fontSize: 12, padding: '8px 0', borderBottom: '1px solid #F0EEEA' }}>
                    <div className="num" style={{ color: '#A8A5A0', marginBottom: 2 }}>{new Date(h.at).toLocaleString('zh-CN', { hour12: false })}</div>
                    <div>
                      播放 {h.play.toLocaleString()} → {after.play.toLocaleString()} <b className="num" style={{ color: dp >= 0 ? '#B4443C' : '#1677FF' }}>{dp >= 0 ? `+${dp}` : dp}</b>
                      <span style={{ color: '#D8D5CF', margin: '0 8px' }}>|</span>
                      赞 {h.like.toLocaleString()} → {after.like.toLocaleString()} <b className="num" style={{ color: dl >= 0 ? '#B4443C' : '#1677FF' }}>{dl >= 0 ? `+${dl}` : dl}</b>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Drawer>
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
