// time.js — 4 章「時間」
// 前半: できあがった世界に時間が流れる（日の出 → 昼 → 夕焼け → 星空 を 13 秒で）。
// 後半: 流れそのもの——流体のシミュレーションが拍に合わせて噴き上がる。
import { bar, BEAT, W, H, sat, smoothstep, ease, lerp, TAU, clamp, v3, pulse, mulberry32 } from '../core.js';
import { chapter, equation } from '../overlay.js';
import { getWorld } from '../world.js';
import { Fluid } from '../fluid.js';
import { solidState, SOLID_LEN, SUN_AZ, sunDir, RIDGE } from './solid.js';
import { RD_FRAMES } from './plane.js';

const B18 = bar(18), B22 = bar(22), B26 = bar(26);
const F22 = Math.floor(B22 * 30 + 1e-6);

// 不等間隔のキーを Catmull-Rom（Hermite）でなめらかに補間
function keyed(K, t) {
  const n = K.length;
  if (t <= K[0][0]) return K[0][1];
  if (t >= K[n - 1][0]) return K[n - 1][1];
  let i = 0; while (t > K[i + 1][0]) i++;
  const [t1, p1] = K[i], [t2, p2] = K[i + 1];
  const [t0, p0] = K[Math.max(0, i - 1)], [t3, p3] = K[Math.min(n - 1, i + 2)];
  const m1 = i > 0 ? (p2 - p0) / (t2 - t0) : (p2 - p1) / (t2 - t1), m2 = i + 2 < n ? (p3 - p1) / (t3 - t1) : (p2 - p1) / (t2 - t1);
  const h = t2 - t1, u = (t - t1) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * h * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * h * m2;
}
// 太陽の高さ（ラジアン）: 日の出 → 南中 → 日没 → 夜
// 稜線からの高さで書く（0 = 稜線に太陽がかかる瞬間）。小節の頭で顔を出す
const SUN_E = [[0, -0.014], [0.5, 0.034], [1.6, 0.13], [4.3, 0.36], [7.0, 0.13], [8.3, 0.0], [9.0, -0.10], [9.9, -0.27], [11.0, -0.55], [13.3, -0.62]];
const COVER = [[0, 0.46], [3.5, 0.58], [6.5, 0.50], [8.4, 0.44], [10.5, 0.30], [13.3, 0.24]];
const CLOCK = [[0, 6.05], [8.3, 17.62], [13.24, 23.85]];

// 時間の章・前半の状態（生命の章もこの続きから始める）
export function timeState(tau) {
  const s0 = solidState(SOLID_LEN - 1e-4);
  const yaw0 = Math.atan2(s0.f[0], s0.f[2]);
  const yaw = yaw0 + 0.74 * smoothstep(0.6, 8.4, tau) - 0.30 * smoothstep(9.0, 12.6, tau);
  const pitch = Math.asin(s0.f[1]) + 0.045 * smoothstep(0, 2.5, tau) + 0.30 * smoothstep(8.6, 11.6, tau);
  const o = { ...s0 };
  o.f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  o.up = [0, 1, 0];
  o.ro = [s0.ro[0] + 0.05 * tau, s0.ro[1] + 0.085 * tau, s0.ro[2] + 0.20 * tau + 0.6 * ease.outCubic(sat(tau / 1.5))];
  // 日中は「稜線からの高さ」に稜線ぶんを足したものが実際の高度。夕方は地平線に沈むので、足す量を減らしていく。
  const rel = keyed(SUN_E, tau), ridge = RIDGE.e * (1 - smoothstep(4.3, 8.3, tau));
  const e = rel + ridge;
  o.sun = sunDir(e, SUN_AZ + 1.22 * sat(tau / 8.3) + 0.25 * sat((tau - 8.3) / 5));
  o.palE = rel + ridge * smoothstep(0.02, 0.36, rel) * (1 - smoothstep(4.3, 8.3, tau));   // 空の色は「稜線から顔を出した瞬間 = 日の出」として決める
  const night = smoothstep(-0.12, -0.45, rel);
  o.exposure = 1 + 1.5 * night; o.moonAmt = 1 + 0.8 * night; o.fog = lerp(0.72, 1.0, night);
  o.morph = 1; o.world = 1; o.waterY = -0.02;
  o.cover = keyed(COVER, tau);
  o.cloudT = s0.cloudT + tau * 0.085;             // 雲は早回し
  o.time = s0.time + tau * 2.6;                   // 波も早回し
  o.starRot = s0.starRot + 0.05 * tau + 0.10 * Math.max(0, tau - 9.5);
  o.mist = 1 - smoothstep(0.4, 2.6, tau) + 0.35 * smoothstep(9.5, 12, tau);
  o.elev = rel;
  return o;
}

