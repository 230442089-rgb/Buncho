// main.js — 「気合い」のタイムライン。エンジン（WebGL2 のラッパー・ポスト処理・文字）は film/src のものを使う。
import { W, H, FPS, TOTAL_FRAMES, DURATION } from './core.js';
import { GLX } from '../../film/src/gl.js';
import { Post, POST_DEFAULTS } from '../../film/src/post.js';
import { Overlay } from '../../film/src/overlay.js';
import { SCENES } from './scenes/index.js';

const film = (window.film = { state: 'loading', error: null, frames: TOTAL_FRAMES, fps: FPS, duration: DURATION });

const FONT_PROBES = [
  '500 40px "Shippori Mincho"', '600 40px "Shippori Mincho"', '700 40px "Shippori Mincho"', '800 40px "Shippori Mincho"',
  '400 40px "Noto Sans JP"', '500 40px "Noto Sans JP"', '700 40px "Noto Sans JP"', '400 80px "Dela Gothic One"', '400 80px "Reggae One"',
];

async function boot() {
  const q = new URLSearchParams(location.search);
  await Promise.all(FONT_PROBES.map((f) => document.fonts.load(f, '気合いだぁあっ！うおお耐える魂。0123 Gy').catch(() => null)));
  await document.fonts.ready;

  const canvas = document.getElementById('gl');
  const g = new GLX(canvas);
  const post = new Post(g);
  const root = document.getElementById('overlay');
  const ov = new Overlay(root);
  const env = { g, gl: g.gl, post, ov, W, H, FPS, p: {}, frame: 0, t: 0, q };
  env.stats = await fetch('stats.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));

  const layers = [];
  const only = q.get('only');   // 開発用: 特定の場面だけ作る（?only=fission,chain）
  for (const S of SCENES) {
    if (only && !only.split(',').includes(S.id)) continue;
    const made = await S.create(env);
    for (const L of [].concat(made)) { L.scene = S.id; layers.push(L); }
  }
  layers.sort((a, b) => (a.z || 0) - (b.z || 0));
  film.layers = layers.map((L) => ({ id: L.id, scene: L.scene, t0: L.t0, t1: L.t1 }));
  film.stats = g.stats;

  const prof = q.has('prof');
  film.renderFrame = (f) => {
    env.frame = f; env.t = (f + 0.5) / FPS;        // フレームの中央の時刻で描く
    env.p = { ...POST_DEFAULTS, tint: [1, 1, 1], lift: [0, 0, 0], shake: [0, 0] };
    const T = [performance.now()];
    post.begin();
    for (const L of layers) {
      if (env.t >= L.t0 && env.t < L.t1) { g.bind(post.hdr); L.render(env, env.t - L.t0, env.t); }
    }
    if (prof) { g.bind(post.hdr); g.finish(); T.push(performance.now()); }
    post.end(env.p, f);
    if (prof) { g.bind(null); g.finish(); T.push(performance.now()); }
    ov.update(env.t);
    // 画面の揺れは文字にも伝える（shake は画面の幅・高さに対する割合）
    const sx = env.p.shake[0] * W, sy = -env.p.shake[1] * H;
    root.style.transform = sx || sy ? `translate(${(-sx).toFixed(2)}px, ${(-sy).toFixed(2)}px)` : '';
    g.bind(null); g.finish();
    if (prof) { T.push(performance.now()); console.log(`prof f${f}: layers ${(T[1] - T[0]).toFixed(0)}ms  post ${(T[2] - T[1]).toFixed(0)}ms  overlay+finish ${(T[3] - T[2]).toFixed(0)}ms`); }
    return true;
  };
  film.env = env;

  if (q.has('fit')) {
    const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); document.getElementById('stage').style.transform = `scale(${s})`; };
    addEventListener('resize', fit); fit();
  }
  if (q.has('f')) film.renderFrame(+q.get('f'));
  if (q.has('play')) {
    const start = performance.now() - (+q.get('play') || 0) * 1000;
    const loop = () => { const f = Math.floor(((performance.now() - start) / 1000) * FPS); if (f < TOTAL_FRAMES) { film.renderFrame(f); requestAnimationFrame(loop); } };
    requestAnimationFrame(loop);
  }
  film.state = 'ready';
}

boot().catch((e) => { film.state = 'error'; film.error = String(e && e.stack ? e.stack : e); console.error(film.error); });
