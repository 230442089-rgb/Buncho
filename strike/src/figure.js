// figure.js — 3D の人物（ユリア・マッスル文鳥）と小物を描く。
//   モデルはビルドのときに作って埋め込んである（strike/model/、tools/strike_models.mjs）。
//   頂点は「どの骨にどれだけ従うか」を持ち、骨の姿勢を変えるだけで体が動く（スキニング）。
//   色は頂点の「材質の番号」と「境目の場」から画素ごとに決めるので、網目が粗くても、ほおの白や服の切り替えがくっきり出る。
import { HEAD } from '../../flight/src/shaders.js';

const { cos, sin, PI, hypot } = Math, D2R = PI / 180;
export const MAXB = 56, MAXM = 32;

// ---- 4×3 行列（列ごとに 12 個: 右・上・前・位置）。骨の姿勢に使う
const mul = (o, oo, a, ao, b, bo) => {
  const a0 = a[ao], a1 = a[ao + 1], a2 = a[ao + 2], a3 = a[ao + 3], a4 = a[ao + 4], a5 = a[ao + 5], a6 = a[ao + 6], a7 = a[ao + 7], a8 = a[ao + 8];
  for (let c = 0; c < 4; c++) {
    const x = b[bo + c * 3], y = b[bo + c * 3 + 1], z = b[bo + c * 3 + 2];
    o[oo + c * 3] = a0 * x + a3 * y + a6 * z + (c === 3 ? a[ao + 9] : 0); o[oo + c * 3 + 1] = a1 * x + a4 * y + a7 * z + (c === 3 ? a[ao + 10] : 0); o[oo + c * 3 + 2] = a2 * x + a5 * y + a8 * z + (c === 3 ? a[ao + 11] : 0);
  }
};
// 回転と移動だけの行列の逆
const inv = (m) => { const o = new Float32Array(12); o[0] = m[0]; o[1] = m[3]; o[2] = m[6]; o[3] = m[1]; o[4] = m[4]; o[5] = m[7]; o[6] = m[2]; o[7] = m[5]; o[8] = m[8]; for (let i = 0; i < 3; i++) o[9 + i] = -(o[i] * m[9] + o[3 + i] * m[10] + o[6 + i] * m[11]); return o; };
// 度で書く回転（Z → X → Y の順。モデルを作る側の euler と同じ）と、ずらし
const trs = (o, rx, ry, rz, tx, ty, tz, s) => {
  const cx = cos(rx * D2R), sx = sin(rx * D2R), cy = cos(ry * D2R), sy = sin(ry * D2R), cz = cos(rz * D2R), sz = sin(rz * D2R);
  o[0] = (cy * cz + sy * sx * sz) * s; o[1] = cx * sz * s; o[2] = (-sy * cz + cy * sx * sz) * s;
  o[3] = (-cy * sz + sy * sx * cz) * s; o[4] = cx * cz * s; o[5] = (sy * sz + cy * sx * cz) * s;
  o[6] = sy * cx * s; o[7] = -sx * s; o[8] = cy * cx * s; o[9] = tx; o[10] = ty; o[11] = tz;
};
const b64 = (uri) => { const bin = atob(uri.slice(uri.indexOf(',') + 1)), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8.buffer; };
const lin = (v) => Math.pow(v, 2.2);
const hex = (h) => [lin(parseInt(h.slice(1, 3), 16) / 255), lin(parseInt(h.slice(3, 5), 16) / 255), lin(parseInt(h.slice(5, 7), 16) / 255)];
// 質感の種類（材質の kind）
export const KIND = { matte: 0, feather: 1, hair: 2, skin: 3, gloss: 4, glow: 5, eye: 6, face: 7, beak: 8, scaly: 9, cloth: 10, metal: 11, film: 12 };

