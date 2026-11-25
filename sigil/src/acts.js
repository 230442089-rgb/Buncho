// acts.js — ひとりずつの動き。どれも記号の座標（半径 1、中心が原点）で、時刻 t（0〜8 秒）だけから描く。
//   0〜2.6 秒: その人の原理を、記号と同じ部品で動かす。2.6〜4 秒: 記号に組み上がる。4 秒〜: 名前の横で、静かに動きつづける。
import { sat, lerp, ease, TAU, pulse, hash1, noise1, smoothstep as sm } from './core.js';
import { drawMark, drawPart } from './draw.js';
import { ring, dot, seg, poly, K } from './fx.js';
import { trace } from './geom.js';

const WHITE = '#ffffff';

// ---------------------------------------------------------------- ユリア: 飛びかう粒が、波に触れたところで止まる。光の槍が貫く
function yuria(L, t, m, e) {
  const col = m.col.main, vw = 3.3, fade = 1 - sm(2.7, 3.7, t);
  for (let i = 0; i < 84; i++) {
    const a0 = hash1(i * 9.9) * TAU, r0 = 0.5 + 3.9 * hash1(i * 7.3), a = hash1(i * 3.7) * TAU, sp = 0.8 + 1.9 * hash1(i * 5.1);
    const px = Math.cos(a0) * r0, py = Math.sin(a0) * r0 * 0.6, vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
    let th = 1.6; for (let k = 0; k < 5; k++) th = 1.0 + Math.hypot(px + vx * th, py + vy * th) / vw;       // 最初の波が届く時刻
    const tt = Math.min(t, th), x = px + vx * tt, y = py + vy * tt;
    const k = t < th ? 0 : pulse(t, th, 0.25);          // 止まった瞬間に光り、線のまま動かなくなる
    seg(L, x - vx * 0.13, y - vy * 0.13, x, y, 0.022 + 0.02 * k, t < th || k > 0.4 ? WHITE : col, t < th ? 0.75 * sm(0, 0.3, t) : (0.45 + 0.55 * k) * fade);
    if (k > 0.05) dot(L, x, y, 0.05 * k, WHITE, k);
  }
  for (const w0 of [1.0, 1.5, 2.0]) { const r = vw * (t - w0); if (r > 0) ring(L, 0, 0, r, 0.055, col, 0.95 * sat(1 - r / 5.4)); }
  const sp = K(t, 2.85, 3.2); if (sp > 0 && t < 3.7) seg(L, 0, -6, 0, lerp(-6, 1.0, ease.inCubic(sp)), 0.06, WHITE, 1 - K(t, 3.2, 3.7));           // 上から走る光
  drawMark(L, m, { k: K(t, 2.6, 4.0), pal: e.pal });
  if (t > 4) { const ph = ((t - 4) / 2) % 1; ring(L, 0, 0, 1.05 + ph * 1.9, 0.018, col, 0.55 * (1 - ph) ** 2); const g = 0.5 + 0.5 * Math.sin((t - 4) * 3.1); poly(L, [[0, -0.16], [0.088, 0], [0, 0.16], [-0.088, 0]], WHITE, 0.35 * g); }
}


// ---------------------------------------------------------------- ヴォル: かたちを変えつづける輪郭が、巻きひげのハートに落ち着く。竜眼がのぞく
let volC = null;
function volShape(m) {
  if (volC) return volC;
  const half = (id) => { const p = m.part(id).paths[0], q = p.p; let top = false, cut = q.length - 1; for (let i = 1; i < q.length; i++) { if (q[i][1] < -0.6) top = true; if (top && Math.abs(q[i][0]) < 0.02 && q[i][1] > -0.5) { cut = i; break; } } return { pts: q.slice(0, cut + 1), u: p.acc[cut] / p.length }; };
  const a = half('left'), b = half('right'), ring = a.pts.concat(b.pts.slice(1, -1).reverse()), N = 220, out = [];
  let len = 0; const acc = [0]; for (let i = 1; i <= ring.length; i++) { const p0 = ring[i - 1], p1 = ring[i % ring.length]; len += Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); acc.push(len); }
  for (let i = 0, j = 0; i < N; i++) { const d = i / N * len; while (acc[j + 1] < d) j++; const k = (d - acc[j]) / (acc[j + 1] - acc[j] || 1), p0 = ring[j], p1 = ring[(j + 1) % ring.length]; out.push([lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k)]); }
  return (volC = { heart: out, uL: a.u, uR: b.u, N });
}
const win = (t, a, b, c, d) => Math.min(sm(a, b, t), 1 - sm(c, d, t));
function vol(L, t, m, e) {
  const col = m.col.main, S = volShape(m), N = S.N, grow = ease.outBack(K(t, 0.05, 0.55), 1.4), morph = ease.inOutCubic(K(t, 2.45, 3.25));
  if (t < 3.25) {
    const tri = win(t, 0.5, 0.75, 1.0, 1.25), sq = win(t, 1.0, 1.25, 1.5, 1.75), st = win(t, 1.5, 1.75, 2.0, 2.3);
    L.beginPath();
    for (let i = 0; i <= N; i++) {
      const th = Math.PI / 2 + (i % N) / N * TAU, r = 0.7 * grow * (1 + 0.2 * tri * Math.cos(3 * (th - Math.PI / 2)) + 0.13 * sq * Math.cos(4 * th) + 0.22 * st * Math.cos(5 * (th - Math.PI / 2)) + 0.035 * Math.sin(2 * th + t * 4) + 0.02 * Math.sin(7 * th - t * 6));
      const h = S.heart[i % N], x = lerp(Math.cos(th) * r, h[0], morph), y = lerp(Math.sin(th) * r - 0.05, h[1], morph); i ? L.lineTo(x, y) : L.moveTo(x, y);
    }
    L.closePath(); L.lineWidth = 0.085; L.strokeStyle = col; L.stroke();
    for (let i = 0; i < 3; i++) {            // 眷属: 切り離されて、まわりを回り、また戻る
      const out = ease.outCubic(K(t, 0.8 + 0.15 * i, 1.3 + 0.15 * i)) * (1 - ease.inCubic(K(t, 2.2 + 0.1 * i, 2.75 + 0.1 * i))); if (out <= 0.01) continue;
      for (let j = 0; j < 5; j++) { const a = i * 2.1 + (t - 0.05 * j) * 1.9, r = lerp(0.55, 1.5 + 0.12 * i, out); dot(L, Math.cos(a) * r, Math.sin(a) * r * 0.82, (0.075 - 0.012 * j) * sat(out * 2), j ? col : WHITE, 1 - j * 0.17); }
    }
  } else {
    const u = ease.inOutCubic(K(t, 3.25, 3.92));
    drawPart(L, m.part('left'), lerp(S.uL, 1, u), col); drawPart(L, m.part('right'), lerp(S.uR, 1, u), col);
    drawPart(L, m.part('dot'), ease.outBack(K(t, 3.8, 4.0)), col);
    const open = ease.outBack(K(t, 3.78, 4.0), 2.2), blink = 1 - 0.92 * (win(t, 5.3, 5.4, 5.42, 5.55) + win(t, 5.75, 5.83, 5.85, 5.95)), lookX = 0.03 * sm(6.1, 6.4, t);
    if (open > 0) { L.save(); L.translate(-0.4 + lookX, -0.24); L.scale(open, open * blink); L.beginPath(); L.ellipse(0, 0, 0.045, 0.092, 0, 0, TAU); L.fillStyle = WHITE; L.fill(); L.restore(); }
    if (t > 4) for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) { const a = i * Math.PI + (t - 0.07 * j) * 0.7, r = 1.42; dot(L, Math.cos(a) * r, Math.sin(a) * r * 0.9 + 0.1, 0.05 - 0.009 * j, col, 0.55 * sm(4.1, 4.8, t) * (1 - j * 0.2)); }
  }
}

