// micro.js — 身体の中: 細胞（2D）と DNA（球で組んだ二重らせん）
//   どちらも「ばらばらに砕ける ⇄ 元の形に集まる」を、欠片ごとの量 e（0 = 元の形、1 = 飛び散った）で描く。
import { W, H, sat, smoothstep, lerp, clamp, TAU, mulberry32, hash1, ease, COL, v3 } from './core.js';
import { rgba } from '../../atom/src/kit.js';

// ------------------------------------------------------------ 細胞
const CELLS = [[960, 540, 218], [505, 318, 172], [1425, 322, 182], [470, 792, 192], [1452, 806, 176], [962, 96, 150], [958, 1004, 158], [96, 556, 182], [1826, 566, 186]];
const NSEG = 16, NWEDGE = 7, NORG = 11;
export const cells = CELLS.map(([x, y, R], ci) => {
  const r = mulberry32(100 + ci * 17), p1 = r() * 6.28, p2 = r() * 6.28, p3 = r() * 6.28;
  const rad = (a, t = 0) => R * (1 + 0.055 * Math.sin(3 * a + p1 + t * 0.7) + 0.035 * Math.sin(5 * a + p2 - t * 0.5) + 0.02 * Math.sin(8 * a + p3 + t));
  const frag = () => { const a = r() * 6.28; return { a, dist: R * (0.9 + 2.3 * r()), rot: (r() - 0.5) * 5, lag: r() }; };
  const seg = Array.from({ length: NSEG }, (_, j) => { const f = frag(); f.a = (j + 0.5) / NSEG * 6.28 + (r() - 0.5) * 0.9; return f; });
  const na = r() * 6.28, nuc = { x: Math.cos(na) * R * 0.2, y: Math.sin(na) * R * 0.2, r: R * 0.36 };
  const wedge = Array.from({ length: NWEDGE }, (_, j) => { const f = frag(); f.a = (j + 0.5) / NWEDGE * 6.28 + (r() - 0.5) * 1.2; f.dist *= 0.7; return f; });
  const org = Array.from({ length: NORG }, () => { let ox, oy; do { const a = r() * 6.28, d = R * (0.2 + 0.62 * Math.sqrt(r())); ox = Math.cos(a) * d; oy = Math.sin(a) * d; } while (Math.hypot(ox - nuc.x, oy - nuc.y) < nuc.r + R * 0.1); const f = frag(); f.a = Math.atan2(oy, ox) + (r() - 0.5); return { ...f, x: ox, y: oy, rx: R * (0.05 + 0.05 * r()), ry: R * (0.025 + 0.02 * r()), ang: r() * 3.14, kind: r() < 0.7 ? 0 : 1 }; });
  return { x, y, R, rad, seg, nuc, wedge, org, ci };
});

