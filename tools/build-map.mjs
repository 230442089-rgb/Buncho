#!/usr/bin/env node
// 地図データ生成スクリプト:Natural Earth(パブリックドメイン)→ src/mapdata.js
//   node tools/build-map.mjs
//
// 日本マップ:10m の海岸線を「種点の最近傍」で 45 地域に分割(tools/japan-regions.mjs)。
// 世界マップ:50m の国ポリゴンを 55 地域にまとめ、大きな国は種点で分割(tools/world-regions.mjs)。
// 出力は決定的(乱数なし)。地域の形を直したいときは種点ファイルを編集して再実行する。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as topojson from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';
import { Delaunay } from 'd3-delaunay';
import polygonClipping from 'polygon-clipping';
import polylabel from 'polylabel';
import { JAPAN_FRAME, JAPAN_REGIONS } from './japan-regions.mjs';
import { WORLD_FRAME, WORLD_REGIONS, WHOLE, PARTIAL, SPLIT, WORLD_KEEP_POINTS } from './world-regions.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'src', 'mapdata.js');
const atlas = f => JSON.parse(fs.readFileSync(path.join(HERE, 'node_modules', 'world-atlas', f), 'utf8'));
const RAD = Math.PI / 180;

const CFG = {
  japan: {
    W: 1000, latRef: 37.5,
    margin: 40,            // 枠の外側にこれだけ余分に陸地を残す(map units)
    minWeight: 0,        // 海岸線の簡略化(Visvalingam の三角形面積・度^2)
    minIslandArea: 2,      // これ未満の島は捨てる(map units^2、1 unit ≒ 1.63km)
    wholeIslandArea: 700,  // これ未満の島は切らずに丸ごと 1 地域へ
    exclaveArea: 45,       // 本体から切れたこれ未満の破片は隣の地域へ付け替える
    rasterScale: 3, adjMinPixels: 6,
  },
  world: {
    W: 2000,
    minWeight: 0.0045,     // 度^2
    minIslandArea: 2.4,    // map units^2
    exclaveAreaDeg2: 1.0,
    rasterScale: 2, adjMinPixels: 3,
  },
};

// 日本マップで小さくても残す島(経度, 緯度)
const JAPAN_KEEP_POINTS = [
  [138.37, 38.02], [133.3, 36.2], [133.0, 36.1], [133.1, 36.08], [129.3, 34.3], [129.35, 34.55], [129.72, 33.78],
  [128.75, 32.7], [129.07, 32.95], [134.85, 34.35], [134.27, 34.5], [130.98, 30.6], [130.52, 30.35], [139.4, 34.74],
  [141.24, 45.18], [141.03, 45.38], [139.47, 42.15], [145.9, 44.1], [146.75, 43.8], [139.52, 34.08], [139.79, 33.11],
  [129.5, 33.3], [129.87, 31.85], [129.72, 31.72],
];

// ───────────────────────── 幾何ヘルパー ─────────────────────────
const ringSignedArea = r => { let a = 0; for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return a / 2; };
const polyArea = p => { let a = Math.abs(ringSignedArea(p[0])); for (let i = 1; i < p.length; i++) a -= Math.abs(ringSignedArea(p[i])); return a; };
const bboxOfRing = r => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, y0, x1, y1]; };
const bboxOfPoly = p => bboxOfRing(p[0]);
const bboxUnion = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
const bboxOfMulti = mp => mp.map(bboxOfPoly).reduce(bboxUnion, [Infinity, Infinity, -Infinity, -Infinity]);
const bboxOverlap = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const inBox = (pt, b) => pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3];
function pointInRing(pt, r) {
  let inside = false; const [px, py] = pt;
  for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const pointInPoly = (pt, p) => pointInRing(pt, p[0]) && !p.slice(1).some(h => pointInRing(pt, h));
function ringCentroid(r) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) { const f = r[j][0] * r[i][1] - r[i][0] * r[j][1]; a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; }
  if (Math.abs(a) < 1e-12) return [r[0][0], r[0][1]];
  return [cx / (3 * a), cy / (3 * a)];
}
const mapPoly = (p, f) => p.map(r => r.map(f));
const rectPoly = (x0, y0, x1, y1) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];

