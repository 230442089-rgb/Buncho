// ───────── 空間の種類 ─────────
// 世界は 18x14 タイルの「区画」が上下左右に果てなく並んだもの。区画ごとに、ここにある種類のどれかになる。
//   部屋型（room）: 区画の中がぜんぶ床。隣と壁なしでつながることもある（広間）。
//   廊下型（corr）: 3〜7 行目だけが通路。南へ枝道が出る。それ以外は入れない塊。
// 北の壁は 3 行（上面 1 + 面 2）、西の壁は 1 列。南と東の壁は、隣の区画の北・西の壁。
const CW = 18, CH = 14;
const T_FLOOR = 0, T_CAP = 1, T_FACE = 2, T_BLOCK = 3, T_LOW = 4, T_WATER = 5, T_DEEP = 6, T_VOID = 7;
const T_SOLID = [0, 1, 1, 1, 1, 0, 1, 1], T_OPAQUE = [0, 1, 1, 1, 0, 0, 0, 0];
const BAND0 = 3, BAND1 = 7, GAPY = 5;

// 床の描き方いろいろ
const spk = (g, px, py, wx, wy, n, c, s) => { for (let i = 0; i < n; i++) R(g, px + Math.floor(hash2(wx, wy, i + s) * 16), py + Math.floor(hash2(wy, wx, i + s + 31) * 16), 1, 1, c); };
const grid = (g, px, py, n, c1, c2) => { R(g, px, py, 16, 16, c1); for (let i = 0; i < 16; i += n) { R(g, px + i, py, 1, 16, c2); R(g, px, py + i, 16, 1, c2); } };
const at = (c, lx, ly) => (lx < 0 || ly < 0 || lx >= CW || ly >= CH) ? -1 : c.t[ly * CW + lx];

