// buncho.js — マッスル文鳥（B.U.N の兵たち）。
//   文鳥の頭（黒い帽子のような頭、白いほっぺ、赤いくちばしと目のふち）に、ボディビルダーの体。
//   頭の中心が原点・頭の半径が 1。正面向き（こちらへ向かってくる敵なので）。
const TAU = Math.PI * 2;
const LINE = '#33303a', CAP = '#2b2a33', CHEEK = '#ffffff', GREY = '#9aa1b0', GREY_D = '#7b8294', GREY_L = '#b9bfcc', BELLY = '#edd8d0', BELLY_SH = '#d9bcb3';
const BEAK = '#e9423c', BEAK_L = '#ffb0aa', LEG = '#f3a28e', BLK = '#22212a', RED = '#ff4a36', GOLD = '#f2c14e';
let LW = 1;
const S = (c, w = 0.045, col = LINE) => { c.strokeStyle = col; c.lineWidth = w * LW; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); };
const F = (c, col) => { c.fillStyle = col; c.fill(); };
const FS = (c, col, w = 0.045, line = LINE) => { F(c, col); S(c, w, line); };
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); };
const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
// 太さの変わる腕・脚（a → b。ra, rb: 両端の太さ）
function limb(c, a, b, ra, rb, col) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, a0 = Math.atan2(ny, nx);
  c.beginPath(); c.moveTo(a[0] + nx * ra, a[1] + ny * ra); c.arc(a[0], a[1], ra, a0, a0 + Math.PI); c.lineTo(b[0] - nx * rb, b[1] - ny * rb); c.arc(b[0], b[1], rb, a0 + Math.PI, a0 + TAU); c.closePath(); FS(c, col);
}
// 力こぶのある腕: 肩 s → ひじ e → 手 h。flex: 力こぶの盛り上がり 0..1
function arm(c, s, e, h, flex = 0.6, o = {}) {
  limb(c, e, h, 0.27, 0.2, GREY);                                              // 前腕
  limb(c, s, e, 0.36, 0.3, GREY);                                              // 上腕
  const mx = (s[0] + e[0]) / 2, my = (s[1] + e[1]) / 2, dx = e[0] - s[0], dy = e[1] - s[1], L = Math.hypot(dx, dy) || 1, side = o.bulge ?? -1;
  ell(c, mx + (-dy / L) * 0.2 * side * flex, my + (dx / L) * 0.2 * side * flex, 0.34, 0.25 + 0.1 * flex, Math.atan2(dy, dx)); FS(c, GREY_L, 0.04);      // 力こぶ
  ell(c, s[0], s[1], 0.38, 0.36); FS(c, GREY, 0.045);                            // 肩
  c.beginPath(); c.arc(s[0], s[1], 0.24, -2.4, -0.9); S(c, 0.03, GREY_L);
  if (!o.noHand) {                                                               // 手（羽の指 3 本を握ったこぶし）
    ell(c, h[0], h[1], 0.24, 0.22); FS(c, GREY_D, 0.045);
    const a = Math.atan2(h[1] - e[1], h[0] - e[0]);
    for (const k of [-0.5, 0, 0.5]) { c.beginPath(); c.moveTo(h[0] + Math.cos(a + k) * 0.08, h[1] + Math.sin(a + k) * 0.08); c.lineTo(h[0] + Math.cos(a + k) * 0.22, h[1] + Math.sin(a + k) * 0.22); S(c, 0.03); }
  }
}
// 頭。o: { mood: 'angry' | 'shout' | 'smug' | 'shock' | 'cry', shades: サングラス, cap: 将校の帽子, scar }
export function head(c, o = {}) {
  const mood = o.mood || 'angry';
  ell(c, 0, 0, 1.0, 0.95); FS(c, CAP, 0.05);
  // 白いほっぺ
  for (const s of [-1, 1]) { ell(c, 0.5 * s, 0.26, 0.47, 0.4, 0.2 * s); F(c, CHEEK); }
  c.save(); ell(c, 0, 0, 1.0, 0.95); c.clip(); c.beginPath(); c.rect(-1, 0.55, 2, 0.5); F(c, GREY); c.restore();          // のどから下は体の灰色
  ell(c, 0, 0, 1.0, 0.95); S(c, 0.05);
  // 目（赤いふち）
  for (const s of [-1, 1]) {
    const x = 0.5 * s, y = -0.14;
    if (o.shades) continue;
    ell(c, x, y, 0.2, 0.2); FS(c, BEAK, 0.03);
    if (mood === 'shock') { ell(c, x, y, 0.13, 0.13); F(c, '#fff'); ell(c, x, y, 0.045, 0.045); F(c, BLK); }
    else { ell(c, x, y, 0.115, 0.125); F(c, BLK); ell(c, x - 0.04, y - 0.05, 0.04, 0.04); F(c, '#fff'); }
    if (mood === 'angry' || mood === 'shout' || mood === 'smug') { poly(c, [[x - 0.3 * s, y - 0.34], [x + 0.3 * s, y - 0.12 + (mood === 'smug' ? 0.06 : 0)], [x + 0.3 * s, y - 0.36]]); F(c, CAP); c.beginPath(); c.moveTo(x - 0.28 * s, y - 0.3); c.lineTo(x + 0.3 * s, y - 0.1 + (mood === 'smug' ? 0.06 : 0)); S(c, 0.07, '#4a4955'); }   // つり上がった眉
    if (mood === 'cry') { c.beginPath(); c.moveTo(x - 0.1, y + 0.2); c.bezierCurveTo(x - 0.16, y + 0.5, x - 0.02, y + 0.8, x + 0.06 * s, y + 0.86); c.bezierCurveTo(x + 0.14, y + 0.6, x + 0.1, y + 0.4, x + 0.1, y + 0.2); FS(c, '#cfeaff', 0.025, '#8fbfe6'); }
  }
  if (o.shades) { c.beginPath(); c.moveTo(-0.86, -0.3); c.lineTo(0.86, -0.3); c.lineTo(0.78, 0.02); c.quadraticCurveTo(0.5, 0.12, 0.2, -0.02); c.lineTo(0, -0.12); c.lineTo(-0.2, -0.02); c.quadraticCurveTo(-0.5, 0.12, -0.78, 0.02); c.closePath(); FS(c, '#17161d', 0.04); c.beginPath(); c.moveTo(-0.62, -0.2); c.lineTo(-0.36, -0.2); c.moveTo(0.3, -0.2); c.lineTo(0.56, -0.2); S(c, 0.05, '#6f7386'); }
  if (o.scar) { c.beginPath(); c.moveTo(0.3, -0.5); c.lineTo(0.7, 0.2); S(c, 0.05, '#c9454a'); for (const k of [0.25, 0.5, 0.75]) { c.beginPath(); c.moveTo(0.3 + 0.4 * k - 0.08, -0.5 + 0.7 * k + 0.04); c.lineTo(0.3 + 0.4 * k + 0.08, -0.5 + 0.7 * k - 0.04); S(c, 0.035, '#c9454a'); } }
  // くちばし（付け根が赤く、先へ向かって桃色）
  const open = mood === 'shout' ? 0.3 : mood === 'shock' ? 0.36 : mood === 'cry' ? 0.22 : 0;
  const g = c.createLinearGradient(0, 0, 0, 0.8); g.addColorStop(0, BEAK); g.addColorStop(1, BEAK_L);
  if (open) { c.beginPath(); c.moveTo(-0.3, 0.42); c.quadraticCurveTo(0, 0.5 + open * 1.5, 0.3, 0.42); c.closePath(); FS(c, '#8c2b34', 0.04); ell(c, 0, 0.5 + open * 0.55, 0.14, 0.09 + open * 0.2); F(c, '#ff8fa0');
    c.beginPath(); c.moveTo(-0.26, 0.5 + open); c.quadraticCurveTo(0, 0.56 + open * 1.9, 0.26, 0.5 + open); c.quadraticCurveTo(0, 0.42 + open * 1.2, -0.26, 0.5 + open); c.closePath(); FS(c, BEAK_L, 0.04); }
  c.beginPath(); c.moveTo(-0.36, 0.0); c.quadraticCurveTo(0, -0.14, 0.36, 0.0); c.quadraticCurveTo(0.3, 0.42, 0, open ? 0.5 : 0.72); c.quadraticCurveTo(-0.3, 0.42, -0.36, 0.0); c.closePath(); c.fillStyle = g; c.fill(); S(c, 0.045);
  if (!open) { c.beginPath(); c.moveTo(-0.27, 0.34); c.quadraticCurveTo(0, mood === 'smug' ? 0.52 : 0.44, 0.27, mood === 'smug' ? 0.26 : 0.34); S(c, 0.03, '#b23038'); }
  c.beginPath(); c.moveTo(-0.14, 0.02); c.quadraticCurveTo(0, -0.03, 0.14, 0.02); S(c, 0.025, '#ffd0cc');
  // 怒りのしるし
  if (mood === 'angry' || mood === 'shout') { c.save(); c.translate(0.66, -0.62); for (const r of [0, 1, 2, 3]) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0.05, 0.16); c.quadraticCurveTo(0.05, 0.05, 0.16, 0.05); S(c, 0.04, RED); } c.restore(); }
  if (o.cap) {                                                                   // 将校の帽子
    c.beginPath(); c.moveTo(-1.0, -0.52); c.quadraticCurveTo(0, -0.84, 1.0, -0.52); c.lineTo(1.12, -1.08); c.quadraticCurveTo(0, -1.72, -1.12, -1.08); c.closePath(); FS(c, BLK, 0.05);
    c.beginPath(); c.moveTo(-1.0, -0.52); c.quadraticCurveTo(0, -0.84, 1.0, -0.52); c.lineTo(1.03, -0.72); c.quadraticCurveTo(0, -1.04, -1.03, -0.72); c.closePath(); FS(c, RED, 0.035);
    c.beginPath(); c.moveTo(-0.98, -0.5); c.quadraticCurveTo(0, -0.3, 0.98, -0.5); c.quadraticCurveTo(0, -0.74, -0.98, -0.5); c.closePath(); FS(c, '#111016', 0.04);
    emblem(c, 0, -1.12, 0.2);
  }
}
// B.U.N のしるし（金の輪に、赤いくちばしの三角）
export function emblem(c, x, y, r) { ell(c, x, y, r, r); FS(c, GOLD, 0.03); poly(c, [[x - r * 0.55, y - r * 0.4], [x + r * 0.55, y - r * 0.4], [x, y + r * 0.66]]); FS(c, BEAK, 0.02); }
// 体（胸・腹・脚・尾）。o: { harness }
function body(c, o = {}) {
  // 尾（黒いくさび。体のうしろ）
  poly(c, [[-0.26, 2.5], [0.26, 2.5], [0.5, 3.7], [0, 3.5], [-0.5, 3.7]]); FS(c, BLK);
  // 脚: 太いもも（灰）→ 細いすね（橙がかった桃色）→ 3 本指
  for (const s of [-1, 1]) {
    limb(c, [0.34 * s, 2.5], [0.42 * s, 3.0], 0.33, 0.24, GREY);
    limb(c, [0.42 * s, 3.05], [0.44 * s, 3.42], 0.085, 0.075, LEG);
    for (const k of [-1, 0, 1]) { c.beginPath(); c.moveTo(0.44 * s, 3.44); c.lineTo(0.44 * s + k * 0.2 + s * 0.04, 3.62); S(c, 0.085, LINE); S(c, 0.05, LEG); }
  }
  // 胴: 逆三角形
  c.beginPath(); c.moveTo(-1.02, 1.0); c.bezierCurveTo(-1.1, 1.5, -0.8, 2.1, -0.6, 2.62); c.quadraticCurveTo(0, 2.8, 0.6, 2.62); c.bezierCurveTo(0.8, 2.1, 1.1, 1.5, 1.02, 1.0); c.quadraticCurveTo(0, 0.6, -1.02, 1.0); c.closePath(); FS(c, GREY);
  // 腹（桃色がかった白）と腹筋
  c.beginPath(); c.moveTo(-0.46, 1.72); c.quadraticCurveTo(0, 1.6, 0.46, 1.72); c.bezierCurveTo(0.52, 2.1, 0.44, 2.45, 0.34, 2.66); c.quadraticCurveTo(0, 2.76, -0.34, 2.66); c.bezierCurveTo(-0.44, 2.45, -0.52, 2.1, -0.46, 1.72); c.closePath(); FS(c, BELLY, 0.035);
  c.beginPath(); c.moveTo(0, 1.68); c.lineTo(0, 2.7); for (const y of [1.98, 2.26, 2.5]) { c.moveTo(-0.42 + (y - 1.98) * 0.12, y); c.quadraticCurveTo(0, y + 0.05, 0.42 - (y - 1.98) * 0.12, y); } S(c, 0.03, BELLY_SH);
  // 胸筋
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0.03 * s, 1.02); c.quadraticCurveTo(0.6 * s, 0.86, 0.94 * s, 1.16); c.bezierCurveTo(1.0 * s, 1.5, 0.7 * s, 1.74, 0.36 * s, 1.72); c.quadraticCurveTo(0.08 * s, 1.7, 0.03 * s, 1.5); c.closePath(); FS(c, GREY_L, 0.04); c.beginPath(); c.arc(0.5 * s, 1.3, 0.3, 0.3, 1.5); S(c, 0.025, '#d7dbe4'); }
  if (o.harness) {
    c.beginPath(); c.moveTo(-0.9, 0.98); c.lineTo(0.42, 2.4); c.moveTo(0.9, 0.98); c.lineTo(-0.42, 2.4); S(c, 0.17, LINE); S(c, 0.11, BLK);
    c.beginPath(); c.moveTo(-0.6, 2.5); c.quadraticCurveTo(0, 2.62, 0.6, 2.5); S(c, 0.2, LINE); S(c, 0.14, BLK);
    emblem(c, 0, 1.68, 0.19);
  }
}
// 背中の噴射装置（体のうしろに少しはみ出して見える）
function jetpack(c, t = 0) {
  for (const s of [-1, 1]) {
    c.beginPath(); c.roundRect(0.62 * s - 0.24, 1.0, 0.48, 1.3, 0.14); FS(c, BLK); c.beginPath(); c.moveTo(0.62 * s - 0.2, 1.3); c.lineTo(0.62 * s + 0.2, 1.3); S(c, 0.07, RED);
    poly(c, [[0.62 * s - 0.2, 2.3], [0.62 * s + 0.2, 2.3], [0.62 * s + 0.14, 2.52], [0.62 * s - 0.14, 2.52]]); FS(c, '#4a4955', 0.035);
  }
}

