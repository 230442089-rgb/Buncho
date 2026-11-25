// yuria.js — ユリアの絵。
//   飛んでいるあいだは「後ろ姿」（このゲームのために描き起こしたもの）、こちらを向くときは正面の絵（chase/src/chibi.js）。
//   どちらも頭の中心が原点・頭の半径が 1 の座標で描く。翼や角は描かない（設定にないものは足さない）。
import { drawFigure, drawHead, lock, group, capsule, strokeLine as S, fillShape as F, fillStroke as FS, COLORS, STYLE } from '../../chase/src/chibi.js';

const TAU = Math.PI * 2;
const HAIR = '#ffffff', BACK = '#f2eff9', YEL = '#ffd161', LINE = '#6b4f5e';
const CARD = COLORS.CARD, CARD_SH = '#eaa850', SKIN = COLORS.SKIN, SKIRT = '#8d4250', SKIRT_SH = '#6f3040', SHOE = '#6b4a3c';

// 後ろ姿（飛行中）。o: { t: 時刻, sway: 左右のなびき -1..1, boost: 0..1, pitch: -1..1（上昇で +）}
export function drawYuriaBack(c, o = {}) {
  const t = o.t || 0, sw = o.sway || 0, boost = o.boost || 0, pitch = o.pitch || 0;
  const w = (k, ph = 0) => Math.sin(t * k + ph);
  const fl = 0.55 + 0.45 * boost;                         // はためきの強さ
  const len = 1 + 0.10 * pitch;                           // 上昇中は体が長く、下降中は短く見える
  c.save();
  // ---- 腕（体より奥。両手を広げて飛ぶ。加速すると後ろへ引く）
  for (const s of [-1, 1]) {
    const hx = s * (1.60 - 0.42 * boost) + sw * 0.05, hy = 1.14 + 0.52 * boost + 0.05 * w(3.1, s) - 0.10 * s * sw;
    group(c, CARD, [capsule(c, 0.5 * s, 1.2, hx, hy, 0.2, 0.25), () => c.ellipse(hx, hy, 0.27, 0.24, 0, 0, TAU)]);
    const dx = hx - 0.5 * s, dy = hy - 1.2, L = Math.hypot(dx, dy) || 1;
    c.beginPath(); c.arc(hx + dx / L * 0.2, hy + dy / L * 0.2, 0.1, 0, TAU); FS(c, SKIN, 0.02);
    c.beginPath(); c.moveTo(hx - dy / L * 0.24, hy + dx / L * 0.24); c.lineTo(hx + dy / L * 0.24, hy - dx / L * 0.24); S(c, 0.02, CARD_SH);
  }
  // ---- 脚（後ろへ流れる。ぱたぱたと小さく動く）
  for (const s of [-1, 1]) {
    const k = s * w(5.2) * 0.07, ax = s * 0.24 - sw * 0.12, ay = (2.72 + k) * len;
    group(c, SKIN, [capsule(c, 0.22 * s, 1.95 * len, ax, ay, 0.19, 0.15)]);
    c.beginPath(); c.ellipse(ax, ay + 0.12, 0.2, 0.17, 0, 0, TAU); FS(c, SHOE, 0.024);
    c.beginPath(); c.ellipse(ax, ay + 0.15, 0.12, 0.085, 0, 0, TAU); F(c, '#8f6a57');
  }
  // ---- スカート（すそが波打つ）
  {
    const f = 0.10 * fl, y0 = 1.72 * len, y1 = 2.40 * len;
    c.beginPath(); c.moveTo(-0.46, y0); c.lineTo(-0.84 - f, y1 - f + 0.03 * w(7.1));
    c.bezierCurveTo(-0.4, y1 + 0.16 + 0.05 * w(6.3, 1), 0.4, y1 + 0.16 + 0.05 * w(6.3, 2.4), 0.84 + f, y1 - f + 0.03 * w(7.1, 2)); c.lineTo(0.46, y0); c.closePath(); FS(c, SKIRT, 0.026);
    c.save(); c.clip();
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 0.17, y0 + 0.02); c.lineTo(i * 0.34 + 0.02 * w(6, i), y1 + 0.2); S(c, 0.016, SKIRT_SH); }
    c.beginPath(); c.moveTo(-0.95, y1 - 0.14 - f); c.bezierCurveTo(-0.4, y1 + 0.03, 0.4, y1 + 0.03, 0.95, y1 - 0.14 - f); S(c, 0.035, '#fff'); c.restore();
  }
  // ---- カーディガンの背中
  {
    const f = 0.06 * fl, y1 = 1.98 * len;
    c.beginPath(); c.moveTo(-0.48, 1.02); c.bezierCurveTo(-0.62, 1.3, -0.62, 1.7, -0.66 - f, y1 + 0.03 * w(6.6));
    c.quadraticCurveTo(0, y1 + 0.12, 0.66 + f, y1 + 0.03 * w(6.6, 1.7)); c.bezierCurveTo(0.62, 1.7, 0.62, 1.3, 0.48, 1.02); c.closePath(); FS(c, CARD, 0.026);
    c.beginPath(); c.moveTo(-0.6, y1 - 0.12); c.quadraticCurveTo(0, y1 - 0.02, 0.6, y1 - 0.12); S(c, 0.018, CARD_SH);
  }
  // ---- 後ろ髪（背中の上でなびく。毛先は黄色）
  const y1 = 1.86 + 0.28 * fl;
  const locks = [[-0.78, -1.20, y1 - 0.25, 0.60, -0.10, 0.14, 0.0], [0.78, 1.20, y1 - 0.25, 0.60, 0.10, -0.14, 1.3], [-0.42, -0.70, y1 + 0.08, 0.58, -0.06, 0.10, 2.1], [0.42, 0.70, y1 + 0.08, 0.58, 0.06, -0.10, 3.4], [0, 0.06, y1 + 0.16, 0.62, 0.04, -0.04, 4.6]];
  for (const [x0, tx, ty, wd, b1, b2, ph] of locks) {
    const a = 0.10 * fl * w(6.0, ph), b = 0.07 * fl * w(8.3, ph * 1.7);
    lock(c, x0, 0.25, tx - sw * 0.5 + a, ty + b, wd, b1 + sw * 0.10 + 0.5 * a, b2 - 0.6 * a, [BACK, YEL, 0.5], 0.024, 0.3);
  }
  // ---- 後ろ頭
  c.beginPath(); c.moveTo(0, -1.22); c.bezierCurveTo(0.7, -1.24, 1.18, -0.8, 1.18, -0.1); c.bezierCurveTo(1.2, 0.3, 1.1, 0.6, 0.9, 0.8); c.lineTo(-0.9, 0.8); c.bezierCurveTo(-1.1, 0.6, -1.2, 0.3, -1.18, -0.1); c.bezierCurveTo(-1.18, -0.8, -0.7, -1.24, 0, -1.22); c.closePath();
  { const g = c.createLinearGradient(0, -1.2, 0, 0.9); g.addColorStop(0, HAIR); g.addColorStop(0.62, HAIR); g.addColorStop(1, BACK); c.fillStyle = g; c.fill(); }
  c.beginPath(); c.moveTo(0.98, 0.72); c.bezierCurveTo(1.14, 0.5, 1.2, 0.3, 1.18, -0.1); c.bezierCurveTo(1.18, -0.8, 0.7, -1.24, 0, -1.22); c.bezierCurveTo(-0.7, -1.24, -1.18, -0.8, -1.18, -0.1); c.bezierCurveTo(-1.2, 0.3, -1.14, 0.5, -0.98, 0.72); S(c, 0.026);
  // 毛の流れ（つむじから下へ）
  for (const [x1, yc, x2, y2] of [[-0.62, -0.5, -0.74, 0.5], [-0.26, -0.4, -0.32, 0.66], [0.2, -0.4, 0.24, 0.7], [0.6, -0.5, 0.7, 0.5]]) { c.beginPath(); c.moveTo(x1 * 0.3 + 0.08, -1.02); c.quadraticCurveTo(x1, yc, x2, y2); S(c, 0.014, '#d6cde2'); }
  c.beginPath(); c.moveTo(0.02, -1.06); c.quadraticCurveTo(0.2, -1.0, 0.16, -0.86); S(c, 0.016, '#cfc4dc');
  // ---- サイドポニー（後ろから見ると左。結び目から波打って流れる）
  {
    const rx = -1.0, ry = -0.8, up = 0.22 + 0.5 * boost;
    for (const [tx, ty, wd, b1, b2, ph] of [[-1.24, 1.56, 0.36, -0.22, 0.2, 0.3], [-1.66, 1.30, 0.42, -0.3, 0.22, 1.7], [-1.98, 0.80, 0.42, -0.34, 0.16, 2.9], [-2.04, 0.20, 0.36, -0.36, 0.08, 4.2]]) {
      const a = 0.12 * fl * w(6.8, ph);
      lock(c, rx - 0.1, ry + 0.1, tx - sw * (0.45 + ty * 0.3) + a, ty - up * (0.5 + ty * 0.45) + 0.08 * fl * w(9.1, ph), wd, b1 + sw * 0.12 + a * 0.5, b2 + sw * 0.05, [HAIR, YEL, 0.4], 0.024, -0.35);
    }
    for (const [tx, ty, wd, b] of [[-1.46, -1.36, 0.2, 0.3], [-1.16, -1.46, 0.18, -0.2], [-1.7, -1.0, 0.18, 0.34]]) lock(c, rx - 0.04, ry - 0.02, tx - sw * 0.15, ty, wd, b, b * 0.5, HAIR);
    c.beginPath(); c.ellipse(rx - 0.05, ry + 0.02, 0.14, 0.2, -0.55, 0, TAU); FS(c, '#38313c', 0.022);
  }
  // あほ毛
  c.beginPath(); c.moveTo(0.1, -1.2); c.quadraticCurveTo(0.3 + 0.05 * w(5), -1.48, 0.5 + 0.08 * w(5), -1.38); S(c, 0.022);
  c.beginPath(); c.moveTo(-0.12, -1.22); c.quadraticCurveTo(-0.12, -1.46, -0.3 + 0.06 * w(5.6, 1), -1.5); S(c, 0.022);
  c.restore();
}

