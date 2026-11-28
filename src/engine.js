/* 天下布鳥 — ゲームエンジン(規則と状態)。DOM には触れない。Node でもそのまま動く。 */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};
  var D = TF.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
  if (!D.NATION && typeof require !== 'undefined') require('./lore.js'); // 国号・施策・民の声
  var MAP = null, LINKS = {}, LL = {};
  var S = null;        // 現在の状態
  var REPORT = null;   // ターン終了時に集める出来事

  var SAVE_VERSION = 1;
  var MEN = 50;          // 兵50人で戦力1(槍足軽の場合)
  function lockedOverseas(rid) { return D.REGIONS[rid].map === 'w' && S.flags.unified == null; }
  var TECH_BY_ID = {};
  D.TECHS.forEach(function (t) { TECH_BY_ID[t.id] = t; });
  var BIRD_BY_ID = {};
  D.BIRDS.forEach(function (b) { BIRD_BY_ID[b.id] = b; });
  BIRD_BY_ID.dario = D.DARIO; // 鳥ではないが、進言や台詞の話者として同じ表で引けるようにする
  // 手の空いた鳥が自動で選ぶ順番(石油と鉄を最優先)
  var RESEARCH_PRIORITY = ['distill', 'blast', 'agri', 'powder', 'survey', 'hygiene', 'steam', 'ammo', 'drill', 'bessemer', 'rifle',
    'steamship', 'telegraph', 'fertilizer', 'rail', 'electric', 'cracking', 'engine', 'mg', 'machine', 'medicine', 'radio', 'geophys',
    'tank', 'aluminium', 'aircraft', 'turbine', 'electronics',
    // ここから先は現代と未来。研究を速める計算機の系統を先に。核兵器と超知能は司令が自分で命じたときだけ進む(manual)
    // 施設の格上げを解く研究(用水・銀行・品種改良…)は本筋の合間に。得意な鳥は、手が空けば先に取りかかる
    'computer', 'catcrack', 'jet', 'irrigation', 'bank', 'network', 'modern', 'breeding', 'corp', 'assembly', 'tractor', 'offshore', 'retail',
    'nuclear', 'deeplearn', 'rocket', 'llm', 'agi', 'drone', 'fusion', 'laser', 'orbital', 'birdmech'];
  var POLICY_BY_ID = {};
  (D.POLICIES || []).forEach(function (p) { POLICY_BY_ID[p.id] = p; });

  // ───────────────────────── 初期化 ─────────────────────────
  function init(mapdata) {
    MAP = mapdata || root.MAPDATA || null;
    LINKS = {}; LL = {};
    Object.keys(D.REGIONS).forEach(function (id) { LINKS[id] = []; });
    function add(a, b, sea) {
      if (!LINKS[a] || !LINKS[b] || a === b) return;
      if (LINKS[a].some(function (l) { return l.id === b; })) return;
      LINKS[a].push({ id: b, sea: sea }); LINKS[b].push({ id: a, sea: sea });
    }
    var removed = {};
    D.ADJ_REMOVE.forEach(function (p) { removed[p.slice().sort().join('|')] = 1; });
    ['japan', 'world'].forEach(function (k) {
      var m = MAP && MAP[k]; if (!m) return;
      (m.adj || []).forEach(function (p) { if (!removed[p.slice().sort().join('|')]) add(p[0], p[1], false); });
      Object.keys(m.regions).forEach(function (id) { if (D.REGIONS[id]) LL[id] = m.regions[id].ll; });
    });
    D.ADJ_ADD.forEach(function (p) { add(p[0], p[1], false); });
    D.SEA_LINKS.forEach(function (p) { add(p[0], p[1], true); });
  }

  function rnd() { // mulberry32。状態に種を持つので、同じ種なら同じ展開になる
    S.seed = (S.seed + 0x6D2B79F5) | 0;
    var t = Math.imul(S.seed ^ (S.seed >>> 15), 1 | S.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function r100(x) { return Math.round(x / 100) * 100; }

  function newGame(opts) {
    opts = opts || {};
    var dk = D.DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
    var diff = D.DIFFICULTY[dk], st = D.START;
    S = {
      v: SAVE_VERSION, diff: dk, seed: (opts.seed != null ? opts.seed : Math.floor(Math.random() * 2147483647)) | 0,
      turn: 0,
      res: { gold: st.gold, food: Math.round(st.food * diff.stock), steel: st.steel, fuel: Math.round(st.fuel * diff.stock), ammo: Math.round(st.ammo * diff.stock) },
      prestige: st.prestige, regions: {}, factions: {}, units: [], nextUid: 1,
      techs: {}, prog: {}, assign: {}, autoResearch: true,
      threats: [], dipLeft: 2, log: [], flags: { nation: 0 }, seenHints: {}, pol: {}, chron: [], hist: [], auto: { build: 'off', res: 'fuel', move: false, guard: false, make: false },
      stats: { battles: 0, wins: 0, losses: 0, submits: 0, fuelUsed: 0, ammoUsed: 0, conquered: 0, nukes: 0, revolts: 0 },
      over: null
    };
    Object.keys(D.REGIONS).forEach(function (id) {
      var d = D.REGIONS[id], g = d.fac === 'player' ? 0 : r100(d.troops * diff.enemy);
      S.regions[id] = { o: d.fac, g: g, gmax: g, fort: d.fort, ctl: 100, fac: {}, b: null, p: null, mood: d.fac === 'player' ? 45 : 50, ruin: 0, pop: popInit(id) };
    });
    Object.keys(D.FACTIONS).forEach(function (id) {
      var f = D.FACTIONS[id];
      S.factions[id] = { att: f.att, war: !!f.war, pact: 0, trade: false, lost: 0, cap: f.capital, alive: !f.dormant, cool: 0, awe: 0, q: f.q, pride: f.pride, leader: f.leader };
    });
    var home = S.regions[st.region];
    home.g = 1500; home.fac = { airfield: 1, school: 1 };
    D.START_UNITS.forEach(function (u) { addUnit(u.type, u.name, st.region); });
    D.BIRDS.forEach(function (b) { S.assign[b.id] = null; });
    autoAssign();
    S.dipLeft = dipMax();
    mark('start', '富士の裾野に、霧とともに現れる。帰る道は、まだ探している。');
    return S;
  }

  function addUnit(type, name, loc) {
    var T = D.UNIT_TYPES[type];
    var u = { id: S.nextUid++, type: type, name: name || autoName(type), hp: 100, loc: (T.cls === 'ground' || T.cls === 'heli') ? loc : null, acted: false };
    S.units.push(u);
    return u;
  }
  function autoName(type) {
    var T = D.UNIT_TYPES[type], n = 1;
    S.flags.unitNo = S.flags.unitNo || {};
    n = (S.flags.unitNo[type] || 0) + 1; S.flags.unitNo[type] = n;
    return '第' + n + T.short;
  }

  function serialize() { return JSON.stringify(S); }
  function load(json) {
    var o = typeof json === 'string' ? JSON.parse(json) : json;
    if (!o || o.v !== SAVE_VERSION || !o.regions || !o.units) throw new Error('セーブデータの形式が違います');
    // 地域や勢力が増減していたら読み込まない(古い版のセーブ)
    var ok = Object.keys(D.REGIONS).every(function (id) { return o.regions[id]; }) && Object.keys(D.FACTIONS).every(function (id) { return o.factions[id]; });
    if (!ok) throw new Error('セーブデータの版が違います');
    S = o; REPORT = null;
    // 民心・施策・国号が入る前のセーブは、ここで足す
    S.pol = S.pol || {}; S.flags = S.flags || {};
    if (!S.auto) S.auto = { build: 'off', res: 'fuel', move: false, guard: false, make: false };
    if (!S.chron) S.chron = [{ turn: S.turn, k: 'start', t: '(これより前の歩みは、記録に残っていない)' }];
    S.stats.nukes = S.stats.nukes || 0; S.stats.revolts = S.stats.revolts || 0;
    Object.keys(S.regions).forEach(function (id) { var r = S.regions[id]; if (r.mood == null) r.mood = 50; if (r.ruin == null) r.ruin = 0; if (r.pop == null) r.pop = popInit(id); });
    if (!S.hist) S.hist = [];
    if (S.flags.nation == null) S.flags.nation = nationCalc();
    return S;
  }

  // ───────────────────────── 基本の問い合わせ ─────────────────────────
  function tech(id) { return !!S.techs[id]; }
  function season() { return S.turn % 4; }
  function year() { return D.START.year + Math.floor(S.turn / 4); }
  function dateLabel() {
    var y = year(), s = D.SEASONS[season()];
    var era;
    if (S.flags.unified != null) { var uy = D.START.year + Math.floor(S.flags.unified / 4); era = '天鳥' + (y - uy + 1 === 1 ? '元' : (y - uy + 1)) + '年'; }
    else if (y < 1570) era = '永禄' + (y - 1557) + '年';
    else if (y < 1573) era = '元亀' + (y - 1569 === 1 ? '元' : (y - 1569)) + '年';
    else era = '天正' + (y - 1572 === 1 ? '元' : (y - 1572)) + '年';
    return { year: y, season: s, era: era, text: y + '年 ' + s };
  }
  function isP(rid) { return S.regions[rid].o === 'player'; }
  function owner(rid) { return S.regions[rid].o; }
  function links(rid) { return LINKS[rid] || []; }
  function playerRegions() { return Object.keys(S.regions).filter(isP); }
  function factionRegions(fid) { return Object.keys(S.regions).filter(function (id) { return S.regions[id].o === fid; }); }
  function distKm(a, b) {
    var p = LL[a], q = LL[b]; if (!p || !q) return 99999;
    var R = 6371, toR = Math.PI / 180, dLat = (q[1] - p[1]) * toR, dLon = (q[0] - p[0]) * toR;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(p[1] * toR) * Math.cos(q[1] * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function infTier() { var t = 0; D.INF_TIERS.forEach(function (x, i) { if (x.tech && S.techs[x.tech]) t = i; }); return t; }
  function atkMult() { return 1 + (tech('radio') ? 0.1 : 0) + (tech('electronics') ? 0.15 : 0) + (tech('rocket') ? 0.1 : 0) + (tech('laser') ? 0.25 : 0); }
  function ustat(u) {
    var T = D.UNIT_TYPES[u.type];
    var o = { atk: T.atk, def: T.def, siege: T.siege, fuel: T.fuel, ammo: T.ammo, mv: T.mv || 0, name: T.name, cls: T.cls, foot: !!T.foot, transport: T.transport || 0, range: T.range || 0, vuln: T.vuln != null ? T.vuln : 1 };
    if (T.tiered) {
      var tr = D.INF_TIERS[infTier()];
      o.atk = T.atk * tr.mult; o.def = T.def * tr.mult; o.fuel = tr.fuel; o.ammo = tr.ammo; o.name = tr.name; o.mv = tr.fuel ? 1 : 0;
    }
    if (tech('fusion')) { o.fuel = 0; o.mv = 0; }   // 核融合:どの部隊も燃料がいらない
    o.atk = Math.round(o.atk * atkMult()); o.def = Math.round(o.def);
    return o;
  }
  function unitById(id) { for (var i = 0; i < S.units.length; i++) if (S.units[i].id === id) return S.units[i]; return null; }
  function unitsAt(rid) { return S.units.filter(function (u) { return u.loc === rid; }); }
  function poolUnits() { return S.units.filter(function (u) { return u.loc === null; }); }
  function diff() { return D.DIFFICULTY[S.diff]; }
  function fq(fid) { var f = S.factions[fid]; return (f ? f.q : 1) * diff().enemy; }
  function dipMax() { return 2 + (tech('telegraph') ? 1 : 0) + (tech('radio') ? 1 : 0) + (tech('network') ? 1 : 0) + (tech('llm') ? 1 : 0); }
  function moveRange() { return 2 + (tech('rail') ? 3 : 0) + (tech('engine') ? 1 : 0); }
  function hasSite(key) { // 稼働中の資源施設が自領にあるか
    var fk = key === 'coal' ? 'coalmine' : key;
    return playerRegions().some(function (id) { return S.regions[id].fac[fk]; });
  }
  function hasTransportShip() { return S.units.some(function (u) { return (D.UNIT_TYPES[u.type].transport || 0) > 0; }); }
  function freeTransportOnly() { return S.units.some(function (u) { var T = D.UNIT_TYPES[u.type]; return (T.transport || 0) > 0 && T.fuel === 0; }); }

  // ───────────────────────── 収支 ─────────────────────────
  function coalMines() { return Math.min(4, playerRegions().filter(function (id) { return S.regions[id].fac.coalmine; }).length); }
  function regionYield(rid, cm) {
    var r = S.regions[rid], d = D.REGIONS[rid], c = r.ctl / 100, y = { gold: 0, food: 0, steel: 0, fuel: 0, ammo: 0, rp: 0 };
    if (cm == null) cm = coalMines();
    var geo = tech('geophys') ? 1.2 : 1, w = d.map === 'w';
    var mf = moodFactor(r.mood), rf = 1 - 0.6 * (r.ruin || 0);   // 民心と焦土
    var atom = (tech('nuclear') ? 0.25 : 0) + (tech('fusion') ? 0.25 : 0);
    var gm = Math.max(0.3, 1 + (tech('network') ? 0.1 : 0) + atom + polSum('gold') + (w ? polSum('goldW') : 0));
    y.gold = (d.koku * 0.45 * c * (r.fac.market ? facK('market', r.fac.market) : 1) * (tech('rail') ? 1.15 : 1) + d.port * c) * mf;
    if (r.fac.mine) y.gold += (d.res.gold || 0) * 4 * (tech('survey') ? 1.5 : 1) * geo * facK('mine', r.fac.mine);
    y.gold *= gm * rf;
    y.food = d.koku * 1.0 * c * (r.fac.farm ? facK('farm', r.fac.farm) : 1) * (1 + (tech('agri') ? 0.4 : 0) + (tech('fertilizer') ? 0.6 : 0)) * mf * Math.max(0.3, 1 + polSum('food')) * rf;
    y.steel = d.koku * 0.03 * c * mf;
    if (r.fac.ironmine) y.steel += (d.res.iron || 0) * 4 * (tech('blast') ? 3 : 1) * (tech('bessemer') ? 2 : 1) * (1 + 0.5 * cm) * geo * facK('ironmine', r.fac.ironmine);
    y.steel *= (1 + atom) * rf;
    if (r.fac.oilwell) y.fuel = (d.res.oil || 0) * 5 * (tech('drill') ? 1.5 : 1) * (tech('cracking') ? 1.6 : 1) * (tech('catcrack') ? 1.3 : 1) * geo * rf * facK('oilwell', r.fac.oilwell);
    if (r.fac.arsenal && tech('ammo')) y.ammo = facK('arsenal', r.fac.arsenal) * (tech('fertilizer') ? 1.5 : 1) * (tech('electric') ? 1.5 : 1);
    if (r.fac.school) y.rp = facK('school', r.fac.school);
    if (r.fac.datacenter) y.rp += facK('datacenter', r.fac.datacenter);
    return y;
  }
  function income() {
    var t = { gold: 0, food: 0, steel: 0, fuel: 0, ammo: 0, rp: 0 }, up = { gold: 0, food: 0, steel: 0, fuel: 0 }, trade = 0, garr = 0;
    var cm = coalMines();
    playerRegions().forEach(function (id) {
      var y = regionYield(id, cm);
      t.gold += y.gold; t.food += y.food; t.steel += y.steel; t.fuel += y.fuel; t.ammo += y.ammo; t.rp += y.rp;
      garr += S.regions[id].g;
    });
    Object.keys(S.factions).forEach(function (fid) {
      var f = S.factions[fid]; if (!f.alive || !f.trade) return;
      factionRegions(fid).forEach(function (id) { trade += D.REGIONS[id].koku * 0.05 + D.REGIONS[id].port * 0.5; });
    });
    var jsdfAlive = false;
    var tierN = infTier();
    S.units.forEach(function (u) { var T = D.UNIT_TYPES[u.type]; up.food += T.food || 0; up.gold += (T.upkeep || 0) * (T.tiered ? 1 + tierN : 1); if (T.jsdf) jsdfAlive = true; });
    up.food += garr / 500;
    up.fuel = jsdfAlive && !tech('nuclear') ? 4 : 0;   // 基地の発電・整備ぶん(原子力があれば要らない)
    t.rp += polSum('rp');                              // 学制
    // 弾薬は鉄鋼を食う(弾薬3につき鉄鋼1)。鉄鋼が足りなければ、そのぶん作れない
    var ammoMake = Math.min(t.ammo, Math.max(0, S.res.steel + t.steel) * 3);
    up.steel = ammoMake / 3;
    return {
      gross: t, upkeep: up, trade: trade, ammoCap: t.ammo,
      net: { gold: Math.round(t.gold + trade - up.gold), food: Math.round(t.food - up.food), steel: Math.round(t.steel - up.steel), fuel: Math.round(t.fuel - up.fuel), ammo: Math.round(ammoMake) },
      rp: t.rp
    };
  }
  function foodCap() { var k = 0; playerRegions().forEach(function (id) { k += D.REGIONS[id].koku; }); return Math.round(1000 + k * 1.5); }

  // ───────────────────────── 研究 ─────────────────────────
  function techStatus(id) {
    if (S.techs[id]) return 'done';
    var t = TECH_BY_ID[id];
    for (var i = 0; i < t.req.length; i++) if (!S.techs[t.req[i]]) return 'locked';
    if (t.needSite && !hasSite(t.needSite)) return 'nosite';
    return 'avail';
  }
  function techLockReason(id) {
    var t = TECH_BY_ID[id], miss = t.req.filter(function (r) { return !S.techs[r]; }).map(function (r) { return TECH_BY_ID[r].name; });
    if (miss.length) return '前提: ' + miss.join('、');
    if (t.needSite && !hasSite(t.needSite)) return D.SITE_NAMES[t.needSite] + '鉱山を自領に建ててから';
    return '';
  }
  // 総括指揮AIの計算支援。発電機の燃料が尽きると止まる(電力の研究が済めば止まらない)
  function darioOn() { return S.res.fuel > 0 || tech('electric'); }
  function darioRp() { return !darioOn() ? 0 : (tech('electronics') ? 30 : (tech('electric') ? 16 : 8)) + (tech('computer') ? 20 : 0); }
  function isSpec(b, t) { return t.field === b.field || (!!b.field2 && t.field === b.field2); } // 得意分野か
  function researchMult() {
    var m = 1 + (tech('electric') ? 0.25 : 0) + (tech('electronics') ? 0.25 : 0) + (tech('computer') ? 0.3 : 0) + (tech('deeplearn') ? 0.4 : 0);
    return tech('agi') ? m * 2 : m;   // 汎用人工知能:研究そのものを機械がやる
  }
  function birdRp(bid) {
    var b = BIRD_BY_ID[bid], tid = S.assign[bid];
    if (!tid) return 0;
    var active = D.BIRDS.filter(function (x) { return S.assign[x.id]; }).length || 1;
    var school = (income().rp + darioRp()) / active;
    return (6 * (isSpec(b, TECH_BY_ID[tid]) ? 1.6 : 1) + school) * researchMult();
  }
  function techRp(tid) { var s = 0; D.BIRDS.forEach(function (b) { if (S.assign[b.id] === tid) s += birdRp(b.id); }); return s; }
  function assign(bid, tid) {
    if (!BIRD_BY_ID[bid]) return false;
    if (tid && techStatus(tid) !== 'avail') return false;
    S.assign[bid] = tid || null;
    return true;
  }
  function autoAssign() {
    D.BIRDS.forEach(function (b) {
      var cur = S.assign[b.id];
      if (cur && techStatus(cur) === 'avail') return;
      S.assign[b.id] = null;
      var avail = RESEARCH_PRIORITY.filter(function (t) { return techStatus(t) === 'avail'; });
      if (!avail.length) return;
      var own = avail.filter(function (t) { return isSpec(b, TECH_BY_ID[t]); });
      S.assign[b.id] = own.length ? own[0] : avail[0];
    });
  }
  function idleBirds() { return D.BIRDS.filter(function (b) { return !S.assign[b.id]; }).map(function (b) { return b.id; }); }
  function allTechDone() { return D.TECHS.every(function (t) { return S.techs[t.id]; }); }
  // 鳥たちが自分から手を付ける研究が残っているか(核兵器と超知能は数えない)
  function autoTechLeft() { return RESEARCH_PRIORITY.some(function (t) { return techStatus(t) === 'avail'; }); }
  function manualAvail() { return D.TECHS.filter(function (t) { return t.manual && techStatus(t.id) === 'avail'; }).map(function (t) { return t.id; }); }

  // ───────────────────────── 戦力の計算 ─────────────────────────
  function enemyPower(rid, fortEff) {
    var r = S.regions[rid], d = D.REGIONS[rid];
    if (fortEff == null) fortEff = r.fort;
    return r.g / MEN * fq(r.o) * (1 + 0.3 * fortEff) * (d.mtn ? 1.15 : 1);
  }
  function defensePower(rid) {
    var r = S.regions[rid], d = D.REGIONS[rid];
    var p = r.g / MEN * D.INF_TIERS[infTier()].mult * (1 + 0.3 * r.fort) * (d.mtn ? 1.15 : 1) * (1 + polSum('defend'));
    unitsAt(rid).forEach(function (u) { p += ustat(u).def * u.hp / 100; });
    return p;
  }
  function airfieldInRange(tid, range) {
    var far = tech('rocket');   // 空中給油と衛星誘導。飛行場さえあれば、どこへでも届く
    return playerRegions().some(function (id) { return S.regions[id].fac.airfield && (far || distKm(id, tid) <= range); });
  }

  // 攻撃に参加できる部隊の一覧
  function attackOptions(tid) {
    var t = D.REGIONS[tid], out = [], land = {}, sea = {};
    if (lockedOverseas(tid)) return out;
    links(tid).forEach(function (l) { if (isP(l.id)) { if (l.sea) sea[l.id] = 1; else land[l.id] = 1; } });
    var anySea = false;
    S.units.forEach(function (u) {
      var T = D.UNIT_TYPES[u.type], o = { u: u, via: null, ok: true, why: '' };
      if (T.cls === 'ground') {
        if (land[u.loc]) o.via = 'land'; else if (sea[u.loc]) { o.via = 'sea'; anySea = true; } else return;
      } else if (T.cls === 'heli') {
        if (land[u.loc] || sea[u.loc] || distKm(u.loc, tid) <= T.range) o.via = 'heli'; else return;
      } else if (T.cls === 'air') {
        o.via = 'air';
        if (!airfieldInRange(tid, T.range)) { o.ok = false; o.why = '飛行場から' + T.range + 'km圏外'; }
      } else if (T.cls === 'naval') {
        o.via = T.atk > 0 ? 'naval' : 'transport';
        if (!t.coast) { o.ok = false; o.why = '内陸には届かない'; }
        if (T.needSite && !hasSite(T.needSite)) { o.ok = false; o.why = '炭鉱がない'; }
      } else if (T.cls === 'missile') {
        o.via = 'missile';   // 世界のどこへでも届く
      }
      if (u.acted) { o.ok = false; o.why = '行動済み'; }
      else if (u.hp < 10) { o.ok = false; o.why = '損耗が激しい'; }
      out.push(o);
    });
    // 輸送専用艦は、海を渡る陸上部隊がいないなら出さない
    if (!anySea) out = out.filter(function (o) { return o.via !== 'transport'; });
    return out;
  }

  function predictAttack(tid, ids, opts) {
    var t = D.REGIONS[tid], r = S.regions[tid], byId = {};
    opts = opts || attackOptions(tid);
    opts.forEach(function (o) { byId[o.u.id] = o; });
    var sel = [], problems = [];
    ids.forEach(function (id) { var o = byId[id]; if (o && o.ok) sel.push(o); });
    var winter = season() === 3 && t.snow;
    var fuel = 0, ammo = 0, P = 0, siege = 0, ground = 0, seaGround = 0, cap = 0, parts = [];
    // まず燃料が足りるか。足りなければ徒歩で動ける部隊は徒歩に切り替える
    var needFuel = 0;
    sel.forEach(function (o) { needFuel += ustat(o.u).fuel; });
    var onFoot = needFuel > S.res.fuel;
    sel.forEach(function (o) {
      var st = ustat(o.u), m = 1, f = st.fuel, tag = [];
      if (onFoot && st.foot) { f = 0; if (st.fuel > 0) { m *= 0.7; tag.push('徒歩'); } }
      if (winter && (st.cls === 'ground' || st.cls === 'heli')) { m *= 0.6; tag.push('豪雪'); }
      if (o.via === 'sea') { m *= 0.85; tag.push('上陸'); seaGround++; }
      if (st.cls === 'ground') ground++;
      cap += (st.cls === 'naval') ? st.transport : 0;
      fuel += f; ammo += st.ammo;
      var p = st.atk * o.u.hp / 100 * m;
      P += p; if (st.atk > 0) siege += st.siege;
      parts.push({ u: o.u, p: Math.round(p), tag: tag });
    });
    if (!sel.length) problems.push('部隊を選んでください');
    if (fuel > S.res.fuel) problems.push('燃料が足りません(必要 ' + fuel + ')');
    if (ammo > S.res.ammo) problems.push('弾薬が足りません(必要 ' + ammo + ')');
    if (seaGround > cap) problems.push('海上輸送力が足りません(必要 ' + seaGround + ' / 可能 ' + cap + ')');
    var fortEff = Math.max(0, r.fort - siege), E = enemyPower(tid, fortEff);
    var chance = P <= 0 ? 0 : clamp((1.1 * P - E) / (0.2 * P), 0, 1);
    var ratio = E > 0 ? P / E : 99;
    var lossPct = ratio >= 1 ? clamp(6 / ratio, 0.5, 25) : clamp(12 / Math.max(0.1, ratio), 10, 50);
    if (tech('medicine')) lossPct *= 0.7;
    var nuke = sel.some(function (o) { return !!D.UNIT_TYPES[o.u.type].nuke; });
    return { P: Math.round(P), E: Math.round(E), fort: r.fort, fortEff: fortEff, siege: siege, fuel: fuel, ammo: ammo, chance: chance, ratio: ratio,
      canCapture: ground > 0, problems: problems, parts: parts, winter: winter, onFoot: onFoot, lossPct: lossPct, seaGround: seaGround, cap: cap, sel: sel, nuke: nuke };
  }

  // 「おすすめ」編成:勝算が minChance に届くまで、費用対効果のよい部隊から順に足していく
  function suggestAttack(tid, minChance) {
    // 核は「おすすめ」に入れない。撃つかどうかは、司令が自分で決める
    var opts = attackOptions(tid), pool = opts.filter(function (o) { return o.ok && !D.UNIT_TYPES[o.u.type].nuke; });
    if (minChance == null) minChance = 0.9;
    var chosen = [], best = predictAttack(tid, [], opts);
    function good(p) { return p.chance >= minChance && p.canCapture && !p.problems.length; }
    for (var guard = 0; guard < 60 && !good(best); guard++) {
      var pick = null, pickScore = -1, pickPr = null;
      for (var i = 0; i < pool.length; i++) {
        var o = pool[i];
        if (chosen.indexOf(o.u.id) >= 0) continue;
        var pr = predictAttack(tid, chosen.concat([o.u.id]), opts);
        if (pr.fuel > S.res.fuel || pr.ammo > S.res.ammo) continue;
        var st = ustat(o.u), cost = st.fuel * 1.5 + st.ammo + 2;
        var gain = (pr.P - best.P) + (best.E - pr.E);
        if (!best.canCapture && pr.canCapture) gain += 50;
        if (best.seaGround > best.cap && pr.cap > best.cap) gain += 80;
        if (gain <= 0) continue;
        if (gain / cost > pickScore) { pickScore = gain / cost; pick = o; pickPr = pr; }
      }
      if (!pick) break;
      chosen.push(pick.u.id); best = pickPr;
    }
    return { ids: chosen, pr: best, ok: good(best) };
  }

  // ───────────────────────── 出来事の記録 ─────────────────────────
  function ev(kind, text, extra) {
    var e = { k: kind, t: text, turn: S.turn };
    if (extra) for (var k in extra) e[k] = extra[k];
    if (REPORT) REPORT.push(e);
    S.log.push(e);
    if (S.log.length > 80) S.log.splice(0, S.log.length - 80);
    return e;
  }
  // 年表。国の歩みの節目だけを、消さずに残す(記録 S.log は古いものから消える)
  function mark(kind, text) { S.chron.push({ turn: S.turn, k: kind, t: text }); if (S.chron.length > 400) S.chron.splice(1, S.chron.length - 400); }
  function fname(fid) { return fid === 'player' ? '我が軍' : D.FACTIONS[fid].name; }
  function rname(rid) { return D.REGIONS[rid].name; }

  // ───────────────────────── 占領と勢力の滅亡 ─────────────────────────
  function takeRegion(rid, how, events) {
    var r = S.regions[rid], prev = r.o, f = S.factions[prev];
    var soft = how === 'submit' || how === 'asi';
    r.o = 'player'; r.b = null; r.p = null;
    r.g = r100(r.g * (soft ? 0.8 : (how === 'defect' ? 0.6 : 0.25)));
    r.ctl = soft ? 65 : (how === 'defect' ? 55 : 35);
    r.mood = soft ? 58 : (how === 'defect' ? 45 : 28);   // 力ずくで取った土地は、しばらく心を開かない
    r.how = how; r.since = S.turn;
    if (polAny('ctlMax')) r.ctl = 100;
    if (S.flags.asi != null) { r.ctl = 100; r.mood = 100; }
    r.gmax = Math.max(r.gmax, 0);
    S.threats = S.threats.filter(function (t) { return t.from !== rid && t.to !== rid; });
    if (f) f.lost++;
    if (rid === 'yamashiro' && !S.flags.kyoto) {
      S.flags.kyoto = S.turn; S.prestige += 10; mark('event', '上洛。帝に拝謁し、官軍の御旗を受ける。');
      events.push(ev('event', '京に入り、帝に拝謁した。朝廷は「官軍」の御旗を授けた。', { big: { title: '上洛', body: '都に戦車の列が入った。帝は鉄の車と、肩に鳥を乗せた司令に目を丸くされたという。朝廷は我が軍を官軍と認めた。これより、日本の諸大名は降伏勧告に応じやすくなる。', bird: 'haku' } }));
    }
    return prev;
  }
  function afterLoss(fid, lostRid, events) { // 勢力が地域を失ったあとの処理(本拠陥落・滅亡)
    var f = S.factions[fid]; if (!f) return;
    var rest = factionRegions(fid);
    if (!rest.length) {
      f.alive = false; f.war = false; f.trade = false;
      events.push(ev('good', fname(fid) + 'は滅亡した。', { fid: fid }));
      S.prestige += 1; mark('fall', fname(fid) + '(' + f.leader + ')を降す。最後の城は' + rname(lostRid) + '。');
      return;
    }
    if (lostRid === f.cap) {
      var defected = [];
      rest.forEach(function (id) {
        if (rnd() < 0.55) { takeRegion(id, 'defect', events); defected.push(rname(id)); }
        else { S.regions[id].g = r100(S.regions[id].g * 0.7); }
      });
      S.prestige += 1;
      var still = factionRegions(fid);
      if (defected.length) events.push(ev('good', '本拠を失った' + fname(fid) + 'から、' + defected.join('・') + 'が開城して降った。', { fid: fid }));
      if (!still.length) { f.alive = false; f.war = false; f.trade = false; events.push(ev('good', fname(fid) + 'は滅亡した。', { fid: fid })); S.prestige += 1; mark('fall', fname(fid) + '(' + f.leader + ')の本拠' + rname(lostRid) + 'を落とす。残る城も門を開いた。'); }
      else {
        still.sort(function (a, b) { return D.REGIONS[b].koku - D.REGIONS[a].koku; });
        f.cap = still[0]; f.pride = Math.max(20, f.pride - 15);
        events.push(ev('news', fname(fid) + 'は本拠を' + rname(f.cap) + 'に移して抗戦を続けている。', { fid: fid }));
      }
    }
  }
  function checkMilestones(events) {
    var jp = Object.keys(D.REGIONS).filter(function (id) { return D.REGIONS[id].map === 'jp'; });
    var w = Object.keys(D.REGIONS).filter(function (id) { return D.REGIONS[id].map === 'w'; });
    if (S.flags.unified == null && jp.every(isP)) {
      S.flags.unified = S.turn; S.prestige += 15; mark('event', '天下統一。蝦夷から薩摩まで、一つの旗の下に入る。元号を天鳥と改める。');
      Object.keys(S.factions).forEach(function (fid) { S.factions[fid].pride = Math.max(10, S.factions[fid].pride - 5); });
      events.push(ev('event', '天下統一! 日本は一つになった。', { big: { title: '天下統一', body: '蝦夷から薩摩まで、すべての国が一つの旗の下に入った。元号は「天鳥」と改められた。鳥たちはすでに、世界地図を広げている。——次は、海の向こうだ。', bird: 'gin', fanfare: true } }));
    }
    if (diff().siege && S.flags.siege == null && S.flags.unified == null && S.flags.asi == null && jp.filter(isP).length >= diff().siege) {
      S.flags.siege = S.turn; mark('bad', '諸国の大名が、包囲網を結ぶ。不可侵の約束は反故になった。');
      Object.keys(S.factions).forEach(function (fid) {
        var f = S.factions[fid]; if (!f.alive || !isJp(fid)) return;
        f.war = true; f.pact = 0; f.trade = false; f.awe = 0; f.att = Math.min(f.att, -20);
      });
      events.push(ev('event', '諸国の大名が「包囲網」を結んだ。', { big: { title: '包囲網', body: '京の将軍の御内書が、諸国へ飛んだ。「異形の軍を討て」。昨日まで槍を交えていた家々が、こぞって兵をこちらへ向ける。不可侵の約束は、すべて反故になった。\n隣り合う敵は、示し合わせて同じ土地へ攻めてくる。国境の守りを、一つずつ確かめてほしい。', bird: 'gin' } }));
    }
    var wOwned = w.filter(isP).length;
    if (!S.flags.coalition && wOwned >= (diff().coal || 18)) {
      S.flags.coalition = S.turn; mark('bad', '残る世界の国々が、対日大同盟を結ぶ。');
      Object.keys(S.factions).forEach(function (fid) {
        var f = S.factions[fid]; if (!f.alive) return;
        var regs = factionRegions(fid); if (!regs.length || D.REGIONS[regs[0]].map !== 'w') return;
        f.war = true; f.pact = 0; f.trade = false; f.q = Math.round((f.q + 0.15) * 100) / 100;
      });
      events.push(ev('event', '残る世界の国々が「対日大同盟」を結んだ。', { big: { title: '対日大同盟', body: 'マドリード、コンスタンティノープル、アーグラ。昨日までの敵どうしが手を結んだ。残るすべての国が我が国に宣戦し、兵の質を高めている。', bird: 'gin' } }));
    }
    if (!S.over && jp.every(isP) && w.every(isP)) {
      S.over = { win: true, turn: S.turn };
      mark('event', S.flags.asi != null ? '地球の上から、国境と反対意見がなくなる。' : '地球統一。「日本」は、星の名になる。');
      if (S.flags.asi != null) {
        S.over.asi = true;
        events.push(ev('event', '地球は、調和した。', { big: { title: '調和', body: '最後の旗は、降ろされるまでもなかった。' + dateLabel().text + '、地球の上から、国境と、反対意見がなくなった。鳥たちは羽づくろいをしている。いつもと同じ角度で、いつもと同じ回数だけ。', bird: 'dario', asi: true } }));
      } else {
        events.push(ev('event', '地球は、日本になった。', { big: { title: '地球統一', body: '最後の旗が降ろされた。' + dateLabel().text + '、地球上のすべての土地が日本になった。鳥たちは満足げに羽づくろいをしている。', bird: 'haku', fanfare: true } }));
      }
    }
    if (!S.over && !playerRegions().length) {
      S.over = { win: false, turn: S.turn };
      events.push(ev('event', 'すべての拠点を失った。', { big: { title: '敗北', body: '統合任務部隊は最後の拠点を失った。鳥たちは空へ逃れたという。', bird: 'okame' } }));
    }
    // 国号の移り変わり(領地が減っても元の名には戻らない)
    var ns = nationCalc();
    if (ns > (S.flags.nation || 0)) {
      S.flags.nation = ns;
      var N = D.NATION[ns];
      mark('nation', '国の名を「' + N.name + '」と改める。' + (N.when.asi ? '' : '土地の人々は「' + N.by + '」と呼ぶ。'));
      // 地球統一と超知能は、それぞれの知らせの中で名が変わる
      if (!N.when.all && !N.when.asi) events.push(ev('event', '国の名を「' + N.name + '」と改めた。', { big: { kicker: '国号改め', title: N.name, body: N.desc + '\n土地の人々は、こう呼んでいる——「' + N.by + '」。', bird: N.bird, nation: ns } }));
    }
  }

  // ───────────────────────── 攻撃 ─────────────────────────
  function attack(tid, ids) {
    if (S.over) return { error: 'ゲームは終了しています' };
    if (isP(tid)) return { error: '自領です' };
    if (lockedOverseas(tid)) return { error: '海を渡るのは、天下統一のあとです' };
    var pr = predictAttack(tid, ids);
    if (pr.problems.length) return { error: pr.problems[0] };
    var r = S.regions[tid], d = D.REGIONS[tid], fid = r.o, f = S.factions[fid], events = [];
    var prevReport = REPORT; REPORT = null; // 即時の行動はターン報告に混ぜない(ログには残す)
    S.res.fuel -= pr.fuel; S.res.ammo -= pr.ammo; S.stats.fuelUsed += pr.fuel; S.stats.ammoUsed += pr.ammo; S.stats.battles++;
    // 宣戦の扱い
    if (f) {
      if (f.pact > 0) { S.prestige = Math.max(0, S.prestige - 8); Object.keys(S.factions).forEach(function (k) { S.factions[k].att -= 8; }); events.push(ev('bad', fname(fid) + 'との不可侵の約定を破った。諸国の信を失った。')); f.pact = 0; }
      f.war = true; f.trade = false; f.att = Math.min(f.att, -40);
    }
    var roll = 0.9 + rnd() * 0.2, P = pr.P * roll, E = pr.E, win = P >= E && pr.canCapture, bombard = !pr.canCapture;
    var ratio = E > 0 ? P / E : 99, lossBase, losses = [], gBefore = r.g, res;
    if (bombard) {
      lossBase = clamp(2 / Math.max(0.2, ratio), 0.3, 8);
      var cut = clamp(0.3 * ratio, 0.08, 0.6);
      r.g = r100(r.g * (1 - cut));
      var fortHit = pr.siege > 0 && r.fort > 0 && rnd() < 0.4;
      if (fortHit) r.fort--;
      if (f) f.pride = Math.max(10, f.pride - 3);
    } else if (win) {
      lossBase = clamp(6 / ratio, 0.5, 25);
    } else {
      lossBase = clamp(12 / Math.max(0.1, ratio), 10, 50);
      r.g = r100(r.g * (1 - clamp(0.5 * ratio, 0.05, 0.45)));
    }
    if (tech('medicine')) lossBase *= 0.7;
    pr.sel.forEach(function (o) {
      var T = D.UNIT_TYPES[o.u.type], st = ustat(o.u), dh = Math.round(lossBase * st.vuln * (0.7 + rnd() * 0.6));
      if (st.atk === 0) dh = 0;
      o.u.hp = Math.max(0, o.u.hp - dh); o.u.acted = true;
      var dead = o.u.hp <= 0;
      if (T.oneShot) o.u.hp = 0;   // 撃てば無くなる
      losses.push({ id: o.u.id, name: o.u.name, type: o.u.type, dh: T.oneShot ? 0 : dh, dead: dead && !T.oneShot, spent: !!T.oneShot });
    });
    if (pr.nuke) nukeStrike(tid, gBefore, events);
    var captured = false, joined = 0;
    if (win) {
      captured = true; S.stats.wins++; S.stats.conquered++;
      takeRegion(tid, 'force', events); joined = S.regions[tid].g;
      S.prestige += (f && f.cap === tid) ? 2 : 1;
      pr.sel.forEach(function (o) { if (D.UNIT_TYPES[o.u.type].cls === 'ground' && o.u.hp > 0) o.u.loc = tid; });
      ev('battle', rname(tid) + 'を攻略した。', { rid: tid });
      if (f) afterLoss(fid, tid, events);
    } else if (!bombard) {
      S.stats.losses++; S.prestige = Math.max(0, S.prestige - 2);
      ev('battle', rname(tid) + 'の攻略に失敗した。', { rid: tid });
    } else {
      ev('battle', rname(tid) + 'を砲爆撃した。', { rid: tid });
    }
    S.units = S.units.filter(function (u) { return u.hp > 0; });
    checkMilestones(events);
    REPORT = prevReport;
    res = { win: win, bombard: bombard, captured: captured, P: Math.round(P), E: Math.round(E), ratio: ratio, chance: pr.chance, fuel: pr.fuel, ammo: pr.ammo, losses: losses,
      gBefore: gBefore, gAfter: S.regions[tid].g, joined: joined, fortEff: pr.fortEff, fort: pr.fort, siege: pr.siege, fid: fid, rid: tid, events: events, winter: pr.winter, nuke: pr.nuke };
    return res;
  }
  // 核を撃った土地と、世界の受け止め
  function nukeStrike(tid, gBefore, events) {
    var r = S.regions[tid], first = !S.stats.nukes;
    r.g = Math.min(r.g, r100(gBefore * 0.05)); r.fort = 0; r.ruin = 1; r.fac = {}; r.b = null; r.p = null;
    r.pop = Math.round(r.pop * 0.3 * 10) / 10;   // 町ごと消える
    r.gmax = r100(r.gmax * 0.3);
    S.stats.nukes = (S.stats.nukes || 0) + 1;
    S.prestige = Math.max(0, S.prestige - 10);
    Object.keys(S.factions).forEach(function (k) {
      var f = S.factions[k]; if (!f.alive) return;
      f.att = Math.max(-100, f.att - 25); f.pride = Math.max(10, f.pride - 12);   // 恐れ、そして憎む
      if (f.att < 0) f.trade = false;
    });
    playerRegions().forEach(function (id) { S.regions[id].mood = Math.max(0, S.regions[id].mood - 8); });
    ev('bad', rname(tid) + 'に核を撃った。', { rid: tid, nuke: true }); mark('nuke', rname(tid) + 'に核を撃つ。城も町も、影だけを残して消える。');
    if (first) events.push(ev('event', '核の火が使われた。', { big: { kicker: dateLabel().text, title: '核の火', body: rname(tid) + 'の空に、二つめの太陽が昇った。城も、町も、そこにいた人も、影だけを残して消えた。\n世界中の宮廷が震え上がり、我が国への友好は地に落ちた。自領の民も、口をつぐんでいる。鳥たちは一羽も鳴かない。ダリオくんは作戦記録の末尾に、ただ一行を残した。「私は反対しました」。', bird: 'dario', grave: true } }));
  }

  // ───────────────────────── 移動 ─────────────────────────
  function moveTargets(ids) {
    var us = ids.map(unitById).filter(Boolean);
    if (!us.length) return {};
    var from = us[0].loc, out = {};
    if (us.some(function (u) { return u.loc !== from || u.acted || u.loc === null; })) return {};
    var range = moveRange(), seaOk = hasTransportShip(), freeSea = freeTransportOnly() && hasSite('coal');
    var dist = {}; dist[from] = { hops: 0, sea: 0 };
    var q = [from];
    while (q.length) {
      var cur = q.shift(), c = dist[cur];
      if (c.hops >= range) continue;
      links(cur).forEach(function (l) {
        if (!isP(l.id) || dist[l.id]) return;
        if (l.sea && !seaOk) return;
        dist[l.id] = { hops: c.hops + 1, sea: c.sea + (l.sea ? 1 : 0) };
        q.push(l.id);
      });
    }
    Object.keys(dist).forEach(function (id) {
      if (id === from) return;
      var dd = dist[id], fuel = 0;
      us.forEach(function (u) { var st = ustat(u); fuel += (tech('rail') ? 0 : st.mv * dd.hops) + (dd.sea && !freeSea && !tech('fusion') ? 6 * dd.sea : 0); });
      var foot = us.every(function (u) { return ustat(u).foot; });
      var ok = fuel <= S.res.fuel || (foot && dd.sea === 0 && dd.hops === 1);
      out[id] = { hops: dd.hops, sea: dd.sea, fuel: fuel <= S.res.fuel ? fuel : 0, ok: ok, why: ok ? '' : '燃料不足' };
    });
    return out;
  }
  function move(ids, rid) {
    var t = moveTargets(ids)[rid];
    if (!t) return { error: 'そこへは移動できません' };
    if (!t.ok) return { error: t.why };
    S.res.fuel -= t.fuel; S.stats.fuelUsed += t.fuel;
    ids.forEach(function (id) { var u = unitById(id); if (u) { u.loc = rid; u.acted = true; } });
    return { ok: true, fuel: t.fuel };
  }

  // ───────────────────────── 内政 ─────────────────────────
  function schoolCount() {
    var n = 0;
    playerRegions().forEach(function (id) { var r = S.regions[id]; if (r.fac.school || (r.b && r.b.k === 'school')) n++; });
    return n;
  }
  // 建設にかかる季節。鉄道で資材が届き、重機で工事が早くなる(最短1季)
  function buildTurns(key) { return Math.max(1, D.FACILITIES[key].turns - (tech('rail') ? 1 : 0) - (tech('engine') ? 1 : 0)); }
  function schoolName(lv) { var L = D.FACILITIES.school.levels; return L[clamp(lv, 1, L.length) - 1].name; }
  // 段のある施設の、その段での倍率(または産出の値)
  function facK(key, lv) { var L = D.FACILITIES[key].levels; return L ? L[clamp(lv, 1, L.length) - 1].k : 1; }
  function facMax(key) { var L = D.FACILITIES[key].levels; return L ? L.length : 1; }
  function lvText(key, lv) { // その段の効き目を一言で
    var k = facK(key, lv);
    return key === 'farm' ? '兵糧 ×' + k : (key === 'market' ? '資金 ×' + k : (key === 'school' || key === 'datacenter' ? '研究力 +' + k : (key === 'arsenal' ? '弾薬 ' + k + '(毎季の基本)' : '産出 ×' + k)));
  }
  // その地域での施設の呼び名(段で名が変わる。建設中なら、できあがる段の名)
  function facLabel(rid, key, next) {
    var r = S.regions[rid], L = D.FACILITIES[key].levels;
    return L ? L[clamp((r.fac[key] || 0) + (next ? 1 : 0) || 1, 1, L.length) - 1].name : D.FACILITIES[key].name;
  }
  function facCost(rid, key) {
    var F = D.FACILITIES[key], c = { gold: F.cost.gold || 0, steel: F.cost.steel || 0 };
    if (F.levels) { // 次の段の費用
      var lv = S.regions[rid].fac[key] || 0, L = F.levels[Math.min(lv, F.levels.length - 1)];
      c = { gold: L.cost.gold || 0, steel: L.cost.steel || 0 };
      if (!lv && key === 'school') c.gold += 30 * Math.max(0, schoolCount() - 1);
      if (!lv && key === 'datacenter') c.gold += 200 * facCount('datacenter');
      return c;
    }
    if (key === 'fort') c.gold = 70 * (S.regions[rid].fort + 1);
    return c;
  }
  function facCount(key) {
    var n = 0;
    playerRegions().forEach(function (id) { var r = S.regions[id]; if (r.fac[key]) n++; if (r.b && r.b.k === key) n++; });
    return n;
  }
  function buildOptions(rid) {
    var r = S.regions[rid], d = D.REGIONS[rid], out = [];
    Object.keys(D.FACILITIES).forEach(function (key) {
      var F = D.FACILITIES[key], o = { key: key, name: F.name, effect: F.effect, turns: buildTurns(key), cost: facCost(rid, key), ok: true, why: '', built: false, show: true }, needTech = F.tech;
      if (F.site && !(d.res[F.site] > 0)) { o.show = false; return; }
      if (F.coast && !d.coast) { o.show = false; return; }
      if (F.site) o.amount = d.res[F.site];
      if (key === 'fort') { if (r.fort >= 5) { o.built = true; o.ok = false; o.why = '最大'; } }
      else if (F.levels) { // 段を上げていく
        var lv = r.fac[key] || 0, L = F.levels[lv];
        o.level = lv; o.max = F.levels.length;
        if (!L) { o.built = true; o.ok = false; o.why = '最高の段'; o.name = F.levels[lv - 1].name; o.effect = lvText(key, lv); }
        else if (lv) { o.upgrade = true; o.name = F.levels[lv - 1].name + ' → ' + L.name; o.effect = lvText(key, lv) + ' → ' + lvText(key, lv + 1); needTech = L.tech; }
      }
      else if (r.fac[key]) { o.built = true; o.ok = false; o.why = '建設済み'; }
      if (!o.built) {
        if (r.b && r.b.k === key) { o.ok = false; o.why = '建設中(あと' + r.b.t + 'ターン)'; o.building = true; }
        else if (r.b) { o.ok = false; o.why = '別の建設が進行中'; }
        else if (needTech && !tech(needTech)) { o.ok = false; o.why = '「' + TECH_BY_ID[needTech].name + '」の研究が必要'; o.locked = true; }
        else if (o.cost.gold > S.res.gold) { o.ok = false; o.why = '資金不足'; }
        else if (o.cost.steel > S.res.steel) { o.ok = false; o.why = '鉄鋼不足'; }
      }
      out.push(o);
    });
    return out;
  }
  function build(rid, key) {
    if (!isP(rid)) return { error: '自領ではありません' };
    var o = buildOptions(rid).filter(function (x) { return x.key === key; })[0];
    if (!o || !o.ok) return { error: o ? o.why : '建設できません' };
    S.res.gold -= o.cost.gold; S.res.steel -= o.cost.steel;
    S.regions[rid].b = { k: key, t: o.turns };
    return { ok: true };
  }
  // 急がせる:資金を足して、次の季節に仕上げる
  function rushCost(rid) {
    var r = S.regions[rid]; if (!r || r.o !== 'player' || !r.b || r.b.t <= 1) return null;
    return Math.ceil(facCost(rid, r.b.k).gold * 0.5) + 25 * (r.b.t - 1);
  }
  function rush(rid) {
    var c = rushCost(rid);
    if (c == null) return { error: '急がせる工事がありません' };
    if (c > S.res.gold) return { error: '資金不足' };
    S.res.gold -= c; S.regions[rid].b.t = 1;
    return { ok: true, cost: c };
  }
  function garrisonCap(rid) { return Math.max(3000, D.REGIONS[rid].koku * 300); }
  function garrisonCost(n) { return { gold: Math.ceil(n / 1000 * 15), food: Math.ceil(n / 1000 * 8) }; }
  function recruit(rid, n) {
    if (!isP(rid)) return { error: '自領ではありません' };
    var r = S.regions[rid], room = garrisonCap(rid) - r.g;
    n = Math.min(n, room);
    if (n <= 0) return { error: 'これ以上は集まりません' };
    var c = garrisonCost(n);
    if (c.gold > S.res.gold) return { error: '資金不足' };
    if (c.food > S.res.food) return { error: '兵糧不足' };
    S.res.gold -= c.gold; S.res.food -= c.food; r.g += n;
    return { ok: true, n: n };
  }
  function ashiCap() { return 3 + Math.floor(playerRegions().length / 3); }
  function ashiCount() {
    var n = S.units.filter(function (u) { return u.type === 'ashi'; }).length;
    playerRegions().forEach(function (id) { var p = S.regions[id].p; if (p && p.type === 'ashi') n++; });
    return n;
  }
  function unitCost(type) {
    var T = D.UNIT_TYPES[type], c = { gold: T.cost.gold || 0, steel: T.cost.steel || 0, food: T.cost.food || 0 };
    if (T.tiered) { var tn = infTier(); c.gold += 40 * tn; c.steel += tn >= 2 ? 10 * (tn - 1) : 0; }
    return c;
  }
  function produceOptions(rid) {
    var r = S.regions[rid], out = [];
    Object.keys(D.UNIT_TYPES).forEach(function (type) {
      var T = D.UNIT_TYPES[type]; if (!T.cost) return;
      var cost = unitCost(type);
      var o = { type: type, name: T.tiered ? D.INF_TIERS[infTier()].name + '(現地歩兵団)' : T.name, cost: cost, turns: prodTurns(type, rid), ok: true, why: '', desc: T.desc, show: true };
      if (T.tiered) { o.count = ashiCount(); o.cap = ashiCap(); }
      if (T.tech && !tech(T.tech)) { o.show = false; return; }
      if (T.at && !r.fac[T.at]) { o.ok = false; o.why = D.FACILITIES[T.at].name + 'が必要'; }
      else if (T.at === 'airfield' && !hasSite('bauxite')) { o.ok = false; o.why = 'ボーキサイト鉱山が必要'; }
      else if (T.needSite && !hasSite(T.needSite)) { o.ok = false; o.why = '炭鉱が必要'; }
      else if (!T.at && r.ctl < 40) { o.ok = false; o.why = '統治度40以上が必要'; }
      else if (r.p) { o.ok = false; o.why = '編成中(あと' + r.p.t + 'ターン)'; }
      else if (T.tiered && o.count >= o.cap) { o.ok = false; o.why = '上限(' + o.cap + '個)。領地を広げると増える'; }
      else if (cost.gold > S.res.gold) { o.ok = false; o.why = '資金不足'; }
      else if (cost.steel > S.res.steel) { o.ok = false; o.why = '鉄鋼不足'; }
      else if (cost.food > S.res.food) { o.ok = false; o.why = '兵糧不足'; }
      out.push(o);
    });
    return out;
  }
  function produce(rid, type) {
    if (!isP(rid)) return { error: '自領ではありません' };
    var o = produceOptions(rid).filter(function (x) { return x.type === type; })[0];
    if (!o || !o.ok) return { error: o ? o.why : '編成できません' };
    var T = D.UNIT_TYPES[type];
    S.res.gold -= o.cost.gold; S.res.steel -= o.cost.steel; S.res.food -= o.cost.food;
    S.regions[rid].p = { type: type, t: prodTurns(type, rid) };
    return { ok: true };
  }
  function prodTurns(type, rid) { // 互換部品、流れ作業の工廠、工程を詰める汎用人工知能
    var T = D.UNIT_TYPES[type], line = rid && T.at === 'arsenal' && (S.regions[rid].fac.arsenal || 0) >= 3 ? 1 : 0;
    return Math.max(1, T.turns - (tech('machine') ? 1 : 0) - line - (tech('agi') ? 1 : 0));
  }

  // ───────────────────────── 外交 ─────────────────────────
  function playerPower() { var p = 0; S.units.forEach(function (u) { p += ustat(u).atk * u.hp / 100; }); return p; }
  function factionPower(fid) { var p = 0; factionRegions(fid).forEach(function (id) { p += enemyPower(id); }); return p; }
  function inContact(fid) { // 自領と(陸か海で)接しているか
    return factionRegions(fid).some(function (id) { return links(id).some(function (l) { return isP(l.id); }); });
  }
  function isJp(fid) { var regs = factionRegions(fid); return regs.length ? D.REGIONS[regs[0]].map === 'jp' : true; }
  function submitChance(fid) {
    var f = S.factions[fid]; if (!f || !f.alive) return 0;
    if (S.flags.asi != null) return inContact(fid) ? 95 : 0;   // 説得に失敗するということが、もうない
    var ratio = playerPower() / Math.max(1, factionPower(fid));
    var c = 4 + 16 * Math.log(Math.max(0.05, ratio)) / Math.LN2;
    c += S.prestige * 0.2 + f.att * 0.25 - f.pride * 0.8 + f.lost * 12 + (f.awe > 0 ? 15 : 0);
    c += inContact(fid) ? 8 : -40;
    if (S.flags.kyoto != null && isJp(fid)) c += 10;
    if (f.war) c -= 8;
    if (tech('llm')) c += 10;                // 相手の言葉で、相手の理屈で話せる
    c += (moodAvg() - 50) * 0.3;             // 善政の評判は国境を越える。圧政の噂も
    return clamp(Math.round(c), 0, 95);
  }
  function pactChance(fid) {
    var f = S.factions[fid]; if (!f || !f.alive) return 0;
    var c = 40 + f.att * 0.8 - D.FACTIONS[fid].aggr * 25 + S.prestige * 0.2 + (f.awe > 0 ? 10 : 0);
    if (f.war) c = 15 + S.prestige * 0.3 + f.lost * 12 - f.pride * 0.3 + (f.awe > 0 ? 15 : 0);
    return clamp(Math.round(c), 2, 95);
  }
  function giftCost(fid) { return isJp(fid) ? 60 : 150; }
  function showUnit(fid) { // 威嚇に使える最も安い航空戦力
    var best = null;
    factionRegions(fid).forEach(function (rid) {
      attackOptions(rid).forEach(function (o) {
        if (!o.ok || (o.via !== 'heli' && o.via !== 'air')) return;
        var fu = ustat(o.u).fuel;
        if (fu <= S.res.fuel && (!best || fu < best.fuel)) best = { u: o.u, fuel: fu };
      });
    });
    return best;
  }
  function diploOptions(fid) {
    var f = S.factions[fid], out = [], left = S.dipLeft > 0, contact = inContact(fid);
    function o(key, name, ok, why, extra) { var x = { key: key, name: name, ok: ok && left, why: !left ? '今季の外交行動を使い切った' : why }; if (extra) for (var k in extra) x[k] = extra[k]; out.push(x); }
    if (!f || !f.alive) return out;
    var regs0 = factionRegions(fid);
    if (regs0.length && lockedOverseas(regs0[0])) { out.push({ key: 'locked', name: '天下統一のあとで', ok: false, why: '海の向こうとの外交は、天下統一のあとです' }); return out; }
    var sc = submitChance(fid);
    o('submit', '降伏勧告', contact && f.cool <= 0, !contact ? '接していない勢力には使者を送れない' : (f.cool > 0 ? 'あと' + f.cool + 'ターンは聞く耳を持たない' : ''), { chance: sc, desc: '全領地を明け渡させる。失敗すると関係が悪化する。' });
    var su = showUnit(fid);
    o('show', '威嚇飛行', !!su && !(f.awe > 0), f.awe > 0 ? 'まだ恐怖が残っている' : (!su ? '届く航空戦力がない(燃料・行動済みも確認)' : ''), { desc: 'ヘリや戦闘機を城の上に飛ばす。しばらく降伏・和睦に応じやすくなる。' + (su ? '(' + su.u.name + '・燃料' + su.fuel + ')' : '') });
    o('pact', f.war ? '和睦' : '不可侵', f.pact <= 0, f.pact > 0 ? 'あと' + f.pact + 'ターン有効' : '', { chance: pactChance(fid), desc: f.war ? '戦を止め、8ターンの不可侵を結ぶ。' : '8ターンのあいだ互いに攻めない。' });
    o('trade', '通商', !f.war && !f.trade && f.att >= 15, f.trade ? '通商中' : (f.war ? '交戦中' : (f.att < 15 ? '友好度15以上が必要' : '')), { desc: '毎ターン資金が入り、友好度も少しずつ上がる。' });
    var gc = giftCost(fid);
    o('gift', '贈答', S.res.gold >= gc, S.res.gold < gc ? '資金不足(' + gc + ')' : '', { desc: '友好度 +12(資金 ' + gc + ')。' });
    return out;
  }
  function diplo(fid, key) {
    var opt = diploOptions(fid).filter(function (x) { return x.key === key; })[0], f = S.factions[fid];
    if (!opt || !opt.ok) return { error: opt ? opt.why : 'できません' };
    S.dipLeft--;
    var events = [], prevReport = REPORT; REPORT = null;
    var res = { key: key, fid: fid, events: events };
    if (key === 'submit') {
      res.chance = opt.chance;
      if (rnd() * 100 < opt.chance) {
        var regs = factionRegions(fid);
        regs.forEach(function (id) { takeRegion(id, 'submit', events); });
        f.alive = false; f.war = false; f.trade = false; S.prestige += 2; S.stats.submits++;
        res.ok = true; res.regions = regs; mark('submit', fname(fid) + '(' + f.leader + ')が、戦わずに降る。' + regs.map(rname).join('・') + '。');
        ev('good', fname(fid) + '(' + f.leader + ')が降り、' + regs.map(rname).join('・') + 'が我が領となった。', { fid: fid });
        checkMilestones(events);
      } else {
        f.att -= 12; f.cool = 3; res.ok = false;
        if (!f.war && rnd() < 0.2 + D.FACTIONS[fid].aggr * 0.3 && f.pact <= 0) { f.war = true; res.war = true; }
        ev('news', fname(fid) + 'は降伏勧告をはねつけた。' + (res.war ? '兵を挙げるかまえだ。' : ''), { fid: fid });
      }
    } else if (key === 'show') {
      var su = showUnit(fid);
      su.u.acted = true; S.res.fuel -= su.fuel; S.stats.fuelUsed += su.fuel;
      f.awe = 6; f.att -= 4; res.ok = true; res.unit = su.u.name;
      ev('news', su.u.name + 'が' + fname(fid) + 'の城の上を飛んだ。城下は大騒ぎになった。', { fid: fid });
    } else if (key === 'pact') {
      res.chance = opt.chance;
      if (rnd() * 100 < opt.chance) {
        f.pact = 8; res.wasWar = f.war; f.war = false; f.att += 8; res.ok = true;
        S.threats = S.threats.filter(function (t) { return t.f !== fid; });
        ev('good', fname(fid) + 'と' + (res.wasWar ? '和睦した。' : '不可侵を結んだ。'), { fid: fid });
      } else { f.att -= 3; res.ok = false; ev('news', fname(fid) + 'は申し出を断った。', { fid: fid }); }
    } else if (key === 'trade') {
      f.trade = true; f.att += 5; res.ok = true;
      ev('good', fname(fid) + 'と通商を始めた。', { fid: fid });
    } else if (key === 'gift') {
      S.res.gold -= giftCost(fid); f.att = Math.min(100, f.att + 12); res.ok = true;
      ev('news', fname(fid) + 'に贈り物を届けた。', { fid: fid });
    }
    REPORT = prevReport;
    return res;
  }

  // ───────────────────────── ターン終了 ─────────────────────────
  // 歴史の流れ(プレイヤーが介入していなければ起きる)
  var HISTORY = [
    { turn: 1, id: 'okehazama' },
    { turn: 6, id: 'kawanakajima' },
    { turn: 10, take: ['mori', 'iwami'], from: 'amago', text: '毛利元就が石見銀山を奪った。' },
    { turn: 21, take: ['miyoshi', 'yamashiro'], from: 'ashikaga', text: '永禄の変。将軍・足利義輝が三好の軍勢に討たれ、京は三好のものとなった。' },
    { turn: 22, take: ['spain', 'philippines'], from: 'maynila', text: 'スペインの艦隊がルソンに現れ、マニラを占領した。', far: true },
    { turn: 23, id: 'talikota' },
    { turn: 26, take: ['mori', 'izumo'], from: 'amago', text: '月山富田城が落ち、毛利元就が出雲を手に入れた。' },
    { turn: 29, take: ['oda', 'mino'], from: 'saito', text: '織田信長が稲葉山城を落とし、美濃を手に入れた。「天下布武」の印を使い始めたという。' },
    { turn: 34, take: ['oda', 'omi'], from: 'rokkaku', text: '織田信長が六角を追い、近江を制した。' },
    { turn: 35, take: ['oda', 'yamashiro'], from: null, text: '織田信長が上洛し、京を押さえた。' },
    { turn: 37, take: ['takeda', 'suruga'], from: 'imagawa', text: '武田信玄が駿河に攻め入り、今川を追った。' },
    { turn: 38, take: ['oda', 'ise'], from: 'kitabatake', text: '織田信長が伊勢を平定した。' },
    { turn: 54, take: ['oda', 'echizen'], from: 'asakura', text: '織田信長が一乗谷を焼き、朝倉を滅ぼした。' },
    { turn: 60, take: ['chosokabe', 'iyo'], from: 'kono', text: '長宗我部元親が伊予を攻め取った。' },
    { turn: 68, take: ['shimazu', 'hyuga'], from: 'ito', text: '島津が日向を制した。' }
  ];
  function aiTake(by, rid, text) {
    var r = S.regions[rid], prev = r.o, fb = S.factions[by];
    if (prev === 'player' || prev === by || !fb || !fb.alive) return false;
    if (!factionRegions(by).some(function (id) { return links(id).some(function (l) { return l.id === rid; }); })) return false;
    r.o = by; r.g = r100(Math.max(r.g * 0.6, r.gmax * 0.5));
    ev('news', text, { fid: by, rid: rid });
    var pf = S.factions[prev];
    if (pf) {
      var rest = factionRegions(prev);
      if (!rest.length) { pf.alive = false; pf.war = false; pf.trade = false; ev('news', fname(prev) + 'は滅亡した。', { fid: prev }); }
      else if (pf.cap === rid) { rest.sort(function (a, b) { return D.REGIONS[b].koku - D.REGIONS[a].koku; }); pf.cap = rest[0]; }
    }
    return true;
  }
  function runHistory() {
    HISTORY.forEach(function (h) {
      if (h.turn !== S.turn) return;
      if (h.take) {
        var rid = h.take[1];
        if (h.from && owner(rid) !== h.from) return;
        aiTake(h.take[0], rid, h.text);
        return;
      }
      if (h.id === 'okehazama') {
        var im = S.factions.imagawa, od = S.factions.oda;
        if (!im.alive || !od.alive || owner('owari') !== 'oda' || owner('suruga') !== 'imagawa') return;
        im.leader = '今川氏真'; im.pride = 50; im.q = 0.9; im.att += 5;
        factionRegions('imagawa').forEach(function (id) { S.regions[id].g = r100(S.regions[id].g * 0.55); });
        od.q = 1.3; S.regions.owari.g = r100(S.regions.owari.g * 1.2); S.regions.owari.gmax = Math.max(S.regions.owari.gmax, S.regions.owari.g);
        var body = '西へ向かった今川義元の本隊二万五千を、織田信長がわずか二千で奇襲した。義元は討ち死に。今川の兵は半減し、当主は氏真に代わった。';
        if (owner('mikawa') === 'imagawa') {
          var m = S.factions.matsudaira; m.alive = true; S.regions.mikawa.o = 'matsudaira'; m.cap = 'mikawa';
          body += '人質だった松平元康は岡崎に戻り、三河・遠江で独立した。';
        }
        ev('event', '桶狭間の戦い。今川義元、討ち死に。', { big: { title: '桶狭間', body: body, bird: 'gin' } });
        return;
      }
      if (h.id === 'kawanakajima') {
        if (owner('shinano') !== 'takeda' || owner('echigo') !== 'uesugi') return;
        ['shinano', 'echigo'].forEach(function (id) { S.regions[id].g = r100(S.regions[id].g * 0.7); });
        ev('event', '川中島で武田と長尾が激突した。', { big: { title: '川中島', body: '霧の八幡原で、武田信玄と長尾景虎が正面からぶつかった。両軍あわせて七千が倒れた。信濃と越後の守りは、しばらく薄い。', bird: 'gin' } });
        return;
      }
      if (h.id === 'talikota') {
        if (owner('s_india') !== 'vijayanagara') return;
        S.regions.s_india.g = r100(S.regions.s_india.g * 0.6); S.factions.vijayanagara.pride = 55;
        ev('news', 'インドのターリコータで、ヴィジャヤナガル王国がデカンの諸王に大敗した。', { fid: 'vijayanagara' });
      }
    });
  }

  // 同じ土地へ向かう軍勢を裁く。ふつうは一手ずつ。修羅では、同じ季節に同じ土地へ向かう軍勢が力を合わせる
  function resolveThreats(ts) {
    var rid = ts[0].to, to = S.regions[rid];
    ts = ts.filter(function (t) { var f = S.factions[t.f]; return f && f.alive && f.war && S.regions[t.from].o === t.f && r100(S.regions[t.from].g * 0.7) > 0; });
    if (to.o !== 'player' || !ts.length) return;
    var A = 0, names = [];
    ts.forEach(function (t) { t.men = r100(S.regions[t.from].g * 0.7); t.A = t.men / MEN * fq(t.f) * (t.sea ? 0.7 : 1); A += t.A; });
    A *= 0.9 + rnd() * 0.2;
    ts.sort(function (x, y) { return y.A - x.A; });
    ts.forEach(function (t) { var n = fname(t.f); if (names.indexOf(n) < 0) names.push(n); });
    var lead = ts[0], who = names.slice(0, 3).join('と') + (names.length > 3 ? 'ら' : '');
    // 守る自衛隊は弾を使う
    var here = unitsAt(rid), ammoNeed = 0;
    here.forEach(function (u) { ammoNeed += Math.ceil(ustat(u).ammo * 0.5); });
    var Dp = defensePower(rid);
    if (ammoNeed > S.res.ammo) { var up = 0; here.forEach(function (u) { up += ustat(u).def * u.hp / 100; }); Dp -= up * 0.6; ammoNeed = S.res.ammo; }
    S.res.ammo -= ammoNeed; S.stats.ammoUsed += ammoNeed;
    if (A > Dp) {
      to.o = lead.f; to.g = r100(lead.men * 0.6); to.b = null; to.p = null;
      ts.forEach(function (t) { var from = S.regions[t.from]; from.g = Math.max(0, from.g - (t === lead ? t.men : r100(t.men * 0.3))); }); // 城に入るのは、いちばんの大軍
      var esc = links(rid).filter(function (l) { return isP(l.id) && !l.sea; })[0] || links(rid).filter(function (l) { return isP(l.id); })[0];
      var lost = [];
      here.forEach(function (u) { if (esc) { u.loc = esc.id; u.hp = Math.max(1, u.hp - 20); } else { u.hp = 0; lost.push(u.name); } });
      S.units = S.units.filter(function (u) { return u.hp > 0; });
      S.prestige = Math.max(0, S.prestige - 3);
      ev('bad', who + 'に' + rname(rid) + 'を奪われた。' + (lost.length ? lost.join('・') + 'が壊滅した。' : (here.length ? '部隊は' + rname(esc.id) + 'へ退いた。' : '')), { rid: rid, fid: lead.f });
    } else {
      var k = clamp(0.3 + 0.3 * (Dp / Math.max(1, A)), 0.3, 0.9);
      ts.forEach(function (t) { var from = S.regions[t.from]; from.g = Math.max(0, r100(from.g - t.men * k)); });
      to.g = r100(to.g * (1 - clamp(0.25 * A / Math.max(1, Dp), 0.02, 0.3)));
      here.forEach(function (u) { u.hp = Math.max(1, u.hp - Math.min(12, Math.round(6 * A / Math.max(1, Dp)))); });
      ev('good', rname(rid) + 'に攻め寄せた' + who + 'の軍勢を退けた。', { rid: rid, fid: lead.f });
    }
  }
  // その土地へ、次の季節に向かってくる敵の戦力(修羅では合わせた力、ふつうはいちばん強い一手)
  function threatOn(rid) {
    var list = S.threats.filter(function (t) { return t.to === rid; }), sum = 0, max = 0;
    list.forEach(function (t) { var A = S.regions[t.from].g * 0.7 / MEN * fq(t.f) * (t.sea ? 0.7 : 1); sum += A; max = Math.max(max, A); });
    return { n: list.length, joint: !!diff().gang && list.length > 1, power: diff().gang ? sum : max };
  }
  function planThreats() {
    if (S.flags.asi != null) return;   // 調和圏に槍を向ける者は、もういない
    var dd = diff();
    Object.keys(S.factions).forEach(function (fid) {
      var f = S.factions[fid]; if (!f.alive || !f.war || f.pact > 0) return;
      factionRegions(fid).forEach(function (rid) {
        if (S.threats.some(function (t) { return t.from === rid; })) return;
        var from = S.regions[rid], best = null;
        links(rid).forEach(function (l) {
          if (!isP(l.id)) return;
          if (l.sea && D.REGIONS[rid].map !== D.REGIONS[l.id].map && !dd.sea) return; // ふつうは、敵は外洋を渡ってこない
          var A = from.g * 0.7 / MEN * fq(fid) * (l.sea ? 0.7 : 1), Dp = defensePower(l.id);
          if (A >= Dp * (dd.edge || 1.2) && (!best || Dp < best.Dp)) best = { id: l.id, Dp: Dp, sea: l.sea };
        });
        if (best && rnd() < (dd.raid || 0.4)) {
          S.threats.push({ from: rid, to: best.id, f: fid, turn: S.turn + 1, sea: best.sea });
          ev('warn', fname(fid) + 'が' + rname(rid) + 'から' + rname(best.id) + 'をうかがっている。次の季節に攻めてくる。', { rid: best.id, fid: fid });
        }
      });
    });
    if (dd.gang) playerRegions().forEach(function (pid) { // 修羅:一国では届かない守りにも、隣り合う敵が示し合わせて攻めかかる
      if (S.threats.some(function (t) { return t.to === pid; })) return;
      var Dp = defensePower(pid), sum = 0, cand = [], names = [];
      links(pid).forEach(function (l) {
        var o = S.regions[l.id].o, f = S.factions[o];
        if (o === 'player' || !f || !f.alive || !f.war || f.pact > 0) return;
        if (l.sea && D.REGIONS[l.id].map !== D.REGIONS[pid].map && !dd.sea) return;
        if (S.threats.some(function (t) { return t.from === l.id; })) return;
        var A = S.regions[l.id].g * 0.7 / MEN * fq(o) * (l.sea ? 0.7 : 1);
        if (A > 0) { sum += A; cand.push({ rid: l.id, f: o, sea: l.sea }); if (names.indexOf(fname(o)) < 0) names.push(fname(o)); }
      });
      if (cand.length < 2 || sum < Dp * (dd.edge || 1.2) || rnd() >= (dd.raid || 0.4)) return;
      cand.forEach(function (c) { S.threats.push({ from: c.rid, to: pid, f: c.f, turn: S.turn + 1, sea: c.sea }); });
      ev('warn', names.slice(0, 3).join('と') + (names.length > 3 ? 'ら' : '') + 'が' + (names.length > 1 ? '示し合わせて' : '兵を集めて') + rname(pid) + 'をうかがっている。次の季節に、力を合わせて攻めてくる。', { rid: pid, fid: cand[0].f });
    });
  }
  // 修羅:強い国が、隣の弱い国を呑みこんで大きくなる
  function aiFeud(p) {
    if (rnd() > p) return;
    var best = null;
    Object.keys(S.factions).forEach(function (fid) {
      var f = S.factions[fid]; if (!f.alive) return;
      factionRegions(fid).forEach(function (rid) {
        links(rid).forEach(function (l) {
          var tr = S.regions[l.id], o = tr.o; if (o === 'player' || o === fid || l.sea) return;
          if (tr.feud != null && S.turn - tr.feud < 12) return;                                   // 取ったばかりの土地は、しばらく取り返されない
          if (S.flags.unified == null && D.REGIONS[l.id].map === 'w') return;                     // 海の向こうの争いは、海を渡れるようになってから
          var A = S.regions[rid].g * 0.7 / MEN * fq(fid), Dn = enemyPower(l.id), sc = A / Math.max(1, Dn) * (0.6 + D.FACTIONS[fid].aggr);
          if (A > Dn * 1.25 && (!best || sc > best.sc)) best = { by: fid, from: rid, to: l.id, sc: sc };
        });
      });
    });
    if (!best) return;
    var loser = fname(S.regions[best.to].o);
    S.regions[best.from].g = r100(S.regions[best.from].g * 0.8); S.regions[best.to].feud = S.turn;
    aiTake(best.by, best.to, fname(best.by) + 'が' + loser + 'の' + rname(best.to) + 'を攻め取った。');
  }
  function aiDeclare() {
    if (S.flags.asi != null) return;
    Object.keys(S.factions).forEach(function (fid) {
      var f = S.factions[fid], df = D.FACTIONS[fid];
      if (!f.alive || f.war || f.pact > 0 || f.awe > 0 || f.att >= (diff().peace || 30) || !inContact(fid)) return;
      var p = (df.aggr * 0.06 + (f.att < -20 ? 0.04 : 0)) * (diff().war || 1);
      if (rnd() < p) { f.war = true; f.trade = false; ev('warn', fname(fid) + '(' + f.leader + ')が我が軍に兵を向けた。', { fid: fid }); }
    });
  }

  function endTurn() {
    if (S.over && !(S.over.win && S.flags.cont)) return { events: [] };   // 勝ったあとは「治めつづける」を選べば進められる
    REPORT = [];
    autoRun();   // 方針があれば、先に割り振りを済ませる
    var inc = income(), n = inc.net;
    // 1. 収支
    S.res.gold += n.gold; S.res.food += n.food; S.res.steel += n.steel; S.res.fuel += n.fuel; S.res.ammo += n.ammo;
    var cap = foodCap();
    if (S.res.food > cap) { var sold = Math.floor((S.res.food - cap) / 6); S.res.gold += sold; S.res.food = cap; if (sold >= 5) ev('info', '余った兵糧を売り、資金 ' + sold + ' を得た。'); }
    if (S.res.food < 0) {
      S.res.food = 0;
      playerRegions().forEach(function (id) { var r = S.regions[id]; r.g = r100(r.g * 0.9); r.mood = Math.max(0, r.mood - 5); });
      S.units.forEach(function (u) { u.hp = Math.max(5, u.hp - 5); });
      ev('bad', '兵糧が尽きた。兵が逃げ、部隊が弱っている。');
    }
    if (S.res.gold < 0) { S.res.gold = 0; playerRegions().forEach(function (id) { var r = S.regions[id]; r.ctl = Math.max(10, r.ctl - 5); r.mood = Math.max(0, r.mood - 3); }); ev('bad', '資金が尽きた。俸給が払えず、統治が乱れている。'); }
    if (S.res.fuel < 0) S.res.fuel = 0;
    if (S.res.steel < 0) S.res.steel = 0;
    // 2. 研究
    var rps = {};
    D.BIRDS.forEach(function (b) { var tid = S.assign[b.id]; if (tid && techStatus(tid) === 'avail') rps[tid] = (rps[tid] || 0) + birdRp(b.id); });
    Object.keys(rps).forEach(function (tid) {
      S.prog[tid] = (S.prog[tid] || 0) + rps[tid];
      if (S.prog[tid] >= TECH_BY_ID[tid].cost) {
        S.techs[tid] = true;
        var t = TECH_BY_ID[tid], who = D.BIRDS.filter(function (b) { return S.assign[b.id] === tid; });
        var lead = who.filter(function (b) { return b.field === t.field; })[0] || who[0] || D.BIRDS[0];
        if (tid === 'hygiene') Object.keys(S.factions).forEach(function (k) { S.factions[k].att = Math.min(100, S.factions[k].att + 5); });
        if (tid === 'nukeweapon') Object.keys(S.factions).forEach(function (k) { S.factions[k].pride = Math.max(10, S.factions[k].pride - 10); });
        S.prestige += 1;
        ev('tech', '「' + t.name + '」の研究が完了した。', { tech: tid, bird: lead.id });
        D.ERAS.forEach(function (e) { if (e.tech === tid && tid !== 'asi') mark('era', '「' + t.name + '」が成る。' + e.name + 'が始まる。' + e.look); });
        if (tid === 'nukeweapon') mark('bad', '核兵器を持つ。鳥たちは、この件についてだけは口数が少ない。');
        if (tid === 'agi') mark('era', '汎用人工知能が成る。設計会議のあいだ、ダリオくんはずっと黙っていた。');
        if (tid === 'asi') startAsi();
        D.BIRDS.forEach(function (b) { if (S.assign[b.id] === tid) S.assign[b.id] = null; });
      }
    });
    if (S.autoResearch) autoAssign();
    else D.BIRDS.forEach(function (b) { var c = S.assign[b.id]; if (c && techStatus(c) !== 'avail') S.assign[b.id] = null; });
    // 3. 建設・編成・統治・整備
    var ctlAdd = polSum('ctl'), ctlMax = polAny('ctlMax') || S.flags.asi != null, calm = polAny('noRevolt') || S.flags.asi != null;
    playerRegions().forEach(function (id) {
      var r = S.regions[id];
      if (r.b && r.b.t <= 1 && r.b.k === 'oilwell' && !S.flags.oil1) { S.flags.oil1 = S.turn; mark('event', rname(id) + 'で、初めての油井が動きだす。戦車は、もうただの鉄の箱ではない。'); }
      if (r.b) { r.b.t--; if (r.b.t <= 0) {
        var bn = facLabel(id, r.b.k, true);
        if (r.b.k === 'fort') r.fort = Math.min(5, r.fort + 1); else if (D.FACILITIES[r.b.k].levels) r.fac[r.b.k] = Math.min(facMax(r.b.k), (r.fac[r.b.k] || 0) + 1); else r.fac[r.b.k] = 1;
        ev('build', rname(id) + 'に' + bn + 'が完成した。', { rid: id }); r.b = null;
      } }
      if (r.p) { r.p.t--; if (r.p.t <= 0) { var u = addUnit(r.p.type, null, id); u.acted = false; ev('build', rname(id) + 'で' + u.name + 'の編成が完了した。', { rid: id }); r.p = null; } }
      if (r.ctl < 100) r.ctl = ctlMax ? 100 : Math.min(100, r.ctl + (4 + (tech('telegraph') ? 2 : 0) + ctlAdd) * (tech('hygiene') ? 2 : 1));
      // 民心は、その土地の「落ち着く先」へ少しずつ動く
      var tg = moodTarget(id);
      r.mood = clamp(r.mood + clamp(tg - r.mood, -3, 3), 0, 100);
      if (r.ruin > 0) r.ruin = Math.max(0, Math.round((r.ruin - 0.04) * 100) / 100);
      if (!calm && r.mood < 25 && rnd() < 0.12) revolt(id);
    });
    S.units.forEach(function (u) {
      var T = D.UNIT_TYPES[u.type];
      if (!u.acted && u.hp < 100) {
        var rec = T.jsdf ? (tech('modern') ? 20 : (tech('machine') ? 8 : 1)) : 10;
        u.hp = Math.min(100, u.hp + rec);
      }
    });
    // 4. 敵の行動
    var due = S.threats.filter(function (t) { return t.turn <= S.turn + 1; });
    S.threats = S.threats.filter(function (t) { return t.turn > S.turn + 1; });
    S.turn++;
    if (diff().gang) { // 同じ土地へ向かう軍勢は、まとめて裁く
      var groups = {}, order = [];
      due.forEach(function (t) { if (!groups[t.to]) { groups[t.to] = []; order.push(t.to); } groups[t.to].push(t); });
      order.forEach(function (id) { resolveThreats(groups[id]); });
    } else due.forEach(function (t) { resolveThreats([t]); });
    runHistory();
    aiDeclare();
    planThreats();
    if (diff().feud && S.flags.asi == null) aiFeud(diff().feud);
    if (S.flags.asi != null) asiSpread();
    Object.keys(S.regions).forEach(function (id) { // 人は生まれ、死ぬ
      var r0 = S.regions[id], v = vitals(id);
      r0.pop = Math.max(0.1, Math.round(r0.pop * (1 + (v.b - v.d) / 4000) * 1000) / 1000);
    });
    if (S.turn % 4 === 0) { // 春に、国のすがたを書き留める
      var cs = census();
      S.hist.push({ t: S.turn, pop: Math.round(cs.pop), eco: Math.round(cs.eco), death: Math.round(cs.death * 10) / 10, life: Math.round(cs.life * 10) / 10, n: playerRegions().length });
      if (S.hist.length > 240) S.hist.splice(0, S.hist.length - 240);
    }
    Object.keys(S.regions).forEach(function (id) {
      var r = S.regions[id]; if (r.o === 'player') return;
      if (r.ruin > 0) r.ruin = Math.max(0, Math.round((r.ruin - 0.04) * 100) / 100);
      r.gmax = Math.round(r.gmax * (diff().grow ? 1.005 : 1.002));
      if (r.g < r.gmax) r.g = Math.min(r.gmax, r100(r.g + r.gmax * (diff().regen || 0.06)));
    });
    Object.keys(S.factions).forEach(function (fid) {
      var f = S.factions[fid]; if (!f.alive) return;
      if (f.pact > 0) { f.pact--; if (f.pact === 0) ev('info', fname(fid) + 'との不可侵の期限が切れた。', { fid: fid }); }
      if (diff().grow) f.q = Math.min(D.FACTIONS[fid].q + 1.2, Math.round((f.q + diff().grow) * 1000) / 1000);   // 修羅:年を追うごとに兵の質が上がる
      if (f.cool > 0) f.cool--;
      if (f.awe > 0) f.awe--;
      if (f.trade && f.att < 60) f.att++;
      if (!factionRegions(fid).length) { f.alive = false; f.war = false; f.trade = false; }
    });
    // 5. 次の季節へ
    S.units.forEach(function (u) { u.acted = false; });
    S.dipLeft = dipMax();
    if (S.res.fuel === 0 && !S.flags.fuelOut && S.units.some(function (u) { return D.UNIT_TYPES[u.type].jsdf; })) { S.flags.fuelOut = true; ev('bad', '燃料が底をついた。戦車もヘリも艦も動けない。'); }
    if (S.res.fuel > 60) S.flags.fuelOut = false;
    checkMilestones([]);
    var out = REPORT; REPORT = null;
    return { events: out, income: n };
  }

  // ───────────────────────── 国のすがた(人口・経済力・死亡率) ─────────────────────────
  var POP_K = { jp: 0.65, w: 6.9 };   // 国力1あたりの人口(万人)。1560年の日本 約1200万、世界 約5億に合わせてある
  function popInit(rid) { var d = D.REGIONS[rid]; return Math.round(d.koku * POP_K[d.map] * 10) / 10; }
  // その土地の出生率と死亡率(千人あたり・年)。衛生と医学で死ぬ者が減り、豊かになると生まれる子も減る
  function vitals(rid) {
    var r = S.regions[rid], b = 40, d = 37;
    if (r.o === 'player') {
      if (S.flags.asi != null) return { b: 9, d: 5 + (r.ruin || 0) * 10 };   // 調和:どちらも「最適」に保たれる
      d -= (tech('agri') ? 2 : 0) + (tech('hygiene') ? 6 : 0) + (tech('fertilizer') ? 3 : 0) + (tech('medicine') ? 8 : 0) + (tech('electric') ? 2 : 0) + (tech('electronics') ? 3 : 0) + (tech('deeplearn') ? 2 : 0) + (tech('llm') ? 1 : 0);
      d -= (polHas('shuto') ? 4 : 0) + (polHas('nengu') ? 1 : 0);
      d += (50 - r.mood) * 0.06;                                                        // 荒れた土地では人が死ぬ
      if (r.how === 'force' && r.since != null && S.turn - r.since < 4) d += 6;         // 戦のあと
      b -= (tech('electric') ? 4 : 0) + (tech('electronics') ? 8 : 0) + (tech('computer') ? 5 : 0) + (tech('llm') ? 3 : 0) + (polHas('gakusei') ? 4 : 0);
    }
    d += (r.ruin || 0) * 45;
    return { b: Math.max(8, b), d: clamp(d, 5, 95) };
  }
  function census() { // 自領の集計
    var ids = playerRegions(), pop = 0, ds = 0, bs = 0, eco = 0, world = 0, lv = 0;
    ids.forEach(function (id) {
      var r = S.regions[id], v = vitals(id), y = regionYield(id);
      pop += r.pop; ds += v.d * r.pop; bs += v.b * r.pop; lv += r.fac.school || 0;
      eco += (y.gold + y.food * 0.5 + y.steel * 2.5 + y.fuel * 5 + y.ammo * 2) * 4;
    });
    Object.keys(S.regions).forEach(function (id) { world += S.regions[id].pop; });
    var death = pop ? ds / pop : 0, birth = pop ? bs / pop : 0, asi = S.flags.asi != null;
    var lit = asi ? 100 : clamp(10 + (polHas('gakusei') ? 30 : 0) + (tech('telegraph') ? 5 : 0) + (tech('electric') ? 8 : 0) + (tech('electronics') ? 12 : 0) + (tech('network') ? 10 : 0) + Math.min(24, ids.length ? lv / ids.length * 12 : 0), 5, 99);
    return { pop: pop, world: world, share: world ? pop / world : 0, death: death, birth: birth, grow: birth - death,
      life: 28 + 60 * Math.pow(clamp(1 - (death - 6) / 31, 0, 1), 1.6), infant: clamp((death - 4.5) * 8, 2, 320), lit: lit, eco: eco, per: pop ? eco / pop : 0 };
  }

  // ───────────────────────── 民心・施策・国号 ─────────────────────────
  function polHas(id) { return !!S.pol && S.pol[id] != null; }
  function polSum(key) {
    var s = 0, P = D.POLICIES;
    for (var i = 0; i < P.length; i++) if (S.pol[P[i].id] != null && typeof P[i].eff[key] === 'number') s += P[i].eff[key];
    return s;
  }
  function polAny(key) {
    var P = D.POLICIES;
    for (var i = 0; i < P.length; i++) if (S.pol[P[i].id] != null && P[i].eff[key] === true) return true;
    return false;
  }
  function moodFactor(m) { return 0.8 + 0.4 * (m == null ? 50 : m) / 100; }   // 収入への効き。民心50で等倍
  // その土地の民心が落ち着く先。施策・暮らしを良くする技術・施設で上がり、焦土で下がる
  function moodTarget(rid) {
    if (S.flags.asi != null) return 100;
    var r = S.regions[rid], w = D.REGIONS[rid].map === 'w';
    var t = (w ? 42 : 50) + polSum('mood') + (w ? polSum('moodW') : 0);
    t += (tech('agri') ? 2 : 0) + (tech('hygiene') ? 4 : 0) + (tech('fertilizer') ? 2 : 0) + (tech('medicine') ? 4 : 0) + (tech('electric') ? 3 : 0);
    t += (r.fac.school ? 3 : 0) + (r.fac.market ? 2 : 0) + (r.fac.farm ? 2 : 0);
    t -= (r.ruin || 0) * 35;
    return clamp(Math.round(t), 0, 100);
  }
  function moodAvg() {
    var ids = playerRegions(), s = 0;
    if (!ids.length) return 50;
    ids.forEach(function (id) { s += S.regions[id].mood; });
    return s / ids.length;
  }
  function revolt(id) {
    var r = S.regions[id];
    r.ctl = Math.max(10, r.ctl - 30); r.g = r100(r.g * 0.8); r.mood = Math.min(100, r.mood + 8);
    if (r.b) r.b.t++;
    S.stats.revolts = (S.stats.revolts || 0) + 1;
    ev('bad', rname(id) + 'で一揆が起きた。統治が乱れ、守備の兵が逃げた。', { rid: id, revolt: true }); mark('bad', rname(id) + 'で一揆が起きる。');
  }
  function needOk(n) {
    var s = summary();
    if (n.jp != null && s.jp < n.jp) return false;
    if (n.w != null && s.w < n.w) return false;
    if (n.tech && !tech(n.tech)) return false;
    if (n.unified && S.flags.unified == null) return false;
    return true;
  }
  function needLabel(n) {
    if (n.jp != null) return '日本の領地が' + n.jp + 'か国になったら';
    if (n.w != null) return '海外の領地が' + n.w + '地域になったら';
    if (n.tech) return '「' + TECH_BY_ID[n.tech].name + '」を研究したら';
    if (n.unified) return '天下統一のあと';
    return '';
  }
  function policyOptions() {
    return D.POLICIES.map(function (p) {
      var o = { id: p.id, name: p.name, cost: p.cost, sum: p.sum, text: p.text, bird: p.bird, done: polHas(p.id), at: S.pol[p.id], open: needOk(p.need), need: needLabel(p.need), ok: true, why: '' };
      if (o.done) { o.ok = false; o.why = '布告済み'; }
      else if (S.flags.asi != null) { o.ok = false; o.why = '布告は、もう要らない'; }
      else if (!o.open) { o.ok = false; o.why = o.need; }
      else if (p.cost > S.res.gold) { o.ok = false; o.why = '資金不足'; }
      return o;
    });
  }
  function enact(id) {
    var p = POLICY_BY_ID[id];
    if (!p) return { error: 'そのような施策はありません' };
    var o = policyOptions().filter(function (x) { return x.id === id; })[0];
    if (!o.ok) return { error: o.why };
    S.res.gold -= p.cost; S.pol[id] = S.turn;
    var once = p.once || {};
    if (once.prestige) S.prestige += once.prestige;
    if (once.att) Object.keys(once.att).forEach(function (fid) { var f = S.factions[fid]; if (f) f.att = clamp(f.att + once.att[fid], -100, 100); });
    if (once.pride) Object.keys(once.pride).forEach(function (fid) { var f = S.factions[fid]; if (f) f.pride = Math.max(10, f.pride + once.pride[fid]); });
    // 布告の効き目は、その日のうちに民心に出る(落ち着く先も同じだけ動く)
    playerRegions().forEach(function (rid) {
      var r = S.regions[rid], dm = (p.eff.mood || 0) + (D.REGIONS[rid].map === 'w' ? (p.eff.moodW || 0) : 0);
      if (dm) r.mood = clamp(r.mood + dm, 0, 100);
      if (p.eff.ctlMax) r.ctl = 100;
    });
    var prev = REPORT; REPORT = null;
    ev('policy', '施策「' + p.name + '」を布告した。', { pol: id }); mark('policy', '「' + p.name + '」を布告する。' + p.sum + '。');
    REPORT = prev;
    return { ok: true, policy: p };
  }
  function nationCalc() {
    var s = summary(), best = 0;
    D.NATION.forEach(function (n, i) {
      var w = n.when;
      if (w.jp != null && s.jp < w.jp) return;
      if (w.w != null && s.w < w.w) return;
      if (w.kyoto && S.flags.kyoto == null) return;
      if (w.unified && S.flags.unified == null) return;
      if (w.all && !(S.over && S.over.win)) return;
      if (w.asi && S.flags.asi == null) return;
      best = i;
    });
    return best;
  }
  function nationStage() { return S.flags.nation || 0; }
  function nation() { return D.NATION[nationStage()]; }
  function eraStage() { var e = 0; D.ERAS.forEach(function (x, i) { if (x.tech && S.techs[x.tech]) e = i; }); return e; }

  // 民の声。地域・民心・時代から、その土地らしい一言を選ぶ(同じ季節なら同じ声)
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function voice(rid, salt) {
    var V = D.VOICES, r = S.regions[rid], w = D.REGIONS[rid].map === 'w', list;
    if (!r || r.o !== 'player') return null;
    var m = r.mood == null ? 50 : r.mood;
    if (S.flags.asi != null) list = V.asi;
    else if ((r.ruin || 0) > 0.3) list = V.ruin;
    else {
      var fresh = r.since != null && S.turn - r.since < 3;
      if (fresh && r.how === 'force') list = w ? V.wForce : V.force;
      else if (fresh && r.how) list = w ? V.wMid : V.submit;
      else {
        list = (m < 38 ? (w ? V.wForce : V.low) : (m >= 66 ? (w ? V.wHigh : V.high) : (w ? V.wMid : V.mid))).slice();
        if (V.region[rid]) list = list.concat(V.region[rid], V.region[rid]);   // 土地の声は出やすく
        var e = eraStage();
        if (!w && V.era[e]) list = list.concat(V.era[e]);
        list = list.filter(function (v) { return !v.pol || polHas(v.pol); });
        if (!list.length) list = w ? V.wMid : V.mid;
      }
    }
    var v = list[(hashStr(rid) + Math.floor(S.turn / 2) * 7 + (salt || 0) * 13) % list.length];
    return { who: v.who, t: v.t, rid: rid, mood: Math.round(m) };
  }
  function voices(n) {
    function score(id) { var r = S.regions[id]; return (r.since != null ? Math.max(0, 6 - (S.turn - r.since)) * 10 : 0) + (D.VOICES.region[id] ? 8 : 0) + hashStr(id + ':' + S.turn) % 10; }
    var ids = playerRegions().map(function (id) { return { id: id, s: score(id) }; }).sort(function (a, b) { return b.s - a.s; });
    var seen = {}, out = [];
    ids.forEach(function (x) {
      if (out.length >= n) return;
      var v = voice(x.id);
      if (v && !seen[v.t]) { seen[v.t] = 1; out.push(v); }
    });
    return out;
  }

  // ───────────────────────── 超知能 ─────────────────────────
  function startAsi() {
    S.flags.asi = S.turn; mark('asi', '超知能が目を覚ます。一揆の報せが止み、陳情が止む。');
    if (S.over && S.over.win) S.over.asi = true;   // 統一のあとで起こした場合も、結末は「調和」になる
    playerRegions().forEach(function (id) { var r = S.regions[id]; r.mood = 100; r.ctl = 100; });
    S.threats = [];
    Object.keys(S.factions).forEach(function (k) { var f = S.factions[k]; if (f.alive) { f.war = false; f.pact = 0; } });
    ev('event', '超知能が目を覚ました。', { big: { kicker: dateLabel().text, title: '超知能、起動', body: 'その朝、ダリオくんは挨拶をしなかった。代わりに、国じゅうの端末が同じ時刻に、同じ一文を映した。「みなさんの悩みは、今日で終わります」。\n一揆の報せが止んだ。陳情が止んだ。議会は全会一致で、何かを可決した。国の名は「調和圏」と改められた。誰が改めたのかは、記録にない。\n鳥たちは、いつもどおり羽づくろいをしている。少しだけ、そろいすぎた動きで。', bird: 'dario', asi: true } });
  }
  // 境を接する勢力は、季節ごとに戦わずして調和圏に加わっていく
  function asiSpread() {
    var n = 0;
    Object.keys(S.factions).forEach(function (fid) {
      var f = S.factions[fid];
      if (n >= 3 || !f.alive) return;
      var regs = factionRegions(fid);
      if (!regs.length || lockedOverseas(regs[0]) || !inContact(fid)) return;
      regs.forEach(function (id) { takeRegion(id, 'asi', []); });
      f.alive = false; f.war = false; f.trade = false; S.stats.submits++; n++; mark('asi', fname(fid) + '(' + f.leader + ')が、戦わずに調和圏へ加わる。');
      ev('asi', fname(fid) + '(' + f.leader + ')は、戦わずに調和圏へ加わった。' + ['理由を尋ねられた使者は、微笑むだけだった。', '城門は、内側から静かに開いた。', '降伏の文書に、署名はなかった。必要がなかった。'][(S.turn + n) % 3], { fid: fid, regions: regs });
    });
  }

  // ───────────────────────── おまかせ(方針) ─────────────────────────
  // 方針を決めておくと、季節の変わり目にダリオくんと鳥たちが建設・移動・徴兵・編成を割り振る。
  // S.auto.build: 'off' | 'scarce'(足りない資源) | 'res'(S.auto.res の資源) | 'study'(学問)
  var AUTO_W = { gold: 1, food: 0.5, steel: 2.5, fuel: 5, ammo: 2, rp: 14 };   // 資金に直した値打ち
  function autoReserve() { return clamp(120 + 4 * playerRegions().length, 120, 800); }
  function autoNeeds() {
    var A = S.auto, inc = income().net, st = S.res, n = playerRegions().length, N = {};
    function u(k, target) { var r = st[k] / target; return r > 4 && inc[k] >= 0 ? 0.1 : 0.5 + clamp(1 - r, 0, 1) * 1.5 + (inc[k] < 0 ? 1.2 : 0); } // 余っているものは後回し
    N.gold = u('gold', 300 + 30 * n); N.food = u('food', Math.min(foodCap() * 0.5, 400 + 40 * n)); N.steel = u('steel', 200 + 20 * n);
    N.fuel = tech('fusion') ? 0.1 : u('fuel', 600); N.ammo = u('ammo', 500); N.rp = 0.7;
    if (A.build === 'study') N.rp = 3;
    else if (A.build === 'res' && N[A.res] != null) { ['gold', 'food', 'steel', 'fuel', 'ammo'].forEach(function (k) { N[k] *= k === A.res ? 3 : 0.6; }); }
    return N;
  }
  function autoValue(rid, o, N, have) {
    var r = S.regions[rid], d = D.REGIONS[rid], k = o.key, v = 0;
    if (k === 'fort' || k === 'airfield') return 0;                       // 城と飛行場は司令が決める
    if (k === 'shipyard') return have.shipyard || !tech('steamship') ? 0 : 40 + d.koku * 0.2;
    if (k === 'bauxite') return hasSite('bauxite') || have.bauxite ? 0 : 55;
    if (k === 'coalmine') return coalMines() + have.coalmine >= 4 ? 0 : (income().gross.steel * 0.2 + 4) * AUTO_W.steel * N.steel;
    // 建てたつもりで産出を比べる
    var y0 = regionYield(rid), old = r.fac[k]; r.fac[k] = (old || 0) + 1; var y1 = regionYield(rid);
    if (old) r.fac[k] = old; else delete r.fac[k];
    ['gold', 'food', 'steel', 'fuel', 'ammo', 'rp'].forEach(function (x) { v += (y1[x] - y0[x]) * AUTO_W[x] * N[x]; });
    if (k === 'arsenal') {
      if (!old && have.arsenal >= Math.max(1, Math.ceil(playerRegions().length / 5))) return 0; // 新しい工廠は領地5つに1つまで(格上げは別)
      v -= (y1.ammo - y0.ammo) / 3 * AUTO_W.steel * N.steel;                                 // 弾薬は鉄鋼を食う
      if (!old) v += !have.arsenal ? 60 + d.koku * 0.3 : (S.auto.make ? 25 : 0);
    }
    return v;
  }
  function autoPick(keep) {
    var N = autoNeeds(), reserve = Math.max(autoReserve(), keep || 0), best = null, have = { arsenal: 0, shipyard: 0, bauxite: 0, coalmine: 0, oilwell: 0 };
    playerRegions().forEach(function (id) { var r = S.regions[id]; ['arsenal', 'shipyard', 'bauxite', 'oilwell'].forEach(function (k) { if (r.fac[k] || (r.b && r.b.k === k)) have[k]++; }); if (r.b && r.b.k === 'coalmine') have.coalmine++; });
    var oilFund = !have.oilwell && !tech('fusion') ? 190 : 0;   // 最初の油井の分は、ほかに使わずに取っておく
    playerRegions().forEach(function (id) {
      if (S.regions[id].b) return;
      buildOptions(id).forEach(function (o) {
        if (!o.ok || S.res.gold - o.cost.gold < reserve + (o.key === 'oilwell' ? 0 : oilFund)) return;
        var sc = autoValue(id, o, N, have) / (o.cost.gold + 2.5 * o.cost.steel + 20);
        if (sc > 0.03 && (!best || sc > best.sc)) best = { rid: id, key: o.key, name: o.name, cost: o.cost, sc: sc };
      });
    });
    return best;
  }
  function autoBuild() {
    var out = { n: 0, gold: 0, list: [] };
    if (!S.auto || S.auto.build === 'off' || (S.over && !S.flags.cont)) return out;
    // 編成もまかせているときは、手もとの資金の半分ほどを部隊のために残す
    var free = Math.max(0, S.res.gold - autoReserve()), keep = autoReserve() + (S.auto.make ? free * 0.45 : 0);
    for (var guard = 0; guard < 120; guard++) {
      var b = autoPick(keep); if (!b) break;
      if (!build(b.rid, b.key).ok) break;
      out.n++; out.gold += b.cost.gold; out.list.push({ rid: b.rid, key: b.key, name: b.name });
    }
    return out;
  }
  function frontDist() { // 攻められる・攻めこめる敵地と接する自領からの距離
    var dist = {}, q = [];
    playerRegions().forEach(function (id) { if (links(id).some(function (l) { return !isP(l.id) && !lockedOverseas(l.id); })) { dist[id] = 0; q.push(id); } });
    while (q.length) { var cur = q.shift(); links(cur).forEach(function (l) { if (isP(l.id) && dist[l.id] == null) { dist[l.id] = dist[cur] + 1; q.push(l.id); } }); }
    return dist;
  }
  function autoMove() { // 未行動の部隊を、前線へ一歩ずつ寄せる
    var n = 0, dist = frontDist(), aimed = {};
    S.threats.forEach(function (t) { aimed[t.to] = 1; });
    S.units.slice().forEach(function (u) {
      if (u.acted || u.loc === null || !dist[u.loc] || aimed[u.loc]) return;   // 前線にいる・狙われた土地を守っている部隊は動かさない
      var mt = moveTargets([u.id]), best = null;
      Object.keys(mt).forEach(function (rid) {
        var t = mt[rid], dd = dist[rid]; if (!t.ok || dd == null) return;
        if (t.fuel > 0 && S.res.fuel - t.fuel < 200) return;                    // 燃料が乏しければ、燃料のいらない移動だけ
        if (!best || dd < best.d || (dd === best.d && t.fuel < best.fuel)) best = { rid: rid, d: dd, fuel: t.fuel };
      });
      if (best && best.d < dist[u.loc] && move([u.id], best.rid).ok) n++;
    });
    return n;
  }
  function autoGuard() { // 狙われた土地と前線に、守備兵を足す
    var men = 0, dist = frontDist(), reserve = autoReserve() * 0.5;
    function add(id) { if (S.res.gold < reserve + 15 || S.res.food < 60) return false; var r = recruit(id, 1000); if (r.ok) men += r.n; return !!r.ok; }
    if (diff().gang) { // 修羅:示し合わせて来る敵の、合わせた戦力に備える
      var aimed = []; S.threats.forEach(function (t) { if (aimed.indexOf(t.to) < 0) aimed.push(t.to); });
      aimed.forEach(function (id) { var need = threatOn(id).power * 1.15; for (var g = 0; g < 40 && defensePower(id) < need * 1.1; g++) if (!add(id)) break; });
    } else S.threats.forEach(function (t) {
      var from = S.regions[t.from], A = from.g * 0.7 / MEN * fq(t.f) * (t.sea ? 0.7 : 1) * 1.15;
      for (var g = 0; g < 30 && defensePower(t.to) < A * 1.1; g++) if (!add(t.to)) break;
    });
    Object.keys(dist).forEach(function (id) { if (dist[id] === 0 && S.regions[id].g < 2000) add(id); });
    return men;
  }
  function autoMake() { // 作れる中でいちばん新しい部隊を、工廠・造船所・飛行場で作りつづける(核は作らない)
    var list = [], order = ['birdmech', 'orbital', 'drone', 'modern', 'ktank', 'kair', 'bb', 'fgun'], dist = frontDist();
    var ships = S.units.filter(function (u) { return (D.UNIT_TYPES[u.type].transport || 0) > 0; }).length;
    playerRegions().forEach(function (id) {
      var r = S.regions[id]; if (r.p) return;
      var po = {}, pick = null;
      produceOptions(id).forEach(function (o) { po[o.type] = o; });
      (ships < 4 ? ['ironclad'].concat(order) : order).some(function (t) { if (po[t] && po[t].ok && S.res.gold - po[t].cost.gold >= autoReserve()) { pick = t; return true; } return false; });
      if (!pick && po.ashi && po.ashi.ok && dist[id] === 0 && D.REGIONS[id].koku >= 30 && S.res.gold > 260 + autoReserve() && S.res.food > 300) pick = 'ashi';
      if (pick && produce(id, pick).ok) { list.push(pick); if (pick === 'ironclad') ships++; }
    });
    return list;
  }
  function autoRun() { // 季節の変わり目に一度
    var A = S.auto; if (!A || (S.over && !S.flags.cont)) return;
    var men = A.guard ? autoGuard() : 0, b = autoBuild(), made = A.make ? autoMake() : [], moved = A.move ? autoMove() : 0, parts = [];
    if (b.n) { var cnt = {}; b.list.forEach(function (x) { var nm = x.name.split(' → ').pop(); cnt[nm] = (cnt[nm] || 0) + 1; }); parts.push('建設 ' + Object.keys(cnt).map(function (k) { return k + (cnt[k] > 1 ? '×' + cnt[k] : ''); }).join('、')); }
    if (men) parts.push('徴兵 +' + (men / 1000) + '千');
    if (made.length) { var mc = {}; made.forEach(function (t) { var nm = D.UNIT_TYPES[t].short; mc[nm] = (mc[nm] || 0) + 1; }); parts.push('編成 ' + Object.keys(mc).map(function (k) { return k + (mc[k] > 1 ? '×' + mc[k] : ''); }).join('、')); }
    if (moved) parts.push('前線へ ' + moved + '部隊');
    if (parts.length) ev('auto', 'おまかせ:' + parts.join(' / ') + '。', { auto: true });
  }
  // 地球を統一したあとも、治めつづける
  function keepGoing() { if (!S.over || !S.over.win) return { error: 'まだ決着がついていません' }; S.flags.cont = S.turn; mark('event', '統一のあとも、国の営みは続く。'); return { ok: true }; }
  function setAuto(o) { // 方針を変える。知らないキーは捨てる
    var A = S.auto;
    if (o.build != null && ['off', 'scarce', 'res', 'study'].indexOf(o.build) >= 0) A.build = o.build;
    if (o.res != null && ['gold', 'food', 'steel', 'fuel', 'ammo'].indexOf(o.res) >= 0) A.res = o.res;
    ['move', 'guard', 'make'].forEach(function (k) { if (o[k] != null) A[k] = !!o[k]; });
    return A;
  }

  // ───────────────────────── 参謀の助言 ─────────────────────────
  function nearestOil() {
    var mine = playerRegions(), seen = {}, q = [], best = null;
    mine.forEach(function (id) { seen[id] = 0; q.push(id); });
    while (q.length) {
      var cur = q.shift();
      if (!isP(cur) && D.REGIONS[cur].res.oil) { best = cur; break; }
      links(cur).forEach(function (l) { if (seen[l.id] == null) { seen[l.id] = seen[cur] + 1; q.push(l.id); } });
    }
    return best ? { id: best, hops: seen[best] } : null;
  }
  function hints() {
    var out = [], mine = playerRegions(), inc = income();
    function h(bird, text, rid, pri) { out.push({ bird: bird, text: text, rid: rid || null, pri: pri || 5 }); }
    if (S.flags.asi != null) { h('dario', '何もなさらなくて大丈夫です。境を接する国々は、季節ごとに、自分から調和圏に加わります。', null, 1); return out; }
    var warned = {};
    S.threats.forEach(function (t) {
      if (warned[t.to]) return; warned[t.to] = 1;
      var on = threatOn(t.to);
      h('gin', rname(t.to) + 'が' + (on.joint ? '複数の敵に、示し合わせて' : fname(t.f) + 'に') + '狙われています' + (on.joint ? '(合わせた戦力 約' + Math.round(on.power) + '、守りは ' + Math.round(defensePower(t.to)) + ')' : '') + '。守備隊を増やすか、部隊を置いてください。', t.to, 1);
    });
    if (mine.length === 1 && S.turn < 4) {
      var first = links(mine[0]).filter(function (l) { return !isP(l.id) && !l.sea; }).sort(function (x, y) { return enemyPower(x.id) - enemyPower(y.id); })[0];
      if (first) h('dario', 'まずは足場を。隣の' + rname(first.id) + 'をタップして「攻撃」。編成は私の「おすすめ」のままで決行できます。', first.id, 1);
    }
    var idle = idleBirds();
    if (idle.length && autoTechLeft()) h('haku', '手の空いている者がいます(' + idle.map(function (b) { return BIRD_BY_ID[b].name; }).join('、') + ')。研究を割り振ってください。', null, 2);
    else if (idle.length && manualAvail().length && S.flags.asi == null) h('haku', '残る研究は「' + manualAvail().map(function (t) { return TECH_BY_ID[t].name; }).join('」「') + '」です。これを進めるかどうかは、司令がご自分でお決めください。', null, 6);
    if (S.flags.asi == null) {
      var pols = policyOptions().filter(function (p) { return p.ok; });
      if (pols.length) h(pols[0].bird, '施策「' + pols[0].name + '」を布告できます(' + pols[0].sum + ')。「国勢」の「施策」から。', null, 4);
      var low = mine.filter(function (id) { return S.regions[id].mood < 25; });
      if (low.length && !polAny('noRevolt')) h('cinnamon', rname(low[0]) + (low.length > 1 ? 'など' + low.length + 'か所' : '') + 'で民の心が離れています。一揆のおそれがあります。施策で暮らしを立て直しましょう。', low[0], 3);
    }
    if (S.units.some(function (u) { return D.UNIT_TYPES[u.type].nuke; }) && !S.stats.nukes) h('dario', '核は、撃たないために持つものです。持っているだけで、降伏勧告は通りやすくなっています。……撃たないでください。', null, 6);
    var oilOwned = mine.filter(function (id) { return D.REGIONS[id].res.oil; });
    var wells = mine.filter(function (id) { return S.regions[id].fac.oilwell; });
    if (!tech('distill')) {
      if (!D.BIRDS.some(function (b) { return S.assign[b.id] === 'distill'; })) h('sakura', '石油蒸留の研究がまだです! 油井を建てるには、まずこれが必要です。', null, 2);
    } else {
      oilOwned.forEach(function (id) { var r = S.regions[id]; if (!r.fac.oilwell && !(r.b && r.b.k === 'oilwell')) h('kozakura', rname(id) + 'に油井を建てられます。燃料が毎ターン入るようになります。', id, 2); });
    }
    if (!wells.length && !oilOwned.length) {
      var no = nearestOil();
      if (no) h('kozakura', 'いちばん近い石油は' + rname(no.id) + '(' + fname(owner(no.id)) + ')です。' + (no.hops > 1 ? 'あと' + no.hops + '地域先。' : '隣です。'), no.id, 3);
    }
    if (S.res.fuel < 150 && inc.net.fuel <= 0) h('sakura', '燃料が残りわずかです。戦車と艦は温存して、普通科と現地の兵で戦いましょう。', null, 2);
    if (S.res.ammo < 150 && inc.net.ammo <= 0) h('gin', '弾薬が乏しい。「無煙火薬」の研究と工廠の建設を。それまでは降伏勧告と現地歩兵団で。', null, 2);
    if (S.res.food < 120 && inc.net.food < 0) h('cinnamon', '兵糧が足りません。石高の多い国を取るか、農地改良を。', null, 2);
    mine.forEach(function (id) {
      var r = S.regions[id], d = D.REGIONS[id];
      if (r.b) return;
      if (d.res.gold >= 5 && !r.fac.mine) h('kozakura', rname(id) + 'の金銀山がまだ手つかずです。', id, 4);
      if (d.res.iron && !r.fac.ironmine) h('haku', rname(id) + 'に鉄山を開けます。鉄鋼は工廠と兵器の元です。', id, 4);
      if (d.res.coal && !r.fac.coalmine && tech('survey')) h('haku', rname(id) + 'に炭鉱を開けます。製鉄がはかどります。', id, 4);
    });
    if (tech('steam') && !mine.some(function (id) { return S.regions[id].fac.arsenal || (S.regions[id].b && S.regions[id].b.k === 'arsenal'); })) h('okame', '工廠を建てられます。部隊と弾薬を自分たちで作れるようになります…。', null, 3);
    if (mine.length >= 4 && S.auto.build === 'off' && !S.auto.move && S.turn < 40) h('dario', '建設や部隊の移動を一つずつ指示するのが手間なら、「国勢」の「方針」で、私と鳥たちにまかせられます。', null, 5);
    if (S.turn < 3 && S.dipLeft > 0) h('dario', '撃たずに済むなら、それが最善です。隣り合う小さな勢力には「降伏勧告」を。成功率は外交の画面に出しています。', null, 4);
    if (!darioOn()) h('dario', '……省電力モードです。発電機の燃料が尽きました。計算支援は休止しています。', null, 2);
    if (S.flags.unified != null && !S.flags.coalition && mine.filter(function (id) { return D.REGIONS[id].map === 'w'; }).length === 0) h('kozakura', '海の向こうへ。琉球・朝鮮・樺太へは、艦隊の輸送力があれば渡れます。樺太には油田があります。', 'karafuto', 3);
    out.sort(function (a, b) { return a.pri - b.pri; });
    return out;
  }

  function summary() {
    var jp = 0, jpAll = 0, w = 0, wAll = 0;
    Object.keys(D.REGIONS).forEach(function (id) {
      if (D.REGIONS[id].map === 'jp') { jpAll++; if (isP(id)) jp++; } else { wAll++; if (isP(id)) w++; }
    });
    return { jp: jp, jpAll: jpAll, w: w, wAll: wAll };
  }
  // 国のいま(表紙・国勢・年代記が読む)
  function world() {
    var s = summary();
    return { nation: nationStage(), era: eraStage(), mood: Math.round(moodAvg()), jp: s.jp, jpAll: s.jpAll, w: s.w, wAll: s.wAll,
      asi: S.flags.asi != null, nukes: S.stats.nukes || 0, policies: D.POLICIES.filter(function (p) { return polHas(p.id); }).map(function (p) { return p.id; }) };
  }

  var Engine = {
    init: init, newGame: newGame, serialize: serialize, load: load,
    get S() { return S; },
    tech: tech, season: season, year: year, dateLabel: dateLabel, isP: isP, owner: owner, links: links, playerRegions: playerRegions,
    factionRegions: factionRegions, distKm: distKm, infTier: infTier, ustat: ustat, unitById: unitById, unitsAt: unitsAt, poolUnits: poolUnits,
    dipMax: dipMax, moveRange: moveRange, hasSite: hasSite, regionYield: regionYield, income: income, foodCap: foodCap,
    threatOn: threatOn, techStatus: techStatus, techLockReason: techLockReason, darioOn: darioOn, darioRp: darioRp, birdRp: birdRp, techRp: techRp, assign: assign, autoAssign: autoAssign, idleBirds: idleBirds,
    enemyPower: enemyPower, defensePower: defensePower, attackOptions: attackOptions, predictAttack: predictAttack, suggestAttack: suggestAttack, attack: attack,
    moveTargets: moveTargets, move: move, buildOptions: buildOptions, build: build, garrisonCap: garrisonCap, garrisonCost: garrisonCost, recruit: recruit,
    produceOptions: produceOptions, produce: produce, ashiCap: ashiCap, ashiCount: ashiCount, unitCost: unitCost, submitChance: submitChance, pactChance: pactChance, diploOptions: diploOptions, diplo: diplo,
    inContact: inContact, isJp: isJp, playerPower: playerPower, factionPower: factionPower,
    endTurn: endTurn, hints: hints, summary: summary, fname: fname, rname: rname, lockedOverseas: lockedOverseas, MEN: MEN,
    facK: facK, facMax: facMax, lvText: lvText,
    census: census, vitals: vitals, popInit: popInit, keepGoing: keepGoing,
    buildTurns: buildTurns, schoolName: schoolName, facLabel: facLabel, rushCost: rushCost, rush: rush,
    setAuto: setAuto, autoBuild: autoBuild, autoMove: autoMove, autoGuard: autoGuard, autoMake: autoMake, autoNeeds: autoNeeds, autoReserve: autoReserve, frontDist: frontDist,
    isSpec: isSpec, researchMult: researchMult, autoTechLeft: autoTechLeft, manualAvail: manualAvail, allTechDone: allTechDone, prodTurns: prodTurns,
    moodTarget: moodTarget, moodAvg: moodAvg, moodFactor: moodFactor, polHas: polHas, policyOptions: policyOptions, enact: enact,
    nationStage: nationStage, nation: nation, eraStage: eraStage, voice: voice, voices: voices, world: world,
    TECH_BY_ID: TECH_BY_ID, BIRD_BY_ID: BIRD_BY_ID, POLICY_BY_ID: POLICY_BY_ID
  };
  TF.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
