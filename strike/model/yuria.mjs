// yuria.mjs — ユリア（戦闘形態）の 3D モデル。いただいた絵をもとにした、およそ 3 頭身のデフォルメ。
//   白い髪と黄色い毛先（うしろは足もとまで、本人の左にサイドテール）、黄色い角の髪飾り、「#」の髪留め、
//   白い体の装甲（わきは黒）、大きな白い袖（黒いそで口）、白い手袋、腰の黄色い刃、白・黄・黒のブーツ、
//   機械の翼（黒い軸に水色の輪・白い羽・黄色い光の膜）、長い槍（本人の右手）。
//   顔（目・口・ほお）は絵を貼る（描くのは strike/src/cast.js。chase/src/chibi.js の顔をそのまま使う）。
//   座標: +y が上、+z が正面、+x が本人の右。頭の半径がおよそ 1、足の裏が y = 0、頭の中心が y = 4.85。
import { sphere, ellipsoid, rcone, rbox, torus, cyl, cone, plate, union, blend, cut, both, grow, bump, move, mirror, tube, ribbon, half, euler, look, rotX, rotY, rotZ, mul3, V, I3, surfaceAlong, gradient, patch, bladeR } from './sdf.mjs';
import { Model, mirrored } from './pack.mjs';
import { autoWeights, bothSides } from './rig.mjs';

