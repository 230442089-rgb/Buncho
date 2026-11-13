// ───────── 世界（当たり、見通し、道のり、扉、通風口）─────────
const World = (() => {
  const Wd = { w: 0, h: 0, layer: null, props: [], lights: [], marks: {}, doors: [], vents: [], st: 0, dropRow: 0 };
  let t = [], sol, opq, doorIx, gates = [];
  const SOLID = { '#': 1, 'V': 1, 'w': 1, 'r': 1, 'R': 1, ' ': 1, 'H': 1 }, OPQ = { '#': 1, 'V': 1 };
  const idx = (x, y) => y * Wd.w + x, inb = (x, y) => x >= 0 && y >= 0 && x < Wd.w && y < Wd.h;
  const get = (x, y) => (inb(x, y) ? t[idx(x, y)] : ' ');

  function load(def, st) {
    const M = def.build();
    Wd.w = M.w; Wd.h = M.h; Wd.st = st; Wd.marks = M.marks; Wd.lights = M.lights.slice(); Wd.dropRow = def.dropRow || 0;
    t = M.t; sol = new Uint8Array(M.w * M.h); opq = new Uint8Array(M.w * M.h); doorIx = new Array(M.w * M.h).fill(null);
    Wd.doors = []; Wd.vents = []; Wd.props = []; gates = [];
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      const ch = t[idx(x, y)], i = idx(x, y);
      sol[i] = SOLID[ch] ? 1 : 0; opq[i] = OPQ[ch] ? 1 : 0;
      if (ch === 'D') { const d = { tx: x, ty: y, st: 1, horiz: !!SOLID[get(x - 1, y)] && !!SOLID[get(x + 1, y)] }; Wd.doors.push(d); doorIx[i] = d; }   // horiz: 横向きの壁にある扉（上下に通る）
      else if (ch === 'V') Wd.vents.push({ tx: x, ty: y });
      else if (ch === 'H') gates.push({ tx: x, ty: y });
    }
    for (const p of M.props) addProp(p.k, p.x, p.y);
    const L = mkCanvas(M.w * 16, M.h * 16);
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) Art.tile(L.g, t[idx(x, y)], x * 16, y * 16, x, y, st, get);
    Wd.layer = L.c; Wd.layerG = L.g;
  }
  function addProp(k, x, y) {
    const d = Art.props[k], o = { k, x, y, w: d.w, h: d.h, spr: d.spr, solid: d.solid, opq: d.opq };
    Wd.props.push(o);
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) if (inb(x + i, y + j)) { if (d.solid) sol[idx(x + i, y + j)] = 1; if (d.opq) opq[idx(x + i, y + j)] = 1; }
    return o;
  }
  // 遮断機を上げる
  function openGate() { for (const g of gates) { const i = idx(g.tx, g.ty); sol[i] = 0; t[i] = 'e'; Art.tile(Wd.layerG, 'e', g.tx * 16, g.ty * 16, g.tx, g.ty, Wd.st, get); } gates = []; }
  const gateClosed = () => gates.length > 0, gateTiles = () => gates;

  const doorAt = (x, y) => (inb(x, y) ? doorIx[idx(x, y)] : null);
  const doorShut = d => d.st === 1 || d.st === 2;
  // 通れない所（閉じた扉もふくむ）
  function solid(x, y) { if (!inb(x, y)) return true; const i = idx(x, y); if (sol[i]) return true; const d = doorIx[i]; return !!d && doorShut(d); }
  // 壁と物だけ（扉は開けられるので数えない）。シガーの道さがし用
  const wall = (x, y) => !inb(x, y) || sol[idx(x, y)] === 1;
  function opaque(x, y) { if (!inb(x, y)) return true; const i = idx(x, y); if (opq[i]) return true; const d = doorIx[i]; return !!d && doorShut(d); }
  // 半径 r の体が (x, y) に立てるか
  function blocked(x, y, r) { return solid(Math.floor(x - r), Math.floor(y - r)) || solid(Math.floor(x + r), Math.floor(y - r)) || solid(Math.floor(x - r), Math.floor(y + r)) || solid(Math.floor(x + r), Math.floor(y + r)); }
  // 見通し
  function los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) * 5);
    for (let i = 1; i < n; i++) if (opaque(Math.floor(x0 + dx * i / n), Math.floor(y0 + dy * i / n))) return false;
    return true;
  }
  // 行き先（goals: [[tx, ty], …]）からの道のりを、全部のタイルについて出す。
  // 閉じた扉は少し、鍵のかかった扉は錠を抜く時間のぶんだけ遠い。
  function field(goals) {
    const F = new Float64Array(Wd.w * Wd.h).fill(Infinity), hc = [], hi = [];   // 64 ビットで持つ（32 ビットだと、扉の端数で比べ間違える）
    const push = (c, i) => { let k = hc.length; hc.push(c); hi.push(i); while (k > 0) { const p = (k - 1) >> 1; if (hc[p] <= c) break; hc[k] = hc[p]; hi[k] = hi[p]; k = p; } hc[k] = c; hi[k] = i; };
    const pop = () => {
      const c0 = hc[0], i0 = hi[0], c = hc.pop(), i = hi.pop(), n = hc.length;
      if (n) { let k = 0; for (;;) { let m = k * 2 + 1; if (m >= n) break; if (m + 1 < n && hc[m + 1] < hc[m]) m++; if (hc[m] >= c) break; hc[k] = hc[m]; hi[k] = hi[m]; k = m; } hc[k] = c; hi[k] = i; }
      return [c0, i0];
    };
    for (const gl of goals) if (inb(gl[0], gl[1]) && !sol[idx(gl[0], gl[1])]) { F[idx(gl[0], gl[1])] = 0; push(0, idx(gl[0], gl[1])); }
    while (hc.length) {
      const [c, i] = pop();
      if (c > F[i]) continue;
      const x = i % Wd.w, y = (i - x) / Wd.w, d = doorIx[i], nc = c + 1 + (d ? (d.st === 2 ? 7 : d.st === 1 ? 0.7 : 0) : 0);
      if (x > 0 && !sol[i - 1] && nc < F[i - 1]) { F[i - 1] = nc; push(nc, i - 1); }
      if (x < Wd.w - 1 && !sol[i + 1] && nc < F[i + 1]) { F[i + 1] = nc; push(nc, i + 1); }
      if (y > 0 && !sol[i - Wd.w] && nc < F[i - Wd.w]) { F[i - Wd.w] = nc; push(nc, i - Wd.w); }
      if (y < Wd.h - 1 && !sol[i + Wd.w] && nc < F[i + Wd.w]) { F[i + Wd.w] = nc; push(nc, i + Wd.w); }
    }
    return F;
  }
  // そばにある、開いている扉（閉めて鍵をかけられる）。壊れた扉は閉まらない
  function openDoorNear(px, py) {
    let best = null, bd = 1.15;
    for (const d of Wd.doors) { if (d.st !== 0) continue; const dd = Math.hypot(d.tx + 0.5 - px, d.ty + 0.5 - py); if (dd < bd && dd > 0.62) { best = d; bd = dd; } }
    return best;
  }
  // 通風口の前に立っているか（壁のすぐ上か下のタイル）
  function ventNear(px, py) {
    const tx = Math.floor(px), ty = Math.floor(py);
    for (const v of Wd.vents) if (v.tx === tx && Math.abs(v.ty - ty) === 1 && Math.abs(px - (v.tx + 0.5)) < 0.6) return v;
    return null;
  }
  const ventAccess = v => [[v.tx, v.ty - 1], [v.tx, v.ty + 1]].filter(p => !wall(p[0], p[1]));
  // 欄干を越えられる所の、すぐ上に立っているか
  const dropNear = (px, py) => get(Math.floor(px), Math.floor(py) + 1) === 'R' && Math.abs(px - (Math.floor(px) + 0.5)) < 0.45;
  const slowAt = (x, y) => (get(Math.floor(x), Math.floor(y)) === 'm' ? 0.7 : 1);   // ぬかるみ
  function surface(x, y) {
    const ch = get(Math.floor(x), Math.floor(y));
    if (ch === '~') return 'sand'; if (ch === '.' || ch === 'D') return 'carpet'; if (ch === ',') return 'tile';
    if (ch === '_') return Wd.st === 1 ? 'carpet' : 'road'; if (ch === 'e' || ch === 'E') return 'deck'; if (ch === 'm' || ch === 'S') return 'mud';
    return 'road';
  }
  // 印（地図に付けた名前つきの四角）までの距離
  function markDist(name, px, py) { const m = Wd.marks[name]; if (!m) return 99; const dx = Math.max(m.x - px, 0, px - (m.x + m.w)), dy = Math.max(m.y - py, 0, py - (m.y + m.h)); return Math.hypot(dx, dy); }
  return Object.assign(Wd, { load, addProp, openGate, gateClosed, gateTiles, get, idx, inb, doorAt, doorShut, solid, wall, opaque, blocked, los, field, openDoorNear, ventNear, ventAccess, dropNear, slowAt, surface, markDist });
})();
