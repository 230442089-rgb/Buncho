// ================= 断偽文鳥門　入門CM（30秒）：場面と重ね描き =================
// 時刻はすべて広告全体の秒（0〜30）。1 コマ＝1/30 秒。場面（ユニット）ごとに別の mp4 に書き出してつなぐ。
const ADF = s => Math.round(s * 30);   // 秒 → コマ
const EZ = { ios: x => 0.5 - 0.5 * Math.cos(Math.PI * adClamp(x)), ioc: x => { x = adClamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }, oc: x => 1 - Math.pow(1 - adClamp(x), 3), lin: x => adClamp(x) };
const adK = (t, a, b, ez = EZ.lin) => ez((t - a) / (b - a));
const adV3 = (p0, p1, k) => [0, 1, 2].map(i => adLerp(p0[i], p1[i], k));
function adFov(v) { if (Math.abs(camera.fov - v) > 1e-6) { camera.fov = v; camera.updateProjectionMatrix(); } }
function adCamK(k, p0, l0, p1, l1, fov0, fov1) { adCam(adV3(p0, p1, k), adV3(l0, l1, k)); if (fov0) adFov(adLerp(fov0, fov1 ?? fov0, k)); }

// ---- 人物：animChar のあとに腕などを直接入れるための差し込み ----
{ const ac0 = animChar; animChar = function (c, st, dt) { ac0(c, st, dt); if (c.adPost) c.adPost(c, st, dt); }; }
function adSnap(list) { for (const n of list) if (n && !n.hidden) { n.model.root.position.set(n.pos.x, n.y || 0, n.pos.z); n.model.root.rotation.y = n.facing; n.model.root.visible = true; animChar(n.model, n.st, 0.2); animChar(n.model, n.st, 0.2); } }
function adShow(list, on) { for (const n of list) if (n) { n.hidden = !on; n.model.root.visible = on; } }
function adPlace(n, x, z, f, st, y) { n.pos.x = x; n.pos.z = z; n.facing = f; n.st = Object.assign({}, st || {}); n.y = y || 0; n.goal = null; n.lookAt = null; n.path = null; n.hidden = false; }
// 教主の眼（頭の赤い光の粒）
function adEyes(m) { if (!m.adEyes) { m.adEyes = []; m.head.traverse(o => { if (o.isSprite) m.adEyes.push({ s: o, k0: o.scale.x }); }); } return m.adEyes; }
function adOver(m, k) { if (m.over) for (const g of m.over) { g.material.opacity = adLerp(0.35, 0.95, k); g.scale.setScalar(adLerp(0.5, 0.9, k)); } if (!m.aura30) mzOver30(m, false); m.aura30.material.opacity = adLerp(0, 0.35, k); }
// 区域の毎コマの処理のあとに、灯の強さなどを上書きする
function adTickPost(a, fn) { if (!a.adTk0) a.adTk0 = a.tick || null; a.tick = (a2, dt) => { if (a.adTk0) a.adTk0(a2, dt); fn(a2, dt); }; }
// 参道の延長に生えた杉を消す（広げられた境内）
function adClearCedars(a, test) { a.g.traverse(o => { if (o.isMesh && o.geometry && (o.geometry.type === 'ConeGeometry' || o.geometry.type === 'CylinderGeometry') && test(o.position.x, o.position.z, o.position.y)) o.visible = false; }); }

// ---- 2D：決まった乱数 ----
const adH = (i, s = 1) => { const x = Math.sin(i * 127.1 * s + 311.7) * 43758.5453; return x - Math.floor(x); };
// 火の粉：下から上へ（t の関数）
function adSparks(c, t, n, o = {}) { const { x0 = 0, x1 = 1920, speed = 120, alpha = 1, seed = 1, size = 1 } = o; if (alpha <= 0) return; c.save(); c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const sp = speed * (0.6 + adH(i, seed) * 0.8), ph = adH(i + 31, seed) * 1300; const y = 1120 - ((t * sp + ph) % 1300); const x = x0 + adH(i + 7, seed) * (x1 - x0) + Math.sin(t * (0.7 + adH(i + 3, seed)) + i) * 26; const r = (1.6 + adH(i + 11, seed) * 2.8) * size; const fl = 0.55 + 0.45 * Math.sin(t * (6 + adH(i, seed) * 8) + i * 2.3);
    const g = c.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, `rgba(255,200,120,${0.9 * fl * alpha})`); g.addColorStop(0.3, `rgba(255,90,40,${0.55 * fl * alpha})`); g.addColorStop(1, 'rgba(255,40,20,0)'); c.fillStyle = g; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); }
  c.restore(); }