// ---------------------------------------------------------------- ザイナ: 飛んでくるものを盾が受け、傷はふさがる。脈は仲間へ伝わる
const support = (path, a) => { let best = null, bv = -1e9; const cx = Math.cos(a), sy = Math.sin(a); for (const q of path.p) { const v = q[0] * cx + q[1] * sy; if (v > bv) { bv = v; best = q; } } return best; };
function zaina(L, t, m, e) {
  const col = m.col.main, sh = m.part('shield'), hits = [[1.25, -2.5], [1.75, -0.35], [2.25, 2.2]], nodes = [[-2.3, -0.4], [2.3, -0.4], [-1.9, 1.0], [1.9, 1.0]];
  let thick = 0; for (const [th] of hits) thick += pulse(t, th, 0.14);
  const beat = t > 4 ? pulse(((t - 4) % 1), 0, 0.12) : 0;
  const nk = sm(0.9, 1.2, t) * (1 - sm(2.9, 3.6, t));
  if (nk > 0) nodes.forEach(([nx, ny], j) => {            // 仲間（血肉共鳴でつながる先）
    const b = support(sh.paths[0], Math.atan2(ny, nx)); seg(L, b[0], b[1], nx, ny, 0.014, col, 0.3 * nk); let fl = 0;
    for (const [th] of hits) { const u = K(t, th + 0.03, th + 0.42); if (u > 0 && u < 1) dot(L, lerp(b[0], nx, u), lerp(b[1], ny, u), 0.045, WHITE, nk); fl += pulse(t, th + 0.42, 0.2); }
    ring(L, nx, ny, 0.1 + 0.05 * fl, 0.03, col, nk * (0.6 + 0.4 * sat(fl))); dot(L, nx, ny, 0.035 + 0.04 * sat(fl), fl > 0.3 ? WHITE : col, nk);
  });
  drawPart(L, sh, ease.inOutCubic(K(t, 0.15, 0.9)), col, 1 + 0.55 * sat(thick) + 0.1 * beat);
  for (const [th, a] of hits) {
    const b = support(sh.paths[0], a), dx = Math.cos(a), dy = Math.sin(a), tt = t - th;
    if (tt > -0.4 && tt < 0) { const d = -tt * 11; seg(L, b[0] + dx * (d + 0.7), b[1] + dy * (d + 0.7), b[0] + dx * d, b[1] + dy * d, 0.04, WHITE, 1); }       // 飛んでくるもの
    if (tt >= 0 && tt < 0.45) { const u = tt / 0.45; for (let i = 0; i < 7; i++) { const aa = a + (i - 3) * 0.36, r0 = 0.08 + 0.5 * ease.outCubic(u), r1 = r0 + 0.16 * (1 - u); seg(L, b[0] + Math.cos(aa) * r0, b[1] + Math.sin(aa) * r0, b[0] + Math.cos(aa) * r1, b[1] + Math.sin(aa) * r1, 0.024, WHITE, 1 - u); } ring(L, b[0], b[1], 0.1 + 0.3 * u, 0.03 * (1 - u), WHITE, 1 - u); }
    if (tt >= 0 && tt < 1.0) { L.save(); L.globalAlpha = (1 - tt) ** 1.5; L.beginPath(); L.moveTo(b[0], b[1]); for (let i = 1; i <= 4; i++) { const k = i / 4 * 0.42 * sat(tt * 9), nx = -dy, ny = dx, o = (hash1(i * 3.1 + th * 7) - 0.5) * 0.16; L.lineTo(b[0] - dx * k + nx * o, b[1] - dy * k + ny * o); } L.lineWidth = 0.026; L.strokeStyle = tt < 0.25 ? WHITE : m.col.accent[0]; L.stroke(); L.restore(); }   // ひび（すぐふさがる）
  }
  drawMark(L, m, { k: K(t, 2.6, 4.0), pal: e.pal, only: ['hornL', 'hornR', 'pulse'] });
  if (t > 4) { const u = ((t - 4) % 1) / 0.5, p = m.part('pulse').paths[0]; if (u < 1) { const q = p.at(u); dot(L, q[0], q[1], 0.06, WHITE, 0.9 * (1 - u * 0.5)); } }       // 脈
}

