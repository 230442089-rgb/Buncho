// birdAct.js — 文鳥の演技（時刻 → ポーズ）。生命の章で枝にとまり、言葉の章でうたい、飛び立つ。
// 鳥らしさ: 頭は「ぴっ」と素早く動いて止まる（サッカード）。動きの前に小さくかがむ（予備動作）。着地で体がつぶれ、枝がしなる。
import { bar, BEAT, sat, smoothstep, ease, lerp, TAU } from './core.js';
import { PERCH_X, branchTop } from './bird.js';

export const T_LAND = bar(30);                 // 着地（小節の頭）
export const T_SING = bar(34);                 // うたいはじめ
export const T_OFF = bar(38) + BEAT * 2;       // 飛び立ち
const T_IN = T_LAND - 0.85;
const HOP1 = bar(31), HOP2 = bar(31) + BEAT, TURN = bar(32);
export const X1 = PERCH_X, X2 = PERCH_X - 0.27;   // ホップの前後の位置

// かなめの値に素早く切り替わる（少し行きすぎて戻る）
function snap(t, keys, dur = 0.12) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t < keys[i][0]) break;
    v = lerp(keys[i - 1][1], keys[i][1], ease.outBack(sat((t - keys[i][0]) / dur), 1.4));
  }
  return v;
}
// ゆっくり移る
function glide(t, keys) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) { const [tk, vk, d = 0.4] = keys[i]; if (t < tk) break; v = lerp(keys[i - 1][1], vk, ease.inOutCubic(sat((t - tk) / d))); }
  return v;
}
const spring = (s, amp, damp = 3.4, freq = 11.5) => (s < 0 ? 0 : amp * Math.exp(-damp * s) * Math.cos(freq * s));
const bez = (a, b, c, d, u) => { const v = 1 - u; return a.map((_, i) => v * v * v * a[i] + 3 * v * v * u * b[i] + 3 * v * u * u * c[i] + u * u * u * d[i]); };

// うたう拍（1 小節に「ぴ・ぴ・ぴー」）
export const CHIRPS = [];
for (let b = 0; b < 3; b++) for (const [o, len] of [[0, 0.20], [0.5, 0.20], [1.0, 0.46]]) CHIRPS.push([T_SING + b * 4 * BEAT + o * BEAT, len]);
CHIRPS.push([T_SING + 12 * BEAT, 0.5]);

// ホップ: [開始, 所要, 高さ]
const HOPS = [[HOP1, 0.20, 0.10], [HOP2, 0.19, 0.085], [TURN, 0.18, 0.07]];
const BLINKS = [T_LAND + 1.55, T_LAND + 3.0, T_LAND + 5.85, T_LAND + 6.05, T_LAND + 9.2, T_LAND + 10.6, T_SING + 4.6, T_SING + 8.9, T_SING + 11.5];

