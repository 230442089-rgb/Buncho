// rd.js — 反応拡散（Gray–Scott）のシミュレーション。面の章で育て、立体の章でその模様を高さとして使う。
// 状態は「0 フレーム目から何ステップ進めたか」だけで決まるので、どのフレームからでも同じ絵に追いつける。
import { mulberry32 } from './core.js';

const FS_INIT = /* glsl */ `
uniform sampler2D uSeed;
out vec4 o;
void main(){
  float s = texture(uSeed, vUv).r;
  float n = hash21(gl_FragCoord.xy + 3.7);
  o = vec4(1.0 - 0.5 * s, 0.25 * s + 0.02 * n * s, 0.0, 1.0);
}`;

// 9 点ラプラシアン。F と k を場所でわずかに変えて、模様に表情をつける
const FS_STEP = /* glsl */ `
uniform sampler2D uTex; uniform float uF, uK, uDu, uDv, uDt;
out vec4 o;
void main(){
  vec2 t = 1.0 / uRes;
  vec2 c = texture(uTex, vUv).rg;
  vec2 l = texture(uTex, vUv + t * vec2(-1, 0)).rg + texture(uTex, vUv + t * vec2(1, 0)).rg + texture(uTex, vUv + t * vec2(0, -1)).rg + texture(uTex, vUv + t * vec2(0, 1)).rg;
  vec2 d = texture(uTex, vUv + t * vec2(-1, -1)).rg + texture(uTex, vUv + t * vec2(1, -1)).rg + texture(uTex, vUv + t * vec2(-1, 1)).rg + texture(uTex, vUv + t * vec2(1, 1)).rg;
  vec2 lap = 0.2 * l + 0.05 * d - c;
  float uvv = c.r * c.g * c.g;
  vec2 q = vUv - 0.5;
  float F = uF + 0.003 * sin(q.x * 5.0 + 1.3) * cos(q.y * 4.0), K = uK + 0.001 * cos(q.x * 3.0 - q.y * 5.0);
  float u = c.r + uDt * (uDu * lap.r - uvv + F * (1.0 - c.r));
  float v = c.g + uDt * (uDv * lap.g + uvv - (F + K) * c.g);
  o = vec4(clamp(u, 0.0, 1.0), clamp(v, 0.0, 1.0), 0.0, 1.0);
}`;

export class RD {
  constructor(g, w = 480, h = 270, { perFrame = 32, frames = 100 } = {}) {
    this.g = g; this.w = w; this.h = h; this.perFrame = perFrame; this.frames = frames;
    this.buf = g.double(w, h, { type: 'rg32f', filter: 'linear', wrap: 'clamp' });
    this.pInit = g.program(FS_INIT, 'rdInit');
    this.pStep = g.program(FS_STEP, 'rdStep');
    this.frame = -1;
    // 種: 中央の横一本の線（前の章の「線」）と、いくつかの点
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff';
    c.fillRect(0, h / 2 - 3, w, 6);
    const r = mulberry32(77);
    for (let i = 0; i < 22; i++) { const x = r() * w, y = r() * h; if (Math.abs(y - h / 2) < 26) continue; c.beginPath(); c.arc(x, y, 3.5 + r() * 2.5, 0, 7); c.fill(); }
    this.seed = g.texFromCanvas(cv);
  }
  reset() {
    this.g.draw(this.pInit, { uSeed: this.seed }, this.buf.read);
    this.frame = 0;
  }
  // n フレーム目の状態にする（1 フレーム = perFrame ステップ）
  ensure(n) {
    n = Math.max(0, Math.min(this.frames, Math.round(n)));
    const g = this.g, prev = g.cur;
    if (this.frame < 0 || n < this.frame) this.reset();
    while (this.frame < n) {
      for (let i = 0; i < this.perFrame; i++) {
        g.draw(this.pStep, { uTex: this.buf.read, uF: 0.029, uK: 0.057, uDu: 1.0, uDv: 0.5, uDt: 1.0 }, this.buf.write);
        this.buf.swap();
      }
      this.frame++;
    }
    g.bind(prev);            // 呼び出し側の描画先を元に戻す
    return this.buf.read;
  }
  get tex() { return this.buf.read; }
}

let inst = null;
export function getRD(g) { return inst || (inst = new RD(g)); }
