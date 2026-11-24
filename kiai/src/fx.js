// fx.js — 舞台の上の効果: 気合いのオーラ、集中線、中性子の嵐、血しぶき、弾丸のような吐瀉物、衝撃波
//   どれも「時刻の関数」として描く（前のフレームの状態を持たない）ので、どのフレームからでも同じ絵になる。
import { W, H, sat, smoothstep, lerp, clamp, TAU, mulberry32, hash1, ease, COL } from './core.js';
import { Dots } from '../../atom/src/kit.js';
import { Lines } from '../../film/src/lines.js';
import { FLOOR } from './figure.js';
import { SRC } from './stage.js';

const FS_AURA = /* glsl */ `
uniform vec4 uA;   // 足もとの x, y（画面 px・全解像度）、身長 px、体の半幅 px
uniform vec4 uB;   // 強さ、時刻、傾き、魂（0 金 → 1 白青）
uniform float uScale;
out vec4 o;
void main(){
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uScale;
  vec2 q = (fc - uA.xy) / uA.z;
  float h = -q.y;                                   // 足もと 0 → 頭 1
  float hh = max(h, 0.0), str = uB.x;
  q.x -= uB.z * hh * hh;
  float w = uA.w / uA.z;
  float dy = h - clamp(h, 0.08, 0.92);
  float d = length(vec2(q.x, dy * 0.42)) - w * (1.0 - 0.25 * sat(h));      // 体の芯からの距離（上へは伸びやすく）
  float tt = uB.y;
  float n  = fbm(vec2(q.x * 4.2, h * 2.1 - tt * 2.7));
  float n2 = gnoise(vec2(q.x * 9.0 + 3.1, h * 5.2 - tt * 6.0));
  float n3 = gnoise(vec2(q.x * 21.0 - 1.7, h * 9.0 - tt * 10.0));
  float reach = (0.07 + 0.2 * hh) * str;
  float f = sat(1.0 - (d - (n * 0.7 + n2 * 0.26 + n3 * 0.1) * reach) / max(reach, 1e-3));
  f *= smoothstep(-0.07, 0.05, h);
  float inner = smoothstep(-w * 1.2, w * mix(0.25, 0.9, uB.w), d) * mix(0.62, 0.8, uB.w) + mix(0.38, 0.2, uB.w);     // 体のそばは抑える（人物が見えるように）
  float edge = smoothstep(0.55, 1.0, f), mid = smoothstep(0.15, 0.75, f), outer = f;
  float st = pow(sat(gnoise(vec2(q.x * 26.0, h * 1.5 - tt * 6.5)) * 0.5 + 0.5), 7.0) * mid * 1.6;   // 立ちのぼる細い筋
  vec3 gold = vec3(1.0, 0.16, 0.012) * outer * 0.5 + vec3(1.0, 0.50, 0.07) * mid * 0.9 + vec3(1.0, 0.86, 0.52) * (edge * 1.25 + st);
  vec3 soul = vec3(0.07, 0.24, 1.0) * outer * 0.55 + vec3(0.26, 0.62, 1.0) * mid * 0.6 + vec3(0.8, 0.95, 1.0) * (edge * 0.5 + st * 0.8);
  o = vec4(mix(gold, soul, uB.w) * inner * min(str, mix(1.6, 1.25, uB.w)) * (0.92 + 0.08 * n2), 1.0);
}`;

export class Fx {
  constructor(env) {
    const g = env.g; this.env = env; this.g = g;
    this.blood = new Dots(env, 16384); this.add = new Dots(env, 8192); this.lines = new Lines(g, 8192);
    this.pAura = g.program(FS_AURA, 'aura');
    this.half = g.target(W / 2, H / 2, { type: 'rgba16f' });
    this.cam = { s: 1, fx: W / 2, fy: H / 2 };
  }
  setCam(cam) { this.cam = cam; }
  X(x) { return (x - this.cam.fx) * this.cam.s + W / 2; }
  Y(y) { return (y - this.cam.fy) * this.cam.s + H / 2; }

  // ---- オーラ（半分の解像度で描いて重ねる）
  aura(gx, strength, time, { lean = 0, soul = 0, height = 480, width = 60, gain = 1, footY = FLOOR + 6 } = {}) {
    if (strength <= 0.01) return;
    const g = this.g, post = this.env.post, s = this.cam.s;
    g.bind(this.half); g.clear(0, 0, 0, 1);
    g.draw(this.pAura, { uA: [this.X(gx), this.Y(footY), height * s, width * s], uB: [strength, time, lean, soul], uScale: 2 }, this.half, 'none');
    post.copy(this.half, post.hdr, gain, 'add');
    g.bind(post.hdr);
  }

