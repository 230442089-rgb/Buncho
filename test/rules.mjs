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
  ok(Array.isArray(S.chron) && S.chron.length === 1, '年表の入れ物ができる');
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
  ok(S.chron[0].k === 'start' && S.chron.some(e => e.k === 'policy' && /関所の撤廃/.test(e.t)), '年表に残る');
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
  ok(S.chron.some(e => e.k === 'nuke'), '年表に核の使用が残る');
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
  ok(S.chron.filter(e => e.k === 'asi').length > 5 && S.chron.length <= 400, '年表に調和の広がりが残る(' + S.chron.length + '件)');
});

section('学問所の格上げ・建設の短縮・急がせる', () => {
  E.newGame({ seed: 11 });
  const S = E.S; S.res.gold = 9000; S.res.steel = 900;
  const opt = k => E.buildOptions('izu').find(o => o.key === k);
  ok(S.regions.izu.fac.school === 1 && E.regionYield('izu').rp === 3, '始まりは学問所(研究力 +3)');
  ok(opt('school').upgrade && !opt('school').ok && /蒸気機関/.test(opt('school').why), '蒸気機関の前は格上げできない');
  S.techs.steam = true;
  ok(opt('school').ok && /高等学校/.test(opt('school').name) && opt('school').cost.gold === 200, '蒸気機関で高等学校へ: ' + opt('school').name);
  ok(E.build('izu', 'school').ok && S.regions.izu.b.t === 2, '格上げは2季');
  ok(E.rushCost('izu') > 0, '急がせる費用が出る');
  const g0 = S.res.gold, rc = E.rushCost('izu'), rr = E.rush('izu');
  ok(rr.ok && S.res.gold === g0 - rc && S.regions.izu.b.t === 1 && E.rushCost('izu') == null, '急がせると次の季節に仕上がる');
  const rep = E.endTurn();
  ok(S.regions.izu.fac.school === 2 && E.regionYield('izu').rp === 6 && rep.events.some(e => /高等学校が完成/.test(e.t)), '高等学校が完成して研究力 +6');
  ok(E.facLabel('izu', 'school') === '高等学校', '呼び名が変わる');
  S.techs.electric = true; S.techs.electronics = true;
  E.build('izu', 'school'); E.rush('izu'); E.endTurn(); E.build('izu', 'school'); E.rush('izu'); E.endTurn();
  ok(S.regions.izu.fac.school === 4 && E.regionYield('izu').rp === 16 && opt('school').built, '大学、研究所まで上がり、そこで打ち止め');
  ok(E.buildTurns('arsenal') === 3, '工廠は3季');
  S.techs.rail = true; ok(E.buildTurns('arsenal') === 2 && E.buildTurns('farm') === 1, '鉄道で1季早く(最短1季)');
  S.techs.engine = true; ok(E.buildTurns('arsenal') === 1 && opt('arsenal').turns === 1, '内燃機関でさらに1季');
  S.techs.agi = false; S.techs.machine = false; ok(E.prodTurns('ktank') === 3, '国産戦車は3季'); S.techs.machine = true; ok(E.prodTurns('ktank') === 2, '精密工作機械で編成が1季早く');
  const j = E.serialize(); E.load(j); ok(E.serialize() === j, 'セーブの往復で変わらない');
});

