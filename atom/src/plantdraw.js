// plantdraw.js — 沸騰水型の原子力発電所の断面図（模式図。寸法はおおよそ実物に合わせてある。単位はメートル、原点は炉心の中心）
// 1 つの「世界」を、ペレット 1 個（1 cm）から発電所全体（100 m 以上）まで、同じ関数で描く。発電の章と事故の章で共用。
//   b: 下地のキャンバス（暗い面）  g: 光のキャンバス（線・発光。加算で重ねる）
import { W, H, sat, lerp, smoothstep, clamp, mulberry32, TAU, fract } from './core.js';

// ---- 寸法
export const G = {
  pitchA: 0.152, nA: 13,                 // 燃料集合体の間隔、片側の体数（全部で 27 体が横に並ぶ）
  pitchR: 0.0144, rodD: 0.0112, pelD: 0.0096, pelH: 0.0102,   // 燃料棒（9×9）
  coreY0: -1.85, coreY1: 1.85,
  rpvR: 2.9, rpvY0: -7.6, rpvY1: 13.2, head: 2.3,
  water0: 5.4,                           // ふだんの水位
  rb: { x0: -23, x1: 23, y0: -15, y1: 31, floor: 17 },
  sfp: { x0: 9, x1: 19, y0: 9.6, y1: 17 },
  ground: -3, sea: -13,
  tb: { x0: 29, x1: 90, y0: -11, y1: 15 },
  shaftY: 6.5,
  cond: { x0: 39, x1: 61, y0: -8.6, y1: 0.6 },
  steam: [[2.9, 10.5], [7.3, 10.5], [7.3, 7.7], [34.5, 7.7], [34.5, 6.5], [38.2, 6.5]],
  feed: [[41, -8.0], [33.5, -8.0], [33.5, 3.4], [2.9, 3.4]],
  seaIn: [[116, -14.4], [57, -14.4], [57, -6.2]],
  seaOut: [[43, -6.2], [43, -12.8], [116, -12.8]],
  line: [[76, 9.2], [76, 70]],             // 送電線（発電機から、画面の外へ）
};
const CORE_HALF = (G.nA + 0.5) * G.pitchA;

// 視点: 世界 → 画面。cx, cy は画面の中央に来る世界の点、s は 1 m あたりの画素数、ox, oy は画面上のずらし
export const toScreen = (v, x, y) => [W / 2 + (v.ox || 0) + (x - v.cx) * v.s, H / 2 + (v.oy || 0) - (y - v.cy) * v.s];
function setView(c, v) { c.setTransform(v.s, 0, 0, -v.s, W / 2 + (v.ox || 0) - v.cx * v.s, H / 2 + (v.oy || 0) + v.cy * v.s); }

