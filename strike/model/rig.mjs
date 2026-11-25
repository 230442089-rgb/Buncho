// rig.mjs — 骨の重みを、骨までの距離から自動で決める道具。
import { V } from './sdf.mjs';
const { min, max, hypot: hyp } = Math;

const segDist = (p, a, b) => { const ab = V.sub(b, a), l2 = V.dot(ab, ab) || 1e-9, t = min(1, max(0, V.dot(V.sub(p, a), ab) / l2)); return hyp(p[0] - a[0] - ab[0] * t, p[1] - a[1] - ab[1] * t, p[2] - a[2] - ab[2] * t); };
// segs: [[骨の名前, 始点, 終点, 効く半径], …]（1 つの骨に何本あってもよい）。近い骨ほど強く従う（距離 ÷ 半径 の pw 乗に反比例）
export function autoWeights(segs, pw = 6) {
  return (x, y, z) => {
    const p = [x, y, z], w = {};
    for (const [name, a, b, r] of segs) { const d = segDist(p, a, b) / r, k = 1 / (1e-4 + Math.pow(d, pw)); w[name] = max(w[name] || 0, k); }
    return Object.entries(w);
  };
}
// 左右対称の骨の線を、R・L の両方に広げる（名前の最後の # を R / L に替える。+x が本人の右）
export function bothSides(segs) {
  const out = [];
  for (const s of segs) {
    if (!s[0].endsWith('#')) { out.push(s); continue; }
    const n = s[0].slice(0, -1);
    out.push([n + 'R', s[1], s[2], s[3]]); out.push([n + 'L', [-s[1][0], s[1][1], s[1][2]], [-s[2][0], s[2][1], s[2][2]], s[3]]);
  }
  return out;
}
