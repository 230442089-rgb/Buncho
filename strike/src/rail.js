// rail.js — ユリアが進む道すじ。
//   谷を北へ → 湖の東岸 → 東の盆地 → 主峰の北 → 西の鞍部を南へこえる（目の前に湖）→ 湖の岸に沿って回りつづける（決戦）。
//   決戦では湖のまん中を向いたまま回る（旗艦は湖の上。景色のほうが回っていく）。
import { buildPath } from '../../flight/src/course.js';
import { clamp } from '../../flight/src/sky.js';

export const DCAM = 0.9;                    // カメラは自分の 0.9 単位うしろ
const LOOP = { cx: -1.0, cz: 42.0, r: 14.0, n: 12, laps: 5 };
const ROUTE = [
  [-0.5, -31.0, 1.3], [-4.6, -21.0, 1.3], [-5.0, -13.0, 1.3], [-1.6, -6.0, 1.3], [1.6, 2.0, 1.3], [2.0, 9.0, 1.3], [0.8, 15.0, 1.3], [2.5, 21.0, 1.4],
  [7.0, 27.0, 1.5], [10.5, 34.0, 1.5], [11.0, 42.0, 1.6], [8.0, 50.0, 1.6],
  [13.0, 58.5, 1.5], [16.0, 63.0, 1.5], [18.5, 69.0, 1.5], [15.5, 77.0, 1.4], [10.0, 83.0, 1.3], [4.0, 86.0, 1.4], [-2.5, 84.0, 1.6],
  [-6.2, 78.0, 0.95], [-8.3, 72.5, 1.2], [-10.0, 66.0, 1.4], [-12.5, 61.0, 1.5], [-13.5, 54.5, 1.6], [-12.6, 48.0, 1.6],
];

export function buildRail(T) {
  // 湖の上の周回（西の端から入り、南 → 東 → 北 → 西と回る）
  const route = ROUTE.slice(), first = route.length;
  for (let k = 0; k < LOOP.n * LOOP.laps + 3; k++) { const a = Math.PI + k / LOOP.n * Math.PI * 2; route.push([LOOP.cx + Math.cos(a) * LOOP.r, LOOP.cz + Math.sin(a) * LOOP.r, 1.6]); }
  const path = buildPath(T, route, { ceiling: 8.15, wide: 0.9, ahead: 2.5, soft: 3.0 });
  // 周回の始まりと 1 周の長さ（道のり）。もとの点 first 番と first + n 番のあいだ
  const sOf = (idx) => { let i = 0; while (i < path.N - 1 && path.U[i] < idx) i++; return i * path.DS; };
  const loopS = sOf(first), lap = sOf(first + LOOP.n) - loopS;
  const R = { path, loopS, lap, total: path.total };
  // 道の上の点と、右・上・前
  R.frame = (s) => {
    const q = path.at(s), f = q.t;
    let r = [f[2], 0, -f[0]]; const l = Math.hypot(r[0], r[2]) || 1; r = [r[0] / l, 0, r[2] / l];
    const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    return { p: q.p, r, u, f };
  };
  // 周回に入ったあとは、同じ場所へ巻き戻して何周でも飛べるようにする
  R.wrap = (s) => (s > loopS + lap * 3 ? s - lap : s);
  R.loopCenter = [LOOP.cx, LOOP.cz]; R.loopR = LOOP.r;
  return R;
}
export { clamp };
