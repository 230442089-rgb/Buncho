// ================= 「外神竜に会いに行こう」：場面（ユニット）と重ね描き =================
// 時刻はすべてムービー全体の秒（0〜60）。f はコマ番号（f/30 秒）。字の出入りはコマで決める。
// 台詞・地の文・札の字は shuken/index.html の字のまま（行番号はコメント）。正典にない字は題字「外神竜に会いに行こう」だけ。
let AD_T = 0, AD_F = 0;
const GS = {};
const GS_END0 = 59.6, GS_END1 = 1799 / 30;   // 59.60 から黒へ（最後のコマ f1799 は黒）
const GS_FONTS = [
  ['900 34px "Zen Kaku Gothic New"', '春日井　外神竜一族の街高蔵寺の丘ユリア'],
  ['700 30px "Zen Kaku Gothic New"', '陽盾警備保障赤嶺重工結電工転星救急機構ネムリア・エンタテインメント「はーい、陽盾でーす♪」…下空けて私持つから。ただの電気の点検いっちばーん！にあねむいただいま全員無事おかえりぃ♡はい来週また行きますTHE OUTER DRAGON FAMILY主家長女次女三女四女五女六女（血筋は親戚）レウネの妹テルエスの姉アセラの姉エデルの妹母根源'],
  ['800 76px "Shippori Mincho B1"', 'ユリアザイナ燐アセラニルメヴォルルリカミリアテルエスレウネエデルフルル外神竜一族春日井主家彼女たちもまた人間が好きだ。その庇護は優しく重い。～に会いに行こう主権留保'],
];

// ---------- 舞台の道具 ----------
const gsPG = (o, w, h) => o.geometry.type === 'PlaneGeometry' && Math.abs(o.geometry.parameters.width - w) < 1e-3 && Math.abs(o.geometry.parameters.height - h) < 1e-3;
const gsBX = (o, w, h, d) => o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.width - w) < 1e-3 && Math.abs(o.geometry.parameters.height - h) < 1e-3 && Math.abs(o.geometry.parameters.depth - d) < 1e-3;
function gsHide(a, test) { let n = 0; a.g.traverse(o => { if (o.isMesh && o.geometry && test(o)) { o.visible = false; n++; } }); return n; }
const gsK = (f, f0, f1, ez = EZ.ios) => ez((f - f0) / (f1 - f0));
function gsCam(p, l, fov) { adCam(p, l); adFov(fov); }
const _gsV = new THREE.Vector3();
function gsProj(x, y, z) { camera.updateMatrixWorld(); _gsV.set(x, y, z).project(camera); return { x: (_gsV.x + 1) * 960, y: (1 - _gsV.y) * 540, ok: _gsV.z > -1 && _gsV.z < 1 }; }
// 駅前：映さない四枚（JR の駅名の看板・電光掲示とその枠・「市営バス」）を消し、浅井を隠し、陽盾の広告の板を返す
function gsStation(a) {
  a.asai.hidden = true; a.asai.follow = false;
  const n = gsHide(a, o => gsPG(o, 9, 1.3) || gsPG(o, 9.8, 0.66) || gsBX(o, 10.2, 0.9, 0.3) || gsPG(o, 1.2, 0.6)); if (n !== 4) throw new Error('station boards hidden: ' + n);
  let bd = null; a.g.traverse(o => { if (o.isMesh && o.material && o.material.map === adTex) bd = o; }); if (!bd) throw new Error('no billboard'); return bd;
}
// キー [t, 値, 傾き（毎秒）] を通る三次の Hermite（区間ごと）
function gsHerm(K, t) { if (t <= K[0][0]) return K[0][1]; for (let i = 0; i < K.length - 1; i++) { const [t0, v0, m0] = K[i], [t1, v1, m1] = K[i + 1]; if (t <= t1) { const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s; return (2 * s3 - 3 * s2 + 1) * v0 + (s3 - 2 * s2 + s) * h * m0 + (-2 * s3 + 3 * s2) * v1 + (s3 - s2) * h * m1; } } return K[K.length - 1][1]; }
function gsHerm3(p0, m0, p1, m1, s) { const s2 = s * s, s3 = s2 * s, a = 2 * s3 - 3 * s2 + 1, b = s3 - 2 * s2 + s, c = -2 * s3 + 3 * s2, d = s3 - s2; return p0.map((v, i) => a * v + b * m0[i] + c * p1[i] + d * m1[i]); }
// 三点を通るなめらかな道（Catmull-Rom、端は折れ線の向き）。u は 0〜2
function gsSpline3(P, u) { const seg = u < 1 ? 0 : 1, s = u < 1 ? u : u - 1; const A = P[seg], B = P[seg + 1];
  const mA = seg === 0 ? P[1].map((v, i) => v - P[0][i]) : P[2].map((v, i) => (v - P[0][i]) / 2), mB = seg === 0 ? P[2].map((v, i) => (v - P[0][i]) / 2) : P[2].map((v, i) => v - P[1][i]);
  const s2 = s * s, s3 = s2 * s, h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2; return A.map((v, i) => h00 * v + h10 * mA[i] + h01 * B[i] + h11 * mB[i]); }

