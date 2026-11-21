// ================= 断偽文鳥門　広告（書き出し専用。本編には入れない） =================
// 本編のエンジンをそのまま使い、一コマずつ決まった時刻で描く。文字と画面効果は上に重ねた 2D のキャンバスに描く。
const AD = { fps: 30, scenes: {}, cur: null, now: 0, cv: null, cx: null, extra: [] };
const adClamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const adSmooth = x => { x = adClamp(x); return x * x * (3 - 2 * x); };
const adEaseOut = x => 1 - Math.pow(1 - adClamp(x), 3);
const adEaseIn = x => Math.pow(adClamp(x), 3);
const adLerp = (a, b, k) => a + (b - a) * k;
// 区間 [a,b] で 0→1→0（立ち上がり ia 秒、消え fo 秒）
const adHill = (t, a, b, ia = 0.25, fo = 0.25) => t < a || t > b ? 0 : Math.min(adSmooth((t - a) / Math.max(ia, 1e-4)), adSmooth((b - t) / Math.max(fo, 1e-4)));
// 決まった揺れ（乱数を使わない）
const adWob = (t, s = 1) => Math.sin(t * 13.1 * s) * 0.5 + Math.sin(t * 7.7 * s + 1.3) * 0.35 + Math.sin(t * 3.1 * s + 2.1) * 0.15;
function adCam(p, l) { AD.camP = p; cut18(p[0], p[1], p[2], l[0], l[1], l[2]); if (A && A.nob) for (const q of A.nob) q.rotation.y = (p[0] > q.position.x ? 1 : -1) * Math.PI / 2; }
function adCamLerp(k, p0, l0, p1, l1) { const e = adSmooth(k); adCam([0, 1, 2].map(i => adLerp(p0[i], p1[i], e)), [0, 1, 2].map(i => adLerp(l0[i], l1[i], e))); }
function adHideUI() {
  if (!$('adStyle')) { const st = document.createElement('style'); st.id = 'adStyle'; st.textContent = 'body > *:not(#stage):not(#adov){display:none !important} #stage{position:fixed !important;left:0;top:0;width:1920px !important;height:1080px !important} html,body{margin:0;background:#000;overflow:hidden}'; document.head.appendChild(st); }
  if (!AD.cv) { const cv = document.createElement('canvas'); cv.id = 'adov'; cv.width = 1920; cv.height = 1080; Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: '1920px', height: '1080px', zIndex: 99999, pointerEvents: 'none' }); document.body.appendChild(cv); AD.cv = cv; AD.cx = cv.getContext('2d'); }
  resize();
}
// 場面の登録：{ dur, setup: async () => {}, update(t), draw(c, t) }
function adScene(key, o) { AD.scenes[key] = o; }
// 場面で足したもの（光・小物）を記録しておき、片づけに使う
function adAdd(parent, obj) { parent.add(obj); AD.extra.push(obj); return obj; }
async function adFonts(list) { await Promise.all(list.map(([f, s]) => document.fonts.load(f, s).catch(() => null))); }

