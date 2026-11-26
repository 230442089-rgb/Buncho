// cast.js — 3D の登場人物の「演技」: ユリアの顔の絵と、ユリア・マッスル文鳥の姿勢（骨の角度）を、場面と時刻から決める。
//   形そのものは strike/model/ に、描き方は figure.js にある。ここは「どう動くか」だけ。
import { features, YURIA } from '../../chase/src/chibi.js';
import { attach } from './figure.js';

const { sin, cos, PI, abs, min, max } = Math;
const clamp = (x, a, b) => min(b, max(a, x)), sat = (x) => clamp(x, 0, 1), lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => { x = sat(x); return x * x * (3 - 2 * x); };

// ============================================================ ユリアの顔（目・眉・口・ほお）を、表情ごとに 1 枚ずつ描いておく
const EYES = { ...YURIA, eyeCol: ['#4a93c8', '#86d2ee', '#e0f8ff', '#86a6c2'], fang: true, lid: 0.12 };
export const FACES = {
  smile: { eyes: 'open', mouth: { kind: 'open', h: 0.16, fang: true }, lid: 0.1 },
  grin: { eyes: 'open', mouth: { kind: 'open', h: 0.2, w: 0.17, fang: true }, lid: 0.05 },
  happy: { eyes: 'happy', mouth: { kind: 'open', h: 0.2, w: 0.17, fang: true }, blush: 1.2 },
  cool: { eyes: 'open', mouth: 'smile', lid: 0.28, browTilt: 0.22 },
  oops: { eyes: 'cross', mouth: 'wavy' },
  wow: { eyes: 'wide', mouth: 'small', dot: 0.05 },
  fierce: { eyes: 'open', mouth: { kind: 'open', h: 0.14, fang: true }, lid: 0.3, browTilt: 0.3 },
  blink: { eyes: 'shut', mouth: { kind: 'open', h: 0.16, fang: true } },
};
export class Faces {
  constructor(g, size = 384) {
    this.g = g; this.tex = {};
    for (const k in FACES) {
      const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'), s = size / 2.2;
      c.setTransform(s, 0, 0, s, size / 2, size / 2); features(c, EYES, FACES[k]);
      this.tex[k] = g.fromCanvas(cv, { filter: 'linear' });
    }
  }
  // 表情の名前と時刻から、貼る絵を選ぶ（目をあけている表情は、ときどき、まばたきする）
  //   戻り値: { tex: 絵, open: 目をあけているか }
  get(mood = 'smile', t = 0) { const f = FACES[mood] ? mood : 'smile', e = FACES[f].eyes, blink = e === 'open' && (t * 0.31 + 0.2) % 1 < 0.035, k = blink ? 'blink' : f; return { tex: this.tex[k], open: !blink && (e === 'open' || e === 'wide') }; }
}

// ============================================================ 姿勢。骨ごとの角度（度）の表を混ぜて、そこへ時刻による揺れを足す
//   角度は [前へ倒す, 左右へ向く, 横へ傾く]。腕は、右は rz が正・左は rz が負で、横へ上がる。rx が負で、前へ上がる。
const setMix = (p, A, B, k) => {
  for (const n in A) { const a = A[n], b = B[n] || Z3; p.rot(n, lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)); }
  for (const n in B) if (!(n in A)) { const b = B[n]; p.rot(n, b[0] * k, b[1] * k, b[2] * k); }
};
const Z3 = [0, 0, 0];
export const LANCE_REST = [0.6, 0.1, 0.79];        // ふだんの槍の向き（右ななめ前へ。うしろから見て、よく見えるように）

