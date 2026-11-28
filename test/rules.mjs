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
  ok(E.build('izu', 'school').ok && S.regions.izu.bq[0].t === 2, '格上げは2季');
  ok(E.rushCost('izu') > 0, '急がせる費用が出る');
  const g0 = S.res.gold, rc = E.rushCost('izu'), rr = E.rush('izu');
  ok(rr.ok && S.res.gold === g0 - rc && S.regions.izu.bq[0].t === 1 && E.rushCost('izu') == null, '急がせると次の季節に仕上がる');
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
  const finish = k => { ok(E.build('izu', k).ok, k + ' を建てられる'); S.regions.izu.bq.forEach(w => { w.t = 1; }); E.endTurn(); };
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
  ok(E.build('echigo', 'oilwell').ok, '越後に油井'); S.regions.echigo.bq[0].t = 1; E.endTurn();
  const f1 = E.regionYield('echigo').fuel; S.techs.drill = true;
  ok(E.build('echigo', 'oilwell').ok, '機械掘りへ格上げ'); S.regions.echigo.bq[0].t = 1; E.endTurn();
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

section('おまかせの攻撃(勝算九割で仕掛ける)', () => {
  // 伊豆に自衛隊。駿河(今川・中立)と相模(北条・交戦中)が隣
  const fresh = (seed, atk) => {
    E.newGame({ seed }); const S = E.S;
    for (const f of Object.values(S.factions)) { f.war = false; f.pact = 0; f.trade = false; }
    for (const id of ['suruga', 'sagami']) { S.regions[id].g = 300; S.regions[id].gmax = 300; S.regions[id].fort = 0; }
    S.res.fuel = 2000; S.res.ammo = 2000; S.res.food = 5000; S.res.gold = 5000;
    if (atk) E.setAuto({ attack: atk });
    return S;
  };
  let S = fresh(21);
  ok(E.setAuto({ attack: 'all' }).attack === 'all' && E.setAuto({ attack: 'nonsense' }).attack === 'all' && E.setAuto({ attack: 'off' }).attack === 'off', '方針は、まかせない・交戦中だけ・すべて の三つ');
  E.endTurn();
  ok(S.regions.suruga.o !== 'player' && S.regions.sagami.o !== 'player', 'まかせていなければ、攻めない');
  // すべて:中立の今川にも仕掛ける
  S = fresh(21, 'all');
  ok(['suruga', 'sagami'].includes(E.autoFocus()), '狙いが決まる(' + E.autoFocus() + ')');
  let r = E.endTurn();
  const won = r.events.filter(e => e.auto && e.won);
  ok(S.regions.suruga.o === 'player' && S.regions.sagami.o === 'player' && won.length >= 2 && won[0].t.includes('を攻略した') && /勝算 \d+%/.test(won[0].t), '守りの薄い隣国を、同じ季節に続けて攻め取る: ' + won.map(e => e.t).join(' '));
  ok(S.units.every(u => u.type !== 'nuke') || true, '(核は持っていない)');
  // 交戦中だけ:中立の今川には手を出さない
  S = fresh(22, 'war'); S.factions.hojo.war = true;
  E.endTurn();
  ok(S.regions.sagami.o === 'player' && S.regions.suruga.o === 'imagawa' && !S.factions.imagawa.war, '「交戦中だけ」なら、北条の相模だけを攻める');
  // 不可侵と通商の相手は攻めない
  S = fresh(23, 'all'); S.factions.imagawa.pact = 5; S.factions.hojo.trade = true;
  E.endTurn();
  ok(S.regions.suruga.o === 'imagawa' && S.regions.sagami.o === 'hojo', '不可侵の今川と、通商の北条は攻めない');
  // 九割に届かなければ、見送る
  S = fresh(24, 'all');
  for (const id of Object.keys(S.regions)) if (S.regions[id].o !== 'player') { S.regions[id].g = 400000; S.regions[id].gmax = 400000; S.regions[id].fort = 5; }
  const b0 = S.stats.battles; E.endTurn();
  ok(S.stats.battles === b0 && E.autoFocus() == null, '勝ち目の薄い相手には仕掛けない(狙いも無し)');
  // 燃料と弾薬の予備を割るなら、使わない部隊だけで。足りなければ見送る
  const weakOnly = S0 => { for (const id of Object.keys(S0.regions)) if (S0.regions[id].o !== 'player' && id !== 'suruga' && id !== 'sagami') { S0.regions[id].g = 400000; S0.regions[id].gmax = 400000; S0.regions[id].fort = 5; } };
  S = fresh(25, 'all'); S.res.fuel = 100; S.res.ammo = 100; weakOnly(S);
  const k = E.autoKeep();
  ok(k.fuel === 150 && k.ammo === 150, '作れていないあいだの予備は、燃料 150・弾薬 150');
  E.endTurn();
  ok(S.regions.suruga.o !== 'player' && S.regions.sagami.o !== 'player' && S.res.ammo === 100, '予備を割る攻撃はしない(弾薬は減らない)');
  S = fresh(25, 'all'); S.res.fuel = 100; S.res.ammo = 100; weakOnly(S);
  for (let i = 0; i < 8; i++) S.units.push({ id: S.nextUid++, type: 'ashi', name: '足軽' + i, hp: 100, loc: 'izu', acted: false });
  E.endTurn();
  ok((S.regions.suruga.o === 'player' || S.regions.sagami.o === 'player') && S.res.ammo === 100, '現地歩兵団だけで届くなら、燃料も弾薬も使わずに攻める');
  // 狙われた土地を守っている部隊は出さない。核は使わない
  S = fresh(26, 'all');
  S.units.push({ id: S.nextUid++, type: 'nuke', name: '核', hp: 100, loc: null, acted: false });
  S.factions.hojo.war = true; S.threats = [{ from: 'sagami', to: 'izu', f: 'hojo', turn: S.turn + 1, sea: false }];
  ok(E.autoPlan('suruga', { izu: 1 }) == null || E.autoPlan('suruga', { izu: 1 }).ids.every(id => S.units.find(u => u.id === id).loc !== 'izu'), '狙われた伊豆の部隊は、編成に入らない');
  ok(E.autoPlan('suruga', {}).ids.every(id => S.units.find(u => u.id === id).type !== 'nuke'), '核は編成に入らない');
  E.endTurn();
  ok(S.units.some(u => u.type === 'nuke'), '季節が変わっても、核は残っている');
  // 部隊は、狙いの手前へ集まる
  S = fresh(27, 'all');
  for (const id of ['suruga', 'kai', 'shinano']) { S.regions[id].o = 'player'; S.regions[id].g = 9000; }
  for (const f of Object.values(S.factions)) { if (!E.factionRegions(Object.keys(S.factions).find(x => S.factions[x] === f)).length) f.alive = false; }
  for (const id of Object.keys(S.regions)) if (S.regions[id].o !== 'player') { S.regions[id].g = 600000; S.regions[id].gmax = 600000; S.regions[id].fort = 5; }
  const tgt = E.links('shinano').filter(l => !l.sea && S.regions[l.id].o !== 'player')[0].id;
  S.regions[tgt].g = 4000; S.regions[tgt].gmax = 4000; S.regions[tgt].fort = 0;
  ok(E.autoFocus() === tgt, '勝てそうなのは一国だけ。そこが狙いになる(' + D.REGIONS[tgt].name + ')');
  const dist0 = S.units.filter(u => u.loc === 'izu').length;
  S.regions[tgt].g = 30000; S.regions[tgt].gmax = 30000;   // いまの手前の兵力では届かないので、まず集まる
  r = E.endTurn();
  const closer = S.units.filter(u => u.loc && u.loc !== 'izu').length;
  ok(dist0 > 0 && closer > 0 && r.events.some(e => /前線へ \d+部隊/.test(e.t)), '伊豆の部隊が、狙いの手前へ動きだす(' + closer + ' 部隊)');
});

