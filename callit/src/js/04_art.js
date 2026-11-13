// ───────── 絵（タイル、置き物、人物）─────────
// 西テキサスの夜。色は少なく、暗い。光の当たる所だけが見える。
const Art = (() => {
  // 夜ごとの色: floor 部屋の床, floorB 板石の床, hall 通路, wall 壁（上面・面・すそ）, amb 夜の暗さ
  const STYLES = [
    { floor: ['#5a3a2a', '#6a4630'], floorB: ['#54544c', '#44443c'], hall: ['#4c4c4a', '#3c3c3a'], wall: ['#131317', '#8a7858', '#62533c'], amb: '#434b74' },
    { floor: ['#4a2228', '#5e2c36'], floorB: ['#5a5a50', '#47473f'], hall: ['#3c3026', '#4a3a2c'], wall: ['#101012', '#6a5236', '#4c3a26'], amb: '#6a6050' },
    { floor: ['#3a3a3a', '#444444'], floorB: ['#4a4a46', '#3c3c38'], hall: ['#454548', '#38383b'], wall: ['#121216', '#6c6c70', '#4a4a50'], amb: '#56608c' },
  ];
  const spk = (g, px, py, tx, ty, n, c, s) => { for (let i = 0; i < n; i++) R(g, px + Math.floor(hash2(tx, ty, i + s) * 16), py + Math.floor(hash2(ty, tx, i + s + 31) * 16), 1, 1, c); };
  // 動かないタイルを 1 枚描く。get(tx, ty) でまわりのタイルが分かる。
  function tile(g, ch, px, py, tx, ty, st, get) {
    const S = STYLES[st];
    if (ch === '~') { R(g, px, py, 16, 16, '#3a3326'); spk(g, px, py, tx, ty, 4, '#4a4232', 1); spk(g, px, py, tx, ty, 3, '#2c261c', 9); if (hash2(tx, ty, 5) < 0.06) { R(g, px + 5, py + 9, 5, 2, '#4e4a30'); R(g, px + 7, py + 7, 2, 2, '#4e4a30'); } }
    else if (ch === '=' || ch === '-') { R(g, px, py, 16, 16, '#1c1d22'); spk(g, px, py, tx, ty, 3, '#26272d', 2); if (ch === '-' && (tx & 1)) R(g, px + 2, py + 7, 12, 2, '#8a7a2a'); }
    else if (ch === ':') { R(g, px, py, 16, 16, '#26272c'); spk(g, px, py, tx, ty, 3, '#303138', 3); spk(g, px, py, tx, ty, 2, '#1e1f24', 7); }
    else if (ch === '_') { R(g, px, py, 16, 16, S.hall[0]); if (st === 1) { for (let j = 0; j < 16; j += 8) for (let i = 0; i < 16; i += 8) R(g, px + i + 3, py + j + 3, 2, 2, S.hall[1]); } else { R(g, px, py + 15, 16, 1, S.hall[1]); R(g, px + 15, py, 1, 16, S.hall[1]); } }
    else if (ch === '.' || ch === 'D') { R(g, px, py, 16, 16, S.floor[0]); for (let j = 0; j < 16; j += 8) for (let i = 0; i < 16; i += 8) { R(g, px + i + 3, py + j + 1, 2, 6, S.floor[1]); R(g, px + i + 1, py + j + 3, 6, 2, S.floor[1]); } if (ch === 'D') R(g, px, py, 16, 16, 'rgba(0,0,0,0.25)'); }
    else if (ch === ',') { R(g, px, py, 16, 16, S.floorB[0]); R(g, px, py, 8, 8, S.floorB[1]); R(g, px + 8, py + 8, 8, 8, S.floorB[1]); }
    else if (ch === 'e' || ch === 'E' || ch === 'H') { R(g, px, py, 16, 16, '#2a2a30'); spk(g, px, py, tx, ty, 3, '#34343b', 4); if (ch === 'E' && (tx & 1)) R(g, px + 2, py + 7, 12, 2, '#7a7a80'); }
    else if (ch === 'm') { R(g, px, py, 16, 16, '#323a26'); spk(g, px, py, tx, ty, 5, '#40502f', 5); spk(g, px, py, tx, ty, 3, '#262c1e', 8); }
    else if (ch === 'S') { R(g, px, py, 16, 16, '#3a3a3c'); for (let i = 2; i < 16; i += 4) R(g, px + i, py, 1, 16, '#55555a'); }
    else if (ch === 'w') { R(g, px, py, 16, 16, '#0b1820'); if (hash2(tx, ty, 6) < 0.5) R(g, px + 2 + Math.floor(hash2(tx, ty, 7) * 6), py + 4 + Math.floor(hash2(tx, ty, 8) * 8), 6, 1, '#17323c'); }
    else if (ch === 'r' || ch === 'R') {
      const up = get(tx, ty - 1), deckAbove = up === 'e' || up === 'E';
      R(g, px, py, 16, 16, '#0b1820');
      const y = deckAbove ? 1 : 12;
      R(g, px, py + y, 16, 2, '#7c7c84'); R(g, px + 7, py + y, 2, 5, '#55555c');
      if (ch === 'R') { R(g, px + 3, py + y, 10, 2, '#0b1820'); R(g, px + 3, py + y, 1, 4, '#e0a030'); R(g, px + 12, py + y, 1, 4, '#e0a030'); for (let i = 0; i < 4; i++) R(g, px + 4 + i, py + y + 6 + i, 8 - i * 2, 1, '#e0a030'); }
    }
    else if (ch === '#' || ch === 'V') {
      const dn = get(tx, ty + 1), face = dn !== '#' && dn !== 'V' && dn !== ' ';
      R(g, px, py, 16, 16, S.wall[0]);
      if (face) { R(g, px, py + 7, 16, 9, S.wall[1]); R(g, px, py + 7, 16, 1, '#ffffff22'); R(g, px, py + 14, 16, 2, S.wall[2]); }
      else { R(g, px, py, 1, 16, '#ffffff10'); }
      if (ch === 'V') { R(g, px + 3, py + 1, 10, 5, '#2c2c30'); for (let i = 0; i < 3; i++) R(g, px + 4, py + 2 + i * 1.5, 8, 1, '#6a6a70'); if (face) { R(g, px + 3, py + 8, 10, 6, '#2c2c30'); for (let i = 0; i < 3; i++) R(g, px + 4, py + 9 + i * 2, 8, 1, '#8a8a90'); } }
    }
    else R(g, px, py, 16, 16, '#000');
  }

  // 人物（16x24。足もとが下端の中央）。dir: down / up / left。f: 0 立ち, 1・2 歩き
  function person(pal, head, dir, f) {
    return C(16, 24, g => {
      if (dir === 'left') {
        if (f === 1) { R(g, 4, 17, 3, 4, pal.leg); R(g, 3, 21, 4, 2, pal.boot); R(g, 9, 17, 3, 5, pal.leg); R(g, 9, 22, 4, 2, pal.boot); }
        else if (f === 2) { R(g, 6, 17, 4, 4, pal.leg); R(g, 5, 21, 5, 2, pal.boot); }
        else { R(g, 6, 17, 4, 5, pal.leg); R(g, 5, 22, 5, 2, pal.boot); }
        R(g, 5, 9, 6, 8, pal.coat); R(g, 5, 9, 1, 8, pal.coat2); R(g, 7, 10, 2, 6, pal.coat2); R(g, 7, 16, 2, 1, pal.skin);
        R(g, 4, 2, 7, 7, pal.skin); R(g, 5, 5, 1, 1, '#1a1410'); R(g, 3, 6, 1, 1, pal.skin);
      } else {
        const l = f === 1 ? 1 : 0, r = f === 2 ? 1 : 0;
        R(g, 5, 17, 3, 5 - l, pal.leg); R(g, 5, 22 - l, 3, 2, pal.boot); R(g, 8, 17, 3, 5 - r, pal.leg); R(g, 8, 22 - r, 3, 2, pal.boot);
        R(g, 4, 9, 8, 8, pal.coat); R(g, 2, 10, 2, 6, pal.coat2); R(g, 12, 10, 2, 6, pal.coat2); R(g, 2, 16, 2, 1, pal.skin); R(g, 12, 16, 2, 1, pal.skin);
        R(g, 4, 2, 8, 7, pal.skin);
        if (dir === 'down') { R(g, 7, 9, 2, 3, pal.shirt); R(g, 6, 6, 1, 1, '#1a1410'); R(g, 9, 6, 1, 1, '#1a1410'); }
      }
      head(g, dir);
    });
  }
  function people(pal, head) {
    const o = {};
    for (const d of ['down', 'up', 'left']) o[d] = [0, 1, 2].map(f => outline(person(pal, head, d, f), '#08080a'));
    o.right = o.left.map(flipH);
    return o;
  }
  // あなた: つばのある帽子、デニムの上着
  const youHead = (g, d) => {
    const hat = '#b8905c', hat2 = '#8a6a40';
    if (d === 'left') { R(g, 4, 0, 7, 3, hat); R(g, 1, 3, 12, 2, hat2); R(g, 8, 5, 3, 3, '#3a2a1a'); }
    else { R(g, 4, 0, 8, 3, hat); R(g, 2, 3, 12, 2, hat2); if (d === 'up') R(g, 4, 5, 8, 4, '#3a2a1a'); }
  };
  // シガー: 耳までかぶさる黒い髪、暗い上着。顔は白い
  const antonHead = (g, d) => {
    const hair = '#17110d';
    if (d === 'left') { R(g, 3, 1, 9, 4, hair); R(g, 8, 5, 4, 4, hair); }
    else if (d === 'up') R(g, 3, 1, 10, 8, hair);
    else { R(g, 3, 1, 10, 4, hair); R(g, 3, 5, 2, 4, hair); R(g, 11, 5, 2, 4, hair); R(g, 5, 4, 6, 1, hair); }
  };

  // 置き物。w, h は足もとの広さ（タイル）。solid 通れない, opq 見通せない, light 明かり
  const P = {};
  const def = (k, w, h, o, fn, sw, sh) => { P[k] = Object.assign({ w, h, solid: true, opq: false, spr: C(sw, sh, fn) }, o || {}); };
  const carSpr = (body, glass, taxi) => g => {
    R(g, 3, 10, 40, 14, body); R(g, 8, 4, 26, 8, body); R(g, 10, 6, 10, 5, glass); R(g, 22, 6, 10, 5, glass); R(g, 3, 10, 40, 1, '#ffffff22'); R(g, 3, 21, 40, 3, '#00000055');
    R(g, 7, 22, 8, 6, '#0b0b0c'); R(g, 31, 22, 8, 6, '#0b0b0c'); R(g, 9, 24, 4, 2, '#3a3a3c'); R(g, 33, 24, 4, 2, '#3a3a3c');
    R(g, 43, 13, 2, 3, '#ffe9a8'); R(g, 1, 13, 2, 3, '#a02020'); R(g, 1, 18, 3, 3, '#77777c'); R(g, 42, 18, 3, 3, '#77777c');
    if (taxi) { R(g, 17, 1, 10, 3, '#fff2b0'); R(g, 3, 16, 40, 2, '#1a1a1a'); }
  };
  function build() {
    A.you = people({ skin: '#dcb08c', coat: '#52688a', coat2: '#3e5170', shirt: '#c8c0b0', leg: '#3a4660', boot: '#2a1c14' }, youHead);
    A.anton = people({ skin: '#e2c8b4', coat: '#1c2634', coat2: '#131b26', shirt: '#2c3848', leg: '#14171d', boot: '#08080a' }, antonHead);
    def('bed', 2, 1, {}, g => { R(g, 0, 4, 32, 16, '#2c1e14'); R(g, 1, 6, 30, 12, '#7a3a2c'); R(g, 1, 6, 30, 1, '#96503c'); R(g, 2, 7, 8, 9, '#c8c0b0'); R(g, 0, 0, 3, 20, '#3c2a1c'); R(g, 1, 18, 30, 2, '#1c120c'); }, 32, 20);
    def('tv', 1, 1, {}, g => { R(g, 1, 8, 14, 12, '#3c2a1c'); R(g, 1, 8, 14, 1, '#5a4028'); R(g, 3, 1, 10, 8, '#18181c'); R(g, 4, 2, 8, 6, '#4a5a66'); R(g, 5, 12, 6, 1, '#1c120c'); R(g, 5, 16, 6, 1, '#1c120c'); }, 16, 20);
    def('desk', 2, 1, {}, g => { R(g, 0, 4, 32, 14, '#4a3422'); R(g, 0, 4, 32, 2, '#6a4c30'); R(g, 0, 16, 32, 2, '#241810'); R(g, 20, 0, 6, 5, '#c8b070'); R(g, 22, 1, 2, 2, '#fff2b0'); }, 32, 18);
    def('phone', 1, 1, {}, g => { R(g, 0, 6, 16, 14, '#4a3422'); R(g, 0, 6, 16, 2, '#6a4c30'); R(g, 0, 18, 16, 2, '#241810'); R(g, 3, 1, 10, 6, '#0c0c0e'); R(g, 4, 0, 8, 2, '#1c1c20'); R(g, 6, 3, 4, 3, '#55555c'); }, 16, 20);
    def('keys', 1, 1, {}, g => { R(g, 1, 0, 14, 14, '#3c2a1c'); R(g, 2, 1, 12, 12, '#5a4028'); for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { R(g, 3 + i * 3, 2 + j * 4, 1, 1, '#888'); R(g, 3 + i * 3, 3 + j * 4, 1, 2, (i + j) % 3 ? '#c8a838' : '#5a4028'); } R(g, 7, 14, 2, 8, '#241810'); }, 16, 22);
    def('pump', 1, 1, { opq: true }, g => { R(g, 2, 2, 12, 26, '#1a1a1c'); R(g, 3, 3, 10, 24, '#9a2a22'); R(g, 3, 3, 10, 7, '#d8d0c0'); R(g, 5, 5, 6, 3, '#1a1a1c'); R(g, 4, 13, 8, 5, '#d8d0c0'); R(g, 13, 10, 2, 12, '#0c0c0e'); R(g, 1, 26, 14, 2, '#3a3a3c'); }, 16, 28);
    def('truck', 3, 2, { opq: true }, g => { R(g, 2, 13, 44, 14, '#7a4a2c'); R(g, 5, 4, 17, 10, '#7a4a2c'); R(g, 7, 6, 13, 6, '#1e2a34'); R(g, 23, 10, 22, 4, '#3c2416'); R(g, 2, 13, 44, 1, '#ffffff22'); R(g, 2, 24, 44, 3, '#00000055'); R(g, 6, 25, 9, 7, '#0b0b0c'); R(g, 33, 25, 9, 7, '#0b0b0c'); R(g, 8, 27, 5, 3, '#3a3a3c'); R(g, 35, 27, 5, 3, '#3a3a3c'); R(g, 1, 16, 2, 3, '#ffe9a8'); R(g, 45, 16, 2, 3, '#a02020'); R(g, 0, 21, 3, 3, '#77777c'); }, 48, 32);
    def('car', 3, 2, { opq: true }, carSpr('#3a4a44', '#16222a'), 46, 28);
    def('car2', 3, 2, { opq: true }, carSpr('#6a5a3a', '#1c2428'), 46, 28);
    def('sedan', 3, 2, { opq: true }, carSpr('#14161c', '#0a1016'), 46, 28);   // 彼の車
    def('taxi', 3, 2, { opq: true }, carSpr('#c8a020', '#1c2428', true), 46, 28);
    def('lamp', 1, 1, {}, g => { R(g, 7, 8, 2, 34, '#4a4a50'); R(g, 7, 6, 8, 2, '#4a4a50'); R(g, 11, 4, 5, 3, '#ffe9a8'); R(g, 5, 40, 6, 4, '#2a2a2e'); }, 16, 44);
    def('neon', 3, 1, { opq: true }, g => {
      R(g, 6, 18, 2, 12, '#3a3a3e'); R(g, 40, 18, 2, 12, '#3a3a3e'); R(g, 2, 1, 44, 18, '#c03a30'); R(g, 3, 2, 42, 16, '#1a0b0b');
      const F = { M: ['101', '111', '111', '101', '101'], O: ['111', '101', '101', '101', '111'], T: ['111', '010', '010', '010', '010'], E: ['111', '100', '110', '100', '111'], L: ['100', '100', '100', '100', '111'] };
      Array.from('MOTEL').forEach((ch, k) => F[ch].forEach((row, j) => Array.from(row).forEach((b, i) => { if (b === '1') R(g, 6 + k * 8 + i * 2, 5 + j * 2, 2, 2, '#ff5a4a'); })));
    }, 48, 30);
    def('crate', 1, 1, { opq: true }, g => { R(g, 1, 2, 14, 16, '#2a2218'); R(g, 2, 3, 12, 14, '#5a4a30'); R(g, 2, 9, 12, 1, '#3a2e1c'); R(g, 7, 3, 2, 14, '#3a2e1c'); }, 16, 18);
    def('brush', 1, 1, { solid: false, opq: true }, g => { EL(g, 8, 8, 8, 6, '#3e5030'); EL(g, 5, 7, 4, 4, '#506a3c'); EL(g, 11, 9, 4, 3, '#324226'); R(g, 3, 4, 1, 3, '#6a8a4c'); R(g, 12, 3, 1, 4, '#6a8a4c'); }, 16, 15);
    def('lever', 1, 1, {}, g => { R(g, 3, 8, 10, 12, '#3a3a40'); R(g, 4, 9, 8, 10, '#55555c'); R(g, 7, 0, 2, 10, '#1c1c20'); R(g, 5, 0, 6, 3, '#c03a30'); }, 16, 20);
    def('sofa', 2, 1, {}, g => { R(g, 0, 3, 32, 15, '#2a3a36'); R(g, 2, 8, 28, 8, '#3c524c'); R(g, 0, 3, 32, 5, '#34463f'); R(g, 0, 16, 32, 2, '#18201e'); }, 32, 18);
    def('plant', 1, 1, {}, g => { R(g, 5, 13, 6, 6, '#6a3a26'); EL(g, 8, 7, 6, 7, '#2c4a2c'); EL(g, 5, 6, 3, 4, '#3a5c38'); }, 16, 19);
    // 小物
    A.bag = outline(C(12, 9, g => { R(g, 0, 2, 12, 7, '#6a4a2a'); R(g, 0, 2, 12, 1, '#8a6238'); R(g, 4, 0, 4, 2, '#3a2a18'); R(g, 5, 4, 2, 2, '#c8a838'); }), '#08080a');
    A.can = outline(C(9, 10, g => { R(g, 0, 2, 9, 8, '#b02a22'); R(g, 0, 2, 9, 1, '#d84a3c'); R(g, 5, 0, 3, 2, '#b02a22'); R(g, 1, 0, 3, 1, '#77777c'); }), '#08080a');
    A.key = C(9, 9, g => { R(g, 0, 2, 4, 4, '#c8a838'); R(g, 1, 3, 2, 2, '#000'); R(g, 4, 3, 5, 2, '#c8a838'); R(g, 6, 5, 1, 2, '#c8a838'); R(g, 8, 5, 1, 2, '#c8a838'); });
    A.quarter = C(9, 9, g => { EL(g, 4, 4, 4, 4, '#b8b8c0'); EL(g, 4, 4, 2, 2, '#8a8a92'); R(g, 3, 1, 3, 1, '#e8e8f0'); });
    A.props = P;
  }
  const A = { STYLES, tile, build, you: null, anton: null, props: P };
  return A;
})();
