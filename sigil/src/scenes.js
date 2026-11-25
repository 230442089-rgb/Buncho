// scenes.js — 場面の割り振り。ひとり 8 秒:「原理の動き（0〜）→ 記号が組み上がる（〜4 秒）→ 名前 → 次へ」。
import { W, H, T, SLOT, ORDER, DURATION, sat, lerp, ease, TAU, pulse, smoothstep as sm } from './core.js';
import { MARKS, BY, palette } from './marks.js';
import { initFx, inkLayer, toMark, bloom, space, grain, lockup, shock, dot, ring, seg, label, reveal, rule, rgba, mixc, K, CX, CY, R } from './fx.js';
import { drawMark, drawPart, placeMark } from './draw.js';
import { ACTS } from './acts.js';

export const HIT = 4.0;
const KIDCOLS = ORDER.map((id) => BY[id].col.main);            // 記号が組み上がる瞬間（3 小節目の頭）
export async function init() { initFx(); }

// 画面の下に並ぶ十二の点（いま誰の番か）
function index(c, cur, a) {
  const all = [...ORDER, 'fururu']; c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  all.forEach((id, i) => { const on = i === cur, x = W / 2 + (i - 5.5) * 30; c.globalAlpha = a * (on ? 1 : i < cur ? 0.5 : 0.22); c.beginPath(); c.arc(x, 1030, on ? 6 : 3.5, 0, TAU); c.fillStyle = on || i < cur ? BY[id].col.main : '#ffffff'; c.fill(); });
  c.restore();
}

const acts = {
  id: 'acts', t0: T.first, t1: T.gather,
  draw(c, t, tl, env) {
    const i = Math.min(ORDER.length - 1, Math.floor(tl / SLOT)), id = ORDER[i], m = BY[id], lt = tl - i * SLOT;
    const enter = ease.outCubic(K(lt, 0, 0.5)), exit = ease.inCubic(K(lt, 7.45, 8.0)), alpha = sat(enter * 1.4) * (1 - exit);
    const zoom = (0.88 + 0.12 * enter) * (1 + 0.04 * pulse(lt, HIT, 0.16)) * (1 + 0.03 * K(lt, HIT, 8)) * (1 + 0.55 * exit);       // 入り・組み上がりの一押し・ゆっくり寄る・抜ける
    space(c, t, m.col.main, { k: (0.5 + 0.5 * sm(0.5, HIT, lt) + 0.6 * pulse(lt, HIT, 0.6)) * alpha, stars: alpha, seed: i * 1.37 });
    const L = inkLayer(); toMark(L, R, CX, CY, zoom);
    ACTS[id](L, lt, m, { pal: palette(m, 'dark'), t, i, c, zoom, kidCols: KIDCOLS });
    toMark(L, R, CX, CY, zoom); shock(L, K(lt, HIT, HIT + 0.75), m.col.main);
    bloom(c, { alpha });
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1 - ease.inCubic(K(lt, 7.25, 7.75)); lockup(c, m, lt - HIT);
    c.globalAlpha = 1; index(c, i, 0.9);
    grain(c, Math.round(t * 30));
  },
};


const ALL = [...ORDER, 'fururu'], INK = '#2c2733', PAPER = '#fbf7f1';
const heart = (c, x, y, r, col) => { c.save(); c.translate(x, y); c.scale(r, r); c.beginPath(); c.moveTo(0, 0.9); c.bezierCurveTo(-1.5, -0.2, -0.7, -1.2, 0, -0.45); c.bezierCurveTo(0.7, -1.2, 1.5, -0.2, 0, 0.9); c.closePath(); c.fillStyle = col; c.fill(); c.restore(); };

