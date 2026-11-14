// ───────── 人のかたち ─────────
// 骨組み（腰 → 背 → 首 → 頭、肩 → ひじ、股 → ひざ）に、円柱と球を着せたもの。前は +Z、左手は +X 側。
// 腕や脚は「下へ垂れた状態」が基準。x の回転が正なら後ろへ、負なら前へ振れる。
const Body = (() => {
  const std = (c, r) => new THREE.MeshStandardMaterial({ color: C3(c), roughness: r === undefined ? 0.85 : r, metalness: 0 });
  const HIP = 0.975;
  // 布のざらつき（上着とズボンに、うすく重ねる）
  let cloth = null;
  function clothTex() {
    if (cloth) return cloth;
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const v = 205 + Math.floor(Math.random() * 50) - ((x + y) % 4 === 0 ? 22 : 0); g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; g.fillRect(x, y, 1, 1); }
    cloth = new THREE.CanvasTexture(c); cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping; cloth.repeat.set(4, 4); cloth.encoding = THREE.sRGBEncoding;
    return cloth;
  }
  // o: { skin, top 上着, top2 えり・シャツ, pants, shoe, hair, bob 耳までかぶさる髪, open 上着の前をあける, long 上着の丈が腰まである, gun ボルト銃とボンベ }
  function mk(o) {
    const root = new THREE.Group(), J = { root, hipY: HIP };
    const fab = c => { const m = std(c, 0.9); m.map = clothTex(); return m; };
    const mSkin = std(o.skin, 0.68), mTop = fab(o.top), mTop2 = std(o.top2 || o.top), mPants = fab(o.pants), mShoe = std(o.shoe, 0.55), mHair = std(o.hair, 0.45), mDark = std(0x0c0c0e, 0.4), mEye = std(0xd8d4cc, 0.4), mLid = std(o.skin, 0.75);
    mHair.side = THREE.DoubleSide;
    const piv = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const limb = (parent, rt, rb, len, m) => { const g = new THREE.CylinderGeometry(rt, rb, len, 12); g.translate(0, -len / 2, 0); const me = new THREE.Mesh(g, m); parent.add(me); return me; };
    const ball = (parent, r, m, x, y, z, sx, sy, sz) => { const me = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); me.position.set(x, y, z); if (sx) me.scale.set(sx, sy, sz); parent.add(me); return me; };
    const box = (parent, w, h, d, m, x, y, z) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); parent.add(me); return me; };
    const tube = (parent, rt, rb, h, m, y, sz) => { const g = new THREE.CylinderGeometry(rt, rb, h, 18); g.scale(1, 1, sz); const me = new THREE.Mesh(g, m); me.position.y = y; parent.add(me); return me; };
    J.hips = piv(root, 0, HIP, 0); tube(J.hips, 0.172, 0.165, 0.2, mPants, -0.02, 0.68);
    J.spine = piv(J.hips, 0, 0.08, 0);
    tube(J.spine, 0.215, 0.176, 0.5, mTop, 0.25, 0.64);                                   // 胸と腹
    tube(J.spine, 0.19, o.long ? 0.205 : 0.185, o.long ? 0.24 : 0.1, mTop, o.long ? -0.1 : -0.03, 0.68);   // 上着のすそ
    ball(J.spine, 0.078, mTop, -0.205, 0.445, 0); ball(J.spine, 0.078, mTop, 0.205, 0.445, 0);
    tube(J.spine, 0.1, 0.13, 0.05, mTop2, 0.51, 0.75);                                    // えり
    if (o.open) { box(J.spine, 0.1, 0.46, 0.02, mTop2, 0, 0.26, 0.132); for (const s of [-1, 1]) { const l = box(J.spine, 0.06, 0.2, 0.02, mTop, s * 0.062, 0.42, 0.138); l.rotation.z = -s * 0.32; } }
    J.neck = piv(J.spine, 0, 0.53, 0);
    const ng = new THREE.CylinderGeometry(0.056, 0.066, 0.12, 12); ng.translate(0, 0.035, 0); J.neckMesh = new THREE.Mesh(ng, mSkin); J.neckMesh.position.set(0, 0.53, 0); J.spine.add(J.neckMesh);
    // 頭。目は奥まって小さく、まぶたが重い。眉は内がわへ下がる
    J.head = piv(J.neck, 0, 0.07, 0);
    ball(J.head, 0.1, mSkin, 0, 0.105, 0, 0.88, 1.12, 0.98);
    ball(J.head, 0.078, mSkin, 0, 0.04, 0.018, 0.92, 0.9, 0.95);
    ball(J.head, 0.018, mSkin, 0, 0.088, 0.098, 0.78, 1.7, 1.05); ball(J.head, 0.015, mSkin, 0, 0.066, 0.101, 1.35, 0.7, 0.9);
    for (const s of [-1, 1]) {
      ball(J.head, 0.013, mEye, s * 0.037, 0.113, 0.082, 1.55, 0.7, 0.45); ball(J.head, 0.0085, mDark, s * 0.036, 0.112, 0.0875, 1.1, 1, 0.5);
      box(J.head, 0.05, 0.013, 0.02, mLid, s * 0.037, 0.1235, 0.088);
      const br = box(J.head, 0.046, 0.011, 0.016, mHair, s * 0.037, 0.134, 0.093); br.rotation.z = -s * 0.14;
      ball(J.head, 0.02, mSkin, s * 0.09, 0.09, -0.005, 0.5, 1.05, 0.8);
    }
    box(J.head, 0.044, 0.005, 0.008, mDark, 0, 0.039, 0.0905);
    const cap = (th0, th1, ph0, phL) => { const g = new THREE.SphereGeometry(0.109, 20, 14, ph0, phL, th0, th1 - th0); const me = new THREE.Mesh(g, mHair); me.position.set(0, 0.105, -0.004); me.scale.set(0.93, 1.13, 1.04); J.head.add(me); };
    if (o.bob) { cap(0, 1.2, 0, Math.PI * 2); cap(1.12, 2.15, Math.PI / 2 + 0.92, Math.PI * 2 - 1.84); }   // 前髪は眉まで、横とうしろは あごの下まで
    else { cap(0, 0.98, 0, Math.PI * 2); cap(0.92, 1.55, Math.PI / 2 + 1.3, Math.PI * 2 - 2.6); }
    for (const s of [-1, 1]) {
      const n = s > 0 ? 'L' : 'R', sh = piv(J.spine, s * 0.235, 0.44, 0); limb(sh, 0.064, 0.054, 0.3, mTop);
      const el = piv(sh, 0, -0.3, 0); limb(el, 0.052, 0.043, 0.27, mTop); ball(el, 0.054, mTop, 0, 0, 0); ball(el, 0.048, mSkin, 0, -0.31, 0, 0.85, 1.25, 0.55);
      J['sh' + n] = sh; J['el' + n] = el;
      const hp = piv(J.hips, s * 0.095, -0.04, 0); limb(hp, 0.1, 0.075, 0.45, mPants);
      const kn = piv(hp, 0, -0.45, 0); limb(kn, 0.07, 0.052, 0.42, mPants); ball(kn, 0.074, mPants, 0, 0, 0); box(kn, 0.11, 0.1, 0.29, mShoe, 0, -0.44, 0.065);
      J['hip' + n] = hp; J['kn' + n] = kn;
    }
    if (o.gun) {
      // 家畜用のボルト銃（右手）。銃身は前腕の先へ伸びる。空気のボンベは左手にさげている
      const mG = new THREE.MeshStandardMaterial({ color: C3(0x8c9098), roughness: 0.35, metalness: 0.8 }), mT = new THREE.MeshStandardMaterial({ color: C3(0x9a9c9a), roughness: 0.45, metalness: 0.6 });
      const cyl = (parent, r, len, m, y) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m); me.position.set(0, y, 0); parent.add(me); return me; };
      J.gun = piv(J.elR, 0, -0.3, 0.02); cyl(J.gun, 0.027, 0.26, mG, -0.1); cyl(J.gun, 0.04, 0.05, mG, -0.24); box(J.gun, 0.03, 0.09, 0.06, mDark, 0, -0.02, 0.05);
      J.bolt = cyl(J.gun, 0.011, 0.1, mG, -0.25); J.bolt.scale.y = 0.01;
      J.tank = piv(J.elL, 0, -0.34, 0); cyl(J.tank, 0.085, 0.42, mT, -0.24); cyl(J.tank, 0.03, 0.07, mG, -0.02); ball(J.tank, 0.085, mT, 0, -0.45, 0);
      const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(8 * 3), 3));
      J.hose = new THREE.Line(hg, new THREE.LineBasicMaterial({ color: C3(0x0a0a0c) })); J.hose.frustumCulled = false; root.add(J.hose);
    }
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.38, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.015; root.add(sh); J.shadow = sh;
    J.list = [J.hips, J.spine, J.neck, J.head, J.shL, J.shR, J.elL, J.elR, J.hipL, J.hipR, J.knL, J.knR];
    return J;
  }
  function rest(J) { for (const j of J.list) j.rotation.set(0, 0, 0); J.hips.position.set(0, J.hipY, 0); J.neckMesh.rotation.set(0, 0, 0); J.neckMesh.scale.set(1, 1, 1); }
  // 立っている（t で、かすかに息をする）
  function stand(J, t) { rest(J); J.spine.rotation.x = Math.sin(t * 1.5) * 0.012; J.elL.rotation.x = -0.12; J.elR.rotation.x = -0.12; J.shL.rotation.z = 0.05; J.shR.rotation.z = -0.05; }
  // 走る。ph 歩みの位相、amt 0 立ち〜1 全力、load 左手にボンベ・右手に銃を持っている
  function run(J, ph, amt, load) {
    rest(J);
    const s = Math.sin(ph), c = Math.cos(ph);
    J.hips.position.y = J.hipY - 0.045 * amt + Math.abs(c) * 0.06 * amt;
    J.hips.rotation.y = s * 0.1 * amt;
    J.spine.rotation.x = 0.3 * amt; J.spine.rotation.y = -s * 0.2 * amt; J.neck.rotation.x = -0.2 * amt;
    J.hipL.rotation.x = -(s * 1.0 + 0.2) * amt; J.hipR.rotation.x = -(-s * 1.0 + 0.2) * amt;
    J.knL.rotation.x = (0.22 + 1.35 * Math.max(0, c)) * amt; J.knR.rotation.x = (0.22 + 1.35 * Math.max(0, -c)) * amt;
    if (load) { J.shL.rotation.x = s * 0.32 * amt; J.elL.rotation.x = -0.25 * amt; J.shL.rotation.z = 0.12; J.shR.rotation.x = -s * 0.85 * amt; J.elR.rotation.x = -1.2 * amt; }
    else { J.shL.rotation.x = s * 0.95 * amt; J.shR.rotation.x = -s * 0.95 * amt; J.elL.rotation.x = -1.45 * amt; J.elR.rotation.x = -1.45 * amt; }
  }
  // 銃とボンベをつなぐ管（毎フレーム、両端の位置から たるませて引きなおす）
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function hose(J) {
    if (!J.hose) return;
    J.gun.getWorldPosition(_a); J.tank.getWorldPosition(_b); J.root.worldToLocal(_a); J.root.worldToLocal(_b);
    const p = J.hose.geometry.attributes.position;
    for (let i = 0; i < 8; i++) { const u = i / 7; p.setXYZ(i, lerp(_a.x, _b.x, u), lerp(_a.y, _b.y, u) - Math.sin(u * Math.PI) * 0.22, lerp(_a.z, _b.z, u) - Math.sin(u * Math.PI) * 0.08); }
    p.needsUpdate = true;
  }
  const ANTON = { skin: 0xcfa98c, top: 0x1b2536, top2: 0x30363f, pants: 0x1a1d24, shoe: 0x0b0b0c, hair: 0x140e0a, bob: true, open: true, long: true, gun: true };
  const YOU = { skin: 0xd6ab8c, top: 0x8f9499, top2: 0xb8b8b4, pants: 0x343a46, shoe: 0x2a2a2e, hair: 0x15110e };
  return { mk, rest, stand, run, hose, ANTON, YOU };
})();
