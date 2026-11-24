// figure.js — 作業員。関節の位置を逆運動学で解いて、2D キャンバスに描く（横向き。右が前）
//   姿勢は「腰・足首・手の位置」と「体の傾き・頭の傾き・口の開き」で決める（単位は U。y は上が正）。
import { clamp, lerp } from './core.js';

export const U = 76;            // 体の 1 単位（px）。身長はおよそ 6.3 U
export const FLOOR = 880;       // 床の高さ（ワールド座標 = 引きの画面の px）
const L = { thigh: 1.45, shin: 1.45, torso: 1.95, neck: 0.3, head: 0.47, upper: 1.05, fore: 0.95 };
const D2R = Math.PI / 180;

// ---- 姿勢
const base = { hip: [0, 3.02], lean: 2, head: 0, footN: [0.22, 0.2], footF: [-0.18, 0.2], toeN: 0, toeF: 0, handN: [0.12, -1.93], handF: [-0.05, -1.9], bendN: 'b', bendF: 'b', jaw: 0 };
const mk = (o) => ({ ...base, ...o });
export const POSE = {
  stand: mk({}),
  work: mk({ lean: 4, head: 6, handN: [0.78, -0.72], handF: [0.6, -0.9], bendN: 'd', bendF: 'd' }),
  look: mk({ lean: 1, head: -6, handN: [0.7, -0.9], handF: [0.1, -1.9], bendN: 'd' }),
  hit: mk({ hip: [-0.3, 2.86], lean: -15, head: -20, footN: [0.42, 0.2], footF: [-0.85, 0.2], handN: [0.72, 0.5], handF: [0.52, 0.22], bendN: 'd', bendF: 'd', jaw: 0.7 }),
  kneel: mk({ hip: [-0.15, 1.62], lean: 30, head: 26, footN: [0.62, 0.2], footF: [-1.35, 0.26], toeF: 60, handN: [0.5, -1.62], handF: [0.15, -1.3], bendN: 'b', bendF: 'b', jaw: 0.2 }),
  brace: mk({ hip: [0, 2.36], lean: 12, head: -4, footN: [1.0, 0.2], footF: [-1.0, 0.2], handN: [0.42, -0.95], handF: [0.3, -0.85], bendN: 'b', bendF: 'b', jaw: 0.25 }),
  roar: mk({ hip: [0, 2.44], lean: -7, head: -30, footN: [1.05, 0.2], footF: [-1.05, 0.2], handN: [0.62, -0.72], handF: [-0.5, -0.78], bendN: 'b', bendF: 'b', jaw: 1 }),
  roar2: mk({ hip: [0, 2.26], lean: 15, head: -16, footN: [1.1, 0.2], footF: [-1.05, 0.2], handN: [0.5, -1.05], handF: [-0.25, -1.0], bendN: 'b', bendF: 'b', jaw: 1 }),
  stagger: mk({ hip: [-0.2, 2.7], lean: 22, head: 28, footN: [0.5, 0.2], footF: [-0.62, 0.2], handN: [0.3, -1.85], handF: [0.0, -1.8], jaw: 0.55 }),
  vomit: mk({ hip: [-0.35, 2.5], lean: 56, head: 26, footN: [0.52, 0.2], footF: [-0.75, 0.2], handN: [0.1, -1.45], handF: [-0.1, -1.4], jaw: 1 }),
  knees: mk({ hip: [0, 1.6], lean: 32, head: 44, footN: [-1.1, 0.26], footF: [-1.22, 0.26], toeN: 75, toeF: 75, handN: [0.1, -1.9], handF: [-0.12, -1.85], jaw: 0.35 }),
  walkA: mk({ hip: [0, 2.78], lean: 27, head: -8, footN: [1.0, 0.2], footF: [-0.95, 0.32], toeF: 35, handN: [-0.55, -1.15], handF: [0.95, -0.35], bendN: 'b', bendF: 'd', jaw: 1 }),
  walkB: mk({ hip: [0, 2.78], lean: 27, head: -8, footN: [-0.95, 0.32], footF: [1.0, 0.2], toeN: 35, handN: [0.95, -0.35], handF: [-0.55, -1.15], bendN: 'd', bendF: 'b', jaw: 1 }),
  reach: mk({ hip: [0, 2.62], lean: 20, head: -14, footN: [0.95, 0.2], footF: [-1.0, 0.2], handN: [1.5, 0.1], handF: [0.7, -0.6], bendN: 'd', bendF: 'b', jaw: 1 }),
  slam: mk({ hip: [0.2, 2.1], lean: 36, head: -6, footN: [1.05, 0.2], footF: [-1.0, 0.2], handN: [1.35, -1.25], handF: [0.6, -0.9], bendN: 'd', bendF: 'b', jaw: 1 }),
  after: mk({ hip: [0, 3.0], lean: 5, head: 14, handN: [0.2, -1.92], handF: [0.02, -1.9], jaw: 0.12 }),
  dawn: mk({ hip: [0, 3.02], lean: -1, head: -14, jaw: 0 }),
};
const NUM = ['lean', 'head', 'toeN', 'toeF', 'jaw'], VEC = ['hip', 'footN', 'footF', 'handN', 'handF'];
export function mixPose(a, b, k) {
  if (k <= 0) return a; if (k >= 1) return b;
  const o = { bendN: k < 0.5 ? a.bendN : b.bendN, bendF: k < 0.5 ? a.bendF : b.bendF };
  for (const n of NUM) o[n] = lerp(a[n], b[n], k);
  for (const v of VEC) o[v] = [lerp(a[v][0], b[v][0], k), lerp(a[v][1], b[v][1], k)];
  return o;
}

