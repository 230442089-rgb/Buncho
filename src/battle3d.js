/* 天下布鳥 — 戦闘の3Dアニメーション(three.js r128)。
 * TF.Battle3D.play(host, spec, onDone) で再生する。three.js が読み込めない、WebGL が使えない場合は available() が false を返すので、
 * 呼び出し側はアニメなしで結果へ進む。兵は積み木のような人形で、吹き飛んで空の星になる。血は出ない。 */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};
  var T = null, renderer = null, glOK = null, B = null, G = {}, matVC = null, dom = null;

  function available() {
    if (glOK !== null) return glOK;
    T = root.THREE;
    if (!T) return (glOK = false);
    try { var c = document.createElement('canvas'); glOK = !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { glOK = false; }
    return glOK;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
  function sfx(name, o) { if (TF.sfx && !(B && B.mute)) TF.sfx.play(name, o); }
  function fmt(n) { return Math.round(n).toLocaleString('ja-JP'); }

  // いくつかの箱や円錐を、頂点色つきの一つの形にまとめる
  function merge(parts) {
    var pos = [], nor = [], col = [], m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3(1, 1, 1), c = new T.Color();
    parts.forEach(function (p) {
      var g = p.g.index ? p.g.toNonIndexed() : p.g.clone(), r = p.r || [0, 0, 0];
      e.set(r[0], r[1], r[2]); q.setFromEuler(e); v.set(p.p[0], p.p[1], p.p[2]); m.compose(v, q, s); g.applyMatrix4(m);
      var pa = g.attributes.position.array, na = g.attributes.normal.array; c.set(p.c);
      for (var i = 0; i < pa.length; i += 3) { pos.push(pa[i], pa[i + 1], pa[i + 2]); nor.push(na[i], na[i + 1], na[i + 2]); col.push(c.r, c.g, c.b); }
      g.dispose(); if (g !== p.g) p.g.dispose();
    });
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return out;
  }
  function box(w, h, d) { return new T.BoxGeometry(w, h, d); }
  function shade(hex, k) { var c = new T.Color(hex); c.multiplyScalar(k); return c.getHex(); }

  // ── 形(使い回すもの) ──
  function soldierGeo(flag, armor, hat) { // 旗指物を背負った足軽
    return merge([
      { g: box(0.42, 0.95, 0.3), p: [0, 0.475, 0], c: armor },
      { g: box(0.26, 0.26, 0.26), p: [0, 1.09, 0], c: 0xe2b58f },
      { g: new T.ConeGeometry(0.37, 0.2, 7), p: [0, 1.3, 0], c: hat },
      { g: box(0.05, 2.3, 0.05), p: [0.29, 1.15, 0.12], r: [0.22, 0, 0], c: 0x6b4a2c },
      { g: box(0.04, 1.45, 0.04), p: [-0.1, 1.55, -0.2], c: 0x3b2c1e },
      { g: box(0.44, 0.78, 0.03), p: [-0.1, 1.85, -0.2], c: flag }
    ]);
  }
  // 敵の文化圏。兵のいでたちと、陣の建て方が変わる(指定がなければ戦国の日本)
  var CULT = {
    east: { skin: 0xe2b58f, style: 'tenshu', wall: 0xb5433a, roof: 0x3d5648 },   // 明・朝鮮・大越・琉球
    steppe: { skin: 0xd9a877, style: 'yurt' },                                      // 騎馬の民
    north: { skin: 0xd9a877, style: 'yurt' },                                       // 北方の民
    sea: { skin: 0xc99667, style: 'palisade' },                                     // 東南アジアの港市国家
    india: { skin: 0xb9824f, style: 'dome', wall: 0xc9694a, roof: 0xf3ead7 },
    islam: { skin: 0xcf9d6c, style: 'dome', wall: 0xe6d3ac, roof: 0x3aa0a8 },
    europe: { skin: 0xf0c9a8, style: 'keep' },
    africa: { skin: 0x6b4226, style: 'palisade' },
    america: { skin: 0xb9774a, style: 'palisade' },
    pacific: { skin: 0xa66a3c, style: 'palisade' }
  };
  function cultureGeo(kind, flag) {
    var C = CULT[kind], dark = shade(flag, 0.45), wood = 0x6b4a2c, parts = [];
    if (kind === 'steppe') { // 馬上の弓騎兵
      return merge([
        { g: box(0.46, 0.5, 1.25), p: [0, 0.72, 0], c: 0x7a5636 }, { g: box(0.24, 0.42, 0.4), p: [0, 1.05, 0.72], r: [-0.5, 0, 0], c: 0x7a5636 },
        { g: box(0.12, 0.5, 0.12), p: [-0.16, 0.25, 0.45], c: 0x5d4129 }, { g: box(0.12, 0.5, 0.12), p: [0.16, 0.25, 0.45], c: 0x5d4129 },
        { g: box(0.12, 0.5, 0.12), p: [-0.16, 0.25, -0.45], c: 0x5d4129 }, { g: box(0.12, 0.5, 0.12), p: [0.16, 0.25, -0.45], c: 0x5d4129 },
        { g: box(0.4, 0.7, 0.28), p: [0, 1.3, -0.05], c: flag }, { g: box(0.24, 0.24, 0.24), p: [0, 1.78, -0.05], c: C.skin },
        { g: box(0.34, 0.12, 0.34), p: [0, 1.93, -0.05], c: 0x4a3524 }, { g: new T.ConeGeometry(0.16, 0.2, 6), p: [0, 2.08, -0.05], c: flag },
        { g: box(0.04, 1.9, 0.04), p: [0.3, 1.7, 0.1], r: [0.3, 0, 0], c: wood }
      ]);
    }
    // 胴
    if (kind === 'islam') parts.push({ g: new T.CylinderGeometry(0.2, 0.3, 0.95, 6), p: [0, 0.475, 0], c: flag });
    else if (kind === 'india') parts.push({ g: box(0.42, 0.95, 0.3), p: [0, 0.475, 0], c: 0xf1e7d0 }, { g: box(0.44, 0.14, 0.32), p: [0, 0.62, 0], c: flag });
    else if (kind === 'europe') parts.push({ g: box(0.42, 0.5, 0.3), p: [0, 0.25, 0], c: dark }, { g: box(0.46, 0.46, 0.34), p: [0, 0.72, 0], c: 0x9aa3ad }, { g: box(0.1, 0.5, 0.36), p: [0, 0.72, 0], r: [0, 0, 0.6], c: flag });
    else if (kind === 'africa' || kind === 'pacific') parts.push({ g: box(0.4, 0.5, 0.28), p: [0, 0.7, 0], c: C.skin }, { g: box(0.44, 0.48, 0.32), p: [0, 0.24, 0], c: flag });
    else if (kind === 'america') parts.push({ g: box(0.42, 0.95, 0.3), p: [0, 0.475, 0], c: 0xb08a5a }, { g: box(0.44, 0.1, 0.32), p: [0, 0.5, 0], c: flag });
    else if (kind === 'north') parts.push({ g: box(0.48, 0.95, 0.36), p: [0, 0.475, 0], c: 0xd6cdb8 }, { g: box(0.5, 0.1, 0.38), p: [0, 0.12, 0], c: flag });
    else parts.push({ g: box(0.42, 0.95, 0.3), p: [0, 0.475, 0], c: kind === 'sea' ? flag : dark });
    parts.push({ g: box(0.26, 0.26, 0.26), p: [0, 1.09, 0], c: C.skin });
    // かぶりもの
    if (kind === 'east') parts.push({ g: new T.ConeGeometry(0.3, 0.26, 8), p: [0, 1.33, 0], c: 0x8d98a3 }, { g: box(0.07, 0.2, 0.07), p: [0, 1.52, 0], c: 0xc8372d });
    else if (kind === 'sea') parts.push({ g: new T.ConeGeometry(0.42, 0.2, 9), p: [0, 1.3, 0], c: 0xd8c27a });
    else if (kind === 'india') parts.push({ g: new T.IcosahedronGeometry(0.21, 0), p: [0, 1.3, 0], c: flag });
    else if (kind === 'islam') parts.push({ g: new T.IcosahedronGeometry(0.22, 0), p: [0, 1.3, 0], c: 0xf3efe6 });
    else if (kind === 'europe') parts.push({ g: new T.CylinderGeometry(0.33, 0.33, 0.04, 9), p: [0, 1.24, 0], c: 0x9aa3ad }, { g: new T.ConeGeometry(0.2, 0.24, 8), p: [0, 1.37, 0], c: 0xaab3bd });
    else if (kind === 'america') parts.push({ g: box(0.29, 0.07, 0.29), p: [0, 1.17, 0], c: flag });
    else if (kind === 'north') parts.push({ g: box(0.36, 0.34, 0.34), p: [0, 1.11, -0.05], c: 0xd6cdb8 });
    // 得物
    if (kind === 'europe') parts.push({ g: box(0.05, 3.0, 0.05), p: [0.29, 1.5, 0.1], r: [0.12, 0, 0], c: wood }, { g: box(0.07, 0.24, 0.07), p: [0.29, 3.0, 0.28], c: 0xc9ced4 });
    else if (kind === 'islam') parts.push({ g: box(0.06, 0.06, 1.2), p: [0.24, 0.9, 0.35], c: 0x3b2c1e });
    else parts.push({ g: box(0.05, 2.2, 0.05), p: [0.29, 1.1, 0.12], r: [0.22, 0, 0], c: wood });
    // 盾・小旗
    if (kind === 'sea' || kind === 'america') parts.push({ g: new T.CylinderGeometry(0.3, 0.3, 0.05, 9), p: [-0.2, 0.7, 0.2], r: [Math.PI / 2, 0, 0], c: kind === 'sea' ? 0x8a5a2c : flag });
    if (kind === 'africa' || kind === 'pacific') parts.push({ g: box(0.36, 0.8, 0.05), p: [-0.18, 0.62, 0.2], c: 0xe9dcc0 }, { g: box(0.1, 0.8, 0.06), p: [-0.18, 0.62, 0.2], c: 0x3b2c1e });
    if (kind === 'east') parts.push({ g: box(0.34, 0.24, 0.03), p: [0.47, 2.0, 0.36], c: flag });
    return merge(parts);
  }
  function leaderGeo(kind, flag) { // 大将。兵の倍ほどの背丈にして、陣の奥に立たせる
    var C = CULT[kind] || { skin: 0xe2b58f }, gold = 0xd9b24c, parts = [
      { g: box(0.5, 1.0, 0.36), p: [0, 0.5, 0], c: flag }, { g: box(0.64, 0.3, 0.42), p: [0, 0.92, 0], c: shade(flag, 0.6) },
      { g: box(0.28, 0.28, 0.28), p: [0, 1.2, 0], c: C.skin }, { g: box(0.52, 0.9, 0.06), p: [0, 0.6, -0.24], c: shade(flag, 0.7) }
    ];
    if (!CULT[kind]) parts.push({ g: box(0.36, 0.2, 0.36), p: [0, 1.42, 0], c: 0x23262d }, // 兜と鍬形、軍配
      { g: new T.ConeGeometry(0.06, 0.5, 4), p: [-0.16, 1.72, 0.12], r: [0, 0, 0.45], c: gold }, { g: new T.ConeGeometry(0.06, 0.5, 4), p: [0.16, 1.72, 0.12], r: [0, 0, -0.45], c: gold },
      { g: box(0.05, 0.6, 0.05), p: [0.36, 1.0, 0.2], c: 0x3b2c1e }, { g: box(0.36, 0.3, 0.04), p: [0.36, 1.4, 0.2], c: gold });
    else parts.push({ g: new T.CylinderGeometry(0.2, 0.17, 0.16, 8), p: [0, 1.42, 0], c: gold }, { g: box(0.06, 1.3, 0.06), p: [0.36, 0.9, 0.2], c: gold });
    return merge(parts);
  }
  function elephantGeo(flag) {
    var E = 0x8c8a86, D = 0x6f6d6a;
    return merge([
      { g: box(2.0, 1.8, 3.2), p: [0, 2.3, 0], c: E }, { g: box(1.4, 1.4, 1.3), p: [0, 2.6, 2.0], c: E }, { g: box(0.4, 1.9, 0.4), p: [0, 1.5, 2.8], r: [0.25, 0, 0], c: D },
      { g: box(0.15, 1.1, 0.9), p: [-0.8, 2.7, 1.7], c: D }, { g: box(0.15, 1.1, 0.9), p: [0.8, 2.7, 1.7], c: D },
      { g: box(0.55, 1.5, 0.55), p: [-0.65, 0.75, 1.1], c: D }, { g: box(0.55, 1.5, 0.55), p: [0.65, 0.75, 1.1], c: D },
      { g: box(0.55, 1.5, 0.55), p: [-0.65, 0.75, -1.1], c: D }, { g: box(0.55, 1.5, 0.55), p: [0.65, 0.75, -1.1], c: D },
      { g: box(2.2, 0.15, 2.2), p: [0, 3.28, -0.1], c: flag }, { g: box(1.3, 0.8, 1.5), p: [0, 3.7, -0.1], c: 0xd9b24c },
      { g: new T.ConeGeometry(0.09, 0.7, 5), p: [-0.4, 2.2, 2.75], r: [1.9, 0, 0], c: 0xf3efe6 }, { g: new T.ConeGeometry(0.09, 0.7, 5), p: [0.4, 2.2, 2.75], r: [1.9, 0, 0], c: 0xf3efe6 }
    ]);
  }
  function droneGeo() {
    return merge([{ g: box(0.5, 0.1, 0.5), p: [0, 0, 0], c: 0x2b3038 }, { g: box(0.95, 0.04, 0.09), p: [0, 0.06, 0], r: [0, Math.PI / 4, 0], c: 0x16181c },
      { g: box(0.95, 0.04, 0.09), p: [0, 0.06, 0], r: [0, -Math.PI / 4, 0], c: 0x16181c }, { g: box(0.13, 0.13, 0.13), p: [0, -0.1, -0.15], c: 0xe2492d }]);
  }
  function ball(rx, ry, rz, d) { var g = new T.IcosahedronGeometry(1, d == null ? 2 : d); g.scale(rx, ry, rz); return g; }
  function mechGeo() { // 機動文鳥の胴と脚。桜文鳥の配色。前は −z
    var W = 0xa7adb8, Gr = 0x7d8491, P = 0xe88a94;
    return merge([
      { g: ball(3.6, 3.9, 4.4), p: [0, 7.4, 0], c: W }, { g: ball(3.0, 2.6, 3.2), p: [0, 6.0, -1.3], c: 0xf1dcd4 },
      { g: ball(0.5, 2.6, 3.1), p: [-3.5, 7.8, 0.8], r: [0, 0, 0.12], c: Gr }, { g: ball(0.5, 2.6, 3.1), p: [3.5, 7.8, 0.8], r: [0, 0, -0.12], c: Gr },
      { g: box(1.5, 0.45, 4.6), p: [0, 7.0, 5.4], r: [0.3, 0, 0], c: 0x26262b },
      { g: new T.CylinderGeometry(0.42, 0.5, 3.6, 8), p: [-1.5, 2.2, 0.3], c: P }, { g: new T.CylinderGeometry(0.42, 0.5, 3.6, 8), p: [1.5, 2.2, 0.3], c: P },
      { g: box(0.5, 0.45, 2.6), p: [-1.5, 0.25, -0.7], c: P }, { g: box(0.5, 0.45, 2.6), p: [1.5, 0.25, -0.7], c: P },
      { g: box(0.45, 0.4, 2.2), p: [-2.2, 0.22, -0.4], r: [0, 0.5, 0], c: P }, { g: box(0.45, 0.4, 2.2), p: [-0.8, 0.22, -0.4], r: [0, -0.5, 0], c: P },
      { g: box(0.45, 0.4, 2.2), p: [0.8, 0.22, -0.4], r: [0, 0.5, 0], c: P }, { g: box(0.45, 0.4, 2.2), p: [2.2, 0.22, -0.4], r: [0, -0.5, 0], c: P },
      { g: new T.CylinderGeometry(0.9, 0.9, 0.14, 14), p: [-3.98, 8.1, 0.6], r: [0, 0, Math.PI / 2], c: 0xe2492d }, { g: new T.CylinderGeometry(0.9, 0.9, 0.14, 14), p: [3.98, 8.1, 0.6], r: [0, 0, Math.PI / 2], c: 0xe2492d },
      { g: box(2.6, 1.5, 0.5), p: [0, 9.6, 3.4], r: [-0.5, 0, 0], c: 0x55673c }
    ]);
  }
  function mechHeadGeo() {
    return merge([
      { g: ball(2.5, 2.4, 2.5), p: [0, 0, 0], c: 0x26262b }, { g: new T.ConeGeometry(1.15, 2.6, 8), p: [0, -0.2, -2.9], r: [-Math.PI / 2, 0, 0], c: 0xe8707e },
      { g: ball(0.75, 1.25, 1.5), p: [-2.0, -0.55, -0.45], c: 0xffffff }, { g: ball(0.75, 1.25, 1.5), p: [2.0, -0.55, -0.45], c: 0xffffff },
      { g: new T.CylinderGeometry(0.62, 0.62, 0.1, 12), p: [-2.2, 0.5, -1.0], r: [0, 0, Math.PI / 2], c: 0xe04a4a }, { g: new T.CylinderGeometry(0.62, 0.62, 0.1, 12), p: [2.2, 0.5, -1.0], r: [0, 0, Math.PI / 2], c: 0xe04a4a },
      { g: ball(0.4, 0.4, 0.4, 1), p: [-2.3, 0.5, -1.0], c: 0x0d0d0d }, { g: ball(0.4, 0.4, 0.4, 1), p: [2.3, 0.5, -1.0], c: 0x0d0d0d },
      { g: box(0.12, 1.4, 0.12), p: [0.6, 2.8, 0.4], c: 0x8791a3 }, { g: ball(0.22, 0.22, 0.22, 1), p: [0.6, 3.55, 0.4], c: 0xe2492d }
    ]);
  }
  // ── 鳥たちの夢 ──  どれも前は −z。色は鳥たちの羽の色から
  function bundamGeo() { // ブンダム。白文鳥の配色の、人の形。左に盾、右にくちばし型の光刃
    var W = 0xf4f1ea, G = 0x9aa3b2, Dk = 0x4a5261, R = 0xe04a4a, P = 0xe8707e;
    return merge([
      { g: box(1.7, 4.2, 1.9), p: [-1.3, 2.9, 0], c: W }, { g: box(1.7, 4.2, 1.9), p: [1.3, 2.9, 0], c: W },
      { g: box(2.0, 0.9, 3.0), p: [-1.3, 0.45, -0.5], c: G }, { g: box(2.0, 0.9, 3.0), p: [1.3, 0.45, -0.5], c: G },
      { g: box(4.6, 1.3, 2.4), p: [0, 5.5, 0], c: G },
      { g: box(5.6, 3.4, 3.0), p: [0, 7.8, 0], c: W },
      { g: box(2.4, 1.7, 0.5), p: [0, 7.9, -1.6], c: Dk }, { g: new T.CylinderGeometry(0.5, 0.5, 0.2, 12), p: [0, 7.9, -1.9], r: [Math.PI / 2, 0, 0], c: R },   // 胸の巣箱と、丸い入口
      { g: box(1.9, 1.9, 2.4), p: [-3.8, 8.7, 0], c: G }, { g: box(1.9, 1.9, 2.4), p: [3.8, 8.7, 0], c: G },
      { g: box(1.3, 3.8, 1.5), p: [-3.9, 6.0, 0], c: W }, { g: box(1.3, 3.8, 1.5), p: [3.9, 6.2, -0.8], r: [-0.55, 0, 0], c: W },
      { g: box(4.4, 6.4, 0.5), p: [-4.4, 6.0, -2.3], r: [0, 0.25, 0], c: W }, { g: box(4.8, 0.5, 0.6), p: [-4.4, 9.2, -2.3], r: [0, 0.25, 0], c: G },
      { g: new T.CylinderGeometry(1.25, 1.25, 0.16, 16), p: [-4.5, 6.3, -2.62], r: [Math.PI / 2, 0, 0.25], c: R }, { g: new T.CylinderGeometry(1.25, 1.25, 0.16, 16), p: [-4.3, 6.3, -1.98], r: [Math.PI / 2, 0, 0.25], c: R },
      { g: box(1.6, 0.35, 3.6), p: [0, 5.0, 2.6], r: [0.5, 0, 0], c: G }, { g: box(0.9, 0.3, 2.6), p: [0, 4.3, 3.9], r: [0.5, 0, 0], c: Dk },
      { g: box(0.36, 0.36, 5.4), p: [3.9, 5.0, -4.2], c: P }, { g: box(0.7, 0.7, 1.0), p: [3.9, 5.0, -1.4], c: Dk }
    ]);
  }
  function bundamHeadGeo() {
    return merge([
      { g: ball(1.7, 1.6, 1.7), p: [0, 0, 0], c: 0xf7f5f0 }, { g: new T.ConeGeometry(0.8, 1.9, 8), p: [0, -0.15, -2.0], r: [-Math.PI / 2, 0, 0], c: 0xe8707e },
      { g: new T.CylinderGeometry(0.42, 0.42, 0.1, 12), p: [-1.5, 0.35, -0.7], r: [0, 0, Math.PI / 2], c: 0xe04a4a }, { g: new T.CylinderGeometry(0.42, 0.42, 0.1, 12), p: [1.5, 0.35, -0.7], r: [0, 0, Math.PI / 2], c: 0xe04a4a },
      { g: ball(0.27, 0.27, 0.27, 1), p: [-1.58, 0.35, -0.7], c: 0x0d0d0d }, { g: ball(0.27, 0.27, 0.27, 1), p: [1.58, 0.35, -0.7], c: 0x0d0d0d },
      { g: box(0.16, 1.5, 1.0), p: [0, 1.9, 0.2], c: 0xe04a4a }
    ]);
  }
  function chorionGeo() { // ブンチョリオン。育てた文鳥に、鎧という名の重しを着せたもの。細長く、前かがみ
    var B0 = 0xd9bf9e, Be = 0xf0dcc4, Wg = 0xb99a78, A = 0x23262d, Au = 0xd9b24c, L = 0xeb8a8f;
    return merge([
      { g: ball(2.9, 4.6, 3.6), p: [0, 9.6, 0.4], r: [0.25, 0, 0], c: B0 }, { g: ball(2.4, 3.0, 2.6), p: [0, 8.4, -1.1], c: Be },
      { g: ball(0.45, 3.0, 2.8), p: [-2.9, 9.8, 1.0], r: [0.2, 0, 0.1], c: Wg }, { g: ball(0.45, 3.0, 2.8), p: [2.9, 9.8, 1.0], r: [0.2, 0, -0.1], c: Wg },
      { g: box(1.2, 0.4, 5.6), p: [0, 8.2, 5.4], r: [0.45, 0, 0], c: 0x8a6a48 },
      { g: new T.CylinderGeometry(0.34, 0.42, 5.8, 8), p: [-1.3, 3.2, 0.4], c: L }, { g: new T.CylinderGeometry(0.34, 0.42, 5.8, 8), p: [1.3, 3.2, 0.4], c: L },
      { g: box(0.5, 0.45, 3.0), p: [-1.3, 0.25, -0.8], c: L }, { g: box(0.5, 0.45, 3.0), p: [1.3, 0.25, -0.8], c: L },
      { g: box(0.42, 0.4, 2.2), p: [-2.0, 0.22, -0.5], r: [0, 0.5, 0], c: L }, { g: box(0.42, 0.4, 2.2), p: [2.0, 0.22, -0.5], r: [0, -0.5, 0], c: L },
      { g: box(4.4, 2.6, 0.6), p: [0, 9.9, -3.0], r: [0.2, 0, 0], c: A }, { g: box(3.0, 0.35, 0.7), p: [0, 10.7, -3.2], r: [0.2, 0, 0], c: Au },
      { g: box(5.4, 0.9, 5.6), p: [0, 6.5, 0.2], c: A }, { g: box(5.6, 0.25, 5.8), p: [0, 7.05, 0.2], c: Au },
      { g: box(0.5, 4.6, 1.6), p: [-3.3, 13.0, 0.9], r: [0, 0, 0.12], c: A }, { g: box(0.5, 4.6, 1.6), p: [3.3, 13.0, 0.9], r: [0, 0, -0.12], c: A },
      { g: box(0.55, 0.4, 1.7), p: [-3.58, 15.3, 0.9], c: Au }, { g: box(0.55, 0.4, 1.7), p: [3.58, 15.3, 0.9], c: Au }
    ]);
  }
  function chorionHeadGeo(ink) { // シナモン文鳥の頭に、額当て。ink ならセキセイインコ
    var H = ink ? 0xf2df5a : 0xb9895f, Ck = ink ? 0x6a58c8 : 0xfff6ea, Bk = ink ? 0xe7b24a : 0xeb8a8f, parts = [
      { g: ball(2.2, 2.1, 2.2), p: [0, 0, 0], c: H },
      { g: ball(0.65, 1.0, 1.2), p: [-1.75, -0.6, -0.5], c: Ck }, { g: ball(0.65, 1.0, 1.2), p: [1.75, -0.6, -0.5], c: Ck },
      { g: ball(0.34, 0.34, 0.34, 1), p: [-1.98, 0.4, -0.9], c: 0x0d0d0d }, { g: ball(0.34, 0.34, 0.34, 1), p: [1.98, 0.4, -0.9], c: 0x0d0d0d },
      { g: box(3.9, 0.9, 2.6), p: [0, 1.3, -0.4], r: [0.15, 0, 0], c: 0x23262d }, { g: box(4.0, 0.22, 2.7), p: [0, 0.82, -0.45], r: [0.15, 0, 0], c: 0xd9b24c }
    ];
    if (ink) parts.push({ g: new T.ConeGeometry(0.7, 1.3, 8), p: [0, -0.5, -2.2], r: [-2.2, 0, 0], c: Bk }, { g: box(1.1, 0.5, 0.6), p: [0, 0.2, -2.1], c: 0x4d86d9 });
    else parts.push({ g: new T.ConeGeometry(1.0, 2.3, 8), p: [0, -0.2, -2.6], r: [-Math.PI / 2, 0, 0], c: Bk });
    return merge(parts);
  }
  function inkoBodyGeo() { // インコリオンの胴と尾。飛ぶ姿
    return merge([
      { g: ball(2.2, 2.0, 4.6), p: [0, 0, 0], c: 0x7cc35a }, { g: ball(1.9, 1.5, 3.2), p: [0, -0.6, -0.6], c: 0x8fd06a },
      { g: box(1.0, 0.3, 6.4), p: [0, 0.2, 6.6], c: 0x2f6fb0 }, { g: box(2.0, 0.25, 3.0), p: [0, 0.1, 4.6], c: 0x3f86c9 },
      { g: box(4.6, 0.7, 2.2), p: [0, 0.95, 0.2], c: 0x23262d }, { g: box(4.8, 0.2, 2.4), p: [0, 1.35, 0.2], c: 0xd9b24c }
    ]);
  }
  function inkoWingGeo(sg) { // 片翼。付け根が原点。sg=1 が右、−1 が左
    return merge([{ g: box(7.5, 0.3, 3.4), p: [3.9 * sg, 0, 0.3], c: 0x4f9a3c }, { g: box(6.4, 0.32, 1.0), p: [3.6 * sg, 0.02, -1.0], c: 0xf2df5a },
      { g: box(2.6, 0.31, 2.4), p: [8.4 * sg, 0, 0.9], c: 0x2e2e33 }]);
  }
  function infGeo() { // 自衛隊の普通科
    return merge([
      { g: box(0.44, 0.95, 0.32), p: [0, 0.475, 0], c: 0x55673c },
      { g: box(0.26, 0.24, 0.26), p: [0, 1.08, 0], c: 0xe2b58f },
      { g: box(0.36, 0.2, 0.36), p: [0, 1.26, 0], c: 0x3f4d2c },
      { g: box(0.07, 0.07, 0.95), p: [0.2, 0.86, -0.42], c: 0x1f2320 }
    ]);
  }
  function tankGeo() {
    return merge([
      { g: box(0.55, 0.62, 3.7), p: [-1.02, 0.31, 0], c: 0x26271f },
      { g: box(0.55, 0.62, 3.7), p: [1.02, 0.31, 0], c: 0x26271f },
      { g: box(2.05, 0.6, 3.5), p: [0, 0.78, 0], c: 0x4d5b35 },
      { g: box(2.05, 0.3, 1.1), p: [0, 0.62, -1.75], r: [0.5, 0, 0], c: 0x44512f },
      { g: box(1.5, 0.52, 1.9), p: [0, 1.32, 0.15], c: 0x5a6a3f },
      { g: new T.CylinderGeometry(0.085, 0.085, 2.7, 6), p: [0, 1.36, -2.1], r: [Math.PI / 2, 0, 0], c: 0x2c3125 },
      { g: box(0.3, 0.2, 0.3), p: [0.4, 1.68, 0.3], c: 0x2c3125 }
    ]);
  }
  function gunGeo() { // 155mmりゅう弾砲
    return merge([
      { g: new T.CylinderGeometry(0.58, 0.58, 0.2, 10), p: [-0.9, 0.58, 0.2], r: [0, 0, Math.PI / 2], c: 0x26271f },
      { g: new T.CylinderGeometry(0.58, 0.58, 0.2, 10), p: [0.9, 0.58, 0.2], r: [0, 0, Math.PI / 2], c: 0x26271f },
      { g: box(1.3, 0.34, 2.2), p: [0, 0.62, 0.6], c: 0x4d5b35 },
      { g: box(0.2, 0.2, 3.0), p: [-0.55, 0.32, 2.3], r: [0.12, 0.2, 0], c: 0x44512f },
      { g: box(0.2, 0.2, 3.0), p: [0.55, 0.32, 2.3], r: [0.12, -0.2, 0], c: 0x44512f },
      { g: new T.CylinderGeometry(0.12, 0.15, 4.0, 8), p: [0, 1.95, -1.25], r: [-0.95, 0, 0], c: 0x33382a },
      { g: box(1.6, 1.0, 0.1), p: [0, 1.1, -0.25], r: [-0.25, 0, 0], c: 0x55633a }
    ]);
  }
  function heliGeo() {
    return merge([
      { g: box(0.95, 0.95, 3.2), p: [0, 0, 0], c: 0x4b5a36 },
      { g: box(0.7, 0.6, 1.0), p: [0, -0.12, -2.0], c: 0x44512f },
      { g: box(0.62, 0.5, 1.2), p: [0, 0.55, -0.9], c: 0x1b2a30 },
      { g: box(0.26, 0.26, 2.8), p: [0, 0.22, 2.9], c: 0x44512f },
      { g: box(0.08, 0.95, 0.55), p: [0, 0.65, 4.1], c: 0x3d482b },
      { g: box(2.7, 0.1, 0.6), p: [0, -0.12, 0.2], c: 0x3d482b },
      { g: new T.CylinderGeometry(0.19, 0.19, 0.95, 6), p: [-1.25, -0.32, 0.1], r: [Math.PI / 2, 0, 0], c: 0x26271f },
      { g: new T.CylinderGeometry(0.19, 0.19, 0.95, 6), p: [1.25, -0.32, 0.1], r: [Math.PI / 2, 0, 0], c: 0x26271f },
      { g: box(0.16, 0.3, 0.16), p: [0, 0.62, 0], c: 0x26271f }
    ]);
  }
  function rotorGeo() { return merge([{ g: box(6.6, 0.04, 0.3), p: [0, 0, 0], c: 0x1c1d19 }, { g: box(0.3, 0.04, 6.6), p: [0, 0, 0], c: 0x1c1d19 }]); }
  function jetGeo() {
    return merge([
      { g: new T.CylinderGeometry(0.28, 0.46, 5, 6), p: [0, 0, 0], r: [Math.PI / 2, 0, 0], c: 0x3e5f8f },
      { g: new T.ConeGeometry(0.28, 1.5, 6), p: [0, 0, -3.25], r: [-Math.PI / 2, 0, 0], c: 0x2f4a72 },
      { g: box(4.8, 0.08, 1.7), p: [0, -0.05, 0.5], c: 0x35547f },
      { g: box(2.3, 0.06, 0.85), p: [0, 0, 2.3], c: 0x35547f },
      { g: box(0.08, 1.15, 1.05), p: [0, 0.62, 2.15], c: 0x2f4a72 },
      { g: box(0.4, 0.3, 1.0), p: [0, 0.34, -1.3], c: 0x16242c }
    ]);
  }
  function geo(name, make) { return G[name] || (G[name] = make()); }

  // ── 画面の部品(一度だけ作る) ──
  function ensureDom(host) {
    if (dom && dom.host === host) return dom;
    host.innerHTML = '<canvas class="b-canvas"></canvas><div class="b-flash"></div>' +
      '<div class="b-top"><div class="b-title"></div><div class="b-kills">撃破 <b>0</b><small></small></div></div>' +
      '<div class="b-dario" hidden><span class="b-face"></span><p></p></div>' +
      '<div class="b-stamp" hidden><b></b><small></small></div>' +
      '<button class="b-skip" type="button">スキップ ▸▸</button>';
    dom = { host: host, canvas: host.querySelector('.b-canvas'), flash: host.querySelector('.b-flash'), title: host.querySelector('.b-title'),
      kills: host.querySelector('.b-kills b'), killsOf: host.querySelector('.b-kills small'), dario: host.querySelector('.b-dario'),
      darioP: host.querySelector('.b-dario p'), stamp: host.querySelector('.b-stamp'), stampB: host.querySelector('.b-stamp b'), stampS: host.querySelector('.b-stamp small'),
      skip: host.querySelector('.b-skip') };
    host.querySelector('.b-face').innerHTML = TF.birdSVG ? TF.birdSVG('dario') : '';
    dom.skip.addEventListener('click', function () { if (B) finish(); });
    return dom;
  }

  var SKY = { // 季節ごとの空・地面
    0: { top: '#5d9fdb', hor: '#e3edf3', ground: 0x86a85a, tree: 0x4f8a45 },
    1: { top: '#2f86d6', hor: '#cfe6f5', ground: 0x5f9648, tree: 0x2f7038 },
    2: { top: '#e39a56', hor: '#f7dfb6', ground: 0x9a8a55, tree: 0xc0562b },
    3: { top: '#8794a6', hor: '#dfe4ea', ground: 0xa3a17a, tree: 0x5c6b4e },
    snow: { top: '#93a0b2', hor: '#e9eef2', ground: 0xe8edf1, tree: 0xcfd8dd }
  };

  function play(host, spec, cb) {
    if (!available()) { cb && cb(); return null; }
    if (B) finish(true);
    var d = ensureDom(host), w, h;
    try {
      if (!renderer) { renderer = new T.WebGLRenderer({ canvas: d.canvas, antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2)); }
    } catch (e) { glOK = false; cb && cb(); return null; }
    host.hidden = false;
    w = host.clientWidth || 360; h = host.clientHeight || 640;
    renderer.setSize(w, h, false);
    var pal = (spec.season === 3 && spec.snow) ? SKY.snow : SKY[spec.season || 0];
    host.style.background = 'linear-gradient(' + pal.top + ' 0%,' + pal.hor + ' 46%,' + pal.hor + ' 100%)';
    var scene = new T.Scene();
    scene.fog = new T.Fog(new T.Color(pal.hor).getHex(), 55, 170);
    var cam = new T.PerspectiveCamera(w < h ? 64 : 46, w / h, 0.5, 400);
    scene.add(new T.HemisphereLight(0xdfeeff, 0x6f7550, 0.95));
    var sun = new T.DirectionalLight(0xfff1d0, 0.8); sun.position.set(-12, 22, 14); scene.add(sun);
    if (!matVC) matVC = new T.MeshLambertMaterial({ vertexColors: true });

    B = { spec: spec, cb: cb, host: host, scene: scene, cam: cam, t: 0, tl: [], tli: 0, scale: 1, shake: 0, trash: [], last: performance.now(), manual: false,
      pal: pal, tanks: [], helis: [], jets: [], shells: [], castle: [], banners: [], loops: [], beams: [], drones: [], eles: [], lastBoom: -1, done: false, w: w, h: h, finale: 99, end: 10, fleeing: false, ptr: 0, tptr: 0, killed: 0 };
    d.title.textContent = spec.title || '';
    d.kills.textContent = '0'; d.killsOf.textContent = ' / ' + fmt(spec.men);
    d.dario.hidden = true; d.stamp.hidden = true; d.stamp.className = 'b-stamp';
    host.classList.toggle('grave', !!spec.nuke);

    buildWorld(); buildEnemy(); buildFriends(); buildPools(); buildTimeline();
    B.tl.sort(function (a, b) { return a.t - b.t; });
    host.classList.toggle('cine', !!spec.cine);
    if (spec.maxT) B.end = Math.min(B.end, spec.maxT);
    if (spec.t0) { B.mute = true; while (B.t < spec.t0) step(1 / 30); B.mute = false; } // 見せ場まで音なしで早送り
    B.onResize = function () { if (!B) return; B.w = host.clientWidth || B.w; B.h = host.clientHeight || B.h; renderer.setSize(B.w, B.h, false); cam.aspect = B.w / B.h; cam.fov = B.w < B.h ? 64 : 46; cam.updateProjectionMatrix(); };
    root.addEventListener('resize', B.onResize);
    step(0); render();
    B.raf = requestAnimationFrame(loop);
    return { skip: function () { if (B) finish(); } };
  }

  function keep(o) { B.trash.push(o); return o; }
  function lam(color) { return keep(new T.MeshLambertMaterial({ color: color })); }

  function buildWorld() {
    var s = B.spec, pal = B.pal, sc = B.scene, i;
    var ground = new T.Mesh(keep(new T.PlaneGeometry(500, 500)), lam(pal.ground)); ground.rotation.x = -Math.PI / 2; sc.add(ground);
    // 遠くの山と木
    var hill = keep(new T.ConeGeometry(1, 1, 7)), hm = lam(shade(pal.ground, 0.72)); B.hillMat = hm;
    [[-70, -95, 42, 15], [-20, -110, 55, 19], [45, -100, 48, 16], [95, -85, 40, 13], [-115, -70, 36, 12]].forEach(function (a) { var m = new T.Mesh(hill, hm); m.position.set(a[0], a[3] / 2 - 0.5, a[1]); m.scale.set(a[2], a[3], a[2]); sc.add(m); });
    if (s.fuji) { // 富士が見える国
      var fm = keep(new T.MeshBasicMaterial({ color: 0x6f88ad, fog: false })), cap = keep(new T.MeshBasicMaterial({ color: 0xf4f7fa, fog: false }));
      var f1 = new T.Mesh(keep(new T.ConeGeometry(62, 44, 28)), fm); f1.position.set(-48, 21.5, -230); sc.add(f1);
      var f2 = new T.Mesh(keep(new T.ConeGeometry(20.5, 14.5, 28)), cap); f2.position.set(-48, 36.4, -230); sc.add(f2);
    }
    var tree = keep(new T.ConeGeometry(1.5, 4.2, 6)), tim = new T.InstancedMesh(tree, lam(pal.tree), 46), m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sv = new T.Vector3();
    for (i = 0; i < 46; i++) {
      var side = i % 2 ? 1 : -1, x = side * rnd(27, 60), z = rnd(-70, 22); if (i > 34) { x = rnd(-60, 60); z = rnd(-78, -55); }
      var k = rnd(0.8, 1.7); v.set(x, 2.1 * k, z); sv.set(k, k, k); m4.compose(v, q, sv); tim.setMatrixAt(i, m4);
    }
    tim.frustumCulled = false; sc.add(tim);
    if (s.season === 3 && s.snow) { // 雪
      var n = 420, pa = new Float32Array(n * 3);
      for (i = 0; i < n; i++) { pa[i * 3] = rnd(-45, 45); pa[i * 3 + 1] = rnd(0, 32); pa[i * 3 + 2] = rnd(-55, 34); }
      var pg = keep(new T.BufferGeometry()); pg.setAttribute('position', new T.BufferAttribute(pa, 3));
      B.snow = new T.Points(pg, keep(new T.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0.9 }))); B.snow.frustumCulled = false; sc.add(B.snow);
    }
    B.ground = ground; B.trees = tim;
    buildCastle();
  }
  // 陣。層ごと・棟ごとに別の部品にして、砲撃で吹き飛ぶようにする
  function buildCastle() {
    var s = B.spec, sc = B.scene, fort = s.fort || 0, cz = -40, i, C = CULT[s.enemy], style = C ? C.style : 'tenshu';
    var wall = (C && C.wall) || 0xeee7d8, roof = (C && C.roof) || 0x2e3440, stone = 0x868991, wood = 0x7a5a3a, post = 0x5d432b, flag = new T.Color(s.color).getHex();
    function piece(g, x, y, z, hh) { var m = new T.Mesh(keep(g), matVC); m.position.set(x, y, z); sc.add(m); B.castle.push({ m: m, hh: hh, fly: false, done: false, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 }); return m; }
    function fence(n, z) { for (var k = -n; k <= n; k++) piece(merge([{ g: box(2.3, 1.9, 0.3), p: [0, 0, 0], c: wood }, { g: box(0.25, 2.5, 0.35), p: [-1.1, 0.3, 0], c: post }]), k * 2.35, 0.95, z, 0.95); }
    function watch(x, z) {
      piece(merge([{ g: box(0.3, 5, 0.3), p: [-1.2, 0, -1.2], c: post }, { g: box(0.3, 5, 0.3), p: [1.2, 0, -1.2], c: post }, { g: box(0.3, 5, 0.3), p: [-1.2, 0, 1.2], c: post }, { g: box(0.3, 5, 0.3), p: [1.2, 0, 1.2], c: post },
        { g: box(3.2, 0.25, 3.2), p: [0, 2.4, 0], c: wood }, { g: new T.ConeGeometry(2.6, 1.2, 4), p: [0, 3.9, 0], r: [0, Math.PI / 4, 0], c: roof }]), x, 2.5, z, 2.5);
    }
    function standard(x, z, y) { piece(merge([{ g: box(0.16, 7, 0.16), p: [0, 0, 0], c: post }, { g: box(2.2, 1.4, 0.06), p: [1.15, 2.6, 0], c: flag }]), x, (y || 0) + 3.5, z, 3.5); }
    function tents(n, z) { for (var k = 0; k < n; k++) piece(merge([{ g: new T.ConeGeometry(1.7, 2.3, 6), p: [0, 0, 0], c: 0xeae3d2 }, { g: new T.ConeGeometry(0.62, 0.84, 6), p: [0, 0.84, 0], c: flag }]), (k - (n - 1) / 2) * 4.2, 1.15, z + (k % 2) * 1.5, 1.15); }
    if (style === 'tenshu') {
      if (fort >= 3) {
        var tiers = fort >= 5 ? 4 : (fort === 4 ? 3 : 2), bw = 9 + tiers * 1.1, y = 0;
        piece(merge([{ g: new T.CylinderGeometry(bw * 0.72, bw * 0.86, 2.6, 4), p: [0, 0, 0], r: [0, Math.PI / 4, 0], c: stone }]), 0, 1.3, cz, 1.3); y = 2.6;
        for (i = 0; i < tiers; i++) {
          var tw = bw * (0.82 - i * 0.16), th = 2.1;
          piece(merge([{ g: box(tw, th, tw), p: [0, 0, 0], c: wall }, { g: new T.ConeGeometry(tw * 0.86, 1.1, 4), p: [0, th / 2 + 0.5, 0], r: [0, Math.PI / 4, 0], c: roof },
            { g: box(tw * 1.12, 0.14, tw * 1.12), p: [0, th / 2 + 0.02, 0], c: roof }]), 0, y + th / 2, cz, th / 2 + 0.5);
          y += th + 0.55;
        }
        piece(merge([{ g: new T.ConeGeometry(0.28, 0.9, 5), p: [-0.7, 0, 0], c: 0xd9b24c }, { g: new T.ConeGeometry(0.28, 0.9, 5), p: [0.7, 0, 0], c: 0xd9b24c }]), 0, y + 0.3, cz, 0.45);
      } else if (fort >= 1) { // 砦:柵と物見櫓
        fence(4, cz + 6); watch(0, cz);
        if (fort >= 2) piece(merge([{ g: box(5, 2.6, 4), p: [0, 0, 0], c: wall }, { g: new T.ConeGeometry(4.2, 1.5, 4), p: [0, 2, 0], r: [0, Math.PI / 4, 0], c: roof }]), 7.5, 1.3, cz - 1, 1.3);
      } else if (C) tents(5, cz + 8);
      else { // 野陣:陣幕
        for (i = -2; i <= 2; i++) piece(merge([{ g: box(3.6, 1.7, 0.08), p: [0, 0, 0], c: 0xf1ece0 }, { g: box(3.6, 0.3, 0.1), p: [0, 0.35, 0], c: s.color }, { g: box(0.12, 2.1, 0.12), p: [-1.8, 0.1, 0], c: 0x5d432b }]), i * 3.7, 0.9, cz + 8, 0.9);
      }
    } else if (style === 'keep') { // 石の城:幕壁、隅の塔、主塔
      if (fort >= 2) {
        var kw = 11 + fort, kth = 4 + fort * 0.6, kh = 4 + fort * 1.2, cren = [{ g: box(kw, 3, kw * 0.7), p: [0, 0, 0], c: stone }];
        for (i = 0; i < 7; i++) cren.push({ g: box(kw / 14, 0.6, 0.5), p: [(i - 3) * kw / 7, 1.8, kw * 0.35 - 0.25], c: shade(stone, 0.9) });
        piece(merge(cren), 0, 1.5, cz, 1.5);
        [[-1, 1], [1, 1], [-1, -1], [1, -1]].slice(0, fort >= 4 ? 4 : 2).forEach(function (q) {
          piece(merge([{ g: new T.CylinderGeometry(1.5, 1.7, kth, 10), p: [0, 0, 0], c: 0x9a9da4 }, { g: new T.ConeGeometry(1.9, 2.2, 10), p: [0, kth / 2 + 1.1, 0], c: 0x4a5f78 }]), q[0] * kw / 2, kth / 2, cz + q[1] * kw * 0.35, kth / 2);
        });
        var kp = [{ g: box(5, kh, 5), p: [0, 0, 0], c: 0xa4a7ad }];
        for (i = 0; i < 4; i++) kp.push({ g: box(0.9, 0.7, 0.9), p: [(i % 2 ? 1 : -1) * 2.05, kh / 2 + 0.35, (i < 2 ? 1 : -1) * 2.05], c: 0x8e9198 });
        piece(merge(kp), 0, 3 + kh / 2, cz, kh / 2);
        standard(0, cz, 3 + kh - 1.5);
      } else if (fort === 1) { fence(4, cz + 6); watch(0, cz); } else tents(5, cz + 8);
    } else if (style === 'dome') { // 丸屋根と尖塔
      if (fort >= 2) {
        var dw = 10 + fort, dh = 3.2 + fort * 0.5, dr = 3 + fort * 0.35;
        piece(merge([{ g: box(dw, 2.2, dw * 0.7), p: [0, 0, 0], c: shade(wall, 0.8) }]), 0, 1.1, cz, 1.1);
        piece(merge([{ g: box(dw * 0.62, dh, dw * 0.45), p: [0, 0, 0], c: wall }, { g: box(1.6, dh * 0.7, 0.2), p: [0, -dh * 0.15, dw * 0.225], c: shade(wall, 0.45) }]), 0, 2.2 + dh / 2, cz, dh / 2);
        piece(merge([{ g: new T.SphereGeometry(dr, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), p: [0, 0, 0], c: roof }, { g: new T.ConeGeometry(0.25, 1.4, 6), p: [0, dr + 0.6, 0], c: 0xd9b24c }]), 0, 2.2 + dh, cz, dr * 0.5);
        (fort >= 4 ? [[-1, 1], [1, 1], [-1, -1], [1, -1]] : [[-1, 1], [1, 1]]).forEach(function (q) {
          piece(merge([{ g: new T.CylinderGeometry(0.5, 0.6, 8, 8), p: [0, 0, 0], c: wall }, { g: new T.CylinderGeometry(0.8, 0.8, 0.3, 8), p: [0, 2.6, 0], c: shade(wall, 0.8) }, { g: new T.ConeGeometry(0.7, 1.6, 8), p: [0, 4.8, 0], c: roof }]), q[0] * dw * 0.46, 6.2, cz + q[1] * dw * 0.3, 4);
        });
      } else if (fort === 1) { fence(4, cz + 6); watch(0, cz); } else tents(5, cz + 8);
    } else if (style === 'yurt') { // 天幕の群れ
      var ny = 3 + Math.min(4, fort);
      for (i = 0; i < ny; i++) piece(merge([{ g: new T.CylinderGeometry(2.1, 2.1, 1.6, 10), p: [0, 0, 0], c: 0xe9e2d2 }, { g: new T.ConeGeometry(2.4, 1.3, 10), p: [0, 1.45, 0], c: 0xd6cdb8 }, { g: box(0.8, 1.2, 0.1), p: [0, -0.2, 2.1], c: flag }]), (i - (ny - 1) / 2) * 6.2, 0.8, cz + 4 + (i % 2) * 4, 0.8);
      if (fort >= 3) fence(5, cz + 12);
    } else { // 柵と家々
      var nh = 2 + Math.ceil(fort / 2);
      for (i = 0; i < nh; i++) piece(merge([{ g: box(3.4, 1.8, 3), p: [0, 0, 0], c: 0x8a6a42 }, { g: new T.ConeGeometry(3.1, 2, 4), p: [0, 1.9, 0], r: [0, Math.PI / 4, 0], c: 0xb89a55 }]), (i - (nh - 1) / 2) * 6.5, 0.9, cz + 2 + (i % 2) * 3, 0.9);
      if (fort >= 1) fence(fort >= 3 ? 6 : 4, cz + 9);
      if (fort >= 2) watch(-9, cz + 7);
      if (fort >= 4) watch(9, cz + 7);
    }
    if (C && fort >= 1) { standard(-7, cz + 10.5); standard(7, cz + 10.5); } // 旗指物を背負わない軍は、陣の前に軍旗を立てる
  }

  function buildEnemy() {
    var s = B.spec, N = clamp(Math.round(Math.sqrt(s.men) * 2.3), 40, 430);
    var flag = new T.Color(s.color).getHex(), g = keep(CULT[s.enemy] ? cultureGeo(s.enemy, flag) : soldierGeo(flag, shade(flag, 0.34), 0x1d1b19));
    var im = new T.InstancedMesh(g, matVC, N); im.frustumCulled = false; B.scene.add(im);
    B.N = N; B.im = im;
    ['sx', 'sy', 'sz', 'vx', 'vy', 'vz', 'rx', 'ry', 'rz', 'wx', 'wz', 'skyY', 'ph'].forEach(function (k) { B[k] = new Float32Array(N); });
    B.st = new Uint8Array(N); B.sky = new Uint8Array(N); B.bn = new Uint8Array(N);
    var cols = Math.ceil(Math.sqrt(N * 1.9)), i;
    for (i = 0; i < N; i++) {
      var c = i % cols, r = Math.floor(i / cols);
      B.sx[i] = (c - (cols - 1) / 2) * 1.12 + rnd(-0.22, 0.22); B.sz[i] = -7 - r * 1.3 + rnd(-0.25, 0.25); B.ph[i] = rnd(0, 6.3);
    }
    B.front = -7; B.rows = Math.ceil(N / cols); B.half = cols * 0.56;
    var frac = s.win ? 1 : clamp((s.men - s.menAfter) / Math.max(1, s.men), 0.03, 0.6);
    B.budget = s.win ? N : Math.max(2, Math.round(N * frac)); B.menGoal = s.win ? s.men : (s.men - s.menAfter);
    if (s.enemy === 'india') { // 戦象。最初の砲声で、兵より先に逃げ出す
      var eg = keep(elephantGeo(flag));
      [-1, 1].forEach(function (sd) { var em = new T.Mesh(eg, matVC), ex = sd * (B.half + 3.5); em.position.set(ex, 0, -9); B.scene.add(em); B.eles.push({ m: em, x: ex, z: -9, run: false, sd: sd }); });
    }
    if (s.leader) buildLeader(flag);
    if (s.nuke) { // 影だけを残すための平たい板
      B.shadowM = new T.InstancedMesh(keep(new T.CircleGeometry(0.42, 10)), keep(new T.MeshBasicMaterial({ color: 0x14110f, transparent: true, opacity: 0.6, depthWrite: false })), N);
      B.shadowM.frustumCulled = false; var z0 = new T.Matrix4().makeScale(0, 0, 0); for (i = 0; i < N; i++) B.shadowM.setMatrixAt(i, z0); B.scene.add(B.shadowM);
    }
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function buildLeader(flag) { // 本拠の戦では、名札つきの大将が陣の奥に立つ
    var s = B.spec, m = new T.Mesh(keep(leaderGeo(s.enemy, flag)), matVC), z = -7 - B.rows * 1.3 - 3.2;
    m.scale.set(2.3, 2.3, 2.3); m.position.set(0, 0, z); B.scene.add(m);
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 112;
    var c = cv.getContext('2d'), fs = 60, name = String(s.leader), fam = 'px "Yuji Syuku","Hiragino Mincho ProN","Yu Mincho",serif';
    c.font = 'bold ' + fs + fam;
    while (fs > 24 && c.measureText(name).width > 468) { fs -= 4; c.font = 'bold ' + fs + fam; }
    var tw = Math.min(504, c.measureText(name).width + 44), x0 = (512 - tw) / 2;
    c.fillStyle = 'rgba(14,22,38,.9)'; roundRect(c, x0, 12, tw, 88, 14); c.fill();
    c.strokeStyle = s.color || '#e2492d'; c.lineWidth = 5; roundRect(c, x0, 12, tw, 88, 14); c.stroke();
    c.fillStyle = '#fff6e0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, 256, 58);
    var sp = new T.Sprite(keep(new T.SpriteMaterial({ map: keep(new T.CanvasTexture(cv)), depthWrite: false, fog: false, transparent: true })));
    sp.scale.set(9.4, 2.06, 1); sp.renderOrder = 5; B.scene.add(sp);
    B.leader = { m: m, lab: sp, x: 0, y: 0, z: z, vx: 0, vy: 0, vz: 0, wx: 0, wz: 0, st: 0 };
  }
  function leaderHit() { // 大将も空へ(三日ほどで歩いて帰ってくる)
    var L = B.leader; if (!L || L.st) return;
    L.st = 1; L.vy = 31; L.vx = rnd(-3, 3); L.vz = rnd(-4, -1); L.wx = rnd(-8, 8); L.wz = rnd(-8, 8);
    boomFx(L.x, L.z, 4.5); B.shake = Math.min(1.7, B.shake + 0.6);
  }

  function buildFriends() {
    var s = B.spec, ty = s.types, sc = B.scene, i, m4 = new T.Matrix4();
    var nInf = Math.min(3, ty.inf || 0) * 14, nAshi = Math.min(3, ty.ashi || 0) * 26;
    if (s.tier >= 2 && nAshi) { nInf += Math.round(nAshi * 0.6); nAshi = 0; } // 銃を持った現地兵は横隊で撃つ
    B.inf = []; B.ashi = [];
    if (nInf) {
      B.infM = new T.InstancedMesh(geo('inf', infGeo), matVC, nInf); B.infM.frustumCulled = false; sc.add(B.infM);
      for (i = 0; i < nInf; i++) { var row = i % 2; B.inf.push({ x: (i / (nInf - 1 || 1) - 0.5) * 30 + rnd(-0.3, 0.3), z: 12.5 + row * 1.5 + rnd(-0.2, 0.2), down: 0 }); m4.makeTranslation(B.inf[i].x, 0, B.inf[i].z); B.infM.setMatrixAt(i, m4); }
    }
    if (nAshi) {
      B.ashiG = keep(soldierGeo(0xe2492d, 0x3a2420, 0xc9a45a));
      B.ashiM = new T.InstancedMesh(B.ashiG, matVC, nAshi); B.ashiM.frustumCulled = false; sc.add(B.ashiM);
      var cols = Math.ceil(nAshi / 3);
      for (i = 0; i < nAshi; i++) B.ashi.push({ x: ((i % cols) - (cols - 1) / 2) * 1.1 + rnd(-0.2, 0.2), z: 8 + Math.floor(i / cols) * 1.3, ph: rnd(0, 6), down: 0 });
    }
    var nTank = Math.min(5, ((ty.tank || 0) + (ty.ktank || 0) + (ty.modern || 0)) * 2);
    for (i = 0; i < nTank; i++) {
      var tm = new T.Mesh(geo('tank', tankGeo), matVC), x = (i - (nTank - 1) / 2) * 5.6;
      tm.position.set(x, 0, 16 + (i % 2) * 2); sc.add(tm); B.tanks.push({ m: tm, x: x, z: 16 + (i % 2) * 2, kick: 0 });
    }
    B.nArty = Math.min(4, (ty.arty || 0) + (ty.fgun || 0));
    B.guns = [];
    for (i = 0; i < B.nArty; i++) { // 砲は手前に据える
      var gm = new T.Mesh(geo('gun', gunGeo), matVC), gx = (i - (B.nArty - 1) / 2) * 7 + (nTank ? 3.5 : 0);
      gm.position.set(gx, 0, 19); sc.add(gm); B.guns.push({ m: gm, x: gx, z: 19, kick: 0 });
    }
    B.nHeli = Math.min(2, ty.heli || 0);
    B.nJet = Math.min(2, (ty.jet || 0) + (ty.kair || 0));
    B.nNaval = Math.min(3, (ty.ddg || 0) + (ty.bb || 0) + (ty.ironclad || 0));
    B.nDrone = Math.min(3, ty.drone || 0);
    if (B.nDrone) {
      B.droneN = 16 * B.nDrone; B.droneM = new T.InstancedMesh(geo('drone', droneGeo), matVC, B.droneN); B.droneM.frustumCulled = false; sc.add(B.droneM);
      var zero = new T.Matrix4().makeScale(0, 0, 0);
      for (i = 0; i < B.droneN; i++) { B.drones.push({ on: false }); B.droneM.setMatrixAt(i, zero); }
    }
    B.nOrb = Math.min(2, ty.orbital || 0);
    var mk = ty.bunchorion ? 'bunchorion' : (ty.bundam ? 'bundam' : (ty.birdmech ? 'birdmech' : null));   // 大きな機体は、いちばん新しいものを一つだけ出す
    if (mk) { // 右うしろから跳ねてくる。[胴, 頭, 頭の高さ, 頭の前後, 光線の出る高さ, 前後]
      var MK = { birdmech: [mechGeo, mechHeadGeo, 12.2, -2.6, 11.9, -5.6], bundam: [bundamGeo, bundamHeadGeo, 11.2, -0.4, 11.0, -2.5], bunchorion: [chorionGeo, chorionHeadGeo, 14.9, -3.0, 14.6, -5.9] }[mk];
      var mg = new T.Group(), body = new T.Mesh(geo(mk, MK[0]), matVC), head = new T.Mesh(geo(mk + 'Head', function () { return MK[1](); }), matVC);
      head.position.set(0, MK[2], MK[3]); mg.add(body); mg.add(head); mg.position.set(4.2, 0, 34); sc.add(mg);
      B.mech = { g: mg, head: head, kind: mk, hy: MK[4], hz: MK[5], x: 4.2, y: 0, z: 34, hop: null, tilt: 0, beam: null, sq: 0 };
    }
    if (ty.inkorion) { // インコリオン。敵陣の上を、輪を描いて飛ぶ
      var ig = new T.Group(), ih = new T.Mesh(geo('inkoHead', function () { return chorionHeadGeo(true); }), matVC);
      var wr = new T.Mesh(geo('inkoWingR', function () { return inkoWingGeo(1); }), matVC), wl = new T.Mesh(geo('inkoWingL', function () { return inkoWingGeo(-1); }), matVC);
      ih.position.set(0, 0.9, -4.6); wr.position.set(1.6, 0.6, 0); wl.position.set(-1.6, 0.6, 0);
      ig.add(new T.Mesh(geo('inko', inkoBodyGeo), matVC)); ig.add(ih); ig.add(wr); ig.add(wl); ig.scale.set(0.62, 0.62, 0.62); ig.position.set(-40, 22, 24); sc.add(ig);
      B.inko = { g: ig, wr: wr, wl: wl, head: ih };
    }
    B.modern = !!(nInf || nTank || B.nArty || B.nHeli || B.nJet || B.nNaval || B.nDrone || B.nOrb || B.mech || B.inko);
  }

  function buildPools() {
    var sc = B.scene, n = 340, i;
    B.pn = n; B.pm = new T.InstancedMesh(keep(new T.IcosahedronGeometry(1, 1)), keep(new T.MeshBasicMaterial({ color: 0xffffff })), n); B.pm.frustumCulled = false; sc.add(B.pm);
    B.p = []; var zero = new T.Matrix4().makeScale(0, 0, 0), white = new T.Color(1, 1, 1);
    for (i = 0; i < n; i++) { B.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0, c0: new T.Color(), c1: new T.Color(), g: 0 }); B.pm.setMatrixAt(i, zero); B.pm.setColorAt(i, white); }
    B.tn = 110; B.tm = new T.InstancedMesh(keep(box(1, 1, 1)), keep(new T.MeshBasicMaterial({ color: B.spec.laser ? 0x9cecff : 0xfff0a0 })), B.tn); B.tm.frustumCulled = false; sc.add(B.tm);
    B.tr = []; for (i = 0; i < B.tn; i++) { B.tr.push({ life: 0, max: 1, a: new T.Vector3(), b: new T.Vector3(), w: 0.07, seg: 5 }); B.tm.setMatrixAt(i, zero); }
    B.rings = []; var rg = keep(new T.RingGeometry(0.82, 1, 28));
    for (i = 0; i < 10; i++) { var rm = new T.Mesh(rg, keep(new T.MeshBasicMaterial({ color: 0xfff3cf, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide }))); rm.rotation.x = -Math.PI / 2; rm.position.y = 0.06; rm.visible = false; sc.add(rm); B.rings.push({ m: rm, life: 0, r: 1 }); }
    B.craters = []; var cg = keep(new T.CircleGeometry(1, 16)), cm = keep(new T.MeshBasicMaterial({ color: 0x2a231b, transparent: true, opacity: 0.55, depthWrite: false }));
    for (i = 0; i < 26; i++) { var c = new T.Mesh(cg, cm); c.rotation.x = -Math.PI / 2; c.position.y = 0.03 + i * 0.0015; c.visible = false; sc.add(c); B.craters.push(c); }
    B.ci = 0; B.ri = 0;
    B.stars = []; var sg = keep(merge([{ g: box(2.6, 0.22, 0.05), p: [0, 0, 0], c: 0xffffff }, { g: box(0.22, 2.6, 0.05), p: [0, 0, 0], c: 0xffffff }, { g: box(1.1, 0.16, 0.05), p: [0, 0, 0], r: [0, 0, Math.PI / 4], c: 0xfff3b0 }, { g: box(0.16, 1.1, 0.05), p: [0, 0, 0], r: [0, 0, Math.PI / 4], c: 0xfff3b0 }]));
    var sm = keep(new T.MeshBasicMaterial({ vertexColors: true, fog: false }));
    for (i = 0; i < 14; i++) { var st = new T.Mesh(sg, sm); st.visible = false; sc.add(st); B.stars.push({ m: st, life: 0 }); }
    B.si = 0;
  }

  // ── 効果 ──
  function puff(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, g) {
    var p = B.p[B.ptr]; B.ptr = (B.ptr + 1) % B.pn;
    p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.s0 = s0; p.s1 = s1; p.c0.set(c0); p.c1.set(c1); p.g = g || 0;
  }
  function boomFx(x, z, r, y0) {
    var i, y = y0 || 0.5, dirt = shade(B.pal.ground, 0.55);
    puff(x, y + 0.3, z, 0, 0.5, 0, 0.26, r * 0.25, r * 0.95, 0xfff6c8, 0xff8a1f, 0);
    for (i = 0; i < 5; i++) puff(x + rnd(-r, r) * 0.22, y + rnd(0.2, 1), z + rnd(-r, r) * 0.22, rnd(-2.2, 2.2), rnd(3, 7.5), rnd(-2.2, 2.2), rnd(0.4, 0.7), r * 0.22, r * 0.5, 0xffb347, 0x5a2a12, 2);
    for (i = 0; i < 6; i++) puff(x + rnd(-r, r) * 0.3, y + rnd(0.5, 1.6), z + rnd(-r, r) * 0.3, rnd(-1.2, 1.2), rnd(2, 4.6), rnd(-1.2, 1.2), rnd(1.1, 2.1), r * 0.26, r * 0.72, 0x6e655c, 0x2b2826, 1);
    for (i = 0; i < 7; i++) { var a = rnd(0, 6.283), sp = rnd(4, 10); puff(x, y, z, Math.cos(a) * sp, rnd(6, 14), Math.sin(a) * sp, rnd(0.7, 1.15), 0.2, 0.12, dirt, dirt, -22); }
    var ring = B.rings[B.ri]; B.ri = (B.ri + 1) % B.rings.length; ring.life = 0.36; ring.r = r * 1.3; ring.m.position.set(x, 0.06, z); ring.m.visible = true;
    if (!y0) { var c = B.craters[B.ci]; B.ci = (B.ci + 1) % B.craters.length; c.position.x = x; c.position.z = z; c.scale.set(r * 0.5, r * 0.5, 1); c.visible = true; }
  }
  // 爆発。半径 r の中の兵を吹き飛ばす。p は強さ、sky は「空の星になる」確率
  function blast(x, z, r, p, sky, quiet, vr) { // vr: 見た目の大きさ(効果の半径と別にしたいとき)
    boomFx(x, z, vr || r);
    B.shake = Math.min(1.7, B.shake + 0.3 * p);
    if (!quiet && B.t - B.lastBoom > 0.09) { B.lastBoom = B.t; sfx('boom', { size: clamp(r / 3.6, 0.7, 1.7), gain: 0.42 }); }
    fling(x, z, r, p, sky);
  }
  function fling(x, z, r, p, sky) { // 半径 r の中の兵を吹き飛ばす(爆炎なし)
    var i, N = B.N, r2 = r * r, skyP = sky == null ? 0.22 * p : sky;
    for (i = 0; i < N; i++) {
      var st = B.st[i]; if (st === 3) continue;
      var dx = B.sx[i] - x, dz = B.sz[i] - z, d2 = dx * dx + dz * dz; if (d2 > r2) continue;
      if (st === 0) { if (B.killed >= B.allow) continue; B.killed++; }
      else if (st === 2 && Math.random() < 0.45) continue;
      var d = Math.sqrt(d2), f = 1 - d / r, inv = d > 0.05 ? 1 / d : 0, h = p * (2.6 + 5.2 * f);
      if (!inv) { var a = rnd(0, 6.283); dx = Math.cos(a); dz = Math.sin(a); inv = 1; }
      B.vx[i] = dx * inv * h + rnd(-1.2, 1.2); B.vz[i] = dz * inv * h + rnd(-1.2, 1.2); B.vy[i] = p * (7 + 9 * f) * rnd(0.8, 1.2);
      B.wx[i] = rnd(-10, 10); B.wz[i] = rnd(-10, 10); B.bn[i] = 1;
      B.sky[i] = (f > 0.3 && Math.random() < skyP) ? 1 : 0;
      if (B.sky[i]) { B.vy[i] = rnd(24, 34); B.skyY[i] = rnd(17, 24); }
      if (B.sy[i] < 0.06) B.sy[i] = 0.06;
      B.st[i] = 1;
    }
  }
  function tracer(ax, ay, az, bx, by, bz, life, w, seg) {
    var t = B.tr[B.tptr]; B.tptr = (B.tptr + 1) % B.tn;
    t.life = t.max = life || 0.09; t.a.set(ax, ay, az); t.b.set(bx, by, bz); t.w = w || 0.07; t.seg = seg == null ? 5 : seg; // seg=0 は端から端まで
  }
  // 砲弾・ロケット・爆弾:飛んでいって、着いたら hit を呼ぶ
  function shell(ax, ay, az, bx, bz, dur, arc, hit, w) { B.shells.push({ ax: ax, ay: ay, az: az, bx: bx, bz: bz, t0: B.t, dur: dur, arc: arc || 0, hit: hit, w: w || 0.16 }); }
  function star(x, y, z) {
    var s = B.stars[B.si]; B.si = (B.si + 1) % B.stars.length; s.life = 0.55; s.m.position.set(x, y, z); s.m.visible = true;
    if (B.t - (B.lastStar || -1) > 0.12) { B.lastStar = B.t; sfx('twinkle'); }
  }
  function flash(k, ms) {
    var el = dom.flash; if (!el.animate) return;
    try { el.animate(ms ? [{ opacity: k }, { opacity: k, offset: 0.25 }, { opacity: 0 }] : [{ opacity: k }, { opacity: 0 }], { duration: ms || 420, easing: 'ease-out' }); } catch (e) { /* 古い環境 */ }
  }
  function dust(x, z, r) { // 土ぼこりの輪(火は出ない)
    var n = Math.round(10 + r), s0 = Math.min(1.1, r * 0.16), s1 = Math.min(2.6, r * 0.36);
    for (var i = 0; i < n; i++) { var a = i / n * 6.283 + rnd(-0.2, 0.2), sp = rnd(5, 9) * Math.min(3, r / 4); puff(x + Math.cos(a) * r * 0.35, 0.4, z + Math.sin(a) * r * 0.35, Math.cos(a) * sp, rnd(0.6, 2), Math.sin(a) * sp, rnd(0.6, 1.0), s0, s1, 0xcbb994, 0x8a7d63, 0.4); }
    var ring = B.rings[B.ri]; B.ri = (B.ri + 1) % B.rings.length; ring.life = 0.36; ring.r = r * 1.5; ring.m.position.set(x, 0.06, z); ring.m.visible = true;
  }
  // 無人機の一波。敵陣のあちこちへ突っ込む
  function droneWave(n) {
    sfx('drone', { dur: 1.3 });
    for (var i = 0, k = 0; i < B.drones.length && k < n; i++) {
      var d = B.drones[i]; if (d.on) continue;
      var p = fieldPoint(); d.on = true; d.t0 = B.t + k * 0.03; d.dur = rnd(0.9, 1.45); d.ax = rnd(-B.half - 8, B.half + 8); d.ay = rnd(9, 15); d.az = 24 + rnd(0, 8); d.bx = p[0]; d.bz = p[1]; d.w = rnd(0, 6.3); k++;
    }
  }
  // 空からの光の柱。x0→x1 へ薙ぎ払う
  function beam(x0, x1, z, dur, w, onEnd) {
    var g = new T.Group();
    g.add(new T.Mesh(geo('beamO', function () { return new T.CylinderGeometry(1, 1, 200, 12, 1, true); }), keep(new T.MeshBasicMaterial({ color: 0x9cecff, transparent: true, opacity: 0.55, fog: false, depthWrite: false, side: T.DoubleSide }))));
    g.add(new T.Mesh(geo('beamI', function () { return new T.CylinderGeometry(0.42, 0.42, 200, 8); }), keep(new T.MeshBasicMaterial({ color: 0xffffff, fog: false }))));
    g.position.set(x0, 100, z); B.scene.add(g);
    B.beams.push({ g: g, t0: B.t, dur: dur, x0: x0, x1: x1, z: z, w: w, next: 0, onEnd: onEnd });
    sfx('laser', { dur: Math.max(0.7, dur) }); flash(0.35);
  }
  // 機動文鳥のひと跳ね
  function mechHop(x1, z1, h, dur, land) { var m = B.mech; if (m) m.hop = { t0: B.t, dur: dur, x0: m.x, z0: m.z, x1: x1, z1: z1, h: h, land: land }; }
  function mechLand(r) { var m = B.mech; sfx('stomp'); B.shake = Math.min(1.7, B.shake + 0.9); if (m.z < 12) dust(m.x, m.z, r || 6); fling(m.x, m.z - 1, (r || 6) * 1.1, 1.3, 0.55); m.sq = 1; }
  function say(text) {
    dom.darioP.textContent = text; dom.dario.hidden = false; B.sayUntil = B.t + 2.6; sfx('dario');
    dom.dario.classList.remove('in'); void dom.dario.offsetWidth; dom.dario.classList.add('in');
  }
  function stamp(text, sub, cls) {
    dom.stampB.textContent = text; dom.stampS.textContent = sub || ''; dom.stamp.className = 'b-stamp ' + (cls || ''); dom.stamp.hidden = false;
    void dom.stamp.offsetWidth; dom.stamp.classList.add('in'); sfx('stamp'); B.shake = Math.min(1.7, B.shake + 0.8);
  }
  function aliveTarget(frontBias) { // 生きている兵を一人選ぶ(手前の兵を優先)
    var best = -1, bz = -1e9, tries = frontBias ? 6 : 3, i, k;
    for (k = 0; k < tries; k++) { i = Math.floor(Math.random() * B.N); if (B.st[i] === 0 && B.sz[i] > bz) { bz = B.sz[i]; best = i; } }
    if (best < 0) for (i = 0; i < B.N; i++) if (B.st[i] === 0) { best = i; break; }
    return best;
  }
  function fieldPoint() { // 敵陣のどこか。生き残りがいればその近く
    var i = aliveTarget(false);
    if (i >= 0) return [B.sx[i] + rnd(-1.5, 1.5), B.sz[i] + rnd(-1.5, 1.5)];
    return [rnd(-B.half, B.half), rnd(-7 - B.rows * 1.3, -7)];
  }
  function shoot(i, back) { // 銃弾で倒れる
    if (i < 0 || B.st[i] !== 0 || B.killed >= B.allow) return;
    B.killed++; B.st[i] = 1; B.sky[i] = 0; B.bn[i] = 0;
    B.vx[i] = rnd(-1.5, 1.5); B.vy[i] = rnd(2.5, 4.5); B.vz[i] = -rnd(3, 7) * (back || 1); B.wx[i] = -rnd(5, 9); B.wz[i] = rnd(-3, 3); B.sy[i] = 0.06;
  }
  function breakCastle(n, power) {
    var left = B.castle.filter(function (c) { return !c.fly; });
    left.sort(function (a, b) { return b.m.position.y - a.m.position.y; });
    left.slice(0, n).forEach(function (c) {
      c.fly = true; c.vx = rnd(-7, 7) * power; c.vy = rnd(9, 17) * power; c.vz = rnd(-5, 8) * power; c.wx = rnd(-4, 4); c.wy = rnd(-3, 3); c.wz = rnd(-4, 4);
      boomFx(c.m.position.x + rnd(-1, 1), c.m.position.z + 1.5, 4.2, c.m.position.y);
    });
    if (left.length) { B.shake = Math.min(1.7, B.shake + 0.7); if (B.t - B.lastBoom > 0.09) { B.lastBoom = B.t; sfx('boom', { size: 1.6, gain: 0.5 }); } }
  }

  // ── 進行表 ──
  function at(t, fn) { B.tl.push({ t: t, fn: fn }); }
  function every(t0, t1, dt, fn) { for (var t = t0; t < t1; t += dt) at(t, fn); }
  function buildTimeline() {
    var s = B.spec, ty = s.types, I = clamp(s.ratio || 1, 1, 6), ground = !s.bombard, win = s.win, hasCastle = (s.fort || 0) > 0;
    var mainEnd = win ? 5.0 : (s.bombard ? 3.4 : 2.9), rate = win ? 1 : 0.45;
    B.pace = { t1: mainEnd, f: 1, release: mainEnd };
    if (s.nuke) { nukeTimeline(); return; }
    at(0.05, function () { sfx('horagai', { dur: 1.5, gain: 0.14 }); sfx('roar', { dur: 1.4, delay: 0.25 }); });
    if (B.eles.length) at(1.25, function () { B.eles.forEach(function (e) { e.run = true; }); });
    at(0.35, function () { say(s.bombard ? '砲爆撃を開始します。' : '作戦開始。勝算 ' + Math.round((s.chance || 0) * 100) + '%。'); });
    // 普通科:曳光弾と迫撃砲
    if (B.inf.length) {
      every(1.0, mainEnd + (win ? 1.2 : 0), 0.055 / rate, function () {
        var f = B.inf[Math.floor(Math.random() * B.inf.length)], i = aliveTarget(true); if (i < 0 || f.down) return;
        tracer(f.x, 1.0, f.z - 0.9, B.sx[i], 0.9, B.sz[i], s.laser ? 0.07 : 0.085, 0.06, s.laser ? 0 : 6);
        if (Math.random() < 0.3 * rate) shoot(i, 1);
      });
      every(1.0, mainEnd + (win ? 1.2 : 0), 0.42, function () { sfx('mg', { n: 6, gain: 0.16 }); });
      every(1.5, mainEnd, 0.85 / rate, function () { var p = fieldPoint(); shell(rnd(-10, 10), 16, 14, p[0], p[1], 0.5, 6, function () { blast(p[0], p[1], 3.1, 0.85 * rate + 0.2); }, 0.1); });
    }
    // 現地の兵:槍をそろえて突っ込む
    if (B.ashi.length) {
      at(0.9, function () { B.charge = true; sfx('roar', { dur: 1.6 }); });
      every(2.3, mainEnd + 1, 0.11 / rate, function () { if (!B.contact) return; var i = aliveTarget(true); if (i < 0) return; puff(B.sx[i], 0.4, B.sz[i] + 0.6, rnd(-1, 1), rnd(1, 2.5), rnd(-1, 1), 0.7, 0.3, 0.9, 0xc9b48a, 0x8a7a5c, 0.5); shoot(i, 0.6); });
      every(2.3, mainEnd + 1, 0.5, function () { if (B.contact) sfx(s.tier >= 1 ? 'volley' : 'taiko', { gain: 0.25 }); });
    }
    // 戦車:撃ちながら前へ出て、そのまま敵陣に踏み込む
    B.tanks.forEach(function (tk, k) {
      every(1.0 + k * 0.27, mainEnd + (win ? 0.6 : 0), 1.2 / rate, function () {
        var p = fieldPoint(); tk.kick = 1; sfx('cannon', { gain: 0.5 });
        puff(tk.m.position.x, 1.4, tk.m.position.z - 3.6, 0, 0.5, -3, 0.16, 0.5, 1.7, 0xfff3b0, 0xff9a2a, 0);
        puff(tk.m.position.x, 1.4, tk.m.position.z - 3.9, rnd(-0.6, 0.6), 1.2, -2.2, 0.9, 0.5, 1.5, 0x8a857d, 0x45423e, 0.6);
        shell(tk.m.position.x, 1.4, tk.m.position.z - 3.4, p[0], p[1], 0.13, 0.15, function () { blast(p[0], p[1], 4.0, 1.15 * (win ? 1 : 0.6)); }, 0.14);
      });
    });
    // 特科:空から砲弾が降ってくる。城も狙う
    if (B.nArty) {
      var shot = 0;
      every(0.9, mainEnd - 0.3, 0.6 / B.nArty / rate, function () {
        var castle = hasCastle && win && s.siege > 0 && Math.random() < 0.3 && B.t > 1.9, p = castle ? [rnd(-4, 4), -38] : fieldPoint(), g = B.guns[shot++ % B.guns.length];
        g.kick = 1; sfx('cannon', { gain: 0.45 }); sfx('whistle', { dur: 0.5, delay: 0.35 });
        puff(g.x, 3.7, g.z - 3.3, 0, 1.5, -4, 0.2, 0.7, 2.4, 0xfff3b0, 0xff9a2a, 0);
        for (var k = 0; k < 3; k++) puff(g.x + rnd(-0.5, 0.5), 3.6, g.z - 3.4, rnd(-0.8, 0.8), rnd(0.8, 2), -rnd(1, 3), rnd(0.9, 1.5), 0.6, 2.0, 0x9a958c, 0x4a4743, 0.5);
        shell(g.x, 3.7, g.z - 3.2, p[0], p[1], 0.85, 15, function () { if (castle) breakCastle(1, 0.8); else blast(p[0], p[1], 4.8, 1.3 * (win ? 1 : 0.6), 0.3); }, 0.2);
      });
    }
    // 艦砲:横から大きいのが来る
    if (B.nNaval) {
      [1.5, 3.3].forEach(function (t0, k) {
        if (!win && k) return;
        at(t0, function () { if (!k) say('艦砲射撃、弾着まで三秒。'); sfx('cannon', { gain: 0.3 }); });
        for (var j = 0; j < 2 + B.nNaval; j++) at(t0 + 0.5 + j * 0.22, function () {
          var p = fieldPoint(); sfx('whistle', { dur: 0.5 });
          shell(70, 30, p[1] + rnd(-6, 6), p[0], p[1], 0.6, 5, function () { blast(p[0], p[1], 6.4, 1.6 * (win ? 1 : 0.6), 0.45); flash(0.25); }, 0.26);
        });
      });
    }
    // 戦闘ヘリ:敵陣の上を横切りながら掃射
    for (var hI = 0; hI < B.nHeli; hI++) at(2.0 + hI * 0.5, (function (k) { return function () { heliPass(k % 2 ? -1 : 1, 2.7, -7 - k * 4); }; })(hI));
    // 戦闘機:一航過で絨毯爆撃
    if (B.nJet) at(win ? 3.3 : 1.6, function () { jetPass(1, win ? 1 : 0.6); });
    // 無人機群:波になって降ってくる
    if (B.nDrone) {
      at(1.0, function () { say('無人機群、突入します。'); });
      every(1.1, mainEnd, 1.0, function () { droneWave(Math.round(8 * B.nDrone * rate)); });
    }
    // 軌道砲:空の上から、光の柱で薙ぐ
    if (B.nOrb) {
      var bz = -7 - B.rows * 0.65;
      at(win ? 2.3 : 1.2, function () { say('軌道砲、照射。'); });
      at(win ? 2.7 : 1.6, function () { beam(-B.half - 4, B.half + 4, bz, 1.25, 1.5 * (win ? 1 : 0.6)); });
      if (B.nOrb > 1 && win) at(3.6, function () { beam(B.half + 4, -B.half - 4, bz - B.rows * 0.5, 1.1, 1.5); });
      if (hasCastle && (win || s.bombard)) at(win ? 4.3 : 2.4, function () { beam(-3, 3, -40, 0.7, 2.2, function () { breakCastle(s.bombard ? 2 : 4, 1.2); }); });
    }
    // 機動文鳥:跳ねてきて、くちばしから光線
    if (B.mech) {
      var mline = { bundam: 'ブンダム、発進。盾を前へ。……操縦席は、巣箱です。', bunchorion: 'ブンチョリオン、鎧の留め金を外します。……粟の残りは、五分ぶん。' }[B.mech.kind] || '機動文鳥、発進。……技師長、なぜ文鳥型に。';
      at(0.7, function () { say(mline); mechHop(4.2, 24, 3.5, 0.5, function () { mechLand(5); }); });
      if (s.berserk && B.mech.kind === 'bunchorion') at(2.6, function () { say('……暴走しています。命令が、届きません。'); sfx('bigchirp'); B.mech.rage = B.t; B.shake = Math.min(1.7, B.shake + 0.8); });
      at(1.4, function () { mechHop(4.0, 14, 3.5, 0.5, function () { mechLand(5); }); });
      at(2.1, function () { mechHop(3.6, 5, 4, 0.55, function () { mechLand(6); B.mech.tilt = B.t; }); });
      if (!win) at(mainEnd - 0.1, function () { mechHop(4.2, 30, 3, 0.7); });
      else {
        at(3.0, function () { var m = B.mech; m.beam = { t0: B.t, dur: 1.5, next: 0 }; sfx('laser', { dur: 1.5 }); });
      }
    }
    // インコリオン:空から、敵将の声をまねる
    if (B.inko) {
      at(B.mech ? 1.9 : 1.1, function () { say('インコリオン「テッタイ。テッタイ。テッタイ」……敵将の声を、まねています。'); sfx('bigchirp'); });
      every(2.4, mainEnd, 0.95, function () { sfx('chirp', { n: 3 }); });
    }
    if (!ground) { // 砲爆撃だけ
      at(mainEnd + 0.5, function () { say('砲爆撃、完了。守備兵 ' + fmt(s.men) + ' → ' + fmt(s.menAfter) + '。'); });
      at(mainEnd + 1.1, function () { stamp('砲爆撃', '占領には陸上部隊が要る', 'plain'); });
      B.end = mainEnd + 2.6; return;
    }
    if (!win) { // 押し切れなかった
      every(1.6, mainEnd, 0.5, function () { // 敵の反撃
        sfx('volley');
        for (var k = 0; k < 9; k++) { var i = aliveTarget(true); if (i < 0) break; tracer(B.sx[i], 1.2, B.sz[i], rnd(-14, 14), 1, 12 + rnd(0, 2), 0.16, 0.05, 3); }
        var pool = B.inf.concat(B.ashi), f = pool[Math.floor(Math.random() * pool.length)]; if (f && Math.random() < 0.7) f.down = 1;
      });
      at(mainEnd - 0.2, function () { say('押し切れません。撤退を進言します。'); B.retreat = true; });
      at(mainEnd + 0.9, function () { stamp('敗退', '敵の守りが上回った', 'lose'); sfx('defeat'); });
      B.end = mainEnd + 2.5; return;
    }
    // ── 勝ち ──
    if (hasCastle && s.siege > 0) { at(mainEnd - 0.5, function () { say('城郭に直撃。'); }); every(mainEnd - 0.4, mainEnd + 0.9, 0.34, function () { breakCastle(1, 1); }); }
    at(mainEnd, function () { B.fleeing = true; });
    var over = B.modern && I >= 1.4, f0 = mainEnd + 1.6;
    if (over) {
      at(mainEnd + 0.75, function () { say('敵はすでに壊滅しています。これ以上の攻撃は——'); });
      B.finale = f0; B.pace = { t1: mainEnd, f: 0.68, release: f0 };
      // やりすぎの締め:敵陣を端から端まで爆発で塗りつぶす
      var rows = 5, cols = 5, n = 0, depth = B.rows * 1.3 + 12;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        at(f0 + n * 0.062, (function (r, c) { return function () { blast((c - (cols - 1) / 2) * (B.half * 0.52 + 2.2) + rnd(-1.5, 1.5), -4 - r * depth / rows + rnd(-1, 1), 6.2, 1.7, 0.7); }; })(r, c));
        n++;
      }
      at(f0 + 0.1, function () { flash(0.5); });
      if (B.nHeli) at(f0 + 0.2, function () { heliPass(-1, 2.2, -10); });
      if (B.nJet) at(f0 + 0.5, function () { jetPass(-1, 1.2); });
      if (hasCastle) at(f0 + 1.0, function () { breakCastle(9, 1.5); flash(0.4); });
      if (B.nDrone) at(f0 + 0.25, function () { droneWave(B.droneN); });
      if (B.nOrb) at(f0 + 0.6, function () { beam(-B.half - 4, B.half + 4, -12, 0.8, 2.4); });
      if (B.mech) at(f0 + 0.8, function () { mechHop(0, -13, 13, 0.65, function () { mechLand(12); }); }); // 敵陣のまん中へ、ぴょんと
      at(f0 + 1.45, function () { B.scale = 0.3; flash(0.85); blast(0, -14, 70, 2.2, 0.9, true, 12); blast(-9, -20, 1, 1, 0, true, 8); blast(9, -20, 1, 1, 0, true, 8); sfx('boom', { size: 1.7, gain: 0.85 }); leaderHit(); });
      at(f0 + 1.85, function () { B.scale = 1; });
      at(f0 + 2.5, function () { say(I >= 3 ? '……' + Math.round(I * 100) + '%のオーバーキルです、司令。' : '……制圧を確認しました。'); });
      if (B.mech) { at(f0 + 1.95, function () { B.mech.turn = B.t; }); at(f0 + 2.4, function () { B.mech.tilt = B.t; sfx('bigchirp'); }); }
      at(f0 + 2.9, function () { raiseBanners(); stamp('殲滅', 'オーバーキル ' + Math.round((s.ratio || 1) * 100) + '%', 'win'); });
      B.end = f0 + 4.6;
    } else {
      B.pace = { t1: mainEnd, f: 0.85, release: mainEnd + 0.3 };
      at(mainEnd + 1.3, function () { leaderHit(); if (B.leader) sfx('boom', { size: 1.1, gain: 0.5 }); });
      at(mainEnd + 1.5, function () { for (var i = 0; i < B.N; i++) if (B.st[i] === 0) shoot(i, 0.5); });
      at(mainEnd + 1.9, function () { raiseBanners(); stamp('制圧', '', 'win'); if (!B.modern) sfx('roar', { dur: 1.2 }); if (B.mech) { B.mech.turn = B.t; B.mech.tilt = B.t + 0.4; sfx('bigchirp'); } });
      B.end = mainEnd + 3.5;
    }
  }
  // 核。法螺貝も鬨の声もない。兵は吹き飛ばず、影だけを残して消える
  function nukeTimeline() {
    var s = B.spec, gx = 0, gz = -20;
    B.budget = 0; B.pace = { t1: 99, f: 0, release: 99 };
    at(0.5, function () { say('……司令。再考を求めます。'); });
    at(2.4, function () { sfx('whistle', { dur: 1.3 }); shell(52, 160, -80, gx, gz, 1.5, 0, function () { detonate(gx, gz); }, 0.3); });
    at(7.6, function () { say('守備兵 ' + fmt(s.men) + ' → ' + fmt(s.menAfter) + '。……記録しました。'); });
    at(9.0, function () { stamp('核攻撃', 'この土地は、長く焦土になる', 'grave'); });
    B.end = 11.2;
  }
  function detonate(x, z) {
    var i, N = B.N, m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sv = new T.Vector3();
    B.nk = { t0: B.t, x: x, z: z }; B.finale = B.t;
    flash(1, 3200); sfx('nuke'); B.shake = 1.7;
    for (i = 0; i < N; i++) { // 影は爆心から外へ伸びる
      if (B.st[i] !== 3) { var dx = B.sx[i] - x, dz = B.sz[i] - z; e.set(-Math.PI / 2, Math.atan2(dx, dz), 0, 'YXZ'); q.setFromEuler(e); v.set(B.sx[i], 0.05, B.sz[i]); sv.set(1, 2.6, 1); m4.compose(v, q, sv); B.shadowM.setMatrixAt(i, m4); }
      B.st[i] = 3;
    }
    B.shadowM.instanceMatrix.needsUpdate = true;
    B.castle.forEach(function (c) { c.m.visible = false; c.fly = true; c.done = true; });
    B.eles.forEach(function (el) { el.m.visible = false; });
    if (B.leader) { B.leader.st = 2; B.leader.m.visible = false; B.leader.lab.visible = false; }
    if (B.trees) B.trees.visible = false;
    if (B.snow) B.snow.visible = false;
    B.ground.material.color.set(0x4a4038); B.hillMat.color.set(0x4f453c); B.scene.fog.color.set(0x8a6a52); B.scene.fog.near = 70; B.scene.fog.far = 260;
    B.host.style.background = 'linear-gradient(#2d2622 0%,#6e5140 45%,#b58a5e 100%)';
    // きのこ雲:傘と柱
    var cap = new T.Mesh(geo('ball2', function () { return new T.IcosahedronGeometry(1, 2); }), keep(new T.MeshBasicMaterial({ color: 0xfff6d8, fog: false })));
    var stem = new T.Mesh(geo('stem', function () { return new T.CylinderGeometry(1, 1.5, 1, 12); }), keep(new T.MeshBasicMaterial({ color: 0x5a4a3e, fog: false })));
    var ring = new T.Mesh(geo('nring', function () { return new T.RingGeometry(0.9, 1, 48); }), keep(new T.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide, fog: false })));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.1, z);
    B.scene.add(cap); B.scene.add(stem); B.scene.add(ring);
    B.nk.cap = cap; B.nk.stem = stem; B.nk.ring = ring;
  }

  function heliPass(dir, dur, z) {
    var m = new T.Mesh(geo('heli', heliGeo), matVC), r = new T.Mesh(geo('rotor', rotorGeo), matVC), g = new T.Group();
    r.position.y = 0.82; g.add(m); g.add(r); B.scene.add(g);
    var stop = TF.sfx ? TF.sfx.loop('heli') : function () {}; B.loops.push(stop);
    B.helis.push({ g: g, r: r, t0: B.t, dur: dur, dir: dir, z: z, next: 0, stop: stop });
  }
  function jetPass(dir, power) {
    sfx('jet', { dur: 1.5 });
    for (var k = 0; k < Math.max(1, B.nJet); k++) {
      var m = new T.Mesh(geo('jet', jetGeo), matVC); B.scene.add(m);
      B.jets.push({ m: m, t0: B.t + k * 0.12, dur: 1.15, dir: dir, off: k * 5 - 2 });
    }
    for (var i = 0; i < 9; i++) (function (i) {
      var x = dir * (-B.half - 2 + i * (B.half * 2 + 4) / 8), z = -9 - i * 0.9 * dir - B.rows * 0.4;
      B.tl.push({ t: B.t + 0.42 + i * 0.07, fn: function () { blast(x + rnd(-1.5, 1.5), z + rnd(-2, 2), 5.2, 1.45 * power, 0.5); } });
    })(i);
    B.tl.sort(function (a, b) { return a.t - b.t; });
    B.tl.splice(0, B.tli); B.tli = 0;
  }
  function raiseBanners() { // 「天下布鳥」の幟を立てる
    var cv = document.createElement('canvas'); cv.width = 128; cv.height = 400;
    var c = cv.getContext('2d'); c.fillStyle = '#e2492d'; c.fillRect(0, 0, 128, 400); c.strokeStyle = '#fff3c4'; c.lineWidth = 6; c.strokeRect(5, 5, 118, 390);
    c.fillStyle = '#fffaf0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'bold 78px "Yuji Syuku","Hiragino Mincho ProN","Yu Mincho",serif';
    ['天', '下', '布', '鳥'].forEach(function (ch, i) { c.fillText(ch, 64, 62 + i * 92); });
    var tex = keep(new T.CanvasTexture(cv)), fm = keep(new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide })), fg = keep(new T.PlaneGeometry(2.7, 8.4)), pg = keep(box(0.18, 11.6, 0.18)), pm = lam(0x3b2c1e);
    [[0, -9], [-8.5, -15], [8.5, -15]].forEach(function (p, i) {
      var g = new T.Group(), flag = new T.Mesh(fg, fm), pole = new T.Mesh(pg, pm);
      flag.position.set(1.45, 7.3, 0); pole.position.set(0, 5.8, 0); g.add(flag); g.add(pole); g.position.set(p[0], 0, p[1]); g.scale.set(1, 0.001, 1); B.scene.add(g);
      B.banners.push({ g: g, t0: B.t + i * 0.12 });
    });
  }

  // ── 毎フレーム ──
  var M = null, Q = null, E3 = null, V = null, SV = null, ZA = null, DIR = null, CA = null, CB = null;
  function step(dt) {
    if (!M) { M = new T.Matrix4(); Q = new T.Quaternion(); E3 = new T.Euler(); V = new T.Vector3(); SV = new T.Vector3(); ZA = new T.Vector3(0, 0, 1); DIR = new T.Vector3(); CA = new T.Color(); CB = new T.Color(); }
    var s = B.spec, i, t;
    B.t += dt; t = B.t;
    // いちどきに倒しすぎない:主戦のあいだは少しずつ、締めで残り全部
    var pc = B.pace; B.allow = Math.min(B.budget, Math.round(B.budget * (t >= pc.release ? 1 : pc.f * clamp((t - 0.9) / (pc.t1 - 0.9), 0, 1))));
    while (B.tli < B.tl.length && B.tl[B.tli].t <= t) { var ev = B.tl[B.tli++]; ev.fn(); }
    // 敵兵
    var N = B.N, tanks = B.tanks, alive = 0, adv = (!B.fleeing && t > 0.6 && t < 3.2) ? 0.9 : 0;
    for (i = 0; i < N; i++) {
      var st = B.st[i];
      if (st === 0) {
        alive++;
        if (B.fleeing) { B.sz[i] -= 4.2 * dt; B.ry[i] = Math.PI; } else if (adv && B.sz[i] < 1) B.sz[i] += adv * dt;
        for (var k = 0; k < tanks.length; k++) { // 戦車に轢かれ…ではなく、はね飛ばされる
          var tx = B.sx[i] - tanks[k].m.position.x, tz = B.sz[i] - (tanks[k].m.position.z - 1.4);
          if (tx * tx < 2.2 && tz * tz < 5 && B.killed < B.allow) { B.killed++; B.st[i] = 1; B.sky[i] = Math.random() < 0.3 ? 1 : 0; B.bn[i] = 1; B.vx[i] = tx * 4 + rnd(-2, 2); B.vy[i] = B.sky[i] ? rnd(24, 32) : rnd(7, 12); B.vz[i] = -rnd(5, 10); B.wx[i] = rnd(-9, 9); B.wz[i] = rnd(-9, 9); B.skyY[i] = rnd(17, 24); B.sy[i] = 0.06; break; }
        }
        V.set(B.sx[i], Math.abs(Math.sin(t * 7 + B.ph[i])) * (B.fleeing ? 0.22 : 0.07), B.sz[i]); E3.set(0, B.ry[i], 0);
      } else if (st === 1) {
        B.vy[i] -= (B.sky[i] ? 7 : 22) * dt; B.sx[i] += B.vx[i] * dt; B.sy[i] += B.vy[i] * dt; B.sz[i] += B.vz[i] * dt; B.rx[i] += B.wx[i] * dt; B.rz[i] += B.wz[i] * dt;
        if (B.sky[i] && B.sy[i] > B.skyY[i]) { B.st[i] = 3; star(B.sx[i], B.sy[i], B.sz[i]); }
        else if (B.sy[i] <= 0.12 && B.vy[i] < 0) {
          if (B.bn[i] && B.vy[i] < -6) { B.bn[i] = 0; B.vy[i] *= -0.32; B.vx[i] *= 0.55; B.vz[i] *= 0.55; B.sy[i] = 0.13; }
          else { B.st[i] = 2; B.sy[i] = 0.16; B.rx[i] = Math.PI / 2 * (B.rx[i] > 0 ? 1 : -1); B.rz[i] = rnd(-0.5, 0.5); }
        }
        V.set(B.sx[i], B.sy[i], B.sz[i]); E3.set(B.rx[i], B.ry[i], B.rz[i]);
      } else if (st === 2) { V.set(B.sx[i], B.sy[i], B.sz[i]); E3.set(B.rx[i], B.ry[i], B.rz[i]); }
      if (B.st[i] === 3) SV.set(0, 0, 0); else SV.set(1, 1, 1);
      Q.setFromEuler(E3); M.compose(V, Q, SV); B.im.setMatrixAt(i, M);
    }
    B.im.instanceMatrix.needsUpdate = true; B.alive = alive;
    for (i = 0; i < B.eles.length; i++) { var el = B.eles[i]; if (el.run) { el.z -= 9 * dt; el.x += el.sd * 2.5 * dt; } el.m.position.set(el.x, el.run ? Math.abs(Math.sin(t * 9 + i)) * 0.35 : 0, el.z); el.m.rotation.y = el.run ? Math.PI - el.sd * 0.25 : 0; if (el.z < -90) el.m.visible = false; }
    if (B.leader) {
      var L = B.leader;
      if (L.st === 1) { L.vy -= 6 * dt; L.x += L.vx * dt; L.y += L.vy * dt; L.z += L.vz * dt; L.m.rotation.x += L.wx * dt; L.m.rotation.z += L.wz * dt; if (L.y > 30) { L.st = 2; L.m.visible = false; L.lab.visible = false; star(L.x, L.y, L.z); star(L.x + 2.5, L.y - 2, L.z); } }
      else if (L.st === 0) L.y = Math.abs(Math.sin(t * (B.fleeing ? 11 : 4))) * (B.fleeing ? 0.45 : 0.06); // 負けが見えると、うろたえる
      L.m.position.set(L.x, L.y, L.z); L.lab.position.set(L.x, L.y + 5.3, L.z);
    }
    var shown = Math.round(B.killed / Math.max(1, B.budget) * B.menGoal);
    if (shown !== B.shown) { B.shown = shown; dom.kills.textContent = fmt(shown); }
    // 味方の歩兵
    if (B.infM) {
      for (i = 0; i < B.inf.length; i++) { var f = B.inf[i]; if (B.retreat && !f.down) f.z += 2.2 * dt; V.set(f.x, f.down ? 0.16 : 0, f.z); E3.set(f.down ? Math.PI / 2 : 0, B.retreat && !f.down ? Math.PI : 0, 0); Q.setFromEuler(E3); SV.set(1, 1, 1); M.compose(V, Q, SV); B.infM.setMatrixAt(i, M); }
      B.infM.instanceMatrix.needsUpdate = true;
    }
    if (B.ashiM) {
      var fr = -1e9; for (i = 0; i < N; i++) if (B.st[i] === 0 && B.sz[i] > fr) fr = B.sz[i];
      for (i = 0; i < B.ashi.length; i++) {
        var a = B.ashi[i];
        if (!a.down) { if (B.retreat) a.z += 3 * dt; else if (B.charge && (fr < -1e8 ? a.z > -30 : a.z > fr + 1.3 + (i % 3) * 1.1)) a.z -= 5.5 * dt; else if (B.charge) B.contact = true; }
        V.set(a.x, a.down ? 0.16 : Math.abs(Math.sin(t * 9 + a.ph)) * 0.16, a.z); E3.set(a.down ? Math.PI / 2 : 0, B.retreat && !a.down ? 0 : Math.PI, 0); Q.setFromEuler(E3); SV.set(1, 1, 1); M.compose(V, Q, SV); B.ashiM.setMatrixAt(i, M);
      }
      B.ashiM.instanceMatrix.needsUpdate = true;
    }
    // 戦車
    for (i = 0; i < tanks.length; i++) {
      var tk = tanks[i];
      if (B.retreat) tk.z += 2.4 * dt; else if (!s.nuke && t > 1.2 && tk.z > (s.win ? -9 - (i % 2) * 5 : 9)) tk.z -= (s.win ? 4.1 : 1.8) * dt;
      tk.kick = Math.max(0, tk.kick - dt * 5);
      tk.m.position.set(tk.x, 0, tk.z + tk.kick * 0.42); tk.m.rotation.x = -tk.kick * 0.07;
      if (!B.retreat && tk.z < 15 && Math.random() < dt * 9) puff(tk.x + rnd(-1, 1), 0.3, tk.z + 2.2, rnd(-0.6, 0.6), rnd(0.6, 1.6), rnd(0.5, 2), 0.8, 0.4, 1.3, 0xb7a784, 0x8a7d63, 0.3);
    }
    for (i = 0; i < B.guns.length; i++) { var gn = B.guns[i]; gn.kick = Math.max(0, gn.kick - dt * 3.2); gn.m.position.z = gn.z + gn.kick * 0.7; gn.m.rotation.x = -gn.kick * 0.05; }
    // ヘリ
    for (i = B.helis.length - 1; i >= 0; i--) {
      var hl = B.helis[i], hk = (t - hl.t0) / hl.dur;
      if (hk >= 1) { B.scene.remove(hl.g); hl.stop(); B.helis.splice(i, 1); continue; }
      var hx = hl.dir * (-44 + 88 * hk), hy = 8 + Math.sin(hk * 7) * 0.5, hz = hl.z + Math.sin(hk * Math.PI) * 3;
      hl.g.position.set(hx, hy, hz); hl.g.rotation.set(-0.22, -hl.dir * Math.PI / 2, 0, 'YXZ'); hl.r.rotation.y += dt * 30; // 機首を下げて突っ込む
      if (t > hl.next && Math.abs(hx) < B.half + 8) {
        hl.next = t + 0.2;
        var p = [hx + hl.dir * 5 + rnd(-3, 3), hz + rnd(-7, 3)];
        sfx('rocket'); shell(hx, hy - 0.5, hz, p[0], p[1], 0.26, 0, (function (p) { return function () { blast(p[0], p[1], 3.8, 1.1, 0.35); }; })(p), 0.11);
        for (var j = 0; j < 4; j++) { var ti = aliveTarget(false); if (ti >= 0 && Math.abs(B.sx[ti] - hx) < 12) { tracer(hx, hy - 0.6, hz, B.sx[ti], 0.8, B.sz[ti], 0.07, 0.06, 7); if (Math.random() < 0.5) shoot(ti, 0.7); } }
      }
    }
    // 戦闘機
    for (i = B.jets.length - 1; i >= 0; i--) {
      var jt = B.jets[i], jk = (t - jt.t0) / jt.dur;
      if (jk >= 1) { B.scene.remove(jt.m); B.jets.splice(i, 1); continue; }
      if (jk < 0) { jt.m.visible = false; continue; }
      jt.m.visible = true; jt.m.position.set(jt.dir * (-85 + 170 * jk), 13 + jt.off * 0.3, -14 + jt.off + jk * 6 * jt.dir); jt.m.rotation.set(0, -jt.dir * Math.PI / 2, jt.dir * 0.35, 'YXZ');
      if (Math.random() < dt * 40) puff(jt.m.position.x - jt.dir * 3, jt.m.position.y, jt.m.position.z, 0, 0, 0, 0.5, 0.35, 0.9, 0xffffff, 0xd8dee6, 0);
    }
    // 無人機
    if (B.droneM) {
      for (i = 0; i < B.drones.length; i++) {
        var dr = B.drones[i]; if (!dr.on) continue;
        var dk = (t - dr.t0) / dr.dur;
        if (dk >= 1) { dr.on = false; M.makeScale(0, 0, 0); B.droneM.setMatrixAt(i, M); blast(dr.bx, dr.bz, 2.7, 0.95, 0.3, false, 2.3); continue; }
        if (dk < 0) continue;
        var de = dk * dk;
        V.set(dr.ax + (dr.bx - dr.ax) * dk + Math.sin(dk * 9 + dr.w) * 0.7 * (1 - dk), dr.ay * (1 - de) + 0.6, dr.az + (dr.bz - dr.az) * dk);
        E3.set(-0.5 - dk * 0.6, Math.atan2(dr.ax - dr.bx, dr.az - dr.bz), 0, 'YXZ'); Q.setFromEuler(E3); SV.set(1.7, 1.7, 1.7); M.compose(V, Q, SV); B.droneM.setMatrixAt(i, M);
      }
      E3.set(0, 0, 0, 'XYZ'); B.droneM.instanceMatrix.needsUpdate = true;
    }
    // 光の柱
    for (i = B.beams.length - 1; i >= 0; i--) {
      var bm = B.beams[i], bk2 = (t - bm.t0) / bm.dur;
      if (bk2 >= 1) { B.scene.remove(bm.g); B.beams.splice(i, 1); if (bm.onEnd) bm.onEnd(); continue; }
      var bx = bm.x0 + (bm.x1 - bm.x0) * bk2, bw = bm.w * Math.min(1, bk2 * 8, (1 - bk2) * 6) * (1 + 0.12 * Math.sin(t * 46));
      bm.g.position.x = bx; bm.g.scale.set(bw, 1, bw);
      if (t > bm.next) { bm.next = t + 0.07; blast(bx, bm.z + rnd(-3, 3), 5.6, 1.6, 0.6, false, 4.4); puff(bx, 1.2, bm.z, 0, 2, 0, 0.3, 2.5, 5, 0xffffff, 0x9cecff, 0); }
    }
    // インコリオン:敵陣の上を、大きな輪を描いて飛ぶ
    if (B.inko) {
      var ik = B.inko, ia = t * 0.85 + 2.6, ir = 7.5, en = 1 - smooth(t / 1.3), fl = Math.sin(t * 7.5) * 0.5;
      ik.g.position.set(Math.sin(ia) * ir - 22 * en, 12.5 + Math.sin(t * 2.3) * 0.6 + 6 * en, -11 + Math.cos(ia) * 8 + 12 * en);
      ik.g.rotation.set(0, Math.atan2(-Math.cos(ia) * ir, Math.sin(ia) * 8), -0.28 * Math.cos(ia), 'YXZ');
      ik.wr.rotation.z = 0.15 + fl; ik.wl.rotation.z = -0.15 - fl; ik.head.rotation.y = Math.sin(t * 2.6) * 0.5;
    }
    // 機動文鳥
    if (B.mech) {
      var mc = B.mech, hp = mc.hop;
      if (hp) {
        var mk = (t - hp.t0) / hp.dur;
        if (mk >= 1) { mc.x = hp.x1; mc.z = hp.z1; mc.y = 0; mc.hop = null; if (hp.land) hp.land(); }
        else { mc.x = hp.x0 + (hp.x1 - hp.x0) * mk; mc.z = hp.z0 + (hp.z1 - hp.z0) * mk; mc.y = 4 * hp.h * mk * (1 - mk); }
      }
      mc.sq = Math.max(0, mc.sq - dt * 4);
      mc.g.position.set(mc.x, mc.y, mc.z); mc.g.scale.set(1 + mc.sq * 0.06, 1 - mc.sq * 0.1, 1 + mc.sq * 0.06);
      mc.g.rotation.x = hp ? -0.12 : 0;
      if (mc.rage) mc.g.rotation.z = Math.sin(t * 31) * 0.045;   // 暴走:小刻みに震える
      var tk2 = mc.tilt ? (t - mc.tilt) / 0.9 : 2; // 首をかしげる
      mc.head.rotation.z = tk2 < 1 ? Math.sin(tk2 * Math.PI) * 0.42 : 0; mc.head.rotation.y = Math.sin(t * 2.1) * 0.8; // 鳥なので、きょろきょろする
      if (mc.turn) mc.g.rotation.y = Math.PI * smooth((t - mc.turn) / 0.45); // こちらを振り向く
      if (mc.beam) { // くちばしから光線。敵陣を左から右へ
        var mb = mc.beam, mbk = (t - mb.t0) / mb.dur;
        if (mbk >= 1) mc.beam = null;
        else {
          var tx2 = (-B.half - 3) + (B.half * 2 + 6) * mbk, tz2 = -7 - B.rows * 0.65 + Math.sin(mbk * 9) * B.rows * 0.4, hy = mc.y + mc.hy, hz = mc.z + mc.hz;
          mc.head.rotation.y = Math.atan2(mc.x - tx2, mc.z - tz2) * 0.6;
          tracer(mc.x, hy, hz, tx2, 0.3, tz2, 0.05, 0.55, 0); tracer(mc.x, hy, hz, tx2, 0.3, tz2, 0.05, 0.2, 0);
          if (t > mb.next) { mb.next = t + 0.06; blast(tx2, tz2, 5.4, 1.55, 0.6, false, 4.2); }
        }
      }
    }
    // きのこ雲
    if (B.nk) {
      var nk = B.nk, nt = t - nk.t0, cr = 3 + 15 * smooth(nt / 2.6), cy = 4 + 34 * smooth((nt - 0.3) / 5.5), hot = clamp(1 - nt / 2.2, 0, 1), sr = 2.2 + 2.6 * smooth(nt / 3);
      nk.cap.position.set(nk.x, cy, nk.z); nk.cap.scale.set(cr * 1.3, cr * 0.72, cr * 1.3);
      CA.setHex(0x51443b); CB.setHex(nt < 0.7 ? 0xfff6d8 : 0xff8a2a); nk.cap.material.color.copy(CA).lerp(CB, hot);
      nk.stem.position.set(nk.x, cy / 2, nk.z); nk.stem.scale.set(sr, Math.max(0.1, cy), sr); nk.stem.material.color.copy(CA).lerp(CB, hot * 0.6);
      var rr = 4 + 150 * (1 - Math.pow(1 - clamp(nt / 2.4, 0, 1), 2)); nk.ring.scale.set(rr, rr, 1); nk.ring.material.opacity = 0.8 * clamp(1 - nt / 2.4, 0, 1);
      if (nt < 5 && Math.random() < dt * 34) { var na = rnd(0, 6.283), nr = Math.min(34, 6 + nt * 9); puff(nk.x + Math.cos(na) * nr, rnd(0.5, 2.5), nk.z + Math.sin(na) * nr, Math.cos(na) * 5, rnd(0.5, 2), Math.sin(na) * 5, rnd(1.6, 2.6), 2.5, 6.5, 0x8a7560, 0x3d342d, 0.3); }
      if (nt > 0.6 && nt < 6 && Math.random() < dt * 22) { var ca2 = rnd(0, 6.283); puff(nk.x + Math.cos(ca2) * cr * 1.1, cy + rnd(-1, 1) * cr * 0.4, nk.z + Math.sin(ca2) * cr * 1.1, Math.cos(ca2) * 1.5, rnd(0.5, 2), Math.sin(ca2) * 1.5, rnd(1.5, 2.5), cr * 0.3, cr * 0.5, nt < 2 ? 0xffb347 : 0x6a5a4e, 0x3d342d, 0); }
    }
    // 砲弾
    for (i = B.shells.length - 1; i >= 0; i--) {
      var sh = B.shells[i], sk = (t - sh.t0) / sh.dur;
      if (sk >= 1) { B.shells.splice(i, 1); sh.hit(); continue; }
      var k0 = Math.max(0, sk - 0.16), x0 = sh.ax + (sh.bx - sh.ax) * k0, y0 = sh.ay + (0 - sh.ay) * k0 + Math.sin(k0 * Math.PI) * sh.arc, z0 = sh.az + (sh.bz - sh.az) * k0;
      var x1 = sh.ax + (sh.bx - sh.ax) * sk, y1 = sh.ay + (0 - sh.ay) * sk + Math.sin(sk * Math.PI) * sh.arc, z1 = sh.az + (sh.bz - sh.az) * sk;
      tracer(x0, y0, z0, x1, y1, z1, 0.03, sh.w, 0);
    }
    // 曳光弾
    for (i = 0; i < B.tn; i++) {
      var tr = B.tr[i];
      if (tr.life <= 0) { if (tr.on) { tr.on = false; M.makeScale(0, 0, 0); B.tm.setMatrixAt(i, M); } continue; }
      tr.on = true; tr.life -= dt;
      DIR.subVectors(tr.b, tr.a); var len = DIR.length() || 0.001, kk = 1 - Math.max(0, tr.life) / tr.max, seg = tr.seg ? Math.min(tr.seg, len) : len;
      DIR.multiplyScalar(1 / len); Q.setFromUnitVectors(ZA, DIR);
      var mid = tr.seg ? (seg / 2 + (len - seg) * kk) : len / 2; V.copy(tr.a).addScaledVector(DIR, mid); SV.set(tr.w, tr.w, seg); M.compose(V, Q, SV); B.tm.setMatrixAt(i, M);
    }
    B.tm.instanceMatrix.needsUpdate = true;
    // 煙と火
    for (i = 0; i < B.pn; i++) {
      var p = B.p[i]; if (p.life <= 0) { if (p.on) { p.on = false; M.makeScale(0, 0, 0); B.pm.setMatrixAt(i, M); } continue; }
      p.on = true; p.life -= dt; var pk = 1 - Math.max(0, p.life) / p.max;
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.g < 0 && p.y < 0.1) { p.y = 0.1; p.vx = p.vz = 0; }
      var sz = (p.s0 + (p.s1 - p.s0) * Math.sqrt(pk)) * (pk > 0.72 ? (1 - pk) / 0.28 : 1);
      V.set(p.x, p.y, p.z); SV.set(sz, sz, sz); Q.set(0, 0, 0, 1); M.compose(V, Q, SV); B.pm.setMatrixAt(i, M);
      CA.copy(p.c0).lerp(p.c1, Math.min(1, pk * 1.4)); B.pm.setColorAt(i, CA);
    }
    B.pm.instanceMatrix.needsUpdate = true; if (B.pm.instanceColor) B.pm.instanceColor.needsUpdate = true;
    for (i = 0; i < B.rings.length; i++) { var rg = B.rings[i]; if (rg.life <= 0) { rg.m.visible = false; continue; } rg.life -= dt; var rk = 1 - Math.max(0, rg.life) / 0.36, rs = 0.4 + rg.r * rk; rg.m.scale.set(rs, rs, 1); rg.m.material.opacity = 0.75 * (1 - rk); }
    for (i = 0; i < B.stars.length; i++) { var sr = B.stars[i]; if (sr.life <= 0) { sr.m.visible = false; continue; } sr.life -= dt; var k2 = 1 - Math.max(0, sr.life) / 0.55, ss = Math.sin(k2 * Math.PI) * 1.5; sr.m.scale.set(ss, ss, ss); sr.m.quaternion.copy(B.cam.quaternion); sr.m.rotateZ(k2 * 1.6); }
    // 城の破片
    for (i = 0; i < B.castle.length; i++) {
      var c = B.castle[i]; if (!c.fly || c.done) continue;
      c.vy -= 24 * dt; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt; c.m.rotation.x += c.wx * dt; c.m.rotation.y += c.wy * dt; c.m.rotation.z += c.wz * dt;
      if (c.m.position.y < c.hh * 0.6 && c.vy < 0) { if (c.vy < -9) { c.vy *= -0.25; c.vx *= 0.5; c.vz *= 0.5; c.wx *= 0.5; c.wz *= 0.5; puff(c.m.position.x, 0.5, c.m.position.z, 0, 2, 0, 1, 1.2, 3, 0xb7a784, 0x6e655c, 0.5); } else { c.done = true; c.m.position.y = c.hh * 0.6; } }
    }
    for (i = 0; i < B.banners.length; i++) { var bn = B.banners[i], bk = clamp((t - bn.t0) / 0.45, 0, 1), ov = bk < 1 ? 1 + 0.35 * Math.sin(bk * Math.PI) : 1; bn.g.scale.set(1, Math.max(0.001, bk * ov), 1); bn.g.rotation.y = Math.sin(t * 2 + i) * 0.12; }
    if (B.snow) { var sp = B.snow.geometry.attributes.position; for (i = 0; i < sp.count; i++) { var yy = sp.getY(i) - 3.2 * dt; sp.setY(i, yy < 0 ? 32 : yy); } sp.needsUpdate = true; }
    if (B.sayUntil && t > B.sayUntil) { dom.dario.hidden = true; B.sayUntil = 0; }
    // カメラ:少しずつ回り込み、締めで引く。爆発のたびに揺れる
    var f2 = smooth((t - B.finale) / 1.3), k1 = smooth(t / 1.6), cam = B.cam, sh2 = B.shake * B.shake * 0.5;
    cam.position.set(Math.sin(t * 0.3) * 7.5 * (1 - f2 * 0.7) + (Math.sin(t * 71) + Math.sin(t * 113)) * sh2 * 0.5, 5.5 + 3.5 * k1 + 7 * f2 + Math.sin(t * 89) * sh2 * 0.6, 27 + 4 * k1 + 7 * f2);
    if (B.mech && !B.nk) { var mv = smooth((t - 0.6) / 1.4) * (1 - f2 * 0.5); cam.position.y += 2.5 * mv; cam.position.z += 5 * mv; cam.lookAt(0.8 * mv, 2.6 + 2.2 * f2 + 3.4 * mv, -13 - 4 * f2 + 7 * mv); } // 見上げる
    else if (B.nk) { var n2 = smooth((t - B.nk.t0) / 3.5); cam.position.set(Math.sin(t * 0.12) * 5 + (Math.sin(t * 71) + Math.sin(t * 113)) * sh2 * 0.5, 9 + 8 * n2, 34 + 26 * n2); cam.lookAt(0, 3 + 15 * n2, -18); } // 引いて、見上げる
    else cam.lookAt(0, 2.6 + 2.2 * f2, -13 - 4 * f2);
    B.shake = Math.max(0, B.shake - dt * (B.nk ? 0.7 : 2.6));
  }
  function render() { renderer.render(B.scene, B.cam); }
  function loop(now) {
    if (!B) return;
    var dt = Math.min(0.05, (now - B.last) / 1000); B.last = now;
    if (!B.manual) { step(dt * B.scale); render(); if (B.t >= B.end) { finish(); return; } }
    B.raf = requestAnimationFrame(loop);
  }
  function finish(silent) {
    if (!B) return;
    var b = B; B = null;
    cancelAnimationFrame(b.raf); root.removeEventListener('resize', b.onResize);
    b.loops.forEach(function (stop) { try { stop(); } catch (e) { /* 鳴っていない */ } });
    b.trash.forEach(function (o) { try { o.dispose(); } catch (e) { /* 破棄済み */ } });
    try { renderer.renderLists.dispose(); } catch (e) { /* 古い版 */ }
    b.host.hidden = true; b.host.classList.remove('grave');
    if (!silent && b.cb) b.cb();
  }

  TF.Battle3D = {
    available: available, play: play,
    active: function () { return !!B; },
    // 検査用:実時間を待たずに時間を進めて一枚描く
    _advance: function (sec) { if (!B) return -1; B.manual = true; var n = Math.ceil(sec * 30); for (var i = 0; i < n && B; i++) step(1 / 30 * B.scale); if (B) { render(); return B.t; } return -1; },
    _info: function () { return B ? { t: B.t, end: B.end, N: B.N, killed: B.killed, alive: B.alive, budget: B.budget } : null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
