// shared.js — 場面をまたいで使う小さな描画部品（背景・光る点・円環）
let P = null;

const FS_BG = /* glsl */ `
uniform vec3 uA, uB; uniform vec2 uC; uniform float uR;
out vec4 o;
void main(){
  vec2 p = (gl_FragCoord.xy - uC) / uRes.y;
  float r = length(p);
  vec3 c = mix(uA, uB, smoothstep(0.0, uR, r));
  o = vec4(c, 1.0);
}`;

// 複数の点・円環をまとめて描く（加算）。uDots[i] = (x, y, 半径px, 強さ), uCols[i], uRings[i] = (x, y, 半径px, 太さpx), uRingA[i] = 強さ
const FS_DOTS = /* glsl */ `
uniform vec4 uDots[8]; uniform vec3 uCols[8]; uniform int uN;
uniform vec4 uRings[8]; uniform vec4 uRingCol[8]; uniform int uNR;
out vec4 o;
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 c = vec3(0.0);
  for (int i = 0; i < 8; i++){
    if (i >= uN) break;
    float d = length(p - uDots[i].xy) - uDots[i].z;
    c += uCols[i] * uDots[i].w * sat(0.5 - d);
  }
  for (int i = 0; i < 8; i++){
    if (i >= uNR) break;
    float d = abs(length(p - uRings[i].xy) - uRings[i].z) - uRings[i].w * 0.5;
    c += uRingCol[i].rgb * uRingCol[i].a * sat(0.5 - d);
  }
  o = vec4(c, 1.0);
}`;

export function shared(env) {
  if (P) return P;
  const { g } = env;
  const pBg = g.program(FS_BG, 'bg');
  const pDots = g.program(FS_DOTS, 'dots');
  P = {
    // 墨色の背景（中心がわずかに明るい）
    bg(a = [0.010, 0.012, 0.020], b = [0.0015, 0.0018, 0.0032], c = [env.W / 2, env.H / 2], r = 1.0) {
      g.draw(pBg, { uA: a, uB: b, uC: [c[0], env.H - c[1]], uR: r });
    },
    // dots: [{x,y,r,i,col:[r,g,b]}], rings: [{x,y,r,w,a,col}]
    dots(dots = [], rings = []) {
      const D = new Float32Array(32), C = new Float32Array(24), R = new Float32Array(32), RC = new Float32Array(32);
      dots.slice(0, 8).forEach((d, i) => { D.set([d.x, d.y, d.r, d.i ?? 1], i * 4); C.set(d.col || [1, 0.07, 0.024], i * 3); });
      rings.slice(0, 8).forEach((d, i) => { R.set([d.x, d.y, d.r, d.w ?? 1.5], i * 4); RC.set([...(d.col || [1, 0.07, 0.024]), d.a ?? 1], i * 4); });
      g.draw(pDots, { uDots: D, uCols: C, uN: Math.min(8, dots.length), uRings: R, uRingCol: RC, uNR: Math.min(8, rings.length) }, undefined, 'add');
    },
  };
  return P;
}

// 場面をまたいで位置を合わせる要素
export const LAYOUT = { lineX0: 330, lineX1: 1590, lineY: 540 };

// 朱色（HDR）。mul を上げるとブルームが強くかかる
export const SHU = (mul = 1) => [1.0 * mul, 0.085 * mul, 0.03 * mul];
export const PAPER = (mul = 1) => [0.905 * mul, 0.862 * mul, 0.791 * mul];
export const GOLD = (mul = 1) => [0.887 * mul, 0.558 * mul, 0.202 * mul];
