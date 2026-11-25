// shaders.js — GLSL。
//   地形・空・水の式は 1 本目の映像（film/src/world.js）と同じもの。
//   ちがいは「毎フレーム 60 回描ける」ようにしたところ:
//     ・ノイズ（雲・波・岩肌・草・雪）は起動時にテクスチャへ焼いておき、描くときは引くだけにする
//     ・山の影は、光線をたどる代わりに「影の高さの地図」を太陽が動くたびに作り直す
//     ・遠くほど粗い高さ（ミップ）を使い、ちらつきと負荷を減らす

export const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
#define PI 3.14159265359
#define TAU 6.28318530718
#define sat(x) clamp(x, 0.0, 1.0)
`;

// ---- 焼き込み用のノイズ（整数ハッシュ。映像と同じ）
const NOISE = `
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uvec2 pcg2(uvec2 v){ v = v * 1664525u + 1013904223u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; return v; }
uvec3 pcg3(uvec3 v){ v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v; }
const float INV32 = 1.0 / 4294967295.0;
float hashi(ivec2 p){ return float(pcg2(uvec2(p)).x) * INV32; }
vec2  hashi2(ivec2 p){ return vec2(pcg2(uvec2(p))) * INV32; }
vec3  hashi3(ivec3 p){ return vec3(pcg3(uvec3(p))) * INV32; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0); ivec2 q = ivec2(i);
  return mix(mix(hashi(q), hashi(q + ivec2(1,0)), u.x), mix(hashi(q + ivec2(0,1)), hashi(q + ivec2(1,1)), u.x), u.y);
}
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0); ivec2 q = ivec2(i);
  #define GR2(o) dot(normalize(hashi2(q + o) * 2.0 - 1.0 + 1e-4), f - vec2(o))
  return 1.4142 * mix(mix(GR2(ivec2(0,0)), GR2(ivec2(1,0)), u.x), mix(GR2(ivec2(0,1)), GR2(ivec2(1,1)), u.x), u.y);
}
float gnoise3(vec3 p){
  vec3 i = floor(p), f = fract(p); vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0); ivec3 q = ivec3(i);
  #define GR3(o) dot(hashi3(q + o) * 2.0 - 1.0, f - vec3(o))
  return 1.6 * mix(mix(mix(GR3(ivec3(0,0,0)), GR3(ivec3(1,0,0)), u.x), mix(GR3(ivec3(0,1,0)), GR3(ivec3(1,1,0)), u.x), u.y),
             mix(mix(GR3(ivec3(0,0,1)), GR3(ivec3(1,0,1)), u.x), mix(GR3(ivec3(0,1,1)), GR3(ivec3(1,1,1)), u.x), u.y), u.z);
}
const mat2 M2 = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * gnoise(p); p = M2 * p + 17.3; a *= 0.5; } return s; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * gnoise3(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
// くり返しても継ぎ目の出ないノイズ（格子を周期 per で折り返す）
ivec2 wrapi(ivec2 q, int P){ return ((q % P) + P) % P; }
float gnoiseP(vec2 p, int P){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0); ivec2 q = ivec2(i);
  #define GP2(o) dot(normalize(hashi2(wrapi(q + o, P)) * 2.0 - 1.0 + 1e-4), f - vec2(o))
  return 1.4142 * mix(mix(GP2(ivec2(0,0)), GP2(ivec2(1,0)), u.x), mix(GP2(ivec2(0,1)), GP2(ivec2(1,1)), u.x), u.y);
}
float vnoiseP(vec2 p, int P, int seed){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0); ivec2 q = ivec2(i), s = ivec2(seed * 131, seed * 57);
  return mix(mix(hashi(wrapi(q, P) + s), hashi(wrapi(q + ivec2(1,0), P) + s), u.x), mix(hashi(wrapi(q + ivec2(0,1), P) + s), hashi(wrapi(q + ivec2(1,1), P) + s), u.x), u.y);
}
float fbmP(vec2 p, int P){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * gnoiseP(p, P); p = p * 2.0 + vec2(17.0, 31.0); P *= 2; a *= 0.5; } return s; }
`;

// ---- 地形（映像と同じ式）: 微分で侵食風に抑えた fBm ＋ 谷と湖
export const WORLD = { size: 128, cx: 0, cz: 30, res: 2048, cloudY: 9.0, waterY: -0.02 };
const TERRAIN = `
vec3 noised(vec2 x){
  vec2 i = floor(x), f = fract(x);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0), du = 30.0*f*f*(f*(f-2.0)+1.0);
  ivec2 q = ivec2(i);
  float a = hashi(q), b = hashi(q + ivec2(1,0)), c = hashi(q + ivec2(0,1)), d = hashi(q + ivec2(1,1));
  return vec3(a + (b-a)*u.x + (c-a)*u.y + (a-b-c+d)*u.x*u.y, du * (vec2(b-a, c-a) + (a-b-c+d)*u.yx));
}
const mat2 TM = mat2(0.8, -0.6, 0.6, 0.8);
float tfbm(vec2 p, int oct){
  float a = 0.0, b = 1.0; vec2 d = vec2(0.0);
  for (int i = 0; i < oct; i++){
    vec3 n = noised(p); d += n.yz; a += b * n.x / (1.0 + dot(d, d)); b *= 0.5; p = TM * p * 2.0;
  }
  return a;
}
float valleyX(float z){ return 3.4 * sin(z * 0.105 + 0.5) + 1.5 * sin(z * 0.23 + 2.1); }
float corridorW(float z){ return mix(2.6, 7.5, smoothstep(2.0, 19.0, z)) + 15.0 * smoothstep(22.0, 40.0, z); }
float terrainH(vec2 p, int oct){
  float m = tfbm(p * 0.07 + vec2(13.7, 4.2), oct);
  float dx = abs(p.x - valleyX(p.y) * (1.0 - 0.6 * smoothstep(24.0, 40.0, p.y)));
  float w = corridorW(p.y);
  float far = smoothstep(54.0, 68.0, p.y + 0.35 * p.x * sin(p.x * 0.08));
  float mask = max(smoothstep(w * 0.5, w + mix(6.0, 9.0, smoothstep(2.0, 19.0, p.y)), dx), far);
  float hills = tfbm(p * 0.19 + vec2(3.0, 8.0), min(oct, 7)) - 0.62;
  float mount = 8.4 * m - 1.3;
  float h = mix(-0.95 + 1.5 * hills, mount, mask);
  vec2 hp = p - vec2(7.0, 74.0); h += 3.4 * exp(-dot(hp, hp) / 70.0) * far;
  return h;
}
const vec2 WC = vec2(${WORLD.cx.toFixed(1)}, ${WORLD.cz.toFixed(1)}); const float WS = ${WORLD.size.toFixed(1)};
`;

// 高さ → 24bit（RGBA8 に詰めて読み戻す。浮動小数の描画先が無い端末でも同じ手順で動く）
export const H_MIN = -4.0, H_RANGE = 20.0;
export const FS_BAKE_H = HEAD + NOISE + TERRAIN + `
in vec2 vUv; out vec4 o;
void main(){
  vec2 p = (vUv - 0.5) * WS + WC;
  float v = clamp((terrainH(p, 9) - (${H_MIN.toFixed(1)})) / ${H_RANGE.toFixed(1)}, 0.0, 0.9999999);
  vec3 e = fract(v * vec3(1.0, 255.0, 65025.0)); e -= e.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
  o = vec4(e, 1.0);
}`;

// 地表の模様: R = 低い周波数のむら, G = 岩肌, B = 草, A = 雪ぎわ
export const FS_BAKE_AUX = HEAD + NOISE + TERRAIN + `
in vec2 vUv; out vec4 o;
void main(){
  vec2 p = (vUv - 0.5) * WS + WC;
  o = vec4(fbm(p * 0.45) * 0.5 + 0.5, vnoise(p * 2.6), vnoise(p * 1.1 + 4.0), vnoise(p * 3.0));
}`;

// 雲: R, G = 継ぎ目のない fBm（2 種類）
export const FS_BAKE_CLOUD = HEAD + NOISE + `
in vec2 vUv; out vec4 o;
void main(){
  vec2 q = vUv * 8.0;
  o = vec4(fbmP(q, 8) * 0.5 + 0.5, fbmP(q + vec2(3.0, 5.0), 8) * 0.5 + 0.5, fbmP(q * 0.5 + vec2(9.0, 2.0), 4) * 0.5 + 0.5, 1.0);
}`;

// 波: RG = 勾配（/8 + 0.5）, B = 高さ
export const WAVE_P = 32, WAVE_RES = 1024;
export const FS_BAKE_WAVE = HEAD + NOISE + `
in vec2 vUv; out vec4 o;
void main(){
  vec2 q = vUv * ${WAVE_P}.0; float e = 0.5 * ${WAVE_P}.0 / ${WAVE_RES}.0;
  float hx = gnoiseP(q + vec2(e, 0.0), ${WAVE_P}) - gnoiseP(q - vec2(e, 0.0), ${WAVE_P});
  float hy = gnoiseP(q + vec2(0.0, e), ${WAVE_P}) - gnoiseP(q - vec2(0.0, e), ${WAVE_P});
  o = vec4(vec2(hx, hy) / (2.0 * e) / 8.0 + 0.5, gnoiseP(q, ${WAVE_P}) * 0.5 + 0.5, 1.0);
}`;

// こまかい模様: R = 値ノイズ, GB = その勾配（/6 + 0.5）, A = もうひとつの値ノイズ
export const NOISE_P = 32, NOISE_RES = 256;
export const FS_BAKE_NOISE = HEAD + NOISE + `
in vec2 vUv; out vec4 o;
void main(){
  vec2 q = vUv * ${NOISE_P}.0; float e = 0.5 * ${NOISE_P}.0 / ${NOISE_RES}.0;
  float hx = vnoiseP(q + vec2(e, 0.0), ${NOISE_P}, 1) - vnoiseP(q - vec2(e, 0.0), ${NOISE_P}, 1);
  float hy = vnoiseP(q + vec2(0.0, e), ${NOISE_P}, 1) - vnoiseP(q - vec2(0.0, e), ${NOISE_P}, 1);
  o = vec4(vnoiseP(q, ${NOISE_P}, 1), vec2(hx, hy) / (2.0 * e) / 6.0 + 0.5, vnoiseP(q, ${NOISE_P}, 7));
}`;

// 天の川（正距円筒図法。色は sqrt(c * 6) で詰める）
export const FS_BAKE_MILKY = HEAD + NOISE + `
in vec2 vUv; out vec4 o;
void main(){
  float lon = (vUv.x - 0.5) * TAU, lat = (vUv.y - 0.5) * PI;
  vec3 q = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  vec3 pole = normalize(vec3(0.55, 0.25, 0.80));
  float band = exp(-pow(dot(q, pole) / 0.22, 2.0));
  float dust = fbm3(q * 5.0) * 0.5 + 0.5, dust2 = fbm3(q * 11.0 + 3.0) * 0.5 + 0.5;
  vec3 c = band * vec3(0.034, 0.040, 0.066) * (0.4 + 1.6 * dust * dust) * (0.30 + 0.70 * smoothstep(0.25, 0.7, dust2));
  o = vec4(sqrt(sat(c * 6.0)), 1.0);
}`;

// ---- 影の高さの地図（太陽に向かって 1, 2, 4, … 画素ずつ倍々に調べる）
//   R = その地点で影に入っている高さ（地面から）, G = 影を落としている山までの距離, B = 地面の高さ
export const FS_SHADOW = HEAD + `
in vec2 vUv; out vec4 o;
uniform sampler2D uPrev, uH;
uniform vec2 uStep; uniform float uDrop, uDist, uFirst, uLod;
float H(vec2 uv){ vec2 t = textureLod(uH, uv, uLod).rg; return t.x + t.y; }
void main(){
  float h0 = H(vUv), h1 = H(vUv + uStep);
  vec4 a = vec4(0.0), b = vec4(0.0);
  if (uFirst < 0.5){ a = textureLod(uPrev, vUv, 0.0); b = textureLod(uPrev, vUv + uStep, 0.0); }
  float d1 = b.r + h1 - h0 - uDrop;
  o = d1 > a.r ? vec4(d1, b.g + uDist, h0, 1.0) : vec4(a.r, a.g, h0, 1.0);
}`;

// ---- 世界を描く
//   Q: { STEPS, RSTEPS, SHAFTS, HDR, DETAIL }
export const FS_WORLD = (Q) => HEAD + `
#define STEPS ${Q.STEPS}
#define RSTEPS ${Q.RSTEPS}
#define SHAFTS ${Q.SHAFTS}
#define HDR ${Q.HDR}
#define SHADOWS ${Q.SHADOWS}
in vec2 vUv; out vec4 o;
uniform sampler2D uH, uMaxH, uAux, uShadow, uCloud, uWave, uNoise, uMilky;
uniform vec2 uRes;
uniform vec3 uRo; uniform mat3 uCam; uniform float uFocal, uPix, uTop;
uniform float uTime, uCloudT, uCover, uExposure, uFog, uMist, uSnow, uNight, uHorFall, uHorPow, uWaterY, uWave_, uHTex, uShadowOn;
uniform vec3 uSun, uMoon;
uniform vec3 uZen, uHorS, uHorA, uMidS, uMidA, uGlow, uSunCol, uSunColHigh, uSunDisk, uMoonCol, uMoonDisk;
uniform mat3 uStarM;
uniform vec3 uYuPos, uYuGlow;
uniform vec4 uRip[4];

