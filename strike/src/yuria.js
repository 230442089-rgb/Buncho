// yuria.js — ユリアの戦闘形態（いただいた絵をもとにしたデフォルメ）。
//   白い髪と黄色の毛先、黄色い角の髪飾り、機械の翼（黒い軸・白い装甲の羽・黄色い光の膜・水色の灯）、白と黄と黒の装甲、長い槍。
//   頭の中心が原点・頭の半径が 1。顔と髪は 4 本目の絵（chase/src/chibi.js）をそのまま使う。
import { drawHead, lock, group, capsule, strokeLine as S, fillShape as F, fillStroke as FS, COLORS, STYLE } from '../../chase/src/chibi.js';

const TAU = Math.PI * 2;
const HAIR = '#ffffff', BACK = '#f2eff9', YEL = '#ffd23c', YEL_D = '#f0a800', BLK = '#2b2a33', ARM = '#ffffff', ARM_SH = '#dde2ee', CYAN = '#54e6e2', SKIN = COLORS.SKIN, LINE = '#6b4f5e';
const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };

// ---- 機械の翼ひとつ。軸（hx, hy）から、羽を扇のように広げる。blades: [[向き（度。0 = 右、90 = 下）, 長さ, 幅], …]
function wing(c, hx, hy, side, blades, o = {}) {
  const k = o.spread ?? 1, glow = o.glow ?? 1, flap = o.flap || 0, hub = o.hub ?? 0.2;
  const tip = blades.map(([a, len]) => { const r = (a + flap) * Math.PI / 180; return [hx + side * Math.cos(r) * len * k, hy + Math.sin(r) * len * k]; });
  // 光の膜（羽のあいだに張る、黄色い半透明の面）
  c.save(); c.globalAlpha = 0.55 * glow;
  c.beginPath(); c.moveTo(hx, hy); for (const [a, len] of blades) { const r = (a + flap) * Math.PI / 180; c.lineTo(hx + side * Math.cos(r) * len * k * 0.86, hy + Math.sin(r) * len * k * 0.86); } c.closePath();
  const g = c.createRadialGradient(hx, hy, 0.1, hx, hy, 2.4 * k); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.6, '#ffd43a'); g.addColorStop(1, '#ffb400'); c.fillStyle = g; c.fill();
  c.globalAlpha = 0.5 * glow; c.strokeStyle = '#fff6c8'; c.lineWidth = 0.02;
  for (let q = 0.3; q < 1; q += 0.2) { c.beginPath(); blades.forEach(([a, len], i) => { const r = (a + flap) * Math.PI / 180, x = hx + side * Math.cos(r) * len * k * q, y = hy + Math.sin(r) * len * k * q; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); }
  c.restore();
  // 装甲の羽（白い板、先は黄色、付け根は黒）
  blades.forEach(([a, len, w], i) => {
    const r = (a + flap) * Math.PI / 180, dx = side * Math.cos(r), dy = Math.sin(r), nx = -dy, ny = dx, L = len * k;
    const P = (u, v) => [hx + dx * L * u + nx * w * v, hy + dy * L * u + ny * w * v];
    poly(c, [P(0.10, 0.5), P(0.55, 0.62), P(1, 0), P(0.5, -0.5), P(0.10, -0.42)]); FS(c, ARM, 0.024);
    poly(c, [P(0.62, 0.52), P(1, 0), P(0.6, -0.42), P(0.72, 0.04)]); FS(c, YEL, 0.02);
    poly(c, [P(0.08, 0.5), P(0.3, 0.56), P(0.24, -0.46), P(0.08, -0.42)]); FS(c, BLK, 0.02);
    c.beginPath(); c.moveTo(...P(0.3, 0.05)); c.lineTo(...P(0.6, 0.05)); S(c, 0.02, CYAN);
  });
  // 軸（黒い輪に水色の灯）
  c.beginPath(); c.arc(hx, hy, hub, 0, TAU); FS(c, BLK, 0.026);
  c.beginPath(); c.arc(hx, hy, hub * 0.56, 0, TAU); S(c, 0.045, CYAN);
  c.beginPath(); c.arc(hx, hy, hub * 0.2, 0, TAU); F(c, '#d8fffb');
  return tip;
}
// 槍。a（石突き）→ b（穂先）。穂は白・黄・黒の刃に水色の光の筋。k: 太さの倍率（奥へ向けるときは先を細く）
function lance(c, a, b, o = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux, k0 = o.k0 ?? 1, k1 = o.k1 ?? 1;
  const P = (u, v) => { const k = k0 + (k1 - k0) * u; return [a[0] + ux * L * u + nx * v * k, a[1] + uy * L * u + ny * v * k]; };
  // 柄
  poly(c, [P(0.0, 0.045), P(0.62, 0.04), P(0.62, -0.04), P(0.0, -0.045)]); FS(c, BLK, 0.02);
  // 石突きのつば（三つ又）
  for (const v of [-1, 0, 1]) { poly(c, [P(0.06, v * 0.10 - 0.035), P(-0.07, v * 0.19), P(0.06, v * 0.10 + 0.035)]); FS(c, v ? YEL : ARM, 0.018); }
  poly(c, [P(0.05, 0.16), P(0.10, 0.16), P(0.10, -0.16), P(0.05, -0.16)]); FS(c, BLK, 0.018);
  // 穂: 付け根のつば → 幅のある刃 → 先
  poly(c, [P(0.56, 0.20), P(0.64, 0.26), P(0.70, 0.10), P(0.70, -0.10), P(0.64, -0.26), P(0.56, -0.20)]); FS(c, YEL, 0.02);
  poly(c, [P(0.62, 0.13), P(0.78, 0.20), P(1.0, 0), P(0.78, -0.20), P(0.62, -0.13)]); FS(c, ARM, 0.022);
  poly(c, [P(0.66, 0.06), P(0.80, 0.11), P(0.97, 0), P(0.80, -0.11), P(0.66, -0.06)]); FS(c, YEL, 0.016);
  poly(c, [P(0.63, 0.035), P(0.84, 0.045), P(0.84, -0.045), P(0.63, -0.035)]); F(c, BLK);
  c.beginPath(); c.moveTo(...P(0.65, 0)); c.lineTo(...P(0.83, 0)); S(c, 0.022, CYAN);
  if (o.glow) { c.save(); c.globalAlpha = 0.7 * o.glow; const t = P(1, 0), g = c.createRadialGradient(t[0], t[1], 0, t[0], t[1], 0.6); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.4, 'rgba(255,214,64,.7)'); g.addColorStop(1, 'rgba(255,214,64,0)'); c.fillStyle = g; c.fillRect(t[0] - 0.6, t[1] - 0.6, 1.2, 1.2); c.restore(); }
  return P(1, 0);
}
// 黄色い角の髪飾り
function horn(c, x0, y0, x1, y1, w) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w;
  poly(c, [[x0 + nx, y0 + ny], [x1, y1], [x0 - nx, y0 - ny], [x0 - dx * 0.08, y0 - dy * 0.08]]); FS(c, YEL, 0.022);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + dx * 0.7, y0 + dy * 0.7); S(c, 0.016, YEL_D);
}
const boot = (c, kx, ky, ax, ay, s) => {      // ひざ（kx, ky）から足首（ax, ay）へ。白い装甲に黄色いひざ当てと羽
  group(c, ARM, [capsule(c, kx, ky, ax, ay, 0.21, 0.16)]);
  poly(c, [[kx + s * 0.2, ky + 0.02], [kx + s * 0.44, ky + 0.42], [kx + s * 0.17, ky + 0.36]]); FS(c, YEL, 0.02);
  poly(c, [[kx - 0.13, ky - 0.2], [kx + 0.13, ky - 0.2], [kx + 0.09, ky + 0.12], [kx, ky + 0.22], [kx - 0.09, ky + 0.12]]); FS(c, YEL, 0.02);
  c.beginPath(); c.moveTo(ax - 0.15, ay - 0.1); c.lineTo(ax + 0.15, ay - 0.1); S(c, 0.05, BLK);
  poly(c, [[ax - 0.19, ay + 0.0], [ax + 0.19, ay + 0.0], [ax + 0.2, ay + 0.17], [ax, ay + 0.3], [ax - 0.2, ay + 0.17]]); FS(c, ARM, 0.022);
  poly(c, [[ax - 0.08, ay + 0.1], [ax + 0.08, ay + 0.1], [ax, ay + 0.26]]); F(c, YEL);
};

