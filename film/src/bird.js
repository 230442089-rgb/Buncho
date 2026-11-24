// bird.js — 文鳥（距離関数でモデリングし、レイマーチングで描く）と、とまる枝
// 体・頭・くちばし・目・翼・尾・脚を、時刻だけで決まるポーズ（リグ）で動かす。
import { W, H, sat, smoothstep, ease, lerp, TAU, clamp } from './core.js';

// BIRD = 0 は枝だけの軽い版（枝の帯に使う）、1 は鳥も含む版（鳥のまわりの矩形に使う）
const FS_BIRD = (BIRD) => `#define BIRD ${BIRD}\n` + /* glsl */ `
uniform vec3 uRo; uniform mat3 uCam; uniform float uFocal;
uniform vec3 uBP; uniform mat3 uBR; uniform vec3 uBS; uniform mat3 uHR;
uniform float uBeak, uBlink, uFluff, uWing, uFlap, uTail, uBend, uBx, uGrow, uBird;
uniform vec3 uHipL, uHipR, uFootL, uFootR;
uniform vec3 uRimDir, uKeyDir, uRimCol, uKeyCol, uAmbUp, uAmbDn;
out vec4 o;

float sdEll(vec3 p, vec3 r){ float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdRCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
  vec3 ba = b - a; float l2 = dot(ba, ba), rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba), z = y - l2; vec3 xx = pa * l2 - ba * y; float x2 = dot(xx, xx), y2 = y * y * l2, z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
const vec3 C0 = vec3(0.0, -0.33, 0.0);       // つぶれ・のびの中心（足もと）
const vec3 NECK = vec3(0.0, 0.20, 0.06);
const vec3 HEADC = vec3(0.0, 0.36, 0.13);
const vec3 EYE = vec3(0.1662, 0.3933, 0.2504);
const vec3 BEAKH = vec3(0.0, 0.335, 0.30);

// 部位ごとの距離（最後に呼んだ点のもの。色分けに使う）
float gBody, gHead, gBeak, gEye, gWing, gTail, gLeg, gBranch, gBud;
vec3 gQ, gQh, gQw;

// 枝: x 方向にのびる管。鳥の重みで uBx のあたりがしなる
float branchY(float x){ return -0.47 + 0.035 * x + 0.016 * x * x - uBend * exp(-(x - uBx) * (x - uBx) / 1.6); }
float branchR(float x){ return 0.050 + 0.011 * x; }
float mapBranch(vec3 p){
  float tip = -1.0 + 4.3 * (1.0 - uGrow);                      // 枝は右から伸びてくる
  vec3 q = p; q.y -= branchY(max(p.x, tip)); q.z -= 0.045 * p.x;
  float d = length(vec2(max(tip - p.x, 0.0), length(q.yz))) - branchR(max(p.x, tip)) * sat((p.x - tip) * 3.0 + 0.35);
  // 小枝と芽（枝と一緒にしなる）
  vec3 t1 = vec3(1.72, branchY(1.72), 0.077), t2 = vec3(-0.36, branchY(-0.36), -0.016), t3 = vec3(2.2, branchY(2.2), 0.1);
  float g1 = sat((uGrow - 0.45) * 3.5), g2 = sat((uGrow - 0.75) * 4.0), g3 = sat((uGrow - 0.25) * 3.5);
  float tw = min(sdCap(p, t1, t1 + vec3(-0.30, 0.52, -0.10) * g1, 0.017 * sat(g1 * 4.0)) + 0.03 * step(g1, 0.0), min(sdCap(p, t2, t2 + vec3(-0.34, 0.30, 0.16) * g2, 0.014 * sat(g2 * 4.0)) + 0.03 * step(g2, 0.0), sdCap(p, t3, t3 + vec3(0.16, 0.62, 0.18) * g3, 0.02 * sat(g3 * 4.0)) + 0.03 * step(g3, 0.0)));
  gBranch = smin(d, tw, 0.03);
  vec3 b1 = t1 + vec3(-0.30, 0.52, -0.10) * g1, b2 = t2 + vec3(-0.34, 0.30, 0.16) * g2, b3 = t3 + vec3(0.16, 0.62, 0.18) * g3, b4 = t1 + vec3(-0.16, 0.28, -0.05) * g1;
  float s1 = sat((uGrow - 0.72) * 4.0), s2 = sat((uGrow - 0.92) * 12.0);
  gBud = min(min(sdEll(p - b1 - vec3(-0.012, 0.03, 0.0), vec3(0.028, 0.046, 0.028) * s1 + 1e-4), sdEll(p - b2 - vec3(-0.015, 0.025, 0.0), vec3(0.025, 0.040, 0.025) * s2 + 1e-4)),
             min(sdEll(p - b3 - vec3(0.0, 0.035, 0.0), vec3(0.030, 0.050, 0.030) * s1 + 1e-4), sdEll(p - b4 - vec3(-0.03, 0.01, 0.02), vec3(0.022, 0.034, 0.022) * s1 + 1e-4)));
  return min(gBranch, gBud);
}
#if BIRD
float mapBird(vec3 p){
  vec3 q = (p - uBP) * uBR;
  q = (q - C0) / uBS + C0;
  float sc = min(uBS.x, min(uBS.y, uBS.z));
  float fl = 1.0 + 0.13 * uFluff;
  gBody = smin(sdEll(q - vec3(0.0, 0.0, 0.04), vec3(0.29, 0.33, 0.30) * fl), sdEll(q - vec3(0.0, -0.10, -0.22), vec3(0.21, 0.22, 0.30) * fl), 0.18);
  vec3 qh = (q - NECK) * uHR + NECK;
  gHead = length(qh - HEADC) - 0.235 * (1.0 + 0.05 * uFluff);
  // くちばし（上下に分かれて開く）
  vec3 qu = qh - BEAKH, ql = qu;
  qu.yz = rot(-uBeak * 0.20) * qu.yz; ql.yz = rot(uBeak * 0.52) * ql.yz;
  vec3 pn = normalize(vec3(0.0, 1.0, 0.24));
  float cu = max(sdRCone(qu, vec3(0.0, 0.012, 0.0), vec3(0.0, -0.045, 0.225), 0.098, 0.016), -(dot(qu, pn) + 0.024));
  float cl = max(sdRCone(ql, vec3(0.0, 0.012, 0.0), vec3(0.0, -0.045, 0.225), 0.098, 0.016), dot(ql, pn) + 0.024);
  gBeak = min(cu, cl);
  vec3 qe = vec3(abs(qh.x), qh.yz);
  gEye = length(qe - EYE) - 0.034;
  // 翼（たたむと体に沿い、ひらくと肩を軸に横へ）
  vec3 qw = vec3(abs(q.x), q.yz) - vec3(0.20, 0.10, 0.02);
  qw.xy = rot(-uWing * (1.25 + uFlap)) * qw.xy;
  qw.xz = rot(-uWing * 0.25) * qw.xz;
  qw.yz = rot(uWing * 0.42) * qw.yz;
  qw -= vec3(0.062, -0.13, -0.12);
  qw.yz = rot(0.45) * qw.yz;
  gWing = sdEll(qw - vec3(0.0, -0.10 * uWing, 0.0), vec3(0.05 - 0.02 * uWing, 0.21 * (1.0 + 1.75 * uWing), 0.31 - 0.07 * uWing));
  vec3 qt = q - vec3(0.0, -0.24, -0.42);
  qt.yz = rot(0.55 - uTail) * qt.yz;
  gTail = sdEll(qt - vec3(0.0, 0.0, -0.25), vec3(0.085, 0.028, 0.27));
  gQ = q; gQh = qh; gQw = qw;
  float d = smin(gBody, gHead, 0.13);
  d = smin(d, gWing, 0.035);
  d = smin(d, gTail, 0.06);
  d = min(d, min(gBeak, gEye));
  // 脚は世界座標で（足は枝をつかんだまま）
  gLeg = min(min(sdCap(p, uHipL, uFootL, 0.017), sdCap(p, uHipR, uFootR, 0.017)),
             min(sdEll(p - uFootL - vec3(0.0, 0.004, 0.0), vec3(0.036, 0.024, 0.060)), sdEll(p - uFootR - vec3(0.0, 0.004, 0.0), vec3(0.036, 0.024, 0.060))));
  return mix(8.0, min(d * sc, gLeg), uBird);
}
float map(vec3 p){ return min(mapBird(p), mapBranch(p)); }
#else
float map(vec3 p){ gBody = gHead = gBeak = gEye = gWing = gTail = gLeg = 9.0; gQ = gQh = gQw = p; return mapBranch(p); }
#endif

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = uRo, rd = normalize(uCam * vec3(uv, uFocal));
  float px = 1.0 / (uFocal * uRes.y);
  // ---- レイマーチング。かすめた光線のために「いちばん近づいた点」も覚えておく（輪郭をなめらかにする）
  float t = 2.0, tNear = 2.0, mNear = 1e9; bool hit = false;
  for (int i = 0; i < 80; i++){
    float d = map(ro + rd * t);
    float m = d / t;
    if (m < mNear){ mNear = m; tNear = t; }
    if (d < 0.0006 * t){ hit = true; break; }
    t += d * 0.86;
    if (t > 9.0) break;
  }
  float alpha = hit ? 1.0 : sat(1.0 - mNear / (1.6 * px));
  if (!hit) t = tNear;
  vec3 p = ro + rd * t;
  // ---- 法線（4 点の四面体差分をループで）
  vec3 n = vec3(0.0);
  for (int i = 0; i < 4; i++){
    vec3 e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
    n += e * map(p + 0.0012 * e);
  }
  n = normalize(n);
  // ---- 影と遮蔽
  float ao = 0.0, sca = 1.0;
  for (int i = 1; i <= 5; i++){ float h = 0.018 * float(i); ao += (h - map(p + n * h)) * sca; sca *= 0.72; }
  ao = sat(1.0 - 3.2 * ao);
  float sh = 1.0, ts = 0.02;
  for (int i = 0; i < 26; i++){ float h = map(p + n * 0.004 + uKeyDir * ts); sh = min(sh, 9.0 * h / ts); ts += clamp(h, 0.012, 0.12); if (sh < 0.01 || ts > 1.6) break; }
  sh = sat(sh);
  float dAll = map(p);               // 部位ごとの距離を、当たった点で確定させる
  // ---- 色
  vec3 q = gQ, qh = gQh; vec3 qe = vec3(abs(qh.x), qh.yz);
  float feather = gnoise(q * 34.0) * 0.5 + 0.5, fine = gnoise(q * 95.0);
  // 体: 背と胸は灰青、腹は淡い桃色、尾の下は白
  vec3 gray = mix(vec3(0.255, 0.285, 0.345), vec3(0.33, 0.36, 0.42), feather);
  float belly = smoothstep(-0.02, 0.22, -q.y * 0.95 + q.z * 0.42 - 0.07 + 0.03 * fine);
  vec3 bodyCol = mix(gray, vec3(0.66, 0.52, 0.49), belly * smoothstep(-0.34, -0.05, q.z));
  bodyCol = mix(bodyCol, vec3(0.80, 0.79, 0.77), smoothstep(-0.20, -0.36, q.z) * smoothstep(-0.10, -0.24, q.y));
  // 頭: 黒い頭巾に、白い頬
  float cheek = smoothstep(0.012, -0.012, sdEll(qe - vec3(0.2267, 0.300, 0.150), vec3(0.09, 0.118, 0.142)) + 0.012 * fine);
  vec3 headCol = mix(vec3(0.018, 0.018, 0.022), vec3(0.86, 0.86, 0.84), cheek);
  float ring = smoothstep(0.060, 0.052, distance(qe, EYE));
  headCol = mix(headCol, vec3(0.82, 0.085, 0.06), ring);
  vec3 alb = mix(bodyCol, headCol, smoothstep(-0.035, 0.035, gBody - gHead - 0.02 * fine));
  // 翼・尾
  float bars = 0.86 + 0.14 * sin(gQw.z * 46.0 + gQw.y * 20.0 + 2.0 * feather);
  alb = mix(alb, mix(vec3(0.20, 0.225, 0.275), vec3(0.27, 0.295, 0.35), feather) * bars, smoothstep(0.02, -0.01, gWing - min(gBody, gHead)));
  alb = mix(alb, vec3(0.022, 0.022, 0.028), smoothstep(0.03, -0.02, gTail - gBody));
  float isBeak = step(gBeak, 0.004), isEye = step(gEye, 0.003), isLeg = step(gLeg, 0.003) * uBird, isBr = step(gBranch, 0.004), isBud = step(gBud, 0.004);
  float bz = sat((qh.z - 0.30) / 0.22);
  alb = mix(alb, mix(vec3(0.80, 0.075, 0.065), vec3(0.93, 0.50, 0.47), smoothstep(0.15, 1.0, bz)), isBeak);
  alb = mix(alb, mix(vec3(0.012), vec3(0.75, 0.10, 0.08), uBlink), isEye);
  alb = mix(alb, vec3(0.70, 0.36, 0.33), isLeg);
  float bark = vnoise(vec2(p.x * 3.0, atan(p.y - branchY(p.x), p.z) * 2.4)) ;
  alb = mix(alb, mix(vec3(0.050, 0.034, 0.026), vec3(0.105, 0.074, 0.055), bark) * (0.8 + 0.4 * vnoise(p.xy * vec2(40.0, 9.0))), isBr);
  alb = mix(alb, vec3(0.34, 0.085, 0.07), isBud);
  float soft = (1.0 - isBeak) * (1.0 - isEye) * (1.0 - isLeg) * (1.0 - isBr) * (1.0 - isBud);
  // 羽毛のこまかな起伏
  n = normalize(n + soft * 0.10 * vec3(gnoise(q * 60.0), gnoise(q * 60.0 + 7.1), gnoise(q * 60.0 + 13.7)));
  // ---- 光: やわらかい正面光 ＋ 背後からの朝日（輪郭が光る）
  vec3 v = -rd;
  float wrap = mix(0.0, 0.42, soft);
  float dif = sat((dot(n, uKeyDir) + wrap) / (1.0 + wrap));
  vec3 lin = uKeyCol * dif * mix(1.0, sh, 0.85) + mix(uAmbDn, uAmbUp, 0.5 + 0.5 * n.y) * ao;
  float fres = pow(1.0 - sat(dot(n, v)), 2.6);
  float back = sat(dot(n, uRimDir) * 0.75 + 0.35);
  vec3 col = alb * lin;
  col += uRimCol * fres * back * (0.35 + 0.65 * soft) * (0.25 + 0.75 * ao) * mix(vec3(1.0), 0.35 + alb * 1.3, 0.6);    // 羽毛を透かす逆光
  vec3 hv = normalize(uKeyDir + v);
  col += uKeyCol * (isEye * (1.0 - uBlink) * 2.6 * pow(sat(dot(n, hv)), 140.0) + isBeak * 0.30 * pow(sat(dot(n, hv)), 28.0));
  col += uRimCol * isEye * (1.0 - uBlink) * 0.7 * pow(sat(dot(n, normalize(uRimDir + v))), 60.0);
  o = vec4(col * alpha, alpha);
}`;

