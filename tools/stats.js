#!/usr/bin/env node
// tools/stats.js — このフィルムを生成しているプログラムの行数を数えて film/stats.json に書く（クレジットに表示する数）
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(js|html|py)$/.test(f)) files.push(p); } };
walk(path.join(ROOT, 'film', 'src')); files.push(path.join(ROOT, 'film', 'index.html')); walk(path.join(ROOT, 'tools'));
let loc = 0;
for (const f of files) loc += fs.readFileSync(f, 'utf8').split('\n').length;
fs.writeFileSync(path.join(ROOT, 'film', 'stats.json'), JSON.stringify({ loc, files: files.length }) + '\n');
console.log(`stats: ${loc} lines in ${files.length} files`);
