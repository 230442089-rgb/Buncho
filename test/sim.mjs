// ヘッドレスの通しプレイ。簡単なボットに最後まで遊ばせて、例外・不整合・詰みがないかと、展開の速さを確かめる。
//   node test/sim.mjs [難易度=normal] [試行回数=3] [最大ターン=400] [-v]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const MAP = require('../src/mapdata.js');
const D = require('../src/data.js');
const E = require('../src/engine.js');
E.init(MAP);

const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
const VERBOSE = process.argv.includes('-v');
const DIFF = args[0] || 'normal';
const RUNS = +(args[1] || 3);
const MAXT = +(args[2] || 400);

function assertState(tag) {
  const S = E.S;
  for (const k of Object.keys(S.res)) {
    if (!Number.isFinite(S.res[k]) || S.res[k] < 0) throw new Error(`${tag}: 資源 ${k} が不正 ${S.res[k]}`);
  }
  for (const u of S.units) {
    const T = D.UNIT_TYPES[u.type];
    if (!T) throw new Error(`${tag}: 未知の部隊 ${u.type}`);
    if (T.cls === 'ground' || T.cls === 'heli') {
      if (!u.loc || !S.regions[u.loc]) throw new Error(`${tag}: ${u.name} の位置が不正 ${u.loc}`);
      if (S.regions[u.loc].o !== 'player') throw new Error(`${tag}: ${u.name} が敵地 ${u.loc} にいる`);
    } else if (u.loc !== null) throw new Error(`${tag}: ${u.name} はプール部隊なのに位置がある`);
    if (!(u.hp > 0 && u.hp <= 100)) throw new Error(`${tag}: ${u.name} の兵力が不正 ${u.hp}`);
  }
  for (const [id, r] of Object.entries(S.regions)) {
    if (!Number.isFinite(r.g) || r.g < 0) throw new Error(`${tag}: ${id} の守備兵が不正 ${r.g}`);
    if (r.o !== 'player' && !S.factions[r.o]) throw new Error(`${tag}: ${id} の持ち主が不正 ${r.o}`);
    if (r.o !== 'player' && !S.factions[r.o].alive) throw new Error(`${tag}: ${id} の持ち主 ${r.o} は滅亡済み`);
  }
  if (!Number.isFinite(S.prestige)) throw new Error(`${tag}: 威信が不正`);
}

function frontier() { // 敵地と接している自領
  return E.playerRegions().filter(id => E.links(id).some(l => !E.isP(l.id)));
}
function distToFrontier() {
  const dist = {}, q = [];
  for (const id of frontier()) { dist[id] = 0; q.push(id); }
  while (q.length) {
    const cur = q.shift();
    for (const l of E.links(cur)) if (E.isP(l.id) && dist[l.id] == null) { dist[l.id] = dist[cur] + 1; q.push(l.id); }
  }
  return dist;
}

function planAttack(tid, minChance) {
  const r = E.suggestAttack(tid, minChance);
  return r.ok ? r : null;
}

