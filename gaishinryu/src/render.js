// 「外神竜に会いに行こう」の書き出し：場面ごとに一コマずつ描いて JPEG で撮り、ffmpeg で mp4 にする
// 使い方: node render.js <scene> <out.mp4> [from_frame] [to_frame]   /  node render.js <scene> stills <t1,t2,...> <dir>
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');
const THREE_JS = process.env.THREE_JS || path.join(__dirname, 'three.min.js'), FONTS = process.env.FONT_DIR || path.join(__dirname, 'fonts'), PAGE = process.env.PAGE || path.join(require('os').tmpdir(), 'gaishinryu_render.html');
const FACES = [['Shippori Mincho B1', 600, 'ShipporiMinchoB1-SemiBold.ttf'], ['Shippori Mincho B1', 800, 'ShipporiMinchoB1-ExtraBold.ttf'], ['Zen Kaku Gothic New', 500, 'ZenKakuGothicNew-Medium.ttf'], ['Zen Kaku Gothic New', 700, 'ZenKakuGothicNew-Bold.ttf'], ['Zen Kaku Gothic New', 900, 'ZenKakuGothicNew-Black.ttf'], ['Dela Gothic One', 400, 'DelaGothicOne-Regular.ttf'], ['Zen Old Mincho', 900, 'ZenOldMincho-Black.ttf'], ['Yuji Syuku', 400, 'YujiSyuku-Regular.ttf']];
const CSS = FACES.map(([f, w, file]) => `@font-face{font-family:'${f}';font-style:normal;font-weight:${w};src:url(http://ad.local/fonts/${file}) format('truetype');}`).join('\n');
const [scene, out, a3, a4, a5] = process.argv.slice(2);
const SEED = `(() => { let s = 0x2F6E2B1; const mk = seed => { s = seed >>> 0; }; Math.random = function () { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; window.__adSeed = mk; })();`;
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PE ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | '))); p.on('console', m => { if (m.type() === 'error') errs.push('CE ' + m.text().slice(0, 200)); });
  await p.addInitScript(SEED);
  await p.route('**/*', async r => { const u = r.request().url();
    if (u.endsWith('/three.min.js')) return r.fulfill({ path: THREE_JS, contentType: 'application/javascript' });
    if (u.startsWith('https://fonts.googleapis.com/')) return r.fulfill({ body: CSS, contentType: 'text/css' });
    if (u.startsWith('http://ad.local/fonts/')) return r.fulfill({ path: path.join(FONTS, path.basename(new URL(u).pathname)), contentType: 'font/ttf', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (u.startsWith('http://ad.local/render.html')) return r.fulfill({ path: PAGE, contentType: 'text/html; charset=utf-8' });
    return r.abort(); });
  await p.goto('http://ad.local/render.html'); await p.waitForFunction(() => window.__ad, null, { timeout: 90000 });
  const R = await p.evaluate(k => window.__ad.prepare(k), scene); await p.evaluate(() => window.__ad.freeze());
  const F0 = R.f0, F1 = R.f1; const t0 = Date.now();
  if (out === 'stills') { const ts = a3.split(',').map(Number), dir = a4; fs.mkdirSync(dir, { recursive: true }); let f = 0;
    f = F0; for (const t of ts.sort((x, y) => x - y)) { const tf = Math.min(F1 - 1, Math.round(t * 30)); while (f <= tf) { await p.evaluate(fr => window.__ad.frame(fr), f); f++; } await p.screenshot({ path: `${dir}/${scene}_${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 92 }); }
    console.log('stills', ts.length, 'in', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'errs', JSON.stringify(errs.slice(0, 4))); await b.close(); return; }
  const from = a3 ? +a3 : F0, to = a4 ? Math.min(F1, +a4) : F1; const tmp = out.replace(/\.mp4$/, '.part.mp4');
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-vf', 'scale=in_color_matrix=bt601:in_range=pc:out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-f', 'mp4', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = F0; f < to; f++) { await p.evaluate(fr => window.__ad.frame(fr), f); if (f < from) continue; const buf = await p.screenshot({ type: 'jpeg', quality: 92 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if (f % 30 === 0) process.stdout.write(`${scene} ${f - F0}/${to - F0} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`); }
  ff.stdin.end(); const code = await new Promise(r => ff.on('close', r)); if (code === 0) fs.renameSync(tmp, out);
  console.log(scene, 'frames', to - from, 'ffmpeg', code, 'time', ((Date.now() - t0) / 1000).toFixed(1) + 's', 'errs', JSON.stringify(errs.slice(0, 4))); await b.close(); })();
