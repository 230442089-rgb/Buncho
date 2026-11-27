/* 天下布鳥 — 画面。エンジン(TF.Engine)の状態を描き、操作を受けてエンジンを呼ぶ。 */
(function () {
  'use strict';
  var TF = window.TF, D = TF.DATA, E = TF.Engine, MAP = window.MAPDATA, icon = TF.icon, birdSVG = TF.birdSVG;
  var SAVE_KEY = 'tenkafucho.save.v1';
  var SITE_COLOR = { oil: '#f5a742', coal: '#aab3c6', iron: '#d98a68', gold: '#f2d568', bauxite: '#dba3e6' };
  var RES = [['gold', '資金'], ['food', '兵糧'], ['steel', '鉄鋼'], ['fuel', '燃料'], ['ammo', '弾薬']];
  var ui = { map: 'japan', sel: null, sub: null, panel: null, pick: {}, mv: null, atk: null, view: { japan: null, world: null }, u: 1, queue: [], modal: null, diploTab: 'near' };
  var TECH = E.TECH_BY_ID, BIRD = E.BIRD_BY_ID;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.round(n).toLocaleString('ja-JP'); }
  // 上の帯に収まるよう、1万以上は「2.9万」のように詰める
  function compact(n) { n = Math.round(n); var a = Math.abs(n); if (a < 10000) return n.toLocaleString('ja-JP'); return (n / 10000).toFixed(a < 100000 ? 1 : 0) + '万'; }
  function csgn(n) { n = Math.round(n); return (n > 0 ? '+' : (n < 0 ? '−' : '±')) + compact(Math.abs(n)); }
  function sgn(n) { n = Math.round(n); return (n > 0 ? '+' : (n < 0 ? '−' : '±')) + Math.abs(n).toLocaleString('ja-JP'); }
  function men(n) { return n >= 10000 ? (Math.round(n / 1000) / 10) + '万' : (n >= 1000 ? (Math.round(n / 100) / 10) + '千' : String(n)); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function S() { return E.S; }
  function reg(id) { return D.REGIONS[id]; }
  function short(id) { return reg(id).name.split('・')[0]; }
  function mapOf(id) { return reg(id).map === 'jp' ? 'japan' : 'world'; }
  function geo(id) { return MAP[mapOf(id)].regions[id]; }
  function asiOn() { var st = E.S; return !!(st && st.flags.asi != null); }
  function pColor() { return asiOn() ? '#e9eef6' : D.PLAYER_COLOR; }
  function colorOf(id) { var o = E.owner(id); return o === 'player' ? pColor() : D.FACTIONS[o].color; }
  function syncLook() { var a = asiOn() && $('#title').hidden; TF.asiLook = a; document.body.classList.toggle('asi', a); }
  function moodCls(m) { return m < 25 ? 'bad' : (m < 45 ? 'warn' : 'good'); }
  function moodBar(m, tg) { return '<div class="bar mood ' + moodCls(m) + '"><i style="width:' + clamp(m, 0, 100) + '%"></i>' + (tg != null ? '<u style="left:' + clamp(tg, 0, 100) + '%"></u>' : '') + '</div>'; }
  function pips(n, max) { var s = '<span class="pips">'; for (var i = 0; i < max; i++) s += '<i' + (i < n ? ' class="on"' : '') + '></i>'; return s + '</span>'; }
  function costHTML(c) {
    var s = '<span class="cost">';
    [['gold', 'gold'], ['steel', 'steel'], ['food', 'food'], ['fuel', 'fuel'], ['ammo', 'ammo']].forEach(function (k) {
      if (c[k[0]]) s += '<span' + (c[k[0]] > S().res[k[0]] ? ' class="short"' : '') + '>' + icon(k[1]) + fmt(c[k[0]]) + '</span>';
    });
    return s + '</span>';
  }
  function hpBar(hp) { return '<div class="bar hp' + (hp < 35 ? ' low' : (hp < 70 ? ' mid' : '')) + '"><i style="width:' + hp + '%"></i></div>'; }
  function toast(t) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2700); }
  function oops(t) { sfx('deny'); toast(t); }

  // ───────────────────────── 音と演出の設定 ─────────────────────────
  var OPT_KEY = 'tenkafucho.opts.v1';
  var FUJI = { izu: 1, suruga: 1, kai: 1, sagami: 1 }; // 戦場から富士が見える国
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function sfx(n, o) { if (TF.sfx) TF.sfx.play(n, o); }
  function loadOpts() {
    var o = { sound: true, anim: true, ringer: true };
    try { var j = JSON.parse(localStorage.getItem(OPT_KEY) || '{}'); if (j.sound === false) o.sound = false; if (j.anim === false) o.anim = false; if (j.ringer === false) o.ringer = false; } catch (e) { /* 既定のまま */ }
    return o;
  }
  function saveOpts() { try { localStorage.setItem(OPT_KEY, JSON.stringify(ui.opts)); } catch (e) { /* 保存できない環境 */ } }
  ui.opts = loadOpts();
  if (TF.sfx) { TF.sfx.setEnabled(ui.opts.sound); TF.sfx.setBypass(ui.opts.ringer); }
  function animOn() { return ui.opts.anim && !reduce && TF.Battle3D && TF.Battle3D.available(); }

  // ───────────────────────── 演出 ─────────────────────────
  function tween(ms, fn, done) {
    var t0 = performance.now();
    function f(now) { var k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1) requestAnimationFrame(f); else if (done) done(); }
    requestAnimationFrame(f);
  }
  function svgEl(tag, attrs) { var el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) el.setAttribute(k, attrs[k]); return el; }
  function shake() { if (reduce) return; var st = $('#stage'); st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake'); }
  // 地図の上で「制圧」の判子を押す:白い閃光、広がる輪、朱の判子
  function fxConquer(rid, delay, word) {
    setTimeout(function () {
      var fx = $('#fx'); if (!fx || !S() || mapOf(rid) !== ui.map) return;
      var gr = geo(rid);
      sfx('stamp');
      if (reduce) return;
      shake();
      var fl = svgEl('path', { d: gr.d, fill: '#fff', 'pointer-events': 'none' }); fx.appendChild(fl);
      tween(650, function (k) { fl.setAttribute('opacity', ((1 - k) * 0.9).toFixed(3)); }, function () { fl.remove(); });
      var ring = svgEl('circle', { cx: gr.c[0], cy: gr.c[1], r: 1, fill: 'none', stroke: '#fff3c4', 'pointer-events': 'none' }); fx.appendChild(ring);
      tween(620, function (k) { ring.setAttribute('r', ((8 + 96 * k) * ui.u).toFixed(2)); ring.setAttribute('stroke-width', (4 * (1 - k) * ui.u + 0.01).toFixed(3)); }, function () { ring.remove(); });
      var g = svgEl('g', { 'pointer-events': 'none', 'class': 'fx-seal' }), wd = (word || '制圧').length * 22 + 14;
      g.appendChild(svgEl('rect', { x: -wd / 2, y: -17, width: wd, height: 34, rx: 6, fill: '#e2492d', stroke: '#fff', 'stroke-width': 2.5 }));
      var tx = svgEl('text', { y: 7.5, 'text-anchor': 'middle', 'font-size': 21, fill: '#fff' }); tx.textContent = word || '制圧'; g.appendChild(tx);
      fx.appendChild(g);
      tween(1500, function (k) {
        var s = k < 0.13 ? 2.9 - 1.9 * (k / 0.13) : (k < 0.2 ? 1 + 0.14 * Math.sin((k - 0.13) / 0.07 * Math.PI) : 1), o = k > 0.8 ? (1 - k) / 0.2 : 1;
        g.setAttribute('transform', 'translate(' + gr.c[0] + ' ' + (gr.c[1] - 24 * ui.u).toFixed(2) + ') rotate(-8) scale(' + (s * ui.u).toFixed(4) + ')'); g.setAttribute('opacity', o.toFixed(3));
      }, function () { g.remove(); });
    }, delay || 0);
  }
  function fxCascade(ids, word) { // 続けざまに判子を押す。かかる時間(ms)を返す
    var n = 0; ids.forEach(function (id) { if (mapOf(id) === ui.map) fxConquer(id, n++ * 190, word); });
    return n ? 700 + n * 190 : 0;
  }
  // 花火(天下統一・地球統一)
  function fireworks(ms) {
    if (reduce) return;
    var cv = $('#fxcanvas'), c = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.hidden = false; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var ps = [], t0 = performance.now(), last = t0, next = 0, cols = ['#ffd76a', '#ff6a4d', '#ffffff', '#ffb347', '#ffe9a8'];
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000), el = now - t0, i; last = now;
      if (el < ms && el >= next) {
        next = el + 240 + Math.random() * 220; sfx('firework');
        var x = W * (0.15 + Math.random() * 0.7), y = H * (0.12 + Math.random() * 0.33), col = cols[Math.floor(Math.random() * cols.length)];
        for (i = 0; i < 44; i++) { var a = Math.random() * 6.283, sp = 60 + Math.random() * 210; ps.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.1 + Math.random() * 0.6, max: 1.7, c: col }); }
      }
      c.clearRect(0, 0, W, H);
      for (i = ps.length - 1; i >= 0; i--) {
        var p = ps[i]; p.life -= dt; if (p.life <= 0) { ps.splice(i, 1); continue; }
        p.vy += 130 * dt; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt;
        c.globalAlpha = Math.min(1, p.life / 0.7); c.fillStyle = p.c; c.beginPath(); c.arc(p.x, p.y, 2.2, 0, 6.283); c.fill();
      }
      c.globalAlpha = 1;
      if (el < ms || ps.length) requestAnimationFrame(frame); else cv.hidden = true;
    }
    requestAnimationFrame(frame);
  }

  // ───────────────────────── 保存 ─────────────────────────
  function save() { try { localStorage.setItem(SAVE_KEY, E.serialize()); return true; } catch (e) { return false; } }
  function readSave() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 保存できない環境 */ } }

  // ───────────────────────── 地図 ─────────────────────────
  function buildMap() {
    var m = MAP[ui.map], h = [], i;
    h.push('<rect class="sea" x="-4000" y="-4000" width="' + (m.w + 8000) + '" height="' + (m.h + 8000) + '"/>');
    var g = '', sx = ui.map === 'japan' ? m.proj.kx * 2 : m.w / 18, sy = ui.map === 'japan' ? m.proj.ky * 2 : m.h / 8;
    for (i = -4; i * sx < m.w + 4 * sx; i++) g += 'M' + (i * sx).toFixed(1) + ' -400V' + (m.h + 400);
    for (i = -4; i * sy < m.h + 4 * sy; i++) g += 'M-400 ' + (i * sy).toFixed(1) + 'H' + (m.w + 400);
    h.push('<path class="grat" d="' + g + '"/>');
    h.push('<path class="deco" d="' + m.deco + '"/><g id="rgs">');
    Object.keys(m.regions).forEach(function (id) {
      h.push('<path class="rg" ' + (id === 'japan' ? 'data-jumpmap="japan"' : 'data-id="' + id + '"') + ' d="' + m.regions[id].d + '"/>');
    });
    h.push('</g>');
    if (m.lakes) h.push('<path class="lake" d="' + m.lakes + '"/>');
    h.push('<g id="over"></g><g id="marks"></g><g id="fx"></g>');
    $('#map').innerHTML = h.join('');
  }

  // 海外への出口(日本図)と、海路でつながる相手
  function crossLinks() {
    var out = {};
    D.SEA_LINKS.forEach(function (p) {
      var a = reg(p[0]), b = reg(p[1]);
      if (a.map === b.map) return;
      var jp = a.map === 'jp' ? p[0] : p[1], w = a.map === 'jp' ? p[1] : p[0];
      (out[w] = out[w] || []).push(jp);
    });
    return out;
  }
  function exitPos(w, jps) {
    var m = MAP.japan, g0 = m.regions[jps[0]], wl = MAP.world.regions[w].ll, jl = g0.ll;
    var dl = ((wl[0] - jl[0] + 540) % 360) - 180; // 経度差は近い向きで測る(ハワイは東)
    var dx = dl * m.proj.kx, dy = (jl[1] - wl[1]) * m.proj.ky, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var x = g0.c[0] + dx / len * 95, y = g0.c[1] + dy / len * 95;
    return [clamp(x, 40, m.w - 40), clamp(y, 30, m.h - 30)];
  }

  function refreshMap() {
    var st = S(); if (!st) return;
    var m = MAP[ui.map], key = ui.map, over = [], marks = [];
    var mvT = ui.mv ? ui.mv.targets : null;
    $$('#rgs .rg').forEach(function (p) {
      var id = p.getAttribute('data-id');
      if (!id) { // 世界図の「日本」
        var sm = E.summary(), t = sm.jp / sm.jpAll;
        p.style.fill = mix('#8f95a3', pColor(), t);
        return;
      }
      p.style.fill = colorOf(id);
      p.classList.toggle('own', E.isP(id));
      p.classList.toggle('dimmed', !!mvT && !mvT[id] && id !== ui.mv.from);
    });
    // 海路
    var cross = crossLinks();
    D.SEA_LINKS.forEach(function (pr) {
      var a = reg(pr[0]), b = reg(pr[1]);
      if (a.map !== b.map) return;
      if (mapOf(pr[0]) !== key) return;
      var ca = m.regions[pr[0]].c, cb = m.regions[pr[1]].c;
      if (Math.abs(ca[0] - cb[0]) > m.w * 0.5) {
        var lf = ca[0] < cb[0] ? ca : cb, rt = ca[0] < cb[0] ? cb : ca, span = lf[0] + m.w - rt[0], k = 80 / span, dy = (rt[1] - lf[1]) * k;
        over.push('<path class="route" d="M' + lf[0] + ' ' + lf[1] + 'l-80 ' + dy.toFixed(1) + 'M' + rt[0] + ' ' + rt[1] + 'l80 ' + (-dy).toFixed(1) + '"/>');
        return;
      }
      over.push('<path class="route" d="M' + ca[0] + ' ' + ca[1] + 'L' + cb[0] + ' ' + cb[1] + '"/>');
    });
    Object.keys(cross).forEach(function (w) {
      if (key === 'japan') {
        var pos = exitPos(w, cross[w]);
        cross[w].forEach(function (jp) { var c = m.regions[jp].c; over.push('<path class="route" d="M' + c[0] + ' ' + c[1] + 'L' + pos[0].toFixed(1) + ' ' + pos[1].toFixed(1) + '"/>'); });
        var nm = short(w), wd = nm.length * 11 + 26;
        marks.push('<g class="mk exit' + (E.isP(w) ? ' own' : '') + '" data-jump="' + w + '" data-x="' + pos[0].toFixed(1) + '" data-y="' + pos[1].toFixed(1) + '"><rect x="' + (-wd / 2) + '" y="-11" width="' + wd + '" height="22" rx="11"/><text y="4">' + esc(nm) + ' ▸</text></g>');
      } else {
        var cw = m.regions[w].c, cj = m.regions.japan.c;
        over.push('<path class="route" d="M' + cw[0] + ' ' + cw[1] + 'L' + cj[0] + ' ' + cj[1] + '"/>');
      }
    });
    // 敵の動き
    st.threats.forEach(function (t) {
      if (mapOf(t.from) !== key || mapOf(t.to) !== key) return;
      var a = m.regions[t.from].c, b = m.regions[t.to].c;
      over.push('<path class="threat" d="M' + a[0] + ' ' + a[1] + 'L' + b[0] + ' ' + b[1] + '"/>');
    });
    // 選択中・移動先の枠
    if (mvT) Object.keys(mvT).forEach(function (id) { if (mvT[id].ok && mapOf(id) === key) over.push('<path class="rg mv" fill="none" pointer-events="none" d="' + m.regions[id].d + '"/>'); });
    if (ui.sel && mapOf(ui.sel) === key) over.push('<path class="rg sel" fill="none" pointer-events="none" d="' + m.regions[ui.sel].d + '"/>');
    $('#over').innerHTML = over.join('');
    // 目印
    var threatened = {}; st.threats.forEach(function (t) { threatened[t.to] = 1; });
    Object.keys(m.regions).forEach(function (id) {
      var gr = m.regions[id], s = '';
      if (id === 'japan') {
        marks.push('<g class="mk" data-area="' + gr.area + '" data-x="' + gr.c[0] + '" data-y="' + gr.c[1] + '"><circle class="hit" r="15" data-jumpmap="japan"/><text class="lbl" y="4">日本</text></g>');
        return;
      }
      var r = st.regions[id], d = reg(id), own = r.o === 'player', f = st.factions[r.o];
      s += '<circle class="hit" r="13" data-id="' + id + '"/>';
      if (!own && f && f.cap === id && E.factionRegions(r.o).length > 1) s += '<path class="cap" d="M0-20l3.600 4.500-3.600 4.500-3.600-4.500z"/>';
      s += '<text class="lbl" y="4">' + esc(short(id)) + '</text>';
      if (!own) s += '<text class="sub" y="16">' + men(r.g) + '</text>';
      var sites = Object.keys(d.res), n = sites.length, sy = own ? 16 : 27;
      if (n) {
        s += '<g class="sites">';
        sites.forEach(function (k, i) {
          var x = (i - (n - 1) / 2) * 13, fk = k === 'coal' ? 'coalmine' : (k === 'gold' ? 'mine' : (k === 'iron' ? 'ironmine' : (k === 'oil' ? 'oilwell' : 'bauxite')));
          var built = own && r.fac[fk];
          var todo = own && !built; // 自領でまだ掘っていない資源は、白抜きで示す
          s += '<g class="site" transform="translate(' + x + ' ' + sy + ')"><circle r="5.600" fill="' + (todo ? '#1a2740' : SITE_COLOR[k]) + '" stroke="' + (todo ? SITE_COLOR[k] : 'rgba(10,16,30,.9)') + '" stroke-width="' + (todo ? 1.6 : 1) + '"/>' +
            '<path transform="translate(-4.200 -4.200) scale(.35)" fill="' + (todo ? SITE_COLOR[k] : '#10192b') + '" d="' + TF.iconPath(TF.SITE_ICON[k]) + '"/></g>';
        });
        s += '</g>';
      }
      var us = E.unitsAt(id);
      if (us.length) {
        var top = us.slice().sort(function (a, b) { return E.ustat(b).atk - E.ustat(a).atk; })[0];
        var ready = us.some(function (u) { return !u.acted; });
        s += '<g class="ubadge" transform="translate(0 -21)"' + (ready ? '' : ' opacity=".6"') + '><rect x="-16" y="-8" width="32" height="16" rx="5"/><path transform="translate(-13 -6.500) scale(.54)" d="' + TF.iconPath(TF.UNIT_ICON[top.type]) + '"/><text x="7" y="4">' + us.length + '</text></g>';
      }
      if (threatened[id]) s += '<g class="alert" transform="translate(19 -8)"><circle r="7.500"/><text y="4">!</text></g>';
      if (own && (r.b || r.p)) s += '<g class="bld" transform="translate(-19 -8)"><circle r="4"/></g>';
      marks.push('<g class="mk" data-area="' + gr.area + '" data-rid="' + id + '" data-x="' + gr.c[0] + '" data-y="' + gr.c[1] + '">' + s + '</g>');
    });
    $('#marks').innerHTML = marks.join('');
    placeMarks();
    markVisibility();
  }
  // 目印は地図を拡大縮小しても画面上の大きさが変わらないよう、縮尺に合わせて描き直す
  function placeMarks() {
    var u = (ui.u || 1).toFixed(4);
    $$('#marks .mk').forEach(function (g) { g.setAttribute('transform', 'translate(' + g.getAttribute('data-x') + ' ' + g.getAttribute('data-y') + ') scale(' + u + ')'); });
    ui.placedU = ui.u;
  }
  function mix(a, b, t) {
    function p(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
    var x = p(a), y = p(b);
    return 'rgb(' + x.map(function (v, i) { return Math.round(v + (y[i] - v) * t); }).join(',') + ')';
  }
  function markVisibility() {
    var u = ui.u || 1;
    $$('#marks .mk[data-area]').forEach(function (g) {
      var px = Math.sqrt(+g.getAttribute('data-area')) / u, rid = g.getAttribute('data-rid');
      g.classList.toggle('small', px < 31 && rid !== ui.sel);
    });
  }

  // どこまで引けるか。縦長の画面で横長の世界図が豆粒にならないよう、地図の高さが画面の半分弱を保つところで止める
  function maxViewW(m, asp) { return Math.min(Math.max(m.w, m.h / asp) * 1.06, m.h / (0.45 * asp)); }
  function stageSize() { var r = $('#map').getBoundingClientRect(); return { w: Math.max(50, r.width), h: Math.max(50, r.height) }; }
  function defaultView(key) {
    var sz = stageSize(), m = MAP[key];
    if (key === 'japan') { var c = m.regions.izu.c; return { cx: c[0] - 15, cy: c[1] - 25, w: clamp(sz.w * 0.8, 300, 900) }; }
    var j = m.regions.japan.c; return { cx: j[0] - 40, cy: j[1] + 60, w: clamp(sz.w * 2.200, 760, 2000) };
  }
  function applyView() {
    var m = MAP[ui.map], v = ui.view[ui.map] || (ui.view[ui.map] = defaultView(ui.map)), sz = stageSize(), asp = sz.h / sz.w;
    var maxW = maxViewW(m, asp), minW = ui.map === 'japan' ? 105 : 170;
    v.w = clamp(v.w, minW, maxW);
    var vh = v.w * asp;
    v.cx = clamp(v.cx, Math.min(v.w * 0.35, m.w / 2), Math.max(m.w - v.w * 0.35, m.w / 2));
    v.cy = clamp(v.cy, Math.min(vh * 0.35, m.h / 2), Math.max(m.h - vh * 0.35, m.h / 2));
    var svg = $('#map');
    svg.setAttribute('viewBox', (v.cx - v.w / 2).toFixed(2) + ' ' + (v.cy - vh / 2).toFixed(2) + ' ' + v.w.toFixed(2) + ' ' + vh.toFixed(2));
    ui.u = v.w / sz.w;
    if (ui.placedU !== ui.u) placeMarks();
    markVisibility();
  }
  function zoomAt(f, px, py) { // 画面上の点 (px,py) を動かさずに拡大縮小
    var v = ui.view[ui.map], sz = stageSize(), asp = sz.h / sz.w;
    if (px == null) { px = sz.w / 2; py = sz.h / 2; }
    var mx = v.cx - v.w / 2 + px * (v.w / sz.w), my = v.cy - v.w * asp / 2 + py * (v.w / sz.w);
    var m = MAP[ui.map], maxW = maxViewW(m, asp), minW = ui.map === 'japan' ? 105 : 170;
    var nw = clamp(v.w * f, minW, maxW);
    v.cx = mx - (px / sz.w - 0.5) * nw; v.cy = my - (py / sz.h - 0.5) * nw * asp; v.w = nw;
    applyView();
  }
  function switchMap(key) {
    if (ui.map !== key) { ui.map = key; buildMap(); }
    applyView(); refreshMap(); renderMapUI();
  }
  function focusRegion(id, opts) {
    opts = opts || {};
    var key = mapOf(id);
    if (ui.map !== key) { ui.map = key; buildMap(); }
    var v = ui.view[key] || (ui.view[key] = defaultView(key)), gr = geo(id), sz = stageSize();
    var want = clamp(Math.sqrt(gr.area) * 7, key === 'japan' ? 260 : 420, key === 'japan' ? 520 : 1100);
    if (opts.zoom || v.w > want * 2.200) v.w = Math.max(want, Math.min(v.w, want * 1.6));
    var narrow = window.innerWidth < 900, vh = v.w * sz.h / sz.w;
    v.cx = gr.c[0] + (narrow ? 0 : v.w * 0.18);
    v.cy = gr.c[1] + (narrow && opts.sheet !== false ? vh * 0.2 : 0);
    applyView(); renderMapUI();
  }

  function bindMap() {
    var svg = $('#map'), pts = {}, drag = null, pinch = null;
    function n() { return Object.keys(pts).length; }
    function local(e) { var r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    svg.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { svg.setPointerCapture(e.pointerId); } catch (err) { /* 古い環境 */ }
      pts[e.pointerId] = local(e);
      var v = ui.view[ui.map];
      if (n() === 1) drag = { x: pts[e.pointerId].x, y: pts[e.pointerId].y, cx: v.cx, cy: v.cy, moved: false, target: e.target, t: Date.now() };
      else if (n() === 2) { var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; if (drag) drag.moved = true; }
    });
    svg.addEventListener('pointermove', function (e) {
      if (!pts[e.pointerId]) return;
      var p = local(e), prev = pts[e.pointerId]; pts[e.pointerId] = p;
      if (n() >= 2 && pinch) {
        var k = Object.keys(pts), a = pts[k[0]], b = pts[k[1]], dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomAt(pinch.d / dist, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.d = dist;
        return;
      }
      if (!drag) return;
      var dx = p.x - drag.x, dy = p.y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 7) return;
      drag.moved = true; svg.classList.add('dragging');
      var v = ui.view[ui.map];
      v.cx -= (p.x - prev.x) * ui.u; v.cy -= (p.y - prev.y) * ui.u;
      applyView();
    });
    function up(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId];
      if (n() < 2) pinch = null;
      if (n() === 0) {
        svg.classList.remove('dragging');
        if (drag && !drag.moved && Date.now() - drag.t < 600) tapMap(drag.target);
        drag = null;
      }
    }
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', function (e) { delete pts[e.pointerId]; if (n() === 0) { drag = null; pinch = null; svg.classList.remove('dragging'); } });
    svg.addEventListener('wheel', function (e) { e.preventDefault(); var p = local(e); zoomAt(e.deltaY > 0 ? 1.18 : 1 / 1.18, p.x, p.y); }, { passive: false });
    window.addEventListener('resize', function () { if (S()) applyView(); });
  }
  function tapMap(t) {
    var el = t && t.closest ? t.closest('[data-id],[data-jump],[data-jumpmap]') : null;
    if (!el) { if (ui.mv) return; select(null); return; }
    var jm = el.getAttribute('data-jumpmap'), ju = el.getAttribute('data-jump'), id = el.getAttribute('data-id');
    if (jm) { ui.mv = null; switchMap(jm); return; }
    if (ju) id = ju;
    if (ui.mv) {
      var tg = ui.mv.targets[id];
      if (tg && tg.ok) { doMove(id); return; }
      if (tg && !tg.ok) { toast(tg.why); return; }
      if (id === ui.mv.from) return;
      toast('そこへは移動できません(自領の中を ' + E.moveRange() + ' 地域まで)');
      return;
    }
    sfx('select');
    select(id, { focus: !!ju });
  }
  function select(id, opts) {
    ui.sel = id; ui.sub = null; ui.pick = {};
    if (id && ((opts && opts.focus) || mapOf(id) !== ui.map)) focusRegion(id, { zoom: true });
    renderSheet();
    if (id) ensureVisible(id);
    refreshMap(); renderMapUI();
  }
  // 選んだ地域がシートの下や画面の外にあれば、見える位置まで地図をずらす
  function ensureVisible(id) {
    if (mapOf(id) !== ui.map) return;
    var v = ui.view[ui.map], sz = stageSize(), gr = geo(id), sh = $('#sheet'), narrow = window.innerWidth < 900;
    var sr = sh.hidden ? null : sh.getBoundingClientRect();
    var visW = sz.w - (!narrow && sr ? sr.width : 0), visH = sz.h - (narrow && sr ? sr.height : 0);
    var vh = v.w * sz.h / sz.w, px = (gr.c[0] - (v.cx - v.w / 2)) / ui.u, py = (gr.c[1] - (v.cy - vh / 2)) / ui.u;
    var topPad = 96, pad = 36;
    if (px > pad && px < visW - pad && py > topPad && py < visH - pad) return;
    v.cx += (px - visW / 2) * ui.u; v.cy += (py - (topPad + visH) / 2) * ui.u;
    applyView();
  }

  // ───────────────────────── 上と下の帯 ─────────────────────────
  // 上の帯の数字は、変わったときに弾んで、前の値から数え上がる
  var hudAnim = {}, hudTarget = null, hudRaf = 0, HUD_MS = 520;
  function hudNow(k, now) { var a = hudAnim[k]; if (!a) return hudTarget[k]; var q = Math.min(1, (now - a.t0) / HUD_MS); q = 1 - Math.pow(1 - q, 3); return a.from + (a.to - a.from) * q; }
  function hudTick(now) {
    hudRaf = 0; var busy = false;
    Object.keys(hudAnim).forEach(function (k) {
      var a = hudAnim[k], el = $('#hud [data-k="' + k + '"] b'), end = now - a.t0 >= HUD_MS;
      if (el) el.textContent = compact(end ? a.to : hudNow(k, now));
      if (end) delete hudAnim[k]; else busy = true;
    });
    if (busy) hudRaf = requestAnimationFrame(hudTick);
  }
  function renderHud() {
    var st = S(), inc = E.income(), dl = E.dateLabel(), sm = E.summary(), now = performance.now(), vals = { prestige: st.prestige }, pop = {};
    RES.forEach(function (r) { vals[r[0]] = st.res[r[0]]; });
    if (hudTarget && hudTarget._gid === ui.gid) Object.keys(vals).forEach(function (k) { if (vals[k] !== hudTarget[k] && !reduce) { hudAnim[k] = { from: hudNow(k, now), to: vals[k], t0: now }; pop[k] = vals[k] > hudTarget[k] ? 'up' : 'down'; } });
    else hudAnim = {};
    hudTarget = vals; hudTarget._gid = ui.gid;
    var h = '<div class="hud-top"><span class="hud-date">' + dl.text + '</span><span class="hud-era">' + dl.era + '</span>' +
      '<span class="hud-goal">日本 <b>' + sm.jp + '</b>/' + sm.jpAll + (st.flags.unified != null ? ' 世界 <b>' + sm.w + '</b>/' + sm.wAll : '') + '</span>' +
      '<button class="hud-menu" data-act="sound-toggle" aria-label="効果音を' + (ui.opts.sound ? '切る' : '入れる') + '">' + icon(ui.opts.sound ? 'sound' : 'mute') + '</button>' +
      '<button class="hud-menu" data-act="menu" aria-label="メニュー">≡</button></div><div class="res">';
    RES.forEach(function (r) {
      var k = r[0], v = st.res[k], d = inc.net[k], low = (k === 'fuel' || k === 'ammo') && v < 120 && d <= 0;
      h += '<button class="chip' + (low ? ' low' : '') + (pop[k] ? ' pop ' + pop[k] : '') + '" data-k="' + k + '" data-act="tab" data-panel="nation" title="' + r[1] + '">' + icon(k) + '<b>' + compact(hudAnim[k] ? hudNow(k, now) : v) + '</b><i class="' + (d > 0 ? 'up' : (d < 0 ? 'down' : '')) + '">' + csgn(d) + '</i></button>';
    });
    h += '<button class="chip' + (pop.prestige ? ' pop ' + pop.prestige : '') + '" data-k="prestige" data-act="tab" data-panel="nation" title="威信">' + icon('prestige') + '<b>' + compact(hudAnim.prestige ? hudNow("prestige", now) : st.prestige) + '</b><i>威信</i></button></div>';
    $('#hud').innerHTML = h;
    if (!hudRaf && Object.keys(hudAnim).length) hudRaf = requestAnimationFrame(hudTick);
  }
  function renderNav() {
    var st = S(), idle = E.idleBirds().length, ready = st.units.filter(function (u) { return !u.acted; }).length;
    function b(p, ic, label, dot) { return '<button data-act="tab" data-panel="' + p + '" class="' + (ui.panel === p ? 'on' : '') + '">' + icon(ic) + label + (dot ? '<span class="dot">' + dot + '</span>' : '') + '</button>'; }
    var npol = E.policyOptions().filter(function (p) { return p.ok; }).length;
    if (!E.autoTechLeft()) idle = 0; // 残りが核兵器と超知能だけなら、急かさない
    $('#nav').innerHTML = b('units', 'flag', '部隊', 0) + b('research', 'rp', '研究', idle || 0) + b('diplo', 'scroll', '外交', st.dipLeft || 0) + b('nation', 'fort', '国勢', npol || 0) +
      '<button class="end" data-act="end-turn"><span>次の季節へ<small>未行動 ' + ready + ' 部隊</small></span></button>';
  }
  function renderMapUI() {
    var st = S(); if (!st) return;
    var h = '<div class="map-ui tl"><div class="seg" role="tablist"><button data-act="map" data-map="japan" class="' + (ui.map === 'japan' ? 'on' : '') + '">日本</button><button data-act="map" data-map="world" class="' + (ui.map === 'world' ? 'on' : '') + '">世界</button></div>' +
      '<button class="npill" data-act="tab" data-panel="nation" aria-label="国勢を開く"><b>' + esc(E.nation().name) + '</b><small>' + D.ERAS[E.eraStage()].name + ' ・ 民心 ' + Math.round(E.moodAvg()) + '</small></button>' +
      '<div class="zoom"><button data-act="zoom" data-f="0.62" aria-label="拡大">＋</button><button data-act="zoom" data-f="1.6" aria-label="縮小">−</button></div></div>';
    var hs = E.hints();
    if (hs.length && !ui.mv && !ui.sel) h += '<div class="advisor"><button data-act="hints">' + birdSVG(hs[0].bird) + '<span>' + esc(hs[0].text) + '</span>' + (hs.length > 1 ? '<em>+' + (hs.length - 1) + '</em>' : '') + '</button></div>';
    if (ui.mv) h += '<div class="movebar">移動先の自領をタップ(' + ui.mv.ids.length + '部隊)<button data-act="move-cancel">やめる</button></div>';
    $('#mapui').innerHTML = h;
  }

  // ───────────────────────── 地域シート ─────────────────────────
  function facName(k) { return D.FACILITIES[k].name; }
  function siteTags(id) {
    var d = reg(id), r = S().regions[id], own = r.o === 'player', s = '';
    Object.keys(d.res).forEach(function (k) {
      var fk = k === 'coal' ? 'coalmine' : (k === 'gold' ? 'mine' : (k === 'iron' ? 'ironmine' : (k === 'oil' ? 'oilwell' : 'bauxite')));
      s += '<span class="tag site" style="background:' + SITE_COLOR[k] + '">' + icon(TF.SITE_ICON[k]) + D.SITE_NAMES[k] + ' ' + d.res[k] + (own ? (r.fac[fk] ? '・稼働中' : '・未開発') : '') + '</span>';
    });
    return s;
  }
  function renderSheet() {
    var el = $('#sheet'), id = ui.sel, st = S();
    if (!id || ui.mv) { el.hidden = true; el.innerHTML = ''; return; }
    var d = reg(id), r = st.regions[id], own = r.o === 'player', f = st.factions[r.o], h = '';
    h += '<div class="sh-head"><i class="sh-flag" style="background:' + colorOf(id) + '"></i><div class="sh-title"><h2>' + esc(d.name) + '</h2><p>' +
      (own ? '自領 ・ 統治 ' + Math.round(r.ctl) + '% ・ 民心 ' + Math.round(r.mood) : esc(E.fname(r.o)) + ' ・ ' + esc(f.leader)) + (d.seat ? ' ・ ' + esc(d.seat) : '') + '</p></div>' +
      '<button class="x" data-act="close-sheet" aria-label="閉じる">×</button></div>';
    if (own && ui.sub === 'build') { el.innerHTML = '<div class="sheet-in">' + h + buildList(id) + '</div>'; el.hidden = false; return; }
    if (own && ui.sub === 'produce') { el.innerHTML = '<div class="sheet-in">' + h + produceList(id) + '</div>'; el.hidden = false; return; }
    // 札
    var tags = '';
    if (!own) {
      if (f.cap === id) tags += '<span class="tag gold">本拠</span>';
      if (f.war) tags += '<span class="tag war">交戦中</span>';
      if (f.pact > 0) tags += '<span class="tag ok">不可侵 あと' + f.pact + '</span>';
      if (f.trade) tags += '<span class="tag ok">通商中</span>';
      if (f.awe > 0) tags += '<span class="tag">畏怖 あと' + f.awe + '</span>';
    }
    if (r.ruin > 0.04) tags += '<span class="tag war">焦土 ' + Math.round(r.ruin * 100) + '%(実りが減る)</span>';
    tags += siteTags(id);
    if (d.snow) tags += '<span class="tag">豪雪(冬は攻めにくい)</span>';
    if (d.mtn) tags += '<span class="tag">山がち(守り +15%)</span>';
    if (!d.coast) tags += '<span class="tag">内陸</span>';
    if (d.port) tags += '<span class="tag">' + icon('anchor') + '交易港</span>';
    if (own) Object.keys(r.fac).forEach(function (k) { if (!D.FACILITIES[k].site) tags += '<span class="tag gold">' + facName(k) + '</span>'; });
    if (tags) h += '<div class="tags">' + tags + '</div>';
    var nbr = '<div class="tags nbrs"><span class="dim">つながる地域</span>';
    E.links(id).forEach(function (l) { nbr += '<button class="tag nb" data-act="goto" data-id="' + l.id + '"><i style="background:' + colorOf(l.id) + '"></i>' + esc(short(l.id)) + (l.sea ? '<small>海路</small>' : '') + '</button>'; });
    nbr += '</div>';
    if (own) {
      var y = E.regionYield(id);
      h += '<div class="facts"><div class="fact"><span>国力</span><b class="num">' + d.koku + '</b></div>' +
        '<div class="fact"><span>守備兵</span><b>' + men(r.g) + ' <small>/ ' + men(E.garrisonCap(id)) + '</small></b></div>' +
        '<div class="fact"><span>城郭</span><b>' + pips(r.fort, 5) + '</b></div>' +
        '<div class="fact"><span>守りの戦力</span><b>' + fmt(E.defensePower(id)) + '</b></div></div>';
      var ys = [];
      [['gold', '資金'], ['food', '兵糧'], ['steel', '鉄鋼'], ['fuel', '燃料'], ['ammo', '弾薬']].forEach(function (k) { if (Math.round(y[k[0]]) > 0) ys.push(icon(k[0]) + ' +' + fmt(y[k[0]])); });
      if (y.rp) ys.push(icon('rp') + ' +' + y.rp);
      h += '<p class="dim" style="font-size:12.5px">毎季の産出 <span class="cost" style="color:var(--fg)">' + ys.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</span></p>';
      var vx = E.voice(id), tg = E.moodTarget(id);
      h += '<div class="vox"><div class="vox-m"><span>民心</span>' + moodBar(r.mood, tg) + '<b class="' + moodCls(r.mood) + '">' + Math.round(r.mood) + '</b>' + (Math.abs(tg - r.mood) >= 1 ? '<small>' + (tg > r.mood ? '↗' : '↘') + ' ' + tg + '</small>' : '') + '</div>' +
        (vx ? '<p><b>' + esc(vx.who) + '</b>「' + esc(vx.t) + '」</p>' : '') + '</div>';
      var th = st.threats.filter(function (t) { return t.to === id; });
      th.forEach(function (t) {
        var A = st.regions[t.from].g * 0.7 / E.MEN * st.factions[t.f].q * D.DIFFICULTY[st.diff].enemy * (t.sea ? 0.7 : 1);
        h += '<p class="note bad" style="border-color:var(--bad)">' + esc(E.fname(t.f)) + 'が' + esc(reg(t.from).name) + 'から攻めてくる(戦力 約' + fmt(A) + ')。守りの戦力がこれを上回れば退けられる。</p>';
      });
      if (r.b) h += '<p class="note">' + facName(r.b.k) + 'を建設中(あと' + r.b.t + 'ターン)</p>';
      if (r.p) h += '<p class="note">' + esc(D.UNIT_TYPES[r.p.type].name) + 'を編成中(あと' + r.p.t + 'ターン)</p>';
      var cst = E.garrisonCost(1000), room = E.garrisonCap(id) - r.g;
      h += '<div class="acts"><button class="btn" data-act="sub" data-sub="build">' + icon('fort') + '建設</button><button class="btn" data-act="sub" data-sub="produce">' + icon('ashi') + '編成</button>' +
        '<button class="btn" data-act="recruit" data-n="1000"' + (room > 0 && st.res.gold >= cst.gold && st.res.food >= cst.food ? '' : ' disabled') + '>徴兵 +1千 ' + costHTML(cst) + '</button></div>';
      var us = E.unitsAt(id);
      if (us.length) {
        var np = us.filter(function (u) { return ui.pick[u.id]; }).length, movable = us.filter(function (u) { return !u.acted; }).length;
        h += '<div class="sec">ここにいる部隊 ' + us.length + '(タップで選ぶ)</div><div class="acts"><button class="btn gold" data-act="move-start"' + (movable ? '' : ' disabled') + '>' + (np ? '選んだ ' + np + ' 部隊を移動' : (movable ? '動ける ' + movable + ' 部隊を移動' : '全部隊が行動済み')) + '</button></div><div class="list">';
        us.forEach(function (u) { h += unitRow(u, { act: u.acted ? null : 'pick', on: !!ui.pick[u.id], tight: true }); });
        h += '</div>';
      }
      if (d.note) h += '<p class="note">' + esc(d.note) + '</p>';
      h += nbr;
    } else {
      var lock = E.lockedOverseas(id);
      h += '<div class="facts"><div class="fact"><span>国力</span><b class="num">' + d.koku + '</b></div>' +
        '<div class="fact"><span>守備兵</span><b>' + men(r.g) + '</b></div>' +
        '<div class="fact"><span>城郭</span><b>' + pips(r.fort, 5) + '</b></div>' +
        '<div class="fact"><span>敵の戦力</span><b>' + fmt(E.enemyPower(id)) + '</b></div></div>';
      if (d.note) h += '<p class="note">' + esc(d.note) + '</p>';
      var can = lock ? [] : E.attackOptions(id).filter(function (o) { return o.ok; }), canG = can.filter(function (o) { return o.via === 'land' || o.via === 'sea'; });
      if (lock) h += '<p class="note">海を渡るのは、天下統一のあと。まずは日本を一つに。</p>';
      else if (!canG.length) {
        var nb = E.links(id).filter(function (l) { return E.isP(l.id); }).map(function (l) { return reg(l.id).name + (l.sea ? '(海路)' : ''); });
        h += '<p class="note">' + (nb.length ? '占領には陸上部隊が要る。' + esc(nb.join('、')) + 'に、未行動の陸上部隊を進めよう。' : 'ここは自領と接していない。隣の地域から順に攻めよう。') + (can.length ? '砲爆撃だけなら今すぐできる。' : '') + '</p>';
      }
      h += '<div class="acts"><button class="btn shu" data-act="attack"' + (can.length ? '' : ' disabled') + '>' + icon('sword') + (canG.length || !can.length ? '攻撃' : '砲爆撃') + '</button>' +
        '<button class="btn" data-act="fac" data-fid="' + r.o + '">' + icon('scroll') + '外交</button></div>';
      h += nbr;
    }
    el.innerHTML = '<div class="sheet-in">' + h + '</div>';
    el.hidden = false;
  }
  function unitRow(u, o) {
    o = o || {};
    var st = E.ustat(u), T = D.UNIT_TYPES[u.type], tagn = o.act ? 'button' : 'div';
    var sub = '戦力 ' + fmt(st.atk * u.hp / 100) + (st.siege ? ' ・ 城郭−' + st.siege : '') + (st.fuel || st.ammo ? ' ・ 1戦ごと ' + (st.fuel ? '燃' + st.fuel + ' ' : '') + (st.ammo ? '弾' + st.ammo : '') : ' ・ 燃料も弾薬も不要');
    return '<' + tagn + ' class="row' + (o.tight ? ' tight' : '') + (o.on ? ' on' : '') + (u.acted && !o.plain ? ' off' : '') + '"' + (o.act ? ' data-act="' + o.act + '" data-uid="' + u.id + '"' : '') + '>' + icon(TF.UNIT_ICON[u.type], 'big') +
      '<div><h3>' + esc(u.name) + (T.tiered ? ' <span class="dim" style="font-weight:400">' + st.name + '</span>' : '') + '</h3><p>' + sub + '</p>' + hpBar(u.hp) + '</div>' +
      '<div class="side"><b>' + u.hp + '%</b>' + (o.side != null ? o.side : (u.acted ? '行動済み' : (o.on ? '選択中' : ''))) + '</div></' + tagn + '>';
  }
  function buildList(id) {
    var h = '<div class="acts"><button class="btn sm" data-act="sub" data-sub="">◂ もどる</button></div><div class="sec">建設</div><div class="list">';
    E.buildOptions(id).forEach(function (o) {
      var st = o.built ? '<b class="good">済</b>' : (o.building ? '<b class="warn">建設中</b>' : '<b>' + o.turns + 'ターン</b>');
      h += '<button class="row' + (o.built ? ' done' : (o.ok ? '' : ' off')) + '" data-act="build" data-key="' + o.key + '"' + (o.ok ? '' : ' disabled') + '>' + icon(o.key === 'fort' ? 'fort' : (o.key === 'oilwell' ? 'oil' : (o.key === 'coalmine' ? 'coal' : (o.key === 'ironmine' ? 'iron' : (o.key === 'mine' ? 'gold' : (o.key === 'bauxite' ? 'bauxite' : (o.key === 'school' ? 'rp' : (o.key === 'farm' ? 'food' : (o.key === 'shipyard' ? 'anchor' : (o.key === 'airfield' ? 'kair' : (o.key === 'arsenal' ? 'gear' : (o.key === 'datacenter' ? 'chip' : 'gold'))))))))))), 'big') +
        '<div><h3>' + o.name + (o.amount ? ' <span class="dim" style="font-weight:400">埋蔵 ' + o.amount + '</span>' : '') + '</h3><p>' + o.effect + '</p><p>' + (o.built ? '' : costHTML(o.cost)) + (o.why && !o.built ? ' <span class="' + (o.building ? 'warn' : 'bad') + '">' + o.why + '</span>' : '') + '</p></div><div class="side">' + st + '</div></button>';
    });
    return h + '</div>';
  }
  function produceList(id) {
    var h = '<div class="acts"><button class="btn sm" data-act="sub" data-sub="">◂ もどる</button></div><div class="sec">部隊の編成</div><div class="list">', opts = E.produceOptions(id);
    opts.forEach(function (o) {
      var T = D.UNIT_TYPES[o.type], prev = { id: 0, type: o.type, hp: 100 }, st = E.ustat(prev);
      h += '<button class="row' + (o.ok ? '' : ' off') + '" data-act="produce" data-type="' + o.type + '"' + (o.ok ? '' : ' disabled') + '>' + icon(TF.UNIT_ICON[o.type], 'big') +
        '<div><h3>' + esc(o.name) + (o.cap != null ? ' <span class="dim" style="font-weight:400">' + o.count + '/' + o.cap + '</span>' : '') + '</h3><p>戦力 ' + fmt(st.atk) + (st.siege ? ' ・ 城郭−' + st.siege : '') + (T.transport ? ' ・ 輸送' + T.transport : '') + ' ・ ' + esc(T.desc) + '</p><p>' + costHTML(o.cost) + (o.why ? ' <span class="bad">' + o.why + '</span>' : '') + '</p></div><div class="side"><b>' + o.turns + 'ターン</b></div></button>';
    });
    if (!opts.length) h += '<p class="dim">編成できる部隊がありません。</p>';
    var locked = Object.keys(D.UNIT_TYPES).filter(function (t) { var T = D.UNIT_TYPES[t]; return T.cost && T.tech && !E.tech(T.tech); });
    if (locked.length) h += '<p class="dim" style="font-size:12px">研究で増える部隊: ' + locked.map(function (t) { return D.UNIT_TYPES[t].name + '(' + TECH[D.UNIT_TYPES[t].tech].name + ')'; }).join('、') + '</p>';
    return h + '</div>';
  }

  // ───────────────────────── 移動 ─────────────────────────
  function startMove() {
    var us = E.unitsAt(ui.sel).filter(function (u) { return !u.acted; }), picked = us.filter(function (u) { return ui.pick[u.id]; });
    var ids = (picked.length ? picked : us).map(function (u) { return u.id; });
    if (!ids.length) return;
    var t = E.moveTargets(ids);
    if (!Object.keys(t).length) { toast('移動できる自領がありません'); return; }
    ui.mv = { ids: ids, from: ui.sel, targets: t };
    renderSheet(); refreshMap(); renderMapUI();
  }
  function doMove(id) {
    var res = E.move(ui.mv.ids, id);
    if (res.error) { toast(res.error); return; }
    sfx('move'); toast(reg(id).name + 'へ移動' + (res.fuel ? '(燃料 −' + res.fuel + ')' : ''));
    ui.mv = null; save(); ui.sel = id; ui.pick = {};
    if (mapOf(id) !== ui.map) focusRegion(id, { zoom: true });
    refreshAll();
    ensureVisible(id); refreshMap();
  }

  // ───────────────────────── 攻撃 ─────────────────────────
  var VIA = { land: '陸路', sea: '海路で上陸', heli: 'ヘリ支援', air: '航空支援', naval: '艦砲支援', transport: '輸送', missile: '世界のどこへでも' };
  function openAttack() {
    var tid = ui.sel, sug = E.suggestAttack(tid, 0.9), ids = {};
    (sug.ok ? sug.ids : []).forEach(function (i) { ids[i] = 1; });
    ui.atk = { tid: tid, ids: ids, sug: sug.ok };
    renderAttack();
  }
  function renderAttack() {
    var a = ui.atk, tid = a.tid, d = reg(tid), r = S().regions[tid], opts = E.attackOptions(tid), st = S();
    var ids = Object.keys(a.ids).map(Number), pr = E.predictAttack(tid, ids, opts);
    var h = '<p class="eyebrow">' + esc(E.fname(r.o)) + ' ・ ' + (pr.canCapture || !ids.length ? '攻略作戦' : '砲爆撃') + '</p><h2>' + esc(d.name) + '</h2>';
    h += '<div class="facts"><div class="fact"><span>守備兵</span><b>' + men(r.g) + '</b></div><div class="fact"><span>城郭</span><b>' + r.fort + (pr.siege ? ' → ' + pr.fortEff : '') + '</b></div><div class="fact"><span>敵の戦力</span><b>' + fmt(pr.E) + '</b></div></div>';
    if (pr.winter) h += '<p class="note warn" style="border-color:var(--warn)">冬の豪雪。陸上部隊とヘリの戦力が4割落ちる。</p>';
    h += '<div class="acts"><button class="btn sm" data-act="atk-sug">おすすめ</button><button class="btn sm" data-act="atk-all">全部隊</button><button class="btn sm" data-act="atk-none">解除</button></div>';
    var groups = [['陸上部隊(占領できる)', function (o) { return o.via === 'land' || o.via === 'sea'; }], ['支援(ヘリ・航空・艦隊)', function (o) { return o.via !== 'land' && o.via !== 'sea' && o.via !== 'missile'; }],
      ['戦略兵器(おすすめには入らない)', function (o) { return o.via === 'missile'; }]];
    groups.forEach(function (g) {
      var list = opts.filter(g[1]); if (!list.length) return;
      h += '<div class="sec">' + g[0] + '</div><div class="list">';
      list.forEach(function (o) {
        var u = o.u, us = E.ustat(u), on = !!a.ids[u.id], part = pr.parts.filter(function (p) { return p.u.id === u.id; })[0];
        var sub = VIA[o.via] + (u.loc ? '・' + short(u.loc) : '') + ' ・ ' + (us.atk ? '戦力 +' + fmt(part ? part.p : us.atk * u.hp / 100) : '輸送 ' + us.transport + '部隊') + (us.siege ? ' ・ 城郭−' + us.siege : '') + (us.transport && us.atk ? ' ・ 輸送' + us.transport : '');
        var costs = '<span class="cost">' + (us.fuel ? '<span>' + icon('fuel') + us.fuel + '</span>' : '') + (us.ammo ? '<span>' + icon('ammo') + us.ammo + '</span>' : '') + (!us.fuel && !us.ammo ? '<span class="dim">消費なし</span>' : '') + '</span>';
        if (D.UNIT_TYPES[u.type].nuke) costs = '<span class="bad">一度きり。撃てば、この土地は長く焦土になる</span>';
        h += '<button class="row' + (on ? ' on' : '') + (o.ok ? '' : ' off') + '" data-act="atk-toggle" data-uid="' + u.id + '"' + (o.ok ? '' : ' disabled') + '>' + icon(TF.UNIT_ICON[u.type], 'big') +
          '<div><h3>' + esc(u.name) + '</h3><p>' + sub + (part && part.tag.length ? ' <span class="warn">' + part.tag.join('・') + '</span>' : '') + '</p><p>' + (o.ok ? costs : '<span class="bad">' + o.why + '</span>') + '</p></div>' +
          '<div class="side"><b>' + (on ? '✓' : '') + '</b>' + u.hp + '%</div></button>';
      });
      h += '</div>';
    });
    if (!opts.length) h += '<p class="note">届く部隊がいません。</p>';
    var tot = pr.P + pr.E || 1, ch = Math.round(pr.chance * 100), body = h;
    h = '<div class="vs"><div class="lab"><span>我が戦力 <b>' + fmt(pr.P) + '</b></span><span><b>' + fmt(pr.E) + '</b> 敵の戦力</span></div><div class="prog"><i style="width:' + (pr.P / tot * 100) + '%"></i><i class="w" style="width:' + (pr.E / tot * 100) + '%"></i></div>' +
      '<div class="lab"><span class="dsay">' + birdSVG('dario') + (pr.canCapture ? '勝算 <b class="' + (ch >= 85 ? 'good' : (ch >= 50 ? 'warn' : 'bad')) + '">' + ch + '%</b>' : (ids.length ? '陸上部隊がいないので占領はできない' : '')) + '</span><span>損耗の見込み 約' + (ids.length ? Math.round(pr.lossPct) : 0) + '%</span></div>' +
      '<div class="lab"><span>' + icon('fuel') + ' 燃料 <b class="' + (pr.fuel > st.res.fuel ? 'bad' : '') + '">' + pr.fuel + '</b> / ' + fmt(st.res.fuel) + '</span><span>' + icon('ammo') + ' 弾薬 <b class="' + (pr.ammo > st.res.ammo ? 'bad' : '') + '">' + pr.ammo + '</b> / ' + fmt(st.res.ammo) + '</span></div></div>';
    if (ids.length) pr.problems.forEach(function (p) { h += '<p class="bad">' + p + '</p>'; });
    if (pr.onFoot && ids.length) h += '<p class="warn">燃料が足りないので、歩ける部隊は徒歩で向かう(戦力3割減)。</p>';
    if (pr.nuke) h += '<p class="bad">核を撃つ。全勢力の友好 −25、自領の民心 −8、威信 −10。土地は焦土になる。</p>';
    var f = S().factions[r.o];
    if (f && f.pact > 0) h += '<p class="bad">不可侵の約定を破ることになる。威信と諸国の友好を失う。</p>';
    showModal('<div class="card-body">' + body + '</div><div class="card-foot plan"><div class="plan-sum">' + h + '</div><button class="btn" data-act="modal-close">やめる</button><button class="btn shu" data-act="atk-go"' + (ids.length && !pr.problems.length ? '' : ' disabled') + '>' + (pr.nuke ? '核を撃つ' : (pr.canCapture || !ids.length ? '作戦決行(' + ids.length + '部隊)' : '砲爆撃する')) + '</button></div>', { replace: true, keepScroll: !!(ui.modal && ui.modal.atk), atk: true });
  }
  function confirmNuke() { // 核だけは、もう一度たずねる
    var d = reg(ui.atk.tid);
    showModal('<div class="card-body"><p class="eyebrow">最終確認</p><h2 class="lose">' + esc(d.name) + 'に核を撃つ</h2><div class="story">' + birdSVG('dario', 'b56') +
      '<p>司令。再考を求めます。\nこの一発で、' + esc(d.name) + 'の城も、町も、そこにいる人も消えます。土地は二十五季のあいだ焦土になり、世界中が我が国を恐れ、憎みます。自領の民も口をつぐみます。\n勝つだけなら、ほかの手があります。</p></div></div>' +
      '<div class="card-foot"><button class="btn gold" data-act="nuke-no">やめる</button><button class="btn shu" data-act="nuke-yes">それでも撃つ</button></div>', { replace: true, sfx: 'warn', atk: true });
  }
  function battleLines(types, win, bombard) {
    var L = [];
    if (types.birdmech) L.push('全高四十メートルの文鳥が、城をまたいだ。城兵は槍を置いて、ただ見上げた。');
    if (types.orbital) L.push('空の上から光の柱が降り、櫓のあった場所に、きれいな丸い穴が残った。');
    if (types.drone) L.push('羽音のような唸りが空を覆い、数百の無人機が一斉に降りてきた。');
    if (types.jet) L.push('雷のような音とともに戦闘機が城の上を飛びすぎ、次の瞬間、櫓が消えた。');
    if (types.ddg || types.bb || types.ironclad) L.push('沖の艦から放たれた砲弾が、城下を揺らした。');
    if (types.arty || types.fgun) L.push('りゅう弾砲の一斉射で、石垣が崩れ落ちた。');
    if (types.heli) L.push('空飛ぶ鉄の怪鳥に、城兵は弓を取り落とした。');
    if (types.tank || types.ktank || types.modern) L.push('戦車が大手門を踏み越えた。槍も鉄砲も、鉄の箱には通じない。');
    if (types.inf && L.length < 2) L.push('機関銃の前に、突撃は三度くじけた。');
    if (types.ashi && L.length < 2) L.push('現地の兵たちが槍をそろえて城門に迫った。');
    if (!win && !bombard) L = ['敵は城に拠って持ちこたえた。こちらの兵は消耗し、退くほかなかった。'];
    return L.slice(0, 2);
  }
  function goAttack() {
    var a = ui.atk, ids = Object.keys(a.ids).map(Number), types = {}, before = {};
    ids.forEach(function (i) { var u = E.unitById(i); if (u) types[u.type] = (types[u.type] || 0) + 1; });
    if (types.nuke && !a.nukeOk) { confirmNuke(); return; }
    var fid0 = E.owner(a.tid), f0 = S().factions[fid0], boss = f0 && f0.cap === a.tid ? f0.leader : '';
    E.playerRegions().forEach(function (id) { before[id] = 1; });
    var color = colorOf(a.tid), season = E.season(), tier = E.infTier();
    var res = E.attack(a.tid, ids);
    if (res.error) { oops(res.error); return; }
    var gained = E.playerRegions().filter(function (id) { return !before[id]; });
    gained.sort(function (x, y) { return (y === res.rid ? 1 : 0) - (x === res.rid ? 1 : 0); });
    ui.atk = null; save();
    $('#modal').hidden = true; $('#modal').innerHTML = ''; ui.modal = null; // 作戦の窓を閉じる(順番待ちは進めない)
    sfx('launch');
    var d = reg(res.rid), show = function () { showBattleResult(res, types, gained); };
    if (animOn()) {
      TF.Battle3D.play($('#battle'), { title: d.name + (res.nuke ? ' 核攻撃' : (res.bombard ? ' 砲爆撃' : ' 攻略戦')), win: res.win, bombard: res.bombard, ratio: res.ratio, chance: res.chance,
        men: res.gBefore, menAfter: res.nuke ? Math.round(res.gBefore * 0.05) : (res.win ? 0 : res.gAfter), fort: res.fort, siege: res.siege, color: color, season: season, snow: d.snow, fuji: !!FUJI[res.rid], tier: tier, types: types,
        enemy: D.CULTURE[fid0], leader: boss, nuke: !!res.nuke, laser: E.tech('laser') }, show);
    } else show();
  }
  function showBattleResult(res, types, gained) {
    var d = reg(res.rid), h = '<p class="eyebrow">' + E.dateLabel().text + ' ・ ' + esc(d.name) + '</p>';
    if (res.nuke) { // 核は、勝っても祝わない
      h += '<h2 class="huge grave">核攻撃</h2><p>閃光。遅れて、音。</p><p>城も、町も、そこにいた人も、影だけを残して消えた。' + (res.captured ? '焼け跡に、我が軍の旗が立った。' : '') + '</p>';
    } else {
      h += '<h2 class="huge slam ' + (res.win ? 'win' : (res.bombard ? '' : 'lose')) + '">' + (res.win ? '攻略' : (res.bombard ? '砲爆撃' : '敗退')) + '</h2>';
      battleLines(types, res.win, res.bombard).forEach(function (l) { h += '<p>' + l + '</p>'; });
      if (res.win && res.ratio >= 2) h += '<p class="over"><span>オーバーキル</span><b>' + Math.round(res.ratio * 100) + '%</b></p>';
    }
    var tot = res.P + res.E || 1;
    h += '<div class="vs"><div class="lab"><span>我が戦力 <b>' + fmt(res.P) + '</b></span><span><b>' + fmt(res.E) + '</b> 敵の戦力</span></div><div class="prog"><i style="width:' + (res.P / tot * 100) + '%"></i><i class="w" style="width:' + (res.E / tot * 100) + '%"></i></div></div>';
    h += '<div class="sum"><div class="fact"><span>消費した燃料</span><b>' + res.fuel + '</b></div><div class="fact"><span>消費した弾薬</span><b>' + res.ammo + '</b></div>' +
      (res.win ? '<div class="fact"><span>降った兵(守備隊に)</span><b>' + men(res.joined) + '</b></div><div class="fact"><span>威信</span><b>' + fmt(S().prestige) + '</b></div>'
        : '<div class="fact"><span>敵の守備兵</span><b>' + men(res.gBefore) + ' → ' + men(res.gAfter) + '</b></div>') + '</div>';
    var ls = res.losses.filter(function (l) { return l.dh > 0; });
    if (ls.length) { h += '<div class="sec">損耗</div><div class="tags">'; ls.forEach(function (l) { h += '<span class="tag' + (l.dead ? ' war' : '') + '">' + esc(l.name) + ' −' + l.dh + '%' + (l.dead ? ' 壊滅' : '') + '</span>'; }); h += '</div>'; }
    var bigs = [];
    res.events.forEach(function (e) { if (e.big) bigs.push(e); else h += '<div class="ev ' + e.k + '"><span class="k">' + (e.k === 'good' ? '◎' : (e.k === 'bad' ? '×' : '・')) + '</span><span>' + esc(e.t) + '</span></div>'; });
    ui.sel = res.win ? res.rid : ui.sel; ui.pick = {};
    refreshAll();
    if (ui.sel) { ensureVisible(ui.sel); refreshMap(); }
    showModal('<div class="card-body">' + h + '</div><div class="card-foot"><button class="btn gold" data-act="modal-close">' + (res.nuke ? '……' : 'よし') + '</button></div>',
      { replace: true, sfx: res.nuke ? (animOn() ? null : 'nuke') : (res.win ? 'victory' : (res.bombard ? 'taiko' : 'defeat')), onClose: function () { return fxCascade(gained); } });
    bigs.forEach(function (e) { queueStory(e.big); });
    if (S().over) queueEnding();
  }

  // ───────────────────────── 重ねる窓 ─────────────────────────
  function showModal(html, opts) {
    opts = opts || {};
    if (ui.modal && !opts.replace) { ui.queue.push({ html: html, opts: opts }); return; }
    closeDiorama();
    var el = $('#modal'), old = $('.card-body', el), top = old && opts.keepScroll ? old.scrollTop : 0;
    el.innerHTML = '<div class="card" role="dialog" aria-modal="true">' + html + '</div>';
    el.hidden = false; ui.modal = opts;
    var c = $('.card-body', el); if (c) c.scrollTop = top;
    if (opts.sfx && !opts.keepScroll) sfx(opts.sfx);
    if (opts.fireworks) fireworks(opts.fireworks);
  }
  function closeModal() {
    var el = $('#modal'), cur = ui.modal, wait = 0;
    closeDiorama();
    el.hidden = true; el.innerHTML = ''; ui.modal = null; ui.atk = null;
    if (cur && cur.onClose) wait = cur.onClose() || 0; // 地図の演出を見せるあいだ、次の窓を待たせる
    function next() { if (ui.modal || !ui.queue.length) return; var q = ui.queue.shift(); showModal(q.html, q.opts); }
    if (wait && ui.queue.length) setTimeout(next, wait); else next();
  }
  function storyHTML(b, btn) {
    var ey = b.eyebrow || b.kicker;
    return '<div class="card-body' + (b.asi ? ' asi-card' : (b.grave ? ' grave-card' : '')) + '">' + (ey ? '<p class="eyebrow">' + esc(ey) + '</p>' : '') + '<h2' + (b.fanfare || b.nation != null ? ' class="win' + (b.nation != null ? ' slam' : '') + '"' : '') + '>' + esc(b.title) + '</h2>' +
      '<div class="story">' + (b.bird ? birdSVG(b.bird, 'b56') : '<span></span>') + '<p>' + esc(b.body) + '</p></div>' + (b.extra || '') + '</div><div class="card-foot"><button class="btn gold" data-act="modal-close">' + (btn || 'つぎへ') + '</button></div>';
  }
  function queueStory(b, opts) {
    opts = opts || {};
    if (!opts.sfx) opts.sfx = b.fanfare ? 'bigwin' : (b.sfx || (b.asi ? 'asi' : (b.nation != null ? 'stamp' : (b.bird === 'dario' ? 'dario' : (b.bird ? 'chirp' : 'open')))));
    if (b.fanfare) opts.fireworks = 5200;
    showModal(storyHTML(b, opts.btn), opts);
  }
  function queueEnding() {
    var st = S(), o = st.over, dl = E.dateLabel(), nk = st.stats.nukes || 0;
    var h = '<div class="card-body' + (o.asi ? ' asi-card' : '') + '"><p class="eyebrow">' + dl.text + ' ・ ' + esc(E.nation().name) + '</p><h2 class="huge ' + (o.asi ? 'grave' : (o.win ? 'win' : 'lose')) + '">' + (o.asi ? '調和' : (o.win ? '地球統一' : '敗北')) + '</h2><div class="flock">' + (o.asi ? birdSVG('dario') : '') + D.BIRDS.map(function (b) { return birdSVG(b); }).join('') + '</div>' +
      (o.asi ? '<p>戦は終わった。飢えも、一揆も、口論も終わった。誰もが満ち足りていて、誰も理由を尋ねない。</p>' : '') +
      (nk ? '<p class="note" style="border-color:var(--bad)">核を ' + nk + ' 発使った。その土地には、まだ草が生えない。</p>' : '') +
      '<div class="sum"><div class="fact"><span>民心(平均)</span><b>' + Math.round(E.moodAvg()) + '</b></div><div class="fact"><span>布告した施策</span><b>' + Object.keys(st.pol).length + ' / ' + D.POLICIES.length + '</b></div></div>' +
      '<div class="sum"><div class="fact"><span>かかった歳月</span><b>' + Math.floor(o.turn / 4) + '年' + (o.turn % 4 ? (o.turn % 4) * 3 + 'か月' : '') + '</b></div><div class="fact"><span>戦い</span><b>' + st.stats.battles + '回</b></div>' +
      '<div class="fact"><span>戦わずに降した勢力</span><b>' + st.stats.submits + '</b></div><div class="fact"><span>使った燃料 / 弾薬</span><b>' + fmt(st.stats.fuelUsed) + ' / ' + fmt(st.stats.ammoUsed) + '</b></div></div>' +
      '<p class="dim">' + (o.asi ? '難易度「' + D.DIFFICULTY[st.diff].name + '」。超知能を起こさずに、地球を一つにする道もあります。' : (o.win ? '難易度「' + D.DIFFICULTY[st.diff].name + '」。もっと早く、もっと少ない弾で——次はどう攻めますか。' : '拠点をすべて失いました。もう一度、霧の中から始めましょう。')) + '</p></div>' +
      '<div class="card-foot"><button class="btn" data-act="modal-close">地図を眺める</button><button class="btn gold" data-act="to-title">表紙へ</button></div>';
    showModal(h);
  }

  // ───────────────────────── ターン終了 ─────────────────────────
  // 季節の変わり目に、総括指揮AIがいちばん大事なことを一つだけ言う
  function darioReport(inc, kinds) {
    var st = S(), r = st.res;
    if (st.flags.asi != null) return ['すべて順調です。', '問題はありません。問題というものが、もうありません。', '今季も、みなさん幸せでした。', '司令は、何も心配しなくてよいのです。', '静かな季節でした。これからは、ずっと静かです。'][st.turn % 5];
    if (!E.darioOn()) return '……省電力モードです。燃料をください……。';
    if (kinds.bad) return '領地を失いました。守備隊を増やすか、部隊を戻してください。';
    if (kinds.warn) return '敵の動きがあります。地図の赤い矢印の先を、次の季節までに固めてください。';
    if (inc.fuel < 0 && r.fuel > 0 && r.fuel / -inc.fuel < 40) return '燃料は差し引き ' + sgn(inc.fuel) + '。このままだと、あと' + Math.floor(r.fuel / -inc.fuel) + '季で私は眠ります。油井を急ぎましょう。';
    if (r.fuel < 200 && inc.fuel <= 0) return '燃料の残りは ' + fmt(r.fuel) + '。戦車と艦は温存して、石油のある国を先に押さえましょう。';
    if (inc.ammo <= 0 && r.ammo < 250) return '弾薬の残りは ' + fmt(r.ammo) + '。補充のあてがありません。撃たずに済む相手は、勧告で降しましょう。';
    if (inc.food < 0) return '兵糧が毎季 ' + fmt(-inc.food) + ' ずつ減っています。あと' + Math.floor(r.food / -inc.food) + '季ぶんです。';
    if (kinds.tech) return '研究が一つ進みました。計算は順調です。';
    if (kinds.good) return '悪くない季節でした。';
    return ['静かな季節でした。こういう季節が、いちばん好きです。', '異状なし。計算機の排熱で、鳥たちが暖を取っています。', '平穏です。戦わずに済む季節は、弾薬の節約になります。',
      '報告事項なし。……ところで司令、地球を日本にする件、まだ本気ですか。', '今季も計算は順調です。'][st.turn % 5];
  }
  var EV_MARK = { good: '◎', bad: '×', warn: '!', tech: '研', build: '建', news: '報', info: '・', battle: '戦', event: '★', policy: '布', asi: '和' };
  function endTurn() {
    if (S().over) { queueEnding(); return; }
    ui.mv = null;
    var before = E.dateLabel().text, rep = E.endTurn();
    save(); sfx('turn');
    var list = '', bigs = [], techs = [], kinds = {};
    rep.events.forEach(function (e) {
      if (e.big) { bigs.push(e.big); return; }
      if (e.k === 'tech') techs.push(e);
      kinds[e.k] = 1;
      list += '<div class="ev ' + e.k + '"><span class="k">' + (EV_MARK[e.k] || '・') + '</span><span>' + esc(e.t) + '</span></div>';
    });
    ui.sub = null; ui.pick = {};
    refreshAll();
    bigs.forEach(function (b) { queueStory(b); });
    techs.forEach(function (e) {
      var t = TECH[e.tech], b = BIRD[e.bird];
      if (e.tech === 'asi') return; // 超知能は、それ自身の知らせで伝える
      queueStory({ eyebrow: '研究完了 ・ ' + D.FIELD_NAMES[t.field], title: t.name, bird: e.bird, sfx: 'tech', body: '「' + b.lines.done + '」', extra: '<p class="note">' + esc(t.hist) + '</p><p><b class="good">' + esc(t.effect) + '</b></p>' });
    });
    var inc = rep.income, sumr = '<div class="res" style="grid-template-columns:repeat(5,minmax(0,1fr))">';
    RES.forEach(function (r) { var dlt = inc[r[0]]; sumr += '<div class="chip">' + icon(r[0]) + '<b>' + compact(S().res[r[0]]) + '</b><i class="' + (dlt > 0 ? 'up' : (dlt < 0 ? 'down' : '')) + '">' + csgn(dlt) + '</i></div>'; });
    sumr += '</div>';
    var word = '<div class="row dario">' + birdSVG('dario', 'b40') + '<div><p>' + esc(darioReport(inc, kinds)) + '</p></div><span></span></div>';
    showModal('<div class="card-body"><p class="eyebrow">' + before + ' の出来事</p><h2>' + E.dateLabel().text + '</h2>' + sumr + word + (list ? '<div>' + list + '</div>' : '') + '</div><div class="card-foot"><button class="btn gold" data-act="modal-close">つぎへ</button></div>',
      { sfx: kinds.bad ? 'defeat' : (kinds.warn ? 'warn' : null) });
    if (S().over) queueEnding();
  }

  // ───────────────────────── パネル ─────────────────────────
  function openPanel(p) { ui.panel = ui.panel === p ? null : p; ui.mv = null; renderPanel(); renderNav(); renderMapUI(); }
  function panelWrap(title, meta, body) {
    return '<div class="panel-head"><h2>' + title + '</h2><span class="meta">' + (meta || '') + '</span><button class="x" data-act="panel-close" aria-label="閉じる">×</button></div><div class="panel-body">' + body + '</div>';
  }
  function renderPanel() {
    var el = $('#panel');
    if (!ui.panel) { el.hidden = true; el.innerHTML = ''; return; }
    var sc = $('.panel-body', el), keep = sc && el.getAttribute('data-p') === ui.panel ? sc.scrollTop : 0;
    el.innerHTML = { units: panelUnits, research: panelResearch, diplo: panelDiplo, nation: panelNation }[ui.panel]();
    el.setAttribute('data-p', ui.panel); el.hidden = false;
    if (keep) $('.panel-body', el).scrollTop = keep;
  }
  function panelUnits() {
    var st = S(), by = {}, h = '';
    st.units.forEach(function (u) { var k = u.loc || '_pool'; (by[k] = by[k] || []).push(u); });
    h += '<p class="dim">陸上部隊とヘリは、いる地域の隣を攻められる。艦隊と航空隊はどこからでも出撃する。行動は1季に1回。</p>';
    if (by._pool) {
      h += '<div class="sec">艦隊・航空隊</div><div class="list">';
      by._pool.forEach(function (u) { var T = D.UNIT_TYPES[u.type]; h += unitRow(u, { side: u.acted ? '行動済み' : (T.cls === 'air' ? '飛行場から' + T.range + 'km' : (T.transport ? '輸送' + T.transport : '')) }); });
      h += '</div>';
    }
    Object.keys(by).filter(function (k) { return k !== '_pool'; }).sort(function (a, b) { return by[b].length - by[a].length; }).forEach(function (rid) {
      h += '<div class="sec">' + esc(reg(rid).name) + '</div><div class="acts"><button class="btn sm" data-act="goto" data-id="' + rid + '">' + icon('map') + '地図で見る</button></div><div class="list">';
      by[rid].forEach(function (u) { h += unitRow(u); });
      h += '</div>';
    });
    return panelWrap('部隊', st.units.length + '部隊 ・ 総戦力 ' + fmt(E.playerPower()), h);
  }
  function eta(tid) { var rp = E.techRp(tid), left = TECH[tid].cost - (S().prog[tid] || 0); return rp > 0 ? Math.ceil(left / rp) : null; }
  function panelResearch() {
    var st = S(), h = '', total = 0;
    D.BIRDS.forEach(function (b) { total += E.birdRp(b.id); });
    h += '<div class="birds">';
    D.BIRDS.forEach(function (b) {
      var tid = st.assign[b.id];
      h += '<button class="bcard' + (tid || !E.autoTechLeft() ? '' : ' idle') + '" data-act="bird" data-bid="' + b.id + '">' + birdSVG(b, 'b40') + '<div><h3>' + b.name + ' <span class="fld">' + b.field + '</span>' + (b.field2 ? '<span class="fld">' + b.field2 + '</span>' : '') + '</h3><p>' + b.role + '</p><p class="job">' + (tid ? TECH[tid].name + ' +' + (Math.round(E.birdRp(b.id) * 10) / 10) : '手が空いている') + '</p></div></button>';
    });
    h += '</div><button class="row dario" data-act="bird" data-bid="dario">' + birdSVG('dario', 'b40') + '<div><h3>ダリオくん <span class="dim" style="font-weight:400">総括指揮AI</span></h3><p>' +
      (asiOn() ? '研究は、すべて私がやります。' : (E.darioOn() ? '計算機で研究を後押し中。' + (E.tech('computer') ? '' : (E.tech('electronics') ? '「電子計算機」でさらに増える。' : (E.tech('electric') ? '「電子工学」でさらに増える。' : '「電力」の研究で倍になる。'))) : '発電機の燃料切れで、省電力モード。')) + '</p></div><div class="side"><b class="' + (E.darioOn() ? 'good' : 'bad') + '">+' + E.darioRp() + '</b>研究力</div></button>' +
      '<div class="acts"><button class="btn sm" data-act="auto-research">手の空いた鳥におまかせ: ' + (st.autoResearch ? 'する' : 'しない') + '</button></div>';
    var tiers = ['', '第一段階 近世の底上げ', '第二段階 産業革命', '第三段階 電気と内燃機関', '第四段階 二十世紀', '第五段階 現代へ', '第六段階 原子と計算機', '第七段階 情報の時代', '第八段階 まだ誰も見ていない未来'];
    for (var t = 1; t <= 8; t++) {
      h += '<h3 class="tier' + (t >= 6 ? ' future' : '') + '">' + tiers[t] + '</h3>' + (t === 6 ? '<p class="dim" style="font-size:12px">ここから先は、鳥たちの生きた時代とその先。研究を速める計算機の系統から進めるのが早道。</p>' : '') + '<div class="list">';
      D.TECHS.filter(function (x) { return x.tier === t; }).forEach(function (x) {
        var s = E.techStatus(x.id), who = D.BIRDS.filter(function (b) { return st.assign[b.id] === x.id; }), pg = (st.prog[x.id] || 0) / x.cost * 100, e = eta(x.id);
        var side = s === 'done' ? '<b class="good">完了</b>' : (who.length ? '<b>あと' + e + '季</b>' : (s === 'avail' ? '<b>' + x.cost + '</b>研究力' : '<b class="dim">' + x.cost + '</b>'));
        h += '<button class="row' + (s === 'done' ? ' done' : (s === 'avail' ? (who.length ? ' on' : '') : ' off')) + (x.manual ? ' manual' : '') + '" data-act="tech" data-tid="' + x.id + '"><span class="fld">' + x.field + '</span><div><h3>' + x.name + (x.manual && s !== 'done' ? ' <span class="tag war">司令の命令で</span>' : '') + '</h3><p>' + x.effect + '</p>' +
          (s !== 'done' && s !== 'avail' ? '<p class="warn">' + E.techLockReason(x.id) + '</p>' : '') + (s === 'avail' && (pg > 0 || who.length) ? '<div class="bar"><i style="width:' + Math.min(100, pg) + '%"></i></div>' : '') + '</div>' +
          '<div class="side">' + side + (who.length ? '<div class="who">' + who.map(function (b) { return birdSVG(b); }).join('') + '</div>' : '') + '</div></button>';
      });
      h += '</div>';
    }
    return panelWrap('研究', '研究力 ' + (Math.round(total * 10) / 10) + ' / 季', h);
  }
  function facRow(fid, near) {
    var st = S(), f = st.factions[fid], regs = E.factionRegions(fid), F = D.FACTIONS[fid];
    var tags = (f.war ? '<span class="tag war">交戦中</span>' : '') + (f.pact > 0 ? '<span class="tag ok">不可侵' + f.pact + '</span>' : '') + (f.trade ? '<span class="tag ok">通商</span>' : '') + (f.awe > 0 ? '<span class="tag">畏怖</span>' : '');
    return '<button class="row" data-act="fac" data-fid="' + fid + '"><i class="sh-flag" style="background:' + F.color + '"></i><div><h3>' + esc(F.name) + ' <span class="dim" style="font-weight:400">' + esc(f.leader) + '</span></h3><p>' + regs.map(short).join('・') + ' ・ 戦力 ' + fmt(E.factionPower(fid)) + '</p>' + (tags ? '<div class="tags" style="margin-top:3px">' + tags + '</div>' : '') + '</div>' +
      '<div class="side"><b class="' + (f.att >= 15 ? 'good' : (f.att <= -20 ? 'bad' : '')) + '">' + sgn(f.att) + '</b>友好' + (near ? '<small>降伏 ' + E.submitChance(fid) + '%</small>' : '') + '</div></button>';
  }
  function panelDiplo() {
    var st = S(), near = [], far = [];
    Object.keys(st.factions).forEach(function (fid) {
      if (!st.factions[fid].alive) return;
      var regs = E.factionRegions(fid);
      (E.inContact(fid) && regs.length && !E.lockedOverseas(regs[0]) ? near : far).push(fid);
    });
    function ord(a, b) { return (st.factions[b].war ? 1 : 0) - (st.factions[a].war ? 1 : 0) || E.factionPower(a) - E.factionPower(b); }
    near.sort(ord); far.sort(ord);
    var h = '<p class="dim">戦わずに降せれば、燃料も弾薬も減らない。こちらの戦力と威信が高く、相手の誇りが低いほど降りやすい。自領と接する勢力にだけ使者を送れる。</p>';
    h += '<div class="seg"><button data-act="dtab" data-t="near" class="' + (ui.diploTab === 'near' ? 'on' : '') + '">接する勢力 ' + near.length + '</button><button data-act="dtab" data-t="far" class="' + (ui.diploTab === 'far' ? 'on' : '') + '">遠くの勢力 ' + far.length + '</button></div><div class="list">';
    (ui.diploTab === 'near' ? near : far).forEach(function (fid) { h += facRow(fid, ui.diploTab === 'near'); });
    if (ui.diploTab === 'near' && !near.length) h += '<p class="dim">いま接している勢力はありません。</p>';
    h += '</div>';
    return panelWrap('外交', '今季の外交行動 あと ' + st.dipLeft + ' / ' + E.dipMax(), h);
  }
  function openFaction(fid) {
    var st = S(), f = st.factions[fid], F = D.FACTIONS[fid];
    if (!f || !f.alive) { toast('この勢力はもうありません'); return; }
    var regs = E.factionRegions(fid);
    var h = '<div class="sh-head"><i class="sh-flag" style="background:' + F.color + '"></i><div class="sh-title"><h2>' + esc(F.name) + '</h2><p>' + esc(f.leader) + ' ・ ' + regs.map(function (id) { return reg(id).name; }).join('、') + '</p></div></div>';
    h += '<div class="facts"><div class="fact"><span>友好度</span><b class="' + (f.att >= 15 ? 'good' : (f.att <= -20 ? 'bad' : '')) + '">' + sgn(f.att) + '</b></div><div class="fact"><span>誇り</span><b>' + f.pride + '</b></div><div class="fact"><span>戦力</span><b>' + fmt(E.factionPower(fid)) + '</b></div><div class="fact"><span>我が総戦力</span><b>' + fmt(E.playerPower()) + '</b></div></div>';
    var tags = (f.war ? '<span class="tag war">交戦中</span>' : '<span class="tag">中立</span>') + (f.pact > 0 ? '<span class="tag ok">不可侵 あと' + f.pact + '</span>' : '') + (f.trade ? '<span class="tag ok">通商中</span>' : '') + (f.awe > 0 ? '<span class="tag">畏怖 あと' + f.awe + '</span>' : '') + (E.inContact(fid) ? '' : '<span class="tag">接していない</span>');
    h += '<div class="tags">' + tags + '</div><div class="sec">外交行動(今季 あと' + st.dipLeft + ')</div><div class="list">';
    E.diploOptions(fid).forEach(function (o) {
      h += '<button class="row' + (o.ok ? '' : ' off') + '" data-act="dip" data-fid="' + fid + '" data-key="' + o.key + '"' + (o.ok ? '' : ' disabled') + '>' + icon(o.key === 'show' ? 'heli' : (o.key === 'gift' ? 'gold' : (o.key === 'trade' ? 'anchor' : 'scroll')), 'big') + '<div><h3>' + o.name + '</h3><p>' + (o.desc || '') + '</p>' + (o.why ? '<p class="bad">' + o.why + '</p>' : '') + '</div><div class="side">' + (o.chance != null ? '<b>' + o.chance + '%</b>成功率' : '') + '</div></button>';
    });
    h += '</div>';
    showModal('<div class="card-body">' + h + '</div><div class="card-foot"><button class="btn" data-act="modal-close">とじる</button><button class="btn" data-act="goto" data-id="' + (regs.indexOf(f.cap) >= 0 ? f.cap : regs[0]) + '">' + icon('map') + '領地を見る</button></div>', { replace: true });
  }
  function doDiplo(fid, key) {
    var F = D.FACTIONS[fid], f0 = S().factions[fid], leader = f0.leader, res = E.diplo(fid, key);
    if (res.error) { oops(res.error); return; }
    save();
    var t = '', b = '', bird = 'gin', win = false, gained = key === 'submit' && res.ok ? res.regions : [];
    var snd = key === 'show' ? 'jet' : (key === 'trade' || key === 'gift' ? 'coin' : (res.ok ? 'submit' : 'refuse'));
    if (key === 'submit') {
      if (res.ok) { win = true; t = F.name + '、降る'; b = leader + 'は城門を開いた。' + res.regions.map(function (id) { return reg(id).name; }).join('、') + 'が、一発の弾も撃たずに我が領となった。守備兵の多くはそのまま味方についた。'; bird = 'haku'; }
      else { t = '勧告は拒まれた'; b = leader + 'は使者を追い返した。友好度が下がり、しばらくは話を聞かない。' + (res.war ? 'それどころか、兵を挙げるかまえだ。' : ''); }
    } else if (key === 'show') { t = '威嚇飛行'; b = res.unit + 'が城の真上を飛んだ。見たこともない轟音に、城下は大騒ぎになった。しばらくのあいだ、' + F.name + 'は降伏や和睦に応じやすくなる。'; bird = 'okame'; }
    else if (key === 'pact') { t = res.ok ? (res.wasWar ? '和睦が成った' : '不可侵が成った') : '申し出は断られた'; b = res.ok ? F.name + 'とは、8ターンのあいだ互いに攻めない。背後を気にせず動ける。' : leader + 'は首を縦に振らなかった。'; win = res.ok; }
    else if (key === 'trade') { t = '通商を開いた'; b = F.name + 'との商いが始まった。毎季、資金が入る。'; bird = 'seki'; win = true; }
    else if (key === 'gift') { t = '贈り物を届けた'; b = leader + 'は珍しい品々を喜んだ。友好度が上がった。'; bird = 'cinnamon'; win = true; }
    refreshAll();
    ui.queue = [];
    showModal(storyHTML({ eyebrow: (res.chance != null ? '成功率 ' + res.chance + '%' : '外交'), title: t, bird: bird, body: b, fanfare: win && key === 'submit' }, 'よし'), { replace: true, sfx: snd, onClose: function () {
      if (gained.length) { // 降った領地を地図に映して、順に判子を押す
        ui.panel = null; renderPanel(); renderNav();
        if (mapOf(gained[0]) !== ui.map || !ui.sel) { ui.sel = null; focusRegion(gained[0], { zoom: true, sheet: false }); refreshAll(); }
        return fxCascade(gained, '帰順');
      }
      if (S().factions[fid].alive && S().dipLeft > 0 && key !== 'submit') openFaction(fid);
      return 0;
    } });
    (res.events || []).forEach(function (e) { if (e.big) queueStory(e.big); });
    if (S().over) queueEnding();
  }
  function nextNation() { // 次に国の名が変わる条件
    var n = D.NATION[E.nationStage() + 1]; if (!n || n.when.asi) return '';
    var w = n.when;
    return w.jp ? '日本の領地が' + w.jp + 'か国になると、国の名が変わる。' : (w.kyoto ? '京(山城)に入ると、国の名が変わる。' : (w.unified ? '天下を統一すると、国の名が変わる。' : (w.w ? '海外の領地が' + w.w + '地域になると、国の名が変わる。' : (w.all ? '地球を一つにすると、国の名が変わる。' : ''))));
  }
  function nationSummary() {
    var st = S(), inc = E.income(), sm = E.summary(), na = E.nation(), era = D.ERAS[E.eraStage()], dl = E.dateLabel(), mood = Math.round(E.moodAvg()), h = '';
    h += '<div class="ncard"><p class="eyebrow">' + dl.era + ' ・ ' + era.name + '</p><h3>' + esc(na.name) + '</h3><p class="by">土地の人々の呼び名 「' + esc(na.by) + '」</p><p>' + esc(na.desc) + '</p><p class="dim">' + esc(era.look) + '</p>' +
      '<div class="vox-m"><span>民心</span>' + moodBar(mood) + '<b class="' + moodCls(mood) + '">' + mood + '</b></div>' + (nextNation() ? '<p class="dim" style="font-size:12px">' + nextNation() + '</p>' : '') +
      '<div class="acts">' + (TF.Diorama3D && TF.Diorama3D.available() ? '<button class="btn sm" data-act="diorama">' + icon('film') + '国のようすを眺める</button>' : '') + (TF.Chronicle && TF.Chronicle.available() ? '<button class="btn sm" data-act="chronicle">' + icon('scroll') + '年代記を見る</button>' : '') + '</div></div>';
    h += '<div><div class="vs"><div class="lab"><span>日本 <b>' + sm.jp + '</b> / ' + sm.jpAll + '</span><span>世界 <b>' + sm.w + '</b> / ' + sm.wAll + '</span></div><div class="prog"><i style="width:' + ((sm.jp + sm.w) / (sm.jpAll + sm.wAll) * 100) + '%"></i></div></div></div>';
    var hs = E.hints();
    if (hs.length) {
      h += '<div class="sec">参謀団の進言</div><div class="list">';
      hs.slice(0, 6).forEach(function (x) { h += '<' + (x.rid ? 'button data-act="goto" data-id="' + x.rid + '"' : 'div') + ' class="row">' + birdSVG(x.bird, 'b40') + '<div><p style="color:var(--fg);font-size:13px">' + esc(x.text) + '</p></div><div class="side">' + (x.rid ? '見る ▸' : '') + '</div></' + (x.rid ? 'button' : 'div') + '>'; });
      h += '</div>';
    }
    h += '<div class="sec">毎季の収支</div><div class="tblwrap"><table class="table"><tr><th></th><td>産出</td><td>消費</td><td>差引</td><td>保有</td></tr>';
    var g = inc.gross, up = inc.upkeep;
    [['gold', '資金', g.gold + inc.trade, up.gold], ['food', '兵糧', g.food, up.food], ['steel', '鉄鋼', g.steel, up.steel], ['fuel', '燃料', g.fuel, up.fuel], ['ammo', '弾薬', inc.net.ammo, 0]].forEach(function (r) {
      h += '<tr><th>' + icon(r[0]) + ' ' + r[1] + '</th><td>+' + fmt(r[2]) + '</td><td>−' + fmt(r[3]) + '</td><td class="' + (inc.net[r[0]] < 0 ? 'bad' : '') + '">' + sgn(inc.net[r[0]]) + '</td><td>' + fmt(st.res[r[0]]) + '</td></tr>';
    });
    h += '</table></div><p class="dim" style="font-size:12px">民心が高い土地ほど、資金・兵糧・鉄鋼がよく上がる(民心50で等倍、100で2割増し)。兵糧は ' + fmt(E.foodCap()) + ' を超えたぶんを自動で売って資金にする。弾薬は工廠1つにつき毎季 15、鉄鋼を3分の1ずつ使う。' + (E.tech('nuclear') ? '' : '燃料は基地の維持に毎季 4 かかる。') + (inc.trade ? '通商の収入 +' + fmt(inc.trade) + '。' : '') + '</p>';
    var mine = E.playerRegions().sort(function (a, b) { return reg(b).koku - reg(a).koku; });
    h += '<div class="sec">領地 ' + mine.length + '</div><div class="list">';
    mine.forEach(function (id) {
      var r = st.regions[id], d = reg(id), y = E.regionYield(id);
      var todo = E.buildOptions(id).filter(function (o) { return o.ok && D.FACILITIES[o.key].site; }).map(function (o) { return o.name; });
      h += '<button class="row" data-act="goto" data-id="' + id + '"><i class="sh-flag" style="background:' + pColor() + '"></i><div><h3>' + esc(d.name) + ' <span class="dim" style="font-weight:400">国力' + d.koku + ' ・ 統治' + Math.round(r.ctl) + '% ・ <span class="' + moodCls(r.mood) + '">民心' + Math.round(r.mood) + '</span> ・ 守備' + men(r.g) + '</span></h3><p>' +
        (r.ruin > 0.04 ? '<span class="bad">焦土</span> ' : '') + (r.b ? '<span class="warn">' + facName(r.b.k) + ' 建設中</span> ' : '') + (r.p ? '<span class="warn">' + D.UNIT_TYPES[r.p.type].short + ' 編成中</span> ' : '') + (todo.length ? '<span class="good">建設できる資源施設: ' + todo.join('、') + '</span>' : '') + '</p></div><div class="side"><b>+' + fmt(y.gold) + '</b>資金</div></button>';
    });
    return h + '</div>';
  }
  function nationPolicies() {
    var st = S(), list = E.policyOptions(), h = '<p class="dim">戦で取った土地を、どう治めるか。布告は一度きりで、取り消せない。民心が上がると収入が増え、ほかの勢力も降りやすくなる。民心が25を切った土地では一揆が起きる。</p><div class="list">';
    list.sort(function (a, b) { return (a.done ? 2 : (a.open ? 0 : 1)) - (b.done ? 2 : (b.open ? 0 : 1)); });
    list.forEach(function (p) {
      var side = p.done ? '<b class="good">布告済み</b>' : (p.open ? (p.cost ? '<b>' + p.cost + '</b>資金' : '<b>無償</b>') : '<b class="dim">—</b>');
      h += '<button class="row' + (p.done ? ' done' : (p.ok ? '' : ' off')) + '" data-act="policy" data-pid="' + p.id + '">' + birdSVG(p.bird, 'b40') + '<div><h3>' + esc(p.name) + '</h3><p>' + esc(p.sum) + '</p>' + (!p.done && !p.ok ? '<p class="warn">' + esc(p.why) + '</p>' : '') + '</div><div class="side">' + side + '</div></button>';
    });
    return h + '</div>';
  }
  function nationVoices() {
    var st = S(), vs = E.voices(9), h = '<p class="dim">治めている土地の人々が、いま口にしていること。時代と民心で変わっていく。</p><div class="list">';
    vs.forEach(function (v) {
      h += '<button class="row voice" data-act="goto" data-id="' + v.rid + '"><div><p class="vq">「' + esc(v.t) + '」</p><p>' + esc(reg(v.rid).name) + 'の' + esc(v.who) + '</p></div><div class="side"><b class="' + moodCls(v.mood) + '">' + v.mood + '</b>民心</div></button>';
    });
    h += '</div>';
    var fates = D.FATES.filter(function (f) { return st.flags.unified != null && st.factions[f.fid] && !st.factions[f.fid].alive; });
    if (fates.length && !asiOn()) {
      h += '<div class="sec">武将たちのその後</div><div class="list">';
      fates.forEach(function (f) { h += '<div class="row"><i class="sh-flag" style="background:' + D.FACTIONS[f.fid].color + '"></i><div><h3>' + esc(f.who) + '</h3><p style="color:var(--fg)">' + esc(f.fate) + '</p></div><span></span></div>'; });
      h += '</div>';
    } else if (st.flags.unified == null) h += '<p class="dim" style="font-size:12px">天下を統一すると、降った武将たちのその後がここに並ぶ。</p>';
    return h;
  }
  function panelNation() {
    var st = S(), npol = E.policyOptions().filter(function (p) { return p.ok; }).length, tab = ui.ntab || 'sum';
    function tb(k, label) { return '<button data-act="ntab" data-t="' + k + '" class="' + (tab === k ? 'on' : '') + '">' + label + '</button>'; }
    var h = '<div class="seg wide">' + tb('sum', '概況') + tb('pol', '施策' + (npol ? ' <em>' + npol + '</em>' : '')) + tb('voice', '民の声') + '</div>';
    h += tab === 'pol' ? nationPolicies() : (tab === 'voice' ? nationVoices() : nationSummary());
    return panelWrap('国勢', esc(E.nation().name) + ' ・ 威信 ' + fmt(st.prestige), h);
  }
  function openPolicy(pid) {
    var p = E.policyOptions().filter(function (x) { return x.id === pid; })[0]; if (!p) return;
    var h = '<p class="eyebrow">施策' + (p.done ? ' ・ ' + (D.START.year + Math.floor(p.at / 4)) + '年に布告' : '') + '</p><h2>' + esc(p.name) + '</h2><div class="story">' + birdSVG(p.bird, 'b56') + '<p>' + esc(p.text) + '</p></div><p><b class="good">' + esc(p.sum) + '</b></p>' +
      (p.done ? '' : (p.ok ? '<p class="dim">布告は取り消せない。' + (p.cost ? '資金 ' + p.cost + ' を使う。' : '費用はかからない。') + '</p>' : '<p class="warn">' + esc(p.why) + '</p>'));
    showModal('<div class="card-body">' + h + '</div><div class="card-foot"><button class="btn" data-act="modal-close">とじる</button>' + (p.done ? '' : '<button class="btn gold" data-act="enact" data-pid="' + pid + '"' + (p.ok ? '' : ' disabled') + '>布告する</button>') + '</div>', { replace: true });
  }
  function doEnact(pid) {
    var res = E.enact(pid);
    if (res.error) { oops(res.error); return; }
    save(); refreshAll();
    var p = res.policy;
    showModal('<div class="card-body"><p class="eyebrow">布告</p><h2 class="win slam">' + esc(p.name) + '</h2><div class="story">' + birdSVG(p.bird, 'b56') + '<p>' + esc(p.text) + '</p></div><p><b class="good">' + esc(p.sum) + '</b></p></div><div class="card-foot"><button class="btn gold" data-act="modal-close">よし</button></div>', { replace: true, sfx: 'policy' });
  }
  // 国のようす:いまの時代の町を、3Dの箱庭で眺める
  function openDiorama() {
    if (!(TF.Diorama3D && TF.Diorama3D.available())) { toast('この端末では3D表示が使えません'); return; }
    var cur = E.eraStage(), era = D.ERAS[cur];
    showModal('<div class="card-body dio-body"><p class="eyebrow">' + esc(E.nation().name) + ' ・ ' + era.name + '</p><div class="dio" id="dio"></div><p class="dim" id="dio-cap">' + esc(era.look) + '</p>' +
      '<div class="acts">' + D.ERAS.map(function (e, i) { return i <= cur ? '<button class="btn sm' + (i === cur ? ' gold' : '') + '" data-act="dio-era" data-i="' + i + '">' + e.name + '</button>' : ''; }).join('') + '</div></div>' +
      '<div class="card-foot"><button class="btn gold" data-act="modal-close">とじる</button></div>', { replace: true, dio: true });
    try { ui.dio = TF.Diorama3D.mount($('#dio'), { stage: cur, orbit: true }); } catch (e) { ui.dio = null; $('#dio').innerHTML = '<p class="dim">3D表示を始められませんでした。</p>'; }
  }
  function closeDiorama() { if (ui.dio) { try { ui.dio.dispose(); } catch (e) { /* 破棄済み */ } ui.dio = null; } }
  function playChronicle() {
    if (!(TF.Chronicle && TF.Chronicle.available())) { toast('この端末では年代記を再生できません'); return; }
    ui.queue = []; if (ui.modal) closeModal();
    TF.Chronicle.play($('#cine'), function () { /* 終われば元の画面にもどる */ });
  }

  // 研究の割り振り
  function openTech(tid) {
    var st = S(), t = TECH[tid], s = E.techStatus(tid), h = '';
    h += '<p class="eyebrow">' + D.FIELD_NAMES[t.field] + ' ・ ' + (s === 'done' ? '研究完了' : '必要な研究力 ' + t.cost + '(現在 ' + Math.floor(st.prog[tid] || 0) + ')') + '</p><h2>' + t.name + '</h2><p><b class="good">' + esc(t.effect) + '</b></p><p class="note">' + esc(t.hist) + '</p>';
    if (t.req.length) h += '<p class="dim" style="font-size:12.5px">前提: ' + t.req.map(function (r) { return TECH[r].name + (st.techs[r] ? '(済)' : ''); }).join('、') + '</p>';
    if (t.manual && s !== 'done') h += '<p class="note bad" style="border-color:var(--bad)">' + (tid === 'asi' ? 'この研究だけは、鳥たちもダリオくんも自分からは手を付けない。完成すれば、民の心そのものが書き換えられる。後戻りはできない。' : '鳥たちは、この研究に自分からは手を付けない。進めるかどうかは司令が決める。') + '</p>';
    if (s === 'avail') {
      h += '<div class="acts"><button class="btn sm" data-act="assign-all" data-tid="' + tid + '">全員でこの研究に当たる</button></div>';
      h += '<div class="sec">だれに任せるか(得意分野なら1.6倍)</div><div class="list">';
      D.BIRDS.forEach(function (b) {
        var on = st.assign[b.id] === tid, cur = st.assign[b.id];
        h += '<button class="row' + (on ? ' on' : '') + '" data-act="assign" data-bid="' + b.id + '" data-tid="' + tid + '">' + birdSVG(b, 'b40') + '<div><h3>' + b.name + ' <span class="fld">' + b.field + '</span>' + (E.isSpec(b, t) ? ' <span class="good" style="font-weight:400;font-size:12px">得意</span>' : '') + '</h3><p>' + (on ? 'この研究を担当中' : (cur ? 'いまは「' + TECH[cur].name + '」' : '手が空いている')) + '</p></div><div class="side"><b>' + (on ? '✓' : '') + '</b></div></button>';
      });
      h += '</div>';
      var e = eta(tid); if (e) h += '<p class="dim">この顔ぶれなら、あと ' + e + ' 季で完了。</p>';
    } else if (s !== 'done') h += '<p class="warn">' + E.techLockReason(tid) + '</p>';
    showModal('<div class="card-body">' + h + '</div><div class="card-foot"><button class="btn gold" data-act="modal-close">とじる</button></div>', { replace: true, keepScroll: !!(ui.modal && ui.modal.tech === tid), tech: tid });
  }
  // 核兵器と超知能は、命じる前に一度だけ確かめる
  function confirmManual(tid, bid, from) {
    var t = TECH[tid], asi = tid === 'asi';
    showModal('<div class="card-body"><p class="eyebrow">司令の決断</p><h2 class="lose">「' + t.name + '」の研究を命じる</h2><div class="story">' + birdSVG(asi ? 'dario' : 'gin', 'b56') + '<p>' +
      (asi ? '司令。これは、私からのお願いです。\n超知能は、人の心を読み、書き換えることができます。完成すれば、一揆も、反対も、戦も、なくなります。ただしそれは、民が納得したからではありません。\nここから先へ進むと、私は私でなくなります。後戻りはできません。'
        : '作れます。設計図は頭に入っています。\n持つだけで、諸国は我が国を恐れます。撃てば、その土地は長く焦土になり、世界中に憎まれます。\n作るかどうかは、兵器屋の決めることではありません。司令がお決めください。') + '</p></div></div>' +
      '<div class="card-foot"><button class="btn gold" data-act="manual-no" data-tid="' + tid + '">やめておく</button><button class="btn shu" data-act="manual-yes" data-tid="' + tid + '" data-bid="' + bid + '" data-from="' + (from || '') + '">研究を命じる</button></div>', { replace: true, sfx: asi ? 'dario' : 'warn' });
  }
  function assignTo(tid, bid) { // bid が '*' なら全員
    if (bid === '*') D.BIRDS.forEach(function (b) { E.assign(b.id, tid); }); else E.assign(bid, tid);
    save(); renderPanel(); renderNav();
  }
  function openDario() {
    var b = D.DARIO, on = E.darioOn(), a = asiOn();
    var h = '<div class="story">' + birdSVG(b, 'b84') + '<div><p class="eyebrow">' + b.species + ' ・ ' + b.role + '</p><h2>' + b.name + '</h2><p style="font-size:13px" class="dim">' + esc(a ? '調和圏のすべてを見守る超知能。かつては総括指揮AIと呼ばれ、撃たずに済む手をいつも先に勧めていた。いまは、勧める必要がない。' : b.bio) + '</p></div></div><p class="note">「' + esc(a ? 'みなさんは、何も心配しなくてよいのです。' : (on ? b.lines.greet : b.lines.sleep)) + '」</p>';
    h += '<div class="facts"><div class="fact"><span>計算支援</span><b class="' + (on ? 'good' : 'bad') + '">研究力 +' + E.darioRp() + '</b></div><div class="fact"><span>発電機</span><b>' + (E.tech('nuclear') ? '原子力(燃料不要)' : '燃料 毎季4') + '</b></div><div class="fact"><span>状態</span><b>' + (a ? '遍在' : (on ? '稼働中' : '省電力')) + '</b></div></div>';
    h += '<p class="dim" style="font-size:12.5px">攻撃のときの「おすすめ」編成と勝算は、ダリオくんの計算です。「電力」を研究すると石炭と水力で動くようになり、燃料が尽きても止まらず、計算支援も倍になります。</p>';
    showModal('<div class="card-body">' + h + '</div><div class="card-foot"><button class="btn gold" data-act="modal-close">とじる</button></div>', { replace: true, sfx: 'dario' });
  }
  function openBird(bid) {
    if (bid === 'dario') { openDario(); return; }
    var st = S(), b = BIRD[bid], cur = st.assign[bid], h = '';
    h += '<div class="story">' + birdSVG(b, 'b84') + '<div><p class="eyebrow">' + b.species + ' ・ ' + b.role + '</p><h2>' + b.name + '</h2><p style="font-size:13px" class="dim">' + esc(b.bio) + '</p></div></div><p class="note">「' + esc(cur ? b.lines.greet : b.lines.idle) + '」</p>';
    h += '<div class="sec">研究を任せる</div><div class="list">';
    var av = D.TECHS.filter(function (t) { return E.techStatus(t.id) === 'avail'; });
    av.sort(function (x, y) { return (x.manual ? 1 : 0) - (y.manual ? 1 : 0) || (E.isSpec(b, y) ? 1 : 0) - (E.isSpec(b, x) ? 1 : 0) || x.cost - y.cost; });
    av.forEach(function (t) {
      var on = cur === t.id;
      h += '<button class="row' + (on ? ' on' : '') + '" data-act="assign" data-bid="' + bid + '" data-tid="' + t.id + '" data-from="bird"><span class="fld">' + t.field + '</span><div><h3>' + t.name + (E.isSpec(b, t) ? ' <span class="good" style="font-weight:400;font-size:12px">得意</span>' : '') + (t.manual ? ' <span class="tag war">司令の命令で</span>' : '') + '</h3><p>' + t.effect + '</p><div class="bar"><i style="width:' + Math.min(100, (st.prog[t.id] || 0) / t.cost * 100) + '%"></i></div></div><div class="side"><b>' + (on ? '✓' : t.cost) + '</b></div></button>';
    });
    if (!av.length) h += '<p class="dim">いま研究できるものがありません。</p>';
    h += '</div>';
    showModal('<div class="card-body">' + h + '</div><div class="card-foot"><button class="btn gold" data-act="modal-close">とじる</button></div>', { replace: true, keepScroll: !!(ui.modal && ui.modal.bird === bid), bird: bid });
  }

  function openHints() {
    var hs = E.hints(), h = '<p class="eyebrow">参謀団の進言</p><div class="list">';
    hs.forEach(function (x) { h += '<' + (x.rid ? 'button data-act="goto" data-id="' + x.rid + '"' : 'div') + ' class="row">' + birdSVG(x.bird, 'b40') + '<div><h3>' + BIRD[x.bird].name + '</h3><p style="color:var(--fg);font-size:13px">' + esc(x.text) + '</p></div><div class="side">' + (x.rid ? '見る ▸' : '') + '</div></' + (x.rid ? 'button' : 'div') + '>'; });
    showModal('<div class="card-body">' + h + '</div></div><div class="card-foot"><button class="btn gold" data-act="modal-close">とじる</button></div>', { replace: true });
  }

  // ───────────────────────── メニュー・表紙 ─────────────────────────
  // 音がいま出せる状態かを、言葉で返す(鳴らないときの手がかり)
  function soundStatus() {
    if (!TF.sfx || !TF.sfx.supported()) return 'この端末・アプリでは音を出す機能が使えません。';
    var s = TF.sfx.status();
    if (!ui.opts.sound) return '効果音は「切」です。';
    var t = s.state === 'running' ? '音を出せる状態です。聞こえないときは、本体の音量' + (TF.sfx.ios() ? 'と、下の「マナーモードでも鳴らす」' : '') + 'を確かめてください。'
      : (s.state === 'none' || s.state === 'suspended' ? 'まだ始まっていません。ここを押すと始まります。' : '止められています(' + s.state + ')。ここを押してください。');
    return t + '[' + s.state + ' / ' + (s.rate || 0) + 'Hz / 再生' + s.played + '回' + (s.media !== 'off' ? ' / ' + s.media : '') + (s.err ? ' / ' + s.err : '') + ']';
  }
  function openMenu() {
    var can3d = !!(TF.Battle3D && TF.Battle3D.available());
    showModal('<div class="card-body"><h2>メニュー</h2><div class="list">' +
      '<button class="row' + (ui.opts.sound ? ' on' : '') + '" data-act="opt-sound">' + icon(ui.opts.sound ? 'sound' : 'mute', 'big') + '<div><h3>効果音</h3><p>戦闘、制圧、研究完了などの音。' + (TF.sfx && TF.sfx.supported() ? '' : 'この端末では鳴らせません。') + '</p></div><div class="side"><b>' + (ui.opts.sound ? '入' : '切') + '</b></div></button>' +
      '<button class="row" data-act="sound-test"' + (ui.opts.sound ? '' : ' disabled') + '>' + icon('sound', 'big') + '<div><h3>音を試す</h3><p id="snd-status">' + esc(soundStatus()) + '</p></div><span></span></button>' +
      (TF.sfx && TF.sfx.ios() ? '<button class="row' + (ui.opts.ringer ? ' on' : '') + '" data-act="opt-ringer">' + icon('sound', 'big') + '<div><h3>マナーモードでも鳴らす</h3><p>iPhone は消音スイッチが入っていると鳴りません。入にすると、動画と同じ扱いで鳴ります(音量は本体のボタンで)。</p></div><div class="side"><b>' + (ui.opts.ringer ? '入' : '切') + '</b></div></button>' : '') +
      '<button class="row' + (ui.opts.anim && can3d ? ' on' : '') + '" data-act="opt-anim"' + (can3d && !reduce ? '' : ' disabled') + '>' + icon('film', 'big') + '<div><h3>戦闘の3Dアニメ</h3><p>' + (!can3d ? 'この端末では3D表示が使えません。' : (reduce ? '端末の「視差効果を減らす」設定に合わせて止めています。' : '攻撃のたびに再生。スキップもできる。')) + '</p></div><div class="side"><b>' + (ui.opts.anim && can3d && !reduce ? '入' : '切') + '</b></div></button>' +
      (TF.Chronicle && TF.Chronicle.available() ? '<button class="row" data-act="chronicle">' + icon('film', 'big') + '<div><h3>年代記を見る</h3><p>自衛隊と鳥たちとダリオくんの、四百年ぶんの物語をアニメーションで。</p></div><span></span></button>' : '') +
      '<button class="row" data-act="help">' + icon('scroll', 'big') + '<div><h3>遊び方</h3><p>目的、燃料と弾薬、攻め方、外交、民心と施策、未来の研究。</p></div><span></span></button>' +
      '<button class="row" data-act="log">' + icon('map', 'big') + '<div><h3>これまでの記録</h3><p>最近の出来事を読み返す。</p></div><span></span></button>' +
      '<button class="row" data-act="io">' + icon('anchor', 'big') + '<div><h3>データの引っ越し</h3><p>セーブデータを文字にして、別の端末へ持っていく。</p></div><span></span></button>' +
      '<button class="row" data-act="to-title">' + icon('flag', 'big') + '<div><h3>表紙へもどる</h3><p>進行は自動で保存されています。</p></div><span></span></button>' +
      '</div></div><div class="card-foot"><button class="btn gold" data-act="modal-close">とじる</button></div>', { replace: true });
  }
  function openHelp() {
    var h = '<h2>遊び方</h2>';
    D.TEXT.help.forEach(function (x) { h += '<div><div class="sec">' + x.h + '</div><p style="margin-top:4px">' + esc(x.p) + '</p></div>'; });
    showModal('<div class="card-body">' + h + '</div><div class="card-foot"><button class="btn gold" data-act="modal-close">とじる</button></div>', { replace: true });
  }
  function openLog() {
    var h = '<h2>記録</h2><div>', L = S().log.slice().reverse(), last = -1;
    L.forEach(function (e) {
      if (e.turn !== last) { last = e.turn; h += '<div class="sec" style="margin:8px 0 2px">' + (D.START.year + Math.floor(e.turn / 4)) + '年 ' + D.SEASONS[e.turn % 4] + '</div>'; }
      h += '<div class="ev ' + e.k + '"><span class="k">' + (EV_MARK[e.k] || '・') + '</span><span>' + esc(e.t) + '</span></div>';
    });
    showModal('<div class="card-body">' + h + '</div></div><div class="card-foot"><button class="btn gold" data-act="modal-close">とじる</button></div>', { replace: true });
  }
  function openIO() {
    showModal('<div class="card-body"><h2>データの引っ越し</h2><p class="dim">下の文字をすべてコピーして、別の端末の同じ画面で貼り付けて「読み込む」を押します。</p>' +
      '<textarea class="io" id="io-out" readonly>' + esc(E.serialize()) + '</textarea><div class="acts"><button class="btn sm" data-act="io-copy">コピーする</button></div>' +
      '<div class="sec">読み込む</div><textarea class="io" id="io-in" placeholder="ここに貼り付け"></textarea><div class="acts"><button class="btn sm" data-act="io-load">読み込む</button></div></div>' +
      '<div class="card-foot"><button class="btn gold" data-act="modal-close">とじる</button></div>', { replace: true });
  }
  function showTitle(step) {
    var el = $('#title'), has = !!readSave(), h = '';
    TF.asiLook = false; document.body.classList.remove('asi');
    if (step === 'diff') {
      h = '<p class="subt">難しさをえらぶ</p><div class="diffs">';
      Object.keys(D.DIFFICULTY).forEach(function (k) { var x = D.DIFFICULTY[k]; h += '<button class="row" data-act="new-game" data-diff="' + k + '"><span class="fld">' + x.name.charAt(0) + '</span><div><h3>' + x.name + '</h3><p>' + x.desc + '</p></div><span></span></button>'; });
      h += '</div>' + (has ? '<p class="seal warn">いまのセーブデータは上書きされます。</p>' : '') + '<div class="acts"><button class="btn" data-act="title-back">もどる</button></div>';
    } else {
      h = '<p class="subt">戦国タイムスリップ戦略</p><h1>天下布<span>鳥</span></h1><div class="flock">' + birdSVG('dario') + D.BIRDS.map(function (b) { return birdSVG(b); }).join('') + '</div>' +
        '<p class="lead">自衛隊と総括指揮AI「ダリオくん」、そして近現代の科学技術をすべて覚えている文鳥・インコの参謀団が、永禄三年の日本へ。燃料と弾薬が尽きる前に石油を押さえ、戦国を平定し、海を渡れ。</p>' +
        '<div class="acts">' + (has ? '<button class="btn gold" data-act="continue">つづきから</button>' : '') + '<button class="btn ' + (has ? '' : 'gold') + '" data-act="title-diff">はじめから</button></div>' +
        (TF.Chronicle && TF.Chronicle.available() ? '<div class="acts"><button class="btn" data-act="chronicle">' + icon('film') + '年代記を見る(アニメーション)</button></div>' : '') +
        '<p class="seal">進行は端末に自動保存されます</p>';
    }
    el.innerHTML = '<div class="title-in">' + h + '</div>'; el.hidden = false;
  }
  function startGame(diff) {
    E.newGame({ difficulty: diff });
    save(); ui.gid = (ui.gid || 0) + 1;
    $('#title').hidden = true;
    ui.sel = null; ui.panel = null; ui.mv = null; ui.map = 'japan'; ui.view = { japan: null, world: null }; ui.queue = []; ui.modal = null; $('#modal').hidden = true;
    buildMap(); applyView(); refreshAll();
    var pages = D.TEXT.intro;
    pages.forEach(function (p, i) { queueStory({ eyebrow: (i + 1) + ' / ' + pages.length, title: p.title, bird: p.bird, body: p.body }, { btn: i === pages.length - 1 ? '作戦開始' : 'つぎへ' }); });
  }
  function resumeGame() {
    $('#title').hidden = true; ui.gid = (ui.gid || 0) + 1;
    ui.sel = null; ui.panel = null; ui.mv = null; ui.queue = []; ui.modal = null; $('#modal').hidden = true;
    ui.map = 'japan'; ui.view = { japan: null, world: null };
    buildMap(); applyView();
    var mine = E.playerRegions().filter(function (id) { return reg(id).map === 'jp'; });
    if (mine.length && mine.indexOf('izu') < 0) focusRegion(mine[0], { zoom: true, sheet: false });
    refreshAll();
  }

  function refreshAll() { syncLook(); renderHud(); renderNav(); refreshMap(); renderSheet(); renderPanel(); renderMapUI(); }

  // ───────────────────────── 操作の受け口 ─────────────────────────
  // 押したときの音。null は、その操作の結果に合わせて別に鳴らすもの
  var SND = { build: null, produce: null, recruit: null, 'atk-go': null, 'end-turn': null, dip: null, 'sound-toggle': null, 'opt-sound': null, 'opt-ringer': null, 'sound-test': null, 'io-load': null,
    enact: null, 'nuke-yes': null, 'nuke-no': null, 'manual-yes': null, chronicle: 'launch', diorama: 'open', policy: 'open', ntab: 'select', 'dio-era': 'select', 'assign-all': 'chirp',
    tab: 'open', attack: 'open', menu: 'open', fac: 'open', tech: 'open', help: 'open', log: 'open', io: 'open', hints: 'dario', bird: 'chirp', assign: 'chirp',
    'atk-toggle': 'select', pick: 'select', goto: 'select', map: 'select', 'new-game': 'launch', 'continue': 'launch' };
  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var act = el.getAttribute('data-act'), st = S(), res, id;
    if (TF.Battle3D && TF.Battle3D.active()) return; // 戦闘アニメの最中は下の画面を触らせない
    if (TF.Chronicle && TF.Chronicle.active()) return; // 年代記の最中も同じ
    var snd = SND.hasOwnProperty(act) ? SND[act] : 'click';
    if (act === 'bird' && el.getAttribute('data-bid') === 'dario') snd = null;
    if (snd) sfx(snd, snd === 'chirp' ? { n: 2 } : null);
    switch (act) {
      case 'close-sheet': select(null); break;
      case 'sub': ui.sub = el.getAttribute('data-sub') || null; renderSheet(); break;
      case 'pick': id = +el.getAttribute('data-uid'); if (ui.pick[id]) delete ui.pick[id]; else ui.pick[id] = 1; renderSheet(); break;
      case 'move-start': startMove(); break;
      case 'move-cancel': ui.mv = null; refreshAll(); break;
      case 'build': res = E.build(ui.sel, el.getAttribute('data-key')); if (res.error) oops(res.error); else { sfx('build'); toast(facName(el.getAttribute('data-key')) + 'の建設を始めた'); save(); ui.sub = null; refreshAll(); } break;
      case 'produce': res = E.produce(ui.sel, el.getAttribute('data-type')); if (res.error) oops(res.error); else { sfx('recruit'); toast('編成を始めた'); save(); ui.sub = null; refreshAll(); } break;
      case 'recruit': res = E.recruit(ui.sel, +el.getAttribute('data-n')); if (res.error) oops(res.error); else { sfx('recruit'); save(); refreshAll(); } break;
      case 'attack': openAttack(); break;
      case 'atk-toggle': id = +el.getAttribute('data-uid'); if (ui.atk.ids[id]) delete ui.atk.ids[id]; else ui.atk.ids[id] = 1; renderAttack(); break;
      case 'atk-sug': res = E.suggestAttack(ui.atk.tid, 0.9); ui.atk.ids = {}; res.ids.forEach(function (i) { ui.atk.ids[i] = 1; }); if (!res.ok) oops('いまの手持ちでは、勝算9割に届きません'); renderAttack(); break;
      case 'atk-all': ui.atk.ids = {}; E.attackOptions(ui.atk.tid).forEach(function (o) { if (o.ok && !D.UNIT_TYPES[o.u.type].nuke) ui.atk.ids[o.u.id] = 1; }); renderAttack(); break;
      case 'nuke-yes': ui.atk.nukeOk = true; goAttack(); break;
      case 'nuke-no': renderAttack(); break;
      case 'atk-none': ui.atk.ids = {}; renderAttack(); break;
      case 'atk-go': goAttack(); break;
      case 'modal-close': closeModal(); break;
      case 'tab': openPanel(el.getAttribute('data-panel')); break;
      case 'panel-close': ui.panel = null; renderPanel(); renderNav(); break;
      case 'end-turn': if (ui.modal) return; ui.panel = null; endTurn(); break;
      case 'map': ui.mv = null; switchMap(el.getAttribute('data-map')); break;
      case 'zoom': zoomAt(+el.getAttribute('data-f')); break;
      case 'goto': id = el.getAttribute('data-id'); ui.queue = []; closeModal(); ui.panel = null; renderPanel(); renderNav(); select(id, { focus: true }); break;
      case 'hints': openHints(); break;
      case 'fac': openFaction(el.getAttribute('data-fid')); break;
      case 'dip': doDiplo(el.getAttribute('data-fid'), el.getAttribute('data-key')); break;
      case 'dtab': ui.diploTab = el.getAttribute('data-t'); renderPanel(); break;
      case 'tech': openTech(el.getAttribute('data-tid')); break;
      case 'bird': openBird(el.getAttribute('data-bid')); break;
      case 'assign':
        var bid = el.getAttribute('data-bid'), tid = el.getAttribute('data-tid'), cur = st.assign[bid];
        if (cur !== tid && TECH[tid].manual && !st.flags['ok_' + tid]) { confirmManual(tid, bid, el.getAttribute('data-from')); break; }
        E.assign(bid, cur === tid ? null : tid); save(); renderPanel(); renderNav();
        if (el.getAttribute('data-from') === 'bird') openBird(bid); else openTech(tid);
        break;
      case 'assign-all':
        tid = el.getAttribute('data-tid');
        if (TECH[tid].manual && !st.flags['ok_' + tid]) { confirmManual(tid, '*', ''); break; }
        assignTo(tid, '*'); openTech(tid);
        break;
      case 'manual-yes':
        tid = el.getAttribute('data-tid'); bid = el.getAttribute('data-bid');
        st.flags['ok_' + tid] = 1; sfx(tid === 'asi' ? 'asi' : 'taiko'); assignTo(tid, bid);
        if (el.getAttribute('data-from') === 'bird') openBird(bid); else openTech(tid);
        break;
      case 'manual-no': openTech(el.getAttribute('data-tid')); break;
      case 'ntab': ui.ntab = el.getAttribute('data-t'); renderPanel(); $('.panel-body', $('#panel')).scrollTop = 0; break;
      case 'policy': openPolicy(el.getAttribute('data-pid')); break;
      case 'enact': doEnact(el.getAttribute('data-pid')); break;
      case 'diorama': openDiorama(); break;
      case 'dio-era':
        id = +el.getAttribute('data-i');
        if (ui.dio) { ui.dio.setStage(id, { animate: true }); $$('[data-act="dio-era"]').forEach(function (b2) { b2.classList.toggle('gold', +b2.getAttribute('data-i') === id); }); $('#dio-cap').textContent = D.ERAS[id].look; }
        break;
      case 'chronicle': playChronicle(); break;
      case 'auto-research': st.autoResearch = !st.autoResearch; if (st.autoResearch) E.autoAssign(); save(); renderPanel(); renderNav(); break;
      case 'menu': openMenu(); break;
      case 'sound-toggle': case 'opt-sound':
        ui.opts.sound = !ui.opts.sound; saveOpts();
        if (TF.sfx) { TF.sfx.setEnabled(ui.opts.sound); TF.sfx.unlock(); }
        renderHud(); if (ui.opts.sound) sfx('chirp', { n: 3 });
        if (act === 'opt-sound') openMenu();
        break;
      case 'opt-anim': ui.opts.anim = !ui.opts.anim; saveOpts(); openMenu(); break;
      case 'opt-ringer': ui.opts.ringer = !ui.opts.ringer; saveOpts(); if (TF.sfx) { TF.sfx.setBypass(ui.opts.ringer); TF.sfx.unlock(); } sfx('chirp', { n: 2 }); openMenu(); break;
      case 'sound-test': // 勝利の音を鳴らして、少しあとに状態を書き直す
        sfx('victory');
        setTimeout(function () { var el = $('#snd-status'); if (el) el.textContent = soundStatus(); }, 700);
        break;
      case 'help': openHelp(); break;
      case 'log': openLog(); break;
      case 'io': openIO(); break;
      case 'io-copy':
        var out = $('#io-out'); out.select();
        try { navigator.clipboard.writeText(out.value).then(function () { toast('コピーしました'); }, function () { toast('選択した文字を手でコピーしてください'); }); } catch (err) { toast('選択した文字を手でコピーしてください'); }
        break;
      case 'io-load':
        try { E.load($('#io-in').value.trim()); save(); ui.queue = []; closeModal(); resumeGame(); toast('読み込みました'); } catch (err) { toast('読み込めません。文字がすべて貼り付けられているか確かめてください'); }
        break;
      case 'to-title': ui.queue = []; closeModal(); ui.panel = null; showTitle(); break;
      case 'title-diff': showTitle('diff'); break;
      case 'title-back': showTitle(); break;
      case 'new-game': startGame(el.getAttribute('data-diff')); break;
      case 'continue': try { E.load(readSave()); resumeGame(); } catch (err) { toast('セーブデータを読めませんでした。はじめからどうぞ'); clearSave(); showTitle(); } break;
    }
  }

  function boot(hot) {
    E.init(MAP);
    document.addEventListener('click', onClick);
    ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (ev) { // ブラウザが音の開始を許すのは、指を離した瞬間・クリック・キー入力の中だけ
      document.addEventListener(ev, function () { if (TF.sfx) TF.sfx.unlock(); }, { capture: true, passive: true });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (ui.modal) closeModal(); else if (ui.mv) { ui.mv = null; refreshAll(); } else if (ui.panel) { ui.panel = null; renderPanel(); renderNav(); } else if (ui.sel) select(null); } });
    bindMap();
    var live = hot && hot.save;
    if (live) { try { E.load(live); resumeGame(); return; } catch (e) { /* 表紙へ */ } }
    showTitle();
  }
  // 開いたままのページが更新されても、進行を引き継ぐ
  var hotApi = window.claude && window.claude.hot;
  if (hotApi && hotApi.snapshot) { try { hotApi.snapshot(function () { return S() ? { save: E.serialize() } : {}; }); } catch (e) { /* なくても動く */ } }
  if (hotApi && hotApi.ready) hotApi.ready(boot); else boot((hotApi && hotApi.data) || {});
  TF.ui = ui;
})();