function ik(r, t, l1, l2, bend) {
  let dx = t[0] - r[0], dy = t[1] - r[1]; const d0 = Math.hypot(dx, dy) || 1e-6;
  const d = clamp(d0, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.9995);
  dx *= d / d0; dy *= d / d0;
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), th = Math.atan2(dy, dx);
  const j1 = [r[0] + l1 * Math.cos(th + a), r[1] + l1 * Math.sin(th + a)], j2 = [r[0] + l1 * Math.cos(th - a), r[1] + l1 * Math.sin(th - a)];
  const pick = bend === 'f' ? j1[0] > j2[0] : bend === 'b' ? j1[0] < j2[0] : bend === 'd' ? j1[1] > j2[1] : j1[1] < j2[1];
  return [pick ? j1 : j2, [r[0] + dx, r[1] + dy]];
}

// 姿勢 → 関節の位置（ワールド座標）。gx: 腰の真下の床の x。sc: 体の大きさ
export function solve(pose, gx, { u = U, floor = FLOOR, handNWorld = null } = {}) {
  const P = (p) => [gx + p[0] * u, floor - p[1] * u];
  const hip = P(pose.hip), ln = pose.lean * D2R;
  const up = [Math.sin(ln), -Math.cos(ln)], fw = [Math.cos(ln), Math.sin(ln)];
  const sh = [hip[0] + up[0] * L.torso * u, hip[1] + up[1] * L.torso * u];
  const ha = (pose.lean * 0.55 + pose.head * 0.45) * D2R;
  const hc = [sh[0] + Math.sin(ha) * (L.neck + L.head) * u, sh[1] - Math.cos(ha) * (L.neck + L.head) * u];
  const sN = [sh[0] - fw[0] * 0.26 * u, sh[1] - fw[1] * 0.26 * u + 0.05 * u], sF = [sh[0] + fw[0] * 0.3 * u, sh[1] + fw[1] * 0.3 * u + 0.03 * u];
  const hN = [hip[0] + 0.08 * u, hip[1]], hF = [hip[0] - 0.08 * u, hip[1] - 0.02 * u];
  const tgtN = handNWorld || [sN[0] + pose.handN[0] * u, sN[1] - pose.handN[1] * u];
  const [eN, wN] = ik(sN, tgtN, L.upper * u, L.fore * u, pose.bendN);
  const [eF, wF] = ik(sF, [sF[0] + pose.handF[0] * u, sF[1] - pose.handF[1] * u], L.upper * u, L.fore * u, pose.bendF);
  const [kN, aN] = ik(hN, P(pose.footN), L.thigh * u, L.shin * u, 'f');
  const [kF, aF] = ik(hF, P(pose.footF), L.thigh * u, L.shin * u, 'f');
  return { u, hip, sh, hc, sN, sF, hN, hF, eN, wN, eF, wF, kN, aN, kF, aF, lean: pose.lean, face: (pose.head + pose.lean * 0.35) * D2R, jaw: pose.jaw, toeN: pose.toeN * D2R, toeF: pose.toeF * D2R, up, fw, floor };
}

