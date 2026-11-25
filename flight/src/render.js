// render.js — 1 フレームを描く。
//   1) 風景（レイマーチング）を内部解像度で HDR バッファへ（アルファに奥行き）
//   2) ブルーム
//   3) 画面の解像度へ拡大して仕上げ（映像と同じトーン）
//   4) 星・ユリア・輪・光の粒を、奥行きと比べながら画面に重ねる
//   内部解像度は、こま落ちしないように自動で上下させる。
import { WORLD, FS_WORLD, FS_SHADOW, FS_DOWN, FS_UP, FS_FINAL, VS_SPRITE, FS_SPRITE, VS_STAR, FS_STAR } from './shaders.js';
import { clamp, sat, lerp, norm, cross, fogTint } from './sky.js';

// 画質の段階。px: 内部解像度の上限（画素数）
export const QUALITY = {
  low:  { STEPS: 84,  RSTEPS: 28, SHAFTS: 0, px: 0.20e6, shadow: 512,  bloom: 4, ca: 0 },
  mid:  { STEPS: 112, RSTEPS: 40, SHAFTS: 0, px: 0.46e6, shadow: 1024, bloom: 5, ca: 0.0022 },
  high: { STEPS: 150, RSTEPS: 56, SHAFTS: 7, px: 0.95e6, shadow: 1024, bloom: 6, ca: 0.0022 },
};
const SCALES = [0.34, 0.42, 0.5, 0.6, 0.7, 0.82, 1.0];

export class Renderer {
  constructor(g, terrain) {
    this.g = g; this.terrain = terrain; this.gl = g.gl;
    this.hdr = g.floatRT ? 1 : 0;
    this.quality = 'mid'; this.auto = true;
    this.scaleIdx = 4; this.dtAvg = 1 / 60; this.hold = 0; this.failAt = -1; this.lastUp = 0; this.frame = 0;
    this.world = {};                 // 画質ごとのプログラム
    this.scene = null; this.levels = [];
    this.shadow = null; this.shadowKey = null; this.shadowJob = null;
    this.batch = new SpriteBatch(g);
    this.stars = null;
    this.rip = [new Float32Array(4), new Float32Array(4), new Float32Array(4), new Float32Array(4)]; this.ripN = 0;
    this.post = { bloom: 0.46, threshold: 0.8, knee: 0.5, vignette: 0.48, contrast: 1.04, saturation: 1.06, fade: 1, flash: 0, rush: 0, tint: [1, 1, 1] };
    this.stats = { w: 0, h: 0, scale: 1, ms: 0 };
  }

  // ---- プログラム
  compileWorld(q) {
    if (!this.world[q]) { const Q = QUALITY[q]; this.world[q] = this.g.program(FS_WORLD({ STEPS: Q.STEPS, RSTEPS: Q.RSTEPS, SHAFTS: this.hdr ? Q.SHAFTS : 0, HDR: this.hdr, SHADOWS: this.hdr }), 'world-' + q); }
    return this.world[q];
  }
  compileRest() {
    const g = this.g, h = this.hdr;
    this.pDown = g.program(FS_DOWN(h), 'down'); this.pUp = g.program(FS_UP(h), 'up'); this.pFinal = g.program(FS_FINAL(h), 'final');
    this.pSprite = g.program(FS_SPRITE(h), 'sprite', VS_SPRITE, ['aPos', 'aUv', 'aCol', 'aTA']);
    this.pStar = g.program(FS_STAR(h), 'star', VS_STAR, ['aDir', 'aInfo']);
    if (h) this.pShadow = g.program(FS_SHADOW, 'shadow');
    return [this.pDown, this.pUp, this.pFinal, this.pSprite, this.pStar, this.pShadow].filter(Boolean);
  }
  setQuality(q) { this.quality = q; this.compileWorld(q); this.allocShadow(); this.sized = null; }