function botTurn(log) {
  const S = E.S;
  // ── 外交 ──
  for (const fid of Object.keys(S.factions)) {
    const f = S.factions[fid];
    if (!f.alive || S.dipLeft <= 0 || !E.inContact(fid)) continue;
    const opts = E.diploOptions(fid);
    const sub = opts.find(o => o.key === 'submit');
    if (sub && sub.ok && sub.chance >= 45) { const r = E.diplo(fid, 'submit'); if (r.ok) log(`  降伏: ${E.fname(fid)} (${sub.chance}%)`); continue; }
    const show = opts.find(o => o.key === 'show');
    if (sub && sub.chance >= 28 && sub.chance < 45 && show && show.ok && S.res.fuel > 250) { E.diplo(fid, 'show'); continue; }
    const pact = opts.find(o => o.key === 'pact');
    if (f.war && pact && pact.ok && pact.chance >= 50 && E.factionPower(fid) > E.playerPower() * 0.5) E.diplo(fid, 'pact');
  }
  // ── 内政 ──
  const mine = E.playerRegions();
  const arsenals = mine.filter(id => S.regions[id].fac.arsenal || (S.regions[id].b && S.regions[id].b.k === 'arsenal')).length;
  const yards = mine.filter(id => S.regions[id].fac.shipyard || (S.regions[id].b && S.regions[id].b.k === 'shipyard')).length;
  const schools = mine.filter(id => S.regions[id].fac.school || (S.regions[id].b && S.regions[id].b.k === 'school')).length;
  let nArs = arsenals, nYard = yards, nSchool = schools;
  for (const id of mine) {
    const r = S.regions[id]; if (r.b) continue;
    const bo = Object.fromEntries(E.buildOptions(id).map(o => [o.key, o]));
    const want = [];
    if (bo.oilwell) want.push('oilwell');
    if (bo.mine && bo.mine.amount >= 2) want.push('mine');
    if (bo.ironmine) want.push('ironmine');
    if (bo.coalmine) want.push('coalmine');
    if (bo.bauxite) want.push('bauxite');
    if (bo.arsenal && nArs < Math.max(1, Math.floor(mine.length / 6)) && D.REGIONS[id].koku >= 30) want.push('arsenal');
    if (bo.shipyard && nYard < 2 && D.REGIONS[id].koku >= 20) want.push('shipyard');
    if (bo.school && nSchool < Math.max(1, Math.floor(mine.length / 3)) && S.res.gold > 250) want.push('school');
    if (bo.market && D.REGIONS[id].koku >= 40 && S.res.gold > 200) want.push('market');
    if (bo.farm && D.REGIONS[id].koku >= 40 && S.res.gold > 200 && S.res.food < 2000) want.push('farm');
    for (const k of want) {
      if (bo[k] && bo[k].ok) {
        const res = E.build(id, k);
        if (res.ok) { if (k === 'arsenal') nArs++; if (k === 'shipyard') nYard++; if (k === 'school') nSchool++; log(`  建設: ${E.rname(id)} ${D.FACILITIES[k].name}`); break; }
      }
    }
  }
  // 脅威への備え
  for (const t of S.threats) {
    const from = S.regions[t.from];
    const A = from.g * 0.7 / E.MEN * (S.factions[t.f].q) * D.DIFFICULTY[S.diff].enemy * 1.15;
    let guard = 0;
    while (E.defensePower(t.to) < A * 1.1 && guard++ < 30) { const r = E.recruit(t.to, 1000); if (!r.ok) break; }
  }
  // 国境の最低限の守り
  for (const id of frontier()) {
    const r = S.regions[id];
    if (r.g < 2000 && S.res.gold > 150) E.recruit(id, 1000);
  }
  // ── 編成 ──
  const groundN = S.units.filter(u => D.UNIT_TYPES[u.type].cls === 'ground').length;
  const navalT = S.units.filter(u => (D.UNIT_TYPES[u.type].transport || 0) > 0).length;
  for (const id of mine) {
    const r = S.regions[id]; if (r.p) continue;
    const po = Object.fromEntries(E.produceOptions(id).map(o => [o.type, o]));
    const order = ['modern', 'ktank', 'kair', 'bb', 'fgun'];
    if (navalT < 4) order.unshift('ironclad');
    let done = false;
    for (const t of order) { if (po[t] && po[t].ok && S.res.gold > po[t].cost.gold + 150) { E.produce(id, t); log(`  編成: ${E.rname(id)} ${D.UNIT_TYPES[t].name}`); done = true; break; } }
    if (!done && po.ashi && po.ashi.ok && S.res.gold > 260 && S.res.food > 300 && D.REGIONS[id].koku >= 30 && frontier().includes(id)) { E.produce(id, 'ashi'); }
  }
  // ── 攻撃 ──
  const oilOwned = mine.some(id => D.REGIONS[id].res.oil);
  const targets = new Set();
  for (const id of frontier()) for (const l of E.links(id)) if (!E.isP(l.id)) targets.add(l.id);
  const list = [...targets].map(tid => {
    const f = S.factions[E.owner(tid)];
    let pri = E.enemyPower(tid);
    if (!oilOwned && D.REGIONS[tid].res.oil) pri *= 0.3;
    if (f.war) pri *= 0.7;
    if (f.pact > 0) pri *= 50;
    if (D.REGIONS[tid].map === 'w' && S.flags.unified == null && !D.REGIONS[tid].res.oil) pri *= 5; // 統一前は海外を後回し
    return { tid, pri };
  }).sort((a, b) => a.pri - b.pri);
  for (const { tid } of list) {
    if (E.isP(tid)) continue;
    if (S.factions[E.owner(tid)].pact > 0) continue;
    const plan = planAttack(tid, 0.9);
    if (!plan) continue;
    // 燃料は少し残す
    if (S.res.fuel - plan.pr.fuel < 0 || S.res.ammo - plan.pr.ammo < 0) continue;
    const res = E.attack(tid, plan.ids);
    if (res.error) throw new Error('攻撃が拒否された: ' + res.error);
    log(`  攻撃: ${E.rname(tid)} ${res.win ? '勝' : '敗'} P${res.P}/E${res.E} 燃${res.fuel} 弾${res.ammo}`);
    assertState('attack');
  }
  // ── 移動:前線へ ──
  const dist = distToFrontier();
  const hojoNear = E.owner('sagami') !== 'player';
  let homeGuard = false;
  for (const u of S.units.slice()) {
    if (u.acted || u.loc === null) continue;
    if (hojoNear && u.loc === 'izu' && u.type === 'inf' && !homeGuard) { homeGuard = true; continue; }
    if (dist[u.loc] === 0) continue;
    const mt = E.moveTargets([u.id]);
    let best = null;
    for (const [rid, t] of Object.entries(mt)) {
      if (!t.ok) continue;
      const d = dist[rid] == null ? 99 : dist[rid];
      if (!best || d < best.d || (d === best.d && t.fuel < best.fuel)) best = { rid, d, fuel: t.fuel };
    }
    if (best && best.d < (dist[u.loc] == null ? 99 : dist[u.loc])) { const r = E.move([u.id], best.rid); if (r.error) throw new Error('移動が拒否された: ' + r.error); }
  }
}

