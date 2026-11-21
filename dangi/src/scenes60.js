// ================= 60 秒版で足した場面（rate を燃やす朝・夜明けの問答・沈黙と叫び・新米の入門） =================
// 言葉はすべて本編の台詞から取る。暴力・標的・首・燃える街は出さない。

// ---- 鉄の火鉢 ----
function adBrazier(a, x, z) { const g = new THREE.Group(); g.position.set(x, 0, z); adAdd(a.g, g);
  for (let i = 0; i < 3; i++) { const an = i / 3 * TAU + 0.5; part(cyl(0.035, 0.035, 0.66, 6), 0x1A1616, Math.cos(an) * 0.3, 0.33, Math.sin(an) * 0.3, g, { rz: Math.cos(an) * 0.16, rx: -Math.sin(an) * 0.16 }); }
  part(cyl(0.5, 0.36, 0.3, 18), 0x221C1C, 0, 0.72, 0, g);
  const em = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0xFF6A1A })); em.rotation.x = -Math.PI / 2; em.position.y = 0.885; g.add(em);
  g.fl = []; for (let i = 0; i < 6; i++) { const s = glowSprite(i % 2 ? 0xFFB050 : 0xFF6A20, 0.5 + (i % 3) * 0.18, 0.8); s.position.set(Math.cos(i * 2.1) * 0.22, 1.0 + (i % 3) * 0.12, Math.sin(i * 2.1) * 0.22); g.add(s); g.fl.push(s); }
  g.light = adPoint(a, 0xFF8A3A, 1.6, 7, x, 1.1, z); return g; }

// ---- rate を書いた紙（燃えていく） ----
function adPaper() { const W = 512, H = 712; const base = document.createElement('canvas'); base.width = W; base.height = H; const b = base.getContext('2d');
  b.fillStyle = '#ECE6D6'; b.fillRect(0, 0, W, H); for (let i = 0; i < 900; i++) { b.fillStyle = `rgba(120,100,80,${0.03 + adH(i, 3) * 0.05})`; b.fillRect(adH(i, 4) * W, adH(i, 5) * H, 3, 3); }
  b.fillStyle = '#1A1416'; b.textAlign = 'center'; b.textBaseline = 'middle'; b.font = '400 136px "Yuji Syuku"'; b.fillText('rate', W / 2, 156); b.font = '400 78px "Yuji Syuku"'; b.fillText('六垓二千四百', W / 2, 372, W - 40); b.font = '400 88px "Yuji Syuku"'; b.fillText('十一京……', W / 2, 524, W - 40);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const N = 16, grid = []; for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) grid.push(adH(i * 31 + j * 17, 7));
  const gv = (u, v) => { const fu = u * N, fv = v * N, i0 = Math.min(N - 1, Math.floor(fu)), j0 = Math.min(N - 1, Math.floor(fv)), du = fu - i0, dv = fv - j0, g = (i, j) => grid[j * (N + 1) + i]; return (g(i0, j0) * (1 - du) + g(i0 + 1, j0) * du) * (1 - dv) + (g(i0, j0 + 1) * (1 - du) + g(i0 + 1, j0 + 1) * du) * dv; };
  const D = new Float32Array(W * H); for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) { const u = xx / W, v = yy / H; D[yy * W + xx] = Math.hypot(u - 0.12, (v - 0.98) * 0.8) / 1.15 + (gv(u, v) - 0.5) * 0.22; }
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; const P = { tex, last: -1 };
  P.draw = (b01) => { if (Math.abs(b01 - P.last) < 1e-4) return; P.last = b01; x.clearRect(0, 0, W, H); x.drawImage(base, 0, 0);
    if (b01 > 0) { const im = x.getImageData(0, 0, W, H), d = im.data, F = b01 * 1.3 - 0.05; for (let k = 0; k < W * H; k++) { const dd = D[k] - F, o = k * 4; if (dd < 0) d[o + 3] = 0; else if (dd < 0.035) { const e = dd / 0.035; d[o] = 255; d[o + 1] = 120 + 110 * e; d[o + 2] = 40 + 40 * e; } else if (dd < 0.11) { const e = (dd - 0.035) / 0.075; d[o] = adLerp(40, d[o], e); d[o + 1] = adLerp(20, d[o + 1], e); d[o + 2] = adLerp(12, d[o + 2], e); } } x.putImageData(im, 0, 0); }
    tex.needsUpdate = true; };
  P.draw(0); P.m = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.5), new THREE.MeshBasicMaterial({ map: tex, color: 0xFFE4CC, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide })); return P; }