// ---------- 2D の部品 ----------
function adText(c, str, o) {
  const { x, y, size = 64, family = 'Zen Kaku Gothic New', weight = 900, align = 'center', base = 'middle', fill = '#F2EEE6', alpha = 1, stroke = null, sw = 0, glow = null, gb = 0, track = 0, sx = 1, shadow = null } = o;
  if (alpha <= 0.001) return 0; c.save(); c.globalAlpha = adClamp(alpha); c.font = `${weight} ${size}px "${family}"`; c.textBaseline = base; c.textAlign = 'left';
  const chars = [...str]; const ws = chars.map(ch => c.measureText(ch).width); const W = ws.reduce((a, b) => a + b, 0) + track * Math.max(0, chars.length - 1);
  let x0 = align === 'center' ? x - W * sx / 2 : align === 'right' ? x - W * sx : x;
  c.translate(x0, y); c.scale(sx, 1);
  const pass = (fn) => { let cx = 0; chars.forEach((ch, i) => { fn(ch, cx); cx += ws[i] + track; }); };
  if (shadow) { c.save(); c.fillStyle = shadow.col; c.translate(shadow.dx || 0, shadow.dy || 0); if (shadow.blur) { c.shadowColor = shadow.col; c.shadowBlur = shadow.blur; } pass((ch, cx) => c.fillText(ch, cx, 0)); c.restore(); }
  if (stroke && sw > 0) { c.lineJoin = 'round'; c.lineWidth = sw; c.strokeStyle = stroke; pass((ch, cx) => c.strokeText(ch, cx, 0)); }
  if (glow) { c.shadowColor = glow; c.shadowBlur = gb; }
  c.fillStyle = fill; pass((ch, cx) => c.fillText(ch, cx, 0)); c.restore(); return W * sx;
}
// 縦書き（一字ずつ下へ）
function adVText(c, str, o) {
  const { x, y, size = 48, family = 'Shippori Mincho B1', weight = 800, fill = '#EAE4D4', alpha = 1, gap = 1.12, glow = null, gb = 0, stroke = null, sw = 0 } = o;
  if (alpha <= 0.001) return; c.save(); c.globalAlpha = adClamp(alpha); c.font = `${weight} ${size}px "${family}"`; c.textAlign = 'center'; c.textBaseline = 'middle';
  [...str].forEach((ch, i) => { const yy = y + i * size * gap; const rot = 'ー〜…'.includes(ch); c.save(); c.translate(x, yy); if (rot) c.rotate(Math.PI / 2);
    if (stroke && sw) { c.lineJoin = 'round'; c.lineWidth = sw; c.strokeStyle = stroke; c.strokeText(ch, 0, 0); } if (glow) { c.shadowColor = glow; c.shadowBlur = gb; } c.fillStyle = fill; c.fillText(ch, 0, 0); c.restore(); });
  c.restore();
}
function adVignette(c, k = 0.6, col = '0,0,0') { const g = c.createRadialGradient(960, 540, 300, 960, 540, 1150); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${k})`); c.fillStyle = g; c.fillRect(0, 0, 1920, 1080); }
function adBars(c, h) { if (h <= 0) return; c.fillStyle = '#000'; c.fillRect(0, 0, 1920, h); c.fillRect(0, 1080 - h, 1920, h); }
// 粒子のざらつき：決まった模様を 4 枚作って、コマごとに位置をずらす
const AD_GRAIN = [];
function adGrain(c, f, k = 0.05) { if (k <= 0) return; if (!AD_GRAIN.length) { for (let n = 0; n < 4; n++) { const g = document.createElement('canvas'); g.width = 256; g.height = 256; const x = g.getContext('2d'), im = x.createImageData(256, 256); let s = 1234 + n * 777; for (let i = 0; i < im.data.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const v = (s >> 16) & 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); AD_GRAIN.push(g); } }
  c.save(); c.globalAlpha = k; c.globalCompositeOperation = 'overlay'; const g = AD_GRAIN[f % 4]; const ox = (f * 97) % 256, oy = (f * 61) % 256; for (let y = -oy; y < 1080; y += 256) for (let x = -ox; x < 1920; x += 256) c.drawImage(g, x, y); c.restore(); }
// 一閃（両端が細いレンズ形）
function adSlash(c, x0, y0, x1, y1, w, col, glow = null, gb = 0, k = 1) { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 1 || k <= 0) return; const nx = -dy / L, ny = dx / L; const xe = x0 + dx * k, ye = y0 + dy * k; c.save(); if (glow) { c.shadowColor = glow; c.shadowBlur = gb; } c.fillStyle = col; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + xe) / 2 + nx * w, (y0 + ye) / 2 + ny * w, xe, ye); c.quadraticCurveTo((x0 + xe) / 2 - nx * w, (y0 + ye) / 2 - ny * w, x0, y0); c.fill(); c.restore(); }
function adEmblem(c, cx, cy, s, col, alpha = 1) { if (alpha <= 0) return; c.save(); c.globalAlpha = adClamp(alpha); emblem30(c, cx, cy, s, col); c.restore(); }

// ---------- 舞台の部品 ----------
// 地面の色を沈める（区域でいちばん大きい平面）
function adGround(a, hex) { let best = null, bs = 0; a.g.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry') { const p = o.geometry.parameters, s = p.width * p.height; if (s > bs) { bs = s; best = o; } } }); if (best) { best.material = best.material.clone(); best.material.color.setHex(hex); } return best; }
function adSky(bg, f0, f1, hi) { scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, f0, f1); if (hi !== undefined) hemi.intensity = hi; }
function adPoint(a, col, I, d, x, y, z) { const l = new THREE.PointLight(col, I, d, 2); l.position.set(x, y, z); return adAdd(a.g, l); }
// 名前のある門下を列に並べる（key を変えると別の個体）
function adRow(a, pre, n, x0, dx, z, f, war, st, i0 = 0) { const out = []; for (let i = 0; i < n; i++) out.push(put31(a, pre + i, () => member30(i + i0, war), x0 + i * dx, z, f, st || {})); return out; }
// 大勢（インスタンス描画）：rows×cols を格子に
function adCrowd(a, o) { const list = []; for (let r = 0; r < o.rows; r++) for (let i = 0; i < o.cols; i++) { const x = o.x0 + i * o.dx + (r % 2) * (o.stag || 0), z = o.z0 + r * o.dz; if (o.skip && o.skip(x, z)) continue; list.push([x, 0, z, o.face, 0]); } const cr = birdCrowd(a.g, list, Object.assign({ s: 1.15, coat: 0x1C1C22, cap: 0x16161A, beak: 0xD8505B, pants: 0x2A2A30 }, o.look || {})); return cr; }
// 広げられた境内（夜）の基本の飾りつけ
async function adSohon(o = {}) { await goCine30('sohon34'); await fade(false); const a = AREAS.sohon34; for (const n of a.npcs) n.hidden = true; if (a.e31) for (const k in a.e31) a.e31[k].hidden = true;
  adSky(o.bg ?? 0x060406, o.f0 ?? 20, o.f1 ?? 74, o.hi ?? 0.3); adGround(a, o.ground ?? 0x4A4640); return a; }
async function adDangi(o = {}) { await goCine30('dangi30'); await fade(false); const a = AREAS.dangi30; for (const n of a.npcs) n.hidden = true; if (a.e30) { for (const k in a.e30) if (a.e30[k] && a.e30[k].hidden !== undefined) a.e30[k].hidden = true; } if (a.e31) for (const k in a.e31) a.e31[k].hidden = true;
  adSky(o.bg ?? 0x9AA4AC, o.f0 ?? 24, o.f1 ?? 70, o.hi ?? 0.8); if (o.ground) adGround(a, o.ground); return a; }

// 本堂正面の紋章板（3.2×1.0）は正方形のテクスチャが横につぶれているので、横長の絵に描き直す
function adCrestFix(a, glow = 0) { a.g.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry') { const p = o.geometry.parameters; if (Math.abs(p.width - 3.2) < 0.01 && Math.abs(p.height - 1.0) < 0.01) {
  o.material = o.material.clone(); o.material.map = canvasTex(640, 200, (c, w, h) => { c.fillStyle = '#1A1416'; c.fillRect(0, 0, w, h); c.fillStyle = '#8A1020'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8); emblem30(c, w / 2, h / 2 + 4, 0.72, '#C01828'); }); o.material.needsUpdate = true; a.crest = o; } } }); return a.crest; }
