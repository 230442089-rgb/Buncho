// input.js — 操作。
//   タッチ: 画面をさわった場所を中心に、指をずらした向きへ曲がる（どこをさわってもよい）。加速はボタンか 2 本目の指。
//   マウス: ポインタのあるほうへ曲がる。押しているあいだ加速。
//   キー: 矢印 / WASD で向き、スペース / Shift で加速。
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class Input {
  constructor(el, hooks = {}) {
    this.el = el; this.hooks = hooks;
    this.keys = new Set();
    this.stick = null;              // { id, x0, y0, x, y }
    this.touchBoost = new Set(); this.btnBoost = false; this.mouseBoost = false;
    this.mouse = null;              // { x, y }（-1..1）
    this.useMouse = false; this.lastKind = 'none';
    this.invert = false; this.enabled = true;
    const opt = { passive: false };
    el.addEventListener('pointerdown', (e) => this.down(e), opt);
    el.addEventListener('pointermove', (e) => this.move(e), opt);
    for (const n of ['pointerup', 'pointercancel']) el.addEventListener(n, (e) => this.up(e), opt);
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { this.mouse = null; this.mouseBoost = false; } });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e, true));
    window.addEventListener('keyup', (e) => this.key(e, false));
    window.addEventListener('blur', () => { this.keys.clear(); this.stick = null; this.touchBoost.clear(); this.mouseBoost = false; this.btnBoost = false; });
  }
  rect() { return this.el.getBoundingClientRect(); }
  down(e) {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') { if (e.button === 0) this.mouseBoost = true; this.useMouse = true; this.lastKind = 'mouse'; this.move(e); return; }
    e.preventDefault(); this.lastKind = 'touch';
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* 古い環境 */ }
    if (!this.stick) { this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: 0, y: 0 }; if (this.hooks.stick) this.hooks.stick(this.stick, true); }
    else this.touchBoost.add(e.pointerId);
  }
  move(e) {
    if (e.pointerType === 'mouse') {
      const r = this.rect(), m = Math.min(r.width, r.height) * 0.40;
      this.mouse = { x: clamp((e.clientX - r.left - r.width / 2) / m, -1, 1), y: clamp((r.top + r.height * 0.5 - e.clientY) / m, -1, 1) };
      this.useMouse = true; return;
    }
    const s = this.stick; if (!s || s.id !== e.pointerId) return;
    e.preventDefault();
    const R = clamp(Math.min(window.innerWidth, window.innerHeight) * 0.16, 44, 84);
    let dx = (e.clientX - s.x0) / R, dy = (s.y0 - e.clientY) / R; const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; s.x0 = e.clientX - dx * R; s.y0 = e.clientY + dy * R; }      // 引っぱりすぎたら中心がついてくる
    s.x = dx; s.y = dy;
    if (this.hooks.stick) this.hooks.stick(s, true);
  }
  up(e) {
    if (e.pointerType === 'mouse') { if (e.button === 0) this.mouseBoost = false; return; }
    if (this.stick && this.stick.id === e.pointerId) { this.stick = null; if (this.hooks.stick) this.hooks.stick(null, false); }
    this.touchBoost.delete(e.pointerId);
  }
  key(e, on) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const steer = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', ' ', 'Shift'];
    if (steer.includes(k)) { if (on) { this.keys.add(k); this.useMouse = false; this.lastKind = 'key'; } else this.keys.delete(k); if (k !== 'Shift' && this.enabled) e.preventDefault(); return; }
    if (on && !e.repeat && this.hooks.key) this.hooks.key(k, e);
  }
  // いまの入力。x: 右が +, y: 上昇が +（反転の設定はここで掛ける）
  get() {
    const K = this.keys; let x = 0, y = 0;
    if (K.has('ArrowLeft') || K.has('a')) x -= 1; if (K.has('ArrowRight') || K.has('d')) x += 1;
    if (K.has('ArrowUp') || K.has('w')) y += 1; if (K.has('ArrowDown') || K.has('s')) y -= 1;
    const dz = (v, d) => (Math.abs(v) < d ? 0 : Math.sign(v) * (Math.abs(v) - d) / (1 - d));
    if (this.stick) { x = dz(this.stick.x, 0.08); y = dz(this.stick.y, 0.08); }
    else if (x === 0 && y === 0 && this.useMouse && this.mouse) { x = dz(this.mouse.x, 0.10); y = dz(this.mouse.y, 0.10); }
    // 小さな動きは細かく、大きな動きはしっかり効くように
    const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.35);
    return { x: curve(x), y: curve(y) * (this.invert ? -1 : 1), boost: K.has(' ') || K.has('Shift') || this.btnBoost || this.mouseBoost || this.touchBoost.size > 0 };
  }
}
