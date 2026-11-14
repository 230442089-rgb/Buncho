// ───────── 死にかた（二通り）─────────
// つかまると、視点が体の外へ出て、あなたの最期を見ることになる。飛ばせる。
//   bolt: 家畜用のボルト銃を額に当てられる。撃たれた瞬間、頭の中の断面に切り替わる（骨は透けて、脳が潰れる）。
//   neck: うしろから頭をつかまれ、首を一回転させられる。
// 彼の方を向いてつかまると bolt。背を向けていたときは、まだ見た回数の少ないほう（Game.caught で決める）。
const Death = (() => {
  const D = { on: false, kind: '', t: 0, V: null, xray: false, xr: null, end: 6.4, cue: {}, px: 0, pz: 0, fy: 0, cam: { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0 } };
  let scene, parts = [], pool = null;
  const FIRE = 2.1, XEND = 3.8;
  const cue = (name, t, fn) => { if (D.t >= t && !D.cue[name]) { D.cue[name] = 1; fn(); } };

  function init(sc) {
    scene = sc;
    D.V = Body.mk(Body.YOU); D.V.root.visible = false; scene.add(D.V.root);
    const pm = new THREE.MeshBasicMaterial({ color: C3(0x5a0a0a) }), pg = new THREE.SphereGeometry(0.02, 6, 5);
    for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(pg, pm); m.visible = false; scene.add(m); parts.push({ m, vx: 0, vy: 0, vz: 0, life: 0 }); }
    pool = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: C3(0x3a0606), transparent: true, opacity: 0.85, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.visible = false; scene.add(pool);
    mkXray();
  }
  // 頭の中の断面（別の場面として描く）。骨は半透明、脳はピンクのかたまり。ボルトは顔の側（+Z）から入る
  function mkXray() {
    const X = D.xr = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(38, 1, 0.1, 50), deb: [] };
    X.scene.background = C3(0x04060a);
    X.scene.add(new THREE.HemisphereLight(C3(0xcfe0ff), C3(0x201418), 0.8)); const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(2, 3, 2); X.scene.add(dl);
    const glass = (c, o, side) => new THREE.MeshBasicMaterial({ color: C3(c), transparent: true, opacity: o, depthWrite: false, side: side || THREE.FrontSide });
    const sk = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), glass(0xbcd4ff, 0.13)); sk.scale.set(0.86, 1.02, 1.0); X.scene.add(sk);
    const sk2 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 28, 20), glass(0x8fb0e8, 0.1, THREE.BackSide)); sk2.scale.set(0.86, 1.02, 1.0); X.scene.add(sk2);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.5, 1.0), glass(0xbcd4ff, 0.1)); jaw.position.set(0, -0.95, 0.25); X.scene.add(jaw);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), glass(0x0a1020, 0.75)); e.position.set(s * 0.36, -0.12, 0.8); X.scene.add(e); }
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.1, 10), glass(0xbcd4ff, 0.14)); sp.position.set(0, -1.45, -0.25); X.scene.add(sp);
    const g = new THREE.SphereGeometry(0.74, 44, 30), p = g.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {   // しわ（脳溝）を付ける
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.05 * Math.sin(x * 21 + y * 9) * Math.sin(y * 17 + z * 13) + 0.03 * Math.sin(z * 31 + x * 7) - 0.07 * Math.exp(-x * x * 120);
      p.setXYZ(i, x * k * 0.82, y * k * 0.8, z * k);
    }
    X.base = Float32Array.from(p.array); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    X.brain = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })); X.brain.position.set(0, 0.14, -0.06); X.scene.add(X.brain);
    X.rod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.5, 12), new THREE.MeshStandardMaterial({ color: C3(0xa8aeb8), roughness: 0.3, metalness: 0.85 })); X.rod.rotation.x = Math.PI / 2; X.scene.add(X.rod);
    X.cloud = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), glass(0x8a1010, 0.4)); X.scene.add(X.cloud);
    const dg = new THREE.SphereGeometry(0.035, 6, 5), dm = new THREE.MeshBasicMaterial({ color: C3(0x7a1414) });
    for (let i = 0; i < 34; i++) { const m = new THREE.Mesh(dg, dm); X.scene.add(m); X.deb.push({ m, vx: 0, vy: 0, vz: 0 }); }
  }
  // 断面を、時刻 xt（0 = 切り替わった瞬間）の状態にする
  function poseXray(xt) {
    const X = D.xr, IMP = 0.5, p = X.brain.geometry.attributes.position, c = X.brain.geometry.attributes.color, b = X.base;
    const tip = xt < IMP ? lerp(2.2, 0.98, smooth(xt / IMP)) : lerp(0.98, 0.12, smooth(seg(xt, IMP, IMP + 0.09))) + 0.5 * smooth(seg(xt, 1.15, 1.5));   // ボルトの先の位置（z）
    X.rod.position.set(0, 0.3, tip + 0.75);
    const k = smooth(seg(xt, IMP, IMP + 0.22)), wob = k * Math.exp(-(xt - IMP) * 3) * Math.sin((xt - IMP) * 38) * 0.05;
    for (let i = 0; i < p.count; i++) {
      let x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
      const dr = Math.hypot(x, y - 0.16), near = Math.max(0, 1 - dr / 0.55) * Math.max(0, Math.min(1, (z + 0.5) / 0.9)), hurt = near * k;
      if (dr > 1e-4) { x += x / dr * hurt * 0.34; y += (y - 0.16) / dr * hurt * 0.26; }     // 通り道のまわりが、外へ押しのけられる
      z = z * (1 - 0.42 * k) - hurt * 0.34 + wob * (1 + z);                                   // 全体が、うしろへ潰れる
      y -= 0.07 * k * (1 - near);
      p.setXYZ(i, x, y, z);
      const d = clamp(hurt * 1.7 + k * 0.22, 0, 1); c.setXYZ(i, Math.pow(lerp(0.86, 0.3, d), 2.2), Math.pow(lerp(0.6, 0.03, d), 2.2), Math.pow(lerp(0.62, 0.04, d), 2.2));
    }
    p.needsUpdate = true; c.needsUpdate = true; X.brain.geometry.computeVertexNormals();
    const u = seg(xt, IMP, IMP + 0.9); X.cloud.visible = xt >= IMP; X.cloud.position.set(0, 0.3, 0.3 - u * 0.5); X.cloud.scale.setScalar(0.3 + u * 2.6); X.cloud.material.opacity = 0.45 * (1 - u);
    for (const q of X.deb) {
      const e = xt - IMP; q.m.visible = e >= 0;
      if (e >= 0) q.m.position.set(q.vx * e, 0.3 + q.vy * e - 1.6 * e * e, 0.2 + q.vz * e);
    }
    const a = 0.5 + xt * 0.16; X.cam.position.set(Math.cos(a) * 4.6, 0.5, Math.sin(a) * 4.6 * 0.35 + 0.5); X.cam.lookAt(0, 0, 0.1);
  }
  function burst(x, y, z, n, sp) {
    let k = 0;
    for (const q of parts) { if (k >= n) break; if (q.life > 0) continue; q.life = 0.9 + Math.random() * 0.5; q.m.visible = true; q.m.position.set(x, y, z); q.vx = (Math.random() - 0.5) * sp; q.vy = Math.random() * sp * 0.8; q.vz = (Math.random() - 0.5) * sp; k++; }
  }

  function start(kind, P) {
    const V = D.V, A = Anton.J;
    D.on = true; D.kind = kind; D.t = 0; D.cue = {}; D.xray = false; D.end = kind === 'bolt' ? 6.6 : 5.6; D.px = P.x; D.pz = P.z;
    for (const q of parts) { q.life = 0; q.m.visible = false; } pool.visible = false;
    for (const q of D.xr.deb) { q.vx = (Math.random() - 0.5) * 2.2; q.vy = Math.random() * 1.6 - 0.2; q.vz = -Math.random() * 2.4 + 0.4; }
    const toA = Math.atan2(Anton.x - P.x, Anton.z - P.z), fy = D.fy = kind === 'bolt' ? toA : toA + Math.PI;   // あなたの向き
    V.root.visible = true; V.root.rotation.order = 'YXZ'; V.root.rotation.set(0, fy, 0); V.root.position.set(P.x, 0, P.z);
    const fx = Math.sin(fy), fz = Math.cos(fy), lx = Math.cos(fy), lz = -Math.sin(fy);   // 前と、左
    if (kind === 'bolt') { Anton.yaw = fy + Math.PI; Anton.x = P.x + fx * 0.86 - lx * 0.235; Anton.z = P.z + fz * 0.86 - lz * 0.235; }   // 彼の右肩が、あなたの正面に来るように立つ
    else { Anton.yaw = fy; Anton.x = P.x - fx * 0.42; Anton.z = P.z - fz * 0.42; }
    A.gun.visible = A.tank.visible = A.hose.visible = kind === 'bolt';
    A.root.rotation.order = 'YXZ'; Anton.place();
    // 視点: 二人を斜めから。壁にめりこまない側に置く
    const fwd = kind === 'bolt' ? 0.45 : 1.75, sd = kind === 'bolt' ? 1.9 : 0.75;
    const s = [1, -1].find(q => !Town.solidAt(P.x + fx * fwd + lx * sd * q, P.z + fz * fwd + lz * sd * q)) || 1, C = D.cam;
    C.x = P.x + fx * fwd + lx * sd * s; C.z = P.z + fz * fwd + lz * sd * s; C.y = 1.52; C.tx = P.x + fx * 0.3; C.tz = P.z + fz * 0.3; C.ty = 1.5;
    Snd.sfx('grab');
  }
  function update(dt, camera) {
    const V = D.V, A = Anton.J, t = D.t += dt, C = D.cam;
    const cf = Math.min(80, 46 * Math.max(1, 1.25 / camera.aspect)); if (camera.fov !== cf) { camera.fov = cf; camera.updateProjectionMatrix(); }   // 寄った画にする（縦長の画面では、二人が入るように広げる）
    Body.stand(V, t); Body.stand(A, t);
    if (D.kind === 'bolt') {
      const up = smooth(seg(t, 0.2, 1.0)), aft = smooth(seg(t, 4.1, 5.0)), g = smooth(seg(t, 0.1, 0.6)), shot = t >= XEND ? 1 : 0;
      A.shR.rotation.x = -1.98 * up * (1 - aft) + (t >= FIRE && t < FIRE + 0.2 ? 0.1 : 0); A.elR.rotation.x = -0.06; A.spine.rotation.x = 0.05 * up;
      A.bolt.scale.y = t >= FIRE && t < XEND + 0.3 ? 1 : 0.01;
      // あなた: 身をすくめて、両手を上げかける。撃たれると頭がのけぞり、うしろへ倒れる
      const fall = smooth(seg(t, XEND + 0.05, XEND + 0.85));
      V.spine.rotation.x = -0.1 * g - 0.25 * shot * (1 - fall); V.neck.rotation.x = -0.12 * g - 0.7 * shot;
      V.shL.rotation.x = V.shR.rotation.x = -0.9 * g * (1 - shot); V.elL.rotation.x = V.elR.rotation.x = -1.7 * g * (1 - shot) - 0.2 * shot;
      V.knL.rotation.x = 0.1 * g + 0.85 * fall; V.knR.rotation.x = 0.1 * g + 0.55 * fall; V.hipL.rotation.x = -0.45 * fall; V.hipR.rotation.x = -0.3 * fall;   // あおむけに倒れて、ひざが少し立つ
      V.root.rotation.x = -1.5 * fall; V.root.position.y = 0.1 * fall;
      if (t > 1.0 && t < FIRE) { V.spine.rotation.z = Math.sin(t * 40) * 0.008; V.neck.rotation.y = Math.sin(t * 31) * 0.02; }
      cue('hiss', 1.05, () => Snd.sfx('hiss'));
      cue('fire', FIRE + 0.5, () => { Snd.sfx('bolt'); Snd.sfx('wet'); Game.flash(0.25); });
      cue('back', XEND, () => { const hx = D.px - Math.sin(D.fy) * 0.16, hz = D.pz - Math.cos(D.fy) * 0.16; burst(hx, 1.78, hz, 16, 2.2); });
      cue('fall', XEND + 0.8, () => { Snd.sfx('thud'); Game.shake(0.25); pool.visible = true; pool.position.set(D.px - Math.sin(D.fy) * 1.65, 0.02, D.pz - Math.cos(D.fy) * 1.65); pool.scale.setScalar(0.1); });
      if (pool.visible) pool.scale.setScalar(Math.min(1.25, pool.scale.x + dt * 0.35));
      D.xray = t >= FIRE && t < XEND;
      if (D.xray) poseXray(t - FIRE);
    } else {
      const g = smooth(seg(t, 0.1, 0.6)), tw = smooth(seg(t, 1.0, 1.9)), rel = smooth(seg(t, 1.95, 2.5)), fall = smooth(seg(t, 2.0, 2.8)), ang = tw * (Math.PI * 2 + 0.45);   // 一回転して、少し行きすぎて止まる
      // 彼: うしろから、両手で頭をはさむ。ひねる
      for (const [sh, el, s] of [[A.shL, A.elL, 1], [A.shR, A.elR, -1]]) { sh.rotation.order = 'YXZ'; sh.rotation.x = (-2.0 - Math.sin(ang) * 0.22 * s) * g * (1 - rel); sh.rotation.y = -0.32 * s * g * (1 - rel); el.rotation.x = -0.62 * g * (1 - rel) - 0.12; }
      A.spine.rotation.x = 0.08 * g * (1 - rel); A.neck.rotation.y = smooth(seg(t, 3.3, 4.1)) * 0.5;
      // あなた: 頭が一回転する。手は彼の手首をつかもうとして、途中で落ちる。ひざが折れて、前へ倒れる
      V.neck.rotation.y = ang; V.neckMesh.rotation.y = ang * 0.5; V.neck.rotation.z = Math.sin(ang * 0.5) * 0.12 + 0.4 * smooth(seg(t, 1.85, 2.3)); V.neckMesh.scale.set(1 - 0.3 * tw, 1, 1 - 0.3 * tw);   // ねじれた首は細くなり、頭は横へ倒れたまま
      const limp = smooth(seg(t, 1.35, 1.7));
      V.shL.rotation.x = V.shR.rotation.x = -1.9 * g * (1 - limp); V.elL.rotation.x = V.elR.rotation.x = -2.1 * g * (1 - limp) - 0.1;
      V.spine.rotation.x = -0.08 * g + 0.1 * limp; V.knL.rotation.x = V.knR.rotation.x = 0.55 * limp * (1 - fall) + 0.15 * fall;
      V.root.rotation.x = 1.5 * fall; V.root.position.y = 0.12 * fall;
      if (t > 0.6 && t < 1.0) V.neck.rotation.y = Math.sin(t * 46) * 0.05;
      cue('c1', 1.2, () => Snd.sfx('crack')); cue('c2', 1.45, () => { Snd.sfx('crack'); Game.shake(0.15); }); cue('c3', 1.7, () => { Snd.sfx('crack'); Snd.sfx('wet'); Game.flash(0.12); });
      cue('fall', 2.75, () => { Snd.sfx('thud'); Game.shake(0.25); });
    }
    Body.hose(A);
    for (const q of parts) { if (q.life <= 0) continue; q.life -= dt; q.vy -= 9.8 * dt; q.m.position.x += q.vx * dt; q.m.position.y = Math.max(0.02, q.m.position.y + q.vy * dt); q.m.position.z += q.vz * dt; if (q.m.position.y <= 0.021) { q.vx = q.vz = 0; } if (q.life <= 0) q.m.visible = false; }
    // 手持ちのような、かすかなゆれ
    camera.position.set(C.x + Math.sin(t * 1.3) * 0.02, C.y + Math.sin(t * 1.9) * 0.015, C.z + Math.cos(t * 1.1) * 0.02);
    // 倒れたあとは、倒れた体のほうへ目を落とす（銃ならうしろへ、首なら前へ倒れている）
    const dn = D.kind === 'bolt' ? smooth(seg(t, XEND + 0.1, XEND + 1.0)) : smooth(seg(t, 2.1, 3.0)), along = (D.kind === 'bolt' ? -1.05 : 1.1) * dn;
    camera.lookAt(C.tx + Math.sin(D.fy) * along, C.ty - dn * 1.15, C.tz + Math.cos(D.fy) * along);
    if (t >= D.end) finish();
  }
  function finish() { if (!D.on) return; D.on = false; D.xray = false; Game.dead(D.kind); }
  function hide() { D.V.root.visible = false; pool.visible = false; for (const q of parts) { q.life = 0; q.m.visible = false; } const A = Anton.J; A.gun.visible = A.tank.visible = A.hose.visible = true; A.shL.rotation.order = A.shR.rotation.order = 'XYZ'; }
  return Object.assign(D, { init, start, update, finish, hide, poseXray });
})();
