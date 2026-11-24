// words.js — 6 章「言葉」と結び
// 文鳥がうたうたびに、くちばしから文字がひとつ生まれて漂う。やがて集まって一行になる。文鳥は飛び立ち、画面は最初の入力欄に戻る。
import { bar, BEAT, W, H, FPS, TOTAL_FRAMES, DURATION, sat, smoothstep, ease, lerp, TAU, pulse } from '../core.js';
import { chapter, chars, revealChars } from '../overlay.js';
import { shared } from './shared.js';
import { getBackdrop, getBird, BIRD_LIGHT } from './life.js';
import { birdPose, CHIRPS, T_SING, T_OFF } from '../birdAct.js';
import { createPrompt, PROMPT_GEOM } from './prologue.js';

const B34 = bar(34), B37 = bar(37), B40 = bar(40);
const T_ASM = T_SING + 12 * BEAT;                // 文字が集まりはじめる
const TITLE = ['言', '葉', 'は', '、', '世', '界', 'に', 'な', 'る', '。'];
// 縦書き 2 行（右の行から）: 言葉は、／世界になる。
const FS = 98, PITCH = 112, COL_X = [604, 452], TOP = 232;
const SLOT = TITLE.map((c, i) => (i < 4 ? [COL_X[0], TOP + i * PITCH] : [COL_X[1], TOP + (i - 4) * PITCH]));

const NEXT = [['つぎは、', '次は、'], ['なにを', '何を'], ['つくりましょうか。', 'つくりましょうか。']];

