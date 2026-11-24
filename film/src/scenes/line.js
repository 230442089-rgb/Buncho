// line.js — 1 章「線」
// 点が走って線になる → 弦として振動する → 円の連なり（フーリエ級数）が一筆書きの文鳥を描く → その糸がほどけてローレンツ・アトラクタになる
import { bar, BEAT, W, H, sat, smoothstep, ease, lerp, TAU, pulse } from '../core.js';
import { chapter, equation, note } from '../overlay.js';
import { shared, SHU, PAPER, LAYOUT } from './shared.js';
import { Lines } from '../lines.js';
import { BUNCHO_PATH } from '../data/bunchoPath.js';

const B3 = bar(3), B4 = bar(4), B5 = bar(5), B6 = bar(6);
const { lineX0: X0, lineX1: X1, lineY: LY } = LAYOUT;
const PERCH = { x0: 470, x1: 1450, y: 800 };
const BIRD = { s: 212, ox: 978, oy: 800 - 0.74 * 212 };   // 鳥の足が止まり木に乗る
const K = 72;              // 円の数
const M = 1800;            // 軌跡の標本数
const NT = 10000;          // 糸（アトラクタ）の点の数

// ---- 閉じた Catmull-Rom（centripetal）
function catmullClosed(P, per = 28) {
  const n = P.length, out = [], cpIndex = [];
  const tj = (ti, a, b) => ti + Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 1e-6) ** 0.5;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const t0 = 0, t1 = tj(t0, p0, p1), t2 = tj(t1, p1, p2), t3 = tj(t2, p2, p3);
    cpIndex.push(out.length);
    for (let s = 0; s < per; s++) {
      const t = t1 + ((t2 - t1) * s) / per, o = [0, 0];
      for (let c = 0; c < 2; c++) {
        const A1 = ((t1 - t) / (t1 - t0)) * p0[c] + ((t - t0) / (t1 - t0)) * p1[c];
        const A2 = ((t2 - t) / (t2 - t1)) * p1[c] + ((t - t1) / (t2 - t1)) * p2[c];
        const A3 = ((t3 - t) / (t3 - t2)) * p2[c] + ((t - t2) / (t3 - t2)) * p3[c];
        const B1 = ((t2 - t) / (t2 - t0)) * A1 + ((t - t0) / (t2 - t0)) * A2;
        const B2 = ((t3 - t) / (t3 - t1)) * A2 + ((t - t1) / (t3 - t1)) * A3;
        o[c] = ((t2 - t) / (t2 - t1)) * B1 + ((t - t1) / (t2 - t1)) * B2;
      }
      out.push(o);
    }
  }
  return { pts: out, cpIndex };
}
// 弧長で等間隔に取り直す。制御点が全体のどの位置（0..1）に来るかも返す
function resampleClosed(pts, n, cpIndex) {
  const m = pts.length, acc = [0];
  for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % m]; acc.push(acc[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  const total = acc[m], out = new Float64Array(n * 2);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / n) * total;
    while (acc[j + 1] < d) j++;
    const f = (d - acc[j]) / (acc[j + 1] - acc[j] || 1), a = pts[j], b = pts[(j + 1) % m];
    out[i * 2] = a[0] + (b[0] - a[0]) * f; out[i * 2 + 1] = a[1] + (b[1] - a[1]) * f;
  }
  return { out, cpU: cpIndex.map((i) => acc[i] / total) };
}

const FS_FILL = /* glsl */ `uniform vec4 uCol; out vec4 o; void main(){ o = vec4(uCol.rgb * uCol.a, uCol.a); }`;
const VS_FILL = /* glsl */ `layout(location = 0) in vec2 aP; void main(){ gl_Position = vec4(aP.x / uRes.x * 2.0 - 1.0, 1.0 - aP.y / uRes.y * 2.0, 0.0, 1.0); }`;

