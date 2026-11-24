// people.js — 7 章「人々」。構内で大量に被ばくした人たち、そして周辺の住民に起きたこと:
// 甲状腺がん、避難による死、心と暮らし、将来のがんと次の世代。数字はすべて公表されている統計（出典は画面の左下と、終わりの札）。
import { T, W, H, COL, sat, smoothstep, ease, lerp, clamp, mulberry32, TAU, fract } from '../core.js';
import { Layer2D, Dots, chap, narr, sub, label, big, source, fadeEl, inout } from '../kit.js';
import { Lines } from '../../../film/src/lines.js';
import { shared } from '../../../film/src/scenes/shared.js';
import { bodyPath } from './body.js';

const P1 = T.people, P2 = T.resident, P3 = T.thyroid, P4 = T.evacDeath, P5 = T.mind, P5b = 330.9, P6 = T.cancer, PEND = T.time;

export const id = 'people';
export async function create(env) {
  const { g, ov } = env;
  const dots = new Dots(env, 8192), halo = new Dots(env, 4096), lines = new Lines(g, 2048), glow = new Layer2D(env), base = new Layer2D(env);
  const bg = shared(env);
  const rng = mulberry32(2350);

  // ---- 急性放射線症の 134 人（1 点 = 1 人）
  const GX = 236, GY = 318, GS = 47;
  const ars = Array.from({ length: 134 }, (_, i) => ({ x: GX + (i % 14) * GS, y: GY + Math.floor(i / 14) * GS, r: rng(), dead: false }));
  [...ars].sort((a, b) => a.r - b.r).slice(0, 28).forEach((d) => (d.dead = true));
  // ---- 町のあかり（2,350 点。通りに沿って家が並ぶように）
  const lights = [];
  const blocks = Array.from({ length: 34 }, () => ({ x: rng.range(170, 1750), y: rng.range(190, 790), a: rng.range(-0.5, 0.5), w: rng.range(90, 260), h: rng.range(50, 150), n: 0 }));
  while (lights.length < 2350) {
    const b = blocks[Math.floor(Math.pow(rng(), 1.3) * blocks.length)];
    const u = Math.round(rng.range(-0.5, 0.5) * b.w / 15) * 15 + rng.range(-2, 2), v = Math.round(rng.range(-0.5, 0.5) * b.h / 17) * 17 + rng.range(-2, 2);
    const x = b.x + u * Math.cos(b.a) - v * Math.sin(b.a), y = b.y + u * Math.sin(b.a) + v * Math.cos(b.a);
    if (x < 110 || x > 1810 || y < 170 || y > 815) continue;
    lights.push({ x, y, s: rng.range(0.6, 1.25), ord: rng(), tw: rng() * TAU, warm: rng() });
  }
  // ---- 避難者（1 点 = 100 人。1,649 点）
  const EV_N = 1649, EV_C = 97, evS = 15.5, evX = (W - (EV_C - 1) * evS) / 2, evY = 338;
  const evac = Array.from({ length: EV_N }, (_, i) => ({ x: evX + (i % EV_C) * evS, y: evY + Math.floor(i / EV_C) * evS, ord: rng() }));
  const stay = new Set([...evac].sort((a, b) => a.ord - b.ord).slice(0, 226));

  // ---- 文字
  chap(ov, { n: 7, kanji: '人々', en: 'THE PEOPLE', t0: P1 + 0.3, t1: PEND - 0.2, warn: true });
  // P1
  narr(ov, { text: 'これほどの量を浴びたのは、構内の運転員と消防士だった。', t0: P1 + 0.3, t1: P2 - 0.2 });
  label(ov, { html: '<span style="letter-spacing:.16em;color:rgba(238,241,244,.7)">史上最悪の原発事故　チェルノブイリ（1986 年）</span>', t0: P1 + 0.5, t1: P2 - 0.25, x: 1012, y: 300, size: 25 });
  big(ov, { cap: '急性放射線症（0.8〜16 グレイ）', value: 134, unit: '人', t0: P1 + 0.7, t1: P2 - 0.25, x: 1010, y: 356, count: 1.2, size: 104 });
  big(ov, { cap: 'うち、数か月以内に死亡', value: 28, unit: '人', t0: P1 + 2.5, t1: P2 - 0.25, x: 1010, y: 560, count: 1.2, cls: 'red', size: 104 });
  label(ov, { html: '<i>爆発で 2 人</i>', t0: P1 + 1.2, t1: P2 - 0.25, x: GX + 2 * GS + 6, y: GY - 86, size: 24 });
  source(ov, { text: '国連科学委員会（UNSCEAR）／チェルノブイリ・フォーラム', t0: P1 + 1.0, t1: P2 - 0.2 });
  // P2
  narr(ov, { text: '周辺の住民に、急性の放射線障害は確認されていない。\n害は、別のかたちで来た。', t0: P2 + 0.25, t1: P3 - 0.2 });
  // P3: 甲状腺
  narr(ov, { text: '放射性ヨウ素は、牧草から牛乳へ、そして子どもの<em>甲状腺</em>へ。', t0: P3 + 0.3, t1: P3 + 5.6 });
  narr(ov, { text: 'チェルノブイリでは、数千人の子どもが甲状腺がんになった。', t0: P3 + 5.9, t1: P4 - 0.2 });
  const CH = [['ヨウ素 131', 250], ['牧草', 540], ['牛', 780], ['牛乳', 1020]], CHY = 300;
  CH.forEach(([txt, x], i) => fadeEl(ov, { html: txt, className: 'lbl c', style: { left: x + 'px', top: (CHY - 30) + 'px', padding: '10px 26px', border: '1.5px solid rgba(255,182,72,.75)', borderRadius: '999px', background: 'rgba(8,10,16,.75)', fontSize: '29px' }, t0: P3 + 0.4 + i * 0.45, t1: P4 - 0.3, dy: 0 }));
  label(ov, { html: '子どもの<em>甲状腺</em>に集まる', t0: P3 + 2.4, t1: P4 - 0.3, x: 1420, y: 622, align: 'c', size: 27 });
  big(ov, { cap: '事故当時 18 歳未満だった人の甲状腺がん（1991〜2015 年）', value: 20000, unit: '例', note: 'そのおよそ 4 分の 1 が、被ばくによると推定されている', t0: P3 + 3.4, t1: P4 - 0.3, x: 236, y: 560, count: 1.6, fmt: (v) => '約 ' + (Math.round(v / 100) * 100).toLocaleString('en-US'), cls: 'amber', size: 104 });
  source(ov, { text: 'UNSCEAR 2018 年白書（ベラルーシ・ウクライナ・ロシアの一部）／福島: 被ばくによる増加は確認されていない（UNSCEAR 2020/2021 年報告）', t0: P3 + 3.6, t1: P4 - 0.25 });
  // P4: 避難による死
  narr(ov, { text: '避難そのものも、命を奪った。', t0: P4 + 0.3, t1: P4 + 4.9 });
  narr(ov, { text: '長引く避難生活の中で、亡くなっていった人たち。', t0: P4 + 5.2, t1: P5 - 0.2 });
  sub(ov, { text: '原発に近い病院では、避難の途中や直後に、数十人の患者が亡くなった', t0: P4 + 5.9, t1: P5 - 0.25, y: 962 });
  ov.add({
    t0: P4 + 0.8, t1: P5 - 0.25, className: 'big r red', style: { right: '110px', top: '170px', background: 'radial-gradient(ellipse at 70% 50%, rgba(2,4,8,.86), rgba(2,4,8,.6) 60%, rgba(2,4,8,0) 100%)', padding: '14px 10px 18px 90px' },
    html: '<div class="cap">福島県の震災関連死</div><div class="num"><span class="v"></span><span class="u">人</span></div>',
    setup(el, it) { it.v = el.querySelector('.v'); },
    update(el, tl, t, it) {
      const a = ease.outCubic(sat(tl / 0.7)); el.style.opacity = Math.min(a, 1 - smoothstep(P5 - 0.25 - P4 - 0.8 - 0.5, P5 - 0.25 - P4 - 0.8, tl)).toFixed(4);
      const n = Math.round(2350 * smoothstep(P4 + 1.6, P4 + 10.6, t)); const txt = n.toLocaleString('en-US'); if (it.last !== txt) { it.v.textContent = txt; it.last = txt; }
    },
  });
  source(ov, { text: '復興庁「東日本大震災における震災関連死の死者数」（2025 年 12 月 31 日現在。地震・津波による避難をふくむ県の合計）', t0: P4 + 1.2, t1: P5 - 0.2 });
  // P5: 心と暮らし
  ov.add({
    t0: P5 + 0.4, t1: P5b - 0.1, className: 'quote', style: { top: '330px' },
    html: '<div class="q">「心の健康への影響こそ、<br>事故がもたらした<em style="color:var(--amber)">最大の公衆衛生問題</em>である」</div><div class="by">世界保健機関（WHO）　チェルノブイリ事故についての報告（2006 年）</div>',
    update(el, tl) { const dur = P5b - 0.1 - P5 - 0.4; el.style.opacity = inout(tl, dur, 0.9, 0.5).toFixed(4); el.style.transform = `translateY(${((1 - ease.outCubic(sat(tl / 0.9))) * 10).toFixed(2)}px)`; },
  });
  sub(ov, { text: '不安・うつ・PTSD　／　偏見と差別　／　引き裂かれた家族と地域　／　失われた仕事と故郷', t0: P5 + 1.8, t1: P5b - 0.15, y: 640, style: { fontSize: '29px', color: 'rgba(238,241,244,.86)' } });
  narr(ov, { text: '見えない不安は、線量の低い場所にも長く残った。', t0: P5 + 0.6, t1: P5b - 0.2 });
  narr(ov, { text: '15 年たった今も、2 万人以上が避難を続けている。', t0: P5b + 0.3, t1: P6 - 0.2 });
  big(ov, { cap: '福島県の避難者　2012 年 5 月（最大）', value: 164865, unit: '人', t0: P5b + 0.2, t1: P6 - 0.25, x: 236, y: 150, count: 1.2, size: 76 });
  big(ov, { cap: '2026 年 5 月', value: 22625, unit: '人', t0: P5b + 3.0, t1: P6 - 0.25, x: 1684, y: 150, align: 'r', count: 1.2, size: 76, cls: 'amber' });
  label(ov, { html: '<small>1 点 = 100 人</small>', t0: P5b + 0.8, t1: P6 - 0.3, x: evX, y: evY + 17 * evS + 14 });
  source(ov, { text: '福島県「避難者数の推移」', t0: P5b + 0.6, t1: P6 - 0.2 });
  // P6: 将来のがんと、次の世代
  const ROWS = [
    ['blue', '将来のがん — チェルノブイリ', '死者の推計は <span class="n">4,000</span> 人から <span class="n">1</span> 万 <span class="n">6</span> 千人', 'もっとも被ばくした人々について（国連のチェルノブイリ・フォーラム）〜 欧州全体について（国際がん研究機関）。推計の方法で大きく変わる'],
    ['blue', '将来のがん — 福島', '被ばくによる増加は、統計では見分けられない見通し', '国連科学委員会（UNSCEAR）2020/2021 年報告'],
    ['blue', '次の世代', '遺伝的な影響は、人では確認されていない', '原爆被爆者の子どもたちの追跡調査など'],
  ];
  ov.add({
    t0: P6 + 0.2, t1: PEND - 0.15, className: 'rows', style: { left: '236px', top: '250px' },
    html: ROWS.map(([c, h, t, d]) => `<div class="row ${c}" style="margin-bottom:44px"><div class="h">${h}</div><div class="t">${t}</div><div class="d">${d}</div></div>`).join(''),
    update(el, tl) {
      const dur = PEND - 0.15 - P6 - 0.2, out = 1 - smoothstep(dur - 0.5, dur, tl);
      [...el.children].forEach((r, i) => { const a = ease.outCubic(sat((tl - 0.2 - i * 2.6) / 0.7)); r.style.opacity = (a * out).toFixed(4); r.style.transform = `translateY(${((1 - a) * 14).toFixed(2)}px)`; });
    },
  });
  source(ov, { text: 'WHO／国際がん研究機関（IARC）／UNSCEAR／環境省・放射線影響研究所', t0: P6 + 1.0, t1: PEND - 0.2 });

  return {
    id: 'people', t0: P1, t1: PEND,
    render(env, tl, t) {
      const p = env.p;
      bg.bg([0.004, 0.009, 0.022], [0.0006, 0.0012, 0.0036], [W / 2, H / 2], 1.0);
      dots.begin(); halo.begin(); lines.begin();
      // ================= P1: 134 人
      if (t < P2 + 0.6) {
        const out = 1 - smoothstep(P2 - 0.4, P2 + 0.5, t);
        for (const d of ars) {
          const a = ease.outCubic(sat((t - P1 - 0.5 - d.r * 0.9) / 0.5)) * out;
          const k = d.dead ? smoothstep(P1 + 2.6 + d.r * 4, P1 + 3.4 + d.r * 4, t) : 0;
          const col = [lerp(0.75, 1.0, k), lerp(0.86, 0.12, k), lerp(1.0, 0.05, k)];
          dots.add(d.x, d.y, 8.5, a * lerp(1.5, 0.75, k), col);
          if (k > 0 && k < 1) halo.add(d.x, d.y, 26, 1.4 * a * Math.sin(k * Math.PI), COL.hot);
        }
        for (let i = 0; i < 2; i++) { const a = ease.outCubic(sat((t - P1 - 1.0 - i * 0.2) / 0.5)) * out; dots.add(GX + i * GS, GY - 68, 8.5, 1.4 * a, [1.0, 0.12, 0.05]); halo.add(GX + i * GS, GY - 68, 24, 0.5 * a, COL.hot); }
      }
      // ================= 町のあかり（P2 で灯り、P4 で消えていく）
      if (t > P2 - 0.2 && t < P5 + 2.2) {
        const on = smoothstep(P2, P2 + 2.4, t), thy = smoothstep(P3 - 0.3, P3 + 0.9, t) * (1 - smoothstep(P4 - 0.8, P4 + 0.4, t)) * 1.14;
        const tail = 1 - smoothstep(P5 + 0.2, P5 + 2.0, t);
        for (const L of lights) {
          const offT = P4 + 1.6 + L.ord * 9.0, k = smoothstep(offT, offT + 0.9, t);
          const a0 = ease.outCubic(sat((on * 1.6 - L.ord * 0.6))) * (1 - 0.82 * thy);
          const tw = 0.85 + 0.15 * Math.sin(t * 2.2 + L.tw);
          const I = a0 * tw * lerp(1.15, 0.10, k) * tail;
          if (I > 0.01) dots.add(L.x, L.y, 2.3 * L.s, I, [1.0, lerp(0.80, 0.90, L.warm) * lerp(1, 0.45, k), lerp(0.52, 0.70, L.warm) * lerp(1, 0.3, k)]);
          if (k > 0 && k < 1) halo.add(L.x, L.y, 6, 0.22 * Math.sin(k * Math.PI) * tail, COL.white);
        }
      }
      // ================= P3: ヨウ素の道すじ
      if (t > P3 && t < P4 + 0.2) {
        const a = smoothstep(P3 + 0.2, P3 + 1.0, t) * (1 - smoothstep(P4 - 0.6, P4, t));
        const X = [...CH.map((c) => c[1]), 1340];
        for (let i = 0; i < X.length - 1; i++) {
          const x0 = X[i] + (i === 0 ? 108 : i === 1 ? 62 : i === 2 ? 46 : 62), x1 = X[i + 1] - (i === 0 ? 62 : i === 1 ? 46 : i === 2 ? 62 : 70), ai = a * smoothstep(P3 + 0.7 + i * 0.45, P3 + 1.2 + i * 0.45, t);
          lines.seg(x0, CHY, x1, CHY, 2, 0.7 * ai, COL.amber);
          lines.seg(x1, CHY, x1 - 13, CHY - 9, 2, 0.7 * ai, COL.amber); lines.seg(x1, CHY, x1 - 13, CHY + 9, 2, 0.7 * ai, COL.amber);
          for (let k = 0; k < 3; k++) { const u = fract(t * 0.55 + k / 3 + i * 0.17); dots.add(lerp(x0, x1, u), CHY, 4, 2.0 * ai * Math.sin(u * Math.PI), COL.iodine); }
        }
        // 子どもの姿と、甲状腺
        const c2 = glow.begin(), b2 = base.begin();
        const sc = 0.5, cx = 1420, oy = 150;
        for (const c of [b2, c2]) { c.setTransform(sc, 0, 0, sc, cx * (1 - sc), oy); }
        bodyPath(b2, cx); b2.fillStyle = `rgba(16,30,54,${(0.9 * a).toFixed(4)})`; b2.fill();
        bodyPath(c2, cx); c2.strokeStyle = `rgba(160,205,250,${(0.85 * a).toFixed(4)})`; c2.lineWidth = 4; c2.stroke();
        const pulse = 0.7 + 0.3 * Math.sin(t * 4), ta = a * smoothstep(P3 + 2.2, P3 + 3.2, t);
        c2.fillStyle = `rgba(255,170,60,${(0.95 * ta * pulse).toFixed(4)})`; c2.beginPath(); c2.ellipse(cx - 13, 268, 11, 15, 0.25, 0, TAU); c2.ellipse(cx + 13, 268, 11, 15, -0.25, 0, TAU); c2.fill();
        for (const c of [b2, c2]) c.setTransform(1, 0, 0, 1, 0, 0);
        base.flush('alpha', 1, 1); glow.flush('add', 1.4, 1);
        const tq = [cx, oy + 268 * sc]; halo.add(tq[0], tq[1], 46, 0.9 * ta * pulse, COL.amber);
      }
      // ================= P5b: 避難者（1 点 = 100 人）
      if (t > P5b - 0.3 && t < P6 + 0.4) {
        const a = smoothstep(P5b, P5b + 1.2, t) * (1 - smoothstep(P6 - 0.5, P6 + 0.3, t));
        for (const e of evac) {
          const home = stay.has(e) ? 0 : smoothstep(P5b + 2.6 + e.ord * 2.6, P5b + 3.4 + e.ord * 2.6, t);
          dots.add(e.x, e.y, 3.6, a * lerp(1.25, 0.14, home) * ease.outCubic(sat((t - P5b - e.ord * 0.8) / 0.5)), stay.has(e) ? lerp3(COL.ice, COL.amber, smoothstep(P5b + 4.5, P5b + 5.6, t)) : COL.ice);
        }
      }
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 });
      dots.flush('add', { soft: 1.2, gauss: 0 }); halo.flush('add', { gauss: 1 });

      p.bloom = 0.55; p.threshold = 0.75; p.vignette = 0.6; p.ca = 0.006;
      p.scrim = t > P2 && t < P5 ? 0.8 : 0;
      p.fade = smoothstep(0, 0.9, tl) * (1 - smoothstep(PEND - 0.6, PEND - 0.05, t));
    },
  };
}
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
