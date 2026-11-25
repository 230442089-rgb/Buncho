// game.js — 飛ぶ・くぐる・一日が過ぎる。
//   ユリアは前へ飛びつづけ、こちらは「行きたい向き」を伝えるだけ。地面に近づくと自分でよけてくれる（ぶつかっても終わらない）。
import { camera } from './render.js';
import { daylight, ambientTint, clamp, sat, lerp, smoothstep, norm, cross, dot } from './sky.js';
import { buildCourse, GATE_R, CEILING } from './course.js';
import { WORLD } from './shaders.js';
import { FX, markUV, MARK_R } from './art.js';
import { SPRITE_SPAN } from './yuria.js';

const HEADR = 0.024;                       // 絵の「頭の半径 1」が世界でどれだけか（ユリアの背たけ ≒ 0.1）
const CRUISE = 2.0, FAST = 3.7;
const PITCH_MAX = 0.95;                     // 上下の向きの限度（ラジアン）。入力の上下は「この角度の何割で飛ぶか」
const hex = (h, k = 1) => [parseInt(h.slice(1, 3), 16) / 255 * k, parseInt(h.slice(3, 5), 16) / 255 * k, parseInt(h.slice(5, 7), 16) / 255 * k];
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const ex = (dt, k) => 1 - Math.exp(-dt * k);
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const GOLD = [1.0, 0.80, 0.34];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];      // 光の粒を続けて取ると、音が五音音階で上がっていく

// ユリアのことば（一人称は「あーし」。明るいギャル口調。妹たちの呼び方は決まっていないので、名前では呼ばない）
export const LINES = {
  start: [['いっしょに飛ぼ♪　行きたいほう、教えて。あーしが連れてくから！', 'grin']],
  gate: [
    ['まずは、あーしの紋章から。よゆーよゆー♪', 'grin'],
    ['いい感じ！　この調子でいこ♪', 'happy'],
    ['風、気持ちいいじゃん。', 'smile'],
    ['谷を抜けたよ。見て、湖！', 'wow'],
    ['水面すれすれ、いっちゃう？', 'wink'],
    ['半分きたよ。まだまだ、よゆー♪', 'grin'],
    ['こっから上り。しっかりついてきて！', 'smile'],
    ['高っ……でも、あーしがいるから平気だって。', 'grin'],
    ['……きれい。みんなにも、見せたいな。', 'calm'],
    ['夕やけだ。もう、こんな時間じゃん。', 'smile'],
    ['星、出てきた。……そろそろ、帰ろっか。', 'calm'],
    ['ただいま、ママ♡', 'love'],
  ],
  center: [['うける、ど真ん中じゃん！', 'happy'], ['ど真ん中♪　やるじゃん！', 'happy']],
  boost: [['いくよ、つかまってて！', 'grin'], ['とばすよ♪', 'grin']],
  bump: [['わっ……と。よゆーよゆー、平気平気。', 'oops'], ['あぶなっ。あーしは平気、そっちは？', 'oops']],
  skim: [['ひゅー、水面ぎりぎり！', 'happy']],
  miss: [['おしい！　輪のまんなか、ねらってこ。', 'smile']],
  far: [['紋章はあっち。ま、寄り道も楽しいじゃん。', 'smile']],
  edge: [['この先は雲の向こう。戻ろっか。', 'calm']],
  high: [['これより上は雲の中。このへんにしとこ。', 'calm']],
  free: [['好きなとこ、行ってみよ。どこでも付き合うよ♪', 'grin']],
  look: [['ん？　どしたの？', 'smile'], ['ちゃんとついてきてる？　えらいえらい♪', 'happy'], ['あーしの顔、見たくなった？　うける。', 'wink']],
  night: [['星、すごいじゃん……。', 'wow']],
};

