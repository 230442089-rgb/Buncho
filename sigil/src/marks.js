// marks.js — 外神竜一族 十二人の記号（ロゴ）。
//   どれも半径 1 の円に収まり、同じ太さの線（W）と、決まった数種類の部品（線・面・点）だけで組む。
//   題材は設定資料の「人型の能力」と差し色。本来形態は形の由来として匂わせるだけにする。
//   部品: { kind: 'stroke' | 'fill', pen, w, tone, cap, join, t: [始め, 終わり]（組み上がる順。0..1）, id }
//   tone: 'main'（その人の色）/ 'hi'（明るい差し。暗い地で白、明るい地で濃い色）/ 'accent'（もう一色）
import { pen, rot } from './geom.js';

export const W = 0.085, W2 = 0.058;
const S = (p, o = {}) => ({ kind: 'stroke', pen: p, w: o.w ?? W, tone: o.tone || 'main', cap: o.cap || 'round', join: o.join || 'round', t: o.t || [0, 1], id: o.id || '' });
const F = (p, o = {}) => ({ kind: 'fill', pen: p, tone: o.tone || 'main', t: o.t || [0.6, 1], id: o.id || '' });
const lerp = (a, b, k) => a + (b - a) * k, RAD = Math.PI / 180;
const rhomb = (x, y, hw, hh) => pen().poly([[x, y - hh], [x + hw, y], [x, y + hh], [x - hw, y]]);
const square = (x, y, h, deg = 0) => pen().poly([[-h, -h], [h, -h], [h, h], [-h, h]].map(([a, b]) => { const q = rot(a, b, deg); return [x + q[0], y + q[1]]; }));

