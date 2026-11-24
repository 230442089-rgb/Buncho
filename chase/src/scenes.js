// scenes.js — 場面。どれも「時刻 → 絵」の関数（前のフレームの状態を持たない）。
import { W, H, T, G, BEAT, BAR, DURATION, sat, smoothstep as sm, ease, lerp, clamp, TAU, hash1, noise1, pulse, on2 } from './core.js';
import { drawFigure, drawHead, runPose, tentacle, heart, LINE, STYLE } from './chibi.js';
import { text, bubble, sfx, speedLines, gloom, drops, dust, heartsUp, burst, sofa, cup, table, tray, pillow, blanket, room, hallway, darkTiles, dreamBg, rrect } from './props.js';

// 人物を置く。x, footY: 足もとの位置、s: 頭の半径（どれも px）
function fig(c, who, x, footY, s, pose = {}, face = {}, rot = 0) {
  c.save(); c.translate(x, footY); c.rotate(rot); c.translate(0, -3.14 * s); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';
  STYLE.lw = s < 60 ? lerp(2.2, 1.2, sat((s - 26) / 34)) : s > 170 ? lerp(1, 0.72, sat((s - 170) / 90)) : 1; drawFigure(c, who, pose, face); STYLE.lw = 1; c.restore();
}
function head(c, who, x, y, s, face = {}, rot = 0) { c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round'; drawHead(c, who, face); c.restore(); }
function tent(c, pts, w0, w1, t, o = {}) { return tentacle(c, pts, w0, w1, t, { amp: 14, lw: 4, ...o }); }
const beatBob = (t, k = 1) => -k * Math.abs(Math.sin(Math.PI * t / BEAT));
const K = (t, a, b) => sat((t - a) / (b - a));
const blink = (t, seed = 0) => ((t + seed * 1.37) % 2.9) < 0.11;      // まばたき
const fadeIn = (c, t, t0, d = 0.4, col = '253,251,248') => { const a = 1 - sat((t - t0) / d); if (a > 0.003) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(${col},${a})`; c.fillRect(0, 0, W, H); } };
const flash = (c, k, col = '255,255,255') => { if (k > 0.003) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(${col},${Math.min(1, k)})`; c.fillRect(0, 0, W, H); } };
// カメラ（カットごと。[開始, 終了, 倍率, 注視点 x, y, (終わりの倍率, x, y)]）
function shotCam(shots, t) { for (const sh of shots) if (t >= sh[0] && t < sh[1]) { const u = (t - sh[0]) / (sh[1] - sh[0]); return { s: lerp(sh[2], sh[5] ?? sh[2], u), fx: lerp(sh[3], sh[6] ?? sh[3], u), fy: lerp(sh[4], sh[7] ?? sh[4], u) }; } return { s: 1, fx: W / 2, fy: H / 2 }; }
const setCam = (c, cam) => c.setTransform(cam.s, 0, 0, cam.s, W / 2 - cam.fx * cam.s, H / 2 - cam.fy * cam.s);
const ident = (c) => c.setTransform(1, 0, 0, 1, 0, 0);
const w2s = (cam, x, y) => [(x - cam.fx) * cam.s + W / 2, (y - cam.fy) * cam.s + H / 2];

// ============================================================ 居間（0:00 → 0:25）
const SOFA = [720, 880, 840], YX = 1190, YFOOT = 940, YS = 126, VX = 620, VS = 126, YHEAD = YFOOT - 3.14 * YS;
const LIVING_SHOTS = [[0, T.chill, 1.18, 990, 560, 1.24, 1000, 556], [T.chill, T.vol, 1.72, YX, 505, 1.86, YX, 505], [T.vol, 9.85, 1.12, 900, 540], [9.85, 11.2, 2.0, VX + 40, 340, 2.12, VX + 40, 340],
  [11.2, T.turn, 1.12, 880, 520], [T.turn, T.dark, 1.42, 1250, 560, 1.48, 1270, 560], [T.dark, 22.4, 1.9, VX + 60, 310, 2.06, VX + 60, 305], [22.4, T.dash, 1.08, 930, 530, 1.12, 940, 530]];
function teaKit(c, t, t0) {
  // ヴォルの「おやすみセット」: お茶ふたつ、毛布、枕（触手が持ち上げる）
  const items = [[300, 430, 'tray', 0.0, 330], [1000, 300, 'pillow', 0.25, 960], [430, 210, 'blanket', 0.45, 520]], tips = [];
  items.forEach(([x, y, kind, d, bx], i) => {
    const a = ease.outBack(K(t, t0 + d, t0 + d + 0.6), 1.3); if (a <= 0) { tips.push(null); return; }
    const ty = lerp(640, y, a) + 8 * Math.sin(t * 2 + i), tx = x + 10 * Math.sin(t * 1.3 + i * 2);
    tent(c, [[bx, 660], [lerp(bx, tx, 0.3) - 40, lerp(640, ty, 0.45)], [lerp(bx, tx, 0.8) + 30, lerp(640, ty, 0.8)], [tx, ty + 34]], 58, 30, t, { phase: i * 2, amp: 10 });
    tips.push([tx, ty, kind]);
  });
  return tips;
}
function teaItems(c, t, tips) { for (const q of tips) { if (!q) continue; const [x, y, kind] = q; if (kind === 'tray') tray(c, x, y, 1.0, t); else if (kind === 'pillow') pillow(c, x, y - 30, 1.0, 0.1 * Math.sin(t * 2)); else blanket(c, x, y - 20, 1.0, -0.12 + 0.06 * Math.sin(t * 1.7)); } }

