// plane.js — 2 章「面」
// 線が上下に動いて和紙の面がひらく。その上に、ボロノイ分割・墨流し・マンデルブロ集合・反応拡散を、墨と朱で描く。
import { bar, BEAT, W, H, sat, smoothstep, ease, lerp, TAU, mulberry32 } from '../core.js';
import { chapter, equation, note } from '../overlay.js';
import { shared } from './shared.js';
import { getRD } from '../rd.js';
import { GLSL_PAPER } from '../paper.js';

const B6 = bar(6), B7 = bar(7), B8 = bar(8), B9 = bar(9), B10 = bar(10);
export const RD_F0 = Math.floor(B9 * 30 + 1e-6);    // 反応拡散を始めるフレーム
export const RD_FRAMES = 100;

const FS_VORONOI = GLSL_PAPER + /* glsl */ `
uniform vec3 uSeeds[40]; uniform float uFill[40]; uniform int uN; uniform float uGrow;
out vec4 o;
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 pap = paperTex(p);
  float d1 = 1e9, d2 = 1e9; vec2 p1 = vec2(0.0), p2 = vec2(1.0); int i1 = 0;
  for (int i = 0; i < 40; i++){
    if (i >= uN) break;
    vec2 s = uSeeds[i].xy; float d = distance(p, s);
    if (d < d1){ d2 = d1; p2 = p1; d1 = d; p1 = s; i1 = i; } else if (d < d2){ d2 = d; p2 = s; }
  }
  float e = dot(0.5 * (p1 + p2) - p, normalize(p2 - p1));   // 隣のセルとの境界までの距離
  float ins = min(e, uGrow - d1);                            // 育ちつつある円 ∩ セル
  float kind = uSeeds[i1].z;
  vec3 fc = kind < 1.5 ? SHU_INK : kind < 2.5 ? AI_INK : kind < 3.5 ? C_GOLD * 0.92 : kind < 4.5 ? vec3(0.035, 0.037, 0.05) : vec3(0.50, 0.51, 0.55);
  float fa = uFill[i1] * step(0.5, kind) * aaFill(1.0 - ins, 1.5);
  vec3 col = inkOn(pap, fc, fa * 0.94);
  float ln = aaLine(ins, 2.3, 1.3) * step(d1, uGrow + 3.0);
  col = inkOn(col, INK, ln * 0.95);
  float sd = aaFill(d1 - (i1 == 0 ? 6.0 : 3.6), 1.2) * smoothstep(0.0, 10.0, uGrow);
  col = mix(col, i1 == 0 ? vec3(1.0, 0.09, 0.03) : (fa > 0.5 && kind > 0.5 && kind < 4.5 ? pap : INK), sd);
  o = vec4(col, 1.0);
}`;

const FS_MARBLE = GLSL_PAPER + /* glsl */ `
uniform vec4 uOpA[56]; uniform vec4 uOpB[56]; uniform int uNops;
out vec4 o;
vec3 inkCol(float k){ return k < 1.5 ? INK * 1.4 : k < 2.5 ? SHU_INK : k < 3.5 ? AI_INK : C_GOLD * 0.9; }
// 数理的な墨流し: 操作を逆順にたどって、この画素の「もとの位置」を求める
vec4 marble(vec2 q){
  for (int i = uNops - 1; i >= 0; i--){
    vec4 a = uOpA[i], b = uOpB[i];
    if (b.x < 0.5){                         // 墨のしずく（中心 a.xy, 半径 a.z, 色 b.y）
      if (a.z <= 0.0) continue;
      vec2 d = q - a.xy; float l2 = dot(d, d), r2 = a.z * a.z;
      if (l2 < r2){ float st = 0.78 + 0.22 * vnoise(q * 0.035 + b.y * 7.3); return vec4(inkCol(b.y), b.y < 0.5 ? 0.0 : st); }
      q = a.xy + d * sqrt(1.0 - r2 / l2);
    } else if (b.x < 1.5){                  // 竹串で引く（a.xy を通る向き a.zw の線、強さ b.y、減衰 b.z）
      vec2 m = a.zw, n = vec2(-m.y, m.x);
      q -= m * b.y * pow(b.z, abs(dot(q - a.xy, n)));
    } else {                                // 櫛で波を入れる
      vec2 m = a.zw, n = vec2(-m.y, m.x);
      q -= m * b.y * sin(dot(q - a.xy, n) * b.z + b.w);
    }
  }
  return vec4(0.0);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 pap = paperTex(p);
  vec4 acc = vec4(0.0);
  for (int s = 0; s < 4; s++){
    vec4 m = marble(p + vec2(float(s & 1), float(s >> 1)) * 0.5 - 0.25);
    acc += vec4(m.rgb * m.a, m.a);
  }
  acc *= 0.25 * (1.0 - reserve(p));
  vec3 col = pap * (1.0 - acc.a * 0.96) + acc.rgb * 0.96 * (0.82 + 0.2 * luma(pap));
  o = vec4(col, 1.0);
}`;

