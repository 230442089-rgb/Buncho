/* 天下布鳥 — B.U.N society の結末。ブンーチョウ手術まで進めて、地球を一つにしたときに流れる。
 * 闘技場の街(diorama3d.js の「ガチの世」)をめぐりながら、のちの世を語り、上位個体の名を挙げる。
 * 筋書きと文は lore.js の D.BUN.ending と D.BUN.ranks、絵は bunart.js。 */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};
  var A = null, RANK_SEC = 3.5;   // A: 再生中の状態

  function available() { return typeof document !== 'undefined' && !!(TF.Diorama3D && TF.Diorama3D.available() && TF.DATA && TF.DATA.BUN && TF.DATA.BUN.ending); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sfx(n, o) { try { if (TF.sfx) TF.sfx.play(n, o); } catch (e) { /* 音が出せない */ } }
  function duration() { var S = TF.DATA.BUN.ending; return S[S.length - 1].at + 6; }

  function setSub(t, dario) {
    var s = A.sub;
    if (!t) { s.classList.remove('on'); return; }
    s.className = 'be-sub on' + (dario ? ' dario' : '');
    s.innerHTML = (dario && TF.birdSVG ? TF.birdSVG('dario') : '') + '<span>' + esc(t) + '</span>';
  }
  function look(view) { if (A.dio) { A.ang += 0.85; A.dio.focus(view, { angle: A.ang }); } A.view = view; }
  function cue(c) {
    if (c.view) look(c.view);
    if (c.card) { A.card.innerHTML = '<span>' + esc(c.card) + '</span>'; A.card.classList.add('on'); A.cardOff = A.t + 3.4; setSub(null); }
    if (c.t) setSub(c.t, c.dario);
    if (c.ranks) { A.rk = { t0: A.t, i: -1 }; setSub(null); look('ring'); }
    if (c.count) { A.cnt = { t0: A.t, e: 0 }; A.count.classList.add('on'); sfx('bigwin'); }
    if (c.end) {
      A.end = A.t; setSub(null); A.count.classList.remove('on');
      A.card.innerHTML = '<span><b>B.U.N society</b><small>—— 完 ——</small></span>'; A.card.classList.add('on'); A.cardOff = 0; sfx('flock');
    }
  }
  function showRank(i) {
    var r = TF.DATA.BUN.ranks[i], art = TF.BUNART || {}, img = r.img && art[r.img];
    A.rank.innerHTML = '<div class="be-rk">' + (img ? '<img alt="" src="' + img + '">' : '<div class="ph">?</div>') +
      '<div><div class="no">B.U.N Rank No.<b>' + r.no + '</b></div><h3>' + esc(r.name) + '</h3><div class="sb">' + esc(r.sub) + '</div><p>' + esc(r.t) + '</p></div></div>';
    A.rank.classList.add('on'); sfx(r.no === 1 ? 'slam' : 'stamp');
  }
  function step(dt) {
    var S = TF.DATA.BUN.ending, R = TF.DATA.BUN.ranks, k, e;
    A.t += dt;
    while (A && A.i < S.length && S[A.i].at <= A.t) cue(S[A.i++]);
    if (A.cardOff && A.t >= A.cardOff) { A.card.classList.remove('on'); A.cardOff = 0; }
    if (A.rk) {   // 上位個体を、下の席から順に
      k = Math.floor((A.t - A.rk.t0) / RANK_SEC);
      if (k >= R.length) { A.rk = null; A.rank.classList.remove('on'); } else if (k !== A.rk.i) { A.rk.i = k; showRank(k); }
    }
    if (A.cnt) { e = Math.min(21, 8 + Math.floor((A.t - A.cnt.t0) * 4.2)); if (e !== A.cnt.e) { A.cnt.e = e; A.count.innerHTML = '10<sup>' + e + '</sup><small>羽</small>'; } }
    if (A.end != null && A.t >= A.end + 6) finish();
  }
  function loop(now) {
    if (!A) return;
    A.raf = requestAnimationFrame(loop);
    var dt = Math.min(0.1, Math.max(0, (now - A.last) / 1000)); A.last = now;
    if (A.manual || document.hidden) return;
    step(dt);
  }
  function finish() {
    if (!A) return;
    var a = A; A = null;
    cancelAnimationFrame(a.raf);
    try { if (a.dio) a.dio.dispose(); } catch (e) { /* 破棄済み */ }
    if (a.host.parentNode) a.host.parentNode.removeChild(a.host);
    if (a.cb) a.cb();
  }
  function tap(ev) { // 画面をたたくと、次へ(上位個体の札と、最後の札)
    if (!A || (ev.target && ev.target.closest && ev.target.closest('.be-skip'))) return;
    if (A.rk) A.rk.t0 = A.t - (A.rk.i + 1) * RANK_SEC;
    else if (A.end != null && A.t > A.end + 1.2) finish();
  }
  function play(cb) {
    if (A || !available()) { if (cb) cb(); return false; }
    var host = el('div', 'bunend'), stage = el('div', 'be-stage'), skip = el('button', 'be-skip', 'スキップ ▸▸');
    A = { host: host, cb: cb, t: 0, i: 0, last: performance.now(), raf: 0, dio: null, manual: false, ang: 0.3, rk: null, cnt: null, end: null, cardOff: 0, view: '',
      sub: el('div', 'be-sub'), card: el('div', 'be-card'), rank: el('div', 'be-rank'), count: el('div', 'be-count') };
    host.setAttribute('role', 'dialog'); host.setAttribute('aria-label', 'B.U.N society の結末');
    host.appendChild(stage); host.appendChild(el('div', 'be-vig')); host.appendChild(A.count); host.appendChild(A.sub); host.appendChild(A.rank); host.appendChild(A.card); host.appendChild(skip);
    document.body.appendChild(host);
    try { A.dio = TF.Diorama3D.mount(stage, { stage: 10, orbit: true, focus: 'bunall', angle: A.ang }); } catch (e) { A.dio = null; }
    skip.addEventListener('click', finish); host.addEventListener('click', tap);
    step(0);
    A.raf = requestAnimationFrame(loop);
    return true;
  }

  TF.BunEnd = {
    available: available, play: play, skip: finish, duration: duration,
    active: function () { return !!A; },
    // 検査用:実時間を待たずに進める
    _advance: function (sec) { if (!A) return -1; A.manual = true; var n = Math.max(1, Math.ceil(sec * 10)), i; for (i = 0; i < n && A; i++) step(sec / n); if (A && A.dio) A.dio._advance(Math.min(sec, 2.5)); return A ? A.t : -1; },
    _info: function () { return A ? { t: A.t, cue: A.i, view: A.view, rank: A.rk ? A.rk.i : -1, count: A.cnt ? A.cnt.e : 0, end: A.end != null, sub: A.sub.classList.contains('on') ? A.sub.textContent : '', dio: !!A.dio } : null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
