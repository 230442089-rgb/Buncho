// world.js — レイマーチングで描く世界
// 紙のレリーフ（反応拡散の模様）→ 山 → 空・水・雲・一日の光。立体・時間・生命の章で使う。
import { W, H, clamp } from './core.js';
import { GLSL_PAPER } from './paper.js';
import { getRD } from './rd.js';

export const WORLD = { size: 128, cx: 0, cz: 30, res: 2048, cloudY: 9.0 };

// ---- 地形（焼き込みと描画で共有）: 微分で侵食風に抑えた fBm ＋ 谷と湖
const GLSL_TERRAIN = /* glsl */ `
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
// 谷すじ（フィヨルド）が大きな湖にひらけ、対岸に高い山なみが立つ
float terrainH(vec2 p, int oct){
  float m = tfbm(p * 0.07 + vec2(13.7, 4.2), oct);
  float dx = abs(p.x - valleyX(p.y) * (1.0 - 0.6 * smoothstep(24.0, 40.0, p.y)));
  float w = corridorW(p.y);
  float far = smoothstep(54.0, 68.0, p.y + 0.35 * p.x * sin(p.x * 0.08));
  float mask = max(smoothstep(w * 0.5, w + mix(6.0, 9.0, smoothstep(2.0, 19.0, p.y)), dx), far);
  float hills = tfbm(p * 0.19 + vec2(3.0, 8.0), min(oct, 7)) - 0.62;
  float mount = 8.4 * m - 1.3;
  float h = mix(-0.95 + 1.5 * hills, mount, mask);
  vec2 hp = p - vec2(7.0, 74.0); h += 3.4 * exp(-dot(hp, hp) / 70.0) * far;     // 主峰
  return h;
}
const vec2 WC = vec2(${WORLD.cx.toFixed(1)}, ${WORLD.cz.toFixed(1)}); const float WS = ${WORLD.size.toFixed(1)};
`;

const FS_BAKE = GLSL_TERRAIN + /* glsl */ `
out vec4 o;
void main(){ vec2 p = (vUv - 0.5) * WS + WC; o = vec4(terrainH(p, 13), 0.0, 0.0, 1.0); }`;

// 最大高さのピラミッド（レイマーチングで、地形より確実に上にいる間は大きく進むため）
const FS_MAX8 = /* glsl */ `
uniform sampler2D uTex; out vec4 o;
void main(){ ivec2 b = ivec2(gl_FragCoord.xy) * 8; float m = -1e9; for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) m = max(m, texelFetch(uTex, b + ivec2(i, j), 0).r); o = vec4(m, 0.0, 0.0, 1.0); }`;
const FS_MAX2 = /* glsl */ `
uniform sampler2D uTex; out vec4 o;
void main(){ ivec2 b = ivec2(gl_FragCoord.xy) * 2; o = vec4(max(max(texelFetch(uTex, b, 0).r, texelFetch(uTex, b + ivec2(1, 0), 0).r), max(texelFetch(uTex, b + ivec2(0, 1), 0).r, texelFetch(uTex, b + ivec2(1, 1), 0).r)), 0.0, 0.0, 1.0); }`;
const FS_DILATE = /* glsl */ `
uniform sampler2D uTex; out vec4 o;
void main(){ ivec2 c = ivec2(gl_FragCoord.xy), s = textureSize(uTex, 0) - 1; float m = -1e9; for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) m = max(m, texelFetch(uTex, clamp(c + ivec2(i, j), ivec2(0), s), 0).r); o = vec4(m, 0.0, 0.0, 1.0); }`;

// 開発用: 上から見た地図
const FS_MAP = /* glsl */ `
uniform sampler2D uHeight; uniform vec3 uCamP; uniform vec2 uCamD;
out vec4 o;
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y + 0.5;
  float h = texture(uHeight, uv).r;
  vec3 c = h < 0.0 ? mix(vec3(0.05, 0.2, 0.4), vec3(0.1, 0.4, 0.6), sat(1.0 + h)) : mix(vec3(0.15, 0.3, 0.1), vec3(1.0), sat(h / 5.0));
  c *= 0.8 + 0.2 * step(0.5, fract(h * 2.0));
  vec2 g = abs(fract(uv * 12.8) - 0.5); c = mix(c, vec3(0.0), 0.3 * step(0.49, max(g.x, g.y)));
  vec2 cp = (uCamP.xz - vec2(${WORLD.cx.toFixed(1)}, ${WORLD.cz.toFixed(1)})) / ${WORLD.size.toFixed(1)} + 0.5;
  c = mix(c, vec3(1.0, 0.1, 0.0), step(distance(uv, cp), 0.006));
  c = mix(c, vec3(1.0, 0.8, 0.0), step(sdSeg(uv, cp, cp + uCamD * 0.06), 0.002));
  o = vec4(c * step(uv.x, 1.0) * step(0.0, uv.x), 1.0);
}`;