// ============================================================ 題（0:00 → 0:08）: 宇宙の外から、十二の光が来る
const title = {
  id: 'title', t0: T.title, t1: T.first,
  draw(c, t) {
    const exit = ease.inCubic(K(t, 7.4, 8.0)), alpha = 1 - exit, zoom = 1 + 0.6 * exit, CYT = 520, RR = 400;
    space(c, t, '#9aa4ff', { k: 0.7 * sm(0, 1.6, t) * alpha, stars: sm(0, 1.2, t) * alpha, seed: 9.3, cy: CYT });
    const L = inkLayer(); toMark(L, 1, W / 2, CYT, zoom);
    const pull = ease.inCubic(K(t, 6.7, 7.9)), turn = 0.05 * t + 1.6 * pull;
    ALL.forEach((id, i) => {
      const col = BY[id].col.main, ta = 0.2 + 0.13 * i, k = ease.outCubic(K(t, ta, ta + 1.0)); if (k <= 0) return;
      const a = -Math.PI / 2 + i * TAU / 12 + turn, r = lerp(1500, RR, k) * (1 - 0.86 * pull), x = Math.cos(a) * r, y = Math.sin(a) * r, beat = pulse((t + 0.02) % 2, i % 4 * 0.5, 0.14);
      if (k < 1) seg(L, x + Math.cos(a) * (1 - k) * 520, y + Math.sin(a) * (1 - k) * 520, x, y, 5, col, 0.9);
      dot(L, x, y, 9 + 5 * beat + 14 * pulse(t, ta + 1.0, 0.2), col); ring(L, x, y, 18 + 40 * K(t, ta + 0.95, ta + 1.6), 2.5, col, 1 - K(t, ta + 0.95, ta + 1.6));
    });
    ring(L, 0, 0, RR * (1 - 0.86 * pull), 1.5, '#ffffff', 0.16 * sm(1.6, 2.4, t));
    bloom(c, { alpha });
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1 - ease.inCubic(K(t, 6.6, 7.2));
    reveal(c, '外神竜一族', W / 2, CYT - 26, 124, K(t, 2.0, 3.0), { ls: 26 });
    rule(c, W / 2, CYT + 62, 250, K(t, 3.4, 4.2), 'rgba(255,255,255,.4)');
    c.save(); c.globalAlpha *= ease.outCubic(K(t, 4.0, 4.7)); label(c, '十二の紋章', W / 2, CYT + 112, 40, { ls: 24, col: 'rgba(255,255,255,.86)', fam: 'Shippori Mincho', weight: 700 }); c.restore();
    c.save(); c.globalAlpha *= ease.outCubic(K(t, 4.6, 5.4)); label(c, '宇宙の外から来た、竜の家族。', W / 2, 1002, 26, { ls: 8, col: 'rgba(255,255,255,.6)' }); c.restore();
    c.globalAlpha = 1; grain(c, Math.round(t * 30));
  },
};

// ============================================================ 十一の原理が並ぶ（1:36 → 1:52）
const gather = {
  id: 'gather', t0: T.gather, t1: T.sea,
  draw(c, t, tl) {
    const enter = ease.outCubic(K(tl, 0, 0.5)), fall = ease.inCubic(K(tl, 14.0, 15.9)), GX = W / 2, GY = 470;
    space(c, t, '#b0a4ff', { k: 0.75 * enter * (1 - 0.7 * fall), stars: enter, seed: 4.1, cy: GY });
    const L = inkLayer(), rot = 0.045 * tl + 2.2 * fall, RR = lerp(lerp(470, 345, enter), 0, fall), ms = lerp(66, 16, fall);
    ORDER.forEach((id, i) => {
      const m = BY[id], t0 = 0.25 + 0.5 * i, k = K(tl, t0, t0 + 1.1); if (k <= 0) return;
      const a = -Math.PI / 2 + i * TAU / 11 + rot, x = GX + Math.cos(a) * RR, y = GY + Math.sin(a) * RR, bump = 1 + 0.16 * pulse(tl, t0 + 1.1, 0.18) + 0.1 * pulse((tl - 8) % 5.5, i * 0.5, 0.15) * (tl > 8 && tl < 13.5 ? 1 : 0);
      toMark(L, ms * bump, x, y); L.globalAlpha = 1; drawMark(L, m, { k, pal: fall > 0.5 ? () => mixc(m.col.main, '#ffffff', (fall - 0.5) * 2) : palette(m, 'dark') });
      shock(L, K(tl, t0 + 1.1, t0 + 1.6), m.col.main, { r0: 1.2, r1: 2.2, n: 8 });
    });
    toMark(L, 1, GX, GY); const core = sm(9, 14, tl); dot(L, 0, 0, 6 + 16 * core + 60 * fall, '#f6f1ea', 0.9 * core); ring(L, 0, 0, 40 + 30 * Math.sin(tl * 1.5), 1.5, '#f6f1ea', 0.25 * core * (1 - fall));
    bloom(c, { alpha: enter });
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = Math.min(ease.outCubic(K(tl, 0.8, 1.6)), 1 - K(tl, 7.3, 7.9)); label(c, '一人ひとりの奥に、星系や銀河を巻き込む災害が眠っている。', W / 2, 992, 30, { ls: 7, col: 'rgba(255,255,255,.82)', fam: 'Shippori Mincho', weight: 500 });
    c.globalAlpha = Math.min(ease.outCubic(K(tl, 8.2, 9.0)), 1 - K(tl, 14.2, 14.9)); label(c, 'それでいて——家族への愛が、とにかく重い。', W / 2, 992, 30, { ls: 7, col: 'rgba(255,255,255,.82)', fam: 'Shippori Mincho', weight: 500 });
    c.globalAlpha = 1; grain(c, Math.round(t * 30));
  },
};