// ---------------------------------------------------------------- ルリカ: ばらばらの辺を、審理（走査）→ 判決（印）→ 執行（はめる）。あるべき規格へ
const RV = [-90, -30, 30, 90, 150, 210].map((a) => [Math.cos(a * Math.PI / 180) * 0.78, Math.sin(a * Math.PI / 180) * 0.78]);
const EDGES = [[RV[0], RV[1]], [RV[1], RV[2]], [RV[2], RV[3]], [RV[3], RV[4]], [RV[4], RV[5]], [RV[5], RV[0]], [[0, 0], RV[5]], [[0, 0], RV[1]], [[0, 0], RV[3]]];
function rurika(L, t, m, e) {
  const col = m.col.main, acc = m.col.accent[0];
  const ys = lerp(-1.7, 1.7, K(t, 0.45, 1.5)), scanA = win(t, 0.45, 0.6, 1.4, 1.55);
  if (scanA > 0) { seg(L, -4.6, ys, 4.6, ys, 0.014, acc, 0.9 * scanA); seg(L, -4.6, ys - 0.06, 4.6, ys - 0.06, 0.05, acc, 0.12 * scanA); }
  if (t < 3.0) EDGES.forEach(([a, b], i) => {
    const s0 = 2.0 + 0.105 * i, s = ease.outBack(K(t, s0, s0 + 0.3), 1.5), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, hx = (b[0] - a[0]) / 2, hy = (b[1] - a[1]) / 2;
    const ox = (hash1(i * 3.3 + 1) - 0.5) * 3.6, oy = (hash1(i * 5.7 + 2) - 0.5) * 2.0, r = ((hash1(i * 7.1) - 0.5) * 2.8 + 0.3 * Math.min(t, s0) * (i % 2 ? 1 : -1)) * (1 - s), jx = noise1(t * 9, i) * 0.02 * (1 - s), jy = noise1(t * 9, i + 20) * 0.02 * (1 - s);
    const cx = mx + ox * (1 - s) + jx, cy = my + oy * (1 - s) + jy, cr = Math.cos(r), sr = Math.sin(r), dx = hx * cr - hy * sr, dy = hx * sr + hy * cr, a0 = ease.outCubic(K(t, 0.1 + 0.03 * i, 0.5 + 0.03 * i));
    L.save(); L.lineCap = 'butt'; seg(L, cx - dx, cy - dy, cx + dx, cy + dy, 0.085, i < 6 ? col : WHITE, a0); L.restore();
    if (ys > my + oy && s < 0.5) { const k = pulse(t, 0.45 + (my + oy + 1.7) / 3.4 * 1.05, 0.3); L.save(); L.translate(cx, cy); L.strokeStyle = acc; L.lineWidth = 0.02 + 0.03 * k; L.globalAlpha = 0.85; L.strokeRect(-0.09 - 0.05 * k, -0.09 - 0.05 * k, 0.18 + 0.1 * k, 0.18 + 0.1 * k); L.restore(); }       // 判決の印
    const fl = pulse(t, s0 + 0.22, 0.12); if (t > s0 + 0.22 && fl > 0.05) ring(L, mx, my, 0.1 + 0.3 * (1 - fl), 0.02, WHITE, fl);
  });
  else drawMark(L, m, { pal: e.pal, only: ['hex', 'in0', 'in1', 'in2'] });
  const ck = ease.outCubic(K(t, 3.2, 3.95)); if (ck > 0) { L.save(); const s = lerp(1.7, 1, ck); L.scale(s, s); L.globalAlpha = ck; drawMark(L, m, { pal: e.pal, only: ['crop0', 'crop1', 'crop2', 'crop3'], wk: 1 / s }); L.restore(); }
  const g = pulse(t, 4, 0.5); if (t >= 4 && g > 0.02) { for (let x = -4.5; x <= 4.5; x += 0.5) seg(L, x, -2.6, x, 2.9, 0.008, acc, 0.3 * g); for (let y = -2.5; y <= 2.5; y += 0.5) seg(L, -4.6, y, 4.6, y, 0.008, acc, 0.3 * g); }
  if (t > 4) [[RV[0], RV[1], [0, 0], RV[5]], [[0, 0], RV[1], RV[2], RV[3]], [RV[5], [0, 0], RV[3], RV[4]]].forEach((f, i) => poly(L, f, i === 0 ? WHITE : acc, 0.05 + 0.1 * Math.max(0, Math.sin((t - 4) * 2.1 - i * 2.1)) ** 3));       // 面の明滅
}