  // ---- 星（点）
  makeStars(n = 5200, seed = 7) {
    const gl = this.gl; let s = seed >>> 0;
    const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pole = norm([0.55, 0.25, 0.80]), d = new Float32Array(n * 7);
    for (let i = 0; i < n; i++) {
      let v, tries = 0;
      // 天の川の帯のあたりは星を多めに
      do { const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z); v = [r * Math.cos(a), z, r * Math.sin(a)]; tries++; }
      while (tries < 4 && i % 3 === 0 && Math.abs(v[0] * pole[0] + v[1] * pole[1] + v[2] * pole[2]) > 0.3);
      const m = Math.pow(rnd(), 3.4);                 // ほとんどは暗く、ときどき明るい
      d.set([v[0], v[1], v[2], 0.2 + 0.8 * m, rnd(), 1.5 + 4.5 * rnd(), rnd() * 6.283], i * 7);
    }
    const vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    this.stars = { vao, n };
  }

  // ---- 描画先の大きさ
  resize(cw, ch) {
    const Q = QUALITY[this.quality], g = this.g;
    const base = Math.sqrt(Math.min(1, Q.px / (cw * ch)));               // 画質の上限に収まる倍率
    const s = base * (this.auto ? SCALES[this.scaleIdx] : 1);
    const w = Math.max(160, Math.round(cw * s / 2) * 2), h = Math.max(90, Math.round(ch * s / 2) * 2);
    const key = `${w}x${h}`;
    if (this.sized === key) return;
    this.sized = key;
    g.free(this.scene); this.levels.forEach((l) => { g.free(l.d); g.free(l.u); });
    const fmt = this.hdr ? 'rgba16f' : 'rgba8';
    this.scene = g.target(w, h, { fmt, filter: 'linear' });
    this.levels = [];
    let lw = w >> 1, lh = h >> 1;
    for (let i = 0; i < Q.bloom && lw >= 8 && lh >= 8; i++) { this.levels.push({ d: g.target(lw, lh, { fmt }), u: g.target(lw, lh, { fmt }) }); lw >>= 1; lh >>= 1; }
    this.stats.w = w; this.stats.h = h; this.stats.scale = s;
  }

  // ---- 影の高さの地図
  allocShadow() {
    if (!this.hdr) return;
    const n = QUALITY[this.quality].shadow, g = this.g;
    if (this.shadow && this.shadow.n === n) return;
    if (this.shadow) this.shadow.t.forEach((t) => g.free(t));
    const mk = () => g.target(n, n, { fmt: 'rgba16f', filter: 'linear', wrap: 'mirror' });
    this.shadow = { n, t: [mk(), mk(), mk()], cur: 0, valid: false };
    if (this.shadow.t.some((t) => t.bad)) { this.hdrShadowBad = true; }
    this.shadowKey = null; this.shadowJob = null;
  }
  // 太陽が動いたら作り直す。1 フレームに passes 回ぶんだけ進める（全部で 10 回ほど）
  updateShadow(sun, passes = 2, force = false) {
    const S = this.shadow; if (!S || this.hdrShadowBad) return;
    const g = this.g, n = S.n, texel = WORLD.size / n;
    if (sun[1] < -0.07) return;                                       // 太陽が沈みきったら影は使わない
    if (!this.shadowJob) {
      const key = this.shadowKey;
      if (key && !force && Math.abs(key[0] - sun[0]) + Math.abs(key[1] - sun[1]) + Math.abs(key[2] - sun[2]) < 0.004) return;
      const hl = Math.hypot(sun[0], sun[2]) || 1e-4;
      this.shadowJob = { k: 0, K: Math.round(Math.log2(n)), sun: sun.slice(), dir: [sun[0] / hl, sun[2] / hl], slope: sun[1] / hl, src: -1, work: [0, 1, 2].filter((i) => i !== S.cur) };
    }
    const J = this.shadowJob;
    if (force) passes = J.K;
    for (let i = 0; i < passes && J.k < J.K; i++) {
      const stepTex = Math.pow(2, J.k), dist = stepTex * texel;
      const dst = J.work[J.k & 1], src = J.work[(J.k + 1) & 1];
      g.draw(this.pShadow, { uPrev: S.t[src], uH: this.terrain.height, uStep: [J.dir[0] * stepTex / n, J.dir[1] * stepTex / n], uDrop: dist * J.slope, uDist: dist, uFirst: J.k === 0 ? 1 : 0, uLod: Math.log2(WORLD.res / n) }, S.t[dst]);
      J.k++;
      if (J.k === J.K) { S.cur = dst; S.valid = true; this.shadowKey = J.sun; this.shadowJob = null; break; }
    }
  }

  // ---- 波紋（ユリアが水面をかすめた場所）
  ripple(x, z, time, amp = 1) { const r = this.rip[this.ripN++ & 3]; r[0] = x; r[1] = z; r[2] = time; r[3] = amp; }

  // カメラ: { ro, right, up, fwd, focal }。L: daylight()。o: { time, yuPos, yuGlow }
  render(cam, L, o) {
    const g = this.g, gl = this.gl, T = this.terrain, Q = QUALITY[this.quality];
    const cw = gl.drawingBufferWidth, ch = gl.drawingBufferHeight;
    this.resize(cw, ch);
    const sc = this.scene, P = this.post;
    gl.disable(gl.BLEND);
    this.updateShadow(L.sun, o.shadowPasses ?? 2, o.shadowForce);
    const S = this.shadow;
    const rip = new Float32Array(16); for (let i = 0; i < 4; i++) rip.set(this.rip[i], i * 4);
    const prog = this.compileWorld(this.quality);
    g.draw(prog, {
      uH: T.height, uMaxH: T.maxH, uAux: T.aux, uShadow: S && S.valid ? S.t[S.cur] : T.noise, uCloud: T.cloud, uWave: T.wave, uNoise: T.noise, uMilky: T.milky,
      uRes: [sc.w, sc.h], uRo: cam.ro, uCam: [...cam.right, ...cam.up, ...cam.fwd], uFocal: cam.focal, uPix: 1 / (cam.focal * sc.h), uTop: T.hmax + 0.05,
      uTime: o.time, uCloudT: o.cloudT, uCover: L.cover, uExposure: L.exposure, uFog: L.fog, uMist: L.mist, uSnow: L.snow, uWaterY: WORLD.waterY, uWave_: 1, uHTex: T.texel,
      ...L.u,
      uShadowOn: S && S.valid && L.sun[1] > -0.07 ? 1 : 0,
      uYuPos: o.yuPos || [0, -99, 0], uYuGlow: o.yuGlow || [0, 0, 0], uRip: rip,
    }, sc);
    // ---- ブルーム
    const Lv = this.levels;
    let src = sc;
    for (let i = 0; i < Lv.length; i++) { g.draw(this.pDown, { uTex: src, uFirst: i === 0 ? 1 : 0, uThreshold: P.threshold, uKnee: P.knee, uTexel: [1 / src.w, 1 / src.h] }, Lv[i].d); src = Lv[i].d; }
    let low = Lv[Lv.length - 1].d;
    for (let i = Lv.length - 2; i >= 0; i--) { g.draw(this.pUp, { uLow: low, uHigh: Lv[i].d, uTexel: [1 / low.w, 1 / low.h], uMix: 0.62 }, Lv[i].u); low = Lv[i].u; }
    // ---- 仕上げ（画面へ）
    const up = cw / sc.w;
    g.draw(this.pFinal, { uScene: sc, uBloom: low, uRes: [cw, ch], uSceneTexel: [1 / sc.w, 1 / sc.h], uBloomAmt: P.bloom, uVignette: P.vignette, uCA: Q.ca, uContrast: P.contrast, uSaturation: P.saturation, uFade: P.fade, uFlash: P.flash, uSharp: clamp(0.22 * (up - 0.8), 0, 0.42) * (1 - 0.75 * clamp((up - 2.6) / 1.6, 0, 1)), uRush: P.rush, uTime: o.time, uTint: P.tint }, null);
    // ---- 物
    const f = cam.focal, asp = cw / ch, r = cam.right, u = cam.up, w = cam.fwd, e = cam.ro;
    const tx = -(r[0] * e[0] + r[1] * e[1] + r[2] * e[2]), ty = -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), tz = -(w[0] * e[0] + w[1] * e[1] + w[2] * e[2]);
    const a = 2 * f / asp, b = 2 * f;
    const VP = [a * r[0], b * u[0], 0, w[0], a * r[1], b * u[1], 0, w[1], a * r[2], b * u[2], 0, w[2], a * tx, b * ty, 0, tz];
    this.VP = VP;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (this.stars && L.night > 0.003) {
      const m = L.starM, mt = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
      g.use(this.pStar, { uVP: VP, uStarMT: mt, uPx: Math.max(1, ch / 720), uTime: o.time, uNight: L.night * P.fade, uScene: sc, uInv: [1 / cw, 1 / ch] });
      gl.bindVertexArray(this.stars.vao); gl.drawArrays(gl.POINTS, 0, this.stars.n);
    }
    if (this.batch.n) {
      const fc = fogTint(L);
      g.use(this.pSprite, { uVP: VP, uT0: o.tex[0], uT1: o.tex[1], uT2: o.tex[2], uScene: sc, uInv: [1 / cw, 1 / ch], uFog: L.fog, uFogCol: fc });
      this.batch.flush(P.fade);
    }
    gl.disable(gl.BLEND);
    this.frame++;
  }

  // ---- 解像度の自動調整（こま落ちしたら下げ、余裕が続いたら上げてみる）
  //   毎秒 30 こまに制限されている端末（省電力モードなど）では、いくら下げても速くならないので、30 こまを目標に切りかえる。
  adapt(dt, now) {
    if (!this.auto || dt <= 0 || dt > 0.25) return;
    this.dtAvg = lerp(this.dtAvg, dt, 0.08);
    this.hold -= dt;
    if (this.hold > 0) return;
    // 描くのは速いはずなのに毎秒 30 こまで安定しているなら、端末がこま数を制限している（解像度を下げても変わらない）
    if (!this.goal && this.fastHint && this.dtAvg > 0.030 && this.dtAvg < 0.037) { this.capN = (this.capN || 0) + 1; if (this.capN > 3) this.goal = 1 / 30; } else this.capN = 0;
    const goal = this.goal || 1 / 60;
    const slow = this.dtAvg > goal * 1.28, fine = this.dtAvg < goal * 1.09;
    if (slow && this.scaleIdx > 0) {
      // 上げた直後に重くなったのなら、その段はしばらく試さない
      if (now - this.lastUp < 3) this.failAt = this.scaleIdx;
      this.scaleIdx--; this.hold = 0.7; this.dtAvg = goal * 1.09;
    } else if (slow && this.scaleIdx === 0 && !this.goal && this.dtAvg > 0.030 && this.dtAvg < 0.037) {
      this.goal = 1 / 30; this.scaleIdx = Math.min(this.startIdx ?? 3, 4); this.hold = 1.5; this.failAt = -1;
    } else if (fine && this.scaleIdx < SCALES.length - 1 && this.scaleIdx + 1 !== this.failAt) {
      this.calm = (this.calm || 0) + 1;
      if (this.calm > 2) { this.scaleIdx++; this.lastUp = now; this.hold = 1.6; this.calm = 0; }
      else this.hold = 0.8;
    } else { this.hold = 0.5; if (now - this.lastUp > 24) this.failAt = -1; }
    // いちばん下まで下げても重い／いちばん上でも余裕がある、が続いた回数（画質の段を替える目安）
    this.stuck = slow && this.scaleIdx === 0 ? (this.stuck || 0) + 1 : 0;
    this.spare = fine && this.scaleIdx === SCALES.length - 1 ? (this.spare || 0) + 1 : 0;
  }
}

