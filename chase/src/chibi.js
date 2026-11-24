// chibi.js — ユリアとヴォルのデフォルメ画（正面向き・2 頭身）。細い線、淡い影、白い髪。
//   座標は頭の中心が原点、頭の半径が 1（あごが y ≒ 0.93、足もとが y ≒ 3.2）。
//   髪は「束」（根もと → 先のとがった曲面）を重ねて描く。束ごとに揺らせるので、走ると髪がなびく。
const TAU = Math.PI * 2;
export const LINE = '#6b4f5e';
const HAIR = '#ffffff', HAIR_SH = '#e7e2f4', SKIN = '#fff1ea', SKIN_SH = '#fbdad5', BLUSH = '#f8a3b0';
const YEL = '#ffd161', YEL_SH = '#f4b84a';
const lerp = (a, b, k) => a + (b - a) * k;

// ---- 基本
export const STYLE = { lw: 1 };          // 小さく描くときは線を太らせる
function S(c, lw = 0.026, col = LINE) { c.strokeStyle = col; c.lineWidth = lw * STYLE.lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
function F(c, col) { c.fillStyle = col; c.fill(); }
function FS(c, col, lw = 0.026, line = LINE) { F(c, col); S(c, lw, line); }
// 髪の束。b1, b2: 根もと寄り・先寄りの曲がり（進む向きの左が +）。fill が配列なら [根もとの色, 先の色, 切り替え位置]。
// 輪郭は両わきだけに引く（根もとは頭の白い面に溶け込む）。strand: 束の中に細い筋を 1 本入れる
function lock(c, x0, y0, x1, y1, w, b1 = 0, b2 = 0, fill = HAIR, lw = 0.024, strand = 0) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const p1x = x0 + dx * 0.36 + nx * b1 * L, p1y = y0 + dy * 0.36 + ny * b1 * L, p2x = x0 + dx * 0.74 + nx * b2 * L, p2y = y0 + dy * 0.74 + ny * b2 * L;
  const h = w / 2;
  const path = (close) => { c.beginPath(); c.moveTo(x0 + nx * h, y0 + ny * h);
    c.bezierCurveTo(p1x + nx * h * 1.08, p1y + ny * h * 1.08, p2x + nx * h * 0.66, p2y + ny * h * 0.66, x1, y1);
    c.bezierCurveTo(p2x - nx * h * 0.66, p2y - ny * h * 0.66, p1x - nx * h * 1.08, p1y - ny * h * 1.08, x0 - nx * h, y0 - ny * h); if (close) c.closePath(); };
  path(true);
  if (Array.isArray(fill)) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, fill[0]); g.addColorStop(fill[2] ?? 0.45, fill[0]); g.addColorStop(1, fill[1]); c.fillStyle = g; c.fill(); } else F(c, fill);
  if (lw > 0) { path(false); S(c, lw); }
  if (strand) { c.beginPath(); c.moveTo(x0 + nx * h * strand, y0 + ny * h * strand); c.bezierCurveTo(p1x + nx * h * strand, p1y + ny * h * strand, p2x + nx * h * strand * 0.5, p2y + ny * h * strand * 0.5, lerp(p2x, x1, 0.6), lerp(p2y, y1, 0.6)); S(c, 0.014, '#cfc4dc'); }
}
// 頭のてっぺんの髪（白い面）。外側の弧にだけ線を引く
function cap(c, col = HAIR) {
  c.beginPath(); c.moveTo(-1.0, -0.2); c.bezierCurveTo(-1.04, -0.9, -0.52, -1.22, 0, -1.22); c.bezierCurveTo(0.52, -1.22, 1.04, -0.9, 1.0, -0.2); c.bezierCurveTo(0.6, -0.55, -0.6, -0.55, -1.0, -0.2); c.closePath(); F(c, col);
  c.beginPath(); c.moveTo(-1.0, -0.2); c.bezierCurveTo(-1.04, -0.9, -0.52, -1.22, 0, -1.22); c.bezierCurveTo(0.52, -1.22, 1.04, -0.9, 1.0, -0.2); S(c, 0.026);
}
// いくつかの形を、ひとつながりの輪郭で描く（先に全部の縁を引き、あとから全部を塗る）
function group(c, fill, parts, lw = 0.026) {
  for (const p of parts) { c.beginPath(); p(); c.strokeStyle = LINE; c.lineWidth = lw * 2 * STYLE.lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
  for (const p of parts) { c.beginPath(); p(); c.fillStyle = fill; c.fill(); }
}
const capsule = (c, ax, ay, bx, by, ra, rb) => () => {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, a0 = Math.atan2(ny, nx);
  c.moveTo(ax + nx * ra, ay + ny * ra); c.arc(ax, ay, ra, a0, a0 + Math.PI); c.lineTo(bx - nx * rb, by - ny * rb); c.arc(bx, by, rb, a0 + Math.PI, a0 + TAU); c.closePath();
};
function heart(c, x, y, r, col, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(r, r); c.beginPath(); c.moveTo(0, 0.9); c.bezierCurveTo(-1.5, -0.2, -0.7, -1.2, 0, -0.45); c.bezierCurveTo(0.7, -1.2, 1.5, -0.2, 0, 0.9); c.closePath(); c.fillStyle = col; c.fill(); c.restore();
}
export { heart };

// ---- 目。o.mode: 'open' | 'wide'（白目に点。びっくり）| 'cross'（＞＜）| 'happy'（∩）| 'melt'（とろん）| 'dead'（光のない目）| 'heart' | 'shut'
//   lid: 0〜0.6（まぶたの下がりぐあい）。lash: 'dark' | 'white'。col: [上, 中, 下]
function eye(c, side, o) {
  const x = 0.43 * side + (o.lookX || 0) * 0.02, y = 0.21, mode = o.mode || 'open';
  c.save(); c.translate(x, y); c.scale(side, 1);          // 目尻が +x
  c.lineCap = 'round'; c.lineJoin = 'round';
  const W = 0.25, Hh = 0.27;
  if (mode === 'cross') {
    c.beginPath(); c.moveTo(0.2, -0.17); c.lineTo(-0.16, 0); c.lineTo(0.2, 0.17); S(c, 0.055);
  } else if (mode === 'happy') {
    c.beginPath(); c.moveTo(-0.22, 0.07); c.quadraticCurveTo(0, -0.2, 0.23, 0.07); S(c, 0.055);
  } else if (mode === 'shut') {
    c.beginPath(); c.moveTo(-0.22, -0.01); c.quadraticCurveTo(0, 0.14, 0.23, -0.02); S(c, 0.05);
    for (const k of [0.55, 0.9]) { c.beginPath(); c.moveTo(0.23 * k, 0.05); c.lineTo(0.23 * k + 0.05, 0.12); S(c, 0.024); }
  } else if (mode === 'wide') {
    c.beginPath(); c.ellipse(0, 0, 0.23, 0.25, 0, 0, TAU); FS(c, '#fff', 0.04);
    c.beginPath(); c.arc((o.lookX || 0) * 0.06, (o.lookY || 0) * 0.06, o.dot || 0.045, 0, TAU); F(c, LINE);
  } else {
    const lid = mode === 'melt' ? 0.5 : (o.lid || 0), top = -Hh + lid * Hh * 2;
    // 白目と瞳（まぶたの線より下だけ見える）
    c.save(); c.beginPath(); c.moveTo(-W * 1.1, top + 0.07); c.quadraticCurveTo(0, top - 0.09 * (1 - lid), W * 1.12, top + 0.03); c.lineTo(W * 1.2, Hh * 1.3); c.lineTo(-W * 1.2, Hh * 1.3); c.closePath(); c.clip();
    c.beginPath(); c.ellipse(0, 0.0, W * 1.02, Hh * 1.02, 0, 0, TAU); F(c, '#ffffff');
    const col = o.col, ix = (o.lookX || 0) * 0.035, iy = 0.015 + (o.lookY || 0) * 0.03 + (mode === 'melt' ? 0.03 : 0);
    const g = c.createLinearGradient(0, -Hh, 0, Hh); g.addColorStop(0, col[0]); g.addColorStop(0.5, col[1]); g.addColorStop(1, col[2]);
    c.beginPath(); c.ellipse(ix, iy, W * 0.8, Hh * 0.97, 0, 0, TAU); c.fillStyle = mode === 'dead' ? col[3] || col[0] : g; c.fill(); S(c, 0.02, col[0]);
    if (mode === 'heart' || mode === 'melt') heart(c, ix, iy + 0.02, 0.105, '#ff7fa0');
    else { c.beginPath(); c.ellipse(ix, iy + 0.02, W * 0.3, Hh * 0.42, 0, 0, TAU); F(c, mode === 'dead' ? 'rgba(40,40,70,.75)' : col[4] || 'rgba(70,90,130,.75)'); }
    c.fillStyle = 'rgba(70,60,100,.22)'; c.fillRect(-W * 1.2, top - 0.1, W * 2.4, 0.2);                                   // まぶたの影
    if (mode !== 'dead') { c.beginPath(); c.ellipse(ix - W * 0.34, iy - Hh * 0.36, W * 0.24, Hh * 0.22, -0.3, 0, TAU); F(c, '#fff'); c.beginPath(); c.arc(ix + W * 0.3, iy + Hh * 0.48, W * 0.11, 0, TAU); F(c, '#fff'); }
    c.restore();
    // まつげ
    const white = o.lash === 'white';
    c.beginPath(); c.moveTo(-W * 1.1, top + 0.08); c.quadraticCurveTo(-W * 0.1, top - 0.1 * (1 - lid), W * 1.1, top + 0.035);
    if (white) { S(c, 0.085, LINE); S(c, 0.05, '#ffffff'); } else S(c, 0.07);
    const spikes = white ? [[1.05, 0.02, 0.2, -0.11], [0.8, -0.03, 0.13, -0.15], [0.5, -0.07, 0.07, -0.15], [-0.95, 0.06, -0.14, -0.08]] : [[1.08, 0.03, 0.17, -0.1], [0.86, -0.02, 0.09, -0.12]];
    for (const [k, dy, ex, ey] of spikes) {
      c.beginPath(); c.moveTo(W * k - 0.045, top + dy + 0.02); c.lineTo(W * k + ex, top + dy + ey); c.lineTo(W * k + 0.05, top + dy + 0.03); c.closePath();
      if (white) FS(c, '#fff', 0.018); else F(c, LINE);
    }
    c.beginPath(); c.moveTo(-W * 0.55, Hh * 1.0); c.quadraticCurveTo(W * 0.2, Hh * 1.1, W * 0.8, Hh * 0.86); S(c, 0.018, white ? '#b9a9bd' : LINE);
  }
  c.restore();
}
function brow(c, side, o = {}) {
  c.save(); c.translate(0.43 * side, -0.2 + (o.dy || 0)); c.scale(side, 1); c.rotate(o.tilt || 0);
  c.beginPath(); c.moveTo(-0.15, 0.02); c.quadraticCurveTo(0.02, -0.04, 0.19, 0.0); S(c, 0.03, o.col || '#c5b8cc'); c.restore();
}
// 口。'smile' | 'open' | 'tongue'（てへ）| 'teeth'（にこっ）| 'wavy'（あわあわ）| 'scream' | 'small' | 'cat' | 'drool'（とろん）| 'kiss' | 'flat'
function mouth(c, o = {}) {
  const k = o.kind || 'smile', y = 0.6 + (o.dy || 0), w = o.w || 0.15;
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (k === 'open' || k === 'tongue' || k === 'scream') {
    const h = k === 'scream' ? 0.3 : (o.h || 0.17), ww = k === 'scream' ? w * 1.25 : w;
    c.beginPath(); c.moveTo(-ww, y); c.quadraticCurveTo(0, y + 0.04, ww, y); c.bezierCurveTo(ww * 0.9, y + h * 1.25, -ww * 0.9, y + h * 1.25, -ww, y); c.closePath(); FS(c, '#c2596b', 0.026);
    c.save(); c.clip(); c.beginPath(); c.ellipse(0, y + h * (k === 'tongue' ? 0.86 : 0.98), ww * 0.62, h * 0.42, 0, 0, TAU); F(c, '#ff9fae'); c.restore();
    if (k === 'tongue') { c.beginPath(); c.moveTo(-ww * 0.5, y + h * 0.62); c.bezierCurveTo(-ww * 0.5, y + h * 1.5, ww * 0.5, y + h * 1.5, ww * 0.5, y + h * 0.62); c.closePath(); FS(c, '#ff9fae', 0.022); c.beginPath(); c.moveTo(0, y + h * 0.72); c.lineTo(0, y + h * 1.1); S(c, 0.014, '#e0788c'); }
    if (o.fang) { c.beginPath(); c.moveTo(ww * 0.36, y + 0.012); c.lineTo(ww * 0.74, y + 0.006); c.lineTo(ww * 0.56, y + 0.09); c.closePath(); FS(c, '#fff', 0.014); }
  } else if (k === 'teeth') {
    c.beginPath(); c.moveTo(-w, y - 0.01); c.quadraticCurveTo(0, y + 0.03, w, y - 0.01); c.quadraticCurveTo(0, y + 0.19, -w, y - 0.01); c.closePath(); FS(c, '#ffffff', 0.026);
  } else if (k === 'wavy') {
    c.beginPath(); c.moveTo(-w, y + 0.04); for (let i = 0; i < 4; i++) c.quadraticCurveTo(-w + (i + 0.5) * w / 2, y + (i % 2 ? 0.11 : -0.03), -w + (i + 1) * w / 2, y + 0.04); c.lineTo(w, y + 0.13); c.quadraticCurveTo(0, y + 0.2, -w, y + 0.13); c.closePath(); FS(c, '#c2596b', 0.024);
  } else if (k === 'cat') {
    c.beginPath(); c.moveTo(-w, y); c.quadraticCurveTo(-w * 0.5, y + 0.1, 0, y + 0.01); c.quadraticCurveTo(w * 0.5, y + 0.1, w, y); S(c, 0.026);
  } else if (k === 'drool') {
    c.beginPath(); c.moveTo(-w * 0.8, y); c.quadraticCurveTo(0, y + 0.16, w * 0.8, y); c.quadraticCurveTo(0, y + 0.05, -w * 0.8, y); c.closePath(); FS(c, '#e98a9b', 0.024);
    c.beginPath(); c.moveTo(w * 0.5, y + 0.07); c.quadraticCurveTo(w * 0.62, y + 0.22, w * 0.5, y + 0.27); c.quadraticCurveTo(w * 0.36, y + 0.2, w * 0.5, y + 0.07); FS(c, '#dff0fb', 0.016, '#9fc4e2');
  } else if (k === 'kiss') { c.beginPath(); c.moveTo(-0.02, y - 0.03); c.quadraticCurveTo(0.08, y - 0.01, 0, y + 0.03); c.quadraticCurveTo(0.09, y + 0.06, -0.02, y + 0.1); S(c, 0.026); }
  else if (k === 'flat') { c.beginPath(); c.moveTo(-w * 0.6, y + 0.03); c.lineTo(w * 0.6, y + 0.03); S(c, 0.026); }
  else if (k === 'small') { c.beginPath(); c.moveTo(-w * 0.4, y + 0.02); c.quadraticCurveTo(0, y + 0.08, w * 0.4, y + 0.02); S(c, 0.026); }
  else { c.beginPath(); c.moveTo(-w, y - 0.01); c.quadraticCurveTo(0, y + 0.13, w, y - 0.01); S(c, 0.028); }
}
function blush(c, k = 1, lines = true) {
  for (const s of [-1, 1]) {
    c.globalAlpha = Math.min(1, 0.55 * k); c.beginPath(); c.ellipse(0.56 * s, 0.5, 0.2, 0.11, 0, 0, TAU); F(c, BLUSH); c.globalAlpha = 1;
    if (lines) for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(0.56 * s + i * 0.075 + 0.03, 0.455); c.lineTo(0.56 * s + i * 0.075 - 0.03, 0.545); S(c, 0.016, 'rgba(232,110,135,' + Math.min(1, 0.75 * k) + ')'); }
  }
}
function faceBase(c, shadow = 0.5) {
  c.beginPath(); c.moveTo(-0.93, -0.12); c.bezierCurveTo(-0.97, 0.46, -0.6, 0.9, 0, 0.93); c.bezierCurveTo(0.6, 0.9, 0.97, 0.46, 0.93, -0.12); c.bezierCurveTo(0.93, -0.75, 0.5, -1.0, 0, -1.0); c.bezierCurveTo(-0.5, -1.0, -0.93, -0.75, -0.93, -0.12); c.closePath();
  FS(c, SKIN, 0.026);
  c.save(); c.clip(); c.globalAlpha = shadow; c.beginPath(); c.ellipse(0, -0.5, 1.0, 0.52, 0, 0, TAU); F(c, SKIN_SH); c.globalAlpha = 1; c.restore();
}
// 顔の中身（目・眉・口・頬）。f: { eyes, lid, lookX, lookY, mouth, blush, hideL（左目を描かない）, dark（上半分の影。ヤンデレ）, tears, sweat }
function features(c, ch, f) {
  const e = { col: ch.eyeCol, lash: ch.lash, mode: f.eyes || 'open', lid: f.lid ?? ch.lid ?? 0, lookX: f.lookX || 0, lookY: f.lookY || 0, dot: f.dot };
  blush(c, (ch.blush ?? 1) * (f.blush ?? 1));
  for (const s of [-1, 1]) { if (f.noEyes || (s === -1 && f.hideL)) continue; eye(c, s, e); if (!(f.eyes === 'cross' || f.eyes === 'happy')) brow(c, s, { tilt: f.browTilt || 0, dy: f.browY || 0 }); }
  if (ch.moles) for (const s of [-1, 1]) { c.beginPath(); c.arc(0.66 * s, 0.4, 0.024, 0, TAU); F(c, '#5a3f4d'); }
  mouth(c, typeof f.mouth === 'string' ? { kind: f.mouth, fang: ch.fang } : { fang: ch.fang, ...(f.mouth || {}) });
  if (f.tears) for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0.6 * s, 0.3); c.bezierCurveTo(0.78 * s, 0.4, 0.86 * s, 0.62 + 0.1 * f.tears, 0.74 * s, 0.7 + 0.1 * f.tears); c.bezierCurveTo(0.62 * s, 0.66, 0.6 * s, 0.5, 0.6 * s, 0.3); FS(c, '#d9efff', 0.018, '#8fbfe6'); }
  if (f.sweat) { c.beginPath(); c.moveTo(0.78, -0.52); c.bezierCurveTo(0.92, -0.36, 0.9, -0.22, 0.78, -0.22); c.bezierCurveTo(0.66, -0.22, 0.66, -0.36, 0.78, -0.52); FS(c, '#d9efff', 0.018, '#8fbfe6'); }
}