const PALETTE = [[2.3, 0.20, 0.07], [1.45, 0.90, 0.32], [1.25, 1.18, 1.08], [0.10, 0.36, 1.70], [0.16, 0.92, 0.86]];

export const id = 'time';
export async function create(env) {
  const { g, ov } = env;
  const world = getWorld(env);
  const fluid = new Fluid(g, 512, 288);

  chapter(ov, { n: 4, kanji: '時間', en: 'TIME', line: '立体が動くと、時間が流れる。', t0: B18 + 0.35, t1: B26, lineHold: 3.3 });
  // 早回しの時計
  ov.add({
    t0: B18 + 0.9, t1: B22, className: 'clock', html: '<span class="hh">06</span><span class="colon">:</span><span class="mm">00</span><span class="unit">1 日 ＝ 13 秒</span>',
    update(el, tl, t) {
      const tau = t - B18, h = keyed(CLOCK, tau), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
      el.children[0].textContent = String(hh).padStart(2, '0'); el.children[2].textContent = String(mm).padStart(2, '0');
      el.style.opacity = (smoothstep(0, 0.6, tl) * (1 - smoothstep(B22 - B18 - 1.3, B22 - B18 - 0.95, tl))).toFixed(4);
    },
  });
  equation(ov, { src: ['\\dfrac{\\partial \\mathbf{u}}{\\partial t}+(\\mathbf{u}\\cdot\\nabla)\\mathbf{u}=-\\nabla p+\\nu\\nabla^{2}\\mathbf{u}', '\\nabla\\cdot\\mathbf{u}=0'], t0: B22 + 0.5, t1: B26 - 1.2, right: 96, y: 76, size: 23 });

  // ---- 流体の噴き出しの台本（フレーム番号 → その瞬間の噴き出し）
  const rng0 = mulberry32(4242);
  const beatCol = Array.from({ length: 16 }, (_, k) => [PALETTE[(k * 2) % 5], PALETTE[(k * 2 + 3) % 5], PALETTE[(k + 1) % 5]]);
  const beatAng = Array.from({ length: 16 }, () => rng0() * TAU);
  function splats(n) {
    const out = [], t = n / 30;
    // 2 つのノズルが画面を巡りながら、細く吐き続ける
    for (let i = 0; i < 2; i++) {
      const ph = i * Math.PI, a = t * (0.9 + 0.25 * i) + ph;
      const x = 0.5 + 0.30 * Math.cos(a) + 0.08 * Math.cos(2.3 * a + 1), y = 0.5 + 0.27 * Math.sin(1.3 * a + 0.4);
      const dx = -Math.sin(a) - 0.2 * Math.sin(2.3 * a + 1), dy = 1.3 * Math.cos(1.3 * a + 0.4), dl = Math.hypot(dx, dy) || 1;
      const c = PALETTE[(Math.floor(t / (BEAT * 2)) + i * 2 + 1) % 5];
      out.push({ x, y, r: 0.020, vx: (dx / dl) * 2.6, vy: (dy / dl) * 2.6, col: c.map((v) => v * 0.045) });
    }
    // 拍ごとの噴き上げ（細い筋が中央へ向かい、ぶつかって渦になる）
    const kb = Math.floor(t / BEAT + 1e-6), age = n - Math.round(kb * BEAT * 30);
    if (kb < 16 && age >= 0 && age < 7) {
      const w = [1, 0.9, 0.72, 0.52, 0.34, 0.2, 0.1][age], bar4 = Math.floor(kb / 4);
      const C = (i) => PALETTE[(i + bar4 * 2) % 5];
      const jet = (x, y, ang, sp, c, r = 0.030) => out.push({ x, y, r, vx: Math.cos(ang) * sp * w, vy: Math.sin(ang) * sp * w, col: c.map((v) => v * 0.15 * w) });
      const wob = 0.10 * Math.sin(beatAng[kb]);
      if (kb % 4 === 0) {              // 小節の頭: 四方から中央へ
        jet(0.12, 0.5 + wob, 0, 19, C(0), 0.034); jet(0.88, 0.5 - wob, Math.PI, 19, C(3), 0.034);
        jet(0.5 - wob * 0.6, 0.10, Math.PI / 2, 15, C(1)); jet(0.5 + wob * 0.6, 0.90, -Math.PI / 2, 15, C(4));
      } else if (kb % 4 === 1) {       // 左上と右下から、すれ違うように
        jet(0.16, 0.84, -0.55, 17, C(2)); jet(0.84, 0.16, Math.PI - 0.55, 17, C(0));
      } else if (kb % 4 === 2) {       // 左右から、上下にずらして（ずれが回転を生む）
        jet(0.08, 0.36 + wob, 0.08, 18, C(1)); jet(0.92, 0.64 - wob, Math.PI + 0.08, 18, C(3));
      } else {                         // 左下と右上から
        jet(0.16, 0.16, 0.55, 17, C(4)); jet(0.84, 0.84, Math.PI + 0.55, 17, C(2));
      }
    }
    return out;
  }
  const FL_FRAMES = Math.floor(B26 * 30 + 1e-6) - F22;
  function fluidTo(n) {
    n = clamp(n, 0, FL_FRAMES);
    if (fluid.frame < 0 || n < fluid.frame) fluid.reset();
    while (fluid.frame < n) {
      const k = fluid.frame, t = k / 30, end = sat((t - (B26 - B22 - 1.45)) / 1.4);
      fluid.step(splats(k), { suck: 0.75 * end * end, vort: 0.40, dyeDiss: lerp(0.9905, 0.985, end) });
    }
  }

  return {
    id: 'time', t0: B18, t1: B26,
    render(env, tl, t) {
      const p = env.p;
      if (t < B22) {
        // ================= 一日の早回し
        const tau = t - B18;
        world.rd.ensure(RD_FRAMES);
        const o = timeState(tau);
        const ground = world.heightAt(o.ro[0], o.ro[2]);
        o.ro[1] = Math.max(o.ro[1], Math.max(ground, o.waterY) + 0.42);
        g.bind(env.post.hdr);
        world.render(env, o);
        const day = smoothstep(-0.05, 0.12, o.elev);
        p.bloom = 0.42 + 0.25 * pulse(t, B18, 0.5); p.threshold = 0.82; p.vignette = 0.46; p.ca = lerp(0.006, 0.0015, smoothstep(8.5, 10.5, tau));
        p.flash = 0.30 * pulse(t, B18, 0.22);
        p.scrim = 0.35 * day * (1 - smoothstep(3.6, 4.4, tau));
        p.contrast = 1.04; p.saturation = 1.06;
      } else {
        // ================= 流体
        const n = Math.round(t * 30) - F22;
        fluidTo(n);
        g.bind(env.post.hdr);
        const end = sat((t - (B26 - 1.45)) / 1.4);
        fluid.show(env.post.hdr, 1.75 + 1.6 * end * end, 1);
        p.bloom = 0.62 + 0.5 * end; p.threshold = 0.7; p.knee = 0.6; p.vignette = 0.5; p.ca = 0.006; p.saturation = 1.22;
        p.flash = Math.max(0.55 * pulse(t, B22, 0.12), Math.pow(sat((t - (B26 - 0.42)) / 0.40), 2.2));
      }
    },
  };
}
