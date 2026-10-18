'use client';
import { Button } from 'antd';

/** S54 专业版功能锁定占位（可见但锁定：让客户知道有此能力，引导升级） */
export function ProLock({ feature, desc }: { feature: string; desc?: string }) {
  return (
    <div className="card" style={{ padding: 28, textAlign: 'center', borderStyle: 'dashed' }}>
      <div style={{ fontSize: 15, fontWeight: 700 }}>🔒 {feature} · 专业版功能</div>
      <div style={{ fontSize: 12, color: '#6B6862', marginTop: 8, lineHeight: 1.8 }}>
        {desc || '此功能属于专业版，当前授权为基础版。'}
        <br />联系服务商升级授权后即可解锁（重新导入授权文件，数据不丢）。
      </div>
      <Button size="small" style={{ marginTop: 14 }} href="/">返回工作台</Button>
    </div>
  );
}