section('全軍で進む(攻め落とした土地へ、部隊が続く)', () => {
  const fresh = (seed, on) => {
    E.newGame({ seed }); const S = E.S;
    for (const f of Object.values(S.factions)) { f.war = false; f.pact = 0; f.trade = false; }
    for (const id of ['suruga', 'mikawa']) { S.regions[id].g = 300; S.regions[id].gmax = 300; S.regions[id].fort = 0; }
    S.res.fuel = 3000; S.res.ammo = 3000;
    if (on) E.setAuto({ follow: true });
    return S;
  };
  const land = S => S.units.filter(u => u.loc !== null), inf = S => S.units.find(u => u.type === 'inf');
  // 切ってあれば、これまでどおり:攻めた部隊だけが入る
  let S = fresh(31, false), a = inf(S), res = E.attack('suruga', [a.id]);
  ok(res.win && res.follow == null && land(S).filter(u => u.loc === 'suruga').length === 1, '切ってあれば、攻めた部隊だけが駿河に入る');
  // 入れると、伊豆の部隊がすべて続く。戦わなかった部隊は、行動を残したまま
  S = fresh(31, true); a = inf(S);
  const n0 = land(S).length, f0 = S.res.fuel;
  res = E.attack('suruga', [a.id]);
  const there = land(S).filter(u => u.loc === 'suruga'), followers = there.filter(u => u.id !== a.id);
  ok(res.win && res.follow && res.follow.n === n0 - 1 && there.length === n0 && res.follow.from.join() === 'izu', '入れると、伊豆の全部隊が駿河へ続く(' + (res.follow && res.follow.n) + ' 部隊)');
  ok(a.acted && followers.every(u => !u.acted && u.from == null && u.mf == null), '攻めた部隊は行動済み。続いた部隊は、行動を残している');
  ok(res.follow.fuel > 0 && S.res.fuel === f0 - res.fuel - res.follow.fuel, '燃料は、戦いのぶんと移動のぶんだけ減る(移動 −' + res.follow.fuel + ')');
  const b = followers.find(u => u.type === 'inf'), r2 = E.attack('mikawa', [b.id]);
  ok(r2.win && r2.follow && land(S).every(u => u.loc === 'mikawa' || u.id === a.id), '続いた部隊で、その先の三河を同じ季節に攻められる。残りも続く(先に攻めた部隊は駿河に残る)');
  ok(a.loc === 'suruga' && a.acted && !E.movable(a), '攻撃に出た部隊は、その季節はもう動かない');
  // 攻撃に出た部隊・狙われた土地の部隊・先に移動した部隊
  S = fresh(32, true); a = inf(S);
  const others = land(S).filter(u => u.id !== a.id), x = others[0], y = others[1];
  x.acted = true;                                    // 別の戦に出たことにする
  S.regions.sagami.o = 'player'; S.regions.sagami.g = 9000; E.move([y.id], 'sagami');   // 先に相模へ移動した部隊
  res = E.attack('suruga', [a.id]);
  ok(x.loc === 'izu' && x.acted, '別の戦に出た部隊は、伊豆に残る');
  ok(y.loc === 'suruga' && y.acted && y.from === 'izu', '先に移動していた部隊は、行き先が駿河に変わる(移動済みのまま)');
  S = fresh(33, true); a = inf(S);
  S.factions.hojo.war = true; S.threats = [{ from: 'sagami', to: 'izu', f: 'hojo', turn: S.turn + 1, sea: false }];
  res = E.attack('suruga', [a.id]);
  ok(res.follow.n === 0 && res.follow.stay > 0 && res.follow.guard === res.follow.stay && res.follow.dry === 0 && land(S).filter(u => u.loc === 'izu').length === land(S).length - 1, '狙われている伊豆を守る部隊は、残る');
  // 燃料の予備を割るなら、ほとんど燃料を使わない部隊だけが進む
  S = fresh(34, true); a = inf(S); S.res.fuel = 120;
  res = E.attack('suruga', [a.id]);
  const went = land(S).filter(u => u.loc === 'suruga' && u.id !== a.id), stayed = land(S).filter(u => u.loc === 'izu');
  ok(went.length > 0 && went.every(u => u.type === 'inf') && stayed.some(u => u.type === 'tank') && S.res.fuel >= 100 && res.follow.dry === stayed.length && res.follow.guard === 0, '燃料が乏しいと、歩兵だけが続き、戦車は残る(残り ' + S.res.fuel + ')');
  ok(E.setAuto({ follow: false }).follow === false, '切れる');
});