// ============================================================ ユリア
// 白い髪、黄色い毛先のサイドポニー（向かって右）、黒い縫い目のヘアピン、目の下のほくろ、水色の瞳（元絵に合わせた）
export const YURIA = { eyeCol: ['#6f93bd', '#a8c8e6', '#e2f0fa', '#8faac6'], lash: 'dark', lid: 0.2, moles: true, fang: false, blush: 1 };
const BACK = '#f2eff9';
function yuriaBackHair(c, sw, lift = 0) {
  // 後ろ髪（肩の後ろへ流れる。毛先は黄色）
  const k = 1 - 0.3 * lift, y1 = 1.9 * k;
  for (const [x0, tx, ty, w, b1, b2] of [[-0.75, -1.22, y1, 0.62, -0.1, 0.14], [0.75, 1.22, y1, 0.62, 0.1, -0.14], [-0.4, -0.72, y1 + 0.12, 0.56, -0.06, 0.1], [0.4, 0.72, y1 + 0.12, 0.56, 0.06, -0.1], [0, 0.1, y1 + 0.06, 0.6, 0.04, -0.04]])
    lock(c, x0, 0.2, tx + sw * 0.55, ty, w, b1 - sw * 0.12, b2, [BACK, YEL, 0.5], 0.024, 0.3);
  c.beginPath(); c.moveTo(0, -1.22); c.bezierCurveTo(0.7, -1.24, 1.18, -0.8, 1.18, -0.1); c.bezierCurveTo(1.2, 0.3, 1.1, 0.6, 0.9, 0.8); c.lineTo(-0.9, 0.8); c.bezierCurveTo(-1.1, 0.6, -1.2, 0.3, -1.18, -0.1); c.bezierCurveTo(-1.18, -0.8, -0.7, -1.24, 0, -1.22); c.closePath(); F(c, BACK);
  c.beginPath(); c.moveTo(0.98, 0.72); c.bezierCurveTo(1.14, 0.5, 1.2, 0.3, 1.18, -0.1); c.bezierCurveTo(1.18, -0.8, 0.7, -1.24, 0, -1.22); c.bezierCurveTo(-0.7, -1.24, -1.18, -0.8, -1.18, -0.1); c.bezierCurveTo(-1.2, 0.3, -1.14, 0.5, -0.98, 0.72); S(c, 0.026);
}
function yuriaTail(c, sw, lift = 0) {
  // サイドポニー（向かって右）。結び目から波打って肩の先まで落ちる。sw: なびき、lift: 浮き上がり
  const rx = 1.0, ry = -0.8, up = lift * 1.1;
  for (const [tx, ty, w, b1, b2] of [[1.24, 1.62, 0.36, 0.22, -0.2], [1.62, 1.4, 0.42, 0.3, -0.22], [1.92, 0.92, 0.42, 0.34, -0.16], [1.98, 0.3, 0.36, 0.36, -0.08]])
    lock(c, rx + 0.1, ry + 0.1, tx + sw * (0.45 + ty * 0.3), ty - up * (0.5 + ty * 0.45), w, b1 - sw * 0.12, b2 - sw * 0.05, [HAIR, YEL, 0.4], 0.024, 0.35);
  for (const [tx, ty, w, b] of [[1.46, -1.36, 0.2, -0.3], [1.16, -1.46, 0.18, 0.2], [1.7, -1.0, 0.18, -0.34]]) lock(c, rx + 0.04, ry - 0.02, tx + sw * 0.15, ty, w, b, b * 0.5, HAIR);
  c.beginPath(); c.ellipse(rx + 0.05, ry + 0.02, 0.14, 0.2, 0.55, 0, TAU); FS(c, '#38313c', 0.022);   // 黒いシュシュ
}
function yuriaFrontHair(c, sw) {
  cap(c);
  lock(c, -0.94, -0.36, -1.0 + sw * 0.4, 1.34, 0.36, -0.12, 0.16 - sw * 0.2, [HAIR, YEL, 0.52], 0.024, 0.3);   // 顔の横の長い束
  lock(c, 0.94, -0.36, 1.0 + sw * 0.4, 1.4, 0.36, 0.12, -0.16 - sw * 0.2, [HAIR, YEL, 0.52], 0.024, -0.3);
  lock(c, 0.46, -0.92, 0.88, 0.1, 0.6, -0.24, -0.1, HAIR, 0.024, -0.2);        // 右へ流れる前髪
  lock(c, 0.3, -1.0, -0.92, 0.2, 0.88, 0.3, 0.16, HAIR, 0.024, 0.3);           // 左への大きな流れ
  lock(c, 0.22, -0.92, -0.42, 0.1, 0.46, 0.26, 0.1, HAIR, 0.02);
  lock(c, 0.24, -0.9, 0.04, 0.36, 0.26, -0.14, 0.1);                           // 目のあいだの束
  c.save(); c.translate(-0.46, -0.36); c.rotate(-0.25); c.beginPath(); c.moveTo(-0.19, 0); c.lineTo(0.19, 0); S(c, 0.07, '#2f2a33'); for (let i = -1.5; i <= 1.5; i++) { c.beginPath(); c.moveTo(i * 0.095, -0.085); c.lineTo(i * 0.095, 0.085); S(c, 0.038, '#2f2a33'); } c.restore();   // 縫い目のヘアピン
  c.beginPath(); c.moveTo(-0.1, -1.2); c.quadraticCurveTo(-0.3, -1.48, -0.5, -1.38); S(c, 0.022); c.beginPath(); c.moveTo(0.12, -1.22); c.quadraticCurveTo(0.12, -1.46, 0.3, -1.5); S(c, 0.022);
}
// ============================================================ ヴォル
// 白いポニーテール、向かって左の目が前髪で隠れる、淡い青の瞳に白いまつげ
export const VOL = { eyeCol: ['#8fa6dc', '#bccdf0', '#e6eefc', '#8292c4', 'rgba(90,105,160,.7)'], lash: 'white', lid: 0.12, blush: 1.15 };
function volBackHair(c, sw) {
  const rx = 0.6, ry = -1.02;                 // ポニーテール（後ろ・向かって右上）。ふさふさの束
  for (const [tx, ty, w, b1, b2] of [[1.34, 0.62, 0.42, 0.42, -0.1], [1.72, 0.1, 0.46, 0.42, -0.06], [1.74, -0.62, 0.42, 0.36, 0.0]]) lock(c, rx + 0.12, ry + 0.06, tx + sw * (0.5 + ty * 0.25), ty, w, b1 - sw * 0.12, b2, [HAIR, HAIR_SH, 0.55], 0.024, 0.3);
  for (const [tx, ty, w, b] of [[1.2, -1.5, 0.22, 0.25], [0.86, -1.56, 0.18, 0.25], [1.5, -1.22, 0.2, -0.3]]) lock(c, rx, ry, tx, ty, w, b, b * 0.4, HAIR);
  c.beginPath(); c.ellipse(rx + 0.05, ry + 0.03, 0.13, 0.18, 0.75, 0, TAU); FS(c, '#3a3540', 0.022);
  c.beginPath(); c.moveTo(0, -1.2); c.bezierCurveTo(0.66, -1.22, 1.14, -0.8, 1.14, -0.1); c.bezierCurveTo(1.14, 0.3, 1.08, 0.62, 0.98, 0.8); c.bezierCurveTo(0.7, 0.98, -0.7, 0.98, -0.98, 0.8); c.bezierCurveTo(-1.08, 0.62, -1.14, 0.3, -1.14, -0.1); c.bezierCurveTo(-1.14, -0.8, -0.66, -1.22, 0, -1.2); c.closePath(); FS(c, BACK, 0.026);
}
function volFrontHair(c, sw, peek = 0) {
  cap(c);
  lock(c, -0.94, -0.36, -0.96 + sw * 0.35, 1.22, 0.34, -0.1, 0.14 - sw * 0.2, HAIR, 0.024, 0.3);
  lock(c, 0.94, -0.36, 0.98 + sw * 0.35, 1.26, 0.32, 0.1, -0.14 - sw * 0.2, HAIR, 0.024, -0.3);
  lock(c, 0.44, -0.92, 0.86, 0.04, 0.56, -0.22, -0.08, HAIR, 0.024, -0.2);
  lock(c, 0.2, -1.0, -0.6 - peek * 0.1, 0.76, 1.02, 0.2, 0.06, HAIR, 0.024, 0.35);     // 目を隠す厚い前髪
  lock(c, 0.1, -0.94, -0.8, 0.36, 0.44, 0.2, 0.06, HAIR, 0.02);
  lock(c, 0.26, -0.9, 0.12, 0.34, 0.28, -0.1, 0.08);
}

