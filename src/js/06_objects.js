// ───────── 置いてあるもの ─────────
// layer: 'stand' 立っているもの（人物と前後を並べ替える） / 'floor' 床の上 / 'wall' 壁の上 / 'bake' 動かないので背景に焼きこむ
// make() はドット絵を返す。draw() があれば毎回それで描く。look は「しらべる」の文。cand は素材の id。
const OBJ = {};
function goldFrame(g, x, y, w, h) {
  R(g, x, y, w, h, '#963'); R(g, x + 1, y + 1, w - 2, h - 2, '#fc6'); R(g, x + 3, y + 3, w - 6, h - 6, '#c93'); R(g, x + 4, y + 4, w - 8, h - 8, '#000');
  R(g, x + 1, y + 1, 2, 2, '#fff'); R(g, x + w - 3, y + 1, 2, 2, '#fff');
}
function doorSpr(c, c2) {
  return C(16, 30, g => {
    R(g, 0, 0, 16, 30, '#fff'); R(g, 1, 1, 14, 29, c); R(g, 3, 3, 10, 10, c2); R(g, 3, 15, 10, 12, c2); R(g, 11, 15, 2, 2, '#fc6'); R(g, 0, 29, 16, 1, '#999');
  });
}
function lampSpr() {
  return C(16, 60, g => { R(g, 7, 4, 2, 56, '#666'); R(g, 8, 4, 1, 56, '#999'); R(g, 6, 57, 4, 3, '#333'); R(g, 2, 3, 7, 2, '#666'); R(g, 1, 4, 6, 3, '#999'); });
}

