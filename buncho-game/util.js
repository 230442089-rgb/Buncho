// util.js — math, easing, keyframes, small SVG helpers
const U = {};
U.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
U.lerp = (a, b, t) => a + (b - a) * t;
U.inv = (a, b, x) => U.clamp((x - a) / (b - a));
U.ease = {
  lin: t => t,
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
// eased progress of t inside [a,b]
U.seg = (t, a, b, e = 'inOut') => U.ease[e](U.inv(a, b, t));
// numeric keyframes [[t,v],...]
U.kf = (t, keys, e = 'inOut') => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) return v0 + (v1 - v0) * U.ease[e]((t - t0) / Math.max(1e-6, t1 - t0));
  }
  return keys[keys.length - 1][1];
};
// discrete keyframes [[t,val],...]
U.step = (t, keys) => { let v = keys[0][1]; for (const [k, val] of keys) if (t >= k) v = val; return v; };
U.hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
U.f = n => Math.round(n * 10) / 10;
// fade in/out window: 0 before a, ramps to 1 over fi, holds, ramps down over fo before b
U.win = (t, a, b, fi = 0.25, fo = 0.25) => Math.min(U.inv(a, a + fi, t), 1 - U.inv(b - fo, b, t));
// blink closure 0..1 (deterministic, per-seed)
U.blink = (t, seed = 0) => {
  const period = 3.4 + U.hash(seed) * 1.6;
  const off = U.hash(seed + 7) * period;
  const c = ((t + off) % period + period) % period;
  const d = 0.17;
  if (c > d) return 0;
  const p = c / d;
  return p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
};
// SVG helpers
U.tr = (x, y, s = 1, r = 0) => `transform="translate(${U.f(x)} ${U.f(y)})${r ? ` rotate(${U.f(r)})` : ''}${s !== 1 ? ` scale(${Math.round(s * 1000) / 1000})` : ''}"`;
U.esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// heart path centred on 0,0 with size = width
U.heartD = 'M0,-0.22 C0,-0.52 -0.5,-0.55 -0.5,-0.18 C-0.5,0.12 -0.18,0.3 0,0.5 C0.18,0.3 0.5,0.12 0.5,-0.18 C0.5,-0.55 0,-0.52 0,-0.22 Z';
U.heart = (x, y, size, fill = '#FF7FA6', op = 1, rot = 0, stroke = '') =>
  `<g ${U.tr(x, y, size, rot)} opacity="${U.f(op * 100) / 100}"><path d="${U.heartD}" fill="${fill}" ${stroke ? `stroke="${stroke}" stroke-width="${U.f(0.06)}"` : ''}/><ellipse cx="-0.24" cy="-0.22" rx="0.1" ry="0.07" fill="#fff" opacity=".75" transform="rotate(-30 -0.24 -0.22)"/></g>`;
// 4-point sparkle
U.sparkle = (x, y, size, fill = '#fff', op = 1, rot = 0) =>
  `<path ${U.tr(x, y, size, rot)} d="M0,-1 C0.12,-0.12 0.12,-0.12 1,0 C0.12,0.12 0.12,0.12 0,1 C-0.12,0.12 -0.12,0.12 -1,0 C-0.12,-0.12 -0.12,-0.12 0,-1 Z" fill="${fill}" opacity="${U.f(op * 100) / 100}"/>`;

// mix two #rrggbb colours
U.mix = (a, b, t) => {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * U.clamp(t)).toString(16).padStart(2, '0')).join('');
};