// ---------- U7：s14 rate を燃やす朝（13.533〜19.533） ----------
const T14 = 406 / 30, T14B = 486 / 30, T15 = 586 / 30;
adScene('u7', { t0: T14, t1: T15, fonts: FONTS_ALL,
  async setup() { const a = await adDangi({ bg: 0x4A5266, f0: 12, f1: 52, hi: 0.32 }); sun.intensity = 0.12; sun.color.setHex(0xB8C8E8); sun.position.set(6, 10, 14);
    adTickPost(a, () => { if (a.hallGlow) a.hallGlow.material.opacity = 0.45; });
    AD.br = adBrazier(a, 0, -4.2);
    AD.ring = []; [-64, -32, 0, 32, 64].forEach((dg, i) => { const an = dg * Math.PI / 180, x = 2.3 * Math.sin(an), z = -4.2 - 2.3 * Math.cos(an); AD.ring.push(put31(a, 'adRg' + i, () => member30(i + 1, false), x, z, Math.atan2(-x, -4.2 - z), { look: 0.25 })); });
    AD.fe = []; for (let i = 0; i < 3; i++) { const s2 = glowSprite(i % 2 ? 0xFFC060 : 0xFF7A2A, 0.22 + i * 0.05, 0); adAdd(a.g, s2); AD.fe.push(s2); }
    AD.sm = put31(a, 'adSm7', () => shinmai30(false), -0.95, -3.55, Math.atan2(0.95, -0.65), {});
    AD.pp = adPaper(); adAdd(a.g, AD.pp.m);
    AD.sm.model.adPost = c => { const kUp = adK(AD_T, T14 + 0.05, T14 + 0.35, EZ.oc) * (1 - adK(AD_T, 15.45, 15.9, EZ.ios)); const ax = adLerp(-1.15, -1.55, adK(AD_T, 15.0, 15.3, EZ.ios)); if (kUp > 0) c.arms[1].rotation.x = adLerp(c.arms[1].rotation.x, ax, kUp);
      if (AD_T < 15.3) { c.arms[1].updateMatrixWorld(true); const v = new THREE.Vector3(0, -0.5, 0.12); c.arms[1].localToWorld(v); AD.hand = v; } };
    AD.u = [...AD.ring, AD.sm]; AD_SHOT = ''; AD.hand = null; },
  update(t) { AD_T = t; const shot = t < T14B ? 'a' : 'b', br = AD.br, pp = AD.pp, m = pp.m;
    const fl = 0.8 + 0.2 * adWob(t, 1.3); br.light.intensity = (shot === 'a' ? 1.6 : 1.3) * fl + 0.9 * adK(t, 17.2, 17.6) * (1 - adK(t, 18.6, 19.3));
    br.fl.forEach((s, i) => { s.material.opacity = 0.55 + 0.3 * Math.sin(t * (7 + i) + i * 1.7); s.scale.setScalar((0.5 + (i % 3) * 0.18) * (1 + 0.15 * Math.sin(t * (5 + i) + i))); });
    const rest = new THREE.Vector3(0.02, 0.93, -4.18);
    if (t < 15.3) { if (AD.hand) m.position.copy(AD.hand); else m.position.set(-0.6, 1.3, -3.9); m.rotation.set(-0.2, 0.4, 0.1); }
    else if (t < 15.7) { const k = adK(t, 15.3, 15.7, EZ.lin), h = AD.hand || rest; m.position.set(adLerp(h.x, rest.x, k) + Math.sin(k * 9) * 0.04 * (1 - k), adLerp(h.y, rest.y, k * k), adLerp(h.z, rest.z, k)); m.rotation.set(adLerp(-0.2, -1.25, k) + Math.sin(k * 11) * 0.25 * (1 - k), adLerp(0.4, 0.0, k), adLerp(0.1, 0, k)); }
    else { m.position.copy(rest); m.rotation.set(-1.25, 0, 0); }
    { const bk = adK(t, 17.2, 19.15), on = bk > 0 && bk < 0.98; AD.fe.forEach((s2, i) => { const u = adLerp(-0.12, 0.14, adClamp(bk * 1.2 + i * 0.08)), v = adLerp(-0.2, 0.2, adClamp(bk * 1.1 + i * 0.05)); s2.position.set(rest.x + u, rest.y + 0.06 + 0.05 * Math.sin(t * (9 + i) + i), rest.z + v * 0.3 - 0.02); s2.material.opacity = on ? 0.55 + 0.3 * Math.sin(t * (11 + i * 3) + i) : 0; }); }
    pp.draw(adK(t, 17.2, 19.15));
    if (shot !== AD_SHOT) { AD_SHOT = shot; adSnap(AD.u); }
    if (shot === 'a') adCamK(adK(t, T14, T14B, EZ.ios), [1.35, 1.7, -1.9], [-0.5, 1.2, -4.0], [1.15, 1.6, -2.35], [-0.5, 1.2, -4.0], 44);
    else adCamK(adK(t, T14B, T15, EZ.ios), [0.32, 1.30, -3.34], [0.0, 0.92, -4.15], [0.28, 1.24, -3.46], [0.0, 0.92, -4.15], 36); },
  draw(c, t, f) { const A = t < T14B; adSparks(c, t, A ? 10 : 22, { speed: A ? 70 : 140, seed: 14, x0: A ? 700 : 500, x1: A ? 1200 : 1400, size: A ? 0.8 : 1.3 }); adVignette(c, 0.5); adGrain(c, f, 0.03);
    const qa = adK(t, 13.75, 13.95) * (1 - adK(t, 19.3, 19.5)); adText(c, '「……毎朝、自分の rate を紙に書いて、燃やすんだ。」', { x: 960, y: 975, size: 50, weight: 700, fill: '#FFFFFF', stroke: '#0C0A10', sw: 8, alpha: qa }); } });