export const id = 'line';
export async function create(env) {
  const { g, ov } = env;
  const S = shared(env);
  const L = new Lines(g, 14000);
  const pFill = g.programVF(VS_FILL, FS_FILL, 'fill');

  // ---- 文鳥の輪郭 → 画面座標 → フーリエ係数
  const { pts: sp, cpIndex } = catmullClosed(BUNCHO_PATH);
  const scr = sp.map(([x, y]) => [BIRD.ox + BIRD.s * x, BIRD.oy - BIRD.s * y]);
  const N = 1024;
  const { out: path, cpU } = resampleClosed(scr, N, cpIndex);
  const terms = [];
  let c0 = [0, 0];
  for (let k = -N / 2; k < N / 2; k++) {
    let re = 0, im = 0;
    for (let j = 0; j < N; j++) { const a = (-TAU * k * j) / N, c = Math.cos(a), s = Math.sin(a); re += path[j * 2] * c - path[j * 2 + 1] * s; im += path[j * 2] * s + path[j * 2 + 1] * c; }
    re /= N; im /= N;
    if (k === 0) c0 = [re, im]; else terms.push({ k, amp: Math.hypot(re, im), ph: Math.atan2(im, re) });
  }
  terms.sort((a, b) => b.amp - a.amp);
  const T = terms.slice(0, K);
  const evalAt = (phi, upto = K, chain = null) => {
    let x = c0[0], y = c0[1];
    for (let i = 0; i < upto; i++) { const t = T[i], a = t.k * phi + t.ph; if (chain) chain.push(x, y, t.amp); x += t.amp * Math.cos(a); y += t.amp * Math.sin(a); }
    return [x, y];
  };
  const trace = new Float32Array((M + 1) * 2);
  for (let m = 0; m <= M; m++) { const p = evalAt((m / M) * TAU); trace[m * 2] = p[0]; trace[m * 2 + 1] = p[1]; }
  // くちばしの塗り（輪郭の該当区間を三角形の扇にする）
  const beakPts = [];
  const span = (u0, u1) => { const a = Math.round(u0 * M), b = Math.round(u1 * M); const st = a <= b ? 1 : -1; for (let m = a; m !== b + st; m += st) beakPts.push(trace[m * 2], trace[m * 2 + 1]); };
  span(cpU[0], cpU[4]); span(cpU[40], lerp(cpU[38], cpU[39], 0.3));
  const eyeM0 = Math.round(cpU[42] * M), eyeM1 = Math.round(cpU[46] * M);
  let bcx = 0, bcy = 0; const nb = beakPts.length / 2;
  for (let i = 0; i < nb; i++) { bcx += beakPts[i * 2]; bcy += beakPts[i * 2 + 1]; }
  bcx /= nb; bcy /= nb;
  const tri = [];
  for (let i = 0; i < nb; i++) { const j = (i + 1) % nb; tri.push(bcx, bcy, beakPts[i * 2], beakPts[i * 2 + 1], beakPts[j * 2], beakPts[j * 2 + 1]); }
  const beakMesh = g.mesh({ p: { loc: 0, size: 2, data: new Float32Array(tri) } }, { mode: 'TRIANGLES', count: tri.length / 2 });

  // ---- 糸: 文鳥の線上の NT 点 と ローレンツ軌道の NT 点
  const birdT = new Float32Array(NT * 2);
  for (let j = 0; j < NT; j++) { const x = (j / NT) * M, i = Math.floor(x), f = x - i; birdT[j * 2] = lerp(trace[i * 2], trace[i * 2 + 2], f); birdT[j * 2 + 1] = lerp(trace[i * 2 + 1], trace[i * 2 + 3], f); }
  const lor = new Float32Array(NT * 3);
  {
    let x = 0.9, y = 0.3, z = 20.5; const dt = 0.005, sg = 10, rho = 28, beta = 8 / 3;
    const f = (x, y, z) => [sg * (y - x), x * (rho - z) - y, x * y - beta * z];
    const step = () => {
      const k1 = f(x, y, z), k2 = f(x + (k1[0] * dt) / 2, y + (k1[1] * dt) / 2, z + (k1[2] * dt) / 2), k3 = f(x + (k2[0] * dt) / 2, y + (k2[1] * dt) / 2, z + (k2[2] * dt) / 2), k4 = f(x + k3[0] * dt, y + k3[1] * dt, z + k3[2] * dt);
      x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]); z += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    };
    for (let i = 0; i < 3000; i++) step();
    for (let j = 0; j < NT; j++) { step(); lor[j * 3] = x / 23; lor[j * 3 + 1] = (z - 25) / 23; lor[j * 3 + 2] = y / 23; }
  }
  const thread = new Float32Array(NT * 2), depth = new Float32Array(NT);

  // ---- 文字
  chapter(ov, { n: 1, kanji: '線', en: 'LINE', line: '点が動くと、線になる。', t0: B3, t1: B6, lineHold: 3.3 });
  equation(ov, { src: 'y(x,t)=\\displaystyle\\sum_{n} a_n \\sin\\!\\frac{n\\pi x}{L}\\,\\cos\\omega_n t', t0: B3 + 0.9, t1: B4 - 0.05, right: 96, y: 84, size: 27 });
  equation(ov, { src: 'z(t)=\\displaystyle\\sum_{k=-K}^{K} c_k\\,e^{\\,ikt}', t0: B4 + 0.3, t1: B5 - 0.05, right: 96, y: 78, size: 27 });
  note(ov, { text: `${K} 個の円が、一筆書きの鳥を描く`, t0: B4 + 0.7, t1: B5 - 0.05, right: 96, y: 186, align: 'right', size: 16 });
  equation(ov, { src: ['\\dot{x}=\\sigma(y-x)', '\\dot{y}=x(\\rho-z)-y', '\\dot{z}=xy-\\beta z'], t0: B5 + 0.5, t1: B6 - 0.5, right: 96, y: 78, size: 25 });

  // ---- 弦: 拍ごとに 1 倍音・2 倍音・3 倍音、最後に「はじく」
  const OM = TAU / BEAT;
  const kink = []; { const p = 0.22; for (let n = 1; n <= 22; n++) kink.push([n, (2 / (Math.PI * Math.PI * p * (1 - p))) * Math.sin(n * Math.PI * p) / (n * n)]); }
  const PLUCKS = [
    { t: B3 + BEAT, tau: 1.25, amp: 104, modes: [[1, 1]], sin: true },
    { t: B3 + BEAT * 2, tau: 1.0, amp: 84, modes: [[2, 1]], sin: true },
    { t: B3 + BEAT * 3, tau: 0.9, amp: 150, modes: kink, sin: false },
  ];
  const stringY = (s, t) => {
    let y = 0;
    for (const pl of PLUCKS) {
      const dt = t - pl.t; if (dt <= 0) continue;
      const e = pl.amp * Math.exp(-dt / pl.tau) * smoothstep(0, 0.1, dt);
      for (const [n, a] of pl.modes) y += e * a * Math.sin(n * Math.PI * s) * (pl.sin ? Math.sin(n * OM * dt) : Math.cos(n * OM * dt));
    }
    return y * (1 - smoothstep(B4 - 0.05, B4 + 0.3, t));
  };

  const NS = 360, sp2 = new Float32Array((NS + 1) * 2);
  const paper = PAPER(1), shu = SHU(1);

  return {
    id: 'line', t0: B3, t1: B6,
    render(env, tl, t) {
      const p = env.p;
      p.bloom = 0.6; p.ca = 0.004;
      S.bg();
      L.begin();
      const dots = [], rings = [];

      if (t < B5) {
        // ================= 線・弦・止まり木
        const sweep = ease.outQuart(sat((t - B3) / 0.42));
        const pm = ease.inOutCubic(sat((t - B4) / 0.55));
        const x0 = lerp(X0, PERCH.x0, pm), x1 = lerp(X1, PERCH.x1, pm), y0 = lerp(LY, PERCH.y, pm);
        const xe = lerp(x0, x1, sweep);
        const fadeOut = 1 - smoothstep(B5 - 0.12, B5, t);
        const n = Math.max(2, Math.round(NS * sweep));
        for (let i = 0; i <= n; i++) { const s = (i / n) * sweep; sp2[i * 2] = lerp(x0, x1, s); sp2[i * 2 + 1] = y0 - stringY(s, t); }
        const head = 1 - sweep;
        L.poly(sp2, n + 1, { w: lerp(2.4, 2.0, pm), i: (j, u) => (1.25 + 2.2 * head * u * u) * fadeOut * lerp(1, 0.55, pm), col: paper });
        dots.push({ x: x0, y: y0, r: 3.2, i: 1.2 * fadeOut * (1 - pm), col: paper });

        if (t < B4) {
          // 右端の朱の点（拍で脈打つ）
          const b = 0.3 * (pulse(t, B3 + BEAT, 0.14) + pulse(t, B3 + BEAT * 2, 0.14) + pulse(t, B3 + BEAT * 3, 0.14));
          dots.push({ x: xe, y: LY, r: 6.5 * (1 + b), i: 2.5 * (1 + 1.2 * pulse(t, B3, 0.12) + b), col: shu });
        } else {
          // ================= フーリエ円が文鳥を描く
          const tD0 = B4 + 0.44, tD1 = B4 + 2.72;
          const u = sat((t - tD0) / (tD1 - tD0));
          const e = lerp(u, ease.inOutSine(u), 0.55);
          const phi = e * TAU;
          const chain = [];
          const tip = evalAt(phi, K, chain);
          // 点が線の端から跳ねて、描きはじめの位置へ
          const hop = ease.inOutCubic(sat((t - B4) / 0.44));
          const hx = lerp(X1, trace[0], hop), hy = lerp(LY, trace[1], hop) - Math.sin(Math.PI * hop) * 150;
          const pen = t < tD0 ? [hx, hy] : tip;
          // 円と腕
          const ca = smoothstep(B4 + 0.12, B4 + 0.6, t) * (1 - smoothstep(tD1 + 0.02, tD1 + 0.4, t));
          if (ca > 0.001) {
            const nc = K;
            for (let i = 0; i < nc; i++) {
              const cx = chain[i * 3], cy = chain[i * 3 + 1], r = chain[i * 3 + 2];
              const pop = ease.outBack(sat((t - B4 - 0.1 - i * 0.012) / 0.35));
              const nx = i + 1 < nc ? chain[(i + 1) * 3] : tip[0], ny = i + 1 < nc ? chain[(i + 1) * 3 + 1] : tip[1];
              if (i < 18 && r > 2) L.circle(cx, cy, r * pop, { w: 1.2, i: 0.34 * ca * (1 - i / 26), col: paper });
              L.seg(cx, cy, lerp(cx, nx, pop), lerp(cy, ny, pop), 1.3, 0.62 * ca, i === 0 ? shu : paper);
            }
            dots.push({ x: chain[0], y: chain[1], r: 2.6, i: 1.0 * ca, col: paper });
          }
          // 軌跡
          if (t >= tD0) {
            const mf = e * M, mi = Math.floor(mf);
            const done = smoothstep(tD1, tD1 + 0.3, t);
            const cnt = Math.min(M + 1, mi + 1);
            const eyeCol = [lerp(paper[0], shu[0] * 1.5, done), lerp(paper[1], shu[1] * 1.5, done), lerp(paper[2], shu[2] * 1.5, done)];
            if (cnt >= 2) L.poly(trace, cnt, { w: 2.7, i: (j, uu) => 1.3 * (1 + 0.9 * Math.exp(-(mi - j) / 40) * (1 - done)), col: (j) => (j >= eyeM0 && j <= eyeM1 ? eyeCol : paper) });
            if (mi < M) L.seg(trace[mi * 2], trace[mi * 2 + 1], tip[0], tip[1], 2.7, 2.4, paper);
            // 描き終えたら、くちばしに朱が入る
            if (done > 0) {
              g.bind(env.post.hdr);
              g.drawMesh(pFill, beakMesh, { uCol: [...SHU(0.95), done * (1 - smoothstep(B5 - 0.1, B5, t))] }, 'premul');
            }
          }
          const penFade = 1 - smoothstep(tD1 + 0.05, tD1 + 0.35, t);
          dots.push({ x: pen[0], y: pen[1], r: 6.0, i: 2.6 * Math.max(penFade, 0.0), col: shu });
          if (t > tD1) { const uu = (t - tD1) / 0.9; if (uu < 1) rings.push({ x: bcx, y: bcy, r: 20 + 150 * ease.outCubic(uu), w: 1.5, a: 0.9 * Math.pow(1 - uu, 2), col: shu }); }
        }
        L.flushMax(env, { gain: 1 });
      } else {
        // ================= 糸がほどけて、ローレンツ・アトラクタへ
        const tt = t - B5;
        const yaw = 0.55 + 0.62 * tt, pit = 0.22 + 0.08 * Math.sin(tt * 0.7);
        const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), spt = Math.sin(pit);
        const R = 372, D = 5.2;
        const toLine = ease.inOutCubic(sat((t - (B6 - 0.62)) / 0.5));
        for (let j = 0; j < NT; j++) {
          const u = j / NT;
          const X = lor[j * 3], Y = lor[j * 3 + 1], Z = lor[j * 3 + 2];
          const xr = X * cy + Z * sy, zr = -X * sy + Z * cy;
          const yr = Y * cp - zr * spt, zz = Y * spt + zr * cp;
          const ps = D / (D + zz);
          const lx = W / 2 - 40 + R * xr * ps, ly = H / 2 + 8 - R * yr * ps;
          const m = ease.inOutCubic(sat((tt - 0.42 * u) / 0.8));
          let x = lerp(birdT[j * 2], lx, m), y = lerp(birdT[j * 2 + 1], ly, m);
          let dp = lerp(1, sat(0.62 - zz * 0.42), m);
          if (toLine > 0) { const m2 = ease.inOutCubic(sat((toLine * 1.35 - 0.35 * (1 - u)))); x = lerp(x, lerp(-30, W + 30, u), m2); y = lerp(y, LY, m2); dp = lerp(dp, 1, m2); }
          thread[j * 2] = x; thread[j * 2 + 1] = y; depth[j] = dp;
        }
        const head = (0.12 + 0.3 * tt) % 1;
        const mAll = ease.inOutCubic(sat((tt - 0.2) / 0.9));
        const wv = lerp(2.7, 1.5, mAll) + toLine * 0.9, iv = lerp(1.3, 0.62, mAll) + toLine * 0.9;
        L.poly(thread, NT, {
          w: wv,
          i: (j, u) => { let d = head - u; d -= Math.floor(d); return iv * depth[j] * (1 + 2.6 * Math.exp(-d * 26) * mAll * (1 - toLine)); },
          col: paper,
        });
        L.flushAdd({ gain: 1, soft: 1.1, cap: 0 });
        const hj = Math.floor(head * NT) % NT;
        dots.push({ x: thread[hj * 2], y: thread[hj * 2 + 1], r: 5.2, i: 2.6 * (1 - toLine), col: shu });
        // 止まり木は消えていく
        const pf = 1 - smoothstep(0, 0.35, tt);
        if (pf > 0) { const L2 = L.begin(); L2.seg(PERCH.x0, PERCH.y, PERCH.x1, PERCH.y, 2.0, 0.7 * pf, paper); L2.flushAdd({ cap: 1 }); }
        p.bloom = lerp(0.6, 0.85, toLine);
      }
      g.bind(env.post.hdr);
      S.dots(dots, rings);
    },
  };
}
