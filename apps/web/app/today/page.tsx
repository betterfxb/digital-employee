'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isDue, daysUntilExpiry, todayKey } from '@/lib/remind';
import { visitDue } from '@/lib/visitDue'; // S129
import { assistConfig } from '@/config/assist.config';

/**
 * S120 今日工作台：每天打开系统的第一眼——把「今天该干的活」聚合成一张清单。
 * 纯客户端聚合已有端点（S29铁律：接口没有的数据不展示，零新增写端点）。
 * 基础版全可用——这是操作清单，不是洞察分析（区别于专业版机会雷达）。
 */
type CommentLite = { id: string; user_nick: string; intent: string; is_read_local: boolean };
type FollowLite = { id: string; peer_nick: string; status: string; next_remind_at: string; amount?: number; created_at?: string; history?: { at: string }[] };
type LicLite = { mode?: string; valid?: boolean; expires_at?: string | null; features?: string[] };

const DAY = 86_400_000;

export default function Today() {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentLite[]>([]);
  const [follows, setFollows] = useState<FollowLite[]>([]);
  const [drafts, setDrafts] = useState(0);
  const [lic, setLic] = useState<LicLite | null>(null);
  const [lastImport, setLastImport] = useState<string | null>(null); // S125

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/comments?unread_only=0').then((r) => r.json()).catch(() => ({ items: [] })),
      fetch('/api/follows').then((r) => r.json()).catch(() => ({ items: [] })),
      fetch('/api/drafts?status=pending').then((r) => r.json()).catch(() => ({ items: [] })),
      fetch('/api/license/status').then((r) => r.json()).catch(() => null),
      fetch('/api/stats/overview').then((r) => r.json()).catch(() => null),
    ]).then(([c, f, d, l, ov]) => {
      setComments(c.items || []);
      setFollows(f.items || []);
      setDrafts((d.items || []).length);
      setLic(l);
      setLastImport(typeof ov?.last_import_at === 'string' ? ov.last_import_at : null);
      setLoading(false);
    });
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayKey();
  const isActive = (x: FollowLite) => x.status !== '无效';
  const unreadHigh = comments.filter((c) => !c.is_read_local && ['高意向', '留电话'].includes(c.intent));
  const overdue = follows.filter((x) => isActive(x) && ['待回访', '已手动回复'].includes(x.status) && isDue(x.next_remind_at));
  // 今天内排了提醒但还没到点：只认「今天 HH:mm」写法（绝对日期口径不可信，S29）
  const dueToday = follows.filter((x) => isActive(x) && x.status !== '已转化' && !isDue(x.next_remind_at) && /^今天\s*\d{1,2}:\d{2}/.test(x.next_remind_at || ''));
  const unregistered = comments.filter((c) => ['高意向', '留电话'].includes(c.intent) && c.is_read_local && !follows.some((f) => f.peer_nick === c.user_nick && isActive(f)));
  const revisitDue = follows.filter((x) => visitDue(x, assistConfig.revisitDays)); // S129 已转化超期无接触
  const dealToday = follows.filter((x) => x.status === '已转化' && x.created_at && x.created_at.slice(0, 10) === today);
  const amountToday = dealToday.reduce((s, x) => s + (x.amount || 0), 0);
  const licDays = lic && lic.valid && lic.mode === 'licensed' ? daysUntilExpiry(lic.expires_at) : null;

  const week = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  const TASKS: { key: string; title: string; n: number; sub: string; href: string; urgent: boolean; cta: string }[] = [
    { key: 'unread', title: '未读的高意向评论', n: unreadHigh.length, sub: '别人在问价，先回他们', href: '/comments?unread=1', urgent: unreadHigh.length > 0, cta: '去处理评论' },
    { key: 'overdue', title: '到期该跟进的客户', n: overdue.length, sub: '台账里提醒时间已到', href: '/messages', urgent: overdue.length > 0, cta: '打开台账' },
    { key: 'today', title: '今天内排了提醒的', n: dueToday.length, sub: '还没到点，但今天别忘', href: '/messages', urgent: false, cta: '查看台账' },
    { key: 'drafts', title: '草稿待你确认', n: drafts, sub: '复制话术去抖音发送', href: '/tasks', urgent: drafts > 0, cta: '去任务中心' },
    { key: 'unreg', title: '看过但没登记的高意向', n: unregistered.length, sub: '读过了没建档，容易漏', href: '/comments?intent=' + encodeURIComponent('高意向'), urgent: unregistered.length > 0, cta: '去补登记' },
    { key: 'revisit', title: '老客户该回访了', n: revisitDue.length, sub: `成交后超${assistConfig.revisitDays}天没接触，复购是零成本收入`, href: '/messages?revisit=1', urgent: false, cta: '去回访' },
  ];

  return (
    <div style={{ maxWidth: 1680, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontWeight: 600 }}>今日工作台</h2>
        <span style={{ color: '#8A8781', fontSize: 13 }}>{week}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#A8A5A0' }} onClick={load} onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#1A1A18')} onMouseLeave={(e) => ((e.target as HTMLElement).style.color = '#A8A5A0')}><a style={{ cursor: 'pointer' }}>↻ 刷新数字</a></span>
      </div>

      {loading ? (
        <div style={{ color: '#A8A5A0', padding: '40px 0', textAlign: 'center' }}>正在汇总今天的任务…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {TASKS.map((t) => (
            <div key={t.key} style={{ border: `1px solid ${t.urgent ? '#E3C9A6' : '#E5E2DC'}`, background: t.urgent ? '#FDF8F0' : '#fff', borderRadius: 8, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="num" style={{ fontSize: 30, fontWeight: 700, color: t.n > 0 ? (t.urgent ? '#9A6B2F' : '#1A1A18') : '#C8C5BE', minWidth: 46, textAlign: 'center' }}>{t.n}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: '#8A8781', marginTop: 2 }}>{t.sub}</div>
              </div>
              <a href={t.href} style={{ fontSize: 12, color: t.n > 0 ? '#1A1A18' : '#A8A5A0', border: '1px solid #D8D5CF', borderRadius: 4, padding: '4px 10px', whiteSpace: 'nowrap' }}>{t.cta}</a>
            </div>
          ))}

          {/* 战果与账户状态两卡（非任务，置底） */}
          <div style={{ border: '1px solid #E5E2DC', background: '#fff', borderRadius: 8, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="num" style={{ fontSize: 30, fontWeight: 700, color: dealToday.length > 0 ? '#1F4D3A' : '#C8C5BE', minWidth: 46, textAlign: 'center' }}>{dealToday.length}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>今日成交（按登记日）</div>
              <div style={{ fontSize: 12, color: '#8A8781', marginTop: 2 }}>{amountToday > 0 ? `合计 ¥${amountToday}` : '成交时在台账点「已转化」即计入'}</div>
            </div>
            <a href="/messages" style={{ fontSize: 12, color: '#A8A5A0', border: '1px solid #D8D5CF', borderRadius: 4, padding: '4px 10px', whiteSpace: 'nowrap' }}>台账</a>
          </div>
          {/* S125 数据新鲜度：本机导入事件（非平台字段，S29合规）；久不喂数据=系统吃灰的前兆 */}
          {(() => {
            const days = lastImport ? Math.floor((Date.now() - Date.parse(lastImport)) / DAY) : null;
            const level = days === null ? 'none' : days >= 7 ? 'bad' : days >= 3 ? 'warn' : 'ok';
            const ui = {
              none: { bd: '#E3C9A6', bg: '#FDF8F0', num: '—', nc: '#9A6B2F', t: '还没导入过数据', s: '示例数据不算——导入你的第一批才开始真实经营', urgent: true },
              bad: { bd: '#E3B9B4', bg: '#FBF1F0', num: `${days}天`, nc: '#B42318', t: '数据停留太久', s: '超过7天没导入，评论台里看到的都是旧世界', urgent: true },
              warn: { bd: '#E3C9A6', bg: '#FDF8F0', num: `${days}天`, nc: '#9A6B2F', t: '数据可以更新了', s: '去创作者中心导出最新作品/评论，拖进来只要一分钟', urgent: false },
              ok: { bd: '#E5E2DC', bg: '#fff', num: `${days === 0 ? '今天' : days + '天'}`, nc: '#1F4D3A', t: '数据新鲜', s: '最近一次导入很及时，保持节奏', urgent: false },
            }[level];
            return (
              <div style={{ border: `1px solid ${ui.bd}`, background: ui.bg, borderRadius: 8, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="num" style={{ fontSize: 22, fontWeight: 700, color: ui.nc, minWidth: 46, textAlign: 'center' }}>{ui.num}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ui.t}</div>
                  <div style={{ fontSize: 12, color: '#8A8781', marginTop: 2 }}>{ui.s}</div>
                </div>
                <a href="/dashboard?import=1" style={{ fontSize: 12, color: ui.urgent ? '#1A1A18' : '#A8A5A0', border: '1px solid #D8D5CF', borderRadius: 4, padding: '4px 10px', whiteSpace: 'nowrap' }}>去导入</a>
              </div>
            );
          })()}
          <div style={{ border: `1px solid ${lic && !lic.valid ? '#E3B9B4' : licDays !== null && licDays <= 7 ? '#E3B9B4' : '#E5E2DC'}`, background: (lic && !lic.valid) || (licDays !== null && licDays <= 7) ? '#FBF1F0' : '#fff', borderRadius: 8, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="num" style={{ fontSize: 26, fontWeight: 700, color: !lic || !lic.valid ? '#B42318' : licDays === null ? '#1F4D3A' : licDays <= 7 ? '#B42318' : '#1F4D3A', minWidth: 46, textAlign: 'center' }}>{!lic ? '?' : !lic.valid ? '!' : licDays === null ? '∞' : `${licDays}天`}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>授权状态</div>
              <div style={{ fontSize: 12, color: '#8A8781', marginTop: 2 }}>
                {!lic ? '状态读取失败，稍后自动重试' : !lic.valid ? '未激活或已失效，部分功能受限' : lic.mode === 'demo' ? '演示版（数据可随时清空重来）' : licDays === null ? '正式授权 · 不过期' : licDays < 0 ? '已过期，请联系服务商续期' : `到期日 ${String(lic.expires_at || '').slice(0, 10)}`}
              </div>
            </div>
            <a href="/auth" style={{ fontSize: 12, color: '#A8A5A0', border: '1px solid #D8D5CF', borderRadius: 4, padding: '4px 10px', whiteSpace: 'nowrap' }}>授权</a>
          </div>
        </div>
      )}

      {!loading && TASKS.every((t) => t.n === 0) && (
        <div style={{ marginTop: 20, border: '1px dashed #C8D8CC', background: '#F5FAF6', borderRadius: 8, padding: '18px 22px', color: '#1F4D3A' }}>
          <div style={{ fontWeight: 600 }}>今天没有欠账 👍</div>
          <div style={{ fontSize: 12, marginTop: 4, color: '#4C6B57' }}>有空可以去「智能营销」看看选题建议，或到「数据看板」补一次最新导出数据。</div>
        </div>
      )}
    </div>
  );
}
