// props.mjs — 文鳥の装備（噴射装置・バズーカ・ガトリング・色眼鏡・帽子・マント・落下傘）と、弾・ミサイルなどの 3D モデル。
//   装備は文鳥のモデルと同じ座標で作ってあり、胸や頭の骨の動きに合わせて置く。弾は +z が進む向き。
import { sphere, ellipsoid, rcone, rbox, torus, cyl, cone, plate, union, blend, cut, both, grow, shell, mirror, tube, euler, rotX, rotZ, V, I3 } from './sdf.mjs';
import { Model } from './pack.mjs';
import { bunchoShapes, HC } from './buncho.mjs';

const H = (x, y, z) => [HC[0] + x, HC[1] + y, HC[2] + z], PI = Math.PI;
const gear = (m) => {
  m.mat('armor', { col: '#15161c', kind: 'gloss', spec: 0.9, gloss: 70, rim: 0.2, toon: 0 });
  m.mat('steel', { col: '#5d6372', kind: 'metal', spec: 0.9, gloss: 50, rim: 0.2, shade: '#262a36', toon: 0 });
  m.mat('dark', { col: '#24252c', kind: 'matte', spec: 0.3, gloss: 30, rim: 0.15, toon: 0 });
  m.mat('lamp', { col: '#ff3a22', kind: 'glow', emis: 1, toon: 0 });
  m.mat('hot', { col: '#ffb44a', kind: 'glow', emis: 1, toon: 0 });
  m.mat('red', { col: '#b8242a', kind: 'matte', spec: 0.4, gloss: 40, rim: 0.12, toon: 0 });
  m.mat('gold', { col: '#d8a838', kind: 'metal', spec: 0.9, gloss: 50, rim: 0.2, shade: '#7a5a16', toon: 0 });
  m.mat('olive', { col: '#3d4436', kind: 'matte', spec: 0.3, gloss: 30, rim: 0.15, shade: '#1c2018', toon: 0 });
  m.mat('brass', { col: '#c79a4a', kind: 'metal', spec: 0.9, gloss: 60, rim: 0.2, shade: '#6e4f1c', toon: 0 });
  m.mat('white', { col: '#e9e9ee', kind: 'matte', spec: 0.4, gloss: 40, rim: 0.15, toon: 0 });
};
// 胴のまわりに 4 枚の羽（pts: [胴からの距離, 前後の位置] の輪郭）
const fins4 = (z0, pts, a0) => { const f = plate([0, 0, 0], I3, pts, 0.014, { round: 0.004 }), R = Math.max(...pts.map((p) => Math.hypot(p[0], p[1]))) + 0.05; return union([0, 1, 2, 3].map((i) => { const a = a0 + i * PI / 2, c = Math.cos(a), sn = Math.sin(a); return { bb: [-R, -R, z0 - R, R, R, z0 + R], d: (x, y, z) => f.d(x * c + y * sn, z - z0, -x * sn + y * c) }; })); };
const one = (name, o = {}) => { const m = new Model(name, { toon: 0, line: 0, aoR: 0.35, ...o }); gear(m); m.bone('root', null, [0, 0, 0]); return m; };

