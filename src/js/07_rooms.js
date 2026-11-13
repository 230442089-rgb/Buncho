// ───────── 部屋の地図 ─────────
// アトリエ（保存できる・アセラは来ない）→ 廊下 → 額縁の先の 5 つの層。
const rep = (c, n) => c.repeat(n);
const wallRow = n => rep('#', n);
const floorRow = n => '#' + rep('.', n - 2) + '#';
const voidRow = n => rep(' ', n);
const P2 = (x, y, to, tx, ty, dir) => [{ x, y, to, tx, ty, dir }, { x: x + 1, y, to, tx, ty, dir }];

const ROOMS = {
  atelier: {
    name: 'アトリエ', theme: 'atelier', bg: '#000', music: 'atelier', safe: true,
    map: [wallRow(18), wallRow(18), wallRow(18), floorRow(18), floorRow(18), floorRow(18), floorRow(18), floorRow(18), floorRow(18), floorRow(18), '########+#########', voidRow(18)],
    portals: [{ x: 8, y: 10, to: 'hall', tx: 2, ty: 4, dir: 'down' }],
    objs: [
      { k: 'win', x: 6, y: 1 }, { k: 'shelf', x: 1, y: 1 }, { k: 'rug', x: 6, y: 4 }, { k: 'easel', x: 8, y: 4 },
      { k: 'desk', x: 12, y: 6 }, { k: 'stool', x: 13, y: 7 }, { k: 'hand', x: 2, y: 4 }, { k: 'canv', x: 16, y: 3 }, { k: 'canv', x: 15, y: 3 },
      { k: 'paper', x: 3, y: 7 }, { k: 'paper', x: 4, y: 8 }, { k: 'paper', x: 14, y: 9 },
    ],
    spawns: [[8, 9]],
  },
  hall: {
    name: 'ろうか', theme: 'hall', bg: '#000', music: 'hall',
    map: [wallRow(48), wallRow(48), wallRow(48), wallRow(48), floorRow(48), floorRow(48), floorRow(48), floorRow(48), wallRow(48), voidRow(48)],
    portals: [{ x: 2, y: 3, to: 'atelier', tx: 8, ty: 9, dir: 'up' }]
      .concat(P2(13, 3, 'sky', 14, 10, 'down'), P2(20, 3, 'street', 4, 3, 'down'), P2(27, 3, 'gogo', 2, 3, 'down'), P2(34, 3, 'water', 3, 3, 'down'), P2(41, 3, 'cons', 4, 3, 'down')),
    objs: [
      { k: 'doorA', x: 2, y: 2 }, { k: 'frameEmpty', x: 6, y: 1 },
      { k: 'frameBig', x: 13, y: 1, to: 'sky' }, { k: 'frameBig', x: 20, y: 1, to: 'street' }, { k: 'frameBig', x: 27, y: 1, to: 'gogo' },
      { k: 'frameBig', x: 34, y: 1, to: 'water' }, { k: 'frameBig', x: 41, y: 1, to: 'cons' },
      { k: 'sign', x: 10, y: 3, look: '「おしずかに」' }, { k: 'sign', x: 17, y: 3, look: '「館内では 走らないで ください」' },
      { k: 'sign', x: 24, y: 3, look: '「作品に さわらないで ください」' }, { k: 'sign', x: 31, y: 3, look: '「写生中は うごかないで ください」' },
      { k: 'sign', x: 38, y: 3, look: '「走る人に 声を かけないで ください」' },
      { k: 'pillar', x: 17, y: 5 }, { k: 'pillar', x: 24, y: 6 }, { k: 'pillar', x: 31, y: 5 }, { k: 'pillar', x: 38, y: 6 },
      { k: 'bench', x: 9, y: 7 }, { k: 'plant', x: 45, y: 4 }, { k: 'exitSign', x: 46, y: 2 },
    ],
    spawns: [[1, 6], [46, 6], [13, 4], [20, 4], [27, 4], [34, 4], [41, 4]],
  },
  sky: {
    name: 'そら', theme: 'sky', bg: '#39f', music: 'sky',
    map: [
      voidRow(30),
      '   ......            ......   ',
      '  ........          ........  ',
      '  ........          ........  ',
      '  ........          ........  ',
      '   ......            ......   ',
      '     ..                ..     ',
      '     ..                ..     ',
      '     .....        .......     ',
      '      .................       ',
      '       ...............        ',
      '       ...............        ',
      '       ...............        ',
      '        .............         ',
      '            .....             ',
      '             ...              ',
      '            .....             ',
      '          .........           ',
      '          .........           ',
      '           .......            ',
    ],
    portals: [{ x: 14, y: 9, to: 'hall', tx: 13, ty: 4, dir: 'down' }, { x: 24, y: 1, to: 'water', tx: 21, ty: 3, dir: 'down' }],
    objs: [
      { k: 'fstand', x: 14, y: 9, to: 'hall' }, { k: 'doorP', x: 24, y: 1, to: 'water' },
      { k: 'swing', x: 4, y: 2 }, { k: 'bench', x: 6, y: 4 },
      { k: 'signpost', x: 11, y: 10, look: '「ここは そら です。おちません」' },
      { k: 'door', x: 9, y: 11, c: '#39c', c2: '#369', look: 'あきません。ノブが ありません。' },
      { k: 'door', x: 19, y: 10, c: '#fc0', c2: '#c90', look: 'あきません。うらがわも 扉です。' },
      { k: 'door', x: 26, y: 3, c: '#393', c2: '#363', look: 'あけると、同じ 扉が あります。' },
      { k: 'cursor', x: 17, y: 12 },
      { k: 'signpost', x: 13, y: 15, look: '「この先 行き止まり」' },
      { k: 'doorIro', x: 14, y: 17 },
    ],
    spawns: [[5, 7], [23, 7], [14, 14], [8, 3], [21, 4], [18, 12]],
  },
  street: {
    name: 'よみち', theme: 'street', bg: '#000', music: 'street',
    map: [
      wallRow(40), wallRow(40), wallRow(40), rep('.', 40), rep('.', 40), rep('.', 40), rep('.', 40), rep('.', 40), rep('.', 40),
      rep('#', 16) + '....' + rep('#', 20),
      rep(' ', 15) + '#....#' + rep(' ', 19), rep(' ', 15) + '#....#' + rep(' ', 19), rep(' ', 15) + '#....#' + rep(' ', 19), rep(' ', 15) + '#....#' + rep(' ', 19),
      rep(' ', 15) + '######' + rep(' ', 19), voidRow(40),
    ],
    portals: P2(4, 2, 'hall', 20, 4, 'down').concat([{ x: 31, y: 3, to: 'gogo', tx: 12, ty: 3, dir: 'down' }]),
    objs: [
      { k: 'posterF', x: 4, y: 1, to: 'hall' }, { k: 'booth', x: 31, y: 3 },
      { k: 'lamp', x: 9, y: 3 }, { k: 'lampC', x: 22, y: 3 }, { k: 'lamp', x: 36, y: 3 },
      { k: 'vend', x: 27, y: 3 }, { k: 'vend', x: 28, y: 3 },
      { k: 'pole', x: 2, y: 8 }, { k: 'pole', x: 25, y: 8 }, { k: 'pole', x: 38, y: 8 },
      { k: 'bench', x: 9, y: 8 }, { k: 'busstop', x: 12, y: 8 }, { k: 'mirror', x: 20, y: 8 },
      { k: 'roadtext', x: 16, y: 9 }, { k: 'stop', x: 16, y: 10 }, { k: 'zebra', x: 33, y: 4 }, { k: 'kid', x: 35, y: 8 },
      { k: 'manhole', x: 6, y: 5 }, { k: 'manhole', x: 29, y: 6 },
    ],
    spawns: [[0, 5], [39, 6], [18, 13], [4, 3], [31, 4]],
  },
  gogo: {
    name: 'ごご', theme: 'gogo', bg: '#000', music: 'gogo',
    map: [wallRow(18), wallRow(18), wallRow(18), floorRow(18), floorRow(18), floorRow(18), floorRow(18), floorRow(18), floorRow(18), floorRow(18), floorRow(18), wallRow(18), voidRow(18)],
    portals: P2(2, 2, 'hall', 27, 4, 'down').concat(P2(12, 2, 'street', 31, 4, 'down')),
    objs: [
      { k: 'wframe', x: 2, y: 1, to: 'hall' }, { k: 'fusuma', x: 12, y: 1 },
      { k: 'cal', x: 6, y: 2 }, { k: 'wclock', x: 9, y: 2 }, { k: 'curtain', x: 15, y: 1 },
      { k: 'sun', x: 3, y: 8, cand: 'gogo', reach: 1 }, { k: 'sun', x: 9, y: 4 }, { k: 'sun', x: 12, y: 8 },
      { k: 'zabu', x: 7, y: 6 }, { k: 'zabu', x: 10, y: 6 }, { k: 'chabu', x: 8, y: 6 },
      { k: 'fan', x: 5, y: 4 }, { k: 'tv', x: 15, y: 6 }, { k: 'katori', x: 2, y: 10 },
    ],
    spawns: [[2, 3], [13, 3], [16, 10], [1, 6], [9, 10]],
  },
  water: {
    name: 'みず', theme: 'water', bg: '#000', music: 'water',
    map: [
      wallRow(26), wallRow(26), wallRow(26), floorRow(26), floorRow(26),
      '#...' + rep('~', 18) + '...#', '#...' + rep('~', 18) + '...#',
      '#...' + rep('~', 6) + '====' + rep('~', 8) + '...#', '#...' + rep('~', 6) + '====' + rep('~', 8) + '...#',
      '#...' + rep('~', 18) + '...#', '#...' + rep('~', 18) + '...#',
      floorRow(26), floorRow(26), wallRow(26), voidRow(26), voidRow(26),
    ],
    portals: P2(3, 2, 'hall', 34, 4, 'down').concat([{ x: 21, y: 2, to: 'sky', tx: 24, ty: 2, dir: 'down' }]),
    objs: [
      { k: 'wframe', x: 3, y: 1, to: 'hall' }, { k: 'wdoor', x: 21, y: 1, to: 'sky' },
      { k: 'sign', x: 10, y: 2, look: '「およがないで ください」' }, { k: 'sign', x: 15, y: 2, look: '「水深 0.3m」' },
      { k: 'tpillar', x: 7, y: 4 }, { k: 'tpillar', x: 18, y: 4 }, { k: 'tpillar', x: 7, y: 11 }, { k: 'tpillar', x: 18, y: 11 },
      { k: 'ladder', x: 3, y: 7 }, { k: 'drip', x: 16, y: 8 }, { k: 'ball', x: 8, y: 6 }, { k: 'lchair', x: 23, y: 8 },
    ],
    spawns: [[3, 3], [21, 3], [1, 12], [24, 12], [12, 11], [12, 4]],
  },
  cons: {
    name: 'こうじちゅう', theme: 'cons', bg: '#000', music: 'cons',
    map: [
      voidRow(24),
      '  ' + rep('.', 18) + '    ', '  ' + rep('.', 20) + '  ', '  ' + rep('.', 20) + '  ',
      '  ......  ............  ', '  ......  ............  ',
      '  ' + rep('.', 20) + '  ',
      '  ..........    ......  ', '  ..........    ......  ',
      '  ' + rep('.', 20) + '  ', '  ' + rep('.', 20) + '  ',
      '    ' + rep('.', 16) + '    ', voidRow(24),
    ],
    portals: [{ x: 4, y: 2, to: 'hall', tx: 41, ty: 4, dir: 'down' }],
    objs: [
      { k: 'fstand', x: 4, y: 2, to: 'hall' }, { k: 't404', x: 17, y: 4 }, { k: 'sample', x: 5, y: 7 },
      { k: 'kouji', x: 9, y: 6 }, { k: 'cone', x: 7, y: 4 }, { k: 'cone', x: 10, y: 4 }, { k: 'cone', x: 8, y: 3 },
      { k: 'broken', x: 15, y: 3 }, { k: 'broken', x: 6, y: 9 },
      { k: 'cube', x: 13, y: 9 }, { k: 'cube', x: 14, y: 9 }, { k: 'cube', x: 17, y: 2 },
      { k: 'bar99', x: 3, y: 10 }, { k: 'hourglass', x: 19, y: 8 },
    ],
    spawns: [[2, 6], [21, 6], [12, 11], [12, 1], [4, 3]],
  },
};