  // ---- 集中線
  speed(cx, cy, k, frame, { col = COL.pale, inner = 330, n = 84, hold = 2 } = {}) {
    if (k <= 0.01) return;
    const L = this.lines.begin(), r = mulberry32(9000 + Math.floor(frame / hold) * 31);
    for (let i = 0; i < n; i++) {
      const a = (i + r()) / n * TAU, on = r() < 0.62, r0 = inner * (0.75 + 0.7 * r()), w = 2 + 9 * r() * r(), b = 0.25 + 0.75 * r();
      if (!on) continue;
      const c = Math.cos(a), s = Math.sin(a) * 0.82;
      L.seg(cx + c * r0, cy + s * r0, cx + c * 2300, cy + s * 2300, 0.4, k * b * 0.9, col, w * 3.2, k * b * 0.55, col);
    }
    L.flushAdd({ gain: 1, soft: 1.2, cap: 0 });
  }

  // ---- 中性子の嵐（槽ののぞき窓から左へ飛ぶ光の筋）。shield: 人物のまわりで止める（0..1）
  storm(t, level, { shield = 0, gx = 0, n = 200, soul = 0 } = {}) {
    if (level <= 0.01) return [];
    const L = this.lines.begin(), D = this.add.begin(), s = this.cam.s, hits = [];
    const N = Math.round(n * Math.min(level, 2.2));
    const ex = 150 + 40 * shield, ey = 300 + 30 * shield, ecx = gx, ecy = FLOOR - 250;
    for (let i = 0; i < N; i++) {
      const h1 = hash1(i * 1.37 + 0.11), h2 = hash1(i * 2.71 + 0.53), h3 = hash1(i * 3.93 + 0.29);
      const a = Math.PI + (h1 - 0.5) * 1.5, v = 2400 + 2600 * h2, R = 2300, len = 70 + 150 * h3;
      const r = (t * v + h3 * R * 7) % R, c = Math.cos(a), sn = Math.sin(a);
      let r0 = r, r1 = r + len, hit = -1;
      if (shield > 0) {
        // 楕円（人物のまわりの気合いの壁）との交点
        const ox = (SRC[0] - ecx) / ex, oy = (SRC[1] - ecy) / ey, dx = c / ex, dy = sn / ey;
        const A = dx * dx + dy * dy, B = 2 * (ox * dx + oy * dy), C = ox * ox + oy * oy - 1, disc = B * B - 4 * A * C;
        if (disc > 0) { hit = (-B - Math.sqrt(disc)) / (2 * A); if (hit > 0 && r1 > hit) { if (r0 > hit) { if (hash1(i * 5.1) < shield) { if (r0 - hit < 220) hits.push([SRC[0] + c * hit, SRC[1] + sn * hit, 1 - (r0 - hit) / 220, i]); continue; } } else if (hash1(i * 5.1) < shield) r1 = hit; } }
      }
      const fade = sat(1.25 - r / R) * sat(r / 120), w = (1.3 + 1.6 * h2) * Math.max(1, s * 0.8), I = (0.5 + 0.9 * h1) * fade * Math.min(level, 1.5);
      L.seg(this.X(SRC[0] + c * r0), this.Y(SRC[1] + sn * r0), this.X(SRC[0] + c * r1), this.Y(SRC[1] + sn * r1), w * 0.4, I * 0.25, COL.blue, w, I * 1.5, COL.ice);
    }
    L.flushAdd({ gain: 1, soft: 1, cap: 1 });
    for (const [x, y, k, i] of hits) {            // 弾かれた火花
      const col = soul > 0.5 ? COL.soul : COL.pale;
      D.add(this.X(x), this.Y(y), (5 + 16 * k) * s, 1.6 * k * k, col);
      for (let j = 0; j < 3; j++) { const a = hash1(i * 7.3 + j) * TAU, d = (1 - k) * (30 + 60 * hash1(i * 1.9 + j * 3.3)); D.add(this.X(x + Math.cos(a) * d + 8 * (1 - k)), this.Y(y + Math.sin(a) * d), 2.2 * s, 1.5 * k, col); }
    }
    D.flush('add', { gauss: 1 });
    return hits;
  }

