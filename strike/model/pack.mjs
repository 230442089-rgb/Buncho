// pack.mjs — モデルを組み立てて、1 つのバイナリに詰める。
//   モデル = 骨（関節）+ 材質 + 部品。部品ごとに距離の場を網目にし、頂点に
//   「材質（最大 3 つ）と境目の場」「陰（まわりに物が近いほど暗い）」「どの骨にどれだけ従うか」を焼き込む。
//   同じ形をくり返し使う部品（羽根の板・左右対称の腕など）は 1 回だけ保存し、置き場所を並べる。
import { surfaceNets } from './mesh.mjs';
import { union, move, flipX, I3, app3, V } from './sdf.mjs';

const { min, max, round, abs } = Math;
const clamp = (x, a, b) => min(b, max(a, x));
// 左右を入れかえた置き場所（左側に作った物を、右側へ鏡写しに置く）
export const mirrored = (c, bone) => ({ R: c.R ? c.R.map((r, i) => r.map((v, j) => v * (i === 0 ? -1 : 1) * (j === 0 ? -1 : 1))) : undefined, t: c.t ? [-c.t[0], c.t[1], c.t[2]] : undefined, mirror: true, bone });

export class Model {
  constructor(name, o = {}) { this.name = name; this.bones = []; this.bi = {}; this.mats = []; this.mi = {}; this.parts = []; this.o = o; }
  // 骨。pos: 関節の位置（モデルの座標）, R: 休みの向き（省略すれば軸どおり）
  bone(name, parent, pos, R = I3) { this.bi[name] = this.bones.length; this.bones.push({ n: name, p: parent == null ? -1 : this.bi[parent], pos, R }); return name; }
  // 材質。col: '#rrggbb', kind: 質感の種類, あとは描画側が読む値
  mat(name, def) { this.mi[name] = this.mats.length; this.mats.push({ n: name, ...def }); return name; }
  // 部品。o: { h: 網目の細かさ, mat, mask: [[材質, 場の関数（負の側がその材質）, ぼかし幅]], bone: 名前 か (x,y,z) → [[名前, 重み], …],
  //           copies: [{ R, t, mirror, bone }]（置き場所。省略すれば、そのまま 1 つ）, alpha: 半透明, ao: false で陰を焼かない, cast: false で他の部品に陰を落とさない }
  part(name, shape, o) { this.parts.push({ name, shape, ...o }); }

