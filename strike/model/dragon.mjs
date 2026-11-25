// dragon.mjs — 決め技の竜（ユリアの竜体）の 3D モデル。いただいた 2 枚目の絵をもとにした、白と金の長い竜。
//   白いうろこの長い体、背に並ぶ黒い装甲（金のふち・青く光る石）と金の刃、金の角の冠、長い白いたてがみ（先は黄色）、
//   機械の翼が 2 組（黒い軸に青い輪・白い羽・金の光の膜）、頭のうしろの金の光の輪、体のところどころに「#」の印。
//   座標: 頭の付け根が原点。+z が顔の向き、体は -z へのびる（長さ 30）。+y が背。体の太さは、胸でおよそ 1。
//   背骨の骨 s0 … s17 を、飛んだ道すじに沿って置くと、体がくねる（strike/src/cast.js）。
import { sphere, ellipsoid, rcone, rbox, torus, cyl, cone, plate, union, blend, cut, both, mirror, tube, ribbon, chain, euler, rotX, rotZ, V, I3, bladeR } from './sdf.mjs';
import { Model, mirrored } from './pack.mjs';

const { sin, cos, abs, min, max, PI, hypot, floor } = Math, D2R = PI / 180;
export const DL = 30, DN = 18, DD = DL / (DN - 1);                       // 体の長さ・背骨の骨の数・骨の間隔
const PROF = [[0, 0.8], [3, 1.0], [8, 1.06], [15, 0.94], [22, 0.68], [27, 0.38], [29.4, 0.15], [30, 0.05]];
// 頭からの距離 s での、体の太さ
export const bodyR = (s) => { s = min(DL, max(0, s)); for (let i = 0; i + 1 < PROF.length; i++) if (s <= PROF[i + 1][0]) { const [a, ra] = PROF[i], [b, rb] = PROF[i + 1], t = (s - a) / (b - a), u = t * t * (3 - 2 * t); return ra + (rb - ra) * u; } return 0.05; };
// 翼: [軸の位置, 付く背骨, 羽（向きの度, 長さ）]。本人の右（+x）に作って、左へ写す
const WINGS = [
  { name: 'wF', hub: [2.0, 1.5, -3.6], spine: 2, blades: [[118, 4.2], [94, 5.8], [70, 6.8], [46, 7.0], [22, 6.2], [-2, 5.0], [-26, 3.8]] },
  { name: 'wB', hub: [1.7, 1.2, -7.2], spine: 4, blades: [[62, 3.4], [38, 4.4], [14, 4.6], [-10, 3.9], [-34, 3.0]] },
];
// 厚みのない面（翼の光の膜）
function membMesh() {
  const pos = [], nor = [], quads = [], bone = [], NU = 6, NV = 4;
  for (const w of WINGS) w.blades.slice(0, -1).forEach(([a0, L0], i) => {
    const [a1, L1] = w.blades[i + 1], base = pos.length / 3;
    for (let v = 0; v <= NV; v++) for (let u = 0; u <= NU; u++) {
      const fu = u / NU, fv = v / NV, a = (a0 + (a1 - a0) * fu) * D2R, Ro = (L0 + (L1 - L0) * fu) * 0.86 * (1 - 0.22 * sin(PI * fu)), r = 1.0 + (Ro - 1.0) * fv;
      pos.push(w.hub[0] + cos(a) * r, w.hub[1] + sin(a) * r, w.hub[2]); nor.push(0, 0, 1);
    }
    for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) { const q = base + v * (NU + 1) + u; quads.push(q, q + 1, q + NU + 2, q + NU + 1); }
  });
  return { raw: { pos: new Float32Array(pos), nor: new Float32Array(nor), quads: new Uint32Array(quads) } };
}
// 体の側面の「#」の印（小さな箱 4 本）
function marks() {
  const pos = [], nor = [], quads = [];
  const box = (c, Rm, h) => { for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) {
    const u = (ax + 1) % 3, v = (ax + 2) % 3, base = pos.length / 3, n = [0, 0, 0]; n[ax] = sg; const wn = [0, 1, 2].map((i) => Rm[i][0] * n[0] + Rm[i][1] * n[1] + Rm[i][2] * n[2]);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const l = [0, 0, 0]; l[ax] = sg * h[ax]; l[u] = a * h[u]; l[v] = b * h[v]; for (let i = 0; i < 3; i++) pos.push(c[i] + Rm[i][0] * l[0] + Rm[i][1] * l[1] + Rm[i][2] * l[2]); nor.push(...wn); }
    if (sg > 0) quads.push(base, base + 1, base + 2, base + 3); else quads.push(base, base + 3, base + 2, base + 1);
  } };
  for (const [s, ang] of [[5.2, 62], [9.6, -66], [13.6, 70], [18.2, -64], [22.4, 66]]) {
    const r = bodyR(s) + 0.012, a = ang * D2R, n = [sin(a), cos(a), 0], t = [cos(a), -sin(a), 0], zdir = [0, 0, 1], c = [n[0] * r, n[1] * r, -s];
    const Rm = [[t[0], zdir[0], n[0]], [t[1], zdir[1], n[1]], [t[2], zdir[2], n[2]]], off = (dx, dz) => [c[0] + t[0] * dx, c[1] + t[1] * dx, c[2] + dz];
    box(off(0, 0.075), Rm, [0.21, 0.03, 0.025]); box(off(0, -0.075), Rm, [0.21, 0.03, 0.025]); box(off(0.075, 0), Rm, [0.03, 0.21, 0.025]); box(off(-0.075, 0), Rm, [0.03, 0.21, 0.025]);
  }
  return { raw: { pos: new Float32Array(pos), nor: new Float32Array(nor), quads: new Uint32Array(quads) } };
}

