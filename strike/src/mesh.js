// mesh.js — 3D モデル（B.U.N の黒い機体）を作って、まとめて描く。
//   形は三角形の集まりで、面ごとに向き（法線）と色を持つ。色の 4 つめは「自分で光る度合い」（赤い灯・噴射口）。
//   同じ形は 1 回の命令で何機でも描く（インスタンス描画）。風景との前後は、風景の奥行き（アルファ）と比べて決める。
import { HEAD } from '../../flight/src/shaders.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---- 形を組み立てる道具。座標は +z が機首、+y が上、+x が右
export class Builder {
  constructor() { this.v = []; }
  tri(a, b, c, col) {
    const n = norm(cross(sub(b, a), sub(c, a)));
    for (const p of [a, b, c]) this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], col[0], col[1], col[2], col[3] || 0);
  }
  poly(pts, col) { for (let i = 1; i + 1 < pts.length; i++) this.tri(pts[0], pts[i], pts[i + 1], col); }
  // 断面を順につないで胴体にする。sections: [[z, [[x, y], …]], …]（どの断面も点の数は同じ）
  loft(sections, col, capA = true, capB = true) {
    const P = sections.map(([z, pts]) => pts.map(([x, y]) => [x, y, z]));
    for (let s = 0; s + 1 < P.length; s++) { const A = P[s], B = P[s + 1], n = A.length; for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.poly([A[i], A[j], B[j], B[i]], col); } }
    if (capA) this.poly(P[0], col); if (capB) this.poly(P[P.length - 1].slice().reverse(), col);
  }
  // 厚みのある板（翼・尾翼）。pts: 板のまん中の面の輪郭, t: 厚みの向きと大きさ
  slab(pts, t, col) {
    const top = pts.map((p) => add(p, t, 0.5)), bot = pts.map((p) => add(p, t, -0.5)), n = pts.length;
    this.poly(top, col); this.poly(bot.slice().reverse(), col);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.poly([top[i], bot[i], bot[j], top[j]], col); }
  }
  box(c, s, col) {
    const [x, y, z] = c, [a, b, d] = [s[0] / 2, s[1] / 2, s[2] / 2];
    this.loft([[z - d, [[x - a, y - b], [x + a, y - b], [x + a, y + b], [x - a, y + b]]], [z + d, [[x - a, y - b], [x + a, y - b], [x + a, y + b], [x - a, y + b]]]], col);
  }
  // 光る帯: a → b の線を、面の向き up に沿って少し浮かせた細い四角形にする
  strip(a, b, w, up, col) {
    const side = norm(cross(sub(b, a), up)), u = norm(up), o = 0.006;
    const p = (q, k) => [q[0] + side[0] * w * k + u[0] * o, q[1] + side[1] * w * k + u[1] * o, q[2] + side[2] * w * k + u[2] * o];
    this.poly([p(a, -0.5), p(b, -0.5), p(b, 0.5), p(a, 0.5)], col);
  }
  // 八面体（芯・弾）
  octa(c, r, col) {
    const [x, y, z] = c, [a, b, d] = r, T = [x, y + b, z], Bm = [x, y - b, z], E = [[x + a, y, z], [x, y, z + d], [x - a, y, z], [x, y, z - d]];
    for (let i = 0; i < 4; i++) { this.tri(T, E[i], E[(i + 1) % 4], col); this.tri(Bm, E[(i + 1) % 4], E[i], col); }
  }
  // ここまでに作った i0 番め以降の頂点を、左右対称に写して足す
  mirror(i0 = 0) {
    const v = this.v, n = v.length;
    for (let i = i0; i < n; i += 10) v.push(-v[i], v[i + 1], v[i + 2], -v[i + 3], v[i + 4], v[i + 5], v[i + 6], v[i + 7], v[i + 8], v[i + 9]);
  }
  get mark() { return this.v.length; }
  data() { return new Float32Array(this.v); }
}