const living = {
  id: 'living', t0: 0, t1: T.dash,
  draw(c, t) {
    const cam = shotCam(LIVING_SHOTS, t), dark = sm(T.dark, T.dark + 0.4, t), tq = on2(t);
    setCam(c, cam); room(c, t);
    if (dark > 0) { ident(c); darkTiles(c, t, dark); setCam(c, cam); }
    // ---- ヴォル（ソファの後ろ）
    const peek = ease.outBack(K(t, T.vol, T.vol + 0.9), 1.2), up = ease.inOutCubic(K(t, 11.25, 11.9));
    const vHeadY = lerp(lerp(640, 352, peek), 262, up);
    const tips = t > 13.4 ? teaKit(c, t, 13.6) : [];
    if (t > T.dark + 0.3) for (let i = 0; i < 9; i++) {          // 増える触手
      const a = ease.outBack(K(t, T.dark + 0.4 + i * 0.12, T.dark + 1.1 + i * 0.12), 1.2); if (a <= 0) continue;
      const an = -Math.PI * 0.5 + (i - 4) * 0.36, L = 420 + 90 * hash1(i * 3.3), bx = VX + (i - 4) * 70;
      const tx = bx + Math.cos(an) * L * a * 1.5 + 20 * Math.sin(t * 2.2 + i), ty = 640 + Math.sin(an) * L * a + 16 * Math.sin(t * 2.8 + i * 1.7);
      tent(c, [[bx, 690], [lerp(bx, tx, 0.35) + 50 * Math.sin(i), lerp(660, ty, 0.4)], [lerp(bx, tx, 0.75) - 40 * Math.sin(i * 2), lerp(660, ty, 0.8)], [tx, ty]], 62, 22, t, { phase: i * 1.3, amp: 20, tip: i % 2 ? 'heart' : 'round' });
    }
    if (t >= T.vol) {
      const talk = (t > 12 && t < 14.2) || (t > 14.6 && t < 16.2);
      const vFace = t < 11.2 ? { eyes: blink(t, 2) ? 'shut' : 'open', lookX: 1, mouth: 'smile', blush: 1.2 } : t < T.dark ? { eyes: 'heart', mouth: talk && Math.floor(tq * 5) % 2 ? 'open' : 'teeth', blush: 1.5 } : { eyes: 'dead', mouth: 'smile', dark, glow: dark * (0.8 + 0.2 * Math.sin(t * 6)), blush: 1.3 };
      fig(c, 'vol', VX, vHeadY + 3.14 * VS, VS, { armL: [-0.5, 1.6], armR: [0.5, 1.6], tilt: t >= T.dark ? 0.2 * sm(T.dark, T.dark + 0.6, t) : 0.05 * Math.sin(t * 1.4), sway: 0.05 * Math.sin(t * 1.6) }, vFace);
    }
    sofa(c, SOFA[0], SOFA[1], SOFA[2]);
    teaItems(c, t, tips);
    table(c, 300, 990, 460);
    // ---- ユリア
    const chill = t >= T.chill, jump = pulse(t, 11.25, 0.25), yx = YX + 150 * ease.inOutSine(K(t, 18.95, 19.65)) + (t > T.dark && t < 24.25 ? noise1(t * 26, 1) * 5 : 0);
    const crouch = sm(24.3, 24.95, t);
    let yPose, yFace;
    if (!chill) { yPose = { armL: [-0.95, 1.05], armR: [0.95, 1.05], bob: beatBob(tq, 0.05), sway: 0.06 * Math.sin(t * 2.2) }; yFace = { lid: 0.3, eyes: blink(t, 1) ? 'shut' : 'open', mouth: t > 1.1 && t < 4.1 && Math.floor(tq * 6) % 2 ? 'open' : 'tongue' }; }
    else if (t < T.turn) { yPose = { armL: [-0.9, 1.5], armR: [0.9, 1.5], bob: -0.22 * jump, lift: 0.25 + 0.5 * jump, squash: -0.03 }; yFace = { eyes: 'wide', dot: 0.04, lookX: t > T.vol ? -1 : 0, mouth: t < T.vol ? 'flat' : 'wavy', blush: 0.3, sweat: 1 }; }
    else if (t < T.dark) { const no = t >= 17.7; yPose = { armL: [-0.95, 1.05 - 0.08 * pulse(t, 17.7, 0.2)], armR: [0.95, 1.05 - 0.08 * pulse(t, 17.7, 0.2)], bob: beatBob(tq * 2, 0.04) - 0.1 * pulse(t, 17.7, 0.15), tilt: no ? 0.1 : -0.06 * Math.sin(t * 5), sway: 0.05 }; yFace = t < 17.7 ? { eyes: 'shut', mouth: 'cat', blush: 0.9 } : t < 18.95 ? { lid: 0.3, mouth: 'tongue', blush: 1.2 } : { eyes: 'happy', mouth: 'smile', sweat: 1, blush: 0.8 }; }
    else { yPose = { armL: [-0.75, 1.25 + 0.5 * crouch], armR: [0.75, 1.25 + 0.5 * crouch], bob: 0.2 * crouch, squash: 0.1 * crouch, lift: 0.3 }; yFace = { eyes: 'wide', dot: 0.03, mouth: 'wavy', tears: 1, blush: 0.2, sweat: 1 }; }
    fig(c, 'yuria', yx, YFOOT, YS, yPose, yFace);
    if (chill && t < T.vol + 1) gloom(c, yx, YFOOT - 4.6 * YS - 40 * sm(T.chill, T.chill + 0.4, t), 230, sm(T.chill, T.chill + 0.3, t) * (1 - sm(T.vol + 0.5, T.vol + 1, t)));
    drops(c, yx + 60, YFOOT - 4.2 * YS, t, 11.25, 4, 1.1); drops(c, yx - 40, YFOOT - 4.3 * YS, t, 22.5, 6, 1.2);
    if (!chill) for (let i = 0; i < 3; i++) { const a = (t * 0.9 + i * 0.33) % 1; c.save(); c.globalAlpha = Math.sin(a * Math.PI) * 0.9; text(c, '♪', YX + 190 + i * 70 + 20 * Math.sin(t * 2 + i), 470 - a * 130 + i * 40, 54, { col: '#f0b24a' }); c.restore(); }
    // ---- 文字（画面の座標）
    ident(c);
    const P = (x, y) => w2s(cam, x, y), yh = P(yx + 110, YHEAD - 60), vh = P(VX + 130, vHeadY - 20);
    bubble(c, t, { t0: 1.1, t1: 4.2, x: 1500, y: 215, text: '今日も よゆーよゆー♪', size: 56, tail: yh });
    sfx(c, t, { t0: T.chill, t1: 6.3, text: 'ぞくっ', x: 1560, y: 250, size: 140, rot: -0.12, col: '#6f84c9', shake: 3 });
    bubble(c, t, { t0: 5.9, t1: T.vol - 0.1, x: 400, y: 300, text: '……なんか、\n背中がさむい', size: 52, kind: 'think', tail: P(YX - 150, YHEAD - 40) });
    sfx(c, t, { t0: T.vol + 0.1, t1: 9.0, text: 'ぬっ', x: 380, y: 260, size: 120, rot: -0.08, col: '#8d7bd0' });
    sfx(c, t, { t0: 8.9, t1: 9.8, text: 'じーーーっ', x: 470, y: 450, size: 70, rot: 0.04, col: '#8d7bd0' });
    bubble(c, t, { t0: 9.95, t1: 11.15, x: 1420, y: 330, text: 'ゆり姉♡', size: 96, tail: P(VX + 150, 330), weight: 900 });
    sfx(c, t, { t0: 11.25, t1: 12.2, text: 'びくっ', x: 1620, y: 300, size: 96, rot: 0.1, col: '#e0708a', shake: 4 });
    bubble(c, t, { t0: 12.0, t1: 14.3, x: 1040, y: 140, text: '今日はもう、\nおしまいにしましょう？♡', size: 46, tail: vh });
    bubble(c, t, { t0: 14.6, t1: T.turn - 0.15, x: 1040, y: 140, text: 'お茶、二人分\nありますからぁ♡', size: 46, tail: vh });
    sfx(c, t, { t0: 17.0, t1: T.dark - 0.1, text: 'う〜ん', x: 470, y: 300, size: 120, rot: -0.12, col: '#ee6f98', fam: 'Hachi Maru Pop' });
    sfx(c, t, { t0: 17.7, t1: T.dark - 0.1, text: 'やだ！♡', x: 520, y: 500, size: 150, rot: -0.07, col: '#ee6f98', fam: 'Hachi Maru Pop' });
    sfx(c, t, { t0: 18.55, t1: T.dark - 0.1, text: 'てへっ♡', x: 1520, y: 300, size: 84, rot: 0.1, col: '#ee6f98', fam: 'Hachi Maru Pop' });
    sfx(c, t, { t0: 19.0, t1: T.dark - 0.02, text: 'そろ〜り…', x: 1480, y: 900, size: 60, rot: -0.04, col: '#8ea2ee', fam: 'Zen Maru Gothic' });
    bubble(c, t, { t0: T.dark + 0.5, t1: 22.3, x: 1400, y: 250, text: '……逃げるん\nですかぁ？♡', size: 68, kind: 'dark', tail: P(VX + 170, 300), weight: 900 });
    bubble(c, t, { t0: 22.5, t1: 24.9, x: 1000, y: 120, text: '逃がしませんよぉ♡', size: 62, kind: 'dark', tail: vh, weight: 900 });
    sfx(c, t, { t0: 22.6, t1: 24.2, text: 'ガクガク', x: 1720, y: 640, size: 70, rot: 0.14, col: '#8ea2ee', shake: 5 });
    sfx(c, t, { t0: 23.5, t1: 24.5, text: 'ひっ', x: 1690, y: 360, size: 110, rot: -0.1, col: '#ff9fb8', shake: 4 });
    for (const sh of LIVING_SHOTS) flash(c, 0.35 * pulse(t, sh[0], 0.05) * (sh[0] > 0 ? 1 : 0));
    fadeIn(c, t, 0, 0.5);
  },
};

