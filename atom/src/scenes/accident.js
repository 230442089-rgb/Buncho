// accident.js — 4 章「事故」。福島第一原発 1 号機の経過をもとにした、冷却を失った炉がたどる道すじ。
// 音楽（Hidden Truth）の低い打音 Q[0]〜Q[8] に、一段ずつ当てている:
//   Q0 地震・自動停止 → Q1 崩壊熱 → Q2 津波・全電源喪失 → Q3 水位低下 → Q4 水素発生 → Q5 炉心溶融 → Q6 底が抜ける → Q7 水素がたまる → Q8 爆発
import { T, Q, W, H, COL, sat, smoothstep, ease, lerp, clamp, mulberry32, TAU, fract } from '../core.js';
import { Layer2D, Dots, chap, narr, sub, label, fadeEl, inout } from '../kit.js';
import { G, drawReactor, drawSite, toScreen, heatColor } from '../plantdraw.js';
import { PLANT_VIEW, viewFrom, flowDots } from './plant.js';
import { Lines } from '../../../film/src/lines.js';
import { shared } from '../../../film/src/scenes/shared.js';
import { equation } from '../../../film/src/overlay.js';

const V_RPV = { cx: 0, cy: 2.8, s: 33.5, ox: -400, oy: -18 };
const V_CORE = { cx: 0, cy: 1.2, s: 42, ox: -400, oy: -60 };
const V_SEA = { cx: 66, cy: 0.5, s: 12.2, ox: 0, oy: -20 };
const V_BOTTOM = { cx: 0, cy: -4.6, s: 47, ox: -400, oy: 0 };
const V_RB = { cx: 0, cy: 6.5, s: 16.5, ox: -400, oy: 0 };
const V_WIDE = { cx: 6, cy: 15, s: 10.5, ox: -240, oy: 0 };
const KEYS = [
  [Q[0], PLANT_VIEW], [Q[0] + 0.5, PLANT_VIEW], [Q[0] + 2.6, V_RPV],
  [Q[2] - 0.75, V_RPV], [Q[2] + 0.95, V_SEA], [Q[2] + 6.0, V_SEA], [Q[2] + 8.0, V_RPV],
  [Q[4] - 0.6, V_RPV], [Q[4] + 1.6, V_CORE],
  [Q[6] - 0.9, V_CORE], [Q[6] + 1.2, V_BOTTOM],
  [Q[7] - 1.3, V_BOTTOM], [Q[7] + 0.9, V_RB],
  [Q[8] + 1.2, V_RB], [Q[8] + 6.5, V_WIDE],
];
const T_BLACK = Q[2] + 3.6;                    // すべての電源が落ちる
const T_UNCOVER = Q[3] + 5.6;                  // 燃料の頭が水から出る
// 燃料の温度（℃）
const tempAt = (t) => (t < T_UNCOVER ? 290 : t < Q[4] + 4.2 ? lerp(290, 1200, ease.inOutSine(sat((t - T_UNCOVER) / (Q[4] + 4.2 - T_UNCOVER)))) : lerp(1200, 2800, ease.inOutSine(sat((t - Q[4] - 4.2) / (Q[5] - Q[4] - 3.4)))));
const waterAt = (t) => (t < T_BLACK + 1 ? G.water0 : t < T_UNCOVER ? lerp(G.water0, G.coreY1, ease.inOutSine(sat((t - T_BLACK - 1) / (T_UNCOVER - T_BLACK - 1)))) : lerp(G.coreY1, -5.6, sat((t - T_UNCOVER) / (Q[6] - T_UNCOVER))));
// 津波の前線（世界の x 座標。右 = 海）
const frontAt = (t) => (t < Q[2] + 2.3 ? lerp(230, 99, sat((t - Q[2] - 0.2) / 2.1)) : lerp(99, 22, ease.outCubic(sat((t - Q[2] - 2.3) / 2.0))));
const surgeAt = (t) => smoothstep(Q[2] + 0.2, Q[2] + 1.0, t) * (1 - smoothstep(Q[2] + 5.2, Q[2] + 8.5, t));

