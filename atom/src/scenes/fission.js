// fission.js — 1 章「分裂」。ウラン 235 の原子核に中性子が 1 個飛びこみ、核が 2 つに割れる。
// 核子（陽子 92・中性子 143 ＋ 飛びこむ 1 個）を 1 つずつ球で描く。割れたあとは バリウム 141 と クリプトン 92、中性子 3 個。
import { T, W, H, COL, sat, smoothstep, ease, lerp, mulberry32, TAU, pulse } from '../core.js';
import { Spheres, Dots, camera, chap, narr, sub, label, source } from '../kit.js';
import { Lines } from '../../../film/src/lines.js';
import { shared } from '../../../film/src/scenes/shared.js';
import { equation } from '../../../film/src/overlay.js';

const N = 236, NB = 92, NFREE = 3;            // 全核子、軽い破片（Kr-92）、飛び出す中性子
const T_FIRE = 24.7, T_ABSORB = 27.25;        // 中性子が出る／核に入る
const RN = 0.152;                             // 核子の半径（核の半径 = 1）

// 単位球の中に N 個を詰める（乱数で置いて、押し合わせてならす）
// 半径 R の球の中で、点どうしを押し合わせてならす
function relax(P, R, iters) {
  const n = P.length, d0 = 2 * R * Math.cbrt(0.64 / n);    // 目標の最近接距離
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = P[i], b = P[j], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz) || 1e-6;
      if (d < d0) { const k = (d0 - d) / d * 0.5; a[0] -= dx * k; a[1] -= dy * k; a[2] -= dz * k; b[0] += dx * k; b[1] += dy * k; b[2] += dz * k; }
    }
    for (const p of P) { const r = Math.hypot(p[0], p[1], p[2]); if (r > R) { const k = R / r; p[0] *= k; p[1] *= k; p[2] *= k; } }
  }
  return P;
}
function pack(n, seed) {
  const rng = mulberry32(seed), P = [];
  for (let i = 0; i < n; i++) { let x, y, z; do { x = rng() * 2 - 1; y = rng() * 2 - 1; z = rng() * 2 - 1; } while (x * x + y * y + z * z > 1); P.push([x, y, z]); }
  return relax(P, 0.86, 90);
}

function build() {
  const rng = mulberry32(2351);
  const base = pack(N, 92).sort((a, b) => a[0] - b[0]);     // x の小さい順（左から）
  // 左の 92 個 = Kr、境目の 3 個 = 飛び出す中性子、右の 141 個 = Ba
  const grp = base.map((_, i) => (i < NB ? 1 : i < NB + NFREE ? 2 : 0));        // 0: Ba, 1: Kr, 2: free
  const proton = new Array(N).fill(false);
  const pick = (idx, k) => { const a = idx.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } a.slice(0, k).forEach((i) => (proton[i] = true)); };
  pick([...Array(NB).keys()].slice(1), 36);                                     // Kr: 陽子 36（0 番は飛びこんでくる中性子）
  pick([...Array(N).keys()].slice(NB + NFREE), 56);                             // Ba: 陽子 56
  const x0 = (base[NB][0] + base[NB + NFREE - 1][0]) / 2;                       // 割れ目の位置
  const jig = base.map(() => [5 + 4 * rng(), 5 + 4 * rng(), 5 + 4 * rng(), rng() * TAU, rng() * TAU, rng() * TAU]);
  // 割れる直前の形（のびて、くびれる）
  const deform = (b, s) => {
    const el = 0.07 * Math.sin(TAU * 2.2 * s) * (0.35 + 0.65 * s) + 0.62 * s * s * s;
    const neck = 1 - 0.80 * Math.pow(s, 4) * Math.exp(-Math.pow((b[0] - x0) / 0.36, 2));
    const k = neck / Math.sqrt(1 + el);
    return [(b[0] - x0) * (1 + el) + x0, b[1] * k, b[2] * k];
  };
  const P1 = base.map((b) => deform(b, 1));
  // 破片ごと: 重心、まるめたあとの位置（向きはそのまま、中心からの順位で半径を決める）
  const frag = [0, 1].map((gi) => {
    const idx = []; grp.forEach((v, i) => { if (v === gi) idx.push(i); });
    const c = [0, 0, 0]; idx.forEach((i) => { c[0] += P1[i][0]; c[1] += P1[i][1]; c[2] += P1[i][2]; }); c[0] /= idx.length; c[1] /= idx.length; c[2] /= idx.length;
    const R = Math.cbrt(idx.length / N) * 0.86;
    const rel = idx.map((i) => [P1[i][0] - c[0], P1[i][1] - c[1], P1[i][2] - c[2]]);
    const order = rel.map((v, k) => [Math.hypot(v[0], v[1], v[2]), k]).sort((a, b) => a[0] - b[0]);
    const ball = new Array(idx.length);
    order.forEach(([d, k], rank) => { const r = R * Math.cbrt((rank + 0.5) / idx.length) / (d || 1); ball[k] = [rel[k][0] * r, rel[k][1] * r, rel[k][2] * r]; });
    relax(ball, R, 60);
    return { idx, c, rel, ball, n: idx.length };
  });
  const freeDir = [[0.50, 0.84, -0.2], [0.80, -0.58, 0.15], [-0.42, -0.86, 0.25]].map((d) => { const l = Math.hypot(...d); return d.map((v) => v / l); });
  return { base, grp, proton, x0, jig, deform, P1, frag, freeDir };
}

