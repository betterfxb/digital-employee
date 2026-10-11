import './globals.css';
import { appConfig } from '../config/app.config';
import { Shell } from '../components/Shell';

export const metadata = { title: `${appConfig.appName} · P0` };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
