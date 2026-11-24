#!/usr/bin/env node
// tools/frame.js — 指定した時刻の静止画を撮る（確認用）
//   node tools/frame.js 12.5 f400 b6.5            … 秒 / フレーム / 小節
//   node tools/frame.js --range b6 b10 12         … 区間を 12 枚に等分
//   オプション: --film atom（atom/ のページを撮る）  --out DIR  --only scene1,scene2  --png  --time（1枚ごとの描画時間を表示）
const fs = require('fs');
const path = require('path');
const { openFilm, parseTime, ROOT } = require('./lib');

(async () => {
  const args = process.argv.slice(2);
  let out = null, only = null, png = false, timing = false, query = '', film = 'film';
  const frames = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--out') out = path.resolve(args[++i]);
    else if (a === '--only') only = args[++i];
    else if (a === '--film') film = args[++i];
    else if (a === '--query') query = args[++i];
    else if (a === '--png') png = true;
    else if (a === '--time') timing = true;
    else if (a === '--range') {
      const a0 = parseTime(args[++i]), a1 = parseTime(args[++i]), n = parseInt(args[++i], 10);
      for (let k = 0; k < n; k++) frames.push(Math.round(a0 + ((a1 - a0) * k) / Math.max(1, n - 1)));
    } else frames.push(parseTime(a));
  }
  if (!out) out = film === 'film' ? path.join(ROOT, 'build', 'frames') : path.join(ROOT, 'build', film, 'frames');
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const { page, close, info } = await openFilm({ film, query: [only ? 'only=' + only : '', query].filter(Boolean).join('&'), quiet: true });
  console.log(`boot ${((Date.now() - t0) / 1000).toFixed(1)}s  programs=${info.stats.programs}`);
  const files = [];
  for (const f of frames) {
    const t1 = Date.now();
    await page.evaluate((f) => window.film.renderFrame(f), f);
    const t2 = Date.now();
    const file = path.join(out, `f${String(f).padStart(5, '0')}.${png ? 'png' : 'jpg'}`);
    await page.screenshot(png ? { path: file, type: 'png' } : { path: file, type: 'jpeg', quality: 92 });
    files.push(file);
    if (timing) console.log(`f${f}  t=${(f / 30).toFixed(2)}s  render ${t2 - t1}ms  shot ${Date.now() - t2}ms`);
  }
  await close();
  console.log(files.join('\n'));
})().catch((e) => { console.error(String(e.stack || e)); process.exit(1); });