const { sin, cos, abs, min, max, PI, hypot } = Math, D2R = PI / 180;
export const YHC = [0, 4.85, 0];
const HY = YHC[1], H = (x, y, z) => [x, HY + y, z];
const sstep = (a, b, x) => { const t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 関節
export const YJ = {
  pelvis: [0, 2.3, 0], spine: [0, 2.68, 0], chest: [0, 3.08, 0], neck: [0, 3.72, -0.02], head: [0, 4.0, 0],
  S: [0.56, 3.5, -0.02], E: [0.98, 2.92, -0.02], W: [1.38, 2.36, 0.06],
  hip: [0.33, 2.22, 0], knee: [0.38, 1.3, 0.03], ankle: [0.39, 0.36, -0.02],
  hub: [0.6, 2.58, 0.04], wing: [1.34, 3.9, -1.25],
  hair1: H(0, 0.1, -0.85), hair2: H(0, -1.5, -0.9), hair3: H(0, -2.8, -0.84),
  tail1: H(-0.86, 0.66, -0.28), tail2: H(-1.85, -0.3, -0.5), lock: H(0.9, 0.3, 0.4),
};
const dF = V.norm(V.sub(YJ.W, YJ.E)), dU = V.norm(V.sub(YJ.E, YJ.S));         // 前腕・上腕の向き
export const GRIP = V.add(YJ.W, dF, 0.3);                                      // 右手のにぎりの中心（槍の軸が通る）
export const LANCE = { z0: -2.9, z1: 5.7 };                                    // 槍の石突きと穂先（にぎりからの前後の位置）
// 翼の羽（軸からの向き（度。0 = 真横の外、90 = 真上）と、長さ）
export const BLADES = [[98, 2.2], [72, 2.75], [46, 2.8], [20, 2.4], [-6, 1.8]];

// 翼の光の膜: 羽と羽のあいだに張る、厚みのない面（外のふちは弓なりにへこむ）
function membMesh() {
  const pos = [], nor = [], quads = [], NU = 8, NV = 5, wc = YJ.wing;
  BLADES.slice(0, -1).forEach(([a0, L0], i) => {
    const [a1, L1] = BLADES[i + 1], base = pos.length / 3;
    for (let v = 0; v <= NV; v++) for (let u = 0; u <= NU; u++) {
      const fu = u / NU, fv = v / NV, a = (a0 + (a1 - a0) * fu) * D2R, Ro = (L0 + (L1 - L0) * fu) * 0.88 * (1 - 0.24 * sin(PI * fu)), r = 0.4 + (Ro - 0.4) * fv;
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
  // ---- 頭: 丸い頭に、ふっくらしたほおと小さなあご。鼻はごく小さく。耳
  const skull = blend(0.25, ellipsoid(H(0, 0.03, -0.02), [0.96, 0.95, 0.93]), mirror(sphere(H(0.4, -0.36, 0.34), 0.5)), sphere(H(0, -0.58, 0.4), 0.36));
  const head = blend(0.05, blend(0.07, skull, sphere(H(0, -0.2, 0.9), 0.05)), mirror(ellipsoid(H(0.93, -0.1, -0.04), [0.09, 0.2, 0.13], euler(0, -20, -8))));
  // ---- 髪。頭をおおう面（顔のところをくりぬく）に、前髪の束を重ねる
  const hp = (az, el, r, rad) => [0.96 * r * cos(el * D2R) * sin(az * D2R), HY + 0.03 + 0.95 * r * sin(el * D2R), -0.02 + 0.93 * r * cos(el * D2R) * cos(az * D2R), rad];
  const radial = (az, el) => [cos(el * D2R) * sin(az * D2R), sin(el * D2R), cos(el * D2R) * cos(az * D2R)];
  const bang = (az, az2, els, rads, r = 1.13) => ribbon(els.map((el, i) => hp(az + (az2 - az) * i / (els.length - 1), el, i === 0 ? 1.07 : r, rads[i])), radial((az + az2) / 2, 30), 0.42, 10);
  const capS = cut(ellipsoid(H(0, 0.1, -0.08), [1.08, 1.04, 1.1]), ellipsoid(H(0, -0.5, 0.9), [0.88, 0.98, 0.9]), 0.06);
  const bangs = [
    bang(5, -5, [78, 46, 18, -15], [0.2, 0.26, 0.2, 0.03]),                    // まんなか（目のあいだへ）
    bang(27, 35, [74, 42, 17, 2], [0.2, 0.29, 0.21, 0.03]),                    // 本人の右
    bang(-25, -21, [74, 42, 18, 3], [0.2, 0.28, 0.2, 0.03]),                   // 本人の左
    bang(51, 62, [64, 34, 6, -24], [0.2, 0.28, 0.2, 0.03], 1.11),              // 右の外（顔のわきへ）
    bang(-51, -60, [64, 34, 7, -22], [0.2, 0.28, 0.2, 0.03], 1.11),
    bang(15, 17, [80, 50, 25, 6], [0.16, 0.22, 0.15, 0.03], 1.16),             // すきまを埋める細い束
    bang(-38, -41, [70, 44, 21, 4], [0.16, 0.22, 0.15, 0.03], 1.15),
    bang(40, 46, [70, 44, 21, 2], [0.16, 0.22, 0.15, 0.03], 1.15),
    bang(-12, -13, [80, 50, 27, 9], [0.16, 0.2, 0.14, 0.03], 1.16),
  ];

  const ahoge = tube([[0.04, HY + 1.0, 0.12, 0.085], [0.2, HY + 1.3, 0.2, 0.075], [0.1, HY + 1.52, 0.3, 0.05], [-0.14, HY + 1.5, 0.36, 0.012]], 10);
  const tufts = union(ribbon([[0.5, HY + 0.9, -0.3, 0.2], [0.85, HY + 1.0, -0.5, 0.15], [1.12, HY + 0.92, -0.62, 0.012]], [0, 1, 0.3], 0.5, 8), ribbon([[-0.3, HY + 0.98, -0.45, 0.2], [-0.4, HY + 1.18, -0.75, 0.14], [-0.38, HY + 1.2, -1.02, 0.012]], [0, 1, 0.5], 0.5, 8));
  const hair = blend(0.05, capS, ...bangs, ahoge, tufts);
  // 顔のわきの長い束（胸のあたりまで）。本人の右に作って、左へも写す
  const sideLock = ribbon([[0.9, HY + 0.3, 0.38, 0.15], [1.01, HY - 0.4, 0.5, 0.17], [0.97, HY - 1.1, 0.52, 0.13], [0.88, HY - 1.8, 0.47, 0.012]], [1, 0, 0.3], 0.5, 10);
  // うしろ髪: 太い束を 5 本、足もとまで。先はばらばらの長さでとがる
  const bl = (P) => ribbon(P.map((p) => [p[0], HY + p[1], p[2], p[3]]), [0, 0, 1], 0.5, 14);
  const backHair = blend(0.045,
    bl([[0, 0.0, -0.95, 0.4], [0, -1.2, -0.99, 0.42], [0, -2.5, -0.87, 0.34], [0.03, -3.5, -0.83, 0.19], [0.05, -4.2, -0.8, 0.012]]),
    bl([[0.4, 0.0, -0.88, 0.36], [0.5, -1.2, -0.92, 0.36], [0.56, -2.4, -0.84, 0.29], [0.64, -3.25, -0.79, 0.17], [0.72, -3.85, -0.76, 0.012]]),
    bl([[-0.4, 0.0, -0.88, 0.36], [-0.5, -1.2, -0.92, 0.36], [-0.54, -2.45, -0.84, 0.3], [-0.6, -3.4, -0.79, 0.17], [-0.66, -4.0, -0.76, 0.012]]),
    bl([[0.74, -0.05, -0.62, 0.32], [0.9, -1.1, -0.74, 0.32], [1.0, -2.1, -0.72, 0.25], [1.08, -2.85, -0.66, 0.14], [1.18, -3.4, -0.62, 0.012]]),
    bl([[-0.74, -0.05, -0.62, 0.32], [-0.88, -1.1, -0.74, 0.31], [-0.96, -2.0, -0.72, 0.24], [-1.02, -2.7, -0.66, 0.14], [-1.1, -3.2, -0.62, 0.012]]),
    bl([[0.2, -0.3, -1.02, 0.24], [0.26, -1.4, -1.08, 0.25], [0.3, -2.5, -0.97, 0.2], [0.36, -3.3, -0.9, 0.1], [0.42, -3.7, -0.86, 0.012]]),
    bl([[-0.22, -0.3, -1.02, 0.24], [-0.27, -1.5, -1.08, 0.25], [-0.3, -2.7, -0.96, 0.2], [-0.32, -3.6, -0.9, 0.1], [-0.36, -4.05, -0.86, 0.012]]),
    bl([[0.95, -0.2, -0.3, 0.26], [1.12, -1.0, -0.42, 0.26], [1.22, -1.8, -0.44, 0.2], [1.32, -2.4, -0.42, 0.1], [1.42, -2.8, -0.4, 0.012]]),
    bl([[-0.62, -0.3, -0.95, 0.22], [-0.72, -1.3, -1.0, 0.22], [-0.78, -2.2, -0.92, 0.17], [-0.86, -2.9, -0.86, 0.09], [-0.94, -3.3, -0.82, 0.012]]));
  // サイドテール（本人の左）: 結び目から外へふくらんで、腰のあたりまで
  const tl = (P, fl = [0.5, 0, 1]) => ribbon(P.map((p) => [p[0], HY + p[1], p[2], p[3]]), fl, 0.62, 14);
  const sideTail = blend(0.08,
    tl([[-0.86, 0.66, -0.28, 0.2], [-1.36, 0.8, -0.42, 0.3], [-1.8, 0.32, -0.5, 0.37], [-1.96, -0.6, -0.5, 0.36], [-1.9, -1.6, -0.46, 0.27], [-1.74, -2.5, -0.4, 0.012]]),
    tl([[-1.3, 0.72, -0.4, 0.2], [-1.62, 0.2, -0.32, 0.26], [-1.62, -0.7, -0.28, 0.24], [-1.5, -1.5, -0.24, 0.16], [-1.36, -2.05, -0.2, 0.012]]),
    tl([[-1.5, 0.7, -0.5, 0.2], [-2.0, 0.5, -0.66, 0.24], [-2.28, -0.2, -0.7, 0.22], [-2.34, -1.0, -0.66, 0.14], [-2.3, -1.6, -0.6, 0.012]]));
  // ---- 髪飾り: 結び目の黒い輪（水色に光る輪つき）と、黄色い角 3 本。「#」の髪留め 2 つ
  const hubP = YJ.tail1, hubN = V.norm([-0.8, 0.42, -0.25]);
  const hubS = cyl(V.add(hubP, hubN, -0.06), V.add(hubP, hubN, 0.13), 0.3, 0.04);
  const hubRing = torus(V.add(hubP, hubN, 0.13), hubN, 0.17, 0.035);
  const hubCap = cyl(V.add(hubP, hubN, 0.1), V.add(hubP, hubN, 0.17), 0.085, 0.02);
  const hornPts = (L, w) => [[-0.42 * w, 0], [-0.52 * w, 0.26 * L], [-0.06 * w, L], [0.5 * w, 0.2 * L], [0.3 * w, 0]];
  const horn = (base, dir, nor, L, w) => plate(base, bladeR(dir, nor), hornPts(L, w), 0.06, { edge: w * 0.45, round: 0.008, thin: 0.42 });
  const hornR0 = H(0.76, 0.7, 0.02);
  const horns = union(horn(V.add(hubP, [-0.02, 0.2, 0.0]), [-0.16, 1, -0.14], [0.3, 0.1, 1], 1.35, 0.36), horn(V.add(hubP, [-0.2, 0.12, -0.04]), [-0.78, 0.6, -0.22], [0.25, 0.2, 1], 0.98, 0.3), horn(hornR0, [0.4, 1, -0.22], [-0.25, 0.1, 1], 1.25, 0.34));
  const hornBase = blend(0.03, sphere(V.add(hornR0, [0.0, 0.02, 0]), 0.15), cyl(V.add(hornR0, [-0.02, -0.08, 0.1]), V.add(hornR0, [0.02, 0.08, 0.16]), 0.1, 0.02));
  const hornDot = sphere(V.add(hornR0, [0.0, 0.02, 0.15]), 0.055);
  const pin = (dir) => {
    const p = surfaceAlong(hair, YHC, V.norm(dir), 0.6, 2.2), n = gradient(hair, p), R = mul3(look(n), rotZ(0.3)), q = V.add(p, n, 0.016);
    const bar = (dx, dy, hx, hy) => ({ c: V.add(q, [R[0][0] * dx + R[0][1] * dy, R[1][0] * dx + R[1][1] * dy, R[2][0] * dx + R[2][1] * dy]), R, h: [hx, hy, 0.026] });
    return [bar(0, 0.052, 0.16, 0.024), bar(0, -0.052, 0.16, 0.024), bar(0.052, 0, 0.024, 0.16), bar(-0.052, 0, 0.024, 0.16)];
  };
  const pins = boxes([...pin([0.56, 0.5, 0.72]), ...pin([-0.5, 0.74, 0.5])]);

  // ---- 体。胸・腰・おしり・もも・肩と腕をなめらかにつなぐ
  const { S, E, W, hip, knee, ankle } = YJ;
  const trunk0 = blend(0.22, ellipsoid([0, 3.22, -0.02], [0.47, 0.4, 0.33]), ellipsoid([0, 2.74, 0], [0.33, 0.36, 0.26]), ellipsoid([0, 2.3, -0.02], [0.52, 0.36, 0.38]), rcone([0, 3.5, -0.03], [0, 4.1, 0], 0.2, 0.17), mirror(sphere([0.25, 2.2, -0.2], 0.32)));
  // 胸: 小さくなだらかに。上からゆるく下って下のほうでふくらみ、左右は服の下でつながる（球を 2 つ貼った形にしない）
  const trunk = blend(0.1, blend(0.2, trunk0, mirror(ellipsoid([0.2, 3.33, 0.15], [0.25, 0.3, 0.2], euler(-20, 8, 0))), ellipsoid([0, 3.2, 0.18], [0.22, 0.17, 0.14])), mirror(ellipsoid([0.215, 3.17, 0.215], [0.22, 0.19, 0.2])));
  const arm = blend(0.06, sphere(S, 0.175), rcone(S, E, 0.15, 0.125), rcone(E, W, 0.12, 0.1));
  const thigh = blend(0.1, rcone(hip, knee, 0.33, 0.215), ellipsoid(V.add(V.lerp(hip, knee, 0.34), [0.03, 0, 0.02]), [0.32, 0.42, 0.34]));
  const body = blend(0.1, trunk, mirror(arm), mirror(thigh));
  // 体の装甲（白）の範囲と、その中の黒い面。場が負の側がその色
  const suitF = (x, y, z) => { const ax = abs(x), slope = 0.95 + 0.6 * sstep(-0.12, 0.12, z); return max(2.0 + slope * ax - y, y - 3.9, ax - (0.43 + 0.2 * sstep(3.2, 2.95, y))); };
  const blackF = (x, y, z) => {
    const ax = abs(x), collar = 3.66 - y, side = max(0.24 + 0.1 * sstep(2.5, 2.95, y) - ax, y - 2.98);          // わきの黒は、胸の下まで
    const band = max(abs(y - (2.87 + 0.3 * ax)) - 0.04, -z), spine = max(ax - 0.045, z + 0.1, y - 3.6);
    return max(suitF(x, y, z), min(collar, side, band, spine));
  };
  // 胸もとの水色の石、腰の帯（白）、胸の下の黄色い山形
  const gemP = surfaceAlong(trunk, [0, 3.56, 0], [0, 0, 1], 0.02, 1.5);
  const gem = plate(V.add(gemP, [0, 0, 0.0]), rotX(-0.25), [[0, 0.1], [0.075, 0], [0, -0.1], [-0.075, 0]], 0.035, { edge: 0.07, round: 0.006, thin: 0.4 });
  // 腰の帯（白）: 肌の上を横切る細い帯。装甲と同じ色なので、装甲の範囲に足して塗る（境目がくっきり出る）
  const suitBelt = (x, y, z) => Math.min(suitF(x, y, z), max(abs(y - (2.44 + 0.3 * abs(x))) - 0.048, abs(x) - 0.75));
  const chev = patch(trunk, { bb: [-0.3, 2.5, 0, 0.3, 3.1, 1], d: (x, y, z) => max(abs(y - (2.72 + 0.55 * abs(x))) - 0.035, abs(x) - 0.17, -z) }, 0.02, 0.006);
  // ---- 袖（上腕のなかほどから手首まで、手首へ向かって大きくふくらむ。先は黒いそで口で、中が空いている）
  const cuffB = V.add(W, dF, 0.2), sp = (a, b, k) => V.lerp(a, b, k);
  const slv0 = tube([[...sp(S, E, 0.4), 0.2], [...sp(S, E, 0.62), 0.3], [...E, 0.38], [...sp(E, W, 0.5), 0.46], [...W, 0.5], [...cuffB, 0.5], [...V.add(cuffB, dF, 0.3), 0.5]], 16);
  const kB = V.dot(dF, cuffB);
  const sleeve = cut(both(blend(0.05, slv0, torus(sp(S, E, 0.47), dU, 0.2, 0.075)), { bb: slv0.bb, d: (x, y, z) => x * dF[0] + y * dF[1] + z * dF[2] - kB }, 0.02), cyl(V.add(cuffB, dF, -0.26), V.add(cuffB, dF, 0.4), 0.415), 0.02);
  const cuffRing = torus(V.add(cuffB, dF, -0.02), dF, 0.475, 0.05);
  const sleeveTop = (x, y, z) => { const q = sp(S, E, 0.6); return (x - q[0]) * dU[0] + (y - q[1]) * dU[1] + (z - q[2]) * dU[2]; };          // 肩に近い側が負 → 黄色
  const sleeveCuff = (x, y, z) => { const q = V.add(W, dF, -0.12); return -((x - q[0]) * dF[0] + (y - q[1]) * dF[1] + (z - q[2]) * dF[2]); };   // 手首より先が負 → 黒
  // ---- 手。右は槍をにぎるこぶし、左はひらいた手（どちらも白い手袋）
  const G = GRIP;
  const fist = blend(0.045, ellipsoid(G, [0.2, 0.2, 0.2]), rcone(W, V.add(W, dF, 0.14), 0.12, 0.15),
    union([-0.13, -0.045, 0.04, 0.125].map((k) => rcone(V.add(G, [0.15, 0.1, k]), V.add(G, [0.17, -0.09, k]), 0.074, 0.07))), rcone(V.add(G, [-0.05, 0.14, -0.1]), V.add(G, [0.1, 0.17, 0.08]), 0.075, 0.065));
  const palm0 = blend(0.035, ellipsoid([0, 0.02, 0], [0.16, 0.19, 0.085]), rcone([0, -0.3, 0], [0, -0.1, 0], 0.11, 0.13),
    union([[-0.115, 0.3], [-0.04, 0.37], [0.04, 0.36], [0.112, 0.29]].map(([x, l]) => rcone([x, 0.14, 0], [x * 1.3, 0.14 + l, 0.01], 0.052, 0.042))), rcone([0.12, -0.04, 0.02], [0.27, 0.12, 0.05], 0.056, 0.046));
  const hx = V.norm(V.sub([0, 0, 1], V.mul(dF, dF[2]))), hz = V.cross(hx, dF);
  const openHand = move(palm0, { R: [[hx[0], dF[0], hz[0]], [hx[1], dF[1], hz[1]], [hx[2], dF[2], hz[2]]], t: V.add(W, dF, 0.34) });
  // ---- 腰: 黒い輪の留め具と、そこから下がる黄色い刃
  const hub = YJ.hub;
  const hipHub = cyl(V.add(hub, [-0.07, 0, 0]), V.add(hub, [0.09, 0, 0]), 0.15, 0.03);
  const hipDot = cyl(V.add(hub, [0.06, 0, 0]), V.add(hub, [0.125, 0, 0]), 0.07, 0.015);
  const hipBlade = plate([0, 0, 0], I3, [[-0.12, -0.04], [-0.2, 0.3], [-0.05, 1.0], [0.2, 0.4], [0.14, -0.04]], 0.055, { edge: 0.16, round: 0.008, thin: 0.42 });
  // ---- ブーツ（本人の右。ひざの上から）。すねは下へ広がる筒、ひざ当ては上へとがる。足はつま先が前へとがり、かかとは黒
  const shinT = rcone([0.38, 1.5, 0.02], [0.39, 0.52, -0.02], 0.255, 0.31);
  const bootU = blend(0.06, shinT, ellipsoid([0.39, 0.95, -0.2], [0.23, 0.38, 0.2]),
    blend(0.05, ellipsoid([0.38, 1.42, 0.23], [0.2, 0.25, 0.1]), cone([0.38, 1.5, 0.25], [0.38, 1.95, 0.2], 0.13, 0.02, 0.01)), cyl([0.385, 0.44, -0.02], [0.39, 0.6, -0.02], 0.33, 0.04));
  const bootF = blend(0.06, sphere(ankle, 0.2), rcone([0.39, 0.3, 0.04], [0.39, 0.12, 0.5], 0.23, 0.13), cone([0.39, 0.12, 0.42], [0.39, 0.035, 0.9], 0.14, 0.025, 0.012), rcone([0.39, 0.28, -0.14], [0.39, 0.05, -0.3], 0.15, 0.055));
  const bootYel = (x, y, z) => min(max(abs((y - 1.08) + 0.9 * abs(x - 0.38)) - 0.06, -z), max(abs((y - 0.82) + 0.9 * abs(x - 0.38)) - 0.045, -z), hypot(x - 0.38, y - 1.42, (z - 0.34) * 0.8) - 0.1);
  const bootBlk = (x, y, z) => min(abs(y - 0.52) - 0.075, 1.46 - y + 2.0 * max(0, z - 0.1), max(z + 0.16, abs(x - 0.39) - 0.2, y - 1.3) + 0.0);
  const footBlk = (x, y, z) => min(hypot(x - ankle[0], y - ankle[1], z - ankle[2]) - 0.215, y - 0.1 + 0.25 * max(0, z - 0.3), z + 0.17 - 0.2 * (y - 0.1));
  const shinBlade = plate([0.385, 1.2, 0.27], bladeR([0, -1, 0.08], [1, 0, 0]), [[-0.05, -0.1], [0.02, 0.25], [0.02, 0.62], [0.1, 0.82], [0.17, 0.5], [0.16, 0.0]], 0.055, { edge: 0.1, round: 0.008, thin: 0.42 });
  const calfFin = plate([0, 0, 0], I3, [[-0.1, 0], [-0.15, 0.3], [0, 0.85], [0.13, 0.25], [0.08, 0]], 0.05, { edge: 0.12, round: 0.008, thin: 0.42 });
  const bootLight = union(patch(shinT, rbox([0.65, 0.98, 0.03], [0.1, 0.19, 0.028], 0.015), 0.012, 0.004), patch(bootF, rbox([0.39, 0.3, 0.3], [0.03, 0.2, 0.2], 0.015), 0.012, 0.004));
  // ---- 翼。黒い軸に水色の輪、そこから白い羽を扇のように。羽のあいだに黄色い光の膜
  const wc = YJ.wing;
  const wHub = blend(0.03, cyl(V.add(wc, [0, 0, -0.1]), V.add(wc, [0, 0, 0.1]), 0.3, 0.04), cyl(V.add(wc, [0, 0, -0.15]), V.add(wc, [0, 0, 0.15]), 0.13, 0.03));
  const wRing = union(torus(V.add(wc, [0, 0, 0.1]), [0, 0, 1], 0.2, 0.034), torus(V.add(wc, [0, 0, -0.1]), [0, 0, 1], 0.2, 0.034));
  const wArm = tube([[...wc, 0.07], [1.0, 3.72, -0.86, 0.06], [0.62, 3.5, -0.42, 0.055]], 8);                  // 背中とつなぐ細い腕
  const blade = plate([0, 0, 0], I3, [[-0.1, 0.26], [-0.25, 0.56], [-0.2, 0.8], [-0.05, 1.0], [0.16, 0.74], [0.27, 0.48], [0.12, 0.26]], 0.055, { edge: 0.13, round: 0.006, thin: 0.42 });
  const bladeLight = rbox([0.0, 0.5, 0], [0.018, 0.13, 0.058], 0.012);
  const memb = membMesh();

  // ---- 槍（にぎりの位置から、前へ穂先・うしろへ石突き）。柄は黒、穂は白・黄・黒の刃を十字に組む
  const lz = (z, dx = 0, dy = 0) => [G[0] + dx, G[1] + dy, G[2] + z];
  const shaft = union(cyl(lz(-2.35), lz(2.2), 0.055, 0.01), cyl(lz(-0.5), lz(-0.34), 0.075, 0.015), cyl(lz(0.36), lz(0.52), 0.075, 0.015), cyl(lz(1.85), lz(2.3), 0.1, 0.02), cyl(lz(-2.45), lz(-2.2), 0.095, 0.02));
  const PY = bladeR([0, 0, 1], [1, 0, 0]), PX = bladeR([0, 0, 1], [0, -1, 0]);     // 板を立てる向き（面が左右を向く）・ねかせる向き（面が上下を向く）
  const lanceMain = plate(lz(0), PY, [[0, 2.15], [0.2, 2.3], [0.44, 2.9], [0.3, 4.3], [0, 5.7], [-0.3, 4.3], [-0.44, 2.9], [-0.2, 2.3]], 0.08, { edge: 0.3, round: 0.008, thin: 0.38 });
  const lanceCross = plate(lz(0), PX, [[0, 2.3], [0.24, 2.75], [0.16, 3.9], [0, 4.9], [-0.16, 3.9], [-0.24, 2.75]], 0.06, { edge: 0.18, round: 0.008, thin: 0.42 });
  const guardPts = [[0.1, 1.95], [0.62, 1.55], [0.74, 1.0], [0.5, 1.5], [0.3, 2.3], [0.1, 2.35]];
  const guard = union(plate(lz(0), PY, guardPts, 0.055, { edge: 0.1, round: 0.008, thin: 0.42 }), plate(lz(0), PY, guardPts.map(([a, b]) => [-a, b]).reverse(), 0.055, { edge: 0.1, round: 0.008, thin: 0.42 }),
    plate(lz(0), PX, guardPts.map(([a, b]) => [a * 0.62, b]), 0.05, { edge: 0.08, round: 0.008, thin: 0.45 }), plate(lz(0), PX, guardPts.map(([a, b]) => [-a * 0.62, b]).reverse(), 0.05, { edge: 0.08, round: 0.008, thin: 0.45 }));
  const buttPts = [[0.05, -2.25], [0.3, -2.4], [0.2, -2.9], [0.12, -2.55], [0.05, -2.5]];
  const butt = union(plate(lz(0), PY, [[0.07, -2.3], [0, -3.0], [-0.07, -2.3]], 0.05, { edge: 0.06, round: 0.006, thin: 0.45 }),
    plate(lz(0), PY, buttPts, 0.05, { edge: 0.07, round: 0.006, thin: 0.45 }), plate(lz(0), PY, buttPts.map(([a, b]) => [-a, b]).reverse(), 0.05, { edge: 0.07, round: 0.006, thin: 0.45 }));
  const lanceLight = union(rbox(lz(3.3, 0.0, 0), [0.082, 0.028, 0.75], 0.015), rbox(lz(3.0, 0, 0), [0.028, 0.068, 0.5], 0.015));
  return { head, hair, sideLock, backHair, sideTail, hubS, hubRing, hubCap, horns, hornBase, hornDot, pins, body, trunk, suitF: suitBelt, blackF, gem, chev, sleeve, cuffRing, sleeveTop, sleeveCuff, fist, openHand,
    hipHub, hipDot, hipBlade, bootU, bootF, bootYel, bootBlk, footBlk, shinBlade, calfFin, bootLight, wHub, wRing, wArm, blade, bladeLight, memb, shaft, lanceMain, lanceCross, guard, butt, lanceLight };
}

// lod: 戦いのあいだの小さなうしろ姿に使う、粗い版（細かい灯は省く）
export function buildYuria(o = {}) {
  const PLATES = new Set(['horns', 'hipBlade', 'shinBlade', 'calfFin', 'blade', 'lanceMain', 'lanceCross', 'guard', 'butt']), SKIP = new Set(['chev', 'hipDot', 'hornDot', 'bladeLight', 'bootLight', 'hubCap']), KEEP = new Set(['shaft', 'wArm', 'gem', 'hubRing', 'wRing', 'cuffRing', 'lanceLight']);
  const part = (name, shape, opt) => { if (o.lod) { if (SKIP.has(name)) return; if (opt.h && !KEEP.has(name)) opt.h *= PLATES.has(name) ? 1.5 : 1.9; } m.part(name, shape, opt); };
  const s = shapes(), m = new Model(o.lod ? 'yuria_lo' : 'yuria', { toon: 1, line: 0.0024, aoR: 0.32, height: 5.9, faceRect: [0, HY, 1 / 2.2, 0], grip: GRIP, lance: [LANCE.z0, LANCE.z1] });
  const mat = (n, d) => m.mat(n, d);
  mat('face', { col: '#ffe1d0', kind: 'face', spec: 0.1, gloss: 20, rim: 0.2, shade: '#ffcdbd' });
  mat('skin', { col: '#ffe1d0', kind: 'skin', spec: 0.12, gloss: 24, rim: 0.28, shade: '#ffc8b8' });
  mat('hair', { col: '#f5f3fc', kind: 'hair', spec: 0.55, gloss: 20, rim: 0.3, shade: '#c6c0e4' });
  mat('hairTip', { col: '#ffd640', kind: 'hair', spec: 0.5, gloss: 20, rim: 0.3, shade: '#f4a322' });
  mat('suit', { col: '#f6f6fc', kind: 'gloss', spec: 0.5, gloss: 46, rim: 0.3, shade: '#c6cbe6' });
  mat('black', { col: '#25252f', kind: 'gloss', spec: 0.7, gloss: 50, rim: 0.4, shade: '#12121a' });
  mat('yellow', { col: '#ffd033', kind: 'gloss', spec: 0.7, gloss: 50, rim: 0.3, shade: '#ec9418' });
  mat('cloth', { col: '#f5f5fc', kind: 'cloth', spec: 0.1, gloss: 14, rim: 0.25, shade: '#c3c9e4' });
  mat('armor', { col: '#f8f8fe', kind: 'gloss', spec: 0.8, gloss: 60, rim: 0.3, shade: '#c0c7e2' });
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
    ['pelvis', [0, 2.1, 0], [0, 2.4, 0], 0.5], ['spine', [0, 2.62, 0], [0, 2.9, 0], 0.4], ['chest', [0, 3.1, 0], [0, 3.5, 0], 0.5], ['chest', [-0.4, 3.45, 0], [0.4, 3.45, 0], 0.36],
    ['neck', [0, 3.78, 0], [0, 4.05, 0], 0.26], ['arm#', J.S, J.E, 0.25], ['fore#', J.E, J.W, 0.23], ['thigh#', J.hip, J.knee, 0.36],
  ]), 6);
  const armW = autoWeights(bothSides([['arm#', J.S, J.E, 0.3], ['fore#', J.E, V.add(J.W, dF, 0.6), 0.3]]), 5);
  const hairW = autoWeights([['hair1', H(0, 0.4, -0.7), H(0, -1.3, -0.9), 1.0], ['hair2', H(0, -1.7, -0.9), H(0, -2.6, -0.85), 1.0], ['hair3', H(0, -3.0, -0.82), H(0, -4.3, -0.8), 1.0]], 5);
  const tailW = autoWeights([['tail1', J.tail1, H(-1.9, 0.2, -0.5), 0.8], ['tail2', H(-1.95, -0.7, -0.5), H(-1.8, -2.5, -0.4), 0.8]], 5);
  const both2 = (bone) => [{ bone: bone + 'R' }, { bone: bone + 'L', mirror: true }];
  const tipY = (y0, w) => [['hairTip', (x, y, z) => y - y0, w]];
  // ---- 部品: 頭と髪
  part('head', s.head, { h: 0.055, mat: 'face', bone: 'head' });
  part('hair', s.hair, { h: 0.046, mat: 'hair', bone: 'head' });
  part('sideLock', s.sideLock, { h: 0.04, mat: 'hair', mask: tipY(3.5, 0.5), copies: both2('lock') });
  part('backHair', s.backHair, { h: 0.07, mat: 'hair', mask: tipY(2.55, 1.0), bone: hairW });
  part('sideTail', s.sideTail, { h: 0.065, mat: 'hair', mask: tipY(3.6, 0.9), bone: tailW });
  part('hub', s.hubS, { h: 0.04, mat: 'black', bone: 'head' });
  part('hubRing', s.hubRing, { h: 0.022, mat: 'cyan', bone: 'head', ao: false, cast: false });
  part('hubCap', s.hubCap, { h: 0.025, mat: 'black', bone: 'head', ao: false });
  part('horns', s.horns, { h: 0.036, mat: 'yellow', bone: 'head', ao: false });
  part('hornBase', s.hornBase, { h: 0.03, mat: 'black', bone: 'head' });
  part('hornDot', s.hornDot, { h: 0.022, mat: 'cyan', bone: 'head', ao: false, cast: false });
  part('pins', s.pins, { mat: 'pin', bone: 'head' });
  // ---- 体・袖・手
  part('body', s.body, { h: 0.048, mat: 'skin', mask: [['suit', s.suitF], ['black', s.blackF]], bone: wts });
  part('gem', s.gem, { h: 0.02, mat: 'cyan', bone: 'chest', ao: false, cast: false });
  part('chev', s.chev, { h: 0.018, mat: 'yellow', bone: wts, cast: false, ao: false });
  part('sleeve', s.sleeve, { h: 0.055, mat: 'cloth', mask: [['yellow', s.sleeveTop], ['black', s.sleeveCuff]], bone: armW, copies: [{}, { mirror: true }] });
  part('cuffRing', s.cuffRing, { h: 0.04, mat: 'yellow', copies: both2('fore'), ao: false });
  part('fist', s.fist, { h: 0.028, mat: 'armor', bone: 'handR' });
  part('openHand', s.openHand, { h: 0.026, mat: 'armor', copies: [{ mirror: true, bone: 'handL' }] });
  // ---- 腰の留め具と刃
  part('hipHub', s.hipHub, { h: 0.026, mat: 'black', copies: both2('hip') });
  part('hipDot', s.hipDot, { h: 0.02, mat: 'yellow', copies: both2('hip'), ao: false });
  const hb = [];
  for (const [dir, nor, len, off] of [[[0.36, -1, 0.12], [1, 0.3, 0.1], 1.0, [0.1, -0.04, 0.02]], [[0.3, -1, -0.42], [1, 0.25, -0.35], 0.74, [0.08, -0.04, -0.1]]]) {
    const R = bladeR(dir, nor).map((r) => [r[0], r[1] * len, r[2]]), c = { R, t: V.add(J.hub, off), bone: 'hipR' }; hb.push(c, mirrored(c, 'hipL'));
  }
  part('hipBlade', s.hipBlade, { h: 0.034, mat: 'yellow', mask: [['black', (x, y, z) => y - 0.13]], copies: hb, ao: false, cast: false });
  // ---- ブーツ
  part('bootU', s.bootU, { h: 0.04, mat: 'armor', mask: [['yellow', s.bootYel], ['black', s.bootBlk]], copies: both2('shin') });
  part('bootF', s.bootF, { h: 0.036, mat: 'armor', mask: [['black', s.footBlk]], copies: both2('foot') });
  part('shinBlade', s.shinBlade, { h: 0.03, mat: 'yellow', copies: both2('shin'), ao: false });
  const cf = [];
  for (const [dir, nor, len, p] of [[[0.5, 0.8, -0.5], [0.3, 0.2, 1], 0.95, [0.6, 0.9, -0.2]], [[0.62, 0.45, -0.7], [0.3, 0.3, 1], 0.7, [0.6, 0.68, -0.22]]]) {
    const R = bladeR(dir, nor).map((r) => [r[0], r[1] * len, r[2]]), c = { R, t: p, bone: 'shinR' }; cf.push(c, mirrored(c, 'shinL'));
  }
  part('calfFin', s.calfFin, { h: 0.03, mat: 'armor', mask: [['yellow', (x, y, z) => 0.55 - y]], copies: cf, ao: false, cast: false });
  part('bootLight', s.bootLight, { h: 0.016, mat: 'cyan', copies: [{ bone: 'shinR' }, { bone: 'shinL', mirror: true }], ao: false, cast: false });
  // ---- 翼
  part('wHub', s.wHub, { h: 0.04, mat: 'black', copies: both2('wing') });
  part('wRing', s.wRing, { h: 0.03, mat: 'cyan', copies: both2('wing'), ao: false, cast: false });
  part('wArm', s.wArm, { h: 0.03, mat: 'black', copies: both2('wing'), ao: false, cast: false });
  const bc = [];
  BLADES.forEach(([a, L], i) => {
    const r = (a - 90) * D2R, R0 = rotZ(r), R = R0.map((row) => [row[0] * (0.8 + 0.1 * L), row[1] * L, row[2]]), c = { R, t: [J.wing[0], J.wing[1], J.wing[2] + 0.03 * (i % 2 ? 1 : -1)], bone: 'wb' + i + 'R' };
    bc.push(c, mirrored(c, 'wb' + i + 'L'));
  });
  part('blade', s.blade, { h: 0.03, mat: 'armor', mask: [['yellow', (x, y, z) => 0.76 - y + 0.5 * abs(x)], ['black', (x, y, z) => y - 0.37]], copies: bc, ao: false, cast: false });
  part('bladeLight', s.bladeLight, { h: 0.014, mat: 'cyan', copies: bc, ao: false, cast: false });
  const membW = (x, y, z) => {
    const a = Math.atan2(y - J.wing[1], abs(x) - J.wing[0]) / D2R;
    for (let i = 0; i + 1 < BLADES.length; i++) { const a0 = BLADES[i][0], a1 = BLADES[i + 1][0]; if (a <= a0 + 1e-6 && a >= a1 - 1e-6) { const u = (a0 - a) / (a0 - a1); return [['wb' + i + 'R', 1 - u + 1e-3], ['wb' + (i + 1) + 'R', u + 1e-3]]; } }
    return a > BLADES[0][0] ? [['wb0R', 1]] : [['wb' + (BLADES.length - 1) + 'R', 1]];
  };
  part('memb', s.memb, { mat: 'film', bone: membW, copies: [{}, { mirror: true }], alpha: true, ao: false, cast: false });
  // ---- 槍
  part('shaft', s.shaft, { h: 0.036, mat: 'black', bone: 'lance', ao: false });
  part('lanceMain', s.lanceMain, { h: 0.034, mat: 'armor', mask: [['yellow', (x, y, z) => { const zz = z - GRIP[2], w = zz < 2.9 ? 0.2 + (zz - 2.3) * 0.4 : zz < 4.3 ? 0.44 - (zz - 2.9) * 0.1 : 0.3 * (5.7 - zz) / 1.4; return (w - 0.12) - abs(y - GRIP[1]); }], ['black', (x, y, z) => max(abs(y - GRIP[1]) - 0.085, z - GRIP[2] - 4.35)]], bone: 'lance', ao: false });
  part('lanceCross', s.lanceCross, { h: 0.034, mat: 'yellow', mask: [['black', (x, y, z) => abs(x - GRIP[0]) - 0.06]], bone: 'lance', ao: false });
  part('guard', s.guard, { h: 0.034, mat: 'yellow', mask: [['black', (x, y, z) => hypot(x - GRIP[0], y - GRIP[1]) - 0.2]], bone: 'lance', ao: false });
  part('butt', s.butt, { h: 0.03, mat: 'yellow', bone: 'lance', ao: false });
  part('lanceLight', s.lanceLight, { h: 0.03, mat: 'cyan', bone: 'lance', ao: false, cast: false });
  return m;
}
