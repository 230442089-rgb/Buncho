// ───────── 果てのない世界 ─────────
// 区画は、必要になったときに種（seed）と位置から作る。同じ種・同じ位置・同じ版なら同じものができる。
// エデルから遠く離れた区画は捨てられ、版が 1 つ進む。戻ってきたときには、中身が少し変わっている（更新）。
const World = (() => {
  const cells = new Map(), vers = new Map(), bcache = new Map();
  let seed = 1, sx0 = 0, sy0 = 0, ver = 0, force = null;
  const key = (cx, cy) => cx + ',' + cy;
  const hs = (cx, cy, n) => hash2(cx + sx0, cy + sy0, n);   // 種と位置から決まる乱数
  const mod = (a, n) => ((a % n) + n) % n;

  function biomeAt(cx, cy) {
    if (cx === 0 && cy === 0) return BIOMES.atelier;
    const d = Math.max(Math.abs(cx), Math.abs(cy));
    if (force) return BIOMES[force];
    if (d <= 1) return BIOMES.hall;
    const k = key(cx, cy); let b = bcache.get(k);
    if (b) return b;
    // 4 区画くらいの かたまりごとに種類が変わる。最近ふえた種類は少し出やすい。
    const avail = BIOME_LIST.filter(id => BIOMES[id].ver <= ver);
    if (ver > 0) avail.push(BIOME_LIST.find(id => BIOMES[id].ver === ver) || avail[0]);
    const G = 4, gx = Math.floor(cx / G), gy = Math.floor(cy / G);
    let best = 1e9, pickv = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const px = (gx + dx) * G + hs(gx + dx, gy + dy, 21) * G, py = (gy + dy) * G + hs(gx + dx, gy + dy, 22) * G, dd = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (dd < best) { best = dd; pickv = hs(gx + dx, gy + dy, 23); }
    }
    b = BIOMES[avail[Math.floor(pickv * avail.length)]];
    if (bcache.size > 6000) bcache.clear();
    bcache.set(k, b);
    return b;
  }
  const planAt = (cx, cy, b) => b.corr >= 1 ? 'corr' : b.corr <= 0 ? 'room' : (hs(cx >> 1, cy, 31) < b.corr ? 'corr' : 'room');
  // 西の境（左の区画との間）と、北の境（上の区画との間）。
  // 偶数行は東西に必ず通れる。奇数行の区画は、上の偶数行へ必ず通れる。3 列ごとに、南北に必ず通れる。
  // これで、どの区画にも歩いて行ける（行き止まりの島ができない）。
  function edgeW(cx, cy) {
    const A = biomeAt(cx - 1, cy), B = biomeAt(cx, cy);
    if (A.safe || B.safe) return { type: 'wall' };
    if (!(mod(cy, 2) === 0 || hs(cx, cy, 41) >= Math.max(A.closed, B.closed))) return { type: 'wall' };
    const pa = planAt(cx - 1, cy, A), pb = planAt(cx, cy, B);
    if (A === B && pa === pb && hs(cx, cy, 42) < (pa === 'corr' ? 0.8 : A.open)) return { type: 'open' };
    return { type: 'gap', pos: GAPY, w: 2 };
  }
  function edgeN(cx, cy) {
    if (cx === 0 && cy === 1) return { type: 'gap', pos: 8, w: 2 };   // アトリエの出入り口
    const A = biomeAt(cx, cy - 1), B = biomeAt(cx, cy);
    if (A.safe || B.safe) return { type: 'wall' };
    if (!(mod(cx, 3) === 0 || mod(cy, 2) === 1 || hs(cx, cy, 43) >= Math.max(A.closed, B.closed) + 0.15)) return { type: 'wall' };
    if (A === B && planAt(cx, cy - 1, A) === 'room' && planAt(cx, cy, B) === 'room' && hs(cx, cy, 44) < A.open) return { type: 'open' };
    const w = Math.max(A.gapW || 2, B.gapW || 2);
    return { type: 'gap', pos: 3 + Math.floor(hs(cx, cy, 45) * (CW - 6 - w)), w };
  }

  // 区画の中に物を置くための道具
  function mkR(c) {
    let s = Math.floor(hs(c.cx, c.cy, 51 + c.ver * 7) * 4294967296) >>> 0;
    const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const R = { c, r, i: (a, b) => a + Math.floor(r() * (b - a + 1)), ch: p => r() < p, pk: a => a[Math.floor(r() * a.length)] };
    const ok = (lx, ly, w, h, solid) => {
      for (let yy = ly; yy < ly + h; yy++) for (let xx = lx; xx < lx + w; xx++) {
        if (xx < c.x0 || yy < 0 || xx >= CW || yy >= CH) return false;
        const i = yy * CW + xx;
        if ((c.t[i] !== T_FLOOR && c.t[i] !== T_WATER) || c.occ[i] || (solid && c.res[i])) return false;
      }
      return true;
    };
    const add = (k, lx, ly, ex) => {
      const o = mkObj(Object.assign({ k, x: c.cx * CW + lx, y: c.cy * CH + ly }, ex || {}));
      c.objs.push(o);
      if (o.light) c.lights.push({ x: o.x * 16 + o.light.dx, y: o.y * 16 + o.light.dy, r: o.light.r, c: o.light.c, c2: o.light.c2, flick: o.light.flick ? 1 : 0, o });
      return o;
    };
    R.put = (k, lx, ly, ex) => {
      const p = OBJ[k], w = p.w || 1, h = p.h || 1;
      if (!ok(lx, ly, w, h, true)) return null;
      const o = add(k, lx, ly, ex);
      for (let yy = ly; yy < ly + h; yy++) for (let xx = lx; xx < lx + w; xx++) c.occ[yy * CW + xx] = 1;
      return o;
    };
    R.deco = (k, lx, ly, ex) => { const p = OBJ[k]; return ok(lx, ly, p.w || 1, p.h || 1, false) ? add(k, lx, ly, Object.assign({ solid: false }, ex || {})) : null; };
    R.any = (k, lx, ly, ex) => (lx >= c.x0 && ly >= c.y0 && lx < CW && ly < CH && !c.occ[ly * CW + lx] && c.t[ly * CW + lx] !== T_FLOOR) ? (c.occ[ly * CW + lx] = 1, add(k, lx, ly, ex)) : null;
    R.wall = (k, lx, ex) => {
      if (!c.hasN || c.b.soft) return null;
      const w = OBJ[k].w || 1;
      for (let x = lx; x < lx + w; x++) if (x < Math.max(1, c.x0) || x >= CW || c.wocc[x] || c.t[2 * CW + x] !== T_FACE) return null;
      for (let x = lx; x < lx + w; x++) c.wocc[x] = 1;
      return add(k, lx, 1, ex);
    };
    R.fill = (lx, ly, w, h, code) => {
      for (let yy = ly; yy < ly + h; yy++) for (let xx = lx; xx < lx + w; xx++) {
        if (xx < c.x0 || yy < c.y0 || xx >= CW || yy >= CH) continue;
        const i = yy * CW + xx;
        if (c.occ[i] || c.t[i] === T_CAP || c.t[i] === T_FACE || (T_SOLID[code] && c.res[i])) continue;
        c.t[i] = code;
      }
    };
    R.light = (lx, ly, rad, kind, flick) => c.lights.push({ x: (c.cx * CW + lx) * 16 + 8, y: (c.cy * CH + ly) * 16 + 8, r: rad, c: kind.c, c2: kind.c2, flick: flick ? 1 : 0, o: null });
    R.lamp = (lx, ly, rad, kind) => { if (c.dark) return; const k = r(); if (k < 0.16) return; R.light(lx, ly, rad, kind, k < 0.26); };
    return R;
  }

  function gen(cx, cy) {
    const k = key(cx, cy), b = biomeAt(cx, cy), v = vers.get(k) || 0;
    const c = { cx, cy, ver: v, b, plan: planAt(cx, cy, b), t: new Uint8Array(CW * CH), occ: new Uint8Array(CW * CH), res: new Uint8Array(CW * CH), wocc: new Uint8Array(CW), objs: [], lights: [], layer: null, used: 0 };
    c.eN = edgeN(cx, cy); c.eW = edgeW(cx, cy); c.eS = edgeN(cx, cy + 1); c.eE = edgeW(cx + 1, cy);
    c.hasN = c.eN.type !== 'open'; c.hasW = c.eW.type !== 'open';
    c.x0 = c.hasW ? 1 : 0; c.y0 = c.hasN ? 3 : 0;
    c.dark = !b.outdoor && !b.safe && !b.lit && hs(cx, cy, 61 + v) < 0.12;
    c.amb = c.dark ? mixc(b.amb, '#000000', 0.5) : b.amb;
    const t = c.t, corr = c.plan === 'corr', S = c.eS, set = (x, y, code) => { t[y * CW + x] = code; }, rsv = (x, y) => { if (x >= 0 && y >= 0 && x < CW && y < CH) c.res[y * CW + x] = 1; };
    // 1. 中（廊下型は塊にしてから通路をあける）
    t.fill(corr ? (b.blockLow ? T_LOW : T_BLOCK) : T_FLOOR);
    if (corr) {
      for (let y = BAND0; y <= BAND1; y++) for (let x = 0; x < CW; x++) set(x, y, T_FLOOR);
      if (S.type !== 'wall') for (let y = BAND1 + 1; y < CH; y++) for (let x = S.pos; x < S.pos + S.w; x++) set(x, y, T_FLOOR);
    }
    // 2. 壁（やわらかい種類では、見通せる低い境になる）
    const wc = b.soft ? T_LOW : T_CAP, wf = b.soft ? T_LOW : T_FACE;
    if (c.hasN) {
      for (let x = 0; x < CW; x++) { set(x, 0, wc); set(x, 1, wf); set(x, 2, wf); }
      if (c.eN.type === 'gap') for (let x = c.eN.pos; x < c.eN.pos + c.eN.w; x++) { set(x, 0, T_FLOOR); set(x, 1, T_FLOOR); set(x, 2, T_FLOOR); }
    }
    if (c.hasW) {
      for (let y = c.hasN ? 3 : 0; y < CH; y++) set(0, y, wc);
      if (c.eW.type === 'gap') for (let y = GAPY; y < GAPY + 2; y++) set(0, y, T_FLOOR);
    }
    // 3. 通り道（ここには物を置かない。出入り口どうしが必ずつながる）
    if (!b.safe) for (let x = 0; x < CW; x++) { rsv(x, GAPY); rsv(x, GAPY + 1); }
    if (c.eN.type === 'gap') for (let x = c.eN.pos; x < c.eN.pos + c.eN.w; x++) for (let y = 0; y <= GAPY; y++) rsv(x, y);
    if (c.eN.type === 'open') for (let y = 0; y <= GAPY; y++) { rsv(8, y); rsv(9, y); }
    if (S.type === 'gap') for (let x = S.pos; x < S.pos + S.w; x++) for (let y = GAPY; y < CH; y++) rsv(x, y);
    if (S.type === 'open') for (let y = GAPY; y < CH; y++) { rsv(8, y); rsv(9, y); }
    // 4. 中身
    const R = mkR(c);
    b.gen(c, R);
    // 5. 通れるか・見通せるか
    c.solid = new Uint8Array(CW * CH); c.opq = new Uint8Array(CW * CH); c.grid = new Array(CW * CH).fill(null);
    for (let i = 0; i < CW * CH; i++) { c.solid[i] = T_SOLID[t[i]]; c.opq[i] = T_OPAQUE[t[i]]; }
    for (const o of c.objs) {
      if (o.wall || !o.solid) continue;
      for (let yy = 0; yy < o.h; yy++) for (let xx = 0; xx < o.w; xx++) {
        const lx = o.x - cx * CW + xx, ly = o.y - cy * CH + yy;
        if (lx < 0 || ly < 0 || lx >= CW || ly >= CH) continue;
        c.solid[ly * CW + lx] = 1; if (o.opaque) c.opq[ly * CW + lx] = 1; c.grid[ly * CW + lx] = o;
      }
    }
    // 6. スケッチできる候補。歩いて近づける物からだけ選ぶ（印が付いているのに届かない、を作らない）
    const d = Math.max(Math.abs(cx), Math.abs(cy)), enter = c.eN.type !== 'wall' || c.eW.type !== 'wall' || S.type !== 'wall' || c.eE.type !== 'wall';
    // アトリエを出てすぐの廊下には、かならず 1 つある（最初の 1 つを、すぐ見つけられるように）
    if (b.mats.length && enter && (R.ch(clamp(PRM.candBase + d * PRM.candPerCell, PRM.candBase, PRM.candMax)) || (cx === 0 && cy === 1))) {
      // 通り道（出入り口につながっている）から歩いて行ける所
      const ok = new Uint8Array(CW * CH), q = [];
      for (let i = 0; i < CW * CH; i++) if (c.res[i] && !c.solid[i]) { ok[i] = 1; q.push(i); }
      for (let qi = 0; qi < q.length; qi++) {
        const i = q[qi], x = i % CW, y = (i - x) / CW;
        for (const dr of DIRS) {
          const nx = x + DV[dr][0], ny = y + DV[dr][1];
          if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
          const ni = ny * CW + nx;
          if (!ok[ni] && !c.solid[ni]) { ok[ni] = 1; q.push(ni); }
        }
      }
      const near = o => {
        const lx = o.x - cx * CW, ly = o.y - cy * CH, h = o.wall ? 2 : o.h;
        for (let y = ly - 1; y <= ly + h; y++) for (let x = lx - 1; x <= lx + o.w; x++) if (x >= 0 && y >= 0 && x < CW && y < CH && ok[y * CW + x]) return true;
        return false;
      };
      const ms = b.mats.slice().sort(() => R.r() - 0.5);
      for (const m of ms) {
        const os = c.objs.filter(o => m.on.indexOf(o.k) >= 0 && near(o));
        if (!os.length) continue;
        const o = R.pk(os);
        o.cand = { id: k + ':' + v, n: m.n, k: m.k, c: m.c, s: R.r() };
        if (o.layer === 'bake') o.layer = 'wall';
        break;
      }
    }
    return c;
  }
  function paint(c) {
    const L = mkCanvas(CW * 16, CH * 16), g = L.g, b = c.b;
    for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CW; lx++) {
      const code = c.t[ly * CW + lx], px = lx * 16, py = ly * 16, wx = c.cx * CW + lx, wy = c.cy * CH + ly;
      if (code === T_FLOOR || code === T_WATER || code === T_DEEP) b.floor(g, c, lx, ly, px, py, wx, wy, code);
      else if (code === T_CAP) paintCap(g, c, lx, ly, px, py);
      else if (code === T_FACE) paintFace(g, c, lx, ly, px, py, wx);
      else if (code === T_BLOCK) (b.block || paintBlock)(g, c, lx, ly, px, py, wx, wy);
      else if (code === T_LOW) (b.low || b.block || paintBlock)(g, c, lx, ly, px, py, wx, wy);
    }
    for (const o of c.objs) if (o.layer === 'bake') drawObj(g, o, (o.x - c.cx * CW) * 16, (o.y - c.cy * CH) * 16, 0, 0, false);
    c.layer = L.c;
    return L.c;
  }

  function cell(cx, cy) {
    const k = key(cx, cy); let c = cells.get(k);
    if (!c) { c = gen(cx, cy); cells.set(k, c); }
    return c;
  }
  const cellAt = (wx, wy) => cell(Math.floor(wx / CW), Math.floor(wy / CH));
  const li = (c, wx, wy) => (wy - c.cy * CH) * CW + (wx - c.cx * CW);
  const solid = (wx, wy) => { const c = cellAt(wx, wy); return c.solid[li(c, wx, wy)] === 1; };
  const opaque = (wx, wy) => { const c = cellAt(wx, wy); return c.opq[li(c, wx, wy)] === 1; };
  const water = (wx, wy) => { const c = cellAt(wx, wy); return c.t[li(c, wx, wy)] === T_WATER; };
  const safe = (wx, wy) => !!cellAt(wx, wy).b.safe;
  const objAt = (wx, wy) => { const c = cellAt(wx, wy); return c.grid[li(c, wx, wy)]; };
  // 見通し（タイルの中心どうし）
  function los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) * 4);
    const sx = Math.floor(x0), sy = Math.floor(y0), ex = Math.floor(x1), ey = Math.floor(y1);
    for (let i = 1; i < n; i++) {
      const tx = Math.floor(x0 + dx * i / n), ty = Math.floor(y0 + dy * i / n);
      if ((tx === sx && ty === sy) || (tx === ex && ty === ey)) continue;
      if (opaque(tx, ty)) return false;
    }
    return true;
  }
  // (sx,sy) から歩ける所を近い順にたどる。goal(x, y, 歩数) が true になった所までの道を返す。
  // goal が無ければ、たどれた所の一覧を返す。block(x, y) が true の所は通らない。
  function bfs(sx, sy, maxD, goal, block) {
    const Rr = maxD, W2 = Rr * 2 + 1, prev = new Int32Array(W2 * W2).fill(-1), dist = new Int16Array(W2 * W2), q = [sx, sy], all = [];
    const idx = (x, y) => (y - sy + Rr) * W2 + (x - sx + Rr), st = idx(sx, sy);
    prev[st] = st;
    for (let qi = 0; qi < q.length; qi += 2) {
      const x = q[qi], y = q[qi + 1], ci = idx(x, y), d = dist[ci];
      if (goal) {
        if (ci !== st && goal(x, y, d)) { const out = []; let k = ci; while (k !== st) { out.unshift({ x: (k % W2) - Rr + sx, y: Math.floor(k / W2) - Rr + sy }); k = prev[k]; } return out; }
      } else if (ci !== st) all.push({ x, y, d });
      if (d >= maxD) continue;
      for (const dr of DIRS) {
        const nx = x + DV[dr][0], ny = y + DV[dr][1];
        if (Math.abs(nx - sx) > Rr || Math.abs(ny - sy) > Rr) continue;
        const ni = idx(nx, ny);
        if (prev[ni] !== -1 || solid(nx, ny) || (block && block(nx, ny))) continue;
        prev[ni] = ci; dist[ni] = d + 1; q.push(nx, ny);
      }
    }
    return goal ? null : all;
  }
  // 遠くの区画を捨てて、版を進める（更新）
  function sweep(ex, ey) {
    const ecx = Math.floor(ex / CW), ecy = Math.floor(ey / CH);
    for (const [k, c] of cells) {
      if (c.b.safe || Math.max(Math.abs(c.cx - ecx), Math.abs(c.cy - ecy)) <= 3) continue;
      cells.delete(k); vers.set(k, c.ver + 1);
    }
    if (vers.size > 5000) vers.clear();
  }
  // ソフトの更新: アトリエ以外をぜんぶ作り直す
  function refresh() { for (const [k, c] of cells) { if (c.b.safe) continue; cells.delete(k); vers.set(k, c.ver + 1); } }
  function reset(sd, v) { seed = sd >>> 0; sx0 = seed % 50000; sy0 = Math.floor(seed / 50000) % 50000; ver = v || 0; cells.clear(); vers.clear(); bcache.clear(); }
  function setVer(v) { if (v === ver) return; ver = v; bcache.clear(); }
  function setForce(id) { force = id; bcache.clear(); cells.clear(); }   // 試験用: 全部を 1 種類にする
  // 画面に入る区画
  function visible(camX, camY, m) {
    m = m || 0;
    const out = [], x0 = Math.floor((camX - m) / (CW * 16)), y0 = Math.floor((camY - m) / (CH * 16)), x1 = Math.floor((camX + W - 1 + m) / (CW * 16)), y1 = Math.floor((camY + H - 1 + m) / (CH * 16));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) out.push(cell(cx, cy));
    return out;
  }
  return { cell, cellAt, solid, opaque, water, safe, objAt, los, bfs, sweep, refresh, reset, setVer, setForce, visible, paint, biomeAt, get ver() { return ver; }, get count() { return cells.size; } };
})();
