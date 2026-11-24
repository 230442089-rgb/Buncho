// fallout.js — 5 章「拡散」。閉じ込めを失った放射性物質が風に乗り、雨や雪で地面に落ちる。避難。そして、検討された最悪の想定。
// 地図は模式図（地形は作りもの。原発から見た町の方角と距離、北西へのびた汚染の向きは実際にもとづく）。
// 煙は「パフモデル」: 次々に放出される煙のかたまり（パフ）を、時間とともに変わる風で流し、広げていく。雨域を通ったぶんが地面に残る。
import { T, W, H, COL, sat, smoothstep, ease, lerp, clamp, mulberry32, TAU } from '../core.js';
import { Dots, chap, narr, sub, label, big, source, inout } from '../kit.js';
import { Lines } from '../../../film/src/lines.js';

const T0 = T.resume, T_END = T.invisible;
const S0 = 13.2, P0 = [1300, 560];            // はじめの縮尺（画素/km）と、原発の画面上の位置
const S1 = 1.7, P1 = [1120, 420];             // 最悪の想定の図
const scaleAt = (t) => Math.exp(lerp(Math.log(S0), Math.log(S1), ease.inOutCubic(sat((t - T.worst) / 2.6))));
const centerAt = (t) => { const u = ease.inOutCubic(sat((t - T.worst) / 2.6)); return [lerp(P0[0], P1[0], u), lerp(P0[1], P1[1], u)]; };
// 海岸線（x = 東向きの km、y = 北向きの km）
const coastX = (y) => -0.10 * y + 1.6 * Math.sin(y * 0.045 + 0.5) + 0.7 * Math.sin(y * 0.19);

const FS_MAP = /* glsl */ `
uniform vec2 uP0; uniform float uS;
out vec4 o;
float coast(float y){ return -0.10 * y + 1.6 * sin(y * 0.045 + 0.5) + 0.7 * sin(y * 0.19); }
float height(vec2 p){
  float d = coast(p.y) - p.x;                                   // 海岸からの距離（内陸が正）
  float hills = smoothstep(4.0, 22.0, d) * (1.0 - 0.75 * exp(-pow((d - 57.0) / 9.0, 2.0)));   // 海沿いの平野、阿武隈の山地、中通りの谷
  float far = smoothstep(66.0, 90.0, d);
  float n = fbm(p * 0.045 + 3.1) * 0.55 + fbm(p * 0.12 - 7.7) * 0.22;
  return max(0.0, hills * (0.42 + n) + far * 0.5 + 0.05 * n);
}
void main(){
  vec2 p = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uP0) / uS; p.y = -p.y;      // km
  float d = coast(p.y) - p.x;
  float h = height(p);
  float e = 0.6;
  vec2 gr = vec2(height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0)), height(p + vec2(0.0, e)) - height(p - vec2(0.0, e))) / (2.0 * e);
  float shade = clamp(0.5 + dot(gr, normalize(vec2(1.0, -1.0))) * 6.0, 0.0, 1.0);          // 北西からの光
  vec3 land = mix(vec3(0.010, 0.016, 0.022), vec3(0.030, 0.040, 0.046), smoothstep(0.0, 0.9, h));
  land *= 0.55 + 0.9 * shade;
  float cl = abs(fract(h * 7.0) - 0.5) / (fwidth(h * 7.0) + 1e-4);                           // 等高線
  land += vec3(0.020, 0.030, 0.040) * (1.0 - smoothstep(0.0, 1.4, cl)) * smoothstep(0.03, 0.12, h);
  vec3 sea = mix(vec3(0.0035, 0.010, 0.026), vec3(0.0012, 0.0035, 0.011), smoothstep(0.0, 60.0, -d));
  sea += vec3(0.004, 0.012, 0.026) * (0.5 + 0.5 * sin(-d * 0.9 + 3.0 * fbm(p * 0.08))) * exp(d * 0.10);   // 岸に寄せる波のすじ
  float aw = 1.2 / uS;
  vec3 col = mix(sea, land, smoothstep(-aw, aw, d));
  col += vec3(0.09, 0.17, 0.26) * exp(-abs(d) * uS * 0.45);                                   // 海岸線
  o = vec4(col, 1.0);
}`;
// 地図・地面に残った量・空気中の煙を重ねる。沈着は量に応じて 暗い赤 → 橙 → 黄 の段階で塗る（汚染地図の描き方）
const FS_COMP = /* glsl */ `
uniform sampler2D uTex, uDep, uAir; uniform vec2 uC, uC0; uniform float uK, uA, uDepA;
out vec4 o;
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 q = (px - uC) * uK + uC0;                                 // いまの画素 → 焼いた地図の画素
  vec2 uv = vec2(q.x, uRes.y - q.y) / uRes;
  vec2 e = min(uv, 1.0 - uv);
  float inside = smoothstep(0.0, 0.03 + 0.30 * sat((uK - 1.0) / 2.5), min(e.x, e.y));
  vec2 cuv = clamp(uv, 0.0, 1.0);
  vec3 col = mix(vec3(0.0012, 0.0030, 0.0085), texture(uTex, cuv).rgb, inside * uA);
  float m = smoothstep(0.0, 0.06, min(e.x, e.y));
  float dep = texture(uDep, cuv).r * m, air = texture(uAir, cuv).r * m;
  float d = 1.0 - exp(-dep * 0.9);
  vec3 dc = mix(vec3(0.20, 0.012, 0.0), vec3(0.95, 0.20, 0.02), smoothstep(0.05, 0.55, d));
  dc = mix(dc, vec3(1.0, 0.70, 0.22), smoothstep(0.55, 0.98, d));
  col = mix(col, dc * (0.30 + 0.95 * d), sat(d * 2.2) * uDepA);
  float a = 1.0 - exp(-air * 0.8);
  col += vec3(0.95, 0.70, 0.38) * a * 0.42;
  o = vec4(col, 1.0);
}`;