function buildRoom(id) {
  const s = ROOMS[id], h = s.map.length, w = s.map[0].length;
  const r = { id, spec: s, w, h, solid: new Uint8Array(w * h), opaque: new Uint8Array(w * h), grid: new Array(w * h).fill(null), portals: new Map(), objs: [], layer: null };
  for (let y = 0; y < h; y++) {
    if (s.map[y].length !== w) console.warn('地図の幅が違う', id, y, s.map[y].length);
    for (let x = 0; x < w; x++) {
      const ch = s.map[y][x], i = y * w + x;
      if (ch === '#') { r.solid[i] = 1; r.opaque[i] = 1; } else if (ch === ' ' || ch === '=') r.solid[i] = 1;
    }
  }
  for (const p of s.portals) r.portals.set(p.y * w + p.x, p);
  for (const d of s.objs) {
    const o = mkObj(d); r.objs.push(o);
    if (!o.solid) continue;
    for (let yy = o.y; yy < o.y + o.h; yy++) for (let xx = o.x; xx < o.x + o.w; xx++) {
      const i = yy * w + xx; r.solid[i] = 1; if (o.opaque) r.opaque[i] = 1; r.grid[i] = o;
    }
  }
  const L = mkCanvas(w * 16, h * 16), th = THEME[s.theme];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) th.tile(L.g, r, x, y, s.map[y][x], x * 16, y * 16);
  for (const o of r.objs) if (o.layer === 'bake') drawObj(L.g, o, o.x * 16, o.y * 16, 0, 0, false);
  r.layer = L.c;
  return r;
}
