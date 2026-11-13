// ───────── 人物のドット絵 ─────────
// 元絵に寄せた低頭身の絵。左右対称の部分は半分だけ書いて鏡写しにし、目や毛先はあとから 1 点ずつ置く。
// エデル: ふわっとした白銀の短い髪、細い丸眼鏡の奥の伏せた目、白シャツ、肩から落とした上着、ハイウエスト。24x42
// アセラ: 褐色肌、はねた白銀の髪と大きなアホ毛、片側の編み込み、大きな赤橙の目、八重歯、白い上着、黒の短パン。24x38
const px = (g, x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
const pxs = (g, c, pts) => { g.fillStyle = c; for (let i = 0; i < pts.length; i += 2) g.fillRect(pts[i], pts[i + 1], 1, 1); };
const mir = rows => rows.map(r => r + r.split('').reverse().join(''));   // 左半分 → 全幅

const PAL_E = { H: '#fff', h: '#ccf', d: '#99c', S: '#fcc', s: '#c99', b: '#f99', R: '#669', r: '#ccf', M: '#c66', W: '#fff', w: '#ccf', J: '#336', j: '#003', k: '#669', P: '#333', p: '#000', B: '#000', n: '#ccc' };
const PAL_A = { H: '#fff', h: '#ccf', d: '#99c', T: '#c96', t: '#963', W: '#fff', w: '#ccc', X: '#fff', K: '#333', L: '#fff', l: '#ccc', V: '#96f', O: '#f96' };

// ── エデル ──
const E_HEAD_F = mir([
  '...........H', '........hHHH', '......hHHHHH', '....hHHHHHHH', '...hHHHHHHHH', '..hHHHHHHHHH', '..HHHHHHHHHH', '..HHHHhSSHHH', '..HHHhSSSShH',
  '..HHhSrrrrSh', '..HHhrSSSSrr', '..HHhrSSSSrS', '..HHhSrrrrSS', '..hHHSbSSSSS', '...HHsSSSSSM', '...hHhsSSSSS', '....hH.sSSSS', '..........ss',
]);
const E_HEAD_B = mir([
  '...........H', '........hHHH', '......hHHHHH', '....hHHHHHHH', '...hHHHHHHHH', '..hHHHHHHHHH', '..HHHHHHHHHH', '..HHHHHHHHHh', '..HHHHHHHHHh',
  '..HHHHhHHHHH', '..HHHHhHHHHH', '..HHHHHhHHHH', '..HHHHHhHHHH', '..hHHHHHhHHH', '...HHhHHHhHH', '...hHdHHHdHH', '....hHdhHdhH', '..........ss',
]);
const E_HEAD_S = [
  '..........hHH...........', '.......hHHHHHHHh........', '.....hHHHHHHHHHHHh......', '....hHHHHHHHHHHHHHh.....', '...hHHHHHHHHHHHHHHHh....', '...HHHHHHHHHHHHHHHHH....',
  '..hHHHHHHHHHHHHHHHHHh...', '..HHhSSHHhHHHHHHHHHHH...', '..HhSSSSHhHHHHHHHHHHH...', '..hrrrrSShHHHHHHHHHHHh..', '.SrSSSSrrrhHHHHHHHHHH...', '..rSSSSrSShHHHHHHHHHH...',
  '..SrrrrSSShHHHHHHHHHh...', '..SbSSSSSSHHHHHHHHHH....', '..sSMSSSSshHHHHHHHHh....', '...sSSSSs.hHHHHHHHh.....', '....sSSs...hHdhHdh......', '........ss..............',
];
const E_BODY_F = mir([
  '.........wWS', '......WWWWWS', '.....WWWWWWW', '....kWWWWWWW', '...JJJwWWWWW', '...JJJwWWWWW', '...JJJJwWWWW', '...JJJJPPnPP', '...JJJJPPnPP',
  '...JJJJPPPPP', '...jJJJPPPPP', '...jJSJPPPPp', '....jjJPPPP.', '.....jjPPPP.',
]);
const E_BODY_B = mir([
  '.........wWW', '......WWWWWW', '.....WWWWWWW', '....kkkkkkkk', '...JJJJJJJJJ', '...JJJJJJJJJ', '...JJJJJJJJj', '...JJJJJJJJj', '...JJJJJJJJj',
  '...JJJJJJJJj', '...jJJJJJJJj', '...jJSJJJJJj', '....jjJJJJJj', '.....jjPPPP.',
]);
const E_LEG = '.......PPPP.';
const E_LEGS_F = [   // 立ち・左足を上げる・右足を上げる（上げた足は 2px 短い）
  mir([E_LEG, E_LEG, E_LEG, E_LEG, E_LEG, E_LEG, E_LEG, '.......BBBB.', '......BBBBB.', '......BBBBB.']),
  [E_LEG + '.PPPP.......', E_LEG + '.PPPP.......', E_LEG + '.PPPP.......', E_LEG + '.PPPP.......', E_LEG + '.PPPP.......', E_LEG + '.BBBB.......', E_LEG + '.BBBBB......', '.......BBBB..BBBBB......', '......BBBBB.............', '......BBBBB.............'],
  ['.......PPPP..PPPP.......', '.......PPPP..PPPP.......', '.......PPPP..PPPP.......', '.......PPPP..PPPP.......', '.......PPPP..PPPP.......', '.......BBBB..PPPP.......', '......BBBBB..PPPP.......', '......BBBBB..BBBB.......', '.............BBBBB......', '.............BBBBB......'],
];
const E_BODY_S = [
  '........wWWs............', '.......WWWWWW...........', '......WWWWWWWk..........', '......WWWWWWJJk.........', '......wWWWWJJJJ.........', '......wWWWWJJJJ.........', '.......wWWWJJJJ.........',
  '.......PnPPJJJJ.........', '.......PPPPJJJJ.........', '.......PPPPJJJj.........', '.......PPPPJJJj.........', '.......PPPSJJJj.........', '.......PPPPPjjj.........', '.......PPPPPjj..........',
];
const E_LEGS_S = [
  ['........PPPP............', '........PPPP............', '........PPPP............', '........PPPP............', '........PPPP............', '........PPPP............', '........PPPP............', '........BBBB............', '.......BBBBB............', '.......BBBBB............'],
  ['.......PPPPP............', '......PPPPPPP...........', '.....PPPP.PPPP..........', '....PPPP...PPPP.........', '....PPPP...PPPP.........', '...PPPP.....PPPP........', '...PPPP.....PPPP........', '...BBBB.....BBBB........', '..BBBBB.....BBBBB.......', '..BBBBB.................'],
];
function edelFrame(dir, f, blink) {
  const leg = f === 1 ? 1 : f === 3 ? 2 : 0;
  let rows;
  if (dir === 'down') rows = E_HEAD_F.concat(E_BODY_F, E_LEGS_F[leg]);
  else if (dir === 'up') rows = E_HEAD_B.concat(E_BODY_B, E_LEGS_F[leg]);
  else rows = E_HEAD_S.concat(E_BODY_S, E_LEGS_S[f & 1]);
  return C(24, 42, g => {
    ROWS(g, 0, 0, rows, PAL_E);
    const eye = '#336';
    if (dir === 'down') {
      pxs(g, PAL_E.H, [13, 0, 2, 6, 21, 9, 1, 12, 22, 13, 20, 16]);                 // はねた毛先
      pxs(g, PAL_E.h, [8, 3, 9, 4, 15, 2, 16, 3, 7, 6, 16, 6]);                      // 髪の流れ
      if (blink) { R(g, 6, 11, 4, 1, eye); R(g, 14, 11, 4, 1, eye); }
      else { R(g, 7, 10, 3, 1, eye); R(g, 7, 11, 2, 1, eye); px(g, 6, 10, '#669'); R(g, 14, 10, 3, 1, eye); R(g, 14, 11, 2, 1, eye); px(g, 17, 10, '#669'); }
    } else if (dir === 'up') {
      pxs(g, PAL_E.H, [13, 0, 2, 6, 21, 9, 1, 12, 22, 13]);
    } else {
      pxs(g, PAL_E.H, [21, 8, 22, 12, 20, 15]);
      if (blink) R(g, 3, 11, 4, 1, eye); else { R(g, 3, 10, 3, 1, eye); R(g, 3, 11, 2, 1, eye); px(g, 6, 10, '#669'); }
    }
  });
}

// ── アセラ ──
const A_HEAD_F = mir([
  '............', '............', '.........hHH', '......hHHHHH', '....hHHHHHHH', '...HHHHHHHHH', '..hHHHHHHHHH', '.hHHHHHHHHHH', '..HHHHHHhHHH', '.hHHHhTTHhTT',
  '..HHhTTTTTTT', '.hHHhTTTTTTT', '..HhTTTTTTTT', '.hHhTTTTTTTT', '..HHTTTTTTTT', '..hHtTTTTTTT', '...HhtTTTTTT', '..hH.htTTTTT', '...h...ttTTT', '..........tt',
]);
const A_HEAD_B = mir([
  '............', '............', '.........hHH', '......hHHHHH', '....hHHHHHHH', '...HHHHHHHHH', '..hHHHHHHHHH', '.hHHHHHHHHHH', '..HHHHHHhHHH', '.hHHHHHhHHHH',
  '..HHHHHhHHHH', '.hHHHHHhHHHH', '..HHHHHHhHHH', '.hHHHHHHhHHH', '..HHHhHHHHHH', '..hHHHhHHHhH', '...HHdHHHhdH', '..hH.hHdHHdH', '...h...hdhHd', '..........tt',
]);
const A_HEAD_S = [
  '........................', '........................', '.........hHHHHh.........', '......hHHHHHHHHHh.......', '....hHHHHHHHHHHHHh......', '...HHHHHHHHHHHHHHHh.....', '..hHHHHHHHHHHHHHHHH.....', '.hHHHHHHHHHHHHHHHHHh....',
  '..HHHHhHHHHHHHHHHHHH....', '.hHHhTTHhHHHHHHHHHHHh...', '..HhTTTTThHHHHHHHHHH....', '.hhTTTTTTThHHHhHHHHHh...', '.TTTTTTTTTHHHHHHHHHH....', '..TTTTTTTThHHHHHhHHHh...', '..TTTTTTTTHHHHHHHHHH....',
  '..tTTTTTTthHHHHHHHHh....', '...tTTTTt.hHHHdHHHh.....', '....tTTt...hHdhHdh......', '.....tt.....h..h........', '.........tt.............',
];
const A_BODY_F = mir([
  '..........KK', '......WWWXXX', '.....WWWwXXK', '....WWWWwXXX', '....WWWWwKKK', '....WWWWwTTT', '....WWWWwTTT', '....KKKKwWWW', '....WWWW.KKK', '.....TT..KKK', '.........KKw',
]);
const A_BODY_B = mir([
  '..........KK', '......WWWWWW', '.....WWWWWWW', '....WWWWWWWK', '....WWWWWWKV', '....WWWWWWWK', '....WWWWWWWW', '....KKKKKKKK', '....WWWW.KKK', '.....TT..KKK', '.........KKw',
]);
const A_LEGS_F = [
  mir(['.........TT.', '........KKKK', '........LLLL', '........LLLl', '.......WWWWW', '.......WWWWW', '.......VVVVV']).map(r => r.slice(0, 12) + '.' + r.slice(13)),
  ['.........TT..TT.........', '........KKKK.KKKK.......', '........LLLL.LLLL.......', '........LLLl.WWWWW......', '.......WWWWW.WWWWW......', '.......WWWWW.VVVVV......', '.......VVVVV............'],
  ['.........TT..TT.........', '........KKKK.KKKK.......', '........LLLL.LLLL.......', '.......WWWWW.lLLL.......', '.......WWWWW.WWWWW......', '.......VVVVV.WWWWW......', '.............VVVVV......'],
];
const A_BODY_S = [
  '.........KKK............', '........XXXWWW..........', '........XXKWWWW.........', '.......XXXXWWWWW........', '.......KKKKWWWWW........', '.......TTTTWWWWw........', '.......TTTTWWWWw........', '.......WWWWKKKKK........',
  '.......KKKKKWWW.........', '.......KKKKKTT..........', '.......KKwKK............',
];
const A_LEGS_S = [
  ['........TTT.............', '.......KKKK.............', '.......LLLL.............', '.......LLLl.............', '......WWWWW.............', '.....WWWWWW.............', '.....VVVVVV.............'],
  ['.......TTTTT............', '.....KKKK.KKKK..........', '.....LLLL.LLLL..........', '....LLLL...LLLl.........', '...WWWWW...WWWWW........', '..WWWWWW...WWWWWW.......', '..VVVVVV...VVVVVV.......'],
];
function aseraFrame(dir, f) {
  const leg = f === 1 ? 1 : f === 3 ? 2 : 0;
  let rows;
  if (dir === 'down') rows = A_HEAD_F.concat(A_BODY_F, A_LEGS_F[leg]);
  else if (dir === 'up') rows = A_HEAD_B.concat(A_BODY_B, A_LEGS_F[leg]);
  else rows = A_HEAD_S.concat(A_BODY_S, A_LEGS_S[f & 1]);
  return C(24, 38, g => {
    ROWS(g, 0, 0, rows, PAL_A);
    const braid = (x, y) => { for (let i = 0; i < 5; i++) { R(g, x, y + i * 2, 3, 2, '#fff'); px(g, x + (i & 1 ? 0 : 2), y + i * 2, '#99c'); px(g, x + 1, y + i * 2 + 1, '#99c'); } R(g, x, y + 10, 3, 1, '#f96'); px(g, x + 1, y + 11, '#fff'); };
    if (dir === 'down') {
      pxs(g, '#fff', [12, 2, 12, 1, 13, 0, 14, 0, 15, 1, 13, 1]);                    // アホ毛
      pxs(g, '#ccf', [8, 5, 9, 6, 15, 5, 14, 6]);
      // 大きな目（白目・赤橙のひとみ・ハイライト）
      const eye = (x, wx) => { R(g, x, 11, 4, 1, '#333'); R(g, x, 12, 3, 2, '#f60'); R(g, x, 14, 3, 1, '#fc0'); px(g, x + 1, 13, '#930'); px(g, x, 12, '#fff'); px(g, wx, 12, '#fff'); px(g, wx, 13, '#fff'); };
      eye(6, 9); R(g, 14, 11, 4, 1, '#333'); R(g, 15, 12, 3, 2, '#f60'); R(g, 15, 14, 3, 1, '#fc0'); px(g, 16, 13, '#930'); px(g, 15, 12, '#fff'); px(g, 14, 12, '#fff'); px(g, 14, 13, '#fff');
      pxs(g, '#fff', [0, 8, 23, 8, 1, 10, 22, 10, 2, 4, 21, 4, 4, 2, 19, 2, 0, 12, 23, 12]);   // はねた毛
      pxs(g, '#f96', [5, 15, 6, 15, 17, 15, 18, 15]);                                // ほお
      R(g, 10, 16, 4, 1, '#933'); px(g, 10, 16, '#fff'); R(g, 11, 17, 2, 1, '#963');  // 口と八重歯
      braid(20, 13);
    } else if (dir === 'up') {
      pxs(g, '#fff', [12, 2, 12, 1, 13, 0, 14, 0, 15, 1, 13, 1, 0, 8, 23, 8, 1, 10, 22, 10, 2, 4, 21, 4, 4, 2, 19, 2, 0, 12, 23, 12]);
      braid(1, 13);
    } else {
      pxs(g, '#fff', [11, 2, 11, 1, 12, 0, 13, 0, 14, 1, 12, 1]);
      R(g, 3, 11, 4, 1, '#333'); R(g, 3, 12, 3, 2, '#f60'); R(g, 3, 14, 3, 1, '#fc0'); px(g, 4, 13, '#930'); px(g, 3, 12, '#fff'); px(g, 6, 12, '#fff'); px(g, 6, 13, '#fff');
      pxs(g, '#fff', [21, 9, 22, 12, 20, 16, 3, 3, 18, 2]);
      pxs(g, '#f96', [3, 15, 4, 15]);
      R(g, 2, 16, 3, 1, '#933'); px(g, 2, 16, '#fff');
      braid(11, 15);
    }
  });
}

const Sprites = { edel: null, edelBlink: null, asera: null, aseraAfter: null, shadow: null };
function buildSprites() {
  const OL = '#636';
  if (DEBUG) {
    const chk = (nm, rows, w) => rows.forEach((r, i) => { if (r.length !== w) console.warn('ドット絵の幅が違う', nm, i, r.length); });
    for (const [nm, rows] of [['EHF', E_HEAD_F], ['EHB', E_HEAD_B], ['EHS', E_HEAD_S], ['EBF', E_BODY_F], ['EBB', E_BODY_B], ['EBS', E_BODY_S], ['ELF0', E_LEGS_F[0]], ['ELF1', E_LEGS_F[1]], ['ELF2', E_LEGS_F[2]], ['ELS0', E_LEGS_S[0]], ['ELS1', E_LEGS_S[1]],
      ['AHF', A_HEAD_F], ['AHB', A_HEAD_B], ['AHS', A_HEAD_S], ['ABF', A_BODY_F], ['ABB', A_BODY_B], ['ABS', A_BODY_S], ['ALF0', A_LEGS_F[0]], ['ALF1', A_LEGS_F[1]], ['ALF2', A_LEGS_F[2]], ['ALS0', A_LEGS_S[0]], ['ALS1', A_LEGS_S[1]]]) chk(nm, rows, 24);
  }
  const set = (fn, a) => {
    const o = {};
    for (const d of ['down', 'up', 'left']) o[d] = [0, 1, 2, 3].map(f => outline(fn(d, f, a), OL));
    o.right = o.left.map(flipH);
    return o;
  };
  Sprites.edel = set(edelFrame, false);
  Sprites.edelBlink = set(edelFrame, true);
  Sprites.asera = set(aseraFrame);
  Sprites.aseraAfter = {};
  for (const d of DIRS) Sprites.aseraAfter[d] = ['#fff', '#303', '#96f'].map(c => silh(Sprites.asera[d][1], c, true));
  // 影の竜（右向き 2 コマ）
  const sh = f => C(36, 16, g => {
    const c = '#303';
    EL(g, 16, 8, 11, 4, c); EL(g, 27, 6, 5, 3, c);
    R(g, 27, 1, 1, 3, c); R(g, 30, 0, 1, 4, c); R(g, 32, 6, 3, 2, c);
    LN(g, 7, 8, 0, 4 + f * 2, c); LN(g, 7, 9, 1, 5 + f * 2, c); LN(g, 7, 7, 3, 5 + f, c);
    const a = f ? 3 : -2;
    LN(g, 10, 11, 8 + a, 15, c); LN(g, 11, 11, 9 + a, 15, c); LN(g, 21, 11, 23 - a, 15, c); LN(g, 22, 11, 24 - a, 15, c);
  });
  const stip = c => silh(c, '#303', true);
  const r0 = stip(sh(0)), r1 = stip(sh(1));
  Sprites.shadow = { right: [r0, r1], left: [flipH(r0), flipH(r1)] };
}
// 絵の大きさ（ふちどり込み）
const EDEL_W = 26, EDEL_H = 44, ASERA_W = 26, ASERA_H = 40;
// アセラの目の位置（絵の左上から。ふちどりの 1px を含む）
const A_EYES = {
  down: [[8, 13], [9, 14], [16, 13], [17, 14]],
  left: [[5, 13], [5, 14]],
  right: [[20, 13], [20, 14]],
  up: [],
};
