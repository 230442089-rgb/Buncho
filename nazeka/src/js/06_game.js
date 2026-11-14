// ───────── ゲーム本体 ─────────
// 面白さの核: 彼はこちらより速い。まっすぐ逃げても、かならず追いつかれる。
//   ただし彼は角を曲がるのが下手で、姿を見失うと、最後に見た場所で立ち止まって見回す。角を曲がるたびに、間が開く。
//   走れば速いが、息が切れる。近くで走れば、足音で居場所が知れる。歩けば、音はしない。
//   振り返れば彼との間が分かるが、前が見えず、少し遅くなる。
//   家に着いても、鍵を開けるあいだは動けない。そのぶんの間を、先に作っておく。
const Game = (() => {
  const G = { mode: 'boot', t: 0, day: 1, time: 0, P: null, shakeT: 0, shakeA: 0, msgT: 0, unlock: 0, keyT: 0, heartT: 0, pantT: 0, lampT: 0, locked: false, touch: false, seed: 0, kind: '' };
  let renderer, scene, camera, sky, lights = [], el = {};
  const $ = id => document.getElementById(id);
  const CALM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const _v = new THREE.Vector3();

  function init() {
    for (const id of ['app', 'cv', 'hud', 'h-day', 'h-home', 'h-dist', 'h-stam', 'h-msg', 'h-prompt', 'h-ptx', 'h-pbar', 'vig', 'red', 'black', 'bars', 'pad', 'p-title', 'p-card', 'c-lines', 'c-btns', 'b-act', 'b-pause']) el[id] = $(id);
    G.touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    try { renderer = new THREE.WebGLRenderer({ canvas: el.cv, antialias: !G.touch, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
    if (!renderer) { el['p-title'].querySelector('.sub').textContent = 'このブラウザでは 3D を 表示できません。'; return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, G.touch ? 1.25 : 1.5));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(C3(0x0d1322), 0.014);
    camera = new THREE.PerspectiveCamera(PRM.fov, 1, 0.06, 320); camera.rotation.order = 'YXZ';
    scene.add(new THREE.HemisphereLight(C3(0x90a4e0), C3(0x1c1c24), 0.36));
    const moon = new THREE.DirectionalLight(C3(0x9fb4ea), 0.2); moon.position.set(-40, 80, 30); scene.add(moon);
    for (let i = 0; i < (G.touch ? 4 : 7); i++) { const l = new THREE.PointLight(0xffffff, 0, 19, 1.8); scene.add(l); lights.push(l); }
    // 空（上は濃い藍、地平は少し赤紫）
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#03050c'); gr.addColorStop(0.45, '#0a1026'); gr.addColorStop(0.5, '#1c1830'); gr.addColorStop(0.56, '#0a0d18'); gr.addColorStop(1, '#0a0d18'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const st = new THREE.CanvasTexture(c); st.encoding = THREE.sRGBEncoding;
    sky = new THREE.Mesh(new THREE.SphereGeometry(260, 16, 12), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide, fog: false, depthWrite: false })); scene.add(sky);
    Anton.init(scene); Death.init(scene);
    resize(); window.addEventListener('resize', resize);
    return true;
  }
  function resize() {
    const w = el.app.clientWidth, h = el.app.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; G.fk = Math.max(1, 1.6 / (w / h)); camera.updateProjectionMatrix(); Death.xr.cam.aspect = w / h; Death.xr.cam.updateProjectionMatrix();
    el.pad.hidden = !G.touch || G.mode !== 'play';
  }
  // 縦長の画面でも横の視野が狭くなりすぎないように、縦の視野を広げる（上限 100 度）
  const vfov = deg => Math.min(100, 2 * Math.atan(Math.tan(deg * Math.PI / 360) * (G.fk || 1)) * 180 / Math.PI);
  function say(text, sec) { el['h-msg'].textContent = text; G.msgT = sec || 3; }
  function shake(a) { if (!CALM) { G.shakeA = a; G.shakeT = 0.35; } }
  function flash(a) { el.red.style.opacity = String(CALM ? a * 0.4 : a); setTimeout(() => { el.red.style.opacity = '0'; }, 120); }
  function panel(id) { el['p-title'].hidden = id !== 'title'; el['p-card'].hidden = id !== 'card'; }
  function card(lines, btns) {
    el['c-lines'].textContent = ''; el['c-btns'].textContent = '';
    for (const t of lines) { const p = document.createElement('p'); p.textContent = t; el['c-lines'].append(p); }
    btns.forEach((b, i) => { const e = document.createElement('button'); e.type = 'button'; e.className = 'btn'; e.textContent = b[0]; e.addEventListener('click', () => { Snd.sfx('ui'); b[1](); }); el['c-btns'].append(e); if (i === 0 && !G.touch) setTimeout(() => e.focus({ preventScroll: true }), 30); });
    panel('card');
  }

  // ── 1 日のはじまり ──
  function build(day) {
    G.seed = Math.floor(Math.random() * 2e9);
    Town.gen(G.seed, PRM.homeDist + PRM.homeStep * (day - 1)); scene.add(Town.group);
    const s = Town.start, a = Town.antonStart, ts = PRM.tile;
    G.P = { x: (s.tx + 0.5) * ts, z: (s.tz + 0.5) * ts, yaw: Math.atan2(a.tx - s.tx, a.tz - s.tz), pitch: 0, vx: 0, vz: 0, stamina: 1, stDelay: 0, running: false, moving: false, bob: 0, backK: 0, stepT: 0 };
    Anton.reset(day); Death.hide(); Anton.update(0, G.P); G.lampT = 0;
    camera.fov = vfov(PRM.fovStand); camera.updateProjectionMatrix();   // 一日のはじまりは、遠くに立つ彼に寄った画から
  }
  function title() {
    G.mode = 'title'; G.day = 1; build(1); panel('title');
    const tb = $('t-best'); tb.hidden = !Store.d.best; tb.textContent = 'これまでの 記録　' + Store.d.best + '日目まで 帰りついた。'; el.hud.hidden = true; el.bars.classList.remove('on'); el.black.style.opacity = '0'; el.pad.hidden = true;
    Snd.ambient(true); unlockMouse();
  }
  function startDay(day, fresh) {
    G.day = day; if (fresh) build(day);
    G.mode = 'play'; G.time = 0; G.unlock = 0; G.heartT = 0; panel(null); el.hud.hidden = false; el.bars.classList.remove('on'); el.black.style.opacity = '0'; el.pad.hidden = !G.touch;
    el['h-day'].textContent = day + '日目'; say('家へ 帰る。', 3.5); Snd.ambient(true); lock();
  }
  // マウスを画面に固定して見回す。固定できない環境（埋めこまれた枠の中など）では、押したまま動かして見回す（左右キーでもよい）
  function lock() { if (G.touch) return; try { const p = el.cv.requestPointerLock(); if (p && p.catch) p.catch(() => { G.noLock = true; }); } catch (e) { G.noLock = true; } }
  function onRun() { say('', 0.1); shake(0.12); }
  function onLost() { say('見失った らしい。', 2.6); }
  function onFound() { say('見つかった。', 1.8); Snd.sfx('sting', { v: 0.55 }); shake(0.08); }
  const unlockMouse = () => { if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); };   // 札のボタンを押せるように、マウスを放す
  function pause() { if (G.mode !== 'play') return; G.mode = 'pause'; el.pad.hidden = true; unlockMouse(); card(['中断'], [['つづける', () => { G.mode = 'play'; panel(null); el.pad.hidden = !G.touch; lock(); }], ['タイトルへ', title]]); }

  // ── つかまる・死ぬ・帰る ──
  function caught() {
    if (G.mode !== 'play') return;
    const P = G.P, rel = Math.abs(angDiff(Math.atan2(Anton.x - P.x, Anton.z - P.z), P.yaw + (P.backK > 0.5 ? Math.PI : 0))), d = Store.d;
    // 彼の方を向いていたなら（振り返っていたときも）銃。背を向けていたなら、まだ見た回数の少ないほうの死にかた（二通りとも見られるように）
    G.kind = rel < 1.25 || d.nb <= d.nn ? 'bolt' : 'neck';
    if (G.kind === 'bolt') d.nb++; else d.nn++; Store.save();
    el.hud.hidden = true; el.pad.hidden = true;
    if (Store.d.skip) { dead(G.kind); return; }
    G.mode = 'death'; el.bars.classList.add('on'); Death.start(G.kind, P);
  }
  function dead(kind) {
    G.mode = 'dead'; Snd.ambient(false); Snd.sfx('card'); el.black.style.opacity = '1'; el.bars.classList.remove('on');
    unlockMouse();
    card([kind === 'bolt' ? '額に、穴が ひとつ。' : '首が、一回転した。', G.day + '日目　' + Math.floor(G.time) + '秒', '理由は、分からない。'], [['もう一度', () => startDay(G.day, true)], ['タイトルへ', title]]);
  }
  function clear() {
    G.mode = 'clear'; Snd.sfx('door'); Snd.ambient(false); el.hud.hidden = true; el.pad.hidden = true; el.black.style.opacity = '1';
    if (G.day > Store.d.best) { Store.d.best = G.day; Store.save(); }
    unlockMouse();
    card(['帰宅。', G.day + '日目　' + Math.floor(G.time) + '秒', '鍵を かけた。 外で、足音が 止まる。'], [['つぎの 日へ', () => startDay(G.day + 1, true)], ['タイトルへ', title]]);
  }

  // ── あなた ──
  function updPlayer(dt) {
    const P = G.P;
    if (Input.lookX || Input.lookY) G.looked = true;
    P.yaw -= Input.lookX; P.pitch = clamp(P.pitch - Input.lookY, -1.15, 1.15);
    const back = Input.back; P.backK += ((back ? 1 : 0) - P.backK) * Math.min(1, dt * 11);
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), rx = -Math.cos(P.yaw), rz = Math.sin(P.yaw);
    let mx = fx * Input.mvy + rx * Input.mvx, mz = fz * Input.mvy + rz * Input.mvx; const m = Math.hypot(mx, mz), busy = G.unlock > 0 && Input.act;   // 鍵を回しているあいだは動けない（手を離せば、すぐ動ける）
    const canRun = P.running ? P.stamina > 0 : P.stamina >= PRM.staminaMin;
    P.running = m > 0.3 && Input.run && canRun && Input.mvy > -0.2 && !busy;
    if (P.running) { P.stamina = Math.max(0, P.stamina - dt / PRM.stamina); P.stDelay = PRM.staminaDelay; if (P.stamina <= 0) say('息が 切れた。', 2.2); } else if (P.stDelay > 0) P.stDelay -= dt; else P.stamina = Math.min(1, P.stamina + dt / PRM.staminaRegen);
    const sp = busy ? 0 : (P.running ? PRM.run : PRM.walk) * (back ? PRM.backMul : 1) * Math.min(1, m);
    const tx = m > 0.01 ? mx / m * sp : 0, tz = m > 0.01 ? mz / m * sp : 0, k = Math.min(1, dt * 12);
    P.vx += (tx - P.vx) * k; P.vz += (tz - P.vz) * k;
    P.x += P.vx * dt; P.z += P.vz * dt; Town.collide(P, 0.3);
    const v = Math.hypot(P.vx, P.vz); P.moving = v > 1;
    P.bob += dt * v * 1.9; P.stepT -= dt * v;
    if (P.stepT <= 0 && v > 1) { P.stepT = P.running ? 2.3 : 1.55; Snd.sfx('step', { v: P.running ? 1 : 0.55 }); }
    if (P.stamina < 0.35) { G.pantT -= dt; if (G.pantT <= 0) { G.pantT = 0.62; Snd.sfx('pant', { v: 1 - P.stamina }); } }
  }
  function updHome(dt) {
    const h = Town.home, P = G.P, d = Math.hypot(h.x - P.x, h.z - P.z), near = d < 1.9;
    el['h-prompt'].hidden = !near; el['b-act'].hidden = !near;
    if (near) {
      el['h-ptx'].textContent = G.touch ? '「鍵」を 押しつづける' : 'E を 押しつづけて 鍵を 開ける';
      if (Input.act) { G.unlock += dt; G.keyT -= dt; if (G.keyT <= 0) { G.keyT = 0.33; Snd.sfx('key'); } if (G.unlock >= PRM.unlock) { clear(); return; } } else G.unlock = Math.max(0, G.unlock - dt * 1.5);
    } else G.unlock = 0;
    el['h-pbar'].style.width = Math.round(G.unlock / PRM.unlock * 100) + '%';
    // 自宅の方向と距離（画面の外なら、ふちに出す）
    _v.set(h.x, 1.6, h.z).project(camera);
    const behind = _v.z > 1, w = el.app.clientWidth, hh = el.app.clientHeight;
    let sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * hh;
    if (behind) { sx = w - sx; sy = hh - 40; }
    sx = clamp(sx, 44, w - 44); sy = clamp(sy, 54, Math.max(60, hh - (G.touch ? 215 : 110)));   // 指で操作する部品には重ねない
    el['h-home'].style.transform = 'translate(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px) translate(-50%,-50%)'; el['h-dist'].textContent = Math.round(d) + 'm';
    el['h-home'].hidden = near;
  }
  // 近くの明かりだけを、ほんとうに光らせる
  function updLights(dt, x, z) {
    G.lampT -= dt; if (G.lampT > 0) return; G.lampT = 0.25;
    // 手もとに近い明かりと、彼にいちばん近い明かり（遠くにいても、街灯の下の彼が見えるように）
    const ls = Town.lampsNear(x, z, lights.length - 1), near = Town.lampsNear(Anton.x, Anton.z, 2).find(q => ls.indexOf(q) < 0);
    if (near) ls.push(near);
    lights.forEach((l, i) => { const s = ls[i]; if (!s) { l.intensity = 0; return; } l.position.set(s.x, s.y, s.z); l.color.set(s.c).convertSRGBToLinear(); l.intensity = 1.25 * s.p; });
  }
  function view(dt) {
    const P = G.P, v = Math.hypot(P.vx, P.vz);
    let sx = 0, sy = 0; if (G.shakeT > 0) { G.shakeT -= dt; const a = G.shakeA * G.shakeT / 0.35; sx = (Math.random() - 0.5) * a; sy = (Math.random() - 0.5) * a; }
    camera.position.set(P.x + sx, PRM.eye + Math.sin(P.bob * 2) * 0.035 * Math.min(1, v / 4) + sy, P.z);
    camera.rotation.set(P.pitch * (1 - P.backK * 0.6), P.yaw + Math.PI + P.backK * Math.PI, Math.sin(P.bob) * 0.012 * Math.min(1, v / 5));
    camera.fov += (vfov(Anton.st === 'stand' ? PRM.fovStand : P.running ? PRM.fov + PRM.fovRun : PRM.fov) - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix();   // 彼が走りだすと、画が広がる
  }

  function frame(dt) {
    G.t += dt; Input.update(dt);
    const m = G.mode;
    if (m === 'play') {
      if (Input.pauseHit) pause();
      else {
        G.time += dt; updPlayer(dt); Anton.update(dt, G.P);
        if (G.mode === 'play') {
          updHome(dt); view(dt);
          // 彼が近いほど、心臓が速く鳴り、画面のふちが暗くなる
          const d = Anton.d, k = Anton.st === 'stand' ? 0 : clamp(1 - d / 32, 0, 1);
          el.vig.style.opacity = String(0.55 + 0.45 * k);
          if (k > 0.05) { G.heartT -= dt; if (G.heartT <= 0) { G.heartT = lerp(1.0, 0.36, k); Snd.sfx('heart', { v: 0.35 + 0.65 * k }); } }
          el['h-stam'].style.width = Math.round(G.P.stamina * 100) + '%'; el['h-stam'].className = G.P.stamina < PRM.staminaMin && !G.P.running ? 'low' : '';
          if (G.msgT > 0) { G.msgT -= dt; if (G.msgT <= 0) el['h-msg'].textContent = ''; }
          if (!G.touch && !G.locked && !G.looked && G.msgT <= 0) say(G.noLock ? 'マウスを 押したまま 動かすと、見回せる。' : '画面を クリックすると、マウスで 見回せる。', 2);   // いちど見回したら、もう出さない
        }
      }
    } else if (m === 'death') {
      Death.update(dt, camera);
      if (G.t > 0 && Death.on && Death.t > 0.8 && Input.anyHit) Death.finish();
      if (Death.on) el.black.style.opacity = String(smooth(seg(Death.t, Death.end - 0.7, Death.end)));
    } else if (m === 'title') {
      // 題の背景: 通りの先、街灯の下に、彼が立っている
      const P = G.P; Body.stand(Anton.J, G.t); Anton.yaw = Math.atan2(P.x - Anton.x, P.z - Anton.z); Anton.place();
      const tf = vfov(PRM.fovStand + 4); if (camera.fov !== tf) { camera.fov = tf; camera.updateProjectionMatrix(); }
      camera.position.set(P.x + Math.sin(G.t * 0.3) * 0.15, PRM.eye, P.z); camera.rotation.set(Math.sin(G.t * 0.23) * 0.015, P.yaw + Math.PI + Math.sin(G.t * 0.17) * 0.05, 0);
    }
    if (m !== 'boot') {
      sky.position.copy(camera.position); updLights(dt, camera.position.x, camera.position.z); Snd.tick(dt);
      if (G.noDraw) { /* 試験で早送りするときは描かない */ } else if (m === 'death' && Death.xray) renderer.render(Death.xr.scene, Death.xr.cam); else renderer.render(scene, camera);
    }
    Input.endFrame();
  }
  let last = 0;
  function loop(now) { const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; if (!G.hold) frame(dt); requestAnimationFrame(loop); }   // hold: 試験で、手動で進めるとき
  function go() { last = performance.now(); requestAnimationFrame(loop); }
  // 試験用: 止めたまま、決まった時間だけ進める
  function step(dt, n, quiet) { G.noDraw = true; for (let i = 1; i < (n || 1); i++) frame(dt); G.noDraw = !!quiet; frame(dt); G.noDraw = false; }   // n 回進めて、最後の 1 回だけ描く（quiet なら描かない）
  Object.assign(G, { init, go, title, startDay, pause, caught, dead, clear, say, shake, flash, onRun, onLost, onFound, lock, step });
  for (const [k, f] of [['camera', () => camera], ['scene', () => scene], ['renderer', () => renderer]]) Object.defineProperty(G, k, { get: f });   // 試験から見えるように
  return G;
})();
