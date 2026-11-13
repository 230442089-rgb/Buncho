// ───────── 事象のアトリエ / 土台 ─────────
const VERSION = '0.71β';
const W = 320, H = 240, TS = 16;
const DEBUG = location.hash === '#debug';

// 調整用の数値。【】が仕様上の名前。
const PRM = {
  stepTime: 0.23,            // 【歩行1歩の時間】秒
  wadeTime: 0.44,            // 【水中1歩の時間】秒
  sketchTime: 3.2,           // 【スケッチ完了までの時間】秒
  sketchDecay: 0.1,          // 【スケッチ中断時の戻り】毎秒
  shadowSketchTime: 2.8,     // 【影のスケッチ完了までの時間】秒（累積）
  shadowReach: 6,            // 【影をスケッチできる距離】タイル
  firstVisitAfterSketch: 5,  // 【最初のスケッチから初来訪まで】秒
  firstVisitMax: 75,         // 【スケッチしなくても初来訪が起きる時間】秒
  visitBase: 46,             // 【来訪間隔の基準】秒
  visitPerSaved: 3.5,        // 【保存済み素材1個ごとの短縮】秒
  visitPerCarry: 7,          // 【未保存素材1個ごとの短縮】秒
  visitMin: 16,              // 【来訪間隔の下限】秒
  visitJitter: 12,           // 【来訪間隔のゆらぎ】秒
  omenLong: 3.4,             // 【予兆の長さ・最初】秒
  omenShort: 1.8,            // 【予兆の長さ・最後】秒
  stayShort: 6,              // 【滞在時間・最初】秒
  stayLong: 10,              // 【滞在時間・最後】秒
  mercyOmen: 0.4,            // 【連続強制終了1回ごとの予兆延長】秒
  mercyMax: 3,               // 【予兆延長の上限回数】
  dashSpeed: 15,             // 【アセラのダッシュ速度】タイル/秒
  chaseSpeed: 16,            // 【追跡の速度】タイル/秒
  shadowLead: 0.3,           // 【影が先に走る時間】秒
  lookMin: 0.35,             // 【1方向を見る時間・最短】秒
  lookMax: 0.75,             // 【1方向を見る時間・最長】秒
  fov: 58,                   // 【視界の半角】度
  sight: 11,                 // 【視界の距離】タイル
  nearSense: 1.7,            // 【近接感知の距離】タイル
  gaugeNear: 2.2,            // 【発見ゲージ上昇・近】毎秒（3タイル以内）
  gaugeFar: 0.7,             // 【発見ゲージ上昇・遠】毎秒（視界の端）
  gaugeSketch: 0.45,         // 【影スケッチ中の上昇倍率】
  gaugeDecay: 0.5,           // 【発見ゲージの減衰】毎秒
  foundStop: 0.55,           // 【発見時のヒットストップ】秒
  feintChance: 0.25,         // 【ふり向きフェイントの確率】（レベル3以上）
  maxLevel: 7,               // 【偏愛レベルの上限】（保存済み＋未保存の素材数）
  packLevel1: 4,             // 【影が1つ増えるレベル】
  packLevel2: 6,             // 【影が2つ増えるレベル】
  packSense: 2.2,            // 【増えた影の感知距離】タイル
  packGauge: 1.5,            // 【増えた影による発見ゲージ上昇】毎秒
  packSpeed: 9,              // 【増えた影の速さ】タイル/秒
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
function mkCanvas(w, h, read) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  return { c, g };
}

// 保存。ブラウザに残らないこともあるので、失敗しても動くようにしてある。
const Store = {
  KEY: 'jishou-no-atelier.v1',
  d: null,
  def() { return { boots: 0, crashes: 0, streak: 0, last: 'none', saved: [], shadow: 0, cleared: 0, sound: 1, scan: 1, taught: 0 }; },
  load() {
    this.d = this.def();
    try { const s = localStorage.getItem(this.KEY); if (s) Object.assign(this.d, JSON.parse(s)); } catch (e) { /* 残っていなくてもよい */ }
    if (!Array.isArray(this.d.saved)) this.d.saved = [];
    return this.d;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) { /* 残せなくてもよい */ } },
};

// 入力。方向は「最後に押したもの」を優先する。
const Input = {
  dirs: [], act: false, actHit: false, cancelHit: false, anyHit: false, dirHit: null, held: {},
  press(k) {
    if (this.held[k]) return;
    this.held[k] = true; this.anyHit = true;
    if (k === 'act') { this.act = true; this.actHit = true; }
    else if (k === 'cancel') this.cancelHit = true;
    else { this.dirs = this.dirs.filter(d => d !== k); this.dirs.unshift(k); this.dirHit = k; }
  },
  release(k) {
    this.held[k] = false;
    if (k === 'act') this.act = false; else this.dirs = this.dirs.filter(d => d !== k);
  },
  clear() { for (const k of Object.keys(this.held)) this.release(k); },
  // 押されている方向。一瞬だけ押してすぐ離したときも、その 1 回は拾う
  dir() { return this.dirs[0] || this.dirHit; },
  endFrame() { this.actHit = this.cancelHit = this.anyHit = false; this.dirHit = null; },
};
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'act', Enter: 'act', Space: 'act', KeyX: 'cancel', Escape: 'cancel',
};
const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const DIRS = ['up', 'down', 'left', 'right'];
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const CW = { up: 'right', right: 'down', down: 'left', left: 'up' };   // 時計回り