// 町（原発から 東へ km、北へ km）
const TOWNS = [
  ['双葉・大熊', -2.2, 0.8, 0], ['浪江', -3.2, 8.6, 1], ['富岡', -1.4, -9.2, 1], ['南相馬', -4.5, 24.5, 1], ['葛尾', -22, 9, 0], ['川内', -19, -8, 0], ['楢葉', -1.6, -16.5, 0],
  ['飯舘', -27, 29, 1], ['川俣', -38, 26, 0], ['福島', -49.5, 37.5, 1], ['二本松', -50, 19, 0], ['郡山', -59, -2, 1], ['田村', -38, 2, 0], ['いわき', -12, -39, 0],
];
// 広い図: 都市（東へ km、北へ km）と、太平洋側の海岸線のあらまし
const CITIES = [['仙台', -14, 94], ['山形', -59, 91], ['福島', -49.5, 37.5], ['郡山', -59, -2], ['新潟', -177, 53], ['いわき', -12, -43], ['水戸', -50, -117], ['宇都宮', -103, -96], ['前橋', -177, -115], ['さいたま', -125, -174], ['千葉', -83, -201], ['東京', -113, -194], ['横浜', -126, -220]];
const COAST = [[60, 150], [41, 98], [14, 92], [-3, 86], [-7, 42], [0, 0], [-4, -30], [-11.5, -54.5], [-33.6, -91], [-41, -123.5], [-35, -158], [-18, -188], [-40, -225], [-66, -253], [-90, -262]];