// 種点 → 地域ごとのボロノイ領域(MultiPolygon)
function regionCells(seedList, bounds) {
  for (let i = 0; i < seedList.length; i++) for (let j = i + 1; j < seedList.length; j++) {
    const a = seedList[i], b = seedList[j];
    if (a.region !== b.region && Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1]) < 1e-6) throw new Error(`同じ位置の種点: ${a.region} / ${b.region} @ ${a.p}`);
  }
  // 同一点の重複は取り除く(セルが null になるため)
  const seen = new Set(); const list = seedList.filter(s => { const k = s.p.join(','); if (seen.has(k)) return false; seen.add(k); return true; });
  const vor = Delaunay.from(list.map(s => s.p)).voronoi(bounds);
  const by = new Map();
  list.forEach((s, i) => { const c = vor.cellPolygon(i); if (!c) throw new Error('ボロノイセルなし: ' + JSON.stringify(s)); if (!by.has(s.region)) by.set(s.region, []); by.get(s.region).push([c.map(([x, y]) => [x, y])]); });
  const out = new Map();
  for (const [r, cells] of by) out.set(r, cells.length === 1 ? [cells[0]] : polygonClipping.union(cells[0], ...cells.slice(1)));
  return out;
}

function cutPolygonByCells(poly, cells) {
  const bb = bboxOfPoly(poly), out = [];
  for (const [region, mp] of cells) {
    if (!bboxOverlap(bb, bboxOfMulti(mp))) continue;
    for (const p of polygonClipping.intersection([poly], mp)) out.push({ region, poly: p, area: polyArea(p) });
  }
  return out;
}

// 本体から切り離された小さな破片を、境界を最も長く共有する隣の地域へ付け替える
// mainAreaOf(地域→本体の面積)を渡すと、その地域の本体が別の陸塊にある場合も破片として扱う
function reassignExclaves(pieces, maxArea, q, log, mainAreaOf) {
  const key = v => Math.round(v[0] * q) + ',' + Math.round(v[1] * q);
  for (let guard = 0; guard < 500; guard++) {
    const main = new Map();
    for (const p of pieces) if (!main.has(p.region) || p.area > main.get(p.region).area) main.set(p.region, p);
    const isMain = p => (mainAreaOf ? p.area >= mainAreaOf.get(p.region) - 1e-9 : main.get(p.region) === p);
    const cand = pieces.filter(p => !p.fixed && p.area < maxArea && !isMain(p)).sort((a, b) => a.area - b.area)[0];
    if (!cand) break;
    const ks = new Set(); for (const ring of cand.poly) for (const v of ring) ks.add(key(v));
    const cb = bboxOfPoly(cand.poly); let best = null, bestN = 0;
    for (const o of pieces) {
      if (o === cand || o.region === cand.region || !bboxOverlap(cb, bboxOfPoly(o.poly))) continue;
      const hit = new Set(); for (const ring of o.poly) for (const v of ring) { const k = key(v); if (ks.has(k)) hit.add(k); }
      if (hit.size > bestN) { bestN = hit.size; best = o; }
    }
    if (!best || bestN < 2) { cand.fixed = true; continue; }
    const u = polygonClipping.union([best.poly], [cand.poly]).sort((a, b) => polyArea(b) - polyArea(a));
    if (log) log(`  破片付け替え: ${cand.region} → ${best.region} (面積 ${cand.area.toFixed(2)})`);
    best.poly = u[0]; best.area = polyArea(u[0]);
    for (const extra of u.slice(1)) pieces.push({ region: best.region, poly: extra, area: polyArea(extra), fixed: true });
    pieces.splice(pieces.indexOf(cand), 1);
  }
  return pieces;
}