// ============================================================ フルル: 還る場所（1:52 → 2:08）。静かな海に、十一の光が帰ってくる
const SEA_Y = 410, SEA_R = 235;
const arrive = (i) => 2.0 + (i >> 1) * 2.0 + (i & 1) * 0.55;         // 2 秒ごとの低い音に合わせて、ふたりずつ
const sea = {
  id: 'sea', t0: T.sea, t1: T.home,
  draw(c, t, tl) {
    const m = BY.fururu, white = ease.inCubic(K(tl, 14.4, 16.0)), beat = pulse(tl % 2, 0, 0.5), milk = sm(0, 6, tl);
    space(c, t, '#f6f1ea', { k: (0.45 + 0.55 * milk + 0.25 * beat) * sm(0, 1.5, tl), stars: 0.7 * sm(0, 1, tl), seed: 7.7, cy: SEA_Y + 60, base: '#090811' });
    const L = inkLayer();
    // 水面に見えるもの: 幾重もの光の環（空間の断面）
    toMark(L, 1, W / 2, SEA_Y + 120);
    for (let k = 0; k < 9; k++) { const r = (((k * 0.11 + tl * 0.05) % 1)) * 1500 + 40, a = 0.22 * Math.sin(Math.min(1, r / 1500) * Math.PI) * sm(0.3, 2.5, tl); L.save(); L.scale(1, 0.3); ring(L, 0, 0, r, 2.2, '#f6f1ea', a); L.restore(); }
    for (let p = 0; p < 8; p++) { const u = (tl - p * 2) / 2.6; if (u > 0 && u < 1) { L.save(); L.scale(1, 0.3); ring(L, 0, 0, 120 + 900 * ease.outCubic(u), 5 * (1 - u), '#ffffff', 0.5 * (1 - u)); L.restore(); } }       // 低い音のたびに広がる波紋
    toMark(L, SEA_R, W / 2, SEA_Y);
    drawPart(L, m.part('ring'), ease.inOutSine(K(tl, 1.2, 6.4)), m.col.main, 1 + 0.1 * beat);
    ORDER.forEach((id, i) => {            // 帰ってくる十一人
      const kid = BY[id], ta = arrive(i), part = m.part('kid' + i), q = part.paths[0].p, cx = (q[0][0] + q[Math.floor(q.length / 2)][0]) / 2, cy = (q[0][1] + q[Math.floor(q.length / 2)][1]) / 2;
      const u = K(tl, ta - 1.6, ta), an = Math.atan2(cy, cx) + 0.9 * (1 - u), r = lerp(4.6, Math.hypot(cx, cy), ease.inOutCubic(u));
      if (u > 0 && u < 1) { const x = Math.cos(an) * r, y = Math.sin(an) * r, an2 = Math.atan2(cy, cx) + 0.9 * (1 - u + 0.05), r2 = lerp(4.6, Math.hypot(cx, cy), ease.inOutCubic(Math.max(0, u - 0.05))); seg(L, Math.cos(an2) * r2, Math.sin(an2) * r2, x, y, 0.02, kid.col.main, 0.8); dot(L, x, y, 0.05, kid.col.main); }
      if (tl >= ta) { drawPart(L, part, ease.outBack(K(tl, ta, ta + 0.35), 3), kid.col.main); ring(L, cx, cy, 0.08 + 0.3 * K(tl, ta, ta + 0.6), 0.016, kid.col.main, 1 - K(tl, ta, ta + 0.6)); }
    });
    if (white > 0) { toMark(L, 1, W / 2, SEA_Y); dot(L, 0, 0, 2400 * white, '#ffffff', sat(white * 1.2)); }
    bloom(c, { far: 0.8 + 0.3 * beat });
    c.setTransform(1, 0, 0, 1, 0, 0);
    const swap = K(tl, 11.6, 12.2), out = 1 - K(tl, 14.3, 14.9);
    c.globalAlpha = out; reveal(c, m.name, W / 2, 770, 98, K(tl, 7.9, 8.7), { ls: 16 });
    c.globalAlpha = out * ease.outCubic(K(tl, 8.3, 9.0)) * (1 - swap); label(c, m.epithet, W / 2, 852, 31, { ls: 9, col: 'rgba(255,255,255,.82)' }); label(c, `${m.role}　｜　${m.ability}`, W / 2, 930, 21, { ls: 5, col: 'rgba(255,255,255,.5)', weight: 400 });
    const q = ease.outCubic(K(tl, 12.1, 12.9)); c.globalAlpha = out * q;
    if (q > 0) { const str = '「うん。もう大丈夫。こっちにおいで、帰ろっか', size = 42; c.font = `500 ${size}px "Shippori Mincho"`; c.letterSpacing = '6px'; const w = c.measureText(str).width; c.letterSpacing = '0px';
      label(c, str, W / 2 - 46, 880 + 12 * (1 - q), size, { ls: 6, col: '#ffffff', fam: 'Shippori Mincho', weight: 500 }); heart(c, W / 2 - 46 + w / 2 + 26, 880 + 12 * (1 - q), 15, '#ffb7d3'); label(c, '」', W / 2 - 46 + w / 2 + 66, 880 + 12 * (1 - q), size, { col: '#ffffff', fam: 'Shippori Mincho', weight: 500 }); }
    c.globalAlpha = 1; index(c, 11, 0.9 * (1 - white)); grain(c, Math.round(t * 30));
    if (white > 0) { c.fillStyle = rgba('#fbf7f1', sat(white * 1.15)); c.fillRect(0, 0, W, H); }
  },
};

