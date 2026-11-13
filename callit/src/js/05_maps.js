// ───────── 地図（三夜ぶん）─────────
// 地図は文字の表で、組み立ては下の道具で行う（部屋を置く、扉をあける、物を置く）。
//   ~ 砂  = 道路  - 道路の中央線  : 舗装  _ 通路  . 部屋の床  , 板石の床  # 壁  D 扉  V 通風口
//   e 橋  E 橋の中央  H 遮断機  r 欄干  R 欄干（乗り越えられる所）  w 水  m 川べり（ぬかるみ）  S 階段  （空白）何もない
function mkMap(w, h, base) {
  const M = { w, h, t: new Array(w * h).fill(base), props: [], lights: [], marks: {} };
  M.set = (x, y, ch) => { if (x >= 0 && y >= 0 && x < w && y < h) M.t[y * w + x] = ch; };
  M.fill = (x, y, ww, hh, ch) => { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) M.set(x + i, y + j, ch); };
  M.room = (x, y, ww, hh, fl) => { M.fill(x, y, ww, hh, '#'); M.fill(x + 1, y + 1, ww - 2, hh - 2, fl); };
  M.prop = (k, x, y) => { M.props.push({ k, x, y }); };
  M.light = (x, y, r, kind, flick) => { M.lights.push({ x: x * 16 + 8, y: y * 16 + 8, r, c: kind[0], c2: kind[1], flick: !!flick }); };
  M.mark = (name, x, y, ww, hh) => { M.marks[name] = { x, y, w: ww || 1, h: hh || 1 }; };
  return M;
}
const WARM = ['#ffe2b0', '#5a3c1c'], COLD = ['#dfeaff', '#2c3848'], SODIUM = ['#ffc070', '#5a3410'], NEON = ['#ff5a4a', '#501410'], GREEN = ['#a8ffc8', '#1c4a30'];