// ============================================================ 題（0:25）と、廊下の追いかけっこ（0:26 → 0:34）
function chaseHall(c, t, o = {}) {
  const [vx, vy] = hallway(c, t, 1.7), u = K(t, T.run, T.imagine);
  speedLines(c, vx, vy, t, 0.55, { col: 'rgba(130,110,160,.13)', inner: 360, n: 60 });
  const vs = lerp(46, 92, u), vfy = lerp(vy + 150, vy + 380, u), vxp = vx - 230 + 60 * Math.sin(t * 1.1);
  const g = c.createRadialGradient(vxp, vfy - vs * 2, 0, vxp, vfy - vs * 2, vs * 7.5); g.addColorStop(0, 'rgba(95,62,150,.55)'); g.addColorStop(1, 'rgba(95,62,150,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 10; i++) {            // 壁づたいに伸びてくる触手
    const an = (i / 10) * TAU + 0.3, L = (200 + 620 * u) * (0.7 + 0.5 * hash1(i * 2.9)), tx = vxp + Math.cos(an) * L * 1.5, ty = vfy - vs * 2 + Math.sin(an) * L * 0.8;
    tent(c, [[vxp, vfy - vs * 1.2], [lerp(vxp, tx, 0.3) + 40 * Math.sin(i * 1.7), lerp(vfy - vs * 2, ty, 0.3) - 30], [lerp(vxp, tx, 0.7) - 30 * Math.sin(i), lerp(vfy - vs * 2, ty, 0.72)], [tx, ty]], vs * 0.5, vs * 0.16, t, { phase: i * 1.9, amp: 8 + 14 * u, lw: 2.5 + 1.5 * u, tip: i % 3 === 0 ? 'heart' : 'round' });
  }
  fig(c, 'vol', vxp, vfy + 12 * Math.sin(t * 3), vs, { armL: [-0.98, 0.95], armR: [0.98, 0.95], tilt: 0.14 * Math.sin(t * 1.3), sway: 0.1 * Math.sin(t * 2) }, { eyes: 'dead', mouth: 'smile', dark: 0.85, glow: 0.8 + 0.2 * Math.sin(t * 7), blush: 1.3 });
  if (o.noYuria) return;
  const tq = on2(t, 15), ph = tq / BEAT, alt = Math.floor(t / 1.09) % 2;
  const face = alt ? { eyes: 'cross', mouth: 'scream', tears: 1, blush: 0.4 } : { eyes: 'wide', dot: 0.03, mouth: 'wavy', tears: 1, sweat: 1, blush: 0.3 };
  fig(c, 'yuria', 1270 + 26 * Math.sin(TAU * ph), 1060, 160, runPose(ph, 1), face);
  for (let k = 0; k < 9; k++) drops(c, 1270 + (k % 2 ? 160 : -160), 500, t, T.run + 0.3 + k * 0.82, 3, 1.2);
}
const chase = {
  id: 'chase', t0: T.dash, t1: T.imagine,
  draw(c, t) {
    if (t < T.run) {                        // 題
      c.fillStyle = '#fff6ea'; c.fillRect(0, 0, W, H);
      const tl = t - T.dash, x = lerp(-300, 2300, ease.inOutSine(sat(tl / 1.05)));
      c.save(); c.fillStyle = 'rgba(240,190,120,.3)'; for (let i = 0; i < 26; i++) { const y = hash1(i * 3.1 + Math.floor(t * 15)) * H, w = 300 + 700 * hash1(i * 5.3), xx = hash1(i * 7.7 + Math.floor(t * 15) * 2.1) * W; c.fillRect(xx, y, w, 5 + 8 * hash1(i)); } c.restore();
      dust(c, x - 200, 930, t, T.dash + 0.1, 1.6, 1); dust(c, x - 500, 930, t, T.dash + 0.3, 1.4, 1);
      fig(c, 'yuria', x, 940, 140, { ...runPose(on2(t, 15) / BEAT * 1.4, 1), lean: 0.25 }, { eyes: 'cross', mouth: 'scream', tears: 1 });
      for (let i = 0; i < 4; i++) tent(c, [[-80, 500 + i * 110], [lerp(0, x - 420, 0.5), 470 + i * 120 + 40 * Math.sin(i)], [x - 400 - i * 30, 560 + i * 80]], 70, 26, t, { phase: i * 2, amp: 22, tip: 'heart' });
      sfx(c, t, { t0: T.dash + 0.05, t1: T.run + 0.2, text: 'ゆり姉、まってぇ♡', x: W / 2, y: 300, size: 150, rot: -0.03, col: '#7c5cc4', shake: 5 });
      sfx(c, t, { t0: T.dash + 0.25, t1: T.run + 0.2, text: '〜 ユリア、全力の逃走 〜', x: W / 2, y: 470, size: 52, col: '#e0708a', fam: 'Zen Maru Gothic' });
      flash(c, 0.8 * pulse(t, T.dash, 0.08));
      return;
    }
    chaseHall(c, t);
    sfx(c, t, { t0: T.run + 0.2, t1: T.imagine, text: 'ドドドドド', x: 1640, y: 980, size: 84, rot: -0.06, col: '#e0708a', shake: 6 });
    sfx(c, t, { t0: 28.4, t1: 31.2, text: 'ぬるぬる…', x: 330, y: 860, size: 66, rot: 0.08, col: '#8d7bd0' });
    bubble(c, t, { t0: 27.0, t1: 28.95, x: 1420, y: 210, text: 'ムリムリムリムリ！！', size: 64, kind: 'shout', tail: [1380, 400], shake: 4, weight: 900 });
    bubble(c, t, { t0: 29.2, t1: 31.2, x: 520, y: 170, text: 'ゆり姉〜♡\nまってくださぁい♡', size: 54, kind: 'dark', tail: [700, 400] });
    bubble(c, t, { t0: 31.4, t1: T.imagine - 0.1, x: 1380, y: 200, text: '捕まったら、ぜったい\nもどってこれないやつ！！', size: 50, kind: 'shout', tail: [1380, 400], shake: 3, weight: 900 });
    flash(c, 0.6 * pulse(t, T.run, 0.06));
  },
};

