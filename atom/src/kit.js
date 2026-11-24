// kit.js — この映像の描画部品
//   Layer2D  … 2D キャンバスに描いた図を HDR バッファへ（線画を光らせたいときは加算で）
//   Spheres  … 球のインポスタ（原子核・DNA）。奥から順に描く
//   Dots     … 光る点・やわらかい粒（中性子、煙、人をあらわす点）
//   camera   … 透視投影
//   narr / sub / label / big / source / chap … 文字（DOM）の置き方
import { W, H, sat, smoothstep, ease, v3, clamp } from './core.js';
import { chars, revealChars } from '../../film/src/overlay.js';

// ------------------------------------------------------------ 2D キャンバスの層
const FS_LAYER = /* glsl */ `
uniform sampler2D uTex; uniform float uGain, uOpacity, uAdd; uniform vec2 uOff;
out vec4 o;
void main(){
  vec4 c = texture(uTex, vUv + uOff);
  vec3 l = toLinear(c.rgb) * uGain;
  o = mix(vec4(l, c.a * uOpacity), vec4(l * c.a * uOpacity, 1.0), uAdd);
}`;
let pLayer = null;
export class Layer2D {
  constructor(env, w = W, h = H) {
    this.env = env; this.w = w; this.h = h;
    this.cv = document.createElement('canvas'); this.cv.width = w; this.cv.height = h;
    this.ctx = this.cv.getContext('2d');
    this.tex = null;
    if (!pLayer) pLayer = env.g.program(FS_LAYER, 'layer2d');
  }
  begin() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.clearRect(0, 0, this.w, this.h);
    return c;
  }
  // mode: 'alpha'（上に重ねる）/ 'add'（光として足す）
  flush(mode = 'alpha', gain = 1, opacity = 1, target = undefined) {
    const g = this.env.g;
    this.tex = g.texFromCanvas(this.cv, { into: this.tex });
    g.draw(pLayer, { uTex: this.tex, uGain: gain, uOpacity: opacity, uAdd: mode === 'add' ? 1 : 0, uOff: [0, 0] }, target, mode === 'add' ? 'add' : 'alpha');
  }
}