const VS = `#version 300 es
precision highp float; precision highp int;
in vec3 aPos; in vec4 aNor; in uvec4 aMat; in vec4 aMask; in uvec4 aBone;
uniform mat4 uVP; uniform mat4 uModel; uniform mat4x3 uBones[${MAXB}]; uniform float uLine; uniform vec3 uCam;
out vec3 vN, vW, vObj, vNo; out float vAO, vZ; out vec2 vMask; flat out uvec4 vMat;
void main(){
  float w0 = aMask.z * (127.0 / 127.0);
  mat4x3 B = uBones[aBone.x] * w0 + uBones[aBone.y] * (1.0 - w0);
  vec3 p = B * vec4(aPos, 1.0), n = mat3(B) * aNor.xyz;
  vec4 w = uModel * vec4(p, 1.0); vec3 nw = normalize(mat3(uModel) * n);
  // 輪郭線の回: 面を法線の向きへ、画面の上で同じ太さになるぶんだけ押し出す
  w.xyz += nw * uLine * distance(uCam, w.xyz);
  vW = w.xyz; vN = nw; vObj = aPos; vNo = aNor.xyz; vAO = aNor.w * (127.0 / 127.0); vMask = aMask.xy; vMat = aMat;
  gl_Position = uVP * w; vZ = gl_Position.w;
}`;
const FS = (HDR) => HEAD + `
in vec3 vN, vW, vObj, vNo; in float vAO, vZ; in vec2 vMask; flat in uvec4 vMat; out vec4 o;
uniform sampler2D uScene; uniform vec2 uInv; uniform sampler2D uFace; uniform vec4 uFaceRect;
uniform vec3 uSun, uSunCol, uMoon, uMoonCol, uTop, uHor, uCam, uFogCol;
uniform float uFog, uExposure, uFade, uToon, uTime, uLine, uAlpha;
uniform vec4 uPal[${MAXM * 3}], uTint, uKey;
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 softclip(vec3 x){ const float a = 0.75; vec3 y = (x - a) / (1.0 - a); return mix(x, a + (1.0 - a) * (1.0 - exp(-y)), step(a, x)); }
float h31(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  float a = textureLod(uScene, gl_FragCoord.xy * uInv, 0.0).a;
#if ${HDR}
  if (a < vZ - (0.03 + 0.012 * vZ)) discard;
#else
  float zs = a > 0.005 ? (1.0 / a - 1.0) * 4.0 : 1e4;
  if (zs < vZ - (0.1 + 0.08 * vZ)) discard;
#endif
  // ---- 材質: A を地に、境目の場が負の側へ B・C を重ねる（場の変わり方から、境目を 1 画素ぶんだけぼかす）
  float f1 = vMask.x, f2 = vMask.y;
  float s1 = (vMat.w & 1u) != 0u ? clamp(0.5 - 0.5 * f1, 0.0, 1.0) : clamp(0.5 - f1 / max(fwidth(f1), 1e-5), 0.0, 1.0);
  float s2 = (vMat.w & 2u) != 0u ? clamp(0.5 - 0.5 * f2, 0.0, 1.0) : clamp(0.5 - f2 / max(fwidth(f2), 1e-5), 0.0, 1.0);
  if (vMat.y == vMat.x) s1 = 0.0; if (vMat.z == vMat.x) s2 = 0.0;
  int ia = int(vMat.x) * 3, ib = int(vMat.y) * 3, ic = int(vMat.z) * 3;
  vec4 p0 = mix(mix(uPal[ia], uPal[ib], s1), uPal[ic], s2), p1 = mix(mix(uPal[ia + 1], uPal[ib + 1], s1), uPal[ic + 1], s2), p2 = mix(mix(uPal[ia + 2], uPal[ib + 2], s1), uPal[ic + 2], s2);
  float kind = s2 > 0.5 ? uPal[ic].a : s1 > 0.5 ? uPal[ib].a : uPal[ia].a;
  vec3 alb = p0.rgb; float spec = p1.x, gloss = p1.y, rim = p1.z, emis = p1.w; vec3 shade = p2.rgb; float toon = uToon * p2.a;
  vec3 v = normalize(uCam - vW), n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 Ld = normalize(mix(uSun, uKey.xyz, uKey.w));                // 見せ場では、決まった向きの光を当てる（顔が影にならないように）
  float nv = max(dot(n, v), 0.0), ndl = dot(n, Ld), ao = vAO;
  // ---- 輪郭線の回: 地の色を濃くした線
  if (uLine > 0.0) {
    vec3 amb0 = (mix(uHor, uTop, 0.6) * 1.6 + uSunCol * 0.6) * 0.25;
    vec3 lc = alb * shade * 0.5 * amb0 * uExposure;
    lc = toSRGB(softclip(lc));
    float fg = 1.0 - exp(-vZ * vZ * 0.00034 * uFog);
    o = vec4(mix(lc, uFogCol, fg) * uFade, 1.0); return;
  }
  // ---- 質感ごとの下ごしらえ
  if (kind == 2.0) {                                             // 髪: 毛の流れに沿った、ごくうすい筋
    float st = vnoise(vec3(vObj.x * 15.0, vObj.y * 0.9, vObj.z * 15.0));
    alb *= 0.94 + 0.09 * st;
  } else if (kind == 1.0) {                                      // 羽: 流れに沿った細い筋と、まだら
    float st = vnoise(vObj * vec3(46.0, 7.0, 46.0)), bl = vnoise(vObj * 5.0);
    alb *= 0.90 + 0.14 * st + 0.08 * (bl - 0.5);
    spec *= 0.6 + 0.8 * st;
  } else if (kind == 9.0) {                                      // 鳥の脚: うろこの横じま
    float sc = smoothstep(0.35, 0.5, abs(fract(vObj.y * 9.0 + 0.3 * sin(vObj.x * 20.0)) - 0.5));
    alb *= 0.86 + 0.14 * sc;
  } else if (kind == 8.0) {                                      // くちばし: 付け根は濃く、先とふちは白っぽい
    alb = mix(alb, shade, clamp(p2.a, 0.0, 1.0) * 0.0);
  }
  // ---- 顔の貼り込み（目・口・ほお）。頭の正面だけ
  vec4 dec = vec4(0.0);
  if (kind == 7.0 && vNo.z > 0.05) {
    vec2 uv = vec2(0.5) + vec2(uFaceRect.x - vObj.x, uFaceRect.y - vObj.y) * uFaceRect.z;      // 本人の左（-x）が、絵の右
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) dec = texture(uFace, uv) * smoothstep(0.05, 0.3, vNo.z);
  }
  // ---- 光。風景の明るさの基準（白い物の反射率がおよそ 0.25）に合わせる
  const float K = 0.25;
  vec3 sun = uSunCol * K;
  vec3 amb = (mix(uHor, uTop, smoothstep(-0.3, 1.0, n.y)) * 1.7 + uSunCol * 0.05 * max(-n.y, 0.0) + uMoonCol * (0.6 + 0.8 * max(dot(n, uMoon), 0.0)) * 4.0) * K;
  float litR = smoothstep(-0.25, 0.85, ndl), litT = kind == 7.0 ? smoothstep(-0.3, 0.45, ndl) : smoothstep(-0.03, 0.09, ndl);   // 顔の陰影はやわらかく
  vec3 col;
  if (toon > 0.5) {
    // 絵のような陰影: 明るい側と影の側の 2 階調。影は材質ごとの影の色へ寄せる（暗くなりすぎない）
    vec3 ambA = (uHor * 0.9 + uTop * 0.8) * K;
    vec3 Llit = sun + ambA * 1.1, Lsh = ambA * 1.9 + sun * 0.34;
    // 3 階調: 影 → 中間（光に対してななめの面）→ いちばん明るい面。肌は 2 階調のまま、なめらかに
    float t2 = (kind == 7.0 || kind == 3.0) ? 1.0 : smoothstep(0.40, 0.58, ndl);
    vec3 mid = mix(Lsh * mix(shade, vec3(1.0), 0.45), Llit, 0.6);
    col = alb * mix(Lsh * shade * (0.72 + 0.28 * ao), mix(mid, Llit, t2), litT * (0.85 + 0.15 * ao));
  } else {
    col = alb * (sun * litR * (0.55 + 0.45 * ao) + amb * ao);
    col *= mix(mix(shade, vec3(1.0), 0.55), vec3(1.0), litR);
  }
  vec3 hv = normalize(Ld + v); float nh = max(dot(n, hv), 0.0), sl = step(0.0, ndl);
  if (kind == 2.0) {                                             // 髪: 帯になった光（天使の輪）
    float band = pow(nh, 20.0) * (0.7 + 0.6 * vnoise(vec3(vObj.x * 22.0, vObj.z * 22.0, 1.0)));
    col += sun * smoothstep(0.30, 0.46, band) * spec * sl;
  } else if (kind == 4.0 || kind == 11.0) {                      // つやのある装甲・金属: 空の映り込み
    vec3 r = reflect(-v, n); float fr = 0.04 + 0.6 * pow(1.0 - nv, 5.0);
    vec3 env = mix(uHor, uTop, smoothstep(0.0, 0.6, r.y)) * mix(0.2, 1.0, smoothstep(-0.3, 0.05, r.y)) * K * 2.2;
    col += env * fr * (kind == 11.0 ? 1.6 : 0.9) * ao + sun * pow(nh, gloss) * spec * 3.0 * sl;
    if (kind == 11.0) col += alb * env * 0.5 * ao;
  } else if (kind == 6.0) {                                      // 目: 黒くぬれた玉。空の映り込みと、光の点
    vec3 r = reflect(-v, n);
    col += mix(uHor, uTop, smoothstep(-0.2, 0.7, r.y)) * K * (0.06 + 0.5 * pow(1.0 - nv, 4.0));
    col += (sun * 1.2 + uTop * K * 2.0) * (smoothstep(0.985, 0.995, dot(n, normalize(v + vec3(0.28, 0.62, 0.1)))) * 0.9 + pow(nh, 200.0) * 4.0 * sl);
  } else {
    float sp = pow(nh, gloss) * spec;
    col += sun * mix(sp * (kind == 8.0 ? 2.2 : 0.55), smoothstep(0.3, 0.45, sp) * spec * 2.0, toon) * sl;
  }
  // ふちの光（空の色）
  float rk = pow(1.0 - nv, mix(3.0, 2.4, toon));
  col += (uTop * 1.5 + uHor * 0.6) * K * mix(0.9, 2.0, toon) * rim * mix(rk, smoothstep(0.40, 0.58, rk), toon) * mix(0.35 + 0.65 * ao, 1.0, toon) * (0.4 + 0.6 * smoothstep(-0.5, 0.4, n.y + ndl));
  col = col * uExposure;
  // 顔の絵は、光の強さだけを受ける（陰影で目がつぶれないように）
  if (dec.a > 0.0) { vec3 lv = (sun * (0.36 + 0.56 * litT) + (uHor + uTop) * K * 1.1) * uExposure; col = mix(col, dec.rgb / max(dec.a, 1e-3) * lv, dec.a); }
  col = mix(col, alb * emis, clamp(emis, 0.0, 1.0));                          // 自分で光る部分（時刻によらない明るさ）
  col = mix(col, vec3(2.2, 2.0, 1.6), uTint.a) * uTint.rgb;                    // 当たったときの白い光
  col = toSRGB(softclip(col));
  float fg = 1.0 - exp(-vZ * vZ * 0.00034 * uFog);
  col = mix(col, uFogCol, fg * (1.0 - 0.6 * clamp(emis, 0.0, 1.0)));
  float al = 1.0;
  if (uAlpha > 0.0) {                                            // 光の膜（翼）: うろこ模様の、すける面
    vec2 q = vObj.xy * vec2(6.5, 8.0); q.x += 0.5 * floor(q.y); vec2 c = fract(q) - vec2(0.5, 0.0);
    float d = min(length(c * vec2(1.0, 0.8)), length((c - vec2(sign(c.x) * 0.5, 1.0)) * vec2(1.0, 0.8)));       // うろこ: 上の段と半分ずれて重なる丸い板
    float sc = smoothstep(0.46, 0.30, d), edge = smoothstep(0.30, 0.42, d) * smoothstep(0.52, 0.44, d);
    al = clamp((0.26 + 0.3 * sc + 0.3 * edge + 0.4 * pow(1.0 - nv, 2.0)) * uAlpha, 0.0, 1.0);
    col *= 0.78 + 0.3 * sc + 0.6 * edge;
  }
  o = vec4(col * uFade * al, al);
}`;