// ---------- 字 ----------
// 台詞の字（下の中央）。f_in は現れはじめ、f_out は消えきるコマ
function gsSub(c, t, fi, fo, s, o = {}) {
  const t0 = fi / 30, t1 = fo / 30; if (t < t0 || t > t1) return;
  const inD = o.inD ?? 0.2, outD = o.outD ?? 0.2, rise = o.rise ?? 6;
  const ki = adK(t, t0, t0 + inD, EZ.oc), a = Math.min(ki, 1 - adK(t, t1 - outD, t1)); const y = (o.y ?? 975) + rise * (1 - ki);
  const st = { family: o.family ?? 'Zen Kaku Gothic New', weight: o.weight ?? 700, size: o.size ?? 56, fill: o.fill ?? '#FFFFFF', stroke: o.stroke ?? '#0C0A10', sw: o.sw ?? 8, shadow: { col: 'rgba(0,0,0,0.35)', dy: 3 }, alpha: a };
  if (o.runs) { gsRuns(c, o.runs, Object.assign(st, { x: 960, y })); return; }
  if (o.pop) { const p = 1 + 0.1 * (1 - adK(t, t0, t0 + 4 / 30)); c.save(); c.translate(960, y); c.scale(p, p); adText(c, s, Object.assign(st, { x: 0, y: 0 })); c.restore(); return; }
  adText(c, s, Object.assign(st, { x: 960, y }));
}
// 書体の違う字をつないで一行に（Zen Kaku Gothic New に「～」がないので、その字だけ明朝で描く）。影→縁→塗りを全体で一回ずつ
function gsRuns(c, runs, o) {
  const { x, y, size, fill, stroke, sw, shadow, alpha } = o; if (alpha <= 0.001) return;
  const it = []; let W = 0; c.save();
  for (const r of runs) { c.font = `${r.weight} ${size}px "${r.family}"`; const fnt = c.font; for (const ch of [...r.s]) { const w = c.measureText(ch).width; it.push({ ch, fnt, w }); W += w; } }
  c.globalAlpha = adClamp(alpha); c.textBaseline = 'middle'; c.textAlign = 'left'; c.lineJoin = 'round'; const x0 = x - W / 2;
  const pass = fn => { let cx = x0; for (const q of it) { c.font = q.fnt; fn(q.ch, cx); cx += q.w; } };
  if (shadow) { c.save(); c.fillStyle = shadow.col; c.translate(shadow.dx || 0, shadow.dy || 0); pass((ch, cx) => c.fillText(ch, cx, y)); c.restore(); }
  if (stroke && sw) { c.lineWidth = sw; c.strokeStyle = stroke; pass((ch, cx) => c.strokeText(ch, cx, y)); }
  c.fillStyle = fill; pass((ch, cx) => c.fillText(ch, cx, y)); c.restore();
}
// 右上の名札：暗い板＋左に会社の色の縦帯＋二行（会社名／名前）。右から 24px すべり込み、二行目は 2 コマ遅れ
function gsCard(c, t, o) {
  const t1 = o.f1 / 30, t2 = o.f2 / 30, te = o.fo / 30; if (t < t1 || t > te) return;
  const x0 = o.x0 ?? 1372, x1 = 1840, y0 = 176, y1 = 330; const fo = 1 - adK(t, te - 0.2, te);
  const k1 = adK(t, t1, t1 + 0.25, EZ.oc), k2 = adK(t, t2, t2 + 0.25, EZ.oc), dx = 24 * (1 - k1);
  c.save(); c.globalAlpha = adClamp(k1 * fo); c.fillStyle = 'rgba(10,13,22,0.82)'; c.fillRect(x0 + dx, y0, x1 - x0, y1 - y0); c.fillStyle = o.col; c.fillRect(x0 + dx, y0, 8, y1 - y0); c.restore();
  adText(c, o.l1, { x: x0 + 36 + dx, y: y0 + 42, size: 30, family: 'Zen Kaku Gothic New', weight: 700, align: 'left', fill: o.tcol, track: 3.6, alpha: k1 * fo });
  adText(c, o.l2, { x: x0 + 36 + 24 * (1 - k2), y: y0 + 108, size: 76, family: 'Shippori Mincho B1', weight: 800, align: 'left', fill: '#FFFFFF', alpha: k2 * fo });
}
// 場所の札（左寄せ、下地なし）
function gsPlace(c, t, fi, fo, s, o) {
  const t0 = fi / 30, t1 = fo / 30; if (t < t0 || t > t1) return; const ki = adK(t, t0, t0 + (o.inD ?? 0.35), EZ.oc); const a = Math.min(ki, 1 - adK(t, t1 - (o.outD ?? 0.25), t1));
  adText(c, s, { x: o.x ?? 110, y: o.y + (o.rise ?? 0) * (1 - ki), size: o.size, family: o.family, weight: o.weight, align: 'left', fill: o.fill, track: o.track ?? 0, shadow: o.shadow, alpha: a });
}
// 加算の放射グラデーション（朝日・画面の光）
function gsGlowAt(c, x, y, r, rgb, a) { if (a <= 0.001) return; c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.28, `rgba(${rgb},${a * 0.42})`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); c.restore(); }
// 朝日：丘の肩（登りのあいだ）と丘の縁のうち画面で高いほうを地平とし、その下は 3 割の強さ。日が地平の下にあるときは地平の上ににじませる
function gsSunGlow(c, g) { if (g <= 0.001) return; const sp = gsProj(40, 10, -180); if (!sp.ok) return; const cp = camera.position; let hy = 1080;
  if (cp.z > 14.6) { const q = gsProj(cp.x + (40 - cp.x) * (cp.z - 14.5) / (cp.z + 180), 1.25, 14.5); if (q.ok) hy = Math.min(hy, q.y); }
  const e = gsProj(6.5, 0, -29.3); if (e.ok) hy = Math.min(hy, e.y); const cy = Math.min(sp.y, hy), k = sp.y > hy ? 0.75 : 1;
  c.save(); c.beginPath(); c.rect(0, 0, 1920, Math.max(0, hy)); c.clip(); gsGlowAt(c, sp.x, cy, 720, '255,226,180', g * k); c.restore();
  if (hy < 1080) { c.save(); c.beginPath(); c.rect(0, hy, 1920, 1080 - hy); c.clip(); gsGlowAt(c, sp.x, cy, 720, '255,226,180', g * k * 0.3); c.restore(); } }
