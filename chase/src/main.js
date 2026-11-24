// main.js — 「ゆり姉、まってぇ♡」。1 枚の 2D キャンバスに、フレーム番号 → 絵 を描く。
import { W, H, FPS, TOTAL_FRAMES, DURATION } from './core.js';
import { SCENES } from './scenes.js';

const film = (window.film = { state: 'loading', error: null, frames: TOTAL_FRAMES, fps: FPS, duration: DURATION, stats: { programs: 0 } });
const FONTS = ['500 40px "Zen Maru Gothic"', '700 40px "Zen Maru Gothic"', '900 40px "Zen Maru Gothic"', '400 40px "Hachi Maru Pop"', '400 40px "Dela Gothic One"'];

async function boot() {
  const q = new URLSearchParams(location.search);
  await Promise.all(FONTS.map((f) => document.fonts.load(f, 'ゆり姉まってぇ逃げ波つかまえた一生0123♡').catch(() => null)));
  await document.fonts.ready;
  const cv = document.getElementById('cv'), c = cv.getContext('2d');
  const env = { c, q, W, H };
  env.stats = await fetch('stats.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  const only = q.get('only');
  const scenes = SCENES.filter((s) => !only || only.split(',').includes(s.id));
  for (const s of scenes) if (s.init) s.init(env);
  film.layers = scenes.map((s) => ({ id: s.id, scene: s.id, t0: s.t0, t1: s.t1 }));
  film.renderFrame = (f) => {
    const t = (f + 0.5) / FPS;                 // フレームの中央の時刻で描く
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
    c.fillStyle = '#fdfbf8'; c.fillRect(0, 0, W, H);
    for (const s of scenes) if (t >= s.t0 && t < s.t1) { c.save(); s.draw(c, t, t - s.t0, env); c.restore(); }
    return true;
  };
  if (q.has('f')) film.renderFrame(+q.get('f'));
  film.state = 'ready';
}
boot().catch((e) => { film.state = 'error'; film.error = String(e && e.stack ? e.stack : e); console.error(film.error); });
