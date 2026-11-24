// props.js — 文字（吹き出し・描き文字）、家具、背景、漫画の記号（集中線・汗・ハート・土けむり）
import { W, H, sat, smoothstep, ease, lerp, clamp, TAU, hash1, noise1 } from './core.js';
import { LINE, heart } from './chibi.js';

const font = (w, size, fam = 'Zen Maru Gothic') => `${w} ${size}px "${fam}"`;
const stroke = (c, lw = 4, col = LINE) => { c.strokeStyle = col; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); };
const fill = (c, col) => { c.fillStyle = col; c.fill(); };
export function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

// ---- 文字。♡ と ♪ は図形で描く（書体に無くても同じ形になる）
function segments(c, str, size, o) {
  c.font = font(o.weight || 700, size, o.fam); c.letterSpacing = (o.ls ?? size * 0.04) + 'px';
  const segs = str.split(/(♡|♪)/).filter(Boolean);
  return segs.map((s) => [s, s === '♡' ? size * 1.0 : s === '♪' ? size * 0.8 : c.measureText(s).width]);
}
export function textWidth(c, str, size, o = {}) { return segments(c, str, size, o).reduce((a, s) => a + s[1], 0); }
export function text(c, str, x, y, size, o = {}) {
  const segs = segments(c, str, size, o), total = segs.reduce((a, s) => a + s[1], 0);
  let cx = o.align === 'l' ? x : o.align === 'r' ? x - total : x - total / 2;
  c.textBaseline = 'middle'; c.textAlign = 'left';
  for (const [s, w] of segs) {
    if (s === '♡') { if (o.stroke) heart(c, cx + w / 2, y, size * 0.47, o.stroke); heart(c, cx + w / 2, y, size * 0.36, o.heart || '#ff7fa3'); }
    else if (s === '♪') { c.save(); c.translate(cx + w * 0.42, y); c.fillStyle = o.col || LINE; c.beginPath(); c.ellipse(-size * 0.08, size * 0.26, size * 0.17, size * 0.12, -0.4, 0, TAU); c.fill(); c.fillRect(size * 0.05, -size * 0.34, size * 0.07, size * 0.62); c.beginPath(); c.moveTo(size * 0.05, -size * 0.34); c.quadraticCurveTo(size * 0.36, -size * 0.26, size * 0.3, 0); c.quadraticCurveTo(size * 0.26, -size * 0.14, size * 0.05, -size * 0.14); c.fill(); c.restore(); }
    else { if (o.stroke) { c.lineWidth = o.strokeW || size * 0.22; c.strokeStyle = o.stroke; c.lineJoin = 'round'; c.strokeText(s, cx, y); } c.fillStyle = o.col || LINE; c.fillText(s, cx, y); }
    cx += w;
  }
  c.letterSpacing = '0px';
  return total;
}

