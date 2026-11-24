// chain.js — 2 章「連鎖」。飛び出した中性子が次の核を割り、1 → 2 → 4 → … と増える。制御棒が中性子を吸い、「1 回が次の 1 回」に保つ（臨界）。
// 反応は前もって計算した「台本」（どの核が、いつ、どの中性子で割れるか）どおりに進む。乱数は種を固定してある。
import { T, W, H, COL, sat, smoothstep, ease, lerp, clamp, mulberry32, TAU } from '../core.js';
import { Spheres, Dots, Layer2D, camera, chap, narr, label, fadeEl, rr } from '../kit.js';
import { Lines } from '../../../film/src/lines.js';
import { shared } from '../../../film/src/scenes/shared.js';

const RODS = [-6, -2, 2, 6], LAYERS = [0, 1.05, 2.2, 3.3], ROD_Z = 1.6;
const T_IN = 39.2, T_FIRST = 40.6;            // 最初の中性子が入る／最初の分裂
const GEN = [40.6, 43.0, 45.0, 46.8, 48.4, 49.8, 51.0];   // 世代が替わるおよその時刻（1, 2, 4, …, 64）
const REUSE = 2.6;                            // 割れた場所に、新しい核が現れるまで（燃料はいくらでもある、という約束ごと）
const ROD_IN = 3.0;                           // 制御棒が入りきるまで

function simulate() {
  const rng = mulberry32(20110311);
  const sites = [];
  LAYERS.forEach((z, li) => { for (let x = -9; x <= 9; x++) { if (RODS.includes(x)) continue; for (let y = -5; y <= 5; y++) sites.push({ p: [x + rng.range(-0.24, 0.24), y + rng.range(-0.24, 0.24), z + rng.range(-0.2, 0.2)], layer: li, f: [], busy: -1, spin: rng() * TAU, ax: rng() * TAU }); } });
  const neutrons = [], fissions = [];
  const kAt = (t) => (t < 51.6 ? 2 : t < T.control + 0.5 ? 1.12 : t < T.control + 5.3 ? 0.68 : 1);
  const dtAt = (t) => clamp(2.4 - 0.13 * (t - T_FIRST), 1.2, 2.4);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] - b[2]) * 0.6);
  const pickTarget = (src, tArr) => {
    for (const rmax of [3.2, 4.6, 7, 12]) {
      const c = sites.filter((s) => s.busy < tArr - 0.4 && Math.abs(s.p[0]) < 7.4 && Math.abs(s.p[1]) < 4.3 && dist(s.p, src) > 1.15 && dist(s.p, src) < rmax);
      if (c.length) return c[Math.floor(rng() * c.length)];
    }
    return null;
  };
  // 最初の 1 個: 画面の左から入ってきて、左寄りの核にあたる
  const s0 = sites.reduce((best, s) => (s.layer === 0 && Math.hypot(s.p[0] + 4.4, s.p[1] - 0.3) < Math.hypot(best.p[0] + 4.4, best.p[1] - 0.3) ? s : best), sites[0]);
  neutrons.push({ t0: T_IN, a: [-12.5, s0.p[1] + 0.9, 0], t1: T_FIRST, b: s0.p, kind: 'hit' });
  const queue = [{ t: T_FIRST, site: s0 }]; s0.busy = T_FIRST + REUSE;
  while (queue.length) {
    queue.sort((a, b) => a.t - b.t);
    const ev = queue.shift();
    if (ev.t > T.fuel + 0.5) break;
    ev.site.f.push(ev.t); fissions.push(ev.t);
    const k = kAt(ev.t), dt = dtAt(ev.t), nEmit = rng() < 0.4 ? 3 : 2;
    let nHit = k >= 2 ? 2 : k > 1 ? 1 + (rng() < k - 1 ? 1 : 0) : rng() < k ? 1 : 0;
    nHit = Math.min(nHit, nEmit);
    for (let i = 0; i < nEmit; i++) {
      if (i < nHit) {
        const t1 = ev.t + dt * rng.range(0.86, 1.14), tg = pickTarget(ev.site.p, t1);
        if (tg) { tg.busy = t1 + REUSE; neutrons.push({ t0: ev.t, a: ev.site.p, t1, b: tg.p, kind: 'hit' }); queue.push({ t: t1, site: tg }); continue; }
      }
      // あたらなかった中性子: 制御棒が入っていれば、いちばん近い棒に吸われる。なければ、どこかへ飛び去る
      const rodsIn = sat((ev.t - T.control) / ROD_IN), a = ev.site.p;
      if (rodsIn > 0.25 && rng() < 0.85) {
        const rx = RODS.reduce((b, x) => (Math.abs(x - a[0]) < Math.abs(b - a[0]) ? x : b), RODS[0]);
        const yEnd = Math.min(a[1] + rng.range(-1.6, 1.6), rodTop(ev.t + 0.5) - 0.2);
        const b = [rx + (a[0] > rx ? 0.2 : -0.2), yEnd, ROD_Z], d = dist(a, b);
        neutrons.push({ t0: ev.t, a, t1: ev.t + clamp(d / 3.2, 0.35, 1.3), b, kind: 'rod' });
      } else {
        const ang = rng() * TAU, len = rng.range(3.5, 6.5);
        neutrons.push({ t0: ev.t, a, t1: ev.t + rng.range(1.0, 1.6), b: [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len, a[2] + rng.range(-1.5, 1.5)], kind: 'lost' });
      }
    }
  }
  // 毎秒の分裂数（なめらかにした曲線）
  const rate = []; const R0 = 38, RS = 0.1;
  for (let i = 0; i <= (T.fuel - R0) / RS; i++) { const t = R0 + i * RS; let s = 0; for (const f of fissions) { const d = (f - t) / 0.55; if (d > -4 && d < 4) s += Math.exp(-0.5 * d * d); } rate.push(s / (0.55 * Math.sqrt(TAU))); }
  const rateAt = (t) => { const x = clamp((t - R0) / RS, 0, rate.length - 1.001), i = Math.floor(x); return lerp(rate[i], rate[i + 1], x - i); };
  return { sites, neutrons, fissions, rateAt, R0, rmax: Math.max(...rate) };
}
const rodTop = (t) => lerp(-8.5, 1.6, ease.inOutCubic(sat((t - T.control) / ROD_IN)));