// ============================================================ フルル（ママ）
// 白銀のふわっとした短い髪。厚い前髪で両目が隠れる。赤い頬
export const FURURU = { eyeCol: ['#999', '#bbb', '#ddd'], lash: 'dark', blush: 1.5 };
function fururuBackHair(c, sw) {
  for (const s of [-1, 1]) {       // 頬の横と襟足の、外へはねる毛
    lock(c, 1.0 * s, -0.42, (1.42 + sw * 0.15 * s) * s, -0.06, 0.26, -0.1 * s, -0.24 * s, HAIR, 0.024);
    lock(c, 1.02 * s, 0.14, (1.44 + sw * 0.2 * s) * s, 0.56, 0.3, -0.12 * s, -0.26 * s, BACK, 0.024);
    lock(c, 0.9 * s, 0.56, (1.26 + sw * 0.2 * s) * s, 1.04, 0.28, -0.1 * s, -0.26 * s, BACK, 0.024);
  }
  // 頭の後ろの丸み。毛先はあごの下で内へ巻く（まん中は顔と首に隠れる）
  c.beginPath(); c.moveTo(0, -1.26); c.bezierCurveTo(0.74, -1.3, 1.26, -0.86, 1.24, -0.12); c.bezierCurveTo(1.24, 0.3, 1.2, 0.62, 1.04, 0.84); c.quadraticCurveTo(0.88, 1.06, 0.58, 0.98); c.quadraticCurveTo(0.3, 0.88, 0, 0.86);
  c.quadraticCurveTo(-0.3, 0.88, -0.58, 0.98); c.quadraticCurveTo(-0.88, 1.06, -1.04, 0.84); c.bezierCurveTo(-1.2, 0.62, -1.24, 0.3, -1.24, -0.12); c.bezierCurveTo(-1.26, -0.86, -0.74, -1.3, 0, -1.26); c.closePath(); FS(c, BACK, 0.026);
}
// 両目を隠す、厚くてそろった前髪。房: [左の切れ目 x, 右の切れ目 x, 毛先 x, 毛先 y]
const F_BANGS = [[-0.93, -0.6, -0.74, 0.39], [-0.6, -0.24, -0.4, 0.45], [-0.24, 0.1, -0.05, 0.48], [0.1, 0.46, 0.27, 0.45], [0.46, 0.93, 0.7, 0.4]], F_NOTCH = 0.13;
function fururuBangs(c) {
  c.moveTo(F_BANGS[0][0], F_NOTCH);
  for (const [xl, xr, tx, ty] of F_BANGS) { c.bezierCurveTo(xl + 0.01, F_NOTCH + (ty - F_NOTCH) * 0.7, tx - (tx - xl) * 0.5, ty, tx, ty); c.bezierCurveTo(tx + (xr - tx) * 0.55, ty - 0.03, xr - 0.02, F_NOTCH + (ty - F_NOTCH) * 0.55, xr, F_NOTCH); }
}
function fururuFrontHair(c, sw) {
  cap(c);
  c.beginPath(); c.moveTo(-0.93, F_NOTCH); c.lineTo(-0.98, -0.3); c.bezierCurveTo(-0.92, -0.78, -0.5, -1.04, 0, -1.06); c.bezierCurveTo(0.5, -1.04, 0.92, -0.78, 0.98, -0.3); c.lineTo(0.93, F_NOTCH); c.lineTo(-0.93, F_NOTCH); c.closePath(); F(c, HAIR);
  c.beginPath(); fururuBangs(c); c.closePath(); F(c, HAIR);
  c.beginPath(); fururuBangs(c); S(c, 0.024);
  for (const s of [-1, 1]) lock(c, 0.97 * s, -0.4, (1.0 + sw * 0.3 * s) * s, 0.92, 0.34, 0.1 * s, -0.2 * s, HAIR, 0.024, 0.3 * s);       // 顔の横の束（前髪の端に重なり、先が内へ巻く）
  for (const [, xr] of F_BANGS.slice(0, -1)) { c.beginPath(); c.moveTo(xr, F_NOTCH); c.quadraticCurveTo(xr * 0.96 + 0.01, F_NOTCH - 0.2, xr * 0.86, F_NOTCH - 0.42); S(c, 0.016, '#cfc4dc'); }      // 房の分かれ目
  for (const [x0, x1] of [[-0.78, -0.72], [-0.42, -0.36], [0.3, 0.26], [0.66, 0.7]]) { c.beginPath(); c.moveTo(x0 * 0.9, -0.5); c.quadraticCurveTo(x0, -0.1, x1, 0.2); S(c, 0.013, '#ddd5e8'); }       // 細い毛筋
  c.beginPath(); c.moveTo(0.02, -1.2); c.quadraticCurveTo(0.06, -0.98, 0.0, -0.8); S(c, 0.016, '#cfc4dc');                         // 分け目
  c.beginPath(); c.moveTo(-0.12, -1.22); c.quadraticCurveTo(-0.3, -1.46, -0.5, -1.36); S(c, 0.022);
}

