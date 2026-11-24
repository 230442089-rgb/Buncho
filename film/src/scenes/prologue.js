// prologue.js — 序章「言葉」と 0 章「点」
// 実際に送られてきたプロンプトが打ち込まれ、Enter で文字が粒になって一点に集まる。カーソルがそのまま「点」になる。
import { bar, BEAT, W, H, sat, smoothstep, ease, mulberry32, lerp, pulse } from '../core.js';
import { chapter } from '../overlay.js';
import { shared, SHU, LAYOUT } from './shared.js';

const PROMPT = [
  ['いまの', '今の'], ['あなたの', 'あなたの'], ['じつりょくを', '実力を'], ['ふるに', 'フルに'],
  ['しめす、', '示す、'], ['あにめーしょん', 'アニメーション'], ['びでおを', 'ビデオを'], ['つくって', '作って'],
];
export const PROMPT_TEXT = PROMPT.map((p) => p[1]).join('');

const TICK = BEAT / 8;             // 32分音符
const T_ENTER = bar(2);            // Enter = ベースが入る小節の頭
const T_ARRIVE = T_ENTER + BEAT * 2;
const T_END = bar(3);
const X0L = 150, X0 = 208, X1 = 1770, BASE = 558, Y0 = 440, SH = 200;
const FONT = '500 50px "Shippori Mincho"', LS = '2px';
export const CENTER = [W / 2, H / 2];
export const DOT_R = 6.5, DOT_I = 2.5;

// 打鍵の台本: かなを1つずつ → 変換 → 次の文節へ
function buildScript() {
  const ev = []; let k = 10, committed = '';
  PROMPT.forEach(([kana, conv], pi) => {
    const ks = [...kana];
    ks.forEach((_, i) => ev.push({ k: k++, committed, comp: ks.slice(0, i + 1).join(''), conv: false }));
    ev.push({ k: k++, committed, comp: conv, conv: true });     // 変換（確定待ち）
    committed += conv;
    if (pi === 4) k += 2;                                         // 読点のあとで一呼吸
  });
  ev.push({ k: k++, committed, comp: '', conv: false });          // 最後の確定
  return ev.map((e) => ({ ...e, t: 0.034 + e.k * TICK }));
}
export const SCRIPT = buildScript();

const FS_PROMPT = /* glsl */ `
uniform sampler2D uTex; uniform vec4 uRect; uniform vec4 uCaret; uniform float uAlpha;
out vec4 o;
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec3 c = vec3(0.0);
  vec2 uv = (p - uRect.xy) / uRect.zw;
  if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
    vec4 t = texture(uTex, vec2(uv.x, 1.0 - uv.y));
    c += toLinear(t.rgb) * t.a * uAlpha;
  }
  float d = sdBox(p - uCaret.xy, vec2(1.6, uCaret.z)) - 0.6;
  c += C_SHU * uCaret.w * sat(0.5 - d);
  o = vec4(c, 1.0);
}`;

const VS_PART = /* glsl */ `
layout(location = 0) in vec3 aHome; layout(location = 1) in vec4 aRnd;
uniform float uT, uGain; uniform vec2 uC;
out vec4 vCol;
void main(){
  float delay = (1.0 - sat((aHome.x - 200.0) / 1520.0)) * 0.20 + aRnd.x * 0.34;
  float dur = mix(0.98, 1.30, aRnd.y);
  float tau = sat((uT - delay) / dur);
  float e = pow(tau, 2.4);
  vec2 d = aHome.xy - uC;
  float ang = (1.5 + 1.9 * aRnd.z) * pow(tau, 1.5);
  vec2 q = rot(-ang) * d * (1.0 - e);
  // 乱流（出発と到着では 0）
  vec2 nz = vec2(gnoise(aHome.xy * 0.011 + vec2(tau * 1.3, aRnd.w * 7.0)), gnoise(aHome.yx * 0.011 + vec2(aRnd.w * 5.0, tau * 1.3 + 3.7)));
  q += nz * 46.0 * sin(PI * tau) * (0.4 + aRnd.z);
  // 出発前のふるえ
  q += (aRnd.zw - 0.5) * 1.2 * smoothstep(0.0, 0.12, uT) * (1.0 - smoothstep(0.0, 0.25, tau));
  vec2 p = uC + q;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
  gl_PointSize = mix(1.7, 2.3, smoothstep(0.1, 0.8, tau));
  vec3 col = mix(C_PAPER, C_SHU * 2.2, smoothstep(0.12, 0.8, tau));
  float a = aHome.z * uGain * (1.0 - smoothstep(0.90, 1.0, tau)) * mix(1.0, 0.55, smoothstep(0.1, 0.7, tau));
  vCol = vec4(col, a);
}`;
const FS_PART = /* glsl */ `
in vec4 vCol; out vec4 o;
void main(){ vec2 c = gl_PointCoord - 0.5; float m = smoothstep(0.5, 0.15, length(c)); o = vec4(vCol.rgb * vCol.a * m, 1.0); }`;

