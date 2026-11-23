// punch.js — "simulation: a right straight into Yuria's stomach". Entry: window.renderFrame(t)
const SW = 1080, SH = 1920;
const DURATION = 52;
const YX = 740, AX = 470, FY = 1660, SC = 1.3;   // Yuria x, attacker x, floor y, scale
const HIT = [700, FY - 245 * SC];                 // impact point on Yuria's stomach (scene coords)

// ------------------------------------------------------------------ helpers
const cam = (x, y, z) => ({ x, y, z });
const toS = (p, c) => [(p[0] - c.x) * c.z + 540, (p[1] - c.y) * c.z + 960];
function tw(str, fs) { let w = 0; for (const ch of str) w += /[\x00-\x7F]/.test(ch) ? 0.58 : 1.0; return w * fs; }
const COL = { yuria: '#F0AE34', vol: '#79AEE0', man: '#C2474F' };
function bubble(text, who, anchor, t, t0, t1, dy = -250, dx = 0, minY = 360) {
  if (t < t0 || t > t1) return '';
  const pin = U.inv(t0, t0 + 0.18, t), a = Math.min(pin, 1 - U.inv(t1 - 0.16, t1, t));
  const fs = 44, lines = text.split('\n'), lh = fs * 1.35;
  const w = Math.max(...lines.map(l => tw(l, fs))) + 70, h = lines.length * lh + 36;
  let x = U.clamp(anchor[0] + dx, 40 + w / 2, SW - 40 - w / 2), y = Math.max(minY + h / 2, anchor[1] + dy);
  const c = COL[who];
  const tx = anchor[0] - x, ty = anchor[1] - y, bx = U.clamp(tx * 0.35, -w / 2 + 40, w / 2 - 40), by = ty > 0 ? h / 2 - 4 : -h / 2 + 4;
  let g = `<path d="M${U.f(bx - 20)},${U.f(by)} L${U.f(tx * 0.72)},${U.f(ty * 0.72)} L${U.f(bx + 20)},${U.f(by)} Z" fill="#fff" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`;
  g += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="32" fill="#fff" stroke="${c}" stroke-width="5"/><path d="M${U.f(bx - 15)},${U.f(by)} L${U.f(bx + 15)},${U.f(by)}" stroke="#fff" stroke-width="9"/>`;
  lines.forEach((l, i) => { g += `<text x="0" y="${U.f(-h / 2 + 18 + lh * (i + 0.5) + fs * 0.35)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#3D3456">${U.esc(l)}</text>`; });
  return `<g transform="translate(${U.f(x)} ${U.f(y)}) scale(${U.f((0.85 + 0.15 * U.ease.outBack(pin)) * 1000) / 1000})" opacity="${U.f(a * 100) / 100}">${g}</g>`;
}
// HUD panel with typed lines
function hudBox(x, y, w, title, lines, t, t0, t1, col = '#7FE3FF') {
  if (t < t0 || t > t1) return '';
  const a = Math.min(U.seg(t, t0, t0 + 0.3), 1 - U.inv(t1 - 0.3, t1, t));
  const h = 74 + lines.length * 52;
  let g = `<rect x="0" y="0" width="${w}" height="${h}" rx="10" fill="#0C1430" opacity=".78" stroke="${col}" stroke-width="3"/>`;
  g += `<path d="M0,22 L0,0 L22,0 M${w - 22},0 L${w},0 L${w},22 M0,${h - 22} L0,${h} L22,${h} M${w - 22},${h} L${w},${h} L${w},${h - 22}" fill="none" stroke="${col}" stroke-width="6"/>`;
  g += `<text x="24" y="50" font-size="34" font-weight="700" fill="${col}">${U.esc(title)}</text><path d="M24,64 L${w - 24},64" stroke="${col}" stroke-width="2" opacity=".6"/>`;
  lines.forEach((l, i) => {
    const shown = Math.floor(U.inv(t0 + 0.3 + i * 0.35, t0 + 0.75 + i * 0.35, t) * [...l].length);
    if (shown <= 0) return;
    g += `<text x="28" y="${110 + i * 52}" font-size="32" font-weight="500" fill="#E8F7FF">${U.esc([...l].slice(0, shown).join(''))}</text>`;
  });
  return `<g transform="translate(${x} ${y})" opacity="${U.f(a * 100) / 100}">${g}</g>`;
}
function radial(cx, cy, n, r0, r1, seed, col = '#fff', op = 0.9, wmax = 12) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = U.hash(seed + i) * Math.PI * 2, w = 3 + U.hash(seed + i * 3) * wmax, rr = r0 + U.hash(seed + i * 7) * 140;
    const x0 = cx + Math.cos(a) * rr, y0 = cy + Math.sin(a) * rr, x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1, nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
    s += `<path d="M${U.f(x0)},${U.f(y0)} L${U.f(x1 + nx)},${U.f(y1 + ny)} L${U.f(x1 - nx)},${U.f(y1 - ny)} Z" fill="${col}" opacity="${op}"/>`;
  }
  return s;
}
function hearts(t, t0, cx, cy, n, seed, spread = 160, dur = 1.6, size = 48) {
  const p = (t - t0) / dur; if (p < 0 || p > 1) return '';
  let s = '';
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (U.hash(seed + i) - 0.5) * 2.4, r = spread * (0.5 + U.hash(seed + i * 3) * 0.6) * U.ease.out(p); s += U.heart(cx + Math.cos(a) * r, cy + Math.sin(a) * r - p * 60, size * (0.6 + U.hash(seed + i * 5) * 0.6), ['#FF7FA6', '#FF9DBB', '#FFB8CF'][i % 3], 1 - U.inv(0.6, 1, p), Math.sin(i * 2 + t * 3) * 14); }
  return s;
}

// ------------------------------------------------------------------ lab background (scene space)
function lab(t, dark) {
  let s = `<rect x="-600" y="-200" width="2300" height="2400" fill="#E9EEF6"/>`;
  for (let x = -600; x < 1700; x += 120) s += `<path d="M${x},-200 L${x},1420" stroke="#D3DBE8" stroke-width="3"/>`;
  for (let y = -200; y < 1420; y += 120) s += `<path d="M-600,${y} L1700,${y}" stroke="#D3DBE8" stroke-width="3"/>`;
  // height ruler + sign
  s += `<g transform="translate(980 640)"><rect x="0" y="0" width="54" height="780" fill="#FFFFFF" stroke="#AEB8CC" stroke-width="3"/>`;
  for (let k = 0; k <= 26; k++) s += `<path d="M0,${k * 30} L${k % 5 === 0 ? 34 : 18},${k * 30}" stroke="#7F8BA6" stroke-width="3"/>`;
  s += `</g><rect x="80" y="700" width="330" height="90" rx="12" fill="#2E3A66"/><text x="245" y="760" text-anchor="middle" font-size="40" font-weight="700" fill="#FFFFFF" letter-spacing="4">TEST AREA 03</text>`;
  // floor
  s += `<rect x="-600" y="1420" width="2300" height="900" fill="#C9D2E2"/>`;
  for (let i = -14; i <= 14; i++) s += `<path d="M${540 + i * 80},1420 L${540 + i * 260},2300" stroke="#B5C0D4" stroke-width="3"/>`;
  for (let k = 0; k < 8; k++) { const y = 1420 + Math.pow(k / 7, 1.6) * 800; s += `<path d="M-600,${U.f(y)} L1700,${U.f(y)}" stroke="#B5C0D4" stroke-width="3"/>`; }
  // hazard stripe square under the target
  s += `<g transform="translate(${YX} ${FY + 10})"><path d="M-170,-30 L170,-30 L200,40 L-200,40 Z" fill="none" stroke="#F2C230" stroke-width="10" stroke-dasharray="26 18"/></g>`;
  // tripod cameras
  for (const [x, f] of [[60, 1], [1020, -1]]) s += `<g transform="translate(${x} 1500) scale(${f} 1)"><path d="M0,0 L-40,160 M0,0 L40,160 M0,0 L0,170" stroke="#5E6A86" stroke-width="7"/><rect x="-46" y="-70" width="92" height="66" rx="10" fill="#3E4A6A"/><circle cx="36" cy="-38" r="22" fill="#1E2640" stroke="#8E9AB8" stroke-width="5"/><circle cx="-28" cy="-58" r="6" fill="#FF4A4A" opacity="${Math.floor(t * 2) % 2 ? 1 : 0.3}"/></g>`;
  if (dark > 0) s += `<rect x="-600" y="-200" width="2300" height="2600" fill="#1A0F33" opacity="${U.f(dark * 70) / 100}"/>`;
  return s;
}
function tentacles(t, base, tips, a) {
  if (a <= 0) return '';
  let s = `<g opacity="${U.f(a * 100) / 100}">`;
  tips.forEach((tip, i) => {
    const [bx, by] = [base[0] + (i - 1.5) * 60, base[1]];
    const w1 = Math.sin(t * 3 + i) * 50, w2 = Math.cos(t * 2.4 + i * 2) * 60;
    const d = `M${bx},${by} C${U.f(bx + w1)},${U.f(by - 300)} ${U.f(tip[0] + w2)},${U.f(tip[1] + 180)} ${U.f(tip[0])},${U.f(tip[1])}`;
    s += `<path d="${d}" fill="none" stroke="#2A1D45" stroke-width="40" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#5B3E8E" stroke-width="24" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#9C7BD6" stroke-width="6" stroke-linecap="round" opacity=".7"/>`;
    s += `<circle cx="${U.f(tip[0])}" cy="${U.f(tip[1])}" r="14" fill="#9C7BD6" opacity=".8"/>`;
  });
  return s + `</g>`;
}