// ---- 頭を描く。who: 'yuria' | 'vol'。f: 表情（features 参照）+ { sway: 髪のなびき, tilt, glow（隠れた目の光 0..1）, dark（顔の影 0..1）}
export function drawHead(c, who, f = {}) {
  const sw = f.sway || 0;
  if (who === 'fururu') { fururuBackHair(c, sw); faceBase(c, 0.75); features(c, FURURU, { ...f, noEyes: true }); fururuFrontHair(c, sw); }
  else if (who === 'yuria') {
    yuriaBackHair(c, sw); yuriaTail(c, sw, f.lift || 0);
    faceBase(c); features(c, YURIA, f); yuriaFrontHair(c, sw);
  } else {
    volBackHair(c, sw); faceBase(c);
    features(c, VOL, { ...f, hideL: true });
    if (f.dark) { c.save(); c.beginPath(); c.arc(0, 0, 0.95, 0, TAU); c.clip(); const g = c.createLinearGradient(0, -1, 0, 0.55); g.addColorStop(0, `rgba(58,40,92,${0.75 * f.dark})`); g.addColorStop(1, 'rgba(58,40,92,0)'); c.fillStyle = g; c.fillRect(-1, -1, 2, 1.6); c.restore(); }
    volFrontHair(c, sw, f.peek || 0);
    if (f.glow) { const g = c.createRadialGradient(-0.43, 0.21, 0, -0.43, 0.21, 0.42); g.addColorStop(0, `rgba(150,200,255,${0.95 * f.glow})`); g.addColorStop(0.3, `rgba(120,170,255,${0.5 * f.glow})`); g.addColorStop(1, 'rgba(120,170,255,0)'); c.fillStyle = g; c.fillRect(-0.9, -0.25, 0.95, 0.95); c.beginPath(); c.ellipse(-0.43, 0.21, 0.035, 0.13, 0, 0, TAU); F(c, `rgba(235,245,255,${f.glow})`); }
  }
}

