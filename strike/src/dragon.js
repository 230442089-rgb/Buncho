// dragon.js — ユリアの竜の姿（決め技のときだけ現れる）。いただいた絵をもとにした、白と金の長い竜。
//   頭・翼・光輪は 1 枚絵、胴は「帯」（道すじに沿って四角形をつないだもの）に、うろこの絵を貼る。
const TAU = Math.PI * 2;
const LINE = '#6b5a3a', WHITE = '#ffffff', SH = '#e6e2ee', GOLD = '#ffc93c', GOLD_D = '#e09a00', BLK = '#2b2a33', BLUE = '#4aa8ff', CYAN = '#7ff0ff';
const S = (c, w = 0.03, col = LINE) => { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); };
const F = (c, col) => { c.fillStyle = col; c.fill(); };
const FS = (c, col, w = 0.03, line = LINE) => { F(c, col); S(c, w, line); };
const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };
const blade = (c, x0, y0, x1, y1, w, col = GOLD) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w; poly(c, [[x0 + nx, y0 + ny], [x0 + dx * 0.45 + nx * 0.8, y0 + dy * 0.45 + ny * 0.8], [x1, y1], [x0 - nx, y0 - ny]]); FS(c, col, 0.028); };
const lock = (c, x0, y0, x1, y1, w, bend, tip = GOLD) => { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, mx = (x0 + x1) / 2 + nx * bend * L, my = (y0 + y1) / 2 + ny * bend * L; c.beginPath(); c.moveTo(x0 + nx * w, y0 + ny * w); c.quadraticCurveTo(mx + nx * w * 0.7, my + ny * w * 0.7, x1, y1); c.quadraticCurveTo(mx - nx * w * 0.7, my - ny * w * 0.7, x0 - nx * w, y0 - ny * w); c.closePath(); const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, WHITE); g.addColorStop(0.55, WHITE); g.addColorStop(1, tip); c.fillStyle = g; c.fill(); S(c, 0.024); };