const vec2 WC = vec2(${WORLD.cx.toFixed(1)}, ${WORLD.cz.toFixed(1)}); const float WS = ${WORLD.size.toFixed(1)};
const float CLOUD_Y = ${WORLD.cloudY.toFixed(1)};
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

// ================= 高さ
vec2 wuv(vec2 xz){ return (xz - WC) / WS + 0.5; }
float mapH(vec2 xz, float lod){ vec2 t = textureLod(uH, wuv(xz), lod).rg; return t.x + t.y; }
float lodAt(float t){ return clamp(log2(max(t * uPix * 0.85 / uHTex, 1.0)), 0.0, 5.0); }
// 光線と地形の交点。最大高さのピラミッドで、地形より確実に上にいる間は大きく進む
bool gOut;       // 歩数を使い切った（当たりも外れも決まらなかった）
float castRay(vec3 ro, vec3 rd, float tmin, float tmax, int steps, float ms){
  float t = tmin;
  float hl = max(length(rd.xz), 1e-4);
  float lod = 3.0;
  gOut = true;
  for (int i = 0; i < STEPS; i++){
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    if (p.y > uTop && rd.y > 0.0){ t = tmax + 1.0; gOut = false; break; }
    float hm = textureLod(uMaxH, wuv(p.xz), lod).r;
    if (p.y > hm + 0.01){
      float ds = 0.125 * exp2(lod) / hl;
      if (rd.y < 0.0) ds = min(ds, (p.y - hm) / (-rd.y) + 0.004);
      t += ds; lod = min(lod + 1.0, 8.0);
      if (t > tmax){ gOut = false; break; }
      continue;
    }
    if (lod > 0.5){ lod = max(lod - 2.0, 0.0); continue; }
    float h = p.y - mapH(p.xz, lodAt(t));
    if (h < 0.0016 * t || t > tmax){ gOut = false; break; }
    t += max(0.44 * h, ms) + 0.0010 * t;
  }
  return t;
}
vec3 calcNormal(vec3 p, float t){
  float lod = lodAt(t), e = max(0.62 * uHTex * exp2(lod), 0.0012 * t);
  float hx = mapH(p.xz + vec2(e, 0.0), lod) - mapH(p.xz - vec2(e, 0.0), lod);
  float hz = mapH(p.xz + vec2(0.0, e), lod) - mapH(p.xz - vec2(0.0, e), lod);
  return normalize(vec3(-hx, 2.0 * e, -hz));
}

