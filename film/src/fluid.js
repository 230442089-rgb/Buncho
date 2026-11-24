// fluid.js — 2 次元の流体（Stable Fluids）。速度は粗い格子で解き、染料は画面の解像度で流す。
// 1 フレーム = 1 ステップの決定的なシミュレーション（噴き出しは呼び出し側がフレーム番号から決める）。
import { W, H } from './core.js';

const MAXS = 10;

const FS_ADVECT = /* glsl */ `
uniform sampler2D uVel, uSrc; uniform vec2 uVelTexel; uniform float uDiss, uDt;
out vec4 o;
void main(){
  vec2 v = texture(uVel, vUv).xy;
  o = texture(uSrc, vUv - v * uVelTexel * uDt) * uDiss;
}`;
// 速度・染料への噴き出し（複数をまとめて 1 パスで）
const FS_SPLAT = /* glsl */ `
uniform sampler2D uSrc; uniform vec4 uPos[${MAXS}]; uniform vec4 uVal[${MAXS}]; uniform int uN; uniform float uAspect, uGain;
out vec4 o;
void main(){
  vec4 c = texture(uSrc, vUv);
  for (int i = 0; i < ${MAXS}; i++){
    if (i >= uN) break;
    vec2 d = (vUv - uPos[i].xy) * vec2(uAspect, 1.0);
    c += uVal[i] * uGain * exp(-dot(d, d) / (uPos[i].z * uPos[i].z));
  }
  o = c;
}`;
const FS_CURL = /* glsl */ `
uniform sampler2D uVel; out vec4 o;
void main(){
  vec2 t = 1.0 / uRes;
  float L = texture(uVel, vUv - vec2(t.x, 0.0)).y, R = texture(uVel, vUv + vec2(t.x, 0.0)).y, B = texture(uVel, vUv - vec2(0.0, t.y)).x, T = texture(uVel, vUv + vec2(0.0, t.y)).x;
  o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;
// 渦度の閉じ込め（細かい渦が数値拡散で消えないよう、渦を強める力を足す）＋ 外力（中心へ吸い込む・壁）
const FS_FORCE = /* glsl */ `
uniform sampler2D uVel, uCurl; uniform float uEps, uSuck, uAspect;
out vec4 o;
void main(){
  vec2 t = 1.0 / uRes;
  float L = abs(texture(uCurl, vUv - vec2(t.x, 0.0)).x), R = abs(texture(uCurl, vUv + vec2(t.x, 0.0)).x), B = abs(texture(uCurl, vUv - vec2(0.0, t.y)).x), T = abs(texture(uCurl, vUv + vec2(0.0, t.y)).x);
  float C = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(T - B, L - R);
  f = f / (length(f) + 1e-4) * uEps * C;
  vec2 v = texture(uVel, vUv).xy + f;
  vec2 c = (vUv - 0.5) * vec2(uAspect, 1.0); float r = length(c);
  v += -normalize(c + 1e-5) * uSuck * smoothstep(0.0, 0.25, r) + vec2(-c.y, c.x) * uSuck * 2.2;      // 吸い込みながら渦を巻く
  vec2 e = min(vUv, 1.0 - vUv) * uRes;
  v *= smoothstep(0.0, 2.0, min(e.x, e.y));                                                           // 壁では止まる
  o = vec4(clamp(v, -40.0, 40.0), 0.0, 1.0);
}`;
const FS_DIV = /* glsl */ `
uniform sampler2D uVel; out vec4 o;
void main(){
  vec2 t = 1.0 / uRes;
  float L = texture(uVel, vUv - vec2(t.x, 0.0)).x, R = texture(uVel, vUv + vec2(t.x, 0.0)).x, B = texture(uVel, vUv - vec2(0.0, t.y)).y, T = texture(uVel, vUv + vec2(0.0, t.y)).y;
  o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;
const FS_JACOBI = /* glsl */ `
uniform sampler2D uP, uDiv; out vec4 o;
void main(){
  vec2 t = 1.0 / uRes;
  float L = texture(uP, vUv - vec2(t.x, 0.0)).x, R = texture(uP, vUv + vec2(t.x, 0.0)).x, B = texture(uP, vUv - vec2(0.0, t.y)).x, T = texture(uP, vUv + vec2(0.0, t.y)).x;
  o = vec4((L + R + B + T - texture(uDiv, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`;
const FS_GRAD = /* glsl */ `
uniform sampler2D uP, uVel; out vec4 o;
void main(){
  vec2 t = 1.0 / uRes;
  float L = texture(uP, vUv - vec2(t.x, 0.0)).x, R = texture(uP, vUv + vec2(t.x, 0.0)).x, B = texture(uP, vUv - vec2(0.0, t.y)).x, T = texture(uP, vUv + vec2(0.0, t.y)).x;
  o = vec4(texture(uVel, vUv).xy - 0.5 * vec2(R - L, T - B), 0.0, 1.0);
}`;
const FS_CLEAR = /* glsl */ `uniform vec4 uC; out vec4 o; void main(){ o = uC; }`;
// 染料を光る絹のように見せる（濃さの勾配から法線をつくって、つやを足す）
const FS_SHOW = /* glsl */ `
uniform sampler2D uDye; uniform float uGain, uBg;
out vec4 o;
void main(){
  vec2 t = 1.0 / uRes;
  vec3 c = texture(uDye, vUv).rgb;
  c /= 1.0 + 0.30 * luma(c);                       // 濃いところを、色みを保ったまま抑える
  float l = luma(c), lx = luma(texture(uDye, vUv + vec2(t.x * 1.5, 0.0)).rgb), ly = luma(texture(uDye, vUv + vec2(0.0, t.y * 1.5)).rgb);
  vec3 n = normalize(vec3((l - lx) * 5.0, (l - ly) * 5.0, 1.0));
  vec3 ld = normalize(vec3(-0.4, 0.5, 0.75));
  float dif = sat(dot(n, ld)), spec = pow(sat(dot(reflect(-ld, n), vec3(0.0, 0.0, 1.0))), 22.0);
  vec3 col = c * (0.55 + 0.75 * dif) + vec3(1.0, 0.95, 0.88) * spec * smoothstep(0.02, 0.6, l) * 0.55;
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
  vec3 bg = mix(vec3(0.010, 0.012, 0.022), vec3(0.0015, 0.0018, 0.0034), smoothstep(0.0, 0.95, length(q))) * uBg;
  o = vec4(bg + col * uGain, 1.0);
}`;

export class Fluid {
  constructor(g, sw = 384, sh = 216) {
    this.g = g; this.sw = sw; this.sh = sh;
    this.vel = g.double(sw, sh, { type: 'rg16f', filter: 'linear' });
    this.prs = g.double(sw, sh, { type: 'r16f', filter: 'nearest' });
    this.div = g.target(sw, sh, { type: 'r16f', filter: 'nearest' });
    this.curl = g.target(sw, sh, { type: 'r16f', filter: 'nearest' });
    this.dye = g.double(W, H, { type: 'rgba16f', filter: 'linear' });
    this.pAdvect = g.program(FS_ADVECT, 'flAdvect', { common: false });
    this.pSplat = g.program(FS_SPLAT, 'flSplat', { common: false });
    this.pCurl = g.program(FS_CURL, 'flCurl', { common: false });
    this.pForce = g.program(FS_FORCE, 'flForce', { common: false });
    this.pDiv = g.program(FS_DIV, 'flDiv', { common: false });
    this.pJac = g.program(FS_JACOBI, 'flJacobi', { common: false });
    this.pGrad = g.program(FS_GRAD, 'flGrad', { common: false });
    this.pClear = g.program(FS_CLEAR, 'flClear', { common: false });
    this.pShow = g.program(FS_SHOW, 'flShow');
    this.frame = -1;
    this.P = new Float32Array(MAXS * 4); this.V = new Float32Array(MAXS * 4); this.C = new Float32Array(MAXS * 4);
  }
  reset() {
    const g = this.g;
    for (const t of [this.vel.a, this.vel.b, this.prs.a, this.prs.b, this.dye.a, this.dye.b]) g.draw(this.pClear, { uC: [0, 0, 0, 1] }, t);
    this.frame = 0;
  }
  // splats: [{x, y (0..1, y は上向き), r (高さに対する半径), vx, vy (格子/ステップ), col:[r,g,b]}]
  step(splats, { suck = 0, vort = 0.32, velDiss = 0.9975, dyeDiss = 0.992, iters = 26 } = {}) {
    const g = this.g, vt = [1 / this.sw, 1 / this.sh], asp = W / H;
    // 1) 速度を自分自身で運ぶ
    g.draw(this.pAdvect, { uVel: this.vel.read, uSrc: this.vel.read, uVelTexel: vt, uDiss: velDiss, uDt: 1 }, this.vel.write); this.vel.swap();
    // 2) 噴き出し
    const n = Math.min(MAXS, splats.length);
    if (n) {
      for (let i = 0; i < n; i++) { const s = splats[i]; this.P.set([s.x, s.y, s.r, 0], i * 4); this.V.set([s.vx, s.vy, 0, 0], i * 4); this.C.set([s.col[0], s.col[1], s.col[2], 0], i * 4); }
      g.draw(this.pSplat, { uSrc: this.vel.read, uPos: this.P, uVal: this.V, uN: n, uAspect: asp, uGain: 1 }, this.vel.write); this.vel.swap();
      g.draw(this.pSplat, { uSrc: this.dye.read, uPos: this.P, uVal: this.C, uN: n, uAspect: asp, uGain: 1 }, this.dye.write); this.dye.swap();
    }
    // 3) 渦度の閉じ込めと外力
    g.draw(this.pCurl, { uVel: this.vel.read }, this.curl);
    g.draw(this.pForce, { uVel: this.vel.read, uCurl: this.curl, uEps: vort, uSuck: suck, uAspect: asp }, this.vel.write); this.vel.swap();
    // 4) 圧力を解いて、発散をなくす（非圧縮）
    g.draw(this.pDiv, { uVel: this.vel.read }, this.div);
    g.draw(this.pClear, { uC: [0, 0, 0, 1] }, this.prs.read);
    for (let i = 0; i < iters; i++) { g.draw(this.pJac, { uP: this.prs.read, uDiv: this.div }, this.prs.write); this.prs.swap(); }
    g.draw(this.pGrad, { uP: this.prs.read, uVel: this.vel.read }, this.vel.write); this.vel.swap();
    // 5) 染料を流れで運ぶ
    g.draw(this.pAdvect, { uVel: this.vel.read, uSrc: this.dye.read, uVelTexel: vt, uDiss: dyeDiss, uDt: 1 }, this.dye.write); this.dye.swap();
    this.frame++;
  }
  show(target, gain = 1, bg = 1) { this.g.draw(this.pShow, { uDye: this.dye.read, uGain: gain, uBg: bg }, target); }
}