// 1 つの細胞を描く。o: { e(lag)→0..1 砕けぐあい, ghost 0..1（魂が呼び起こす形）, gold 0..1, soul 0..1, flash 0..1, t, dim }
export function drawCell(cb, cg, cell, o) {
  const { x, y, R, rad, seg, nuc, wedge, org } = cell, t = o.t, e0 = o.e(0.5), dim = o.dim ?? 1;
  const mem = o.soul > 0.5 ? [200, 240, 255] : o.gold > 0.02 ? [lerp(110, 255, o.gold), lerp(214, 196, o.gold), lerp(232, 84, o.gold)] : [110, 214, 232];
  const place = (c, px, py, f) => { const e = o.e(f.lag), d = f.dist * e * (1 + 0.12 * Math.sin(t * 0.8 + f.lag * 9)); c.translate(x + px + Math.cos(f.a) * d, y + py + Math.sin(f.a) * d); c.rotate(f.rot * e); return e; };
  // 形の手本（魂）
  if (o.ghost > 0.01) {
    for (const [lw, a] of [[16, 0.10], [5, 0.5], [1.6, 0.9]]) {
      cg.strokeStyle = rgba(190, 236, 255, a * o.ghost); cg.lineWidth = lw; cg.beginPath();
      for (let i = 0; i <= 72; i++) { const an = i / 72 * TAU, rr = rad(an, t); i ? cg.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr) : cg.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
      cg.closePath(); cg.stroke();
      cg.beginPath(); cg.arc(x + nuc.x, y + nuc.y, nuc.r, 0, TAU); cg.stroke();
    }
    const g = cg.createRadialGradient(x, y, 0, x, y, R * 1.1); g.addColorStop(0, rgba(150, 215, 255, 0.16 * o.ghost)); g.addColorStop(1, 'rgba(120,200,255,0)'); cg.fillStyle = g; cg.beginPath(); cg.arc(x, y, R * 1.1, 0, TAU); cg.fill();
  }
  // 細胞質
  const whole = 1 - sat(e0 * 5);
  if (whole > 0.01) {
    const g = cb.createRadialGradient(x - R * 0.2, y - R * 0.25, R * 0.1, x, y, R * 1.05);
    g.addColorStop(0, rgba(70, 150, 190, 0.34 * whole * dim)); g.addColorStop(0.8, rgba(34, 96, 140, 0.26 * whole * dim)); g.addColorStop(1, rgba(30, 90, 130, 0.12 * whole * dim));
    cb.fillStyle = g; cb.beginPath(); for (let i = 0; i <= 72; i++) { const an = i / 72 * TAU, rr = rad(an, t); i ? cb.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr) : cb.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } cb.closePath(); cb.fill();
  }
  // 小器官
  for (const f of org) {
    cb.save(); const e = place(cb, f.x, f.y, f); cb.rotate(f.ang);
    cb.fillStyle = f.kind ? rgba(150, 220, 170, 0.6 * dim) : rgba(238, 160, 96, 0.72 * dim); cb.beginPath(); cb.ellipse(0, 0, f.rx, f.ry, 0, 0, TAU); cb.fill();
    cb.strokeStyle = f.kind ? rgba(90, 160, 120, 0.7 * dim) : rgba(160, 84, 44, 0.8 * dim); cb.lineWidth = 2; cb.stroke(); cb.restore();
  }
  // 核（くさび形の欠片に分かれる）
  wedge.forEach((f, j) => {
    const a0 = j / NWEDGE * TAU, a1 = (j + 1) / NWEDGE * TAU + 0.02, am = (a0 + a1) / 2, mx = nuc.x + Math.cos(am) * nuc.r * 0.55, my = nuc.y + Math.sin(am) * nuc.r * 0.55;
    cb.save(); place(cb, mx, my, f);
    const g = cb.createRadialGradient(nuc.x - mx, nuc.y - my, 0, nuc.x - mx, nuc.y - my, nuc.r);
    g.addColorStop(0, rgba(150, 120, 245, 0.92 * dim)); g.addColorStop(1, rgba(84, 62, 190, 0.92 * dim));
    cb.fillStyle = g; cb.beginPath(); cb.moveTo(nuc.x - mx, nuc.y - my); cb.arc(nuc.x - mx, nuc.y - my, nuc.r, a0, a1); cb.closePath(); cb.fill();
    cb.fillStyle = rgba(48, 30, 130, 0.55 * dim); for (let k = 0; k < 3; k++) { const aa = lerp(a0, a1, hash1(j * 3 + k + cell.ci) * 0.8 + 0.1), dd = nuc.r * (0.25 + 0.6 * hash1(j * 7 + k * 5 + cell.ci)); cb.beginPath(); cb.arc(nuc.x - mx + Math.cos(aa) * dd, nuc.y - my + Math.sin(aa) * dd, nuc.r * 0.07, 0, TAU); cb.fill(); }
    cb.restore();
  });
  if (whole > 0.5) { cb.strokeStyle = rgba(190, 170, 255, 0.5 * whole * dim); cb.lineWidth = 3; cb.beginPath(); cb.arc(x + nuc.x, y + nuc.y, nuc.r, 0, TAU); cb.stroke(); }
  // 細胞膜（弧の欠片）
  seg.forEach((f, j) => {
    const a0 = j / NSEG * TAU, a1 = (j + 1) / NSEG * TAU, am = (a0 + a1) / 2, rm = rad(am, t), mx = Math.cos(am) * rm, my = Math.sin(am) * rm;
    const pathOn = (c) => { c.beginPath(); for (let i = 0; i <= 6; i++) { const an = lerp(a0, a1 + 0.012, i / 6), rr = rad(an, t); i ? c.lineTo(Math.cos(an) * rr - mx, Math.sin(an) * rr - my) : c.moveTo(Math.cos(an) * rr - mx, Math.sin(an) * rr - my); } };
    cb.save(); const e = place(cb, mx, my, f); cb.lineCap = e > 0.01 ? 'round' : 'butt';
    cb.strokeStyle = rgba(mem[0] * 0.5, mem[1] * 0.5, mem[2] * 0.55, 0.9 * dim); cb.lineWidth = 11; pathOn(cb); cb.stroke();
    cb.strokeStyle = rgba(mem[0], mem[1], mem[2], 0.95 * dim); cb.lineWidth = 5; pathOn(cb); cb.stroke(); cb.restore();
    const gl = Math.max(o.gold, o.soul * (1 - sat(e * 3)), o.flash || 0);
    if (gl > 0.02) { cg.save(); const d = f.dist * e; cg.translate(x + mx + Math.cos(f.a) * d, y + my + Math.sin(f.a) * d); cg.rotate(f.rot * e); cg.lineCap = 'round'; cg.strokeStyle = rgba(mem[0], mem[1], mem[2], 0.22 * gl); cg.lineWidth = 22; pathOn(cg); cg.stroke(); cg.strokeStyle = rgba(255, 250, 235, 0.5 * gl); cg.lineWidth = 3; pathOn(cg); cg.stroke(); cg.restore(); }
  });
  if ((o.flash || 0) > 0.01) { const g = cg.createRadialGradient(x, y, 0, x, y, R * 1.25); g.addColorStop(0, rgba(255, 255, 255, 0.55 * o.flash)); g.addColorStop(1, 'rgba(200,235,255,0)'); cg.fillStyle = g; cg.beginPath(); cg.arc(x, y, R * 1.25, 0, TAU); cg.fill(); }
}