// ============================================================ 家（2:08 → 2:42）: 明るい地に、家族の紋。十二のロゴの一覧。結び
function paper(c, t, dark = 0) {
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(W / 2, 430, 100, W / 2, 430, 1200); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(244,236,226,.0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  ALL.forEach((id, i) => { const a = i * 0.524 + t * 0.03, x = W / 2 + Math.cos(a) * 760, y = H / 2 + Math.sin(a) * 420, r = 300; const gg = c.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, rgba(BY[id].col.main, 0.11)); gg.addColorStop(1, rgba(BY[id].col.main, 0)); c.fillStyle = gg; c.fillRect(x - r, y - r, r * 2, r * 2); });      // ごく淡い十二の色
  c.restore();
}
const cell = (i) => [160 + 320 * (i % 6), 280 + 450 * Math.floor(i / 6)];
const crestPos = (i, x, y, s) => { const a = -Math.PI / 2 + (i + 0.5) * TAU / 11; return [x + Math.cos(a) * 0.52 * s, y + Math.sin(a) * 0.52 * s]; };
// 家族の紋: フルルのひらいた輪のなかに、十一人の記号。k: 子の記号の出かた（0 = 点、1 = 記号）
function crest(c, x, y, s, t, o = {}) {
  const m = BY.fururu, mode = o.mode || 'light', pal = palette(m, mode);
  c.save(); c.translate(x, y); c.scale(s, s); drawPart(c, m.part('ring'), o.ring ?? 1, pal('main')); c.restore();
  ORDER.forEach((id, i) => {
    const [px, py] = crestPos(i, x, y, s), k = o.kid ? o.kid(i) : 1, kid = BY[id];
    if (k < 1) { c.save(); c.globalAlpha *= 1 - k; c.beginPath(); c.arc(px, py, 0.064 * s * (1 + 1.2 * k), 0, TAU); c.fillStyle = mode === 'light' ? kid.col.deep : kid.col.main; c.fill(); c.restore(); }
    if (k > 0) { c.save(); c.globalAlpha *= sat(k * 1.5); placeMark(c, kid, px, py, 0.118 * s * ease.outBack(sat(k), 2.2), { mode, wk: 1.25 }); c.restore(); }
  });
}
const SHEET = 8, DARK = 16, LAST = 24;       // 家の場面のなかの時刻（秒）: 一覧 / 暗い地 / 結び
const home = {
  id: 'home', t0: T.home, t1: DURATION + 1,
  draw(c, t, tl, env) {
    const toSheet = ease.inOutCubic(K(tl, SHEET - 0.1, SHEET + 0.9)), dark = tl >= DARK && tl < LAST ? 1 : 0, wipe = tl >= DARK ? K(tl, DARK, DARK + 0.45) : 0, wipe2 = K(tl, LAST, LAST + 0.45);
    const last = tl >= LAST, shadow = (on) => { c.shadowColor = on ? 'rgba(60,40,70,.16)' : 'transparent'; c.shadowBlur = on ? 18 : 0; c.shadowOffsetY = on ? 7 : 0; };
    paper(c, t);
    if (!last && tl < DARK + 0.5) {
      // ---- 家族の紋 → 一覧へほどける
      const pop = ease.outBack(K(tl, 0, 0.5), 1.6), CXh = W / 2, CYh = 410, CS = 250;
      c.save(); c.globalAlpha = 1; shadow(true);
      if (toSheet < 1) {
        c.globalAlpha = 1 - sm(0.55, 1, toSheet); const s = CS * (0.9 + 0.1 * pop) * (1 - 0.25 * toSheet);
        c.save(); c.translate(CXh, CYh); c.scale(s, s); drawPart(c, BY.fururu.part('ring'), 1, BY.fururu.col.deep); c.restore();
      }
      c.globalAlpha = 1;
      ALL.forEach((id, i) => {
        const m = BY[id], grow = id === 'fururu' ? 0 : ease.outBack(K(tl, 1.0 + 0.25 * i, 1.5 + 0.25 * i), 2.4), [gx, gy] = cell(i), d = ease.inOutCubic(K(tl, SHEET - 0.1 + 0.035 * i, SHEET + 0.8 + 0.035 * i));
        const from = id === 'fururu' ? [CXh, CYh] : crestPos(i, CXh, CYh, CS), s0 = id === 'fururu' ? CS : 0.118 * CS, x = lerp(from[0], gx, d), y = lerp(from[1], gy, d) - 60 * Math.sin(Math.PI * d), s = lerp(s0, 104, d);
        if (id === 'fururu') { if (d > 0.45) { c.globalAlpha = sm(0.45, 1, d); placeMark(c, m, x, y, s, { mode: 'light' }); c.globalAlpha = 1; } return; }
        if (grow < 1 && d <= 0) { c.beginPath(); c.arc(x, y, 0.064 * CS * (1 + grow), 0, TAU); c.fillStyle = m.col.deep; c.globalAlpha = 1 - grow; c.fill(); c.globalAlpha = 1; }
        if (grow > 0) placeMark(c, m, x, y, s * (d > 0 ? 1 : grow) * (1 + 0.12 * pulse(tl, SHEET + 0.85 + 0.035 * i, 0.15)), { mode: 'light', wk: lerp(1.25, 1, d) });
      });
      shadow(false); c.restore();
      c.globalAlpha = 1 - K(tl, SHEET - 0.5, SHEET - 0.05); reveal(c, '外神竜一族', W / 2, 800, 100, K(tl, 1.6, 2.5), { ls: 22, col: INK }); rule(c, W / 2, 872, 220, K(tl, 2.4, 3.1), 'rgba(44,39,51,.35)');
      c.globalAlpha *= ease.outCubic(K(tl, 2.8, 3.5)); label(c, '十二の紋章', W / 2, 916, 34, { ls: 20, col: 'rgba(44,39,51,.78)', fam: 'Shippori Mincho', weight: 700 }); c.globalAlpha = 1;
      ALL.forEach((id, i) => { const m = BY[id], [gx, gy] = cell(i), k = K(tl, SHEET + 0.9 + 0.06 * i, SHEET + 1.6 + 0.06 * i); c.globalAlpha = 1; reveal(c, m.name, gx, gy + 168, 44, k, { ls: 6, col: INK }); c.globalAlpha = ease.outCubic(sat(k * 1.5 - 0.5)); label(c, m.epithet, gx, gy + 218, 20, { ls: 3, col: 'rgba(44,39,51,.62)' }); });
      c.globalAlpha = 1;
    }
    if (tl >= DARK && tl < LAST + 0.5) {
      // ---- 同じ一覧を、暗い地で（左から右へ切り替わる）
      c.save(); c.beginPath(); c.rect(0, 0, W * ease.inOutCubic(wipe) * (1 - (last ? 1 : 0)) + (last ? 0 : 0), H); if (last) { c.beginPath(); c.rect(W * ease.inOutCubic(wipe2), 0, W, H); } c.clip();
      space(c, t, '#a79cff', { k: 0.6, seed: 2.2, cy: 520 });
      const L = inkLayer();
      ALL.forEach((id, i) => { const m = BY[id], [gx, gy] = cell(i), beat = pulse((tl - DARK) % 6, 0.5 + i * 0.375, 0.2); toMark(L, 104 * (1 + 0.07 * beat), gx, gy); drawMark(L, m, { mode: 'dark' }); shock(L, K((tl - DARK) % 6, 0.5 + i * 0.375, 0.9 + i * 0.375), m.col.main, { r0: 1.15, r1: 1.7, n: 0 }); });
      bloom(c);
      c.setTransform(1, 0, 0, 1, 0, 0); ALL.forEach((id, i) => { const m = BY[id], [gx, gy] = cell(i); c.font = '800 44px "Shippori Mincho"'; c.letterSpacing = '6px'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(m.name, gx + 3, gy + 168); c.letterSpacing = '0px'; label(c, m.epithet, gx, gy + 218, 20, { ls: 3, col: 'rgba(255,255,255,.62)' }); });
      c.restore();
    }
    if (last) {
      // ---- 結び
      const lt = tl - LAST, CS = 228, pop = ease.outBack(K(lt, 0.1, 0.7), 1.5);
      c.save(); shadow(true); crest(c, W / 2, 330, CS * (0.9 + 0.1 * pop), t, { kid: (i) => ease.outCubic(K(lt, 0.15 + 0.04 * i, 0.7 + 0.04 * i)) }); shadow(false); c.restore();
      reveal(c, '外神竜一族', W / 2, 668, 92, K(lt, 0.8, 1.7), { ls: 22, col: INK });
      rule(c, W / 2, 736, 240, K(lt, 1.5, 2.2), 'rgba(44,39,51,.35)');
      c.globalAlpha = ease.outCubic(K(lt, 2.0, 2.9)); label(c, '何もできなかった日でも、いつもの席と「おかえり」はある。', W / 2, 792 + 10 * (1 - ease.outCubic(K(lt, 2.0, 2.9))), 32, { ls: 7, col: 'rgba(44,39,51,.86)', fam: 'Shippori Mincho', weight: 700 });
      const loc = env.stats && env.stats.loc ? env.stats.loc.toLocaleString('en-US') : '—';
      ['外神竜一族 設定資料（2026 年 11 月 10 日版）より　十二人の記号（ロゴ）', '音楽　“Arpent”　Kevin MacLeod（CC0）　／　効果音　SFX Kit by Wyzowl（CC0）', `設定　あなた　／　記号の設計・構成・プログラム（${loc} 行）　Claude`].forEach((r, i) => { c.globalAlpha = ease.outCubic(K(lt, 3.2 + 0.2 * i, 3.9 + 0.2 * i)); label(c, r, W / 2, 906 + i * 44, 21, { ls: 3, col: 'rgba(44,39,51,.56)' }); });
      c.globalAlpha = 1;
    }
    grain(c, Math.round(t * 30), 0.035);
    const fl = tl < 1 ? 1 - K(tl, 0, 0.5) : 0; if (fl > 0) { c.fillStyle = rgba('#fbf7f1', fl); c.fillRect(0, 0, W, H); }
    const end = K(t, DURATION - 1.5, DURATION - 0.3); if (end > 0) { c.fillStyle = rgba('#fbf7f1', end); c.fillRect(0, 0, W, H); }
  },
};

export const SCENES = [title, acts, gather, sea, home];
