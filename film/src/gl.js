// gl.js — WebGL2 の薄いラッパー（プログラム・レンダーターゲット・全画面描画）と共通 GLSL

export const GLSL_COMMON = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718
#define sat(x) clamp(x, 0.0, 1.0)

// ---- 整数ハッシュ（sin を使わないので格子ノイズに縞が出ない）
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uvec2 pcg2(uvec2 v){ v = v * 1664525u + 1013904223u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; return v; }
uvec3 pcg3(uvec3 v){ v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v; }
const float INV32 = 1.0 / 4294967295.0;
float hashi(ivec2 p){ return float(pcg2(uvec2(p)).x) * INV32; }
vec2  hashi2(ivec2 p){ return vec2(pcg2(uvec2(p))) * INV32; }
float hashi(ivec3 p){ return float(pcg3(uvec3(p)).x) * INV32; }
vec3  hashi3(ivec3 p){ return vec3(pcg3(uvec3(p))) * INV32; }
float hash11(float p){ return float(pcg(floatBitsToUint(p))) * INV32; }
float hash21(vec2 p){ return float(pcg2(floatBitsToUint(p)).x) * INV32; }
vec2  hash22(vec2 p){ return vec2(pcg2(floatBitsToUint(p))) * INV32; }
vec3  hash33(vec3 p){ return vec3(pcg3(floatBitsToUint(p))) * INV32; }
vec3  hash23(vec2 p){ return vec3(pcg3(uvec3(floatBitsToUint(p), 7u))) * INV32; }

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

// ---- 値ノイズ（5次補間）
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0); ivec2 q = ivec2(i);
  return mix(mix(hashi(q), hashi(q + ivec2(1,0)), u.x), mix(hashi(q + ivec2(0,1)), hashi(q + ivec2(1,1)), u.x), u.y);
}
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0); ivec3 q = ivec3(i);
  return mix(mix(mix(hashi(q), hashi(q+ivec3(1,0,0)), u.x), mix(hashi(q+ivec3(0,1,0)), hashi(q+ivec3(1,1,0)), u.x), u.y),
             mix(mix(hashi(q+ivec3(0,0,1)), hashi(q+ivec3(1,0,1)), u.x), mix(hashi(q+ivec3(0,1,1)), hashi(q+ivec3(1,1,1)), u.x), u.y), u.z);
}
// ---- 勾配ノイズ（-1..1）
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0); ivec2 q = ivec2(i);
  #define GR2(o) dot(normalize(hashi2(q + o) * 2.0 - 1.0 + 1e-4), f - vec2(o))
  return 1.4142 * mix(mix(GR2(ivec2(0,0)), GR2(ivec2(1,0)), u.x), mix(GR2(ivec2(0,1)), GR2(ivec2(1,1)), u.x), u.y);
}
float gnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); vec3 u = f*f*f*(f*(f*6.0-15.0)+10.0); ivec3 q = ivec3(i);
  #define GR3(o) dot(hashi3(q + o) * 2.0 - 1.0, f - vec3(o))
  return 1.6 * mix(mix(mix(GR3(ivec3(0,0,0)), GR3(ivec3(1,0,0)), u.x), mix(GR3(ivec3(0,1,0)), GR3(ivec3(1,1,0)), u.x), u.y),
             mix(mix(GR3(ivec3(0,0,1)), GR3(ivec3(1,0,1)), u.x), mix(GR3(ivec3(0,1,1)), GR3(ivec3(1,1,1)), u.x), u.y), u.z);
}
const mat2 M2 = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * gnoise(p); p = M2 * p + 17.3; a *= 0.5; } return s; }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * gnoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
// 回転（curl）ノイズ: 発散のない 2D 流れ
vec2 curl2(vec2 p){ const float e = 0.01; float a = fbm(p + vec2(0, e)), b = fbm(p - vec2(0, e)), c = fbm(p + vec2(e, 0)), d = fbm(p - vec2(e, 0)); return vec2(a - b, d - c) / (2.0 * e); }