const BIOMES = {
  // アトリエ（区画 0,0 だけ）。ここは安全で、保存ができる。
  atelier: {
    name: 'アトリエ', amb: '#b4aec4', step: 'wood', corr: 0, open: 0, closed: 1, safe: true,
    wall: { cap: '#26222e', capHi: '#4a4458', f1: '#dcd8e4', f2: '#b8b2c8', line: '#8a84a0', base: '#56506a' },
    floor(g, c, lx, ly, px, py, wx, wy) { R(g, px, py, 16, 16, '#a8a4ac'); R(g, px, py + 15, 16, 1, '#7c7884'); R(g, px + ((wy & 1) ? 4 : 12), py, 1, 15, '#7c7884'); spk(g, px, py, wx, wy, 3, '#9c98a2', 1); },
    gen(c, R) {
      R.wall('awin', 6); R.wall('ashelf', 1);
      R.deco('rug', 6, 4); R.put('easel', 8, 4); R.put('adesk', 13, 7); R.put('stool', 14, 8); R.put('hand', 2, 4); R.put('canv', 16, 3); R.put('canv', 15, 3);
      R.put('paper', 3, 9); R.put('paper', 4, 10); R.put('paper', 14, 11);
      R.light(8, 4, 76, { c: '#fff8f0', c2: '#6a6478' });
    },
    mats: [],
  },
  hall: {
    name: '廊下', amb: '#928a78', step: 'carpet', corr: 0.85, open: 0.4, closed: 0.35,
    wall: { cap: '#1c1a20', capHi: '#34303a', f1: '#b8b094', f2: '#9a927a', line: '#6a6250', base: '#3a3428' },
    floor(g, c, lx, ly, px, py) { R(g, px, py, 16, 16, '#5a2e34'); for (let j = 0; j < 16; j += 8) for (let i = 0; i < 16; i += 8) { R(g, px + i + 3, py + j + 1, 2, 6, '#6e3a40'); R(g, px + i + 1, py + j + 3, 6, 2, '#6e3a40'); } R(g, px, py, 16, 1, '#4a2428'); },
    gen(c, R) {
      if (c.plan === 'corr') {
        for (let x = c.x0 + 1; x < CW - 2; x += R.i(3, 5)) {
          const k = R.r();
          if (k < 0.58) { if (R.wall('wdoorA', x)) R.wall('wnum', x + 1, { text: String(R.i(1, 9)) + String(R.i(0, 9)) }); }
          else if (k < 0.68) R.wall('whyd', x); else if (k < 0.76) R.wall('welev', x); else if (k < 0.86) R.wall('wexit', x); else if (k < 0.94) R.wall('wlamp', x);
        }
        if (R.ch(0.5)) R.put('plant', R.i(c.x0 + 1, CW - 2), 3); if (R.ch(0.35)) R.put('bench', R.i(c.x0 + 1, CW - 4), 7);
        if (R.ch(0.2)) R.put('trash', R.i(c.x0 + 1, CW - 2), 7); if (R.ch(0.08)) R.put('cone', R.i(c.x0 + 1, CW - 2), 4);
        R.lamp(4, 5, 52, WARM); R.lamp(13, 5, 52, WARM);
      } else {
        R.put('sofa', 3, 9); if (R.ch(0.6)) R.put('sofa', 3, 11); R.put('counter', 12, 3); R.put('plant', 2, 3); R.put('plant', 16, 8); if (R.ch(0.5)) R.put('vend', 15, 10);
        R.wall('welev', 3); R.wall('welev', 6); R.wall('wclock', 10); R.wall('wexit', 15);
        R.lamp(5, 8, 60, WARM); R.lamp(13, 8, 60, WARM);
      }
    },
    mats: [{ n: '非常口の緑', k: PK.light, c: '#66ff99', on: ['wexit'] }, { n: 'だれかの部屋の扉', k: PK.door, c: '#664422', on: ['wdoorA'] }, { n: '消火栓の赤', k: PK.box, c: '#cc3333', on: ['whyd'] }, { n: '来ないエレベーター', k: PK.door, c: '#bbbbbb', on: ['welev'] }, { n: 'ロビーの長椅子', k: PK.seat, c: '#663333', on: ['sofa', 'bench'] }],
  },
  office: {
    name: '事務所', amb: '#7e8694', step: 'carpet', corr: 0, open: 0.55, closed: 0.4,
    wall: { cap: '#1a1c22', capHi: '#30343e', f1: '#c4c6cc', f2: '#a4a6ae', line: '#70727c', base: '#484a54' },
    floor(g, c, lx, ly, px, py, wx, wy) { R(g, px, py, 16, 16, ((wx + wy) & 1) ? '#4c5262' : '#464c5c'); R(g, px, py, 16, 1, '#3c4250'); R(g, px, py, 1, 16, '#3c4250'); spk(g, px, py, wx, wy, 4, '#565c6c', 2); },
    gen(c, R) {
      for (const [ix, iy] of [[2, 3], [11, 3], [2, 9], [11, 9]]) {
        if (R.ch(0.2)) continue;
        for (const dx of [0, 2, 4]) { if (R.ch(0.15)) continue; if (R.put('desk', ix + dx, iy, { on: R.ch(0.14) })) R.put('chair', ix + dx + (R.ch(0.5) ? 0 : 1), iy + 1); }
      }
      if (R.ch(0.5)) R.put('plant', c.x0 + 1, 12); if (R.ch(0.4)) R.put('copier', 16, 12); if (R.ch(0.35)) R.put('cooler', 16, 3); if (R.ch(0.3)) R.put('trash', 9, 12);
      for (let x = c.x0 + 1; x < CW - 3; x += R.i(3, 5)) { const k = R.r(); if (k < 0.45) R.wall('wwin', x); else if (k < 0.6) R.wall('wboard', x); else if (k < 0.7) R.wall('wdoorO', x); else if (k < 0.78) R.wall('wclock', x); else if (k < 0.85) R.wall('wvent', x); }
      for (const [x, y] of [[4, 5], [13, 5], [4, 10], [13, 10]]) R.lamp(x, y, 46, COLD);
    },
    mats: [{ n: 'だれかの椅子', k: PK.seat, c: '#333366', on: ['chair'] }, { n: 'ついたままのモニタ', k: PK.screen, c: '#99ccff', on: ['desk'] }, { n: '観葉植物', k: PK.plant, c: '#336633', on: ['plant'] }, { n: '針のない時計', k: PK.clock, c: '#ffffee', on: ['wclock'] }, { n: '夜の窓', k: PK.sky, c: '#223366', on: ['wwin'] }],
  },
  under: {
    name: '地下通路', amb: '#5c6a5e', step: 'tile', corr: 0.6, open: 0.6, closed: 0.3,
    wall: { cap: '#22241f', capHi: '#3c4038', f1: '#d0d0b8', f2: '#b8b8a0', line: '#8c8c78', base: '#5a5a4c', tile: 4 },
    floor(g, c, lx, ly, px, py) {
      grid(g, px, py, 8, '#8c8872', '#747060');
      const s = c.eS, onS = s.type !== 'wall' && lx === s.pos && ly > GAPY, onN = c.eN.type === 'gap' && lx === c.eN.pos && ly < GAPY;
      if (ly === GAPY || onS || onN) { R(g, px + 2, py + 2, 12, 12, '#c8a020'); for (let j = 4; j < 14; j += 4) for (let i = 4; i < 14; i += 4) R(g, px + i, py + j, 2, 2, '#e8c040'); }
    },
    gen(c, R) {
      for (let x = c.x0 + 1; x < CW - 3; x += R.i(3, 4)) { const k = R.r(); if (k < 0.4) R.wall('wad', x); else if (k < 0.58) R.wall('wshut', x); else if (k < 0.68) R.wall('wlock', x); else if (k < 0.76) R.wall('wexit', x); else if (k < 0.82) R.wall('whyd', x); else if (k < 0.88) R.wall('wname', x); }
      if (c.plan === 'corr') { if (R.ch(0.4)) R.put('bench', R.i(c.x0 + 1, CW - 4), 7); if (R.ch(0.3)) R.put('vend', R.i(c.x0 + 1, CW - 2), 3); if (R.ch(0.3)) R.put('trash', R.i(c.x0 + 1, CW - 2), 7); }
      else { for (const [x, y] of [[4, 8], [13, 8], [4, 11], [13, 11]]) R.put('pillar', x, y); if (R.ch(0.5)) R.put('bench', 6, 12); if (R.ch(0.4)) R.put('vend', 2, 3); if (R.ch(0.3)) R.put('phone', 15, 3); }
      R.lamp(3, 5, 48, GREEN); R.lamp(9, 5, 48, GREEN); R.lamp(15, 5, 48, GREEN); if (c.plan === 'room') { R.lamp(5, 10, 48, GREEN); R.lamp(13, 10, 48, GREEN); }
    },
    mats: [{ n: '点字ブロックの黄', k: PK.line, c: '#e8c040', on: ['pillar', 'bench', 'trash'] }, { n: '白紙の広告', k: PK.screen, c: '#ffffff', on: ['wad'] }, { n: '閉じたシャッター', k: PK.door, c: '#888888', on: ['wshut'] }, { n: '白紙の駅名', k: PK.sign, c: '#ffffff', on: ['wname'] }, { n: '鍵のないロッカー', k: PK.box, c: '#999999', on: ['wlock'] }],
  },
  street: {
    name: '夜道', amb: '#343c6c', step: 'asphalt', corr: 1, open: 0, closed: 0.3, outdoor: true,
    wall: { cap: '#14161c', capHi: '#262a34', f1: '#8a8c90', f2: '#7c7e84', line: '#5a5c62', base: '#4a4c52', block: 1 },
    floor(g, c, lx, ly, px, py, wx, wy) {
      if (ly === BAND0 || ly === BAND1) { R(g, px, py, 16, 16, '#74767a'); R(g, px, py, 1, 16, '#5a5c60'); R(g, px, py + (ly === BAND0 ? 13 : 0), 16, 3, '#9a9ca0'); spk(g, px, py, wx, wy, 3, '#66686c', 4); }
      else { R(g, px, py, 16, 16, '#2c2e34'); spk(g, px, py, wx, wy, 6, '#3c3e46', 3); spk(g, px, py, wx, wy, 3, '#1c1e22', 9); if (ly === GAPY && ((wx % 4) + 4) % 4 < 2) R(g, px, py + 7, 16, 2, '#b0b0a8'); }
    },
    block(g, c, lx, ly, px, py, wx, wy) { R(g, px, py, 16, 16, '#16181e'); for (let j = 0; j < 16; j += 4) R(g, px, py + j, 16, 1, '#20232c'); if (hash2(wx >> 2, wy >> 2, 5) > 0.5) R(g, px + 7, py, 1, 16, '#0e0f14'); },
    gen(c, R) {
      for (let x = c.x0 + 1; x < CW - 3; x += R.i(4, 6)) { const k = R.r(); if (k < 0.3) R.wall('wgate', x); else if (k < 0.45) R.wall('wpost', x); else if (k < 0.55) R.wall('wnum', x, { text: String(R.i(1, 9)) }); }
      R.put(R.ch(0.12) ? 'slampD' : 'slamp', R.i(3, 6), 3); if (R.ch(0.45)) R.put('slamp', R.i(11, 15), 3);
      if (R.ch(0.3)) R.put('vend', R.i(c.x0 + 1, CW - 2), 3); if (R.ch(0.6)) R.put('pole', R.i(c.x0 + 1, CW - 2), 7);
      if (c.eS.type !== 'wall') { R.put('stop', clamp(c.eS.pos - 1, c.x0, CW - 1), 7); if (R.ch(0.5)) R.put('mirror', clamp(c.eS.pos + c.eS.w, 0, CW - 1), 7); }
      else if (R.ch(0.3)) { const x = R.i(c.x0 + 1, CW - 5); if (R.put('busstop', x + 2, 7)) R.put('bench', x, 7); }
      if (R.ch(0.2)) R.put('mailbox', R.i(c.x0 + 1, CW - 2), 3); if (R.ch(0.15)) R.put('kid', R.i(c.x0 + 1, CW - 2), 7); if (R.ch(0.12)) R.put('phone', R.i(c.x0 + 1, CW - 2), 3);
    },
    mats: [{ n: '帰り道の灯', k: PK.light, c: '#ffee99', on: ['slamp', 'slampD'] }, { n: '止まれ', k: PK.sign, c: '#cc3333', on: ['stop'] }, { n: '自販機の光', k: PK.box, c: '#cceeff', on: ['vend'] }, { n: 'だれも映らない鏡', k: PK.sign, c: '#6699cc', on: ['mirror'] }, { n: '電柱', k: PK.pole, c: '#555555', on: ['pole'] }, { n: '来ないバス', k: PK.sign, c: '#ffffff', on: ['busstop'] }],
  },
  tatami: {
    name: '畳の間', amb: '#8a7658', step: 'tatami', corr: 0, open: 0.25, closed: 0.25, ver: 1, gapW: 4,
    wall: { cap: '#1e1810', capHi: '#3a3020', f1: '#d8d0a8', f2: '#c8c098', line: '#3a2c18', base: '#3a2c18', fus: 1 },
    floor(g, c, lx, ly, px, py, wx, wy) { R(g, px, py, 16, 16, '#9a9468'); for (let j = 1; j < 16; j += 2) R(g, px, py + j, 16, 1, '#8c865c'); if ((((wx + (wy & 1)) % 2) + 2) % 2 === 0) R(g, px, py, 2, 16, '#2e3a22'); R(g, px, py + 14, 16, 2, '#2e3a22'); },
    gen(c, R) {
      if (R.ch(0.7)) { if (R.put('chabu', R.ch(0.5) ? 3 : 12, 9)) { R.deco('zabu', R.ch(0.5) ? 2 : 11, 9); R.deco('zabu', R.ch(0.5) ? 5 : 14, 10); } }
      if (R.ch(0.5)) R.put('tv', R.ch(0.5) ? 2 : 15, 3); if (R.ch(0.5)) R.put('tansu', R.ch(0.5) ? 4 : 13, 3); if (R.ch(0.4)) R.put('fan', R.i(11, 15), 11); if (R.ch(0.5)) R.put('andon', R.ch(0.5) ? 2 : 15, 12);
      if (R.ch(0.6)) R.deco('sun', R.i(c.x0 + 1, 5), R.i(8, 11)); if (R.ch(0.3)) R.deco('sun', R.i(10, 13), R.i(3, 4));
      if (R.ch(0.3)) R.wall('wclock', R.i(c.x0 + 1, CW - 2));
    },
    mats: [{ n: 'ぬるい午後', k: PK.window, c: '#ffcc66', on: ['sun'] }, { n: '砂あらしのテレビ', k: PK.screen, c: '#cccccc', on: ['tv'] }, { n: 'ちゃぶ台', k: PK.seat, c: '#996633', on: ['chabu'] }, { n: '行灯', k: PK.light, c: '#ffddaa', on: ['andon'] }, { n: 'だれかの箪笥', k: PK.box, c: '#774422', on: ['tansu'] }],
  },
  school: {
    name: '学校', amb: '#b08c64', step: 'wood', corr: 0.5, open: 0, closed: 0.35, ver: 2,
    wall: { cap: '#201a14', capHi: '#3a3026', f1: '#d8d4b0', f2: '#88a088', line: '#5e7460', base: '#4a3a28' },
    floor(g, c, lx, ly, px, py, wx, wy) { R(g, px, py, 16, 16, '#8a5e38'); for (let i = 0; i < 16; i += 4) R(g, px + i, py, 1, 16, '#74502e'); R(g, px, py + (((wx % 2) + 2) % 2 ? 5 : 12), 16, 1, '#74502e'); spk(g, px, py, wx, wy, 2, '#9a6e46', 5); },
    gen(c, R) {
      if (c.plan === 'corr') {
        for (let x = c.x0 + 1; x < CW - 3; x += R.i(4, 6)) { const k = R.r(); if (k < 0.55) { if (R.wall('wdoorC', x)) R.wall('wnum', x + 2, { text: R.i(1, 6) + '-' + R.i(1, 4) }); } else if (k < 0.7) R.wall('wboard', x); else if (k < 0.8) R.wall('whyd', x); }
        if (R.ch(0.5)) R.put('shoebox', R.i(c.x0 + 1, CW - 4), 7); if (R.ch(0.2)) R.put('trash', R.i(c.x0 + 1, CW - 2), 7);
        R.deco('sun', R.i(c.x0 + 1, 5), 4); R.deco('sun', R.i(9, 13), 4);
      } else {
        for (const x of [3, 5, 7, 11, 13, 15]) for (const y of [8, 10, 12]) if (R.ch(0.88)) R.put('sdesk', x, y);
        R.put('tdesk', 4, 3); R.wall('wbb', 7); R.wall('wclock', 12); R.wall('wlock', 14);
        R.deco('sun', 1, 9); if (R.ch(0.5)) R.deco('sun', 12, 3);
      }
    },
    mats: [{ n: 'だれかの机', k: PK.seat, c: '#cc9966', on: ['sdesk'] }, { n: '黒板の跡', k: PK.screen, c: '#335544', on: ['wbb'] }, { n: '下駄箱', k: PK.box, c: '#885522', on: ['shoebox'] }, { n: '西日の廊下', k: PK.sky, c: '#ff8844', on: ['sun'] }, { n: '放課後の扉', k: PK.door, c: '#ccbb88', on: ['wdoorC'] }],
  },
  pool: {
    name: 'プール', amb: '#90b0b8', step: 'tile', corr: 0, open: 0.45, closed: 0.35, ver: 3,
    wall: { cap: '#1c2a2e', capHi: '#34484e', f1: '#d4e4e4', f2: '#c4d8d8', line: '#3a7088', base: '#587478', tile: 4, lineY: 5, lineH: 3 },
    floor(g, c, lx, ly, px, py, wx, wy, code) {
      if (code === T_WATER) { R(g, px, py, 16, 16, '#4c9aa0'); for (let i = 0; i < 16; i += 4) { R(g, px + i, py, 1, 16, '#428c92'); R(g, px, py + i, 16, 1, '#428c92'); } }
      else if (code === T_DEEP) { R(g, px, py, 16, 16, '#0c3048'); DI(g, px, py, 16, 16, '#124460', 5); }
      else {
        grid(g, px, py, 4, '#b4c8c8', '#98b0b0');
        const wv = (dx, dy) => { const t = at(c, lx + dx, ly + dy); return t === T_WATER || t === T_DEEP; };
        if (wv(0, 1)) { R(g, px, py + 12, 16, 4, '#e4f0f0'); R(g, px, py + 15, 16, 1, '#587478'); } if (wv(0, -1)) { R(g, px, py, 16, 4, '#e4f0f0'); R(g, px, py, 16, 1, '#587478'); }
        if (wv(1, 0)) { R(g, px + 12, py, 4, 16, '#e4f0f0'); R(g, px + 15, py, 1, 16, '#587478'); } if (wv(-1, 0)) { R(g, px, py, 4, 16, '#e4f0f0'); R(g, px, py, 1, 16, '#587478'); }
      }
    },
    gen(c, R) {
      const pools = R.ch(0.5) ? [[2, 8, 5, 5], [11, 8, 5, 5]] : [[2, 8, 5, 5]];
      for (const [x, y, w, h] of pools) { R.fill(x, y, w, h, T_WATER); R.fill(x + 1, y + 1, w - 2, h - 2, T_DEEP); if (R.ch(0.6)) R.fill(x + 1, y + 1, w - 2, 1, T_WATER); R.deco('ladder', x - 1 < c.x0 ? x + w : x - 1, y + 1); }
      if (pools.length < 2) { R.fill(11, 9, 5, 3, T_WATER); R.deco('drip', 13, 10); }
      if (R.ch(0.5)) R.put('ball', 3, 8); if (R.ch(0.5)) R.put('lchair', 16, 4); if (R.ch(0.5)) R.put('bench', R.i(2, 5), 3); R.put('tpillar', 7, 7); R.put('tpillar', 10, 7);
      for (let x = c.x0 + 2; x < CW - 2; x += R.i(4, 6)) { const k = R.r(); if (k < 0.3) R.wall('wclock', x); else if (k < 0.5) R.wall('wvent', x); else if (k < 0.65) R.wall('wdoorO', x); }
      R.lamp(5, 6, 62, COLD); R.lamp(13, 6, 62, COLD); R.lamp(9, 11, 56, COLD);
    },
    mats: [{ n: '落ちる音', k: PK.water, c: '#99ddee', on: ['drip'] }, { n: 'ぬけないビーチボール', k: PK.clock, c: '#ee6666', on: ['ball'] }, { n: 'だれも見ない監視台', k: PK.stairs, c: '#cccccc', on: ['lchair'] }, { n: '塩素の柱', k: PK.pole, c: '#99bbbb', on: ['tpillar'] }],
  },
  parking: {
    name: '駐車場', amb: '#56504a', step: 'concrete', corr: 0, open: 0.75, closed: 0.3, ver: 4,
    wall: { cap: '#161412', capHi: '#2a2622', f1: '#8a8680', f2: '#7a7670', line: '#c8a020', base: '#3c3834', lineY: 8, lineH: 2 },
    floor(g, c, lx, ly, px, py, wx, wy) {
      R(g, px, py, 16, 16, '#5c5a56'); spk(g, px, py, wx, wy, 5, '#6a6864', 6); spk(g, px, py, wx, wy, 2, '#4c4a46', 8);
      if (ly <= 4 || ly >= 9) { if (lx % 2 === 0) R(g, px, py, 1, 16, '#c8c8c0'); if (ly === 4) R(g, px, py + 15, 16, 1, '#c8c8c0'); if (ly === 9) R(g, px, py, 16, 1, '#c8c8c0'); }
      else if (ly === GAPY && lx % 6 === 3) { R(g, px + 2, py + 7, 10, 2, '#c8c8c0'); R(g, px + 9, py + 4, 2, 8, '#c8c8c0'); R(g, px + 11, py + 6, 2, 4, '#c8c8c0'); }
    },
    gen(c, R) {
      R.put('pillarS', 5, 7); R.put('pillarS', 12, 7);
      const cols = [['#33384a', '#222636'], ['#4a3434', '#342424'], ['#5a5c5e', '#3e4042'], ['#2a3a34', '#1c2824']];
      for (const x of [2, 4, 6, 10, 12, 14]) { if (R.ch(0.22)) { const k = R.pk(cols); R.put('car', x, 3, { c: k[0], c2: k[1] }); } if (R.ch(0.18)) { const k = R.pk(cols); R.put('car', x, 11, { c: k[0], c2: k[1] }); } }
      if (R.ch(0.25)) R.put('cone', R.i(2, 15), 8);
      for (let x = c.x0 + 2; x < CW - 2; x += R.i(5, 7)) { const k = R.r(); if (k < 0.3) R.wall('wnum', x, { text: 'B' + R.i(1, 4) }); else if (k < 0.45) R.wall('welev', x); else if (k < 0.6) R.wall('wexit', x); else if (k < 0.7) R.wall('whyd', x); }
      R.lamp(9, 6, 58, SODIUM); if (R.ch(0.4)) R.lamp(3, 10, 50, SODIUM);
    },
    mats: [{ n: 'だれかの車', k: PK.box, c: '#444466', on: ['car'] }, { n: 'しま模様の柱', k: PK.pole, c: '#ccaa22', on: ['pillarS'] }, { n: '地下二階', k: PK.sign, c: '#ffffcc', on: ['wnum'] }, { n: 'ナトリウム灯', k: PK.light, c: '#ffbb66', on: ['wexit', 'cone'] }],
  },
  station: {
    name: '駅', amb: '#7a8288', step: 'tile', corr: 0.75, open: 0.5, closed: 0.3, ver: 5,
    wall: { cap: '#181a1e', capHi: '#2e3238', f1: '#c8ccc8', f2: '#b0b4b0', line: '#607058', base: '#484c48', tile: 8 },
    floor(g, c, lx, ly, px, py, wx, wy) {
      grid(g, px, py, 8, '#84868a', '#6e7074');
      if (c.plan === 'corr' && ly === BAND1) { R(g, px, py + 2, 16, 7, '#c8a020'); for (let i = 2; i < 16; i += 4) R(g, px + i, py + 4, 2, 3, '#e8c040'); R(g, px, py + 13, 16, 3, '#e0e0d8'); }
    },
    low(g, c, lx, ly, px, py, wx) { R(g, px, py, 16, 16, '#14120e'); spk(g, px, py, wx, ly, 8, '#2a261e', 7); if (ly === BAND1 + 1) { R(g, px, py, 16, 3, '#3a3a36'); R(g, px, py + 9, 16, 2, '#70706c'); } else R(g, px, py + 5, 16, 2, '#70706c'); if (((wx % 2) + 2) % 2 === 0) R(g, px + 6, py, 4, 16, '#2e261c'); },
    gen(c, R) {
      if (c.plan === 'corr') {
        for (let y = BAND1 + 1; y <= BAND1 + 2; y++) for (let x = 0; x < CW; x++) if (at(c, x, y) === T_BLOCK) c.t[y * CW + x] = T_LOW;
        for (let x = c.x0 + 1; x < CW - 3; x += R.i(3, 5)) { const k = R.r(); if (k < 0.3) R.wall('wname', x); else if (k < 0.55) R.wall('wad', x); else if (k < 0.65) R.wall('wclock', x); else if (k < 0.75) R.wall('wexit', x); }
        if (R.ch(0.6)) R.put('bench', R.i(c.x0 + 1, CW - 4), 3); if (R.ch(0.35)) R.put('vend', R.i(c.x0 + 1, CW - 2), 3); if (R.ch(0.3)) R.put('trash', R.i(c.x0 + 1, CW - 2), 4);
        R.lamp(3, 5, 48, COLD); R.lamp(9, 5, 48, COLD); R.lamp(15, 5, 48, COLD);
      } else {
        for (const x of [3, 5, 7, 10, 12, 14]) R.put('gate', x, 8);
        R.put('lbench', 2, 11); R.put('lbench', 12, 11); R.wall('wname', 2); R.wall('wad', 7); R.wall('wclock', 11); R.wall('wshut', 13);
        R.lamp(5, 6, 54, COLD); R.lamp(13, 6, 54, COLD); R.lamp(9, 11, 50, COLD);
      }
    },
    mats: [{ n: '黄色い線', k: PK.line, c: '#e8c040', on: ['bench', 'vend', 'trash'] }, { n: '白紙の駅名', k: PK.sign, c: '#ffffff', on: ['wname'] }, { n: '来ない電車の灯', k: PK.light, c: '#ddeeff', on: ['wad'] }, { n: '閉じた改札', k: PK.box, c: '#999999', on: ['gate'] }],
  },
  danchi: {
    name: '団地', amb: '#8c7498', step: 'concrete', corr: 0, open: 0.5, closed: 0.3, ver: 6, outdoor: true,
    wall: { cap: '#1e1c24', capHi: '#34303e', f1: '#a8a49c', f2: '#98948c', line: '#6c6860', base: '#585450' },
    floor(g, c, lx, ly, px, py, wx, wy) {
      if (hash2(wx >> 2, wy >> 2, 14) > 0.72) { R(g, px, py, 16, 16, '#2e3e2a'); spk(g, px, py, wx, wy, 8, '#3c5034', 3); spk(g, px, py, wx, wy, 4, '#22301e', 11); }
      else { R(g, px, py, 16, 16, '#6c6a66'); spk(g, px, py, wx, wy, 4, '#7a7874', 2); if (hash2(wx, wy, 6) > 0.9) LN(g, px + 2, py + 3, px + 12, py + 13, '#56544e'); R(g, px, py, 16, 1, '#5c5a56'); }
    },
    gen(c, R) {
      for (let x = c.x0 + 1; x < CW - 2; x += R.i(2, 4)) { const k = R.r(); if (k < 0.4) { if (R.wall('wdoorS', x)) R.wall('wnum', x + 1, { text: String(R.i(1, 9)) + '0' + R.i(1, 8) }); } else if (k < 0.7) R.wall('wwin', x, { dusk: R.ch(0.25) }); else if (k < 0.8) R.wall('wmail', x); }
      if (R.ch(0.4)) R.put('swing', R.i(3, 6), 9); if (R.ch(0.3)) R.put('slide', R.i(10, 14), 10); if (R.ch(0.5)) R.put('bench', R.i(c.x0 + 1, 6), 12);
      for (let i = 0; i < R.i(0, 3); i++) R.put('bike', R.i(c.x0 + 1, CW - 2), 3);
      if (R.ch(0.6)) R.put('slamp', R.i(3, 14), 8); if (R.ch(0.3)) R.put('pole', R.i(c.x0 + 1, CW - 2), 12); if (R.ch(0.2)) R.put('mailbox', R.i(c.x0 + 1, CW - 2), 3); if (R.ch(0.2)) R.put('vend', R.i(c.x0 + 1, CW - 2), 3);
    },
    mats: [{ n: '四号棟の扉', k: PK.door, c: '#666699', on: ['wdoorS'] }, { n: '集合ポスト', k: PK.box, c: '#999999', on: ['wmail'] }, { n: 'だれも乗らないブランコ', k: PK.seat, c: '#993333', on: ['swing'] }, { n: 'すべり台', k: PK.stairs, c: '#6699cc', on: ['slide'] }, { n: '夕方の窓', k: PK.sky, c: '#cc6633', on: ['wwin'] }, { n: 'だれかの自転車', k: PK.seat, c: '#669999', on: ['bike'] }],
  },
  fields: {
    name: '田んぼ道', amb: '#8c6c94', step: 'asphalt', corr: 1, open: 0, closed: 0.25, ver: 7, outdoor: true, soft: true, blockLow: true,
    wall: { cap: '#2a2438', capHi: '#3a3048', f1: '#3a3048', f2: '#3a3048', base: '#2a2438' },
    floor(g, c, lx, ly, px, py, wx, wy) {
      if (c.plan === 'corr' && (ly === BAND0 || ly === BAND1)) { R(g, px, py, 16, 16, '#3a4630'); spk(g, px, py, wx, wy, 9, '#4c5a3c', 3); spk(g, px, py, wx, wy, 5, '#2a3424', 12); }
      else { R(g, px, py, 16, 16, '#4a4850'); spk(g, px, py, wx, wy, 6, '#58565e', 4); spk(g, px, py, wx, wy, 3, '#3a3840', 7); }
    },
    low(g, c, lx, ly, px, py, wx, wy) { const k = (((wy % 14) + 14) % 14) / 14; R(g, px, py, 16, 16, mixc('#5c4460', '#2a2848', k)); for (let j = 2; j < 16; j += 5) for (let i = 2; i < 16; i += 5) R(g, px + i + ((j / 5) & 1) * 2, py + j, 1, 2, '#2e4a34'); if (hash2(wx, wy, 3) > 0.85) R(g, px + 3, py + 7, 9, 1, '#c88a78'); },
    gen(c, R) {
      for (let x = c.x0 + 2; x < CW - 1; x += 5) R.put('pole', x, 3);
      if (R.ch(0.3)) R.put('slamp', R.i(3, 14), 3); if (R.ch(0.12)) R.put('vend', R.i(c.x0 + 1, CW - 2), 7);
      if (R.ch(0.2)) { const x = R.i(c.x0 + 1, CW - 5); if (R.put('shelter', x, 7)) R.put('busstop', x + 2, 7); }
      for (let x = c.x0 + 1; x < CW - 1; x += 2) if (R.ch(0.25)) R.put('guard', x, 7);
      if (R.ch(0.4)) R.any('scare', R.i(2, 15), R.i(9, 12));
    },
    mats: [{ n: '一本だけの街灯', k: PK.light, c: '#ffeeaa', on: ['slamp'] }, { n: '電柱の列', k: PK.pole, c: '#333333', on: ['pole'] }, { n: '田んぼの中の自販機', k: PK.box, c: '#cceeff', on: ['vend'] }, { n: '夕焼けの残り', k: PK.sky, c: '#cc5566', on: ['guard', 'shelter'] }, { n: 'かかし', k: PK.sign, c: '#ccbb88', on: ['scare'] }],
  },
  mall: {
    name: '売場', amb: '#5c6c68', step: 'tile', corr: 0, open: 0.65, closed: 0.3, ver: 8,
    wall: { cap: '#161a18', capHi: '#2a302e', f1: '#787a78', f2: '#686a68', line: '#484a48', base: '#3a3c3a', shut: 1 },
    floor(g, c, lx, ly, px, py, wx, wy) { R(g, px, py, 16, 16, '#9a9684'); R(g, px, py, 16, 1, '#86826e'); R(g, px, py, 1, 16, '#86826e'); if (hash2(wx, 0, 9) > 0.5) DI(g, px + 5, py, 5, 16, '#b4b0a0', 5); },
    gen(c, R) {
      if (R.ch(0.3)) R.put('esc', R.ch(0.5) ? 3 : 13, 9);
      for (const [x, y] of [[3, 3], [6, 3], [11, 3], [14, 3], [3, 12], [11, 12]]) if (R.ch(0.35)) R.put('shelf', x, y);
      if (R.ch(0.5)) R.put('bench', R.i(c.x0 + 1, 5), 8); if (R.ch(0.5)) R.put('plant', R.i(10, 15), 8); if (R.ch(0.3)) R.put('cart', R.i(c.x0 + 1, CW - 2), R.i(8, 11));
      for (let x = c.x0 + 2; x < CW - 2; x += R.i(5, 8)) { if (R.ch(0.5)) R.wall('wexit', x); else if (R.ch(0.3)) R.wall('wad', x); }
      if (R.ch(0.5)) R.lamp(9, 9, 50, GREEN);
    },
    mats: [{ n: '止まったエスカレーター', k: PK.stairs, c: '#777777', on: ['esc'] }, { n: 'からっぽの棚', k: PK.box, c: '#999999', on: ['shelf'] }, { n: '閉店のあとの緑', k: PK.light, c: '#88ffaa', on: ['wexit'] }, { n: 'だれかのカート', k: PK.seat, c: '#888888', on: ['cart'] }],
  },
  clinic: {
    name: '待合室', amb: '#90a098', step: 'lino', corr: 0.5, open: 0.2, closed: 0.35, ver: 9,
    wall: { cap: '#1a1e1c', capHi: '#303634', f1: '#d8dcd0', f2: '#c0c8b8', line: '#90a090', base: '#586458' },
    floor(g, c, lx, ly, px, py, wx, wy) { R(g, px, py, 16, 16, '#7c9080'); spk(g, px, py, wx, wy, 5, '#869a8a', 2); if (hash2(wx, 1, 4) > 0.6) DI(g, px + 6, py, 4, 16, '#94a898', 4); },
    gen(c, R) {
      if (c.plan === 'corr') {
        for (let x = c.x0 + 1; x < CW - 2; x += R.i(3, 5)) { const k = R.r(); if (k < 0.55) { if (R.wall('wdoorO', x)) R.wall('wnum', x + 1, { text: String(R.i(1, 9)) }); } else if (k < 0.7) R.wall('wpost', x); else if (k < 0.8) R.wall('wclock', x); }
        if (R.ch(0.6)) R.put('lbench', R.i(c.x0 + 1, CW - 5), 7); if (R.ch(0.25)) R.put('iv', R.i(c.x0 + 1, CW - 2), 3); if (R.ch(0.3)) R.deco('slip', R.i(c.x0 + 1, CW - 2), 4);
        R.lamp(5, 5, 50, COLD); R.lamp(13, 5, 50, COLD);
      } else {
        for (const y of [8, 10, 12]) { R.put('lbench', 2, y); R.put('lbench', 11, y); }
        R.wall('wrecep', 3); R.wall('wclock', 8); R.wall('wdoorO', 11); R.wall('wpost', 14); R.put('plant', 16, 3); if (R.ch(0.5)) R.put('cooler', 2, 3); if (R.ch(0.4)) R.put('iv', 15, 9);
        R.lamp(5, 7, 56, COLD); R.lamp(13, 7, 56, COLD);
      }
    },
    mats: [{ n: '待合の長椅子', k: PK.seat, c: '#669999', on: ['lbench'] }, { n: '受付の窓', k: PK.window, c: '#cce0d8', on: ['wrecep'] }, { n: '呼ばれない番号', k: PK.sign, c: '#ffffcc', on: ['wnum'] }, { n: '点滴の台', k: PK.pole, c: '#cccccc', on: ['iv'] }],
  },
  blank: {
    name: '未描画', amb: '#ffffff', step: 'tile', corr: 0, open: 0.85, closed: 0.2, ver: 10, soft: true, lit: true,
    wall: { cap: '#000000', capHi: '#00a0a0', f1: '#000000', f2: '#000000', base: '#00a0a0' },
    floor(g, c, lx, ly, px, py, wx, wy) {
      const h = hash2(wx, wy, 11);
      if (h < 0.03) { R(g, px, py, 16, 16, '#fff'); LN(g, px + 1, py + 15, px + 15, py + 1, '#ccc'); } else if (h < 0.055) { R(g, px, py, 16, 16, '#000'); R(g, px, py, 8, 8, '#f0f'); R(g, px + 8, py + 8, 8, 8, '#f0f'); } else R(g, px, py, 16, 16, '#000');
      R(g, px, py, 16, 1, '#088'); R(g, px, py, 1, 16, '#088');
    },
    low(g, c, lx, ly, px, py) { R(g, px, py, 16, 16, '#000'); },
    gen(c, R) {
      for (let i = 0; i < R.i(0, 2); i++) R.fill(R.i(2, 13), R.i(8, 11), 2, 2, T_VOID);
      if (R.ch(0.5)) R.put('cube', R.i(2, 15), R.i(3, 4)); if (R.ch(0.4)) R.put('cube', R.i(2, 15), R.i(9, 12)); if (R.ch(0.4)) R.put('broken', R.i(2, 15), R.i(8, 12));
      if (R.ch(0.3)) R.put('sdoor', R.i(2, 15), R.i(8, 12)); if (R.ch(0.3)) R.put('cone', R.i(2, 15), R.i(3, 4)); if (R.ch(0.25)) R.put('cursor', R.i(2, 15), R.i(8, 12)); if (R.ch(0.25)) R.put('hourglass', R.i(2, 15), R.i(9, 12));
    },
    mats: [{ n: '余白', k: PK.blank, c: '#ffffff', on: ['cube'] }, { n: '読みこめない画像', k: PK.screen, c: '#ff00ff', on: ['broken'] }, { n: '待っていた時間', k: PK.clock, c: '#ffcc00', on: ['hourglass'] }, { n: 'どこにも出ない扉', k: PK.door, c: '#663333', on: ['sdoor'] }, { n: '矢印', k: PK.sign, c: '#ffffff', on: ['cursor', 'cone'] }],
  },
};
for (const k of Object.keys(BIOMES)) { BIOMES[k].id = k; if (BIOMES[k].ver === undefined) BIOMES[k].ver = 0; }
// 外を歩ける種類（アトリエ以外）。更新が進むと増える。
const BIOME_LIST = ['hall', 'office', 'under', 'street', 'tatami', 'school', 'pool', 'parking', 'station', 'danchi', 'fields', 'mall', 'clinic', 'blank'];
// 更新: 保存した素材の数がここに届くたびに版が上がり、空間の種類が 1 つ増える
const VER_AT = [2, 4, 7, 10, 14, 18, 23, 28, 34, 40];
const VER_LOG = [
  '廊下、事務所、 地下通路、夜道。', '畳の間を つなぎました。', '学校を つなぎました。', 'プールに 水を 入れました。', '地下駐車場を 掘りました。', '駅を 置きました。電車は 来ません。',
  '団地を 建てました。', '田んぼ道を のばしました。', '売場を 開けました。閉店して います。', '待合室を 用意しました。', 'まだ 描いていない 所に 入れる 不具合を 確認して います。',
];
const verOf = total => { let v = 0; while (v < VER_AT.length && total >= VER_AT[v]) v++; return v; };
const verName = v => '0.' + (71 + v) + 'β';