export function buildDragon() {
  const m = new Model('dragon', { toon: 1, soft: 0.8, line: 0.0011, aoR: 0.7, length: DL, spine: DN, step: DD, mouth: [0, -0.2, 3.3] });
  const mat = (n, d) => m.mat(n, d);
  mat('scale', { col: '#f4f4fb', kind: 'scale', spec: 0.6, gloss: 40, rim: 0.4, shade: '#b9bfdc' });
  mat('belly', { col: '#fbf7ee', kind: 'scale', spec: 0.5, gloss: 30, rim: 0.3, shade: '#d6c9b4' });
  mat('black', { col: '#23232d', kind: 'gloss', spec: 0.8, gloss: 60, rim: 0.4, shade: '#101018' });
  mat('gold', { col: '#ffd75a', kind: 'gloss', spec: 0.9, gloss: 60, rim: 0.4, shade: '#eba02c' });
  mat('gem', { col: '#4a9cff', kind: 'glow', emis: 1 });
  mat('eye', { col: '#7fd4ff', kind: 'glow', emis: 1 });
  mat('hair', { col: '#f6f4fd', kind: 'hair', spec: 0.5, gloss: 20, rim: 0.3, shade: '#c6c0e4' });
  mat('hairTip', { col: '#ffd84a', kind: 'hair', spec: 0.5, gloss: 20, rim: 0.3, shade: '#f2a422' });
  mat('tooth', { col: '#fffdf2', kind: 'matte', spec: 0.5, gloss: 40, rim: 0.2, shade: '#cfc6b0' });
  mat('mouth', { col: '#8c2f45', kind: 'matte', spec: 0.3, gloss: 20, rim: 0.0, shade: '#4a1524' });
  mat('armor', { col: '#f8f8fe', kind: 'gloss', spec: 0.8, gloss: 60, rim: 0.3, shade: '#bdc4e0' });
  mat('halo', { col: '#ffe07a', kind: 'glow', emis: 1 });
  mat('film', { col: '#ffd94e', kind: 'film', emis: 0.8, rim: 0.3, shade: '#ffb21e' });
  mat('pin', { col: '#26252e', kind: 'matte', spec: 0.1, gloss: 20, rim: 0.05, shade: '#121218' });
  // ---- 骨: 背骨を等間隔に。頭とあごは背骨の先に、翼の軸は 2 番めと 4 番めの背骨に付く
  m.bone('root', null, [0, 0, 0]);
  for (let i = 0; i < DN; i++) m.bone('s' + i, 'root', [0, 0, -i * DD]);
  m.bone('head', 's0', [0, 0, 0.2]); m.bone('jaw', 'head', [0, -0.3, 0.55]);
  for (const w of WINGS) { m.bone(w.name + 'R', 's' + w.spine, w.hub); m.bone(w.name + 'L', 's' + w.spine, [-w.hub[0], w.hub[1], w.hub[2]]); }
  // 体のどこが、どの背骨に従うか（となり合う 2 本のあいだで なめらかに移る）
  const spineW = (x, y, z) => { const q = min(DN - 1.001, max(0, -z / DD)), i = floor(q), f = q - i, u = f * f * (3 - 2 * f); return [['s' + i, 1 - u + 1e-3], ['s' + (i + 1), u + 1e-3]]; };
  // ---- 体（長い管）。背すじは少し高く、腹は少しひらたい
  const pts = []; for (let s = 0; s <= DL + 1e-6; s += 0.6) pts.push([0, 0.04 * bodyR(s), -s, bodyR(s)]);
  const body = chain(pts);
  m.part('body', body, { h: 0.17, mat: 'scale', mask: [['belly', (x, y, z) => y + 0.55 * bodyR(-z) - 0.25 * abs(x), 0.25]], bone: spineW });
  // ---- 背の装甲: 黒い板を並べ、ふちは金。板ごとに青い石と、うしろへはねる金の刃
  const plates = [], gems = [], finC = [];
  const fin = plate([0, 0, 0], I3, [[-0.14, -0.05], [-0.22, 0.3], [-0.05, 1.0], [0.2, 0.4], [0.14, -0.05]], 0.06, { edge: 0.16, round: 0.008, thin: 0.42 });
  for (let k = 0; k < 17; k++) {
    const s = 1.3 + k * 1.62, r = bodyR(s), w = 0.46 * r + 0.14, bone = 's' + min(DN - 1, Math.round(s / DD));
    plates.push(rbox([0, r * 0.98 + 0.06, -s], [w, 0.17, 0.66], 0.14, rotX(-0.08)));
    plates.push(mirror(rbox([w + 0.12, r * 0.74, -s - 0.1], [0.2, 0.12, 0.5], 0.09, euler(-5, 0, -38))));
    gems.push(ellipsoid([0, r * 0.98 + 0.24, -s + 0.05], [0.17 * (0.6 + 0.4 * r), 0.09, 0.3]));
    const L = 0.55 + 0.95 * r, side = k % 2 === 0;
    for (const [dir, nor, len, off] of [[[0.62, 0.62, -0.5], [0.3, 0.3, 1], side ? L : 0, [w + 0.14, r * 0.8, -s - 0.2]], [[0.0, 0.7, -0.72], [1, 0, 0], L * 0.9, [0, r + 0.2, -s - 0.5]]]) {
      if (len <= 0) continue;
      const Rm = bladeR(dir, nor).map((row) => [row[0] * (0.9 + 0.5 * r), row[1] * len, row[2] * 1.3]), c = { R: Rm, t: off, bone };
      finC.push(c); if (abs(off[0]) > 0.01) finC.push(mirrored(c, bone));
    }
  }
  const armorS = union(plates);
  m.part('armor', armorS, { h: 0.115, mat: 'black', mask: [['gold', (x, y, z) => 0.3 * bodyR(-z) + 0.02 - abs(x) + 0.5 * max(0, 0.36 - abs(((-z - 1.3) / 1.62 + 0.5) % 1 - 0.5) * 1.62 - 0.2)]], bone: spineW });
  m.part('gems', union(gems), { h: 0.075, mat: 'gem', bone: spineW, ao: false, cast: false });
  m.part('fins', fin, { h: 0.034, mat: 'gold', mask: [['black', (x, y, z) => y - 0.1]], copies: finC, ao: false, cast: false });
  m.part('marks', marks(), { mat: 'pin', bone: spineW });
  // 尾の先: 金の刃を 3 枚、扇のように
  const tailC = [];
  for (const [dir, nor, len] of [[[0, 0.1, -1], [0, 1, 0], 3.2], [[0.5, 0.1, -0.85], [0, 1, 0.2], 2.4], [[-0.5, 0.1, -0.85], [0, 1, -0.2], 2.4], [[0, 0.6, -0.8], [1, 0, 0], 2.0]]) tailC.push({ R: bladeR(dir, nor).map((row) => [row[0] * 2.6, row[1] * len, row[2] * 1.6]), t: [0, 0, -DL + 0.6], bone: 's' + (DN - 1) });
  m.part('tailFin', fin, { h: 0.034, mat: 'gold', mask: [['black', (x, y, z) => y - 0.1]], copies: tailC, ao: false, cast: false });
  // ---- 頭: 長い鼻づら、まゆの張り出し、ほお。ひとつの形を口の面で上下に分け、中をくぼませる
  const gn = V.norm([0, 1, 0.06]), gk = V.dot(gn, [0, -0.3, 0.6]), gape = (x, y, z) => x * gn[0] + y * gn[1] + z * gn[2] - gk;      // 上あごの側が正
  const solid = blend(0.25, ellipsoid([0, 0.12, 0.9], [0.86, 0.74, 1.15]), rcone([0, 0.04, 1.5], [0, -0.06, 3.25], 0.56, 0.3), sphere([0, 0.1, 3.3], 0.26),
    mirror(rcone([0.3, 0.6, 1.75], [0.62, 0.8, 0.5], 0.2, 0.17)), mirror(sphere([0.6, -0.1, 0.9], 0.42)), rcone([0, -0.5, 0.5], [0, -0.44, 3.0], 0.46, 0.22), mirror(sphere([0.2, 0.16, 3.2], 0.13)));
  const hollow = ellipsoid([0, -0.33, 1.9], [0.3, 0.16, 1.15], rotX(-3 * D2R));
  const upper = cut(both(solid, { bb: solid.bb, d: (x, y, z) => -gape(x, y, z) }, 0.02), hollow, 0.03);
  const lower = cut(both(solid, { bb: solid.bb, d: (x, y, z) => gape(x, y, z) + 0.012 }, 0.02), hollow, 0.03);
  m.part('headU', upper, { h: 0.07, mat: 'scale', mask: [['mouth', (x, y, z) => gape(x, y, z) - 0.01], ['black', (x, y, z) => min(hypot(x, y - 0.74, (z - 1.2) * 0.5) - 0.3, max(abs(x) - 0.16, 0.6 - y, abs(z - 2.1) - 1.0))]], bone: 'head' });
  m.part('headL', lower, { h: 0.07, mat: 'scale', mask: [['mouth', (x, y, z) => -gape(x, y, z) - 0.022]], bone: 'jaw' });
  m.part('eyes', mirror(ellipsoid([0.66, 0.42, 1.55], [0.1, 0.13, 0.27], euler(0, -14, -20))), { h: 0.035, mat: 'eye', bone: 'head', ao: false, cast: false });
  m.part('headGem', ellipsoid([0, 0.84, 1.15], [0.14, 0.08, 0.26]), { h: 0.035, mat: 'gem', bone: 'head', ao: false, cast: false });
  // 歯（上は頭に、下はあごに付く）
  const tooth = cone([0, 0, 0], [0, -1, 0], 0.5, 0.04, 0.02), tU = [], tL = [];
  for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) {
    const z = 1.2 + i * 0.3, x = sx * (0.5 - 0.035 * i) * 0.86, big = i === 5 ? 1.7 : 1;
    tU.push({ R: [[0.14 * big, 0, 0], [0, 0.26 * big, 0], [0, 0, 0.14 * big]], t: [x, -0.3 + 0.06 * (z - 0.6), z], bone: 'head' });
    if (i < 6) tL.push({ R: [[0.12, 0, 0], [0, -0.2, 0], [0, 0, 0.12]], t: [x * 0.9, -0.4 + 0.06 * (z - 0.6), z + 0.15], bone: 'jaw' });
  }
  m.part('teeth', tooth, { h: 0.12, mat: 'tooth', copies: [...tU, ...tL], ao: false, cast: false });
  // 角の冠（金の刃）: 長い 2 本をうしろへ、その内と外に短いもの、額のまんなかに 1 本
  const hornC = [];
  for (const [dir, nor, len, w, off] of [[[0.42, 0.72, -0.6], [0.3, 0.2, 1], 4.4, 3.0, [0.5, 0.62, 0.5]], [[0.75, 0.5, -0.5], [0.2, 0.3, 1], 2.9, 2.4, [0.7, 0.4, 0.3]], [[0.2, 0.9, -0.42], [0.5, 0.0, 1], 2.6, 2.2, [0.26, 0.74, 0.8]], [[0.9, 0.1, -0.45], [0.0, 1, 0.2], 2.2, 2.0, [0.76, 0.0, 0.5]]]) {
    const c = { R: bladeR(dir, nor).map((row) => [row[0] * w, row[1] * len, row[2] * 1.8]), t: off, bone: 'head' }; hornC.push(c, mirrored(c, 'head'));
  }
  hornC.push({ R: bladeR([0, 0.8, -0.3], [1, 0, 0]).map((row) => [row[0] * 2.2, row[1] * 3.0, row[2] * 1.8]), t: [0, 0.8, 1.0], bone: 'head' });
  m.part('horns', fin, { h: 0.034, mat: 'gold', mask: [['black', (x, y, z) => y - 0.08]], copies: hornC, ao: false, cast: false });
  // 頭のうしろの光の輪
  m.part('halo', union(torus([0, 0.7, -1.4], [0, 0, 1], 3.7, 0.075), torus([0, 0.7, -1.4], [0, 0, 1], 3.25, 0.03)), { h: 0.11, mat: 'halo', bone: 'head', ao: false, cast: false });
  // ---- たてがみ: 頭のうしろから首へ流れる長い束（白。先は黄色）と、あごひげ
  const rb = (P, fl = [0, 1, 0.2]) => ribbon(P, fl, 0.5, 14), mane = [];
  for (const [x0, y0, len, lift, rad] of [[0, 0.85, 9.5, 1.5, 0.42], [0.5, 0.7, 8.4, 1.2, 0.38], [-0.5, 0.7, 8.8, 1.3, 0.38], [0.85, 0.3, 7.2, 0.7, 0.32], [-0.85, 0.3, 7.6, 0.8, 0.32], [0.3, 0.95, 6.0, 2.2, 0.3], [-0.3, 0.95, 6.4, 2.4, 0.3], [0.9, -0.2, 5.6, 0.1, 0.28], [-0.9, -0.2, 5.2, 0.0, 0.28]])
    mane.push(rb([[x0, y0, 0.3, rad * 0.8], [x0 * 1.3, y0 + lift * 0.5, -len * 0.25, rad], [x0 * 1.7, y0 + lift, -len * 0.55, rad * 0.9], [x0 * 2.0, y0 + lift * 0.9, -len * 0.82, rad * 0.55], [x0 * 2.2, y0 + lift * 0.6, -len, 0.02]], [x0 * 0.3, 1, 0.1]));
  mane.push(rb([[0.22, -0.6, 2.2, 0.16], [0.3, -1.3, 1.6, 0.18], [0.34, -1.9, 0.6, 0.13], [0.36, -2.2, -0.5, 0.02]], [1, 0.2, 0]), rb([[-0.22, -0.6, 2.2, 0.16], [-0.3, -1.3, 1.6, 0.18], [-0.34, -2.0, 0.5, 0.13], [-0.36, -2.3, -0.7, 0.02]], [1, 0.2, 0]));
  m.part('mane', blend(0.05, mane), { h: 0.15, mat: 'hair', mask: [['hairTip', (x, y, z) => z + 5.2, 2.4]], bone: spineW });
  const tuft = [];
  for (const [dx, dy, len] of [[0, 0.3, 5.5], [0.5, 0.0, 4.4], [-0.5, 0.1, 4.8], [0, -0.3, 4.0]]) tuft.push(rb([[dx * 0.3, dy * 0.3, -DL + 1.4, 0.2], [dx, dy + 0.3, -DL - len * 0.3, 0.26], [dx * 1.6, dy + 0.4, -DL - len * 0.7, 0.2], [dx * 2.0, dy + 0.2, -DL - len, 0.02]], [dx * 0.4, 1, 0.1]));
  m.part('tuft', blend(0.05, tuft), { h: 0.14, mat: 'hair', mask: [['hairTip', (x, y, z) => z + DL + 1.8, 1.6]], bone: 's' + (DN - 1) });
  // ---- 翼: 黒い軸に青い輪、白い羽（先は金、付け根は黒）、あいだに金の光の膜
  const blade = plate([0, 0, 0], I3, [[-0.1, 0.24], [-0.25, 0.56], [-0.2, 0.8], [-0.05, 1.0], [0.16, 0.74], [0.27, 0.48], [0.12, 0.24]], 0.05, { edge: 0.13, round: 0.006, thin: 0.42 });
  const hubs = [], rings = [], arms = [], bc = [];
  for (const w of WINGS) {
    const c = w.hub, k = w.name === 'wF' ? 1 : 0.75;
    hubs.push([blend(0.05, cyl(V.add(c, [0, 0, -0.22 * k]), V.add(c, [0, 0, 0.22 * k]), 0.74 * k, 0.08), cyl(V.add(c, [0, 0, -0.34 * k]), V.add(c, [0, 0, 0.34 * k]), 0.3 * k, 0.06)), w.name]);
    rings.push([union(torus(V.add(c, [0, 0, 0.22 * k]), [0, 0, 1], 0.5 * k, 0.08 * k), torus(V.add(c, [0, 0, -0.22 * k]), [0, 0, 1], 0.5 * k, 0.08 * k)), w.name]);
    arms.push([tube([[...c, 0.17 * k], [c[0] * 0.6, c[1] * 0.8, c[2] + 0.2, 0.16 * k], [0.3, 0.6, c[2] + 0.3, 0.15 * k]], 6), w.name]);
    w.blades.forEach(([a, L], i) => { const R0 = rotZ((a - 90) * D2R), Rm = R0.map((row) => [row[0] * (1.7 + 0.14 * L), row[1] * L, row[2] * 2.0]), cc = { R: Rm, t: [c[0], c[1], c[2] + 0.08 * (i % 2 ? 1 : -1)], bone: w.name + 'R' }; bc.push(cc, mirrored(cc, w.name + 'L')); });
  }
  for (const [list, pn, mt, hh] of [[hubs, 'wHub', 'black', 0.08], [rings, 'wRing', 'gem', 0.055], [arms, 'wArm', 'black', 0.08]]) list.forEach(([shape, wn], i) => m.part(pn + i, shape, { h: hh, mat: mt, copies: [{ bone: wn + 'R' }, { bone: wn + 'L', mirror: true }], ao: false, cast: mt === 'black' }));
  m.part('blade', blade, { h: 0.03, mat: 'armor', mask: [['gold', (x, y, z) => 0.7 - y + 0.5 * abs(x)], ['black', (x, y, z) => y - 0.36]], copies: bc, ao: false, cast: false });
  const membW = (x, y, z) => [[(z < -5.5 ? 'wB' : 'wF') + 'R', 1]];
  m.part('memb', membMesh(), { mat: 'film', bone: membW, copies: [{}, { mirror: true }], alpha: true });
  return m;
}
