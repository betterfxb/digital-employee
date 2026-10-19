'use client';
import { useCallback, useEffect, useState } from 'react';
import { App, Button, Checkbox, Input, Modal, Popconfirm, Tabs, Table, Tag } from 'antd';
import { ProLock } from '@/components/ProLock';
import { hasFeature, type ProFeature } from '@/lib/tiers';

/**
 * S83-S87 智能营销套件（专业版能力键 marketing）
 * 红线设计：系统只出主意与复盘，一切触达动作人工执行——不群发、不自动私信、不外呼
 */
interface Insight { label: string; value: string; sub: string; link: string }
interface Segment { key: string; label: string; desc: string; action: string; count: number; members: { nick: string; extra: string }[] }
interface ExpBucket { variant: number; used: number; leads: number; done: number }
interface CampaignRow {
  id: string; name: string; note?: string; keyword?: string; start_at: string; end_at: string;
  checklist: { text: string; done: boolean }[]; status: string; match_count: number; follow_new: number;
  done_in_period: number; revenue_in_period: number; progress: number;
}

export default function Marketing() {
  const { message } = App.useApp();
  const [feats, setFeats] = useState<string[] | null>(null);
  const can = (k: ProFeature) => feats === null || hasFeature(feats, k);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [segs, setSegs] = useState<Segment[] | null>(null);
  const [exp, setExp] = useState<{ buckets: ExpBucket[]; total: number; sufficient: boolean } | null>(null);
  const [camps, setCamps] = useState<CampaignRow[] | null>(null);
  const [cmOpen, setCmOpen] = useState(false);
  const [cm, setCm] = useState({ name: '', keyword: '', start_at: '', end_at: '', note: '', checklist: '' });

  const reload = useCallback(() => {
    fetch('/api/marketing/insights').then((r) => r.json()).then((d) => setInsights(d.items || [])).catch(() => setInsights([]));
    fetch('/api/marketing/segments').then((r) => r.json()).then((d) => setSegs(d.segments || [])).catch(() => setSegs([]));
    fetch('/api/marketing/experiments').then((r) => r.json()).then(setExp).catch(() => setExp(null));
    fetch('/api/campaigns').then((r) => r.json()).then((d) => setCamps(d.items || [])).catch(() => setCamps([]));
  }, []);
  useEffect(() => {
    fetch('/api/license/status').then((r) => r.json()).then((d) => setFeats(Array.isArray(d.features) ? d.features : [])).catch(() => {});
    reload();
  }, [reload]);

  const createCampaign = async () => {
    if (!cm.name.trim() || !cm.start_at || !cm.end_at) { message.error('名称与起止日期必填'); return; }
    const body = { name: cm.name.trim(), keyword: cm.keyword.trim(), start_at: cm.start_at, end_at: cm.end_at, note: cm.note.trim(), checklist: cm.checklist.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).map((text) => ({ text, done: false })) };
    const r = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '创建失败'); return; }
    message.success('活动已创建（触达动作请人工执行，这里帮你盯进度与复盘）');
    setCmOpen(false); setCm({ name: '', keyword: '', start_at: '', end_at: '', note: '', checklist: '' }); reload();
  };
  const toggleItem = async (c: CampaignRow, idx: number) => {
    const list = c.checklist.map((x, i) => (i === idx ? { ...x, done: !x.done } : x));
    const r = await fetch(`/api/campaigns/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checklist: list }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '更新失败'); return; }
    reload();
  };
  const delCamp = async (id: string) => {
    const r = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '删除失败'); return; }
    message.success('已删除'); reload();
  };

  if (feats !== null && !can('marketing')) {
    return (
      <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
        <ProLock feature="智能营销套件" desc="机会雷达 · 智能客群 · 话术A/B · 活动方案复盘" />
      </div>
    );
  }

  return (
    <div className="fade" style={{ padding: '18px 24px' }}>
      <div style={{ marginBottom: 10 }}>
        <b style={{ fontSize: 16 }}>智能营销</b>
        <span style={{ fontSize: 12, color: '#A8A5A0', marginLeft: 10 }}>机会雷达 · 智能客群 · 话术A/B · 活动方案 —— 系统出主意，触达由你亲手做（合规红线：不群发/不自动私信/不外呼）</span>
      </div>
      <Tabs
        defaultActiveKey="radar"
        items={[
          {
            key: 'radar', label: '机会雷达',
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {(insights || []).length === 0 && <div className="card" style={{ padding: 18, color: '#6B6862', gridColumn: '1 / -1' }}>暂时没有可提示的商机——导入数据、产生评论后这里会亮起来（只出真实数据，不造假）。</div>}
                {(insights || []).map((it) => (
                  <a key={it.label} href={it.link} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <div className="card" style={{ padding: 16 }}>
                      <div style={{ fontSize: 12, color: '#6B6862' }}>{it.label}</div>
                      <div className="num" style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{it.value}</div>
                      <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 4 }}>{it.sub} · 点击处理 →</div>
                    </div>
                  </a>
                ))}
              </div>
            ),
          },
          {
            key: 'segments', label: '智能客群',
            children: (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {(segs || []).map((s) => (
                  <div key={s.key} className="card" style={{ padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <b>{s.label}</b><span className="num" style={{ fontSize: 20, fontWeight: 700, color: s.count > 0 ? '#B4443C' : '#A8A5A0' }}>{s.count}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#A8A5A0', marginTop: 2 }}>{s.desc}</div>
                    <div style={{ margin: '8px 0', maxHeight: 150, overflowY: 'auto' }}>
                      {s.members.length === 0 ? <span style={{ fontSize: 12, color: '#A8A5A0' }}>当前没人命中，很好</span> : s.members.map((m) => (
                        <span key={m.nick} style={{ display: 'inline-block', border: '1px solid #E8E6E1', background: '#FCFBF9', borderRadius: 10, padding: '2px 8px', margin: '0 6px 6px 0', fontSize: 12 }}>
                          <b>{m.nick}</b> <span style={{ color: '#A8A5A0' }}>{m.extra}</span>
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: '#1677FF' }}>建议动作：{s.action}</div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'experiments', label: '话术A/B',
            children: (
              <div className="card" style={{ padding: 18, maxWidth: 720 }}>
                <b>话术候选位次转化对比</b>
                <div style={{ fontSize: 12, color: '#A8A5A0', margin: '4px 0 12px' }}>在评论工作台点「用这条」发出的回评会按候选位次记录；「进台账/已成交」按评论者昵称关联台账判定。样本 {exp?.total ?? 0} 条{exp && !exp.sufficient ? '（<20 条，不足以下结论，继续积累）' : ''}。</div>
                <Table
                  size="small" pagination={false} rowKey="variant"
                  dataSource={exp?.buckets ?? []}
                  locale={{ emptyText: '还没有带位次的回评记录——生成候选后点「用这条」发送即可积累' }}
                  columns={[
                    { title: '话术位次', dataIndex: 'variant', key: 'v', render: (v: number) => `候选${v}` },
                    { title: '使用次数', dataIndex: 'used', key: 'u' },
                    { title: '进台账', dataIndex: 'leads', key: 'l' },
                    { title: '已成交', dataIndex: 'done', key: 'd' },
                    { title: '台账率', key: 'r', render: (_: unknown, b: ExpBucket) => (b.used ? `${Math.round((b.leads / b.used) * 100)}%` : '—') },
                  ]}
                />
                {exp && exp.sufficient && exp.buckets.some((b) => b.used >= 3) && (
                  <div style={{ fontSize: 12, color: '#1677FF', marginTop: 10 }}>※ 样本够了：台账率最高的位次值得作为默认话术方向（结论仅供参考，你的客户你说了算）</div>
                )}
              </div>
            ),
          },
          {
            key: 'campaigns', label: '活动方案',
            children: (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <Button type="primary" size="small" onClick={() => setCmOpen(true)}>新建活动</Button>
                  <span style={{ fontSize: 12, color: '#A8A5A0', marginLeft: 10 }}>活动=目标+人工动作清单+期间复盘；系统不代你发任何消息</span>
                </div>
                {(camps || []).length === 0 && <div className="card" style={{ padding: 18, color: '#6B6862' }}>还没有活动。比如「三角洲新赛季冲单周」：定周期、备好动作清单（发3条新作品/热词集中回复/老客逐个问候），系统帮你盯进度和成交复盘。</div>}
                {(camps || []).map((c) => (
                  <div key={c.id} className="card" style={{ padding: 16, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b>{c.name}</b>
                      <Tag color={c.status === '进行中' ? 'blue' : c.status === '未开始' ? 'default' : ''}>{c.status}</Tag>
                      <span style={{ fontSize: 12, color: '#A8A5A0' }}>{c.start_at} ~ {c.end_at}{c.keyword ? ` · 关键词「${c.keyword}」` : ''}</span>
                      <span style={{ flex: 1 }} />
                      <Popconfirm title="删除此活动？" okText="删除" cancelText="取消" onConfirm={() => delCamp(c.id)}>
                        <Button size="small" danger type="text">删除</Button>
                      </Popconfirm>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8, margin: '10px 0' }}>
                      {[['关键词命中评论', String(c.match_count)], ['期间新增跟进', String(c.follow_new)], ['期间成交(动作记)', String(c.done_in_period)], ['成交金额', `¥${c.revenue_in_period.toLocaleString()}`]].map(([k, v]) => (
                        <div key={k} style={{ border: '1px solid #E8E6E1', borderRadius: 4, padding: '6px 10px' }}>
                          <div style={{ fontSize: 11, color: '#6B6862' }}>{k}</div><div className="num" style={{ fontWeight: 700 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {c.checklist.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, color: '#6B6862', marginBottom: 6 }}>执行清单 {c.checklist.filter((x) => x.done).length}/{c.checklist.length}（进度 {c.progress}%）</div>
                        {c.checklist.map((x, i) => (
                          <div key={i} style={{ marginBottom: 4 }}>
                            <Checkbox checked={x.done} onChange={() => toggleItem(c, i)}><span style={{ fontSize: 13, color: x.done ? '#A8A5A0' : '#1A1A18', textDecoration: x.done ? 'line-through' : 'none' }}>{x.text}</span></Checkbox>
                          </div>
                        ))}
                      </div>
                    )}
                    {c.note && <div style={{ fontSize: 12, color: '#6B6862', marginTop: 6 }}>{c.note}</div>}
                  </div>
                ))}
              </div>
            ),
          },
        ]}
      />
      <Modal title="新建营销活动" open={cmOpen} onOk={createCampaign} onCancel={() => setCmOpen(false)} okText="创建" width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input placeholder="活动名（如：新赛季冲单周）" value={cm.name} onChange={(e) => setCm({ ...cm, name: e.target.value })} maxLength={30} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Input type="date" value={cm.start_at} onChange={(e) => setCm({ ...cm, start_at: e.target.value })} style={{ flex: 1 }} />
            <span style={{ alignSelf: 'center', color: '#A8A5A0' }}>至</span>
            <Input type="date" value={cm.end_at} onChange={(e) => setCm({ ...cm, end_at: e.target.value })} style={{ flex: 1 }} />
          </div>
          <Input placeholder="关键词（复盘用：圈出评论里提到这个词的人，可留空）" value={cm.keyword} onChange={(e) => setCm({ ...cm, keyword: e.target.value })} maxLength={20} />
          <Input.TextArea rows={4} placeholder={'执行清单（一行一条，都是你人工做的事）\n例：发3条新赛季作品\n例：集中回复「价格」热词评论\n例：老客逐个问候'} value={cm.checklist} onChange={(e) => setCm({ ...cm, checklist: e.target.value })} />
          <Input placeholder="备注（可选）" value={cm.note} onChange={(e) => setCm({ ...cm, note: e.target.value })} maxLength={200} />
        </div>
      </Modal>
    </div>
  );
}
