// text.js — 文字: 語り、叫びの文字、計器（線量・気合い・細胞の数字）、結びの札
import { W, H, T, P, Q, SHOUTS, shoutEnv, DURATION, sat, smoothstep as sm, ease, lerp, clamp, hash1, pulse } from '../core.js';
import { narr, fadeEl, inout } from '../../../atom/src/kit.js';
import { inStage } from './act.js';
import { inCells, inDna, hitCount, breakCount } from './inner.js';

const fmt = (v) => Math.floor(v).toLocaleString('en-US');

// 叫びの文字。head の最後の字が t に当たる（その前の字は前打ち）。tail を伸ばし、end で締める
function slam(ov, { t, dur, head, tail = 'ぁ', nTail = 5, tailDur = null, end = 'っ！！', x, y, size, rot = 0, cls = '', vertical = false, pick = [0.52, 0.42, 0.25], rows = null, glitchFrom = null, outlineFrom = 1e9 }) {
  const H_ = [...head], E_ = [...end], chars = [], n0 = H_.length;
  H_.forEach((c, j) => chars.push({ c, at: j === n0 - 1 ? t : t - pick[pick.length - (n0 - 1) + j], fs: size * (j === n0 - 1 ? 1.2 : 1) }));
  const step = (tailDur ?? dur - 0.8) / Math.max(1, nTail);
  for (let k = 0; k < nTail; k++) chars.push({ c: tail, at: t + 0.14 + k * step, fs: size * (0.84 + 0.36 * (k / Math.max(1, nTail - 1))) });
  E_.forEach((c, j) => chars.push({ c, at: t + dur - 0.46 + j * 0.05, fs: size * 1.05 }));
  const t0 = Math.min(...chars.map((c) => c.at)) - 0.02, t1 = t + dur + 0.12;
  const html = chars.map((c, j) => (rows && rows.includes(j) ? '<br>' : '') + `<span class="c${j >= outlineFrom ? ' o' : ''}" style="font-size:${Math.round(c.fs)}px">${c.c}</span>`).join('');
  return ov.add({
    t0, t1, className: 'slam' + (vertical ? ' v' : '') + (cls ? ' ' + cls : ''), html, style: { left: x + 'px', top: y + 'px' },
    setup(el, it) { it.sp = [...el.querySelectorAll('.c')]; },
    update(el, tl, tt, it) {
      const env1 = shoutEnv(tt), fr = Math.round(tt * 30), out = sat((tt - (t + dur - 0.12)) / 0.24);
      el.style.transform = `rotate(${rot}deg) scale(${(1 + 0.1 * out).toFixed(4)})`;
      el.style.opacity = (1 - out).toFixed(4); el.style.filter = out > 0.01 ? `blur(${(out * 10).toFixed(1)}px)` : 'none';
      const gl = glitchFrom != null ? sat((tt - glitchFrom) / 1.2) : 0;
      it.sp.forEach((s, j) => {
        const a = tt - chars[j].at;
        if (a < 0) { s.style.opacity = '0'; return; }
        const pop = 1 + 1.7 * Math.exp(-a / 0.045), amp = 2.5 + 7 * env1 + 10 * gl;
        const jx = (hash1(fr * 1.31 + j * 7.7) - 0.5) * amp, jy = (hash1(fr * 2.17 + j * 3.3) - 0.5) * amp, jr = (hash1(fr * 0.71 + j * 5.1) - 0.5) * (3 + 6 * gl);
        const drop = gl > 0 && hash1(Math.floor(tt * 14) * 3.7 + j * 1.9) < gl * 0.35;
        s.style.opacity = drop ? '0.15' : '1';
        s.style.transform = `translate(${jx.toFixed(1)}px, ${jy.toFixed(1)}px) rotate(${jr.toFixed(2)}deg) scale(${pop.toFixed(3)})`;
      });
    },
  });
}
// 一言を叩きつける（耐える、100 グレイ など）
function stamp(ov, { text, t0, t1, x, y, size, rot = 0, cls = '', vertical = false, center = false, font = null }) {
  const style = { top: y + 'px', fontSize: size + 'px' };
  if (center) { style.left = '0'; style.right = '0'; style.textAlign = 'center'; } else style.left = x + 'px';
  if (font) style.fontFamily = font;
  return ov.add({
    t0, t1, className: 'stamp' + (vertical ? ' v' : '') + (cls ? ' ' + cls : ''), html: text, style,
    update(el, tl, tt) {
      const pop = 1 + 1.5 * Math.exp(-tl / 0.05), out = sat((tl - (t1 - t0 - 0.3)) / 0.3), fr = Math.round(tt * 30), k = Math.exp(-tl / 0.25);
      el.style.opacity = (Math.min(1, tl / 0.03) * (1 - out)).toFixed(4);
      el.style.transform = `translate(${((hash1(fr * 1.3) - 0.5) * 16 * k).toFixed(1)}px, ${((hash1(fr * 2.1) - 0.5) * 16 * k).toFixed(1)}px) rotate(${rot}deg) scale(${(pop + 0.06 * out).toFixed(3)})`;
      el.style.filter = out > 0.01 ? `blur(${(out * 8).toFixed(1)}px)` : 'none';
    },
  });
}

