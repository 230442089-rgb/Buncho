// ───────── 人物のドット絵 ─────────
// エデル: 白銀のくせ毛、丸眼鏡、白シャツ、肩から落とした黒い上着、黒のハイウエスト。背が高い（16x36）。
// アセラ: 褐色肌、白銀の乱れ髪とアホ毛、片側の編み込み、赤橙の目、白い上着、黒い短パン、ルーズソックス（16x24）。
const PAL_E = {
  H: '#fff', h: '#ccf', d: '#99c', S: '#fcc', s: '#c99', m: '#c66', F: '#999', E: '#333',
  W: '#fff', w: '#ccf', J: '#333', j: '#000', k: '#666', P: '#333', p: '#000', B: '#000', b: '#ccc',
};
const PAL_A = {
  H: '#fff', h: '#ccf', d: '#99c', B: '#fff', b: '#ccf', T: '#c96', t: '#963', E: '#f60', e: '#c30', M: '#fff',
  W: '#fff', w: '#ccc', X: '#fff', K: '#333', V: '#96f', L: '#fff', l: '#ccc',
};

const E_HEAD_D = [
  '......hHHh......', '....hHHHHHHh....', '...hHHHHHHHHh...', '...HHHHHHHHHH...', '...HHhHHHHhHH...', '...HhHhHHhHhH...',
  '...hFFFSSFFFh...', '...hFEFFFFEFh...', '...dFFFSSFFFd...', '....SSSSSSSS....', '....sSSmmSSs....', '.....sSSSSs.....', '......sSSs......',
];
const E_BODY_D = [
  '....wWWSSWWw....', '...WWWWSSWWWW...', '..kWWWWWWWWWWk..', '.kJJWWWWWWWWJJk.', '.JJJWWWWWWWWJJJ.',
  '.JJJwWWWWWWwJJJ.', '.JJJPbPPPPbPJJJ.', '.JJJPbPPPPbPJJJ.', '.jJJPPPPPPPPJJj.', '.jJSPPPPPPPPSJj.',
];
const LEG = '....PPP..PPP....';
const E_LEGS_D = [
  ['..jjPPPppPPPjj..', '...jPPPppPPPj...', LEG, LEG, LEG, LEG, LEG, LEG, LEG, LEG, LEG, '....BBB..BBB....', '...BBBB..BBBB...'],
  ['..jjPPPppPPPjj..', '...jPPPppPPPj...', LEG, LEG, LEG, LEG, LEG, LEG, LEG, '....PPP..BBB....', '....PPP..BBBB...', '....BBB.........', '...BBBB.........'],
  ['..jjPPPppPPPjj..', '...jPPPppPPPj...', LEG, LEG, LEG, LEG, LEG, LEG, LEG, '....BBB..PPP....', '...BBBB..PPP....', '.........BBB....', '.........BBBB...'],
];
const E_HEAD_U = [
  '......hHHh......', '....hHHHHHHh....', '...hHHHHHHHHh...', '...HHHHHHHHHH...', '...HHHHHHHHHH...', '...HHhHHHHhHH...',
  '...HhHHhHHHhH...', '...hHHhHHhHHh...', '...dHhHHHHhHd...', '...dhHHhhHHhd...', '....dhhddhhd....', '.....dSSSSd.....', '......sSSs......',
];
const E_BODY_U = [
  '....wWWWWWWw....', '...WWWWWWWWWW...', '..kWWWWWWWWWWk..', '.kJJkkkkkkkkJJk.', '.JJJJJJJJJJJJJJ.', '.JJJJJJJjJJJJJJ.',
  '.JJJJJJJjJJJJJJ.', '.JJJJJJJjJJJJJJ.', '.jJJJJJJjJJJJJj.', '.jJSJJJJjJJJSJj.', '..jjJJJJJJJJjj..', '...jjJJJJJJjj...',
];
const E_HEAD_L = [
  '......hHHHh.....', '....hHHHHHHh....', '...hHHHHHHHHh...', '...HHHHHHHHHH...', '..hHHhHHHHHHH...', '..HhHhHHHHHHh...',
  '..FFFShHHHHHh...', '..FEFFFFhHHHd...', '..FFFSShHHHhd...', '...SSSSShHHd....', '...mSSSsdhd.....', '....sSSs........', '.....SSs........',
];
const E_BODY_L = [
  '....WWWWw.......', '...WWWWWWk......', '...WWWWWWJk.....', '...WWWWWJJJk....', '...wWWWWJJJJ....', '...wWWWWJJJJ....',
  '...PbPPPJJJJ....', '...PPPPPJJJj....', '...PPPPSJJJj....', '...PPPPPJJjj....', '....PPPPjjj.....', '....PPPPjj......',
];
const SLEG = '....PPPP........';
const E_LEGS_L = [
  [SLEG, SLEG, SLEG, SLEG, SLEG, SLEG, SLEG, SLEG, SLEG, '....BBBB........', '...BBBBB........'],
  ['....PPPP........', '....PPPPP.......', '...PPPPPP.......', '...PPP.PPP......', '..PPP...PPP.....', '..PPP...PPP.....',
    '.PPP.....PPP....', '.PPP.....PPP....', '.PPP.....PPP....', '.BBB.....BBB....', 'BBBB....BBBB....'],
];

