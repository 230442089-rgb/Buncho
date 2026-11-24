// act.js — 舞台の場面（作業室と男）。時刻 t から、姿勢・カメラ・光・効果をすべて決める。
import { W, H, T, P, Q, SHOUTS, VO, shoutEnv, DURATION, sat, smoothstep as sm, ease, lerp, clamp, TAU, COL, hash1, noise1, pulse } from '../core.js';
import { Stage, SRC, LEVER, leverTip } from '../stage.js';
import { rr } from '../../../atom/src/kit.js';
import { Fx } from '../fx.js';
import { POSE, mixPose, solve, U, FLOOR, mouthOf } from '../figure.js';

// 舞台を映している区間（それ以外は、身体の中の場面）
export const STAGE_WIN = [[0, T.inside], [T.decide, T.hold], [T.kiai1b, T.cells1], [T.lull, T.shatter], [T.dark, T.soulCells], [T.bullets, DURATION + 1]];
export const inStage = (t) => STAGE_WIN.some(([a, b]) => t >= a && t < b);

POSE.fire = { ...POSE.roar2, hip: [0, 2.3], lean: 18, head: -12, handN: [0.45, -1.05], handF: [-0.3, -1.0] };
// [時刻, 姿勢, 移り変わる秒数, 行き過ぎて戻るか]
const KEYS = [
  [0, 'work', 0], [4.4, 'look', 0.9], [6.5, 'work', 0.9],
  [8.0, 'hit', 0.14, 1], [9.5, 'stagger', 1.0], [12.0, 'kneel', 1.3],
  [27.3, 'brace', 2.2], [29.92, 'roar', 0.2, 1], [33.55, 'brace', 0.4],
  [49.92, 'roar2', 0.2, 1], [53.5, 'brace', 0.4],
  [58.0, 'after', 0.01], [62.0, 'hit', 0.1, 1], [63.1, 'stagger', 0.6], [66.5, 'vomit', 0.6], [70.3, 'knees', 0.6],
  [76.92, 'roar', 0.24, 1], [80.35, 'brace', 0.5], [80.95, 'roar2', 0.18, 1],
  [100.9, 'fire', 0.2, 1], [116.5, 'reach', 0.45], [T.stop, 'slam', 0.12, 1], [126.8, 'after', 1.6], [T.dawn - 0.05, 'dawn', 0.01],
];
function poseAt(t) {
  let k = 0; while (k + 1 < KEYS.length && KEYS[k + 1][0] <= t) k++;
  const [t0, name, dur, back] = KEYS[k], prev = k ? POSE[KEYS[k - 1][1]] : POSE[name];
  if (!dur) return { ...POSE[name] };
  const u = sat((t - t0) / dur);
  return mixPose(prev, POSE[name], back ? ease.outBack(u, 1.2) : ease.inOutCubic(u));
}
// 歩き（1 歩 1 秒 × 8 歩。足は床に固定して、腰だけが進む）
const WALK0 = 700, WALK1 = 1158, STEPS = 8;
const walkX = (t) => { const u = clamp((t - T.walk) / STEPS, 0, 1), k = Math.floor(u * STEPS), f = u * STEPS - k; return lerp(WALK0, WALK1, (k + ease.inOutSine(sat(f * 1.25))) / STEPS); };
function walkPose(t) {
  const u = clamp(t - T.walk, 0, STEPS - 1e-4), k = Math.floor(u), f = u - k, stride = (WALK1 - WALK0) / STEPS;
  const gx = walkX(t), land = (i) => WALK0 + stride * (i + 1) + 0.9 * U, plant = (i) => (i < 0 ? WALK0 + (i === -1 ? 0.75 : -0.8) * U : land(i));
  const sw = lerp(plant(k - 2), plant(k), ease.inOutSine(sat(f / 0.7))), stx = plant(k - 1), lift = 0.2 + 0.42 * Math.sin(Math.PI * sat(f / 0.7));
  const swing = [(sw - gx) / U, lift], stance = [(stx - gx) / U, 0.2];
  const nearSwing = k % 2 === 0, m = mixPose(POSE.walkB, POSE.walkA, nearSwing ? ease.inOutSine(sat(f / 0.7)) : 1 - ease.inOutSine(sat(f / 0.7)));
  const p = { ...m, footN: nearSwing ? swing : stance, footF: nearSwing ? stance : swing, toeN: nearSwing ? 30 * Math.sin(Math.PI * sat(f / 0.7)) : 0, toeF: nearSwing ? 0 : 30 * Math.sin(Math.PI * sat(f / 0.7)) };
  p.hip = [0, 2.74 - 0.1 * Math.sin(Math.PI * sat(f / 0.7))];
  return p;
}
const GX = (t) => (t < T.walk ? 700 : t < T.dawn - 0.05 ? walkX(t) : 880);