// ---- 噴射装置（背中）。黒い箱と 2 本の筒、下向きの噴射口、赤い灯
export function buildJetpack() {
  const m = one('jetpack');
  const pack = blend(0.08, rbox([0, 2.95, -0.98], [0.5, 0.66, 0.26], 0.12), mirror(cyl([0.56, 3.5, -1.02], [0.56, 2.28, -1.02], 0.27, 0.1)), rbox([0, 3.52, -0.9], [0.36, 0.14, 0.2], 0.06), mirror(rbox([0.4, 3.0, -0.72], [0.1, 0.42, 0.14], 0.04)));
  const nozzle = mirror(cut(cone([0.56, 2.32, -1.02], [0.56, 1.9, -1.06], 0.2, 0.32, 0.02), cone([0.56, 2.2, -1.03], [0.56, 1.84, -1.07], 0.13, 0.28)));
  const hot = mirror(cyl([0.56, 2.2, -1.03], [0.56, 2.27, -1.02], 0.16));
  const lamps = union(rbox([0, 3.08, -1.25], [0.3, 0.035, 0.025], 0.015), rbox([0, 2.9, -1.25], [0.2, 0.03, 0.025], 0.012), mirror(rbox([0.56, 3.1, -1.3], [0.03, 0.22, 0.025], 0.012)));
  const fins = mirror(plate([0.86, 3.0, -1.05], euler(0, 90, 0), [[-0.25, -0.5], [0.05, -0.6], [0.3, 0.35], [-0.1, 0.5]], 0.03, { edge: 0.12, round: 0.01 }));
  m.part('pack', pack, { h: 0.06, mat: 'armor' }); m.part('nozzle', nozzle, { h: 0.04, mat: 'steel' });
  m.part('hot', hot, { h: 0.03, mat: 'hot', ao: false, cast: false }); m.part('lamps', lamps, { h: 0.02, mat: 'lamp', ao: false, cast: false }); m.part('fins', fins, { h: 0.03, mat: 'armor' });
  return m;
}
// ---- バズーカ（右肩にかつぐ）。筒・うしろの広がった口・照準・にぎり・先に見える弾頭
export function buildBazooka() {
  const m = one('bazooka'), ax = (z, dy = 0) => [1.3, 4.05 + dy, z];
  const tubeS = cut(union(cyl(ax(-1.6), ax(1.4), 0.26, 0.02), cyl(ax(1.28), ax(1.44), 0.31, 0.03), cyl(ax(-0.66), ax(0.2), 0.29, 0.03)), cyl(ax(0.8), ax(1.6), 0.2));
  const rear = cut(cone(ax(-1.58), ax(-2.1), 0.25, 0.42, 0.02), cone(ax(-1.7), ax(-2.16), 0.16, 0.37));
  const grips = union(rbox(ax(0.5, -0.42), [0.06, 0.19, 0.085], 0.03, rotX(-0.25)), rbox(ax(0.98, -0.4), [0.055, 0.17, 0.07], 0.03, rotX(0.1)), rbox(ax(0.74, -0.29), [0.03, 0.03, 0.22], 0.015));
  const sight = union(rbox([1.02, 4.3, 0.45], [0.03, 0.1, 0.2], 0.02), cut(cyl([1.02, 4.42, 0.3], [1.02, 4.42, 0.62], 0.085, 0.01), cyl([1.02, 4.42, 0.2], [1.02, 4.42, 0.7], 0.058)));
  const pad = rbox(ax(-0.3, -0.3), [0.16, 0.06, 0.32], 0.05);
  const head = blend(0.06, cone(ax(1.42), ax(2.0), 0.19, 0.035, 0.02), sphere(ax(1.56), 0.24));
  m.part('tube', tubeS, { h: 0.05, mat: 'olive' }); m.part('rear', rear, { h: 0.05, mat: 'dark' }); m.part('grips', grips, { h: 0.03, mat: 'dark' });
  m.part('sight', sight, { h: 0.025, mat: 'armor' }); m.part('pad', pad, { h: 0.035, mat: 'dark' }); m.part('head', head, { h: 0.03, mat: 'red', mask: [['steel', (x, y, z) => 1.82 - z]] });
  return m;
}
// ---- ガトリング（腰だめ）。6 本の銃身（回る）・胴・弾の箱・取っ手
export function buildGatling() {
  const m = one('gatling'), C = [1.4, 1.3], ax = (z, dx = 0, dy = 0) => [C[0] + dx, C[1] + dy, z];      // 右手で上の取っ手をつかんで、腰の横に下げる
  m.bone('spin', 'root', ax(1.0));
  const barrels = union([0, 1, 2, 3, 4, 5].map((i) => { const a = i / 6 * PI * 2; return cut(cyl(ax(1.0, Math.cos(a) * 0.2, Math.sin(a) * 0.2), ax(3.3, Math.cos(a) * 0.2, Math.sin(a) * 0.2), 0.082, 0.012), cyl(ax(3.1, Math.cos(a) * 0.2, Math.sin(a) * 0.2), ax(3.4, Math.cos(a) * 0.2, Math.sin(a) * 0.2), 0.045)); }));
  const clamps = union([1.5, 2.3, 3.14].map((z) => cyl(ax(z), ax(z + 0.09), 0.31, 0.02)), cyl(ax(1.0), ax(3.2), 0.07));
  const body = blend(0.06, cyl(ax(-0.1), ax(1.05), 0.4, 0.07), rbox(ax(-0.36), [0.26, 0.28, 0.3], 0.07), rbox(ax(0.5, 0, 0.4), [0.16, 0.1, 0.36], 0.05));
  const handle = union(tube([[...ax(0.1, 0, 0.46), 0.055], [...ax(0.24, 0, 0.78), 0.055], [...ax(0.76, 0, 0.78), 0.055], [...ax(0.9, 0, 0.46), 0.055]], 10), rbox(ax(-0.56, 0, -0.12), [0.07, 0.2, 0.1], 0.035, rotX(0.3)));
  const drum = union(cyl(ax(0.5, 0.42, -0.06), ax(0.5, 0.9, -0.06), 0.4, 0.06), tube([[...ax(0.55, 0.66, 0.3), 0.075], [...ax(0.62, 0.5, 0.5), 0.075], [...ax(0.66, 0.2, 0.42), 0.075]], 6));
  m.part('body', body, { h: 0.06, mat: 'armor' }); m.part('handle', handle, { h: 0.04, mat: 'dark' }); m.part('drum', drum, { h: 0.06, mat: 'olive' });
  m.part('barrels', barrels, { h: 0.034, mat: 'steel', bone: 'spin' }); m.part('clamps', clamps, { h: 0.04, mat: 'armor', bone: 'spin' });
  return m;
}
// ---- 色眼鏡と、隊長の帽子・マント（どれも頭や胸の骨に合わせて置く）
export function buildShades() {
  const m = one('shades'), s = bunchoShapes();
  const band = { bb: [-2, HC[1] - 0.1, HC[2] + 0.1, 2, HC[1] + 0.34, HC[2] + 1.4], d: (x, y, z) => Math.max(Math.abs(y - HC[1] - 0.12) - 0.2, HC[2] + 0.28 - z, Math.abs(x) < 0.07 ? 0.02 : -1) };
  const lens = cut(both(grow(s.head, 0.075), band, 0.04), grow(s.head, 0.03));
  const arms = mirror(rbox(H(0.99, 0.2, -0.05), [0.03, 0.035, 0.42], 0.015));
  const bridge = rbox(H(0, 0.24, 0.98), [0.12, 0.03, 0.03], 0.02);
  m.part('lens', lens, { h: 0.03, mat: 'armor' }); m.part('arms', union(arms, bridge), { h: 0.025, mat: 'armor' });
  return m;
}
export function buildCap() {
  const m = one('cap');
  const crown = blend(0.1, cone(H(0, 0.5, -0.03), H(0, 1.02, -0.14), 0.86, 1.06, 0.08), ellipsoid(H(0, 1.02, -0.14), [1.0, 0.16, 1.0], rotX(-0.2)));
  const band = cyl(H(0, 0.46, -0.02), H(0, 0.7, -0.05), 0.9, 0.03);
  const visor = plate(H(0, 0.5, 0.72), [[1, 0, 0], [0, -0.3, 0.954], [0, 0.954, 0.3]], [[-0.84, -0.12], [-0.78, 0.2], [-0.5, 0.46], [0, 0.56], [0.5, 0.46], [0.78, 0.2], [0.84, -0.12]], 0.035, { edge: 0.12, round: 0.012, thin: 0.5 });
  const badge = union(cyl(H(0, 0.82, 0.84), H(0, 0.8, 0.95), 0.2, 0.02), plate(H(0, 0.81, 0.955), rotX(-0.2), [[-0.11, 0.08], [0.11, 0.08], [0, -0.13]], 0.02, { round: 0.008 }));
  m.part('crown', crown, { h: 0.085, mat: 'armor' }); m.part('band', band, { h: 0.075, mat: 'red' }); m.part('visor', visor, { h: 0.03, mat: 'armor' }); m.part('badge', badge, { h: 0.025, mat: 'gold', mask: [['red', (x, y, z) => 0.945 - (z - HC[2]) + 0.3 * Math.max(0, Math.hypot(x, y - HC[1] - 0.81) - 0.14)]] });
  return m;
}
export function buildCape() {
  const m = one('cape');
  const bell = rcone([0, 3.95, -0.3], [0, 0.35, -0.85], 0.86, 1.8);
  const back = { bb: [-3, 0.3, -3, 3, 4.1, 0.2], d: (x, y, z) => Math.max(z + 0.12 - 0.22 * Math.abs(x), 0.42 - y + 0.12 * Math.sin(x * 5.0), y - 4.02) };
  const cloth = both(shell(bell, 0.075), back, 0.04);
  const collar = both(shell(rcone([0, 3.7, -0.1], [0, 4.25, -0.2], 0.7, 0.95), 0.05), { bb: [-2, 3.7, -2, 2, 4.3, 0.5], d: (x, y, z) => Math.max(z - 0.3 + 0.5 * Math.abs(x), 3.75 - y, y - 4.2 + 0.12 * Math.abs(x)) }, 0.03);
  const pads = mirror(union(rbox([1.5, 3.86, 0], [0.42, 0.07, 0.3], 0.05, rotZ(-0.2)), sphere([1.82, 3.74, 0.0], 0.13), cyl([1.2, 3.86, 0.26], [1.75, 3.76, 0.26], 0.035, 0.01)));
  const clasp = union(mirror(sphere([0.42, 3.78, 0.5], 0.09)), tube([[-0.42, 3.78, 0.5, 0.03], [0, 3.62, 0.66, 0.03], [0.42, 3.78, 0.5, 0.03]], 8));
  m.part('cloth', cloth, { h: 0.1, mat: 'dark', mask: [['red', (x, y, z) => bell.d(x, y, z)]] });
  m.part('collar', collar, { h: 0.06, mat: 'dark', mask: [['red', (x, y, z) => rcone([0, 3.7, -0.1], [0, 4.25, -0.2], 0.7, 0.95).d(x, y, z)]] });
  m.part('pads', pads, { h: 0.03, mat: 'gold' }); m.part('clasp', clasp, { h: 0.025, mat: 'gold' });
  return m;
}
// ---- 落下傘（赤と黒の縞の傘と、肩へのびるひも）。うすい布なので、網目を直接作る（表と裏の 2 枚）
function rawMesh() {
  const pos = [], nor = [], quads = [];
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  return {
    vert: (p, n) => { pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); return pos.length / 3 - 1; },
    // 四角形（頂点の並びは、法線 n の向きに合わせて自動でそろえる）
    quad: (a, b, c, d, n) => { let g = V.cross(V.sub(P(b), P(a)), V.sub(P(c), P(a))); if (V.len(g) < 1e-9) g = V.cross(V.sub(P(c), P(a)), V.sub(P(d), P(a))); if (V.dot(g, n) >= 0) quads.push(a, b, c, d); else quads.push(a, d, c, b); },
    done: () => ({ raw: { pos: new Float32Array(pos), nor: new Float32Array(nor), quads: new Uint32Array(quads) } }),
  };
}
export function buildChute() {
  const m = one('chute', { aoR: 0.6 }), cy = 8.6, N = 32, M = 7, R = 2.7, Hh = 1.75, TAU = PI * 2;
  // 傘: てっぺん（v = 0）からふち（v = 1）へ。ひものあいだは外へふくらみ、ふちは弓なりに上がる
  const dome = (a, v) => { const th = v * PI * 0.5, r = R * Math.sin(th) * (1 + 0.05 * v * Math.cos(8 * a)); return [r * Math.sin(a), cy + Hh * Math.cos(th) + 0.16 * v * v * v * Math.cos(8 * a), r * Math.cos(a)]; };
  const out = (a, v) => { const e = 2e-3, vv = Math.max(v, 0.03), p = dome(a, vv); let n = V.norm(V.cross(V.sub(dome(a, vv + e), p), V.sub(dome(a + e, vv), p))); if (V.dot(n, [p[0], p[1] - cy + 1.0, p[2]]) < 0) n = V.mul(n, -1); return n; };
  const A = rawMesh();
  for (const side of [1, -1]) {
    const id = [], ns = [];
    for (let j = 0; j <= M; j++) for (let i = 0; i <= N; i++) { const a = i / N * TAU, v = j / M, n = V.mul(out(a, v), side); ns.push(n); id.push(A.vert(V.add(dome(a, v), n, side < 0 ? 0.03 : 0), n)); }
    for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) { const q = j * (N + 1) + i; A.quad(id[q], id[q + 1], id[q + N + 2], id[q + N + 1], ns[q + N + 2]); }
  }
  // ひも: 細い三角の柱を 8 本
  const B = rawMesh();
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) / 8 * TAU, top = dome(a, 1), bot = [0.85 * (Math.sin(a) > 0 ? 1 : -1), 4.0, -0.1], d = V.norm(V.sub(bot, top)), u = V.norm(V.cross(d, [0, 0, 1])), w = V.cross(d, u), r = 0.032;
    for (let k = 0; k < 3; k++) {
      const a0 = k / 3 * TAU, a1 = (k + 1) / 3 * TAU, am = (a0 + a1) / 2, o0 = V.add(V.mul(u, Math.cos(a0) * r), w, Math.sin(a0) * r), o1 = V.add(V.mul(u, Math.cos(a1) * r), w, Math.sin(a1) * r), n = V.add(V.mul(u, Math.cos(am)), w, Math.sin(am));
      B.quad(B.vert(V.add(top, o0), n), B.vert(V.add(top, o1), n), B.vert(V.add(bot, o1), n), B.vert(V.add(bot, o0), n), n);
    }
  }
  m.part('dome', A.done(), { mat: 'dark', mask: [['red', (x, y, z) => Math.sin(4 * Math.atan2(x, z)) * 0.6]] });
  m.part('lines', B.done(), { mat: 'white' });
  return m;
}

