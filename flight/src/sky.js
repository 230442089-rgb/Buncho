// sky.js — 一日の光。太陽の高さごとの空の色見本（映像と同じ表）と、時刻 → 光の状態。
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const sat = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;
export const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

//         高さ    天頂                    太陽側の地平            反対側の地平            光芒                  太陽光（地表）        夜    中間（太陽側）          中間（反対側）
const SKY_KEYS = [
  [-0.60, [0.0030, 0.0058, 0.0165], [0.0075, 0.0120, 0.0270], [0.0070, 0.0110, 0.0260], [0, 0, 0],            [0, 0, 0],            1.00, [0.0050, 0.0085, 0.0210], [0.0050, 0.0085, 0.0210]],
  [-0.30, [0.0034, 0.0068, 0.0200], [0.0260, 0.0150, 0.0240], [0.0075, 0.0120, 0.0280], [0.012, 0.004, 0.002], [0, 0, 0],            0.95, [0.0070, 0.0110, 0.0260], [0.0055, 0.0095, 0.0240]],
  [-0.20, [0.0055, 0.0135, 0.0480], [0.2600, 0.0750, 0.0300], [0.0120, 0.0200, 0.0520], [0.10, 0.03, 0.01],    [0, 0, 0],            0.60, [0.0300, 0.0380, 0.0700], [0.0100, 0.0180, 0.0500]],
  [-0.12, [0.0110, 0.0300, 0.1050], [0.7400, 0.2500, 0.0650], [0.0420, 0.0480, 0.1000], [0.30, 0.10, 0.03],    [0, 0, 0],            0.22, [0.1300, 0.1300, 0.1500], [0.0320, 0.0450, 0.1050]],
  [-0.05, [0.0220, 0.0600, 0.1900], [1.2500, 0.5200, 0.1500], [0.1200, 0.1050, 0.1700], [0.60, 0.25, 0.07],    [0.06, 0.02, 0.006],  0.03, [0.3400, 0.2900, 0.2700], [0.0800, 0.0950, 0.1800]],
  [0.00,  [0.0360, 0.0950, 0.2800], [1.6000, 0.8000, 0.2800], [0.2100, 0.1900, 0.2700], [1.00, 0.48, 0.15],    [1.25, 0.42, 0.13],   0.00, [0.5600, 0.4500, 0.3800], [0.1400, 0.1600, 0.2700]],
  [0.06,  [0.0560, 0.1450, 0.4000], [1.4000, 0.9800, 0.5200], [0.2800, 0.3300, 0.4800], [1.00, 0.66, 0.32],    [2.70, 1.50, 0.66],   0.00, [0.6200, 0.5800, 0.5600], [0.2000, 0.2600, 0.4300]],
  [0.16,  [0.0760, 0.1900, 0.5200], [1.0000, 0.9800, 0.8800], [0.4000, 0.5200, 0.7400], [0.72, 0.62, 0.47],    [3.50, 2.80, 1.95],   0.00, [0.4200, 0.5200, 0.7000], [0.2600, 0.3700, 0.6200]],
  [0.45,  [0.0860, 0.2150, 0.6000], [0.6800, 0.8100, 0.9800], [0.5000, 0.6600, 0.9200], [0.45, 0.43, 0.39],    [4.00, 3.70, 3.20],   0.00, [0.3000, 0.4400, 0.7600], [0.2600, 0.4000, 0.7400]],
];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function skyAt(e) {
  const K = SKY_KEYS;
  let i = 0; while (i < K.length - 2 && e > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], t = clamp((e - a[0]) / (b[0] - a[0]), 0, 1), u = t * t * (3 - 2 * t);
  return { zen: mix3(a[1], b[1], u), horS: mix3(a[2], b[2], u), horA: mix3(a[3], b[3], u), glow: mix3(a[4], b[4], u), sun: mix3(a[5], b[5], u), night: a[6] + (b[6] - a[6]) * u, midS: mix3(a[7], b[7], u), midA: mix3(a[8], b[8], u) };
}

// 不等間隔のキーを Catmull-Rom（Hermite）でなめらかに補間
export function keyed(K, t) {
  const n = K.length;
  if (t <= K[0][0]) return K[0][1];
  if (t >= K[n - 1][0]) return K[n - 1][1];
  let i = 0; while (t > K[i + 1][0]) i++;
  const [t1, p1] = K[i], [t2, p2] = K[i + 1];
  const [t0, p0] = K[Math.max(0, i - 1)], [t3, p3] = K[Math.min(n - 1, i + 2)];
  const m1 = i > 0 ? (p2 - p0) / (t2 - t0) : (p2 - p1) / (t2 - t1), m2 = i + 2 < n ? (p3 - p1) / (t3 - t1) : (p2 - p1) / (t2 - t1);
  const h = t2 - t1, u = (t - t1) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * h * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * h * m2;
}

export const SUN_AZ = -0.22;      // 日の出の方角（+z から左へ）
export const sunDir = (elev, az) => [Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)];

