// ui.js — 風景の上に重ねる文字とボタン（DOM）。
import { drawBattleFace } from './yuria.js';
import { head as birdHead, setLine } from './buncho.js';
import { STYLE } from '../../chase/src/chibi.js';

const $ = (id) => document.getElementById(id);
const num = (n) => Math.round(n).toLocaleString('en-US');
const ICON_ON = '<svg viewBox="0 0 20 20"><path d="M3 8h3l4-3.5v11L6 12H3z"/><path d="M13 7.5c1.2 1.4 1.2 3.6 0 5M15.2 5.5c2.2 2.6 2.2 6.4 0 9"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 20 20"><path d="M3 8h3l4-3.5v11L6 12H3z"/><path d="M13.5 8l4 4M17.5 8l-4 4"/></svg>';
const KEY = 'yuria-strike:v1';
const touch = () => matchMedia('(hover: none) and (pointer: coarse)').matches;

export class UI {
  constructor(actions) {
    this.act = actions;
    this.settings = { quality: 'auto', sound: true, sens: 1, best: null };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* 保存できない環境でも動く */ }
    this.mode = 'boot'; this.panelFor = null; this.hintUntil = 0; this.talkUntil = 0; this.talk = { who: 'y', mood: 'smile' }; this.shown = {}; this.frame = 0; this.now = 0;
    // 押したあとは風景にフォーカスを戻す（スペースキーの「槍」で、さっきのボタンがもう一度押されてしまわないように）
    const on = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); this.act.click(); fn(e); if ($(id).closest('#hud') && $('panel').hidden) $('view').focus({ preventScroll: true }); });
    on('btnStart', () => this.act.start());
    on('btnHow', () => this.openPanel('title'));
    on('btnGallery', () => this.act.gallery()); on('btnGalPrev', () => this.act.galStep(-1)); on('btnGalNext', () => this.act.galStep(1)); on('btnGalZoom', () => this.act.galZoom()); on('btnGalBack', () => this.act.title());
    on('btnPause', () => this.act.pause());
    on('btnSound', () => this.set('sound', !this.settings.sound));
    on('btnResume', () => this.act.resume());
    on('btnRetry', () => this.act.retry());
    on('btnQuit', () => this.act.title());
    on('btnContinue', () => this.act.cont());
    on('btnDownRetry', () => this.act.retry());
    on('btnDownQuit', () => this.act.title());
    on('btnAgain', () => this.act.start());
    on('btnHome', () => this.act.title());
    for (const [seg, key, conv] of [['segQuality', 'quality', (v) => v], ['segSens', 'sens', (v) => +v], ['segSound', 'sound', (v) => v === '1']])
      $(seg).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; this.act.click(); this.set(key, conv(b.dataset.v)); });
    // 槍（押しているあいだ。たまった瞬間に放つ）と、波（押した瞬間）
    const hold = (id, fn) => {
      const b = $(id), press = (v) => (e) => { e.preventDefault(); if (v) { try { b.setPointerCapture(e.pointerId); } catch (err) { /* 古い環境 */ } } fn(v); };
      b.addEventListener('pointerdown', press(true)); b.addEventListener('pointerup', press(false)); b.addEventListener('pointercancel', press(false)); b.addEventListener('lostpointercapture', () => fn(false));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { fn(true); setTimeout(() => fn(false), 120); } });
    };
    hold('btnLance', (v) => this.act.lance(v));
    hold('btnWave', (v) => { if (v) this.act.wave(); });
    this.faceCtx = $('face').getContext('2d');
    this.pips = [...$('shield').children]; this.stock = [...$('stock').children];
    this.sync();
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch (e) { /* 保存できない環境でも動く */ } }
  set(key, v) { this.settings[key] = v; this.save(); this.sync(); this.act.setting(key, v); }
  sync() {
    const s = this.settings, mark = (seg, v) => { for (const b of $(seg).children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); };
    mark('segQuality', s.quality); mark('segSens', String(s.sens)); mark('segSound', s.sound ? '1' : '0');
    $('btnSound').innerHTML = s.sound ? ICON_ON : ICON_OFF;
  }

  boot(p, msg) { $('bootBar').style.width = `${Math.round((1 - p) * 100)}%`; if (msg) $('bootMsg').textContent = msg; }
  fatal(msg) { $('boot').hidden = true; $('fatal').hidden = false; $('fatalMsg').textContent = msg; }
  credit(text) { $('credit').textContent = text; }
  show(mode) {
    const prev = this.mode; this.mode = mode;
    const fight = mode === 'play' || mode === 'boss' || mode === 'fin' || mode === 'down' || mode === 'result';
    $('boot').hidden = true;
    $('title').hidden = mode !== 'title'; $('gallery').hidden = mode !== 'gallery';
    $('hud').hidden = !fight;
    $('down').hidden = mode !== 'down';
    $('panel').hidden = true; this.panelFor = null;
    if (mode !== 'result') $('result').hidden = true;
    $('app').classList.toggle('playing', mode === 'play' || mode === 'boss' || mode === 'fin');
    $('boss').hidden = mode !== 'boss';
    const live = mode === 'play' || mode === 'boss';
    for (const el of document.querySelectorAll('.pad, #btnPause')) el.style.visibility = live ? '' : 'hidden';
    $('talk').style.opacity = mode === 'result' ? 0 : 1;
    document.querySelector('#hud .top').style.visibility = mode === 'result' ? 'hidden' : 'visible';
    if (mode === 'play' && prev !== 'down') {
      this.shown = {}; $('talkText').classList.remove('show'); $('toast').classList.remove('show'); $('warn').hidden = true; $('chain').classList.remove('show');
      this.hint(touch() ? '指をすべらせたぶんだけ、ユリアが動く。光の矢は自動' : 'ユリアがマウスについてくる（矢印キーでも）。光の矢は自動', 7);
    }
    if (mode === 'down') $('btnContinue').focus({ preventScroll: true });
    if (mode === 'title') $('talkText').classList.remove('show');
  }
  hint(text, sec) { const h = $('hint'); h.textContent = text; h.classList.remove('gone'); this.hintUntil = this.now + sec; }
  toast(text, small = '') { const t = $('toast'); t.innerHTML = (small ? `<small>${small}</small>` : '') + text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
  say({ text, mood, who }) {
    const p = $('talkText'); p.textContent = text; p.classList.add('show');
    this.talk = { who, mood }; $('talk').classList.toggle('foe', who === 'c');
    this.talkUntil = this.now + Math.max(2.6, 0.9 + text.length * 0.12); this.faceDirty = true;
  }
  chain(n) {
    const el = $('chain');
    if (n >= 3) { el.innerHTML = `${n}<small>連続</small>`; el.classList.add('show'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    else el.classList.remove('show');
  }
  warn() { const w = $('warn'); w.hidden = false; this.warnUntil = this.now + 3.6; }
  openPanel(kind) {
    this.panelFor = kind; $('panel').hidden = false;
    $('panelTitle').textContent = kind === 'pause' ? 'ひとやすみ' : 'あそびかた';
    $('btnRetry').hidden = kind !== 'pause'; $('btnQuit').hidden = kind !== 'pause';
    $('btnResume').textContent = kind === 'pause' ? 'つづける' : 'とじる';
    $('perf').textContent = this.act.status();
    $('btnResume').focus({ preventScroll: true });
  }
  closePanel() { $('panel').hidden = true; this.panelFor = null; }
  face(c, size, who, mood, t) {
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, size, size);
    if (who === 'c') { c.setTransform(size * 0.29, 0, 0, size * 0.29, size / 2, size * 0.62); setLine(1.3); birdHead(c, { mood, cap: true, scar: true }); setLine(1); }
    else { c.setTransform(size * 0.33, 0, 0, size * 0.33, size / 2, size * 0.58); STYLE.lw = 1.5; drawBattleFace(c, mood, t); STYLE.lw = 1; }
  }
  result(r) {
    $('result').hidden = false;
    $('rRank').textContent = r.rank; $('rScore').textContent = num(r.score);
    $('rRouted').innerHTML = `${r.routed}<small>羽</small>`; $('rChain').textContent = r.chain; $('rHits').innerHTML = `${r.hits}<small>回</small>`;
    // ユリアのひとこと（戦い方で変わる）
    const [line, mood] = r.rank === 'S' ? ['一発ももらわなかったじゃん。……やば、うける♡', 'love']
      : r.rank === 'A' ? ['ね、言ったじゃん。よゆーよゆー♪', 'grin']
      : ['ちょっと危なかったけど、ぜんぶ帰せたじゃん。……ありがと。', 'happy'];
    $('rSay').textContent = line;
    this.face($('rFace').getContext('2d'), 128, 'y', mood, 1.0);
    const b = this.settings.best;
    if (!b || r.score > b) { this.settings.best = r.score; this.save(); $('best').textContent = b ? `いちばん高い得点を更新（これまで ${num(b)}）` : ''; }
    else $('best').textContent = `いちばん高い得点 ${num(b)}`;
    $('btnAgain').focus({ preventScroll: true });
  }

  // 3D モデルを見る: いま見ているものの名前と説明
  gallery(d) { $('galName').textContent = d.name; $('galNote').textContent = d.note; $('galCount').textContent = `${d.i + 1} / ${d.n}`; }
  // 毎フレーム
  update(game, t) {
    const now = this.now = t; this.frame++;
    if (this.mode === 'title') return;                    // 題の画面のユリアは、3D の場面の中に描く（game.js）
    if (this.mode === 'boot' || this.mode === 'gallery') return;
    const P = game.P, S = this.shown, set = (k, v, fn) => { if (S[k] !== v) { S[k] = v; fn(v); } };
    // 顔（しゃべっているあいだはその表情。ユリアはまばたきするので、ときどき描き直す）
    const talking = now < this.talkUntil;
    if (!talking && this.talk.who !== 'y') { this.talk = { who: 'y', mood: P.mood }; $('talk').classList.remove('foe'); this.faceDirty = true; }
    if (!talking) $('talkText').classList.remove('show');
    if (this.faceDirty || this.frame % 6 === 0) { this.faceDirty = false; this.face(this.faceCtx, 160, this.talk.who, talking ? this.talk.mood : P.mood, t); }
    if (this.hintUntil && now > this.hintUntil) { $('hint').classList.add('gone'); this.hintUntil = 0; }
    if (this.warnUntil && now > this.warnUntil) { $('warn').hidden = true; this.warnUntil = 0; }
    set('score', Math.round(game.score), (v) => { $('score').textContent = num(v); });
    set('routed', game.routed, (v) => { $('routed').textContent = v; });
    set('shield', P.shield, (v) => { this.pips.forEach((el, i) => el.classList.toggle('off', i >= v)); $('shield').classList.toggle('low', v <= 1); $('shield').setAttribute('aria-label', `まもり ${Math.max(0, v)}`); });
    // 槍の輪と、波の残り
    const bl = $('btnLance'), bw = $('btnWave');
    set('lance', Math.round(P.lance * 50), (v) => bl.style.setProperty('--g', (v / 50).toFixed(2)));
    set('ready', P.lance >= 1 && P.lanceT <= 0, (v) => bl.classList.toggle('ready', v));
    set('waves', P.waves, (v) => { this.stock.forEach((el, i) => el.classList.toggle('off', i >= v)); bw.classList.toggle('empty', v <= 0); });
    set('waveG', P.waves >= 3 ? 50 : Math.round((1 - (P.waveCd ?? 22) / 22) * 50), (v) => bw.style.setProperty('--g', (v / 50).toFixed(2)));
    if (this.mode === 'boss') set('boss', Math.round(game.bossHP() * 200), (v) => { $('bossBar').style.transform = `scaleX(${(v / 200).toFixed(3)})`; });
  }
}