// ================= 影（影の高さの地図を引く）
float sunShadow(vec3 p){
#if SHADOWS
  if (uShadowOn < 0.5) return 1.0;
  vec4 sm = textureLod(uShadow, wuv(p.xz), 0.0);
  float dd = sm.b + sm.r - p.y;
  return 1.0 - smoothstep(0.012, 0.045 + 0.030 * sm.g, dd);
#else
  return 1.0;
#endif
}

// ================= 空（色は時刻ごとの見本を JS 側で補間して渡す）
vec3 sunAt(float alt){ return mix(uSunCol, uSunColHigh, smoothstep(0.0, 7.0, alt)); }
vec3 skyRad(vec3 rd, vec3 sd){
  float y = max(rd.y, 0.0);
  float az = dot(normalize(rd.xz + 1e-5), normalize(sd.xz + 1e-5)) * 0.5 + 0.5;
  float a = pow(az, uHorPow);
  vec3 hor = mix(uHorA, uHorS, a), mid = mix(uMidA, uMidS, a);
  vec3 c = mix(uZen, mid, exp(-y * uHorFall));
  c = mix(c, hor, exp(-y * uHorFall * 3.2));
  float mu = max(dot(rd, sd), 0.0);
  c += uGlow * (0.30 * pow(mu, 5.0) + 0.85 * pow(mu, 40.0));
  return c;
}
vec3 nightSky(vec3 rd){
  vec3 q = uStarM * rd;
  vec2 uv = vec2(atan(q.z, q.x) / TAU + 0.5, asin(clamp(q.y, -1.0, 1.0)) / PI + 0.5);
  vec3 c = textureLod(uMilky, uv, 0.0).rgb; c = c * c / 6.0;
  return c * smoothstep(0.0, 0.22, rd.y);
}
vec3 sky(vec3 rd, vec3 sd){
  vec3 c = skyRad(rd, sd);
  if (uNight > 0.002){
    c += nightSky(rd) * uNight;
    float mm = dot(rd, uMoon);
    c += uMoonDisk * (smoothstep(0.99990, 0.99996, mm) * 3.2 + 0.05 * pow(sat(mm), 900.0) + 0.012 * pow(sat(mm), 60.0));
  }
  float mu = dot(rd, sd);
  c += uSunDisk * (smoothstep(0.99988, 0.99995, mu) * 30.0 + pow(sat(mu), 1400.0) * 2.0);
  return c;
}

