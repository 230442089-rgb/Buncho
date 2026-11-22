// node sheet.js out.png t1,t2,... [cols] — contact sheet of frames (each 360x640)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
(async () => {
  const [out, list, cols] = process.argv.slice(2);
  const ts = list.split(',').map(Number);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await page.goto('file://' + __dirname + '/anim.html');
  await page.evaluate(() => document.fonts.ready);
  const files = [];
  for (const [i, t] of ts.entries()) {
    await page.evaluate(t => renderFrame(t), t);
    await page.evaluate(() => document.fonts.ready);
    const f = `/tmp/sheet_${i}.png`; await page.screenshot({ path: f }); files.push(f);
  }
  await browser.close();
  const c = Number(cols || 4), rows = Math.ceil(files.length / c);
  const args = ['-v', 'error', '-y'];
  files.forEach(f => args.push('-i', f));
  let fc = files.map((_, i) => `[${i}]scale=360:640,drawtext=text='${ts[i].toFixed(1)}':x=8:y=8:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.5[v${i}]`).join(';');
  const pads = c * rows - files.length;
  for (let k = 0; k < pads; k++) fc += `;color=black:s=360x640:d=1[p${k}]`;
  const ins = files.map((_, i) => `[v${i}]`).join('') + Array.from({ length: pads }, (_, k) => `[p${k}]`).join('');
  fc += `;${ins}xstack=inputs=${c * rows}:layout=${Array.from({ length: c * rows }, (_, k) => `${(k % c) * 360}_${Math.floor(k / c) * 640}`).join('|')}`;
  args.push('-filter_complex', fc, '-frames:v', '1', out);
  execFileSync('ffmpeg', args);
  files.forEach(f => fs.unlinkSync(f));
})();
