// buncho.mjs — マッスル文鳥（B.U.N の兵）の 3D モデル。
//   頭は本物の文鳥に寄せる: 黒い頭、ふっくらした白いほお、太くて赤いくちばし、赤い目のふち、黒くぬれた目。
//   体は灰色の羽におおわれたボディビルダー（胸・肩・腕・腹筋）。腹は文鳥の腹の桃色。脚は桃色のうろこの鳥の脚、尾は黒い尾羽。
//   座標: +y が上、+z が正面、+x が本人の右（この世界は左手系なので、正面から見ると +x は画面の左に来る）。頭の半径がおよそ 1。足の裏が y = -0.62、頭のてっぺんが y ≒ 5.5。
import { sphere, ellipsoid, rcone, rbox, torus, cyl, cone, plate, union, blend, cut, both, grow, move, mirror, tube, half, euler, look, rotX, rotZ, mul3, V, I3 } from './sdf.mjs';
import { Model, mirrored } from './pack.mjs';
import { autoWeights, bothSides } from './rig.mjs';

export const HC = [0, 4.72, 0.08];
const H = (x, y, z) => [HC[0] + x, HC[1] + y, HC[2] + z];
// 関節
export const J = {
  pelvis: [0, 1.45, 0], spine: [0, 1.9, 0], chest: [0, 2.6, 0], neck: [0, 3.8, 0], head: [0, 4.3, 0.02], jaw: H(0, -0.24, 0.6),
  S: [1.5, 3.34, 0], E: [2.25, 2.28, 0.02], W: [2.72, 1.32, 0.24], hip: [0.47, 1.3, 0], knee: [0.62, 0.42, 0.1], ankle: [0.62, -0.3, 0.02], tail: [0, 1.42, -0.42],
};
const mx = (p) => [-p[0], p[1], p[2]];
// 形の表面を、点 o から向き dir へ進んで探す
const surfaceAlong = (shape, o, dir, t0 = 0.2, t1 = 2.5) => { let a = t0, b = t1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (shape.d(o[0] + dir[0] * m, o[1] + dir[1] * m, o[2] + dir[2] * m) < 0) a = m; else b = m; } return V.add(o, dir, (a + b) / 2); };

