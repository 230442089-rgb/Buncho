// inner.js — 身体の中の場面。細胞と DNA が、撃たれ、耐え、砕け、魂に呼び戻される。
import { W, H, T, Q, SHOUTS, shoutEnv, DURATION, sat, smoothstep as sm, ease, lerp, clamp, TAU, COL, hash1, noise1, pulse, mulberry32, v3 } from '../core.js';
import { Layer2D, Spheres, Dots, camera } from '../../../atom/src/kit.js';
import { Lines } from '../../../film/src/lines.js';
import { shared } from '../../../film/src/scenes/shared.js';
import { cells, drawCell, helixPoints, drawHelix, drawGhostHelix, NBP, NG } from '../micro.js';

// 場面の区間
export const CELL_WIN = [[T.inside, T.dna1], [T.cells1, T.lull], [T.shatter, 73.2], [T.soulCells, T.soulDna], [T.tug, T.bullets]];
export const DNA_WIN = [[T.dna1, T.decide], [T.hold, T.kiai1b], [73.2, T.dark], [T.soulDna, T.tug]];
const inWin = (W_, t) => W_.find(([a, b]) => t >= a && t < b);
export const inCells = (t) => !!inWin(CELL_WIN, t), inDna = (t) => !!inWin(DNA_WIN, t);

// ---- DNA に当たる中性子: [時刻, 塩基対の番号, 鎖を切るか]
const HITS = [[22.5, 16, 1], [23.4, 31, 1], [24.5, 24, 1], [25.2, 9, 1]];
{
  const r = mulberry32(4242); let t = 35.6;
  while (t < 49.6) { HITS.push([t, 8 + Math.floor(r() * 32), 0]); t += (t < 38 ? 0.42 : t < 46 ? 0.2 : 0.13) * (0.6 + 0.8 * r()); }
}
HITS.push([46.0, 22, 2]);
HITS.sort((a, b) => a[0] - b[0]);
const SSB1 = [[16, 22.5, 0], [31, 23.4, 1], [24, 24.5, 0], [9, 25.2, 1]];
// 画面の数字: 浴びた中性子の数（演出上の数字）と、切れた結合の数
export const hitCount = (t) => (t < T.inside ? 0 : t < T.flash2 ? Math.floor(3.1e5 * (t - T.inside) ** 1.55) : Math.floor(3.1e5 * 48 ** 1.55 + 4.4e7 * (t - T.flash2) ** 1.3));
export const breakCount = (t) => (t < 22.5 ? 0 : t < T.hold ? SSB1.filter((s) => t >= s[1]).length + Math.floor(sat((t - 22.5) / 3.5) ** 2 * 37) : t < 46.0 ? Math.round(41 * (1 - sm(34.2, 35.5, t))) : t < 48.3 ? 1 : 0);

// ---- 細胞を横切る中性子の飛跡: [時刻, y, 傾き]
const TRACKS = [];
{
  const r = mulberry32(977);
  const fill = (a, b, rate) => { let t = a + 0.2; while (t < b) { TRACKS.push([t, 60 + 960 * r(), (r() - 0.5) * 0.24, r()]); t += (1 / rate) * (0.5 + r()); } };
  fill(T.inside, T.dna1, 2.6); fill(T.cells1 - 0.2, T.lull, 6); fill(T.shatter - 0.2, 73.3, 11); fill(T.soulCells, T.soulDna, 5); fill(T.tug - 0.2, T.bullets, 9);
}