// 入力欄（2D キャンバスに描いてテクスチャにする）。序章と結びで使う
let PROMPT_UI = null;
export function createPrompt(env) {
  if (PROMPT_UI) return PROMPT_UI;
  const { g } = env;
  const pPrompt = g.program(FS_PROMPT, 'prompt');
  const cv = document.createElement('canvas'); cv.width = W; cv.height = SH;
  const ctx = cv.getContext('2d');
  const tex = { tex: g.gl.createTexture(), w: W, h: SH };
  let lastKey = '', lastCaret = X0 + 7;
  function drawPrompt(st) {
    const key = JSON.stringify(st);
    if (key === lastKey) return lastCaret;
    ctx.clearRect(0, 0, W, SH);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f4efe6';
    ctx.globalAlpha = st.ui * 0.5; ctx.font = '500 12px "Inter"'; ctx.letterSpacing = '6px';
    ctx.fillText('PROMPT', X0L + 2, 482 - Y0);
    ctx.globalAlpha = st.ui * 0.22; ctx.fillRect(X0L, 602 - Y0, (X1 - X0L) * st.line, 1);
    ctx.globalAlpha = st.ui; ctx.fillStyle = '#ff4b2b'; ctx.font = '300 46px "Inter"'; ctx.letterSpacing = '0px';
    ctx.fillText('›', X0L + 4, BASE - Y0 - 1);
    ctx.fillStyle = '#f4efe6'; ctx.globalAlpha = st.text; ctx.font = FONT; ctx.letterSpacing = LS;
    ctx.fillText(st.committed, X0, BASE - Y0);
    const w1 = ctx.measureText(st.committed).width;
    let w2 = 0;
    if (st.comp) {
      ctx.fillText(st.comp, X0 + w1, BASE - Y0);
      w2 = ctx.measureText(st.comp).width;
      ctx.globalAlpha = st.text * (st.conv ? 0.95 : 0.5);
      ctx.fillRect(X0 + w1 + 1, BASE - Y0 + 14, w2 - 4, st.conv ? 3 : 1.5);
    }
    ctx.globalAlpha = 1;
    g.texFromCanvas(cv, { into: tex });
    lastKey = key; lastCaret = X0 + w1 + w2 + 7;
    return lastCaret;
  }
  PROMPT_UI = { drawPrompt, tex, pPrompt, measure: (text) => { ctx.font = FONT; ctx.letterSpacing = LS; return ctx.measureText(text).width; } };
  return PROMPT_UI;
}
export const PROMPT_GEOM = { X0L, X0, X1, BASE, Y0, SH };

