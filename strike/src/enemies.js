// enemies.js — B.U.N の編成。敵の種類、動き方、撃ち方、そして「いつ・どこから・何が来るか」の台本。
//   動きは「画面の中のどこにいるか」（nx, ny: -1..1。0 がまん中）と、何単位先にいるか（z）で書く。
//   画面が縦長でも横長でも同じ台本で、ちゃんと画面の中に現れる。
import { DCAM } from './rail.js';

const TAU = Math.PI * 2, lerp = (a, b, k) => a + (b - a) * k, sat = (x) => Math.min(1, Math.max(0, x)), io = (x) => x * x * (3 - 2 * x);

//          体力  当たりの半径  点   文鳥の数（脱出してくる）
export const TYPES = {
  drone:   { hp: 3,  r: 0.32, score: 100,  mesh: 'drone',   scale: 1.5, crew: 0 },
  fighter: { hp: 10, r: 0.58, score: 300,  mesh: 'fighter', scale: 1.0, crew: 1 },
  trooper: { hp: 14, r: 0.42, score: 250,  sprite: 'trooper', crew: 1 },
  gunner:  { hp: 16, r: 0.42, score: 300,  sprite: 'gatling', crew: 1 },
  gunship: { hp: 150, r: 1.15, score: 2000, mesh: 'gunship', scale: 1.0, crew: 3 },
};

// ---- 動き。e.n = [nx, ny], e.z を毎フレーム決める。戻り値 false で退場
const MOVES = {
  // 正面から来て、近づいたら画面の外へそれていく（体当たりはしてこない）
  pass(e, dt) {
    const o = e.o, T = o.z0 / o.speed, p = sat(e.t / T), k = io(p);
    e.z = o.z0 - o.speed * e.t;
    let x = lerp(o.from[0], o.to[0], k) + (o.wob ? o.wob[0] * Math.sin(e.t * o.wob[2] + e.ph) : 0);
    let y = lerp(o.from[1], o.to[1], k) + (o.wob ? o.wob[1] * Math.cos(e.t * o.wob[2] * 0.8 + e.ph) : 0);
    const u = sat(1 - e.z / 8);
    if (u > 0) { const sx = Math.abs(o.to[0]) > 0.2 ? Math.sign(o.to[0]) : (e.ph > Math.PI ? 1 : -1), q = u * u * 2.6; x += sx * q; y += 0.5 * q; }
    e.n[0] = x; e.n[1] = y; e.face = 'vel';
    return e.z > -0.5;
  },
  // 画面の外から入ってきて、前方にとどまり、しばらくしたら上へ去る
  hover(e, dt) {
    const o = e.o, tin = 1.3, tout = 1.5, hold = o.hold ?? 8;
    if (e.t < tin) { const k = 1 - Math.pow(1 - e.t / tin, 3); e.n[0] = lerp(o.from[0], o.at[0], k); e.n[1] = lerp(o.from[1], o.at[1], k); e.z = o.z + (1 - k) * 8; }
    else if (e.t < tin + hold) { const u = e.t - tin, s = o.strafe ?? 0.25; e.n[0] = o.at[0] + s * Math.sin(u * 0.9 + e.ph); e.n[1] = o.at[1] + s * 0.45 * Math.sin(u * 1.3 + e.ph * 2); e.z = o.z + 0.7 * Math.sin(u * 0.7 + e.ph); e.active = true; }
    else { const k = io(sat((e.t - tin - hold) / tout)); e.n[0] = o.at[0] * (1 + 0.6 * k); e.n[1] = lerp(o.at[1], 1.9, k); e.z = o.z + k * 12; e.active = false; if (k >= 1) return false; }
    e.face = 'player';
    return true;
  },
  // うしろから両わきを追いこしていく（撃ってはこない。「来た」という合図）
  over(e, dt) {
    const o = e.o; e.z = -1.3 + o.speed * e.t; e.XY = [o.from[0] * 1.75, 0.5 + 0.035 * Math.max(0, e.z)]; e.face = 'vel';
    return e.z < 60;
  },
};

