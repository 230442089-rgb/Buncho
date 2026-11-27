// index.html から、Artifact として公開するためのページ断片 dist/artifact.html を作る。
//   node tools/build-artifact.mjs
// 公開時は doctype/html/head/body が自動で付くので、断片には <title>・<style>・本文だけを入れる。
// スクリプト(src/*.js)は別ファイルのまま、同じ相対パスでページの隣に置く。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// index.html が読み込んでいる手元のスタイルシートを、順番どおりに一つにまとめて埋め込む
const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
const css = sheets.map(u => fs.readFileSync(path.join(root, u), 'utf8')).join('\n');

function section(name) {
  const m = html.match(new RegExp(`<!-- ARTIFACT-${name}:BEGIN -->([\\s\\S]*?)<!-- ARTIFACT-${name}:END -->`));
  if (!m) throw new Error(`index.html に ARTIFACT-${name} の目印がありません`);
  return m[1].trim();
}
const out = `${section('HEAD')}\n<style>\n${css}</style>\n${section('BODY')}\n`;
if (/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(out)) throw new Error('断片に文書の骨組みのタグが混ざっています');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact.html'), out);
const scripts = [...out.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u)); // CDN から読むものは除く
console.log(`dist/artifact.html ${(out.length / 1024).toFixed(1)} KB`);
console.log('埋め込んだスタイル:', sheets.join(', '));
console.log('一緒に公開するファイル:', scripts.join(', '));