// カメラ（場面ごと。中ではゆっくり寄る）
function camAt(t, gx) {
  const k = (a, b) => sat((t - a) / (b - a));
  if (t < T.flash1) return { s: lerp(1.03, 1.1, k(0, 8)), fx: lerp(950, 990, k(0, 8)), fy: 545 };
  if (t < T.inside) return { s: lerp(1.2, 1.3, ease.outCubic(k(8, 14))), fx: 1070, fy: 560 };
  if (t < T.kiai1) return { s: lerp(2.0, 2.45, ease.inOutSine(k(26, 30))), fx: gx + 50, fy: lerp(600, 520, ease.inOutSine(k(26.5, 29.5))) };
  if (t < T.hold) return { s: lerp(1.36, 1.24, ease.outCubic(k(30, 31.2))), fx: 800, fy: 540 };
  if (t < T.cells1) return { s: lerp(1.9, 1.72, ease.outCubic(k(50, 51))), fx: gx + 70, fy: 585 };
  if (t < T.flash2) return { s: lerp(1.12, 1.18, k(58, 62)), fx: 1010, fy: 545 };
  if (t < T.vomit) return { s: lerp(1.3, 1.2, ease.outCubic(k(62, 63.5))), fx: 960, fy: 550 };
  if (t < T.shatter) return { s: lerp(1.9, 2.05, k(67, 71)), fx: gx + 130, fy: 640 };
  if (t < T.kiai2 - 0.1) return { s: lerp(1.75, 1.9, k(75.4, 77)), fx: gx + 20, fy: 690 };
  if (t < Q(1) - 0.1) return { s: lerp(1.42, 1.2, ease.outCubic(k(76.9, 78.2))), fx: 770, fy: lerp(600, 540, ease.outCubic(k(76.9, 78.2))) };
  if (t < T.soulCells) return { s: lerp(1.7, 1.86, k(80.9, 85)), fx: gx + 40, fy: 575 };
  if (t < T.walk) return { s: lerp(1.2, 1.16, k(101, 109)), fx: 1045, fy: 540 };
  if (t < T.last - 0.5) return { s: 1.32, fx: gx + 250, fy: 548 };
  if (t < T.stop) return { s: lerp(1.42, 1.78, ease.inQuad(k(116.5, 125))), fx: lerp(gx + 250, 1335, ease.outCubic(k(116.5, 118))), fy: lerp(548, 565, k(116.5, 125)) };
  if (t < T.dawn - 0.05) return { s: lerp(1.78, 1.46, ease.outCubic(k(125, 129.5))), fx: 1300, fy: 560 };
  if (t >= 133.8 && t < 137.6) return { s: lerp(1.9, 2.02, k(133.8, 137.6)), fx: gx + 60, fy: 560 };
  return { s: lerp(1.06, 1.13, k(130, 152)), fx: lerp(930, 950, k(130, 152)), fy: 545 };
}