// ---- 撃ち方（弾は、撃った瞬間にユリアがいた場所へ飛ぶ。着く 1 秒前から、そこに赤い印が出る）
export function fireAimed(G, e, o = {}) { G.bullet({ kind: o.kind || 'orb', from: e, speed: o.speed ?? 8, spread: o.spread || 0, off: o.off || 0 }); }
const FIRE = {
  drone(G, e) { for (const z of [26, 14]) if (e.zPrev > z && e.z <= z) fireAimed(G, e, { speed: 10 }); },
  fighter(G, e) {
    if (e.zPrev > 30 && e.z <= 30) e.burst = 3;
    if (e.burst > 0 && (e.bt = (e.bt || 0) - G.dt) <= 0) { e.burst--; e.bt = 0.16; fireAimed(G, e, { kind: 'needle', speed: 13, spread: 0.07 }); }
    if (e.zPrev > 16 && e.z <= 16) for (const s of [-1, 0, 1]) fireAimed(G, e, { speed: 10, off: s });
  },
  trooper(G, e) { if (!e.active) return; e.ft = (e.ft ?? 1.0) - G.dt; if (e.ft <= 0) { e.ft = 2.8; e.fireAnim = 1; G.shell(e); } },
  gunner(G, e) {
    if (!e.active) return;
    e.ft = (e.ft ?? 1.4) - G.dt;
    if (e.ft <= 0) { e.ft = 3.2; e.burst = 6; }
    if (e.burst > 0 && (e.bt = (e.bt || 0) - G.dt) <= 0) { e.burst--; e.bt = 0.12; e.fireAnim = 1; G.bullet({ kind: 'needle', from: e, dx: -0.28, dy: -0.28, speed: 9.5, spread: 0.17 }); }
  },
  gunship(G, e) {
    if (!e.active) return;
    e.ft = (e.ft ?? 1.5) - G.dt; e.mt = (e.mt ?? 3.0) - G.dt;
    if (e.ft <= 0) { e.ft = 1.8; e.side = -(e.side || 1); for (const s of [-1, 0, 1]) G.bullet({ kind: 'orb2', from: e, dx: e.side * 1.0, speed: 8, off: s }); }
    if (e.mt <= 0) { e.mt = 4.8; for (const s of [-1, 1]) G.missile(e, s * 1.0); }
  },
};

export function makeEnemy(G, type, move, o) {
  const T = TYPES[type];
  return { type, T, hp: T.hp, o, move: MOVES[move], fire: FIRE[type], t: -(o.delay || 0), n: [o.from[0], o.from[1]], z: o.z0 ?? 60, zPrev: 99, X: 0, Y: 0, lift: 0, ph: Math.random() * TAU, flash: 0, stun: 0, alive: true, roll: 0, fwd: [0, 0, -1], w: null, burst: 0, fireAnim: 0, active: false };
}

// ---- 台本。[時刻（秒）, その瞬間にすること]
const P = (G, type, from, to, extra = {}) => G.spawn(type, 'pass', { from, to, z0: 48, speed: type === 'fighter' ? 12.5 : 10.5, ...extra });
const H = (G, type, from, at, extra = {}) => G.spawn(type, 'hover', { from, at, z: 6.5, hold: 8, ...extra });
const vee = (G, type, cx, cy, n, sp = 0.2, extra = {}) => { for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2; P(G, type, [cx + k * sp * 0.6, cy + Math.abs(k) * 0.1 + 0.2], [cx + k * sp, cy - Math.abs(k) * 0.08], { delay: Math.abs(k) * 0.22, ...extra }); } };
const line = (G, type, x0, x1, y, n, extra = {}) => { for (let i = 0; i < n; i++) { const k = n > 1 ? i / (n - 1) : 0.5; P(G, type, [lerp(x0, x1, k) * 0.5, y + 0.3], [lerp(x0, x1, k), y], { delay: i * 0.3, ...extra }); } };
const swirl = (G, type, n, r, extra = {}) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; P(G, type, [Math.cos(a) * r * 0.3, 0.2 + Math.sin(a) * r * 0.3], [Math.cos(a + 2.2) * r, 0.1 + Math.sin(a + 2.2) * r * 0.8], { delay: i * 0.28, wob: [0.06, 0.06, 3], ...extra }); } };

