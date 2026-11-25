// ui.js — 風景の上に重ねる文字とボタン（DOM）。
import { drawYuriaFace, drawYuriaFront } from './yuria.js';
import { markIcon, MARKS } from './art.js';
import { STYLE } from '../../chase/src/chibi.js';

const $ = (id) => document.getElementById(id);
const fmt = (t) => { const tt = Math.round(t * 10), m = Math.floor(tt / 600), s = (tt - m * 600) / 10; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
const ICON_ON = '<svg viewBox="0 0 20 20"><path d="M3 8h3l4-3.5v11L6 12H3z"/><path d="M13 7.5c1.2 1.4 1.2 3.6 0 5M15.2 5.5c2.2 2.6 2.2 6.4 0 9"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 20 20"><path d="M3 8h3l4-3.5v11L6 12H3z"/><path d="M13.5 8l4 4M17.5 8l-4 4"/></svg>';
const KEY = 'yuria-sky:v1';

export class UI {
  constructor(actions) {
    this.act = actions;
    this.settings = { quality: 'auto', invert: false, sound: true, best: null };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 保存できない環境でも動く */ }
    this.mood = 'smile'; this.talkUntil = 0; this.mode = 'boot'; this.panelFor = null; this.hintUntil = 0;
    // 紋章の並び
    this.icons = MARKS.map((m) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; cv.title = m.name; $('marks').appendChild(cv); markIcon(cv, m.id, false); return cv; });
    // 押したあとは風景にフォーカスを戻す（スペースキーの「加速」で、さっきのボタンがもう一度押されてしまわないように）
    const on = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); this.act.click(); fn(e); if ($(id).closest('#hud') && $('panel').hidden) $('view').focus({ preventScroll: true }); });
    on('btnCourse', () => this.act.course());
    on('btnFree', () => this.act.free());
    on('btnHow', () => this.openPanel('title'));
    on('btnPause', () => this.act.pause());
    on('btnSound', () => this.set('sound', !this.settings.sound));
    on('btnLook', () => this.act.look());
    on('btnResume', () => this.act.resume());
    on('btnRetry', () => this.act.retry());
    on('btnQuit', () => this.act.title());
    on('btnAgain', () => this.act.course());
    on('btnStroll', () => this.act.free());
    on('btnHome', () => this.act.title());
    for (const [seg, key, conv] of [['segQuality', 'quality', (v) => v], ['segInvert', 'invert', (v) => v === '1'], ['segSound', 'sound', (v) => v === '1']])
      $(seg).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; this.act.click(); this.set(key, conv(b.dataset.v)); });
    // 加速ボタン（押しているあいだ）
    const bb = $('btnBoost');
    const press = (v) => (e) => { e.preventDefault(); if (v) { try { bb.setPointerCapture(e.pointerId); } catch (err) { /* 古い環境 */ } } bb.classList.toggle('on', v); this.act.boost(v); };
    bb.addEventListener('pointerdown', press(true)); bb.addEventListener('pointerup', press(false)); bb.addEventListener('pointercancel', press(false)); bb.addEventListener('lostpointercapture', () => { bb.classList.remove('on'); this.act.boost(false); });
    bb.addEventListener('contextmenu', (e) => e.preventDefault());
    $('dayRange').addEventListener('input', (e) => this.act.day(+e.target.value / 100));
    $('dayFlow').addEventListener('change', (e) => this.act.flow(e.target.checked));
    this.faceCtx = $('face').getContext('2d'); this.titleCtx = $('titleYuria').getContext('2d');
    this.sync();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch (e) { /* 保存できない環境でも動く */ } }
  set(key, v) { this.settings[key] = v; this.save(); this.sync(); this.act.setting(key, v); }
  sync() {
    const s = this.settings, mark = (seg, v) => { for (const b of $(seg).children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); };
    mark('segQuality', s.quality); mark('segInvert', s.invert ? '1' : '0'); mark('segSound', s.sound ? '1' : '0');
    $('btnSound').innerHTML = s.sound ? ICON_ON : ICON_OFF;
  }

  boot(p, msg) { $('bootBar').style.width = `${Math.round(p * 100)}%`; if (msg) $('bootMsg').textContent = msg; }
  fatal(msg) { $('boot').hidden = true; $('fatal').hidden = false; $('fatalMsg').textContent = msg; }
  show(mode) {
    this.mode = mode;
    $('boot').hidden = true;
    $('title').hidden = mode !== 'title';
    $('hud').hidden = !(mode === 'course' || mode === 'free' || mode === 'finish');
    $('result').hidden = true; $('panel').hidden = true; this.panelFor = null;
    const course = mode === 'course' || mode === 'finish';
    $('marks').parentElement.style.visibility = course ? 'visible' : 'hidden';
    $('stats').style.visibility = course ? 'visible' : 'hidden';
    $('freeBar').hidden = mode !== 'free';
    $('gauge').style.visibility = mode === 'finish' ? 'hidden' : 'visible';
    $('btnBoost').style.visibility = mode === 'finish' ? 'hidden' : 'visible';
    $('btnPause').style.visibility = mode === 'finish' ? 'hidden' : 'visible';
    $('target').style.opacity = 0; $('toast').classList.remove('show'); $('talk').style.visibility = 'visible';
    if (mode === 'course') { this.icons.forEach((cv, i) => { markIcon(cv, MARKS[i].id, false); cv.classList.toggle('next', i === 0); }); this.setNext(0); $('time').textContent = '0:00.0'; $('lights').textContent = '✦ 0'; }
    if (mode === 'course' || mode === 'free') this.hint(matchMedia('(hover: none) and (pointer: coarse)').matches ? '画面をさわって、行きたいほうへ指をずらす' : 'マウスを行きたいほうへ（矢印キーでも）。クリックで加速', 7);
    if (mode === 'title') { $('talkText').classList.remove('show'); }
  }
  hint(text, sec) { const h = $('hint'); h.textContent = text; h.classList.remove('gone'); this.hintUntil = performance.now() + sec * 1000; }
  setNext(k) { const m = MARKS[k]; $('nextLabel').innerHTML = m ? `つぎ ▸ <b>${m.name}</b>の紋章　<span style="opacity:.7">${k + 1} / ${MARKS.length}</span>` : ''; }
  gate({ k, name, center, last }) {
    markIcon(this.icons[k], MARKS[k].id, true);
    this.icons.forEach((cv, i) => cv.classList.toggle('next', i === k + 1));
    this.setNext(k + 1);
    this.toast(`${name}の紋章`, center ? 'ど真ん中' : last ? 'おかえり' : `${k + 1} / ${MARKS.length}`);
  }
  toast(text, small = '') { const t = $('toast'); t.innerHTML = (small ? `<small>${small}</small>` : '') + text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
  say({ text, mood }) { const p = $('talkText'); p.textContent = text; p.classList.add('show'); this.mood = mood; this.talkUntil = performance.now() + Math.max(2600, 900 + text.length * 130); }
  stick(s, on) { const el = $('stick'); el.style.opacity = on && s ? 1 : 0; if (on && s) { el.style.transform = `translate(${s.x0}px, ${s.y0 - $('app').getBoundingClientRect().top}px)`; el.firstElementChild.style.transform = `translate(${s.x * 40}px, ${-s.y * 40}px)`; } }
  openPanel(kind) {
    this.panelFor = kind; $('panel').hidden = false;
    $('panelTitle').textContent = kind === 'pause' ? 'ひとやすみ' : 'あそびかた';
    $('btnRetry').hidden = kind !== 'pause'; $('btnQuit').hidden = kind !== 'pause';
    $('btnResume').textContent = kind === 'pause' ? 'つづける' : 'とじる';
    $('perf').textContent = this.act.status();
    $('btnResume').focus({ preventScroll: true });
  }
  closePanel() { $('panel').hidden = true; this.panelFor = null; }
  result(r) {
    $('result').hidden = false; $('talk').style.visibility = 'hidden';
    $('rTime').textContent = fmt(r.time);
    $('rLights').innerHTML = `${r.lights}<small>/ ${r.totalLights}</small>`;
    $('rCenters').innerHTML = `${r.centers}<small>/ ${r.gates}</small>`;
    // ユリアのひとこと（飛び方で変わる）
    const [line, mood] = r.centers >= r.gates ? ['ぜんぶど真ん中！？　やば、うける♡　……また行こ♡', 'love']
      : r.lights >= r.totalLights * 0.85 ? ['光の粒、ほとんど集めたじゃん。すごっ♪　……また行こ♡', 'happy']
      : r.time < 85 ? ['はやっ。あーしより飛ばすじゃん、うける。……また行こ♡', 'wink']
      : ['今日は、いっしょに飛んでくれてありがと。……また行こ♡', 'love'];
    $('rSay').textContent = line;
    { const c = $('rFace').getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 128, 128); c.setTransform(45, 0, 0, 45, 64, 69); STYLE.lw = 1.5; drawYuriaFace(c, mood, 1.0); STYLE.lw = 1; }
    const b = this.settings.best;
    if (!b || r.time < b) { this.settings.best = r.time; this.save(); $('best').textContent = b ? `いちばん速い記録を更新（これまで ${fmt(b)}）` : ''; }
    else $('best').textContent = `いちばん速い記録 ${fmt(b)}`;
    $('btnAgain').focus({ preventScroll: true });
  }

  // 毎フレーム
  update(game, t) {
    const now = performance.now();
    if (this.mode === 'title') {
      const c = this.titleCtx, cv = c.canvas;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(118, 0, 0, 118, cv.width * 0.48, 200 + 10 * Math.sin(t * 1.6)); STYLE.lw = 1.1;
      drawYuriaFront(c, { t, mood: (t % 9) > 7.4 ? 'happy' : 'grin', wave: (t % 9) > 5.6 ? 1 : 0 }); STYLE.lw = 1;
      return;
    }
    // 顔
    const c = this.faceCtx; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 160, 160);
    c.setTransform(56, 0, 0, 56, 80, 86); STYLE.lw = 1.5; drawYuriaFace(c, now < this.talkUntil ? this.mood : game.y.mood, t); STYLE.lw = 1;
    if (now > this.talkUntil) $('talkText').classList.remove('show');
    if (this.hintUntil && (now > this.hintUntil || game.started)) { $('hint').classList.add('gone'); this.hintUntil = 0; }
    if (this.mode === 'course' || this.mode === 'finish') { $('time').textContent = fmt(game.time); }
    const g = $('gauge'), bb = $('btnBoost'); g.firstElementChild.style.transform = `scaleX(${game.y.gauge.toFixed(3)})`; g.classList.toggle('lock', game.y.lock); bb.style.setProperty('--g', game.y.gauge.toFixed(3)); bb.classList.toggle('lock', game.y.lock);
    if (this.mode === 'free' && game.freeFlow) $('dayRange').value = Math.round(game.freeDay > 1 ? Math.max(0, 1 - (game.freeDay - 1) / 0.22) * 100 : game.freeDay * 100);
    // つぎの輪の目印
    const tg = game.target(), el = $('target');
    if (!tg || game.paused) el.style.opacity = 0;
    else {
      const r = $('app').getBoundingClientRect();
      el.style.opacity = tg.on && tg.dist < 16 ? 0 : 0.95; el.classList.toggle('off', !tg.on);
      el.style.transform = `translate(${(tg.x * r.width).toFixed(1)}px, ${(tg.y * r.height).toFixed(1)}px)`;
      el.firstElementChild.style.transform = tg.on ? '' : `rotate(${tg.ang.toFixed(3)}rad)`;
      el.lastElementChild.textContent = tg.on ? `あと ${Math.round(tg.dist * 10)}` : '';
    }
  }
  lights(n) { $('lights').textContent = `✦ ${n}`; }
}