// ---- 描画
const circ = (c, p, r) => { c.beginPath(); c.arc(p[0], p[1], r, 0, 6.2832); c.fill(); };
function limb(c, a, b, ra, rb) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  c.beginPath(); c.moveTo(a[0] + nx * ra, a[1] + ny * ra); c.lineTo(b[0] + nx * rb, b[1] + ny * rb); c.lineTo(b[0] - nx * rb, b[1] - ny * rb); c.lineTo(a[0] - nx * ra, a[1] - ny * ra); c.closePath(); c.fill();
  circ(c, a, ra); circ(c, b, rb);
}
function boot(c, a, ang, u, col) {
  c.save(); c.translate(a[0], a[1]); c.rotate(ang);
  c.fillStyle = col;
  c.beginPath(); c.moveTo(-0.2 * u, -0.26 * u); c.lineTo(0.2 * u, -0.26 * u); c.quadraticCurveTo(0.3 * u, -0.05 * u, 0.62 * u, 0.0); c.quadraticCurveTo(0.74 * u, 0.04 * u, 0.72 * u, 0.2 * u); c.lineTo(-0.24 * u, 0.2 * u); c.closePath(); c.fill();
  c.restore();
}

// look: { helmet 0/1, tatter 0..1, eye 0..1（金色に光る）, shut 0..1（目をつぶる）, hair 0..1（逆立つ）, flat: 色（影絵にする） }
export function drawFigure(c, J, look = {}) {
  const u = J.u, flat = look.flat || null, tat = look.tatter || 0;
  const C = flat ? new Proxy({}, { get: () => flat }) : {
    suit: '#63768d', suitD: '#46566c', suitL: '#74889f', belt: '#262a31', glove: '#dcd8c8', gloveD: '#aaa697', boot: '#20242a', bootD: '#181b20',
    skin: '#e6b18c', skinD: '#b98566', helmet: '#f2c531', helmetD: '#c79a16', hair: '#14110e', mouth: '#5c0a10', teeth: '#f4efe4', white: '#f6f4ee',
  };
  // 奥の腕・奥の脚
  c.fillStyle = tat > 0.55 ? C.skinD : C.suitD; limb(c, J.sF, J.eF, 0.27 * u, 0.23 * u);
  c.fillStyle = tat > 0.3 ? C.skinD : C.suitD; limb(c, J.eF, J.wF, 0.23 * u, 0.18 * u);
  c.fillStyle = C.gloveD; circ(c, J.wF, 0.24 * u);
  c.fillStyle = C.suitD; limb(c, J.hF, J.kF, 0.37 * u, 0.28 * u); limb(c, J.kF, J.aF, 0.28 * u, 0.2 * u);
  boot(c, J.aF, J.toeF, u, C.bootD);
  // 胴
  const n = J.fw, a = J.hip, b = J.sh, mid = [lerp(a[0], b[0], 0.72), lerp(a[1], b[1], 0.72)];
  const w0 = 0.44 * u, w1 = 0.66 * u, w2 = 0.6 * u;
  c.fillStyle = C.suit;
  c.beginPath();
  c.moveTo(a[0] - n[0] * w0, a[1] - n[1] * w0);
  c.quadraticCurveTo(mid[0] - n[0] * w1 * 1.08, mid[1] - n[1] * w1 * 1.08, b[0] - n[0] * w2, b[1] - n[1] * w2);
  c.lineTo(b[0] + n[0] * w2, b[1] + n[1] * w2);
  c.quadraticCurveTo(mid[0] + n[0] * w1 * 1.12, mid[1] + n[1] * w1 * 1.12, a[0] + n[0] * w0, a[1] + n[1] * w0);
  c.closePath(); c.fill();
  circ(c, [a[0], a[1] + 0.05 * u], w0 * 1.02);
  circ(c, [b[0] - n[0] * 0.3 * u, b[1] - n[1] * 0.3 * u], 0.36 * u); circ(c, [b[0] + n[0] * 0.3 * u, b[1] + n[1] * 0.3 * u], 0.36 * u);
  if (!flat) {
    // ベルト・胸の線量計
    const bl = [lerp(a[0], b[0], 0.1), lerp(a[1], b[1], 0.1)];
    c.strokeStyle = C.belt; c.lineWidth = 0.13 * u; c.lineCap = 'butt'; c.beginPath(); c.moveTo(bl[0] - n[0] * w0 * 1.05, bl[1] - n[1] * w0 * 1.05); c.lineTo(bl[0] + n[0] * w0 * 1.07, bl[1] + n[1] * w0 * 1.07); c.stroke();
    if (tat < 0.5) {
      const ch = [lerp(a[0], b[0], 0.7) + n[0] * 0.24 * u, lerp(a[1], b[1], 0.7) + n[1] * 0.24 * u];
      c.save(); c.translate(ch[0], ch[1]); c.rotate(J.lean * D2R); c.fillStyle = C.white; c.fillRect(-0.09 * u, -0.13 * u, 0.2 * u, 0.28 * u); c.fillStyle = look.badge || '#39d98a'; c.fillRect(-0.04 * u, -0.08 * u, 0.1 * u, 0.07 * u); c.restore();
    }
    if (tat > 0.2) {   // 破れた胸元
      c.fillStyle = C.skin; const q = (s, k) => [lerp(a[0], b[0], s) + n[0] * k * u, lerp(a[1], b[1], s) + n[1] * k * u];
      c.beginPath(); [q(0.95, -0.1), q(0.98, 0.36), q(0.78, 0.44), q(0.6, 0.2), q(0.7, 0.05), q(0.52, -0.08), q(0.78, -0.2)].forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill();
      if (tat > 0.6) { c.beginPath(); [q(0.4, 0.3), q(0.3, 0.42), q(0.16, 0.36), q(0.26, 0.18)].forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); }
    }
  }
  // 手前の脚
  c.fillStyle = C.suit; limb(c, J.hN, J.kN, 0.38 * u, 0.29 * u); limb(c, J.kN, J.aN, 0.29 * u, 0.21 * u);
  if (!flat && tat > 0.45) { c.fillStyle = C.skin; const k2 = [lerp(J.kN[0], J.aN[0], 0.18), lerp(J.kN[1], J.aN[1], 0.18)]; circ(c, [lerp(J.hN[0], J.kN[0], 0.86), lerp(J.hN[1], J.kN[1], 0.86)], 0.2 * u); circ(c, k2, 0.17 * u); }
  boot(c, J.aN, J.toeN, u, C.boot);
  // 首・頭
  const hc = J.hc, rh = L.head * u;
  c.fillStyle = C.skinD; limb(c, [J.sh[0], J.sh[1] + 0.05 * u], [hc[0] - 0.08 * u, hc[1] + 0.3 * u], 0.2 * u, 0.19 * u);
  c.save(); c.translate(hc[0], hc[1]); c.rotate(J.face); c.scale(rh, rh);
  const jaw = J.jaw * 0.5;                       // あごの回転（ラジアン）
  const rot = (p) => { const x = p[0] + 0.1, y = p[1] - 0.42, cs = Math.cos(jaw), sn = Math.sin(jaw); return [x * cs - y * sn - 0.1, x * sn + y * cs + 0.42]; };
  const path = (pts) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); };
  const lowLip = rot([1.0, 0.66]), lowIn = rot([0.42, 0.62]);
  if (!flat && J.jaw > 0.05) {                   // 口の中
    c.fillStyle = C.mouth; path([[0.4, 0.6], [1.04, 0.56], lowLip, lowIn]);
    c.fillStyle = C.teeth; path([[0.62, 0.585], [1.02, 0.56], [1.0, 0.66], [0.64, 0.66]]);
    const t0 = rot([0.62, 0.64]), t1 = rot([0.98, 0.66]), t2 = rot([0.96, 0.57]), t3 = rot([0.64, 0.56]); path([t0, t1, t2, t3]);
  }
  c.fillStyle = C.skin;
  c.beginPath(); c.arc(0, 0, 1, 0, 6.2832); c.fill();
  path([[0.5, -0.86], [0.84, -0.52], [0.99, -0.2], [0.95, 0.02], [1.24, 0.3], [1.02, 0.42], [1.07, 0.56], [0.42, 0.62], [-0.3, 0.72], [-0.4, 0]]);
  path([rot([0.42, 0.6]), rot([1.02, 0.65]), rot([1.0, 1.0]), rot([0.64, 1.18]), rot([-0.08, 0.98]), rot([-0.3, 0.42])]);
  if (!flat) {
    c.fillStyle = C.skinD; c.beginPath(); c.ellipse(-0.12, 0.2, 0.17, 0.26, 0, 0, 6.2832); c.fill();      // 耳
    // 眉と目
    const shut = look.shut || 0, glow = look.eye || 0;
    c.strokeStyle = C.hair; c.lineWidth = 0.11; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0.42, -0.2 - 0.1 * (1 - shut)); c.lineTo(0.9, -0.06 + 0.04 * shut); c.stroke();
    if (shut > 0.6) { c.lineWidth = 0.07; c.beginPath(); c.moveTo(0.5, 0.1); c.lineTo(0.84, 0.13); c.stroke(); }
    else {
      c.fillStyle = glow > 0.3 ? '#fff6cf' : C.white; c.beginPath(); c.moveTo(0.46, 0.02); c.lineTo(0.88, 0.07); c.lineTo(0.8, 0.22); c.lineTo(0.5, 0.18); c.closePath(); c.fill();
      c.fillStyle = glow > 0.3 ? '#ffb020' : '#17110c'; c.beginPath(); c.arc(0.72, 0.12, 0.085, 0, 6.2832); c.fill();
    }
  }
  if (look.helmet) {
    c.fillStyle = C.helmet; c.beginPath(); c.arc(0.0, -0.1, 1.13, Math.PI * 0.98, Math.PI * 2.02); c.lineTo(1.62, -0.02); c.lineTo(1.6, 0.1); c.lineTo(-1.15, 0.08); c.closePath(); c.fill();
    if (!flat) { c.fillStyle = C.helmetD; c.fillRect(-1.13, -0.16, 2.72, 0.12); c.fillStyle = '#ffffff'; c.globalAlpha = 0.35; c.beginPath(); c.ellipse(-0.25, -0.75, 0.42, 0.16, -0.5, 0, 6.2832); c.fill(); c.globalAlpha = 1; }
  } else {
    const hs = look.hair || 0, sp = (x, y, k) => [x * (1 + 0.5 * hs * k), y * (1 + 0.62 * hs * k)];   // 髪。気合いで逆立つ
    c.fillStyle = C.hair;
    const pts = [[0.86, -0.52], [0.98, -0.72], sp(0.74, -1.02, 1), [0.5, -0.9], sp(0.34, -1.22, 1.2), [0.1, -1.0], sp(-0.2, -1.26, 1.3), [-0.42, -0.92], sp(-0.78, -1.02, 1.1), [-0.82, -0.6], sp(-1.2, -0.52, 0.9), [-0.98, -0.2],
      sp(-1.22, 0.1, 0.5), [-0.9, 0.3], [-0.66, 0.5], [-0.38, 0.1], [-0.3, -0.3], [0.3, -0.52]];
    path(pts);
  }
  c.restore();
  // 手前の腕
  c.fillStyle = (!flat && tat > 0.75) ? C.skin : C.suitL; limb(c, J.sN, J.eN, 0.29 * u, 0.24 * u);
  c.fillStyle = (!flat && tat > 0.35) ? C.skin : C.suitL; limb(c, J.eN, J.wN, 0.24 * u, 0.19 * u);
  c.fillStyle = C.glove; circ(c, J.wN, 0.26 * u);
}

// 口の位置（吐き出すものの出どころ）と向き
export function mouthOf(J) {
  const rh = L.head * J.u, cs = Math.cos(J.face), sn = Math.sin(J.face), x = 1.0 * rh, y = 0.62 * rh;
  return { p: [J.hc[0] + x * cs - y * sn, J.hc[1] + x * sn + y * cs], d: [cs, sn] };
}
export function eyeOf(J) {
  const rh = L.head * J.u, cs = Math.cos(J.face), sn = Math.sin(J.face), x = 0.72 * rh, y = 0.12 * rh;
  return [J.hc[0] + x * cs - y * sn, J.hc[1] + x * sn + y * cs];
}
