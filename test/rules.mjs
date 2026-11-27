// 規則の点検。通しプレイのボットがまず踏まない道(核・一揆・超知能・古いセーブの読み込み)を、状態を作って直接たしかめる。
//   node test/rules.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const MAP = require('../src/mapdata.js');
const D = require('../src/data.js');
const E = require('../src/engine.js');
E.init(MAP);

let n = 0, bad = 0;
function ok(cond, msg) { n++; if (!cond) { bad++; console.log('  ✗ ' + msg); } }
function section(name, fn) { console.log('— ' + name); fn(); }
const allTech = (except = []) => { for (const t of D.TECHS) if (!except.includes(t.id)) E.S.techs[t.id] = true; };
const give = (type) => { const T = D.UNIT_TYPES[type]; const u = { id: E.S.nextUid++, type, name: T.name, hp: 100, loc: (T.cls === 'ground' || T.cls === 'heli') ? 'izu' : null, acted: false }; E.S.units.push(u); return u; };
const enemyRegion = (pred) => Object.keys(E.S.regions).find(id => !E.isP(id) && pred(id));

section('古いセーブ(民心・施策が入る前)を読み込める', () => {
  const old = JSON.parse(fs.readFileSync(new URL('./fixtures/save-before-mood-t20.json', import.meta.url), 'utf8'));
  ok(old.pol === undefined && Object.values(old.regions).every(r => r.mood === undefined), '固定データが新しい形式になっている(古い形式のはず)');
  E.load(old);
  const S = E.S;
  ok(S.pol && typeof S.pol === 'object', '施策の入れ物ができる');
  ok(Object.values(S.regions).every(r => r.mood === 50 && r.ruin === 0), 'すべての地域に民心と焦土が入る');
  ok(S.flags.nation >= 1, '領地に見合った国号になる: ' + E.nation().name);
  const before = S.turn;
  const rep = E.endTurn();
  ok(S.turn === before + 1 && Array.isArray(rep.events), '読み込んだあと季節を送れる');
  ok(!rep.events.some(e => e.big && e.big.nation != null), '読み込み直後に国号改めの知らせが出ない');
  for (const id of E.playerRegions()) ok(!!E.voice(id), '民の声が出る ' + id);
  const j = E.serialize(); E.load(j); ok(E.serialize() === j, 'セーブの往復で変わらない');
});

section('施策', () => {
  E.newGame({ seed: 5 });
  const S = E.S;
  ok(E.policyOptions().every(p => !p.ok), '最初は何も布告できない');
  ok(E.enact('sekisho').error, '条件を満たさない施策は拒否される');
  for (const id of ['sagami', 'suruga', 'kai']) { S.regions[id].o = 'player'; S.regions[id].mood = 40; }
  S.res.gold = 1000;
  const g0 = E.income().gross.gold, m0 = S.regions.izu.mood;
  const r = E.enact('sekisho');
  ok(r.ok && S.res.gold === 850, '布告すると資金が減る');
  ok(S.regions.izu.mood === m0 + 5, '民心がその場で上がる');
  ok(E.income().gross.gold > g0 * 1.07, '資金の収入が増える');
  ok(E.enact('sekisho').error === '布告済み', '二度は布告できない');
  ok(S.log.some(e => e.k === 'policy'), '記録に残る');
  for (const id of Object.keys(S.regions)) if (D.REGIONS[id].map === 'jp') S.regions[id].o = 'player';
  const a0 = S.factions.spain.att; E.enact('jinshin');
  ok(S.factions.spain.att === a0 - 15, '人買いの禁止で南蛮との友好が下がる');
  const f0 = E.income().gross.food; E.enact('nengu');
  ok(E.income().gross.food < f0, '四公六民で兵糧の収入は減る');
  ok(E.moodTarget('izu') >= 50 + 5 + 12 + 6, '民心の落ち着く先が上がる');
});