section('鳥たちの夢(最後の兵器と、禁断の手術)', () => {
  const T = id => D.TECHS.find(t => t.id === id), cost = id => T(id).cost;
  ok(['bundam', 'bunchorion', 'birdify', 'buncho2'].every(id => T(id) && T(id).tier === 9), '第九段階に、四つの研究がある');
  ok(T('birdify').manual && T('birdify').taboo && T('buncho2').manual && T('buncho2').taboo && !T('bundam').manual && !T('bunchorion').manual, '手術の二つは「司令の命令で」。兵器の二つは、鳥たちが自分で進める');
  ok(T('birdify').req.includes('bunchorion') && T('buncho2').req.includes('birdify'), '鳥化手術は汎用型鳥造決戦兵器のあと、ブンーチョウ手術は鳥化手術のあと');
  const fresh = (seed, upto) => {   // upto: 'pre' なら第八段階まで、'all' なら兵器の研究まで済んでいる
    E.newGame({ seed }); const S = E.S;
    for (const t of D.TECHS) if (!t.manual && (upto === 'all' || t.tier < 9)) S.techs[t.id] = true;
    for (const f of Object.values(S.factions)) { f.war = false; f.pact = 99; f.trade = false; }
    S.res.gold = 90000; S.res.steel = 90000; S.res.food = 900; S.autoResearch = true;
    return S;
  };
  const finish = tid => { const S = E.S; D.BIRDS.forEach(b => E.assign(b.id, tid)); S.prog[tid] = cost(tid) - 1; return E.endTurn(); };   // 司令が命じて、次の季節に成る
  const win = () => { const S = E.S; for (const id of Object.keys(S.regions)) S.regions[id].o = 'player'; return E.endTurn(); };
  const tog = (flag, fn) => { const S = E.S, v = S.flags[flag]; delete S.flags[flag]; const a = fn(); S.flags[flag] = v; return [a, fn()]; };   // その手術が無かった場合と、くらべる

  // ── 鳥たちは、兵器までは自分で進める。手術には手を付けない ──
  let S = fresh(41, 'pre');
  ok(E.bunPush() === null && E.techStatus('birdify') === 'locked', '兵器が成るまでは、手術は研究できない');
  E.autoAssign();
  ok(D.BIRDS.every(b => ['bundam', 'bunchorion'].includes(S.assign[b.id])), '手の空いた鳥は、ブンダムと汎用型鳥造決戦兵器に取りかかる');
  let intro = 0; const isIntro = e => e.big && e.big.title === '鳥たちの上申';
  for (let i = 0; i < 14 && !(S.techs.bundam && S.techs.bunchorion); i++) intro += E.endTurn().events.filter(isIntro).length;
  ok(S.techs.bundam && S.techs.bunchorion && D.BIRDS.every(b => !S.assign[b.id]) && !E.autoTechLeft(), '二つとも成ると、鳥たちの手が空く(手術には、自分からは手を付けない)');
  ok(E.bunPush() === 'birdify' && E.manualAvail().includes('birdify') && !E.manualAvail().includes('buncho2'), 'いま勧めてくるのは、鳥化手術');
  // ── やけに勧めてくる ──
  const n0 = S.stats.nag || 0, seen = new Set();
  let r, last = null;
  for (let i = 0; i < 7; i++) { r = E.endTurn(); intro += r.events.filter(isIntro).length; const g = r.events.filter(e => e.k === 'bird'); if (g.length === 1 && g[0].bun === 'birdify' && D.BIRDS.some(b => b.id === g[0].bird)) { seen.add(g[0].t); last = g[0]; } }
  ok(seen.size === 7 && S.stats.nag === n0 + 7, '毎季、一羽ずつ、ちがう言い方で勧めにくる(7季で7通り): ' + (last ? last.t.slice(0, 22) : '') + '…');
  ok(intro === 1 && S.chron.filter(c => /上申/.test(c.t)).length === 1, '最初の季節に一度だけ、七羽がそろって上申に来る');
  let hs = E.hints();
  ok(hs.filter(h => h.bird !== 'dario' && /鳥化手術/.test(h.text)).length === 2 && hs.some(h => h.bird === 'dario' && /私は、勧めません/.test(h.text) && /\d+ 通/.test(h.text)), '進言でも、鳥が二羽勧め、ダリオくんだけが勧めない');
  ok(!hs.some(h => /司令がご自分でお決めください/.test(h.text) && /鳥化手術/.test(h.text)), '控えめな進言(核兵器・超知能)には、手術は入らない');
  ok(D.BIRDS.every(b => !S.assign[b.id]) && !S.techs.birdify && !(S.prog.birdify > 0), 'どれだけ勧められても、命じなければ進まない');
  S.autoResearch = true; E.autoAssign();
  ok(D.BIRDS.every(b => !S.assign[b.id]), '「手の空いた鳥におまかせ」でも、手術には取りかからない');
  // ── 鳥化手術 ──
  D.BIRDS.forEach(b => E.assign(b.id, 'birdify'));
  r = E.endTurn();
  ok(r.events.filter(e => e.k === 'bird').every(e => !D.BUN.nag.birdify.some(x => x.t === e.t)), '命じたあとは、勧めるのをやめる(研究棟のようすだけが届く)');
  const att0 = S.factions.hojo.att; let big = null, attDrop = null;
  for (let i = 0; i < 30 && !S.techs.birdify; i++) { const a = S.factions.hojo.att; r = E.endTurn(); big = r.events.find(e => e.big && e.big.bun) || big; if (S.techs.birdify) attDrop = a - S.factions.hojo.att; }
  ok(S.techs.birdify && E.bunStage() === 1 && big && big.big.title === '鳥化手術' && big.big.bun === 1 && S.chron.some(c => c.k === 'bun'), '鳥化手術が成ると、節目の知らせと年表が残る');
  ok(attDrop === 15, '諸国の友好 −15(' + att0 + ' → ' + S.factions.hojo.att + ')');
  let [f0, f1] = tog('bun', () => E.income().upkeep.food), [m0, m1] = tog('bun', () => E.moodTarget('izu'));
  ok(Math.abs(f1 - f0 * 0.7) < 1e-9 && m1 === m0 + 10, '兵糧の消費 −30%、民心 +10(消費 ' + f0.toFixed(1) + ' → ' + f1.toFixed(1) + ')');
  ok(E.bunRate() > 0 && E.bunRate() <= 55 && E.nation().name !== 'B.U.N society', '鳥になった民は半分ほどまで。国の名は、まだ変わらない');
  // 海を、輸送艦なしで渡る
  S.regions.sagami.o = 'player'; S.units = S.units.filter(u => D.UNIT_TYPES[u.type].cls !== 'naval');
  const foot = S.units.find(u => u.type === 'inf'); foot.loc = 'sagami';
  let [pa, pb] = tog('bun', () => E.predictAttack('boso', [foot.id]).problems.some(x => /海上輸送力/.test(x)));
  ok(pa === true && pb === false, '房総へ、輸送艦なしで上陸できる(手術の前は、船が要る)');
  S.regions.boso.o = 'player';
  let [ma, mb] = tog('bun', () => { const t = E.moveTargets([foot.id]).boso; return !!(t && t.ok); });
  ok(ma === false && mb === true, '自領どうしも、海を飛んで移れる');
  ok(E.voices(6).length > 0 && [1, 2, 3, 4, 5, 6].some(k => { S.turn += 1; const v = E.voice('izu'); return v && D.VOICES.bun.some(x => x.t === v.t); }), '民の声に、鳥になった者の声がまじる');
  // ── すぐに、次を勧めてくる ──
  ok(E.bunPush() === 'buncho2', '鳥化手術が成ると、こんどはブンーチョウ手術を勧めてくる');
  r = E.endTurn();
  ok(r.events.some(e => e.k === 'bird' && e.bun === 'buncho2'), 'ブンーチョウ手術の勧めが届く');
  // ── ブンーチョウ手術 ──
  S.factions.imagawa.att = 10; S.factions.imagawa.pride = 30; S.factions.imagawa.pact = 0;
  r = finish('buncho2');
  ok(S.techs.buncho2 && E.bunStage() === 2 && r.events.some(e => e.big && e.big.bun === 2 && e.big.title === 'B.U.N society'), 'ブンーチョウ手術が成ると、「B.U.N society」の知らせ');
  ok(E.nation().name === 'B.U.N society' && E.bunRate() === 100 && !r.events.some(e => e.big && e.big.nation != null), '国の名が「B.U.N society」になる(国号改めの知らせは、別には出ない)。鳥になった民 100%');
  [f0, f1] = tog('bun2', () => E.income().upkeep.food); [m0, m1] = tog('bun2', () => E.moodTarget('izu'));
  ok(Math.abs(f1 / f0 - 0.5 / 0.7) < 1e-9 && m1 === m0 + 5, '兵糧の消費は −50% に、民心は +15 に');
  const [r0, r1] = tog('bun2', () => E.researchMult()), [d0, d1] = tog('bun2', () => E.defensePower('boso')), [c0, c1] = tog('bun2', () => E.submitChance('imagawa'));
  ok(Math.abs(r1 - r0 * 1.5) < 1e-9, '研究速度 +50%');
  ok(Math.abs(d1 - d0 * 1.5) < 1e-6 && d0 > 0, '守備隊の戦力 1.5倍(房総 ' + Math.round(d0) + ' → ' + Math.round(d1) + ')');
  const ashi = give('ashi'), [a0, a1] = tog('bun2', () => E.ustat(ashi).atk);
  ok(Math.abs(a1 - a0 * 1.5) <= 1, '現地歩兵団の戦力 1.5倍');
  ok(c0 > 0 && c0 < 80 && c1 === c0 + 15, '降伏勧告の成功率 +15(' + c0 + ' → ' + c1 + ')');
  ok(D.VOICES.bun2.some(x => x.t === E.voice('izu').t), '民の声は、文鳥の声になる: ' + E.voice('izu').t);
  r = E.endTurn();
  ok(E.bunPush() === null && r.events.filter(e => e.k === 'bird').length === 1 && r.events.some(e => e.gachi && D.BUN.gachi.some(g => e.t.startsWith(g.split('{r}')[0]))), '勧めるものは、もう無い。かわりに、季節ごとにG.A.C.H.I Fight の便りが届く');
  ok(E.eraStage() === 10 && D.ERAS[10].name === 'ガチの世', '時代は「ガチの世」になる');
  const rev0 = S.stats.revolts; for (let i = 0; i < 12; i++) { S.regions.izu.mood = 0; E.endTurn(); }
  ok(S.stats.revolts === rev0, '民心が底でも、一揆は起きない(不満は、殴り合いで決着がつく)');
  const j = E.serialize(); E.load(j); S = E.S;
  ok(E.serialize() === j && E.bunStage() === 2 && E.nation().name === 'B.U.N society', 'セーブの往復で変わらない');
  // ── 結末 ──
  r = win();
  let e = r.events.find(x => x.big && x.big.bun === 2 && /片手で引きちぎって/.test(x.big.body));
  ok(S.over && S.over.win && S.over.bun === 2 && e && !/\{date\}/.test(e.big.body) && /G\.A\.C\.H\.I Fight/.test(e.big.body) && /ここから始まる/.test(e.big.body), '地球を一つにすると、結末は「B.U.N society」(ブンーチョウ手術まで)');
  S = fresh(42, 'all'); finish('birdify'); r = win(); e = r.events.find(x => x.big && x.big.bun === 1 && /人の半分は/.test(x.big.body));
  ok(S.over.win && S.over.bun === 1 && e && E.nation().name === 'B.U.N society', '鳥化手術だけでも、結末は「B.U.N society」になる。国の名も、そこで変わる');
  S = fresh(43, 'all'); r = win();
  ok(S.over.win && !S.over.bun && E.nation().name === '惑星日本' && !r.events.some(x => x.big && x.big.bun), '手術を命じなければ、結末は変わらない(惑星日本)');
  S = fresh(44, 'all'); finish('asi'); finish('birdify'); r = win();
  ok(S.flags.asi != null && S.over.win && S.over.bun === 1 && S.over.asi === true && E.nation().name === 'B.U.N society', '超知能を起こしていても、手術を進めていれば「B.U.N society」になる');
  S = fresh(45, 'all'); win(); ok(S.over.win && !S.over.bun, '(先に、ふつうに統一する)');
  E.keepGoing(); r = finish('birdify');
  ok(S.over.bun === 1 && r.events.some(x => x.big && x.big.bun === 1) && E.nation().name === 'B.U.N society', '統一のあとで手術を進めても、結末は「B.U.N society」に変わる');

  // ── 土地の名 ──
  S = fresh(48, 'all');
  const N0 = Object.fromEntries(Object.keys(D.REGIONS).map(id => [id, D.REGIONS[id].name]));
  ok(N0.izu === '伊豆' && N0.yamashiro === '山城' && E.eraStage() === 7, '手術の前は、もとの名(時代は「人工知能の世」)');
  S.regions.sagami.o = 'player';
  finish('birdify');
  ok(D.REGIONS.izu.name !== '伊豆' && D.REGIONS.izu.name.startsWith('伊豆') && D.REGIONS.sagami.name !== '相模' && D.REGIONS.sagami.name.startsWith('相模') && D.REGIONS.suruga.name === '駿河' && E.eraStage() === 9,
    '鳥化手術のあと、治めている土地の名に鳴き声が付く(' + D.REGIONS.izu.name + '、' + D.REGIONS.sagami.name + ')。よその土地は、そのまま。時代は「鳥の世」');
  finish('buncho2');
  ok(D.REGIONS.izu.name === 'ガチ伊豆本部' && D.REGIONS.sagami.name === 'サガミ筋' && D.REGIONS.suruga.name === '駿河' && E.realName('izu') === '伊豆', 'ブンーチョウ手術のあと、名がひどいことになる(' + D.REGIONS.izu.name + '、' + D.REGIONS.sagami.name + ')');
  S.factions.imagawa.pact = 0; S.regions.suruga.g = 100; S.regions.suruga.gmax = 100; S.regions.suruga.fort = 0;
  const rr = E.attack('suruga', [S.units.find(x => x.type === 'inf').id]);
  ok(rr.win && D.REGIONS.suruga.name === 'スルガチ' && S.log.some(x => /スルガチを攻略した/.test(x.t)), '攻め落とした土地も、その場で名が変わる(駿河 → スルガチ)');
  S.regions.suruga.o = 'imagawa'; E.endTurn();
  ok(D.REGIONS.suruga.name === '駿河', '失った土地は、もとの名に戻る');
  for (const id of Object.keys(S.regions)) S.regions[id].o = 'player'; E.applyNames();
  ok(Object.keys(D.REGIONS).every(id => D.REGIONS[id].name && D.REGIONS[id].name !== N0[id] && !D.REGIONS[id].name.includes('・') && D.REGIONS[id].name.length <= 9), 'すべての土地に、もとと違う名が付く(区切りなし、9字まで)');
  E.applyNames(true); ok(Object.keys(D.REGIONS).every(id => D.REGIONS[id].name === N0[id]), 'もとの名に戻せる(表紙や年代記のあいだ)');
  const jn = E.serialize(); E.newGame({ seed: 1 });
  ok(D.REGIONS.izu.name === '伊豆', '新しく始めれば、もとの名');
  E.load(jn); S = E.S;
  ok(D.REGIONS.izu.name === 'ガチ伊豆本部', 'セーブを読み込めば、また変わった名になる');
  E.newGame({ seed: 2 });
  // ── 三つの兵器 ──
  S = fresh(47, 'all'); S.regions.izu.fac.arsenal = 1; S.regions.izu.fac.airfield = 1; S.regions.izu.fac.bauxite = 1; S.regions.izu.ctl = 100; S.res.food = 1200;
  let po = Object.fromEntries(E.produceOptions('izu').map(o => [o.type, o]));
  ok(po.bundam && po.bundam.ok && po.inkorion && po.inkorion.ok && po.bunchorion && !po.bunchorion.ok && po.bunchorion.why === '兵糧不足', '工廠でブンダム、飛行場でインコリオンを作れる。ブンチョリオンは粟(兵糧 1500)が要る');
  ok(E.produce('izu', 'bundam').ok && S.res.gold === 90000 - 8000 && S.res.steel === 90000 - 4000, 'ブンダムの建造に、資金 8000 と鉄鋼 4000');
  for (let i = 0; i < 8 && !S.units.some(u => u.type === 'bundam'); i++) E.endTurn();
  const made = S.units.find(u => u.type === 'bundam');
  ok(made && made.name === 'ブンダム1号機' && made.loc === 'izu', '完成すると「ブンダム1号機」と名が付く');
  E.setAuto({ make: true }); S.regions.izu.p = null; S.res.gold = 90000; S.res.food = 5000;
  ok(E.autoMake()[0] === 'bunchorion', 'おまかせの編成は、作れるならブンチョリオンから');
  S.regions.izu.p = null; S.res.gold = 90000; S.res.food = 0;
  ok(E.autoMake()[0] === 'bundam', '粟が足りなければ、ブンダムを作る');
  E.setAuto({ make: false }); S.regions.izu.p = null;
  const tgt = 'suruga', R = S.regions[tgt]; S.factions.imagawa.pact = 0;
  const bz = give('bunchorion'), bd = give('bundam'), ik = give('inkorion'), ik2 = give('inkorion'), A = E.ustat(bz).atk;
  const setE = want => { R.g = 1000000; R.gmax = 1000000; R.fort = 0; const k = E.enemyPower(tgt); R.g = Math.round(1000000 * want / k / 100) * 100; R.gmax = R.g; return E.enemyPower(tgt); };
  // 暴走:劣勢のときだけ
  setE(A * 0.5); let pr = E.predictAttack(tgt, [bz.id]);
  ok(!pr.berserk && pr.P === A && !pr.parts[0].tag.includes('暴走'), '優勢なら、ブンチョリオンは暴走しない');
  setE(A * 1.5); pr = E.predictAttack(tgt, [bz.id]);
  ok(pr.berserk && pr.P === A * 2 && pr.parts[0].tag.includes('暴走') && pr.chance > 0.9, '劣勢になると暴走して、戦力が2倍になる(勝算 ' + Math.round(pr.chance * 100) + '%)');
  // 口まね:敵の戦力を3割そぐ(重ねても3割)
  const p0 = E.predictAttack(tgt, [bd.id]), p1 = E.predictAttack(tgt, [bd.id, ik.id]), p2 = E.predictAttack(tgt, [bd.id, ik.id, ik2.id]);
  ok(p0.jam === 0 && p1.jam === 0.3 && p1.E0 === p0.E && Math.abs(p1.E - p0.E * 0.7) <= 1 && p2.E === p1.E && p1.parts.some(x => x.tag.includes('口まね')), 'インコリオンが加わると、敵の戦力 −30%(二機いても同じ)');
  ok(!p1.canCapture === false && E.predictAttack(tgt, [ik.id]).canCapture === false, 'インコリオンだけでは、占領できない(空の兵器)');
  // 盾:いっしょに戦う部隊の損耗を半分に
  const base = x => x >= 1 ? Math.min(25, Math.max(0.5, 6 / x)) : Math.min(50, Math.max(10, 12 / Math.max(0.1, x)));
  const q0 = E.predictAttack(tgt, [bz.id]), q1 = E.predictAttack(tgt, [bz.id, bd.id]);
  ok(q0.cover === 1 && q1.cover === 0.5 && Math.abs(q1.lossPct - base(q1.ratio) * 0.7 * 0.5) < 1e-9 && Math.abs(q0.lossPct - base(q0.ratio) * 0.7) < 1e-9 && q1.parts.some(x => x.tag.includes('盾')), 'ブンダムがいると、損耗の見込みが半分になる');
  // 暴走して勝つ:自分も、取った土地も傷む
  setE(A * 1.5);
  const res = E.attack(tgt, [bz.id]);
  ok(res.win && res.berserk && res.events.some(x => /ブンチョリオンが暴走した/.test(x.t)) && S.regions[tgt].mood === 8 && bz.hp <= 90 && bz.loc === tgt, '暴走して攻め落とすと、民心がさらに −20(28 → 8)、機体も傷む(' + bz.hp + '%)');
  ok(JSON.stringify(D).includes('禁断の手術') && JSON.stringify(D).includes('鳥たちの夢(最後の兵器)'), '説明に「鳥たちの夢(最後の兵器)」と「禁断の手術」がある');
});