export const id = 'fallout';
export async function create(env) {
  const { g, ov } = env;
  const dots = new Dots(env, 16384), lines = new Lines(g, 8192);
  const pMap = g.program(FS_MAP, 'map'), pComp = g.program(FS_COMP, 'mapComp');
  const mapTex = g.target(W, H, { type: 'rgba16f' });
  g.draw(pMap, { uP0: P0, uS: S0 }, mapTex);
  // 沈着（積もっていく）と空気中の煙（毎フレーム描き直す）は、半分の解像度の別バッファに量として描く
  const HW = W / 2, HH = H / 2;
  const depTex = g.target(HW, HH, { type: 'rgba16f' }), airTex = g.target(HW, HH, { type: 'rgba16f' });
  const acc = new Dots(env, 16384);
  let depT = -1e9, depI = 0;

  // ---- 風: 吹いていく先の方角（度。0 = 東、反時計回り）を時刻の関数として決め、積分しておく
  const WIND_K = [[T0, 12], [T0 + 5.2, 8], [T0 + 8.6, -78], [T0 + 11.4, -222], [T0 + 19.5, -232], [T0 + 25.0, -340]];
  const dirAt = (t) => { for (let i = 0; i < WIND_K.length - 1; i++) if (t <= WIND_K[i + 1][0]) return lerp(WIND_K[i][1], WIND_K[i + 1][1], ease.inOutSine(sat((t - WIND_K[i][0]) / (WIND_K[i + 1][0] - WIND_K[i][0])))); return WIND_K[WIND_K.length - 1][1]; };
  const SPEED = 9.5, DT = 0.05, CUM = [[0, 0]];
  for (let t = T0; t < T_END + 1; t += DT) { const a = (dirAt(t) * Math.PI) / 180, c = CUM[CUM.length - 1]; CUM.push([c[0] + Math.cos(a) * SPEED * DT, c[1] + Math.sin(a) * SPEED * DT]); }
  const cumAt = (t) => { const x = clamp((t - T0) / DT, 0, CUM.length - 1.001), i = Math.floor(x), f = x - i; return [lerp(CUM[i][0], CUM[i + 1][0], f), lerp(CUM[i][1], CUM[i + 1][1], f)]; };
  // ---- 雨・雪の区域（北西の山あいを通り過ぎる）
  const rain = (t) => { const a = smoothstep(T0 + 10.2, T0 + 12.4, t) * (1 - smoothstep(T0 + 18.5, T0 + 21.5, t)); return { a, x: lerp(-40, -25, sat((t - T0 - 10) / 11)), y: lerp(27, 22, sat((t - T0 - 10) / 11)), rx: 24, ry: 15 }; };
  const rainAt = (x, y, t) => { const r = rain(t); if (r.a <= 0) return 0; const d = Math.pow((x - r.x) / r.rx, 2) + Math.pow((y - r.y) / r.ry, 2); return r.a * Math.exp(-d * 1.4); };
  // ---- パフ
  const rng = mulberry32(311);
  const NP = 620, EMIT0 = T0 + 0.3, EMIT1 = T0 + 23.5, NS = 16, DS = 0.42;
  const puffs = Array.from({ length: NP }, (_, i) => ({ te: lerp(EMIT0, EMIT1, (i + rng()) / NP), n: [rng.gauss(), rng.gauss()], m: rng() * TAU, w: 0.6 + 0.8 * rng() }));
  const emitI = (te) => smoothstep(EMIT0, EMIT0 + 1.5, te) * (1 - 0.85 * smoothstep(T0 + 17, EMIT1, te));
  const puffPos = (p, t) => {
    const a = cumAt(t), b = cumAt(p.te), age = t - p.te, sg = 0.5 + 1.75 * Math.sqrt(age);
    return [a[0] - b[0] + p.n[0] * sg + 0.9 * Math.sin(p.m + age * 0.7) * Math.sqrt(age), a[1] - b[1] + p.n[1] * sg + 0.9 * Math.cos(p.m * 1.3 + age * 0.6) * Math.sqrt(age), age];
  };
  // 地面に残るぶんは、前もって計算しておく（パフごとに、決まった時刻での位置と量）
  const deposits = [];
  for (const p of puffs) {
    let rem = 1;                                                            // 雨に洗い落とされると、煙は薄くなる
    for (let j = 1; j <= NS; j++) {
      const ts = p.te + j * DS; if (ts > T_END) break;
      const [x, y, age] = puffPos(p, ts);
      const wet = rainAt(x, y, ts), conc = rem * emitI(p.te) * p.w / (1 + 0.35 * age);
      rem *= Math.exp(-wet * 0.85);
      if (x > coastX(y) - 0.5) continue;                                    // 海に落ちたぶんは描かない
      const amt = (0.03 + 1.0 * wet) * conc;
      if (amt > 0.012) deposits.push({ t: ts, x, y, r: 1.6 + 1.1 * Math.sqrt(age), a: amt });
    }
  }
  deposits.sort((a, b) => a.t - b.t);
  // ---- 町のあかりと、避難する人の点
  const townDots = [];
  for (const [name, x, y] of TOWNS) { const n = name === '福島' || name === '郡山' || name === 'いわき' ? 34 : name === '南相馬' ? 22 : 12, sp = n > 20 ? 3.4 : 1.7; for (let i = 0; i < n; i++) townDots.push([x + rng.gauss() * sp, y + rng.gauss() * sp * 0.8, rng()]); }
  const DEST = [[-49.5, 37.5], [-59, -2], [-12, -39], [-70, 30], [-30, 52], [-75, -20], [-6, 46]];
  const evac = [];
  for (const [name, x, y] of TOWNS.slice(0, 8)) for (let i = 0; i < (name === '南相馬' ? 46 : 30); i++) {
    const d = DEST[Math.floor(rng() * DEST.length)];
    evac.push({ a: [x + rng.gauss() * 1.6, y + rng.gauss() * 1.4], b: [d[0] + rng.gauss() * 3, d[1] + rng.gauss() * 3], t0: T.evac + 0.6 + rng() * 6.5 + (name === '飯舘' ? 4 : 0), d: 3.2 + 2.4 * rng(), bend: rng.range(-0.25, 0.25) });
  }

  // ---- 文字
  chap(ov, { n: 5, kanji: '拡散', en: 'FALLOUT', t0: T0 + 0.3, t1: T_END - 0.2, warn: true });
  narr(ov, { text: '閉じ込めを失った放射性物質は、<em>風</em>に乗る。', t0: T0 + 0.5, t1: T0 + 4.2 });
  narr(ov, { text: '風が海へ向かえば、陸の汚染は少ない。', t0: T0 + 4.5, t1: T0 + 8.8 });
  narr(ov, { text: '風が陸へ向き、そこに<b>雨や雪</b>が降ると——\n放射性物質は地面に落ちて、長く残る。', t0: T0 + 9.1, t1: T.evac - 0.2 });
  narr(ov, { text: '汚染は、同心円には広がらない。', t0: T.evac + 0.3, t1: T.evac + 4.4 });
  narr(ov, { text: '福島では、最大 <em>16 万 4865</em> 人が避難した。', t0: T.evac + 4.7, t1: T.worst - 0.2 });
  sub(ov, { text: 'チェルノブイリでは 1986 年に約 11 万 6 千人、その後さらに 20 万人以上が移住した', t0: T.evac + 5.4, t1: T.worst - 0.25, y: 962 });
  narr(ov, { text: '政府内で検討された最悪の想定では、\n<i>170 km</i> 圏が強制移転、<em>250 km</em> 圏が任意移転。', t0: T.worst + 0.5, t1: T.worst + 5.6 });
  narr(ov, { text: 'その円は、<em>東京</em>を含んでいた。', t0: T.worst + 5.9, t1: T_END - 0.2 });
  sub(ov, { text: '燃料プールの燃料まで溶けた場合の試算（2011 年 3 月 25 日、原子力委員長）。実際には、そこまで至らなかった', t0: T.worst + 6.5, t1: T_END - 0.25, y: 962 });
  source(ov, { text: '福島県（避難者数）／WHO・チェルノブイリ・フォーラム／模式図: 地形は簡略化', t0: T.evac + 5.0, t1: T.worst - 0.2 });
  // 放出された主な核種
  ov.add({
    t0: T0 + 1.2, t1: T.evac - 0.3, className: 'rows', style: { left: '104px', top: '190px' },
    html: [['ヨウ素 131', '半減期 8 日'], ['セシウム 134', '半減期 2 年'], ['セシウム 137', '半減期 30 年']].map(([n, h]) => `<div class="row" style="margin-bottom:18px"><div class="h">${n}</div><div class="d" style="font-size:22px;margin-left:22px">${h}</div></div>`).join(''),
    update(el, tl) { [...el.children].forEach((r, i) => { const a = ease.outCubic(sat((tl - i * 0.35) / 0.6)); r.style.opacity = (a * (1 - smoothstep(T.evac - 0.3 - T0 - 1.2 - 0.5, T.evac - 0.3 - T0 - 1.2, tl))).toFixed(4); r.style.transform = `translateX(${((1 - a) * -10).toFixed(2)}px)`; }); },
  });
  // 地図の上の名札（縮尺と中心が変わるので、位置は毎フレーム計算する）
  const km = (t, x, y) => { const s = scaleAt(t), c = centerAt(t); return [c[0] + x * s, c[1] - y * s]; };
  const mapLabel = (html, x, y, t0, t1, opt = {}) => ov.add({
    t0, t1, className: 'lbl' + (opt.align === 'r' ? ' r' : opt.align === 'c' ? ' c' : ''), html, style: { fontSize: (opt.size || 23) + 'px' },
    update(el, tl, t) {
      const q = km(t, x, y), dx = opt.dx ?? 12, dy = opt.dy ?? -18;
      if (opt.align === 'r') { el.style.right = (W - q[0] + dx).toFixed(1) + 'px'; el.style.left = 'auto'; } else el.style.left = (q[0] + (opt.align === 'c' ? 0 : dx)).toFixed(1) + 'px';
      el.style.top = (q[1] + dy).toFixed(1) + 'px'; el.style.opacity = (inout(tl, t1 - t0, 0.5, 0.45) * (opt.o || 1)).toFixed(4);
    },
  });
  mapLabel('<span style="font-size:27px">福島第一原発</span>', 0, 0, T0 + 0.8, T.worst + 1.0, { dx: 16, dy: -17 });
  mapLabel('太平洋', 25, -27, T0 + 1.5, T.worst + 0.4, { o: 0.6, size: 25, dx: 0, dy: 0 });
  for (const [name, x, y, show] of TOWNS) if (show) mapLabel(name, x, y, T0 + 2.0 + Math.abs(x) * 0.02, T.worst + 0.4, { align: 'r', dx: 12, o: 0.86 });
  mapLabel('<b>雨・雪</b>', -58, 34, T0 + 11.2, T0 + 19.5, { size: 27, align: 'c' });
  [[3, '3 km'], [10, '10 km'], [20, '20 km 避難'], [30, '30 km 屋内退避']].forEach(([r, txt], i) => mapLabel(txt, r * 0.71, -r * 0.71, T.evac + 0.5 + i * 0.6, T.worst + 0.6, { dx: 8, dy: 2, size: 22, o: 0.9 }));
  label(ov, { html: '風向き', t0: T0 + 1.0, t1: T.evac - 0.2, x: 1640, y: 392, align: 'c', size: 23 });
  label(ov, { html: '20 km', t0: T0 + 1.4, t1: T.worst - 0.1, x: 1560 + 10 * S0, y: 962, align: 'c', size: 22 });
  // 広い図の名札
  for (const [name, x, y] of CITIES) mapLabel(name === '東京' ? '<span style="font-size:34px"><em>東京</em></span>' : name, x, y, T.worst + 2.4 + (name === '東京' ? 3.4 : 0), T_END - 0.3, { align: name === '仙台' || name === '水戸' || name === 'いわき' || name === '千葉' ? 'l' : 'r', dx: 12, dy: -17, o: name === '東京' ? 1 : 0.8, size: 22 });
  mapLabel('<i>170 km</i><small>強制移転</small>', 170 * 0.5, 170 * 0.866, T.worst + 2.8, T_END - 0.3, { dx: 14, dy: -30, size: 28 });
  mapLabel('<em>250 km</em><small>任意移転</small>', 250 * 0.5, 250 * 0.866, T.worst + 3.3, T_END - 0.3, { dx: 14, dy: -8, size: 28 });
  mapLabel('太平洋', 120, -70, T.worst + 2.6, T_END - 0.3, { o: 0.55, size: 25 });

  const dashed = (cx, cy, r, col, I, w = 2, n = 72) => { for (let k = 0; k < n; k++) { const a0 = (k / n) * TAU, a1 = ((k + 0.56) / n) * TAU; lines.seg(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, w, I, col); } };

  return {
    id: 'fallout', t0: T0, t1: T_END,
    render(env, tl, t) {
      const p = env.p, s = scaleAt(t), c = centerAt(t);
      const wide = sat((t - T.worst) / 2.6), mapA = 1 - smoothstep(0.03, 0.5, wide);
      // 沈着: 前のフレームからの増えたぶんだけ描き足す（時間が戻ったら、はじめから描き直す）
      if (t < depT) { depI = 0; depT = -1e9; }
      g.bind(depTex); if (depI === 0) g.clear(0, 0, 0, 1);
      acc.begin();
      while (depI < deposits.length && deposits[depI].t <= t) { const d = deposits[depI++]; acc.add((P0[0] + d.x * S0) / 2, (P0[1] - d.y * S0) / 2, Math.max(d.r * S0 / 2, 1.2), d.a * 0.115, [1, 0, 0]); }
      acc.flush('add', { gauss: 1 }); depT = t;
      // 空気中の煙
      g.bind(airTex); g.clear(0, 0, 0, 1);
      acc.begin();
      for (const pf of puffs) {
        if (pf.te > t) continue;
        const [x, y, age] = puffPos(pf, t); if (age > 9.5) continue;
        const I = emitI(pf.te) * pf.w * smoothstep(0, 0.25, age) / (1 + 0.2 * age * age) * (1 - smoothstep(7, 9.5, age));
        acc.add((P0[0] + x * S0) / 2, (P0[1] - y * S0) / 2, (1.5 + 2.1 * Math.sqrt(age)) * S0 / 2, 0.30 * I, [1, 0, 0]);
      }
      acc.flush('add', { gauss: 1 });
      g.bind(env.post.hdr);
      g.draw(pComp, { uTex: mapTex, uDep: depTex, uAir: airTex, uC: c, uC0: P0, uK: S0 / s, uA: mapA, uDepA: 1 });
      const K = (x, y) => [c[0] + x * s, c[1] - y * s];
      dots.begin(); lines.begin();
      // ---- 広い図: 海岸線のあらましと都市
      if (wide > 0.2) {
        const a = smoothstep(0.3, 0.9, wide);
        const pts = new Float32Array(COAST.length * 2); COAST.forEach(([x, y], i) => { const q = K(x, y); pts[i * 2] = q[0]; pts[i * 2 + 1] = q[1]; });
        lines.poly(pts, COAST.length, { w: 2, i: 0.35 * a, col: [0.35, 0.6, 0.9] });
        for (const [name, x, y] of CITIES) { const q = K(x, y), tk = name === '東京' ? smoothstep(T.worst + 5.6, T.worst + 6.6, t) : 0; dots.add(q[0], q[1], 4 + 5 * tk, (1.5 + 3 * tk) * a, tk > 0 ? COL.amber : COL.paper); if (tk > 0) dots.add(q[0], q[1], 30, 0.8 * tk * a, COL.amber); }
        dashed(c[0], c[1], 170 * s, COL.hot, 1.5 * smoothstep(T.worst + 2.4, T.worst + 3.2, t), 2.6, 120);
        dashed(c[0], c[1], 250 * s, COL.amber, 1.4 * smoothstep(T.worst + 2.9, T.worst + 3.7, t), 2.6, 160);
      }
      // ---- 町のあかり（避難した町は暗くなる）
      const townA = (1 - wide);
      if (townA > 0.01) for (const d of townDots) { const q = K(d[0], d[1]), r = Math.hypot(d[0], d[1]); const gone = r < 21 || (d[0] < -15 && d[1] > 18 && d[0] > -34) ? smoothstep(T.evac + 1 + d[2] * 6, T.evac + 3 + d[2] * 6, t) : 0; dots.add(q[0], q[1], 2.0, (0.9 - 0.75 * gone) * townA * smoothstep(T0 + 0.5, T0 + 2.5, t), [1.0, 0.86, 0.62]); }
      // ---- 雨・雪
      const rn = rain(t);
      if (rn.a > 0.01 && wide < 0.5) {
        const rr0 = mulberry32(88);
        for (let k = 0; k < 420; k++) {
          const u = rr0(), vv = rr0(), ph = rr0(), an = u * TAU, rad = Math.sqrt(vv);
          const fall = ((t * 1.3 + ph) % 1);
          const x = rn.x + Math.cos(an) * rad * rn.rx * 1.15 + 1.2 * fall, y = rn.y + Math.sin(an) * rad * rn.ry * 1.15 - 3.0 * fall;
          const q = K(x, y), I = 0.85 * rn.a * (1 - rad * 0.6) * Math.sin(fall * Math.PI);
          lines.seg(q[0], q[1], q[0] - 6, q[1] - 16, 1.6, I, [0.55, 0.78, 1.0]);
        }
      }
      // ---- 同心円（避難の区域）
      if (t > T.evac) [3, 10, 20, 30].forEach((r, i) => { const a = smoothstep(T.evac + 0.3 + i * 0.6, T.evac + 1.1 + i * 0.6, t) * (1 - 0.5 * wide); dashed(c[0], c[1], r * s, r === 20 ? COL.white : COL.ice, (r >= 20 ? 1.1 : 0.7) * a, r >= 20 ? 2.2 : 1.6, r < 10 ? 28 : 64); });
      // ---- 避難する人
      if (wide < 0.9) for (const e of evac) {
        const u = (t - e.t0) / e.d; if (u <= 0 || u >= 1) continue;
        const k = ease.inOutSine(u), mx = lerp(e.a[0], e.b[0], k), my = lerp(e.a[1], e.b[1], k), nx = -(e.b[1] - e.a[1]) * e.bend * Math.sin(k * Math.PI), ny = (e.b[0] - e.a[0]) * e.bend * Math.sin(k * Math.PI);
        const q = K(mx + nx, my + ny); dots.add(q[0], q[1], 2.4, 1.5 * Math.sin(u * Math.PI) * (1 - wide), COL.ice);
      }
      // ---- 原発、風向き、縮尺
      const pl = K(0, 0);
      dots.add(pl[0], pl[1], 5, 3.0, COL.white); dots.add(pl[0], pl[1], 16 + 3 * Math.sin(t * 3), 0.9, COL.hot);
      if (wide < 0.3) {
        const a = (dirAt(t) * Math.PI) / 180, wa = smoothstep(T0 + 0.8, T0 + 1.6, t) * (1 - smoothstep(T.evac - 0.6, T.evac + 0.4, t));
        const ax = 1640, ay = 300, L = 62, ex = ax + Math.cos(a) * L, ey = ay - Math.sin(a) * L;
        lines.circle(ax, ay, 78, { w: 1.4, i: 0.35 * wa, col: COL.paper });
        lines.seg(ax - Math.cos(a) * L, ay + Math.sin(a) * L, ex, ey, 3, 1.2 * wa, COL.ice);
        for (const sg of [-1, 1]) lines.seg(ex, ey, ex - Math.cos(a + sg * 0.5) * 22, ey + Math.sin(a + sg * 0.5) * 22, 3, 1.2 * wa, COL.ice);
        const sb = smoothstep(T0 + 1.2, T0 + 2.0, t) * (1 - wide * 3);
        if (sb > 0) { lines.seg(1560, 1010, 1560 + 20 * S0, 1010, 2, 0.6 * sb, COL.paper); lines.seg(1560, 1003, 1560, 1017, 2, 0.6 * sb, COL.paper); lines.seg(1560 + 20 * S0, 1003, 1560 + 20 * S0, 1017, 2, 0.6 * sb, COL.paper); }
      }
      dots.flush('add', { gauss: 1 });
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 });

      p.bloom = 0.4; p.threshold = 0.85; p.vignette = 0.55; p.ca = 0.005; p.scrim = 0.75;
      p.fade = smoothstep(0, 1.3, tl) * (1 - smoothstep(T_END - 0.7, T_END - 0.05, t));
    },
  };
}