// ---- ユリア。飛ぶ（うしろ姿）: 体を前へ倒し、脚と髪をうしろへ流して、槍を前へ向ける
const Y_FLY = {
  pelvis: [30, 0, 0], spine: [-7, 0, 0], chest: [-8, 0, 0], neck: [-6, 0, 0], head: [-12, 0, 0],
  thighR: [14, 0, 4], shinR: [44, 0, 0], footR: [42, 0, 0], thighL: [34, 0, -4], shinL: [14, 0, 0], footL: [46, 0, 0],
  armR: [12, 0, 24], foreR: [-44, 24, 0], handR: [18, 6, 0], lance: [0, 0, 90], armL: [30, 0, -58], foreL: [-18, 0, -12], handL: [0, 0, -10],
  hair1: [42, 0, 0], hair2: [14, 0, 0], hair3: [10, 0, 0], tail1: [34, -10, 10], tail2: [16, 0, 8], lockR: [38, 0, 8], lockL: [38, 0, -8],
  hipR: [38, 0, 14], hipL: [38, 0, -14], wingR: [0, 12, 4], wingL: [0, -12, -4],
};
// 正面を向いて浮かぶ（題・結果）: 槍を立てて持ち、片ひざを軽く曲げる
const Y_FRONT = {
  pelvis: [0, 0, 0], spine: [-2, 0, 0], chest: [-3, 0, 0], head: [2, 0, 4],
  thighR: [-12, 0, 5], shinR: [34, 0, 0], footR: [30, 0, 0], thighL: [4, 0, -3], shinL: [6, 0, 0], footL: [34, 0, 0],
  armR: [-6, 0, 34], foreR: [-30, 0, 4], handR: [-60, 0, -16], lance: [0, 0, 90], armL: [6, 0, -18], foreL: [-14, 0, -6],
  hair1: [4, 0, 0], hair2: [2, 0, 0], hair3: [2, 0, 0], tail1: [0, 0, 0], tail2: [4, 0, 0],
  hipR: [4, 0, 6], hipL: [4, 0, -6], wingR: [0, 6, 6], wingL: [0, -6, -6],
};
// o: { t, sway: 左右への動き -1..1, power: ための強さ 0..1, turn: ふり向き 0..1, wave: 手をふる 0..1, thrust: 槍を突き出す 0..1, hurt: 0..1, aim: 槍を向ける先（モデルの座標での向き）, still: ふり向いても体は回さない }
export function poseYuria(p, o = {}) {
  const t = o.t || 0, sw = clamp(o.sway || 0, -1, 1), pw = sat(o.power || 0), k = ease(o.turn || 0), fly = 1 - k, wv = sat(o.wave || 0), th = sat(o.thrust || 0), hu = sat(o.hurt || 0);
  p.reset(); setMix(p, Y_FLY, Y_FRONT, k);
  const s1 = sin(t * 2.3), s2 = sin(t * 3.1 + 1), s3 = sin(t * 4.3 + 2);
  // 体: ゆっくり上下しながら、舵を切った向きへ傾く。ふり向くときは、その場で半回転
  p.add('pelvis', 2.5 * s1 * fly - 10 * hu, (o.still ? 0 : 180 * k) + 9 * sw * fly, -24 * sw * fly + 2 * s2 * k);
  p.add('chest', -3 * pw, 4 * sw * fly, -5 * sw * fly); p.add('head', -4 * pw + 8 * hu, 8 * sw * fly, 8 * sw * fly + 3 * s2 * k);
  // 脚: 左右で少しずれて揺れる
  p.add('thighR', 5 * s1 * fly + 3 * s2 * k, 0, 0); p.add('shinR', -6 * s1 * fly, 0, 0); p.add('thighL', -5 * s1 * fly, 0, 0); p.add('shinL', 6 * s2 * fly + 3 * s1 * k, 0, 0);
  // 槍の腕: ためると引きしぼり、撃つと突き出す
  p.add('armR', 16 * pw * fly - 26 * th * fly, 0, 6 * pw); p.add('foreR', -22 * pw * fly + 30 * th * fly, 0, 0); p.add('handR', 10 * pw * fly - 6 * th * fly, 0, 0);
  // 左手: 飛ぶときはうしろへ流す。ふり向いたら、手をふる
  p.add('armL', 4 * s2 * fly - 78 * wv * k, 0, -4 * s1 * fly - 34 * wv * k); p.add('foreL', -62 * wv * k, 0, (-30 - 22 * sin(t * 9)) * wv * k); p.add('handL', 0, 0, -16 * sin(t * 9 + 0.6) * wv * k);
  // 髪・結んだ髪・顔のわきの束: 風に流れて、遅れて揺れる
  const hs = fly * 1 + 0.35 * k;
  p.add('hair1', 5 * s2 * hs, 0, 10 * sw * fly + 3 * s1 * hs); p.add('hair2', 8 * sin(t * 3.1) * hs, 0, 8 * sw * fly + 5 * sin(t * 2.3 - 0.8) * hs); p.add('hair3', 11 * sin(t * 3.1 - 1.1) * hs, 0, 7 * sin(t * 2.3 - 1.7) * hs);
  p.add('tail1', 6 * s3 * hs, 0, 4 * s1 * hs + 8 * sw * fly); p.add('tail2', 10 * sin(t * 4.3 + 1) * hs, 0, 6 * s2 * hs);
  p.add('lockR', 6 * s3 * hs, 0, 3 * s1 * hs); p.add('lockL', 6 * sin(t * 4.3 + 2.6) * hs, 0, 3 * s2 * hs);
  p.add('hipR', 8 * s2 * hs, 0, 4 * s3 * hs); p.add('hipL', 8 * s3 * hs, 0, -4 * s2 * hs);
  // 翼: ゆっくり羽ばたき、羽は扇のように開いたり閉じたりする。ためるほど大きく開く
  const fl = sin(t * 3.4), op = 1 + 0.5 * pw + 0.12 * fl;
  p.add('wingR', 0, 5 * fl + 6 * pw, 3 * fl); p.add('wingL', 0, -5 * fl - 6 * pw, -3 * fl);
  for (let i = 0; i < 5; i++) { const a = (2 - i) * 4.5 * (op - 1) + 1.5 * sin(t * 5 + i); p.rot('wb' + i + 'R', 0, 0, a); p.rot('wb' + i + 'L', 0, 0, -a); }
  // 飛んでいるあいだ、槍はいつも ねらいの先を向く（体が傾いても、槍はぶれない）
  if (fly > 0.02) {
    const d = o.aim || LANCE_REST, e = fly * fly; p.update();
    const c = p.at('lance', Z3), z = p.at('lance', [0, 0, 1]), cur = [z[0] - c[0], z[1] - c[1], z[2] - c[2]];
    p.aim('handR', [lerp(cur[0], d[0], e), lerp(cur[1], d[1], e), lerp(cur[2], d[2], e)], [0, 1, 0]);
  }
  return p;
}

