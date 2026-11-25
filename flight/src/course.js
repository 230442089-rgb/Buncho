// course.js — 「紋章めぐり」のコース。
//   谷（フィヨルド）を朝日に向かって北へ → 湖 → 主峰を西の鞍部から回りこむ → 東の盆地から夜の湖へ帰る。
//   12 の輪は一族の紋章（順番は家族の並び）。さいごはフルル（ママ）の輪。
//   地形は起動時に焼くので、道の高さは「その場の地面 + ゆとり」で毎回測って決める。
import { MARKS } from '../../sigil/src/marks.js';
import { WORLD } from './shaders.js';
import { clamp, lerp, keyed } from './sky.js';

// [x, z, 地面（水面）からの高さ, 輪の持ち主]
const ROUTE = [
  [-0.5, -31.0, 0.60],
  [-4.8, -21.0, 0.55, 'yuria'],
  [-5.2, -13.0, 0.50],
  [-1.6, -6.0, 0.50, 'vol'],
  [1.6, 2.0, 0.55],
  [2.0, 9.0, 0.50, 'zaina'],
  [0.6, 15.0, 0.50],
  [2.5, 21.0, 0.55, 'rurika'],
  [7.0, 27.0, 0.42],
  [10.0, 33.0, 0.34, 'miria'],          // 湖の東岸を水面すれすれに
  [8.5, 39.5, 0.40],
  [1.0, 40.5, 0.50],
  [-8.0, 42.0, 0.50, 'rin'],
  [-15.0, 47.0, 0.55],                  // 低い岬をこえて西の入り江へ
  [-19.5, 51.0, 0.50, 'nirume'],
  [-17.0, 56.5, 0.80],
  [-12.5, 62.0, 1.00],
  [-10.0, 66.0, 1.00, 'reune'],         // 主峰の南西の斜面をのぼる
  [-8.3, 72.5, 0.90],
  [-6.2, 78.0, 0.75, 'telues'],         // 西の鞍部（いちばん高いところ）
  [-2.5, 84.0, 1.60],
  [4.0, 86.0, 1.20],
  [10.0, 83.0, 1.00, 'edel'],
  [15.5, 77.0, 1.00],
  [18.5, 69.0, 1.00, 'asera'],          // 東の盆地
  [16.0, 63.0, 1.00],
  [13.0, 58.5, 1.00],
  [8.0, 52.0, 0.80],
  [3.5, 48.5, 0.60],
  [-1.5, 45.5, 0.55, 'fururu'],         // 夜の湖のまんなか
  [-6.0, 42.0, 0.60],
  [-9.0, 38.0, 0.70],
];
// 輪をくぐる時点の「一日の進み」（0 = 日の出, 1 = 夜ふけ）
const GATE_D = [0.045, 0.10, 0.16, 0.22, 0.30, 0.37, 0.44, 0.53, 0.665, 0.755, 0.835, 0.985];
export const GATE_R = 0.62;                 // 輪の半径
export const CEILING = 8.3;                 // 飛べる高さの上限（雲の層のすぐ下）
const DS = 0.25;                            // 道を刻む間隔

const cr = (a, b, c, d, u) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);