// ================= 雲（1 層。太陽側の濃さで自己影をつける）
float cloudDens(vec2 p, float lod){
  vec2 q = p * 0.042 + vec2(uCloudT * 0.55, uCloudT * 0.21);
  float d = textureLod(uCloud, q / 8.0, lod).r;
  d += 0.22 * (textureLod(uCloud, (q * 3.3 + 7.0 - uCloudT * 0.25) / 8.0, lod + 1.7).g * 2.0 - 1.0);
  return smoothstep(1.0 - uCover, 1.22 - uCover, d);
}
vec4 clouds(vec3 ro, vec3 rd, vec3 sd){
  if (rd.y < 0.012 || uCover <= 0.0) return vec4(0.0);
  float tc = (CLOUD_Y - ro.y) / rd.y; vec3 p = ro + rd * tc;
  float lod = clamp(log2(max(tc * uPix / rd.y * 0.042 * 64.0, 1.0)), 0.0, 6.0);
  float d = cloudDens(p.xz, lod);
  if (d < 0.004) return vec4(0.0);
  vec2 off = normalize(sd.xz + 1e-4) * 2.6 * (1.0 - 0.6 * abs(sd.y));
  float d2 = cloudDens(p.xz + off * 1.4, lod);
  float shade = exp(-2.4 * d2);
  float mu = dot(rd, sd);
  vec3 sc = uSunColHigh * 0.30 + uMoonCol * 0.5;
  vec3 amb = uZen * 0.85 + mix(uHorA, uHorS, 0.5) * 0.30;
  vec3 col = amb * (0.55 + 0.45 * (1.0 - d)) + sc * (0.16 + 0.95 * shade + 1.5 * pow(sat(mu), 10.0) * (1.0 - 0.7 * d));
  float fade = exp(-tc * tc * 0.00045);
  return vec4(col, d * fade);
}
float cloudShadow(vec3 p, vec3 sd){
  if (uCover <= 0.0 || sd.y < 0.02) return 1.0;
  vec3 q = p + sd * ((CLOUD_Y - p.y) / sd.y);
  return 1.0 - 0.62 * cloudDens(q.xz, 1.0);
}

