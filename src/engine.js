/* 天下布鳥 — ゲームエンジン(規則と状態)。DOM には触れない。Node でもそのまま動く。 */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};
  var D = TF.DATA || (typeof require !== 'undefined' ? require('./data.js') : null);
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
    'tank', 'aluminium', 'aircraft', 'turbine', 'electronics', 'catcrack', 'jet', 'modern'];

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
      threats: [], dipLeft: 2, log: [], flags: {}, seenHints: {},
      stats: { battles: 0, wins: 0, losses: 0, submits: 0, fuelUsed: 0, ammoUsed: 0, conquered: 0 },
      over: null
    };
    Object.keys(D.REGIONS).forEach(function (id) {
      var d = D.REGIONS[id], g = d.fac === 'player' ? 0 : r100(d.troops * diff.enemy);
      S.regions[id] = { o: d.fac, g: g, gmax: g, fort: d.fort, ctl: 100, fac: {}, b: null, p: null };
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
  function atkMult() { return 1 + (tech('radio') ? 0.1 : 0) + (tech('electronics') ? 0.15 : 0); }
  function ustat(u) {
    var T = D.UNIT_TYPES[u.type];
    var o = { atk: T.atk, def: T.def, siege: T.siege, fuel: T.fuel, ammo: T.ammo, mv: T.mv || 0, name: T.name, cls: T.cls, foot: !!T.foot, transport: T.transport || 0, range: T.range || 0, vuln: T.vuln || 1 };
    if (T.tiered) {
      var tr = D.INF_TIERS[infTier()];
      o.atk = T.atk * tr.mult; o.def = T.def * tr.mult; o.fuel = tr.fuel; o.ammo = tr.ammo; o.name = tr.name; o.mv = tr.fuel ? 1 : 0;
    }
    o.atk = Math.round(o.atk * atkMult()); o.def = Math.round(o.def);
    return o;
  }
  function unitById(id) { for (var i = 0; i < S.units.length; i++) if (S.units[i].id === id) return S.units[i]; return null; }
  function unitsAt(rid) { return S.units.filter(function (u) { return u.loc === rid; }); }
  function poolUnits() { return S.units.filter(function (u) { return u.loc === null; }); }
  function diff() { return D.DIFFICULTY[S.diff]; }
  function fq(fid) { var f = S.factions[fid]; return (f ? f.q : 1) * diff().enemy; }
  function dipMax() { return 2 + (tech('telegraph') ? 1 : 0) + (tech('radio') ? 1 : 0); }
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
    var geo = tech('geophys') ? 1.2 : 1;
    y.gold = d.koku * 0.45 * c * (r.fac.market ? 1.5 : 1) * (tech('rail') ? 1.15 : 1) + d.port * c;
    if (r.fac.mine) y.gold += (d.res.gold || 0) * 4 * (tech('survey') ? 1.5 : 1) * geo;
    y.food = d.koku * 1.0 * c * (r.fac.farm ? 1.5 : 1) * (1 + (tech('agri') ? 0.4 : 0) + (tech('fertilizer') ? 0.6 : 0));
    y.steel = d.koku * 0.03 * c;
    if (r.fac.ironmine) y.steel += (d.res.iron || 0) * 4 * (tech('blast') ? 3 : 1) * (tech('bessemer') ? 2 : 1) * (1 + 0.5 * cm) * geo;
    if (r.fac.oilwell) y.fuel = (d.res.oil || 0) * 5 * (tech('drill') ? 1.5 : 1) * (tech('cracking') ? 1.6 : 1) * (tech('catcrack') ? 1.3 : 1) * geo;
    if (r.fac.arsenal && tech('ammo')) y.ammo = 15 * (tech('fertilizer') ? 1.5 : 1) * (tech('electric') ? 1.5 : 1);
    if (r.fac.school) y.rp = 3;
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
    up.fuel = jsdfAlive ? 4 : 0;                 // 基地の発電・整備ぶん
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
  function darioRp() { return !darioOn() ? 0 : (tech('electronics') ? 30 : (tech('electric') ? 16 : 8)); }
  function birdRp(bid) {
    var b = BIRD_BY_ID[bid], tid = S.assign[bid];
    if (!tid) return 0;
    var mult = 1 + (tech('electric') ? 0.25 : 0) + (tech('electronics') ? 0.25 : 0);
    var active = D.BIRDS.filter(function (x) { return S.assign[x.id]; }).length || 1;
    var school = (income().rp + darioRp()) / active;
    return (6 * (TECH_BY_ID[tid].field === b.field ? 1.6 : 1) + school) * mult;
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
      var own = avail.filter(function (t) { return TECH_BY_ID[t].field === b.field; });
      S.assign[b.id] = own.length ? own[0] : avail[0];
    });
  }
  function idleBirds() { return D.BIRDS.filter(function (b) { return !S.assign[b.id]; }).map(function (b) { return b.id; }); }
  function allTechDone() { return D.TECHS.every(function (t) { return S.techs[t.id]; }); }

  // ───────────────────────── 戦力の計算 ─────────────────────────
  function enemyPower(rid, fortEff) {
    var r = S.regions[rid], d = D.REGIONS[rid];
    if (fortEff == null) fortEff = r.fort;
    return r.g / MEN * fq(r.o) * (1 + 0.3 * fortEff) * (d.mtn ? 1.15 : 1);
  }
  function defensePower(rid) {
    var r = S.regions[rid], d = D.REGIONS[rid];
    var p = r.g / MEN * D.INF_TIERS[infTier()].mult * (1 + 0.3 * r.fort) * (d.mtn ? 1.15 : 1);
    unitsAt(rid).forEach(function (u) { p += ustat(u).def * u.hp / 100; });
    return p;
  }
  function airfieldInRange(tid, range) {
    return playerRegions().some(function (id) { return S.regions[id].fac.airfield && distKm(id, tid) <= range; });
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
    return { P: Math.round(P), E: Math.round(E), fort: r.fort, fortEff: fortEff, siege: siege, fuel: fuel, ammo: ammo, chance: chance, ratio: ratio,
      canCapture: ground > 0, problems: problems, parts: parts, winter: winter, onFoot: onFoot, lossPct: lossPct, seaGround: seaGround, cap: cap, sel: sel };
  }

  // 「おすすめ」編成:勝算が minChance に届くまで、費用対効果のよい部隊から順に足していく
  function suggestAttack(tid, minChance) {
    var opts = attackOptions(tid), pool = opts.filter(function (o) { return o.ok; });
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
  function fname(fid) { return fid === 'player' ? '我が軍' : D.FACTIONS[fid].name; }
  function rname(rid) { return D.REGIONS[rid].name; }

  // ───────────────────────── 占領と勢力の滅亡 ─────────────────────────
  function takeRegion(rid, how, events) {
    var r = S.regions[rid], prev = r.o, f = S.factions[prev];
    r.o = 'player'; r.b = null; r.p = null;
    r.g = r100(r.g * (how === 'submit' ? 0.8 : (how === 'defect' ? 0.6 : 0.25)));
    r.ctl = how === 'submit' ? 65 : (how === 'defect' ? 55 : 35);
    r.gmax = Math.max(r.gmax, 0);
    S.threats = S.threats.filter(function (t) { return t.from !== rid && t.to !== rid; });
    if (f) f.lost++;
    if (rid === 'yamashiro' && !S.flags.kyoto) {
      S.flags.kyoto = S.turn; S.prestige += 10;
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
      S.prestige += 1;
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
      if (!still.length) { f.alive = false; f.war = false; f.trade = false; events.push(ev('good', fname(fid) + 'は滅亡した。', { fid: fid })); S.prestige += 1; }
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
      S.flags.unified = S.turn; S.prestige += 15;
      Object.keys(S.factions).forEach(function (fid) { S.factions[fid].pride = Math.max(10, S.factions[fid].pride - 5); });
      events.push(ev('event', '天下統一! 日本は一つになった。', { big: { title: '天下統一', body: '蝦夷から薩摩まで、すべての国が一つの旗の下に入った。元号は「天鳥」と改められた。鳥たちはすでに、世界地図を広げている。——次は、海の向こうだ。', bird: 'gin', fanfare: true } }));
    }
    var wOwned = w.filter(isP).length;
    if (!S.flags.coalition && wOwned >= 18) {
      S.flags.coalition = S.turn;
      Object.keys(S.factions).forEach(function (fid) {
        var f = S.factions[fid]; if (!f.alive) return;
        var regs = factionRegions(fid); if (!regs.length || D.REGIONS[regs[0]].map !== 'w') return;
        f.war = true; f.pact = 0; f.trade = false; f.q = Math.round((f.q + 0.15) * 100) / 100;
      });
      events.push(ev('event', '残る世界の国々が「対日大同盟」を結んだ。', { big: { title: '対日大同盟', body: 'マドリード、コンスタンティノープル、アーグラ。昨日までの敵どうしが手を結んだ。残るすべての国が我が国に宣戦し、兵の質を高めている。', bird: 'gin' } }));
    }
    if (!S.over && jp.every(isP) && w.every(isP)) {
      S.over = { win: true, turn: S.turn };
      events.push(ev('event', '地球は、日本になった。', { big: { title: '地球統一', body: '最後の旗が降ろされた。' + dateLabel().text + '、地球上のすべての土地が日本になった。鳥たちは満足げに羽づくろいをしている。', bird: 'haku', fanfare: true } }));
    }
    if (!S.over && !playerRegions().length) {
      S.over = { win: false, turn: S.turn };
      events.push(ev('event', 'すべての拠点を失った。', { big: { title: '敗北', body: '統合任務部隊は最後の拠点を失った。鳥たちは空へ逃れたという。', bird: 'okame' } }));
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
      var st = ustat(o.u), dh = Math.round(lossBase * st.vuln * (0.7 + rnd() * 0.6));
      if (st.atk === 0) dh = 0;
      o.u.hp = Math.max(0, o.u.hp - dh); o.u.acted = true;
      losses.push({ id: o.u.id, name: o.u.name, type: o.u.type, dh: dh, dead: o.u.hp <= 0 });
    });
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
      gBefore: gBefore, gAfter: S.regions[tid].g, joined: joined, fortEff: pr.fortEff, fort: pr.fort, siege: pr.siege, fid: fid, rid: tid, events: events, winter: pr.winter };
    return res;
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
      us.forEach(function (u) { var st = ustat(u); fuel += (tech('rail') ? 0 : st.mv * dd.hops) + (dd.sea && !freeSea ? 6 * dd.sea : 0); });
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
    playerRegions().forEach(function (id) { var r = S.regions[id]; if (r.fac.school) n++; if (r.b && r.b.k === 'school') n++; });
    return n;
  }
  function facCost(rid, key) {
    var F = D.FACILITIES[key], c = { gold: F.cost.gold || 0, steel: F.cost.steel || 0 };
    if (key === 'school') c.gold += 30 * Math.max(0, schoolCount() - 1);
    if (key === 'fort') c.gold = 70 * (S.regions[rid].fort + 1);
    return c;
  }
  function buildOptions(rid) {
    var r = S.regions[rid], d = D.REGIONS[rid], out = [];
    Object.keys(D.FACILITIES).forEach(function (key) {
      var F = D.FACILITIES[key], o = { key: key, name: F.name, effect: F.effect, turns: F.turns, cost: facCost(rid, key), ok: true, why: '', built: false, show: true };
      if (F.site && !(d.res[F.site] > 0)) { o.show = false; return; }
      if (F.coast && !d.coast) { o.show = false; return; }
      if (F.site) o.amount = d.res[F.site];
      if (key === 'fort') { if (r.fort >= 5) { o.built = true; o.ok = false; o.why = '最大'; } }
      else if (r.fac[key]) { o.built = true; o.ok = false; o.why = '建設済み'; }
      if (!o.built) {
        if (r.b && r.b.k === key) { o.ok = false; o.why = '建設中(あと' + r.b.t + 'ターン)'; o.building = true; }
        else if (r.b) { o.ok = false; o.why = '別の建設が進行中'; }
        else if (F.tech && !tech(F.tech)) { o.ok = false; o.why = '「' + TECH_BY_ID[F.tech].name + '」の研究が必要'; o.locked = true; }
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
      var o = { type: type, name: T.tiered ? D.INF_TIERS[infTier()].name + '(現地歩兵団)' : T.name, cost: cost, turns: T.turns, ok: true, why: '', desc: T.desc, show: true };
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
    S.regions[rid].p = { type: type, t: T.turns };
    return { ok: true };
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
    var ratio = playerPower() / Math.max(1, factionPower(fid));
    var c = 4 + 16 * Math.log(Math.max(0.05, ratio)) / Math.LN2;
    c += S.prestige * 0.2 + f.att * 0.25 - f.pride * 0.8 + f.lost * 12 + (f.awe > 0 ? 15 : 0);
    c += inContact(fid) ? 8 : -40;
    if (S.flags.kyoto != null && isJp(fid)) c += 10;
    if (f.war) c -= 8;
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
        res.ok = true; res.regions = regs;
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

  function resolveThreat(t) {
    var from = S.regions[t.from], to = S.regions[t.to], f = S.factions[t.f];
    if (!f || !f.alive || !f.war || from.o !== t.f || to.o !== 'player') return;
    var attackers = r100(from.g * 0.7); if (attackers <= 0) return;
    var A = attackers / MEN * fq(t.f) * (t.sea ? 0.7 : 1) * (0.9 + rnd() * 0.2);
    // 守る自衛隊は弾を使う
    var here = unitsAt(t.to), ammoNeed = 0;
    here.forEach(function (u) { ammoNeed += Math.ceil(ustat(u).ammo * 0.5); });
    var Dp = defensePower(t.to);
    if (ammoNeed > S.res.ammo) { var up = 0; here.forEach(function (u) { up += ustat(u).def * u.hp / 100; }); Dp -= up * 0.6; ammoNeed = S.res.ammo; }
    S.res.ammo -= ammoNeed; S.stats.ammoUsed += ammoNeed;
    if (A > Dp) {
      to.o = t.f; to.g = r100(attackers * 0.6); from.g = Math.max(0, from.g - attackers); to.b = null; to.p = null;
      var esc = links(t.to).filter(function (l) { return isP(l.id) && !l.sea; })[0] || links(t.to).filter(function (l) { return isP(l.id); })[0];
      var lost = [];
      here.forEach(function (u) { if (esc) { u.loc = esc.id; u.hp = Math.max(1, u.hp - 20); } else { u.hp = 0; lost.push(u.name); } });
      S.units = S.units.filter(function (u) { return u.hp > 0; });
      S.prestige = Math.max(0, S.prestige - 3);
      ev('bad', fname(t.f) + 'に' + rname(t.to) + 'を奪われた。' + (lost.length ? lost.join('・') + 'が壊滅した。' : (here.length ? '部隊は' + rname(esc.id) + 'へ退いた。' : '')), { rid: t.to, fid: t.f });
    } else {
      var k = clamp(0.3 + 0.3 * (Dp / Math.max(1, A)), 0.3, 0.9);
      from.g = Math.max(0, r100(from.g - attackers * k));
      to.g = r100(to.g * (1 - clamp(0.25 * A / Math.max(1, Dp), 0.02, 0.3)));
      here.forEach(function (u) { u.hp = Math.max(1, u.hp - Math.min(12, Math.round(6 * A / Math.max(1, Dp)))); });
      ev('good', rname(t.to) + 'に攻め寄せた' + fname(t.f) + 'の軍勢を退けた。', { rid: t.to, fid: t.f });
    }
  }
  function planThreats() {
    Object.keys(S.factions).forEach(function (fid) {
      var f = S.factions[fid]; if (!f.alive || !f.war || f.pact > 0) return;
      factionRegions(fid).forEach(function (rid) {
        if (S.threats.some(function (t) { return t.from === rid; })) return;
        var from = S.regions[rid], best = null;
        links(rid).forEach(function (l) {
          if (!isP(l.id)) return;
          if (l.sea && D.REGIONS[rid].map !== D.REGIONS[l.id].map) return; // 敵は外洋を渡ってこない
          var A = from.g * 0.7 / MEN * fq(fid) * (l.sea ? 0.7 : 1), Dp = defensePower(l.id);
          if (A >= Dp * 1.2 && (!best || Dp < best.Dp)) best = { id: l.id, Dp: Dp, sea: l.sea };
        });
        if (best && rnd() < 0.4) {
          S.threats.push({ from: rid, to: best.id, f: fid, turn: S.turn + 1, sea: best.sea });
          ev('warn', fname(fid) + 'が' + rname(rid) + 'から' + rname(best.id) + 'をうかがっている。次の季節に攻めてくる。', { rid: best.id, fid: fid });
        }
      });
    });
  }
  function aiDeclare() {
    Object.keys(S.factions).forEach(function (fid) {
      var f = S.factions[fid], df = D.FACTIONS[fid];
      if (!f.alive || f.war || f.pact > 0 || f.awe > 0 || f.att >= 30 || !inContact(fid)) return;
      var p = df.aggr * 0.06 + (f.att < -20 ? 0.04 : 0);
      if (rnd() < p) { f.war = true; f.trade = false; ev('warn', fname(fid) + '(' + f.leader + ')が我が軍に兵を向けた。', { fid: fid }); }
    });
  }

  function endTurn() {
    if (S.over) return { events: [] };
    REPORT = [];
    var inc = income(), n = inc.net;
    // 1. 収支
    S.res.gold += n.gold; S.res.food += n.food; S.res.steel += n.steel; S.res.fuel += n.fuel; S.res.ammo += n.ammo;
    var cap = foodCap();
    if (S.res.food > cap) { var sold = Math.floor((S.res.food - cap) / 6); S.res.gold += sold; S.res.food = cap; if (sold >= 5) ev('info', '余った兵糧を売り、資金 ' + sold + ' を得た。'); }
    if (S.res.food < 0) {
      S.res.food = 0;
      playerRegions().forEach(function (id) { S.regions[id].g = r100(S.regions[id].g * 0.9); });
      S.units.forEach(function (u) { u.hp = Math.max(5, u.hp - 5); });
      ev('bad', '兵糧が尽きた。兵が逃げ、部隊が弱っている。');
    }
    if (S.res.gold < 0) { S.res.gold = 0; playerRegions().forEach(function (id) { S.regions[id].ctl = Math.max(10, S.regions[id].ctl - 5); }); ev('bad', '資金が尽きた。俸給が払えず、統治が乱れている。'); }
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
        S.prestige += 1;
        ev('tech', '「' + t.name + '」の研究が完了した。', { tech: tid, bird: lead.id });
        D.BIRDS.forEach(function (b) { if (S.assign[b.id] === tid) S.assign[b.id] = null; });
      }
    });
    if (S.autoResearch) autoAssign();
    else D.BIRDS.forEach(function (b) { var c = S.assign[b.id]; if (c && techStatus(c) !== 'avail') S.assign[b.id] = null; });
    // 3. 建設・編成・統治・整備
    playerRegions().forEach(function (id) {
      var r = S.regions[id];
      if (r.b) { r.b.t--; if (r.b.t <= 0) { if (r.b.k === 'fort') r.fort = Math.min(5, r.fort + 1); else r.fac[r.b.k] = 1; ev('build', rname(id) + 'に' + D.FACILITIES[r.b.k].name + 'が完成した。', { rid: id }); r.b = null; } }
      if (r.p) { r.p.t--; if (r.p.t <= 0) { var u = addUnit(r.p.type, null, id); u.acted = false; ev('build', rname(id) + 'で' + u.name + 'の編成が完了した。', { rid: id }); r.p = null; } }
      if (r.ctl < 100) r.ctl = Math.min(100, r.ctl + (4 + (tech('telegraph') ? 2 : 0)) * (tech('hygiene') ? 2 : 1));
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
    due.forEach(resolveThreat);
    runHistory();
    aiDeclare();
    planThreats();
    Object.keys(S.regions).forEach(function (id) {
      var r = S.regions[id]; if (r.o === 'player') return;
      r.gmax = Math.round(r.gmax * 1.002);
      if (r.g < r.gmax) r.g = Math.min(r.gmax, r100(r.g + r.gmax * 0.06));
    });
    Object.keys(S.factions).forEach(function (fid) {
      var f = S.factions[fid]; if (!f.alive) return;
      if (f.pact > 0) { f.pact--; if (f.pact === 0) ev('info', fname(fid) + 'との不可侵の期限が切れた。', { fid: fid }); }
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
    var warned = {};
    S.threats.forEach(function (t) {
      if (warned[t.to]) return; warned[t.to] = 1;
      h('gin', rname(t.to) + 'が' + fname(t.f) + 'に狙われています。守備隊を増やすか、部隊を置いてください。', t.to, 1);
    });
    if (mine.length === 1 && S.turn < 4) {
      var first = links(mine[0]).filter(function (l) { return !isP(l.id) && !l.sea; }).sort(function (x, y) { return enemyPower(x.id) - enemyPower(y.id); })[0];
      if (first) h('dario', 'まずは足場を。隣の' + rname(first.id) + 'をタップして「攻撃」。編成は私の「おすすめ」のままで決行できます。', first.id, 1);
    }
    var idle = idleBirds();
    if (idle.length && !allTechDone()) h('haku', '手の空いている者がいます(' + idle.map(function (b) { return BIRD_BY_ID[b].name; }).join('、') + ')。研究を割り振ってください。', null, 2);
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

  var Engine = {
    init: init, newGame: newGame, serialize: serialize, load: load,
    get S() { return S; },
    tech: tech, season: season, year: year, dateLabel: dateLabel, isP: isP, owner: owner, links: links, playerRegions: playerRegions,
    factionRegions: factionRegions, distKm: distKm, infTier: infTier, ustat: ustat, unitById: unitById, unitsAt: unitsAt, poolUnits: poolUnits,
    dipMax: dipMax, moveRange: moveRange, hasSite: hasSite, regionYield: regionYield, income: income, foodCap: foodCap,
    techStatus: techStatus, techLockReason: techLockReason, darioOn: darioOn, darioRp: darioRp, birdRp: birdRp, techRp: techRp, assign: assign, autoAssign: autoAssign, idleBirds: idleBirds,
    enemyPower: enemyPower, defensePower: defensePower, attackOptions: attackOptions, predictAttack: predictAttack, suggestAttack: suggestAttack, attack: attack,
    moveTargets: moveTargets, move: move, buildOptions: buildOptions, build: build, garrisonCap: garrisonCap, garrisonCost: garrisonCost, recruit: recruit,
    produceOptions: produceOptions, produce: produce, ashiCap: ashiCap, ashiCount: ashiCount, unitCost: unitCost, submitChance: submitChance, pactChance: pactChance, diploOptions: diploOptions, diplo: diplo,
    inContact: inContact, isJp: isJp, playerPower: playerPower, factionPower: factionPower,
    endTurn: endTurn, hints: hints, summary: summary, fname: fname, rname: rname, lockedOverseas: lockedOverseas, MEN: MEN,
    TECH_BY_ID: TECH_BY_ID, BIRD_BY_ID: BIRD_BY_ID
  };
  TF.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