export class Game {
  constructor({ T, R, input, sound, sprite, tex, hooks }) {
    this.T = T; this.R = R; this.input = input; this.sound = sound; this.sprite = sprite; this.tex = tex; this.hooks = hooks || {};
    this.course = buildCourse(T);
    this.clock = 0; this.mode = 'title'; this.paused = false; this.reduced = false; this.portrait = false;
    this.y = { pos: [0, 1, 0], yaw: 0, pitch: 0, bank: 0, speed: CRUISE, sx: 0, sy: 0, boost: 0, gauge: 1, lock: false, turn: 0, turnTo: 0, turnUntil: 0, mood: 'smile', wave: 0 };
    this.cam = { yaw: 0, pitch: 0, shake: 0, orbit: 0, ro: [0, 1, 0], focal: 1.2 };
    this.parts = []; this.trail = [[], []]; this.wind = [];
    this.fade = 0; this.fadeTo = 1; this.flash = 0;
    this.day = 0.02; this.freeDay = 0.3; this.freeFlow = true;
    this.cool = {};
    this.reset('title');
  }
  emit(name, data) { if (this.hooks[name]) this.hooks[name](data); }
  say(key, i = -1, force = false) {
    const list = LINES[key]; if (!list) return;
    const now = this.clock, gap = { gate: 0, start: 0, free: 0, look: 0, center: 6, boost: 22, bump: 5, skim: 30, miss: 8, far: 30, edge: 12, high: 14, night: 999 }[key] ?? 10;
    if (!force && this.cool[key] && now - this.cool[key] < gap) return;
    this.cool[key] = now;
    const pick = list[i >= 0 ? Math.min(i, list.length - 1) : Math.floor(Math.random() * list.length)];
    this.y.mood = pick[1]; this.moodUntil = now + 3.2;
    this.emit('say', { text: pick[0], mood: pick[1], key });
  }

  // ---- はじめる・やり直す
  reset(mode) {
    const C = this.course, y = this.y;
    C.reset();
    this.mode = mode; this.paused = false; this.auto = false;
    const st = mode === 'free' ? { p: [-1.0, 1.1, 27.0], yaw: 0.05, pitch: 0 } : C.start();
    y.pos = st.p.slice(); y.yaw = st.yaw; y.pitch = st.pitch; y.bank = 0; y.speed = CRUISE; y.sx = y.sy = 0; y.boost = 0; y.gauge = 1; y.lock = false; y.turn = 0; y.turnTo = 0; y.turnUntil = 0; y.mood = 'smile'; y.wave = 0;
    this.prev = y.pos.slice();
    this.cam.yaw = y.yaw; this.cam.pitch = y.pitch * 0.7; this.cam.orbit = 0; this.cam.shake = 0;
    this.prog = 0.5; this.botS = 0.5; this.next = 0; this.lights = 0; this.centers = 0; this.bumps = 0; this.time = 0; this.combo = 0; this.comboT = -9; this.farT = 0; this.finT = 0; this.started = false;
    this.day = mode === 'free' ? this.freeDay : C.dayAt(this.prog);
    this.parts.length = 0; this.trail = [[], []]; this.cool = {}; this.skimT = 0; this.bumpT = -9; this.moodUntil = 0;
    this.fade = 0; this.fadeTo = 1;
    this.R.shadowKey = null;
    this.emit('mode', mode);
  }
  startCourse() { this.reset('course'); this.say('start', 0, true); }
  startFree() { this.reset('free'); this.say('free', 0, true); }
  toTitle() { this.reset('title'); }
  lookBack() { if (this.mode === 'finish') return; const y = this.y; y.turnTo = 1; y.turnUntil = this.clock + 2.0; y.wave = 1; this.say('look', -1, true); this.sound.play('turn', { gain: 0.7 }); }