// 壁と塊の描き方（種類ごとの色で）
function paintCap(g, c, lx, ly, px, py) {
  const w = c.b.wall; R(g, px, py, 16, 16, w.cap);
  if (ly === 0 && c.hasN) R(g, px, py + 14, 16, 2, w.capHi); else { R(g, px + 15, py, 1, 16, w.capHi); R(g, px, py, 1, 16, w.capHi); }
}
function paintFace(g, c, lx, ly, px, py, wx) {
  const w = c.b.wall, up = ly === 1;
  R(g, px, py, 16, 16, up ? w.f1 : (w.f2 || w.f1));
  if (w.tile) { for (let i = 0; i < 16; i += w.tile) { R(g, px + i, py, 1, 16, w.line); R(g, px, py + i, 16, 1, w.line); } }
  if (w.block) { for (let j = 0; j < 2; j++) { R(g, px, py + j * 8 + 7, 16, 1, w.line); R(g, px + (((j + ly * 2) & 1) ? 0 : 8), py + j * 8, 1, 7, w.line); } if (up) R(g, px, py, 16, 3, '#a4a6aa'); }
  if (w.fus) { R(g, px, py, 1, 16, w.line); if (((wx % 2) + 2) % 2 === 0) R(g, px + 7, py, 2, 16, '#b8b088'); if (up) R(g, px, py, 16, 4, '#3a2c18'); else DI(g, px, py + 4, 16, 9, '#b0a880', 4); }
  if (w.shut) { for (let j = 1; j < 16; j += 3) R(g, px, py + j, 16, 1, w.line); if (((wx % 4) + 4) % 4 === 0) R(g, px, py, 2, 16, '#3a3c3a'); if (up) R(g, px, py, 16, 4, '#2a2c2a'); }
  if (up) { if (!w.fus && !w.shut && !w.block) R(g, px, py, 16, 1, w.capHi); }
  else { if (w.line && !w.tile && !w.block && !w.fus && !w.shut) R(g, px, py + (w.lineY || 3), 16, w.lineH || 1, w.line); else if (w.lineH) R(g, px, py + w.lineY, 16, w.lineH, w.line); R(g, px, py + 13, 16, 3, w.base); }
}
function paintBlock(g, c, lx, ly, px, py) {
  const w = c.b.wall; R(g, px, py, 16, 16, w.cap);
  const f = t => t === T_FLOOR || t === T_WATER;
  if (f(at(c, lx, ly - 1))) R(g, px, py, 16, 2, w.capHi); if (f(at(c, lx - 1, ly))) R(g, px, py, 1, 16, w.capHi); if (f(at(c, lx + 1, ly))) R(g, px + 15, py, 1, 16, w.capHi);
}
