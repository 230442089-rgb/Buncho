// sdf.mjs — 距離の場（SDF）で形を組む道具。ビルドのときだけ使う（Node）。
//   形 = { d(x, y, z) → 表面までの距離（中は負）, bb: [x0, y0, z0, x1, y1, z1]（形を包む箱） }
//   球・楕円体・先細りのカプセルなどを「なめらかな和」で溶け合わせて、筋肉や髪のような形を作る。
const { hypot: hyp, min, max, abs, sqrt, sign, cos, sin, PI } = Math;
export const TAU = PI * 2;
const clamp = (x, a, b) => min(b, max(a, x));

// ---- ベクトルと回転（3×3 は行ごとの配列 [[..],[..],[..]]。v' = R v）
export const V = {
  add: (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => hyp(a[0], a[1], a[2]),
  norm: (a) => { const l = hyp(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k],
};
export const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const rotX = (a) => { const c = cos(a), s = sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
export const rotY = (a) => { const c = cos(a), s = sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
export const rotZ = (a) => { const c = cos(a), s = sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
export const mul3 = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
export const app3 = (R, v) => [R[0][0] * v[0] + R[0][1] * v[1] + R[0][2] * v[2], R[1][0] * v[0] + R[1][1] * v[1] + R[1][2] * v[2], R[2][0] * v[0] + R[2][1] * v[1] + R[2][2] * v[2]];
export const tr3 = (R) => [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
// 度で書くオイラー角（Z → X → Y の順に掛ける: まず傾け、次に前後、最後に向き）
export const euler = (rx = 0, ry = 0, rz = 0) => mul3(rotY(ry * PI / 180), mul3(rotX(rx * PI / 180), rotZ(rz * PI / 180)));
// 列が (右, 上, 前) になる回転。前 f と、上の目安 up から
export function look(f, up = [0, 1, 0]) { f = V.norm(f); let r = V.cross(up, f); if (V.len(r) < 1e-6) r = V.cross([1, 0, 0], f); r = V.norm(r); const u = V.cross(f, r); return [[r[0], u[0], f[0]], [r[1], u[1], f[1]], [r[2], u[2], f[2]]]; }

const bbPts = (pts, r) => { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (const p of pts) for (let i = 0; i < 3; i++) { b[i] = min(b[i], p[i] - r); b[i + 3] = max(b[i + 3], p[i] + r); } return b; };
const bbJoin = (list, pad = 0) => { const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]; for (const s of list) for (let i = 0; i < 3; i++) { b[i] = min(b[i], s.bb[i] - pad); b[i + 3] = max(b[i + 3], s.bb[i + 3] + pad); } return b; };
// 箱までの距離（外なら正）。遠い部品を早く捨てるのに使う
const bbDist = (b, x, y, z) => { const dx = max(b[0] - x, x - b[3], 0), dy = max(b[1] - y, y - b[4], 0), dz = max(b[2] - z, z - b[5], 0); return hyp(dx, dy, dz); };

// ============================================================ 基本の形
export const sphere = (c, r) => ({ bb: bbPts([c], r), d: (x, y, z) => hyp(x - c[0], y - c[1], z - c[2]) - r });
// 楕円体（r: 3 方向の半径, R: 向き）。距離は近似（表面の近くで正確）
export function ellipsoid(c, r, R = null) {
  const m = min(r[0], r[1], r[2]), Rt = R ? tr3(R) : null, e = R ? [0, 1, 2].map((i) => hyp(R[i][0] * r[0], R[i][1] * r[1], R[i][2] * r[2])) : r;
  return { bb: [c[0] - e[0], c[1] - e[1], c[2] - e[2], c[0] + e[0], c[1] + e[1], c[2] + e[2]], d: (x, y, z) => {
    let px = x - c[0], py = y - c[1], pz = z - c[2];
    if (Rt) { const q = app3(Rt, [px, py, pz]); px = q[0]; py = q[1]; pz = q[2]; }
    const k0 = hyp(px / r[0], py / r[1], pz / r[2]), k1 = hyp(px / (r[0] * r[0]), py / (r[1] * r[1]), pz / (r[2] * r[2]));
    return k1 < 1e-9 ? -m : k0 * (k0 - 1) / k1;
  } };
}
// 先細りのカプセル（a の半径 ra → b の半径 rb）。正確な距離
export function rcone(a, b, ra, rb = ra) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2], l2 = bax * bax + bay * bay + baz * baz;
  if (l2 < 1e-12) return sphere(a, max(ra, rb));
  const rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
  if (a2 <= 0) return sphere(ra > rb ? a : b, max(ra, rb));          // 片方がもう片方を包む
  return { bb: bbJoin([{ bb: bbPts([a], ra) }, { bb: bbPts([b], rb) }]), d: (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2], yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy, x2 = qx * qx + qy * qy + qz * qz, y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = sign(rr) * rr * rr * x2;
    if (sign(zz) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - rb;
    if (sign(yy) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - ra;
    return (sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
  } };
}
// 角の丸い箱（half: 半分の大きさ, round: 角の丸み, R: 向き）
export function rbox(c, half, round = 0, R = null) {
  const Rt = R ? tr3(R) : null, hx = half[0] - round, hy = half[1] - round, hz = half[2] - round;
  const e = R ? [0, 1, 2].map((i) => abs(R[i][0]) * half[0] + abs(R[i][1]) * half[1] + abs(R[i][2]) * half[2]) : half;
  return { bb: [c[0] - e[0], c[1] - e[1], c[2] - e[2], c[0] + e[0], c[1] + e[1], c[2] + e[2]], d: (x, y, z) => {
    let px = x - c[0], py = y - c[1], pz = z - c[2];
    if (Rt) { const q = app3(Rt, [px, py, pz]); px = q[0]; py = q[1]; pz = q[2]; }
    const qx = abs(px) - hx, qy = abs(py) - hy, qz = abs(pz) - hz;
    return hyp(max(qx, 0), max(qy, 0), max(qz, 0)) + min(max(qx, qy, qz), 0) - round;
  } };
}
// 輪（中心 c、軸 n、輪の半径 R、太さ r）
export function torus(c, n, R, r) {
  n = V.norm(n);
  return { bb: bbPts([c], R + r), d: (x, y, z) => { const px = x - c[0], py = y - c[1], pz = z - c[2], h = px * n[0] + py * n[1] + pz * n[2], q = hyp(px - n[0] * h, py - n[1] * h, pz - n[2] * h) - R; return hyp(q, h) - r; } };
}
// ふたのある円柱（a → b、半径 r、角の丸み round）
export function cyl(a, b, r, round = 0) {
  const u = V.norm(V.sub(b, a)); const A = V.add(a, u, round), B = V.add(b, u, -round), rr = r - round;
  const bax = B[0] - A[0], bay = B[1] - A[1], baz = B[2] - A[2], baba = bax * bax + bay * bay + baz * baz;
  return { bb: bbPts([a, b], r), d: (x, y, z) => {
    const pax = x - A[0], pay = y - A[1], paz = z - A[2], paba = pax * bax + pay * bay + paz * baz;
    const xx = hyp(pax * baba - bax * paba, pay * baba - bay * paba, paz * baba - baz * paba) - rr * baba, yy = abs(paba - baba * 0.5) - baba * 0.5;
    const x2 = xx * xx, y2 = yy * yy * baba, dd = max(xx, yy) < 0 ? -min(x2, y2) : (xx > 0 ? x2 : 0) + (yy > 0 ? y2 : 0);
    return sign(dd) * sqrt(abs(dd)) / baba - round;
  } };
}
// ふたのある円すい台（a の半径 ra → b の半径 rb）
export function cone(a, b, ra, rb, round = 0) {
  const u = V.norm(V.sub(b, a)); const A = V.add(a, u, round), B = V.add(b, u, -round), r1 = max(0, ra - round), r2 = max(0, rb - round);
  const bax = B[0] - A[0], bay = B[1] - A[1], baz = B[2] - A[2], baba = bax * bax + bay * bay + baz * baz, rba = r2 - r1, k = rba * rba + baba;
  return { bb: bbPts([a, b], max(ra, rb)), d: (x, y, z) => {
    const pax = x - A[0], pay = y - A[1], paz = z - A[2], papa = pax * pax + pay * pay + paz * paz, paba = (pax * bax + pay * bay + paz * baz) / baba;
    const xx = sqrt(max(0, papa - paba * paba * baba)), cax = max(0, xx - (paba < 0.5 ? r1 : r2)), cay = abs(paba - 0.5) - 0.5;
    const f = clamp((rba * (xx - r1) + paba * baba) / k, 0, 1), cbx = xx - r1 - f * rba, cby = paba - f, s = cbx < 0 && cay < 0 ? -1 : 1;
    return s * sqrt(min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba)) - round;
  } };
}
// 半空間（n の側が外）。切り落とすのに使う
export const half = (n, k) => { n = V.norm(n); return { bb: [-1e3, -1e3, -1e3, 1e3, 1e3, 1e3], d: (x, y, z) => x * n[0] + y * n[1] + z * n[2] - k }; };

// 平面の多角形までの距離（中は負）
function polyDist(P, x, y) {
  let d = (x - P[0][0]) ** 2 + (y - P[0][1]) ** 2, s = 1;
  for (let i = 0, j = P.length - 1; i < P.length; j = i, i++) {
    const ex = P[j][0] - P[i][0], ey = P[j][1] - P[i][1], wx = x - P[i][0], wy = y - P[i][1];
    const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey), 0, 1), bx = wx - ex * t, by = wy - ey * t;
    d = min(d, bx * bx + by * by);
    const c0 = y >= P[i][1], c1 = y < P[j][1], c2 = ex * wy > ey * wx;
    if ((c0 && c1 && c2) || (!c0 && !c1 && !c2)) s = -s;
  }
  return s * sqrt(d);
}
// 多角形の板（装甲の板・刃）。o: 原点, R: 向き（板の面が局所の XY、厚みが Z）, pts: [[x, y], …], t: 厚みの半分
//   edge > 0 なら、縁へ向かって薄くなる（刃のような断面）。round: 角の丸み
export function plate(o, R, pts, t, { edge = 0, round = 0, thin = 0.12 } = {}) {
  const Rt = tr3(R || I3), P = pts, rad = max(...pts.map((p) => hyp(p[0], p[1])));
  return { bb: bbPts([o], rad + t + round), d: (x, y, z) => {
    const q = app3(Rt, [x - o[0], y - o[1], z - o[2]]), d2 = polyDist(P, q[0], q[1]) + round;
    const tt = edge > 0 ? t * (thin + (1 - thin) * clamp(-d2 / edge, 0, 1)) : t, dz = abs(q[2]) - tt + round;
    return min(max(d2, dz), 0) + hyp(max(d2, 0), max(dz, 0)) - round;
  } };
}

// ============================================================ 組み合わせ
export function union(...s) {
  s = s.flat().filter(Boolean);
  if (s.length === 1) return s[0];
  return { bb: bbJoin(s), d: (x, y, z) => { let b = 1e9; for (const q of s) { if (bbDist(q.bb, x, y, z) > b) continue; const v = q.d(x, y, z); if (v < b) b = v; } return b; } };
}
// なめらかな和（k: 溶け合う幅）。筋肉どうし・髪の束どうしをつなぐ
export function blend(k, ...s) {
  s = s.flat().filter(Boolean);
  if (s.length === 1) return s[0];
  return { bb: bbJoin(s, k * 0.25), d: (x, y, z) => {
    let b = 1e9;
    for (const q of s) { if (bbDist(q.bb, x, y, z) > b + k) continue; const v = q.d(x, y, z), h = max(k - abs(b - v), 0) / k; b = min(b, v) - h * h * k * 0.25; }
    return b;
  } };
}
// a から b を削る（k > 0 でなめらかに）
export function cut(a, b, k = 0) {
  return { bb: a.bb, d: (x, y, z) => { const u = a.d(x, y, z), v = -b.d(x, y, z); if (k <= 0) return max(u, v); const h = max(k - abs(u - v), 0) / k; return max(u, v) + h * h * k * 0.25; } };
}
// a と b の重なり
export function both(a, b, k = 0) {
  const bb = [0, 1, 2].map((i) => max(a.bb[i], b.bb[i])).concat([3, 4, 5].map((i) => min(a.bb[i], b.bb[i])));
  return { bb, d: (x, y, z) => { const u = a.d(x, y, z), v = b.d(x, y, z); if (k <= 0) return max(u, v); const h = max(k - abs(u - v), 0) / k; return max(u, v) + h * h * k * 0.25; } };
}
export const grow = (s, r) => ({ bb: bbJoin([s], r), d: (x, y, z) => s.d(x, y, z) - r });
export const shell = (s, t) => ({ bb: bbJoin([s], t), d: (x, y, z) => abs(s.d(x, y, z)) - t });
// 表面を細かく押し引きする（羽の重なり・しわ）。fn(x, y, z) → 外へ出す量
export const bump = (s, fn, amp) => ({ bb: bbJoin([s], amp), d: (x, y, z) => s.d(x, y, z) - fn(x, y, z) });
// 動かす・回す・大きさを変える（R: 回転, t: 移動, k: 大きさ）
export function move(s, { t = [0, 0, 0], R = null, k = 1 } = {}) {
  const Rt = R ? tr3(R) : null, b = s.bb, c = [];
  for (let i = 0; i < 8; i++) { let p = [b[i & 1 ? 3 : 0] * k, b[i & 2 ? 4 : 1] * k, b[i & 4 ? 5 : 2] * k]; if (R) p = app3(R, p); c.push(V.add(p, t)); }
  return { bb: bbPts(c, 0), d: (x, y, z) => { let p = [x - t[0], y - t[1], z - t[2]]; if (Rt) p = app3(Rt, p); return s.d(p[0] / k, p[1] / k, p[2] / k) * k; } };
}
// 左右対称にする（x ≥ 0 の側に作った形を、両側へ）
export const mirror = (s) => ({ bb: [-max(abs(s.bb[0]), abs(s.bb[3])), s.bb[1], s.bb[2], max(abs(s.bb[0]), abs(s.bb[3])), s.bb[4], s.bb[5]], d: (x, y, z) => s.d(abs(x), y, z) });
// 左右を入れかえる
export const flipX = (s) => ({ bb: [-s.bb[3], s.bb[1], s.bb[2], -s.bb[0], s.bb[4], s.bb[5]], d: (x, y, z) => s.d(-x, y, z) });
// ある向き n にだけ薄くつぶす（o を通る面を動かさない）。髪の束を平たくするのに使う
export function squash(s, o, n, k) {
  n = V.norm(n); const g = 1 / k - 1;
  const c = []; for (let i = 0; i < 8; i++) { const p = [s.bb[i & 1 ? 3 : 0], s.bb[i & 2 ? 4 : 1], s.bb[i & 4 ? 5 : 2]], h = V.dot(V.sub(p, o), n); c.push(V.add(p, n, (k - 1) * h)); }
  return { bb: bbPts(c, 0), d: (x, y, z) => { const h = (x - o[0]) * n[0] + (y - o[1]) * n[1] + (z - o[2]) * n[2]; return s.d(x + n[0] * g * h, y + n[1] * g * h, z + n[2] * g * h) * k; } };
}

// ============================================================ 曲線に沿った管（腕・脚・髪の束・角）
// 制御点 [[x, y, z, 半径], …] を、なめらかな曲線（Catmull-Rom）で n 区間に刻み直す
export function spline(P, n = 12) {
  const out = [], m = P.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = i / n * m, k = min(m - 1, Math.floor(u)), f = u - k, a = P[max(0, k - 1)], b = P[k], c = P[k + 1], d = P[min(m, k + 2)], q = [];
    for (let j = 0; j < 4; j++) q.push(0.5 * (2 * b[j] + (c[j] - a[j]) * f + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * f * f + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * f * f * f));
    q[3] = max(q[3], 0.004); out.push(q);
  }
  return out;
}
// 点の列を先細りのカプセルでつないだ管
export function chain(P) { const s = []; for (let i = 0; i + 1 < P.length; i++) s.push(rcone(P[i], P[i + 1], P[i][3], P[i + 1][3])); return union(s); }
export const tube = (P, n = 12) => chain(spline(P, n));
// 平たい管（髪の束・羽）。flat: つぶす向き, k: 厚み ÷ 幅
export function ribbon(P, flat, k, n = 12) {
  const o = P[0], nn = V.norm(flat), Q = spline(P, n).map((p) => { const h = V.dot(V.sub(p, o), nn); const q = V.add(p, nn, (1 / k - 1) * h); return [q[0], q[1], q[2], p[3]]; });
  return squash(chain(Q), o, nn, k);
}

// ============================================================ 表面を探す道具（飾りを体や髪の表面に置くのに使う）
// 点 o から向き dir へ進んで、形の表面の点を返す（o は形の中、t1 は形の外にあること）
export const surfaceAlong = (shape, o, dir, t0 = 0.05, t1 = 3) => { let a = t0, b = t1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (shape.d(o[0] + dir[0] * m, o[1] + dir[1] * m, o[2] + dir[2] * m) < 0) a = m; else b = m; } return V.add(o, dir, (a + b) / 2); };
// 場の傾き（外向きの法線）
export const gradient = (shape, p, e = 0.01) => V.norm([shape.d(p[0] + e, p[1], p[2]) - shape.d(p[0] - e, p[1], p[2]), shape.d(p[0], p[1] + e, p[2]) - shape.d(p[0], p[1] - e, p[2]), shape.d(p[0], p[1], p[2] + e) - shape.d(p[0], p[1], p[2] - e)]);
// 形の表面に貼りつく薄い面（帯・模様）: 形を t だけ太らせたものと region の重なりから、形の内側を除く
export const patch = (shape, region, t = 0.02, k = 0.01) => cut(both(grow(shape, t), region, k), grow(shape, -0.05));
// 板を置く向き: 板の長い向き dir と、面の向き nor から（列 = 局所の x, y, z）
export const bladeR = (dir, nor) => { const y = V.norm(dir), x = V.norm(V.cross(y, nor)), z = V.cross(x, y); return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]]; };
