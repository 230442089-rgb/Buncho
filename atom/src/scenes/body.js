// body.js — 6 章「身体」。放射線が細胞の DNA を切る様子と、「どれだけ浴びると何が起きるか」の梯子（即死から、ふだんの自然放射線まで）。
// 線量と症状の対応は、米国 CDC の急性放射線症の区分、ICRP、環境省の基礎資料による。
import { T, TIER, W, H, COL, sat, smoothstep, ease, lerp, clamp, mulberry32, TAU } from '../core.js';
import { Layer2D, Spheres, Dots, camera, chap, narr, sub, label, source, fadeEl, inout } from '../kit.js';
import { Lines } from '../../../film/src/lines.js';
import { shared } from '../../../film/src/scenes/shared.js';

// ------------------------------------------------------------ DNA
const NBP = 58, PITCH = 3.4, PER = 10.5, RAD = 1.0, GROOVE = 2.35;      // 塩基対の数、1 巻きの長さ、1 巻きの塩基対、半径、2 本の鎖の位相差
const T_SSB = 234.2, T_FIX = 236.3, T_DSB1 = 240.3, T_DSB2 = 242.3;
const BP_SSB = 24, BP_D1 = 35, BP_D2 = 19;
const TRACKS = [[T_SSB, BP_SSB, 1.15, 0.45], [239.6, 40, -0.9, -0.3], [T_DSB1, BP_D1, 1.3, 0.1], [240.9, 28, 0.7, -0.6], [241.5, 39, -1.2, 0.5], [T_DSB2, BP_D2, 1.0, -0.2], [242.9, 17, -0.8, 0.6], [243.6, 31, 1.4, 0.3]];

// ------------------------------------------------------------ 人のかたち（正面。cx を中心に左右対称）
const HALF = [[0, 158], [26, 163], [41, 203], [37, 240], [25, 257], [25, 275], [68, 288], [113, 298], [126, 332], [133, 420], [138, 500], [142, 572], [146, 612], [130, 632], [113, 614], [110, 560], [102, 480], [94, 356], [91, 402], [82, 470], [93, 540], [97, 602], [82, 722], [80, 792], [63, 872], [74, 902], [30, 906], [35, 872], [31, 722], [7, 598], [0, 594]];
export function bodyPath(c, cx) {
  const pts = [...HALF.map(([x, y]) => [cx + x, y]), ...HALF.slice(1, -1).reverse().map(([x, y]) => [cx - x, y])];
  const n = pts.length; c.beginPath();
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; if (i === 0) c.moveTo(mx, my); else c.quadraticCurveTo(a[0], a[1], mx, my); }
  const a = pts[0], b = pts[1]; c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); c.closePath();
}
const CXB = 560;                                  // 人の中心の x
const AX = 176, Y1MSV = 902, DEC = 146;          // 目盛りの軸、1 mSv の高さ、1 桁の長さ
const doseY = (sv) => Y1MSV - (Math.log10(sv) + 3) * DEC;

const TIERS = [
  { dose: '<span class="jp">爆発・火災</span>', name: '放射線より先に、爆発が命を奪う', desc: 'チェルノブイリ（1986 年）では、爆発とその直後に<br>運転員 2 人が亡くなった。', fate: '<i>即死 〜 数時間</i>', sv: null, organ: 'blast' },
  { dose: '50<span class="u">グレイ以上</span>', name: '脳と血管が壊れる', desc: '数分で激しい嘔吐、意識の混濁、けいれん。<br>治療の方法はない。', fate: '<i>3 日以内に死亡</i>', sv: 50, organ: 'brain' },
  { dose: '10<span class="u">グレイ以上</span>', name: '腸の粘膜が再生しなくなる', desc: '激しい下痢、脱水、感染。<br>血液をつくる骨髄も壊れている。', fate: '<i>およそ 2 週間以内に死亡</i>', sv: 10, organ: 'gut' },
  { dose: '約 4<span class="u">グレイ</span>', name: '骨髄が血液をつくれなくなる', desc: '白血球と血小板が減り、感染と出血が起きる。', fate: '治療しなければ、<i>60 日以内に半数が死亡</i>', sv: 4, organ: 'marrow' },
  { dose: '1<span class="u">グレイ</span>', name: '急性放射線症の入り口', desc: '吐き気、嘔吐、だるさ。白血球が一時的に減る。', fate: '<em>ほとんどの人は回復する</em>', sv: 1, organ: 'mild' },
  { dose: '100<span class="u">ミリシーベルト</span>', name: '症状はない。がんのリスクが少し上がる', desc: '生涯のがん死亡リスクが、約 0.5% 上乗せされる。<br>（日本人のおよそ 30% は、がんで亡くなる）', fate: 'これより低い線量の影響は、<b>統計では見分けにくい</b>', sv: 0.1, organ: 'whole' },
  { dose: '2.1<span class="u">ミリシーベルト／年</span>', name: '自然界から受ける量（日本平均）', desc: '胸の X 線 0.06 ／ 胸部 CT 2.4〜12.9 ／<br>東京–ニューヨーク往復 0.11〜0.16（ミリシーベルト）', fate: '', sv: 0.0021, organ: 'calm' },
];
const TEND = T.ladderEnd;