const FS_MANDEL = GLSL_PAPER + /* glsl */ `
uniform vec2 uCenter; uniform float uScale, uRot;
out vec4 o;
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 pap = paperTex(p);
  vec2 c = uCenter + rot(uRot) * (gl_FragCoord.xy - 0.5 * uRes) * uScale;
  vec2 z = vec2(0.0), dz = vec2(0.0); float n = 0.0, m2 = 0.0; bool esc = false;
  for (int i = 0; i < 340; i++){
    dz = 2.0 * vec2(z.x * dz.x - z.y * dz.y, z.x * dz.y + z.y * dz.x) + vec2(1.0, 0.0);
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    m2 = dot(z, z);
    if (m2 > 1.0e4){ esc = true; break; }
    n += 1.0;
  }
  vec3 col;
  if (esc){
    float nu = n + 1.0 - log2(0.5 * log(m2));
    float dpx = 0.5 * sqrt(m2 / dot(dz, dz)) * log(m2) / uScale;      // 集合までの距離（画素）
    float w = fwidth(nu);
    float g = abs(fract(nu - 0.5) - 0.5);
    float ln = (1.0 - smoothstep(0.6 * w, 1.6 * w, g)) * (1.0 - smoothstep(0.16, 0.42, w));
    col = inkOn(pap, INK, ln * 0.5);
    col = inkOn(col, SHU_INK, 0.82 * exp(-dpx / 26.0));               // 境界のまわりに朱がにじむ
    col = inkOn(col, INK, 0.96 * aaFill(dpx - 0.9, 1.2));             // 細い枝も墨の線として残す
  } else {
    col = inkOn(pap, INK, 0.96);
  }
  o = vec4(mix(col, pap, reserve(p)), 1.0);
}`;

const FS_RDVIEW = GLSL_PAPER + /* glsl */ `
uniform sampler2D uRD;
out vec4 o;
// B スプラインの双三次補間（4 回の線形サンプルで）
float bicubicG(sampler2D t, vec2 uv){
  vec2 res = vec2(textureSize(t, 0)); vec2 st = uv * res - 0.5; vec2 i = floor(st), f = fract(st);
  vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0, w1 = (4.0 - 6.0 * f * f + 3.0 * f * f * f) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f * f - 3.0 * f * f * f) / 6.0, w3 = f * f * f / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, h0 = (w1 / g0) - 1.0 + i + 0.5, h1 = (w3 / g1) + 1.0 + i + 0.5;
  float a = texture(t, vec2(h0.x, h0.y) / res).g, b = texture(t, vec2(h1.x, h0.y) / res).g, c = texture(t, vec2(h0.x, h1.y) / res).g, d = texture(t, vec2(h1.x, h1.y) / res).g;
  return mix(mix(d, c, g0.x), mix(b, a, g0.x), g0.y);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 pap = paperTex(p);
  float v = bicubicG(uRD, vUv);
  float ink = smoothstep(0.17, 0.235, v);
  vec3 col = inkOn(pap, INK, ink * 0.95);
  col = inkOn(col, INK, 0.18 * smoothstep(0.06, 0.17, v) * (1.0 - ink));   // 縁のにじみ
  o = vec4(mix(col, pap, reserve(p)), 1.0);
}`;

