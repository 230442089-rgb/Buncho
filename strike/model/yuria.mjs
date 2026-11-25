// yuria.mjs — ユリア（戦闘形態）の 3D モデル。いただいた絵の体つきに合わせた、およそ 7 頭身の人型。
//   白い髪と黄色い毛先（うしろは足もとまで、本人の左にサイドテール）、黄色い角の髪飾り、「#」の髪留め、
//   白い体の装甲（わきと胸の下は黒）、肩を出した大きな白い袖（黒いそで口）、白い手袋（指は 5 本）、腰の留め具と黄色い刃、
//   ひざから下の白・黄・黒のブーツ、機械の翼（黒い軸に水色の輪・白い羽・黄色い光の膜）、長い槍（本人の右手）。
//   顔（目・眉・口・ほお）は絵を貼る（描くのは strike/src/cast.js）。頭の形は、あご・鼻・目のくぼみまで作る。
//   座標: +y が上、+z が正面、+x が本人の右。頭の半径がおよそ 1、足の裏が y = 0、頭のてっぺんが y ≒ 14（身長 14 = 7 頭身）。
import { sphere, ellipsoid, rcone, rbox, torus, cyl, cone, plate, union, blend, cut, both, grow, move, mirror, tube, ribbon, euler, look, rotX, rotZ, mul3, V, I3, surfaceAlong, gradient, patch, bladeR } from './sdf.mjs';
import { Model, mirrored } from './pack.mjs';
import { autoWeights, bothSides } from './rig.mjs';

const { sin, cos, abs, min, max, PI, hypot } = Math, D2R = PI / 180;
export const YHC = [0, 13.0, 0];
const HY = YHC[1], H = (x, y, z) => [x, HY + y, z];
const sstep = (a, b, x) => { const t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 関節（腕は 30° ひらいた姿勢で作る）
export const YJ = {
  pelvis: [0, 7.6, 0], spine: [0, 8.75, 0], chest: [0, 9.95, 0], neck: [0, 11.7, -0.08], head: [0, 12.2, 0],
  S: [1.32, 11.38, -0.08], E: [2.5, 9.3, -0.12], W: [3.58, 7.38, 0.0],
  hip: [0.74, 7.5, 0], knee: [0.66, 3.75, 0.06], ankle: [0.62, 0.8, -0.1],
  hub: [1.44, 8.02, 0.12], wing: [2.35, 11.7, -1.75],
  hair1: H(0, 0.0, -0.9), hair2: H(0, -3.4, -1.05), hair3: H(0, -7.0, -1.0),
  tail1: H(-0.8, 0.72, -0.3), tail2: H(-2.2, -1.6, -0.6), lock: H(0.82, 0.3, 0.4),
};
const dF = V.norm(V.sub(YJ.W, YJ.E)), dU = V.norm(V.sub(YJ.E, YJ.S));         // 前腕・上腕の向き
export const GRIP = V.add(YJ.W, dF, 0.62);                                     // 右手のにぎりの中心（槍の軸が通る）
export const LANCE = { z0: -7.4, z1: 13.0 };                                   // 槍の石突きと穂先（にぎりからの前後の位置）
// 翼の羽（軸からの向き（度。0 = 真横の外、90 = 真上）と、長さ）
export const BLADES = [[100, 5.2], [74, 6.6], [48, 6.9], [22, 5.9], [-4, 4.4]];

// 翼の光の膜: 羽と羽のあいだに張る、厚みのない面（外のふちは弓なりにへこむ）
function membMesh() {
  const pos = [], nor = [], quads = [], NU = 8, NV = 6, wc = YJ.wing;
  BLADES.slice(0, -1).forEach(([a0, L0], i) => {
    const [a1, L1] = BLADES[i + 1], base = pos.length / 3;
    for (let v = 0; v <= NV; v++) for (let u = 0; u <= NU; u++) {
      const fu = u / NU, fv = v / NV, a = (a0 + (a1 - a0) * fu) * D2R, Ro = (L0 + (L1 - L0) * fu) * 0.88 * (1 - 0.24 * sin(PI * fu)), r = 0.95 + (Ro - 0.95) * fv;
      pos.push(wc[0] + cos(a) * r, wc[1] + sin(a) * r, wc[2]); nor.push(0, 0, 1);
    }
    for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) { const q = base + v * (NU + 1) + u; quads.push(q, q + 1, q + NU + 2, q + NU + 1); }
  });
  return { raw: { pos: new Float32Array(pos), nor: new Float32Array(nor), quads: new Uint32Array(quads) } };
}
// 角ばった小さな箱（髪留め）。網目を直接作る。list: [{ c: 中心, R: 向き, h: [半分の大きさ] }]
function boxes(list) {
  const pos = [], nor = [], quads = [];
  for (const b of list) for (let ax = 0; ax < 3; ax++) for (const sg of [-1, 1]) {
    const u = (ax + 1) % 3, v = (ax + 2) % 3, base = pos.length / 3, n = [0, 0, 0]; n[ax] = sg;
    const wn = [0, 1, 2].map((i) => b.R[i][0] * n[0] + b.R[i][1] * n[1] + b.R[i][2] * n[2]);
    for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const l = [0, 0, 0]; l[ax] = sg * b.h[ax]; l[u] = a * b.h[u]; l[v] = c * b.h[v];
      for (let i = 0; i < 3; i++) pos.push(b.c[i] + b.R[i][0] * l[0] + b.R[i][1] * l[1] + b.R[i][2] * l[2]);
      nor.push(...wn);
    }
    if (sg > 0) quads.push(base, base + 1, base + 2, base + 3); else quads.push(base, base + 3, base + 2, base + 1);
  }
  return { raw: { pos: new Float32Array(pos), nor: new Float32Array(nor), quads: new Uint32Array(quads) } };
}

