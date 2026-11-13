// ───────── 素材と、作品「無題」 ─────────
// 素材は { n: 名前, k: 種類, c: 色, s: 種（0〜1） }。保存した順に絵へ描きこまれていく。絵は完成しない。
const PK = { light: 0, door: 1, window: 2, water: 3, seat: 4, sign: 5, screen: 6, plant: 7, stairs: 8, pole: 9, line: 10, box: 11, shadow: 12, blank: 13, clock: 14, sky: 15 };
const Picture = (() => {
  const PW = 128, PH = 96, HZ = 54;
  const RUN = [
    '.........#..........', '........##..........', '.......#####........', '......#######.......', '...#..#######.......', '....#.#######.......',
    '.....#.#####........', '......#####.........', '.....#######.##.....', '....#########.......', '...##.#####.........', '..#...#####.........',
    '......######........', '.....###.###........', '....###...###.......', '...###.....###......', '..###.......##......', '.###........###.....',
  ];
  let run = null, key = '', cached = null;
  const h1 = (s, n) => hash2(Math.floor(s * 9973), n, 17);
  function paint(g, mats) {
    R(g, 0, 0, PW, PH, '#f4f2ee');
    const use = mats.slice(-48);
    let sky = null, margin = 0;
    for (const m of use) { if (m.k === PK.sky) sky = m; if (m.k === PK.blank) margin = 9; }
    g.save(); g.beginPath(); g.rect(margin, margin, PW - margin * 2, PH - margin * 2); g.clip();
    const ink = sky ? '#1a1426' : '#555';
    if (sky) {
      for (let y = 0; y < HZ; y++) { const k = y / HZ; R(g, 0, y, PW, 1, k < 0.6 ? mixc('#1c1836', sky.c, k / 0.6) : mixc(sky.c, '#ffe0c0', (k - 0.6) / 0.4 * 0.7)); }
      R(g, 0, HZ, PW, PH - HZ, '#2a2638'); DI(g, 0, HZ, PW, 12, '#4a4660', 8); DI(g, 0, HZ + 12, PW, PH - HZ - 12, '#4a4660', 3);
    } else {
      for (let x = 0; x < PW; x += 3) R(g, x, HZ, 2, 1, '#bbb');
      for (let i = -3; i <= 3; i++) for (let k = 0; k < 10; k += 2) R(g, 64 + i * (6 + k * 3.4), HZ + 4 + k * 4, 1, 3, '#ccc');
    }
    const items = use.filter(m => m.k !== PK.sky && m.k !== PK.blank).map(m => ({ m, x: 10 + h1(m.s, 1) * 108, d: h1(m.s, 2) })).sort((a, b) => a.d - b.d);
    for (const it of items) {
      const m = it.m, x = Math.round(it.x), sc = 0.55 + it.d * 0.65, gy = Math.round(HZ + 5 + it.d * 30), c = m.c;
      const S = v => Math.max(1, Math.round(v * sc));
      if (m.k === PK.light) {
        const top = gy - S(44);
        for (let y = top + 3; y < gy; y++) { const w = (y - top) * 0.3; DI(g, x - 4 - w, y, w * 2, 1, c, 5); }
        EL(g, x - 4, gy, S(16), S(4), c, 8);
        R(g, x, top, S(2), gy - top, ink); R(g, x - S(8), top, S(9), S(2), ink); R(g, x - S(9), top + 1, S(5), S(2), c);
      } else if (m.k === PK.door) {
        const w = S(11), h = S(22); R(g, x - 1, gy - h - 1, w + 2, h + 1, ink); R(g, x, gy - h, w, h, c); R(g, x, gy - h, S(3), h, mixc(c, '#000', 0.45)); DI(g, x, gy, w + S(8), S(3), c, 5);
      } else if (m.k === PK.window) {
        for (let y = 0; y < S(14); y++) DI(g, x + y * 0.8, gy - S(4) + y, S(24), 1, c, 11);
        R(g, x + S(11), gy - S(4), 1, S(14), ink);
      } else if (m.k === PK.water) {
        ELO(g, x, gy, S(6), S(2), '#fff'); ELO(g, x, gy, S(12), S(4), c); ELO(g, x, gy, S(19), S(6), c); R(g, x, gy - S(3), 1, S(3), '#fff');
      } else if (m.k === PK.seat) {
        R(g, x, gy - S(8), S(12), S(2), ink); R(g, x, gy - S(14), S(2), S(14), ink); R(g, x + S(10), gy - S(8), S(2), S(8), ink); R(g, x, gy - S(14), S(12), S(2), ink); DI(g, x - 2, gy, S(18), 2, ink, 6);
      } else if (m.k === PK.sign) {
        R(g, x, gy - S(28), S(2), S(28), ink); R(g, x - S(7), gy - S(30), S(16), S(11), ink); R(g, x - S(6), gy - S(29), S(14), S(9), c);
      } else if (m.k === PK.screen) {
        const w = S(16), h = S(12); R(g, x - 1, gy - h - 1, w + 2, h + 2, ink); R(g, x, gy - h, w, h, c); for (let y = 1; y < h; y += 2) R(g, x, gy - h + y, w, 1, mixc(c, '#000', 0.3)); DI(g, x - 4, gy + 1, w + 8, S(5), c, 4);
      } else if (m.k === PK.plant) {
        R(g, x, gy - S(7), S(6), S(7), ink); EL(g, x + S(3), gy - S(14), S(6), S(8), ink); EL(g, x - S(1), gy - S(12), S(3), S(5), ink);
      } else if (m.k === PK.stairs) {
        for (let i = 0; i < 6; i++) { R(g, x + i * S(5), gy - (i + 1) * S(4), S(5), (i + 1) * S(4), mixc(c, '#000', 0.2 + i * 0.08)); R(g, x + i * S(5), gy - (i + 1) * S(4), S(5), 1, '#fff'); }
      } else if (m.k === PK.pole) {
        const top = gy - S(50); R(g, x, top, S(2), gy - top, ink); R(g, x - S(6), top + S(4), S(14), S(2), ink);
        for (let k = 0; k < 40; k++) R(g, x + k * 2.2, top + S(5) + Math.sin(k / 40 * Math.PI) * 5, 2, 1, ink);
      } else if (m.k === PK.line) {
        for (let y = HZ + 2; y < PH; y++) { const k = (y - HZ) / (PH - HZ); DI(g, 64 + (x - 64) * k * 1.2 - k * 2, y, 1 + k * 4, 1, c, 12); }
      } else if (m.k === PK.box) {
        const w = S(12), h = S(24); R(g, x - 1, gy - h - 1, w + 2, h + 1, ink); R(g, x, gy - h, w, h, mixc(c, '#000', 0.5)); R(g, x + 1, gy - h + 2, w - 2, h / 2, c); DI(g, x - S(6), gy, w + S(12), S(5), c, 5);
      } else if (m.k === PK.clock) {
        g.save(); g.beginPath(); g.rect(0, 0, PW, HZ); g.clip(); EL(g, x, HZ - 2, S(13), S(13), c); for (let j = 0; j < 4; j++) R(g, x - S(16), HZ - 3 - j * S(4), S(32), 1, sky ? sky.c : '#f4f2ee'); g.restore();
        DI(g, x - S(12), HZ + 1, S(24), 3, c, 7);
      } else if (m.k === PK.shadow) {
        if (!run) run = SPR(RUN, { '#': '#306' });
        g.save(); g.transform(0, -sc, 3.1 * sc, -0.14 * sc, x - 40 * sc, gy + 8); g.imageSmoothingEnabled = false; g.drawImage(run, 0, 0); g.restore();
      }
    }
    // 余白: 絵の一部が白く切り抜かれる
    let nb = 0;
    for (const m of use) if (m.k === PK.blank && nb++ > 0) R(g, 12 + h1(m.s, 3) * 84, 12 + h1(m.s, 4) * 56, 10 + h1(m.s, 5) * 18, 8 + h1(m.s, 6) * 14, '#f4f2ee');
    g.restore();
    if (margin) { R(g, margin - 1, margin - 1, PW - margin * 2 + 2, 1, '#999'); R(g, margin - 1, PH - margin, PW - margin * 2 + 2, 1, '#999'); R(g, margin - 1, margin - 1, 1, PH - margin * 2 + 2, '#999'); R(g, PW - margin, margin - 1, 1, PH - margin * 2 + 2, '#999'); }
  }
  // 最後に描いた絵は覚えておく（毎フレーム描き直さない）
  function get(mats) {
    const k = mats.length + ':' + (mats.length ? mats[mats.length - 1].s + mats[0].s : 0);
    if (k !== key) { key = k; cached = C(PW, PH, g => paint(g, mats)); }
    return cached;
  }
  function make(mats) { return C(PW, PH, g => paint(g, mats)); }
  return { W: PW, H: PH, get, make };
})();
