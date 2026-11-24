// plant.js — 3 章「発電」。ペレット 1 個から、燃料棒 → 燃料集合体 → 炉心 → 発電所全体へ、ひと続きに引いていく。
// そのあと、熱 → 蒸気 → タービン → 発電機 → 復水器 → 給水 の循環と、安全の 3 原則。
import { T, W, H, COL, sat, smoothstep, ease, lerp, clamp, mulberry32, TAU, fract } from '../core.js';
import { Layer2D, Dots, chap, narr, label, big, along, pathLen, fadeEl } from '../kit.js';
import { G, drawReactor, drawSite, toScreen } from '../plantdraw.js';
import { shared } from '../../../film/src/scenes/shared.js';

export const PLANT_VIEW = { cx: 38.5, cy: 4.43, s: 14.3, ox: 0, oy: 0 };
const PEL = { cx: 0, cy: G.pelH / 2, s: 30000, ox: -360, oy: -30 };
const KEYS = [
  [T.fuel, PEL], [78.3, PEL],
  [80.7, { cx: 0, cy: G.pelH / 2, s: 2600, ox: -360, oy: -30 }], [81.5, { cx: 0, cy: G.pelH / 2, s: 2600, ox: -360, oy: -30 }],
  [83.7, { cx: 0, cy: 0, s: 205, ox: -160, oy: -64 }], [84.7, { cx: 0, cy: 0, s: 205, ox: -160, oy: -64 }],
  [86.9, { cx: 0, cy: 2.8, s: 37, ox: -330, oy: -50 }], [88.2, { cx: 0, cy: 2.8, s: 37, ox: -330, oy: -50 }],
  [91.0, PLANT_VIEW],
];
// 視点の補間（拡大率は対数でつなぐ）
export function viewFrom(keys, t) {
  if (t <= keys[0][0]) return { ...keys[0][1] };
  for (let i = 0; i < keys.length - 1; i++) {
    const [ta, a] = keys[i], [tb, b] = keys[i + 1];
    if (t <= tb) { const u = ease.inOutCubic(sat((t - ta) / (tb - ta))); return { cx: lerp(a.cx, b.cx, u), cy: lerp(a.cy, b.cy, u), s: Math.exp(lerp(Math.log(a.s), Math.log(b.s), u)), ox: lerp(a.ox || 0, b.ox || 0, u), oy: lerp(a.oy || 0, b.oy || 0, u) }; }
  }
  return { ...keys[keys.length - 1][1] };
}
const lod = (s, lo, hi) => 1 - smoothstep(Math.log(lo), Math.log(hi), Math.log(s));

// 運転中の発電所の状態（事故の章は、ここから先を書き換えていく）
export function plantState(t) {
  const view = viewFrom(KEYS, t), s = view.s;
  return {
    t, view,
    hero: 1 - smoothstep(78.2, 79.8, t),
    vessel: lod(s, 1300, 7000), shell: lod(s, 60, 190), site: lod(s, 20, 44),
    power: 1, fuelT: 290, water: G.water0, rods: 0.3, melt: 0, through: 0,
    flow: smoothstep(88.2, 91.6, t), gen: smoothstep(90.2, 93.2, t), spin: 6.0 * t, lights: 1, edg: 0,
    hi: {},
  };
}