// 切断で新しくできた頂点が、隣の地域の辺の途中に乗っている(T 字の接点)場合、その辺にも同じ頂点を挿入する。
// これをしないと、丸めたときに境界がわずかにずれて細いすき間・重なりができる。
function insertTJunctions(regionPolys, newVerts, eps) {
  if (!newVerts.length) return 0;
  let inserted = 0;
  for (const polys of regionPolys) for (const poly of polys) for (let ri = 0; ri < poly.length; ri++) {
    const ring = poly[ri], out = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const A = ring[i], B = ring[i + 1]; out.push(A);
      const x0 = Math.min(A[0], B[0]) - eps, x1 = Math.max(A[0], B[0]) + eps, y0 = Math.min(A[1], B[1]) - eps, y1 = Math.max(A[1], B[1]) + eps;
      const dx = B[0] - A[0], dy = B[1] - A[1], len2 = dx * dx + dy * dy; if (!len2) continue;
      const hits = [];
      for (const v of newVerts) {
        if (v[0] < x0 || v[0] > x1 || v[1] < y0 || v[1] > y1) continue;
        if ((v[0] === A[0] && v[1] === A[1]) || (v[0] === B[0] && v[1] === B[1])) continue;
        const t = ((v[0] - A[0]) * dx + (v[1] - A[1]) * dy) / len2; if (t <= 0 || t >= 1) continue;
        const px = A[0] + t * dx, py = A[1] + t * dy;
        if (Math.hypot(px - v[0], py - v[1]) < eps) hits.push([t, v]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      for (const [, v] of hits) { out.push([v[0], v[1]]); inserted++; }
    }
    out.push(ring[ring.length - 1]);
    poly[ri] = out;
  }
  return inserted;
}

// 座標を丸め、重複点・一直線上の点・針状の折り返しを除く。面積がほぼ 0 の輪は null
function cleanRing(ring, dec) {
  const f = 10 ** dec; let out = [];
  for (const [x, y] of ring) { const rx = Math.round(x * f) / f, ry = Math.round(y * f) / f; const l = out[out.length - 1]; if (!l || l[0] !== rx || l[1] !== ry) out.push([rx, ry]); }
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  let changed = true;
  while (changed && out.length >= 3) {
    changed = false;
    for (let i = 0; i < out.length && out.length >= 3; i++) {
      const n = out.length, a = out[(i + n - 1) % n], b = out[i], c = out[(i + 1) % n];
      if ((a[0] === b[0] && a[1] === b[1]) || (a[0] === c[0] && a[1] === c[1])) { out.splice(i, 1); changed = true; i--; }
    }
  }
  if (out.length < 3 || Math.abs(ringSignedArea(out)) < 0.5 / (f * f) * 4) return null;
  return out;
}
const cleanPolys = (polys, dec) => polys.map(p => { const outer = cleanRing(p[0], dec); if (!outer) return null; const np = [outer, ...p.slice(1).map(h => cleanRing(h, dec)).filter(Boolean)]; np.land = p.land; return np; }).filter(Boolean);
const fmt = n => { let s = n.toFixed(1); if (s.endsWith('.0')) s = s.slice(0, -2); return s === '-0' ? '0' : s; };
const polysToPath = polys => polys.map(p => p.map(r => 'M' + r.map(v => fmt(v[0]) + ',' + fmt(v[1])).join(' ') + 'Z').join('')).join('');
const round1 = n => Math.round(n * 10) / 10;

// 地域 id をグリッドに塗り、隣り合う別地域のピクセル対を数える(陸続きの判定)
function rasterAdjacency(regionList, W, H, scale) {
  const gw = Math.ceil(W * scale), gh = Math.ceil(H * scale), grid = new Uint8Array(gw * gh), land = new Uint16Array(gw * gh);
  regionList.forEach(({ polys }, idx) => {
    for (const poly of polys) {
      const landId = poly.land === undefined ? 0 : poly.land + 1;
      const bb = bboxOfPoly(poly);
      const yStart = Math.max(0, Math.ceil(bb[1] * scale - 0.5)), yEnd = Math.min(gh - 1, Math.floor(bb[3] * scale - 0.5));
      for (let py = yStart; py <= yEnd; py++) {
        const yc = (py + 0.5) / scale, xs = [];
        for (const r of poly) for (let i = 0, n = r.length, j = n - 1; i < n; j = i++) {
          const [x0, y0] = r[j], [x1, y1] = r[i];
          if ((y0 <= yc) !== (y1 <= yc)) xs.push(x0 + (yc - y0) * (x1 - x0) / (y1 - y0));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          const pa = Math.max(0, Math.ceil(xs[k] * scale - 0.5)), pb = Math.min(gw - 1, Math.floor(xs[k + 1] * scale - 0.5));
          for (let px = pa; px <= pb; px++) { grid[py * gw + px] = idx + 1; land[py * gw + px] = landId; }
        }
      }
    }
  });
  const counts = new Map();
  const bump = (a, b) => { const k = a < b ? a * 256 + b : b * 256 + a; counts.set(k, (counts.get(k) || 0) + 1); };
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const v = grid[y * gw + x]; if (!v) continue;
    // 別の陸塊どうし(狭い海峡ごし)の接触は数えない
    if (x + 1 < gw) { const r = grid[y * gw + x + 1]; if (r && r !== v && land[y * gw + x] === land[y * gw + x + 1]) bump(v, r); }
    if (y + 1 < gh) { const d = grid[(y + 1) * gw + x]; if (d && d !== v && land[y * gw + x] === land[(y + 1) * gw + x]) bump(v, d); }
  }
  const pairs = [];
  for (const [k, n] of counts) { const a = Math.floor(k / 256) - 1, b = (k % 256) - 1; pairs.push({ a: regionList[a].id, b: regionList[b].id, n }); }
  return pairs;
}

