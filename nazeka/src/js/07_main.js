// ───────── 起動と、入力のつなぎこみ ─────────
function boot() {
  Store.load(); Snd.mute(!!Store.d.mute);
  if (typeof THREE === 'undefined') { document.querySelector('#p-title .sub').textContent = '3D の 部品を 読みこめませんでした。通信を 確かめて、開きなおして ください。'; return; }
  if (!Game.init()) return;
  const $ = id => document.getElementById(id), cv = $('cv'), stick = $('stick'), knob = $('knob');
  // 題の画面
  const lab = () => { $('t-snd').textContent = '音　' + (Store.d.mute ? '切' : '入'); $('t-skip').textContent = '死亡場面　' + (Store.d.skip ? '飛ばす' : '見る'); };
  lab();
  $('t-help').textContent = Game.touch ? '左下の 棒で 移動（大きく 倒すと 走る）。画面を なぞって 見回す。「振り返る」は 押している あいだ。'
    : '移動 W A S D　見回す マウス（または ← →）　走る Shift　振り返る Q を 押している あいだ　鍵 E　中断 Esc';
  $('t-start').addEventListener('click', () => { Snd.unlock(); Snd.sfx('ui'); Game.startDay(1, false); });
  $('t-snd').addEventListener('click', () => { Store.d.mute = Store.d.mute ? 0 : 1; Store.save(); Snd.mute(Store.d.mute); lab(); });
  $('t-skip').addEventListener('click', () => { Store.d.skip = Store.d.skip ? 0 : 1; Store.save(); lab(); });
  $('b-pause').addEventListener('click', () => Game.pause());
  // キーボード・マウス
  window.addEventListener('keydown', e => { const k = Input.KEYS[e.code]; if (k && !e.ctrlKey && !e.metaKey && !e.altKey) { Input.press(k); if (Game.mode === 'play' || Game.mode === 'death') e.preventDefault(); } });
  window.addEventListener('keyup', e => { const k = Input.KEYS[e.code]; if (k) Input.release(k); });
  window.addEventListener('blur', () => Input.clear());
  document.addEventListener('visibilitychange', () => { Snd.pause(document.hidden); Input.clear(); if (document.hidden) Game.pause(); });
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => Snd.unlock(), true);
  document.addEventListener('pointerlockchange', () => { const was = Game.locked; Game.locked = document.pointerLockElement === cv; if (Game.locked) Game.noLock = false; if (was && !Game.locked) Game.pause(); });   // Esc で視点の固定が外れたら、中断にする
  document.addEventListener('pointerlockerror', () => { Game.noLock = true; });
  document.addEventListener('mousemove', e => { if (Game.locked) { Input.lookX += e.movementX * 0.0023; Input.lookY += e.movementY * 0.0023; } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // 画面をなぞって見回す（タッチ）。マウスなら、クリックで視点を固定する
  let lid = null, lx = 0, ly = 0;
  cv.addEventListener('pointerdown', e => {
    Input.anyHit = true;
    if (e.pointerType === 'mouse' && Game.mode === 'play' && !Game.locked) Game.lock();   // 固定できなくても、押したまま動かせば見回せる
    lid = e.pointerId; lx = e.clientX; ly = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ }
  });
  cv.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; Input.lookX += (e.clientX - lx) * 0.0052; Input.lookY += (e.clientY - ly) * 0.0042; lx = e.clientX; ly = e.clientY; });
  for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, e => { if (e.pointerId === lid) lid = null; });
  // 移動の棒
  let sid = null;
  const setStick = e => {
    const r = stick.getBoundingClientRect(), R0 = 44; let x = (e.clientX - (r.left + r.width / 2)) / R0, y = (e.clientY - (r.top + r.height / 2)) / R0;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    Input.stick.on = true; Input.stick.x = x; Input.stick.y = y; knob.style.transform = 'translate(' + Math.round(x * R0) + 'px,' + Math.round(y * R0) + 'px)';
  };
  const endStick = () => { sid = null; Input.stick.on = false; Input.stick.x = Input.stick.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ } setStick(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) setStick(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(ev, endStick);
  for (const [id, key] of [['b-back', 'tBack'], ['b-act', 'tAct']]) {
    const b = $(id), up = () => { Input[key] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ } Input[key] = true; Input.anyHit = true; b.classList.add('on'); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  window.addEventListener('touchstart', () => { if (!Game.touch) { Game.touch = true; } }, { passive: true });
  Game.title(); Game.go();
  if (DEBUG) window.ATL = { Game, Anton, Town, Death, Body, Snd, PRM, Input, Store };
}
boot();
