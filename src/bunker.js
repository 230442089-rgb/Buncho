/* 天下布鳥 — 地下壕の場面
   エクストリームハードで「第三帝国」の本拠を落としたときにだけ流れる、字幕つきの寸劇。
   ネットで親しまれている「総統閣下は〇〇にお怒りのようです」の型を借りた、この作品だけのパロディで、
   絵は低ポリゴンの作りもの、台詞はすべて書き下ろし(映画の映像・音声・台詞は使っていない)。
   three.js が無い環境では、絵を出さずに字幕だけを流す。 */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};
  var T = null, glOK = null, B = null;

  function available() {
    if (glOK !== null) return glOK;
    T = root.THREE;
    if (!T) return (glOK = false);
    try { var c = document.createElement('canvas'); glOK = !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { glOK = false; }
    return glOK;
  }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function sfx(name, o) { if (TF.sfx && B && !B.mute) TF.sfx.play(name, o); }

  // ── 台本 ── t: 秒 / shot: 画角 / mode: 総統の動き / sub: 字幕(cls: shout=怒鳴り, narr=地の文)/ slam: 机を叩く / toss: 鉛筆を投げる
  var SCRIPT = [
    { t: 0, shot: 'black', card: 'title' },
    { t: 3.6, shot: 'wide', mode: 'sit', sub: '' },
    { t: 4.6, sub: '総統。……東の敵が、ライン川を越えました。' },
    { t: 7.6, sub: '敵の主力は、戦車と、ヘリコプターと……' },
    { t: 10.2, sub: '……文鳥です。' },
    { t: 12.6, shot: 'close', mode: 'tremble', sub: '' },
    { t: 16.0, sub: '……次の者は、部屋に残れ。' },
    { t: 18.6, sub: '文鳥を見た者。文鳥に負けた者。' },
    { t: 21.2, sub: 'それから……文鳥を、かわいいと思った者。' },
    { t: 24.0, shot: 'wide', mode: 'sit', sub: '(誰も、出ていかなかった)', cls: 'narr' },
    { t: 26.8, shot: 'rant', mode: 'rant', sub: 'なぜ十六世紀に戦車がいる!', cls: 'shout', slam: true, voice: 7 },
    { t: 29.2, sub: '相手は体重二十五グラムだぞ! 二十五グラム!', cls: 'shout', voice: 9 },
    { t: 32.0, sub: '向こうには計算機がいる! こっちは計算尺だ!', cls: 'shout', slam: true, voice: 9 },
    { t: 34.8, sub: 'ローマは二千年も、何をしていた!', cls: 'shout', voice: 7 },
    { t: 37.4, sub: '美術学校に受かってさえいれば、こんなことには……!', cls: 'shout', voice: 10 },
    { t: 40.4, sub: 'ちくしょーめ!', cls: 'shout big', toss: true, slam: true, voice: 4 },
    { t: 42.4, shot: 'hall', mode: 'rant', sub: '', voice: 6, muffled: true },
    { t: 43.4, sub: '……大丈夫よ。文鳥は、噛まないわ。', voice: 5, muffled: true },
    { t: 46.4, sub: '(たまに噛む)', cls: 'narr' },
    { t: 48.4, shot: 'close', mode: 'slump', sub: '' },
    { t: 50.2, sub: '……私も、文鳥を飼えばよかった。' },
    { t: 53.2, sub: '手のひらに、乗るそうじゃないか。' },
    { t: 56.4, shot: 'black', card: 'end', sub: '' },
    { t: 60.2, end: true }
  ];

  // ── 画の部品 ──
  function mat(color, emissive) { var m = new T.MeshLambertMaterial({ color: color }); if (emissive) m.emissive = new T.Color(emissive); B.trash.push(m); return m; }
  function box(w, h, d, color, x, y, z, parent) {
    var g = new T.BoxGeometry(w, h, d); B.trash.push(g);
    var m = new T.Mesh(g, typeof color === 'number' ? mat(color) : color);
    m.position.set(x || 0, y || 0, z || 0); (parent || B.scene).add(m); return m;
  }
  function group(x, y, z, parent) { var g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); (parent || B.scene).add(g); return g; }
  function mapTexture() { // 机と壁の作戦図:矢印が一か所に集まり、ところどころに小鳥の印
    var c = document.createElement('canvas'), x, i; c.width = 512; c.height = 256; x = c.getContext('2d');
    x.fillStyle = '#d9cfae'; x.fillRect(0, 0, 512, 256);
    x.strokeStyle = 'rgba(90,80,60,.35)'; x.lineWidth = 1;
    for (i = 0; i < 512; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); }
    for (i = 0; i < 256; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
    x.fillStyle = '#b9ad88'; [[90, 70, 70, 40], [230, 120, 110, 60], [400, 80, 80, 50], [330, 200, 90, 36], [120, 190, 80, 34]].forEach(function (b) { x.beginPath(); x.ellipse(b[0], b[1], b[2], b[3], 0.3, 0, 7); x.fill(); });
    x.strokeStyle = '#b3261e'; x.fillStyle = '#b3261e'; x.lineWidth = 7; x.lineCap = 'round';
    [[30, 40], [500, 30], [490, 230], [40, 220], [260, 10]].forEach(function (p) {
      var a = Math.atan2(128 - p[1], 256 - p[0]), ex = 256 - Math.cos(a) * 34, ey = 128 - Math.sin(a) * 34;
      x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(ex, ey); x.stroke();
      x.beginPath(); x.moveTo(ex + Math.cos(a) * 16, ey + Math.sin(a) * 16); x.lineTo(ex + Math.cos(a + 2.5) * 16, ey + Math.sin(a + 2.5) * 16); x.lineTo(ex + Math.cos(a - 2.5) * 16, ey + Math.sin(a - 2.5) * 16); x.fill();
    });
    x.strokeStyle = '#1c1a16'; x.lineWidth = 4; x.beginPath(); x.arc(256, 128, 20, 0, 7); x.stroke();
    [[60, 60], [470, 60], [455, 205], [80, 200], [262, 40], [170, 110], [350, 150]].forEach(function (p) { // 小鳥の印
      x.fillStyle = '#fbfaf4'; x.beginPath(); x.arc(p[0], p[1], 9, 0, 7); x.fill();
      x.fillStyle = '#e8748a'; x.beginPath(); x.moveTo(p[0] + 7, p[1] - 3); x.lineTo(p[0] + 15, p[1]); x.lineTo(p[0] + 7, p[1] + 3); x.fill();
      x.fillStyle = '#1c1a16'; x.beginPath(); x.arc(p[0] + 2, p[1] - 3, 1.6, 0, 7); x.fill();
    });
    var t = new T.CanvasTexture(c); B.trash.push(t); return t;
  }
  // 人の形。箱を積んだだけの作りもの
  function person(o) {
    var g = group(o.x, 0, o.z), body = o.body || 0x6c6f62, skin = 0xdcb394, P = { g: g, base: o.x };
    g.rotation.y = o.ry || 0;
    P.legs = box(0.46, 0.86, 0.26, o.legs || 0x3a3c37, 0, 0.43, 0, g);
    P.torso = group(0, 0.86, 0, g);
    box(0.6, 0.72, 0.32, body, 0, 0.36, 0, P.torso);
    box(0.2, 0.1, 0.05, 0x26241f, 0, 0.66, 0.165, P.torso);                       // 襟元
    P.head = group(0, 0.92, 0, P.torso);
    box(0.32, 0.36, 0.32, skin, 0, 0, 0, P.head);
    box(0.045, 0.045, 0.02, 0x1c1a16, -0.075, 0.03, 0.165, P.head); box(0.045, 0.045, 0.02, 0x1c1a16, 0.075, 0.03, 0.165, P.head); // 目
    if (o.cap) { box(0.38, 0.12, 0.38, o.cap, 0, 0.24, 0, P.head); box(0.36, 0.03, 0.16, 0x1c1a16, 0, 0.185, 0.24, P.head); }
    else if (o.hair) box(0.34, 0.1, 0.34, o.hair, 0, 0.22, 0, P.head);
    if (o.long) { box(0.36, 0.44, 0.1, o.hair, 0, -0.06, -0.19, P.head); box(0.62, 0.5, 0.36, o.legs, 0, 0.62, 0, g); }   // 長い髪とスカート
    P.armL = group(-0.38, 0.66, 0, P.torso); P.armR = group(0.38, 0.66, 0, P.torso);
    box(0.15, 0.56, 0.15, body, 0, -0.28, 0, P.armL); box(0.15, 0.56, 0.15, body, 0, -0.28, 0, P.armR);
    box(0.13, 0.13, 0.13, skin, 0, -0.6, 0, P.armL); box(0.13, 0.13, 0.13, skin, 0, -0.6, 0, P.armR);
    return P;
  }
  function buildScene() {
    var s = B.scene, tex = mapTexture(), i;
    s.add(new T.AmbientLight(0x6a6558, 0.75));
    B.lamp = new T.PointLight(0xffe2a8, 1.25, 16, 1.6); B.lamp.position.set(0, 3.1, -0.2); s.add(B.lamp);
    var fill = new T.DirectionalLight(0xbfc8d8, 0.35); fill.position.set(2, 4, 6); s.add(fill);
    // 部屋
    box(14, 0.1, 10, 0x3b3832, 0, -0.05, -0.5); box(14, 4.4, 0.2, 0x57534a, 0, 2.2, -4.2); box(0.2, 4.4, 10, 0x4c4840, -5.4, 2.2, -0.5); box(0.2, 4.4, 10, 0x4c4840, 5.4, 2.2, -0.5); box(14, 0.2, 10, 0x2f2c27, 0, 4.4, -0.5);
    var wm = new T.MeshLambertMaterial({ map: tex }); B.trash.push(wm);
    var wg = new T.PlaneGeometry(4.6, 2.3); B.trash.push(wg); var wall = new T.Mesh(wg, wm); wall.position.set(0, 2.5, -4.08); s.add(wall);
    box(4.8, 0.08, 0.06, 0x2a2620, 0, 3.7, -4.06); box(4.8, 0.08, 0.06, 0x2a2620, 0, 1.3, -4.06);
    box(0.5, 0.06, 0.5, 0x2a2824, 0, 3.55, -0.2); box(0.04, 0.8, 0.04, 0x2a2824, 0, 3.98, -0.2); box(0.34, 0.04, 0.34, mat(0xfff3c8, 0xffe9a8), 0, 3.5, -0.2); // 吊り下げた灯り
    // 机と作戦図
    box(5.4, 0.12, 2.3, 0x4a3b2a, 0, 0.96, 0); [[-2.5, -1], [2.5, -1], [-2.5, 1], [2.5, 1]].forEach(function (p) { box(0.14, 0.9, 0.14, 0x3a2e21, p[0], 0.45, p[1]); });
    var tg = new T.PlaneGeometry(4.2, 1.9); B.trash.push(tg); var sheet = new T.Mesh(tg, wm); sheet.rotation.x = -Math.PI / 2; sheet.position.set(0, 1.03, 0); s.add(sheet);
    B.pencils = [];
    [[-0.9, 0.5, 0.4], [0.7, 0.62, -0.7], [1.5, 0.3, 1.2], [-1.7, -0.4, 0.2]].forEach(function (p) { var pc = box(0.34, 0.03, 0.03, [0xc8a23a, 0xb3261e, 0x2e5fa8, 0xc8a23a][B.pencils.length], p[0], 1.05, p[1]); pc.rotation.y = p[2]; pc.userData = { y0: 1.05, vy: 0 }; B.pencils.push(pc); });
    // 総統:机の向こうの椅子に
    box(0.78, 1.25, 0.12, 0x33271c, 0, 0.95, -2.02);
    var L = B.L = person({ x: 0, z: -1.62, body: 0x74705f, legs: 0x35332d });
    box(0.36, 0.11, 0.36, 0x241b14, 0, 0.215, 0, L.head);                               // 髪
    B.lock = box(0.22, 0.2, 0.05, 0x241b14, -0.07, 0.11, 0.175, L.head); B.lock.rotation.z = 0.5; // 斜めに流した前髪
    box(0.1, 0.05, 0.03, 0x241b14, 0, -0.085, 0.17, L.head);                            // ちょび髭
    B.browL = box(0.1, 0.025, 0.02, 0x241b14, -0.075, 0.085, 0.168, L.head); B.browR = box(0.1, 0.025, 0.02, 0x241b14, 0.075, 0.085, 0.168, L.head);
    B.glasses = group(0, 0.03, 0.18, L.head);
    [-0.075, 0.075].forEach(function (gx) { box(0.11, 0.012, 0.012, 0x1c1a16, gx, 0.045, 0, B.glasses); box(0.11, 0.012, 0.012, 0x1c1a16, gx, -0.045, 0, B.glasses); box(0.012, 0.1, 0.012, 0x1c1a16, gx - 0.05, 0, 0, B.glasses); box(0.012, 0.1, 0.012, 0x1c1a16, gx + 0.05, 0, 0, B.glasses); });
    box(0.05, 0.012, 0.012, 0x1c1a16, 0, 0.02, 0, B.glasses);
    // 将校たち:机の両脇と奥に
    B.men = [];
    [[-2.25, -1.25, 0.5, 0x676a5d, 0x5a5d50], [-2.95, -0.2, 0.75, 0x5f6357, 0], [-2.7, 0.9, 1.0, 0x6c6f62, 0x5a5d50], [2.25, -1.25, -0.5, 0x6a6d60, 0],
      [2.95, -0.2, -0.75, 0x62665a, 0x5a5d50], [2.7, 0.9, -1.0, 0x6c6f62, 0], [-1.25, -2.6, 0.25, 0x707366, 0x5a5d50], [1.3, -2.65, -0.25, 0x666a5d, 0x5a5d50]].forEach(function (p, k) {
      var m = person({ x: p[0], z: p[1], ry: p[2], body: p[3], cap: p[4] || null, hair: p[4] ? null : (k % 2 ? 0x8a8478 : 0x4a3d30) });
      m.phase = k * 1.7; B.men.push(m);
    });
    B.men[0].armR.rotation.x = -1.15; B.men[0].armR.rotation.z = -0.2;                  // 報告する将校は、地図を指している
    // 廊下:閉じた扉の前の二人
    var H = B.hall = group(40, 0, 0);
    box(8, 0.1, 5, 0x3b3832, 0, -0.05, 1, H); box(8, 4, 0.2, 0x5a564c, 0, 2, -0.6, H); box(1.25, 2.5, 0.1, 0x3f2f20, -1.6, 1.25, -0.48, H); box(0.08, 0.08, 0.1, 0xc8a23a, -1.15, 1.2, -0.4, H);
    var hl = new T.PointLight(0xffe2a8, 1.7, 12, 1.4); hl.position.set(1.4, 2.7, 2.6); H.add(hl);
    B.sec = [person({ x: 0.5, z: 0.5, ry: 0.15, body: 0x8a6a5e, legs: 0x5a4640, hair: 0x7a5632, long: true }), person({ x: 1.3, z: 0.7, ry: -0.75, body: 0x6b7a8c, legs: 0x47525f, hair: 0x2c2520, long: true })];
    B.sec.forEach(function (p) { H.add(p.g); });
    B.sec[1].armL.rotation.z = -0.9; B.sec[1].armL.rotation.x = -0.5;                   // 肩に手を置く
    B.sec[0].head.rotation.x = 0.35;
  }

  // ── 進行 ──
  // 画は、画面のまん中の枠に描く(縦長の画面では正方形に近い枠、横長では横長の枠)。字幕は枠の下か、枠の下端に重ねる
  function layout() {
    var W = B.host.clientWidth || 360, H = B.host.clientHeight || 640, tall = W / H < 0.8, fw, fh, top;
    if (tall) { fw = W; fh = Math.round(Math.min(W, H * 0.6)); top = Math.round((H - fh) * 0.36); }
    else { fh = Math.round(Math.min(H * 0.82, W / 1.6)); fw = Math.round(Math.min(W, fh * 1.6)); top = Math.round((H - fh) * 0.4); }
    var f = B.dom.frame.style, sb = B.dom.sub.style;
    f.width = fw + 'px'; f.height = fh + 'px'; f.left = Math.round((W - fw) / 2) + 'px'; f.top = top + 'px';
    if (tall) { sb.top = (top + fh + 14) + 'px'; sb.bottom = 'auto'; } else { sb.top = 'auto'; sb.bottom = (H - top - fh + Math.round(fh * 0.07)) + 'px'; }
    B.w = fw; B.h = fh; B.wide = fw / fh >= 1.3;
    if (B.gl) { B.renderer.setSize(fw, fh, false); B.cam.aspect = fw / fh; }
  }
  function setShot(name) {
    B.shot = name; B.host.classList.toggle('black', name === 'black');
    if (!B.gl) return;
    var c = B.cam, w = B.wide;
    if (name === 'wide') { c.fov = w ? 38 : 54; c.position.set(0, 2.3, 5.9); B.look = [0, 1.45, -0.9]; }
    else if (name === 'close') { c.fov = w ? 26 : 34; c.position.set(0.28, 1.56, 0.35); B.look = [0, 1.4, -1.62]; }
    else if (name === 'rant') { c.fov = w ? 36 : 50; c.position.set(0.95, 2.0, 2.6); B.look = [0, 1.6, -1.55]; }
    else if (name === 'hall') { c.fov = w ? 32 : 44; c.position.set(41.2, 1.5, 4.6); B.look = [40.85, 1.2, 0.55]; }
    B.camBase = c.position.clone(); c.updateProjectionMatrix();
  }
  function cue(e) {
    var d = B.dom;
    if (e.shot) setShot(e.shot);
    if (e.mode) { B.mode = e.mode; B.modeT = B.t; }
    if (e.card) {
      d.card.hidden = false; d.card.className = 'bk-card bk-' + e.card;   // (表紙の .title と名前がぶつからないように)
      d.card.innerHTML = e.card === 'title' ? '<small>エクストリームハード 特別編</small><b>総統閣下は<br>文鳥に<br>お怒りのようです</b>' : '<b>第三帝国、降伏。</b><small>この場面はフィクションのパロディです</small>';
      if (e.card === 'end') sfx('stamp');
    } else if (e.shot) d.card.hidden = true;
    if (e.sub != null) { d.sub.textContent = e.sub; d.sub.className = 'bk-sub' + (e.cls ? ' ' + e.cls : ''); d.sub.hidden = !e.sub; }
    if (e.voice) sfx('rant', { n: e.voice, muffled: !!e.muffled });
    if (e.slam) { B.slamT = B.t; sfx('slam'); if (B.gl) B.pencils.forEach(function (p) { p.userData.vy = 1.6 + Math.random() * 0.8; }); }
    if (e.toss && B.gl) { var p = B.pencils[1]; p.userData.fly = { vx: -2.6, vy: 3.2, vz: 3.4 }; }
    if (e.end) finish();
  }
  function step(dt) {
    B.t += dt;
    while (B.i < SCRIPT.length && SCRIPT[B.i].t <= B.t) { cue(SCRIPT[B.i++]); if (!B) return; }
    if (!B.gl) return;
    var t = B.t, L = B.L, mt = t - B.modeT, k, rage = B.mode === 'rant' ? 1 : 0, sl = clamp(1 - (t - B.slamT) / 0.35, 0, 1);
    // 総統
    var stand = B.mode === 'rant' ? smooth(mt / 0.35) : (B.mode === 'slump' ? 1 - smooth(mt / 1.2) : 0);
    B.stand = lerp(B.stand, stand, clamp(dt * 8, 0, 1));
    L.g.position.y = -0.32 + B.stand * 0.32;                                           // 座ると腰が下がる(机の向こうなので脚は見えない)
    L.torso.rotation.x = rage ? 0.12 + Math.sin(t * 9) * 0.05 - sl * 0.25 : (B.mode === 'slump' ? 0.3 * smooth(mt / 1.5) : 0);
    L.head.rotation.x = B.mode === 'slump' ? 0.45 * smooth(mt / 1.8) : (rage ? Math.sin(t * 13) * 0.08 : 0);
    L.head.rotation.y = rage ? Math.sin(t * 7.3) * 0.35 : (B.mode === 'tremble' ? Math.sin(t * 31) * 0.012 : 0);
    B.browL.rotation.z = rage ? -0.45 : 0; B.browR.rotation.z = rage ? 0.45 : 0;
    B.lock.rotation.z = 0.5 + (rage ? Math.sin(t * 15) * 0.25 : 0);
    if (rage) { // 両腕を振りまわし、叩くときは振り下ろす
      L.armL.rotation.x = -1.9 + Math.sin(t * 11) * 0.9 + sl * 1.5; L.armL.rotation.z = -0.5 + Math.sin(t * 7) * 0.4;
      L.armR.rotation.x = -1.7 + Math.cos(t * 9.5) * 1.0 + sl * 1.4; L.armR.rotation.z = 0.5 + Math.cos(t * 6) * 0.4;
    } else if (B.mode === 'tremble') { // 震える手で、眼鏡を外す
      k = smooth((mt - 0.6) / 1.2); var off = smooth((mt - 2.2) / 1.0), jit = Math.sin(t * 43) * 0.035 + Math.sin(t * 29) * 0.02;
      L.armR.rotation.x = -2.25 * k * (1 - off) - 0.75 * off + jit; L.armR.rotation.z = -0.55 * k * (1 - off) + jit * 0.5;
      L.armL.rotation.x = lerp(L.armL.rotation.x, 0, 0.1); L.armL.rotation.z = lerp(L.armL.rotation.z, 0, 0.1);
      if (off > 0 && B.glasses.parent === L.head) { L.armR.add(B.glasses); B.glasses.position.set(0, -0.68, 0.06); B.glasses.rotation.x = 1.2; }
    } else { // 座っている・うなだれる
      k = B.mode === 'slump' ? 0.06 : 0.12;
      L.armL.rotation.x = lerp(L.armL.rotation.x, B.mode === 'slump' ? 0.1 : -0.75, k); L.armL.rotation.z = lerp(L.armL.rotation.z, 0, k);
      L.armR.rotation.x = lerp(L.armR.rotation.x, B.mode === 'slump' ? 0.1 : -0.75, k); L.armR.rotation.z = lerp(L.armR.rotation.z, 0, k);
    }
    // 将校たち:怒鳴られているあいだは、うつむいて、叩くたびに肩がはねる
    B.men.forEach(function (m, n) {
      m.head.rotation.x = lerp(m.head.rotation.x, rage ? 0.32 : 0.04, 0.08);
      m.head.rotation.y = Math.sin(t * 0.7 + m.phase) * (rage ? 0.05 : 0.14) + (B.mode === 'sit' && t > 24 ? Math.sin(t * 2.2 + m.phase) * 0.3 : 0);
      m.torso.position.y = 0.86 + (rage ? sl * 0.05 * ((n % 3) + 1) / 3 : 0);
    });
    B.sec[0].head.rotation.x = 0.35 + Math.abs(Math.sin(t * 5)) * 0.08; B.sec[1].armL.rotation.x = -0.5 + Math.sin(t * 4) * 0.12;
    // 机の上の鉛筆:叩くと跳ね、最後の一本は飛んでいく
    B.pencils.forEach(function (p) {
      var u = p.userData;
      if (u.fly) { p.position.x += u.fly.vx * dt; p.position.y += u.fly.vy * dt; p.position.z += u.fly.vz * dt; u.fly.vy -= 9 * dt; p.rotation.z += 14 * dt; return; }
      if (u.vy || p.position.y > u.y0) { p.position.y += u.vy * dt; u.vy -= 9 * dt; p.rotation.x += 6 * dt; if (p.position.y <= u.y0) { p.position.y = u.y0; u.vy = 0; p.rotation.x = 0; } }
    });
    // 灯りは叩くたびに揺れ、画面も揺れる
    B.lamp.position.x = Math.sin(t * 3.1) * 0.05 * (rage ? 3 : 1); B.lamp.intensity = 1.25 - sl * 0.25 + (rage ? Math.sin(t * 40) * 0.03 : 0);
    var sh = (B.shot === 'rant' ? 0.018 : 0) + sl * 0.07;
    B.cam.position.set(B.camBase.x + (Math.random() - 0.5) * sh, B.camBase.y + (Math.random() - 0.5) * sh, B.camBase.z);
    if (B.shot === 'close' && B.mode === 'tremble') B.cam.position.z = B.camBase.z - smooth(mt / 8) * 0.25;   // ゆっくり寄る
    B.cam.lookAt(B.look[0], B.look[1], B.look[2]);
  }
  function render() { if (B && B.gl) B.renderer.render(B.scene, B.cam); }
  function loop(now) {
    if (!B) return;
    var dt = Math.min(0.05, (now - B.last) / 1000); B.last = now;
    if (!B.manual) { step(dt); render(); }
    if (B) B.raf = requestAnimationFrame(loop);
  }
  function ensureDom() {
    var h = document.getElementById('bunker');
    if (!h) { h = document.createElement('div'); h.id = 'bunker'; h.className = 'bunker'; h.hidden = true; document.body.appendChild(h); }
    h.innerHTML = '<div class="bk-frame"><canvas class="bk-canvas"></canvas><div class="bk-vig"></div></div><div class="bk-card" hidden></div><p class="bk-sub" hidden></p><button class="bk-skip" type="button">スキップ ▸▸</button>';
    return { host: h, frame: h.querySelector('.bk-frame'), canvas: h.querySelector('.bk-canvas'), card: h.querySelector('.bk-card'), sub: h.querySelector('.bk-sub'), skip: h.querySelector('.bk-skip') };
  }
  function play(cb) {
    if (B) finish(true);
    var d = ensureDom(), host = d.host, gl = available(), renderer = null;
    host.hidden = false;
    if (gl) { try { renderer = new T.WebGLRenderer({ canvas: d.canvas, antialias: true }); renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2)); } catch (e) { gl = false; renderer = null; } }
    B = { cb: cb, host: host, dom: d, gl: gl, renderer: renderer, t: 0, i: 0, mode: 'sit', modeT: 0, slamT: -9, stand: 0, shot: '', trash: [], last: performance.now(), manual: false, mute: false, w: 360, h: 360, wide: false };
    host.classList.toggle('nogl', !gl);
    if (gl) {
      renderer.setClearColor(0x0d0c0a);
      B.scene = new T.Scene(); B.scene.fog = new T.Fog(0x0d0c0a, 9, 22);
      B.cam = new T.PerspectiveCamera(46, 1, 0.1, 80); B.look = [0, 1.2, -1]; B.camBase = B.cam.position.clone();
      buildScene();
    }
    layout();
    B.onResize = function () { if (!B) return; layout(); setShot(B.shot || 'wide'); };
    root.addEventListener('resize', B.onResize);
    d.skip.addEventListener('click', function () { finish(); });
    step(0); render();
    B.raf = requestAnimationFrame(loop);
    return { skip: function () { finish(); } };
  }
  function finish(silent) {
    if (!B) return;
    var b = B; B = null;
    cancelAnimationFrame(b.raf); root.removeEventListener('resize', b.onResize);
    b.trash.forEach(function (o) { try { o.dispose(); } catch (e) { /* 破棄済み */ } });
    if (b.renderer) { try { b.renderer.dispose(); if (b.renderer.forceContextLoss) b.renderer.forceContextLoss(); } catch (e) { /* 古い版 */ } }
    b.host.hidden = true; b.host.innerHTML = '';
    if (!silent && b.cb) b.cb();
  }

  TF.Bunker = {
    available: available, play: play,
    active: function () { return !!B; },
    duration: function () { return SCRIPT[SCRIPT.length - 1].t; },
    // 検査用:実時間を待たずに時間を進めて一枚描く
    _advance: function (sec) { if (!B) return -1; B.manual = true; B.mute = true; var n = Math.ceil(sec * 30); for (var i = 0; i < n && B; i++) step(1 / 30); if (B) { B.mute = false; render(); return B.t; } return -1; },
    _info: function () { return B ? { t: B.t, shot: B.shot, mode: B.mode, gl: B.gl, sub: B.dom.sub.textContent } : null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