export function accState(t) {
  const view = viewFrom(KEYS, t), s = view.s;
  const scram = ease.inOutCubic(sat((t - Q[0] - 0.7) / 1.5));
  const T_ = tempAt(t), melt = smoothstep(Q[5] - 0.2, Q[5] + 7.6, t), through = smoothstep(Q[6] + 0.3, Q[6] + 5.5, t);
  const black = t >= T_BLACK;
  const st = {
    t, view, hero: 0, vessel: 1, shell: 1, site: 1 - smoothstep(Math.log(20), Math.log(34), Math.log(s)),
    rb: lerp(0.16, 1, 1 - smoothstep(Math.log(18), Math.log(30), Math.log(s))),
    power: lerp(1, 0.07, scram) * (1 - 0.6 * smoothstep(Q[1], Q[3], t)), fuelT: T_, water: waterAt(t),
    rods: lerp(0.3, 1, scram), melt, through,
    flow: (1 - smoothstep(Q[0] + 0.4, Q[0] + 2.6, t)), gen: 1 - smoothstep(Q[0] + 0.3, Q[0] + 1.2, t), spin: 6.0 * (t < Q[0] ? t : Q[0] + (1 - Math.exp(-(t - Q[0]) / 2.5)) * 2.5),
    linesDown: smoothstep(Q[0] + 0.2, Q[0] + 0.5, t), edg: t > Q[0] + 1.4 && !black ? 1 : 0, lights: black ? 0 : 1,
    flood: smoothstep(Q[2] + 2.6, Q[2] + 6.4, t),
    blast: t >= Q[8] ? 1 : 0,
    hi: {},
  };
  // 停止後の冷却（電源があるあいだは水が回っている）と、沸騰
  st.cool = (1 - smoothstep(T_BLACK - 0.2, T_BLACK + 0.6, t)) * smoothstep(Q[0] + 2.0, Q[0] + 3.5, t);
  st.boil = t < Q[0] ? 1 : lerp(0.25, 0.9, smoothstep(T_BLACK, T_BLACK + 3, t)) * (1 - smoothstep(Q[4], Q[5], t));
  const sg = surgeAt(t), xf = frontAt(t);
  st.wave = (x) => sg * (14.5 * smoothstep(xf - 4, xf + 9, x) + 2.6 * Math.exp(-Math.pow((x - xf - 5) / 5, 2)));
  st.surge = sg; st.front = xf;
  return st;
}