export function birdPose(t) {
  const P = { bird: t >= T_IN && t < T_OFF + 0.9 ? 1 : 0, perchX: X1 };
  if (!P.bird) { P.bend = spring(t - T_OFF, -0.05) ; return P; }
  const tau = t - T_LAND;

  // ---- 枝の上の位置と、体の向き
  const h1 = sat((t - HOP1) / 0.20), h2 = sat((t - HOP2) / 0.19), h3 = sat((t - TURN) / 0.18);
  const x = lerp(X1, X2, ease.inOutQuad(h1));
  P.pos = [x, 0, 0]; P.perchX = x;
  P.yaw = -2.25 - 0.32 * ease.inOutQuad(h2) - 0.33 * ease.inOutQuad(h3);
  // ---- つぶれ・のび
  let sq = 1 + 0.012 * Math.sin(TAU * 1.9 * t), lift = 0, air = 0;
  for (const [t0, d, h] of HOPS) {
    const u = (t - t0) / d;
    sq *= 1 - 0.13 * smoothstep(t0 - 0.11, t0 - 0.01, t) * (1 - smoothstep(t0, t0 + 0.03, t));    // かがむ
    if (u >= 0 && u <= 1) { lift += h * 4 * u * (1 - u); sq *= 1.09; air = Math.max(air, Math.sin(Math.PI * u)); }
    sq *= 1 - spring(t - t0 - d, 0.15, 9, 22);                                                       // 着地のつぶれ
  }
  sq *= 1 - spring(tau, 0.20, 7, 17) * (tau >= 0 ? 1 : 0);
  // ふくらんで丸くなる → すっと伸びて、何かに気づく
  const cozy = glide(t, [[0, 0], [T_LAND + 9.93, 1, 0.7], [T_LAND + 11.55, 0, 0.22]]);
  const perk = glide(t, [[0, 0], [T_LAND + 11.55, 1, 0.2], [T_SING + 13.0, 0.4, 0.5]]);
  sq *= 1 - 0.07 * cozy + 0.05 * perk;
  // ---- 枝のしなり
  let bend = 0.032 * smoothstep(-0.02, 0.25, tau);
  bend += spring(tau, 0.12);
  for (const [t0, d] of HOPS) bend += spring(t - t0 - d, 0.045) - 0.02 * (t > t0 && t < t0 + d ? 1 : 0);
  // ---- 頭（素早く向きを変えて止まる）
  P.headYaw = snap(t, [[0, 0], [T_LAND + 1.15, 0.55], [T_LAND + 2.0, -0.5], [T_LAND + 2.75, 0.3], [HOP1 - 0.05, 0.0], [HOP2 + 0.35, 0.25], [T_LAND + 4.97, -0.25], [T_LAND + 5.79, 0.15],
    [TURN + 0.3, 0.42], [T_LAND + 8.28, 0.62], [T_LAND + 9.1, 0.45], [T_LAND + 9.93, 0.2], [T_LAND + 11.55, 0.72], [T_LAND + 12.4, 0.5], [T_SING - 0.2, 0.55], [T_SING + 13.2, 0.75], [T_OFF - 0.6, 0.35]]);
  P.headPitch = snap(t, [[0, 0], [T_LAND + 2.0, -0.26], [T_LAND + 2.75, 0.02], [T_LAND + 4.97, 0.12], [TURN + 0.3, 0.0], [T_LAND + 9.93, 0.10], [T_LAND + 11.55, -0.30], [T_LAND + 12.4, -0.12],
    [T_SING - 0.2, -0.16], [T_SING + 13.2, -0.42], [T_OFF - 0.6, -0.1]]);
  P.headRoll = snap(t, [[0, 0], [T_LAND + 2.75, 0.36], [HOP1 - 0.05, 0], [T_LAND + 4.97, -0.34], [T_LAND + 5.79, 0], [T_LAND + 7.45, 0.40], [T_LAND + 8.28, -0.38], [T_LAND + 9.1, 0],
    [T_LAND + 12.4, 0.26], [T_SING - 0.2, 0], [T_SING + 13.2, 0.22], [T_OFF - 0.6, 0]]);
  P.pitch = 0; P.roll = 0;
  // ---- 羽づくろいの身ぶるい（着地のあと）
  const shake = smoothstep(0.75, 0.85, tau) * (1 - smoothstep(1.02, 1.15, tau));
  P.roll += 0.10 * shake * Math.sin(TAU * 13 * tau);
  P.fluff = 0.25 + 0.75 * Math.max(shake, cozy) - 0.15 * perk;
  P.tail = spring(tau, 0.5, 5, 14) + 0.10 * Math.sin(TAU * 0.7 * t) * 0.3 + 0.25 * shake * Math.sin(TAU * 13 * tau + 1);
  for (const [t0, d] of HOPS) P.tail += spring(t - t0 - d, 0.35, 6, 16);
  // ---- まばたき
  P.blink = 0; for (const b of BLINKS) if (t >= b && t < b + 0.11) P.blink = 1;
  // ---- うたう
  P.beak = 0;
  for (const [c, len] of CHIRPS) {
    const u = (t - c) / len;
    if (u >= 0 && u < 1) { const e = Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.6; P.beak = e; P.headPitch -= 0.13 * e; sq *= 1 + 0.035 * e; }
  }
  // ---- 飛んでくる
  P.wing = 0; P.flap = 0;
  if (tau < 0) {
    const u = ease.outQuad(sat((t - T_IN) / (T_LAND - T_IN)));
    const fy = branchTop(X1, 0) + 0.012;
    P.pos = bez([-3.3, 1.2, 2.4], [-1.5, fy - 0.42, 1.0], [0.0, fy + 0.10, 0.2], [X1, fy, 0], u);   // 少し下から回り込んで、ふわっと上がってとまる
    P.fly = true; P.perchX = X1; P.yaw = -2.25 + 0.9 * (1 - u); P.pitch = lerp(-0.25, 0.42, smoothstep(0.35, 1, u));
    P.wing = 1; P.flap = 0.75 * Math.sin(TAU * 9.5 * t);
    P.tail = 0.3; P.fluff = 0.1; sq = 1;
    P.landBlend = smoothstep(0.82, 1.0, u);
    bend = 0;
  } else {
    P.air = air; P.lift = lift;
    P.wing = (1 - smoothstep(0.03, 0.42, tau)); P.flap = 0.6 * Math.sin(TAU * 9.5 * t) * (1 - smoothstep(0, 0.4, tau));
    P.pitch = 0.42 * (1 - smoothstep(0, 0.3, tau));
    // ホップで少し翼をひらく
    for (const [t0, d] of HOPS) { const u = (t - t0) / d; if (u >= 0 && u <= 1) P.wing = Math.max(P.wing, 0.22 * Math.sin(Math.PI * u)); }
  }
  // ---- 飛び立つ
  if (t > T_OFF - 0.3) {
    const s = t - T_OFF;
    sq *= 1 - 0.16 * smoothstep(-0.26, -0.04, s) * (1 - smoothstep(-0.02, 0.04, s));
    if (s >= 0) {
      const u = ease.inQuad(sat(s / 0.85));
      const fy = branchTop(x, 0) + 0.012;
      P.pos = bez([x, fy, 0], [x - 0.08, fy + 1.7, 0.4], [x - 0.9, fy + 2.8, 1.4], [x - 3.4, fy + 3.9, 3.2], u);    // まず上へ、それから左奥へ（題の文字を横切らない）
      P.fly = true; P.landBlend = 0;
      P.wing = smoothstep(0, 0.08, s); P.flap = 0.8 * Math.sin(TAU * 10 * s + 1.2);
      P.pitch = 0.5 * smoothstep(0, 0.12, s) - 0.3 * smoothstep(0.3, 0.8, s); P.yaw = -2.9 + 0.5 * u; sq = 1 + 0.06 * (1 - u);
      bend = spring(s, -0.085) + 0.032 * (1 - smoothstep(0, 0.05, s));
      P.headPitch = -0.2; P.headYaw = 0.1; P.headRoll = 0;
    }
  }
  P.squash = sq; P.bend = bend;
  return P;
}
