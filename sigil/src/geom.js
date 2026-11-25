// geom.js — 輪郭を「折れ線」として持つ小さな作図エンジン。
//   Pen で線・曲線・円弧を並べる → Path（折れ線と道のり）にする。途中まで描く・等間隔に取り直す・SVG に書き出す、ができる。
//   座標は y が下向き。角度は度で、0° が右、90° が下（時計回りが正）。
const RAD = Math.PI / 180;
const STEP = 0.012;                 // 折れ線にするときの刻み（記号の半径 1 に対して）

export class Path {
  constructor(pts, closed = false) {
    this.p = pts; this.closed = closed;
    const n = pts.length, acc = new Float64Array(n + (closed ? 1 : 0)); let s = 0;
    for (let i = 1; i < acc.length; i++) { const a = pts[i - 1], b = pts[i % n]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); acc[i] = s; }
    this.acc = acc; this.length = s;
  }
  // 道のりの割合 u（0..1）の位置と向き
  at(u) {
    const L = this.length, n = this.p.length, acc = this.acc; let d = (this.closed ? ((u % 1) + 1) % 1 : Math.min(1, Math.max(0, u))) * L;
    let lo = 0, hi = acc.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (acc[m] <= d) lo = m; else hi = m; }
    const a = this.p[lo % n], b = this.p[hi % n], seg = acc[hi] - acc[lo] || 1, k = (d - acc[lo]) / seg;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[1] - a[1], b[0] - a[0])];
  }
  // a..b（割合）の部分の点列。閉じた輪郭は b > 1 で一周をまたげる
  slice(a, b) {
    if (b <= a) return [];
    const out = [], n = this.p.length, acc = this.acc, L = this.length, m = acc.length;
    const d0 = a * L, d1 = b * L; out.push(this.at(a));
    const first = Math.floor(a), last = Math.ceil(b);
    for (let turn = first; turn < last; turn++) for (let i = 0; i < m; i++) { const d = acc[i] + turn * L; if (d > d0 + 1e-9 && d < d1 - 1e-9) out.push(this.p[i % n]); }
    out.push(this.at(this.closed ? b : Math.min(1, b)));
    return out;
  }
  resample(n) { const out = []; for (let i = 0; i < n; i++) out.push(this.at(this.closed ? i / n : i / (n - 1))); return out; }
  map(fn) { return new Path(this.p.map((q, i) => fn(q[0], q[1], i)), this.closed); }
}

// ペン。M・L・Q・C・円弧（arc / ellipse）を並べ、Path の配列と SVG の d を作る
export class Pen {
  constructor() { this.subs = []; this.cur = null; this.d = ''; }
  _f(v) { return (Math.round(v * 1000) / 1000).toString(); }
  M(x, y) { this.cur = { pts: [[x, y]], closed: false }; this.subs.push(this.cur); this.d += `M${this._f(x)} ${this._f(y)}`; return this; }
  L(x, y) { const a = this.cur.pts[this.cur.pts.length - 1], n = Math.max(1, Math.ceil(Math.hypot(x - a[0], y - a[1]) / (STEP * 2))); for (let i = 1; i <= n; i++) this.cur.pts.push([a[0] + (x - a[0]) * i / n, a[1] + (y - a[1]) * i / n]); this.d += `L${this._f(x)} ${this._f(y)}`; return this; }
  C(x1, y1, x2, y2, x, y) {
    const a = this.cur.pts[this.cur.pts.length - 1], est = Math.hypot(x1 - a[0], y1 - a[1]) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x - x2, y - y2), n = Math.max(4, Math.ceil(est / STEP));
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.cur.pts.push([u * u * u * a[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * a[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y]); }
    this.d += `C${this._f(x1)} ${this._f(y1)} ${this._f(x2)} ${this._f(y2)} ${this._f(x)} ${this._f(y)}`; return this;
  }
  Q(x1, y1, x, y) { const a = this.cur.pts[this.cur.pts.length - 1]; return this.C(a[0] + (x1 - a[0]) * 2 / 3, a[1] + (y1 - a[1]) * 2 / 3, x + (x1 - x) * 2 / 3, y + (y1 - y) * 2 / 3, x, y); }
  // 楕円弧（中心 cx,cy、半径 rx,ry、傾き rot、角度 a0→a1）。move: 先頭へ線を引かずに移る
  ellipse(cx, cy, rx, ry, rot, a0, a1, move = true) {
    const cr = Math.cos(rot * RAD), sr = Math.sin(rot * RAD), P = (a) => { const x = Math.cos(a * RAD) * rx, y = Math.sin(a * RAD) * ry; return [cx + x * cr - y * sr, cy + x * sr + y * cr]; };
    const D = (a) => { const x = -Math.sin(a * RAD) * rx, y = Math.cos(a * RAD) * ry; return [x * cr - y * sr, x * sr + y * cr]; };
    const p0 = P(a0); if (move || !this.cur) this.M(p0[0], p0[1]); else this.L(p0[0], p0[1]);
    const segs = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 60)), da = (a1 - a0) / segs, k = 4 / 3 * Math.tan(da * RAD / 4);
    for (let i = 0; i < segs; i++) { const u0 = a0 + da * i, u1 = u0 + da, q0 = P(u0), q1 = P(u1), d0 = D(u0), d1 = D(u1); this.C(q0[0] + d0[0] * k, q0[1] + d0[1] * k, q1[0] - d1[0] * k, q1[1] - d1[1] * k, q1[0], q1[1]); }
    return this;
  }
  arc(cx, cy, r, a0, a1, move = true) { return this.ellipse(cx, cy, r, r, 0, a0, a1, move); }
  circle(cx, cy, r) { this.ellipse(cx, cy, r, r, 0, -90, 270); return this.Z(); }
  poly(pts, close = true) { this.M(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) this.L(pts[i][0], pts[i][1]); return close ? this.Z() : this; }
  // 自由な曲線（媒介変数）。fn(u) → [x, y]、u は 0..1
  curve(fn, n = 160, move = true) { const p0 = fn(0); if (move || !this.cur) this.M(p0[0], p0[1]); else this.L(p0[0], p0[1]); for (let i = 1; i <= n; i++) { const q = fn(i / n); this.cur.pts.push(q); if (i % 2 === 0 || i === n) this.d += `L${this._f(q[0])} ${this._f(q[1])}`; } return this; }
  Z() { const s = this.cur; const a = s.pts[0], b = s.pts[s.pts.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) s.pts.pop(); else { const n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / (STEP * 2))); for (let i = 1; i < n; i++) s.pts.push([b[0] + (a[0] - b[0]) * i / n, b[1] + (a[1] - b[1]) * i / n]); } s.closed = true; this.d += 'Z'; return this; }
  paths() { return this.subs.map((s) => new Path(s.pts, s.closed)); }
}
export const pen = () => new Pen();
export const rot = (x, y, deg) => { const c = Math.cos(deg * RAD), s = Math.sin(deg * RAD); return [x * c - y * s, x * s + y * c]; };

// 点列を、いまの変換のまま線にする
export function trace(c, pts, close = false) { if (!pts.length) return; c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (close) c.closePath(); }
