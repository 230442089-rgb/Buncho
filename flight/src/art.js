// art.js — 画面に重ねる物のための絵（光の輪・光の粒・紋章）を 2D キャンバスで用意する。
import { MARKS } from '../../sigil/src/marks.js';
import { drawMark } from '../../sigil/src/draw.js';

const TAU = Math.PI * 2;
const mk = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
const rect = (x, y, w, h, n = 512, m = n) => [(x + 0.5) / n, (y + 0.5) / m, (x + w - 0.5) / n, (y + h - 0.5) / m];

// 光の部品をまとめた 1 枚（512²）。FX.* は uv の範囲
export const FX = {
  ring: rect(0, 0, 256, 256), dash: rect(0, 256, 256, 256), glow: rect(256, 0, 128, 128), spark: rect(384, 0, 128, 128),
  streak: rect(256, 128, 256, 32), beam: rect(256, 176, 64, 256), solid: rect(340, 180, 8, 8), puff: rect(384, 176, 128, 128),
  RING_R: 100 / 128,
};
export function fxAtlas() {
  const cv = mk(512, 512), c = cv.getContext('2d');
  // 輪（細い芯 + にじみ）
  c.save(); c.translate(128, 128);
  for (const [w, a] of [[34, 0.035], [22, 0.06], [13, 0.11], [7, 0.3], [3.2, 1]]) { c.beginPath(); c.arc(0, 0, 100, 0, TAU); c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = w; c.stroke(); }
  c.restore();
  // 目盛りつきの外輪（つぎにくぐる輪のまわりで回す）
  c.save(); c.translate(128, 384);
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, big = i % 4 === 0, r0 = big ? 104 : 109, r1 = 116; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.strokeStyle = `rgba(255,255,255,${big ? 0.95 : 0.5})`; c.lineWidth = big ? 2.6 : 1.6; c.lineCap = 'round'; c.stroke(); }
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, 122, i * TAU / 3 + 0.2, i * TAU / 3 + 1.6); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.6; c.stroke(); }
  c.restore();
  // 光の粒（まるいにじみ）
  { const g = c.createRadialGradient(320, 64, 0, 320, 64, 64); for (let i = 0; i <= 10; i++) { const u = i / 10; g.addColorStop(u, `rgba(255,255,255,${Math.pow(1 - u, 2.4)})`); } c.fillStyle = g; c.fillRect(256, 0, 128, 128); }
  // きらめき（十字の光）
  c.save(); c.translate(448, 64);
  { const g = c.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(-64, -64, 128, 128); }
  for (const [len, wid] of [[60, 5], [60, 5]]) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(-len, 0); c.quadraticCurveTo(0, wid, len, 0); c.quadraticCurveTo(0, -wid, -len, 0); c.fillStyle = 'rgba(255,255,255,0.95)'; c.fill(); }
  c.restore();
  // 筋（横に長い光。軌跡と風に使う）
  { const g = c.createLinearGradient(0, 128, 0, 160); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(256, 128, 256, 32); }
  // 光の柱（下が明るく、上へ消える）
  { const id = c.getImageData(256, 176, 64, 256), d = id.data;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) { const u = (x - 31.5) / 31.5, v = 1 - y / 255, a = Math.exp(-u * u * 5.5) * Math.pow(1 - v, 1.6) * Math.min(1, v * 14 + 0.25); const o = (y * 64 + x) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.round(255 * a); }
    c.putImageData(id, 256, 176); }
  c.fillStyle = '#fff'; c.fillRect(336, 176, 16, 16);
  // しぶき（やわらかい丸をいくつか）
  c.save(); c.translate(448, 240);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 10 + (i * 37 % 30), x = Math.cos(a) * r, y = Math.sin(a) * r, s = 12 + (i * 53 % 14); const g = c.createRadialGradient(x, y, 0, x, y, s); g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x - s, y - s, s * 2, s * 2); }
  c.restore();
  return cv;
}

// 12 の紋章（4×3、1 つ 256²）。暗い空に置くので、線の色は「暗い地」用の配色
export const MARK_R = 88 / 128;            // 紋章の単位円が、ますの半分に占める割合
export function markUV(i) { return rect((i % 4) * 256, Math.floor(i / 4) * 256, 256, 256, 1024, 768); }
export function marksAtlas() {
  const cv = mk(1024, 768), c = cv.getContext('2d');
  const small = mk(64, 64), s = small.getContext('2d');
  MARKS.forEach((m, i) => {
    const cx = (i % 4) * 256 + 128, cy = Math.floor(i / 4) * 256 + 128;
    // にじみ: 小さく描いたものを拡大して重ねる（ぼかしフィルタの無い環境でも同じ見た目になる）
    s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, 64, 64); s.setTransform(22, 0, 0, 22, 32, 32); drawMark(s, m, { mode: 'dark', wk: 1.5 });
    c.save(); c.globalAlpha = 0.55; c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(small, cx - 128, cy - 128, 256, 256); c.globalAlpha = 0.3; c.drawImage(small, cx - 140, cy - 140, 280, 280); c.restore();
    c.save(); c.translate(cx, cy); c.scale(88, 88); drawMark(c, m, { mode: 'dark' }); c.restore();
  });
  return cv;
}
// HUD の小さな紋章
export function markIcon(cv, id, on = true) {
  const m = MARKS.find((k) => k.id === id), c = cv.getContext('2d'), n = cv.width;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, n, n);
  c.save(); c.translate(n / 2, n / 2); c.scale(n * 0.42, n * 0.42); c.globalAlpha = on ? 1 : 0.32; drawMark(c, m, { mode: on ? 'dark' : 'white', wk: 1.35 }); c.restore();
}
export { MARKS };
