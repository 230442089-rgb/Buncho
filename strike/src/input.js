// input.js — 操作。視点は動かない。動くのはユリアだけ。
//   タッチ: 画面のどこでもよい。指をすべらせたぶんだけ、ユリアが同じだけ動く（指の下に隠れない）。槍と波は右下のボタン。
//   マウス: ユリアがポインタについてくる。左クリックで槍、右クリックで波。
//   キー: 矢印 / WASD で移動（Shift でゆっくり）、Z・スペースで槍、X で波。
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class Input {
  constructor(el, hooks = {}) {
    this.el = el; this.hooks = hooks;
    this.keys = new Set();
    this.drag = null;                 // いま動かしている指 { id, x, y }
    this.dx = 0; this.dy = 0;         // 前のこまから指が動いたぶん（画面の半分を 1 とする）
    this.mouse = null; this.useMouse = false; this.lastKind = 'none';
    this.sens = 1; this.enabled = true;
    this.mouseLance = false; this.btnLance = false; this.lanceTap = false; this.waveTap = false;
    const opt = { passive: false };
    el.addEventListener('pointerdown', (e) => this.down(e), opt);
    el.addEventListener('pointermove', (e) => this.move(e), opt);
    for (const n of ['pointerup', 'pointercancel']) el.addEventListener(n, (e) => this.up(e), opt);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => this.clear());
  }
  clear() { this.keys.clear(); this.drag = null; this.dx = this.dy = 0; this.mouseLance = false; this.btnLance = false; this.lanceTap = false; this.waveTap = false; }
  rect() { return this.el.getBoundingClientRect(); }
  down(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') {
      this.useMouse = true; this.lastKind = 'mouse'; this.move(e);
      if (e.button === 0) { this.mouseLance = true; this.lanceTap = true; } else if (e.button === 2) this.waveTap = true;
      return;
    }
    e.preventDefault(); this.lastKind = 'touch'; this.useMouse = false;
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* 古い環境 */ }
    if (!this.drag) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  move(e) {
    if (e.pointerType === 'mouse') {
      const r = this.rect();
      this.mouse = { x: clamp((e.clientX - r.left - r.width / 2) / (r.width / 2), -1, 1), y: clamp((r.top + r.height / 2 - e.clientY) / (r.height / 2), -1, 1) };
      this.useMouse = true; return;
    }
    const d = this.drag; if (!d || d.id !== e.pointerId) return;
    e.preventDefault();
    const r = this.rect();
    if (this.enabled) { this.dx += (e.clientX - d.x) / (r.width / 2) * this.sens; this.dy += (d.y - e.clientY) / (r.height / 2) * this.sens; }
    d.x = e.clientX; d.y = e.clientY;
  }
  up(e) {
    if (e.pointerType === 'mouse') { if (e.button === 0) this.mouseLance = false; return; }
    if (this.drag && this.drag.id === e.pointerId) this.drag = null;
  }
  key(e, on) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const play = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', ' ', 'Shift', 'z', 'j'];
    if (play.includes(k)) { if (on) { this.keys.add(k); if (k !== 'Shift') { this.useMouse = false; this.lastKind = 'key'; } } else this.keys.delete(k); if (k !== 'Shift' && this.enabled) e.preventDefault(); return; }
    if ((k === 'x' || k === 'k') && this.enabled) { if (on && !e.repeat) this.waveTap = true; return; }
    if (on && !e.repeat && this.hooks.key) this.hooks.key(k, e);
  }
  // いまの入力。P: 自分（tx, ty = いまの行き先）, hw, hh: 画面の半分にあたる世界の幅と高さ
  get(dt, P, hw = 0.7, hh = 0.4) {
    let tx = P.tx, ty = P.ty;
    const K = this.keys; let kx = 0, ky = 0;
    if (K.has('ArrowLeft') || K.has('a')) kx -= 1; if (K.has('ArrowRight') || K.has('d')) kx += 1;
    if (K.has('ArrowUp') || K.has('w')) ky += 1; if (K.has('ArrowDown') || K.has('s')) ky -= 1;
    if (this.dx || this.dy) { tx += this.dx; ty += this.dy; this.dx = this.dy = 0; }
    else if (kx || ky) { const l = Math.hypot(kx, ky), v = (K.has('Shift') ? 0.6 : 1.45) * this.sens * dt / l; tx += kx * v / hw; ty += ky * v / hh; }
    else if (this.useMouse && this.mouse && !this.drag) { tx = this.mouse.x; ty = this.mouse.y; }
    // 押した瞬間は取りこぼさないように覚えておく（こまとこまのあいだに押して離しても効く）
    const wave = this.waveTap, tap = this.lanceTap; this.waveTap = false; this.lanceTap = false;
    return { tx, ty, lance: tap || this.mouseLance || this.btnLance || K.has('z') || K.has(' ') || K.has('j'), wave };
  }
}
