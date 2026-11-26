// game.js — 迎撃戦。ユリアは決まった道を進みつづけ、こちらは画面の中での位置だけを動かす（視点は操作では動かない）。
//   光の矢は自動で撃ち、近くの敵へ向かう。「槍」はためて放つ貫く光線、「波」は弾を消して機械を止める（設定資料の能力どおり）。
//   機体を落とすと、乗っていた文鳥は脱出して落下傘で降りていく（戦う機能だけを奪う。だれも倒れない）。
//   物の位置は「画面の枠」で持つ: (X, Y, z)。z は自分より何単位奥か、X・Y は左右・上下（世界の単位）。
//   枠はカメラと同じ向きなので、道がどう曲がっても、画面の同じ場所にあるものは同じ場所に見える。
import { camera } from '../../flight/src/render.js';
import { daylight, ambientTint, clamp, sat, lerp, smoothstep, norm, cross, dot } from '../../flight/src/sky.js';
import { FX } from '../../flight/src/art.js';
import { buildRail, DCAM } from './rail.js';
import { A } from './art.js';
import { matrix } from './mesh.js';
import { SCRIPT, makeEnemy } from './enemies.js';
import { place, xf, YPIV, BPIV, LANCE_REST } from './cast.js';

const HEADR = 0.0136, SPEED = 1.8, ORBIT_SPEED = 2.5, TAU = Math.PI * 2;
const AIM_DY = 0.30;                       // ねらいの中心は、ユリアのすこし上（画面の高さの 15%）
const BS = 0.9;                            // 旗艦の大きさ（模型は全長 13）
const MARK_T = 1.0;                        // 着弾の何秒前から、赤い印を出すか
const KIND = { orb: { r: 0.046, hit: 0.044 }, orb2: { r: 0.052, hit: 0.048 }, needle: { r: 0.04, hit: 0.038 }, mine: { r: 0.05, hit: 0.046 } };
const ex = (dt, k) => 1 - Math.exp(-dt * k);
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const GOLD = [1.0, 0.80, 0.34], RED = [1.0, 0.24, 0.16], Z3 = [0, 0, 0];
const BSC = 0.205;                          // マッスル文鳥の大きさ（模型は身長 6.1）
// 銃弾の見た目: 模型の大きさ・光の筋の太さと長さ・光の大きさ・曳光の色
const BUL = { round: { s: 0.17, w: 0.2, len: 2.6, g: 0.6, col: [1, 0.5, 0.2] }, slug: { s: 0.15, w: 0.26, len: 2.0, g: 0.66, col: [0.45, 1, 0.4] }, bullet: { s: 0.17, w: 0.13, len: 3.6, g: 0.46, col: [1, 0.85, 0.3] } };
const ease01 = (x) => { x = sat(x); return x * x * (3 - 2 * x); };

// ユリアのことば（一人称「あーし」。資料の口調）と、B.U.N の隊長のことば。[文, 表情, だれ]
export const LINES = {
  start: [['空から来たって同じ。よゆーよゆー♪　あーしに任せときなって！', 'grin', 'y']],
  bazooka: [['赤い印は、そこに来るっていう合図。外に出れば平気じゃん。', 'smile', 'y']],
  ready: [['槍、たまったじゃん。いつでもいけるよ！', 'grin', 'y']],
  gunner: [['弾が多いときは、波でまとめて消せるじゃん。', 'smile', 'y']],
  gunship: [['でかいのが来た。……ま、止めるけど。', 'cool', 'y']],
  lance: [['穿て！', 'fierce', 'y'], ['まとめて、いくよ！', 'fierce', 'y']],
  wave: [['――動くな。', 'cool', 'y'], ['止まれ、って言ったよね。', 'cool', 'y']],
  hit: [['いったぁ……なーんて。よゆーよゆー。', 'oops', 'y'], ['っと。こんなの、かすり傷じゃん。', 'oops', 'y']],
  low: [['ちょっと、もらいすぎたかも。……まだ、やれる。', 'cool', 'y']],
  chain: [['うける、入れ食いじゃん！', 'happy', 'y'], ['いい感じ♪', 'happy', 'y']],
  warn: [['……でっか。あれが親玉ってわけね。', 'wow', 'y']],
  boss0: [['ピヨハハハ！　この空は、B.U.N がいただくッピ！', 'smug', 'c']],
  boss1: [['全員、無傷で帰すから。……文鳥も、ね。', 'grin', 'y']],
  turret: [['ぬぅ……砲がなくとも、筋肉があるッピ！', 'shout', 'c']],
  open: [['ば、馬鹿な……装甲が、もたんッピ！', 'shock', 'c']],
  cannon: [['主砲、撃てぇッピ！', 'shout', 'c']],
  fin0: [['これで、おしまい。', 'cool', 'y']],
  fin1: [['――穿て。', 'fierce', 'y']],
  fin2: [['お、覚えてろッピ〜〜！', 'cry', 'c']],
  end: [['はい、おしまい。文鳥たちも、ちゃんと帰れたじゃん。', 'happy', 'y']],
  down: [['……ちょっとだけ、休憩。すぐ戻るから。', 'oops', 'y']],
};

// 遠くの空を行く B.U.N の編隊（背景。撃ってはこない）。世界の中を大きく回りつづける
function makeArmada() {
  const out = [];
  for (let g = 0; g < 6; g++) {
    const R = 24 + (g * 37 % 22), h = 6.0 + (g * 53 % 24) * 0.1, w = (g % 2 ? -1 : 1) * (0.036 + (g * 29 % 14) * 0.002), a0 = g * 1.13, kind = g % 3 === 2 ? 'gunship' : g % 3 ? 'fighter' : 'drone';
    const n = kind === 'gunship' ? 3 : 7;
    for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; out.push({ R, h: h + Math.abs(k) * 0.12, w, a0, back: Math.abs(k) * 1.1, side: k * 1.0, kind, s: kind === 'gunship' ? 1.5 : kind === 'fighter' ? 1.5 : 2.2 }); }
  }
  return out;
}

// 「3D モデルを見る」に並べるもの。size: 画面に収める高さ（模型の単位）, pivot: 画面のまん中に来る点
export const GALLERY = [
  { id: 'yuria', name: 'ユリア（戦闘形態）', note: '白い髪に黄色の毛先、機械の翼と槍。顔はときどき変わる。', size: 18.5, pivot: [0, 7.8, 0], zoomTo: 3.0, zoomPivot: [0, 12.2, 0] },         // 「寄る」は、顔と肩まわりへ
  { id: 'fly', name: 'ユリア（飛ぶ姿）', note: '戦いのあいだ、うしろから見ている姿。髪も翼も動く。', size: 19.5, pivot: [0, 8.6, 1.2], back: 1 },
  { id: 'flex', name: 'マッスル文鳥', note: 'B.U.N の兵。頭は文鳥、体は筋肉。', size: 7.2, pivot: [0, 2.6, 0] },
  { id: 'trooper', name: '兵（バズーカ）', note: '背中の噴射装置で浮かび、肩の筒からロケット弾を撃つ。', size: 7.6, pivot: [0, 2.7, 0] },
  { id: 'gunner', name: '砲手（ガトリング）', note: '6 本の銃身が回る。撃つときは、もっと速く回る。', size: 7.6, pivot: [0, 2.6, 0.6] },
  { id: 'cmd', name: '隊長', note: '旗艦の艦橋に立つ。帽子とマントと色眼鏡。', size: 7.8, pivot: [0, 2.9, 0] },
  { id: 'chute', name: '脱出した文鳥', note: '機体を落とされても、落下傘で帰っていく。だれも倒れない。', size: 12.5, pivot: [0, 5.6, 0] },
  { id: 'dragon', name: '竜の姿', note: '決め技のときの姿。白い体に黒と金の背、金の角、機械の翼、光の輪。', size: 30, pivot: [0, 0, 0] },
  { id: 'ammo', name: '弾と兵器', note: '機関砲の弾・太い弾・細い弾・ロケット弾・ミサイル・機雷・光の結晶。', size: 5.8, pivot: [0, 0, 0] },
];

export class Strike {
  constructor({ T, R, meshes, cast, input, sound, tex, hooks }) {
    this.T = T; this.R = R; this.meshes = meshes; this.cast = cast; this.input = input; this.sound = sound; this.tex = tex; this.hooks = hooks || {};
    this.rail = buildRail(T);
    // 決戦が始まるのは、湖の岸の周回に入ったところ
    this.bossAt = (this.rail.loopS + 4 - 0.5) / SPEED;
    this.armada = makeArmada();
    this.clock = 0; this.hw = 0.7; this.hh = 0.4; this.U = 1; this.reduced = false; this.easy = 1;
    this.fade = 0; this.fadeTo = 1; this.flash = 0; this.shake = 0;
    this.reset('title');
  }
  emit(n, d) { if (this.hooks[n]) this.hooks[n](d); }
  say(key, i = -1) {
    const list = LINES[key]; if (!list || this.mode === 'title') return;
    const now = this.clock, gap = { hit: 6, chain: 14, lance: 9, wave: 7, turret: 8, cannon: 12 }[key] ?? 0;
    if (gap && this.cool[key] && now - this.cool[key] < gap) return;
    this.cool[key] = now;
    const p = list[i >= 0 ? i : Math.floor(Math.random() * list.length)];
    if (p[2] === 'y') { this.P.mood = p[1]; this.moodUntil = now + 2.6; }
    this.emit('say', { text: p[0], mood: p[1], who: p[2] });
  }
  hint(k) { if (!this.hinted[k]) { this.hinted[k] = 1; this.say(k); } }

  reset(mode) {
    this.mode = mode; this.paused = false; this.auto = mode === 'title';
    this.s = 0.5; this.tm = 0; this.si = 0; this.day = 0.24; this.orbit = 0; this.fdir = null; this.loopAt = 0; this.warned = false;
    this.P = { nx: 0, ny: -0.3, tx: 0, ty: -0.3, X: 0, Y: 0, vx: 0, shield: 5, inv: 0, lance: 0.5, lanceT: 0, waves: 3, waveT: 0, waveCd: 22, fireT: 0, mood: 'smile', turn: 0, turnTo: 0, hurt: 0, power: 0 };
    this.en = []; this.shots = []; this.bul = []; this.gems = []; this.parts = []; this.debris = []; this.fly = [];
    this.boss = null; this.fin = null; this.waveFx = null; this.lock = null; this.aim = { nx: 0, ny: 0, z: 14 };
    this.score = 0; this.chain = 0; this.chainT = -9; this.maxChain = 0; this.routed = 0; this.hits = 0; this.kills = 0; this.cont = 0;
    this.cool = {}; this.hinted = {}; this.moodUntil = 0; this.resultShown = false;
    this.fade = 0; this.fadeTo = 1; this.R.shadowKey = null;
    this.setFrame(0, true);
    this.emit('mode', mode);
  }
  start() { this.reset('play'); }
  // 3D モデルを見る（題から）。i: 何番めを見るか
  gallery(i = 0) { this.reset('gallery'); this.gal = { i: 0, yaw: 0.45, zoom: 1, hold: 0, t: 0 }; this.galSet(i); }
  galSet(i) { const n = GALLERY.length, g = this.gal; g.i = ((i % n) + n) % n; g.yaw = 0.45; g.t = 0; this.emit('gallery', { i: g.i, n, ...GALLERY[g.i] }); }
  galTurn(d) { if (this.gal) { this.gal.yaw += d; this.gal.hold = 2.5; } }
  galZoom(k) { if (this.gal) this.gal.zoom = clamp(k, 0.8, 2.2); }
  toTitle() { this.reset('title'); }
  // 力つきたあと、その場から続ける
  resume() { if (this.mode !== 'down') return; this.mode = this.boss ? 'boss' : 'play'; this.P.shield = 5; this.P.inv = 3; this.P.waves = Math.max(this.P.waves, 2); this.P.turnTo = 0; this.cont++; this.bul.length = 0; this.emit('mode', this.mode); }

