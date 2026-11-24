// stage.js — 舞台（深夜の作業室）と人物を描く。横から見た図で、右に「槽」（放射線の出どころ）がある。
//   base（上に重ねる層）: 部屋・人物      glow（光として足す層）: 灯り・青い光・人物のふち・気合いの照り返し
import { W, H, sat, smoothstep, lerp, clamp, TAU, hash1 } from './core.js';
import { Layer2D, rr, rgba } from '../../atom/src/kit.js';
import { U, FLOOR, solve, drawFigure, eyeOf, mouthOf } from './figure.js';

export const SRC = [1604, 566];          // 槽ののぞき窓（青い光の中心）
export const LEVER = [1322, 628];        // 緊急停止レバーの支点
export const LEVER_LEN = 128;
export const leverTip = (k) => { const a = lerp(-2.25, -0.72, k); return [LEVER[0] + Math.cos(a) * LEVER_LEN, LEVER[1] + Math.sin(a) * LEVER_LEN]; };   // k: 0 上 → 1 引き下ろした
export const CAM0 = { s: 1, fx: W / 2, fy: H / 2 };

function trefoil(c, x, y, r) {
  c.fillStyle = '#e8b417'; rr(c, x - r * 1.5, y - r * 1.5, r * 3, r * 3, r * 0.2); c.fill();
  c.strokeStyle = '#17150f'; c.lineWidth = r * 0.09; rr(c, x - r * 1.36, y - r * 1.36, r * 2.72, r * 2.72, r * 0.14); c.stroke();
  c.fillStyle = '#17150f'; c.beginPath(); c.arc(x, y, r * 0.2, 0, TAU); c.fill();
  for (const a0 of [Math.PI / 2, -Math.PI / 6, -Math.PI * 5 / 6]) { c.beginPath(); c.arc(x, y, r, a0 - Math.PI / 6, a0 + Math.PI / 6); c.arc(x, y, r * 0.3, a0 + Math.PI / 6, a0 - Math.PI / 6, true); c.closePath(); c.fill(); }
}

