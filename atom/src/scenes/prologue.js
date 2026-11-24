// prologue.js — 序。水の底の青い光（チェレンコフ光）と、題。
import { T, sat, smoothstep, ease, lerp } from '../core.js';
import { getPool } from '../pool.js';
import { narr, sub, rich } from '../kit.js';
import { revealChars } from '../../../film/src/overlay.js';

export const id = 'prologue';
export async function create(env) {
  const { ov } = env;
  const pool = getPool(env);

  narr(ov, { text: '原子炉の水の底は、<b>青く</b>光る。', t0: 4.3, t1: T.title - 0.25 });
  sub(ov, { text: 'チェレンコフ光 — 燃料から飛び出す放射線が、水の中でつくる光', t0: 5.6, t1: T.title - 0.35, y: 962 });

  ov.add({
    t0: T.title - 0.1, t1: T.nucleus, className: 'title',
    html: `<div class="scrim"></div><div class="jp">${rich('見えない火')}</div><div class="bar"></div><div class="en">${rich('THE INVISIBLE FIRE')}</div><div class="sub2">原子力発電 — そのしくみ、最悪の事故、人への影響</div>`,
    update(el, tl) {
      const dur = T.nucleus - T.title + 0.1, out = 1 - smoothstep(dur - 0.9, dur - 0.15, tl);
      const [scrim, jp, bar, en, s2] = el.children;
      scrim.style.opacity = (smoothstep(0, 1.4, tl) * out).toFixed(4);
      revealChars(jp, tl - 0.15, { stagger: 0.16, dur: 1.3, dy: 0, blur: 18, scale: 0.06 });
      jp.style.opacity = out.toFixed(4);
      jp.style.letterSpacing = (0.24 + 0.03 * ease.outCubic(sat(tl / dur))).toFixed(4) + 'em';
      bar.style.transform = `scaleX(${ease.outQuart(sat((tl - 1.3) / 0.9)).toFixed(4)})`; bar.style.opacity = out.toFixed(4);
      revealChars(en, tl - 1.5, { stagger: 0.03, dur: 0.6, dy: 0, blur: 5 });
      en.style.opacity = out.toFixed(4);
      const a = ease.outCubic(sat((tl - 2.0) / 0.9));
      s2.style.opacity = (a * out).toFixed(4); s2.style.transform = `translateY(${((1 - a) * 8).toFixed(2)}px)`;
    },
  });

  return {
    id: 'prologue', t0: 0, t1: T.nucleus,
    render(env, tl, t) {
      const p = env.p;
      const glow = smoothstep(T.glow - 0.6, 8.5, t) * (1 - 0.42 * smoothstep(T.title - 0.6, T.title + 1.2, t));
      const k = ease.inOutSine(sat(t / T.nucleus));
      const dive = smoothstep(T.nucleus - 1.25, T.nucleus, t);
      pool.draw(t, glow, k, dive);
      p.bloom = 0.62 + 0.7 * dive; p.threshold = 0.6; p.knee = 0.6; p.vignette = 0.7; p.ca = 0.012;
      p.fade = smoothstep(0.0, 1.6, t);
      p.flash = 0.6 * Math.pow(dive, 3);
      p.tint = [lerp(1, 0.86, dive), lerp(1, 0.95, dive), 1];
    },
  };
}