export const id = 'inner';
export async function create(env) {
  const { g } = env;
  const base = new Layer2D(env), glow = new Layer2D(env), sph = new Spheres(env, 4096), dots = new Dots(env, 8192), lines = new Lines(g, 4096), bg = shared(env);

  // 背景: 暗い体液の中に、ピントの外れた粒がただよう
  function backdrop(t, tint, k = 1) {
    bg.bg([0.012 * tint[0] + 0.004, 0.018 * tint[1] + 0.006, 0.03 * tint[2] + 0.012], [0.0008, 0.0014, 0.0036], [W / 2, H / 2], 0.95);
    dots.begin();
    for (let i = 0; i < 46; i++) {
      const h1 = hash1(i * 3.7), h2 = hash1(i * 5.9), h3 = hash1(i * 8.3);
      const x = ((h1 * W * 1.3 + t * (6 + 16 * h3)) % (W * 1.3)) - W * 0.15, y = h2 * H + 30 * Math.sin(t * 0.3 + i);
      dots.add(x, y, 14 + 60 * h3 * h3, (0.018 + 0.03 * h1) * k, tint);
    }
    dots.flush('add', { gauss: 1 });
  }

  // ------------------------------------------------------------ 細胞の場面
  const cellLayer = {
    id: 'cells', t0: T.inside, t1: T.bullets,
    render(env, tl, t) {
      const win = inWin(CELL_WIN, t); if (!win) return;
      const p = env.p, wi = CELL_WIN.indexOf(win), u = (t - win[0]) / (win[1] - win[0]);
      // 場面ごとの状態
      let zoom = 1, gold = 0, soul = 0, ghost = 0, tint = [0.5, 0.8, 1.0], trackMode = 0;
      let eOf = () => () => 0, flashOf = () => 0;
      if (wi === 0) { zoom = lerp(0.86, 1.0, ease.outCubic(sat(u * 2.2))) * (1 + 1.5 * ease.inQuart(sat((t - 19.6) / 2.4))); }
      else if (wi === 1) { zoom = lerp(1.04, 1.12, u); gold = 1; tint = [1.0, 0.75, 0.4]; trackMode = 1; }
      else if (wi === 2) { zoom = lerp(1.0, 0.9, ease.outCubic(u)); eOf = (c) => (lag) => ease.outCubic(sat((t - 71.12 - hash1(c.ci * 4.4) * 0.45 - lag * 0.1) / 0.9)) * (1 + 0.25 * sat((t - 71.5) / 2)); }
      else if (wi === 3) {
        zoom = lerp(0.9, 1.04, ease.inOutSine(u)); soul = 1; tint = [0.7, 0.9, 1.0];
        ghost = sm(85.15, 86.4, t) * (1 - 0.55 * sm(92.0, 92.9, t));
        const start = (c) => 89.05 + hash1(c.ci * 6.1) * 1.3;
        eOf = (c) => (lag) => { const k = sat((t - start(c) - lag * 0.75) / 0.62); return (1 - ease.outBack(k, 1.4)) * (1.25 + 0.05 * Math.sin(t * 1.3 + lag * 20)); };
        flashOf = (c) => pulse(t, start(c) + 1.37, 0.28);
      } else {
        zoom = lerp(1.02, 1.1, u); soul = 1; ghost = 0.55; tint = [0.7, 0.9, 1.0]; trackMode = 2;
        eOf = (c) => (lag) => { const per = 1.0, ph = ((t - 97.05 + hash1(c.ci * 2.2) * per) % per) / per; return 0.72 * (ph < 0.1 ? ease.outCubic(ph / 0.1) : 1 - ease.inOutCubic(sat((ph - 0.1 - lag * 0.12) / 0.6))); };
        flashOf = (c) => { const per = 1.0, ph = ((t - 97.05 + hash1(c.ci * 2.2) * per) % per) / per; return ph > 0.72 ? Math.exp(-(ph - 0.76) * 14) * (ph > 0.76 ? 1 : 0) : 0; };
      }
      backdrop(t, tint);
      const zx = W / 2 + (wi === 0 ? 0 : 20 * Math.sin(t * 0.21)), zy = H / 2 + (wi === 0 ? 0 : 12 * Math.sin(t * 0.17 + 1));
      const cb = base.begin(), cg = glow.begin(); cg.globalCompositeOperation = 'lighter';
      for (const c of [cb, cg]) { c.translate(zx, zy); c.scale(zoom, zoom); c.translate(-W / 2, -H / 2); }
      const X = (x) => (x - W / 2) * zoom + zx, Y = (y) => (y - H / 2) * zoom + zy;
      for (const c of cells) drawCell(cb, cg, c, { t, e: eOf(c), ghost, gold: gold * (0.8 + 0.2 * Math.sin(t * 5 + c.ci)), soul, flash: flashOf(c), dim: 1 });
      base.flush('alpha', 1, 1); glow.flush('add', 1.6, 1);
      // ---- 中性子の飛跡
      lines.begin(); dots.begin();
      for (const [tt, y0, sl, hr] of TRACKS) {
        const age = t - tt; if (age < -0.02 || age > 0.9) continue;
        const v = 11000, xh = W + 200 - age * v;           // 先頭の位置（ワールド）
        let stop = -1e9;
        if (trackMode === 1) for (const c of cells) { const yy = y0 + sl * (W - c.x), dy = yy - c.y; if (Math.abs(dy) < c.R) stop = Math.max(stop, c.x + Math.sqrt(c.R * c.R - dy * dy)); }
        const x1 = Math.max(xh, stop), x0 = W + 300, yAt = (x) => y0 + sl * (W - x);
        const I = (age < 0.2 ? 1 : Math.exp(-(age - 0.2) / 0.16));
        lines.seg(X(x0), Y(yAt(x0)), X(x1), Y(yAt(x1)), 2.2 * zoom, 0.9 * I, COL.blue, 3.4 * zoom, 2.0 * I, COL.ice);
        if (xh > stop && age < 0.24) dots.add(X(xh), Y(yAt(xh)), 9 * zoom, 2.2, COL.white);
        if (stop > -1e8 && xh <= stop) {                    // 膜が弾く
          const a2 = (W + 200 - stop) / v, ag = age - a2, k = Math.exp(-ag / 0.14);
          dots.add(X(stop), Y(yAt(stop)), (10 + 70 * ag) * zoom, 2.4 * k, COL.pale);
          for (let j = 0; j < 5; j++) { const an = (hash1(hr * 9 + j) - 0.5) * 2.4, d = ag * (300 + 500 * hash1(hr * 5 + j * 3)); dots.add(X(stop + Math.cos(an) * d), Y(yAt(stop) + Math.sin(an) * d), 3 * zoom, 1.8 * k, COL.gold); }
        } else if (trackMode !== 1) for (let j = 0; j < 4; j++) {            // 通り抜けたあとに残る傷
          const xs = lerp(200, W - 200, hash1(hr * 7 + j * 2.3)), as = age - (W + 200 - xs) / v; if (as < 0) continue;
          dots.add(X(xs), Y(yAt(xs)), (5 + 26 * as) * zoom, 1.5 * Math.exp(-as / 0.22), trackMode === 2 ? COL.soul : [1.0, 0.5, 0.3]);
        }
      }
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 }); dots.flush('add', { gauss: 1 });
      const env1 = shoutEnv(t), f = env.frame, sh = 0.003 * env1 + (wi === 2 ? 0.008 * pulse(t, 71.12, 0.4) : 0) + (wi === 4 ? 0.003 : 0);
      p.shake = [noise1(f * 0.83, 31) * sh, noise1(f * 0.91, 32) * sh];
      p.flash = 0.5 * pulse(t, win[0], 0.1) + (wi === 3 ? 0.35 * pulse(t, Q(3), 0.08) : 0) + (wi === 2 ? 0.5 * pulse(t, 71.12, 0.12) : 0);
      p.bloom = 0.62; p.threshold = 0.72; p.vignette = 0.66; p.ca = 0.01 + 0.012 * env1;
      p.fade = 1;
    },
  };

  // ------------------------------------------------------------ DNA の場面
  const dnaLayer = {
    id: 'dna', t0: T.dna1, t1: T.tug,
    render(env, tl, t) {
      const win = inWin(DNA_WIN, t); if (!win) return;
      const p = env.p, wi = DNA_WIN.indexOf(win), u = (t - win[0]) / (win[1] - win[0]);
      const gold = wi === 1 ? sm(34.1, 35.4, t) : 0, soul = wi === 3 ? 1 : 0;
      backdrop(t, wi === 1 ? [lerp(0.5, 1.0, gold), 0.78, lerp(1.0, 0.45, gold)] : wi === 3 ? [0.7, 0.9, 1.0] : [0.5, 0.8, 1.0]);
      const pr = camera({ pos: [0.4 * Math.sin(t * 0.13), 0.9, -8.6 + (wi === 1 ? 0.9 * u : wi === 2 ? -1.2 * ease.outCubic(u) : 0.4 * u)], target: [0, 0, 0], fov: 0.6, roll: -0.2, cy: H / 2 - 20 });
      const phi = 0.6 * t;
      // 切れ目
      const ssb = [];
      if (wi === 0) for (const [bi, ts, st] of SSB1) if (t >= ts) ssb.push([bi + 0.5, ease.outCubic(sat((t - ts) / 0.45)), st]);
      if (wi === 1) { for (const [bi, , st] of SSB1) { const k = 1 - sm(34.2, 35.5, t); if (k > 0) ssb.push([bi + 0.5, k, st]); } if (t >= 46.0) { const k = ease.outBack(sat((t - 46.0) / 0.3), 1.3) * (1 - ease.inOutCubic(sat((t - 48.0) / 1.0))); if (k > 0.01) ssb.push([22.5, k, 0]); } }
      // ゆれ
      const shud = (i) => { let s = 0.02 * Math.sin(t * 2.3 + i * 0.4); for (const [th, ih] of HITS) { const a = t - th; if (a < 0 || a > 0.9) continue; s += (wi === 1 ? 0.2 : 0.3) * Math.exp(-a / 0.2) * Math.cos(a * 36) * Math.exp(-Math.abs(i - ih) / 3.2); } return s; };
      let e = null, ghost = 0;
      if (wi === 2) e = (g, lag) => ease.outCubic(sat((t - 73.32 - lag * 0.5) / 1.1)) * (1 + 0.3 * sat((t - 73.6) / 2));
      if (wi === 3) { ghost = sm(93.05, 93.5, t) * (1 - 0.6 * sm(96.2, 96.9, t)); e = (g) => { const k = sat((t - 93.45 - (g / NG) * 2.1) / 0.5); return 1 - ease.outBack(k, 1.5); }; }
      const pts = helixPoints({ phi, e, shud, ssb });
      // ---- 手本・らせん
      dots.begin(); drawGhostHelix(dots, pr, phi, ghost); dots.flush('add', { gauss: 1 });
      sph.begin(); dots.begin();
      drawHelix(sph, dots, pr, pts, { t, gold, soul: soul * (0.55 + 0.45 * sm(96.2, 96.8, t)), ssb, appear: 1 });
      sph.flush({ light: [-0.4, 0.62, 0.68], amb: 0.2, rim: 0.3, spec: 0.5 });
      dots.flush('add', { gauss: 1 });
      // ---- 中性子と火花
      lines.begin(); dots.begin();
      for (const [th, ih, kind] of HITS) {
        const age = t - th; if (age < -0.12 || age > 1.0) continue;
        const P = pts[ih], c = pr(v3.lerp(P.a, P.b, 0.5)), hr = hash1(th * 3.3), dy = (hr - 0.5) * 0.5, nx = 1 / Math.hypot(1, dy), ny = dy * nx, L = 2300;
        const pass = wi === 0;                                 // 最初は通り抜ける。気合いのあとは弾く
        if (age < 0) { const d = -age * 14000; lines.seg(c[0] + nx * (d + 380), c[1] + ny * (d + 380), c[0] + nx * d, c[1] + ny * d, 2, 0.8, COL.blue, 4, 2.4, COL.ice); dots.add(c[0] + nx * d, c[1] + ny * d, 10, 2.4, COL.white); continue; }
        const I = Math.exp(-age / 0.2);
        lines.seg(c[0] + nx * L, c[1] + ny * L, c[0], c[1], 1.5, 0.3 * I, COL.blue, 3.2, 1.6 * I, COL.ice);
        if (pass) { const d = Math.min(age * 14000, L); lines.seg(c[0], c[1], c[0] - nx * d, c[1] - ny * d, 3, 1.4 * I, COL.ice, 1.5, 0.3 * I, COL.blue); }
        else { const an = Math.PI * (0.25 + 0.5 * hash1(th * 7.1)) * (hash1(th * 1.9) < 0.5 ? 1 : -1), d = age * 2600; lines.seg(c[0] + Math.cos(an) * d * 0.5, c[1] + Math.sin(an) * d * 0.5, c[0] + Math.cos(an) * d, c[1] + Math.sin(an) * d, 3, 1.6 * I, COL.pale, 1, 0.3 * I, COL.gold); }
        const sc = kind === 2 ? [1.0, 0.25, 0.12] : pass ? [1.0, 0.55, 0.3] : COL.pale;
        dots.add(c[0], c[1], (kind === 2 ? 60 : 26) + 190 * age, (kind === 2 ? 4 : 2.6) * Math.exp(-age / 0.12), sc);
        for (let j = 0; j < 9; j++) { const an = hash1(th * 5 + j * 1.7) * TAU, d = age * (240 + 620 * hash1(th * 2 + j * 4.1)); dots.add(c[0] + Math.cos(an) * d, c[1] + Math.sin(an) * d + 260 * age * age, 3.2, 2.0 * Math.exp(-age / (0.2 + 0.25 * hash1(j + th))), sc); }
      }
      if (wi === 1 && t > 48.0 && t < 49.6) { const c = pr(v3.lerp(pts[22].a, pts[23].a, 0.5)), a = t - 48.85; dots.add(c[0], c[1], 60 + 200 * Math.abs(a), 3.2 * Math.exp(-Math.abs(a) / 0.16), COL.pale); }   // 傷がふさがる光
      if (wi === 3) for (let g = 0; g < NG; g++) { const a = t - (93.45 + (g / NG) * 2.1 + 0.42); if (a < 0 || a > 0.5) continue; const c = pr(v3.lerp(pts[Math.min(NBP - 1, g * 3 + 1)].a, pts[Math.min(NBP - 1, g * 3 + 1)].b, 0.5)); dots.add(c[0], c[1], 50 + 180 * a, 2.6 * Math.exp(-a / 0.1), COL.soul); }
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 }); dots.flush('add', { gauss: 1 });
      const env1 = shoutEnv(t), f = env.frame;
      const sh = 0.0025 * env1 + 0.004 * HITS.reduce((m, [th, , k]) => Math.max(m, (k === 2 ? 2.5 : 0.6) * pulse(t, th, 0.15)), 0) + (wi === 2 ? 0.008 * pulse(t, 73.32, 0.4) : 0);
      p.shake = [noise1(f * 0.83, 41) * sh, noise1(f * 0.91, 42) * sh];
      p.flash = 0.5 * pulse(t, win[0], 0.1) + (wi === 1 ? 0.5 * pulse(t, 46.0, 0.08) + 0.3 * pulse(t, 48.85, 0.12) : 0);
      p.bloom = 0.66; p.threshold = 0.7; p.vignette = 0.66; p.ca = 0.009 + 0.012 * env1;
      p.fade = wi === 2 ? 1 - sm(74.5, 75.35, t) : 1;
    },
  };
  return [cellLayer, dnaLayer];
}