// ============================================================ ユリアの想像（0:34 → 0:42）
// 触手でぐるぐる巻き（頭だけ出ている）
function bundle(c, x, y, s, t, face, o = {}) {
  const wob = o.wiggle ? 0.06 * Math.sin(t * 22) * o.wiggle : 0.03 * Math.sin(t * 1.6);
  c.save(); c.translate(x, y); c.rotate(wob + (o.rot || 0)); c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.ellipse(0, 0, 1.2 * s, 1.42 * s, 0, 0, TAU); c.fillStyle = '#d9cbf6'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 0.03 * s; c.stroke();
  c.save(); c.clip();
  for (let i = 0; i < 6; i++) { const yy = (-1.15 + i * 0.46) * s, g = c.createLinearGradient(-1.2 * s, 0, 1.2 * s, 0); g.addColorStop(0, i % 2 ? '#cdbdf2' : '#e4c2ea'); g.addColorStop(1, i % 2 ? '#f6b5d2' : '#cdbdf2'); c.beginPath(); c.moveTo(-1.4 * s, yy); c.quadraticCurveTo(0, yy + 0.36 * s + 0.03 * s * Math.sin(t * 2 + i), 1.4 * s, yy - 0.06 * s); c.lineTo(1.4 * s, yy + 0.3 * s); c.quadraticCurveTo(0, yy + 0.7 * s, -1.4 * s, yy + 0.36 * s); c.closePath(); c.fillStyle = g; c.fill(); c.strokeStyle = LINE; c.lineWidth = 0.026 * s; c.stroke(); c.beginPath(); c.moveTo(-1.0 * s, yy + 0.2 * s); c.quadraticCurveTo(0, yy + 0.46 * s, 0.9 * s, yy + 0.1 * s); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.035 * s; c.stroke(); }
  c.restore();
  c.beginPath(); c.ellipse(0, 0, 1.2 * s, 1.42 * s, 0, 0, TAU); c.strokeStyle = LINE; c.lineWidth = 0.03 * s; c.stroke();
  tentacle(c, [[0.9 * s, 0.9 * s], [1.5 * s, 0.5 * s], [1.6 * s, -0.2 * s], [1.3 * s, -0.7 * s]], 0.34 * s, 0.14 * s, t, { amp: 0.06 * s, lw: 0.028 * s, tip: 'heart' });
  c.save(); c.translate(0, -1.72 * s); c.rotate(o.headTilt || 0); c.scale(s * 0.98, s * 0.98); drawHead(c, 'yuria', { sway: 0.03 * Math.sin(t * 1.5), ...face }); c.restore();
  c.restore();
}
function steam(c, x, y, t, k = 1) { for (let i = 0; i < 3; i++) { const a = (t * 0.5 + i / 3) % 1; c.save(); c.globalAlpha = Math.sin(a * Math.PI) * 0.8 * k; heart(c, x + (i - 1) * 70 + 14 * Math.sin(t * 2 + i), y - a * 150, 20 + 8 * i, '#ffa9c4'); c.restore(); } }
const STAGES = [[34.5, '1 日目'], [36.4, '30 日目'], [38.2, '100 年目'], [39.9, '一生']];
function dreamContent(c, t) {
  dreamBg(c, t);
  heartsUp(c, t, { n: 22, size: 26, alpha: 0.6, col: '#ffb3cb' });
  const st = STAGES.filter((s) => t >= s[0]).length - 1, tq = on2(t);
  const kissT = [35.0, 35.9, 36.9, 37.5, 38.7, 39.3, 40.3, 40.75], kiss = kissT.reduce((m, k) => Math.max(m, pulse(t, k, 0.22) * (t >= k ? 1 : 0)), 0);
  c.save(); c.translate(960, 640); c.scale(1.32, 1.32); c.translate(-930, -650);
  // 大きなクッション
  c.beginPath(); c.ellipse(940, 890, 640, 130, 0, 0, TAU); c.fillStyle = '#fff5fa'; c.fill(); c.strokeStyle = '#e7b6c9'; c.lineWidth = 5; c.stroke();
  fig(c, 'vol', 700 + 60 * kiss, 930, 150, { armL: [-0.3, 1.6], armR: [1.55, 1.25], legL: 1, legR: 1, tilt: 0.18 + 0.2 * kiss, hx: 0.3 * kiss, sway: 0.05 * Math.sin(t * 2) }, { eyes: 'happy', mouth: kiss > 0.3 ? 'kiss' : 'cat', blush: 1.7 });
  const yFace = st <= 0 ? { lid: 0.45, lookX: 1, mouth: 'flat', blush: 1.0, sweat: 1 } : st === 1 ? { eyes: 'shut', mouth: 'wavy', blush: 1.7 } : st === 2 ? { eyes: 'melt', mouth: 'drool', blush: 2.1 } : { eyes: 'heart', lid: 0.45, mouth: 'drool', blush: 2.4 };
  bundle(c, 1090, 700, 150, t, yFace, { headTilt: st >= 2 ? 0.16 + 0.05 * Math.sin(t * 2) : -0.04 * kiss, rot: 0.05 });
  if (st >= 2) steam(c, 1090, 330, t);
  kissT.forEach((k, i) => { burst(c, 930, 430, t, k, { n: 6, r: 150, size: 18, dur: 0.5 }); });
  c.restore();
  kissT.forEach((k, i) => sfx(c, t, { t0: k, t1: k + 0.5, text: 'ちゅっ♡', x: 1000 + (i % 2) * 50, y: 215 - (i % 3) * 22, size: 96, rot: -0.12 + 0.08 * (i % 3), col: '#ff6f9f', fam: 'Zen Maru Gothic' }));
  // 日数の札
  const flip = STAGES.reduce((m, s) => Math.max(m, pulse(t, s[0], 0.12) * (t >= s[0] ? 1 : 0)), 0);
  c.save(); c.translate(300, 150); c.rotate(-0.04); c.scale(1, 1 - 0.7 * flip); rrect(c, -230, -80, 460, 160, 26); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 6; c.stroke(); c.fillStyle = '#ff9dbb'; rrect(c, -230, -80, 460, 44, 22); c.fill(); text(c, 'つかまって', 0, -57, 30, { col: '#fff', weight: 900 }); text(c, STAGES[Math.max(0, st)][1], 0, 24, 82, { weight: 900, col: st >= 3 ? '#e0447a' : LINE }); c.restore();
  text(c, '※ ユリアの想像です', 1650, 70, 36, { col: '#c98aa5', weight: 700 });
  sfx(c, t, { t0: 38.2, t1: 41.25, text: '触手で とろっとろ♡', x: 380, y: 560, size: 70, rot: -0.07, col: '#b56fd0', fam: 'Zen Maru Gothic' });
  sfx(c, t, { t0: 39.9, t1: 41.25, text: '一生 ちゅっちゅ♡', x: 1560, y: 600, size: 78, rot: 0.06, col: '#ff5f93', fam: 'Zen Maru Gothic' });
}
function closeRun(c, t, face, o = {}) {       // 走るユリアの寄り（上半身）
  hallway(c, t, 1.7); speedLines(c, W / 2, 420, t, 0.5, { col: 'rgba(130,110,160,.13)', inner: 420, n: 60 });
  const tq = on2(t, 15), ph = tq / BEAT * (o.rate || 1), p = runPose(ph, o.panic ?? 0.7);
  fig(c, 'yuria', 960 + 20 * Math.sin(TAU * ph), 1500, 250, { ...p, hx: o.hx || 0, tilt: (p.tilt || 0) + (o.tilt || 0) }, face);
}
const dream = {
  id: 'dream', t0: T.imagine, t1: T.no,
  draw(c, t) {
    const tl = t - T.imagine, back = 41.25;
    if (t < back) {
      if (tl < 0.5) { chaseHall(c, T.imagine - 0.03); c.save(); c.beginPath(); c.arc(1010, 520, ease.inOutCubic(tl / 0.5) * 1500 + 1, 0, TAU); c.clip(); dreamContent(c, t); c.restore(); for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(1010 + i * 40, 520 - i * 50, 30 + i * 16, 0, TAU); c.fillStyle = '#fff5fa'; c.globalAlpha = 1 - sat(tl / 0.3); c.fill(); c.globalAlpha = 1; } }
      else dreamContent(c, t);
    } else {
      closeRun(c, t, { eyes: 'melt', mouth: 'drool', blush: 2.0 }, { panic: 0.2, rate: 0.5 });
      const k = 1 - ease.inOutCubic(sat((t - back) / 0.35));
      if (k > 0) { c.save(); c.beginPath(); c.arc(960, 380, k * 1500 + 1, 0, TAU); c.clip(); dreamContent(c, back - 0.01); c.restore(); }
      steam(c, 960, 190, t, 0.8);
      bubble(c, t, { t0: back + 0.2, t1: T.no - 0.05, x: 1480, y: 300, text: '……ちょっと、\nいいかも……♡', size: 58, kind: 'think', tail: [1210, 520] });
    }
  },
};

