// main.js — 起動と毎フレームの進行。
import { GFX, safeSearch } from '../../flight/src/gfx.js';
import { Terrain } from '../../flight/src/terrain.js';
import { Renderer, QUALITY } from '../../flight/src/render.js';
import { fxAtlas } from '../../flight/src/art.js';
import { Strike } from './game.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { UI } from './ui.js';
import { Meshes } from './mesh.js';
import { Figures, attach } from './figure.js';
import { Faces, Cast, poseYuria, poseBuncho, place } from './cast.js';
import { camera } from '../../flight/src/render.js';
import { daylight } from '../../flight/src/sky.js';
import { strikeAtlas } from './art.js';

const $ = (id) => document.getElementById(id);
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const LIVE = (m) => m === 'play' || m === 'boss';

async function start() {
  const q = new URLSearchParams(safeSearch());
  const canvas = $('view'), app = $('app');
  const F = window.__flight = { state: 'loading' };
  const sound = new Sound(window.__FLIGHT_ASSETS || {});
  let game = null, R = null, input = null, autoQ = 'mid', booted = false, dirty = true, dead = false;

  const pause = (on) => {
    if (!game || !LIVE(game.mode)) return;
    game.paused = on; input.enabled = !on; if (on) input.clear(); dirty = true;
    if (on) { ui.openPanel('pause'); sound.setMusic(0.2, 0.3); } else { ui.closePanel(); sound.setMusic(0.5, 0.5); canvas.focus({ preventScroll: true }); }
  };
  const applyQuality = (v) => { if (!R) return; const qq = v === 'auto' ? autoQ : v; if (R.quality !== qq) { R.setQuality(qq); R.scaleIdx = Math.min(R.scaleIdx, 4); R.failAt = -1; dirty = true; } };
  const begin = () => { game.paused = false; input.enabled = true; input.clear(); game.start(); wake(); canvas.focus({ preventScroll: true }); };
  const ui = new UI({
    click: () => { sound.unlock(); sound.play('click', { gain: 0.5 }); },
    start: begin,
    pause: () => pause(true),
    resume: () => { if (ui.panelFor === 'pause') pause(false); else ui.closePanel(); },
    retry: begin,
    title: () => { game.paused = false; input.enabled = true; game.toTitle(); },
    gallery: () => { game.paused = false; game.gallery(0); },
    galStep: (d) => { if (game.gal) game.galSet(game.gal.i + d); },
    galZoom: () => { if (game.gal) game.galZoom(game.gal.zoom > 1.2 ? 1 : 1.7); },
    cont: () => { input.clear(); game.resume(); canvas.focus({ preventScroll: true }); },
    lance: (v) => { if (input) { input.btnLance = v; if (v && input.enabled) input.lanceTap = true; } },
    wave: () => { if (input && input.enabled) input.waveTap = true; },
    setting: (key, v) => { if (key === 'sound') sound.setMuted(!v); if (key === 'sens' && input) input.sens = v; if (key === 'quality') applyQuality(v); },
    // 設定の板に出す「いまの描画」（うまく動かないときに、どの状態かを伝えてもらえるように）
    status: () => (R ? `いまの描画　${R.stats.w}×${R.stats.h}・${{ low: '軽い', mid: 'ふつう', high: 'きれい' }[R.quality]}・毎秒 ${Math.round(1 / Math.max(R.dtAvg, 1e-3))} こま${R.hdr ? '' : '・予備の描き方'}` : ''),
  });
  sound.muted = !ui.settings.sound;
  ui.credit('音楽 “Action Strike”・“Epic Boss Battle” Rafael Krux（CC0）');
  let lock = null;
  const wake = () => { try { if (navigator.wakeLock && !lock) navigator.wakeLock.request('screen').then((l) => { lock = l; l.addEventListener('release', () => { lock = null; }); }).catch(() => {}); } catch (e) { /* 無い環境 */ } };

  ui.boot(0.02);
  let g;
  try { g = new GFX(canvas, { depth: true }); } catch (e) { ui.fatal('このブラウザでは 3D の描画（WebGL2）が使えないため、動かせませんでした。別のブラウザか端末で開いてみてください。'); F.state = 'error'; F.error = 'nowebgl2'; return; }
  const fit = () => {
    const r = app.getBoundingClientRect(); let s = Math.min(window.devicePixelRatio || 1, 2);
    const px = r.width * r.height * s * s; if (px > 2.4e6) s *= Math.sqrt(2.4e6 / px);
    const w = Math.max(2, Math.round(r.width * s)), h = Math.max(2, Math.round(r.height * s));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
  };
  fit(); window.addEventListener('resize', fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(app);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ui.fatal('描画が止まってしまいました。ページを開き直すと、また戦えます。'); F.state = 'error'; });

  const sync = q.has('sync');
  const T = new Terrain(g);
  await T.bake((p) => ui.boot(0.04 + p * 0.7, `山と湖をつくっています… ${Math.round(p * 100)}%`), sync ? async () => {} : frame);
  R = new Renderer(g, T);
  ui.boot(0.78, '光と影をととのえています…');
  if (!sync) await frame();
  const forced = q.get('q') || (ui.settings.quality !== 'auto' ? ui.settings.quality : null);
  R.quality = forced || 'mid';
  const progs = [R.compileWorld(R.quality), ...R.compileRest()];
  if (!sync) { let n = 0; while (!progs.every((p) => g.done(p)) && n++ < 1200) await frame(); }
  progs.forEach((p) => g.finish(p));
  R.allocShadow(); R.makeStars();
  ui.boot(0.86, 'B.U.N の機体を組み立てています…');
  if (!sync) await frame();
  const meshes = new Meshes(g);
  const figs = new Figures(g, (window.__FLIGHT_ASSETS || {}).models);
  g.finish(figs.prog);
  const faces = new Faces(g), cast = new Cast(figs, faces);
  ui.boot(0.92, 'ユリアが槍を取りました…');
  if (!sync) await frame();

  const tex = [g.fromCanvas(fxAtlas(), { filter: 'mip' }), g.fromCanvas(strikeAtlas(), { filter: 'mip' })]; tex.push(tex[1]);
  input = new Input(canvas, {
    key: (k) => {
      if (k === 'p' || k === 'Escape') { if (ui.panelFor === 'title') ui.closePanel(); else pause(!game.paused); }
      else if (k === 'm') ui.set('sound', !ui.settings.sound);
      else if (k === 'Enter' && game.mode === 'title' && !ui.panelFor) { sound.unlock(); begin(); }
    },
  });
  input.sens = +ui.settings.sens || 1;
  canvas.addEventListener('pointerdown', () => sound.unlock(), { passive: true });
  // 3D モデルを見ているあいだ: ドラッグで回す。左右の矢印キーで前後のモデルへ
  let dragX = null;
  canvas.addEventListener('pointerdown', (e) => { if (game && game.mode === 'gallery') dragX = e.clientX; }, { passive: true });
  window.addEventListener('pointermove', (e) => { if (dragX !== null && game.mode === 'gallery') { game.galTurn((e.clientX - dragX) * 0.012); dragX = e.clientX; } }, { passive: true });
  for (const n of ['pointerup', 'pointercancel']) window.addEventListener(n, () => { dragX = null; }, { passive: true });
  window.addEventListener('keydown', (e) => { if (!game || game.mode !== 'gallery') return; if (e.key === 'ArrowLeft') game.galSet(game.gal.i - 1); else if (e.key === 'ArrowRight') game.galSet(game.gal.i + 1); else if (e.key === 'Escape') { game.toTitle(); } });
  // 場面ごとの曲と音量。題の画面の見本では、効果音を鳴らさない
  const scene = (m) => {
    sound.quiet = m === 'title' || m === 'gallery';
    if (m === 'title' || m === 'gallery') sound.setTrack('music', 0.4, 1.0);
    else if (m === 'play') sound.setTrack('music', 0.5, 0.5);
    else if (m === 'boss') sound.setTrack('boss', 0.56, 0.4);
    else if (m === 'down') sound.setMusic(0.2, 0.4);
    else if (m === 'fin') sound.setMusic(0.3, 0.6);
    else if (m === 'result') sound.setTrack('music', 0.4, 1.5);
  };
  game = new Strike({
    T, R, meshes, cast, input, sound, tex,
    hooks: {
      // 題の画面の見本が一巡して最初に戻るときは、画面を作り直さない（開いている「あそびかた・設定」を閉じてしまわないように）
      mode: (m) => { if (booted) { if (!(m === 'title' && ui.mode === 'title')) ui.show(m); scene(m); } }, say: (d) => ui.say(d), chain: (n) => ui.chain(n), warn: () => ui.warn(),
      result: (r) => ui.result(r), gallery: (d) => ui.gallery(d),
    },
  });
  game.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  ui.boot(0.96, '画質をこの端末に合わせています…');
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
  window.addEventListener('blur', () => { if (LIVE(game.mode)) pause(true); });

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
    } catch (e) { dead = true; console.error(e); ui.fatal('描画の途中で止まってしまいました。ページを開き直すと、また戦えます。'); F.state = 'error'; F.error = String((e && e.stack) || e); }
  };
  F.game = game; F.R = R; F.T = T; F.g = g; F.ui = ui; F.input = input; F.sound = sound; F.meshes = meshes; F.begin = begin;
  // 確認用: 決まった刻みで進めて描く
  F.info = () => ({ mode: game.mode, tm: +game.tm.toFixed(1), s: +game.s.toFixed(1), day: +game.day.toFixed(3), score: game.score, shield: game.P.shield, en: game.en.length, bul: game.bul.length, routed: game.routed, kills: game.kills, hits: game.hits, boss: game.boss ? +game.bossHP().toFixed(3) : null, res: R.stats.w + 'x' + R.stats.h, q: R.quality });
  F.step = (n = 1, dt = 1 / 30, draw = true) => { for (let i = 0; i < n; i++) game.update(dt); if (draw) { game.draw(); ui.update(game, game.clock); const px = new Uint8Array(4); g.gl.readPixels(0, 0, 1, 1, g.gl.RGBA, g.gl.UNSIGNED_BYTE, px); } return F.info(); };
  // 確認用: モデルを 1 体だけ、湖の上に置いて眺める
  F.figs = figs; F.poses = {}; F.faces = faces; F.cast = cast; F.poseYuria = poseYuria; F.poseBuncho = poseBuncho; F.place = place;
  F.viewFig = (o) => {
    const L = daylight(o.d ?? 0.36, 0), c = o.at || [-1, 3.2, 42], sc = o.scale ?? 0.25, D = Math.PI / 180;
    const rot = (o.rot ?? 0) * D, yaw = rot + (o.yaw ?? 0) * D, pitch = (o.pitch ?? 4) * D, dist = o.dist ?? 2.4;
    const ta = [c[0], c[1] + (o.cy ?? 0), c[2]], ro = [ta[0] + Math.sin(yaw) * Math.cos(pitch) * dist, ta[1] + Math.sin(pitch) * dist, ta[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
    const cam = camera(ro, ta, o.focal ?? 1.7);
    R.batch.begin(cam); meshes.begin(); figs.begin();
    for (const it of (o.items || [{ name: o.name, pose: o.pose, opt: o.opt }])) {
      const key = it.key || it.name, pose = F.poses[key] || (F.poses[key] = figs.pose(it.name)); pose.reset(); if (it.pose) it.pose(pose, figs); pose.update();
      const cs = Math.cos(rot), sn = Math.sin(rot), h0 = (it.h0 ?? o.h0 ?? 2.6), off = it.off || [0, 0, 0];
      const s2 = sc * (it.s ?? 1);
      let m = [cs * s2, 0, -sn * s2, 0, 0, s2, 0, 0, sn * s2, 0, cs * s2, 0, c[0] + off[0], c[1] - h0 * sc + off[1], c[2] + off[2], 1];
      if (it.on) m = attach(F.viewM[it.on], F.poses[it.on], it.bone);
      (F.viewM = F.viewM || {})[key] = m;
      figs.draw(pose, m, { ...(it.opt || {}), ...(it.face ? { face: faces.get(it.face, o.time ?? 3) } : {}) });
    }
    R.render(cam, L, { time: o.time ?? 3, cloudT: 0.5, shadowForce: true, tex: [T.noise, T.noise, T.noise], meshes: (ctx) => { meshes.flush(ctx, L, cam); figs.flush({ ...ctx, time: o.time ?? 3 }, L, cam); } });
    const px = new Uint8Array(4); g.gl.readPixels(0, 0, 1, 1, g.gl.RGBA, g.gl.UNSIGNED_BYTE, px);
    return figs.count;
  };
  F.state = 'ready';
  if (!q.has('manual')) { const loop = (now) => { tick(now); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
}

const boot = () => start().catch((e) => { console.error(e); window.__flight = { state: 'error', error: String((e && e.stack) || e) }; const m = document.getElementById('bootMsg'); if (m) m.textContent = 'うまく起動できませんでした: ' + (e && e.message); });
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot); else boot();