// ---- 四角形をためて、まとめて描く。頂点: 位置 3, uv 2, 色 4（アルファ掛け済み）, [テクスチャ番号, 加算か]
const STRIDE = 11;
class SpriteBatch {
  constructor(g, max = 4096) {
    const gl = g.gl; this.gl = gl; this.max = max; this.n = 0;
    this.data = new Float32Array(max * 4 * STRIDE);
    this.vao = gl.createVertexArray(); this.buf = gl.createBuffer(); this.ibo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const B = STRIDE * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, B, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, B, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, B, 20);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, B, 36);
    const idx = new Uint16Array(max * 6);
    for (let i = 0; i < max; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.items = [];
  }
  begin(cam) { this.items.length = 0; this.n = 0; this.cam = cam; }
  // 4 隅を直接指定（p0..p3: 左下, 右下, 右上, 左上）。uv: [u0, v0, u1, v1]。col: [r,g,b,a]（アルファ掛け済み）
  quad(p0, p1, p2, p3, uv, col, tex = 0, add = 0, sortBias = 0) {
    if (this.items.length >= this.max) return;
    const c = this.cam, cx = (p0[0] + p2[0]) * 0.5 - c.ro[0], cy = (p0[1] + p2[1]) * 0.5 - c.ro[1], cz = (p0[2] + p2[2]) * 0.5 - c.ro[2];
    this.items.push({ z: cx * c.fwd[0] + cy * c.fwd[1] + cz * c.fwd[2] + sortBias, p0, p1, p2, p3, uv, col, tex, add });
    this.n = this.items.length;
  }
  // カメラを向く四角形。c: 中心, sx, sy: 半分の大きさ, rot: 画面内の回転
  billboard(c, sx, sy, uv, col, tex = 0, add = 0, rot = 0, sortBias = 0) {
    const cam = this.cam, cr = Math.cos(rot), sr = Math.sin(rot);
    const R = [cam.right[0] * cr + cam.up[0] * sr, cam.right[1] * cr + cam.up[1] * sr, cam.right[2] * cr + cam.up[2] * sr];
    const U = [-cam.right[0] * sr + cam.up[0] * cr, -cam.right[1] * sr + cam.up[1] * cr, -cam.right[2] * sr + cam.up[2] * cr];
    this.oriented(c, R, U, sx, sy, uv, col, tex, add, sortBias);
  }
  // 向きを指定した四角形（R, U: 右と上の単位ベクトル）
  oriented(c, R, U, sx, sy, uv, col, tex = 0, add = 0, sortBias = 0) {
    const p = (a, b) => [c[0] + R[0] * a * sx + U[0] * b * sy, c[1] + R[1] * a * sx + U[1] * b * sy, c[2] + R[2] * a * sx + U[2] * b * sy];
    this.quad(p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), uv, col, tex, add, sortBias);
  }
  flush(fade = 1) {
    const gl = this.gl, it = this.items, d = this.data;
    it.sort((a, b) => b.z - a.z);                       // 奥から手前へ
    let k = 0;
    for (const q of it) {
      const [u0, v0, u1, v1] = q.uv, c = q.col;
      const P = [q.p0, q.p1, q.p2, q.p3], UV = [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];
      for (let i = 0; i < 4; i++) {
        d[k++] = P[i][0]; d[k++] = P[i][1]; d[k++] = P[i][2]; d[k++] = UV[i][0]; d[k++] = UV[i][1];
        d[k++] = c[0] * fade; d[k++] = c[1] * fade; d[k++] = c[2] * fade; d[k++] = c[3] * fade; d[k++] = q.tex; d[k++] = q.add;
      }
    }
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, k));
    gl.drawElements(gl.TRIANGLES, it.length * 6, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }
}

// カメラの基底（右・上・前）。roll: 画面の傾き
export function camera(ro, target, focal = 1.2, roll = 0) {
  const fwd = norm([target[0] - ro[0], target[1] - ro[1], target[2] - ro[2]]);
  let right = norm(cross([0, 1, 0], fwd)), up = cross(fwd, right);
  if (roll) { const c = Math.cos(roll), s = Math.sin(roll); const r2 = [right[0] * c + up[0] * s, right[1] * c + up[1] * s, right[2] * c + up[2] * s]; up = [-right[0] * s + up[0] * c, -right[1] * s + up[1] * c, -right[2] * s + up[2] * c]; right = r2; }
  return { ro: ro.slice(), right, up, fwd, focal };
}
