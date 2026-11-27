// index.html から、Artifact として公開するためのページ断片 dist/artifact.html を作る。
//   node tools/build-artifact.mjs
// 公開時は doctype/html/head/body が自動で付くので、断片には <title>・<style>・本文だけを入れる。
// スクリプト(src/*.js)は別ファイルのまま、同じ相対パスでページの隣に置く。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');

function section(name) {
  const m = html.match(new RegExp(`<!-- ARTIFACT-${name}:BEGIN -->([\\s\\S]*?)<!-- ARTIFACT-${name}:END -->`));
  if (!m) throw new Error(`index.html に ARTIFACT-${name} の目印がありません`);
  return m[1].trim();
}
const out = `${section('HEAD')}\n<style>\n${css}</style>\n${section('BODY')}\n`;
if (/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(out)) throw new Error('断片に文書の骨組みのタグが混ざっています');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact.html'), out);
const scripts = [...out.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
console.log(`dist/artifact.html ${(out.length / 1024).toFixed(1)} KB`);
console.log('一緒に公開するファイル:', scripts.join(', '));
