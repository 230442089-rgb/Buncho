// ───────── なぜか、走ってくる / 土台 ─────────
// 日本のふつうの住宅街で、なぜかアントン・シガーに追いかけられる。非公式のファンゲーム。
const DEBUG = location.hash === '#debug';

// 調整用の数値。【】が仕様上の名前。距離は m、時間は秒。
const PRM = {
  tile: 5,              // 【1 区画の大きさ】道の幅も同じ
  walk: 3.2,            // 【歩く速さ】m/s。歩く足音は、すぐそばでしか聞こえない
  run: 6.7,             // 【走る速さ】m/s。走る足音は、遠くまで聞こえる
  backMul: 0.88,        // 【振り返っているあいだの速さの倍率】
  stamina: 8,           // 【走りつづけられる時間】
  staminaRegen: 7,      // 【息が戻りきるまで】
  staminaDelay: 0.8,    // 【息が戻りはじめるまで】
  staminaMin: 0.22,     // 【走りなおせる息の量】0〜1
  antonRun: 7.6,        // 【彼の走る速さ】m/s。こちらより速い
  antonFar: 0.5,        // 【離れているときの速さの上乗せ】割合。遠いほど速く走ってくる（34m 以上で最大）
  antonSearch: 5.2,     // 【見失って探しているときの速さ】
  antonTurn: 4.4,       // 【彼が向きを変える速さ】rad/s。角では膨らんで遅くなる
  antonDay: 0.04,       // 【1 日ごとの速さの上乗せ】割合
  stand: 4,             // 【最初に、立ったままこちらを見ている時間】
  standMove: 2.5,       // 【こちらがこれだけ動いたら、すぐ走りだす】
  see: 46,              // 【彼に見える距離】
  near: 8,              // 【見回さなくても気づく距離】
  lose: 0.5,            // 【姿が見えなくなってから、見失うまで】そのあとは、最後に見た場所で見回すまで気づかない
  hearRun: 8,           // 【走る足音が聞こえる距離】塀のむこうでも聞こえる
  hearWalk: 3,          // 【歩く足音が聞こえる距離】
  lookPause: 1.2,       // 【見失った場所で立ち止まって見回す時間】
  guess: 0.45,          // 【見失ったあと、正しい方向を選ぶ確率】外れても、まぐれで当たることはある
  guessDay: 0.05,       // 【1 日ごとの、その確率の上乗せ】
  ping: 18,             // 【見失ったままでも、居場所に気づくまで】
  catchDist: 1.0,       // 【つかまる距離】
  antonStart: 7,        // 【最初の彼との間隔】区画
  homeDist: 17,         // 【1 日目の、家までの道のり】区画
  homeStep: 3,          // 【1 日ごとに遠くなる分】区画
  unlock: 2.6,          // 【玄関の鍵を開けるのにかかる時間】
  antonLight: 1.5,      // 【彼を照らす光の強さ】暗い道でも姿が分かるように
  fov: 62,              // 【視野】度（縦。横長の画面での値。縦長の画面では、横が狭くなりすぎないように広げる）
  fovRun: 6,            // 【走っているあいだ、視野が広がる分】
  fovStand: 30,         // 【彼が立ってこちらを見ているあいだの視野】遠くの彼に、目が吸い寄せられる
  eye: 1.62,            // 【目の高さ】
};

// 色。16 進の色は画面での見た目（sRGB）なので、光の計算に使う前に直す。直さないと、暗い色が白っぽく浮く
const C3 = hex => new THREE.Color(hex).convertSRGBToLinear();
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);       // t が a〜b のどこにあるか（0〜1）
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
// 種から決まる乱数（町を作るのに使う。同じ種なら同じ町）
function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 保存（何日目まで生きたか、音の設定、二通りの死にかたをそれぞれ何回見たか = nb, nn）。残らなくても遊べる。
const Store = {
  KEY: 'nazeka.v1', d: null,
  load() { this.d = { best: 0, mute: 0, skip: 0, nb: 0, nn: 0 }; try { const s = localStorage.getItem(this.KEY); if (s) Object.assign(this.d, JSON.parse(s)); } catch (e) { /* 残っていなくてもよい */ } return this.d; },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) { /* 残せなくてもよい */ } },
};

// 入力。キーボード・マウス・タッチをまとめる。
//   mvx 横（右が正）, mvy 前後（前が正）, run 走る, back 振り返る, act 決定（押しつづけ）, lookX/lookY 視点を動かした量（rad）
const Input = {
  held: {}, mvx: 0, mvy: 0, run: false, back: false, act: false, actHit: false, pauseHit: false, anyHit: false, lookX: 0, lookY: 0,
  stick: { on: false, x: 0, y: 0 }, tBack: false, tAct: false,
  KEYS: { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', ArrowLeft: 'tl', ArrowRight: 'tr',
    ShiftLeft: 'run', ShiftRight: 'run', KeyQ: 'back', KeyC: 'back', KeyE: 'act', KeyF: 'act', Enter: 'act', Space: 'act', Escape: 'pause', KeyP: 'pause' },
  press(k) { if (this.held[k]) return; this.held[k] = true; this.anyHit = true; if (k === 'act') this.actHit = true; else if (k === 'pause') this.pauseHit = true; },
  release(k) { this.held[k] = false; },
  clear() { this.held = {}; this.stick.on = false; this.tBack = this.tAct = false; },
  update(dt) {
    const h = this.held;
    let x = (h.right ? 1 : 0) - (h.left ? 1 : 0), y = (h.up ? 1 : 0) - (h.down ? 1 : 0), run = !!h.run;
    if (this.stick.on) { x = this.stick.x; y = -this.stick.y; const m = Math.hypot(x, y); if (m < 0.2) x = y = 0; else if (m > 0.86) run = true; }
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    this.mvx = x; this.mvy = y; this.run = run; this.back = !!h.back || this.tBack; this.act = !!h.act || this.tAct;
    this.lookX += ((h.tr ? 1 : 0) - (h.tl ? 1 : 0)) * 2.4 * dt;   // マウスが使えないときは、左右キーで向きを変える
  },
  endFrame() { this.actHit = this.pauseHit = this.anyHit = false; this.lookX = this.lookY = 0; },
};