// ---------------------------------------------------------------- ミリア: 軌跡に触れて、先へ跳ぶ。大鎌のひと振りで、ずらす
const MP0 = [0.36, -0.5], MP1 = [-0.56, 0.88], MJ = [0.44, -0.66], MD = [MP1[0] - MP0[0], MP1[1] - MP0[1]], ML = Math.hypot(MD[0], MD[1]), MN = [MD[1] / ML, -MD[0] / ML];
const MU = [0.1, 0.27, 0.44, 0.6, 0.77, 0.94];
function miria(L, t, m, e) {
  const col = m.col.main, acc = m.col.accent[0];
  const warp = (x) => x * 1.25 + 0.55 * sm(1.18, 1.24, x) + 0.65 * sm(1.98, 2.04, x), path = (q) => [1.95 * Math.sin(1.3 * q + 0.4), 1.02 * Math.sin(2.1 * q + 0.2) - 0.05];
  const fly = 1 - sm(2.45, 2.75, t);
  if (t < 2.8) {
    const q = warp(t), p = path(q), head = [lerp(MP1[0], p[0], fly), lerp(MP1[1], p[1], fly)], a0 = sm(0.05, 0.35, t);
    for (let j = 14; j >= 1; j--) { const pp = path(q - 0.075 * j); dot(L, pp[0], pp[1], 0.075 * (1 - j / 16), col, a0 * fly * (1 - j / 15) * 0.85); }        // 過去（通ってきた点）
    for (let j = 1; j <= 5; j++) { const pp = path(q + 0.1 * j); ring(L, pp[0], pp[1], 0.055, 0.02, acc, a0 * fly * (1 - j / 6) * 0.9); }                      // 未来（これから通る輪）
    for (const tj of [1.21, 2.01]) { const k = pulse(t, tj, 0.16); if (t >= tj && k > 0.03) { L.save(); L.globalAlpha = k; L.beginPath(); for (let i = 0; i <= 24; i++) { const pp = path(warp(tj - 0.04) + (warp(tj + 0.04) - warp(tj - 0.04)) * i / 24); i ? L.lineTo(pp[0], pp[1]) : L.moveTo(pp[0], pp[1]); } L.lineWidth = 0.035; L.strokeStyle = WHITE; L.stroke(); L.restore(); ring(L, p[0], p[1], 0.12 + 0.5 * (1 - k), 0.025, WHITE, k); } }   // 跳んだ跡
    dot(L, head[0], head[1], 0.085, WHITE, a0); ring(L, head[0], head[1], 0.15, 0.028, col, a0 * 0.9);
  }
  const run = K(t, 2.75, 3.3), cut = ease.outBack(K(t, 3.5, 3.72), 2.4);          // 柄を駆け上がる / ずらす
  if (t >= 2.75 && t < 3.34) { const x = lerp(MP1[0], MJ[0], ease.inOutCubic(run)), y = lerp(MP1[1], MJ[1], ease.inOutCubic(run)); dot(L, x, y, 0.09, WHITE); ring(L, x, y, 0.16, 0.028, col, 0.9); }
  MU.forEach((u, i) => { const seen = ease.outBack(K(ease.inOutCubic(run), 1 - u - 0.08, 1 - u + 0.06), 2.2); if (seen <= 0) return; const sh = i >= 3 ? 0.085 * cut : 0, r = lerp(0.078, 0.036, i / 5); dot(L, MP0[0] + MD[0] * u + MN[0] * sh, MP0[1] + MD[1] * u + MN[1] * sh, r * seen, col); });
  drawPart(L, m.part('joint'), ease.outCubic(K(t, 3.28, 3.5)), WHITE);
  const bl = ease.outExpo(K(t, 3.36, 3.7)); if (bl > 0) { L.save(); L.translate(MJ[0], MJ[1]); L.rotate(-1.1 * (1 - bl)); L.scale(0.2 + 0.8 * bl, 0.2 + 0.8 * bl); L.translate(-MJ[0], -MJ[1]); drawPart(L, m.part('blade'), 1, col); L.restore(); }
  const fl = pulse(t, 3.5, 0.09); if (t >= 3.5 && fl > 0.03) seg(L, -5, 0.2 + 1.25, 5, 0.2 - 1.25, 0.03 + 0.05 * fl, WHITE, fl);                                 // ひと振りの光
  drawPart(L, m.part('cut'), ease.outCubic(K(t, 3.52, 3.75)), WHITE); drawPart(L, m.part('future'), ease.outBack(K(t, 3.84, 4.0)), acc);
  const fear = pulse(t, 4, 0.2); if (t >= 4 && fear > 0.03) { L.save(); L.globalAlpha = fear * 0.8; L.beginPath(); for (let i = 0; i <= 36; i++) { const a = i / 36 * TAU, r = (i % 2 ? 1.5 : 2.0 + 0.5 * hash1(i * 3.7)) * (1 + 0.5 * (1 - fear)); i ? L.lineTo(Math.cos(a) * r, Math.sin(a) * r) : L.moveTo(Math.cos(a) * r, Math.sin(a) * r); } L.closePath(); L.lineWidth = 0.03; L.strokeStyle = col; L.stroke(); L.restore(); }   // 本能に届く「怖さ」
  if (t > 4) { const k = ((t - 4) % 2) / 2, i = 5 - Math.floor(k * 9); if (i >= 0 && i <= 5) { const u = MU[i], sh = i >= 3 ? 0.085 : 0; ring(L, MP0[0] + MD[0] * u + MN[0] * sh, MP0[1] + MD[1] * u + MN[1] * sh, 0.11, 0.02, WHITE, 0.8); } ring(L, MJ[0] - MD[0] / ML * 0.33, MJ[1] - MD[1] / ML * 0.33, 0.05 + 0.06 * (k * 2 % 1), 0.014, acc, 0.7 * (1 - (k * 2 % 1))); }
}

