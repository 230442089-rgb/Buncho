// ───────── 描画の道具 ─────────
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function rgb(h) {
  if (h.length === 4) return [parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16)];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function mixc(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return 'rgb(' + Math.round(lerp(A[0], B[0], t)) + ',' + Math.round(lerp(A[1], B[1], t)) + ',' + Math.round(lerp(A[2], B[2], t)) + ')';
}
// 四角
function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
// ディザ塗り（lv: 0〜16、16 でベタ）
function DI(g, x, y, w, h, c, lv) {
  g.fillStyle = c; x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (BAYER[(y + j) & 3][(x + i) & 3] < lv) g.fillRect(x + i, y + j, 1, 1);
}
// 線
function LN(g, x0, y0, x1, y1, c) {
  g.fillStyle = c; x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (let n = 0; n < 2000; n++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
// 塗りつぶし楕円（lv を渡すとディザ）
function EL(g, cx, cy, rx, ry, c, lv) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.001))));
    if (lv === undefined) R(g, cx - w, cy + y, w * 2 + 1, 1, c); else DI(g, cx - w, cy + y, w * 2 + 1, 1, c, lv);
  }
}
// 楕円の輪郭
function ELO(g, cx, cy, rx, ry, c) {
  g.fillStyle = c; let px = null, py = null;
  for (let a = 0; a <= 64; a++) {
    const t = a / 64 * Math.PI * 2, x = Math.round(cx + Math.cos(t) * rx), y = Math.round(cy + Math.sin(t) * ry);
    if (px !== null) LN(g, px, py, x, y, c);
    px = x; py = y;
  }
}
// 文字の行でドット絵を置く
function ROWS(g, x, y, arr, pal) {
  for (let j = 0; j < arr.length; j++) {
    const s = arr[j];
    for (let i = 0; i < s.length; i++) { const c = pal[s[i]]; if (c) { g.fillStyle = c; g.fillRect(x + i, y + j, 1, 1); } }
  }
}
function SPR(arr, pal) {
  let w = 0; for (const s of arr) w = Math.max(w, s.length);
  const o = mkCanvas(w, arr.length); ROWS(o.g, 0, 0, arr, pal); return o.c;
}
function C(w, h, fn) { const o = mkCanvas(w, h); fn(o.g); return o.c; }
// 1px のふちどりを付けた絵を返す（上下左右に 1px 大きくなる）
function outline(src, col) {
  const w = src.width, h = src.height;
  const s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const o = mkCanvas(w + 2, h + 2); const img = o.g.createImageData(w + 2, h + 2); const d = img.data; const c = rgb(col || '#303');
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && s[(y * w + x) * 4 + 3] > 0;
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const i = ((y + 1) * (w + 2) + x + 1) * 4;
    if (on(x, y)) { const k = (y * w + x) * 4; d[i] = s[k]; d[i + 1] = s[k + 1]; d[i + 2] = s[k + 2]; d[i + 3] = 255; }
    else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  }
  o.g.putImageData(img, 0, 0); return o.c;
}
function flipH(src) { return C(src.width, src.height, g => { g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); }); }
// 形だけを 1 色で（stip: 市松に抜く）
function silh(src, col, stip) {
  const w = src.width, h = src.height;
  const s = src.getContext('2d').getImageData(0, 0, w, h).data;
  const o = mkCanvas(w, h); const img = o.g.createImageData(w, h); const d = img.data; const c = rgb(col);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (s[i + 3] > 0 && (!stip || ((x + y) & 1) === 0)) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  }
  o.g.putImageData(img, 0, 0); return o.c;
}

