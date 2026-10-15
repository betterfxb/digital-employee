/**
 * S30 图标生成：256×256 PNG-in-ICO（深色圆角底 + 白色播放三角），零依赖
 * 输出 resources/icon.ico（构建产物，已 gitignore）
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const S = 256;
const R = 46; // 圆角半径

function crc32(buf) {
  if (!crc32.t) {
    crc32.t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crc32.t[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crc32.t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

/** 播放三角（重心法）：顶点 (98,78) (98,178) (184,128) */
function inTriangle(x, y) {
  const [x1, y1, x2, y2, x3, y3] = [98, 78, 98, 178, 184, 128];
  const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
  const a = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / d;
  const b = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / d;
  const c = 1 - a - b;
  return a >= 0 && b >= 0 && c >= 0;
}

const px = Buffer.alloc(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const cx = Math.max(R - x, x - (S - 1 - R), 0);
    const cy = Math.max(R - y, y - (S - 1 - R), 0);
    if (cx * cx + cy * cy <= R * R) {
      const white = inTriangle(x, y);
      px[i] = white ? 252 : 26; px[i + 1] = white ? 252 : 26; px[i + 2] = white ? 250 : 24; px[i + 3] = 255;
    }
  }
}

const stride = S * 4 + 1;
const raw = Buffer.alloc(S * stride);
for (let y = 0; y < S; y++) { raw[y * stride] = 0; px.copy(raw, y * stride + 1, y * S * 4, (y + 1) * S * 4); }

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry[0] = 0; entry[1] = 0; // 256×256 用 0 表示
entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(22, 12);

const outDir = path.join(__dirname, '..', 'resources');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.ico'), Buffer.concat([header, entry, png]));
console.log('icon.ico OK → resources/icon.ico');
