// ───────── アントン・シガー ─────────
// 彼は走らない。鞄へ、まっすぐ歩いてくる。鍵のかかった扉は、圧縮空気のボルト銃で錠ごと抜く。
// 二夜目からは、見通しのいい所に長くいる者を撃つ。構えてから撃つまでに間があり、撃つ直前に狙いは動かなくなる。
//   wait まだ着いていない → walk 歩く → door 錠を抜く / search 通風口を調べる / aim 構える / recover 撃ったあと / spare 十数えている
const Anton = (() => {
  const A = { on: false, st: 'wait', t: 0, x: 0, y: 0, dir: 'left', speed: 2.5, gun: false, next: null, door: null, vent: null, seeT: 0, aim: 0, anim: 0, pause: 0, arriveT: 0, sees: false, pumped: false, count: 0 };
  const DIR4 = [[1, 0, 'right'], [-1, 0, 'left'], [0, 1, 'down'], [0, -1, 'up']], DV = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] };
  const KAZU = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  const doorCost = d => (d ? (d.st === 2 ? 7 : d.st === 1 ? 0.7 : 0) : 0);
  const faceTo = (dx, dy) => { A.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); };

  function reset(stage, loop) {
    A.on = false; A.st = 'wait'; A.t = 0; A.next = null; A.door = null; A.vent = null; A.seeT = 0; A.pause = 0; A.anim = 0; A.sees = false;
    A.speed = PRM.antonSpeed[stage] * Math.pow(PRM.loopMul, loop); A.gun = STAGES[stage].gun; A.arriveT = PRM.arrive[stage];
    const m = World.marks.anton; A.x = m.x + 0.5; A.y = m.y + 0.5; A.dir = 'left';
  }
  function arrive() {
    A.on = true; A.st = 'walk';
    const s = World.marks.sedan;
    if (s) { World.addProp('sedan', s.x, s.y); World.lights.push({ x: (s.x + 3) * 16 + 6, y: (s.y + 1) * 16 + 6, r: 54, c: '#fff2c8', c2: '#3a3420', flick: false }); }
    Snd.sfx('car'); Game.say('車が 停まる 音。', 2.6); Game.refield();
  }
  // 抜けた錠は、扉の向こうへまっすぐ飛ぶ。扉のうしろに立っていると当たる
  function boltFire() {
    const d = A.door, v = DV[A.dir], ox = d.tx + 0.5, oy = d.ty + 0.5, P = Game.P;
    d.st = 3; A.st = 'walk'; A.pause = 0.4; Snd.sfx('bolt'); Game.shake(5); Game.refield();
    let len = 0;
    for (let k = 1; k <= PRM.boltRange; k++) { if (World.opaque(Math.floor(ox + v[0] * k), Math.floor(oy + v[1] * k))) break; len = k; }
    Game.addFx({ k: 'cyl', x: ox, y: oy, vx: v[0], vy: v[1], len, t: 0, d: 0.2 });
    const rx = P.x - ox, ry = P.y - oy, along = rx * v[0] + ry * v[1], perp = Math.abs(rx * v[1] - ry * v[0]);
    if (along > 0.2 && along <= len + 0.5 && perp < 0.6) Game.hitPlayer(); else Snd.sfx('cyl');
  }
  function fire() {
    const P = Game.P, vx = Math.cos(A.aim), vy = Math.sin(A.aim), ox = A.x, oy = A.y - 0.3;
    let len = 0;
    for (let k = 0.3; k <= PRM.gunRange + 1.5; k += 0.2) { if (World.opaque(Math.floor(ox + vx * k), Math.floor(oy + vy * k))) break; len = k; }
    const rx = P.x - ox, ry = P.y - 0.3 - oy, along = rx * vx + ry * vy, perp = Math.abs(rx * vy - ry * vx);
    Snd.sfx('shot'); Game.shake(4);
    Game.addFx({ k: 'shot', x: ox, y: oy, vx, vy, len, t: 0, d: 0.14 });
    if (along > 0 && along <= len + 0.3 && perp < PRM.gunWidth) Game.hitPlayer();
    A.st = 'recover'; A.t = 0; A.pumped = false;
  }
  // 道のりの小さいほうへ、タイルの中央から中央へ歩く。曲がるのは直角だけ
  function move(dt) {
    const F = Game.F; if (!F) return;
    let adv = A.speed * dt, guard = 0, moved = false;
    while (adv > 0.0001 && guard++ < 4) {
      if (!A.next) {
        const cx = Math.floor(A.x), cy = Math.floor(A.y), f0 = F[World.idx(cx, cy)];
        if (!(f0 > 0) || f0 === Infinity) break;   // 着いている・行けない
        let best = null, bc = Infinity;
        for (const q of DIR4) {
          const nx = cx + q[0], ny = cy + q[1]; if (World.wall(nx, ny)) continue;
          const c = F[World.idx(nx, ny)] + 1 + doorCost(World.doorAt(nx, ny)) - (q[2] === A.dir ? 0.02 : 0);
          if (c < bc) { bc = c; best = { x: nx, y: ny, dir: q[2] }; }
        }
        if (!best || bc > f0 + 0.6) break;
        const d = World.doorAt(best.x, best.y);
        if (d && d.st === 1) { d.st = 0; A.pause = PRM.doorOpen; A.dir = best.dir; Snd.sfx('door'); Game.refield(); return; }
        if (d && d.st === 2) { A.st = 'door'; A.t = 0; A.door = d; A.dir = best.dir; Snd.sfx('hiss'); return; }
        A.next = best;
      }
      const n = A.next, ex = n.x + 0.5 - A.x, ey = n.y + 0.5 - A.y, dd = Math.hypot(ex, ey);
      A.dir = n.dir; moved = true;
      if (dd <= adv) {
        A.x = n.x + 0.5; A.y = n.y + 0.5; adv -= dd; A.next = null;
        const pd = Math.hypot(Game.P.x - A.x, Game.P.y - A.y); if (pd < 11) Snd.sfx('astep', { v: 1 - pd / 11 });   // 近いと、足音が聞こえる
      } else { A.x += ex / dd * adv; A.y += ey / dd * adv; adv = 0; }
    }
    if (moved) A.anim += dt * A.speed * 0.9;
  }
  function update(dt) {
    const P = Game.P, S = Game.S;
    if (A.st === 'wait') { A.t += dt; if (A.t >= A.arriveT) arrive(); return; }
    const dx = P.x - A.x, dy = P.y - A.y, dist = Math.hypot(dx, dy);
    A.sees = dist < 14 && World.los(A.x, A.y - 0.3, P.x, P.y - 0.3);
    if (A.st === 'spare') {
      A.t += dt;
      const n = Math.min(10, Math.floor(A.t / PRM.spareTime * 10));
      if (n > A.count) { A.count = n; Game.say(KAZU[n - 1] + '。', 0.9); Snd.sfx('task'); }
      if (A.t >= PRM.spareTime) { A.st = 'walk'; A.seeT = 0; Game.refield(); }
      return;
    }
    if (dist < PRM.catchDist && (A.sees || P.carrying)) { Game.capture(); return; }
    if (A.st === 'door') {
      A.t += dt;
      if (A.door.st !== 2) A.st = 'walk'; else if (A.t >= PRM.boltTime) boltFire();
      return;
    }
    if (A.st === 'search') {
      A.t += dt;
      if (S.where !== 'vent' || S.vent !== A.vent) A.st = 'walk'; else if (A.t >= PRM.searchTime) Game.lostMoney();
      return;
    }
    if (A.st === 'aim') {
      A.t += dt;
      if (A.t < PRM.gunAim - PRM.gunLock && A.sees) { A.aim = Math.atan2(dy, dx); faceTo(dx, dy); }
      if (A.t >= PRM.gunAim) fire();
      return;
    }
    if (A.st === 'recover') {
      A.t += dt;
      if (!A.pumped && A.t >= 0.5) { A.pumped = true; Snd.sfx('pump'); }
      if (A.t >= PRM.gunRecover) { A.st = 'walk'; A.seeT = 0; }
      return;
    }
    // walk
    if (A.gun && A.sees && dist <= PRM.gunRange && !P.down) {
      A.seeT += dt;
      if (A.seeT >= PRM.gunSee) { A.st = 'aim'; A.t = 0; A.aim = Math.atan2(dy, dx); faceTo(dx, dy); Snd.sfx('raise'); return; }
    } else A.seeT = Math.max(0, A.seeT - dt * 2);
    if (!P.down) {
      if (S.where === 'floor' && Math.hypot(S.x - A.x, S.y - A.y) < 0.6) { Game.lostMoney(); return; }
      if (S.where === 'vent') {
        for (const p of World.ventAccess(S.vent)) if (Math.hypot(p[0] + 0.5 - A.x, p[1] + 0.5 - A.y) < 0.3) {
          A.st = 'search'; A.t = 0; A.vent = S.vent; A.next = null; A.dir = p[1] < S.vent.ty ? 'down' : 'up'; Snd.sfx('unlock'); return;
        }
      }
    }
    if (A.pause > 0) { A.pause -= dt; return; }
    move(dt);
  }
  function spare() { A.st = 'spare'; A.t = 0; A.count = 0; A.next = null; A.x = Math.floor(A.x) + 0.5; A.y = Math.floor(A.y) + 0.5; }

  function draw(g, cam, alpha) {
    if (!A.on) return;
    const walking = A.st === 'walk' && A.pause <= 0, fr = walking ? (Math.floor(A.anim) % 2 ? 1 : 2) : 0;
    const px = Math.round(A.x * 16 - 9 - cam.x), py = Math.round(A.y * 16 - 23 - cam.y) + (A.st === 'search' ? 3 : 0);
    const jx = A.st === 'door' ? Math.round(Math.sin(Game.rt * 50) * (A.t / PRM.boltTime)) : 0;
    if (alpha === undefined) EL(g, px + 9, py + 25, 6, 2, '#000000', 9);
    g.drawImage(Art.anton[A.dir][fr], px + jx, py);
    const v = DV[A.dir], hx = px + 9, hy = py + 15;
    if (A.st === 'door') { R(g, hx + v[0] * 6 - 2, hy + v[1] * 5 - 2, 4, 4, '#9a9aa2'); R(g, hx - v[0] * 3 - 2, hy + 1, 4, 7, '#6a6a72'); }   // ボルト銃と、空気のボンベ
    if (A.st === 'aim' || A.st === 'recover') {
      const c = Math.cos(A.aim), s = Math.sin(A.aim), k = A.st === 'recover' ? Math.max(0, 3 - A.t * 12) : 0;
      for (let i = 2; i < 13; i++) R(g, hx + c * (i - k) - 1, hy - 3 + s * (i - k) - 1, i > 8 ? 3 : 2, i > 8 ? 3 : 2, i > 8 ? '#2a2a2e' : '#55555c');   // 銃身と消音器
    }
  }
  return Object.assign(A, { reset, update, draw, spare, DV });
})();