// ============================================================ 体（正面・2 頭身）
const CARD = '#f7c36c', CARD_SH = '#eaa850', SHIRT = '#ffffff', SHIRT_SH = '#ebe7f5', SKIRT = '#8d4250', SKIRT_SH = '#6f3040', SHOE = '#6b4a3c';
const TEE = '#ffffff', PANTS = '#74708a', PANTS_SH = '#5d5972', SNEAK = '#ffffff';
const DEF = { hx: 0, hy: 0, tilt: 0, lean: 0, armL: [-0.86, 1.86], armR: [0.86, 1.86], elbL: null, elbR: null, legL: 0, legR: 0, bob: 0, flap: 0, sway: 0, lift: 0, squash: 0 };
// 走る姿勢（正面へ向かって駆けてくる）。ph: 0..1 で 2 歩。panic: 腕の振り上げ
export function runPose(ph, panic = 1) {
  const s = Math.sin(TAU * ph), b = Math.abs(Math.cos(TAU * ph));
  return { bob: -0.1 * b, legL: Math.max(0, s), legR: Math.max(0, -s), armL: [-0.98 - 0.08 * s, lerp(1.5, 0.35, panic) - 0.3 * s * panic], armR: [0.98 - 0.08 * s, lerp(1.5, 0.35, panic) + 0.3 * s * panic],
    lean: 0.05 * s, tilt: -0.05 * s, flap: 0.6 + 0.4 * b, lift: 0.55 + 0.25 * b, sway: 0.12 * s, squash: 0.04 * (1 - b) };
}
function leg(c, side, lift, skin, shoe, pants = null) {
  const hx = 0.25 * side, hy = 1.98, ay = 3.02 - 0.62 * lift, ax = (0.27 + 0.06 * lift) * side, k = 1 + 0.32 * lift;
  if (pants) { group(c, pants, [capsule(c, hx, hy, ax, ay - 0.1, 0.25, 0.2 * k)]); c.beginPath(); c.ellipse(ax, ay - 0.06, 0.21 * k, 0.07 * k, 0, 0, TAU); FS(c, PANTS_SH, 0.02); }
  else group(c, skin, [capsule(c, hx, hy, ax, ay, 0.2, 0.15 * k)]);
  c.beginPath(); c.ellipse(ax + 0.02 * side, ay + 0.1 * k, 0.2 * k, (0.11 + 0.06 * lift) * k, 0, 0, TAU); FS(c, shoe, 0.024);
  if (shoe === SNEAK) { c.beginPath(); c.moveTo(ax - 0.17 * k, ay + 0.14 * k); c.quadraticCurveTo(ax, ay + 0.22 * k, ax + 0.19 * k, ay + 0.14 * k); S(c, 0.018, '#b9b3c8'); }
}
function arm(c, sx, sy, hx, hy, kind, el = null) {
  const ex = el ? el[0] : sx, ey = el ? el[1] : sy;       // ひじ（無ければ肩からまっすぐ）
  if (kind === 'sleeve') {           // カーディガンの袖（手の先まで隠れる長さ）
    group(c, CARD, [...(el ? [capsule(c, sx, sy, ex, ey, 0.2, 0.22)] : []), capsule(c, ex, ey, hx, hy, el ? 0.22 : 0.2, 0.25), () => c.ellipse(hx, hy, 0.27, 0.24, 0, 0, TAU)]);
    const dx = hx - ex, dy = hy - ey, L = Math.hypot(dx, dy) || 1;
    c.beginPath(); c.arc(hx + dx / L * 0.2, hy + dy / L * 0.2, 0.1, 0, TAU); FS(c, SKIN, 0.02);                 // 指先
    c.beginPath(); c.moveTo(hx - dy / L * 0.24 - dx / L * 0.02, hy + dx / L * 0.24 - dy / L * 0.02); c.lineTo(hx + dy / L * 0.24 - dx / L * 0.02, hy - dx / L * 0.24 - dy / L * 0.02); S(c, 0.02, CARD_SH);
  } else {                           // 半袖と素肌の腕
    group(c, SKIN, [...(el ? [capsule(c, sx, sy, ex, ey, 0.13, 0.12)] : []), capsule(c, ex, ey, hx, hy, el ? 0.12 : 0.13, 0.11), () => c.arc(hx, hy, 0.14, 0, TAU)]);
    const k = el ? 0.6 : 0.3, qx = el ? ex : hx, qy = el ? ey : hy; group(c, TEE, [capsule(c, sx, sy, lerp(sx, qx, k), lerp(sy, qy, k), 0.17, 0.18)]);
  }
}
// 全身を描く。原点は頭の中心（立っているとき）。face は drawHead と同じ。
// o.only: ['back', 'body', 'arms', 'head'] のうち描く部分（抱き合う絵で、人物どうしを前後に重ねるため）
const F_TOP = '#ffffff', F_TRIM = '#4d4a57', F_PANTS = '#63606f', F_PANTS_SH = '#504d5c';
export function drawFigure(c, who, pose = {}, face = {}, o = {}) {
  const p = { ...DEF, ...pose }, yu = who === 'yuria', fu = who === 'fururu', on = (k) => !o.only || o.only.includes(k);
  c.save(); c.translate(0, p.bob);
  // ---- 頭の後ろ（後ろ髪・尾）
  if (on('back')) { c.save(); c.translate(p.hx, p.hy); c.rotate(p.tilt); if (fu) fururuBackHair(c, p.sway); else if (yu) { yuriaBackHair(c, p.sway, p.lift); yuriaTail(c, p.sway, p.lift); } else volBackHair(c, p.sway); c.restore(); }
  // ---- 体
  c.save(); c.translate(0, 1.0); c.rotate(p.lean); c.scale(1 + p.squash, 1 - p.squash); c.translate(0, -1.0);
  if (fu) {
    if (on('body')) {
      for (const s of [-1, 1]) { const lift = s < 0 ? p.legL : p.legR, hx = 0.3 * s, ay = 3.02 - 0.62 * lift, ax = (0.32 + 0.06 * lift) * s, k = 1 + 0.32 * lift;
        group(c, F_PANTS, [capsule(c, hx, 2.0, ax, ay - 0.1, 0.33, 0.25 * k)]); c.beginPath(); c.ellipse(ax, ay - 0.05, 0.26 * k, 0.08 * k, 0, 0, TAU); FS(c, F_PANTS_SH, 0.02);
        c.beginPath(); c.ellipse(ax + 0.02 * s, ay + 0.11 * k, 0.25 * k, (0.13 + 0.06 * lift) * k, 0, 0, TAU); FS(c, SNEAK, 0.024); c.beginPath(); c.moveTo(ax - 0.2 * k, ay + 0.16 * k); c.quadraticCurveTo(ax, ay + 0.25 * k, ax + 0.22 * k, ay + 0.16 * k); S(c, 0.018, '#b9b3c8');
        if (lift < 0.3) { c.beginPath(); c.rect((0.5 * s) - 0.12, 2.3, 0.24, 0.3); FS(c, F_PANTS, 0.02, F_PANTS_SH); } }
      c.beginPath(); c.moveTo(-0.56, 1.72); c.bezierCurveTo(-0.7, 1.9, -0.68, 2.1, -0.62, 2.22); c.lineTo(0.62, 2.22); c.bezierCurveTo(0.68, 2.1, 0.7, 1.9, 0.56, 1.72); c.closePath(); FS(c, F_PANTS, 0.026);
      c.beginPath(); c.moveTo(-0.06, 1.84); c.quadraticCurveTo(-0.2, 1.9, -0.12, 2.04); c.moveTo(0.06, 1.84); c.quadraticCurveTo(0.2, 1.9, 0.12, 2.04); S(c, 0.02, '#3c3a46');      // ひも
      c.beginPath(); c.moveTo(-0.56, 1.04); c.bezierCurveTo(-0.76, 1.3, -0.72, 1.56, -0.58, 1.8); c.quadraticCurveTo(0, 1.88, 0.58, 1.8); c.bezierCurveTo(0.72, 1.56, 0.76, 1.3, 0.56, 1.04); c.closePath(); FS(c, F_TOP, 0.026);   // タンクトップ
      c.beginPath(); c.moveTo(-0.58, 1.5); c.quadraticCurveTo(-0.3, 1.72, -0.02, 1.52); c.moveTo(0.02, 1.52); c.quadraticCurveTo(0.3, 1.72, 0.58, 1.5); S(c, 0.016, '#d6cfe6');
      c.beginPath(); c.moveTo(-0.34, 1.02); c.quadraticCurveTo(0, 1.4, 0.34, 1.02); S(c, 0.042, F_TRIM);                                                                              // 黒い縁取り
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0.44 * s, 1.03); c.quadraticCurveTo(0.6 * s, 1.16, 0.63 * s, 1.34); S(c, 0.05, F_TRIM); }
      c.beginPath(); c.moveTo(-0.06, 1.38); c.lineTo(0.06, 1.46); c.moveTo(0.06, 1.38); c.lineTo(-0.06, 1.46); S(c, 0.035, F_TRIM);                                                 // 小さな飾り紐
    }
    if (on('arms')) for (const s of [-1, 1]) { const h = s < 0 ? p.armL : p.armR, e = s < 0 ? p.elbL : p.elbR; group(c, SKIN, [...(e ? [capsule(c, 0.6 * s, 1.2, e[0], e[1], 0.17, 0.155)] : []), capsule(c, e ? e[0] : 0.6 * s, e ? e[1] : 1.2, h[0], h[1], e ? 0.155 : 0.17, 0.13), () => c.arc(h[0], h[1], 0.16, 0, TAU)]); }
  } else if (yu) {
    if (on('body')) {
      for (const s of [-1, 1]) { const fl = p.flap * 0.13; c.beginPath(); c.moveTo(0.42 * s, 1.14); c.lineTo((0.74 + fl) * s, 1.3); c.quadraticCurveTo((0.98 + fl * 1.6) * s, 1.9, (0.9 + fl * 2) * s, 2.42 - fl * 0.3); c.lineTo((0.56 + fl) * s, 2.36); c.lineTo(0.4 * s, 1.7); c.closePath(); FS(c, CARD, 0.026); }   // カーディガンの身ごろ
      leg(c, -1, p.legL, SKIN, SHOE); leg(c, 1, p.legR, SKIN, SHOE);
      const fl = p.flap * 0.12;
      c.beginPath(); c.moveTo(-0.44, 1.72); c.lineTo(-0.8 - fl, 2.38 - fl); c.quadraticCurveTo(0, 2.54 - fl * 0.5, 0.8 + fl, 2.38 - fl); c.lineTo(0.44, 1.72); c.closePath(); FS(c, SKIRT, 0.026);                      // スカート
      c.save(); c.clip(); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 0.17, 1.74); c.lineTo(i * 0.33, 2.56); S(c, 0.016, SKIRT_SH); }
      c.beginPath(); c.moveTo(-0.9, 2.26 - fl); c.quadraticCurveTo(0, 2.42 - fl * 0.5, 0.9, 2.26 - fl); S(c, 0.035, '#fff'); c.restore();
      c.beginPath(); c.moveTo(-0.46, 1.02); c.bezierCurveTo(-0.58, 1.3, -0.52, 1.6, -0.44, 1.8); c.lineTo(0.44, 1.8); c.bezierCurveTo(0.52, 1.6, 0.58, 1.3, 0.46, 1.02); c.closePath(); FS(c, SHIRT, 0.026);                  // シャツ
      c.beginPath(); c.moveTo(-0.34, 1.5); c.quadraticCurveTo(0, 1.62, 0.34, 1.5); S(c, 0.016, '#d6cfe6');
      c.beginPath(); c.moveTo(0, 1.2); c.lineTo(0, 1.8); S(c, 0.014, '#d6cfe6');
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, 1.2); c.lineTo(0.3 * s, 0.98); c.lineTo(0.36 * s, 1.24); c.closePath(); FS(c, SHIRT, 0.022); }
    }
    if (on('arms')) { arm(c, -0.52, 1.2, p.armL[0], p.armL[1], 'sleeve', p.elbL); arm(c, 0.52, 1.2, p.armR[0], p.armR[1], 'sleeve', p.elbR); }
  } else {
    if (on('body')) {
      leg(c, -1, p.legL, SKIN, SNEAK, PANTS); leg(c, 1, p.legR, SKIN, SNEAK, PANTS);
      c.beginPath(); c.moveTo(-0.46, 1.74); c.lineTo(-0.52, 2.14); c.lineTo(0.52, 2.14); c.lineTo(0.46, 1.74); c.closePath(); FS(c, PANTS, 0.026);
      c.beginPath(); c.moveTo(-0.08, 1.86); c.quadraticCurveTo(-0.16, 2.02, -0.1, 2.1); S(c, 0.016, '#d9d5e6'); c.beginPath(); c.moveTo(0.08, 1.86); c.quadraticCurveTo(0.16, 2.02, 0.1, 2.1); S(c, 0.016, '#d9d5e6');
      c.beginPath(); c.moveTo(-0.44, 1.56); c.lineTo(-0.46, 1.78); c.lineTo(0.46, 1.78); c.lineTo(0.44, 1.56); c.closePath(); FS(c, SKIN, 0.022);                           // おなか
      c.beginPath(); c.moveTo(-0.46, 1.02); c.bezierCurveTo(-0.58, 1.3, -0.54, 1.5, -0.48, 1.66); c.quadraticCurveTo(0, 1.74, 0.48, 1.66); c.bezierCurveTo(0.54, 1.5, 0.58, 1.3, 0.46, 1.02); c.closePath(); FS(c, TEE, 0.026);
      c.beginPath(); c.moveTo(-0.34, 1.46); c.quadraticCurveTo(0, 1.58, 0.34, 1.46); S(c, 0.016, '#d6cfe6');
      c.beginPath(); c.ellipse(-0.08, 1.7, 0.09, 0.07, 0, 0, TAU); FS(c, TEE, 0.02); c.beginPath(); c.moveTo(-0.14, 1.74); c.lineTo(-0.24, 1.86); c.lineTo(-0.1, 1.82); c.closePath(); FS(c, TEE, 0.02);                 // T シャツの結び目
    }
    if (on('arms')) { arm(c, -0.52, 1.2, p.armL[0], p.armL[1], 'bare', p.elbL); arm(c, 0.52, 1.2, p.armR[0], p.armR[1], 'bare', p.elbR); }
  }
  c.restore();
  // ---- 頭
  if (on('head')) {
    c.save(); c.translate(p.hx, p.hy); c.rotate(p.tilt);
    faceBase(c, fu ? 0.75 : 0.5);
    if (fu) { features(c, FURURU, { ...face, noEyes: true }); fururuFrontHair(c, p.sway); }
    else if (yu) { features(c, YURIA, face); yuriaFrontHair(c, p.sway); }
    else {
      features(c, VOL, { ...face, hideL: true });
      if (face.dark) { c.save(); c.beginPath(); c.arc(0, 0, 0.95, 0, TAU); c.clip(); const g = c.createLinearGradient(0, -1, 0, 0.55); g.addColorStop(0, `rgba(58,40,92,${0.75 * face.dark})`); g.addColorStop(1, 'rgba(58,40,92,0)'); c.fillStyle = g; c.fillRect(-1, -1, 2, 1.6); c.restore(); }
      volFrontHair(c, p.sway, face.peek || 0);
      if (face.glow) { const g = c.createRadialGradient(-0.43, 0.21, 0, -0.43, 0.21, 0.42); g.addColorStop(0, `rgba(150,200,255,${0.95 * face.glow})`); g.addColorStop(0.3, `rgba(120,170,255,${0.5 * face.glow})`); g.addColorStop(1, 'rgba(120,170,255,0)'); c.fillStyle = g; c.fillRect(-0.9, -0.25, 0.95, 0.95); c.beginPath(); c.ellipse(-0.43, 0.21, 0.035, 0.13, 0, 0, TAU); F(c, `rgba(235,245,255,${face.glow})`); }
    }
    c.restore();
  }
  c.restore();
}