const A_HEAD_D = [
  '........Hh......', '.......HH.......', '....hHHHHHHh....', '...HHHHHHHHHHh..', '..hHHHHHHHHHHH..', '..HHhHHhHHhHHH..',
  '..HhTTHTTHTThH..', '..HTEETTTEETHh..', '..hTEeTTTEeTdB..', '...TTTMMMTTT.B..', '...tTTTTTTTt.b..',
];
const A_BODY_D = ['..WWtTTTTTtWWb..', '.WWWXXXXXXXWWW..', '.WWKXXXXXXXKWW..', '.WWKTTTTTTTKWW..', '.WWKKKKKKKKKWW..', '.wWtKKKKKKKtWw..'];
const A_LEGS_D = [
  ['..w.KKK.KKK.w...', '....TTT.TTT.....', '....LLL.LLL.....', '....LLL.LLL.....', '....lLL.LLl.....', '...WWWW.WWWW....', '...VVVV.VVVV....'],
  ['..w.KKK.KKK.w...', '....TTT.TTT.....', '....LLL.LLL.....', '....LLL.lLL.....', '....lLL.WWWW....', '...WWWW.VVVV....', '...VVVV.........'],
  ['..w.KKK.KKK.w...', '....TTT.TTT.....', '....LLL.LLL.....', '....LLl.LLL.....', '...WWWW.LLl.....', '...VVVV.WWWW....', '........VVVV....'],
];
const A_HEAD_U = [
  '........Hh......', '.......HH.......', '....hHHHHHHh....', '...HHHHHHHHHHh..', '..hHHHHHHHHHHH..', '..HHHHHHHHHHHH..',
  '..HHhHHHHHhHHH..', '..HhHHhHHhHHhH..', '..hHHhHHHHhHdB..', '...dhHHhHHhd.B..', '...tdhhddhht.b..',
];
const A_BODY_U = ['..WWtTTTTTtWWb..', '.WWWWWWWWWWWWW..', '.WWWWWKKKWWWWW..', '.WWWWWKVKWWWWW..', '.WWWWWWWWWWWWW..', '.wWtKKKKKKKtWw..'];
const A_HEAD_L = [
  '......Hh........', '.....HH.........', '...hHHHHHHh.....', '..HHHHHHHHHHh...', '.hHHHHHHHHHHH...', '.HHhHHHHHHHHH...',
  '.HTTHhHHHHHHh...', '.TEETThHHHHHB...', '.TEeTTThHHHdB...', '.MTTTTTdHHd.b...', '..tTTTtdd...b...',
];
const A_BODY_L = ['...tTTWWW.......', '...XXXWWWW......', '...XXXKWWWW.....', '...TTTKWWWW.....', '...KKKKWWWw.....', '...KKKKtWw......'];
const A_LEGS_L = [
  ['...KKKKK........', '....TTT.........', '....LLL.........', '....LLL.........', '....LLl.........', '...WWWW.........', '...VVVV.........'],
  ['...KKKKK........', '...TTTTTT.......', '..TTT..TTT......', '..LLL...LLL.....', '.LLL....LLl.....', '.WWW....WWWW....', 'VVVV....VVVV....'],
];

const Sprites = { edel: null, asera: null, aseraAfter: null, shadow: null };
function buildSprites() {
  const chk = (rows, n) => { if (DEBUG) for (const r of rows) if (r.length !== 16) console.warn('ドット絵の幅が違う', r); if (DEBUG && rows.length !== n) console.warn('ドット絵の高さが違う', rows.length, n); return rows; };
  const mk = (rows, pal, n) => outline(SPR(chk(rows, n), pal), '#303');
  // エデル
  const ed = [0, 1, 2].map(i => mk(E_HEAD_D.concat(E_BODY_D, E_LEGS_D[i]), PAL_E, 36));
  const eu = [0, 1, 2].map(i => mk(E_HEAD_U.concat(E_BODY_U, E_LEGS_D[i].slice(2)), PAL_E, 36));
  const el = [0, 1].map(i => mk(E_HEAD_L.concat(E_BODY_L, E_LEGS_L[i]), PAL_E, 36));
  Sprites.edel = {
    down: [ed[0], ed[1], ed[0], ed[2]], up: [eu[0], eu[1], eu[0], eu[2]],
    left: [el[0], el[1], el[0], el[1]], right: [el[0], el[1], el[0], el[1]].map(flipH),
  };
  // アセラ
  const ad = [0, 1, 2].map(i => mk(A_HEAD_D.concat(A_BODY_D, A_LEGS_D[i]), PAL_A, 24));
  const au = [0, 1, 2].map(i => mk(A_HEAD_U.concat(A_BODY_U, A_LEGS_D[i]), PAL_A, 24));
  const al = [0, 1].map(i => mk(A_HEAD_L.concat(A_BODY_L, A_LEGS_L[i]), PAL_A, 24));
  Sprites.asera = {
    down: [ad[0], ad[1], ad[0], ad[2]], up: [au[0], au[1], au[0], au[2]],
    left: [al[0], al[1], al[0], al[1]], right: [al[0], al[1], al[0], al[1]].map(flipH),
  };
  // 残像（白・黒・淡紫）
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
  const stip = c => { const o = silh(c, '#303', true); o.getContext('2d').fillStyle = '#f60'; o.getContext('2d').fillRect(29, 5, 2, 1); return o; };
  const r0 = stip(sh(0)), r1 = stip(sh(1));
  Sprites.shadow = { right: [r0, r1], left: [flipH(r0), flipH(r1)] };
}
// アセラの目の位置（絵の左上から。ふちどりの 1px を含む）
const A_EYES = {
  down: [[5, 8], [6, 8], [10, 8], [11, 8], [5, 9], [10, 9]],
  left: [[3, 8], [4, 8], [3, 9]],
  right: [[14, 8], [13, 8], [14, 9]],
  up: [],
};