export function buildCourse(T) {
  // ---- 平面の道すじ（Catmull-Rom）を細かく取り、長さで等間隔に刻み直す
  const n = ROUTE.length, dense = [];
  for (let i = 0; i < n - 1; i++) {
    const a = ROUTE[Math.max(0, i - 1)], b = ROUTE[i], c = ROUTE[i + 1], d = ROUTE[Math.min(n - 1, i + 2)];
    for (let k = 0; k < 24; k++) { const u = k / 24; dense.push([cr(a[0], b[0], c[0], d[0], u), cr(a[1], b[1], c[1], d[1], u), lerp(b[2], c[2], u), i + u]); }
  }
  dense.push([ROUTE[n - 1][0], ROUTE[n - 1][1], ROUTE[n - 1][2], n - 1]);
  const cum = [0]; for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = cum[cum.length - 1], N = Math.floor(total / DS) + 1;
  const X = new Float32Array(N), Z = new Float32Array(N), Y = new Float32Array(N), U = new Float32Array(N), clear = new Float32Array(N), surf = new Float32Array(N);
  for (let i = 0, j = 0; i < N; i++) {
    const s = i * DS; while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const f = clamp((s - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]), 0, 1), a = dense[j], b = dense[j + 1];
    X[i] = lerp(a[0], b[0], f); Z[i] = lerp(a[1], b[1], f); clear[i] = lerp(a[2], b[2], f); U[i] = lerp(a[3], b[3], f);
    // 道の左右も見て、いちばん高い地面を基準にする（谷の壁や岩に道が埋まらないように）
    let m = -1e9; for (const o of [-0.35, 0, 0.35]) m = Math.max(m, T.surfaceAt(X[i] + o, Z[i]), T.surfaceAt(X[i], Z[i] + o));
    surf[i] = m;
  }
  // ---- 高さ: 前後 1.5 単位の地面の最大 + ゆとり → なめらかに → 地面より下がらないように戻す
  const W = Math.round(1.5 / DS), tmp = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = -1e9; for (let k = Math.max(0, i - W); k <= Math.min(N - 1, i + W); k++) m = Math.max(m, surf[k] + 0.55 * clear[k]); Y[i] = Math.max(m, surf[i] + clear[i]); }
  const smooth = (r, rep) => { for (let q = 0; q < rep; q++) { for (let i = 0; i < N; i++) { let s = 0, c = 0; for (let k = Math.max(0, i - r); k <= Math.min(N - 1, i + r); k++) { s += Y[k]; c++; } tmp[i] = s / c; } Y.set(tmp); } };
  smooth(Math.round(2.0 / DS), 2);
  for (let i = 0; i < N; i++) Y[i] = Math.min(CEILING - 0.35, Math.max(Y[i], surf[i] + Math.max(0.3, 0.8 * clear[i])));
  smooth(Math.round(0.75 / DS), 1);
  for (let i = 0; i < N; i++) Y[i] = Math.max(Y[i], surf[i] + 0.28);

  const C = { N, DS, total: (N - 1) * DS, X, Y, Z };
  // 道の上の点と向き
  C.at = (s) => {
    const f = clamp(s / DS, 0, N - 1.001), i = Math.floor(f), u = f - i;
    const p = [lerp(X[i], X[i + 1], u), lerp(Y[i], Y[i + 1], u), lerp(Z[i], Z[i + 1], u)];
    const a = Math.max(0, i - 2), b = Math.min(N - 1, i + 3);
    let t = [X[b] - X[a], Y[b] - Y[a], Z[b] - Z[a]]; const l = Math.hypot(t[0], t[1], t[2]) || 1; t = [t[0] / l, t[1] / l, t[2] / l];
    return { p, t };
  };
  // いまの位置にいちばん近い道の点（前回の位置 s0 のまわりだけ探す）
  C.project = (pos, s0, back = 6, fwd = 14) => {
    let best = s0, bd = 1e9;
    const i0 = Math.max(0, Math.floor((s0 - back) / DS)), i1 = Math.min(N - 1, Math.ceil((s0 + fwd) / DS));
    for (let i = i0; i <= i1; i++) { const d = (X[i] - pos[0]) ** 2 + (Y[i] - pos[1]) ** 2 * 0.5 + (Z[i] - pos[2]) ** 2; if (d < bd) { bd = d; best = i * DS; } }
    return { s: best, dist: Math.sqrt(bd) };
  };

  // ---- 輪
  const gateRows = ROUTE.map((r, i) => [r, i]).filter(([r]) => r[3]);
  C.gates = gateRows.map(([r, idx], k) => {
    let bi = 0, bd = 1e9; for (let i = 0; i < N; i++) { const d = Math.abs(U[i] - idx); if (d < bd) { bd = d; bi = i; } }
    const s = bi * DS, q = C.at(s), mi = MARKS.findIndex((m) => m.id === r[3]), m = MARKS[mi];
    return { k, id: r[3], name: m.name, mark: mi, col: m.col.main, s, p: q.p, n: q.t, d: GATE_D[k], passed: false, t: -1, center: false };
  });
  // ---- 一日の進み: 輪ごとの値を、道のりでなめらかに結ぶ
  const keys = [[0, 0.02], ...C.gates.map((g) => [g.s, g.d]), [C.total, 1.0]];
  C.dayAt = (s) => keyed(keys, clamp(s, 0, C.total));
  // ---- 光の粒: 道しるべ。ゆるく蛇行させて並べる（輪のすぐ前後には置かない）
  C.motes = [];
  const last = C.gates[C.gates.length - 1].s;
  for (let s = 4.0, i = 0; s < last - 1.0; s += 1.5, i++) {
    if (C.gates.some((g) => Math.abs(g.s - s) < 1.0)) continue;
    const q = C.at(s), side = [q.t[2], 0, -q.t[0]], l = Math.hypot(side[0], side[2]) || 1;
    const a = 0.26 * Math.sin(s * 0.55) + 0.1 * Math.sin(s * 1.7 + 1), h = 0.07 * Math.sin(s * 0.9 + 2);
    const p = [q.p[0] + side[0] / l * a, q.p[1] + h, q.p[2] + side[2] / l * a];
    p[1] = Math.max(p[1], T.surfaceAt(p[0], p[2]) + 0.22);
    C.motes.push({ i, s, p, taken: false, t: -1, ph: i * 1.7 });
  }
  C.start = () => { const q = C.at(0.5); return { p: q.p, yaw: Math.atan2(q.t[0], q.t[2]), pitch: Math.asin(clamp(q.t[1], -1, 1)) }; };
  C.reset = () => { C.gates.forEach((g) => { g.passed = false; g.t = -1; g.center = false; }); C.motes.forEach((m) => { m.taken = false; m.t = -1; }); };
  return C;
}
export { MARKS, WORLD };
