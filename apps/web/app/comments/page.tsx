'use client';
import { useEffect, useRef, useState } from 'react';
import { App, Button, Checkbox, Input, Select } from 'antd';
import { commentsConfig } from '@/config/comments.config';
import { downloadCsv } from '@/lib/csv';
import type { Video, CommentItem, ScriptItem, TemplateItem } from '@/lib/types';

/** S8 评论工作台三栏：左作品（含未读）/中评论流/右详情（意图PATCH+跟进），快捷键j/k/e/1/2/3/c */
export default function Comments() {
  const { message } = App.useApp();
  const [videos, setVideos] = useState<Video[]>([]);
  const [selVideo, setSelVideo] = useState('');
  const [intent, setIntent] = useState('');
  const [items, setItems] = useState<CommentItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [kw, setKw] = useState('');
  const [hot, setHot] = useState<string[]>(commentsConfig.hotKeywords);
  const [unreadOnly, setUnreadOnly] = useState(commentsConfig.onlyUnreadDefault);
  const [selId, setSelId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<(ScriptItem | TemplateItem)[]>([]);
  const [replies, setReplies] = useState<{ id: string; comment_id: string; content: string; at: string }[]>([]);
  const [replyText, setReplyText] = useState('');
  const [product, setProduct] = useState('跑刀代跑');
  const [drafts, setDrafts] = useState<{ id: string; label: string; content: string }[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [tone, setTone] = useState('亲切');
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const flash = (t: string, ok = false) => (ok ? message.success(t) : message.error(t));

  const load = (o?: { v?: string; it?: string; k?: string; uo?: boolean }) => {
    const v = o?.v ?? selVideo, it = o?.it ?? intent, k = o?.k ?? kw, uo = o?.uo ?? unreadOnly;
    const q = new URLSearchParams({ keyword: k, unread_only: uo ? '1' : '0' });
    if (v) q.set('video_id', v);
    if (it) q.set('intent', it);
    fetch(`/api/comments?${q}`).then((r) => r.json()).then((d) => {
      setItems(d.items || []);
      // 选中保持：业务操作刷新（无参load）不因过滤移除而跳走（防回评/跟进记错条）；用户主动切筛选才重选第一条
      setSelId((prev) => {
        const list = (d.items || []) as CommentItem[];
        if (list.some((x) => x.id === prev)) return prev;
        const filterChanged = !!o && (o.v !== undefined || o.it !== undefined || o.k !== undefined || o.uo !== undefined);
        return filterChanged ? (list[0]?.id || null) : prev;
      });
    }).catch(() => flash('列表加载失败，请重试'));
    fetch('/api/comments?unread_only=1').then((r) => r.json()).then((d) => {
      const c: Record<string, number> = {};
      (d.items || []).forEach((x: CommentItem) => { c[x.video_id] = (c[x.video_id] || 0) + 1; });
      setCounts(c);
    }).catch(() => { /* 角标非关键路径，失败静默，下轮刷新自愈 */ });
  };

  useEffect(() => {
    fetch('/api/videos').then((r) => r.json()).then((d) => setVideos(d.items || [])).catch(() => {});
    fetch('/api/settings').then((r) => r.json()).then((s) => { if (s?.service_name) setProduct(s.service_name); }).catch(() => {});
    // S46 URL深链（运营建议跳转带 ?intent= 高意向 等）
    const urlIntent = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('intent') : null;
    if (urlIntent && commentsConfig.intentOptions.includes(urlIntent)) { setIntent(urlIntent); load({ it: urlIntent }); } else load();
    fetch('/api/comments/keywords/hot').then((r) => r.json()).then((d) => { if (d.items?.length) setHot(d.items.map((x: { kw: string }) => x.kw)); }).catch(() => {});
    fetch('/api/scripts/templates?intent=普通').then((r) => r.json()).then((d) => { if (d.items?.length) setScripts(d.items); }).catch(() => {
      fetch('/api/scripts').then((r) => r.json()).then((d) => { if (d.items?.length) setScripts(d.items); }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 网络请求统一出口：业务错/网络错都转用户可见提示，返回null表示失败 */
  const call = async (p: Promise<Response>, what = '操作') => {
    try {
      const j = await (await p).json().catch(() => null);
      if (!j || j.code) { flash(j?.message || `${what}失败，请重试`); return null; }
      return j;
    } catch { flash('网络异常，请重试'); return null; }
  };
  const markRead = async (id: string) => {
    const j = await call(fetch('/api/comments/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [id] }) }), '标已读');
    if (j) load();
  };
  const setIntentOf = async (id: string, v: string) => {
    const j = await call(fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: v }) }), '改意图');
    if (j) load();
  };
  const toggleIgnore = async (c: CommentItem) => {
    const j = await call(fetch(`/api/comments/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ignore: !c.ignore }) }), '忽略操作');
    if (j) load();
  };
  const batchRead = async () => {
    const ids = items.filter((x) => !x.is_read_local).map((x) => x.id).slice(0, commentsConfig.batchReadMax);
    if (ids.length === 0) return;
    const j = await call(fetch('/api/comments/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }), '批量标已读');
    if (j) load();
  };
  const exportComments = () => {
    if (items.length === 0) { flash('暂无数据可导出'); return; }
    downloadCsv('评论线索.csv', ['用户', '时间', '意图', '已读', '内容'], items.map((x) => [x.user_nick, x.create_time, x.intent, x.is_read_local ? '是' : '否', x.content]));
  };
  // ── S34 多选批量 ──
  const toggleCheck = (id: string) => setChecked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const checkAll = () => setChecked((prev) => (prev.size === items.length ? new Set() : new Set(items.map((x) => x.id))));
  const clearCheck = () => setChecked(new Set());
  const batchReadSel = async () => {
    const ids = [...checked].slice(0, commentsConfig.batchReadMax);
    if (!ids.length) return;
    const j = await call(fetch('/api/comments/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) }), '批量标已读');
    if (j) { clearCheck(); load(); }
  };
  const batchIntentSel = async (v: string) => {
    const ids = [...checked];
    if (!ids.length || !v) return;
    const rs = await Promise.all(ids.map((id) => fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intent: v }) }).then((x) => x.json()).catch(() => null)));
    const okn = rs.filter((r) => r && !r.code).length;
    flash(okn === ids.length ? `已改 ${okn} 条意图` : `完成 ${okn}/${ids.length} 条`, okn > 0);
    clearCheck(); load();
  };
  const batchFollowSel = async () => {
    const targets = items.filter((x) => checked.has(x.id));
    const uniq = [...new Map(targets.map((x) => [x.user_nick, x])).values()];
    if (!uniq.length) return;
    const rs = await Promise.all(uniq.map((x) => fetch('/api/follows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ peer_nick: x.user_nick, source_video_id: x.video_id }) }).then((r) => r.json()).catch(() => null)));
    const okn = rs.filter((r) => r && !r.code).length;
    await Promise.all(targets.map((x) => fetch('/api/comments/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [x.id] }) }).catch(() => {})));
    flash(`已加入跟进 ${okn} 人并标已读`, okn > 0);
    clearCheck(); load();
  };
  const replied = async (c: CommentItem) => {
    const f = await call(fetch('/api/follows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ peer_nick: c.user_nick, source_video_id: c.video_id }) }), '登记跟进');
    if (!f) return;
    await call(fetch('/api/comments/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [c.id] }) }), '标已读');
    flash('已登记跟进', true); load();
  };
  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(t); flash('已复制', true); } catch { flash('复制失败，请手动复制'); }
  };
  const loadReplies = (id: string) => fetch(`/api/comments/${id}/replies`).then((r) => r.json()).then((d) => setReplies(d.items || [])).catch(() => {});
  const sendReply = async () => {
    if (!sel || !replyText.trim()) { flash('先写回评内容'); return; }
    const j = await call(fetch(`/api/comments/${sel.id}/replies`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: replyText.trim() }) }), '发送回评');
    if (!j) return;
    setReplyText(''); loadReplies(sel.id);
  };
  const genDrafts = async () => {
    if (!sel) return;
    setGenBusy(true);
    try {
      const r = await fetch('/api/scripts/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sel.content, intent: sel.intent, nick: sel.user_nick, product, video_title: videos.find((v) => v.id === sel.video_id)?.title || '', tone }),
      }).then((x) => x.json()).catch(() => null);
      if (r?.items?.length) { setDrafts(r.items); flash('已生成候选，挑一条用', true); }
      else flash('生成失败，请重试');
    } finally { setGenBusy(false); }
  };

  // 快捷键：输入框/下拉内不触发
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (t?.closest?.('.ant-select-dropdown, .ant-picker-dropdown')) return;
      const idx = items.findIndex((x) => x.id === selId);
      if (e.key === 'j' || e.key === 'k') {
        const n = e.key === 'j' ? Math.min(idx + 1, items.length - 1) : Math.max(idx - 1, 0);
        if (items[n]) setSelId(items[n].id);
      } else if (e.key === 'e' && selId) markRead(selId);
      else if (['1', '2', '3'].includes(e.key) && selId) {
        const v = commentsConfig.intentOptions[Number(e.key) - 1];
        if (v) setIntentOf(selId, v);
      } else if (e.key === 'c') {
        const c = items.find((x) => x.id === selId);
        if (c) copy(c.content);
      } else if (e.key === 'a' && items.length) {
        checkAll();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selId]);

  const selCacheRef = useRef<CommentItem | null>(null);
  const sel = items.find((x) => x.id === selId) || (selCacheRef.current && selCacheRef.current.id === selId ? selCacheRef.current : null);
  // 详情缓存：选中项被"只看未读"等过滤移除后详情保持显示，防操作目标静默漂移
  useEffect(() => { if (sel) selCacheRef.current = sel; }, [sel]);
  // 选中变化时按意图+昵称+产品重取话术模板
  useEffect(() => {
    if (!sel) return;
    setDrafts([]);
    loadReplies(sel.id);
    fetch(`/api/scripts/templates?intent=${encodeURIComponent(sel.intent)}&nick=${encodeURIComponent(sel.user_nick)}&product=${encodeURIComponent(product)}`).then((r) => r.json()).then((d) => { if (d.items?.length) setScripts(d.items); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id, sel?.intent]);
  const totalUnread = Object.values(counts).reduce((a, b) => a + b, 0);
  const colorOf = (it: string) => commentsConfig.intentColors[it as keyof typeof commentsConfig.intentColors] || commentsConfig.intentColors['默认'];
  const intentOpts = [{ value: '', label: '全部意图' }, ...commentsConfig.intentOptions.map((o) => ({ value: o, label: o }))];

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1' }}><b style={{ fontSize: 15 }}>评论工作台</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>只看自己视频 · 本地已读 · 快捷键 j/k/e/1/2/3/c/a（a=全选）</div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto' }}>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input size="small" value={kw} onChange={(e) => setKw(e.target.value)} onPressEnter={() => load({ k: kw })} placeholder="搜索关键词" style={{ width: 200 }} allowClear />
          <Select size="small" value={intent} onChange={(v) => { setIntent(v); load({ it: v }); }} style={{ width: 120 }} options={intentOpts} />
          <Checkbox checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); load({ uo: e.target.checked }); }} style={{ fontSize: 12, color: '#6B6862' }}>只看未读</Checkbox>
          <span style={{ flex: 1 }} />
          {checked.size > 0 && (
            <>
              <span style={{ fontSize: 12, color: '#6B6862' }}>已选 {checked.size}</span>
              <Button size="small" onClick={batchReadSel}>标已读</Button>
              <Select size="small" placeholder="改意图" value={null} onChange={batchIntentSel} style={{ width: 96 }} options={commentsConfig.intentOptions.map((o) => ({ value: o, label: o }))} />
              <Button size="small" onClick={batchFollowSel}>加入跟进</Button>
              <Button size="small" type="text" onClick={clearCheck}>取消选择</Button>
            </>
          )}
          <Button size="small" onClick={checkAll}>{checked.size === items.length && items.length > 0 ? '取消全选' : '全选'}</Button>
          <Button size="small" onClick={batchRead}>未读批量已读</Button>
          <Button size="small" onClick={exportComments}>导出CSV</Button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {hot.map((k) => <Button key={k} size="small" onClick={() => { setKw(k); load({ k }); }}>{k}</Button>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0,1fr) 340px', gap: 0, border: '1px solid #E8E6E1', borderRadius: 6, background: '#fff', minHeight: 'calc(100vh - 300px)' }}>
          <div style={{ borderRight: '1px solid #E8E6E1', overflow: 'auto' }}>
            <div onClick={() => { setSelVideo(''); load({ v: '' }); }} style={{ padding: '12px 14px', borderBottom: '1px solid #F0EEEA', cursor: 'pointer', background: selVideo === '' ? '#F5F4F1' : 'transparent', fontWeight: selVideo === '' ? 600 : 400 }}>
              全部视频 <span className="num" style={{ fontSize: 12, color: '#A8A5A0' }}>{totalUnread}未读</span>
            </div>
            {videos.map((v) => (
              <div key={v.id} onClick={() => { setSelVideo(v.id); load({ v: v.id }); }} style={{ padding: '12px 14px', borderBottom: '1px solid #F0EEEA', cursor: 'pointer', background: selVideo === v.id ? '#F5F4F1' : 'transparent' }}>
                <div style={{ fontSize: 13, fontWeight: selVideo === v.id ? 600 : 400 }}>{v.title}{counts[v.id] ? <span style={{ display: 'inline-block', minWidth: 18, textAlign: 'center', background: '#1A1A18', color: '#fff', fontSize: 11, borderRadius: 10, padding: '0 5px', marginLeft: 6 }} className="num">{counts[v.id]}</span> : null}</div>
                <div className="num" style={{ fontSize: 12, color: '#A8A5A0' }}>{v.publish_time}</div>
              </div>
            ))}
          </div>
          <div style={{ borderRight: '1px solid #E8E6E1', overflow: 'auto' }}>
            {items.length === 0 ? <div style={{ padding: 24, color: '#A8A5A0' }}>暂无数据</div> : items.map((c) => (
              <div key={c.id} onClick={() => setSelId(c.id)} style={{ padding: '10px 14px 10px 16px', borderBottom: '1px solid #F0EEEA', cursor: 'pointer', background: selId === c.id ? '#F5F4F1' : 'transparent', borderLeft: `2px solid ${colorOf(c.intent)}` }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Checkbox checked={checked.has(c.id)} onClick={(e: React.MouseEvent) => e.stopPropagation()} onChange={() => toggleCheck(c.id)} style={{ marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#A8A5A0' }}><b style={{ color: '#1A1A18' }}>{c.user_nick}</b> · {c.create_time} · {c.intent} · {c.is_read_local ? '已读' : '未读'}{c.ignore ? ' ·已忽略' : ''}</div>
                    <div>{c.content}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, overflow: 'auto', background: '#FCFBF9' }}>
            {!sel ? <div style={{ fontSize: 12, color: '#A8A5A0' }}>点击一条评论查看详情（j/k 移动，e 标已读，1/2/3 改意图，c 复制）。</div> : (
              <div>
                <b>{sel.user_nick}</b>
                <div className="num" style={{ fontSize: 12, color: '#A8A5A0' }}>{sel.create_time} · 赞{sel.like_count}</div>
                <div className="card" style={{ padding: 12, margin: '10px 0' }}>{sel.content}</div>
                <div style={{ fontSize: 12, color: '#6B6862' }}>意图</div>
                <Select size="small" value={sel.intent} onChange={(v) => setIntentOf(sel.id, v)} style={{ width: '100%', marginTop: 4 }} options={commentsConfig.intentOptions.map((o) => ({ value: o, label: o }))} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {!sel.is_read_local && <Button size="small" onClick={() => markRead(sel.id)}>标已读(e)</Button>}
                  <Button size="small" onClick={() => copy(sel.content)}>复制(c)</Button>
                  <Button size="small" onClick={() => toggleIgnore(sel)}>{sel.ignore ? '取消忽略' : '忽略'}</Button>
                </div>
                <div style={{ fontSize: 12, color: '#6B6862', marginTop: 14 }}>快捷话术 · 按意图生成</div>
                <Input size="small" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="产品名，用于填充话术" style={{ marginTop: 6 }} />
                {scripts.map((s: ScriptItem | TemplateItem) => <div key={s.id} style={{ border: '1px solid #E8E6E1', background: '#fff', borderRadius: 4, padding: '8px 10px', marginTop: 8, fontSize: 13 }}>{s.content}<div><Button size="small" type="text" style={{ marginTop: 6, paddingInline: 0 }} onClick={() => copy(s.content)}>复制</Button></div></div>)}
                <Button type="primary" size="small" block style={{ marginTop: 12 }} onClick={() => replied(sel)}>已去App回复，登记跟进</Button>
                <div style={{ fontSize: 12, color: '#6B6862', marginTop: 14 }}>作者回评（记账，可多条）</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <Button size="small" onClick={genDrafts} loading={genBusy}>智能生成回复</Button>
                  <Select size="small" value={tone} onChange={setTone} style={{ width: 84 }} options={[{ value: '亲切', label: '亲切' }, { value: '专业', label: '专业' }, { value: '简洁', label: '简洁' }]} />
                </div>
                {drafts.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {drafts.map((d) => (
                      <div key={d.id} style={{ border: '1px solid #E8E6E1', background: '#fff', borderRadius: 4, padding: '8px 10px', fontSize: 13 }}>
                        <div style={{ fontSize: 11, color: '#A8A5A0', marginBottom: 4 }}>{d.label}</div>
                        {d.content}
                        <div><Button size="small" type="text" style={{ marginTop: 6, paddingInline: 0 }} onClick={() => { setReplyText(d.content); setDrafts([]); }}>用这条</Button></div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <Input size="small" value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="写下你的回评…" onPressEnter={sendReply} />
                  <Button size="small" type="primary" onClick={sendReply}>发送</Button>
                </div>
                {replies.map((r) => <div key={r.id} style={{ border: '1px solid #E8E6E1', background: '#fff', borderRadius: 4, padding: '8px 10px', marginTop: 8, fontSize: 13 }}>{r.content}<div className="num" style={{ fontSize: 11, color: '#A8A5A0', marginTop: 4 }}>{r.at}</div></div>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