// ---- B.U.N の機体。黒いつやのある外板に、文鳥のくちばしの色（赤）の灯
const K = [0.011, 0.012, 0.016, 0], G = [0.034, 0.036, 0.044, 0], M = [0.10, 0.105, 0.12, 0], C = [0.006, 0.016, 0.034, 0], Wt = [0.42, 0.42, 0.40, 0];
const R = [1.0, 0.040, 0.018, 1], O = [1.0, 0.26, 0.045, 1], P = [1.0, 0.09, 0.28, 1];
const hex6 = (w, h, top = 1) => [[0, h * top], [w, h * 0.35], [w, -h * 0.5], [0, -h * 0.8], [-w, -h * 0.5], [-w, h * 0.35]];
const ring = (r, n = 8, y0 = 0, sy = 1) => Array.from({ length: n }, (_, i) => [Math.cos(i / n * 6.2832) * r, y0 + Math.sin(i / n * 6.2832) * r * sy]);

export function models() {
  const out = {};
  // --- ドローン（小型の無人機）
  { const b = new Builder();
    b.loft([[0.30, hex6(0.006, 0.006)], [0.05, hex6(0.075, 0.055)], [-0.20, hex6(0.05, 0.035)]], K);
    const m = b.mark;
    b.slab([[0.05, 0, 0.06], [0.28, 0.02, 0.18], [0.30, 0.02, 0.11], [0.06, 0, -0.12]], [0, 0.02, 0], G);
    b.slab([[0.03, 0.02, -0.10], [0.10, 0.13, -0.22], [0.10, 0.13, -0.16], [0.03, 0.02, -0.02]], [0.014, 0, 0], K);
    b.strip([0.07, 0.012, 0.07], [0.27, 0.032, 0.17], 0.018, [0, 1, 0], R);
    b.mirror(m);
    b.poly([[-0.03, 0.045, 0.10], [0.03, 0.045, 0.10], [0.012, 0.03, 0.2], [-0.012, 0.03, 0.2]], R);        // 赤いひとつ目
    b.poly([[-0.035, -0.02, -0.201], [0.035, -0.02, -0.201], [0.035, 0.03, -0.201], [-0.035, 0.03, -0.201]], O);
    out.drone = { v: b.data(), r: 0.26 }; }
  // --- 戦闘機
  { const b = new Builder();
    b.loft([[0.86, hex6(0.008, 0.008)], [0.46, hex6(0.085, 0.07)], [0.14, hex6(0.14, 0.12, 0.85)], [-0.26, hex6(0.17, 0.11)], [-0.72, hex6(0.15, 0.08)]], K);
    b.loft([[0.50, hex6(0.03, 0.02).map(([x, y]) => [x, y + 0.06])], [0.26, hex6(0.075, 0.07).map(([x, y]) => [x, y + 0.085])], [0.02, hex6(0.06, 0.04).map(([x, y]) => [x, y + 0.09])]], C);   // 風防
    const m = b.mark;
    b.slab([[0.12, -0.01, 0.26], [0.66, -0.03, -0.40], [0.66, -0.03, -0.56], [0.12, -0.01, -0.52]], [0, 0.03, 0], G);                  // 主翼
    b.slab([[0.13, 0.05, -0.34], [0.13, 0.05, -0.72], [0.28, 0.34, -0.76], [0.26, 0.34, -0.60]], [0.02, -0.01, 0], K);                // 外へ傾いた尾翼
    b.slab([[0.12, -0.02, -0.52], [0.36, -0.03, -0.70], [0.36, -0.03, -0.80], [0.12, -0.02, -0.74]], [0, 0.022, 0], G);               // 水平尾翼
    b.strip([0.15, 0.006, 0.20], [0.65, -0.014, -0.41], 0.022, [0, 1, 0], R);
    b.strip([0.09, 0.03, 0.52], [0.13, 0.05, 0.30], 0.016, [0.8, 0.6, 0], R);
    b.poly([[0.03, -0.035, -0.722], [0.12, -0.035, -0.722], [0.12, 0.035, -0.722], [0.03, 0.035, -0.722]], O);                         // 噴射口
    b.strip([0.50, -0.012, -0.30], [0.50, -0.012, -0.50], 0.03, [0, 1, 0], Wt);
    b.mirror(m);
    out.fighter = { v: b.data(), r: 0.5 }; }
  // --- ガンシップ（全翼の大型機）
  { const b = new Builder();
    b.loft([[1.22, hex6(0.13, 0.09)], [0.80, hex6(0.34, 0.20)], [0.20, hex6(0.50, 0.28)], [-0.60, hex6(0.46, 0.26)], [-1.12, hex6(0.30, 0.16)]], K);
    b.poly(hex6(0.10, 0.07).map(([x, y]) => [x, y, 1.225]), R);                                                                          // 機首の赤い目
    const m = b.mark;
    b.slab([[0.40, 0.02, 0.56], [1.72, 0.06, -0.34], [1.72, 0.06, -0.76], [0.40, 0.02, -0.86]], [0, 0.09, 0], G);
    b.loft([[0.30, ring(0.02, 8, -0.16).map(([x, y]) => [x + 1.0, y])], [0.10, ring(0.15, 8, -0.16).map(([x, y]) => [x + 1.0, y])], [-0.90, ring(0.13, 8, -0.16).map(([x, y]) => [x + 1.0, y])]], K);
    b.poly(ring(0.10, 8, -0.16).map(([x, y]) => [x + 1.0, y, -0.905]), O);
    b.slab([[0.30, 0.20, -0.62], [0.30, 0.20, -1.10], [0.36, 0.64, -1.16], [0.36, 0.64, -0.92]], [0.03, 0, 0], K);
    b.strip([0.45, 0.07, 0.50], [1.70, 0.11, -0.35], 0.03, [0, 1, 0], R);
    b.strip([1.30, 0.108, -0.42], [1.30, 0.108, -0.72], 0.05, [0, 1, 0], Wt);
    b.strip([0.36, 0.10, 0.60], [0.50, 0.14, 0.0], 0.02, [0.7, 0.7, 0], R);
    b.mirror(m);
    out.gunship = { v: b.data(), r: 1.0 }; }
  // --- 砲塔（台の上の短い連装砲。+z を向く）
  { const b = new Builder();
    b.loft([[-0.14, ring(0.13, 6)], [0.10, ring(0.13, 6)]], G);
    b.loft([[-0.10, ring(0.10, 6, 0.10)], [0.06, ring(0.10, 6, 0.10)]], K);
    for (const x of [-0.045, 0.045]) { b.box([x, 0.10, 0.22], [0.045, 0.045, 0.34], M); b.poly([[x - 0.02, 0.08, 0.392], [x + 0.02, 0.08, 0.392], [x + 0.02, 0.12, 0.392], [x - 0.02, 0.12, 0.392]], R); }
    out.turret = { v: b.data(), r: 0.24 }; }
  // --- ミサイル
  { const b = new Builder();
    b.loft([[0.22, ring(0.004, 4)], [0.12, ring(0.036, 4)], [-0.16, ring(0.036, 4)], [-0.21, ring(0.022, 4)]], G);
    b.loft([[0.13, ring(0.038, 4)], [0.09, ring(0.038, 4)]], R, false, false);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a); b.slab([[c * 0.03, s * 0.03, -0.08], [c * 0.10, s * 0.10, -0.20], [c * 0.10, s * 0.10, -0.23], [c * 0.03, s * 0.03, -0.20]], [-s * 0.008, c * 0.008, 0], K); }
    b.poly(ring(0.02, 4).map(([x, y]) => [x, y, -0.212]), O);
    out.missile = { v: b.data(), r: 0.14 }; }
  // --- 砲弾（文鳥のバズーカ）
  { const b = new Builder(); b.octa([0, 0, 0], [0.07, 0.07, 0.13], G); b.octa([0, 0, 0.06], [0.045, 0.045, 0.06], R); out.shell = { v: b.data(), r: 0.12 }; }
  // --- 破片
  { const b = new Builder(); b.tri([-0.1, 0, -0.06], [0.12, 0.02, 0], [0, 0.03, 0.14], K); b.tri([-0.1, 0, -0.06], [0, 0.03, 0.14], [0.02, -0.06, 0.02], G); b.tri([0.12, 0.02, 0], [0.02, -0.06, 0.02], [0, 0.03, 0.14], K); b.tri([-0.1, 0, -0.06], [0.02, -0.06, 0.02], [0.12, 0.02, 0], G); out.shard = { v: b.data(), r: 0.12 }; }
  // --- 旗艦（空中戦艦）。全長 13
  { const b = new Builder();
    const sec = (w, ht, hb) => [[0, ht], [w * 0.7, ht * 0.8], [w, 0], [w * 0.6, -hb], [-w * 0.6, -hb], [-w, 0], [-w * 0.7, ht * 0.8]];
    b.loft([[6.5, sec(0.3, 0.2, 0.2)], [4.5, sec(1.1, 0.5, 0.7)], [1.5, sec(1.8, 0.8, 1.0)], [-2.0, sec(1.9, 0.9, 1.0)], [-5.0, sec(1.4, 0.7, 0.7)], [-6.5, sec(0.9, 0.4, 0.4)]], K);
    // 艦橋
    b.loft([[-1.6, [[-0.5, 0.7], [0.5, 0.7], [0.4, 1.3], [-0.4, 1.3]]], [-2.4, [[-0.55, 0.7], [0.55, 0.7], [0.5, 1.75], [-0.5, 1.75]]], [-3.6, [[-0.5, 0.7], [0.5, 0.7], [0.42, 1.6], [-0.42, 1.6]]]], G);
    b.strip([-0.42, 1.42, -1.72], [0.42, 1.42, -1.72], 0.16, [0, 0.4, 1], R);                                                             // 艦橋の窓
    b.box([0, 2.0, -2.9], [0.08, 0.7, 0.08], M); b.box([0.3, 1.9, -3.2], [0.05, 0.45, 0.05], M);
    // 主砲（艦首の下）
    b.box([0, -1.05, 3.6], [0.56, 0.5, 4.4], G); b.box([0, -1.05, 5.6], [0.74, 0.66, 0.5], K);
    b.poly([[-0.2, -1.25, 5.86], [0.2, -1.25, 5.86], [0.2, -0.85, 5.86], [-0.2, -0.85, 5.86]], R);
    // 艦底の芯（弱点）を囲む枠
    b.loft([[0.5, ring(1.0, 8, -1.15, 0.35)], [-1.5, ring(1.0, 8, -1.15, 0.35)]], G, false, false);
    const m = b.mark;
    b.slab([[1.7, 0.1, 1.5], [5.0, 0.25, -1.0], [5.0, 0.25, -2.6], [1.7, 0.1, -3.4]], [0, 0.36, 0], K);                                // 主翼
    for (const [x, y] of [[3.3, -0.25], [4.7, 0.0]]) {                                                                                  // 噴射筒
      b.loft([[-0.6, ring(0.3, 8, y).map(([a, c]) => [a + x, c])], [-1.0, ring(0.5, 8, y).map(([a, c]) => [a + x, c])], [-3.3, ring(0.46, 8, y).map(([a, c]) => [a + x, c])]], G);
      b.poly(ring(0.38, 8, y).map(([a, c]) => [a + x, c, -3.31]), O);
      b.strip([x - 0.3, y + 0.42, -1.2], [x + 0.3, y + 0.42, -1.2], 0.08, [0, 1, 0], R);
    }
    b.box([2.6, 0.55, -0.6], [0.9, 0.36, 1.3], G);                                                                                      // ミサイルの箱
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.poly(ring(0.1, 6).map(([a, c]) => [a + 2.33 + i * 0.27, c + 0.47 + j * 0.2, 0.056]), R);
    b.strip([1.2, 0.56, 4.3], [1.95, 0.9, -1.8], 0.07, [0.4, 1, 0], R); b.strip([1.9, 0.02, 1.2], [1.95, 0.02, -4.6], 0.1, [1, 0.2, 0], R);
    b.strip([2.0, 0.30, 0.9], [4.9, 0.45, -1.1], 0.09, [0, 1, 0], R);
    b.strip([3.6, 0.44, -1.6], [3.6, 0.44, -2.5], 0.22, [0, 1, 0], Wt); b.strip([0.5, 0.62, 3.0], [0.5, 0.86, 0.6], 0.12, [0.2, 1, 0], Wt);
    b.slab([[1.2, 0.6, -4.6], [1.2, 0.6, -6.3], [1.5, 1.9, -6.5], [1.45, 1.9, -5.6]], [0.09, 0, 0], K);                                // 尾翼
    b.mirror(m);
    out.flagship = { v: b.data(), r: 6.5 }; }
  // --- 旗艦の芯（弱点）
  { const b = new Builder(); b.octa([0, 0, 0], [0.62, 0.62, 0.62], P); b.loft([[0.1, ring(0.86, 8)], [-0.1, ring(0.86, 8)]], G, false, false); out.core = { v: b.data(), r: 0.7 }; }
  return out;
}

