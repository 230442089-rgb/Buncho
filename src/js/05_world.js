// ───────── 素材・作品・部屋の描き方 ─────────
// 素材は 7 つ。エデルの能力（事象の造形）の種類に対応させてある。
const MATS = [
  { id: 'yohaku', name: '余白', type: '存在の断片化', src: 'からっぽの額縁', memo: 'なにも 入っていない。なにも 入っていない ことが、入っている。', col: '#fff' },
  { id: 'iro', name: '行き止まりの色', type: '確率の彩色', src: 'あかない扉', memo: 'つづかなかった ほうの 色。', col: '#f6c' },
  { id: 'akari', name: '帰り道の灯', type: '記憶の編纂', src: 'ちらつく街灯', memo: 'だれかが 家へ 帰った ときの 明るさ。', col: '#ff9' },
  { id: 'gogo', name: 'ぬるい午後', type: '感覚の標本化', src: '窓のない日だまり', memo: '8月31日の 午後の 温度。', col: '#fc6' },
  { id: 'oto', name: '落ちる音', type: '感覚の標本化', src: '天井のしずく', memo: '落ちて、ひろがって、消える までの 音。', col: '#6cf' },
  { id: 'jikan', name: '待っていた時間', type: '感情の宝石化', src: '砂時計', memo: '読み込みが 終わるのを 待っていた 気持ち。', col: '#c9f' },
  { id: 'kage', name: '走る影の線', type: '事象の再構成', src: '走るものの影', memo: '本人より 一拍 早く 来る。本人は 候補に 入っていない。', col: '#639' },
];
const MAT = {}; MATS.forEach(m => { MAT[m.id] = m; });

// 作品「無題」。保存した素材の分だけ描きこまれていく（128x96）。
const Picture = (() => {
  const PW = 128, PH = 96, HZ = 56;
  const RUN = [
    '.........#..........', '........##..........', '.......#####........', '......#######.......', '...#..#######.......', '....#.#######.......',
    '.....#.#####........', '......#####.........', '.....#######.##.....', '....#########.......', '...##.#####.........', '..#...#####.........',
    '......######........', '.....###.###........', '....###...###.......', '...###.....###......', '..###.......##......', '.###........###.....',
  ];
  let run = null, key = null, cached = null;
  function paint(g, ids) {
    const has = id => ids.indexOf(id) >= 0;
    R(g, 0, 0, PW, PH, '#fff');
    const m = has('yohaku') ? 9 : 0;
    g.save(); g.beginPath(); g.rect(m, m, PW - m * 2, PH - m * 2); g.clip();
    if (has('iro')) {
      for (let y = 0; y < HZ; y++) { const k = y / HZ; R(g, 0, y, PW, 1, k < 0.55 ? mixc('#6633cc', '#ff66cc', k / 0.55) : mixc('#ff66cc', '#ffcc99', (k - 0.55) / 0.45)); }
      R(g, 0, HZ, PW, PH - HZ, '#669'); DI(g, 0, HZ, PW, 14, '#99c', 9); DI(g, 0, HZ + 14, PW, PH - HZ - 14, '#99c', 4); R(g, 0, HZ, PW, 1, '#fcf');
    } else {
      for (let x = 0; x < PW; x += 3) R(g, x, HZ, 2, 1, '#ccc');
      for (let i = -3; i <= 3; i++) for (let k = 0; k < 10; k += 2) R(g, 64 + i * (6 + k * 3.4), HZ + 4 + k * 4, 1, 3, '#ccc');
    }
    if (has('jikan')) {
      g.save(); g.beginPath(); g.rect(0, 0, PW, HZ); g.clip();
      EL(g, 38, HZ - 2, 15, 15, '#ffc');
      for (let j = 0; j < 4; j++) R(g, 20, HZ - 3 - j * 4, 40, j < 2 ? 2 : 1, has('iro') ? '#f9c' : '#fff');
      g.restore();
      DI(g, 24, HZ + 1, 28, 3, '#ffc', 8); DI(g, 29, HZ + 5, 18, 2, '#ffc', 5);
    }
    if (has('gogo')) { for (let y = 0; y < 18; y++) { DI(g, 10 + y * 0.9, 68 + y, 30, 1, '#fc6', 12); R(g, 10 + y * 0.9, 68 + y, 1, 1, '#f96'); R(g, 40 + y * 0.9, 68 + y, 1, 1, '#f96'); } }
    if (has('oto')) { ELO(g, 70, 82, 7, 2, '#fff'); ELO(g, 70, 82, 14, 4, '#fff'); ELO(g, 70, 82, 22, 7, '#cff'); R(g, 70, 80, 1, 2, '#fff'); }
    if (has('akari')) {
      for (let y = 22; y < 86; y++) { const w = (y - 22) * 0.34; DI(g, 100 - w, y, w * 2, 1, '#ff9', 5); }
      EL(g, 100, 86, 22, 5, '#ff9', 9);
      R(g, 108, 18, 2, 70, '#333'); R(g, 98, 18, 12, 2, '#333'); R(g, 96, 19, 7, 3, '#333'); R(g, 97, 21, 5, 2, '#ffc');
    }
    if (has('kage')) {
      if (!run) run = SPR(RUN, { '#': '#306' });
      // 足もと（街灯のそば）から左へ長く伸びる、走るものの影
      g.save(); g.transform(0, -1.0, 3.1, -0.14, 38, 86); g.imageSmoothingEnabled = false; g.drawImage(run, 0, 0); g.restore();
      for (let k = 0; k < 4; k++) DI(g, 14 + k * 5, 64 + k * 5, 22 - k * 3, 1, '#306', 8);
    }
    g.restore();
    if (m) { R(g, m - 1, m - 1, PW - m * 2 + 2, 1, '#999'); R(g, m - 1, PH - m, PW - m * 2 + 2, 1, '#999'); R(g, m - 1, m - 1, 1, PH - m * 2 + 2, '#999'); R(g, PW - m, m - 1, 1, PH - m * 2 + 2, '#999'); }
  }
  function get(ids) {
    const k = ids.slice().sort().join(',');
    if (k !== key) { key = k; cached = C(PW, PH, g => paint(g, ids)); }
    return cached;
  }
  return { W: PW, H: PH, get };
})();

