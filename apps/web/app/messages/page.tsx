'use client';
import { useEffect, useState } from 'react';
import { App, Button, Checkbox, Drawer, Input, Popconfirm, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { assistConfig } from '@/config/assist.config';
import { tasksConfig } from '@/config/tasks.config';
import { mockScripts } from '@/lib/mock';
import { downloadCsv } from '@/lib/csv';
import { hasFeature, type ProFeature } from '@/lib/tiers';
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
  const [ftag, setFtag] = useState('');
  const [tagLib, setTagLib] = useState<string[]>([]);
  const [tagEdit, setTagEdit] = useState<{ id: string; tags: string[] } | null>(null);
  const [newTag, setNewTag] = useState('');
  /** S49 线索档案抽屉 */
  const [detail, setDetail] = useState<Follow | null>(null);
  const [noteText, setNoteText] = useState('');
  /** S54 分版本能力（null=按可用渲染防闪） */
  const [feats, setFeats] = useState<string[] | null>(null);
  const can = (k: ProFeature) => feats === null || hasFeature(feats, k);
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
  const openDetail = (f: Follow) => { setDetail(f); setNoteText(f.note || ''); };
  const saveNote = async () => {
    if (!detail) return;
    const r = await fetch(`/api/follows/${detail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: noteText }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { flash(r?.message || '纪要保存失败'); return; }
    setDetail(r as Follow); flash('纪要已保存', true); loadFollows();
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
    { title: '对方', dataIndex: 'peer_nick', key: 'nick', render: (v: string, f) => (can('lead') ? <a onClick={() => openDetail(f)}>{v}</a> : <span>{v}</span>) },
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
                <Button key={c} size="small" type={sCat === c ? 'primary' : 'default'} onClick={() => setSCat(c)}>{c}</Button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Select size="small" value={scatNew} onChange={setScatNew} style={{ width: 90 }} options={['自定义', '欢迎语', '报价', '留资引导'].map((c) => ({ value: c, label: c }))} />
              <Input size="small" value={stitle} onChange={(e) => setStitle(e.target.value)} placeholder="标题" style={{ width: 90 }} />
              <Input size="small" value={scontent} onChange={(e) => setScontent(e.target.value)} placeholder="话术内容" onPressEnter={addScript} />
              <Button size="small" type="primary" onClick={addScript}>添加</Button>
            </div>
            {(() => {
              const filtered = scripts.filter((s) => (sCat === '全部' || s.category === sCat) && (!sQw.trim() || s.title.includes(sQw.trim()) || s.content.includes(sQw.trim())));
              if (filtered.length === 0) return <div style={{ fontSize: 12, color: '#A8A5A0', marginTop: 12 }}>无匹配话术，换个分类或搜索词试试</div>;
              return filtered.map((s) => (
                <div key={s.id} style={{ border: '1px solid #E8E6E1', borderRadius: 4, padding: '10px 12px', marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#A8A5A0', marginBottom: 4 }}><Tag style={{ marginInlineEnd: 6 }}>{s.category}</Tag>{s.title}</div>
                  {s.content}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <Button size="small" type="text" style={{ paddingInline: 0 }} onClick={() => copyText(s.content)}>复制</Button>
                    {!['s1', 's2', 's3'].includes(s.id) && <Button size="small" type="text" danger onClick={() => delScript(s.id)}>删除</Button>}
                  </div>
                </div>
              ));
            })()}
          </div>
          <div className="card" style={{ padding: 16, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <b>手动跟进台账</b>
              <span style={{ flex: 1 }} />
              <Select size="small" value={fstatus} onChange={(v) => { setFstatus(v); loadFollows(v); }} style={{ width: 110 }} options={[{ value: '', label: '全部状态' }, ...assistConfig.followStatuses.map((s) => ({ value: s, label: s }))]} />
              <Select size="small" value={ftag || undefined} onChange={(v) => setFtag(v || '')} style={{ width: 110 }} placeholder="按标签" allowClear options={tagLib.map((t) => ({ value: t, label: t }))} />
            </div>
            <div className="num" style={{ fontSize: 12, color: '#6B6862', marginTop: 4 }}>每批{tasksConfig.followBatchSize}个 · 每{tasksConfig.groupFollowIntervalMin}分钟一批 · 默认{assistConfig.defaultRemindHour}:00提醒（纯展示，不自动发送）</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Input size="small" value={fpeer} onChange={(e) => setFpeer(e.target.value)} placeholder="对方昵称" style={{ width: 130 }} onPressEnter={addFollow} />
              <Select size="small" value={fsource} onChange={setFsource} style={{ minWidth: 200 }} options={videos.map((v) => ({ value: v.id, label: v.title }))} />
              <Button size="small" type="primary" onClick={addFollow}>加入跟进</Button>
              <Input size="small" value={fsearch} onChange={(e) => setFsearch(e.target.value)} placeholder="搜对方昵称" style={{ width: 120 }} allowClear />
              <Button size="small" onClick={exportFollows}>导出CSV</Button>
            </div>
            <Table<Follow> size="small" pagination={false} style={{ marginTop: 8 }} columns={followCols} dataSource={(rows || []).filter((f) => (!fsearch.trim() || f.peer_nick.includes(fsearch.trim())) && (!ftag || (f.tags || []).includes(ftag)))} rowKey="id" loading={rows === null} locale={{ emptyText: '暂无跟进' }} />
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
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, margin: '16px 0 8px' }}>跟进纪要</div>
              <Input.TextArea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} maxLength={500} placeholder="记录客户需求、报价、约跟进时间…" />
              <Button size="small" type="primary" style={{ marginTop: 8 }} onClick={saveNote}>保存纪要</Button>
              <div style={{ fontSize: 13, fontWeight: 600, margin: '18px 0 8px' }}>操作历史（最近{detail.history?.length || 0}条）</div>
              {!detail.history?.length && <div style={{ fontSize: 12, color: '#A8A5A0' }}>暂无记录，改状态/记账/打标会自动留痕</div>}
              {(detail.history || []).slice(0, 20).map((h, i) => (
                <div key={i} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #F0EEEA' }}>
                  <span className="num" style={{ color: '#A8A5A0', marginRight: 8 }}>{new Date(h.at).toLocaleString('zh-CN', { hour12: false })}</span>
                  {h.act}
                </div>
              ))}
            </div>
          )}
        </Drawer>
      </div>
    </div>
  );
}