section('国号', () => {
  E.newGame({ seed: 6 });
  const S = E.S;
  ok(E.nation().name === '東富士駐屯地', '始まりは東富士駐屯地');
  ['sagami', 'suruga', 'kai', 'musashi'].forEach(id => { S.regions[id].o = 'player'; });
  const rep = E.endTurn();
  ok(E.nation().name === '富士鎮守府', '5か国で富士鎮守府: ' + E.nation().name);
  ok(rep.events.some(e => e.big && e.big.nation === 1), '国号改めの知らせが出る');
  ['sagami', 'suruga', 'kai', 'musashi'].forEach(id => { S.regions[id].o = D.REGIONS[id].fac; S.factions[D.REGIONS[id].fac].alive = true; });
  E.endTurn();
  ok(E.nation().name === '富士鎮守府', '領地が減っても名は戻らない');
});

section('核ミサイルと軌道砲', () => {
  E.newGame({ seed: 7 });
  const S = E.S;
  S.flags.unified = 0; S.res.fuel = 99999; S.res.ammo = 99999; S.prestige = 50;
  const nk = give('nuke'), orb = give('orbital');
  const far = 'iberia';
  const opts = E.attackOptions(far);
  ok(opts.some(o => o.u.id === nk.id && o.ok && o.via === 'missile'), '核は世界のどこへでも届く');
  const sg = E.suggestAttack(far, 0.5);
  ok(!sg.ids.includes(nk.id), 'おすすめ編成に核は入らない');
  const g0 = S.regions[far].g, att0 = S.factions.ming.att, mood0 = S.regions.izu.mood, pre0 = S.prestige;
  const pr = E.predictAttack(far, [nk.id]);
  ok(pr.nuke && !pr.canCapture && !pr.problems.length, '核だけでも撃てる(占領はできない)');
  const res = E.attack(far, [nk.id]);
  ok(!res.error && res.nuke && res.bombard && !res.captured, '核の一撃は砲爆撃あつかい');
  ok(!S.units.some(u => u.id === nk.id), '撃った核は無くなる');
  ok(res.losses.some(l => l.spent), '結果に「使用済み」が載る');
  ok(S.regions[far].ruin === 1 && S.regions[far].fort === 0 && S.regions[far].g <= g0 * 0.06, '撃たれた土地は焦土になり、守備兵はほぼ消える');
  ok(S.factions.ming.att === Math.max(-100, att0 - 25), '世界中の友好が下がる');
  ok(S.regions.izu.mood === mood0 - 8 && S.prestige <= pre0 - 9, '自領の民心と威信も下がる');
  ok(S.stats.nukes === 1 && res.events.some(e => e.big && e.big.grave), '最初の一発には重い知らせが出る');
  const y = E.regionYield('izu'); ok(Number.isFinite(y.gold), '収支が壊れない');
  // 軌道砲は何度でも
  const r2 = E.attack('huabei', [orb.id]);
  ok(!r2.error && S.units.some(u => u.id === orb.id && u.acted && u.hp === 100), '軌道砲は残り、傷つかない');
  E.endTurn();
  ok(S.regions[far].ruin < 1 && S.regions[far].ruin > 0.9, '焦土は少しずつ癒える');
  const r3 = E.attack('huabei', [orb.id]);
  ok(!r3.error, '次の季節にまた撃てる');
  // 占領した焦土の民の声
  S.regions[far].o = 'player';
  ok(D.VOICES.ruin.some(v => v.t === E.voice(far).t), '焦土の声になる');
  ok(E.regionYield(far).food < D.REGIONS[far].koku * 0.5, '焦土は実りが少ない');
});

section('一揆', () => {
  let seen = false;
  for (let seed = 1; seed <= 6 && !seen; seed++) {
    E.newGame({ seed });
    const S = E.S;
    S.regions.sagami.o = 'player'; S.regions.sagami.ruin = 1; S.regions.sagami.mood = 5; S.regions.sagami.ctl = 80; S.regions.sagami.g = 5000;
    for (let i = 0; i < 12 && !seen; i++) {
      S.regions.sagami.mood = 5;
      const rep = E.endTurn();
      if (rep.events.some(e => e.revolt)) { seen = true; ok(S.regions.sagami.ctl < 80 && S.stats.revolts === 1, '一揆で統治度が落ちる'); }
    }
  }
  ok(seen, '民心が低いと一揆が起きる');
  E.newGame({ seed: 3 });
  const S = E.S;
  allTech(['asi']); S.res.gold = 5000;
  E.enact('kanshi');
  S.regions.sagami.o = 'player';
  let any = false;
  for (let i = 0; i < 30; i++) { S.regions.sagami.mood = 5; if (E.endTurn().events.some(e => e.revolt)) any = true; }
  ok(!any, '見守り網があれば一揆は起きない');
});