  build(log = () => {}) {
    const bones = this.bones, parts = this.parts;
    // ---- 網目にする
    for (const p of parts) {
      const t0 = Date.now();
      // 形のかわりに { raw: { pos, nor, quads } } を渡すと、その網目をそのまま使う（厚みのない膜など）
      if (p.shape.raw) { const r = p.shape.raw; p.m = { pos: r.pos, nor: r.nor, quads: r.quads, nv: r.pos.length / 3, nq: r.quads.length / 4 }; p.ao = false; p.cast = false; p.h = p.h || 0.05; }
      else p.m = surfaceNets(p.shape, p.h, { bb: p.bb || p.shape.bb });
      if (p.m.nv > 65535) throw new Error(`${this.name}/${p.name}: 頂点が多すぎる（${p.m.nv}）`);
      if (p.m.nv === 0) throw new Error(`${this.name}/${p.name}: 形が空`);
      p.copies = p.copies || [{}];
      log(`  ${p.name.padEnd(14)} ${String(p.m.nv).padStart(6)} 頂点 ${String(p.m.nq).padStart(6)} 面 ×${p.copies.length}  ${Date.now() - t0} ms`);
    }
    // ---- 陰のための、モデル全体の形（置いたあとの姿）
    const placed = [];
    for (const p of parts) if (p.cast !== false && !p.alpha) for (const c of p.copies) { let s = p.shape; if (c.mirror) s = flipX(s); if (c.R || c.t) s = move(s, { R: c.R || null, t: c.t || [0, 0, 0] }); placed.push(s); }
    const whole = union(placed), aoR = this.o.aoR || 0.4;
    // ---- 頂点の属性
    let vbytes = 0, qbytes = 0;
    for (const p of parts) {
      const { pos, nor, nv } = p.m, c0 = p.copies[0], bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
      for (let v = 0; v < nv; v++) for (let i = 0; i < 3; i++) { bb[i] = min(bb[i], pos[v * 3 + i]); bb[i + 3] = max(bb[i + 3], pos[v * 3 + i]); }
      const size = [0, 1, 2].map((i) => max(1e-6, bb[i + 3] - bb[i])), buf = Buffer.alloc(nv * 20), mask = p.mask || [];
      const A = this.mi[p.mat]; if (A === undefined) throw new Error(`${this.name}/${p.name}: 材質 ${p.mat} がない`);
      const Bm = mask[0] ? this.mi[mask[0][0]] : A, Cm = mask[1] ? this.mi[mask[1][0]] : A;
      if (Bm === undefined || Cm === undefined) throw new Error(`${this.name}/${p.name}: 境目の材質がない`);
      const flags = (mask[0] && mask[0][2] ? 1 : 0) | (mask[1] && mask[1][2] ? 2 : 0);
      const wf = typeof p.bone === 'function' ? p.bone : null, rigid = wf ? -1 : (p.bone ? this.bi[p.bone] : 0);
      if (rigid === undefined) throw new Error(`${this.name}/${p.name}: 骨 ${p.bone} がない`);
      for (let v = 0; v < nv; v++) {
        const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], o = v * 20;
        for (let i = 0; i < 3; i++) buf.writeUInt16LE(clamp(round((pos[v * 3 + i] - bb[i]) / size[i] * 65535), 0, 65535), o + i * 2);
        for (let i = 0; i < 3; i++) buf.writeInt8(clamp(round(nor[v * 3 + i] * 127), -127, 127), o + 6 + i);
        // 陰: 法線の向きへ少しずつ進んで、場の値が進んだ距離より小さければ、近くに何かある
        let ao = 1;
        if (p.ao !== false) {
          let wp = [x, y, z], wn = [nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]];
          if (c0.mirror) { wp[0] = -wp[0]; wn[0] = -wn[0]; }
          if (c0.R) { wp = app3(c0.R, wp); wn = app3(c0.R, wn); }
          if (c0.t) wp = V.add(wp, c0.t);
          let occ = 0, sca = 1;
          for (let i = 0; i < 5; i++) { const t = aoR * (0.07 + 0.93 * i / 4), d = whole.d(wp[0] + wn[0] * t, wp[1] + wn[1] * t, wp[2] + wn[2] * t); occ += max(0, t - d) / aoR * sca; sca *= 0.78; }
          ao = clamp(1 - 1.35 * occ, 0, 1);
        }
        buf.writeUInt8(round(ao * 255), o + 9);
        buf.writeUInt8(A, o + 10); buf.writeUInt8(Bm, o + 11); buf.writeUInt8(Cm, o + 12); buf.writeUInt8(flags, o + 13);
        for (let i = 0; i < 2; i++) { let f = 1; if (mask[i]) { const w = mask[i][2] || p.h * 2.5; f = clamp(mask[i][1](x, y, z) / w, -1, 1); } buf.writeInt8(round(f * 127), o + 14 + i); }
        let b0 = max(0, rigid), b1 = b0, w0 = 1;
        if (wf) {
          const ws = wf(x, y, z).filter((q) => q[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 2);
          if (!ws.length) throw new Error(`${this.name}/${p.name}: 重みがない`);
          b0 = this.bi[ws[0][0]]; b1 = ws[1] ? this.bi[ws[1][0]] : b0; w0 = ws[1] ? ws[0][1] / (ws[0][1] + ws[1][1]) : 1;
          if (b0 === undefined || b1 === undefined) throw new Error(`${this.name}/${p.name}: 骨 ${ws.map((q) => q[0])} がない`);
        }
        buf.writeUInt8(round(w0 * 255), o + 16); buf.writeUInt8(0, o + 17); buf.writeUInt8(b0, o + 18); buf.writeUInt8(b1, o + 19);
      }
      p.vbuf = buf; p.qbuf = Buffer.from(new Uint16Array(p.m.quads).buffer); p.qmin = bb.slice(0, 3); p.qsize = size;
      vbytes += buf.length; qbytes += p.qbuf.length;
    }
    // ---- 見出し
    const swap = (n) => (n.endsWith('R') ? n.slice(0, -1) + 'L' : n.endsWith('L') ? n.slice(0, -1) + 'R' : n);
    const head = {
      name: this.name, ...this.o,
      bones: bones.map((b) => ({ n: b.n, p: b.p, m: [b.R[0][0], b.R[1][0], b.R[2][0], b.R[0][1], b.R[1][1], b.R[2][1], b.R[0][2], b.R[1][2], b.R[2][2], ...b.pos].map((v) => +v.toFixed(5)) })),
      mats: this.mats,
      parts: parts.map((p) => ({
        n: p.name, nv: p.m.nv, nq: p.m.nq, qmin: p.qmin.map((v) => +v.toFixed(5)), qsize: p.qsize.map((v) => +v.toFixed(5)), alpha: p.alpha ? 1 : 0, lod: p.lod || 0,
        copies: p.copies.map((c) => {
          const R = c.R || I3, o = { m: [R[0][0], R[1][0], R[2][0], R[0][1], R[1][1], R[2][1], R[0][2], R[1][2], R[2][2], ...(c.t || [0, 0, 0])].map((v) => +v.toFixed(5)) };
          if (c.mirror) { o.x = 1; o.bm = bones.map((b) => { const k = this.bi[swap(b.n)]; return k === undefined ? this.bi[b.n] : k; }); }
          if (c.bone) { o.b = this.bi[c.bone]; if (o.b === undefined) throw new Error(`${this.name}/${p.name}: 骨 ${c.bone} がない`); }
          return o;
        }),
      })),
    };
    log(`  = ${parts.reduce((a, p) => a + p.m.nv, 0)} 頂点（置いたあと ${parts.reduce((a, p) => a + p.m.nv * p.copies.length, 0)}）, ${((vbytes + qbytes) / 1024).toFixed(0)} KB`);
    return { head, bufs: parts.flatMap((p) => [p.vbuf, p.qbuf]) };
  }
}

// いくつかのモデルを 1 つのファイルに: [見出しの長さ u32][見出し JSON][頂点と面の並び]
export function pack(models) {
  const heads = models.map((m) => m.head), bufs = models.flatMap((m) => m.bufs);
  let json = Buffer.from(JSON.stringify(heads), 'utf8'); const padLen = (4 - (json.length % 4)) % 4;
  json = Buffer.concat([json, Buffer.alloc(padLen, 0x20)]);
  const len = Buffer.alloc(4); len.writeUInt32LE(json.length, 0);
  return Buffer.concat([len, json, ...bufs.map((b) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b))]);
}
