// ================= 「外神竜に会いに行こう」ムービー（書き出し専用。本編には入れない）：土台 =================
// 本編のエンジンをそのまま使い、一コマずつ決まった時刻で描く。字と画面効果は上に重ねた 2D のキャンバスに描く。
const AD = { fps: 30, scenes: {}, cur: null, now: 0, cv: null, cx: null, extra: [] };
const adClamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const adSmooth = x => { x = adClamp(x); return x * x * (3 - 2 * x); };
const adLerp = (a, b, k) => a + (b - a) * k;
function adCam(p, l) { AD.camP = p; cut18(p[0], p[1], p[2], l[0], l[1], l[2]); }
function adHideUI() {
  if (!$('adStyle')) { const st = document.createElement('style'); st.id = 'adStyle'; st.textContent = 'body > *:not(#stage):not(#adov){display:none !important} #stage{position:fixed !important;left:0;top:0;width:1920px !important;height:1080px !important} html,body{margin:0;background:#000;overflow:hidden}'; document.head.appendChild(st); }
  if (!AD.cv) { const cv = document.createElement('canvas'); cv.id = 'adov'; cv.width = 1920; cv.height = 1080; Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: '1920px', height: '1080px', zIndex: 99999, pointerEvents: 'none' }); document.body.appendChild(cv); AD.cv = cv; AD.cx = cv.getContext('2d'); }
  resize();
}
// 場面の登録：{ t0, t1, setup: async () => {}, update(t, warm), draw(c, t, f) }（t はムービー全体の秒）
function adScene(key, o) { AD.scenes[key] = o; }
// 場面で足したもの（光・小物）
function adAdd(parent, obj) { parent.add(obj); AD.extra.push(obj); return obj; }
async function adFonts(list) { await Promise.all(list.map(([f, s]) => document.fonts.load(f, s).catch(() => null))); }

// ---------- 2D の部品 ----------
// 一字ずつ並べて描く（字間 track）。影 → 縁 → 塗りの順。Zen Kaku Gothic New の「…」は字の中ほどへ上げる
function adText(c, str, o) {
  const { x, y, size = 64, family = 'Zen Kaku Gothic New', weight = 900, align = 'center', base = 'middle', fill = '#F2EEE6', alpha = 1, stroke = null, sw = 0, glow = null, gb = 0, track = 0, sx = 1, shadow = null } = o;
  if (alpha <= 0.001) return 0; c.save(); c.globalAlpha = adClamp(alpha); c.font = `${weight} ${size}px "${family}"`; c.textBaseline = base; c.textAlign = 'left';
  const chars = [...str]; const ws = chars.map(ch => c.measureText(ch).width); const W = ws.reduce((a, b) => a + b, 0) + track * Math.max(0, chars.length - 1);
  let x0 = align === 'center' ? x - W * sx / 2 : align === 'right' ? x - W * sx : x;
  c.translate(x0, y); c.scale(sx, 1);
  const lift = family.indexOf('Zen Kaku') >= 0 ? size * 0.3 : 0; const pass = (fn) => { let cx = 0; chars.forEach((ch, i) => { if (ch === '…' && lift) { c.save(); c.translate(0, -lift); fn(ch, cx); c.restore(); } else fn(ch, cx); cx += ws[i] + track; }); };
  if (shadow) { c.save(); c.fillStyle = shadow.col; c.translate(shadow.dx || 0, shadow.dy || 0); if (shadow.blur) { c.shadowColor = shadow.col; c.shadowBlur = shadow.blur; } pass((ch, cx) => c.fillText(ch, cx, 0)); c.restore(); }
  if (stroke && sw > 0) { c.lineJoin = 'round'; c.lineWidth = sw; c.strokeStyle = stroke; pass((ch, cx) => c.strokeText(ch, cx, 0)); }
  if (glow) { c.shadowColor = glow; c.shadowBlur = gb; }
  c.fillStyle = fill; pass((ch, cx) => c.fillText(ch, cx, 0)); c.restore(); return W * sx;
}
function adVignette(c, k = 0.6, col = '0,0,0') { if (k <= 0) return; const g = c.createRadialGradient(960, 540, 300, 960, 540, 1150); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${k})`); c.fillStyle = g; c.fillRect(0, 0, 1920, 1080); }
// 粒子のざらつき：決まった模様を 4 枚作って、コマごとに位置をずらす
const AD_GRAIN = [];
function adGrain(c, f, k = 0.05) { if (k <= 0) return; if (!AD_GRAIN.length) { for (let n = 0; n < 4; n++) { const g = document.createElement('canvas'); g.width = 256; g.height = 256; const x = g.getContext('2d'), im = x.createImageData(256, 256); let s = 1234 + n * 777; for (let i = 0; i < im.data.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; const v = (s >> 16) & 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); AD_GRAIN.push(g); } }
  c.save(); c.globalAlpha = k; c.globalCompositeOperation = 'overlay'; const g = AD_GRAIN[f % 4]; const ox = (f * 97) % 256, oy = (f * 61) % 256; for (let y = -oy; y < 1080; y += 256) for (let x = -ox; x < 1920; x += 256) c.drawImage(g, x, y); c.restore(); }

// ---------- 舞台の部品 ----------
function adSky(bg, f0, f1, hi) { scene.background = new THREE.Color(bg); scene.fog = new THREE.Fog(bg, f0, f1); if (hi !== undefined) hemi.intensity = hi; }
