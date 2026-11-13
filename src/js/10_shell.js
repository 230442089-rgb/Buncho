// ───────── 窓まわり（2000年代のフリーソフトふう）─────────
const Shell = (() => {
  const S = { touch: false };
  const TITLE = '事象のアトリエ', BASE = '事象のアトリエ - 無題';
  let desk, wins, pad, main = null, menuEl = null, menuName = '', modals = [], z = 10, busy = false;
  const ICON = {};
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const bgi = (e, k) => { e.style.backgroundImage = 'url(' + ICON[k] + ')'; };
  const ALL = MATS.map(m => m.id);

  const README = [
    '━━━━━━━━━━━━━━━━━',
    '　事象のアトリエ　ver' + VERSION,
    '━━━━━━━━━━━━━━━━━',
    '【ファイル名】ATELIER.EXE',
    '【種　　別】フリーソフト',
    '【作　　者】（空欄）',
    '【動作環境】あたらしめの ブラウザ',
    '',
    '■これは なに？',
    '　アトリエを 歩いて、作品の',
    '　素材を あつめる ソフトです。',
    '　主人公は なにも 話しません。',
    '',
    '■あそびかた',
    '　「ｻｸﾋﾝｺｳﾎ」と 出ている',
    '　ものの そばで、決定を',
    '　押しつづけると スケッチ',
    '　できます。',
    '',
    '　あつめた 素材は、アトリエの',
    '　画架で 保存して ください。',
    '　7つ そろうと 完成です。',
    '',
    '■そうさ',
    '　あるく　方向キー / WASD',
    '　　　　　十字ボタン',
    '　決定　　Z / Enter / Space',
    '　　　　　Ａボタン',
    '　メニュー　窓の 上の バー',
    '',
    '■ちゅうい',
    '　・世界が 止まったら、',
    '　　あなたも 止まって ください。',
    '　・止まっている ものは、',
    '　　見つかりません。',
    '　・見つかって、つかまると、',
    '　　強制終了 します。',
    '　・保存していない 素材は、',
    '　　強制終了で 失われます。',
    '',
    '■こつ',
    '　・走る人は、時計まわりに',
    '　　見まわします。',
    '　・走りだす 前に、影が',
    '　　先に 出ます。',
    '　・柱や 箱の かげは、',
    '　　見えません。',
    '',
    '■既知の 不具合',
    '　・ときどき、走る人が',
    '　　入ってきます。',
    '　　なおす 予定は ありません。',
    '　・影が 本人より 先に 来ます。',
    '　　仕様です。',
    '　・影が ふえる ことが あります。',
    '　　仕様です。',
    '',
    '■りれき',
    '　0.71β　廊下を 長く しました。',
    '　0.70β　扉を ふやしました。',
    '　　　　 あかない 扉も',
    '　　　　 ふやしました。',
    '　0.62β　窓の 外を 消しました。',
  ].join('\n');
  function noteText() {
    const n = Store.d.crashes;
    let s = 'エデル姉へ\n\nきょうも 走ったよ。\nアトリエの 外がわを ぜんぶ。\nすっごい 速かった。\n\n見てた？\n';
    if (n >= 4) s += '\n見てなかったなら、もう一回 やるね。\nつぎは もっと 速く やるから。\nだから 見てて。\n';
    if (n >= 7) s += '\n見てて\n見てて\n見てて\n\n……姉ちゃん。\n';
    return s;
  }

  function mkIcons() {
    const u = c => c.toDataURL();
    ICON.app = u(C(32, 32, g => {
      LN(g, 9, 22, 4, 31, '#630'); LN(g, 10, 22, 5, 31, '#963'); LN(g, 22, 22, 27, 31, '#630'); LN(g, 21, 22, 26, 31, '#963'); R(g, 15, 22, 2, 9, '#630'); R(g, 3, 22, 26, 2, '#963');
      R(g, 4, 2, 24, 20, '#303'); R(g, 5, 3, 22, 18, '#fff'); DI(g, 5, 3, 22, 9, '#96f', 7); R(g, 5, 12, 22, 9, '#99c'); EL(g, 12, 11, 3, 3, '#ffc'); LN(g, 7, 18, 23, 14, '#306'); LN(g, 7, 19, 23, 15, '#306');
    }));
    ICON.txt = u(C(32, 32, g => { R(g, 6, 2, 20, 28, '#303'); R(g, 7, 3, 18, 26, '#fff'); for (let i = 0; i < 6; i++) R(g, 10, 8 + i * 4, i === 5 ? 7 : 12, 1, '#669'); R(g, 20, 3, 5, 5, '#ccc'); }));
    ICON.note = u(C(32, 32, g => { R(g, 6, 2, 20, 28, '#303'); R(g, 7, 3, 18, 26, '#ffc'); for (let i = 0; i < 6; i++) R(g, 10, 8 + i * 4, 6 + (i * 5) % 7, 1, '#f60'); }));
    ICON.bmp = u(C(32, 32, g => { R(g, 2, 4, 28, 24, '#303'); g.drawImage(Picture.get(ALL), 0, 0, 128, 96, 3, 5, 26, 22); }));
    ICON.err = u(C(32, 32, g => { EL(g, 16, 16, 15, 15, '#303'); EL(g, 16, 16, 13, 13, '#c03'); for (let i = -6; i <= 6; i++) { R(g, 15 + i, 15 + i, 3, 3, '#fff'); R(g, 15 + i, 15 - i, 3, 3, '#fff'); } }));
    ICON.info = u(C(32, 32, g => { EL(g, 16, 16, 15, 15, '#303'); EL(g, 16, 16, 13, 13, '#36c'); R(g, 14, 7, 4, 4, '#fff'); R(g, 14, 13, 4, 12, '#fff'); R(g, 12, 13, 2, 2, '#fff'); R(g, 12, 23, 8, 2, '#fff'); }));
    ICON.ask = u(C(32, 32, g => { EL(g, 16, 16, 15, 15, '#303'); EL(g, 16, 16, 13, 13, '#36c'); R(g, 11, 8, 10, 3, '#fff'); R(g, 18, 10, 4, 6, '#fff'); R(g, 14, 15, 6, 3, '#fff'); R(g, 14, 17, 4, 3, '#fff'); R(g, 14, 22, 4, 4, '#fff'); R(g, 10, 10, 4, 3, '#fff'); }));
    for (const m of MATS) ICON['g_' + m.id] = u(C(16, 16, g => { for (let j = -6; j <= 6; j++) R(g, 8 - (6 - Math.abs(j)), 8 + j, (6 - Math.abs(j)) * 2 + 1, 1, j < -1 ? '#fff' : m.col); for (let j = -6; j <= 6; j++) { R(g, 8 - (6 - Math.abs(j)) - 1, 8 + j, 1, 1, '#303'); R(g, 8 + (6 - Math.abs(j)) + 1, 8 + j, 1, 1, '#303'); } R(g, 8, 1, 1, 1, '#303'); R(g, 8, 15, 1, 1, '#303'); }));
    ICON.gnone = u(C(16, 16, g => { for (let j = -6; j <= 6; j++) { R(g, 8 - (6 - Math.abs(j)) - 1, 8 + j, 1, 1, '#999'); R(g, 8 + (6 - Math.abs(j)) + 1, 8 + j, 1, 1, '#999'); } }));
    const wp = C(64, 64, g => {
      R(g, 0, 0, 64, 64, '#6f7fb5');
      EL(g, 20, 17, 12, 4, '#8fa0d2'); EL(g, 12, 20, 8, 3, '#8fa0d2'); EL(g, 29, 20, 8, 3, '#8fa0d2');
      EL(g, 48, 47, 9, 3, '#8fa0d2'); EL(g, 54, 50, 6, 2, '#8fa0d2'); EL(g, 42, 50, 6, 2, '#8fa0d2');
    });
    document.body.style.backgroundImage = 'url(' + wp.toDataURL() + ')';
    document.body.style.backgroundSize = '128px 128px';
    bgi($('ico-app').firstElementChild, 'app'); bgi($('ico-readme').firstElementChild, 'txt'); bgi($('ico-note').firstElementChild, 'note'); bgi($('ico-bmp').firstElementChild, 'bmp');
  }

  // ── 窓 ──
  function focus(w) { w.style.zIndex = ++z; }
  function place(w, dx, dy) {
    const DW = desk.clientWidth, DH = desk.clientHeight;
    w.style.left = Math.max(0, Math.round((DW - w.offsetWidth) / 2) + (dx || 0)) + 'px';
    w.style.top = Math.max(0, Math.round((DH - w.offsetHeight) / 2.6) + (dy || 0)) + 'px';
  }
  function drag(w, tb) {
    let on = false, sx = 0, sy = 0, ox = 0, oy = 0;
    tb.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.pointerType !== 'mouse') return;
      on = true; sx = e.clientX; sy = e.clientY; ox = w.offsetLeft; oy = w.offsetTop; tb.setPointerCapture(e.pointerId);
    });
    tb.addEventListener('pointermove', e => {
      if (!on) return;
      w.style.left = clamp(ox + e.clientX - sx, 40 - w.offsetWidth, desk.clientWidth - 40) + 'px';
      w.style.top = clamp(oy + e.clientY - sy, 0, desk.clientHeight - 24) + 'px';
    });
    const end = () => { on = false; };
    tb.addEventListener('pointerup', end); tb.addEventListener('pointercancel', end);
  }
  function mkWin(title, opt) {
    opt = opt || {};
    const w = el('div', 'win ' + (opt.cls || '')), tb = el('div', 'tb'), ic = el('i', 'tb-ic'), tx = el('span', 'tb-tx', title), x = el('button', 'tb-x', '×'), body = el('div', 'wb');
    x.type = 'button'; x.setAttribute('aria-label', '閉じる');
    if (opt.icon) bgi(ic, opt.icon); else ic.hidden = true;
    tb.append(ic, tx, x); w.append(tb, body); wins.append(w); focus(w);
    w.addEventListener('pointerdown', () => focus(w));
    const win = { w, tb, tx, x, body, close: null };
    x.addEventListener('click', e => { e.stopPropagation(); if (win.close) win.close(); });
    drag(w, tb);
    return win;
  }
  // ほかを さわれなくする窓（開いているあいだ、ゲームは止まる）
  function modalOpen(win) {
    const b = el('div', 'blocker');
    b.style.zIndex = win.w.style.zIndex; wins.insertBefore(b, win.w); focus(win.w);
    b.addEventListener('pointerdown', () => { Snd.sfx('err'); win.w.classList.add('flash'); setTimeout(() => win.w.classList.remove('flash'), 120); });
    win.blocker = b; modals.push(win); Game.paused = true; Input.clear();
  }
  function modalClose(win) {
    if (win.blocker) win.blocker.remove();
    win.w.remove(); modals = modals.filter(m => m !== win);
    if (!modals.length && !menuEl) Game.paused = false;
    Input.clear();
  }
  function msgBox(o) {
    return new Promise(res => {
      const win = mkWin(o.title || 'ATELIER.EXE', { cls: 'dlg' });
      const row = el('div', 'dlg-row'), ic = el('i', 'dlg-ic'), tx = el('div', 'dlg-tx', o.text);
      bgi(ic, o.icon || 'info'); row.append(ic, tx); win.body.append(row);
      if (o.detail) win.body.append(el('pre', 'dlg-de', o.detail));
      const br = el('div', 'dlg-btns'), btns = o.buttons || ['OK'];
      let done = false, timer = 0;
      const fin = i => { if (done) return; done = true; clearTimeout(timer); Snd.sfx('blip'); modalClose(win); res(i); };
      btns.forEach((b, i) => { const bt = el('button', 'btn', b); bt.type = 'button'; bt.addEventListener('click', () => fin(i)); br.append(bt); });
      win.body.append(br); win.close = () => fin(btns.length - 1);
      place(win.w, o.dx, o.dy); modalOpen(win);
      br.firstElementChild.focus({ preventScroll: true });
      Snd.sfx(o.icon === 'err' ? 'err' : 'ding');
      if (o.auto) timer = setTimeout(() => fin(0), o.auto);
    });
  }
  function sheet(title, icon, build) {
    const win = mkWin(title, { cls: 'sheet', icon });
    build(win.body, win);
    const br = el('div', 'dlg-btns'), bt = el('button', 'btn', '閉じる');
    bt.type = 'button'; br.append(bt); win.body.append(br);
    win.close = () => { Snd.sfx('close'); modalClose(win); };
    bt.addEventListener('click', win.close);
    place(win.w); modalOpen(win); Snd.sfx('open');
    bt.focus({ preventScroll: true });
    return win;
  }
  function openText(title, icon, text, cls) {
    sheet(title, icon, body => { const p = el('pre', 'txt' + (cls ? ' ' + cls : ''), text); p.tabIndex = 0; p.style.height = Math.min(340, desk.clientHeight - 90) + 'px'; body.append(p); });
  }
  const openReadme = () => openText('よんでね.txt', 'txt', README);
  const openNote = () => openText('みてて.txt', 'note', noteText(), 'note');
  function openAbout() {
    msgBox({ title: 'バージョン情報', icon: 'info', text: TITLE + '\nATELIER.EXE  Version ' + VERSION + '\n\nこの ソフトは フリーソフトです。\n\n文字: DotGothic16 を 位置合わせして\n埋めこんで います (SIL OFL 1.1)。' });
  }
  function picCanvas(ids, sc) {
    const c = el('canvas', 'pic'); c.width = Picture.W; c.height = Picture.H;
    c.getContext('2d').drawImage(Picture.get(ids), 0, 0);
    const s = Math.max(1, Math.min(sc, Math.floor((desk.clientWidth - 40) / Picture.W), Math.floor((desk.clientHeight - 130) / Picture.H)));
    c.style.width = Picture.W * s + 'px'; c.style.height = Picture.H * s + 'px';
    return c;
  }
  function openPicture() {
    sheet('作品 - 無題', 'app', body => {
      const n = Store.d.saved.length, k = Game.carry.length;
      body.append(picCanvas(Store.d.saved, 2));
      body.append(el('div', 'cap', n === 0 ? 'まだ 白紙です。' + (k ? '\n持っている 素材 ' + k + 'つ は、画架で 保存すると 描きこまれます。' : '') : '素材 ' + n + '/7 まで 描きこんで あります。' + (k ? '\n未保存の 素材が ' + k + 'つ あります。' : '')));
    });
  }
  function openBmp() {
    sheet('無題.bmp', 'bmp', body => { body.append(picCanvas(ALL, 2)); body.append(el('div', 'cap', '「無題」  128x96  256色\n完成 ' + Store.d.cleared + '回')); });
  }
  function openList() {
    sheet('素材リスト', 'app', body => {
      const ls = el('div', 'list'); ls.tabIndex = 0; ls.style.maxHeight = Math.min(360, desk.clientHeight - 90) + 'px';
      for (const m of MATS) {
        const saved = Store.d.saved.indexOf(m.id) >= 0, carry = Game.carry.indexOf(m.id) >= 0, got = saved || carry;
        const li = el('div', 'li' + (saved ? ' got' : carry ? ' un' : '')), ic = el('i');
        bgi(ic, got ? 'g_' + m.id : 'gnone');
        li.append(ic, el('b', '', m.name), el('em', '', saved ? '保存済' : carry ? '未保存' : '未取得'), el('p', '', got ? '〔' + m.type + '〕' + m.memo : 'もと: ' + m.src));
        ls.append(li);
      }
      body.append(ls);
    });
  }

  // ── メニュー ──
  const MENUS = {
    file: () => [
      { label: '上書き保存', dis: !Game.canSave(), fn: () => Game.saveAll() },
      { label: 'アトリエに戻る', dis: !Game.canReturn(), fn: () => Game.returnHome() },
      null,
      { label: '終了', fn: () => quit(false) },
    ],
    view: () => [
      { label: '作品を見る', dis: Game.mode !== 'play', fn: openPicture },
      { label: '素材リスト', fn: openList },
      null,
      { label: '走査線', chk: !!Store.d.scan, fn: () => { Store.d.scan = Store.d.scan ? 0 : 1; Store.save(); applyOpts(); } },
      { label: '音', chk: !!Store.d.sound, fn: () => { Store.d.sound = Store.d.sound ? 0 : 1; Store.save(); applyOpts(); } },
    ],
    help: () => [{ label: 'よんでね', fn: openReadme }, { label: 'バージョン情報', fn: openAbout }],
  };
  function closeMenu() {
    if (!menuEl) return;
    menuEl.remove(); menuEl = null; menuName = '';
    if (main) main.mb.querySelectorAll('.mi').forEach(b => b.classList.remove('on'));
    if (!modals.length) Game.paused = false;
    Input.clear();
  }
  function openMenu(name, btn) {
    closeMenu();
    if (busy || !main) return;
    const m = el('div', 'menu');
    for (const it of MENUS[name]()) {
      if (!it) { m.append(el('hr')); continue; }
      const b = el('button', it.chk ? 'chk' : '', it.label); b.type = 'button';
      if (it.dis) b.disabled = true;
      b.addEventListener('click', () => { closeMenu(); Snd.sfx('blip'); it.fn(); });
      m.append(b);
    }
    const dr = desk.getBoundingClientRect(), br = btn.getBoundingClientRect();
    wins.append(m);
    m.style.left = clamp(br.left - dr.left, 0, Math.max(0, desk.clientWidth - m.offsetWidth)) + 'px';
    m.style.top = (br.bottom - dr.top) + 'px';
    menuEl = m; menuName = name; btn.classList.add('on'); Game.paused = true; Input.clear(); Snd.sfx('blip');
  }
  function applyOpts() {
    if (main) main.scan.classList.toggle('no', !Store.d.scan);
    Snd.mute(!Store.d.sound);
  }

  // ── 画面の大きさ合わせ ──
  function fit() {
    pad.hidden = !S.touch || !main;
    if (!main) return;
    const DW = desk.clientWidth, DH = desk.clientHeight, dpr = window.devicePixelRatio || 1;
    const side = S.touch && DW > DH * 1.25, padH = S.touch && !side ? 166 : 0, padW = side ? 330 : 0;
    pad.classList.toggle('side', side);
    const size = k => { main.cv.style.width = Math.round(W * k * dpr) / dpr + 'px'; main.cv.style.height = Math.round(H * k * dpr) / dpr + 'px'; };
    size(1);
    // 窓のふち・メニュー・ステータスバーの分を引いて、画面に入る最大の倍率を出す
    const fitS = Math.min((DW - padW - (main.w.offsetWidth - W)) / W, (DH - padH - (main.w.offsetHeight - H)) / H);
    // ドットがそろう倍率（端末の画素の整数倍）を優先。小さくなりすぎるときだけ半端な倍率を使う
    let s = Math.floor(fitS * dpr) / dpr;
    if ((s < fitS * 0.88 || s <= 0) && (dpr >= 1.5 || fitS < 1)) s = fitS >= 1 ? Math.floor(fitS * 4) / 4 : Math.floor(fitS * 100) / 100;
    s = clamp(s, 0.4, 3);
    size(s);
    main.w.style.setProperty('--px', s + 'px');
    main.w.style.left = Math.max(0, Math.round((DW - main.w.offsetWidth) / 2)) + 'px';
    main.w.style.top = Math.max(0, Math.round((DH - padH - main.w.offsetHeight) / 2)) + 'px';
  }

  // ── 起動・終了 ──
  function refreshDesk() {
    $('ico-note').hidden = Store.d.crashes < 2;
    $('ico-bmp').hidden = Store.d.cleared < 1;
  }
  function launch(silent) {
    if (main) { focus(main.w); return; }
    if (silent !== true) { Snd.unlock(); Snd.sfx('boot'); }
    const m = mkWin(TITLE, { cls: 'main', icon: 'app' });
    const mb = el('div', 'mb');
    for (const [k, lb] of [['file', 'ファイル'], ['view', '表示'], ['help', 'ヘルプ']]) {
      const b = el('button', 'mi', lb); b.type = 'button';
      b.addEventListener('click', () => { if (menuEl && menuName === k) closeMenu(); else openMenu(k, b); b.blur(); });
      mb.append(b);
    }
    const cl = el('div', 'cl'), cv = el('canvas', 'view'), scan = el('div', 'scan'), sb = el('div', 'sb');
    cv.width = W; cv.height = H; cl.append(cv, scan);
    const hint = el('span', 'sb-hint'), mat = el('span', 'sb-mat'), st = el('span', 'sb-st'), ck = el('span', 'sb-ck');
    sb.append(hint, mat, st, ck); m.body.append(mb, cl, sb);
    main = Object.assign(m, { mb, cv, scan, hint, mat, st, ck, cache: {} });
    m.close = () => quit(false);
    cv.addEventListener('pointerdown', e => { Snd.unlock(); const r = cv.getBoundingClientRect(); Game.pointer((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); });
    busy = false; fit(); applyOpts();
    Game.init(cv); Game.boot();
  }
  function closeAll() {
    closeMenu();
    for (const w of Array.from(wins.children)) w.remove();
    modals = []; main = null; busy = false;
    Game.off(); Game.paused = false; Input.clear(); Snd.music(null);
    refreshDesk(); fit();
    $('ico-app').focus({ preventScroll: true });
  }
  async function quit(fromTitle) {
    if (!main || Game.mode === 'dead' || Game.mode === 'halt') return;
    if (!fromTitle && Game.mode === 'play' && (Game.carry.length > 0)) {
      const i = await msgBox({ title: '終了', icon: 'ask', text: '保存していない 素材が ' + Game.carry.length + 'つ あります。\n終了すると 失われます。\n\n終了しますか？', buttons: ['はい', 'いいえ'] });
      if (i !== 0) return;
    }
    Store.d.last = 'ok'; Store.save();
    Snd.sfx('close'); closeAll();
  }
  // 強制終了
  async function crash() {
    const n = Store.d.crashes;
    closeMenu(); setBusy(true); setTitle(BASE + ' (応答なし)');
    await wait(700);
    if (!main) return;
    const hx = Math.floor(Math.random() * 65536).toString(16).toUpperCase().padStart(4, '0');
    await msgBox({
      title: 'ATELIER.EXE', icon: 'err', auto: 15000,
      text: 'このプログラムは\n不正な運動を 検出したため、\n強制終了されます。\n\n保存していない 素材は\n失われました。' + (n >= 2 ? '（' + n + '回目）' : ''),
      detail: 'ATELIER のページ違反です。\nモジュール : ' + (n >= 4 ? 'ﾐﾃﾃ.DLL' : 'ASERA.DLL') + '\nアドレス : 0167:BFF9' + hx,
      buttons: [n >= 3 && chance(0.5) ? '見てて' : '閉じる'],
    });
    if (!main) return;
    const DW = desk.clientWidth, DH = desk.clientHeight, calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (let i = 0; i < (calm ? 1 : 9); i++) {
      const g = mkWin('見てて', { cls: 'dlg' });
      const row = el('div', 'dlg-row'), ic = el('i', 'dlg-ic'); bgi(ic, 'err'); row.append(ic, el('div', 'dlg-tx', '見てて')); g.body.append(row);
      const br = el('div', 'dlg-btns'); br.append(el('button', 'btn', '見てて')); g.body.append(br);
      g.w.style.left = clamp(Math.round(DW / 2 - 150 + i * 18), 0, Math.max(0, DW - g.w.offsetWidth)) + 'px';
      g.w.style.top = clamp(Math.round(DH / 2 - 150 + i * 16), 0, Math.max(0, DH - g.w.offsetHeight)) + 'px';
      Snd.sfx('err');
      await wait(65);
    }
    await wait(450);
    closeAll();
  }
  // 完成 → 正常終了
  async function finish() {
    await msgBox({ title: TITLE, icon: 'info', text: '作品が 完成しました。\n\n「無題.bmp」を デスクトップに 保存しました。\nATELIER.EXE を 終了します。' });
    Snd.sfx('close'); closeAll();
    openBmp();
  }

  // ── 状態の表示 ──
  function setCell(k, t, cls) {
    if (!main) return;
    const c = main.cache;
    if (c[k] !== t) { c[k] = t; main[k].textContent = t; }
    if (cls !== undefined && c[k + 'c'] !== cls) { c[k + 'c'] = cls; main[k].classList.toggle('warn', !!cls); }
  }
  const setHint = t => setCell('hint', t);
  const setMat = t => setCell('mat', t);
  const setSt = (t, w) => setCell('st', t, !!w);
  const setClock = t => setCell('ck', t);
  function setTitle(t) { setCell('tx', t || BASE); }
  function setBusy(b) { if (busy === b || !main) { busy = b; return; } busy = b; main.mb.classList.toggle('busy', b); if (b) closeMenu(); }
  function shake(on) { if (main) main.w.classList.toggle('shake', on); }

  function initPad() {
    const dp = $('dpad'), ab = $('abtn');
    let cur = null, down = false;
    const mark = (d, on) => { const b = dp.querySelector('[data-k="' + d + '"]'); if (b) b.classList.toggle('on', on); };
    const setDir = d => { if (d === cur) return; if (cur) { Input.release(cur); mark(cur, false); } cur = d; if (d) { Input.press(d); mark(d, true); } };
    const calc = e => {
      const r = dp.getBoundingClientRect(), x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      if (Math.hypot(x, y) < 10) return cur;
      return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
    };
    dp.addEventListener('pointerdown', e => { e.preventDefault(); Snd.unlock(); down = true; try { dp.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ } setDir(calc(e)); });
    dp.addEventListener('pointermove', e => { if (down) setDir(calc(e)); });
    const up = () => { down = false; setDir(null); };
    dp.addEventListener('pointerup', up); dp.addEventListener('pointercancel', up); dp.addEventListener('lostpointercapture', up);
    ab.addEventListener('pointerdown', e => { e.preventDefault(); Snd.unlock(); try { ab.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ } Input.press('act'); ab.classList.add('on'); });
    const aup = () => { Input.release('act'); ab.classList.remove('on'); };
    ab.addEventListener('pointerup', aup); ab.addEventListener('pointercancel', aup); ab.addEventListener('lostpointercapture', aup);
    ab.addEventListener('contextmenu', e => e.preventDefault()); dp.addEventListener('contextmenu', e => e.preventDefault());
  }
  function init() {
    desk = $('desk'); wins = $('wins'); pad = $('pad');
    S.touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    mkIcons(); initPad(); refreshDesk();
    $('ico-app').addEventListener('click', () => launch());
    $('ico-readme').addEventListener('click', () => { Snd.unlock(); openReadme(); });
    $('ico-note').addEventListener('click', () => { Snd.unlock(); openNote(); });
    $('ico-bmp').addEventListener('click', () => { Snd.unlock(); openBmp(); });
    window.addEventListener('resize', fit);
    window.addEventListener('touchstart', () => { if (!S.touch) { S.touch = true; fit(); } }, { passive: true });
    window.addEventListener('blur', () => Input.clear());
    document.addEventListener('visibilitychange', () => { Snd.pause(document.hidden); Input.clear(); });
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click']) document.addEventListener(ev, () => Snd.unlock(), true);
    document.addEventListener('pointerdown', e => { if (menuEl && !menuEl.contains(e.target) && !(e.target.closest && e.target.closest('.mi'))) closeMenu(); }, true);
    window.addEventListener('keydown', e => {
      Snd.unlock();
      if (menuEl) { if (e.code === 'Escape') closeMenu(); return; }
      if (modals.length) { if (e.code === 'Escape') { const t = modals[modals.length - 1]; if (t.close) t.close(); } return; }
      if (!main) return;
      if (DEBUG) {
        if (e.code === 'F2') Game.debug('visit'); else if (e.code === 'F3') Game.debug('cone'); else if (e.code === 'F4') Game.debug('all');
      }
      const k = KEYMAP[e.code];
      if (k && !e.ctrlKey && !e.metaKey && !e.altKey) { Input.press(k); e.preventDefault(); }
    });
    window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) Input.release(k); });
  }
  return Object.assign(S, { init, launch, fit, msgBox, crash, finish, quit, openPicture, openList, openReadme, setHint, setMat, setSt, setClock, setTitle, setBusy, shake });
})();