// 紙が重なる切り替え: 新しい紙（uB）が dir の向きに滑り込み、古い紙に影を落とす
const FS_WIPE = /* glsl */ `
uniform sampler2D uA, uB; uniform float uEdge; uniform vec2 uDir;
out vec4 o;
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float s = dot(p, uDir) - uEdge;                // > 0 が新しい紙
  vec3 a = texture(uA, vUv).rgb, b = texture(uB, vUv).rgb;
  float sh = 0.42 * exp(s / 70.0) * step(s, 0.0);
  o = vec4(mix(a * (1.0 - sh), b, sat(s + 0.5)), 1.0);
}`;

// 線が上下にひらいて面になる
const FS_OPEN = /* glsl */ `
uniform sampler2D uB; uniform float uHalf, uGlow;
out vec4 o;
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float dy = abs(p.y - 540.0);
  float inside = sat(uHalf - dy + 0.5);
  vec3 b = texture(uB, vUv).rgb;
  float edge = exp(-abs(dy - uHalf) / 2.2) + 0.35 * exp(-abs(dy - uHalf) / 14.0);
  o = vec4(b * inside + C_PAPER * uGlow * edge, inside);
}`;

export const id = 'plane';
export async function create(env) {
  const { g, ov } = env;
  const S = shared(env);
  const pVor = g.program(FS_VORONOI, 'voronoi');
  const pMar = g.program(FS_MARBLE, 'marble');
  const pMan = g.program(FS_MANDEL, 'mandelbrot');
  const pRDV = g.program(FS_RDVIEW, 'rdView');
  const pWipe = g.program(FS_WIPE, 'wipe');
  const pOpen = g.program(FS_OPEN, 'open');
  const rd = getRD(g);
  const tmpA = g.target(W, H, { type: 'rgba16f' });

  // ---- ボロノイの母点（点どうしが近づきすぎないように撒く）
  const rng = mulberry32(606);
  const seeds = [{ x: 960, y: 540 }];
  for (let tries = 0; tries < 6000 && seeds.length < 40; tries++) {
    const x = rng.range(-150, W + 150), y = rng.range(-150, H + 150);
    if (seeds.every((s) => Math.hypot(s.x - x, s.y - y) > 232)) seeds.push({ x, y });
  }
  const kinds = [];
  for (const [k, n] of [[0, 20], [1, 4], [2, 5], [3, 4], [4, 3], [5, 3]]) for (let i = 0; i < n; i++) kinds.push(k);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  seeds.forEach((s, i) => {
    s.kind = i === 0 ? 0 : kinds[(i - 1) % kinds.length];
    if (s.y > 760 && Math.abs(s.x - 960) < 560) s.kind = 0;      // 字幕のうしろは塗らない
    if (s.y < 330 && (s.x < 640 || s.x > 1180)) s.kind = 0;      // 見出し・札のうしろも塗らない
    s.ph = rng() * TAU; s.rank = rng();
  });
  const NSEED = seeds.length;
  const seedArr = new Float32Array(120), fillArr = new Float32Array(40);

  // ---- 墨流しの台本（32 分音符ごとにしずくを落とし、あとから串と櫛を入れる）
  const tick = BEAT / 8;
  const ops = [];
  const drop = (k, c, r, col) => ops.push({ type: 0, t0: B7 + 0.12 + k * tick, dur: 0.42, c, r, col });
  const A = [640, 560], Bc = [1310, 430], C = [1040, 830], D = [360, 270];
  [[A, 130, 1], [A, 100, 0], [Bc, 120, 3], [A, 110, 1], [Bc, 86, 0], [A, 88, 0], [C, 112, 1], [A, 118, 2], [Bc, 104, 1], [C, 80, 0], [A, 80, 0], [Bc, 84, 0],
   [A, 94, 1], [C, 90, 4], [Bc, 94, 3], [D, 108, 1], [A, 62, 0], [C, 72, 0], [D, 74, 0], [Bc, 66, 2], [A, 56, 1], [D, 72, 3], [C, 60, 1], [D, 48, 0]]
    .forEach(([c, r, col], k) => drop(k * 0.72, c, r, col));
  const tine = (tb, b, m, z, lam, dur = 0.7) => ops.push({ type: 1, t0: tb, dur, b, m, z, lam });
  const wave = (tb, b, m, amp, wl, ph, dur = 0.9) => ops.push({ type: 2, t0: tb, dur, b, m, z: amp, lam: TAU / wl, ph });
  tine(B7 + BEAT * 2.0, [820, 0], [0, 1], 300, 0.990);
  tine(B7 + BEAT * 2.5, [1180, 0], [0, -1], 280, 0.990);
  tine(B7 + BEAT * 3.0, [0, 600], [1, 0], 320, 0.991);
  wave(B7 + BEAT * 3.35, [0, 0], [0.5, 0.866], 38, 260, 0.6, 0.85);
  const opA = new Float32Array(56 * 4), opB = new Float32Array(56 * 4);

  // ---- 文字
  chapter(ov, { n: 2, kanji: '面', en: 'PLANE', line: '線が動くと、面になる。', t0: B6 + 0.18, t1: B10, lineHold: 3.0, dark: true });
  const eqs = [
    [B6 + 0.9, B7, 'V_i=\\{\\,x \\mid \\lVert x-p_i\\rVert \\le \\lVert x-p_j\\rVert\\ \\ \\forall j\\,\\}', 'ボロノイ分割', 25],
    [B7 + 0.3, B8, "P'=C+(P-C)\\sqrt{1+\\dfrac{r^2}{\\lVert P-C\\rVert^2}}", '墨流し', 24],
    [B8 + 0.3, B9, 'z_{n+1}=z_n^{\\,2}+c', 'マンデルブロ集合', 28],
    [B9 + 0.3, B10, ['\\dfrac{\\partial u}{\\partial t}=D_u\\nabla^2u-uv^2+F(1-u)', '\\dfrac{\\partial v}{\\partial t}=D_v\\nabla^2v+uv^2-(F+k)v'], '反応拡散系', 21],
  ];
  for (const [t0, t1, src, label, size] of eqs) {
    ov.add({
      t0, t1: t1 - 0.02, className: 'plate',
      html: `<div class="plate-label">${label}</div><div class="plate-eq" style="font-size:${size}px">${(Array.isArray(src) ? src : [src]).map((s) => `<div>${window.katex.renderToString(s, { displayMode: false, throwOnError: true, output: 'html' })}</div>`).join('')}</div>`,
      update(el, tl) {
        const dur = t1 - 0.02 - t0, a = ease.outCubic(sat(tl / 0.5)) * (1 - smoothstep(dur - 0.3, dur - 0.03, tl));
        el.style.opacity = a.toFixed(4); el.style.transform = `translateY(${((1 - ease.outCubic(sat(tl / 0.5))) * 10).toFixed(2)}px)`;
      },
    });
  }

  // ---- それぞれの紙を描く（target に不透明で描く）
  const drawVoronoi = (t, target) => {
    const tt = t - B6;
    for (let i = 0; i < NSEED; i++) {
      const s = seeds[i], dr = i === 0 ? 0 : 30 * smoothstep(1.6, 3.2, tt);
      seedArr[i * 3] = s.x + Math.cos(tt * 0.9 + s.ph) * dr; seedArr[i * 3 + 1] = s.y + Math.sin(tt * 0.9 + s.ph) * dr; seedArr[i * 3 + 2] = s.kind;
      fillArr[i] = smoothstep(0, 0.35, tt - 1.25 - s.rank * 1.3);
    }
    const u = sat((tt - 0.45) / 1.75);
    const grow = 420 * (1 - Math.pow(1 - u, 2.2)) + 600 * smoothstep(0.92, 1.0, u);
    g.draw(pVor, { uSeeds: seedArr, uFill: fillArr, uN: NSEED, uGrow: grow }, target);
  };
  const drawMarble = (t, target) => {
    let n = 0;
    for (const op of ops) {
      const a = sat((t - op.t0) / op.dur);
      if (a <= 0 || n >= 56) continue;
      if (op.type === 0) { opA.set([op.c[0], op.c[1], op.r * Math.sqrt(ease.outCubic(a)), 0], n * 4); opB.set([0, op.col, 0, 0], n * 4); }
      else if (op.type === 1) { opA.set([op.b[0], op.b[1], op.m[0], op.m[1]], n * 4); opB.set([1, op.z * ease.inOutCubic(a), op.lam, 0], n * 4); }
      else { opA.set([op.b[0], op.b[1], op.m[0], op.m[1]], n * 4); opB.set([2, op.z * ease.inOutCubic(a), op.lam, op.ph], n * 4); }
      n++;
    }
    g.draw(pMar, { uOpA: opA, uOpB: opB, uNops: n }, target);
  };
  const C0 = [-0.743643887, 0.131825904], CS = [-0.62, 0.0];
  const drawMandel = (t, target) => {
    const u = sat((t - B8 + 0.35) / (B9 - B8 + 0.6));
    const e = lerp(u, ease.inOutSine(u), 0.5);
    const s0 = 3.4 / H, s1 = 0.0042 / H;
    const sc = s0 * Math.pow(s1 / s0, e);
    const k = (sc - s1) / (s0 - s1);
    g.draw(pMan, { uCenter: [C0[0] + (CS[0] - C0[0]) * k, C0[1] + (CS[1] - C0[1]) * k], uScale: sc, uRot: -0.55 * e }, target);
  };
  const drawRD = (t, target) => {
    const f = Math.round(t * 30) - RD_F0;
    const tex = rd.ensure(f);
    g.draw(pRDV, { uRD: tex }, target);
  };
  const shots = [
    { t0: B6, draw: drawVoronoi }, { t0: B7, draw: drawMarble, dir: [-1, 0] }, { t0: B8, draw: drawMandel, dir: [0, 1] }, { t0: B9, draw: drawRD, dir: [1, 0] },
  ];
  const WIPE = 0.34;

  return {
    id: 'plane', t0: B6, t1: B10,
    render(env, tl, t) {
      const p = env.p, post = env.post;
      p.bloom = 0.1; p.threshold = 0.95; p.vignette = 0.3; p.ca = 0.003;
      let k = 0; for (let i = 0; i < shots.length; i++) if (t >= shots[i].t0) k = i;
      const sh = shots[k], w = (t - sh.t0) / WIPE;
      if (k === 0) {
        const open = ease.outQuart(sat((t - B6) / 0.62));
        if (open < 0.999) {
          sh.draw(t, tmpA);
          g.bind(post.hdr); S.bg();
          g.draw(pOpen, { uB: tmpA, uHalf: 546 * open, uGlow: 2.2 * (1 - open) + 0.6 * (1 - smoothstep(0, 0.2, open)) }, post.hdr, 'premul');
          p.bloom = lerp(0.75, 0.1, smoothstep(0.5, 1, open)); p.threshold = lerp(0.75, 0.95, open); p.vignette = lerp(0.55, 0.3, open);
        } else sh.draw(t, post.hdr);
      } else if (w < 1) {
        // 新しい紙が滑り込む
        shots[k - 1].draw(t, tmpA);
        sh.draw(t, post.aux);
        const e = ease.outQuart(sat(w)), d = sh.dir;
        const span = Math.abs(d[0]) * W + Math.abs(d[1]) * H;
        const lo = Math.min(0, d[0] * W + d[1] * H), hi = lo + span;      // dot(p, dir) の範囲
        g.draw(pWipe, { uA: tmpA, uB: post.aux, uEdge: lerp(hi + 2, lo - 2, e), uDir: d }, post.hdr);
      } else sh.draw(t, post.hdr);
    },
  };
}
