// post.js — HDR バッファ → ブルーム → 色収差 → 周辺減光 → トーンマップ → 粒状・ディザ
import { W, H } from './core.js';

const FS_DOWN = /* glsl */ `
uniform sampler2D uTex; uniform float uFirst; uniform float uThreshold; uniform float uKnee;
out vec4 o;
vec3 pre(vec3 c){
  if (uFirst < 0.5) return c;
  c = min(c, vec3(64.0));
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
  return c * max(soft, br - uThreshold) / max(br, 1e-4);
}
float kw(vec3 c){ return uFirst > 0.5 ? 1.0 / (1.0 + luma(c)) : 1.0; } // 1段目は Karis 平均でちらつきを抑える
void main(){
  vec2 t = 1.0 / vec2(textureSize(uTex, 0));
  vec3 a = pre(texture(uTex, vUv + t * vec2(-2, 2)).rgb), b = pre(texture(uTex, vUv + t * vec2(0, 2)).rgb), c = pre(texture(uTex, vUv + t * vec2(2, 2)).rgb);
  vec3 d = pre(texture(uTex, vUv + t * vec2(-2, 0)).rgb), e = pre(texture(uTex, vUv).rgb), f = pre(texture(uTex, vUv + t * vec2(2, 0)).rgb);
  vec3 g = pre(texture(uTex, vUv + t * vec2(-2, -2)).rgb), h = pre(texture(uTex, vUv + t * vec2(0, -2)).rgb), i = pre(texture(uTex, vUv + t * vec2(2, -2)).rgb);
  vec3 j = pre(texture(uTex, vUv + t * vec2(-1, 1)).rgb), k = pre(texture(uTex, vUv + t * vec2(1, 1)).rgb), l = pre(texture(uTex, vUv + t * vec2(-1, -1)).rgb), m = pre(texture(uTex, vUv + t * vec2(1, -1)).rgb);
  vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
  float w0 = kw(g0) * 0.125, w1 = kw(g1) * 0.125, w2 = kw(g2) * 0.125, w3 = kw(g3) * 0.125, w4 = kw(g4) * 0.5;
  o = vec4((g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4), 1.0);
}`;

const FS_UP = /* glsl */ `
uniform sampler2D uLow; uniform sampler2D uHigh; uniform float uRadius; uniform float uMix;
out vec4 o;
void main(){
  vec2 t = uRadius / vec2(textureSize(uLow, 0));
  vec3 s = texture(uLow, vUv).rgb * 4.0;
  s += (texture(uLow, vUv + t * vec2(1, 0)).rgb + texture(uLow, vUv + t * vec2(-1, 0)).rgb + texture(uLow, vUv + t * vec2(0, 1)).rgb + texture(uLow, vUv + t * vec2(0, -1)).rgb) * 2.0;
  s += texture(uLow, vUv + t * vec2(1, 1)).rgb + texture(uLow, vUv + t * vec2(-1, 1)).rgb + texture(uLow, vUv + t * vec2(1, -1)).rgb + texture(uLow, vUv + t * vec2(-1, -1)).rgb;
  o = vec4(mix(texture(uHigh, vUv).rgb, s / 16.0, uMix), 1.0);
}`;