export const id = 'accident';
export async function create(env) {
  const { g, ov } = env;
  const base = new Layer2D(env), glow = new Layer2D(env), dots = new Dots(env, 6144), smoke = new Dots(env, 4096), lines = new Lines(g, 2048);
  const bg = shared(env);
  const rng0 = mulberry32(1536);
  const H2 = Array.from({ length: 260 }, () => [rng0(), rng0(), rng0(), rng0()]);
  const DEB = Array.from({ length: 70 }, () => ({ x: rng0.range(-22, 22), y: rng0.range(18, 31), a: rng0.range(0.15, Math.PI - 0.15), v: rng0.range(14, 46), len: rng0.range(1.2, 4.2), rot: rng0.range(-5, 5), ph: rng0() * TAU }));
  const SMK = Array.from({ length: 900 }, () => ({ a: rng0.range(0.05, Math.PI - 0.05), v: Math.pow(rng0(), 0.6), sz: rng0.range(0.5, 1.5), x: rng0.range(-20, 20), y: rng0.range(18, 29), d: rng0(), w: rng0.range(-1, 1), hot: rng0() }));

  // ---- 文字
  chap(ov, { n: 4, kanji: '事故', en: 'LOSS OF COOLING', t0: Q[0] + 0.25, t1: T.resume - 0.3, warn: true });
  // 時計
  ov.add({
    t0: Q[0] + 0.2, t1: T.resume - 0.4, className: 'clock', html: '<div class="date"></div><div class="time"></div><div class="elapsed"></div>',
    update(el, tl, t) {
      const [d, tm, e] = el.children; let date, time, note;
      if (t < Q[3] - 0.3) {
        date = '2011年 3月11日';
        const min = t < Q[1] + 1 ? 0 : Math.min(50, 50 * ease.inOutSine(sat((t - Q[1] - 1) / (Q[2] - Q[1] - 1.6))));
        const m = 14 * 60 + 46 + Math.round(min); time = `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
        note = t < Q[1] ? '地震発生 — マグニチュード 9.0' : t < Q[2] - 0.5 ? '原子炉は自動停止' : '地震から約 50 分 — 津波';
      } else if (t < Q[7] + 3.8) { date = '3月11日 夜 — 12日'; time = '<span style="font-family:var(--mincho);font-weight:500;font-size:60px;letter-spacing:.12em">数時間後</span>'; note = '1 号機'; }
      else { date = '2011年 3月12日'; time = '15:36'; note = '津波から約 24 時間'; }
      if (el._d !== date) { d.textContent = date; el._d = date; } if (el._t !== time) { tm.innerHTML = time; el._t = time; } if (el._e !== note) { e.textContent = note; el._e = note; }
      const sw = Math.min(smoothstep(0, 0.5, tl), 1 - smoothstep(Q[3] - 0.9, Q[3] - 0.4, t) + smoothstep(Q[3] - 0.3, Q[3] + 0.3, t)) * (1 - smoothstep(Q[7] + 3.2, Q[7] + 3.7, t) + smoothstep(Q[7] + 3.8, Q[7] + 4.3, t));
      el.style.opacity = (sw * (1 - smoothstep(T.resume - 1.4, T.resume - 0.6, t))).toFixed(4);
    },
  });
  // 3 つの原則の札（発電の章の終わりから出て、ここで 1 つずつ結果が出る）
  ov.add({
    t0: T.principle + 0.6, t1: T.resume - 0.4, className: 'status', style: { left: '1548px', top: '252px' },
    html: ['止める', '冷やす', '閉じ込める'].map((w) => `<div class="row"><span class="mk"></span>${w}<span class="st"></span></div>`).join(''),
    update(el, tl, t) {
      const rows = [...el.children];
      const appear = [104.6, 106.3, 108.1], res = [[Q[0] + 2.6, 'ok', '成功'], [T_BLACK + 0.4, 'ng', '失敗 — 電源喪失'], [Q[8] + 0.25, 'ng', '失敗']];
      rows.forEach((r, i) => {
        const a = ease.outCubic(sat((t - appear[i]) / 0.6));
        r.style.opacity = a.toFixed(4); r.style.transform = `translateX(${((1 - a) * 14).toFixed(2)}px)`;
        const cls = 'row' + (t >= res[i][0] ? ' ' + res[i][1] : ''), txt = t >= res[i][0] ? res[i][2] : '';
        if (r.className !== cls) r.className = cls;
        if (r.lastChild.textContent !== txt) r.lastChild.textContent = txt;
      });
      // 発電所の全景では右上、炉に寄ったら時計の下
      const k = smoothstep(Q[0] + 0.5, Q[0] + 2.4, t);
      el.style.top = '252px'; el.style.left = lerp(1548, 1500, k).toFixed(1) + 'px';
      el.style.opacity = (1 - smoothstep(T.resume - 1.4, T.resume - 0.6, t)).toFixed(4);
    },
  });
  narr(ov, { text: '2011年3月11日 14時46分。<em>地震</em>。', t0: Q[0] + 0.4, t1: Q[0] + 3.8 });
  narr(ov, { text: '制御棒がいっせいに入り、連鎖反応は止まった。', t0: Q[0] + 4.0, t1: Q[1] - 0.15 });
  sub(ov, { text: '外からの送電は途絶えたが、非常用の発電機が動き出した', t0: Q[0] + 4.7, t1: Q[1] - 0.2, y: 962 });
  narr(ov, { text: 'だが、熱は止まらない。', t0: Q[1] + 0.2, t1: Q[1] + 3.5 });
  narr(ov, { text: '割れた破片が出しつづける<em>崩壊熱</em>。\n止めたあとも、冷やしつづけなければならない。', t0: Q[1] + 3.8, t1: Q[2] - 0.2 });
  narr(ov, { text: '約 50 分後、<em>津波</em>が敷地をのみこむ。', t0: Q[2] + 0.3, t1: Q[2] + 4.0 });
  narr(ov, { text: '地下の非常用発電機も、電源盤も、バッテリーも水没。\n<i>すべての電源</i>が失われた。', t0: Q[2] + 4.3, t1: Q[3] - 0.15 });
  narr(ov, { text: 'ポンプは動かない。計器も、照明も消えた。', t0: Q[3] + 0.25, t1: Q[3] + 3.9 });
  narr(ov, { text: '崩壊熱で水は沸きつづけ、水位が下がっていく。', t0: Q[3] + 4.2, t1: Q[4] - 0.15 });
  narr(ov, { text: '水から顔を出した燃料は、たちまち熱くなる。', t0: Q[4] + 0.2, t1: Q[4] + 3.9 });
  narr(ov, { text: '約 1,200℃。被覆管が水蒸気と反応し、<em>水素</em>を生む。', t0: Q[4] + 4.2, t1: Q[5] - 0.15 });
  narr(ov, { text: '約 2,800℃。燃料そのものが溶け落ちる。', t0: Q[5] + 0.2, t1: Q[5] + 3.9 });
  narr(ov, { text: '溶けた燃料は、炉の底にたまっていく。', t0: Q[5] + 4.2, t1: Q[6] - 0.15 });
  narr(ov, { text: 'やがて鋼鉄の底を溶かし、格納容器の床へ。', t0: Q[6] + 0.25, t1: Q[6] + 4.2 });
  narr(ov, { text: '水素と放射性物質が、建屋の中へ漏れ出す。', t0: Q[6] + 4.5, t1: Q[7] - 0.15 });
  narr(ov, { text: '水素は軽い。建屋のいちばん上にたまっていく。', t0: Q[7] + 0.25, t1: Q[7] + 4.3 });
  narr(ov, { text: '3月12日 15時36分——', t0: Q[7] + 4.9, t1: Q[8] - 0.1 });
  narr(ov, { text: '1 号機、<i>水素爆発</i>。', t0: Q[8] + 1.7, t1: Q[8] + 4.7 });
  narr(ov, { text: '<i>閉じ込める</i>ことにも、失敗した。', t0: Q[8] + 5.0, t1: T.resume - 0.25 });
  sub(ov, { text: '2 日後には 3 号機でも爆発。放射性物質は、数日にわたって外へ出つづけた', t0: Q[8] + 5.4, t1: T.resume - 0.3, y: 962 });

  // 崩壊熱のグラフ（Q1）: 停止からの時間（対数）と、運転中の出力に対する割合
  const CX = 1050, CY = 430, CW = 740, CH = 300;
  const DH = [[0, 6.5], [3.556, 1.5], [4.937, 0.4], [5.782, 0.2]];      // log10(秒), %
  const dhAt = (lx) => { for (let i = 0; i < DH.length - 1; i++) if (lx <= DH[i + 1][0]) { const u = (lx - DH[i][0]) / (DH[i + 1][0] - DH[i][0]); const uu = i === 0 ? u : u; return Math.exp(lerp(Math.log(DH[i][1]), Math.log(DH[i + 1][1]), uu)); } return 0.2; };
  const gx = (lx) => CX + (lx / 5.9) * CW, gy = (v) => CY + CH - (v / 7) * CH;
  const c0 = Q[1] + 1.4, c1 = Q[2] - 0.5;
  label(ov, { html: '<span style="font-size:32px">崩壊熱</span><small>運転中の出力に対する割合</small>', t0: c0, t1: c1, x: CX, y: CY - 112 });
  [['停止直後', '約 7%', 0, 6.5, -1], ['1 時間後', '約 1.5%', 3.556, 1.5, 1], ['1 日後', '約 0.4%', 4.937, 0.4, 1], ['1 週間後', '約 0.2%', 5.782, 0.2, 1]].forEach(([when, v, lx, val, side], i) => {
    label(ov, { html: `<span class="n" style="font-size:36px">${v}</span><small>${when}</small>`, t0: c0 + 0.9 + i * 0.9, t1: c1, x: gx(lx) + (i === 0 ? 22 : i === 3 ? 26 : 0), y: gy(val) - [30, 100, 168, 100][i], align: i === 0 ? 'l' : 'c' });
  });
  sub(ov, { text: '100 万 kW 級の炉なら、1 日たっても 1 万 kW 以上の熱が出ている', t0: c0 + 4.2, t1: c1, y: CY + CH + 22, style: { left: CX + 'px', right: 'auto', width: CW + 'px', fontSize: '24px' } });
  // 温度計と反応式
  ov.add({
    t0: Q[3] + 5.0, t1: Q[6] - 0.6, className: 'gauge', style: { left: '1070px', top: '470px' }, html: '<div class="cap">燃料の温度</div><div class="val"><span class="v"></span><span class="u">℃</span></div>',
    setup(el, it) { it.v = el.querySelector('.v'); it.val = el.querySelector('.val'); },
    update(el, tl, t, it) {
      const T_ = tempAt(t), c = heatColor(Math.max(T_, 700));
      it.v.textContent = (Math.round(T_ / 10) * 10).toLocaleString('en-US'); it.val.style.color = `rgb(${c[0] | 0},${Math.min(255, c[1] + 40) | 0},${Math.min(255, c[2] + 40) | 0})`;
      el.style.opacity = inout(tl, Q[6] - 0.6 - Q[3] - 5.0, 0.6, 0.5).toFixed(4);
    },
  });
  equation(ov, { src: ['\\mathrm{Zr}+2\\,\\mathrm{H_2O}\\;\\longrightarrow\\;\\mathrm{ZrO_2}+2\\,\\mathrm{H_2}\\uparrow'], t0: Q[4] + 4.4, t1: Q[5] - 0.3, x: 1070, y: 640, size: 40 });
  label(ov, { html: '<small style="font-size:23px">ジルコニウム ＋ 水蒸気 → 酸化ジルコニウム ＋ <em>水素</em>（と、さらに熱）</small>', t0: Q[4] + 4.9, t1: Q[5] - 0.3, x: 1070, y: 712 });
  ov.add({
    t0: Q[5] + 0.5, t1: Q[6] - 0.6, className: 'big', style: { left: '1070px', top: '626px' }, html: '<div class="num" style="font-family:var(--mincho);font-weight:600;font-size:72px;letter-spacing:.1em;color:#ffcf8a">炉心溶融</div><div class="note" style="font-size:25px">メルトダウン</div>',
    update(el, tl) { const a = ease.outCubic(sat(tl / 0.7)); el.style.opacity = Math.min(a, 1 - smoothstep(Q[6] - 0.6 - Q[5] - 0.5 - 0.5, Q[6] - 0.6 - Q[5] - 0.5, tl)).toFixed(4); el.style.transform = `translateY(${((1 - a) * 10).toFixed(2)}px)`; },
  });
  // 図の名札（視点が変わるので、世界の点について動く）
  const follow = (html, wx, wy, t0, t1, align = 'l', dx = 16, dy = -18, size = 24) => ov.add({
    t0, t1, className: 'lbl' + (align === 'r' ? ' r' : ''), html, style: { fontSize: size + 'px' },
    update(el, tl, t) {
      const st = accState(t), q = toScreen(st.view, typeof wx === 'function' ? wx(st) : wx, typeof wy === 'function' ? wy(st) : wy);
      if (align === 'r') { el.style.right = (W - q[0] + dx).toFixed(1) + 'px'; el.style.left = 'auto'; } else el.style.left = (q[0] + dx).toFixed(1) + 'px';
      el.style.top = (q[1] + dy).toFixed(1) + 'px'; el.style.opacity = inout(tl, t1 - t0, 0.5, 0.4).toFixed(4);
    },
  });
  follow('制御棒 <b>全挿入</b>', -3.4, -4.6, Q[0] + 2.9, Q[1] - 0.4, 'r', 22, -18);
  follow('水位', -3.2, (st) => st.water, Q[3] + 1.0, Q[5] - 0.5, 'r', 18, -20);
  follow('<em>水素</em>', 3.4, 7.2, Q[4] + 5.2, Q[5] - 0.4);
  follow('溶けた燃料', 3.2, -6.4, Q[5] + 4.6, Q[6] - 1.0);
  follow('格納容器の床', 4.4, -10.4, Q[6] + 2.4, Q[7] - 1.5);
  follow('<em>水素</em>', -21.5, 28.4, Q[7] + 1.3, Q[8] - 0.2, 'l', 14, -40);
  follow('非常用発電機・電源盤', 82.4, -6.2, Q[2] + 3.0, Q[2] + 6.2, 'r', -40, -34, 23);
  follow('津波', (st) => clamp(st.front + 14, 40, 104), 3.2, Q[2] + 1.2, Q[2] + 4.6, 'l', 0, -40, 30);

  return {
    id: 'accident', t0: Q[0], t1: T.resume,
    render(env, tl, t) {
      const p = env.p, st = accState(t), v = st.view, s = v.s;
      const black = st.lights ? 0 : 1;
      bg.bg([0.005, 0.011, 0.026], [0.0008, 0.0014, 0.0040], [W / 2, H / 2], 1.0);
      const b = base.begin(), g2 = glow.begin();
      drawSite(b, g2, st);
      // 敷地を走る津波
      if (st.surge > 0.01 && st.front < 99 && st.site > 0.02) {
        b.setTransform(s, 0, 0, -s, W / 2 + (v.ox || 0) - v.cx * s, H / 2 + (v.oy || 0) + v.cy * s);
        b.fillStyle = `rgba(16,62,126,${(0.72 * st.site).toFixed(4)})`; b.beginPath(); b.moveTo(99, G.ground);
        for (let x = 99; x >= st.front - 6; x -= 1.5) b.lineTo(x, G.ground + st.surge * (4.6 * smoothstep(st.front - 3, st.front + 9, x) + 1.3 * Math.exp(-Math.pow((x - st.front - 3) / 3.5, 2)) + 0.15 * Math.sin(x * 0.8 + t * 5)));
        b.lineTo(st.front - 6, G.ground); b.closePath(); b.fill(); b.setTransform(1, 0, 0, 1, 0, 0);
      }
      drawReactor(b, g2, st);
      base.flush('alpha', 1, 1); glow.flush('add', lerp(1.35, 1.12, black), 1);
      // 津波の先端のしぶき
      if (st.surge > 0.05 && st.site > 0.05) {
        dots.begin();
        for (let k = 0; k < 90; k++) {
          const d = H2[k], u = fract(t * (0.8 + d[1]) + d[2]);
          const x = st.front + 3 + 12 * d[0] - 6 * u, base0 = st.front < 99 ? G.ground + 4.6 * smoothstep(st.front - 3, st.front + 9, x) : G.sea + st.wave(x);
          const q = toScreen(v, x, base0 + 0.6 + 4.5 * u * (1 - u) * (0.5 + d[3]));
          dots.add(q[0], q[1], 1.2 + 2.2 * d[3], 0.55 * st.surge * st.site * (1 - u), [0.75, 0.9, 1.0]);
        }
        dots.flush('add', { gauss: 1 });
      }

      // ---- 流れ・泡・水素
      dots.begin();
      const fs = { ...st, flow: Math.max(st.flow, 0), power: 1 };
      flowDots(dots, fs);
      const add = (x, y, r, i, col, target = dots) => { const q = toScreen(v, x, y); if (q[0] > -60 && q[0] < W + 60 && q[1] > -60 && q[1] < H + 60) target.add(q[0], q[1], Math.max(r * s, 1.2), i, col); };
      // 停止後の冷却: 電源があるあいだ、給水の配管を水が回る
      if (st.cool > 0.02 && st.site > 0.03) for (let k = 0; k < 15; k++) { const u = fract(t * 0.16 + k / 15), L = G.feed; const seg = u * 3; const i = Math.min(2, Math.floor(seg)), f = seg - i; add(lerp(L[i][0], L[i + 1][0], f), lerp(L[i][1], L[i + 1][1], f), 0.34, 0.8 * st.cool * st.site, [0.2, 0.55, 1.0]); }
      // 水素: 熱くなった被覆管から泡になって上る → 格納容器 → 建屋の最上階
      const hgen = smoothstep(950, 1300, st.fuelT) * (1 - smoothstep(Q[5] + 3, Q[6] + 2, t));
      if (hgen > 0.01) for (let k = 0; k < 70; k++) { const d = H2[k], u = fract(t * (0.35 + 0.35 * d[1]) + d[2]); add(lerp(-1.9, 1.9, d[0]) + 0.08 * Math.sin(t * 4 + k), lerp(Math.max(st.water, G.coreY0 + 0.2), 10.8, u), 0.07 + 0.05 * d[3], 0.9 * hgen * (1 - u * 0.6), COL.ice); }
      const inDw = smoothstep(Q[4] + 5, Q[6], t);      // 格納容器の中にたまる
      if (inDw > 0.01 && s > 14) for (let k = 0; k < 90; k++) { const d = H2[k + 70]; if (d[3] > inDw) continue; const sx = d[0] < 0.5 ? -1 : 1; add(sx * lerp(3.4, 5.2, d[1]) + 0.12 * Math.sin(t * 1.3 + k), lerp(-5, 19, d[2]) + 0.15 * Math.sin(t * 0.9 + k * 2), 0.11, 0.55, k % 3 === 0 ? COL.iodine : COL.ice); }
      const leak = smoothstep(Q[6] + 3.6, Q[8] - 0.6, t) * (1 - st.blast);
      if (leak > 0.003) {
        for (let k = 0; k < 190; k++) { const d = H2[k + 60]; if (d[3] > leak * 1.02) continue; const lift = smoothstep(0, 0.5, leak - d[3] + 0.08); add(lerp(-21.5, 21.5, d[0]) + 0.3 * Math.sin(t * 0.8 + k), lerp(19.5, lerp(22, 30.2, Math.pow(d[1], 0.6)), lift) + 0.25 * Math.sin(t * 1.1 + k * 3), 0.3, 0.5 * lift, k % 4 === 0 ? COL.iodine : COL.ice); }
        for (let k = 0; k < 14; k++) { const d = H2[k], u = fract(t * 0.3 + d[2]); add(lerp(-5, 5, d[0]), lerp(20.6, 23.5, u), 0.24, 0.7 * (1 - u), COL.ice); }
      }
      dots.flush('add', { gauss: 1 });

      // ---- 崩壊熱のグラフ
      lines.begin();
      if (t > c0 - 0.1 && t < c1 + 0.1) {
        const a = inout(t - c0, c1 - c0, 0.6, 0.5), u = ease.inOutCubic(sat((t - c0 - 0.3) / 3.4));
        lines.seg(CX, CY + CH, CX + CW + 20, CY + CH, 1.5, 0.4 * a, COL.paper); lines.seg(CX, CY - 10, CX, CY + CH, 1.5, 0.4 * a, COL.paper);
        const n = 120, pts = new Float32Array((n + 1) * 2); let m = 0;
        for (let i = 0; i <= n * u; i++) { const lx = (5.9 * i) / n; pts[m * 2] = gx(lx); pts[m * 2 + 1] = gy(dhAt(lx)); m++; }
        if (m > 1) lines.poly(pts, m, { w: 3.6, i: 1.3 * a, col: COL.amber });
        DH.forEach(([lx, val], i) => { if (u * 5.9 >= lx) { const d = dots.begin(); d.add(gx(lx), gy(val), 7, 2.2 * a, COL.white); d.add(gx(lx), gy(val), 22, 0.5 * a, COL.amber); d.flush('add', { gauss: 1 }); } });
        for (const [lx, name] of [[0, ''], [1.778, ''], [3.556, ''], [4.937, ''], [5.782, '']]) lines.seg(gx(lx), CY + CH, gx(lx), CY + CH + 8, 1.4, 0.45 * a, COL.paper);
      }
      // ---- 爆発
      const te = t - Q[8];
      smoke.begin();
      if (te >= 0) {
        const cx0 = 0, cy0 = 23;
        for (const d of DEB) {       // 吹き飛ぶ屋根と壁
          const x = d.x + Math.cos(d.a) * d.v * te * 0.9, y = d.y + Math.sin(d.a) * d.v * te - 4.9 * te * te;
          if (y < G.ground - 2) continue;
          const an = d.ph + d.rot * te, q0 = toScreen(v, x - Math.cos(an) * d.len / 2, y - Math.sin(an) * d.len / 2), q1 = toScreen(v, x + Math.cos(an) * d.len / 2, y + Math.sin(an) * d.len / 2);
          lines.seg(q0[0], q0[1], q1[0], q1[1], 2.2, 0.9 * Math.exp(-te / 3.5), [0.6, 0.72, 0.85]);
        }
        const ring = toScreen(v, cx0, cy0);    // 衝撃波
        if (te < 1.2) lines.circle(ring[0], ring[1], (4 + 150 * te) * s / 3, { w: 3, i: 1.6 * Math.exp(-te / 0.3), col: COL.white });
        for (const k of SMK) {       // 煙（ほこりと蒸気）。上へ、そして風下へ
          const age = te - k.d * 0.5; if (age <= 0) continue;
          const ex = 1 - Math.exp(-age / 1.1);
          const r0 = (5 + 17 * k.v) * ex, rise = (3.2 + 2.6 * k.v) * age * (0.4 + 0.6 * Math.sin(k.a));
          const x = k.x + Math.cos(k.a) * r0 + (2.2 + k.w * 0.7) * Math.max(age - 1.2, 0) * (0.6 + k.v), y = k.y + Math.sin(k.a) * r0 * 0.8 + rise;
          const fadeS = Math.exp(-age / 9) * smoothstep(0, 0.25, age);
          const hotK = k.hot > 0.88 ? Math.exp(-age / 1.6) : 0;
          const col = [0.40 + 0.5 * hotK, 0.41 + 0.12 * hotK, 0.44 - 0.2 * hotK];
          const tex = 0.55 + 0.45 * Math.sin(k.a * 7.0 + k.v * 23.0);       // むらをつけて、もこもこさせる
          add(x, y, (1.1 + 1.9 * ex + 0.42 * age) * k.sz, (0.034 + 0.16 * hotK) * fadeS * tex, col, smoke);
        }
        const fl = toScreen(v, cx0, cy0);
        smoke.add(fl[0], fl[1], (9 + 50 * te) * s, 4 * Math.exp(-te / 0.14), [1.0, 0.86, 0.62]);
      }
      smoke.flush('add', { gauss: 1 });
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 });

      // ---- 画面の調子
      const qk = t - Q[0];
      const quake = qk < 4.2 ? 0.0075 * Math.exp(-qk / 1.5) * (0.6 + 0.4 * Math.sin(qk * 5)) : 0;
      const boom = te >= 0 && te < 2.5 ? 0.014 * Math.exp(-te / 0.5) : 0;
      const wav = t > Q[2] + 2.0 && t < Q[2] + 5.5 ? 0.0022 * (1 - Math.abs((t - Q[2] - 3.7) / 1.8)) : 0;
      const sh = quake + boom + Math.max(wav, 0);
      p.shake = [sh * Math.sin(t * 61.3) + sh * 0.5 * Math.sin(t * 37.1), sh * Math.cos(t * 53.7) + sh * 0.4 * Math.sin(t * 29.9)];
      p.bloom = 0.55 + 0.25 * smoothstep(1000, 2600, st.fuelT); p.threshold = 0.78; p.vignette = 0.5 + 0.22 * black; p.ca = 0.006 + 2.2 * sh;
      p.tint = [1, lerp(1, 0.93, black), lerp(1, 0.86, black)];
      p.flash = te >= 0 ? 0.9 * Math.exp(-te / 0.16) : 0.25 * Math.exp(-Math.max(qk, 0) / 0.12) * (qk >= 0 ? 1 : 0);
      p.scrim = 0.55 * (1 - st.site);
      p.fade = 1 - smoothstep(T.resume - 1.3, T.resume - 0.15, t);
    },
  };
}