section('未来の技術', () => {
  E.newGame({ seed: 8 });
  const S = E.S;
  const jet = S.units.find(u => u.type === 'jet'), tank = S.units.find(u => u.type === 'tank');
  S.flags.unified = 0;
  ok(E.attackOptions('iberia').some(o => o.u.id === jet.id && !o.ok), 'ロケット以前:戦闘機は遠すぎて届かない');
  S.techs.rocket = true;
  ok(E.attackOptions('iberia').some(o => o.u.id === jet.id && o.ok), 'ロケット以後:どこへでも届く');
  ok(E.ustat(tank).fuel > 0, '核融合以前:戦車は燃料を食う');
  const up0 = E.income().upkeep.fuel; S.techs.nuclear = true;
  ok(up0 > 0 && E.income().upkeep.fuel === 0, '原子力で基地の燃料がいらなくなる');
  S.techs.fusion = true;
  ok(E.ustat(tank).fuel === 0 && E.ustat(jet).fuel === 0, '核融合以後:燃料がいらない');
  const a0 = E.ustat(tank).atk; S.techs.laser = true;
  ok(E.ustat(tank).atk > a0 * 1.15, '光学兵器で攻撃力が上がる');
  ok(E.prodTurns('ktank') === 3, '編成は3ターン'); S.techs.agi = true; ok(E.prodTurns('ktank') === 2 && E.prodTurns('ashi') === 1, '汎用人工知能で1ターン早く(最短1)');
  const d0 = E.dipMax(); S.techs.network = true; S.techs.llm = true; ok(E.dipMax() === d0 + 2, '情報網と対話AIで外交行動が増える');
  // 鳥は核兵器と超知能に自分からは手を付けない
  allTech(['asi', 'nukeweapon']);
  for (const b of D.BIRDS) S.assign[b.id] = null;
  E.autoAssign();
  ok(D.BIRDS.every(b => !S.assign[b.id]), '残りが核兵器と超知能だけなら、鳥は手を空けて待つ');
  ok(E.manualAvail().join() === 'nukeweapon,asi', '司令が命じられる研究として出る: ' + E.manualAvail());
  ok(E.hints().some(h => /司令がご自分で/.test(h.text)), '助言でそう伝える');
  ok(E.assign('gin', 'nukeweapon') && E.birdRp('gin') > 0, '命じれば進む');
  const p0 = S.factions.ming.pride; S.prog.nukeweapon = 99999; E.endTurn();
  ok(S.techs.nukeweapon && S.factions.ming.pride === Math.max(10, p0 - 10), '核兵器を持つと、諸国の誇りが揺らぐ');
  ok(E.produceOptions('izu').some(o => o.type === 'nuke'), '核ミサイルが編成の一覧に出る');
});

