// draw.js — 記号を描く。k（0..1）で組み上がる途中を描ける。
import { trace } from './geom.js';
import { palette } from './marks.js';

const sat = (x) => Math.min(1, Math.max(0, x));
const io = (x) => x * x * (3 - 2 * x);
const outBack = (x, s = 1.7) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const centroid = (part) => { if (!part._c) { let x = 0, y = 0, n = 0; for (const p of part.paths) for (const q of p.p) { x += q[0]; y += q[1]; n++; } part._c = [x / n, y / n]; } return part._c; };

// 部品ひとつ。u: 描けている割合（0..1）、col: 色、wk: 線の太さの倍率
export function drawPart(c, part, u, col, wk = 1) {
  if (u <= 0) return;
  c.beginPath();
  if (part.kind === 'stroke') {
    for (const p of part.paths) { if (u >= 1) trace(c, p.p, p.closed); else trace(c, p.slice(0, u)); }
    c.lineWidth = part.w * wk; c.lineCap = part.cap; c.lineJoin = part.join; c.miterLimit = 6; c.strokeStyle = col; c.stroke();
  } else {
    const s = u >= 1 ? 1 : outBack(u), [cx, cy] = centroid(part);
    c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); for (const p of part.paths) trace(c, p.p, true); c.fillStyle = col; c.globalAlpha *= sat(u * 3); c.fill(); c.restore();
  }
}
// 記号ぜんたい。o: { k: 組み上がり 0..1, mode: 'dark' | 'light' | 'white' | 'ink', pal, wk, skip: [id], only: [id] }
export function drawMark(c, mark, o = {}) {
  const pal = o.pal || palette(mark, o.mode || 'dark'), k = o.k ?? 1;
  for (const part of mark.parts) {
    if ((o.skip && o.skip.includes(part.id)) || (o.only && !o.only.includes(part.id))) continue;
    const [a, b] = part.t, u = k >= 1 ? 1 : io(sat((k - a) / (b - a)));
    drawPart(c, part, u, pal(part.tone), o.wk ?? 1);
  }
}
// 画面に置く（x, y: 中心、s: 半径の px）
export function placeMark(c, mark, x, y, s, o = {}) { c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(s, s); drawMark(c, mark, o); c.restore(); }
