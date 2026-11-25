// tools/sigil_export.mjs — 十二人の記号（ロゴ）を SVG に書き出す。 node tools/sigil_export.mjs [出力先（既定 logos/svg）]
//   <id>.svg（明るい地むけの色）と <id>-on-dark.svg（暗い地むけの色）、家族の紋 crest.svg / crest-on-dark.svg
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKS, KIDS, BY, palette } from '../sigil/src/marks.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'logos', 'svg'));
fs.mkdirSync(out, { recursive: true });

const parts = (m, mode, wk = 1) => m.parts.map((p) => { const col = palette(m, mode)(p.tone);
  return p.kind === 'stroke' ? `<path d="${p.d}" fill="none" stroke="${col}" stroke-width="${+(p.w * wk).toFixed(4)}" stroke-linecap="${p.cap}" stroke-linejoin="${p.join}" stroke-miterlimit="6"/>` : `<path d="${p.d}" fill="${col}"/>`; }).join('\n  ');
const svg = (body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1.12 -1.12 2.24 2.24" width="512" height="512">\n  <title>${title}</title>\n  ${body}\n</svg>\n`;

for (const m of MARKS) for (const [mode, suffix] of [['light', ''], ['dark', '-on-dark']]) fs.writeFileSync(path.join(out, `${m.id}${suffix}.svg`), svg(parts(m, mode), `${m.name} — ${m.epithet}`));
// 家族の紋: フルルのひらいた輪のなかに、十一人の記号
for (const [mode, suffix] of [['light', ''], ['dark', '-on-dark']]) {
  const f = BY.fururu, ring = f.parts.find((p) => p.id === 'ring'), col = palette(f, mode)('main');
  let body = `<path d="${ring.d}" fill="none" stroke="${col}" stroke-width="${ring.w}" stroke-linecap="round"/>`;
  KIDS.forEach((m, i) => { const a = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / 11, x = Math.cos(a) * 0.52, y = Math.sin(a) * 0.52; body += `\n  <g transform="translate(${x.toFixed(4)} ${y.toFixed(4)}) scale(0.118)">\n  ${parts(m, mode, 1.25)}\n  </g>`; });
  fs.writeFileSync(path.join(out, `crest${suffix}.svg`), svg(body, '外神竜一族 — 家族の紋'));
}
console.log(`wrote ${MARKS.length * 2 + 2} SVG files to ${out}`);