function room(c, st) {
  // 壁
  let g = c.createLinearGradient(0, -200, 0, FLOOR); g.addColorStop(0, '#2a323f'); g.addColorStop(1, '#343d4a');
  c.fillStyle = g; c.fillRect(-900, -700, 3800, FLOOR + 700);
  c.fillStyle = '#263a3c'; c.fillRect(-900, 652, 3800, FLOOR - 652);                       // 腰壁
  c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(-900, 646, 3800, 8);
  for (let x = -880; x < 2900; x += 264) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x, -700, 3, FLOOR + 700); c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(x + 3, -700, 2, FLOOR + 700); }
  // 高窓（左）
  const dawn = st.dawn || 0;
  for (let i = 0; i < 3; i++) {
    const x = 96 + i * 168, y = 142, w = 124, h = 250;
    c.fillStyle = '#12161c'; c.fillRect(x - 10, y - 10, w + 20, h + 20);
    g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, rgba(lerp(9, 122, dawn), lerp(14, 158, dawn), lerp(30, 214, dawn))); g.addColorStop(1, rgba(lerp(13, 255, dawn), lerp(19, 190, dawn), lerp(38, 128, dawn)));
    c.fillStyle = g; c.fillRect(x, y, w, h);
    c.fillStyle = '#12161c'; c.fillRect(x + w / 2 - 3, y, 6, h); c.fillRect(x, y + h * 0.48, w, 6);
  }
  // 配管
  const pipe = (y, r, col) => { g = c.createLinearGradient(0, y - r, 0, y + r); g.addColorStop(0, col[0]); g.addColorStop(0.35, col[1]); g.addColorStop(1, col[2]); c.fillStyle = g; c.fillRect(-900, y - r, 3800, r * 2); for (let x = -700; x < 2900; x += 430) { c.fillStyle = col[2]; c.fillRect(x, y - r - 5, 20, r * 2 + 10); c.fillStyle = col[1]; c.fillRect(x + 3, y - r - 5, 5, r * 2 + 10); } };
  pipe(58, 26, ['#5b6676', '#7d8a9c', '#2c333d']); pipe(112, 13, ['#6a5a3c', '#a08a5c', '#3a3020']);
  g = c.createLinearGradient(SRC[0] - 22, 0, SRC[0] + 22, 0); g.addColorStop(0, '#2c333d'); g.addColorStop(0.4, '#7d8a9c'); g.addColorStop(1, '#2c333d');
  c.fillStyle = g; c.fillRect(SRC[0] - 22, 84, 44, 250);
  // 時計
  const ck = [800, 250], hr = st.clock ?? 2.2;
  c.fillStyle = '#12161c'; c.beginPath(); c.arc(ck[0], ck[1], 50, 0, TAU); c.fill(); c.fillStyle = '#d9dcd6'; c.beginPath(); c.arc(ck[0], ck[1], 43, 0, TAU); c.fill();
  c.strokeStyle = '#12161c'; c.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.lineWidth = i % 3 ? 2 : 4; c.beginPath(); c.moveTo(ck[0] + Math.sin(a) * 35, ck[1] - Math.cos(a) * 35); c.lineTo(ck[0] + Math.sin(a) * 40, ck[1] - Math.cos(a) * 40); c.stroke(); }
  const ha = (hr % 12) / 12 * TAU, ma = (hr % 1) * TAU;
  c.lineWidth = 5; c.beginPath(); c.moveTo(ck[0], ck[1]); c.lineTo(ck[0] + Math.sin(ha) * 22, ck[1] - Math.cos(ha) * 22); c.stroke();
  c.lineWidth = 3; c.beginPath(); c.moveTo(ck[0], ck[1]); c.lineTo(ck[0] + Math.sin(ma) * 33, ck[1] - Math.cos(ma) * 33); c.stroke();
  // 標識
  trefoil(c, 1196, 292, 40);
  c.fillStyle = '#e9e6dc'; rr(c, 1118, 366, 156, 44, 4); c.fill(); c.fillStyle = '#17150f'; c.font = '700 25px "Noto Sans JP"'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('管理区域', 1196, 389);
  // 灯りの器具
  for (const x of [520, 1080]) { c.fillStyle = '#12161c'; c.fillRect(x - 2, 126, 4, 78); c.beginPath(); c.moveTo(x - 20, 204); c.lineTo(x + 20, 204); c.lineTo(x + 54, 238); c.lineTo(x - 54, 238); c.closePath(); c.fill(); c.fillStyle = rgba(255, 244, 214, 0.15 + 0.85 * (st.lamp ?? 0)); c.fillRect(x - 44, 238, 88, 7); }
  // 回転灯（非常時）
  c.fillStyle = '#1a1e25'; c.fillRect(928, 150, 44, 16); c.fillStyle = rgba(120 + 135 * (st.alarm || 0), 20, 16); rr(c, 934, 118, 32, 34, 12); c.fill();
  // 槽
  const vx = SRC[0] - 170, vw = 340, vy = 322, vh = FLOOR - 40 - vy;
  c.fillStyle = '#1a1e25'; c.fillRect(vx + 26, FLOOR - 46, 40, 46); c.fillRect(vx + vw - 66, FLOOR - 46, 40, 46); c.fillRect(vx - 14, FLOOR - 14, vw + 28, 14);
  g = c.createLinearGradient(vx, 0, vx + vw, 0); g.addColorStop(0, '#2b3440'); g.addColorStop(0.3, '#6f7d8f'); g.addColorStop(0.46, '#8996a8'); g.addColorStop(1, '#232a34');
  c.fillStyle = g; rr(c, vx, vy, vw, vh, 70); c.fill();
  for (const y of [vy + 84, vy + vh - 96]) { g = c.createLinearGradient(vx, 0, vx + vw, 0); g.addColorStop(0, '#1e252e'); g.addColorStop(0.36, '#95a2b4'); g.addColorStop(1, '#1a2028'); c.fillStyle = g; c.fillRect(vx - 8, y, vw + 16, 20); }
  c.fillStyle = '#1a1e25'; c.beginPath(); c.arc(SRC[0], SRC[1], 86, 0, TAU); c.fill();
  c.fillStyle = '#566272'; c.beginPath(); c.arc(SRC[0], SRC[1], 78, 0, TAU); c.fill();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.fillStyle = '#20262e'; c.beginPath(); c.arc(SRC[0] + Math.cos(a) * 68, SRC[1] + Math.sin(a) * 68, 5.5, 0, TAU); c.fill(); }
  const bl = sat(st.blue || 0);
  c.fillStyle = rgba(lerp(8, 150, bl), lerp(16, 215, bl), lerp(28, 255, bl)); c.beginPath(); c.arc(SRC[0], SRC[1], 56, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(SRC[0] - 18, SRC[1] - 22, 22, 12, -0.6, 0, TAU); c.fill();
  // 操作盤とレバー
  c.fillStyle = '#1b2028'; c.fillRect(LEVER[0] - 46, LEVER[1] + 22, 92, FLOOR - LEVER[1] - 22);
  g = c.createLinearGradient(LEVER[0] - 60, 0, LEVER[0] + 60, 0); g.addColorStop(0, '#3b4552'); g.addColorStop(0.5, '#56616f'); g.addColorStop(1, '#2a323c');
  c.fillStyle = g; rr(c, LEVER[0] - 60, LEVER[1] - 34, 120, 84, 8); c.fill();
  c.fillStyle = '#e9e6dc'; rr(c, LEVER[0] - 52, LEVER[1] + 62, 104, 36, 3); c.fill(); c.fillStyle = '#b3160c'; c.font = '700 23px "Noto Sans JP"'; c.fillText('緊急停止', LEVER[0], LEVER[1] + 81);
  c.fillStyle = '#12161c'; rr(c, LEVER[0] - 40, LEVER[1] - 12, 80, 26, 13); c.fill();
  const tip = leverTip(st.lever || 0);
  c.strokeStyle = '#9aa3ae'; c.lineWidth = 13; c.lineCap = 'round'; c.beginPath(); c.moveTo(LEVER[0], LEVER[1]); c.lineTo(tip[0], tip[1]); c.stroke();
  c.fillStyle = '#d4281c'; c.beginPath(); c.arc(tip[0], tip[1], 21, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(tip[0] - 6, tip[1] - 7, 7, 0, TAU); c.fill();
  c.fillStyle = '#2a323c'; c.beginPath(); c.arc(LEVER[0], LEVER[1], 13, 0, TAU); c.fill();
  // 床
  g = c.createLinearGradient(0, FLOOR, 0, FLOOR + 320); g.addColorStop(0, '#272d36'); g.addColorStop(1, '#0e1116');
  c.fillStyle = g; c.fillRect(-900, FLOOR, 3800, 900);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-900, FLOOR, 3800, 5);
  c.fillStyle = '#a8891c'; c.fillRect(-900, FLOOR + 58, 3800, 9);
}

