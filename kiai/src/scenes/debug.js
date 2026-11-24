// debug.js — 姿勢の確認用（?dbg を付けたときだけ使う）
import { W, H, DURATION } from '../core.js';
import { Stage, CAM0 } from '../stage.js';
import { POSE } from '../figure.js';
export const id = 'debug';
export async function create(env) {
  if (!env.q.has('dbg')) return [];
  const stage = new Stage(env), names = Object.keys(POSE);
  return [{ id: 'debug', t0: 0, t1: DURATION, z: 99, render(env, tl, t) {
    const i = Math.floor(t) % names.length, mode = Math.floor(t / names.length) % 3;
    const zoom = env.q.get('dbg') === 'close';
    stage.draw({ t, cam: zoom ? { s: 2.4, fx: 760, fy: 520 } : CAM0, gx: 760, pose: POSE[names[i]], look: { helmet: mode === 0 ? 1 : 0, tatter: mode === 2 ? 1 : 0, eye: mode ? 1 : 0, hair: mode === 2 ? 1 : 0 },
      amb: mode === 0 ? 0.85 : 0.3, lamp: mode === 0 ? 1 : 0, blue: mode === 0 ? 0 : 1, alarm: mode === 1 ? 1 : 0, aura: mode === 2 ? 1 : 0, blood: mode === 2 ? 0.8 : 0, clip: names[i] === 'work' });
    env.p.bloom = 0.5; env.p.vignette = 0.5;
  } }];
}