// ───────── 部屋 ─────────
// 地図の文字: '#' 壁（通れない・見通せない） '.' 床 ' ' 虚無（通れない・見通せる）
//             '~' 浅い水（歩ける・遅い） '=' 深い水（通れない・見通せる） '+' 出入り口の床
const inRoom = (r, x, y) => x >= 0 && y >= 0 && x < r.w && y < r.h;
const tileCh = (r, x, y) => inRoom(r, x, y) ? r.spec.map[y][x] : ' ';
const isSolid = (r, x, y) => !inRoom(r, x, y) || r.solid[y * r.w + x] === 1;
const isOpaque = (r, x, y) => !inRoom(r, x, y) || r.opaque[y * r.w + x] === 1;
const isWater = (r, x, y) => inRoom(r, x, y) && r.spec.map[y][x] === '~';
const voidAt = (r, x, y) => tileCh(r, x, y) === ' ';
const portalAt = (r, x, y) => inRoom(r, x, y) ? r.portals.get(y * r.w + x) || null : null;
const objAt = (r, x, y) => inRoom(r, x, y) ? r.grid[y * r.w + x] || null : null;
// 見通し（タイルの中心どうし）。途中に見通せないタイルがあれば false。
function los(r, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) * 4);
  const sx = Math.floor(x0), sy = Math.floor(y0), ex = Math.floor(x1), ey = Math.floor(y1);
  for (let i = 1; i < n; i++) {
    const tx = Math.floor(x0 + dx * i / n), ty = Math.floor(y0 + dy * i / n);
    if ((tx === sx && ty === sy) || (tx === ex && ty === ey)) continue;
    if (isOpaque(r, tx, ty)) return false;
  }
  return true;
}

const lightBuf = mkCanvas(W, H);
function cap(g, px, py, c1, c2) { R(g, px, py, 16, 16, c1); R(g, px, py, 16, 2, c2); }
function cloud(g, x, y, s) {
  EL(g, x, y, s, Math.round(s * 0.34), '#fff'); EL(g, x - s * 0.45, y + 3, Math.round(s * 0.6), Math.round(s * 0.26), '#fff'); EL(g, x + s * 0.5, y + 2, Math.round(s * 0.55), Math.round(s * 0.28), '#fff');
  DI(g, x - s * 0.9, y + s * 0.22, s * 1.8, 2, '#cdf', 7);
}

