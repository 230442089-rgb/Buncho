// ───────── アセラ ─────────
// 来訪の流れ:  absent（いない）→ omen（予兆。世界の運動が奪われていく。影だけが先に来る）
//            → present（走っては止まり、見回す）→ leaving（去る。運動が戻る）
// 見つけたら:  found（一瞬止まる）→ chase（まっすぐ来る）→ capture（つかまえる）
// 止まっているものは見えない。動いているもの（歩くエデル、影を写す手）だけが見える。
const Asera = (() => {
  const A = {
    st: 'absent', sub: '', t: 0, x: 0, y: 0, dir: 'down', vis: false, gauge: 0, n: 0,
    route: null, looks: [], lookT: 0, stay: 0, stayT: 0, omen: 0, next: null, feint: null, fe: false, lenient: false, angry: false,
    sh: { on: false, x: 0, y: 0, dir: 'right', route: null, fr: 0 }, orb: 0, pack: [],
    afters: [], afterT: 0, runT: 0, say: null, entry: null, susp: false, tickT: 0, rt: 0, gx: -1, gy: -1, speed: PRM.dashSpeed,
  };
  const COSF = Math.cos(PRM.fov * Math.PI / 180);
  const L_SEEK = ['エデル姉？', 'どこ？', 'ねえ', '見てて', 'いまの 見てた？', 'もう一回 やるから', 'あたし 速く なったよ', 'つぎも 見てて', 'いないの？'];
  const L_SEEK2 = ['見てて見てて', '見てた？見てた？', 'ﾐﾃﾃ', '隕九※縺ｦ', 'エデル姉エデル姉', 'ここ？', 'ねえねえねえ', 'もう一回もう一回'];
  const L_SUS = ['……？', 'うごいた？', 'いま、'];
  const L_LEAVE = ['……いないや', 'つぎ！', 'あっちかな', '……姉ちゃん'];
  const level = () => clamp(Store.d.saved.length + Game.carry.length, 0, PRM.maxLevel);

  function free(r, tx, ty) {
    if (isSolid(r, tx, ty) || portalAt(r, tx, ty)) return false;
    const e = Game.edel;
    if (tx === e.x && ty === e.y) return false;
    if (e.moving && tx === e.tx && ty === e.ty) return false;
    return true;
  }
  // 道のりに沿って進む。着いたら true。
  function stepRoute(m, dt, speed) {
    let adv = speed * dt;
    while (adv > 0 && m.route && m.route.length) {
      const p = m.route[0], dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
      if (d > 0.001) m.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (d <= adv) { m.x = p.x; m.y = p.y; m.route.shift(); adv -= d; } else { m.x += dx / d * adv; m.y += dy / d * adv; adv = 0; }
    }
    return !m.route || !m.route.length;
  }
  function bfs(r, sx, sy, gx, gy, ax, ay) {
    const w = r.w, st = sy * w + sx, prev = new Int32Array(w * r.h).fill(-1), q = [st];
    prev[st] = st;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], cx = c % w, cy = (c / w) | 0;
      if (cx === gx && cy === gy) { const out = []; let k = c; while (k !== st) { out.unshift({ x: k % w, y: (k / w) | 0 }); k = prev[k]; } return out; }
      for (const d of DIRS) {
        const nx = cx + DV[d][0], ny = cy + DV[d][1];
        if (!inRoom(r, nx, ny)) continue;
        const ni = ny * w + nx;
        if (prev[ni] !== -1 || (nx === ax && ny === ay)) continue;
        if (!(nx === gx && ny === gy) && (isSolid(r, nx, ny) || portalAt(r, nx, ny))) continue;
        prev[ni] = c; q.push(ni);
      }
    }
    return null;
  }
  // つぎに走る先を決める。まっすぐ、壁まで、または途中まで。
  function planDash(r, x, y) {
    const e = Game.edel, opts = [];
    for (const d of DIRS) {
      const v = DV[d]; let n = 0, cx = x, cy = y;
      while (n < 12 && free(r, cx + v[0], cy + v[1])) { cx += v[0]; cy += v[1]; n++; }
      if (n < 1) continue;
      const toward = (e.x - x) * v[0] + (e.y - y) * v[1] > 0;
      let wgt = n * (toward ? 1.6 : 1);
      if (A.next && d === OPP[A.next.dir]) wgt *= 0.35;
      opts.push({ d, n, wgt });
    }
    if (!opts.length) return { x, y, dir: A.dir };
    let tot = 0; for (const o of opts) tot += o.wgt;
    let k = Math.random() * tot, c = opts[0];
    for (const o of opts) { k -= o.wgt; if (k <= 0) { c = o; break; } }
    let len = Math.max(irnd(Math.min(2, c.n), c.n), irnd(1, c.n));
    // 最初の来訪では、近くまでは来ない
    if (A.lenient) while (len > 1 && Math.hypot(x + DV[c.d][0] * len - e.x, y + DV[c.d][1] * len - e.y) < 4) len--;
    // いつも真横で止まるわけではない
    else if (len > 1 && chance(0.6) && Math.hypot(x + DV[c.d][0] * len - e.x, y + DV[c.d][1] * len - e.y) < 1.5) len -= irnd(1, Math.min(2, len - 1));
    return { x: x + DV[c.d][0] * len, y: y + DV[c.d][1] * len, dir: c.d };
  }
  // 増えた影（影獣）。溜めこんだ運動があふれて、本人とは別に歩きまわる。近くで動くものに気づく。
  function roam(r, m) {
    const opts = [], bx = Math.round(m.x), by = Math.round(m.y);
    for (const d of DIRS) {
      const v = DV[d]; let n = 0, cx = bx, cy = by;
      while (n < 6 && free(r, cx + v[0], cy + v[1])) { cx += v[0]; cy += v[1]; n++; }
      if (n) opts.push({ d, n });
    }
    if (!opts.length) return;
    const c = pick(opts), len = irnd(1, c.n);
    m.route = [{ x: bx + DV[c.d][0] * len, y: by + DV[c.d][1] * len }];
  }
  function spawnPack(r) {
    const lv = level(), n = lv >= PRM.packLevel2 ? 2 : lv >= PRM.packLevel1 ? 1 : 0, e = Game.edel;
    A.pack = [];
    const sp = r.spec.spawns.filter(s => free(r, s[0], s[1]) && Math.hypot(s[0] - e.x, s[1] - e.y) >= 4 && !(s[0] === A.entry.x && s[1] === A.entry.y));
    for (let i = 0; i < n && sp.length; i++) { const k = Math.floor(Math.random() * sp.length), s = sp.splice(k, 1)[0]; A.pack.push({ x: s[0], y: s[1], dir: 'right', route: null, wait: rnd(0.2, 0.8), fr: Math.random() * 2 }); }
  }
  function updPack(r, dt) {
    for (const m of A.pack) {
      m.fr += dt * 10;
      if (m.route && m.route.length) stepRoute(m, dt, PRM.packSpeed);
      else { m.wait -= dt; if (m.wait <= 0) { roam(r, m); m.wait = rnd(0.4, 1.1); } }
    }
  }
  function sees(r, ex, ey) {
    const dx = ex - A.x, dy = ey - A.y, d = Math.hypot(dx, dy);
    if (d > PRM.sight) return 0;
    if (d > PRM.nearSense) { const f = DV[A.dir]; if ((dx * f[0] + dy * f[1]) / d < COSF) return 0; }
    if (!los(r, A.x + 0.5, A.y + 0.5, ex + 0.5, ey + 0.5)) return 0;
    return lerp(PRM.gaugeNear, PRM.gaugeFar, clamp((d - 3) / (PRM.sight - 3), 0, 1));
  }
  function speak(text, d) { A.say = { text, t: 0, d: d || 1.3 }; Snd.sfx('voice'); }
  function trail(dt) {
    A.runT += dt; A.afterT -= dt;
    if (A.afterT <= 0) { A.afterT = 0.035; A.afters.push({ x: A.x, y: A.y, dir: A.dir, c: A.afters.length % 3, life: 0.22 }); }
  }
  function startDash(tg, allowFeint) {
    A.dir = tg.dir; A.sub = 'dash'; Snd.sfx('dash');
    const dist = Math.abs(tg.x - A.x) + Math.abs(tg.y - A.y);
    if (allowFeint && level() >= 3 && dist >= 3 && chance(PRM.feintChance)) {
      const v = DV[tg.dir]; A.feint = tg; A.fe = true; A.route = [{ x: Math.round(A.x) + v[0], y: Math.round(A.y) + v[1] }];
    } else { A.fe = false; A.route = [{ x: tg.x, y: tg.y }]; }
  }
  function arrive() {
    if (A.fe) { A.fe = false; A.dir = OPP[A.dir]; A.sub = 'flook'; A.lookT = 0.55; return; }
    // 着いたら時計回りに見回す。順番が決まっているので、つぎにどちらを向くかは読める。
    A.sub = 'look'; A.lookT = 0.15;
    A.looks = []; let d = A.dir;
    for (let i = 0, n = chance(0.5) ? 3 : 2; i < n; i++) { d = CW[d]; A.looks.push(d); }
  }
  function leave() {
    const r = Game.room, e = Game.edel, sx = Math.round(A.x), sy = Math.round(A.y);
    speak(pick(L_LEAVE), 1.2);
    let best = null;
    for (const s of r.spec.spawns) {
      if (!free(r, s[0], s[1])) continue;
      const p = bfs(r, sx, sy, s[0], s[1], e.x, e.y);
      if (p && (!best || p.length < best.length)) best = p;
    }
    A.sub = 'exit'; A.route = best && best.length ? best : [{ x: sx, y: sy }];
    Snd.sfx('dash');
  }
  function found() {
    const e = Game.edel;
    A.gauge = 1; A.st = 'found'; A.fe = false; A.feint = null; A.route = null;
    const dx = e.cx - A.x, dy = e.cy - A.y;
    A.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    speak('みつけた♡', 1.8); Snd.sfx('found');
    Game.hitstop = PRM.foundStop; Game.flashT = PRM.foundStop;
    Shell.setTitle('みつけた');
  }
  function perceive(dt) {
    const e = Game.edel, mv = e.isMoving ? 1 : (e.sketchShadow ? PRM.gaugeSketch : 0);
    let rate = mv > 0 ? sees(Game.room, e.cx, e.cy) * mv : 0;
    if (mv > 0) for (const m of A.pack) {
      if (Math.hypot(m.x - e.cx, m.y - e.cy) < PRM.packSense && los(Game.room, m.x + 0.5, m.y + 0.5, e.cx + 0.5, e.cy + 0.5)) rate = Math.max(rate, PRM.packGauge * mv);
    }
    if (rate > 0) {
      A.gauge += rate * dt;
      A.tickT -= dt; if (A.tickT <= 0) { Snd.sfx('tick'); A.tickT = lerp(0.16, 0.04, clamp(A.gauge, 0, 1)); }
      if (!A.susp && A.gauge > 0.4) { A.susp = true; speak(pick(L_SUS), 0.8); }
    } else {
      A.gauge = Math.max(0, A.gauge - PRM.gaugeDecay * dt);
      if (A.gauge < 0.15) A.susp = false;
    }
    if (A.gauge >= 1 || Math.hypot(e.cx - A.x, e.cy - A.y) < 0.7) found();
  }
  function shadowIdle(dt) {
    // 見回しているあいだ、影は本人のまわりをうろつく
    A.orb += dt * 4.5;
    const tx = A.x + Math.cos(A.orb) * 1.4, ty = A.y + Math.sin(A.orb) * 0.9, s = A.sh, v = 9 * dt;
    const dx = tx - s.x, dy = ty - s.y;
    s.x += clamp(dx, -v, v); s.y += clamp(dy, -v, v);
    if (Math.abs(dx) + Math.abs(dy) > 0.02) s.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  function startVisit() {
    const r = Game.room, e = Game.edel, k = level() / PRM.maxLevel;
    let sp = r.spec.spawns.map(s => ({ x: s[0], y: s[1], d: Math.hypot(s[0] - e.x, s[1] - e.y) })).filter(s => free(r, s.x, s.y));
    const far = sp.filter(s => s.d >= 6);
    if (far.length) sp = far;
    if (!sp.length) return false;
    A.n++; A.lenient = Store.d.taught < 1;
    A.omen = lerp(PRM.omenLong, PRM.omenShort, k) + Math.min(Store.d.streak, PRM.mercyMax) * PRM.mercyOmen;
    A.stay = lerp(PRM.stayShort, PRM.stayLong, k) * (A.lenient ? 0.8 : 1);
    const en = A.lenient ? sp.sort((a, b) => b.d - a.d)[0] : pick(sp);
    A.x = en.x; A.y = en.y; A.entry = en; A.vis = false; A.dir = 'down'; A.gauge = 0; A.afters = []; A.say = null; A.susp = false; A.angry = false;
    A.next = null; A.next = planDash(r, en.x, en.y);
    A.st = 'omen'; A.t = 0; A.sub = ''; A.sh.on = false; A.sh.route = null;
    Snd.sfx('omen', { d: A.omen });
    if (Store.d.taught < 2) Game.weird = { text: 'うごかないで', t: 0, d: A.omen + 2.4 };
    return true;
  }
  function update(dt) {
    const r = Game.room;
    if (A.afters.length) { for (const a of A.afters) a.life -= dt; A.afters = A.afters.filter(a => a.life > 0); }
    if (A.say) { A.say.t += dt; if (A.say.t > A.say.d) A.say = null; }
    A.sh.fr += dt * 14;
    if (A.st === 'absent') return;
    if (A.st === 'omen') {
      A.t += dt; const p = A.t / A.omen;
      Game.motion = 1 - smooth(p / 0.85);
      if (!A.sh.on && p > 0.45) { A.sh.on = true; A.sh.x = A.entry.x; A.sh.y = A.entry.y; A.sh.route = [{ x: A.next.x, y: A.next.y }]; Snd.sfx('whoosh'); }
      if (A.sh.on) stepRoute(A.sh, dt, PRM.dashSpeed * 0.9);
      if (p >= 1) {
        // 予兆のあいだにエデルが入口のそばへ来ていたら、別の入口から入る
        const e = Game.edel;
        if (Math.hypot(e.cx - A.entry.x, e.cy - A.entry.y) < 2.5) {
          const sp = r.spec.spawns.filter(s => free(r, s[0], s[1]) && Math.hypot(s[0] - e.cx, s[1] - e.cy) >= 4);
          if (!sp.length) { A.t = A.omen * 0.8; return; }
          const s = pick(sp); A.entry = { x: s[0], y: s[1] }; A.x = s[0]; A.y = s[1];
        }
        A.next = null; A.next = planDash(r, A.entry.x, A.entry.y);
        A.sh.route = [{ x: A.next.x, y: A.next.y }];
        Game.motion = 0; A.st = 'present'; A.vis = true; A.stayT = 0; startDash(A.next);
        spawnPack(r);
      }
      return;
    }
    if (A.st === 'present') {
      A.stayT += dt;
      perceive(dt);
      if (A.st !== 'present') return;
      if (A.sub === 'dash') { trail(dt); if (stepRoute(A, dt, PRM.dashSpeed)) arrive(); }
      else if (A.sub === 'look' || A.sub === 'flook') {
        A.lookT -= dt;
        if (A.lookT <= 0) {
          if (A.sub === 'flook') { const tg = A.feint; A.feint = null; startDash(tg); }
          else if (A.looks.length) {
            A.dir = A.looks.shift(); A.lookT = rnd(PRM.lookMin, PRM.lookMax) * (A.lenient ? 1.4 : 1);
            if (chance(0.3)) speak(pick(level() >= 4 ? L_SEEK2 : L_SEEK));
          } else if (A.stayT >= A.stay) leave();
          else {
            A.next = planDash(r, Math.round(A.x), Math.round(A.y));
            A.sh.route = [{ x: A.next.x, y: A.next.y }]; A.sub = 'lead'; A.lookT = PRM.shadowLead;
          }
        }
      } else if (A.sub === 'lead') { A.lookT -= dt; if (A.lookT <= 0) startDash(A.next, true); }
      else if (A.sub === 'exit') { trail(dt); if (stepRoute(A, dt, PRM.dashSpeed)) { A.vis = false; A.sh.on = false; A.pack = []; A.st = 'leaving'; A.t = 0; } }
      updPack(r, dt);
      if (A.sh.route && A.sh.route.length) stepRoute(A.sh, dt, PRM.dashSpeed * 1.25); else if (A.sub === 'look') shadowIdle(dt);
      return;
    }
    if (A.st === 'found') { A.st = 'chase'; A.route = null; A.rt = 0; Snd.sfx('dash'); return; }
    if (A.st === 'chase') {
      const e = Game.edel, gx = e.moving ? e.tx : e.x, gy = e.moving ? e.ty : e.y;
      trail(dt); A.rt -= dt;
      if (!A.route || !A.route.length || A.rt <= 0 || A.gx !== gx || A.gy !== gy) {
        A.gx = gx; A.gy = gy; A.rt = 0.25;
        const p = bfs(r, clamp(Math.round(A.x), 0, r.w - 1), clamp(Math.round(A.y), 0, r.h - 1), gx, gy, -1, -1);
        A.route = p && p.length ? p : [{ x: gx, y: gy }];
      }
      stepRoute(A, dt, PRM.chaseSpeed);
      A.sh.x = A.x; A.sh.y = A.y; A.sh.dir = A.dir;
      if (Math.hypot(e.cx - A.x, e.cy - A.y) < 0.75) { A.st = 'capture'; Game.capture(); }
      return;
    }
    if (A.st === 'leaving') {
      A.t += dt; Game.motion = Math.max(Game.motion, smooth(A.t / 1.1));
      if (A.t >= 1.1) { Game.motion = 1; A.st = 'absent'; Game.afterVisit(A.angry); }
      return;
    }
    if (A.st === 'script') { if (A.route && A.route.length) { trail(dt); stepRoute(A, dt, A.speed); } }
  }
  // エデルが別の部屋へ出たとき
  function onRoomChange() {
    if (A.st === 'absent' || A.st === 'script') return;
    A.angry = A.st === 'chase' || A.st === 'found';
    A.st = 'leaving'; A.t = 0.4; A.vis = false; A.sh.on = false; A.pack = []; A.gauge = 0; A.afters = []; A.say = null;
  }
  function reset() {
    A.st = 'absent'; A.vis = false; A.sh.on = false; A.pack = []; A.gauge = 0; A.afters = []; A.say = null; A.n = 0; A.route = null; A.next = null;
  }

  // ── 描く ──
  function drawOne(g, cam, s, sc) {
    const img = Sprites.shadow[s.dir === 'left' ? 'left' : 'right'][Math.floor(s.fr) & 1];
    g.save(); g.translate(Math.round(s.x * 16 + 8 - cam.x), Math.round(s.y * 16 + 11 - cam.y));
    if (s.dir === 'up') g.rotate(-Math.PI / 2); else if (s.dir === 'down') g.rotate(Math.PI / 2);
    g.drawImage(img, -18 * sc, -8 * sc, 36 * sc, 16 * sc);
    g.restore();
  }
  function drawShadow(g, cam) {
    for (const m of A.pack) drawOne(g, cam, m, 1);
    if (!A.sh.on) return;
    drawOne(g, cam, A.sh, (A.st === 'chase' || A.st === 'found' || A.st === 'capture') ? 2 : 1);
  }
  const sx = cam => Math.round(A.x * 16 - cam.x - 1), sy = cam => Math.round(A.y * 16 - cam.y - 9);
  function moving() { return (A.st === 'present' && (A.sub === 'dash' || A.sub === 'exit')) || A.st === 'chase' || (A.st === 'script' && A.route && A.route.length > 0); }
  function draw(g, cam) {
    if (!A.vis) return;
    for (const a of A.afters) g.drawImage(Sprites.aseraAfter[a.dir][a.c], Math.round(a.x * 16 - cam.x - 1), Math.round(a.y * 16 - cam.y - 9));
    const fr = moving() ? (Math.floor(A.runT * 18) & 3) : 0;
    const jx = (A.st === 'present' && !moving() && Math.floor(Game.t * 30) % 9 === 0) ? 1 : 0;
    g.drawImage(Sprites.asera[A.dir][fr], sx(cam) + jx, sy(cam));
  }
  // 暗い部屋では、アセラだけが明るく見える。影は目だけが光る。
  const EYE_OFF = { right: [11, -3], left: [-12, -3], up: [-3, -12], down: [2, 11] };
  function drawGlow(g, cam, lit) {
    if (A.st === 'script') return;
    if (lit && A.vis) draw(g, cam);
    for (const s of (A.sh.on ? [A.sh] : []).concat(A.pack)) {
      const o = EYE_OFF[s.dir] || EYE_OFF.right;
      R(g, Math.round(s.x * 16 + 8 - cam.x) + o[0], Math.round(s.y * 16 + 11 - cam.y) + o[1], 2, 2, '#f60');
    }
    if (!A.vis) return;
    const c = (Math.floor(Game.t * 20) & 1) ? '#f60' : '#fc0';
    for (const p of A_EYES[A.dir]) R(g, sx(cam) + p[0], sy(cam) + p[1], 1, 1, c);
  }
  function drawSay(g, cam) {
    if (!A.vis && !A.say) return;
    const cx = A.x * 16 + 8 - cam.x, top = A.y * 16 - 9 - cam.y;
    if (A.vis) {
      if (A.st === 'found' || A.st === 'chase' || A.st === 'capture') Text.draw(g, '！', cx, top - 34, '#f33', { out: '#fff', align: 'center', scale: 2 });
      else if (A.st === 'present' && A.gauge > 0.25) Text.draw(g, '？', cx, top - 17, '#fc0', { out: '#000', align: 'center' });
    }
    if (A.say) {
      const w = Text.width(A.say.text), x = clamp(cx - w / 2, 2, W - w - 2), y = clamp(top - (A.gauge > 0.25 || A.st !== 'present' ? 36 : 18), 2, H - 20);
      Text.draw(g, A.say.text, x, y, A.st === 'script' ? '#fff' : '#f93', { out: '#000' });
    }
  }
  function drawDebug(g, cam) {
    if (!A.vis) return;
    const f = DV[A.dir], cx = A.x * 16 + 8 - cam.x, cy = A.y * 16 + 8 - cam.y, a0 = Math.atan2(f[1], f[0]), fv = PRM.fov * Math.PI / 180;
    for (const a of [a0 - fv, a0 + fv]) LN(g, cx, cy, cx + Math.cos(a) * PRM.sight * 16, cy + Math.sin(a) * PRM.sight * 16, '#f0f');
    ELO(g, cx, cy, PRM.nearSense * 16, PRM.nearSense * 16, '#f0f');
  }
  return Object.assign(A, { startVisit, update, onRoomChange, reset, drawShadow, draw, drawGlow, drawSay, drawDebug, speak, level, stepRoute });
})();