// ------------------------------------------------------------------ characters
function attacker(t) {
  // phases
  let x = AX, armL = 160, armR = 160, stL = 1, lean = 0, bob = 0, eyes = 'open', mouth = 'grin', brows = 'angry', look = [-0.7, 0], rot = 0, sweat = false, tear = false;
  if (t < 11) { const j = (t * 1.3) % 1; armL = j < 0.25 ? U.lerp(160, 96, Math.sin(j / 0.25 * Math.PI)) : 160; stL = j < 0.25 ? 1 + 0.15 * Math.sin(j / 0.25 * Math.PI) : 1; bob = -Math.abs(Math.sin(t * 6)) * 10; }
  else if (t < 12.6) { armL = U.lerp(160, 214, U.seg(t, 11, 12.6)); lean = -6 * U.seg(t, 11, 12.6); mouth = 'flat'; }
  else if (t < 16.5) { const p = U.ease.in(U.inv(12.6, 16.5, t)); armL = U.lerp(214, 72, p); stL = U.lerp(1, 1.42, p); lean = U.lerp(-6, 10, p); x = U.lerp(AX, AX + 28, p); mouth = 'grin'; }
  else if (t < 20.5) { armL = 72; stL = 1.42; lean = 10; x = AX + 28; mouth = 'grin'; }
  else if (t < 21.6) { armL = 72; stL = 1.42; lean = 10; x = AX + 28 + Math.sin(t * 80) * 3; eyes = 'wide'; mouth = 'o'; }
  else if (t < 27) { const p = U.seg(t, 21.6, 22.4, 'out'); x = U.lerp(AX + 28, 420, p); armL = -40; armR = -30; stL = 1; eyes = 'shut'; mouth = 'open'; tear = true; bob = -Math.abs(Math.sin(t * 9)) * 26; brows = 'worry'; }
  else if (t < 40.4) { x = 420; armL = -40; armR = -30; eyes = 'wide'; mouth = 'wavy'; brows = 'worry'; sweat = true; look = t > 28.4 ? [0.6, -0.5] : [0, 0]; }
  else { x = 420; armL = 40; armR = 40; eyes = 'swirl'; mouth = 'wavy'; brows = 'worry'; rot = -84 * U.seg(t, 40.4, 41.1, 'in'); }
  const o = { x: 0, y: 0, s: SC, t, blinkSeed: 401, outfit: 'tank', gloves: true, headband: true, age: 28, armL, armR, stretchL: stL, lean, bob, eyes, mouth, brows, look: [-look[0], look[1]], turn: -0.3, sweat, tear, noShadow: rot !== 0 };
  return `<g transform="translate(${U.f(x)} ${FY}) rotate(${U.f(rot)} 0 ${-170 * SC}) scale(-1 1)">${charSVG('man', o)}</g>`;
}
function yuria(t) {
  const impact = t > 16.5 ? Math.exp(-(t - 16.5) * 2.5) : 0;
  const sway = Math.sin(t * 30) * 22 * impact + Math.sin(t * 1.8) * 3;
  let look = [0.25, 0.7], eyes = 'open', mouth = 'smile', brows = 'neutral', armR = -24, armL = 10, item = 'phone', blush = 0.25, sweat = false;
  if (t > 6.2 && t < 8.6) { look = [-0.7, 0]; mouth = U.hash(Math.floor(t * 9)) > 0.45 ? 'open' : 'grin'; }
  if (t > 23.6 && t < 27) { look = [-0.7, 0.1]; brows = 'up'; mouth = t > 24 && t < 26.6 && U.hash(Math.floor(t * 9)) > 0.5 ? 'o' : 'small'; }
  if (t > 27 && t < 36.8) { look = [-0.9, -0.3]; mouth = 'wavy'; sweat = true; }
  if (t > 36.8 && t < 39.8) { look = [-0.9, -0.2]; armL = 96; mouth = U.hash(Math.floor(t * 9)) > 0.45 ? 'open' : 'smile'; brows = 'soft'; item = null; armR = 10; }
  if (t > 39.8) { look = [-0.6, 0]; mouth = 'grin'; item = null; armR = 10; blush = 0.45; }
  if (t > 47.6) { look = [0, 0]; eyes = 'wink'; mouth = t < 51.4 && U.hash(Math.floor(t * 9)) > 0.5 ? 'open' : 'grin'; armR = 150; }
  return charSVG('yuria', { x: YX, y: FY, s: SC, t, blinkSeed: 402, look, eyes, winkSide: 1, mouth, brows, armR, armL, itemR: item, blush, sweat, sway, turn: t > 47.6 ? 0 : -0.3 });
}
function vol(t) {
  if (t < 27) return '';
  const rise = U.seg(t, 27, 28.4, 'out');
  const calm = U.seg(t, 39.6, 40.4);
  const go = U.seg(t, 41.4, 42.4);
  const x = U.lerp(230, 610, go), y = U.lerp(U.lerp(2050, 1480, rise), FY, go), s = U.lerp(1.55, SC, go);
  const angry = 1 - calm;
  let out = '';
  if (angry > 0) out += `<ellipse cx="${x}" cy="${U.f(y - 520)}" rx="${U.f(260 + Math.sin(t * 5) * 14)}" ry="420" fill="#6B3FB0" opacity="${U.f(angry * rise * 45) / 100}" filter="url(#fBlur20)"/>`;
  out += `<g opacity="${U.f(rise * 100) / 100}">` + charSVG('vol', {
    x, y, s, t, blinkSeed: 403, look: [0.6, 0.1], turn: 0.3, hiddenEye: angry, eyes: angry > 0.5 ? 'half' : t > 40.6 && t < 43 ? 'half' : 'smile',
    mouth: t > 28.6 && t < 31.6 ? (U.hash(Math.floor(t * 9)) > 0.5 ? 'o' : 'smile') : t > 40.6 && t < 43 && U.hash(Math.floor(t * 9)) > 0.5 ? 'open' : 'smile',
    brows: angry > 0.5 ? 'angry' : 'soft', blush: angry > 0.5 ? 0 : 0.85, walk: go > 0 && go < 1 ? t * 2 : null, lean: go >= 1 ? 7 : 0, armR: go >= 1 ? 66 : null,
  }) + `</g>`;
  return out;
}