// ---- マッスル文鳥。kind: 'trooper'（噴射装置 + バズーカ）| 'gunner'（ガトリング）| 'cmd'（隊長）| 'fall'（放り出された）| 'chute'（落下傘で降りる）| 'flex'（力こぶを見せる）
const B_BASE = { thighR: [-22, 0, 6], shinR: [48, 0, 0], footR: [22, 0, 0], thighL: [-10, 0, -6], shinL: [36, 0, 0], footL: [26, 0, 0], tail: [14, 0, 0] };
const B_POSE = {
  // 右肩にかついだ筒を右手で支え、左手は力こぶ
  trooper: { ...B_BASE, chest: [4, -6, 0], head: [4, 6, -3], armR: [-27, -36, 9], foreR: [-122, -54, 0], handR: [0, 0, 0], armL: [0, 0, -62], foreL: [0, 0, -112], handL: [0, 0, -10] },
  // 右手ひとつで取っ手をつかみ、腰の横に下げて撃つ。左手は力こぶ
  gunner: { ...B_BASE, pelvis: [0, 0, 0], chest: [8, 12, 0], head: [-2, -10, 0], armR: [38, 0, -32], foreR: [-97, -47, 0], armL: [0, 0, -58], foreL: [0, 0, -108], handL: [0, 0, -10] },
  // 腕を組んでふんぞり返る
  smug: { thighR: [0, 0, 5], thighL: [0, 0, -5], spine: [-6, 0, 0], chest: [-8, 0, 0], head: [-10, 0, 0], armR: [-48, -30, 6], foreR: [-30, -86, 0], armL: [-48, 30, -6], foreL: [-30, 86, 0], tail: [10, 0, 0] },
  // 前を指さして、どなる
  shout: { thighR: [0, 0, 8], thighL: [0, 0, -8], spine: [6, 0, 0], chest: [8, -10, 0], head: [4, 8, 0], armR: [-98, 0, 14], foreR: [-8, 0, 0], armL: [14, 0, -30], foreL: [-70, 0, 0], jaw: [26, 0, 0], tail: [22, 0, 0] },
  // 両手を上げて、あわてる
  shock: { thighR: [-20, 0, 12], shinR: [40, 0, 0], thighL: [-6, 0, -12], shinL: [20, 0, 0], spine: [-10, 0, 0], chest: [-8, 0, 0], head: [-14, 0, 0], armR: [0, 0, 96], foreR: [0, 0, 30], armL: [0, 0, -96], foreL: [0, 0, -30], jaw: [34, 0, 0], tail: [30, 0, 0] },
  // 放り出されて、手足をばたつかせる
  fall: { thighR: [-50, 0, 18], shinR: [70, 0, 0], thighL: [20, 0, -18], shinL: [50, 0, 0], spine: [-12, 0, 0], chest: [-10, 0, 0], head: [-18, 0, 0], armR: [-30, 0, 100], foreR: [0, 0, 40], armL: [20, 0, -80], foreL: [0, 0, -60], jaw: [30, 0, 0], tail: [30, 0, 0] },
  // 落下傘のひもを両手でつかんで、ぶらさがる
  chute: { thighR: [-16, 0, 8], shinR: [40, 0, 0], footR: [20, 0, 0], thighL: [-4, 0, -8], shinL: [22, 0, 0], footL: [20, 0, 0], head: [-10, 0, 0], armR: [-10, 0, 118], foreR: [0, 0, 38], armL: [-10, 0, -118], foreL: [0, 0, -38], jaw: [8, 0, 0], tail: [6, 0, 0] },
  // 力こぶを見せる（題・鑑賞）
  flex: { thighR: [0, 0, 7], thighL: [0, 0, -7], chest: [-6, 0, 0], head: [-4, 0, 0], armR: [0, 0, 58], foreR: [0, 0, 108], armL: [0, 0, -58], foreL: [0, 0, -108], tail: [8, 0, 0] },
};
// o: { kind, t, ph: 個体ごとのずれ, fire: 撃った直後 0..1 }
export function poseBuncho(p, o = {}) {
  const A = B_POSE[o.kind] || B_POSE.trooper, t = (o.t || 0) + (o.ph || 0), f = sat(o.fire || 0), kind = o.kind || 'trooper';
  p.reset(); for (const n in A) p.rot(n, A[n][0], A[n][1], A[n][2]);
  const s1 = sin(t * 2.6), s2 = sin(t * 3.7 + 1);
  if (kind === 'trooper' || kind === 'gunner') {
    p.add('pelvis', 3 * s1, 0, 2 * s2); p.add('thighR', 5 * s1, 0, 0); p.add('thighL', -5 * s1, 0, 0); p.add('shinR', 6 * s2, 0, 0); p.add('shinL', -6 * s2, 0, 0); p.add('tail', 6 * s2, 0, 0);
    p.add('chest', -9 * f, 0, 0); p.add('head', 6 * f, 0, 0); p.add('jaw', 18 * f, 0, 0);
    p.add('foreL', 0, 0, -8 * s2); p.add('armL', 0, 0, -3 * s2);
    if (kind === 'gunner') p.add('chest', 0, 0, 2.5 * sin(t * 40) * f);
  } else if (kind === 'fall') {
    const a = sin(t * 11), b = sin(t * 13 + 1);
    p.add('armR', 30 * a, 0, 20 * b); p.add('armL', -30 * a, 0, -20 * b); p.add('thighR', 30 * b, 0, 0); p.add('thighL', -30 * b, 0, 0); p.add('shinR', 20 * a, 0, 0); p.add('shinL', -20 * a, 0, 0); p.add('jaw', 8 * a, 0, 0);
  } else if (kind === 'chute') {
    p.add('thighR', 8 * s1, 0, 0); p.add('thighL', -8 * s1, 0, 0); p.add('shinR', 8 * s2, 0, 0); p.add('shinL', -6 * s2, 0, 0); p.add('head', 4 * s2, 8 * s1, 0); p.add('tail', 8 * s1, 0, 0);
  } else {
    p.add('chest', 1.5 * s1, 0, 0); p.add('head', 2 * s2, 0, 1.5 * s1); p.add('tail', 5 * s2, 0, 0);
    if (kind === 'shout') { p.add('jaw', 10 * sin(t * 14), 0, 0); p.add('armR', 4 * sin(t * 7), 0, 0); p.add('chest', 0, 4 * sin(t * 7), 0); }
    if (kind === 'shock') { p.add('armR', 0, 0, 10 * sin(t * 16)); p.add('armL', 0, 0, -10 * sin(t * 16 + 1)); p.add('jaw', 6 * sin(t * 12), 0, 0); }
    if (kind === 'flex') { p.add('foreR', 0, 0, 8 * s1); p.add('foreL', 0, 0, -8 * s1); p.add('chest', -3 * s1, 0, 0); }
  }
  return p;
}