// ---- 色
vec3 toLinear(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSRGB(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b * cos(TAU * (c * t + d)); }
// 全編共通の色（linear）
const vec3 C_INK   = vec3(0.0015, 0.0018, 0.0030);
const vec3 C_PAPER = vec3(0.905, 0.862, 0.791);
const vec3 C_SHU   = vec3(1.0, 0.070, 0.024);
const vec3 C_GOLD  = vec3(0.887, 0.558, 0.202);
const vec3 C_AI    = vec3(0.020, 0.051, 0.258);
const vec3 C_TEAL  = vec3(0.098, 0.584, 0.552);

// ---- 2D SDF
float sdCircle(vec2 p, float r){ return length(p) - r; }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k){ return -smin(-a, -b, k); }
// アンチエイリアスつきの塗り・線（d は画素単位でなく同じ単位の距離、w は 1 画素の幅）
float aaFill(float d, float w){ return sat(0.5 - d / w); }
float aaLine(float d, float thick, float w){ return sat(0.5 - (abs(d) - thick * 0.5) / w); }
`;

const VS_FULL = `#version 300 es
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
uniform vec2 uRes;
`;

function numbered(src) {
  return src.split('\n').map((l, i) => String(i + 1).padStart(4, ' ') + '  ' + l).join('\n');
}

class Program {
  constructor(glx, vsSrc, fsSrc, name) {
    const gl = glx.gl;
    this.glx = glx; this.gl = gl; this.name = name;
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vsSrc], [gl.FRAGMENT_SHADER, fsSrc]]) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh);
        const lines = [...log.matchAll(/ERROR: \d+:(\d+)/g)].map((m) => +m[1]);
        const srcLines = src.split('\n');
        const ctx = lines.slice(0, 4).map((n) => `${n}: ${srcLines[n - 1]}`).join('\n');
        throw new Error(`[shader:${name}] ${log}\n${ctx}`);
      }
      gl.attachShader(p, sh);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`[link:${name}] ${gl.getProgramInfoLog(p)}`);
    this.p = p; this.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const base = info.name.replace(/\[0\]$/, '');
      this.u[base] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
    }
    this.unit = 0;
  }
  use() { this.gl.useProgram(this.p); this.unit = 0; return this; }
  set(uniforms) {
    const gl = this.gl;
    for (const k in uniforms) {
      const u = this.u[k]; if (!u) continue;
      let v = uniforms[k];
      switch (u.type) {
        case gl.FLOAT: if (u.size > 1) gl.uniform1fv(u.loc, v); else gl.uniform1f(u.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
        case gl.INT: case gl.BOOL: if (u.size > 1) gl.uniform1iv(u.loc, v); else gl.uniform1i(u.loc, v); break;
        case gl.INT_VEC2: gl.uniform2iv(u.loc, v); break;
        case gl.FLOAT_MAT2: gl.uniformMatrix2fv(u.loc, false, v); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
        case gl.SAMPLER_2D: case gl.SAMPLER_3D: case gl.INT_SAMPLER_2D: case gl.UNSIGNED_INT_SAMPLER_2D: {
          const tex = v && v.tex ? v.tex : v;
          gl.activeTexture(gl.TEXTURE0 + this.unit);
          gl.bindTexture(u.type === gl.SAMPLER_3D ? gl.TEXTURE_3D : gl.TEXTURE_2D, tex);
          gl.uniform1i(u.loc, this.unit); this.unit++;
          break;
        }
        default: throw new Error(`uniform type ${u.type} (${k}) not handled`);
      }
    }
    return this;
  }
}

export class GLX {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 が使えません');
    this.gl = gl; this.canvas = canvas; this.W = canvas.width; this.H = canvas.height;
    for (const e of ['EXT_color_buffer_float', 'OES_texture_float_linear', 'EXT_float_blend', 'EXT_color_buffer_half_float']) gl.getExtension(e);
    this.vao = gl.createVertexArray();
    this.cur = null; // 現在のターゲット
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.stats = { programs: 0, fsChars: 0 };
  }
  // 全画面フラグメントシェーダのプログラム
  program(fs, name = 'fs', { common = true } = {}) {
    this.stats.programs++; this.stats.fsChars += fs.length;
    return new Program(this, VS_FULL, HEAD + (common ? GLSL_COMMON : '') + 'in vec2 vUv;\n' + fs, name);
  }
  // 頂点・フラグメント両方を書くプログラム
  programVF(vs, fs, name = 'vf', { common = true } = {}) {
    this.stats.programs++; this.stats.fsChars += fs.length + vs.length;
    return new Program(this, HEAD + (common ? GLSL_COMMON : '') + vs, HEAD + (common ? GLSL_COMMON : '') + fs, name);
  }
  _fmt(type) {
    const gl = this.gl;
    switch (type) {
      case 'rgba16f': return [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT];
      case 'rgba32f': return [gl.RGBA32F, gl.RGBA, gl.FLOAT];
      case 'rg16f': return [gl.RG16F, gl.RG, gl.HALF_FLOAT];
      case 'rg32f': return [gl.RG32F, gl.RG, gl.FLOAT];
      case 'r16f': return [gl.R16F, gl.RED, gl.HALF_FLOAT];
      case 'r32f': return [gl.R32F, gl.RED, gl.FLOAT];
      case 'rgba8': return [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE];
      case 'r8': return [gl.R8, gl.RED, gl.UNSIGNED_BYTE];
      default: throw new Error('format ' + type);
    }
  }
  texture(w, h, { type = 'rgba16f', filter = 'linear', wrap = 'clamp', data = null, mip = false } = {}) {
    const gl = this.gl, [internal, format, dtype] = this._fmt(type);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, dtype, data);
    const f = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    const wr = wrap === 'repeat' ? gl.REPEAT : wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
    if (mip && data) gl.generateMipmap(gl.TEXTURE_2D);
    return { tex, w, h, type, mip };
  }
  target(w, h, opts = {}) {
    const gl = this.gl, t = this.texture(w, h, opts);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    if (opts.depth) {
      const rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
      t.depth = rb;
    }
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incomplete: ' + st + ' ' + JSON.stringify(opts));
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    t.fbo = fbo;
    return t;
  }
  double(w, h, opts = {}) {
    const d = { a: this.target(w, h, opts), b: this.target(w, h, opts), w, h };
    Object.defineProperty(d, 'read', { get() { return d.a; } });
    Object.defineProperty(d, 'write', { get() { return d.b; } });
    d.swap = () => { const t = d.a; d.a = d.b; d.b = t; };
    return d;
  }
  // 2D キャンバス・画像からテクスチャ（上下を GL 向きに反転）
  texFromCanvas(src, { filter = 'linear', mip = false, wrap = 'clamp', into = null } = {}) {
    const gl = this.gl;
    const t = into || { tex: gl.createTexture(), w: src.width, h: src.height };
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const f = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    const wr = wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }
  bind(target) {
    const gl = this.gl;
    this.cur = target || null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.w : this.W, target ? target.h : this.H);
  }
  clear(r = 0, g = 0, b = 0, a = 1) { const gl = this.gl; gl.clearColor(r, g, b, a); gl.clear(gl.COLOR_BUFFER_BIT); }
  blend(mode) {
    const gl = this.gl;
    if (!mode || mode === 'none') { gl.disable(gl.BLEND); return; }
    gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
    if (mode === 'add') gl.blendFunc(gl.ONE, gl.ONE);
    else if (mode === 'alpha') gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'premul') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else if (mode === 'screen') gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    else if (mode === 'max') { gl.blendEquation(gl.MAX); gl.blendFunc(gl.ONE, gl.ONE); }
  }
  // 全画面描画。target 省略時は現在のターゲットへ
  draw(prog, uniforms = {}, target = undefined, blend = 'none') {
    const gl = this.gl;
    if (target !== undefined) this.bind(target);
    const t = this.cur;
    prog.use();
    prog.set({ uRes: [t ? t.w : this.W, t ? t.h : this.H] });
    prog.set(uniforms);
    this.blend(blend);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.blend('none');
  }
  // インスタンス・頂点バッファを持つメッシュ
  mesh(attribs, { mode = 'TRIANGLES', count = 0, instances = 0 } = {}) {
    const gl = this.gl, vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const bufs = {};
    for (const name in attribs) {
      const a = attribs[name];
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, a.data, a.dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      gl.enableVertexAttribArray(a.loc);
      gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, 0, 0);
      if (a.divisor) gl.vertexAttribDivisor(a.loc, a.divisor);
      bufs[name] = buf;
    }
    gl.bindVertexArray(null);
    const m = { vao, bufs, mode: gl[mode], count, instances };
    m.update = (name, data) => { gl.bindBuffer(gl.ARRAY_BUFFER, bufs[name]); gl.bufferSubData(gl.ARRAY_BUFFER, 0, data); };
    return m;
  }
  drawMesh(prog, mesh, uniforms = {}, blend = 'none', { count, instances } = {}) {
    const gl = this.gl, t = this.cur;
    prog.use();
    prog.set({ uRes: [t ? t.w : this.W, t ? t.h : this.H] });
    prog.set(uniforms);
    this.blend(blend);
    gl.bindVertexArray(mesh.vao);
    const c = count ?? mesh.count, n = instances ?? mesh.instances;
    if (n) gl.drawArraysInstanced(mesh.mode, 0, c, n); else gl.drawArrays(mesh.mode, 0, c);
    gl.bindVertexArray(null);
    this.blend('none');
  }
  // GPU 側の処理が終わるまで待つ（1 画素だけ読み戻す）
  finish() {
    const gl = this.gl;
    if (this.cur && this.cur.type && this.cur.type !== 'rgba8') gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, new Float32Array(4));
    else gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }
}