export function bunchoShapes() { return shapes(); }
function shapes() {
  // ---- 頭: 丸い頭に、ふっくらしたほおと額。眉のあたりを少しだけ張り出させて、けわしい目つきにする
  const skull = blend(0.3, ellipsoid(H(0, 0.02, -0.03), [0.95, 0.92, 0.98]), mirror(sphere(H(0.45, -0.3, 0.28), 0.55)), sphere(H(0, 0.3, 0.38), 0.6));
  const brow = mirror(rcone(H(0.2, 0.27, 0.88), H(0.7, 0.42, 0.56), 0.1, 0.07));
  const head = blend(0.1, skull, brow);
  // 目は頭の表面に半分うずめる。赤いふちは、表面に沿った細い輪
  const eyeN = V.norm([0.66, 0.09, 0.72]), eyeS = surfaceAlong(head, HC, eyeN);
  const eye = sphere(V.add(eyeS, eyeN, -0.075), 0.16);
  const ring = torus(V.add(eyeS, eyeN, 0.004), eyeN, 0.166, 0.029);
  const cheek = mirror(ellipsoid(H(0.78, -0.22, 0.24), [0.44, 0.43, 0.6]));
  // ---- くちばし: 太くて短い円すい。上のふちは丸く盛り上がる。ひとつの形を、合わせ目の面で上下に分ける（中はくぼませて、口の中にする）
  const gn = V.norm([0, 1, 0.07]), g0 = H(0, -0.24, 0.66), gk = V.dot(gn, g0);
  const gape = (x, y, z) => x * gn[0] + y * gn[1] + z * gn[2] - gk;                        // 上あごの側が正
  const solid = blend(0.12, rcone(H(0, -0.08, 0.62), H(0, -0.2, 1.42), 0.41, 0.1), rcone(H(0, 0.17, 0.72), H(0, -0.12, 1.34), 0.14, 0.08),
    mirror(sphere(H(0.21, -0.16, 0.78), 0.21)), rcone(H(0, -0.34, 0.6), H(0, -0.31, 1.3), 0.31, 0.08));
  const hollow = ellipsoid(H(0, -0.264, 0.98), [0.15, 0.07, 0.3], rotX(-4 * Math.PI / 180));
  const beakU = cut(both(solid, { bb: solid.bb, d: (x, y, z) => -gape(x, y, z) }, 0.015), hollow, 0.02);
  const beakL = cut(both(solid, { bb: solid.bb, d: (x, y, z) => gape(x, y, z) + 0.01 }, 0.015), hollow, 0.02);
  const mouth = ellipsoid(H(0, -0.26, 0.7), [0.24, 0.12, 0.3]);
  const tongue = ellipsoid(H(0, -0.305, 0.98), [0.085, 0.03, 0.2]);
  // ---- 胴: 逆三角形。筋肉をひとつずつ置いて、なめらかにつなぐ（つなぐ幅が小さいほど、みぞが残る）
  const core = blend(0.3, ellipsoid([0, 2.98, -0.05], [0.92, 0.8, 0.6]), ellipsoid([0, 2.05, 0.02], [0.55, 0.72, 0.44]), ellipsoid([0, 1.42, -0.02], [0.62, 0.42, 0.48]));
  const lats = mirror(rcone([1.12, 3.2, -0.2], [0.5, 2.0, -0.1], 0.4, 0.14));
  const pecs = mirror(ellipsoid([0.52, 3.15, 0.4], [0.54, 0.4, 0.28], euler(-8, 12, -8)));
  const abs6 = union(mirror(union([2.52, 2.22, 1.93].map((y, i) => ellipsoid([0.19, y, 0.46 - i * 0.015], [0.18, 0.14, 0.11])))), ellipsoid([0, 1.62, 0.36], [0.3, 0.2, 0.12]));
  const obl = mirror(ellipsoid([0.6, 2.1, 0.1], [0.16, 0.38, 0.28]));
  const traps = mirror(rcone([0.12, 4.0, -0.14], [1.05, 3.6, -0.1], 0.34, 0.28));
  const neck = rcone([0, 3.6, -0.02], [0, 4.35, 0.03], 0.55, 0.5);
  const glute = mirror(sphere([0.34, 1.32, -0.3], 0.42));
  const torso = blend(0.045, blend(0.08, blend(0.2, core, lats, traps, neck, obl, glute), pecs), abs6);
  // ---- 腕（肩 → ひじ → 手首）。力こぶと、腕のうしろの筋肉を別々に盛る
  const { S, E, W, hip, knee, ankle } = J, Ra = look(V.sub(E, S)), Rf = look(V.sub(W, E));
  const arm = blend(0.08,
    ellipsoid([1.58, 3.32, 0], [0.53, 0.5, 0.5]), rcone(S, E, 0.28, 0.24),
    ellipsoid(V.add(V.lerp(S, E, 0.52), [0.02, 0.02, 0.17]), [0.31, 0.33, 0.52], Ra),
    ellipsoid(V.add(V.lerp(S, E, 0.5), [0.05, 0, -0.18]), [0.33, 0.33, 0.56], Ra),
    sphere(E, 0.26), rcone(E, W, 0.27, 0.18), ellipsoid(V.add(V.lerp(E, W, 0.28), [0.04, 0, 0.04]), [0.3, 0.32, 0.44], Rf));
  // もも。ひざのまわりは、羽がふさふさと終わる
  const cuff = union([0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i / 8 * Math.PI * 2; return sphere([knee[0] + Math.cos(a) * 0.19, knee[1] + 0.0 + 0.03 * Math.cos(a * 3), knee[2] + Math.sin(a) * 0.19], 0.12); }));
  const thigh = blend(0.1, rcone(hip, knee, 0.44, 0.25), ellipsoid(V.add(V.lerp(hip, knee, 0.4), [0, 0, 0.16]), [0.3, 0.45, 0.3]), cuff);
  const body = blend(0.1, torso, mirror(arm), mirror(thigh));
  const belly = ellipsoid([0, 2.2, 0.5], [0.56, 0.95, 0.46]);                                       // 腹の桃色の範囲
  // ---- 手（にぎりこぶし）
  const fist = blend(0.06, ellipsoid(V.add(W, [0.06, -0.2, 0.05]), [0.29, 0.31, 0.26]),
    union([-0.17, -0.02, 0.13].map((k) => rcone(V.add(W, [0.2, -0.2, 0.05 + k]), V.add(W, [0.26, -0.42, 0.05 + k]), 0.115, 0.1))), rcone(V.add(W, [-0.1, -0.14, 0.22]), V.add(W, [0.1, -0.34, 0.3]), 0.115, 0.095));
  // ---- 脚（すね: 桃色のうろこ）と足（前に 3 本、うしろに 1 本の指）
  const shank = blend(0.06, rcone(knee, ankle, 0.17, 0.115), sphere(ankle, 0.15));
  const toe = (dx, dz, len) => { const a = ankle, m = [a[0] + dx * len * 0.5, -0.5, a[2] + dz * len * 0.5], t = [a[0] + dx * len, -0.55, a[2] + dz * len]; return [tube([[...a, 0.11], [...m, 0.09], [...t, 0.07]], 6), t, [dx, dz]]; };
  const toes = [toe(0.05, 1, 0.78), toe(0.62, 0.8, 0.66), toe(-0.5, 0.86, 0.66), toe(0.08, -1, 0.42)];
  const foot = blend(0.05, toes.map((t) => t[0]));
  const claws = union(toes.map(([, t, d]) => rcone(V.add(t, [d[0] * 0.02, 0, d[1] * 0.02]), V.add(t, [d[0] * 0.2, -0.07, d[1] * 0.2]), 0.055, 0.012)));
  // ---- 背負いひも: 肩から反対のわき腹へ回る 2 本の帯と、腰の帯。胴の表面に沿わせる
  const onTorso = (p) => { const o = [0, Math.min(3.7, Math.max(1.6, p[1])), 0]; return surfaceAlong(torso, o, V.norm(V.sub(p, o)), 0.05, 2.5); };
  const loop = (sx) => tube([[0.74 * sx, 3.76, 0.0], [0.42 * sx, 3.45, 0.5], [0, 2.95, 0.7], [-0.4 * sx, 2.45, 0.55], [-0.6 * sx, 2.12, 0.08], [-0.5 * sx, 2.3, -0.42], [0, 2.95, -0.6], [0.5 * sx, 3.5, -0.4], [0.74 * sx, 3.76, 0.0]].map((p) => [...onTorso(p), 0.125]), 48);
  const belt = { bb: [-3, 1.5, -3, 3, 1.95, 3], d: (x, y, z) => Math.abs(y - 1.72) - 0.1 };
  const straps = both(grow(torso, 0.035), union(loop(1), loop(-1), belt), 0.015);
  const emblem = cyl([0, 2.95, 0.7], [0, 2.95, 0.8], 0.23, 0.02);
  const emblemMark = plate([0, 2.95, 0.8], I3, [[-0.13, 0.09], [0.13, 0.09], [0, -0.15]], 0.02, { round: 0.01 });
  return { head, eye, ring, cheek, beakU, beakL, gape, mouth, tongue, body, belly, torso, fist, shank, foot, claws, straps, emblem, emblemMark };
}

