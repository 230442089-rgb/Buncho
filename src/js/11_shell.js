// ───────── 窓まわり（むかしのパソコンの画面）─────────
// デスクトップ、タスクバー、窓、メニュー、ダイアログ。飾りではなく、どれも実際に働く。
// ゲームの説明は、画面の中ではなく「よんでね.txt」に全部書いてある。
// ゲームは、ATELIER の窓がいちばん手前にあるときだけ進む。
const Shell = (() => {
  const S = { touch: false };
  const APP = '事象のアトリエ', MAX_DOCS = 12;
  let desk, wins, pad, tasksEl, main = null, readme = null, note = null, folder = null, viewer = null, listWin = null;
  let menuEl = null, menuBtn = null, modals = [], all = [], active = null, z = 10, busy = false, tipEl = null, tipT = 0, keyCap = null, starting = false, powerOff = false, selIcon = null, lastTouch = false;
  const ICON = {};
  const CALM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const $ = id => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const btn = (cls, txt) => { const b = el('button', cls, txt); b.type = 'button'; return b; };
  const bgi = (e, k) => { e.style.backgroundImage = 'url(' + (ICON[k] || '') + ')'; };
  const ic16 = k => (ICON[k + '16'] ? k + '16' : k);
  const curVer = () => verOf(Store.d.best);
  const base = () => APP + ' - ' + Store.d.cur;
  const keyLabel = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Space', Enter: 'Enter', Escape: 'Esc' };
  const keyName = c => keyLabel[c] || c.replace(/^Key|^Digit/, '').replace(/^Numpad/, 'Num');
  const keysOf = a => Input.keys[a].map(keyName).join(' / ');

  // ── 文書 ──
  // 幅をそろえて折り返す（全角 1 文字 = 2）
  const cols = s => { let n = 0; for (const ch of s) n += ch.codePointAt(0) < 0x100 ? 1 : 2; return n; };
  function wrapTo(text, max) {
    const out = []; let line = '';
    for (const wd of text.split(' ')) {
      if (line && cols(line) + 1 + cols(wd) > max) { out.push(line); line = wd; } else line = line ? line + ' ' + wd : wd;
    }
    if (line) out.push(line);
    return out;
  }
  function readmeText() {
    const v = curVer(), L = [];
    const log = (name, text) => wrapTo(text, 22).forEach((s, i) => L.push('　' + (i ? '　　　' : name) + '　' + s));
    L.push(
      '━━━━━━━━━━━━━━━━━', '　' + APP + '　' + verName(v), '━━━━━━━━━━━━━━━━━',
      '【ファイル名】ATELIER.EXE', '【種　　別】フリーソフト', '【作　　者】（空欄）', '【動作環境】あたらしめの ブラウザ', '',
      '■さいしょに', '　１．歩いて、四すみに 印の', '　　　ついた ものを 取り込む。', '　２．アトリエの 画架で 保存する。', '　３．画面が 止まったら、動かない。', '',
      '■これは なに？', '　果てのない 空間を 歩いて、', '　作品の 素材を 取り込む', '　ソフトです。', '　歩く人は なにも 話しません。', '　作品は 完成しません。', '',
      '■そうさ', '　あるく　　' + keysOf('up') + ' ' + keysOf('down'), '　　　　　　' + keysOf('left') + ' ' + keysOf('right'), '　　　　　　（十字ボタン）',
      '　取り込む　' + keysOf('act'), '　　　　　　を 押しつづける', '　　　　　　（Ａボタン）', '　キーは「設定」→「キー設定」', '　で 変えられます。', '',
      '■素材の 取り込み', '　・四すみに 印が ついた ものが、', '　　素材に なります。', '　・そばに 立って、取り込みの', '　　キーを 押しつづけます。',
      '　・取り込んだ ものは、その場から', '　　白く 抜けます。', '',
      '■保存', '　・取り込んだ だけでは、まだ', '　　保存されて いません。', '　・アトリエの 画架の 前で', '　　取り込みの キーを 押すと、', '　　保存されます。',
      '　　（ファイル → 上書き保存）', '　・保存は、アトリエの 中でしか', '　　できません。', '　・保存した 素材は、作品に', '　　描きこまれます。', '　　（表示 → 作品を見る）', '',
      '■空間に ついて', '　・アトリエの 外には、果てが', '　　ありません。', '　・離れた 場所は、戻ってくると', '　　中身が 変わって います。', '　　仕様です。',
      '　・ステータスバーの 数字は、', '　　画架からの 位置です。', '　・迷ったら', '　　ファイル → アトリエに戻る', '',
      '■更新', '　保存した 素材が ふえると、', '　ソフトが 更新されて、', '　つながる 空間の 種類が', '　ふえます。', '　（ヘルプ → 更新の確認）', '',
      '■ちゅうい（必ず お読みください）', '　・ときどき、画面が 止まります。', '　　（応答なし）', '　　故障では ありません。',
      '　・止まって いる あいだは、', '　　あなたも 動かないで ください。', '　・止まって いる ものは、', '　　見つかりません。',
      '　・動くと、見つかります。', '　　右下の 目盛りが いっぱいに', '　　なると、見つかった ことに', '　　なります。',
      '　・見つかって、つかまると、', '　　ソフトは 強制終了 します。', '　・保存して いない 素材は、', '　　強制終了で 失われます。', '　・アトリエの 中には、', '　　入ってきません。', '',
      '■こつ', '　・走る人は、止まるたびに', '　　時計まわりに 見まわします。', '　・走りだす 前に、影が 先に', '　　出ます。', '　・壁や 柱の かげは、', '　　見えません。',
      '　・背中がわは、すぐ そばで', '　　なければ 見えません。', '　・遠くへ 行くほど、素材を', '　　持って いるほど、よく 来ます。',
      '　・走る人の 影も、素材に', '　　なります。画面が 止まって', '　　いても 取り込めます。', '　　ただし 手が 動くので、', '　　見られて いると 気づかれます。', '',
      '■既知の 不具合', '　・ときどき、走る人が', '　　入ってきます。', '　　なおす 予定は ありません。', '　・影が 本人より 先に 来ます。', '　　仕様です。',
      '　・影が ふえる ことが あります。', '　　仕様です。', '　・窓の 外が 描画されません。', '　・だれも いません。', '',
      '■更新履歴');
    for (let i = v; i >= 1; i--) log(verName(i), VER_LOG[i]);
    log('0.71β', VER_LOG[0]);
    log('0.70β', '扉を ふやしました。 あかない 扉も ふやしました。');
    log('0.62β', '窓の 外を 消しました。');
    return L.join('\n');
  }
  function noteText() {
    const n = Store.d.crashes;
    let s = 'エデル姉へ\n\nきょうも 走ったよ。\nアトリエの 外がわを ぜんぶ。\nすっごい 速かった。\n\n見てた？\n';
    if (n >= 4) s += '\n見てなかったなら、もう一回 やるね。\nつぎは もっと 速く やるから。\nだから 見てて。\n';
    if (n >= 7) s += '\n見てて\n見てて\n見てて\n\n……姉ちゃん。\n';
    return s;
  }

  // ── 絵記号 ──
  function mkIcons() {
    const u = c => c.toDataURL(), K = '#000';
    const I = (k, w, h, fn) => { ICON[k] = u(C(w, h, fn)); };
    const page = (g, x, y, w, h, paper, ink, n) => { R(g, x, y, w, h, K); R(g, x + 1, y + 1, w - 2, h - 2, paper); for (let i = 0; i < n; i++) R(g, x + 3, y + 3 + i * (h > 20 ? 4 : 2), (w - 6) - ((i * 5) % 4), 1, ink); };
    const pict = (g, x, y, w, h) => { R(g, x, y, w, h, K); R(g, x + 1, y + 1, w - 2, h - 2, '#eee'); DI(g, x + 1, y + 1, w - 2, (h - 2) >> 1, '#778', 6); R(g, x + 1, y + 1 + ((h - 2) >> 1), w - 2, (h - 2) - ((h - 2) >> 1), '#99a'); R(g, x + (w >> 2), y + (h >> 2), w >> 3, w >> 3, '#dd9'); };
    const fold = (g, x, y, w, h) => { R(g, x, y + (h >> 2), w, h - (h >> 2), K); R(g, x + 1, y + (h >> 2) + 1, w - 2, h - (h >> 2) - 2, '#d8b850'); R(g, x, y, w >> 1, (h >> 2) + 1, K); R(g, x + 1, y + 1, (w >> 1) - 2, h >> 2, '#d8b850'); R(g, x + 1, y + (h >> 2) + 1, w - 2, 1, '#fff0b0'); };
    I('app', 32, 32, g => { LN(g, 9, 22, 4, 31, '#420'); LN(g, 10, 22, 5, 31, '#853'); LN(g, 22, 22, 27, 31, '#420'); LN(g, 21, 22, 26, 31, '#853'); R(g, 15, 22, 2, 9, '#420'); R(g, 3, 22, 26, 2, '#853'); pict(g, 4, 2, 24, 20); LN(g, 7, 18, 23, 14, '#306'); LN(g, 7, 19, 23, 15, '#306'); });
    I('app16', 16, 16, g => { LN(g, 4, 11, 2, 15, '#420'); LN(g, 11, 11, 13, 15, '#420'); R(g, 7, 11, 2, 4, '#420'); pict(g, 2, 1, 12, 10); });
    I('txt', 32, 32, g => { page(g, 6, 2, 20, 28, '#fff', '#558', 6); R(g, 20, 3, 5, 5, '#ccc'); });
    I('txt16', 16, 16, g => page(g, 3, 1, 10, 14, '#fff', '#558', 5));
    I('note', 32, 32, g => page(g, 6, 2, 20, 28, '#ffc', '#e60', 6));
    I('note16', 16, 16, g => page(g, 3, 1, 10, 14, '#ffc', '#e60', 5));
    I('folder', 32, 32, g => fold(g, 3, 5, 26, 22));
    I('folder16', 16, 16, g => fold(g, 1, 3, 14, 11));
    I('bmp16', 16, 16, g => pict(g, 1, 2, 14, 12));
    I('err', 32, 32, g => { EL(g, 16, 16, 15, 15, K); EL(g, 16, 16, 13, 13, '#c00'); for (let i = -6; i <= 6; i++) { R(g, 15 + i, 15 + i, 3, 3, '#fff'); R(g, 15 + i, 15 - i, 3, 3, '#fff'); } });
    I('info', 32, 32, g => { EL(g, 16, 16, 15, 15, K); EL(g, 16, 16, 13, 13, '#fff'); R(g, 14, 7, 4, 4, '#00a'); R(g, 14, 13, 4, 12, '#00a'); R(g, 12, 13, 2, 2, '#00a'); R(g, 12, 23, 8, 2, '#00a'); });
    I('ask', 32, 32, g => { EL(g, 16, 16, 15, 15, K); EL(g, 16, 16, 13, 13, '#fff'); R(g, 11, 8, 10, 3, '#00a'); R(g, 18, 10, 4, 6, '#00a'); R(g, 14, 15, 6, 3, '#00a'); R(g, 14, 17, 4, 3, '#00a'); R(g, 14, 22, 4, 4, '#00a'); R(g, 10, 10, 4, 3, '#00a'); });
    I('warn', 32, 32, g => { for (let y = 0; y < 27; y++) { const w = Math.round(y * 0.56); R(g, 14 - w, 2 + y, w * 2 + 4, 1, K); } for (let y = 3; y < 25; y++) { const w = Math.round(y * 0.56) - 2; R(g, 15 - w, 3 + y, w * 2 + 2, 1, '#fc0'); } R(g, 15, 11, 2, 9, K); R(g, 15, 22, 2, 3, K); });
    // 窓の右上のボタン
    I('b_min', 18, 16, g => R(g, 5, 11, 6, 2, K));
    I('b_max', 18, 16, g => { R(g, 4, 3, 9, 2, K); R(g, 4, 3, 1, 9, K); R(g, 12, 3, 1, 9, K); R(g, 4, 11, 9, 1, K); });
    I('b_res', 18, 16, g => { R(g, 6, 2, 7, 2, K); R(g, 12, 2, 1, 6, K); R(g, 11, 7, 2, 1, K); R(g, 6, 2, 1, 3, K); R(g, 4, 5, 7, 2, K); R(g, 4, 5, 1, 7, K); R(g, 10, 5, 1, 7, K); R(g, 4, 11, 7, 1, K); });
    I('b_x', 18, 16, g => { for (let i = 0; i < 7; i++) { R(g, 5 + i, 4 + i, 2, 1, K); R(g, 11 - i, 4 + i, 2, 1, K); } });
    // ツールバー
    I('t_new', 16, 16, g => { page(g, 3, 1, 10, 14, '#fff', '#fff', 0); R(g, 10, 1, 3, 3, '#c0c0c0'); LN(g, 10, 1, 12, 3, K); R(g, 10, 3, 3, 1, K); R(g, 10, 1, 1, 3, K); });
    I('t_open', 16, 16, g => { fold(g, 1, 3, 13, 11); for (let i = 0; i < 4; i++) R(g, 4 + i, 13 - i * 2, 11, 2, K); for (let i = 0; i < 4; i++) R(g, 5 + i, 13 - i * 2, 9, 1, '#fff0b0'); });
    I('t_save', 16, 16, g => { R(g, 1, 1, 14, 14, K); R(g, 2, 2, 12, 12, '#336'); R(g, 4, 2, 8, 5, '#fff'); R(g, 4, 10, 8, 4, '#ccc'); R(g, 9, 11, 2, 2, '#336'); });
    I('t_home', 16, 16, g => { for (let i = 0; i < 7; i++) R(g, 7 - i, 1 + i, 2 + i * 2, 1, K); R(g, 3, 8, 10, 7, K); R(g, 4, 8, 8, 6, '#fff'); R(g, 7, 10, 2, 4, '#853'); for (let i = 1; i < 6; i++) R(g, 8 - i, 2 + i, i * 2, 1, '#a44'); });
    I('t_pic', 16, 16, g => pict(g, 1, 2, 14, 12));
    I('t_list', 16, 16, g => { for (let i = 0; i < 4; i++) { R(g, 2, 2 + i * 3, 2, 2, '#63c'); R(g, 6, 2 + i * 3, 8, 1, K); } });
    I('t_help', 16, 16, g => { const c = '#00a'; R(g, 5, 2, 6, 2, c); R(g, 4, 3, 2, 3, c); R(g, 10, 3, 2, 4, c); R(g, 8, 6, 3, 2, c); R(g, 7, 7, 2, 3, c); R(g, 7, 12, 2, 2, c); });
    // タスクバー
    const spk = g => { R(g, 2, 6, 3, 4, K); for (let i = 0; i < 4; i++) R(g, 5 + i, 5 - i, 1, 6 + i * 2, K); };
    I('vol', 16, 16, g => { spk(g); R(g, 11, 6, 1, 4, K); R(g, 13, 4, 1, 8, K); });
    I('mute', 16, 16, g => { spk(g); for (let i = 0; i < 5; i++) { R(g, 10 + i, 5 + i, 2, 1, '#c00'); R(g, 14 - i, 5 + i, 2, 1, '#c00'); } });
    I('start', 16, 16, g => { for (let j = -6; j <= 6; j++) { const w = 6 - Math.abs(j); R(g, 8 - w - 1, 8 + j, w * 2 + 3, 1, K); } for (let j = -5; j <= 5; j++) { const w = 5 - Math.abs(j); R(g, 8 - w, 8 + j, w * 2 + 1, 1, j < -1 ? '#fff' : '#96f'); } });
    // 設定の部品
    I('chk', 13, 13, g => { [[3, 5], [4, 6], [5, 7], [6, 6], [7, 5], [8, 4], [9, 3]].forEach(p => R(g, p[0], p[1], 1, 3, K)); });
    I('dot', 13, 13, g => { R(g, 5, 4, 3, 5, K); R(g, 4, 5, 5, 3, K); });
    bgi($('ico-app').firstElementChild, 'app'); bgi($('ico-readme').firstElementChild, 'txt'); bgi($('ico-folder').firstElementChild, 'folder'); bgi($('ico-note').firstElementChild, 'note');
    bgi($('start').firstElementChild, 'start');
  }

  // ── 窓 ──
  function mkWin(title, opt) {
    opt = opt || {};
    const w = el('div', 'win ' + (opt.cls || '')), tb = el('div', 'tb'), ic = el('i', 'tb-ic'), tx = el('span', 'tb-tx', title), body = el('div', 'wb');
    if (opt.icon) bgi(ic, ic16(opt.icon)); else ic.hidden = true;
    tb.append(ic, tx);
    const win = { w, tb, tx, body, title, icon: opt.icon || null, close: null, onClose: null, min: false, task: null, taskTx: null, modal: false, blocker: null, app: !!opt.app, pos: null };
    const tbtn = (k, label, fn) => { const b = btn('tb-b'); b.setAttribute('aria-label', label); bgi(b, k); b.addEventListener('click', e => { e.stopPropagation(); fn(); }); tb.append(b); return b; };
    if (opt.min) win.bMin = tbtn('b_min', '最小化', () => minimize(win));
    if (opt.max) win.bMax = tbtn('b_max', '最大化', () => opt.max(win));
    win.bX = tbtn('b_x', '閉じる', () => { if (win.close) win.close(); }); win.bX.classList.add('x');
    if (opt.bare) tb.hidden = true;
    w.append(tb, body); wins.append(w);
    w.addEventListener('pointerdown', () => { if (active !== win) activate(win); }, true);
    drag(win);
    all.push(win);
    if (opt.task) addTask(win);
    return win;
  }
  const topWin = () => { let t = null; for (const o of all) if (!o.min && (!t || (+o.w.style.zIndex || 0) > (+t.w.style.zIndex || 0))) t = o; return t; };
  // ゲームを進めてよいか（ATELIER の窓が手前にあって、メニューもダイアログも開いていない）
  function sync() {
    const run = !!main && active === main && !main.min && !menuEl && !modals.length;
    if (Game.paused === run) { Game.paused = !run; Input.clear(); }
    pad.hidden = !S.touch || !main || main.min || active !== main;   // 十字ボタンは、ATELIER の窓が手前のときだけ出す
  }
  function flash(win) { Snd.sfx('err'); win.w.classList.add('flash'); setTimeout(() => win.w.classList.remove('flash'), 120); }
  function activate(win) {
    if (modals.length && !win.modal) { const m = modals[modals.length - 1]; if (m !== win) { flash(m); win = m; } }   // ダイアログが先
    if (win.min) { win.min = false; win.w.hidden = false; }
    if (win.blocker) win.blocker.style.zIndex = ++z;
    win.w.style.zIndex = ++z;
    active = win;
    for (const o of all) { o.w.classList.toggle('inact', o !== win); if (o.task) o.task.classList.toggle('on', o === win); }
    sync();
    if (win === main) fit();
  }
  function closeWin(win) {
    if (all.indexOf(win) < 0) return;
    if (win.task) win.task.remove();
    if (win.blocker) win.blocker.remove();
    win.w.remove();
    all = all.filter(o => o !== win); modals = modals.filter(o => o !== win);
    if (win.onClose) win.onClose();
    if (active === win) { active = null; const t = topWin(); if (t) activate(t); else sync(); } else sync();
    Input.clear();
  }
  function minimize(win) {
    win.min = true; win.w.hidden = true; Snd.sfx('close');
    if (win.task) win.task.classList.remove('on');
    if (active === win) { active = null; const t = topWin(); if (t) activate(t); else sync(); }
    if (win === main) fit();
  }
  function addTask(win) {
    const b = btn('task'), i = el('i'), sp = el('span', '', win.title);
    if (win.icon) bgi(i, ic16(win.icon)); else i.hidden = true;
    b.append(i, sp); tasksEl.append(b); win.task = b; win.taskTx = sp;
    b.addEventListener('click', () => { if (win.min || active !== win) activate(win); else minimize(win); });
  }
  function setWinTitle(win, t) { if (win.title === t) return; win.title = t; win.tx.textContent = t; if (win.taskTx) win.taskTx.textContent = t; }
  function place(win, dx, dy) {
    const w = win.w, DW = desk.clientWidth, DH = desk.clientHeight;
    w.style.left = clamp(Math.round((DW - w.offsetWidth) / 2) + (dx || 0), 0, Math.max(0, DW - w.offsetWidth)) + 'px';
    w.style.top = clamp(Math.round((DH - w.offsetHeight) / 2.6) + (dy || 0), 0, Math.max(0, DH - w.offsetHeight)) + 'px';
  }
  function drag(win) {
    const w = win.w, tb = win.tb;
    let on = false, sx = 0, sy = 0, ox = 0, oy = 0;
    tb.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || (win === main && S.touch)) return;
      on = true; sx = e.clientX; sy = e.clientY; ox = w.offsetLeft; oy = w.offsetTop;
      try { tb.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ }
    });
    tb.addEventListener('pointermove', e => {
      if (!on) return;
      const x = clamp(ox + e.clientX - sx, 40 - w.offsetWidth, desk.clientWidth - 40), y = clamp(oy + e.clientY - sy, 0, desk.clientHeight - 22);
      w.style.left = x + 'px'; w.style.top = y + 'px'; win.pos = { x, y }; win.autoPos = false;
    });
    const end = () => { on = false; };
    tb.addEventListener('pointerup', end); tb.addEventListener('pointercancel', end);
  }
  // ほかを さわれなくする窓
  function modalOpen(win) {
    const b = el('div', 'blocker');
    wins.insertBefore(b, win.w);
    b.addEventListener('pointerdown', () => flash(win));
    win.blocker = b; win.modal = true; modals.push(win);
    activate(win); Input.clear();
  }

  // ── ダイアログ ──
  function msgBox(o) {
    return new Promise(res => {
      const win = mkWin(o.title || APP, { cls: 'dlg', app: !o.sys });
      const row = el('div', 'dlg-row'), ic = el('i', 'dlg-ic'), tx = el('div', 'dlg-tx', o.text);
      bgi(ic, o.icon || 'info'); row.append(ic, tx); win.body.append(row);
      if (o.detail) win.body.append(el('pre', 'dlg-de', o.detail));
      const br = el('div', 'dlg-btns'), btns = o.buttons || ['OK'];
      let done = false, timer = 0;
      const fin = i => { if (done) return; done = true; clearTimeout(timer); Snd.sfx('blip'); closeWin(win); res(i); };
      btns.forEach((t, i) => { const bt = btn('btn', t); bt.addEventListener('click', () => fin(i)); br.append(bt); });
      win.body.append(br); win.close = () => fin(btns.length - 1);
      place(win, o.dx, o.dy); modalOpen(win);
      br.firstElementChild.focus({ preventScroll: true });
      Snd.sfx(o.icon === 'err' ? 'err' : 'ding');
      if (o.auto) timer = setTimeout(() => fin(0), o.auto);
    });
  }
  // ダイアログの枠。build(body, win, fin) で中身を作り、fin(値) で閉じる。×や Esc では null が返る。
  function dialog(title, opt, build) {
    return new Promise(res => {
      const win = mkWin(title, { cls: 'dlg ' + (opt.cls || ''), app: !opt.sys });
      let done = false;
      const fin = v => { if (done) return; done = true; if (win.onFin) win.onFin(); Snd.sfx('blip'); closeWin(win); res(v); };
      win.close = () => fin(null);
      build(win.body, win, fin);
      place(win); modalOpen(win);
      const f = win.body.querySelector('[data-focus]') || win.body.querySelector('.dlg-btns .btn');
      if (f) f.focus({ preventScroll: true });
      Snd.sfx('open');
    });
  }
  function btnRow(body, defs) {
    const br = el('div', 'dlg-btns');
    for (const d of defs) { const b = btn('btn', d[0]); b.addEventListener('click', d[1]); br.append(b); }
    body.append(br); return br;
  }
  function check(label, on, fn, radio) {
    const b = btn('ck'), i = el('i');
    b.setAttribute('role', radio ? 'radio' : 'checkbox');
    b.set = v => { b.setAttribute('aria-checked', v ? 'true' : 'false'); i.style.backgroundImage = v ? 'url(' + ICON[radio ? 'dot' : 'chk'] + ')' : 'none'; };
    b.append(i, el('span', '', label)); b.set(on);
    b.addEventListener('click', () => fn(b));
    return b;
  }
  function inputBox(title, label, value) {
    return dialog(title, {}, (body, win, fin) => {
      const f = el('input', 'fld'); f.type = 'text'; f.value = value || ''; f.maxLength = 12; f.spellcheck = false; f.autocomplete = 'off'; f.setAttribute('data-focus', '1'); f.setAttribute('aria-label', label);
      f.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.isComposing) fin(f.value); else if (e.key === 'Escape') fin(null); });
      body.append(el('div', 'dlg-tx', label), f);
      btnRow(body, [['OK', () => fin(f.value)], ['キャンセル', () => fin(null)]]);
      setTimeout(() => { try { f.select(); } catch (e) { /* なくても動く */ } }, 0);
    });
  }
  function pickDoc() {
    return dialog('開く', {}, (body, win, fin) => {
      const ls = el('div', 'list'), rows = {}; let sel = Store.d.cur;
      ls.style.maxHeight = Math.max(66, Math.min(220, desk.clientHeight - 170)) + 'px';
      for (const name of Object.keys(Store.d.docs)) {
        const r = btn('row' + (name === sel ? ' on' : ''));
        r.append(el('b', '', name + '.atl'), el('em', '', '素材 ' + Store.d.docs[name].total));
        r.addEventListener('click', () => { rows[sel].classList.remove('on'); sel = name; r.classList.add('on'); if (lastTouch) return; });
        r.addEventListener('dblclick', () => fin(name));
        rows[name] = r; ls.append(r);
      }
      body.append(el('div', 'dlg-tx', '作品を 選んで ください。'), ls);
      btnRow(body, [['開く', () => fin(sel)], ['キャンセル', () => fin(null)]]);
    });
  }
  function optionsDlg() {
    const old = JSON.stringify(Store.d.opt);
    const apply = () => { applyOpts(); Game.redraw(); };
    return dialog('オプション', {}, (body, win, fin) => {
      const op = Store.d.opt;
      const g1 = el('fieldset', 'grp'), r1 = el('div', 'orow'), r2 = el('div', 'orow'), rads = [];
      g1.append(el('legend', '', '画面')); r1.append(el('span', '', '色数'));
      [['16色', 0], ['256色', 1], ['ハイカラー', 2]].forEach(d => { const c = check(d[0], op.colors === d[1], () => { op.colors = d[1]; rads.forEach(q => q[0].set(q[1] === d[1])); apply(); }, true); rads.push([c, d[1]]); r1.append(c); });
      for (const d of [['走査線', 'scan'], ['粒子', 'grain'], ['日付', 'stamp']]) r2.append(check(d[0], !!op[d[1]], b => { op[d[1]] = op[d[1]] ? 0 : 1; b.set(op[d[1]]); apply(); }));
      g1.append(r1, r2);
      const g2 = el('fieldset', 'grp'), r3 = el('div', 'orow'), r4 = el('div', 'orow'), sl = el('input');
      g2.append(el('legend', '', '音')); sl.type = 'range'; sl.min = 0; sl.max = 100; sl.step = 5; sl.value = op.vol; sl.setAttribute('aria-label', '音量');
      sl.addEventListener('input', () => { op.vol = +sl.value; applyOpts(); });
      sl.addEventListener('change', () => Snd.sfx('ding'));
      r3.append(el('span', '', '音量'), sl);
      for (const d of [['効果音', 'sfx'], ['環境音', 'amb']]) r4.append(check(d[0], !!op[d[1]], b => { op[d[1]] = op[d[1]] ? 0 : 1; b.set(op[d[1]]); apply(); }));
      g2.append(r3, r4);
      body.append(g1, g2);
      btnRow(body, [['OK', () => fin(true)], ['キャンセル', () => fin(null)]]);
    }).then(ok => { if (!ok) Store.d.opt = Object.assign(Store.optDef(), JSON.parse(old)); Store.save(); applyOpts(); fit(); Game.redraw(); });
  }
  const KEYS = ['up', 'down', 'left', 'right', 'act'];
  function keysDlg() {
    const keys = JSON.parse(JSON.stringify(Input.keys));
    return dialog('キー設定', {}, (body, win, fin) => {
      const rows = {};
      const show = () => { for (const a of KEYS) { const on = !!keyCap && keyCap.a === a; rows[a].em.textContent = on ? 'キーを 押して ください' : keys[a].map(keyName).join(' / '); rows[a].r.classList.toggle('on', on); } };
      for (const a of KEYS) {
        const r = el('div', 'krow'), em = el('em'), b = btn('btn sm', '変更');
        r.append(el('b', '', KEY_NAMES[a]), em, b); rows[a] = { r, em }; body.append(r);
        b.addEventListener('click', () => {
          b.blur();
          keyCap = { a, set(code) { for (const o of Object.keys(keys)) keys[o] = keys[o].filter(c => c !== code); keys[a] = [code]; keyCap = null; show(); }, cancel() { keyCap = null; show(); } };
          show();
        });
      }
      show();
      win.onFin = () => { keyCap = null; };
      btnRow(body, [['OK', () => fin(keys)], ['標準に戻す', () => { for (const a of Object.keys(KEY_DEF)) keys[a] = KEY_DEF[a].slice(); keyCap = null; show(); }], ['キャンセル', () => fin(null)]]);
    }).then(k => {
      if (!k) return;
      for (const a of Object.keys(KEY_DEF)) if (!k[a] || !k[a].length) k[a] = KEY_DEF[a].filter(c => !Object.keys(k).some(o => o !== a && k[o] && k[o].indexOf(c) >= 0));
      Store.d.opt.keys = k; Store.save(); Input.setKeys(k);
      if (readme) readme.refresh();
    });
  }
  function openAbout() {
    return dialog('バージョン情報', { cls: 'about' }, (body, win, fin) => {
      const row = el('div', 'dlg-row'), pt = el('div', 'pt'), im = el('img');
      im.src = IMG.edelBust; im.width = 96; im.height = 96; im.alt = ''; im.draggable = false; pt.append(im);
      row.append(pt, el('div', 'dlg-tx', APP + '\nVersion ' + verName(curVer()) + '\n\nCopyright (C) 2003\n（空欄）'));
      body.append(row, el('pre', 'dlg-de', 'この ソフトは フリーソフトです。\n文字: DotGothic16 を 位置合わせして\n埋めこんで います (SIL OFL 1.1)。'));
      btnRow(body, [['OK', () => fin(true)]]);
    });
  }
  function checkUpdate() {
    const v = curVer();
    return msgBox({ title: '更新の確認', icon: 'info', text: '現在の バージョン: ' + verName(v) + '\n\n' + (v < VER_AT.length
      ? 'つぎの 更新は、保存した 素材が\n' + VER_AT[v] + '個に なると 配布されます。\n（いま ' + Store.d.best + '個）' : 'これより 新しい 版は\nありません。') });
  }
  // 更新のお知らせ（保存した素材が増えて、版が上がったとき）
  function notifyUpdate(v0, v1) {
    return dialog('更新', {}, (body, win, fin) => {
      const tx = el('div', 'dlg-tx', '更新を 適用して います…'), pg = el('div', 'prog'), bar = el('i'); pg.append(bar); body.append(tx, pg);
      const ok = btnRow(body, [['OK', () => fin(true)]]).firstElementChild; ok.disabled = true;
      Snd.sfx('update');
      let k = 0; const N = CALM ? 2 : 14;
      const iv = setInterval(() => {
        k++; bar.style.width = Math.min(100, Math.round(k / N * 100)) + '%';
        if (k < N) return;
        clearInterval(iv);
        let s = APP + ' を 更新しました。\n' + verName(v0) + ' → ' + verName(v1) + '\n';
        for (let i = v0 + 1; i <= v1; i++) s += '\n・' + VER_LOG[i];
        tx.textContent = s; ok.disabled = false; ok.focus({ preventScroll: true }); Snd.sfx('ding');
        if (readme) readme.refresh();
      }, 110);
      win.onFin = () => clearInterval(iv);
      win.close = () => { if (!ok.disabled) fin(true); };
    });
  }

  // ── メニュー ──
  function closeMenu(keep) {
    if (!menuEl) return;
    menuEl.remove(); menuEl = null;
    if (menuBtn) menuBtn.classList.remove('on'); menuBtn = null;
    if (!keep) { sync(); Input.clear(); }
  }
  function openMenu(anchor, items, up) {
    closeMenu(true);
    const m = el('div', 'menu');
    for (const it of items) {
      if (!it) { m.append(el('hr')); continue; }
      const b = btn(it.chk ? 'chk' : it.rad ? 'rad' : '');
      b.append(el('span', '', it.label)); if (it.key) b.append(el('span', '', it.key));
      if (it.ic) { b.classList.add('ic'); bgi(b, ic16(it.ic)); }
      if (it.dis) { b.classList.add('dis'); b.setAttribute('aria-disabled', 'true'); }
      const hint = () => { if (it.hint && main && main.mb.contains(anchor)) setMsg(typeof it.hint === 'function' ? it.hint() : it.hint); };
      b.addEventListener('pointerenter', hint); b.addEventListener('focus', hint);
      b.addEventListener('click', () => { if (it.dis) { Snd.sfx('empty'); return; } closeMenu(); Snd.sfx('blip'); it.fn(); });
      m.append(b);
    }
    wins.append(m);
    const dr = desk.getBoundingClientRect(), br = anchor.getBoundingClientRect(), maxY = Math.max(0, desk.clientHeight - m.offsetHeight);
    m.style.left = clamp(Math.round(br.left - dr.left), 0, Math.max(0, desk.clientWidth - m.offsetWidth)) + 'px';
    m.style.top = (up ? maxY : Math.min(Math.round(br.bottom - dr.top), maxY)) + 'px';
    menuEl = m; menuBtn = anchor; anchor.classList.add('on'); sync(); Input.clear();
  }
  // defs: [[見出し, 頭文字, 項目を返す関数], …]
  function menuBar(win, defs) {
    const mb = el('div', 'mb');
    for (const d of defs) {
      const b = btn('mi'); b.append(d[0], el('span', 'ak', '(' + d[1] + ')'));
      b.addEventListener('click', () => { if (busy && win === main) return; if (menuEl && menuBtn === b) closeMenu(); else { openMenu(b, d[2]()); Snd.sfx('blip'); } });
      b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && menuEl && menuBtn !== b && menuBtn && menuBtn.parentNode === mb) openMenu(b, d[2]()); });
      mb.append(b);
    }
    return mb;
  }
  function hideTip() { clearTimeout(tipT); if (tipEl) { tipEl.remove(); tipEl = null; } }
  function tip(e, text) {
    e.addEventListener('pointerenter', ev => {
      if (ev.pointerType !== 'mouse') return;
      clearTimeout(tipT);
      tipT = setTimeout(() => {
        hideTip();
        const t = el('div', 'tip', typeof text === 'function' ? text() : text); wins.append(t);
        const dr = desk.getBoundingClientRect(), r = e.getBoundingClientRect();
        let y = r.bottom - dr.top + 4; if (y + t.offsetHeight > desk.clientHeight) y = r.top - dr.top - t.offsetHeight - 4;
        t.style.left = clamp(Math.round(r.left - dr.left), 0, Math.max(0, desk.clientWidth - t.offsetWidth)) + 'px'; t.style.top = Math.round(y) + 'px'; tipEl = t;
      }, 600);
    });
    e.addEventListener('pointerleave', hideTip);
  }

  // ── 作品（ファイル）──
  async function discardOk() {
    if (!main || !Game.carry.length) return true;
    return (await msgBox({ icon: 'ask', text: '保存していない 素材が ' + Game.carry.length + 'つ あります。\n破棄しますか？', buttons: ['はい', 'いいえ'] })) === 0;
  }
  const tooMany = () => msgBox({ icon: 'warn', text: 'これ以上 作品を ふやせません。\n「作品」フォルダで 削除して ください。' });
  async function switchDoc(name) {
    activate(main);
    if (Game.mode !== 'play' || busy || !Store.d.docs[name]) { Snd.sfx('err'); return; }
    if (!(await discardOk())) return;
    Store.d.cur = name; Store.save();
    Game.open(name); Game.redraw(); docChanged();
  }
  function openDoc(name) { if (main) switchDoc(name); else launch(name); }
  async function newDoc() {
    if (Object.keys(Store.d.docs).length >= MAX_DOCS) { await tooMany(); return; }
    if (!(await discardOk())) return;
    let name = '無題', i = 2; while (Store.d.docs[name]) name = '無題' + (i++);
    Store.d.docs[name] = Store.newDoc(); Store.d.cur = name; Store.save();
    Game.open(name); docChanged();
  }
  async function openDlg() { const name = await pickDoc(); if (name) switchDoc(name); }
  async function saveAs() {
    if (!Game.inAtelier()) return;
    const v = await inputBox('名前を付けて保存', 'ファイル名', Store.d.cur);
    if (v == null || !main || !Game.inAtelier()) return;
    const name = v.replace(/[\\/:*?"<>|.\s]/g, '').slice(0, 12);
    if (!name) { Snd.sfx('err'); return; }
    if (name !== Store.d.cur) {
      if (Store.d.docs[name]) { if ((await msgBox({ icon: 'ask', text: '「' + name + '.atl」は すでに あります。\n上書きしますか？', buttons: ['はい', 'いいえ'] })) !== 0) return; }
      else if (Object.keys(Store.d.docs).length >= MAX_DOCS) { await tooMany(); return; }
      Store.d.docs[name] = JSON.parse(JSON.stringify(Store.doc())); Store.d.cur = name; Game.setDoc();
    }
    if (Game.carry.length) Game.saveAll(); else { Store.save(); Snd.sfx('save'); Game.say('保存しました', 3); }
    setTitle(null); docChanged();
  }
  function docChanged() { if (folder) folder.refresh(); if (listWin) listWin.refresh(); if (main) main.cache = {}; }

  // ── メモ帳・フォルダ・ビューア・素材リスト ──
  function openNotepad(file, icon, getText, cls) {
    const win = mkWin(file + ' - メモ帳', { cls: 'sheet pad0', icon, min: true, task: true });
    const pre = el('pre', 'txt' + (cls ? ' ' + cls : '')); pre.tabIndex = 0;
    let wrap = true;
    win.refresh = () => { const y = pre.scrollTop; pre.textContent = getText(); pre.scrollTop = y; };
    win.refresh();
    win.close = () => { Snd.sfx('close'); closeWin(win); };
    win.body.append(menuBar(win, [
      ['ファイル', 'F', () => [{ label: '閉じる', fn: () => win.close() }]],
      ['編集', 'E', () => [{ label: 'すべて選択', fn: () => { const r = document.createRange(), s = window.getSelection(); r.selectNodeContents(pre); s.removeAllRanges(); s.addRange(r); } }]],
      ['書式', 'O', () => [{ label: '右端で折り返す', chk: wrap, fn: () => { wrap = !wrap; pre.classList.toggle('nowrap', !wrap); } }]],
    ]), pre);
    pre.style.height = Math.max(120, Math.min(460, desk.clientHeight - 76)) + 'px';
    return win;
  }
  function openReadme() {
    if (readme) { activate(readme); return; }
    const win = readme = openNotepad('よんでね.txt', 'txt', readmeText);
    win.onClose = () => { readme = null; if (main && main.autoPos) { main.autoPos = false; main.pos = null; fit(); } };   // 並べるために寄せた窓を、まん中へ戻す
    place(win);
    // 画面が広ければ、ATELIER の窓と並べる
    if (main && !main.min && !S.touch) {
      const DW = desk.clientWidth, mw = main.w.offsetWidth, rw = win.w.offsetWidth;
      if (DW >= mw + rw + 24) {
        const x0 = Math.round((DW - mw - rw - 8) / 2);
        main.pos = { x: x0, y: main.w.offsetTop }; main.autoPos = true; main.w.style.left = x0 + 'px';
        win.w.style.left = (x0 + mw + 8) + 'px'; win.w.style.top = main.w.offsetTop + 'px';
      }
    }
    activate(win); Snd.sfx('open');
  }
  function openNote() {
    if (note) { activate(note); return; }
    const win = note = openNotepad('みてて.txt', 'note', noteText, 'note');
    win.onClose = () => { note = null; };
    place(win, 14, 14); activate(win); Snd.sfx('open');
  }
  function openViewer(title, src, cap, app) {
    if (viewer) closeWin(viewer);
    const win = viewer = mkWin(title + ' - ビューア', { cls: 'sheet pad0', icon: 'bmp', min: true, task: true, app: !!app });
    const pw = el('div', 'picw'), c = el('canvas', 'pic'), sb = el('div', 'sb');
    c.width = Picture.W; c.height = Picture.H; c.getContext('2d').drawImage(src, 0, 0);
    const s = Math.max(1, Math.min(2, Math.floor((desk.clientWidth - 30) / Picture.W), Math.floor((desk.clientHeight - 90) / Picture.H)));
    c.style.width = Picture.W * s + 'px'; c.style.height = Picture.H * s + 'px';
    pw.append(c); sb.append(el('span', 'sb-msg', cap)); win.body.append(pw, sb);
    win.close = () => { Snd.sfx('close'); closeWin(win); };
    win.onClose = () => { if (viewer === win) viewer = null; };
    place(win, 0, 10); activate(win); Snd.sfx('open');
  }
  function openPicture() {
    const d = Store.doc(), k = main ? Game.carry.length : 0;
    openViewer(Store.d.cur + '.bmp', Picture.get(d.mats), '128x96　素材 ' + d.mats.length + '個' + (k ? '　未保存 ' + k + '個' : ''), !!main);
  }
  function openList() {
    if (listWin) closeWin(listWin);
    const win = listWin = mkWin('素材リスト', { cls: 'sheet pad0', icon: 'app', min: true, task: true, app: true });
    const ls = el('div', 'list'), sb = el('div', 'sb'), s1 = el('span', 'sb-msg'); ls.tabIndex = 0;
    ls.style.height = Math.max(110, Math.min(300, desk.clientHeight - 110)) + 'px'; ls.style.maxHeight = 'none';
    win.refresh = () => {
      const d = Store.doc(), add = (m, un) => { const r = el('div', 'row' + (un ? ' un' : '')), i = el('i'); i.style.background = m.c; r.append(i, el('b', '', m.n), el('em', '', un ? '未保存' : '')); ls.append(r); };
      ls.textContent = '';
      for (let i = Game.carry.length - 1; i >= 0; i--) add(Game.carry[i], true);
      for (let i = d.mats.length - 1; i >= 0; i--) add(d.mats[i], false);
      if (!ls.firstChild) ls.append(el('div', 'row', '（なし）'));
      s1.textContent = '保存済 ' + d.total + '個' + (Game.carry.length ? '　未保存 ' + Game.carry.length + '個' : '');
    };
    win.refresh(); sb.append(s1); win.body.append(ls, sb);
    win.close = () => { Snd.sfx('close'); closeWin(win); };
    win.onClose = () => { if (listWin === win) listWin = null; };
    place(win, 0, 10); activate(win); Snd.sfx('open');
  }
  function openFolder() {
    if (folder) { activate(folder); return; }
    const win = folder = mkWin('作品', { cls: 'sheet pad0', icon: 'folder', min: true, task: true });
    const area = el('div', 'files'), sb = el('div', 'sb'), s1 = el('span', 'sb-msg');
    let sel = null, items = [];
    area.style.height = Math.max(120, Math.min(230, desk.clientHeight - 120)) + 'px';
    const openItem = it => { if (it.type === 'atl') openDoc(it.name); else openViewer(it.label, Picture.make(Store.d.docs[it.name].mats.slice(0, it.n)), it.info, false); };
    const canDel = it => !!it && (it.type === 'bmp' || (Object.keys(Store.d.docs).length > 1 && !(main && Store.d.cur === it.name)));
    const mark = () => { for (const it of items) it.b.classList.toggle('on', it === sel); s1.textContent = sel ? sel.label + '　' + sel.info : items.length + ' 個の オブジェクト'; };
    const delItem = async it => {
      if ((await msgBox({ title: 'ファイルの削除', icon: 'ask', sys: true, text: '「' + it.label + '」を\n削除しますか？', buttons: ['はい', 'いいえ'] })) !== 0) return;
      if (it.type === 'atl') { if (!canDel(it)) return; delete Store.d.docs[it.name]; if (Store.d.cur === it.name) Store.d.cur = Object.keys(Store.d.docs)[0]; }
      else if (Store.d.docs[it.name]) Store.d.docs[it.name].snaps.splice(it.i, 1);
      Store.save(); win.refresh();
    };
    win.refresh = () => {
      area.textContent = ''; items = []; sel = null;
      for (const name of Object.keys(Store.d.docs)) {
        const d = Store.d.docs[name];
        items.push({ type: 'atl', name, label: name + '.atl', info: '素材 ' + d.total + '個' });
        d.snaps.forEach((n, i) => items.push({ type: 'bmp', name, i, n, label: name + '_' + String(i + 1).padStart(2, '0') + '.bmp', info: '128x96　素材 ' + n + '個' }));
      }
      for (const it of items) {
        const b = btn('file'), ic = el('i');
        if (it.type === 'atl') bgi(ic, 'app'); else { ic.className = 'th'; ic.style.backgroundImage = 'url(' + Picture.make(Store.d.docs[it.name].mats.slice(0, it.n)).toDataURL() + ')'; }
        b.append(ic, el('span', '', it.label)); it.b = b; area.append(b);
        b.addEventListener('click', () => { sel = it; mark(); if (lastTouch) openItem(it); });
        b.addEventListener('dblclick', () => { if (!lastTouch) openItem(it); });
      }
      mark();
    };
    win.close = () => { Snd.sfx('close'); closeWin(win); };
    win.onClose = () => { folder = null; };
    sb.append(s1);
    win.body.append(menuBar(win, [
      ['ファイル', 'F', () => [{ label: '開く', dis: !sel, fn: () => openItem(sel) }, { label: '削除', dis: !canDel(sel), fn: () => delItem(sel) }, null, { label: '閉じる', fn: () => win.close() }]],
      ['表示', 'V', () => [{ label: '最新の情報に更新', fn: () => win.refresh() }]],
    ]), area, sb);
    win.refresh();
    place(win, -10, -6); activate(win); Snd.sfx('open');
  }

  // ── ATELIER の窓 ──
  const setOpt = (k, v) => { Store.d.opt[k] = v; Store.save(); applyOpts(); fit(); Game.redraw(); };
  // hint: 項目に重ねたとき、ステータスバーに出る説明
  const fileMenu = () => [
    { label: '新規作成', hint: '新しい 作品を 作ります', fn: newDoc },
    { label: '開く…', hint: 'ほかの 作品を 開きます', fn: openDlg },
    { label: '上書き保存', key: 'Ctrl+S', dis: !Game.canSave(), hint: () => (Game.canSave() ? '取り込んだ 素材を 保存します' : Game.inAtelier() ? '保存する 素材が ありません' : 'アトリエの 中でしか 保存できません'), fn: () => Game.saveAll() },
    { label: '名前を付けて保存…', dis: !Game.inAtelier(), hint: () => (Game.inAtelier() ? '別の 名前で 保存します' : 'アトリエの 中でしか 保存できません'), fn: saveAs },
    null,
    { label: 'アトリエに戻る', dis: !Game.canReturn(), hint: () => (Game.inAtelier() ? 'ここが アトリエです' : 'アトリエへ 戻ります'), fn: () => Game.returnHome() },
    { label: '作品フォルダを開く', hint: '保存した 作品の フォルダを 開きます', fn: openFolder },
    null,
    { label: '終了', hint: 'ATELIER を 終了します', fn: () => quit() },
  ];
  const viewMenu = () => {
    const op = Store.d.opt, zm = (t, v) => ({ label: t, rad: op.zoom === v, hint: '画面の 大きさを 変えます', fn: () => { if (main) main.pos = null; setOpt('zoom', v); } }), tg = (t, k) => ({ label: t, chk: !!op[k], hint: '表示を 切り替えます', fn: () => setOpt(k, op[k] ? 0 : 1) });
    return [{ label: '作品を見る', hint: 'いまの 作品を 表示します', fn: openPicture }, { label: '素材リスト', hint: '取り込んだ 素材の 一覧', fn: openList }, null, zm('大きさ 自動', 0), zm('大きさ ×1', 1), zm('大きさ ×2', 2), zm('大きさ ×3', 3), null, tg('ツールバー', 'tb'), tg('ステータスバー', 'sb'), tg('走査線', 'scan'), tg('日付', 'stamp')];
  };
  const optMenu = () => [{ label: 'オプション…', hint: '色数と 音の 設定', fn: optionsDlg }, { label: 'キー設定…', hint: 'キーの 割り当てを 変えます', fn: keysDlg }];
  const helpMenu = () => [{ label: 'よんでね', key: 'F1', hint: '説明書を 開きます', fn: openReadme }, { label: '更新の確認…', hint: 'つぎの 更新を 確かめます', fn: checkUpdate }, null, { label: 'バージョン情報…', hint: 'この ソフトに ついて', fn: openAbout }];
  function toggleMax() { const op = Store.d.opt; if (op.zoom === 0) op.zoom = main.lastZoom || 1; else { main.lastZoom = op.zoom; op.zoom = 0; } main.pos = null; Store.save(); fit(); Game.redraw(); }
  function buildMain() {
    const m = mkWin(base(), { cls: 'app', icon: 'app', min: true, max: toggleMax, task: true, app: true });
    const mb = menuBar(m, [['ファイル', 'F', fileMenu], ['表示', 'V', viewMenu], ['設定', 'O', optMenu], ['ヘルプ', 'H', helpMenu]]);
    const tbar = el('div', 'tbar'), tbn = {};
    for (const d of [['new', '新規作成', newDoc], ['open', '開く', openDlg], ['save', '上書き保存', () => Game.saveAll()], null, ['home', 'アトリエに戻る', () => Game.returnHome()], null, ['pic', '作品を見る', openPicture], ['list', '素材リスト', openList], null, ['help', 'よんでね', openReadme]]) {
      if (!d) { tbar.append(el('i', 'tsep')); continue; }
      const b = btn('tbtn'); b.setAttribute('aria-label', d[1]); bgi(b, 't_' + d[0]); tip(b, d[1]);
      b.addEventListener('click', () => { hideTip(); if (busy) return; Snd.sfx('blip'); d[2](); });
      tbar.append(b); tbn[d[0]] = b;
    }
    const cl = el('div', 'cl'), cv = el('canvas', 'view'), scan = el('div', 'scan'), sb = el('div', 'sb');
    cv.width = W; cv.height = H; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'アトリエの画面'); cl.append(cv, scan);
    const msg = el('span', 'sb-msg'), mat = el('span', 'sb-mat'), posEl = el('span', 'sb-pos'), gg = el('span', 'sb-gg'), gi = el('i');
    gg.append(gi); sb.append(msg, mat, posEl, gg); m.body.append(mb, tbar, cl, sb);
    tip(mat, '素材（保存済 +未保存）'); tip(posEl, '画架からの 位置');
    Object.assign(m, { mb, tbar, tbn, cv, scan, sb, msg, mat, posEl, gg, gi, cache: {}, lastZoom: 1 });
    m.close = () => quit();
    return m;
  }
  function applyOpts() {
    const op = Store.d.opt;
    Snd.setVol(op.vol); Snd.setSfx(op.sfx); Snd.setAmb(op.amb); Snd.mute(!!op.mute);
    bgi($('tray-vol'), op.mute ? 'mute' : 'vol');
    if (main) main.scan.classList.toggle('no', !op.scan);
  }
  // 画面の大きさ合わせ
  function fit() {
    pad.hidden = !S.touch || !main || main.min || active !== main;
    if (!main || main.min) return;
    const op = Store.d.opt, DW = desk.clientWidth, DH = desk.clientHeight, dpr = window.devicePixelRatio || 1;
    const side = S.touch && DW > DH * 1.25, padH = S.touch && !side ? 166 : 0, padW = side ? 330 : 0;
    pad.classList.toggle('side', side);
    const size = k => { main.cv.style.width = Math.round(W * k * dpr) / dpr + 'px'; main.cv.style.height = Math.round(H * k * dpr) / dpr + 'px'; };
    // 窓のふち・メニュー・ツールバー・ステータスバーの分を引いて、画面に入る最大の倍率を出す
    const room = () => Math.min((DW - padW - (main.w.offsetWidth - W)) / W, (DH - padH - (main.w.offsetHeight - H)) / H);
    main.tbar.hidden = !op.tb; main.sb.hidden = !op.sb;
    size(1);
    let fitS = room();
    if (fitS < 1 && !main.tbar.hidden) { main.tbar.hidden = true; fitS = room(); }   // 狭い画面では、ツールバーをたたむ
    // ドットがそろう倍率（端末の画素の整数倍）を優先。小さくなりすぎるときだけ半端な倍率を使う
    let s = Math.floor(fitS * dpr) / dpr;
    if ((s < fitS * 0.88 || s <= 0) && (dpr >= 1.5 || fitS < 1)) s = fitS >= 1 ? Math.floor(fitS * 4) / 4 : Math.floor(fitS * 100) / 100;
    s = clamp(s, 0.4, 4);
    if (op.zoom > 0) s = Math.min(op.zoom, s);
    size(s);
    main.w.style.setProperty('--px', s + 'px');
    main.w.classList.toggle('narrow', W * s < 420);
    bgi(main.bMax, op.zoom === 0 ? 'b_res' : 'b_max');
    main.bMax.setAttribute('aria-label', op.zoom === 0 ? '元に戻す' : '最大化');
    const ww = main.w.offsetWidth, wh = main.w.offsetHeight;
    let x = Math.round((DW - ww) / 2), y = Math.round((DH - padH - wh) / 2);
    if (main.pos && !S.touch) { x = clamp(main.pos.x, 40 - ww, DW - 40); y = clamp(main.pos.y, 0, Math.max(0, DH - 22)); }
    main.w.style.left = Math.max(S.touch ? 0 : 40 - ww, x) + 'px'; main.w.style.top = Math.max(0, y) + 'px';
  }

  // ── 起動・終了 ──
  function refreshDesk() { $('ico-note').hidden = Store.d.crashes < 2; }
  function splash(fast) {
    return new Promise(res => {
      const win = mkWin('', { cls: 'splash', bare: true, app: true });
      const im = el('img'); im.src = IMG.edelSplash; im.width = 144; im.height = 228; im.alt = ''; im.draggable = false;
      const ttl = C(32, 228, g => { Array.from(APP).forEach((ch, i) => Text.draw(g, ch, 0, 2 + i * 32, '#000', { scale: 2 })); }); ttl.className = 'ttl';
      const inf = el('div', 'inf'), pg = el('div', 'prog'), bar = el('i'); pg.append(bar);
      inf.append(el('div', '', 'Version\n' + verName(curVer()) + '\n\n(C) 2003'), pg, el('div', '', '読み込み中…'));
      win.body.append(im, ttl, inf);
      place(win); activate(win);
      let k = 0, done = false; const N = fast ? 4 : 9;
      const fin = () => { if (done) return; done = true; clearInterval(iv); closeWin(win); res(); };
      const iv = setInterval(() => { k++; bar.style.width = Math.round(k / N * 100) + '%'; if (k >= N) fin(); }, 120);
      win.w.addEventListener('click', fin);
    });
  }
  async function launch(name, quiet) {
    if (powerOff || starting) return;
    if (main) { if (name && name !== Store.d.cur) switchDoc(name); else activate(main); return; }
    starting = true;
    if (!quiet) { Snd.unlock(); Snd.sfx('boot'); }
    if (!DEBUG) await splash(Store.d.last === 'crash');   // 強制終了のあとは、起動画面を短く（やり直しは速く）
    starting = false;
    if (powerOff || main) return;
    const crashed = Store.d.last === 'crash';
    if (name && Store.d.docs[name]) Store.d.cur = name;
    main = buildMain(); busy = false;
    applyOpts(); fit();
    Game.init(main.cv); Game.open(Store.d.cur);
    Store.d.boots++; Store.save();
    activate(main); Game.redraw();   // ほかの窓が手前に来て止まっても、最初の 1 枚は見えているように
    if (crashed) Game.say('前回は 正常に 終了しませんでした', 6);
    if (!Store.d.readme && !DEBUG) { Store.d.readme = 1; Store.save(); openReadme(); }
  }
  // ATELIER の窓と、そこから開いた窓を ぜんぶ閉じる
  function closeApp() {
    closeMenu(true); hideTip();
    for (const o of all) if (o.app) { if (o.task) o.task.remove(); if (o.blocker) o.blocker.remove(); o.w.remove(); }
    all = all.filter(o => !o.app); modals = modals.filter(o => !o.app);
    if (viewer && viewer.app) viewer = null;
    main = null; listWin = null; busy = false; keyCap = null; active = null;
    Game.off(); Snd.amb(null); Input.clear();
    const t = topWin(); if (t) activate(t); else sync();
    refreshDesk(); fit();
  }
  async function quit() {
    if (!main || Game.mode === 'dead' || Game.mode === 'halt') return false;
    if (busy) { Snd.sfx('err'); return false; }   // 応答なし
    if (Game.carry.length > 0) {
      const i = await msgBox({ icon: 'ask', text: '保存していない 素材が ' + Game.carry.length + 'つ あります。\n終了すると 失われます。\n\n終了しますか？', buttons: ['はい', 'いいえ'] });
      if (i !== 0 || !main) return false;
    }
    Store.d.last = 'ok'; Store.save();
    Snd.sfx('close'); closeApp();
    return true;
  }
  // 強制終了
  async function crash() {
    const n = Store.d.crashes;
    closeMenu(); setBusy(true); setTitle('(応答なし)');
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
    const DW = desk.clientWidth, DH = desk.clientHeight;
    for (let i = 0; i < (CALM ? 1 : 9); i++) {
      const g = mkWin('見てて', { cls: 'dlg', app: true });
      const row = el('div', 'dlg-row'), ic = el('i', 'dlg-ic'); bgi(ic, 'err'); row.append(ic, el('div', 'dlg-tx', '見てて')); g.body.append(row);
      const br = el('div', 'dlg-btns'); br.append(btn('btn', '見てて')); g.body.append(br);
      g.w.style.left = clamp(Math.round(DW / 2 - 150 + i * 18), 0, Math.max(0, DW - g.w.offsetWidth)) + 'px';
      g.w.style.top = clamp(Math.round(DH / 2 - 150 + i * 16), 0, Math.max(0, DH - g.w.offsetHeight)) + 'px';
      activate(g); Snd.sfx('err');
      await wait(65);
      if (!main) return;
    }
    await wait(450);
    closeApp();
  }
  // 電源を切る
  async function shutdown() {
    if ((await msgBox({ title: '終了', icon: 'ask', sys: true, text: 'コンピュータの 電源を\n切りますか？', buttons: ['はい', 'いいえ'] })) !== 0) return;
    if (main && !(await quit())) return;   // 保存していない素材があれば、ここで聞かれる
    closeMenu(true); hideTip();
    for (const o of all) { if (o.task) o.task.remove(); if (o.blocker) o.blocker.remove(); o.w.remove(); }
    all = []; modals = []; active = null; readme = note = folder = viewer = listWin = null;
    powerOff = true; Snd.sfx('shut');
    $('off-tx').textContent = 'コンピュータの 電源を 切る\n準備が できました。';
    const off = $('off'); off.hidden = false;
    const on = () => { off.removeEventListener('pointerdown', on); off.hidden = true; powerOff = false; Snd.unlock(); Snd.sfx('boot'); refreshDesk(); };
    setTimeout(() => off.addEventListener('pointerdown', on), 900);
  }
  function startMenu() {
    const b = $('start');
    if (menuEl && menuBtn === b) { closeMenu(); return; }
    const items = [{ label: APP, ic: 'app', fn: () => launch() }, { label: '作品', ic: 'folder', fn: openFolder }, { label: 'よんでね.txt', ic: 'txt', fn: openReadme }];
    if (Store.d.crashes >= 2) items.push({ label: 'みてて.txt', ic: 'note', fn: openNote });
    items.push(null, { label: '終了…', fn: shutdown });
    openMenu(b, items, true); Snd.sfx('blip');
  }

  // ── 状態の表示（ゲームから呼ばれる）──
  function setCell(k, t) { if (!main) return; const c = main.cache; if (c[k] !== t) { c[k] = t; main[k].textContent = t; } }
  const setMsg = t => setCell('msg', t);
  // mat: 素材の数、pos: 位置、g: 発見の目盛り（0〜1。いないときは -1）
  function setInfo(mat, pos, g) {
    if (!main) return;
    setCell('mat', mat); setCell('posEl', pos);
    const c = main.cache, w = g <= 0 ? 0 : Math.ceil(clamp(g, 0, 1) * 5) * 7, hot = g >= 0.6, cs = Game.canSave(), cr = Game.canReturn();
    if (c.g !== w) { c.g = w; main.gi.style.width = w + 'px'; }
    if (c.hot !== hot) { c.hot = hot; main.gg.classList.toggle('warn', hot); }
    if (c.cs !== cs) { c.cs = cs; main.tbn.save.disabled = !cs; }
    if (c.cr !== cr) { c.cr = cr; main.tbn.home.disabled = !cr; }
  }
  function setTitle(t) { if (main) setWinTitle(main, t == null ? base() : (t[0] === '(' ? base() + ' ' + t : t)); }
  function setBusy(b) {
    if (busy === b) return;
    busy = b;
    if (!main) return;
    main.w.classList.toggle('busy', b);
    if (b && menuEl && menuBtn && main.mb.contains(menuBtn)) closeMenu();
  }
  function shake(on) { if (main) main.w.classList.toggle('shake', on); }
  function updClock() {
    if (main && Game.mode === 'play' && !Game.paused && Game.motion < 0.5) return;   // 世界が止まっているあいだは、時計も止まる
    const d = new Date(), t = String(d.getHours()).padStart(2, '0') + ((d.getSeconds() & 1) ? ' ' : ':') + String(d.getMinutes()).padStart(2, '0'), c = $('clock');
    if (c.textContent !== t) c.textContent = t;
  }

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
    const wake = () => { Snd.unlock(); if (main && active !== main && !modals.length) activate(main); };
    dp.addEventListener('pointerdown', e => { e.preventDefault(); wake(); down = true; try { dp.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ } setDir(calc(e)); });
    dp.addEventListener('pointermove', e => { if (down) setDir(calc(e)); });
    const up = () => { down = false; setDir(null); };
    dp.addEventListener('pointerup', up); dp.addEventListener('pointercancel', up); dp.addEventListener('lostpointercapture', up);
    ab.addEventListener('pointerdown', e => { e.preventDefault(); wake(); try { ab.setPointerCapture(e.pointerId); } catch (er) { /* なくても動く */ } Input.press('act'); ab.classList.add('on'); });
    const aup = () => { Input.release('act'); ab.classList.remove('on'); };
    ab.addEventListener('pointerup', aup); ab.addEventListener('pointercancel', aup); ab.addEventListener('lostpointercapture', aup);
    ab.addEventListener('contextmenu', e => e.preventDefault()); dp.addEventListener('contextmenu', e => e.preventDefault());
  }
  function deskIcon(id, fn) {
    const b = $(id);
    b.addEventListener('click', () => { if (selIcon && selIcon !== b) selIcon.classList.remove('on'); selIcon = b; b.classList.add('on'); if (lastTouch) fn(); });
    b.addEventListener('dblclick', () => { if (!lastTouch) fn(); });
    b.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); fn(); } });
  }
  function init() {
    desk = $('desk'); wins = $('wins'); pad = $('pad'); tasksEl = $('tasks');
    S.touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    mkIcons(); initPad(); refreshDesk(); applyOpts();
    deskIcon('ico-app', () => launch()); deskIcon('ico-readme', () => { Snd.unlock(); openReadme(); }); deskIcon('ico-folder', () => { Snd.unlock(); openFolder(); }); deskIcon('ico-note', () => { Snd.unlock(); openNote(); });
    $('start').addEventListener('click', startMenu);
    const tv = $('tray-vol');
    tv.addEventListener('click', () => { const op = Store.d.opt; op.mute = op.mute ? 0 : 1; Store.save(); applyOpts(); if (!op.mute) Snd.sfx('ding'); });
    tip(tv, () => (Store.d.opt.mute ? '音: 切' : '音: 入'));
    tip($('clock'), () => { const d = new Date(); return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; });
    updClock(); setInterval(updClock, 500);
    window.addEventListener('resize', fit);
    for (const e of [$('screen'), desk]) e.addEventListener('scroll', () => { e.scrollLeft = 0; e.scrollTop = 0; });   // 画面そのものは動かさない
    window.addEventListener('touchstart', () => { if (!S.touch) { S.touch = true; fit(); } }, { passive: true });
    window.addEventListener('blur', () => Input.clear());
    document.addEventListener('visibilitychange', () => { Snd.pause(document.hidden); Input.clear(); });
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click']) document.addEventListener(ev, () => Snd.unlock(), true);
    document.addEventListener('pointerdown', e => {
      lastTouch = e.pointerType === 'touch' || e.pointerType === 'pen'; hideTip();
      const t = e.target;
      if (menuEl && !menuEl.contains(t) && !(t.closest && (t.closest('.mi') || t.closest('#start')))) closeMenu();
      if (selIcon && !(t.closest && t.closest('.dicon'))) { selIcon.classList.remove('on'); selIcon = null; }
    }, true);
    // 押したボタンに入力の焦点を残さない（決定キーで、もう一度押されてしまうため）。ダイアログの中は別。
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.closest('.dlg')) b.blur(); });
    $('screen').addEventListener('contextmenu', e => { if (!(e.target.closest && e.target.closest('.txt, .fld'))) e.preventDefault(); });
    window.addEventListener('keydown', e => {
      Snd.unlock();
      if (powerOff) return;
      if (keyCap) { e.preventDefault(); if (e.code === 'Escape') keyCap.cancel(); else keyCap.set(e.code); return; }
      if (menuEl) { if (e.code === 'Escape') closeMenu(); return; }
      if (modals.length) { if (e.code === 'Escape') { const t = modals[modals.length - 1]; if (t.close) t.close(); } return; }
      if (!main || active !== main) { if (e.code === 'Escape' && active && active !== main && active.close) active.close(); return; }
      if (e.code === 'F1') { e.preventDefault(); openReadme(); return; }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); if (Game.canSave()) Game.saveAll(); else Snd.sfx('err'); return; }
      if (DEBUG) { if (e.code === 'F2') Game.debug('visit'); else if (e.code === 'F3') Game.debug('cone'); }
      const k = Input.map[e.code];
      if (k && !e.ctrlKey && !e.metaKey && !e.altKey) { Input.press(k); e.preventDefault(); }
    });
    window.addEventListener('keyup', e => { const k = Input.map[e.code]; if (k) { Input.release(k); if (main && active === main) e.preventDefault(); } });
  }
  return Object.assign(S, { init, launch, fit, msgBox, crash, quit, openPicture, openList, openReadme, openFolder, setMsg, setInfo, setTitle, setBusy, shake, notifyUpdate, docChanged, readmeText });
})();