// ============================================================ 後ろ姿（ゲーム中）
//   o: { t, sway: 左右へ動いているぶんの傾き -1..1, power: 0..1（槍を放つとき翼が広がる）, hurt: 0..1 }
export function drawBattleBack(c, o = {}) {
  const t = o.t || 0, sw = o.sway || 0, pw = o.power || 0, w = (k, ph = 0) => Math.sin(t * k + ph);
  // ---- 槍（右手に持って、前へ向ける。画面では上の奥へのびる）
  const tip = lance(c, [1.48 + sw * 0.1, 1.92], [1.02 + sw * 0.25, -2.5], { k0: 1.15, k1: 0.6, glow: 0.5 + pw });
  // ---- 脚（後ろへ流れる）
  for (const s of [-1, 1]) {
    const k = s * w(5.2) * 0.05, hx = 0.22 * s, kx = 0.25 * s - sw * 0.06, ky = 2.38, ax = 0.27 * s - sw * 0.12, ay = 2.86 + k;
    group(c, SKIN, [capsule(c, hx, 1.95, kx, ky, 0.19, 0.17)]);
    boot(c, kx, ky, ax, ay, s);
    // 足もとの噴射
    c.save(); c.globalAlpha = 0.75; const g = c.createRadialGradient(ax, ay + 0.34, 0, ax, ay + 0.34, 0.3 + 0.05 * w(22, s)); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, 'rgba(120,240,236,.8)'); g.addColorStop(1, 'rgba(120,240,236,0)'); c.fillStyle = g; c.fillRect(ax - 0.4, ay, 0.8, 0.8); c.restore();
  }
  // ---- 腰の刃（黄色）
  for (const s of [-1, 1]) { poly(c, [[0.42 * s, 1.72], [0.66 * s, 1.74], [(1.0 + 0.05 * w(6, s)) * s - sw * 0.1, 2.5], [0.5 * s, 2.14]]); FS(c, YEL, 0.024); poly(c, [[0.5 * s, 1.84], [0.62 * s, 1.86], [0.86 * s - sw * 0.08, 2.36], [0.56 * s, 2.1]]); F(c, ARM); c.beginPath(); c.arc(0.52 * s, 1.76, 0.085, 0, TAU); FS(c, BLK, 0.02); }
  // ---- 背中（白い装甲。まん中に黒い背骨と黄色の線）
  c.beginPath(); c.moveTo(-0.46, 1.02); c.bezierCurveTo(-0.58, 1.3, -0.52, 1.62, -0.42, 1.92); c.quadraticCurveTo(0, 2.16, 0.42, 1.92); c.bezierCurveTo(0.52, 1.62, 0.58, 1.3, 0.46, 1.02); c.closePath(); FS(c, ARM, 0.026);
  poly(c, [[-0.1, 1.06], [0.1, 1.06], [0.07, 1.98], [0, 2.05], [-0.07, 1.98]]); F(c, BLK);
  c.beginPath(); c.moveTo(-0.38, 1.5); c.lineTo(-0.12, 1.66); c.moveTo(0.38, 1.5); c.lineTo(0.12, 1.66); S(c, 0.03, YEL);
  // ---- 腕（大きな白い袖。右手は槍を握る）
  for (const s of [-1, 1]) {
    const hx = s > 0 ? 1.42 + sw * 0.1 : -1.42 + sw * 0.06, hy = s > 0 ? 1.74 : 1.5 + 0.05 * w(3.1) + 0.25 * pw;
    group(c, SKIN, [capsule(c, 0.5 * s, 1.18, 0.74 * s, 1.3, 0.13, 0.12)]);
    group(c, ARM, [capsule(c, 0.74 * s, 1.3, hx, hy, 0.2, 0.3), () => c.ellipse(hx, hy, 0.31, 0.28, 0, 0, TAU)]);
    const dx = hx - 0.74 * s, dy = hy - 1.3, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    c.beginPath(); c.moveTo(0.74 * s + dx * 0.12 + nx * 0.2, 1.3 + dy * 0.12 + ny * 0.2); c.lineTo(0.74 * s + dx * 0.12 - nx * 0.2, 1.3 + dy * 0.12 - ny * 0.2); S(c, 0.07, YEL);
    c.beginPath(); c.moveTo(hx + nx * 0.29, hy + ny * 0.29); c.lineTo(hx - nx * 0.29, hy - ny * 0.29); S(c, 0.06, BLK);
    c.beginPath(); c.arc(hx + dx / L * 0.24, hy + dy / L * 0.24, 0.12, 0, TAU); FS(c, ARM, 0.02);
  }
  // ---- 長い後ろ髪（白 → 黄。背中いっぱいに流れる）
  const fl = 0.8 + 0.4 * pw;
  for (const [x0, tx, ty, wd, b1, b2, ph] of [[-0.85, -1.5, 2.3, 0.62, -0.12, 0.16, 0.0], [0.85, 1.5, 2.3, 0.62, 0.12, -0.16, 1.3], [-0.5, -0.95, 2.9, 0.6, -0.08, 0.12, 2.1], [0.5, 0.95, 2.9, 0.6, 0.08, -0.12, 3.4], [-0.15, -0.3, 3.15, 0.6, -0.04, 0.06, 4.0], [0.2, 0.36, 3.1, 0.6, 0.04, -0.06, 4.9]]) {
    const a = 0.12 * fl * w(5.6, ph), b = 0.08 * fl * w(7.9, ph * 1.7);
    lock(c, x0, 0.2, tx - sw * 0.6 + a, ty + b, wd, b1 + sw * 0.1 + 0.5 * a, b2 - 0.6 * a, [BACK, YEL, 0.42], 0.024, 0.3);
  }
  // ---- 翼（上の大きな一対と、下の小さな一対）
  const flap = 4 * w(3.4) - 14 * pw, spread = 1 + 0.16 * pw;
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(0.3 * s, 1.25); c.lineTo(1.2 * s, 0.82); c.moveTo(0.3 * s, 1.5); c.lineTo(1.0 * s, 1.74); S(c, 0.09, BLK);
    wing(c, 1.0 * s, 1.74, s, [[18, 1.25, 0.26], [44, 1.45, 0.28], [70, 1.2, 0.24]], { flap: -flap * 0.6 + sw * 6 * s, spread, glow: 0.8 + 0.4 * pw, hub: 0.17 });
    wing(c, 1.2 * s, 0.82, s, [[-64, 2.15, 0.3], [-42, 2.5, 0.34], [-20, 2.35, 0.34], [2, 1.95, 0.3], [22, 1.5, 0.26]], { flap: flap + sw * 7 * s, spread, glow: 0.8 + 0.5 * pw });
  }
  // ---- 後ろ頭
  c.beginPath(); c.moveTo(0, -1.22); c.bezierCurveTo(0.7, -1.24, 1.18, -0.8, 1.18, -0.1); c.bezierCurveTo(1.2, 0.3, 1.1, 0.6, 0.9, 0.8); c.lineTo(-0.9, 0.8); c.bezierCurveTo(-1.1, 0.6, -1.2, 0.3, -1.18, -0.1); c.bezierCurveTo(-1.18, -0.8, -0.7, -1.24, 0, -1.22); c.closePath();
  { const g = c.createLinearGradient(0, -1.2, 0, 0.9); g.addColorStop(0, HAIR); g.addColorStop(0.62, HAIR); g.addColorStop(1, BACK); c.fillStyle = g; c.fill(); }
  c.beginPath(); c.moveTo(0.98, 0.72); c.bezierCurveTo(1.14, 0.5, 1.2, 0.3, 1.18, -0.1); c.bezierCurveTo(1.18, -0.8, 0.7, -1.24, 0, -1.22); c.bezierCurveTo(-0.7, -1.24, -1.18, -0.8, -1.18, -0.1); c.bezierCurveTo(-1.2, 0.3, -1.14, 0.5, -0.98, 0.72); S(c, 0.026);
  for (const [x1, yc, x2, y2] of [[-0.62, -0.5, -0.74, 0.5], [-0.26, -0.4, -0.32, 0.66], [0.2, -0.4, 0.24, 0.7], [0.6, -0.5, 0.7, 0.5]]) { c.beginPath(); c.moveTo(x1 * 0.3 + 0.08, -1.02); c.quadraticCurveTo(x1, yc, x2, y2); S(c, 0.014, '#d6cde2'); }
  // サイドの結び髪（後ろから見ると左）と、角の髪飾り
  { const rx = -1.0, ry = -0.8;
    for (const [tx, ty, wd, b1, b2, ph] of [[-1.3, 1.5, 0.36, -0.22, 0.2, 0.3], [-1.7, 1.2, 0.42, -0.3, 0.22, 1.7], [-2.0, 0.7, 0.42, -0.34, 0.16, 2.9]]) { const a = 0.12 * fl * w(6.8, ph); lock(c, rx - 0.1, ry + 0.1, tx - sw * 0.4 + a, ty + 0.08 * w(9, ph), wd, b1 + a * 0.5, b2, [HAIR, YEL, 0.4], 0.024, -0.35); }
    horn(c, rx - 0.02, ry - 0.08, rx - 0.5, ry - 1.3, 0.13); horn(c, rx + 0.16, ry - 0.14, rx + 0.3, ry - 1.0, 0.1);
    c.beginPath(); c.arc(rx - 0.02, ry, 0.19, 0, TAU); FS(c, BLK, 0.022); c.beginPath(); c.arc(rx - 0.02, ry, 0.08, 0, TAU); F(c, CYAN); }
  horn(c, 0.62, -1.0, 1.05, -2.0, 0.13);
  return tip;
}