export const id = 'act';
export async function create(env) {
  const stage = new Stage(env), fx = new Fx(env);
  const helmet = (c, x, y, rot, sc) => { c.save(); c.translate(x, y); c.rotate(rot); c.scale(sc, sc); c.fillStyle = '#f2c531'; c.beginPath(); c.arc(0, -0.1, 1.13, Math.PI * 0.98, Math.PI * 2.02); c.lineTo(1.62, -0.02); c.lineTo(1.6, 0.1); c.lineTo(-1.15, 0.08); c.closePath(); c.fill(); c.fillStyle = '#c79a16'; c.fillRect(-1.13, -0.16, 2.72, 0.12); c.restore(); };
  // 二度目の閃光で飛び散った血のあと（床）
  const SPLAT = Array.from({ length: 70 }, (_, i) => [700 + (hash1(i * 3.3) - 0.5) * 1100 * (0.3 + 0.7 * hash1(i * 1.1)), FLOOR + 8 + 62 * hash1(i * 5.7), 6 + 26 * hash1(i * 7.9) ** 2, hash1(i * 2.9)]);
  const SHOTS = [];
  for (const [a, b] of [[101.45, 103.5], [104.3, 106.4], [107.0, 108.7]]) for (let s = a; s < b; s += 0.085) SHOTS.push(s + 0.03 * hash1(s * 7.7));

  function state(t) {
    const env1 = shoutEnv(t), gx = GX(t);
    let pose = t >= T.walk && t < 116.5 ? walkPose(t) : poseAt(t);
    const after2 = t >= T.flash2, soulOn = t >= T.dark;
    // 光
    const lamp = t < T.flash1 ? 1 : t < T.flash1 + 0.5 ? (hash1(Math.floor(t * 30) * 1.7) > 0.5 ? 0.6 : 0) * (1 - (t - 8) / 0.5) : 0;
    const dawn = sm(T.dawn - 0.1, T.dawn + 0.3, t);
    let blue = 0;
    if (t >= T.flash1 && t < T.flash2) blue = 1 + 0.8 * pulse(t, T.flash1, 0.35) - 0.12 * sm(57, 60, t) + (t > 61.3 ? 0.5 * hash1(Math.floor(t * 30)) * sm(61.3, 62, t) : 0);
    else if (t >= T.flash2 && t < T.stop) blue = 1.5 + 1.2 * pulse(t, T.flash2, 0.5) + 0.4 * sm(T.walk, T.stop, t);
    else if (t >= T.stop) blue = 1.9 * (1 - ease.outCubic(sat((t - T.stop) / 0.4))) * (1 - sat((t - T.stop) / 0.4)) + 0.22 * sat((t - T.stop) / 0.4) * (1 - sat((t - T.stop - 0.4) / 3.8)) ** 2;
    const amb = t < T.flash1 ? 0.52 : t < T.stop ? (after2 ? 0.16 : 0.2) : lerp(0.21, 0.44, dawn);
    const alarm = t > T.flash1 + 0.5 && t < T.stop + 0.3 ? 1 : 0;
    // 気合い
    let aura = 0;
    if (t >= 29.9 && t < T.flash2) aura = sat((t - 29.9) / 0.3) * (0.78 + 0.3 * env1 + 0.25 * pulse(t, T.kiai1, 0.6) + 0.35 * pulse(t, T.kiai1b, 0.8)) * lerp(1, 0.55, sm(57.5, 59, t));
    if (t >= T.flash2) aura = 0.6 * (1 - sat((t - T.flash2) / 0.22));
    if (t >= 76.0 && t < 76.92) aura = 0.06;
    if (t >= 76.92 && t < T.stop) aura = 1.05 + 0.35 * env1 + 0.3 * SHOUTS.reduce((m, q) => Math.max(m, pulse(t, q, 0.5)), 0) + 0.45 * sm(T.last, T.stop, t);
    if (t >= T.stop) aura = 1.6 * (1 - sat((t - T.stop) / 2.6)) ** 2;
    const strain = sat(env1 * 0.9 + (t > 27.4 && t < 30 ? sat((t - 27.4) / 2) * 0.5 : 0) + (t >= T.last && t < T.stop ? 0.6 : 0));
    // 体のふるえ・息
    const tr = 0.012 + 0.05 * strain + (t >= T.flash2 && t < T.dark ? 0.03 : 0);
    pose.hip = [pose.hip[0] + noise1(t * 23, 1) * tr, pose.hip[1] + noise1(t * 27, 2) * tr * 0.6 + 0.012 * Math.sin(t * (t > 58 && t < 62 || t > 125.5 && t < 130 ? 7 : 2.2))];
    pose.lean += noise1(t * 19, 3) * tr * 40;
    pose.head += noise1(t * 21, 4) * tr * 50;
    if (!(t >= T.walk && t < 116.5)) { pose.handN = [pose.handN[0] + noise1(t * 31, 5) * tr * 0.9, pose.handN[1] + noise1(t * 29, 6) * tr * 0.9]; pose.handF = [pose.handF[0] + noise1(t * 33, 7) * tr * 0.9, pose.handF[1] + noise1(t * 28, 8) * tr * 0.9]; }
    pose.jaw = Math.max(pose.jaw * (t > 26 && env1 < 0.05 && !(t >= 67 && t < 71) ? 0.25 : 1), env1 * (0.86 + 0.14 * noise1(t * 30, 9)));
    if (t >= T.vomit && t < T.shatter - 0.6) pose.jaw = 1;
    if (t > 76 && t < 76.92) pose.head = lerp(pose.head, 6, sat((t - 76) / 0.8));
    if (t > 58 && t < 62) { pose.lean += 6; pose.hip[1] -= 0.12; pose.jaw = 0.3 + 0.2 * Math.sin(t * 7); }
    const lever = t < T.last ? 0 : t < T.stop ? 0.06 * sat((t - 117) / 1) + 0.05 * sm(121, 125, t) + 0.012 * noise1(t * 30, 11) : lerp(0.11, 1, ease.outBack(sat((t - T.stop) / 0.13), 1.1));
    const grab = t >= 116.95 && t < 126.8;
    const look = {
      helmet: t < T.flash2 ? 1 : 0, tatter: t < T.flash2 ? 0 : lerp(0.62, 1, sm(76.9, 77.3, t)), hair: after2 ? sat(aura * 0.75) : 0,
      eye: t < 28.7 ? 0 : t < T.flash2 ? sat((t - 28.7) / 0.25) : t < 76.92 ? 0 : t < 126 ? 1 : 1 - sat((t - 126) / 1.5),
      shut: (t >= 8 && t < 9.2) || (t >= T.flash2 && t < 76.3) ? 1 : 0, badge: t < 8 ? '#39d98a' : (Math.floor(t * 4) % 2 ? '#ff3b2a' : '#5a0f0a'),
    };
    const blood = t < 63 ? 0 : t < T.dawn ? lerp(0.5, 0.92, sm(63, 78, t)) : 0.62;
    return { t, gx, pose, look, lamp, dawn, blue, amb, alarm, aura, soul: soulOn ? 1 : 0, strain, env1, lever, grab, blood, cam: camAt(t, gx), clock: t < T.dawn - 0.1 ? 2.18 + t / 3600 : 5.78, clip: t < 8 };
  }

  const layer = {
    id: 'stage', t0: 0, t1: DURATION + 1,
    render(env, tl, t) {
      if (!inStage(t)) return;
      const p = env.p, st = state(t), cam = st.cam, f = env.frame;
      fx.setCam(cam);
      const J = solve(st.pose, st.gx, { handNWorld: st.grab ? leverTip(st.lever) : null });
      if (st.grab) st.handNWorld = leverTip(st.lever);
      const chest = [lerp(J.hip[0], J.sh[0], 0.6), lerp(J.hip[1], J.sh[1], 0.6)], mouth = mouthOf(J);
      // ---- 血（時刻の関数）
      fx.bloodBegin();
      if (t >= 62.9 && t < T.dawn) {
        const body = [J.sh, J.hip, J.eN, J.kN, J.wN, J.kF, J.eF, chest, J.hc];
        if (t < 66) body.forEach((q, i) => { const a = Math.atan2(q[1] - chest[1] - 40, q[0] - chest[0]) + (i === 7 ? -1.2 : 0); fx.bloodEmit(t, { p: q, dir: a - 0.25, spread: 1.7, v: [260, 1250], rate: 430, t0: 63.0, t1: 63.3, seed: i + 1, size: 5.5, poolEvery: 4 }); });
        if (t < T.shatter) [[J.sh, -2.2, 2.3, 0.0], [J.eN, -0.6, 1.9, 0.3], [J.kN, 0.5, 2.6, 0.55], [J.hc, -2.6, 2.1, 0.75], [J.hip, 2.6, 1.7, 0.2]].forEach(([q, dir, pu, ph], i) => fx.bloodEmit(t, { p: q, dir, spread: 0.5, v: [300, 760], rate: 80, t0: 63.5, t1: 70.6, seed: 20 + i, size: 4.6, pulse: pu, phase: ph }));
        if (t >= T.vomit - 0.2 && t < T.shatter) fx.bloodEmit(t, { p: mouth.p, dir: Math.atan2(mouth.d[1], mouth.d[0]) + 0.35, spread: 0.42, v: [420, 980], rate: 560, t0: 67.15, t1: 70.3, seed: 40, size: 6.5, poolEvery: 6 });
        if (t >= 76.9 && t < T.stop + 0.3) [[J.sh, -2.3, 2.2, 0.0], [J.sN, -1.3, 2.9, 0.4], [J.eN, -0.5, 2.5, 0.2], [J.kN, 0.4, 3.1, 0.6], [J.hc, -2.7, 2.4, 0.8], [J.hip, 2.7, 2.0, 0.1], [J.eF, -0.2, 2.7, 0.5], [J.kF, 2.4, 3.3, 0.3]].forEach(([q, dir, pu, ph], i) => fx.bloodEmit(t, { p: q, dir, spread: 0.55, v: [340, 900], rate: 95, t0: 76.95, t1: T.stop, seed: 60 + i, size: 4.8, pulse: pu, phase: ph }));
      }
      const poolK = sm(63.2, 71, t), big = t < 63 ? [] : [[st.gx - 30, FLOOR + 30, 150 * poolK + 120 * sm(67.5, 70.5, t)], [st.gx + 120, FLOOR + 44, 170 * sm(67.6, 70.6, t)], [st.gx - 190, FLOOR + 22, 80 * poolK]];
      if (t >= 63.2) for (const [x, y, r, h] of SPLAT) big.push([x, y, r * sat((t - 63.2 - h * 0.6) / 0.3)]);
      if (t >= T.bullets) big.push([GX(t) - 60, FLOOR + 36, 120 * sm(101, 109, t)]);
      const hx = 700 - 440 * sat((t - 62) / 1.2) - 50 * sat((t - 63.2) / 1.5), hy = Math.min(FLOOR - 14, 470 - 560 * (t - 62) + 1400 * (t - 62) ** 2), hrot = -Math.min(t - 62, 1.25) * 7.4;
      st.onFloor = (c) => fx.drawPools(c, big);
      if (t >= 69.0 && t < T.shatter) st.onFront = (c) => {       // 頭の中（脳の出血）
        c.setTransform(1, 0, 0, 1, 0, 0);
        const a = Math.min(sat((t - 69.0) / 0.25), sat((T.shatter - t) / 0.2)), k = sat((t - 69.3) / 1.3), px = 110, py = 318;
        c.globalAlpha = a; c.fillStyle = 'rgba(2,8,20,.86)'; rr(c, px, py, 430, 440, 14); c.fill(); c.strokeStyle = 'rgba(150,205,255,.85)'; c.lineWidth = 2.5; rr(c, px, py, 430, 440, 14); c.stroke();
        c.save(); c.translate(px + 205, py + 215);
        c.fillStyle = 'rgba(110,170,255,.13)'; c.strokeStyle = 'rgba(170,215,255,.9)'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(-10, -165); c.bezierCurveTo(95, -170, 150, -90, 146, -20); c.lineTo(178, 46); c.lineTo(146, 60); c.lineTo(150, 96); c.bezierCurveTo(150, 140, 110, 150, 60, 146); c.lineTo(50, 196); c.lineTo(-70, 196); c.lineTo(-64, 110); c.bezierCurveTo(-150, 60, -160, -150, -10, -165); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(150,195,255,.24)'; c.strokeStyle = 'rgba(190,225,255,.75)'; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(-6, -138); c.bezierCurveTo(80, -146, 126, -84, 118, -30); c.bezierCurveTo(112, 14, 60, 30, 20, 24); c.bezierCurveTo(-10, 60, -60, 56, -84, 20); c.bezierCurveTo(-130, -40, -100, -132, -6, -138); c.closePath(); c.fill(); c.stroke();
        c.lineWidth = 1.6; for (let i = 0; i < 7; i++) { const x0 = -86 + i * 30, y0 = -100 + 22 * Math.sin(i * 1.7); c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(x0 + 14, y0 + 26, x0 - 12, y0 + 46, x0 + 8, y0 + 76 - 6 * i); c.stroke(); }
        for (const [bx, by, br, d] of [[30, -70, 62, 0], [-36, -40, 46, 0.25], [70, -30, 40, 0.4], [0, -8, 34, 0.55]]) { const kk = sat((k - d) / 0.5); if (kk <= 0) continue; const R = br * ease.outCubic(kk) * (1 + 0.05 * Math.sin(t * 18)); const g = c.createRadialGradient(bx, by, 0, bx, by, R); g.addColorStop(0, 'rgba(255,60,50,.95)'); g.addColorStop(0.7, 'rgba(220,20,24,.85)'); g.addColorStop(1, 'rgba(200,0,10,0)'); c.fillStyle = g; c.beginPath(); c.arc(bx, by, R, 0, TAU); c.fill(); }
        c.restore(); c.globalAlpha = 1;
      };
      st.onBack = (c) => { if (t >= T.flash2) helmet(c, t < 62.05 ? J.hc[0] : hx, t < 62.05 ? J.hc[1] : hy, hrot, 0.47 * U); };
      const lean = t >= T.walk && t < T.last ? -0.42 : -0.06, ringCol = st.soul ? COL.soul : COL.pale;
      st.mid = () => {
        if (!(t >= 76.0 && t < 76.92)) fx.aura(st.gx, st.aura, t, { lean, soul: st.soul, height: (FLOOR - J.hc[1]) + 40, width: 74, gain: st.soul ? 0.85 : 0.95 });
        fx.rings([[T.kiai1, st.gx, chest[1], 1], [T.kiai1b, st.gx, chest[1], 1.1], [76.95, st.gx, chest[1], 1.3], ...SHOUTS.slice(1).map((q, i) => [q, GX(q), chest[1], 0.9 + 0.05 * i]), [T.stop, LEVER[0], LEVER[1], 1.5]], t, { col: ringCol });
      };
      stage.draw(st);
      if (t >= 76.0 && t < 76.92) fx.aura(chest[0] + 6, 0.55 + 0.45 * sat((t - 76) / 0.9), t, { soul: 1, height: 110, width: 13, footY: chest[1] + 34, gain: 1.0 });   // 胸にともる、魂の火
      // ---- 光の効果
      const shield = t >= 29.95 && t < T.flash2 ? 1 : t >= 76.95 && t < T.stop ? 1 : 0;
      const storm = t < T.flash1 ? 0 : t < T.flash2 ? 1 : t < T.stop ? 1.9 + 0.3 * sm(T.walk, T.stop, t) : 0;
      fx.storm(t, storm, { shield, gx: st.gx, soul: st.soul, n: 150 });
      fx.motes(t, st.gx, st.aura * 0.9, { col: ringCol, n: 110, seed: 3 });
      if (st.dawn > 0) fx.motes(t * 0.25, 800, 0.5 * st.dawn, { col: [1.0, 0.8, 0.55], n: 140, spread: 1500, rise: 320, seed: 9 });
      const spd = st.env1 * (t < 9.5 || (t >= 63 && t < 66) ? 0 : 1) * (0.5 + 0.5 * Math.max(pulse(t, T.kiai1, 0.8), pulse(t, T.kiai1b, 0.8), sm(T.last, T.stop, t), ...SHOUTS.map((q) => pulse(t, q, 0.9))));
      fx.speed(fx.X(chest[0]), fx.Y(chest[1]), spd, f, { col: st.soul ? [0.85, 0.95, 1.0] : COL.pale, inner: 300 * cam.s });
      let recoil = 0;
      if (t >= 101 && t < 109.9) recoil = fx.bullets(t, SHOTS, mouth);
      fx.bloodFlush();
      // ---- 画面全体
      const fl = 1.5 * pulse(t, T.flash1, 0.13) + 2.4 * pulse(t, T.flash2, 0.22) + 0.5 * pulse(t, T.kiai1, 0.07) + 0.5 * pulse(t, T.kiai1b, 0.07) + 0.9 * pulse(t, 76.95, 0.09) + 1.6 * pulse(t, T.stop, 0.2)
        + 0.3 * SHOUTS.slice(1).reduce((m, q) => Math.max(m, pulse(t, q, 0.06)), 0);
      const sh = 0.014 * pulse(t, T.flash1, 0.3) + 0.024 * pulse(t, T.flash2, 0.45) + 0.02 * pulse(t, T.stop, 0.35) + st.env1 * (0.0035 + 0.004 * sm(T.kiai2 - 1, T.kiai2, t) + 0.004 * sm(T.last, T.stop, t)) + 0.004 * recoil
        + (t >= T.walk && t < 116.5 ? 0.006 * pulse(t, T.walk + Math.floor(t - T.walk) + 0.7, 0.12) : 0);
      p.shake = [noise1(f * 0.83, 21) * sh, noise1(f * 0.91, 22) * sh];
      p.flash = Math.min(1.2, fl);
      p.bloom = 0.62 + 0.25 * sat(fl); p.threshold = 0.78; p.vignette = 0.62; p.ca = 0.006 + 0.04 * sat(fl) + 0.006 * st.env1;
      p.fade = sm(0, 1.2, t) * (1 - 0.999 * sm(129.2, 129.9, t) * (1 - sm(T.dawn, T.dawn + 0.9, t))) * lerp(1, 0.2, sm(T.title - 0.4, T.title + 0.6, t)) * (1 - sm(DURATION - 1.0, DURATION - 0.1, t));
    },
  };
  return [layer];
}