// ============================================================ 配役: モデルを置いて描く係（姿勢の入れ物を使い回す）
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// 置き場所（列ごとの 4×4）。p: モデルの中の点 pivot が来る所, f: モデルの正面が向く先, up: 上の目安, s: 大きさ, roll: 正面の軸まわりの傾き
export function place(p, f, up, s, pivot = Z3, roll = 0) {
  f = nrm(f); let r = crs(up, f); if (Math.hypot(r[0], r[1], r[2]) < 1e-5) r = crs([1, 0, 0], f); r = nrm(r); let u = crs(f, r);
  if (roll) { const c = cos(roll), sn = sin(roll), r2 = [r[0] * c + u[0] * sn, r[1] * c + u[1] * sn, r[2] * c + u[2] * sn]; u = [-r[0] * sn + u[0] * c, -r[1] * sn + u[1] * c, -r[2] * sn + u[2] * c]; r = r2; }
  return [r[0] * s, r[1] * s, r[2] * s, 0, u[0] * s, u[1] * s, u[2] * s, 0, f[0] * s, f[1] * s, f[2] * s, 0,
    p[0] - (r[0] * pivot[0] + u[0] * pivot[1] + f[0] * pivot[2]) * s, p[1] - (r[1] * pivot[0] + u[1] * pivot[1] + f[1] * pivot[2]) * s, p[2] - (r[2] * pivot[0] + u[2] * pivot[1] + f[2] * pivot[2]) * s, 1];
}
// モデルの中の点 → 世界の点
export const xf = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
// m × （点 c を中心に k 倍）
const scaledAbout = (m, c, k) => { const o = m.slice(); for (let i = 0; i < 12; i++) o[i] = m[i] * k; const d = (1 - k); o[12] = m[12] + (m[0] * c[0] + m[4] * c[1] + m[8] * c[2]) * d; o[13] = m[13] + (m[1] * c[0] + m[5] * c[1] + m[9] * c[2]) * d; o[14] = m[14] + (m[2] * c[0] + m[6] * c[1] + m[10] * c[2]) * d; return o; };