export const id = 'words';
export async function create(env) {
  const { g, ov } = env;
  const S = shared(env);
  const bd = getBackdrop(env), bird = getBird(env);
  const prompt = createPrompt(env);
  const { X0, BASE, Y0, SH } = PROMPT_GEOM;

  chapter(ov, { n: 6, kanji: '言葉', en: 'WORDS', line: 'いのちは、言葉をうたう。', t0: B34 + 0.3, t1: B40 - 0.9, lineHold: 3.6 });

  // ---- 文字: うたうたびにくちばしから生まれ、漂い、集まって題になる
  const beakAt = CHIRPS.map(([c]) => bird.locate(birdPose(c + 0.06)));
  ov.add({
    t0: CHIRPS[0][0], t1: B40 - 0.05, className: 'title',
    html: TITLE.map((c) => `<span class="tg">${c}</span>`).join('') + `<div class="title-en">${chars('WORDS BECOME WORLDS')}</div><div class="seal"><span>文</span><span>鳥</span></div>`,
    update(el, tl, t) {
      const out = 1 - smoothstep(B40 - 1.0, B40 - 0.15, t);
      for (let i = 0; i < TITLE.length; i++) {
        const sp = el.children[i], c = CHIRPS[i][0], s = t - c;
        if (s < 0) { sp.style.opacity = 0; continue; }
        const b = beakAt[i];
        // 漂う: くちばしからぽんと押し出され、同じ流れに乗って左上へ（先に生まれた文字ほど先を行くので、重ならない）
        // 3 つずつ生まれるので、上下に段をつけて小さな群れにする
        const row = i === 9 ? 0 : [0, 1, -1][i % 3], sp3 = ease.outCubic(sat(s / 0.9));
        const fx = b[0] - (118 * (1 - Math.exp(-s / 0.5)) + 50 * s) - 18 * Math.abs(row) * sp3 + 8 * Math.sin(0.9 * s + i * 1.7);
        const fy = b[1] - (104 * (1 - Math.exp(-s / 0.9)) + 8.5 * s) + 66 * row * sp3 + 12 * Math.sin(1.15 * s + i * 2.1) * sat(s / 0.8);
        // 集まる
        const a = ease.inOutCubic(sat((t - T_ASM - 0.085 * i) / 1.35));
        const x = lerp(fx, SLOT[i][0], a), y = lerp(fy, SLOT[i][1], a);
        const sc = lerp(lerp(0.12, 0.54, ease.outBack(sat(s / 0.38), 2.2)), 1, a);
        const rot = (1 - a) * (8 * Math.sin(0.8 * s + i * 1.9) + (i % 2 ? 5 : -5));
        const arrive = pulse(t, T_ASM + 0.085 * i + 1.35, 0.25);
        sp.style.opacity = (smoothstep(0, 0.14, s) * lerp(0.92, 1, a) * out).toFixed(4);
        sp.style.transform = `translate(${(x - FS / 2).toFixed(2)}px, ${(y - FS / 2).toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${(sc * (1 + 0.05 * arrive)).toFixed(4)})`;
      }
      const en = el.children[TITLE.length], rule = el.children[TITLE.length + 1], te = t - (T_ASM + 2.3);
      en.style.opacity = te > 0 ? out : 0; if (te > 0) revealChars(en, te, { stagger: 0.03, dur: 0.5, dy: 0, dx: -6, blur: 4 });
      // 落款（朱の印）を、とん、と押す
      const ts = t - (T_ASM + 2.05), st = ease.outCubic(sat(ts / 0.22));
      rule.style.opacity = (ts > 0 ? st * out : 0).toFixed(4);
      rule.style.transform = `scale(${lerp(1.45, 1, st).toFixed(4)}) rotate(-2deg)`;
    },
  });

  // ---- クレジット（文鳥が飛び立ったあと、枝の上の空いたところに）
  const loc = env.stats && env.stats.loc ? env.stats.loc.toLocaleString('en-US') : '—';
  ov.add({
    t0: T_OFF + 0.75, t1: B40 - 0.05, className: 'credits',
    html: `<div class="cr-main">${chars('映像のすべてを、コードから。')}</div>`
      + `<div class="cr-row"><b></b>${loc} 行のプログラム<i>／</i>${TOTAL_FRAMES.toLocaleString('en-US')} フレーム<i>／</i>写真・動画の素材 0</div>`
      + `<div class="cr-row"><b></b>プロンプト<em>あなた</em><i>／</i>脚本・演出・プログラム<em>Claude</em></div>`
      + `<div class="cr-small">音楽 “Inventing Flight” Bryan Teoh（CC0・FreePD）　効果音 SFX Kit by Wyzowl（CC0）ほか<br>書体 しっぽり明朝・Noto Sans JP・Inter・JetBrains Mono（SIL OFL）</div>`,
    update(el, tl, t) {
      const out = 1 - smoothstep(B40 - 1.0, B40 - 0.2, t);
      revealChars(el.children[0], tl, { stagger: 0.04, dur: 0.6, dy: 10, blur: 8 });
      el.children[0].style.opacity = out.toFixed(4);
      for (let i = 1; i < el.children.length; i++) {
        const a = ease.outCubic(sat((tl - 0.55 - 0.22 * i) / 0.7));
        el.children[i].style.opacity = (a * out).toFixed(4); el.children[i].style.transform = `translateY(${((1 - a) * 10).toFixed(2)}px)`;
      }
    },
  });

  // ---- 結び: 入力欄に戻り、次の一行を待つ
  const TICK = BEAT / 4;
  const script = []; { let k = 4, committed = '';
    for (const [kana, conv] of NEXT) { const ks = [...kana]; ks.forEach((_, i) => script.push({ k: k++, committed, comp: ks.slice(0, i + 1).join(''), conv: false })); if (conv !== kana) script.push({ k: k++, committed, comp: conv, conv: true }); committed += conv; k++; }
    script.push({ k: k, committed, comp: '', conv: false });
  }
  script.forEach((e) => { e.t = B40 + e.k * TICK; });
  const stateAt = (t) => { let cur = { committed: '', comp: '', conv: false }; for (const e of script) { if (e.t <= t) cur = e; else break; } return cur; };
  const T_TYPED = script[script.length - 1].t;
  const fullW = prompt.measure('次は、何をつくりましょうか。');
  const OFFX = (W - (X0 + fullW + 7) - 150) / 2;           // 完成した一行が画面の中央に来るように全体を寄せる
  const LINE_FRAC = (X0 - 150 + fullW + 64) / (PROMPT_GEOM.X1 - 150);

  return {
    id: 'words', t0: B34, t1: DURATION + 1,
    render(env, tl, t) {
      const p = env.p, post = env.post;
      if (t < B40) {
        bd.render(env, t, 1, post.hdr, 1);
        g.bind(post.hdr);
        bird.draw(env, { ...birdPose(t), grow: 1 }, BIRD_LIGHT);
        p.bloom = 0.46; p.threshold = 0.84; p.vignette = 0.46; p.ca = 0.004; p.scrim = 0.30 * (1 - smoothstep(4.5, 6, t - B34));
        p.fade = 1 - smoothstep(B40 - 0.95, B40 - 0.08, t);
      } else {
        // 最後の和音。カーソルがまた点滅している
        S.bg();
        const s = stateAt(t), te = t - B40;
        const ui = smoothstep(0.05, 0.7, te);
        const cx = prompt.drawPrompt({ committed: s.committed, comp: s.comp, conv: s.conv, ui: +ui.toFixed(3), line: +(LINE_FRAC * ease.inOutCubic(sat((te - 0.05) / 0.9))).toFixed(3), text: 1 });
        let blink = 1;
        if (t < script[0].t - 0.05) blink = ((te + 0.3) % 1.06) < 0.58 ? 1 : 0;
        else if (t > T_TYPED + 0.3) blink = ((t - T_TYPED - 0.3) % 1.1) < 0.42 ? 0 : 1;
        g.draw(prompt.pPrompt, { uTex: prompt.tex, uRect: [OFFX, Y0, W, SH], uCaret: [cx + OFFX, BASE - 18, 29, blink * 1.5 * smoothstep(0.1, 0.5, te)], uAlpha: 1 }, undefined, 'add');
        p.bloom = 0.62; p.ca = 0.004;
        p.fade = smoothstep(0.0, 0.5, te) * (1 - smoothstep(DURATION - 1.15, DURATION - 0.25, t));
      }
    },
  };
}