  // 道なりに飛ぶ（題の画面の見本と、確認用の自動操縦）
  botSteer() {
    const y = this.y, C = this.course;
    const pr = C.project(y.pos, this.botS); this.botS = Math.max(this.botS, pr.s);
    const tgt = C.at(this.botS + 1.1 + y.speed * 0.5).p;
    const dx = tgt[0] - y.pos[0], dy = tgt[1] - y.pos[1], dz = tgt[2] - y.pos[2];
    return { x: clamp(angDiff(Math.atan2(dx, dz), y.yaw) * 2.6, -1, 1), y: clamp(Math.atan2(dy, Math.hypot(dx, dz)) * 1.25 / PITCH_MAX, -1, 1), boost: false, bot: true };
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.clock += dt;
    this.fade += (this.fadeTo - this.fade) * ex(dt, 3.2);
    this.flash *= Math.exp(-dt * 5);
    if (this.paused) return;
    const y = this.y, T = this.T, C = this.course, now = this.clock;
    const playing = this.mode === 'course' || this.mode === 'free';
    let inp = this.mode === 'title' || this.auto ? this.botSteer() : this.mode === 'finish' ? { x: 0, y: 0, boost: false } : this.input.get();
    if (playing && !this.started && (inp.x || inp.y || inp.boost)) this.started = true;

    // ---- 向きと速さ
    y.sx += (inp.x - y.sx) * ex(dt, 9); y.sy += (inp.y - y.sy) * ex(dt, 7);
    const boosting = inp.boost && !y.lock && y.gauge > 0 && this.mode !== 'finish';
    if (boosting) { y.gauge = Math.max(0, y.gauge - dt / 5.5); if (y.gauge <= 0) y.lock = true; if (y.boost < 0.15) { this.say('boost'); this.sound.play('boost', { gain: 0.8, gap: 0.6 }); } }
    else { y.gauge = Math.min(1, y.gauge + dt / 10); if (y.gauge > 0.2) y.lock = false; }
    y.boost += ((boosting ? 1 : 0) - y.boost) * ex(dt, 4.5);
    y.yaw += y.sx * (1.55 - 0.3 * y.boost) * dt;
    // 上下は「入力した高さの向きへ飛ぶ」。手を離せば水平に戻る。地面が迫っていれば、そのぶん上を向く
    const CLEAR = 0.05, hx = Math.sin(y.yaw), hz = Math.cos(y.yaw);
    const look = 0.22 + y.speed * 0.16;
    const g1 = T.surfaceAt(y.pos[0] + hx * look, y.pos[2] + hz * look), g2 = T.surfaceAt(y.pos[0] + hx * look * 2.2, y.pos[2] + hz * look * 2.2);
    const need = Math.min(1.15, Math.max(Math.atan2(g1 + CLEAR + 0.03 - y.pos[1], look), Math.atan2(g2 + CLEAR + 0.03 - y.pos[1], look * 2.2)));
    let want = y.sy * PITCH_MAX;
    if (y.pos[1] > CEILING - 0.6) { want = Math.min(want, lerp(PITCH_MAX, -0.12, smoothstep(CEILING - 0.6, CEILING, y.pos[1]))); if (y.pos[1] > CEILING - 0.12 && inp.y > 0.2 && playing) this.say('high'); }
    if (need > want) y.pitch += (need - y.pitch) * ex(dt, 9); else y.pitch += (want - y.pitch) * ex(dt, 3.6);
    let v0 = lerp(CRUISE, FAST, y.boost) - Math.sin(y.pitch) * 0.7;
    if (this.mode === 'finish') v0 = lerp(CRUISE, 0.10, smoothstep(0, 1.6, this.finT));
    y.speed += (v0 - y.speed) * ex(dt, v0 > y.speed ? 2.4 : 1.2);
    y.bank += (y.sx * 0.62 - y.bank) * ex(dt, 6);

    // ---- 世界の端・高さの上限では、そっと向きを戻す
    const ox = y.pos[0] - WORLD.cx, oz = y.pos[2] - WORLD.cz;
    if (Math.abs(ox) > 72 || Math.abs(oz) > 72) { const home = Math.atan2(-ox, -oz); y.yaw += angDiff(home, y.yaw) * ex(dt, 1.4); if (playing) this.say('edge'); }

    // ---- 進む
    const cp = Math.cos(y.pitch), dir = [Math.sin(y.yaw) * cp, Math.sin(y.pitch), Math.cos(y.yaw) * cp];
    this.prev = y.pos.slice();
    y.pos = add3(y.pos, dir, y.speed * dt);
    y.pos[1] = Math.min(y.pos[1], CEILING);

    // ---- 地面と水面。当たっても「こつん」で済ませる
    const g0 = T.surfaceAt(y.pos[0], y.pos[2]);
    if (y.pos[1] < g0 + CLEAR) {
      const onWater = T.heightAt(y.pos[0], y.pos[2]) < WORLD.waterY;
      const depth = g0 + CLEAR - y.pos[1];
      y.pos[1] = g0 + CLEAR;
      if (!onWater) {
        const n = T.normalAt(y.pos[0], y.pos[2]), into = -(dir[0] * n[0] + dir[1] * n[1] + dir[2] * n[2]);
        if (into > 0.42 && now - this.bumpT > 0.9 && y.speed > 1.0) {
          // 急な斜面に正面から当たった: 向きを斜面に沿わせて、少し速さを落とす
          const d2 = [hx + n[0] * 1.6 * into, hz + n[2] * 1.6 * into]; y.yaw = Math.atan2(d2[0], d2[1]);
          y.pitch = Math.max(y.pitch, 0.45); y.speed *= 0.55; this.bumpT = now; this.bumps++;
          this.cam.shake = 1; this.say('bump'); this.sound.play('bump', { gain: 0.9 }); this.burst(y.pos, [0.9, 0.85, 0.8], 8, 0.5, FX.puff, 0.05);
          y.mood = 'oops'; this.moodUntil = now + 1.6;
        } else y.pitch = Math.max(y.pitch, Math.min(0.9, depth * 6 + 0.05));
      } else y.pitch = Math.max(y.pitch, 0.02);
    }
    // 水面すれすれ: 波紋としぶき
    if (y.pos[1] - WORLD.waterY < 0.10 && T.heightAt(y.pos[0], y.pos[2]) < WORLD.waterY - 0.02) {
      this.skimT -= dt;
      if (this.skimT <= 0) {
        this.skimT = 0.11; this.R.ripple(y.pos[0], y.pos[2], this.waveTime(), 0.9);
        for (let i = 0; i < 3; i++) this.parts.push({ p: [y.pos[0] + (Math.random() - 0.5) * 0.06, WORLD.waterY + 0.01, y.pos[2] + (Math.random() - 0.5) * 0.06], v: [(Math.random() - 0.5) * 0.5 - dir[0] * 0.3, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.5 - dir[2] * 0.3], age: 0, life: 0.55, size: 0.03 + Math.random() * 0.03, col: [0.8, 0.9, 1.0], uv: FX.puff, grav: 2.4, a: 0.5 });
        if (playing) { this.say('skim'); this.sound.play('splash', { gain: 0.35, gap: 0.7, rate: 1.2 + Math.random() * 0.3 }); }
      }
    }

    // ---- コース
    if (this.mode === 'course' || this.mode === 'title') {
      const pr = C.project(y.pos, this.prog);
      const cap = this.next < C.gates.length ? C.gates[this.next].s + 0.6 : C.total;
      if (pr.dist < 8) this.prog = clamp(Math.max(this.prog, pr.s), 0, cap);
      if (this.mode === 'course') {
        if (this.started) this.time += dt;
        this.farT = pr.dist > 9 ? this.farT + dt : 0;
        if (this.farT > 5) { this.say('far'); this.farT = 0; }
      }
      // 光の粒
      for (const m of C.motes) {
        if (m.taken || Math.abs(m.s - this.prog) > 12) continue;
        const dy = m.p[1] + 0.03 * Math.sin(now * 2.2 + m.ph) - y.pos[1];
        if ((m.p[0] - y.pos[0]) ** 2 + dy * dy + (m.p[2] - y.pos[2]) ** 2 < 0.2 * 0.2) {
          m.taken = true; m.t = now; y.gauge = Math.min(1, y.gauge + 0.045);
          if (this.mode === 'course') { this.lights++; this.combo = now - this.comboT < 1.7 ? Math.min(this.combo + 1, 11) : 0; this.comboT = now; this.sound.play('mote', { gain: 0.6, rate: Math.pow(2, PENTA[this.combo] / 12) }); this.emit('light', this.lights); }
          this.burst(m.p, [1.0, 0.86, 0.5], 5, 0.35, FX.spark, 0.03);
        }
      }
      // 輪
      const g = C.gates[this.next];
      if (g) {
        const a0 = sub3(this.prev, g.p), a1 = sub3(y.pos, g.p), da = dot(a0, g.n), db = dot(a1, g.n);
        let pass = false, cd = 9;
        if ((da < 0) !== (db < 0)) { const u = da / (da - db), q = [lerp(a0[0], a1[0], u), lerp(a0[1], a1[1], u), lerp(a0[2], a1[2], u)]; cd = len3(q); if (cd < GATE_R * 1.12) pass = true; else if (cd < GATE_R * 2.8 && this.mode === 'course') this.say('miss'); }
        if (!pass && len3(a1) < GATE_R * 0.55) { pass = true; cd = len3(a1); }
        if (pass) this.passGate(g, cd);
      } else if (this.mode === 'title' && this.prog > C.total - 3 && this.fadeTo === 1) { this.fadeTo = 0; this.titleLoop = now + 1.0; }
    }
    if (this.mode === 'title' && this.titleLoop && now > this.titleLoop) { this.titleLoop = 0; this.reset('title'); }

    // ---- 一日の進み
    if (this.mode === 'free') {
      // 夜ふけのあとは、夜明け前を通って次の朝へ（pre）。朝に着いたら一日の頭へ戻す
      if (this.freeFlow) { const before = this.freeDay; this.freeDay = (this.freeDay + dt / 150) % 1.22; if (this.freeDay < before) this.day = 0; }
      this.pre = sat((this.freeDay - 1) / 0.22);
      this.day += (Math.min(this.freeDay, 1) - this.day) * ex(dt, 2.5);
    }
    else if (this.mode === 'finish') { this.day += (1 - this.day) * ex(dt, 0.6); this.pre = 0; }
    else { this.day += (C.dayAt(this.prog) - this.day) * ex(dt, 1.4); this.pre = 0; }
    if (this.mode === 'course' && this.day > 0.93) this.say('night');

    // ---- ふり向き・表情
    if (this.mode === 'finish') { this.finT += dt; y.turnTo = this.finT > 1.0 ? 1 : 0; y.wave = this.finT > 2.0 ? 1 : 0; if (this.finT > 3.0 && !this.finShown) { this.finShown = true; this.emit('result', this.result()); } }
    else if (y.turnTo && now > y.turnUntil) { y.turnTo = 0; y.wave = 0; }
    y.turn += (y.turnTo - y.turn) * ex(dt, 7);
    if (now > this.moodUntil && this.mode !== 'finish') y.mood = y.boost > 0.5 ? 'grin' : 'smile';

    // ---- カメラ（うしろから追う。曲がるときは少し遅れてついていく）
    const c = this.cam;
    c.yaw += angDiff(y.yaw, c.yaw) * ex(dt, 4.2); c.pitch += (y.pitch * 0.72 - c.pitch) * ex(dt, 3.4);
    c.shake *= Math.exp(-dt * 6);
    if (this.mode === 'finish') c.orbit = Math.PI * smoothstep(0.2, 2.8, this.finT) + 0.22 * Math.sin(Math.max(0, this.finT - 2.8) * 0.35); else c.orbit += (0 - c.orbit) * ex(dt, 3);

    // ---- 粒
    for (const p of this.parts) { p.age += dt; p.v[1] -= (p.grav || 0) * dt; p.p[0] += p.v[0] * dt; p.p[1] += p.v[1] * dt; p.p[2] += p.v[2] * dt; }
    this.parts = this.parts.filter((p) => p.age < p.life);
    // 手の先の軌跡
    this.trailT = (this.trailT || 0) - dt;
    if (this.trailT <= 0) {
      this.trailT = 0.014;
      const f = dir, r0 = norm(cross([0, 1, 0], f)), u0 = cross(f, r0), cb = Math.cos(y.bank), sb = Math.sin(y.bank);
      const rb = [r0[0] * cb - u0[0] * sb, r0[1] * cb - u0[1] * sb, r0[2] * cb - u0[2] * sb];
      for (const s of [0, 1]) { const k = (s ? 1 : -1) * (1.62 - 0.4 * y.boost) * HEADR, tr = this.trail[s]; tr.unshift(add3(add3(y.pos, rb, k), u0, -0.2 * HEADR - 0.5 * y.boost * HEADR)); const maxLen = 0.24 + 0.2 * y.boost; let acc = 0, n = 1; while (n < tr.length && acc < maxLen) { acc += len3(sub3(tr[n], tr[n - 1])); n++; } tr.length = Math.min(n, 24); }
    }
    this.sound.setWind(sat((y.speed - 0.4) / FAST), y.boost);
  }
  waveTime() { return this.clock * 1.25; }

