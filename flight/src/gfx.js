// gfx.js — WebGL2 の薄い道具（プログラム・テクスチャ・描画先）。
//   どの端末でも動くことを優先して、拡張機能は「あれば使う」だけにしている。

const VS_FULL = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export class GFX {
  // o.depth: 画面に奥行きバッファを持たせる（3D モデルどうしの前後を正しく描くゲームで使う）
  constructor(canvas, o = {}) {
    const opt = { alpha: false, antialias: false, depth: !!o.depth, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance', desynchronized: false };
    const gl = canvas.getContext('webgl2', opt);
    if (!gl) throw new Error('nowebgl2');
    this.gl = gl; this.canvas = canvas; this.depth = !!o.depth;
    const q = new URLSearchParams(safeSearch());
    // 浮動小数の描画先（HDR と影の地図に使う）。無い端末では 8bit に落とす
    this.floatRT = !q.has('ldr') && !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    this.lose = gl.getExtension('WEBGL_lose_context');
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.fullVAO = vao;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    this.programs = 0;
  }

  shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    return s;
  }
  // プログラムを作る。fs だけ渡すと全画面用。attribs: 属性名の並び（位置を固定する）
  program(fs, name = '', vs = null, attribs = ['aPos']) {
    const gl = this.gl, p = gl.createProgram();
    const v = this.shader(gl.VERTEX_SHADER, vs || VS_FULL), f = this.shader(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v); gl.attachShader(p, f);
    attribs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    this.programs++;
    const prog = { p, v, f, name, u: null, ready: false, fs, vsSrc: vs || VS_FULL };
    return prog;
  }
  // リンクが済んだか（並列コンパイルの拡張があれば、止まらずに待てる）
  done(prog) {
    const gl = this.gl;
    if (prog.ready) return true;
    if (this.parallel && !gl.getProgramParameter(prog.p, this.parallel.COMPLETION_STATUS_KHR)) return false;
    this.finish(prog);
    return true;
  }
  finish(prog) {
    const gl = this.gl;
    if (prog.ready) return prog;
    if (!gl.getProgramParameter(prog.p, gl.LINK_STATUS)) {
      const log = [gl.getShaderInfoLog(prog.v), gl.getShaderInfoLog(prog.f), gl.getProgramInfoLog(prog.p)].filter(Boolean).join('\n');
      const lines = prog.fs.split('\n'); let ctx = '';
      const m = /ERROR: 0:(\d+)/.exec(log); if (m) { const n = +m[1]; ctx = '\n' + lines.slice(Math.max(0, n - 3), n + 2).map((l, i) => `${n - 2 + i}: ${l}`).join('\n'); }
      throw new Error(`shader ${prog.name}: ${log}${ctx}`);
    }
    prog.u = {};
    const n = gl.getProgramParameter(prog.p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(prog.p, i), nm = info.name.replace(/\[0\]$/, '');
      prog.u[nm] = { loc: gl.getUniformLocation(prog.p, info.name), type: info.type, size: info.size };
    }
    prog.ready = true;
    return prog;
  }
  use(prog, uniforms) {
    const gl = this.gl;
    if (!prog.ready) this.finish(prog);
    gl.useProgram(prog.p);
    let unit = 0;
    for (const k in uniforms) {
      const u = prog.u[k]; if (!u) continue;
      const v = uniforms[k];
      switch (u.type) {
        case gl.FLOAT: gl.uniform1f(u.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, v); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
        case gl.INT: gl.uniform1i(u.loc, v); break;
        case gl.SAMPLER_2D: gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, v.tex || v); gl.uniform1i(u.loc, unit); unit++; break;
        default: break;
      }
    }
  }
  // 全画面を塗る。target: { fbo, w, h } か null（画面）
  draw(prog, uniforms, target = null, rect = null) {
    const gl = this.gl;
    this.bind(target);
    if (rect) { gl.enable(gl.SCISSOR_TEST); gl.scissor(rect[0], rect[1], rect[2], rect[3]); }
    this.use(prog, uniforms);
    gl.bindVertexArray(this.fullVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (rect) gl.disable(gl.SCISSOR_TEST);
  }
  bind(target) {
    const gl = this.gl;
    if (target) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.viewport(0, 0, target.w, target.h); }
    else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); }
  }

  // テクスチャ。o: { fmt: 'rgba8' | 'rgba16f' | 'rg16f' | 'r32f', filter: 'linear' | 'nearest' | 'mip', wrap: 'clamp' | 'repeat' | 'mirror', data }
  texture(w, h, o = {}) {
    const gl = this.gl, tex = gl.createTexture();
    const F = { rgba8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], rgba16f: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT], rg16f: [gl.RG16F, gl.RG, gl.FLOAT], r32f: [gl.R32F, gl.RED, gl.FLOAT] }[o.fmt || 'rgba8'];
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], F[2], o.data || null);
    const t = { tex, w, h, F };
    this.params(t, o);
    return t;
  }
  params(t, o = {}) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    const f = o.filter || 'linear';
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f === 'mip' ? gl.LINEAR_MIPMAP_LINEAR : f === 'nearest' ? gl.NEAREST : f === 'nearestmip' ? gl.NEAREST_MIPMAP_NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f === 'nearest' || f === 'nearestmip' ? gl.NEAREST : gl.LINEAR);
    const w = { clamp: gl.CLAMP_TO_EDGE, repeat: gl.REPEAT, mirror: gl.MIRRORED_REPEAT }[o.wrap || 'clamp'];
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
  }
  // 描画先つきのテクスチャ
  target(w, h, o = {}) {
    const gl = this.gl, t = this.texture(w, h, o);
    t.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) { t.bad = true; }
    return t;
  }
  free(t) { if (!t) return; const gl = this.gl; if (t.fbo) gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); }
  // 2D キャンバスからテクスチャへ（色はあらかじめアルファを掛けておく）
  fromCanvas(cv, o = {}) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const t = { tex, w: cv.width, h: cv.height };
    if (o.filter === 'mip') gl.generateMipmap(gl.TEXTURE_2D);
    this.params(t, o);
    return t;
  }
  updateCanvas(t, cv) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
}

// アーティファクトの枠の中では location.search が空のことがある（読めないこともある）
export function safeSearch() { try { return location.search || ''; } catch (e) { return ''; } }