export const id = 'prologue';
export async function create(env) {
  const { g, ov } = env;
  const S = shared(env);
  const pPart = g.programVF(VS_PART, FS_PART, 'textParticles');

  const { drawPrompt, tex, pPrompt } = createPrompt(env);
  let caretX = X0 + 7;

  // ---- 完成した文の画素から粒をつくる
  const SS = 2;
  const pc = document.createElement('canvas'); pc.width = W * SS; pc.height = SH * SS;
  const pctx = pc.getContext('2d');
  pctx.scale(SS, SS); pctx.font = FONT; pctx.letterSpacing = LS; pctx.textBaseline = 'alphabetic'; pctx.fillStyle = '#fff';
  pctx.fillText(PROMPT_TEXT, X0, BASE - Y0);
  const END_CARET = X0 + pctx.measureText(PROMPT_TEXT).width + 7;
  const px = pctx.getImageData(0, 0, pc.width, pc.height).data;
  const homes = [], rnds = [], rng = mulberry32(20261124);
  for (let y = 0; y < pc.height; y++) for (let x = 0; x < pc.width; x++) {
    const a = px[(y * pc.width + x) * 4 + 3];
    if (a > 20) { homes.push((x + 0.5) / SS, (y + 0.5) / SS + Y0, a / 255); rnds.push(rng(), rng(), rng(), rng()); }
  }
  const NP = homes.length / 3;
  const mesh = g.mesh({ home: { loc: 0, size: 3, data: new Float32Array(homes) }, rnd: { loc: 1, size: 4, data: new Float32Array(rnds) } }, { mode: 'POINTS', count: NP });
  env.stats = env.stats || {}; env.stats.textParticles = NP;

  chapter(ov, { n: 0, kanji: '点', en: 'POINT', line: 'はじめに、点があった。', t0: T_ENTER + 0.12, t1: T_END, lineHold: 2.05, lineDelay: 0.38 });

  function stateAt(t) {
    let cur = { committed: '', comp: '', conv: false };
    for (const e of SCRIPT) { if (e.t <= t) cur = e; else break; }
    return cur;
  }
  const T_TYPE0 = SCRIPT[0].t, T_TYPE1 = SCRIPT[SCRIPT.length - 1].t;

  return {
    id: 'prologue', t0: 0, t1: T_END,
    render(env, tl, t) {
      const p = env.p;
      p.fade = smoothstep(0.0, 0.7, t);
      p.bloom = 0.62; p.ca = 0.004;
      S.bg();
      const te = t - T_ENTER;
      if (te < 0.12) {
        // ---- 打ち込み
        const s = stateAt(t);
        const ui = smoothstep(0.1, 0.9, t) * (1 - smoothstep(-0.02, 0.1, te));
        caretX = drawPrompt({ committed: s.committed, comp: s.comp, conv: s.conv, ui: +ui.toFixed(3), line: +ease.inOutCubic(sat((t - 0.15) / 1.0)).toFixed(3), text: 1 });
        let blink = 1;
        if (t < T_TYPE0 - 0.05) blink = ((t + 0.2) % 1.06) < 0.56 ? 1 : 0;
        else if (t > T_TYPE1 + 0.25 && te < 0) blink = ((t - T_TYPE1 - 0.25) % 1.0) < 0.36 ? 0 : 1;
        const flash = 1 + 2.5 * pulse(t, T_ENTER, 0.09);
        const textA = 1 - smoothstep(0.0, 0.1, te);
        g.draw(pPrompt, { uTex: tex, uRect: [0, Y0, W, SH], uCaret: [caretX, BASE - 18, 29, blink * 1.5 * flash * smoothstep(0.25, 0.6, t)], uAlpha: textA }, undefined, 'add');
      }
      if (te >= 0) {
        // ---- 文字の粒が渦を巻いて中心へ
        const NS = 4;
        const gain = smoothstep(0.0, 0.1, te) * 0.62 / NS;
        for (let j = 0; j < NS; j++) {
          g.drawMesh(pPart, mesh, { uT: te - (j / NS) * (1 / 30) * 0.9, uC: CENTER, uGain: gain }, 'add');
        }
        // ---- カーソルが縮んで点になり、中心へすべっていく
        const a = ease.inOutCubic(sat((te - 0.1) / 1.05));
        // 小節の終わりで左へ引いて「ため」をつくる（次の小節の頭で一気に右へ走り、線になる）
        const wind = ease.inOutCubic(sat((t - (T_END - 0.78)) / 0.76));
        const x = lerp(lerp(END_CARET, CENTER[0], a), LAYOUT.lineX0, wind), y = lerp(BASE - 18, CENTER[1], a) - Math.sin(Math.PI * a) * 46;
        const hh = lerp(29, 0, ease.outCubic(sat(te / 0.3)));
        const settle = ease.outBack(sat((te - 1.15) / 0.75), 2.6);
        const beatBump = 0.35 * pulse(t, T_ARRIVE, 0.16) + 0.22 * pulse(t, T_ARRIVE + BEAT, 0.16);
        const r = lerp(4.2, DOT_R, settle) * (1 + beatBump);
        const inten = lerp(1.6, DOT_I, settle) * (1 + 2.5 * pulse(t, T_ENTER, 0.09) + 1.6 * pulse(t, T_ARRIVE, 0.2));
        if (hh > 0.5) g.draw(pPrompt, { uTex: tex, uRect: [0, Y0, W, SH], uCaret: [x, y, hh, inten * 0.55], uAlpha: 0 }, undefined, 'add');
        const rings = [];
        for (const [tb, amp] of [[T_ARRIVE, 1], [T_ARRIVE + BEAT, 0.55]]) {
          const u = (t - tb) / 1.15;
          if (u > 0 && u < 1) rings.push({ x: CENTER[0], y: CENTER[1], r: DOT_R + 300 * ease.outCubic(u) * (0.6 + 0.4 * amp), w: 1.6, a: 1.4 * amp * Math.pow(1 - u, 2.2), col: SHU(1) });
        }
        S.dots([{ x, y, r: Math.max(r - hh * 0.2, 1.4), i: inten, col: SHU(1) }], rings);
      }
    },
  };
}
