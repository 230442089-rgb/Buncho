// core.js — 「気合い」の時間割。数学の道具は film/src/core.js のものをそのまま使う。
//
// 時間は音楽から決めている（tools/kiai_audio.py が同じ数字で音を並べる）:
//   "Rulers of Our Lands"（Rafael Krux, 120 BPM。4 秒で 1 フレーズ）
//   0:10–1:02  曲の 28.05 → 80.04 秒。静かな低音から、じわじわ積み上がる（最初の被曝 → 気合い）
//   1:02–1:17  曲が息を止める場所で、二度目の事故。音楽なし
//   1:17–2:05  曲の 84.04 → 132.06 秒。全合奏（大絶叫 → 止めに行く）。最後の和音が 2:05
export * from '../../film/src/core.js';

export const DURATION = 152.0;
export const TOTAL_FRAMES = Math.round(DURATION * 30);

// 前半のフレーズの頭（P(0) = 0:10、P(5) = 0:30 = 最初の絶叫、P(13) = 1:02 = 二度目の閃光）
export const P = (i) => 10.0 + 4.0 * i;
// 後半のフレーズの頭（Q(0) = 1:17 = 「気合いだ」の一発目、Q(12) = 2:05 = 最後の和音）
export const Q = (i) => 77.01 + 4.0 * i;

export const T = {
  flash1: 8.0,        // 青い閃光。10 グレイ
  inside: P(1),       // 14  身体の中へ
  dna1: P(3),         // 22  DNA
  decide: P(4),       // 26  「ならば」
  kiai1: P(5),        // 30  うおおおお
  hold: P(6),         // 34  結合が耐える
  kiai1b: P(10),      // 50  二度目の うおおお
  cells1: P(11),      // 54  細胞が持ちこたえる
  lull: P(12),        // 58  ……耐えきった、か
  flash2: P(13),      // 62  100 グレイ
  vomit: 67.0,
  shatter: 71.0,
  dark: 75.4,
  kiai2: Q(0),        // 77  気合いだぁぁぁ
  soulCells: Q(2),    // 85  魂が細胞の形を呼び起こす
  soulDna: Q(4),      // 93
  tug: Q(5),          // 97
  bullets: Q(6),      // 101 血と弾丸
  walk: Q(8),         // 109 止めに行く
  last: Q(10),        // 117 最後の絶叫
  spk: Q(11),         // 121 スピーカーが壊れる
  stop: Q(12),        // 125.01 止まる
  dawn: 130.0,
  epi: 137.6,
  title: 143.6,
  end: DURATION,
};
// 「気合いだ」の「だ」が当たる時刻（11 回）
export const SHOUTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(Q);

// 色（linear・HDR）。青 = 放射線、金 = 気合い、白 = 魂、赤 = 血
export const COL = {
  blue: [0.045, 0.34, 1.0], cyan: [0.25, 0.75, 1.0], ice: [0.62, 0.85, 1.0], white: [1.0, 0.97, 0.92],
  gold: [1.0, 0.60, 0.12], hot: [1.0, 0.20, 0.03], pale: [1.0, 0.90, 0.62], soul: [0.72, 0.93, 1.0],
  blood: [0.42, 0.006, 0.010], bloodHi: [0.95, 0.03, 0.03], bile: [0.95, 0.72, 0.10], paper: [0.86, 0.88, 0.91],
};
// 決定的なノイズ（同じ引数なら同じ値。-1..1）
export const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return (hash1(i + seed * 57.3) * (1 - u) + hash1(i + 1 + seed * 57.3) * u) * 2 - 1;
}

// 声の時刻 [開始, 長さ]（口の開き・画面の揺れ・集中線に使う。tools/kiai_audio.py も同じ数字）
export const VO = [
  [8.22, 1.0], [30.0, 3.7], [50.0, 3.5], [63.0, 2.3], [76.1, 0.8],
  ...SHOUTS.slice(0, 10).map((q) => [q - 0.52, 3.45]),
  [Q(10) - 0.52, 8.4],
];
// 叫びの強さ（0..1。立ち上がりは速く、終わりはゆるやか）
export function shoutEnv(t) {
  let e = 0;
  for (const [a, d] of VO) { if (t < a - 0.05 || t > a + d + 0.3) continue; const k = Math.min((t - a) / 0.06, 1, (a + d - t) / 0.22); if (k > e) e = k; }
  return Math.max(0, Math.min(1, e));
}
