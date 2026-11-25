#!/usr/bin/env node
// tools/strike_models.mjs — 「B.U.N 襲来」の 3D モデル（ユリア・マッスル文鳥・小物）を作って strike/assets/models.bin に書く。
//   node tools/strike_models.mjs [モデル名 …]      名前を書くと、そのモデルだけ作り直す（ほかは前回のものを使う）
//   形は strike/model/*.mjs に、距離の場（SDF）の組み合わせとして書いてある。ここで網目にして、骨の重み・陰・材質の境目を焼き込む。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pack } from '../strike/model/pack.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'strike/assets/models.bin'), CACHE = path.join(ROOT, 'build/strike/models');
fs.mkdirSync(CACHE, { recursive: true });
const only = process.argv.slice(2);
const B = () => import('../strike/model/buncho.mjs'), P = () => import('../strike/model/props.mjs'), Y = () => import('../strike/model/yuria.mjs');
const LIST = [
  ['yuria', async () => (await Y()).buildYuria()], ['yuria_lo', async () => (await Y()).buildYuria({ lod: true })],
  ['buncho', async () => (await B()).buildBuncho()],
  ['buncho_lo', async () => (await B()).buildBuncho({ lod: 1 })], ['buncho_far', async () => (await B()).buildBuncho({ lod: 2 })],
  ['jetpack', async () => (await P()).buildJetpack()], ['bazooka', async () => (await P()).buildBazooka()], ['gatling', async () => (await P()).buildGatling()],
  ['jetpack_lo', async () => (await P()).buildJetpack(true)], ['bazooka_lo', async () => (await P()).buildBazooka(true)], ['gatling_lo', async () => (await P()).buildGatling(true)],
  ['shades', async () => (await P()).buildShades()], ['cap', async () => (await P()).buildCap()], ['cape', async () => (await P()).buildCape()], ['chute', async () => (await P()).buildChute()],
  ['round', async () => (await P()).buildRound('round', { trace: '#ff7a30' })], ['slug', async () => (await P()).buildRound('slug', { r: 0.24, len: 0.9, blunt: 0.4, trace: '#7dff6a', nose: 'dark' })], ['bullet', async () => (await P()).buildRound('bullet', { r: 0.11, len: 1.0, blunt: 0.12, trace: '#ffd54a', nose: 'brass' })],
  ['rocket', async () => (await P()).buildRocket()], ['missile', async () => (await P()).buildMissile()], ['mine', async () => (await P()).buildMine()], ['gem', async () => (await P()).buildGem()], ['arrow', async () => (await P()).buildArrow()],
];
const built = [];
for (const [name, make] of LIST) {
  const cf = path.join(CACHE, name + '.json');
  if (only.length && !only.includes(name) && fs.existsSync(cf)) { const c = JSON.parse(fs.readFileSync(cf, 'utf8')); built.push({ head: c.head, bufs: c.bufs.map((b) => Buffer.from(b, 'base64')) }); console.log(`${name}: （前回のもの）`); continue; }
  const t0 = Date.now(); console.log(`${name}:`);
  const m = await make(), r = m.build((s) => console.log(s));
  fs.writeFileSync(cf, JSON.stringify({ head: r.head, bufs: r.bufs.map((b) => b.toString('base64')) }));
  built.push(r); console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)} 秒`);
}
const bin = pack(built);
fs.writeFileSync(OUT, bin);
console.log(`→ ${path.relative(ROOT, OUT)}  ${(bin.length / 1024).toFixed(0)} KB`);