// 文字。16px のドット文字を 1bit にして置く（半角 8px、全角 16px）。
const Text = (() => {
  const FONT = '16px AtelierDot, DotGothic16, "MS Gothic", monospace';
  const cache = new Map();
  const tmp = mkCanvas(256, 20, true);
  const cw = ch => { const c = ch.codePointAt(0); return (c < 0x100 || (c >= 0xff61 && c <= 0xff9f)) ? 8 : 16; };
  const width = s => { let w = 0; for (const ch of s) w += cw(ch); return w; };
  function make(s, col, out) {
    const w = Math.max(1, width(s)), h = 16;
    if (tmp.c.width < w) { tmp.c.width = w; }
    const t = tmp.g;
    t.clearRect(0, 0, tmp.c.width, 20); t.font = FONT; t.textBaseline = 'alphabetic'; t.fillStyle = '#fff';
    let x = 0; for (const ch of s) { t.fillText(ch, x, 14); x += cw(ch); }
    const src = t.getImageData(0, 0, w, h).data;
    const o = mkCanvas(w + 2, h + 2); const img = o.g.createImageData(w + 2, h + 2); const d = img.data;
    const fc = rgb(col), oc = out ? rgb(out) : null;
    const on = (px, py) => px >= 0 && py >= 0 && px < w && py < h && src[(py * w + px) * 4 + 3] > 110;
    for (let py = -1; py <= h; py++) for (let px = -1; px <= w; px++) {
      const i = ((py + 1) * (w + 2) + px + 1) * 4;
      if (on(px, py)) { d[i] = fc[0]; d[i + 1] = fc[1]; d[i + 2] = fc[2]; d[i + 3] = 255; }
      else if (oc && (on(px - 1, py) || on(px + 1, py) || on(px, py - 1) || on(px, py + 1) || on(px - 1, py - 1) || on(px + 1, py - 1) || on(px - 1, py + 1) || on(px + 1, py + 1))) {
        d[i] = oc[0]; d[i + 1] = oc[1]; d[i + 2] = oc[2]; d[i + 3] = 255;
      }
    }
    o.g.putImageData(img, 0, 0); return o.c;
  }
  function get(s, col, out) {
    const k = s + '\n' + col + '\n' + (out || '');
    let c = cache.get(k);
    if (!c) { if (cache.size > 500) cache.clear(); c = make(s, col, out); cache.set(k, c); }
    return c;
  }
  // opt: { out: ふちの色, align: 'center'|'right', scale: 整数倍 }
  function draw(g, s, x, y, col, opt) {
    opt = opt || {};
    const c = get(s, col || '#fff', opt.out || null), sc = opt.scale || 1, w = (c.width - 2) * sc;
    if (opt.align === 'center') x -= w / 2; else if (opt.align === 'right') x -= w;
    g.drawImage(c, Math.round(x) - sc, Math.round(y) - sc, c.width * sc, c.height * sc);
  }
  return { get, draw, width, clear() { cache.clear(); } };
})();

// 仕上げ: 減色とディザ。むかしの 256 色の画面のようにする。
const FX = { levels: 6, desat: 0, glitch: 0, invert: false };
const QLUT = {};
function qlut(lv) {
  if (QLUT[lv]) return QLUT[lv];
  const step = 255 / (lv - 1), t = new Uint8ClampedArray(768);
  for (let v = 0; v < 768; v++) t[v] = Math.round(clamp(v - 256, 0, 255) / step) * step;
  return (QLUT[lv] = t);
}
function postFX(sg, dg) {
  const img = sg.getImageData(0, 0, W, H), d = img.data;
  const lv = Math.max(2, FX.levels | 0), q = qlut(lv), amp = 255 / (lv - 1), des = FX.desat, inv = FX.invert;
  let i = 0;
  for (let y = 0; y < H; y++) {
    const br = BAYER[y & 3];
    for (let x = 0; x < W; x++, i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (des > 0) { const gr = (r * 77 + g * 150 + b * 29) >> 8; r += (gr - r) * des; g += (gr - g) * des; b += (gr - b) * des; }
      if (inv) { r = 255 - r; g = 255 - g; b = 255 - b; }
      const t = ((br[x & 3] + 0.5) / 16 - 0.5) * amp + 256;
      d[i] = q[(r + t) | 0]; d[i + 1] = q[(g + t) | 0]; d[i + 2] = q[(b + t) | 0]; d[i + 3] = 255;
    }
  }
  if (FX.glitch > 0.02) {
    const n = Math.floor(FX.glitch * 14);
    for (let k = 0; k < n; k++) {
      const y = irnd(0, H - 3), hh = irnd(1, 2), sh = irnd(-10, 10) * 4;
      if (!sh) continue;
      const a = y * W * 4, len = W * 4 * hh, row = d.slice(a, a + len);
      for (let j = 0; j < len; j++) d[a + j] = row[(j - sh + len * 4) % len];
    }
  }
  dg.putImageData(img, 0, 0);
}
