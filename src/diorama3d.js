/* 天下布鳥 — 町の箱庭(three.js r128)。研究が進むごとに、同じ町が時代を重ねていく。
 *   var h = TF.Diorama3D.mount(host, { stage: 0..8, orbit: true, angle: 0.5, focus: 'all' });
 *   h.setStage(n, { animate: true })  新しいものが 1.2 秒ほどで地面から生えてくる
 *   h.focus('hq' | 'castle' | 'town' | 'furnace' | 'rail' | 'works' | 'pad' | 'all', { angle, animate })  寄りの画
 *   h.shift(x, y)  町を画面の右・上へ寄せる(割合) / h.setOrbit(bool) / h.pause() / h.resume()
 *   h.onLaunch = fn  ロケットが上がるときに呼ばれる(音を付けたいとき) / TF.Diorama3D.sky(n)  その時代の空の CSS
 *   h.stage / h.resize() / h.dispose() / h._advance(sec) / h._info()
 * 描画器(WebGL の文脈)はこのモジュールで一つだけ作って使い回す。あとから mount した箱庭が前面になり、
 * dispose すると一つ前の箱庭に画面を返す。host が画面から外されたら自分で片づける。 */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};
  var T = null, glOK = null, renderer = null, MAT = null, stack = [];
  var PI = Math.PI, TAU = PI * 2, SQ2 = Math.SQRT2;

  function available() {
    if (glOK !== null) return glOK;
    T = root.THREE;
    if (!T || typeof document === 'undefined') return (glOK = false);
    try { var c = document.createElement('canvas'); glOK = !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { glOK = false; }
    return glOK;
  }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
  function back(k) { var c = 1.70158, u = k - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shade(hex, k) { var c = new T.Color(hex); c.multiplyScalar(k); return c.getHex(); }
  function turn(a, b, k) { var d = b - a; while (d > PI) d -= TAU; while (d < -PI) d += TAU; return a + d * k; }

  // ── 形をまとめる ──
  // 部品 {g, p:[x,y,z], c:色, r:[rx,ry,rz], s:[sx,sy,sz]} を、頂点色つきの一つの形にする。c が無ければ g の頂点色をそのまま使う
  function merge(parts) {
    var pos = [], nor = [], col = [], m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3(), c = new T.Color(), i, n;
    for (n = 0; n < parts.length; n++) {
      var p = parts[n]; if (!p) continue;
      var g = p.g.index ? p.g.toNonIndexed() : p.g.clone(), r = p.r, sc = p.s;
      e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); q.setFromEuler(e); v.set(p.p[0], p.p[1], p.p[2]); s.set(sc ? sc[0] : 1, sc ? sc[1] : 1, sc ? sc[2] : 1); m.compose(v, q, s); g.applyMatrix4(m);
      var pa = g.attributes.position.array, na = g.attributes.normal.array, ca = g.attributes.color ? g.attributes.color.array : null, own = p.c != null || !ca;
      if (p.c != null) c.set(p.c); else c.set(0xffffff);
      for (i = 0; i < pa.length; i += 3) { pos.push(pa[i], pa[i + 1], pa[i + 2]); nor.push(na[i], na[i + 1], na[i + 2]); if (own) col.push(c.r, c.g, c.b); else col.push(ca[i], ca[i + 1], ca[i + 2]); }
      g.dispose();
    }
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return out;
  }
  function P(g, x, y, z, c, r, s) { return { g: g, p: [x, y, z], c: c, r: r, s: s }; }
  function bx(w, h, d, x, y, z, c, r) { return P(new T.BoxGeometry(w, h, d), x, y, z, c, r); }
  function gb(w, h, d, x, z, c, y0, ry) { return P(new T.BoxGeometry(w, h, d), x, (y0 || 0) + h / 2, z, c, ry ? [0, ry, 0] : null); } // 地面(y0)に置いた箱
  function cy(rt, rb, h, n, x, y, z, c, r, s) { return P(new T.CylinderGeometry(rt, rb, h, n), x, y, z, c, r, s); }
  function co(rad, h, n, x, y, z, c, r, s) { return P(new T.ConeGeometry(rad, h, n), x, y, z, c, r, s); }
  function sp(rad, x, y, z, c, s, ws, hs) { return P(new T.SphereGeometry(rad, ws || 8, hs || 6), x, y, z, c, null, s); }
  function flat(g) { var n = g.toNonIndexed(); n.computeVertexNormals(); g.dispose(); return n; }
  // 四角い台(上辺 top、下辺 bot)と四角錐。辺は軸にそろえる
  function fr(top, bot, h, x, y0, z, c, sx, sz) { var g = new T.CylinderGeometry(top / SQ2, bot / SQ2, h, 4); g.rotateY(PI / 4); return P(flat(g), x, y0 + h / 2, z, c, null, [sx || 1, 1, sz || 1]); }
  function py(side, h, x, y0, z, c, sx, sz) { var g = new T.ConeGeometry(side / SQ2, h, 4); g.rotateY(PI / 4); return P(flat(g), x, y0 + h / 2, z, c, null, [sx || 1, 1, sz || 1]); }
  // 三角柱(切妻屋根)。底辺 w、高さ h、棟の長さ len(z方向)。ax は棟の位置のずれ(のこぎり屋根)
  function prismGeo(w, h, len, ax) {
    var a = -w / 2, b = w / 2, z0 = -len / 2, z1 = len / 2, p = [];
    p.push(a, 0, z1, b, 0, z1, ax, h, z1, b, 0, z0, a, 0, z0, ax, h, z0);
    p.push(b, 0, z1, b, 0, z0, ax, h, z0, b, 0, z1, ax, h, z0, ax, h, z1);
    p.push(a, 0, z0, a, 0, z1, ax, h, z1, a, 0, z0, ax, h, z1, ax, h, z0);
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
  }
  function pr(w, h, len, x, y0, z, c, ry, ax) { return P(prismGeo(w, h, len, ax || 0), x, y0, z, c, ry ? [0, ry, 0] : null); }
  function put(g, x, y, z, ry, k) { return P(g, x, y, z, null, ry ? [0, ry, 0] : null, k ? [k, k, k] : null); }

  // ── 乗りものと人形 ──
  function tankGeo() {
    return merge([bx(0.5, 0.55, 3.4, -0.95, 0.28, 0, 0x26271f), bx(0.5, 0.55, 3.4, 0.95, 0.28, 0, 0x26271f), bx(1.9, 0.55, 3.2, 0, 0.72, 0, 0x4d5b35),
      bx(1.4, 0.5, 1.7, 0, 1.24, 0.15, 0x5a6a3f), cy(0.08, 0.08, 2.5, 6, 0, 1.28, -1.95, 0x2c3125, [PI / 2, 0, 0]), bx(0.28, 0.18, 0.28, 0.38, 1.58, 0.3, 0x2c3125)]);
  }
  function truckGeo() {
    return merge([bx(1.5, 1.15, 1.2, 0, 0.95, 1.55, 0x55673c), bx(1.3, 0.45, 0.06, 0, 1.15, 2.16, 0x1b2a30), bx(1.6, 0.25, 4.3, 0, 0.42, 0, 0x3f4d2c), bx(1.6, 1.3, 2.8, 0, 1.2, -0.7, 0x6f7d4c),
      bx(0.3, 0.6, 0.6, -0.72, 0.3, 1.4, 0x1c1d19), bx(0.3, 0.6, 0.6, 0.72, 0.3, 1.4, 0x1c1d19), bx(0.3, 0.6, 0.6, -0.72, 0.3, -1.2, 0x1c1d19), bx(0.3, 0.6, 0.6, 0.72, 0.3, -1.2, 0x1c1d19)]);
  }
  function locoGeo() { // 蒸気機関車(前は +z)
    return merge([bx(0.95, 0.22, 2.7, 0, 0.36, 0, 0x8a2f25), cy(0.42, 0.42, 1.7, 10, 0, 0.92, 0.35, 0x24262b, [PI / 2, 0, 0]), bx(0.95, 1.0, 0.85, 0, 0.98, -0.9, 0x2e3138),
      bx(1.05, 0.08, 0.95, 0, 1.52, -0.9, 0x1b1c20), cy(0.14, 0.11, 0.5, 8, 0, 1.55, 0.95, 0x1b1c20), cy(0.12, 0.12, 0.2, 8, 0, 1.42, 0.3, 0xc9a13a), bx(0.9, 0.25, 0.3, 0, 0.3, 1.45, 0x8a2f25),
      cy(0.26, 0.26, 1.02, 10, 0, 0.26, 0.6, 0x1b1c20, [0, 0, PI / 2]), cy(0.26, 0.26, 1.02, 10, 0, 0.26, -0.1, 0x1b1c20, [0, 0, PI / 2]), cy(0.2, 0.2, 1.02, 8, 0, 0.2, -0.9, 0x1b1c20, [0, 0, PI / 2])]);
  }
  function coachGeo(c) { return merge([bx(0.9, 0.16, 2.5, 0, 0.3, 0, 0x2a2a2e), bx(0.95, 0.75, 2.5, 0, 0.76, 0, c), bx(0.97, 0.26, 2.3, 0, 0.9, 0, 0xe9dfc2), bx(1.02, 0.1, 2.6, 0, 1.18, 0, 0x33363c)]); }
  function shinGeo(nose) { // 新幹線。先頭車は鼻が +z を向く
    var len = nose ? 2.4 : 3.3, z = nose ? -0.45 : 0, a = [bx(0.95, 0.8, len, 0, 0.72, z, 0xf4f6f8), bx(0.97, 0.12, len, 0, 0.62, z, 0x2f5fb0), bx(0.97, 0.18, len - 0.4, 0, 0.92, z - (nose ? 0.1 : 0), 0x27303f), bx(0.85, 0.14, len, 0, 0.26, z, 0x555a63)];
    if (nose) { var g = new T.ConeGeometry(0.95 / SQ2, 1.5, 4); g.rotateY(PI / 4); g.rotateX(PI / 2); a.push(P(flat(g), 0, 0.66, 1.5, 0xf4f6f8, null, [1, 0.84, 1])); a.push(bx(0.5, 0.16, 0.5, 0, 0.9, 0.86, 0x27303f, [0.5, 0, 0])); }
    return merge(a);
  }
  function tramGeo() {
    return merge([bx(0.8, 0.2, 2.6, 0, 0.2, 0, 0x2a2a2e), bx(1.0, 0.5, 3.2, 0, 0.55, 0, 0x2f6b4f), bx(1.0, 0.5, 3.2, 0, 1.05, 0, 0xf1e6c8), bx(1.02, 0.3, 2.9, 0, 1.05, 0, 0x27303f),
      bx(1.06, 0.1, 3.3, 0, 1.36, 0, 0x8a8f96), bx(0.06, 0.7, 0.06, 0, 1.75, 0, 0x33363c), bx(0.7, 0.05, 0.05, 0, 2.1, 0, 0x33363c)]);
  }
  function carGeo() { return merge([bx(0.8, 0.34, 1.7, 0, 0.37, 0, 0xffffff), bx(0.7, 0.3, 0.85, 0, 0.68, -0.1, 0x55626e), bx(0.84, 0.16, 0.32, 0, 0.16, 0.55, 0x202020), bx(0.84, 0.16, 0.32, 0, 0.16, -0.55, 0x202020)]); }
  function planeGeo() { // プロペラ機(前は +z)
    return merge([bx(0.5, 0.5, 2.6, 0, 0, 0, 0xd5dade), bx(0.52, 0.52, 0.4, 0, 0, 1.2, 0xc8452d), bx(4.4, 0.08, 0.85, 0, 0.12, 0.3, 0xd5dade), bx(1.6, 0.06, 0.5, 0, 0.1, -1.15, 0xd5dade),
      bx(0.06, 0.6, 0.5, 0, 0.35, -1.15, 0xc8452d), cy(0.55, 0.55, 0.03, 10, 0, 0, 1.45, 0x9aa1a8, [PI / 2, 0, 0]), cy(0.3, 0.3, 0.02, 10, 1.5, 0.17, 0.3, 0xe2492d), cy(0.3, 0.3, 0.02, 10, -1.5, 0.17, 0.3, 0xe2492d)]);
  }
  function jetGeo() { // 旅客機(前は +z)
    return merge([cy(0.42, 0.42, 5.2, 8, 0, 0, 0, 0xf1f3f5, [PI / 2, 0, 0]), co(0.42, 1.2, 8, 0, 0, 3.2, 0xf1f3f5, [PI / 2, 0, 0]), co(0.42, 1.4, 8, 0, 0, -3.3, 0xf1f3f5, [-PI / 2, 0, 0]),
      bx(6.4, 0.08, 1.3, 0, -0.1, 0.1, 0xe3e7ea), bx(2.4, 0.06, 0.7, 0, 0.1, -2.9, 0xe3e7ea), bx(0.08, 1.1, 0.9, 0, 0.6, -2.9, 0x2f5fb0),
      cy(0.2, 0.2, 0.8, 8, 1.6, -0.32, 0.4, 0x8a8f96, [PI / 2, 0, 0]), cy(0.2, 0.2, 0.8, 8, -1.6, -0.32, 0.4, 0x8a8f96, [PI / 2, 0, 0]), bx(0.86, 0.1, 4.4, 0, 0.14, 0.2, 0x2f5fb0)]);
  }
  function droneGeo() {
    return merge([bx(0.5, 0.16, 0.5, 0, 0, 0, 0x2a2f3a), bx(1.36, 0.05, 0.1, 0, 0.02, 0, 0x4a505c, [0, PI / 4, 0]), bx(1.36, 0.05, 0.1, 0, 0.02, 0, 0x4a505c, [0, -PI / 4, 0]),
      cy(0.28, 0.28, 0.03, 8, 0.48, 0.09, 0.48, 0xcfd4d8), cy(0.28, 0.28, 0.03, 8, -0.48, 0.09, 0.48, 0xcfd4d8), cy(0.28, 0.28, 0.03, 8, 0.48, 0.09, -0.48, 0xcfd4d8), cy(0.28, 0.28, 0.03, 8, -0.48, 0.09, -0.48, 0xcfd4d8)]);
  }
  function rocketGeo() {
    return merge([cy(0.42, 0.42, 4.4, 10, 0, 2.5, 0, 0xf1f3f5), cy(0.43, 0.43, 0.4, 10, 0, 3.6, 0, 0xe2492d), co(0.42, 1.1, 10, 0, 5.25, 0, 0xf1f3f5), cy(0.2, 0.2, 2.2, 8, 0.6, 1.4, 0, 0xd9dde1), cy(0.2, 0.2, 2.2, 8, -0.6, 1.4, 0, 0xd9dde1),
      co(0.2, 0.5, 8, 0.6, 2.75, 0, 0xe2492d), co(0.2, 0.5, 8, -0.6, 2.75, 0, 0xe2492d), cy(0.3, 0.42, 0.3, 10, 0, 0.15, 0, 0x33363c)]);
  }
  function wheelGeo() { // 水車(軸は z)
    var a = [cy(0.16, 0.16, 1.0, 8, 0, 0, 0, 0x4e3a28, [PI / 2, 0, 0])], i, an, r = 1.42;
    for (i = 0; i < 4; i++) { an = i * PI / 4; a.push(bx(0.1, 2.84, 0.08, 0, 0, 0.32, 0x7a5a3a, [0, 0, an]), bx(0.1, 2.84, 0.08, 0, 0, -0.32, 0x7a5a3a, [0, 0, an])); }
    for (i = 0; i < 8; i++) { an = i * PI / 4; a.push(bx(0.08, 0.5, 0.72, -Math.sin(an) * (r - 0.1), Math.cos(an) * (r - 0.1), 0, 0x8a6a44, [0, 0, an]), bx(1.14, 0.08, 0.08, -Math.sin(an) * r, Math.cos(an) * r, 0.32, 0x5f472f, [0, 0, an]), bx(1.14, 0.08, 0.08, -Math.sin(an) * r, Math.cos(an) * r, -0.32, 0x5f472f, [0, 0, an])); }
    return merge(a);
  }
  function treeGeo() { return merge([bx(0.24, 0.8, 0.24, 0, 0.4, 0, 0x9a7a58), co(1.0, 1.9, 7, 0, 1.55, 0, 0xffffff), co(0.74, 1.5, 7, 0, 2.55, 0, 0xffffff)]); }
  function farmGeo() { // 茅葺きの農家
    return merge([gb(3.0, 1.25, 2.1, 0, 0, 0xddd2b4), gb(3.06, 0.42, 2.16, 0, 0, 0x7a5a3a), fr(0.55, 2.3, 1.45, 0, 1.25, 0, 0xb9975a, 1.48, 1.12), bx(1.3, 0.2, 0.5, 0, 2.72, 0, 0x8f7442), bx(0.5, 0.8, 0.06, 0.5, 0.42, 1.06, 0x4e3a28)]);
  }
  // 海の向こうの町の家(culture: east=明・朝鮮 / india / islam / europe)。大きさは農家に合わせてある
  function houseGeo(cu) {
    if (cu === 'east') return merge([gb(3.0, 1.2, 2.0, 0, 0, 0xb9b3a6), fr(1.0, 3.4, 0.95, 0, 1.2, 0, 0x565c66, 1, 0.72), bx(3.3, 0.1, 0.12, 0, 2.2, 0, 0x3d4249), bx(0.5, 0.8, 0.06, 0.4, 0.4, 1.02, 0xa5352b)]);
    if (cu === 'india') return merge([gb(2.7, 1.5, 2.2, 0, 0, 0xd9a877), gb(2.9, 0.14, 2.4, 0, 0, 0xc08a5a, 1.5), gb(1.1, 0.8, 1.1, 0.6, 0.4, 0xe2b98a, 1.5), sp(0.42, 0.6, 2.72, 0.4, 0xf3ead7, [1, 0.8, 1]), bx(0.5, 0.9, 0.06, -0.5, 0.45, 1.12, 0x4e3a28)]);
    if (cu === 'islam') return merge([gb(2.6, 1.6, 2.2, 0, 0, 0xe6d6ae), gb(2.8, 0.14, 2.4, 0, 0, 0xcbb98a, 1.6), gb(1.0, 0.9, 1.0, -0.6, 0.4, 0xeadcb6, 1.6), bx(0.5, 1.0, 0.06, 0.5, 0.5, 1.12, 0x2b6d74), bx(0.3, 0.3, 0.06, -0.6, 1.05, 1.12, 0x2b3d61)]);
    if (cu === 'europe') return merge([gb(2.6, 1.5, 2.0, 0, 0, 0xefe6d2), pr(2.9, 1.5, 2.3, 0, 1.5, 0, 0xa5452f), bx(0.09, 1.5, 0.07, -1.3, 0.75, 1.02, 0x5a4632), bx(0.09, 1.5, 0.07, 1.3, 0.75, 1.02, 0x5a4632), bx(2.6, 0.09, 0.07, 0, 0.8, 1.02, 0x5a4632), bx(0.5, 0.9, 0.07, 0.3, 0.45, 1.03, 0x4e3a28), gb(0.4, 0.9, 0.4, -0.7, -0.3, 0x8a8d95, 2.3)]);
    return farmGeo();
  }
  // 鳥(文鳥人・インコ人)。足もとが原点、前は +z。色は DATA.BIRDS の look から
  function birdGeo(b) {
    var L = b.look, k = L.kind, a = [], wing = shade(L.body, k === 'budgie' ? 0.7 : 0.86), long = k === 'budgie' || k === 'cockatiel';
    var tailC = k === 'budgie' ? 0x3d6fb5 : (k === 'buncho' ? shade(L.head, 0.85) : shade(L.body, 0.7)), feet = k === 'buncho' ? 0xdf8f78 : 0x9a8f8a;
    a.push(sp(0.5, 0, 0.62, -0.02, L.body, [1, 1.08, 1.12]), sp(0.4, 0, 0.56, 0.2, L.belly, [0.92, 0.95, 0.85]));
    a.push(sp(0.2, 0.42, 0.66, -0.1, wing, [0.45, 1.5, 2.0]), sp(0.2, -0.42, 0.66, -0.1, wing, [0.45, 1.5, 2.0]));
    a.push(sp(0.37, 0, 1.24, 0.1, L.head), sp(0.15, 0.27, 1.17, 0.2, L.cheek, [0.6, 1, 1]), sp(0.15, -0.27, 1.17, 0.2, L.cheek, [0.6, 1, 1]));
    var br = k === 'buncho' ? 0.2 : 0.12, bl = k === 'buncho' ? 0.36 : 0.22;
    a.push(co(br, bl, 6, 0, k === 'buncho' ? 1.2 : 1.17, 0.42 + bl * 0.4, L.beak, [PI / 2, 0, 0]));
    a.push(sp(0.055, 0.22, 1.33, 0.36, L.eye, null, 6, 4), sp(0.055, -0.22, 1.33, 0.36, L.eye, null, 6, 4));
    if (L.ring) a.push(sp(0.085, 0.215, 1.33, 0.335, L.ring, [0.5, 1, 1], 6, 4), sp(0.085, -0.215, 1.33, 0.335, L.ring, [0.5, 1, 1], 6, 4));
    if (L.cere) a.push(bx(0.15, 0.09, 0.09, 0, 1.3, 0.45, L.cere));
    var tl = long ? 1.15 : 0.6; a.push(bx(long ? 0.2 : 0.28, 0.07, tl, 0, 0.42 - tl * 0.18, -0.5 - tl * 0.42, tailC, [-0.42, 0, 0]));
    a.push(bx(0.12, 0.1, 0.28, 0.17, 0.05, 0.08, feet), bx(0.12, 0.1, 0.28, -0.17, 0.05, 0.08, feet));
    if (k === 'cockatiel') a.push(co(0.07, 0.52, 5, 0, 1.72, 0.0, L.head, [-0.45, 0, 0]), co(0.06, 0.42, 5, 0, 1.66, 0.14, L.head, [-0.15, 0, 0]), co(0.06, 0.46, 5, 0, 1.64, -0.14, L.head, [-0.85, 0, 0]));
    if (L.prop === 'glasses') a.push(bx(0.62, 0.04, 0.03, 0, 1.33, 0.42, 0x2a2a2a), bx(0.2, 0.16, 0.02, 0.18, 1.33, 0.415, 0xcfe3f2), bx(0.2, 0.16, 0.02, -0.18, 1.33, 0.415, 0xcfe3f2));
    else if (L.prop === 'goggles') a.push(bx(0.5, 0.13, 0.1, 0, 1.5, 0.3, 0xe0a030, [-0.4, 0, 0]));
    else if (L.prop === 'hardhat') a.push(sp(0.4, 0, 1.38, 0.08, 0xf2c230, [1, 0.62, 1]), bx(0.5, 0.05, 0.3, 0, 1.4, 0.42, 0xf2c230));
    else if (L.prop === 'beret') a.push(sp(0.35, 0.05, 1.57, 0.05, 0x2f4a2f, [1.15, 0.36, 1.15]));
    else if (L.prop === 'aviator') a.push(bx(0.46, 0.12, 0.1, 0, 1.46, 0.32, 0x5a3a22, [-0.4, 0, 0]));
    else if (L.prop === 'headset') a.push(bx(0.8, 0.05, 0.07, 0, 1.63, 0.08, 0x2a2a2a), bx(0.07, 0.3, 0.12, 0.39, 1.36, 0.08, 0x2a2a2a), bx(0.07, 0.3, 0.12, -0.39, 1.36, 0.08, 0x2a2a2a));
    else if (L.prop === 'rice') a.push(bx(0.04, 0.9, 0.04, 0.52, 0.95, 0.22, 0xb9a24a), sp(0.09, 0.52, 1.5, 0.22, 0xe2c85a, [0.7, 1.9, 0.7], 6, 4));
    return merge(a);
  }
  // ダリオくん:計算機ラックの上の、クリーム色の端末。前は +z
  function darioGeo() {
    return merge([gb(1.9, 1.5, 1.4, 0, 0, 0x3b475c), bx(1.5, 0.14, 0.05, 0, 1.22, 0.71, 0x2a3446), bx(0.5, 0.14, 0.05, 0.5, 0.84, 0.71, 0x2a3446), gb(0.5, 0.3, 0.5, 0, 0, 0x8791a3, 1.5),
      gb(2.5, 1.9, 1.7, 0, 0, 0xefe8da, 1.8), bx(2.56, 1.96, 0.16, 0, 2.75, 0.8, 0xcbbfa8), bx(2.0, 1.4, 0.06, 0, 2.75, 0.9, 0x14213a), cy(0.04, 0.04, 0.55, 5, 0, 3.97, 0, 0x8791a3),
      bx(1.5, 0.08, 0.05, 0, 3.2, -0.86, 0xb9ad94), bx(1.5, 0.08, 0.05, 0, 2.95, -0.86, 0xb9ad94), bx(1.5, 0.08, 0.05, 0, 2.7, -0.86, 0xb9ad94), bx(0.6, 0.5, 0.3, 0, 2.2, -0.95, 0xcbbfa8), bx(1.5, 0.9, 0.05, 0, 0.8, -0.71, 0x2a3446)]);
  }
  function darioFace(asi) { // 口と頬とアンテナの玉。超知能のあとは琥珀色が抜けて、口が一本線になる
    var c = asi ? 0xeef4ff : 0xffb86b, a = [sp(0.16, 0, 4.32, 0, asi ? 0xeef4ff : 0xe2492d)];
    if (asi) a.push(bx(0.5, 0.07, 0.02, 0, 2.4, 0.94, c));
    else a.push(bx(0.3, 0.075, 0.02, 0, 2.36, 0.94, c), bx(0.2, 0.075, 0.02, 0.22, 2.4, 0.94, c, [0, 0, 0.5]), bx(0.2, 0.075, 0.02, -0.22, 2.4, 0.94, c, [0, 0, -0.5]), bx(0.2, 0.1, 0.02, 0.74, 2.5, 0.94, 0xa85e48), bx(0.2, 0.1, 0.02, -0.74, 2.5, 0.94, 0xa85e48));
    return merge(a);
  }
  function darioEyes(asi) { // 目だけ別にして、まばたきさせる(原点は目の高さ)
    var c = asi ? 0xeef4ff : 0xffb86b, a = [];
    [-0.42, 0.42].forEach(function (x) {
      if (asi) a.push(bx(0.34, 0.06, 0.02, x, 0.14, 0, c), bx(0.34, 0.06, 0.02, x, -0.14, 0, c), bx(0.06, 0.34, 0.02, x - 0.14, 0, 0, c), bx(0.06, 0.34, 0.02, x + 0.14, 0, 0, c));
      else a.push(bx(0.24, 0.42, 0.02, x, 0, 0, c));
    });
    return merge(a);
  }

  function haloGeo() { // 中心が明るく、縁で消える円盤(加算で重ねる)
    var seg = 18, p = [], c = [], i, r1 = 0.4;
    function v(a, r, k) { p.push(Math.cos(a) * r, Math.sin(a) * r, 0); c.push(k, k, k); }
    for (i = 0; i < seg; i++) { var a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU; v(0, 0, 1); v(a0, r1, 0.3); v(a1, r1, 0.3); v(a0, r1, 0.3); v(a0, 1, 0); v(a1, 1, 0); v(a0, r1, 0.3); v(a1, 1, 0); v(a1, r1, 0.3); }
    var g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(c, 3)); return g;
  }

  // ── 時代ごとの空と光 ──
  var SKY = [['#7db3e0', '#dcebf2', '#b7c7ae'], ['#6daee2', '#e4eef2', '#bcc9a8'], ['#93a7b5', '#ebe0c8', '#b5a98e'], ['#27295a', '#d07a5c', '#3b2b45'], ['#4c9be4', '#d6eaf8', '#a7c0cc'],
    ['#3a8ee8', '#cfe7fb', '#9db9cf'], ['#1a2552', '#7a5f94', '#1a2036'], ['#080f2a', '#1c3a5e', '#070c1a'], ['#eef2f7', '#e3e9f0', '#d3dbe5'],
    ['#f3b3be', '#fdebdc', '#cbd8b2'], ['#1b1020', '#a8262f', '#2a1418']];   // 鳥の世(くちばし色の朝)、ガチの世(闘技場の夕暮れ)
  var LIT = [ // 空の光, 地の照り返し, 強さ, 日の色, 日の強さ, 夜らしさ, 霧の始まり, 霧の終わり(カメラ距離の倍数)
    [0xdfeeff, 0x6f7550, 0.78, 0xfff1d0, 0.62, 0.00, 1.0, 3.2], [0xdfeeff, 0x6f7550, 0.78, 0xfff1d0, 0.62, 0.00, 1.0, 3.2], [0xe9e2d0, 0x6f6a50, 0.74, 0xffe2b0, 0.58, 0.10, 0.9, 2.8],
    [0x9a8fd0, 0x3a3050, 0.56, 0xff9c6a, 0.52, 0.85, 0.9, 3.0], [0xe6f2ff, 0x7a8060, 0.80, 0xffffff, 0.64, 0.00, 1.0, 3.4], [0xe6f2ff, 0x7a8060, 0.82, 0xffffff, 0.66, 0.00, 1.0, 3.4],
    [0x7f8fd0, 0x2a2c48, 0.54, 0xc7a8ff, 0.36, 0.60, 0.9, 3.0], [0x5f7ac0, 0x1c2238, 0.48, 0x8fb0ff, 0.30, 0.92, 0.9, 3.0], [0xf4f8ff, 0xc3cedc, 0.80, 0xffffff, 0.46, 0.00, 0.8, 2.7],
    [0xffe9ec, 0x80705a, 0.82, 0xfff0e0, 0.62, 0.00, 1.0, 3.3], [0xffc4b0, 0x40202a, 0.66, 0xffa868, 0.62, 0.78, 0.9, 3.0]];
  var VIEWS = { all: [0, 2.5, 0, 0, 0], hq: [3.8, 1.8, 24.0, 8.0, 20], castle: [-23.5, 7.5, -23.5, 13, 20], town: [3, 3.5, -5, 17, 26],
    ring: [3, 2.0, -5, 7.5, 15], arena: [3, 3.2, -5, 17, 30], plant: [20, 2.4, -22.5, 11, 24], park: [22, 1.6, 19.5, 11, 30], statue: [-8.5, 6.2, -16, 10.5, 12], bunall: [1, 3, -3, 0, 0],
    works: [21, 3, -24, 14, 24], pad: [21.5, 4, 20, 12, 22], rail: [-3.5, 1.5, 4.5, 12, 24], furnace: [-14, 2.5, -8, 11, 24] };

  function riverZ(x) { return 10 + 1.8 * Math.sin(x * 0.11 + 0.6); }
  var BRX = 3, BRZ = riverZ(3); // 橋の位置

  function mount(host, opts) {
    if (!available() || !host) return null;
    opts = opts || {};
    try {
      if (!renderer) {
        renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
        renderer.domElement.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;';
        MAT = { vc: new T.MeshLambertMaterial({ vertexColors: true }), inst: new T.MeshLambertMaterial({ vertexColors: true }), instPlain: new T.MeshLambertMaterial({ vertexColors: true }), glow: new T.MeshBasicMaterial({ vertexColors: true }) };
      }
    } catch (e) { glOK = false; return null; }

    var R = rng(20261127), D = TF.DATA || {}, BIRDS = D.BIRDS || [], CU = opts.culture || ''; // CU: 海の向こうの町にするときの文化圏
    var M = { host: host, t: 0, stage: -1, dead: false, manual: false, raf: 0, last: 0, w: 0, h: 0, phi: opts.angle == null ? 0.55 : opts.angle, orbit: opts.orbit !== false, form: 0, trash: [], night: 0, skyK: 1, shx: +opts.shiftX || 0, shy: +opts.shiftY || 0 };
    var reduced = false; try { reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* 古い端末 */ }
    if (reduced) M.orbit = false;
    function keep(o) { M.trash.push(o); return o; }
    // その時代に出ているか。9(鳥の世)は、7 の町に鳥のものを足した姿。10(ガチの世)は、土台と山と城と橋だけを残して建て替えた姿
    function inR(a, b, n) {
      if (n == null) n = M.stage;
      if (a >= 9) return n >= a && n <= b;
      if (n === 9) return a <= 7 && b >= 7;
      if (n === 10) return a < 8 && b >= 8;
      return n >= a && n <= b;
    }

    // 画面の部品:空を二枚重ねて、時代の変わり目に溶かす
    var wrap = document.createElement('div'), skyA = document.createElement('div'), skyB = document.createElement('div');
    wrap.className = 'dio-wrap'; wrap.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;';
    skyA.style.cssText = skyB.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;';
    wrap.appendChild(skyA); wrap.appendChild(skyB);
    try { if (root.getComputedStyle(host).position === 'static') host.style.position = 'relative'; } catch (e) { /* そのまま */ }
    host.appendChild(wrap);
    function grad(n) { return TF.Diorama3D.sky(n); }

    var scene = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, 2, 900);
    var hemi = new T.HemisphereLight(0xffffff, 0x888888, 1), sun = new T.DirectionalLight(0xffffff, 0.8);
    sun.position.set(-14, 24, 12); scene.add(hemi); scene.add(sun);
    scene.fog = new T.Fog(0xffffff, 100, 400);
    var litA = null, litB = null, m4 = new T.Matrix4(), v3 = new T.Vector3(), q4 = new T.Quaternion(), s3 = new T.Vector3(), c3 = new T.Color(), cA = new T.Color(), cB = new T.Color();
    var matWin = keep(new T.MeshBasicMaterial({ vertexColors: true })), DAYWIN = new T.Color(0xa9c6dc), NIGHTWIN = new T.Color(0xffd27a);
    var fogA = new T.Color(SKY[0][1]), paleA = 0, paleB = 0;
    var coverMat = keep(new T.MeshLambertMaterial({ color: 0xd6dee8, transparent: true, opacity: 0 })), cover = new T.Mesh(keep(new T.BoxGeometry(66, 0.03, 66)), coverMat);
    cover.position.y = 0.065; cover.visible = false; scene.add(cover);
    var view = { x: 0, y: 2.5, z: 0, rad: 33, el: 0.52 }, viewTo = { x: 0, y: 2.5, z: 0, rad: 0, el: 0 };
    function defRad() { return M.w / Math.max(1, M.h) < 0.8 ? 25 : 36; }

    // ── 定義:生えてくるかたまり、灯り、煙 ──
    var defs = [], LT = [], EM = [], GEO = {};
    function geo(name, make) { return GEO[name] || (GEO[name] = keep(make())); }
    function chunk(id, a, b, x, z, make, o) { o = o || {}; defs.push({ id: id, a: a, b: b, x: x, z: z, make: make, after: o.after, flat: !!o.flat, slow: !!o.slow, group: null, k: 0, want: false, anim: null, delay: (defs.length * 0.37) % 0.62 }); }
    function light(a, b, x, y, z, sx, sy, sz, cd, cn, blink, halo) { LT.push({ a: a, b: b, x: x, y: y, z: z, sx: sx, sy: sy, sz: sz, cd: new T.Color(cd), cn: new T.Color(cn == null ? cd : cn), blink: blink || null, ph: R() * 10, halo: halo || 0, hi: -1, vis: false, t0: null, k: 1 }); return LT.length - 1; }
    function emitter(a, b, x, y, z, rate, size, grey, rise) { EM.push({ a: a, b: b, x: x, y: y, z: z, rate: rate, size: size, grey: grey, rise: rise || 1.5, acc: R() }); }
    function Quads() { this.pos = []; this.col = []; }
    Quads.prototype.q = function (cx, cy0, cz, w, h, face, b) { // 窓の一枚。face: 0=+z 1=-z 2=+x 3=-x
      var hw = w / 2, hh = h / 2, p = this.pos, A, B, C, E;
      if (face === 0) { A = [cx - hw, cy0 - hh, cz]; B = [cx + hw, cy0 - hh, cz]; C = [cx + hw, cy0 + hh, cz]; E = [cx - hw, cy0 + hh, cz]; }
      else if (face === 1) { A = [cx + hw, cy0 - hh, cz]; B = [cx - hw, cy0 - hh, cz]; C = [cx - hw, cy0 + hh, cz]; E = [cx + hw, cy0 + hh, cz]; }
      else if (face === 2) { A = [cx, cy0 - hh, cz + hw]; B = [cx, cy0 - hh, cz - hw]; C = [cx, cy0 + hh, cz - hw]; E = [cx, cy0 + hh, cz + hw]; }
      else { A = [cx, cy0 - hh, cz - hw]; B = [cx, cy0 - hh, cz + hw]; C = [cx, cy0 + hh, cz + hw]; E = [cx, cy0 + hh, cz - hw]; }
      p.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2], A[0], A[1], A[2], C[0], C[1], C[2], E[0], E[1], E[2]);
      for (var i = 0; i < 6; i++) this.col.push(b, b, b);
    };
    function wb() { return R() < 0.62 ? 0.75 + R() * 0.25 : 0.2 + R() * 0.12; }
    function windows(o, x, z, w, d, y0, floors, fh, wh) { // 四面に窓を並べる
      var i, j, n, fy, u;
      for (i = 0; i < floors; i++) {
        fy = y0 + i * fh;
        n = Math.max(1, Math.round(w / 1.05)); u = w / n; for (j = 0; j < n; j++) { o.win.q(x + (j - (n - 1) / 2) * u, fy, z + d / 2 + 0.03, u * 0.74, wh, 0, wb()); o.win.q(x + (j - (n - 1) / 2) * u, fy, z - d / 2 - 0.03, u * 0.74, wh, 1, wb()); }
        n = Math.max(1, Math.round(d / 1.05)); u = d / n; for (j = 0; j < n; j++) { o.win.q(x + w / 2 + 0.03, fy, z + (j - (n - 1) / 2) * u, u * 0.74, wh, 2, wb()); o.win.q(x - w / 2 - 0.03, fy, z + (j - (n - 1) / 2) * u, u * 0.74, wh, 3, wb()); }
      }
    }
    function house(o, x, z, w, d, h, c, roof) { // 煉瓦や石の建物
      o.lit.push(gb(w, h, d, x, z, c), gb(w + 0.14, 0.16, d + 0.14, x, z, shade(c, 0.78)));
      if (roof) { if (w >= d) o.lit.push(pr(d + 0.3, d * 0.36, w + 0.3, x, h, z, 0x4a4e57, PI / 2)); else o.lit.push(pr(w + 0.3, w * 0.36, d + 0.3, x, h, z, 0x4a4e57)); }
      else o.lit.push(gb(w + 0.2, 0.2, d + 0.2, x, z, shade(c, 0.7), h), gb(0.5, 0.7, 0.5, x + w * 0.2, z, 0x7a4030, h + 0.2));
      windows(o, x, z, w, d, 0.85, Math.max(1, Math.floor((h - 0.3) / 1.15)), 1.15, 0.6);
    }
    function tower(o, x, z, w, d, h, c) { // 高い建物
      o.lit.push(gb(w, h, d, x, z, c), gb(w * 0.55, 0.5, d * 0.55, x, z, shade(c, 0.74), h));
      windows(o, x, z, w, d, 0.9, Math.floor((h - 0.5) / 1.0), 1.0, 0.56);
    }

    // 土台:台座、草地、川、土の道。これだけは最初からあって動かない
    chunk('base', 0, 8, 0, 0, function (o) {
      var a = o.lit, x;
      a.push(bx(66, 2.6, 66, 0, -1.42, 0, 0x6b563f), bx(67.4, 0.6, 67.4, 0, -3.0, 0, 0x3a2f24), bx(66, 0.12, 66, 0, -0.06, 0, 0x76995a));
      for (x = -33; x < 33; x += 2) {
        var z0 = riverZ(x), z1 = riverZ(x + 2), ang = -Math.atan2(z1 - z0, 2), len = Math.sqrt(4 + (z1 - z0) * (z1 - z0)) + 0.14;
        a.push(bx(len, 0.04, 5.0, x + 1, 0.02, (z0 + z1) / 2, 0xd8cfa4, [0, ang, 0]), bx(len, 0.12, 3.8, x + 1, 0.05, (z0 + z1) / 2, 0x5a9bd0, [0, ang, 0]));
      }
      a.push(gb(1.5, 0.05, 20.1, 3, -2.45, 0xcdb98c), gb(1.5, 0.05, 5.6, 3, 18.2, 0xcdb98c), gb(40, 0.05, 1.5, 2, -5, 0xcdb98c), bx(19.1, 0.05, 1.2, -9.25, 0.025, -12.25, 0xcdb98c, [0, -0.711, 0]));
      a.push(gb(9, 0.04, 6, 1.5, 24, 0xbfae84)); // 駐屯地の踏み固めた土
    }, { flat: true });

    // 山と城
    chunk('hill', 0, 8, -23.5, -23.5, function (o) {
      o.lit.push(cy(3.4, 8.2, 5.2, 10, 0, 2.6, 0, 0x6c9150), cy(8.2, 9.2, 0.4, 10, 0, 0.2, 0, 0x719656), sp(0.9, 4.6, 1.2, 4.4, 0x9a9d96, [1, 0.7, 1]), sp(0.7, -5.2, 1.0, 3.6, 0x9a9d96, [1, 0.7, 1]));
    });
    chunk('castle', 0, 8, -23.5, -23.5, function (o) {
      var y = 5.2, W = 0xf1ece0, Rf = 0x2e3440, a = o.lit;
      if (CU === 'east') { // 朱の楼閣と黄瑠璃の瓦
        a.push(fr(4.6, 5.2, 1.0, 0, y, 0, 0xe9e2d2), gb(3.7, 1.3, 2.7, 0, 0, 0xb5433a, y + 1.0), fr(2.2, 4.9, 0.75, 0, y + 2.3, 0, 0xd9a93a, 1, 0.76), gb(2.5, 0.95, 1.8, 0, 0, 0xb5433a, y + 3.05),
          fr(1.0, 3.5, 0.85, 0, y + 4.0, 0, 0xd9a93a, 1, 0.76), bx(0.16, 0.3, 0.16, 0, y + 5.0, 0, 0xd9b24c), gb(0.7, 0.8, 0.08, 0, 1.38, 0x3a2c20, y + 1.0));
        return;
      }
      if (CU === 'islam' || CU === 'india') { // 丸屋根と尖塔
        var wl = CU === 'india' ? 0xc9694a : 0xe6d3ac, dm = CU === 'india' ? 0xf3ead7 : 0x3aa0a8;
        a.push(fr(4.7, 5.2, 0.8, 0, y, 0, shade(wl, 0.85)), gb(3.4, 1.9, 3.4, 0, 0, wl, y + 0.8), sp(1.75, 0, y + 2.75, 0, dm, [1, 0.95, 1], 12, 8), co(0.14, 0.7, 6, 0, y + 4.75, 0, 0xd9b24c), gb(0.8, 1.2, 0.08, 0, 1.72, 0x2b3d61, y + 0.8));
        [[-2.05, 2.05], [2.05, 2.05], [-2.05, -2.05], [2.05, -2.05]].forEach(function (q) {
          if (CU === 'india') a.push(cy(0.3, 0.34, 2.6, 8, q[0], y + 2.1, q[1], wl), sp(0.46, q[0], y + 3.5, q[1], dm, [1, 0.9, 1]));
          else a.push(cy(0.26, 0.32, 4.6, 8, q[0], y + 3.1, q[1], wl), cy(0.42, 0.42, 0.16, 8, q[0], y + 4.4, q[1], shade(wl, 0.8)), co(0.36, 1.0, 8, q[0], y + 5.9, q[1], dm));
        });
        return;
      }
      if (CU === 'europe') { // 石の聖堂と塔
        a.push(fr(4.7, 5.2, 0.7, 0, y, 0, 0x8a8d95), gb(3.0, 2.3, 3.8, 0.5, 0, 0xa4a7ad, y + 0.7), pr(3.3, 1.5, 4.0, 0.5, y + 3.0, 0, 0x4a5f78), cy(0.85, 0.9, 4.6, 10, -1.7, y + 3.0, 1.2, 0x9a9da4), co(1.05, 2.2, 10, -1.7, y + 6.4, 1.2, 0x4a5f78),
          bx(0.08, 0.7, 0.08, -1.7, y + 7.85, 1.2, 0xd9b24c), bx(0.4, 0.08, 0.08, -1.7, y + 7.95, 1.2, 0xd9b24c), cy(0.5, 0.5, 0.06, 12, 0.5, y + 2.4, 1.93, 0x6f9fd0, [PI / 2, 0, 0]), gb(0.7, 1.1, 0.08, 0.5, 1.92, 0x3a2c20, y + 0.7));
        return;
      }
      a.push(fr(4.2, 5.2, 1.5, 0, y, 0, 0x8a8d95), gb(3.5, 1.1, 3.5, 0, 0, W, y + 1.5), fr(2.7, 4.4, 0.55, 0, y + 2.6, 0, Rf), gb(2.5, 0.95, 2.5, 0, 0, W, y + 3.15), fr(1.9, 3.25, 0.5, 0, y + 4.1, 0, Rf),
        gb(1.6, 0.85, 1.6, 0, 0, W, y + 4.6), py(2.5, 1.0, 0, y + 5.45, 0, Rf), bx(0.14, 0.3, 0.14, 0, y + 6.55, 0, 0xd9b24c), gb(0.6, 0.7, 0.08, 0, 1.78, 0x3a2c20, y + 1.5));
    });

    // 戦国:村と田と橋
    chunk('farm_town', 0, 2, 3, -5, function (o) {
      var g = geo('farm' + CU, function () { return houseGeo(CU); });
      [[-7, -4.6, 0.2, 1], [6.5, -5.2, -0.3, 1.05], [-6.2, 4.3, 2.9, 0.95], [6.4, 4.6, 0.1, 1], [9.8, -3.6, 1.4, 0.9]].forEach(function (h) { o.lit.push(put(g, h[0], 0, h[1], h[2], h[3])); });
      o.lit.push(gb(0.5, 0.5, 0.5, -3.2, -3.4, 0x8a8d95), gb(0.9, 0.08, 0.9, -3.2, -3.4, 0x5a4632, 0.9), bx(0.08, 0.5, 0.08, -3.55, 0.7, -3.4, 0x5a4632), bx(0.08, 0.5, 0.08, -2.85, 0.7, -3.4, 0x5a4632)); // 井戸
    });
    chunk('farm_out', 0, 4, -20, 12.9, function (o) {
      var g = geo('farm' + CU, function () { return houseGeo(CU); });
      o.lit.push(put(g, 8.6, 0, 0, 0.1, 1), put(g, -8.2, 0, 0, -0.12, 0.95), put(g, 13.5, 0, -27.4, 0.6, 0.9));
    });
    emitter(0, 3, -11.4, 3.0, 12.9, 0.5, 0.34, 0.92, 1.1);
    chunk('paddy0', 0, 0, -20, 22.7, function (o) {
      [[-7, -5, 6, 5, 0.1, 0x9cc27a], [0, -6.3, 5.5, 4, -0.12, 0x86b488], [7, -5.2, 5, 5.5, 0.2, 0xa9c98a], [-6.5, 1.5, 7, 5.5, -0.08, 0x86b488], [1, 0.2, 5, 6, 0.15, 0xa9c98a],
        [7.3, 1.6, 5.3, 5, -0.2, 0x9cc27a], [0.5, 6.6, 9, 3.8, 0.05, 0x9cc27a], [-8.2, 7, 4.5, 3.4, 0.3, 0xa9c98a]].forEach(function (p) {
        o.lit.push(gb(p[2] + 0.5, 0.1, p[3] + 0.5, p[0], p[1], 0x8a7650, 0, p[4]), gb(p[2], 0.14, p[3], p[0], p[1], p[5], 0, p[4]));
      });
    }, { flat: true });
    chunk('bridge0', 0, 3, BRX, BRZ, function (o) {
      var W = 0x8a5a34, V = 0xb5412c, a = o.lit, s;
      a.push(bx(1.7, 0.14, 3.2, 0, 0.95, 0, W), bx(1.7, 0.14, 2.75, 0, 0.56, 2.85, W, [0.29, 0, 0]), bx(1.7, 0.14, 2.75, 0, 0.56, -2.85, W, [-0.29, 0, 0]));
      for (s = -1; s <= 1; s += 2) a.push(bx(0.08, 0.08, 3.2, s * 0.8, 1.42, 0, V), bx(0.08, 0.08, 2.75, s * 0.8, 1.03, 2.85, V, [0.29, 0, 0]), bx(0.08, 0.08, 2.75, s * 0.8, 1.03, -2.85, V, [-0.29, 0, 0]),
        bx(0.16, 1.5, 0.16, s * 0.8, 0.75, 1.6, W), bx(0.16, 1.5, 0.16, s * 0.8, 0.75, -1.6, W), bx(0.14, 0.6, 0.14, s * 0.8, 0.3, 4.1, V), bx(0.14, 0.6, 0.14, s * 0.8, 0.3, -4.1, V));
    });

    // 自衛隊の駐屯地と、研究本部
    chunk('camp', 0, 7, 0, 24, function (o) {
      var a = o.lit, OL = 0x5d6d42;
      a.push(put(geo('tank', tankGeo), -4.4, 0, -5.4, 0.4, 0.82), put(geo('truck', truckGeo), 7.6, 0, -4.9, -0.3, 0.8));
      [[-5.9, 5.0], [-1.9, 5.7], [2.5, 5.5]].forEach(function (t) { a.push(py(2.5, 1.5, t[0], 0, t[1], OL, 1, 1.25), bx(0.6, 0.9, 0.06, t[0], 0.45, t[1] + 1.2, 0x2c331f)); });
      a.push(bx(0.1, 4.2, 0.1, -7.6, 2.1, -6.6, 0xe9e9e4), bx(1.6, 1.05, 0.05, -6.75, 3.6, -6.6, 0xf7f5f0), cy(0.32, 0.32, 0.07, 14, -6.75, 3.6, -6.6, 0xe2492d, [PI / 2, 0, 0]));
      a.push(gb(0.8, 0.7, 0.8, 5.2, -6.6, 0x4d5b35), gb(0.8, 0.7, 0.8, 6.1, -6.9, 0x55673c), gb(0.7, 0.6, 0.7, 5.6, -6.7, 0x4d5b35, 0.7), cy(0.3, 0.3, 0.8, 8, -7.2, 0.4, -3.2, 0x8a2f25), cy(0.3, 0.3, 0.8, 8, -7.3, 0.4, -2.4, 0x3f4d2c));
    });
    chunk('hq', 0, 7, 0, 24, function (o) {
      var a = o.lit, CR = 0xe9e2cf;
      a.push(gb(3.4, 1.6, 4.2, -3.6, 0.1, CR), pr(3.9, 1.35, 4.7, -3.6, 1.6, 0.1, 0xd6cdb4), bx(0.06, 1.3, 2.4, -1.88, 0.65, 0.1, 0x3a3428), bx(0.06, 0.42, 0.9, -1.88, 1.28, 1.6, 0x2b3d61));
      a.push(cy(1.35, 1.35, 0.12, 14, 2.2, 0.95, -0.2, 0x9a7446), cy(0.2, 0.34, 0.9, 8, 2.2, 0.45, -0.2, 0x6b4a2c), bx(1.3, 0.03, 0.9, 2.1, 1.03, -0.2, 0x9fc4e8, [0, 0.3, 0]), bx(0.5, 0.03, 0.4, 2.7, 1.035, 0.2, 0xf7f5f0, [0, -0.4, 0]));
      a.push(gb(1.2, 0.9, 0.8, 8.9, -1.4, 0xc9a93a), gb(1.26, 0.12, 0.86, 8.9, -1.4, 0x33363c, 0.9), bx(0.08, 0.08, 1.9, 8.1, 0.06, -0.5, 0x1c1d19, [0, 0.9, 0]));
    });

    // 殖産:高炉、水車、まっすぐな田、坑口
    chunk('furnace', 1, 7, -13, -10.5, function (o) {
      var a = o.lit;
      a.push(gb(3.8, 0.8, 3.8, 0, 0, 0x8f4a36), cy(1.05, 1.6, 4.2, 10, 0, 2.9, 0, 0x9a8f86), cy(1.25, 1.25, 0.3, 10, 0, 5.1, 0, 0x5f5a55), cy(0.7, 0.9, 0.5, 10, 0, 5.45, 0, 0x4a4541));
      a.push(cy(0.62, 0.62, 2.6, 8, -2.6, 1.3, 1.6, 0xb7b0a6), sp(0.62, -2.6, 2.6, 1.6, 0xb7b0a6), cy(0.62, 0.62, 2.6, 8, -2.6, 1.3, -0.2, 0xb7b0a6), sp(0.62, -2.6, 2.6, -0.2, 0xb7b0a6));
      a.push(bx(0.7, 0.14, 5.2, 1.8, 2.5, -1.4, 0x5a4632, [0.72, 0, 0]), gb(3.0, 1.5, 2.2, 3.2, 2.0, 0x8f4a36), pr(2.5, 0.8, 3.3, 3.2, 1.5, 2.0, 0x4a4e57, PI / 2));
      o.glow.push(bx(0.8, 0.5, 0.1, 0, 1.15, 1.66, 0xffa23a), cy(0.5, 0.5, 0.06, 10, 0, 5.72, 0, 0xff7a2a), bx(0.3, 0.12, 1.3, 0, 0.88, 2.5, 0xffc05a));
    });
    emitter(1, 5, -13, 6.0, -10.5, 2.2, 0.9, 0.36, 1.7);
    light(1, 7, -13, 1.15, -8.78, 0.7, 0.42, 0.12, 0xffa23a, 0xffa23a, null, 2.4);
    chunk('mill', 1, 3, -17, 5.3, function (o) {
      o.lit.push(gb(2.6, 1.6, 2.2, 0, 0, 0xddd2b4), gb(2.66, 0.4, 2.26, 0, 0, 0x7a5a3a), pr(2.6, 1.1, 3.0, 0, 1.6, 0, 0xb9975a, PI / 2), bx(0.3, 0.3, 1.2, 0, 1.45, 1.6, 0x5a4632));
    }, { after: function (g) { M.wheel = new T.Mesh(geo('wheel', wheelGeo), MAT.vc); M.wheel.position.set(0, 1.25, 2.05); g.add(M.wheel); } });
    chunk('mine', 1, 5, -15.4, -22, function (o) {
      var a = o.lit, W = 0x5a4632;
      a.push(bx(0.5, 1.6, 1.9, -0.5, 0.8, 0, 0x16120e), bx(0.24, 1.8, 0.24, 0, 0.9, 0.95, W), bx(0.24, 1.8, 0.24, 0, 0.9, -0.95, W), bx(0.3, 0.26, 2.4, 0, 1.9, 0, W));
      a.push(bx(4.2, 0.06, 0.08, 2.2, 0.06, 0.3, 0x6b6f78), bx(4.2, 0.06, 0.08, 2.2, 0.06, -0.3, 0x6b6f78), gb(0.9, 0.5, 0.8, 2.6, 0, 0x3a3a3e, 0.12), sp(0.4, 2.6, 0.7, 0, 0x8a8d95, [1, 0.6, 0.9]), co(1.6, 1.3, 7, 4.6, 0.65, 2.4, 0x8a7f72));
    });
    chunk('paddy1', 1, 7, -20, 22.9, function (o) {
      var i, j, r;
      for (i = -1; i <= 1; i++) for (j = -1; j <= 1; j += 2) {
        var x = i * 7.3, z = j * 4.1;
        o.lit.push(gb(6.9, 0.1, 7.8, x, z, 0x8a7650), gb(6.5, 0.14, 7.4, x, z, 0x86b0a8));
        for (r = -2.5; r <= 2.5; r += 1) o.lit.push(gb(0.46, 0.34, 6.9, x + r * 1.04, z, (i + j + 3) % 2 ? 0x79b257 : 0x86bb5c));
      }
    }, { flat: true });

    // 蒸気:煉瓦の工場、鉄道、駅、電信
    function factory(o, x, z, w, d, teeth) {
      var a = o.lit, i, n = teeth, u = w / n;
      a.push(gb(w, 2.8, d, x, z, 0xa5553c), gb(w + 0.14, 0.3, d + 0.14, x, z, 0x8a4532));
      for (i = 0; i < n; i++) a.push(pr(u, 0.95, d, x + (i - (n - 1) / 2) * u, 2.8, z, 0x4a4e57, 0, u * 0.32));
      windows(o, x, z, w, d, 1.5, 1, 1, 0.9);
    }
    function chimney(o, x, z, h) { o.lit.push(cy(0.32, 0.5, h, 8, x, h / 2, z, 0x8a4532), cy(0.4, 0.4, 0.25, 8, x, h - 0.1, z, 0x5a3026)); }
    chunk('factoryA', 2, 7, 17, -28, function (o) { factory(o, 0, 0, 8, 4.6, 4); chimney(o, 3.0, -1.0, 6.8); chimney(o, -3.2, -1.2, 5.6); });
    chunk('factoryB', 2, 7, 27.8, -21, function (o) { factory(o, 0, 0, 5.5, 9, 3); chimney(o, 1.6, 3.2, 7.4); o.lit.push(gb(2.4, 1.4, 2.4, -1.0, 6.2, 0x3a3a3e), gb(2.2, 0.5, 2.2, -1.0, 6.2, 0x16120e, 1.4)); });
    emitter(2, 5, 20, 7.0, -29, 1.5, 0.8, 0.45); emitter(2, 5, 13.8, 5.8, -29.2, 1.2, 0.7, 0.5); emitter(2, 5, 29.4, 7.6, -17.8, 1.5, 0.8, 0.42);
    var LOOP = makeLoop(3, -9, 23, 13, 720);
    chunk('rail', 2, 7, 0, 0, function (o) {
      var n = 180, i, a = o.lit;
      for (i = 0; i < n; i++) {
        var p = onLoop(i / n * LOOP.len), p2 = onLoop((i + 1) / n * LOOP.len), dx = p2.x - p.x, dz = p2.z - p.z, len = Math.sqrt(dx * dx + dz * dz), ang = Math.atan2(-dz, dx), mx = (p.x + p2.x) / 2, mz = (p.z + p2.z) / 2, nx = -dz / len, nz = dx / len;
        a.push(bx(len + 0.06, 0.1, 1.5, mx, 0.05, mz, 0xa59e90, [0, ang, 0]), bx(0.22, 0.08, 1.15, mx, 0.13, mz, 0x5a4632, [0, ang, 0]));
        a.push(bx(len + 0.04, 0.07, 0.09, mx + nx * 0.36, 0.2, mz + nz * 0.36, 0x6b6f78, [0, ang, 0]), bx(len + 0.04, 0.07, 0.09, mx - nx * 0.36, 0.2, mz - nz * 0.36, 0x6b6f78, [0, ang, 0]));
      }
    }, { flat: true });
    chunk('station', 2, 7, -3.5, 6.0, function (o) {
      var a = o.lit;
      a.push(gb(7.6, 0.3, 1.2, 0, -1.0, 0xb9b6ad), gb(4.2, 1.8, 1.8, 0, 0.6, 0xe6dcc3), gb(4.26, 0.4, 1.86, 0, 0.6, 0x8a4532), pr(2.3, 0.9, 4.7, 0, 1.8, 0.6, 0x8a4a3a, PI / 2));
      a.push(bx(7.0, 0.08, 1.3, 0, 1.75, -1.0, 0x6b6f78), bx(0.1, 1.5, 0.1, -3.2, 1.0, -1.0, 0x5a4632), bx(0.1, 1.5, 0.1, 0, 1.0, -1.0, 0x5a4632), bx(0.1, 1.5, 0.1, 3.2, 1.0, -1.0, 0x5a4632));
      windows(o, 0, 0.6, 4.2, 1.8, 1.1, 1, 1, 0.6);
    });
    chunk('telegraph', 2, 4, 2, -7.4, function (o) {
      var x; for (x = -18; x <= 18; x += 6) o.lit.push(bx(0.12, 2.7, 0.12, x, 1.35, 0, 0x5a4632), bx(0.08, 0.08, 0.9, x, 2.5, 0, 0x5a4632));
      o.lit.push(bx(36, 0.03, 0.03, 0, 2.56, 0.34, 0x2a2a2a), bx(36, 0.03, 0.03, 0, 2.56, -0.34, 0x2a2a2a));
    });

    // 電気:舗装した通り、街灯、市電、煉瓦の町、電線、ラジオ塔
    chunk('streets', 3, 7, 0, 0, function (o) {
      var a = o.lit, AS = 0x5a5e66, SW = 0xb9b6ad, z;
      a.push(gb(40, 0.09, 3.6, 2, -5, AS), gb(2.6, 0.09, 20.1, 3, -2.45, AS), gb(2.6, 0.09, 5.6, 3, 18.2, AS));
      a.push(gb(40, 0.13, 0.3, 2, -3.05, SW), gb(40, 0.13, 0.3, 2, -6.95, SW), gb(40, 0.05, 0.07, 2, -4.72, 0x8a8f96, 0.07), gb(40, 0.05, 0.07, 2, -5.28, 0x8a8f96, 0.07));
      for (z = -11.5; z < 7; z += 1.6) if (z < -7.2 || z > -2.8) a.push(gb(0.1, 0.02, 0.8, 3, z, 0xe8e8e0, 0.085));
    }, { flat: true });
    chunk('lamps', 3, 7, 0, 0, function (o) {
      var x, s, z;
      for (x = -15; x <= 20; x += 7) for (s = -1; s <= 1; s += 2) { z = -5 + s * 2.05; o.lit.push(bx(0.1, 2.4, 0.1, x, 1.2, z, 0x33363c), bx(0.1, 0.08, 0.5, x, 2.36, z - s * 0.22, 0x33363c)); }
      [-11, 0.2, 5.6, 17.5].forEach(function (zz) { o.lit.push(bx(0.1, 2.4, 0.1, 4.6, 1.2, zz, 0x33363c)); });
    });
    (function () { var x, s; for (x = -15; x <= 20; x += 7) for (s = -1; s <= 1; s += 2) light(3, 7, x, 2.25, -5 + s * 1.62, 0.34, 0.2, 0.34, 0xf2efe2, 0xffe08a, null, 1.5); [-11, 0.2, 5.6, 17.5].forEach(function (zz) { light(3, 7, 4.6, 2.5, zz, 0.3, 0.24, 0.3, 0xf2efe2, 0xffe08a, null, 1.4); }); })();
    var BLOCKS = [[-3.15, -9.9], [9.65, -9.9], [-3.15, -0.55], [9.65, -0.55]];
    var BRICK = [[[-2.9, 0, 2.6, 4.2, 3.8, 0xa5553c, 1], [0.3, -0.2, 2.9, 3.6, 2.7, 0xe3d6b8, 0], [3.1, 0.2, 2.4, 4.4, 4.4, 0x8f4a36, 1]], [[-3.3, 0.1, 2.9, 4.2, 4.6, 0xa8a399, 0], [0, 0, 2.6, 3.8, 2.9, 0xa5553c, 1], [3.2, -0.2, 2.9, 4.0, 3.6, 0xe3d6b8, 1]],
      [[-2.9, 0, 2.6, 3.4, 2.8, 0xe3d6b8, 1], [0.3, 0, 2.8, 3.4, 4.0, 0xa5553c, 0], [3.1, 0.1, 2.4, 3.2, 3.0, 0xa8a399, 1]], [[-3.3, 0, 2.8, 3.4, 3.4, 0x8f4a36, 1], [0.1, 0, 2.6, 3.2, 4.6, 0xe3d6b8, 0], [3.3, 0, 2.8, 3.4, 2.8, 0xa5553c, 1]]];
    var HIGH = [[[-2.9, 0, 2.6, 3.6, 9, 0x8fa9bf], [0.3, -0.3, 2.8, 3.2, 13, 0xe4e8ea], [3.1, 0.2, 2.4, 3.8, 7, 0xcfc6b4]], [[-3.3, 0.1, 2.8, 3.6, 11, 0xdfe3e6], [0, 0, 2.6, 3.4, 7.5, 0x6f8196], [3.2, -0.2, 2.9, 3.4, 14, 0x9fb7c9]],
      [[-2.9, 0, 2.6, 3.2, 6, 0xcfc6b4], [0.3, 0, 2.8, 3.2, 10, 0x7f93a8], [3.1, 0.1, 2.4, 3.0, 8, 0xe4e8ea]], [[-3.3, 0, 2.8, 3.2, 12, 0xa7bccb], [0.1, 0, 2.6, 3.0, 6.5, 0xe4e8ea], [3.3, 0, 2.8, 3.2, 9, 0x6f8196]]];
    BLOCKS.forEach(function (bk, i) {
      chunk('brick' + i, 3, 4, bk[0], bk[1], function (o) { BRICK[i].forEach(function (h) { house(o, h[0], h[1], h[2], h[3], h[4], h[5], h[6]); }); });
    });
    chunk('mast', 3, 7, 21, 3.6, function (o) {
      var a = o.lit, i; a.push(gb(1.6, 1.0, 1.6, 0, 0, 0xb9b6ad));
      for (i = 0; i < 4; i++) a.push(fr(0.5 - i * 0.1, 0.62 - i * 0.1, 2.2, 0, 1.0 + i * 2.2, 0, i % 2 ? 0xf4f1ea : 0xc8452d));
      a.push(bx(0.06, 1.6, 0.06, 0, 10.6, 0, 0x33363c), bx(1.6, 0.05, 0.05, 0, 8.4, 0, 0x33363c), bx(0.05, 0.05, 1.6, 0, 7.6, 0, 0x33363c));
    });
    light(3, 7, 21, 11.5, 3.6, 0.26, 0.26, 0.26, 0xd04030, 0xff4030, [1.6, 0.5], 1.2);
    chunk('power', 3, 4, 4.9, -3, function (o) {
      var z; for (z = -9; z <= 9; z += 4.5) o.lit.push(bx(0.14, 3.4, 0.14, 0, 1.7, z, 0x5a4632), bx(1.1, 0.08, 0.08, 0, 3.2, z, 0x5a4632), bx(0.8, 0.08, 0.08, 0, 2.8, z, 0x5a4632));
      [-0.45, 0, 0.45].forEach(function (x) { o.lit.push(bx(0.03, 0.03, 18, x, 3.26, 0, 0x2a2a2a)); });
    });

    // 機械:飛行場、コンクリートの橋、石油タンク
    chunk('airstrip', 4, 7, 20, 27.6, function (o) {
      var a = o.lit, x;
      a.push(gb(22, 0.08, 3.2, 0, 0, 0x4b4f58)); for (x = -9.5; x <= 9.5; x += 2.4) a.push(gb(1.1, 0.02, 0.14, x, 0, 0xe8e8e0, 0.075));
      a.push(gb(3.8, 1.7, 3.0, -7.6, -4.6, 0xb9c0c6), cy(1.9, 1.9, 3.0, 12, -7.6, 1.7, -4.6, 0x8f979e, [PI / 2, 0, 0], [1, 1, 0.55]), bx(2.6, 1.3, 0.06, -7.6, 0.65, -3.08, 0x3a4450));
      a.push(bx(0.08, 2.2, 0.08, 9.6, 1.1, -2.4, 0xe9e9e4), co(0.2, 0.9, 6, 10.1, 2.1, -2.4, 0xe2762d, [0, 0, -PI / 2]));
    });
    chunk('bridge1', 4, 8, BRX, BRZ, function (o) {
      var a = o.lit, C = 0xc3c6c8, s;
      a.push(bx(2.9, 0.3, 8.4, 0, 0.27, 0, C), bx(2.9, 0.3, 1.3, 0, 0.16, 4.75, C, [0.2, 0, 0]), bx(2.9, 0.3, 1.3, 0, 0.16, -4.75, C, [-0.2, 0, 0]), gb(2.4, 0.4, 0.6, 0, 1.4, 0x9a9da0), gb(2.4, 0.4, 0.6, 0, -1.4, 0x9a9da0));
      for (s = -1; s <= 1; s += 2) a.push(bx(0.16, 0.36, 8.4, s * 1.37, 0.6, 0, 0xdadcdd));
      a.push(bx(2.5, 0.02, 8.4, 0, 0.43, 0, 0x5a5e66));
    });
    chunk('oil', 4, 7, -25.6, -1.2, function (o) {
      var a = o.lit;
      [[-1.6, -2.4, 1.7, 2.6], [1.9, -1.2, 1.5, 2.2], [-1.2, 1.8, 1.9, 2.4]].forEach(function (t) { a.push(cy(t[2], t[2], t[3], 14, t[0], t[3] / 2, t[1], 0xe4e6e8), cy(t[2] * 0.96, t[2], 0.18, 14, t[0], t[3] + 0.09, t[1], 0xbfc4c8), bx(0.08, t[3], 0.3, t[0] + t[2], t[3] / 2, t[1], 0x8a8f96)); });
      a.push(cy(0.12, 0.12, 5.4, 6, 1.6, 0.5, 0.4, 0x8a8f96, [PI / 2, 0.5, 0]), gb(1.4, 1.0, 1.2, 2.9, 2.6, 0x8a4532), cy(0.1, 0.14, 4.4, 6, 3.6, 2.2, 3.4, 0x8a8f96));
      o.glow.push(co(0.18, 0.6, 6, 3.6, 4.7, 3.4, 0xffb23a));
    });

    // 現代:高い建物、高速道路、赤白の塔
    BLOCKS.forEach(function (bk, i) {
      chunk('high' + i, 5, 7, bk[0], bk[1], function (o) { HIGH[i].forEach(function (h) { tower(o, h[0], h[1], h[2], h[3], h[4], h[5]); }); });
    });
    chunk('highway', 5, 7, 0, -14.5, function (o) {
      var a = o.lit, C = 0xc3c6c8, x;
      a.push(bx(66, 0.36, 2.7, 0, 3.3, 0, C), bx(66, 0.3, 0.16, 0, 3.62, 1.3, 0xdadcdd), bx(66, 0.3, 0.16, 0, 3.62, -1.3, 0xdadcdd), bx(66, 0.02, 2.3, 0, 3.49, 0, 0x4b4f58), bx(66, 0.01, 0.08, 0, 3.505, 0, 0xe8e8e0));
      for (x = -30; x <= 30; x += 6) a.push(gb(0.6, 3.15, 1.3, x, 0, 0xaeb1b4), bx(0.9, 0.3, 2.3, x, 3.0, 0, 0xaeb1b4));
    });
    chunk('tower', 5, 7, -4, -18.2, function (o) {
      var a = o.lit, RD = 0xe2492d, WH = 0xf4f1ea, s, t;
      for (s = -1; s <= 1; s += 2) for (t = -1; t <= 1; t += 2) a.push(bx(0.3, 5.0, 0.3, s * 1.55, 2.4, t * 1.55, RD, [t * -0.2, 0, s * 0.2]));
      a.push(bx(3.3, 0.22, 0.22, 0, 2.3, 1.55, WH), bx(3.3, 0.22, 0.22, 0, 2.3, -1.55, WH), bx(0.22, 0.22, 3.3, 1.55, 2.3, 0, WH), bx(0.22, 0.22, 3.3, -1.55, 2.3, 0, WH));
      a.push(fr(1.5, 2.2, 2.4, 0, 4.7, 0, WH), gb(2.3, 0.7, 2.3, 0, 0, 0xf4f1ea, 7.1), gb(2.0, 0.3, 2.0, 0, 0, 0x27303f, 7.3), fr(0.95, 1.5, 3.0, 0, 7.8, 0, RD), fr(0.55, 0.95, 2.8, 0, 10.8, 0, WH), fr(0.3, 0.55, 2.2, 0, 13.6, 0, RD), bx(0.1, 2.2, 0.1, 0, 16.9, 0, WH));
    });
    light(5, 7, -4, 18.1, -18.2, 0.28, 0.28, 0.28, 0xd04030, 0xff4030, [1.4, 0.5], 1.3);
    light(5, 7, -2.8, 7.5, -17, 0.2, 0.2, 0.2, 0xd04030, 0xff4030, [1.4, 0.5], 0.9); light(5, 7, -5.2, 7.5, -19.4, 0.2, 0.2, 0.2, 0xd04030, 0xff4030, [1.4, 0.5], 0.9);

    // 情報:パラボラ、窓のない計算機の館、ロケット
    chunk('dishes', 6, 7, 17.4, 20, function (o) {
      var a = o.lit;
      [[-2.2, -0.9, 1.0, 0.5], [2.2, 1.2, 0.8, -0.7]].forEach(function (d) {
        var k = d[2], g = merge([cy(1.7, 0.45, 0.5, 14, 0, 0, 0, 0xf1f3f5), cy(1.62, 1.62, 0.04, 14, 0, 0.26, 0, 0xdfe3e6), bx(0.06, 1.2, 0.06, 0, 0.8, 0, 0x8a8f96), bx(0.22, 0.22, 0.22, 0, 1.4, 0, 0x33363c)]);
        a.push(cy(0.3, 0.45, 1.7 * k, 8, d[0], 0.85 * k, d[1], 0xdfe3e6), P(g, d[0], 1.9 * k, d[1], null, [0.75, d[3], 0], [k, k, k]));
      });
      a.push(gb(2.0, 1.1, 1.4, 0.2, -2.6, 0xdfe3e6), gb(2.06, 0.2, 1.46, 0.2, -2.6, 0x2b3d61, 0.7));
    });
    chunk('datacenter', 6, 7, 19.2, -10, function (o) {
      var a = o.lit, x;
      a.push(gb(7.2, 3.2, 4.6, 0, 0, 0xdfe3e7), bx(7.24, 0.5, 4.64, 0, 2.4, 0, 0x2b3d61), gb(7.3, 0.14, 4.7, 0, 0, 0x8a8f96, 3.2), gb(0.9, 1.6, 0.06, -2.6, 2.32, 0x33363c));
      for (x = -2.4; x <= 2.4; x += 1.6) a.push(gb(1.0, 0.6, 1.0, x, -0.4, 0x9aa1a8, 3.34), cy(0.36, 0.36, 0.04, 10, x, 3.97, -0.4, 0x33363c));
    });
    (function () { var i, j, cols = [0x6fe08a, 0x6fb8ff, 0xffb86b]; for (i = 0; i < 9; i++) for (j = 0; j < 2; j++) { light(6, 7, 19.2 - 2.8 + i * 0.7, 1.1 + j * 0.5, -10 + 2.33, 0.2, 0.12, 0.08, cols[(i + j) % 3], null, [0.5 + R() * 1.3, 0.45 + R() * 0.3]); light(6, 7, 19.2 - 2.8 + i * 0.7, 1.1 + j * 0.5, -10 - 2.33, 0.2, 0.12, 0.08, cols[(i + j + 1) % 3], null, [0.5 + R() * 1.3, 0.5]); } })();
    emitter(6, 7, 19.2, 4.1, -10.4, 0.7, 0.5, 0.96, 1.2);
    chunk('pad', 6, 7, 24, 19.5, function (o) {
      var a = o.lit, y;
      a.push(gb(4.6, 0.25, 4.6, 0, 0, 0xc3c6c8), gb(1.4, 0.02, 1.4, 0, 0, 0x33363c, 0.25), bx(0.5, 7.2, 0.5, -1.5, 3.85, 0, 0xc8452d));
      for (y = 1.6; y < 7.5; y += 1.5) a.push(bx(0.9, 0.12, 0.12, -1.0, y, 0, 0xe9e9e4));
      a.push(bx(0.06, 9, 0.06, 2.0, 4.5, 1.9, 0x8a8f96), bx(0.06, 9, 0.06, 2.0, 4.5, -1.9, 0x8a8f96));
    }, { after: function (g) {
      M.rocket = new T.Mesh(geo('rocket', rocketGeo), MAT.vc); M.rocket.position.set(0, 0.25, 0); g.add(M.rocket);
      M.flame = new T.Mesh(keep(merge([P(new T.ConeGeometry(0.36, 1.7, 8), 0, -0.85, 0, 0xffc04a, [PI, 0, 0]), P(new T.ConeGeometry(0.2, 1.0, 8), 0.6, 0.0, 0, 0xffe08a, [PI, 0, 0]), P(new T.ConeGeometry(0.2, 1.0, 8), -0.6, 0.0, 0, 0xffe08a, [PI, 0, 0])])), MAT.glow); M.flame.visible = false; M.rocket.add(M.flame);
    } });
    light(6, 7, 22.5, 7.8, 19.5, 0.22, 0.22, 0.22, 0xd04030, 0xff4030, [1.2, 0.5], 1.0);

    // 人工知能:どの建物の前にも小さな端末。ダリオくんの弟や妹たち
    var TERM = [[-7.2, -7.0], [-0.2, -7.0], [5.6, -7.0], [13.4, -7.0], [-7.2, -3.0], [-0.2, -3.0], [5.6, -3.0], [13.4, -3.0], [4.8, -12.2], [1.3, 1.6], [-7.6, 7.2], [0.9, 7.2], [-10.6, -8.6], [15, -7.2], [12.2, -25.2], [24.2, -21], [-9.6, 16.4], [10.6, 23],
      [4.9, 16.6], [-17.2, -16.8], [20, 16.4], [-21.6, -1.4]];
    chunk('terminals', 7, 7, 0, 0, function (o) { TERM.forEach(function (t) { o.lit.push(bx(0.14, 1.0, 0.14, t[0], 0.5, t[1], 0x33363c), gb(0.56, 0.46, 0.2, t[0], t[1], 0xefe8da, 1.0)); }); });
    TERM.forEach(function (t) { light(7, 7, t[0], 1.23, t[1], 0.42, 0.3, 0.26, 0xffb86b, 0xffb86b, null, 0.9); });
    chunk('minis', 7, 7, 0, 0, function (o) {
      var gl = geo('dario', darioGeo), gf = geo('darioFaceAll', function () { return merge([put(darioFace(false), 0, 0, 0), put(darioEyes(false), 0, 2.95, 0.94)]); });
      [[0.6, -8.0, 0.6], [5.5, -2.1, -2.4], [-6.8, 7.9, 0.3], [5.2, 18.6, -0.4], [16.6, -1.2, -1.2]].forEach(function (d) { o.lit.push(put(gl, d[0], 0, d[1], d[2], 0.5)); o.glow.push(put(gf, d[0], 0, d[1], d[2], 0.5)); });
    });

    // 調和:白く、左右対称で、静か
    var HX = 3, HZ = -5;
    chunk('harmony', 8, 8, HX, HZ, function (o) {
      var a = o.lit, WH = 0xf3f5f7, i, s, t;
      a.push(gb(23.5, 0.14, 23.5, 0, 0, 0xeef1f4, 0.09), gb(23.5, 0.02, 0.5, 0, 0, 0xd5dde6, 0.23), gb(0.5, 0.02, 23.5, 0, 0, 0xd5dde6, 0.23));
      a.push(cy(2.6, 3.0, 0.7, 8, 0, 0.58, 0, WH), cy(0.75, 1.35, 20, 8, 0, 10.9, 0, WH), cy(1.5, 1.5, 0.3, 8, 0, 7.5, 0, 0xdfe6ee), cy(1.2, 1.2, 0.3, 8, 0, 14, 0, 0xdfe6ee), cy(1.1, 0.75, 0.6, 8, 0, 21.2, 0, WH));
      for (s = -1; s <= 1; s += 2) for (t = -1; t <= 1; t += 2) {
        a.push(gb(3.4, 8, 3.4, s * 8, t * 8, WH, 0.23), gb(2.6, 4.5, 2.6, s * 10.3, t * 4.0, WH, 0.23), gb(2.6, 4.5, 2.6, s * 4.0, t * 10.3, WH, 0.23));
        for (i = 0; i < 3; i++) a.push(bx(0.12, 1.6, 0.12, s * (2.2 + i * 3.1), 1.03, t * 11.3, 0xdfe6ee), bx(0.12, 1.6, 0.12, s * 11.3, 1.03, t * (2.2 + i * 3.1), 0xdfe6ee));
      }
    }, { slow: true, after: function (g) {
      var m1 = keep(new T.MeshBasicMaterial({ color: 0x2f8dff, fog: false })), m2 = keep(new T.MeshBasicMaterial({ color: 0x2f8dff, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
      M.orb = new T.Mesh(keep(new T.SphereGeometry(1.5, 16, 12)), m1); M.orb.position.set(0, 23, 0); g.add(M.orb);
      M.orbHalo = new T.Mesh(keep(new T.SphereGeometry(3.6, 16, 12)), m2); M.orbHalo.position.set(0, 23, 0); g.add(M.orbHalo);
    } });
    (function () { var s, t; for (s = -1; s <= 1; s += 2) for (t = -1; t <= 1; t += 2) { light(8, 8, HX + s * 8, 6.6, HZ + t * 8, 3.46, 0.12, 3.46, 0x9fd0ff); light(8, 8, HX + s * 10.3, 3.6, HZ + t * 4.0, 2.66, 0.1, 2.66, 0x9fd0ff); light(8, 8, HX + s * 4.0, 3.6, HZ + t * 10.3, 2.66, 0.1, 2.66, 0x9fd0ff); } })();

    // ── 禁断の手術のあと ──
    function sign(text, w, hgt, fg, bg) { // 看板(面は +z を向く)
      var cv = document.createElement('canvas'), c2, fs;
      cv.width = 512; cv.height = Math.max(32, Math.round(512 * hgt / w)); c2 = cv.getContext('2d');
      c2.fillStyle = bg; c2.fillRect(0, 0, cv.width, cv.height); c2.fillStyle = fg; c2.textAlign = 'center'; c2.textBaseline = 'middle';
      fs = Math.round(cv.height * 0.62); c2.font = '900 ' + fs + 'px sans-serif';
      while (c2.measureText(text).width > cv.width * 0.92 && fs > 10) { fs -= 2; c2.font = '900 ' + fs + 'px sans-serif'; }
      c2.fillText(text, cv.width / 2, cv.height / 2 + fs * 0.04);
      return new T.Mesh(keep(new T.PlaneGeometry(w, hgt)), keep(new T.MeshBasicMaterial({ map: keep(new T.CanvasTexture(cv)), fog: false })));
    }
    // 鳥の世:町はそのまま、屋根という屋根に止まり木と巣箱。塔の上に大きな巣。空には群れ
    chunk('perches', 9, 9, 0, 0, function (o) {
      var a = o.lit, i, x, z, W = 0x8a6a48, C = [0xf7f5f0, 0x26262b, 0xb9895f, 0x8e96a3, 0x7cc35a, 0xf2df5a];
      function perch(px, pz, ry) {
        a.push(cy(0.07, 0.09, 2.6, 6, px, 1.3, pz, W), bx(1.5, 0.08, 0.08, px, 2.6, pz, W, [0, ry, 0]));
        for (var k = -1; k <= 1; k++) if (R() < 0.8) { var ox = Math.cos(ry) * k * 0.5, oz = -Math.sin(ry) * k * 0.5, c = C[Math.floor(R() * C.length)]; a.push(sp(0.17, px + ox, 2.82, pz + oz, c, [1, 1.15, 1.2]), sp(0.11, px + ox, 3.02, pz + oz + 0.05, c), co(0.045, 0.12, 5, px + ox, 3.0, pz + oz + 0.17, 0xe8707e, [PI / 2, 0, 0])); }
      }
      function nest(px, pz) { a.push(cy(0.06, 0.08, 2.0, 6, px, 1.0, pz, W), bx(0.6, 0.6, 0.5, px, 2.3, pz, 0xc9a45a), pr(0.78, 0.3, 0.64, px, 2.6, pz, 0xb3262f), cy(0.11, 0.11, 0.05, 10, px, 2.32, pz + 0.26, 0x2a1a1a, [PI / 2, 0, 0])); }
      for (i = 0; i < 9; i++) { x = -15 + i * 4.2; perch(x, -3.3, 0); if (i % 2) nest(x + 2, -6.8); }
      for (i = 0; i < 5; i++) { z = -11 + i * 3.6; perch(4.9, z, PI / 2); if (i % 2 === 0) nest(1.2, z + 1.5); }
      for (i = 0; i < 5; i++) perch(-5 + i * 3.2, 19.2, 0);
      a.push(cy(1.9, 1.3, 0.8, 10, -4, 9.2, -18.2, 0x9a7a48), cy(1.5, 1.5, 0.2, 10, -4, 9.55, -18.2, 0x6f5536), sp(0.75, -4, 10.1, -18.2, 0xfbf7ee, [1, 1.3, 1]), sp(0.6, -3.2, 9.95, -17.8, 0xfbf7ee, [1, 1.3, 1]));
    }, { after: function (g) {
      var fl = new T.Group(), i, m, an, rr, gg = geo('flockBird', function () { return merge([sp(0.22, 0, 0, 0, 0xffffff, [1, 0.9, 1.5]), bx(1.3, 0.05, 0.42, 0, 0.05, 0, 0xe9e4da), co(0.07, 0.2, 5, 0, 0, 0.36, 0xe8707e, [PI / 2, 0, 0])]); });
      for (i = 0; i < 14; i++) { m = new T.Mesh(gg, MAT.vc); an = i / 14 * TAU; rr = 9 + (i % 3) * 2.2; m.position.set(Math.cos(an) * rr, 11 + (i % 4) * 1.1, Math.sin(an) * rr); m.rotation.y = -an + PI; fl.add(m); }
      fl.position.set(3, 0, -5); g.add(fl); M.flock = fl;
    } });
    // ガチの世:町のまん中に闘技場。まわりに、筋肉の像、人工生殖プラント、ブン・リーグの球場
    chunk('bun_ring', 10, 10, HX, HZ, function (o) {
      var a = o.lit, i, s, t, u, d, hh, ry, cx, cz, K = 0x2a2c33, RD = 0xb3262f, WH = 0xf0ece2, ST = 0x4b505b, C = [0xf2f0ea, 0x26262b, 0xd9bf9e, 0x8e9299, 0xc4c9d1, 0x1c1c20];
      a.push(gb(25, 0.14, 25, 0, 0, K, 0.09), gb(25, 0.02, 0.6, 0, 0, RD, 0.23), gb(0.6, 0.02, 25, 0, 0, RD, 0.23));
      a.push(gb(6.6, 0.62, 6.6, 0, 0, RD, 0.23), gb(6.2, 0.12, 6.2, 0, 0, WH, 0.85));
      for (s = -1; s <= 1; s += 2) for (t = -1; t <= 1; t += 2) a.push(cy(0.13, 0.13, 1.5, 8, s * 2.95, 1.72, t * 2.95, s * t > 0 ? RD : 0x2b3d61));
      for (i = 0; i < 3; i++) for (s = -1; s <= 1; s += 2) a.push(bx(5.9, 0.05, 0.05, 0, 1.3 + i * 0.4, s * 2.95, i === 1 ? WH : RD), bx(0.05, 0.05, 5.9, s * 2.95, 1.3 + i * 0.4, 0, i === 1 ? WH : RD));
      for (s = 0; s < 4; s++) { // 四方の客席(三段)と、客
        ry = s * PI / 2; cx = Math.sin(ry); cz = Math.cos(ry);
        for (i = 0; i < 3; i++) {
          d = 9.4 + i * 1.5; hh = 0.8 + i * 0.8;
          a.push(P(new T.BoxGeometry(15, hh, 1.5), cx * d, 0.23 + hh / 2, cz * d, ST, [0, ry, 0]));
          for (t = 0; t < 11; t++) if (R() < 0.85) { u = (t - 5) * 1.3 + (R() - 0.5) * 0.3; a.push(P(new T.BoxGeometry(0.62, 0.7, 0.45), cx * d + cz * u, 0.23 + hh + 0.35, cz * d - cx * u, C[Math.floor(R() * C.length)], [0, ry, 0])); }
        }
      }
      for (s = -1; s <= 1; s += 2) for (t = -1; t <= 1; t += 2) { // 照明塔と旗
        a.push(cy(0.22, 0.3, 10, 6, s * 12, 5.2, t * 12, 0x30343c), bx(2.2, 1.2, 0.4, s * 12, 10.6, t * 12, 0x30343c, [0, Math.atan2(-s, -t), 0]));
        a.push(cy(0.05, 0.05, 4.2, 5, s * 8.4, 2.3, t * 12.3, 0x30343c), bx(0.06, 2.4, 0.9, s * 8.4, 3.1, t * 11.8, RD));
      }
      a.push(bx(10.4, 2.9, 0.4, 0, 8.2, -13.6, 0x15171c), bx(0.4, 6.8, 0.4, -4.4, 3.5, -13.6, 0x30343c), bx(0.4, 6.8, 0.4, 4.4, 3.5, -13.6, 0x30343c));
    }, { slow: true, after: function (g) {
      var sg = sign('G.A.C.H.I Fight', 10, 2.5, '#f6d77a', '#15171c'); sg.position.set(0, 8.2, -13.38); g.add(sg);
      function fighter(body, head, trunk) { // 闘士。胸と肩が大きい
        var m = new T.Mesh(keep(merge([
          bx(0.34, 0.8, 0.36, -0.24, 0.4, 0, trunk), bx(0.34, 0.8, 0.36, 0.24, 0.4, 0, trunk), bx(0.9, 0.5, 0.5, 0, 0.98, 0, body), bx(1.25, 0.7, 0.62, 0, 1.5, 0, body),
          sp(0.3, -0.75, 1.72, 0, body), sp(0.3, 0.75, 1.72, 0, body), bx(0.26, 0.6, 0.28, -0.82, 1.3, 0.2, body, [-0.9, 0, 0]), bx(0.26, 0.6, 0.28, 0.82, 1.3, 0.2, body, [-0.9, 0, 0]),
          sp(0.19, -0.82, 1.38, 0.55, 0xb3262f), sp(0.19, 0.82, 1.38, 0.55, 0xb3262f), sp(0.36, 0, 2.12, 0.02, head, [1, 0.95, 1]), co(0.13, 0.3, 6, 0, 2.08, 0.42, 0xe8707e, [PI / 2, 0, 0]),
          bx(0.03, 0.2, 0.24, -0.345, 2.05, 0.08, 0xffffff), bx(0.03, 0.2, 0.24, 0.345, 2.05, 0.08, 0xffffff)])), MAT.vc), grp = new T.Group();
        m.scale.set(1.25, 1.25, 1.25); grp.add(m); g.add(grp); return grp;
      }
      var fa = fighter(0x2b2b30, 0x1c1c20, 0x15171c), fb = fighter(0xf2f0ea, 0xf7f5f0, 0x2b3d61);
      fa.children[0].rotation.y = PI / 2; fb.children[0].rotation.y = -PI / 2; M.fight = [fa, fb];
    } });
    (function () { var s, t; for (s = -1; s <= 1; s += 2) for (t = -1; t <= 1; t += 2) light(10, 10, HX + s * 11.7, 10.6, HZ + t * 11.7, 1.9, 0.95, 0.5, 0xfff2c0, 0xfff6d8, null, 1.5); })();
    chunk('bun_statue', 10, 10, -8.5, -16, function (o) { // 力こぶを見せる、金の像
      var a = o.lit, G = 0xd9b24c, Gd = 0xb08a2c;
      a.push(gb(5, 1.6, 5, 0, 0, 0x30343c), gb(4.2, 0.5, 4.2, 0, 0, 0x4b505b, 1.6));
      a.push(bx(0.9, 2.6, 1.0, -0.75, 3.4, 0, G), bx(0.9, 2.6, 1.0, 0.75, 3.4, 0, G), bx(2.6, 1.3, 1.3, 0, 5.3, 0, G), bx(3.6, 1.9, 1.6, 0, 6.8, 0, G), sp(0.85, -2.1, 7.5, 0, G), sp(0.85, 2.1, 7.5, 0, G),
        bx(0.75, 1.5, 0.8, -2.75, 8.0, 0, Gd, [0, 0, 0.5]), bx(0.75, 1.5, 0.8, 2.75, 8.0, 0, Gd, [0, 0, -0.5]), sp(0.62, -3.05, 8.2, 0, G), sp(0.62, 3.05, 8.2, 0, G),
        bx(0.6, 1.4, 0.65, -2.5, 9.3, 0, Gd, [0, 0, -0.6]), bx(0.6, 1.4, 0.65, 2.5, 9.3, 0, Gd, [0, 0, 0.6]), sp(0.45, -2.0, 9.9, 0, G), sp(0.45, 2.0, 9.9, 0, G),
        sp(1.05, 0, 8.7, 0.05, G, [1, 0.95, 1]), co(0.38, 0.9, 6, 0, 8.6, 1.2, Gd, [PI / 2, 0, 0]));
    }, { slow: true });
    chunk('bun_plant', 10, 10, 20, -24, function (o) { // 人工生殖プラント。育成槽が並ぶ
      var a = o.lit, gl = o.glow, i, x, K = 0x30343c;
      a.push(gb(15, 0.2, 9.5, 0, 0, 0x22252b), gb(13, 3.2, 3.4, 0, -2.6, K), gb(13.4, 0.3, 3.8, 0, -2.6, 0xb3262f, 3.2), sp(2.3, -4.4, 3.4, -2.6, 0x4b505b, [1, 0.8, 1]), cy(0.35, 0.35, 5.5, 8, 5.2, 4.2, -2.9, 0x4b505b));
      for (i = 0; i < 8; i++) { x = -5.6 + i * 1.6; a.push(cy(0.55, 0.62, 0.3, 10, x, 0.35, 1.3, K), cy(0.55, 0.55, 0.2, 10, x, 2.6, 1.3, K), bx(0.12, 0.12, 2.6, x, 2.8, -0.1, 0x4b505b)); gl.push(cy(0.46, 0.46, 2.05, 10, x, 1.52, 1.3, i % 3 === 1 ? 0xffb3c0 : 0x8fe6d8)); }
      for (i = 0; i < 6; i++) { x = -4 + i * 1.6; a.push(cy(0.45, 0.5, 0.25, 10, x, 0.33, 3.3, K)); gl.push(cy(0.38, 0.38, 1.6, 10, x, 1.25, 3.3, 0x8fe6d8)); }
      a.push(bx(7.4, 1.3, 0.25, 0, 4.6, -0.82, 0x15171c));
    }, { slow: true, after: function (g) { var sg = sign('人工生殖プラント', 7, 1.1, '#8fe6d8', '#15171c'); sg.position.set(0, 4.6, -0.68); g.add(sg); } });
    chunk('bun_park', 10, 10, 22, 19.5, function (o) { // ブン・リーグの球場
      var a = o.lit, i, an, sx, G = 0x3f8f4f;
      a.push(cy(7.4, 7.4, 0.16, 20, 0, 0.1, 0, 0x2f6f3f), cy(6.9, 6.9, 0.04, 20, 0, 0.2, 0, G));
      a.push(P(new T.BoxGeometry(3.6, 0.05, 3.6), 0, 0.22, 1.6, 0xb9895f, [0, PI / 4, 0]), P(new T.BoxGeometry(2.7, 0.06, 2.7), 0, 0.23, 1.6, G, [0, PI / 4, 0]), cy(0.4, 0.5, 0.12, 10, 0, 0.27, 1.6, 0xb9895f));
      [[0, 4.15], [2.55, 1.6], [0, -0.95], [-2.55, 1.6]].forEach(function (b2) { a.push(bx(0.34, 0.08, 0.34, b2[0], 0.27, b2[1], 0xffffff)); });
      for (i = 0; i < 9; i++) { an = PI + (i - 4) * 0.2; a.push(P(new T.BoxGeometry(1.5, 1.3, 0.2), Math.sin(an) * 6.9, 0.85, Math.cos(an) * 6.9, 0x2b3d61, [0, an, 0])); }
      a.push(bx(4.6, 2.2, 0.3, 0, 3.7, -6.2, 0x15171c), bx(0.3, 2.8, 0.3, -1.8, 1.4, -6.2, 0x30343c), bx(0.3, 2.8, 0.3, 1.8, 1.4, -6.2, 0x30343c));
      for (i = 0; i < 2; i++) { sx = i ? 1 : -1; a.push(P(new T.BoxGeometry(5.5, 1.4, 1.4), sx * 5.4, 0.9, 4.6, 0x4b505b, [0, sx * -0.75, 0])); }
    }, { slow: true, after: function (g) { var sg = sign('BUN LEAGUE', 4.4, 1.9, '#ffffff', '#15171c'); sg.position.set(0, 3.7, -6.04); g.add(sg); } });
    chunk('bun_town', 10, 10, 0, 0, function (o) { // 黒い棟(屋上に止まり木)と、鉄亜鈴の碑
      var a = o.lit, K = 0x30343c, RD = 0xb3262f;
      [[-16, -8, 3.2, 3.2, 7], [-20.5, -3.5, 3.4, 3, 5], [-15.5, 1.5, 3, 3, 9], [-21, 3, 3, 3.4, 6], [-1.5, -23.5, 3.2, 3.2, 8], [3, -25.5, 3, 3, 5.5], [7.2, -23.5, 3.4, 3, 6.5], [10.6, -26.5, 3, 3, 9], [26, 3.5, 3, 3, 6]].forEach(function (b2, k) {   // 西と北に寄せる(東は、プラントと球場が見えるように空ける)
        tower(o, b2[0], b2[1], b2[2], b2[3], b2[4], k % 2 ? 0x3a3d46 : K);
        a.push(gb(b2[2] + 0.2, 0.3, b2[3] + 0.2, b2[0], b2[1], RD, b2[4] * 0.5), bx(1.2, 0.07, 0.07, b2[0], b2[4] + 1.2, b2[1], 0x8a6a48), cy(0.05, 0.05, 0.7, 5, b2[0], b2[4] + 0.86, b2[1], 0x8a6a48));
      });
      [[-11.5, 8.2], [17.8, 8.4], [-12.2, -20.5]].forEach(function (d2) { a.push(gb(1.8, 0.5, 1.2, d2[0], d2[1], 0x4b505b), bx(2.4, 0.22, 0.22, d2[0], 1.3, d2[1], 0xc4c9d1), sp(0.55, d2[0] - 1.25, 1.3, d2[1], 0x1c1c20), sp(0.55, d2[0] + 1.25, 1.3, d2[1], 0x1c1c20)); });
    }, { slow: true });

    // ダリオくんのラックの灯り(駐屯地。端末は -x を向いている)
    var DX = 6.8, DZ = 24.7, DR = -0.55, DS = 1.05;
    [[-0.55, 0x6fe08a, 0.9], [-0.3, 0xffb86b, 1.7], [-0.05, 0x6fe08a, 0.6]].forEach(function (l) {
      var x = DX + DS * (l[0] * Math.cos(DR) + 0.73 * Math.sin(DR)), z = DZ + DS * (-l[0] * Math.sin(DR) + 0.73 * Math.cos(DR));
      light(0, 7, x, 0.84 * DS, z, 0.13, 0.13, 0.13, l[1], null, [l[2], 0.6]); light(8, 8, x, 0.84 * DS, z, 0.13, 0.13, 0.13, 0xeef4ff);
    });

    // ── 線路 ──
    function makeLoop(cx, cz, rx, rz, n) {
      var fine = 2880, len = [0], i, px = cx + rx, pz = cz, total = 0, x, z, a;
      for (i = 1; i <= fine; i++) { a = i / fine * TAU; x = cx + rx * Math.cos(a); z = cz + rz * Math.sin(a); total += Math.sqrt((x - px) * (x - px) + (z - pz) * (z - pz)); len.push(total); px = x; pz = z; }
      var out = { n: n, x: new Float32Array(n), z: new Float32Array(n), len: total }, j = 0;
      for (i = 0; i < n; i++) { var want = i / n * total; while (j < fine - 1 && len[j + 1] < want) j++; a = (j + (want - len[j]) / (len[j + 1] - len[j])) / fine * TAU; out.x[i] = cx + rx * Math.cos(a); out.z[i] = cz + rz * Math.sin(a); }
      return out;
    }
    function onLoop(s) { // 線路の上の位置(s は進んだ距離)
      var u = ((s % LOOP.len) + LOOP.len) % LOOP.len / LOOP.len * LOOP.n, i = Math.floor(u), f = u - i, j = (i + 1) % LOOP.n; i = i % LOOP.n;
      return { x: LOOP.x[i] + (LOOP.x[j] - LOOP.x[i]) * f, z: LOOP.z[i] + (LOOP.z[j] - LOOP.z[i]) * f, a: Math.atan2(LOOP.x[j] - LOOP.x[i], LOOP.z[j] - LOOP.z[i]) };
    }
    function bridgeH(x, z) { // 橋の上を歩く高さ
      if (Math.abs(x - BRX) > 1.6) return 0;
      var d = Math.abs(z - BRZ);
      return inR(4, 8) ? 0.44 * clamp((5.4 - d) / 1.3, 0, 1) : 1.02 * clamp((4.2 - d) / 2.6, 0, 1);
    }

    // ── かたまりを作る・出し入れする ──
    function build(c) {
      var o = { lit: [], glow: [], win: new Quads() }, g, grp = new T.Group();
      c.make(o); grp.position.set(c.x, 0, c.z);
      if (o.lit.length) grp.add(new T.Mesh(keep(merge(o.lit)), MAT.vc));
      if (o.glow.length) grp.add(new T.Mesh(keep(merge(o.glow)), MAT.glow));
      if (o.win.pos.length) { g = keep(new T.BufferGeometry()); g.setAttribute('position', new T.Float32BufferAttribute(o.win.pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(o.win.col, 3)); grp.add(new T.Mesh(g, matWin)); }
      if (c.after) c.after(grp);
      grp.visible = false; scene.add(grp); c.group = grp;
    }
    function applyK(c) {
      var k = c.k, g = c.group; g.visible = k > 0.002; if (!g.visible) return;
      var s = c.flat ? 1 : 0.6 + 0.4 * Math.min(1, k); g.scale.set(s, Math.max(0.002, k), s);
    }

    var DLI = []; (function () { for (var i = 0; i < 8; i++) { DLI.push(light(7, 7, 0, 0, 0, 0.14, 0.1, 0.14, i % 2 ? 0xff5040 : 0x6fe08a, null, [0.9, 0.5])); LT[LT.length - 1].drone = true; } })();

    // ── 木 ──
    var TREES = [];
    (function () {
      function tr(x, z, k, a, b, c, y) { TREES.push({ x: x, z: z, y: y || 0, s: k, a: a, b: b, c: c, k: 0 }); }
      var i, an, r, G = [0x4f8a45, 0x5c9a4c, 0x447a40, 0x6aa353];
      for (i = 0; i < 10; i++) { an = i / 10 * TAU + 0.3; r = 5.0 + R() * 2.6; if (Math.cos(an) > 0.55 && Math.abs(Math.sin(an)) < 0.5) continue; tr(-23.5 + Math.cos(an) * r, -23.5 + Math.sin(an) * r, 0.8 + R() * 0.5, 0, 8, G[i % 4], 5.2 * (8.2 - r) / 4.8); }
      for (i = 0; i < 9; i++) tr(-11 + i * 2.5 + R() * 1.2, -30.6 + R() * 1.6, 0.9 + R() * 0.6, 0, 7, G[i % 4]);
      for (i = 0; i < 6; i++) tr(30 + R() * 1.6, -11 + i * 3 + R(), 0.85 + R() * 0.5, 0, 7, G[(i + 1) % 4]);
      for (i = 0; i < 7; i++) tr(-31 + R() * 2.4, -12 + i * 3.1 + R(), 0.85 + R() * 0.6, 0, i > 1 && i < 6 ? 3 : 7, G[(i + 2) % 4]);
      [[16.5, -1.6], [18.2, 0.2], [16.8, 1.5]].forEach(function (p, j) { tr(p[0], p[1], 0.9 + j * 0.1, 0, 7, G[j]); });
      for (i = 0; i < 9; i++) tr(11 + R() * 20, 15.5 + R() * 8.5, 0.8 + R() * 0.6, 0, 3, G[i % 4]);
      for (i = 0; i < 4; i++) tr(13 + R() * 17, 30.6 + R() * 1.2, 0.9 + R() * 0.4, 0, 7, G[i % 4]);
      [[-12, -17], [-9, -2.5], [16, -14], [20, -5], [-17, -1], [-1, -15.5], [12, -19], [-6, -22]].forEach(function (p, j) { tr(p[0], p[1], 0.8 + (j % 3) * 0.18, 0, j % 2 ? 1 : 2, G[j % 4]); });
      [[-14.6, -26.5], [-15.2, -18.2], [-27.8, -14.6], [-19.5, -14.2]].forEach(function (p) { tr(p[0], p[1], 0.95, 0, 7, 0xf2b6c6); });
      [[-31.3, 12.7], [-24.4, 12.4], [-15.2, 12.5]].forEach(function (p, j) { tr(p[0], p[1], 0.8 + j * 0.1, 0, 4, G[j]); });
    })();
    var treeM = new T.InstancedMesh(geo('tree', treeGeo), MAT.inst, TREES.length); treeM.frustumCulled = false; scene.add(treeM);
    TREES.forEach(function (t, i) { c3.set(t.c); treeM.setColorAt(i, c3); });
    var treesDirty = true;
    function stepTrees(dt) {
      var i, t, want, any = false;
      for (i = 0; i < TREES.length; i++) {
        t = TREES[i]; want = inR(t.a, t.b) ? 1 : 0;
        if (t.k !== want) { t.k = dt < 0 ? want : (want > t.k ? Math.min(1, t.k + dt / 0.7) : Math.max(0, t.k - dt / 0.3)); any = true; }
        var k = t.k <= 0 ? 0 : t.s * (t.k >= 1 ? 1 : back(t.k)); s3.set(k, k, k); v3.set(t.x, t.y, t.z); q4.set(0, 0, 0, 1); m4.compose(v3, q4, s3); treeM.setMatrixAt(i, m4);
      }
      treeM.instanceMatrix.needsUpdate = true; treesDirty = any;
    }

    // ── 灯り ──
    var NH = 0; LT.forEach(function (l) { if (l.halo) l.hi = NH++; });
    var lightM = new T.InstancedMesh(keep(new T.BoxGeometry(1, 1, 1)), keep(new T.MeshBasicMaterial({ color: 0xffffff })), LT.length); lightM.frustumCulled = false; scene.add(lightM);
    var haloMat = keep(new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    var haloM = new T.InstancedMesh(keep(haloGeo()), haloMat, Math.max(1, NH)); haloM.frustumCulled = false; scene.add(haloM);
    (function () { var i; m4.makeScale(0, 0, 0); c3.set(0); for (i = 0; i < LT.length; i++) { lightM.setMatrixAt(i, m4); lightM.setColorAt(i, c3); } for (i = 0; i < Math.max(1, NH); i++) { haloM.setMatrixAt(i, m4); haloM.setColorAt(i, c3); } })();
    function stepLights() {
      var i, l, on, nt = M.night, hk = clamp((nt - 0.3) / 0.4, 0, 1);
      for (i = 0; i < LT.length; i++) {
        l = LT[i];
        if (l.t0 != null && M.t >= l.t0) { l.t0 = null; l.vis = true; if (!l.drone) { m4.makeScale(l.sx, l.sy, l.sz); m4.setPosition(l.x, l.y, l.z); lightM.setMatrixAt(i, m4); } }
        if (!l.vis) continue;
        on = !l.blink || ((M.t + l.ph) % l.blink[0]) < l.blink[0] * l.blink[1];
        c3.copy(l.cd).lerp(l.cn, nt); if (!on) c3.multiplyScalar(0.16);
        lightM.setColorAt(i, c3);
        if (l.hi >= 0) { var r = l.halo * 1.7 * hk * (on ? 1 : 0.3); s3.set(r, r, r); v3.set(l.x, l.y, l.z); m4.compose(v3, cam.quaternion, s3); haloM.setMatrixAt(l.hi, m4); haloM.setColorAt(l.hi, c3); }
      }
      lightM.instanceMatrix.needsUpdate = true; lightM.instanceColor.needsUpdate = true; haloM.instanceMatrix.needsUpdate = true; haloM.instanceColor.needsUpdate = true;
    }
    function setLights(anim) {
      LT.forEach(function (l, i) {
        var want = inR(l.a, l.b);
        if (want && !l.vis && l.t0 == null) l.t0 = M.t + (anim ? (l.a === 8 ? 3.3 : 0.75) + R() * 0.5 : 0);
        else if (!want && (l.vis || l.t0 != null)) { l.vis = false; l.t0 = null; m4.makeScale(0, 0, 0); lightM.setMatrixAt(i, m4); if (l.hi >= 0) haloM.setMatrixAt(l.hi, m4); }
      });
    }

    // ── 煙 ──
    var NS = 96, SM = [], smokeM = new T.InstancedMesh(keep(new T.IcosahedronGeometry(1, 0)), keep(new T.MeshLambertMaterial({ color: 0xffffff })), NS), sptr = 0; smokeM.frustumCulled = false; scene.add(smokeM);
    (function () { for (var i = 0; i < NS; i++) { SM.push({ life: 0, age: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0 }); m4.makeScale(0, 0, 0); smokeM.setMatrixAt(i, m4); c3.set(0xffffff); smokeM.setColorAt(i, c3); } })();
    function puff(x, y, z, vx, vy, vz, size, life, grey) {
      var p = SM[sptr]; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.size = size; p.life = life; p.age = 0;
      c3.setRGB(grey, grey, grey * 1.02); smokeM.setColorAt(sptr, c3); smokeM.instanceColor.needsUpdate = true; sptr = (sptr + 1) % NS;
    }
    function stepSmoke(dt) {
      var i, e, p, k, s;
      for (i = 0; i < EM.length; i++) { e = EM[i]; if (!inR(e.a, e.b)) continue; e.acc += e.rate * dt; while (e.acc >= 1) { e.acc -= 1; puff(e.x + (Math.random() - 0.5) * 0.3, e.y, e.z + (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.3, e.rise * (0.8 + Math.random() * 0.4), (Math.random() - 0.5) * 0.3, e.size, 3.2 + Math.random() * 1.4, e.grey); } }
      for (i = 0; i < NS; i++) {
        p = SM[i]; if (p.life <= 0) continue;
        p.age += dt; k = p.age / p.life;
        if (k >= 1) { p.life = 0; m4.makeScale(0, 0, 0); smokeM.setMatrixAt(i, m4); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt * (1 - 0.5 * k); p.z += p.vz * dt;
        s = p.size * (0.45 + 1.5 * k) * (k < 0.7 ? 1 : (1 - k) / 0.3); m4.makeScale(s, s * 0.82, s); m4.setPosition(p.x, p.y, p.z); smokeM.setMatrixAt(i, m4);
      }
      smokeM.instanceMatrix.needsUpdate = true;
    }

    // ── 人 ──
    var ROUTES = [[3, -12, 3, 7.5, 0.9, 0], [-17, -5, 21, -5, 0, 1.45], [3, 7.7, 3, 20.5, 0.55, 0], [-15.5, -17.5, -2.5, -6.5, 0.4, 0.4], [-27, 14.35, -9.5, 14.35, 0, 0], [-6, 21.2, 9.4, 21.2, 0, 0.5], [-7, -12.9, 14, -12.9, 0, 0.3]];
    var RCOUNT = [8, 10, 5, 4, 4, 6, 3], NP = 40, PEOPLE = [];
    var PAL = [[0x8a6a4a, 0x5f6f8a, 0xa39274, 0x6f5f4a, 0xc9b99a, 0x7a4a3a], [0x8a6a4a, 0x5f6f8a, 0xa39274, 0x6f5f4a, 0xc9b99a, 0x4f6a7a], [0x5a5f75, 0x7a5a4a, 0xd9cfc0, 0x5a6f8a, 0x8a4a4a, 0x3a3f55], [0x3a3f55, 0x7a5a4a, 0xe3dccb, 0x5a6f8a, 0x6f4a5a, 0x4a4a4a],
      [0x3a4a65, 0xc8b89a, 0xe9e4d8, 0x5a7a9a, 0x8a5a4a, 0x55606e], [0xe2492d, 0x3d8fe6, 0xf2c230, 0xf4f4f4, 0x2b3d61, 0x7cc47f], [0xe2492d, 0x3d8fe6, 0xf2c230, 0xf4f4f4, 0x2b3d61, 0x7cc47f], [0xdfe6ee, 0x6fa8dc, 0xf4f4f4, 0x9fb7c9, 0x2b3d61, 0xffb86b], [0xf2f4f6, 0xf2f4f6, 0xf2f4f6, 0xf2f4f6, 0xf2f4f6, 0xf2f4f6],
      [0xdfe6ee, 0x6fa8dc, 0xf4f4f4, 0x9fb7c9, 0x2b3d61, 0xffb86b], [0x8e9299, 0xf2f0ea, 0xd9bf9e, 0xc4c9d1, 0x2b2b30, 0xf2f0ea]];   // 鳥の世は服のまま。ガチの世は羽の色(桜・白・シナモン・シルバー・黒)
    var BHEAD = [0x26262b, 0xf7f5f0, 0xb9895f, 0x8e96a3, 0x1c1c20, 0xf7f5f0];   // 文鳥の頭の色(体の色と対)
    (function () {
      var r, i, n = 0, side, row, col;
      for (r = 0; r < ROUTES.length; r++) for (i = 0; i < RCOUNT[r]; i++) {
        var rt = ROUTES[r], len = Math.sqrt((rt[2] - rt[0]) * (rt[2] - rt[0]) + (rt[3] - rt[1]) * (rt[3] - rt[1])), sgn = R() < 0.5 ? -1 : 1;
        side = n % 4; row = Math.floor(n / 4) % 2; col = Math.floor(n / 8); // 調和のときの立ち位置:塔の四方に二列ずつ
        var lat = (col - 2) * 1.3, dist = 5.6 + row * 1.5, fx = HX + (side === 1 ? dist : side === 3 ? -dist : lat), fz = HZ + (side === 0 ? -dist : side === 2 ? dist : lat);
        PEOPLE.push({ r: r, u: R(), dir: R() < 0.5 ? -1 : 1, sp: 0.9 + R() * 0.7, len: len, ox: rt[4] * sgn * (0.7 + R() * 0.4), oz: rt[5] * sgn * (0.7 + R() * 0.4), ph: R() * 6, jsdf: r === 5, ci: Math.floor(R() * 6), fx: fx, fz: fz, fa: Math.atan2(HX - fx, HZ - fz), lag: R() * 0.55, c0: new T.Color(), c1: new T.Color() });
        n++;
      }
    })();
    var bodyM = new T.InstancedMesh(keep(merge([bx(0.42, 0.74, 0.3, 0, 0.42, 0, 0xffffff)])), MAT.inst, NP), headM = new T.InstancedMesh(keep(merge([bx(0.28, 0.28, 0.28, 0, 0.96, 0, 0xe2b58f)])), MAT.instPlain, NP);
    bodyM.frustumCulled = headM.frustumCulled = false; scene.add(bodyM); scene.add(headM);
    // 手術のあとの頭:文鳥の頭(色は一羽ずつ)と、くちばし・白いほお
    var bheadM = new T.InstancedMesh(keep(merge([bx(0.34, 0.33, 0.34, 0, 0.99, 0, 0xffffff)])), MAT.inst, NP);
    var beakM = new T.InstancedMesh(keep(merge([co(0.085, 0.2, 6, 0, 0.95, 0.25, 0xe8707e, [PI / 2, 0, 0]), bx(0.02, 0.15, 0.17, -0.18, 0.94, 0.04, 0xffffff), bx(0.02, 0.15, 0.17, 0.18, 0.94, 0.04, 0xffffff)])), MAT.instPlain, NP);
    bheadM.frustumCulled = beakM.frustumCulled = false; scene.add(bheadM); scene.add(beakM);
    PEOPLE.forEach(function (p, i) { bheadM.setColorAt(i, c3.set(BHEAD[p.ci])); }); bheadM.instanceColor.needsUpdate = true;
    var m0 = new T.Matrix4().makeScale(0, 0, 0);
    function paintPeople(anim) { PEOPLE.forEach(function (p) { p.c0.copy(anim ? p.c1 : c3.set(0)); p.c1.set(p.jsdf && M.stage < 8 ? 0x55673c : PAL[M.stage][p.ci]); if (!anim) p.c0.copy(p.c1); }); M.paintK = anim ? 0 : 1; M.paint = true; }
    function stepPeople(dt) {
      var i, p, rt, x, z, y, ang, e, f = M.form, bob, k = 1.15, bg = M.big || 0, st9 = M.stage === 9, st10 = M.stage === 10, bird;
      if (M.paintK < 1) { M.paintK = Math.min(1, M.paintK + dt / 1.6); M.paint = true; }
      for (i = 0; i < NP; i++) {
        p = PEOPLE[i]; rt = ROUTES[p.r];
        if (f < 1) { p.u += p.dir * p.sp * dt / p.len; if (p.u > 1) { p.u = 1; p.dir = -1; } else if (p.u < 0) { p.u = 0; p.dir = 1; } }
        x = rt[0] + (rt[2] - rt[0]) * p.u + p.ox; z = rt[1] + (rt[3] - rt[1]) * p.u + p.oz; y = bridgeH(x, z);
        ang = Math.atan2((rt[2] - rt[0]) * p.dir, (rt[3] - rt[1]) * p.dir); bob = Math.abs(Math.sin(M.t * 7 + p.ph)) * 0.07;
        if (f > 0) { e = smooth(clamp(f * 1.6 - p.lag, 0, 1)); x += (p.fx - x) * e; z += (p.fz - z) * e; y = y * (1 - e) + 0.23 * e; ang = turn(ang, p.fa, e); bob = st10 ? Math.abs(Math.sin(M.t * 5.5 + p.ph)) * 0.22 * e : bob * (1 - e); }   // ガチの世:リングを囲んで、跳ねて応援する
        bird = st10 || (st9 && i % 2 === 0);   // 鳥の世は、半分が鳥の頭
        m4.makeRotationY(ang); s3.set(k * (1 + 0.8 * bg), k * (1 + 0.38 * bg), k * (1 + 0.5 * bg)); m4.scale(s3); m4.setPosition(x, y + bob, z); bodyM.setMatrixAt(i, m4);
        m4.makeRotationY(ang); s3.set(k * (1 + 0.25 * bg), k * (1 + 0.38 * bg), k * (1 + 0.25 * bg)); m4.scale(s3); m4.setPosition(x, y + bob, z);
        headM.setMatrixAt(i, bird ? m0 : m4); bheadM.setMatrixAt(i, bird ? m4 : m0); beakM.setMatrixAt(i, bird ? m4 : m0);
        if (M.paint) { c3.copy(p.c0).lerp(p.c1, M.paintK); bodyM.setColorAt(i, c3); }
      }
      bodyM.instanceMatrix.needsUpdate = true; headM.instanceMatrix.needsUpdate = true; bheadM.instanceMatrix.needsUpdate = true; beakM.instanceMatrix.needsUpdate = true; if (M.paint) { bodyM.instanceColor.needsUpdate = true; M.paint = false; }
    }

    // ── 鳥たちとダリオくん ──
    var TBX = 2.2, TBZ = 23.8, birds = BIRDS.map(function (b, i) {
      var m = new T.Mesh(keep(birdGeo(b)), MAT.vc); scene.add(m);
      return { m: m, id: b.id, a0: i / BIRDS.length * TAU + 0.4, f: 0.55 + (i * 0.37 % 0.4), off: i * 0.61, per: 7 + (i * 1.7 % 4), lx: -3.0 + i * 2.0, lz: 20.6, scare: 0 };
    });
    var dario = new T.Group(), darioFaceM = new T.Mesh(geo('dface', function () { return darioFace(false); }), MAT.glow), darioEyesM = new T.Mesh(geo('deyes', function () { return darioEyes(false); }), MAT.glow);
    dario.add(new T.Mesh(geo('dario', darioGeo), MAT.vc)); dario.add(darioFaceM); darioEyesM.position.set(0, 2.95, 0.94); dario.add(darioEyesM);
    dario.position.set(DX, 0, DZ); dario.rotation.y = DR; dario.scale.set(DS, DS, DS); scene.add(dario);
    var asiFace = false;
    function setAsi(on) {
      if (on === asiFace) return; asiFace = on;
      darioFaceM.geometry = geo(on ? 'dfaceA' : 'dface', function () { return darioFace(on); }); darioEyesM.geometry = geo(on ? 'deyesA' : 'deyes', function () { return darioEyes(on); }); darioEyesM.scale.y = 1;
    }
    function stepBirds(dt) {
      var i, b, f = M.form, e = smooth(clamp(f * 1.4, 0, 1)), an, x, z, y, hop, face, p;
      for (i = 0; i < birds.length; i++) {
        b = birds[i]; an = b.a0 + 0.3 * Math.sin(M.t * 0.21 + i * 1.7) + M.t * 0.05;
        x = TBX + Math.cos(an) * 2.45; z = TBZ + Math.sin(an) * 2.3; face = Math.atan2(TBX - x, TBZ - z);
        var lk = (M.t / b.per + b.off) % 1; face += PI * (smooth((lk - 0.58) / 0.05) - smooth((lk - 0.93) / 0.05)); // ときどき机に背を向けて、あたりを見回す
        p = (M.t * b.f + b.off) % 1; hop = p < 0.36 ? Math.sin(p / 0.36 * PI) * 0.36 : 0;
        if (b.scare > 0) { b.scare = Math.max(0, b.scare - dt); hop += Math.sin((1.2 - b.scare) / 1.2 * PI) * 1.5; face += (1.2 - b.scare) * 10; }
        y = hop * (1 - e); x += (b.lx - x) * e; z += (b.lz - z) * e; face = turn(face, Math.atan2(HX - b.lx, HZ - b.lz), e);
        b.m.position.set(x, y, z); b.m.rotation.set(-hop * 0.25 * (1 - e), face, 0); var bsz = 1.3 * (1 + 1.1 * (M.big || 0)); b.m.scale.set(bsz, bsz * (1 - (p > 0.36 && p < 0.44 ? 0.07 * (1 - e) : 0)), bsz);
      }
      // ダリオくん:ときどきまばたきして、少しだけ首をかしげる。調和のあとは、動かない
      if (asiFace) { dario.rotation.z = 0; darioEyesM.scale.y = 1; }
      else { var bl = (M.t + 1.3) % 4.2; darioEyesM.scale.y = bl < 0.14 ? 0.12 : 1; dario.rotation.z = Math.sin(M.t * 0.7) * 0.035; }
      if (M.asiAt != null && M.t >= M.asiAt) { M.asiAt = null; setAsi(M.stage === 8); }
    }

    // ── 乗りもの ──
    function dyn(a, b) { return { a: a, b: b, k: 0, wait: 0 }; }
    function fade(o, dt) {
      var want = inR(o.a, o.b) ? 1 : 0;
      if (o.k === want) return o.k;
      if (want > o.k) { if (o.wait > 0) { o.wait -= dt; return o.k; } o.k = Math.min(1, o.k + dt / 0.5); } else o.k = Math.max(0, o.k - dt / 0.3);
      return o.k;
    }
    var DYN = [];
    function vehicle(g, a, b) { var m = new T.Mesh(g, MAT.vc), d = dyn(a, b); d.m = m; m.visible = false; scene.add(m); DYN.push(d); return d; }
    var steam = [vehicle(geo('loco', locoGeo), 2, 4), vehicle(geo('coachA', function () { return coachGeo(0x3a3a3e); }), 2, 4), vehicle(geo('coachB', function () { return coachGeo(0x7a4a34); }), 2, 4), vehicle(GEO.coachB, 2, 4)];
    var shin = [vehicle(geo('shinN', function () { return shinGeo(true); }), 5, 7), vehicle(geo('shinM', function () { return shinGeo(false); }), 5, 7), vehicle(GEO.shinM, 5, 7), vehicle(GEO.shinN, 5, 7)];
    var tram = vehicle(geo('tram', tramGeo), 3, 4), plane = vehicle(geo('plane', planeGeo), 4, 5), jet = vehicle(geo('jet', jetGeo), 5, 7);
    var trainS = 20, tramX = -6, tramDir = 1, tramWait = 0, jetT = 8.5, rocketT = 4, rocketPh = 0, rocketY = 0, rocketV = 0;
    function placeOnLoop(d, s, k, flip) { var p = onLoop(s); d.m.visible = k > 0.01; d.m.position.set(p.x, 0.16, p.z); d.m.rotation.y = p.a + (flip ? PI : 0); d.m.scale.set(k, k, k); }
    var NC = 16, CARS = [], carM = new T.InstancedMesh(geo('car', carGeo), MAT.inst, NC), carD = dyn(4, 7), carD2 = dyn(5, 7); carM.frustumCulled = false; scene.add(carM);
    var CROUTE = [[-18, -3.85, 22, -3.85, 0], [22, -6.15, -18, -6.15, 0], [3.62, 20.5, 3.62, -12.3, 0], [2.38, -12.3, 2.38, 20.5, 0], [-33, -13.9, 33, -13.9, 3.5], [33, -15.1, -33, -15.1, 3.5]];
    var CCOL = [0xe2492d, 0x2b3d61, 0xf4f4f4, 0xf2c230, 0x3d8fe6, 0x55606e, 0x7cc47f, 0x111318];
    (function () { var i, r; for (i = 0; i < NC; i++) { r = i < 7 ? [0, 1, 2, 3, 0, 1, 3][i] : 4 + (i % 2); CARS.push({ r: r, u: R(), sp: r >= 4 ? 9 + R() * 3 : 3 + R() * 1.6, hw: r >= 4 }); c3.set(CCOL[i % CCOL.length]); carM.setColorAt(i, c3); m4.makeScale(0, 0, 0); carM.setMatrixAt(i, m4); } })();
    var ND = 8, DRONES = [], droneM = new T.InstancedMesh(geo('drone', droneGeo), MAT.instPlain, ND), droneD = dyn(7, 7); droneM.frustumCulled = false; scene.add(droneM);
    (function () { var i, home = [[-3, -9], [9, -1], [16, -22], [-13, -9], [3, 9], [-18, 20], [20, 24], [3, 23]]; for (i = 0; i < ND; i++) { DRONES.push({ x: home[i][0], z: home[i][1], y: 6 + R() * 5 + (i === 7 ? -2 : 0), r: 1.6 + R() * 2.2, w: (0.5 + R() * 0.5) * (i % 2 ? 1 : -1), ph: R() * 6, li: DLI[i] }); m4.makeScale(0, 0, 0); droneM.setMatrixAt(i, m4); } })();
    function stepVehicles(dt) {
      var i, k, d, c, rt, u, x, z, len, s, y;
      // 汽車と新幹線(同じ線路を、時代で入れ替わる)
      k = 0; for (i = 0; i < 4; i++) k = fade(steam[i], dt);
      var k2 = 0; for (i = 0; i < 4; i++) k2 = fade(shin[i], dt);
      trainS += dt * (k2 > 0 ? 12 : 5.2);
      for (i = 0; i < 4; i++) placeOnLoop(steam[i], trainS - i * 2.72, steam[i].k);
      for (i = 0; i < 4; i++) placeOnLoop(shin[i], trainS - i * 3.4, shin[i].k, i === 3);
      if (k > 0.5) { M.steamAcc = (M.steamAcc || 0) + dt * 7; while (M.steamAcc >= 1) { M.steamAcc -= 1; var lp = steam[0].m.position, la = steam[0].m.rotation.y; puff(lp.x + Math.sin(la) * 0.95, 2.1, lp.z + Math.cos(la) * 0.95, (Math.random() - 0.5) * 0.3, 1.3, (Math.random() - 0.5) * 0.3, 0.42, 2.2, 0.9); } }
      // 市電:通りを行ったり来たり
      k = fade(tram, dt); tram.m.visible = k > 0.01;
      if (k > 0) { if (tramWait > 0) tramWait -= dt; else { tramX += tramDir * 3.4 * dt; if (tramX > 19) { tramX = 19; tramDir = -1; tramWait = 1.6; } else if (tramX < -15) { tramX = -15; tramDir = 1; tramWait = 1.6; } } tram.m.position.set(tramX, 0.09, -5); tram.m.rotation.y = PI / 2; tram.m.scale.set(k, k, k); }
      // 飛行機:町の上を回る
      k = fade(plane, dt); plane.m.visible = k > 0.01;
      if (k > 0) { var pa = M.t * 0.42; plane.m.position.set(Math.cos(pa) * 25, 13 + Math.sin(M.t * 0.6) * 0.8, Math.sin(pa) * 25); plane.m.rotation.set(0, -pa, -0.4, 'YXZ'); plane.m.scale.set(k * 1.25, k * 1.25, k * 1.25); }
      // 旅客機:ときどき空を横切る
      k = fade(jet, dt); if (k > 0) { jetT -= dt; if (jetT < -4) jetT = 9; var ju = -jetT / 4; jet.m.visible = jetT < 0; if (jetT < 0) { jet.m.position.set(-70 + ju * 140, 26, -26 + ju * 36); jet.m.rotation.set(0, Math.atan2(140, 36), 0); jet.m.scale.set(k * 1.5, k * 1.5, k * 1.5); } } else { jet.m.visible = false; jetT = 1.5; }
      // 自動車
      k = fade(carD, dt); k2 = fade(carD2, dt);
      for (i = 0; i < NC; i++) {
        c = CARS[i]; rt = CROUTE[c.r]; d = c.hw ? k2 : k;
        if (d <= 0) { if (c.on) { c.on = false; m4.makeScale(0, 0, 0); carM.setMatrixAt(i, m4); } continue; }
        c.on = true; len = Math.abs(rt[2] - rt[0]) + Math.abs(rt[3] - rt[1]); c.u += c.sp * dt / len; if (c.u > 1) c.u -= 1; u = c.u;
        x = rt[0] + (rt[2] - rt[0]) * u; z = rt[1] + (rt[3] - rt[1]) * u; y = rt[4] || (0.09 + (Math.abs(x - BRX) < 1 ? bridgeH(BRX, z) : 0));
        s = d * Math.min(1, u * len / 1.6, (1 - u) * len / 1.6); m4.makeRotationY(Math.atan2(rt[2] - rt[0], rt[3] - rt[1])); s3.set(s, s, s); m4.scale(s3); m4.setPosition(x, y, z); carM.setMatrixAt(i, m4);
      }
      carM.instanceMatrix.needsUpdate = true;
      // 無人機
      k = fade(droneD, dt);
      for (i = 0; i < ND; i++) {
        d = DRONES[i]; var da = M.t * d.w + d.ph; x = d.x + Math.cos(da) * d.r; z = d.z + Math.sin(da) * d.r; y = d.y + Math.sin(M.t * 1.3 + d.ph) * 0.4;
        m4.makeRotationY(-da); s3.set(k, k, k); m4.scale(s3); m4.setPosition(x, y, z); droneM.setMatrixAt(i, m4);
        if (LT[d.li].vis) { m4.makeScale(0.14, 0.1, 0.14); m4.setPosition(x, y - 0.14, z); lightM.setMatrixAt(d.li, m4); }
      }
      droneM.instanceMatrix.needsUpdate = true;
      // 水車
      if (M.wheel) M.wheel.rotation.z -= dt * 1.1;
      // ロケット:ときどき打ち上がる。大きな音が苦手なオカメ技師長が飛び上がる
      if (M.rocket && inR(6, 7)) {
        rocketT -= dt;
        if (rocketPh === 0 && rocketT <= 0) { rocketPh = 1; rocketT = 1.3; M.flame.visible = true; birds.forEach(function (b) { if (b.id === 'okame') b.scare = 1.2; }); if (h.onLaunch) try { h.onLaunch(); } catch (e) { /* 呼び出し側の都合 */ } }
        else if (rocketPh === 1) { for (i = 0; i < 2; i++) puff(24 + (Math.random() - 0.5) * 2.4, 0.5, 19.5 + (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 3, 0.6, (Math.random() - 0.5) * 3, 0.8, 2.4, 0.95); if (rocketT <= 0) { rocketPh = 2; rocketV = 1; } }
        else if (rocketPh === 2) { rocketV += 16 * dt; rocketY += rocketV * dt; puff(24, 0.2 + rocketY, 19.5, (Math.random() - 0.5) * 0.6, -1.5, (Math.random() - 0.5) * 0.6, 0.7, 2.6, 0.96); if (rocketY > 90) { rocketPh = 3; rocketT = 3.5; M.rocket.visible = false; M.flame.visible = false; } }
        else if (rocketPh === 3 && rocketT <= 0) { rocketPh = 4; rocketT = 0.6; rocketY = 0; M.rocket.visible = true; }
        else if (rocketPh === 4 && rocketT <= 0) { rocketPh = 0; rocketT = 9; }
        M.rocket.position.y = 0.25 + rocketY; var rk = rocketPh === 4 ? back(clamp(1 - rocketT / 0.6, 0, 1)) : 1; M.rocket.scale.set(rk, rk, rk);
        if (M.flame.visible) { var fl = 0.8 + Math.random() * 0.5; M.flame.scale.set(1, fl * (rocketPh === 2 ? 1.6 : 0.8), 1); }
      }
    }

    // ── 時代を変える ──
    function setStage(n, o) {
      n = clamp(Math.round(+n || 0), 0, 10); var anim = !!(o && o.animate) && !reduced && M.stage >= 0, prev = M.stage;
      if (n === prev) return;
      M.stage = n; h.stage = n;
      defs.forEach(function (c) {
        var want = inR(c.a, c.b, n) || (n === 10 && c.id === 'hq'); if (want && !c.group) build(c); if (!c.group) return;   // ガチの世にも、研究本部は残る
        if (!anim) { c.k = want ? 1 : 0; c.anim = null; applyK(c); }
        else if (want !== c.want) c.anim = { from: c.k, to: want ? 1 : 0, t0: M.t + (want ? 0.12 + c.delay + (c.slow ? 0.6 : 0) : 0), dur: want ? (c.slow ? 2.6 : 0.62) : 0.34 };
        c.want = want;
      });
      setLights(anim);
      DYN.concat([carD, carD2, droneD]).forEach(function (d) { var want = inR(d.a, d.b, n); if (!anim) d.k = want ? 1 : 0; else if (want && d.k < 1) d.wait = 0.9; });
      if (!anim) { stepTrees(-1); SM.forEach(function (p, i) { if (p.life > 0) { p.life = 0; m4.makeScale(0, 0, 0); smokeM.setMatrixAt(i, m4); } }); smokeM.instanceMatrix.needsUpdate = true; } else treesDirty = true; // 一気に切り替えるときは、前の時代の煙を残さない
      litA = anim ? curLit() : LIT[n].slice(); litB = LIT[n]; M.skyK = anim ? 0 : 1; M.skyDur = n === 8 ? 3.2 : (n >= 9 ? 2.4 : 1.4);
      if (anim) fogA.copy(scene.fog.color); else fogA.set(SKY[n][1]);
      paleA = anim ? (M.pale || 0) : (n === 8 ? 1 : 0); paleB = n === 8 ? 1 : 0;
      skyA.style.background = prev >= 0 ? grad(prev) : grad(n); skyB.style.background = grad(n); skyB.style.opacity = anim ? '0' : '1';
      paintPeople(anim);
      if (inR(6, 7, n) && !(prev >= 0 && inR(6, 7, prev))) { rocketPh = 0; rocketY = 0; rocketT = anim ? 4.2 : 6; if (M.rocket) { M.rocket.visible = true; M.flame.visible = false; } }
      if (anim) M.asiAt = M.t + (n === 8 ? 2.2 : 0); else { M.asiAt = null; setAsi(n === 8); M.form = n === 8 || n === 10 ? 1 : 0; M.big = n === 10 ? 1 : 0; }
      applyLit(); M.dirty = true;
    }
    function curLit() { var k = smooth(M.skyK), a = litA, b = litB, out = [], i; if (!a) return LIT[Math.max(0, M.stage)].slice(); for (i = 0; i < 8; i++) out.push(i === 0 || i === 1 || i === 3 ? cA.set(a[i]).lerp(cB.set(b[i]), k).getHex() : a[i] + (b[i] - a[i]) * k); return out; }
    function applyLit() {
      var L = curLit(), k = smooth(M.skyK), pale = paleA + (paleB - paleA) * k;
      hemi.color.set(L[0]); hemi.groundColor.set(L[1]); hemi.intensity = L[2]; sun.color.set(L[3]); sun.intensity = L[4]; M.night = L[5]; M.fogN = L[6]; M.fogF = L[7];
      matWin.color.copy(DAYWIN).lerp(NIGHTWIN, clamp(M.night * 1.15, 0, 1));
      scene.fog.color.copy(fogA).lerp(cB.set(SKY[M.stage][1]), k);
      skyB.style.opacity = String(k);
      // 調和:地面を白く覆い、画面ごと色を抜く
      M.pale = pale; coverMat.opacity = pale; cover.visible = pale > 0.01;
      if (stack[stack.length - 1] === M) renderer.domElement.style.filter = pale > 0.01 ? 'saturate(' + (1 - 0.6 * pale).toFixed(3) + ')' : '';
    }

    // ── 一こま進める ──
    function fitR(rad, el) { // この半径の円が画面に収まるカメラ距離
      var vh = cam.fov / 2 * PI / 180, hh = Math.atan(Math.tan(vh) * cam.aspect);
      return Math.max(rad / Math.tan(hh), (rad * Math.sin(el) + rad * 0.24) / Math.tan(vh)) * 1.03;
    }
    function step(dt) {
      var i, c, a, k;
      M.t += dt;
      if (M.orbit) M.phi += dt * TAU / 96;
      k = 1 - Math.exp(-dt * 2.4); view.x += (viewTo.x - view.x) * k; view.y += (viewTo.y - view.y) * k; view.z += (viewTo.z - view.z) * k; view.rad += ((viewTo.rad || defRad()) - view.rad) * k; view.el += ((viewTo.el || M.el) - view.el) * k;
      for (i = 0; i < defs.length; i++) {
        c = defs[i]; a = c.anim; if (!a) continue;
        k = (M.t - a.t0) / a.dur; if (k <= 0) continue;
        if (k >= 1) { c.k = a.to; c.anim = null; } else c.k = a.to > a.from ? a.from + (a.to - a.from) * (c.slow ? smooth(k) : back(k)) : a.from + (a.to - a.from) * k * k;
        applyK(c);
      }
      if (M.skyK < 1) { M.skyK = Math.min(1, M.skyK + dt / M.skyDur); applyLit(); }
      var wantForm = M.stage === 8 || M.stage === 10 ? 1 : 0, wantBig = M.stage === 10 ? 1 : 0;
      if (M.big !== wantBig) M.big = wantBig > (M.big || 0) ? Math.min(1, (M.big || 0) + dt / 2.5) : Math.max(0, M.big - dt / 1.2);   // ガチの世:人も鳥も、大きくなる
      if (M.flock) { M.flock.rotation.y = M.t * 0.24; M.flock.position.y = Math.sin(M.t * 0.7) * 0.6; }
      if (M.fight) { // 闘技場のふたり:かわるがわる、踏みこんで打つ
        var ft = M.t * 5.2, pa = Math.max(0, Math.sin(ft)), pb = Math.max(0, Math.sin(ft + PI)), fa = M.fight[0], fb = M.fight[1], hop = 0.97 + Math.abs(Math.sin(ft * 0.5)) * 0.07;
        fa.position.set(-1.0 + pa * 0.46 - pb * 0.18, hop, Math.sin(M.t * 0.9) * 0.5); fb.position.set(1.0 - pb * 0.46 + pa * 0.18, hop, Math.sin(M.t * 0.9) * 0.5);
        fa.rotation.z = pb * 0.2; fb.rotation.z = -pa * 0.2;
      }
      if (M.form !== wantForm) M.form = wantForm > M.form ? Math.min(1, M.form + dt / 4.5) : Math.max(0, M.form - dt / 1.2);
      if (treesDirty) stepTrees(dt);
      stepLights(); stepSmoke(dt); stepPeople(dt); stepBirds(dt); stepVehicles(dt);
      if (M.orb) { var pk = 1 + Math.sin(M.t * 0.9) * 0.05; M.orb.scale.set(pk, pk, pk); pk = 1 + Math.sin(M.t * 0.9 - 0.6) * 0.12; M.orbHalo.scale.set(pk, pk, pk); }
    }
    function render() {
      var el = view.el, Rr = fitR(view.rad, el), ce = Math.cos(el);
      cam.position.set(view.x + Rr * ce * Math.sin(M.phi), view.y + Rr * Math.sin(el), view.z + Rr * ce * Math.cos(M.phi)); cam.lookAt(view.x, view.y, view.z);
      scene.fog.near = Rr * M.fogN + 20 * (1 - Math.min(1, Rr / 75)); scene.fog.far = Math.max(Rr, 75) * M.fogF;
      renderer.render(scene, cam);
    }
    function resize() {
      var w = host.clientWidth, hh = host.clientHeight; M.w = w; M.h = hh; if (w < 2 || hh < 2) return;
      var port = w / hh < 0.8; cam.fov = port ? 46 : 36; cam.aspect = w / hh; M.el = (port ? 40 : 30) * PI / 180;
      if (M.shx || M.shy) cam.setViewOffset(w, hh, -M.shx * w, M.shy * hh, w, hh); else { cam.clearViewOffset(); cam.updateProjectionMatrix(); } // 画の中心をずらす(文字を重ねる側を空ける)
      renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2)); renderer.setSize(w, hh, false); M.dirty = true;
      if (!viewTo.rad) view.rad = defRad(); if (!viewTo.el) view.el = M.el;
    }
    M.loop = function (now) {
      if (M.dead) return;
      M.raf = requestAnimationFrame(M.loop);
      if (!host.isConnected) { h.dispose(); return; }
      var dt = Math.min(0.05, Math.max(0, (now - M.last) / 1000)); M.last = now;
      if (M.manual || M.paused || document.hidden) return;
      if (host.clientWidth !== M.w || host.clientHeight !== M.h) resize();
      if (M.w < 2 || M.h < 2) return;
      if (reduced) { if (M.dirty) { step(0.001); render(); M.dirty = false; } return; }
      step(dt); render();
    };
    M.activate = function () { wrap.appendChild(renderer.domElement); resize(); applyLit(); M.last = performance.now(); M.dirty = true; if (!M.raf) M.raf = requestAnimationFrame(M.loop); };
    M.suspend = function () { if (M.raf) cancelAnimationFrame(M.raf); M.raf = 0; if (renderer.domElement.parentNode === wrap) { wrap.removeChild(renderer.domElement); renderer.domElement.style.filter = ''; } };

    var h = {
      stage: 0, onLaunch: null,
      setStage: function (n, o) { if (!M.dead) setStage(n, o); return h; },
      focus: function (key, o) {
        var v = VIEWS[key] || VIEWS.all; viewTo.x = v[0]; viewTo.y = v[1]; viewTo.z = v[2]; viewTo.rad = v[3]; viewTo.el = v[4] * PI / 180;
        if (o && o.angle != null) M.phi = o.angle;
        if ((o && o.animate === false) || reduced) { view.x = viewTo.x; view.y = viewTo.y; view.z = viewTo.z; view.rad = viewTo.rad || defRad(); view.el = viewTo.el || M.el; }
        M.dirty = true; return h;
      },
      setOrbit: function (on) { M.orbit = !!on && !reduced; return h; },
      shift: function (x, y) { M.shx = +x || 0; M.shy = +y || 0; if (stack[stack.length - 1] === M) resize(); return h; }, // 町を画面の右(x>0)・上(y>0)へ寄せる。画面の幅・高さに対する割合
      pause: function () { M.paused = true; return h; },
      resume: function () { M.paused = false; M.last = performance.now(); return h; },
      resize: function () { if (!M.dead && stack[stack.length - 1] === M) resize(); return h; },
      dispose: function () {
        if (M.dead) return; M.dead = true;
        var top = stack[stack.length - 1] === M, i = stack.indexOf(M); if (i >= 0) stack.splice(i, 1);
        M.suspend();
        [treeM, lightM, haloM, smokeM, bodyM, headM, bheadM, beakM, carM, droneM].forEach(function (m) { try { m.dispose(); } catch (e) { /* 古い版 */ } });
        M.trash.forEach(function (o) { try { o.dispose(); } catch (e) { /* 破棄済み */ } });
        try { renderer.renderLists.dispose(); } catch (e) { /* 古い版 */ }
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if (top && stack.length) { var nx = stack[stack.length - 1]; if (nx.host.isConnected) nx.activate(); else nx.handle.dispose(); }
      },
      // 検査用:実時間を待たずに時間を進めて一枚描く
      _advance: function (sec) { if (M.dead) return -1; M.manual = true; if (host.clientWidth !== M.w || host.clientHeight !== M.h) resize(); var n = Math.max(1, Math.ceil(sec * 30)), i; for (i = 0; i < n; i++) step(sec / n); if (stack[stack.length - 1] === M) render(); return M.t; },
      _info: function () { return { stage: M.stage, t: M.t, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, form: M.form, top: stack[stack.length - 1] === M, w: M.w, h: M.h }; }
    };
    M.handle = h;

    setStage(opts.stage == null ? 0 : opts.stage, null);
    if (stack.length) stack[stack.length - 1].suspend();
    stack.push(M); M.activate();
    h.focus(opts.focus || 'all', { animate: false });
    step(0.001); if (M.w >= 2 && M.h >= 2) render();
    return h;
  }

  TF.Diorama3D = {
    available: available, mount: mount, stages: 11,
    sky: function (n) { var k = SKY[Math.max(0, Math.min(10, n | 0))]; return 'linear-gradient(' + k[0] + ' 0%,' + k[1] + ' 54%,' + k[2] + ' 100%)'; }, // その時代の空(3Dが使えないときの背景にも使う)
    _count: function () { return stack.length; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
