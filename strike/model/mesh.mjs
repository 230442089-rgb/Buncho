// mesh.mjs — 距離の場から、なめらかな網目（四角形の集まり）を起こす。Surface Nets。
//   ます目ごとに「表面が通るか」を調べ、通るますに 1 つ頂点を置いて、となり合う 4 つのますを四角形でつなぐ。
//   頂点は置いたあと、場の傾きを使って本当の表面へ寄せる。法線も場の傾きから取るので、粗い網目でも陰影はなめらか。
const { abs, min, max, hypot: hyp, floor, ceil, sign } = Math;

export function surfaceNets(shape, h, { bb = shape.bb, snap = 2 } = {}) {
  const pad = 2, x0 = bb[0] - h * pad, y0 = bb[1] - h * pad, z0 = bb[2] - h * pad;
  const nx = ceil((bb[3] - bb[0]) / h) + pad * 2, ny = ceil((bb[4] - bb[1]) / h) + pad * 2, nz = ceil((bb[5] - bb[2]) / h) + pad * 2;
  const sx = nx + 1, sy = ny + 1, sz = nz + 1;
  if (sx * sy * sz > 4e8) throw new Error(`grid too large: ${sx}x${sy}x${sz}`);
  const val = new Float32Array(sx * sy * sz).fill(NaN), B = 8, f = shape.d;
  const at = (i, j, k) => i + sx * (j + sy * k);
  // ---- 1: かたまり（8³ ます）ごとに、表面が近いかを見る。近いかたまりだけ、角の値をぜんぶ測る
  const act = [];
  for (let bk = 0; bk * B < nz; bk++) for (let bj = 0; bj * B < ny; bj++) for (let bi = 0; bi * B < nx; bi++) {
    const i0 = bi * B, j0 = bj * B, k0 = bk * B, i1 = min(i0 + B, nx), j1 = min(j0 + B, ny), k1 = min(k0 + B, nz);
    const d = f(x0 + (i0 + i1) * 0.5 * h, y0 + (j0 + j1) * 0.5 * h, z0 + (k0 + k1) * 0.5 * h), rad = hyp(i1 - i0, j1 - j0, k1 - k0) * 0.5 * h;
    if (abs(d) > rad * 1.4 + h) {
      const v = d > 0 ? 1e3 : -1e3;
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const q = at(i, j, k); if (val[q] !== val[q]) val[q] = v; }
    } else {
      act.push(i0, j0, k0, i1, j1, k1);
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) val[at(i, j, k)] = f(x0 + i * h, y0 + j * h, z0 + k * h);
    }
  }
  // ---- 2: 表面が通るますに、頂点を 1 つ（辺を横切る点の平均）
  const cell = new Map(), P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], c = new Float32Array(8);
  for (let a = 0; a < act.length; a += 6) for (let k = act[a + 2]; k < act[a + 5]; k++) for (let j = act[a + 1]; j < act[a + 4]; j++) for (let i = act[a]; i < act[a + 3]; i++) {
    let m = 0;
    for (let q = 0; q < 8; q++) { c[q] = val[at(i + (q & 1), j + ((q >> 1) & 1), k + (q >> 2))]; if (c[q] < 0) m |= 1 << q; }
    if (m === 0 || m === 255) continue;
    let px = 0, py = 0, pz = 0, n = 0;
    for (const [u, v] of E) {
      if ((c[u] < 0) === (c[v] < 0)) continue;
      const t = c[u] / (c[u] - c[v]);
      px += (u & 1) + ((v & 1) - (u & 1)) * t; py += ((u >> 1) & 1) + (((v >> 1) & 1) - ((u >> 1) & 1)) * t; pz += (u >> 2) + ((v >> 2) - (u >> 2)) * t; n++;
    }
    cell.set(at(i, j, k), P.length / 3);
    P.push(x0 + (i + px / n) * h, y0 + (j + py / n) * h, z0 + (k + pz / n) * h);
  }
  // ---- 3: 符号の変わる辺ごとに、まわりの 4 ますを四角形でつなぐ
  const Q = [];
  const quad = (a, b, cc, d, flip) => { if (a === undefined || b === undefined || cc === undefined || d === undefined) return; if (flip) Q.push(a, d, cc, b); else Q.push(a, b, cc, d); };
  for (const key of cell.keys()) {
    const i = key % sx, j = floor(key / sx) % sy, k = floor(key / (sx * sy)), v0 = val[key];
    if (j > 0 && k > 0) { const v1 = val[at(i + 1, j, k)]; if ((v0 < 0) !== (v1 < 0)) quad(cell.get(at(i, j - 1, k - 1)), cell.get(at(i, j, k - 1)), cell.get(key), cell.get(at(i, j - 1, k)), !(v0 < 0)); }
    if (k > 0 && i > 0) { const v1 = val[at(i, j + 1, k)]; if ((v0 < 0) !== (v1 < 0)) quad(cell.get(at(i - 1, j, k - 1)), cell.get(at(i - 1, j, k)), cell.get(key), cell.get(at(i, j, k - 1)), !(v0 < 0)); }
    if (i > 0 && j > 0) { const v1 = val[at(i, j, k + 1)]; if ((v0 < 0) !== (v1 < 0)) quad(cell.get(at(i - 1, j - 1, k)), cell.get(at(i, j - 1, k)), cell.get(key), cell.get(at(i - 1, j, k)), !(v0 < 0)); }
  }
  // ---- 4: 頂点を本当の表面へ寄せ、法線を場の傾きから取る
  const nv = P.length / 3, pos = new Float32Array(P), nor = new Float32Array(nv * 3), e = h * 0.4, lim = h * 0.6;
  const grad = (x, y, z) => [f(x + e, y, z) - f(x - e, y, z), f(x, y + e, z) - f(x, y - e, z), f(x, y, z + e) - f(x, y, z - e)];
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    for (let it = 0; it < snap; it++) {
      const g = grad(x, y, z), g2 = (g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) / (4 * e * e); if (g2 < 1e-12) break;
      let s = f(x, y, z) / g2, gx = g[0] / (2 * e) * s, gy = g[1] / (2 * e) * s, gz = g[2] / (2 * e) * s; const l = hyp(gx, gy, gz);
      if (l > lim) { gx *= lim / l; gy *= lim / l; gz *= lim / l; }
      x -= gx; y -= gy; z -= gz;
    }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    const g = grad(x, y, z), l = hyp(g[0], g[1], g[2]) || 1;
    nor[v * 3] = g[0] / l; nor[v * 3 + 1] = g[1] / l; nor[v * 3 + 2] = g[2] / l;
  }
  return { pos, nor, quads: new Uint32Array(Q), nv, nq: Q.length / 4 };
}
