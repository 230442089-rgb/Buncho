#!/usr/bin/env node
// tools/render.js — 指定区間のフレームを撮って 1 本の mp4 に書き出す（無音）
//   node tools/render.js --from f0 --to f300 --out build/chunks/prologue.mp4 [--crf 16] [--only scene] [--film atom]
// フレームは品質 92 の JPEG で受け取り、ffmpeg にパイプで渡す。一時名に書き、成功したらリネームする。
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { openFilm, parseTime, ROOT } = require('./lib');

const ENC = (crf) => [
  '-vf', 'scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-maxrate', '9M', '-bufsize', '18M', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2',
  '-g', '60', '-bf', '2', '-x264-params', 'aq-mode=3:aq-strength=0.9:deblock=-1,-1:psy-rd=1.0,0.15',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-video_track_timescale', '15360', '-an',
];

(async () => {
  const a = process.argv.slice(2);
  const opt = { from: 0, to: null, out: null, crf: 19, only: null, every: 1, film: 'film' };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--from') opt.from = parseTime(a[++i]);
    else if (a[i] === '--to') opt.to = parseTime(a[++i]);
    else if (a[i] === '--out') opt.out = path.resolve(a[++i]);
    else if (a[i] === '--crf') opt.crf = +a[++i];
    else if (a[i] === '--only') opt.only = a[++i];
    else if (a[i] === '--film') opt.film = a[++i];
    else if (a[i] === '--query') opt.query = a[++i];
    else if (a[i] === '--jpgdir') opt.jpgdir = path.resolve(a[++i]);
  }
  if (!opt.out) throw new Error('--out が必要です');
  fs.mkdirSync(path.dirname(opt.out), { recursive: true });
  const tmp = opt.out.replace(/\.mp4$/, '.part.mp4');
  const { page, close, info } = await openFilm({ film: opt.film, query: [opt.only ? 'only=' + opt.only : '', opt.query || ''].filter(Boolean).join('&'), quiet: true });
  if (opt.jpgdir) fs.mkdirSync(opt.jpgdir, { recursive: true });
  if (opt.to == null) opt.to = info.frames;
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', ...ENC(opt.crf), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res) => ff.on('close', res));
  const t0 = Date.now(); let lastLog = t0;
  for (let f = opt.from; f < opt.to; f++) {
    await page.evaluate((f) => window.film.renderFrame(f), f);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (opt.jpgdir) fs.writeFileSync(path.join(opt.jpgdir, `f${String(f).padStart(5, '0')}.jpg`), buf);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    const now = Date.now();
    if (now - lastLog > 15000 || f === opt.to - 1) {
      const n = f - opt.from + 1, per = (now - t0) / n;
      console.log(`${path.basename(opt.out)}: ${n}/${opt.to - opt.from}  ${per.toFixed(0)} ms/frame  残り ${(((opt.to - f - 1) * per) / 1000).toFixed(0)}s`);
      lastLog = now;
    }
  }
  ff.stdin.end();
  const code = await done;
  await close();
  if (code !== 0) { console.error('ffmpeg failed', code); process.exit(1); }
  fs.renameSync(tmp, opt.out);
  console.log('OK', opt.out, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch((e) => { console.error(String(e.stack || e)); process.exit(1); });