function finishRegion(id, polysProjected, unproject) {
  const polys = cleanPolys(polysProjected, 1).sort((a, b) => polyArea(b) - polyArea(a));
  if (!polys.length) throw new Error('地域が空: ' + id);
  const lab = polylabel(polys[0], 0.25);
  const c = [round1(lab[0]), round1(lab[1])];
  const ll = unproject(c).map(v => Math.round(v * 1000) / 1000);
  const bbox = bboxOfMulti(polys).map(round1);
  const area = Math.round(polys.reduce((s, p) => s + polyArea(p), 0) * 10) / 10;
  return { id, polys, out: { d: polysToPath(polys), c, ll, bbox, area } };
}

// 診断:本体以外のポリゴンで、他地域と境界を共有しているもの(=陸続きの飛び地)を報告する
function reportExclaves(list, label) {
  const owners = new Map();
  const key = v => v[0] + ',' + v[1];
  list.forEach((r, ri) => r.polys.forEach(p => p.forEach(ring => ring.forEach(v => { const k = key(v); if (!owners.has(k)) owners.set(k, new Set()); owners.get(k).add(ri); }))));
  list.forEach((r, ri) => r.polys.slice(1).forEach(p => {
    const others = new Map();
    for (const ring of p) for (const v of ring) for (const o of owners.get(key(v))) if (o !== ri) others.set(o, (others.get(o) || 0) + 1);
    const touching = [...others].filter(([, n]) => n >= 2).map(([o]) => list[o].id);
    if (touching.length) console.log(`  [${label}] 陸続きの飛び地: ${r.id} 面積 ${polyArea(p).toFixed(1)} @ ${ringCentroid(p[0]).map(v => v.toFixed(0)).join(',')} ← ${touching.join(', ')}`);
  }));
}

function adjacencyFrom(list, W, H, scale, minPixels, label) {
  reportExclaves(list, label);
  const pairs = rasterAdjacency(list, W, H, scale).sort((x, y) => (x.a + x.b < y.a + y.b ? -1 : 1));
  const adj = [];
  for (const p of pairs) {
    const pair = [p.a, p.b].sort();
    if (p.n >= minPixels) adj.push(pair); else console.log(`  [${label}] 境界が短すぎるため隣接から除外: ${pair.join(' - ')} (${p.n}px)`);
  }
  adj.sort((x, y) => (x[0] === y[0] ? (x[1] < y[1] ? -1 : 1) : (x[0] < y[0] ? -1 : 1)));
  return { adj, pairs };
}

