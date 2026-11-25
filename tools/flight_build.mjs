#!/usr/bin/env node
// tools/flight_build.mjs — ゲームを 1 つの HTML にまとめる。
//   node tools/flight_build.mjs [flight|strike] [--dev]
//   <ゲーム>/src/*.js を束ね、<ゲーム>/assets の音を data: URI で埋め込む。
//   flight/dist/artifact.html … 公開用（<html> や <body> を持たない中身だけ。公開時に外枠が付く）
//   flight/dist/index.html    … そのままブラウザで開ける版（同じ中身に外枠を付けたもの）
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'flight';
const SRC = path.join(ROOT, GAME), OUT = path.join(SRC, 'dist');
const dev = process.argv.includes('--dev');

const res = await build({ entryPoints: [path.join(SRC, 'src/main.js')], bundle: true, format: 'iife', target: 'es2020', minify: !dev, write: false, legalComments: 'none', charset: 'utf8' });
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const MIME = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.png': 'image/png', '.jpg': 'image/jpeg' };
const assets = {};
const adir = path.join(SRC, 'assets');
if (fs.existsSync(adir)) for (const f of fs.readdirSync(adir).sort()) {
  const ext = path.extname(f); if (!MIME[ext]) continue;
  assets[path.basename(f, ext)] = `data:${MIME[ext]};base64,${fs.readFileSync(path.join(adir, f)).toString('base64')}`;
}

let page = fs.readFileSync(path.join(SRC, 'page.html'), 'utf8');
page = page.replace('/*__ASSETS__*/', () => 'window.__FLIGHT_ASSETS=' + JSON.stringify(assets) + ';').replace('/*__BUNDLE__*/', () => js);

// 公開時に付く外枠にならったもの（文字コード・viewport・小さなリセット）
const shell = (body) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'artifact.html'), page);
fs.writeFileSync(path.join(OUT, 'index.html'), shell(page));
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`bundle ${kb(js.length)}  assets ${kb(Object.values(assets).reduce((a, s) => a + s.length, 0))} (${Object.keys(assets).length})  page ${kb(page.length)}`);