// ---- 兵士（噴射装置で飛び、武器をこちらへ向ける）。o: { weapon: 'bazooka' | 'gatling', fire: 撃った瞬間 0..1, shades, mood }
export function trooper(c, o = {}) {
  const fire = o.fire || 0, gat = o.weapon === 'gatling';
  jetpack(c);
  body(c, { harness: true });
  if (gat) {
    // 両わきに構えた多銃身の機関砲
    for (const s of [-1, 1]) {
      arm(c, [1.05 * s, 1.22], [1.5 * s, 1.9], [1.05 * s, 2.3], 0.5, { bulge: s });
      ell(c, 1.05 * s, 2.36, 0.4, 0.4); FS(c, BLK); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ell(c, 1.05 * s + Math.cos(a) * 0.22, 2.36 + Math.sin(a) * 0.22, 0.085, 0.085); F(c, fire > 0.3 ? '#ffd9a0' : '#07070a'); }
      ell(c, 1.05 * s, 2.36, 0.07, 0.07); F(c, '#55535f');
      if (fire > 0.05) flash(c, 1.05 * s, 2.36, 0.55 * fire);
    }
  } else {
    // 肩にかついだ大砲（こちらを向いた筒の口）
    arm(c, [1.05, 1.22], [1.72, 1.1], [1.36, 0.4], 0.95, { bulge: -1 });                                                         // 向かって右は力こぶ
    c.beginPath(); c.moveTo(-0.9, 0.2); c.lineTo(-0.3, 0.9); c.lineTo(-0.7, 1.24); c.lineTo(-1.5, 0.5); c.closePath(); FS(c, '#3d3c47');     // 筒の胴（奥へのびる）
    arm(c, [-1.05, 1.22], [-1.72, 1.5], [-1.5, 0.84], 0.6, { bulge: 1 });
    ell(c, -1.36, 0.1, 0.56, 0.56); FS(c, BLK); ell(c, -1.36, 0.1, 0.42, 0.42); FS(c, '#3d3c47', 0.03); ell(c, -1.36, 0.1, 0.3, 0.3); F(c, fire > 0.3 ? '#ffd9a0' : '#0a0a0e');
    c.beginPath(); c.arc(-1.36, 0.1, 0.5, 0.4, 1.9); S(c, 0.06, RED);
    if (fire > 0.05) flash(c, -1.36, 0.1, 0.9 * fire);
  }
  head(c, { mood: o.mood || (fire > 0.3 ? 'shout' : 'angry'), shades: o.shades });
}
function flash(c, x, y, r) {
  c.save(); c.translate(x, y);
  c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, rr = i % 2 ? r * 0.5 : r * (1 + 0.25 * Math.sin(i * 2.3)); i ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); F(c, '#fff4c2'); S(c, 0.04, '#ffb23a');
  c.restore();
}
// ---- 機体から脱出したところ（力こぶのポーズで飛ばされていく）。o: { v: 0 = くやしがる, 1 = 泣く }
export function ejected(c, o = {}) {
  body(c, {});
  if (o.v) { arm(c, [-1.05, 1.22], [-1.75, 1.7], [-1.9, 2.5], 0.2, { bulge: 1 }); arm(c, [1.05, 1.22], [1.75, 1.7], [1.9, 2.5], 0.2, { bulge: -1 }); head(c, { mood: 'cry' }); }
  else { arm(c, [-1.05, 1.22], [-1.8, 1.02], [-1.42, 0.3], 1, { bulge: 1 }); arm(c, [1.05, 1.22], [1.8, 1.02], [1.42, 0.3], 1, { bulge: -1 }); head(c, { mood: 'shout' }); }
  // 汗
  for (const [x, y] of [[-1.0, -0.8], [1.1, -0.6]]) { c.beginPath(); c.moveTo(x, y - 0.2); c.bezierCurveTo(x + 0.16, y, x + 0.14, y + 0.16, x, y + 0.16); c.bezierCurveTo(x - 0.14, y + 0.16, x - 0.16, y, x, y - 0.2); FS(c, '#d9efff', 0.03, '#8fbfe6'); }
}
// 落下傘（黒に赤の帯）。原点が傘のまん中、下にひもがのびる
export function chute(c) {
  c.beginPath(); c.moveTo(-1.9, 0.2); c.bezierCurveTo(-1.8, -1.5, 1.8, -1.5, 1.9, 0.2); for (let i = 3; i >= -3; i -= 2) c.quadraticCurveTo((i + 1) * 0.63 - 0.63 + 0.3, -0.12, (i - 1) * 0.63 + 0.02, 0.2); c.closePath(); FS(c, BLK);
  c.save(); c.clip(); for (const x of [-1.26, 0, 1.26]) { c.beginPath(); c.moveTo(x * 0.2, -1.4); c.quadraticCurveTo(x * 0.9, -0.6, x, 0.3); S(c, 0.3, RED); } c.restore();
  for (const x of [-1.9, -0.63, 0.63, 1.9]) { c.beginPath(); c.moveTo(x, 0.2); c.lineTo(x * 0.14, 2.2); S(c, 0.025, '#55535f'); }
}
// ---- 隊長（旗艦の艦橋に立つ。帽子とマント）。o: { mood: 'smug' | 'shout' | 'shock' | 'cry' }
export function commander(c, o = {}) {
  const mood = o.mood || 'smug';
  // マント（外は黒、内は赤）
  c.beginPath(); c.moveTo(-1.1, 0.9); c.bezierCurveTo(-2.3, 1.6, -2.4, 3.0, -2.0, 3.9); c.lineTo(-0.9, 3.5); c.lineTo(0, 3.8); c.lineTo(0.9, 3.5); c.lineTo(2.0, 3.9); c.bezierCurveTo(2.4, 3.0, 2.3, 1.6, 1.1, 0.9); c.closePath(); FS(c, '#b3262c');
  c.beginPath(); c.moveTo(-1.1, 0.9); c.bezierCurveTo(-2.3, 1.6, -2.4, 3.0, -2.0, 3.9); c.lineTo(-1.5, 3.72); c.bezierCurveTo(-1.8, 3.0, -1.7, 1.9, -1.0, 1.3); c.closePath(); FS(c, BLK, 0.04);
  c.beginPath(); c.moveTo(1.1, 0.9); c.bezierCurveTo(2.3, 1.6, 2.4, 3.0, 2.0, 3.9); c.lineTo(1.5, 3.72); c.bezierCurveTo(1.8, 3.0, 1.7, 1.9, 1.0, 1.3); c.closePath(); FS(c, BLK, 0.04);
  body(c, { harness: false });
  if (mood === 'shout') { arm(c, [-1.05, 1.22], [-1.6, 1.9], [-1.2, 2.4], 0.4, { bulge: 1 }); arm(c, [1.05, 1.22], [1.9, 0.9], [2.5, 0.2], 0.5, { bulge: -1, noHand: true }); ell(c, 2.5, 0.2, 0.24, 0.22); FS(c, GREY_D); c.beginPath(); c.moveTo(2.6, 0.1); c.lineTo(3.0, -0.3); S(c, 0.16, LINE); S(c, 0.1, GREY_D); }   // 指をさす
  else if (mood === 'shock' || mood === 'cry') { arm(c, [-1.05, 1.22], [-1.9, 0.9], [-1.7, -0.1], 0.4, { bulge: 1 }); arm(c, [1.05, 1.22], [1.9, 0.9], [1.7, -0.1], 0.4, { bulge: -1 }); }      // 両手をあげる
  else {                                                                                                                             // 腕組み
    arm(c, [1.05, 1.22], [1.5, 1.95], [0.1, 1.9], 0.8, { bulge: -1, noHand: true }); arm(c, [-1.05, 1.22], [-1.5, 1.95], [-0.1, 1.72], 0.8, { bulge: 1, noHand: true });
    ell(c, 0.62, 1.72, 0.24, 0.2); FS(c, GREY_D); ell(c, -0.62, 1.94, 0.24, 0.2); FS(c, GREY_D);
  }
  // 肩章と胸のしるし
  for (const s of [-1, 1]) { c.beginPath(); c.roundRect(1.05 * s - 0.34, 0.82, 0.68, 0.2, 0.08); FS(c, GOLD, 0.035); }
  head(c, { mood, cap: true, scar: true });
}
export function setLine(k) { LW = k; }