// 素肌の腕や手を、人物の座標（頭の半径 = 1）で描く。pts: [[x,y],...] 肩 → ひじ → 手。r: 太さ [根もと, 先]
export function limb(c, pts, r = [0.16, 0.13], col = SKIN, handR = 0.16) {
  const parts = []; for (let i = 0; i < pts.length - 1; i++) { const k0 = i / (pts.length - 1), k1 = (i + 1) / (pts.length - 1); parts.push(capsule(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], lerp(r[0], r[1], k0), lerp(r[0], r[1], k1))); }
  const h = pts[pts.length - 1]; if (handR) parts.push(() => c.arc(h[0], h[1], handR, 0, TAU)); group(c, col, parts);
}
export const COLORS = { SKIN, CARD, HAIR, BLUSH };

// ============================================================ 触手（ヴォルの眷属）。やわらかい、先細りの腕
// pts: [[x,y],...] 根もと → 先（なめらかにつなぐ）。w0 → w1: 太さ。t: 時刻（うねり）。o: { amp, freq, tip: 'heart' | 'round', col: [根もと, 先] }
export function tentacle(c, pts, w0, w1, t, o = {}) {
  const N = 26, amp = o.amp ?? 0.12, fr = o.freq ?? 2.2, sp = o.speed ?? 3.2, ph = o.phase || 0, P = [];
  const cr = (a, b, d, e, u) => 0.5 * (2 * b + (d - a) * u + (2 * a - 5 * b + 4 * d - e) * u * u + (-a + 3 * b - 3 * d + e) * u * u * u);
  for (let i = 0; i <= N; i++) {
    const u = i / N * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(u)), f = u - k;
    const a = pts[Math.max(0, k - 1)], b = pts[k], d = pts[k + 1], e = pts[Math.min(pts.length - 1, k + 2)];
    P.push([cr(a[0], b[0], d[0], e[0], f), cr(a[1], b[1], d[1], e[1], f)]);
  }
  const L = [], R = [];
  for (let i = 0; i <= N; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(N, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, u = i / N;
    const wig = amp * Math.sin(fr * TAU * u - sp * t + ph) * u, w = lerp(w0, w1, u ** 0.8) / 2;
    const x = P[i][0] + nx * wig, y = P[i][1] + ny * wig; P[i] = [x, y];
    L.push([x + nx * w, y + ny * w]); R.push([x - nx * w, y - ny * w]);
  }
  const col = o.col || ['#cdbdf2', '#f6b5d2'];
  c.beginPath(); c.moveTo(L[0][0], L[0][1]); for (const q of L) c.lineTo(q[0], q[1]); c.arc(P[N][0], P[N][1], w1 / 2, Math.atan2(L[N][1] - P[N][1], L[N][0] - P[N][0]), Math.atan2(R[N][1] - P[N][1], R[N][0] - P[N][0]), true); for (let i = N; i >= 0; i--) c.lineTo(R[i][0], R[i][1]); c.closePath();
  const g = c.createLinearGradient(P[0][0], P[0][1], P[N][0], P[N][1]); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]); c.fillStyle = g; c.fill(); S(c, o.lw ?? 0.026);
  c.beginPath(); for (let i = 2; i <= N - 2; i++) { const q = [lerp(P[i][0], L[i][0], 0.5), lerp(P[i][1], L[i][1], 0.5)]; i === 2 ? c.moveTo(q[0], q[1]) : c.lineTo(q[0], q[1]); } S(c, Math.max(0.012, w1 * 0.16), 'rgba(255,255,255,.6)');       // つや
  if (o.tip === 'heart') heart(c, P[N][0], P[N][1] - w1 * 0.2, w1 * 0.95, '#ff8fb1');
  return P[N];
}