const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 1, 0, s, 0, c]; };
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, s, 0, -s, c]; };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, -s, c, 0, 0, 0, 1]; };
// 列優先 3x3 の積 a*b
function mul3(a, b) {
  const o = new Array(9);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
  return o;
}
const apply3 = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export const BIRD_CAM = { ro: [-0.36, 0.18, -4.05], f: [0.0, -0.004, 1], focal: 1.95 };
export const PERCH_X = 0.52;                // とまる位置
export const branchY = (x, bend = 0, bx = PERCH_X) => -0.47 + 0.035 * x + 0.016 * x * x - bend * Math.exp(-(x - bx) * (x - bx) / 1.6);
export const branchTop = (x, bend = 0, bx = PERCH_X) => branchY(x, bend, bx) + 0.050 + 0.011 * x;

export const POSE0 = {
  pos: [PERCH_X, 0, 0], yaw: -2.25, pitch: 0, roll: 0, squash: 1, headYaw: 0, headPitch: 0, headRoll: 0,
  beak: 0, blink: 0, fluff: 0.25, wing: 0, flap: 0, tail: 0, bend: 0.03, air: 0, lift: 0, grow: 1, bird: 1, perchX: PERCH_X, fly: false, landBlend: 0,
};

export class Bird {
  constructor(g) { this.g = g; this.progBird = g.program(FS_BIRD(1), 'bird'); this.progBranch = g.program(FS_BIRD(0), 'branch'); }
  // pose: 枝の上の位置（pos[0]）と持ち上がり lift、向き、つぶれ、頭、くちばし…（fly のときは pos が足もとの位置）。light: 光の色
  // 頭の中の点（頭の座標）が画面のどこに来るか。くちばしの先から文字を出すのに使う
  locate(pose, headPoint = [0, 0.292, 0.52], cam = BIRD_CAM) {
    const P = { ...POSE0, ...pose };
    const sy = P.squash, sxz = 1 / Math.sqrt(Math.max(sy, 0.2));
    const R = mul3(mul3(rotY(P.yaw), rotX(P.pitch)), rotZ(P.roll)), HR = mul3(mul3(rotY(P.headYaw), rotX(P.headPitch)), rotZ(P.headRoll));
    const feetY = branchTop(P.pos[0], P.bend, P.perchX) + 0.012;
    const BP = P.fly ? [P.pos[0], P.pos[1] + 0.45, P.pos[2]] : [P.pos[0], feetY + 0.45 + P.lift, P.pos[2]];
    const NECK = [0, 0.20, 0.06];
    const h = apply3(HR, [headPoint[0] - NECK[0], headPoint[1] - NECK[1], headPoint[2] - NECK[2]]);
    const q = [h[0] + NECK[0], h[1] + NECK[1], h[2] + NECK[2]];
    const w = apply3(R, [q[0] * sxz, (q[1] + 0.33) * sy - 0.33, q[2] * sxz]);
    const wp = [BP[0] + w[0], BP[1] + w[1], BP[2] + w[2]];
    const f = nrm(cam.f), r = nrm([f[2], 0, -f[0]]), u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    const d = [wp[0] - cam.ro[0], wp[1] - cam.ro[1], wp[2] - cam.ro[2]], cz = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    return [W / 2 + ((d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / cz) * cam.focal * H, H / 2 - ((d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / cz) * cam.focal * H];
  }
  draw(env, pose, light = {}, cam = BIRD_CAM) {
    const g = this.g, gl = g.gl;
    const P = { ...POSE0, ...pose };
    const sy = P.squash, sxz = 1 / Math.sqrt(Math.max(sy, 0.2));
    const R = mul3(mul3(rotY(P.yaw), rotX(P.pitch)), rotZ(P.roll));
    const HR = mul3(mul3(rotY(P.headYaw), rotX(P.headPitch)), rotZ(P.headRoll));
    const feetY = (x) => branchTop(x, P.bend, P.perchX) + 0.012;
    // 体の中心は足もとから 0.45 上（脚 0.12 ＋ 体の下端まで 0.33）
    const BP = P.fly ? [P.pos[0], P.pos[1] + 0.45, P.pos[2]] : [P.pos[0], feetY(P.pos[0]) + 0.45 + P.lift, P.pos[2]];
    const S = [sxz, sy, sxz];
    const toWorld = (l) => { const w = apply3(R, [l[0] * S[0], (l[1] + 0.33) * S[1] - 0.33, l[2] * S[2]]); return [BP[0] + w[0], BP[1] + w[1], BP[2] + w[2]]; };
    const hipL = toWorld([0.085, -0.30, 0.02]), hipR = toWorld([-0.085, -0.30, 0.02]);
    // 足: とまっているときは枝をつかむ。空中では体の下にたたむ
    const right = apply3(R, [1, 0, 0]);
    const px0 = P.fly ? P.perchX : P.pos[0];
    const plant = (sgn) => { const x = px0 + right[0] * 0.085 * sgn; return [x, feetY(x), 0.045 * x + right[2] * 0.085 * sgn * 0.5]; };
    const tuck = (hip) => { const f = apply3(R, [0, -0.10, 0.07]); return [hip[0] + f[0], hip[1] + f[1], hip[2] + f[2]]; };
    const mixv = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    const a = P.fly ? 1 - sat(P.landBlend || 0) : sat(P.air);
    const footL = mixv(plant(1), tuck(hipL), a), footR = mixv(plant(-1), tuck(hipR), a);
    const f = nrm(cam.f), r = nrm([f[2], 0, -f[0]]), u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    const U = {
      uRo: cam.ro, uCam: [r[0], r[1], r[2], u[0], u[1], u[2], f[0], f[1], f[2]], uFocal: cam.focal,
      uBP: BP, uBR: R, uBS: S, uHR: HR, uBeak: P.beak, uBlink: P.blink, uFluff: P.fluff, uWing: P.wing, uFlap: P.flap, uTail: P.tail,
      uBend: P.bend, uBx: P.perchX, uGrow: P.grow, uBird: P.bird,
      uHipL: hipL, uHipR: hipR, uFootL: footL, uFootR: footR,
      uRimDir: nrm(light.rimDir || [0.60, 0.42, 0.68]), uKeyDir: nrm(light.keyDir || [-0.40, 0.55, -0.74]),
      uRimCol: light.rim || [2.6, 1.55, 0.80], uKeyCol: light.key || [0.95, 0.93, 0.98], uAmbUp: light.ambUp || [0.30, 0.34, 0.46], uAmbDn: light.ambDn || [0.16, 0.13, 0.13],
    };
    // ---- 画面上の範囲を求めて、必要なところだけ描く（重いシェーダーなので）
    const proj = (w) => { const d = [w[0] - cam.ro[0], w[1] - cam.ro[1], w[2] - cam.ro[2]]; const cz = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; return [W / 2 + ((d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / cz) * cam.focal * H, H / 2 + ((d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / cz) * cam.focal * H, cz]; };
    let y0 = 1e9, y1 = -1e9;
    for (let x = -1.2; x <= 3.4; x += 0.4) { const lo = proj([x, branchY(x, P.bend, P.perchX) - 0.09, 0.045 * x]), hi = proj([x, branchY(x, P.bend, P.perchX) + 0.12, 0.045 * x]); y0 = Math.min(y0, lo[1]); y1 = Math.max(y1, hi[1]); }
    y1 = Math.max(y1, proj([2.4, branchY(2.4) + 0.75, 0.3])[1], proj([0.95, branchY(1.25) + 0.62, 0])[1]);
    const band = [clamp(Math.floor(y0) - 4, 0, H), clamp(Math.ceil(y1) + 4, 0, H)];
    let box = null;
    if (P.bird > 0) {
      const c = proj(BP), rad = ((0.66 + 0.62 * Math.max(P.wing, 0)) / Math.max(c[2], 0.5)) * cam.focal * H + 6;
      box = [clamp(Math.floor(c[0] - rad), 0, W), clamp(Math.floor(c[1] - rad * 0.98), 0, H), clamp(Math.ceil(c[0] + rad), 0, W), clamp(Math.ceil(c[1] + rad * 1.05), 0, H)];
    }
    gl.enable(gl.SCISSOR_TEST);
    const rect = (x0, yy0, x1, yy1, prog) => { if (x1 - x0 < 1 || yy1 - yy0 < 1) return; gl.scissor(x0, yy0, x1 - x0, yy1 - yy0); g.draw(prog, U, undefined, 'premul'); };
    rect(0, band[0], W, band[1], this.progBranch);                 // 枝の帯（軽い版）
    if (box) rect(box[0], box[1], box[2], box[3], this.progBird);    // 鳥のまわり（枝も含めて描き直すので、前後関係は正しく出る）
    gl.disable(gl.SCISSOR_TEST);
  }
}