export const id = 'text';
export async function create(env) {
  const { ov } = env;
  const N = (text, t0, t1, cls = '') => narr(ov, { text, t0, t1, cls });

  // ---- 語り
  N('ある施設の、深夜の点検。', 1.0, 4.4); N('いつもどおりの、作業だった。', 4.7, 7.7);
  N('——突然の、<b>青い閃光</b>。', 8.7, 11.0); N('浴びた放射線は、<b>10 グレイ</b>。', 11.3, 13.8);
  N('<b>中性子</b>が、身体を貫く。', 14.4, 17.7); N('細胞のひとつひとつを、撃ち抜いていく。', 18.0, 21.8);
  N('このままでは——細胞も、遺伝子も、\n<i>ボコボコに破壊されてしまう。</i>', 22.3, 25.85);
  N('……ならば。', 26.4, 28.2); N('<em>気合い</em>で、耐える。', 28.45, 29.95);
  N('気合いが、遺伝子の結合を<em>固く</em>する。', 34.4, 37.7); N('中性子が、飛んでくる。', 39.8, 41.8); N('結合は、切れない。', 43.8, 45.8);
  N('<i>傷つく。</i>', 46.3, 48.0); N('——それでも、<em>耐える</em>。', 48.2, 49.9);
  N('細胞も、持ちこたえる。', 54.3, 57.75);
  N('……耐えきった、か。', 58.5, 61.5);
  N('さらに——その <i>10 倍</i>。', 62.7, 64.9); N('全身から、血が噴き出す。', 65.1, 66.9);
  N('大量の、<i>吐血</i>。', 67.3, 69.0); N('脳にも、<i>出血</i>。', 69.2, 70.9);
  N('細胞が、砕け散る。', 71.3, 73.05); N('遺伝子が、ちぎれる。', 73.4, 75.2);
  N('……まだだ。', 75.75, 76.95);
  N('<u>魂</u>が、細胞の形を呼び起こす。', 85.5, 88.7); N('ばらばらの欠片を、<u>魂の力</u>で引き寄せる。', 89.5, 92.75);
  N('ちぎれた遺伝子を、つなぎ直す。', 93.5, 96.75); N('壊される。直す。——壊される。直す。', 97.5, 100.75);
  N('血が噴き出しても。', 101.5, 103.6); N('吐いたものが、<i>弾丸</i>のように飛び出しても。', 103.9, 106.5); N('とにかく、<em>気合い</em>で、耐える。', 106.8, 108.9);
  N('誰かが、止めなければならない。', 109.4, 112.4); N('一歩。——また、一歩。', 112.7, 116.2);
  N('——止まった。', 126.0, 129.1);
  N('夜が、明けた。', 131.0, 133.6); N('男は、立っていた。', 133.9, 137.2);

  // ---- 叫び
  slam(ov, { t: T.kiai1, dur: 3.7, head: 'う', tail: 'お', nTail: 7, end: 'っ！！', x: 270, y: 222, size: 150, rot: -3, pick: [] });
  slam(ov, { t: T.kiai1b, dur: 3.5, head: 'う', tail: 'お', nTail: 4, end: 'っ！', x: 1540, y: 250, size: 122, vertical: true, pick: [] });
  const K = '気合いだ';
  slam(ov, { t: Q(0), dur: 3.3, head: K, nTail: 4, end: 'っ！！', x: 90, y: 800, size: 158, rot: -3, cls: 'soul' });
  slam(ov, { t: Q(1), dur: 3.3, head: K, nTail: 4, end: 'っ！！', x: 130, y: 770, size: 162, rot: 2.5, cls: 'soul' });
  for (let i = 2; i < 6; i++) slam(ov, { t: Q(i), dur: 3.3, head: K, nTail: 2, end: 'っ！', x: i % 2 ? 60 : 1740, y: 250, size: 100, vertical: true, cls: 'soul' });
  slam(ov, { t: Q(6), dur: 3.3, head: K, nTail: 4, end: 'っ！！', x: 400, y: 215, size: 150, rot: -2, cls: 'soul' });
  slam(ov, { t: Q(7), dur: 3.3, head: K, nTail: 4, end: 'っ！！', x: 330, y: 225, size: 156, rot: 3, cls: 'soul' });
  slam(ov, { t: Q(8), dur: 3.3, head: K, nTail: 4, end: 'っ！！', x: 380, y: 215, size: 150, rot: -3, cls: 'soul' });
  slam(ov, { t: Q(9), dur: 3.4, head: K, nTail: 4, end: 'っ！！', x: 300, y: 225, size: 160, rot: 4, cls: 'soul' });
  slam(ov, { t: Q(10), dur: 7.95, head: K, nTail: 5, tailDur: 2.3, end: '', x: 80, y: 46, size: 170, rot: -1.5, cls: 'soul', glitchFrom: T.spk, outlineFrom: 4 });
  slam(ov, { t: Q(10) + 2.7, dur: 5.25, head: 'ぁ', pick: [], nTail: 6, tailDur: 3.3, end: 'っ！！！', x: 60, y: 820, size: 150, rot: 1.5, cls: 'soul', glitchFrom: T.spk, outlineFrom: 0 });

  // ---- 叩きつける一言
  stamp(ov, { text: '耐える', t0: P(7), t1: P(7) + 1.7, x: 1560, y: 120, size: 210, vertical: true });
  stamp(ov, { text: '耐える', t0: P(8), t1: P(8) + 1.7, x: 150, y: 90, size: 250, vertical: true });
  stamp(ov, { text: '100<span style="font-size:.5em">グレイ</span>', t0: 62.45, t1: 64.5, y: 250, size: 300, center: true, cls: 'red', font: "'Dela Gothic One'" });
  stamp(ov, { text: '脳出血', t0: 69.3, t1: 70.9, x: 178, y: 208, size: 84, cls: 'red' });

  // ---- 線量計（右上。舞台の場面だけ）
  const doseV = (t) => (t < 10.6 ? 10 * ease.outCubic(sat((t - 8.5) / 2.1)) : t < 62 ? 10 : t < 62.6 ? lerp(10, 100, ease.outCubic((t - 62) / 0.6)) : t < T.walk ? 100 : t < T.spk ? lerp(100, 640, ((t - T.walk) / 12) ** 1.6) : lerp(640, 999, sat((t - T.spk) / 3.6)));
  ov.add({
    t0: 8.5, t1: 129.2, className: 'dose', html: '<div class="cap">被曝線量</div><div class="num"><span class="v">0.0</span><span class="u">Gy</span></div><div class="bar"><i></i></div><div class="note"></div>',
    setup(el, it) { it.v = el.querySelector('.v'); it.b = el.querySelector('.bar i'); it.n = el.querySelector('.note'); },
    update(el, tl, t, it) {
      const on = inStage(t) && !(t >= T.last - 0.4 && t < T.stop + 0.35);
      el.style.opacity = (on ? Math.min(1, sat(tl / 0.4), 1 - sm(128.4, 129.1, t)) : 0).toFixed(3);
      if (!on) return;
      const v = doseV(t), txt = t >= T.stop ? '999+' : v < 100 ? v.toFixed(1) : fmt(v);
      if (it.last !== txt) { it.v.textContent = txt; it.last = txt; }
      it.b.style.transform = `scaleX(${sat(Math.log10(1 + v) / 3).toFixed(4)})`;
      el.classList.toggle('hot', t >= 62);
      const note = t < 11.2 ? '' : t < 62 ? '全身に浴びれば、ほぼ助からない量' : t < T.walk ? '致死量の、はるか上' : t < T.stop ? '近づくほど、強くなる' : '';
      if (it.note !== note) { it.n.textContent = note; it.note = note; }
      const k = 1 + 0.25 * pulse(t, 62, 0.25) + 0.12 * pulse(t, 8.5, 0.2);
      el.style.transform = `scale(${k.toFixed(3)})`; el.style.transformOrigin = '100% 0';
    },
  });
  // ---- 気合いの計器（左上）
  const kiaiV = (t) => {
    if (t < T.flash2) return 100 + 20 * sm(50, 50.4, t);
    if (t < 76.95) return Math.max(0, 120 * (1 - sat((t - 62) / 0.25)));
    if (t < T.last) { const i = Math.max(0, Math.floor((t - Q(0)) / 4)); return 1000 * (i + 1) * ease.outCubic(sat((t - Q(i)) / 0.3)) + 1000 * i * (1 - ease.outCubic(sat((t - Q(i)) / 0.3))); }
    return 11000 * Math.pow(9, sat((t - T.last) / 7.6) ** 1.5);
  };
  ov.add({
    t0: 30.05, t1: 128.4, className: 'kiai', html: '<div class="cap">気合い</div><div class="num"><span class="v">100</span><span class="u">%</span></div><div class="bar"><i></i></div>',
    setup(el, it) { it.v = el.querySelector('.v'); it.b = el.querySelector('.bar i'); },
    update(el, tl, t, it) {
      const on = inStage(t) && !(t >= T.last - 0.4 && t < T.stop + 0.35);
      el.style.opacity = (on ? Math.min(1, sat(tl / 0.3), 1 - sm(127.4, 128.3, t)) : 0).toFixed(3);
      if (!on) return;
      const v = kiaiV(t), txt = t >= 124.4 ? '∞' : fmt(v);
      if (it.last !== txt) { it.v.textContent = txt; it.last = txt; }
      it.b.style.transform = `scaleX(${(t < 76.95 ? v / 120 : Math.min(2.3, 1 + Math.log10(v / 1000 + 1) * 1.1)).toFixed(4)})`;
      el.classList.toggle('soul', t >= 76.95);
      const k = 1 + 0.3 * Math.max(pulse(t, 30.05, 0.2), pulse(t, 50, 0.2), pulse(t, 76.95, 0.25), ...SHOUTS.map((q) => 0.6 * pulse(t, q, 0.15)));
      el.style.transform = `scale(${k.toFixed(3)})`; el.style.transformOrigin = '0 0';
    },
  });
  // ---- 身体の中の数字（左上）
  ov.add({
    t0: T.inside + 0.3, t1: T.bullets, className: 'cnt', html: '<div class="row"><span class="k"></span><span class="v"></span></div><div class="row"><span class="k"></span><span class="v"></span></div>',
    setup(el, it) { it.k = [...el.querySelectorAll('.k')]; it.v = [...el.querySelectorAll('.v')]; },
    update(el, tl, t, it) {
      const on = inCells(t) || inDna(t);
      el.style.opacity = on ? '1' : '0'; if (!on) return;
      let rows;
      if (t < T.flash2 + 9.5 && t < 73.6) {
        const br = breakCount(t);
        rows = [['被弾', fmt(hitCount(t)), 'b'], t < 22.4 ? ['', '', ''] : t < T.shatter ? ['切断', fmt(br), br > 0 ? 'r' : 'g'] : ['切断', fmt(2.2e4 * (t - T.shatter) ** 4 + 13), 'r']];
      } else if (t < T.dark) rows = [['被弾', fmt(hitCount(t)), 'b'], ['切断', '計測不能', 'r']];
      else if (t < T.tug) rows = [['修復', fmt(4.1e6 * Math.max(0, t - 86.2) ** 2.1), 's'], ['', '', '']];
      else { const a = 6.1e8 + 9.3e7 * (t - T.tug) ** 1.2; rows = [['破壊', fmt(a + 3.1e6 * Math.sin(t * 5.1)), 'r'], ['修復', fmt(a + 3.1e6 * Math.sin(t * 5.1 + 2.4) + 1), 's']]; }
      rows.forEach(([k, v, c], i) => { if (it['k' + i] !== k) { it.k[i].textContent = k; it['k' + i] = k; } it.v[i].textContent = v; it.v[i].className = 'v ' + c; });
    },
  });

  // ---- スピーカーの限界
  ov.add({ t0: T.spk + 0.9, t1: T.stop, className: 'notice', style: { top: '706px' }, html: '<span>※ 絶叫が、スピーカーの限界を超えました</span>', update(el, tl, t) { el.style.opacity = (Math.floor(t * 3) % 2 ? 1 : 0.35).toFixed(2); } });

  // ---- 後日談・題・おことわり
  const card = (html, t0, t1, top) => ov.add({ t0, t1, className: 'card', style: { top: top + 'px' }, html, update(el, tl) { el.style.opacity = inout(tl, t1 - t0, 0.7, 0.5).toFixed(4); el.style.transform = `translateY(${((1 - ease.outCubic(sat(tl / 0.7))) * 10).toFixed(2)}px)`; } });
  card('次の日も、彼はふつうに出勤した。', 137.9, 140.5, 830);
  card('ただ、声だけは——三日、出なかった。', 140.8, 143.5, 830);
  const loc = (env.stats && env.stats.loc) ? env.stats.loc.toLocaleString('en-US') : '—';
  ov.add({
    t0: T.title, t1: DURATION + 1, className: 'title', html: '<div class="t">気合い</div><div class="te">KIAI</div>',
    update(el, tl, t) {
      const a = sat((tl - 0.25) / 0.04), pop = 1 + 1.4 * Math.exp(-Math.max(0, tl - 0.25) / 0.06), out = 1 - sm(DURATION - 1.1, DURATION - 0.2, t);
      el.style.opacity = (a * out).toFixed(4); el.children[0].style.transform = `scale(${pop.toFixed(3)})`;
      el.children[1].style.opacity = sat((tl - 0.9) / 0.6).toFixed(3);
    },
  });
  fadeEl(ov, { t0: T.title + 1.5, t1: DURATION, className: 'disc', fin: 0.8, fout: 0.9, dy: 6,
    html: '※ この物語はフィクションです。現実の放射線は、<b>気合いでは防げません。</b><br>10 グレイを全身に浴びれば、いまの医療でも、ほぼ助かりません。' });
  fadeEl(ov, { t0: T.title + 2.6, t1: DURATION, className: 'credit', fin: 0.8, fout: 0.9, dy: 4,
    html: `音楽　“Rulers of Our Lands”　Rafael Krux（CC0）　／　効果音　SFX Kit by Wyzowl（CC0）ほか<br>声　合成音声 Open JTalk ＋ HTS voice “NIT ATR503 M001”（名古屋工業大学, CC BY 3.0）を加工<br>映像　すべてプログラムで生成（${loc} 行）　／　プロンプト　あなた　／　構成・プログラム　Claude` });
  return [];
}
