// ───────── 町（日本のふつうの住宅街）─────────
// 5m ますの格子。道（1）と敷地（0）。道は碁盤の目から何本かを塞いで、丁字路と行き止まりを作る。
// 敷地にはブロック塀と二階建ての家。電柱と電線、街灯、自販機、路面の「止まれ」。
// 絵（テクスチャ）は画像を使わず、その場で描く。
const Town = (() => {
  const T = { N: 31, g: null, group: null, lamps: [], posts: null, home: null, start: null, antonStart: null, seed: 0 };
  const ts = PRM.tile, D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const idx = (x, z) => z * T.N + x;
  const road = (x, z) => x >= 0 && z >= 0 && x < T.N && z < T.N && T.g[idx(x, z)] === 1;
  const tileOf = v => Math.floor(v / ts);
  let shared = null;

  // ── 絵 ──
  function mkTex(w, h, fn, rx, ry) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); }
    return t;
  }
  const speck = (g, w, h, n, cols, s) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, s, s); } };
  function mkShared() {
    const S = {};
    S.asphalt = mkTex(256, 256, (g, w, h) => {
      g.fillStyle = '#34353a'; g.fillRect(0, 0, w, h); speck(g, w, h, 9000, ['#404147', '#2a2b2f', '#4a4b52', '#25262a'], 1.6);
      g.strokeStyle = '#1e1f22'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += Math.random() * 30 - 15; y += Math.random() * 30 - 15; g.lineTo(x, y); } g.stroke(); }
    }, T.N * 1.5, T.N * 1.5);
    S.block = mkTex(256, 128, (g, w, h) => {
      g.fillStyle = '#8f8e88'; g.fillRect(0, 0, w, h); speck(g, w, h, 5000, ['#9a9992', '#84837d', '#a3a29a', '#7b7a74'], 2);
      g.fillStyle = '#5e5d58'; const ch = h / 7;
      for (let r = 0; r <= 7; r++) g.fillRect(0, Math.round(r * ch) - 1, w, 2);
      for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) g.fillRect(Math.round((c + (r & 1) * 0.5) * 64) % w, Math.round(r * ch), 2, Math.ceil(ch));
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(30,30,28,0.35)'); gr.addColorStop(0.25, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,24,18,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, 3, 1);
    S.stop = mkTex(256, 512, (g, w, h) => {   // 路面の「止まれ」。運転席から読めるように、縦に長く描いてある
      g.clearRect(0, 0, w, h); g.fillStyle = '#e8e6dc'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 150px "Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","Noto Sans JP","Noto Sans CJK JP",sans-serif';
      Array.from('止まれ').forEach((ch, i) => { g.save(); g.translate(w / 2, 86 + i * 170); g.scale(1.25, 1.12); g.fillText(ch, 0, 0); g.restore(); });
      g.globalCompositeOperation = 'destination-out'; speck(g, w, h, 2600, ['rgba(0,0,0,0.8)'], 3); g.globalCompositeOperation = 'source-over';
    });
    S.vend = mkTex(128, 256, (g, w, h) => {
      g.fillStyle = '#f4f6fb'; g.fillRect(0, 0, w, h); g.fillStyle = '#dfe6f2'; g.fillRect(6, 8, w - 12, 150);
      const cols = ['#d83a30', '#2a6ad8', '#e8b020', '#28a060', '#f0f0f0', '#7a3ad0', '#e87020', '#30b8d0'];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { g.fillStyle = cols[(r * 3 + c * 5) % cols.length]; g.fillRect(12 + c * 18, 16 + r * 48, 12, 30); g.fillStyle = '#ffffff'; g.fillRect(12 + c * 18, 50 + r * 48, 12, 5); }
      g.fillStyle = '#c8d0de'; g.fillRect(6, 166, w - 12, 34); g.fillStyle = '#20242c'; g.fillRect(14, 208, w - 28, 34); g.fillStyle = '#e8a020'; g.fillRect(90, 172, 20, 8);
    });
    S.glow = mkTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    S.name = mkTex(128, 48, (g, w, h) => { g.fillStyle = '#e9e6dc'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1c1c'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 30px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif'; g.fillText('自 宅', w / 2, h / 2 + 2); });
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.92, metalness: 0 }, o));
    S.mRoad = std({ map: S.asphalt, roughness: 0.86 });
    S.mLot = std({ color: C3(0x4c4a45) });
    S.mWall = std({ map: S.block });
    S.mHouse = std({ color: C3(0xffffff) });
    S.mRoof = std({ color: C3(0x23252b), roughness: 0.7 });
    S.mLine = new THREE.MeshBasicMaterial({ color: C3(0x8f8f86) });
    S.mStop = new THREE.MeshBasicMaterial({ map: S.stop, transparent: true, alphaTest: 0.35, color: C3(0x9a9a92), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    S.mPole = std({ color: C3(0x7c7a73) });
    S.mMetal = std({ color: C3(0x555860), roughness: 0.5, metalness: 0.4 });
    S.mWin = new THREE.MeshBasicMaterial({ color: C3(0xffffff) });
    S.mBulb = new THREE.MeshBasicMaterial({ color: C3(0xfff0c8) });
    S.mVendB = std({ color: C3(0xffffff), roughness: 0.5 });
    S.mVendF = new THREE.MeshBasicMaterial({ map: S.vend });
    S.mWire = new THREE.LineBasicMaterial({ color: C3(0x0c0d10) });
    S.mDoor = std({ color: C3(0x5a3a22), roughness: 0.6 });
    S.mName = new THREE.MeshBasicMaterial({ map: S.name });
    S.mPorch = new THREE.MeshBasicMaterial({ color: C3(0xffd28a) });
    S.mMirror = new THREE.MeshBasicMaterial({ color: C3(0x6f8494) });
    S.mPool = new THREE.MeshBasicMaterial({ map: S.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    S.mOrange = std({ color: C3(0xd8701c), roughness: 0.6 });
    S.box = new THREE.BoxGeometry(1, 1, 1);
    S.cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    S.flat = new THREE.PlaneGeometry(1, 1); S.flat.rotateX(-Math.PI / 2);   // 地面に寝かせた板（上が -Z 向き）
    S.quad = new THREE.PlaneGeometry(1, 1);                                  // 立てた板（+Z 向き）
    return S;
  }

  // 同じ形をたくさん置くための入れ物（1 種類 1 回の描画で済む）
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  function inst(geo, mat, cap) {
    const mesh = new THREE.InstancedMesh(geo, mat, cap); let n = 0;
    return {
      add(x, y, z, sx, sy, sz, ry, col) {
        if (n >= cap) return;
        _e.set(0, ry || 0, 0); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz); _m.compose(_p, _q, _s); mesh.setMatrixAt(n, _m);
        mesh.setColorAt(n, _c.set(col === undefined ? 0xffffff : col).convertSRGBToLinear());   // 色なしは白（素材の色のまま）
        n++;
      },
      done(group) { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.frustumCulled = false; group.add(mesh); },
    };
  }

  // 道のりを、歩数で出す（道の上だけ）
  function bfs(sx, sz) {
    const d = new Int16Array(T.N * T.N).fill(-1), q = [sx, sz]; d[idx(sx, sz)] = 0;
    for (let i = 0; i < q.length; i += 2) { const x = q[i], z = q[i + 1], c = d[idx(x, z)]; for (const v of D4) { const nx = x + v[0], nz = z + v[1]; if (road(nx, nz) && d[idx(nx, nz)] < 0) { d[idx(nx, nz)] = c + 1; q.push(nx, nz); } } }
    return d;
  }
  const nbr = (x, z) => D4.filter(v => road(x + v[0], z + v[1])).length;

  // ── 町を作る ──
  function gen(seed, homeDist) {
    if (!shared) shared = mkShared();
    const S = shared, R = mulberry(seed), N = T.N, g = T.g = new Uint8Array(N * N);
    T.seed = seed;
    const lines = () => { const a = []; let p = 2 + Math.floor(R() * 2); while (p <= N - 3) { a.push(p); p += 3 + Math.floor(R() * 3); } return a; };
    const rows = lines(), cols = lines();
    for (const r of rows) for (let x = cols[0]; x <= cols[cols.length - 1]; x++) g[idx(x, r)] = 1;
    for (const c of cols) for (let z = rows[0]; z <= rows[rows.length - 1]; z++) g[idx(c, z)] = 1;
    const connected = () => { const d = bfs(cols[0], rows[0]); for (let i = 0; i < g.length; i++) if (g[i] && d[i] < 0) return false; return true; };
    const segs = [];
    for (const r of rows) for (let i = 0; i + 1 < cols.length; i++) segs.push({ h: 1, k: r, a: cols[i] + 1, b: cols[i + 1] - 1 });
    for (const c of cols) for (let i = 0; i + 1 < rows.length; i++) segs.push({ h: 0, k: c, a: rows[i] + 1, b: rows[i + 1] - 1 });
    for (let i = segs.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = segs[i]; segs[i] = segs[j]; segs[j] = t; }
    let cut = 0; const want = Math.floor(segs.length * 0.24);
    for (const s of segs) {
      if (cut >= want) break;
      const b = R() < 0.35 ? Math.floor((s.a + s.b) / 2) : s.b, saved = [];   // 半分だけ塞ぐと、行き止まりになる
      for (let k = s.a; k <= b; k++) { const i = s.h ? idx(k, s.k) : idx(s.k, k); saved.push(i); g[i] = 0; }
      if (connected()) cut++; else for (const i of saved) g[i] = 1;
    }
    // はじまりの場所、彼の立つ場所、自宅
    const sc = cols[cols.length >> 1], sr = rows[rows.length >> 1], dist = bfs(sc, sr);
    T.start = { tx: sc, tz: sr };
    let best = null;
    for (const v of D4) { let k = 0; while (road(sc + v[0] * (k + 1), sr + v[1] * (k + 1)) && k < PRM.antonStart + 1) k++; if (!best || k > best.k) best = { k, v }; }
    if (best.k >= 5) T.antonStart = { tx: sc + best.v[0] * best.k, tz: sr + best.v[1] * best.k };
    else { let far = null; for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (dist[idx(x, z)] === PRM.antonStart) far = { tx: x, tz: z }; T.antonStart = far || { tx: sc + best.v[0] * best.k, tz: sr + best.v[1] * best.k }; }
    // 自宅は、彼の立つ場所より、こちらに近い側に置く（はじめから、彼の脇を抜けないと帰れない町にはしない）
    const dA = bfs(T.antonStart.tx, T.antonStart.tz), cand = [], cand2 = []; let maxD = 0, maxT = null;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const d = dist[idx(x, z)]; if (d < 0) continue;
      const lot = D4.find(v => !road(x + v[0], z + v[1]) && x + v[0] > 0 && z + v[1] > 0 && x + v[0] < N - 1 && z + v[1] < N - 1); if (!lot) continue;
      const away = dA[idx(x, z)] - d;
      if (away >= 0 && d <= homeDist + 2 && d > maxD) { maxD = d; maxT = { tx: x, tz: z, v: lot }; }
      if (d >= homeDist - 1 && d <= homeDist + 2 && nbr(x, z) <= 2) { if (away >= 3) cand.push({ tx: x, tz: z, v: lot }); else if (away >= 0) cand2.push({ tx: x, tz: z, v: lot }); }
    }
    const pool = cand.length ? cand : cand2, h = pool.length ? pool[Math.floor(R() * pool.length)] : maxT;
    T.home = { tx: h.tx, tz: h.tz, nx: h.v[0], nz: h.v[1], x: (h.tx + 0.5 + h.v[0] * 0.5) * ts, z: (h.tz + 0.5 + h.v[1] * 0.5) * ts, dist: dist[idx(h.tx, h.tz)] };

    // ── 見た目を組む ──
    if (T.group) { T.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); else if (o.isLineSegments) o.geometry.dispose(); }); if (T.group.parent) T.group.parent.remove(T.group); }
    const G = T.group = new THREE.Group(); T.lamps = []; T.posts = new Map();
    const post = (x, z, r) => { const k = idx(tileOf(x), tileOf(z)); if (!T.posts.has(k)) T.posts.set(k, []); T.posts.get(k).push({ x, z, r }); };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(N * ts, N * ts), S.mRoad); ground.rotation.x = -Math.PI / 2; ground.position.set(N * ts / 2, 0, N * ts / 2); G.add(ground);
    const lots = inst(S.box, S.mLot, N * N), walls = inst(S.box, S.mWall, 1400), houses = inst(S.box, S.mHouse, N * N), roofs = inst(S.box, S.mRoof, N * N), balc = inst(S.box, S.mHouse, 500);
    const wins = inst(S.quad, S.mWin, 3600), linesI = inst(S.box, S.mLine, 1600), stops = inst(S.flat, S.mStop, 80), poles = inst(S.cyl, S.mPole, 400), arms = inst(S.box, S.mMetal, 600), bulbs = inst(S.box, S.mBulb, 200);
    const pools = inst(S.flat, S.mPool, 320);
    const vendB = inst(S.box, S.mVendB, 40), vendF = inst(S.quad, S.mVendF, 40), mirP = inst(S.cyl, S.mOrange, 40), mirD = inst(S.box, S.mMirror, 40);
    const HCOL = [0xb9b3a4, 0xa8a59c, 0xc4bca8, 0x9aa0a4, 0xb0a696, 0x8d8a84, 0xc9c5ba, 0xa39684], poleList = [];
    const cx = x => (x + 0.5) * ts;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const wx = cx(x), wz = cx(z);
      if (!road(x, z)) {
        const faces = D4.filter(v => road(x + v[0], z + v[1])), near = faces.length > 0 || D4.some(v => D4.some(u => road(x + v[0] + u[0], z + v[1] + u[1])));
        if (!near) continue;   // 道から見えない奥の敷地は作らない
        lots.add(wx, 0.06, wz, ts, 0.12, ts, 0);
        for (const v of faces) walls.add(wx + v[0] * (ts / 2 - 0.08), 0.67, wz + v[1] * (ts / 2 - 0.08), v[0] ? 0.15 : ts, 1.35, v[0] ? ts : 0.15, 0);
        const isHome = T.home.tx + T.home.nx === x && T.home.tz + T.home.nz === z;
        if (R() < 0.1 && !isHome) continue;   // 空き地
        const w = 3.5 + R() * 0.6, d = 3.5 + R() * 0.6, hh = R() < 0.14 && !isHome ? 3.3 : 5.5 + R() * 1.3, ox = (R() - 0.5) * 0.5, oz = (R() - 0.5) * 0.5, col = HCOL[Math.floor(R() * HCOL.length)];
        houses.add(wx + ox, 0.12 + hh / 2, wz + oz, w, hh, d, 0, col);
        roofs.add(wx + ox, 0.12 + hh + 0.11, wz + oz, w + 0.5, 0.22, d + 0.5, 0);
        roofs.add(wx + ox, 0.12 + hh + 0.32, wz + oz, w * 0.6, 0.22, d * 0.6, 0);
        for (const v of faces) {
          const ry = Math.atan2(v[0], v[1]), fx = wx + ox + v[0] * (v[0] ? w / 2 + 0.02 : 0), fz = wz + oz + v[1] * (v[1] ? d / 2 + 0.02 : 0), sx = v[1], sz = v[0], span = (v[0] ? d : w) * 0.27;
          for (const fl of hh > 4 ? [1.75, 4.35] : [1.75]) for (const k of [-1, 1]) {
            if (R() < 0.18) continue;
            wins.add(fx + sx * span * k, 0.12 + fl, fz + sz * span * k, 1.05, 0.95, 1, ry, (isHome || R() < 0.3) ? [0xe0a050, 0xd89848, 0xeab868][Math.floor(R() * 3)] : 0x141a24);
          }
          if (hh > 4 && R() < 0.5) balc.add(fx + v[0] * 0.38, 3.35, fz + v[1] * 0.38, v[0] ? 0.76 : w * 0.7, 0.9, v[0] ? d * 0.7 : 0.76, 0, 0x9c9a94);
        }
        continue;
      }
      // 道: 端の白線、「止まれ」、電柱、自販機
      const n = nbr(x, z);
      for (const v of D4) if (!road(x + v[0], z + v[1])) linesI.add(wx + v[0] * (ts / 2 - 0.42), 0.008, wz + v[1] * (ts / 2 - 0.42), v[0] ? 0.11 : ts, 0.012, v[0] ? ts : 0.11, 0);
      if (n >= 3) {
        for (const v of D4) if (road(x + v[0], z + v[1]) && nbr(x + v[0], z + v[1]) === 2 && R() < 0.4) stops.add(wx + v[0] * ts * 0.82, 0.02, wz + v[1] * ts * 0.82, 1.9, 1, 3.2, Math.atan2(v[0], v[1]));
        const c = [[1, 1], [1, -1], [-1, 1], [-1, -1]][Math.floor(R() * 4)];
        poleList.push({ x: wx + c[0] * (ts / 2 - 0.42), z: wz + c[1] * (ts / 2 - 0.42), lamp: R() < 0.7, inx: -c[0], inz: -c[1] });
        if (R() < 0.3) { const m = [[1, 1], [1, -1], [-1, 1], [-1, -1]][Math.floor(R() * 4)], mx = wx + m[0] * (ts / 2 - 0.3), mz = wz + m[1] * (ts / 2 - 0.3); mirP.add(mx, 1.35, mz, 0.04, 2.7, 0.04, 0); mirD.add(mx - m[0] * 0.1, 2.75, mz - m[1] * 0.1, 0.62, 0.62, 0.06, Math.atan2(-m[0], -m[1])); post(mx, mz, 0.1); }
      } else if (n === 2) {
        const side = D4.find(v => !road(x + v[0], z + v[1]));
        if (side && (x + z) % 3 === 0) poleList.push({ x: wx + side[0] * (ts / 2 - 0.42), z: wz + side[1] * (ts / 2 - 0.42), lamp: R() < 0.45, inx: -side[0], inz: -side[1] });
        else if (side && R() < 0.07 && !(x === T.home.tx && z === T.home.tz)) {
          const vx = wx + side[0] * (ts / 2 - 0.42), vz = wz + side[1] * (ts / 2 - 0.42), ry = Math.atan2(-side[0], -side[1]);
          vendB.add(vx, 0.92, vz, side[0] ? 0.72 : 1.0, 1.83, side[0] ? 1.0 : 0.72, 0, [0xf2f2f2, 0xc8322c, 0x2c5ac8][Math.floor(R() * 3)]);
          vendF.add(vx - side[0] * 0.37, 0.95, vz - side[1] * 0.37, 0.9, 1.7, 1, ry);
          T.lamps.push({ x: vx - side[0] * 0.9, y: 1.3, z: vz - side[1] * 0.9, c: 0xcfe2ff, p: 0.7 }); post(vx, vz, 0.55);
        }
      }
    }
    // 彼の立つ場所と、はじまりの場所は、かならず街灯で照らす
    for (const q of [T.antonStart, T.start]) { const v = D4.find(u => !road(q.tx + u[0], q.tz + u[1])) || [1, 0], c = v[0] ? [v[0], 0.7] : [0.7, v[1]]; poleList.push({ x: cx(q.tx) + c[0] * (ts / 2 - 0.42), z: cx(q.tz) + c[1] * (ts / 2 - 0.42), lamp: true, inx: -Math.sign(c[0]), inz: -Math.sign(c[1]) }); }
    for (const p of poleList) {
      poles.add(p.x, 4.25, p.z, 0.13, 8.5, 0.13, 0); arms.add(p.x, 7.9, p.z, 1.5, 0.09, 0.09, R() * 3); post(p.x, p.z, 0.2);
      if (R() < 0.3) poles.add(p.x + 0.25, 6.7, p.z, 0.26, 0.7, 0.26, 0, 0x8a8c90);
      if (p.lamp) {
        const m = Math.hypot(p.inx, p.inz) || 1, ix = p.inx / m, iz = p.inz / m, ry = Math.atan2(ix, iz);
        arms.add(p.x + ix * 0.55, 5.7, p.z + iz * 0.55, 0.07, 0.07, 1.1, ry); bulbs.add(p.x + ix * 1.05, 5.62, p.z + iz * 1.05, 0.22, 0.1, 0.5, ry);
        T.lamps.push({ x: p.x + ix * 1.05, y: 5.5, z: p.z + iz * 1.05, c: 0xffe0aa, p: 1 });
      }
    }
    // 電線（近い電柱どうしを、少したるませてつなぐ）
    const wp = [];
    for (const a of poleList) for (const ax of [0, 1]) {
      let bst = null, bd = 17;
      for (const b of poleList) { const du = ax ? b.z - a.z : b.x - a.x, dv = ax ? Math.abs(b.x - a.x) : Math.abs(b.z - a.z); if (du > 1 && du < bd && dv < 4.5) { bd = du; bst = b; } }
      if (bst) for (const y of [8.0, 7.35]) { const mx = (a.x + bst.x) / 2, mz = (a.z + bst.z) / 2; wp.push(a.x, y, a.z, mx, y - 0.4, mz, mx, y - 0.4, mz, bst.x, y, bst.z); }
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); G.add(new THREE.LineSegments(wg, S.mWire));
    // 自宅: 門と、門灯と、表札
    const hm = T.home, ry = Math.atan2(-hm.nx, -hm.nz), px = hm.nz, pz = hm.nx, gx = hm.x + hm.nx * 0.02, gz = hm.z + hm.nz * 0.02;
    const door = new THREE.Mesh(S.box, S.mDoor); door.scale.set(hm.nx ? 0.12 : 1.1, 1.95, hm.nx ? 1.1 : 0.12); door.position.set(gx, 0.98, gz); G.add(door);
    const knob = new THREE.Mesh(S.box, S.mMetal); knob.scale.set(hm.nx ? 0.07 : 0.045, 0.24, hm.nx ? 0.045 : 0.07); knob.position.set(gx + px * 0.4 - hm.nx * 0.09, 1.02, gz + pz * 0.4 - hm.nz * 0.09); G.add(knob);
    const slot = new THREE.Mesh(S.box, S.mRoof); slot.scale.set(hm.nx ? 0.03 : 0.3, 0.05, hm.nx ? 0.3 : 0.03); slot.position.set(gx - hm.nx * 0.065, 1.1, gz - hm.nz * 0.065); G.add(slot);
    for (const k of [-1, 1]) { const pp = new THREE.Mesh(S.box, S.mPole); pp.scale.set(0.26, 2.15, 0.26); pp.position.set(gx + px * 0.7 * k, 1.07, gz + pz * 0.7 * k); G.add(pp); }
    const lampM = new THREE.Mesh(S.box, S.mPorch); lampM.scale.set(0.2, 0.26, 0.2); lampM.position.set(gx + px * 0.7, 2.3, gz + pz * 0.7); G.add(lampM);
    const plate = new THREE.Mesh(S.quad, S.mName); plate.scale.set(0.42, 0.16, 1); plate.rotation.y = ry; plate.position.set(gx - px * 0.7 - hm.nx * 0.14, 1.5, gz - pz * 0.7 - hm.nz * 0.14); G.add(plate);
    T.lamps.push({ x: gx - hm.nx * 0.9, y: 2.2, z: gz - hm.nz * 0.9, c: 0xffc070, p: 1.25, home: true });
    // 明かりの下の路面は、遠くからでも明るく見える（ほんとうに光らせるのは近くの明かりだけなので、絵で足す）
    for (const l of T.lamps) { const r = l.home ? 5 : l.y > 3 ? 11 : 5.5; pools.add(l.x, 0.013, l.z, r, 1, r, 0, l.home ? 0x6a4c22 : l.y > 3 ? 0x62502f : 0x2c3a50); }
    for (const o of [lots, walls, houses, roofs, balc, wins, linesI, stops, pools, poles, arms, bulbs, vendB, vendF, mirP, mirD]) o.done(G);
    return T;
  }

  // ── 当たり・見通し ──
  const solidAt = (x, z) => !road(tileOf(x), tileOf(z));
  // 半径 r の体を、敷地と電柱・自販機から押しだす
  function collide(p, r) {
    const x0 = tileOf(p.x - r), x1 = tileOf(p.x + r), z0 = tileOf(p.z - r), z1 = tileOf(p.z + r);
    for (let tz = z0; tz <= z1; tz++) for (let tx = x0; tx <= x1; tx++) {
      if (road(tx, tz)) continue;
      const qx = clamp(p.x, tx * ts, (tx + 1) * ts), qz = clamp(p.z, tz * ts, (tz + 1) * ts), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x = qx + dx / d * r; p.z = qz + dz / d * r; }
      else { const ex = Math.min(p.x - tx * ts, (tx + 1) * ts - p.x), ez = Math.min(p.z - tz * ts, (tz + 1) * ts - p.z); if (ex < ez) p.x += (p.x - (tx + 0.5) * ts < 0 ? -1 : 1) * (ex + r); else p.z += (p.z - (tz + 0.5) * ts < 0 ? -1 : 1) * (ez + r); }
    }
    const ps = T.posts.get(idx(tileOf(p.x), tileOf(p.z)));
    if (ps) for (const o of ps) { const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + r; if (d < m && d > 1e-6) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; } }
  }
  function los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, n = Math.ceil(Math.hypot(dx, dz) / 0.6);
    for (let i = 1; i < n; i++) if (solidAt(x0 + dx * i / n, z0 + dz * i / n)) return false;
    return true;
  }
  // 近い順に n 個の明かり（街灯・自販機・門灯）。自宅の門灯はいつも入れる
  function lampsNear(x, z, n) {
    for (const l of T.lamps) l.d = (l.x - x) * (l.x - x) + (l.z - z) * (l.z - z) - (l.home ? 1e6 : 0);
    return T.lamps.slice().sort((a, b) => a.d - b.d).slice(0, n);
  }
  return Object.assign(T, { gen, bfs, road, idx, tileOf, solidAt, collide, los, lampsNear, D4, ts });
})();