  // ---- 画面の枠: 自分のいる点 p と、右・上・前。道のすこし先を向く。決戦では湖のまん中を向く
  setFrame(dt, snap) {
    const rail = this.rail, q = rail.path.at(this.s), a = rail.path.at(this.s + 5), c = rail.loopCenter;
    let f = norm([q.t[0] * 5 + a.p[0] - q.p[0], q.t[1] * 5 + a.p[1] - q.p[1], q.t[2] * 5 + a.p[2] - q.p[2]]);
    if (this.orbit > 0) { const fi = norm([c[0] - q.p[0], 0.02, c[1] - q.p[2]]), k = smoothstep(0, 1, this.orbit); f = norm([lerp(f[0], fi[0], k), lerp(f[1], fi[1], k), lerp(f[2], fi[2], k)]); }
    const g = this.fdir, e = ex(dt, 6);
    if (g && !snap) f = norm([lerp(g[0], f[0], e), lerp(g[1], f[1], e), lerp(g[2], f[2], e)]);
    this.fdir = f;
    const r = norm([f[2], 0, -f[0]]), u = cross(f, r);
    this.fr = { p: q.p, r, u, f };
  }
  W(X, Y, z) { const F = this.fr; return [F.p[0] + F.r[0] * X + F.u[0] * Y + F.f[0] * z, F.p[1] + F.r[1] * X + F.u[1] * Y + F.f[1] * z, F.p[2] + F.r[2] * X + F.u[2] * Y + F.f[2] * z]; }
  dirW(dX, dY, dz) { const F = this.fr; return norm([F.r[0] * dX + F.u[0] * dY + F.f[0] * dz, F.r[1] * dX + F.u[1] * dY + F.f[1] * dz, F.r[2] * dX + F.u[2] * dY + F.f[2] * dz]); }
  k(z) { return 1 + z / DCAM; }                                    // その奥行きで、画面の同じ位置にあたる左右・上下の倍率
  // 槍の先（枠の中の位置）
  tipL() { const g = this.gripL(), d = this.lanceDir(g), L = this.cast.tipZ * HEADR * this.U; return [g[0] + d[0] * L, g[1] + d[1] * L, g[2] + d[2] * L]; }
  // 槍のにぎり（枠の中の位置）と、槍の向き（ねらいの先へ）
  gripL() { const P = this.P, g = this.cast.grip, h = HEADR * this.U; return [P.X + g[0] * h, P.Y + g[1] * h, g[2] * h]; }
  // ふだんは右ななめ前へ構え、槍の光線を放つあいだは、ねらいの先へ向ける
  lanceDir(g = this.gripL()) { const a = this.aimL(), e = ease01(this.P.power), d = norm([a[0] - g[0], a[1] - g[1], Math.max(1, a[2] - g[2])]); return norm([lerp(LANCE_REST[0], d[0], e), lerp(LANCE_REST[1], d[1], e), lerp(LANCE_REST[2], d[2], e)]); }

  // ---- 出す
  spawn(type, move, o) { const e = makeEnemy(this, type, move, o); if (move === 'over') e.ghost = true; this.en.push(e); return e; }
  // 弾。撃った瞬間にユリアがいた場所（に少しずらした所）へ、まっすぐ飛ぶ
  bullet(o) {
    const e = o.from, P = this.P, K = KIND[o.kind] || KIND.orb, sp = (o.speed || 8) * this.easy, X0 = e.X + (o.dx || 0), Y0 = e.Y + (o.dy || 0), z0 = e.z;
    if (z0 < 3 || this.bul.length > 150) return;
    const U = this.U, a = rnd(TAU), sr = (o.spread || 0) * Math.sqrt(Math.random()) * U;
    const Xt = P.X + Math.cos(a) * sr + ((o.off || 0) * 0.15 + (o.tx || 0)) * U, Yt = P.Y + Math.sin(a) * sr + (o.ty || 0) * U, Tt = z0 / sp;
    this.bul.push({ kind: o.kind || 'orb', X: X0, Y: Y0, z: z0, vX: (Xt - X0) / Tt, vY: (Yt - Y0) / Tt, vz: -sp, r: K.r, hit: K.hit, t: 0 });
  }
  // バズーカの弾（着弾すると広がる。撃ち落とせる）
  shell(e) {
    const P = this.P, sp = 6.5 * this.easy, Tt = e.z / sp, Xt = P.X + rnd(0.06, -0.06) * this.U, Yt = P.Y + rnd(0.06, -0.06) * this.U, X0 = e.X - 0.2, Y0 = e.Y + 0.15;
    this.bul.push({ kind: 'shell', X: X0, Y: Y0, z: e.z, vX: (Xt - X0) / Tt, vY: (Yt - Y0) / Tt, vz: -sp, r: 0.12, hit: 0.15, t: 0, hp: 2 });
    this.sound.play('launch', { gain: 0.5, gap: 0.2 });
  }
  // 追いかけてくるミサイル（撃ち落とせる）
  missile(e, dx = 0, dy = 0) { this.bul.push({ kind: 'missile', X: e.X + dx, Y: e.Y + dy - 0.2, z: e.z, vX: dx * 0.8, vY: -0.5, vz: -5.0 * this.easy, r: 0.12, hit: 0.065, t: 0, hp: 1, tr: 0 }); this.sound.play('launch', { gain: 0.4, gap: 0.2 }); }
  warn() { this.warned = true; this.emit('warn'); this.say('warn'); this.sound.play('alarm', { gain: 0.7 }); }

  // ---- 旗艦。湖のまん中に降りてくる。こちらは岸に沿って回り、いつも正面に見る
  bossStart() {
    const part = (kind, off, hp, r) => ({ kind, off: off.map((v) => v * BS), hp, hp0: hp, r: r * BS, alive: true, flash: 0, ft: rnd(2.5, 1), X: 0, Y: 0, z: 0 });
    this.boss = { t: 0, X: 0, Y: 12, z: 70, phase: 1, cannon: { st: 'idle', t: 7 }, ringT: 3, dead: false,
      parts: [part('turret', [1.15, 0.82, 3.3], 44, 0.42), part('turret', [-1.15, 0.82, 3.3], 44, 0.42), part('turret', [3.5, 0.55, 0.3], 44, 0.42), part('turret', [-3.5, 0.55, 0.3], 44, 0.42),
        part('pod', [2.6, 0.78, 0.1], 40, 0.6), part('pod', [-2.6, 0.78, 0.1], 40, 0.6), part('cannon', [0, -1.05, 5.9], 70, 0.5), part('core', [0, 1.0, 1.5], 460, 0.8)] };
    this.mode = 'boss'; this.emit('mode', 'boss'); this.say('boss0'); this.sound.play('bossin', { gain: 0.8 });
  }
  // 旗艦の向き（枠の中で）。艦首をこちらへ向け、すこし下げて甲板を見せる
  bossBasis() { const p = -0.30; return { f: [0, Math.sin(p), -Math.cos(p)], u: [0, Math.cos(p), Math.sin(p)], r: [-1, 0, 0] }; }
  bossHP() { const b = this.boss; if (!b) return 0; let h = 0, m = 0; for (const p of b.parts) if (p.kind === 'turret' || p.kind === 'core') { h += Math.max(0, p.hp); m += p.hp0; } return h / m; }