// 流れをあらわす点（配管の中の水と蒸気、炉の中の泡と湯気）
const SEED = (() => { const r = mulberry32(404); return Array.from({ length: 200 }, () => [r(), r(), r(), r()]); })();
export function flowDots(dots, st) {
  const v = st.view, s = v.s, t = st.t, flow = st.flow || 0, site = st.site ?? 1, vessel = st.vessel ?? 1;
  const add = (x, y, r, i, col) => { const q = toScreen(v, x, y); if (q[0] > -50 && q[0] < W + 50 && q[1] > -50 && q[1] < H + 50) dots.add(q[0], q[1], Math.max(r * s, 1.3), i, col); };
  const run = (pts, n, speed, col, r, I) => { const L = pathLen(pts); for (let k = 0; k < n; k++) { const p = along(pts, fract((t * speed) / L + k / n)); add(p[0], p[1], r, I, col); } };
  if (site > 0.03 && flow > 0.01) {
    const I = flow * site;
    run(G.steam, 13, 11, COL.steam, 0.34, 0.85 * I);
    run(G.feed, 15, 7, [0.2, 0.55, 1.0], 0.34, 0.9 * I);
    run(G.seaIn, 16, 8, [0.1, 0.5, 0.9], 0.3, 0.6 * I); run(G.seaOut, 16, 8, [0.1, 0.5, 0.9], 0.3, 0.6 * I);
    for (let k = 0; k < 22; k++) { const d = SEED[k], u = fract(t * (0.5 + 0.3 * d[1]) + d[2]); add(lerp(47, 61, d[0]), lerp(2.2, -6.0, u), 0.22, 0.5 * I * (1 - u), COL.steam); }      // タービンを出た蒸気が復水器へ
    const gen = st.gen || 0;
    if (gen > 0.01) run(G.line, 7, 26, [1.0, 0.75, 0.3], 0.36, 1.2 * gen * site * (1 - (st.linesDown || 0)));
  }
  // 炉の中: 炉心で生まれた泡が上り、水面から蒸気が立つ
  const boil = st.boil ?? (st.power * flow);
  if (vessel > 0.03 && s < 700 && s > 9 && boil > 0.01) {
    const top = st.water, n = s > 30 ? 90 : 40;
    for (let k = 0; k < n; k++) {
      const d = SEED[k + 30], u = fract(t * (0.35 + 0.4 * d[1]) + d[2]);
      const y = lerp(G.coreY0 + 0.3, top, u); if (top < G.coreY0 + 0.4) break;
      add(lerp(-2.0, 2.0, d[0]) + 0.05 * Math.sin(t * 3 + k), y, 0.045 + 0.05 * d[3], 0.55 * boil * vessel * smoothstep(0, 0.12, u) * (1 - smoothstep(0.9, 1, u)), [0.6, 0.85, 1.0]);
    }
    for (let k = 0; k < 36; k++) {
      const d = SEED[k + 130], u = fract(t * (0.22 + 0.2 * d[1]) + d[2]);
      add(lerp(-2.3, 2.3, d[0]) * (1 - 0.5 * u), lerp(top + 0.1, Math.max(top + 1.5, 10.6), u), 0.16 + 0.2 * u, 0.22 * boil * vessel * (1 - u) * smoothstep(0, 0.1, u), COL.steam);
    }
  }
}

