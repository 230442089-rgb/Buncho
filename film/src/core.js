// core.js — 定数・タイミング・数学ユーティリティ
// 映像は音楽（Inventing Flight / 72.5 BPM, 4/4）の小節グリッドの上に組み立てる。

export const W = 1920, H = 1080, FPS = 30;
export const BPM = 72.5;
export const BEAT = 60 / BPM;        // 0.8276 s
export const BAR = BEAT * 4;         // 3.3103 s
export const T0 = 0.034;             // 曲の最初の拍の位置（秒）
export const DURATION = 142.0;
export const TOTAL_FRAMES = Math.round(DURATION * FPS);

export const bar = (n) => T0 + n * BAR;          // n 小節目の頭（秒）
export const beat = (n) => T0 + n * BEAT;
export const barPos = (t) => (t - T0) / BAR;     // 秒 → 小節位置
export const beatPos = (t) => (t - T0) / BEAT;

// ---- math
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const sat = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = lerp;
export const invLerp = (a, b, x) => (x - a) / (b - a);
export const remap = (x, a, b, c, d) => c + (d - c) * sat((x - a) / (b - a));
export const smoothstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const fract = (x) => x - Math.floor(x);
export const TAU = Math.PI * 2;

// 区間 [a,b] で 0→1（イージング付き）
export const prog = (t, a, b, e = (x) => x) => e(sat((t - a) / (b - a)));
// [a,b] で立ち上がり、[c,d] で消える 0..1 の台形
export const window4 = (t, a, b, c, d) => Math.min(smoothstep(a, b, t), 1 - smoothstep(c, d, t));
// 拍に合わせた減衰パルス（t0 で 1、tau で 1/e）
export const pulse = (t, t0, tau = 0.25) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));

// ---- easing
export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inQuint: (t) => t * t * t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  // 減衰振動するバネ（オーバーシュートして落ち着く）
  spring: (t, freq = 3.2, damp = 5.5) => 1 - Math.exp(-damp * t) * Math.cos(freq * TAU * t * 0.5),
};

// ---- 決定的な乱数
export function mulberry32(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
  f.gauss = () => { // Box–Muller
    const u = Math.max(1e-9, f()), v = f();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

// ---- 色（sRGB hex → linear RGB 配列）
export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export function hex(h, mul = 1) {
  const n = parseInt(h.replace('#', ''), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255) * mul, srgbToLinear(((n >> 8) & 255) / 255) * mul, srgbToLinear((n & 255) / 255) * mul];
}

// 全編で使う色
export const PAL = {
  ink: '#05060a',        // 墨
  night: '#0a0d18',
  paper: '#f4efe6',      // 紙の白
  shu: '#ff4b2b',        // 朱（文鳥のくちばしの色）
  shuDeep: '#d9301a',
  gold: '#f2c57c',
  ai: '#27408b',         // 藍
  teal: '#58c9c4',
  gray: '#8b8f9c',
};

// ---- ベクトル・行列（列優先 mat4 を Float32Array で）
export const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

// カメラ: 位置 ro・注視点 ta・ロール → 3x3 の基底（右, 上, 前）を列で返す
export function camBasis(ro, ta, roll = 0) {
  const f = v3.norm(v3.sub(ta, ro));
  const up0 = [Math.sin(roll), Math.cos(roll), 0];
  const r = v3.norm(v3.cross(f, up0));
  const u = v3.cross(r, f);
  return [r[0], r[1], r[2], u[0], u[1], u[2], f[0], f[1], f[2]];
}

export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
export function lookAt(eye, target, up = [0, 1, 0]) {
  const z = v3.norm(v3.sub(eye, target)), x = v3.norm(v3.cross(up, z)), y = v3.cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -v3.dot(x, eye), -v3.dot(y, eye), -v3.dot(z, eye), 1]);
}
export function mat4mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}

// Catmull-Rom（等間隔キー）で滑らかに補間
export function catmull(keys, u) {
  const n = keys.length;
  const x = clamp(u, 0, 1) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x)), t = x - i;
  const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(n - 1, i + 2)];
  const out = [];
  for (let k = 0; k < p1.length; k++) {
    const a = 2 * p1[k], b = p2[k] - p0[k], c = 2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k], d = -p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k];
    out.push(0.5 * (a + b * t + c * t * t + d * t * t * t));
  }
  return out;
}