// 頭（右向きの横顔。原点が首の付け根）
export function dragonHead(c) {
  // たてがみ（うしろへ流れる白い毛。先は金）
  for (const [x1, y1, w, b] of [[-1.85, -0.9, 0.22, 0.12], [-1.9, -0.3, 0.26, 0.1], [-1.8, 0.4, 0.24, -0.08], [-1.5, 0.95, 0.2, -0.12], [-1.5, -1.3, 0.18, 0.14]]) lock(c, -0.3, 0.0, x1, y1, w, b);
  // 金の角（冠のように、うしろ上へ何本ものびる）
  blade(c, 0.1, -0.5, -1.2, -1.75, 0.13); blade(c, 0.35, -0.55, -0.5, -1.9, 0.11); blade(c, -0.15, -0.4, -1.75, -1.2, 0.12); blade(c, 0.55, -0.5, 0.35, -1.5, 0.08);
  // 下あご
  c.beginPath(); c.moveTo(-0.2, 0.3); c.quadraticCurveTo(0.6, 0.62, 1.5, 0.9); c.quadraticCurveTo(0.9, 1.0, 0.2, 0.86); c.quadraticCurveTo(-0.3, 0.7, -0.2, 0.3); c.closePath(); FS(c, WHITE);
  // 口の中
  c.beginPath(); c.moveTo(-0.05, 0.22); c.lineTo(1.6, 0.2); c.lineTo(1.42, 0.86); c.quadraticCurveTo(0.6, 0.6, -0.05, 0.34); c.closePath(); F(c, '#1d6f7a'); c.beginPath(); c.ellipse(0.75, 0.5, 0.5, 0.1, 0.25, 0, TAU); F(c, '#53d6d2');
  // 上あご・頭
  c.beginPath(); c.moveTo(-0.6, -0.1); c.bezierCurveTo(-0.5, -0.62, 0.3, -0.72, 0.8, -0.5); c.quadraticCurveTo(1.4, -0.34, 1.86, -0.08); c.quadraticCurveTo(1.98, 0.08, 1.8, 0.2); c.lineTo(0.0, 0.26); c.quadraticCurveTo(-0.5, 0.34, -0.6, -0.1); c.closePath(); FS(c, WHITE);
  c.beginPath(); c.moveTo(0.2, 0.06); c.quadraticCurveTo(1.0, -0.02, 1.78, 0.1); S(c, 0.022, '#cfc7d8');
  // 歯
  for (let i = 0; i < 6; i++) { const x = 0.35 + i * 0.25; poly(c, [[x, 0.22], [x + 0.16, 0.22], [x + 0.08, 0.44]]); FS(c, WHITE, 0.018); }
  for (let i = 0; i < 4; i++) { const x = 0.5 + i * 0.24, y = 0.66 + i * 0.055; poly(c, [[x, y], [x + 0.14, y + 0.03], [x + 0.07, y - 0.2]]); FS(c, WHITE, 0.018); }
  // 鼻先の金、目（青く光る）、ほおの縫い目
  poly(c, [[1.5, -0.22], [1.9, -0.02], [1.6, -0.02]]); FS(c, GOLD, 0.02);
  c.beginPath(); c.moveTo(0.36, -0.36); c.quadraticCurveTo(0.72, -0.5, 1.0, -0.26); c.quadraticCurveTo(0.68, -0.16, 0.36, -0.36); c.closePath(); FS(c, BLK, 0.02);
  c.beginPath(); c.ellipse(0.7, -0.31, 0.15, 0.085, 0.1, 0, TAU); F(c, BLUE); c.beginPath(); c.ellipse(0.7, -0.31, 0.03, 0.08, 0.1, 0, TAU); F(c, '#0b2a55'); c.beginPath(); c.arc(0.64, -0.34, 0.025, 0, TAU); F(c, '#fff');
  blade(c, 0.3, -0.42, 0.95, -0.72, 0.06);
  for (const x of [-0.25, -0.05]) { c.beginPath(); c.moveTo(x - 0.07, 0.0); c.lineTo(x + 0.07, 0.0); c.moveTo(x, -0.09); c.lineTo(x, 0.09); S(c, 0.04, BLK); }
  // ひげ
  c.beginPath(); c.moveTo(1.6, 0.1); c.bezierCurveTo(1.9, 0.7, 1.3, 1.3, 1.7, 1.8); S(c, 0.05, LINE); S(c, 0.03, WHITE);
}
// 翼（原点が付け根の軸。右上へ広がる）
export function dragonWing(c) {
  // 風切り羽（金）→ 雨おおい羽（白）
  for (let i = 0; i < 9; i++) { const a = (-86 + i * 13) * Math.PI / 180, L = 1.92 - Math.abs(i - 3) * 0.09, x = Math.cos(a) * L, y = Math.sin(a) * L; lock(c, Math.cos(a) * 0.3, Math.sin(a) * 0.3, x, y, 0.2, 0.06, GOLD); }
  for (let i = 0; i < 8; i++) { const a = (-80 + i * 13.5) * Math.PI / 180, L = 1.2 - Math.abs(i - 3) * 0.05, x = Math.cos(a) * L, y = Math.sin(a) * L; lock(c, Math.cos(a) * 0.2, Math.sin(a) * 0.2, x, y, 0.17, 0.05, '#fff3c4'); }
  for (let i = 0; i < 5; i++) { const a = (-74 + i * 20) * Math.PI / 180; blade(c, Math.cos(a) * 0.2, Math.sin(a) * 0.2, Math.cos(a) * 0.86, Math.sin(a) * 0.86, 0.07, i % 2 ? BLK : GOLD); }
  // 軸（黒い円盤に金のふち、青い石）
  c.beginPath(); c.arc(0, 0, 0.36, 0, TAU); FS(c, BLK, 0.03); c.beginPath(); c.arc(0, 0, 0.36, 0, TAU); S(c, 0.06, GOLD);
  c.beginPath(); c.arc(0, 0, 0.19, 0, TAU); F(c, BLUE); c.beginPath(); c.arc(0, 0, 0.09, 0, TAU); F(c, '#0b2a55'); c.beginPath(); c.arc(-0.05, -0.06, 0.035, 0, TAU); F(c, '#fff');
  blade(c, -0.1, -0.3, 0.3, -1.3, 0.1); blade(c, 0.3, 0.1, 1.2, 0.5, 0.09);
}
// 胴の模様（n×n の正方形。上の辺が背。縦にくり返してもつながる）
export function dragonBody(c, n) {
  const k = n / 4;                                   // 4 単位ぶんを 1 ますに描く
  c.save(); c.scale(k, k);
  // 腹〜わきの白いうろこ
  c.beginPath(); c.rect(0.9, 0, 2.7, 4); F(c, WHITE);
  c.beginPath(); c.rect(3.2, 0, 0.4, 4); F(c, SH);
  for (let j = -1; j < 9; j++) for (let i = 0; i < 4; i++) { const x = 1.5 + i * 0.5 + (j % 2 ? 0.25 : 0), y = j * 0.5; c.beginPath(); c.arc(x, y, 0.3, 0.2, Math.PI - 0.2); S(c, 0.025, '#d0c8dc'); }
  for (let j = 0; j < 8; j++) { c.beginPath(); c.moveTo(3.2, j * 0.5 + 0.25); c.lineTo(3.6, j * 0.5 + 0.25); S(c, 0.025, '#c9c0d6'); }
  // 背の黒い帯と、金の刃・青い石
  c.beginPath(); c.rect(0.75, 0, 0.62, 4); F(c, BLK);
  for (let j = 0; j < 2; j++) { const y = j * 2 + 1;
    poly(c, [[0.8, y - 0.55], [0.02, y - 0.1], [0.8, y + 0.2]]); FS(c, GOLD, 0.03); poly(c, [[1.3, y - 0.9], [1.9, y - 0.2], [1.3, y - 0.1]]); FS(c, GOLD, 0.03);
    poly(c, [[0.8, y + 0.5], [0.3, y + 0.9], [0.8, y + 1.0]]); FS(c, GOLD_D, 0.03);
    c.beginPath(); c.ellipse(1.06, y + 0.35, 0.2, 0.3, 0, 0, TAU); FS(c, BLUE, 0.03, GOLD); c.beginPath(); c.ellipse(1.06, y + 0.35, 0.06, 0.2, 0, 0, TAU); F(c, '#0b2a55'); }
  // 縫い目のしるし（ユリアの髪留めと同じ形）
  for (const [x, y] of [[2.6, 0.9], [2.5, 2.9]]) for (const d of [0, 0.22]) { c.beginPath(); c.moveTo(x - 0.12, y + d); c.lineTo(x + 0.12, y + d); c.moveTo(x, y + d - 0.14); c.lineTo(x, y + d + 0.14); S(c, 0.06, BLK); }
  // 輪郭（左右の縁）
  c.beginPath(); c.moveTo(0.75, 0); c.lineTo(0.75, 4); c.moveTo(3.6, 0); c.lineTo(3.6, 4); S(c, 0.045, LINE);
  c.restore();
}
// 光輪（金の輪と、十字のきらめき）
export function dragonHalo(c) {
  for (const [w, a] of [[0.3, 0.12], [0.16, 0.3], [0.06, 1]]) { c.beginPath(); c.arc(0, 0, 1.55, 0, TAU); S(c, w, `rgba(255,214,90,${a})`); }
  c.beginPath(); c.arc(0, 0, 1.2, 0, TAU); S(c, 0.025, 'rgba(255,236,170,.7)');
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.6, x = Math.cos(a) * 1.55, y = Math.sin(a) * 1.55; c.save(); c.translate(x, y); c.rotate(a); poly(c, [[-0.32, 0], [0, 0.06], [0.32, 0], [0, -0.06]]); F(c, '#fff3c4'); poly(c, [[0, -0.2], [0.05, 0], [0, 0.2], [-0.05, 0]]); F(c, '#fff3c4'); c.restore(); }
}

