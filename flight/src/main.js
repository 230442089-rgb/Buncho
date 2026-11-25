// main.js — 起動と毎フレームの進行。
import { GFX, safeSearch } from './gfx.js';
import { Terrain } from './terrain.js';
import { Renderer, QUALITY } from './render.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { YuriaSprite } from './yuria.js';
import { fxAtlas, marksAtlas } from './art.js';

const $ = (id) => document.getElementById(id);
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

async function start() {
  const q = new URLSearchParams(safeSearch());
  const canvas = $('view'), app = $('app');
  const F = window.__flight = { state: 'loading' };
  const sound = new Sound(window.__FLIGHT_ASSETS || {});
  let game = null, R = null, input = null, autoQ = 'mid', booted = false, dirty = true, dead = false;

  const pause = (on) => {
    if (!game || !(game.mode === 'course' || game.mode === 'free')) return;
    game.paused = on; input.enabled = !on; dirty = true;
    if (on) { ui.openPanel('pause'); sound.setMusic(0.3, 0.3); } else { ui.closePanel(); sound.setMusic(0.62, 0.5); canvas.focus({ preventScroll: true }); }
  };
  const applyQuality = (v) => { if (!R) return; const qq = v === 'auto' ? autoQ : v; if (R.quality !== qq) { R.setQuality(qq); R.scaleIdx = Math.min(R.scaleIdx, 4); R.failAt = -1; dirty = true; } };
  const ui = new UI({
    click: () => { sound.unlock(); sound.play('click', { gain: 0.45 }); },
    course: () => { input.enabled = true; game.startCourse(); sound.setMusic(0.62, 0.5); wake(); canvas.focus({ preventScroll: true }); },
    free: () => { input.enabled = true; game.startFree(); sound.setMusic(0.62, 0.5); wake(); canvas.focus({ preventScroll: true }); },
    pause: () => pause(true),
    resume: () => { if (ui.panelFor === 'pause') pause(false); else ui.closePanel(); },
    retry: () => { const m = game.mode; pause(false); if (m === 'free') game.startFree(); else game.startCourse(); },
    title: () => { input.enabled = true; game.toTitle(); sound.setMusic(0.62, 0.5); },
    look: () => game.lookBack(),
    boost: (v) => { if (input) input.btnBoost = v; },
    day: (v) => { game.freeDay = v; game.freeFlow = false; $('dayFlow').checked = false; },
    flow: (v) => { game.freeFlow = v; },
    setting: (key, v) => { if (key === 'sound') sound.setMuted(!v); if (key === 'invert' && input) input.invert = v; if (key === 'sens' && input) input.sens = v; if (key === 'quality') applyQuality(v); },
    // 設定の板に出す「いまの描画」（うまく動かないときに、どの状態かを伝えてもらえるように）
    status: () => (R ? `いまの描画　${R.stats.w}×${R.stats.h}・${{ low: '軽い', mid: 'ふつう', high: 'きれい' }[R.quality]}・毎秒 ${Math.round(1 / Math.max(R.dtAvg, 1e-3))} こま${R.hdr ? '' : '・予備の描き方'}` : ''),
  });
  sound.muted = !ui.settings.sound;
  let lock = null;
  const wake = () => { try { if (navigator.wakeLock && !lock) navigator.wakeLock.request('screen').then((l) => { lock = l; l.addEventListener('release', () => { lock = null; }); }).catch(() => {}); } catch (e) { /* 無い環境 */ } };

  ui.boot(0.02);
  let g;
  try { g = new GFX(canvas); } catch (e) { ui.fatal('このブラウザでは 3D の描画（WebGL2）が使えないため、動かせませんでした。別のブラウザか端末で開いてみてください。'); F.state = 'error'; F.error = 'nowebgl2'; return; }
  const fit = () => {
    const r = app.getBoundingClientRect(); let s = Math.min(window.devicePixelRatio || 1, 2);
    const px = r.width * r.height * s * s; if (px > 2.4e6) s *= Math.sqrt(2.4e6 / px);
    const w = Math.max(2, Math.round(r.width * s)), h = Math.max(2, Math.round(r.height * s));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
  };
  fit(); window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(app);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ui.fatal('描画が止まってしまいました。ページを開き直すと、また飛べます。'); F.state = 'error'; });

  const sync = q.has('sync');
  const T = new Terrain(g);
  await T.bake((p) => ui.boot(0.04 + p * 0.72, `山と湖をつくっています… ${Math.round(p * 100)}%`), sync ? async () => {} : frame);
  R = new Renderer(g, T);
  ui.boot(0.8, '光と影をととのえています…');
  if (!sync) await frame();
  const forced = q.get('q') || (ui.settings.quality !== 'auto' ? ui.settings.quality : null);
  R.quality = forced || 'mid';
  const progs = [R.compileWorld(R.quality), ...R.compileRest()];
  if (!sync) { let n = 0; while (!progs.every((p) => g.done(p)) && n++ < 1200) await frame(); }
  progs.forEach((p) => g.finish(p));
  R.allocShadow(); R.makeStars();
  ui.boot(0.9, 'ユリアを呼んでいます…');
  if (!sync) await frame();

  const sprite = new YuriaSprite(q.has('q') || (window.devicePixelRatio || 1) >= 1.5 ? 512 : 384);
  const tex = [g.fromCanvas(fxAtlas(), { filter: 'mip' }), g.fromCanvas(marksAtlas(), { filter: 'mip' }), g.fromCanvas(sprite.cv, { filter: 'linear' })];
  input = new Input(canvas, {
    stick: (s, on) => ui.stick(s, on),
    key: (k) => {
      if (k === 'p' || k === 'Escape') { if (ui.panelFor === 'title') ui.closePanel(); else pause(!game.paused); }
      else if (k === 'm') ui.set('sound', !ui.settings.sound);
      else if (k === 'r') game.lookBack();
      else if (k === 'Enter' && game.mode === 'title' && !ui.panelFor) { sound.unlock(); game.startCourse(); }
    },
  });
  input.invert = !!ui.settings.invert; input.sens = +ui.settings.sens || 1;
  canvas.addEventListener('pointerdown', () => sound.unlock(), { passive: true });
  game = new Game({
    T, R, input, sound, sprite, tex,
    hooks: {
      mode: (m) => { if (booted) ui.show(m); }, say: (d) => ui.say(d), gate: (d) => ui.gate(d), light: (n) => ui.lights(n),
      result: (r) => ui.result(r),
    },
  });
  game.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  ui.boot(0.95, '画質をこの端末に合わせています…');
  if (!sync) await frame();

  // ---- この端末の速さを測って、画質と内部解像度の初期値を決める
  R.auto = false; R.sized = null;
  if (!q.has('fixed')) {
    const gl = g.gl, px = new Uint8Array(4), wait = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    game.update(1 / 60); game.draw(); wait();
    const t0 = performance.now(); game.draw(); game.draw(); const t1 = performance.now(); wait();
    // 描く命令を出す時間（CPU）と描き終わるまでの時間（GPU）は重なって進むので、CPU のぶんは割り引いて見積もる
    const ms = Math.max(0.4, (performance.now() - t0 - 0.6 * (t1 - t0)) / 2), budget = (R.stats.w * R.stats.h / ms) * 11;
    F.bench = { ms, budget }; R.fastHint = ms < 9;
    autoQ = budget >= 1.5e6 ? 'high' : budget >= 0.22e6 ? 'mid' : 'low';
    if (!forced && autoQ !== R.quality) { const pr = R.compileWorld(autoQ); if (!sync) { let n = 0; while (!g.done(pr) && n++ < 1200) await frame(); } g.finish(pr); R.setQuality(autoQ); }
    const Q = QUALITY[R.quality], cost = { low: 0.75, mid: 1, high: 1.5 }[R.quality];
    const want = Math.sqrt(Math.min(1, (budget / cost) / Math.min(Q.px, canvas.width * canvas.height)));
    R.scaleIdx = R.startIdx = Math.max(0, [0.34, 0.42, 0.5, 0.6, 0.7, 0.82, 1.0].filter((s) => s <= want).length - 1);
    R.auto = true; R.sized = null;
  }
  if (q.has('fixed')) R.auto = false;
  booted = true;
  game.reset('title');

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
  window.addEventListener('blur', () => { if (game.mode === 'course' && game.started) pause(true); });

  // ---- 進行
  let last = performance.now();
  // 自動のとき: 余裕が続けば一段きれいに、いちばん下でも重ければ一段軽く（シェーダーの準備は裏で進め、できてから切りかえる）
  let pending = null, triedUp = false, wentUp = false;
  const retier = () => {
    if (ui.settings.quality !== 'auto' || q.has('q') || q.has('fixed')) return;
    if (pending) { if (g.done(pending.p)) { R.setQuality(pending.q); autoQ = pending.q; R.scaleIdx = pending.idx; R.failAt = -1; R.stuck = R.spare = 0; pending = null; } return; }
    if (!g.parallel) return;
    if (R.quality === 'mid' && !triedUp && R.spare > 10) { triedUp = true; wentUp = true; pending = { p: R.compileWorld('high'), q: 'high', idx: 4 }; }
    else if (R.quality === 'high' && wentUp && R.scaleIdx <= 2) { wentUp = false; R.setQuality('mid'); autoQ = 'mid'; R.scaleIdx = 5; }
    else if (R.quality !== 'low' && R.stuck > 6) pending = { p: R.compileWorld('low'), q: 'low', idx: 3 };
  };
  const tick = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (dead) return;
    try {
      game.update(dt);
      // 一時停止中は描き直さない（止まった絵のまま。電池を使わない）
      if (!game.paused || dirty) { game.draw(); dirty = false; if (!game.paused) { R.adapt(dt, now / 1000); retier(); } }
      ui.update(game, game.clock);
    } catch (e) { dead = true; console.error(e); ui.fatal('描画の途中で止まってしまいました。ページを開き直すと、また飛べます。'); F.state = 'error'; F.error = String((e && e.stack) || e); }
  };
  F.game = game; F.R = R; F.T = T; F.g = g; F.ui = ui; F.input = input; F.sound = sound;
  // 確認用: 決まった刻みで進めて描く
  F.step = (n = 1, dt = 1 / 30, draw = true) => { for (let i = 0; i < n; i++) game.update(dt); if (draw) { game.draw(); ui.update(game, game.clock); const px = new Uint8Array(4); g.gl.readPixels(0, 0, 1, 1, g.gl.RGBA, g.gl.UNSIGNED_BYTE, px); } return { mode: game.mode, prog: +game.prog.toFixed(1), next: game.next, day: +game.day.toFixed(3), pos: game.y.pos.map((v) => +v.toFixed(2)), time: +game.time.toFixed(1), res: R.stats.w + 'x' + R.stats.h, q: R.quality }; };
  F.state = 'ready';
  if (!q.has('manual')) { const loop = (now) => { tick(now); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
}

const boot = () => start().catch((e) => { console.error(e); window.__flight = { state: 'error', error: String((e && e.stack) || e) }; const m = document.getElementById('bootMsg'); if (m) m.textContent = 'うまく起動できませんでした: ' + (e && e.message); });
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot); else boot();