section('おまかせ(方針)', () => {
  E.newGame({ seed: 12 });
  const S = E.S;
  ok(S.auto.build === 'off' && !S.auto.move, '始まりは手動');
  ['sagami', 'suruga', 'kai', 'musashi', 'echigo', 'kozuke', 'shinano'].forEach(id => { S.regions[id].o = 'player'; S.regions[id].ctl = 80; });
  S.res.gold = 3000; S.res.steel = 500; S.techs.distill = true; S.techs.survey = true;
  ok(E.autoBuild().n === 0, '手動のままなら何も建てない');
  E.setAuto({ build: 'scarce' });
  const b = E.autoBuild();
  ok(b.n >= 3 && b.list.some(x => x.key === 'oilwell'), '足りない資源を優先:油井を含めて建設を割り振る(' + b.list.map(x => x.name).join('、') + ')');
  ok(S.res.gold >= E.autoReserve(), '予備の資金は残す: ' + S.res.gold);
  ok(!b.list.some(x => x.key === 'fort' || x.key === 'airfield'), '城と飛行場は勝手に建てない');
  E.newGame({ seed: 12 }); const S2 = E.S;
  ['sagami', 'suruga', 'kai', 'musashi', 'kozuke'].forEach(id => { S2.regions[id].o = 'player'; S2.regions[id].ctl = 80; });
  S2.res.gold = 3000; E.setAuto({ build: 'study' });
  const b2 = E.autoBuild();
  ok(b2.list.filter(x => x.key === 'school').length >= 3, '学問を優先:学問所から建てる(' + b2.list.map(x => x.name).join('、') + ')');
  E.newGame({ seed: 12 }); const S3 = E.S;
  ['sagami', 'suruga', 'kai', 'musashi', 'kozuke'].forEach(id => { S3.regions[id].o = 'player'; S3.regions[id].ctl = 80; });
  S3.res.gold = 3000; E.setAuto({ build: 'res', res: 'food' });
  ok(E.autoBuild().list.filter(x => x.key === 'farm').length >= 3, '兵糧を優先:農地改良から建てる');
  // 前線へ寄せる
  E.newGame({ seed: 13 }); const S4 = E.S;
  ['sagami', 'musashi', 'kozuke'].forEach(id => { S4.regions[id].o = 'player'; });
  const dist = E.frontDist(), back = Object.keys(dist).find(id => dist[id] > 0);
  ok(dist.izu != null, '前線までの距離が出る: ' + JSON.stringify(dist));
  if (back) {
    const u = S4.units.find(x => x.type === 'inf'); u.loc = back; E.setAuto({ move: true });
    const before = dist[u.loc]; const rep = E.endTurn();
    ok(E.frontDist()[u.loc] < before || rep.events.some(e => e.auto), '未行動の部隊が前線へ寄る');
  }
  // 守りの徴兵
  E.newGame({ seed: 14 }); const S5 = E.S; S5.res.gold = 2000; S5.res.food = 2000;
  S5.threats.push({ from: 'sagami', to: 'izu', f: D.REGIONS.sagami.fac, turn: S5.turn + 5, sea: false });
  S5.units = S5.units.filter(u => u.loc !== 'izu'); S5.regions.izu.g = 500;
  E.setAuto({ guard: true }); const g0 = S5.regions.izu.g;
  ok(E.autoGuard() > 0 && S5.regions.izu.g > g0, '狙われた土地に守備兵を足す');
  // 編成は核を作らない
  E.newGame({ seed: 15 }); const S6 = E.S; for (const t of D.TECHS) if (t.id !== 'asi') S6.techs[t.id] = true;
  S6.res.gold = 99999; S6.res.steel = 99999; S6.regions.izu.fac.arsenal = 1; E.setAuto({ make: true });
  const made = E.autoMake();
  ok(made.length >= 1 && !made.includes('nuke'), '編成をまかせても核は作らない: ' + made.join(','));
  ok(E.setAuto({ build: 'bogus', res: 'x' }).build === 'off', '知らない方針は受け付けない');
  // 季節の報告に、まかせた分が一行で出る
  E.newGame({ seed: 16 }); const S7 = E.S;
  ['sagami', 'suruga', 'kai'].forEach(id => { S7.regions[id].o = 'player'; S7.regions[id].ctl = 80; });
  S7.res.gold = 2000; E.setAuto({ build: 'scarce' });
  const rep7 = E.endTurn(), line = rep7.events.find(e => e.k === 'auto');
  ok(line && /おまかせ:建設/.test(line.t), '報告に出る: ' + (line && line.t));
  const j7 = E.serialize(); E.load(j7); ok(E.serialize() === j7 && E.S.auto.build === 'scarce', '方針はセーブに残る');
});

