import './globals.css';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { appConfig } from '../config/app.config';
import { getLicenseState } from '../lib/license';
import { ensureScheduler } from '../lib/scheduler';
import { AntdProvider } from '../components/AntdProvider';
import { Shell } from '../components/Shell';

export const metadata = { title: `${appConfig.appName} · P0` };

// S28 根布局挂载进程内调度器（幂等，热更新/多请求不重复挂载）
ensureScheduler();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const wm = getLicenseState().watermark;
  return (
    <html lang="zh-CN">
      <head>
        {/* S25 溯源水印：HTML源码可见（泄露取证用），配合响应头X-Vendor-Watermark */}
        <meta name="x-vendor" content={wm} />
      </head>
      <body>
        <AntdRegistry>
          <AntdProvider>
            <Shell>{children}</Shell>
          </AntdProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