export const id = 'body';
export async function create(env) {
  const { g, ov } = env;
  const sph = new Spheres(env, 1024), dots = new Dots(env, 2048), lines = new Lines(g, 4096);
  const base = new Layer2D(env), glow = new Layer2D(env);
  const bg = shared(env);
  const rng = mulberry32(606);
  const bpType = Array.from({ length: NBP }, () => rng() < 0.5);
  const sparks = TRACKS.map(() => Array.from({ length: 26 }, () => [rng(), rng.range(-1, 1), rng.range(-1, 1), rng()]));

  // ---- 文字
  chap(ov, { n: 6, kanji: '身体', en: 'THE BODY', t0: T.invisible + 0.3, t1: TEND - 0.2, warn: true });
  ov.add({ t0: T.invisible + 0.2, t1: T.dna + 0.3, className: 'center', style: { top: '470px' }, html: '放射線は、見えない。においも、音もない。', update(el, tl) { el.style.opacity = inout(tl, T.dna + 0.3 - T.invisible - 0.2, 0.9, 0.7).toFixed(4); el.style.letterSpacing = (0.16 + 0.02 * sat(tl / 4)).toFixed(4) + 'em'; } });
  narr(ov, { text: '放射線は、細胞の<b>設計図</b>——DNA を傷つける。', t0: T.dna + 0.5, t1: T.dna + 5.6 });
  narr(ov, { text: '傷が少なければ、細胞は自分で直す。', t0: T.dna + 5.9, t1: T.dna2 + 0.2 });
  narr(ov, { text: '多すぎれば、細胞は死ぬ。\n直しそこねた傷は、ずっとあとで<em>がん</em>になりうる。', t0: T.dna2 + 0.5, t1: T.dna + 18.4 });
  narr(ov, { text: '浴びた量は、<b>シーベルト</b>ではかる。', t0: T.dna + 18.7, t1: T.ladder - 0.15 });
  sub(ov, { text: 'グレイ（Gy）は体が吸収したエネルギーの量。全身にガンマ線を浴びたとき、1 グレイ ≒ 1 シーベルト', t0: T.dna + 19.3, t1: T.ladder - 0.2, y: 962 });
  label(ov, { html: '<span style="font-size:34px">DNA</span><small>2 本の鎖が、らせんに巻いている</small>', t0: T.dna + 1.4, t1: T.dna + 5.6, x: 104, y: 168 });
  label(ov, { html: '鎖が 1 本切れる<small>ほとんどは修復される</small>', t0: T_SSB + 0.4, t1: T_FIX + 2.2, x: 104, y: 168 });
  label(ov, { html: '<i>2 本とも切れる</i><small>修復がむずかしい</small>', t0: T_DSB1 + 0.4, t1: T.dna + 18.4, x: 104, y: 168 });

  // ---- DNA の状態
  const camD = (t) => camera({ pos: [0, 0.8, -8.6 + 0.5 * sat((t - T.dna) / 22)], target: [0, 0, 0], fov: 0.6, cy: H / 2 - 40 });
  function helix(t) {
    const phi = 0.55 * t, out = [];
    const d1 = ease.outCubic(sat((t - T_DSB1) / 2.6)), d2 = ease.outCubic(sat((t - T_DSB2) / 2.6));
    const ssb = t >= T_SSB ? (t < T_FIX ? ease.outCubic(sat((t - T_SSB) / 0.5)) : 1 - ease.inOutCubic(sat((t - T_FIX) / 1.4))) : 0;
    for (let i = 0; i < NBP; i++) {
      const x0 = (i - (NBP - 1) / 2) * (PITCH / PER), a = (i / PER) * TAU + phi;
      // 切れたあと、断片は離れてただよう
      let ox = 0, oy = 0, oz = 0, tilt = 0;
      if (i > BP_D1) { ox += 1.25 * d1; oy -= 1.1 * d1; tilt += 0.22 * d1; }
      if (i < BP_D2) { ox -= 1.1 * d2; oy += 1.0 * d2; tilt -= 0.25 * d2; }
      const pivot = i > BP_D1 ? (BP_D1 - (NBP - 1) / 2) * (PITCH / PER) : (BP_D2 - (NBP - 1) / 2) * (PITCH / PER);
      const fray = Math.max(Math.exp(-Math.abs(i - BP_D1 - 0.5) / 1.6) * d1, Math.exp(-Math.abs(i - BP_D2 + 0.5) / 1.6) * d2);
      const mk = (ang, strand) => {
        let r = RAD * (1 + 0.5 * fray), x = x0, y = Math.cos(ang) * r, z = Math.sin(ang) * r;
        if (strand === 0 && Math.abs(i - BP_SSB) < 1.6) { const k = ssb * (1 - Math.abs(i - BP_SSB) / 1.6); y += 0.55 * k * Math.cos(ang); z += 0.55 * k * Math.sin(ang); x += (i < BP_SSB ? -0.16 : 0.16) * k; }
        if (tilt) { const dx = x - pivot, c = Math.cos(tilt), s = Math.sin(tilt); x = pivot + dx * c - y * s; y = dx * s + y * c; }
        return [x + ox, y + oy, z + oz];
      };
      out.push({ a: mk(a, 0), b: mk(a + GROOVE, 1), fray, i });
    }
    return { bp: out, ssb, d1, d2 };
  }

  const dnaLayer = {
    id: 'dna', t0: T.invisible, t1: T.ladder,
    render(env, tl, t) {
      const p = env.p;
      bg.bg([0.004, 0.010, 0.026], [0.0006, 0.0012, 0.0038], [W / 2, H / 2], 0.95);
      p.bloom = 0.6; p.threshold = 0.72; p.vignette = 0.62; p.ca = 0.007;
      p.fade = smoothstep(0, 0.8, tl) * (1 - smoothstep(T.ladder - 0.6, T.ladder - 0.05, t));
      dots.begin();
      if (t < T.dna + 0.6) {          // 橋: 暗がりに、ときどき光る点（見えない放射線の気配）
        const r0 = mulberry32(12);
        for (let k = 0; k < 40; k++) { const x = r0() * W, y = r0() * H, ph = r0() * 4, life = ((t * 0.9 + ph) % 4) / 0.5; if (life < 1) dots.add(x, y, 3 + 6 * life, 0.8 * (1 - life) * (1 - smoothstep(T.dna - 0.3, T.dna + 0.5, t)), COL.ice); }
        dots.flush('add', { gauss: 1 });
        if (t < T.dna) return;
      }
      const pr = camD(t), st = helix(t), appear = ease.outCubic(sat((t - T.dna) / 1.6));
      // ---- 放射線の飛跡
      lines.begin(); dots.begin();
      TRACKS.forEach(([tt, bpI, dx, dy], k) => {
        const age = t - tt; if (age < -0.25 || age > 1.6) return;
        const hit = st.bp[bpI], c = pr([(hit.a[0] + hit.b[0]) / 2, (hit.a[1] + hit.b[1]) / 2, 0]);
        const L = 1500, nx = dx / Math.hypot(dx, dy + 1.2), ny = (dy + 1.2) / Math.hypot(dx, dy + 1.2);
        const u = clamp((age + 0.25) / 0.3, 0, 1);                       // 画面を横切る
        const x0 = c[0] - nx * L, y0 = c[1] - ny * L, x1 = lerp(x0, c[0] + nx * L, u), y1 = lerp(y0, c[1] + ny * L, u);
        const I = age < 0.05 ? 1 : Math.exp(-(age - 0.05) / 0.28);
        lines.seg(x0, y0, x1, y1, 2.2, 1.8 * I, [1.0, 0.9, 0.7]);
        if (age > 0) for (const sp of sparks[k]) { const along = (sp[0] - 0.5) * 2 * 620, a2 = Math.exp(-age / (0.35 + 0.5 * sp[3])); dots.add(c[0] + nx * along + sp[1] * 14 * (1 + age * 2), c[1] + ny * along + sp[2] * 14 * (1 + age * 2), 2.4, 1.6 * a2, COL.amber); }
        if (age > 0 && age < 1.2) dots.add(c[0], c[1], 20 + 70 * age, 2.2 * Math.exp(-age / 0.2), [1.0, 0.75, 0.4]);
      });
      // ---- 塩基対（はしごの段）と鎖
      sph.begin();
      const zs = st.bp.map((b) => (pr(b.a)[3] + pr(b.b)[3]) / 2); const zmin = Math.min(...zs) - 1, zmax = Math.max(...zs) + 1;
      st.bp.forEach((b, i) => {
        const A = pr(b.a), B = pr(b.b), open = b.fray;
        const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
        const dep = lerp(1, 0.35, sat(((A[3] + B[3]) / 2 - zmin) / (zmax - zmin)));
        const cA = bpType[i] ? [0.30, 0.62, 1.0] : [1.0, 0.62, 0.22], cB = bpType[i] ? [1.0, 0.62, 0.22] : [0.30, 0.62, 1.0];
        const gap = 0.06 + 0.5 * open;
        lines.seg(A[0], A[1], lerp(A[0], mid[0], 1 - gap), lerp(A[1], mid[1], 1 - gap), 0.11 * A[2], 0.55 * dep * appear, cA);
        lines.seg(B[0], B[1], lerp(B[0], mid[0], 1 - gap), lerp(B[1], mid[1], 1 - gap), 0.11 * B[2], 0.55 * dep * appear, cB);
        const hot = Math.max(open, i === BP_SSB || Math.abs(i - BP_SSB) < 1.2 ? st.ssb : 0);
        const colS = [lerp(0.62, 1.0, hot), lerp(0.85, 0.42, hot), lerp(1.0, 0.12, hot)];
        const shadeA = lerp(1, 0.32, sat((A[3] - zmin) / (zmax - zmin))), shadeB = lerp(1, 0.32, sat((B[3] - zmin) / (zmax - zmin)));
        sph.add(A[0], A[1], 0.19 * A[2] * appear, A[3], colS, shadeA, 0.15 + 0.9 * hot);
        sph.add(B[0], B[1], 0.19 * B[2] * appear, B[3], Math.abs(i - BP_SSB) < 1.2 ? [0.62, 0.85, 1.0] : colS, shadeB, 0.15 + 0.9 * open);
        // 鎖（隣の塩基対へ）
        if (i < NBP - 1 && i !== BP_D1 && i !== BP_D2 - 1) {
          const n = st.bp[i + 1], A2 = pr(n.a), B2 = pr(n.b);
          const cutA = i === BP_SSB - 1 || i === BP_SSB ? 1 - st.ssb : 1;
          if (cutA > 0.02) lines.seg(A[0], A[1], A2[0], A2[1], 0.13 * A[2], 0.75 * shadeA * appear * cutA, COL.ice, 0.13 * A2[2]);
          lines.seg(B[0], B[1], B2[0], B2[1], 0.13 * B[2], 0.75 * shadeB * appear, COL.ice, 0.13 * B2[2]);
        } else if (i === BP_D1 || i === BP_D2 - 1) {
          const dd = i === BP_D1 ? st.d1 : st.d2;
          if (dd < 0.02 && i < NBP - 1) { const n = st.bp[i + 1], A2 = pr(n.a), B2 = pr(n.b); lines.seg(A[0], A[1], A2[0], A2[1], 0.13 * A[2], 0.75 * shadeA * appear, COL.ice); lines.seg(B[0], B[1], B2[0], B2[1], 0.13 * B[2], 0.75 * shadeB * appear, COL.ice); }
        }
      });
      // 修復の光
      if (t > T_FIX && t < T_FIX + 2.2) { const q = pr(st.bp[BP_SSB].a), a = Math.sin(sat((t - T_FIX) / 2.2) * Math.PI); dots.add(q[0], q[1], 60, 1.2 * a, COL.blue); dots.add(q[0], q[1], 18, 1.6 * a, COL.ice); }
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 });
      sph.flush({ amb: 0.24, rim: 0.4, spec: 0.5 });
      dots.flush('add', { gauss: 1 });
      const hitT = Math.min(...TRACKS.map(([tt]) => (t >= tt ? t - tt : 9)));
      p.flash = 0.10 * Math.exp(-hitT / 0.08);
    },
  };

  // ------------------------------------------------------------ 線量の梯子
  label(ov, { html: '<span style="letter-spacing:.2em;color:rgba(238,241,244,.62)">どれだけ浴びると、何が起きるか</span>', t0: T.ladder + 0.5, t1: TEND - 0.1, x: 1012, y: 180, size: 25 });
  source(ov, { text: '米国 CDC（急性放射線症）／ICRP／環境省「放射線による健康影響等に関する統一的な基礎資料」', t0: TIER[1], t1: TEND - 0.2 });
  TIERS.forEach((tr, i) => {
    const t0 = TIER[i], t1 = i < TIERS.length - 1 ? TIER[i + 1] : TEND;
    ov.add({
      t0: t0 + 0.05, t1: t1 + 0.25, className: 'tier', style: { top: '250px' },
      html: `<div class="dose">${tr.dose}</div><div class="name">${tr.name}</div><div class="desc">${tr.desc}</div>${tr.fate ? `<div class="fate">${tr.fate}</div>` : ''}`,
      update(el, tl) {
        const dur = t1 + 0.25 - t0 - 0.05, out = 1 - smoothstep(dur - 0.45, dur - 0.05, tl);
        [...el.children].forEach((c, k) => { const a = ease.outCubic(sat((tl - 0.12 - k * 0.22) / 0.55)); c.style.opacity = (a * out).toFixed(4); c.style.transform = `translateY(${((1 - a) * 12).toFixed(2)}px)`; });
      },
    });
  });
  [[0.001, '1 ミリシーベルト'], [0.01, '10'], [0.1, '100'], [1, '1 シーベルト'], [10, '10'], [100, '100']].forEach(([sv, txt]) => {
    fadeEl(ov, { html: txt, className: 'tick', style: { left: (AX - 20) + 'px', top: (doseY(sv) - 14) + 'px', transform: 'translateX(-100%)', width: 'auto' }, t0: T.ladder + 0.4, t1: TEND - 0.1, dy: 0 });
  });

  const organ = (c, kind, a, t) => {
    if (a <= 0.01) return;
    const cx = CXB, pulse = 0.75 + 0.25 * Math.sin(t * 4.2);
    const red = `rgba(255,70,40,${(0.95 * a * pulse).toFixed(4)})`, amb = `rgba(255,170,70,${(0.9 * a * pulse).toFixed(4)})`, blue = `rgba(110,185,255,${(0.75 * a).toFixed(4)})`;
    c.lineCap = 'round'; c.lineJoin = 'round';
    const brain = (col) => { c.fillStyle = col; c.beginPath(); c.ellipse(cx, 198, 30, 31, 0, 0, TAU); c.fill(); };
    const marrow = (col, w = 1) => {
      c.strokeStyle = col; c.lineWidth = 7 * w; c.setLineDash([9, 6]); c.beginPath(); c.moveTo(cx, 282); c.lineTo(cx, 548); c.stroke(); c.setLineDash([]);
      c.lineWidth = 5 * w; c.beginPath();
      for (let k = 0; k < 6; k++) { const y = 312 + k * 19, wv = 64 - k * 2; c.moveTo(cx - 8, y); c.quadraticCurveTo(cx - wv, y - 12, cx - wv - 6, y + 16); c.moveTo(cx + 8, y); c.quadraticCurveTo(cx + wv, y - 12, cx + wv + 6, y + 16); }
      c.moveTo(cx - 12, 540); c.quadraticCurveTo(cx - 70, 520, cx - 76, 572); c.quadraticCurveTo(cx - 40, 590, cx - 12, 566);
      c.moveTo(cx + 12, 540); c.quadraticCurveTo(cx + 70, 520, cx + 76, 572); c.quadraticCurveTo(cx + 40, 590, cx + 12, 566);
      c.stroke();
      c.lineWidth = 9 * w; c.beginPath(); c.moveTo(cx - 56, 588); c.lineTo(cx - 54, 712); c.moveTo(cx + 56, 588); c.lineTo(cx + 54, 712); c.moveTo(cx - 118, 312); c.lineTo(cx - 124, 428); c.moveTo(cx + 118, 312); c.lineTo(cx + 124, 428); c.stroke();
    };
    const gut = (col) => {
      c.strokeStyle = col; c.lineWidth = 13; c.beginPath(); c.moveTo(cx - 8, 432); c.quadraticCurveTo(cx - 52, 428, cx - 44, 462);
      for (let k = 0; k < 4; k++) { const y = 474 + k * 22, sgn = k % 2 ? -1 : 1; c.quadraticCurveTo(cx - sgn * 68, y - 8, cx - sgn * 56, y + 6); c.lineTo(cx + sgn * 50, y + 8); }
      c.quadraticCurveTo(cx + 2, 566, cx, 580); c.stroke();
    };
    if (kind === 'brain') { brain(red); c.strokeStyle = red; c.lineWidth = 5; c.beginPath(); c.moveTo(cx - 6, 232); c.lineTo(cx - 8, 340); c.moveTo(cx + 6, 232); c.lineTo(cx + 8, 340); c.stroke(); c.fillStyle = red; c.beginPath(); c.ellipse(cx - 14, 356, 24, 22, 0.4, 0, TAU); c.fill(); }
    if (kind === 'gut') { gut(red); marrow(`rgba(255,170,70,${(0.35 * a).toFixed(4)})`, 0.8); }
    if (kind === 'marrow') marrow(amb);
    if (kind === 'mild') { marrow(`rgba(255,190,110,${(0.45 * a * pulse).toFixed(4)})`, 0.8); c.fillStyle = `rgba(255,170,70,${(0.6 * a * pulse).toFixed(4)})`; c.beginPath(); c.ellipse(cx - 24, 440, 30, 21, -0.4, 0, TAU); c.fill(); }
    if (kind === 'whole') { const r0 = mulberry32(5); for (let k = 0; k < 70; k++) { const x = cx + r0.range(-84, 84), y = r0.range(180, 880), tw = 0.5 + 0.5 * Math.sin(t * 2 + k); c.fillStyle = `rgba(150,205,255,${(0.75 * a * tw).toFixed(4)})`; c.beginPath(); c.arc(x, y, 2.6, 0, TAU); c.fill(); } }
  };

  const ladderLayer = {
    id: 'ladder', t0: T.ladder, t1: TEND + 1.1,
    render(env, tl, t) {
      const p = env.p;
      bg.bg([0.004, 0.010, 0.024], [0.0006, 0.0012, 0.0038], [CXB, H / 2], 0.95);
      const idx = Math.max(0, TIER.findIndex((v, i) => t >= v && (i === TIER.length - 1 || t < TIER[i + 1])));
      const tr = TIERS[idx], tin = t - TIER[idx], tout = (idx < TIER.length - 1 ? TIER[idx + 1] : TEND) - t;
      const a = Math.min(smoothstep(0, 0.6, tin), smoothstep(0, 0.35, tout));
      const b = base.begin(), g2 = glow.begin();
      const appear = smoothstep(0, 1.0, tl);
      // ---- 人のかたち
      const sev = tr.organ === 'blast' ? 1 : tr.sv >= 10 ? 0.9 : tr.sv >= 1 ? 0.55 : 0.12;      // 段の重さ → 体の色みに
      bodyPath(b, CXB);
      const gr = b.createLinearGradient(0, 160, 0, 905);
      gr.addColorStop(0, `rgba(${22 + 30 * sev * a | 0},${44 - 12 * sev * a | 0},${78 - 30 * sev * a | 0},${(0.88 * appear).toFixed(4)})`); gr.addColorStop(1, `rgba(${10 + 14 * sev * a | 0},${22 - 6 * sev * a | 0},${44 - 16 * sev * a | 0},${(0.88 * appear).toFixed(4)})`);
      b.fillStyle = gr; b.fill();
      bodyPath(g2, CXB); g2.strokeStyle = `rgba(${150 + 90 * sev * a | 0},${200 - 70 * sev * a | 0},${250 - 130 * sev * a | 0},${(0.85 * appear).toFixed(4)})`; g2.lineWidth = 2.4; g2.stroke();
      if (tr.organ === 'blast') { const fl = Math.exp(-tin / 0.5); bodyPath(g2, CXB); g2.fillStyle = `rgba(255,235,200,${(0.9 * fl).toFixed(4)})`; g2.fill(); bodyPath(g2, CXB); g2.strokeStyle = `rgba(255,120,60,${(0.9 * a).toFixed(4)})`; g2.lineWidth = 4; g2.stroke(); }
      organ(g2, tr.organ, a, t);
      // ---- 目盛り（対数）
      g2.strokeStyle = `rgba(190,215,240,${(0.6 * appear).toFixed(4)})`; g2.lineWidth = 1.6; g2.beginPath(); g2.moveTo(AX, doseY(100) - 34); g2.lineTo(AX, Y1MSV + 14);
      for (let d = -3; d <= 2; d++) { const y = Y1MSV - (d + 3) * DEC; g2.moveTo(AX - 12, y); g2.lineTo(AX, y); for (let k = 2; k < 10; k++) { if (d === 2) break; const yy = y - Math.log10(k) * DEC; g2.moveTo(AX - 5, yy); g2.lineTo(AX, yy); } }
      g2.stroke();
      // 急性の障害が出る範囲を色で
      const band = (s0, s1, col) => { g2.fillStyle = col; g2.fillRect(AX + 4, doseY(s1), 9, doseY(s0) - doseY(s1)); };
      band(0.7, 10, `rgba(255,170,70,${(0.55 * appear).toFixed(4)})`); band(10, 50, `rgba(255,100,50,${(0.65 * appear).toFixed(4)})`); band(50, 220, `rgba(255,60,40,${(0.75 * appear).toFixed(4)})`); band(0.1, 0.7, `rgba(110,185,255,${(0.35 * appear).toFixed(4)})`);
      base.flush('alpha', 1, 1); glow.flush('add', 1.35, 1);
      // ---- いまの段の位置
      lines.begin(); dots.begin();
      const yT = tr.sv ? doseY(tr.sv) : doseY(100) - 62;
      const prev = idx > 0 ? (TIERS[idx - 1].sv ? doseY(TIERS[idx - 1].sv) : doseY(100) - 62) : yT;
      const y = lerp(prev, yT, ease.inOutCubic(sat(tin / 0.9)));
      const hot = tr.sv === null || tr.sv >= 1 ? COL.amber : COL.cyan;
      lines.seg(AX + 18, y, CXB - 160, y, 1.6, 0.55 * appear, hot, 1.6, 0.05, hot);
      dots.add(AX, y, 8, 2.8 * appear, COL.white); dots.add(AX, y, 26, 0.9 * appear, hot);
      lines.flushAdd({ gain: 1, soft: 1.2, cap: 1 }); dots.flush('add', { gauss: 1 });
      p.bloom = 0.5; p.threshold = 0.8; p.vignette = 0.58; p.ca = 0.006;
      p.flash = tr.organ === 'blast' ? 0.45 * Math.exp(-tin / 0.12) : 0;
      p.fade = smoothstep(0, 0.9, tl) * (1 - smoothstep(TEND + 0.2, TEND + 1.0, t));
    },
  };
  return [dnaLayer, ladderLayer];
}