// ───────────────────────── 日本マップ ─────────────────────────
function buildJapan() {
  const C = CFG.japan, F = JAPAN_FRAME;
  const kx = C.W / (F.lonMax - F.lonMin), ky = kx / Math.cos(C.latRef * RAD);
  const W = C.W, H = Math.ceil((F.latMax - F.latMin) * ky);
  const P = ([lon, lat]) => [(lon - F.lonMin) * kx, (F.latMax - lat) * ky];
  const U = ([x, y]) => [x / kx + F.lonMin, F.latMax - y / ky];
  const topo = simplify(presimplify(atlas('countries-10m.json')), C.minWeight);
  const G = name => topo.objects.countries.geometries.filter(g => g.properties.name === name);
  const polysOf = geom => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates);
  const clip = rectPoly(-C.margin, -C.margin, W + C.margin, H + C.margin), clipBB = [-C.margin, -C.margin, W + C.margin, H + C.margin];
  const clipToFrame = polys => {
    const out = [];
    for (const p of polys) {
      const bb = bboxOfPoly(p);
      if (!bboxOverlap(bb, clipBB)) continue;
      if (bb[0] >= clipBB[0] && bb[1] >= clipBB[1] && bb[2] <= clipBB[2] && bb[3] <= clipBB[3]) out.push(p);
      else out.push(...polygonClipping.intersection([p], [clip]));
    }
    return out;
  };
  const keepPts = JAPAN_KEEP_POINTS.map(P);
  const dropSmall = polys => polys.filter(p => polyArea(p) >= C.minIslandArea || keepPts.some(k => pointInPoly(k, p)));

  // 日本の陸地(+北方四島は蝦夷地に含める)、それ以外は飾りの陸地
  let land = polysOf(topojson.feature(topo, G('Japan')[0]).geometry).map(p => mapPoly(p, P));
  const foreign = polysOf(topojson.merge(topo, [...G('Russia'), ...G('China'), ...G('North Korea'), ...G('South Korea')])).map(p => mapPoly(p, P));
  const ntBox = [...P([145.3, 45.7]), ...P([149.5, 43.3])];
  const deco = [];
  for (const p of foreign) {
    const bb = bboxOfPoly(p);
    if (!bboxOverlap(bb, clipBB)) continue;
    if (inBox(ringCentroid(p[0]), ntBox) && polyArea(p) < 3000) land.push(p); else deco.push(p);
  }
  land = dropSmall(clipToFrame(land));
  const decoPolys = clipToFrame(deco).filter(p => polyArea(p) >= C.minIslandArea);

  // 種点 → 地域セル
  const seeds = []; JAPAN_REGIONS.forEach(r => r.seeds.forEach(s => seeds.push({ p: P(s), region: r.id })));
  const cells = regionCells(seeds, [-4000, -4000, 5000, 5000]);
  const nearest = pt => { let best = null, bd = Infinity; for (const s of seeds) { const d = (s.p[0] - pt[0]) ** 2 + (s.p[1] - pt[1]) ** 2; if (d < bd) { bd = d; best = s; } } return best.region; };

  // 大きな陸塊は地域セルで切り、小さな島は丸ごと最寄りの種点の地域へ
  const groups = land.map((L, li) => (polyArea(L) < C.wholeIslandArea
    ? [{ region: nearest(polylabel(L, 0.5)), poly: L, area: polyArea(L), fixed: true }]
    : cutPolygonByCells(L, cells)).map(pc => Object.assign(pc, { land: li })));
  const mainAreaOf = new Map();
  for (const g of groups) for (const pc of g) mainAreaOf.set(pc.region, Math.max(mainAreaOf.get(pc.region) || 0, pc.area));
  const byRegion = new Map(JAPAN_REGIONS.map(r => [r.id, []]));
  groups.forEach((g, li) => {
    for (const pc of reassignExclaves(g, C.exclaveArea, 1e4, s => console.log('[japan]' + s), mainAreaOf)) { pc.poly.land = li; byRegion.get(pc.region).push(pc.poly); }
  });

  const list = JAPAN_REGIONS.map(r => finishRegion(r.id, byRegion.get(r.id), U));
  const { adj } = adjacencyFrom(list, W, H, C.rasterScale, C.adjMinPixels, 'japan');

  // 琵琶湖(手描きの概形)
  const biwa = [[135.865, 35.005], [135.905, 34.975], [135.93, 35.03], [135.955, 35.075], [135.94, 35.115], [135.985, 35.14],
    [136.035, 35.16], [136.08, 35.19], [136.13, 35.215], [136.17, 35.245], [136.215, 35.27], [136.245, 35.3], [136.265, 35.34],
    [136.265, 35.385], [136.24, 35.43], [136.215, 35.46], [136.185, 35.495], [136.155, 35.515], [136.115, 35.49],
    [136.095, 35.455], [136.065, 35.44], [136.04, 35.41], [136.045, 35.36], [136.065, 35.325], [136.03, 35.29],
    [136.005, 35.25], [135.955, 35.2], [135.93, 35.16], [135.915, 35.125], [135.9, 35.08], [135.885, 35.04]];
  const lakes = polysToPath(cleanPolys([[biwa.map(P)]], 1));

  const regions = {}; for (const r of list) regions[r.id] = r.out;
  return {
    w: W, h: H,
    proj: { lon0: F.lonMin, lat0: F.latMax, kx: Math.round(kx * 1e5) / 1e5, ky: Math.round(ky * 1e5) / 1e5 },
    regions, deco: polysToPath(cleanPolys(decoPolys, 1)), lakes, adj,
  };
}

