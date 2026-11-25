#!/usr/bin/env node
// tools/stats.js — 映像を生成しているプログラムの行数を数えて <film>/stats.json に書く（クレジットに表示する数）
//   node tools/stats.js          … film/（言葉は、世界になる。）
//   node tools/stats.js atom     … atom/（見えない火）: atom/ と、借りている film/src のエンジン部分、tools/ を数える
//   node tools/stats.js mama     … mama/（ふたりとも、おいでぇ♡）: mama/ と、借りている chase/src・film/src/core.js、使った道具だけを数える
//   node tools/stats.js sigil    … sigil/（十二の紋章）: sigil/ と film/src/core.js、使った道具だけを数える
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const which = process.argv[2] || 'film';
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|html|py)$/.test(f)) files.push(p); } };
if (which === 'film') { walk(path.join(ROOT, 'film', 'src')); files.push(path.join(ROOT, 'film', 'index.html')); }
else if (which === 'mama') {      // 実際に使っているものだけ: mama/、人物と小道具（chase/src）、数学の道具、撮影と音の道具
  walk(path.join(ROOT, 'mama', 'src')); files.push(path.join(ROOT, 'mama', 'index.html')); walk(path.join(ROOT, 'chase', 'src')); files.push(path.join(ROOT, 'film', 'src', 'core.js'));
  for (const f of ['render.js', 'frame.js', 'lib.js', 'stats.js', 'sheet.py', 'mama_audio.py']) if (fs.existsSync(path.join(ROOT, 'tools', f))) files.push(path.join(ROOT, 'tools', f));
} else if (which === 'sigil') {      // 記号の定義・動き・音・書き出しの道具
  walk(path.join(ROOT, 'sigil', 'src')); files.push(path.join(ROOT, 'sigil', 'index.html'), path.join(ROOT, 'film', 'src', 'core.js'));
  for (const f of ['render.js', 'frame.js', 'lib.js', 'stats.js', 'sheet.py', 'sigil_audio.py', 'sigil_export.mjs']) if (fs.existsSync(path.join(ROOT, 'tools', f))) files.push(path.join(ROOT, 'tools', f));
} else {
  walk(path.join(ROOT, which, 'src')); files.push(path.join(ROOT, which, 'index.html'));
  for (const f of ['core.js', 'gl.js', 'post.js', 'overlay.js', 'lines.js']) files.push(path.join(ROOT, 'film', 'src', f));
}
if (which !== 'mama' && which !== 'sigil') walk(path.join(ROOT, 'tools'));
let loc = 0;
for (const f of files) loc += fs.readFileSync(f, 'utf8').split('\n').length;
fs.writeFileSync(path.join(ROOT, which, 'stats.json'), JSON.stringify({ loc, files: files.length }) + '\n');
console.log(`stats(${which}): ${loc} lines in ${files.length} files`);
