// 生成 PWA 图标（无第三方依赖，纯 Node + zlib 输出 PNG）
// 用法: node scripts/generate-icons.js
// 设计: 蓝色渐变背景 (#2196f3 -> #1565c0) + 白色锥形瓶, 呼应 🧪 主题
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'icons');

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 画布 ----------
class Canvas {
  constructor(size) {
    this.size = size;
    this.buf = Buffer.alloc(size * size * 4);
  }
  set(x, y, [r, g, b, a]) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const i = (y * this.size + x) * 4;
    const srcA = a / 255, dstA = this.buf[i + 3] / 255;
    const outA = srcA + dstA * (1 - srcA);
    if (outA === 0) return;
    this.buf[i]     = Math.round((r * srcA + this.buf[i]     * dstA * (1 - srcA)) / outA);
    this.buf[i + 1] = Math.round((g * srcA + this.buf[i + 1] * dstA * (1 - srcA)) / outA);
    this.buf[i + 2] = Math.round((b * srcA + this.buf[i + 2] * dstA * (1 - srcA)) / outA);
    this.buf[i + 3] = Math.round(outA * 255);
  }
  // 对角线渐变取样
  grad(x, y) {
    const t = (x / this.size + y / this.size) / 2;
    const c0 = [0x21, 0x96, 0xf3], c1 = [0x15, 0x65, 0xc0];
    return [0, 1, 2].map(i => Math.round(c0[i] + (c1[i] - c0[i]) * t)).concat(255);
  }
  fillAllGradient() {
    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) this.set(x, y, this.grad(x, y));
  }
  roundedBg(radius) {
    const s = this.size;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const dx = Math.max(radius - x, x - (s - 1 - radius), 0);
      const dy = Math.max(radius - y, y - (s - 1 - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) this.set(x, y, this.grad(x, y));
    }
  }
  circle(cx, cy, r, color) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, color);
  }
  rect(x0, y0, x1, y1, color, radius = 0) {
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      if (radius > 0) {
        const dx = Math.max(x0 + radius - x, x - (x1 - radius), 0);
        const dy = Math.max(y0 + radius - y, y - (y1 - radius), 0);
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      this.set(x, y, color);
    }
  }
  polygon(pts, color) {
    const minY = Math.floor(Math.min(...pts.map(p => p[1])));
    const maxY = Math.ceil(Math.max(...pts.map(p => p[1])));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y))
          xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.ceil(xs[i]); x <= xs[i + 1]; x++) this.set(x, y, color);
    }
  }
  // 锥形瓶剪影, glyph 为占画布高度的缩放
  flask(scale = 1) {
    const s = this.size, cx = s / 2, u = s * scale / 100; // u: 设计单位
    const white = [255, 255, 255, 255];
    // 瓶口唇沿
    this.rect(cx - 8.5 * u, 15 * u, cx + 8.5 * u, 20 * u, white, 2 * u);
    // 瓶颈
    this.rect(cx - 4.5 * u, 19 * u, cx + 4.5 * u, 38 * u, white);
    // 瓶身梯形（下缘圆角）
    this.polygon([
      [cx - 4.5 * u, 38 * u], [cx + 4.5 * u, 38 * u],
      [cx + 29 * u, 76 * u], [cx - 29 * u, 76 * u],
    ], white);
    this.rect(cx - 29 * u, 73 * u, cx + 29 * u, 80 * u, white, 4 * u);
    // 瓶内气泡（用背景渐变色打孔，露出台面感）
    this.circle(cx - 12 * u, 68 * u, 3.5 * u, this.grad(cx - 12 * u, 68 * u));
    this.circle(cx + 9 * u, 72 * u, 2.4 * u, this.grad(cx + 9 * u, 72 * u));
    this.circle(cx + 2 * u, 62 * u, 1.7 * u, this.grad(cx + 2 * u, 62 * u));
  }
}

function writeIcon(name, size, { maskable = false, rounded = false } = {}) {
  const c = new Canvas(size);
  if (rounded) c.roundedBg(size * 0.1875);      // any 用途: 圆角方形
  else c.fillAllGradient();                     // maskable / apple: 满铺
  c.flask(maskable ? 0.8 : 1);               // maskable 内容缩进安全区
  fs.writeFileSync(path.join(OUT_DIR, name), encodePNG(size, size, c.buf));
  console.log(`✓ icons/${name} (${size}x${size})`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
writeIcon('icon-192.png', 192, { rounded: true });
writeIcon('icon-512.png', 512, { rounded: true });
writeIcon('icon-maskable-192.png', 192, { maskable: true });
writeIcon('icon-maskable-512.png', 512, { maskable: true });
writeIcon('apple-touch-icon.png', 180);
console.log('完成');
