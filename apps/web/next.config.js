/** @type {import('next').NextConfig} */
// S25 溯源水印：优先license文件的watermark，其次WATERMARK_ID env→wl-<sha256前8>，与lib/license.ts同算法
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
function computeWatermark() {
  try {
    const f = path.join(__dirname, 'data', 'license.license');
    if (fs.existsSync(f)) {
      const w = JSON.parse(fs.readFileSync(f, 'utf8'))?.payload?.watermark;
      if (w) return w;
    }
  } catch (e) { /* license读取失败降级到env */ }
  if (process.env.WATERMARK_ID) {
    return `wl-${createHash('sha256').update(process.env.WATERMARK_ID).digest('hex').slice(0, 8)}`;
  }
  return 'wl-demo0000';
}
const watermark = computeWatermark();

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // S30 桌面打包时 NEXT_OUTPUT_STANDALONE=1 产出 standalone 目录；日常 next start 不受影响
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  // S79 运维：开发机内存吃紧时设 NEXT_BUILD_CPUS=2，限制编译/静态生成worker数防Static worker OOM（0xC0000409）；不设=跟随CPU
  ...(process.env.NEXT_BUILD_CPUS ? { experimental: { cpus: Math.max(1, Number(process.env.NEXT_BUILD_CPUS) || 1) } } : {}),
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'X-Vendor-Watermark', value: watermark }] },
    ];
  },
};
module.exports = nextConfig;