// ---------------------------------------------------------------- ユリア: 波（止める）と、穿つ槍。群れの太陽
function yuria() {
  const parts = [S(pen().M(0, -0.76).L(0, 0.98), { w: 0.07, t: [0, 0.45], id: 'spear' }), F(pen().poly([[0, -1.04], [0.105, -0.74], [-0.105, -0.74]]), { t: [0.05, 0.4], id: 'tip' })];
  [0.46, 0.7, 0.94].forEach((r, i) => { parts.push(S(pen().arc(0, 0, r, -44, 44), { t: [0.28 + 0.13 * i, 0.72 + 0.13 * i], id: 'wr' + i })); parts.push(S(pen().arc(0, 0, r, 224, 136), { t: [0.28 + 0.13 * i, 0.72 + 0.13 * i], id: 'wl' + i })); });
  parts.push(F(rhomb(0, 0, 0.2, 0.36), { t: [0.2, 0.55], id: 'gem' }), F(rhomb(0, 0, 0.088, 0.16), { tone: 'hi', t: [0.45, 0.75], id: 'core' }));
  return parts;
}
// ---------------------------------------------------------------- ヴォル: 魂の変質。眷属の巻きひげでできたハートと、のぞく竜眼
function volHalf(side, turns, rEnd) {
  const cx = -0.4, cy = -0.24, a0 = 180, a1 = 180 + turns * 360, aS = 300;
  return pen().M(0, 0.86).C(-0.34 * side, 0.6, -0.84 * side, 0.2, -0.84 * side, -0.24).curve((u) => {
    const a = lerp(a0, a1, u), r = a < aS ? 0.44 : lerp(0.44, rEnd, (a - aS) / (a1 - aS));
    return [(cx + Math.cos(a * RAD) * r) * side, cy + Math.sin(a * RAD) * r];
  }, 220, false);
}
function vol() {
  return [S(volHalf(1, 1.45, 0.16), { t: [0, 0.82], id: 'left' }), S(volHalf(-1, 1.2, 0.185), { t: [0.08, 0.86], id: 'right' }),
    F(pen().ellipse(-0.4, -0.24, 0.045, 0.092, 0, -90, 270).Z(), { tone: 'hi', t: [0.8, 1], id: 'eye' }), F(pen().circle(0.4, -0.24, 0.05), { t: [0.84, 1], id: 'dot' })];
}
// ---------------------------------------------------------------- ザイナ: 血肉の盾竜。盾、黒赤の角、分かち合う脈
function zaina() {
  const horn = (s) => pen().M(-0.64 * s, -0.5).C(-0.82 * s, -0.6, -0.86 * s, -0.8, -0.8 * s, -1.0).C(-0.7 * s, -0.8, -0.56 * s, -0.64, -0.36 * s, -0.5).Z();
  return [S(pen().M(-0.62, -0.46).L(0.62, -0.46).C(0.62, 0.2, 0.36, 0.66, 0, 0.94).C(-0.36, 0.66, -0.62, 0.2, -0.62, -0.46).Z(), { t: [0, 0.6], id: 'shield' }),
    F(horn(1), { t: [0.45, 0.75], id: 'hornL' }), F(horn(-1), { t: [0.5, 0.8], id: 'hornR' }),
    S(pen().poly([[-0.4, 0.08], [-0.2, 0.08], [-0.12, -0.05], [-0.04, 0.08], [0.04, -0.32], [0.14, 0.38], [0.22, 0.08], [0.4, 0.08]], false), { w: 0.062, tone: 'hi', t: [0.55, 1], id: 'pulse' })];
}
// ---------------------------------------------------------------- ルリカ: 正常化。あるべき規格の立方体と、合わせ印
function rurika() {
  const R = 0.78, v = [-90, -30, 30, 90, 150, 210].map((a) => [Math.cos(a * RAD) * R, Math.sin(a * RAD) * R]);
  const parts = [S(pen().poly(v), { join: 'miter', t: [0, 0.55], id: 'hex' })];
  [[5, 0.3], [1, 0.36], [3, 0.42]].forEach(([i, t0], k) => parts.push(S(pen().M(0, 0).L(v[i][0], v[i][1]), { cap: 'butt', tone: 'hi', t: [t0, t0 + 0.3], id: 'in' + k })));
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], k) => parts.push(S(pen().M(0.98 * sx, 0.7 * sy).L(0.98 * sx, 0.98 * sy).L(0.7 * sx, 0.98 * sy), { w: W2, cap: 'butt', join: 'miter', tone: 'accent', t: [0.6 + 0.07 * k, 0.8 + 0.07 * k], id: 'crop' + k })));
  return parts;
}
// ---------------------------------------------------------------- ミリア: 軌跡と大鎌。過去（点）→ 現在（継ぎ目）→ 未来（輪）。途中で、ずらす
function miria() {
  const P0 = [0.36, -0.5], P1 = [-0.56, 0.88], d = [P1[0] - P0[0], P1[1] - P0[1]], L = Math.hypot(d[0], d[1]), dir = [d[0] / L, d[1] / L], nrm = [dir[1], -dir[0]];
  const parts = [F(pen().M(0.54, -0.76).C(0.1, -1.2, -0.7, -0.92, -0.93, -0.14).C(-0.62, -0.7, -0.06, -0.84, 0.36, -0.56).Z(), { t: [0.35, 0.8], id: 'blade' }),
    S(pen().circle(0.44, -0.66, 0.105), { w: W2, tone: 'hi', t: [0.3, 0.55], id: 'joint' })];
  [0.1, 0.27, 0.44, 0.6, 0.77, 0.94].forEach((u, i) => { const sh = i >= 3 ? 0.085 : 0, r = lerp(0.078, 0.036, i / 5); parts.push(F(pen().circle(P0[0] + d[0] * u + nrm[0] * sh, P0[1] + d[1] * u + nrm[1] * sh, r), { t: [0.02 + 0.05 * (5 - i), 0.2 + 0.05 * (5 - i)], id: 'dot' + i })); });
  const c = [P0[0] + d[0] * 0.52 + nrm[0] * 0.04, P0[1] + d[1] * 0.52 + nrm[1] * 0.04], q = rot(nrm[0], nrm[1], -22);
  parts.push(S(pen().M(c[0] - q[0] * 0.24, c[1] - q[1] * 0.24).L(c[0] + q[0] * 0.24, c[1] + q[1] * 0.24), { w: 0.036, tone: 'hi', t: [0.8, 0.95], id: 'cut' }));
  parts.push(S(pen().circle(0.44 - dir[0] * 0.33, -0.66 - dir[1] * 0.33, 0.05), { w: 0.034, tone: 'accent', t: [0.85, 1], id: 'future' }));
  return parts;
}
// ---------------------------------------------------------------- 燐: 結界・結索。見えない紐で区切った、守るための四角
function rin() {
  const a = 0.3, e = 0.8, g = 0.118, R = (x, y) => rot(x, y, 45), parts = [];
  const seg = (x0, y0, x1, y1, t0, id) => { const p = R(x0, y0), q = R(x1, y1); parts.push(S(pen().M(p[0], p[1]).L(q[0], q[1]), { t: [t0, t0 + 0.4], id })); };
  // 縦の紐（x = ±a）と横の紐（y = ±a）。交わるところで、上下を交互に入れ替える（下をくぐる側は切れ目を入れる）
  seg(-a, -e, -a, a - g, 0, 'v0a'); seg(-a, a + g, -a, e, 0.3, 'v0b');             // 左の縦: 上の交点は上、下の交点はくぐる
  seg(a, -e, a, -a - g, 0.1, 'v1a'); seg(a, -a + g, a, e, 0.3, 'v1b');             // 右の縦: 上の交点はくぐる、下の交点は上
  seg(-e, -a, -a - g, -a, 0.2, 'h0a'); seg(-a + g, -a, e, -a, 0.4, 'h0b');         // 上の横: 左の交点はくぐる、右の交点は上
  seg(-e, a, a - g, a, 0.3, 'h1a'); seg(a + g, a, e, a, 0.56, 'h1b');              // 下の横: 左の交点は上、右の交点はくぐる
  parts.push(F(pen().circle(0, 0, 0.07), { tone: 'hi', t: [0.8, 1], id: 'core' }));
  return parts;
}
// ---------------------------------------------------------------- テルエス: 権限。琥珀の特異点と、順番を入れ替えた輪
function telues() {
  const tilt = -24, rx = 0.88, ry = 0.3, ax = rot(0, 1, tilt), g = 9;        // ax: 噴流の向き（輪の短い軸）
  // 輪は、上の交点で噴流の下をくぐり、下の交点では噴流の上を通る（どちらが先か、を入れ替えた形）
  return [S(pen().ellipse(0, 0, rx, ry, tilt, -90 + g + 4, 270 - g - 4), { t: [0.1, 0.75], id: 'ring' }),
    S(pen().M(-ax[0] * 0.2, -ax[1] * 0.2).L(-ax[0] * 0.98, -ax[1] * 0.98), { t: [0.3, 0.6], id: 'jetU' }),
    S(pen().M(ax[0] * 0.44, ax[1] * 0.44).L(ax[0] * 0.98, ax[1] * 0.98), { t: [0.3, 0.6], id: 'jetD' }),
    F(pen().circle(0, 0, 0.125), { tone: 'hi', t: [0, 0.3], id: 'core' })];
}
// ---------------------------------------------------------------- レウネ: 情報掌握。半分だけ開いた目と、垂れる情報列
function reune() {
  const parts = [S(pen().M(-0.92, -0.16).L(0.92, -0.16), { t: [0, 0.4], id: 'lid' }), S(pen().M(-0.92, -0.16).C(-0.5, 0.62, 0.5, 0.62, 0.92, -0.16), { t: [0.15, 0.6], id: 'lower' }),
    S(pen().arc(0, -0.06, 0.33, -17.6, 197.6), { w: 0.066, tone: 'hi', t: [0.45, 0.8], id: 'iris' }), F(square(0, 0.045, 0.078), { t: [0.7, 0.9], id: 'pupil' })];
  [[0.1, 0.052], [0.3, 0.044], [0.48, 0.036], [0.64, 0.028]].forEach(([y, h], i) => parts.push(F(square(0.92, y, h), { tone: 'accent', t: [0.6 + 0.08 * i, 0.75 + 0.08 * i], id: 'bit' + i })));
  return parts;
}
// ---------------------------------------------------------------- ニルメ: 引力。内へ巻きこむ渦と、宝石になった星
function nirume() {
  const turns = 2.3, r0 = 0.94, r1 = 0.24, at = (u) => { const a = (-90 + u * turns * 360) * RAD, r = lerp(r0, r1, u); return [Math.cos(a) * r, Math.sin(a) * r]; };
  const parts = [S(pen().curve(at, 300), { t: [0, 0.8], id: 'spiral' })];
  [[0.13, 0.115], [0.45, 0.095], [0.76, 0.078]].forEach(([u, h], i) => { const p = at(u); parts.push(F(rhomb(p[0], p[1], h * 0.66, h), { tone: 'hi', t: [0.55 + 0.1 * i, 0.75 + 0.1 * i], id: 'gem' + i })); });
  parts.push(S(pen().M(-0.095, 0).L(0.095, 0).M(0, -0.095).L(0, 0.095), { w: W2, tone: 'accent', t: [0.85, 1], id: 'cross' }));
  return parts;
}
// ---------------------------------------------------------------- エデル: 事象の造形。額縁の中の額縁。いちばん外は、まだ未完
function edel() {
  const fr = (h, deg) => [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => rot(x, y, deg));
  const o = 0.84, m = fr(0.56, 15), n = fr(0.345, 30);
  return [S(pen().M(o, 0.26).L(o, -o).L(-o, -o).L(-o, o).L(0.3, o), { cap: 'butt', join: 'miter', t: [0, 0.6], id: 'outer' }),
    S(pen().poly(m), { w: 0.066, join: 'miter', tone: 'hi', t: [0.25, 0.75], id: 'mid' }), S(pen().poly(n), { w: W2, join: 'miter', t: [0.45, 0.9], id: 'inner' }),
    F(rhomb(0, 0, 0.13, 0.13), { tone: 'accent', t: [0.85, 1], id: 'gem' })];
}
// ---------------------------------------------------------------- アセラ: 転勢。触れて、奪って、向きを返す。あとに残る残像
function asera() {
  const A = [-0.82, -0.5], C = [0.56, 0], B = [-0.52, 0.46], r = 0.135;
  const u1 = [C[0] - A[0], C[1] - A[1]], l1 = Math.hypot(u1[0], u1[1]), d1 = [u1[0] / l1, u1[1] / l1], u2 = [B[0] - C[0], B[1] - C[1]], l2 = Math.hypot(u2[0], u2[1]), d2 = [u2[0] / l2, u2[1] / l2];
  const w1 = rot(-d2[0], -d2[1], 30), w2 = rot(-d2[0], -d2[1], -30), n1 = [d1[1], -d1[0]];
  const echo = (off, a, b, t0, id) => S(pen().M(A[0] + d1[0] * a + n1[0] * off, A[1] + d1[1] * a + n1[1] * off).L(A[0] + d1[0] * b + n1[0] * off, A[1] + d1[1] * b + n1[1] * off), { w: W2, tone: 'accent', t: [t0, t0 + 0.2], id });
  return [S(pen().M(A[0], A[1]).L(C[0] - d1[0] * (r + 0.05), C[1] - d1[1] * (r + 0.05)), { t: [0, 0.35], id: 'in' }), S(pen().circle(C[0], C[1], r), { t: [0.3, 0.55], id: 'touch' }),
    S(pen().M(C[0] + d2[0] * (r + 0.05), C[1] + d2[1] * (r + 0.05)).L(B[0], B[1]), { t: [0.5, 0.8], id: 'out' }),
    S(pen().M(B[0] + w1[0] * 0.27, B[1] + w1[1] * 0.27).L(B[0], B[1]).L(B[0] + w2[0] * 0.27, B[1] + w2[1] * 0.27), { join: 'miter', t: [0.75, 0.95], id: 'head' }),
    echo(0.2, 0.02, 0.86, 0.08, 'echo0'), echo(0.38, 0.1, 0.56, 0.16, 'echo1')];
}
// ---------------------------------------------------------------- フルル: 還る場所。ひらいた腕の輪と、そこに並ぶ十一の点
function fururu() {
  const parts = [S(pen().arc(0, 0, 0.9, -66, 246), { w: 0.095, t: [0, 0.7], id: 'ring' })];
  for (let i = 0; i < 11; i++) { const a = (-90 + (i + 0.5) * 360 / 11) * RAD; parts.push(F(pen().circle(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.064), { tone: 'kid' + i, t: [0.35 + 0.04 * i, 0.55 + 0.04 * i], id: 'kid' + i })); }
  return parts;
}

