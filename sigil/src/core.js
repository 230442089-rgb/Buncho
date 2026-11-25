// core.js — 「十二の紋章」の時間割と、数学の道具。
//
// 時間は音楽から決めている（tools/sigil_audio.py が同じ数字で音を並べる）:
//   "Arpent"（Kevin MacLeod, 120 BPM）。1 拍 0.5 秒、1 小節 2 秒、和音はひとまわり 4 小節（8 秒）。
//   8 秒にひとりずつ。4 秒目（3 小節目の頭）で記号が組み上がる。
//   112〜128 秒は曲が静まる（2 秒ごとに低い音だけが鳴る）→ フルル。128 秒で曲が戻る → 家族の紋。160 秒で終わる。
export * from '../../film/src/core.js';

export const BEAT = 0.5, BAR = 2.0, SLOT = 8.0;
export const DURATION = 162.0;
export const TOTAL_FRAMES = Math.round(DURATION * 30);
export const ORDER = ['yuria', 'vol', 'zaina', 'rurika', 'miria', 'rin', 'nirume', 'reune', 'telues', 'edel', 'asera'];
export const T = {
  title: 0,          // 題
  first: 8,          // ひとりめ（8 秒ごとに 11 人）
  gather: 96,        // 十一の原理が並ぶ
  sea: 112,          // 静かな中間部: フルル
  home: 128,         // 曲が戻る: 家族の紋
  sheet: 136,        // 十二のロゴの一覧
  last: 152,         // 結び
  end: DURATION,
};
export const slotOf = (id) => T.first + ORDER.indexOf(id) * SLOT;
export const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash1(i + seed * 57.3) * (1 - u) + hash1(i + 1 + seed * 57.3) * u) * 2 - 1; }