const THEME = {
  atelier: {
    tile(g, r, x, y, ch, px, py) {
      if (ch === '#') {
        if (y === 0) R(g, px, py, 16, 16, '#333');
        else if (y <= 2 && x > 0 && x < r.w - 1) {
          R(g, px, py, 16, 16, '#fff');
          if (y === 1) R(g, px, py, 16, 2, '#ccc');
          if (y === 2) { R(g, px, py + 6, 16, 10, '#ccf'); R(g, px, py + 6, 16, 1, '#99c'); R(g, px, py + 14, 16, 2, '#669'); if (x % 3 === 0) R(g, px, py + 7, 1, 7, '#99c'); }
        } else cap(g, px, py, '#333', '#666');
      } else if (ch === '+') {
        R(g, px, py, 16, 16, '#000'); R(g, px, py, 2, 16, '#963'); R(g, px + 14, py, 2, 16, '#963'); R(g, px + 2, py, 12, 3, '#333');
      } else if (ch === '.') {
        R(g, px, py, 16, 16, '#ccc'); R(g, px, py + 15, 16, 1, '#999'); R(g, px + ((y & 1) ? 4 : 12), py, 1, 15, '#999');
        for (let i = 0; i < 3; i++) R(g, px + Math.floor(hash2(x, y, i) * 14), py + Math.floor(hash2(y, x, i + 7) * 14), 2, 1, '#bbb');
      }
    },
  },
  hall: {
    tile(g, r, x, y, ch, px, py) {
      if (ch === '#') {
        if (y === 0) R(g, px, py, 16, 16, '#336');
        else if (y <= 3) {
          R(g, px, py, 16, 16, (x & 1) ? '#ccf' : '#dde0ff');
          if (y === 1) { R(g, px, py, 16, 3, '#fff'); R(g, px, py + 3, 16, 1, '#99c'); }
          if (y === 3) { R(g, px, py + 5, 16, 11, '#99c'); R(g, px, py + 5, 16, 1, '#fff'); R(g, px, py + 13, 16, 3, '#336'); }
        } else cap(g, px, py, '#336', '#669');
      } else if (ch === '.') {
        const dk = (x + y) & 1;
        R(g, px, py, 16, 16, dk ? '#336' : '#fff');
        if (dk) { R(g, px, py, 16, 1, '#669'); R(g, px, py, 1, 16, '#669'); } else { R(g, px, py + 15, 16, 1, '#ccc'); R(g, px + 15, py, 1, 16, '#ccc'); }
      }
    },
  },
  sky: {
    tile(g, r, x, y, ch, px, py) {
      if (ch === '.') {
        g.fillStyle = 'rgba(255,255,255,0.62)'; g.fillRect(px, py, 16, 16);
        g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(px, py, 16, 1); g.fillRect(px, py, 1, 16);
        if (voidAt(r, x, y - 1)) R(g, px, py, 16, 2, '#fff');
        if (voidAt(r, x - 1, y)) R(g, px, py, 2, 16, '#fff');
        if (voidAt(r, x + 1, y)) R(g, px + 14, py, 2, 16, '#fff');
        if (voidAt(r, x, y + 1)) R(g, px, py + 14, 16, 2, '#fff');
      } else if (ch === ' ' && tileCh(r, x, y - 1) === '.') {
        R(g, px, py, 16, 4, '#9cf'); R(g, px, py + 4, 16, 1, '#69c');
      }
    },
    back(g, r, cam, wt) {
      for (let y = 0; y < H; y += 4) R(g, 0, y, W, 4, mixc('#3399ff', '#ccffff', y / H));
      // 目（遠くの空にある。こちらを見る）
      const ex = 224 - cam.x * 0.8, ey = 70 - cam.y * 0.8;
      const bl = (wt % 7.3) < 0.18;
      if (bl) { R(g, ex - 26, ey, 52, 2, '#036'); }
      else {
        EL(g, ex, ey, 28, 12, '#036'); EL(g, ex, ey, 26, 10, '#fff');
        const e = Game.edel, dx = e ? clamp((e.cx * 16 - cam.x - ex) / 30, -1, 1) : 0, dy = e ? clamp((e.cy * 16 - cam.y - ey) / 30, -1, 1) : 0;
        EL(g, ex + dx * 11, ey + dy * 3, 8, 8, '#369'); EL(g, ex + dx * 12, ey + dy * 4, 3, 3, '#003'); R(g, ex + dx * 11 - 4, ey + dy * 3 - 4, 2, 2, '#fff');
      }
      for (let i = 0; i < 14; i++) {
        const far = i & 1, sp = far ? 2.5 : 6, par = far ? 0.3 : 0.55;
        const x = (((hash2(i, 1, 3) * 520 + wt * sp - cam.x * par) % 480) + 480) % 480 - 80;
        const y = (((hash2(i, 2, 5) * 400 - cam.y * par) % 320) + 320) % 320 - 40;
        cloud(g, x, y, Math.round(18 + hash2(i, 3, 1) * (far ? 14 : 30)));
      }
    },
  },
  street: {
    tile(g, r, x, y, ch, px, py) {
      if (ch === '#') {
        if (y === 0) R(g, px, py, 16, 16, '#003');
        else if (y <= 2) {
          R(g, px, py, 16, 16, '#999');
          for (let j = 0; j < 2; j++) { const yy = py + j * 8; R(g, px, yy + 7, 16, 1, '#666'); R(g, px + (((j + y * 2) & 1) ? 0 : 8), yy, 1, 7, '#666'); }
          if (y === 1) { R(g, px, py, 16, 3, '#ccc'); R(g, px, py + 3, 16, 1, '#666'); }
          if (y === 2 && x % 5 === 2) { R(g, px + 4, py + 1, 8, 5, '#333'); R(g, px + 7, py + 1, 2, 5, '#999'); }
        } else cap(g, px, py, '#666', '#999');
      } else if (ch === '.') {
        if (y === 3 || y === 8) {
          R(g, px, py, 16, 16, '#999'); R(g, px, py, 1, 16, '#666');
          R(g, px, py + (y === 3 ? 13 : 0), 16, 3, '#ccc'); R(g, px, py + (y === 3 ? 15 : 2), 16, 1, '#666');
        } else {
          R(g, px, py, 16, 16, '#333');
          for (let i = 0; i < 5; i++) R(g, px + Math.floor(hash2(x, y, i) * 16), py + Math.floor(hash2(y, x, i + 9) * 16), 1, 1, (i & 1) ? '#666' : '#000');
          if (y === 5 && (x % 4) < 2) R(g, px, py + 14, 16, 2, '#ccc');
        }
      }
    },
    over(g, r, cam, wt) {
      const lg = lightBuf.g;
      lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.fillStyle = '#464c84'; lg.fillRect(0, 0, W, H);
      lg.globalCompositeOperation = 'lighter';
      for (const o of r.objs) {
        const li = o.light; if (!li) continue;
        let a = 1;
        if (o.cand) { if (Game.has(o.cand)) continue; const k = Math.sin(wt * 9) + Math.sin(wt * 23.7); a = k > -0.7 ? 1 : 0.2; }
        const cx = o.x * 16 + li.dx - cam.x, cy = o.y * 16 + li.dy - cam.y;
        if (cx < -li.r || cy < -li.r || cx > W + li.r || cy > H + li.r) continue;
        const gr = lg.createRadialGradient(cx, cy, 2, cx, cy, li.r);
        gr.addColorStop(0, li.c); gr.addColorStop(0.55, li.c2 || li.c); gr.addColorStop(1, 'rgba(0,0,0,0)');
        lg.globalAlpha = a; lg.fillStyle = gr; lg.fillRect(cx - li.r, cy - li.r, li.r * 2, li.r * 2);
      }
      lg.globalAlpha = 1;
      g.globalCompositeOperation = 'multiply'; g.drawImage(lightBuf.c, 0, 0); g.globalCompositeOperation = 'source-over';
      // 電線
      for (let k = 0; k < 2; k++) { const y0 = 8 + k * 5 - cam.y; for (let x = 0; x < W; x += 2) R(g, x, y0 + Math.round(Math.sin((x + cam.x) / 96 * Math.PI) * 3) + 3, 2, 1, '#000'); }
    },
  },
  gogo: {
    tile(g, r, x, y, ch, px, py) {
      if (ch === '#') {
        if (y === 0) R(g, px, py, 16, 16, '#330');
        else if (y <= 2 && x > 0 && x < r.w - 1) {
          R(g, px, py, 16, 16, '#fc9');
          for (let i = 0; i < 6; i++) R(g, px + Math.floor(hash2(x, y, i) * 16), py + Math.floor(hash2(y, x, i) * 16), 1, 1, '#c96');
          if (y === 1) R(g, px, py, 16, 3, '#630');
          if (y === 2) R(g, px, py + 13, 16, 3, '#630');
          if (x % 6 === 1) R(g, px, py, 2, 16, '#630');
        } else cap(g, px, py, '#630', '#963');
      } else if (ch === '.') {
        R(g, px, py, 16, 16, '#cc9');
        for (let j = 1; j < 16; j += 2) R(g, px, py + j, 16, 1, '#bb8');
        if (((x + (y & 1)) & 1) === 0) R(g, px, py, 2, 16, '#363');
        R(g, px, py + 14, 16, 2, '#363');
      }
    },
  },
  water: {
    tile(g, r, x, y, ch, px, py) {
      const small = (c1, c2) => { R(g, px, py, 16, 16, c1); for (let i = 0; i < 16; i += 4) { R(g, px + i, py, 1, 16, c2); R(g, px, py + i, 16, 1, c2); } };
      if (ch === '#') {
        if (y === 0) R(g, px, py, 16, 16, '#366');
        else if (y <= 2 && x > 0 && x < r.w - 1) { small('#fff', '#cff'); if (y === 2) { R(g, px, py + 4, 16, 4, '#39c'); R(g, px, py + 14, 16, 2, '#699'); } }
        else cap(g, px, py, '#699', '#9cc');
      } else if (ch === '.') {
        small('#cff', '#9cc');
        const wv = (dx, dy) => { const c = tileCh(r, x + dx, y + dy); return c === '~' || c === '='; };
        if (wv(0, 1)) { R(g, px, py + 12, 16, 4, '#fff'); R(g, px, py + 15, 16, 1, '#699'); }
        if (wv(0, -1)) { R(g, px, py, 16, 4, '#fff'); R(g, px, py, 16, 1, '#699'); }
        if (wv(1, 0)) { R(g, px + 12, py, 4, 16, '#fff'); R(g, px + 15, py, 1, 16, '#699'); }
        if (wv(-1, 0)) { R(g, px, py, 4, 16, '#fff'); R(g, px, py, 1, 16, '#699'); }
      } else if (ch === '~') {
        R(g, px, py, 16, 16, '#6cc'); for (let i = 0; i < 16; i += 4) { R(g, px + i, py, 1, 16, '#5bb'); R(g, px, py + i, 16, 1, '#5bb'); }
      } else if (ch === '=') {
        R(g, px, py, 16, 16, '#036'); DI(g, px, py, 16, 16, '#069', 5);
      }
    },
    floor(g, r, cam, wt) {
      const x0 = Math.max(0, Math.floor(cam.x / 16)), y0 = Math.max(0, Math.floor(cam.y / 16));
      for (let y = y0; y < Math.min(r.h, y0 + 16); y++) for (let x = x0; x < Math.min(r.w, x0 + 21); x++) {
        const ch = r.spec.map[y][x]; if (ch !== '~' && ch !== '=') continue;
        const sx = x * 16 - cam.x, sy = y * 16 - cam.y, ph = wt * 1.4 + x * 0.9 + y * 1.7, c = ch === '~' ? '#cff' : '#39c';
        R(g, sx + 3 + Math.sin(ph) * 3, sy + 4, 6, 1, c); R(g, sx + 8 + Math.cos(ph * 0.8) * 3, sy + 11, 5, 1, ch === '~' ? '#fff' : '#069');
      }
    },
  },
  cons: {
    tile(g, r, x, y, ch, px, py) {
      if (ch !== '.') return;
      const h = hash2(x, y, 11);
      if (h < 0.07) { R(g, px, py, 16, 16, '#fff'); LN(g, px + 1, py + 15, px + 15, py + 1, '#ccc'); }
      else if (h < 0.13) { R(g, px, py, 16, 16, '#000'); R(g, px, py, 8, 8, '#f0f'); R(g, px + 8, py + 8, 8, 8, '#f0f'); }
      else R(g, px, py, 16, 16, '#000');
      R(g, px, py, 16, 1, '#099'); R(g, px, py, 1, 16, '#099');
      if (voidAt(r, x + 1, y)) R(g, px + 15, py, 1, 16, '#0ff');
      if (voidAt(r, x, y + 1)) R(g, px, py + 15, 16, 1, '#0ff');
      if (voidAt(r, x - 1, y)) R(g, px, py, 1, 16, '#0ff');
      if (voidAt(r, x, y - 1)) R(g, px, py, 16, 1, '#0ff');
    },
    back(g, r, cam, wt) {
      for (let i = 0; i < 14; i++) { const x = (((i * 32 - cam.x * 0.4 + wt * 3) % 384) + 384) % 384 - 32; R(g, x, 0, 1, H, '#033'); }
      for (let i = 0; i < 11; i++) { const y = (((i * 32 - cam.y * 0.4) % 288) + 288) % 288 - 24; R(g, 0, y, W, 1, '#033'); }
    },
  },
};