// ================= 地表
vec3 groundColor(vec3 p, vec3 n, float t, vec4 ax, float fine){
  float r = ax.g + 0.35 * (fine - 0.5);
  vec3 rock = mix(vec3(0.085, 0.078, 0.072), vec3(0.19, 0.165, 0.14), r);
  float strata = textureLod(uNoise, vec2(p.y * 5.0 + 2.0 * ax.g, dot(p.xz, vec2(0.25, 0.18))) / ${NOISE_P}.0, 0.0).a;
  rock = mix(rock, vec3(0.15, 0.115, 0.09), 0.55 * strata);
  float lowN = ax.r * 2.0 - 1.0;
  float g = smoothstep(0.62, 0.86, n.y) * (1.0 - smoothstep(0.5, 2.0, p.y + 0.6 * lowN));
  vec3 grass = mix(vec3(0.030, 0.052, 0.016), vec3(0.075, 0.085, 0.026), ax.b + 0.5 * (fine - 0.5));
  vec3 col = mix(rock, grass, g);
  float sh = p.y + 0.7 * lowN;
  float s = smoothstep(uSnow, uSnow + 0.9, sh) * smoothstep(0.42, 0.72, n.y + 0.12 * ax.a);
  col = mix(col, vec3(0.60, 0.64, 0.70), s);
  col *= mix(0.5, 1.0, smoothstep(0.0, 0.22, p.y - uWaterY));
  return col;
}
vec3 shadeGround(vec3 p, vec3 n, vec3 rd, vec3 sd, float t){
  float lod = lodAt(t) + 0.5;
  vec4 ax = textureLod(uAux, wuv(p.xz), lod);
  // 高さの地図より細かい凹凸と模様を、画素の大きさに合わせた細かさで足す（遠くでも岩と雪の境目がくっきりする）
  float s = clamp(-log2(max(t * uPix * 4.0, 1e-6)), 2.0, 5.6), fi = floor(s), fw = s - fi;
  float f0 = exp2(fi) / ${NOISE_P}.0, nl = max(log2(t * uPix * exp2(fi) * 8.0), 0.0);
  vec4 d1 = textureLod(uNoise, p.xz * f0, nl), d2 = textureLod(uNoise, p.xz * f0 * 2.0 + 0.37, nl + 1.0);
  vec2 dg = (d1.gb - 0.5) * (1.0 - fw) + (d2.gb - 0.5) * fw + (textureLod(uNoise, p.xz * 0.11 + 0.71, 0.0).gb - 0.5) * 0.6;
  n = normalize(n + vec3(-dg.x, 0.0, -dg.y) * 1.25);
  float fine = mix(d1.r, d2.a, fw);
  vec3 alb = groundColor(p, n, t, ax, fine);
  vec3 sc = sunAt(p.y);
  float dif = sat(dot(n, sd));
  float sh = 1.0;
  if (dif > 0.001 && dot(sc, sc) > 1e-7) sh = sunShadow(p) * cloudShadow(p, sd);
  // ユリアの影（太陽とのあいだに入ったところだけ、まるく暗くなる）
  vec3 v = uYuPos - p; float sv = dot(v, sd);
  if (sv > 0.0){ float dv = length(v - sv * sd); sh *= 1.0 - 0.6 * (1.0 - smoothstep(0.02 + 0.03 * sv, 0.05 + 0.22 * sv, dv)) * exp(-sv * 0.9); }
  float azn = dot(normalize(n.xz + 1e-4), normalize(sd.xz + 1e-4)) * 0.5 + 0.5;
  vec3 amb = uZen * (0.5 + 0.5 * n.y) * 1.15 + mix(uHorA, uHorS, azn) * (1.0 - 0.6 * n.y) * 0.40;
  float occ = sat(0.55 + 0.45 * n.y);
  vec3 lin = sc * dif * sh + amb * occ;
  lin += sc * 0.07 * sat(dot(n, normalize(vec3(-sd.x, 0.0, -sd.z)))) * sat(0.2 + 0.8 * n.y);
  lin += uMoonCol * sat(dot(n, uMoon));
  // ユリアの光
  float gl2 = dot(v, v);
  lin += uYuGlow * sat(dot(n, v) / sqrt(gl2 + 1e-5) * 0.6 + 0.4) / (1.0 + gl2 * 26.0);
  vec3 col = alb * lin;
  vec3 hv = normalize(sd - rd);
  col += sc * sh * 0.10 * pow(sat(dot(n, hv)), 24.0) * smoothstep(0.45, 0.62, alb.b);
  return col;
}
// 霧。lit: 光線の通り道がどれだけ日なたか（光芒）
vec3 applyFog(vec3 col, float t, vec3 ro, vec3 rd, vec3 sd, float lit){
  vec3 S = skyRad(normalize(vec3(rd.x, 0.06, rd.z)), sd);
  vec3 Ssh = uHorA * 0.62 + uZen * 0.55;
  vec3 fc = mix(mix(Ssh, S, lit), uZen * 1.6 + uMidA * 0.3, 0.42);
  float mu = max(dot(rd, sd), 0.0);
  fc += uSunCol * 0.05 * (lit - 0.5) * (0.25 + pow(mu, 6.0));
  float f = 1.0 - exp(-t * t * 0.00034 * uFog);
  // 湖面にたまる朝もや（高さで指数的に薄くなる霧を光線に沿って積分）
  float b = 1.4, y0 = max(ro.y - uWaterY, 0.0), x = t * rd.y * b;
  float fx = abs(x) < 1e-3 ? 1.0 - 0.5 * x : (1.0 - exp(-x)) / x;
  float mist = uMist * 0.030 * exp(-y0 * b) * min(t, 140.0) * fx;
  f = 1.0 - (1.0 - f) * exp(-max(mist, 0.0));
  return mix(col, max(fc, 0.0) * 1.05, sat(f));
}
float airLit(vec3 ro, vec3 rd, float t, float dth){
#if SHAFTS > 0
  if (uShadowOn < 0.5) return 0.72;
  float tm = min(t, 42.0), s = 0.0;
  for (int i = 0; i < SHAFTS; i++){
    float u = (float(i) + dth) / float(SHAFTS); vec3 q = ro + rd * (tm * u * (0.35 + 0.65 * u));
    vec4 sm = textureLod(uShadow, wuv(q.xz), 0.0);
    s += smoothstep(-0.03, 0.14, q.y - sm.b - sm.r);
  }
  return s / float(SHAFTS);
#else
  return 0.72;
#endif
}