export const id = 'plant';
export async function create(env) {
  const { ov } = env;
  const base = new Layer2D(env), glow = new Layer2D(env), dots = new Dots(env, 2048);
  const bg = shared(env);

  chap(ov, { n: 3, kanji: '発電', en: 'POWER PLANT', t0: T.fuel + 0.3, t1: T.quake - 0.2 });
  // ---- ペレット
  big(ov, { cap: 'この 1 個で、一般家庭の電気', value: '約 8', unit: 'か月分', note: '燃料ペレット — ウランを焼き固めた、直径 約 1 cm の粒', t0: T.fuel + 0.9, t1: 78.5, x: 980, y: 400 });
  label(ov, { html: '1 cm', t0: T.fuel + 0.7, t1: 78.4, x: 386, y: 492, align: 'r', size: 25 });
  narr(ov, { text: '燃料は、小さな焼き物の粒。', t0: T.fuel + 0.35, t1: 78.5 });
  // ---- 燃料棒 → 集合体 → 炉心
  label(ov, { html: '<span style="font-size:36px">燃料棒</span><small>ジルコニウム合金の細い管に、ペレットを約 350 個。長さ 約 4 m</small>', t0: 79.9, t1: 82.2, x: 940, y: 410, cls: 'panel' });
  label(ov, { html: '<span style="font-size:36px">燃料集合体</span><small>燃料棒を数十本、束ねたもの</small>', t0: 83.2, t1: 85.4, x: 1330, y: 380, cls: 'panel' });
  label(ov, { html: '<span style="font-size:36px">炉心</span><small>集合体が数百体。水の中に沈んでいる</small>', t0: 86.4, t1: 88.9, x: 860, y: 500 });
  label(ov, { html: '<span style="font-size:32px">原子炉圧力容器</span><small>厚い鋼鉄のつぼ。高さ 約 20 m</small>', t0: 86.9, t1: 88.9, x: 860, y: 250 });
  narr(ov, { text: '粒を管に詰めた<b>燃料棒</b>。それを束ねた<b>燃料集合体</b>。', t0: 78.9, t1: 84.5 });
  narr(ov, { text: '数百体が並んで、<b>炉心</b>になる。', t0: 84.8, t1: 88.2 });
  // ---- 発電所の全景: 名札は流れの順に出る
  const at = (x, y) => toScreen(PLANT_VIEW, x, y);
  const tag = (html, x, y, t0, align = 'c', t1 = T.principle - 0.3) => { const q = at(x, y); label(ov, { html, t0, t1, x: q[0], y: q[1], align, size: 24 }); };
  tag('原子炉建屋', -21.6, 30.2, 91.0, 'l');
  tag('格納容器', -21.6, 15.5, 91.4, 'l');
  tag('圧力容器', -21.6, 9.6, 91.8, 'l');
  tag('炉心', -21.6, 1.4, 92.2, 'l');
  tag('蒸気', 22, 11.2, 92.8);
  tag('タービン', 50, 14.0, 93.4);
  tag('発電機', 71, 12.6, 94.0);
  tag('送電', 78.5, 24, 94.6, 'l');
  tag('復水器', 50, -1.9, 95.6);
  tag('海水', 97.2, -8.6, 96.2);
  tag('給水', 22, 2.6, 97.0);
  narr(ov, { text: '核分裂の熱で水を沸かし、蒸気で<b>タービン</b>を回す。', t0: 88.6, t1: 94.4 });
  narr(ov, { text: '蒸気は海水で冷やされて水に戻り、ふたたび炉へ。', t0: 94.7, t1: T.principle - 0.2 });
  narr(ov, { text: '安全の原則は 3 つ。', t0: T.principle + 0.3, t1: 104.2 });
  narr(ov, { text: '<b>止める</b>。<b>冷やす</b>。<b>閉じ込める</b>。', t0: 104.5, t1: T.quake - 0.15 });

  const leader = (c, x0, y0, x1, y1, a) => { c.strokeStyle = `rgba(150,190,230,${(0.55 * a).toFixed(4)})`; c.lineWidth = 1.3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.fillStyle = `rgba(190,220,250,${(0.9 * a).toFixed(4)})`; c.beginPath(); c.arc(x1, y1, 3, 0, TAU); c.fill(); };

  return {
    id: 'plant', t0: T.fuel, t1: T.quake,
    render(env, tl, t) {
      const p = env.p, st = plantState(t);
      // 3 原則: 該当する部分を順に光らせる
      const hl = (a, b) => smoothstep(a, a + 0.5, t) * (1 - smoothstep(b - 0.6, b, t));
      st.hi = { rods: hl(104.6, 106.4), cool: hl(106.3, 108.2), contain: hl(108.1, T.quake + 0.4) };
      if (st.hi.rods > 0) st.rods = 0.3 + 0.12 * st.hi.rods;
      bg.bg([0.005, 0.012, 0.028], [0.0008, 0.0014, 0.0040], [W / 2, H / 2], 1.0);
      const b = base.begin(), g2 = glow.begin();
      drawSite(b, g2, st); drawReactor(b, g2, st);
      // 画面座標での描き足し: ペレットの寸法線、名札の引き出し線
      if (st.hero > 0.01 && t < 79) {
        const a = st.hero * smoothstep(T.fuel + 0.5, T.fuel + 1.2, t);
        const p0 = toScreen(st.view, -G.pelD / 2, 0), p1 = toScreen(st.view, -G.pelD / 2, G.pelH);
        const x = p0[0] - 46;
        g2.strokeStyle = `rgba(190,215,240,${(0.8 * a).toFixed(4)})`; g2.lineWidth = 1.5; g2.beginPath(); g2.moveTo(x, p0[1]); g2.lineTo(x, p1[1]); g2.moveTo(x - 9, p0[1]); g2.lineTo(x + 9, p0[1]); g2.moveTo(x - 9, p1[1]); g2.lineTo(x + 9, p1[1]); g2.stroke();
      }
      if (t > 91 && t < T.principle) {
        const la = (t0) => smoothstep(t0, t0 + 0.5, t) * (1 - smoothstep(T.principle - 0.7, T.principle - 0.3, t));
        const L = (x0, y0, x1, y1, t0) => { const a = at(x0, y0), c = at(x1, y1); leader(g2, a[0], a[1], c[0], c[1], la(t0)); };
        L(-13.4, 14.1, -5.9, 13.2, 91.4); L(-13.4, 8.2, -3.1, 8.2, 91.8); L(-17.2, 0.0, -2.3, 0.0, 92.2);
      }
      base.flush('alpha', 1, 1); glow.flush('add', 1.35, 1);
      dots.begin(); flowDots(dots, st); dots.flush('add', { gauss: 1 });

      const fadeIn = smoothstep(0, 0.9, tl);
      p.bloom = 0.55; p.threshold = 0.78; p.vignette = 0.5; p.ca = 0.006; p.fade = fadeIn;
      p.scrim = 0.85 * (1 - st.site);
    },
  };
}