// ============================================================ モデルを読む
function readModels(buf) {
  const dv = new DataView(buf), jl = dv.getUint32(0, true), heads = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, jl)));
  let off = 4 + jl; const out = {};
  for (const h of heads) {
    // 置いたあとの頂点の数を数える（不透明 → 半透明の順に並べる）
    let nv = 0, nt = 0; for (const p of h.parts) { nv += p.nv * p.copies.length; nt += p.nq * 2 * p.copies.length; }
    const vb = new ArrayBuffer(nv * 28), f32 = new Float32Array(vb), u8 = new Uint8Array(vb), i8 = new Int8Array(vb), idx = new Uint32Array(nt * 3);
    let v0 = 0, i0 = 0; const ranges = { solid: [0, 0], alpha: [0, 0] }, src = [];
    for (const p of h.parts) { src.push([off, off + p.nv * 20]); off += p.nv * 20 + p.nq * 8; }
    for (const pass of [0, 1]) {
      const start = i0;
      h.parts.forEach((p, pi) => {
        if (p.alpha !== pass) return;
        const sv = new DataView(buf, src[pi][0], p.nv * 20), sq = new Uint16Array(buf.slice(src[pi][1], src[pi][1] + p.nq * 8));
        for (const c of p.copies) {
          const m = c.m, mir = c.x ? -1 : 1;
          for (let v = 0; v < p.nv; v++) {
            const o = v * 20, d = (v0 + v) * 28;
            let x = p.qmin[0] + sv.getUint16(o, true) / 65535 * p.qsize[0], y = p.qmin[1] + sv.getUint16(o + 2, true) / 65535 * p.qsize[1], z = p.qmin[2] + sv.getUint16(o + 4, true) / 65535 * p.qsize[2];
            let nx = sv.getInt8(o + 6) / 127, ny = sv.getInt8(o + 7) / 127, nz = sv.getInt8(o + 8) / 127;
            x *= mir; nx *= mir;
            f32[d / 4] = m[0] * x + m[3] * y + m[6] * z + m[9]; f32[d / 4 + 1] = m[1] * x + m[4] * y + m[7] * z + m[10]; f32[d / 4 + 2] = m[2] * x + m[5] * y + m[8] * z + m[11];
            const wx = m[0] * nx + m[3] * ny + m[6] * nz, wy = m[1] * nx + m[4] * ny + m[7] * nz, wz = m[2] * nx + m[5] * ny + m[8] * nz, l = hypot(wx, wy, wz) || 1;
            i8[d + 12] = Math.round(wx / l * 127); i8[d + 13] = Math.round(wy / l * 127); i8[d + 14] = Math.round(wz / l * 127); i8[d + 15] = sv.getUint8(o + 9) >> 1;
            u8[d + 16] = sv.getUint8(o + 10); u8[d + 17] = sv.getUint8(o + 11); u8[d + 18] = sv.getUint8(o + 12); u8[d + 19] = sv.getUint8(o + 13);
            i8[d + 20] = sv.getInt8(o + 14); i8[d + 21] = sv.getInt8(o + 15); i8[d + 22] = sv.getUint8(o + 16) >> 1; i8[d + 23] = 0;
            let b0 = sv.getUint8(o + 18), b1 = sv.getUint8(o + 19);
            if (c.bm) { b0 = c.bm[b0]; b1 = c.bm[b1]; }
            if (c.b !== undefined) b0 = b1 = c.b;
            u8[d + 24] = b0; u8[d + 25] = b1; u8[d + 26] = 0; u8[d + 27] = 0;
          }
          // 四角形を、短い対角線で 2 つの三角形に。左右を反転した写しは、面の向きも裏返す
          const P = (k) => { const d = (v0 + k) * 7; return [f32[d], f32[d + 1], f32[d + 2]]; }, d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
          for (let q = 0; q < p.nq; q++) {
            let a = sq[q * 4], b = sq[q * 4 + 1], cc = sq[q * 4 + 2], d = sq[q * 4 + 3];
            if (c.x) { const t = b; b = d; d = t; }
            if (d2(P(a), P(cc)) <= d2(P(b), P(d))) { idx[i0++] = v0 + a; idx[i0++] = v0 + b; idx[i0++] = v0 + cc; idx[i0++] = v0 + a; idx[i0++] = v0 + cc; idx[i0++] = v0 + d; }
            else { idx[i0++] = v0 + a; idx[i0++] = v0 + b; idx[i0++] = v0 + d; idx[i0++] = v0 + b; idx[i0++] = v0 + cc; idx[i0++] = v0 + d; }
          }
          v0 += p.nv;
        }
      });
      ranges[pass ? 'alpha' : 'solid'] = [start, i0 - start];
    }
    // 骨: 休みの姿勢（モデルの座標）と、その逆、親から見た休みの姿勢
    const nb = h.bones.length, bind = new Float32Array(nb * 12), ibind = new Float32Array(nb * 12), rest = new Float32Array(nb * 12), bi = {};
    h.bones.forEach((b, i) => { bind.set(b.m, i * 12); ibind.set(inv(b.m), i * 12); bi[b.n] = i; });
    h.bones.forEach((b, i) => { if (b.p < 0) rest.set(b.m, i * 12); else mul(rest, i * 12, ibind, b.p * 12, bind, i * 12); });
    // 材質の表: [色, 種類], [つや, 鋭さ, ふちの光, 光る度合い], [影の色, 絵のような陰影の度合い]
    const pal = new Float32Array(MAXM * 12);
    h.mats.forEach((m, i) => {
      const c = hex(m.col), s = m.shade ? hex(m.shade) : [0.62, 0.62, 0.7];
      pal.set([c[0], c[1], c[2], KIND[m.kind || 'matte'], m.spec ?? 0.1, m.gloss ?? 24, m.rim ?? 0.12, m.emis ?? 0, s[0] / Math.max(c[0], 0.02), s[1] / Math.max(c[1], 0.02), s[2] / Math.max(c[2], 0.02), m.toon ?? 1], i * 12);
      if (!m.shade) pal.set([0.62, 0.62, 0.70], i * 12 + 8);
    });
    out[h.name] = { h, vb, idx, ranges, nb, bones: h.bones, bi, bind, ibind, rest, pal, nv, nt };
  }
  return out;
}