// ------------------------------------------------------------ DNA
export const NBP = 48, PER = 10.5, RISE = 0.34, RAD = 1.0, GROOVE = 2.25, GSIZE = 3;
export const NG = Math.ceil(NBP / GSIZE);
const GR = Array.from({ length: NG }, (_, g) => { const r = mulberry32(700 + g * 13), a = r() * TAU; return { d: [(r() - 0.5) * 3.2, Math.cos(a) * (2.2 + 3.4 * r()), Math.sin(a) * (1.4 + 2.2 * r()) - 0.6], ax: (r() - 0.5) * 3.4, az: (r() - 0.5) * 3.0, lag: r() }; });
const BASE = [[[0.92, 0.32, 0.16], [0.95, 0.72, 0.2]], [[0.28, 0.72, 0.42], [0.5, 0.4, 0.95]], [[0.95, 0.72, 0.2], [0.92, 0.32, 0.16]], [[0.5, 0.4, 0.95], [0.28, 0.72, 0.42]]];
const SA = [0.16, 0.38, 0.9], SB = [0.1, 0.56, 0.66];
const mixc = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// 二重らせんの点を作る。o: { phi, e(g)→0..1, shud(i)→ゆれ, ssb: [[i, k]], gold, soul }
export function helixPoints(o) {
  const pts = [];
  for (let i = 0; i < NBP; i++) {
    const g = Math.floor(i / GSIZE), G = GR[g], e = o.e ? o.e(g, G.lag) : 0;
    const xc = ((g + 0.5) * GSIZE - 0.5 - (NBP - 1) / 2) * RISE;          // 欠片の中心（回転の軸）
    const x0 = (i - (NBP - 1) / 2) * RISE, a = (i / PER) * TAU + o.phi, sh = o.shud ? o.shud(i) : 0;
    const tf = (x, y, z) => {
      if (e > 0) {
        let dx = x - xc; const ca = Math.cos(G.az * e), sa = Math.sin(G.az * e); const x1 = dx * ca - y * sa, y1 = dx * sa + y * ca;
        const cb = Math.cos(G.ax * e), sb = Math.sin(G.ax * e); const y2 = y1 * cb - z * sb, z2 = y1 * sb + z * cb;
        x = xc + x1 + G.d[0] * e; y = y2 + G.d[1] * e; z = z2 + G.d[2] * e;
      }
      return [x, y + sh, z];
    };
    const mk = (ang, strand) => {
      let r = RAD, x = x0, y, z;
      if (o.ssb) for (const [bi, k, st] of o.ssb) if (st === strand && Math.abs(i - bi) < 1.8) { const kk = k * (1 - Math.abs(i - bi) / 1.8); r += 0.6 * kk; x += (i < bi ? -0.16 : 0.16) * kk; }
      y = Math.cos(ang) * r; z = Math.sin(ang) * r;
      return tf(x, y, z);
    };
    pts.push({ i, g, e, a: mk(a, 0), b: mk(a + GROOVE, 1) });
  }
  return pts;
}