function shapes() {
  // ---- 頭: たまご形の頭に、ほお・細いあご・小さな鼻・くちびるのふくらみ。目のところは浅くくぼませる。耳
  const skull = blend(0.3, ellipsoid(H(0, 0.1, -0.04), [0.9, 0.92, 0.95]), mirror(sphere(H(0.36, -0.38, 0.3), 0.44)), sphere(H(0, -0.68, 0.36), 0.3));
  const face0 = blend(0.08, skull, sphere(H(0, -0.3, 0.9), 0.045));                // 鼻は、先がほんの少し出るだけ
  const head = blend(0.05, face0, mirror(ellipsoid(H(0.88, -0.14, -0.06), [0.08, 0.22, 0.14], euler(0, -22, -8))));
  // ---- 髪。頭をおおう面（顔のところをくりぬく）に、前髪の束を重ねる
  const hp = (az, el, r, rad) => [0.9 * r * cos(el * D2R) * sin(az * D2R), HY + 0.1 + 0.92 * r * sin(el * D2R), -0.04 + 0.95 * r * cos(el * D2R) * cos(az * D2R), rad];
  const radial = (az, el) => [cos(el * D2R) * sin(az * D2R), sin(el * D2R), cos(el * D2R) * cos(az * D2R)];
  const bang = (az, az2, els, rads, r = 1.14) => ribbon(els.map((el, i) => hp(az + (az2 - az) * i / (els.length - 1), el, i === 0 ? 1.08 : r + 0.012 * i, rads[i])), radial((az + az2) / 2, 26), 0.42, 14);
  const capS = cut(ellipsoid(H(0, 0.18, -0.1), [1.0, 1.02, 1.1]), ellipsoid(H(0, -0.5, 0.98), [0.84, 1.1, 0.9]), 0.05);
  const RB = [0.17, 0.21, 0.17, 0.1, 0.035], RT = [0.13, 0.16, 0.13, 0.08, 0.03];
  const bangs = [
    bang(4, -7, [80, 50, 22, -2, -24], RB),                                    // まんなか（目のあいだへ）
    bang(-9, -3, [80, 52, 26, 8, -6], RT, 1.17),
    bang(17, 22, [78, 48, 26, 12, 3], RB),                                     // 本人の右（まゆの上まで）
    bang(30, 40, [74, 46, 24, 10, 1], RB, 1.16),
    bang(11, 13, [80, 54, 32, 17, 8], RT, 1.18),
    bang(-19, -15, [78, 48, 27, 13, 4], RB),                                   // 本人の左
    bang(-31, -27, [74, 46, 25, 11, 2], RB, 1.16),
    bang(-25, -22, [80, 54, 33, 18, 9], RT, 1.18),
    bang(47, 60, [68, 40, 14, -10, -34], RB, 1.13),                            // 右の外（顔のわきへ長く）
    bang(60, 70, [62, 36, 8, -20, -46], RT, 1.11),
    bang(-46, -58, [68, 40, 15, -9, -32], RB, 1.13),
    bang(-60, -69, [62, 36, 9, -19, -44], RT, 1.11),
    bang(40, 47, [72, 46, 22, 4, -14], RT, 1.17),
    bang(-39, -44, [72, 46, 23, 5, -12], RT, 1.17),
  ];
  const ahoge = tube([[0.04, HY + 1.08, 0.12, 0.08], [0.2, HY + 1.4, 0.2, 0.07], [0.1, HY + 1.62, 0.3, 0.045], [-0.14, HY + 1.6, 0.36, 0.012]], 10);
  const tufts = union(ribbon([[0.45, HY + 0.98, -0.3, 0.2], [0.8, HY + 1.1, -0.5, 0.15], [1.08, HY + 1.02, -0.62, 0.012]], [0, 1, 0.3], 0.5, 8), ribbon([[-0.3, HY + 1.06, -0.45, 0.2], [-0.4, HY + 1.26, -0.75, 0.14], [-0.38, HY + 1.28, -1.02, 0.012]], [0, 1, 0.5], 0.5, 8));
  const hair = blend(0.022, capS, ...bangs, ahoge, tufts);
  // 顔のわきの長い束（胸の下まで）。本人の右に作って、左へも写す
  const sideLock = ribbon([[0.84, HY + 0.3, 0.36, 0.15], [0.96, HY - 0.5, 0.5, 0.17], [1.0, HY - 1.6, 0.62, 0.15], [0.96, HY - 2.8, 0.78, 0.12], [0.9, HY - 3.9, 0.82, 0.012]], [1, 0, 0.3], 0.5, 12);
  // うしろ髪: 太い束を重ねて、ふくらはぎまで。先はばらばらの長さでとがる
  const bl = (P) => ribbon(P.map((p) => [p[0], HY + p[1], p[2], p[3]]), [0, 0, 1], 0.5, 18);
  const backHair = blend(0.05,
    bl([[0, 0.0, -0.98, 0.42], [0, -1.6, -1.12, 0.5], [0, -3.8, -1.16, 0.52], [0, -5.6, -1.62, 0.5], [0, -7.4, -1.42, 0.44], [0.04, -9.4, -1.12, 0.24], [0.08, -10.9, -1.0, 0.012]]),
    bl([[0.4, 0.0, -0.9, 0.38], [0.56, -1.6, -1.04, 0.44], [0.7, -3.8, -1.1, 0.46], [0.8, -5.6, -1.58, 0.44], [0.9, -7.2, -1.38, 0.38], [1.02, -8.9, -1.1, 0.2], [1.14, -10.2, -0.98, 0.012]]),
    bl([[-0.4, 0.0, -0.9, 0.38], [-0.56, -1.6, -1.04, 0.44], [-0.68, -3.8, -1.1, 0.46], [-0.78, -5.6, -1.58, 0.44], [-0.86, -7.4, -1.38, 0.38], [-0.94, -9.3, -1.1, 0.2], [-1.0, -10.6, -0.98, 0.012]]),
    bl([[0.72, -0.1, -0.6, 0.32], [1.0, -1.5, -0.82, 0.38], [1.26, -3.6, -0.92, 0.4], [1.5, -5.6, -1.3, 0.36], [1.66, -7.0, -1.12, 0.28], [1.8, -8.3, -0.92, 0.15], [1.94, -9.2, -0.84, 0.012]]),
    bl([[-0.72, -0.1, -0.6, 0.32], [-0.98, -1.5, -0.82, 0.37], [-1.2, -3.5, -0.92, 0.38], [-1.42, -5.5, -1.28, 0.34], [-1.56, -6.8, -1.1, 0.26], [-1.66, -7.9, -0.92, 0.14], [-1.76, -8.7, -0.84, 0.012]]),
    bl([[0.2, -0.4, -1.08, 0.24], [0.28, -2.2, -1.22, 0.28], [0.34, -4.2, -1.3, 0.28], [0.4, -5.8, -1.74, 0.26], [0.46, -7.8, -1.46, 0.2], [0.54, -9.6, -1.14, 0.012]]),
    bl([[-0.22, -0.4, -1.08, 0.24], [-0.3, -2.4, -1.22, 0.28], [-0.36, -4.4, -1.32, 0.28], [-0.4, -6.0, -1.74, 0.26], [-0.44, -8.2, -1.44, 0.2], [-0.5, -10.3, -1.12, 0.012]]),
    bl([[0.9, -0.3, -0.3, 0.26], [1.2, -1.4, -0.48, 0.3], [1.5, -3.2, -0.6, 0.3], [1.78, -5.0, -0.8, 0.22], [2.0, -6.6, -0.7, 0.012]]),
    bl([[-0.62, -0.4, -1.0, 0.22], [-0.8, -2.2, -1.14, 0.26], [-0.96, -4.2, -1.2, 0.26], [-1.1, -5.9, -1.6, 0.22], [-1.2, -7.4, -1.34, 0.16], [-1.3, -8.6, -1.1, 0.012]]));
  // サイドテール（本人の左）: 結び目から外へふくらんで、腰の下まで
  const tl = (P, fl = [0.5, 0, 1]) => ribbon(P.map((p) => [p[0], HY + p[1], p[2], p[3]]), fl, 0.62, 16);
  const sideTail = blend(0.08,
    tl([[-0.8, 0.72, -0.3, 0.2], [-1.4, 0.95, -0.46, 0.3], [-1.95, 0.5, -0.56, 0.38], [-2.25, -0.8, -0.6, 0.4], [-2.3, -2.6, -0.58, 0.36], [-2.2, -4.4, -0.52, 0.26], [-2.05, -5.9, -0.46, 0.012]]),
    tl([[-1.3, 0.85, -0.42, 0.2], [-1.75, 0.3, -0.34, 0.27], [-1.9, -1.0, -0.3, 0.28], [-1.86, -2.6, -0.26, 0.22], [-1.72, -4.0, -0.22, 0.14], [-1.6, -4.9, -0.2, 0.012]]),
    tl([[-1.55, 0.8, -0.54, 0.2], [-2.15, 0.55, -0.72, 0.25], [-2.6, -0.5, -0.78, 0.25], [-2.74, -2.0, -0.76, 0.2], [-2.72, -3.4, -0.7, 0.12], [-2.66, -4.3, -0.66, 0.012]]));
  // ---- 髪飾り: 結び目の黒い輪（水色に光る輪つき）と、黄色い角 3 本。「#」の髪留め 2 つ
  const hubP = YJ.tail1, hubN = V.norm([-0.8, 0.42, -0.25]);
  const hubS = cyl(V.add(hubP, hubN, -0.06), V.add(hubP, hubN, 0.13), 0.3, 0.04);
  const hubRing = torus(V.add(hubP, hubN, 0.13), hubN, 0.17, 0.035);
  const hubCap = cyl(V.add(hubP, hubN, 0.1), V.add(hubP, hubN, 0.17), 0.085, 0.02);
  const hornPts = (L, w) => [[-0.42 * w, 0], [-0.52 * w, 0.26 * L], [-0.06 * w, L], [0.5 * w, 0.2 * L], [0.3 * w, 0]];
  const horn = (base, dir, nor, L, w) => plate(base, bladeR(dir, nor), hornPts(L, w), 0.06, { edge: w * 0.45, round: 0.008, thin: 0.42 });
  const hornR0 = H(0.72, 0.78, 0.02);
  const horns = union(horn(V.add(hubP, [-0.02, 0.2, 0.0]), [-0.16, 1, -0.14], [0.3, 0.1, 1], 1.45, 0.36), horn(V.add(hubP, [-0.2, 0.12, -0.04]), [-0.78, 0.6, -0.22], [0.25, 0.2, 1], 1.05, 0.3), horn(hornR0, [0.4, 1, -0.22], [-0.25, 0.1, 1], 1.35, 0.34));
  const hornBase = blend(0.03, sphere(V.add(hornR0, [0.0, 0.02, 0]), 0.15), cyl(V.add(hornR0, [-0.02, -0.08, 0.1]), V.add(hornR0, [0.02, 0.08, 0.16]), 0.1, 0.02));
  const hornDot = sphere(V.add(hornR0, [0.0, 0.02, 0.15]), 0.055);
  const pin = (dir) => {
    const p = surfaceAlong(hair, YHC, V.norm(dir), 0.6, 2.2), n = gradient(hair, p), R = mul3(look(n), rotZ(0.3)), q = V.add(p, n, 0.016);
    const bar = (dx, dy, hx, hy) => ({ c: V.add(q, [R[0][0] * dx + R[0][1] * dy, R[1][0] * dx + R[1][1] * dy, R[2][0] * dx + R[2][1] * dy]), R, h: [hx, hy, 0.026] });
    return [bar(0, 0.05, 0.15, 0.022), bar(0, -0.05, 0.15, 0.022), bar(0.05, 0, 0.022, 0.15), bar(-0.05, 0, 0.022, 0.15)];
  };
  const pins = boxes([...pin([0.5, 0.56, 0.7]), ...pin([-0.46, 0.8, 0.46])]);

  // ---- 体。胸郭・くびれ・骨盤・おしり・胸をなめらかにつなぎ、首と肩、腕、ももを付ける
  const { S, E, W, hip, knee, ankle } = YJ;
  const core = blend(0.42, ellipsoid([0, 10.5, -0.1], [1.1, 1.3, 0.78]), ellipsoid([0, 11.12, -0.14], [1.24, 0.46, 0.6]), ellipsoid([0, 9.05, 0], [0.82, 0.98, 0.6]), ellipsoid([0, 8.35, 0.1], [0.95, 0.75, 0.62]), ellipsoid([0, 7.7, -0.05], [1.34, 0.98, 0.9]));
  const trunk0 = blend(0.26, core, mirror(sphere([0.62, 7.42, -0.5], 0.8)), rcone([0, 11.2, -0.12], [0, 12.4, 0.0], 0.43, 0.38), mirror(rcone([0.3, 11.72, -0.22], [1.08, 11.44, -0.14], 0.28, 0.25)));
  // 胸: 鎖骨の下からなだらかに下り、下のほうでふくらむ。左右は服の下でつながる（球を 2 つ貼った形にしない）
  const slope = mirror(ellipsoid([0.5, 10.62, 0.36], [0.6, 0.86, 0.46], euler(-20, 8, 0)));
  const full = mirror(ellipsoid([0.54, 10.16, 0.52], [0.54, 0.47, 0.5], euler(-8, 10, 0)));
  const bridge = ellipsoid([0, 10.24, 0.4], [0.52, 0.42, 0.3]);
  const trunk = blend(0.2, blend(0.5, trunk0, slope, bridge), full);
  const arm = blend(0.1, ellipsoid(V.add(S, [0.06, -0.12, 0]), [0.42, 0.5, 0.42]), rcone(S, E, 0.36, 0.28), sphere(E, 0.285), rcone(E, W, 0.29, 0.19), ellipsoid(V.add(V.lerp(E, W, 0.25), [0.02, 0, 0.02]), [0.3, 0.3, 0.6], look(dF)));
  const thigh = blend(0.2, rcone(hip, knee, 0.8, 0.47), ellipsoid(V.add(V.lerp(hip, knee, 0.3), [0.05, 0, 0.08]), [0.76, 1.35, 0.8]), sphere(knee, 0.47), rcone(knee, V.add(knee, [0, -0.9, -0.03]), 0.44, 0.4));
  const body = blend(0.16, trunk, mirror(arm), mirror(thigh));
  // 体の装甲（白）の範囲と、その中の黒い面。場が負の側がその色
  //   えり → 胸の中央 → 胸・腹 → 脚ぐりは高く切れ上がる。肩と背中の上は出ている。腰には、留め具へのびる白い帯
  const suit0 = (x, y, z) => { const ax = abs(x), slope = 1.05 + 0.8 * sstep(-0.3, 0.3, z), top = 10.95 + 1.11 * sstep(0.74, 0.3, ax); return max(6.95 + slope * ax - y, y - top, ax - (1.0 + 0.5 * sstep(10.7, 9.9, y))); };
  const suitF = (x, y, z) => min(suit0(x, y, z), max(abs(y - (7.52 + 0.34 * abs(x))) - 0.1, abs(x) - 1.6, y - 8.3));
  const blackF = (x, y, z) => {
    const ax = abs(x), collar = max(11.78 - y, ax - 0.7), side = max(0.5 + 0.2 * sstep(8.9, 10.0, y) + 0.12 * sstep(8.9, 7.9, y) - ax, y - 10.02);
    const band = max(abs(y - (9.74 + 0.2 * ax)) - 0.1, -z), spine = max(ax - 0.07, z + 0.3, y - 11.7);
    return max(suit0(x, y, z), min(collar, side, band, spine));
  };
  // 胸もとの水色の石、胸の下と腹の黄色い山形
  const gemP = surfaceAlong(trunk, [0, 11.35, 0], [0, 0, 1], 0.02, 2.5);
  const gem = plate(V.add(gemP, [0, 0, 0.0]), rotX(-0.2), [[0, 0.2], [0.13, 0], [0, -0.2], [-0.13, 0]], 0.05, { edge: 0.12, round: 0.008, thin: 0.4 });
  const chev = union(
    patch(trunk, { bb: [-0.6, 9.0, 0, 0.6, 10.2, 2], d: (x, y, z) => max(abs(y - (9.4 + 0.55 * abs(x))) - 0.06, abs(x) - 0.4, -z) }, 0.03, 0.008),
    patch(trunk, { bb: [-0.5, 7.9, 0, 0.5, 8.9, 2], d: (x, y, z) => max(abs(y - (8.2 + 0.6 * abs(x))) - 0.05, abs(x) - 0.3, -z) }, 0.03, 0.008));
  // ---- 袖（上腕のなかほどから手首の先まで、手首へ向かって大きくふくらむ。先は黒いそで口で、中が空いている）
  const cuffB = V.add(W, dF, 0.5), sp = (a, b, k) => V.lerp(a, b, k);
  const slv0 = tube([[...sp(S, E, 0.42), 0.46], [...sp(S, E, 0.7), 0.6], [...E, 0.74], [...sp(E, W, 0.45), 0.88], [...W, 0.95], [...cuffB, 0.97], [...V.add(cuffB, dF, 0.5), 0.97]], 18);
  const kB = V.dot(dF, cuffB);
  const sleeve = cut(both(blend(0.1, slv0, torus(sp(S, E, 0.46), dU, 0.44, 0.17)), { bb: slv0.bb, d: (x, y, z) => x * dF[0] + y * dF[1] + z * dF[2] - kB }, 0.03), cyl(V.add(cuffB, dF, -0.62), V.add(cuffB, dF, 0.6), 0.78), 0.03);
  const cuffRing = union(torus(V.add(cuffB, dF, -0.04), dF, 0.92, 0.085), torus(V.add(W, dF, -0.2), dF, 0.97, 0.05));
  const sleeveTop = (x, y, z) => { const q = sp(S, E, 0.6); return (x - q[0]) * dU[0] + (y - q[1]) * dU[1] + (z - q[2]) * dU[2]; };          // 肩に近い側が負 → 黄色
  const sleeveCuff = (x, y, z) => { const q = V.add(W, dF, -0.2); return -((x - q[0]) * dF[0] + (y - q[1]) * dF[1] + (z - q[2]) * dF[2]); };    // 手首より先が負 → 黒
  // ---- 手（白い手袋。指は 5 本）。右は槍をにぎり、左はひらいている
  const G = GRIP;
  const wrap = (k) => tube([[G[0] - 0.05, G[1] + 0.3, G[2] + k, 0.105], [G[0] + 0.24, G[1] + 0.24, G[2] + k, 0.1], [G[0] + 0.34, G[1] - 0.02, G[2] + k, 0.095], [G[0] + 0.2, G[1] - 0.27, G[2] + k, 0.09], [G[0] - 0.04, G[1] - 0.24, G[2] + k, 0.085]], 8);
  const fist = blend(0.05, ellipsoid(V.add(G, [-0.12, 0.06, 0]), [0.26, 0.34, 0.42]), rcone(W, V.add(W, dF, 0.34), 0.2, 0.25),
    union([-0.29, -0.1, 0.09, 0.28].map(wrap)), tube([[G[0] - 0.2, G[1] + 0.26, G[2] + 0.3, 0.11], [G[0] + 0.02, G[1] + 0.36, G[2] + 0.1, 0.1], [G[0] + 0.2, G[1] + 0.3, G[2] - 0.14, 0.09]], 6));
  const finger = (x, l, sp2 = 0) => tube([[x, 0.3, 0, 0.098], [x * 1.12 + sp2 * 0.4, 0.3 + l * 0.5, 0.03, 0.09], [x * 1.2 + sp2, 0.3 + l, 0.1, 0.075]], 6);
  const palm0 = blend(0.045, ellipsoid([0, 0.02, 0], [0.33, 0.4, 0.14]), rcone([0, -0.62, 0], [0, -0.28, 0], 0.2, 0.25),
    union(finger(-0.24, 0.6, -0.06), finger(-0.08, 0.74), finger(0.08, 0.7), finger(0.235, 0.54, 0.05)), tube([[0.26, -0.2, 0.04, 0.115], [0.47, 0.05, 0.1, 0.1], [0.56, 0.34, 0.16, 0.08]], 6));
  const hx = V.norm(V.sub([0, 0, 1], V.mul(dF, dF[2]))), hz = V.cross(hx, dF);
  const openHand = move(palm0, { R: [[hx[0], dF[0], hz[0]], [hx[1], dF[1], hz[1]], [hx[2], dF[2], hz[2]]], t: V.add(W, dF, 0.66) });
  // ---- 腰: 黒い輪の留め具と、そこから下がる黄色い刃
  const hub = YJ.hub;
  const hipHub = cyl(V.add(hub, [-0.12, 0, 0]), V.add(hub, [0.16, 0, 0]), 0.36, 0.05);
  const hipDot = cyl(V.add(hub, [0.1, 0, 0]), V.add(hub, [0.22, 0, 0]), 0.17, 0.03);
  const hipBlade = plate([0, 0, 0], I3, [[-0.12, -0.04], [-0.2, 0.3], [-0.05, 1.0], [0.2, 0.4], [0.14, -0.04]], 0.055, { edge: 0.16, round: 0.008, thin: 0.42 });
  // ---- ブーツ（本人の右。ひざの上から）。すねの装甲・上へとがるひざ当て・黒い関節。足は つま先が前へとがり、かかとは高い
  const shinT = blend(0.2, rcone([0.66, 4.3, 0.05], [0.64, 2.9, -0.06], 0.53, 0.56), rcone([0.64, 2.9, -0.06], [0.62, 1.1, -0.1], 0.56, 0.4), ellipsoid([0.64, 2.9, -0.3], [0.44, 0.9, 0.42]));
  const bootU = blend(0.07, shinT,
    blend(0.08, ellipsoid([0.66, 4.0, 0.5], [0.42, 0.6, 0.2]), cone([0.66, 4.3, 0.56], [0.66, 5.35, 0.44], 0.28, 0.03, 0.02)), cyl([0.63, 1.0, -0.1], [0.62, 1.34, -0.1], 0.5, 0.06));
  const bootF = blend(0.1, sphere(ankle, 0.4), rcone([0.62, 0.72, 0.05], [0.62, 0.3, 1.05], 0.44, 0.27), cone([0.62, 0.3, 0.9], [0.62, 0.1, 2.0], 0.29, 0.04, 0.02), rcone([0.62, 0.66, -0.34], [0.62, 0.1, -0.66], 0.3, 0.1));
  const bootYel = (x, y, z) => min(max(abs((y - 3.0) + 0.9 * abs(x - 0.66)) - 0.11, -z), max(abs((y - 2.4) + 0.9 * abs(x - 0.66)) - 0.08, -z), hypot(x - 0.66, y - 3.95, (z - 0.74) * 0.8) - 0.2);
  const bootBlk = (x, y, z) => min(abs(y - 1.17) - 0.17, 4.18 - y + 2.0 * max(0, z - 0.25), max(z + 0.34, abs(x - 0.65) - 0.4, y - 3.6));
  const footBlk = (x, y, z) => min(hypot(x - ankle[0], y - ankle[1], z - ankle[2]) - 0.43, y - 0.2 + 0.2 * max(0, z - 0.6), z + 0.36 - 0.25 * (y - 0.2));
  const shinBlade = plate([0.66, 3.5, 0.6], bladeR([0, -1, 0.06], [1, 0, 0]), [[-0.1, -0.2], [0.04, 0.5], [0.04, 1.4], [0.2, 1.9], [0.36, 1.1], [0.34, 0.0]], 0.07, { edge: 0.2, round: 0.01, thin: 0.42 });
  const calfFin = plate([0, 0, 0], I3, [[-0.1, 0], [-0.15, 0.3], [0, 0.85], [0.13, 0.25], [0.08, 0]], 0.05, { edge: 0.12, round: 0.008, thin: 0.42 });
  const bootLight = union(patch(shinT, rbox([1.18, 2.9, 0.02], [0.2, 0.5, 0.06], 0.03), 0.02, 0.006), patch(bootF, rbox([0.62, 0.62, 0.62], [0.06, 0.4, 0.42], 0.03), 0.02, 0.006));
  // ---- 翼。黒い軸に水色の輪、そこから白い羽を扇のように。羽のあいだに黄色い光の膜
  const wc = YJ.wing;
  const wHub = blend(0.05, cyl(V.add(wc, [0, 0, -0.2]), V.add(wc, [0, 0, 0.2]), 0.66, 0.08), cyl(V.add(wc, [0, 0, -0.3]), V.add(wc, [0, 0, 0.3]), 0.28, 0.06));
  const wRing = union(torus(V.add(wc, [0, 0, 0.2]), [0, 0, 1], 0.44, 0.07), torus(V.add(wc, [0, 0, -0.2]), [0, 0, 1], 0.44, 0.07));
  const wArm = tube([[...wc, 0.15], [1.7, 11.4, -1.25, 0.13], [0.95, 10.95, -0.78, 0.12]], 8);                  // 背中とつなぐ細い腕
  const blade = plate([0, 0, 0], I3, [[-0.1, 0.24], [-0.25, 0.56], [-0.2, 0.8], [-0.05, 1.0], [0.16, 0.74], [0.27, 0.48], [0.12, 0.24]], 0.05, { edge: 0.13, round: 0.006, thin: 0.42 });
  const bladeLight = rbox([0.0, 0.5, 0], [0.018, 0.13, 0.056], 0.012);
  const memb = membMesh();
  // ---- 槍（にぎりの位置から、前へ穂先・うしろへ石突き）。柄は黒、穂は白・黄・黒の刃を十字に組む
  const lz = (z, dx = 0, dy = 0) => [G[0] + dx, G[1] + dy, G[2] + z];
  const shaft = union(cyl(lz(-6.3), lz(5.2), 0.115, 0.02), cyl(lz(-1.2), lz(-0.86), 0.16, 0.03), cyl(lz(0.86), lz(1.2), 0.16, 0.03), cyl(lz(4.3), lz(5.3), 0.22, 0.04), cyl(lz(-6.5), lz(-5.9), 0.2, 0.04), cyl(lz(2.4), lz(2.6), 0.15, 0.03));
  const PY = bladeR([0, 0, 1], [1, 0, 0]), PX = bladeR([0, 0, 1], [0, -1, 0]);     // 板を立てる向き（面が左右を向く）・ねかせる向き（面が上下を向く）
  const lanceMain = plate(lz(0), PY, [[0, 4.9], [0.46, 5.25], [1.0, 6.6], [0.7, 9.8], [0, 13.0], [-0.7, 9.8], [-1.0, 6.6], [-0.46, 5.25]], 0.17, { edge: 0.68, round: 0.016, thin: 0.36 });
  const lanceCross = plate(lz(0), PX, [[0, 5.25], [0.55, 6.3], [0.36, 8.9], [0, 11.2], [-0.36, 8.9], [-0.55, 6.3]], 0.13, { edge: 0.4, round: 0.016, thin: 0.42 });
  const guardPts = [[0.22, 4.45], [1.42, 3.55], [1.7, 2.3], [1.15, 3.42], [0.7, 5.25], [0.22, 5.4]];
  const guard = union(plate(lz(0), PY, guardPts, 0.11, { edge: 0.22, round: 0.016, thin: 0.42 }), plate(lz(0), PY, guardPts.map(([a, b]) => [-a, b]).reverse(), 0.11, { edge: 0.22, round: 0.016, thin: 0.42 }),
    plate(lz(0), PX, guardPts.map(([a, b]) => [a * 0.62, b]), 0.1, { edge: 0.18, round: 0.016, thin: 0.45 }), plate(lz(0), PX, guardPts.map(([a, b]) => [-a * 0.62, b]).reverse(), 0.1, { edge: 0.18, round: 0.016, thin: 0.45 }));
  const buttPts = [[0.1, -6.1], [0.68, -6.45], [0.46, -7.6], [0.27, -6.8], [0.1, -6.7]];
  const butt = union(plate(lz(0), PY, [[0.16, -6.2], [0, -7.8], [-0.16, -6.2]], 0.1, { edge: 0.13, round: 0.012, thin: 0.45 }),
    plate(lz(0), PY, buttPts, 0.1, { edge: 0.15, round: 0.012, thin: 0.45 }), plate(lz(0), PY, buttPts.map(([a, b]) => [-a, b]).reverse(), 0.1, { edge: 0.15, round: 0.012, thin: 0.45 }));
  const lanceLight = union(rbox(lz(7.5, 0.0, 0), [0.185, 0.06, 1.7], 0.03), rbox(lz(6.8, 0, 0), [0.06, 0.15, 1.1], 0.03));
  return { head, hair, sideLock, backHair, sideTail, hubS, hubRing, hubCap, horns, hornBase, hornDot, pins, body, trunk, suitF, blackF, gem, chev, sleeve, cuffRing, sleeveTop, sleeveCuff, fist, openHand,
    hipHub, hipDot, hipBlade, bootU, bootF, bootYel, bootBlk, footBlk, shinBlade, calfFin, bootLight, wHub, wRing, wArm, blade, bladeLight, memb, shaft, lanceMain, lanceCross, guard, butt, lanceLight };
}