// 色: main = 暗い地での色 / deep = 明るい地での色 / ink = 明るい地での濃い差し / accent = もう一色（暗い地, 明るい地）
const DEFS = [
  ['yuria', 'ユリア', '長女', '群れの太陽', '波／穿つ槍', yuria, { main: '#FFD24A', deep: '#E9A800', ink: '#7A5200', accent: ['#FFF1B5', '#F7CB45'] }],
  ['vol', 'ヴォル', '次女', '変幻の参謀', '魂の変質', vol, { main: '#A9CCFF', deep: '#5E94E0', ink: '#274B86', accent: ['#E6F0FF', '#9DBEF0'] }],
  ['zaina', 'ザイナ', '三女', '血肉の盾竜', '外神フィジカル／血肉共鳴', zaina, { main: '#EE3A47', deep: '#C3202F', ink: '#3A0C12', accent: ['#FF8A93', '#7A1420'] }],
  ['rurika', 'ルリカ', '四女', '良心と矯正係', '正常化', rurika, { main: '#8F8CFF', deep: '#4C47C9', ink: '#211E66', accent: ['#DCE6FF', '#9AA6E8'] }],
  ['miria', 'ミリア', '五女', '軌跡と恐怖の竜', '軌跡操作／恐怖付与', miria, { main: '#C8F25A', deep: '#7DB312', ink: '#33500A', accent: ['#F1FFC4', '#A9D84A'] }],
  ['rin', '燐', '六女', '制御と結界の術者', '結界・結索／呪術', rin, { main: '#58D8B2', deep: '#1D9F80', ink: '#0B4A3C', accent: ['#D2F7EC', '#7CCDB6'] }],
  ['nirume', 'ニルメ', '親戚', '引力を司る地雷系竜', '引力・重力操作', nirume, { main: '#FFB7D3', deep: '#E877A4', ink: '#2B2A31', accent: ['#FFFFFF', '#2B2A31'] }],
  ['reune', 'レウネ', '親戚・テルエスの姉', '裏方の管理者', '情報掌握', reune, { main: '#22D68C', deep: '#0C9C62', ink: '#064A2F', accent: ['#B9F7DB', '#52C596'] }],
  ['telues', 'テルエス', '親戚・レウネの妹', '理を書き換える手', '権限', telues, { main: '#FF9B3D', deep: '#E2711A', ink: '#5E2A00', accent: ['#FFDCAE', '#F0A45A'] }],
  ['edel', 'エデル', '親戚・アセラの姉', '事象と芸術の竜', '事象の造形／感覚の切り取り', edel, { main: '#CDBAF6', deep: '#8D70D2', ink: '#1F1A28', accent: ['#FFFFFF', '#1F1A28'] }],
  ['asera', 'アセラ', '親戚・エデルの妹', '衝動と躍動の竜', '運動の収奪と再放出／転勢', asera, { main: '#FF6B3E', deep: '#E4481C', ink: '#5A1600', accent: ['#B98FFF', '#8D5FE0'] }],
  ['fururu', 'フルル', '母・根源', '皆が呼ぶ「ママ」', '十一人の能力の完全再現／帰還の支え', fururu, { main: '#F6F1EA', deep: '#8D8597', ink: '#4A4453', accent: ['#FFFFFF', '#8D8597'] }],
];
export const MARKS = DEFS.map(([id, name, role, epithet, ability, build, col]) => {
  const parts = build().map((p) => ({ ...p, paths: p.pen.paths(), d: p.pen.d }));
  return { id, name, role, epithet, ability, col, parts, part: (pid) => parts.find((p) => p.id === pid) };
});
export const BY = Object.fromEntries(MARKS.map((m) => [m.id, m]));
export const KIDS = MARKS.filter((m) => m.id !== 'fururu');      // 並び順: 主家の六姉妹 → 親戚

// 色の決め方。mode: 'dark'（暗い地）/ 'light'（明るい地）/ 'white'・'ink'（一色）
export function palette(mark, mode = 'dark') {
  const c = mark.col, L = mode === 'light';
  return (tone) => {
    if (mode === 'white') return '#ffffff'; if (mode === 'ink') return '#2c2733';
    if (tone.startsWith('kid')) { const k = KIDS[+tone.slice(3)].col; return L ? k.deep : k.main; }
    return tone === 'main' ? (L ? c.deep : c.main) : tone === 'hi' ? (L ? c.ink : '#ffffff') : tone === 'accent' ? c.accent[L ? 1 : 0] : (L ? c.deep : c.main);
  };
}
