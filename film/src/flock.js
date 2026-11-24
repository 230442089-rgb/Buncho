// flock.js — 鳥の群れ（ボイド）。3 つの規則「分離・整列・結合」だけで、群れのうねりが生まれる。
import { mulberry32, clamp } from './core.js';

const VS = /* glsl */ `
layout(location = 0) in vec3 aPos; layout(location = 1) in vec3 aVel; layout(location = 2) in float aPh;
uniform vec3 uRo; uniform mat3 uCam; uniform float uFocal, uTime, uSize, uFlip, uWaterY, uSub;
out float vFade; out float vWing;
void main(){
  int vid = gl_VertexID;
  vec3 f = normalize(aVel + 1e-5), r = normalize(cross(vec3(0.0, 1.0, 0.0), f)), u = cross(f, r);
  float flap = sin(aPh + uTime * 40.0);
  // 左右の翼を 1 枚ずつの三角形で。付け根を少し上下にずらして、真横から見ても体の厚みが残るようにする
  vec3 l = (vid == 0 || vid == 3) ? vec3(0.0, vid == 0 ? 0.10 : -0.10, 0.55) : (vid == 1 || vid == 4) ? vec3(0.0, vid == 1 ? -0.12 : 0.12, -0.6) : vec3(vid == 2 ? -1.0 : 1.0, flap * 0.85, -0.2);
  vec3 wp = aPos - aVel * uSub + (r * l.x + u * l.y + f * l.z) * uSize;
  if (uFlip > 0.5) wp.y = 2.0 * uWaterY - wp.y;                 // 湖面への映り込み
  vec3 c = (wp - uRo) * uCam;
  vFade = exp(-c.z * c.z * 0.00034); vWing = abs(l.x);
  gl_Position = c.z > 0.2 ? vec4(c.x * uFocal * 2.0 * uRes.y / uRes.x, c.y * uFocal * 2.0, 0.0, c.z) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
const FS = /* glsl */ `
in float vFade; in float vWing; uniform vec4 uCol; uniform vec3 uFog; out vec4 o;
void main(){ float a = uCol.a * (0.55 + 0.45 * vFade); vec3 c = mix(uFog, uCol.rgb, vFade); o = vec4(c * a, a); }`;

export class Flock {
  constructor(g, n = 1300, seed = 2026) {
    this.g = g; this.n = n; this.seed = seed;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.acc = new Float32Array(n * 3);
    const ph = new Float32Array(n), r = mulberry32(seed + 9);
    for (let i = 0; i < n; i++) ph[i] = r() * 6.283;
    this.prog = g.programVF(VS, FS, 'flock');
    this.mesh = g.mesh({ pos: { loc: 0, size: 3, data: this.pos, dynamic: true, divisor: 1 }, vel: { loc: 1, size: 3, data: this.vel, dynamic: true, divisor: 1 }, ph: { loc: 2, size: 1, data: ph, divisor: 1 } }, { mode: 'TRIANGLES', count: 6, instances: n });
    this.frame = -1;
  }
  reset(center, dir) {
    const r = mulberry32(this.seed), n = this.n;
    for (let i = 0; i < n; i++) {
      this.pos[i * 3] = center[0] + r.gauss() * 3.2; this.pos[i * 3 + 1] = center[1] + r.gauss() * 0.9; this.pos[i * 3 + 2] = center[2] + r.gauss() * 3.2;
      this.vel[i * 3] = dir[0] * 4 + r.gauss() * 0.6; this.vel[i * 3 + 1] = dir[1] * 4 + r.gauss() * 0.3; this.vel[i * 3 + 2] = dir[2] * 4 + r.gauss() * 0.6;
    }
    this.frame = 0;
  }
  step(target, dt = 1 / 30) {
    const { n, pos, vel, acc } = this;
    const R = 1.45, R2 = R * R, SEP = 0.55, SEP2 = SEP * SEP, inv = 1 / R;
    // 近くの鳥だけを見るための格子
    const grid = new Map();
    for (let i = 0; i < n; i++) {
      const k = ((Math.floor(pos[i * 3] * inv) + 512) << 20) | ((Math.floor(pos[i * 3 + 1] * inv) + 512) << 10) | (Math.floor(pos[i * 3 + 2] * inv) + 512);
      let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(i);
    }
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      let cx = 0, cy = 0, cz = 0, ax = 0, ay = 0, az = 0, sx = 0, sy = 0, sz = 0, cnt = 0;
      const gx = Math.floor(x * inv) + 512, gy = Math.floor(y * inv) + 512, gz = Math.floor(z * inv) + 512;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const cell = grid.get(((gx + dx) << 20) | ((gy + dy) << 10) | (gz + dz));
        if (!cell) continue;
        for (let m = 0; m < cell.length; m++) {
          const j = cell[m]; if (j === i) continue;
          const ex = pos[j * 3] - x, ey = pos[j * 3 + 1] - y, ez = pos[j * 3 + 2] - z, d2 = ex * ex + ey * ey + ez * ez;
          if (d2 > R2) continue;
          cx += ex; cy += ey; cz += ez; ax += vel[j * 3]; ay += vel[j * 3 + 1]; az += vel[j * 3 + 2]; cnt++;
          if (d2 < SEP2) { const w = (SEP2 - d2) / (SEP2 * (d2 + 0.01)); sx -= ex * w; sy -= ey * w; sz -= ez * w; }
        }
      }
      let fx = 0, fy = 0, fz = 0;
      if (cnt) {
        const ic = 1 / cnt;
        fx += cx * ic * 0.9 + (ax * ic - vel[i * 3]) * 1.5 + sx * 0.9;       // 結合 ＋ 整列 ＋ 分離
        fy += cy * ic * 0.9 + (ay * ic - vel[i * 3 + 1]) * 1.5 + sy * 0.9;
        fz += cz * ic * 0.9 + (az * ic - vel[i * 3 + 2]) * 1.5 + sz * 0.9;
      }
      // 群れ全体の行き先（ゆるく引く）
      const tx = target[0] - x, ty = target[1] - y, tz = target[2] - z, td = Math.hypot(tx, ty, tz) + 1e-3, tw = 0.5 + 0.06 * td;
      fx += (tx / td) * tw * 2.2; fy += (ty / td) * tw * 1.6; fz += (tz / td) * tw * 2.2;
      fy += y < 1.6 ? (1.6 - y) * 4 : 0;
      acc[i * 3] = fx; acc[i * 3 + 1] = fy; acc[i * 3 + 2] = fz;
    }
    for (let i = 0; i < n; i++) {
      let vx = vel[i * 3] + acc[i * 3] * dt, vy = (vel[i * 3 + 1] + acc[i * 3 + 1] * dt) * 0.985, vz = vel[i * 3 + 2] + acc[i * 3 + 2] * dt;
      const sp = Math.hypot(vx, vy, vz) + 1e-6, s = clamp(sp, 3.0, 6.2) / sp;
      vx *= s; vy *= s; vz *= s;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      pos[i * 3] += vx * dt; pos[i * 3 + 1] += vy * dt; pos[i * 3 + 2] += vz * dt;
    }
    this.frame++;
  }
  // frame まで進める。targetFn(k) は k フレーム目の行き先、init は最初の中心と向き
  ensure(frame, targetFn, init) {
    if (this.frame < 0 || frame < this.frame) this.reset(init.center, init.dir);
    while (this.frame < frame) this.step(targetFn(this.frame));
  }
  draw(cam, { time = 0, size = 0.10, col = [0.012, 0.012, 0.018, 0.92], fog = [0.5, 0.45, 0.45], flip = false, waterY = -0.02, blur = 2 } = {}) {
    const g = this.g;
    this.mesh.update('pos', this.pos); this.mesh.update('vel', this.vel);
    for (let s = 0; s < blur; s++) {      // 2 回ずらして重ね、動きをなめらかに
      g.drawMesh(this.prog, this.mesh, { uRo: cam.ro, uCam: cam.m, uFocal: cam.focal, uTime: time - (s / blur) / 30, uSize: size, uFlip: flip ? 1 : 0, uWaterY: waterY, uSub: (s / blur) / 30, uCol: [col[0], col[1], col[2], col[3] / blur], uFog: fog }, 'premul');
    }
  }
}