section('国のすがたと、統一のあと', () => {
  E.newGame({ seed: 21 });
  const S = E.S; let c = E.census();
  ok(c.world > 45000 && c.world < 58000, '1560年の世界人口は約5億: ' + Math.round(c.world) + '万');
  for (const id of Object.keys(S.regions)) if (D.REGIONS[id].map === 'jp') S.regions[id].o = 'player';
  c = E.census();
  ok(c.pop > 1100 && c.pop < 1350 && c.death > 34 && c.life < 32 && c.infant > 200, '戦国の日本: 人口' + Math.round(c.pop) + '万 死亡率' + c.death.toFixed(1) + ' 寿命' + c.life.toFixed(0));
  const d0 = c.death; S.techs.hygiene = true; S.pol.shuto = 0;
  ok(E.census().death < d0 - 8 && E.census().life > c.life + 8, '公衆衛生と種痘で死亡率が下がり、寿命が延びる');
  const p0 = E.census().pop; for (let i = 0; i < 8; i++) E.endTurn();
  ok(E.census().pop > p0 * 1.02 && S.hist.length === 2, '人口が増え、春ごとに記録が残る: ' + JSON.stringify(S.hist[1]));
  const pk = S.regions.kai.pop; S.flags.unified = 0; S.units.push({ id: S.nextUid++, type: 'nuke', name: '核', hp: 100, loc: null, acted: false });
  S.regions.kai.o = D.REGIONS.kai.fac; S.factions[D.REGIONS.kai.fac].alive = true; E.attack('kai', [S.units[S.units.length - 1].id]);
  ok(S.regions.kai.pop < pk * 0.35, '核を撃たれた土地は人口が激減する');
  // 統一のあと
  E.newGame({ seed: 22 }); const S2 = E.S;
  for (const id of Object.keys(S2.regions)) S2.regions[id].o = 'player';
  for (const f of Object.values(S2.factions)) f.alive = false;
  E.endTurn();
  ok(S2.over && S2.over.win, '地球統一で決着');
  const t0 = S2.turn; ok(E.endTurn().events.length === 0 && S2.turn === t0, 'そのままでは季節は進まない');
  ok(E.keepGoing().ok && S2.flags.cont != null, '治めつづけるを選べる');
  const rep = E.endTurn();
  ok(S2.turn === t0 + 1 && Array.isArray(rep.events), '統一のあとも季節が進む');
  for (const t of D.TECHS) if (t.id !== 'asi') S2.techs[t.id] = true;
  for (const b of D.BIRDS) E.assign(b.id, 'asi'); S2.prog.asi = 99999;
  const rep2 = E.endTurn();
  ok(S2.flags.asi != null && S2.over.asi === true && rep2.events.some(e => e.big && e.big.asi), '統一のあとで超知能を起こすと、結末が調和に変わる');
  for (let i = 0; i < 12; i++) E.endTurn();
  ok(S2.turn === t0 + 14 && E.census().death <= 5.5, 'その先も季節は進む(死亡率 ' + E.census().death.toFixed(1) + ')');
  const j = E.serialize(); E.load(j); ok(E.serialize() === j, 'セーブの往復で変わらない');
  E.newGame({ seed: 23 }); ok(E.keepGoing().error, '決着の前には選べない');
});