// ---------------------------------------------------------------- 燐: 見えない紐が張られ、結ばれて、守るための四角になる
const R45 = (x, y) => [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2];
function rin(L, t, m, e) {
  const col = m.col.main, a = 0.3, g = 0.118 * ease.outCubic(K(t, 3.0, 3.5)), ext = lerp(6.2, 0.8, ease.inOutCubic(K(t, 2.2, 3.4)));
  const field = sm(3.3, 3.9, t), hit = pulse(t, 4, 0.5);
  if (field > 0) poly(L, [R45(-a, -a), R45(a, -a), R45(a, a), R45(-a, a)], col, 0.1 * field + 0.3 * (t >= 4 ? hit : 0));        // 結界の内がわ
  if (t < 3.6) {
    L.save(); L.rotate(-0.2 * (1 - ease.outBack(K(t, 2.5, 3.6), 1.6)) * sm(2.2, 2.5, t));
    // 紐: [軸（0: 縦, 1: 横）, 位置, 上をくぐる交点の位置（負なら手前側）]
    [[0, -a, a], [0, a, -a], [1, -a, -a], [1, a, a]].forEach(([ax, pos, under], k) => {
      const t0 = 0.25 + 0.3 * k, sh = ease.outCubic(K(t, t0, t0 + 0.4)); if (sh <= 0) return;
      const vis = 0.35 + 0.65 * sm(1.5, 1.9, t), amp = 0.11 * Math.exp(-3.2 * Math.max(0, t - t0 - 0.3)) * Math.sin(TAU * 3.2 * (t - t0));
      const P = (s, off = 0) => (ax ? R45(s, pos + off) : R45(pos + off, s));
      const piece = (s0, s1) => { if (s1 <= s0) return; L.beginPath(); const n = 40; for (let i = 0; i <= n; i++) { const s = lerp(s0, s1, i / n), q = P(s, amp * Math.sin(Math.PI * (s + ext) / (2 * ext) * 3)); i ? L.lineTo(q[0], q[1]) : L.moveTo(q[0], q[1]); } L.lineWidth = 0.085; L.strokeStyle = col; L.globalAlpha = vis; if (vis < 0.7) L.setLineDash([0.16, 0.2]); L.stroke(); L.setLineDash([]); };
      const end = lerp(-ext, ext, sh); piece(-ext, Math.min(end, under - g)); piece(under + g, end);
    });
    L.restore(); L.globalAlpha = 1;
  } else drawMark(L, m, { pal: e.pal, skip: ['core'] });
  drawPart(L, m.part('core'), ease.outBack(K(t, 3.6, 3.9), 2.4), WHITE);
  if (t >= 4 && hit > 0.02) { const u = 1 - hit, h = lerp(0.3, 2.6, ease.outCubic(sat((t - 4) / 0.9))); L.save(); L.rotate(Math.PI / 4); L.globalAlpha = sat(1 - (t - 4) / 0.9); L.lineWidth = 0.03; L.strokeStyle = col; L.strokeRect(-h, -h, h * 2, h * 2); L.restore(); }
  if (t > 4.2) for (let i = 0; i < 6; i++) {            // 外から来るものは、結界ではね返る
    const ph = ((t - 4.2) * 0.45 + i / 6) % 1, an = i * 1.047 + 0.4, far = 2.6, near = 0.62, d = ph < 0.5 ? lerp(far, near, ease.inQuad(ph * 2)) : lerp(near, far * 0.8, ease.outQuad(ph * 2 - 1)), an2 = ph < 0.5 ? an : an + 0.5;
    dot(L, Math.cos(an2) * d, Math.sin(an2) * d, 0.035, WHITE, 0.7 * Math.sin(ph * Math.PI)); if (ph > 0.5 && ph < 0.62) ring(L, Math.cos(an) * near, Math.sin(an) * near, 0.05 + (ph - 0.5) * 1.2, 0.015, col, 1 - (ph - 0.5) / 0.12);
  }
}

// ---------------------------------------------------------------- ニルメ: 星々が渦を巻いて落ちてくる。抱きしめられた星は、宝石になる
function nirume(L, t, m, e) {
  const col = m.col.main, breathe = t > 4 ? 1 + 0.012 * Math.sin((t - 4) * 1.6) : 1;
  for (let k = 0; k < 7; k++) { const r = (((k - t * 0.42) % 7) + 7) % 7 * 0.72 + 0.3; ring(L, 0, 0, r, 0.012, col, 0.16 * sat(r / 1.5) * sat((5 - r) / 2) * sm(0.2, 1, t)); }      // 内へ寄ってくる空間
  for (let i = 0; i < 70; i++) {
    const late = i >= 52, r0 = 1.5 + 3.4 * hash1(i * 3.1), a0 = hash1(i * 7.7) * TAU, d = late ? 4.2 + hash1(i * 5.3) * 3.6 : 0.5 + 1.6 * hash1(i * 5.3), life = late ? 2.6 : 2.3;
    const tt = late ? ((t - d) % 3.6 + 3.6) % 3.6 : t - d; if (late && t < 4.2) continue;
    const pos = (x) => { const u = ease.inQuad(sat(x / life)), r = lerp(r0, 0.06, u), an = a0 + 1.9 * Math.log(r0 / r); return [Math.cos(an) * r, Math.sin(an) * r * 0.96, r]; };
    const p = pos(Math.max(0, tt)), a = (tt < 0 ? sm(0.05, 0.6, t) * 0.7 : 1) * (p[2] < 0.12 ? 0 : 1) * (late ? 0.55 : 1); if (a <= 0) continue;
    if (tt > 0.05) { const q = pos(tt - 0.07); seg(L, q[0], q[1], p[0], p[1], 0.02, col, 0.55 * a); }
    dot(L, p[0], p[1], 0.03 + 0.02 * hash1(i * 9.1), i % 4 ? WHITE : col, a * (0.5 + 0.5 * hash1(i * 2.2)));
  }
  L.save(); L.scale(breathe, breathe);
  drawPart(L, m.part('spiral'), ease.inOutCubic(K(t, 1.3, 3.55)), col);
  [3.0, 3.3, 3.58].forEach((g0, i) => { const u = ease.outBack(K(t, g0, g0 + 0.3), 2.6), tw = t > 4 ? 1 + 0.16 * Math.max(0, Math.sin((t - 4) * 2.4 + i * 2.1)) ** 4 : 1; if (u > 0) { const p = m.part('gem' + i), c0 = p.paths[0].p; L.save(); const cx = (c0[0][0] + c0[Math.floor(c0.length / 2)][0]) / 2, cy = (c0[0][1] + c0[Math.floor(c0.length / 2)][1]) / 2; L.translate(cx, cy); L.scale(tw, tw); L.translate(-cx, -cy); drawPart(L, p, u, WHITE); L.restore(); ring(L, cx, cy, 0.1 + 0.3 * K(t, g0, g0 + 0.5), 0.016, WHITE, 1 - K(t, g0, g0 + 0.5)); } });
  drawPart(L, m.part('cross'), ease.outCubic(K(t, 3.72, 3.98)), m.col.accent[0]);
  L.restore();
}