// ------------------------------------------------------------ 球
const VS_SPH = /* glsl */ `
layout(location = 0) in vec4 aP;   // x, y, 半径(px), 奥行きによる明るさ 0..1
layout(location = 1) in vec4 aC;   // 色(linear), 自発光
out vec2 vQ; out vec4 vC; out float vS; out float vR;
void main(){
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  float r = aP.z + 1.0;
  vQ = c * r / max(aP.z, 1e-3); vC = aC; vS = aP.w; vR = aP.z;
  vec2 p = aP.xy + c * r;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;
const FS_SPH = /* glsl */ `
in vec2 vQ; in vec4 vC; in float vS; in float vR;
uniform vec3 uL; uniform float uAmb, uRim, uSpec;
out vec4 o;
void main(){
  float d2 = dot(vQ, vQ);
  float a = sat((1.0 - sqrt(d2)) * vR + 0.5);
  vec3 n = vec3(vQ.x, -vQ.y, sqrt(max(1.0 - d2, 0.0)));
  float nl = dot(n, uL);
  float dif = max(nl, 0.0) * 0.85 + 0.15 * (nl * 0.5 + 0.5);
  vec3 h = normalize(uL + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(n, h), 0.0), 48.0) * uSpec;
  float rim = pow(1.0 - n.z, 3.0) * uRim;
  vec3 col = vC.rgb * (uAmb + dif) + vec3(1.0, 0.97, 0.92) * sp + vC.rgb * rim;
  col = col * vS + vC.rgb * vC.a;
  o = vec4(col * a, a);
}`;
export class Spheres {
  constructor(env, max = 4096) {
    const g = env.g; this.g = g; this.max = max; this.n = 0;
    this.P = new Float32Array(max * 4); this.C = new Float32Array(max * 4);
    this.items = [];
    this.prog = g.programVF(VS_SPH, FS_SPH, 'spheres');
    this.mesh = g.mesh({ p: { loc: 0, size: 4, data: this.P, dynamic: true, divisor: 1 }, c: { loc: 1, size: 4, data: this.C, dynamic: true, divisor: 1 } }, { mode: 'TRIANGLE_STRIP', count: 4 });
  }
  begin() { this.items.length = 0; return this; }
  // z: カメラからの距離（大きいほど奥）。shade: 奥行きの暗さ、em: 自発光
  add(x, y, r, z, col, shade = 1, em = 0) { if (r > 0.2) this.items.push([x, y, r, z, col[0], col[1], col[2], shade, em]); return this; }
  flush({ light = [-0.45, 0.6, 0.66], amb = 0.16, rim = 0.25, spec = 0.4 } = {}) {
    const it = this.items; if (!it.length) return;
    it.sort((a, b) => b[3] - a[3]);
    const n = Math.min(it.length, this.max), P = this.P, C = this.C;
    for (let i = 0; i < n; i++) {
      const s = it[i];
      P[i * 4] = s[0]; P[i * 4 + 1] = s[1]; P[i * 4 + 2] = s[2]; P[i * 4 + 3] = s[7];
      C[i * 4] = s[4]; C[i * 4 + 1] = s[5]; C[i * 4 + 2] = s[6]; C[i * 4 + 3] = s[8];
    }
    this.mesh.update('p', P.subarray(0, n * 4)); this.mesh.update('c', C.subarray(0, n * 4));
    this.g.drawMesh(this.prog, this.mesh, { uL: v3.norm(light), uAmb: amb, uRim: rim, uSpec: spec }, 'premul', { instances: n });
  }
}

// ------------------------------------------------------------ 点
const VS_DOT = /* glsl */ `
layout(location = 0) in vec4 aP;   // x, y, 半径(px), 強さ
layout(location = 1) in vec3 aC;
uniform float uSoft, uGauss;
out vec2 vQ; out vec3 vC; out float vR;
void main(){
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  float r = mix(aP.z + 1.0 + uSoft, aP.z * 2.4 + 1.0, uGauss);
  vQ = c * r; vR = aP.z; vC = aC * aP.w;
  vec2 p = aP.xy + c * r;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;
const FS_DOT = /* glsl */ `
in vec2 vQ; in vec3 vC; in float vR;
uniform float uSoft, uGauss, uAlpha;
out vec4 o;
void main(){
  float d = length(vQ);
  float a = mix(sat((vR - d) / max(uSoft, 1e-3) + 0.5), exp(-d * d / max(vR * vR, 1e-4) * 1.6), uGauss);
  o = vec4(vC * a, a * uAlpha);
}`;
export class Dots {
  constructor(env, max = 8192) {
    const g = env.g; this.g = g; this.max = max; this.n = 0;
    this.P = new Float32Array(max * 4); this.C = new Float32Array(max * 3);
    this.prog = g.programVF(VS_DOT, FS_DOT, 'dots2');
    this.mesh = g.mesh({ p: { loc: 0, size: 4, data: this.P, dynamic: true, divisor: 1 }, c: { loc: 1, size: 3, data: this.C, dynamic: true, divisor: 1 } }, { mode: 'TRIANGLE_STRIP', count: 4 });
  }
  begin() { this.n = 0; return this; }
  add(x, y, r, i, col) {
    const k = this.n; if (k >= this.max || i <= 0 || r <= 0) return this;
    const P = this.P, C = this.C;
    P[k * 4] = x; P[k * 4 + 1] = y; P[k * 4 + 2] = r; P[k * 4 + 3] = i;
    C[k * 3] = col[0]; C[k * 3 + 1] = col[1]; C[k * 3 + 2] = col[2];
    this.n++; return this;
  }
  // mode 'add': 光。'premul': 不透明な粒（col はそのまま、縁だけ透ける）
  flush(mode = 'add', { soft = 1, gauss = 0 } = {}) {
    const n = this.n; if (!n) return;
    this.mesh.update('p', this.P.subarray(0, n * 4)); this.mesh.update('c', this.C.subarray(0, n * 3));
    this.g.drawMesh(this.prog, this.mesh, { uSoft: soft, uGauss: gauss, uAlpha: mode === 'add' ? 1 : 1 }, mode, { instances: n });
  }
}

// ------------------------------------------------------------ カメラ（透視投影）
// 返り値 proj(p) → [x, y, 1 単位あたりの画素数, 奥行き]。cx, cy は画面上の消失点
export function camera({ pos, target, fov = 0.6, roll = 0, cx = W / 2, cy = H / 2 }) {
  const f = v3.norm(v3.sub(target, pos));
  const up0 = [Math.sin(roll), Math.cos(roll), 0];
  const r = v3.norm(v3.cross(up0, f)), u = v3.cross(f, r);
  const k = (H / 2) / Math.tan(fov / 2);
  const proj = (p) => {
    const dx = p[0] - pos[0], dy = p[1] - pos[1], dz = p[2] - pos[2];
    const z = dx * f[0] + dy * f[1] + dz * f[2];
    const x = dx * r[0] + dy * r[1] + dz * r[2], y = dx * u[0] + dy * u[1] + dz * u[2];
    const s = k / Math.max(z, 1e-3);
    return [cx + x * s, cy - y * s, s, z];
  };
  proj.r = r; proj.u = u; proj.f = f; proj.pos = pos;
  return proj;
}

// ------------------------------------------------------------ 2D キャンバスの小道具
export function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
}
export const rgba = (r, g, b, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(4)})`;
// 折れ線 pts=[[x,y],...] の上の位置（u は 0..1、長さに沿って）
export function along(pts, u) {
  let L = 0; const seg = [];
  for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(d); L += d; }
  let s = clamp(u, 0, 1) * L;
  for (let i = 0; i < seg.length; i++) {
    if (s <= seg[i] || i === seg.length - 1) { const k = seg[i] ? s / seg[i] : 0; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k]; }
    s -= seg[i];
  }
  return pts[pts.length - 1];
}
export function pathLen(pts) { let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; }

// ------------------------------------------------------------ 文字
const inout = (tl, dur, fin = 0.5, fout = 0.5) => Math.min(smoothstep(0, fin, tl), 1 - smoothstep(dur - fout, dur, tl));

// 章の見出し（左上に残る）
export function chap(ov, { n, kanji, en, t0, t1, warn = false }) {
  return ov.add({
    t0, t1, className: 'chap' + (warn ? ' warn' : ''),
    html: `<span class="num">${n}</span><span class="rule"></span><span class="kanji">${kanji}</span><span class="en">${chars(en)}</span>`,
    update(el, tl) {
      const dur = t1 - t0, out = 1 - smoothstep(dur - 0.5, dur - 0.05, tl);
      const [num, rule, kj, enEl] = el.children;
      const a = ease.outCubic(sat(tl / 0.6));
      num.style.opacity = (a * out).toFixed(4); num.style.transform = `translateY(${((1 - a) * 20).toFixed(2)}px)`;
      rule.style.transform = `scaleX(${ease.outQuart(sat((tl - 0.12) / 0.7)).toFixed(4)})`; rule.style.opacity = out.toFixed(4);
      const c = ease.outCubic(sat((tl - 0.22) / 0.7));
      kj.style.opacity = (c * out).toFixed(4); kj.style.transform = `translateX(${((1 - c) * -14).toFixed(2)}px)`;
      kj.style.filter = c < 0.999 ? `blur(${((1 - c) * 8).toFixed(2)}px)` : 'none';
      revealChars(enEl, tl - 0.4, { stagger: 0.03, dur: 0.5, dy: 0, dx: -6, blur: 4 });
      enEl.style.opacity = out.toFixed(4);
    },
  });
}

// 文字ごとに <span class="ch"> に分ける（<b>, <em>, <i>, <br>, <span class=..> の入れ子はそのまま通す）
export function rich(html) {
  let out = '', i = 0;
  while (i < html.length) {
    if (html[i] === '<') { const j = html.indexOf('>', i); out += html.slice(i, j + 1); i = j + 1; continue; }
    if (html[i] === '\n') { out += '<br>'; i++; continue; }
    if (html[i] === '&') { const j = html.indexOf(';', i); out += `<span class="ch">${html.slice(i, j + 1)}</span>`; i = j + 1; continue; }
    const cp = html.codePointAt(i), ch = String.fromCodePoint(cp);
    out += ch === ' ' ? '<span class="ch">&nbsp;</span>' : `<span class="ch">${ch}</span>`;
    i += ch.length;
  }
  return out;
}

// 語りの一行（中央下）。text に改行があれば 2 行
export function narr(ov, { text, t0, t1, y = null, cls = '' }) {
  const two = text.includes('\n');
  const n = [...text.replace(/<[^>]+>/g, '')].length, stagger = Math.min(0.04, 1.1 / Math.max(n, 1));
  return ov.add({
    t0, t1, className: 'narr' + (two ? ' two' : '') + (cls ? ' ' + cls : ''), html: rich(text), style: y != null ? { top: y + 'px' } : {},
    update(el, tl) { revealChars(el, tl, { stagger, dur: 0.6, dy: 10, blur: 8, outAt: t1 - t0 - 0.55, outDur: 0.45, outStagger: 0.004 }); },
  });
}
// 補足の小さな行
export function sub(ov, { text, t0, t1, y = 968, style = {} }) {
  return ov.add({
    t0, t1, className: 'sub', html: text, style: { top: y + 'px', ...style },
    update(el, tl) { const a = inout(tl, t1 - t0, 0.6, 0.45); el.style.opacity = a.toFixed(4); el.style.transform = `translateY(${((1 - sat(tl / 0.6)) * 6).toFixed(2)}px)`; },
  });
}
// 図のラベル（x, y は左上。align: 'l' | 'r' | 'c'）
export function label(ov, { html, t0, t1, x, y, align = 'l', size = null, cls = '', dx = 10 }) {
  const style = { top: y + 'px' };
  if (align === 'r') style.right = (W - x) + 'px'; else style.left = x + 'px';
  if (size) style.fontSize = size + 'px';
  return ov.add({
    t0, t1, className: 'lbl' + (align === 'r' ? ' r' : align === 'c' ? ' c' : '') + (cls ? ' ' + cls : ''), html, style,
    update(el, tl) {
      const a = ease.outCubic(sat(tl / 0.5)), o = Math.min(a, 1 - smoothstep(t1 - t0 - 0.4, t1 - t0, tl));
      el.style.opacity = o.toFixed(4);
      const tx = (1 - a) * (align === 'r' ? dx : -dx);
      el.style.transform = (align === 'c' ? 'translateX(-50%) ' : '') + `translateX(${tx.toFixed(2)}px)`;
      el.style.filter = a < 0.999 ? `blur(${((1 - a) * 5).toFixed(2)}px)` : 'none';
    },
  });
}
// 大きな数字。value は数値（カウントアップする）か文字列。fmt: 数値 → 表示
export function big(ov, { cap = '', value, unit = '', note = '', t0, t1, x, y, align = 'l', cls = '', count = 1.4, fmt = (v) => Math.round(v).toLocaleString('en-US'), size = null }) {
  const style = { top: y + 'px' };
  if (align === 'r') style.right = (W - x) + 'px'; else style.left = x + 'px';
  return ov.add({
    t0, t1, className: 'big' + (align === 'r' ? ' r' : '') + (cls ? ' ' + cls : ''), style,
    html: `${cap ? `<div class="cap">${cap}</div>` : ''}<div class="num"${size ? ` style="font-size:${size}px;line-height:${Math.round(size * 1.05)}px"` : ''}><span class="v"></span>${unit ? `<span class="u">${unit}</span>` : ''}</div>${note ? `<div class="note">${note}</div>` : ''}`,
    setup(el, it) { it.v = el.querySelector('.v'); },
    update(el, tl, t, it) {
      const a = ease.outCubic(sat(tl / 0.6)), o = Math.min(a, 1 - smoothstep(t1 - t0 - 0.45, t1 - t0, tl));
      el.style.opacity = o.toFixed(4); el.style.transform = `translateY(${((1 - a) * 12).toFixed(2)}px)`;
      const txt = typeof value === 'number' ? fmt(value * ease.outQuart(sat(tl / count))) : value;
      if (it.last !== txt) { it.v.textContent = txt; it.last = txt; }
    },
  });
}
// 出典（左下に小さく）
export function source(ov, { text, t0, t1 }) {
  return ov.add({ t0, t1, className: 'src', html: '出典 ' + text, update(el, tl) { el.style.opacity = inout(tl, t1 - t0, 0.8, 0.4).toFixed(4); } });
}
// ふつうのフェードで出す要素
export function fadeEl(ov, { html, className, style = {}, t0, t1, fin = 0.6, fout = 0.5, dy = 8, update = null, setup = null }) {
  return ov.add({
    t0, t1, className, html, style, setup,
    update(el, tl, t, it) {
      el.style.opacity = inout(tl, t1 - t0, fin, fout).toFixed(4);
      if (dy) el.style.transform = `translateY(${((1 - ease.outCubic(sat(tl / fin))) * dy).toFixed(2)}px)`;
      if (update) update(el, tl, t, it);
    },
  });
}
export { inout };