// ---- 描く
const VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNor; in vec4 aCol;
in vec4 aM0, aM1, aM2, aM3; in vec4 aTint;
uniform mat4 uVP;
out vec3 vN, vW; out vec4 vCol, vTint; out float vZ;
void main(){
  mat4 M = mat4(aM0, aM1, aM2, aM3);
  vec4 w = M * vec4(aPos, 1.0);
  vW = w.xyz; vN = mat3(M) * aNor; vCol = aCol; vTint = aTint;
  gl_Position = uVP * w; vZ = gl_Position.w;
}`;
const FS = (HDR) => HEAD + `
in vec3 vN, vW; in vec4 vCol, vTint; in float vZ; out vec4 o;
uniform sampler2D uScene; uniform vec2 uInv;
uniform vec3 uSun, uSunCol, uMoon, uMoonCol, uTop, uHor, uCam, uFogCol;
uniform float uFog, uExposure, uFade;
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 softclip(vec3 x){ const float a = 0.75; vec3 y = (x - a) / (1.0 - a); return mix(x, a + (1.0 - a) * (1.0 - exp(-y)), step(a, x)); }
void main(){
  float a = textureLod(uScene, gl_FragCoord.xy * uInv, 0.0).a;
#if ${HDR}
  if (a < vZ - (0.03 + 0.012 * vZ)) discard;
#else
  float zs = a > 0.005 ? (1.0 / a - 1.0) * 4.0 : 1e4;
  if (zs < vZ - (0.1 + 0.08 * vZ)) discard;
#endif
  vec3 v = normalize(uCam - vW), n = normalize(vN);
  if (dot(n, v) < 0.0) n = -n;                                   // 裏から見えた面も同じように照らす
  float nv = max(dot(n, v), 0.0);
  vec3 amb = mix(uHor, uTop, n.y * 0.5 + 0.5);
  vec3 col = vCol.rgb * (uSunCol * max(dot(n, uSun), 0.0) + amb * 0.8 + uMoonCol * max(dot(n, uMoon), 0.0));
  // つやのある黒: 空と太陽の映り込み（斜めから見るほど強い）
  vec3 r = reflect(-v, n);
  float fr = 0.03 + 0.55 * pow(1.0 - nv, 5.0);
  vec3 env = mix(uHor, uTop, smoothstep(0.0, 0.6, r.y)) * mix(0.16, 1.0, smoothstep(-0.30, 0.04, r.y));   // 下向きに映るのは暗い地面と水
  col += env * fr * 0.5 + uSunCol * (pow(max(dot(r, uSun), 0.0), 64.0) * 0.35 + pow(max(dot(r, uSun), 0.0), 8.0) * 0.012);
  col += uTop * pow(1.0 - nv, 4.0) * 0.05;
  col = mix(col, vCol.rgb * 1.7 / max(uExposure, 0.6), vCol.a);      // 光る部分（時刻によらず同じ明るさ）
  col = mix(col * uExposure, vec3(2.2, 2.0, 1.6), vTint.a) * vTint.rgb;   // 当たったときの白い光
  col = toSRGB(softclip(col));
  float f = 1.0 - exp(-vZ * vZ * 0.00034 * uFog);
  col = mix(col, uFogCol, f * (1.0 - 0.6 * vCol.a));
  o = vec4(col * uFade, 1.0);
}`;

const INST = 20;
export class Meshes {
  constructor(g) {
    const gl = g.gl; this.g = g; this.gl = gl;
    this.prog = g.program(FS(g.floatRT ? 1 : 0), 'mesh', VS, ['aPos', 'aNor', 'aCol', 'aM0', 'aM1', 'aM2', 'aM3', 'aTint']);
    this.inst = gl.createBuffer(); this.m = {}; this.count = 0;
    const defs = models();
    for (const k in defs) this.add(k, defs[k].v, defs[k].r);
  }
  add(name, v, r) {
    const gl = this.gl, vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    for (let i = 0; i < 5; i++) { gl.enableVertexAttribArray(3 + i); gl.vertexAttribPointer(3 + i, 4, gl.FLOAT, false, INST * 4, i * 16); gl.vertexAttribDivisor(3 + i, 1); }
    gl.bindVertexArray(null);
    this.m[name] = { vao, n: v.length / 10, r, data: new Float32Array(INST * 64), k: 0 };
  }
  begin() { for (const k in this.m) this.m[k].k = 0; this.count = 0; }
  // m: 列優先の 4×4 行列, tint: [r, g, b, 白く光る度合い]
  draw(name, m, tint = [1, 1, 1, 0]) {
    const M = this.m[name]; if (!M) return;
    if ((M.k + 1) * INST > M.data.length) { const d = new Float32Array(M.data.length * 2); d.set(M.data); M.data = d; }
    M.data.set(m, M.k * INST); M.data.set(tint, M.k * INST + 16); M.k++; this.count++;
  }
  flush(ctx, L, cam) {
    if (!this.count) return;
    const gl = this.gl, k = L.k, n = L.night;
    const top = [0, 1, 2].map((i) => k.zen[i] * 1.6 + k.horA[i] * 0.35), hor = [0, 1, 2].map((i) => (k.horA[i] + k.horS[i]) * 0.45 + k.zen[i] * 0.5);
    this.g.use(this.prog, { uVP: ctx.VP, uScene: ctx.scene, uInv: ctx.inv, uSun: L.sun, uSunCol: L.u.uSunColHigh, uMoon: L.u.uMoon, uMoonCol: L.u.uMoonCol.map((v) => v * 3), uTop: top, uHor: hor, uCam: cam.ro, uFogCol: ctx.fogCol, uFog: L.fog, uExposure: L.exposure, uFade: ctx.fade });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    for (const name in this.m) {
      const M = this.m[name]; if (!M.k) continue;
      gl.bufferData(gl.ARRAY_BUFFER, M.data.subarray(0, M.k * INST), gl.DYNAMIC_DRAW);
      gl.bindVertexArray(M.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, M.n, M.k);
    }
    gl.bindVertexArray(null);
  }
}

// 位置 p・前 f・上の目安 up・傾き roll・大きさ s から、列優先の 4×4 行列
export function matrix(p, f, up = [0, 1, 0], roll = 0, s = 1) {
  f = norm(f); let r = norm(cross(up, f)), u = cross(f, r);
  if (roll) { const c = Math.cos(roll), sn = Math.sin(roll); const r2 = [r[0] * c + u[0] * sn, r[1] * c + u[1] * sn, r[2] * c + u[2] * sn]; u = [-r[0] * sn + u[0] * c, -r[1] * sn + u[1] * c, -r[2] * sn + u[2] * c]; r = r2; }
  return [r[0] * s, r[1] * s, r[2] * s, 0, u[0] * s, u[1] * s, u[2] * s, 0, f[0] * s, f[1] * s, f[2] * s, 0, p[0], p[1], p[2], 1];
}
