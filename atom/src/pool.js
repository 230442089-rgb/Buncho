// pool.js — 原子炉の水の底。燃料集合体の格子のあいだから、チェレンコフ光の青がにじむ（序章と結びで使う）
import { W, H, mulberry32, fract, TAU } from './core.js';
import { Dots } from './kit.js';

const FS_POOL = /* glsl */ `
uniform float uTime, uGlow, uCamH, uCamD, uYaw, uR;
out vec4 o;
float rbox(vec2 p, float b, float r){ vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, uCamH, -uCamD);
  vec3 f = normalize(vec3(0.0, 0.0, 0.3) - ro), r = normalize(cross(vec3(0.0, 1.0, 0.0), f)), u = cross(f, r);
  vec3 rd = normalize(p.x * r + p.y * u + 1.9 * f);
  // 水のゆらぎ: 視線をわずかに曲げる
  vec2 np = p * 1.7;
  vec2 wv = vec2(vnoise(np + vec2(uTime * 0.16, uTime * 0.10)) + 0.5 * vnoise(np * 2.1 - vec2(uTime * 0.13, -uTime * 0.09)),
                 vnoise(np + 13.7 - vec2(uTime * 0.14, uTime * 0.11)) + 0.5 * vnoise(np * 2.1 + 5.1 + vec2(uTime * 0.11, uTime * 0.15))) - 0.75;
  rd.xz += wv * 0.014; rd = normalize(rd);
  float t = -ro.y / min(rd.y, -0.05);
  vec2 q = rot(uYaw) * (ro + rd * t).xz;
  // 燃料集合体の格子（1 マス = 1 体）。上から見ると、集合体は暗い箱で、すき間の水が光っている
  vec2 cell = floor(q + 0.5), lp = q - cell;
  float rc = length(cell), rq = length(q);
  float inCore = smoothstep(uR + 0.5, uR - 0.5, rc);
  float aw = t / uRes.y * 1.3;
  float d = rbox(lp, 0.40, 0.06);
  float gap = smoothstep(-aw, aw, d);                                   // 集合体のすき間（水）
  float rim = smoothstep(-0.17, 0.0, d) * (1.0 - gap);                   // 箱の縁にまわりこむ光
  float core = exp(-rq * rq / (uR * uR) * 1.25);
  float e = inCore * (gap + rim * rim * 0.42 + 0.035) * (0.22 + 1.0 * core);
  float dOut = max(rq - uR, 0.0);
  float halo = exp(-dOut * 0.42) * (1.0 - inCore) * 0.16 + exp(-rq * 0.13) * 0.07;
  vec3 blue = vec3(0.020, 0.25, 1.0), hotb = vec3(0.30, 0.72, 1.0);
  vec3 col = blue * e * 1.9 + hotb * e * e * 0.9 + blue * halo;
  col *= 0.88 + 0.24 * vnoise(q * 1.3 + uTime * 0.5);
  col += blue * (0.085 + 0.05 * (wv.y + 0.75)) * exp(-pow(rq / (uR * 1.1), 2.0));   // 炉心の上の水が散らす光
  float fog = exp(-0.022 * t);
  col = col * fog + blue * 0.05 * (1.0 - fog);
  col *= smoothstep(19.0, 9.5, rq);
  col = col * uGlow + vec3(0.0005, 0.0016, 0.0050) * (0.6 + 0.4 * (wv.x + 0.75));
  o = vec4(col, 1.0);
}`;

export class Pool {
  constructor(env) {
    this.env = env;
    this.prog = env.g.program(FS_POOL, 'pool');
    this.dots = new Dots(env, 512);
    const rng = mulberry32(77);
    this.motes = Array.from({ length: 150 }, () => ({ x: rng(), y: rng(), z: 0.25 + 0.75 * rng(), s: rng(), ph: rng() * TAU }));
  }
  // glow 0..1, k: カメラの寄り 0（遠い）..1（近い）, dive: 炉心へ飛び込む 0..1
  draw(time, glow, k = 0, dive = 0) {
    const { g } = this.env;
    const camH = 19.0 - 5.5 * k - 11.5 * dive * dive, camD = 13.5 - 4.0 * k - 8.6 * dive * dive;
    g.draw(this.prog, { uTime: time, uGlow: glow * (1 + 1.6 * dive * dive), uCamH: camH, uCamD: camD, uYaw: 0.34 + 0.012 * time, uR: 6.2 });
    // 水中をただよう塵（光を受けて、ゆっくり上る）
    const d = this.dots.begin();
    for (const m of this.motes) {
      const y = fract(m.y - time * 0.012 * (0.4 + m.z)) * 1.1 - 0.05;
      const x = m.x + 0.012 * Math.sin(time * 0.31 + m.ph);
      const cx = W / 2 + (x - 0.5) * W * (0.9 + 0.5 * m.z), cy = y * H;
      const near = Math.exp(-Math.pow((cx - W / 2) / 760, 2) - Math.pow((cy - H * 0.52) / 420, 2));
      d.add(cx, cy, 1.2 + 2.6 * m.z * m.s, glow * (0.05 + 0.5 * near) * (0.4 + 0.6 * m.s), [0.35, 0.7, 1.0]);
    }
    d.flush('add', { gauss: 1 });
  }
}
let shared = null;
export const getPool = (env) => shared || (shared = new Pool(env));