// ============================================================ いやいやいや → 『波』（0:42 → 0:51）
const WAVE_Y = 900, WY = 1480, WV = 430, WS = 124;
const wave = {
  id: 'wave', t0: T.no, t1: T.esc,
  draw(c, t) {
    if (t < T.wave) {
      const shake = t < 43.6 ? 0.2 * Math.sin(t * 46) * (1 - sat((t - 42.62) / 1.0)) : 0;
      closeRun(c, t, t < 44.2 ? { eyes: 'cross', mouth: 'scream', blush: 1.2 } : { eyes: 'wide', dot: 0.035, mouth: 'scream', tears: 1, blush: 0.5 }, { hx: shake, panic: 1 });
      bubble(c, t, { t0: T.no + 0.05, t1: 44.2, x: 1500, y: 300, text: 'いやいやいや！！', size: 78, kind: 'shout', tail: [1220, 520], shake: 5, weight: 900 });
      bubble(c, t, { t0: 44.35, t1: T.wave - 0.1, x: 440, y: 300, text: 'あーしが もどって\nこれなくなるじゃん！！', size: 54, kind: 'shout', tail: [720, 520], shake: 3, weight: 900 });
      flash(c, 0.5 * pulse(t, T.no, 0.06));
      return;
    }
    // 横並びの構図: 左にヴォル、右にユリア
    const wcam = { s: 1.24, fx: 955, fy: 610 }; setCam(c, wcam);
    c.fillStyle = '#fdfbf8'; c.fillRect(-400, -400, W + 800, H + 800); c.fillStyle = '#f7f0e9'; c.fillRect(-400, WAVE_Y - 30, W + 800, H); c.beginPath(); c.moveTo(-400, WAVE_Y - 30); c.lineTo(W + 400, WAVE_Y - 30); c.strokeStyle = '#d9cbc3'; c.lineWidth = 4; c.stroke();
    const tw = t - T.wave, frozen = tw > 0.38, fall = Math.max(0, t - 47.65), regrow = t - 49.75, tq = on2(t);
    const palm = [WY - 1.72 * WS, WAVE_Y - 3.14 * WS + 1.12 * WS];
    // 止められた触手（灰色に固まって、落ちる）
    if (t < 49.3) for (let i = 0; i < 6; i++) {
      const ty = 300 + i * 95, tx = lerp(700, 1130 - (i % 2) * 60, sat(tw / 0.38 + 0.6)), dy = fall > 0 ? 900 * (fall - i * 0.05 > 0 ? (fall - i * 0.05) ** 2 : 0) : 0;
      c.save(); c.translate(0, dy); tent(c, [[WV + 40, 620], [lerp(WV, tx, 0.35), 560 + (i - 2.5) * 50], [lerp(WV, tx, 0.75), ty + 30 * Math.sin(i * 2)], [tx, ty]], 56, 22, frozen ? 0 : t, { phase: i * 1.7, amp: frozen ? 0 : 20, tip: i % 2 ? 'heart' : 'round', col: frozen ? ['#ecebf3', '#f7f6fb'] : undefined }); c.restore();
    }
    if (regrow > 0) for (let i = 0; i < 13; i++) {              // 作り直した触手（倍）
      const a = ease.outBack(K(regrow, i * 0.05, 0.5 + i * 0.05), 1.4); if (a <= 0) continue;
      const an = -1.35 + i * 0.2, L = (470 + 140 * hash1(i * 2.2)) * a, tx = WV + 80 + Math.cos(an) * L * 1.5, ty = 640 + Math.sin(an) * L;
      tent(c, [[WV + 30, 660], [lerp(WV, tx, 0.35) + 30 * Math.sin(i), lerp(640, ty, 0.4) - 30], [lerp(WV, tx, 0.75), lerp(640, ty, 0.82)], [tx, ty]], 56, 20, t, { phase: i * 1.3, amp: 22, tip: i % 2 ? 'heart' : 'round' });
    }
    const vHappy = t > 48.2;
    fig(c, 'vol', WV, WAVE_Y, WS, { armL: [-0.4, 1.5], armR: [0.5, vHappy ? 0.85 : 1.5], tilt: vHappy ? 0.16 : 0.05 * Math.sin(t * 2), bob: -0.06 + 0.03 * Math.sin(t * 3) }, t < 48.2 ? { eyes: 'dead', mouth: 'smile', dark: 0.7, glow: 0.8, blush: 1.2 } : { eyes: 'happy', mouth: Math.floor(tq * 5) % 2 && t < 49.8 ? 'open' : 'cat', blush: 1.6 });
    // 波（手のひらから左へ広がる輪）
    for (let i = 0; i < 5; i++) { const a = tw - i * 0.11; if (a < 0 || a > 1.1) continue; const r = 60 + a * 1100; c.save(); c.globalAlpha = (1 - a / 1.1) ** 1.3; c.beginPath(); c.arc(palm[0], palm[1], r, Math.PI - 0.75, Math.PI + 0.75); c.strokeStyle = '#ffcf5a'; c.lineWidth = 16 * (1 - a / 1.1) + 3; c.lineCap = 'round'; c.stroke(); c.beginPath(); c.arc(palm[0], palm[1], r - 14, Math.PI - 0.7, Math.PI + 0.7); c.strokeStyle = '#fff3c4'; c.lineWidth = 5; c.stroke(); c.restore(); }
    const run = sm(50.55, 51.3, t), yx = WY + 800 * run * run;
    const yPose = t < 48.0 ? { armL: [-1.72, 1.12], armR: [0.8, 1.5], lean: -0.06, lift: 0.3, sway: 0.2, bob: -0.05 * pulse(t, T.wave, 0.15) } : t < 50.5 ? { armL: [-0.9, 1.5], armR: [0.9, 1.5], lift: 0.4 * pulse(t, 49.8, 0.3), bob: -0.15 * pulse(t, 49.8, 0.2) } : { ...runPose(on2(t, 15) / BEAT, 1), lean: 0.2 };
    const yFace = t < 48.0 ? { lid: 0, browTilt: 0.35, mouth: 'open', blush: 0.5 } : t < 49.75 ? { lid: 0.3, mouth: 'cat', blush: 0.8 } : { eyes: 'wide', dot: 0.03, mouth: 'wavy', tears: t > 50.3 ? 1 : 0, sweat: 1, blush: 0.3 };
    fig(c, 'yuria', yx, WAVE_Y, WS, yPose, yFace);
    if (t > 50.5) dust(c, WY + 60, WAVE_Y - 10, t, 50.6, 1.3, 1);
    ident(c);
    bubble(c, t, { t0: T.wave - 0.02, t1: 47.95, x: 1290, y: 120, text: '止まれっ！ ——『波』！', size: 54, kind: 'shout', tail: [1560, 330], weight: 900 });
    sfx(c, t, { t0: T.wave + 0.4, t1: 47.6, text: 'ぴたっ', x: 620, y: 960, size: 120, rot: -0.06, col: '#e2a92c' });
    sfx(c, t, { t0: 47.75, t1: 48.6, text: 'ぽとっ', x: 800, y: 900, size: 76, rot: 0.08, col: '#a79fbd' }); sfx(c, t, { t0: 47.95, t1: 48.8, text: 'ぽとっ', x: 1130, y: 950, size: 66, rot: -0.1, col: '#a79fbd' });
    bubble(c, t, { t0: 48.3, t1: 49.9, x: 760, y: 150, text: 'まぁ♡　では、\n作り直しますねぇ♡', size: 54, tail: [420, 330] });
    sfx(c, t, { t0: 49.8, t1: 51.2, text: 'にょきにょきにょき', x: 860, y: 110, size: 80, rot: -0.04, col: '#b56fd0', shake: 3 });
    if (regrow > 0.5) { c.save(); c.translate(230, 250); c.rotate(-0.2); c.globalAlpha = sat((regrow - 0.5) / 0.15); rrect(c, -120, -44, 240, 88, 14); c.strokeStyle = '#e0447a'; c.lineWidth = 7; c.stroke(); text(c, '最適化♡', 0, 4, 50, { col: '#e0447a', weight: 900, heart: '#e0447a' }); c.restore(); }
    bubble(c, t, { t0: 50.05, t1: 51.25, x: 1560, y: 190, text: 'ずるっ！！', size: 80, kind: 'shout', tail: [1600, 340], shake: 4, weight: 900 });
    flash(c, 0.5 * pulse(t, T.wave, 0.07), '255,240,200');
  },
};