// lod: 戦いのあいだの小さなうしろ姿に使う、粗い版（細かい灯は省く）
export function buildYuria(o = {}) {
  const PLATES = new Set(['horns', 'hipBlade', 'shinBlade', 'calfFin', 'blade', 'lanceMain', 'lanceCross', 'guard', 'butt']), SKIP = new Set(['chev', 'hipDot', 'hornDot', 'bladeLight', 'bootLight', 'hubCap']), KEEP = new Set(['wArm', 'gem', 'hubRing', 'wRing', 'cuffRing', 'lanceLight', 'hub', 'hornBase', 'shaft', 'fist', 'openHand']);
  const part = (name, shape, opt) => { if (o.lod) { if (SKIP.has(name)) return; if (opt.h && !KEEP.has(name)) opt.h *= PLATES.has(name) ? 1.6 : 2.3; } m.part(name, shape, opt); };
  const s = shapes(), m = new Model(o.lod ? 'yuria_lo' : 'yuria', { toon: 1, soft: 0.6, line: 0.0015, aoR: 0.5, height: 14.1, faceRect: [0, HY, 1 / 2.2, 0], grip: GRIP, lance: [LANCE.z0, LANCE.z1] });
  const mat = (n, d) => m.mat(n, d);
  mat('face', { col: '#ffe3d3', kind: 'face', spec: 0.1, gloss: 20, rim: 0.2, shade: '#f7bfb0' });
  mat('skin', { col: '#ffe3d3', kind: 'skin', spec: 0.14, gloss: 26, rim: 0.3, shade: '#f4b6a8' });
  mat('hair', { col: '#f5f3fc', kind: 'hair', spec: 0.55, gloss: 20, rim: 0.3, shade: '#c3bde2' });
  mat('hairTip', { col: '#ffd640', kind: 'hair', spec: 0.5, gloss: 20, rim: 0.3, shade: '#f4a322' });
  mat('suit', { col: '#f6f6fc', kind: 'gloss', spec: 0.6, gloss: 50, rim: 0.3, shade: '#c2c8e4' });
  mat('black', { col: '#25252f', kind: 'gloss', spec: 0.7, gloss: 50, rim: 0.4, shade: '#12121a' });
  mat('yellow', { col: '#ffd033', kind: 'gloss', spec: 0.7, gloss: 50, rim: 0.3, shade: '#ec9418' });
  mat('cloth', { col: '#f5f5fc', kind: 'cloth', spec: 0.1, gloss: 14, rim: 0.25, shade: '#c0c6e2' });
  mat('armor', { col: '#f8f8fe', kind: 'gloss', spec: 0.8, gloss: 60, rim: 0.3, shade: '#bdc4e0' });
  mat('cyan', { col: '#5cf4ec', kind: 'glow', emis: 1 });
  mat('pin', { col: '#2b2a33', kind: 'matte', spec: 0.1, gloss: 20, rim: 0.05, shade: '#15151c' });
  mat('film', { col: '#ffd94e', kind: 'film', emis: 0.75, rim: 0.3, shade: '#ffb21e' });
  // ---- 骨
  const J = YJ, mx = (p) => [-p[0], p[1], p[2]];
  m.bone('root', null, [0, 0, 0]);
  m.bone('pelvis', 'root', J.pelvis); m.bone('spine', 'pelvis', J.spine); m.bone('chest', 'spine', J.chest); m.bone('neck', 'chest', J.neck); m.bone('head', 'neck', J.head);
  m.bone('hair1', 'head', J.hair1); m.bone('hair2', 'hair1', J.hair2); m.bone('hair3', 'hair2', J.hair3); m.bone('tail1', 'head', J.tail1); m.bone('tail2', 'tail1', J.tail2);
  for (const [sd, f] of [['R', (p) => p], ['L', mx]]) {
    m.bone('lock' + sd, 'head', f(J.lock));
    m.bone('arm' + sd, 'chest', f(J.S)); m.bone('fore' + sd, 'arm' + sd, f(J.E)); m.bone('hand' + sd, 'fore' + sd, f(J.W));
    m.bone('thigh' + sd, 'pelvis', f(J.hip)); m.bone('shin' + sd, 'thigh' + sd, f(J.knee)); m.bone('foot' + sd, 'shin' + sd, f(J.ankle));
    m.bone('hip' + sd, 'pelvis', f(J.hub)); m.bone('wing' + sd, 'chest', f(J.wing));
    for (let i = 0; i < BLADES.length; i++) m.bone('wb' + i + sd, 'wing' + sd, f(J.wing));
  }
  m.bone('lance', 'handR', GRIP);
  const wts = autoWeights(bothSides([
    ['pelvis', [0, 7.2, 0], [0, 7.9, 0], 1.25], ['pelvis', [-0.7, 7.5, -0.3], [0.7, 7.5, -0.3], 0.9], ['spine', [0, 8.6, 0], [0, 9.3, 0], 0.95], ['chest', [0, 10.0, 0], [0, 11.0, 0], 1.2], ['chest', [-0.9, 11.2, 0], [0.9, 11.2, 0], 0.85],
    ['neck', [0, 11.8, -0.05], [0, 12.4, 0], 0.55], ['arm#', J.S, J.E, 0.6], ['fore#', J.E, J.W, 0.52], ['thigh#', J.hip, J.knee, 0.86], ['shin#', V.add(J.knee, [0, -0.35, 0]), V.add(J.knee, [0, -1.2, 0]), 0.6],
  ]), 6);
  const armW = autoWeights(bothSides([['arm#', J.S, J.E, 0.7], ['fore#', J.E, V.add(J.W, dF, 1.4), 0.7]]), 5);
  const hairW = autoWeights([['hair1', H(0, 0.4, -0.7), H(0, -3.0, -1.0), 2.2], ['hair2', H(0, -3.9, -1.05), H(0, -6.6, -1.0), 2.2], ['hair3', H(0, -7.5, -1.0), H(0, -11.0, -0.9), 2.2]], 5);
  const tailW = autoWeights([['tail1', J.tail1, H(-2.2, -1.0, -0.6), 1.3], ['tail2', H(-2.3, -2.2, -0.58), H(-2.1, -5.9, -0.46), 1.3]], 5);
  const both2 = (bone) => [{ bone: bone + 'R' }, { bone: bone + 'L', mirror: true }];
  const tipY = (y0, w) => [['hairTip', (x, y, z) => y - y0, w]];
  // ---- 部品: 頭と髪
  part('head', s.head, { h: 0.056, mat: 'face', bone: 'head' });
  part('hair', s.hair, { h: 0.052, mat: 'hair', bone: 'head' });
  part('sideLock', s.sideLock, { h: 0.045, mat: 'hair', mask: tipY(10.2, 1.0), copies: both2('lock') });
  part('backHair', s.backHair, { h: 0.125, mat: 'hair', mask: tipY(6.3, 2.6), bone: hairW });
  part('sideTail', s.sideTail, { h: 0.1, mat: 'hair', mask: tipY(9.4, 2.0), bone: tailW });
  part('hub', s.hubS, { h: 0.04, mat: 'black', bone: 'head' });
  part('hubRing', s.hubRing, { h: 0.022, mat: 'cyan', bone: 'head', ao: false, cast: false });
  part('hubCap', s.hubCap, { h: 0.025, mat: 'black', bone: 'head', ao: false });
  part('horns', s.horns, { h: 0.036, mat: 'yellow', bone: 'head', ao: false });
  part('hornBase', s.hornBase, { h: 0.03, mat: 'black', bone: 'head' });
  part('hornDot', s.hornDot, { h: 0.022, mat: 'cyan', bone: 'head', ao: false, cast: false });
  part('pins', s.pins, { mat: 'pin', bone: 'head' });
  // ---- 体・袖・手
  part('body', s.body, { h: 0.095, mat: 'skin', mask: [['suit', s.suitF], ['black', s.blackF]], bone: wts });
  part('gem', s.gem, { h: 0.03, mat: 'cyan', bone: 'chest', ao: false, cast: false });
  part('chev', s.chev, { h: 0.026, mat: 'yellow', bone: wts, cast: false, ao: false });
  part('sleeve', s.sleeve, { h: 0.1, mat: 'cloth', mask: [['yellow', s.sleeveTop], ['black', s.sleeveCuff]], bone: armW, copies: [{}, { mirror: true }] });
  part('cuffRing', s.cuffRing, { h: 0.08, mat: 'yellow', copies: both2('fore'), ao: false });
  part('fist', s.fist, { h: 0.05, mat: 'armor', bone: 'handR' });
  part('openHand', s.openHand, { h: 0.05, mat: 'armor', copies: [{ mirror: true, bone: 'handL' }] });
  // ---- 腰の留め具と刃
  part('hipHub', s.hipHub, { h: 0.05, mat: 'black', copies: both2('hip') });
  part('hipDot', s.hipDot, { h: 0.035, mat: 'yellow', copies: both2('hip'), ao: false });
  const hb = [];
  for (const [dir, nor, len, off] of [[[0.32, -1, 0.14], [1, 0.3, 0.1], 2.9, [0.22, -0.12, 0.05]], [[0.26, -1, -0.5], [1, 0.25, -0.35], 2.1, [0.18, -0.12, -0.24]], [[0.5, -1, 0.7], [0.8, 0.25, -0.5], 1.6, [0.16, -0.1, 0.3]]]) {
    const R = bladeR(dir, nor).map((r) => [r[0] * 2.2, r[1] * len, r[2] * 1.5]), c = { R, t: V.add(J.hub, off), bone: 'hipR' }; hb.push(c, mirrored(c, 'hipL'));
  }
  part('hipBlade', s.hipBlade, { h: 0.034, mat: 'yellow', mask: [['black', (x, y, z) => y - 0.13]], copies: hb, ao: false, cast: false });
  // ---- ブーツ
  part('bootU', s.bootU, { h: 0.08, mat: 'armor', mask: [['yellow', s.bootYel], ['black', s.bootBlk]], copies: both2('shin') });
  part('bootF', s.bootF, { h: 0.06, mat: 'armor', mask: [['yellow', (x, y, z) => 1.55 - z], ['black', s.footBlk]], copies: both2('foot') });
  part('shinBlade', s.shinBlade, { h: 0.05, mat: 'yellow', copies: both2('shin'), ao: false });
  const cf = [];
  for (const [dir, nor, len, p] of [[[0.5, 0.8, -0.5], [0.3, 0.2, 1], 2.5, [1.08, 2.7, -0.4]], [[0.62, 0.45, -0.7], [0.3, 0.3, 1], 1.9, [1.06, 2.05, -0.44]], [[0.3, 0.2, -0.9], [0.4, 1, 0.3], 1.3, [0.62, 0.95, -0.4]]]) {
    const R = bladeR(dir, nor).map((r) => [r[0] * 2.2, r[1] * len, r[2] * 1.5]), c = { R, t: p, bone: 'shinR' }; cf.push(c, mirrored(c, 'shinL'));
  }
  part('calfFin', s.calfFin, { h: 0.03, mat: 'armor', mask: [['yellow', (x, y, z) => 0.55 - y]], copies: cf, ao: false, cast: false });
  part('bootLight', s.bootLight, { h: 0.03, mat: 'cyan', copies: [{ bone: 'shinR' }, { bone: 'shinL', mirror: true }], ao: false, cast: false });
  // ---- 翼
  part('wHub', s.wHub, { h: 0.07, mat: 'black', copies: both2('wing') });
  part('wRing', s.wRing, { h: 0.05, mat: 'cyan', copies: both2('wing'), ao: false, cast: false });
  part('wArm', s.wArm, { h: 0.06, mat: 'black', copies: both2('wing'), ao: false, cast: false });
  const bc = [];
  BLADES.forEach(([a, L], i) => {
    const r = (a - 90) * D2R, R0 = rotZ(r), R = R0.map((row) => [row[0] * (1.5 + 0.12 * L), row[1] * L, row[2] * 1.8]), c = { R, t: [J.wing[0], J.wing[1], J.wing[2] + 0.07 * (i % 2 ? 1 : -1)], bone: 'wb' + i + 'R' };
    bc.push(c, mirrored(c, 'wb' + i + 'L'));
  });
  part('blade', s.blade, { h: 0.03, mat: 'armor', mask: [['yellow', (x, y, z) => 0.76 - y + 0.5 * abs(x)], ['black', (x, y, z) => y - 0.36]], copies: bc, ao: false, cast: false });
  part('bladeLight', s.bladeLight, { h: 0.014, mat: 'cyan', copies: bc, ao: false, cast: false });
  const membW = (x, y, z) => {
    const a = Math.atan2(y - J.wing[1], abs(x) - J.wing[0]) / D2R;
    for (let i = 0; i + 1 < BLADES.length; i++) { const a0 = BLADES[i][0], a1 = BLADES[i + 1][0]; if (a <= a0 + 1e-6 && a >= a1 - 1e-6) { const u = (a0 - a) / (a0 - a1); return [['wb' + i + 'R', 1 - u + 1e-3], ['wb' + (i + 1) + 'R', u + 1e-3]]; } }
    return a > BLADES[0][0] ? [['wb0R', 1]] : [['wb' + (BLADES.length - 1) + 'R', 1]];
  };
  part('memb', s.memb, { mat: 'film', bone: membW, copies: [{}, { mirror: true }], alpha: true, ao: false, cast: false });
  // ---- 槍
  part('shaft', s.shaft, { h: 0.075, mat: 'black', bone: 'lance', ao: false });
  part('lanceMain', s.lanceMain, { h: 0.085, mat: 'armor', mask: [['yellow', (x, y, z) => { const zz = z - GRIP[2], w = zz < 6.6 ? 0.46 + (zz - 5.25) * 0.4 : zz < 9.8 ? 1.0 - (zz - 6.6) * 0.094 : 0.7 * (13.0 - zz) / 3.2; return (w - 0.27) - abs(y - GRIP[1]); }], ['black', (x, y, z) => max(abs(y - GRIP[1]) - 0.19, z - GRIP[2] - 9.9)]], bone: 'lance', ao: false });
  part('lanceCross', s.lanceCross, { h: 0.07, mat: 'yellow', mask: [['black', (x, y, z) => abs(x - GRIP[0]) - 0.13]], bone: 'lance', ao: false });
  part('guard', s.guard, { h: 0.07, mat: 'yellow', mask: [['black', (x, y, z) => hypot(x - GRIP[0], y - GRIP[1]) - 0.45]], bone: 'lance', ao: false });
  part('butt', s.butt, { h: 0.06, mat: 'yellow', bone: 'lance', ao: false });
  part('lanceLight', s.lanceLight, { h: 0.06, mat: 'cyan', bone: 'lance', ao: false, cast: false });
  return m;
}