Object.assign(OBJ, {
  // ── 廊下 ──
  frameBig: {
    w: 2, h: 3, layer: 'wall', solid: false,
    draw(g, o, sx, sy, wt) { goldFrame(g, sx, sy + 2, 32, 46); prevClip(g, o.to, sx + 4, sy + 6, 24, 38, wt); },
  },
  frameEmpty: {
    w: 2, h: 3, layer: 'wall', cand: 'yohaku', reach: 1,
    look: (o, tx, taken) => taken ? 'なにも 入っていない ことも、なくなりました。' : 'からっぽの 額縁です。なにも 入って いません。',
    draw(g, o, sx, sy, wt, t, taken) {
      goldFrame(g, sx, sy + 2, 32, 46);
      if (taken) R(g, sx + 4, sy + 6, 24, 38, '#000');
      else { R(g, sx + 4, sy + 6, 24, 38, '#eef'); R(g, sx + 4, sy + 6, 24, 1, '#99c'); R(g, sx + 4, sy + 6, 1, 38, '#99c'); }
    },
  },
  doorA: {
    w: 1, h: 2, layer: 'bake', solid: false,
    make: () => C(16, 32, g => {
      R(g, 0, 2, 16, 30, '#630'); R(g, 1, 3, 14, 29, '#963'); R(g, 3, 5, 10, 10, '#c96'); R(g, 3, 17, 10, 12, '#c96'); R(g, 11, 17, 2, 2, '#fc6');
      R(g, 3, 6, 10, 5, '#fff'); R(g, 4, 8, 8, 1, '#c33'); R(g, 4, 9, 5, 1, '#c33');
    }),
  },
  sign: {
    layer: 'bake',
    make: () => C(16, 16, g => { R(g, 2, 3, 12, 10, '#336'); R(g, 3, 4, 10, 8, '#fff'); R(g, 4, 6, 8, 1, '#336'); R(g, 4, 8, 6, 1, '#336'); R(g, 4, 10, 7, 1, '#99c'); }),
  },
  pillar: {
    opaque: true,
    make: () => C(16, 46, g => {
      R(g, 2, 0, 12, 46, '#fff'); R(g, 10, 0, 4, 46, '#ccc'); R(g, 13, 0, 1, 46, '#999'); R(g, 5, 5, 1, 36, '#ccf'); R(g, 8, 5, 1, 36, '#ccf');
      R(g, 0, 0, 16, 4, '#fff'); R(g, 0, 3, 16, 1, '#99c'); R(g, 0, 41, 16, 5, '#fff'); R(g, 0, 41, 16, 1, '#99c'); R(g, 0, 45, 16, 1, '#669');
    }),
    look: '柱です。なにも 支えて いません。',
  },
  plant: {
    make: () => C(16, 30, g => {
      R(g, 4, 21, 8, 9, '#c63'); R(g, 3, 20, 10, 2, '#963'); R(g, 5, 23, 6, 1, '#f96');
      EL(g, 8, 12, 6, 9, '#393'); EL(g, 4, 9, 3, 6, '#6c6'); EL(g, 12, 10, 3, 7, '#6c6'); R(g, 8, 4, 1, 16, '#363'); R(g, 5, 8, 1, 6, '#363'); R(g, 11, 9, 1, 6, '#363');
    }),
    look: '観葉植物です。つくりものです。',
  },
  exitSign: {
    w: 1, h: 2, layer: 'bake',
    make: () => C(16, 32, g => {
      R(g, 1, 1, 14, 9, '#fff'); R(g, 2, 2, 12, 7, '#093'); R(g, 8, 3, 2, 2, '#fff'); R(g, 7, 5, 3, 2, '#fff'); R(g, 6, 7, 1, 2, '#fff'); R(g, 10, 7, 2, 1, '#fff'); R(g, 4, 5, 2, 1, '#fff');
      R(g, 2, 13, 12, 19, '#99c'); R(g, 3, 14, 10, 18, '#ccf'); R(g, 10, 22, 2, 2, '#99c');
    }),
    look: '非常口の 絵です。よく 描けて います。あきません。',
  },
  // ── アトリエ ──
  easel: {
    look: null,
    draw(g, o, sx, sy) {
      const x = sx - 4, y = sy + 16 - 42;
      LN(g, x + 3, y + 41, x + 9, y + 2, '#630'); LN(g, x + 4, y + 41, x + 10, y + 2, '#963');
      LN(g, x + 20, y + 41, x + 14, y + 2, '#630'); LN(g, x + 19, y + 41, x + 13, y + 2, '#963');
      R(g, x + 11, y + 1, 2, 30, '#630'); R(g, x + 1, y + 24, 22, 3, '#963'); R(g, x + 1, y + 26, 22, 1, '#630');
      R(g, x, y + 4, 24, 20, '#303'); g.drawImage(Picture.get(Store.d.saved), 0, 0, 128, 96, x + 1, y + 5, 22, 18);
    },
  },
  desk: {
    w: 3,
    make: () => C(48, 26, g => {
      R(g, 0, 8, 48, 18, '#963'); R(g, 0, 0, 48, 10, '#c96'); R(g, 0, 9, 48, 1, '#630'); R(g, 2, 12, 20, 12, '#630'); R(g, 26, 12, 20, 12, '#630'); R(g, 10, 17, 4, 2, '#fc6'); R(g, 34, 17, 4, 2, '#fc6');
      R(g, 3, 1, 12, 7, '#fff'); R(g, 5, 3, 7, 1, '#99c'); R(g, 5, 5, 5, 1, '#99c'); R(g, 13, 2, 11, 6, '#fff'); R(g, 15, 4, 6, 1, '#ccc');
      R(g, 26, 2, 6, 5, '#333'); R(g, 27, 1, 1, 2, '#96f'); R(g, 29, 0, 1, 3, '#fff');
      R(g, 37, 2, 6, 5, '#fff'); R(g, 38, 3, 4, 1, '#c96'); R(g, 43, 3, 2, 3, '#fff');
    }),
    look: (o, tx) => tx === o.x + 2 ? 'だれかが 置いていった 飲みもの。まだ あたたかい。' : '机です。下描きが 何枚も あります。どれも 途中です。',
  },
  stool: {
    make: () => C(16, 14, g => { EL(g, 8, 5, 6, 3, '#963'); EL(g, 8, 4, 6, 3, '#c96'); R(g, 3, 6, 1, 8, '#630'); R(g, 12, 6, 1, 8, '#630'); R(g, 8, 8, 1, 6, '#630'); }),
    look: '丸いすです。座る 人は 決まって います。',
  },
  paper: {
    layer: 'bake',
    make: () => C(16, 16, g => { R(g, 1, 4, 10, 9, '#fff'); R(g, 2, 6, 7, 1, '#ccc'); R(g, 2, 8, 5, 1, '#ccc'); R(g, 6, 1, 9, 8, '#fff'); R(g, 6, 1, 9, 1, '#ccc'); R(g, 8, 3, 5, 1, '#99c'); R(g, 8, 5, 4, 1, '#99c'); R(g, 1, 12, 10, 1, '#999'); }),
    look: '紙です。端を 踏まないで ください。',
  },
  hand: {
    make: () => C(16, 26, g => {
      R(g, 3, 20, 10, 6, '#ccc'); R(g, 3, 20, 10, 1, '#fff'); R(g, 5, 10, 6, 10, '#fff'); R(g, 4, 2, 2, 9, '#fff'); R(g, 7, 0, 2, 11, '#fff'); R(g, 10, 2, 2, 9, '#fff'); R(g, 12, 9, 2, 5, '#fff');
      R(g, 9, 11, 2, 9, '#ccf'); R(g, 11, 3, 1, 7, '#ccf');
    }),
    look: '石こうの 手です。だれの 手かは わかりません。',
  },
  canv: {
    make: () => C(16, 26, g => { R(g, 1, 3, 12, 22, '#963'); R(g, 2, 4, 10, 20, '#c96'); R(g, 4, 0, 12, 24, '#ccc'); R(g, 5, 1, 10, 22, '#fff'); R(g, 7, 6, 6, 1, '#ccf'); R(g, 7, 12, 4, 1, '#ccf'); }),
    look: '描きかけの 画布です。ぜんぶ 描きかけです。',
  },
  shelf: {
    w: 3, h: 2, layer: 'bake',
    make: () => C(48, 32, g => {
      R(g, 1, 3, 46, 26, '#630'); R(g, 2, 4, 44, 24, '#963');
      const cols = ['#f6c', '#6cf', '#fc6', '#c9f', '#9f9', '#f96', '#fff', '#99f'];
      for (let j = 0; j < 2; j++) {
        R(g, 2, 15 + j * 12, 44, 2, '#630');
        for (let i = 0; i < 7; i++) { const x = 4 + i * 6, y = 8 + j * 12; R(g, x, y, 4, 7, '#cff'); R(g, x, y, 4, 1, '#fff'); R(g, x + 1, y + 3, 2, 3, cols[(i + j * 3) % cols.length]); }
      }
    }),
    look: '宝石の 瓶です。色ごとに 分けて あります。だれかの 気持ち だった ものです。',
  },
  win: {
    w: 5, h: 2, layer: 'bake',
    make: () => C(80, 32, g => {
      R(g, 0, 2, 80, 24, '#669'); R(g, 2, 4, 76, 20, '#fff'); DI(g, 2, 14, 76, 10, '#ccf', 6); DI(g, 2, 20, 76, 4, '#ccf', 11);
      for (let i = 1; i < 4; i++) R(g, 2 + i * 19, 4, 2, 20, '#669'); R(g, 2, 13, 76, 1, '#99c'); R(g, 0, 26, 80, 2, '#99c');
    }),
    look: '窓です。外は まだ 描いて いません。',
  },
  rug: {
    w: 5, h: 3, layer: 'bake', solid: false,
    make: () => C(80, 48, g => { R(g, 2, 2, 76, 44, '#669'); R(g, 4, 4, 72, 40, '#99c'); R(g, 7, 7, 66, 34, '#669'); R(g, 8, 8, 64, 32, '#ccf'); for (let i = 0; i < 8; i++) { R(g, 12 + i * 8, 11, 4, 2, '#99c'); R(g, 12 + i * 8, 35, 4, 2, '#99c'); } }),
  },
  // ── そら ──
  door: {
    make: o => doorSpr(o.c || '#c33', o.c2 || '#933'),
    look: 'あきません。',
  },
  doorIro: {
    cand: 'iro', reach: 1,
    look: (o, tx, taken) => taken ? '扉の むこうは、白く なりました。' : '少しだけ あいて います。むこうは 一色です。',
    draw(g, o, sx, sy, wt, t, taken) {
      const y = sy + 16 - 30;
      R(g, sx - 1, y - 1, 18, 31, '#303'); R(g, sx, y, 16, 30, '#fff'); R(g, sx + 1, y + 1, 14, 29, taken ? '#eee' : '#f6c');
      if (!taken) DI(g, sx + 1, y + 20, 14, 10, '#f9c', 6);
      R(g, sx + 1, y + 1, 5, 29, '#963'); R(g, sx + 2, y + 3, 3, 10, '#630'); R(g, sx + 2, y + 15, 3, 12, '#630'); R(g, sx + 5, y + 1, 1, 29, '#630');
    },
  },
  doorP: {
    solid: false,
    draw(g, o, sx, sy, wt) { const y = sy + 16 - 30; R(g, sx - 1, y - 1, 18, 31, '#303'); R(g, sx, y, 16, 30, '#fff'); prevClip(g, o.to, sx + 1, y + 1, 14, 29, wt); },
  },
  fstand: {
    solid: false,
    draw(g, o, sx, sy, wt) {
      const x = sx - 3, y = sy + 16 - 34;
      R(g, x - 1, y - 1, 24, 34, '#303'); goldFrame(g, x, y, 22, 32); prevClip(g, o.to, x + 4, y + 4, 14, 24, wt);
      R(g, x + 2, y + 32, 3, 2, '#963'); R(g, x + 17, y + 32, 3, 2, '#963');
    },
  },
  swing: {
    w: 2,
    look: 'ブランコです。だれも 乗って いないのに、ゆれて います。',
    draw(g, o, sx, sy, wt) {
      const y = sy + 16 - 42, a = Math.sin(wt * 2.3) * 7;
      LN(g, sx + 1, y + 41, sx + 6, y + 2, '#c33'); LN(g, sx + 2, y + 41, sx + 7, y + 2, '#933'); LN(g, sx + 30, y + 41, sx + 25, y + 2, '#c33'); LN(g, sx + 29, y + 41, sx + 24, y + 2, '#933');
      R(g, sx + 5, y + 1, 22, 2, '#c33'); R(g, sx + 5, y + 3, 22, 1, '#933');
      LN(g, sx + 12, y + 3, sx + 12 + a, y + 30, '#666'); LN(g, sx + 20, y + 3, sx + 20 + a, y + 30, '#666');
      R(g, sx + 10 + a, y + 30, 13, 2, '#fc6'); R(g, sx + 10 + a, y + 32, 13, 1, '#963');
      EL(g, sx + 16 + a * 0.6, sy + 13, 7, 2, '#69c', 8);
    },
  },
  signpost: {
    make: () => C(16, 22, g => { R(g, 7, 10, 2, 12, '#963'); R(g, 1, 0, 14, 11, '#963'); R(g, 2, 1, 12, 9, '#fff'); R(g, 4, 3, 8, 1, '#333'); R(g, 4, 5, 6, 1, '#333'); R(g, 4, 7, 7, 1, '#999'); }),
    look: '立て札です。',
  },
  cursor: {
    look: '矢印です。どこも 指して いません。',
    draw(g, o, sx, sy, wt) {
      const y = sy - 10 + Math.round(Math.sin(wt * 1.6) * 2);
      EL(g, sx + 8, sy + 13, 5, 2, '#69c', 8);
      const rows = ['#...........', '##..........', '#o#.........', '#oo#........', '#ooo#.......', '#oooo#......', '#ooooo#.....', '#oooooo#....', '#ooooooo#...', '#oooooooo#..', '#ooooo#####.', '#oo#oo#.....', '#o#.#oo#....', '##..#oo#....', '#....#oo#...', '.....#oo#...', '......##....'];
      ROWS(g, sx + 3, y, rows, { '#': '#000', o: '#fff' });
    },
  },
  bench: {
    w: 2,
    make: () => C(32, 16, g => { R(g, 0, 0, 32, 4, '#c96'); R(g, 0, 3, 32, 1, '#630'); R(g, 0, 6, 32, 4, '#963'); R(g, 0, 9, 32, 1, '#630'); R(g, 2, 10, 2, 6, '#333'); R(g, 28, 10, 2, 6, '#333'); }),
    look: 'ベンチです。だれも 待って いません。',
  },
  // ── よみち ──
  lamp: {
    make: lampSpr, light: { dx: 6, dy: 34, r: 58, c: '#ffeeb0', c2: '#806a30' },
    look: '街灯です。虫は 来ません。',
    draw(g, o, sx, sy) { g.drawImage(o.spr, sx - 1, sy + 16 - o.spr.height + 1); R(g, sx + 1, sy + 16 - 60 + 7, 6, 2, '#ff9'); },
  },
  lampC: {
    make: lampSpr, light: { dx: 6, dy: 34, r: 58, c: '#fff0b8', c2: '#806a30' }, cand: 'akari', reach: 1,
    look: (o, tx, taken) => taken ? '街灯です。もう つきません。' : '街灯です。ついたり 消えたり して います。',
    draw(g, o, sx, sy, wt, t, taken) {
      g.drawImage(o.spr, sx - 1, sy + 16 - o.spr.height + 1);
      const on = !taken && (Math.sin(wt * 9) + Math.sin(wt * 23.7)) > -0.7;
      R(g, sx + 1, sy + 16 - 60 + 7, 6, 2, on ? '#ff9' : '#333');
    },
  },
  vend: {
    opaque: true, light: { dx: 8, dy: 22, r: 34, c: '#d8ecff', c2: '#405070' },
    make: () => C(16, 34, g => {
      R(g, 0, 0, 16, 34, '#fff'); R(g, 0, 0, 16, 2, '#c33'); R(g, 1, 3, 14, 13, '#cff');
      const cs = ['#c33', '#39c', '#fc0', '#393', '#f96', '#fff'];
      for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) { R(g, 2 + i * 3, 4 + j * 6, 2, 4, cs[(i + j * 2) % 6]); R(g, 2 + i * 3, 9 + j * 6, 2, 1, '#c33'); }
      R(g, 1, 17, 14, 5, '#ccc'); R(g, 11, 18, 3, 3, '#333'); R(g, 1, 23, 14, 10, '#c33'); R(g, 3, 27, 10, 4, '#333');
    }),
    look: '自動販売機です。ぜんぶ 売り切れです。',
  },
  booth: {
    solid: false, light: { dx: 8, dy: 6, r: 34, c: '#d8ffd8', c2: '#406040' },
    make: () => C(18, 40, g => {
      R(g, 0, 0, 18, 5, '#393'); R(g, 0, 4, 18, 1, '#363'); R(g, 1, 5, 16, 35, '#666'); R(g, 2, 6, 14, 33, '#cfc');
      R(g, 8, 6, 1, 33, '#666'); R(g, 2, 20, 14, 1, '#666'); R(g, 10, 10, 5, 7, '#393'); R(g, 11, 11, 3, 2, '#cfc'); R(g, 4, 22, 3, 6, '#999');
    }),
  },
  busstop: {
    make: () => C(16, 40, g => { R(g, 7, 12, 2, 28, '#999'); EL(g, 8, 7, 6, 6, '#36c'); EL(g, 8, 7, 4, 4, '#fff'); R(g, 6, 6, 5, 2, '#36c'); R(g, 3, 16, 10, 10, '#fff'); R(g, 4, 18, 8, 1, '#999'); R(g, 4, 20, 8, 1, '#999'); R(g, 4, 22, 5, 1, '#999'); R(g, 5, 38, 6, 2, '#666'); }),
    look: 'バス停です。つぎの バスは ありません。',
  },
  stop: {
    make: () => C(16, 40, g => {
      R(g, 7, 14, 2, 26, '#ccc'); for (let j = 0; j < 12; j++) { const w = 15 - j; R(g, 8 - Math.floor(w / 2), 1 + j, w, 1, '#c33'); }
      for (let j = 0; j < 12; j++) { const w = 15 - j, x = 8 - Math.floor(w / 2); R(g, x, 1 + j, 1, 1, '#fff'); R(g, x + w - 1, 1 + j, 1, 1, '#fff'); } R(g, 1, 1, 14, 1, '#fff');
      R(g, 5, 4, 6, 1, '#fff'); R(g, 6, 6, 4, 1, '#fff');
    }),
    look: '「止まれ」と 書いて あります。',
  },
  mirror: {
    make: () => C(16, 44, g => { R(g, 7, 14, 2, 30, '#f60'); EL(g, 8, 7, 7, 7, '#f60'); EL(g, 8, 7, 5, 5, '#9cf'); R(g, 5, 4, 2, 2, '#fff'); R(g, 4, 0, 8, 2, '#f60'); }),
    look: '鏡です。だれも 映って いません。',
  },
  pole: {
    make: () => C(16, 72, g => { R(g, 6, 4, 4, 68, '#666'); R(g, 6, 4, 1, 68, '#999'); R(g, 0, 8, 16, 2, '#666'); R(g, 1, 6, 2, 2, '#ccc'); R(g, 13, 6, 2, 2, '#ccc'); R(g, 9, 14, 5, 8, '#999'); R(g, 7, 36, 2, 5, '#fc0'); }),
    look: '電柱です。電線は どこにも つながって いません。',
  },
  kid: {
    make: () => C(16, 30, g => {
      R(g, 7, 16, 2, 14, '#ccc'); R(g, 1, 0, 14, 17, '#fc0'); R(g, 1, 0, 14, 1, '#963'); R(g, 1, 16, 14, 1, '#963');
      R(g, 7, 2, 3, 3, '#333'); R(g, 6, 5, 4, 5, '#c33'); R(g, 4, 6, 2, 1, '#333'); R(g, 10, 5, 3, 1, '#333'); R(g, 5, 10, 2, 4, '#333'); R(g, 9, 10, 2, 2, '#333'); R(g, 11, 12, 2, 1, '#333');
    }),
    look: '「とびだし 注意」。走っている 子どもの 絵です。',
  },
  posterF: {
    w: 2, h: 2, layer: 'wall', solid: false, light: { dx: 16, dy: 40, r: 40, c: '#f0f0ff', c2: '#505070' },
    draw(g, o, sx, sy, wt) { R(g, sx, sy + 1, 32, 31, '#333'); R(g, sx + 1, sy + 2, 30, 29, '#ccc'); prevClip(g, o.to, sx + 3, sy + 4, 26, 28, wt); },
  },
  roadtext: {
    w: 4, h: 3, layer: 'bake', solid: false,
    make: () => C(64, 48, g => { R(g, 0, 1, 64, 4, '#ccc'); Text.draw(g, '止まれ', 32, 14, '#ccc', { align: 'center' }); for (let x = 0; x < 64; x++) for (let y = 12; y < 32; y++) if (hash2(x, y, 5) < 0.2) g.clearRect(x, y, 1, 1); }),
  },
  zebra: {
    w: 2, h: 4, layer: 'bake', solid: false,
    make: () => C(32, 64, g => { for (let j = 0; j < 8; j++) R(g, 2, 2 + j * 8, 28, 4, '#ccc'); }),
  },
  manhole: {
    layer: 'bake', solid: false,
    make: () => C(16, 16, g => { EL(g, 8, 8, 6, 5, '#666'); EL(g, 8, 8, 5, 4, '#333'); R(g, 4, 8, 9, 1, '#666'); R(g, 8, 5, 1, 7, '#666'); }),
  },
  // ── ごご ──
  tv: {
    look: '「しばらく おまちください」と 出て います。ずっと 出て います。',
    draw(g, o, sx, sy, wt) {
      const y = sy + 16 - 28;
      R(g, sx - 2, y - 1, 20, 29, '#303'); R(g, sx + 1, y + 18, 14, 10, '#630'); R(g, sx - 1, y, 18, 19, '#666'); R(g, sx - 1, y, 18, 1, '#999'); R(g, sx + 1, y + 2, 14, 12, '#000');
      const cs = ['#ccc', '#cc0', '#0cc', '#0c0', '#c0c', '#c00', '#00c'];
      for (let i = 0; i < 7; i++) R(g, sx + 1 + i * 2, y + 2, 2, 9, cs[i]);
      R(g, sx + 1, y + 11, 14, 3, '#333'); R(g, sx + 3, y + 12, 10, 1, '#fff');
      R(g, sx + 1, y + 2 + Math.floor((wt * 5) % 12), 14, 1, '#fff'); R(g, sx + 12, y + 15, 3, 2, '#333'); R(g, sx + 1, y + 15, 2, 2, '#c33');
    },
  },
  chabu: {
    w: 2,
    make: () => C(32, 20, g => { EL(g, 16, 8, 15, 7, '#630'); EL(g, 16, 7, 15, 7, '#c96'); R(g, 4, 13, 2, 7, '#630'); R(g, 26, 13, 2, 7, '#630'); R(g, 19, 2, 5, 6, '#cff'); R(g, 20, 4, 3, 4, '#c93'); R(g, 7, 5, 8, 4, '#fff'); R(g, 8, 6, 6, 1, '#c66'); }),
    look: 'ちゃぶ台です。麦茶は ぬるく なって います。',
  },
  fan: {
    look: '扇風機です。首を ふって います。',
    draw(g, o, sx, sy, wt) {
      const y = sy + 16 - 30, a = Math.round(Math.sin(wt * 0.9) * 3);
      R(g, sx + 3, y + 27, 10, 3, '#999'); R(g, sx + 3, y + 27, 10, 1, '#ccc'); R(g, sx + 7, y + 14, 2, 14, '#999');
      EL(g, sx + 8 + a, y + 8, 8, 8, '#666'); EL(g, sx + 8 + a, y + 8, 7, 7, '#cff');
      for (let k = 0; k < 3; k++) { const an = wt * 21 + k * 2.094; LN(g, sx + 8 + a, y + 8, sx + 8 + a + Math.cos(an) * 6, y + 8 + Math.sin(an) * 6, '#69c'); }
      R(g, sx + 7 + a, y + 7, 3, 3, '#333');
    },
  },
  fusuma: {
    w: 2, h: 2, layer: 'bake', solid: false,
    make: () => C(32, 32, g => { R(g, 0, 2, 32, 30, '#630'); R(g, 2, 4, 13, 28, '#ffc'); R(g, 17, 4, 13, 28, '#ffc'); R(g, 15, 4, 2, 28, '#000'); R(g, 11, 17, 2, 4, '#333'); R(g, 19, 17, 2, 4, '#333'); DI(g, 2, 22, 13, 10, '#cc9', 4); DI(g, 17, 22, 13, 10, '#cc9', 4); }),
  },
  cal: {
    layer: 'bake',
    make: () => C(16, 16, g => { R(g, 2, 1, 12, 14, '#999'); R(g, 3, 2, 10, 12, '#fff'); R(g, 3, 2, 10, 3, '#c33'); ROWS(g, 4, 7, ['###.#', '..#.#', '###.#', '..#.#', '###.#'], { '#': '#333' }); R(g, 10, 7, 2, 5, '#fff'); R(g, 10, 7, 1, 5, '#333'); }),
    look: 'カレンダーです。8月31日 から めくれません。',
  },
  wclock: {
    layer: 'bake',
    make: () => C(16, 16, g => { EL(g, 8, 8, 6, 6, '#630'); EL(g, 8, 8, 5, 5, '#fff'); R(g, 8, 4, 1, 1, '#333'); R(g, 8, 12, 1, 1, '#333'); R(g, 4, 8, 1, 1, '#333'); R(g, 12, 8, 1, 1, '#333'); R(g, 8, 8, 1, 1, '#c33'); }),
    look: '時計です。針が ありません。',
  },
  curtain: {
    w: 2, h: 2, layer: 'wall',
    look: 'カーテンです。うしろに 窓は ありません。',
    draw(g, o, sx, sy, wt) {
      R(g, sx, sy + 2, 32, 2, '#630');
      for (let i = 0; i < 16; i++) { const sw = Math.round(Math.sin(wt * 1.3 + i * 0.7) * 1.5); R(g, sx + i * 2, sy + 4, 2, 24 + sw, (i & 1) ? '#fff' : '#ffc'); }
    },
  },
  sun: {
    w: 3, h: 2, layer: 'floor', solid: false, reach: 0,
    look: null,
    draw(g, o, sx, sy, wt, t, taken) {
      g.fillStyle = taken ? 'rgba(140,160,255,0.28)' : 'rgba(255,214,110,0.55)';
      for (let j = 0; j < 30; j++) g.fillRect(Math.round(sx + 4 + j * 0.45), sy + 1 + j, 34, 1);
      g.fillStyle = taken ? 'rgba(90,100,160,0.3)' : 'rgba(200,150,60,0.4)';
      for (let j = 0; j < 30; j++) g.fillRect(Math.round(sx + 4 + j * 0.45) + 16, sy + 1 + j, 2, 1);
      g.fillRect(sx + 11, sy + 15, 34, 2);
      if (!taken) for (let k = 0; k < 5; k++) { const px = sx + 8 + ((hash2(k, o.x, 3) * 30 + wt * (2 + k)) % 34), py = sy + 3 + ((hash2(k, o.y, 9) * 26 + wt * 3 * (k & 1 ? 1 : -1)) % 26 + 26) % 26; R(g, px, py, 1, 1, '#fff'); }
    },
  },
  zabu: {
    layer: 'bake', solid: false,
    make: () => C(16, 16, g => { R(g, 1, 3, 14, 11, '#936'); R(g, 2, 4, 12, 9, '#c69'); R(g, 7, 8, 2, 2, '#936'); }),
  },
  katori: {
    look: '蚊取り線香です。蚊は いません。',
    draw(g, o, sx, sy, wt) {
      EL(g, sx + 8, sy + 11, 5, 2, '#ccc'); EL(g, sx + 8, sy + 10, 4, 2, '#363'); R(g, sx + 7, sy + 10, 2, 1, '#6c6'); R(g, sx + 11, sy + 9, 1, 1, '#f60');
      for (let k = 0; k < 9; k++) { const yy = sy + 8 - k * 3, xx = sx + 11 + Math.round(Math.sin(wt * 1.4 + k * 0.8) * (1 + k * 0.4)); if ((k + Math.floor(wt * 3)) % 3) R(g, xx, yy, 1, 2, '#fff'); }
    },
  },
  wframe: {
    w: 2, h: 2, layer: 'wall', solid: false,
    draw(g, o, sx, sy, wt) { goldFrame(g, sx, sy + 1, 32, 31); prevClip(g, o.to, sx + 4, sy + 5, 24, 27, wt); },
  },
  // ── みず ──
  tpillar: {
    opaque: true,
    make: () => C(16, 46, g => {
      R(g, 1, 0, 14, 46, '#fff'); for (let i = 0; i < 46; i += 4) R(g, 1, i, 14, 1, '#cff'); for (let i = 1; i < 16; i += 4) R(g, i, 0, 1, 46, '#cff');
      R(g, 11, 0, 4, 46, '#cff'); R(g, 1, 16, 14, 4, '#39c'); R(g, 0, 44, 16, 2, '#699');
    }),
    look: 'タイルの 柱です。ぬれて いません。',
  },
  drip: {
    layer: 'floor', solid: false, cand: 'oto', reach: 1, look: null,
    tick(o, wt, pw) { const T = 2.2; if (Math.floor(wt / T - 0.55) !== Math.floor(pw / T - 0.55)) Snd.sfx('drip'); },
    draw(g, o, sx, sy, wt, t, taken) {
      const cx = sx + 8, cy = sy + 9;
      if (taken) return;
      const p = (wt % 2.2) / 2.2;
      if (p < 0.55) { const k = p / 0.55, y = cy - 150 + 150 * k * k; R(g, cx, y - 3, 1, 3, '#cff'); R(g, cx - 1, y, 3, 2, '#fff'); }
      else { const k = (p - 0.55) / 0.45; ELO(g, cx, cy, 3 + k * 13, 1 + k * 5, '#fff'); if (k > 0.3) ELO(g, cx, cy, (k - 0.3) * 13, (k - 0.3) * 5, '#cff'); }
    },
  },
  ladder: {
    layer: 'bake', solid: false,
    make: () => C(16, 16, g => { R(g, 3, 0, 2, 16, '#ccc'); R(g, 11, 0, 2, 16, '#ccc'); for (let j = 2; j < 16; j += 5) R(g, 3, j, 10, 1, '#999'); }),
  },
  ball: {
    look: 'ビーチボールです。空気は ぬけません。',
    draw(g, o, sx, sy, wt) {
      const y = sy + 6 + Math.round(Math.sin(wt * 1.7) * 1.2);
      EL(g, sx + 8, y, 5, 5, '#303'); EL(g, sx + 8, y, 4, 4, '#fff'); R(g, sx + 4, y - 1, 9, 2, '#c33'); R(g, sx + 7, y - 4, 2, 9, '#39c'); R(g, sx + 6, y - 3, 1, 1, '#fff');
    },
  },
  wdoor: {
    w: 1, h: 2, layer: 'wall', solid: false,
    draw(g, o, sx, sy, wt) { R(g, sx, sy + 2, 16, 30, '#699'); R(g, sx + 1, sy + 3, 14, 29, '#fff'); prevClip(g, o.to, sx + 4, sy + 6, 8, 9, wt); R(g, sx + 11, sy + 19, 2, 2, '#699'); },
  },
  lchair: {
    make: () => C(16, 40, g => { R(g, 2, 14, 2, 26, '#fff'); R(g, 12, 14, 2, 26, '#fff'); R(g, 2, 12, 12, 3, '#fff'); R(g, 2, 0, 12, 12, '#fff'); R(g, 4, 2, 8, 8, '#cff'); for (let j = 20; j < 40; j += 6) R(g, 2, j, 12, 1, '#ccc'); }),
    look: '監視台です。だれも 見て いません。',
  },
  // ── こうじちゅう ──
  cone: {
    make: () => C(16, 18, g => { for (let j = 0; j < 14; j++) { const w = 2 + Math.floor(j * 0.6); R(g, 8 - Math.floor(w / 2), 1 + j, w, 1, (j > 4 && j < 8) ? '#fff' : '#f60'); } R(g, 2, 15, 12, 3, '#f60'); R(g, 2, 17, 12, 1, '#c30'); }),
    look: 'コーンです。',
  },
  kouji: {
    w: 4,
    make: () => C(64, 34, g => {
      R(g, 2, 0, 60, 22, '#333'); R(g, 3, 1, 58, 20, '#fff'); Text.draw(g, '工事中', 32, 3, '#333', { align: 'center' });
      for (let i = 0; i < 64; i += 8) { R(g, i, 23, 8, 5, (i / 8) & 1 ? '#000' : '#fc0'); }
      R(g, 6, 28, 2, 6, '#999'); R(g, 56, 28, 2, 6, '#999');
    }),
    look: '「工事中」。いつから 工事中 なのかは 書いて ありません。',
  },
  broken: {
    make: () => C(16, 16, g => { R(g, 0, 0, 16, 16, '#999'); R(g, 1, 1, 14, 14, '#fff'); R(g, 3, 3, 6, 6, '#ccc'); R(g, 4, 6, 2, 2, '#393'); R(g, 6, 4, 2, 2, '#39c'); LN(g, 3, 3, 8, 8, '#c33'); LN(g, 8, 3, 3, 8, '#c33'); }),
    look: '画像を 表示 できません。',
  },
  cube: {
    opaque: true,
    make: () => C(16, 30, g => { R(g, 0, 0, 16, 30, '#000'); R(g, 1, 1, 14, 12, '#fff'); R(g, 1, 14, 14, 15, '#ccc'); LN(g, 1, 28, 14, 14, '#999'); }),
    look: 'まだ 絵が 貼られて いない 箱です。',
  },
  hourglass: {
    cand: 'jikan', reach: 1,
    look: (o, tx, taken) => taken ? '砂時計です。止まって います。もう 待って いません。' : '砂時計です。ずっと 回って います。',
    draw(g, o, sx, sy, wt, t, taken) {
      const bob = taken ? 0 : Math.round(Math.sin(wt * 1.2) * 2), y = sy - 12 + bob, c1 = taken ? '#999' : '#fff', sand = taken ? '#666' : '#fc0';
      EL(g, sx + 8, sy + 13, 5, 2, '#033');
      const ph = taken ? 0.5 : (wt % 2.4) / 2.4;
      if (ph > 0.86) { // ひっくり返る途中（横向き）
        R(g, sx, y + 6, 2, 12, '#000'); R(g, sx + 14, y + 6, 2, 12, '#000'); R(g, sx + 2, y + 7, 12, 10, c1); R(g, sx + 7, y + 10, 2, 4, '#000'); R(g, sx + 3, y + 9, 3, 6, sand);
      } else {
        R(g, sx + 2, y, 12, 2, '#000'); R(g, sx + 2, y + 22, 12, 2, '#000');
        for (let j = 0; j < 10; j++) { const w = Math.max(2, 10 - j); R(g, sx + 8 - w / 2, y + 2 + j, w, 1, c1); R(g, sx + 8 - w / 2, y + 21 - j, w, 1, c1); }
        const lv = Math.floor(ph / 0.86 * 8);
        for (let j = lv; j < 8; j++) { const w = Math.max(1, 8 - j); R(g, sx + 8 - w / 2, y + 3 + j, w, 1, sand); }
        for (let j = 0; j < lv; j++) { const w = Math.max(1, 8 - j); R(g, sx + 8 - w / 2, y + 20 - j, w, 1, sand); }
        if (!taken) R(g, sx + 8, y + 11, 1, 9 - lv, sand);
      }
    },
  },
  bar99: {
    w: 3, layer: 'bake',
    make: () => C(48, 16, g => { R(g, 0, 3, 48, 11, '#999'); R(g, 1, 4, 46, 9, '#fff'); for (let i = 0; i < 9; i++) R(g, 2 + i * 5, 5, 4, 7, '#339'); R(g, 0, 3, 48, 1, '#666'); }),
    look: '99% です。ずっと 99% です。',
  },
  t404: {
    w: 3, h: 2, layer: 'bake', solid: false,
    make: () => C(48, 32, g => { g.imageSmoothingEnabled = false; Text.draw(g, '404', 0, 0, '#0cc', { scale: 2 }); }),
  },
  sample: {
    w: 4, layer: 'bake', solid: false,
    make: () => C(64, 16, g => { Text.draw(g, 'サンプル', 0, 0, '#666'); }),
  },
});

const sprCache = new Map();
function mkObj(d) {
  const p = OBJ[d.k];
  if (!p) throw new Error('知らない物: ' + d.k);
  const o = Object.assign({ w: 1, h: 1, solid: true, opaque: false, layer: 'stand' }, p, d);
  if (p.make) {
    const key = d.k + '|' + (d.c || '') + '|' + (d.c2 || '');
    let s = sprCache.get(key);
    if (!s) { s = p.make(o); if (o.layer === 'stand') s = outline(s, '#303'); sprCache.set(key, s); }
    o.spr = s;
  }
  return o;
}
// 物を描く。sx, sy は物の左上タイルの画面位置。
function drawObj(g, o, sx, sy, wt, t, taken) {
  if (o.draw) { o.draw(g, o, sx, sy, wt, t, taken); return; }
  if (!o.spr) return;
  if (o.layer === 'stand') g.drawImage(o.spr, sx + (o.ox || 0) - 1, sy + o.h * 16 - o.spr.height + (o.oy || 0) + 1);
  else g.drawImage(o.spr, sx + (o.ox || 0), sy + (o.oy || 0));
}