export const YPIV = [0, 3.1, 0];                        // ユリアの「当たるところ」（胸）。ここを自分の位置に合わせる
export const BPIV = [0, 2.7, 0];                       // 文鳥の体のまん中
const GEAR = { trooper: [['jetpack', 'chest'], ['bazooka', 'chest']], gunner: [['jetpack', 'chest'], ['gatling', 'chest']], cmd: [['cap', 'head'], ['shades', 'head'], ['cape', 'chest']] };

export class Cast {
  constructor(figs, faces) {
    this.figs = figs; this.faces = faces; this.pool = {}; this.used = {}; this.still = {}; this.ok = !!figs.models.yuria && !!figs.models.buncho;
    // 槍の先（飛ぶ姿勢のとき。胸から見た 右・上・前。頭の半径が 1）
    this.grip = [1.6, -0.6, 0.4]; this.tipZ = 5.7;      // にぎりの位置（飛ぶ姿勢のとき。胸から見た 右・上・前。頭の半径が 1）と、にぎりから穂先までの長さ
    if (this.ok) { const y = figs.models.yuria, p = figs.pose('yuria'); this.tipZ = (y.h.lance || [0, 5.7])[1]; poseYuria(p, { t: 0.68 }).update(); const t = p.at('lance', Z3); this.grip = [t[0] - YPIV[0], t[1] - YPIV[1], t[2] - YPIV[2]]; }
  }
  begin() { for (const k in this.used) this.used[k] = 0; }
  // その こま だけ使う姿勢の入れ物
  pose(name) { const l = this.pool[name] || (this.pool[name] = []), i = this.used[name] || 0; this.used[name] = i + 1; return l[i] || (l[i] = this.figs.pose(name)); }
  // 動かない物（弾・装備）: 姿勢は 1 つを使い回す
  prop(name, m, opt) { const p = this.still[name] || (this.still[name] = this.figs.pose(name)); this.figs.draw(p, m, opt); }
  // ユリア。o: poseYuria の指定 + { mood, lod: 小さく映るときの粗い版 }。戻り値は姿勢（槍の先などを取り出せる）
  yuria(m, o, opt = {}) { const p = this.pose(o.lod && this.figs.models.yuria_lo ? 'yuria_lo' : 'yuria'), fc = this.faces.get(o.mood, o.t || 0); poseYuria(p, { ...o, eyesOpen: fc.open }).update(); this.figs.draw(p, m, { face: fc.tex, ...opt }); return p; }
  // マッスル文鳥と、その装備。kind: 'trooper' | 'gunner' | 'smug' | 'shout' | 'shock' | 'fall' | 'chute' | 'flex'。o: { t, ph, fire, lod: 0 = 細かい / 1 = 戦いの中 / 2 = 遠くの小さな姿, gear: 装備の組, open: 落下傘のひらき }
  buncho(kind, m, o = {}, opt = {}) {
    const name = o.lod === 2 && this.figs.models.buncho_far ? 'buncho_far' : o.lod ? 'buncho_lo' : 'buncho', p = this.pose(name); poseBuncho(p, { ...o, kind }).update(); this.figs.draw(p, m, opt);
    for (const [n0, bone] of GEAR[o.gear || kind] || []) {
      const am = attach(m, p, bone), name = o.lod && this.figs.models[n0 + '_lo'] ? n0 + '_lo' : n0;            // 小さく映るときは、装備も粗い版
      if (n0 === 'gatling') { const g = this.pose(name); g.reset().rot('spin', 0, 0, ((o.t || 0) * (200 + 1400 * sat(o.fire || 0))) % 360).update(); this.figs.draw(g, am, opt); }
      else this.prop(name, am, opt);
    }
    if (kind === 'chute') this.prop('chute', scaledAbout(m, [0, 4.0, 0], Math.max(0.02, o.open ?? 1)), opt);
    return p;
  }
  // 竜。pts: 頭 → 尾の順に、飛んだ道すじをたどる点の列（世界の座標。体の長さより長く、細かく）。S: 大きさ。
  //   背骨の骨を道すじに沿って等間隔に置くので、体は道のとおりにくねる。o: { t, jaw: 口のひらき 0..1, look: 頭を向ける先（世界の向き）, flap }
  //   戻り値: { pose, mouth: 口の先（世界の座標）, head: 頭の位置 }
  dragon(pts, S, o = {}, opt = {}) {
    const md = this.figs.models.dragon, p = this.pose('dragon'), n = md.h.spine, step = md.h.step * S, t = o.t || 0;
    const len = (i) => Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]);
    const P = []; let seg = 0, acc = 0, L = len(0);
    for (let i = 0; i < n; i++) {
      const want = i * step; while (seg + 2 < pts.length && acc + L < want) { acc += L; seg++; L = len(seg); }
      const u = L > 1e-6 ? (want - acc) / L : 0, a = pts[seg], b = pts[seg + 1]; P.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
    }
    p.reset(); let f = [0, 0, 1], r = [1, 0, 0];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dl = Math.hypot(d[0], d[1], d[2]);
      if (dl > 1e-5) f = [d[0] / dl, d[1] / dl, d[2] / dl];
      // 背は上へ。曲がるときは、曲がる内側へ少し傾く
      let rr = crs([0, 1, 0], f); const rl = Math.hypot(rr[0], rr[1], rr[2]); if (rl > 0.05) r = [rr[0] / rl, rr[1] / rl, rr[2] / rl];
      const u = crs(f, r);
      p.setWorld('s' + i, r, u, f, [P[i][0] / S, P[i][1] / S, P[i][2] / S]);
    }
    const fl = sin(t * 5.2), jaw = sat(o.jaw || 0);
    p.rot('jaw', 6 + 30 * jaw + 3 * sin(t * 3.1), 0, 0); p.rot('head', -4 - 8 * jaw, 0, 3 * sin(t * 1.7));
    p.rot('wFR', 0, 8 + 10 * fl, 10 * fl); p.rot('wFL', 0, -8 - 10 * fl, -10 * fl); p.rot('wBR', 0, 6 + 8 * sin(t * 5.2 - 0.9), 8 * sin(t * 5.2 - 0.9)); p.rot('wBL', 0, -6 - 8 * sin(t * 5.2 - 0.9), -8 * sin(t * 5.2 - 0.9));
    if (o.look) { p.update(); p.aim('head', o.look, [0, 1, 0]); }
    p.update();
    const m = [S, 0, 0, 0, 0, S, 0, 0, 0, 0, S, 0, 0, 0, 0, 1], mo = md.h.mouth || [0, -0.2, 3.3];
    this.figs.draw(p, m, opt);
    return { pose: p, mouth: xf(m, p.at('head', [mo[0], mo[1], mo[2] - 0.2])), head: P[0] };
  }
}
