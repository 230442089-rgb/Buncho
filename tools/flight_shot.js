#!/usr/bin/env node
// tools/flight_shot.js — 飛行ゲームをヘッドレス Chromium で開き、ページ内で関数を実行して静止画を撮る（確認用）。
//   node tools/flight_shot.js --size 960x540 --query "q=high&sync" --out build/flight/a.jpg --eval "__flight.shot({...})"
//   --eval は何回でも書ける。--out を書くたびに、その時点の画面を保存する。--script FILE でページ内で動かす JS を読む。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const args = process.argv.slice(2);
  let size = [960, 540], query = '', file = path.resolve(__dirname, '../flight/dist/index.html'), dsf = 1, wait = 'ready', timeout = 240000, mobile = false;
  const steps = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--size') size = args[++i].split('x').map(Number);
    else if (a === '--query') query = args[++i];
    else if (a === '--file') file = path.resolve(args[++i]);
    else if (a === '--dsf') dsf = Number(args[++i]);
    else if (a === '--mobile') mobile = true;
    else if (a === '--wait') wait = args[++i];
    else if (a === '--eval') steps.push({ eval: args[++i] });
    else if (a === '--script') steps.push({ eval: fs.readFileSync(args[++i], 'utf8') });
    else if (a === '--out') steps.push({ out: path.resolve(args[++i]) });
    else if (a === '--sleep') steps.push({ sleep: Number(args[++i]) });
    else if (a === '--click') steps.push({ click: args[++i] });
    else if (a === '--key') steps.push({ key: args[++i] });
  }
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: dsf, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  let errors = 0;
  page.on('console', (m) => { const t = m.text(); if (/GPU stall due to ReadPixels|Automatic fallback to software WebGL/.test(t)) return; if (m.type() === 'error') errors++; console.log(`[page:${m.type()}]`, t); });
  page.on('pageerror', (e) => { errors++; console.log('[pageerror]', String(e)); });
  const t0 = Date.now();
  await page.goto('file://' + file + (query ? '?' + query : ''));
  await page.waitForFunction((w) => window.__flight && (window.__flight.state === w || window.__flight.state === 'error'), wait, { timeout });
  const st = await page.evaluate(() => ({ state: window.__flight.state, error: window.__flight.error }));
  console.log(`boot ${((Date.now() - t0) / 1000).toFixed(1)}s  state=${st.state}`);
  if (st.state === 'error') { console.log(st.error); await browser.close(); process.exit(1); }
  for (const s of steps) {
    if (s.eval) { const t1 = Date.now(); const r = await page.evaluate(`(async () => { return (${s.eval}); })()`); console.log(`eval ${Date.now() - t1}ms →`, typeof r === 'string' ? r : JSON.stringify(r)); }
    else if (s.sleep) await page.waitForTimeout(s.sleep);
    else if (s.click) await page.click(s.click);
    else if (s.key) await page.keyboard.press(s.key);
    else if (s.out) { fs.mkdirSync(path.dirname(s.out), { recursive: true }); await page.screenshot(/\.png$/.test(s.out) ? { path: s.out, type: 'png' } : { path: s.out, type: 'jpeg', quality: 92 }); console.log('saved', s.out); }
  }
  await browser.close();
  process.exit(errors ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