// ============================================================ 弾（+z が進む向き。長さがおよそ 1）
// 機関砲の弾: とがった鋼の頭、真ちゅうの胴、銅の帯、底が曳光で光る
export function buildRound(name = 'round', o = {}) {
  const m = one(name, { aoR: 0.2 }), r = o.r || 0.17, L = o.len || 1.0;
  m.mat('trace', { col: o.trace || '#ff8a3a', kind: 'glow', emis: 1, toon: 0 });
  const nose = blend(0.04, cone([0, 0, L * 0.1], [0, 0, L * 0.52], r, r * (o.blunt || 0.16), 0.01), sphere([0, 0, L * 0.5], r * (o.blunt || 0.16) * 1.3));
  const body = union(cyl([0, 0, -L * 0.42], [0, 0, L * 0.12], r, 0.02), cyl([0, 0, -L * 0.12], [0, 0, -L * 0.04], r * 1.07, 0.012), cone([0, 0, -L * 0.5], [0, 0, -L * 0.4], r * 0.8, r, 0.01));
  const base = cyl([0, 0, -L * 0.52], [0, 0, -L * 0.47], r * 0.62);
  // 頭と胴はひとつづきの面にして、色の境目は場で分ける（頭 = 鋼、胴 = 真ちゅう、帯 = 銅）
  m.part('shell', blend(0.012, nose, body), { h: r * 0.22, mat: 'brass', mask: [[o.nose || 'steel', (x, y, z) => L * 0.115 - z], ['gold', (x, y, z) => Math.abs(z + L * 0.08) - L * 0.04]] });
  m.part('base', base, { h: r * 0.2, mat: 'trace', ao: false, cast: false });
  return m;
}
// ロケット弾（バズーカ）: 二重の円すいの弾頭、細い胴、うしろの羽、噴射口
export function buildRocket() {
  const m = one('rocket', { aoR: 0.25 });
  const head = blend(0.04, cone([0, 0, 0.18], [0, 0, 0.62], 0.2, 0.03, 0.01), cone([0, 0, 0.2], [0, 0, -0.06], 0.2, 0.09, 0.01));
  const body = union(cyl([0, 0, -0.62], [0, 0, 0.0], 0.085, 0.01), cyl([0, 0, -0.2], [0, 0, -0.1], 0.1, 0.01));
  const fins = fins4(-0.5, [[0.05, -0.16], [0.27, -0.22], [0.27, -0.06], [0.05, 0.14]], PI / 4);
  const noz = cut(cone([0, 0, -0.6], [0, 0, -0.72], 0.07, 0.11, 0.005), cone([0, 0, -0.6], [0, 0, -0.75], 0.03, 0.09));
  const hot = cyl([0, 0, -0.66], [0, 0, -0.63], 0.05);
  m.part('head', head, { h: 0.036, mat: 'olive', mask: [['red', (x, y, z) => Math.abs(z - 0.2) - 0.03]] }); m.part('body', body, { h: 0.03, mat: 'dark' }); m.part('fins', fins, { h: 0.022, mat: 'steel' });
  m.part('noz', noz, { h: 0.02, mat: 'steel' }); m.part('hot', hot, { h: 0.02, mat: 'hot', ao: false, cast: false });
  return m;
}
// ミサイル: 黒い胴、白い頭の帯、赤い線、中ほどの翼とうしろの羽
export function buildMissile() {
  const m = one('missile', { aoR: 0.25 });
  const fin = (z0, len, span) => fins4(z0, [[0.05, -len * 0.5], [span, -len * 0.62], [span, -len * 0.2], [0.05, len * 0.5]], 0);
  const body = blend(0.03, cyl([0, 0, -0.78], [0, 0, 0.5], 0.085, 0.015), cone([0, 0, 0.5], [0, 0, 0.82], 0.085, 0.03, 0.01), sphere([0, 0, 0.82], 0.036));
  const noz = cut(cone([0, 0, -0.76], [0, 0, -0.86], 0.07, 0.085, 0.005), cone([0, 0, -0.76], [0, 0, -0.9], 0.03, 0.075));
  m.part('body', body, { h: 0.028, mat: 'armor', mask: [['white', (x, y, z) => Math.abs(z - 0.44) - 0.05], ['red', (x, y, z) => Math.abs(Math.abs(z + 0.1) - 0.3) - 0.02]] });
  m.part('wings', fin(0.05, 0.4, 0.2), { h: 0.022, mat: 'armor' }); m.part('tail', fin(-0.66, 0.24, 0.17), { h: 0.022, mat: 'steel' });
  m.part('noz', noz, { h: 0.018, mat: 'steel' }); m.part('hot', cyl([0, 0, -0.8], [0, 0, -0.77], 0.05), { h: 0.02, mat: 'hot', ao: false, cast: false });
  return m;
}
// 機雷: 黒い玉に角が出ていて、赤い灯が帯になって光る
export function buildMine() {
  const m = one('mine', { aoR: 0.3 }), dirs = [];
  for (const y of [-0.52, 0, 0.52]) { const n = y === 0 ? 6 : 3, r = Math.sqrt(1 - y * y); for (let i = 0; i < n; i++) { const a = (i + (y > 0 ? 0.5 : 0) + (y === 0 ? 0.25 : 0)) / n * PI * 2; dirs.push([Math.cos(a) * r, y, Math.sin(a) * r]); } }
  dirs.push([0, 1, 0], [0, -1, 0]);
  const horns = union(dirs.map((d) => union(cone(V.mul(d, 0.42), V.mul(d, 0.62), 0.1, 0.06, 0.012), sphere(V.mul(d, 0.62), 0.065))));
  const ball = blend(0.05, sphere([0, 0, 0], 0.46), horns);
  m.part('ball', ball, { h: 0.04, mat: 'armor', mask: [['steel', (x, y, z) => 0.6 - Math.hypot(x, y, z)], ['lamp', (x, y, z) => Math.max(Math.abs(y - 0.26) - 0.022, Math.hypot(x, y, z) - 0.472)]] });
  return m;
}
// 光の結晶（両端のとがった六角の柱）と、ユリアの光の矢（細いひし形）
export function buildGem() {
  const m = one('gem', { aoR: 0.2 });
  m.mat('crystal', { col: '#ffd84a', kind: 'metal', spec: 1, gloss: 80, rim: 0.6, shade: '#c78a12', toon: 0, emis: 0.35 });
  const hex = (r) => [0, 1, 2, 3, 4, 5].map((i) => [Math.cos(i * PI / 3) * r, Math.sin(i * PI / 3) * r]);
  const planes = [0, 1, 2, 3, 4, 5].flatMap((i) => { const a = i * PI / 3 + PI / 6; return [[Math.cos(a) * 0.85, 0.52, Math.sin(a) * 0.85], [Math.cos(a) * 0.85, -0.52, Math.sin(a) * 0.85]]; });
  const gemS = { bb: [-0.4, -0.75, -0.4, 0.4, 0.75, 0.4], d: (x, y, z) => { let d = -1e9; for (const [nx, ny, nz] of planes) d = Math.max(d, x * nx + y * ny + z * nz - 0.36); const q = plate([0, 0, 0], I3, hex(0.3), 2, {}).d(x, z, 0); return Math.max(d, q) - 0.012; } };
  m.part('gem', gemS, { h: 0.05, mat: 'crystal' });
  return m;
}
export function buildArrow() {
  const m = one('arrow', { aoR: 0.2 });
  m.mat('light', { col: '#fff3c0', kind: 'glow', emis: 1, toon: 0 });
  const s = blend(0.03, cone([0, 0, -0.1], [0, 0, 0.6], 0.09, 0.01, 0.005), cone([0, 0, -0.1], [0, 0, -0.6], 0.09, 0.02, 0.005), plate([0, 0, 0.05], euler(90, 0, 0), [[-0.2, -0.05], [0, 0.28], [0.2, -0.05], [0, 0.06]], 0.02, { edge: 0.06, round: 0.004 }));
  m.part('bolt', s, { h: 0.025, mat: 'light', ao: false });
  return m;
}