// 羽 1 枚（尾羽・腕の風切り羽）。局所の y が羽の向き、z が厚み
const feather = (len, wid) => plate([0, 0, 0], I3, [[-wid * 0.3, 0], [-wid * 0.5, len * 0.35], [-wid * 0.42, len * 0.85], [0, len], [wid * 0.42, len * 0.85], [wid * 0.5, len * 0.35], [wid * 0.3, 0]], 0.03, { edge: wid * 0.5, round: 0.006, thin: 0.3 });
// 羽を置く向き: 羽の向き dir と、面の向き nor から（列 = 局所の x, y, z）
const featherR = (dir, nor) => { const y = V.norm(dir), x = V.norm(V.cross(y, nor)), z = V.cross(x, y); return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]]; };

export function buildBuncho(o = {}) {
  const far = o.lod === 2, k = far ? 3.5 : o.lod ? 2.5 : 1.18, k2 = far ? 1.9 : o.lod ? 1.6 : 1, kb = far ? 2.4 : o.lod ? 1.8 : 1, s = shapes(), m = new Model(far ? 'buncho_far' : o.lod ? 'buncho_lo' : 'buncho', { toon: 0, line: 0, aoR: 0.5, height: 6.1 });
  const mat = (n, d) => m.mat(n, d);
  mat('black', { col: '#1b1b22', kind: 'feather', spec: 0.3, gloss: 22, rim: 0.3, shade: '#0d0d14', toon: 0 });
  mat('white', { col: '#f3efe7', kind: 'feather', spec: 0.1, gloss: 12, rim: 0.12, shade: '#aeb3c6', toon: 0 });
  mat('grey', { col: '#7f879b', kind: 'feather', spec: 0.16, gloss: 14, rim: 0.2, shade: '#4b5268', toon: 0 });
  mat('belly', { col: '#dbbdb1', kind: 'feather', spec: 0.12, gloss: 12, rim: 0.16, shade: '#8f6b6c', toon: 0 });
  mat('beakA', { col: '#d63746', kind: 'beak', spec: 0.5, gloss: 60, rim: 0.2, shade: '#7a1522', toon: 0 });
  mat('beakB', { col: '#f1b6bd', kind: 'beak', spec: 0.5, gloss: 60, rim: 0.2, shade: '#b9777f', toon: 0 });
  mat('eye', { col: '#09080b', kind: 'eye', spec: 1, gloss: 90, rim: 0, toon: 0 });
  mat('ring', { col: '#d2353c', kind: 'matte', spec: 0.3, gloss: 30, rim: 0.1, shade: '#7c1820', toon: 0 });
  mat('mouth', { col: '#6e1f2b', kind: 'matte', spec: 0.2, gloss: 20, rim: 0, shade: '#3a0c14', toon: 0 });
  mat('tongue', { col: '#e58b98', kind: 'matte', spec: 0.4, gloss: 30, rim: 0, shade: '#9b4a58', toon: 0 });
  mat('leg', { col: '#e99e8c', kind: 'scaly', spec: 0.3, gloss: 26, rim: 0.15, shade: '#a45a55', toon: 0 });
  mat('claw', { col: '#4a3d3d', kind: 'beak', spec: 0.4, gloss: 40, rim: 0.1, toon: 0 });
  mat('hand', { col: '#6d7588', kind: 'feather', spec: 0.14, gloss: 14, rim: 0.18, shade: '#3a4054', toon: 0 });
  mat('tail', { col: '#18181d', kind: 'feather', spec: 0.35, gloss: 20, rim: 0.3, shade: '#0a0a10', toon: 0 });
  mat('wingf', { col: '#687188', kind: 'feather', spec: 0.22, gloss: 18, rim: 0.22, shade: '#353b50', toon: 0 });
  mat('strap', { col: '#1b1b22', kind: 'matte', spec: 0.25, gloss: 30, rim: 0.12, toon: 0 });
  mat('gold', { col: '#d8a838', kind: 'metal', spec: 0.9, gloss: 50, rim: 0.2, shade: '#7a5a16', toon: 0 });
  mat('red', { col: '#c5252c', kind: 'matte', spec: 0.3, gloss: 30, rim: 0.1, toon: 0 });
  // ---- 骨
  m.bone('root', null, [0, 0, 0]);
  m.bone('pelvis', 'root', J.pelvis); m.bone('spine', 'pelvis', J.spine); m.bone('chest', 'spine', J.chest); m.bone('neck', 'chest', J.neck); m.bone('head', 'neck', J.head); m.bone('jaw', 'head', J.jaw);
  for (const [sd, f] of [['R', (p) => p], ['L', mx]]) {
    m.bone('arm' + sd, 'chest', f(J.S)); m.bone('fore' + sd, 'arm' + sd, f(J.E)); m.bone('hand' + sd, 'fore' + sd, f(J.W));
    m.bone('thigh' + sd, 'pelvis', f(J.hip)); m.bone('shin' + sd, 'thigh' + sd, f(J.knee)); m.bone('foot' + sd, 'shin' + sd, f(J.ankle));
  }
  m.bone('tail', 'pelvis', J.tail);
  const wts = autoWeights(bothSides([
    ['pelvis', [0, 1.2, 0], [0, 1.55, 0], 0.75], ['spine', [0, 1.8, 0], [0, 2.3, 0], 0.72], ['chest', [0, 2.7, 0], [0, 3.4, 0], 0.95], ['chest', [-0.85, 3.15, 0], [0.85, 3.15, 0], 0.72],
    ['neck', [0, 3.9, 0], [0, 4.4, 0], 0.5], ['arm#', J.S, J.E, 0.46], ['fore#', J.E, J.W, 0.36], ['thigh#', J.hip, J.knee, 0.44],
  ]), 6);
  const both2 = (bone) => [{ bone: bone + 'R' }, { bone: bone + 'L', mirror: true }];
  // ---- 部品
  m.part('body', s.body, { h: 0.06 * k, mat: 'grey', mask: [['belly', (x, y, z) => s.belly.d(x, y, z), 0.3]], bone: wts });
  m.part('head', s.head, { h: 0.056 * (far ? 2.8 : o.lod ? 2.1 : 1), mat: 'black', mask: [['white', (x, y, z) => s.cheek.d(x, y, z)]], bone: 'head' });
  m.part('eye', s.eye, { h: 0.03 * k2, mat: 'eye', copies: both2('head').map((c) => ({ ...c, bone: 'head' })), ao: false });
  if (!far) m.part('ring', s.ring, { h: 0.024 * k2, mat: 'ring', copies: both2('head').map((c) => ({ ...c, bone: 'head' })) });
  const tip = (x, y, z) => 1.36 - (z - HC[2]);                                               // くちばしの先のほうが負 → 白っぽい色へ
  m.part('beakU', s.beakU, { h: 0.042 * kb, mat: 'beakA', mask: [['beakB', tip, 0.3], ['mouth', (x, y, z) => s.gape(x, y, z) - 0.006]], bone: 'head' });
  m.part('beakL', s.beakL, { h: 0.042 * kb, mat: 'beakA', mask: [['beakB', tip, 0.3], ['mouth', (x, y, z) => -s.gape(x, y, z) - 0.016]], bone: 'jaw' });
  if (!o.lod) { m.part('mouth', s.mouth, { h: 0.05, mat: 'mouth', bone: 'head', ao: false, cast: false }); m.part('tongue', s.tongue, { h: 0.03, mat: 'tongue', bone: 'jaw', ao: false, cast: false }); }
  m.part('fist', s.fist, { h: 0.04 * k2, mat: 'hand', copies: both2('hand') });
  m.part('shank', s.shank, { h: 0.035 * k2, mat: 'leg', copies: both2('shin') });
  m.part('foot', s.foot, { h: 0.037 * k2, mat: 'leg', copies: both2('foot') });
  if (!far) m.part('claws', s.claws, { h: 0.02 * k2, mat: 'claw', copies: both2('foot') });
  if (!o.bare && !far) {
    m.part('straps', s.straps, { h: 0.075 * kb, mat: 'strap', bone: wts });
    m.part('emblem', s.emblem, { h: 0.025 * k2, mat: 'gold', bone: 'chest' });
    if (!o.lod) m.part('emblemMark', s.emblemMark, { h: 0.02, mat: 'red', bone: 'chest', ao: false });
  }
  // 尾羽（黒。うしろ下へ、扇に広がる）
  const tailCopies = [];
  for (const a of [-42, -25, -8, 8, 25, 42]) { const r = a * Math.PI / 180, dir = [Math.sin(r) * 0.62, -0.72, -0.64 - 0.05 * Math.cos(r)], nor = V.norm([Math.sin(r) * 0.3, 0.55, -0.8]); tailCopies.push({ R: featherR(dir, nor), t: V.add(J.tail, [Math.sin(r) * 0.12, 0.05, -0.08 - 0.012 * Math.abs(a) / 8]), bone: 'tail' }); }
  m.part('tailf', feather(1.5, 0.3), { h: far ? 0.05 : 0.036 * k2, mat: 'tail', copies: tailCopies, ao: false });
  // 腕の風切り羽（前腕のうしろへ、ひじから手首へ並ぶ）
  const wingCopies = [], fa = V.norm(V.sub(J.W, J.E));
  for (let i = 0; i < 6; i++) {
    const u = 0.02 + i * 0.17, p = V.add(V.lerp(J.E, J.W, u), [0.07, 0.02, -0.14]), dir = V.norm([0.42 - 0.05 * i, -0.5 - 0.07 * i, -0.76]), nor = V.norm(V.cross(fa, dir));
    const c = { R: featherR(dir, nor), t: p, bone: 'foreR' }; wingCopies.push(c, mirrored(c, 'foreL'));
  }
  if (!far) m.part('wingf', feather(1.2, 0.36), { h: 0.034 * k2, mat: 'wingf', copies: wingCopies, ao: false, cast: false });
  return m;
}
