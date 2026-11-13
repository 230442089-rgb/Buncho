// ───────── ゲーム本体 ─────────
// 面白さの核: 世界が止まったら、自分も止まる。動けば見つかる。
//   危険と見返り = アトリエから遠いほど、素材は多く、来訪も多い。持ち歩く素材が多いほど来やすく、失うものも大きい。
//   ご褒美 = 保存するたびに作品「無題」が描きこまれ、数がたまると更新されて空間の種類が増える。
// 画面の中では説明しない。説明は「よんでね.txt」にある。
const Game = (() => {
  const G = {
    mode: 'off', paused: false, t: 0, rt: 0, wt: 0, motion: 1, cam: { x: 0, y: 0 }, edel: null, doc: null, biome: null,
    carry: [], taken: new Set(), prog: {}, shadowProg: 0, msg: null, hitstop: 0, flashT: 0, tr: null, lock: false,
    visitT: 0, armed: false, outT: 0, fx: [], cand: null, halt: null, spam: [], scrT: 0, dbg: false, sweepT: 0, blinkT: 3, blink: 0, grainX: 0, grainY: 0,
  };
  let vg = null, last = 0, faceImg = null;
  const buf = mkCanvas(W, H), bg = buf.g, lightBuf = mkCanvas(W, H);
  const CALM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);   // 動きを減らす設定
  const grainC = C(64, 64, g => { const im = g.createImageData(64, 64), d = im.data; for (let i = 0; i < d.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = Math.random() * 44; } g.putImageData(im, 0, 0); });
  const vigC = C(W, H, g => { const gr = g.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 215); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });

  const isTaken = o => !!(o.cand && G.taken.has(o.cand.id));
  const mats = () => (G.doc ? G.doc.mats : []);
  function say(text, d) { G.msg = { text, t: d || 2.5 }; }
  function mkEdel(x, y, dir) { return { x, y, dir, tx: x, ty: y, fx: x, fy: y, moving: false, mt: 0, md: PRM.stepTime, cx: x, cy: y, isMoving: false, sketch: null, sketchShadow: false, stepN: 0 }; }
  // 偏愛レベル: アトリエから離れるほど、未保存の素材を持つほど上がる
  function level() {
    const e = G.edel; if (!e) return 0;
    const d = Math.max(Math.abs(Math.floor(e.x / CW)), Math.abs(Math.floor(e.y / CH)));
    return clamp(Math.floor(d * PRM.levelPerCell) + G.carry.length, 0, PRM.maxLevel);
  }

  // ── 作品を開く ──
  function open(name) {
    if (name && Store.d.docs[name]) Store.d.cur = name;
    G.doc = Store.doc();
    World.reset(G.doc.seed, verOf(Store.d.best));
    G.carry = []; G.taken = new Set(); G.prog = {}; G.shadowProg = 0; G.fx = []; G.msg = null; G.lock = false; G.hitstop = 0; G.flashT = 0; G.tr = null; G.spam = []; G.halt = null;
    G.motion = 1; G.wt = 0; G.t = 0;
    Asera.reset();
    G.armed = Store.d.taught > 0; G.visitT = rnd(22, 32); G.outT = 0;
    G.edel = mkEdel(8, 5, 'up'); G.biome = World.cellAt(8, 5).b; G.mode = 'play';
    Store.d.last = 'running'; Store.save();
    Snd.amb(G.biome);
    Shell.setTitle(null); Shell.setBusy(false);
  }
  function returnHome() {
    if (!canReturn()) return;
    Snd.sfx('door');
    G.tr = { t: 0, d: 0.5, half: false, fn() { G.edel = mkEdel(8, 6, 'up'); G.biome = World.cellAt(8, 6).b; Snd.amb(G.biome); World.sweep(8, 6); } };
  }
  const inSafe = () => World.safe(G.edel.x, G.edel.y);
  const canReturn = () => G.mode === 'play' && !inSafe() && Asera.st === 'absent' && !G.tr && !G.lock;
  const inAtelier = () => G.mode === 'play' && !!G.edel && inSafe();
  const canSave = () => inAtelier() && !G.lock && G.carry.length > 0;
  function setDoc() { G.doc = Store.doc(); }   // 名前を付けて保存したあと、作品を持ち替える

  // ── 来訪の間隔 ──
  const nextVisitDelay = () => Math.max(PRM.visitMin, PRM.visitBase - PRM.visitPerLevel * level()) + rnd(PRM.visitJitter);
  function afterVisit(angry) { G.visitT = angry ? rnd(6, 10) : nextVisitDelay(); Store.d.taught++; Store.save(); }
  function updVisit(dt) {
    if (inSafe() || Asera.st !== 'absent' || G.lock || G.tr) return;
    if (!G.armed) { G.outT += dt; if (G.outT < PRM.firstVisitMax) return; G.armed = true; G.visitT = 0; }
    G.visitT -= dt;
    if (G.visitT <= 0 && !Asera.startVisit()) G.visitT = 5;
  }

  // ── エデル ──
  function candNear() {
    const e = G.edel, ecx = Math.floor(e.x / CW), ecy = Math.floor(e.y / CH);
    let best = null, bd = 99;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const o of World.cell(ecx + dx, ecy + dy).objs) {
        if (!o.cand || G.taken.has(o.cand.id)) continue;
        const h = o.wall ? 2 : o.h;
        const ddx = Math.max(o.x - e.x, 0, e.x - (o.x + o.w - 1)), ddy = Math.max(o.y - e.y, 0, e.y - (o.y + h - 1)), d = Math.max(ddx, ddy);
        if (d <= 1 && d < bd) { best = o; bd = d; }
      }
    }
    if (best && G.motion > 0.5) return { obj: best };
    if (Asera.sh.on) {   // いちばん近い影（本人の影か、増えた影）
      let ns = null, nd = PRM.shadowReach;
      for (const s of [Asera.sh].concat(Asera.pack)) {
        const d = Math.hypot(s.x - e.x, s.y - e.y);
        if (d <= nd && World.los(e.x + 0.5, e.y + 0.5, s.x + 0.5, s.y + 0.5)) { ns = s; nd = d; }
      }
      if (ns) return { shadow: true, s: ns };
    }
    return best ? { obj: best } : null;
  }
  function scratch(dt) { G.scrT -= dt; if (G.scrT <= 0) { G.scrT = 0.085; Snd.sfx('scratch'); } }
  function acquire(m, tx, ty) {
    G.carry.push(m);
    Snd.sfx('get'); G.hitstop = 0.1;
    G.fx.push({ k: 'gem', x: tx, y: ty, t: 0, d: 0.6, col: m.c });
    say('取り込み: ' + m.n, 3.5);
    if (!G.armed) { G.armed = true; G.visitT = PRM.firstVisitAfterSketch; }
  }
  function sketch(c, dt) {
    const e = G.edel;
    if (c.shadow) {
      G.shadowProg += dt / PRM.shadowSketchTime; e.sketchShadow = true; scratch(dt);
      if (G.shadowProg >= 1) { G.shadowProg = 0; acquire({ n: '走る影の線', k: PK.shadow, c: '#330066', s: Math.random() }, c.s.x, c.s.y); }
      return true;
    }
    if (G.motion < 0.5) return false;   // 止まった事象は写せない
    const o = c.obj, id = o.cand.id;
    G.prog[id] = (G.prog[id] || 0) + dt * G.motion / PRM.sketchTime; scratch(dt);
    if (G.prog[id] >= 1) { delete G.prog[id]; G.taken.add(id); acquire({ n: o.cand.n, k: o.cand.k, c: o.cand.c, s: o.cand.s }, o.x + o.w / 2 - 0.5, o.y + (o.wall ? 0.5 : o.h / 2 - 0.5)); }
    return true;
  }
  function saveAll() {
    const n = G.carry.length, d = G.doc;
    if (!n || !canSave()) return;
    const v0 = verOf(Store.d.best);
    for (const m of G.carry) d.mats.push(m);
    d.total += n; G.carry = [];
    if (d.mats.length > PRM.matsMax) { const cut = d.mats.length - PRM.matsMax; d.mats.splice(0, cut); d.snaps = d.snaps.map(s => Math.max(0, s - cut)); }
    d.snaps.push(d.mats.length); if (d.snaps.length > 12) d.snaps.shift();
    Store.d.best += n; Store.d.streak = 0; Store.save();   // best: これまでに保存した素材の総数
    Snd.sfx('save');
    const e = G.edel;
    for (let i = 0; i < n; i++) G.fx.push({ k: 'gem', x: e.x, y: e.y - 1, t: -i * 0.12, d: 0.5, col: '#96f', to: [8, 3] });
    const v1 = verOf(Store.d.best), left = v1 < VER_AT.length ? VER_AT[v1] - Store.d.best : 0;
    say(left > 0 ? '保存しました　更新まで あと ' + left : '保存しました', 4);
    if (v1 > v0) { World.setVer(v1); World.refresh(); Shell.notifyUpdate(v0, v1); }   // 更新: アトリエの外が作り直される
    Shell.docChanged();
  }
  function interact() {
    const e = G.edel, v = DV[e.dir], o = World.objAt(e.x + v[0], e.y + v[1]);
    if (o && o.k === 'easel') { if (G.carry.length) saveAll(); else Shell.openPicture(); }
    else Snd.sfx('empty');   // 何もない所で押しても、小さく応える
  }
  function tryMove(d) {
    const e = G.edel, v = DV[d], nx = e.x + v[0], ny = e.y + v[1];
    e.dir = d;
    if (World.solid(nx, ny)) return;
    if (Asera.vis && Math.round(Asera.x) === nx && Math.round(Asera.y) === ny) return;
    e.moving = true; e.fx = e.x; e.fy = e.y; e.tx = nx; e.ty = ny; e.mt = 0; e.stepN++;
    const wet = World.water(nx, ny) || World.water(e.x, e.y);
    e.md = wet ? PRM.wadeTime : PRM.stepTime;
    Snd.step(wet ? 'water' : World.cellAt(nx, ny).b.step);
  }
  function onStep() {
    const e = G.edel, b = World.cellAt(e.x, e.y).b;
    if (b !== G.biome) { G.biome = b; Snd.amb(b); }
    if (b.safe && Asera.st !== 'absent') Asera.lose();   // アトリエには入ってこない
  }
  function updEdel(dt) {
    const e = G.edel;
    e.isMoving = false; e.sketchShadow = false;
    if (e.moving) {
      e.mt += dt / e.md; e.isMoving = true;
      if (e.mt >= 1) { e.moving = false; e.x = e.tx; e.y = e.ty; e.mt = 0; onStep(); }
    }
    if (!e.moving) {
      e.cx = e.x; e.cy = e.y;
      const c = G.lock ? null : candNear();
      G.cand = c;
      let sk = false;
      if (c && Input.act) sk = sketch(c, dt);
      e.sketch = sk ? c : null;
      if (!sk) for (const k of Object.keys(G.prog)) G.prog[k] = Math.max(0, G.prog[k] - PRM.sketchDecay * dt);
      if (G.mode !== 'play' || G.lock || G.tr) return;
      if (Input.actHit && !sk) { if (!c) interact(); else Snd.sfx('empty'); }   // 止まった事象は写せない
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
    for (const c of World.visible(G.cam.x, G.cam.y)) for (const o of c.objs) if (o.tick && !isTaken(o)) o.tick(o, G.wt, pw);
    updEdel(dt);
    for (const f of G.fx) f.t += dt; G.fx = G.fx.filter(f => f.t < f.d);
    updVisit(dt);
    if (G.msg) { G.msg.t -= dt; if (G.msg.t <= 0) G.msg = null; }
    G.sweepT -= dt; if (G.sweepT <= 0) { G.sweepT = PRM.sweepEvery; World.sweep(G.edel.x, G.edel.y); }
    if (G.blink > 0) G.blink -= dt; else { G.blinkT -= dt * G.motion; if (G.blinkT <= 0) { G.blink = 0.13; G.blinkT = rnd(2.4, 5); } }
    if (G.motion > 0.1) { G.grainX = irnd(0, 63); G.grainY = irnd(0, 63); }
  }

  // ── つかまる → 強制終了 ──
  function capture() {
    G.mode = 'halt'; G.halt = { t: 0, spamT: 0 };
    Store.d.crashes++; Store.d.streak++; Store.d.last = 'crash'; Store.save();
    Snd.sfx('catch'); Snd.amb(null);
    Shell.shake(true);
    G.hitstop = 0; G.flashT = 0;
  }
  function updHalt(dt) {
    const h = G.halt, e = G.edel;
    h.t += dt; G.t += dt;
    Asera.x = e.cx + 0.3; Asera.y = e.cy + 0.02; Asera.dir = 'left'; Asera.sh.x = e.cx; Asera.sh.y = e.cy;
    if (Asera.say) { Asera.say.t += dt; if (Asera.say.t > Asera.say.d) Asera.say = null; }
    h.spamT -= dt;
    if (h.t > 0.6 && h.spamT <= 0) {
      h.spamT = Math.max(0.025, 0.13 - h.t * 0.05);
      G.spam.push({ text: pick(['見てて', '見てて', 'みてて', 'ねえ', '見てた？', 'ずっと 見てて', 'エデル姉', '見てて見てて']), x: irnd(-20, W - 50), y: irnd(0, H - 18), sc: chance(0.22) ? 2 : 1 });
      if (G.spam.length % 3 === 0) Snd.sfx('voice');
      Shell.setTitle('見てて'.repeat(1 + (G.spam.length % 9)));
    }
    if (h.t > 2.2) { G.mode = 'dead'; Snd.sfx('stutter'); Shell.shake(false); Shell.crash(); }
  }

  // ── 描く ──
  function drawEdel(g) {
    const e = G.edel, cam = G.cam;
    const fr = e.moving && e.mt < 0.55 ? ((e.stepN & 1) ? 1 : 3) : 0;
    const img = (G.blink > 0 && !e.moving ? Sprites.edelBlink : Sprites.edel)[e.dir][fr];
    const x = Math.round(e.cx * 16 - 5 - cam.x), y = Math.round(e.cy * 16 - 27 - cam.y);
    if (World.water(Math.round(e.cx), Math.round(e.cy))) { g.drawImage(img, 0, 0, EDEL_W, EDEL_H - 5, x, y + 5, EDEL_W, EDEL_H - 5); R(g, x + 5, y + EDEL_H - 1, 16, 1, '#dff'); R(g, x + 3, y + EDEL_H, 20, 1, '#9cc'); }
    else g.drawImage(img, x, y);
  }
  function candBox(c) {
    const cam = G.cam;
    if (c.shadow) { const s = c.s; return [Math.round(s.x * 16 + 8 - cam.x) - 20, Math.round(s.y * 16 + 11 - cam.y) - 11, 40, 22]; }
    const o = c.obj, x = o.x * 16 - cam.x, y = o.y * 16 - cam.y;
    if (o.wall) return [x - 2, y - 1, o.w * 16 + 4, 34];
    if (o.layer === 'stand') { const hh = o.spr ? Math.min(o.spr.height, 46) : 32; return [x - 3, y + o.h * 16 - hh - 1, o.w * 16 + 6, hh + 3]; }
    return [x - 2, y - 2, o.w * 16 + 4, o.h * 16 + 4];
  }
  function ants(g, b, ph, c1, c2) {
    const [x, y, w, h] = b;
    for (let i = 0; i < w; i++) { const k = ((i + ph) >> 2) & 1; R(g, x + i, y, 1, 1, k ? c1 : c2); R(g, x + w - 1 - i, y + h - 1, 1, 1, k ? c1 : c2); }
    for (let i = 0; i < h; i++) { const k = ((i + ph) >> 2) & 1; R(g, x + w - 1, y + i, 1, 1, k ? c1 : c2); R(g, x, y + h - 1 - i, 1, 1, k ? c1 : c2); }
  }
  function corners(g, b, c) {
    const [x, y, w, h] = b, n = 4;
    R(g, x, y, n, 1, c); R(g, x, y, 1, n, c); R(g, x + w - n, y, n, 1, c); R(g, x + w - 1, y, 1, n, c);
    R(g, x, y + h - 1, n, 1, c); R(g, x, y + h - n, 1, n, c); R(g, x + w - n, y + h - 1, n, 1, c); R(g, x + w - 1, y + h - n, 1, n, c);
  }
  // 眼鏡に映る印。エデルの関心があるものだけに付く。アセラ本人には付かない（影には付く）。文字は出さない。
  function drawMarkers(g, objs) {
    const e = G.edel, list = [];
    if (G.mode !== 'play' || Asera.st === 'found' || Asera.st === 'chase') return;
    for (const o of objs) if (o.cand && !G.taken.has(o.cand.id)) list.push({ obj: o });
    if (Asera.sh.on) for (const s of [Asera.sh].concat(Asera.pack)) list.push({ shadow: true, s });
    for (const c of list) {
      const b = candBox(c);
      if (b[0] > W || b[1] > H || b[0] + b[2] < 0 || b[1] + b[3] < 0) continue;
      const near = G.cand && ((c.shadow && G.cand.shadow && G.cand.s === c.s) || (c.obj && G.cand.obj === c.obj));
      if (c.shadow && !near) continue;
      const stopped = !c.shadow && G.motion < 0.5;
      if (e.sketch && near) ants(g, b, Math.floor(G.rt * 16), '#fff', '#303');
      else corners(g, b, stopped ? '#777' : ((Math.floor(G.rt * 2.5) & 1) || near ? '#fff' : '#96f'));
      const p = near ? (c.shadow ? G.shadowProg : (G.prog[c.obj.cand.id] || 0)) : 0;
      if (p > 0) {
        const bx = Math.round(b[0] + b[2] / 2 - 21), by = Math.min(H - 10, b[1] + b[3] + 2);
        R(g, bx, by, 42, 8, '#303'); R(g, bx + 1, by + 1, 40, 6, '#ddd');
        for (let i = 0; i < Math.floor(p * 8 + 0.001); i++) R(g, bx + 2 + i * 5, by + 2, 4, 4, '#339');
      }
    }
  }
  // 影から伸びる黒紫の手
  function drawHands(g) {
    const e = G.edel, cam = G.cam;
    if (!e.sketch) return;
    const b = candBox(e.sketch), ox = e.cx * 16 + 8 - cam.x, oy = e.cy * 16 + 13 - cam.y, tcx = b[0] + b[2] / 2, tcy = b[1] + b[3] / 2;
    for (let k = 0; k < 3; k++) {
      const tx = tcx + Math.cos(G.rt * 3.1 + k * 2.1) * (b[2] / 2 + 1), ty = tcy + Math.sin(G.rt * 4.3 + k * 1.7) * (b[3] / 2 - 2);
      let px0 = ox + (k - 1) * 4, py0 = oy;
      for (let s = 1; s <= 12; s++) {
        const u = s / 12, wig = Math.sin(u * Math.PI) * 6 * Math.sin(G.rt * 5 + k * 2 + u * 3);
        const x = lerp(ox + (k - 1) * 4, tx, u) + wig, y = lerp(oy, ty, u) - Math.sin(u * Math.PI) * 5;
        LN(g, px0, py0, x, y, '#303'); LN(g, px0 + 1, py0, x + 1, y, '#303'); px0 = x; py0 = y;
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
  // 明かり。暗い所は区画ごとの色で沈み、灯のまわりだけ元の色が見える。
  function lighting(g, cells) {
    let any = false;
    for (const c of cells) if (!c.b.lit) { any = true; break; }
    if (!any) return;
    const lg = lightBuf.g, cam = G.cam, e = G.edel;
    lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.fillStyle = '#000'; lg.fillRect(0, 0, W, H);
    for (const c of cells) { lg.fillStyle = c.b.lit ? '#fff' : c.amb; lg.fillRect(c.cx * CW * 16 - cam.x, c.cy * CH * 16 - cam.y, CW * 16, CH * 16); }
    lg.globalCompositeOperation = 'lighter';
    const spot = (cx, cy, r, c1, c2, a) => {
      if (cx < -r || cy < -r || cx > W + r || cy > H + r) return;
      const gr = lg.createRadialGradient(cx, cy, 2, cx, cy, r);
      gr.addColorStop(0, c1); gr.addColorStop(0.55, c2 || c1); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.globalAlpha = a; lg.fillStyle = gr; lg.fillRect(cx - r, cy - r, r * 2, r * 2);
    };
    for (const c of cells) for (const l of c.lights) {
      if (l.o && isTaken(l.o)) continue;
      let a = 1;
      if (l.flick) { const k = Math.sin(G.wt * 9 + l.x) + Math.sin(G.wt * 23.7 + l.y); a = k > -0.7 ? 1 : 0.15; }
      spot(l.x - cam.x, l.y - cam.y, l.r, l.c, l.c2, a);
    }
    spot(e.cx * 16 + 8 - cam.x, e.cy * 16 - cam.y, e.sketch ? 40 : 30, e.sketch ? '#8060b0' : '#5a566a', '#201e28', 1);   // エデルのまわりは かすかに見える
    lg.globalAlpha = 1;
    g.globalCompositeOperation = 'multiply'; g.drawImage(lightBuf.c, 0, 0); g.globalCompositeOperation = 'source-over';
  }
  function waterFx(g, cells) {
    const cam = G.cam;
    for (const c of cells) {
      if (c.wl === undefined) { c.wl = []; for (let i = 0; i < CW * CH; i++) if (c.t[i] === T_WATER || c.t[i] === T_DEEP) c.wl.push(i); }
      for (const i of c.wl) {
        const lx = i % CW, ly = Math.floor(i / CW), sx = (c.cx * CW + lx) * 16 - cam.x, sy = (c.cy * CH + ly) * 16 - cam.y;
        if (sx < -16 || sy < -16 || sx > W || sy > H) continue;
        const ph = G.wt * 1.4 + lx * 0.9 + ly * 1.7, sh = c.t[i] === T_WATER;
        R(g, sx + 3 + Math.sin(ph) * 3, sy + 4, 6, 1, sh ? '#9cc' : '#246'); R(g, sx + 8 + Math.cos(ph * 0.8) * 3, sy + 11, 5, 1, sh ? '#cee' : '#135');
      }
    }
  }
  function render() {
    const g = bg, e = G.edel, cam = G.cam;
    cam.x = Math.round(e.cx * 16 + 8 - W / 2); cam.y = Math.round(e.cy * 16 - 8 - H / 2);
    const cells = World.visible(cam.x, cam.y, 72), objs = [];
    R(g, 0, 0, W, H, '#000');
    for (const c of cells) { g.drawImage(c.layer || World.paint(c), c.cx * CW * 16 - cam.x, c.cy * CH * 16 - cam.y); for (const o of c.objs) objs.push(o); }
    waterFx(g, cells);
    for (const o of objs) if (o.layer === 'floor' || o.layer === 'wall') drawObj(g, o, o.x * 16 - cam.x, o.y * 16 - cam.y, G.wt, G.t, isTaken(o));
    EL(g, e.cx * 16 + 8 - cam.x, e.cy * 16 + 14 - cam.y, 7, 2, '#202', 9);
    Asera.drawShadow(g, cam);
    drawHands(g);
    const list = [];
    for (const o of objs) if (o.layer === 'stand') list.push({ y: (o.y + o.h) * 16 - 1, o });
    list.push({ y: (e.cy + 1) * 16, e: 1 });
    list.sort((p, q) => p.y - q.y);
    for (const it of list) { if (it.o) drawObj(g, it.o, it.o.x * 16 - cam.x, it.o.y * 16 - cam.y, G.wt, G.t, isTaken(it.o)); else drawEdel(g); }
    lighting(g, cells);
    Asera.draw(g, cam); Asera.drawGlow(g, cam);          // アセラは暗がりでも はっきり見える
    drawMarkers(g, objs);
    drawFx(g);
    Asera.drawSay(g, cam);
    if (G.dbg) Asera.drawDebug(g, cam);
    // 写真のような粒子と、まわりの暗がり、日付
    const op = Store.d.opt;
    if (op.grain) { g.globalAlpha = 0.5; for (let y = -G.grainY; y < H; y += 64) for (let x = -G.grainX; x < W; x += 64) g.drawImage(grainC, x, y); g.globalAlpha = 1; }
    g.drawImage(vigC, 0, 0);
    if (op.stamp && G.mode === 'play') { Text.draw(g, "'03  8 31", W - 7, H - 21, '#410', { align: 'right' }); Text.draw(g, "'03  8 31", W - 8, H - 22, '#f82', { align: 'right' }); }
    if (G.mode === 'halt') {
      if (G.halt.t < 0.55 && faceImg && faceImg.complete && faceImg.naturalWidth) g.drawImage(faceImg, 0, 0, 160, 120, 0, 0, W, H);   // みつかった瞬間、顔が画面いっぱいに出る
      for (const s of G.spam) Text.draw(g, s.text, s.x, s.y, '#fff', { out: '#000', scale: s.sc });
    }
    if (G.tr) { const p = 1 - Math.abs(1 - 2 * G.tr.t / G.tr.d); for (let by = 0; by < 15; by++) for (let bx = 0; bx < 20; bx++) if (hash2(bx, by, 7) < p * 1.1) R(g, bx * 16, by * 16, 16, 16, '#000'); }
  }
  function post() {
    if (!vg) return;
    const fl = G.flashT > 0 || (G.mode === 'halt' && G.halt.t < 0.55), col = Store.d.opt.colors;
    const base = col === 0 ? 3 : col === 2 ? 32 : 6;   // 16色ふう・256色ふう・ハイカラー
    FX.levels = fl ? 2 : (G.motion < 0.35 ? Math.min(base, 4) : base);
    FX.desat = (1 - G.motion) * 0.65;
    FX.invert = G.flashT > 0 && !CALM && G.flashT > PRM.foundStop - 0.1;   // 反転は最初の一瞬だけ（点滅させない）
    FX.glitch = CALM ? 0 : (G.mode === 'halt' ? 1 : (Asera.st === 'chase' ? 0.8 : (Asera.st === 'present' ? Asera.gauge * 0.9 : 0)));
    postFX(bg, vg);
  }

  // ── 窓への表示 ──
  const fmt = n => (n < 0 ? '-' : '+') + String(Math.abs(n)).padStart(3, '0');
  function updStatus() {
    const e = G.edel, s = Asera.st;
    let msg = 'レディ';
    if (G.mode !== 'play') msg = '';
    else if (G.msg) msg = G.msg.text;
    else if (e.sketch) msg = '取り込み中…';
    else if (G.motion < 0.5) msg = '応答なし';
    Shell.setMsg(msg);
    Shell.setInfo(String(G.doc.total) + (G.carry.length ? ' +' + G.carry.length : ''), fmt(e.x - 8) + ',' + fmt(e.y - 5), (s === 'present' || s === 'found' || s === 'chase' || s === 'capture') ? clamp(Asera.gauge, 0, 1) : -1);
    if (G.mode === 'play') {
      const busy = G.motion < 0.5;
      Shell.setBusy(busy || G.lock);
      Shell.setTitle(s === 'found' || s === 'chase' ? 'みつけた' : (busy ? '(応答なし)' : null));
    }
  }

  // ── 試験用（#debug を付けて開いたときだけ外から呼ばれる）──
  function debug(cmd, a, b) {
    if (cmd === 'visit') { G.armed = true; G.visitT = 0; }
    else if (cmd === 'warp') { Asera.reset(); G.motion = 1; G.edel = mkEdel(a, b, 'down'); onStep(); }
    else if (cmd === 'give') G.carry.push({ n: '試験', k: a || 0, c: '#ffcc66', s: Math.random() });
    else if (cmd === 'cone') G.dbg = !G.dbg;
    else if (cmd === 'sim') { const n = Math.round(a * 60); for (let i = 0; i < n && G.mode === 'play'; i++) updPlay(1 / 60); }
    else if (cmd === 'force') World.setForce(a);
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (!G.paused && vg && G.edel) {
      G.rt += dt;
      if (G.mode === 'play') { updPlay(dt); render(); post(); }
      else if (G.mode === 'halt') { updHalt(dt); if (G.mode === 'halt') { render(); post(); } }
      Snd.setMotion(G.motion);
      if (G.mode === 'play' || G.mode === 'halt') updStatus();
    }
    Snd.tick(); Input.endFrame();
    requestAnimationFrame(frame);
  }
  function init(canvas) { vg = canvas.getContext('2d'); vg.imageSmoothingEnabled = false; if (!faceImg && typeof IMG !== 'undefined') { faceImg = new Image(); faceImg.src = IMG.aseraFace; } }
  function run() { last = performance.now(); requestAnimationFrame(frame); }
  function redraw() { if (vg && G.edel && (G.mode === 'play')) { render(); post(); updStatus(); } }
  function off() { G.mode = 'off'; vg = null; G.edel = null; }
  return Object.assign(G, { init, run, open, redraw, mats, level, say, capture, afterVisit, canSave, canReturn, inAtelier, setDoc, saveAll, returnHome, debug, off });
})();