section('施設の段と、それを解く研究', () => {
  E.newGame({ seed: 31 });
  const S = E.S; S.res.gold = 99999; S.res.steel = 99999;
  const opt = k => E.buildOptions('izu').find(o => o.key === k);
  const finish = k => { ok(E.build('izu', k).ok, k + ' を建てられる'); S.regions.izu.b.t = 1; E.endTurn(); };
  const food0 = E.regionYield('izu').food;
  finish('farm');
  ok(S.regions.izu.fac.farm === 1 && Math.abs(E.regionYield('izu').food / food0 - 1.5) < 0.12, '農地改良で兵糧が約1.5倍');
  ok(opt('farm').upgrade && !opt('farm').ok && /用水と治水/.test(opt('farm').why), '格上げには「用水と治水」が要る: ' + opt('farm').why);
  S.techs.agri = true; S.techs.irrigation = true;
  ok(opt('farm').ok && /用水と新田/.test(opt('farm').name), '研究が済むと格上げできる: ' + opt('farm').name);
  finish('farm');
  ok(S.regions.izu.fac.farm === 2 && E.facLabel('izu', 'farm') === '用水と新田', '二段目の名で呼ばれる');
  for (const t of ['fertilizer', 'breeding', 'engine', 'tractor']) S.techs[t] = true;
  finish('farm'); finish('farm');
  ok(S.regions.izu.fac.farm === 4 && opt('farm').built && opt('farm').why === '最高の段', '四段目で打ち止め');
  const g0 = E.regionYield('izu').gold; finish('market');
  for (const t of ['survey', 'bank', 'rail', 'steam', 'bessemer', 'blast', 'corp']) S.techs[t] = true;
  finish('market'); finish('market');
  ok(S.regions.izu.fac.market === 3 && E.facLabel('izu', 'market') === '取引所' && E.regionYield('izu').gold > g0 * 1.8, '楽市楽座 → 商館 → 取引所で資金が増える');
  // 工廠:段で弾薬が増え、流れ作業の工廠は編成が早い
  S.techs.ammo = true; finish('arsenal');
  const a1 = E.regionYield('izu').ammo; S.techs.machine = true; S.techs.electric = true; finish('arsenal');
  ok(E.regionYield('izu').ammo > a1 * 1.3, '機械工廠で弾薬が増える');
  S.techs.tank = true; S.techs.mg = true; S.techs.rifle = true; S.techs.agi = false;
  const t2 = E.prodTurns('ktank', 'izu'); S.techs.assembly = true; finish('arsenal');
  ok(S.regions.izu.fac.arsenal === 3 && E.prodTurns('ktank', 'izu') === Math.max(1, t2 - 1), '流れ作業の工廠では編成が1季早い');
  // 油井と鉱山(資源のある土地)
  S.regions.echigo.o = 'player'; S.techs.distill = true;
  ok(E.build('echigo', 'oilwell').ok, '越後に油井'); S.regions.echigo.b.t = 1; E.endTurn();
  const f1 = E.regionYield('echigo').fuel; S.techs.drill = true;
  ok(E.build('echigo', 'oilwell').ok, '機械掘りへ格上げ'); S.regions.echigo.b.t = 1; E.endTurn();
  ok(S.regions.echigo.fac.oilwell === 2 && E.regionYield('echigo').fuel > f1 * 1.35, '油田の格上げで燃料が増える(' + f1 + ' → ' + E.regionYield('echigo').fuel + '、段 ' + S.regions.echigo.fac.oilwell + '、持ち主 ' + S.regions.echigo.o + ')');
  ok(E.lvText('farm', 2) === '兵糧 ×1.9' && E.facMax('school') === 4 && E.facMax('fort') === 1, '段の説明');
  const j = E.serialize(); E.load(j); ok(E.serialize() === j, 'セーブの往復で変わらない');
  // 古いセーブ(段のない施設)もそのまま読める
  const old = JSON.parse(fs.readFileSync(new URL('./fixtures/save-before-mood-t20.json', import.meta.url), 'utf8'));
  E.load(old); let fine = true;
  for (const id of E.playerRegions()) { const y = E.regionYield(id); if (!Number.isFinite(y.gold + y.food + y.steel + y.fuel + y.ammo + y.rp)) fine = false; }
  ok(fine, '古いセーブの施設は一段目として扱われる');
});