// ───────────────────────── 世界マップ ─────────────────────────
function buildWorld() {
  const C = CFG.world, F = WORLD_FRAME, W = C.W;
  const millerY = lat => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * RAD));
  const k = W / (2 * Math.PI), yTop = millerY(F.latMax) * k, H = Math.ceil(yTop - millerY(F.latMin) * k);
  const P = ([lon, lat]) => [(lon - F.lonMin) * (W / 360), yTop - millerY(lat) * k];
  const U = ([x, y]) => { const l = x * 360 / W + F.lonMin; return [l > 180 ? l - 360 : l, (2.5 * Math.atan(Math.exp(0.8 * (yTop - y) / k)) - 0.625 * Math.PI) / RAD]; };
  const shiftLon = lon => { let l = lon < F.lonMin ? lon + 360 : lon; if (Math.abs(l - 180) < 1e-7) l = 180; return l; };
  const shiftPoly = p => mapPoly(p, ([x, y]) => [shiftLon(x), y]);

  const topo = simplify(presimplify(atlas('countries-50m.json')), C.minWeight);
  const geoms = topo.objects.countries.geometries;
  const names = new Set(geoms.map(g => g.properties.name));
  const regionIds = WORLD_REGIONS.map(r => r[0]);
  const wholeOf = new Map(); for (const [rid, list] of Object.entries(WHOLE)) for (const n of list) { if (!names.has(n)) throw new Error('国名が見つからない: ' + n); wholeOf.set(n, rid); }
  for (const n of [...Object.keys(PARTIAL), ...Object.keys(SPLIT)]) if (!names.has(n)) throw new Error('国名が見つからない: ' + n);

  const regionArcs = new Map(regionIds.map(id => [id, []]));
  const pieces = [];   // 種点で切った破片 {region, poly(lon',lat)}
  const newVerts = [], newVertKeys = new Set();   // 切断でできた新しい頂点
  const dropped = [];
  const matchRule = (rules, c) => { for (const r of rules || []) if (inBox(c, r.box)) return r; return null; };

  for (const g of geoms) {
    const name = g.properties.name;
    if (name === 'Greenland' || name === 'Antarctica') continue;
    const polyArcs = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    if (wholeOf.has(name)) { regionArcs.get(wholeOf.get(name)).push(...polyArcs); continue; }
    const coordsOf = arcs => shiftPoly(topojson.feature(topo, { type: 'Polygon', arcs }).geometry.coordinates);
    if (PARTIAL[name]) {
      const spec = PARTIAL[name];
      for (const arcs of polyArcs) {
        const rule = matchRule(spec.rules, ringCentroid(coordsOf(arcs)[0]));
        const region = rule ? rule.region : spec.default;
        if (region) regionArcs.get(region).push(arcs);
      }
      continue;
    }
    if (SPLIT[name]) {
      const spec = SPLIT[name], s = Math.cos(spec.latScale * RAD);
      const seeds = []; for (const [region, pts] of Object.entries(spec.seeds)) for (const [lon, lat] of pts) seeds.push({ region, ll: [shiftLon(lon), lat], p: [shiftLon(lon) * s, lat] });
      const nearest = pt => { let best = null, bd = Infinity; for (const sd of seeds) { const d = ((sd.ll[0] - pt[0]) * s) ** 2 + (sd.ll[1] - pt[1]) ** 2; if (d < bd) { bd = d; best = sd; } } return best.region; };
      const polys = polyArcs.map(arcs => { const coords = coordsOf(arcs); return { arcs, coords, area: polyArea(coords) }; });
      const largest = polys.reduce((a, b) => (b.area > a.area ? b : a));
      for (const pl of polys) {
        const c = ringCentroid(pl.coords[0]);
        const rule = matchRule(spec.pre, c);
        if (rule) { if (rule.region) regionArcs.get(rule.region).push(pl.arcs); continue; }
        if (pl === largest && spec.cut.length) {
          const cutSeeds = seeds.filter(sd => spec.cut.includes(sd.region));
          const cellsScaled = regionCells(cutSeeds, [-300, -120, 600, 120]);
          const cells = new Map(); for (const [r, mp] of cellsScaled) cells.set(r, mp.map(p => mapPoly(p, ([x, y]) => [x / s, y])));
          const pcs = reassignExclaves(cutPolygonByCells(pl.coords, cells), C.exclaveAreaDeg2, 1e6, m => console.log(`[world:${name}]` + m));
          const orig = new Set(); for (const ring of pl.coords) for (const v of ring) orig.add(v[0] + ',' + v[1]);
          for (const pc of pcs) {
            pieces.push({ region: pc.region, poly: pc.poly });
            for (const ring of pc.poly) for (const v of ring) { const k = v[0] + ',' + v[1]; if (!orig.has(k) && !newVertKeys.has(k)) { newVertKeys.add(k); newVerts.push(v); } }
          }
        } else {
          regionArcs.get(nearest(c)).push(pl.arcs);
        }
      }
      continue;
    }
    dropped.push(name);
  }

  const frame = rectPoly(F.lonMin, F.latMin, F.lonMax, F.latMax), frameBB = [F.lonMin, F.latMin, F.lonMax, F.latMax];
  const clipToFrame = polys => {
    const bb = bboxOfMulti(polys);
    if (bb[0] >= frameBB[0] && bb[1] >= frameBB[1] && bb[2] <= frameBB[2] && bb[3] <= frameBB[3]) return polys;
    return polygonClipping.intersection(polys, [frame]);
  };
  const keepPts = WORLD_KEEP_POINTS.map(([lon, lat]) => P([shiftLon(lon), lat]));

  const assembled = regionIds.map(id => {
    const arcs = regionArcs.get(id);
    let polys = arcs.length ? topojson.merge(topo, [{ type: 'MultiPolygon', arcs }]).coordinates.map(shiftPoly) : [];
    const pcs = pieces.filter(p => p.region === id).map(p => p.poly);
    const touchesSeam = polys.some(p => p[0].some(v => v[0] === 180));
    if (pcs.length || touchesSeam) {
      const all = [...polys.map(p => p), ...pcs];
      polys = polygonClipping.union(all[0], ...all.slice(1));
    }
    if (!polys.length) throw new Error('地域が空: ' + id);
    return polys;
  });
  const nT = insertTJunctions(assembled, newVerts, 1e-9);
  console.log(`[world] T 字接点の頂点を ${nT} 個挿入`);
  const list = regionIds.map((id, i) => {
    let polys = clipToFrame(assembled[i]).map(p => mapPoly(p, P));
    polys = polys.filter(p => polyArea(p) >= C.minIslandArea || keepPts.some(kp => pointInPoly(kp, p)));
    return finishRegion(id, polys, U);
  });
  const { adj } = adjacencyFrom(list, W, H, C.rasterScale, C.adjMinPixels, 'world');

  // 飾り:グリーンランド(地図の左右両端に分かれて出る)
  const gl = geoms.find(g => g.properties.name === 'Greenland');
  const glPolys = (gl.type === 'Polygon' ? [gl.arcs] : gl.arcs).map(arcs => topojson.feature(topo, { type: 'Polygon', arcs }).geometry.coordinates);
  const decoLL = [
    ...polygonClipping.intersection(glPolys.map(p => mapPoly(p, ([x, y]) => [x + 360, y])), [frame]),
    ...polygonClipping.intersection(glPolys, [frame]),
  ];
  const decoPolys = decoLL.map(p => mapPoly(p, P)).filter(p => polyArea(p) >= C.minIslandArea);

  const regions = {}; for (const r of list) regions[r.id] = r.out;
  console.log('[world] 地域に入れなかった国・地域: ' + dropped.join(', '));
  return {
    w: W, h: H,
    proj: { type: 'miller', lonCenter: F.lonCenter, lonMin: F.lonMin, latMax: F.latMax, latMin: F.latMin, k: Math.round(k * 1e5) / 1e5, yTop: Math.round(yTop * 1e4) / 1e4 },
    regions, deco: polysToPath(cleanPolys(decoPolys, 1)), adj,
  };
}

