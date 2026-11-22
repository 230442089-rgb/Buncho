// node preview.js <out.png> <js-expression> [scale]
const { chromium } = require('playwright');
(async () => {
  const [out, expr, sc] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: Number(sc || 1) });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto('file://' + __dirname + '/anim.html');
  await page.evaluate(expr);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out });
  await browser.close();
})();
