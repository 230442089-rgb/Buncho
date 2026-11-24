// life.js — 5 章「生命」
// 朝の湖を鳥の群れ（ボイド）がわたる → ピントが手前に移り、枝がのびる → 一羽の文鳥がとまる。
import { bar, BEAT, W, H, sat, smoothstep, ease, lerp, TAU, clamp, v3 } from '../core.js';
import { chapter } from '../overlay.js';
import { getWorld, basis } from '../world.js';
import { Flock } from '../flock.js';
import { Bird } from '../bird.js';
import { birdPose } from '../birdAct.js';
import { solidState, SOLID_LEN, SUN_AZ, sunDir, RIDGE } from './solid.js';
import { RD_FRAMES } from './plane.js';

const B26 = bar(26), B28 = bar(28), B30 = bar(30), B34 = bar(34);
const F26 = Math.floor(B26 * 30 + 1e-6);

// この章と次の章の背景になる、朝の世界
export function lifeWorld(t) {
  const s0 = solidState(SOLID_LEN - 1e-4), u = t - B26;
  const yaw = SUN_AZ + 0.03 - 0.36 + 0.006 * u, pitch = Math.asin(s0.f[1]) + 0.075;      // 太陽を画面の右寄り（文鳥のうしろ）に置く
  const rel = 0.05 + 0.0032 * u;
  return {
    ...s0, up: [0, 1, 0], f: [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)],
    ro: [s0.ro[0] + 0.03 * u, s0.ro[1] + 0.55 + 0.012 * u, s0.ro[2] + 0.4 + 0.06 * u],
    sun: sunDir(rel + RIDGE.e, SUN_AZ + 0.03), palE: rel + RIDGE.e * smoothstep(0.02, 0.36, rel),
    morph: 1, world: 1, waterY: -0.02, cover: 0.42, cloudT: 2.0 + 0.012 * u, time: 40 + u, starRot: 0, mist: 0.55, fog: 0.8, exposure: 1, moonAmt: 0,
  };
}
// 群れの行き先（カメラの前を左右に大きくうねる）
export function flockTarget(k) {
  const tau = k / 30, o = lifeWorld(B26), f = v3.norm([o.f[0], 0, o.f[2]]), r = [f[2], 0, -f[0]];
  const a = 7.5 * Math.sin(0.52 * tau + 2.5), b = 3.0 + 1.3 * Math.sin(0.83 * tau), c = 13 + 4 * Math.sin(0.37 * tau + 1.0);
  return [o.ro[0] + f[0] * c + r[0] * a, b, o.ro[2] + f[2] * c + r[2] * a];
}
export function flockInit() {
  const o = lifeWorld(B26), f = v3.norm([o.f[0], 0, o.f[2]]), r = [f[2], 0, -f[0]];
  return { center: [o.ro[0] + f[0] * 14 + r[0] * 12, 3.4, o.ro[2] + f[2] * 14 + r[2] * 12], dir: [-r[0], 0, -r[2]] };
}

const FS_BLUR = /* glsl */ `
uniform sampler2D uTex; uniform vec2 uDir; out vec4 o;
void main(){
  vec2 t = uDir / vec2(textureSize(uTex, 0));
  vec3 c = texture(uTex, vUv).rgb * 0.16;
  c += (texture(uTex, vUv + t * 1.45).rgb + texture(uTex, vUv - t * 1.45).rgb) * 0.15;
  c += (texture(uTex, vUv + t * 3.4).rgb + texture(uTex, vUv - t * 3.4).rgb) * 0.12;
  c += (texture(uTex, vUv + t * 5.35).rgb + texture(uTex, vUv - t * 5.35).rgb) * 0.09;
  c += (texture(uTex, vUv + t * 7.3).rgb + texture(uTex, vUv - t * 7.3).rgb) * 0.06;
  o = vec4(c, 1.0);
}`;
// ぼけた背景を画面に広げる（ピントを送る途中は、はっきりした絵と混ぜる）
const FS_BG = /* glsl */ `
uniform sampler2D uSharp, uBlur; uniform float uK, uGain; out vec4 o;
void main(){ vec3 b = texture(uBlur, vUv).rgb; vec3 c = uK < 1.0 ? mix(texture(uSharp, vUv).rgb, b, uK) : b; o = vec4(c * uGain, 1.0); }`;