// ソフトウェア GPU では分岐の両側が毎画素実行されるので、使わない部分は #if で取り除いた版を場面ごとに作る。
//   REL: 紙のレリーフ, TERR: 山の地形, STUDIO: スタジオの光, LIT: 空と太陽の光
const FS_WORLD = (REL, TERR, STUDIO, LIT, NIGHT) => `#define REL ${REL}\n#define TERR ${TERR}\n#define STUDIO ${STUDIO}\n#define LIT ${LIT}\n#define NIGHT ${NIGHT}\n` + GLSL_PAPER + GLSL_TERRAIN + /* glsl */ `
uniform sampler2D uHeight, uRD, uMaxH;
uniform vec3 uRo; uniform mat3 uCam; uniform float uFocal;
uniform float uTop, uWave, uMorph, uWorld, uRelief, uInk, uFlat, uWaterY, uTime, uStarRot, uCloudT, uCover, uExposure, uFog, uMist, uSnow, uNight, uHorFall, uHorPow;
uniform vec3 uSun, uKey, uMoon;
uniform vec3 uZen, uHorS, uHorA, uMidS, uMidA, uGlow, uSunCol, uSunColHigh, uSunDisk, uMoonCol;
out vec4 o;

const float CLOUD_Y = ${WORLD.cloudY.toFixed(1)};

// ================= 高さ
vec2 mirrorUV(vec2 uv){ vec2 m = mod(uv, 2.0); return mix(m, 2.0 - m, step(1.0, m)); }
vec2 rdUV(vec2 xz){ return mirrorUV(xz / vec2(16.0, 9.0) + 0.5); }
float bicubicG(sampler2D t, vec2 uv){
  vec2 res = vec2(textureSize(t, 0)); vec2 st = uv * res - 0.5; vec2 i = floor(st), f = fract(st);
  vec2 w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0, w1 = (4.0 - 6.0 * f * f + 3.0 * f * f * f) / 6.0;
  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f * f - 3.0 * f * f * f) / 6.0, w3 = f * f * f / 6.0;
  vec2 g0 = w0 + w1, g1 = w2 + w3, h0 = (w1 / g0) - 1.0 + i + 0.5, h1 = (w3 / g1) + 1.0 + i + 0.5;
  float a = texture(t, vec2(h0.x, h0.y) / res).g, b = texture(t, vec2(h1.x, h0.y) / res).g, c = texture(t, vec2(h0.x, h1.y) / res).g, d = texture(t, vec2(h1.x, h1.y) / res).g;
  return mix(mix(d, c, g0.x), mix(b, a, g0.x), g0.y);
}
float reliefShape(float v){ return 0.36 * smoothstep(0.06, 0.30, v); }
float reliefH(vec2 xz){ return reliefShape(texture(uRD, rdUV(xz)).g) * uRelief; }
float reliefHS(vec2 xz){ return reliefShape(bicubicG(uRD, rdUV(xz))) * uRelief; }
float terrainTex(vec2 xz){ return texture(uHeight, (xz - WC) / WS + 0.5).r; }
float mapH(vec2 xz){
#if REL && TERR
  return reliefH(xz) * (1.0 - uMorph) + terrainTex(xz) * uMorph;
#elif REL
  return reliefH(xz);
#else
  return terrainTex(xz);
#endif
}
// 当たった点での精密な高さ（法線用）
float mapHS(vec2 xz, int oct){
#if REL && TERR
  return reliefHS(xz) * (1.0 - uMorph) + terrainH(xz, oct) * uMorph;
#elif REL
  return reliefHS(xz);
#else
  return terrainH(xz, oct);
#endif
}
float castRay(vec3 ro, vec3 rd, float tmin, float tmax, int steps){
  float t = tmin, k = mix(0.30, 0.42, uMorph);
  float hl = max(length(rd.xz), 1e-4), rmax = 0.36 * uRelief * (1.0 - uMorph);
  float lod = 1.0;
  for (int i = 0; i < steps; i++){
    vec3 p = ro + rd * t;
    if (p.y > uTop && rd.y > 0.0){ t = tmax + 1.0; break; }
#if TERR
    {
      // 最大高さのピラミッド: 格子の最大より上にいるなら格子ぶん進み、次はもっと粗い格子で試す。だめなら細かい格子へ。
      vec2 uv = (p.xz - WC) / WS + 0.5;
      float hm = textureLod(uMaxH, uv, lod).r * uMorph + rmax;
      if (p.y > hm + 0.01){
        float ds = 0.5 * exp2(lod) / hl;
        if (rd.y < 0.0) ds = min(ds, (p.y - hm) / (-rd.y) + 0.004);
        t += ds; lod = min(lod + 1.0, 6.0);
        if (t > tmax) break;
        continue;
      }
      if (lod > 0.5){ lod = max(lod - 2.0, 0.0); continue; }
    }
#endif
    float h = p.y - mapH(p.xz);
    if (h < 0.0015 * t || t > tmax) break;
    t += k * h + 0.0008 * t;
  }
  return t;
}
float softShadow(vec3 ro, vec3 rd, float k, float top){
  float res = 1.0, t = 0.03;
  for (int i = 0; i < 44; i++){
    vec3 p = ro + rd * t;
    float h = p.y - mapH(p.xz);
    res = min(res, k * h / t);
    if (res < 0.002 || p.y > top) break;
    t += clamp(h * 0.7, 0.025 + 0.012 * t, 0.9);
  }
  return sat(res);
}
vec3 calcNormal(vec3 p, float t, int oct){
  float e = max(0.0018 * t, 0.004);
  return normalize(vec3(mapHS(p.xz - vec2(e, 0.0), oct) - mapHS(p.xz + vec2(e, 0.0), oct), 2.0 * e, mapHS(p.xz - vec2(0.0, e), oct) - mapHS(p.xz + vec2(0.0, e), oct)));
}

#if LIT
// ================= 空（色は時刻ごとの見本を JS 側で補間して渡す）
vec3 sunAt(float alt){ return mix(uSunCol, uSunColHigh, smoothstep(0.0, 7.0, alt)); }
vec3 skyRad(vec3 rd, vec3 sd){
  float y = max(rd.y, 0.0);
  float az = dot(normalize(rd.xz + 1e-5), normalize(sd.xz + 1e-5)) * 0.5 + 0.5;
  float a = pow(az, uHorPow);
  vec3 hor = mix(uHorA, uHorS, a), mid = mix(uMidA, uMidS, a);
  // 地平線の帯 → 中間の淡い帯 → 天頂
  vec3 c = mix(uZen, mid, exp(-y * uHorFall));
  c = mix(c, hor, exp(-y * uHorFall * 3.2));
  float mu = max(dot(rd, sd), 0.0);
  c += uGlow * (0.30 * pow(mu, 5.0) + 0.85 * pow(mu, 40.0));
  return c;
}
#if NIGHT
mat3 rotAxis(vec3 a, float ang){ float c = cos(ang), s = sin(ang), ic = 1.0 - c; return mat3(c + a.x*a.x*ic, a.y*a.x*ic + a.z*s, a.z*a.x*ic - a.y*s, a.x*a.y*ic - a.z*s, c + a.y*a.y*ic, a.z*a.y*ic + a.x*s, a.x*a.z*ic + a.y*s, a.y*a.z*ic - a.x*s, c + a.z*a.z*ic); }
vec3 stars(vec3 rd){
  vec3 a = abs(rd); float m = max(a.x, max(a.y, a.z)); vec3 q = rd / m;
  vec2 uv; float face;
  if (a.x >= a.y && a.x >= a.z){ uv = q.yz; face = rd.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z){ uv = q.xz; face = rd.y > 0.0 ? 2.0 : 3.0; }
  else { uv = q.xy; face = rd.z > 0.0 ? 4.0 : 5.0; }
  vec3 c = vec3(0.0);
  for (int l = 0; l < 3; l++){
    float N = l == 0 ? 46.0 : l == 1 ? 110.0 : 240.0;
    vec2 g = uv * N; vec2 id = floor(g);
    vec3 h = hash33(vec3(id, face * 13.0 + float(l) * 7.0));
    vec2 d = fract(g) - 0.5 - (h.xy - 0.5) * 0.66;
    float b = pow(h.z, l == 0 ? 22.0 : l == 1 ? 30.0 : 40.0) * (l == 0 ? 2.6 : l == 1 ? 1.5 : 0.85);
    float s = N / 1650.0;                                  // 星の大きさ（格子の単位）
    vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.72, 0.84, 1.0), hash11(h.z * 91.7 + h.x));
    c += tint * b * exp(-dot(d, d) / (s * s));
  }
  return c;
}
vec3 nightSky(vec3 rd){
  mat3 R = rotAxis(normalize(vec3(0.25, 0.62, -0.74)), uStarRot);
  vec3 q = R * rd;
  vec3 c = stars(q);
  // 天の川
  vec3 pole = normalize(vec3(0.55, 0.25, 0.80));
  float band = exp(-pow(dot(q, pole) / 0.22, 2.0));
  float dust = fbm3(q * 5.0) * 0.5 + 0.5, dust2 = fbm3(q * 11.0 + 3.0) * 0.5 + 0.5;
  c += band * (vec3(0.034, 0.040, 0.066) * (0.4 + 1.6 * dust * dust) * (0.30 + 0.70 * smoothstep(0.25, 0.7, dust2)) + stars(q * 1.7 + 0.3) * 0.7);
  return c * smoothstep(0.0, 0.22, rd.y);
}
#endif
vec3 sky(vec3 rd, vec3 sd){
  vec3 c = skyRad(rd, sd);
#if NIGHT
  c += nightSky(rd) * uNight;
#endif
  float mu = dot(rd, sd);
  c += uSunDisk * (smoothstep(0.99988, 0.99995, mu) * 30.0 + pow(sat(mu), 1400.0) * 2.0);
  return c;
}

// ================= 雲（1 層。太陽側の濃さで自己影をつける）
float cloudDens(vec2 p){
  vec2 q = p * 0.042 + vec2(uCloudT * 0.55, uCloudT * 0.21);
  float d = fbm(q) * 0.5 + 0.5;
  d += 0.22 * fbm(q * 3.3 + 7.0 - uCloudT * 0.25);
  return smoothstep(1.0 - uCover, 1.22 - uCover, d);
}
vec4 clouds(vec3 ro, vec3 rd, vec3 sd){
  if (rd.y < 0.012 || uCover <= 0.0) return vec4(0.0);
  float tc = (CLOUD_Y - ro.y) / rd.y; vec3 p = ro + rd * tc;
  float d = cloudDens(p.xz);
  if (d < 0.004) return vec4(0.0);
  vec2 off = normalize(sd.xz + 1e-4) * 2.6 * (1.0 - 0.6 * abs(sd.y));
  float d2 = cloudDens(p.xz + off * 1.4);
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
  return 1.0 - 0.72 * cloudDens(q.xz);
}

// ================= 地表
vec3 groundColor(vec3 p, vec3 n){
  float r = vnoise(p.xz * 2.6);
  vec3 rock = mix(vec3(0.085, 0.078, 0.072), vec3(0.19, 0.165, 0.14), r);
  rock = mix(rock, vec3(0.15, 0.115, 0.09), 0.55 * vnoise(vec2(p.y * 5.0 + 2.0 * r, dot(p.xz, vec2(0.25, 0.18)))));
  float lowN = fbm(p.xz * 0.45);
  float g = smoothstep(0.62, 0.86, n.y) * (1.0 - smoothstep(0.5, 2.0, p.y + 0.6 * lowN));
  vec3 grass = mix(vec3(0.030, 0.052, 0.016), vec3(0.075, 0.085, 0.026), vnoise(p.xz * 1.1 + 4.0));
  vec3 col = mix(rock, grass, g);
  float sh = p.y + 0.7 * lowN;
  float s = smoothstep(uSnow, uSnow + 0.9, sh) * smoothstep(0.42, 0.72, n.y + 0.12 * vnoise(p.xz * 3.0));
  col = mix(col, vec3(0.60, 0.64, 0.70), s);
  col *= mix(0.5, 1.0, smoothstep(0.0, 0.22, p.y - uWaterY));
  return col;
}
vec3 shadeGround(vec3 p, vec3 n, vec3 rd, vec3 sd, bool shadows){
  vec3 alb = groundColor(p, n);
  vec3 sc = sunAt(p.y);
  float dif = sat(dot(n, sd));
  float sh = 1.0;
  if (dif > 0.001 && dot(sc, sc) > 1e-7) sh = (shadows ? softShadow(p + n * 0.02, sd, 14.0, 10.0) : 1.0) * cloudShadow(p, sd);
  float azn = dot(normalize(n.xz + 1e-4), normalize(sd.xz + 1e-4)) * 0.5 + 0.5;
  vec3 amb = uZen * (0.5 + 0.5 * n.y) * 1.15 + mix(uHorA, uHorS, azn) * (1.0 - 0.6 * n.y) * 0.40;
  float occ = sat(0.55 + 0.45 * n.y);
  vec3 lin = sc * dif * sh + amb * occ;
  lin += sc * 0.07 * sat(dot(n, normalize(vec3(-sd.x, 0.0, -sd.z)))) * sat(0.2 + 0.8 * n.y);   // 地面からの照り返し
  lin += uMoonCol * sat(dot(n, uMoon));                                                          // 月あかり
  vec3 col = alb * lin;
  vec3 hv = normalize(sd - rd);
  col += sc * sh * 0.10 * pow(sat(dot(n, hv)), 24.0) * smoothstep(0.45, 0.62, alb.b);           // 雪のつや
  return col;
}
vec3 applyFog(vec3 col, float t, vec3 ro, vec3 rd, vec3 sd){
  vec3 fc = mix(skyRad(normalize(vec3(rd.x, 0.06, rd.z)), sd), uZen * 1.6 + uMidA * 0.3, 0.42);
  float f = 1.0 - exp(-t * t * 0.00034 * uFog);
  // 湖面にたまる朝もや（高さで指数的に薄くなる霧を光線に沿って積分）
  float b = 1.4, y0 = max(ro.y - uWaterY, 0.0), x = t * rd.y * b;
  float fx = abs(x) < 1e-3 ? 1.0 - 0.5 * x : (1.0 - exp(-x)) / x;
  float mist = uMist * 0.030 * exp(-y0 * b) * min(t, 140.0) * fx;
  f = 1.0 - (1.0 - f) * exp(-max(mist, 0.0));
  return mix(col, fc * 1.05, sat(f));
}

// ================= 水
float waveH(vec2 p){
  // 風の向きに長くのびた波を、向きと速さを変えて重ねる
  vec2 a = rot(0.35) * p, b = rot(-0.5) * p, c = rot(1.1) * p;
  float h = gnoise(a * vec2(0.55, 1.9) + vec2(uTime * 0.20, uTime * 0.34));
  h += 0.5 * gnoise(b * vec2(1.1, 3.4) + vec2(-uTime * 0.26, uTime * 0.42));
  h += 0.22 * gnoise(c * vec2(2.6, 6.3) + vec2(uTime * 0.31, -uTime * 0.5));
  return h;
}
vec3 waterNormal(vec2 p, float dist){
  float a = uWave * 0.030 / (1.0 + dist * 0.045), e = 0.035;
  float h0 = waveH(p), hx = waveH(p + vec2(e, 0.0)), hz = waveH(p + vec2(0.0, e));
  return normalize(vec3(-(hx - h0) / e * a, 1.0, -(hz - h0) / e * a));
}

#endif

#if STUDIO
// ================= スタジオ（紙の立体を横から照らす）
vec3 studioBg(vec3 rd){ return mix(vec3(0.0035, 0.0042, 0.0075), vec3(0.020, 0.024, 0.038), exp(-abs(rd.y) * 7.0)); }
vec3 shadeStudio(vec3 p, vec3 n, vec3 rd){
  vec2 px = vec2((p.x / 16.0 + 0.5) * 1920.0, (0.5 - p.z / 9.0) * 1080.0);
  vec3 pap = paperTex(px);
  float v = bicubicG(uRD, rdUV(p.xz));
  float ink = smoothstep(0.17, 0.235, v) * uInk * (1.0 - uMorph);
  vec3 alb = mix(pap, INK * 1.6, ink * 0.95);
  float dif = sat(dot(n, uKey));
  float sh = dif > 0.001 ? softShadow(p + n * 0.012, uKey, 9.0, 0.5 + 8.0 * uMorph) : 0.0;
  float occ = sat(1.0 - 1.6 * (mapH(p.xz + n.xz * 0.12) + mapH(p.xz - n.xz * 0.12 + 0.07) - 2.0 * p.y + 0.02));
  vec3 lin = vec3(1.22, 1.08, 0.92) * dif * sh * 0.98 + vec3(0.16, 0.20, 0.30) * (0.45 + 0.55 * n.y) * (0.5 + 0.5 * occ);
  lin += vec3(0.10, 0.07, 0.05) * sat(dot(n, normalize(vec3(-uKey.x, 0.3, -uKey.z))));
  vec3 lit = alb * lin;
  // 面の章の最後のコマと同じ、平らな絵
  float ink2 = smoothstep(0.17, 0.235, v);
  vec3 flat2d = inkOn(pap, INK, ink2 * 0.95);
  flat2d = inkOn(flat2d, INK, 0.18 * smoothstep(0.06, 0.17, v) * (1.0 - ink2));
  flat2d = mix(flat2d, pap, reserve(px));
  return mix(lit, flat2d, uFlat);
}

#endif

#if LIT
vec3 tonemap(vec3 x){ return x * uExposure; }

vec3 renderWorld(vec3 ro, vec3 rd, float t, bool hit, vec3 p, vec3 n){
  vec3 sd = uSun, col;
  float tw = rd.y < -1e-4 ? (uWaterY - ro.y) / rd.y : 1e9;
  if (tw < t && tw > 0.0){
    // ---- 水面
    vec3 wp = ro + rd * tw;
    vec3 wn = waterNormal(wp.xz, tw);
    vec3 rr = reflect(rd, wn); rr.y = abs(rr.y) + 0.004; rr = normalize(rr);
    float tr = castRay(wp + vec3(0.0, 0.01, 0.0), rr, 0.05, 70.0, 72);
    vec3 refl;
    vec3 rq = wp + rr * tr;
    if (tr < 70.0 && rq.y - mapH(rq.xz) < 0.006 * tr + 0.03){
      // 映り込む山は、高さテクスチャの勾配だけで手早く陰影をつける
      float e = 0.09;
      vec3 rn = normalize(vec3(mapH(rq.xz - vec2(e, 0.0)) - mapH(rq.xz + vec2(e, 0.0)), 2.0 * e, mapH(rq.xz - vec2(0.0, e)) - mapH(rq.xz + vec2(0.0, e))));
      float sn = smoothstep(uSnow, uSnow + 0.9, rq.y) * smoothstep(0.42, 0.72, rn.y);
      vec3 alb = mix(mix(vec3(0.12, 0.105, 0.09), vec3(0.05, 0.065, 0.02), smoothstep(0.62, 0.86, rn.y) * (1.0 - smoothstep(0.5, 2.0, rq.y))), vec3(0.60, 0.64, 0.70), sn);
      vec3 lin = sunAt(rq.y) * sat(dot(rn, sd)) + uZen * (0.5 + 0.5 * rn.y) * 1.15 + mix(uHorA, uHorS, 0.5) * 0.25 + uMoonCol * sat(dot(rn, uMoon));
      refl = applyFog(alb * lin, tr + tw * 0.5, wp, rr, sd);
    } else {
      refl = sky(rr, sd); vec4 cl = clouds(wp, rr, sd); refl = mix(refl, cl.rgb, cl.a);
    }
    float depth = uWaterY - mapH(wp.xz);
    vec3 body = mix(vec3(0.010, 0.040, 0.050), vec3(0.004, 0.013, 0.024), sat(depth * 0.9)) * (uSunCol * 0.35 + uZen * 2.2 + uMoonCol);
    float fr = 0.02 + 0.98 * pow(1.0 - sat(dot(-rd, wn)), 5.0);
    col = mix(body, refl, fr);
    col += uSunDisk * 0.9 * pow(sat(dot(rr, sd)), 260.0) * fr;
    col = mix(col, vec3(0.085, 0.080, 0.062) * (uSunCol * 0.6 + uZen * 1.6 + uMoonCol), (1.0 - fr) * exp(-depth * 9.0) * 0.8);  // 岸の浅瀬は底が透ける
    col = applyFog(col, tw, ro, rd, sd);
  } else if (hit){
    col = applyFog(shadeGround(p, n, rd, sd, true), t, ro, rd, sd);
  } else {
    col = sky(rd, sd);
    vec4 cl = clouds(ro, rd, sd); col = mix(col, cl.rgb, cl.a);
    col = mix(col, mix(skyRad(normalize(vec3(rd.x, 0.06, rd.z)), sd), uZen * 1.6 + uMidA * 0.3, 0.42) * 1.05, exp(-max(rd.y, 0.0) * 42.0) * sat(uFog));
  }
  return col;
}

#endif

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = uRo, rd = normalize(uCam * vec3(uv, uFocal));
  float top = uTop;
  float tmin = 0.05, tmax = 140.0;
  if (ro.y > top){ if (rd.y >= 0.0) tmax = -1.0; else tmin = (top - ro.y) / rd.y; }
#if !STUDIO
  if (rd.y < -1e-4) tmax = min(tmax, (uWaterY - ro.y) / rd.y + 0.02);   // 水面より先は見えない
#endif
  float t = tmax > 0.0 ? castRay(ro, rd, tmin, tmax, 200) : 1e9;
  bool hit = t < tmax && tmax > 0.0;
  if (hit){ vec3 q = ro + rd * t; hit = q.y - mapH(q.xz) < 0.004 * t + 0.02; if (!hit) t = 1e9; }
#if !STUDIO
  if (rd.y < -1e-4 && !hit) t = 1e9;
#endif
  vec3 p = ro + rd * t, n = vec3(0.0, 1.0, 0.0);
  if (hit){
    // 二分法で当たりを詰める
    float ta = t - 0.02 * t - 0.02, tb = t;
    for (int i = 0; i < 5; i++){ float tm = 0.5 * (ta + tb); vec3 q = ro + rd * tm; if (q.y - mapH(q.xz) < 0.0) tb = tm; else ta = tm; }
    t = 0.5 * (ta + tb); p = ro + rd * t;
    n = calcNormal(p, t, 12);
  }
  vec3 col = vec3(0.0);
#if STUDIO
  vec3 cs = studioBg(rd);
  if (hit){ cs = shadeStudio(p, n, rd); cs = mix(cs, studioBg(rd), (1.0 - exp(-t * t * 0.0011)) * (1.0 - uFlat)); }
  col = cs * (1.0 - uWorld);
#endif
#if LIT
  col += tonemap(renderWorld(ro, rd, t, hit, p, n)) * uWorld;
#endif
  o = vec4(col, 1.0);
}`;

