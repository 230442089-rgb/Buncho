// solid.js — 3 章「立体」
// 紙の模様が立ち上がってレリーフになり、山へと育ち、空と水が現れる。夜明け前の湖を飛ぶ。
import { bar, BEAT, W, H, sat, smoothstep, ease, lerp, TAU, clamp, v3 } from '../core.js';
import { chapter, equation } from '../overlay.js';
import { getWorld } from '../world.js';
import { RD_FRAMES } from './plane.js';

const B10 = bar(10), B12 = bar(12), B14 = bar(14), B18 = bar(18);
export const SUN_AZ = -0.22;      // 日の出の方角（+z から左へ）
export const sunDir = (elev, az = SUN_AZ) => [Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)];
export const valleyX = (z) => 3.4 * Math.sin(z * 0.105 + 0.5) + 1.5 * Math.sin(z * 0.23 + 2.1);
// 谷に沿った飛行経路（なめらかにした中心線）
export const pathX = (z) => 0.25 * (valleyX(z - 3) + valleyX(z - 1) + valleyX(z + 1) + valleyX(z + 3)) * 0.82;

// 対岸の稜線の高さ（太陽の方角で）。create() で地形から測る
export const RIDGE = { e: 0.12 };

// 時刻 tt（章の頭から）でのカメラと世界の状態
export function solidState(tt) {
  const o = {};
  // ---- 位置: 真上 → 低い位置 → 谷に沿って前へ
  const zA = lerp(-6.4, -1.5, smoothstep(0.6, 6.6, tt));                               // レリーフの上をゆっくり進む
  const zB = -1.5 + 0.95 * Math.max(0, tt - 6.6) + 0.5 * 0.062 * Math.pow(Math.max(0, tt - 6.6), 2);   // 加速しながら谷へ
  const z = tt < 6.6 ? zA : zB;
  const low = [lerp(-2.6, pathX(z), smoothstep(4.5, 11.0, tt)), lerp(1.65, 1.25, smoothstep(2.0, 6.6, tt)) + 0.55 * smoothstep(7.0, 12.0, tt) - 0.5 * smoothstep(14.0, 24.0, tt), z];
  const k = ease.inOutCubic(sat(tt / 3.1));
  o.ro = [lerp(0, low[0], k), lerp(10.8, low[1], Math.pow(k, 0.8)), lerp(0, low[2], k)];
  // ---- 向き
  const zl = z + 7.0;
  const fl = v3.norm([pathX(zl) * smoothstep(4.5, 11.0, tt) - o.ro[0] + lerp(1.2, 0, smoothstep(4.5, 11, tt)), lerp(-1.9, -0.55, smoothstep(2.0, 12.0, tt)) + 0.35 * smoothstep(14, 26, tt), 7.0]);
  const kf = ease.inOutCubic(sat((tt - 0.15) / 2.9));
  o.f = v3.norm(v3.lerp([0, -1, 0.0001], fl, kf));
  o.up = v3.norm(v3.lerp([0, 0, 1], [0, 1, 0], smoothstep(0.2, 0.9, kf)));
  o.focal = 1.2;
  // ---- かたちと光
  o.flat = 1 - smoothstep(0.0, 0.45, tt);
  o.relief = ease.outCubic(sat(tt / 1.5));
  o.ink = 1 - smoothstep(0.5, 2.6, tt);
  o.morph = ease.inOutSine(sat((tt - 6.62) / 5.2));
  o.world = smoothstep(9.6, 12.6, tt);
  o.waterY = lerp(-0.7, -0.02, smoothstep(0.55, 1.0, o.morph));
  o.key = [-0.62, lerp(0.34, 0.46, sat(tt / 8)), 0.67];
  // ---- 夜明け前: 太陽は地平線の下から少しずつ上がってくる
  // 見かけの高度 palE は地平線の下から上がってくる。実際の太陽は対岸の稜線のすぐ下まで来ている（次の章の頭で顔を出す）。
  const up = Math.pow(sat((tt - 9.6) / (26.48 - 9.6)), 0.78);
  o.palE = lerp(-0.25, -0.02, up);
  o.sun = sunDir(lerp(-0.25, RIDGE.e - 0.014, up));
  o.time = tt; o.cloudT = tt * 0.012; o.cover = 0.46; o.starRot = 0.2 + tt * 0.004;
  o.exposure = 1.0;
  o.mist = smoothstep(11, 16, tt); o.fog = 1.0; o.snow = 2.3;
  return o;
}


export const SOLID_LEN = B18 - B10;

export const id = 'solid';
export async function create(env) {
  const { g, ov } = env;
  const world = getWorld(env);
  { const s = solidState(B18 - B10 - 1e-4); RIDGE.e = world.skyline(s.ro, SUN_AZ); }

  chapter(ov, { n: 3, kanji: '立体', en: 'SOLID', line: '面が動くと、立体になる。', t0: B10 + 1.0, t1: B18, lineHold: 3.4, lineDelay: 0.5 });
  equation(ov, { src: ['\\mathbf{p}(t)=\\mathbf{o}+t\\,\\mathbf{d}', 'L_o=L_e+\\displaystyle\\int_{\\Omega} f_r\\,L_i\\,(\\mathbf{n}\\cdot\\boldsymbol{\\omega})\\,d\\omega'], t0: B12 + 0.4, t1: B14 + 2.0, right: 96, y: 78, size: 24 });

  return {
    id: 'solid', t0: B10, t1: B18,
    render(env, tl, t) {
      const p = env.p, tt = t - B10;
      world.rd.ensure(RD_FRAMES);
      const o = solidState(tt);
      // 地面に潜らないよう、地形の高さより上に保つ
      const ground = world.heightAt(o.ro[0], o.ro[2]) * o.morph;
      o.ro[1] = Math.max(o.ro[1], Math.max(ground, o.waterY) + 0.42);
      if (env.q.has('map')) { world.map(env, o.ro, [o.f[0], o.f[2]]); return; }
      world.render(env, o);
      const w = o.world;
      p.bloom = lerp(0.28, 0.5, w); p.threshold = lerp(0.9, 0.8, w); p.vignette = lerp(0.42, 0.5, w); p.ca = 0.006;
      p.scrim = 0.72 * smoothstep(0.8, 2.0, tt) * (1 - smoothstep(5.2, 6.6, tt));
      p.flash = 0.0;
    },
  };
}
