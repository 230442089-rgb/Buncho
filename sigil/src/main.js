// main.js — 「十二の紋章」。1 枚の 2D キャンバスに、フレーム番号 → 絵 を描く。?sheet=dark|light でロゴの一覧（静止画）。
import { W, H, FPS, TOTAL_FRAMES, DURATION } from './core.js';
import { MARKS } from './marks.js';
import { placeMark } from './draw.js';

const film = (window.film = { state: 'loading', error: null, frames: TOTAL_FRAMES, fps: FPS, duration: DURATION, stats: { programs: 0 } });
const FONTS = ['500 40px "Shippori Mincho"', '700 40px "Shippori Mincho"', '800 40px "Shippori Mincho"', '400 40px "Noto Sans JP"', '700 40px "Noto Sans JP"', '500 40px "Zen Maru Gothic"', '700 40px "Zen Maru Gothic"', '900 40px "Zen Maru Gothic"'];

function sheet(c, mode, q) {
  const dark = mode !== 'light';
  if (q.has('id')) {            // ひとりぶんの札: ?sheet=light&id=yuria
    const m = MARKS.find((x) => x.id === q.get('id')), ink = dark ? '#ffffff' : '#2c2733', dim = dark ? 'rgba(255,255,255,' : 'rgba(44,39,51,';
    c.fillStyle = dark ? '#0d0b14' : '#fbf8f3'; c.fillRect(0, 0, W, H); placeMark(c, m, W / 2, 400, 250, { mode: dark ? 'dark' : 'light' });
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink; c.font = '800 98px "Shippori Mincho"'; c.letterSpacing = '16px'; c.fillText(m.name, W / 2 + 8, 780);
    c.font = '500 31px "Noto Sans JP"'; c.letterSpacing = '9px'; c.fillStyle = dim + '.8)'; c.fillText(m.epithet, W / 2 + 4, 862);
    c.fillStyle = dim + '.3)'; c.fillRect(W / 2 - 75, 907, 150, 2);
    c.font = '400 21px "Noto Sans JP"'; c.letterSpacing = '5px'; c.fillStyle = dim + '.55)'; c.fillText(`${m.role}　｜　${m.ability}`, W / 2 + 2, 942); c.letterSpacing = '0px'; return;
  }
  c.fillStyle = dark ? '#0d0b14' : '#fbf8f3'; c.fillRect(0, 0, W, H);
  const cols = 6, cw = W / cols, fam = q.get('font') || 'Shippori Mincho', wt = q.get('wt') || 800;
  MARKS.forEach((m, i) => {
    const x = cw * (i % cols + 0.5), y = 205 + Math.floor(i / cols) * 515;
    placeMark(c, m, x, y, 112, { mode: dark ? 'dark' : 'light' });
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = dark ? '#ffffff' : '#2c2733';
    c.font = `${wt} 46px "${fam}"`; c.letterSpacing = '6px'; c.fillText(m.name, x + 3, y + 186);
    c.font = '500 21px "Noto Sans JP"'; c.letterSpacing = '3px'; c.fillStyle = dark ? 'rgba(255,255,255,.62)' : 'rgba(44,39,51,.62)'; c.fillText(m.epithet, x + 1, y + 234);
    placeMark(c, m, x - 70, y + 292, 26, { mode: dark ? 'white' : 'ink' }); placeMark(c, m, x + 10, y + 292, 15, { mode: dark ? 'white' : 'ink', wk: 1.25 }); placeMark(c, m, x + 60, y + 292, 9, { mode: dark ? 'white' : 'ink', wk: 1.6 });
  });
  c.letterSpacing = '0px';
}

async function boot() {
  const q = new URLSearchParams(location.search);
  await Promise.all(FONTS.map((f) => document.fonts.load(f, '外神竜一族十二の紋章ユリアヴォルザイナルリカミリア燐テルエスレウネニルメエデルアセラフルル0123').catch(() => null)));
  await document.fonts.ready;
  const cv = document.getElementById('cv'), c = cv.getContext('2d');
  const env = { c, q, W, H };
  env.stats = await fetch('stats.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  let scenes = [];
  if (!q.has('sheet')) { const mod = await import('./scenes.js'); scenes = mod.SCENES; if (mod.init) await mod.init(env); }
  const only = q.get('only'); if (only) scenes = scenes.filter((s) => only.split(',').includes(s.id));
  film.layers = scenes.map((s) => ({ id: s.id, scene: s.id, t0: s.t0, t1: s.t1 }));
  film.renderFrame = (f) => {
    const t = (f + 0.5) / FPS;                 // フレームの中央の時刻で描く
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.lineCap = 'butt'; c.lineJoin = 'miter';
    if (q.has('sheet')) { sheet(c, q.get('sheet'), q); return true; }
    c.fillStyle = '#07060c'; c.fillRect(0, 0, W, H);
    for (const s of scenes) if (t >= s.t0 && t < s.t1) { c.save(); s.draw(c, t, t - s.t0, env); c.restore(); }
    return true;
  };
  if (q.has('f')) film.renderFrame(+q.get('f'));
  film.state = 'ready';
}
boot().catch((e) => { film.state = 'error'; film.error = String(e && e.stack ? e.stack : e); console.error(film.error); });
