// terrain.js — 起動時に一度だけ行う「焼き込み」。
//   高さ（2048²）は GPU で式を計算 → 8bit×3 に詰めて読み戻し → CPU に持つ（当たり判定とコース作りに使う）
//   → 半精度 2 チャンネル（粗い値 + 残り）にして GPU に戻す。こうすると、浮動小数の描画先や
//   32bit テクスチャの補間が無い端末でも、同じ精度のなめらかな高さが引ける。
import { WORLD, H_MIN, H_RANGE, FS_BAKE_H, FS_BAKE_AUX, FS_BAKE_CLOUD, FS_BAKE_WAVE, FS_BAKE_NOISE, FS_BAKE_MILKY, WAVE_RES, NOISE_RES } from './shaders.js';

const nextFrame = () => new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

export class Terrain {
  constructor(g) { this.g = g; this.N = WORLD.res; this.texel = WORLD.size / WORLD.res; }

  // progress(0..1) を呼びながら、数フレームに分けて焼く
  async bake(progress = () => {}, wait = nextFrame) {
    const g = this.g, gl = g.gl, N = this.N;
    // ---- 高さ
    const pH = g.program(FS_BAKE_H, 'bakeH');
    const tmp = g.target(N, N, { fmt: 'rgba8', filter: 'nearest' });
    const H = this.H = new Float32Array(N * N);
    const T = 512, px = new Uint8Array(T * T * 4);
    let done = 0; const tiles = (N / T) * (N / T);
    for (let ty = 0; ty < N; ty += T) for (let tx = 0; tx < N; tx += T) {
      g.draw(pH, {}, tmp, [tx, ty, T, T]);
      gl.readPixels(tx, ty, T, T, gl.RGBA, gl.UNSIGNED_BYTE, px);
      for (let j = 0; j < T; j++) { let o = (ty + j) * N + tx, k = j * T * 4; for (let i = 0; i < T; i++, k += 4) H[o++] = ((px[k] + px[k + 1] / 255 + px[k + 2] / 65025) / 255) * H_RANGE + H_MIN; }
      progress(0.05 + 0.55 * (++done / tiles));
      await wait();
    }
    g.free(tmp); gl.deleteProgram(pH.p);
    let hmax = -1e9; for (let i = 0; i < H.length; i++) if (H[i] > hmax) hmax = H[i];
    this.hmax = hmax;

    // ---- GPU 用: 半精度 2 チャンネル（R = 1/64 きざみの粗い値, G = 残り）＋ ミップ
    this.height = { tex: gl.createTexture(), w: N, h: N };
    gl.bindTexture(gl.TEXTURE_2D, this.height.tex);
    let lv = H, n = N, level = 0;
    const rg = new Float32Array(N * N * 2);
    while (n >= 1) {
      for (let i = 0, k = 0; i < n * n; i++) { const h = lv[i], r = Math.floor(h * 64) / 64; rg[k++] = r; rg[k++] = h - r; }
      gl.texImage2D(gl.TEXTURE_2D, level, gl.RG16F, n, n, 0, gl.RG, gl.FLOAT, n === N ? rg : rg.subarray(0, n * n * 2));
      if (n === 1) break;
      const m = n >> 1, nx = new Float32Array(m * m);
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) { const a = (2 * j) * n + 2 * i; nx[j * m + i] = 0.25 * (lv[a] + lv[a + 1] + lv[a + n] + lv[a + n + 1]); }
      lv = nx; n = m; level++;
      if (level === 2) { progress(0.64); await wait(); }
    }
    g.params(this.height, { filter: 'mip', wrap: 'mirror' });
    progress(0.68); await wait();