section('超知能', () => {
  E.newGame({ seed: 9 });
  const S = E.S;
  allTech(['asi']);
  ['sagami', 'suruga', 'kai'].forEach(id => { S.regions[id].o = 'player'; S.regions[id].mood = 20; S.regions[id].ctl = 30; });
  S.threats.push({ from: 'musashi', to: 'sagami', f: D.REGIONS.musashi.fac, turn: S.turn + 3, sea: false });
  for (const b of D.BIRDS) E.assign(b.id, 'asi');
  S.prog.asi = 99999;
  const alive0 = Object.values(S.factions).filter(f => f.alive).length;
  const rep = E.endTurn();
  ok(S.flags.asi != null && E.nation().name === '調和圏', '超知能で国号が調和圏になる');
  ok(rep.events.some(e => e.big && e.big.asi), '知らせが出る');
  ok(E.playerRegions().every(id => S.regions[id].mood === 100 && S.regions[id].ctl === 100), '民心と統治度がすべて最大になる');
  ok(!S.threats.length, '攻めてくる者がいなくなる');
  const alive1 = Object.values(S.factions).filter(f => f.alive).length;
  ok(alive0 - alive1 >= 1 && alive0 - alive1 <= 3 + 2, '接する勢力が戦わずに加わる(季節に3つまで): ' + (alive0 - alive1));
  ok(rep.events.some(e => e.k === 'asi'), '加わった知らせが出る');
  ok(E.policyOptions().every(p => !p.ok), '施策はもう布告できない');
  ok(D.VOICES.asi.some(v => v.t === E.voice('izu').t), '民の声が変わる');
  const fid = Object.keys(S.factions).find(f => S.factions[f].alive && E.inContact(f));
  ok(E.submitChance(fid) === 95, '降伏勧告は必ず通る');
  let guard = 0;
  while (!S.over && guard++ < 200) E.endTurn();
  ok(S.over && S.over.win && S.over.asi, '放っておいても世界は調和する(T' + S.turn + ')');
  ok(S.flags.unified != null, '途中で天下統一を通る');
});

section('民の声(全地域・全時代)', () => {
  E.newGame({ seed: 10 });
  const S = E.S;
  for (const id of Object.keys(S.regions)) S.regions[id].o = 'player';
  const eraTech = D.ERAS.map(e => e.tech).filter(Boolean);
  let total = 0; const seen = new Set();
  for (let e = 0; e <= eraTech.length - 1; e++) {
    if (e > 0) S.techs[eraTech[e - 1]] = true;
    for (const mood of [10, 50, 90]) for (let t = 0; t < 8; t += 2) {
      S.turn = t;
      for (const id of Object.keys(S.regions)) { S.regions[id].mood = mood; const v = E.voice(id); total++; if (!v || !v.who || !v.t) { ok(false, '声が出ない ' + id); return; } seen.add(v.t); }
    }
  }
  ok(total > 0, '声が出る');
  const all = [];
  for (const k of ['force', 'submit', 'low', 'mid', 'high', 'ruin', 'asi', 'wForce', 'wMid', 'wHigh']) all.push(...D.VOICES[k]);
  for (const k of Object.keys(D.VOICES.era)) all.push(...D.VOICES.era[k]);
  for (const k of Object.keys(D.VOICES.region)) { ok(!!D.REGIONS[k], '民の声の地域名が実在する: ' + k); all.push(...D.VOICES.region[k]); }
  for (const v of all) if (v.pol) ok(!!E.POLICY_BY_ID[v.pol], '声が指す施策が実在する: ' + v.pol);
  console.log(`  (${seen.size} 通りの声が出た / 用意 ${new Set(all.map(v => v.t)).size})`);
  for (const p of D.POLICIES) {
    for (const k of Object.keys((p.once && p.once.att) || {})) ok(!!D.FACTIONS[k], '施策が指す勢力が実在する: ' + k);
    for (const k of Object.keys((p.once && p.once.pride) || {})) ok(!!D.FACTIONS[k], '施策が指す勢力が実在する: ' + k);
    if (p.need.tech) ok(!!E.TECH_BY_ID[p.need.tech], '施策が指す技術が実在する: ' + p.need.tech);
    ok(!!E.BIRD_BY_ID[p.bird], '施策の担当が実在する: ' + p.bird);
  }
  for (const f of D.FATES) ok(!!D.FACTIONS[f.fid], '武将のその後が指す勢力が実在する: ' + f.fid);
  for (const e of D.ERAS) if (e.tech) ok(!!E.TECH_BY_ID[e.tech], '時代が指す技術が実在する: ' + e.tech);
  for (const t of D.TECHS) for (const r of t.req) ok(!!E.TECH_BY_ID[r], '前提技術が実在する: ' + r);
  for (const [k, T] of Object.entries(D.UNIT_TYPES)) { if (T.tech) ok(!!E.TECH_BY_ID[T.tech], k + ' の技術'); if (T.at) ok(!!D.FACILITIES[T.at], k + ' の施設'); }
});

console.log(bad ? `\n${bad} / ${n} 件が失敗` : `\n${n} 件すべて合格`);
process.exitCode = bad ? 1 : 0;
