'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * S90 全局命令面板（Ctrl+K）：导航 / 全局搜索 / 快捷动作
 * 键盘底座：↑↓选择 Enter执行 Esc关闭；数据打开时拉取（60s缓存），不常驻轮询
 * 合规：只是既有页面与既有API的快捷方式，不新增任何触达能力；访问密码锁定时禁用（enabled=false）
 */
interface Item { group: string; label: string; hint: string; run: () => void }

export function CommandPalette({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState('');
  const [cache, setCache] = useState<{ at: number; follows: { id: string; peer_nick: string; status: string }[]; scripts: { id: string; title: string; content: string }[]; autoReply: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const inpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        if (!enabled) return;
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [enabled]);

  const load = () => {
    if (cache && Date.now() - cache.at < 60000) return;
    setLoading(true);
    Promise.all([
      fetch('/api/follows').then((r) => r.json()).catch(() => ({ items: [] })),
      fetch('/api/scripts').then((r) => r.json()).catch(() => ({ items: [] })),
      fetch('/api/settings').then((r) => r.json()).catch(() => ({})),
    ]).then(([f, s, st]) => {
      setCache({ at: Date.now(), follows: f.items || [], scripts: s.items || [], autoReply: !!st.auto_reply_enabled });
      setLoading(false);
    });
  };
  useEffect(() => { if (open) { setQ(''); setIdx(0); setStatus(''); load(); setTimeout(() => inpRef.current?.focus(), 30); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (p: string) => { setOpen(false); window.location.href = p; };

  const items = useMemo<Item[]>(() => {
    const kw = q.trim().toLowerCase();
    const nav: Item[] = [
      { group: '导航', label: '数据看板', hint: '导入·作品·竞品', run: () => go('/dashboard') },
      { group: '导航', label: '评论工作台', hint: 'j/k 快速流转', run: () => go('/comments') },
      { group: '导航', label: '任务中心', hint: '自动化参数·执行日志', run: () => go('/tasks') },
      { group: '导航', label: '经营报告', hint: '日报/周报', run: () => go('/report') },
      { group: '导航', label: '智能营销', hint: '客群·雷达·A/B·活动', run: () => go('/marketing') },
      { group: '导航', label: '私信辅助 · 看板视图', hint: '拖拽卡改状态', run: () => go('/messages?view=board') },
      { group: '导航', label: '私信辅助 · 日历视图', hint: '本周提醒排布', run: () => go('/messages?view=cal') },
      { group: '导航', label: '系统设置', hint: '备份·密码·诊断', run: () => go('/settings') },
      { group: '导航', label: '使用指南', hint: 'FAQ', run: () => go('/guide') },
    ];
    const acts: Item[] = [
      { group: '动作', label: '导入我的数据', hint: '打开导入向导', run: () => go('/dashboard?import=1') },
      {
        group: '动作', label: `评论自动回复：${cache?.autoReply ? '关' : '开'}（点击切换）`, hint: '三重门内生效',
        run: async () => {
          const nv = !(cache?.autoReply ?? false);
          const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auto_reply_enabled: nv }) }).then((x) => x.json()).catch(() => null);
          if (r && !r.code) { setCache((c) => (c ? { ...c, autoReply: nv } : c)); setStatus(nv ? '自动回复已开（未过三重门时仅起草）' : '自动回复已关'); } else setStatus(r?.message || '切换失败');
        },
      },
      { group: '动作', label: '导出诊断包', hint: '报障给服务商', run: () => { setOpen(false); window.location.href = '/api/diag/bundle'; } },
      { group: '动作', label: '下载备份', hint: '普通JSON快照', run: () => { setOpen(false); window.location.href = '/api/data/backup'; } },
    ];
    let list = [...nav, ...acts];
    if (kw) {
      const inTitle = list.filter((x) => x.label.toLowerCase().includes(kw) || x.hint.toLowerCase().includes(kw));
      const hits: Item[] = [];
      if (cache) {
        const hitNicks = new Set();
        for (const f of cache.follows) if (f.peer_nick.toLowerCase().includes(kw) && !hitNicks.has(f.peer_nick)) { hitNicks.add(f.peer_nick); hits.push({ group: '台账', label: f.peer_nick, hint: `跟进状态：${f.status} · 打开台账`, run: () => go('/messages?peer=' + encodeURIComponent(f.peer_nick)) }); }
        for (const s of cache.scripts) if ((s.title + s.content).toLowerCase().includes(kw)) hits.push({ group: '话术', label: s.title || s.content.slice(0, 14), hint: '话术库命中 · 打开私信辅助', run: () => go('/messages') });
      }
      const cmt: Item = { group: '搜索', label: `在评论里搜「${q.trim()}」`, hint: '跳评论工作台', run: () => go('/comments?kw=' + encodeURIComponent(q.trim())) };
      list = [...inTitle, ...hits.slice(0, 8), cmt];
    }
    return list.slice(0, 24);
  }, [q, cache]);

  useEffect(() => { setIdx(0); }, [q]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { const it = items[idx]; if (it) it.run(); }
  };

  if (!open) return null;
  let lastGroup = '';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(26,26,24,0.28)' }} onMouseDown={() => setOpen(false)}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 560, margin: '12vh auto 0', background: '#FCFBF9', border: '1px solid #E8E6E1', borderRadius: 8, boxShadow: '0 18px 48px rgba(26,26,24,0.22)', overflow: 'hidden' }}>
        <input
          ref={inpRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          placeholder={loading ? '加载中…' : '输入指令或搜索：页面 / 台账昵称 / 话术 / 动作（↑↓ Enter，Esc 关闭）'}
          style={{ width: '100%', border: 0, borderBottom: '1px solid #E8E6E1', background: 'transparent', padding: '14px 16px', fontSize: 14, outline: 'none', color: '#1A1A18', boxSizing: 'border-box' }}
        />
        <div style={{ maxHeight: '46vh', overflowY: 'auto', padding: '6px 0' }}>
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : '';
            lastGroup = it.group;
            return (
              <div key={it.group + it.label + i}>
                {head && <div style={{ fontSize: 11, color: '#A8A5A0', padding: '6px 16px 2px' }}>{head}</div>}
                <div
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => it.run()}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: 'pointer', background: i === idx ? '#F0EEE9' : 'transparent' }}
                >
                  <span style={{ fontSize: 13, flex: 1, color: '#1A1A18' }}>{it.label}</span>
                  <span style={{ fontSize: 11, color: '#A8A5A0' }}>{it.hint}</span>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <div style={{ padding: '18px 16px', fontSize: 13, color: '#A8A5A0' }}>没有匹配项</div>}
        </div>
        {status && <div style={{ borderTop: '1px solid #E8E6E1', padding: '8px 16px', fontSize: 12, color: '#1677FF' }}>{status}</div>}
      </div>
    </div>
  );
}