const FS_FINAL = /* glsl */ `
uniform sampler2D uScene; uniform sampler2D uBloom;
uniform float uBloomAmt, uExposure, uVignette, uCA, uGrain, uDither, uFlash, uFade, uSeed, uContrast, uSaturation, uLetterbox, uScrim;
uniform vec3 uTint; uniform vec3 uLift;
out vec4 o;
// 0.75 までは素通し、その上をなだらかに 1 へ収める（グラフィックの色を変えずにハイライトだけ丸める）
vec3 softclip(vec3 x){ const float a = 0.75; vec3 y = (x - a) / (1.0 - a); return mix(x, a + (1.0 - a) * (1.0 - exp(-y)), step(a, x)); }
void main(){
  vec2 uv = vUv, c = uv - 0.5;
  float r2 = dot(c * vec2(uRes.x / uRes.y, 1.0), c * vec2(uRes.x / uRes.y, 1.0));
  vec3 col;
  if (uCA > 0.0) {
    float k = uCA * r2;
    col.r = texture(uScene, 0.5 + c * (1.0 + k)).r; col.g = texture(uScene, uv).g; col.b = texture(uScene, 0.5 + c * (1.0 - k)).b;
  } else col = texture(uScene, uv).rgb;
  vec3 bl = texture(uBloom, uv).rgb;
  col += bl * uBloomAmt;
  col *= uExposure;
  col *= mix(1.0, smoothstep(1.25, 0.15, r2 * 1.6), uVignette);
  col *= 1.0 - uScrim * smoothstep(0.36, 0.0, uv.y);          // 字幕のための下辺の落とし
  col = mix(vec3(luma(col)), col, uSaturation);
  col = softclip(col * uTint);
  col = toSRGB(col);
  col = mix(vec3(0.5), col, uContrast) + uLift;
  col = mix(col, vec3(1.0), uFlash);
  col *= uFade;
  // 8bit 量子化のディザ（画面に固定。毎フレーム変えると動画の符号量が跳ね上がるので動かさない）
  vec3 ns = hash33(vec3(gl_FragCoord.xy, 0.0)) + hash33(vec3(gl_FragCoord.xy + 71.7, 3.1)) - 1.0;
  col += ns * uDither / 255.0;
  // 粒状（必要な場面だけ。中間調で強く、黒と白では弱く）
  if (uGrain > 0.0) {
    vec3 n = hash33(vec3(gl_FragCoord.xy, uSeed)) + hash33(vec3(gl_FragCoord.xy + 71.7, uSeed + 3.1)) - 1.0;
    float l = luma(col);
    col += n.x * uGrain * (0.25 + 1.5 * l * (1.0 - l));
  }
  float lb = step(abs(c.y), 0.5 - uLetterbox);
  o = vec4(col * lb, 1.0);
}`;

const FS_COPY = /* glsl */ `uniform sampler2D uTex; uniform float uMul; out vec4 o; void main(){ o = vec4(texture(uTex, vUv).rgb * uMul, 1.0); }`;

export const POST_DEFAULTS = {
  bloom: 0.55, threshold: 0.75, knee: 0.5, radius: 1.0, exposure: 1.0, vignette: 0.55, ca: 0.012, grain: 0.0, dither: 1.0,
  flash: 0, fade: 1, contrast: 1.0, saturation: 1.0, tint: [1, 1, 1], lift: [0, 0, 0], letterbox: 0, scrim: 0,
};

export class Post {
  constructor(g) {
    this.g = g;
    this.hdr = g.target(W, H, { type: 'rgba16f' });
    this.aux = g.target(W, H, { type: 'rgba16f' });   // 場面が合成用に借りられる予備
    this.levels = [];
    let w = W >> 1, h = H >> 1;
    for (let i = 0; i < 7; i++) { this.levels.push({ d: g.target(w, h, { type: 'rgba16f' }), u: g.target(w, h, { type: 'rgba16f' }) }); w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); }
    this.pDown = g.program(FS_DOWN, 'bloomDown');
    this.pUp = g.program(FS_UP, 'bloomUp');
    this.pFinal = g.program(FS_FINAL, 'final');
    this.pCopy = g.program(FS_COPY, 'copy');
  }
  begin() { this.g.bind(this.hdr); this.g.clear(0, 0, 0, 1); }
  copy(src, dst, mul = 1, blend = 'none') { this.g.draw(this.pCopy, { uTex: src, uMul: mul }, dst, blend); }
  end(p, frame) {
    const g = this.g, L = this.levels;
    let src = this.hdr;
    for (let i = 0; i < L.length; i++) {
      g.draw(this.pDown, { uTex: src, uFirst: i === 0 ? 1 : 0, uThreshold: p.threshold, uKnee: p.knee }, L[i].d);
      src = L[i].d;
    }
    // 下の段から順に広げて足し戻す
    let low = L[L.length - 1].d;
    for (let i = L.length - 2; i >= 0; i--) {
      g.draw(this.pUp, { uLow: low, uHigh: L[i].d, uRadius: p.radius, uMix: 0.62 }, L[i].u);
      low = L[i].u;
    }
    g.draw(this.pFinal, {
      uScene: this.hdr, uBloom: low, uBloomAmt: p.bloom, uExposure: p.exposure, uVignette: p.vignette, uCA: p.ca, uGrain: p.grain, uDither: p.dither,
      uFlash: p.flash, uFade: p.fade, uSeed: frame % 1024, uContrast: p.contrast, uSaturation: p.saturation, uTint: p.tint, uLift: p.lift,
      uLetterbox: p.letterbox, uScrim: p.scrim,
    }, null);
  }
}