export const id = 'fission';
export async function create(env) {
  const { g, ov } = env;
  const M = build();
  const sph = new Spheres(env, 512), dots = new Dots(env, 512), lines = new Lines(g, 2048);
  const bg = shared(env);

  // 時刻 → 核子の位置（世界座標）と破片の中心
  function state(t) {
    const pos = new Array(N), tau = t - T.split;
    const roll = 0.42 * t, cr = Math.cos(roll), sr = Math.sin(roll);
    const hot = smoothstep(T_ABSORB, T_ABSORB + 0.25, t);
    const amp = 0.022 + 0.035 * hot * (tau < 0 ? 1 : Math.exp(-tau / 1.5));
    const rotx = (p) => [p[0], p[1] * cr - p[2] * sr, p[1] * sr + p[2] * cr];
    const cA = [0, 0, 0], cB = [0, 0, 0], free = [];
    let S = 0;
    if (tau >= 0) {
      S = 3.5 * (1 - Math.exp(-tau / 0.55)) + 0.12 * tau;
      const dA = (NB / (N - NFREE)) * S, dB = ((N - NFREE - NB) / (N - NFREE)) * S;
      cA[0] = M.frag[0].c[0] + dA; cB[0] = M.frag[1].c[0] - dB;
      for (const [gi, c] of [[0, cA], [1, cB]]) {
        const F = M.frag[gi], k = ease.outCubic(sat(tau / 0.7));
        const ring = 1 + 0.16 * Math.exp(-tau / 0.6) * Math.cos(TAU * 2.6 * tau + gi);
        F.idx.forEach((i, j) => {
          const a = F.rel[j], b = F.ball[j];
          pos[i] = [c[0] + lerp(a[0], b[0], k) * ring, F.c[1] * (1 - k) + lerp(a[1], b[1], k) / Math.sqrt(ring), F.c[2] * (1 - k) + lerp(a[2], b[2], k) / Math.sqrt(ring)];
        });
      }
      for (let k = 0; k < NFREE; k++) { const i = NB + k, d = M.freeDir[k], sp = 8.5 + 1.2 * k; pos[i] = [M.P1[i][0] + d[0] * sp * tau, M.P1[i][1] + d[1] * sp * tau, M.P1[i][2] + d[2] * sp * tau]; free.push(i); }
    } else {
      const s = sat((t - T_ABSORB) / (T.split - T_ABSORB));
      for (let i = 0; i < N; i++) pos[i] = M.deform(M.base[i], s);
    }
    // 飛びこんでくる中性子（0 番）: 左から一直線に
    const u = sat((t - T_FIRE) / (T_ABSORB - T_FIRE));
    const inFlight = t < T_ABSORB;
    if (inFlight) pos[0] = [lerp(-5.6, M.base[0][0], u), lerp(0.55, M.base[0][1], u), lerp(0, M.base[0][2], u)];
    for (let i = 0; i < N; i++) {
      const j = M.jig[i], isFree = tau >= 0 && M.grp[i] === 2;
      let p = pos[i];
      if (!isFree && !(i === 0 && inFlight)) {
        p = [p[0] + amp * Math.sin(t * j[0] + j[3]), p[1] + amp * Math.sin(t * j[1] + j[4]), p[2] + amp * Math.sin(t * j[2] + j[5])];
        // 破片は自分の中心のまわりで回る（軸は割れる方向 = x）
        if (tau >= 0) { const c = M.grp[i] === 0 ? cA : cB; const q = rotx([p[0] - c[0], p[1], p[2]]); p = [q[0] + c[0], q[1], q[2]]; } else p = rotx(p);
      }
      pos[i] = p;
    }
    return { pos, cA, cB, tau, inFlight, S };
  }
  const cam = (t) => {
    const back = ease.inOutCubic(sat((t - T.split + 0.15) / 2.2));
    const z = lerp(7.6, 10.2, back) - 0.5 * ease.outCubic(sat((t - T.nucleus) / 6));
    return camera({ pos: [lerp(0.0, -0.42, back), 0.15, -z], target: [lerp(0, -0.42, back), 0, 0], fov: 0.6 });
  };

  // ---- 文字
  chap(ov, { n: 1, kanji: '分裂', en: 'FISSION', t0: T.nucleus + 0.3, t1: T.chain - 0.1 });
  label(ov, { html: '<span style="font-size:40px;letter-spacing:.14em">ウラン 235</span><small style="font-size:25px;line-height:44px">陽子 <span class="n">92</span>　中性子 <span class="n">143</span></small>', t0: T.nucleus + 1.2, t1: T_ABSORB + 0.3, x: 1290, y: 420 });
  ov.add({
    t0: T.nucleus + 1.9, t1: T_ABSORB + 0.3, className: 'lbl', style: { left: '1292px', top: '540px', fontSize: '24px' },
    html: '<span style="display:inline-block;width:15px;height:15px;border-radius:50%;background:#ff6a3d;margin-right:12px"></span>陽子<span style="display:inline-block;width:15px;height:15px;border-radius:50%;background:#9db2c8;margin:0 12px 0 30px"></span>中性子',
    update(el, tl) { el.style.opacity = (Math.min(smoothstep(0, 0.6, tl), 1 - smoothstep(T_ABSORB - T.nucleus - 1.9 - 0.1, T_ABSORB - T.nucleus - 1.6, tl)) * 0.9).toFixed(4); },
  });
  label(ov, { html: '中性子', t0: T_FIRE + 0.5, t1: T_ABSORB - 0.35, x: 330, y: 318, align: 'c' });
  narr(ov, { text: 'ウランの原子核は、大きすぎて<b>不安定</b>だ。', t0: T.nucleus + 0.7, t1: T_FIRE - 0.15 });
  narr(ov, { text: 'そこへ中性子が 1 個、飛びこむと——', t0: T_FIRE + 0.1, t1: T.split - 0.1 });
  narr(ov, { text: '核は 2 つに割れ、<em>熱</em>と、2〜3 個の中性子が飛び出す。', t0: T.split + 0.55, t1: T.split + 5.0 });
  narr(ov, { text: '割れた破片は、強い<em>放射能</em>をもつ。', t0: T.split + 5.25, t1: T.s1end + 0.3 });
  sub(ov, { text: '核分裂生成物 — ヨウ素 131、セシウム 137、ストロンチウム 90 など、数百種類', t0: T.split + 5.9, t1: T.s1end + 0.3, y: 962 });
  equation(ov, { src: ['{}^{235}\\mathrm{U}+n\\;\\longrightarrow\\;{}^{141}\\mathrm{Ba}+{}^{92}\\mathrm{Kr}+3\\,n', '\\Delta E\\approx 200\\ \\mathrm{MeV}'], t0: T.split + 0.9, t1: T.s1end + 0.3, right: 96, y: 70, size: 36, align: 'right' });
  // 破片の名前は、破片について動く
  const follow = (html, which, t0, t1, rad) => ov.add({
    t0, t1, className: 'lbl c', html,
    update(el, tl, t) {
      const st = state(t), pr = cam(t), c = pr(which === 0 ? st.cA : st.cB);
      el.style.left = c[0].toFixed(1) + 'px'; el.style.top = (c[1] + rad * c[2] + 30).toFixed(1) + 'px';
      el.style.opacity = Math.min(smoothstep(0, 0.6, tl), 1 - smoothstep(t1 - t0 - 0.4, t1 - t0, tl)).toFixed(4);
    },
  });
  follow('バリウム 141<small>陽子 56　中性子 85</small>', 0, T.split + 1.5, T.s1end + 0.3, 0.80);
  follow('クリプトン 92<small>陽子 36　中性子 56</small>', 1, T.split + 1.7, T.s1end + 0.3, 0.70);

  return {
    id: 'fission', t0: T.nucleus, t1: T.chain,
    render(env, tl, t) {
      const p = env.p, st = state(t), pr = cam(t), tau = st.tau;
      bg.bg([0.004, 0.011, 0.030], [0.0006, 0.0012, 0.0040], [W / 2, H / 2], 0.95);
      const appear = ease.outCubic(sat(tl / 1.4));
      const out = 1 - smoothstep(T.s1end - 0.1, T.chain, t);
      // 核のまわりのうっすらした光
      const c0 = pr([0, 0, 0]);
      dots.begin();
      if (tl < 1.3) dots.add(W / 2, H / 2, 1100, 2.6 * Math.pow(1 - sat(tl / 1.3), 2.2), [0.25, 0.62, 1.0]);                // 序章の青い光の名残
      if (tau < 0) dots.add(c0[0], c0[1], 2.3 * c0[2], 0.055 * appear * (1 + 2.5 * smoothstep(T_ABSORB, T.split, t)), COL.blue);
      else {
        for (const [c, n] of [[st.cA, 141], [st.cB, 92]]) { const q = pr(c); dots.add(q[0], q[1], 1.7 * q[2] * Math.cbrt(n / 236), 0.10 * out + 0.5 * Math.exp(-tau / 0.5), COL.amber); }
        dots.add(c0[0], c0[1], (2.0 + 14 * tau) * c0[2], 3.2 * Math.exp(-tau / 0.16), [1.0, 0.85, 0.6]);     // 割れた瞬間の光
      }
      dots.flush('add', { gauss: 1 });

      // 中性子の航跡・ガンマ線
      lines.begin();
      const trail = (i, len, col, gain) => {
        const a = pr(st.pos[i]); let dir;
        if (i === 0) dir = [-1, 0.07, 0]; else { const d = M.freeDir[i - NB]; dir = [-d[0], -d[1], -d[2]]; }
        const b = pr([st.pos[i][0] + dir[0] * len, st.pos[i][1] + dir[1] * len, st.pos[i][2] + dir[2] * len]);
        lines.seg(a[0], a[1], b[0], b[1], RN * a[2] * 0.85, gain, col, 1, 0, col);
      };
      if (st.inFlight && t > T_FIRE) trail(0, 1.5, COL.cyan, 0.7);
      if (tau >= 0) {
        for (let k = 0; k < NFREE; k++) trail(NB + k, Math.min(3.6, 9 * tau), COL.cyan, 0.8 * out);
        const rr = mulberry32(5);
        for (let k = 0; k < 14; k++) {          // ガンマ線: 細い光の筋が一瞬だけ走る
          const a = rr() * TAU, r0 = (0.6 + 26 * tau) * c0[2], r1 = r0 + (1.2 + 2.5 * rr()) * c0[2], gI = 2.0 * Math.exp(-tau / 0.22) * (0.4 + 0.6 * rr());
          lines.seg(c0[0] + Math.cos(a) * r0, c0[1] + Math.sin(a) * r0, c0[0] + Math.cos(a) * r1, c0[1] + Math.sin(a) * r1, 1.6, gI, [1.0, 0.9, 0.7]);
        }
      }
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 });

      // 核子
      sph.begin();
      let zmin = 1e9, zmax = -1e9;
      const Q = st.pos.map((w) => pr(w));
      for (let i = 1; i < N; i++) { zmin = Math.min(zmin, Q[i][3]); zmax = Math.max(zmax, Q[i][3]); }
      const heat = tau < 0 ? 0.25 * smoothstep(T_ABSORB, T.split, t) : 0.10 + 0.9 * Math.exp(-tau / 0.5);
      for (let i = 0; i < N; i++) {
        if (i === 0 && t < T_FIRE) continue;
        const q = Q[i], isFree = (i === 0 && st.inFlight) || (tau >= 0 && M.grp[i] === 2);
        const col = M.proton[i] ? COL.proton : COL.neutron;
        const depth = isFree ? 1 : lerp(1.0, 0.42, sat((q[3] - zmin) / Math.max(zmax - zmin, 1e-3)));
        const sc = i === 0 && st.inFlight ? 1 : appear;
        sph.add(q[0], q[1], RN * q[2] * (0.6 + 0.4 * sc), q[3], col, depth * sc, isFree ? 0.9 : heat * (M.proton[i] ? 0.5 : 0.25));
      }
      sph.flush({ light: [-0.5, 0.62, 0.6], amb: 0.20, rim: 0.30, spec: 0.5 });

      p.bloom = 0.62; p.threshold = 0.72; p.vignette = 0.62; p.ca = 0.008;
      p.flash = tau >= 0 ? 0.5 * Math.exp(-tau / 0.10) : 0.35 * Math.pow(1 - sat(tl / 0.5), 2);
      p.tint = [1, 1, 1];
      p.fade = out;
      if (tau >= 0 && tau < 0.5) { const k = 0.004 * Math.exp(-tau / 0.12); p.shake = [k * Math.sin(tau * 90), k * Math.cos(tau * 71)]; }
    },
  };
}