// ============================================================ 姿勢（モデル 1 体ぶんの骨の状態）
export class Pose {
  constructor(model) {
    this.m = model; const n = model.nb;
    this.a = new Float32Array(n * 7); for (let i = 0; i < n; i++) this.a[i * 7 + 6] = 1;     // 骨ごとの [rx, ry, rz, tx, ty, tz, 大きさ]
    this.world = new Float32Array(n * 12); this.skin = new Float32Array(n * 12); this.skinN = this.skin; this.tmp = new Float32Array(24);
    this.update();
  }
  reset() { const a = this.a; a.fill(0); for (let i = 0; i < this.m.nb; i++) a[i * 7 + 6] = 1; return this; }
  // 骨を回す（度。前へ倒す = rx が正、左右へ向く = ry、横へ傾く = rz）
  rot(name, rx = 0, ry = 0, rz = 0) { const i = this.m.bi[name]; if (i === undefined) return this; const a = this.a; a[i * 7] = rx; a[i * 7 + 1] = ry; a[i * 7 + 2] = rz; return this; }
  add(name, rx = 0, ry = 0, rz = 0) { const i = this.m.bi[name]; if (i === undefined) return this; const a = this.a; a[i * 7] += rx; a[i * 7 + 1] += ry; a[i * 7 + 2] += rz; return this; }
  pos(name, x = 0, y = 0, z = 0) { const i = this.m.bi[name]; if (i === undefined) return this; const a = this.a; a[i * 7 + 3] = x; a[i * 7 + 4] = y; a[i * 7 + 5] = z; return this; }
  scale(name, s) { const i = this.m.bi[name]; if (i !== undefined) this.a[i * 7 + 6] = s; return this; }
  update() {
    const { nb, bones, rest, ibind } = this.m, w = this.world, a = this.a, t = this.tmp;
    for (let i = 0; i < nb; i++) {
      trs(t, a[i * 7], a[i * 7 + 1], a[i * 7 + 2], a[i * 7 + 3], a[i * 7 + 4], a[i * 7 + 5], a[i * 7 + 6]);
      mul(t, 12, rest, i * 12, t, 0);
      if (bones[i].p < 0) for (let k = 0; k < 12; k++) w[i * 12 + k] = t[12 + k]; else mul(w, i * 12, w, bones[i].p * 12, t, 12);
      mul(this.skin, i * 12, w, i * 12, ibind, i * 12);
    }
    return this;
  }
  // 骨の「前」（局所の +z）を、モデルの座標での向き dir へ向ける（up: ひねりの目安）。親までの姿勢が決まっていること（先に update）。あとでもう一度 update する
  aim(name, dir, up = [0, 1, 0]) {
    const i = this.m.bi[name]; if (i === undefined) return this; const pi = this.m.bones[i].p * 12, w = this.world, a = this.a;
    let f = dir, l = hypot(f[0], f[1], f[2]) || 1; f = [f[0] / l, f[1] / l, f[2] / l];
    let r = [up[1] * f[2] - up[2] * f[1], up[2] * f[0] - up[0] * f[2], up[0] * f[1] - up[1] * f[0]]; l = hypot(r[0], r[1], r[2]) || 1; r = [r[0] / l, r[1] / l, r[2] / l];
    const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    // 親の向き（列 = 右・上・前。大きさ 1 と仮定）の逆を掛けて、局所の回転にする
    const L = (v, c) => w[pi + c * 3] * v[0] + w[pi + c * 3 + 1] * v[1] + w[pi + c * 3 + 2] * v[2];
    const m7 = L(f, 1), m6 = L(f, 0), m8 = L(f, 2), m1 = L(r, 1), m4 = L(u, 1);
    a[i * 7] = Math.asin(Math.max(-1, Math.min(1, -m7))) / D2R; a[i * 7 + 1] = Math.atan2(m6, m8) / D2R; a[i * 7 + 2] = Math.atan2(m1, m4) / D2R;
    return this;
  }
  // 骨の座標での点 → モデルの座標
  at(name, p = [0, 0, 0]) { const i = this.m.bi[name] * 12, w = this.world; return [w[i] * p[0] + w[i + 3] * p[1] + w[i + 6] * p[2] + w[i + 9], w[i + 1] * p[0] + w[i + 4] * p[1] + w[i + 7] * p[2] + w[i + 10], w[i + 2] * p[0] + w[i + 5] * p[1] + w[i + 8] * p[2] + w[i + 11]]; }
}