// ───────────────────────── 出力 ─────────────────────────
function emitMap(m, extraKeys) {
  const lines = [];
  lines.push(`    w: ${m.w}, h: ${m.h},`);
  lines.push(`    proj: ${JSON.stringify(m.proj)},`);
  lines.push('    regions: {');
  const ids = Object.keys(m.regions);
  ids.forEach((id, i) => lines.push(`      ${JSON.stringify(id)}: ${JSON.stringify(m.regions[id])}${i < ids.length - 1 ? ',' : ''}`));
  lines.push('    },');
  for (const k of extraKeys) lines.push(`    ${k}: ${JSON.stringify(m[k])},`);
  lines.push(`    adj: ${JSON.stringify(m.adj)}`);
  return lines.join('\n');
}

const t0 = Date.now();
const japan = buildJapan();
const world = buildWorld();
const src = `// 自動生成ファイル — 手で編集しない。再生成: node tools/build-map.mjs
// 元データ: Natural Earth(パブリックドメイン, naturalearthdata.com)。world-atlas (npm) 経由。
// 座標は各マップの viewBox(0 0 w h)単位。パスは絶対座標・小数 1 桁。穴は外周と逆回りなので fill-rule はどちらでもよい。
//   japan.proj : x = (lon - lon0) * kx,  y = (lat0 - lat) * ky                      (1 unit ≒ 1.63 km)
//   world.proj : ミラー図法・中央経線 150°E。lon' = lon < lonMin ? lon + 360 : lon として
//                x = (lon' - lonMin) * (w / 360),  y = yTop - k * 1.25 * ln(tan(π/4 + 0.4 * lat * π/180))
// regions[id] = { d: SVG パス, c: ラベル位置 [x,y], ll: その経緯度 [lon,lat], bbox: [x0,y0,x1,y1], area: 面積 }
// adj = 陸続きの隣接(id の昇順ペア)。海路は含まない。
(function(root){ var MAPDATA = {
  japan: {
${emitMap(japan, ['deco', 'lakes'])}
  },
  world: {
${emitMap(world, ['deco'])}
  }
}; root.MAPDATA = MAPDATA; if (typeof module !== 'undefined' && module.exports) module.exports = MAPDATA; })(typeof window !== 'undefined' ? window : globalThis);
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, src);

const size = m => Object.values(m.regions).reduce((s, r) => s + r.d.length, 0) + m.deco.length + (m.lakes ? m.lakes.length : 0);
console.log(`japan: ${japan.w}x${japan.h}, ${Object.keys(japan.regions).length} 地域, パス ${(size(japan) / 1024).toFixed(1)} KB, 隣接 ${japan.adj.length}`);
console.log(`world: ${world.w}x${world.h}, ${Object.keys(world.regions).length} 地域, パス ${(size(world) / 1024).toFixed(1)} KB, 隣接 ${world.adj.length}`);
console.log(`→ ${path.relative(process.cwd(), OUT)} ${(src.length / 1024).toFixed(1)} KB (${Date.now() - t0} ms)`);