function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
// 前 f と上の目安 up から、列が（右, 上, 前）の mat3
export function basis(f, up = [0, 1, 0]) {
  f = norm(f); const r = norm(cross(up, f)), u = cross(f, r);
  return [r[0], r[1], r[2], u[0], u[1], u[2], f[0], f[1], f[2]];
}

// 太陽の高さ（ラジアン）ごとの空の色見本。あいだは線形に補間する。
//         高さ    天頂                    太陽側の地平            反対側の地平            光芒                  太陽光（地表）        夜
const SKY_KEYS = [
  [-0.60, [0.0030, 0.0058, 0.0165], [0.0075, 0.0120, 0.0270], [0.0070, 0.0110, 0.0260], [0, 0, 0],            [0, 0, 0],            1.00, [0.0050, 0.0085, 0.0210], [0.0050, 0.0085, 0.0210]],
  [-0.30, [0.0034, 0.0068, 0.0200], [0.0260, 0.0150, 0.0240], [0.0075, 0.0120, 0.0280], [0.012, 0.004, 0.002], [0, 0, 0],            0.95, [0.0070, 0.0110, 0.0260], [0.0055, 0.0095, 0.0240]],
  [-0.20, [0.0055, 0.0135, 0.0480], [0.2600, 0.0750, 0.0300], [0.0120, 0.0200, 0.0520], [0.10, 0.03, 0.01],    [0, 0, 0],            0.60, [0.0300, 0.0380, 0.0700], [0.0100, 0.0180, 0.0500]],
  [-0.12, [0.0110, 0.0300, 0.1050], [0.7400, 0.2500, 0.0650], [0.0420, 0.0480, 0.1000], [0.30, 0.10, 0.03],    [0, 0, 0],            0.22, [0.1300, 0.1300, 0.1500], [0.0320, 0.0450, 0.1050]],
  [-0.05, [0.0220, 0.0600, 0.1900], [1.2500, 0.5200, 0.1500], [0.1200, 0.1050, 0.1700], [0.60, 0.25, 0.07],    [0.06, 0.02, 0.006],  0.03, [0.3400, 0.2900, 0.2700], [0.0800, 0.0950, 0.1800]],
  [0.00,  [0.0360, 0.0950, 0.2800], [1.6000, 0.8000, 0.2800], [0.2100, 0.1900, 0.2700], [1.00, 0.48, 0.15],    [1.25, 0.42, 0.13],   0.00, [0.5600, 0.4500, 0.3800], [0.1400, 0.1600, 0.2700]],
  [0.06,  [0.0560, 0.1450, 0.4000], [1.4000, 0.9800, 0.5200], [0.2800, 0.3300, 0.4800], [1.00, 0.66, 0.32],    [2.70, 1.50, 0.66],   0.00, [0.6200, 0.5800, 0.5600], [0.2000, 0.2600, 0.4300]],
  [0.16,  [0.0760, 0.1900, 0.5200], [1.0000, 0.9800, 0.8800], [0.4000, 0.5200, 0.7400], [0.72, 0.62, 0.47],    [3.50, 2.80, 1.95],   0.00, [0.4200, 0.5200, 0.7000], [0.2600, 0.3700, 0.6200]],
  [0.45,  [0.0860, 0.2150, 0.6000], [0.6800, 0.8100, 0.9800], [0.5000, 0.6600, 0.9200], [0.45, 0.43, 0.39],    [4.00, 3.70, 3.20],   0.00, [0.3000, 0.4400, 0.7600], [0.2600, 0.4000, 0.7400]],
];
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function skyAt(e) {
  const K = SKY_KEYS;
  let i = 0; while (i < K.length - 2 && e > K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], t = clamp((e - a[0]) / (b[0] - a[0]), 0, 1), u = t * t * (3 - 2 * t);
  return { zen: mix3(a[1], b[1], u), horS: mix3(a[2], b[2], u), horA: mix3(a[3], b[3], u), glow: mix3(a[4], b[4], u), sun: mix3(a[5], b[5], u), night: a[6] + (b[6] - a[6]) * u, midS: mix3(a[7], b[7], u), midA: mix3(a[8], b[8], u) };
}