// 人物の骨に小物を付ける: 人物の置き場所 m16 × その骨の動き（小物は人物と同じ座標で作ってある）
export function attach(m16, pose, bone, out = new Float32Array(16)) {
  const i = pose.m.bi[bone] * 12, k = pose.skin;
  for (let c = 0; c < 4; c++) {
    const x = k[i + c * 3], y = k[i + c * 3 + 1], z = k[i + c * 3 + 2], w = c === 3 ? 1 : 0;
    for (let r = 0; r < 4; r++) out[c * 4 + r] = m16[r] * x + m16[4 + r] * y + m16[8 + r] * z + m16[12 + r] * w;
  }
  return out;
}

// ============================================================ 描く
export class Figures {
  constructor(g, asset) {
    const gl = g.gl; this.g = g; this.gl = gl; this.queue = [];
    this.prog = g.program(FS(g.floatRT ? 1 : 0), 'figure', VS, ['aPos', 'aNor', 'aMat', 'aMask', 'aBone']);
    this.models = asset ? readModels(typeof asset === 'string' ? b64(asset) : asset) : {};
    let id = 0;
    for (const k in this.models) {
      const m = this.models[k], vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, m.vb, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.BYTE, true, 28, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribIPointer(2, 4, gl.UNSIGNED_BYTE, 28, 16);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.BYTE, true, 28, 20);
      gl.enableVertexAttribArray(4); gl.vertexAttribIPointer(4, 4, gl.UNSIGNED_BYTE, 28, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      m.vao = vao; m.vb = null; m.idx = null; m.id = id++; m.palN = m.pal.subarray(0, Math.max(1, m.h.mats.length) * 12);
    }
    const cv = document.createElement('canvas'); cv.width = cv.height = 4; this.blank = g.fromCanvas(cv, { filter: 'linear' });
    this.count = 0;
  }
  pose(name) { return new Pose(this.models[name]); }
  begin() { this.queue.length = 0; this.count = 0; }
  // pose: 姿勢, m16: 置き場所（列ごとの 4×4）, o: { tint: [r,g,b,白く光る度合い], face: 顔の絵（テクスチャ）, faceRect, toon: 絵のような陰影, line: 輪郭線の太さ, alpha: 膜の濃さ }
  draw(pose, m16, o = {}) { this.queue.push({ pose, m: m16, o }); this.count++; }
  flush(ctx, L, cam) {
    if (!this.queue.length) return;
    const gl = this.gl, g = this.g, k = L.k;
    const top = [0, 1, 2].map((i) => k.zen[i] * 1.6 + k.horA[i] * 0.35), hor = [0, 1, 2].map((i) => (k.horA[i] + k.horS[i]) * 0.45 + k.zen[i] * 0.5);
    g.use(this.prog, { uVP: ctx.VP, uScene: ctx.scene, uInv: ctx.inv, uSun: L.sun, uSunCol: L.u.uSunColHigh, uMoon: L.u.uMoon, uMoonCol: L.u.uMoonCol.map((v) => v * 3), uTop: top, uHor: hor, uCam: cam.ro, uFogCol: ctx.fogCol, uFog: L.fog, uExposure: L.exposure, uFade: ctx.fade, uTime: ctx.time || 0 });
    const P = this.prog, loc = (n) => (P.loc && P.loc[n] !== undefined ? P.loc[n] : ((P.loc = P.loc || {})[n] = gl.getUniformLocation(P.p, n)));
    // 同じモデルをまとめて描く（材質の表や骨は、変わったときだけ送る。弾のように姿勢を使い回す物は、置き場所だけが変わる）
    this.queue.sort((a, b) => a.pose.m.id - b.pose.m.id);
    let lm = null, lp = null, lf = null;
    const one = (q, pass) => {
      const m = q.pose.m, o = q.o, r = pass === 2 ? m.ranges.alpha : m.ranges.solid; if (!r[1]) return;
      if (lm !== m) { gl.uniform4fv(loc('uPal[0]'), m.palN); gl.uniform4fv(loc('uFaceRect'), m.h.faceRect || [0, 0, 0.4, 0]); gl.bindVertexArray(m.vao); lm = m; lp = null; }
      if (lp !== q.pose) { gl.uniformMatrix4x3fv(loc('uBones[0]'), false, q.pose.skinN); lp = q.pose; }
      gl.uniformMatrix4fv(loc('uModel'), false, q.m);
      gl.uniform4fv(loc('uTint'), o.tint || [1, 1, 1, 0]);
      gl.uniform4fv(loc('uKey'), o.key || [0, 1, 0, 0]);
      gl.uniform1f(loc('uToon'), o.toon ?? (m.h.toon || 0));
      gl.uniform1f(loc('uLine'), pass === 1 ? (o.line ?? (m.h.line || 0)) : 0);
      gl.uniform1f(loc('uAlpha'), pass === 2 ? (o.alpha ?? 1) : 0);
      const ft = o.face || this.blank; if (lf !== ft) { gl.activeTexture(gl.TEXTURE0 + 5); gl.bindTexture(gl.TEXTURE_2D, ft.tex); gl.uniform1i(loc('uFace'), 5); lf = ft; }
      gl.drawElements(gl.TRIANGLES, r[1], gl.UNSIGNED_INT, r[0] * 4); this.tris += r[1] / 3;
    };
    // この世界は「x が東・y が上・z が北」の左手系なので、表の面は時計回りに見える
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW);
    this.tris = 0; for (const q of this.queue) one(q, 0);
    // 輪郭線: 裏返しの面を、少しふくらませて描く
    gl.cullFace(gl.FRONT); lm = lp = null;
    for (const q of this.queue) if ((q.o.line ?? (q.pose.m.h.line || 0)) > 0) one(q, 1);
    gl.disable(gl.CULL_FACE);
    // 半透明（翼の光の膜）: 奥行きは比べるだけで、書きこまない
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); lm = lp = null;
    for (const q of this.queue) one(q, 2);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.frontFace(gl.CCW);
    gl.bindVertexArray(null); gl.activeTexture(gl.TEXTURE0);
  }
}
