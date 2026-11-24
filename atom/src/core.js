// core.js — 「見えない火」の時間割。数学の道具は film/src/core.js のものをそのまま使う。
//
// 時間は音楽から決めている（tools/atom_audio.py が同じ数字で曲を並べる）:
//   0:00–1:50   "Night Vigil"（Kevin MacLeod）の冒頭〜 110.1 秒。曲が息を継ぐ場所で、地震が来る。
//   1:50–3:00   "Hidden Truth"（Rafael Krux）。8.73 秒ごとの低い打音を、事故の一段ずつに当てる（Q[0]〜Q[8]）。
//   3:08–       "Night Vigil" が、止まった場所（110.1 秒）から再開する。最後の和音が消えるのは 5:59 ごろ。
export * from '../../film/src/core.js';

export const DURATION = 377.0;
export const TOTAL_FRAMES = Math.round(DURATION * 30);

// Night Vigil の和音が替わる位置（曲の中の秒）。再開後は NV2 を足すと映像の時刻になる
export const NV2 = 77.9;
const nv = (s) => s + NV2;

// 事故の章: 打音の位置（映像の時刻）
export const Q = [110.10, 118.80, 127.55, 136.27, 145.00, 153.71, 162.46, 171.17, 179.90];

export const T = {
  // ---- 第 1 幕: しくみ（Night Vigil 0 → 110.1）
  glow: 2.35,        // 音楽が入る。水の底の青い光
  title: 10.99,      // 題
  nucleus: 19.84,    // 1 分裂: ウラン 235 の原子核
  split: 28.42,      //   割れる瞬間
  s1end: 37.55,
  chain: 38.25,      // 2 連鎖: 中性子が次の核へ
  grow: 47.71,       //   ねずみ算
  control: 57.45,    //   制御棒、臨界
  s2end: 74.45,
  fuel: 74.95,       // 3 発電: ペレット → 燃料棒 → 集合体 → 炉心
  plant: 88.27,      //   発電所のしくみ
  principle: 101.15, //   止める・冷やす・閉じ込める
  // ---- 第 2 幕: 事故（Hidden Truth）
  quake: Q[0],       // 4 事故
  boom: Q[8],
  // ---- 第 3 幕: 人（Night Vigil 110.1 →）
  resume: nv(110.1),       // 188.00  5 拡散
  rain: nv(119.00),        // 196.90
  evac: nv(125.84),        // 203.74
  worst: nv(135.41),       // 213.31  最悪の想定
  invisible: nv(146.0),    // 223.90  6 身体（曲の静かな橋）
  dna: nv(150.0),          // 227.90
  dna2: nv(160.97),        // 238.87
  ladder: nv(172.07),      // 249.97  線量の梯子
  ladderEnd: nv(209.3),    // 287.20
  people: nv(210.4),       // 288.30  7 人々
  resident: nv(216.96),    // 294.86
  thyroid: nv(222.48),     // 300.38
  evacDeath: nv(233.98),   // 311.88
  mind: nv(247.0),         // 324.90
  cancer: nv(259.90),      // 337.80
  time: nv(271.16),        // 349.06  8 時間
  closing: nv(283.0),      // 360.90
  endcard: 368.6,
  end: DURATION,
};
// 線量の梯子の各段が始まる時刻（和音の替わり目に寄せてある）
export const TIER = [nv(172.07), nv(177.5), nv(183.10), nv(188.5), nv(195.19), nv(200.7), nv(204.7)];

// 色（linear・HDR）。青 = 制御された火、琥珀〜赤 = 手を離れた火
export const COL = {
  blue: [0.045, 0.34, 1.0], cyan: [0.25, 0.75, 1.0], ice: [0.62, 0.85, 1.0],
  amber: [1.0, 0.42, 0.06], hot: [1.0, 0.16, 0.03], white: [1.0, 0.96, 0.9],
  proton: [0.95, 0.19, 0.07], neutron: [0.36, 0.48, 0.62], paper: [0.86, 0.88, 0.91],
  water: [0.03, 0.16, 0.42], steam: [0.72, 0.82, 0.95], iodine: [1.0, 0.62, 0.12],
};
