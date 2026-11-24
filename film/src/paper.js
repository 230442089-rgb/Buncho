// paper.js — 和紙と墨の GLSL（面の章と、立体の章の冒頭で共有する）
export const GLSL_PAPER = /* glsl */ `
const vec3 INK = vec3(0.010, 0.011, 0.017);
const vec3 SHU_INK = vec3(0.86, 0.072, 0.03);
const vec3 AI_INK = vec3(0.020, 0.078, 0.215);
vec3 paperTex(vec2 p){
  vec2 q = p / 1080.0;
  float mott = fbm(q * 2.6 + 7.0);
  vec2 wq = q + 0.035 * vec2(fbm(q * 2.3 + 3.1), fbm(q * 2.3 + 9.7));     // 繊維をゆるく曲げる
  float fib = 0.0;
  for (int i = 0; i < 5; i++){
    vec2 r = rot(float(i) * 1.37 + 0.35) * (wq + float(i) * 3.17);
    fib += smoothstep(0.66, 0.97, vnoise(r * vec2(120.0, 7.0))) * (0.5 + 0.5 * vnoise(r * vec2(9.0, 3.0) + 5.0));
  }
  float tooth = hash21(floor(p)) - 0.5;
  return C_PAPER * (0.985 + 0.05 * mott - 0.026 * fib + 0.012 * tooth);
}
// 見出し（左上）と札（右上）のまわりには墨をのせない（余白）
float reserve(vec2 p){
  float a = sdBox(p - vec2(238.0, 108.0), vec2(168.0, 20.0)) - 44.0;
  float b = sdBox(p - vec2(1612.0, 134.0), vec2(214.0, 52.0)) - 44.0;
  return 1.0 - smoothstep(-9.0, 9.0, min(a, b));
}
vec3 inkOn(vec3 pap, vec3 ink, float a){ return mix(pap, ink * (0.82 + 0.2 * luma(pap)), a); }
`;