// こちらを向いたときの姿（空中に浮かぶ）。mood: 'smile' | 'happy' | 'wow' | 'love' | 'calm'
export const FACES = {
  smile: { eyes: 'open', mouth: 'smile', lid: 0.12 },
  happy: { eyes: 'happy', mouth: { kind: 'open', h: 0.2, w: 0.17 }, blush: 1.2 },
  grin: { eyes: 'open', mouth: 'teeth', lid: 0.06 },
  wow: { eyes: 'wide', mouth: 'small', dot: 0.05 },
  oops: { eyes: 'cross', mouth: 'wavy' },
  love: { eyes: 'heart', mouth: { kind: 'open', h: 0.16 }, blush: 1.5, lid: 0 },
  calm: { eyes: 'open', mouth: 'small', lid: 0.3 },
  wink: { eyes: 'open', mouth: 'tongue', lid: 0.1 },
};
export function drawYuriaFront(c, o = {}) {
  const t = o.t || 0, wave = o.wave || 0;
  const face = { ...(FACES[o.mood] || FACES.smile) };
  if (face.eyes === 'open' && (t % 3.7) < 0.12) face.eyes = 'shut';          // まばたき
  const pose = {
    bob: 0, sway: 0.10 * Math.sin(t * 1.7), lift: 0.35 + 0.1 * Math.sin(t * 2.1), flap: 0.5 + 0.3 * Math.sin(t * 2.6),
    legL: 0.30 + 0.12 * Math.sin(t * 1.9), legR: 0.18 + 0.12 * Math.sin(t * 1.9 + 1.4),
    armL: [-1.06, 1.62 + 0.05 * Math.sin(t * 2.3)], armR: wave ? [1.32 + 0.14 * Math.sin(t * 9), 0.36] : [1.06, 1.62 + 0.05 * Math.sin(t * 2.3 + 1)],
    elbR: wave ? [1.02, 1.12] : null, tilt: 0.05 * Math.sin(t * 1.3),
  };
  drawFigure(c, 'yuria', pose, face);
}
export function drawYuriaFace(c, mood = 'smile', t = 0) {
  const face = { ...(FACES[mood] || FACES.smile), sway: 0.06 * Math.sin(t * 1.9) };
  if (face.eyes === 'open' && (t % 3.7) < 0.12) face.eyes = 'shut';
  drawHead(c, 'yuria', face);
}

// 3D の画面に置く 1 枚絵（毎フレーム描き直して、髪や服を動かす）。絵の中心は「胸のあたり」（傾けるときの軸）
export const SPRITE_SPAN = 5.8, SPRITE_PIVOT_Y = 1.0;
export class YuriaSprite {
  constructor(size = 384) {
    this.size = size;
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = size;
    this.c = this.cv.getContext('2d');
  }
  // side: 0 = 後ろ姿, 1 = 正面。その間は「紙がくるっと回る」ように横幅を縮めて切り替える。戻り値: 横幅の倍率
  draw(o) {
    const c = this.c, n = this.size, k = n / SPRITE_SPAN;
    const turn = o.turn || 0, sx = Math.cos(turn * Math.PI);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, n, n);
    c.setTransform(k, 0, 0, k, n / 2, n / 2 - SPRITE_PIVOT_Y * k);
    STYLE.lw = 1.5;
    if (sx >= 0) drawYuriaBack(c, o); else drawYuriaFront(c, o);
    STYLE.lw = 1;
    return Math.max(0.04, Math.abs(sx));
  }
}