section('難易度「修羅」', () => {
  const count = (diff, turns) => {
    E.newGame({ difficulty: diff, seed: 77 });
    const S = E.S; let feud = 0, thr = 0;
    for (const id of ['sagami', 'suruga', 'kai', 'musashi', 'kozuke', 'shinano']) S.regions[id].o = 'player';
    for (let i = 0; i < turns; i++) {
      for (const id of E.playerRegions()) S.regions[id].g = 800; S.res.gold = 5000; S.res.food = 5000;
      const r = E.endTurn(); for (const e of r.events) if (/攻め取った/.test(e.t)) feud++;
      thr += S.threats.length; if (S.over) break;
    }
    return { feud, thr, q: S.factions.mori.q, base: D.FACTIONS.mori.q };
  };
  const n = count('normal', 30), h = count('hell', 30);
  ok(D.DIFFICULTY.hell && D.DIFFICULTY.hell.name === '修羅', '難易度の一覧にある');
  ok(h.thr > n.thr && h.thr >= 8, '攻めてくる回数が多い(実戦 ' + n.thr + ' / 修羅 ' + h.thr + ')');
  ok(h.feud >= 3 && n.feud === 0, '強国が弱国を呑みこむ(修羅 ' + h.feud + ' 回)');
  ok(h.q > h.base + 0.1 && n.q === n.base, '年を追うごとに兵の質が上がる(' + h.base + ' → ' + h.q + ')');

  // 包囲網:日本で六つめの国を取ると、諸大名がこぞって敵になる
  const siege = (diff, extra) => {
    E.newGame({ difficulty: diff, seed: 3 });
    const S = E.S;
    for (const id of extra) { S.regions[id].o = 'player'; S.regions[id].g = 60000; }
    for (const f of Object.values(S.factions)) { f.war = false; f.pact = 8; }
    const r = E.endTurn();
    const jp = Object.keys(S.factions).filter(f => S.factions[f].alive && E.factionRegions(f).length && D.REGIONS[E.factionRegions(f)[0]].map === 'jp');
    return { flag: S.flags.siege, card: r.events.some(e => e.big && e.big.title === '包囲網'), allWar: jp.every(f => S.factions[f].war && !S.factions[f].pact), anyWar: jp.some(f => S.factions[f].war), chron: S.chron.some(c => /包囲網/.test(c.t)) };
  };
  const s5 = siege('hell', ['sagami', 'suruga', 'kai', 'musashi']), s6 = siege('hell', ['sagami', 'suruga', 'kai', 'musashi', 'kozuke']), sn = siege('normal', ['sagami', 'suruga', 'kai', 'musashi', 'kozuke', 'shinano']);
  ok(s5.flag == null && !s5.card, '五つまでは、包囲網は結ばれない');
  ok(s6.flag != null && s6.card && s6.allWar && s6.chron, '六つめで包囲網。日本の大名がみな敵になり、不可侵は反故になる');
  ok(sn.flag == null && !sn.card && !sn.anyWar, '実戦では、包囲網は起きない');

  // 示し合わせた攻め:一国ずつでは届かない守りを、隣り合う二国が合わせて破る
  const gang = diff => {
    E.newGame({ difficulty: diff, seed: 9 });
    const S = E.S, P = 'suruga', X = 300, en = D.DIFFICULTY[diff].enemy;
    S.regions[P].o = 'player';
    const foes = E.links(P).filter(l => !l.sea && S.regions[l.id].o !== 'player').map(l => l.id);
    const set = () => {
      for (const f of Object.values(S.factions)) { f.war = false; f.pact = 0; }
      for (const id of foes) { const f = S.factions[S.regions[id].o]; f.war = true; S.regions[id].g = Math.round(X * 50 / (0.7 * f.q * en)); }
      let g = 100; do { S.regions[P].g = g; g += 100; } while (E.defensePower(P) < X * 1.5);   // 守りは、敵一国ぶんの 1.5 倍
      S.res.gold = 5000; S.res.food = 5000;
    };
    let planned = null;
    for (let i = 0; i < 6 && !planned; i++) { set(); S.threats = []; E.endTurn(); if (S.regions[P].o !== 'player') break; if (S.threats.some(t => t.to === P)) planned = { n: S.threats.filter(t => t.to === P).length, on: E.threatOn(P), dp: E.defensePower(P) }; }
    if (!planned) return { foes: foes.length, planned: null, held: S.regions[P].o === 'player' };
    const r = E.endTurn();
    return { foes: foes.length, planned, held: S.regions[P].o === 'player', text: (r.events.find(e => /奪われた|退けた/.test(e.t)) || {}).t };
  };
  const gh = gang('hell'), gn = gang('normal');
  ok(gh.foes >= 2, '駿河は二国以上と陸でつながる(' + gh.foes + ')');
  ok(gh.planned && gh.planned.n >= 2 && gh.planned.on.joint && gh.planned.on.power > gh.planned.dp, '修羅:隣り合う敵がそろって予告を出し、合わせた戦力が守りを上回る(' + JSON.stringify(gh.planned) + ')');
  ok(gh.planned && !gh.held && /と/.test(gh.text || ''), '修羅:合わせた力で奪われる(' + gh.text + ')');
  ok(!gn.planned && gn.held, '実戦:同じ守りでも、一国ずつでは攻めてこない');
});

