// tools/lib.js — film/ を配信するローカルサーバーと、ヘッドレス Chromium でページを開く共通処理
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, u);
      if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function openFilm({ query = '', quiet = false } = {}) {
  const { server, port } = await serve();
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => {
    const t = m.text();
    if (/GPU stall due to ReadPixels/.test(t)) return;
    if (m.type() === 'error') errors.push(t);
    if (!quiet || m.type() === 'error' || /^prof /.test(t)) console.log(`[page:${m.type()}]`, t);
  });
  page.on('pageerror', (e) => { errors.push(String(e)); console.log('[pageerror]', String(e)); });
  await page.goto(`http://127.0.0.1:${port}/film/index.html${query ? '?' + query : ''}`);
  await page.waitForFunction(() => window.film && window.film.state !== 'loading', null, { timeout: 300000 });
  const state = await page.evaluate(() => ({ state: window.film.state, error: window.film.error, frames: window.film.frames, layers: window.film.layers, stats: window.film.stats }));
  if (state.state !== 'ready') { await browser.close(); server.close(); throw new Error('film failed to boot:\n' + state.error); }
  const close = async () => { await browser.close(); server.close(); };
  return { browser, page, close, info: state, errors };
}

// 秒・フレーム・小節の指定を読む: "12.5"(秒) / "f375"(フレーム) / "b4.5"(小節)
const BPM = 72.5, BAR = 240 / BPM, T0 = 0.034, FPS = 30;
function parseTime(s) {
  s = String(s);
  if (s.startsWith('f')) return parseInt(s.slice(1), 10);
  if (s.startsWith('b')) return Math.round((T0 + parseFloat(s.slice(1)) * BAR) * FPS);
  return Math.round(parseFloat(s) * FPS);
}

module.exports = { openFilm, parseTime, ROOT, FPS, BAR, T0 };