// ---- 吹き出し。b: { t0, t1, x, y（中心）, text（\n で改行）, size, tail: [x,y], kind: 'round' | 'shout' | 'think' | 'dark' | 'soft', fam, weight }
export function bubble(c, t, b) {
  if (t < b.t0 || t >= b.t1) return;
  const tl = t - b.t0, size = b.size || 46, lines = b.text.split('\n'), o = { weight: b.weight || 700, fam: b.fam };
  const a = ease.outBack(sat(tl / 0.2), 1.6), out = 1 - sat((t - (b.t1 - 0.12)) / 0.12);
  const widths = lines.map((l) => textWidth(c, l, size, o)), tw = Math.max(...widths), lh = size * 1.36;
  const bw = tw + size * 1.5, bh = lines.length * lh + size * 0.9, dark = b.kind === 'dark', kind = b.kind || 'round';
  const sh = b.shake ? [noise1(t * 30, 3) * b.shake, noise1(t * 30, 4) * b.shake] : [0, 0];
  c.save(); c.globalAlpha *= out; c.translate(b.x + sh[0], b.y + sh[1]); c.rotate(0.012 * Math.sin(t * 2.3 + b.x)); c.scale(a, a);
  const bg = dark ? '#1a1029' : kind === 'think' ? '#fff5fa' : '#ffffff', ln = dark ? '#ff8fb8' : LINE;
  // しっぽ（吹き出しの下に描いて、輪郭をつなげる）
  const drawBody = () => {
    if (kind === 'shout') { c.beginPath(); const n = 18; for (let i = 0; i < n * 2; i++) { const an = i / (n * 2) * TAU, rr = i % 2 ? 1.0 : 1.2 + 0.08 * hash1(i * 3.1 + b.x); const px = Math.cos(an) * bw * 0.56 * rr, py = Math.sin(an) * bh * 0.6 * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
    else if (kind === 'think') { c.beginPath(); const n = 11; for (let i = 0; i < n; i++) { const an = i / n * TAU; c.moveTo(Math.cos(an) * bw * 0.46 + bw * 0.14, Math.sin(an) * bh * 0.44); c.arc(Math.cos(an) * bw * 0.46, Math.sin(an) * bh * 0.44, Math.min(bw, bh) * 0.24, 0, TAU); } c.rect(-bw * 0.42, -bh * 0.4, bw * 0.84, bh * 0.8); }
    else rrect(c, -bw / 2, -bh / 2, bw, bh, Math.min(bh / 2, size * 1.1));
  };
  if (b.tail) {
    const tx = b.tail[0] - b.x, ty = b.tail[1] - b.y, L = Math.hypot(tx, ty) || 1, ux = tx / L, uy = ty / L;
    if (kind === 'think') { for (const [k, r] of [[0.62, 0.3], [0.8, 0.2], [0.94, 0.12]]) { c.beginPath(); c.arc(tx * k, ty * k, size * r, 0, TAU); fill(c, bg); stroke(c, 4, ln); } }
    else { const bx = clamp(tx * 0.3, -bw * 0.3, bw * 0.3), by = (ty > 0 ? 1 : -1) * bh * 0.42, wd = size * 0.36; c.beginPath(); c.moveTo(bx - uy * wd - ux * 4, by + ux * wd); c.lineTo(tx * 0.86, ty * 0.86); c.lineTo(bx + uy * wd, by - ux * wd); c.closePath(); fill(c, bg); stroke(c, 8, ln); }
  }
  drawBody(); stroke(c, 8, ln); drawBody(); fill(c, bg);
  if (b.tail && kind !== 'think') { const tx = b.tail[0] - b.x, ty = b.tail[1] - b.y, L = Math.hypot(tx, ty) || 1, ux = tx / L, uy = ty / L, bx = clamp(tx * 0.3, -bw * 0.3, bw * 0.3), by = (ty > 0 ? 1 : -1) * bh * 0.42, wd = size * 0.36; c.beginPath(); c.moveTo(bx - uy * wd, by + ux * wd); c.lineTo(tx * 0.86, ty * 0.86); c.lineTo(bx + uy * wd, by - ux * wd); c.closePath(); fill(c, bg); }
  lines.forEach((l, i) => text(c, l, 0, (i - (lines.length - 1) / 2) * lh + size * 0.03, size, { ...o, col: dark ? '#ffffff' : b.col || LINE, heart: dark ? '#ff6f9f' : '#ff7fa3' }));
  c.restore();
}
// ---- 描き文字（効果音）。s: { t0, t1, text, x, y, size, rot, col, fam, shake, grow }
export function sfx(c, t, s) {
  if (t < s.t0 || t >= s.t1) return;
  const tl = t - s.t0, a = ease.outBack(sat(tl / 0.16), 2.2), out = 1 - sat((t - (s.t1 - 0.14)) / 0.14);
  const sh = s.shake ? [noise1(t * 28, 7 + s.x) * s.shake, noise1(t * 28, 9 + s.y) * s.shake] : [0, 0];
  c.save(); c.globalAlpha *= out; c.translate(s.x + sh[0], s.y + sh[1]); c.rotate(s.rot || 0); c.scale(a * (1 + (s.grow || 0) * tl), a * (1 + (s.grow || 0) * tl));
  text(c, s.text, 0, 0, s.size || 90, { fam: s.fam || 'Dela Gothic One', weight: 400, col: s.col || LINE, stroke: s.stroke || '#ffffff', strokeW: (s.size || 90) * 0.26, ls: 2 });
  c.restore();
}

// ---- 漫画の記号
export function speedLines(c, cx, cy, t, k, o = {}) {
  if (k <= 0.01) return;
  const n = o.n || 70, seed = Math.floor(t * 15), inner = o.inner || 420;
  c.save(); c.globalAlpha *= k; c.fillStyle = o.col || 'rgba(90,70,110,.5)';
  for (let i = 0; i < n; i++) { const an = (i + hash1(i * 1.7 + seed * 9.1)) / n * TAU; if (hash1(i * 3.3 + seed) > 0.6) continue; const r0 = inner * (0.8 + 0.6 * hash1(i * 5.1 + seed * 2.3)), wd = 0.004 + 0.012 * hash1(i * 7.7 + seed); c.beginPath(); c.moveTo(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0 * 0.8); c.lineTo(cx + Math.cos(an - wd) * 2400, cy + Math.sin(an - wd) * 2400); c.lineTo(cx + Math.cos(an + wd) * 2400, cy + Math.sin(an + wd) * 2400); c.closePath(); c.fill(); }
  c.restore();
}
export function gloom(c, x, y, w, k) {           // 頭の上の「どよーん」の縦線
  if (k <= 0.01) return; c.save(); c.globalAlpha *= k;
  for (let i = 0; i < 7; i++) { const px = x + (i - 3) * w / 7, h = 46 + 50 * hash1(i * 2.7); c.beginPath(); c.moveTo(px, y); c.lineTo(px, y + h); stroke(c, 5, '#7d8fd0'); }
  c.restore();
}
export function drops(c, x, y, t, t0, n = 5, s = 1, col = '#bfe2fb') {   // 飛び散る汗
  for (let i = 0; i < n; i++) { const a = t - t0 - i * 0.05; if (a < 0 || a > 0.7) continue; const an = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5, d = (60 + 160 * a) * s, px = x + Math.cos(an) * d, py = y + Math.sin(an) * d + 220 * a * a * s; c.save(); c.globalAlpha *= 1 - a / 0.7; c.translate(px, py); c.rotate(an + Math.PI / 2); c.beginPath(); c.moveTo(0, -16 * s); c.bezierCurveTo(12 * s, 0, 10 * s, 12 * s, 0, 12 * s); c.bezierCurveTo(-10 * s, 12 * s, -12 * s, 0, 0, -16 * s); fill(c, col); stroke(c, 3, '#8fbfe6'); c.restore(); }
}
export function dust(c, x, y, t, t0, s = 1, dir = 1) {       // 土けむり
  const a = t - t0; if (a < 0 || a > 0.9) return;
  c.save(); c.globalAlpha *= 1 - a / 0.9;
  for (let i = 0; i < 6; i++) { const r = (26 + 30 * hash1(i * 2.1) + 80 * a) * s, px = x - dir * (i * 34 + 180 * a) * s + 20 * hash1(i * 5.5), py = y - (10 + 26 * hash1(i * 3.3) + 60 * a * hash1(i)) * s; c.beginPath(); c.arc(px, py, r, 0, TAU); fill(c, '#f3ece6'); stroke(c, 3.5, '#b9a9a6'); }
  c.restore();
}
export function heartsUp(c, t, o = {}) {              // ふわふわ上がるハート
  const n = o.n || 16, col = o.col || '#ff8fb1';
  for (let i = 0; i < n; i++) { const h1 = hash1(i * 3.1 + (o.seed || 0)), h2 = hash1(i * 7.3 + (o.seed || 0)), life = 3 + 3 * h2, ph = ((t * (o.speed || 1)) / life + h1) % 1; const x = (o.x0 ?? 0) + h2 * (o.w ?? W) + 30 * Math.sin(t * 1.5 + i), y = (o.y1 ?? H + 40) - ph * ((o.y1 ?? H + 40) - (o.y0 ?? -40)); c.save(); c.globalAlpha *= (o.alpha ?? 0.8) * Math.sin(ph * Math.PI); heart(c, x, y, (o.size || 22) * (0.6 + 0.8 * h1), col, 0.3 * Math.sin(t + i)); c.restore(); }
}
export function burst(c, x, y, t, t0, o = {}) {        // はじけるハート・星
  const a = t - t0; if (a < 0 || a > (o.dur || 0.8)) return; const n = o.n || 12, u = a / (o.dur || 0.8);
  for (let i = 0; i < n; i++) { const an = i / n * TAU + hash1(i) * 0.5, d = (o.r || 260) * ease.outCubic(u) * (0.6 + 0.6 * hash1(i * 3.7)); c.save(); c.globalAlpha *= 1 - u; heart(c, x + Math.cos(an) * d, y + Math.sin(an) * d, (o.size || 26) * (1 - 0.4 * u), o.col || '#ff8fb1', an); c.restore(); }
}

// ---- 家具と小物
export function sofa(c, cx, by, w = 900, o = {}) {
  const k = w / 900, main = o.main || '#dcd3f3', seat = o.seat || '#e8e1f9', sh = o.shade || '#c8bde9';
  const X = (v) => cx + v * k, Y = (v) => by + v * k;
  for (const s of [-1, 1]) { c.fillStyle = '#b9a58f'; c.fillRect(X(s * 370 - 14), Y(-34), 28 * k, 34 * k); }
  rrect(c, X(-400), Y(-470), 800 * k, 330 * k, 70 * k); fill(c, main); stroke(c, 5);                     // 背もたれ
  c.beginPath(); c.moveTo(X(0), Y(-455)); c.lineTo(X(0), Y(-190)); stroke(c, 3.5, sh);
  rrect(c, X(-410), Y(-215), 820 * k, 185 * k, 46 * k); fill(c, main); stroke(c, 5);                      // 土台
  for (const s of [-1, 0]) { rrect(c, X(s * 392 + 6), Y(-262), 380 * k, 110 * k, 44 * k); fill(c, seat); stroke(c, 5); }      // 座面
  for (const s of [-1, 1]) { rrect(c, X(s * 425 - 62), Y(-330), 124 * k, 298 * k, 56 * k); fill(c, main); stroke(c, 5); c.beginPath(); c.moveTo(X(s * 425 - 36), Y(-270)); c.quadraticCurveTo(X(s * 425), Y(-296), X(s * 425 + 36), Y(-270)); stroke(c, 3.5, sh); }
}
export function cup(c, x, y, s, t, steam = 1) {
  c.beginPath(); c.ellipse(x, y + 22 * s, 46 * s, 11 * s, 0, 0, TAU); fill(c, '#ffffff'); stroke(c, 3.5);
  c.beginPath(); c.moveTo(x - 28 * s, y - 20 * s); c.bezierCurveTo(x - 28 * s, y + 26 * s, x + 28 * s, y + 26 * s, x + 28 * s, y - 20 * s); c.closePath(); fill(c, '#ffffff'); stroke(c, 3.5);
  c.beginPath(); c.ellipse(x, y - 20 * s, 28 * s, 8 * s, 0, 0, TAU); fill(c, '#e9b98a'); stroke(c, 3.5);
  c.beginPath(); c.arc(x + 34 * s, y - 2 * s, 11 * s, -1.3, 1.5); stroke(c, 3.5);
  if (steam > 0) for (const dx of [-9, 9]) { c.save(); c.globalAlpha *= 0.7 * steam; c.beginPath(); for (let i = 0; i <= 10; i++) { const u = i / 10, px = x + dx * s + Math.sin(u * 5 + t * 2.4 + dx) * 6 * s, py = y - (30 + u * 52) * s; i ? c.lineTo(px, py) : c.moveTo(px, py); } stroke(c, 3, '#c9bfd6'); c.restore(); }
}
export function table(c, cx, y, w = 420) {
  const k = w / 420;
  for (const s of [-1, 1]) { c.fillStyle = '#d9c2a5'; rrect(c, cx + s * 150 * k - 10 * k, y, 20 * k, 92 * k, 6 * k); c.fill(); stroke(c, 4); }
  rrect(c, cx - 210 * k, y - 30 * k, 420 * k, 44 * k, 18 * k); fill(c, '#f4e4cf'); stroke(c, 5);
}
export function tray(c, x, y, s, t) { rrect(c, x - 110 * s, y - 6 * s, 220 * s, 26 * s, 12 * s); fill(c, '#e8cfae'); stroke(c, 4); cup(c, x - 52 * s, y - 28 * s, s * 0.9, t); cup(c, x + 52 * s, y - 28 * s, s * 0.9, t + 1); }
export function pillow(c, x, y, s, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); rrect(c, -70 * s, -52 * s, 140 * s, 104 * s, 30 * s); fill(c, '#ffe3ec'); stroke(c, 4); heart(c, 0, 4 * s, 22 * s, '#ff9dbb'); c.restore(); }
export function blanket(c, x, y, s, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); rrect(c, -90 * s, -40 * s, 180 * s, 80 * s, 22 * s); fill(c, '#cfe6f7'); stroke(c, 4); c.beginPath(); c.moveTo(-90 * s, 4 * s); c.lineTo(90 * s, 4 * s); stroke(c, 3, '#a9cbe6'); c.restore(); }