// 一日の進み d（0 = 日の出, 1 = 夜ふけ）ごとの太陽の高さ・雲の量
const SUN_E = [[0, 0.030], [0.06, 0.075], [0.16, 0.17], [0.40, 0.44], [0.60, 0.20], [0.70, 0.085], [0.765, 0.022], [0.81, -0.035], [0.86, -0.105], [0.915, -0.21], [0.96, -0.36], [1.0, -0.56]];
const COVER = [[0, 0.46], [0.2, 0.44], [0.4, 0.40], [0.6, 0.42], [0.72, 0.46], [0.84, 0.40], [0.92, 0.28], [1.0, 0.20]];
export const MOON = norm([-0.60, 0.33, -0.73]);      // 夜の湖へ帰る向きの、少し左上に月が出る

// 時刻 d → 描画に渡す光の状態。pre（0..1）: 夜ふけ（d = 1）から次の日の出（d = 0）へ戻っていく途中（おさんぽで一日をくり返すため）
export function daylight(d, clock = 0, pre = 0) {
  d = sat(d);
  const p = pre > 0 ? pre * pre * (3 - 2 * pre) : 0;
  const e = p > 0 ? lerp(keyed(SUN_E, 1), keyed(SUN_E, 0), Math.pow(p, 1.6)) : keyed(SUN_E, d);
  const az = p > 0 ? lerp(SUN_AZ + 1.47, SUN_AZ, p) : SUN_AZ + 1.22 * sat(d / 0.765) + 0.25 * sat((d - 0.765) / 0.2);
  const sun = sunDir(e, az);
  const k = skyAt(e), kh = skyAt(e + 0.085);
  const tw = Math.exp(-Math.pow((e + 0.06) / 0.16, 2));          // 薄明のあいだは光が地平線に寄る
  const night = smoothstep(-0.12, -0.45, e);
  const moonAmt = 1 + 1.5 * night;
  const sunDisk = mix3([0, 0, 0], [1.0, 0.72, 0.42], clamp((e + 0.02) / 0.05, 0, 1)).map((v, i) => v * (1 + [0, 0.25, 0.6][i] * clamp(e / 0.3, 0, 1)));
  const a = 0.2 + clock * 0.004 + d * 0.9;                        // 星空の回転
  const ax = norm([0.25, 0.62, -0.74]), c = Math.cos(a), s = Math.sin(a), ic = 1 - c;
  const starM = [c + ax[0] * ax[0] * ic, ax[1] * ax[0] * ic + ax[2] * s, ax[2] * ax[0] * ic - ax[1] * s, ax[0] * ax[1] * ic - ax[2] * s, c + ax[1] * ax[1] * ic, ax[2] * ax[1] * ic + ax[0] * s, ax[0] * ax[2] * ic + ax[1] * s, ax[1] * ax[2] * ic - ax[0] * s, c + ax[2] * ax[2] * ic];
  return {
    d, e, az, sun, night, k,
    exposure: 1 + 1.9 * night,
    fog: lerp(0.72, 1.0, night),
    mist: p > 0 ? lerp(0.35, 1, p) : 1 - smoothstep(0.02, 0.2, d) + 0.35 * smoothstep(0.74, 0.92, d),
    cover: p > 0 ? lerp(keyed(COVER, 1), keyed(COVER, 0), p) : keyed(COVER, d),
    snow: 2.3,
    starM,
    u: {
      uSun: sun, uMoon: MOON, uZen: k.zen, uHorS: k.horS, uHorA: k.horA, uMidS: k.midS, uMidA: k.midA, uGlow: k.glow,
      uSunCol: k.sun, uSunColHigh: kh.sun, uSunDisk: sunDisk,
      uMoonCol: [0.030 * k.night * moonAmt, 0.042 * k.night * moonAmt, 0.075 * k.night * moonAmt],
      uMoonDisk: [1.0 * k.night, 0.96 * k.night, 0.86 * k.night],
      uNight: k.night, uHorFall: 3.2 + 3.0 * tw, uHorPow: 1.5 + 2.0 * tw, uStarM: starM,
    },
  };
}

// 画面に重ねる物（ユリアや輪）のための、おおよその「霧の色」と「環境光の色」（表示用の値 0..1）
const toS = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const clip = (x) => (x < 0.75 ? x : 0.75 + 0.25 * (1 - Math.exp(-(x - 0.75) / 0.25)));
export const display = (c, exposure = 1) => c.map((v) => toS(clip(Math.max(0, v * exposure))));
export function ambientTint(L) {
  const k = L.k, n = L.night;
  const sunW = sat(L.e / 0.12 + 0.35);
  // 空の光 + 太陽の光 + 月の光 を、白い物に当てたときの色
  const lin = [0, 1, 2].map((i) => k.zen[i] * 1.5 + k.horA[i] * 0.5 + k.sun[i] * 0.16 * sunW + [0.030, 0.042, 0.075][i] * n * 2.4);
  return display(lin, L.exposure);
}
export function fogTint(L) {
  const k = L.k;
  return display([0, 1, 2].map((i) => 0.58 * (0.6 * k.horA[i] + 0.4 * k.horS[i]) * 0.55 + 0.42 * (k.zen[i] * 1.6 + k.midA[i] * 0.3)), L.exposure);
}
