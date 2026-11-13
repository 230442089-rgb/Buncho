// ───────── 起動と、入力のつなぎこみ ─────────
function boot() {
  Store.load(); Art.build(); Snd.mute(!!Store.d.mute);
  const $ = id => document.getElementById(id), cv = $('cv'), app = $('app'), pad = $('pad'), stick = $('stick'), knob = $('knob');
  let touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  // 画面に入るいちばん大きな倍率にする。ドットがそろう倍率（端末の画素の整数倍）を優先
  function fit() {
    pad.hidden = !touch;
    const AW = app.clientWidth, AH = app.clientHeight, dpr = window.devicePixelRatio || 1;
    const side = touch && AW > AH * 1.3, padH = touch && !side ? 172 : 0, padW = side ? 340 : 0;
    const fitS = Math.min((AW - padW) / W, (AH - padH) / H);
    let s = Math.floor(fitS * dpr) / dpr;
    if ((s < fitS * 0.88 || s <= 0) && (dpr >= 1.5 || fitS < 1)) s = fitS >= 1 ? Math.floor(fitS * 4) / 4 : Math.floor(fitS * 100) / 100;
    s = clamp(s, 0.4, 6);
    cv.style.width = Math.round(W * s * dpr) / dpr + 'px'; cv.style.height = Math.round(H * s * dpr) / dpr + 'px';
    cv.style.marginTop = Math.max(0, Math.round((AH - padH - H * s) / 2)) + 'px';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('touchstart', () => { if (!touch) { touch = true; fit(); } }, { passive: true });
  window.addEventListener('blur', () => Input.clear());
  document.addEventListener('visibilitychange', () => { Snd.pause(document.hidden); Input.clear(); });
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, () => Snd.unlock(), true);
  window.addEventListener('keydown', e => { const k = Input.KEYS[e.code]; if (k && !e.ctrlKey && !e.metaKey && !e.altKey) { Input.press(k); e.preventDefault(); } });
  window.addEventListener('keyup', e => { const k = Input.KEYS[e.code]; if (k) { Input.release(k); e.preventDefault(); } });
  cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); Game.pointer((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  // 移動の棒。大きく倒すと走る。メニューでは上下左右のひと押しになる
  let sid = null, nav = null;
  const setStick = e => {
    const r = stick.getBoundingClientRect(), R0 = 46;
    let x = (e.clientX - (r.left + r.width / 2)) / R0, y = (e.clientY - (r.top + r.height / 2)) / R0;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    Input.stick.on = true; Input.stick.x = x; Input.stick.y = y;
    knob.style.transform = 'translate(' + Math.round(x * R0) + 'px,' + Math.round(y * R0) + 'px)';
    const d = m < 0.5 ? null : Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
    if (d !== nav) { nav = d; if (d) { Input[d + 'Hit'] = true; Input.anyHit = true; } }
  };
  const endStick = () => { sid = null; nav = null; Input.stick.on = false; Input.stick.x = Input.stick.y = 0; knob.style.transform = ''; stick.classList.remove('on'); };
  stick.addEventListener('pointerdown', e => { e.preventDefault(); sid = e.pointerId; stick.classList.add('on'); try { stick.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ } setStick(e); });
  stick.addEventListener('pointermove', e => { if (e.pointerId === sid) setStick(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(ev, endStick);
  stick.addEventListener('contextmenu', e => e.preventDefault());
  for (const [id, k] of [['b-act', 'act'], ['b-bag', 'bag']]) {
    const b = $(id), up = () => { Input.release(k); b.classList.remove('on'); };
    b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ } Input.press(k); b.classList.add('on'); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, up);
    b.addEventListener('contextmenu', e => e.preventDefault());
  }
  fit();
  Game.init(cv); Game.title(); Game.go();
  if (DEBUG) window.ATL = { Game, Anton, World, Snd, PRM, Input, Store, STAGES, Art };
}
const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('16px AtelierDot', 'CALL IT 表か裏か').catch(() => {}) : Promise.resolve();
Promise.race([fontReady, wait(2500)]).then(() => { Text.clear(); boot(); });