function gsAdd(c, rgb, a) { if (a <= 0.001) return; c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(${rgb},${a})`; c.fillRect(0, 0, 1920, 1080); c.restore(); }

// ================= U1　春日井駅前（朝）f0–f199 =================
adScene('u1', { t0: 0, t1: 199 / 30,
  async setup() { await goCine30('station'); await fade(false); const a = AREAS.station; GS.a = a; GS.board = gsStation(a);
    adSky(0xBFD4E8, 40, 120, 0.62); sun.intensity = 0.55; sun.color.setHex(0xFFFFFF);
    const gl = glowSprite(0xFFF4C8, 8.5, 0); gl.position.set(-8.5, 6.8, -10.7); adAdd(a.g, gl); GS.glow = gl; },
  update(t) { const f = Math.round(t * 30);
    const k = adClamp((f - 2) / 6); GS.board.material.color.setRGB(k, k, k);   // f0–f2 は消えている、f3–f8 で点く
    GS.glow.material.opacity = f < 3 ? 0 : f <= 5 ? 0.55 * (f - 3) / 2 : 0.55 * adClamp((14 - f) / 9);
    if (f < 18) gsCam([-7.9, 6.5, -4.6], [-8.5, 6.8, -11.0], 40);
    else if (f < 100) adCamK(gsK(f, 18, 100), [-7.9, 6.5, -4.6], [-8.5, 6.8, -11.0], [-3.4, 1.7, 3.8], [-7.8, 4.9, -11.0], 40, 46);
    else adCamK(gsK(f, 100, 199), [-9.6, 2.1, 1.8], [-11.6, 2.35, -1.88], [-10.2, 2.25, 0.7], [-11.6, 2.4, -1.88], 38, 38); },
  draw(c, t) { const f = Math.round(t * 30);
    if (f >= 3 && f <= 8) { const p = gsProj(-8.5, 6.8, -10.98); gsGlowAt(c, p.x, p.y, 900, '255,236,196', 0.32 * Math.min(adClamp((f - 2) / 3), adClamp((9 - f) / 4))); }
    adVignette(c, f < 100 ? 0.25 : 0.2); adGrain(c, f, 0.02);
    if (f >= 30 && f <= 97) { const a = Math.min(adK(t, 1.0, 1.35, EZ.oc), 1 - adK(t, 97 / 30 - 0.25, 97 / 30)); c.save(); c.font = '900 34px "Zen Kaku Gothic New"'; const W = [...'春日井　外神竜一族の街'].reduce((q, ch) => q + c.measureText(ch).width, 0) + 10.2 * 10; c.globalAlpha = adClamp(a); c.fillStyle = 'rgba(10,13,22,0.55)'; c.fillRect(80, 904, W + 60, 72); c.restore(); }
    gsPlace(c, t, 30, 97, '春日井　外神竜一族の街', { y: 940, size: 34, family: 'Zen Kaku Gothic New', weight: 900, fill: '#F4F1EA', track: 10.2, shadow: { col: 'rgba(0,0,0,0.55)', blur: 10 } });   // L377
  } });

// ================= U2　十二の仕事場から五人 f199–f794 =================
// 結電工の電線と網：17.394–18.105 だけ光らせる（4 コマで上げ下げ）
const gsRinK = t => t < 17.394 || t > 18.105 ? 0 : Math.min(adK(t, 17.394, 17.527), 1 - adK(t, 17.972, 18.105));
adScene('u2', { t0: 199 / 30, t1: 794 / 30,
  async setup() { await goCine30('works'); await fade(false); const a = AREAS.works; GS.a = a; const by = {}; for (const n of a.npcs) by[n.key] = n; GS.by = by;
    adSky(0xB8C8DC, 40, 110, 0.66); sun.intensity = 0.5; sun.color.setHex(0xFFFFFF);
    // 赤嶺：鋼材を運ぶ文鳥はザイナの後ろの道へ
    for (let i = 0; i < 5; i++) { const n = by['zb' + i], z = -7.0 - 0.6 * (i % 2); n.path = [[85 + 0.6 * i, z], [91.2, z]]; n.pi = 1; n.goal = null; n.wait = 0; n.pos.set(85.5 + 2.4 * i, 0, z); n.hidden = i >= 3; }
    // 転星：アセラは道を外し、s07 で毎コマ位置を与える
    const as = a.sis.asela; as.path = null; as.goal = null; as.pos.set(430, 0, 5.0); as.facing = Math.PI / 2; as.st = { run: true };
    a.sis.nirume.y = 0.95;   // クッションに沈まない高さ
    a.sis.nirume.facing = 1.6;   // 寝転んだ顔がカメラの側を向くように（本編の −1.6 では頭の後ろしか映らない）
    by.nb1.hidden = true;        // ニルメの頭の後ろに重なる警備の文鳥
    by.fan07.hidden = true;      // 高いカメラからニルメの頭の後ろに重なる客
    a.g.traverse(o => { if (o.isMesh && o.geometry && gsPG(o, 5, 2.8) && Math.abs(o.position.x - 5) < 0.01) GS.holo = o; }); if (!GS.holo) throw new Error('no holo');
    for (let r = 1; r <= 2; r++) for (let k = 0; k < 8; k++) by['fan' + r + k].hidden = true;   // 観客は奥の一列だけ
    const c0 = new THREE.Color(0x2A2A2A), c1 = new THREE.Color(0x60FFC0), cw = new THREE.Color();
    adTickPost(a, () => { const k = gsRinK(AD_T); cw.copy(c0).lerp(c1, k); a.wires.forEach(m => m.material.color.copy(cw)); a.dome.material.opacity = 0.45 * k; }); },
  update(t) { const f = Math.round(t * 30), a = GS.a, by = GS.by;
    for (let i = 0; i < 6; i++) by['yg' + i].hidden = f >= 298;   // ユリアの寄りの前を横切らない
    a.sis.yuria.pos.set(0, 0, f < 298 ? 6.8 : 1.5);                 // s03 では行進の列の手前に立つ（切り替えで本編の位置へ）
    GS.holo.material.opacity = f >= 298 && f < 397 ? 0.2 : 0.8;     // s04：名札と金の字が重ならないよう立体映像を薄く
    if (f === 539) a.sis.rin.model.nod = 0.6;
    const ax = 430.0 + 5.8 * (t - 596 / 30);
    if (f >= 596 && f < 695) { const as = a.sis.asela; as.pos.set(ax, 0, 5.0); as.facing = Math.PI / 2; as.extMove = true; }
    if (f < 298) adCamK(gsK(f, 199, 298), [-8.5, 9.5, 20.0], [-1.0, 2.6, -3.5], [-6.5, 6.0, 15.5], [-0.5, 2.3, -3.5], 40, 40);          // s03 陽盾 本社前
    else if (f < 397) adCamK(gsK(f, 298, 397), [-0.35, 1.78, 4.6], [0.15, 1.6, 1.5], [-0.2, 1.75, 4.2], [0.15, 1.6, 1.5], 34, 34);      // s04 ユリア
    else if (f < 497) adCamK(gsK(f, 397, 497), [86.6, 1.55, 5.0], [87.0, 2.1, 0.0], [86.8, 1.6, 4.5], [87.0, 2.12, 0.0], 40, 40);       // s05 ザイナ（鋼材は本編の高さ。低すぎると手と鋼材の間が見えるので少し上から）
    else if (f < 538) gsCam([224.0, 1.6, 9.5], [219.4, 4.4, -2.0], 54);                                                                  // s06 電線と燐
    else if (f < 561) adCamK(gsK(f, 538, 561), [224.0, 1.6, 9.5], [219.4, 4.4, -2.0], [224.4, 1.35, 6.2], [223.0, 1.6, 3.0], 54, 44);
    else if (f < 596) adCamK(gsK(f, 561, 596), [224.4, 1.35, 6.2], [223.0, 1.6, 3.0], [224.2, 1.35, 5.9], [223.0, 1.6, 3.0], 44, 44);
    else if (f < 695) gsCam([ax + 2.0, 1.2, 9.4], [ax - 0.2, 0.88, 1.0], 40);                                                            // s07 アセラを追う
    else adCamK(gsK(f, 695, 794), [366.4, 2.8, 7.2], [362.6, 1.0, 2.8], [363.8, 3.2, 5.4], [362.8, 1.0, 3.0], 38, 40); },              // s08 ニルメ
  draw(c, t) { const f = Math.round(t * 30);
    gsAdd(c, '96,255,192', 0.14 * gsRinK(t));
    adVignette(c, 0.22); adGrain(c, f, 0.02);
    gsCard(c, t, { f1: 303, f2: 305, fo: 393, col: '#E3B428', tcol: '#E3B428', l1: '陽盾警備保障', l2: 'ユリア' });
    gsSub(c, t, 312, 394, '「はーい、陽盾でーす♪」');                                   // L7242
    gsCard(c, t, { f1: 403, f2: 405, fo: 492, col: '#C0394B', tcol: '#E8687A', l1: '赤嶺重工', l2: 'ザイナ' });
    gsSub(c, t, 409, 493, '「……下、空けて。私、持つから。」');                           // L4619
    gsCard(c, t, { f1: 503, f2: 505, fo: 591, col: '#3FA37F', tcol: '#6FD3AF', l1: '結電工', l2: '燐' });
    gsSub(c, t, 532, 595, '「ただの電気の点検。」');                                     // L5203
    gsCard(c, t, { f1: 602, f2: 604, fo: 690, col: '#D9602E', tcol: '#F08A5A', l1: '転星救急機構', l2: 'アセラ' });
    gsSub(c, t, 611, 691, '「いっちばーん！」', { size: 62, pop: true });                  // L1261 の一文目
    gsCard(c, t, { f1: 701, f2: 703, fo: 789, col: '#E889AE', tcol: '#F4B0CC', l1: 'ネムリア・エンタテインメント', l2: 'ニルメ', x0: 1290 });
    gsSub(c, t, 706, 790, '「……にあ、ねむい……。」');                                   // L1253
  } });

// ================= U3　高蔵寺の丘 f794–f1366 =================
// 登り：丘の肩を越えると、29.80（f894）に十二人が朝日を背に見える
// カメラの高さ：頭の先が肩を越えるのは y≈1.13–1.15、肩 1.21、足元 1.40–1.42（z≈16.5 で計算）。f893 は 1.11 で全員隠れ、f894 で頭、f900 で足元まで
const GS_CY = [[794 / 30, 0.40, 0], [28.5, 0.83, 0.15], [29.35, 1.00, 0.25], [893 / 30, 1.11, 1.2], [29.80, 1.19, 2.0], [30.00, 1.43, 0.9], [30.60, 1.80, 0.45], [33.10, 2.55, 0]];
const GS_CZ = [[794 / 30, 19.6, -1.0], [29.80, 16.5, -0.75], [33.10, 15.2, 0]];
function gsClimb(t) { const T0 = 794 / 30, w = 1 - adK(t, 29.0, 29.45, EZ.ios);
  const y = gsHerm(GS_CY, t) + 0.045 * w * Math.sin(2 * Math.PI * (t - T0) / 0.8275), z = gsHerm(GS_CZ, t);   // 拍に合わせた歩みの上下
  const k = EZ.ios((t - 29.25) / 0.70), up = 0.6 * adK(t, 29.9, 30.3, EZ.ios) * Math.max(0, y - 1.43);   // 見下ろす向きは 29.95 までに決め、そのあとは高さに合わせて上げる（地平が戻らない）
  return [[0, y, z], [adLerp(2.0, 0.0, k), adLerp(2.4, 1.45, k) + up, adLerp(-2.0, -1.0, k)], adLerp(42, 40, EZ.ios((t - 29.8) / 3.3))]; }
// 弧の内側を回りこむ：弧の点 P と、P から (0, 8) への向き n。カメラは P + 5.2n（高さ 1.5）、注視は (P.x, 1.25, P.z)
function gsArc(u) { const ang = -1.15 + 2.3 * u, x = Math.sin(ang) * 9, z = -Math.cos(ang) * 4 + 1; const dx = -x, dz = 8 - z, L = Math.hypot(dx, dz); return { x, z, nx: dx / L, nz: dz / L }; }
function gsRoll(u) { const p = gsArc(u); return [[p.x + p.nx * 5.2, 1.5, p.z + p.nz * 5.2], [p.x, 1.25, p.z]]; }
const gsU11 = t => { const x = adClamp((t - 993 / 30) / ((1241 - 993) / 30)); const e = x < 0.9 ? 1.0526 * x : 0.9474 + 0.0526 * (1 - Math.pow(1 - (x - 0.9) / 0.1, 2)); return -0.04 + 1.04 * e; };   // 終わりの 1 割でフルルの前に止まる
// 頭の上の名札：続柄（REL L1206）と名前。名前の色は SPK（L647）
const GS_HILL = [['yuria', 'ユリア', '#F2C230', 1006, 1050], ['vol', 'ヴォル', '#7FAEE0', 1006, 1060], ['zaina', 'ザイナ', '#E06070', 1010, 1078], ['rurika', 'ルリカ', '#9A94F0', 1030, 1098], ['miria', 'ミリア', '#A8D84A', 1051, 1119], ['rin', '燐', '#5FC39F', 1072, 1140],
  ['terues', 'テルエス', '#F0A050', 1092, 1160], ['reune', 'レウネ', '#4ECEA8', 1113, 1181], ['nirume', 'ニルメ', '#F0A0C0', 1133, 1201], ['edel', 'エデル', '#B0A8D8', 1154, 1223], ['asela', 'アセラ', '#F08050', 1175, 1248], ['furuuru', 'フルル', '#F0B0C8', 1195, 1260]];   // カメラの u が u_i±0.15 にある間（ユリアとヴォルは場所の札が消えてから、読む長さが足りるよう少し長く）
const GS_BIRDS = [[-60, 460, 40, 0.0], [-190, 530, 34, 0.6], [-120, 400, 46, 1.2]];   // 出の x, y, 幅, 遅れ
adScene('u3', { t0: 794 / 30, t1: 1366 / 30,
  async setup() { await goCine30('family'); await fade(false); const a = AREAS.family; GS.a = a; GS.fam = {}; for (const n of a.fam) GS.fam[n.key.slice(2)] = n;
    adSky(0xE8C8B0, 30, 120, 0.52); sun.intensity = 0.4; sun.color.setHex(0xFFFFFF);
    // 登りのあいだ一族を隠す、丘と同じ色の低い肩
    const kn = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshLambertMaterial({ color: 0x6A9A6A })); kn.scale.set(16, 1.25, 2.6); kn.position.set(0, 0, 14.5); adAdd(a.g, kn);
    { const nm = kn.geometry.attributes.normal; for (let i = 0; i < nm.count; i++) nm.setXYZ(i, 0, 1, 0); nm.needsUpdate = true; }
    // s11 の終わりの速さ（s12 の頭へなめらかに渡す）
    const ta = 1240 / 30, tb = 1241 / 30, A0 = gsRoll(gsU11(ta)), B0 = gsRoll(1); GS.vP = B0[0].map((v, i) => (v - A0[0][i]) * 30); GS.vL = B0[1].map((v, i) => (v - A0[1][i]) * 30); GS.r1 = B0; void tb; },
  update(t) { const f = Math.round(t * 30);
    if (f < 993) { const C = gsClimb(t); gsCam(C[0], C[1], C[2]); }                                    // s09–s10
    else if (f < 1241) { const r = gsRoll(gsU11(t)); gsCam(r[0], r[1], 38); }                             // s11 名前の順送り
    else { const D = (1366 - 1241) / 30, s = adClamp((t - 1241 / 30) / D), e = EZ.ios(s);   // s12 昇る：はじめは s11 の終わりの速さと向きのまま（Hermite）
      const p = gsHerm3(GS.r1[0], GS.vP.map(v => v * D), [0, 9.5, 23.0], [0, 0, 0], s), l = gsHerm3(GS.r1[1], GS.vL.map(v => v * D), [4.0, 2.8, -37.0], [0, 0, 0], s); gsCam(p, l, adLerp(38, 48, e)); } },
  draw(c, t) { const f = Math.round(t * 30);
    // 朝日の光（区域の朝日の板 (40, 10, −180) を画面に写す）
    let g; if (t < 29.75) g = adLerp(0.20, 0.30, adK(t, 794 / 30, 29.75)); else if (f < 894) g = 0.30; else if (f === 894) g = 0.36; else if (t < 30.433) g = adLerp(0.42, 0.24, adK(t, 895 / 30, 30.433, EZ.ios)); else if (f < 1241) g = 0.24; else g = adLerp(0.24, 0.28, adK(t, 1241 / 30, 1366 / 30));
    gsSunGlow(c, g);
    if (t >= 29.8 && t < 30.4) gsAdd(c, '255,240,215', 0.10 * (1 - adK(t, 29.8, 30.4)));
    // 鳥の影（27.2〜29.0、左から右上へ）
    GS_BIRDS.forEach(([x0, y0, w, d], i) => { const k = (t - 26.7 - d) / 1.9; if (k < 0 || k > 1) return; adBird(c, adLerp(x0, 1990, k), adLerp(y0, y0 - 330, k) + Math.sin(k * 7 + i) * 8, w, 2 * Math.PI * 8 * t + i * 1.7, 'rgba(90,60,70,0.7)'); });
    adVignette(c, f < 894 ? 0.18 : f < 1241 ? 0.15 : 0.18); adGrain(c, f, 0.02);
    // 場所の札（L1519 の loc の三つの引数。一つ目は場所の部分だけ）
    const sh = { col: 'rgba(0,0,0,0.5)', blur: 12 };
    gsPlace(c, t, 804, 1006, '春日井　高蔵寺の丘', { y: 812, size: 30, family: 'Zen Kaku Gothic New', weight: 900, fill: '#F4F1EA', track: 9, shadow: sh, inD: 0.4, outD: 0.233 });
    gsPlace(c, t, 897, 1006, '外神竜一族', { y: 892, size: 96, family: 'Shippori Mincho B1', weight: 800, fill: '#FFFFFF', track: 9.6, shadow: sh, inD: 0.3, outD: 0.233, rise: 8 });
    gsPlace(c, t, 899, 1006, 'THE OUTER DRAGON FAMILY', { y: 964, size: 26, family: 'Zen Kaku Gothic New', weight: 700, fill: '#E8E2D8', track: 6.24, shadow: sh, inD: 0.3, outD: 0.233 });
    // 頭の上の名札
    for (const [k, nm, col, fi, fo] of GS_HILL) { if (f < fi || f > fo) continue; const n = GS.fam[k], a = Math.min(adK(t, fi / 30, fi / 30 + 0.2), 1 - adK(t, fo / 30 - 0.2, fo / 30)); const p = gsProj(n.pos.x, 2.35, n.pos.z); if (!p.ok) continue; const y = Math.max(p.y, 236);
      c.save(); c.font = '700 26px "Zen Kaku Gothic New"'; const w1 = [...REL[k]].reduce((q, ch) => q + c.measureText(ch).width, 0); c.font = '800 46px "Shippori Mincho B1"'; const w2 = [...nm].reduce((q, ch) => q + c.measureText(ch).width, 0); c.restore();
      const hw = Math.max(w1, w2) / 2 + 8, x = adClamp(p.x, 24 + hw, 1896 - hw);   // 字の箱は画面の中にとどめる
      adText(c, REL[k], { x, y: y - 116, size: 26, family: 'Zen Kaku Gothic New', weight: 700, fill: '#F4F1EA', stroke: '#2A2018', sw: 5, alpha: a });
      adText(c, nm, { x, y: y - 70, size: 46, family: 'Shippori Mincho B1', weight: 800, fill: col, stroke: '#1A1410', sw: 6, alpha: a }); }
    gsSub(c, t, 1253, 1366, '彼女たちもまた人間が好きだ。その庇護は優しく重い。', { family: 'Shippori Mincho B1', weight: 800, size: 54, sw: 7, inD: 0.4 });   // L1535 の前の二文
  } });

// ================= U4　主家の卓袱台 f1366–f1589 =================
// 娘たちが自分の席に現れるコマ（ユリアから燐までは正典の帰る順 L5216–5227。レウネは本編では「おかえりぃ♡」のあと L5245 に入るが、L5231 の「十人の娘たち」に合わせて最後の組に入れる。曲の C の部の四拍に 1・2・3・4 人）
const GS_ARR = { yuria: 1391, asela: 1415, vol: 1415, zaina: 1440, rurika: 1440, miria: 1440, rin: 1465, terues: 1465, nirume: 1465, reune: 1465 };
adScene('u4', { t0: 1366 / 30, t1: 1589 / 30,
  async setup() { await goCine30('shuke', [0, 999], 0); await fade(false); const a = AREAS.shuke; GS.a = a;
    for (const n of a.npcs) n.hidden = true;
    for (const k in a.fam) { const n = a.fam[k]; n.st = { sit: true }; n.lookAt = null; n.goal = null; n.hidden = k !== 'furuuru'; }
    adSky(0xF4E8D8, 20, 60, 0.68); sun.intensity = 0.36; sun.color.setHex(0xFFFFFF);
    // エデルの椀（L10086 と同じ小物）：席はなく、椀だけが湯気を立てている
    const es = new THREE.Group(); adAdd(a.g, es); block(0.3, 0.2, 0.5, 0xF4F0E8, 3.12, 0.62, 0, es); part(cyl(0.12, 0.1, 0.16, 10), 0xE8D8C0, 3.12, 0.7, 0.42, es); const st = glowSprite(0xFFFFFF, 0.5, 0.3); st.position.set(3.12, 1.0, 0); es.add(st);
    GS.steam = []; for (let i = 0; i < 6; i++) for (const z of [-0.6, 0.6]) { const s = glowSprite(0xFFFFFF, 0.35, 0); s.position.set(-2.6 + i * 1.04, 0.9, z); adAdd(a.g, s); GS.steam.push(s); } },
  update(t) { const f = Math.round(t * 30), a = GS.a;
    for (const k in GS_ARR) { const n = a.fam[k]; n.hidden = f < GS_ARR[k]; if (f === GS_ARR[k]) n.model.nod = 0.6; }
    if (f === 1393) a.fam.furuuru.model.nod = 0.4; if (f === 1497) a.fam.furuuru.model.nod = 0.6;
    GS.steam.forEach((s, i) => { const ph = ((t + i * 0.37) % 1.8) / 1.8; s.position.y = 0.9 + 0.4 * ph; s.material.opacity = 0.18 * Math.sin(Math.PI * ph); });
    if (f < 1490) adCamK(gsK(f, 1366, 1490), [0, 6.6, 4.4], [-1.0, 0.4, -0.6], [0, 7.4, 5.4], [-0.9, 0.4, -0.6], 46, 46);      // s13（L5207 の cine から少し引く：手前の列の頭が字にかからない）
    else adCamK(gsK(f, 1490, 1589), [0.8, 1.9, 0.0], [-3.9, 1.05, 0.0], [0.4, 1.85, 0.0], [-3.9, 1.05, 0.0], 44, 44); },       // s14 卓の端から：上座のフルルと、両側に座る娘たち
  draw(c, t) { const f = Math.round(t * 30);
    adVignette(c, f < 1490 ? 0.22 : 0.25, '60,30,10'); adGrain(c, f, 0.02);
    // 場所の札「春日井　主家」（L5207 の card の一つ目の引数）：左上の暗い板
    if (f >= 1369 && f <= 1484) { const t0 = 1369 / 30, t1 = 1484 / 30, a = Math.min(adK(t, t0, t0 + 0.35, EZ.oc), 1 - adK(t, t1 - 0.25, t1));
      c.save(); c.font = '800 58px "Shippori Mincho B1"'; const W = [...'春日井　主家'].reduce((s, ch) => s + c.measureText(ch).width, 0) + 5.8 * 5; c.globalAlpha = adClamp(a); c.fillStyle = 'rgba(10,13,22,0.55)'; c.fillRect(80, 70, W + 60, 96); c.restore();
      adText(c, '春日井　主家', { x: 110, y: 118, size: 58, family: 'Shippori Mincho B1', weight: 800, align: 'left', fill: '#FFFFFF', track: 5.8, alpha: a }); }
    // 話し手の札と台詞（L5216 の前の二文。「～」だけ明朝）
    { c.save(); let W = 0; for (const [s2, fam, wt] of [['「ただいま', 'Zen Kaku Gothic New', 700], ['～', 'Shippori Mincho B1', 800], ['！　全員、無事！」', 'Zen Kaku Gothic New', 700]]) { c.font = `${wt} 56px "${fam}"`; for (const ch of [...s2]) W += c.measureText(ch).width; } c.restore();
      const t0 = 1393 / 30, t1 = 1487 / 30; if (t >= t0 && t <= t1) { const ki = adK(t, t0, t0 + 0.2, EZ.oc), a = Math.min(ki, 1 - adK(t, t1 - 0.2, t1));   // 話し手の札：台詞の頭にそろえて左寄せ
        adText(c, 'ユリア', { x: 960 - W / 2 + 10, y: 902 + 6 * (1 - ki), size: 40, family: 'Zen Kaku Gothic New', weight: 900, align: 'left', fill: '#F2C230', stroke: '#0C0A10', sw: 7, alpha: a }); } }
    gsSub(c, t, 1393, 1487, '', { runs: [{ s: '「ただいま', family: 'Zen Kaku Gothic New', weight: 700 }, { s: '～', family: 'Shippori Mincho B1', weight: 800 }, { s: '！　全員、無事！」', family: 'Zen Kaku Gothic New', weight: 700 }] });
    gsSub(c, t, 1497, 1586, '「おかえりぃ♡」', { size: 68, y: 965, sw: 9, stroke: '#3A1E28', inD: 0.3, rise: 8 });   // L5229
  } });

// ================= U5　春日井駅前（夕方）と終わりの札 f1589–f1800 =================
const GS_W5 = [['w0', -6.5, -4.0, -1.2, -10.6, 1.4], ['w1', -8.5, -5.5, -0.6, -10.6, 1.5], ['w2', -5.0, -6.5, 0.0, -10.6, 1.3], ['w3', -7.2, -3.2, 0.6, -10.6, 1.45]];   // 駅の入口へ
const GS_C5 = { p: [[-4.2, 1.9, 1.5], [-3.0, 2.6, 4.6], [-2.2, 3.6, 4.9]], l: [[-8.2, 6.0, -11.0], [-7.4, 5.4, -11.0], [-6.0, 4.4, -11.0]], fov: [[44], [50], [54]] };
adScene('u5', { t0: 1589 / 30, t1: 60,
  async setup() { await goCine30('station'); await fade(false); const a = AREAS.station; GS.a = a; GS.board = gsStation(a); GS.board.material.color.setHex(0xFFFFFF);
    adSky(0xC8907C, 30, 110, 0.54); sun.intensity = 0.34; sun.color.setHex(0xFFB080);
    const by = {}; for (const n of a.npcs) by[n.key] = n; GS.by = by; for (const [k] of GS_W5) { by[k].path = null; by[k].goal = null; }
    let nd = 0; a.g.traverse(o => { if (o.isMesh && o.geometry && gsPG(o, 2.2, 1.6)) { GS.dir = o; nd++; } }); if (nd !== 1) throw new Error('directory board count ' + nd); },
  update(t) { const f = Math.round(t * 30);
    for (const [k, x0, z0, x1, z1, sp] of GS_W5) { const n = GS.by[k], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), q = adClamp((t - 1589 / 30) * sp / L); n.pos.set(x0 + dx * q, 0, z0 + dz * q); n.facing = Math.atan2(dx, dz); n.extMove = q < 1; n.hidden = q >= 1; }
    // s15 → s16：切らずに引き続ける（三点を通るなめらかな道。59.60 で止まる）
    const u = 2 * gsK(Math.min(f, 1788), 1589, 1788); gsCam(gsSpline3(GS_C5.p, u), gsSpline3(GS_C5.l, u), gsSpline3(GS_C5.fov, u)[0]);
    const kd = adK(t, 56.267, 56.8, EZ.ios), b = adLerp(1, 0.22, kd); GS.board.material.color.setRGB(b, b, b); const d2 = adLerp(1, 0.25, kd); GS.dir.material.color.setRGB(d2, d2, d2); },
  draw(c, t) { const f = Math.round(t * 30);
    adFill(c, 'rgb(90,50,80)', 0.16); adVignette(c, 0.3); adGrain(c, f, 0.02);
    gsSub(c, t, 1599, 1683, '「はい。来週、また行きます。」');   // L23103（話し手の名は出さない）
    if (t >= 56.267) { const kd = adK(t, 56.267, 56.8, EZ.ios);   // 本編のタイトル画面（L135 の下ほど濃い下地、字は下寄せ）のように沈む
      const gr = c.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, `rgba(5,7,11,${0.35 * kd})`); gr.addColorStop(0.4, `rgba(5,7,11,${0.5 * kd})`); gr.addColorStop(0.62, `rgba(5,7,11,${0.86 * kd})`); gr.addColorStop(1, `rgba(5,7,11,${0.94 * kd})`); c.fillStyle = gr; c.fillRect(0, 0, 1920, 1080); adVignette(c, 0.5 * kd);
      const k1 = adK(t, 1698 / 30, 1698 / 30 + 0.4, EZ.oc); adText(c, '外神竜に会いに行こう', { x: 960, y: 700 + 10 * (1 - k1), size: 108, family: 'Shippori Mincho B1', weight: 800, fill: '#FFFFFF', track: 8.64, shadow: { col: 'rgba(0,0,0,0.6)', blur: 30 }, alpha: k1 });
      const kl = adK(t, 56.95, 57.25, EZ.oc); if (kl > 0) { c.save(); c.fillStyle = '#E3B428'; c.fillRect(960 - 210 * kl, 788.5, 420 * kl, 3); c.restore(); }
      const k2 = adK(t, 1715 / 30, 1715 / 30 + 0.35, EZ.oc); adText(c, '主権留保', { x: 960, y: 900, size: 96, family: 'Shippori Mincho B1', weight: 800, fill: '#FFFFFF', track: 7.68, shadow: { col: 'rgba(0,0,0,0.6)', blur: 30 }, alpha: k2 });   // L378
    } } });

// ================= 書き出しの口（断偽の広告の注記は描かない） =================
window.__ad = {
  list: () => Object.keys(AD.scenes).map(k => ({ key: k, f0: ADF(AD.scenes[k].t0), f1: ADF(AD.scenes[k].t1) })),
  async prepare(key) { const s = AD.scenes[key]; if (!s) throw new Error('no scene ' + key); $('title').hidden = true; G.mode = 'cine'; setObj(''); bgm(''); adHideUI(); AD.cv.style.zIndex = 99999; window.__adSeed && window.__adSeed(20261121);
    await adFonts(GS_FONTS); AD.cur = s; await s.setup(); for (const id of ['hud', 'act', 'prompt', 'dlg']) { const e = $(id); if (e) e.hidden = true; } return { f0: ADF(s.t0), f1: ADF(s.t1) }; },
  async freeze() { const s = AD.cur; window.requestAnimationFrame = () => 0; await new Promise(r => setTimeout(r, 300)); window.__adSeed && window.__adSeed(777); T.now = 100 + s.t0 - 1.5; G.shake = 0; AD.now = 1e6; loop(AD.now);
    AD_T = s.t0; AD_F = ADF(s.t0); for (let i = 0; i < 45; i++) { s.update(s.t0, true); AD.now += 1000 / AD.fps; loop(AD.now); } T.now = 100 + s.t0; },
  frame(fg) { const s = AD.cur, t = fg / AD.fps; AD_F = fg; AD_T = t; s.update(t, false); AD.now += 1000 / AD.fps; loop(AD.now);
    const c = AD.cx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.drawImage(renderer.domElement, 0, 0, 1920, 1080);
    if (s.draw) { c.save(); s.draw(c, t, fg); c.restore(); }
    if (t >= GS_END0) adFill(c, '#000', adK(t, GS_END0, GS_END1)); return true; },
};