function adFill(c, col, a = 1) { if (a <= 0) return; c.save(); c.globalAlpha = adClamp(a); c.fillStyle = col; c.fillRect(0, 0, 1920, 1080); c.restore(); }
function adRedInset(c, k) { if (k <= 0) return; const g = c.createRadialGradient(960, 540, 420, 960, 540, 1120); g.addColorStop(0, 'rgba(224,40,58,0)'); g.addColorStop(1, `rgba(224,40,58,${0.55 * k})`); c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.fillRect(0, 0, 1920, 1080); c.restore(); }
function adBottomShade(c, a) { if (a <= 0) return; const g = c.createLinearGradient(0, 760, 0, 1080); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.55 * a})`); c.fillStyle = g; c.fillRect(0, 760, 1920, 320); }

// ---- 外の表記（全編、いちばん上。揺れ・暗がり・粒をかけない） ----
const AD_NOTE = '※物語ゲーム『主権留保』に登場する架空の団体の広告です。';
function adNote(c, a = 1) { if (a <= 0) return; c.save(); c.globalAlpha = adClamp(a); c.font = '500 24px "Zen Kaku Gothic New"'; c.textBaseline = 'middle'; const w = c.measureText(AD_NOTE).width, x1 = 1872, x0 = x1 - w; c.fillStyle = 'rgba(12,10,12,0.6)'; c.beginPath(); if (c.roundRect) c.roundRect(x0 - 12, 50 - 12 - 7, w + 24, 24 + 14, 6); else c.rect(x0 - 12, 31, w + 24, 38); c.fill(); c.globalAlpha = adClamp(a) * 0.9; c.fillStyle = '#EAE4D4'; c.textAlign = 'left'; c.fillText(AD_NOTE, x0, 51); c.restore(); }

// ---- 名札（左下）：赤い縦の帯＋二行 ----
function adNameCard(c, t, o) { const { t0, t1, out0, bar, l1, l2 } = o; if (t < t0 || t > t1) return; const fo = 1 - adK(t, out0, t1);
  const k1 = adK(t, t0, t0 + 0.25, EZ.oc), k2 = adK(t, t0 + 2 / 30, t0 + 2 / 30 + 0.25, EZ.oc);
  if (bar) { const hk = adK(t, t0, t0 + 0.25, EZ.oc); c.save(); c.globalAlpha = fo; c.fillStyle = '#C01828'; c.fillRect(bar.x, bar.y1 - (bar.y1 - bar.y0) * hk, 8, (bar.y1 - bar.y0) * hk); c.restore(); }
  if (l1) adText(c, l1.s, Object.assign({ x: l1.x - l1.slide * (1 - k1), y: l1.y, align: 'left', alpha: k1 * fo }, l1.st));
  if (l2) adText(c, l2.s, Object.assign({ x: l2.x - l2.slide * (1 - k2), y: l2.y, align: 'left', alpha: k2 * fo }, l2.st)); }
// 厚みのある大きな字（Dela Gothic One の名前・スローガン用）
function adBigText(c, s, x, y, size, o = {}) { const { alpha = 1, ex = 6, sw = 10, scale = 1, glow = null } = o; if (alpha <= 0) return; c.save(); c.translate(x, y); c.scale(scale, scale);
  adText(c, s, { x: 0, y: ex, size, family: 'Dela Gothic One', weight: 400, align: o.align || 'center', fill: '#8A0A18', stroke: '#0C0A10', sw, alpha, glow: glow, gb: glow ? 24 : 0 });
  adText(c, s, { x: 0, y: 0, size, family: 'Dela Gothic One', weight: 400, align: o.align || 'center', fill: '#EFEDE8', stroke: '#0C0A10', sw, alpha }); c.restore(); }

// ---- 白黒赤の三色の止め画（GL の画を写して作る） ----
function adTriTone(src) { const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; const x = cv.getContext('2d'); x.drawImage(src, 0, 0, 1920, 1080); const im = x.getImageData(0, 0, 1920, 1080), d = im.data;
  const D = [11, 7, 9], M = [224, 40, 58], L = [255, 230, 232]; const sm = (a, b, v) => { v = adClamp((v - a) / (b - a)); return v * v * (3 - 2 * v); };
  for (let i = 0; i < d.length; i += 4) { const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; const k1 = sm(0.10, 0.32, l), k2 = sm(0.50, 0.78, l);
    for (let j = 0; j < 3; j++) d[i + j] = adLerp(adLerp(D[j], M[j], k1), L[j], k2); }
  x.putImageData(im, 0, 0); return cv; }
// くの字の鳥の影（羽ばたき）
function adBird(c, x, y, w, ang, col) { c.save(); c.translate(x, y); c.strokeStyle = col; c.lineWidth = Math.max(3, w * 0.18); c.lineCap = 'round'; c.lineJoin = 'round'; const a = ang; c.beginPath(); c.moveTo(-w / 2, -Math.sin(a) * w * 0.35); c.lineTo(0, w * 0.08); c.lineTo(w / 2, -Math.sin(a) * w * 0.35); c.stroke(); c.restore(); }

// ---- 紋章：2D の大きさを測る ----
let AD_EMB = null;
function adEmbInfo() { if (AD_EMB) return AD_EMB; const cv = document.createElement('canvas'); cv.width = 800; cv.height = 800; const x = cv.getContext('2d'); emblem30(x, 400, 400, 1, '#C01828'); const d = x.getImageData(0, 0, 800, 800).data; let x0 = 800, x1 = 0, y0 = 800, y1 = 0;
  for (let y = 0; y < 800; y++) for (let i = 0; i < 800; i++) if (d[(y * 800 + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  AD_EMB = { w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2 - 400, cy: (y0 + y1) / 2 - 400 }; return AD_EMB; }

// ================= 場面（ユニット） =================
const FONTS_ALL = [['500 24px "Zen Kaku Gothic New"', '※物語ゲーム主権留保'], ['700 30px "Zen Kaku Gothic New"', '断偽文鳥門'], ['900 88px "Zen Kaku Gothic New"', 'メス'], ['400 88px "Dela Gothic One"', 'メス・ゼロ'], ['900 100px "Zen Old Mincho"', '断'], ['800 50px "Shippori Mincho B1"', '断'], ['600 40px "Shippori Mincho B1"', '偽'], ['400 104px "Yuji Syuku"', '掃く。']];
let AD_T = 0, AD_SHOT = '', AD_F = 0;

// ---------- U1：s01 問い（0〜3.8） ----------
adScene('u1', { t0: 0, t1: 3.8, fonts: FONTS_ALL,
  async setup() { const a = await adDangi({ bg: 0x7A8494, f0: 4, f1: 30, hi: 0.30 }); sun.intensity = 0.25; sun.color.setHex(0xFFFFFF); sun.position.set(6, 4, 14);
    adTickPost(a, () => { if (a.hallGlow) a.hallGlow.material.opacity = 0.55; });
    AD.nv = put31(a, 'adNovice', () => member30(0, false), -0.5, 8.2, Math.PI, { look: 0.25, headY: -0.35 }); AD.u = [AD.nv]; },
  update(t) { const n = AD.nv; const k = adK(t, 2.2, 2.7); n.st.look = adLerp(0.25, -0.08, k); n.st.headY = adLerp(-0.35, -0.25, k);
    adCamK(adK(t, 0, 3.8, EZ.ios), [2.2, 1.35, 12.6], [-0.6, 2.3, -4.0], [1.95, 1.4, 12.2], [-0.6, 2.25, -4.0], 44); },
  draw(c, t, f) { adFill(c, 'rgba(40,60,90,1)', 0.08); adVignette(c, 0.55); adGrain(c, f, 0.03);
    // 問い：1 字ずつ
    const S = [...'メスの存在にはもううんざり？'], fo = 1 - adK(t, 3.45, 3.70); c.save(); c.font = '900 88px "Zen Kaku Gothic New"'; const ws = S.map(ch => c.measureText(ch).width); c.restore(); const W = ws.reduce((p, q) => p + q, 0); let x = 960 - W / 2;
    S.forEach((ch, i) => { const ts = 0.6 + i / 30; const k = adK(t, ts, ts + 5 / 30); const last = i === S.length - 1; const sc = last ? adLerp(1.15, 1.0, adK(t, ts, ts + 4 / 30)) : 1; const cx = x + ws[i] / 2;
      if (k > 0) { c.save(); c.translate(cx, 200 + 12 * (1 - EZ.oc(k))); c.scale(sc, sc); adText(c, ch, { x: 0, y: 0, size: 88, weight: 900, alpha: k * fo, fill: '#EFEDE8', stroke: '#0C0A10', sw: 10, shadow: { col: 'rgba(0,0,0,0.35)', dy: 3, blur: 8 } }); c.restore(); }
      x += ws[i]; });
    adFill(c, '#000', 1 - adK(t, 0, 0.3)); } });

// ---------- U2：s02〜s04 答え（3.8〜10.2） ----------
adScene('u2', { t0: 3.8, t1: 10.2, fonts: FONTS_ALL,
  async setup() { const a = await adSohon({ bg: 0x070508, f0: 26, f1: 84, hi: 0.32, ground: 0x6A665E }); sun.intensity = 0.2; adCrestFix(a); if (a.wall) a.wall.visible = false;
    a.fires.forEach(s => s.scale.multiplyScalar(1.25)); const cg = glowSprite(0xFF2A1A, 3.4, 0.35); cg.position.set(0, 5.6, -10.55); adAdd(a.g, cg);
    adTickPost(a, () => { a.hallGlow.material.opacity = AD.hall ?? 0.5; });
    const mz = put31(a, 'adMz', () => mesuZeroBird(), 0, -10.0, 0, {}, 1.2); mzOver30(mz.model, false); AD.mz = mz; adEyes(mz.model);
    AD.ge = put31(a, 'adGe', () => gedatsu30(), -3.6, -8.2, 0); AD.mu = put31(a, 'adMu', () => mujou30(), 3.6, -8.2, 0); AD.za = put31(a, 'adZa', () => zange30(), -4.4, -7.4, 0);
    AD.rows = []; const zs = [9.0, 6.0, 3.0, 0.0, -3.0]; for (let i = 0; i < 10; i++) AD.rows.push(put31(a, 'adW' + i, () => member30(i, true), i % 2 ? 2.0 : -2.0, zs[i >> 1], Math.PI, { kneel: true, bow: true, bowA: 1.05 }));
    AD.red = new THREE.DirectionalLight(0xFF3A4A, 0); AD.red.position.set(0, 9, -17); AD.red.target.position.set(0, 3, -10); adAdd(a.g, AD.red); adAdd(a.g, AD.red.target);
    AD.u = [mz, AD.ge, AD.mu, AD.za, ...AD.rows]; AD_SHOT = ''; },
  update(t) { const mz = AD.mz, m = mz.model; const shot = t < 6.0 ? 's02' : t < 7.5 ? 's03' : 's04';
    if (shot !== AD_SHOT) { AD_SHOT = shot; if (shot === 's04') { adShow([AD.ge, AD.mu, AD.za, ...AD.rows], false); mz.st = { punch: true }; adSnap([mz]); } }
    if (shot === 's02') { hemi.intensity = 0.32; AD.red.intensity = 0; AD.hall = 0.5; mz.st = { look: 0 }; adOver(m, 0);
      adCamK(adK(t, 3.8, 6.0, EZ.ioc), [0, 0.6, 16.0], [0, 3.2, -10.0], [0, 2.8, 4.5], [0, 3.8, -10.0], 34, 32); }
    else if (shot === 's03') { hemi.intensity = 0.08; AD.red.intensity = 1.1; AD.hall = 0.7;
      const look = t < 6.1 ? 0.35 : adLerp(0.35, -0.05, adK(t, 6.1, 6.4, EZ.ios)); mz.st = t >= 6.65 ? { look, windup: true } : { look };
      const ek = adLerp(1, 1.8, adK(t, 6.4, 6.4 + 4 / 30)); adEyes(m).forEach(e => e.s.scale.setScalar(e.k0 * ek)); adOver(m, adK(t, 6.8, 7.4));
      const k = adK(t, 6.0, 7.5, EZ.ios), kw = adK(t, 6.65, 6.95, EZ.ios), ly = 4.6 + 0.5 * kw; adCam(adV3([0.9, 2.2, -5.4], [0.8, 2.3, -5.6], k), [0, ly, -10.0]); adFov(36 + 12 * kw); }
    else { hemi.intensity = 0.3; AD.red.intensity = 1.1; adOver(m, 1); mz.st = { punch: true }; adCam([-3.6, 3.0, -2.6], [0, 3.7, -10.0]); adFov(44); } },
  draw(c, t, f) { const shot = t < 6.0 ? 's02' : t < 7.5 ? 's03' : 's04';
    if (shot === 's02') { adSparks(c, t, 20, { speed: 110, seed: 2 }); adVignette(c, 0.6); }
    if (shot === 's03') { adSparks(c, t, 14, { speed: 90, seed: 3 }); adVignette(c, 0.7); adRedInset(c, 0.5 * adK(t, 6.8, 7.5)); }
    if (shot !== 's04') { adGrain(c, f, 0.03);
      adNameCard(c, t, { t0: 4.1, t1: 7.35, out0: 7.15, bar: { x: 96, y0: 830, y1: 980 },
        l1: { s: '断偽文鳥門　創始者・教主', x: 120, y: 852, slide: 40, st: { size: 30, weight: 700, fill: '#EAE4D4', stroke: '#0C0A10', sw: 5, track: 3 } } });
      if (t >= 4.1 + 2 / 30 && t <= 7.35) { const k2 = adK(t, 4.1 + 2 / 30, 4.1 + 2 / 30 + 0.25, EZ.oc), fo = 1 - adK(t, 7.15, 7.35); adBigText(c, 'メス・ゼロ', 112 - 40 * (1 - k2), 950, 88, { align: 'left', alpha: k2 * fo, ex: 6, sw: 10 }); }
      return; }
    // s04：白い閃光と「断」→ 三色の止め画とスローガン
    const sh = t < 8.0 ? 16 * (1 - adK(t, 7.5, 8.0)) : 0; const dx = Math.round(sh * adWob(t, 2.1)), dy = Math.round(sh * adWob(t + 0.37, 1.7));
    if (t < 7.6) { c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, 1920, 1080); adText(c, '断', { x: 960 + dx, y: 560 + dy, size: 760, family: 'Zen Old Mincho', weight: 900, fill: '#141012' }); return; }
    if (!AD.frz) AD.frz = adTriTone(renderer.domElement);
    c.save(); c.translate(dx, dy); c.drawImage(AD.frz, -20, -11.25, 1960, 1102.5);
    adSparks(c, t, 8, { speed: 40, seed: 4 });
    // 飛び去る鳥
    for (let i = 0; i < 9; i++) { const ts = 8.6 + adH(i, 5) * 0.25, k = adK(t, ts, 9.5); if (k <= 0 || k >= 1) continue; const x = adLerp(1440 + adH(i, 6) * 160, 2000 + adH(i, 7) * 60, EZ.lin(k)), y = adLerp(400 + adH(i, 8) * 60, 40 + adH(i, 9) * 60, k); adBird(c, x, y, 18 + adH(i, 10) * 10, Math.sin(t * 8 * 6.283 + i) * 0.35, '#FFE6E8'); }
    adVignette(c, 0.7); adFill(c, '#000', adK(t, 9.55, 10.10));
    // スローガン：一閃で割れて現れる
    const P0 = [160, 740], P1 = [1760, 340], L = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), du = [(P1[0] - P0[0]) / L, (P1[1] - P0[1]) / L], nu = [du[1], -du[0]];
    const fi = f - ADF(7.6); const gap = fi <= 0 ? 64 : fi === 1 ? 30 : fi === 2 ? 12 : 6; const sc = fi <= 0 ? 1.08 : fi === 1 ? 1.04 : fi === 2 ? 1.01 : 1.0; const tfade = 1 - adK(t, 9.75, 10.05);
    const lineK = adK(t, 7.6, 7.6 + 2 / 30), la = 1 - adK(t, 7.75, 8.0); if (lineK > 0 && la > 0) { c.save(); c.globalAlpha = la; adSlash(c, P0[0], P0[1], P1[0], P1[1], 10, '#FFFFFF', 'rgba(224,40,58,0.6)', 20, lineK); c.restore(); }
    const half = (sideUp, off, alpha) => { c.save(); c.beginPath(); const far = 3000; const ox = nu[0] * (sideUp ? 1 : -1) * off / 2, oy = nu[1] * (sideUp ? 1 : -1) * off / 2;
      const a0 = [P0[0] - du[0] * far, P0[1] - du[1] * far], a1 = [P0[0] + du[0] * far, P0[1] + du[1] * far]; const s = sideUp ? 1 : -1;
      c.moveTo(a0[0] + ox, a0[1] + oy); c.lineTo(a1[0] + ox, a1[1] + oy); c.lineTo(a1[0] + ox + nu[0] * far * s, a1[1] + oy + nu[1] * far * s); c.lineTo(a0[0] + ox + nu[0] * far * s, a0[1] + oy + nu[1] * far * s); c.closePath(); c.clip();
      const tx = du[0] * off * 0.8 * (sideUp ? 1 : -1), ty = du[1] * off * 0.8 * (sideUp ? 1 : -1); adBigText(c, '断偽でメスを殲滅だ', 960 + ox + tx, 540 + oy + ty, 150, { alpha, ex: 8, sw: 12, scale: sc, glow: 'rgba(224,40,58,0.25)' }); c.restore(); };
    // 残像
    const gapOf = i => i < 0 ? 64 - 18 * i : i === 0 ? 64 : i === 1 ? 30 : i === 2 ? 12 : 6; if (fi < 4) for (let g = 3; g >= 1; g--) { const gg = gapOf(fi - g), al = [0.35, 0.2, 0.1][g - 1] * tfade; half(true, gg, al); half(false, gg, al); }
    half(true, gap, tfade); half(false, gap, tfade);
    // 割れ目から漏れる光、8.40〜8.80 に線に沿って走る光
    adSlash(c, P0[0], P0[1], P1[0], P1[1], 3, `rgba(255,240,240,${0.55 * tfade})`, 'rgba(224,40,58,0.8)', 14, 1);
    const rk = adK(t, 8.4, 8.8); if (rk > 0 && rk < 1) { const px = adLerp(P0[0], P1[0], rk), py = adLerp(P0[1], P1[1], rk); const g = c.createRadialGradient(px, py, 0, px, py, 60); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,60,80,0)'); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(px - 60, py - 60, 120, 120); c.restore(); }
    c.restore(); adGrain(c, f, 0.03);
    adFill(c, '#000', adK(t, 9.55, 10.10)); } });

// ---------- U3：s05〜s08 朝の修行（10.2〜13.533） ----------
const AD_WORDS = [['掃く。', 10.2, 1772], ['洗う。', (331 / 30), 1652], ['振る。', (356 / 30), 1532], ['読む。', 12.7, 1412]];
adScene('u3', { t0: 10.2, t1: (406 / 30), fonts: FONTS_ALL,
  async setup() { const a = await adDangi({ bg: 0x7A8494, f0: 20, f1: 60, hi: 0.5 }); sun.intensity = 0.25; sun.color.setHex(0xFFFFFF); sun.position.set(6, 10, 14);
    adTickPost(a, () => { if (a.hallGlow) a.hallGlow.material.opacity = 0.5; });
    a.g.traverse(o => { if (o.isMesh && o.material && o.material.transparent && o.geometry && o.geometry.type === 'PlaneGeometry' && Math.abs(o.position.x - 8.2) < 0.01) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0x1A2A3A); AD.water = o; } });
    AD.sm = put31(a, 'adSm', () => shinmai30(true), -0.6, 3.6, -0.35 * Math.PI, { paint: true }); AD.ge = put31(a, 'adGe3', () => gedatsu30(), 9.4, -1.2, -0.75 * Math.PI, { cross: true, look: 0.3 });
    AD.m2 = put31(a, 'adM2', () => member30(2, false), -9.6, -2.0, Math.PI); AD.mu = put31(a, 'adMu3', () => mujou30(), -9.2, 3.0, 0.93 * Math.PI); AD.za = put31(a, 'adZa3', () => zange30(), 7.4, 2.6, -Math.PI / 2, { sit: true, look: 0.2 }, 0.44);
    AD.lamp = adPoint(a, 0xFFB060, 0, 6, 6.0, 1.6, 3.6);
    AD.sm.model.adPost = c => { if (AD_SHOT === 's05') c.arms[1].rotation.x = -1.4 + 0.35 * Math.sin(2 * Math.PI * (AD_T - 10.2) / 0.83); };
    AD.za.model.adPost = c => { c.arms[1].rotation.x = AD.zaX ?? -1.0; c.arms[1].rotation.z = AD.zaZ ?? 0.0; };
    const hit = (fs) => fs.some(f0 => AD_F >= f0 && AD_F < f0 + 4); AD.sm.model.adPost0 = AD.sm.model.adPost; AD.sm.model.adPost = c => { AD.sm.model.adPost0(c); if (AD_SHOT === 's07' && hit([359, 368, 377])) c.arms[0].rotation.x = -1.6; };
    AD.m2.model.adPost = c => { if (AD_SHOT === 's07' && hit([364, 373])) c.arms[0].rotation.x = -1.6; };
    AD.u = [AD.sm, AD.ge, AD.m2, AD.mu, AD.za]; adShow([AD.ge, AD.m2, AD.mu, AD.za], false); AD_SHOT = ''; },
  update(t) { AD_T = t; const sm = AD.sm; const shot = t < (331 / 30) ? 's05' : t < (356 / 30) ? 's06' : t < 12.7 ? 's07' : 's08';
    if (shot !== AD_SHOT) { AD_SHOT = shot; adShow([AD.ge, AD.m2, AD.mu, AD.za], false); AD.lamp.intensity = 0; if (sm.model.broom) sm.model.broom.visible = shot === 's05';
      if (shot === 's05') adPlace(sm, -0.6, 3.6, -0.35 * Math.PI, { paint: true });
      if (shot === 's06') { adPlace(sm, 8.2, -2.4, -0.18 * Math.PI, { kneel: true, look: 0 }, -0.32); adPlace(AD.ge, 9.9, -0.7, -0.75 * Math.PI, { look: 0.3 }); }
      if (shot === 's07') { adPlace(sm, -8.4, -0.6, Math.PI, {}); adPlace(AD.m2, -9.6, -2.0, Math.PI, {}); adPlace(AD.mu, -9.2, 3.0, 0.93 * Math.PI, {}); }
      if (shot === 's08') { adPlace(sm, 5.8, 2.6, Math.PI / 2, { sit: true, look: 0.1 }, 0.44); adPlace(AD.za, 7.8, 2.6, -Math.PI / 2, { sit: true, look: 0.2 }, 0.44); AD.lamp.intensity = 0.6; }
      adSnap(AD.u); }
    if (shot === 's05') adCamK(adK(t, 10.2, (331 / 30)), [2.6, 1.35, 10.4], [-0.5, 1.2, 2.8], [2.9, 1.35, 10.4], [-0.2, 1.2, 2.8], 34);
    if (shot === 's06') adCamK(adK(t, (331 / 30), (356 / 30)), [5.0, 2.6, 5.4], [8.8, 1.6, -1.6], [5.2, 2.6, 5.2], [8.8, 1.6, -1.6], 40);
    if (shot === 's07') { const on = (ts) => t >= ts && t < ts + 4 / 30; sm.st.punch = on((359 / 30)) || on((368 / 30)) || on((377 / 30)); AD.m2.st.punch = on((364 / 30)) || on((373 / 30));
      adCamK(adK(t, (356 / 30), 12.7), [-4.4, 1.35, -4.6], [-9.1, 1.2, -1.5], [-4.4, 1.35, -4.6], [-9.3, 1.2, -1.5], 40); }
    if (shot === 's08') adCamK(adK(t, 12.7, (406 / 30)), [5.8, 2.5, 9.6], [6.5, 1.3, 2.6], [5.8, 2.45, 9.4], [6.5, 1.3, 2.6], 34); },
  draw(c, t, f) { adVignette(c, 0.35); adGrain(c, f, 0.03);
    // 朝の修行（左上の札）
    const tk = adK(t, 10.2, 10.35, EZ.oc); c.fillStyle = '#C01828'; c.fillRect(96, 54, 190 * tk, 52); adText(c, '朝の修行', { x: 114, y: 81, size: 30, weight: 700, align: 'left', fill: '#EAE4D4', track: 2.4, alpha: tk });
    // 右の縦長の札
    const pa = adK(t, 10.2, 10.2 + 2 / 30); c.save(); c.globalAlpha = pa; c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 18; c.shadowOffsetY = 6; c.fillStyle = '#EAE4D4'; c.fillRect(1350, 200, 490, 560); c.restore();
    c.save(); c.globalAlpha = pa; c.strokeStyle = '#1A1416'; c.lineWidth = 2; c.strokeRect(1360, 210, 470, 540); c.restore();
    for (const [w, ts, x] of AD_WORDS) { if (t < ts) continue; const fi = f - ADF(ts), a = adClamp((fi + 1) / 2), sc = adLerp(1.12, 1.0, adClamp(fi / 4)); c.save(); c.translate(x, 410); c.scale(sc, sc); c.translate(-x, -410);
      [...w].forEach((ch, i) => { if (ch === '。') adText(c, ch, { x: x + 60, y: 300 + i * 110 - 56, size: 104, family: 'Yuji Syuku', weight: 400, fill: '#1A1416', alpha: a }); else adText(c, ch, { x, y: 300 + i * 110, size: 104, family: 'Yuji Syuku', weight: 400, fill: '#1A1416', alpha: a }); }); c.restore(); }
    // 判
    if (t >= 13.1) { const fi = f - ADF(13.1), sc = adLerp(1.4, 1.0, adClamp(fi / 3)), jx = fi < 2 ? (fi % 2 ? 2 : -2) : 0; c.save(); c.translate(1404 + jx, 690); c.rotate(-4 * Math.PI / 180); c.scale(sc, sc); c.fillStyle = '#C01828'; c.fillRect(-38, -38, 76, 76); adText(c, '断', { x: 0, y: 2, size: 50, family: 'Shippori Mincho B1', weight: 800, fill: '#EAE4D4' }); c.restore(); } } });

// ---------- U4：s09〜s10 証言と点呼（13.533〜18.5） ----------
adScene('u4', { t0: (406 / 30), t1: 18.5, fonts: FONTS_ALL,
  async setup() { const a = await adDangi({ bg: 0xC89A84, f0: 18, f1: 60, hi: 0.55 }); sun.intensity = 0.6; sun.color.setHex(0xFFB080); sun.position.set(-20, 6, 6);
    AD.hie = put31(a, 'adHie', () => member30(1, false), 1.3, 0.0, -0.2 * Math.PI, { headY: -0.3 });
    const xs = [-1.65, -0.55, 0.55, 1.65], zf = -1.6, zb = -0.4; AD.row = [put31(a, 'adR0', () => member30(0, false), xs[0], zf, Math.PI), put31(a, 'adR2', () => member30(2, false), xs[1], zf, Math.PI), put31(a, 'adR4', () => member30(4, false), xs[3], zf, Math.PI),
      put31(a, 'adR5', () => member30(5, false), xs[0], zb, Math.PI), put31(a, 'adR7', () => member30(7, false), xs[1], zb, Math.PI), put31(a, 'adR8', () => member30(8, false), xs[2], zb, Math.PI), put31(a, 'adR9', () => member30(9, false), xs[3], zb, Math.PI)];
    AD.ge = put31(a, 'adGe4', () => gedatsu30(), 2.4, -4.6, -0.12 * Math.PI, { cross: true });
    AD.hand = { i: 0, x: -3.0, z: 0.45 }; AD.hie.model.adPost = c => { if (AD_SHOT !== 's10') return; const k = adK(AD_T, 16.95, 17.15, EZ.oc) * (1 - adK(AD_T, 18.2, 18.4, EZ.ios)); const H = AD.hand, A = c.arms[H.i]; if (k > 0) { A.rotation.x = adLerp(A.rotation.x, H.x, k); A.rotation.z = adLerp(A.rotation.z, H.z, k); } };
    AD.u = [AD.hie, ...AD.row, AD.ge]; adShow([...AD.row, AD.ge], false); AD_SHOT = ''; AD.nods = { 14.4: 1, 15.3: 1, 16.1: 1 }; },
  update(t, warm) { AD_T = t; const shot = t < (505 / 30) ? 's09' : 's10';
    if (shot !== AD_SHOT) { AD_SHOT = shot; if (shot === 's09') { adShow([...AD.row, AD.ge], false); adPlace(AD.hie, 1.3, 0.0, -0.2 * Math.PI, { headY: -0.3 }); }
      else { adShow([...AD.row, AD.ge], true); adPlace(AD.hie, 0.55, -2.15, Math.PI, {}); AD.row.forEach(n => { n.st = {}; }); AD.ge.st = { cross: true }; } adSnap(AD.u); }
    if (!warm) for (const k in AD.nods) if (ADF(t) === ADF(+k)) AD.hie.model.nod = 0.5;
    if (shot === 's09') adCamK(adK(t, (406 / 30), (505 / 30), EZ.ios), [0.2, 1.9, 3.2], [0.8, 1.85, 0.0], [0.25, 1.9, 3.0], [0.8, 1.85, 0.0], 28);
    else adCamK(adK(t, (505 / 30), 18.5), [-0.6, 2.9, -6.3], [0.1, 1.5, -0.8], [-0.55, 2.9, -6.15], [0.1, 1.5, -0.8], 40); },
  draw(c, t, f) { adVignette(c, 0.35); adGrain(c, f, 0.03);
    if (t < (505 / 30)) adNameCard(c, t, { t0: 13.65, t1: 16.7, out0: 16.55, bar: { x: 100, y0: 742, y1: 862 },
      l1: { s: '断偽文鳥門　門下', x: 128, y: 768, slide: 30, st: { size: 26, weight: 700, fill: '#EAE4D4', stroke: '#0C0A10', sw: 4 } },
      l2: { s: 'ヒ・エ', x: 124, y: 846, slide: 30, st: { size: 64, weight: 900, fill: '#EFEDE8', stroke: '#0C0A10', sw: 8 } } });
    const qa = adK(t, 13.8, 14.0) * (1 - adK(t, 18.2, 18.35)); adText(c, '「ここじゃ毎朝、点呼で名前を呼ばれる。」', { x: 960, y: 975 - 4 * adK(t, 13.8, 14.0, EZ.oc), size: 54, weight: 700, fill: '#FFFFFF', stroke: '#0C0A10', sw: 8, alpha: qa });
    const pa = adK(t, 13.65, 13.85) * (1 - adK(t, 18.2, 18.35)); adText(c, '※個人の感想です', { x: 1856, y: 1040, size: 24, weight: 500, align: 'right', fill: '#EAE4D4', alpha: 0.85 * pa });
    adFill(c, '#000', adK(t, 18.35, 554 / 30)); } });

// ---------- U5：s11〜s12 呼びかけ（18.5〜25.1） ----------
adScene('u5', { t0: 18.5, t1: 25.1, fonts: FONTS_ALL,
  async setup() { const a = await adSohon({ bg: 0x070508, f0: 24, f1: 84, hi: 0.30, ground: 0x6A665E }); sun.intensity = 0.2; adCrestFix(a); if (a.wall) a.wall.visible = false;
    adClearCedars(a, (x, z) => Math.abs(x) < 8 && z > 21);
    adPoint(a, 0xFFB060, 2.2, 12, 0, 5.2, 24.5); for (const x of [-4.4, 4.4]) { const l = glowSprite(0xFFB060, 1.4, 0.85); l.position.set(x, 5.6, 22.2); adAdd(a.g, l); }
    a.fires.forEach(s => s.scale.multiplyScalar(1.25)); const cg = glowSprite(0xFF2A1A, 3.4, 0.35); cg.position.set(0, 5.6, -10.55); adAdd(a.g, cg);
    adTickPost(a, () => { a.hallGlow.material.opacity = 0.45; });
    const mz = put31(a, 'adMz5', () => mesuZeroBird(), 0, -10.0, 0, {}, 1.2); mzOver30(mz.model, false); AD.mz = mz;
    AD.rows = []; const zs = [15.0, 12.4, 9.8, 7.2, 4.6, 2.0]; for (let i = 0; i < 12; i++) AD.rows.push(put31(a, 'adX' + i, () => member30(i, true), i % 2 ? 2.2 : -2.2, zs[i >> 1], Math.PI, {}));
    AD.nv = put31(a, 'adNovice5', () => member30(0, false), 0, -3.0, Math.PI, {});
    AD.u = [mz, ...AD.rows, AD.nv]; AD_SHOT = ''; },
  update(t) { AD_T = t; const bowed = t >= (604 / 30); AD.rows.forEach(n => { n.st = bowed ? { kneel: true, bow: true, bowA: 1.1 } : {}; }); AD.nv.st = bowed ? { bow: true, bowA: 0.9 } : {};
    if (t < 21.8) { // 参道を進む：18.5〜21.0 は等速、21.0〜21.8 でゆるめて止まる
      const Z0 = 31.0, D = Z0 - 5.8, v = D / 2.9; let z; if (t < 21.0) z = Z0 - v * (t - 18.5); else { const u = t - 21.0; z = Z0 - v * 2.5 - (v * u - v * u * u / (2 * 0.8)); } const kz = (Z0 - z) / D; adCam([0, adLerp(1.8, 2.3, kz), z], [0, adLerp(8.0, 3.0, adK(t, 18.5, 19.4, EZ.ios)), -10.6]); adFov(42); hemi.intensity = 0.30; }
    else { const k = adK(t, 21.8, 25.1, EZ.ios); adCamK(k, [0, 2.3, 5.8], [0, 3.0, -10.6], [0, 12.0, 18.5], [0, 1.0, -3.0], 42, 50); hemi.intensity = adLerp(0.30, 0.36, k); } },
  draw(c, t, f) { adSparks(c, t, 18, { speed: 100, seed: 5 }); adVignette(c, 0.55); adGrain(c, f, 0.03);
    adBottomShade(c, adK(t, 20.6, 20.9) * (1 - adK(t, 24.8, 24.95)));
    if (t >= (623 / 30)) { const fi = f - ADF((623 / 30)), k = EZ.oc(adClamp(fi / 3)), fo = 1 - adK(t, 24.8, 24.95); c.save(); c.translate(960, 905 - 24 * (1 - k)); c.scale(adLerp(1.12, 1.0, k), adLerp(1.12, 1.0, k));
      adText(c, '断偽文鳥門に入ろう', { x: 0, y: 0, size: 124, weight: 900, fill: '#EFEDE8', stroke: '#0C0A10', sw: 12, alpha: fo, shadow: { col: 'rgba(0,0,0,0.4)', dy: 4, blur: 10 } }); c.restore();
      const lk = adK(t, 21.0, 21.3, EZ.oc); if (lk > 0) { c.save(); c.globalAlpha = fo; c.fillStyle = '#C01828'; c.fillRect(960 - 500 * lk, 986, 1000 * lk, 8); c.restore(); } }
    adFill(c, '#000', adK(t, 24.95, 25.1)); adFill(c, '#000', 1 - adK(t, 18.5, 18.65)); },
  shake(t) { if (t < (623 / 30) || t > (630.5 / 30)) return [0, 0]; const s = 6 * (1 - adK(t, (623 / 30), (630.5 / 30))); return [Math.round(s * adWob(t, 2.3)), Math.round(s * adWob(t + 0.4, 1.9))]; } });

// ---------- U6：s13 エンドカード（25.1〜30） ----------
adScene('u6', { t0: 25.1, t1: 30.0, fonts: FONTS_ALL, cover: true,
  async setup() { for (const k in AREAS) AREAS[k].g.visible = false; scene.background = new THREE.Color(0x000000); scene.fog = null; adCam([0, 2, 30], [0, 2, 40]); },
  update(t) { adCam([0, 2, 30], [0, 2, 40]); },
  draw(c, t, f) { c.fillStyle = '#0C0A0C'; c.fillRect(0, 0, 1920, 1080); const g = c.createRadialGradient(960, 420, 0, 960, 420, 520); g.addColorStop(0, 'rgba(192,24,40,0.10)'); g.addColorStop(1, 'rgba(192,24,40,0)'); c.fillStyle = g; c.fillRect(0, 0, 1920, 1080);
    adSparks(c, t, 10, { speed: 70, seed: 6, x0: 420, x1: 1500 });
    // 紋章：中心から左右へ開く
    const E = adEmbInfo(), s = 300 / E.w, cx = 960 - E.cx * s, cy = 360 - E.cy * s; const ok = adK(t, 25.2, 25.6, EZ.oc);
    if (ok > 0) { c.save(); c.globalAlpha = ok; c.beginPath(); c.rect(960 - 170 * ok, 360 - 200, 340 * ok, 400); c.clip(); emblem30(c, cx, cy, s, '#C01828'); c.restore(); }
    const bk = adK(t, 25.9, 26.3); if (bk > 0 && bk < 1) { if (!AD.embCv) { const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; emblem30(cv.getContext('2d'), cx, cy, s, '#C01828'); AD.embCv = cv; }
      const tmp = AD.tmpCv || (AD.tmpCv = document.createElement('canvas')); tmp.width = 1920; tmp.height = 1080; const x = tmp.getContext('2d'); x.drawImage(AD.embCv, 0, 0); x.globalCompositeOperation = 'source-atop'; const bx = adLerp(760, 1160, bk), by = adLerp(560, 160, bk);
      x.save(); x.translate(bx, by); x.rotate(-Math.PI / 4); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(-30, -300, 60, 600); x.restore(); c.drawImage(tmp, 0, 0); }
    const k1 = adK(t, 25.6, 26.0, EZ.oc); adText(c, '断偽文鳥門', { x: 960, y: 620 - 10 * (1 - k1), size: 120, family: 'Shippori Mincho B1', weight: 800, fill: '#EAE4D4', track: 14.4, stroke: '#C8A040', sw: 1, alpha: k1 });
    const k2 = adK(t, 26.1, 26.4); adText(c, '偽りなき世界へ', { x: 960, y: 712, size: 40, family: 'Shippori Mincho B1', weight: 600, fill: '#C8A040', track: adLerp(12, 8, adK(t, 26.1, 26.7, EZ.oc)), alpha: k2 });
    const k3 = adK(t, 26.6, 26.9); adText(c, 'ここには、rate がない。', { x: 960, y: 800, size: 30, weight: 500, fill: '#EAE4D4', alpha: 0.8 * k3 });
    adGrain(c, f, 0.03); } });

// ================= 書き出しの口 =================
window.__ad = {
  list: () => Object.keys(AD.scenes).map(k => ({ key: k, f0: ADF(AD.scenes[k].t0), f1: ADF(AD.scenes[k].t1) })),
  async prepare(key) { const s = AD.scenes[key]; if (!s) throw new Error('no scene ' + key); $('title').hidden = true; G.mode = 'cine'; setObj(''); bgm(''); adHideUI(); AD.cv.style.zIndex = 99999; window.__adSeed && window.__adSeed(20261121);
    await adFonts(s.fonts || FONTS_ALL); AD.cur = s; await s.setup(); for (const id of ['hud', 'act', 'prompt', 'dlg']) { const e = $(id); if (e) e.hidden = true; } return { f0: ADF(s.t0), f1: ADF(s.t1) }; },
  async freeze() { const s = AD.cur; window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 300)); window.__adSeed && window.__adSeed(777); T.now = 100 + s.t0 - 1.5; G.shake = 0; AD.now = 1e6; loop(AD.now);
    for (let i = 0; i < 45; i++) { s.update(s.t0, true); AD.now += 1000 / AD.fps; loop(AD.now); } T.now = 100 + s.t0; AD_SHOT = ''; AD.frz = null; },
  frame(f) { const s = AD.cur, t = f / AD.fps; AD_F = f; s.update(t, false); AD.now += 1000 / AD.fps; loop(AD.now); const c = AD.cx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (!s.cover) { const [dx, dy] = s.shake ? s.shake(t) : [0, 0]; if (dx || dy) { c.fillStyle = '#000'; c.fillRect(0, 0, 1920, 1080); c.drawImage(renderer.domElement, -12 + dx, -6.75 + dy, 1944, 1093.5); } else c.drawImage(renderer.domElement, 0, 0, 1920, 1080); }
    if (s.draw) { c.save(); s.draw(c, t, f); c.restore(); }
    adNote(c, 1 - adK(t, 29.5, 30.0)); if (t >= 29.5) adFill(c, '#000', adK(t, 29.5, 30.0)); return true; },
};