// 核 1 個を 4 つの球であらわす（正四面体の頂点。陽子 2・中性子 2 に見える色）
const TET = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map((v) => v.map((c) => c * 0.085));

export const id = 'chain';
export async function create(env) {
  const { g, ov } = env;
  const S = simulate();
  const far = new Spheres(env, 4096), near = new Spheres(env, 4096), dots = new Dots(env, 4096), lines = new Lines(g, 4096), rodsL = new Layer2D(env);
  const bg = shared(env);
  const cam = (t) => { const u = sat((t - T.chain) / (T.fuel - T.chain)); return camera({ pos: [lerp(-0.9, 0.9, u), 0.25, lerp(-10.2, -11.6, u)], target: [lerp(-0.5, 0.5, u), 0, 1.2], fov: 0.6 }); };

  chap(ov, { n: 2, kanji: '連鎖', en: 'CHAIN REACTION', t0: T.chain + 0.3, t1: T.fuel - 0.15 });
  narr(ov, { text: 'ウラン235が 1 グラム分裂すると、\n石炭 3 トンを燃やしたのと同じ熱が出る。', t0: T.chain + 0.4, t1: 43.5 });
  narr(ov, { text: '飛び出した中性子が、次の原子核を割る。', t0: 43.8, t1: T.grow - 0.15 });
  narr(ov, { text: '1 が 2 に、2 が 4 に。——<b>連鎖反応</b>。', t0: T.grow + 0.2, t1: 52.5 });
  narr(ov, { text: '放っておけば、反応は際限なく速くなる。', t0: 52.8, t1: T.control - 0.15 });
  narr(ov, { text: 'そこで<b>制御棒</b>。中性子を吸い取り、反応を抑える。', t0: T.control + 0.5, t1: 63.5 });
  narr(ov, { text: '1 回の分裂が、次のちょうど 1 回を生む。\nこの釣り合いを<b>臨界</b>という。', t0: 63.9, t1: 70.0 });
  narr(ov, { text: '原子炉は、この状態を保って運転される。', t0: 70.3, t1: T.s2end + 0.3 });
  // 倍々の数字
  ov.add({
    t0: T_FIRST - 0.2, t1: T.control + 0.6, className: 'big', style: { left: '0', right: '0', top: '742px', textAlign: 'center' },
    html: [1, 2, 4, 8, 16, 32, 64].map((n, i) => `<span style="display:inline-block;font-family:var(--display);font-weight:200;font-size:${58 + i * 5}px;margin:0 22px;font-feature-settings:'tnum' 1">${n}</span>`).join('<span style="color:rgba(238,241,244,.35);font-size:28px">›</span>'),
    update(el, tl, t) {
      const out = 1 - smoothstep(T.control - 0.2, T.control + 0.5, t);
      const hide = smoothstep(43.3, 43.6, t) * (1 - smoothstep(43.6, 44.0, t));      // 語りの入れ替わりで一瞬ひかえる
      [...el.children].forEach((sp, j) => { const i = Math.floor(j / 2), tg = GEN[j % 2 ? i + 1 : i], a = ease.outCubic(sat((t - tg) / 0.5)); sp.style.opacity = (a * out * (1 - 0.0 * hide)).toFixed(4); if (j % 2 === 0) sp.style.transform = `translateY(${((1 - a) * 10).toFixed(2)}px) scale(${(1 + 0.25 * Math.exp(-Math.max(t - tg, 0) / 0.25) * (t >= tg ? 1 : 0)).toFixed(4)})`; });
    },
  });
  // グラフの注記
  const GX = 1330, GY = 96, GW = 494, GH = 250;
  label(ov, { html: '1 秒あたりの核分裂', t0: T.grow - 1.0, t1: T.fuel - 0.3, x: GX, y: GY - 18, size: 23 });
  label(ov, { html: '<b>臨界</b><small>増えも、減りもしない</small>', t0: T.control + 8.2, t1: T.fuel - 0.3, x: GX + GW - 8, y: GY + GH - 150, align: 'r' });
  // 制御棒の名札（棒の頭について動く）
  ov.add({
    t0: T.control + 1.6, t1: T.fuel - 0.3, className: 'lbl', html: '制御棒<small>中性子を吸収する</small>',
    update(el, tl, t) {
      const q = cam(t)([RODS[1] + 0.35, rodTop(t) - 0.15, ROD_Z]);
      el.style.left = (q[0] + 14).toFixed(1) + 'px'; el.style.top = (q[1] - 6).toFixed(1) + 'px';
      el.style.opacity = Math.min(smoothstep(0, 0.6, tl), 1 - smoothstep(T.fuel - T.control - 2.4, T.fuel - T.control - 1.9, tl)).toFixed(4);
    },
  });

  return {
    id: 'chain', t0: T.chain, t1: T.fuel,
    render(env, tl, t) {
      const p = env.p, pr = cam(t);
      const rate = S.rateAt(t), heat = sat(rate / 70);
      bg.bg([0.004 + 0.030 * heat, 0.011 + 0.008 * heat, 0.030], [0.0006, 0.0012, 0.0040], [W / 2, H / 2], 1.0);
      const fadeIn = smoothstep(0, 1.2, tl), fadeOut = 1 - smoothstep(T.s2end - 0.2, T.fuel, t);

      // ---- 核（奥の 2 層 → 制御棒 → 手前の層）
      far.begin(); near.begin(); dots.begin();
      const chartA = smoothstep(T.grow - 1.0, T.grow, t);
      for (const s of S.sites) {
        let last = -1e9; for (const f of s.f) { if (f <= t) last = f; else break; }
        const age = t - last;
        const batch = s.layer < 2 ? near : far;
        const c = pr(s.p);
        // 文字とグラフの後ろでは、核をひかえめにする
        const quiet = (1 - 0.85 * smoothstep(660, 830, c[1])) * (1 - 0.8 * chartA * smoothstep(GX - 90, GX - 10, c[0]) * (1 - smoothstep(GY + GH + 10, GY + GH + 90, c[1])));
        const shade = [0.86, 0.60, 0.40, 0.26][s.layer] * quiet;
        if (c[0] < -80 || c[0] > W + 80 || c[1] < -80 || c[1] > H + 80) continue;
        const fresh = age > REUSE ? smoothstep(REUSE, REUSE + 0.7, age) : age < 0 ? 1 : 0;
        if (fresh > 0) {
          const a = s.spin + 0.5 * t, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(s.ax), sb = Math.sin(s.ax);
          for (let k = 0; k < 4; k++) {
            const v = TET[k]; let x = v[0] * ca - v[2] * sa, z = v[0] * sa + v[2] * ca, y = v[1] * cb - z * sb; z = v[1] * sb + z * cb;
            const q = pr([s.p[0] + x, s.p[1] + y, s.p[2] + z]);
            batch.add(q[0], q[1], 0.105 * q[2] * fresh, q[3], k < 2 ? COL.proton : COL.neutron, shade, 0);
          }
        }
        if (age >= 0 && age < REUSE) {
          // 割れた瞬間の光と、残る破片（核分裂生成物）
          const fl = Math.exp(-age / 0.13);
          if (fl > 0.01) dots.add(c[0], c[1], (0.22 + 0.9 * sat(age / 0.4)) * c[2], 2.2 * fl * shade, [1.0, 0.72, 0.36]);
          const sep = 0.20 * ease.outCubic(sat(age / 0.6)), dim = (1 - smoothstep(REUSE - 1.0, REUSE - 0.2, age));
          for (const sg of [-1, 1]) {
            const q = pr([s.p[0] + sg * sep * Math.cos(s.spin), s.p[1] + sg * sep * Math.sin(s.spin), s.p[2]]);
            batch.add(q[0], q[1], (sg < 0 ? 0.075 : 0.09) * q[2] * (0.4 + 0.6 * dim), q[3], [0.55, 0.20, 0.06], shade * dim, (0.25 + 1.6 * Math.exp(-age / 0.5)) * dim);
          }
        }
      }
      far.flush({ amb: 0.22, rim: 0.3, spec: 0.35 });

      // ---- 制御棒
      const top = rodTop(t);
      if (top > -8.4) {
        const c = rodsL.begin();
        for (const x of RODS) {
          const a = pr([x - 0.24, top, ROD_Z]), b = pr([x + 0.24, -9, ROD_Z]);
          const grd = c.createLinearGradient(a[0], 0, b[0], 0);
          grd.addColorStop(0, '#0b1420'); grd.addColorStop(0.35, '#2a3c50'); grd.addColorStop(0.6, '#1a2838'); grd.addColorStop(1, '#070c14');
          c.fillStyle = grd; rr(c, a[0], a[1], b[0] - a[0], b[1] - a[1] + 40, (b[0] - a[0]) * 0.45); c.fill();
          c.strokeStyle = 'rgba(120,175,230,0.55)'; c.lineWidth = 1.6; c.stroke();
        }
        rodsL.flush('alpha', 1, fadeOut);
      }
      near.flush({ amb: 0.22, rim: 0.3, spec: 0.35 });

      // ---- 中性子
      lines.begin();
      for (const n of S.neutrons) {
        if (t < n.t0 || t > n.t1 + 0.35) continue;
        const u = sat((t - n.t0) / (n.t1 - n.t0));
        const pos = [lerp(n.a[0], n.b[0], u), lerp(n.a[1], n.b[1], u), lerp(n.a[2], n.b[2], u)];
        const q = pr(pos);
        let I = 1;
        if (n.kind === 'lost') I = 1 - smoothstep(0.55, 1, u);
        if (t > n.t1) {                         // 制御棒に吸われた: 小さな青い光が消える
          if (n.kind === 'rod') dots.add(q[0], q[1], 0.22 * q[2], 1.2 * (1 - (t - n.t1) / 0.35), COL.blue);
          continue;
        }
        const tail = 0.10 + 0.09 * Math.min(1, (t - n.t0) / 0.3);
        const u0 = Math.max(0, u - tail), q0 = pr([lerp(n.a[0], n.b[0], u0), lerp(n.a[1], n.b[1], u0), lerp(n.a[2], n.b[2], u0)]);
        lines.seg(q[0], q[1], q0[0], q0[1], 0.07 * q[2], 0.85 * I, COL.cyan, 1, 0, COL.blue);
        dots.add(q[0], q[1], 0.055 * q[2], 2.2 * I, COL.ice);
        dots.add(q[0], q[1], 0.16 * q[2], 0.35 * I, COL.cyan);
      }
      // ---- グラフ（毎秒の核分裂）
      if (t > T.grow - 1.0) {
        const ga = smoothstep(T.grow - 1.0, T.grow, t) * fadeOut, tA = 40, tB = T.fuel - 0.5, ymax = S.rmax * 1.06;
        const gx = (tt) => GX + ((tt - tA) / (tB - tA)) * GW, gy = (r) => GY + GH - Math.min(r / ymax, 1.02) * (GH - 26);
        lines.seg(GX, GY + GH, GX + GW, GY + GH, 1.5, 0.30 * ga, COL.paper); lines.seg(GX, GY + 14, GX, GY + GH, 1.5, 0.30 * ga, COL.paper);
        const n = 180, pts = new Float32Array((n + 1) * 2); let m = 0;
        for (let i = 0; i <= n; i++) { const tt = tA + ((tB - tA) * i) / n; if (tt > t) break; pts[m * 2] = gx(tt); pts[m * 2 + 1] = gy(S.rateAt(tt)); m++; }
        if (m > 1) {
          lines.poly(pts, m, { w: 3.2, i: 1.25 * ga, col: (j, u) => (S.rateAt(tA + (tB - tA) * (j / n)) > 40 ? COL.amber : COL.cyan) });
          dots.add(pts[(m - 1) * 2], pts[(m - 1) * 2 + 1], 6, 2.5 * ga, COL.white);
        }
        if (t > T.control + 7.5) {             // 臨界の水準（破線）
          const lv = gy(S.rateAt(T.fuel - 4)), da = smoothstep(T.control + 7.5, T.control + 8.5, t) * ga;
          for (let x = GX; x < GX + GW; x += 16) lines.seg(x, lv, x + 8, lv, 1.3, 0.55 * da, COL.blue);
        }
      }
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 });
      dots.flush('add', { gauss: 1 });

      p.bloom = 0.60 + 0.25 * heat; p.threshold = 0.72; p.vignette = 0.6; p.ca = 0.007; p.scrim = 0.6;
      p.fade = fadeIn * fadeOut;
      p.tint = [1 + 0.05 * heat, 1, 1 - 0.06 * heat];
    },
  };
}