// ============================================================ 町内 → 地球 → 月（0:51 → 1:00）
function stars(c, n = 90, seed = 0) { for (let i = 0; i < n; i++) { c.beginPath(); c.arc(hash1(i * 2.3 + seed) * W, hash1(i * 5.9 + seed) * H, 1.5 + 2.5 * hash1(i * 7.1), 0, TAU); c.fillStyle = `rgba(255,250,235,${0.4 + 0.6 * hash1(i * 3.3)})`; c.fill(); } }
function plate(c, t, t0, str, sub = '') { const a = ease.outBack(K(t, t0, t0 + 0.25), 1.6); if (a <= 0) return; c.save(); c.translate(250, 120); c.rotate(-0.05); c.scale(a, a); rrect(c, -190, -64, 380, 128, 24); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 6; c.stroke(); text(c, str, 0, sub ? -14 : 4, 60, { weight: 900 }); if (sub) text(c, sub, 0, 36, 28, { col: '#c98aa5', weight: 700 }); c.restore(); }
const escalate = {
  id: 'escalate', t0: T.esc, t1: T.home,
  draw(c, t) {
    const A = T.esc, B = A + 2.9, C = B + 2.9, tq = on2(t, 15), ph = tq / BEAT;
    if (t < B) {                                   // 町内
      const g = c.createLinearGradient(0, 0, 0, 830); g.addColorStop(0, '#e8f4fd'); g.addColorStop(1, '#fdfbf8'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(((i * 560 + t * 30) % 2300) - 150, 150 + i * 60, 110, 34, 0, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); }
      c.fillStyle = '#f3ece1'; c.fillRect(0, 830, W, 250); c.beginPath(); c.moveTo(0, 830); c.lineTo(W, 830); c.strokeStyle = '#d9cbc3'; c.lineWidth = 4; c.stroke();
      [[260, 300, '#ffe1e8'], [640, 240, '#e3ecfb'], [960, 330, '#fff0cf'], [1300, 250, '#e4f5e6'], [1640, 300, '#efe4f8']].forEach(([x, h, col], i) => {
        rrect(c, x - 130, 830 - h, 260, h, 8); c.fillStyle = col; c.fill(); c.strokeStyle = '#cbbdb6'; c.lineWidth = 4; c.stroke();
        c.beginPath(); c.moveTo(x - 160, 830 - h); c.lineTo(x, 830 - h - 110); c.lineTo(x + 160, 830 - h); c.closePath(); c.fillStyle = '#f6c9bd'; c.fill(); c.stroke();
        rrect(c, x + 30, 830 - h + 50, 60, 60, 6); c.fillStyle = '#ffffff'; c.fill(); c.stroke();
        if (i) { rrect(c, x - 90, 830 - 130, 70, 130, 6); c.fillStyle = '#d9c2a5'; c.fill(); c.stroke(); }
      });
      const dk = ease.outBack(K(t, A + 0.1, A + 0.4), 2); c.save(); c.translate(170, 830); c.rotate(-1.4 * dk); rrect(c, 0, -130, 70, 130, 6); c.fillStyle = '#d9c2a5'; c.fill(); c.strokeStyle = '#cbbdb6'; c.lineWidth = 4; c.stroke(); c.restore();
      const yx = lerp(190, 2300, K(t, A + 0.15, A + 2.2)), vx = lerp(60, 2300, K(t, A + 0.8, B + 0.1));
      for (let k = 0; k < 6; k++) dust(c, lerp(190, 2300, K(A + 0.3 + k * 0.33, A + 0.15, A + 2.2)), 838, t, A + 0.3 + k * 0.33, 0.8, 1);
      for (let i = 0; i < 4; i++) tent(c, [[vx - 20, 700], [vx + 120, 560 + i * 60], [vx + 270 + 30 * Math.sin(t * 9 + i), 540 + i * 70]], 40, 15, t, { phase: i * 2, amp: 12, lw: 3.5, tip: 'heart' });
      fig(c, 'vol', vx, 806 + 8 * Math.sin(t * 4), 66, { armL: [-0.98, 0.95], armR: [0.98, 0.95] }, { eyes: 'dead', mouth: 'smile', dark: 0.7, glow: 1 });
      fig(c, 'yuria', yx, 836, 66, { ...runPose(ph, 1), lean: 0.2 }, { eyes: 'cross', mouth: 'scream', tears: 1 });
      sfx(c, t, { t0: A + 0.1, t1: A + 0.9, text: 'ばーん！', x: 330, y: 560, size: 90, rot: -0.1, col: '#e0708a' });
      plate(c, t, A + 0.15, '町内 一周', 'にげた距離  3 km');
    } else if (t < C) {                            // 地球
      c.fillStyle = '#23264a'; c.fillRect(0, 0, W, H); stars(c, 110, 1);
      const cx = 960, cy = 600, R = 300, th = -Math.PI / 2 + TAU * 0.62 * (t - B), rot = t * 0.25;
      const gl = c.createRadialGradient(cx, cy, R, cx, cy, R + 90); gl.addColorStop(0, 'rgba(150,210,255,.5)'); gl.addColorStop(1, 'rgba(150,210,255,0)'); c.fillStyle = gl; c.beginPath(); c.arc(cx, cy, R + 90, 0, TAU); c.fill();
      c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fillStyle = '#bfe3f7'; c.fill(); c.save(); c.clip();
      for (let i = 0; i < 7; i++) { const a = rot + i * 0.9, lx = cx + Math.cos(a) * R * 0.95 * Math.cos(i), ly = cy + (hash1(i * 3.3) - 0.5) * R * 1.5; c.beginPath(); c.ellipse(lx, ly, 70 + 50 * hash1(i * 5.1), 46 + 30 * hash1(i * 2.2), i, 0, TAU); c.fillStyle = '#cdeccd'; c.fill(); }
      c.restore(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.strokeStyle = LINE; c.lineWidth = 5; c.stroke();
      const on = (a, s, who, pose, face) => { fig(c, who, cx + Math.cos(a) * R, cy + Math.sin(a) * R, s, pose, face, a + Math.PI / 2); };
      const va = th - 0.75, rib = []; for (let i = 0; i <= 5; i++) { const a = va + 0.1 + i * 0.1; rib.push([cx + Math.cos(a) * (R + 60 + 14 * Math.sin(i + t * 8)), cy + Math.sin(a) * (R + 60 + 14 * Math.sin(i + t * 8))]); }
      tent(c, rib, 26, 10, t, { amp: 6, lw: 3, tip: 'heart' });
      on(va, 50, 'vol', { armL: [-0.98, 0.95], armR: [0.98, 0.95], bob: -0.3 }, { eyes: 'dead', mouth: 'smile', dark: 0.7, glow: 1 });
      on(th, 50, 'yuria', runPose(ph, 1), { eyes: 'cross', mouth: 'scream', tears: 1 });
      plate(c, t, B + 0.1, '地球 一周', `ただいま ${1 + Math.floor((t - B) * 0.62 + 0.25)} 周目`);
      sfx(c, t, { t0: B + 0.5, t1: C, text: 'ドドドドド', x: 1560, y: 880, size: 70, rot: -0.06, col: '#ff9fb8', shake: 5, stroke: '#23264a' });
    } else {                                       // 月
      c.fillStyle = '#1c1e3c'; c.fillRect(0, 0, W, H); stars(c, 130, 5);
      c.beginPath(); c.arc(330, 230, 84, 0, TAU); c.fillStyle = '#bfe3f7'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 4; c.stroke(); c.beginPath(); c.ellipse(310, 215, 30, 20, 0.5, 0, TAU); c.fillStyle = '#cdeccd'; c.fill();
      const hk = ease.outBack(K(t, C + 0.9, C + 1.8), 1.3);           // 触手でできた大きなハート
      if (hk > 0) { c.save(); c.translate(1150, 360); c.scale(hk * 250, hk * 250); c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0.9); c.bezierCurveTo(-1.5, -0.2, -0.7, -1.2, 0, -0.45); c.bezierCurveTo(0.7, -1.2, 1.5, -0.2, 0, 0.9); c.strokeStyle = LINE; c.lineWidth = 0.2; c.stroke(); c.strokeStyle = '#e9b3de'; c.lineWidth = 0.15; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 0.03; c.stroke(); c.restore(); }
      const mc = [960, 2150], MR = 1350, surf = (x) => mc[1] - Math.sqrt(MR * MR - (x - mc[0]) ** 2);
      c.beginPath(); c.arc(mc[0], mc[1], MR, 0, TAU); c.fillStyle = '#f4edd3'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 5; c.stroke();
      for (const [x, r] of [[420, 60], [760, 34], [1240, 80], [1580, 44], [1010, 26]]) { c.beginPath(); c.ellipse(x, surf(x) + 60 + r * 0.3, r, r * 0.34, 0, 0, TAU); c.fillStyle = '#e4d9b4'; c.fill(); c.strokeStyle = '#c9bb92'; c.lineWidth = 3; c.stroke(); }
      const yx = lerp(380, 1560, K(t, C, T.home)), vx = lerp(-80, 1010, K(t, C + 0.2, T.home));
      for (let i = 0; i < 3; i++) tent(c, [[vx - 10, surf(vx) - 90], [vx + 90, surf(vx) - 200 - i * 40], [vx + 190 + 20 * Math.sin(t * 9 + i), surf(vx) - 190 - i * 60]], 34, 13, t, { phase: i * 2, amp: 10, lw: 3, tip: 'heart' });
      fig(c, 'vol', vx, surf(vx) - 24 + 8 * Math.sin(t * 4), 74, { armL: [-0.98, 0.95], armR: [0.98, 0.95] }, { eyes: 'heart', mouth: 'cat', blush: 1.6 });
      fig(c, 'yuria', yx, surf(yx) + 4 - 30 * Math.abs(Math.sin(TAU * ph / 2)), 74, { ...runPose(ph, 1), lean: 0.15 }, { eyes: 'cross', mouth: 'scream', tears: 1 });
      plate(c, t, C + 0.1, '月', 'にげた距離  38 万 km');
      bubble(c, t, { t0: C + 0.4, t1: C + 1.9, x: 1540, y: 330, text: 'しつこいって〜〜！！', size: 56, kind: 'shout', tail: [yx + 90, surf(yx) - 330], weight: 900 });
      bubble(c, t, { t0: C + 2.0, t1: T.home - 0.05, x: 520, y: 420, text: '愛ですよぉ♡', size: 64, tail: [vx + 60, surf(vx) - 350], weight: 900 });
    }
    for (const k of [A, B, C]) flash(c, 0.6 * pulse(t, k, 0.06));
  },
};