// 旗艦が来るのは、道が湖の岸の周回に入ったとき（およそ 104 秒。game.js が道の長さから決める）
export const SCRIPT = [
  [2.5, (G) => { for (const x of [-0.7, 0.7]) G.spawn('fighter', 'over', { from: [x, 0.75], speed: 16, delay: x > 0 ? 0.3 : 0 }); G.say('start'); }],
  [5.0, (G) => vee(G, 'drone', 0, 0.15, 5)],
  [9.0, (G) => line(G, 'drone', -0.7, 0.5, 0.3, 5)],
  [12.5, (G) => { P(G, 'fighter', [-0.3, 0.6], [0.5, 0.1]); P(G, 'fighter', [0.3, 0.6], [-0.5, 0.0], { delay: 0.8 }); }],
  [16.5, (G) => { line(G, 'drone', 0.7, -0.4, 0.45, 4); line(G, 'drone', -0.6, 0.3, -0.1, 4, { delay: 1.2 }); }],
  [21.0, (G) => { H(G, 'trooper', [-1.5, 0.4], [-0.5, 0.25]); H(G, 'trooper', [1.5, 0.5], [0.5, 0.35], { delay: 0.8 }); G.hint('bazooka'); }],
  [27.0, (G) => { for (let i = 0; i < 3; i++) P(G, 'fighter', [(i - 1) * 0.25, 0.7], [(i - 1) * 0.6, 0.1 + 0.1 * (i % 2)], { delay: i * 0.7 }); }],
  [31.5, (G) => swirl(G, 'drone', 8, 0.6)],
  // 湖の上
  [37.0, (G) => { H(G, 'gunner', [-1.5, 0.1], [-0.55, 0.1]); H(G, 'gunner', [1.5, 0.5], [0.55, 0.45], { delay: 1.0 }); vee(G, 'drone', 0, 0.5, 4, 0.22, { delay: 2 }); G.hint('gunner'); }],
  [44.0, (G) => { P(G, 'fighter', [-0.5, 0.7], [-0.7, 0.2]); P(G, 'fighter', [-0.3, 0.8], [-0.3, -0.05], { delay: 0.3 }); P(G, 'fighter', [0.5, 0.7], [0.7, 0.3], { delay: 1.4 }); P(G, 'fighter', [0.3, 0.8], [0.3, 0.0], { delay: 1.7 }); }],
  [48.5, (G) => { G.spawn('gunship', 'hover', { from: [0.2, 1.9], at: [0.0, 0.5], z: 8.5, hold: 15, strafe: 0.4 }); G.say('gunship'); }],
  [52.0, (G) => line(G, 'drone', -0.8, -0.2, -0.05, 4)],
  [57.0, (G) => line(G, 'drone', 0.8, 0.2, 0.0, 4)],
  [64.0, (G) => { H(G, 'trooper', [-1.5, 0.6], [-0.6, 0.4], { hold: 7 }); H(G, 'trooper', [1.5, 0.1], [0.6, 0.15], { hold: 7, delay: 0.5 }); H(G, 'gunner', [0, 1.8], [0.0, 0.6], { hold: 7, delay: 1.2 }); }],
  [70.0, (G) => { for (let i = 0; i < 3; i++) P(G, 'fighter', [0.6 - i * 0.6, 0.75], [-0.6 + i * 0.6, 0.15], { delay: i * 0.6 }); swirl(G, 'drone', 6, 0.5, { delay: 2.2 }); }],
  // 山の上
  [76.5, (G) => { vee(G, 'drone', -0.3, 0.3, 5); vee(G, 'drone', 0.35, 0.4, 5, 0.2, { delay: 1.6 }); }],
  [81.0, (G) => { G.spawn('gunship', 'hover', { from: [-0.3, 1.9], at: [0.1, 0.55], z: 8.5, hold: 13, strafe: 0.45 }); H(G, 'trooper', [-1.5, 0.2], [-0.65, 0.1], { hold: 9, delay: 2 }); H(G, 'trooper', [1.5, 0.3], [0.65, 0.2], { hold: 9, delay: 2.6 }); }],
  [91.0, (G) => { for (let i = 0; i < 5; i++) { const k = i - 2; P(G, 'fighter', [k * 0.12, 0.8], [k * 0.36, 0.2 + Math.abs(k) * 0.1], { delay: Math.abs(k) * 0.45 }); } }],
  [96.5, (G) => { swirl(G, 'drone', 8, 0.65); H(G, 'gunner', [-1.5, 0.5], [-0.5, 0.45], { hold: 6, delay: 1 }); H(G, 'gunner', [1.5, 0.4], [0.5, 0.3], { hold: 6, delay: 1.5 }); }],
];
export { DCAM };
