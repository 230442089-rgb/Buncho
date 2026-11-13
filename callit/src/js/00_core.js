// ───────── CALL IT / 土台 ─────────
// 映画「ノーカントリー」（原作 コーマック・マッカーシー）の登場人物をもとにした、非公式のファンゲーム。
const W = 320, H = 240, TS = 16;
const VIEW_Y = 30, VIEW_H = 180;   // 上下 30px は黒い帯（映画の画面）。そのあいだの 320x180 が見える範囲
const DEBUG = location.hash === '#debug';

// 調整用の数値。【】が仕様上の名前。
const PRM = {
  walk: 3.7,            // 【歩く速さ】タイル/秒
  carryMul: 0.88,       // 【鞄を持っているときの倍率】
  runMul: 1.45,         // 【走るときの倍率】
  woundMul: 0.72,       // 【傷を負っているときの倍率】（走れない）
  stamina: 3.6,         // 【走りつづけられる時間】秒
  staminaRegen: 5.5,    // 【息が戻りきるまで】秒
  staminaDelay: 0.7,    // 【息が戻りはじめるまで】秒
  staminaMin: 0.25,     // 【走りなおせる息の量】0〜1
  antonSpeed: [2.5, 2.65, 2.8],   // 【シガーの歩く速さ】夜ごと。タイル/秒。彼は走らない
  loopMul: 1.08,        // 【二巡目からの速さの倍率】
  arrive: [9, 7, 9],    // 【彼が現れるまで】夜ごと。秒
  boltTime: 2.6,        // 【錠を抜くのにかかる時間】秒
  boltRange: 5,         // 【抜けた錠が飛ぶ距離】タイル
  searchTime: 5,        // 【通風口から鞄を出すのにかかる時間】秒
  doorOpen: 0.25,       // 【彼が扉を開けるときの間】秒
  gunRange: 8,          // 【撃ってくる距離】タイル
  gunSee: 0.9,          // 【見通しに入ってから構えるまで】秒
  gunAim: 0.75,         // 【構えてから撃つまで】秒
  gunLock: 0.3,         // 【撃つ直前、狙いが動かなくなる時間】秒（ここで横へ動けば外れる）
  gunWidth: 0.55,       // 【弾の当たる幅】タイル
  gunRecover: 1.3,      // 【撃ったあと動きだすまで】秒
  woundTime: 12,        // 【傷が癒えるまで】秒。そのあいだにもう一度当たると倒れる
  catchDist: 0.8,       // 【つかまる距離】タイル
  beepFar: 30,          // 【受信機がいちばん遅く鳴る距離】タイル（道のり）
  beepSlow: 1.5,        // 【いちばん遅い間隔】秒
  beepFast: 0.11,       // 【いちばん速い間隔】秒
  coinTime: 6,          // 【表か裏かを言うまでの猶予】秒
  spareTime: 10,        // 【硬貨に当たったあと、彼が数える時間】秒
  stashTime: 1.2,       // 【通風口に鞄を隠す時間】秒
  pullTime: 2.0,        // 【通風口から鞄を引き出す時間】秒
  climbTime: 1.0,       // 【欄干を乗り越える時間】秒
  unlockTime: 0.45,     // 【自分でかけた鍵を開ける手間】秒
  taxiWait: 40,         // 【電話してからタクシーが来るまで】秒
};

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const chance = p => Math.random() < p;
const wait = ms => new Promise(r => setTimeout(r, ms));
function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function mkCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  return { c, g };
}
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

// 保存（どこまで進んだか、いちばん速い記録、音の設定）。残らなくても遊べる。
const Store = {
  KEY: 'callit.v1', d: null,
  def() { return { unlocked: 1, best: {}, loop: 0, mute: 0, hints: {} }; },
  load() {
    this.d = this.def();
    try { const s = localStorage.getItem(this.KEY); if (s) Object.assign(this.d, JSON.parse(s)); } catch (e) { /* 残っていなくてもよい */ }
    if (!this.d.best || typeof this.d.best !== 'object') this.d.best = {};
    if (!this.d.hints || typeof this.d.hints !== 'object') this.d.hints = {};
    return this.d;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) { /* 残せなくてもよい */ } },
};

// 入力。キーボードと、画面の棒（タッチ）の両方をまとめて、移動の向きとボタンにする。
const Input = {
  held: {}, mx: 0, my: 0, run: false, act: false,
  actHit: false, bagHit: false, pauseHit: false, anyHit: false, upHit: false, downHit: false, leftHit: false, rightHit: false,
  stick: { on: false, x: 0, y: 0 },
  KEYS: { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyZ: 'act', Enter: 'act', Space: 'act', KeyX: 'run', ShiftLeft: 'run', ShiftRight: 'run', KeyC: 'bag', KeyB: 'bag', Escape: 'pause', KeyP: 'pause' },
  press(k) {
    if (this.held[k]) return;
    this.held[k] = true; this.anyHit = true;
    if (k === 'act') this.actHit = true; else if (k === 'bag') this.bagHit = true; else if (k === 'pause') this.pauseHit = true;
    else if (k === 'up') this.upHit = true; else if (k === 'down') this.downHit = true; else if (k === 'left') this.leftHit = true; else if (k === 'right') this.rightHit = true;
  },
  release(k) { this.held[k] = false; },
  clear() { this.held = {}; this.stick.on = false; },
  // 1 フレームに 1 回: 移動の向き（長さ 0〜1）と、走るかどうかを決める。棒を大きく倒すと走る。
  update() {
    const h = this.held;
    let x = (h.right ? 1 : 0) - (h.left ? 1 : 0), y = (h.down ? 1 : 0) - (h.up ? 1 : 0), run = !!h.run;
    if (this.stick.on) { x = this.stick.x; y = this.stick.y; const m = Math.hypot(x, y); if (m < 0.22) x = y = 0; else if (m > 0.86) run = true; }
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    this.mx = x; this.my = y; this.run = run; this.act = !!h.act;
  },
  endFrame() { this.actHit = this.bagHit = this.pauseHit = this.anyHit = this.upHit = this.downHit = this.leftHit = this.rightHit = false; },
};