// ------------------------------------------------------------------ camera
function camAt(t) {
  if (t < 11) return cam(560, 1250, 1.0);
  if (t < 16.5) { const p = U.seg(t, 11, 16.5, 'inOut'); return cam(U.lerp(560, 660, p), U.lerp(1250, 1320, p), U.lerp(1.0, 1.6, p)); }
  if (t < 20.5) { const sh = t < 17.3 ? Math.sin(t * 95) * 14 * (1 - U.inv(16.5, 17.3, t)) : 0; return cam(660 + sh, 1320 + sh * 0.6, 1.75); }
  if (t < 27) { const p = U.seg(t, 20.5, 21.8); return cam(U.lerp(660, 580, p), U.lerp(1320, 1280, p), U.lerp(1.75, 1.12, p)); }
  if (t < 36.5) { const p = U.seg(t, 27, 30); const sh = t > 27 && t < 28.4 ? Math.sin(t * 60) * 5 : 0; return cam(U.lerp(580, 520, p) + sh, U.lerp(1280, 1230, p), U.lerp(1.12, 1.02, p)); }
  if (t < 44.5) return cam(U.lerp(520, 600, U.seg(t, 36.5, 38)), 1250, 1.08);
  return cam(600, 1260, 1.04);
}

// ------------------------------------------------------------------ frame
window.renderFrame = function (t) {
  U.resetUid();
  let out = `<defs>${B.defs}</defs>`;
  if (t < 3.6) {
    // title card
    let s = `<rect width="${SW}" height="${SH}" fill="#0B1230"/>`;
    for (let x = 0; x < SW; x += 60) s += `<path d="M${x},0 L${x},${SH}" stroke="#1C2A5A" stroke-width="2"/>`;
    for (let y = 0; y < SH; y += 60) s += `<path d="M0,${y} L${SW},${y}" stroke="#1C2A5A" stroke-width="2"/>`;
    const scan = (t * 700) % SH;
    s += `<rect x="0" y="${U.f(scan)}" width="${SW}" height="80" fill="#7FE3FF" opacity=".08"/>`;
    const a = U.seg(t, 0.2, 0.7), a2 = U.seg(t, 0.8, 1.3);
    s += `<g opacity="${U.f(a * 100) / 100}"><text x="540" y="700" text-anchor="middle" font-size="44" font-weight="700" fill="#7FE3FF" letter-spacing="14">SIMULATION 01</text><path d="M240,740 L840,740" stroke="#7FE3FF" stroke-width="3"/></g>`;
    s += `<g opacity="${U.f(a2 * 100) / 100}"><text x="540" y="880" text-anchor="middle" font-size="72" font-weight="700" fill="#FFFFFF">ユリアのお腹に</text><text x="540" y="990" text-anchor="middle" font-size="72" font-weight="700" fill="#FFFFFF">右ストレートを</text><text x="540" y="1100" text-anchor="middle" font-size="72" font-weight="700" fill="#FFD36B">打ち込んだら？</text></g>`;
    if (t > 3.1) s += `<rect width="${SW}" height="${SH}" fill="#FFFFFF" opacity="${U.f(U.inv(3.1, 3.6, t) * 100) / 100}"/>`;
    document.getElementById('content').innerHTML = out + s;
    return;
  }
  const c = camAt(t);
  const dark = U.seg(t, 27, 27.8) * (1 - U.seg(t, 39.6, 40.6));
  const slow = t > 11 && t < 16.5;
  // ---- scene (camera space)
  let sc = lab(t, dark);
  sc += vol(t).includes('<g') && t < 41.4 ? vol(t) : '';
  if (t >= 27 && t < 41.4) sc += tentacles(t, [230, 1470], [[400, 1300], [470, 1230], [340, 1190], [500, 1420]].map(([x, y], i) => { const k = U.seg(t, 32.6, 34.4); return [U.lerp(180 + i * 40, x, k), U.lerp(1560, y, k)]; }), U.seg(t, 28.0, 29.0) * (1 - U.seg(t, 39.6, 40.2)));
  sc += yuria(t);
  sc += attacker(t);
  if (t >= 41.4) sc += vol(t);
  sc += hearts(t, 42.5, 660, 1080, 9, 11, 200);
  sc += hearts(t, 49.0, 740, 1060, 6, 23, 160);
  let s = `<g transform="translate(540 960) scale(${U.f(c.z * 1000) / 1000}) translate(${U.f(-c.x)} ${U.f(-c.y)})">${sc}</g>`;
  // ---- screen-space effects
  const hit = toS(HIT, c);
  if (slow) s += `<rect width="${SW}" height="${SH}" fill="url(#gVignette)" opacity=".9"/><rect width="${SW}" height="${SH}" fill="#20305A" opacity=".12"/>`;
  if (t > 12.6 && t < 16.5) s += radial(hit[0] - 200, hit[1], 18, 260, 900, 7, '#FFFFFF', 0.35, 6);
  if (t >= 16.5 && t < 18.2) {
    const p = U.inv(16.5, 18.2, t);
    s += radial(hit[0], hit[1], 34, 90 + p * 60, 1400, 31, '#FFFFFF', 0.95 * (1 - p), 16);
    for (let k = 0; k < 3; k++) { const q = U.inv(16.5 + k * 0.12, 17.3 + k * 0.12, t); if (q > 0 && q < 1) s += `<ellipse cx="${U.f(hit[0])}" cy="${U.f(hit[1])}" rx="${U.f(40 + q * 420)}" ry="${U.f(30 + q * 300)}" fill="none" stroke="#FFFFFF" stroke-width="${U.f(16 * (1 - q) + 2)}" opacity="${U.f((1 - q) * 90) / 100}"/>`; }
    const sh = Math.sin(t * 70) * 8 * (1 - p);
    s += `<g transform="translate(${U.f(hit[0] - 330 + sh)} ${U.f(hit[1] - 300)}) rotate(-10) scale(${U.f((0.8 + 0.25 * U.ease.outBack(U.inv(16.5, 16.75, t))) * 100) / 100})" opacity="${U.f(Math.min(1, (1 - p) * 2) * 100) / 100}"><text x="0" y="0" font-size="170" font-weight="900" fill="#FFE04A" stroke="#2A1D10" stroke-width="16" paint-order="stroke">ドンッ!!</text></g>`;
  }
  if (t >= 16.5 && t < 16.8) s += `<rect width="${SW}" height="${SH}" fill="#FFFFFF" opacity="${U.f((1 - U.inv(16.5, 16.8, t)) * 100) / 100}"/>`;
  if (t > 20.5 && t < 21.6) { const p = toS([AX + 120, FY - 330 * SC], c); s += `<g transform="translate(${U.f(p[0] - 150 + Math.sin(t * 60) * 4)} ${U.f(p[1] - 110)})"><text x="0" y="0" font-size="70" font-weight="900" fill="#7FE3FF" stroke="#0C1430" stroke-width="10" paint-order="stroke">ジーン…</text></g>`; }
  if (t > 28.6 && t < 40.4) { const p = toS([420, FY - 452 * SC], c); for (let k = 0; k < 5; k++) s += `<path d="M${U.f(p[0] - 70 + k * 34)},${U.f(p[1] - 110)} l0,90" stroke="#5B6FD6" stroke-width="5" opacity=".7"/>`; }
  if (slow) s += `<g transform="translate(760 1630)"><rect x="0" y="-48" width="280" height="64" rx="10" fill="#0C1430" opacity=".8"/><text x="140" y="-4" text-anchor="middle" font-size="36" font-weight="700" fill="#7FE3FF">SLOW ×0.1</text></g>`;
  // crosshair on the stomach
  if (t > 8.6 && t < 16.4) { const a = U.seg(t, 8.6, 9.0) * (1 - U.inv(16.0, 16.4, t)); const r = 70 + Math.sin(t * 6) * 6; s += `<g transform="translate(${U.f(hit[0])} ${U.f(hit[1])})" opacity="${U.f(a * 100) / 100}"><circle r="${U.f(r)}" fill="none" stroke="#FF4A5A" stroke-width="5"/><path d="M-${U.f(r + 30)},0 L-${U.f(r - 20)},0 M${U.f(r - 20)},0 L${U.f(r + 30)},0 M0,-${U.f(r + 30)} L0,-${U.f(r - 20)} M0,${U.f(r - 20)} L0,${U.f(r + 30)}" stroke="#FF4A5A" stroke-width="5"/><text x="${U.f(r + 20)}" y="-${U.f(r)}" font-size="30" font-weight="700" fill="#FF4A5A">目標：腹部</text></g>`; }
  // ---- HUD
  s += `<g><rect x="30" y="40" width="190" height="56" rx="8" fill="#0C1430" opacity=".7"/><circle cx="64" cy="68" r="12" fill="#FF4A4A" opacity="${Math.floor(t * 2) % 2 ? 1 : 0.35}"/><text x="88" y="80" font-size="32" font-weight="700" fill="#FFFFFF">REC</text>
    <text x="1050" y="80" text-anchor="end" font-size="30" font-weight="700" fill="#2E3A66">${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t % 1) * 100)).padStart(2, '0')}</text></g>`;
  s += hudBox(30, 130, 500, '被験者A', ['成人男性／ボクシング歴8年', '体重 78kg', '拳速 11.2 m/s', '衝撃力 約4,000N'], t, 3.8, 16.3);
  s += hudBox(550, 130, 500, '対象：ユリア', ['外神竜（長女）', '状態：スマホ中', '防御姿勢：なし', '回避の意思：なし'], t, 5.4, 16.3, '#FFD36B');
  if (t > 12.6 && t < 16.5) { const p = U.ease.in(U.inv(12.6, 16.5, t)); s += `<g transform="translate(130 1700)"><rect x="-20" y="-64" width="860" height="124" rx="16" fill="#0C1430" opacity=".75"/><rect x="0" y="0" width="820" height="40" rx="20" fill="#0C1430" opacity=".75" stroke="#7FE3FF" stroke-width="3"/><rect x="6" y="6" width="${U.f(808 * p)}" height="28" rx="14" fill="#FF6A5A"/><text x="410" y="-14" text-anchor="middle" font-size="32" font-weight="700" fill="#E8F7FF">衝撃力 ${Math.round(4000 * p).toLocaleString()} N</text></g>`; }
  s += hudBox(140, 150, 800, '計測結果', ['腹部の変位：0.0 mm', '体幹のブレ：0.0°', 'ダメージ：0'], t, 17.2, 20.6);
  if (t > 18.6 && t < 20.6) { const a = U.seg(t, 18.6, 18.9, 'outBack'); s += `<g transform="translate(800 290) rotate(-14) scale(${U.f(a * 100) / 100})" opacity="${U.f(Math.min(1, a) * 90) / 100}"><rect x="-120" y="-62" width="240" height="124" rx="14" fill="none" stroke="#FF4A5A" stroke-width="10"/><text x="0" y="28" text-anchor="middle" font-size="84" font-weight="900" fill="#FF4A5A">無効</text></g>`; }
  s += hudBox(140, 150, 800, '被験者A', ['右拳に激痛（反作用）', '原因：ユリアが硬すぎる'], t, 22.0, 26.9, '#FF8A94');
  if (t > 27.6 && t < 39.8) {
    const fl = Math.floor(t * 3) % 2 ? 1 : 0.65;
    s += `<g opacity="${U.f(U.seg(t, 27.6, 28.0) * (1 - U.inv(39.4, 39.8, t)) * fl * 100) / 100}"><rect x="0" y="150" width="${SW}" height="150" fill="#B0202E" opacity=".85"/>`;
    for (let x = -60; x < SW; x += 60) s += `<path d="M${x},150 l30,0 l-40,40 l-30,0 Z M${x},300 l30,0 l-40,-40 l-30,0 Z" fill="#FFD36B"/>`;
    s += `<text x="540" y="226" text-anchor="middle" font-size="50" font-weight="900" fill="#FFFFFF" letter-spacing="10">WARNING</text><text x="540" y="278" text-anchor="middle" font-size="32" font-weight="700" fill="#FFFFFF">ヴォル（次女）接近／危険度：測定不能</text></g>`;
  }
  s += hudBox(140, 150, 800, '被験者A', ['気絶（外傷なし）'], t, 41.2, 44.4, '#7FE3FF');
  // ---- speech
  const yHead = toS([YX - 20, FY - 452 * SC + 60], c), aHead = toS([t < 21.6 ? AX + 28 : 420, FY - 452 * SC + 60], c), vHead = toS([230, 1480 - 452 * 1.55 + 60], c);
  s += bubble('え、お腹？　いーよ。\nよゆーよゆー♪', 'yuria', yHead, t, 6.2, 8.6, -330, 90, 440);
  s += bubble('いっ……てぇぇ！！', 'man', aHead, t, 21.8, 23.6, -320, -60);
  s += bubble('……ん？　今、なんかした？', 'yuria', yHead, t, 24.0, 26.6, -320, 60);
  s += bubble('――私のゆり姉に、\n何をしているのかしら', 'vol', vHead, t, 28.6, 31.6, -280, 120);
  s += bubble('ひっ……', 'man', aHead, t, 31.8, 33.0, -40, 300);
  s += bubble('ヴォル、ストップ。\nあーし、なんともないって', 'yuria', yHead, t, 36.8, 39.6, -330, 80);
  s += bubble('……ゆり姉が、そう言うなら♡', 'vol', t < 41.4 ? vHead : toS([610, FY - 452 * SC + 60], c), t, 40.6, 43.0, -300);
  s += bubble('てか、人のお腹は\n殴っちゃダメだかんね？', 'yuria', yHead, t, 48.0, 51.6, -340, 40);
  // ---- result card
  if (t > 44.6) {
    const a = U.seg(t, 44.6, 45.2, 'out') * (t < 47.4 ? 1 : 1 - 0.35 * U.seg(t, 47.4, 47.8));
    s += `<g opacity="${U.f(a * 100) / 100}" transform="translate(0 ${U.f((1 - U.seg(t, 44.6, 45.2, 'outBack')) * 60)})"><rect x="90" y="140" width="900" height="420" rx="24" fill="#0C1430" opacity=".86" stroke="#7FE3FF" stroke-width="4"/>
      <text x="540" y="222" text-anchor="middle" font-size="52" font-weight="900" fill="#7FE3FF" letter-spacing="4">シミュレーション結果</text><path d="M150,250 L930,250" stroke="#7FE3FF" stroke-width="2"/>`;
    const rows = [['ユリアへのダメージ', '0'], ['被験者の拳', '激痛'], ['いちばん危なかったもの', 'ヴォル']];
    rows.forEach(([k, v], i) => { const ra = U.seg(t, 45.2 + i * 0.5, 45.5 + i * 0.5); s += `<g opacity="${U.f(ra * 100) / 100}"><text x="150" y="${330 + i * 76}" font-size="40" font-weight="700" fill="#E8F7FF">${k}</text><text x="930" y="${330 + i * 76}" text-anchor="end" font-size="44" font-weight="900" fill="${i === 2 ? '#C9A8FF' : '#FFD36B'}">${v}</text></g>`; });
    s += `</g>`;
  }
  if (t < 3.9) s += `<rect width="${SW}" height="${SH}" fill="#FFFFFF" opacity="${U.f((1 - U.inv(3.6, 3.9, t)) * 100) / 100}"/>`;
  if (t > DURATION - 0.8) s += `<rect width="${SW}" height="${SH}" fill="#FFFFFF" opacity="${U.f(U.inv(DURATION - 0.8, DURATION, t) * 100) / 100}"/>`;
  document.getElementById('content').innerHTML = out + s;
};
window.DURATION = DURATION;
window.SCENES = [
  { id: 'title', start: 0, dur: 3.6 }, { id: 'setup', start: 3.6, dur: 7.4 }, { id: 'slow', start: 11, dur: 5.5 }, { id: 'impact', start: 16.5, dur: 4 },
  { id: 'recoil', start: 20.5, dur: 6.5 }, { id: 'vol', start: 27, dur: 9.5 }, { id: 'stop', start: 36.5, dur: 8 }, { id: 'result', start: 44.5, dur: 7.5 },
];
window.ALL_TEXT = 'SIMULATION01ユリアのお腹に右ストレートを打ち込んだら？TESTAREA03目標：腹部REC被験者A成人男性／ボクシング歴8年体重78kg拳速11.2m/s衝撃力約4,000N対象：ユリア外神竜（長女）状態：スマホ中防御姿勢：なし回避の意思：なし計測結果腹部の変位：0.0mm体幹のブレ：0.0°ダメージ：0無効右拳に激痛（反作用）原因：ユリアが硬すぎるWARNINGヴォル（次女）接近／危険度：測定不能気絶（外傷なし）え、お腹？いーよ。よゆーよゆー♪いっ……てぇぇ！！……ん？今、なんかした？――私のゆり姉に、何をしているのかしらひっ……ヴォル、ストップ。あーし、なんともないって……ゆり姉が、そう言うなら♡てか、人のお腹は殴っちゃダメだかんね？シミュレーション結果ユリアへのダメージ0被験者の拳激痛いちばん危なかったものヴォルドンッ!!ジーン…SLOW×0.1N0123456789.:°';