// 額縁の中の小さな絵（行き先を見せる）
const PREV = {
  hall(g, x, y, w, h) {
    R(g, x, y, w, h, '#ccf'); R(g, x, y + h * 0.5 - 2, w, 2, '#336');
    const th = Math.ceil(h * 0.5 / 4), tw = Math.ceil(w / 4);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) R(g, x + i * tw, y + Math.floor(h * 0.5) + j * th, tw, th, ((i + j) & 1) ? '#336' : '#fff');
  },
  sky(g, x, y, w, h, wt) {
    R(g, x, y, w, h, '#39f'); DI(g, x, y + h / 2, w, h / 2, '#9cf', 9);
    EL(g, x + ((wt * 3) % (w + 20)) - 10, y + h * 0.3, 6, 2, '#fff'); EL(g, x + ((wt * 2 + 17) % (w + 20)) - 10, y + h * 0.7, 8, 3, '#fff');
  },
  street(g, x, y, w, h, wt) {
    R(g, x, y, w, h, '#003'); R(g, x, y + h - 8, w, 8, '#333');
    const on = (Math.sin(wt * 9) + Math.sin(wt * 23.7)) > -0.7;
    R(g, x + w * 0.62, y + 6, 1, h - 12, '#666'); R(g, x + w * 0.62 - 4, y + 6, 5, 1, '#666');
    if (on) { R(g, x + w * 0.62 - 5, y + 7, 3, 2, '#ff9'); for (let j = 0; j < h - 16; j++) DI(g, x + w * 0.62 - 4 - j * 0.3, y + 9 + j, 2 + j * 0.6, 1, '#ff9', 4); }
  },
  gogo(g, x, y, w, h, wt) {
    R(g, x, y, w, h, '#c96'); R(g, x, y, w, 3, '#630');
    for (let j = 0; j < 12; j++) DI(g, x + 4 + j * 0.7, y + h * 0.5 + j, w * 0.55, 1, '#fc6', 12);
    R(g, x + w * 0.3 + Math.sin(wt) * 2, y + h * 0.35, 1, 1, '#fff');
  },
  water(g, x, y, w, h, wt) {
    R(g, x, y, w, h, '#6cc'); R(g, x, y, w, 5, '#fff'); R(g, x, y + 5, w, 2, '#39c');
    for (let j = 0; j < 5; j++) R(g, x + 3 + ((j * 7 + wt * 4) % (w - 8)), y + 12 + j * 5, 6, 1, '#cff');
  },
  cons(g, x, y, w, h, wt) {
    R(g, x, y, w, h, '#000');
    for (let i = -h; i < w; i += 8) for (let j = 0; j < h; j++) { const xx = i + j + Math.floor(wt * 4) % 8; if (xx >= 0 && xx < w - 3) R(g, x + xx, y + j, 4, 1, '#fc0'); }
  },
};
function prevClip(g, id, x, y, w, h, wt) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  (PREV[id] || PREV.hall)(g, x, y, w, h, wt);
  g.restore();
}
