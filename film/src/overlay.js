// overlay.js — 文字（DOM）のレイヤー。すべて時刻 t の関数として描くので、どのフレームからでも同じ絵になる。
import { sat, smoothstep, ease, lerp } from './core.js';

export class Overlay {
  constructor(root) { this.root = root; this.items = []; }
  // spec: { t0, t1, html, className, style, setup(el,item), update(el, tl, t, item) }
  add(spec) {
    const el = document.createElement(spec.tag || 'div');
    if (spec.className) el.className = spec.className;
    if (spec.html != null) el.innerHTML = spec.html;
    if (spec.style) Object.assign(el.style, spec.style);
    el.style.display = 'none';
    (spec.parent || this.root).appendChild(el);
    const item = { ...spec, el, on: false };
    if (spec.setup) spec.setup(el, item);
    this.items.push(item);
    return item;
  }
  update(t) {
    for (const it of this.items) {
      const on = t >= it.t0 && t < it.t1;
      if (on !== it.on) { it.el.style.display = on ? '' : 'none'; it.on = on; }
      if (on && it.update) it.update(it.el, t - it.t0, t, it);
    }
  }
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// 1文字ずつ <span class="ch"> に分ける（空白はそのまま幅を保つ）
export function chars(text, cls = 'ch') {
  return [...text].map((c) => (c === ' ' ? `<span class="${cls} sp">&nbsp;</span>` : c === '\n' ? '<br>' : `<span class="${cls}">${esc(c)}</span>`)).join('');
}

// 文字が1つずつ、ぼけた状態から浮かび上がる。outAt を渡すと同じ順で消えていく。
export function revealChars(el, tl, { stagger = 0.045, dur = 0.55, dy = 16, blur = 10, dx = 0, outAt = null, outDur = 0.5, outStagger = 0.012, sel = '.ch', scale = 0 } = {}) {
  const spans = el._chs || (el._chs = [...el.querySelectorAll(sel)]);
  for (let i = 0; i < spans.length; i++) {
    const p = ease.outCubic(sat((tl - i * stagger) / dur));
    let o = p, y = (1 - p) * dy, x = (1 - p) * dx, b = (1 - p) * blur, s = 1 - (1 - p) * scale;
    if (outAt != null) {
      const q = ease.inCubic(sat((tl - outAt - i * outStagger) / outDur));
      o *= 1 - q; b += q * blur * 0.8; y -= q * dy * 0.5;
    }
    const st = spans[i].style;
    st.opacity = o.toFixed(4);
    st.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)` + (scale ? ` scale(${s.toFixed(4)})` : '');
    st.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : 'none';
  }
}

// 単純なフェード（[0,fin] で現れ、[outAt, outAt+fout] で消える）
export function fade(tl, fin, outAt, fout) {
  return Math.min(smoothstep(0, fin, tl), outAt == null ? 1 : 1 - smoothstep(outAt, outAt + fout, tl));
}

// KaTeX で数式を組む
export function tex(src, display = false) {
  return window.katex.renderToString(src, { displayMode: display, throwOnError: true, output: 'html' });
}

// 章の見出し（左上に小さく残る）と、中央下の一行
export function chapter(ov, { n, kanji, en, line, t0, t1, lineHold = 3.4, lineDelay = 0.25, lineY = null, dark = false }) {
  ov.add({
    t0, t1, className: 'chap' + (dark ? ' dark' : ''),
    html: `<span class="num">${n}</span><span class="rule"></span><span class="kanji">${kanji}</span><span class="en">${chars(en)}</span>`,
    update(el, tl) {
      const dur = t1 - t0, out = 1 - smoothstep(dur - 0.45, dur - 0.05, tl);
      const num = el.children[0], rule = el.children[1], kj = el.children[2], enEl = el.children[3];
      const a = ease.outCubic(sat(tl / 0.6));
      num.style.opacity = (a * out).toFixed(4);
      num.style.transform = `translateY(${((1 - a) * 22).toFixed(2)}px)`;
      const b = ease.outQuart(sat((tl - 0.12) / 0.7));
      rule.style.transform = `scaleX(${b.toFixed(4)})`; rule.style.opacity = out.toFixed(4);
      const c = ease.outCubic(sat((tl - 0.22) / 0.7));
      kj.style.opacity = (c * out).toFixed(4);
      kj.style.transform = `translateX(${((1 - c) * -14).toFixed(2)}px)`;
      kj.style.filter = c < 0.999 ? `blur(${((1 - c) * 8).toFixed(2)}px)` : 'none';
      revealChars(enEl, tl - 0.4, { stagger: 0.035, dur: 0.5, dy: 0, dx: -6, blur: 4 });
      enEl.style.opacity = out.toFixed(4);
    },
  });
  if (line) {
    ov.add({
      t0: t0 + lineDelay, t1: Math.min(t1, t0 + lineDelay + lineHold + 1.0), className: 'narr' + (dark ? ' dark' : ''), html: chars(line),
      style: lineY != null ? { top: lineY + 'px' } : {},
      update(el, tl) { revealChars(el, tl, { stagger: 0.055, dur: 0.7, dy: 12, blur: 9, outAt: lineHold, outDur: 0.55 }); },
    });
  }
}

// 画面の隅に置く数式
export function equation(ov, { src, t0, t1, x = null, y = null, right = null, bottom = null, size = 26, align = 'left', opacity = 0.78, dark = false }) {
  const style = { fontSize: size + 'px', textAlign: align };
  if (x != null) style.left = x + 'px'; if (right != null) style.right = right + 'px';
  if (y != null) style.top = y + 'px'; if (bottom != null) style.bottom = bottom + 'px';
  return ov.add({
    t0, t1, className: 'eq' + (dark ? ' dark' : ''), html: (Array.isArray(src) ? src : [src]).map((s) => `<div class="eqline">${tex(s)}</div>`).join(''), style,
    update(el, tl) {
      const dur = t1 - t0;
      const lines = el.children;
      for (let i = 0; i < lines.length; i++) {
        const a = ease.outCubic(sat((tl - 0.15 - i * 0.12) / 0.6)) * (1 - smoothstep(dur - 0.4, dur - 0.05, tl));
        lines[i].style.opacity = (a * opacity).toFixed(4);
        lines[i].style.transform = `translateY(${((1 - ease.outCubic(sat((tl - 0.15 - i * 0.12) / 0.6))) * 8).toFixed(2)}px)`;
      }
    },
  });
}

// 小さな注記（等幅）
export function note(ov, { text, t0, t1, x = null, y = null, right = null, bottom = null, align = 'left', size = 17, dark = false }) {
  const style = { fontSize: size + 'px', textAlign: align };
  if (x != null) style.left = x + 'px'; if (right != null) style.right = right + 'px';
  if (y != null) style.top = y + 'px'; if (bottom != null) style.bottom = bottom + 'px';
  return ov.add({
    t0, t1, className: 'note' + (dark ? ' dark' : ''), html: chars(text), style,
    update(el, tl) { revealChars(el, tl, { stagger: 0.012, dur: 0.3, dy: 0, blur: 3, outAt: t1 - t0 - 0.4, outDur: 0.3, outStagger: 0 }); },
  });
}

export { lerp };