// 球として並べる。pr: 透視投影（kit.camera）。alpha: 全体の出かた
export function drawHelix(sph, dots, pr, pts, o) {
  const gold = o.gold || 0, soul = o.soul || 0, appear = o.appear ?? 1, tint = soul > 0.02 ? [0.8, 0.95, 1.0] : [1.0, 0.5, 0.06], tk = Math.max(gold * 0.72, soul * 0.75);
  const put = (p, r, col, em = 0) => { const q = pr(p); if (q[3] < 0.5) return; const sh = lerp(1.0, 0.3, sat((q[3] - 6.6) / 4.4)) * appear; sph.add(q[0], q[1], r * q[2], q[3], col, sh, em * appear); };
  for (let k = 0; k < pts.length; k++) {
    const P = pts[k], N = pts[k + 1], same = N && N.g === P.g, i = P.i;
    const ca = mixc(SA, tint, tk), cb = mixc(SB, tint, tk), em = 0.1 + (soul > 0.02 ? 0.9 : 0.42) * tk;
    put(P.a, 0.205, ca, em * 0.5); put(P.b, 0.205, cb, em * 0.5);
    if (N && (same || (P.e < 0.02 && N.e < 0.02))) {      // 鎖のつながり（欠片の境目は、離れたら描かない）
      const cutA = o.ssb && o.ssb.some(([bi, kk, st]) => st === 0 && kk > 0.25 && (i === Math.floor(bi) || i === Math.floor(bi) - 0)), cutB = o.ssb && o.ssb.some(([bi, kk, st]) => st === 1 && kk > 0.25 && i === Math.floor(bi));
      if (!cutA) put(v3.lerp(P.a, N.a, 0.5), 0.175, ca, em * 0.5);
      if (!cutB) put(v3.lerp(P.b, N.b, 0.5), 0.175, cb, em * 0.5);
    }
    const bc = BASE[i % 4];
    for (let j = 1; j <= 3; j++) {
      put(v3.lerp(P.a, P.b, j * 0.135), 0.118, mixc(bc[0], tint, tk * 0.8), em * 0.35);
      put(v3.lerp(P.b, P.a, j * 0.135), 0.118, mixc(bc[1], tint, tk * 0.8), em * 0.35);
    }
    if (tk > 0.03 && dots) { const c = pr(v3.lerp(P.a, P.b, 0.5)); dots.add(c[0], c[1], 0.34 * c[2], 0.5 * tk * appear * (0.75 + 0.25 * Math.sin(o.t * 6 + i * 0.9)), tint); }   // 結合の光
  }
}
// 形の手本（魂が呼び起こす、元のらせん）: 小さな光の点で描く
export function drawGhostHelix(dots, pr, phi, k) {
  if (k <= 0.01) return;
  for (let i = 0; i < NBP; i += 0.5) {
    const x0 = (i - (NBP - 1) / 2) * RISE, a = (i / PER) * TAU + phi;
    for (const an of [a, a + GROOVE]) { const q = pr([x0, Math.cos(an) * RAD, Math.sin(an) * RAD]); dots.add(q[0], q[1], 0.11 * q[2], 0.55 * k * lerp(1, 0.35, sat((q[3] - 7) / 4)), COL.soul); }
    if (i % 1 === 0) for (let j = 1; j <= 5; j++) { const u = j / 6; const q = pr([x0, lerp(Math.cos(a), Math.cos(a + GROOVE), u) * RAD, lerp(Math.sin(a), Math.sin(a + GROOVE), u) * RAD]); dots.add(q[0], q[1], 0.05 * q[2], 0.3 * k, COL.soul); }
  }
}