// ---- 竜を描く（四角形をためる側: batch、絵: A = art.js の範囲）
//   pts: 頭から尾への点の列（世界座標）, cam: カメラ, a: 見える度合い, t: 時刻
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export function drawDragon(B, A, pts, cam, a, t, FX, size = 1) {
  const n = pts.length, col = [a, a, a, a], W = 0.62 * size;
  // カメラのすぐ前では細く・小さく（現れた瞬間に画面をふさがない）
  const near = (p) => { const d = dot(sub(p, cam.ro), cam.fwd), k = Math.min(1, Math.max(0, (d - 1.5) / 3.0)); return k * k * (3 - 2 * k); };
  const side = [], wid = [];
  for (let i = 0; i < n; i++) {
    const tan = norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]));
    let s = norm(cross(tan, sub(cam.ro, pts[i])));
    if (dot(s, cam.up) < 0) s = [-s[0], -s[1], -s[2]];                   // 画面の上側を「背」にそろえる
    side.push(s);
    const u = i / (n - 1); wid.push(W * Math.min(1, 0.55 + u * 4) * Math.pow(1 - Math.max(0, u - 0.55) / 0.45, 0.8) * near(pts[i]));
  }
  const [u0, v0, u1, v1] = A.dBody;
  // 胴（尾から頭へ。奥のものから先に描かれるよう、ためてから並べかえるのは batch に任せる）
  for (let i = 0; i + 1 < n; i++) {
    const p0 = pts[i], p1 = pts[i + 1], s0 = side[i], s1 = side[i + 1], w0 = wid[i], w1 = wid[i + 1];
    // 四隅: 背側が絵の左（u0）。v は節ごとに行って戻る（継ぎ目が合うように）
    const va = i % 2 ? v1 : v0, vb = i % 2 ? v0 : v1;
    if (w0 + w1 < 1e-3) continue;
    B.quadUV(add(p0, s0, w0), add(p0, s0, -w0 * 0.9), add(p1, s1, -w1 * 0.9), add(p1, s1, w1), [[u0, va], [u1, va], [u1, vb], [u0, vb]], col, 1, 0);
  }
  // 光輪（頭のうしろ）
  const head = pts[0], dir = norm(sub(pts[0], pts[2])), nh = near(pts[0]), hs = 1.5 * size * nh;
  if (nh < 0.02) return;
  B.billboard(add(head, dir, -0.4 * size), hs * 1.5, hs * 1.5, A.dHalo, [a * 0.9, a * 0.9, a * 0.7, 0], 1, 1, t * 0.4, 0.3);
  // 翼（肩のあたり。はばたく）
  const sh = pts[Math.min(n - 1, 4)], sr = cam.right, flap = Math.sin(t * 5.5);
  for (const sgn of [-1, 1]) {
    const R = [sr[0] * sgn, sr[1] * sgn, sr[2] * sgn], ws = 2.6 * size * near(sh), ang = (0.25 + 0.35 * flap) * sgn;
    if (ws < 0.02) continue;
    const c0 = Math.cos(ang), s0 = Math.sin(ang), Rr = add([R[0] * c0, R[1] * c0, R[2] * c0], cam.up, s0 * sgn), Uu = add([cam.up[0] * c0, cam.up[1] * c0, cam.up[2] * c0], R, -s0 * sgn);
    const ctr = add(add(sh, Rr, ws * 0.2), Uu, ws * 0.17);                   // 絵の中での付け根の位置（ますの中心から左下）に合わせる
    B.oriented(ctr, Rr, Uu, ws * 0.35, ws * 0.35, A.dWing, col, 1, 0, 0.2);
  }
  // 頭（進む向きが画面の左なら、絵を裏返す）
  const sx = dot(dir, cam.right), sy = dot(dir, cam.up), ang = Math.atan2(sy, Math.abs(sx)), flip = sx < 0 ? -1 : 1;
  const [hu0, hv0, hu1, hv1] = A.dHead, uv = flip > 0 ? [hu0, hv0, hu1, hv1] : [hu1, hv0, hu0, hv1];
  B.billboard(add(head, dir, 0.5 * size), hs, hs, uv, col, 1, 0, ang * flip, -0.3);
  // 口もとの光
  if (FX) B.billboard(add(head, dir, 1.6 * size * nh), 0.9 * size * nh, 0.9 * size * nh, FX.glow, [a, 0.86 * a, 0.45 * a, 0], 0, 1, 0, -0.4);
}
