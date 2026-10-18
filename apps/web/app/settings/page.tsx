'use client';
import { useEffect, useRef, useState } from 'react';
import { App, Button, Input, Popconfirm, Slider } from 'antd';
import { settingsConfig } from '@/config/settings.config';
import { applySettings } from '@/lib/settings-client';
import { hasFeature, type ProFeature } from '@/lib/tiers';

/** S18 系统设置：店铺/服务/字体/主题/密码；调节即时预览，保存持久化并全局生效 */
export default function Settings() {
  const { message } = App.useApp();
  const [shop, setShop] = useState('');
  const [service, setService] = useState('');
  const [font, setFont] = useState<number>(settingsConfig.fontSizeDefault);
  const [theme, setTheme] = useState<string>(settingsConfig.themeDefault);
  const [pwdAt, setPwdAt] = useState<string | null>(null);
  const [npw, setNpw] = useState('');
  const [cpw, setCpw] = useState('');
  const [prices, setPrices] = useState<{ tier: string; price: string }[]>([]);
  const [feats, setFeats] = useState<string[] | null>(null);

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((s) => {
      setShop(s.shop_name || ''); setService(s.service_name || '');
      setFont(s.font_size || settingsConfig.fontSizeDefault);
      setTheme(s.theme_color || settingsConfig.themeDefault);
      setPwdAt(s.password_changed_at || null);
      if (Array.isArray(s.price_list)) setPrices(s.price_list);
    }).catch(() => message.error('设置加载失败，请刷新重试'));
    fetch('/api/license/status').then((r) => r.json()).then((d) => setFeats(Array.isArray(d.features) ? d.features : [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 调节即时预览（不落库），保存后持久化
  const previewFont = (n: number) => { setFont(n); applySettings({ font_size: n, theme_color: theme }); };
  const previewTheme = (v: string) => { setTheme(v); applySettings({ font_size: font, theme_color: v }); };

  const save = async () => {
    const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop_name: shop.trim(), service_name: service.trim(), font_size: font, theme_color: theme }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '保存失败，请重试'); return; }
    applySettings({ font_size: r.font_size, theme_color: r.theme_color });
    message.success(`已保存${r.shop_name ? `，店铺：${r.shop_name}` : ''}`);
  };

  const changePwd = async () => {
    if (npw !== cpw) { message.error('两次输入不一致'); return; }
    const r = await fetch('/api/settings/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_password: npw }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '修改失败，请重试'); return; }
    setNpw(''); setCpw(''); setPwdAt(r.changed_at); message.success('密码已修改');
  };

  // ── S37/S38 数据管理 ──
  const restoreRef = useRef<HTMLInputElement>(null);
  const doRestore = async (f?: File) => {
    if (!f) return;
    const text = await f.text().catch(() => '');
    let data: unknown;
    try { data = JSON.parse(text); } catch { message.error('不是合法JSON备份文件'); return; }
    const r = await fetch('/api/data/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '恢复失败'); return; }
    message.success('恢复成功，界面即将刷新');
    setTimeout(() => window.location.reload(), 1200);
  };
  const doClear = async () => {
    const r = await fetch('/api/data/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: '清空' }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '清空失败'); return; }
    message.success('业务数据已清空（授权与设置保留）');
  };

  /** S45 价目表保存 */
  const savePrices = async () => {
    const cleaned = prices.map((r) => ({ tier: r.tier.trim(), price: r.price.trim() })).filter((r) => r.tier && r.price);
    const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price_list: cleaned }) }).then((x) => x.json()).catch(() => null);
    if (!r || r.code) { message.error(r?.message || '保存失败'); return; }
    setPrices(Array.isArray(r.price_list) ? r.price_list : cleaned);
    message.success('价目表已保存，报价话术将自动带参考价');
  };

  return (
    <div>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid #E8E6E1', display: 'flex', alignItems: 'center' }}><div><b style={{ fontSize: 15 }}>系统设置</b><div style={{ fontSize: 12, color: '#A8A5A0' }}>调节即时预览，保存后持久化全局生效</div></div><div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}><Button size="small" type="primary" onClick={save}>保存全部</Button></div></div>
      <div style={{ padding: '24px 32px', maxWidth: 1680, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div>
          <div className="card" style={{ padding: 18 }}>
            <b>店铺信息</b>
            <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>改的是当前主账号展示名（{settingsConfig.shopNameMinLen}-{settingsConfig.shopNameMaxLen}字），侧栏/授权页同步更新</div>
            <Input value={shop} onChange={(e) => setShop(e.target.value)} placeholder="店铺名称" maxLength={settingsConfig.shopNameMaxLen} />
          </div>
          <div className="card" style={{ padding: 18, marginTop: 16 }}>
            <b>服务信息</b>
            <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>用作话术{'{product}'}默认值（最多{settingsConfig.serviceNameMaxLen}字），评论页自动带入</div>
            <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="服务名称" maxLength={settingsConfig.serviceNameMaxLen} />
          </div>
          <div className="card" style={{ padding: 18, marginTop: 16 }}>
            <b>安全</b>
            <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>修改登录密码（至少{settingsConfig.passwordMinLen}位）{pwdAt ? ` · 上次修改 ${pwdAt.slice(0, 10)}` : ''}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input.Password value={npw} onChange={(e) => setNpw(e.target.value)} placeholder="新密码" maxLength={32} />
              <Input.Password value={cpw} onChange={(e) => setCpw(e.target.value)} placeholder="确认新密码" maxLength={32} onPressEnter={changePwd} />
              <Button onClick={changePwd}>修改</Button>
            </div>
          </div>
          <div className="card" style={{ padding: 18, marginTop: 16 }}>
            <b>数据管理</b>
            <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>备份=一个JSON文件（换电脑迁移+误删兜底）；清空只清业务数据（作品/评论/台账/话术），<b>授权与设置不动</b></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button href="/api/data/backup">下载备份</Button>
              <Button onClick={() => restoreRef.current?.click()}>导入备份恢复</Button>
              <Popconfirm title="清空全部业务数据？" description="作品/评论/跟进/回评/竞品/自定义话术将全部删除，不可撤销。建议先下载备份。" okText="确认清空" cancelText="取消" onConfirm={doClear}>
                <Button danger>清空业务数据</Button>
              </Popconfirm>
              <input ref={restoreRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => { doRestore(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>
          <div className="card" style={{ padding: 18, marginTop: 16 }}>
            <b>价目表{feats !== null && !hasFeature(feats, 'quote') && <span style={{ fontSize: 12, color: '#A8A5A0', fontWeight: 400, marginLeft: 8 }}>🔒专业版</span>}</b>
            {feats !== null && !hasFeature(feats, 'quote') ? (
              <div style={{ fontSize: 12, color: '#6B6862', marginTop: 8, lineHeight: 1.8 }}>
                价目表属于专业版：配好后报价话术自动带参考价。联系服务商升级授权后解锁。
              </div>
            ) : (
            <>
            <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>报价话术自动带参考价（评论页「智能生成回复」的报价候选）；不配置则话术不提价格</div>
            {prices.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <Input size="small" value={r.tier} placeholder="档位，如 王者20星内" maxLength={20} style={{ flex: 1 }}
                  onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, tier: e.target.value } : x)))} />
                <Input size="small" value={r.price} placeholder="价格，如 ¥50/星" maxLength={12} style={{ width: 130 }}
                  onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                <Button size="small" onClick={() => setPrices(prices.filter((_, j) => j !== i))}>删</Button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Button size="small" disabled={prices.length >= 30} onClick={() => setPrices([...prices, { tier: '', price: '' }])}>添加行</Button>
              <Button size="small" type="primary" onClick={savePrices}>保存价目表</Button>
            </div>
            </>
            )}
          </div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <b>显示</b>
          <div style={{ fontSize: 12, color: '#6B6862', margin: '6px 0 10px' }}>字号 {settingsConfig.fontSizeMin}-{settingsConfig.fontSizeMax}px · 主题色全局生效（含按钮与导航标识）</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>界面字号</span>
            <span className="num" style={{ fontSize: 22, fontWeight: 700 }}>{font}px · {font <= 12 ? '紧凑' : font <= 14 ? '标准' : font <= 16 ? '舒适' : font <= 18 ? '大' : '超大'}</span>
          </div>
          <Slider min={settingsConfig.fontSizeMin} max={settingsConfig.fontSizeMax} step={settingsConfig.fontSizeStep} value={font} onChange={previewFont} marks={{ 12: '12', 14: '14', 16: '16', 18: '18', 20: '20' }} tooltip={{ formatter: (v) => `${v}px` }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginTop: 14 }}>
            {settingsConfig.themePresets.map((t) => {
              const on = theme === t.value;
              const desc: Record<string, string> = { '墨黑': '默认百搭', '藏青': '沉稳商务', '墨绿': '活力亲和', '赭石': '醒目引流' };
              return (
                <button key={t.value} onClick={() => previewTheme(t.value)} style={{ border: on ? '2px solid #1A1A18' : '1px solid #E8E6E1', borderRadius: 6, padding: 10, background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ borderRadius: 4, background: '#FAFAF8', border: '1px solid #E8E6E1', overflow: 'hidden' }}>
                    <div style={{ height: 10, background: t.value }} />
                    <div style={{ padding: '8px 8px', display: 'flex', gap: 5, alignItems: 'center' }}>
                      <div style={{ width: 36, height: 14, borderRadius: 2, background: t.value }} />
                      <div style={{ flex: 1, height: 14, borderRadius: 2, background: '#E8E6E1' }} />
                    </div>
                    <div style={{ padding: '0 8px 8px', fontSize: 11, color: '#6B6862' }}>按钮 · 导航同步变色</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: on ? 700 : 400, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>{t.name}</span>{on && <span>✓</span>}</div>
                  <div style={{ fontSize: 11, color: '#A8A5A0' }}>{desc[t.name] || ''}</div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 14, border: '1px solid #E8E6E1', borderRadius: 4, padding: 14, background: '#FCFBF9' }}>
            <div style={{ fontSize: 12, color: '#A8A5A0', marginBottom: 6 }}>实时预览（随调节变化，保存后持久化）</div>
            <b>三角洲跑刀实录 · 一局爆仓</b>
            <div style={{ fontSize: 12, color: '#6B6862', marginTop: 4 }}>在的兄弟，直接发段位+想跑的图，给你安排刀手。</div>
            <div style={{ marginTop: 8 }}><span style={{ display: 'inline-block', border: '1px solid #D8D5CF', background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '6px 12px', fontSize: 12 }}>按钮跟随主题色</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