  // ---- 血しぶき。emitters: [{ p:[x,y]（ワールド）, dir, spread, v:[lo,hi], rate, t0, t1, seed, size, pulse, g }]
  //   飛んでいる粒は GL の点で、床に落ちた粒は pools（2D キャンバスで描くための一覧）に返す
  bloodBegin() { this.blood.begin(); this.pools = []; }
  bloodEmit(t, e) {
    const D = this.blood, s = this.cam.s, grav = e.g ?? 1900, rate = e.rate, size = e.size ?? 5, maxLife = 2.4;
    const k0 = Math.max(0, Math.floor((t - maxLife - e.t0) * rate)), k1 = Math.min(Math.floor((e.t1 - e.t0) * rate), Math.floor((t - e.t0) * rate));
    for (let k = k0; k <= k1; k++) {
      const h = (j) => hash1(k * 12.9898 + j * 78.233 + e.seed * 37.719);
      const born = e.t0 + (k + h(0)) / rate, age = t - born; if (age < 0) continue;
      let sp = lerp(e.v[0], e.v[1], h(1) * h(1) * 0.6 + h(1) * 0.4);
      if (e.pulse) { const ph = (born * e.pulse + (e.phase || 0)) % 1; if (ph > 0.5) continue; sp *= 1 - ph * 0.9; }
      const a = e.dir + (h(2) - 0.5) * e.spread + (h(5) - 0.5) * e.spread * 0.3;
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp, x0 = e.p[0] + (h(3) - 0.5) * 14, y0 = e.p[1] + (h(4) - 0.5) * 14;
      const fy = FLOOR + 6 + 64 * h(6), tl = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * grav * (fy - y0)))) / grav;
      const sz = size * (0.45 + 1.1 * h(7) * h(7));
      if (age >= tl) { if ((k % (e.poolEvery || 3)) === 0) this.pools.push([x0 + vx * tl, fy, sz * (2.2 + 2.5 * h(8)) * sat((age - tl) / 0.12 + 0.3) * (1 - smoothstep(maxLife - 0.8, maxLife, age))]); continue; }
      const x = x0 + vx * age, y = y0 + vy * age + 0.5 * grav * age * age, vyy = vy + grav * age, vl = Math.hypot(vx, vyy) || 1;
      const col = h(9) < 0.14 ? [0.9, 0.035, 0.03] : [0.5, 0.008, 0.012];
      const X = this.X(x), Y = this.Y(y), r = sz * s * 0.82, ux = -vx / vl, uy = -vyy / vl, st = r * (0.75 + Math.min(1.3, vl / 900));
      D.add(X, Y, r, 1, col); D.add(X + ux * st, Y + uy * st, r * 0.84, 1, col); D.add(X + ux * st * 1.9, Y + uy * st * 1.9, r * 0.66, 1, col); D.add(X + ux * st * 2.7, Y + uy * st * 2.7, r * 0.48, 1, col); D.add(X + ux * st * 3.4, Y + uy * st * 3.4, r * 0.3, 1, col);
    }
  }
  bloodFlush() { this.blood.flush('premul', { soft: 1.2 }); }
  // 床の血だまり（Stage.draw の onFloor の中で呼ぶ）
  drawPools(c, big = []) {
    c.fillStyle = 'rgba(122,8,14,0.9)';
    for (const [x, y, r] of this.pools || []) { c.beginPath(); c.ellipse(x, y, r, r * 0.26, 0, 0, TAU); c.fill(); }
    for (const [x, y, r] of big) { if (r <= 0) continue; c.beginPath(); c.ellipse(x, y, r, r * 0.2, 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(220,60,60,0.35)';
    for (const [x, y, r] of big) { if (r <= 0) continue; c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.05, r * 0.3, r * 0.04, 0, 0, TAU); c.fill(); }
  }

  // ---- 弾丸のような吐瀉物。shots: 発射時刻の配列。mouth: {p, d}（今の口の位置と向き）。wallX: 当たる壁
  bullets(t, shots, mouth, { wallX = SRC[0] - 176, speed = 3000 } = {}) {
    const L = this.lines.begin(), D = this.add.begin(), B = this.blood, s = this.cam.s;
    let recoil = 0;
    shots.forEach((ts, k) => {
      const age = t - ts; if (age < 0 || age > 1.2) return;
      const h = (j) => hash1(k * 17.17 + j * 3.71);
      recoil = Math.max(recoil, Math.exp(-age / 0.06));
      const da = (h(0) - 0.5) * 0.11, cs = Math.cos(da), sn = Math.sin(da), dx = mouth.d[0] * cs - mouth.d[1] * sn, dy = mouth.d[0] * sn + mouth.d[1] * cs;
      const dist = dx > 0.05 ? (wallX - mouth.p[0]) / dx : 9e9, tHit = dist / speed;
      const col = h(1) < 0.3 ? COL.bloodHi : COL.bile;
      if (age < tHit) {
        const r1 = age * speed, r0 = Math.max(0, r1 - 210);
        const y1 = mouth.p[1] + dy * r1 + 120 * age * age, y0 = mouth.p[1] + dy * r0 + 120 * Math.max(0, age - 0.07) ** 2;
        L.seg(this.X(mouth.p[0] + dx * r0), this.Y(y0), this.X(mouth.p[0] + dx * r1), this.Y(y1), 1 * s, 0.3, COL.hot, 7 * s, 2.4, col);
        D.add(this.X(mouth.p[0] + dx * r1), this.Y(y1), 9 * s, 2.6, COL.pale);
      } else {
        const a2 = age - tHit, hx = wallX, hy = mouth.p[1] + dy * dist + 120 * tHit * tHit;   // 着弾: 火花と飛沫
        D.add(this.X(hx), this.Y(hy), (30 + 160 * a2) * s, 2.8 * Math.exp(-a2 / 0.05), COL.pale);
        for (let j = 0; j < 9; j++) {
          const a = Math.PI + (hash1(k * 3.3 + j * 9.1) - 0.5) * 2.6, v = 300 + 700 * hash1(k * 1.3 + j * 5.7);
          const x = hx + Math.cos(a) * v * a2, y = hy + Math.sin(a) * v * a2 + 1100 * a2 * a2; if (y > FLOOR + 30) continue;
          B.add(this.X(x), this.Y(y), (3 + 3 * hash1(j + k)) * s, 1, j % 3 ? [0.62, 0.012, 0.016] : [0.6, 0.42, 0.05]);
        }
      }
      if (age < 0.09) {                             // 口もとの噴き出し
        D.add(this.X(mouth.p[0] + dx * 26), this.Y(mouth.p[1] + dy * 26), (26 + 260 * age) * s, 2.2 * (1 - age / 0.09), COL.pale);
        for (let j = 0; j < 6; j++) { const a = Math.atan2(dy, dx) + (hash1(k + j * 2.2) - 0.5) * 1.1, d = age * (900 + 900 * hash1(k * 2 + j)); L.seg(this.X(mouth.p[0] + Math.cos(a) * d * 0.4), this.Y(mouth.p[1] + Math.sin(a) * d * 0.4), this.X(mouth.p[0] + Math.cos(a) * d), this.Y(mouth.p[1] + Math.sin(a) * d), 2 * s, 1.2, COL.bile, 0.5, 0.2, COL.hot); }
      }
    });
    L.flushAdd({ gain: 1, soft: 1.2, cap: 1 }); D.flush('add', { gauss: 1 });
    return recoil;
  }

  // ---- 衝撃波の輪（床の上に広がる楕円と、体のまわりの輪）
  rings(list, t, { col = COL.pale } = {}) {
    const L = this.lines.begin(), s = this.cam.s;
    for (const [t0, x, y, power = 1] of list) {
      const age = t - t0; if (age < 0 || age > 1.1) continue;
      const u = ease.outCubic(sat(age / 1.0)), R = (60 + 1250 * u * power) * s, a = (1 - sat(age / 1.0)) ** 1.5 * power;
      const n = 96, pts = new Float32Array(n * 2), pts2 = new Float32Array(n * 2);
      for (let j = 0; j < n; j++) { const an = j / n * TAU; pts[j * 2] = this.X(x) + Math.cos(an) * R; pts[j * 2 + 1] = this.Y(FLOOR + 10) + Math.sin(an) * R * 0.2; pts2[j * 2] = this.X(x) + Math.cos(an) * R * 0.62; pts2[j * 2 + 1] = this.Y(y) + Math.sin(an) * R * 0.62; }
      L.poly(pts, n, { w: (14 * (1 - u) + 2) * s, i: 1.5 * a, col, closed: true });
      L.poly(pts2, n, { w: (9 * (1 - u) + 1.5) * s, i: 0.8 * a, col, closed: true });
    }
    L.flushAdd({ gain: 1, soft: 1.5, cap: 1 });
  }

  // ---- 舞い上がる粒（気合いで床の塵が浮く／夜明けの埃）
  motes(t, gx, k, { col = COL.pale, n = 90, spread = 620, rise = 260, seed = 1 } = {}) {
    if (k <= 0.01) return;
    const D = this.add.begin(), s = this.cam.s;
    for (let i = 0; i < n; i++) {
      const h1 = hash1(i * 3.3 + seed), h2 = hash1(i * 7.1 + seed * 2.3), h3 = hash1(i * 1.7 + seed * 5.9);
      const life = 1.2 + 1.6 * h2, ph = (t / life + h3) % 1;
      const x = gx + (h1 - 0.5) * spread * (1 + 0.3 * ph) + 20 * Math.sin(t * 2 + i), y = FLOOR + 20 - ph * rise * (0.5 + h2) * 2.2;
      D.add(this.X(x), this.Y(y), (1.6 + 2.6 * h3) * s, k * 1.3 * Math.sin(ph * Math.PI), col);
    }
    D.flush('add', { gauss: 1 });
  }
}