  passGate(g, cd) {
    const C = this.course, now = this.clock, y = this.y, last = g.k === C.gates.length - 1;
    g.passed = true; g.t = now; g.center = cd < 0.2; this.next++;
    y.gauge = Math.min(1, y.gauge + 0.4); y.lock = false;
    this.burst(g.p, hex(g.col), last ? 40 : 22, last ? 1.6 : 0.9, FX.spark, 0.06, g.n);
    this.flash = Math.max(this.flash, last ? 0.5 : 0.14);
    if (this.mode !== 'course') return;
    if (g.center) this.centers++;
    this.sound.play(last ? 'finish' : 'gate', { gain: last ? 1.0 : 0.8, rate: last ? 1 : 1 + g.k * 0.012 });
    if (g.center && !last) this.sound.play('center', { gain: 0.55, delay: 0.12 });
    this.emit('gate', { k: g.k, name: g.name, center: g.center, last });
    if (g.center && !last && g.k > 0) { this.say('center', -1, false); if (this.cool.center !== now) this.say('gate', g.k, true); } else this.say('gate', g.k, true);
    if (last) { this.mode = 'finish'; this.finT = 0; this.finShown = false; y.mood = 'love'; this.sound.setMusic(0.8, 1.5); this.emit('mode', 'finish'); }
  }
  result() { const C = this.course; return { time: this.time, lights: this.lights, totalLights: C.motes.length, centers: this.centers, gates: C.gates.length, bumps: this.bumps }; }
  burst(p, col, n, sp, uv, size, plane = null) {
    for (let i = 0; i < n; i++) {
      let v = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]; const l = len3(v) || 1; v = [v[0] / l, v[1] / l, v[2] / l];
      if (plane) { const d = dot(v, plane); v = norm(sub3(v, [plane[0] * d, plane[1] * d, plane[2] * d])); }
      const k = sp * (0.5 + Math.random());
      this.parts.push({ p: plane ? add3(p, v, GATE_R * 0.9) : p.slice(), v: [v[0] * k, v[1] * k, v[2] * k], age: 0, life: 0.5 + Math.random() * 0.5, size: size * (0.6 + Math.random() * 0.8), col, uv, grav: 0.3, a: 1, add: 1 });
    }
  }

  // ---- 描く
  view(asp) {
    const y = this.y, c = this.cam, T = this.T;
    const cp = Math.cos(y.pitch), dir = [Math.sin(y.yaw) * cp, Math.sin(y.pitch), Math.cos(y.yaw) * cp];
    const port = asp < 1 ? clamp((1 - asp) / 0.55, 0, 1) : 0;                 // 縦長の画面では視野を広げ、少し寄る
    const fin = this.mode === 'finish' ? smoothstep(0.2, 2.8, this.finT) : 0;
    const D = lerp(lerp(0.50, 0.62, y.boost), 0.40, fin) * lerp(1, 0.86, port), cy = c.yaw + c.orbit, cpi = lerp(c.pitch, 0.13, fin), ccp = Math.cos(cpi);
    const back = [Math.sin(cy) * ccp, Math.sin(cpi), Math.cos(cy) * ccp];
    const ro = [y.pos[0] - back[0] * D, y.pos[1] - back[1] * D + lerp(0.13, 0.0, fin), y.pos[2] - back[2] * D];
    if (c.shake > 0.01 && !this.reduced) { ro[0] += Math.sin(this.clock * 61) * 0.012 * c.shake; ro[1] += Math.sin(this.clock * 47) * 0.012 * c.shake; }
    ro[1] = Math.max(ro[1], T.surfaceAt(ro[0], ro[2]) + 0.075);
    const ahead = lerp(0.95, 0, fin), ta = [y.pos[0] + dir[0] * ahead, y.pos[1] + dir[1] * ahead + lerp(0.07, 0.03, fin), y.pos[2] + dir[2] * ahead];
    if (fin > 0) {
      // 結果の板に重ならないよう、ユリアを横長の画面では右寄り、縦長の画面では上寄りに置く
      const side = [Math.cos(cy), 0, -Math.sin(cy)], k = fin * fin * (1 - port) * 0.085;
      ta[0] -= side[0] * k; ta[2] -= side[2] * k; ta[1] -= fin * fin * port * 0.075;
    }
    const focal = lerp(1.2, 1.02, this.reduced ? 0 : y.boost) * lerp(1, 0.6, port);
    return camera(ro, ta, focal, this.reduced ? 0 : -y.bank * 0.2 * (1 - fin));
  }

  draw() {
    const R = this.R, gl = R.gl, y = this.y, C = this.course, now = this.clock, B = R.batch;
    const asp = gl.drawingBufferWidth / gl.drawingBufferHeight;
    const L = daylight(this.day, now, this.pre || 0), cam = this.view(asp);
    // 太陽のほうを向くと、目が慣れるように少し絞る（輪や地形が白く飛ばないように）
    const glare = Math.pow(sat(dot(cam.fwd, L.sun)), 3) * sat(L.e * 9 + 0.25);
    this.glare = lerp(this.glare ?? glare, glare, 0.06);
    L.exposure *= 1 - 0.34 * this.glare;
    this.camNow = cam; this.L = L;
    B.begin(cam);
    const night = L.night, amb = ambientTint(L);
    const dist = (p) => len3(sub3(p, cam.ro));

    // ---- 輪
    if (this.mode === 'course' || this.mode === 'title' || this.mode === 'finish') {
      C.gates.forEach((g, i) => {
        const col = hex(g.col), Rg = norm(cross([0, 1, 0], g.n)), Ug = cross(g.n, Rg), d = dist(g.p);
        if (d > 70) return;
        if (g.passed) {
          const u = (now - g.t) / 0.8; if (u >= 1) return;
          const s = GATE_R * (1 + 1.6 * u) / FX.RING_R, a = (1 - u) * (1 - u);
          B.oriented(g.p, Rg, Ug, s, s, FX.ring, [col[0] * a, col[1] * a, col[2] * a, 0], 0, 1);
          return;
        }
        const k = i - this.next, a = k === 0 ? 1 : k === 1 ? 0.55 : 0.26, pulse = k === 0 ? 1 + 0.035 * Math.sin(now * 4.2) : 1;
        const s = GATE_R * pulse / FX.RING_R;
        B.oriented(g.p, Rg, Ug, s, s, FX.ring, [col[0] * a * 1.15, col[1] * a * 1.15, col[2] * a * 1.15, 0], 0, 1);
        const ms = GATE_R * 0.56 / MARK_R, ma = a * smoothstep(0.7, 2.6, d);
        B.oriented(g.p, Rg, Ug, ms, ms, markUV(g.mark), [ma, ma, ma, 0], 1, 1, 0.01);
        if (k === 0) {
          const an = now * 0.5, cr = Math.cos(an), sr = Math.sin(an), R2 = add3([Rg[0] * cr, Rg[1] * cr, Rg[2] * cr], Ug, sr), U2 = add3([-Rg[0] * sr, -Rg[1] * sr, -Rg[2] * sr], Ug, cr);
          const ds = GATE_R * 1.26 / (116 / 128);
          B.oriented(g.p, R2, U2, ds, ds, FX.dash, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8, 0], 0, 1);
          // 遠くからでも場所がわかる光の柱
          const hr = norm([cam.right[0], 0, cam.right[2]]), bh = 3.6, ba = 0.42 * smoothstep(2.0, 9.0, d);
          if (ba > 0.01) B.oriented(add3(g.p, [0, 1, 0], bh + GATE_R), hr, [0, 1, 0], 0.24, bh, FX.beam, [col[0] * ba, col[1] * ba, col[2] * ba, 0], 0, 1);
        }
      });
      // ---- 光の粒
      let shown = 0;
      for (const m of C.motes) {
        if (m.s < this.prog - 3 || m.s > this.prog + 46) continue;
        if (m.taken) continue;
        if (++shown > 70) break;
        const p = [m.p[0], m.p[1] + 0.03 * Math.sin(now * 2.2 + m.ph), m.p[2]], tw = 0.8 + 0.2 * Math.sin(now * 5 + m.ph * 3);
        const a = tw * smoothstep(46, 30, m.s - this.prog) * smoothstep(0.18, 0.55, dot(sub3(p, cam.ro), cam.fwd));     // カメラのすぐ前では消す（大きく光りすぎるので）
        B.billboard(p, 0.062, 0.062, FX.glow, [1.0 * a, 0.80 * a, 0.42 * a, 0], 0, 1);
        B.billboard(p, 0.034, 0.034, FX.spark, [a, 0.95 * a, 0.8 * a, 0], 0, 1, now * 0.8 + m.ph);
      }
    }
    // ---- 粒（しぶき・きらめき）
    for (const p of this.parts) {
      const u = p.age / p.life, a = (1 - u) * (p.a ?? 1), s = p.size * (0.6 + 0.8 * u);
      if (p.add) B.billboard(p.p, s, s, p.uv, [p.col[0] * a, p.col[1] * a, p.col[2] * a, 0], 0, 1, p.age * 3);
      else B.billboard(p.p, s, s, p.uv, [p.col[0] * a * amb[0], p.col[1] * a * amb[1], p.col[2] * a * amb[2], a * 0.9], 0, 0);
    }
    // ---- 風の筋（速いほど長く、はっきり）
    const cp = Math.cos(y.pitch), dir = [Math.sin(y.yaw) * cp, Math.sin(y.pitch), Math.cos(y.yaw) * cp];
    const wa = sat((y.speed - 1.4) / 2.2) * (this.reduced ? 0.3 : 0.75);
    if (this.wind.length < 34) for (let i = this.wind.length; i < 34; i++) this.wind.push({ p: [0, -99, 0], seed: Math.random() });
    for (const w of this.wind) {
      const rel = sub3(w.p, cam.ro), z = dot(rel, cam.fwd), x = dot(rel, cam.right), yv = dot(rel, cam.up);
      if (z < 0.15 || z > 7.5 || Math.abs(x) > 2.6 || Math.abs(yv) > 1.8) {
        const zz = 2.5 + Math.random() * 4.5, xx = (Math.random() - 0.5) * 4.4, yy = (Math.random() - 0.5) * 3.0;
        w.p = [cam.ro[0] + cam.fwd[0] * zz + cam.right[0] * xx + cam.up[0] * yy, cam.ro[1] + cam.fwd[1] * zz + cam.right[1] * xx + cam.up[1] * yy, cam.ro[2] + cam.fwd[2] * zz + cam.right[2] * xx + cam.up[2] * yy];
        continue;
      }
      if (wa < 0.02) continue;
      const len = 0.03 + y.speed * 0.05, side = norm(cross(dir, sub3(cam.ro, w.p))), wd = 0.0035 + 0.002 * w.seed, a = wa * (0.25 + 0.5 * w.seed) * smoothstep(0.15, 0.9, z) * smoothstep(7.5, 5.0, z);
      const p0 = add3(w.p, dir, -len), p1 = add3(w.p, dir, len);
      B.quad(add3(p0, side, -wd), add3(p1, side, -wd), add3(p1, side, wd), add3(p0, side, wd), FX.streak, [a * 0.9, a * 0.95, a, 0], 0, 1);
    }
    // ---- 手の先の軌跡
    const ta = 0.35 + 0.65 * y.boost;
    for (const tr of this.trail) for (let i = 0; i + 1 < tr.length; i++) {
      const a0 = (1 - i / tr.length), a1 = (1 - (i + 1) / tr.length), p0 = tr[i], p1 = tr[i + 1];
      const zv = dot(sub3(p1, cam.ro), cam.fwd);                       // カメラのすぐ前まで来た部分は消す（大きく写りすぎるので）
      const side = norm(cross(sub3(p1, p0), sub3(cam.ro, p0))), w0 = 0.011 * a0 + 0.002, w1 = 0.011 * a1 + 0.002, a = ta * a0 * a0 * 0.8 * smoothstep(0.2, 0.42, zv);
      if (a < 0.004) continue;
      B.quad(add3(p0, side, -w0), add3(p1, side, -w1), add3(p1, side, w1), add3(p0, side, w0), FX.streak, [GOLD[0] * a, GOLD[1] * a, GOLD[2] * a, 0], 0, 1);
    }
    // ---- ユリア
    // 絵の描き直しは毎秒 40 回まで（髪や服の動きはそれで十分なめらか）
    if (this.spriteT === undefined || now - this.spriteT > 1 / 40 || now < this.spriteT) { this.spriteT = now; this.sxk = this.sprite.draw({ t: now, sway: clamp(-y.sx * 0.9, -1, 1), boost: y.boost, pitch: clamp((y.pitch - this.cam.pitch) * 2.2, -1, 1), turn: y.turn, mood: y.mood, wave: y.wave }); R.g.updateCanvas(this.tex[2], this.sprite.cv); }
    const sxk = this.sxk;
    const half = SPRITE_SPAN * 0.5 * HEADR;
    // 夜でも沈まないよう、ユリア自身が少し光っているぶんを足す（結びでこちらを向いたときは、もう少し明るく）
    const lit = 0.42 + 0.10 * night + 0.22 * (this.mode === 'finish' ? smoothstep(0.8, 2.6, this.finT) : 0);
    const tint = [0, 1, 2].map((i) => clamp(lerp(amb[i], 1, lit) * (0.92 + 0.10 * night), 0, 1));
    const ga = 0.20 + 0.16 * y.boost + 0.22 * night;
    B.billboard(y.pos, 0.2, 0.2, FX.glow, [GOLD[0] * ga, GOLD[1] * ga, GOLD[2] * ga, 0], 0, 1, 0, 0.02);
    B.billboard(y.pos, half * sxk, half, [0, 0, 1, 1], [tint[0], tint[1], tint[2], 1], 2, 0, y.turn > 0.5 ? 0 : y.bank * 0.9, -0.02);

    // ---- 風景と仕上げ
    const P = R.post;
    P.fade = this.fade; P.flash = this.flash; P.rush = this.reduced ? 0 : y.boost * 0.6; P.bloom = 0.46 + 0.08 * y.boost;
    const glow = 0.010 + 0.05 * night + 0.02 * y.boost;
    R.render(cam, L, { time: this.waveTime(), cloudT: now * 0.016 + this.day * 1.2, yuPos: y.pos, yuGlow: [GOLD[0] * glow, GOLD[1] * glow, GOLD[2] * glow], tex: this.tex, shadowPasses: 2 });
  }

  // つぎの輪が画面のどこにあるか（HUD の目印用）。{ x, y: 0..1, on: 画面内か, ang: 画面外なら矢印の向き, dist }
  target() {
    const C = this.course, g = C.gates[this.next], VP = this.R.VP;
    if (!g || !VP || this.mode !== 'course') return null;
    const p = g.p, x = VP[0] * p[0] + VP[4] * p[1] + VP[8] * p[2] + VP[12], yy = VP[1] * p[0] + VP[5] * p[1] + VP[9] * p[2] + VP[13], w = VP[3] * p[0] + VP[7] * p[1] + VP[11] * p[2] + VP[15];
    const d = len3(sub3(p, this.y.pos));
    if (w > 0.05 && Math.abs(x / w) < 0.9 && Math.abs(yy / w) < 0.86) return { on: true, x: x / w * 0.5 + 0.5, y: 0.5 - yy / w * 0.5, dist: d };
    const s = w > 0 ? 1 : -1; let dx = x * s, dy = yy * s; if (w <= 0.05 && Math.abs(dx) < 1e-3 && Math.abs(dy) < 1e-3) dx = 1; const l = Math.hypot(dx, dy) || 1;
    return { on: false, ang: Math.atan2(-dy / l, dx / l), x: 0.5 + 0.42 * dx / l, y: 0.5 - 0.40 * dy / l, dist: d };
  }
}
