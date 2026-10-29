'use client';
import { useEffect, useState } from 'react';
import { App, Button, Checkbox, Drawer, Input, Popconfirm, Radio, Select, Table, Tag } from 'antd';
import { parseRemind } from '@/lib/remind';
import { visitDue, daysSinceTouch } from '@/lib/visitDue'; // S129
import type { ColumnsType } from 'antd/es/table';
import { assistConfig } from '@/config/assist.config';
import { tasksConfig } from '@/config/tasks.config';
import { mockScripts } from '@/lib/mock';
import { downloadCsv } from '@/lib/csv';
import { hasFeature, type ProFeature } from '@/lib/tiers';
import type { ScriptItem, Follow, Video, CommentItem } from '@/lib/types';
import { scanText } from '@/lib/compliance'; // S130

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
  const [ftag, setFtag] = useState('');
  const [revisitMode, setRevisitMode] = useState(false); // S129 复购到期筛选
  const [tagLib, setTagLib] = useState<string[]>([]);
  const [tagEdit, setTagEdit] = useState<{ id: string; tags: string[] } | null>(null);
  const [newTag, setNewTag] = useState('');
  /** S49 线索档案抽屉 */
  const [detail, setDetail] = useState<Follow | null>(null);
  const [noteText, setNoteText] = useState('');
  /** S109 360聚合档案（评论史/回评史/成交汇总） */
  const [profile, setProfile] = useState<{ nick: string; comments: CommentItem[]; replies: { content: string; at: string }[]; follows: Follow[]; stats: { comments_n: number; high_n: number; replied_n: number; follows_n: number; done_n: number; amount_sum: number; first_touch: string | null; last_touch: string | null } } | null>(null);
  /** S54 分版本能力（null=按可用渲染防闪） */
  const [feats, setFeats] = useState<string[] | null>(null);
  const can = (k: ProFeature) => feats === null || hasFeature(feats, k);
  /** S57 回收站 */
  const [scriptTrash, setScriptTrash] = useState<ScriptItem[]>([]);
  const [ruleTrash, setRuleTrash] = useState<{ id: string; keyword: string; reply: string; enabled: boolean }[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  /** S60 台账批量操作 */
  const [fsel, setFsel] = useState<Set<string>>(new Set());
  const [batchTagInput, setBatchTagInput] = useState('');
  /** S65 提醒时间编辑 */
  const [remindEdit, setRemindEdit] = useState<{ id: string; val: string } | null>(null);
  /** S91/S92 台账三视图：表格/看板(拖拽改状态)/日历(提醒排布)，偏好持久化+URL直达 */
  const [fmode, setFmode] = useState<'table' | 'board' | 'cal'>('table');
  /** S98 列自定义：批次/标签/成交/提醒/联系方式列可藏（对方与状态为核心列不可藏），偏好持久化 */
  const HIDABLE_COLS: { key: string; label: string }[] = [{ key: 'batch', label: '批次' }, { key: 'tags', label: '标签' }, { key: 'amt', label: '成交' }, { key: 'remind', label: '下次提醒' }, { key: 'contact', label: '联系方式' }];
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [colsOpen, setColsOpen] = useState(false);
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem('follow_cols_hidden') || '[]'); if (Array.isArray(s)) setHiddenCols(new Set(s.filter((x) => typeof x === 'string'))); } catch { /* 坏配置=全显 */ }
  }, []);
  const toggleCol = (k: string) => setHiddenCols((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); try { localStorage.setItem('follow_cols_hidden', JSON.stringify([...n])); } catch { /* ignore */ } return n; });
  /** S102 台账行右键菜单 + 排序（催办紧急/最新建档） */
  const [fctx, setFctx] = useState<{ x: number; y: number; f: Follow } | null>(null);
  /** S115 联系方式行内编辑 + 一句话速记 */
  const [cEdit, setCEdit] = useState<{ id: string; val: string } | null>(null);
  const [qn, setQn] = useState('');
  const saveContact = async (id: string) => {
    const val = (cEdit?.id === id ? cEdit.val : '').trim().slice(0, 32);
    const r = await fetch(`/api/follows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact: val }) }).then((x) => x.json()).catch(() => null);
    setCEdit(null);
    if (!r || r.code) { flash(r?.message || '保存失败'); return; }
    flash('联系方式已保存', true); loadFollows();
  };
  const quickNote = async () => {
    if (!detail || !qn.trim()) return;
    const d = new Date();
    const stamp = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const next = ((detail.note || '') + (detail.note ? '\n' : '') + `[${stamp}] ${qn.trim()}`).slice(-460);
    const r = await fetch(`/api/follows/${detail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: next }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '速记失败'); return; }
    setQn(''); setNoteText(next); flash('已速记一条', true); loadFollows();
  };
  const [fsort, setFsort] = useState('default');
  const urgeTomorrow = async (id: string) => {
    const r = await fetch(`/api/follows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next_remind_at: '明天 09:00' }) }).then((x) => x.json()).catch(() => null);
    if (r && !r.code) { flash('已设明天 9 点提醒', true); loadFollows(); } else flash(r?.message || '操作失败');
  };
  useEffect(() => {
    const usp = new URLSearchParams(window.location.search);
    const v = usp.get('view');
    const p = usp.get('peer');
    if (p) setFsearch(p);
    if (usp.get('revisit') === '1') setRevisitMode(true); // S129 今日工作台回访直达
    if (v === 'board' || v === 'cal') { setFmode(v); try { localStorage.setItem('follow_view', v); } catch { /* 隐私模式忽略 */ } }
    else { try { const s = localStorage.getItem('follow_view'); if (s === 'board' || s === 'cal') setFmode(s); } catch { /* ignore */ } }
  }, []);
  const switchMode = (m: 'table' | 'board' | 'cal') => { setFmode(m); try { localStorage.setItem('follow_view', m); } catch { /* ignore */ } };
  const loadTrash = () => {
    fetch('/api/scripts?trash=1').then((r) => r.json()).then((d) => setScriptTrash(d.items || [])).catch(() => {});
    fetch('/api/reply-rules?trash=1').then((r) => r.json()).then((d) => setRuleTrash(d.items || [])).catch(() => {});
  };
  const [stitle, setStitle] = useState('');
  const [scontent, setScontent] = useState('');
  const [rules, setRules] = useState<{ id: string; keyword: string; reply: string; enabled: boolean }[]>([]);
  const [rkw, setRkw] = useState('');
  const [rrp, setRrp] = useState('');
  /** S52 话术库增强 */
  const [sCat, setSCat] = useState('全部');
  const [sQw, setSQw] = useState('');
  const [scatNew, setScatNew] = useState('自定义');
  const flash = (t: string, ok = false) => (ok ? message.success(t) : message.error(t));
  const loadFollows = (st = fstatus) => fetch(`/api/follows${st ? `?status=${encodeURIComponent(st)}` : ''}`).then((r) => r.json()).then((d) => setRows(d.items || [])).catch(() => { setRows([]); flash('台账加载失败，请刷新重试'); });
  /** S48 标签库（已用标签聚合） */
  const loadTagLib = () => fetch('/api/follows?tags=1').then((r) => r.json()).then((d) => setTagLib(((d.items || []) as { tag: string }[]).map((x) => x.tag))).catch(() => {});
  const loadRules = () => fetch('/api/reply-rules').then((r) => r.json()).then((d) => setRules(d.items || [])).catch(() => flash('规则加载失败，请重试'));
  useEffect(() => {
    fetch('/api/scripts').then((r) => r.json()).then((d) => { if (d.items?.length) setScripts(d.items); }).catch(() => {});
    loadFollows('');
    loadRules();
    loadTagLib();
    loadTrash();
    fetch('/api/license/status').then((r) => r.json()).then((d) => setFeats(Array.isArray(d.features) ? d.features : [])).catch(() => {});
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
  /** S48 线索标签：切换/新建/保存 */
  const toggleTagEdit = (tag: string) => {
    if (!tagEdit) return;
    const tags = tagEdit.tags.includes(tag) ? tagEdit.tags.filter((t) => t !== tag) : [...tagEdit.tags, tag];
    setTagEdit({ id: tagEdit.id, tags });
  };
  const addNewTag = () => {
    const t = newTag.trim();
    if (!t || !tagEdit) return;
    if (t.length > 8) { flash('标签最多8字'); return; }
    if (!tagEdit.tags.includes(t)) setTagEdit({ id: tagEdit.id, tags: [...tagEdit.tags, t].slice(0, 10) });
    setNewTag('');
    if (!tagLib.includes(t)) setTagLib([...tagLib, t]);
  };
  const saveTags = async () => {
    if (!tagEdit) return;
    const r = await fetch(`/api/follows/${tagEdit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: tagEdit.tags }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '标签保存失败'); return; }
    setTagEdit(null); flash('标签已保存', true); loadFollows(); loadTagLib();
  };
  /** S49 打开线索档案 */
  const openDetail = (f: Follow) => {
    setDetail(f); setNoteText(f.note || ''); setProfile(null);
    fetch('/api/leads/profile?nick=' + encodeURIComponent(f.peer_nick)).then((r) => r.json()).then((d) => { if (d && !d.code) setProfile(d); }).catch(() => {}); // S109 360聚合
  };
  const saveNote = async () => {
    if (!detail) return;
    const r = await fetch(`/api/follows/${detail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: noteText }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '纪要保存失败'); return; }
    setDetail(r as Follow); flash('纪要已保存', true); loadFollows();
  };
  /** S60 台账批量：选中切换/批量改状态/批量追加标签 */
  const toggleFsel = (id: string) => setFsel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clearFsel = () => setFsel(new Set());
  const runBatch = async (patchOf: (f: Follow) => object, label: string) => {
    const targets = (rows || []).filter((f) => fsel.has(f.id));
    if (!targets.length) return;
    const rs = await Promise.all(targets.map((f) => fetch(`/api/follows/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patchOf(f)) }).then((x) => x.json()).catch(() => null)));
    const okn = rs.filter((r) => r && !r.code).length;
    flash(okn === targets.length ? `${label} ${okn} 条` : `完成 ${okn}/${targets.length} 条（失败的重试）`, okn > 0);
    setFsel(new Set()); setBatchTagInput(''); loadFollows(); loadTagLib();
  };
  /** S65 保存提醒时间（到点且页面开着时系统通知；解析不了的文本只漏提醒不误报） */
  const saveRemind = async (id: string) => {
    if (!remindEdit || remindEdit.id !== id || !remindEdit.val.trim()) { flash('请输入提醒时间'); return; }
    const r = await fetch(`/api/follows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ next_remind_at: remindEdit.val.trim() }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '保存失败'); return; }
    setRemindEdit(null); flash('提醒时间已更新', true); loadFollows();
  };
  /** S67 全选当前筛选结果（与行内复选共用 fsel） */
  const fview = (rows || []).filter((f) => (!fsearch.trim() || f.peer_nick.includes(fsearch.trim())) && (!ftag || (f.tags || []).includes(ftag)) && (!revisitMode || visitDue(f, assistConfig.revisitDays))); // S129 复购到期chip参与筛选
  /** S121 查重清理：按昵称分组活跃线索≥2条=疑似重复；推荐保留=已转化>有金额>最新建档；其余标无效（可逆，不引入删除） */
  const [dupMode, setDupMode] = useState(false);
  const dupGroups = (() => {
    if (!dupMode) return [];
    const by = new Map<string, Follow[]>();
    (rows || []).filter((f) => f.status !== '无效').forEach((f) => { const k = f.peer_nick.trim(); if (!k) return; const arr = by.get(k) || []; arr.push(f); by.set(k, arr); });
    return [...by.values()].filter((g) => g.length >= 2).map((g) => {
      const d = [...g].sort((a, b) => (Number(b.status === '已转化') - Number(a.status === '已转化')) || ((b.amount || 0) - (a.amount || 0)) || ((b.created_at ? Date.parse(b.created_at) || 0 : 0) - (a.created_at ? Date.parse(a.created_at) || 0 : 0)));
      return { keep: d[0], rest: d.slice(1) };
    }).sort((a, b) => b.rest.length - a.rest.length);
  })();
  const dupRedundantIds = new Set(dupGroups.flatMap((g) => g.rest.map((f) => f.id)));
  const cleanAllDup = async () => {
    const targets = [...dupRedundantIds];
    if (!targets.length) { flash('没有可清理的重复项'); return; }
    const rs = await Promise.all(targets.map((id) => fetch(`/api/follows/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: '无效' }) }).then((x) => x.json()).catch(() => null)));
    const okn = rs.filter((r) => r && !r.code).length;
    flash(okn === targets.length ? `已把 ${okn} 条重复项标无效（误标可改回）` : `完成 ${okn}/${targets.length} 条`, okn > 0);
    loadFollows();
  };
  // S102 排序视图：紧急=提醒时间升序（逾期自动排最前，解析不出的沉底）；最新=建档时间倒序
  const sortedView = (() => {
    let arr = fview;
    if (dupMode) { const rank = new Map<string, number>(); dupGroups.forEach((g, gi) => { rank.set(g.keep.id, gi * 2); g.rest.forEach((r) => rank.set(r.id, gi * 2 + 1)); }); const d = arr.map((f) => ({ f, r: rank.get(f.id) ?? 9999 })); d.sort((a, b) => a.r - b.r); arr = d.map((x) => x.f); }
    if (fsort === 'urgent') { const d = arr.map((f) => ({ f, t: parseRemind(f.next_remind_at)?.getTime() ?? Number.MAX_SAFE_INTEGER })); d.sort((a, b) => a.t - b.t); return d.map((x) => x.f); }
    if (fsort === 'newest') { const d = arr.map((f) => ({ f, t: f.created_at ? Date.parse(f.created_at) || 0 : 0 })); d.sort((a, b) => b.t - a.t); return d.map((x) => x.f); }
    return arr;
  })();
  const checkAllF = () => setFsel((prev) => (prev.size === fview.length && fview.length > 0 ? new Set() : new Set(fview.map((x) => x.id))));  const batches: Follow[][] = [];
  (rows || []).forEach((f, i) => {
    const g = Math.floor(i / tasksConfig.followBatchSize);
    (batches[g] = batches[g] || []).push(f);
  });
  const batchLabel = new Map<string, string>();
  batches.forEach((g, gi) => { if (g[0]) batchLabel.set(g[0].id, `第${gi + 1}批`); });
  const exportFollows = () => {
    const flat = batches.flat();
    if (flat.length === 0) { flash('暂无数据可导出'); return; }
    downloadCsv('跟进台账.csv', ['对方', '联系方式', '状态', '下次提醒', '来源视频', '成交金额'], flat.map((f) => [f.peer_nick, f.contact || '', f.status, f.next_remind_at, f.source_video_id, f.amount ?? '']));
  };
  const addScript = async () => {
    if (!stitle.trim() || !scontent.trim()) { flash('请填写标题与内容'); return; }
    const r = await fetch('/api/scripts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: stitle.trim(), content: scontent.trim(), category: scatNew }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '添加失败'); return; }
    setStitle(''); setScontent('');
    fetch('/api/scripts').then((x) => x.json()).then((d) => { if (d.items?.length) setScripts(d.items); }).catch(() => {});
    flash('已添加', true);
  };
  /** S52 复制话术 */
  const copyText = async (t: string) => {
    try { await navigator.clipboard.writeText(t); flash('已复制', true); } catch { flash('复制失败，请手动复制'); }
  };
  /** S107 复制自定义话术即计一次使用（内置不统计防伪造）；置顶切换 */
  const copyScript = async (s: ScriptItem) => {
    await copyText(s.content);
    if (!s.id.startsWith('cs-')) return;
    fetch(`/api/scripts/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'use' }) })
      .then((r) => r.json()).then((d) => setScripts((prev) => prev.map((x) => (x.id === d.id ? { ...x, used: d.used } : x)))).catch(() => {});
  };
  const pinScript = async (s: ScriptItem, v: boolean) => {
    const r = await fetch(`/api/scripts/${s.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: v ? 'pin' : 'unpin' }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '操作失败'); return; }
    fetch('/api/scripts').then((x) => x.json()).then((d) => setScripts(d.items || [])).catch(() => {});
  };
  const delScript = async (id: string) => {
    const r = await fetch(`/api/scripts/${id}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '删除失败'); return; }
    flash('已移入回收站', true);
    fetch('/api/scripts').then((x) => x.json()).then((d) => { if (d.items?.length) setScripts(d.items); else setScripts([]); }).catch(() => {});
    loadTrash();
  };
  /** S57 恢复（话术/规则通用） */
  const restoreItem = async (kind: 'scripts' | 'rules', id: string) => {
    const r = await fetch(`/api/${kind === 'scripts' ? 'scripts' : 'reply-rules'}/${id}?restore=1`, { method: 'DELETE' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '恢复失败'); return; }
    flash('已恢复', true);
    fetch(`/api/${kind === 'scripts' ? 'scripts' : 'reply-rules'}`).then((x) => x.json()).then((d) => {
      if (kind === 'scripts') setScripts(d.items || []);
      else setRules(d.items || []);
    }).catch(() => {});
    loadTrash();
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
    flash('已移入回收站', true);
    loadRules();
    loadTrash();
  };

  const followCols: ColumnsType<Follow> = [
    { title: '', key: 'sel', width: 36, render: (_, f) => <Checkbox checked={fsel.has(f.id)} onChange={() => toggleFsel(f.id)} /> },
    { title: '批次', key: 'batch', width: 80, onCell: () => ({ className: 'num' }), render: (_, f) => batchLabel.get(f.id) || '' },
    { title: '对方', dataIndex: 'peer_nick', key: 'nick', render: (v: string, f) => { const inGroup = dupMode && (dupRedundantIds.has(f.id) || dupGroups.some((g) => g.keep.id === f.id)); return (<span>{inGroup && (dupRedundantIds.has(f.id) ? <span title="疑似重复：同名活跃线索中的次要项" style={{ marginRight: 4, opacity: 0.75 }}>⚠</span> : <span title="推荐保留项" style={{ marginRight: 4 }}>👑</span>)}{can('lead') ? <a onClick={() => openDetail(f)}>{v}</a> : <span>{v}</span>}</span>); } },
    { title: '联系方式', key: 'contact', width: 130, render: (_, f) => (
      <Popconfirm
        title="联系方式（电话/微信，仅存本机）"
        open={cEdit?.id === f.id}
        onOpenChange={(o) => { if (o) setCEdit({ id: f.id, val: f.contact || '' }); else setCEdit(null); }}
        description={<Input size="small" placeholder="如 138xxxx / wx:abc" value={cEdit?.id === f.id ? cEdit.val : ''} onChange={(e) => setCEdit({ id: f.id, val: e.target.value })} maxLength={32} style={{ width: 180 }} onPressEnter={() => saveContact(f.id)} />}
        okText="保存" cancelText="取消" onConfirm={() => saveContact(f.id)}
      >
        <Button size="small" type="text" style={{ paddingInline: 0, maxWidth: 120 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: 110, verticalAlign: 'bottom' }}>{f.contact || <span style={{ color: '#C8C5BE' }}>+联系</span>}</span></Button>
      </Popconfirm>
    ) },
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
    { title: '下次提醒', key: 'remind', onCell: () => ({ className: 'num' }), render: (_, f) => (
      <Popconfirm
        title="修改提醒时间"
        open={remindEdit?.id === f.id}
        onOpenChange={(o) => { if (o) setRemindEdit({ id: f.id, val: f.next_remind_at }); else setRemindEdit(null); }}
        description={
          <div style={{ width: 250 }}>
            <Input size="small" value={remindEdit?.id === f.id ? remindEdit.val : ''} onChange={(e) => remindEdit && setRemindEdit({ id: f.id, val: e.target.value })} maxLength={40} placeholder="明天 18:00 / 10-20 09:30" onPressEnter={() => saveRemind(f.id)} />
            <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 6 }}>支持 今天/明天/后天 HH:MM、MM-DD HH:MM、ISO时间；到点且工作台开着时系统提醒</div>
          </div>
        }
        okText="保存" cancelText="取消" onConfirm={() => saveRemind(f.id)}
      >
        <Button size="small" type="text" style={{ paddingInline: 0 }}><u>{f.next_remind_at}</u></Button>
      </Popconfirm>
    ) },
    { title: '标签', key: 'tags', width: 140, render: (_, f) => (!can('lead')
      ? <span style={{ color: '#A8A5A0', fontSize: 12 }}>🔒专业版</span>
      : (
      <Popconfirm
        title="线索标签"
        open={tagEdit?.id === f.id}
        onOpenChange={(o) => { if (!o) { setTagEdit(null); setNewTag(''); } }}
        description={
          <div style={{ width: 250 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 26 }}>
              {[...new Set([...tagLib, ...(f.tags || []), ...(tagEdit?.tags || [])])].map((t) => (
                <Tag key={t} color={(tagEdit?.tags || f.tags || []).includes(t) ? 'processing' : undefined} style={{ cursor: 'pointer', marginInlineEnd: 0 }} onClick={() => toggleTagEdit(t)}>{t}</Tag>
              ))}
            </div>
            <Input size="small" placeholder="新建标签，回车添加" value={newTag} onChange={(e) => setNewTag(e.target.value)} onPressEnter={addNewTag} maxLength={8} />
          </div>
        }
        okText="保存" cancelText="关闭" onConfirm={saveTags}
      >
        <Button size="small" type="text" onClick={() => setTagEdit({ id: f.id, tags: [...(f.tags || [])] })} style={{ paddingInline: 0 }}>
          {f.tags && f.tags.length ? <span style={{ color: '#1677FF' }}>{f.tags.join(' / ')}</span> : '+标签'}
        </Button>
      </Popconfirm>
      )) },
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b>话术库</b>
              <span style={{ fontSize: 11, color: '#A8A5A0' }}>支持{'{nick}'}{'{product}'}变量</span>
              <span style={{ flex: 1 }} />
              <Input size="small" value={sQw} onChange={(e) => setSQw(e.target.value)} placeholder="搜索话术" style={{ width: 120 }} allowClear />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {['全部', ...new Set(scripts.map((s) => s.category))].map((c) => (
                <Button key={c} size="small" type={sCat === c ? 'primary' : 'default'} onClick={() => setSCat(c)}>{c}{c !== '全部' ? ` ${scripts.filter((s) => s.category === c).length}` : ` ${scripts.length}`}</Button> // S107 分类计数
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Select size="small" value={scatNew} onChange={setScatNew} style={{ width: 90 }} options={['自定义', '欢迎语', '报价', '留资引导'].map((c) => ({ value: c, label: c }))} />
              <Input size="small" value={stitle} onChange={(e) => setStitle(e.target.value)} placeholder="标题" style={{ width: 90 }} />
              <Input size="small" value={scontent} onChange={(e) => setScontent(e.target.value)} placeholder="话术内容" onPressEnter={addScript} />
              <Button size="small" type="primary" onClick={addScript}>添加</Button>
            </div>
            {/* S130 编辑时实时体检：命中即黄字提示改写方向 */}
            {(() => { const hits = scanText(scontent); return hits.length > 0 && (
              <div style={{ fontSize: 11, color: '#8A6D1F', background: '#FBF3E4', border: '1px solid #EADFBE', borderRadius: 4, padding: '5px 10px', marginTop: 6 }}>
                {hits.map((h) => <div key={h.name}>⚠ <b>{h.name}</b>：{h.why} → {h.fix}</div>)}
              </div>
            ); })()}
            {(() => {
              const filtered = scripts.filter((s) => (sCat === '全部' || s.category === sCat) && (!sQw.trim() || s.title.includes(sQw.trim()) || s.content.includes(sQw.trim())));
              if (filtered.length === 0) return <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 12 }}>无匹配话术，换个分类或搜索词试试</div>;
              return filtered.map((s) => (
                <div key={s.id} style={{ border: '1px solid #E8E6E1', borderRadius: 4, padding: '10px 12px', marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#A8A5A0', marginBottom: 4 }}>
                    <Tag style={{ marginInlineEnd: 6 }}>{s.category}</Tag>{s.pinned ? '📌 ' : ''}{s.title}
                  {(() => { const hits = scanText(s.content); return hits.length > 0 && <span title={hits.map((h) => `${h.name}：${h.why}`).join('\n')} style={{ marginLeft: 6, color: '#9A6B2F', cursor: 'help' }}>⚠合规{hits.length}项</span>; })()}
                    {(s.used || 0) > 0 && <span className="num" style={{ marginLeft: 6, color: s.used! >= 5 ? '#B4443C' : '#A8A5A0' }}>用过 {s.used} 次</span>}
                  </div>
                  {s.content}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <Button size="small" type="text" style={{ paddingInline: 0 }} onClick={() => copyScript(s)}>复制</Button>
                    {s.id.startsWith('cs-') && (
                      <Button size="small" type="text" onClick={() => pinScript(s, !s.pinned)}>{s.pinned ? '取消置顶' : '置顶'}</Button>
                    )}
                    {!['s1', 's2', 's3'].includes(s.id) && <Button size="small" type="text" danger onClick={() => delScript(s.id)}>删除</Button>}
                  </div>
                </div>
              ));
            })()}
            {/* S57 回收站（话术+规则合并入口，折叠展示） */}
            {(scriptTrash.length + ruleTrash.length) > 0 && (
              <div style={{ marginTop: 12, borderTop: '1px solid #E8E6E1', paddingTop: 8 }}>
                <Button size="small" type="text" onClick={() => setShowTrash(!showTrash)}>
                  回收站（{scriptTrash.length + ruleTrash.length}）{showTrash ? '收起' : '展开'}
                </Button>
                {showTrash && (
                  <div style={{ marginTop: 4 }}>
                    {scriptTrash.map((s) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 0', borderBottom: '1px solid #F0EEEA' }}>
                        <Tag style={{ marginInlineEnd: 0 }}>{s.category}</Tag>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.content}</span>
                        <Button size="small" type="text" onClick={() => restoreItem('scripts', s.id)}>恢复</Button>
                      </div>
                    ))}
                    {ruleTrash.map((r) => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 0', borderBottom: '1px solid #F0EEEA' }}>
                        <Tag style={{ marginInlineEnd: 0 }}>规则</Tag>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.keyword} → {r.reply}</span>
                        <Button size="small" type="text" onClick={() => restoreItem('rules', r.id)}>恢复</Button>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 6 }}>误删都在这里，恢复即回到列表</div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="card" style={{ padding: 16, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b>手动跟进台账</b>
              <span style={{ flex: 1 }} />
              <Radio.Group size="small" value={fmode} onChange={(e) => switchMode(e.target.value)} optionType="button" options={[{ value: 'table', label: '表格' }, { value: 'board', label: '看板' }, { value: 'cal', label: '日历' }]} />
              <Select size="small" value={fsort} onChange={(v) => setFsort(v)} style={{ width: 106 }} options={[{ value: 'default', label: '默认顺序' }, { value: 'urgent', label: '催办紧急' }, { value: 'newest', label: '最新建档' }]} />
              <Select size="small" value={fstatus} onChange={(v) => { setFstatus(v); loadFollows(v); }} style={{ width: 110 }} options={[{ value: '', label: '全部状态' }, ...assistConfig.followStatuses.map((s) => ({ value: s, label: s }))]} />
              <Select size="small" value={ftag || undefined} onChange={(v) => setFtag(v || '')} style={{ width: 110 }} placeholder="按标签" allowClear options={tagLib.map((t) => ({ value: t, label: t }))} />
              <Button size="small" onClick={checkAllF} disabled={fview.length === 0}>{fsel.size === fview.length && fview.length > 0 ? '取消全选' : `全选${fview.length ? `(${fview.length})` : ''}`}</Button>
              <Button size="small" type={dupMode ? 'primary' : 'text'} onClick={() => setDupMode((v) => !v)} title="按昵称分组找重复线索，标无效不删除">查重</Button>
              <Button size="small" type={revisitMode ? 'primary' : 'text'} onClick={() => setRevisitMode((v) => !v)} title={`已转化且超${assistConfig.revisitDays}天没有接触记录的老客户`}>复购到期{(rows || []).filter((f) => visitDue(f, assistConfig.revisitDays)).length > 0 ? `(${(rows || []).filter((f) => visitDue(f, assistConfig.revisitDays)).length})` : ''}</Button>
              {dupMode && (
                <span style={{ fontSize: 12, color: dupGroups.length ? '#8A6D1F' : '#4C6B57', background: dupGroups.length ? '#FBF3E4' : '#F5FAF6', border: `1px solid ${dupGroups.length ? '#EADFBE' : '#C8D8CC'}`, borderRadius: 4, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {dupGroups.length ? `${dupGroups.length} 组同名活跃线索，共 ${dupGroups.reduce((s, g) => s + g.rest.length, 0)} 条疑似重复（保留项=已转化>有金额>最新建档）` : '未发现同名重复，台账是干净的'}
                  {dupGroups.length > 0 && <Button size="small" danger type="primary" onClick={cleanAllDup}>一键把其余标无效</Button>}
                </span>
              )}
              <span style={{ position: 'relative' }}>
                <Button size="small" onClick={() => setColsOpen((v) => !v)}>列设置</Button>
                {colsOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 26, zIndex: 50, background: '#fff', border: '1px solid #E8E6E1', borderRadius: 6, boxShadow: '0 10px 28px rgba(26,26,24,0.16)', padding: '8px 12px', width: 130 }}>
                    <div style={{ fontSize: 11, color: '#A8A5A0', marginBottom: 6 }}>显示列（对方/状态固定）</div>
                    {HIDABLE_COLS.map((c) => (
                      <label key={c.key} style={{ display: 'block', fontSize: 12, margin: '3px 0', cursor: 'pointer' }}>
                        <Checkbox checked={!hiddenCols.has(c.key)} onChange={() => toggleCol(c.key)} style={{ marginRight: 6 }} />{c.label}
                      </label>
                    ))}
                  </div>
                )}
              </span>
            </div>
            <div className="num" style={{ fontSize: 12, color: '#6B6862', marginTop: 4 }}>每批{tasksConfig.followBatchSize}个 · 每{tasksConfig.groupFollowIntervalMin}分钟一批 · 默认{assistConfig.defaultRemindHour}:00提醒（纯展示，不自动发送）</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Input size="small" value={fpeer} onChange={(e) => setFpeer(e.target.value)} placeholder="对方昵称" style={{ width: 130 }} onPressEnter={addFollow} />
              <Select size="small" value={fsource} onChange={setFsource} style={{ minWidth: 200 }} options={videos.map((v) => ({ value: v.id, label: v.title }))} />
              <Button size="small" type="primary" onClick={addFollow}>加入跟进</Button>
              <Input size="small" value={fsearch} onChange={(e) => setFsearch(e.target.value)} placeholder="搜对方昵称" style={{ width: 120 }} allowClear />
              <Button size="small" onClick={exportFollows}>导出CSV</Button>
            </div>
            {fsel.size > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap', background: '#FCFBF9', border: '1px solid #E8E6E1', borderRadius: 4, padding: '6px 10px' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>已选 {fsel.size}</span>
                <Select size="small" placeholder="批量改状态" value={null} onChange={(v) => runBatch(() => ({ status: v }), '状态已改')} style={{ width: 110 }} options={assistConfig.followStatuses.map((s) => ({ value: s, label: s }))} />
                <Select size="small" placeholder="批量排提醒" value={null} onChange={(v) => { const d = new Date(); if (v === 'tmr') d.setDate(d.getDate() + 1); else if (v === 'd3') d.setDate(d.getDate() + 3); else { const wd = (8 - d.getDay()) % 7 || 7; d.setDate(d.getDate() + wd); } runBatch(() => ({ next_remind_at: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 09:00` }), v === 'tmr' ? '已排明天9点' : v === 'd3' ? '已排3天后9点' : '已拍下周一9点'); }} style={{ width: 112 }} options={[{ value: 'tmr', label: '明天 9:00' }, { value: 'mon', label: '下周一 9:00' }, { value: 'd3', label: '3天后 9:00' }]} />
                <Input size="small" placeholder="追加标签(≤8字)" value={batchTagInput} onChange={(e) => setBatchTagInput(e.target.value)} maxLength={8} style={{ width: 140 }} onPressEnter={() => runBatch((f) => ({ tags: [...new Set([...(f.tags || []), batchTagInput.trim()])].slice(0, 10) }), '标签已加')} />
                <Button size="small" disabled={!batchTagInput.trim()} onClick={() => runBatch((f) => ({ tags: [...new Set([...(f.tags || []), batchTagInput.trim()])].slice(0, 10) }), '标签已加')}>批量打标</Button>
                <Button size="small" type="text" onClick={clearFsel}>取消选择</Button>
              </div>
            )}
            {fmode === 'table' && (
              <Table<Follow> size="small" pagination={{ pageSize: 20, showSizeChanger: false, size: 'small', showTotal: (t) => `共${t}条线索` }} style={{ marginTop: 8 }} columns={followCols.filter((col) => !hiddenCols.has(String(col.key)))} dataSource={sortedView} rowKey="id" loading={rows === null} locale={{ emptyText: '暂无跟进' }}
                onRow={(f) => ({ onContextMenu: (e) => { e.preventDefault(); setFctx({ x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 260), f }); } })} />
            )}
            {/* S102 台账右键菜单：改状态走既有changeStatus，催办走既有PATCH */}
            {fctx && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 997 }} onClick={() => setFctx(null)} onContextMenu={(e) => { e.preventDefault(); setFctx(null); }} />
                <div style={{ position: 'fixed', left: fctx.x, top: fctx.y, zIndex: 998, background: '#fff', border: '1px solid #E8E6E1', borderRadius: 6, boxShadow: '0 10px 28px rgba(26,26,24,0.18)', padding: '4px 0', minWidth: 176 }}>
                  <div style={{ padding: '4px 14px 6px', fontSize: 11, color: '#A8A5A0', borderBottom: '1px solid #F0EEEA', marginBottom: 4 }}>{fctx.f.peer_nick} · {fctx.f.status}</div>
                  {assistConfig.followStatuses.map((s) => (
                    <div key={s} onClick={() => { if (s !== fctx.f.status) changeStatus(fctx.f.id, s); setFctx(null); }} style={{ padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: s === fctx.f.status ? '#A8A5A0' : '#1A1A18' }}>标为{s}{s === fctx.f.status ? '（当前）' : ''}</div>
                  ))}
                  <div style={{ borderTop: '1px solid #F0EEEA', margin: '4px 0' }} />
                  <div onClick={() => { urgeTomorrow(fctx.f.id); setFctx(null); }} style={{ padding: '5px 14px', fontSize: 12, cursor: 'pointer' }}>催办：明天 9 点提醒</div>
                  <div onClick={() => { setFctx(null); if (can('lead')) openDetail(fctx.f); else message.info('线索档案属专业版'); }} style={{ padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: can('lead') ? '#1A1A18' : '#A8A5A0' }}>{can('lead') ? '打开档案' : '打开档案（专业版）'}</div>
                </div>
              </>
            )}
            {fmode === 'board' && (
              <div>
                <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 8, marginBottom: 6 }}>卡片在状态列之间拖动=改跟进状态（走既有保存接口）；点卡片看档案</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                  {assistConfig.followStatuses.map((st) => {
                    const list = fview.filter((f) => f.status === st);
                    return (
                      <div
                        key={st}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); const f = fview.find((x) => x.id === id); if (f && f.status !== st) changeStatus(id, st); }}
                        style={{ background: '#FCFBF9', border: '1px dashed #E8E6E1', borderRadius: 6, padding: 8, minHeight: 200 }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#6B6862', marginBottom: 8 }}>{st} <span className="num" style={{ color: '#A8A5A0' }}>{list.length}</span></div>
                        {list.map((f) => (
                          <div
                            key={f.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', f.id)}
                            onClick={() => { if (can('lead')) openDetail(f); }}
                            style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 4, padding: '7px 9px', marginBottom: 6, cursor: 'grab', fontSize: 12 }}
                          >
                            <div style={{ fontWeight: 700 }}>{f.peer_nick}</div>
                            <div style={{ color: '#A8A5A0', marginTop: 2 }}>提醒 {f.next_remind_at}</div>
                            {st === '已转化' && f.amount != null && <div className="num" style={{ marginTop: 2 }}>¥{f.amount.toLocaleString()}</div>}
                            {f.tags && f.tags.length > 0 && <div style={{ marginTop: 3 }}>{f.tags.slice(0, 3).map((t) => <Tag key={t} style={{ marginInlineEnd: 4, fontSize: 10 }}>{t}</Tag>)}</div>}
                          </div>
                        ))}
                        {list.length === 0 && <div style={{ fontSize: 11, color: '#C8C5BE', textAlign: 'center', paddingTop: 24 }}>拖到这里</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {fmode === 'cal' && (() => {
              const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const days: { key: string; label: string; items: Follow[] }[] = [];
              const overdue: Follow[] = [];
              for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(d.getDate() + i); days.push({ key: dkey(d), label: `${d.getMonth() + 1}/${d.getDate()}${i === 0 ? '（今天）' : ''}`, items: [] }); }
              for (const f of fview) {
                if (!['待回访', '已手动回复'].includes(f.status)) continue;
                const d = parseRemind(f.next_remind_at);
                if (!d) continue;
                const col = days.find((x) => x.key === dkey(d));
                if (col) col.items.push(f);
                else if (d.getTime() < today.getTime()) overdue.push(f);
              }
              const col = (label: string, items: Follow[], red = false) => (
                <div key={label} style={{ background: '#FCFBF9', border: `1px solid ${red ? '#F0D4D1' : '#E8E6E1'}`, borderRadius: 6, padding: 8, minHeight: 120 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: red ? '#B4443C' : '#6B6862', marginBottom: 6 }}>{label} <span className="num">{items.length}</span></div>
                  {items.slice(0, 12).map((f) => (
                    <div key={f.id} onClick={() => { if (can('lead')) openDetail(f); }} style={{ background: '#fff', border: '1px solid #E8E6E1', borderRadius: 4, padding: '5px 8px', marginBottom: 5, fontSize: 12, cursor: can('lead') ? 'pointer' : 'default' }}>
                      <b>{f.peer_nick}</b> <span style={{ color: '#A8A5A0' }}>{f.next_remind_at}</span>
                    </div>
                  ))}
                  {items.length > 12 && <div style={{ fontSize: 11, color: '#A8A5A0' }}>另有{items.length - 12}条…</div>}
                </div>
              );
              return (
                <div>
                  <div style={{ fontSize: 11, color: '#A8A5A0', margin: '8px 0 6px' }}>按「下次提醒」排布未来7天+逾期（仅待回访/已手动回复；口语提醒按今天解析）。到点提醒需开着工作台。</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                    {overdue.length > 0 && col('逾期', overdue, true)}
                    {days.map((c) => col(c.label, c.items))}
                  </div>
                </div>
              );
            })()}
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
        {/* S49 线索档案抽屉：纪要 + 操作历史 + 档案信息 */}
        <Drawer title={detail ? `线索档案 · ${detail.peer_nick}` : ''} placement="right" width={420} open={!!detail} onClose={() => setDetail(null)}>
          {detail && (
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <Tag color={detail.status === '已转化' ? 'success' : detail.status === '待回访' ? 'warning' : 'default'}>{detail.status}</Tag>
                {(detail.tags || []).map((t) => <Tag key={t} color="processing">{t}</Tag>)}
                {detail.amount != null && <Tag color="gold">成交 ¥{detail.amount.toLocaleString()}</Tag>}
              </div>
              <div style={{ fontSize: 13, color: '#6B6862', lineHeight: 2 }}>
                <div>登记时间：{detail.created_at ? new Date(detail.created_at).toLocaleString('zh-CN', { hour12: false }) : '—'}</div>
                <div>下次提醒：{detail.next_remind_at}</div>
                <div>来源视频：{videos.find((v) => v.id === detail.source_video_id)?.title || detail.source_video_id}</div>
                {/* S129 最近接触：本机可信ISO事件（建档/任一操作），无任何记录不瞎猜 */}
                <div>最近联系：{(() => { const d = daysSinceTouch(detail); return d === null ? <span style={{ color: '#A8A5A0' }}>本机无接触记录</span> : d === 0 ? <span>今天</span> : <span className="num">{d} 天前</span>; })()}{detail.status === '已转化' && visitDue(detail, assistConfig.revisitDays) && <span style={{ color: '#9A6B2F', marginLeft: 8 }}>· 超{assistConfig.revisitDays}天，该回访了</span>}</div>
                {detail.contact && <div>联系方式：<span className="num">{detail.contact}</span> <Button size="small" type="text" style={{ paddingInline: 4 }} onClick={async () => { try { await navigator.clipboard.writeText(detail.contact || ''); flash('已复制联系方式', true); } catch { flash('复制失败'); } }}>复制</Button></div>}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 8px' }}>跟进纪要</div>
              <Input.TextArea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} maxLength={500} placeholder="记录客户需求、报价、约跟进时间…" />
              <Button size="small" type="primary" style={{ marginTop: 8 }} onClick={saveNote}>保存纪要</Button>
              {/* S115 一句话速记：自动带日期追加，免切全文 */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <Input size="small" value={qn} onChange={(e) => setQn(e.target.value)} placeholder={'速记一条（自动加日期追加）如：已报价298约明晚'} maxLength={120} onPressEnter={quickNote} />
                <Button size="small" onClick={quickNote} disabled={!qn.trim()}>速记</Button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>操作历史（最近{detail.history?.length || 0}条）</div>
              {!detail.history?.length && <div style={{ fontSize: 12, color: '#A8A5A0' }}>暂无记录，改状态/记账/打标会自动留痕</div>}
              {(detail.history || []).slice(0, 20).map((h, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #F0EEEA' }}>
                  <span className="num" style={{ color: '#A8A5A0', marginRight: 8 }}>{new Date(h.at).toLocaleString('zh-CN', { hour12: false })}</span>
                  {h.act}
                </div>
              ))}
              {/* S109 360聚合：跨集合时间线（只用可信字段计数，评论时间原样展示） */}
              {profile && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>360 接触全景 {!profile.stats.last_touch ? '' : `· 首触 ${profile.stats.first_touch ? profile.stats.first_touch.slice(5, 10) : '—'} · 最近 ${profile.stats.last_touch.slice(5, 10)}`}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <Tag style={{ marginInlineEnd: 0 }}>评论 {profile.stats.comments_n}</Tag>
                    {profile.stats.high_n > 0 && <Tag color="error" style={{ marginInlineEnd: 0 }}>高意向 {profile.stats.high_n}</Tag>}
                    {profile.stats.replied_n > 0 && <Tag color="blue" style={{ marginInlineEnd: 0 }}>我回过 {profile.stats.replied_n}</Tag>}
                    <Tag style={{ marginInlineEnd: 0 }}>建档 {profile.stats.follows_n}</Tag>
                    {profile.stats.done_n > 0 && <Tag color="success" style={{ marginInlineEnd: 0 }}>成交 {profile.stats.done_n} 单{profile.stats.amount_sum ? ` ¥${profile.stats.amount_sum.toLocaleString()}` : ''}</Tag>}
                  </div>
                  {profile.comments.length > 0 && <div style={{ fontSize: 12, color: '#6B6862', marginBottom: 4 }}>最近评论：</div>}
                  {profile.comments.slice(0, 5).map((c) => (
                    <div key={c.id} style={{ fontSize: 12, padding: '5px 0', borderBottom: '1px solid #F0EEEA', wordBreak: 'break-all' }}>
                      <span style={{ color: '#A8A5A0' }}>{c.create_time} · {c.intent} · </span>{c.content.slice(0, 46)}{c.content.length > 46 ? '…' : ''}
                    </div>
                  ))}
                  {profile.replies.length > 0 && <div style={{ fontSize: 12, color: '#6B6862', margin: '10px 0 4px' }}>我的回评：</div>}
                  {profile.replies.slice(0, 4).map((r, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '4px 0', color: '#1677FF', wordBreak: 'break-all' }}>{r.content.slice(0, 46)}{r.content.length > 46 ? '…' : ''} <span className="num" style={{ color: '#A8A5A0' }}>{r.at}</span></div>
                  ))}
                </div>
              )}
              {profile === null && detail && <div style={{ fontSize: 11, color: '#C8C5BE', marginTop: 14 }}>360 聚合加载中…</div>}
            </div>
          )}
        </Drawer>
      </div>
    </div>
  );
}