// 背景を小さく描いてぼかす仕組み（言葉の章でも使う）
export class Backdrop {
  constructor(env) {
    const g = env.g;
    this.g = g; this.world = getWorld(env);
    this.small = g.target(640, 360, { type: 'rgba16f' }); this.tmp = g.target(640, 360, { type: 'rgba16f' }); this.blur = g.target(640, 360, { type: 'rgba16f' });
    this.sharp = g.target(W, H, { type: 'rgba16f' });
    this.pBlur = g.program(FS_BLUR, 'bgBlur', { common: false }); this.pBg = g.program(FS_BG, 'bgShow', { common: false });
    this.flock = new Flock(g, 900);
  }
  cam(o) { return { ro: o.ro, m: basis(o.f, o.up), focal: o.focal }; }
  flockTo(t) { this.flock.ensure(Math.max(0, Math.round(t * 30) - F26), flockTarget, flockInit()); }
  drawFlock(o, t, size = 0.115, alpha = 0.95) {
    const cam = this.cam(o), fog = [0.62, 0.50, 0.46];
    this.flock.draw(cam, { time: t, size, col: [0.012, 0.012, 0.018, alpha * 0.22], fog, flip: true, blur: 1 });
    this.flock.draw(cam, { time: t, size, col: [0.012, 0.012, 0.018, alpha], fog });
  }
  // k = 0: はっきり, 1: ぼけ（小さく描いてぼかすだけなので軽い）
  render(env, t, k, target, gain = 1) {
    const g = this.g, o = lifeWorld(t);
    this.world.rd.ensure(RD_FRAMES);
    this.flockTo(t);
    if (k < 1) { g.bind(this.sharp); this.world.render(env, o, this.sharp); g.bind(this.sharp); this.drawFlock(o, t); }
    if (k > 0) {
      g.bind(this.small); this.world.render(env, o, this.small); g.bind(this.small); this.drawFlock(o, t, 0.15, 0.8);
      g.draw(this.pBlur, { uTex: this.small, uDir: [1, 0] }, this.tmp); g.draw(this.pBlur, { uTex: this.tmp, uDir: [0, 1] }, this.blur);
      g.draw(this.pBlur, { uTex: this.blur, uDir: [1.6, 0] }, this.tmp); g.draw(this.pBlur, { uTex: this.tmp, uDir: [0, 1.6] }, this.blur);
    }
    g.draw(this.pBg, { uSharp: this.sharp, uBlur: this.blur, uK: k, uGain: gain }, target);
  }
}
let backdrop = null;
export function getBackdrop(env) { return backdrop || (backdrop = new Backdrop(env)); }
let birdInst = null;
export function getBird(env) { return birdInst || (birdInst = new Bird(env.g)); }
export const BIRD_LIGHT = { rim: [2.9, 1.65, 0.78], key: [0.90, 0.90, 0.98], ambUp: [0.30, 0.33, 0.44], ambDn: [0.17, 0.13, 0.12] };

export const id = 'life';
export async function create(env) {
  const { g, ov } = env;
  const bd = getBackdrop(env), bird = getBird(env);

  chapter(ov, { n: 5, kanji: '生命', en: 'LIFE', line: '時間が流れて、いのちが宿る。', t0: B26 + 0.55, t1: B34, lineHold: 3.4 });
  // 群れをつくる 3 つの規則
  ov.add({
    t0: B26 + 1.4, t1: B28 - 0.1, className: 'rules',
    html: ['分離<i>近づきすぎない</i>', '整列<i>向きをそろえる</i>', '結合<i>群れから離れない</i>'].map((s) => `<div class="rule-row"><b></b>${s}</div>`).join(''),
    update(el, tl) {
      const dur = B28 - 0.1 - (B26 + 1.4);
      [...el.children].forEach((c, i) => {
        const a = ease.outCubic(sat((tl - i * 0.28) / 0.6)) * (1 - smoothstep(dur - 0.45, dur - 0.05, tl));
        c.style.opacity = a.toFixed(4); c.style.transform = `translateX(${((1 - ease.outCubic(sat((tl - i * 0.28) / 0.6))) * 14).toFixed(2)}px)`;
      });
    },
  });

  return {
    id: 'life', t0: B26, t1: B34,
    render(env, tl, t) {
      const p = env.p, post = env.post;
      const k = smoothstep(B28, B28 + 0.9, t);                          // ピントが奥から手前へ
      bd.render(env, t, k, post.hdr, 1);
      g.bind(post.hdr);
      if (t >= B28) {
        const grow = ease.inOutSine(sat((t - (B28 + 0.2)) / 2.7));
        const pose = birdPose(t);
        pose.grow = grow;
        bird.draw(env, pose, BIRD_LIGHT);
      }
      p.flash = 1 - smoothstep(0.0, 0.7, t - B26);
      p.bloom = 0.46; p.threshold = 0.84; p.vignette = 0.46; p.ca = 0.004;
      p.scrim = 0.30;
    },
  };
}
