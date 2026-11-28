/**
 * 官网首页（根路径）：ICP备案可访问的公开介绍页
 * 备案号走运行时 env ICP_NUMBER，备案通过后改 .env.local 重启即可，无需重新构建
 */
export const dynamic = 'force-dynamic';

const STEPS = [
  { n: '01', t: 'CSV 导入', d: '把自有客户的公开互动记录整理成表格导入系统' },
  { n: '02', t: '意图分类', d: '按咨询内容自动归类，识别有明确意向的客户' },
  { n: '03', t: '话术草稿', d: '生成拟人化回复草稿，由人工审阅修改' },
  { n: '04', t: '人工发送', d: '确认后的内容由账号所有者自行发送，系统不代发' },
  { n: '05', t: '台账跟进', d: '跟进记录留痕，形成可复查的经营台账' },
];

const LINES = [
  '只使用平台官方开放接口，不采集第三方隐私数据',
  '不自动外呼、不批量主动私信，发送行为始终由人工掌握',
  '业务数据保存在使用者本机，不上传第三方服务器',
];

export default function Home() {
  const icp = (process.env.ICP_NUMBER || '').trim();

  return (
    <main style={{ minHeight: '100vh', background: '#F7F8FA', color: '#1F2329', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '56px 24px 32px' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2E5BFF', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>萌</div>
            <div>
              <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: 0.5 }}>萌络电竞运营助手</div>
              <div style={{ fontSize: 12, color: '#646A73', marginTop: 2 }}>抖音账号经营管理工具 · 获客中台</div>
            </div>
          </div>
          <a href="/auth" style={{ display: 'inline-block', background: '#2E5BFF', color: '#fff', textDecoration: 'none', padding: '10px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>进入工作台 →</a>
        </header>

        <section style={{ background: '#fff', border: '1px solid #E5E6EB', borderRadius: 14, padding: '36px 36px 30px', marginTop: 28 }}>
          <div style={{ fontSize: 13, color: '#2E5BFF', fontWeight: 600, marginBottom: 12 }}>关于我们</div>
          <h1 style={{ fontSize: 27, lineHeight: 1.45, margin: '0 0 18px', fontWeight: 700 }}>
            让账号经营更清晰，让每一次跟进有据可查
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.9, color: '#4E5359', margin: 0 }}>
            萌络电竞运营助手由昆明萌络互联网游戏工作室自研，用于自有抖音账号的日常经营管理。经账号所有者主动扫码授权后，通过开放接口获取公开作品与评论数据，用于经营统计、意向客户识别与客服跟进。不采集第三方隐私，不进行批量自动营销，发送行为由人工掌握。
          </p>
          <div style={{ marginTop: 24, paddingTop: 22, borderTop: '1px solid #E5E6EB', fontSize: 13, color: '#646A73' }}>
            开发者主体：昆明萌络互联网游戏工作室（个体工商户）
          </div>
        </section>

        <section style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 16px', fontWeight: 700 }}>工作流</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ background: '#fff', border: '1px solid #E5E6EB', borderRadius: 10, padding: '18px 18px 16px' }}>
                <div style={{ fontSize: 12, color: '#2E5BFF', fontWeight: 700, letterSpacing: 1 }}>{s.n}</div>
                <div style={{ fontSize: 15, fontWeight: 600, margin: '8px 0 6px' }}>{s.t}</div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: '#646A73' }}>{s.d}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #E5E6EB', borderRadius: 12, padding: '22px 24px', marginTop: 30 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 14px', fontWeight: 700 }}>合规说明</h2>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 2.1, color: '#4E5359' }}>
            {LINES.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </section>

        <footer style={{ marginTop: 36, padding: '22px 4px 8px', borderTop: '1px solid #E5E6EB', fontSize: 12, color: '#8A9099', textAlign: 'center', lineHeight: 1.9 }}>
          <div>© {new Date().getFullYear()} 昆明萌络互联网游戏工作室</div>
          <div>
            {icp ? (
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" style={{ color: '#646A73', textDecoration: 'none' }}>{icp}</a>
            ) : (
              <span>ICP 备案办理中</span>
            )}
            {' · '}
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" style={{ color: '#646A73', textDecoration: 'none' }}>工信部备案查询</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