const STAGES = [
  // ── 一夜目: 道ばたのモーテル。銃は使ってこない。「彼は鞄へ歩いてくる」を覚える夜 ──
  {
    night: '一夜目', name: 'モーテル', amb: 'desert', gun: false,
    intro: ['鞄の 中の 発信機が、彼を 呼ぶ。', 'トラックは 燃料が 空だ。'],
    steps: [
      { at: 'keys', hold: 1.5, give: 'key', text: '管理人室で 鍵を 取る', act: '鍵を 取る', snd: 'key' },
      { at: 'can', pick: true, give: 'can', text: 'スタンドの 携行缶を 取る' },
      { at: 'truck', hold: 6, need: 'can', text: 'トラックに 給油する', act: '給油する', snd: 'gulp' },
      { at: 'truck', hold: 1.5, bag: true, text: '鞄を 持って トラックで 出る', act: 'エンジンを かける', clear: true, end: 'engine' },
    ],
    build() {
      const M = mkMap(48, 30, '~');
      M.fill(0, 2, 48, 3, '='); M.fill(0, 3, 48, 1, '-');
      M.fill(2, 6, 12, 6, ':'); M.prop('pump', 5, 8); M.prop('pump', 9, 8); M.light(7, 8, 86, COLD);
      M.room(2, 12, 8, 5, ',');
      M.fill(12, 19, 32, 1, '_'); M.fill(12, 20, 34, 7, ':'); M.fill(17, 7, 27, 1, '_');
      for (let i = 0; i < 4; i++) {
        const x0 = 18 + i * 6;
        M.room(x0, 8, 7, 6, '.'); M.room(x0, 13, 7, 6, '.');
        M.prop('bed', x0 + 4, 9); M.prop('tv', x0 + 1, 11); M.prop('bed', x0 + 4, 17); M.prop('tv', x0 + 1, 15);
        if (i !== 1) M.light(x0 + 3, 10, 46, WARM); if (i !== 3) M.light(x0 + 3, 16, 46, WARM);
      }
      M.room(12, 13, 7, 6, ','); M.prop('keys', 13, 14); M.prop('desk', 16, 14); M.light(15, 16, 50, WARM);
      for (let i = 0; i < 4; i++) { const x0 = 18 + i * 6; M.set(x0 + 3, 8, 'D'); M.set(x0 + 3, 18, 'D'); M.set(x0 + 2, 13, 'V'); }
      M.set(15, 18, 'D');
      M.prop('truck', 29, 22); M.prop('car', 20, 23); M.prop('car2', 38, 22); M.prop('crate', 44, 8); M.prop('crate', 16, 9);
      M.prop('lamp', 13, 21); M.light(13, 20, 70, SODIUM); M.prop('lamp', 44, 20); M.light(44, 19, 70, SODIUM, true); M.prop('lamp', 25, 6); M.light(25, 5, 60, SODIUM);
      M.prop('neon', 40, 5); M.light(41, 5, 60, NEON, true);
      M.mark('start', 33, 15); M.mark('anton', 45, 3); M.mark('sedan', 44, 0);
      M.mark('keys', 13, 14); M.mark('can', 7, 10); M.mark('truck', 29, 22, 3, 2);
      return M;
    },
  },
  // ── 二夜目: 古いホテル。ここから撃ってくる。廊下は見通しがいい。通風口が使える ──
  {
    night: '二夜目', name: 'ホテル', amb: 'hotel', gun: true,
    intro: ['廊下は 見通しが いい。', '長く 見られると、撃たれる。'],
    steps: [
      { at: 'phone', hold: 5, text: 'ロビーの 電話で 車を 呼ぶ', act: '電話を かける', snd: 'ring' },
      { wait: PRM.taxiWait, text: '車が 来るまで 逃げる' },
      { at: 'taxi', reach: true, bag: true, text: '鞄を 持って 表の 車へ', clear: true, spawn: 'taxi', end: 'engine' },
    ],
    build() {
      const M = mkMap(38, 28, ' ');
      M.room(2, 3, 33, 15, '_');
      for (let i = 0; i < 4; i++) {
        const x0 = 6 + i * 6;
        M.room(x0, 6, 7, 5, '.'); M.room(x0, 10, 7, 5, '.');
        M.prop('bed', x0 + 4, 7); M.prop('tv', x0 + 1, 8); M.prop('bed', x0 + 4, 13); M.prop('tv', x0 + 1, 12);
        if (i !== 2) M.light(x0 + 3, 8, 40, WARM); if (i !== 0) M.light(x0 + 3, 12, 40, WARM);
      }
      M.room(11, 17, 15, 7, ',');
      for (let i = 0; i < 4; i++) { const x0 = 6 + i * 6; M.set(x0 + 3, 6, 'D'); M.set(x0 + 3, 14, 'D'); M.set(x0 + 2, 10, 'V'); }
      M.set(18, 17, 'D'); M.set(18, 23, 'D');
      M.prop('desk', 20, 19); M.prop('phone', 22, 19); M.prop('sofa', 13, 21); M.prop('plant', 12, 18); M.prop('plant', 24, 22);
      M.light(18, 20, 76, WARM);
      for (const p of [[4, 4], [18, 4], [32, 4], [4, 10], [32, 10], [4, 16], [11, 16], [25, 16], [32, 16]]) M.light(p[0], p[1], 44, WARM, p[0] === 32 && p[1] === 10);
      M.fill(0, 24, 38, 1, '_'); M.fill(0, 25, 38, 3, '='); M.fill(0, 26, 38, 1, '-');
      M.prop('lamp', 9, 24); M.light(9, 23, 64, SODIUM); M.prop('lamp', 29, 24); M.light(29, 23, 64, SODIUM);
      M.mark('start', 27, 12); M.mark('anton', 7, 25); M.mark('sedan', 3, 26);
      M.mark('phone', 22, 19); M.mark('taxi', 25, 25, 3, 2);
      return M;
    },
  },
  // ── 三夜目: 国境の橋。橋の上は速いが丸見え。川べりはぬかるんで遅い。欄干を越えれば、彼は遠回りになる ──
  {
    night: '三夜目', name: '国境の 橋', amb: 'river', gun: true,
    intro: ['橋は 遮断機が 下りている。', '川べりは ぬかるんで、足が 取られる。'],
    steps: [{ at: 'exit', reach: true, bag: true, text: '鞄を 持って 川下へ 抜ける', clear: true }],
    extras: [{ at: 'lever', hold: 3.5, act: 'ハンドルを 回す', snd: 'crank', open: 'gate' }],
    dropRow: 16,
    build() {
      const M = mkMap(62, 24, 'w');
      M.fill(0, 0, 12, 3, ' '); M.fill(0, 21, 12, 3, ' ');
      M.fill(0, 3, 12, 18, ':'); M.fill(4, 8, 4, 3, '#');
      M.prop('car', 5, 15); M.prop('crate', 2, 18); M.prop('crate', 9, 12);
      M.prop('lever', 11, 4); M.prop('lamp', 1, 6); M.light(1, 5, 66, SODIUM);
      M.fill(12, 6, 42, 3, 'e'); M.fill(13, 7, 41, 1, 'E'); M.fill(12, 6, 1, 3, 'H');
      M.fill(12, 5, 42, 1, 'r'); M.fill(12, 9, 42, 1, 'r');
      for (const x of [22, 30, 38, 46]) M.set(x, 9, 'R');
      M.fill(54, 4, 2, 7, '#');
      for (const x of [18, 30, 42]) { M.prop('lamp', x, 5); M.light(x, 6, 62, SODIUM, x === 30); }
      M.fill(12, 15, 50, 6, 'm'); M.fill(12, 15, 2, 6, 'S');
      for (const p of [[19, 16], [20, 16], [27, 18], [28, 18], [35, 16], [36, 17], [44, 18], [45, 18], [51, 16]]) M.prop('brush', p[0], p[1]);
      M.light(60, 17, 60, GREEN);
      M.mark('start', 3, 13); M.mark('anton', 3, 5); M.mark('sedan', 0, 3);
      M.mark('lever', 11, 4); M.mark('exit', 59, 15, 3, 6);
      return M;
    },
  },
];