  // ============================================================ 進行
  update(dt) {
    dt = clamp(dt, 1e-4, 0.05); this.clock += dt; this.dt = dt;
    this.fade += (this.fadeTo - this.fade) * ex(dt, 3.2); this.flash *= Math.exp(-dt * 4.5); this.shake *= Math.exp(-dt * 7);
    if (this.paused) return;
    this.lens();
    if (this.mode === 'gallery') { const g = this.gal; g.t += dt; g.hold -= dt; if (g.hold <= 0 && !this.reduced) g.yaw += dt * 0.45; this.setFrame(dt, false); return; }
    const P = this.P, now = this.clock, live = this.mode === 'play' || this.mode === 'boss' || this.mode === 'title';
    // 道を進む（決戦は湖の岸を回りつづける）
    const slow = this.mode === 'down' ? 0.3 : this.fin ? lerp(1, 0.4, sat(this.fin.t / 1.0)) : 1;
    const v = this.boss ? lerp(SPEED, ORBIT_SPEED, smoothstep(0, 6, this.boss.t)) : SPEED;
    this.s = this.rail.wrap(this.s + v * dt * slow);
    if (this.boss) this.orbit = Math.min(1, this.orbit + dt / 4.5);
    this.setFrame(dt, false);
    if (live) this.tm += dt;
    // 一日: 昼前に始まり、決戦は夕焼け、終わると宵
    const dGoal = this.mode === 'result' || (this.fin && this.fin.t > 5) ? 0.822 : this.boss ? lerp(0.745, 0.80, sat(this.boss.t / 70)) : lerp(0.24, 0.74, smoothstep(0, this.bossAt, this.tm));
    this.day += (dGoal - this.day) * ex(dt, 0.8);

    // ---- 自分
    const inp = this.auto ? this.bot() : live || this.mode === 'down' ? this.input.get(dt, P, this.hw, this.hh) : { tx: P.tx, ty: P.ty };
    if (live) { P.tx = clamp(inp.tx, -0.88, 0.88); P.ty = clamp(inp.ty, -0.82, 0.70); }
    const px = P.nx; P.nx += (P.tx - P.nx) * ex(dt, 22); P.ny += (P.ty - P.ny) * ex(dt, 22);
    P.vx += ((P.nx - px) / dt - P.vx) * ex(dt, 10);
    P.X = P.nx * this.hw; P.Y = P.ny * this.hh;
    P.inv = Math.max(0, P.inv - dt); P.hurt *= Math.exp(-dt * 4);
    P.turn += (P.turnTo - P.turn) * ex(dt, 7);
    if (now > this.moodUntil) P.mood = P.lanceT > 0 ? 'fierce' : 'smile';
    // ねらい: ユリアのすこし上にいちばん近い敵をつかまえる。つかまえた相手へ、なめらかに向きを移す
    this.lock = live && !this.fin ? this.pickLock() : null;
    { const g = this.lock, a = this.aim, e = ex(dt, 13);
      const tx = g ? g.X / this.k(g.z) / this.hw : P.nx, ty = g ? g.Y / this.k(g.z) / this.hh : P.ny + AIM_DY, tz = g ? g.z : 14;
      a.nx += (tx - a.nx) * e; a.ny += (ty - a.ny) * e; a.z += (tz - a.z) * e; }
    if (live) {
      // 光の矢（自動）
      P.fireT -= dt;
      const any = this.en.some((e) => e.t > 0 && !e.ghost && e.z < 46) || (this.boss && this.boss.t > 3.5 && !this.boss.dead);
      if (P.fireT <= 0 && any && !this.fin && P.lanceT <= 0 && !this.noFire) { P.fireT = 0.125; this.shoot(); }
      // 槍（ためて放つ光線）
      P.lance = Math.min(1, P.lance + dt / 9);
      if (P.lance >= 1 && !P.ready) { P.ready = true; this.sound.play('ready', { gain: 0.6 }); if (this.tm > 8) this.hint('ready'); }
      if (inp.lance && P.lance >= 1 && P.lanceT <= 0 && !this.fin && any && !this.noFire) { P.lance = 0; P.ready = false; P.lanceT = 1.35; this.say('lance'); this.sound.play('lance', { gain: 0.9 }); this.shake = 0.6; }
      if (P.lanceT > 0) { P.lanceT -= dt; this.lanceHit(dt); }
      // 波（弾を消し、機械を止める）
      P.waveT = Math.max(0, P.waveT - dt);
      if (P.waves < 3) { P.waveCd -= dt; if (P.waveCd <= 0) { P.waves++; P.waveCd = 22; } }
      if (inp.wave && P.waves > 0 && P.waveT <= 0 && !this.fin) this.wave();
      // 台本
      while (this.si < SCRIPT.length && this.tm >= SCRIPT[this.si][0]) SCRIPT[this.si++][1](this);
      if (!this.boss) {
        if (this.mode === 'title') { if (!this.loopAt && this.tm >= this.bossAt - 4) { this.fadeTo = 0; this.loopAt = now + 1.1; } }
        else { if (!this.warned && this.tm >= this.bossAt - 3.6) this.warn(); if (this.tm >= this.bossAt) this.bossStart(); }
      }
    }
    P.power += ((P.lanceT > 0 ? 1 : 0) - P.power) * ex(dt, 8);
    if (this.mode === 'title' && this.loopAt && now > this.loopAt) { this.reset('title'); return; }
    if (this.waveFx) { this.waveFx.t += dt; if (this.waveFx.t > 1.2) this.waveFx = null; }

    this.updEnemies(dt); if (this.boss) this.updBoss(dt);
    this.updShots(dt); this.updBullets(dt); this.updFx(dt);
    if (this.fin) this.updFinisher(dt);
    if (now - this.chainT > 2.6 && this.chain) { this.chain = 0; this.emit('chain', 0); }
  }

