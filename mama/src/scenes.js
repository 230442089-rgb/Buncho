// scenes.js — 場面。どれも「時刻 → 絵」の関数（前のフレームの状態を持たない）。
//   人物・小道具・吹き出しは、前作「ゆり姉、まってぇ♡」（chase/src）のものを使う。
import { W, H, T, BEAT, DURATION, sat, smoothstep as sm, ease, lerp, TAU, hash1, pulse, on2 } from './core.js';
import { heart, limb, runPose, LINE } from '../../chase/src/chibi.js';
import { text, bubble, sfx, speedLines, dust, heartsUp, burst, sofa, cup, table, rrect } from '../../chase/src/props.js';
import { fig, head, tent, bundle, steam, shotCam, setCam, ident, w2s, K, flash, fadeIn } from '../../chase/src/scenes.js';

const rgb = (a, b, k) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], k))).join(',')})`;
const bob = (t, k = 1, per = BEAT) => -k * Math.abs(Math.sin(Math.PI * t / per));
const talk = (tq, t, a, b, rate = 5) => t > a && t < b && Math.floor(tq * rate) % 2 === 1;      // 口ぱく

// ============================================================ 部屋
const SX = 1010, SB = 900;                              // ソファ（中心、下端）
const VX = SX - 160, VFOOT = 880, VS = 142;             // ソファのヴォル
const BX = SX + 190, BY = 660, BS = 140;                // ぐるぐる巻きのユリア
const DOOR = [120, 110, 330, 690];                      // ドア（x, y, 幅, 高さ）
const MX = 470, MFOOT = 940, MS = 158, MHY = MFOOT - 3.14 * MS;   // 部屋に入ったママ（足もと、頭の半径、頭の中心の高さ）
const TBL = [1580, 985, 380];

function star4(c, x, y, r, col = '#ffd97a', rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.34 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fillStyle = col; c.fill(); c.restore();
}
function sparkles(c, t, x, y, w, h, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const ph = (t * (0.5 + 0.5 * hash1(i * 3.3 + (o.seed || 0))) + hash1(i * 7.1)) % 1;
    c.save(); c.globalAlpha *= Math.sin(ph * Math.PI) * (o.alpha ?? 0.9);
    star4(c, x + (hash1(i * 2.3 + 1) - 0.5) * w, y + (hash1(i * 5.9 + 2) - 0.5) * h, (o.size || 22) * (0.5 + hash1(i * 9.1)), o.col || '#ffd97a', t * 0.5 + i); c.restore();
  }
}
// 居間。o.eve: 夕方（0..1）、o.door: ドアの開き（0..1）、o.inDoor: ドアの向こうに描くもの
function livingRoom(c, t, o = {}) {
  const eve = o.eve || 0, open = o.door || 0, edge = rgb([205, 191, 184], [206, 172, 152], eve);
  c.fillStyle = rgb([253, 251, 248], [255, 239, 221], eve); c.fillRect(-400, -400, W + 800, H + 800);
  c.fillStyle = rgb([247, 240, 233], [248, 224, 201], eve); c.fillRect(-400, 800, W + 800, 700);
  c.beginPath(); c.moveTo(-400, 800); c.lineTo(W + 400, 800); c.strokeStyle = rgb([217, 203, 195], [216, 182, 162], eve); c.lineWidth = 4; c.stroke();
  c.beginPath(); c.ellipse(SX - 40, 968, 720, 100, 0, 0, TAU); c.fillStyle = rgb([255, 241, 244], [255, 226, 214], eve); c.fill(); c.strokeStyle = rgb([242, 208, 217], [238, 190, 172], eve); c.lineWidth = 4; c.stroke();     // 敷物
  // 窓
  const wx = 1500, wy = 150, ww = 320, wh = 300;
  rrect(c, wx, wy, ww, wh, 14); const g = c.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, rgb([226, 240, 252], [255, 186, 128], eve)); g.addColorStop(1, rgb([238, 247, 254], [255, 231, 178], eve)); c.fillStyle = g; c.fill();
  c.save(); rrect(c, wx, wy, ww, wh, 14); c.clip();
  if (eve > 0) { c.globalAlpha = eve; c.beginPath(); c.arc(wx + 222, wy + 206, 58, 0, TAU); c.fillStyle = '#fff6d2'; c.fill(); c.globalAlpha = 1; }
  for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(wx + ((i * 150 + t * 8) % 460) - 60, wy + 70 + i * 60, 56, 20, 0, 0, TAU); c.fillStyle = rgb([255, 255, 255], [255, 216, 190], eve); c.fill(); }
  c.restore();
  rrect(c, wx, wy, ww, wh, 14); c.strokeStyle = edge; c.lineWidth = 5; c.stroke();
  c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.moveTo(wx, wy + wh / 2); c.lineTo(wx + ww, wy + wh / 2); c.lineWidth = 4; c.stroke();
  // 額
  for (const [x, y, w, h, col] of [[545, 150, 120, 96, '#ffc2d4'], [690, 190, 96, 116, '#ffe19a']]) { rrect(c, x, y, w, h, 8); c.fillStyle = rgb([255, 250, 246], [255, 240, 226], eve); c.fill(); c.strokeStyle = edge; c.lineWidth = 5; c.stroke(); heart(c, x + w / 2, y + h / 2 + 4, Math.min(w, h) * 0.2, col); }
  // 鉢植え
  c.save(); c.translate(1868, 800); c.lineJoin = 'round';
  for (const [a, l] of [[-0.9, 150], [-0.35, 190], [0.2, 170], [0.75, 130]]) { c.save(); c.rotate(a + 0.03 * Math.sin(t * 1.2 + a)); c.beginPath(); c.moveTo(0, -60); c.quadraticCurveTo(-34, -60 - l * 0.6, 0, -60 - l); c.quadraticCurveTo(34, -60 - l * 0.6, 0, -60); c.fillStyle = rgb([201, 232, 204], [214, 222, 176], eve); c.fill(); c.strokeStyle = LINE; c.lineWidth = 3.5; c.stroke(); c.restore(); }
  c.beginPath(); c.moveTo(-46, -70); c.lineTo(46, -70); c.lineTo(34, 0); c.lineTo(-34, 0); c.closePath(); c.fillStyle = rgb([244, 228, 207], [240, 208, 180], eve); c.fill(); c.strokeStyle = LINE; c.lineWidth = 4; c.stroke(); c.restore();
  // ドア
  const [dx, dy, dw, dh] = DOOR;
  rrect(c, dx - 18, dy - 18, dw + 36, dh + 18, 12); c.fillStyle = rgb([236, 224, 212], [236, 208, 186], eve); c.fill(); c.strokeStyle = edge; c.lineWidth = 5; c.stroke();
  c.fillStyle = rgb([243, 237, 247], [238, 212, 198], eve); c.fillRect(dx, dy, dw, dh);                 // 開いた先（廊下）
  c.fillStyle = rgb([234, 226, 238], [226, 196, 182], eve); c.fillRect(dx, dy + dh - 46, dw, 46);
  if (o.inDoor) o.inDoor();
  const lw = dw * (1 - 0.88 * open);                    // 扉（開くと、蝶番のある左へたたまれる）
  rrect(c, dx, dy, lw, dh, 6); c.fillStyle = rgb([244, 228, 207], [240, 208, 180], eve); c.fill(); c.strokeStyle = edge; c.lineWidth = 5; c.stroke();
  if (open < 0.6) { c.strokeStyle = rgb([227, 208, 182], [222, 186, 158], eve); c.lineWidth = 4; rrect(c, dx + lw * 0.14, dy + 50, lw * 0.72, dh * 0.36, 8); c.stroke(); rrect(c, dx + lw * 0.14, dy + dh * 0.5, lw * 0.72, dh * 0.4, 8); c.stroke(); }
  c.beginPath(); c.arc(dx + lw - Math.min(36, lw * 0.4), dy + dh * 0.54, 11, 0, TAU); c.fillStyle = '#e2b866'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 3; c.stroke();
}
function teaTable(c, t, n = 2, steamK = 1) { table(c, TBL[0], TBL[1], TBL[2]); for (let i = 0; i < n; i++) cup(c, TBL[0] + (i - (n - 1) / 2) * 112, TBL[1] - 54, 0.95, t + i, steamK); }
function plate(c, t, t0, top, main, x = 280, y = 140) {
  const a = ease.outBack(K(t, t0, t0 + 0.3), 1.6); if (a <= 0) return;
  c.save(); c.translate(x, y); c.rotate(-0.04); c.scale(a, a); rrect(c, -230, -80, 460, 160, 26); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 6; c.stroke();
  c.fillStyle = '#ff9dbb'; rrect(c, -230, -80, 460, 44, 22); c.fill(); text(c, top, 0, -57, 30, { col: '#fff', weight: 900 }); text(c, main, 0, 24, 76, { weight: 900 }); c.restore();
}
function stamp(c, t, t0, t1, str, x, y, rot = -0.08, size = 40, col = '#e0447a') {
  if (t < t0 || t >= t1) return; const a = ease.outBack(K(t, t0, t0 + 0.18), 2);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(a, a); c.font = `900 ${size}px "Zen Maru Gothic"`; const w = c.measureText(str).width + size * 1.5;
  rrect(c, -w / 2, -size * 0.95, w, size * 1.9, 14); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill(); c.strokeStyle = col; c.lineWidth = 6; c.stroke(); text(c, str, 0, 2, size, { col, weight: 900, heart: col }); c.restore();
}

// ソファのふたり（前作の結末の続き: ヴォルが、ぐるぐる巻きのユリアを抱えている）
function sofaPair(c, t, o) {
  sofa(c, SX, SB, 900);
  const rub = o.rub || 0;
  fig(c, 'vol', VX + 50 * rub, VFOOT, VS, { armL: [-0.4, 1.7], armR: [1.6, 1.3], legL: 1, legR: 1, tilt: (o.vTilt ?? 0.16) + 0.2 * rub, hx: 0.3 * rub, sway: 0.04 * Math.sin(t * 2) }, o.vFace);
  bundle(c, BX, BY, BS, t, o.yFace, { headTilt: o.headTilt || 0, rot: 0.06, wiggle: o.wiggle || 0 });
}

// ヴォルの「休養計画」（触手が持ち上げる板）。a: 出てくる度合い
function planBoard(c, t, a) {
  if (a <= 0) return;
  const x = 452, y = lerp(700, 345, a) + 6 * Math.sin(t * 2.2);
  tent(c, [[600, 720], [600, 610], [520, y + 200], [480, y + 130]], 46, 26, t, { amp: 5, phase: 2 });
  c.save(); c.translate(x, y); c.rotate(-0.05 + 0.015 * Math.sin(t * 1.8)); c.lineJoin = 'round'; c.lineCap = 'round';
  rrect(c, -170, -170, 340, 340, 18); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 6; c.stroke();
  c.fillStyle = '#b9a8ee'; rrect(c, -170, -170, 340, 62, 16); c.fill(); text(c, 'ゆり姉 休養計画', 0, -138, 34, { col: '#fff', weight: 900 });
  [['お茶', 1], ['おひるね', 1], ['すりすり', 1], ['解放', 0]].forEach(([label, ok], i) => {
    const yy = -72 + i * 58, show = sat((t - (T.plan + 0.35 + i * 0.3)) / 0.15); if (show <= 0) return;
    c.globalAlpha = show; text(c, label, -140, yy, 36, { align: 'l', weight: 900, col: ok ? LINE : '#e0447a' });
    rrect(c, 84, yy - 22, 44, 44, 8); c.fillStyle = ok ? '#eefbf0' : '#ffeef3'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 4; c.stroke();
    c.beginPath(); if (ok) { c.moveTo(92, yy); c.lineTo(104, yy + 13); c.lineTo(124, yy - 16); c.strokeStyle = '#49b36b'; } else { c.moveTo(94, yy - 12); c.lineTo(118, yy + 12); c.moveTo(118, yy - 12); c.lineTo(94, yy + 12); c.strokeStyle = '#e0447a'; }
    c.lineWidth = 7; c.stroke(); if (!ok) text(c, '予定なし', 20, yy, 24, { weight: 900, col: '#e0447a' }); c.globalAlpha = 1;
  });
  c.restore();
}

// ============================================================ つかまって 3 時間目 → ママが帰ってくる（0:00 → 0:20）
const SHOTS1 = [[0, T.door, 1.2, 1010, 545, 1.27, 1020, 540], [T.door, T.help, 1.0, 960, 540, 1.035, 950, 540], [T.help, T.excuse, 1.7, BX - 60, 480, 1.8, BX - 60, 475],
  [T.excuse, T.plan, 1.7, VX - 90, 480, 1.8, VX - 90, 475], [T.plan, T.mama, 1.2, SX - 110, 500, 1.25, SX - 110, 496]];
const home = {
  id: 'home', t0: 0, t1: T.mama,
  draw(c, t) {
    const cam = shotCam(SHOTS1, t), tq = on2(t), open = ease.outCubic(K(t, T.door, T.door + 0.3)), wv = Math.sin(tq * 9);
    const close = t >= T.help, plan = t >= T.plan;                   // 寄りのカットは、部屋のかわりに淡い色の背景
    setCam(c, cam);
    if (close) { if (t < T.excuse) { backdrop(c, t, 'pinkflat'); speedLines(c, BX, BY - 240, t, 0.7, { col: 'rgba(255,140,175,.2)', inner: 330, n: 64 }); } else backdrop(c, t, 'lav'); }
    else livingRoom(c, t, { door: open, inDoor: () => {
      if (t < T.door) return;
      fig(c, 'fururu', 305, 846, 150, { elbR: [1.12, 1.34], armR: [1.3 + 0.16 * wv, 0.66], tilt: 0.05 * wv, bob: bob(tq, 0.03) }, { mouth: talk(tq, t, T.door + 0.8, T.door + 2.6) || t > T.door + 2.6 ? 'open' : 'smile', blush: 1.1 });
    } });
    let vFace, yFace, rub = 0, wig = 0, vTilt = 0.16, hTilt = 0;
    if (t < T.door) {
      rub = t > 4.4 ? 0.5 - 0.5 * Math.cos((tq - 4.4) * 6.5) : 0;
      vFace = { eyes: 'happy', mouth: talk(tq, t, 4.1, 6.3) ? 'open' : 'cat', blush: 1.7 };
      yFace = t < 4.3 ? { lid: 0.5, lookY: 0.5, mouth: talk(tq, t, 1.3, 3.6, 4) ? 'small' : 'flat', blush: 0.8 } : { eyes: 'shut', mouth: 'wavy', blush: 1.4, sweat: 1 };
      hTilt = t < 4.3 ? 0.1 : -0.04 * rub;
    } else if (t < T.help) {
      const seen = t > T.door + 0.6; vTilt = 0.02;
      vFace = { eyes: 'wide', dot: 0.045, lookX: -1, mouth: 'small', sweat: 1, blush: 0.6 };
      yFace = seen ? { lid: 0, lookX: -1, mouth: 'open', tears: 1, blush: 1.0 } : { eyes: 'wide', dot: 0.045, lookX: -1, mouth: 'small' };
    } else if (t < T.excuse) {
      wig = 1; vTilt = 0.02;
      yFace = Math.floor(tq * 2.5) % 2 ? { eyes: 'cross', mouth: 'scream', tears: 1, blush: 1 } : { lid: 0, lookX: -1, mouth: 'scream', tears: 1, blush: 1 };
      vFace = { eyes: 'wide', dot: 0.04, lookX: 1, mouth: 'wavy', sweat: 1 };
    } else if (!plan) {
      vTilt = 0.03; wig = 0.25;
      vFace = { eyes: 'open', lid: 0.1, lookX: -1, mouth: talk(tq, t, T.excuse + 0.2, T.plan - 0.4) ? 'open' : 'smile', sweat: 1, blush: 0.9 };
      yFace = { lid: 0.4, lookX: -1, mouth: 'flat', tears: 1, blush: 0.8 };
    } else {
      const shock = t >= T.plan + 1.55; vTilt = -0.04; wig = shock ? 0.6 : 0.2;
      vFace = { eyes: 'happy', mouth: talk(tq, t, T.plan + 0.2, T.mama - 0.4) ? 'open' : 'smile', sweat: 1, blush: 1.0 };
      yFace = shock ? { eyes: 'wide', dot: 0.03, lookX: -1, mouth: 'wavy', tears: 1, blush: 0.4 } : { lid: 0.4, lookX: -1, mouth: 'flat', tears: 1, blush: 0.8 };
    }
    if (plan) planBoard(c, t, ease.outBack(K(t, T.plan + 0.05, T.plan + 0.45), 1.3));
    sofaPair(c, t, { vFace, yFace, rub, wiggle: wig, vTilt, headTilt: hTilt });
    if (t < T.door) { c.save(); c.globalAlpha = 0.8; heartsUp(c, t, { n: 9, size: 20, alpha: 0.5, col: '#ffb9cf', x0: 560, w: 900, y0: 150, y1: 760 }); c.restore(); }
    if (t > T.door + 0.6 && t < T.help) sparkles(c, t * 2, BX + 10, BY - 250, 520, 380, 10, { size: 26 });
    if (!close) teaTable(c, t, 2);
    // ---- 文字（画面の座標）
    ident(c);
    const P = (x, y) => w2s(cam, x, y);
    if (t < T.door) {
      plate(c, t, 0.45, 'つかまって', '3 時間目');
      bubble(c, t, { t0: 1.2, t1: 3.9, x: 1590, y: 190, text: '……だれか〜。\nたすけて〜……', size: 50, tail: P(BX + 120, 372) });
      bubble(c, t, { t0: 4.1, t1: T.door - 0.12, x: 360, y: 400, text: 'ふふ♡　一生ですよぉ、\nゆり姉♡', size: 50, tail: P(VX - 130, 420), weight: 900 });
      sfx(c, t, { t0: 4.9, t1: T.door - 0.1, text: 'すりすり♡', x: 1000, y: 180, size: 70, rot: -0.06, col: '#ff7fa8', fam: 'Zen Maru Gothic' });
    } else if (t < T.help) {
      sfx(c, t, { t0: T.door, t1: T.door + 1.0, text: 'がちゃ', x: 300, y: 930, size: 96, rot: -0.08, col: '#8ea2ee' });
      sfx(c, t, { t0: T.door + 0.4, t1: T.door + 1.4, text: 'ぎくっ', x: 700, y: 185, size: 70, rot: 0.08, col: '#8d7bd0', shake: 3 });
      bubble(c, t, { t0: T.door + 0.77, t1: T.help - 0.1, x: 640, y: 120, text: 'ただいまぁ♡', size: 76, tail: P(400, 330), weight: 900 });
      bubble(c, t, { t0: T.door + 1.62, t1: T.help - 0.05, x: 1600, y: 560, text: 'ママ……！！', size: 62, tail: P(BX + 120, 470), weight: 900 });
    } else if (t < T.excuse) {
      bubble(c, t, { t0: T.help + 0.05, t1: T.help + 1.66, x: 1470, y: 250, text: 'ママぁ〜〜！！\nたすけてぇ！！', size: 70, kind: 'shout', tail: [1150, 540], shake: 4, weight: 900 });
      bubble(c, t, { t0: T.help + 1.7, t1: T.excuse - 0.05, x: 1490, y: 250, text: '「一生」って\n言われたぁ！！', size: 66, kind: 'shout', tail: [1150, 540], shake: 3, weight: 900 });
      sfx(c, t, { t0: T.help + 0.2, t1: T.excuse, text: 'じたばた', x: 1560, y: 880, size: 80, rot: 0.08, col: '#e0708a', shake: 6 });
    } else if (!plan) bubble(c, t, { t0: T.excuse + 0.08, t1: T.plan - 0.08, x: 450, y: 250, text: 'お、おかえりなさい、ママ。\nこれは、その……', size: 46, tail: [880, 560] });
    else {
      bubble(c, t, { t0: T.plan + 0.1, t1: T.mama - 0.1, x: 1280, y: 120, text: 'ゆり姉の休養を、計画的に\n確保していまして……', size: 44, tail: P(VX + 80, 300) });
      sfx(c, t, { t0: T.plan + 1.6, t1: T.mama - 0.05, text: 'がーん', x: 1650, y: 800, size: 96, rot: 0.08, col: '#8ea2ee', shake: 4 });
    }
    for (const sh of SHOTS1) flash(c, 0.3 * pulse(t, sh[0], 0.05) * (sh[0] > 0 ? 1 : 0));
    fadeIn(c, t, 0, 0.5);
  },
};

// ============================================================ ママがふたりを抱きしめる
// m: [x, 足もと y, 頭の半径]。o: { vol, yuria: そこにいるか / vFace, yFace, mFace / pat: 撫でる手の往復 0..1, patWho / openL: 向かって左の腕を広げて待つ /
//      dx, dy, rot, ds: 娘の頭の位置（ママの頭の半径が単位）・傾き・大きさ / sit: 座っている / nuzzle: すりすり }
// 重ねる順: 娘の後ろ髪 → ママ → 娘の体と頭（ママのあごの下に収まる）→ ママの手
function hugGroup(c, t, m, o = {}) {
  const [mx, mf, s] = m, hy = mf - 3.14 * s, ds = s * (o.ds ?? 0.8), L = 3.14 * ds, sit = o.sit ? 1 : 0;
  const mPose = { armL: o.vol ? [-1.25, 1.95] : o.openL ? [-1.78, 1.0 + 0.05 * Math.sin(t * 5)] : [-0.86, 1.86], elbL: !o.vol && o.openL ? [-1.2, 1.42] : null, armR: o.yuria ? [1.25, 1.95] : [0.86, 1.86],
    tilt: o.mTilt ?? 0, hx: o.mHx || 0, sway: 0.03 * Math.sin(t * 1.4), bob: o.mBob || 0, legL: sit, legR: sit };
  const kids = [['vol', -1], ['yuria', 1]].filter(([w]) => o[w]).map(([who, side]) => {
    const nz = (o.nuzzle || 0) * Math.sin(t * 3.1 + side), rot = -side * ((o.rot ?? 0.24) + 0.02 * nz);
    const cx = mx + side * (o.dx ?? 1.34) * s, cy = hy + (o.dy ?? 1.2) * s + (o[who + 'Dy'] || 0);
    const arms = side > 0 ? { armL: [-1.3, 1.5], armR: [0.6, 1.75] } : { armR: [1.3, 1.5], armL: [-0.6, 1.75] };
    return { who, side, rot, cx, cy, ds, fx: cx - Math.sin(rot) * L, fy: cy + Math.cos(rot) * L, pose: { ...arms, tilt: -side * 0.05 + 0.02 * nz, sway: (o.wag || 0.03) * Math.sin(t * (o.wag ? 7 : 1.3) + side), lift: 0.1, legL: sit, legR: sit }, face: o[who + 'Face'] };
  });
  for (const k of kids) fig(c, k.who, k.fx, k.fy, ds, k.pose, k.face, k.rot, { only: ['back'] });
  fig(c, 'fururu', mx, mf, s, mPose, o.mFace);
  for (const k of kids) {
    fig(c, k.who, k.fx, k.fy, ds, k.pose, k.face, k.rot, { only: ['body', 'arms', 'head'] });
    const pat = k.who === o.patWho ? (o.pat ?? 0.5) : 0.5;
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    if (k.who === o.patWho || (k.who === 'vol' && !o.patWho)) {            // 背中から回した手で、頭をなでる
      const th = (k.side > 0 ? -1.0 : Math.PI + 1.0) + k.side * 0.5 * (pat - 0.5);
      c.translate(k.cx + Math.cos(th) * ds * 1.02, k.cy + Math.sin(th) * ds * 1.02); c.scale(s, s); limb(c, [[k.side * 0.3, 0.64], [k.side * 0.15, 0.25], [0, 0]], [0.16, 0.135]);
    } else {                                                // 肩に添えた手（腕は背中の向こう）
      c.translate(k.cx + k.side * 0.9 * ds, k.cy + 1.14 * ds); c.rotate(k.side * 0.7); c.scale(s, s);
      c.beginPath(); c.ellipse(0, 0, 0.17, 0.2, 0, 0, TAU); c.fillStyle = '#fff1ea'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 0.026; c.stroke();
      for (const fx of [-0.06, 0.05]) { c.beginPath(); c.moveTo(fx, 0.06); c.lineTo(fx - 0.01, 0.19); c.lineWidth = 0.018; c.stroke(); }
    }
    c.restore();
  }
  return kids;
}
// 寄りのカットの背景（部屋のかわり）
function backdrop(c, t, kind) {
  c.fillStyle = kind.startsWith('pink') ? '#fff0f4' : kind === 'warm' ? '#fff5e6' : '#f3f0fb'; c.fillRect(-400, -400, W + 800, H + 800);
  if (kind === 'lav') { c.save(); c.rotate(-0.5); c.fillStyle = 'rgba(190,178,235,.16)'; for (let i = -6; i < 30; i++) c.fillRect(-1400, i * 110 + ((t * 26) % 110), 4200, 46); c.restore(); }
  else if (kind !== 'pinkflat') { c.save(); c.globalAlpha = 0.9; heartsUp(c, t, { n: 16, size: 30, alpha: 0.5, col: kind === 'pink' ? '#ffb3c8' : '#ffd0a8', x0: -300, w: W + 600, y0: -200, y1: H + 200 }); c.restore(); }
}

// ============================================================ 「ふたりとも、おいでぇ♡」（0:20 → 0:40）
const VCUT = [T.pofu + 0.95, T.reply, T.vol + 1.7];      // ヴォルの寄り / ママの返事 / 飛びこむ
const SHOTS2 = [[T.mama, T.oide, 1.5, MX - 170, 500, 1.58, MX - 170, 495], [T.oide, T.loose, 1.26, MX + 170, 520, 1.36, MX + 160, 512], [T.loose, T.pofu, 1.0, 960, 540],
  [T.pofu, VCUT[0], 1.4, MX + 130, 590, 1.46, MX + 130, 585], [VCUT[0], VCUT[1], 1.7, VX - 90, 480, 1.8, VX - 90, 474], [VCUT[1], T.vol, 1.34, MX + 170, 590, 1.42, MX + 170, 584],
  [T.vol, VCUT[2], 1.7, VX - 90, 480, 1.82, VX - 90, 474], [VCUT[2], T.hug, 1.0, 960, 540]];
function glow(c, x, y, r, k, col = '255,214,150') { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${0.85 * k})`); g.addColorStop(0.5, `rgba(${col},${0.4 * k})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
const oide = {
  id: 'oide', t0: T.mama, t1: T.hug,
  draw(c, t) {
    const cam = shotCam(SHOTS2, t), tq = on2(t), freeAt = T.loose + 0.8, runAt = T.loose + 1.15;
    const jump = K(t, VCUT[2] + 0.15, T.hug);            // ヴォルが飛びこむ
    const vClose = (t >= VCUT[0] && t < VCUT[1]) || (t >= T.vol && t < VCUT[2]), mClose = t >= VCUT[1] && t < T.vol, calling = t >= T.oide && t < T.loose;
    setCam(c, cam);
    if (vClose) backdrop(c, t, t >= T.vol ? 'pink' : 'lav'); else if (mClose) { backdrop(c, t, 'warm'); glow(c, MX + 100, MHY + 200, 800, 0.5); } else livingRoom(c, t, { door: 1 });
    if (calling) { const k = sm(T.oide, T.oide + 0.5, t); c.fillStyle = `rgba(255,246,230,${0.86 * k})`; c.fillRect(-400, -400, W + 800, H + 800); glow(c, MX, MHY + 120, 900, k); sparkles(c, t, MX + 150, MHY + 80, 1500, 900, 28, { size: 30 }); c.save(); c.globalAlpha = k; heartsUp(c, t, { n: 14, size: 26, alpha: 0.6, col: '#ffb3c8', x0: -200, w: 1700 }); c.restore(); }
    // ---- ソファ
    const hugging = t >= T.pofu;
    if (!calling && !mClose) {
      if (t < freeAt) {
        const loose = K(t, T.loose + 0.05, freeAt), melted = t >= T.loose;
        sofaPair(c, t, { vTilt: melted ? 0.1 : 0.03, wiggle: melted ? 0.5 : 0, headTilt: 0,
          vFace: melted ? { eyes: 'happy', mouth: 'small', blush: 2.0, lookX: -1 } : { eyes: 'open', lid: 0.1, lookX: -1, mouth: 'smile', sweat: 1, blush: 0.9 },
          yFace: melted ? { eyes: 'wide', dot: 0.045, lookX: -1, mouth: 'open', blush: 0.9 } : { lid: 0.4, lookX: -1, mouth: 'flat', tears: 1, blush: 0.8 } });
        if (melted) for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, bx = BX + sd * (90 + 30 * (i >> 1)); tent(c, [[bx, BY + 60], [bx + sd * 120 * loose, BY + 110 + 60 * loose], [bx + sd * (170 + 60 * (i >> 1)) * loose, BY + 120 + 150 * loose]], 44, 18, t, { phase: i * 1.7, amp: 6 }); }
      } else {
        sofa(c, SX, SB, 900);
        if (!vClose) for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, bx = BX + sd * (60 + 40 * (i >> 1)); tent(c, [[bx - sd * 40, BY + 150], [bx + sd * 60, BY + 190], [bx + sd * (150 + 50 * (i >> 1)), BY + 230 + 14 * (i >> 1)]], 40, 16, t, { phase: i * 1.7, amp: 3, speed: 1.2, tip: i === 1 ? 'heart' : 'round' }); }      // ほどけて、ふにゃふにゃの触手
        // ヴォル（ソファに残る → ママたちの後ろを回って、空いている側へ飛びこむ）
        const shy = t >= T.vol, tx = MX - 1.34 * MS + 30, ty = MFOOT + 70, vx = lerp(VX, tx, ease.inOutSine(jump)), vy = VFOOT - 300 * Math.sin(Math.PI * jump) + (ty - VFOOT) * jump;
        const vFace = jump > 0 ? { eyes: 'happy', mouth: 'open', blush: 2.0 } : shy ? { eyes: 'happy', mouth: talk(tq, t, T.vol + 0.15, T.vol + 1.5) ? 'open' : 'smile', blush: 2.1 } : t >= VCUT[0] ? { eyes: 'open', lid: 0.15, lookX: -1, lookY: 0.4, mouth: talk(tq, t, VCUT[0] + 0.1, VCUT[1] - 0.4) ? 'open' : 'wavy', blush: 1.4, sweat: 1 } : { eyes: 'wide', dot: 0.045, lookX: -1, mouth: 'small', blush: 0.8 };
        const vPose = jump > 0 ? { armL: [-1.0, 0.45], armR: [1.0, 0.45], legL: 0.6, legR: 0.6, lift: 0.7, sway: 0.2 } : { armL: [-0.45, 1.7], armR: shy ? [0.5, 1.2] : [0.5, 1.7], legL: 1, legR: 1, tilt: shy ? 0.14 : 0.03 + (t >= VCUT[0] ? 0.03 * Math.sin(tq * 9) : 0), bob: shy ? bob(tq, 0.03) : 0 };
        if (jump > 0) for (let i = 0; i < 6; i++) { const u = jump - i * 0.07; if (u > 0) { const px = lerp(VX, tx, ease.inOutSine(u)), py = VFOOT - 400 - 300 * Math.sin(Math.PI * u) + (ty - VFOOT) * u; c.save(); c.globalAlpha = 0.75 - i * 0.1; heart(c, px + 20 * Math.sin(i * 2), py + 20 * Math.cos(i * 3), 22 - i * 2, '#ff9dbb'); c.restore(); } }
        fig(c, 'vol', vx, vy, lerp(VS, MS * 0.8, jump), vPose, vFace, jump > 0 ? lerp(-0.4, 0.2, jump) : 0);
      }
    }
    if (!vClose && !mClose) teaTable(c, t, 2);
    // ---- ママ（と、走ってくるユリア）
    if (!hugging) {
      const think = t < T.oide, call = sm(T.oide, T.oide + 0.35, t);
      const mPose = think ? { elbR: [1.02, 1.5], armR: [0.74, 0.98], tilt: 0.1 + 0.02 * Math.sin(t * 2) } : { elbL: [-1.2, lerp(1.6, 1.4, call)], armL: [lerp(-0.9, -1.78, call), lerp(1.86, 0.98, call)], elbR: [1.2, lerp(1.6, 1.4, call)], armR: [lerp(0.9, 1.78, call), lerp(1.86, 0.98, call)], bob: bob(tq, 0.03) };
      fig(c, 'fururu', MX, MFOOT, MS, { ...mPose, sway: 0.03 * Math.sin(t * 1.4) }, { mouth: think ? 'smile' : talk(tq, t, T.oide + 0.1, T.oide + 2.2) || t > freeAt ? 'open' : 'smile', blush: 1.2 });
      if (t >= freeAt) {
        const end = MX + 1.34 * MS + 70, run = ease.inOutSine(K(t, runAt, T.pofu)), yx = lerp(BX, end, run), hop = t < runAt ? Math.sin(Math.PI * K(t, freeAt, runAt)) : 0, leap = Math.sin(Math.PI * K(t, T.pofu - 0.3, T.pofu + 0.3));
        const pose = t < runAt ? { armL: [-1.0, 0.4], armR: [1.0, 0.4], lift: 0.8, legL: 1 - hop, legR: 1 - hop } : { ...runPose(on2(t, 15) / 0.38, 1), lean: -0.22 };
        fig(c, 'yuria', yx, lerp(900, 985, sat(run * 3)) - 150 * hop - 90 * leap, 126, pose, { eyes: 'happy', mouth: 'open', tears: 1, blush: 1.4 });
        dust(c, BX - 40, 960, t, runAt + 0.05, 1.2, -1); dust(c, lerp(BX, end, 0.55), 990, t, runAt + 0.75, 1.0, -1);
        burst(c, BX, BY - 120, t, freeAt, { n: 10, r: 260, size: 24, dur: 0.6 });
      }
    } else if (!vClose) {
      const landed = sat((t - T.pofu) / 0.25);
      hugGroup(c, t, [MX, MFOOT, MS], { yuria: 1, openL: t >= VCUT[1], nuzzle: 1, mBob: -0.04 * (1 - landed), mTilt: 0.05, patWho: t < VCUT[1] ? 'yuria' : 'none', pat: 0.5 - 0.5 * Math.cos(tq * 7),
        mFace: { mouth: talk(tq, t, VCUT[1] + 0.1, T.vol - 0.4) ? 'open' : t < VCUT[0] ? 'open' : 'smile', blush: 1.4 },
        yuriaFace: { eyes: 'happy', mouth: t < T.pofu + 1.0 ? 'open' : 'cat', tears: t < VCUT[0] ? 1 : 0, blush: 1.9 } });
      burst(c, MX + 150, MHY + 230, t, T.pofu, { n: 14, r: 330, size: 30, dur: 0.8 });
      if (mClose) sparkles(c, t, MX + 100, MHY + 200, 1300, 800, 14, { size: 26 });
    }
    // ---- 文字
    ident(c);
    const P = (x, y) => w2s(cam, x, y);
    if (t < T.oide) bubble(c, t, { t0: T.mama + 0.25, t1: T.oide - 0.1, x: 440, y: 300, text: '（……ヴォルの説明、\n今日は妙に整ってるなぁ♡）', size: 46, kind: 'think', tail: P(MX - 200, MHY - 60) });
    else if (t < T.loose) {
      bubble(c, t, { t0: T.oide + 0.12, t1: T.loose - 0.1, x: 1420, y: 290, text: 'ふたりとも、\nおいでぇ♡', size: 100, tail: P(MX + 175, MHY + 20), weight: 900 });
      sfx(c, t, { t0: T.oide + 0.05, t1: T.loose - 0.1, text: 'ぱぁぁ…', x: 270, y: 240, size: 90, rot: -0.08, col: '#f0b24a', fam: 'Zen Maru Gothic' });
    } else if (t < T.pofu) {
      sfx(c, t, { t0: T.loose + 0.05, t1: freeAt + 0.2, text: 'ふにゃ…', x: 1500, y: 560, size: 84, rot: 0.06, col: '#b56fd0', fam: 'Zen Maru Gothic' });
      sfx(c, t, { t0: freeAt, t1: freeAt + 0.9, text: 'ぽんっ', x: 1430, y: 300, size: 110, rot: -0.1, col: '#f0a13c' });
      bubble(c, t, { t0: runAt + 0.1, t1: T.pofu - 0.05, x: 1300, y: 180, text: 'ママ〜〜っ！！', size: 84, kind: 'shout', tail: P(lerp(BX, MX + 1.34 * MS + 70, ease.inOutSine(K(t, runAt, T.pofu))) + 90, 520), shake: 3, weight: 900 });
      sfx(c, t, { t0: freeAt + 0.5, t1: freeAt + 1.7, text: 'あっ', x: 735, y: 190, size: 80, rot: -0.08, col: '#8d7bd0' });
    } else if (t < VCUT[0]) sfx(c, t, { t0: T.pofu, t1: VCUT[0], text: 'ぽふっ', x: 300, y: 560, size: 170, rot: -0.08, col: '#ff8fb1', fam: 'Zen Maru Gothic' });
    else if (t < VCUT[1]) bubble(c, t, { t0: VCUT[0] + 0.08, t1: VCUT[1] - 0.05, x: 430, y: 280, text: 'わ、私は、まだ\n明日の準備が――', size: 56, tail: [840, 480] });
    else if (t < T.vol) {
      bubble(c, t, { t0: VCUT[1] + 0.08, t1: T.vol - 0.05, x: 1390, y: 190, text: 'ヴォルも、おしまいにしよぉ♡', size: 54, tail: P(MX + 190, MHY - 30), weight: 900 });
      bubble(c, t, { t0: VCUT[1] + 1.55, t1: T.vol - 0.05, x: 1540, y: 400, text: 'こっち、空いてるよぉ', size: 50, weight: 900 });
    } else if (t < VCUT[2]) bubble(c, t, { t0: T.vol + 0.08, t1: VCUT[2] - 0.03, x: 430, y: 290, text: '……では、\n少しだけぇ♡', size: 70, tail: [840, 480], weight: 900 });
    else sfx(c, t, { t0: VCUT[2] + 0.15, t1: T.hug, text: 'ぴょーん', x: 1020, y: 170, size: 100, rot: -0.1, col: '#8d7bd0' });
    for (const sh of SHOTS2) flash(c, 0.3 * pulse(t, sh[0], 0.05));
    flash(c, 0.6 * pulse(t, T.pofu, 0.08), '255,236,243');
  },
};

// ============================================================ ふかふか（0:40 → 1:03）
const TRIO = [960, 990, 172], THY = TRIO[1] - 3.14 * TRIO[2];           // ママ（x, 足もと, 頭の半径）と、頭の中心の高さ
const SHOTS3 = [[T.hug, T.yuria, 1.1, 960, 575, 1.18, 960, 585], [T.yuria, T.pat, 1.2, 1085, 560, 1.27, 1095, 560], [T.pat, T.kawaii, 1.2, 835, 560, 1.27, 825, 560], [T.kawaii, T.motto, 1.1, 960, 575, 1.17, 960, 582],
  [T.motto, T.tired, 1.4, 960, 505, 1.48, 960, 498], [T.tired, T.stay, 1.16, 960, 580, 1.22, 960, 585], [T.stay, T.eve, 1.22, 960, 585, 1.08, 960, 565]];
function cozyBg(c, t, warm = 0) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgb([255, 247, 234], [255, 236, 208], warm)); g.addColorStop(1, rgb([255, 228, 232], [255, 216, 196], warm)); c.fillStyle = g; c.fillRect(-400, -400, W + 800, H + 800);
  for (let i = 0; i < 22; i++) { const x = hash1(i * 2.3) * W, y = hash1(i * 5.1) * H, r = 50 + 100 * hash1(i * 7.7); c.save(); c.globalAlpha = 0.4 + 0.2 * Math.sin(t * 1.1 + i); c.beginPath(); c.arc(x, y + 12 * Math.sin(t * 0.7 + i), r, 0, TAU); c.fillStyle = '#fffbf3'; c.fill(); c.restore(); }
}
// メロメロ度
function meter(c, t, t0, x, y) {
  const a = ease.outBack(K(t, t0, t0 + 0.3), 1.5); if (a <= 0) return;
  const over = t >= T.kawaii, ok = sat((t - T.kawaii) / 0.5);
  c.save(); c.translate(x, y); c.rotate(-0.03); c.scale(a, a);
  rrect(c, -270, -100, 540, 200, 26); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 6; c.stroke();
  c.fillStyle = '#ff9dbb'; rrect(c, -270, -100, 540, 46, 22); c.fill(); text(c, 'メロメロ度', 0, -76, 32, { col: '#fff', weight: 900 });
  [['ユリア', K(t, t0 + 0.4, t0 + 1.5), '#ffc14d'], ['ヴォル', K(t, t0 + 0.95, t0 + 2.3), '#a9b8f0']].forEach(([name, v, col], i) => {
    const yy = -22 + i * 62, pct = Math.round(v * 100);
    text(c, name, -250, yy, 32, { align: 'l', weight: 900 });
    rrect(c, -130, yy - 17, 270, 34, 17); c.fillStyle = '#f6eef2'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 4; c.stroke();
    const w = Math.max(34, 270 * v * (1 + 0.5 * ok)); rrect(c, -130, yy - 17, w, 34, 17); c.fillStyle = over ? '#ff7fa8' : col; c.fill(); c.strokeStyle = LINE; c.lineWidth = 4; c.stroke();
    if (!over) text(c, pct + '%', 258, yy, 30, { align: 'r', weight: 900, col: v >= 1 ? '#e0447a' : LINE });
  });
  c.restore();
  if (over) stamp(c, t, T.kawaii + 0.35, 999, '測定不能♡', x + 150, y + 30, -0.12, 54);
}
const hug = {
  id: 'hug', t0: T.hug, t1: T.eve,
  draw(c, t) {
    const cam = shotCam(SHOTS3, t), tq = on2(t), melt = t >= T.kawaii && t < T.tired, sleepy = t >= T.tired, warm = sm(T.tired, T.eve, t);
    setCam(c, cam); cozyBg(c, t, warm);
    c.save(); c.globalAlpha = 0.85; heartsUp(c, t, { n: melt ? 30 : 16, size: 26, alpha: 0.55, col: '#ffb3c8', x0: -100, w: W + 200, speed: sleepy ? 0.6 : 1 }); c.restore();
    glow(c, TRIO[0], TRIO[1] - 480, 760, 0.55, '255,236,200');
    if (melt) sparkles(c, t, 960, 480, 1700, 900, 22, { size: 28 });
    const land = 1 - sat((t - T.hug) / 0.3), patY = t >= T.yuria && t < T.pat, patV = t >= T.pat && t < T.kawaii;
    const yTalk = talk(tq, t, T.yuria + 0.2, T.pat - 0.5, 4) || talk(tq, t, T.tired + 1.75, T.stay - 0.5, 4), vTalk = talk(tq, t, T.pat + 0.2, T.kawaii - 0.5, 4) || talk(tq, t, T.tired + 0.2, T.tired + 1.4, 4);
    const mTalk = talk(tq, t, T.kawaii + 0.2, T.motto - 0.5) || talk(tq, t, T.motto + 0.2, T.tired - 0.5) || talk(tq, t, T.stay + 0.2, T.eve - 0.6);
    // ヴォルの眷属も、ふにゃふにゃ
    if (t >= T.pat) for (let i = 0; i < 3; i++) { const a = ease.outBack(K(t, T.pat + 0.2 + i * 0.15, T.pat + 0.8 + i * 0.15), 1.2), bx = 560 - i * 70, tx = bx - 60 - i * 26 + 26 * Math.sin(t * 1.6 + i * 2), ty = lerp(1000, 610 + i * 70, a) + 14 * Math.sin(t * 2.1 + i); tent(c, [[bx + 60, 1120], [bx + 10, 960], [lerp(bx, tx, 0.6) + 30, lerp(1000, ty, 0.6) + 60], [tx, ty]], 46, 20, t, { phase: i * 2, amp: 10, speed: sleepy ? 1.2 : 2.6, tip: 'heart' }); }
    const kids = hugGroup(c, t, TRIO, { vol: 1, yuria: 1, nuzzle: 1, pat: 0.5 - 0.5 * Math.cos(tq * 7), patWho: patY ? 'yuria' : patV ? 'vol' : null, wag: patY || melt ? 0.09 : 0, mBob: 0.05 * land,
      mTilt: t >= T.motto && t < T.tired ? 0.1 * Math.sin((tq - T.motto) * 2.4) : 0.03 * Math.sin(t * 0.9), mHx: t >= T.motto && t < T.tired ? 0.06 * Math.sin((tq - T.motto) * 2.4) : 0,
      mFace: { mouth: mTalk ? 'open' : melt ? 'open' : 'smile', blush: 1.4 + 0.4 * (melt ? 1 : 0) },
      yuriaFace: sleepy ? { eyes: 'shut', mouth: yTalk ? 'small' : 'cat', blush: 2.0 } : melt ? { eyes: 'heart', lid: 0, mouth: 'open', blush: 2.4 } : { eyes: 'happy', mouth: yTalk ? 'open' : 'cat', blush: 2.0 },
      volFace: sleepy ? { eyes: 'shut', mouth: vTalk ? 'small' : 'cat', blush: 2.1 } : melt ? { eyes: 'heart', lid: 0, mouth: 'cat', blush: 2.4 } : { eyes: patV ? 'shut' : 'happy', mouth: vTalk ? 'open' : 'cat', blush: 2.1 } });
    for (const k of kids) if (melt) steam(c, k.cx + k.side * 60, k.cy - k.ds * 1.25, t + k.side, 0.9);
    burst(c, 960, 560, t, T.hug, { n: 18, r: 620, size: 34, dur: 0.9 }); burst(c, 960, 520, t, T.kawaii, { n: 22, r: 760, size: 38, dur: 1.0 });
    // ---- 文字
    ident(c);
    const P = (x, y) => w2s(cam, x, y), topOf = (k) => P(k.cx + k.side * k.ds * 0.75, k.cy - k.ds * 1.0), mTop = (sd) => P(TRIO[0] + sd * TRIO[2] * 0.95, THY - TRIO[2] * 0.75);
    sfx(c, t, { t0: T.hug, t1: T.hug + 0.8, text: 'ぽふっ', x: 320, y: 230, size: 170, rot: -0.08, col: '#ff8fb1', fam: 'Zen Maru Gothic' });
    if (t < T.pat || (t >= T.kawaii && t < T.motto)) meter(c, t, T.hug + 0.9, 300, 150);
    sfx(c, t, { t0: T.hug + 1.0, t1: T.yuria - 0.1, text: 'ふかふか', x: 250, y: 610, size: 92, rot: -0.1, col: '#ffa24d', fam: 'Zen Maru Gothic' });
    sfx(c, t, { t0: T.hug + 1.7, t1: T.yuria - 0.1, text: 'ぬくぬく', x: 1722, y: 650, size: 72, rot: 0.07, col: '#ff8fb1', fam: 'Zen Maru Gothic' });
    bubble(c, t, { t0: T.yuria + 0.12, t1: T.pat - 0.08, x: 1530, y: 220, text: '……ママ。ちょっとだけ、\nここ借りる。\nんー……ちょっとだけね♡', size: 44, tail: topOf(kids[1]) });
    sfx(c, t, { t0: T.yuria + 1.3, t1: T.pat - 0.1, text: 'ぱたぱた', x: 1660, y: 700, size: 70, rot: 0.08, col: '#f0b24a', fam: 'Zen Maru Gothic' });
    sfx(c, t, { t0: T.pat + 0.05, t1: T.kawaii - 0.1, text: 'なでなで', x: 300, y: 480, size: 84, rot: -0.1, col: '#8ea2ee', fam: 'Zen Maru Gothic' });
    bubble(c, t, { t0: T.pat + 0.12, t1: T.kawaii - 0.08, x: 360, y: 215, text: 'ママ……もう少しだけ、\n撫でていてください♡', size: 48, tail: P(kids[0].cx - kids[0].ds * 0.15, kids[0].cy - kids[0].ds * 1.2) });
    bubble(c, t, { t0: T.kawaii + 0.12, t1: T.motto - 0.08, x: 1585, y: 165, text: 'あー、もう。ふたりとも\n可愛いねぇ♡', size: 52, tail: mTop(1), weight: 900 });
    sfx(c, t, { t0: T.kawaii + 0.3, t1: T.motto - 0.1, text: 'とろ〜ん', x: 255, y: 620, size: 92, rot: -0.08, col: '#ff7fa8', fam: 'Zen Maru Gothic' });
    sfx(c, t, { t0: T.kawaii + 0.8, t1: T.motto - 0.1, text: 'ふにゃ〜', x: 1722, y: 680, size: 70, rot: 0.07, col: '#ffa24d', fam: 'Zen Maru Gothic' });
    bubble(c, t, { t0: T.motto + 0.12, t1: T.tired - 0.08, x: 1500, y: 200, text: 'ママも、もうちょっと\nこうしてたいなぁ♡', size: 54, tail: mTop(1), weight: 900 });
    sfx(c, t, { t0: T.motto + 0.5, t1: T.tired - 0.1, text: 'すりすり', x: 340, y: 300, size: 84, rot: -0.08, col: '#ff8fb1', fam: 'Zen Maru Gothic' });
    bubble(c, t, { t0: T.tired + 0.12, t1: T.tired + 1.62, x: 300, y: 300, text: '……ふふ、\n落ち着きますねぇ♡', size: 46, tail: topOf(kids[0]) });
    bubble(c, t, { t0: T.tired + 1.68, t1: T.stay - 0.08, x: 1640, y: 290, text: '……ちょっと、\n疲れたかも', size: 46, tail: topOf(kids[1]) });
    bubble(c, t, { t0: T.stay + 0.12, t1: T.eve - 0.2, x: 385, y: 170, text: 'そっかぁ。じゃあ、もうちょっと\nここにいよっか♡', size: 42, tail: mTop(-1), weight: 900 });
    for (const sh of SHOTS3) if (sh[0] > T.hug + 0.1 && sh[0] < T.stay) flash(c, 0.3 * pulse(t, sh[0], 0.05), '255,246,236');
    flash(c, 0.9 * pulse(t, T.hug, 0.1), '255,236,243');
    flash(c, sat((t - (T.eve - 0.5)) / 0.5), '255,239,221');
  },
};

// ============================================================ 夕方（1:03 → 1:12）
const EVE_SHOTS = [[T.eve, T.card, 1.1, 985, 548, 1.2, 1000, 540]];
const evening = {
  id: 'evening', t0: T.eve, t1: T.card,
  draw(c, t) {
    const cam = shotCam(EVE_SHOTS, t), fix = ease.inOutSine(K(t, T.ruri + 0.55, T.ruri + 1.4));
    setCam(c, cam);
    livingRoom(c, t, { eve: 1, door: 0 });
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.16; c.beginPath(); c.moveTo(1500, 150); c.lineTo(1820, 150); c.lineTo(1180, 1090); c.lineTo(520, 1090); c.closePath(); c.fillStyle = '#ffd9a0'; c.fill(); c.restore();     // 窓からの光
    sofa(c, SX, SB, 900, { main: '#e3d3ea', seat: '#efe1f0', shade: '#cdb9dc' });
    const br = Math.sin(t * 1.5), m = [SX, 885, 150];
    hugGroup(c, t, m, { vol: 1, yuria: 1, sit: 1, dx: 1.3, dy: 1.12, rot: 0.16, ds: 0.82, mTilt: 0.1 + 0.008 * br, mBob: 0.012 * br,
      mFace: { mouth: 'small', blush: 1.3 }, yuriaFace: { eyes: 'shut', mouth: 'cat', blush: 1.6 }, volFace: { eyes: 'shut', mouth: 'small', blush: 1.6 } });
    // 毛布（三人の膝に、ひとつ）
    const top = (x) => 694 - 30 * fix * sat((x - (SX - 80)) / 300) + 8 * Math.sin((x - SX) * 0.021) + 2 * br;
    c.beginPath(); c.moveTo(SX - 430, 890); c.lineTo(SX - 418, top(SX - 418) + 30);
    for (let x = SX - 418; x <= SX + 418; x += 22) c.lineTo(x, top(x) + 30 * Math.pow(Math.abs(x - SX) / 418, 6));
    c.lineTo(SX + 430, 890); c.quadraticCurveTo(SX, 924, SX - 430, 890); c.closePath(); c.fillStyle = '#fde4ec'; c.fill(); c.strokeStyle = LINE; c.lineWidth = 5; c.lineJoin = 'round'; c.stroke();
    c.save(); c.clip(); for (let i = -4; i <= 4; i++) for (let j = 0; j < 3; j++) heart(c, SX + i * 100 + (j % 2) * 50, 760 + j * 56, 13, '#fffafc'); c.beginPath(); for (let x = SX - 418; x <= SX + 418; x += 22) c.lineTo(x, top(x) + 34); c.strokeStyle = '#f2bccd'; c.lineWidth = 5; c.stroke(); c.restore();
    tent(c, [[SX - 470, 800], [SX - 440, 720], [SX - 380, 700 + 3 * br], [SX - 330, top(SX - 330) + 26]], 34, 16, t, { phase: 1, amp: 3, speed: 1.0, tip: 'heart' });       // 眷属も、毛布の端を持ったまま寝ている
    teaTable(c, t, 3, 0.35);
    for (const [x, y, ph] of [[SX - 300, 330, 0], [SX + 40, 250, 0.33], [SX + 330, 340, 0.66]]) for (let i = 0; i < 3; i++) { const a = (t * 0.32 + ph + i * 0.33) % 1; c.save(); c.globalAlpha = Math.sin(a * Math.PI) * 0.85; text(c, 'z', x + 36 * a + i * 14, y - 110 * a, 34 + 26 * a, { col: '#93a4e0', weight: 900, stroke: '#ffffff', strokeW: 8 }); c.restore(); }
    c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgba(255,214,176,.42)'; c.fillRect(-400, -400, W + 800, H + 800); c.restore();        // 夕方の色
    for (let i = 0; i < 16; i++) { const a = (t * 0.07 + hash1(i * 3.7)) % 1; c.save(); c.globalAlpha = 0.5 * Math.sin(a * Math.PI); c.beginPath(); c.arc(700 + hash1(i * 1.9) * 900 - a * 120, 250 + hash1(i * 5.3) * 650 + a * 60, 3 + 3 * hash1(i), 0, TAU); c.fillStyle = '#fff3d6'; c.fill(); c.restore(); }
    // ---- 文字
    ident(c);
    sfx(c, t, { t0: T.eve + 1.0, t1: T.narr - 0.2, text: 'すぅ…すぅ…', x: 1480, y: 600, size: 62, rot: 0.05, col: '#93a4e0', fam: 'Zen Maru Gothic' });
    const n1 = sm(T.narr, T.narr + 0.7, t), n2 = sm(T.narr + 1.75, T.narr + 2.45, t), nOut = 1 - sm(T.card - 0.5, T.card - 0.1, t);
    if (n1 > 0) { c.save(); c.globalAlpha = n1 * nOut; rrect(c, 290, 900, 1110, 150, 30); c.fillStyle = 'rgba(255,250,244,.88)'; c.fill(); c.globalAlpha = n1 * nOut; text(c, '星々を収められる腕が、いまは——', 845, 944, 42, { weight: 700 }); c.globalAlpha = n2 * nOut; text(c, 'ふたりが眠れる幅だけ、空いている。', 845, 1005, 42, { weight: 700 }); c.restore(); }
    bubble(c, t, { t0: T.ruri + 0.1, t1: T.card - 0.2, x: 330, y: 250, text: '……もう。三人とも、\nこんなところで', size: 44, tail: [-40, 300] });
    if (t > T.ruri + 0.1 && t < T.card - 0.2) text(c, '（ルリカ）', 330, 372, 30, { col: '#8f84c8', weight: 700, stroke: '#fff6ea' });
    sfx(c, t, { t0: T.ruri + 0.6, t1: T.card - 0.2, text: 'そっ…', x: 1500, y: 700, size: 64, rot: -0.06, col: '#8fb4dc', fam: 'Zen Maru Gothic' });
    fadeIn(c, t, T.eve, 0.6, '255,239,221');
    flash(c, sat((t - (T.card - 0.3)) / 0.3), '253,251,248');
  },
};

// ============================================================ 札（1:12 → ）
const card = {
  id: 'card', t0: T.card, t1: DURATION + 1,
  draw(c, t, tl, env) {
    c.fillStyle = '#fdfbf8'; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = 0.7; heartsUp(c, t, { n: 12, size: 20, alpha: 0.4, col: '#ffc4d4' }); c.restore();
    head(c, 'vol', 700, 250, 96, { eyes: 'shut', mouth: 'cat', blush: 1.7 }, 0.1 + 0.015 * Math.sin(t * 1.5));
    head(c, 'yuria', 1220, 250, 96, { eyes: 'happy', mouth: 'cat', blush: 1.7 }, -0.1 + 0.015 * Math.sin(t * 1.5 + 1));
    head(c, 'fururu', 960, 215, 116, { mouth: 'open', blush: 1.3 }, 0.02 * Math.sin(t * 1.2));
    text(c, 'ふたりとも、おいでぇ♡', 960, 500, 100, { fam: 'Dela Gothic One', weight: 400, col: '#e9799b', heart: '#ff7fa3' });
    const loc = env.stats && env.stats.loc ? env.stats.loc.toLocaleString('en-US') : '—';
    const rows = ['外神竜一族 設定資料（2026 年 11 月 10 日版）より　フルル・ユリア・ヴォル', '音楽　“Slice of Life”　Bryan Teoh（CC0）　／　効果音　SFX Kit by Wyzowl（CC0）', `絵と動き　すべてプログラムで描画（${loc} 行）`, '設定・元絵　あなた　／　構成・プログラム　Claude'];
    rows.forEach((r, i) => { c.save(); c.globalAlpha = sat((tl - 0.3 - i * 0.15) / 0.4); text(c, r, 960, 660 + i * 70, i === 0 ? 40 : 32, { weight: i === 0 ? 700 : 500, col: i === 0 ? LINE : '#8b7a88' }); c.restore(); });
    fadeIn(c, t, T.card, 0.35);
    flash(c, sat((t - (DURATION - 0.7)) / 0.6), '253,251,248');
  },
};

export const SCENES = [home, oide, hug, evening, card];