// ---------------------------------------------------------------- レウネ: 降ってくる情報のなかで、目は半分だけ開く。読む・見張る・通す
function reune(L, t, m, e) {
  const col = m.col.main, acc = m.col.accent[0], hit = pulse(t, 4, 0.25), dim = t < 4 ? sm(0.05, 0.6, t) : 0.42 + 0.58 * hit;
  for (let i = 0; i < 30; i++) {            // 情報の雨
    const x = -4.5 + i * 0.31 + 0.1 * hash1(i * 3.3), v = 0.7 + 1.5 * hash1(i * 5.1), gap = 0.2 + 0.22 * hash1(i * 7.7);
    if (Math.abs(x) < 1.15 && t > 1.0) continue;
    for (let j = 0; j < 22; j++) { const y = ((j * gap + t * v + hash1(i) * 5) % 5.6) - 2.6, b = hash1(i * 13.1 + j * 7.3 + Math.floor(t * 3 + i) * 0.37); if (b < 0.45) continue; L.fillStyle = b > 0.9 ? WHITE : col; L.globalAlpha = dim * (0.18 + 0.5 * (b - 0.45)) * sat((2.9 - Math.abs(y)) * 2); L.fillRect(x - 0.03, y - 0.03, 0.06, 0.06); }
  }
  L.globalAlpha = 1;
  drawPart(L, m.part('lid'), ease.inOutCubic(K(t, 1.15, 1.75)), col);
  const op = ease.outBack(K(t, 1.95, 2.65), 1.3);
  if (t >= 1.95) { const cy = lerp(-0.16, 0.62, op); L.beginPath(); L.moveTo(-0.92, -0.16); L.bezierCurveTo(-0.5, cy, 0.5, cy, 0.92, -0.16); L.lineWidth = 0.085; L.strokeStyle = col; L.stroke(); }
  const look = t > 4.6 ? 0.07 * Math.sin((t - 4.6) * 1.5) : 0;
  L.save(); L.translate(look, 0); drawPart(L, m.part('iris'), ease.inOutCubic(K(t, 2.5, 3.1)), WHITE);
  const cur = t < 2.95 ? 0 : t < 3.55 ? (Math.floor(t * 12) % 2 ? 1 : 0.15) : t > 4 ? (((t - 4) % 1) < 0.72 ? 1 : 0.2) : 1; if (cur > 0) { L.globalAlpha = cur; drawPart(L, m.part('pupil'), 1, col); L.globalAlpha = 1; }
  L.restore();
  for (let i = 0; i < 4; i++) { const u = ease.outCubic(K(t, 3.2 + 0.15 * i, 3.5 + 0.15 * i)); if (u > 0) { L.save(); L.translate(0, -0.5 * (1 - u)); L.globalAlpha = u; drawPart(L, m.part('bit' + i), 1, acc); L.restore(); } }
  const sy = lerp(-0.2, 0.5, ((t * 0.5) % 1)); if (t > 2.6) seg(L, -0.75, sy, 0.75, sy, 0.012, acc, 0.3 * Math.sin(((t * 0.5) % 1) * Math.PI) * sat((0.5 - Math.abs(sy - 0.15)) * 3));       // 走査
  if (t > 4.1) for (let i = 0; i < 7; i++) { const ph = ((t - 4.1) * 0.5 + i / 7) % 1, x = lerp(4.4, 0.98, ease.inOutQuad(ph)), y = lerp(-0.9 + 0.5 * hash1(i * 3.1) - 0.3, -0.16, ease.inOutQuad(ph)); L.fillStyle = i % 3 ? col : WHITE; L.globalAlpha = 0.8 * Math.sin(ph * Math.PI); const h = 0.04 * (1 - 0.5 * ph); L.fillRect(x - h, y - h, h * 2, h * 2); }       // 集まってくる情報
  L.globalAlpha = 1;
}

// ---------------------------------------------------------------- テルエス: 三つの理の並び順を入れ替える。落ちていた雫が、浮かぶ。琥珀の特異点
function telues(L, t, m, e) {
  const col = m.col.main, acc = m.col.accent[0], tones = [acc, col, m.col.deep];
  // 並び順（上から）: はじめ 1,2,3 → いちばん下を先頭へ（3,1,2）→ もう一度（2,3,1）
  const s1 = ease.inOutCubic(K(t, 1.0, 1.5)), s2 = ease.inOutCubic(K(t, 1.85, 2.35)), fold = ease.inCubic(K(t, 2.55, 2.95));
  const slot = [lerp(lerp(0, 1, s1), 2, s2), lerp(lerp(1, 2, s1), 0, s2), lerp(lerp(2, 0, s1), 1, s2)], arc = [Math.sin(Math.PI * s2), Math.sin(Math.PI * s2) * 0, Math.sin(Math.PI * s1)];
  const lift = [s2 > 0 && s2 < 1 ? 0 : 0, s2 > 0 && s2 < 1 ? 1 : 0, s1 > 0 && s1 < 1 ? 1 : 0];
  if (t < 2.95) for (let b = 0; b < 3; b++) {
    const a0 = ease.outCubic(K(t, 0.15 + 0.12 * b, 0.6 + 0.12 * b)), y = (slot[b] - 1) * 0.52 * (1 - fold), x = (b === 2 ? 1.0 * arc[2] : b === 1 ? 1.0 * Math.sin(Math.PI * s2) : 0) * (1 - fold), half = 1.25 * a0 * (1 - fold), wk = lift[b] ? 1.25 : 1;
    seg(L, x - half, y, x + half, y, 0.085 * wk, tones[b], a0); for (let k = 0; k <= b; k++) dot(L, x - half - 0.22 - 0.16 * k, y, 0.045, tones[b], a0 * (1 - fold));       // 左の点の数 = もとの順番
    if (lift[b]) ring(L, x + half + 0.2, y, 0.07, 0.02, WHITE, 0.8);
  }
  for (let i = 0; i < 16; i++) {            // 雫: 重力で落ちていたのが、順番が変わると、丸くなって浮かぶ
    const x0 = -3.8 + i * 0.5 + 0.2 * hash1(i * 3.1), y0 = -2.6 + 1.6 * hash1(i * 5.3), tf = Math.min(t, 1.25), y1 = y0 + 0.9 * tf * tf + 0.5 * tf, fl = Math.max(0, t - 1.25);
    const y = y1 - 0.25 * fl + 0.06 * Math.sin(fl * 3 + i), a = sm(0.05, 0.4, t) * (1 - sm(2.5, 3.1, t)); if (Math.abs(x0) < 1.7 && Math.abs(y) < 1.0) continue;
    if (t < 1.25) seg(L, x0, y - 0.14 - 0.1 * tf, x0, y, 0.03, acc, 0.6 * a); else ring(L, x0 + 0.05 * Math.sin(fl * 2 + i), y, 0.05 + 0.02 * sat(fl * 3), 0.022, acc, 0.75 * a);
  }
  for (const [ts, k] of [[1.25, s1], [2.1, s2]]) { const fl = pulse(t, ts, 0.2); if (t >= ts && fl > 0.03) ring(L, 0, 0, 1.6 + 1.6 * (1 - fl), 0.02, WHITE, fl * 0.7); }
  drawPart(L, m.part('core'), ease.outBack(K(t, 2.9, 3.2), 3), WHITE);
  drawPart(L, m.part('ring'), ease.inOutCubic(K(t, 3.05, 3.8)), col);
  const ax = [-Math.sin(-24 * Math.PI / 180), Math.cos(-24 * Math.PI / 180)], jk = ease.outExpo(K(t, 3.3, 3.75));
  drawPart(L, m.part('jetU'), jk, col); drawPart(L, m.part('jetD'), jk, col);
  const st = K(t, 3.3, 3.9); if (st > 0 && st < 1) for (const sg of [-1, 1]) { const r0 = 1.0 + 4.5 * ease.outCubic(st), r1 = r0 + 1.2 * (1 - st); seg(L, sg * ax[0] * r0, sg * ax[1] * r0, sg * ax[0] * r1, sg * ax[1] * r1, 0.04, WHITE, 1 - st); }       // 噴流が突き抜ける
  if (t >= 3.95) { const fl = t < 4 ? 0 : pulse(t, 4, 0.3), flick = 0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.3); for (const [dx, dy, len] of [[1, 0, 0.9], [0, 1, 0.5]]) seg(L, -dx * len * fl, -dy * len * fl, dx * len * fl, dy * len * fl, 0.02, WHITE, fl); dot(L, 0, 0, 0.125 + 0.03 * flick, WHITE, 0.35 * flick);
    const u = ((t - 4) * 0.35) % 1, q = m.part('ring').paths[0].at(u); dot(L, q[0], q[1], 0.065, WHITE, 0.85); }       // 明滅する芯と、輪をめぐる光
}

