// closing.js — 8 章「時間」（半減期と、終わらない後始末）、結び、出典の札。
import { T, W, H, COL, DURATION, sat, smoothstep, ease, lerp } from '../core.js';
import { Dots, chap, narr, sub, label, source, inout } from '../kit.js';
import { Lines } from '../../../film/src/lines.js';
import { shared } from '../../../film/src/scenes/shared.js';
import { getPool } from '../pool.js';

const T0 = T.time, TC = T.closing, TE = T.endcard;
const CX = 250, CY = 250, CW = 1300, CH = 440, YEARS = 120;
const gx = (yr) => CX + (yr / YEARS) * CW, gy = (f) => CY + CH - f * CH;
const NUC = [['ヨウ素 131', '半減期 8 日', 8.02 / 365.25, COL.ice], ['セシウム 134', '2 年', 2.06, COL.cyan], ['セシウム 137', '30 年', 30.1, COL.amber]];

export const id = 'closing';
export async function create(env) {
  const { g, ov } = env;
  const dots = new Dots(env, 512), lines = new Lines(g, 4096);
  const bg = shared(env), pool = getPool(env);

  chap(ov, { n: 8, kanji: '時間', en: 'TIME', t0: T0 + 0.3, t1: TC - 0.2, warn: true });
  narr(ov, { text: 'セシウム 137 が半分に減るまで、<em>30 年</em>。', t0: T0 + 0.4, t1: T0 + 5.5 });
  narr(ov, { text: 'チェルノブイリの 30 km 圏は、\n40 年たった今も立ち入りが制限されている。', t0: T0 + 5.8, t1: TC - 0.2 });
  sub(ov, { text: '福島第一の廃炉完了の目標は 2041〜2051 年。溶けた燃料の取り出しは、2025 年までの試験で 1 グラムに満たない', t0: T0 + 6.5, t1: TC - 0.25, y: 986 });
  label(ov, { html: '残っている量', t0: T0 + 0.7, t1: TC - 0.3, x: CX - 6, y: CY - 52, size: 23 });
  [0, 30, 60, 90, 120].forEach((yr, i) => label(ov, { html: `<span class="n">${2011 + yr}</span><small>${yr ? yr + ' 年後' : '事故'}</small>`, t0: T0 + 0.8 + i * 0.25, t1: TC - 0.3, x: gx(yr), y: CY + CH + 14, align: 'c', size: 25 }));
  label(ov, { html: 'ヨウ素 131<small>半減期 8 日</small>', t0: T0 + 1.2, t1: TC - 0.3, x: gx(0) + 26, y: gy(0.93), size: 24 });
  label(ov, { html: 'セシウム 134<small>半減期 2 年</small>', t0: T0 + 1.8, t1: TC - 0.3, x: gx(4.2) + 22, y: gy(0.42), size: 24 });
  label(ov, { html: '<em>セシウム 137</em><small>半減期 30 年</small>', t0: T0 + 2.6, t1: TC - 0.3, x: gx(40) + 6, y: gy(0.60), size: 26 });
  [[30, '半分'], [60, '4 分の 1'], [90, '8 分の 1']].forEach(([yr, txt], i) => label(ov, { html: txt, t0: T0 + 2.6 + (yr / YEARS) * 3.4, t1: TC - 0.3, x: gx(yr) + 16, y: gy(Math.pow(0.5, yr / 30.1)) - 44, size: 25 }));
  source(ov, { text: '半減期: 理科年表ほか／廃炉: 経済産業省・東京電力「中長期ロードマップ」', t0: T0 + 6.6, t1: TC - 0.2 });

  // ---- 結び
  const center = (html, t0, t1, top = 470) => ov.add({ t0, t1, className: 'center', style: { top: (top - 150) + 'px', paddingTop: '150px', paddingBottom: '170px', background: 'radial-gradient(ellipse 900px 300px at 50% 50%, rgba(0,5,16,.82), rgba(0,5,16,.5) 55%, rgba(0,5,16,0) 100%)' }, html, update(el, tl) { el.style.opacity = inout(tl, t1 - t0, 0.9, 0.6).toFixed(4); el.style.transform = `translateY(${((1 - ease.outCubic(sat(tl / 0.9))) * 8).toFixed(2)}px)`; } });
  center('原子の火は、スイッチでは消えない。', TC + 0.4, TC + 3.9);
  center('<span style="color:#a9d8ff">止める。冷やす。閉じ込める。</span><br>——それを、何十年も。', TC + 4.2, TE - 0.1, 424);
  // ---- 出典の札
  const loc = (env.stats && env.stats.loc) ? env.stats.loc.toLocaleString('en-US') : '—';
  ov.add({
    t0: TE, t1: DURATION + 1, className: 'endcard',
    html: `<div class="t">見えない火</div><div class="te">THE INVISIBLE FIRE</div>
<div class="col" style="left:130px"><h4>数字の出典</h4>
国連科学委員会（UNSCEAR）2008 年・2018 年・2020/2021 年報告<br>
WHO・IAEA ほか「チェルノブイリ・フォーラム」（2005〜2006 年）／国際がん研究機関（2006 年）<br>
米国 CDC「急性放射線症」／国際放射線防護委員会（ICRP）2007 年勧告<br>
環境省「放射線による健康影響等に関する統一的な基礎資料」<br>
復興庁「震災関連死の死者数」（2025 年 12 月 31 日現在）／福島県「避難者数の推移」<br>
東京電力「福島第一原子力発電所事故の経過と教訓」／経済産業省「廃炉の中長期ロードマップ」<br>
原子力委員会委員長「不測事態シナリオの素描」（2011 年 3 月 25 日）
<h4 class="gap">おことわり</h4>
図はすべて模式図です。事故の経過は、福島第一原発 1 号機をもとに簡略にしています。<br>
地図の地形は作りものですが、町の方角と距離、汚染がのびた向きは実際にもとづきます。</div>
<div class="col" style="left:1330px"><h4>音</h4>
音楽　“Night Vigil”　Kevin MacLeod<br>
　　　“Hidden Truth”　Rafael Krux<br>
効果音　SFX Kit by Wyzowl<br>
<span class="m">いずれも CC0（パブリックドメイン）</span>
<h4 class="gap">映像</h4>
すべてプログラムで生成（${loc} 行）<br>
<span class="m">WebGL2 / Canvas / KaTeX</span>
<h4 class="gap">制作</h4>
プロンプト　あなた<br>構成・プログラム　Claude</div>`,
    update(el, tl) {
      const kids = [...el.children];
      kids.forEach((c, i) => { const a = ease.outCubic(sat((tl - 0.3 - i * 0.25) / 0.9)); c.style.opacity = (a * (1 - smoothstep(DURATION - TE - 1.0, DURATION - TE - 0.15, tl))).toFixed(4); });
    },
  });

  const timeLayer = {
    id: 'time', t0: T0, t1: TC,
    render(env, tl, t) {
      const p = env.p;
      bg.bg([0.004, 0.009, 0.022], [0.0006, 0.0012, 0.0036], [W / 2, H / 2], 1.0);
      lines.begin(); dots.begin();
      const a = smoothstep(0, 0.9, tl);
      lines.seg(CX, CY + CH, CX + CW + 30, CY + CH, 1.6, 0.45 * a, COL.paper); lines.seg(CX, CY - 12, CX, CY + CH, 1.6, 0.45 * a, COL.paper);
      for (const f of [0.5, 0.25, 0.125]) for (let x = CX; x < CX + CW; x += 18) lines.seg(x, gy(f), x + 7, gy(f), 1.1, 0.16 * a, COL.paper);
      for (const yr of [30, 60, 90, 120]) lines.seg(gx(yr), CY + CH, gx(yr), CY + CH + 10, 1.5, 0.5 * a, COL.paper);
      const prog = ease.inOutSine(sat((tl - 1.0) / 5.0)) * YEARS;
      NUC.forEach(([, , half, col], k) => {
        const n = 240, pts = new Float32Array((n + 1) * 2); let m = 0;
        for (let i = 0; i <= n; i++) { const yr = Math.pow(i / n, k === 0 ? 3 : 1.6) * YEARS; if (yr > prog) break; const f = Math.pow(0.5, yr / half); pts[m * 2] = gx(yr); pts[m * 2 + 1] = gy(f); m++; if (f < 0.0015) break; }
        if (m > 1) { lines.poly(pts, m, { w: k === 2 ? 4.2 : 2.6, i: (k === 2 ? 1.5 : 0.9) * a, col }); dots.add(pts[(m - 1) * 2], pts[(m - 1) * 2 + 1], 6, 2.2 * a, COL.white); }
      });
      for (const yr of [30, 60, 90]) if (prog >= yr) { const f = Math.pow(0.5, yr / 30.1); dots.add(gx(yr), gy(f), 8, 2.6 * a, COL.white); dots.add(gx(yr), gy(f), 26, 0.7 * a, COL.amber); lines.seg(gx(yr), gy(f), gx(yr), CY + CH, 1.2, 0.3 * a, COL.amber); }
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 }); dots.flush('add', { gauss: 1 });
      p.bloom = 0.5; p.threshold = 0.8; p.vignette = 0.58; p.ca = 0.006;
      p.fade = smoothstep(0, 0.9, tl) * (1 - smoothstep(TC - T0 - 0.6, TC - T0 - 0.05, tl));
    },
  };
  const endLayer = {
    id: 'ending', t0: TC, t1: DURATION + 1,
    render(env, tl, t) {
      const p = env.p;
      const glow = smoothstep(0, 3.0, tl) * lerp(0.42, 0.055, smoothstep(TE - 0.8, TE + 1.2, t));
      pool.draw(t * 0.6 + 40, glow, 0.55 + 0.25 * sat(tl / 16), 0);
      p.bloom = 0.6; p.threshold = 0.6; p.knee = 0.6; p.vignette = 0.78; p.ca = 0.012;
      p.fade = smoothstep(0, 1.6, tl) * (1 - smoothstep(DURATION - 1.2, DURATION - 0.1, t));
      p.exposure = 1;
    },
  };
  return [timeLayer, endLayer];
}
