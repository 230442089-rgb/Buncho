// lines.js — 太さ・明るさ・色が点ごとに変わる折れ線を、アンチエイリアスつきで描く（1 線分 = 1 インスタンス）
const VS = /* glsl */ `
layout(location = 0) in vec4 aA;   // 始点 x, y, 太さ, 明るさ
layout(location = 1) in vec4 aB;   // 終点
layout(location = 2) in vec3 aCA;
layout(location = 3) in vec3 aCB;
uniform float uCap, uSoft;
out vec2 vL; out float vLen; out vec2 vW; out vec2 vI; out vec3 vCA; out vec3 vCB;
void main(){
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 d = aB.xy - aA.xy; float len = length(d);
  vec2 t = len > 1e-5 ? d / len : vec2(1.0, 0.0); vec2 n = vec2(-t.y, t.x);
  float r = max(aA.z, aB.z) * 0.5 + 0.5 + uSoft;
  float ext = uCap * r;
  float along = mix(-ext, len + ext, c.x), across = mix(-r, r, c.y);
  vec2 p = aA.xy + t * along + n * across;
  vL = vec2(along, across); vLen = len; vW = vec2(aA.z, aB.z); vI = vec2(aA.w, aB.w); vCA = aCA; vCB = aCB;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;
const FS = /* glsl */ `
in vec2 vL; in float vLen; in vec2 vW; in vec2 vI; in vec3 vCA; in vec3 vCB;
uniform float uCap, uGain, uSoft;
out vec4 o;
void main(){
  float h = clamp(vL.x / max(vLen, 1e-5), 0.0, 1.0);
  float w = mix(vW.x, vW.y, h);
  float d = uCap > 0.5 ? length(vec2(vL.x - h * vLen, vL.y)) : abs(vL.y);
  float cov = sat(0.5 + (w * 0.5 - d) / uSoft);
  if (uCap < 0.5) cov *= step(0.0, vL.x) * step(vL.x, vLen);
  vec3 col = mix(vCA, vCB, h) * mix(vI.x, vI.y, h);
  o = vec4(col * cov * uGain, cov);
}`;

export class Lines {
  constructor(g, max = 16384) {
    this.g = g; this.max = max; this.n = 0;
    this.A = new Float32Array(max * 4); this.B = new Float32Array(max * 4);
    this.CA = new Float32Array(max * 3); this.CB = new Float32Array(max * 3);
    this.prog = g.programVF(VS, FS, 'lines');
    this.mesh = g.mesh({
      a: { loc: 0, size: 4, data: this.A, dynamic: true, divisor: 1 }, b: { loc: 1, size: 4, data: this.B, dynamic: true, divisor: 1 },
      ca: { loc: 2, size: 3, data: this.CA, dynamic: true, divisor: 1 }, cb: { loc: 3, size: 3, data: this.CB, dynamic: true, divisor: 1 },
    }, { mode: 'TRIANGLE_STRIP', count: 4 });
  }
  begin() { this.n = 0; return this; }
  seg(x0, y0, x1, y1, w = 2, i = 1, col = [1, 1, 1], w1 = w, i1 = i, col1 = col) {
    const k = this.n; if (k >= this.max) return this;
    this.A.set([x0, y0, w, i], k * 4); this.B.set([x1, y1, w1, i1], k * 4);
    this.CA.set(col, k * 3); this.CB.set(col1, k * 3);
    this.n++; return this;
  }
  // pts: [x0,y0,x1,y1,...] の配列（Float32Array でも可）, n: 点の数。w/i/col は数値か (j, u)=>値 の関数（u は 0..1）
  poly(pts, n, { w = 2, i = 1, col = [1, 1, 1], closed = false } = {}) {
    const wf = typeof w === 'function' ? w : () => w, inf = typeof i === 'function' ? i : () => i, cf = typeof col === 'function' ? col : () => col;
    const m = closed ? n : n - 1;
    let pw = wf(0, 0), pi = inf(0, 0), pc = cf(0, 0);
    for (let j = 0; j < m; j++) {
      const j1 = (j + 1) % n, u1 = (j + 1) / Math.max(1, n - 1);
      const nw = wf(j1, u1), ni = inf(j1, u1), nc = cf(j1, u1);
      const k = this.n; if (k >= this.max) break;
      const A = this.A, B = this.B;
      A[k * 4] = pts[j * 2]; A[k * 4 + 1] = pts[j * 2 + 1]; A[k * 4 + 2] = pw; A[k * 4 + 3] = pi;
      B[k * 4] = pts[j1 * 2]; B[k * 4 + 1] = pts[j1 * 2 + 1]; B[k * 4 + 2] = nw; B[k * 4 + 3] = ni;
      this.CA[k * 3] = pc[0]; this.CA[k * 3 + 1] = pc[1]; this.CA[k * 3 + 2] = pc[2];
      this.CB[k * 3] = nc[0]; this.CB[k * 3 + 1] = nc[1]; this.CB[k * 3 + 2] = nc[2];
      this.n++; pw = nw; pi = ni; pc = nc;
    }
    return this;
  }
  circle(cx, cy, r, opts = {}, segs = 0) {
    const n = segs || Math.max(24, Math.min(200, Math.round(r * 0.9)));
    const pts = new Float32Array(n * 2);
    for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2; pts[j * 2] = cx + Math.cos(a) * r; pts[j * 2 + 1] = cy + Math.sin(a) * r; }
    return this.poly(pts, n, { ...opts, closed: true });
  }
  _upload() {
    const n = this.n, m = this.mesh;
    m.update('a', this.A.subarray(0, n * 4)); m.update('b', this.B.subarray(0, n * 4));
    m.update('ca', this.CA.subarray(0, n * 3)); m.update('cb', this.CB.subarray(0, n * 3));
  }
  // 加算で直接描く（密に重なるほど明るくなる。アトラクタ向け）
  flushAdd({ gain = 1, soft = 1, cap = 0 } = {}) {
    if (!this.n) return;
    this._upload();
    this.g.drawMesh(this.prog, this.mesh, { uCap: cap, uGain: gain, uSoft: soft }, 'add', { instances: this.n });
  }
  // MAX 合成で予備バッファに描いてから加算で重ねる（継ぎ目・交差が明るくならない、きれいな線画向け）
  flushMax(env, { gain = 1, soft = 1 } = {}) {
    if (!this.n) return;
    const g = this.g, post = env.post;
    this._upload();
    g.bind(post.aux); g.clear(0, 0, 0, 0);
    g.drawMesh(this.prog, this.mesh, { uCap: 1, uGain: 1, uSoft: soft }, 'max', { instances: this.n });
    post.copy(post.aux, post.hdr, gain, 'add');
  }
}