// ---------- U8：s15 夜明けの問答（19.533〜25.533） ----------
const T15B = 666 / 30;
adScene('u8', { t0: T15, t1: 766 / 30, fonts: FONTS_ALL,
  async setup() { const a = await adDangi({ bg: 0xC89A84, f0: 18, f1: 64, hi: 0.55 }); sun.intensity = 0.65; sun.color.setHex(0xFFB080); sun.position.set(-20, 6, 6);
    adTickPost(a, () => { if (a.hallGlow) a.hallGlow.material.opacity = 0.35; });
    AD.mzg = put31(a, 'adMzg', () => mesuZeroGyo30(), 0, -6.75, 0, { sit: true, look: 0.05 }, 0.8);
    AD.sm = put31(a, 'adSm8', () => shinmai30(false), 0, -3.6, Math.PI, { kneel: true, look: 0.15 });
    AD.k1 = put31(a, 'adK81', () => member30(3, false), -2.0, -3.0, Math.PI * 0.94, { kneel: true, look: 0.2 }); AD.k2 = put31(a, 'adK82', () => member30(5, false), 2.0, -3.0, -Math.PI * 0.94, { kneel: true, look: 0.2 });
    adPoint(a, 0xFFB080, 0.9, 8, 1.5, 3.0, -4.0); AD.u = [AD.mzg, AD.sm, AD.k1, AD.k2]; AD_SHOT = ''; },
  update(t) { AD_T = t; const shot = t < T15B ? 'a' : 'b'; if (shot !== AD_SHOT) { AD_SHOT = shot; adShow([AD.k2], shot === 'a'); adSnap(AD.u); }
    if (shot === 'a') adCamK(adK(t, T15, T15B, EZ.ios), [0.9, 1.35, -1.6], [-0.05, 2.65, -6.75], [0.8, 1.35, -1.9], [-0.05, 2.65, -6.75], 40);
    else adCamK(adK(t, T15B, 766 / 30, EZ.ios), [1.55, 1.8, -2.3], [0.0, 3.5, -6.75], [1.4, 1.85, -2.65], [0.0, 3.5, -6.75], 36); },
  draw(c, t, f) { adVignette(c, 0.35); adGrain(c, f, 0.03);
    adText(c, 'メス・ゼロ', { x: 960, y: 872, size: 26, weight: 700, fill: '#F4F4F4', stroke: '#0C0A10', sw: 4, track: 4, alpha: adK(t, 19.75, 19.95) * (1 - adK(t, 25.2, 25.4)) });
    const a1 = adK(t, 19.85, 20.1) * (1 - adK(t, 21.95, 22.15)); adText(c, '……問い続けること。', { x: 960, y: 945, size: 58, family: 'Shippori Mincho B1', weight: 800, fill: '#FFFFFF', stroke: '#0C0A10', sw: 8, alpha: a1 });
    const a2 = adK(t, 22.3, 22.55) * (1 - adK(t, 25.2, 25.4)); adText(c, '答えを出した瞬間に、それは偽りになる。', { x: 960, y: 945, size: 58, family: 'Shippori Mincho B1', weight: 800, fill: '#FFFFFF', stroke: '#0C0A10', sw: 8, alpha: a2 }); } });