// ================= 水
vec3 waterNormal(vec2 p, float dist){
  float a = uWave_ * 0.030 / (1.0 + dist * 0.045);
  float lod = clamp(log2(max(dist * uPix * 6.0 * ${(WAVE_RES / WAVE_P).toFixed(1)}, 1.0)) - 0.5, 0.0, 7.0);
  vec2 g = vec2(0.0);
  { mat2 R = rot(0.35); vec2 s = vec2(0.55, 1.9); vec2 q = (R * p) * s + vec2(uTime * 0.20, uTime * 0.34);
    g += transpose(R) * (s * (textureLod(uWave, q / ${WAVE_P}.0, max(lod - 1.6, 0.0)).rg - 0.5) * 8.0); }
  { mat2 R = rot(-0.5); vec2 s = vec2(1.1, 3.4); vec2 q = (R * p) * s + vec2(-uTime * 0.26, uTime * 0.42);
    g += 0.5 * transpose(R) * (s * (textureLod(uWave, q / ${WAVE_P}.0 + 0.31, max(lod - 0.8, 0.0)).rg - 0.5) * 8.0); }
  { mat2 R = rot(1.1); vec2 s = vec2(2.6, 6.3); vec2 q = (R * p) * s + vec2(uTime * 0.31, -uTime * 0.5);
    g += 0.22 * transpose(R) * (s * (textureLod(uWave, q / ${WAVE_P}.0 + 0.67, lod).rg - 0.5) * 8.0); }
  // ユリアが水面をかすめたあとの波紋
  for (int i = 0; i < 4; i++){
    vec4 rp = uRip[i]; float age = uTime - rp.z; if (rp.w <= 0.0 || age < 0.0 || age > 5.0) continue;
    vec2 d = p - rp.xy; float r = length(d) + 1e-4, front = age * 0.55;
    float env = rp.w * exp(-age * 0.9) * smoothstep(front + 0.05, front - 0.12, r) * smoothstep(0.0, 0.05, r) / (1.0 + r * 3.0);
    g += (d / r) * cos((r - front) * 46.0) * env * 26.0;
  }
  return normalize(vec3(-g.x * a, 1.0, -g.y * a));
}