  // ねらえる相手: 敵・旗艦の部品（芯は装甲が外れてから）・撃ち落とせる弾
  targets() {
    const out = this.en.filter((e) => e.t > 0 && !e.ghost && e.alive);
    if (this.boss && !this.boss.dead && this.boss.t > 3.5) for (const p of this.boss.parts) if (p.alive && (p.kind !== 'core' || this.boss.phase === 2)) out.push(p);
    for (const b of this.bul) if (b.hp && !b.dead && b.z > 0.6) out.push(b);
    return out;
  }
  rad(e) { return e.T ? e.T.r : e.r; }
  pickLock() {
    const P = this.P, hw = this.hw, hh = this.hh, ax = P.nx, ay = P.ny + AIM_DY;
    let best = null, bd = 0.78 * Math.min(hh, hw * 1.2);
    for (const e of this.targets()) {
      if (e.z < 1.2 || e.z > 46) continue;
      const k = this.k(e.z), nx = e.X / k / hw, ny = e.Y / k / hh; if (Math.abs(nx) > 1.05 || Math.abs(ny) > 1.05) continue;
      let d = Math.hypot((nx - ax) * hw, (ny - ay) * hh) - this.rad(e) / k * 0.5;                 // 大きい相手は、はしに寄せるだけでもつかまる
      if (e.kind === 'missile' || e.kind === 'shell') d -= 0.07;                                  // 飛んでくる物は先に落とす
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // ねらいの先（枠の中の位置）
  aimL() { const a = this.aim, k = this.k(a.z); return [a.nx * this.hw * k, a.ny * this.hh * k, a.z]; }
  shoot() {
    const P = this.P, tip = this.tipL(), g = this.lock, kk = this.k(14);
    for (const s of [-1, 1]) this.shots.push({ X0: tip[0] + s * 0.022, Y0: tip[1], X: tip[0], Y: tip[1], z: tip[2], tg: g, Xt: P.nx * this.hw * kk, Yt: (P.ny + AIM_DY) * this.hh * kk, zt: 14, t: 0, rot: 0 });
    this.sound.play('shot', { gain: 0.3, rate: 0.96 + Math.random() * 0.1, gap: 0.2 });
  }
  hurt(e, dmg) {
    if (e.alive === false || e.dead) return;
    if (e.kind === 'core' && this.boss.phase !== 2) return;
    e.hp -= dmg; e.flash = 1;
    if (e.hp <= 0) { if (e.kind === 'shell' || e.kind === 'missile') { e.dead = true; this.boom(this.W(e.X, e.Y, e.z), 0.4); this.addScore(50); this.gem(e.X, e.Y, e.z); } else if (e.kind) this.partDown(e); else this.kill(e); }
  }
  // 槍の光線: 槍の先から、ねらいの先を通って奥へ。通り道にあるものすべてに効く
  lanceHit(dt) {
    const T0 = this.tipL(), Aa = this.aimL(), at = (z) => { const u = z / Math.max(0.5, Aa[2]); return [T0[0] + (Aa[0] - T0[0]) * u, T0[1] + (Aa[1] - T0[1]) * u]; };
    for (const e of this.targets()) { if (e.z < 0.4) continue; const q = at(e.z); if (Math.hypot(e.X - q[0], e.Y - q[1]) < this.rad(e) + 0.22 + 0.035 * e.z) this.hurt(e, 60 * dt); }
    for (const b of this.bul) { if (b.hp || b.z < 0.3) continue; const q = at(b.z); if (Math.hypot(b.X - q[0], b.Y - q[1]) < 0.25 + 0.03 * b.z) { b.dead = true; this.gem(b.X, b.Y, b.z); } }
  }
  // 波: 弾（生き物が身につけていない物）を止めて消し、機械の動きを止める。文鳥が身につけた武器は止まらない
  wave() {
    const P = this.P; P.waves--; P.waveT = 1.0; this.waveFx = { t: 0 }; this.flash = Math.max(this.flash, 0.25);
    this.say('wave'); this.sound.play('wave', { gain: 0.9 });
    for (const b of this.bul) if (b.z < 36) { b.dead = true; this.gem(b.X, b.Y, b.z); if (b.hp) this.boom(this.W(b.X, b.Y, b.z), 0.4, true); }
    for (const e of this.en) if (e.t > 0 && e.z < 30 && e.T.mesh && !e.ghost) e.stun = 3.0;
    if (this.boss) { this.boss.stun = 2.4; if (this.boss.cannon.st !== 'idle') { this.boss.cannon.st = 'idle'; this.boss.cannon.t = 6; } }
    this.emit('wave', P.waves);
  }
  gem(X, Y, z) { if (this.gems.length < 90) this.gems.push({ X, Y, z, t: 0, d: rnd(0.25) }); }
  addScore(n) { this.score += Math.round(n * (1 + Math.min(this.chain, 20) * 0.1)); }
  kill(e) {
    e.alive = false; const w = e.w || this.W(e.X, e.Y, e.z), T = e.T;
    this.chain++; this.chainT = this.clock; this.maxChain = Math.max(this.maxChain, this.chain); this.kills++;
    this.addScore(T.score); this.emit('chain', this.chain); if (this.chain === 12) this.say('chain');
    this.boom(w, T.r * 1.5); this.P.lance = Math.min(1, this.P.lance + 0.035);
    for (let i = 0; i < (T.crew ? 2 : 1); i++) this.gem(e.X + rnd(0.3, -0.3), e.Y + rnd(0.3, -0.3), e.z);
    for (let i = 0; i < T.crew; i++) this.eject(w, e.type === 'gunship' ? 1.2 : 0.6);
  }
  // 文鳥が飛ばされて、落下傘で降りていく
  eject(w, sp = 0.6, big = 1) { this.sound.play('eject', { gain: 0.5, gap: 0.3, rate: rnd(1.25, 0.9) }); this.routed++; this.fly.push({ p: [w[0] + rnd(0.3, -0.3), w[1], w[2] + rnd(0.3, -0.3)], v: [rnd(sp, -sp), 1.4 + rnd(1.0), rnd(sp, -sp)], age: 0, life: 7, v0: Math.random() < 0.5 ? 0 : 1, rot: rnd(6, -6), big, ph: rnd(6) }); }
  boom(w, size = 0.6, quiet = false) {
    const add = (o) => { if (this.parts.length < 420) this.parts.push({ age: 0, grav: 0, a: 1, ...o }); };
    add({ p: w.slice(), v: [0, 0, 0], life: 0.34, size: size * 1.5, grow: 2.2, uv: A.boom, tex: 1, add: 1, col: [1, 1, 1] });
    add({ p: w.slice(), v: [0, 0, 0], life: 0.42, size: size * 0.9, grow: 3.4, uv: A.shock, tex: 1, add: 1, col: [1, 0.9, 0.7] });
    for (let i = 0; i < 4; i++) add({ p: add3(w, [rnd(1, -1), rnd(1, -1), rnd(1, -1)], size * 0.4), v: [rnd(0.5, -0.5), rnd(0.9, 0.1), rnd(0.5, -0.5)], life: rnd(1.4, 0.8), size: size * rnd(0.9, 0.5), grow: 1.2, uv: A.smokeBig, tex: 1, add: 0, col: [1, 1, 1], a: 0.7 });
    for (let i = 0; i < 6; i++) add({ p: w.slice(), v: [rnd(3, -3) * size, rnd(3, -1) * size, rnd(3, -3) * size], life: rnd(0.7, 0.35), size: size * 0.16, grow: 0, uv: FX.spark, tex: 0, add: 1, col: [1, 0.85, 0.5], grav: 2 });
    if (size > 0.45 && this.debris.length < 90) for (let i = 0; i < Math.min(7, Math.round(size * 5)); i++) this.debris.push({ p: w.slice(), v: [rnd(2.4, -2.4), rnd(2.5, -0.5), rnd(2.4, -2.4)], age: 0, life: rnd(1.6, 0.9), ax: norm([rnd(1, -1), rnd(1, -1), rnd(1, -1)]), sp: rnd(9, 4), s: rnd(1.6, 0.7) * Math.min(1.6, size) });
    this.shake = Math.max(this.shake, Math.min(0.5, size * 0.3));
    if (!quiet) this.sound.play(size > 1 ? 'boomL' : 'boom', { gain: Math.min(0.9, 0.35 + size * 0.3), rate: rnd(1.1, 0.9), gap: 0.05 });
  }
  // 目の前（ユリアのいる面）での爆発。印の大きさの火の玉と輪だけ（煙で画面をふさがない）
  burst(X, Y, r) {
    const w = this.W(X, Y, 0.02);
    this.parts.push({ p: w, v: [0, 0, 0], age: 0, life: 0.26, size: r * 0.9, grow: 0.6, uv: A.boom, tex: 1, add: 1, col: [1, 1, 1], a: 0.9, grav: 0 });
    this.parts.push({ p: w.slice(), v: [0, 0, 0], age: 0, life: 0.3, size: r * 0.7, grow: 1.0, uv: A.shock, tex: 1, add: 1, col: [1, 0.8, 0.6], a: 0.9, grav: 0 });
    this.shake = Math.max(this.shake, 0.35); this.sound.play('boom', { gain: 0.5, rate: rnd(1.2, 1.0), gap: 0.05 });
  }
  damage() {
    const P = this.P; if (P.inv > 0 || this.fin || !(this.mode === 'play' || this.mode === 'boss')) return;
    P.shield--; P.inv = 1.7; P.hurt = 1; this.hits++; this.chain = 0; this.emit('chain', 0); this.shake = 1; this.flash = Math.max(this.flash, 0.3);
    this.sound.play('hurt', { gain: 0.9 });
    if (P.shield <= 0) { this.mode = 'down'; P.turnTo = 1; P.lanceT = 0; this.say('down'); this.emit('mode', 'down'); } else this.say(P.shield === 1 ? 'low' : 'hit');
  }

  updEnemies(dt) {
    const hw = this.hw, hh = this.hh, T = this.T;
    for (const e of this.en) {
      e.flash *= Math.exp(-dt * 10); e.fireAnim *= Math.exp(-dt * 7);
      if (e.stun > 0) { e.stun -= dt; e.roll += dt * 1.5; e.zPrev = e.z; }
      else { e.t += dt; if (e.t <= 0) continue; e.zPrev = e.z; if (!e.move(e, dt)) { e.alive = false; continue; } }
      if (e.t <= 0) continue;
      const k = this.k(e.z), X = e.XY ? e.XY[0] : e.n[0] * hw * k, Y = (e.XY ? e.XY[1] : e.n[1] * hh * k) + e.lift;
      const dX = (X - e.X) / dt, dY = (Y - e.Y) / dt, dz = (e.z - e.zPrev) / dt, first = e.w === null;
      e.X = X; e.Y = Y;
      // 地面より下へは行かない（山の中から出てくるのではなく、尾根をこえてくる）
      const w = this.W(X, Y, e.z), g = T.surfaceAt(w[0], w[2]) + e.T.r + 0.25;
      if (w[1] < g) { e.lift += (g - w[1]) * (first ? 1 : ex(dt, 6)); w[1] = g; } else e.lift *= Math.exp(-dt * 0.8);
      e.w = w;
      if (e.stun <= 0 && !first) {
        if (e.face === 'vel' && Math.abs(dz) + Math.abs(dX) > 0.5) { const d = this.dirW(dX, dY * 0.6, dz); e.fwd = norm([lerp(e.fwd[0], d[0], 0.2), lerp(e.fwd[1], d[1], 0.2), lerp(e.fwd[2], d[2], 0.2)]); e.roll += (clamp(-dX * 0.09 * Math.sign(dz || -1), -0.9, 0.9) - e.roll) * ex(dt, 4); }
        else if (e.face === 'player') { e.fwd = this.dirW(-X * 0.03, -0.05, -1); e.roll += (clamp(dX * 0.12, -0.4, 0.4) - e.roll) * ex(dt, 4); }
        if (e.fire && !e.ghost && this.mode !== 'down' && !this.fin && Math.abs(e.n[0]) < 1.05) e.fire(this, e);
      } else if (first) e.fwd = this.dirW(0, 0, e.face === 'vel' && e.z < 0 ? 1 : -1);
    }
    this.en = this.en.filter((e) => e.alive);
  }
  updShots(dt) {
    const tg = this.targets();
    for (const s of this.shots) {
      const z0 = s.z; s.z += 42 * dt; s.t += dt;
      // ねらう相手がいれば、いまの位置へ向けて進路を引き直す。いなくなったら、そのまままっすぐ
      const g = s.tg;
      if (g && g.alive !== false && !g.dead && g.z > 0.6) { s.Xt = g.X; s.Yt = g.Y; s.zt = Math.max(1.5, g.z); }
      const at = (z) => { const u = z / s.zt; return [s.X0 + (s.Xt - s.X0) * u, s.Y0 + (s.Yt - s.Y0) * u]; };
      const q = at(s.z), k0 = this.k(z0), k1 = this.k(s.z), sx = q[0] / k1 - s.X / k0, sy = q[1] / k1 - s.Y / k0;
      if (Math.abs(sx) + Math.abs(sy) > 1e-5) s.rot = Math.atan2(-sx, sy);                          // 画面の上で進んでいる向きに、矢を寝かせる
      s.X = q[0]; s.Y = q[1];
      for (const e of tg) { if (e.z < z0 - 0.5 || e.z > s.z + 0.5) continue; const p = at(e.z); if (Math.hypot(e.X - p[0], e.Y - p[1]) < this.rad(e) + 0.06 + 0.03 * e.z) { this.hurt(e, 1); s.dead = true; this.spark(this.W(p[0], p[1], e.z - 0.2), 0.05 + 0.014 * e.z); break; } }
      if (s.z > 52) s.dead = true;
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }
  spark(w, size = 0.16) { if (this.parts.length < 420) this.parts.push({ p: w, v: [0, 0, 0], age: 0, life: 0.16, size, grow: 2, uv: A.hit, tex: 1, add: 1, col: [1, 0.95, 0.7], a: 1, grav: 0 }); this.sound.play('tick', { gain: 0.3, gap: 0.07, rate: rnd(1.3, 0.9) }); }
  updBullets(dt) {
    const P = this.P;
    for (const b of this.bul) {
      const z0 = b.z; b.t += dt; if (b.flash) b.flash *= Math.exp(-dt * 10);
      if (b.kind === 'missile') {                                                  // 追いかけてくる（近づいたら、もう曲がれない）
        if (b.z > 2.2) { const tt = Math.max(0.3, b.z / -b.vz); b.vX += clamp((P.X - b.X) / tt - b.vX, -3, 3) * ex(dt, 2.2); b.vY += clamp((P.Y - b.Y) / tt - b.vY, -3, 3) * ex(dt, 2.2); }
        b.tr -= dt; if (b.tr <= 0 && this.parts.length < 420) { b.tr = 0.05; this.parts.push({ p: this.W(b.X, b.Y, b.z + 0.2), v: [0, 0.1, 0], age: 0, life: 0.55, size: 0.07, grow: 1.6, uv: A.smoke, tex: 1, add: 0, col: [1, 1, 1], a: 0.55, grav: 0 }); }
      }
      b.X += b.vX * dt; b.Y += b.vY * dt; b.z += b.vz * dt;
      if (z0 > 0 && b.z <= 0) {
        const hit = Math.hypot(b.X - P.X, b.Y - P.Y) < b.hit * this.U;
        if (b.kind === 'shell' || b.kind === 'missile') { b.dead = true; this.burst(b.X, b.Y, b.hit * this.U); }
        if (hit) { b.dead = true; this.damage(); }
      }
      if (b.z < -0.06) b.dead = true;                                             // ユリアの面を過ぎた弾は、すぐ消える（目の前で大きくなって画面をふさがない）
    }
    this.bul = this.bul.filter((b) => !b.dead);
    // 光の結晶は、ひとりでにユリアへ集まる
    for (const g of this.gems) { g.t += dt; const u = sat((g.t - g.d) / 0.7), k = u * u; g.X = lerp(g.X, P.X, k); g.Y = lerp(g.Y, P.Y, k); g.z = lerp(g.z, 0, k); if (u >= 1) { g.dead = true; this.score += 10; P.lance = Math.min(1, P.lance + 0.012); this.sound.play('gem', { gain: 0.3, gap: 0.05, rate: 1 + Math.min(this.chain, 12) * 0.04 }); } }
    this.gems = this.gems.filter((g) => !g.dead);
  }
  updFx(dt) {
    for (const p of this.parts) { p.age += dt; p.v[1] -= (p.grav || 0) * dt; p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt; }
    this.parts = this.parts.filter((p) => p.age < p.life);
    for (const d of this.debris) { d.age += dt; d.v[1] -= 3.2 * dt; d.p[0] += d.v[0] * dt; d.p[1] += d.v[1] * dt; d.p[2] += d.v[2] * dt; }
    this.debris = this.debris.filter((d) => d.age < d.life);
    for (const f of this.fly) { f.age += dt; const open = f.age > 0.7; f.v[1] += (open ? (-0.35 - f.v[1]) * ex(dt, 2.5) : -3.0 * dt); f.v[0] *= Math.exp(-dt * 1.2); f.v[2] *= Math.exp(-dt * 1.2); f.p[0] += f.v[0] * dt; f.p[1] += f.v[1] * dt; f.p[2] += f.v[2] * dt; const g = this.T.surfaceAt(f.p[0], f.p[2]) + 0.15; if (f.p[1] < g) { f.p[1] = g; f.v[1] = 0; } }
    this.fly = this.fly.filter((f) => f.age < f.life);
  }

  // ---- 旗艦のふるまい
  updBoss(dt) {
    const b = this.boss, P = this.P, B = this.bossBasis(), c0 = this.rail.loopCenter; b.t += dt;
    const kin = 1 - Math.pow(1 - sat(b.t / 5.5), 3), D = Math.hypot(c0[0] - this.fr.p[0], c0[1] - this.fr.p[2]);
    b.z = lerp(70, D, kin) + 0.8 * Math.sin(b.t * 0.21); b.X = 1.6 * Math.sin(b.t * 0.31) * kin; b.Y = 0.5 + 0.3 * Math.sin(b.t * 0.47) + (1 - kin) * 15;
    for (const p of b.parts) { p.flash *= Math.exp(-dt * 10); p.X = b.X + B.r[0] * p.off[0] + B.u[0] * p.off[1] + B.f[0] * p.off[2]; p.Y = b.Y + B.r[1] * p.off[0] + B.u[1] * p.off[1] + B.f[1] * p.off[2]; p.z = b.z + B.r[2] * p.off[0] + B.u[2] * p.off[1] + B.f[2] * p.off[2]; }
    if (b.dead) return;
    if (b.stun > 0) b.stun -= dt;
    if (b.t > 2.8 && !b.said) { b.said = 1; this.say('boss1'); }
    if (b.t < 6 || b.stun > 0 || this.mode === 'down') return;
    for (const p of b.parts) {
      if (!p.alive) continue;
      p.ft -= dt;
      if (p.kind === 'turret' && p.ft <= 0) { p.ft = b.phase === 2 ? 1.7 : 2.5; for (const s of [-1, 0, 1]) this.bullet({ kind: 'orb2', from: p, speed: 8.5, off: s * 1.1 }); this.sound.play('pew', { gain: 0.25, gap: 0.1 }); }
      if (p.kind === 'pod' && p.ft <= 0) { p.ft = b.phase === 2 ? 4.6 : 6.5; this.missile(p, 0, 0.2); this.missile(p, p.off[0] > 0 ? -0.5 : 0.5, 0.2); }
    }
    // 主砲: ねらいを定める（赤い線と輪）→ 撃つ。輪の外へ出ればよい
    const c = b.cannon, gun = b.parts[6]; c.t -= dt;
    if (gun.alive) {
      if (c.st === 'idle' && c.t <= 0) { c.st = 'charge'; c.t = 1.7; c.X = P.X; c.Y = P.Y; this.say('cannon'); this.sound.play('charge', { gain: 0.7 }); }
      else if (c.st === 'charge' && c.t <= 0) { c.st = 'fire'; c.t = 0.9; this.sound.play('cannon', { gain: 1 }); this.shake = 0.8; }
      else if (c.st === 'fire') { if (Math.hypot(P.X - c.X, P.Y - c.Y) < 0.19 * this.U) this.damage(); if (c.t <= 0) { c.st = 'idle'; c.t = b.phase === 2 ? 6.5 : 9; } }
    } else c.st = 'idle';
    // 第 2 段: 芯がむき出しになり、ユリアを囲む輪になった弾を放つ（まん中にいるか、すき間から出る）
    if (b.phase === 2) { b.ringT -= dt; if (b.ringT <= 0) { b.ringT = 3.0; const core = b.parts[7], n = 9, a0 = rnd(TAU); for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; this.bullet({ kind: 'mine', from: core, speed: 7.5, tx: Math.cos(a) * 0.3, ty: Math.sin(a) * 0.3 }); } this.sound.play('pew', { gain: 0.3, rate: 0.7 }); } }
  }
  partDown(p) {
    const b = this.boss; p.alive = false; this.boom(this.W(p.X, p.Y, p.z), p.kind === 'core' ? 2.2 : 1.0); this.addScore(p.kind === 'core' ? 10000 : 500);
    this.chain++; this.chainT = this.clock; this.maxChain = Math.max(this.maxChain, this.chain); this.emit('chain', this.chain);
    for (let i = 0; i < 3; i++) this.gem(p.X + rnd(0.5, -0.5), p.Y + rnd(0.5, -0.5), p.z);
    if (p.kind === 'turret') { this.eject(this.W(p.X, p.Y + 0.3, p.z), 1.0); if (b.parts.filter((q) => q.kind === 'turret' && q.alive).length === 0) { b.phase = 2; this.say('open'); this.flash = 0.3; } else this.say('turret'); }
    if (p.kind === 'core') { b.dead = true; this.bul.length = 0; this.fin = { t: 0 }; this.P.lanceT = 0; this.mode = 'fin'; this.emit('mode', 'fin'); this.say('fin0'); }
  }

  // ---- 決め技: 竜の姿になって、旗艦を光に返す（乗っていた文鳥はみんな脱出する）
  updFinisher(dt) {
    const f = this.fin, b = this.boss, P = this.P; f.t += dt;
    if (f.t > 1.3 && !f.s1) { f.s1 = 1; this.say('fin1'); this.flash = 0.9; this.sound.play('dragon', { gain: 1 }); }
    if (f.t > 4.9 && !f.s2) {
      f.s2 = 1; this.flash = 1; this.shake = 1; this.sound.play('boomL', { gain: 1 }); this.sound.play('finish', { gain: 0.9, delay: 0.5 });
      const w = this.W(b.X, b.Y, b.z); this.boom(w, 3.2, true);
      for (let i = 0; i < 16; i++) this.eject(add3(w, [rnd(3, -3), rnd(1, -0.5), rnd(3, -3)]), 2.2);
      this.eject(add3(w, [0, 1.6, 0]), 0.6, 2.4);                                       // 隊長
      this.say('fin2'); b.gone = true; this.addScore(5000);
      for (let i = 0; i < 40; i++) this.gem(b.X + rnd(4, -4), b.Y + rnd(2, -1), b.z + rnd(3, -3));
    }
    if (f.t > 7.2 && !f.s3) { f.s3 = 1; this.flash = 0.7; P.turnTo = 1; const tall = this.hw < this.hh; P.tx = tall ? 0 : 0.42; P.ty = tall ? 0.36 : 0.04; }
    if (f.t > 8.8 && !this.resultShown) { this.resultShown = true; this.mode = 'result'; this.say('end'); this.emit('mode', 'result'); this.emit('result', this.result()); }
  }
  // 竜の体がたどる道すじ。現れる前（tau < 0）のぶんは、ユリアの前で巻いた とぐろ（そこから体がほどけて出てくる）
  dragonPath(tau) {
    if (tau >= 0) return this.dragonAt(tau);
    const P = this.P, a = -Math.PI / 2 + 1.5 * tau;
    return [P.X + 1.2 * Math.cos(a), P.Y + 0.2 + 0.28 * tau, 4.8 + 1.2 * Math.sin(a)];
  }
  // 竜の頭の位置（枠の中）。tau: 現れてからの秒。うねりながら旗艦へ向かい、つきぬけて空へ上がる
  dragonAt(tau) {
    const P = this.P, b = this.boss, u = sat(tau / 3.5), e = u * u * (3 - 2 * u);
    const bx = b ? b.X : 0, by = b ? b.Y : 1.5, bz = b ? b.z : 14;
    if (tau < 3.6) return [lerp(P.X, bx, e) + 2.4 * Math.sin(tau * 2.1) * (1 - u) * (0.3 + u), lerp(P.Y + 0.2, by + 0.5, e) + 1.2 * Math.sin(tau * 1.5 + 0.8) * (1 - u * 0.7) * sat(tau * 2) + 1.0 * Math.sin(u * Math.PI), lerp(3.6, bz - 3.0, e)];
    const v = tau - 3.6; return [bx + 2.0 * Math.sin(v * 1.1), by + 0.5 + v * (1.2 + v * 1.4), bz - 3.0 + v * 6];
  }
  result() { const rank = this.cont ? 'B' : this.hits === 0 ? 'S' : this.hits <= 2 ? 'A' : 'B'; return { score: this.score, routed: this.routed, chain: this.maxChain, hits: this.hits, cont: this.cont, rank }; }

  // ---- 自動操縦（題の画面の見本と、確認用）。ねらいを敵に合わせつつ、赤い印からは出る
  bot() {
    const P = this.P, hw = this.hw, hh = this.hh, U = this.U;
    let gx = 0, gy = -0.3, best = 1e9;
    for (const e of this.targets()) { if (e.z < 2 || e.z > 40) continue; const k = this.k(e.z), nx = e.X / k / hw, ny = e.Y / k / hh; if (Math.abs(nx) > 0.95 || Math.abs(ny) > 0.95) continue; const sc = e.z * 0.02 + Math.hypot((nx - P.nx) * hw, (ny - AIM_DY - P.ny) * hh) - (e.hit ? 0.3 : 0); if (sc < best) { best = sc; gx = nx; gy = ny - AIM_DY; } }
    gx = clamp(gx, -0.8, 0.8) * hw; gy = clamp(gy, -0.75, 0.55) * hh;
    const c = this.boss && this.boss.cannon;
    const danger = (X, Y) => {
      let d = 0;
      for (const b of this.bul) { const tt = b.z / -b.vz; if (tt > 1.15 || tt < 0) continue; const q = Math.hypot(X - b.X - b.vX * tt, Y - b.Y - b.vY * tt), r = (b.hit + 0.055) * U; if (q < r) d += (1.3 - tt) * (1 + (r - q) / r) * 3; }
      if (c && c.st !== 'idle') { const q = Math.hypot(X - c.X, Y - c.Y) / U; if (q < 0.27) d += 8 * (1.2 - q); }
      return d;
    };
    let bx = P.X, by = P.Y, bc = 1e9;
    for (let i = 0; i <= 16; i++) for (const m of i === 16 ? [0] : [0.08 * U, 0.2 * U]) {
      const a = i / 16 * TAU, X = clamp(P.X + Math.cos(a) * m, -0.84 * hw, 0.84 * hw), Y = clamp(P.Y + Math.sin(a) * m, -0.78 * hh, 0.66 * hh);
      const cost = danger(X, Y) + Math.hypot(X - gx, Y - gy) * 0.9 + m * 0.15; if (cost < bc) { bc = cost; bx = X; by = Y; }
    }
    const here = danger(P.X, P.Y), sp = (here > 0 ? 1.7 : 1.0) * U * this.dt, dx = bx - P.tx * hw, dy = by - P.ty * hh, l = Math.hypot(dx, dy) || 1, st = Math.min(1, sp / l);
    const n = this.en.filter((e) => e.t > 0 && !e.ghost && e.z < 30).length;
    return { tx: P.tx + dx * st / hw, ty: P.ty + dy * st / hh, lance: !!this.lock && (this.mode !== 'title' ? (n >= 2 || !!this.boss || this.lock.hp > 5) : n >= 3), wave: here > 0 && bc > 2.5 && P.waves > (P.shield <= 2 ? 0 : 1) };
  }

  // ============================================================ 描く
  // 画面の形から、見える広さを決める。縦長では広い角度で写し、ユリアと当たりの大きさは左右のせまさに合わせて縮める（横長では 1）
  lens() {
    const gl = this.R.gl, asp = gl.drawingBufferWidth / Math.max(1, gl.drawingBufferHeight), port = asp < 1 ? clamp((1 - asp) / 0.55, 0, 1) : 0, focal = 1.05 * lerp(1, 0.62, port);
    this.hh = DCAM * 0.5 / focal; this.hw = this.hh * asp;
    this.U = clamp(Math.min(this.hw, this.hh * 1.2) / 0.5143, 0.72, 1);
    return focal;
  }
  view() {
    const focal = this.lens();
    const F = this.fr, ro = add3(F.p, F.f, -DCAM);
    if (this.shake > 0.01 && !this.reduced) { const a = Math.sin(this.clock * 67) * 0.012 * this.shake, b = Math.sin(this.clock * 53) * 0.012 * this.shake; for (let i = 0; i < 3; i++) ro[i] += F.r[i] * a + F.u[i] * b; }
    let ta = add3(ro, F.f);
    // 決め技: 竜が現れてから光の息を吐く前まで、カメラを横へ回して、竜の姿を横から見せる（そのあと、うしろへ戻る）
    const fin = this.fin, tau = fin ? fin.t - 1.3 : -1;
    if (fin && tau > 0 && tau < 3.6 && !this.reduced) {
      const k = ease01(tau / 0.9) * ease01((3.3 - tau) / 0.9), q = this.dragonAt(Math.max(0, tau - 0.25)), hd = this.W(q[0], q[1], q[2]);
      for (let i = 0; i < 3; i++) { ro[i] += (F.r[i] * 2.6 + F.u[i] * 0.9 + F.f[i] * 0.6) * k; ta[i] = lerp(ro[i] + F.f[i], hd[i], 0.85 * k); }
    }
    return camera(ro, ta, focal, 0);
  }
  draw() {
    const R = this.R, gl = R.gl, P = this.P, now = this.clock, B = R.batch, M = this.meshes;
    const cam = this.view(), L = daylight(this.day, now), hw = this.hw, hh = this.hh, U = this.U;
    const glare = Math.pow(sat(dot(cam.fwd, L.sun)), 3) * sat(L.e * 9 + 0.25); this.glare = lerp(this.glare ?? glare, glare, 0.06); L.exposure *= 1 - 0.34 * this.glare;
    const C = this.cast, F0 = this.fr; this.cam = cam; B.begin(cam); M.begin(); C.begin(); C.figs.begin();
    const amb = ambientTint(L), lit = [0, 1, 2].map((i) => clamp(lerp(amb[i], 1, 0.5), 0, 1));
    const glow = (w, s, col, a, bias = 0) => B.billboard(w, s, s, FX.glow, [col[0] * a, col[1] * a, col[2] * a, 0], 0, 1, 0, bias);
    const playing = this.mode === 'play' || this.mode === 'boss' || this.mode === 'title';
    if (this.mode === 'gallery') {
      this.drawGallery(cam, glow);
      const Po = R.post; Po.fade = this.fade; Po.flash = 0; Po.rush = 0; Po.bloom = 0.4;
      R.render(cam, L, { time: now * 1.25, cloudT: now * 0.016 + this.day * 1.2, yuPos: this.W(0, 0, 0), yuGlow: [0, 0, 0], tex: this.tex, shadowPasses: 2, meshes: (ctx) => { M.flush(ctx, L, cam); C.figs.flush({ ...ctx, time: now }, L, cam); } });
      return;
    }

    // ---- 遠くの編隊（背景）
    const flee = this.fin ? Math.max(0, this.fin.t - 5.0) : this.mode === 'result' ? 60 : 0;
    if (flee < 14) for (const s of this.armada) {
      const a = s.a0 + now * s.w, dir = Math.sign(s.w), c = Math.cos(a), sn = Math.sin(a), tx = -sn * dir, tz = c * dir, bank = Math.sin(now * 0.7 + s.a0 * 3 + s.side) * 0.12 - 0.25 * dir, Rr = s.R + flee * flee * 1.4 + flee * 3;
      M.draw(s.kind, matrix([c * Rr - tx * s.back + c * s.side, s.h + flee * 1.2, 34 + sn * Rr - tz * s.back + sn * s.side], flee > 0 ? [c + tx * 0.4, 0.12, sn + tz * 0.4] : [tx, 0, tz], [0, 1, 0], flee > 0 ? 0 : bank, s.s));
    }
    // ---- 敵
    for (const e of this.en) {
      if (e.t <= 0 || !e.w) continue;
      const T = e.T, fl = e.flash;
      if (T.mesh) {
        M.draw(T.mesh, matrix(e.w, e.fwd, [0, 1, 0], e.roll, T.scale), [1, 1, 1, fl * 0.3]);
        glow(add3(e.w, e.fwd, -T.r * (e.type === 'gunship' ? 1.0 : 1.2)), T.r * 0.9, [1, 0.5, 0.2], 0.55, 0.05);        // 噴射の光
        if (e.stun > 0) B.billboard(e.w, T.r * 1.5, T.r * 1.5, A.shock, [GOLD[0] * 0.5, GOLD[1] * 0.5, GOLD[2] * 0.5, 0], 1, 1, now * 2);     // 波で止まっている
        if (e.type === 'gunship') { const r = norm(cross([0, 1, 0], e.fwd)); for (const s of [-1, 1]) M.draw('turret', matrix(add3(add3(e.w, r, s * 1.0), [0, 1, 0], -0.34), e.fwd, [0, -1, 0], 0, 1.2), [1, 1, 1, fl * 0.3]); M.draw('turret', matrix(add3(e.w, [0, 1, 0], 0.3), e.fwd, [0, 1, 0], 0, 1.2), [1, 1, 1, fl * 0.3]); }
      } else {
        // マッスル文鳥（3D）。こちらを向いて浮かび、背中の噴射装置から炎を出す。撃った瞬間は、銃口が光る
        const gun = e.type === 'gunner', m = place(e.w, e.fwd || this.dirW(0, 0, -1), [0, 1, 0], BSC, BPIV, (e.roll || 0) + 0.05 * Math.sin(now * 3 + e.ph));
        C.buncho(gun ? 'gunner' : 'trooper', m, { t: now, ph: e.ph, fire: e.fireAnim, lod: 1 }, { tint: [1, 1, 1, fl * 0.4] });
        for (const sd of [-1, 1]) { const j = xf(m, [0.56 * sd, 1.7, -1.06]), fk = 1 + 0.25 * Math.sin(now * 31 + sd + e.ph); glow(j, 0.2 * fk, [1, 0.55, 0.2], 0.9, 0.02); glow(add3(j, [0, -0.1, 0]), 0.1, [1, 0.9, 0.6], 0.9, 0.02); }
        if (e.fireAnim > 0.3) glow(xf(m, gun ? [1.4, 1.3, 3.5] : [1.3, 4.05, 1.6]), (gun ? 0.3 : 0.42) * e.fireAnim, [1, 0.8, 0.4], 0.9, -0.05);
      }
    }
    // ---- 旗艦
    const b = this.boss;
    if (b && !b.gone) {
      const Bb = this.bossBasis(), F = this.fr, toW = (v) => norm([F.r[0] * v[0] + F.u[0] * v[1] + F.f[0] * v[2], F.r[1] * v[0] + F.u[1] * v[1] + F.f[1] * v[2], F.r[2] * v[0] + F.u[2] * v[1] + F.f[2] * v[2]]);
      const fw = toW(Bb.f), uw = toW(Bb.u), roll = 0.05 * Math.sin(b.t * 0.6), bw = this.W(b.X, b.Y, b.z), dying = this.fin ? sat((this.fin.t - 4.2) / 0.7) : 0;
      M.draw('flagship', matrix(bw, fw, uw, roll, BS), [1, 1, 1, dying * 0.9]);
      if (dying > 0) glow(bw, 9 * BS, [1, 0.9, 0.6], dying * 0.8, -3);
      for (const p of b.parts) {
        const w = this.W(p.X, p.Y, p.z);
        if (p.kind === 'turret' && p.alive) M.draw('turret', matrix(w, this.dirW(P.X - p.X, P.Y - p.Y, -p.z), uw, 0, 2.2 * BS), [1, 1, 1, p.flash * 0.4]);
        if (p.kind === 'core' && (p.alive || this.fin)) { const open = b.phase === 2 || b.dead, pul = 0.75 + 0.25 * Math.sin(now * 6); M.draw('core', matrix(w, fw, uw, now * 1.3, BS), open ? [1, 1, 1, p.flash * 0.5] : [0.25, 0.25, 0.3, 0]); if (open) glow(w, 1.5 * BS, [1, 0.3, 0.5], 0.5 * pul, -0.2); }
        if (!p.alive && p.kind !== 'core' && !b.dead && Math.random() < 0.25 && this.parts.length < 420) this.parts.push({ p: w, v: [rnd(0.2, -0.2), 0.5, rnd(0.2, -0.2)], age: 0, life: 0.9, size: 0.3, grow: 1.5, uv: A.smoke, tex: 1, add: 0, col: [1, 1, 1], a: 0.5, grav: 0 });
      }
      // 噴射口の光
      const rw = norm(cross(uw, fw)); for (const [x, y] of [[3.3, -0.25], [-3.3, -0.25], [4.7, 0], [-4.7, 0]]) glow(add3(add3(add3(bw, rw, x * BS), uw, y * BS), fw, -3.5 * BS), 1.1 * BS, [1, 0.5, 0.2], 0.6, 0.2);
      // 艦橋の上に立つ隊長
      const cw = add3(add3(bw, uw, 1.7 * BS), fw, -2.5 * BS), mood = b.dead ? 'shock' : b.phase === 2 ? 'shout' : 'smug', cf = sub3(cam.ro, cw);
      C.buncho(mood, place(cw, [cf[0], 0, cf[2]], uw, 0.42 * BS, [0, -0.62, 0]), { t: now, gear: 'cmd', lod: 1 }, { tint: [1, 1, 1, dying * 0.9] });
      // 主砲: ねらいの線 → 光線。当たるのは、手前の赤い輪の中
      const c = b.cannon, gun = b.parts[6];
      if (gun.alive && c.st !== 'idle' && !b.dead) {
        const m = this.W(gun.X, gun.Y, gun.z), t = this.W(c.X, c.Y, 0), dir = norm(sub3(t, m)), end = add3(t, dir, 0.35), fire = c.st === 'fire', wd = fire ? 0.17 * U : 0.012 + 0.006 * Math.sin(now * 40), a = fire ? 0.75 : 0.8;
        const side = norm(cross(dir, sub3(cam.ro, m)));
        B.quad(add3(m, side, -wd * 2.4), add3(end, side, -wd), add3(end, side, wd), add3(m, side, wd * 2.4), FX.streak, [a, 0.25 * a, 0.18 * a, 0], 0, 1);
        if (fire) { B.quad(add3(m, side, -wd), add3(end, side, -wd * 0.4), add3(end, side, wd * 0.4), add3(m, side, wd), FX.streak, [0.8, 0.7, 0.6, 0], 0, 1); glow(t, 0.3, [1, 0.5, 0.3], 0.8, 0.02); }
        glow(m, fire ? 1.6 : 0.5 + (1.7 - c.t) * 0.5, [1, 0.3, 0.2], 0.9, -0.3);
        const k = fire ? 1 : sat(1 - c.t / 1.7); this.mark(B, c.X, c.Y, 0.19 * U, 0.6 + 0.4 * k, now * 2, 1 + (1 - k) * 1.2);
      }
    }
    // ---- 弾と、着弾の予告
    for (const u of this.bul) {
      const w = this.W(u.X, u.Y, u.z), dist = u.z + DCAM, tt = u.z / -u.vz;
      const d = this.dirW(u.vX, u.vY, u.vz), fa = sat((u.z + 0.06) / 0.3);
      if (u.kind === 'missile' || u.kind === 'shell') {
        // ロケット弾・ミサイル（3D）。うしろに噴射の炎
        const sh = u.kind === 'shell', sc = (sh ? 0.36 : 0.3) * Math.max(1, 0.05 * dist) * fa, tail = add3(w, d, (sh ? -0.7 : -0.84) * sc), fk = 1 + 0.3 * Math.sin(now * 43 + u.t * 7);
        C.prop(sh ? 'rocket' : 'missile', place(w, d, [0, 1, 0], sc, Z3, sh ? now * 5 : 0), { tint: [1, 1, 1, (u.flash || 0) * 0.5] });
        glow(tail, 0.75 * sc * fk, [1, 0.5, 0.18], 0.9); glow(add3(tail, d, -0.25 * sc), 0.36 * sc, [1, 0.9, 0.6], 0.9);
      } else if (u.kind === 'mine') {
        // 機雷（3D）: ゆっくり回りながら寄ってくる、角のある黒い玉。赤い灯がまたたく
        const sc = 0.085 * Math.max(U, 0.016 * dist / u.r) * fa, a = now * 1.7 + u.t * 2 + u.X * 9;
        C.prop('mine', place(w, [Math.sin(a), 0.3, Math.cos(a)], [0.3 * Math.cos(a), 1, 0], sc));
        glow(w, sc * 1.5, [1, 0.25, 0.15], (0.35 + 0.3 * Math.sin(now * 9 + u.X * 20)) * fa, 0.01);
      } else {
        // 銃弾（3D）: 真ちゅうの弾に、底の曳光の光と、うしろへ引く光の筋
        const name = u.kind === 'orb2' ? 'slug' : u.kind === 'needle' ? 'bullet' : 'round', B0 = BUL[name], sc = B0.s * Math.max(U, 0.016 * dist / u.r) * fa, c = B0.col;
        C.prop(name, place(w, d, [0, 1, 0], sc, Z3, now * 9 + u.t * 3));
        const tail = add3(w, d, -0.5 * sc), tl = add3(tail, d, -B0.len * sc), side = norm(cross(d, sub3(cam.ro, w))), wd = B0.w * sc;
        B.quad(add3(tail, side, -wd), add3(tl, side, -wd * 0.3), add3(tl, side, wd * 0.3), add3(tail, side, wd), FX.streak, [c[0] * 0.8 * fa, c[1] * 0.8 * fa, c[2] * 0.8 * fa, 0], 0, 1);
        glow(tail, B0.g * sc, c, 0.75 * fa, 0.01);
      }
      if (tt < MARK_T && tt > 0 && playing) { const k = 1 - tt / MARK_T; this.mark(B, u.X + u.vX * tt, u.Y + u.vY * tt, u.hit * U, sat(k * 6) * (0.5 + 0.5 * k), u.kind === 'shell' ? -now * 2 : 0, 1 + 0.9 * (1 - k), u.kind !== 'shell'); }
    }
    // ---- ユリアの光の矢
    for (const s of this.shots) { const sz = clamp(0.013 * (s.z + DCAM), 0.022, 1), w = this.W(s.X, s.Y, s.z); C.prop('arrow', place(w, this.dirW(s.Xt - s.X0, s.Yt - s.Y0, s.zt), [0, 1, 0], sz * 4.4, Z3, now * 12 + s.t * 20)); B.billboard(w, sz * 0.5, sz * 1.7, A.bolt, [0.7, 0.7, 0.7, 0], 1, 1, s.rot); }
    // ---- ねらいの印: つかまえた相手のまわりに回る輪。相手がいなければ、ねらいの中心に小さな照準
    if ((this.mode === 'play' || this.mode === 'boss') && !this.fin) {
      const g = this.lock;
      if (g) { const s = Math.max(this.rad(g) * 1.35, 0.03 * (g.z + DCAM)); B.billboard(this.W(g.X, g.Y, g.z), s, s, FX.dash, [GOLD[0], GOLD[1], GOLD[2], 0], 0, 1, now * 1.6, -0.3); }
      else { const za = 13, k = this.k(za); B.billboard(this.W(P.nx * hw * k, (P.ny + AIM_DY) * hh * k, za), 0.4, 0.4, A.aim, [0.8, 0.8, 0.8, 0.8], 1, 0, now * 0.6); }
    }
    // ---- 槍の光線（槍の先から、ねらいの先をつらぬいて奥へ）
    if (P.lanceT > 0) {
      const a = sat(P.lanceT / 0.2) * sat((1.35 - P.lanceT) / 0.07), T0 = this.tipL(), Aa = this.aimL(), zs = [0.03, 0.35, 0.9, 2, 4, 8, 16, 32, 60];
      const pts = zs.map((z) => { const u = z / Math.max(0.5, Aa[2]); return this.W(T0[0] + (Aa[0] - T0[0]) * u, T0[1] + (Aa[1] - T0[1]) * u, z); });
      const sd = pts.map((p, i) => { const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)]; return norm(cross(sub3(q, o), sub3(cam.ro, p))); });
      for (const [wk, col] of [[1, [0.62, 0.42, 0.1]], [0.34, [0.8, 0.76, 0.6]]]) for (let i = 0; i + 1 < pts.length; i++) {
        const w0 = (0.022 + 0.022 * zs[i]) * wk * (1 + 0.12 * Math.sin(now * 50 + i * 2)), w1 = (0.022 + 0.022 * zs[i + 1]) * wk * (1 + 0.12 * Math.sin(now * 50 + i * 2 + 2));
        B.quad(add3(pts[i], sd[i], -w0), add3(pts[i + 1], sd[i + 1], -w1), add3(pts[i + 1], sd[i + 1], w1), add3(pts[i], sd[i], w0), FX.streak, [col[0] * a, col[1] * a, col[2] * a, 0], 0, 1, -0.2);
      }
      glow(pts[0], 0.12, [1, 0.85, 0.45], a * 0.7, -0.06);
      const hitW = this.W(Aa[0], Aa[1], Aa[2]), hs = 0.032 * (Aa[2] + DCAM) * (1 + 0.2 * Math.sin(now * 40)); glow(hitW, hs * 1.3, [1, 0.75, 0.3], a * 0.55, -0.5); B.billboard(hitW, hs, hs, A.shock, [a * 0.7, a * 0.6, a * 0.35, 0], 1, 1, now * 3, -0.5);
    }
    // ---- 波（ひろがる輪）
    if (this.waveFx) { const u = this.waveFx.t / 1.2, pw = this.W(P.X, P.Y, 0); for (let i = 0; i < 3; i++) { const q = sat(u * 1.6 - i * 0.18); if (q <= 0 || q >= 1) continue; const s = 0.2 + q * 7, a = (1 - q) * 0.9; B.billboard(add3(pw, cam.fwd, q * 6), s, s, A.shock, [GOLD[0] * a, GOLD[1] * a, GOLD[2] * a, 0], 1, 1); } }
    // ---- 光の結晶・粒・破片・落下傘の文鳥
    for (const g of this.gems) { const w = this.W(g.X, g.Y, g.z), s = Math.max(0.022, 0.011 * (g.z + DCAM)), a = now * 3.2 + g.d * 20; C.prop('gem', place(w, [Math.sin(a), 0, Math.cos(a)], [0.25 * Math.sin(a * 0.7), 1, 0.25 * Math.cos(a * 0.7)], s * 2.0)); glow(w, s * 1.7, GOLD, 0.3, 0.01); }
    for (const p of this.parts) { const u = p.age / p.life, a = (1 - u) * (p.a ?? 1), s = p.size * (1 + (p.grow || 0) * u); if (p.add) B.billboard(p.p, s, s, p.uv, [p.col[0] * a, p.col[1] * a, p.col[2] * a, 0], p.tex, 1, p.age * 2); else B.billboard(p.p, s, s, p.uv, [lit[0] * a, lit[1] * a, lit[2] * a, a], p.tex, 0, p.age); }
    for (const d of this.debris) { const c = Math.cos(d.age * d.sp), sn = Math.sin(d.age * d.sp), f = norm([d.ax[1] * c, d.ax[2] * sn + 0.2, d.ax[0] * c - sn]); M.draw('shard', matrix(d.p, f, d.ax, d.age * d.sp, d.s)); }
    for (const f of this.fly) {
      // 放り出された文鳥（3D）: はじめは手足をばたつかせて回り、落下傘がひらくと、ゆれながら降りていく
      const a = sat((f.life - f.age) / 1.2) * sat((dot(sub3(f.p, cam.ro), cam.fwd) - 2.2) / 1.6), open = sat((f.age - 0.7) / 0.4); if (a <= 0) continue;
      const sc = 0.16 * f.big * Math.min(1, a * 2.5), tc = sub3(cam.ro, f.p);
      if (open > 0.5) { const sw = 0.22 * Math.sin(now * 2.2 + f.ph); C.buncho('chute', place(f.p, [tc[0], 0, tc[2]], [sw, 1, 0.5 * sw], sc, BPIV), { t: now, ph: f.ph, lod: 2, open: sat((open - 0.5) * 2) }); }
      else { const r = f.age * f.rot; C.buncho('fall', place(f.p, [Math.sin(r), 0.3, Math.cos(r)], [Math.cos(r * 0.7), Math.sin(r * 0.7), 0.3], sc, BPIV), { t: now, ph: f.ph, lod: 2 }); }
    }
    // ---- ユリア（決め技のあいだは竜）
    const pw = this.W(P.X, P.Y, 0), fin = this.fin, tau = fin ? fin.t - 1.3 : -1, asDragon = fin && tau > 0 && fin.t < 7.2;
    if (asDragon) {
      // 竜（3D）。頭の通った道すじをさかのぼって点を取り、その上に体を並べる。現れるときは、ユリアのいた所から、とぐろをほどいて大きくなる
      const pts = []; for (let i = 0; i < 170; i++) { const q = this.dragonPath(tau - i * 0.035); pts.push(this.W(q[0], q[1], q[2])); }
      const a = sat(tau / 0.6) * sat((7.2 - fin.t) / 0.5), S = 0.34 * (0.22 + 0.78 * ease01(a)), br = b ? sat((tau - 2.9) / 0.15) * sat((3.7 - tau) / 0.15) : 0;
      const bw2 = b ? this.W(b.X, b.Y, b.z) : null, aim = b && tau > 2.3 && tau < 3.9 ? sub3(bw2, pts[0]) : null;
      const dg = C.dragon(pts, S, { t: now, jaw: Math.max(br, 0.5 * sat(1 - Math.abs(tau - 0.5) / 0.5)), look: aim }, {});
      for (let i = 0; i < 6; i++) glow(pts[i * 12], (2.0 - i * 0.2) * S / 0.34, GOLD, 0.14 * a, 0.5);
      // 光の息（旗艦を光に返す）: 口の先から
      if (br > 0 && b) { const m = dg.mouth, t = bw2, side = norm(cross(sub3(t, m), sub3(cam.ro, m))); for (const [wd, col] of [[1.1, [1, 0.75, 0.25]], [0.42, [1, 1, 0.9]]]) B.quad(add3(m, side, -wd * 0.3), add3(t, side, -wd), add3(t, side, wd), add3(m, side, wd * 0.3), FX.streak, [col[0] * br, col[1] * br, col[2] * br, 0], 0, 1); glow(m, 1.1, [1, 0.9, 0.6], br, -0.3); glow(t, 4.5, GOLD, br, -1); }
    } else {
      // ユリア（3D）。ふり向くときは手前へ寄って、大きく見せる（顔に決まった向きの光を当てる）
      const blink = P.inv > 0 && Math.floor(now * 14) % 2 === 0, tn = ease01(P.turn), zq = -0.3 * tn, kq = this.k(zq), yw = this.W(P.X * kq, P.Y * kq, zq), ga = 0.12 + 0.4 * P.power + 0.15 * L.night;
      const key = norm([-0.45 * F0.r[0] + 0.55 * F0.u[0] - 0.7 * F0.f[0], -0.45 * F0.r[1] + 0.55 * F0.u[1] - 0.7 * F0.f[1], -0.45 * F0.r[2] + 0.55 * F0.u[2] - 0.7 * F0.f[2]]);
      glow(pw, 0.3 * U, GOLD, ga * (1 - tn), 0.03);
      C.yuria(place(yw, F0.f, F0.u, HEADR * U, YPIV), { t: now, sway: clamp(P.vx * 0.5, -1, 1), power: P.lance >= 1 ? Math.max(P.power, 0.35) : P.power, turn: P.turn, mood: P.mood, wave: this.mode === 'result' ? 1 : 0, thrust: sat(P.lanceT / 0.12) * sat((1.35 - P.lanceT) / 0.4), hurt: P.hurt, aim: this.lanceDir(), lod: P.turn < 0.02 },
        { tint: [1, 1, 1, blink ? 0.13 : P.hurt * 0.2], key: [key[0], key[1], key[2], tn] });
      if (P.hurt > 0.05) glow(pw, 0.5 * U, [1, 0.3, 0.2], P.hurt * 0.8, -0.03);
      // 当たるところ（胸の水色の光。赤い印が近いときだけ、はっきり見せる）
      if (playing && P.turn < 0.5) { const near = this.bul.some((u) => u.z / -u.vz < MARK_T) || (b && b.cannon.st !== 'idle'); B.billboard(pw, 0.03 * U, 0.03 * U, A.core, [1, 1, 1, 0].map((v) => v * (near ? 1 : 0.35)), 1, 1, 0, -0.08); }
      // 槍の先の光（ためが満ちたら強く光る）
      if (P.turn < 0.5 && playing) { const tp = this.tipL(), tw = this.W(tp[0], tp[1], tp[2]); if (P.lance >= 1) glow(tw, (0.1 + 0.02 * Math.sin(now * 8)) * U, [1, 0.85, 0.4], 0.8, -0.04); else if (this.shots.length) glow(tw, 0.06 * U, [1, 0.9, 0.5], 0.7, -0.04); }
    }

    // ---- 題の画面: 手前に大きく、正面を向いたユリア
    if (this.mode === 'title' && C.ok) {
      const tall = hw < hh, zt = -0.48, kt = this.k(zt), tp = this.W((tall ? 0.26 : 0.5) * hw * kt, (tall ? -0.1 : -0.04) * hh * kt + 0.004 * Math.sin(now * 1.6), zt), tq = now % 9;
      const tf = norm([-F0.f[0] - 0.32 * F0.r[0], -F0.f[1] - 0.32 * F0.r[1], -F0.f[2] - 0.32 * F0.r[2]]), tk = norm([-0.5 * F0.r[0] + 0.5 * F0.u[0] - 0.7 * F0.f[0], -0.5 * F0.r[1] + 0.5 * F0.u[1] - 0.7 * F0.f[1], -0.5 * F0.r[2] + 0.5 * F0.u[2] - 0.7 * F0.f[2]]);
      C.yuria(place(tp, tf, F0.u, (tall ? 0.0115 : 0.0182) * U, [0, 7.3, 0]), { t: now + 3, turn: 1, still: true, mood: tq > 7.4 ? 'happy' : tq > 4.2 ? 'grin' : 'cool' }, { key: [tk[0], tk[1], tk[2], 1] });
    }
    // ---- 風景と仕上げ
    const Po = R.post; Po.fade = this.fade; Po.flash = Math.min(1, this.flash); Po.rush = 0; Po.bloom = 0.46;
    const gl2 = 0.012 + 0.12 * P.power + (asDragon ? 0.25 : 0);
    R.render(cam, L, { time: now * 1.25, cloudT: now * 0.016 + this.day * 1.2, yuPos: pw, yuGlow: [GOLD[0] * gl2, GOLD[1] * gl2, GOLD[2] * gl2], tex: this.tex, shadowPasses: 2, meshes: (ctx) => { M.flush(ctx, L, cam); C.figs.flush({ ...ctx, time: now }, L, cam); } });
  }
  // ---- 3D モデルを見る: 画面のまん中に 1 つ置いて、ゆっくり回す
  drawGallery(cam, glow) {
    const C = this.cast, F = this.fr, g = this.gal, it = GALLERY[g.i], t = g.t, hw = this.hw, hh = this.hh, tall = hw < hh, z = -0.4, k = this.k(z);
    const zk = sat((g.zoom - 1) / 0.7), zs = it.zoomTo ? lerp(1, it.zoomTo, zk) : g.zoom, piv = it.zoomPivot ? it.pivot.map((v, i) => lerp(v, it.zoomPivot[i], zk)) : it.pivot;
    const c = this.W(0, (tall ? 0.1 : -0.03) * hh * k, z), s = Math.min(hh * 1.62, hw * 1.9) * k / it.size * zs, ya = g.yaw + (it.back ? Math.PI : 0), cs = Math.cos(ya), sn = Math.sin(ya);
    const dir = (a, b) => norm([F.r[0] * a - F.f[0] * b, F.r[1] * a - F.f[1] * b, F.r[2] * a - F.f[2] * b]), f = dir(sn, cs);
    const key = norm([-0.5 * F.r[0] + 0.55 * F.u[0] - 0.7 * F.f[0], -0.5 * F.r[1] + 0.55 * F.u[1] - 0.7 * F.f[1], -0.5 * F.r[2] + 0.55 * F.u[2] - 0.7 * F.f[2]]), opt = { key: [key[0], key[1], key[2], 1] };
    const m = place(c, f, F.u, s, piv), q = t % 12;
    if (it.id === 'yuria') C.yuria(m, { t, turn: 1, still: true, wave: q > 8 ? 1 : 0, mood: q > 8 ? 'happy' : q > 4 ? 'grin' : 'smile' }, opt);
    else if (it.id === 'fly') C.yuria(m, { t, sway: Math.sin(t * 0.7) * 0.6, power: sat(Math.sin(t * 0.5) * 2 - 1), mood: 'grin' }, opt);
    else if (it.id === 'dragon') {
      // 竜: ゆるくうねる道すじを作って、その上に体を並べる（頭が手前の上、尾は奥の下へ）
      const pts = [], Sg = s * 0.9;
      for (let i = 0; i < 150; i++) { const d = i * 0.28, x = 3.4 * Math.sin(d * 0.3 + t * 1.1) * (0.25 + d / 26), y = 3.2 - d * 0.2 + 1.5 * Math.sin(d * 0.2 + t * 0.7), z = 9 - d * 0.78, X = (x * cs + z * sn) * Sg, Z = (-x * sn + z * cs) * Sg; pts.push([c[0] + F.r[0] * X + F.u[0] * y * Sg - F.f[0] * Z, c[1] + F.r[1] * X + F.u[1] * y * Sg - F.f[1] * Z, c[2] + F.r[2] * X + F.u[2] * y * Sg - F.f[2] * Z]); }
      C.dragon(pts, Sg, { t, jaw: sat(Math.sin(t * 0.8) * 2 - 0.6) }, opt);
    } else if (it.id === 'ammo') {
      const list = [['round', 1.25], ['slug', 1.3], ['bullet', 1.25], ['rocket', 1.05], ['missile', 0.9], ['mine', 1.0], ['gem', 0.85]], n = list.length, rows = tall ? [4, 3] : [n];
      let i = 0;
      rows.forEach((cnt, ri) => { for (let j = 0; j < cnt; j++, i++) {
        const [name, sc] = list[i], X = (j - (cnt - 1) / 2) * (tall ? 1.25 : 1.45) * s, Y = (rows.length > 1 ? (0.5 - ri) * 1.9 : 0) * s + 0.03 * s * Math.sin(t * 1.7 + i), a = ya + i * 0.5;
        const p = [c[0] + F.r[0] * X + F.u[0] * Y, c[1] + F.r[1] * X + F.u[1] * Y, c[2] + F.r[2] * X + F.u[2] * Y];
        C.prop(name, place(p, name === 'gem' || name === 'mine' ? dir(Math.sin(a), Math.cos(a)) : norm(dir(Math.sin(a), Math.cos(a)).map((v, ax) => v + F.u[ax] * 0.35)), F.u, s * sc), opt);
      } });
    } else {
      const mood = it.id === 'cmd' ? (q > 8 ? 'shock' : q > 4 ? 'shout' : 'smug') : it.id, fire = it.id === 'gunner' ? sat(Math.sin(t * 1.3) * 3) : it.id === 'trooper' ? Math.exp(-((t % 3.2)) * 5) : 0;
      C.buncho(mood, m, { t, fire, gear: it.id === 'cmd' ? 'cmd' : it.id, open: 1 }, opt);
      if (it.id === 'trooper' || it.id === 'gunner') for (const sd of [-1, 1]) { const j = xf(m, [0.56 * sd, 1.7, -1.06]); glow(j, 0.9 * s, [1, 0.55, 0.2], 0.8, 0.0); }
    }
  }
  // 着弾の予告: ユリアのいる面に出る赤い輪。r: 当たる半径, a: 濃さ, grow: 外から縮んでくる輪の大きさ（1 で重なる）
  mark(B, X, Y, r, a, rot = 0, grow = 1, plain = false) {
    const w = this.W(X, Y, 0.01);
    if (plain) { B.billboard(w, r * 1.25, r * 1.25, FX.glow, [RED[0] * a * 0.42, RED[1] * a * 0.42, RED[2] * a * 0.42, a * 0.3], 0, 0, 0, 0.04); B.billboard(w, r * 128 / 104, r * 128 / 104, A.shock, [RED[0] * a * 0.9, RED[1] * a * 0.9, RED[2] * a * 0.9, a * 0.55], 1, 0, 0, 0.04); }
    else B.billboard(w, r * 1.28, r * 1.28, A.mark, [a, a, a, a], 1, 0, rot, 0.04);
    if (grow > 1.02) B.billboard(w, r * grow * 1.28, r * grow * 1.28, FX.ring, [RED[0] * a * 0.3, RED[1] * a * 0.3, RED[2] * a * 0.3, 0], 0, 1, 0, 0.04);
  }
}