    // ---- 最大高さのピラミッド: 2 画素（0.125 単位）の格子から 32 単位の格子まで 9 段。どの段も 3x3 に広げて安全側に。
    //   レイマーチングで、地形より確実に上にいるあいだは格子ごとに大きく進むために使う。
    const PB = 1024, B = N / PB;
    let raw = new Float32Array(PB * PB), size = PB;
    for (let j = 0; j < PB; j++) for (let i = 0; i < PB; i++) {
      let m = -1e9; for (let y = 0; y < B; y++) { const o = (j * B + y) * N + i * B; for (let x = 0; x < B; x++) { const v = H[o + x]; if (v > m) m = v; } }
      raw[j * PB + i] = m;
    }
    this.maxH = { tex: gl.createTexture() };
    gl.bindTexture(gl.TEXTURE_2D, this.maxH.tex);
    for (let L = 0; L < 9; L++) {
      const d = new Float32Array(size * size);
      for (let j = 0; j < size; j++) {
        const j0 = Math.max(0, j - 1) * size, j1 = j * size, j2 = Math.min(size - 1, j + 1) * size;
        for (let i = 0; i < size; i++) {
          const i0 = Math.max(0, i - 1), i2 = Math.min(size - 1, i + 1);
          d[j1 + i] = Math.max(raw[j0 + i0], raw[j0 + i], raw[j0 + i2], raw[j1 + i0], raw[j1 + i], raw[j1 + i2], raw[j2 + i0], raw[j2 + i], raw[j2 + i2]) + 0.004;
        }
      }
      gl.texImage2D(gl.TEXTURE_2D, L, gl.R32F, size, size, 0, gl.RED, gl.FLOAT, d);
      const half = size >> 1, nx = new Float32Array(half * half);
      for (let j = 0; j < half; j++) for (let i = 0; i < half; i++) { const a = (2 * j) * size + 2 * i; nx[j * half + i] = Math.max(raw[a], raw[a + 1], raw[a + size], raw[a + size + 1]); }
      raw = nx; size = half;
      if (L === 0) { progress(0.70); await wait(); gl.bindTexture(gl.TEXTURE_2D, this.maxH.tex); }
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 8);
    g.params(this.maxH, { filter: 'nearestmip', wrap: 'mirror' });
    progress(0.72); await wait();

    // ---- 模様（GPU で描いてそのまま使う）
    const once = async (fs, name, w, h, o, p) => {
      const pr = g.program(fs, name), t = g.target(w, h, { fmt: 'rgba8', ...o });
      g.draw(pr, {}, t);
      if (o.filter === 'mip') { gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.generateMipmap(gl.TEXTURE_2D); }
      gl.deleteProgram(pr.p); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(t.fbo); t.fbo = null;
      progress(p); await wait();
      return t;
    };
    this.aux = await once(FS_BAKE_AUX, 'bakeAux', N, N, { filter: 'mip', wrap: 'mirror' }, 0.80);
    this.cloud = await once(FS_BAKE_CLOUD, 'bakeCloud', 512, 512, { filter: 'mip', wrap: 'repeat' }, 0.84);
    this.wave = await once(FS_BAKE_WAVE, 'bakeWave', WAVE_RES, WAVE_RES, { filter: 'mip', wrap: 'repeat' }, 0.88);
    this.noise = await once(FS_BAKE_NOISE, 'bakeNoise', NOISE_RES, NOISE_RES, { filter: 'mip', wrap: 'repeat' }, 0.90);
    this.milky = await once(FS_BAKE_MILKY, 'bakeMilky', 1024, 512, { filter: 'linear', wrap: 'repeat' }, 0.93);
    gl.bindTexture(gl.TEXTURE_2D, this.milky.tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // 地面の高さ（世界は端で鏡写しにくり返す）
  heightAt(x, z) {
    const N = this.N;
    let u = (x - WORLD.cx) / WORLD.size + 0.5, v = (z - WORLD.cz) / WORLD.size + 0.5;
    u = u - 2 * Math.floor(u / 2); if (u > 1) u = 2 - u;
    v = v - 2 * Math.floor(v / 2); if (v > 1) v = 2 - v;
    const fx = Math.min(N - 1.001, Math.max(0, u * N - 0.5)), fy = Math.min(N - 1.001, Math.max(0, v * N - 0.5));
    const i = fx | 0, j = fy | 0, a = fx - i, b = fy - j, H = this.H, o = j * N + i;
    return (H[o] * (1 - a) + H[o + 1] * a) * (1 - b) + (H[o + N] * (1 - a) + H[o + N + 1] * a) * b;
  }
  // 地面か水面の、高いほう
  surfaceAt(x, z) { return Math.max(this.heightAt(x, z), WORLD.waterY); }
  normalAt(x, z, e = 0.12) {
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z), hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz);
    return [-hx / l, 2 * e / l, -hz / l];
  }
}