// 温度（℃）→ 色。水の中で運転しているあいだは青く、空だきになると 赤 → 橙 → 白
const HEAT = [[250, [70, 30, 30]], [600, [150, 30, 18]], [900, [235, 70, 22]], [1200, [255, 130, 30]], [1800, [255, 200, 90]], [2800, [255, 246, 225]]];
export function heatColor(T) {
  if (T <= HEAT[0][0]) return HEAT[0][1];
  for (let i = 0; i < HEAT.length - 1; i++) if (T <= HEAT[i + 1][0]) { const k = (T - HEAT[i][0]) / (HEAT[i + 1][0] - HEAT[i][0]); return HEAT[i][1].map((v, j) => lerp(v, HEAT[i + 1][1][j], k)); }
  return HEAT[HEAT.length - 1][1];
}
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(4)})`;
const LINE = [120, 170, 215], STEEL = [150, 190, 228], DIMLINE = [70, 105, 140];

function poly(c, pts, close = false) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (close) c.closePath(); }
function rpvPath(c, r = G.rpvR, grow = 0) {
  const y0 = G.rpvY0 - grow, y1 = G.rpvY1 + grow, h = G.head, R = r + grow;
  c.beginPath(); c.moveTo(-R, y0 + h); c.lineTo(-R, y1 - h); c.bezierCurveTo(-R, y1 + h * 0.33, R, y1 + h * 0.33, R, y1 - h);
  c.lineTo(R, y0 + h); c.bezierCurveTo(R, y0 - h * 0.33, -R, y0 - h * 0.33, -R, y0 + h); c.closePath();
}
function flaskPath(c, grow = 0) {
  const n = 5.7 + grow, w = 10.6 + grow, top = 17.2 + grow, bot = -11 - grow;
  c.beginPath(); c.moveTo(-n, top); c.quadraticCurveTo(0, top + 4.2, n, top); c.lineTo(n, 6.2); c.bezierCurveTo(n, 2.2, w, 3.4, w, -1.2); c.lineTo(w, -7.2);
  c.quadraticCurveTo(w, bot, w - 4, bot); c.lineTo(-w + 4, bot); c.quadraticCurveTo(-w, bot, -w, -7.2); c.lineTo(-w, -1.2); c.bezierCurveTo(-w, 3.4, -n, 2.2, -n, 6.2); c.closePath();
}

// ------------------------------------------------------------ 炉心（拡大率に応じて、集合体 → 燃料棒 → ペレット と細かく描く）
function drawCore(b, g, st) {
  const v = st.view, s = v.s, px = 1 / s;
  const x0 = v.cx - (W / 2 + (v.ox || 0)) / s, x1 = v.cx + (W / 2 - (v.ox || 0)) / s;      // 画面に入っている範囲
  const yv0 = v.cy - (H / 2 - (v.oy || 0)) / s, yv1 = v.cy + (H / 2 + (v.oy || 0)) / s;
  const y0 = G.coreY0, y1 = G.coreY1;
  const slump = st.melt || 0;                                   // 溶け落ち
  const top = lerp(y1, y0 + 0.5, smoothstep(0, 0.95, slump));   // 残っている燃料の上端
  const wl = st.water;
  const power = st.power, T = st.fuelT;
  // 水に沈んでいる部分は青く（運転中の光）、出ている部分は温度の色
  const blue = [30 + 60 * power, 120 + 70 * power, 255], hot = heatColor(T);
  const on = 1 - smoothstep(Math.log(650), Math.log(2300), Math.log(s));          // 引いていくと、炉が運転中の青い光を帯びる
  const emisBlue = (0.16 + 0.62 * power) * on, emisHot = sat((T - 350) / 700);
  const rodLod = smoothstep(90, 190, s), pelLod = smoothstep(1100, 2500, s);
  const hero = st.hero || 0;                                    // ペレット 1 個だけを見せる（まわりを消す）
  const others = 1 - hero;

  for (let k = -G.nA; k <= G.nA; k++) {
    const ax = k * G.pitchA;
    if (ax + G.pitchA < x0 || ax - G.pitchA > x1) continue;
    // 端の集合体ほど早く崩れる・不ぞろいにする
    const jitter = 0.5 + 0.5 * Math.sin(k * 12.9898 + 4.1);
    const prof = 0.62 + 0.38 * Math.cos((k / (G.nA + 1)) * 1.45);              // 中心ほど出力が高い
    const aTop = lerp(top, Math.max(y0 + 0.35, top - 0.9 * jitter), sat(slump * 1.6));
    if (rodLod < 0.999) {
      // 遠くから: 集合体 1 体 = 1 本の帯
      const a = (1 - rodLod) * others, w = G.pitchA * 0.74;
      const ySplit = clamp(wl, y0, aTop);
      if (ySplit > y0) { g.fillStyle = css(blue, a * emisBlue * prof); g.fillRect(ax - w / 2, y0, w, ySplit - y0); }
      if (aTop > ySplit) { g.fillStyle = css(hot, a * (0.25 + 0.75 * emisHot)); g.fillRect(ax - w / 2, ySplit, w, aTop - ySplit); }
    }
    if (rodLod > 0.001) {
      // チャンネルボックス（集合体を包む四角い筒）
      if (others > 0.01) { g.strokeStyle = css(DIMLINE, 0.55 * rodLod * others * (1 - pelLod * 0.6)); g.lineWidth = Math.max(1.1 * px, 0.002); g.strokeRect(ax - 0.067, y0 - 0.12, 0.134, y1 - y0 + 0.3); }
      for (let i = -4; i <= 4; i++) {
        const rx = ax + i * G.pitchR, isHero = k === 0 && i === 0;
        if (rx + 0.01 < x0 || rx - 0.01 > x1) continue;
        const a = rodLod * (isHero ? 1 : others);
        if (a < 0.004) continue;
        if (pelLod < 0.999) {
          const al = a * (1 - pelLod), w = G.rodD * 0.86, ySplit = clamp(wl, y0, aTop);
          if (ySplit > y0) { g.fillStyle = css(blue, al * (emisBlue * prof + 0.10 * (1 - on))); g.fillRect(rx - w / 2, y0, w, ySplit - y0); }
          if (aTop > ySplit) { g.fillStyle = css(hot, al * (0.3 + 0.7 * emisHot)); g.fillRect(rx - w / 2, ySplit, w, aTop - ySplit); }
        }
        if (pelLod > 0.001) {
          // 近くから: 被覆管（ジルコニウム合金の細い管）と、その中に積まれたペレット
          const al = a * pelLod, ya = Math.max(yv0 - 0.02, y0), yb = Math.min(yv1 + 0.02, y1);
          if (!isHero || hero < 0.999) {
            const ca = al * (isHero ? 1 - hero : 1);
            b.fillStyle = `rgba(10,16,24,${(0.9 * ca).toFixed(4)})`; b.fillRect(rx - G.rodD / 2, ya, G.rodD, yb - ya);
            g.strokeStyle = css(STEEL, 0.75 * ca); g.lineWidth = 1.6 * px;
            g.beginPath(); g.moveTo(rx - G.rodD / 2, ya); g.lineTo(rx - G.rodD / 2, yb); g.moveTo(rx + G.rodD / 2, ya); g.lineTo(rx + G.rodD / 2, yb); g.stroke();
          }
          const j0 = Math.floor(ya / G.pelH), j1 = Math.ceil(yb / G.pelH);
          const mkGrad = (lit, pa) => { const grd = b.createLinearGradient(rx - G.pelD / 2, 0, rx + G.pelD / 2, 0);
            grd.addColorStop(0, `rgba(${16 * lit | 0},${17 * lit | 0},${21 * lit | 0},${pa.toFixed(4)})`); grd.addColorStop(0.3, `rgba(${104 * lit | 0},${106 * lit | 0},${114 * lit | 0},${pa.toFixed(4)})`);
            grd.addColorStop(0.56, `rgba(${60 * lit | 0},${62 * lit | 0},${70 * lit | 0},${pa.toFixed(4)})`); grd.addColorStop(1, `rgba(9,10,13,${pa.toFixed(4)})`); return grd; };
          const gOther = mkGrad(0.66, al * (isHero ? 1 - hero : 1)), gHero = isHero ? mkGrad(1, al) : null;
          for (let j = j0; j < j1; j++) {
            const py = j * G.pelH, heroP = isHero && j === 0;
            const pa = al * (heroP ? 1 : isHero ? 1 - hero : 1);
            if (pa < 0.004) continue;
            b.fillStyle = heroP ? gHero : gOther;
            const gap = G.pelH * 0.035, r = G.pelH * 0.07;
            b.beginPath(); b.roundRect(rx - G.pelD / 2, py + gap, G.pelD, G.pelH - 2 * gap, r); b.fill();
            // 縁の光（熱を帯びた焼き物の、鈍い照り）
            g.strokeStyle = heroP ? `rgba(255,190,120,${(0.55 * pa).toFixed(4)})` : `rgba(150,120,100,${(0.22 * pa).toFixed(4)})`; g.lineWidth = (heroP ? 2.2 : 1.2) * px;
            g.beginPath(); g.roundRect(rx - G.pelD / 2, py + gap, G.pelD, G.pelH - 2 * gap, r); g.stroke();
          }
        }
      }
    }
  }
  // 溶けた燃料（炉の底にたまる）
  if (slump > 0.02) {
    const pool = smoothstep(0.05, 1, slump) * (1 - (st.through || 0) * 0.75);
    const yb = G.rpvY0 + 0.25, hgt = 0.4 + 2.3 * pool;
    const col = heatColor(Math.max(T, 2300));
    g.fillStyle = css(col, 0.95);
    g.beginPath(); g.moveTo(-2.55, yb + hgt * 0.75);
    for (let i = 0; i <= 16; i++) { const u = i / 16, x = lerp(-2.55, 2.55, u); g.lineTo(x, yb + hgt * (0.78 + 0.10 * Math.sin(u * 9 + st.t * 1.3) + 0.06 * Math.sin(u * 23 - st.t * 2.1))); }
    g.bezierCurveTo(2.6, yb - 1.0, -2.6, yb - 1.0, -2.55, yb + hgt * 0.75); g.closePath(); g.fill();
    // 上の炉心から垂れ落ちるしずく
    const rng = mulberry32(31);
    for (let i = 0; i < 9; i++) {
      const x = rng.range(-1.8, 1.8), ph = rng(), sp = rng.range(0.5, 0.9);
      const u = fract(st.t * sp * 0.6 + ph), yy = lerp(y0 + 0.4, yb + hgt * 0.7, u * u);
      g.fillStyle = css(col, 0.9 * slump * (1 - u * 0.3)); g.beginPath(); g.ellipse(x, yy, 0.07, 0.16 + 0.2 * u, 0, 0, TAU); g.fill();
    }
  }
}

// ------------------------------------------------------------ 原子炉建屋の中
export function drawReactor(b, g, st) {
  const v = st.view, s = v.s, px = 1 / s;
  setView(b, v); setView(g, v);
  const far = smoothstep(8, 20, s) ;            // 建屋の細部は寄ったときだけ
  const hi = st.hi || {};
  const blast = st.blast || 0;
  const shell = st.shell ?? 1;                  // 格納容器の線の濃さ（ペレットの寄りでは 0）
  const rbA = (st.rb ?? 1) * shell;             // 建屋とプールの濃さ
  const hc = hi.contain || 0;
  if (rbA > 0.003) {
    const shell = rbA;
    const R = G.rb;
    // ---- 建屋（コンクリートの箱。運転床より上は薄い壁）
    b.fillStyle = `rgba(13,19,29,${(0.97 * shell).toFixed(4)})`;
    b.fillRect(R.x0, R.y0, R.x1 - R.x0, R.floor - R.y0);
    if (blast < 0.5) b.fillRect(R.x0, R.floor, R.x1 - R.x0, R.y1 - R.floor);
    g.strokeStyle = css(LINE, (0.75 + 0.25 * hc) * shell); g.lineWidth = (2.2 + 2.5 * hc) * px;
    poly(g, [[R.x0, R.floor], [R.x0, R.y0], [R.x1, R.y0], [R.x1, R.floor]]); g.stroke();
    if (blast < 0.5) { g.lineWidth = (1.5 + 2 * hc) * px; poly(g, [[R.x0, R.floor], [R.x0, R.y1], [R.x1, R.y1], [R.x1, R.floor]]); g.stroke(); }
    else {
      // 爆発のあと: 骨組みだけが残る
      g.strokeStyle = css(DIMLINE, 0.8 * shell); g.lineWidth = 1.3 * px;
      const rng = mulberry32(9);
      for (let x = R.x0; x <= R.x1 + 0.01; x += 5.75) { const hgt = (R.y1 - R.floor) * rng.range(0.25, 0.95); g.beginPath(); g.moveTo(x, R.floor); g.lineTo(x + rng.range(-0.8, 0.8), R.floor + hgt); g.stroke(); }
      g.beginPath(); g.moveTo(R.x0, R.floor + 4.6); g.lineTo(R.x0 + 14, R.floor + 4.2); g.moveTo(R.x1 - 17, R.floor + 7.5); g.lineTo(R.x1, R.floor + 7.9); g.stroke();
    }
    g.strokeStyle = css(DIMLINE, 0.6 * shell); g.lineWidth = 1.2 * px;
    for (const fy of [G.ground, 5, 11]) { g.beginPath(); g.moveTo(R.x0, fy); g.lineTo(-11.2, fy); g.moveTo(11.2, fy); g.lineTo(R.x1, fy); g.stroke(); }
    g.lineWidth = 1.8 * px; g.strokeStyle = css(LINE, 0.7 * shell);
    g.beginPath(); g.moveTo(R.x0, R.floor); g.lineTo(-5.9, R.floor); g.moveTo(5.9, R.floor); g.lineTo(R.x1, R.floor); g.stroke();
    if (blast < 0.5) { g.strokeStyle = css(DIMLINE, 0.5 * shell); g.lineWidth = 1.2 * px; g.beginPath(); g.moveTo(R.x0, 27.2); g.lineTo(R.x1, 27.2); g.stroke(); g.strokeRect(-4, 26.2, 5, 1.6); }   // 天井クレーン

    // ---- 使用済み燃料プール
    const P = G.sfp;
    b.fillStyle = `rgba(10,34,72,${(0.92 * shell).toFixed(4)})`; b.fillRect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0 - 0.7);
    g.strokeStyle = css(LINE, 0.6 * shell); g.lineWidth = 1.5 * px; poly(g, [[P.x0, P.y1], [P.x0, P.y0], [P.x1, P.y0], [P.x1, P.y1]]); g.stroke();
    g.fillStyle = `rgba(70,150,255,${(0.42 * shell).toFixed(4)})`; for (let x = P.x0 + 0.9; x < P.x1 - 0.6; x += 0.62) g.fillRect(x, P.y0 + 0.4, 0.36, 3.4);
    g.strokeStyle = `rgba(90,160,240,${(0.5 * shell).toFixed(4)})`; g.lineWidth = 1.2 * px; g.beginPath(); g.moveTo(P.x0, P.y1 - 0.7); g.lineTo(P.x1, P.y1 - 0.7); g.stroke();

  }
  if (shell > 0.003) {
    // ---- 格納容器（フラスコ形のドライウェルと、ドーナツ形の圧力抑制室）
    for (const sx of [-1, 1]) {
      b.fillStyle = `rgba(5,8,13,${(0.98 * shell).toFixed(4)})`; b.beginPath(); b.arc(sx * 15.6, -9.8, 3.9, 0, TAU); b.fill();
      b.save(); b.beginPath(); b.arc(sx * 15.6, -9.8, 3.9, 0, TAU); b.clip(); b.fillStyle = `rgba(12,44,96,${(0.95 * shell).toFixed(4)})`; b.fillRect(sx * 15.6 - 4, -13.8, 8, 4.1); b.restore();
      g.strokeStyle = css(STEEL, (0.8 + 0.2 * hc) * shell); g.lineWidth = (1.8 + 2.2 * hc) * px; g.beginPath(); g.arc(sx * 15.6, -9.8, 3.9, 0, TAU); g.stroke();
      g.lineWidth = 1.4 * px; g.beginPath(); g.moveTo(sx * 10.4, -5.6); g.lineTo(sx * 13.3, -7.6); g.moveTo(sx * 10.2, -6.7); g.lineTo(sx * 12.6, -8.4); g.stroke();
    }
    b.fillStyle = `rgba(3,5,9,${(0.98 * shell).toFixed(4)})`; flaskPath(b); b.fill();
    g.strokeStyle = css(STEEL, (0.85 + 0.15 * hc) * shell); g.lineWidth = (2.4 + 3 * hc) * px; flaskPath(g); g.stroke();
    // 圧力容器を支える台（ペデスタル）
    g.strokeStyle = css(DIMLINE, 0.8 * shell); g.lineWidth = 2.2 * px;
    g.beginPath(); g.moveTo(-3.3, -11); g.lineTo(-3.3, -6.4); g.moveTo(3.3, -11); g.lineTo(3.3, -6.4); g.stroke();
    // 床に落ちた溶融燃料
    const th = st.through || 0;
    if (th > 0.01) {
      const col = heatColor(2500);
      g.fillStyle = css(col, 0.95); g.beginPath(); g.ellipse(0, -10.72, 3.0 * smoothstep(0.1, 1, th), 0.30 + 0.25 * th, 0, 0, TAU); g.fill();
      for (let i = 0; i < 3; i++) { const u = fract(st.t * 0.9 + i / 3), x = (i - 1) * 0.5; g.fillStyle = css(col, 0.9 * sat(th * 2)); g.beginPath(); g.ellipse(x, lerp(G.rpvY0 - 0.4, -10.5, u * u), 0.09, 0.3, 0, 0, TAU); g.fill(); }
    }
  }
  const vessel = st.vessel ?? shell;
  if (vessel > 0.003) {
    // ---- 原子炉圧力容器
    b.fillStyle = `rgba(6,9,14,${(0.98 * vessel).toFixed(4)})`; rpvPath(b, G.rpvR, 0.28); b.fill();
    // 水（下から水位まで）と蒸気
    b.save(); rpvPath(b); b.clip();
    const wl = st.water;
    const steamA = 0.10 + 0.14 * (st.flow || 0);
    b.fillStyle = `rgba(150,175,205,${(steamA * vessel).toFixed(4)})`; b.fillRect(-3, wl, 6, G.rpvY1 + 3 - wl);
    const wg = b.createLinearGradient(0, G.rpvY0, 0, wl);
    wg.addColorStop(0, `rgba(8,34,84,${(0.96 * vessel).toFixed(4)})`); wg.addColorStop(1, `rgba(16,60,128,${(0.96 * vessel).toFixed(4)})`);
    b.fillStyle = wg; b.fillRect(-3, G.rpvY0 - 1, 6, wl - G.rpvY0 + 1);
    b.restore();
    g.save(); rpvPath(g); g.clip();
    g.strokeStyle = `rgba(120,190,255,${(0.75 * vessel).toFixed(4)})`; g.lineWidth = 1.6 * px; g.beginPath();
    for (let i = 0; i <= 24; i++) { const x = lerp(-3, 3, i / 24), y = wl + 0.05 * Math.sin(i * 1.7 + st.t * 3.1) * (0.4 + (st.flow || 0)); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    // 炉内の構造: 蒸気を水滴から分ける装置（上）と、制御棒の案内管（下）
    if (far > 0.01) {
      g.strokeStyle = css(DIMLINE, 0.5 * far * vessel); g.lineWidth = 1.1 * px;
      for (let x = -2.1; x <= 2.11; x += 0.42) { g.beginPath(); g.moveTo(x, 2.6); g.lineTo(x, 6.8); g.stroke(); }
      g.strokeRect(-2.4, 7.6, 4.8, 2.6);
      for (let x = -2.2; x <= 2.21; x += 0.55) { g.beginPath(); g.moveTo(x, 7.6); g.lineTo(x + 0.25, 10.2); g.stroke(); }
      g.strokeStyle = css(DIMLINE, 0.65 * far * vessel); g.beginPath(); g.moveTo(-2.25, 2.3); g.lineTo(-2.25, -2.4); g.moveTo(2.25, 2.3); g.lineTo(2.25, -2.4); g.stroke();   // シュラウド
    }
    g.restore();
  }
  // ---- 炉心
  drawCore(b, g, st);
  if (vessel > 0.003) {
    // 制御棒（沸騰水型は下から入る）: rods 0 = 引き抜き、1 = 全挿入
    const rodsA = vessel * (1 - (st.melt || 0)) * smoothstep(8, 16, s) * (1 - smoothstep(900, 2000, s));
    if (rodsA > 0.01) {
      const tip = lerp(G.coreY0 - 0.15, G.coreY1 - 0.05, st.rods), hr = hi.rods || 0;
      for (let k = -G.nA + 1; k <= G.nA; k += 2) {
        const x = (k - 0.5) * G.pitchA;
        b.fillStyle = `rgba(22,30,42,${rodsA.toFixed(4)})`; b.fillRect(x - 0.022, G.coreY0 - 3.9, 0.044, tip - (G.coreY0 - 3.9));
        g.fillStyle = `rgba(${150 + 105 * hr | 0},${185 + 60 * hr | 0},235,${((0.42 + 0.58 * hr) * rodsA).toFixed(4)})`; g.fillRect(x - 0.014, G.coreY0 - 3.9, 0.028, tip - (G.coreY0 - 3.9));
      }
      g.fillStyle = css(DIMLINE, 0.6 * rodsA * far); for (let k = -G.nA + 1; k <= G.nA; k += 4) g.fillRect((k - 0.5) * G.pitchA - 0.03, G.rpvY0 - 2.6, 0.06, 2.5);   // 制御棒駆動機構（容器の底を貫く）
    }
    // 容器の輪郭
    const hv = hi.contain || 0;
    g.strokeStyle = css([190, 220, 250], (0.9 + 0.1 * hv) * vessel); g.lineWidth = (3.2 + 2.5 * hv) * px; rpvPath(g, G.rpvR, 0.14); g.stroke();
    if (st.through > 0.02) { b.fillStyle = 'rgba(4,6,10,1)'; b.fillRect(-0.5, G.rpvY0 - 0.5, 1.0, 0.6); g.fillStyle = css(heatColor(2500), 0.95); g.fillRect(-0.36, G.rpvY0 - 0.42, 0.72, 0.5); }
  }
  b.setTransform(1, 0, 0, 1, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
}

// ------------------------------------------------------------ 敷地・タービン建屋・海
export function drawSite(b, g, st) {
  const v = st.view, s = v.s, px = 1 / s;
  const a = st.site ?? 1; if (a < 0.003) return;
  setView(b, v); setView(g, v);
  const flow = st.flow || 0, gen = st.gen || 0, lights = st.lights ?? 1, flood = st.flood || 0;
  // ---- 海と地面（敷地は海面から 10 m の高さ）
  const sg = b.createLinearGradient(0, G.sea, 0, G.sea - 12); sg.addColorStop(0, `rgba(10,44,92,${(0.95 * a).toFixed(4)})`); sg.addColorStop(1, `rgba(3,12,30,${(0.95 * a).toFixed(4)})`);
  b.fillStyle = sg; b.beginPath(); b.moveTo(96, G.sea);
  for (let x = 96; x <= 200; x += 2) b.lineTo(x, G.sea + 0.22 * Math.sin(x * 0.55 + st.t * 1.1) + (st.wave ? st.wave(x) : 0));
  b.lineTo(200, -40); b.lineTo(96, -40); b.closePath(); b.fill();
  g.strokeStyle = `rgba(110,180,255,${(0.6 * a).toFixed(4)})`; g.lineWidth = 1.5 * px; g.beginPath();
  for (let x = 96; x <= 200; x += 2) { const y = G.sea + 0.22 * Math.sin(x * 0.55 + st.t * 1.1) + (st.wave ? st.wave(x) : 0); if (x === 96) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  b.fillStyle = `rgba(9,11,14,${a.toFixed(4)})`; poly(b, [[-200, G.ground], [93, G.ground], [97.5, -9], [100, -40], [-200, -40]], true); b.fill();
  g.strokeStyle = css(DIMLINE, 0.8 * a); g.lineWidth = 1.5 * px; poly(g, [[-200, G.ground], [93, G.ground], [97.5, -9], [99, -16]]); g.stroke();
  g.strokeStyle = css(DIMLINE, 0.28 * a); g.lineWidth = 1 * px; g.beginPath(); for (let x = -120; x < 93; x += 2.2) { g.moveTo(x, G.ground); g.lineTo(x - 1.4, G.ground - 1.4); } g.stroke();   // 地面
  b.fillStyle = `rgba(14,18,24,${a.toFixed(4)})`; b.fillRect(103.5, -17, 2.2, 9.7); g.strokeRect(103.5, -17, 2.2, 9.7);              // 防波堤
  // ---- タービン建屋
  const B = G.tb;
  b.fillStyle = `rgba(13,19,29,${(0.97 * a).toFixed(4)})`; b.fillRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
  g.strokeStyle = css(LINE, 0.7 * a); g.lineWidth = 2 * px; g.strokeRect(B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0);
  g.strokeStyle = css(DIMLINE, 0.6 * a); g.lineWidth = 1.2 * px; g.beginPath(); g.moveTo(B.x0, G.ground); g.lineTo(B.x1, G.ground); g.moveTo(B.x0, 2.2); g.lineTo(37, 2.2); g.moveTo(63, 2.2); g.lineTo(B.x1, 2.2); g.stroke();
  // 地下の浸水（津波）
  if (flood > 0.003) {
    const fy = lerp(B.y0, G.ground + 1.6, flood);
    b.fillStyle = `rgba(14,58,118,${(0.82 * a).toFixed(4)})`; b.fillRect(B.x0 + 0.3, B.y0 + 0.3, B.x1 - B.x0 - 0.6, fy - B.y0);
    g.strokeStyle = `rgba(120,190,255,${(0.7 * a).toFixed(4)})`; g.lineWidth = 1.6 * px; g.beginPath(); g.moveTo(B.x0 + 0.3, fy); g.lineTo(B.x1 - 0.3, fy); g.stroke();
  }
  // ---- 復水器（蒸気を海水で冷やして水に戻す）
  const C = G.cond;
  b.fillStyle = `rgba(5,8,13,${a.toFixed(4)})`; b.fillRect(C.x0, C.y0, C.x1 - C.x0, C.y1 - C.y0);
  b.fillStyle = `rgba(12,44,96,${(0.9 * a).toFixed(4)})`; b.fillRect(C.x0 + 0.2, C.y0 + 0.2, C.x1 - C.x0 - 0.4, 1.9);
  g.strokeStyle = css(STEEL, 0.75 * a); g.lineWidth = 1.8 * px; g.strokeRect(C.x0, C.y0, C.x1 - C.x0, C.y1 - C.y0);
  g.strokeStyle = `rgba(80,170,255,${((0.25 + 0.4 * flow) * a).toFixed(4)})`; g.lineWidth = 1.3 * px;
  for (let y = C.y0 + 3; y < C.y1 - 1.2; y += 0.95) { g.beginPath(); g.moveTo(C.x0 + 2, y); g.lineTo(C.x1 - 2, y); g.stroke(); }
  // ---- タービンと発電機
  const y = G.shaftY, spin = st.spin || 0;
  g.strokeStyle = css(DIMLINE, 0.8 * a); g.lineWidth = 2.5 * px; g.beginPath(); g.moveTo(37, y); g.lineTo(81, y); g.stroke();
  const casing = (xa, xb, ha, hb) => {
    b.fillStyle = `rgba(6,9,14,${a.toFixed(4)})`; poly(b, [[xa, y - ha], [xb, y - hb], [xb, y + hb], [xa, y + ha]], true); b.fill();
    g.strokeStyle = css(STEEL, 0.8 * a); g.lineWidth = 1.8 * px; poly(g, [[xa, y - ha], [xb, y - hb], [xb, y + hb], [xa, y + ha]], true); g.stroke();
    const n = Math.round((xb - xa) / 0.9);
    for (let i = 1; i < n; i++) {
      const u = i / n, x = lerp(xa, xb, u), hh = lerp(ha, hb, u) * 0.86;
      const tw = 0.5 + 0.5 * Math.sin(spin * 1.0 + i * 1.9);                      // 回る羽根のきらめき
      g.strokeStyle = `rgba(${150 + 90 * tw * flow | 0},${195 + 50 * tw * flow | 0},255,${((0.28 + 0.6 * tw * flow) * a).toFixed(4)})`; g.lineWidth = 1.5 * px;
      g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x, y + hh); g.stroke();
    }
  };
  casing(38.2, 44.5, 1.3, 2.4); casing(46.5, 53.5, 1.9, 4.0); casing(55, 62, 4.0, 1.9);
  b.fillStyle = `rgba(6,9,14,${a.toFixed(4)})`; b.beginPath(); b.roundRect(66, y - 2.7, 14, 5.4, 2.4); b.fill();
  g.strokeStyle = css(STEEL, 0.8 * a); g.lineWidth = 1.8 * px; g.beginPath(); g.roundRect(66, y - 2.7, 14, 5.4, 2.4); g.stroke();
  for (let i = 0; i < 9; i++) { const x = 67.6 + i * 1.35, tw = 0.5 + 0.5 * Math.sin(spin * 1.3 - i * 0.9); g.strokeStyle = `rgba(255,${200 + 30 * tw | 0},${120 + 60 * tw | 0},${((0.15 + 0.75 * gen * tw) * a).toFixed(4)})`; g.lineWidth = 1.6 * px; g.beginPath(); g.moveTo(x, y - 2.0); g.lineTo(x, y + 2.0); g.stroke(); }
  // 非常用の発電機と電源盤（地下にある）
  for (const x of [70.5, 77.5]) { b.fillStyle = `rgba(6,9,14,${a.toFixed(4)})`; b.fillRect(x, -10.2, 5, 2.6); g.strokeStyle = css(DIMLINE, 0.9 * a); g.lineWidth = 1.3 * px; g.strokeRect(x, -10.2, 5, 2.6); g.fillStyle = `rgba(${st.edg ? 120 : 60},${st.edg ? 230 : 80},${st.edg ? 160 : 90},${((st.edg ? 0.9 : 0.3) * a).toFixed(4)})`; g.fillRect(x + 0.5, -8.4, 0.7, 0.4); }
  // ---- 配管: 主蒸気、給水、海水
  const pipe = (pts, col, wpx, al) => { g.strokeStyle = css(col, al * a); g.lineWidth = wpx * px; g.lineJoin = 'round'; poly(g, pts); g.stroke(); };
  const hc = (st.hi && st.hi.cool) || 0;
  pipe(G.steam, [200, 215, 235], 2.6 + 2 * hc, 0.55 + 0.3 * flow + 0.2 * hc);
  pipe(G.feed, [70, 150, 255], 2.6 + 2 * hc, 0.55 + 0.3 * flow + 0.3 * hc);
  pipe(G.seaIn, [50, 140, 200], 2.2 + 2 * hc, 0.4 + 0.3 * flow + 0.3 * hc); pipe(G.seaOut, [50, 140, 200], 2.2 + 2 * hc, 0.4 + 0.3 * flow + 0.3 * hc);
  b.fillStyle = `rgba(6,9,14,${a.toFixed(4)})`; b.beginPath(); b.arc(33.5, -8.0, 1.25, 0, TAU); b.fill(); g.strokeStyle = css(STEEL, 0.85 * a); g.lineWidth = 1.8 * px; g.beginPath(); g.arc(33.5, -8.0, 1.25, 0, TAU); g.stroke();   // 給水ポンプ
  g.beginPath(); for (let i = 0; i < 3; i++) { const an = spin * 0.8 * (flow > 0.02 ? 1 : 0) + i * TAU / 3; g.moveTo(33.5, -8.0); g.lineTo(33.5 + Math.cos(an) * 1.0, -8.0 + Math.sin(an) * 1.0); } g.stroke();
  // ---- 送電線（発電した電気を外へ。外から電気を受けるのも、この線）
  const down = st.linesDown || 0, lit = gen * (1 - down);
  g.strokeStyle = `rgba(255,${205 + 30 * lit | 0},${130 + 80 * lit | 0},${((0.22 + 0.72 * lit) * a * (1 - 0.75 * down)).toFixed(4)})`; g.lineWidth = (1.4 + 1.3 * lit) * px;
  for (const dx of [-0.6, 0.6]) { poly(g, G.line.map((q) => [q[0] + dx, q[1]])); g.stroke(); }
  g.strokeStyle = css(DIMLINE, 0.9 * a); g.lineWidth = 1.4 * px; g.beginPath(); for (const yy of [15, 22, 29, 36]) { g.moveTo(74.2, yy); g.lineTo(77.8, yy); } g.stroke();
  b.setTransform(1, 0, 0, 1, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
}

export { CORE_HALF, setView, css, poly };