section('燃料と弾薬が尽きたときの助言', () => {
  E.newGame({ seed: 16 });
  const S = E.S, has = re => E.hints().some(h => re.test(h.text));
  ok(!has(/作りきれていません/) && !has(/立て直せます/), 'はじめは出ない');
  S.techs.steam = true; S.techs.ammo = true; S.regions.izu.fac.arsenal = 1;
  ok(E.income().net.ammo === 15 && !has(/作りきれていません/), '鉄鋼があれば、工廠は毎季 15 の弾薬を作る');
  S.res.steel = 0;
  const inc = E.income();
  ok(inc.net.ammo < inc.ammoCap && has(/鉄鋼が足りず、弾薬を作りきれていません/), '鉄鋼が尽きると作りきれず、参謀がそう言う(' + inc.net.ammo + ' / ' + inc.ammoCap + ')');
  S.res.fuel = 0; S.res.ammo = 0;
  ok(has(/立て直せます。現地歩兵団/), '燃料も弾薬も尽きたら、立て直し方を言う');
  const ashi = E.produceOptions('izu').find(o => o.type === 'ashi');
  ok(ashi && ashi.ok && !ashi.cost.steel && E.produce('izu', 'ashi').ok, '現地歩兵団は、燃料も弾薬も鉄鋼も無しで編成できる');
});

