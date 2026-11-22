// node render.js [workers] [scene ids...] — renders each scene to scenes/<idx>_<id>.mp4 (30fps, 1080x1920)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const FPS = 30;
(async () => {
  const workers = Number(process.argv[2] || 4);
  const only = process.argv.slice(3);
  fs.mkdirSync(__dirname + '/' + (process.env.OUT || 'scenes'), { recursive: true });
  const browser = await chromium.launch();
  const probe = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await probe.goto('file://' + __dirname + '/' + (process.env.PAGE || 'anim.html'));
  const scenes = await probe.evaluate(() => SCENES.map((s, i) => ({ i, id: s.id, start: s.start, dur: s.dur })));
  await probe.close();
  const queue = scenes.filter(s => !only.length || only.includes(s.id)).sort((a, b) => b.dur - a.dur);
  const t0 = Date.now();
  async function work(wid) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    page.on('pageerror', e => console.error('PAGE ERROR', e.message));
    await page.goto('file://' + __dirname + '/' + (process.env.PAGE || 'anim.html'));
    await page.evaluate(async () => {
      for (const w of ['700', '500']) await document.fonts.load(`${w} 50px "Zen Maru Gothic"`, ALL_TEXT);
      await document.fonts.ready;
    });
    while (queue.length) {
      const sc = queue.shift();
      const n = Math.round(sc.dur * FPS);
      const base = `${__dirname}/${process.env.OUT || 'scenes'}/${String(sc.i).padStart(2, '0')}_${sc.id}`;
      const tmp = base + '.tmp.mp4';
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', tmp]);
      ff.stderr.on('data', d => process.stderr.write(d));
      const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))));
      for (let k = 0; k < n; k++) {
        const t = sc.start + k / FPS;
        await page.evaluate(t => renderFrame(t), t);
        const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      ff.stdin.end();
      await done;
      fs.renameSync(tmp, base + '.mp4');
      console.log(`[w${wid}] ${sc.id}: ${n} frames done at ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    await page.close();
  }
  await Promise.all(Array.from({ length: workers }, (_, i) => work(i)));
  await browser.close();
  console.log('ALL DONE', ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
