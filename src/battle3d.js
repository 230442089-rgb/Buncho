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
  function sfx(name, o) { if (TF.sfx) TF.sfx.play(name, o); }
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
      pal: pal, tanks: [], helis: [], jets: [], shells: [], castle: [], banners: [], loops: [], lastBoom: -1, done: false, w: w, h: h, finale: 99, end: 10, fleeing: false, ptr: 0, tptr: 0, killed: 0 };
    d.title.textContent = spec.title || '';
    d.kills.textContent = '0'; d.killsOf.textContent = ' / ' + fmt(spec.men);
    d.dario.hidden = true; d.stamp.hidden = true; d.stamp.className = 'b-stamp';

    buildWorld(); buildEnemy(); buildFriends(); buildPools(); buildTimeline();
    B.tl.sort(function (a, b) { return a.t - b.t; });
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
    var hill = keep(new T.ConeGeometry(1, 1, 7)), hm = lam(shade(pal.ground, 0.72));
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
    // 城:石垣の上に層を重ねる。層ごとに別の部品にして、砲撃で吹き飛ぶようにする
    var fort = s.fort || 0, cz = -40, wall = 0xeee7d8, roof = 0x2e3440, stone = 0x868991;
    function piece(g, x, y, z, hh) { var m = new T.Mesh(keep(g), matVC); m.position.set(x, y, z); sc.add(m); B.castle.push({ m: m, hh: hh, fly: false, done: false, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 }); return m; }
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
      for (i = -4; i <= 4; i++) piece(merge([{ g: box(2.3, 1.9, 0.3), p: [0, 0, 0], c: 0x7a5a3a }, { g: box(0.25, 2.5, 0.35), p: [-1.1, 0.3, 0], c: 0x5d432b }]), i * 2.35, 0.95, cz + 6, 0.95);
      piece(merge([{ g: box(0.3, 5, 0.3), p: [-1.2, 0, -1.2], c: 0x5d432b }, { g: box(0.3, 5, 0.3), p: [1.2, 0, -1.2], c: 0x5d432b }, { g: box(0.3, 5, 0.3), p: [-1.2, 0, 1.2], c: 0x5d432b }, { g: box(0.3, 5, 0.3), p: [1.2, 0, 1.2], c: 0x5d432b },
        { g: box(3.2, 0.25, 3.2), p: [0, 2.4, 0], c: 0x7a5a3a }, { g: new T.ConeGeometry(2.6, 1.2, 4), p: [0, 3.9, 0], r: [0, Math.PI / 4, 0], c: roof }]), 0, 2.5, cz, 2.5);
      if (fort >= 2) piece(merge([{ g: box(5, 2.6, 4), p: [0, 0, 0], c: wall }, { g: new T.ConeGeometry(4.2, 1.5, 4), p: [0, 2, 0], r: [0, Math.PI / 4, 0], c: roof }]), 7.5, 1.3, cz - 1, 1.3);
    } else { // 野陣:陣幕
      for (i = -2; i <= 2; i++) piece(merge([{ g: box(3.6, 1.7, 0.08), p: [0, 0, 0], c: 0xf1ece0 }, { g: box(3.6, 0.3, 0.1), p: [0, 0.35, 0], c: s.color }, { g: box(0.12, 2.1, 0.12), p: [-1.8, 0.1, 0], c: 0x5d432b }]), i * 3.7, 0.9, cz + 8, 0.9);
    }
  }

  function buildEnemy() {
    var s = B.spec, N = clamp(Math.round(Math.sqrt(s.men) * 2.3), 40, 430);
    var flag = new T.Color(s.color).getHex(), g = keep(soldierGeo(flag, shade(flag, 0.34), 0x1d1b19));
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
    B.modern = !!(nInf || nTank || B.nArty || B.nHeli || B.nJet || B.nNaval);
  }

  function buildPools() {
    var sc = B.scene, n = 340, i;
    B.pn = n; B.pm = new T.InstancedMesh(keep(new T.IcosahedronGeometry(1, 1)), keep(new T.MeshBasicMaterial({ color: 0xffffff })), n); B.pm.frustumCulled = false; sc.add(B.pm);
    B.p = []; var zero = new T.Matrix4().makeScale(0, 0, 0), white = new T.Color(1, 1, 1);
    for (i = 0; i < n; i++) { B.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0, s1: 0, c0: new T.Color(), c1: new T.Color(), g: 0 }); B.pm.setMatrixAt(i, zero); B.pm.setColorAt(i, white); }
    B.tn = 110; B.tm = new T.InstancedMesh(keep(box(1, 1, 1)), keep(new T.MeshBasicMaterial({ color: 0xfff0a0 })), B.tn); B.tm.frustumCulled = false; sc.add(B.tm);
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
    if (!quiet && B.t - B.lastBoom > 0.075) { B.lastBoom = B.t; sfx('boom', { size: clamp(r / 3.6, 0.7, 1.7), gain: 0.5 }); }
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
  function flash(k) {
    var el = dom.flash; if (!el.animate) return;
    try { el.animate([{ opacity: k }, { opacity: 0 }], { duration: 420, easing: 'ease-out' }); } catch (e) { /* 古い環境 */ }
  }
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
    if (left.length) { B.shake = Math.min(1.7, B.shake + 0.7); if (B.t - B.lastBoom > 0.075) { B.lastBoom = B.t; sfx('boom', { size: 1.6, gain: 0.6 }); } }
  }

  // ── 進行表 ──
  function at(t, fn) { B.tl.push({ t: t, fn: fn }); }
  function every(t0, t1, dt, fn) { for (var t = t0; t < t1; t += dt) at(t, fn); }
  function buildTimeline() {
    var s = B.spec, ty = s.types, I = clamp(s.ratio || 1, 1, 6), ground = !s.bombard, win = s.win, hasCastle = (s.fort || 0) > 0;
    var mainEnd = win ? 5.0 : (s.bombard ? 3.4 : 2.9), rate = win ? 1 : 0.45;
    B.pace = { t1: mainEnd, f: 1, release: mainEnd };
    at(0.05, function () { sfx('horagai', { dur: 1.5, gain: 0.14 }); sfx('roar', { dur: 1.4, delay: 0.25 }); });
    at(0.35, function () { say(s.bombard ? '砲爆撃を開始します。' : '作戦開始。勝算 ' + Math.round((s.chance || 0) * 100) + '%。'); });
    // 普通科:曳光弾と迫撃砲
    if (B.inf.length) {
      every(1.0, mainEnd + (win ? 1.2 : 0), 0.055 / rate, function () {
        var f = B.inf[Math.floor(Math.random() * B.inf.length)], i = aliveTarget(true); if (i < 0 || f.down) return;
        tracer(f.x, 1.0, f.z - 0.9, B.sx[i], 0.9, B.sz[i], 0.085, 0.06, 6);
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
      at(f0 + 1.45, function () { B.scale = 0.3; flash(0.85); blast(0, -14, 70, 2.2, 0.9, true, 12); blast(-9, -20, 1, 1, 0, true, 8); blast(9, -20, 1, 1, 0, true, 8); sfx('boom', { size: 1.7, gain: 0.85 }); });
      at(f0 + 1.85, function () { B.scale = 1; });
      at(f0 + 2.5, function () { say(I >= 3 ? '……' + Math.round(I * 100) + '%のオーバーキルです、司令。' : '……制圧を確認しました。'); });
      at(f0 + 2.9, function () { raiseBanners(); stamp('殲滅', 'オーバーキル ' + Math.round((s.ratio || 1) * 100) + '%', 'win'); });
      B.end = f0 + 4.6;
    } else {
      B.pace = { t1: mainEnd, f: 0.85, release: mainEnd + 0.3 };
      at(mainEnd + 1.5, function () { for (var i = 0; i < B.N; i++) if (B.st[i] === 0) shoot(i, 0.5); });
      at(mainEnd + 1.9, function () { raiseBanners(); stamp('制圧', '', 'win'); if (!B.modern) sfx('roar', { dur: 1.2 }); });
      B.end = mainEnd + 3.5;
    }
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
      if (B.retreat) tk.z += 2.4 * dt; else if (t > 1.2 && tk.z > (s.win ? -9 - (i % 2) * 5 : 9)) tk.z -= (s.win ? 4.1 : 1.8) * dt;
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
    cam.lookAt(0, 2.6 + 2.2 * f2, -13 - 4 * f2);
    B.shake = Math.max(0, B.shake - dt * 2.6);
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
    b.host.hidden = true;
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