section('移動は、季節のあいだなら変えられる', () => {
  E.newGame({ seed: 12 });
  const S = E.S;
  for (const id of ['sagami', 'suruga', 'kai']) { S.regions[id].o = 'player'; S.regions[id].g = 9000; }   // 武蔵は、まだ敵の土地(相模の隣)
  for (const f of Object.values(S.factions)) { f.war = false; f.pact = 9; }
  const g = S.units.filter(u => D.UNIT_TYPES[u.type].cls === 'ground'), a = g[0], b = g[1], c = g[2], ids = [a.id, b.id];
  const f0 = S.res.fuel, t1 = E.moveTargets(ids);
  ok(t1.sagami && t1.sagami.ok && !t1.izu && t1.sagami.fuel > 0, '動いていない部隊:いまいる伊豆は行き先に出ない');
  const r1 = E.move(ids, 'sagami');
  ok(r1.ok && a.loc === 'sagami' && a.acted && a.from === 'izu' && S.res.fuel === f0 - r1.fuel, '相模へ移動。季節の初めの場所(伊豆)を覚えている');
  const ao = E.attackOptions('musashi').find(o => o.u.id === a.id);
  ok(E.movable(a) && !!ao && !ao.ok, '移動した部隊は、まだ動かせるが、攻撃には出られない');
  ok(/元の場所へ戻せば/.test((ao || {}).why || ''), '攻撃の一覧に、その理由が出る(' + ((ao || {}).why || '') + ')');
  const t2 = E.moveTargets(ids);
  ok(t2.izu && t2.izu.back && t2.izu.fuel === -r1.fuel && t2.suruga && !t2.sagami, '行き先を選びなおせる:伊豆(戻す。燃料が返る)・駿河。いまいる相模は出ない');
  ok(t2.suruga.fuel === E.moveTargets([c.id]).suruga.fuel * 0 + (t1.suruga.fuel - r1.fuel), '行き先は伊豆から測り直す(差額だけを払う)');
  const r2 = E.move(ids, 'suruga');
  ok(r2.ok && a.loc === 'suruga' && a.from === 'izu' && S.res.fuel === f0 - t1.suruga.fuel, '駿河へ変更。払う燃料は、伊豆から駿河へのぶんだけ');
  ok(Object.keys(E.moveTargets([a.id, c.id])).length === 0, '出発地の違う部隊は、いっしょには動かせない');
  const r3 = E.move([a.id], 'izu');
  ok(r3.ok && r3.back && a.loc === 'izu' && !a.acted && a.from == null && a.mf == null, '一つだけ伊豆へ戻す:動かなかったことになる');
  ok(b.loc === 'suruga' && b.acted, 'もう一つは駿河に残る');
  const u = E.undoMove([a.id, b.id, c.id]);
  ok(u.ok && u.n === 1 && b.loc === 'izu' && !b.acted && S.res.fuel === f0, '移動の取り消し:残りも伊豆へ戻り、燃料は元どおり');
  ok(E.undoMove([a.id]).error, '取り消す移動が無ければ、そう答える');
  // 攻撃に出た部隊は動かせない
  S.regions.musashi.o = 'player'; S.regions.musashi.g = 9000;
  S.regions.kozuke.g = 100; S.regions.kozuke.fort = 0; S.factions[S.regions.kozuke.o].pact = 0;
  E.move([a.id], 'sagami'); E.move([a.id], 'izu');
  for (const x of g) { x.loc = 'musashi'; x.acted = false; delete x.from; delete x.mf; }
  S.res.fuel = 9000; S.res.ammo = 9000;
  const res = E.attack('kozuke', [a.id]);
  ok(res.win && a.acted && a.from == null && !E.movable(a) && Object.keys(E.moveTargets([a.id])).length === 0, '攻撃に出た部隊は、その季節はもう動かせない');
  // 季節が変わると、移動は確定する
  E.move([b.id], 'sagami'); E.endTurn();
  ok(b.loc === 'sagami' && !b.acted && b.from == null && b.mf == null && !E.moveTargets([b.id]).sagami, '季節が変わると確定し、そこが新しい出発地になる');
});