// ---- 背景
export function room(c, t, o = {}) {
  c.fillStyle = '#fdfbf8'; c.fillRect(0, 0, W, H);
  const fy = o.floor ?? 800; c.fillStyle = '#f7f0e9'; c.fillRect(0, fy, W, H - fy);
  c.beginPath(); c.moveTo(0, fy); c.lineTo(W, fy); stroke(c, 4, '#d9cbc3');
  // 窓
  const wx = o.winX ?? 1380, wy = 150; rrect(c, wx, wy, 330, 300, 14); fill(c, '#e9f4fd'); stroke(c, 5, '#cdbfb8');
  c.beginPath(); c.moveTo(wx + 165, wy); c.lineTo(wx + 165, wy + 300); c.moveTo(wx, wy + 150); c.lineTo(wx + 330, wy + 150); stroke(c, 4, '#cdbfb8');
  c.save(); rrect(c, wx, wy, 330, 300, 14); c.clip(); for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(wx + ((i * 150 + t * 8) % 460) - 60, wy + 70 + i * 60, 56, 20, 0, 0, TAU); fill(c, '#ffffff'); } c.restore();
  // 額と鉢植え
  rrect(c, 250, 210, 150, 110, 8); fill(c, '#fff5f8'); stroke(c, 5, '#cdbfb8'); heart(c, 325, 268, 22, '#ffc2d4');
}
export function hallway(c, t, speed = 1) {
  const vx = W / 2, vy = 410;
  c.fillStyle = '#fdfbf8'; c.fillRect(0, 0, W, H);
  c.beginPath(); c.moveTo(vx - 150, vy + 120); c.lineTo(vx + 150, vy + 120); c.lineTo(W + 300, H); c.lineTo(-300, H); c.closePath(); fill(c, '#f6eee6');       // 床
  c.beginPath(); c.moveTo(vx - 150, vy - 170); c.lineTo(vx + 150, vy - 170); c.lineTo(vx + 150, vy + 120); c.lineTo(vx - 150, vy + 120); c.closePath(); fill(c, '#f3edf7'); stroke(c, 3.5, '#d2c5d6');   // 突き当たり
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(vx + s * 150, vy - 170); c.lineTo(vx + s * 1300, -260); c.moveTo(vx + s * 150, vy + 120); c.lineTo(vx + s * 1300, H + 60); stroke(c, 4, '#d2c5d6'); }
  // 奥へ流れていく床の目地・扉
  for (let i = 0; i < 7; i++) {
    const u = ((i / 7 - t * speed * 0.35) % 1 + 1) % 1, k = u * u, a = sat(u * 4) * 0.9;
    const yb = lerp(vy + 120, H + 60, k), half = lerp(150, 1300, k);
    c.save(); c.globalAlpha *= a; c.beginPath(); c.moveTo(vx - half, yb); c.lineTo(vx + half, yb); stroke(c, 2 + 5 * k, '#e3d6cf');
    if (i % 2 === 0) for (const s of [-1, 1]) { const k2 = Math.max(0, u - 0.09) ** 2, h2 = lerp(150, 1300, k2), yb2 = lerp(vy + 120, H + 60, k2), yt = lerp(vy - 110, -140, k), yt2 = lerp(vy - 110, -140, k2); c.beginPath(); c.moveTo(vx + s * half, yb); c.lineTo(vx + s * half, yt); c.lineTo(vx + s * h2, yt2); c.lineTo(vx + s * h2, yb2); c.closePath(); fill(c, '#efe4f3'); stroke(c, 2 + 3 * k, '#cdbdd3'); }
    c.restore();
  }
  return [vx, vy];
}
// ヤンデレの気配: 暗い紫に、「ゆり姉♡」が敷きつめられる
export function darkTiles(c, t, k) {
  if (k <= 0.01) return;
  c.save(); c.globalAlpha *= k;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b1f42'); g.addColorStop(1, '#5a3d78'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.rotate(-0.08);
  for (let r = -2; r < 14; r++) for (let q = -1; q < 9; q++) { const x = q * 300 + (r % 2) * 150 - ((t * 26) % 300), y = r * 96 + 30; text(c, 'ゆり姉♡', x, y, 50, { fam: 'Hachi Maru Pop', weight: 400, col: 'rgba(214,170,255,.2)', heart: 'rgba(255,120,170,.3)' }); }
  c.restore();
  const v = c.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1150); v.addColorStop(0, 'rgba(20,10,35,0)'); v.addColorStop(1, 'rgba(20,10,35,.65)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  c.restore();
}
export function dreamBg(c, t) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffe9f2'); g.addColorStop(1, '#ffd3e4'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 26; i++) { const x = hash1(i * 2.3) * W, y = hash1(i * 5.1) * H, r = 40 + 90 * hash1(i * 7.7); c.save(); c.globalAlpha = 0.35 + 0.2 * Math.sin(t * 1.3 + i); c.beginPath(); c.arc(x, y + 14 * Math.sin(t * 0.8 + i), r, 0, TAU); fill(c, '#fff3f8'); c.restore(); }
}
