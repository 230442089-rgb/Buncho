// ───────── ゲーム本体 ─────────
// 面白さの核: 世界が止まったら、自分も止まる。動けば見つかる。
//   緊張 = アセラの来訪（世界の運動が奪われる）／ 解消 = 去って運動が戻る・素材を保存する
//   ご褒美 = 保存するたびに作品「無題」が描きこまれていく
const Game = (() => {
  const G = {
    mode: 'off', paused: false, t: 0, rt: 0, wt: 0, motion: 1,
    room: null, rooms: {}, cam: { x: 0, y: 0 }, edel: null,
    carry: [], prog: {}, shadowProg: 0,
    msg: null, hitstop: 0, flashT: 0, weird: null, banner: null, tr: null, lock: false,
    visitT: 0, armed: false, outT: 0, fx: [], cand: null, sel: 0, lastDir: null, halt: null, end: null, spam: [], scrT: 0, dbg: false, crashNote: false,
  };
  let vg = null, last = 0;
  const buf = mkCanvas(W, H, true), bg = buf.g;
  const titleImg = bg.createImageData(W, 120);
  const easelTmp = mkCanvas(26, 44);
  const BASE_TITLE = '事象のアトリエ - 無題';
  const CALM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);   // 動きを減らす設定

  const has = id => Store.d.saved.indexOf(id) >= 0 || G.carry.indexOf(id) >= 0;
  function say(text, d) { G.msg = { text, t: d || 3.5 }; }
  function mkEdel(x, y, dir) {
    return { x, y, dir, tx: x, ty: y, fx: x, fy: y, moving: false, mt: 0, md: PRM.stepTime, cx: x, cy: y, isMoving: false, sketch: null, sketchShadow: false, stepN: 0 };
  }

  // ── はじまり・部屋の出入り ──
  function boot() {
    G.mode = 'title'; G.sel = 0; G.t = 0; G.motion = 1; G.paused = false;
    G.crashNote = Store.d.last === 'crash' || Store.d.last === 'running';
    Store.d.boots++; Store.save();
    Snd.music('title');
    Shell.setTitle(null); Shell.setBusy(false);
  }
  function start(fresh) {
    if (fresh) { Store.d.saved = []; Store.d.shadow = 0; Store.d.streak = 0; }
    G.rooms = {}; G.carry = []; G.prog = {}; G.shadowProg = Store.d.shadow || 0;
    G.fx = []; G.weird = null; G.msg = null; G.lock = false; G.hitstop = 0; G.flashT = 0; G.tr = null; G.spam = []; G.halt = null; G.end = null;
    G.motion = 1; G.wt = 0; G.t = 0;
    Asera.reset();
    G.armed = Store.d.saved.length > 0; G.visitT = G.armed ? rnd(16, 24) : 0; G.outT = 0;
    Store.d.last = 'running'; Store.save();
    enter('atelier', 8, 5, 'up');
    G.mode = 'play';
    say(Store.d.saved.length ? '作品「無題」の つづきです。素材 ' + Store.d.saved.length + '/7' : '作品「無題」は まだ 白紙です。素材を さがして ください。', 5);
  }
  function enter(id, x, y, dir) {
    if (!G.rooms[id]) G.rooms[id] = buildRoom(id);
    G.room = G.rooms[id]; G.edel = mkEdel(x, y, dir); G.cand = null;
    Snd.music(G.room.spec.music);
    G.banner = { text: G.room.spec.name, t: 0 };
  }
  function go(p) {
    if (G.tr) return;
    Snd.sfx('door');
    G.tr = { t: 0, d: 0.42, half: false, fn() { Asera.onRoomChange(); enter(p.to, p.tx, p.ty, p.dir); } };
  }
  function returnHome() {
    if (!canReturn()) return;
    say('アトリエに 戻ります。', 2);
    go({ to: 'atelier', tx: 8, ty: 6, dir: 'up' });
  }
  const canReturn = () => G.mode === 'play' && !G.room.spec.safe && Asera.st === 'absent' && !G.tr && !G.lock;
  const canSave = () => G.mode === 'play' && G.room.id === 'atelier' && !G.lock && (G.carry.length > 0 || G.shadowProg > (Store.d.shadow || 0));

  // ── 来訪の間隔 ──
  function nextVisitDelay() {
    return Math.max(PRM.visitMin, PRM.visitBase - PRM.visitPerSaved * Store.d.saved.length - PRM.visitPerCarry * G.carry.length) + rnd(PRM.visitJitter);
  }
  function afterVisit(angry) {
    G.visitT = angry ? rnd(6, 10) : nextVisitDelay();
    Store.d.taught++; Store.save();
    Shell.setTitle(null);
  }
  function updVisit(dt) {
    if (G.room.spec.safe || Asera.st !== 'absent' || G.lock || G.tr) return;
    if (!G.armed) { G.outT += dt; if (G.outT < PRM.firstVisitMax) return; G.armed = true; G.visitT = 0; }
    G.visitT -= dt;
    if (G.visitT <= 0 && !Asera.startVisit()) G.visitT = 4;
  }

  // ── エデル ──
  function candNear() {
    const e = G.edel, r = G.room;
    let best = null, bd = 99;
    for (const o of r.objs) {
      if (!o.cand || has(o.cand)) continue;
      const dx = Math.max(o.x - e.x, 0, e.x - (o.x + o.w - 1)), dy = Math.max(o.y - e.y, 0, e.y - (o.y + o.h - 1)), d = Math.max(dx, dy);
      if (d <= (o.reach == null ? 1 : o.reach) && d < bd) { best = o; bd = d; }
    }
    if (best && G.motion > 0.5) return { obj: best };
    if (Asera.sh.on && !has('kage')) {
      // いちばん近い影（本人の影か、増えた影）
      let ns = null, nd = PRM.shadowReach;
      for (const s of [Asera.sh].concat(Asera.pack)) {
        const d = Math.hypot(s.x - e.x, s.y - e.y);
        if (d <= nd && los(r, e.x + 0.5, e.y + 0.5, s.x + 0.5, s.y + 0.5)) { ns = s; nd = d; }
      }
      if (ns) return { shadow: true, s: ns };
    }
    return best ? { obj: best } : null;
  }
  function scratch(dt) { G.scrT -= dt; if (G.scrT <= 0) { G.scrT = 0.085; Snd.sfx('scratch'); } }
  function acquire(id, tx, ty) {
    G.carry.push(id); delete G.prog[id];
    Snd.sfx('get'); G.hitstop = 0.1;
    G.fx.push({ k: 'gem', x: tx, y: ty, t: 0, d: 0.6, col: MAT[id].col });
    say('素材を 取り込みました:「' + MAT[id].name + '」 画架で 保存できます。', 5);
    if (!G.armed) { G.armed = true; G.visitT = PRM.firstVisitAfterSketch; }
  }
  function sketch(c, dt) {
    const e = G.edel;
    if (c.shadow) {
      G.shadowProg = Math.min(1, G.shadowProg + dt / PRM.shadowSketchTime); e.sketchShadow = true; scratch(dt);
      if (G.shadowProg >= 1) acquire('kage', c.s.x, c.s.y);
      return true;
    }
    if (G.motion < 0.5) return false;   // 止まった事象は写せない
    const id = c.obj.cand;
    G.prog[id] = (G.prog[id] || 0) + dt * G.motion / PRM.sketchTime; scratch(dt);
    if (G.prog[id] >= 1) acquire(id, c.obj.x + c.obj.w / 2 - 0.5, c.obj.y + c.obj.h / 2 - 0.5);
    return true;
  }
  function saveAll() {
    const n = G.carry.length;
    for (const id of G.carry) if (Store.d.saved.indexOf(id) < 0) Store.d.saved.push(id);
    G.carry = []; Store.d.shadow = G.shadowProg; Store.d.streak = 0; Store.save();
    Snd.sfx('save');
    const e = G.edel;
    for (let i = 0; i < Math.max(1, n); i++) G.fx.push({ k: 'gem', x: e.x, y: e.y - 1, t: -i * 0.12, d: 0.5, col: '#96f', to: [8, 3] });
    say(n ? '保存しました。素材 ' + Store.d.saved.length + '/7' : '影の スケッチを 保存しました。', 4);
    if (Store.d.saved.length >= MATS.length) startEnding();
  }
  function easel() { if (canSave()) saveAll(); else Shell.openPicture(); }
  function interact() {
    const e = G.edel, v = DV[e.dir], tx = e.x + v[0], ty = e.y + v[1], o = objAt(G.room, tx, ty);
    if (!o) return;
    if (o.k === 'easel') { easel(); return; }
    let s = o.look;
    if (typeof s === 'function') s = s(o, tx, o.cand ? has(o.cand) : false);
    if (s) { say(s, 4.5); Snd.sfx('look'); }
  }
  function tryMove(d) {
    const e = G.edel, r = G.room, v = DV[d], nx = e.x + v[0], ny = e.y + v[1];
    e.dir = d;
    const p = portalAt(r, nx, ny);
    if (p) { go(p); return; }
    if (isSolid(r, nx, ny)) return;
    if (Asera.vis && Math.round(Asera.x) === nx && Math.round(Asera.y) === ny && Asera.st !== 'script') return;
    e.moving = true; e.fx = e.x; e.fy = e.y; e.tx = nx; e.ty = ny; e.mt = 0; e.stepN++;
    const wet = isWater(r, nx, ny) || isWater(r, e.x, e.y);
    e.md = wet ? PRM.wadeTime : PRM.stepTime;
    Snd.sfx(wet ? 'wade' : 'step');
  }
  function updEdel(dt) {
    const e = G.edel;
    e.isMoving = false; e.sketchShadow = false;
    if (e.moving) {
      e.mt += dt / e.md; e.isMoving = true;
      if (e.mt >= 1) { e.moving = false; e.x = e.tx; e.y = e.ty; e.mt = 0; }
    }
    if (!e.moving) {
      e.cx = e.x; e.cy = e.y;
      const c = G.lock ? null : candNear();
      G.cand = c;
      let sk = false;
      if (c && Input.act) sk = sketch(c, dt);
      e.sketch = sk ? c : null;
      if (!sk) for (const k of Object.keys(G.prog)) { G.prog[k] = Math.max(0, G.prog[k] - PRM.sketchDecay * dt); }
      if (G.mode !== 'play' || G.lock || G.tr) return;
      if (Input.actHit && !sk && !c) interact();
      const d = Input.dir();
      if (d && !sk) tryMove(d);
    }
    if (e.moving) { e.cx = lerp(e.fx, e.tx, e.mt); e.cy = lerp(e.fy, e.ty, e.mt); }
  }

  // ── 進行 ──
  function updTr(dt) {
    if (!G.tr) return false;
    G.tr.t += dt;
    if (!G.tr.half && G.tr.t >= G.tr.d / 2) { G.tr.half = true; G.tr.fn(); }
    if (G.tr && G.tr.t >= G.tr.d) G.tr = null;
    return true;
  }
  function updPlay(dt) {
    if (updTr(dt)) return;
    if (G.hitstop > 0) { G.hitstop -= dt; if (G.hitstop <= 0) G.flashT = 0; return; }
    G.t += dt;
    Asera.update(dt);
    if (G.mode !== 'play') return;
    const pw = G.wt; G.wt += dt * G.motion;
    for (const o of G.room.objs) if (o.tick && !(o.cand && has(o.cand))) o.tick(o, G.wt, pw);
    updEdel(dt);
    updFx(dt);
    updVisit(dt);
    if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
    if (G.weird) { G.weird.t += dt; if (G.weird.t > G.weird.d) G.weird = null; }
    if (G.banner) { G.banner.t += dt; if (G.banner.t > 2.4) G.banner = null; }
  }
  function updFx(dt) {
    for (const f of G.fx) f.t += dt;
    G.fx = G.fx.filter(f => f.t < f.d);
  }

  // ── つかまる → 強制終了 ──
  function capture() {
    G.mode = 'halt'; G.halt = { t: 0, spamT: 0 };
    Store.d.crashes++; Store.d.streak++; Store.d.last = 'crash'; Store.save();
    Snd.sfx('catch'); Snd.music(null);
    Shell.shake(true);
    Asera.speak('つかまえた', 1.2);
    G.hitstop = 0; G.flashT = 0;
  }
  function updHalt(dt) {
    const h = G.halt, e = G.edel;
    h.t += dt; G.t += dt; if (G.flashT > 0) G.flashT -= dt;
    Asera.x = e.cx + 0.3; Asera.y = e.cy + 0.02; Asera.dir = 'left'; Asera.sh.x = e.cx; Asera.sh.y = e.cy;
    if (Asera.say) { Asera.say.t += dt; if (Asera.say.t > Asera.say.d) Asera.say = null; }
    h.spamT -= dt;
    if (h.t > 0.55 && h.spamT <= 0) {
      h.spamT = Math.max(0.025, 0.13 - h.t * 0.05);
      G.spam.push({ text: pick(['見てて', '見てて', 'みてて', 'ねえ', '見てた？', 'ずっと 見てて', 'エデル姉', '見てて見てて']), x: irnd(-20, W - 50), y: irnd(0, H - 18), sc: chance(0.22) ? 2 : 1, c: pick(['#f93', '#fff', '#f60', '#fc0']) });
      if (G.spam.length % 3 === 0) Snd.sfx('voice');
      Shell.setTitle('見てて'.repeat(1 + (G.spam.length % 9)));
    }
    if (h.t > 2.1) { G.mode = 'dead'; Snd.sfx('stutter'); Shell.shake(false); Shell.crash(); }
  }

  // ── 完成 ──
  function startEnding() {
    G.lock = true; G.mode = 'ending'; G.end = { t: 0, i: 0, pic: -1, stop: false };
    Input.clear();
    const e = G.edel;
    if (Math.max(Math.abs(e.x - 8), Math.abs(e.y - 4)) > 1) G.tr = { t: 0, d: 0.42, half: false, fn() { G.edel = mkEdel(8, 5, 'up'); } };
  }
  function endCues() {
    const A = Asera, e = G.edel, r = G.room;
    const side = [[1, 0], [-1, 0], [0, 1]].map(v => ({ x: e.x + v[0], y: e.y + v[1] })).find(p => !isSolid(r, p.x, p.y)) || { x: e.x, y: e.y + 1 };
    return [
      [0.4, () => say('素材が そろいました。', 4)],
      [1.2, () => { G.end.pic = 0; }],
      [5.4, () => { G.end.pic = -1; }],
      [5.8, () => { G.end.stop = true; Snd.sfx('omen', { d: 1.4 }); }],
      [7.6, () => { A.st = 'script'; A.vis = true; A.sh.on = false; A.x = 8; A.y = 9; A.dir = 'up'; A.speed = PRM.dashSpeed; A.route = [{ x: side.x, y: 9 }, { x: side.x, y: side.y }]; Snd.sfx('dash'); }],
      [8.1, () => { A.dir = side.x > e.x ? 'left' : side.x < e.x ? 'right' : 'up'; A.speak('エデル姉！　みつけ――', 1.6); }],
      [10.0, () => { A.dir = 'up'; A.speak('……それ、あたしの かげ？', 2.2); }],
      [12.8, () => A.speak('かげ だけ？', 1.9)],
      [15.4, () => A.speak('……そっか', 1.6)],
      [17.2, () => A.speak('姉ちゃんには、かげ だけで いいんだ', 2.8)],
      [21.2, () => A.speak('……でも、見てたんだ', 2.2)],
      [23.8, () => A.speak('えへへ', 1.4)],
      [25.4, () => A.speak('うん、もう一回！　つぎも 見てて！', 2.2)],
      [27.4, () => { A.route = [{ x: side.x, y: 9 }, { x: 8, y: 9 }, { x: 8, y: 10 }]; Snd.sfx('dash'); }],
      [28.2, () => { A.vis = false; A.say = null; G.end.stop = false; }],
      [30.0, () => { say('無題.bmp を 保存しました。', 5); Snd.sfx('end'); }],
      [33.0, () => finish()],
    ];
  }
  function updEnding(dt) {
    const E = G.end;
    if (!E.cues) E.cues = endCues();
    if (Input.cancelHit) { finish(); return; }
    if (updTr(dt)) return;
    E.t += dt; G.t += dt;
    while (E.i < E.cues.length && E.t >= E.cues[E.i][0]) { E.cues[E.i][1](); E.i++; if (G.mode !== 'ending') return; }
    G.motion = clamp(G.motion + (E.stop ? -dt / 1.3 : dt / 1.1), 0, 1);
    G.wt += dt * G.motion;
    if (E.pic >= 0) { E.pic += dt; scratch(dt * 0.6); }
    Asera.update(dt);
    updFx(dt);
    if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
  }
  function finish() {
    if (G.mode === 'dead') return;
    G.mode = 'dead'; Asera.reset(); G.motion = 1;
    Store.d.cleared++; Store.d.saved = []; Store.d.shadow = 0; Store.d.streak = 0; Store.d.last = 'ok'; Store.save();
    Snd.music(null);
    Shell.finish();
  }

  // ── 描く ──
  function camTarget() {
    const r = G.room, e = G.edel, rw = r.w * 16, rh = r.h * 16;
    const x = rw <= W ? (rw - W) / 2 : clamp(e.cx * 16 + 8 - W / 2, 0, rw - W);
    const y = rh <= H ? (rh - H) / 2 : clamp(e.cy * 16 - 2 - H / 2, 0, rh - H);
    G.cam.x = Math.round(x); G.cam.y = Math.round(y);
  }
  function drawEdel(g) {
    const e = G.edel, cam = G.cam, r = G.room;
    const fr = e.moving && e.mt < 0.55 ? ((e.stepN & 1) ? 1 : 3) : 0, img = Sprites.edel[e.dir][fr];
    const x = Math.round(e.cx * 16 - cam.x - 1), y = Math.round(e.cy * 16 - cam.y - 21);
    if (isWater(r, Math.round(e.cx), Math.round(e.cy))) {
      g.drawImage(img, 0, 0, 18, 33, x, y + 5, 18, 33);
      R(g, x + 2, y + 37, 14, 1, '#fff'); R(g, x, y + 38, 18, 1, '#cff');
    } else g.drawImage(img, x, y);
  }
  function candBox(c) {
    const cam = G.cam;
    if (c.shadow) { const s = c.s; return [Math.round(s.x * 16 + 8 - cam.x) - 20, Math.round(s.y * 16 + 11 - cam.y) - 11, 40, 22]; }
    const o = c.obj, x = o.x * 16 - cam.x, y = o.y * 16 - cam.y;
    if (o.layer === 'stand') return [x - 3, y - 18, o.w * 16 + 6, 36];
    return [x - 2, y - 2, o.w * 16 + 4, o.h * 16 + 4];
  }
  function ants(g, b, ph, c1, c2) {
    const [x, y, w, h] = b;
    for (let i = 0; i < w; i++) { const k = ((i + ph) >> 2) & 1; R(g, x + i, y, 1, 1, k ? c1 : c2); R(g, x + w - 1 - i, y + h - 1, 1, 1, k ? c1 : c2); }
    for (let i = 0; i < h; i++) { const k = ((i + ph) >> 2) & 1; R(g, x + w - 1, y + i, 1, 1, k ? c1 : c2); R(g, x, y + h - 1 - i, 1, 1, k ? c1 : c2); }
  }
  function corners(g, b, c) {
    const [x, y, w, h] = b, n = 5;
    R(g, x, y, n, 1, c); R(g, x, y, 1, n, c); R(g, x + w - n, y, n, 1, c); R(g, x + w - 1, y, 1, n, c);
    R(g, x, y + h - 1, n, 1, c); R(g, x, y + h - n, 1, n, c); R(g, x + w - n, y + h - 1, n, 1, c); R(g, x + w - 1, y + h - n, 1, n, c);
  }
  // 眼鏡に映る「作品候補」の印。エデルの関心があるものだけに付く。アセラ本人には付かない。
  function drawMarkers(g) {
    const r = G.room, e = G.edel, list = [];
    for (const o of r.objs) if (o.cand && !has(o.cand)) list.push({ obj: o });
    const hunt = Asera.st === 'found' || Asera.st === 'chase' || Asera.st === 'capture';
    if (hunt || G.mode === 'halt') return;
    if (Asera.sh.on && !has('kage')) for (const s of [Asera.sh].concat(Asera.pack)) list.push({ shadow: true, s });
    for (const c of list) {
      const b = candBox(c);
      if (b[0] > W || b[1] > H || b[0] + b[2] < 0 || b[1] + b[3] < 0) continue;
      const near = G.cand && ((c.shadow && G.cand.shadow && G.cand.s === c.s) || (c.obj && G.cand.obj === c.obj));
      const stopped = !c.shadow && G.motion < 0.5;
      if (e.sketch && near) ants(g, b, Math.floor(G.rt * 16), '#fff', '#303');
      else corners(g, b, stopped ? '#999' : ((Math.floor(G.rt * 2.5) & 1) || near ? '#fff' : '#96f'));
      if (!c.shadow || near) {
        const lb = stopped ? 'ﾃｲｼ ﾁｭｳ' : 'ｻｸﾋﾝｺｳﾎ', lx = clamp(b[0] + b[2] / 2 - Text.width(lb) / 2, 2, W - Text.width(lb) - 2);
        const ly = c.shadow ? Math.min(H - 18, b[1] + b[3] + 12) : Math.max(1, b[1] - 18);
        R(g, lx - 2, ly, Text.width(lb) + 4, 16, '#303'); R(g, lx - 1, ly - 1, Text.width(lb) + 2, 18, '#303');
        Text.draw(g, lb, lx, ly, stopped ? '#999' : '#fff');
      }
      if (near) {
        const p = c.shadow ? G.shadowProg : (G.prog[c.obj.cand] || 0);
        if (p > 0) {
          const bx = Math.round(b[0] + b[2] / 2 - 21), by = b[1] + b[3] + 2;
          R(g, bx, by, 42, 8, '#303'); R(g, bx + 1, by + 1, 40, 6, '#fff');
          for (let i = 0; i < Math.floor(p * 8 + 0.001); i++) R(g, bx + 2 + i * 5, by + 2, 4, 4, '#339');
        }
      }
    }
  }
  // 影から伸びる黒紫の手
  function drawHands(g) {
    const e = G.edel, cam = G.cam, pic = G.mode === 'ending' && G.end && G.end.pic >= 0;
    if (!e.sketch && !pic) return;
    const b = pic ? [8 * 16 - cam.x - 4, 4 * 16 - cam.y - 22, 24, 20] : candBox(e.sketch);
    const ox = e.cx * 16 + 8 - cam.x, oy = e.cy * 16 + 13 - cam.y, tcx = b[0] + b[2] / 2, tcy = b[1] + b[3] / 2;
    for (let k = 0; k < 3; k++) {
      const tx = tcx + Math.cos(G.rt * 3.1 + k * 2.1) * (b[2] / 2 + 1), ty = tcy + Math.sin(G.rt * 4.3 + k * 1.7) * (b[3] / 2 - 2);
      let px = ox + (k - 1) * 4, py = oy;
      for (let s = 1; s <= 12; s++) {
        const u = s / 12, wig = Math.sin(u * Math.PI) * 6 * Math.sin(G.rt * 5 + k * 2 + u * 3);
        const x = lerp(ox + (k - 1) * 4, tx, u) + wig, y = lerp(oy, ty, u) - Math.sin(u * Math.PI) * 5;
        LN(g, px, py, x, y, '#303'); LN(g, px + 1, py, x + 1, y, '#303'); px = x; py = y;
      }
      R(g, tx - 2, ty - 2, 4, 4, '#303'); R(g, tx - 1, ty - 1, 2, 2, '#96f'); R(g, tx - 3, ty - 3, 1, 2, '#303'); R(g, tx + 2, ty - 3, 1, 2, '#303'); R(g, tx - 1, ty - 4, 1, 2, '#303');
    }
  }
  function drawFx(g) {
    const cam = G.cam, e = G.edel;
    for (const f of G.fx) {
      if (f.t < 0) continue;
      const u = smooth(f.t / f.d), gx = f.to ? f.to[0] : e.cx, gy = f.to ? f.to[1] : e.cy - 0.6;
      const x = Math.round(lerp(f.x, gx, u) * 16 + 8 - cam.x), y = Math.round(lerp(f.y, gy, u) * 16 + 8 - cam.y - Math.sin(u * Math.PI) * 18);
      for (let j = -3; j <= 3; j++) R(g, x - (3 - Math.abs(j)), y + j, (3 - Math.abs(j)) * 2 + 1, 1, j < 0 ? '#fff' : f.col);
      R(g, x - 4, y, 1, 1, '#303'); R(g, x + 4, y, 1, 1, '#303'); R(g, x, y - 4, 1, 1, '#303'); R(g, x, y + 4, 1, 1, '#303');
    }
  }
  function drawOverlays(g) {
    if (G.weird) {
      const w = G.weird, a = w.t < 0.25 || (w.d - w.t) < 0.3 ? (Math.floor(G.rt * 24) & 1) : 1;
      if (a) Text.draw(g, w.text, W / 2, 34, '#fff', { out: '#000', align: 'center', scale: 2 });
    }
    if (G.banner && G.banner.t > 0.25 && G.mode === 'play') Text.draw(g, '「' + G.banner.text + '」', 6, H - 22, '#fff', { out: '#303' });
    for (const s of G.spam) Text.draw(g, s.text, s.x, s.y, s.c, { out: '#000', scale: s.sc });
    if (G.mode === 'ending' && G.end && G.end.pic >= 0) {
      const u = clamp(G.end.pic / 3.2, 0, 1), px = (W - 256) / 2, py = 12;
      R(g, px - 6, py - 6, 268, 204, '#303'); R(g, px - 4, py - 4, 264, 200, '#c93'); R(g, px - 1, py - 1, 258, 194, '#303');
      g.drawImage(Picture.get(Store.d.saved), px, py, 256, 192);
      for (let by = 0; by < 24; by++) for (let bx = 0; bx < 32; bx++) if (hash2(bx, by, 3) > u * 1.05) R(g, px + bx * 8, py + by * 8, 8, 8, '#fff');
      Text.draw(g, u >= 1 ? '「無題」' : '完成形を 決定して います…', W / 2, 218, '#fff', { out: '#303', align: 'center' });
    }
    if (G.tr) {
      const p = 1 - Math.abs(1 - 2 * G.tr.t / G.tr.d);
      for (let by = 0; by < 15; by++) for (let bx = 0; bx < 20; bx++) if (hash2(bx, by, 7) < p * 1.1) R(g, bx * 16, by * 16, 16, 16, '#000');
    }
  }
  function renderPlay() {
    const r = G.room, th = THEME[r.spec.theme], e = G.edel, cam = G.cam, g = bg;
    camTarget();
    R(g, 0, 0, W, H, r.spec.bg);
    if (th.back) th.back(g, r, cam, G.wt);
    g.drawImage(r.layer, -cam.x, -cam.y);
    if (th.floor) th.floor(g, r, cam, G.wt);
    for (const o of r.objs) if (o.layer === 'floor' || o.layer === 'wall') drawObj(g, o, o.x * 16 - cam.x, o.y * 16 - cam.y, G.wt, G.t, o.cand ? has(o.cand) : false);
    EL(g, e.cx * 16 + 8 - cam.x, e.cy * 16 + 14 - cam.y, 6, 2, '#303', 8);
    Asera.drawShadow(g, cam);
    drawHands(g);
    const list = [];
    for (const o of r.objs) if (o.layer === 'stand') list.push({ y: (o.y + o.h) * 16 - 1, o });
    list.push({ y: (e.cy + 1) * 16, e: 1 });
    if (Asera.vis) list.push({ y: (Asera.y + 1) * 16, a: 1 });
    list.sort((p, q) => p.y - q.y);
    for (const it of list) {
      if (it.o) drawObj(g, it.o, it.o.x * 16 - cam.x, it.o.y * 16 - cam.y, G.wt, G.t, it.o.cand ? has(it.o.cand) : false);
      else if (it.e) drawEdel(g); else Asera.draw(g, cam);
    }
    if (th.over) th.over(g, r, cam, G.wt);
    Asera.drawGlow(g, cam, !!th.over);
    if (G.mode !== 'ending') drawMarkers(g);
    drawFx(g);
    Asera.drawSay(g, cam);
    if (G.dbg) Asera.drawDebug(g, cam);
    drawOverlays(g);
  }
  function post() {
    const fl = G.flashT > 0;
    FX.levels = fl ? 2 : (G.mode === 'title' ? 6 : (G.motion < 0.35 ? 4 : 6));
    FX.desat = G.mode === 'title' ? 0 : (1 - G.motion) * 0.6;
    FX.invert = fl && !CALM && G.flashT > PRM.foundStop - 0.1;   // 反転は最初の一瞬だけ（点滅させない）
    FX.glitch = CALM ? 0 : (G.mode === 'halt' ? 1 : (Asera.st === 'chase' ? 0.8 : (Asera.st === 'present' ? Asera.gauge * 0.9 : 0)));
    if (vg) postFX(bg, vg);
  }

  // ── タイトル ──
  function titleItems() {
    const a = [['start', 'はじめる']];
    if (Store.d.saved.length || Store.d.shadow > 0) a.push(['fresh', 'さいしょから']);
    a.push(['quit', 'おわる']);
    return a;
  }
  function titleChoose(k) {
    Snd.sfx('blip');
    if (k === 'start') start(false);
    else if (k === 'quit') Shell.quit(true);
    else if (k === 'fresh') {
      Shell.msgBox({ title: '確認', icon: 'ask', text: '保存してある 素材を すべて 消して、\nさいしょから はじめますか？', buttons: ['はい', 'いいえ'] }).then(i => { if (i === 0) start(true); });
    }
  }
  function updTitle(dt) {
    G.t += dt;
    const it = titleItems(), d = Input.dirHit;
    if (d === 'up') { G.sel = (G.sel + it.length - 1) % it.length; Snd.sfx('blip'); }
    if (d === 'down') { G.sel = (G.sel + 1) % it.length; Snd.sfx('blip'); }
    G.sel = clamp(G.sel, 0, it.length - 1);
    if (Input.actHit) titleChoose(it[G.sel][0]);
  }
  const MENU_X = 196, MENU_Y = 132, MENU_W = 116, MENU_H = 20;
  function renderTitle() {
    const g = bg, t = G.t;
    for (let y = 0; y < 120; y += 2) R(g, 0, y, W, 2, mixc('#6699ff', '#eeeeff', Math.pow(y / 120, 1.5)));
    for (let i = 0; i < 7; i++) cloud(g, ((hash2(i, 4, 2) * 400 + t * (2 + i % 3)) % 420) - 50, 14 + hash2(i, 5, 2) * 84, Math.round(14 + hash2(i, 6, 2) * 22));
    const d = titleImg.data; let i = 0;
    for (let y = 0; y < 120; y++) {
      const z = 48 / (y + 2), fade = clamp(1 - y / 44, 0, 1);
      for (let x = 0; x < W; x++, i += 4) {
        const c = (Math.floor((x - 160) * z * 0.055 + 1000) + Math.floor(z * 5 + t * 0.35)) & 1;
        const r0 = c ? 51 : 255, b0 = c ? 102 : 255;
        d[i] = r0 + (238 - r0) * fade; d[i + 1] = r0 + (238 - r0) * fade; d[i + 2] = b0 + (255 - b0) * fade; d[i + 3] = 255;
      }
    }
    g.putImageData(titleImg, 0, 120);
    // 遠くを走る影
    const sx = ((t * 60) % 900) - 60;
    if (sx < W + 40) g.drawImage(Sprites.shadow.right[Math.floor(t * 12) & 1], sx, 126, 18, 8);
    // 画架とエデル
    EL(g, 152, 204, 44, 6, '#303', 6);
    easelTmp.g.clearRect(0, 0, 26, 44); OBJ.easel.draw(easelTmp.g, null, 5, 27);
    g.drawImage(easelTmp.c, 144, 112, 52, 88);
    g.drawImage(Sprites.edel.up[0], 96, 126, 36, 76);
    // 題字
    Text.draw(g, '事象のアトリエ', 162, 16, '#96f', { align: 'center', scale: 2 });
    Text.draw(g, '事象のアトリエ', 160, 14, '#fff', { align: 'center', scale: 2, out: '#303' });
    Text.draw(g, 'ATELIER.EXE  ver' + VERSION, 160, 52, '#303', { align: 'center' });
    // メニュー
    const it = titleItems();
    R(g, MENU_X - 4, MENU_Y - 4, MENU_W + 8, it.length * MENU_H + 8, '#303'); R(g, MENU_X - 3, MENU_Y - 3, MENU_W + 6, it.length * MENU_H + 6, '#fff'); R(g, MENU_X - 2, MENU_Y - 2, MENU_W + 4, it.length * MENU_H + 4, '#c9c5d3');
    it.forEach((m, k) => {
      const y = MENU_Y + k * MENU_H, on = k === G.sel;
      if (on) R(g, MENU_X, y, MENU_W, MENU_H - 2, '#2f2259');
      Text.draw(g, m[1], MENU_X + 8, y + 1, on ? '#fff' : '#17131d');
    });
    // 起動回数など（むかしのアクセスカウンターふう）
    const cnt = (lb, n, x) => { Text.draw(g, lb, x, 220, '#fff', { out: '#303' }); const w = Text.width(lb) + 4; R(g, x + w, 219, 36, 18, '#000'); Text.draw(g, String(n % 10000).padStart(4, '0'), x + w + 2, 220, '#3f6'); return x + w + 40; };
    const nx = cnt('起動', Store.d.boots, 6);
    cnt('強制終了', Store.d.crashes, nx + 6);
    if (G.crashNote) { R(g, 0, 98, W, 20, '#303'); Text.draw(g, '※ 前回は 正常に 終了しませんでした', 160, 100, '#f96', { align: 'center' }); }
  }

  // ── 状態表示 ──
  function hint() {
    const K = Shell.touch ? 'Ａ' : 'Z';
    if (G.mode === 'title') return Shell.touch ? 'Ａ: けってい　十字ボタン: えらぶ' : 'Z / Enter: けってい　↑↓: えらぶ';
    if (G.mode === 'ending') return G.msg ? G.msg.text : (Shell.touch ? '' : 'X: とばす');
    if (G.mode !== 'play') return '';
    if (Asera.st === 'found' || Asera.st === 'chase') return '';
    const c = G.cand;
    if (c && c.shadow) return K + ' 押しつづける: 影を スケッチ（見られると 気づかれます）';
    if (Asera.st === 'omen' || Asera.st === 'present') return Store.d.taught < 2 ? '世界が 止まりました。うごくと 見つかります。' : '';
    if (c && G.motion >= 0.5) return K + ' 押しつづける: スケッチ「' + MAT[c.obj.cand].src + '」';
    if (G.msg) return G.msg.text;
    const e = G.edel, v = DV[e.dir], p = portalAt(G.room, e.x + v[0], e.y + v[1]), o = objAt(G.room, e.x + v[0], e.y + v[1]);
    if (p) return 'この先:「' + ROOMS[p.to].name + '」';
    if (o && o.k === 'easel') return canSave() ? K + ': 素材を 保存する' : K + ': 作品を 見る';
    if (o && o.look) return K + ': しらべる';
    return Shell.touch ? '十字ボタン: あるく　Ａ: しらべる' : '方向キー: あるく　Z: しらべる';
  }
  function updStatus() {
    Shell.setHint(hint());
    if (G.mode === 'title' || G.mode === 'off') { Shell.setMat('素材 ' + Store.d.saved.length + '/7'); Shell.setSt('', false); Shell.setClock('--:--:--'); return; }
    Shell.setMat('素材 ' + Store.d.saved.length + '/7' + (G.carry.length ? ' +' + G.carry.length : ''));
    const s = Asera.st;
    if (s === 'present' || s === 'found' || s === 'chase' || s === 'capture') { const n = Math.round(clamp(Asera.gauge, 0, 1) * 6); Shell.setSt('視線' + '■'.repeat(n) + '□'.repeat(6 - n), n > 0); }
    else Shell.setSt(G.room ? G.room.spec.name : '', false);
    const sec = 16 * 3600 + 42 * 60 + Math.floor(G.wt), p2 = n => String(n).padStart(2, '0');
    Shell.setClock(p2(Math.floor(sec / 3600) % 24) + ':' + p2(Math.floor(sec / 60) % 60) + ':' + p2(sec % 60));
    if (G.mode === 'play' || G.mode === 'ending') {
      const busy = G.motion < 0.5;
      Shell.setBusy(busy || G.lock);
      if (s !== 'found' && s !== 'chase' && s !== 'capture') Shell.setTitle(busy ? BASE_TITLE + ' (応答なし)' : null);
    }
  }

  // ── デバッグ（#debug を付けて開いたときだけ）──
  function debug(cmd, a, b, c) {
    if (cmd === 'visit') { G.armed = true; G.visitT = 0; }
    else if (cmd === 'warp') { Asera.onRoomChange(); enter(a, b, c, 'down'); }
    else if (cmd === 'give') { if (!has(a)) G.carry.push(a); }
    else if (cmd === 'all') { for (const m of MATS) if (!has(m.id)) G.carry.push(m.id); }
    else if (cmd === 'cone') G.dbg = !G.dbg;
    else if (cmd === 'sim') { const n = Math.round(a * 60); for (let i = 0; i < n && G.mode === 'play'; i++) { updPlay(1 / 60); if (b) b(i); } }
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!G.paused && vg) {
      G.rt += dt;
      if (G.mode === 'title') { updTitle(dt); if (G.mode === 'title') { renderTitle(); post(); } else if (G.mode === 'play') { renderPlay(); post(); } }
      else if (G.mode === 'play') { updPlay(dt); renderPlay(); post(); }
      else if (G.mode === 'halt') { updHalt(dt); if (G.mode === 'halt') { renderPlay(); post(); } }
      else if (G.mode === 'ending') { updEnding(dt); if (G.mode === 'ending') { renderPlay(); post(); } }
      Snd.setMotion(G.mode === 'title' ? 1 : G.motion);
      if (G.mode !== 'dead' && G.mode !== 'off') updStatus();
    }
    Snd.tick(); Input.endFrame();
    requestAnimationFrame(frame);
  }
  function init(canvas) { vg = canvas.getContext('2d'); vg.imageSmoothingEnabled = false; }
  function run() { last = performance.now(); requestAnimationFrame(frame); }
  // 画面をさわったとき（タイトルの項目えらび）
  function pointer(x, y) {
    if (G.mode !== 'title' || G.paused) return;
    const it = titleItems();
    for (let k = 0; k < it.length; k++) if (x >= MENU_X - 4 && x <= MENU_X + MENU_W + 4 && y >= MENU_Y + k * MENU_H && y < MENU_Y + (k + 1) * MENU_H) { G.sel = k; titleChoose(it[k][0]); return; }
  }
  function off() { G.mode = 'off'; vg = null; }
  return Object.assign(G, { init, run, boot, start, has, say, capture, afterVisit, canSave, canReturn, saveAll, returnHome, pointer, debug, off, finish });
})();