// ---------------------------------------------------------------- エデル: 出来事の断片を、額縁に組み直す。集めた感情は宝石に。いちばん外は未完のまま
const sq = (h) => [[-h, -h], [h, -h], [h, h], [-h, h]];
function edel(L, t, m, e) {
  const col = m.col.main, KID = e.kidCols || [col];
  const fr = [['outer', [-0.55, 0.25], 0.66, 1.22, 1.35, 2.2], ['mid', [1.0, -0.35], -0.9, 0.8, 1.75, 2.6], ['inner', [-0.3, 0.75], 1.75, 1.5, 2.15, 3.0]];
  const spin = (id) => (id === 'mid' ? Math.PI / 2 * ease.inOutCubic(K(t, 5.5, 6.15)) : id === 'inner' ? -Math.PI / 2 * ease.inOutCubic(K(t, 6.5, 7.1)) : 0);
  // 影から伸びる黒紫の手（細い腕）が、それぞれの額縁を運ぶ
  fr.forEach(([id, off, rot0, sc0, t0, t1], i) => {
    const k = ease.inOutCubic(K(t, t0, t1)), drift = 0.06 * Math.sin(t * 1.3 + i * 2), x = off[0] * (1 - k) + drift * (1 - k), y = off[1] * (1 - k), reach = sm(t0 - 0.5, t0, t) * (1 - sm(t1, t1 + 0.4, t));
    if (reach > 0.01) { const bx = (i - 1) * 1.9, by = 3.2, hx = x + (i - 1) * 0.5, hy = y + 0.55; L.save(); L.globalAlpha = 0.75 * reach; L.beginPath(); L.moveTo(bx, by); L.bezierCurveTo(bx + 0.4 * Math.sin(t * 2 + i), by - 1.4, hx - 0.5 * (i - 1), hy + 1.1, lerp(bx, hx, reach), lerp(by, hy, reach)); L.lineWidth = 0.05; L.strokeStyle = '#7a5fc0'; L.stroke(); L.restore(); dot(L, lerp(bx, hx, reach), lerp(by, hy, reach), 0.07, '#b9a2f0', reach); }
    const a0 = ease.outCubic(K(t, 0.15 + 0.2 * i, 0.9 + 0.2 * i)); if (a0 <= 0) return;
    L.save(); L.translate(x, y); L.rotate(rot0 * (1 - k) + spin(id)); const s = lerp(sc0, 1, k); L.scale(s, s);
    drawPart(L, m.part(id), id === 'outer' ? ease.inOutCubic(K(t, 0.2, 1.25)) : a0, e.pal(m.part(id).tone), 1 / s); L.restore();
  });
  for (let i = 0; i < 16; i++) {            // 抜き出した感情の粒が、まん中で宝石になる
    const u = K(t, 2.9 + 0.02 * i, 3.62), r = lerp(1.5 + 0.9 * hash1(i * 3.3), 0, ease.inCubic(u)), an = hash1(i * 7.1) * TAU + 2.4 * u; if (u <= 0 || u >= 1) continue;
    dot(L, Math.cos(an) * r, Math.sin(an) * r, 0.045, KID[i % KID.length], sat(u * 5));
  }
  drawPart(L, m.part('gem'), ease.outBack(K(t, 3.58, 3.9), 3), m.col.accent[0]);
  const gl = K(t, 4.0, 4.5); if (gl > 0 && gl < 1) { const x = lerp(-1.4, 1.4, gl); L.save(); L.globalAlpha = Math.sin(gl * Math.PI) * 0.9; L.beginPath(); L.moveTo(x - 0.5, 1.1); L.lineTo(x + 0.5, -1.1); L.lineWidth = 0.05; L.strokeStyle = WHITE; L.stroke(); L.restore(); }       // 眼鏡の反射のような光
  if (t > 4) { const g = pulse((t - 4) % 2, 0, 0.3); for (const [dx, dy] of [[1, 0], [0, 1]]) seg(L, -dx * 0.3 * g, -dy * 0.3 * g, dx * 0.3 * g, dy * 0.3 * g, 0.014, WHITE, g);
    const br = sm(4.3, 4.9, t) * (1 - sm(6.2, 6.9, t)), bx = 0.84 + 0.1 * Math.sin(t * 1.7), by = 0.84 - 0.25 + 0.2 * Math.sin(t * 2.3); if (br > 0.01) { L.save(); L.globalAlpha = 0.7 * br; L.beginPath(); L.moveTo(2.4, 3.2); L.quadraticCurveTo(1.9, 1.9, bx, by); L.lineWidth = 0.045; L.strokeStyle = '#7a5fc0'; L.stroke(); L.restore(); dot(L, bx, by, 0.06, '#b9a2f0', br); } }       // 未完の角に、筆が迷って、去る
}