section('エクストリームハード', () => {
  const X = D.DIFFICULTY.extreme, keys = Object.keys(D.DIFFICULTY);
  ok(X && X.name === 'エクストリームハード' && keys.indexOf('extreme') === keys.indexOf('hell') + 1, '修羅の上にある');
  // ふだんの世界には、ローマもアメリカもいない
  E.newGame({ difficulty: 'hell', seed: 4 });
  let S = E.S;
  ok(['rome', 'usa', 'germania', 'inca', 'reich', 'soviet'].every(f => !S.factions[f].alive && !E.factionRegions(f).length), 'ほかの難しさでは、新しい国は眠ったまま');
  ok(E.lockedOverseas('hawaii') && E.attackOptions('hawaii').length === 0, 'ほかの難しさでは、統一まで海の向こうへ手を出せない');
  // 世界の成り立ち
  E.newGame({ difficulty: 'extreme', seed: 4 });
  S = E.S;
  const regs = f => E.factionRegions(f).sort().join(',');
  ok(regs('rome') === 'anatolia,balkans,britain,egypt,france,iberia,italy,n_africa' && S.factions.rome.alive && S.factions.rome.ind === 2, 'ローマ帝国が地中海を囲み、産業は「蒸気機関」の段');
  ok(regs('usa') === 'brazil,caribbean,colombia,mexico,na_east,na_west' && S.factions.usa.ind === 1, '新大陸にアメリカ合衆国');
  ok(S.regions.germany.o === 'germania' && S.regions.andes.o === 'inca' && S.regions.arabia.o === 'safavid', 'ゲルマニア・インカ・ペルシャ');
  ok(['spain', 'ottoman', 'hre', 'italia', 'france', 'england', 'saadi', 'brazil'].every(f => !S.factions[f].alive), 'この世界に無い国は、はじめから無い');
  ok(Object.keys(S.factions).every(f => !S.factions[f].alive || E.factionRegions(f).length > 0) && Object.keys(S.regions).every(id => S.regions[id].o === 'player' || S.factions[S.regions[id].o].alive), '生きている国は土地を持ち、土地の持ち主は生きている');
  ok(E.enemyPower('italy') > 15000 && S.factions.rome.q > S.factions.ming.q * 2, 'ローマは桁違いに強い(イタリアの戦力 ' + Math.round(E.enemyPower('italy')) + ')');
  // 開かれた海
  ok(!E.lockedOverseas('hawaii') && E.attackOptions('hawaii').some(o => o.ok), '統一の前から、海の向こうを攻められる');
  ok(E.diploOptions('hawaii').some(o => o.key === 'submit'), '統一の前から、海の向こうへ使者を送れる');
  // 列強は産業の段を進める
  const q0 = S.factions.rome.q;
  for (let i = 0; i < 16; i++) E.endTurn();
  ok(S.factions.rome.ind === 3 && S.factions.usa.ind === 2 && S.factions.rome.q > q0 + 0.3, '四年たつと、産業の段が上がり兵の質が伸びる(' + q0 + ' → ' + S.factions.rome.q + ')');
  // 最後の敵:兆し → 出現
  E.newGame({ difficulty: 'extreme', seed: 6 });
  S = E.S;
  const give = n => { let k = E.playerRegions().length; for (const id of Object.keys(S.regions)) { if (k >= n) break; if (S.regions[id].o !== 'player' && D.REGIONS[id].map === 'jp') { const prev = S.regions[id].o; S.regions[id].o = 'player'; S.regions[id].g = 90000; k++; if (!E.factionRegions(prev).length) S.factions[prev].alive = false; } } };
  const calm = () => { for (const f of Object.values(S.factions)) { f.war = false; f.pact = 9; } S.res.gold = 9000; S.res.food = 9000; S.flags.siege = 0; };
  give(27); calm(); E.endTurn();
  ok(E.bossState('reich') == null, '自領 27 では、まだ何も起きない');
  give(28); calm(); let r = E.endTurn();
  ok(E.bossState('reich') && E.bossState('reich').omen != null && E.bossState('reich').up == null && r.events.some(e => /妙な報せ/.test(e.t)), '自領 28 で、ドイツに兆し');
  ok(!S.factions.reich.alive && S.regions.germany.o === 'germania', '兆しの季節には、まだ現れない');
  calm(); r = E.endTurn();
  const card = r.events.find(e => e.big && e.big.title === '第三帝国');
  ok(S.factions.reich.alive && S.regions.germany.o === 'reich' && S.factions.reich.war && !!card && !S.factions.germania.alive, '次の季節に「第三帝国」が現れ、ゲルマニアは消える');
  ok(E.enemyPower('germany') > 40000, '本拠の戦力は桁違い(' + Math.round(E.enemyPower('germany')) + ')');
  ok(E.diploOptions('reich').length === 1 && E.diploOptions('reich')[0].key === 'locked' && E.submitChance('reich') === 0 && E.pactChance('reich') === 0, '交渉の余地はない');
  for (let i = 0; i < 10; i++) { calm(); S.factions.reich.war = true; E.endTurn(); }
  const nR = E.factionRegions('reich').length;
  ok(nR >= 4, '電撃戦で、隣の国を次々に呑みこむ(十季で ' + nR + ' 地域)');
  ok(E.bossState('soviet') == null, '二つめの敵は、まだ(自領 38 から)');
  give(38); calm(); E.endTurn(); calm(); E.endTurn();
  ok(S.factions.soviet.alive && S.regions.russia.o === 'soviet', '自領 38 で、ロシアに二つめの敵');
  // 本拠を落とすと、残りも崩れる(特別な画の合図つき)
  const reichRegs = E.factionRegions('reich');
  const base = E.links('germany').filter(l => !l.sea)[0].id;
  S.regions[base].o = 'player'; S.regions[base].g = 5000;
  S.regions.germany.g = 100; S.regions.germany.fort = 0;
  for (const u of S.units) if (D.UNIT_TYPES[u.type].cls === 'ground') { u.loc = base; u.acted = false; u.hp = 100; }
  S.res.fuel = 9000; S.res.ammo = 9000;
  const ids = E.attackOptions('germany').filter(o => o.ok && (o.via === 'land')).map(o => o.u.id);
  const res = E.attack('germany', ids);
  const down = (res.events || []).find(e => e.bossDown === 'reich');
  ok(res.win && !!down && down.cine === 'bunker' && down.big && /崩壊/.test(down.big.title), '本拠を落とすと崩壊の知らせ。特別な画(bunker)の合図がつく');
  ok(!S.factions.reich.alive && reichRegs.every(id => S.regions[id].o === 'player') && E.bossState('reich').down != null, '残る土地もすべて降る');
  // 自領で起きた場合:土地ごと奪われ、部隊は退く
  E.newGame({ difficulty: 'extreme', seed: 8 });
  S = E.S;
  S.regions.germany.o = 'player'; S.regions.germany.g = 3000; S.factions.germania.alive = false;
  S.regions.france.o = 'player'; S.regions.france.g = 3000;
  const u0 = S.units.find(u => D.UNIT_TYPES[u.type].cls === 'ground'); u0.loc = 'germany';
  S.flags.boss_reich = { omen: S.turn - 1 }; E.endTurn();
  ok(S.regions.germany.o === 'reich' && u0.loc === 'france' && u0.hp > 0, '自領のドイツで起きたら、土地を奪われ、部隊は隣へ退く');
  // 古いセーブ(新しい国が無い)も読める
  E.newGame({ difficulty: 'normal', seed: 2 });
  const old = JSON.parse(E.serialize()); for (const f of ['rome', 'usa', 'germania', 'inca', 'reich', 'soviet']) delete old.factions[f];
  let loaded = true; try { E.load(JSON.stringify(old)); } catch (e) { loaded = false; }
  ok(loaded && E.S.factions.rome && !E.S.factions.rome.alive, '新しい国が入る前のセーブも読みこめる');
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