export const WORLD_DEFAULTS = {
  ro: [0, 10.8, 0], f: [0, -1, 0], up: [0, 0, 1], focal: 1.2,
  morph: 0, world: 0, relief: 1, ink: 1, flat: 0, waterY: -0.6, time: 0, starRot: 0, cloudT: 0, cover: 0.0, exposure: 1.0, fog: 1.0, mist: 0.0, snow: 2.4,
  sun: [0.3, 0.4, 0.8], key: [-0.62, 0.40, 0.67], moon: [-0.45, 0.62, 0.35], moonAmt: 1, wave: 1,
};

class World {
  constructor(env) {
    const g = env.g, gl = g.gl;
    this.g = g;
    this.rd = getRD(g);
    this.height = g.target(WORLD.res, WORLD.res, { type: 'r32f', filter: 'linear', wrap: 'mirror' });
    const pBake = g.program(FS_BAKE, 'terrainBake');
    g.draw(pBake, {}, this.height);
    // カメラの高さ決めのために、粗い高さを CPU に読み戻す
    const N = 512; this.N = N;
    const small = g.target(N, N, { type: 'rgba32f', filter: 'nearest' });
    g.draw(pBake, {}, small);
    const px = new Float32Array(N * N * 4);
    gl.readPixels(0, 0, N, N, gl.RGBA, gl.FLOAT, px);
    this.cpu = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) this.cpu[i] = px[i * 4];
    // 最大高さのピラミッド: 0.5 単位の格子から 32 単位の格子まで（どの段も 3x3 に広げて安全側に）
    const pMax8 = g.program(FS_MAX8, 'max8', { common: false }), pMax2 = g.program(FS_MAX2, 'max2', { common: false }), pDil = g.program(FS_DILATE, 'dilate', { common: false });
    this.maxH = { tex: gl.createTexture() };
    let prev = this.height, size = WORLD.res / 8;
    const levels = [];
    for (let L = 0; L < 7; L++) {
      const a = g.target(size, size, { type: 'r32f', filter: 'nearest' }), d = g.target(size, size, { type: 'r32f', filter: 'nearest' });
      g.draw(L === 0 ? pMax8 : pMax2, { uTex: prev }, a);
      g.draw(pDil, { uTex: a }, d);
      levels.push({ d, size }); prev = a; size >>= 1;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.maxH.tex);
    levels.forEach(({ d, size }, L) => { gl.bindFramebuffer(gl.FRAMEBUFFER, d.fbo); gl.bindTexture(gl.TEXTURE_2D, this.maxH.tex); gl.copyTexImage2D(gl.TEXTURE_2D, L, gl.R32F, 0, 0, size, size, 0); });
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 6);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    this.progs = {};
    this.pMap = g.program(FS_MAP, 'worldMap');
    g.bind(null);
  }
  heightAt(x, z) {
    const N = this.N;
    const u = clamp((x - WORLD.cx) / WORLD.size + 0.5, 0, 0.9999) * N - 0.5, v = clamp((z - WORLD.cz) / WORLD.size + 0.5, 0, 0.9999) * N - 0.5;
    const i = clamp(Math.floor(u), 0, N - 2), j = clamp(Math.floor(v), 0, N - 2), fx = clamp(u - i, 0, 1), fy = clamp(v - j, 0, 1);
    const c = this.cpu, a = c[j * N + i], b = c[j * N + i + 1], d = c[(j + 1) * N + i], e = c[(j + 1) * N + i + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }
  // ro から方角 az を見たときの稜線の高さ（仰角）。日の出の位置合わせに使う
  skyline(ro, az) {
    let m = -1;
    for (let d = 2; d < 72; d += 0.25) m = Math.max(m, Math.atan2(this.heightAt(ro[0] + Math.sin(az) * d, ro[2] + Math.cos(az) * d) - ro[1], d));
    return m;
  }
  render(env, o, target = undefined) {
    const p = { ...WORLD_DEFAULTS, ...o };
    const sd = norm(p.sun), e = p.palE != null ? p.palE : Math.asin(clamp(sd[1], -1, 1));   // palE: 空の色見本に使う「見かけの」太陽高度
    const k = skyAt(e), kh = skyAt(e + 0.085);
    const tw = Math.exp(-Math.pow((e + 0.06) / 0.16, 2));          // 薄明のあいだは光が地平線に寄る
    const moonCol = [0.030 * k.night * p.moonAmt, 0.042 * k.night * p.moonAmt, 0.075 * k.night * p.moonAmt];
    // この状態に必要な部分だけを含むシェーダー（初めて使うときにコンパイルする）

    // この状態に必要な部分だけを含むシェーダー（初めて使うときにコンパイルする）
    const REL = p.morph < 1 ? 1 : 0, TERR = p.morph > 0 ? 1 : 0, STUDIO = p.world < 1 ? 1 : 0, LIT = p.world > 0 ? 1 : 0, NIGHT = LIT && k.night > 0.002 ? 1 : 0;
    const key = `${REL}${TERR}${STUDIO}${LIT}${NIGHT}`;
    const prog = this.progs[key] || (this.progs[key] = this.g.program(FS_WORLD(REL, TERR, STUDIO, LIT, NIGHT), 'world' + key));
    this.g.draw(prog, {
      uHeight: this.height, uRD: this.rd.tex, uMaxH: this.maxH, uRo: p.ro, uCam: basis(p.f, p.up), uFocal: p.focal,
      uMorph: p.morph, uWorld: p.world, uRelief: p.relief, uInk: p.ink, uFlat: p.flat, uWaterY: p.waterY, uTime: p.time, uStarRot: p.starRot,
      uCloudT: p.cloudT, uCover: p.cover, uExposure: p.exposure, uFog: p.fog, uMist: p.mist, uSnow: p.snow, uSun: sd, uKey: norm(p.key), uMoon: norm(p.moon),
      uZen: k.zen, uHorS: k.horS, uHorA: k.horA, uGlow: k.glow, uSunCol: k.sun, uSunColHigh: kh.sun, uSunDisk: mix3([0, 0, 0], [1.0, 0.72, 0.42], clamp((e + 0.02) / 0.05, 0, 1)).map((v, i) => v * (1 + [0, 0.25, 0.6][i] * clamp(e / 0.3, 0, 1))),
      uMoonCol: moonCol, uNight: k.night, uHorFall: 3.2 + 3.0 * tw, uHorPow: 1.5 + 2.0 * tw, uMidS: k.midS, uMidA: k.midA,
      uTop: (0.36 * p.relief * (1 - p.morph) + 11.5 * p.morph) + 0.02, uWave: p.wave,
    }, target);
  }
  map(env, camP, camD) { this.g.draw(this.pMap, { uHeight: this.height, uCamP: camP, uCamD: camD }); }
}

let inst = null;
export function getWorld(env) { return inst || (inst = new World(env)); }