// ============================================================ 帰宅 → つかまる（1:00 → 1:09）
function volEye(c, x, y, s, open) {       // ソファに浮かぶ目（淡い青・白いまつげ）
  if (open <= 0.02) return; c.save(); c.translate(x, y); c.scale(s, s * open); c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.ellipse(0, 0, 0.3, 0.3, 0, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.beginPath(); c.ellipse(0, 0.02, 0.2, 0.27, 0, 0, TAU); const g = c.createLinearGradient(0, -0.3, 0, 0.3); g.addColorStop(0, '#8fa6dc'); g.addColorStop(1, '#e6eefc'); c.fillStyle = g; c.fill();
  c.beginPath(); c.ellipse(0, 0.03, 0.07, 0.13, 0, 0, TAU); c.fillStyle = 'rgba(70,85,140,.8)'; c.fill(); c.beginPath(); c.arc(-0.08, -0.1, 0.06, 0, TAU); c.fillStyle = '#fff'; c.fill();
  c.beginPath(); c.moveTo(-0.34, -0.2); c.quadraticCurveTo(0, -0.42, 0.34, -0.22); c.strokeStyle = LINE; c.lineWidth = 0.1; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 0.055; c.stroke(); c.restore();
}
const HOME_SHOTS = [[T.home, 65.75, 1.14, 960, 545, 1.2, 980, 545], [65.75, T.caught, 1.3, 900, 520, 1.5, 900, 505]];
const home = {
  id: 'home', t0: T.home, t1: T.caught,
  draw(c, t) {
    const cam = shotCam(HOME_SHOTS, t), tq = on2(t), mim = sm(65.8, 66.5, t);
    setCam(c, cam); room(c, t);
    // ソファ（じつはヴォル）: 白っぽくなり、目がひらき、触手の腕がのびる
    const sc = (a, b) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], mim * 0.75))).join(',')})`;
    if (t > 66.6) for (let i = 0; i < 6; i++) { const a = ease.outCubic(K(t, 66.7 + i * 0.12, 68.3 + i * 0.05)), side = i % 2 ? 1 : -1, bx = SOFA[0] + side * (300 + 30 * (i >> 1)), tx = lerp(bx, 1190 + side * (150 - 40 * (i >> 1)), a), ty = lerp(600, 380 + (i >> 1) * 140, a); tent(c, [[bx, 640], [bx + side * 220 * a, 330 + 40 * i], [lerp(bx, tx, 0.8), ty - 60 * (1 - a)], [tx, ty]], 60, 24, t, { phase: i * 1.5, amp: 18, tip: 'heart' }); }
    sofa(c, SOFA[0], SOFA[1], SOFA[2], { main: sc([220, 211, 243], [250, 249, 255]), seat: sc([232, 225, 249], [255, 255, 255]) });
    volEye(c, SOFA[0] + 130, SOFA[1] - 330 * 0.93, 150, ease.outBack(K(t, 65.95, 66.4), 1.6) * (1 - 0.9 * pulse(t, 67.0, 0.08)));
    table(c, 300, 990, 460);
    const enter = ease.outCubic(K(t, T.home, T.home + 0.75)), yx = lerp(2250, YX, enter);
    let pose, face;
    if (t < T.home + 0.75) { pose = { ...runPose(on2(t, 15) / BEAT, 1), lean: -0.25 * (1 - enter) }; face = { eyes: 'cross', mouth: 'scream', tears: 1 }; }
    else if (t < 63.5) { const br = Math.sin(t * 7); pose = { armL: [-0.6, 2.05], armR: [0.6, 2.05], lean: 0, bob: 0.2 + 0.05 * br, squash: 0.08 + 0.02 * br, tilt: 0.1 }; face = { eyes: 'shut', mouth: br > 0 ? 'open' : 'small', sweat: 1, blush: 1.4 }; }
    else if (t < 65.8) { pose = { armL: [-0.9, 1.5], armR: [0.85, 0.55], bob: beatBob(tq, 0.04) }; face = { lid: 0.3, mouth: Math.floor(tq * 6) % 2 && t > 63.9 && t < 65.4 ? 'open' : 'tongue', sweat: 1 }; }
    else { const stiff = sm(66.3, 66.6, t); pose = { armL: [-0.85, 1.6], armR: [0.85, 1.6], squash: -0.04 * stiff, lift: 0.4 * stiff, tilt: t > 67.5 ? -0.18 * sm(67.5, 68.4, t) : 0 }; face = { eyes: 'wide', dot: 0.03, lookX: t > 67.5 ? -1 : 0, mouth: stiff > 0.5 ? 'wavy' : 'flat', sweat: 1, blush: 0.3, tears: t > 68 ? 1 : 0 }; }
    fig(c, 'yuria', yx + (t > 66.4 ? noise1(t * 26, 2) * 4 : 0), YFOOT, YS, pose, face);
    dust(c, YX + 260, YFOOT - 10, t, T.home + 0.45, 1.3, -1);
    if (t > 66.3 && t < 68) gloom(c, YX, YFOOT - 4.6 * YS - 30, 230, sm(66.3, 66.6, t));
    ident(c);
    const P = (x, y) => w2s(cam, x, y), yh = P(YX + 110, YHEAD - 60);
    sfx(c, t, { t0: T.home + 0.1, t1: T.home + 1.0, text: 'ずざーっ', x: 1500, y: 820, size: 80, rot: -0.05, col: '#e0708a' });
    sfx(c, t, { t0: 61.0, t1: 63.3, text: 'ぜぇ…はぁ…', x: 1560, y: 380, size: 62, rot: 0.06, col: '#8ea2ee', fam: 'Zen Maru Gothic' });
    bubble(c, t, { t0: 61.7, t1: 63.4, x: 1520, y: 230, text: 'ま、まいた……？', size: 56, tail: yh });
    bubble(c, t, { t0: 63.8, t1: 65.7, x: 1520, y: 230, text: '……よ、よゆー……♪', size: 58, tail: yh });
    sfx(c, t, { t0: 66.0, t1: 67.3, text: 'じーーーっ', x: 480, y: 250, size: 76, rot: -0.04, col: '#8d7bd0' });
    bubble(c, t, { t0: 67.3, t1: T.caught - 0.05, x: 620, y: 160, text: 'おかえりなさい、ゆり姉♡', size: 60, tail: P(SOFA[0] + 60, SOFA[1] - 420), weight: 900 });
    sfx(c, t, { t0: 67.7, t1: T.caught, text: 'ギ ギ ギ…', x: 1640, y: 330, size: 70, rot: 0.08, col: '#8ea2ee', shake: 3 });
    flash(c, 0.6 * pulse(t, T.home, 0.06) + 0.35 * pulse(t, 65.75, 0.05));
  },
};

// ============================================================ つかまえた → 結末（1:09 → 1:20）
const END_SHOTS = [[T.caught + 0.9, T.last, 1.12, 960, 520, 1.2, 975, 510], [T.last, T.card, 1.5, 1060, 440, 1.56, 1065, 436]];
const ending = {
  id: 'ending', t0: T.caught, t1: T.card,
  draw(c, t) {
    const tl = t - T.caught, tq = on2(t);
    if (tl < 0.9) {                               // つかまえた
      const g = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1200); g.addColorStop(0, '#fff0f6'); g.addColorStop(1, '#ffc4d9'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      speedLines(c, W / 2, H / 2, t, 0.8, { col: 'rgba(255,130,170,.25)', inner: 500 });
      for (let i = 0; i < 10; i++) { const an = i / 10 * TAU + tl * 3, r = lerp(1300, 260, ease.outCubic(sat(tl / 0.5))); tent(c, [[W / 2 + Math.cos(an) * 1500, H / 2 + Math.sin(an) * 1500], [W / 2 + Math.cos(an + 0.5) * (r + 300), H / 2 + Math.sin(an + 0.5) * (r + 300)], [W / 2 + Math.cos(an + 0.9) * r, H / 2 + Math.sin(an + 0.9) * r * 0.8]], 90, 30, t, { phase: i, amp: 20, tip: 'heart' }); }
      fig(c, 'yuria', W / 2, 990, 130, { armL: [-1.0, 0.4], armR: [1.0, 0.4], lift: 0.8, bob: -0.2 }, { eyes: 'wide', dot: 0.03, mouth: 'scream', tears: 1 });
      sfx(c, t, { t0: T.caught, t1: T.caught + 0.95, text: 'つかまえたぁ♡', x: W / 2, y: 250, size: 170, rot: -0.04, col: '#e0447a', shake: 7, fam: 'Zen Maru Gothic' });
      burst(c, W / 2, H / 2, t, T.caught, { n: 18, r: 800, size: 40, dur: 0.9 });
      flash(c, pulse(t, T.caught, 0.09));
      return;
    }
    const cam = shotCam(END_SHOTS, t), shock = t >= 76.55, frz = t >= T.last;
    setCam(c, cam);
    c.fillStyle = '#fff6f9'; c.fillRect(-400, -400, W + 800, H + 800); c.fillStyle = '#fbeaf0'; c.fillRect(-400, 800, W + 800, 700); c.beginPath(); c.moveTo(-400, 800); c.lineTo(W + 400, 800); c.strokeStyle = '#e6c3cf'; c.lineWidth = 4; c.stroke();
    heartsUp(c, t, { n: 16, size: 22, alpha: 0.45, col: '#ffb9cf', y0: 0, y1: 800 });
    const SX = 960, SB = 900;
    sofa(c, SX, SB, 900);
    const kissT = [70.3, 71.4, 72.4], kiss = shock ? 0 : kissT.reduce((m, k) => Math.max(m, pulse(t, k, 0.25) * (t >= k ? 1 : 0)), 0), wig = frz ? 1 : 0;
    fig(c, 'vol', 800 + 50 * kiss, 880, 142, { armL: [-0.4, 1.7], armR: [1.6, 1.3], legL: 1, legR: 1, tilt: 0.16 + 0.2 * kiss, hx: 0.3 * kiss, sway: 0.04 * Math.sin(t * 2) }, { eyes: t > 74.7 && !frz ? 'heart' : 'happy', mouth: kiss > 0.3 ? 'kiss' : t > 74.8 && t < 76.4 && Math.floor(tq * 5) % 2 ? 'open' : 'cat', blush: 1.7 });
    const yFace = shock ? { eyes: 'wide', dot: frz ? 0.025 : 0.04, mouth: frz ? 'scream' : 'flat', blush: 1.2, sweat: 1, tears: frz ? 1 : 0 } : { eyes: 'melt', mouth: 'drool', blush: 2.2 };
    bundle(c, 1150, 660, 140, t, yFace, { headTilt: shock ? 0 : 0.16 + 0.05 * Math.sin(t * 2), rot: 0.06, wiggle: wig });
    if (!shock) steam(c, 1150, 300, t);
    table(c, 520, 968, 440); cup(c, 450, 914, 1.0, t); cup(c, 590, 914, 1.0, t + 1);
    kissT.forEach((k, i) => { burst(c, 1010, 430, t, k, { n: 7, r: 170, size: 20, dur: 0.55 }); });
    ident(c);
    const P = (x, y) => w2s(cam, x, y);
    kissT.forEach((k, i) => sfx(c, t, { t0: k, t1: k + 0.6, text: 'ちゅっ♡', x: 1010 + (i % 2) * 60, y: 250 - (i % 3) * 20, size: 96, rot: -0.1 + 0.08 * i, col: '#ff6f9f', fam: 'Zen Maru Gothic' }));
    bubble(c, t, { t0: 72.95, t1: 74.6, x: 1560, y: 250, text: '……あーし、もう……\nここでいい……♡', size: 50, kind: 'soft', tail: P(1260, 400) });
    bubble(c, t, { t0: 74.8, t1: 76.45, x: 470, y: 230, text: 'はい♡\n一生ですよぉ♡', size: 58, tail: P(720, 380), weight: 900 });
    bubble(c, t, { t0: 76.6, t1: T.last, x: 1560, y: 260, text: '…………いっしょう？', size: 52, tail: P(1270, 410) });
    bubble(c, t, { t0: T.last, t1: 79.2, x: 1500, y: 190, text: '一生ぉ！？', size: 100, kind: 'shout', tail: [1330, 380], shake: 6, weight: 900 });
    sfx(c, t, { t0: T.last + 0.3, t1: T.card, text: 'じたばた', x: 1560, y: 760, size: 78, rot: 0.1, col: '#e0708a', shake: 6 });
    bubble(c, t, { t0: 78.3, t1: T.card - 0.05, x: 330, y: 880, text: 'もう！　二人とも、\n廊下を走らない！', size: 44, tail: [-40, 900] });
    if (t > 78.3) text(c, '（ルリカ）', 330, 990, 30, { col: '#8f84c8', weight: 700, stroke: '#ffffff' });
    flash(c, 0.7 * pulse(t, T.last, 0.07) + (1 - sat((tl - 0.9) / 0.35)), '255,235,243');
    const out = sat((t - (T.card - 0.3)) / 0.3); flash(c, out, '253,251,248');
  },
};

// ============================================================ 札（1:20 → ）
const card = {
  id: 'card', t0: T.card, t1: DURATION + 1,
  draw(c, t, tl, env) {
    c.fillStyle = '#fdfbf8'; c.fillRect(0, 0, W, H);
    head(c, 'yuria', 700, 230, 105, { eyes: 'wide', dot: 0.03, mouth: 'wavy', tears: 1, sweat: 1 }, -0.08 + 0.03 * Math.sin(t * 9));
    head(c, 'vol', 1190, 230, 105, { eyes: 'heart', mouth: 'cat', blush: 1.6 }, 0.08 + 0.02 * Math.sin(t * 2));
    heart(c, 950, 210 + 6 * Math.sin(t * 3), 30, '#ff8fb1');
    text(c, 'ゆり姉、まってぇ♡', 960, 480, 104, { fam: 'Dela Gothic One', weight: 400, col: '#7c5cc4', heart: '#ff7fa3' });
    const loc = env.stats && env.stats.loc ? env.stats.loc.toLocaleString('en-US') : '—';
    const rows = ['外神竜一族 設定資料（2026 年 11 月 10 日版）より　ユリアとヴォル', '音楽　“Creepy Comedy”　Rafael Krux（CC0）　／　効果音　SFX Kit by Wyzowl（CC0）', `絵と動き　すべてプログラムで描画（${loc} 行）`, '設定・元絵　あなた　／　構成・プログラム　Claude'];
    rows.forEach((r, i) => { c.save(); c.globalAlpha = sat((tl - 0.3 - i * 0.15) / 0.4); text(c, r, 960, 650 + i * 70, i === 0 ? 40 : 32, { weight: i === 0 ? 700 : 500, col: i === 0 ? LINE : '#8b7a88' }); c.restore(); });
    fadeIn(c, t, T.card, 0.35);
    flash(c, sat((t - (DURATION - 0.7)) / 0.6), '253,251,248');
  },
};

export const SCENES = [living, chase, dream, wave, escalate, home, ending, card];