function run(seed) {
  E.newGame({ difficulty: DIFF, seed });
  const marks = {}; let lastOwned = 1, stall = 0;
  const log = VERBOSE ? (s => console.log(s)) : (() => {});
  const curve = [];
  while (!E.S.over && E.S.turn < MAXT) {
    const S = E.S;
    log(`— T${S.turn} ${E.dateLabel().text} 金${S.res.gold} 糧${S.res.food} 鋼${S.res.steel} 燃${S.res.fuel} 弾${S.res.ammo} 領${E.playerRegions().length} 隊${S.units.length} 威${S.prestige}`);
    botTurn(log);
    assertState('bot');
    const rep = E.endTurn();
    assertState('endTurn');
    if (VERBOSE) for (const e of rep.events) if (['event', 'bad', 'warn', 'tech', 'news', 'good'].includes(e.k)) console.log('   · ' + e.t);
    // セーブとロードの往復で状態が変わらないこと
    if (process.env.DUMP_DIR && [8, 20, 34, 50].includes(E.S.turn)) fs.writeFileSync(`${process.env.DUMP_DIR}/save-t${E.S.turn}.json`, E.serialize());
    if (E.S.turn % 25 === 0) { const j = E.serialize(); E.load(j); if (E.serialize() !== j) throw new Error('セーブの往復で状態が変わった'); }
    const sm = E.summary();
    if (!marks.oil && E.playerRegions().some(id => E.S.regions[id].fac.oilwell)) marks.oil = E.S.turn;
    if (!marks.ammo && E.tech('ammo') && E.income().net.ammo > 0) marks.ammo = E.S.turn;
    if (!marks.half && sm.jp >= 23) marks.half = E.S.turn;
    if (!marks.unified && E.S.flags.unified != null) marks.unified = E.S.turn;
    if (!marks.w10 && sm.w >= 10) marks.w10 = E.S.turn;
    if (!marks.w30 && sm.w >= 30) marks.w30 = E.S.turn;
    if (!marks.alltech && D.TECHS.every(t => E.S.techs[t.id])) marks.alltech = E.S.turn;
    const owned = sm.jp + sm.w;
    if (owned === lastOwned) stall++; else { stall = 0; lastOwned = owned; }
    if (E.S.turn % 10 === 0) curve.push(`T${E.S.turn}:領${owned} 燃${E.S.res.fuel} 弾${E.S.res.ammo} 金${E.S.res.gold} 隊${E.S.units.length}`);
  }
  const R = E.S, sm = E.summary();
  return { seed, over: R.over, turn: R.turn, jp: sm.jp, w: sm.w, marks, stats: R.stats, res: R.res, units: R.units.length,
    jsdf: R.units.filter(u => D.UNIT_TYPES[u.type].jsdf).map(u => `${D.UNIT_TYPES[u.type].short}${u.hp}`).join(' '), curve, techs: Object.keys(R.techs).length, prestige: R.prestige };
}

let failed = 0;
for (let i = 0; i < RUNS; i++) {
  try {
    const r = run(1000 + i * 7919);
    console.log(`\n[${DIFF} seed ${r.seed}] ${r.over ? (r.over.win ? '勝利' : '敗北') : '未決着'} T${r.turn}(${1560 + Math.floor(r.turn / 4)}年) 日本${r.jp}/45 世界${r.w}/54 技術${r.techs} 部隊${r.units} 威信${r.prestige}`);
    console.log('  節目:', JSON.stringify(r.marks));
    console.log('  戦績:', JSON.stringify(r.stats));
    console.log('  残存自衛隊:', r.jsdf);
    console.log('  推移:', r.curve.join(' | '));
    if (!r.over || !r.over.win) failed++;
  } catch (e) {
    failed++;
    console.log(`\n[${DIFF} run ${i}] 例外: ${e.stack}`);
  }
}
process.exitCode = failed ? 1 : 0;