// ============================================================ 正面（題・結果・ふり向いたとき）
//   o: { t, mood, wave }
const FACES = {
  smile: { eyes: 'open', mouth: { kind: 'open', h: 0.16, fang: true }, lid: 0.1 },
  grin: { eyes: 'open', mouth: { kind: 'open', h: 0.2, w: 0.17, fang: true }, lid: 0.05 },
  happy: { eyes: 'happy', mouth: { kind: 'open', h: 0.2, w: 0.17, fang: true }, blush: 1.2 },
  cool: { eyes: 'open', mouth: 'smile', lid: 0.28, browTilt: 0.22 },
  oops: { eyes: 'cross', mouth: 'wavy' },
  wow: { eyes: 'wide', mouth: 'small', dot: 0.05 },
  love: { eyes: 'heart', mouth: { kind: 'open', h: 0.16 }, blush: 1.5, lid: 0 },
  fierce: { eyes: 'open', mouth: { kind: 'open', h: 0.14, fang: true }, lid: 0.3, browTilt: 0.3 },
};
function headgear(c) {
  // 黄色い角（向かって右の結び目から 2 本、左の頭の上に 1 本）、結び目の黒い輪、ふたつめの髪留め
  horn(c, 1.02, -0.9, 1.5, -2.2, 0.14); horn(c, 0.86, -0.96, 0.72, -1.86, 0.1);
  horn(c, -0.62, -1.0, -1.08, -2.05, 0.13);
  c.beginPath(); c.arc(1.05, -0.8, 0.2, 0, TAU); FS(c, BLK, 0.022); c.beginPath(); c.arc(1.05, -0.8, 0.085, 0, TAU); F(c, CYAN);
  c.save(); c.translate(0.52, -0.62); c.rotate(0.3); c.beginPath(); c.moveTo(-0.16, 0); c.lineTo(0.16, 0); S(c, 0.06, '#2f2a33'); for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 0.09, -0.07); c.lineTo(i * 0.09, 0.07); S(c, 0.034, '#2f2a33'); } c.restore();
}
export function drawBattleFront(c, o = {}) {
  const t = o.t || 0, w = (k, ph = 0) => Math.sin(t * k + ph), wave = o.wave || 0;
  const face = { ...(FACES[o.mood] || FACES.smile), sway: 0.08 * w(1.7), lift: 0.3 };
  if (face.eyes === 'open' && (t % 3.7) < 0.12) face.eyes = 'shut';
  const flap = 4 * w(2.6);
  // ---- 翼（いちばん奥）
  for (const s of [-1, 1]) {
    c.beginPath(); c.moveTo(0.3 * s, 1.2); c.lineTo(1.5 * s, 0.5); c.moveTo(0.3 * s, 1.5); c.lineTo(1.25 * s, 1.8); S(c, 0.09, BLK);
    wing(c, 1.25 * s, 1.8, s, [[14, 1.25, 0.26], [40, 1.45, 0.28], [66, 1.2, 0.24]], { flap: -flap * 0.6, hub: 0.17 });
    wing(c, 1.5 * s, 0.5, s, [[-70, 2.0, 0.3], [-48, 2.4, 0.34], [-25, 2.3, 0.34], [-3, 1.9, 0.3], [18, 1.5, 0.26]], { flap });
  }
  // ---- 長い後ろ髪
  for (const [x0, tx, ty, wd, b1, b2, ph] of [[-0.8, -1.55, 2.5, 0.6, -0.14, 0.18, 0], [0.8, 1.55, 2.5, 0.6, 0.14, -0.18, 1.3], [-0.5, -1.05, 3.0, 0.56, -0.08, 0.12, 2.1], [0.5, 1.05, 3.0, 0.56, 0.08, -0.12, 3.4]]) lock(c, x0, 0.2, tx + 0.08 * w(2.2, ph), ty, wd, b1, b2, [BACK, YEL, 0.4], 0.024, 0.3);
  // ---- 脚
  for (const s of [-1, 1]) { const lift = 0.1 + 0.06 * w(1.9, s), hx = 0.25 * s, kx = 0.27 * s, ky = 2.42 - lift * 0.3, ax = 0.3 * s, ay = 2.92 - lift * 0.6; group(c, SKIN, [capsule(c, hx, 1.98, kx, ky, 0.2, 0.17)]); boot(c, kx, ky, ax, ay, s); }
  // ---- 腰の刃
  for (const s of [-1, 1]) { poly(c, [[0.4 * s, 1.72], [0.66 * s, 1.74], [1.02 * s, 2.52], [0.5 * s, 2.16]]); FS(c, YEL, 0.024); poly(c, [[0.5 * s, 1.84], [0.62 * s, 1.86], [0.88 * s, 2.38], [0.56 * s, 2.1]]); F(c, ARM); }
  // ---- 胴（白い装甲。黒いわき、黄色の線、胸もとに水色の石）
  c.beginPath(); c.moveTo(-0.46, 1.02); c.bezierCurveTo(-0.58, 1.3, -0.5, 1.62, -0.42, 1.9); c.quadraticCurveTo(-0.2, 2.02, 0, 2.2); c.quadraticCurveTo(0.2, 2.02, 0.42, 1.9); c.bezierCurveTo(0.5, 1.62, 0.58, 1.3, 0.46, 1.02); c.closePath(); FS(c, ARM, 0.026);
  for (const s of [-1, 1]) { poly(c, [[0.5 * s, 1.2], [0.36 * s, 1.5], [0.4 * s, 1.88], [0.47 * s, 1.74], [0.54 * s, 1.4]]); F(c, BLK); c.beginPath(); c.arc(0.48 * s, 1.78, 0.085, 0, TAU); FS(c, BLK, 0.02); }
  c.beginPath(); c.moveTo(-0.3, 1.5); c.lineTo(0, 1.68); c.lineTo(0.3, 1.5); S(c, 0.035, YEL);
  c.beginPath(); c.moveTo(-0.3, 1.02); c.quadraticCurveTo(0, 1.22, 0.3, 1.02); S(c, 0.07, BLK);
  poly(c, [[0, 1.12], [0.09, 1.24], [0, 1.38], [-0.09, 1.24]]); FS(c, CYAN, 0.018);
  // ---- 槍（向かって左の手に、穂先を上にして持つ）
  lance(c, [-1.42, 3.3], [-1.5, -2.5], { glow: 0.5 });
  // ---- 腕（大きな袖と白い手袋）
  const arm = (s, hx, hy, ex, ey) => {
    group(c, SKIN, [capsule(c, 0.5 * s, 1.18, ex, ey, 0.13, 0.12)]);
    group(c, ARM, [capsule(c, ex, ey, hx, hy, 0.2, 0.3), () => c.ellipse(hx, hy, 0.31, 0.28, 0, 0, TAU)]);
    const dx = hx - ex, dy = hy - ey, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    c.beginPath(); c.moveTo(ex + dx * 0.1 + nx * 0.2, ey + dy * 0.1 + ny * 0.2); c.lineTo(ex + dx * 0.1 - nx * 0.2, ey + dy * 0.1 - ny * 0.2); S(c, 0.07, YEL);
    c.beginPath(); c.moveTo(hx + nx * 0.29, hy + ny * 0.29); c.lineTo(hx - nx * 0.29, hy - ny * 0.29); S(c, 0.06, BLK);
    c.beginPath(); c.arc(hx + dx / L * 0.25, hy + dy / L * 0.25, 0.13, 0, TAU); FS(c, ARM, 0.02);
  };
  arm(-1, -1.3, 1.62, -0.78, 1.3);
  if (wave) arm(1, 1.4 + 0.12 * w(9), 0.5, 0.86, 1.2); else arm(1, 1.28, 1.7 + 0.04 * w(2.3), 0.8, 1.3);
  // ---- 頭（4 本目と同じ顔と髪）と髪飾り
  c.save(); c.rotate(0.04 * w(1.3)); drawHead(c, 'yuria', face); headgear(c); c.restore();
}
export function drawBattleFace(c, mood = 'smile', t = 0) {
  const face = { ...(FACES[mood] || FACES.smile), sway: 0.06 * Math.sin(t * 1.9) };
  if (face.eyes === 'open' && (t % 3.7) < 0.12) face.eyes = 'shut';
  drawHead(c, 'yuria', face); headgear(c);
}

// 3D の画面に置く 1 枚絵。絵の中心は胸のあたり
export const SPRITE_SPAN = 7.6, SPRITE_PIVOT_Y = 0.75;
export class BattleSprite {
  constructor(size = 512) { this.size = size; this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = size; this.c = this.cv.getContext('2d'); this.tip = [1, -2.5]; }
  draw(o) {
    const c = this.c, n = this.size, k = n / SPRITE_SPAN, turn = o.turn || 0, sx = Math.cos(turn * Math.PI);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, n, n);
    c.setTransform(k, 0, 0, k, n / 2, n / 2 - SPRITE_PIVOT_Y * k);
    STYLE.lw = 1.7;
    if (sx >= 0) this.tip = drawBattleBack(c, o); else drawBattleFront(c, o);
    STYLE.lw = 1;
    return Math.max(0.04, Math.abs(sx));
  }
}
