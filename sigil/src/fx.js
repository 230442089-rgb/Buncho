// fx.js — 光のにじみ、背景（星雲・星）、粒、文字の出し方。どれも時刻だけで決まる（前のフレームを覚えない）。
import { W, H, sat, lerp, ease, TAU, hash1, noise1, smoothstep as sm } from './core.js';

export const CX = 960, CY = 430, R = 230;          // 記号の中心と半径（画面の px）
export const K = (t, a, b) => sat((t - a) / (b - a));
const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
export const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgba = (h, a = 1) => { const c = typeof h === 'string' ? hex(h) : h; return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; };
export const mixc = (a, b, k) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], k))).join(',')})`; };

// ---------------------------------------------------------------- 光る線の層と、にじみ
let ink, inkc, g2, g2c, g8, g8c, fog = [], grainCv, tintCache = new Map();
export function initFx() {
  ink = mk(W, H); inkc = ink.getContext('2d'); g2 = mk(W / 2, H / 2); g2c = g2.getContext('2d'); g8 = mk(W / 8, H / 8); g8c = g8.getContext('2d');
  // 星雲のもと（なめらかな雑音）を 2 枚
  for (let k = 0; k < 2; k++) {
    const w = 384, h = 216, cv = mk(w, h), c = cv.getContext('2d'), im = c.createImageData(w, h), G = 9, grid = [];
    for (let o = 0; o < 5; o++) { const n = (G << o) + 2, g = new Float32Array(n * n); for (let i = 0; i < g.length; i++) g[i] = hash1(i * 1.31 + o * 91.7 + k * 517.3); grid.push([n, g]); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 0, amp = 0.5;
      for (let o = 0; o < 5; o++) { const [n, g] = grid[o], fx = x / w * (n - 2), fy = y / h * (n - 2) * (h / w) * 1.7, ix = fx | 0, iy = Math.min(n - 2, fy | 0), ux = fx - ix, uy = fy - iy, sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy);
        v += amp * (lerp(lerp(g[iy * n + ix], g[iy * n + ix + 1], sx), lerp(g[(iy + 1) * n + ix], g[(iy + 1) * n + ix + 1], sx), sy)); amp *= 0.5; }
      const a = Math.pow(sat((v - 0.36) / 0.42), 1.6), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = a * 255;
    }
    c.putImageData(im, 0, 0); fog.push(cv);
  }
  grainCv = mk(256, 256); const gc = grainCv.getContext('2d'), gi = gc.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = hash1(i * 0.731 + 3.3) * 255; gi.data[i * 4] = gi.data[i * 4 + 1] = gi.data[i * 4 + 2] = v; gi.data[i * 4 + 3] = 255; }
  gc.putImageData(gi, 0, 0);
}
// 光る線を描く層を空にして返す
export function inkLayer() { inkc.setTransform(1, 0, 0, 1, 0, 0); inkc.globalAlpha = 1; inkc.globalCompositeOperation = 'source-over'; inkc.filter = 'none'; inkc.clearRect(0, 0, W, H); inkc.lineCap = 'round'; inkc.lineJoin = 'round'; return inkc; }
// 記号の座標（半径 1）にする。s: 半径の px、zoom: 画面の中心まわりの拡大
export function toMark(c, s = R, x = CX, y = CY, zoom = 1) { c.setTransform(s * zoom, 0, 0, s * zoom, W / 2 + (x - W / 2) * zoom, H / 2 + (y - H / 2) * zoom); }
// 層を画面に重ねる（近いにじみ・遠いにじみ・芯）
export function bloom(c, o = {}) {
  g2c.clearRect(0, 0, W / 2, H / 2); g2c.filter = 'blur(5px)'; g2c.drawImage(ink, 0, 0, W / 2, H / 2); g2c.filter = 'none';
  g8c.clearRect(0, 0, W / 8, H / 8); g8c.filter = 'blur(6px)'; g8c.drawImage(ink, 0, 0, W / 8, H / 8); g8c.filter = 'none';
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.globalCompositeOperation = 'lighter';
  c.globalAlpha = (o.far ?? 0.7) * (o.alpha ?? 1); c.drawImage(g8, 0, 0, W, H); c.globalAlpha = (o.near ?? 0.55) * (o.alpha ?? 1); c.drawImage(g2, 0, 0, W, H);
  c.globalCompositeOperation = o.add ? 'lighter' : 'source-over'; c.globalAlpha = (o.core ?? 1) * (o.alpha ?? 1); c.drawImage(ink, 0, 0); c.restore();
}

// ---------------------------------------------------------------- 背景
function tinted(i, col) { const key = i + col; if (!tintCache.has(key)) { const cv = mk(384, 216), c = cv.getContext('2d'); c.fillStyle = col; c.fillRect(0, 0, 384, 216); c.globalCompositeOperation = 'destination-in'; c.drawImage(fog[i], 0, 0); tintCache.set(key, cv); } return tintCache.get(key); }
// 宇宙の外の暗がり。col: 星雲の色、o: { k: 星雲の濃さ, stars: 星の濃さ, seed, cx, cy（明るみの中心）, base }
export function space(c, t, col, o = {}) {
  const k = o.k ?? 1, cx = o.cx ?? CX, cy = o.cy ?? CY;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = o.base || '#07060c'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, 1100); g.addColorStop(0, rgba(col, 0.2 * k)); g.addColorStop(0.45, rgba(col, 0.07 * k)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter'; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  for (let i = 0; i < 2; i++) {
    const sp = i ? -1 : 1, ph = (o.seed || 0) * 1.7 + i * 2.1;
    const sd = o.seed || 0, sc = 1.55 + 0.25 * (sd * 0.37 % 1) + 0.06 * Math.sin(t * 0.11 + ph), flip = Math.floor(sd * 1.3 + i) % 2 ? -1 : 1;      // 人ごとに、裏返しと大きさを変える
    c.save(); c.translate(W / 2, H / 2); c.rotate(0.12 * Math.sin(t * 0.05 * sp + ph) + i * Math.PI); c.scale(sc * flip, sc);
    c.globalAlpha = (i ? 0.2 : 0.3) * k; c.drawImage(tinted(i, i ? '#8fa0ff' : col), -W / 2 + 40 * Math.sin(t * 0.07 + ph), -H / 2 + 24 * Math.cos(t * 0.06 + ph), W, H); c.restore();
  }
  const sk = o.stars ?? 1;
  for (let i = 0; i < 150; i++) { const x = hash1(i * 2.31 + (o.seed || 0)) * W, y = hash1(i * 5.77 + 1.3) * H, tw = 0.55 + 0.45 * Math.sin(t * (1 + 2 * hash1(i * 3.1)) + i), r = 0.6 + 1.5 * hash1(i * 7.3) ** 3; c.globalAlpha = sk * tw * (0.25 + 0.6 * hash1(i * 9.1)); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#eef0ff'; c.fill(); }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const v = c.createRadialGradient(W / 2, H / 2, 420, W / 2, H / 2, 1180); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.62)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  c.restore();
}
// フィルムの粒（f: フレーム番号）
export function grain(c, f, a = 0.05) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'overlay'; c.globalAlpha = a; const ox = (hash1(f * 1.7) * 256) | 0, oy = (hash1(f * 3.1) * 256) | 0; for (let y = -oy; y < H; y += 256) for (let x = -ox; x < W; x += 256) c.drawImage(grainCv, x, y); c.restore(); }

// ---------------------------------------------------------------- 図形（いまの変換で描く）
export function ring(c, x, y, r, w, col, a = 1, a0 = 0, a1 = TAU) { if (a <= 0.003 || r <= 0) return; c.save(); c.globalAlpha *= a; c.beginPath(); c.arc(x, y, r, a0, a1); c.lineWidth = w; c.strokeStyle = col; c.stroke(); c.restore(); }
export function dot(c, x, y, r, col, a = 1) { if (a <= 0.003 || r <= 0) return; c.save(); c.globalAlpha *= a; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = col; c.fill(); c.restore(); }
export function seg(c, x0, y0, x1, y1, w, col, a = 1) { if (a <= 0.003) return; c.save(); c.globalAlpha *= a; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineWidth = w; c.strokeStyle = col; c.stroke(); c.restore(); }
export function poly(c, pts, col, a = 1, close = true) { if (a <= 0.003) return; c.save(); c.globalAlpha *= a; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (close) c.closePath(); c.fillStyle = col; c.fill(); c.restore(); }
// 組み上がった瞬間の輪と火花（u: 0..1）
export function shock(c, u, col, o = {}) {
  if (u <= 0 || u >= 1) return; const e = ease.outCubic(u), r0 = o.r0 ?? 1.05, r1 = o.r1 ?? 3.4;
  ring(c, 0, 0, lerp(r0, r1, e), 0.07 * (1 - u) + 0.008, col, (1 - u) ** 1.5); ring(c, 0, 0, lerp(r0, r1 * 0.72, e), 0.03 * (1 - u), '#ffffff', 0.7 * (1 - u) ** 2);
  const n = o.n ?? 14; for (let i = 0; i < n; i++) { const a = i / n * TAU + (o.rot || 0.2), ra = lerp(1.2, 2.2 + 0.9 * hash1(i * 3.3), e), rb = ra + 0.34 * (1 - u); seg(c, Math.cos(a) * ra, Math.sin(a) * ra, Math.cos(a) * rb, Math.sin(a) * rb, 0.022, col, (1 - u) ** 1.2); }
}

// ---------------------------------------------------------------- 文字（画面の座標）
const font = (w, size, fam) => `${w} ${size}px "${fam}"`;
export function label(c, str, x, y, size, o = {}) {
  c.save(); c.font = font(o.weight || 500, size, o.fam || 'Noto Sans JP'); c.letterSpacing = (o.ls ?? 0) + 'px'; c.textAlign = o.align || 'center'; c.textBaseline = 'middle'; c.fillStyle = o.col || '#fff'; c.globalAlpha *= o.a ?? 1;
  c.fillText(str, x + (c.textAlign === 'center' ? (o.ls ?? 0) / 2 : 0), y); c.restore();
}
// 一文字ずつ、下からせり上がって出る（k: 0..1）
export function reveal(c, str, x, y, size, k, o = {}) {
  if (k <= 0) return; const ls = o.ls ?? 0, chars = [...str];
  c.save(); c.font = font(o.weight || 800, size, o.fam || 'Shippori Mincho'); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = o.col || '#fff';
  const ws = chars.map((ch) => c.measureText(ch).width + ls), total = ws.reduce((a, b) => a + b, 0) - ls; let cx = x - total / 2;
  const base = c.globalAlpha, st = o.stagger ?? 0.5;
  chars.forEach((ch, i) => { const u = ease.outCubic(sat((k * (1 + st) - st * i / Math.max(1, chars.length - 1)))); if (u > 0) { c.save(); c.beginPath(); c.rect(cx - size * 0.3, y - size * 0.72, ws[i] + size * 0.6, size * 1.36); c.clip(); c.globalAlpha = base * sat(u * 1.6); c.fillText(ch, cx, y + size * 0.85 * (1 - u)); c.restore(); } cx += ws[i]; });
  c.restore();
}
// 左右へのびる細い線（k: 0..1）
export function rule(c, x, y, w, k, col = 'rgba(255,255,255,.4)', lw = 2) { if (k <= 0) return; const e = ease.outCubic(sat(k)); c.save(); c.beginPath(); c.moveTo(x - w / 2 * e, y); c.lineTo(x + w / 2 * e, y); c.lineWidth = lw; c.strokeStyle = col; c.stroke(); c.restore(); }
// 記号の下に出す名前の組み（tl: 組み上がってからの秒）
export function lockup(c, m, tl, o = {}) {
  if (tl <= 0) return; const y = o.y ?? 792, x = o.x ?? CX, col = o.col || '#ffffff', dim = o.dim || 'rgba(255,255,255,';
  reveal(c, m.name, x, y, 98, K(tl, 0, 0.75), { ls: 16, col });
  c.save(); c.globalAlpha *= ease.outCubic(K(tl, 0.3, 0.95)); label(c, m.epithet, x, y + 82 + 10 * (1 - ease.outCubic(K(tl, 0.3, 0.95))), 31, { ls: 9, col: dim + '.82)', weight: 500 }); c.restore();
  rule(c, x, y + 128, 150, K(tl, 0.45, 1.1), dim + '.34)');
  c.save(); c.globalAlpha *= ease.outCubic(K(tl, 0.6, 1.3)); label(c, `${m.role}　｜　${m.ability}`, x, y + 162, 21, { ls: 5, col: dim + '.5)', weight: 400 }); c.restore();
}