section('建設は、統治と研究が進むと同時に進められる', () => {
  E.newGame({ seed: 14 });
  let S = E.S;
  S.res.gold = 5000; S.res.steel = 2000;
  S.regions.sagami.o = 'player'; S.regions.sagami.ctl = 35; S.regions.sagami.g = 9000; S.regions.sagami.fort = 2;
  for (const f of Object.values(S.factions)) { f.war = false; f.pact = 9; }
  ok(E.buildSlots('izu') === 2 && E.buildSlots('sagami') === 1, 'はじめは、統治の行き届いた本拠が二つ、取ったばかりの土地は一つ');
  ok(/統治80%で \+1/.test(E.buildSlotsWhy('sagami')) && /統治 \+1/.test(E.buildSlotsWhy('izu')) && /「鉄道」で \+1/.test(E.buildSlotsWhy('izu')), '内訳が言葉で出る(' + E.buildSlotsWhy('sagami') + ')');
  ok(E.build('sagami', 'farm').ok && E.build('sagami', 'market').error === '別の建設が進行中', '統治の浅い土地では、工事は一つずつ');
  S.regions.sagami.ctl = 80;
  ok(E.buildSlots('sagami') === 2 && E.build('sagami', 'market').ok && S.regions.sagami.bq.length === 2, '統治が 80% に届くと、二つ同時に進められる');
  ok(/同時に進められる工事は 2 つまで/.test(E.build('sagami', 'school').error || ''), '枠がいっぱいなら断る(' + E.build('sagami', 'school').error + ')');
  S.techs.rail = true; ok(E.buildSlots('sagami') === 3, '「鉄道」で三つ');
  S.techs.electric = true; ok(E.buildSlots('sagami') === 4 && E.buildSlots('izu') === 4, '「電力」で四つ');
  ok(E.build('sagami', 'school').ok && E.build('sagami', 'fort').ok && S.regions.sagami.bq.length === 4 && /4 つまで/.test(E.build('sagami', 'airfield').error || ''), '四つまで並べられ、五つめは断る');
  ok(/建設中/.test((E.buildOptions('sagami').find(o => o.key === 'farm') || {}).why || ''), '同じ施設を二重には建てられない');
  // 急がせるのは、工事ごと
  const fortW = S.regions.sagami.bq.find(w => w.k === 'fort'), schW = S.regions.sagami.bq.find(w => w.k === 'school');
  fortW.t = 3; schW.t = 3;
  const c = E.rushCost('sagami', 'fort'), g0 = S.res.gold, rr = E.rush('sagami', 'fort');
  ok(c > 0 && rr.ok && rr.key === 'fort' && S.res.gold === g0 - c && fortW.t === 1 && schW.t === 3, '城だけを急がせる。学問所の工事はそのまま');
  ok(E.rushCost('sagami', 'fort') == null && E.rushCost('sagami', 'school') > 0, '急がせた工事は、もう急がせられない');
  // 一季でまとめて進む
  const fort0 = S.regions.sagami.fort, r = E.endTurn(), done = r.events.filter(e => /相模.*完成した/.test(e.t)).length;
  ok(S.regions.sagami.fac.farm === 1 && S.regions.sagami.fac.market === 1 && S.regions.sagami.fort === fort0 + 1 && done === 3, '農地・楽市・城が同じ季節に仕上がる(完成の知らせ ' + done + ' 件)');
  ok(S.regions.sagami.bq.length === 1 && S.regions.sagami.bq[0].k === 'school' && S.regions.sagami.bq[0].t === 2, '残りの工事は一季ぶん進む');
  // 一揆は、すべての工事を遅らせる。土地を失えば、工事は消える
  E.build('sagami', 'airfield'); const ts = S.regions.sagami.bq.map(w => w.t);
  S.regions.sagami.mood = 0; let rev = false;
  for (let i = 0; i < 60 && !rev; i++) { const before = S.stats.revolts; S.regions.sagami.mood = 0; S.regions.sagami.bq.forEach((w, k) => { w.t = ts[k] + 5; }); E.endTurn(); rev = S.stats.revolts > before; if (rev) ok(S.regions.sagami.bq.every((w, k) => w.t === ts[k] + 5), '一揆が起きると、どの工事も一季遅れる'); }
  ok(rev, '(一揆が起きた)');
  // 工事が一つずつだったころのセーブも読める
  const old = JSON.parse(E.serialize());
  for (const id of Object.keys(old.regions)) { const q = old.regions[id].bq; old.regions[id].b = q.length ? q[0] : null; delete old.regions[id].bq; }
  E.load(JSON.stringify(old)); S = E.S;
  ok(Array.isArray(S.regions.izu.bq) && S.regions.izu.b === undefined && S.regions.sagami.bq.length === 1, '古いセーブの工事は、そのまま引き継がれる');
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

section('難易度「お前は頭がおかしい」', () => {
  const X = D.DIFFICULTY.insane, EX = D.DIFFICULTY.extreme, keys = Object.keys(D.DIFFICULTY), MEMES = ['academy', 'xina', 'prank', 'messi', 'cr7', 'mbappe', 'neymar'], TEAMS = ['messi', 'cr7', 'mbappe', 'neymar'];
  ok(X && X.meme && X.boss && X.alt && X.open && X.enemy === EX.enemy && X.siege === EX.siege && keys.indexOf('insane') === keys.indexOf('extreme') + 1, 'エクストリームハードの決まりを土台に、その上にある');
  const calm = () => { for (const [id, f] of Object.entries(E.S.factions)) if (!E.isBoss(id)) { f.war = false; f.pact = 99; } E.S.threats = []; };
  const skip = (to, n) => { const S = E.S, all = []; S.turn = to; for (let i = 0; i < (n || 2); i++) { calm(); all.push(...E.endTurn().events); } return all; };
  // ほかの難易度には現れない
  E.newGame({ difficulty: 'extreme', seed: 61 }); let S = E.S, evs = skip(110, 3);
  ok(MEMES.every(id => !S.flags['boss_' + id] && !S.factions[id].alive) && E.bossUp('reich') && S.factions.reich.leader === '総統' && !evs.some(e => e.meme), 'エクストリームハードには、ミームの勢力は現れない(第三帝国も、これまでどおり)');
  // サッカーの四か国
  E.newGame({ difficulty: 'insane', seed: 62 }); S = E.S;
  ok(MEMES.every(id => S.factions[id] && !S.factions[id].alive), 'はじめは、どれも眠っている');
  evs = skip(20, 2);
  ok(evs.some(e => /ボールを持った男/.test(e.t)) && evs.filter(e => e.big && e.big.title === '四か国対抗戦').length === 1, '20季めに前ぶれ、次の季節に四か国がそろって現れる(知らせは一枚)');
  ok(TEAMS.every(id => E.bossUp(id) && !S.factions[id].war && E.derbyQuiet(id)) && S.regions.laplata.o === 'messi' && S.regions.iberia.o === 'cr7' && S.regions.france.o === 'mbappe' && S.regions.brazil.o === 'neymar', 'アルゼンチン・ポルトガル・フランス・ブラジルに現れ、こちらとは戦っていない');
  ok(E.diploOptions('messi')[0].name === '試合中' && E.submitChance('cr7') === 0, '外交の窓口は「試合中」');
  const g0 = TEAMS.map(id => S.regions[E.bossOf(id).home].g).join();
  evs = skip(22, 12);
  const matches = evs.filter(e => /四か国対抗戦:/.test(e.t));
  ok(matches.length >= 5 && TEAMS.every(id => E.bossUp(id) && !S.factions[id].war) && TEAMS.map(id => S.regions[E.bossOf(id).home].g).join() !== g0, '四か国は、互いに試合をつづける(12季で ' + matches.length + ' 試合)。守備兵が増えたり減ったりする');
  ok(!evs.some(e => e.k === 'warn' && TEAMS.some(id => e.fid === id)) && TEAMS.every(id => E.factionRegions(id).length === 1), 'こちらにも、ほかの国にも、手を出さない');
  // おまかせの攻撃は、勝手に手を出さない
  S.regions.italy.o = 'player'; S.regions.italy.g = 9000; S.regions.france.g = 100; S.regions.france.gmax = 100; S.regions.france.fort = 0;
  S.units.forEach(u => { if (u.loc !== null) u.loc = 'italy'; u.acted = false; }); S.res.fuel = 9000; S.res.ammo = 9000;
  E.setAuto({ attack: 'all' });
  ok(E.links('italy').some(l => l.id === 'france') && !E.autoTargets().some(t => t.id === 'france'), 'おまかせの攻撃は、サッカーの四か国を狙わない');
  E.setAuto({ attack: 'off' });
  ok(E.hints().some(h => /サッカーの四か国は、互いに試合をしているだけ/.test(h.text)), '接したら、参謀が念を押す');
  // 手を出す
  const q0 = S.factions.messi.q, inf = S.units.find(u => u.type === 'inf');
  const res = E.attack('france', [inf.id]);
  ok(res.win && S.flags.derbyBroken != null && res.events.some(e => e.big && e.big.title === 'ドリームチーム'), '手を出すと、四人が手を組む');
  ok(['messi', 'cr7', 'neymar'].every(id => S.factions[id].war && !E.derbyQuiet(id)) && Math.abs(S.factions.messi.q - (q0 + 1.5)) < 0.011, '残る三か国が宣戦し、兵の質が上がる(' + q0 + ' → ' + S.factions.messi.q + ')');
  ok(!S.factions.mbappe.alive && res.events.some(e => e.big && e.big.title === 'エムバペのフランス、試合終了' && /エムバペは、ボールを抱えたまま/.test(e.big.body)), '本拠を落とされた国は、試合終了');
  evs = skip(40, 6);
  ok(!evs.some(e => /四か国対抗戦:/.test(e.t)), '手を組んだあとは、もう互いに試合をしない');
  // 学園都市:耐久力
  ok(E.bossUp('academy') && S.regions.korea.o === 'academy' && E.bossOf('academy').tough === 0.25, '朝鮮に、某学園都市が現れている');
  S.regions.korea.g = 60000; S.regions.korea.gmax = 60000;
  const jet = S.units.find(u => u.type === 'jet'); jet.acted = false; jet.hp = 100; S.regions.izu.fac.airfield = 1;
  const b1 = E.attack('korea', [jet.id]);
  const want = Math.round(60000 * (1 - Math.min(0.6, Math.max(0.08, 0.3 * b1.ratio)) * 0.25) / 100) * 100;
  ok(b1.bombard && S.regions.korea.g === want && want > 60000 * 0.84, '学園都市への砲爆撃は、ふつうの四分の一しか効かない(6万 → ' + S.regions.korea.g + ')');
  // アイスと蜂蜜の国、迷惑動画の国、総統閣下
  evs = skip(52, 2).concat(skip(76, 2)).concat(skip(84, 2));
  ok(E.bossUp('xina') && S.regions.huabei.o === 'xina' && E.bossOf('xina').hide === true && E.bossUp('prank') && S.regions.na_east.o === 'prank', '華北にアイスと蜂蜜の国、北米東部に迷惑動画の国が現れる');
  ok(E.bossUp('reich') && S.factions.reich.leader === '総統閣下' && evs.some(e => e.big && e.big.title === '総統閣下は、お怒りのようです') && evs.some(e => /言っていない内容の字幕/.test(e.t)), '第三帝国は、字幕つきで現れる');
  const hp0 = S.units.reduce((a, u) => a + u.hp, 0), mood0 = E.playerRegions().reduce((a, id) => a + S.regions[id].mood, 0);
  evs = skip(86, 24);
  const rants = evs.filter(e => /^総統閣下は、.+に、お怒りのようです。$/.test(e.t)), beams = evs.filter(e => e.meme && e.fid === 'prank');
  ok(rants.length >= 8 && new Set(rants.map(e => e.t)).size >= 8, '総統閣下は、毎季ちがうことに怒っている(24季で ' + rants.length + ' 回)');
  ok(beams.length >= 3 && beams.every(e => /ビーム|牛乳|叫んで/.test(e.t)), '迷惑動画の国は、接していなくても騒ぎを起こす(ビームは届く): ' + (beams[0] ? beams[0].t.slice(0, 30) : '') + '…');
  // 接すると、蜂蜜を取られる
  S.regions.manchuria.o = 'player'; S.regions.manchuria.g = 99000; S.regions.jiangnan.o = 'player'; S.regions.jiangnan.g = 99000; S.res.food = 5000;
  evs = skip(120, 16);
  ok(evs.some(e => e.meme && e.fid === 'xina' && /黄色いクマ|ジョン・シナ/.test(e.t)), 'アイスと蜂蜜の国と接すると、クマが兵糧庫に来る');
  const j = E.serialize(); E.load(j); S = E.S;
  ok(E.serialize() === j && S.flags.derbyBroken != null && E.bossUp('prank'), 'セーブの往復で変わらない');
  for (const id of Object.keys(S.regions)) S.regions[id].o = 'player';
  E.endTurn();
  ok(S.over && S.over.win, 'それでも、地球は一つにできる');
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
