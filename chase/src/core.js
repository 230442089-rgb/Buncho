// core.js — 「ゆり姉、まってぇ♡」の時間割。数学の道具は film/src/core.js のものを使う。
//
// 時間は音楽から決めている（tools/chase_audio.py が同じ数字で音を並べる）:
//   "Creepy Comedy"（Rafael Krux, 110 BPM）。8.727 秒（16 拍）ごとに低い打音が入る → その頭に場面の変わり目を置く。
//   1:08.8 で「つかまえた」のあと、曲の終わりの 1 フレーズ（121.17 秒〜）へ飛ぶ。
export * from '../../film/src/core.js';

export const BEAT = 0.5455, BAR = BEAT * 4;
export const G = (n) => 7.713 + 8.727 * n;           // フレーズの頭
export const DURATION = 83.6;
export const TOTAL_FRAMES = Math.round(DURATION * 30);
export const T = {
  chill: 4.45,       // ぞくっ
  vol: G(0),         // 7.71  ヴォルが顔を出す
  turn: G(1),        // 16.44 ユリアがごまかす
  dark: G(1) + BAR * 1.5,   // 19.71 「逃げるんですかぁ？」
  dash: G(2),        // 25.17 逃走。題
  run: G(2) + 1.1,   // 廊下
  imagine: G(3),     // 33.89 想像
  no: G(4),          // 42.62 いやいやいや
  wave: G(4) + BAR * 1.75,  // 46.44 波
  esc: G(5),         // 51.35 町内 → 地球 → 月
  home: G(6),        // 60.08 帰宅
  caught: G(7),      // 68.80 つかまえた
  last: G(8),        // 77.53 一生！？
  card: 80.0,
  end: DURATION,
};
export const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash1(i + seed * 57.3) * (1 - u) + hash1(i + 1 + seed * 57.3) * u) * 2 - 1; }
// コマを落とす（人物の動きを 1 秒 12 コマにして、手描きアニメの間合いにする）
export const on2 = (t, fps = 12) => Math.floor(t * fps + 1e-6) / fps;