export class Stage {
  constructor(env) {
    this.env = env;
    this.base = new Layer2D(env); this.glow = new Layer2D(env); this.fig = new Layer2D(env);
    const mk = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; };
    this.figc = this.fig.cv; this.rimc = mk(); this.lightc = mk();
    this.J = null;
  }
  X(st, x) { return (x - st.cam.fx) * st.cam.s + W / 2; }
  Y(st, y) { return (y - st.cam.fy) * st.cam.s + H / 2; }

  // st: { t, cam{s,fx,fy}, gx, pose, look, amb, lamp, blue, alarm, aura, soul, dawn, lever, clock, blood, clip, fig, figAmb, handNWorld, onFloor(c), onBack(c), onGlow(c) }
  draw(st) {
    const cam = st.cam, s = cam.s, ex = W / 2 - cam.fx * s, ey = H / 2 - cam.fy * s;
    const setCam = (c) => c.setTransform(s, 0, 0, s, ex, ey), ident = (c) => c.setTransform(1, 0, 0, 1, 0, 0);
    const amb = st.amb ?? 0.5, lamp = st.lamp ?? 0, blue = st.blue || 0, kb = sat(blue), aura = st.aura || 0, soul = st.soul || 0, dawn = st.dawn || 0, alarm = st.alarm || 0;
    const J = this.J = solve(st.pose, st.gx, { handNWorld: st.handNWorld || null });
    const figOn = st.fig !== 0;
    const aC = soul > 0.5 ? [165, 222, 255] : [255, 172, 62];
    // ---- 人物（別のキャンバスに描く。体の血はシルエットの内側だけに塗る）
    const fc = this.figc.getContext('2d');
    ident(fc); fc.globalCompositeOperation = 'source-over'; fc.clearRect(0, 0, W, H);
    if (figOn) {
      setCam(fc); drawFigure(fc, J, st.look || {});
      if (st.clip) { fc.save(); fc.translate(J.wN[0], J.wN[1]); fc.rotate(-0.5); fc.fillStyle = '#8d7a58'; fc.fillRect(-8, -52, 62, 80); fc.fillStyle = '#eeeadf'; fc.fillRect(-3, -44, 52, 66); fc.fillStyle = '#5b6470'; for (let i = 0; i < 6; i++) fc.fillRect(4, -34 + i * 10, 38 - (i % 3) * 8, 3); fc.restore(); fc.fillStyle = '#dcd8c8'; fc.beginPath(); fc.arc(J.wN[0], J.wN[1], 0.22 * U, 0, TAU); fc.fill(); }
      fc.globalCompositeOperation = 'source-atop';
      const bd = st.blood || 0;
      if (bd > 0) {
        const mid = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
        const pts = [J.sh, J.hip, J.eN, J.kN, J.wN, J.kF, mid(J.sh, J.hc, 0.35), mid(J.hip, J.sh, 0.5), mid(J.hip, J.sh, 0.3), mid(J.hip, J.sh, 0.75), mid(J.sN, J.eN, 0.5), mid(J.hN, J.kN, 0.5), mid(J.kN, J.aN, 0.5), mid(J.eN, J.wN, 0.5), J.eF, mid(J.hF, J.kF, 0.6), mid(J.sh, J.hc, 0.6), J.kF];
        pts.forEach((p, i) => {
          const k = sat((bd - hash1(i * 3.1) * 0.85) * 2.2); if (k <= 0) return;
          const R = U * (0.1 + 0.2 * hash1(i * 2.3)) * (0.5 + 0.7 * k), x = p[0] + (hash1(i * 7.7) - 0.5) * 34, y = p[1] + (hash1(i * 5.3) - 0.5) * 34;
          const g = fc.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, rgba(176, 8, 14, 0.95 * k)); g.addColorStop(0.7, rgba(140, 5, 10, 0.85 * k)); g.addColorStop(1, 'rgba(120,0,8,0)');
          fc.fillStyle = g; fc.beginPath(); fc.arc(x, y, R, 0, TAU); fc.fill();
          fc.fillStyle = rgba(150, 6, 12, 0.85 * k); fc.fillRect(x - R * 0.2, y, R * 0.4, R * (1.2 + 2.2 * hash1(i * 9.9)) * k);      // たれた筋
        });
        if (bd > 0.3) { const m = mouthOf(J); fc.strokeStyle = rgba(170, 8, 14, 0.95); fc.lineWidth = 0.075 * U; fc.lineCap = 'round'; fc.beginPath(); fc.moveTo(m.p[0] - 0.1 * U, m.p[1] + 0.02 * U); fc.quadraticCurveTo(m.p[0] - 0.06 * U, m.p[1] + 0.2 * U, m.p[0] - 0.14 * U, m.p[1] + 0.42 * U); fc.stroke(); }
      }
      // 明るさ（逆光なら暗く、灯りや気合いの中では明るく）
      const fa = st.figAmb ?? clamp(amb * 0.55 + lamp * 0.55 + dawn * 0.8 + aura * (soul > 0.5 ? 0.2 : 0.5) + kb * 0.24, 0.1, soul > 0.5 && dawn < 0.5 ? 0.62 : 1);
      ident(fc); fc.fillStyle = rgba(3, 6, 16, 1 - fa); fc.fillRect(0, 0, W, H);
      if (kb > 0.02) { fc.fillStyle = rgba(30, 80, 190, 0.22 * kb * (1 - 0.8 * sat(aura))); fc.fillRect(0, 0, W, H); }
      if (aura > 0.02) { fc.fillStyle = rgba(aC[0], aC[1], aC[2], (soul > 0.5 ? 0.07 : 0.16) * sat(aura)); fc.fillRect(0, 0, W, H); }
      fc.globalCompositeOperation = 'source-over';
    }
    // ---- 光の地図（部屋の色に掛け合わせる）
    const lc = this.lightc.getContext('2d');
    ident(lc); lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = rgba(255 * amb * 0.8, 255 * amb * 0.88, 255 * amb); lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'lighter'; setCam(lc);
    const radial = (c, x, y, R, stops, sy = 1) => { const g = c.createRadialGradient(x, y, 0, x, y, R); for (const [o, col] of stops) g.addColorStop(o, col); c.save(); c.translate(0, y); c.scale(1, sy); c.translate(0, -y); c.fillStyle = g; c.fillRect(x - R, y - R, R * 2, R * 2); c.restore(); };
    if (lamp > 0) for (const x of [520, 1080]) {
      radial(lc, x, 600, 640, [[0, rgba(255, 238, 208, 0.62 * lamp)], [0.5, rgba(255, 232, 200, 0.3 * lamp)], [1, 'rgba(255,230,200,0)']], 1.25);
      radial(lc, x, FLOOR + 30, 380, [[0, rgba(255, 238, 208, 0.5 * lamp)], [1, 'rgba(255,230,200,0)']], 0.3);
    }
    if (blue > 0) {
      const fl = 0.92 + 0.08 * Math.sin(st.t * 31) * Math.sin(st.t * 17.3);
      radial(lc, SRC[0], SRC[1], 2100, [[0, rgba(170, 215, 255, kb * fl)], [0.07, rgba(90, 160, 255, 0.9 * kb * fl)], [0.25, rgba(36, 100, 245, 0.55 * kb)], [0.55, rgba(16, 56, 200, 0.24 * kb)], [1, 'rgba(8,30,160,0)']]);
      if (blue > 1) radial(lc, SRC[0], SRC[1], 2600, [[0, rgba(200, 230, 255, sat(blue - 1))], [0.5, rgba(60, 130, 255, 0.5 * sat(blue - 1))], [1, 'rgba(20,60,200,0)']]);
    }
    if (alarm > 0) radial(lc, 950, 134, 760, [[0, rgba(255, 46, 24, 0.75 * alarm * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(st.t * 5.2))))], [1, 'rgba(255,20,10,0)']]);
    if (aura > 0 && figOn) {
      const R = 430 + 300 * Math.min(aura, 1.6);
      radial(lc, st.gx, FLOOR - 200, R, [[0, rgba(aC[0], aC[1], aC[2], 0.75 * sat(aura))], [0.5, rgba(aC[0], aC[1] * 0.85, aC[2] * 0.8, 0.3 * sat(aura))], [1, rgba(aC[0], aC[1] * 0.7, aC[2] * 0.6, 0)]]);
      radial(lc, st.gx, FLOOR + 16, R * 1.1, [[0, rgba(aC[0], aC[1], aC[2], 0.7 * sat(aura))], [1, rgba(aC[0], aC[1] * 0.7, aC[2] * 0.6, 0)]], 0.22);
    }
    if (dawn > 0) { const g = lc.createLinearGradient(0, 0, 2100, 500); g.addColorStop(0, rgba(255, 214, 165, 0.85 * dawn)); g.addColorStop(1, rgba(255, 190, 140, 0.4 * dawn)); lc.fillStyle = g; lc.fillRect(-900, -700, 3800, 2600); }
    if (st.onLight) st.onLight(lc);
    // ---- base: 部屋 × 光 → もや → 影 → 人物
    const c = this.base.begin();
    setCam(c); room(c, st);
    if (st.onFloor) st.onFloor(c);
    ident(c); c.globalCompositeOperation = 'multiply'; c.drawImage(this.lightc, 0, 0);
    c.globalCompositeOperation = 'lighter'; setCam(c);
    if (lamp > 0) for (const x of [520, 1080]) {
      const g = c.createLinearGradient(0, 240, 0, FLOOR + 40); g.addColorStop(0, rgba(255, 236, 200, 0.11 * lamp)); g.addColorStop(1, rgba(255, 236, 200, 0.01 * lamp));
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 44, 244); c.lineTo(x + 44, 244); c.lineTo(x + 330, FLOOR + 60); c.lineTo(x - 330, FLOOR + 60); c.closePath(); c.fill();
    }
    if (blue > 0) {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i - 3) * 0.2 + 0.05 * Math.sin(st.t * 0.7 + i * 2.1), wd = 0.03 + 0.03 * hash1(i * 9.1), len = 1900;
        const gg = c.createLinearGradient(SRC[0], SRC[1], SRC[0] + Math.cos(a) * len, SRC[1] + Math.sin(a) * len);
        const ii = (0.04 + 0.04 * hash1(i * 4.4)) * Math.min(blue, 2) * (0.7 + 0.3 * Math.sin(st.t * (1.3 + i * 0.37) + i));
        gg.addColorStop(0, rgba(110, 180, 255, ii * 1.5)); gg.addColorStop(1, 'rgba(60,130,255,0)');
        c.fillStyle = gg; c.beginPath(); c.moveTo(SRC[0], SRC[1]); c.lineTo(SRC[0] + Math.cos(a - wd) * len, SRC[1] + Math.sin(a - wd) * len); c.lineTo(SRC[0] + Math.cos(a + wd) * len, SRC[1] + Math.sin(a + wd) * len); c.closePath(); c.fill();
      }
      radial(c, SRC[0], SRC[1], 330, [[0, rgba(150, 205, 255, 0.55 * kb)], [1, 'rgba(60,130,255,0)']]);
    }
    if (dawn > 0) for (let i = 0; i < 3; i++) {
      const x = 96 + i * 168; const g = c.createLinearGradient(x, 150, x + 900, FLOOR + 80); g.addColorStop(0, rgba(255, 200, 130, 0.3 * dawn)); g.addColorStop(1, 'rgba(255,170,90,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(x, 142); c.lineTo(x + 124, 142); c.lineTo(x + 1150 + i * 120, FLOOR + 110); c.lineTo(x + 500 + i * 120, FLOOR + 110); c.closePath(); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    if (figOn) {
      // 足もとの影と、光源から伸びる影
      radial(c, st.gx, FLOOR + 8, 170, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']], 0.16);
      if (blue > 0.05) {
        const kx = clamp((SRC[0] - st.gx) / 330, 0.6, 3.2);
        c.save(); c.transform(1, 0, kx * 0.22, -0.22, -kx * 0.22 * FLOOR, FLOOR * 1.22); c.globalAlpha = 0.62 * kb; drawFigure(c, J, { ...(st.look || {}), flat: '#01030a' }); c.restore(); c.globalAlpha = 1;
      }
      if (dawn > 0.05) { c.save(); c.transform(1, 0, -0.55, -0.24, 0.55 * FLOOR, FLOOR * 1.24); c.globalAlpha = 0.4 * dawn; drawFigure(c, J, { ...(st.look || {}), flat: '#120a06' }); c.restore(); c.globalAlpha = 1; }
    }
    if (st.onBack) { setCam(c); st.onBack(c); }
    this.base.flush('alpha', 1, 1);
    if (st.mid) st.mid();                       // 部屋と人物のあいだに描くもの（オーラなど）
    if (st.onFront) { fc.globalCompositeOperation = 'source-over'; setCam(fc); st.onFront(fc); }
    if (figOn || st.onFront) this.fig.flush('alpha', 1, 1);
    // ---- glow（HDR の光）: のぞき窓の芯・人物のふち・目
    const gl = this.glow.begin();
    gl.globalCompositeOperation = 'lighter'; setCam(gl);
    if (blue > 0) radial(gl, SRC[0], SRC[1], 150, [[0, rgba(235, 248, 255, kb)], [0.34, rgba(160, 215, 255, 0.95 * kb)], [0.42, rgba(80, 160, 255, 0.35 * kb)], [1, 'rgba(40,120,255,0)']]);
    if (lamp > 0) for (const x of [520, 1080]) { gl.fillStyle = rgba(255, 244, 214, 0.85 * lamp); gl.fillRect(x - 44, 238, 88, 7); }
    if (alarm > 0) radial(gl, 950, 134, 70, [[0, rgba(255, 70, 40, alarm * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(st.t * 5.2))))], [1, 'rgba(255,20,10,0)']]);
    if (dawn > 0) for (let i = 0; i < 3; i++) { gl.fillStyle = rgba(255, 220, 170, 0.5 * dawn); gl.fillRect(96 + i * 168, 142, 124, 250); }
    if (figOn) {
      const rc = this.rimc.getContext('2d');
      const rim = (dx, dy, col, a) => {
        if (a <= 0.004) return;
        ident(rc); rc.globalCompositeOperation = 'source-over'; rc.clearRect(0, 0, W, H);
        rc.drawImage(this.figc, 0, 0); rc.globalCompositeOperation = 'destination-out'; rc.drawImage(this.figc, dx, dy);
        rc.globalCompositeOperation = 'source-in'; rc.fillStyle = col; rc.fillRect(0, 0, W, H);
        ident(gl); gl.globalAlpha = Math.min(1, a); gl.drawImage(this.rimc, 0, 0); if (a > 1) { gl.globalAlpha = Math.min(1, a - 1); gl.drawImage(this.rimc, 0, 0); } gl.globalAlpha = 1;
      };
      const w = clamp(4.4 * s, 3, 9.5);
      rim(-w, w * 0.25, '#6ab4ff', Math.min(blue, 2) * 0.9);
      rim(w * 0.9, -w * 0.45, soul > 0.5 ? '#d6f3ff' : '#ffbe52', aura * 0.9);
      rim(w * 0.8, w * 0.1, '#ffd2a0', dawn * 0.7);
      const eg = (st.look && st.look.eye) || 0;
      if (eg > 0) { setCam(gl); const e = eyeOf(J); radial(gl, e[0], e[1], 20 * eg, [[0, rgba(255, 236, 170, 0.95 * sat(eg))], [0.3, rgba(255, 170, 40, 0.45 * sat(eg))], [1, 'rgba(255,120,0,0)']]); }
    }
    if (st.onGlow) { setCam(gl); st.onGlow(gl); }
    this.glow.flush('add', st.glowGain ?? 2.0, 1);
  }
}