// ---------- U9：s16 沈黙と叫び（32.2〜40.2） ----------
const T16 = 966 / 30, T16B = 1068 / 30, T16C = 1122 / 30, T17 = 1206 / 30;
adScene('u9', { t0: T16, t1: T17, fonts: FONTS_ALL,
  async setup() { const a = await adSohon({ bg: 0x070508, f0: 22, f1: 84, hi: 0.26, ground: 0x6A665E }); sun.intensity = 0.15; adCrestFix(a); if (a.wall) a.wall.visible = false;
    a.fires.forEach(s => s.scale.multiplyScalar(1.25)); const cg = glowSprite(0xFF2A1A, 3.4, 0.35); cg.position.set(0, 5.6, -10.55); adAdd(a.g, cg);
    adTickPost(a, () => { a.hallGlow.material.opacity = AD.hall ?? 0.45; });
    const mz = put31(a, 'adMz9', () => mesuZeroBird(), 0, -10.0, 0, { look: 0.1 }, 1.2); mzOver30(mz.model, false); if (mz.model.nk) mz.model.nk.visible = false; AD.mz = mz; adEyes(mz.model);
    AD.rows = []; const zs = [9.8, 7.2, 4.6, 2.0, -0.6, -3.2]; for (let i = 0; i < 12; i++) AD.rows.push(put31(a, 'adY' + i, () => member30(i, false), i % 2 ? 2.2 : -2.2, zs[i >> 1], Math.PI, { kneel: true, bow: true, bowA: 1.1 }));
    AD.red = new THREE.DirectionalLight(0xFF3A4A, 0); AD.red.position.set(0, 9, -17); AD.red.target.position.set(0, 3, -10); adAdd(a.g, AD.red); adAdd(a.g, AD.red.target);
    AD.u = [mz, ...AD.rows]; AD_SHOT = ''; },
  update(t) { AD_T = t; const mz = AD.mz, m = mz.model, shot = t < T16B ? 'a' : t < T16C ? 'b' : 'c'; if (shot !== AD_SHOT) { AD_SHOT = shot; adSnap(AD.u); }
    const sh = t >= 35.8; mz.st = { look: sh ? -0.22 : 0.1 }; adEyes(m).forEach(e => e.s.scale.setScalar(e.k0 * (sh ? adLerp(1, 1.9, adK(t, 35.8, 35.9)) : 1)));
    AD.hall = 0.45 + 0.35 * adK(t, 35.8, 35.9) * (1 - adK(t, 36.6, 37.6)); AD.red.intensity = 0.9 * adK(t, 35.8, 35.9) * (1 - adK(t, 37.0, 38.0));
    if (shot === 'a') adCamK(adK(t, T16, T16B, EZ.ios), [0, 1.7, 5.0], [0, 3.6, -10.0], [0, 2.1, -1.0], [0, 3.8, -10.0], 40);
    else if (shot === 'b') { adCam([0.55, 3.05, -6.2], [0, 4.35, -10.0]); adFov(36); }
    else adCamK(adK(t, T16C, T17, EZ.ios), [0, 10.5, 19.0], [0, 1.2, -4.0], [0, 11.0, 20.5], [0, 1.2, -4.0], 50); },
  draw(c, t, f) { adSparks(c, t, 12, { speed: 80, seed: 16 }); adVignette(c, 0.6); adGrain(c, f, 0.03);
    if (t >= 35.8 && t < 37.35) { const k = adK(t, 35.8, 35.85), fo = 1 - adK(t, 37.15, 37.35), jit = 1 - adK(t, 35.8, 36.4), dx = Math.round(10 * jit * adWob(t, 3.1)), dy = Math.round(8 * jit * adWob(t + 0.3, 2.7));
      c.save(); c.globalAlpha = 0.72 * fo; c.fillStyle = '#100A0C'; c.fillRect(0, 740, 1920, 190); c.fillStyle = '#E0304A'; c.fillRect(0, 740, 1920, 5); c.restore();
      adText(c, 'メス・ゼロ', { x: 120, y: 778, size: 26, weight: 700, align: 'left', fill: '#F4F4F4', alpha: fo });
      c.save(); c.translate(960 + dx, 852 + dy); c.rotate(-0.03); c.font = '400 112px "Dela Gothic One"'; const tw = [...'偽りだァァァ！！'].reduce((p, ch) => p + c.measureText(ch).width, 0), dw = 200, W0 = dw + 18 + tw, x0 = -W0 / 2;
      c.save(); c.globalAlpha = fo; c.lineJoin = 'round'; c.strokeStyle = '#0C0A10'; c.lineWidth = 10; c.strokeRect(x0, -9, dw, 18); c.shadowColor = 'rgba(224,40,58,0.5)'; c.shadowBlur = 20; c.fillStyle = '#FF9A9A'; c.fillRect(x0, -9, dw, 18); c.restore();
      adText(c, '偽りだァァァ！！', { x: x0 + dw + 18, y: 0, align: 'left', size: 112, family: 'Dela Gothic One', weight: 400, fill: '#FF9A9A', stroke: '#0C0A10', sw: 10, alpha: fo, glow: 'rgba(224,40,58,0.5)', gb: 20 }); c.restore(); }
    if (t >= 37.4) for (let i = 0; i < 40; i++) { const side = i % 2 ? 1 : -1, ts = 37.45 + adH(i, 21) * 0.5, k = adK(t, ts, ts + 2.4); if (k <= 0 || k >= 1) continue;
      const x0 = 960 + side * (560 + adH(i, 22) * 380), y0 = 90 + adH(i, 23) * 160, x = x0 + side * (160 + adH(i, 24) * 420) * k, y = y0 - (200 + adH(i, 25) * 260) * EZ.oc(k);
      adBird(c, x, y, 22 + adH(i, 26) * 14, Math.sin(t * 9 * 6.283 + i) * 0.4, `rgba(200,180,188,${(0.9 * (1 - adK(k, 0.75, 1))).toFixed(3)})`); }
    adFill(c, '#000', 1 - adK(t, T16, T16 + 0.25)); adFill(c, '#000', adK(t, 40.05, 1205 / 30)); },
  shake(t) { if (t < 35.8 || t > 36.4) return [0, 0]; const s = 10 * (1 - adK(t, 35.8, 36.4)); return [Math.round(s * adWob(t, 2.6)), Math.round(s * adWob(t + 0.5, 2.2))]; } });

