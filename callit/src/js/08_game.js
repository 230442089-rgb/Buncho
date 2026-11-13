// ───────── ゲーム本体 ─────────
// 面白さの核: 彼は鞄へ歩いてくる。あなたのほうが速い。けれど、その場を動けない用事を済ませないと出られない。
//   危険と見返り = 用事を「もう少しだけ」続けるほど、彼は近づく。鞄を置けば身軽になり、彼を引き離せるが、取られたら終わり。
//   鍵をかければ時間を稼げるが、扉のうしろに立っていると抜けた錠に当たる。
// つかまっても、一度だけ硬貨が決める。
const Game = (() => {
  const G = {
    mode: 'boot', rt: 0, stage: 0, time: 0, P: null, S: null, steps: [], si: 0, extras: [], sub: null, subQ: [], ctx: null, cam: { x: 0, y: 0 },
    shakeT: 0, shakeA: 0, hitstop: 0, flash: 0, fx: [], beepT: 0, led: 0, F: null, fieldT: 0, menu: null, card: null, coin: null, intro: null,
    run: { quarter: false, loop: 0, total: 0 }, snapQuarter: false, objFlash: 0, can: null,
  };
  let vg = null, last = 0;
  const frameC = mkCanvas(W, H), fg = frameC.g, view = mkCanvas(W, VIEW_H), vw = view.g, lightBuf = mkCanvas(W, VIEW_H);
  const CALM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ── 字幕・ヒント ──
  function say(text, d) { G.sub = { text, t: d || 3 }; }
  function hint(id, text) { if (Store.d.hints[id]) return; Store.d.hints[id] = 1; Store.save(); say(text, 4); }
  function shake(a) { if (!CALM) { G.shakeA = a; G.shakeT = 0.3; } }
  function addFx(f) { G.fx.push(f); }

  // ── 彼の行き先（＝発信機のある所）と、そこからの道のり ──
  function goals() {
    const P = G.P, S = G.S;
    if (P.down || S.where === 'carried') return [[Math.floor(P.x), Math.floor(P.y)]];
    if (S.where === 'vent') return World.ventAccess(S.vent);
    return [[Math.floor(S.x), Math.floor(S.y)]];
  }
  function refield() { G.F = World.field(goals()); G.fieldT = 0.3; }

  // ── 夜のはじまり ──
  function startStage(i) {
    const def = STAGES[i];
    G.stage = i; G.snapQuarter = G.run.quarter;
    World.load(def, i);
    const m = World.marks.start;
    G.P = { x: m.x + 0.5, y: m.y + 0.5, dir: 'down', carrying: true, stamina: 1, stDelay: 0, running: false, wound: 0, down: false, moving: false, anim: 0, stepT: 0, hold: null, holdT: 0, fumble: 0, fumbleDoor: null, busy: 0, items: {}, quarter: G.run.quarter };
    G.S = { where: 'carried', x: 0, y: 0, vent: null, air: null };
    G.steps = def.steps.map(s => Object.assign({ prog: 0, done: false, tick: 0 }, s)); G.si = 0;
    G.extras = (def.extras || []).map(s => Object.assign({ prog: 0, done: false, tick: 0 }, s));
    G.can = World.marks.can ? { x: World.marks.can.x + 0.5, y: World.marks.can.y + 0.5 } : null;
    G.time = 0; G.fx = []; G.sub = null; G.subQ = def.intro.slice(); G.shakeT = 0; G.hitstop = 0; G.flash = 0; G.beepT = 0; G.led = 0; G.ctx = null; G.card = null; G.coin = null; G.menu = null;
    Anton.reset(i, G.run.loop); refield();
    Snd.setAmb(def.amb); Snd.sfx('card');
    G.mode = 'intro'; G.intro = { t: 0, d: 2.4, lines: [def.night, def.name] };
  }
  const retry = () => { G.run.quarter = G.snapQuarter; startStage(G.stage); };

  // ── あなた ──
  function moveAxis(P, dx, dy) {
    const r = 0.28, nx = P.x + dx, ny = P.y + dy;
    if (!World.blocked(nx, ny, r)) { P.x = nx; P.y = ny; return; }
    // 扉にぶつかったら開ける。自分でかけた鍵は、開けるのに少し手間どる
    const d = World.doorAt(Math.floor(P.x + Math.sign(dx) * (r + 0.12 + Math.abs(dx))), Math.floor(P.y + Math.sign(dy) * (r + 0.12 + Math.abs(dy))));
    if (!d) return;
    if (d.st === 1) { d.st = 0; Snd.sfx('door'); refield(); }
    else if (d.st === 2 && P.fumble <= 0) { P.fumble = PRM.unlockTime; P.fumbleDoor = d; Snd.sfx('unlock'); }
  }
  function updPlayer(dt) {
    const P = G.P;
    if (P.wound > 0) P.wound -= dt;
    if (P.busy > 0) { P.busy -= dt; P.moving = false; return; }
    if (P.down) { P.moving = false; return; }
    const mx = Input.mx, my = Input.my, mv = Math.hypot(mx, my) > 0.05;
    const canRun = P.wound <= 0 && (P.running ? P.stamina > 0 : P.stamina >= PRM.staminaMin);
    P.running = mv && Input.run && canRun;
    if (P.running) { P.stamina = Math.max(0, P.stamina - dt / PRM.stamina); P.stDelay = PRM.staminaDelay; }
    else if (P.stDelay > 0) P.stDelay -= dt; else P.stamina = Math.min(1, P.stamina + dt / PRM.staminaRegen);
    if (P.fumble > 0) {
      P.fumble -= dt; P.moving = false;
      if (P.fumble <= 0 && P.fumbleDoor) { if (P.fumbleDoor.st === 2) { P.fumbleDoor.st = 0; Snd.sfx('door'); refield(); } P.fumbleDoor = null; }
      return;
    }
    if (!mv) { P.moving = false; return; }
    const sp = PRM.walk * (P.carrying ? PRM.carryMul : 1) * (P.running ? PRM.runMul : 1) * (P.wound > 0 ? PRM.woundMul : 1) * World.slowAt(P.x, P.y);
    P.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
    moveAxis(P, mx * sp * dt, 0); moveAxis(P, 0, my * sp * dt);
    P.moving = true; P.anim += dt * sp * 0.95; P.hold = null; P.holdT = 0;
    P.stepT -= dt * sp; if (P.stepT <= 0) { P.stepT = P.running ? 1.9 : 1.5; Snd.step(World.surface(P.x, P.y)); }
  }

  // ── いまできること（決定ボタン）──
  function context() {
    const P = G.P, S = G.S;
    if (P.down || P.busy > 0 || P.fumble > 0) return null;
    const s = G.steps[G.si];
    if (s && s.hold && World.markDist(s.at, P.x, P.y) < 0.85 && (!s.need || P.items[s.need]) && (!s.bag || P.carrying)) return { k: 'task', s, label: s.act };
    for (const e of G.extras) if (!e.done && World.markDist(e.at, P.x, P.y) < 0.85) return { k: 'task', s: e, label: e.act };
    const v = World.ventNear(P.x, P.y);
    if (v) {
      if (P.carrying) return { k: 'stash', v, label: '鞄を 通風口に 隠す', time: PRM.stashTime };
      if (S.where === 'vent' && S.vent === v) return { k: 'pull', v, label: '鞄を 引き出す', time: PRM.pullTime };
    }
    if (World.dropNear(P.x, P.y)) return { k: 'climb', label: '欄干を 越える', time: PRM.climbTime };
    if (S.where === 'floor' && Math.hypot(S.x - P.x, S.y - P.y) < 0.95) return { k: 'pick', label: '鞄を 拾う' };
    const d = World.openDoorNear(P.x, P.y);
    if (d && !(Anton.on && Math.hypot(d.tx + 0.5 - Anton.x, d.ty + 0.5 - Anton.y) < 1.35)) return { k: 'lock', d, label: '閉めて 鍵を かける' };
    return null;
  }
  function complete(s) {
    const P = G.P;
    s.done = true; s.prog = 1;
    if (s.need) P.items[s.need] = false;
    if (s.give) P.items[s.give] = true;
    if (s.open === 'gate') { World.openGate(); refield(); say('遮断機が 上がった。', 2.5); }
    if (s.clear) { clearStage(s); return; }
    Snd.sfx('done');
    if (G.steps[G.si] !== s) return;
    G.si++; G.objFlash = 1.4;
    const n = G.steps[G.si];
    if (n && n.wait) say('車は じきに 来る。', 2.6);
    if (n && n.spawn === 'taxi') {
      const m = World.marks.taxi; World.addProp('taxi', m.x, m.y);
      World.lights.push({ x: (m.x + 1) * 16 + 8, y: (m.y + 1) * 16, r: 56, c: '#fff2c8', c2: '#3a3420', flick: false });
      Snd.sfx('horn'); say('表で クラクションが 鳴った。', 3); refield();
    }
  }
  function updActions(dt) {
    const P = G.P, S = G.S, c = G.ctx = context();
    if (c) {
      if (c.k === 'lock') hint('lock', '扉は 閉めて 鍵を かけられる。'); else if (c.k === 'stash') hint('vent', '通風口。 裏の 部屋からも 手が 届く。'); else if (c.k === 'climb') hint('rail', '越えたら、上へは 戻れない。');
      if (c.k === 'task') {
        const s = c.s;
        if (Input.act && !P.moving) { s.prog += dt / s.hold; s.tick -= dt; if (s.tick <= 0) { s.tick = 0.3; Snd.sfx(s.snd || 'task'); } if (s.prog >= 1) complete(s); }
      } else if (c.k === 'stash' || c.k === 'pull' || c.k === 'climb') {
        if (Input.act && !P.moving) {
          if (P.hold !== c.k) { P.hold = c.k; P.holdT = 0; }
          P.holdT += dt;
          if (P.holdT >= c.time) {
            P.hold = null; P.holdT = 0;
            if (c.k === 'stash') { S.where = 'vent'; S.vent = c.v; P.carrying = false; Snd.sfx('drop'); }
            else if (c.k === 'pull') { S.where = 'carried'; S.vent = null; P.carrying = true; Snd.sfx('pick'); }
            else { P.x = Math.floor(P.x) + 0.5; P.y = World.dropRow + 0.5; P.busy = 0.5; P.dir = 'down'; Snd.sfx('thud'); shake(4); }
            refield();
          }
        } else { P.hold = null; P.holdT = 0; }
      } else if (Input.actHit) {
        if (c.k === 'pick') { S.where = 'carried'; P.carrying = true; Snd.sfx('pick'); }
        else { c.d.st = 2; Snd.sfx('lock'); }
        refield();
      }
    } else if (Input.actHit) Snd.sfx('empty');
    if (Input.bagHit && !P.down && P.busy <= 0) {
      if (P.carrying) {
        P.carrying = false;
        if (World.dropNear(P.x, P.y)) { S.where = 'air'; S.air = { x0: P.x, y0: P.y, t: 0, d: 0.55 }; S.x = Math.floor(P.x) + 0.5; S.y = World.dropRow + 0.5; Snd.sfx('empty'); }
        else { S.where = 'floor'; S.x = P.x; S.y = P.y + 0.05; Snd.sfx('drop'); }
        hint('drop', '彼は 鞄へ 向かう。 取られたら 終わり。'); refield();
      } else if (S.where === 'floor' && Math.hypot(S.x - P.x, S.y - P.y) < 0.95) { S.where = 'carried'; P.carrying = true; Snd.sfx('pick'); refield(); }
      else Snd.sfx('empty');
    }
    if (S.where === 'air') { S.air.t += dt; if (S.air.t >= S.air.d) { S.where = 'floor'; S.air = null; Snd.sfx('drop'); refield(); } }
    // 押さなくても進む用事
    const s = G.steps[G.si];
    if (!s) return;
    if (s.pick && G.can && Math.hypot(G.can.x - P.x, G.can.y - P.y) < 0.85) { G.can = null; Snd.sfx('pick'); complete(s); }
    else if (s.wait) { s.prog += dt / s.wait; if (s.prog >= 1) complete(s); }
    else if (s.reach && World.markDist(s.at, P.x, P.y) < 0.75 && (!s.bag || P.carrying)) complete(s);
  }

  // ── 当たる・つかまる・終わる ──
  function hitPlayer() {
    const P = G.P;
    if (P.down || G.mode !== 'play') return;
    G.hitstop = 0.12; shake(6); G.flash = 0.16; Snd.sfx('hit');
    if (P.wound > 0) { P.down = true; P.hold = null; say('立てない。', 3); refield(); }
    else { P.wound = PRM.woundTime; hint('wound', '傷。 つぎに 当たれば 倒れる。'); }
  }
  function capture() {
    if (G.mode !== 'play') return;
    if (G.P.quarter) { die('again'); return; }
    G.mode = 'coin'; G.coin = { ph: 'ask', t: 0, call: null, res: null, win: false }; Snd.sfx('card');
  }
  const again = () => mkMenu([['もう一度', retry], ['タイトルへ', title]]);
  function die(kind) {
    G.mode = 'dead'; Snd.sfx('dead'); Snd.setAmb(null);
    G.card = { t: 0, lines: [kind === 'coin' ? '外れだった。' : kind === 'mute' ? 'あなたは 言わなかった。' : '硬貨は 一度きりだ。'], menu: again() };
  }
  function lostMoney() {
    if (G.mode !== 'play') return;
    G.mode = 'dead'; Snd.sfx('card'); Snd.setAmb(null);
    G.card = { t: 0, lines: ['鞄は 彼の 手に 渡った。', 'あなたは 生きている。', 'それだけだ。'], menu: again() };
  }
  function clearStage(s) {
    const i = G.stage, t = G.time, key = i + ':' + G.run.loop, best = Store.d.best[key], last = i === STAGES.length - 1;
    G.mode = 'clear'; if (s.end) Snd.sfx(s.end); else Snd.sfx('done'); Snd.setAmb(null);
    if (!best || t < best) Store.d.best[key] = t;
    G.run.total += t;
    if (!last) Store.d.unlocked = Math.max(Store.d.unlocked, i + 2);
    Store.save();
    const lines = last ? ['国境を 越えた。', '鞄の 中で、発信機は', 'まだ 鳴っている。', '三夜  ' + fmtTime(G.run.total)] : [STAGES[i].night + '　生還', fmtTime(t) + (best ? '　（最速 ' + fmtTime(Math.min(best, t)) + '）' : '')];
    if (G.run.quarter && !last) lines.push('25セント硬貨を 持っている。');
    G.card = { t: 0, lines, menu: mkMenu(last
      ? [['もう一巡 （彼は 少し 速い）', () => { G.run.loop++; G.run.total = 0; G.run.quarter = false; startStage(0); }], ['タイトルへ', title]]
      : [['つぎの 夜へ', () => startStage(i + 1)], ['タイトルへ', title]]) };
  }

  // ── 硬貨 ──
  function callIt(side) { const c = G.coin; if (!c || c.ph !== 'ask' || c.t < 0.5) return; c.call = side; c.res = chance(0.5) ? '表' : '裏'; c.win = c.res === side; c.ph = 'flip'; c.t = 0; Snd.sfx('coin'); }
  function updCoin(dt) {
    const c = G.coin; c.t += dt;
    if (c.ph === 'ask') { if (Input.leftHit) callIt('表'); else if (Input.rightHit) callIt('裏'); else if (c.t >= PRM.coinTime + 0.5) { c.ph = 'mute'; c.t = 0; } }
    else if (c.ph === 'flip') { if (c.t >= 1.5) { c.ph = 'show'; c.t = 0; Snd.sfx('slap'); } }
    else if (c.ph === 'show') { if (c.t >= 1.6) { c.ph = 'end'; c.t = 0; if (c.win) Snd.sfx('spare'); } }
    else if (c.ph === 'mute') { if (c.t >= 1.5) die('mute'); }
    else if (c.t >= (c.win ? 2.4 : 1.2)) {
      if (!c.win) { die('coin'); return; }
      const P = G.P;
      P.quarter = true; G.run.quarter = true; P.down = false; P.wound = 0; P.stamina = 1; Anton.spare(); G.coin = null; G.mode = 'play'; refield();
    }
  }

  // ── 画面の流れ ──
  function mkMenu(items) { return { items: items.map(it => ({ label: it[0], fn: it[1], r: null })), sel: 0 }; }
  function updMenu(m) {
    if (Input.upHit) { m.sel = (m.sel + m.items.length - 1) % m.items.length; Snd.sfx('ui'); }
    if (Input.downHit) { m.sel = (m.sel + 1) % m.items.length; Snd.sfx('ui'); }
    if (Input.actHit) { Snd.sfx('ui'); m.items[m.sel].fn(); }
  }
  function drawMenu(g, m, y, step) {
    m.items.forEach((it, i) => {
      const label = typeof it.label === 'function' ? it.label() : it.label, w = Text.width(label), x = Math.round((W - w) / 2), yy = y + i * (step || 21), on = i === m.sel;
      if (on) Text.draw(g, '▶', x - 20, yy, '#e0a030');
      Text.draw(g, label, x, yy, on ? '#f0e8d8' : '#8a8478'); it.r = [x - 26, yy - 2, w + 52, step || 21];
    });
  }
  function title() {
    G.mode = 'title'; G.card = null; G.coin = null; G.run = { quarter: false, loop: 0, total: 0 }; Snd.setAmb('desert');
    const items = [['はじめる', () => startStage(0)]];
    if (Store.d.unlocked >= 2) items.push(['二夜目から', () => startStage(1)]);
    if (Store.d.unlocked >= 3) items.push(['三夜目から', () => startStage(2)]);
    items.push(['あそびかた', help], [() => '音　' + (Snd.muted ? '切' : '入'), () => { Store.d.mute = Store.d.mute ? 0 : 1; Snd.mute(Store.d.mute); Store.save(); }]);
    G.menu = mkMenu(items);
  }
  function help() { G.mode = 'help'; G.menu = mkMenu([['もどる', title]]); }
  function pause() { G.mode = 'pause'; G.menu = mkMenu([['つづける', () => { G.mode = 'play'; }], ['この夜を やりなおす', retry], ['タイトルへ', title]]); }

  function updPlay(dt) {
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    G.time += dt;
    updPlayer(dt); updActions(dt);
    if (G.mode !== 'play') return;
    G.fieldT -= dt; if (G.fieldT <= 0) refield();
    Anton.update(dt);
    if (G.mode !== 'play') return;
    if (Anton.st === 'door') hint('bolt', '錠が 抜かれる。 扉の うしろに 立つな。'); else if (Anton.st === 'aim') hint('aim', '撃つ 直前、狙いは 止まる。 横へ。');
    // 受信機: 彼が鞄に近いほど、速く鳴る
    if (Anton.on && Anton.st !== 'spare') {
      const f = G.F[World.idx(Math.floor(Anton.x), Math.floor(Anton.y))];
      if (f < Infinity) {
        const k = clamp((f - 1.5) / (PRM.beepFar - 1.5), 0, 1);
        G.beepT -= dt;
        if (G.beepT <= 0) { G.beepT = lerp(PRM.beepFast, PRM.beepSlow, k); G.led = 0.07; Snd.sfx('beep', { v: 1 - k }); }
        else G.beepT = Math.min(G.beepT, lerp(PRM.beepFast, PRM.beepSlow, k));
      }
    }
    for (const f of G.fx) f.t += dt; G.fx = G.fx.filter(f => f.t < f.d);
    if (G.sub) { G.sub.t -= dt; if (G.sub.t <= 0) G.sub = null; } else if (G.subQ.length) say(G.subQ.shift(), 3.2);
    if (G.shakeT > 0) G.shakeT -= dt; if (G.flash > 0) G.flash -= dt; if (G.led > 0) G.led -= dt; if (G.objFlash > 0) G.objFlash -= dt;
  }
  function update(dt) {
    const m = G.mode;
    if (m === 'title' || m === 'help') updMenu(G.menu);
    else if (m === 'intro') { G.intro.t += dt; if (G.intro.t >= G.intro.d || (G.intro.t > 0.4 && Input.actHit)) G.mode = 'play'; }
    else if (m === 'play') { if (Input.pauseHit) pause(); else updPlay(dt); }
    else if (m === 'pause') { if (Input.pauseHit) G.mode = 'play'; else updMenu(G.menu); }
    else if (m === 'coin') updCoin(dt);
    else if (m === 'dead' || m === 'clear') { G.card.t += dt; if (G.card.t > 0.9) updMenu(G.card.menu); }
  }

  // ── 描く ──
  function drawDoor(g, d, cam) {
    const px = d.tx * 16 - cam.x, py = d.ty * 16 - cam.y, wood = '#6a4a2c', dark = '#2e2010', shut = d.st === 1 || d.st === 2;
    if (d.horiz) {
      if (shut) { R(g, px, py + 5, 16, 6, dark); R(g, px, py + 5, 16, 5, wood); R(g, px + 12, py + 7, 2, 2, d.st === 2 ? '#e0a030' : dark); }
      else { R(g, px, py, 3, 15, d.st === 3 ? dark : wood); if (d.st === 3) { R(g, px + 6, py + 6, 2, 2, '#0c0806'); R(g, px + 10, py + 9, 1, 1, '#0c0806'); } }
    } else if (shut) { R(g, px + 5, py, 6, 16, dark); R(g, px + 5, py, 5, 16, wood); R(g, px + 7, py + 12, 2, 2, d.st === 2 ? '#e0a030' : dark); }
    else R(g, px, py, 15, 3, d.st === 3 ? dark : wood);
  }
  function drawYou(g, cam, ghost) {
    const P = G.P, px = Math.round(P.x * 16 - 9 - cam.x), py = Math.round(P.y * 16 - 23 - cam.y);
    if (P.down) { g.save(); g.translate(px + 9, py + 23); g.rotate(-Math.PI / 2); g.drawImage(Art.you.left[0], -9, -13); g.restore(); return; }
    const fr = P.moving ? (Math.floor(P.anim) % 2 ? 1 : 2) : 0;
    if (!ghost) EL(g, px + 9, py + 25, 6, 2, '#000000', 9);
    if (P.carrying && P.dir === 'up') g.drawImage(Art.bag, px + 3, py + 13);
    g.drawImage(Art.you[P.dir][fr], px, py);
    if (P.carrying && P.dir !== 'up') g.drawImage(Art.bag, P.dir === 'left' ? px - 3 : px + 8, py + 15);
    if (P.items.can) g.drawImage(Art.can, P.dir === 'left' ? px + 10 : px - 2, py + 14);
  }
  // 画面の外にある目当てを、ふちの矢じりで示す
  function marker(g, wx, wy, col, cam) {
    const sx = wx * 16 - cam.x, sy = wy * 16 - cam.y, m = 7;
    if (sx >= 0 && sy >= 0 && sx <= W && sy <= VIEW_H) return false;
    const x = clamp(sx, m, W - m), y = clamp(sy, m, VIEW_H - m), a = Math.atan2(sy - y, sx - x), c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < 5; i++) { const w2 = 5 - i; for (let j = -w2; j <= w2; j++) R(g, x + c * i - s * j * 0.8, y + s * i + c * j * 0.8, 1.6, 1.6, i === 0 ? '#000' : col); }
    return true;
  }
  function brackets(g, x, y, w, h, c) { const n = 4; R(g, x, y, n, 1, c); R(g, x, y, 1, n, c); R(g, x + w - n, y, n, 1, c); R(g, x + w - 1, y, 1, n, c); R(g, x, y + h - 1, n, 1, c); R(g, x, y + h - n, 1, n, c); R(g, x + w - n, y + h - 1, n, 1, c); R(g, x + w - 1, y + h - n, 1, n, c); }
  function renderWorld() {
    const P = G.P, S = G.S, cam = G.cam, g = vw, mw = World.w * 16, mh = World.h * 16;
    cam.x = mw <= W ? (mw - W) / 2 : clamp(P.x * 16 - W / 2, 0, mw - W); cam.y = mh <= VIEW_H ? (mh - VIEW_H) / 2 : clamp(P.y * 16 - 6 - VIEW_H / 2, 0, mh - VIEW_H);
    if (G.shakeT > 0) { cam.x += Math.round((Math.random() * 2 - 1) * G.shakeA * G.shakeT / 0.3); cam.y += Math.round((Math.random() * 2 - 1) * G.shakeA * G.shakeT / 0.3); }
    cam.x = Math.round(cam.x); cam.y = Math.round(cam.y);
    R(g, 0, 0, W, VIEW_H, '#000'); g.drawImage(World.layer, -cam.x, -cam.y);
    for (const d of World.doors) drawDoor(g, d, cam);
    if (World.gateClosed()) for (const q of World.gateTiles()) { const px = q.tx * 16 - cam.x, py = q.ty * 16 - cam.y; for (let i = 0; i < 4; i++) R(g, px + 6, py + i * 4, 4, 4, i & 1 ? '#d8d0c0' : '#b03028'); }
    if (S.where === 'vent') { const px = S.vent.tx * 16 - cam.x, py = S.vent.ty * 16 - cam.y; R(g, px + 5, py + 9, 6, 4, '#6a4a2a'); R(g, px + 5, py + 2, 6, 3, '#6a4a2a'); }
    // 手前のものが奥のものを隠すように、足もとの高さで並べて描く
    const list = [];
    for (const p of World.props) list.push({ y: (p.y + p.h) * 16 - (p.k === 'brush' ? 2 : 0), p });
    list.push({ y: P.y * 16, you: 1 }); if (Anton.on) list.push({ y: Anton.y * 16, anton: 1 });
    if (S.where === 'floor') list.push({ y: S.y * 16 - 4, bag: 1 }); if (G.can) list.push({ y: G.can.y * 16, can: 1 });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.p) g.drawImage(it.p.spr, Math.round(it.p.x * 16 - cam.x + (it.p.w * 16 - it.p.spr.width) / 2), (it.p.y + it.p.h) * 16 - it.p.spr.height - cam.y);
      else if (it.you) drawYou(g, cam); else if (it.anton) Anton.draw(g, cam);
      else if (it.bag) g.drawImage(Art.bag, Math.round(S.x * 16 - 7 - cam.x), Math.round(S.y * 16 - 8 - cam.y));
      else g.drawImage(Art.can, Math.round(G.can.x * 16 - 5 - cam.x), Math.round(G.can.y * 16 - 9 - cam.y));
    }
    if (S.where === 'air') { const u = S.air.t / S.air.d; g.drawImage(Art.bag, Math.round(lerp(S.air.x0, S.x, u) * 16 - 7 - cam.x), Math.round(lerp(S.air.y0, S.y, u) * 16 - 8 - Math.sin(u * Math.PI) * 26 - cam.y)); }
    // 明かり。暗い夜に、灯の輪だけが見える
    const lg = lightBuf.g;
    lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.fillStyle = Art.STYLES[World.st].amb; lg.fillRect(0, 0, W, VIEW_H);
    lg.globalCompositeOperation = 'lighter';
    const spot = (cx, cy, r, c1, c2, a) => {
      if (cx < -r || cy < -r || cx > W + r || cy > VIEW_H + r) return;
      const gr = lg.createRadialGradient(cx, cy, 2, cx, cy, r); gr.addColorStop(0, c1); gr.addColorStop(0.55, c2); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.globalAlpha = a; lg.fillStyle = gr; lg.fillRect(cx - r, cy - r, r * 2, r * 2);
    };
    for (const l of World.lights) { let a = 1; if (l.flick && !CALM) { const k = Math.sin(G.rt * 9 + l.x) + Math.sin(G.rt * 23.7 + l.y); a = k > -0.7 ? 1 : 0.2; } spot(l.x - cam.x, l.y - cam.y, l.r, l.c, l.c2, a); }
    spot(P.x * 16 - cam.x, P.y * 16 - 10 - cam.y, 36, '#56566c', '#1e1e28', 1);
    for (const f of G.fx) if (f.k === 'shot') spot(f.x * 16 - cam.x, f.y * 16 - cam.y, 44, '#fff6d8', '#6a5a30', 1);
    lg.globalAlpha = 1;
    g.globalCompositeOperation = 'multiply'; g.drawImage(lightBuf.c, 0, 0); g.globalCompositeOperation = 'source-over';
    // 暗がりでも、人影だけはかすかに見える
    g.globalAlpha = 0.34; Anton.draw(g, cam, 1); g.globalAlpha = 0.3; drawYou(g, cam, true); g.globalAlpha = 1;
    // 狙い。撃つ直前に止まって、赤くなる
    if (Anton.st === 'aim') {
      const lock = Anton.t >= PRM.gunAim - PRM.gunLock, c = Math.cos(Anton.aim), s = Math.sin(Anton.aim), ox = Anton.x, oy = Anton.y - 0.3;
      for (let k = 0.8; k <= PRM.gunRange + 1.5; k += lock ? 0.12 : 0.36) { if (World.opaque(Math.floor(ox + c * k), Math.floor(oy + s * k))) break; R(g, (ox + c * k) * 16 - cam.x, (oy + s * k) * 16 - cam.y, lock ? 2 : 1, lock ? 2 : 1, lock ? '#ff5a4a' : '#d8d2c4'); }
    }
    for (const f of G.fx) {
      const u = f.t / f.d;
      if (f.k === 'shot') LN(g, f.x * 16 - cam.x, f.y * 16 - cam.y, (f.x + f.vx * f.len) * 16 - cam.x, (f.y + f.vy * f.len) * 16 - cam.y, u < 0.5 ? '#fff6d8' : '#8a8478');
      else { const k0 = f.len * Math.max(0, u - 0.3), k1 = f.len * Math.min(1, u + 0.2); LN(g, (f.x + f.vx * k0) * 16 - cam.x, (f.y + f.vy * k0) * 16 - cam.y, (f.x + f.vx * k1) * 16 - cam.x, (f.y + f.vy * k1) * 16 - cam.y, '#e8e0d0'); }
    }
    // 目当て（琥珀色）と、手から離れた鞄（緑）
    const s = G.steps[G.si], blink = Math.floor(G.rt * 3) & 1;
    if (s && s.at && World.marks[s.at]) {
      const m = World.marks[s.at];
      if (!marker(g, m.x + m.w / 2, m.y + m.h / 2, '#e0a030', cam) && blink) brackets(g, m.x * 16 - cam.x - 2, m.y * 16 - cam.y - 10, m.w * 16 + 4, m.h * 16 + 12, '#e0a030');
    }
    if (S.where !== 'carried' && S.where !== 'air') { const bx = S.where === 'vent' ? S.vent.tx + 0.5 : S.x, by = S.where === 'vent' ? S.vent.ty + 0.5 : S.y; if (!marker(g, bx, by, '#7ad890', cam) && blink) brackets(g, bx * 16 - cam.x - 10, by * 16 - cam.y - 11, 20, 16, '#7ad890'); }
    // 押しつづけている用事の進み
    const c = G.ctx, pr = c && c.k === 'task' ? c.s.prog : (P.hold && c ? P.holdT / c.time : 0);
    if (pr > 0 && pr < 1) { const bx = Math.round(P.x * 16 - 13 - cam.x), by = Math.round(P.y * 16 - 32 - cam.y); R(g, bx, by, 26, 5, '#000'); R(g, bx + 1, by + 1, Math.round(24 * pr), 3, '#e0a030'); }
    if (Anton.st === 'search') { const bx = Math.round(Anton.x * 16 - 13 - cam.x), by = Math.round(Anton.y * 16 - 32 - cam.y); R(g, bx, by, 26, 5, '#000'); R(g, bx + 1, by + 1, Math.round(24 * Anton.t / PRM.searchTime), 3, '#ff5a4a'); }
    if (G.flash > 0) { g.globalAlpha = Math.min(0.5, G.flash * 4); R(g, 0, 0, W, VIEW_H, '#a01818'); g.globalAlpha = 1; }
    if (P.wound > 0 || P.down) { g.globalAlpha = 0.16; R(g, 0, 0, W, 6, '#a01818'); R(g, 0, VIEW_H - 6, W, 6, '#a01818'); R(g, 0, 0, 6, VIEW_H, '#a01818'); R(g, W - 6, 0, 6, VIEW_H, '#a01818'); g.globalAlpha = 1; }
  }
  function drawHud(g) {
    const P = G.P, s = G.steps[G.si], y = VIEW_Y + VIEW_H + 6, c = G.ctx;
    let obj = s ? s.text : '';
    if (s && s.wait) obj += '　' + fmtTime(Math.max(0, s.wait * (1 - s.prog)) + 0.99);
    Text.draw(g, obj, 8, 7, G.objFlash > 0 && (Math.floor(G.rt * 8) & 1) ? '#ffffff' : '#b8b0a0');
    Text.draw(g, fmtTime(G.time), W - 8, 7, '#6a665c', { align: 'right' });
    if (G.sub) Text.draw(g, G.sub.text, W / 2, y, '#e8e0d0', { align: 'center' });
    else if (c) Text.draw(g, '［' + c.label + '］', W / 2, y, '#e0a030', { align: 'center' });
    R(g, 8, H - 6, 44, 3, '#26262a'); R(g, 8, H - 6, Math.round(44 * P.stamina), 3, P.wound > 0 ? '#a03030' : (P.stamina < PRM.staminaMin && !P.running ? '#55524a' : '#b8b0a0'));
    R(g, W - 14, H - 8, 6, 5, G.led > 0 ? '#ff4030' : '#3a1410');
    let ix = W - 20;
    if (P.quarter) { ix -= 11; g.drawImage(Art.quarter, ix, H - 11); } if (P.items.key) { ix -= 11; g.drawImage(Art.key, ix, H - 11); }
  }
  function centred(g, lines, y, col, step) { lines.forEach((t, i) => Text.draw(g, t, W / 2, y + i * (step || 22), col || '#d8d2c4', { align: 'center' })); }
  function drawCoin(g) {
    const c = G.coin; R(g, 0, 0, W, H, '#000');
    // 袖と、差しだされた手
    R(g, 96, 158, 128, 82, '#141c28'); R(g, 96, 158, 128, 2, '#1e2a3c'); R(g, 104, 150, 112, 8, '#0c121a');
    R(g, 112, 132, 96, 22, '#d8bea8'); R(g, 112, 132, 96, 2, '#f0dccc'); R(g, 100, 140, 14, 11, '#d8bea8'); R(g, 100, 140, 14, 2, '#f0dccc');
    for (const x of [136, 160, 184]) R(g, x, 134, 1, 12, '#b89c86');
    let cy = 122, ry = 19;
    if (c.ph === 'flip') { cy = 122 - Math.sin(c.t / 1.5 * Math.PI) * 76; ry = Math.abs(Math.cos(c.t * 21)) * 19 + 1; }
    EL(g, 160, cy, 20, ry, '#55555c'); EL(g, 160, cy - 1, 19, Math.max(0, ry - 1), '#b8b8c0'); if (ry > 6) EL(g, 160, cy - 1, 15, ry - 4, '#a0a0aa');
    if (c.ph === 'show' || c.ph === 'end') Text.draw(g, c.res, 160, cy - 17, '#26262c', { align: 'center', scale: 2 });
    if (c.ph === 'ask') {
      centred(g, ['硬貨を 投げる。', '言え。'], 30, '#e8e0d0');
      const on = Math.floor(G.rt * 3) & 1;
      Text.draw(g, '◀ 表', 44, 196, on ? '#e0a030' : '#b8b0a0'); Text.draw(g, '裏 ▶', W - 44, 196, on ? '#e0a030' : '#b8b0a0', { align: 'right' });
      R(g, 60, 226, 200, 3, '#26262a'); R(g, 60, 226, Math.round(200 * clamp(1 - (c.t - 0.5) / PRM.coinTime, 0, 1)), 3, '#b8b0a0');
    } else if (c.ph === 'mute') centred(g, ['言わないのか。'], 40, '#e8e0d0');
    else if (c.ph === 'flip' || c.ph === 'show') centred(g, ['あなた　' + c.call], 204, '#8a8478');
    else centred(g, c.win ? ['当たりだ。', '十 数える。 行け。'] : ['外れだ。'], 30, '#e8e0d0');
  }
  function render() {
    const g = fg, m = G.mode;
    R(g, 0, 0, W, H, '#000');
    if (m === 'title') {
      const ry = Math.abs(Math.cos(G.rt * 1.6)) * 13 + 1;
      EL(g, 160, 34, 14, ry, '#55555c'); EL(g, 160, 33, 13, Math.max(0, ry - 1), '#b8b8c0');
      Text.draw(g, 'CALL IT', W / 2, 58, '#e8e0d0', { align: 'center', scale: 2 });
      Text.draw(g, '表か 裏か', W / 2, 96, '#e0a030', { align: 'center' });
      drawMenu(g, G.menu, 118, 19);
      Text.draw(g, '非公式の ファンゲーム', W / 2, H - 19, '#55524a', { align: 'center' });
    } else if (m === 'help') {
      centred(g, ['鞄には 発信機が 入っている。', '彼は 鞄へ 歩いてくる。 走らない。', '用事を 済ませ、鞄を 持って 出る。', '扉は 閉めて 鍵を かけられる。', '二夜目から、見られると 撃たれる。', 'つかまると、硬貨が 決める。'], 12, '#b8b0a0', 20);
      centred(g, ['移動 方向キー / WASD　走る Shift / X', '決定 Z / Space　鞄を 置く・拾う C', '中断 Esc'], 138, '#8a8478', 19);
      drawMenu(g, G.menu, 208);
    } else if (m === 'intro') {
      const a = clamp(Math.min(G.intro.t / 0.5, (G.intro.d - G.intro.t) / 0.5), 0, 1);
      g.globalAlpha = a; Text.draw(g, G.intro.lines[0], W / 2, 92, '#e0a030', { align: 'center' }); Text.draw(g, G.intro.lines[1], W / 2, 116, '#e8e0d0', { align: 'center', scale: 2 }); g.globalAlpha = 1;
    } else if (m === 'coin') drawCoin(g);
    else if (m === 'dead' || m === 'clear') {
      const n = G.card.lines.length;
      centred(g, G.card.lines, 96 - n * 11, m === 'clear' ? '#e8e0d0' : '#b8b0a0');
      if (G.card.t > 0.9) drawMenu(g, G.card.menu, 168);
    } else {
      renderWorld(); g.drawImage(view.c, 0, VIEW_Y); drawHud(g);
      if (m === 'pause') { g.globalAlpha = 0.72; R(g, 0, VIEW_Y, W, VIEW_H, '#000'); g.globalAlpha = 1; Text.draw(g, '中断', W / 2, 62, '#e0a030', { align: 'center' }); drawMenu(g, G.menu, 96); }
    }
    FX.levels = 20; FX.desat = m === 'play' || m === 'pause' ? (G.P.down ? 0.7 : G.P.wound > 0 ? 0.35 : 0.08) : 0; FX.glitch = 0; FX.invert = false;
    postFX(g, vg);
  }
  // 画面をさわったとき（画面の中の座標）
  function pointer(x, y) {
    const m = G.mode, menu = m === 'title' || m === 'help' || m === 'pause' ? G.menu : (m === 'dead' || m === 'clear') && G.card.t > 0.9 ? G.card.menu : null;
    if (menu) { menu.items.forEach((it, i) => { if (it.r && x >= it.r[0] && y >= it.r[1] && x < it.r[0] + it.r[2] && y < it.r[1] + it.r[3]) { menu.sel = i; Snd.sfx('ui'); it.fn(); } }); return; }
    if (m === 'coin') callIt(x < W / 2 ? '表' : '裏');
    else if (m === 'intro') { if (G.intro.t > 0.4) G.mode = 'play'; }
    else if (m === 'play' && y < VIEW_Y && x > W - 60) pause();
  }
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    Input.update(); G.rt += dt;
    if (vg && G.mode !== 'boot') { update(dt); render(); }
    Input.endFrame();
    requestAnimationFrame(frame);
  }
  function init(canvas) { vg = canvas.getContext('2d'); vg.imageSmoothingEnabled = false; }
  function go() { last = performance.now(); requestAnimationFrame(frame); }
  // 試験用: 1/60 秒ぶんだけ進める（#debug のとき、外から呼ぶ）
  function sim(n) { for (let i = 0; i < n && G.mode === 'play'; i++) updPlay(1 / 60); }
  return Object.assign(G, { init, go, title, startStage, retry, say, shake, addFx, refield, hitPlayer, capture, lostMoney, pointer, callIt, sim });
})();
