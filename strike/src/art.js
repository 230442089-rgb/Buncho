// art.js — 迎撃ゲームの「光と煙」の絵をまとめた 1 枚（2048×1024。使うのは右半分の 256² のます目）。
//   着弾の印・光の矢・火花・照準・煙・爆発・衝撃の輪・竜の部品。ユリア・文鳥・弾は 3D のモデルになった（strike/model/）。
import { dragonHead, dragonWing, dragonBody, dragonHalo } from './dragon.js';

const TAU = Math.PI * 2, AW = 2048, AH = 1024;
const rect = (x, y, w, h) => [(x + 0.5) / AW, (y + 0.5) / AH, (x + w - 0.5) / AW, (y + h - 0.5) / AH];
const cell = (i, j) => rect(1024 + i * 256, j * 256, 256, 256);
const sub = (k) => rect(1024 + (k % 4) * 64, 512 + Math.floor(k / 4) * 64, 64, 64);
export const A = {
  mark: cell(3, 1),
  bolt: sub(3), hit: sub(6), aim: sub(7), smoke: sub(8), fire: sub(9), wave: sub(10), core: sub(11),
  boom: cell(1, 2), smokeBig: cell(2, 2), shock: cell(3, 2),
  dHead: cell(0, 3), dWing: cell(1, 3), dBody: cell(2, 3), dHalo: cell(3, 3),
};

export function strikeAtlas() {
  const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH; const c = cv.getContext('2d');
  const at = (x, y, w, span, oy, fn, ox = 0) => { c.save(); c.beginPath(); c.rect(x, y, w, w); c.clip(); const k = w / span; c.translate(x + w / 2 - ox * k, y + w / 2 - oy * k); c.scale(k, k); fn(); c.restore(); };
  // 着弾の予告（赤い破線の輪と十字。輪の半径は、ますの半分の 100/128）
  { c.save(); c.translate(1792 + 128, 256 + 128);
    for (const [w, a] of [[16, 0.16], [5.5, 1]]) { c.strokeStyle = `rgba(255,74,54,${a})`; c.lineWidth = w; c.setLineDash(a < 1 ? [] : [26, 13.27]); c.beginPath(); c.arc(0, 0, 100, 0, TAU); c.stroke(); }
    c.setLineDash([]); c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-22, 0); c.lineTo(22, 0); c.moveTo(0, -22); c.lineTo(0, 22); c.stroke();
    c.restore(); }
  // ---- 弾など（64² のます）
  const S64 = (k, fn) => { const x = 1024 + (k % 4) * 64 + 32, y = 512 + Math.floor(k / 4) * 64 + 32; c.save(); c.translate(x, y); fn(); c.restore(); };
  S64(3, () => { const g = c.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, 'rgba(255,220,90,0)'); g.addColorStop(0.2, '#ffd23c'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(0.8, '#ffd23c'); g.addColorStop(1, 'rgba(255,220,90,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 9, 30, 0, 0, TAU); c.fill(); c.fillStyle = '#fffbe6'; c.beginPath(); c.ellipse(0, 0, 3.5, 22, 0, 0, TAU); c.fill(); });   // ユリアの光の矢
  S64(6, () => { c.fillStyle = '#fff6d0'; for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-28, 0); c.quadraticCurveTo(0, 5, 28, 0); c.quadraticCurveTo(0, -5, -28, 0); c.fill(); } const g = c.createRadialGradient(0, 0, 0, 0, 0, 14); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = g; c.fillRect(-16, -16, 32, 32); });
  S64(7, () => { c.strokeStyle = '#ffd23c'; c.lineWidth = 2.6; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.stroke(); c.lineWidth = 3; for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(16, 0); c.lineTo(29, 0); c.stroke(); } c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 2.4, 0, TAU); c.fill(); });      // 照準
  const puff = (c0, c1) => () => { for (let i = 0; i < 7; i++) { const a = i * 2.4, r = i ? 9 + (i * 37 % 8) : 0, x = Math.cos(a) * r, y = Math.sin(a) * r, s = 13 + (i * 53 % 7); const g = c.createRadialGradient(x, y, 0, x, y, s); g.addColorStop(0, c0); g.addColorStop(1, c1); c.fillStyle = g; c.fillRect(x - s, y - s, s * 2, s * 2); } };
  S64(8, puff('rgba(60,58,66,.85)', 'rgba(60,58,66,0)'));
  S64(9, puff('rgba(255,236,170,.95)', 'rgba(255,120,30,0)'));
  S64(10, () => { for (const [w, a] of [[11, 0.12], [6, 0.35], [2.6, 1]]) { c.strokeStyle = `rgba(255,226,120,${a})`; c.lineWidth = w; c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.stroke(); } });
  S64(11, () => { const g = c.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, '#fff'); g.addColorStop(0.3, 'rgba(120,255,250,.9)'); g.addColorStop(1, 'rgba(120,255,250,0)'); c.fillStyle = g; c.fillRect(-32, -32, 64, 64); });
  // ---- 爆発・煙・衝撃の輪（256²）
  { const x = 1280 + 128, y = 512 + 128; c.save(); c.translate(x, y);
    for (let i = 0; i < 11; i++) { const a = i * 2.39, r = i ? 34 + (i * 29 % 30) : 0, px = Math.cos(a) * r, py = Math.sin(a) * r, s = i ? 44 + (i * 17 % 22) : 78; const g = c.createRadialGradient(px, py, 0, px, py, s); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.35, 'rgba(255,214,90,.95)'); g.addColorStop(0.7, 'rgba(255,110,30,.75)'); g.addColorStop(1, 'rgba(160,20,10,0)'); c.fillStyle = g; c.fillRect(px - s, py - s, s * 2, s * 2); }
    c.restore(); }
  { const x = 1536 + 128, y = 512 + 128; c.save(); c.translate(x, y);
    for (let i = 0; i < 12; i++) { const a = i * 2.39, r = i ? 30 + (i * 31 % 36) : 0, px = Math.cos(a) * r, py = Math.sin(a) * r, s = 40 + (i * 19 % 26); const g = c.createRadialGradient(px, py, 0, px, py, s); g.addColorStop(0, 'rgba(70,66,76,.8)'); g.addColorStop(0.6, 'rgba(50,48,56,.5)'); g.addColorStop(1, 'rgba(40,38,46,0)'); c.fillStyle = g; c.fillRect(px - s, py - s, s * 2, s * 2); }
    c.restore(); }
  { const x = 1792 + 128, y = 512 + 128; c.save(); c.translate(x, y); for (const [w, a] of [[26, 0.06], [14, 0.14], [6, 0.4], [2.4, 1]]) { c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = w; c.beginPath(); c.arc(0, 0, 104, 0, TAU); c.stroke(); } c.restore(); }
  // ---- 竜（決め技）
  at(1024, 768, 256, 4.0, 0, () => dragonHead(c));
  at(1280, 768, 256, 2.8, -0.68, () => dragonWing(c), 0.8);
  c.save(); c.translate(1536, 768); dragonBody(c, 256); c.restore();
  at(1792, 768, 256, 4.0, 0, () => dragonHalo(c));
  return cv;
}