// ---------------------------------------------------------------- アセラ: 飛んできたものに触れて、止め、ためて、逆へ返す。影が遅れてついてくる
const AA = [-0.82, -0.5], AC = [0.56, 0], AB = [-0.52, 0.46];
function asera(L, t, m, e) {
  const col = m.col.main, acc = m.col.accent[0];
  // 道すじ: [時刻, 位置]。触れた点では少し止まる（運動をもらう）→ 前より速く出ていく
  const d1 = [AC[0] - AA[0], AC[1] - AA[1]], far = [AA[0] - d1[0] * 3.4, AA[1] - d1[1] * 3.4];
  const keys = [[0.2, [-5.2, -1.7]], [0.72, [1.7, 0.95]], [0.86, [1.7, 0.95]], [1.22, [-2.5, 1.75]], [1.36, [-2.5, 1.75]], [1.72, [2.4, -1.25]], [1.86, [2.4, -1.25]], [2.26, far], [2.46, far], [3.2, AC], [3.42, AC], [3.68, AB]];
  const at = (x) => { if (x <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const a = keys[i - 1], b = keys[i], k = (x - a[0]) / (b[0] - a[0]); return [lerp(a[1][0], b[1][0], k), lerp(a[1][1], b[1][1], k)]; } return keys[keys.length - 1][1]; };
  const shake = t >= 4 ? pulse(t, 4, 0.12) : 0; L.translate(noise1(t * 40, 1) * 0.035 * shake, noise1(t * 40, 2) * 0.035 * shake);
  if (t > 0.2 && t < 3.72) {
    for (const [lag, c2, w] of [[0.09, acc, 0.03], [0, WHITE, 0.045]]) { L.beginPath(); for (let j = 0; j <= 20; j++) { const p = at(t - lag - 0.22 * (1 - j / 20)); j ? L.lineTo(p[0], p[1]) : L.moveTo(p[0], p[1]); } L.lineWidth = w; L.strokeStyle = c2; L.globalAlpha = lag ? 0.8 : 1; L.stroke(); }      // 影（遅れてくる）と、本体
    L.globalAlpha = 1; const p = at(t); dot(L, p[0], p[1], 0.075, WHITE);
  }
  for (const [ts, pt] of [[0.72, keys[1][1]], [1.22, keys[3][1]], [1.72, keys[5][1]]]) {       // 触れた点: 輪が出て、ためて、放つ
    const u = K(t, ts - 0.05, ts + 0.5); if (u <= 0 || u >= 1) continue; const hold = K(t, ts, ts + 0.14);
    ring(L, pt[0], pt[1], 0.135 * (1 + 0.25 * Math.sin(t * 90) * (hold < 1 ? 1 : 0)), 0.06, col, 1 - sm(0.6, 1, u)); if (hold >= 1) ring(L, pt[0], pt[1], 0.2 + 0.9 * (u - 0.38), 0.02, WHITE, 1 - u);
  }
  drawPart(L, m.part('in'), K(t, 2.9, 3.2), col);
  const hold = t >= 3.2 && t < 3.42, vib = hold ? 0.02 * Math.sin(t * 95) : t > 4 ? 0.006 * Math.sin(t * 60) * (0.5 + 0.5 * Math.sin(t * 3)) : 0;
  if (t >= 3.17) { const u = ease.outBack(K(t, 3.17, 3.34), 3); L.save(); L.translate(AC[0], AC[1]); L.scale(u * (1 + vib * 6), u * (1 + vib * 6)); L.translate(-AC[0], -AC[1]); drawPart(L, m.part('touch'), 1, hold ? WHITE : col, hold ? 1.3 : 1); L.restore(); }
  drawPart(L, m.part('out'), K(t, 3.42, 3.68), col); drawPart(L, m.part('head'), ease.outBack(K(t, 3.62, 3.82), 2.5), col);
  [['echo0', 3.3], ['echo1', 3.42]].forEach(([id, t0], i) => { const u = ease.outCubic(K(t, t0, t0 + 0.3)), sl = t > 4 ? 0.03 * Math.sin((t - 4) * 5 + i * 2) * (0.4 + 0.6 * Math.abs(Math.sin((t - 4) * 1.3))) : 0; if (u > 0) { L.save(); L.translate(d1[0] * sl, d1[1] * sl); L.globalAlpha = t > 4 ? 0.75 + 0.25 * Math.sin((t - 4) * 9 + i) : 1; drawPart(L, m.part(id), u, acc); L.restore(); } });
  if (t >= 4 && t < 4.5) for (let j = 1; j <= 3; j++) { const k = 1 - (t - 4) / 0.5; L.save(); L.translate(-0.12 * j * k, -0.045 * j * k); L.globalAlpha = 0.3 * k / j; drawMark(L, m, { mode: 'white', pal: () => acc }); L.restore(); }       // 影の竜のような残像
}

export const ACTS = { yuria, vol, zaina, rurika, miria, rin, nirume, reune, telues, edel, asera };