// ---------- U10：s17 新米の入門（40.2〜46.2） ----------
const T17B = 1290 / 30, T18 = 1386 / 30;
adScene('u10', { t0: T17, t1: T18, fonts: FONTS_ALL,
  async setup() { const a = await adDangi({ bg: 0xA8B0B8, f0: 24, f1: 72, hi: 0.78 }); sun.intensity = 0.5; sun.color.setHex(0xFFF4E0); sun.position.set(8, 12, 14);
    adTickPost(a, () => { if (a.hallGlow) a.hallGlow.material.opacity = 0.3; });
    AD.nv = put31(a, 'adNovice10', () => member30(0, false), 0.15, 9.6, Math.PI, {});
    AD.ge = put31(a, 'adGe10', () => gedatsu30(), 0, -4.4, 0, { look: 0.05 });
    AD.sw = put31(a, 'adSw10', () => shinmai30(true), -3.0, 1.4, Math.PI, { paint: true });
    AD.sw.model.adPost = c => { c.arms[1].rotation.x = -0.75 + 0.12 * Math.sin(2 * Math.PI * (AD_T - 40.2) / 0.9); };
    AD.ge.model.head.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.height - 0.16) < 1e-3 && Math.abs(o.geometry.parameters.width - 0.04) < 1e-3) o.visible = false; });
    AD.u = [AD.nv, AD.ge, AD.sw]; AD_SHOT = ''; },
  update(t) { AD_T = t; const shot = t < T17B ? 'a' : 'b', nv = AD.nv, z = adLerp(9.6, 3.2, adK(t, T17, T17B));
    if (shot === 'a') { nv.pos.x = 0.15; nv.pos.z = z; nv.facing = Math.PI; nv.extMove = true; nv.hidden = false; } else nv.hidden = true;
    if (shot !== AD_SHOT) { AD_SHOT = shot; adSnap(AD.u); }
    if (shot === 'a') { adCam([0.9, 2.05, z + 4.6], [0.0, 1.5, z - 7.0]); adFov(42); }
    else adCamK(adK(t, T17B, T18, EZ.ios), [0.45, 1.5, -0.4], [0.0, 2.8, -4.4], [0.38, 1.5, -0.75], [0.0, 2.8, -4.4], 38); },
  draw(c, t, f) { adVignette(c, 0.3); adGrain(c, f, 0.03);
    if (t >= T17B) { adNameCard(c, t, { t0: 43.15, t1: 46.05, out0: 45.9, bar: { x: 100, y0: 742, y1: 862 },
        l1: { s: '断偽文鳥門　修行頭', x: 128, y: 768, slide: 30, st: { size: 26, weight: 700, fill: '#EAE4D4', stroke: '#0C0A10', sw: 4 } },
        l2: { s: 'ゲ・ダツ', x: 124, y: 846, slide: 30, st: { size: 64, weight: 900, fill: '#EFEDE8', stroke: '#0C0A10', sw: 8 } } });
      const qa = adK(t, 43.35, 43.55) * (1 - adK(t, 45.9, 46.05)); adText(c, '「……来たか、新米。」', { x: 960, y: 975, size: 58, weight: 700, fill: '#FFFFFF', stroke: '#0C0A10', sw: 8, alpha: qa }); }
    adFill(c, '#000', adK(t, 46.05, 1385 / 30)); adFill(c, '#000', 1 - adK(t, T17, T17 + 0.25)); } });