vec3 renderWorld(vec3 ro, vec3 rd, float t, bool hit, vec3 p, vec3 n, float dth, out float zc){
  vec3 sd = uSun, col;
  float tw = rd.y < -1e-4 ? (uWaterY - ro.y) / rd.y : 1e9;
  if (tw < t && tw > 0.0){
    // ---- 水面
    vec3 wp = ro + rd * tw;
    vec3 wn = waterNormal(wp.xz, tw);
    vec3 rr = reflect(rd, wn); rr.y = abs(rr.y) + 0.004; rr = normalize(rr);
    vec3 refl;
#if RSTEPS > 0
    float tr = castRay(wp + vec3(0.0, 0.01, 0.0), rr, 0.05, 70.0, RSTEPS, 0.035);
    float rl = lodAt(tr + tw) + 1.0;
    vec3 ro2 = wp + vec3(0.0, 0.01, 0.0);
    if (tr < 70.0 && !gOut){
      // 当たりを二分法で詰める（歩幅の段差が、映り込みに縞として出ないように）
      float ta = max(tr - 0.05 - 0.03 * tr, 0.05), tb = tr;
      for (int i = 0; i < 4; i++){ float tm = 0.5 * (ta + tb); vec3 q = ro2 + rr * tm; if (q.y - mapH(q.xz, rl) < 0.0) tb = tm; else ta = tm; }
      tr = 0.5 * (ta + tb);
    }
    vec3 rq = ro2 + rr * tr;
    if (tr < 70.0 && rq.y - mapH(rq.xz, rl) < (gOut ? 0.04 * tr + 0.3 : 0.006 * tr + 0.05)){
      // 映り込む山は、高さの勾配だけで手早く陰影をつける
      float e = 0.09;
      vec3 rn = normalize(vec3(mapH(rq.xz - vec2(e, 0.0), rl) - mapH(rq.xz + vec2(e, 0.0), rl), 2.0 * e, mapH(rq.xz - vec2(0.0, e), rl) - mapH(rq.xz + vec2(0.0, e), rl)));
      float sn = smoothstep(uSnow, uSnow + 0.9, rq.y) * smoothstep(0.42, 0.72, rn.y);
      vec3 alb = mix(mix(vec3(0.12, 0.105, 0.09), vec3(0.05, 0.065, 0.02), smoothstep(0.62, 0.86, rn.y) * (1.0 - smoothstep(0.5, 2.0, rq.y))), vec3(0.60, 0.64, 0.70), sn);
      vec3 lin = sunAt(rq.y) * sat(dot(rn, sd)) * sunShadow(rq) + uZen * (0.5 + 0.5 * rn.y) * 1.15 + mix(uHorA, uHorS, 0.5) * 0.25 + uMoonCol * sat(dot(rn, uMoon));
      refl = applyFog(alb * lin, tr + tw * 0.5, wp, rr, sd, 0.72);
    } else
#endif
    {
      refl = sky(rr, sd); vec4 cl = clouds(wp, rr, sd); refl = mix(refl, cl.rgb, cl.a);
    }
    float depth = max(uWaterY - mapH(wp.xz, lodAt(tw)), 0.0);
    vec3 body = mix(vec3(0.010, 0.040, 0.050), vec3(0.004, 0.013, 0.024), sat(depth * 0.9)) * (uSunCol * 0.35 + uZen * 2.2 + uMoonCol);
    float fr = 0.02 + 0.98 * pow(1.0 - sat(dot(-rd, wn)), 5.0);
    col = mix(body, refl, fr);
    float ws = sunShadow(wp);
    col += uSunDisk * 0.9 * pow(sat(dot(rr, sd)), 260.0) * fr * ws;
    col += uMoonDisk * 0.55 * pow(sat(dot(rr, uMoon)), 320.0) * fr;
    col = mix(col, vec3(0.085, 0.080, 0.062) * (uSunCol * 0.6 * ws + uZen * 1.6 + uMoonCol), (1.0 - fr) * exp(-depth * 9.0) * 0.8);
    // ユリアの光が水面に映る
    vec3 yv = uYuPos - wp; float yd = dot(yv, yv);
    col += uYuGlow * (pow(sat(dot(rr, yv * inversesqrt(yd + 1e-5))), 90.0) * 3.0 + 0.10) * fr / (1.0 + yd * 9.0);
    col = applyFog(col, tw, ro, rd, sd, airLit(ro, rd, tw, dth));
    zc = tw;
  } else if (hit){
    col = applyFog(shadeGround(p, n, rd, sd, t), t, ro, rd, sd, airLit(ro, rd, t, dth));
    zc = t;
  } else {
    col = sky(rd, sd);
    vec4 cl = clouds(ro, rd, sd); col = mix(col, cl.rgb, cl.a);
    vec3 hz = mix(skyRad(normalize(vec3(rd.x, 0.06, rd.z)), sd), uZen * 1.6 + uMidA * 0.3, 0.42) * 1.05;
    col = mix(col, hz, exp(-max(rd.y, 0.0) * 42.0) * sat(uFog));
    zc = 2000.0 - 1000.0 * cl.a;
  }
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = uRo, rd = normalize(uCam * vec3(uv, uFocal));
  float dth = ign(gl_FragCoord.xy);
  float tmin = 0.04, tmax = 140.0;
  if (rd.y < -1e-4) tmax = min(tmax, (uWaterY - ro.y) / rd.y + 0.02);
  float t = castRay(ro, rd, tmin, tmax, STEPS, 0.0);
  bool hit = t < tmax;
  if (hit){ vec3 q = ro + rd * t; hit = q.y - mapH(q.xz, lodAt(t)) < (gOut ? 0.03 * t + 0.25 : 0.006 * t + 0.03); if (!hit) t = 1e9; }
  if (rd.y < -1e-4 && !hit) t = 1e9;
  vec3 p = ro + rd * t, n = vec3(0.0, 1.0, 0.0);
  if (hit){
    float ta = t - 0.02 * t - 0.02, tb = t, lod = lodAt(t);
    for (int i = 0; i < 4; i++){ float tm = 0.5 * (ta + tb); vec3 q = ro + rd * tm; if (q.y - mapH(q.xz, lod) < 0.0) tb = tm; else ta = tm; }
    t = 0.5 * (ta + tb); p = ro + rd * t;
    n = calcNormal(p, t);
  }
  float zc;
  vec3 col = renderWorld(ro, rd, t, hit, p, n, dth, zc) * uExposure;
  float z = zc < 999.0 ? zc * dot(rd, uCam[2]) : zc;
#if HDR
  o = vec4(col, z);
#else
  col = sqrt(min(col, 4.0) * 0.25) + (dth - 0.5) / 255.0;
  o = vec4(col, zc < 999.0 ? 1.0 / (1.0 + z * 0.25) : 0.0);
#endif
}`;

// ---- ブルーム（映像と同じ: 13 点の縮小 → 9 点で広げて足し戻す）
const DEC = (HDR) => HDR ? 'vec3 dec(vec4 c){ return c.rgb; } vec4 enc(vec3 c){ return vec4(c, 1.0); }' : 'vec3 dec(vec4 c){ return c.rgb * c.rgb * 4.0; } vec4 enc(vec3 c){ return vec4(sqrt(min(c, 4.0) * 0.25), 1.0); }';
export const FS_DOWN = (HDR) => HEAD + DEC(HDR) + `
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform float uFirst, uThreshold, uKnee; uniform vec2 uTexel;
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 pre(vec3 c){
  if (uFirst < 0.5) return c;
  c = min(c, vec3(64.0));
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-4);
  return c * max(soft, br - uThreshold) / max(br, 1e-4);
}
float kw(vec3 c){ return uFirst > 0.5 ? 1.0 / (1.0 + luma(c)) : 1.0; }
#define S(x, y) pre(dec(textureLod(uTex, vUv + uTexel * vec2(x, y), 0.0)))
void main(){
  vec3 a = S(-2.0, 2.0), b = S(0.0, 2.0), c = S(2.0, 2.0);
  vec3 d = S(-2.0, 0.0), e = S(0.0, 0.0), f = S(2.0, 0.0);
  vec3 g = S(-2.0, -2.0), h = S(0.0, -2.0), i = S(2.0, -2.0);
  vec3 j = S(-1.0, 1.0), k = S(1.0, 1.0), l = S(-1.0, -1.0), m = S(1.0, -1.0);
  vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
  float w0 = kw(g0) * 0.125, w1 = kw(g1) * 0.125, w2 = kw(g2) * 0.125, w3 = kw(g3) * 0.125, w4 = kw(g4) * 0.5;
  o = enc((g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4));
}`;
export const FS_UP = (HDR) => HEAD + DEC(HDR) + `
in vec2 vUv; out vec4 o;
uniform sampler2D uLow, uHigh; uniform vec2 uTexel; uniform float uMix;
#define L(x, y) dec(textureLod(uLow, vUv + uTexel * vec2(x, y), 0.0))
void main(){
  vec3 s = L(0.0, 0.0) * 4.0;
  s += (L(1.0, 0.0) + L(-1.0, 0.0) + L(0.0, 1.0) + L(0.0, -1.0)) * 2.0;
  s += L(1.0, 1.0) + L(-1.0, 1.0) + L(1.0, -1.0) + L(-1.0, -1.0);
  o = enc(mix(dec(textureLod(uHigh, vUv, 0.0)), s / 16.0, uMix));
}`;

// ---- 仕上げ: 拡大（少し鮮鋭化）→ ブルーム → 周辺減光 → ハイライトを丸める → sRGB → ディザ
export const FS_FINAL = (HDR) => HEAD + DEC(HDR) + `
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes, uSceneTexel;
uniform float uBloomAmt, uVignette, uCA, uContrast, uSaturation, uFade, uSharp, uFlash, uRush, uTime;
uniform vec3 uTint;
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 softclip(vec3 x){ const float a = 0.75; vec3 y = (x - a) / (1.0 - a); return mix(x, a + (1.0 - a) * (1.0 - exp(-y)), step(a, x)); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec3 sc(vec2 uv){ return dec(textureLod(uScene, uv, 0.0)); }
void main(){
  vec2 uv = vUv, c = uv - 0.5;
  float asp = uRes.x / uRes.y;
  float r2 = dot(c * vec2(asp, 1.0), c * vec2(asp, 1.0));
  vec3 col = sc(uv);
  if (uCA > 0.0){ float k = uCA * r2; col.r = sc(0.5 + c * (1.0 + k)).r; col.b = sc(0.5 + c * (1.0 - k)).b; }
  if (uSharp > 0.0){
    vec3 nb = (sc(uv + vec2(uSceneTexel.x, 0.0)) + sc(uv - vec2(uSceneTexel.x, 0.0)) + sc(uv + vec2(0.0, uSceneTexel.y)) + sc(uv - vec2(0.0, uSceneTexel.y))) * 0.25;
    vec3 d = col - nb; col = max(col + d * uSharp / (1.0 + 6.0 * luma(abs(d))), 0.0);
  }
  // 加速中は、まわりが中心から流れて見える
  if (uRush > 0.0){
    float w = uRush * smoothstep(0.05, 0.55, r2);
    vec3 acc = col; float j = ign(gl_FragCoord.xy);
    for (int i = 1; i <= 4; i++){ acc += sc(0.5 + c * (1.0 - 0.02 * w * (float(i) + j - 0.5))); }
    col = mix(col, acc / 5.0, sat(w * 1.4));
  }
  col += dec(textureLod(uBloom, uv, 0.0)) * uBloomAmt;
  col *= mix(1.0, smoothstep(1.25, 0.15, r2 * 1.6), uVignette);
  col = mix(vec3(luma(col)), col, uSaturation);
  col = softclip(col * uTint);
  col = toSRGB(col);
  col = mix(vec3(0.5), col, uContrast);
  col = mix(col, vec3(1.0), uFlash);
  col *= uFade;
  col += (ign(gl_FragCoord.xy + 17.0) + ign(gl_FragCoord.yx * 1.3 + 5.0) - 1.0) / 255.0;
  o = vec4(col, 1.0);
}`;

// ---- 物（ユリア・輪・光の粒・軌跡）。風景を描いたあと、画面の解像度で重ねる。
//   地形の向こうかどうかは、風景の奥行き（アルファに入っている）と比べて決める。
export const VS_SPRITE = `#version 300 es
precision highp float;
in vec3 aPos; in vec2 aUv; in vec4 aCol; in vec2 aTA;
uniform mat4 uVP;
out vec2 vUv; out vec4 vCol; out vec2 vTA; out float vZ;
void main(){ vec4 cp = uVP * vec4(aPos, 1.0); vUv = aUv; vCol = aCol; vTA = aTA; vZ = cp.w; gl_Position = cp; }`;
export const FS_SPRITE = (HDR) => HEAD + `
in vec2 vUv; in vec4 vCol; in vec2 vTA; in float vZ; out vec4 o;
uniform sampler2D uT0, uT1, uT2, uScene;
uniform vec2 uInv; uniform float uFog; uniform vec3 uFogCol;
void main(){
  vec4 t = vTA.x < 0.5 ? texture(uT0, vUv) : vTA.x < 1.5 ? texture(uT1, vUv) : texture(uT2, vUv);
  vec4 c = t * vCol;
  float a = textureLod(uScene, gl_FragCoord.xy * uInv, 0.0).a;
#if ${HDR}
  float vis = sat((a - vZ) / (0.012 + 0.012 * vZ) + 0.5);
#else
  float zs = a > 0.005 ? (1.0 / a - 1.0) * 4.0 : 1e4;
  float vis = sat((zs - vZ) / (0.05 + 0.08 * vZ) + 0.5);
#endif
  float f = 1.0 - exp(-vZ * vZ * 0.00034 * uFog);
  c.rgb = mix(c.rgb, uFogCol * c.a, f * (1.0 - vTA.y));
  c *= vis * mix(1.0, 1.0 - f, vTA.y);
  c.a *= 1.0 - vTA.y;
  o = c;
}`;

// ---- 星（点で描く。雲と地形の向こうは隠れる）
export const VS_STAR = `#version 300 es
precision highp float;
in vec3 aDir; in vec4 aInfo;       // info: 明るさ, 色の寄り（0 = 暖色, 1 = 寒色）, またたきの速さ, 位相
uniform mat4 uVP; uniform mat3 uStarMT; uniform float uPx, uTime, uNight;
out vec4 vCol;
void main(){
  vec3 rd = uStarMT * aDir;
  vec4 cp = uVP * vec4(rd, 0.0);
  float tw = 0.78 + 0.22 * sin(uTime * aInfo.z + aInfo.w);
  float b = min(aInfo.x * 3.0, 1.15) * tw * uNight * smoothstep(0.0, 0.22, rd.y);
  vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.72, 0.84, 1.0), aInfo.y);
  float size = uPx * (1.9 + 2.2 * aInfo.x);
  vCol = vec4(tint * b, 1.0);
  gl_Position = vec4(cp.xy, 0.0, cp.w);
  gl_PointSize = max(size, 1.5);
}`;
export const FS_STAR = (HDR) => HEAD + `
in vec4 vCol; out vec4 o;
uniform sampler2D uScene; uniform vec2 uInv;
void main(){
  vec2 d = gl_PointCoord - 0.5; float g = exp(-dot(d, d) * 11.0);
  float a = textureLod(uScene, gl_FragCoord.xy * uInv, 0.0).a;
#if ${HDR}
  float vis = sat((a - 1000.0) / 1000.0);
#else
  float vis = a < 0.002 ? 1.0 : 0.0;
#endif
  o = vec4(vCol.rgb * g * vis, 0.0);
}`;
