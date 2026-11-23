// 文鳥 vs ユリア — a small canvas boss fight. Logical size 720x1280 (portrait).
// Yuria and Vol are pre-rendered from the same SVG rig as the animations (chars.js).
(() => {
  'use strict';
  const W = 720, H = 1280;
  const TOP = 580, BOTTOM = 1196, LEFT = 46, RIGHT = 674; // the bird's free-flight box
  const RANGE = 760;                                      // longest peck-dash
  const stage = document.getElementById('stage');
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const muteBtn = document.getElementById('mute');
  const FONT = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic", sans-serif';
  const DISPLAY = '"Dela Gothic One", "Zen Maru Gothic", sans-serif';
  const INK = '#3D3456';
  let pxScale = 1;

  // ---------------------------------------------------------------- helpers
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const mix = (a, b, t) => {
    const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const store = {
    get(k, d) { try { const v = localStorage.getItem('buncho-vs-yuria:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('buncho-vs-yuria:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  };

  // ---------------------------------------------------------------- layout
  function fit() {
    const r = stage.parentElement.getBoundingClientRect();
    let w = r.width, h = w * 16 / 9;
    if (h > r.height) { h = r.height; w = h * 9 / 16; }
    w = Math.max(180, Math.floor(w)); h = Math.floor(w * 16 / 9);
    stage.style.width = w + 'px'; stage.style.height = h + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    pxScale = cv.width / W;
  }
  window.addEventListener('resize', fit);

  // ---------------------------------------------------------------- Yuria / Vol sprites (rendered once from the SVG rig)
  const DEFS = `<linearGradient id="gIrisY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F4A84"/><stop offset=".55" stop-color="#6D92CE"/><stop offset="1" stop-color="#CBE1F8"/></linearGradient>
<linearGradient id="gIrisV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#46679B"/><stop offset=".55" stop-color="#86ACD9"/><stop offset="1" stop-color="#DAECFA"/></linearGradient>
<linearGradient id="gIrisGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A4300"/><stop offset=".5" stop-color="#EBA81C"/><stop offset="1" stop-color="#FFEB94"/></linearGradient>
<linearGradient id="gIrisDragonV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#155A8C"/><stop offset=".5" stop-color="#55BDF0"/><stop offset="1" stop-color="#E6FAFF"/></linearGradient>
<filter id="fSoft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="fGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="fBlur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>`;
  const SP = { w: 620, h: 740, rx: 310, ry: 716, s: 1.05 };
  const HEAD_DY = SP.ry - 452 * SP.s;  // head centre inside the sprite (~241)
  const CHEST_DY = SP.ry - 272 * SP.s; // chest, where the hearts come from (~430)
  const BASE_Y = 18;                   // sprite top while she floats
  const PERCH = { dx: 30, dy: 74 };    // where the bird sits on her head
  const HAND = { dx: 0, dy: 466 };     // her cupped hands in the 'catch' pose
  const YU_POSE = {
    idle: { eyes: 'open', mouth: 'smile', look: [0, 0.6], blush: 0.25 },
    blink: { eyes: 'closed', mouth: 'smile', blush: 0.25 },
    taunt: { eyes: 'wink', winkSide: 1, mouth: 'tongue', blush: 0.45, armR: 150 },
    cast: { eyes: 'open', mouth: 'grin', look: [0, 0.6], armL: 150, armR: 150, blush: 0.3 },
    beam: { eyes: 'half', mouth: 'smile', look: [0, 0.8], armR: 100, blush: 0.2 },
    hit: { eyes: 'shut', mouth: 'wavy', blush: 0.95, brows: 'worry' },
    guard: { eyes: 'smile', mouth: 'grin', armL: -40, armR: -40, blush: 0.3 },
    selfie: { eyes: 'wink', winkSide: 1, mouth: 'grin', armR: 160, itemR: 'phone', blush: 0.4 },
    dragon: { eyes: 'open', dragon: 1, mouth: 'flat', brows: 'angry', look: [0, 0.6] },
    dragonCast: { eyes: 'open', dragon: 1, mouth: 'open', brows: 'angry', armL: 150, armR: 150 },
    defeat: { eyes: 'heart', mouth: 'grin', blush: 1 },
    happy: { eyes: 'smile', mouth: 'cat', blush: 0.6, armL: -36, armR: -36 },
    catch: { eyes: 'smile', mouth: 'cat', blush: 0.75, armL: -22, armR: -22 },
  };
  const VOL_POSE = {
    volGlare: { eyes: 'half', mouth: 'small', hiddenEye: 0.6, blush: 0.3, look: [-0.6, -0.6], brows: 'angry' },
    volSmile: { eyes: 'smile', mouth: 'smile', blush: 0.6, brows: 'soft' },
  };
  const SPR = {};
  function spriteSVG(who, o) {
    U.resetUid();
    const body = charSVG(who, Object.assign({ x: SP.rx, y: SP.ry, s: SP.s, t: 0, blink: 0, noShadow: true }, o));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SP.w}" height="${SP.h}" viewBox="0 0 ${SP.w} ${SP.h}"><defs>${DEFS}</defs>${body}</svg>`;
  }
  function svgToCanvas(svg) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => {
        try { const c = document.createElement('canvas'); c.width = SP.w; c.height = SP.h; c.getContext('2d').drawImage(im, 0, 0); res(c); } catch (e) { res(im); }
      };
      im.onerror = () => res(null);
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }
  function loadSprites() {
    const jobs = [];
    for (const [k, o] of Object.entries(YU_POSE)) jobs.push(svgToCanvas(spriteSVG('yuria', Object.assign({ walk: 0.08 }, o))).then(c => { SPR[k] = c; }));
    for (const [k, o] of Object.entries(VOL_POSE)) jobs.push(svgToCanvas(spriteSVG('vol', Object.assign({ upperOnly: true }, o))).then(c => { SPR[k] = c; }));
    return Promise.all(jobs);
  }

  // ---------------------------------------------------------------- audio (starts on the first tap)
  const SFX_GAIN = { peck: 2.0, dash: 1.6, bounce: 1.5, hurt: 1.55, heal: 4.5, warn: 2.6, beam: 1.8, wave: 2.4, stasis: 2.8, shutter: 2.8, win: 3.4, lose: 4.0, shot: 1.3, phase: 3.6, start: 4.2, select: 1.0, chirp: 1.3 };
  const BGM_GAIN = 0.32;
  const AU = { ctx: null, master: null, buf: {}, src: null, gain: null, name: null, muted: store.get('muted', false), loading: null };
  function initAudio() {
    if (AU.loading) return AU.loading;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      AU.ctx = new AC();
      const comp = AU.ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.ratio.value = 6;
      AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.muted ? 0 : 1;
      AU.master.connect(comp); comp.connect(AU.ctx.destination);
    } catch (e) { AU.ctx = null; AU.loading = Promise.resolve(); return AU.loading; }
    const names = Object.keys(SFX_GAIN).concat(['bgm_title', 'bgm_battle']);
    AU.loading = Promise.all(names.map(n => fetch(`audio/${n}.mp3`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then(b => new Promise((res, rej) => AU.ctx.decodeAudioData(b, res, rej)))
      .then(d => { AU.buf[n] = d; })
      .catch(() => { /* a missing sound just stays silent */ })));
    return AU.loading;
  }
  function sceneMusic() {
    if (G.scene === 'title') return 'bgm_title';
    if (G.scene === 'intro' || G.scene === 'play') return 'bgm_battle';
    if (G.won && (G.scene === 'winSeq' || G.scene === 'result')) return 'bgm_title';
    return '';
  }
  function ensureAudio() {
    const p = initAudio();
    if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume().catch(() => {});
    p.then(() => { if (AU.name === null) bgm(sceneMusic()); });
  }
  function sfx(name, vol = 1, rate = 1) {
    if (!AU.ctx || AU.muted || !AU.buf[name]) return;
    const s = AU.ctx.createBufferSource(), g = AU.ctx.createGain();
    s.buffer = AU.buf[name]; s.playbackRate.value = rate; g.gain.value = vol * (SFX_GAIN[name] || 1);
    s.connect(g); g.connect(AU.master); s.start();
  }
  function bgm(name) {
    if (!AU.ctx || AU.name === name) return;
    const now = AU.ctx.currentTime;
    if (AU.src) { const old = AU.src; AU.gain.gain.setTargetAtTime(0, now, 0.25); setTimeout(() => { try { old.stop(); } catch (e) { /* already stopped */ } }, 1600); }
    AU.src = null; AU.name = name;
    if (!name || !AU.buf[name]) return;
    const s = AU.ctx.createBufferSource(), g = AU.ctx.createGain();
    s.buffer = AU.buf[name]; s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(BGM_GAIN, now, 0.3);
    s.connect(g); g.connect(AU.master); s.start(); AU.src = s; AU.gain = g;
  }
  function setMuted(m) {
    AU.muted = m; store.set('muted', m);
    muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false'); muteBtn.textContent = m ? '音：オフ' : '音：オン';
    if (AU.master) AU.master.gain.setTargetAtTime(m ? 0 : 1, AU.ctx.currentTime, 0.05);
  }
  setMuted(AU.muted);
  muteBtn.addEventListener('click', () => { ensureAudio(); setMuted(!AU.muted); });
  document.addEventListener('visibilitychange', () => {
    if (!AU.ctx) return;
    if (document.hidden) AU.ctx.suspend().catch(() => {}); else AU.ctx.resume().catch(() => {});
  });

  // ---------------------------------------------------------------- the bird
  const BIRDS = {
    sakura: { name: '桜文鳥', body: '#8F8E99', belly: '#D9D2D8', head: '#27252E', cheek: '#FFFFFF', wing: '#797884', tail: '#27252E' },
    white: { name: '白文鳥', body: '#FBFAFD', belly: '#FFFFFF', head: '#FBFAFD', cheek: '#FFFFFF', wing: '#ECE9F4', tail: '#EFEDF6' },
    cinnamon: { name: 'シナモン文鳥', body: '#CDAA8C', belly: '#F0E2D4', head: '#8C6449', cheek: '#FFFFFF', wing: '#B69173', tail: '#8C6449' },
  };
  function drawBird(x, y, dir, t, o = {}) {
    const c = BIRDS[o.color || G.color] || BIRDS.sakura;
    const s = o.s || 1;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt || 0); ctx.scale(dir * (o.sx || 1) * s, (o.sy || 1) * s);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.feet) {
      ctx.strokeStyle = '#E86F82'; ctx.lineWidth = 4.5; ctx.beginPath();
      ctx.moveTo(-4, 24); ctx.lineTo(-6, 36); ctx.moveTo(10, 24); ctx.lineTo(10, 36);
      ctx.moveTo(-14, 37); ctx.lineTo(2, 37); ctx.moveTo(2, 37); ctx.lineTo(18, 37); ctx.stroke();
    }
    ctx.lineWidth = 2.6; ctx.strokeStyle = INK;
    // tail
    ctx.fillStyle = c.tail; ctx.beginPath(); ctx.moveTo(-28, -2); ctx.lineTo(-62, -14); ctx.lineTo(-60, 6); ctx.lineTo(-28, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    // body + belly
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.ellipse(0, 4, 38, 29, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.belly; ctx.beginPath(); ctx.ellipse(8, 14, 26, 17, 0.1, 0, Math.PI * 2); ctx.fill();
    // wing
    const flap = o.flap != null ? o.flap : Math.sin(t * 24) * 0.7;
    ctx.save(); ctx.translate(-6, -2); ctx.rotate(-0.35 - flap * 0.6);
    ctx.fillStyle = c.wing; ctx.beginPath(); ctx.ellipse(-6, 0, 26, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(61,52,86,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-24, 2); ctx.lineTo(8, 2); ctx.moveTo(-20, 7); ctx.lineTo(4, 7); ctx.stroke();
    ctx.restore(); ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
    // head + white cheek
    ctx.fillStyle = c.head; ctx.beginPath(); ctx.arc(24, -16, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = c.cheek; ctx.beginPath(); ctx.ellipse(26, -6, 15, 11, -0.2, 0, Math.PI * 2); ctx.fill();
    // eye
    if (o.hurt) { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(25, -26); ctx.lineTo(33, -20); ctx.lineTo(25, -14); ctx.stroke(); }
    else if (o.happy) { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(29, -18, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else {
      ctx.fillStyle = '#F7A0AA'; ctx.beginPath(); ctx.arc(29, -20, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1E1B26'; ctx.beginPath(); ctx.arc(29, -20, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(27.5, -21.5, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    // thick pink beak
    ctx.fillStyle = '#F0566A'; ctx.strokeStyle = '#B83248'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(38, -24); ctx.quadraticCurveTo(58, -18, 56, -10); ctx.quadraticCurveTo(48, -4, 38, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, -14); ctx.lineTo(54, -12); ctx.stroke();
    if (o.blush) { ctx.fillStyle = 'rgba(255,140,170,.6)'; ctx.beginPath(); ctx.ellipse(20, -5, 7, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- game state
  const G = {
    scene: 'title', t: 0, sceneT: 0, color: store.get('color', 'sakura'), best: store.get('best', null), won: false,
    bird: null, yu: null, bullets: [], beams: [], rings: [], fx: [], texts: [], items: [], bubble: null,
    shake: 0, flash: 0, gold: 0, freeze: 0, btnFlash: 0, keys: {}, stats: null, dialog: null, lineIdx: 0, lineT: 0,
    itemT: 0, tip: '', volKey: null, volT: 0,
  };
  if (!BIRDS[G.color]) G.color = 'sakura';
  const newYuria = () => ({ x: 360, y: BASE_Y, comp: 100, phase: 1, mode: 'attack', modeT: 0, cycle: 0, phaseCycle: 0, script: [], scriptI: 0, pose: 'idle', poseT: 0, hitT: 0, barrier: 1, openings: 0, spiral: 0, spT: 0, selfieDone: false });
  function resetBattle() {
    G.bird = { x: 300, y: 1000, dir: 1, hp: 5, inv: 0, dashing: false, dashT: 0, dashDur: 0, dashCd: 0, from: null, to: null, knock: 0, kvx: 0, kvy: 0, hurtT: 0, perched: false };
    G.yu = newYuria();
    G.bullets = []; G.beams = []; G.rings = []; G.fx = []; G.texts = []; G.items = []; G.bubble = null;
    G.flash = 0; G.gold = 0; G.freeze = 0; G.shake = 0; G.itemT = 14; G.volKey = null; G.volT = 0;
    G.stats = { time: 0, pecks: 0, hits: 0 };
  }
  const headPos = () => ({ x: G.yu.x, y: G.yu.y + HEAD_DY });
  const chestPos = () => ({ x: G.yu.x, y: G.yu.y + CHEST_DY });
  const shieldPos = () => ({ x: G.yu.x, y: G.yu.y + 300, r: 232 });
  function say(text, dur = 2.2, who = 'yuria') { G.bubble = { text, t: 0, dur, who }; }
  function popText(text, x, y, col = '#FF5C8D', size = 40) { G.texts.push({ text, x, y, t: 0, col, size }); }
  function burst(x, y, n, kind, col) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(120, 380);
      G.fx.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, t: 0, life: rnd(0.5, 1.0), r: rnd(0, Math.PI * 2), col });
    }
  }

  // ---------------------------------------------------------------- lines
  const PECK_LINES = ['ちょ、くすぐったいって！', 'つんつんすんなし♡', 'うわ、ちっちゃいのに強っ', 'も〜、かわいいかよ', 'そこアホ毛だから！'];
  const BOUNCE_LINES = ['ざんねーん♪', 'まだガード中〜', 'よゆーよゆー♪'];
  const HURT_LINES = ['あ、ごめっ！', '痛くない？　だいじょぶ？', 'わ、当たっちゃった'];
  const TIPS = ['バリアが消えた「今だ！」の間だけ、\nくちばしが通る', '遠すぎると、くちばしは届かない。\n少し近づいてからつつこう', '粟穂を食べると、羽が1枚もどる', 'ユリアの「波」は生き物を止められない。\n止まるのはハートだけ'];
  const INTRO = [
    { text: 'え、文鳥じゃん！　かわいー♡', d: 2.4, pose: 'idle' },
    { text: '……ん？　あーしとやる気？\nいーよ、かかってきな♪', d: 3.0, pose: 'taunt' },
  ];
  const WIN = [
    { text: 'むり……かわいすぎ……♡\nあーしの負け', d: 2.8, pose: 'defeat' },
    { text: '……ゆり姉。\nその子、なんですか', d: 2.6, pose: 'defeat', who: 'vol', vol: 'volGlare' },
    { text: '今日から、うちの子♡', d: 2.4, pose: 'happy', vol: 'volGlare' },
    { text: '……ゆり姉がいいなら♡\nでも、膝の上は私の席ですからね', d: 3.4, pose: 'happy', who: 'vol', vol: 'volSmile' },
  ];
  const LOSE = [
    { text: 'はい、つかまえた♡\n……ちっちゃ。かわいー', d: 2.8, pose: 'catch' },
    { text: 'また遊ぼ？\n次はもっと本気でおいで♪', d: 2.6, pose: 'catch' },
  ];

  // ---------------------------------------------------------------- attacks
  function heartShot(x, y, a, speed, col, r = 15) { G.bullets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, rot: a, col }); }
  function fan(n, spread, speed, offset = 0) {
    const c = chestPos(), b = G.bird, base = Math.atan2(b.y - c.y, b.x - c.x) + offset;
    const col = G.yu.phase === 3 ? '#FFC44D' : '#FF6F9C';
    for (let i = 0; i < n; i++) heartShot(c.x, c.y, base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread), speed, col);
    sfx('shot', 0.8, rnd(0.95, 1.1));
  }
  function ring(n, speed, phase = 0) {
    const c = chestPos();
    for (let i = 0; i < n; i++) heartShot(c.x, c.y, phase + i / n * Math.PI * 2, speed, '#FF8FB1', 14);
    sfx('shot', 0.9);
  }
  function wave() { const c = chestPos(); G.rings.push({ x: c.x, y: c.y, r: 70, v: 520 }); sfx('wave', 0.8); }
  function beamAt(a, warn = 0.9, spin = 0) { const c = chestPos(); G.beams.push({ x: c.x, y: c.y, a, warn, t: 0, w: 46, spin }); }
  function aimedBeam(deg = 0) { const c = chestPos(), b = G.bird; beamAt(Math.atan2(b.y - c.y, b.x - c.x) + deg * Math.PI / 180); sfx('warn', 0.7); }
  function stasis() { G.freeze = 0.9; sfx('stasis', 0.9); popText('ピタッ', 360, 690, '#FFD36B', 72); say('――止まって', 1.5); }
  function sweepBeams() {
    const c = chestPos(), b = G.bird, a0 = Math.atan2(b.y - c.y, b.x - c.x);
    for (const d of [-0.62, 0, 0.62]) beamAt(a0 + d - 0.3, 0.8, 0.6);
    sfx('warn', 0.8);
  }
  function buildScript(ph, cyc) {
    const yu = G.yu;
    if (ph === 1) return [
      [0.35, () => fan(5, 0.7, 225)],
      [1.3, () => fan(5, 0.7, 225, 0.14)],
      [2.2, wave],
      [2.8, () => fan(7, 1.1, 215)],
      [3.8, () => ring(8, 190, cyc * 0.3)],
    ];
    if (ph === 2) {
      const s = [
        [0.35, () => { aimedBeam(-10); aimedBeam(10); }],
        [1.4, () => ring(12, 240, cyc * 0.26)],
        [2.4, () => fan(7, 0.9, 270)],
        [3.2, () => aimedBeam(0)],
        [3.9, () => { wave(); fan(5, 0.6, 280); }],
      ];
      if (!yu.selfieDone && yu.phaseCycle >= 1) {
        yu.selfieDone = true;
        s.push([1.9, () => { yu.pose = 'selfie'; yu.poseT = 1.4; say('はい、チーズ♡', 1.4); }]);
        s.push([2.8, () => { G.flash = 0.9; sfx('shutter', 1); popText('パシャッ', yu.x + 130, yu.y + 160, '#FF5C8D', 52); }]);
      }
      return s;
    }
    return [
      [0.2, () => { yu.spiral = 2.2; }],
      [2.6, stasis],
      [3.6, sweepBeams],
    ];
  }
  const ATTACK_LEN = { 1: 4.6, 2: 4.8, 3: 5.0 };
  const OPEN_LEN = { 1: 2.9, 2: 2.6, 3: 2.3 };
  function beginAttack(grace = 0) {
    const yu = G.yu;
    yu.mode = 'attack'; yu.modeT = -grace; yu.scriptI = 0;
    yu.script = buildScript(yu.phase, yu.cycle).sort((a, b) => a[0] - b[0]);
  }
  function beginOpen() {
    const yu = G.yu, s = shieldPos();
    yu.mode = 'open'; yu.modeT = 0; yu.openings++;
    burst(s.x, s.y, 18, 'spark', '#BFEFFF'); sfx('bounce', 0.6, 0.7);
    if (yu.openings <= 2) popText('今だ！つつけ！', 360, 640, '#FF5C8D', 56);
  }

  // ---------------------------------------------------------------- pecking / getting hit
  function tryPeck() {
    const b = G.bird;
    if (G.scene !== 'play' || b.dashing || b.dashCd > 0 || b.knock > 0) return false;
    const h = headPos(), dx = h.x - b.x, dy = h.y - b.y, d = Math.hypot(dx, dy) || 1;
    const want = Math.max(0, d - 64);                 // the beak meets her face a little before the centre
    const len = Math.min(want, RANGE);
    b.toHead = want <= RANGE;
    b.from = { x: b.x, y: b.y }; b.to = { x: b.x + dx / d * len, y: b.y + dy / d * len };
    b.dashing = true; b.dashT = 0; b.dashDur = 0.1 + len / 2600; b.dashCd = 0.8; b.dir = dx >= 0 ? 1 : -1;
    sfx('dash', 0.8);
    return true;
  }
  function knockBack(kvx, kvy, t = 0.4) { const b = G.bird; b.knock = t; b.kvx = kvx; b.kvy = kvy; b.inv = Math.max(b.inv, 0.55); }
  function endDash(kind) {
    const b = G.bird, yu = G.yu;
    b.dashing = false;
    if (kind === 'arrive' && yu.mode === 'attack' && yu.barrier > 0.5) kind = 'bounce';
    if (kind === 'bounce') {
      const s = shieldPos(), d = Math.hypot(b.x - s.x, b.y - s.y) || 1;
      sfx('bounce', 0.9); popText('カキン！', b.x, b.y - 54, '#4FB8E8', 46); burst(b.x, b.y - 30, 7, 'spark', '#BFEFFF');
      if (Math.random() < 0.5) say(pick(BOUNCE_LINES), 1.3);
      if (yu.poseT <= 0.2) { yu.pose = 'guard'; yu.poseT = 0.6; }
      knockBack((b.x - s.x) / d * 520, 620 + Math.max(0, (b.y - s.y) / d) * 200);
    } else if (kind === 'arrive') {
      const dmg = yu.phase === 3 ? 3 : 4;
      yu.comp = Math.max(0, yu.comp - dmg); G.stats.pecks++;
      yu.pose = 'hit'; yu.poseT = 0.5; yu.hitT = 0.35; G.shake = 0.22;
      sfx('peck', 1); sfx('chirp', 0.8, rnd(0.95, 1.1));
      popText('つん！', b.x + 40, b.y - 44, '#FF5C8D', 54); burst(b.x + 30, b.y - 20, 8, 'heart');
      if (Math.random() < 0.6) say(pick(PECK_LINES), 1.6);
      knockBack(rnd(-160, 160), 820, 0.38);
    } else {
      popText('とどかない…', b.x, b.y - 50, '#8C7AB8', 36);
      knockBack(0, 260, 0.25);
    }
  }
  function hurtBird() {
    const b = G.bird;
    if (b.inv > 0 || b.dashing || G.scene !== 'play') return false;
    b.hp--; G.stats.hits++; b.inv = 1.4; b.hurtT = 0.5; G.shake = 0.3;
    sfx('hurt', 1); popText('チュンッ！', b.x, b.y - 54, '#8C7AB8', 44); burst(b.x, b.y, 10, 'feather', BIRDS[G.color].body);
    G.bullets = G.bullets.filter(q => Math.hypot(q.x - b.x, q.y - b.y) > 150); // a little mercy
    if (b.hp > 0 && Math.random() < 0.4) say(pick(HURT_LINES), 1.3);
    if (b.hp <= 0) endBattle(false);
    return true;
  }

  // ---------------------------------------------------------------- scene flow
  const rankOf = s => (s.hits <= 1 && s.time <= 95 ? 'S' : s.hits <= 3 && s.time <= 150 ? 'A' : 'B');
  function startGame() {
    ensureAudio();
    resetBattle();
    G.bird.x = -90; G.bird.y = 960;
    G.scene = 'intro'; G.sceneT = 0; G.won = false; startDialog(INTRO);
    sfx('start', 0.9); sfx('chirp', 0.9);
    initAudio().then(() => bgm('bgm_battle'));
  }
  function toTitle() {
    G.scene = 'title'; G.sceneT = 0; G.yu = null; G.bird = null; G.bubble = null; G.fx = []; G.texts = [];
    sfx('select', 0.8); bgm('bgm_title');
  }
  function endBattle(won) {
    const yu = G.yu, b = G.bird;
    G.won = won; G.scene = won ? 'winSeq' : 'loseSeq'; G.sceneT = 0;
    G.bullets = []; G.beams = []; G.rings = []; G.items = []; G.freeze = 0; G.bubble = null;
    yu.spiral = 0; yu.barrier = 0; yu.hitT = 0; yu.poseT = 0;
    b.dashing = false; b.knock = 0; b.inv = 0; b.perched = false;
    G.volKey = null; G.volT = 0; startDialog(won ? WIN : LOSE);
    bgm(won ? 'bgm_title' : '');
    if (won) {
      sfx('win', 1); burst(headPos().x, headPos().y, 30, 'heart');
      const s = G.stats; s.rank = rankOf(s);
      if (!G.best || s.time < G.best.time) { G.best = { time: s.time, rank: s.rank }; store.set('best', G.best); s.newBest = true; }
    } else {
      sfx('lose', 1); G.tip = pick(TIPS);
    }
  }
  // visual-novel style lines: typed out, tap to show all / go on, and they also move on by themselves
  const CPS = 28;
  const lineLen = l => [...l.text.replace(/\n/g, '')].length;
  function startDialog(lines) { G.dialog = lines; G.lineIdx = 0; G.lineT = 0; applyLine(); }
  function applyLine() {
    const l = G.dialog[G.lineIdx];
    if (l.pose && G.yu) G.yu.pose = l.pose;
    if (l.vol) { if (!G.volKey) G.volT = 0; G.volKey = l.vol; }
  }
  function advanceDialog() {
    const l = G.dialog[G.lineIdx];
    if (G.lineT * CPS < lineLen(l)) { G.lineT = lineLen(l) / CPS + 0.01; return; }
    G.lineIdx++; G.lineT = 0;
    if (G.lineIdx >= G.dialog.length) finishDialog(); else { applyLine(); sfx('select', 0.35, 1.2); }
  }
  function finishDialog() {
    G.bubble = null;
    if (G.scene === 'intro') { G.scene = 'play'; G.sceneT = 0; beginAttack(0.6); popText('START!', 360, 690, '#FF5C8D', 92); sfx('select', 1); }
    else { G.scene = 'result'; G.sceneT = 0; }
  }

  // ---------------------------------------------------------------- input
  const BTN = { x: 610, y: 1166, r: 78 };
  const UI = [];
  const ptrs = new Map();
  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  function toLogical(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
  const inDialog = () => G.scene === 'intro' || G.scene === 'winSeq' || G.scene === 'loseSeq';
  function moveBird(dx, dy) {
    const b = G.bird;
    if (!b || b.dashing || b.knock > 0) return;
    const top = Math.min(TOP, b.y);
    b.x = clamp(b.x + dx, LEFT, RIGHT); b.y = clamp(b.y + dy, top, BOTTOM);
    if (Math.abs(dx) > 0.6) b.dir = dx > 0 ? 1 : -1;
  }
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); ensureAudio();
    try { cv.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    const p = toLogical(e);
    for (const u of UI) if (inRect(p, u)) { u.fn(); return; }
    if (inDialog()) { if (G.sceneT > (G.scene === 'intro' ? 0.45 : 1.0)) advanceDialog(); return; }
    if (G.scene !== 'play') return;
    if (Math.hypot(p.x - BTN.x, p.y - BTN.y) < BTN.r + 16) { if (tryPeck()) G.btnFlash = 0.18; return; }
    ptrs.set(e.pointerId, { x: p.x, y: p.y, t: performance.now(), moved: 0 });
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cv.addEventListener('pointermove', e => {
    const s = ptrs.get(e.pointerId);
    if (!s) return;
    const p = toLogical(e), dx = (p.x - s.x) * 1.3, dy = (p.y - s.y) * 1.3;
    s.x = p.x; s.y = p.y; s.moved += Math.hypot(dx, dy);
    if (G.scene === 'play') moveBird(dx, dy);
  });
  function release(e) {
    ensureAudio();
    const s = ptrs.get(e.pointerId);
    if (!s) return;
    ptrs.delete(e.pointerId);
    if (e.type === 'pointerup' && G.scene === 'play' && performance.now() - s.t < 240 && s.moved < 22) tryPeck();
  }
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (e.target === muteBtn && (k === ' ' || k === 'enter')) return;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    G.keys[k] = true;
    if (e.repeat) return;
    ensureAudio();
    if (k === 'm') { setMuted(!AU.muted); return; }
    const action = k === ' ' || k === 'z' || k === 'enter';
    if (G.scene === 'title') {
      if (action) startGame();
      if (k === 'arrowleft' || k === 'arrowright') {
        const ks = Object.keys(BIRDS), i = ks.indexOf(G.color);
        G.color = ks[(i + (k === 'arrowright' ? 1 : ks.length - 1)) % ks.length]; store.set('color', G.color); sfx('select', 0.6); sfx('chirp', 0.5, 1.1);
      }
    } else if (G.scene === 'play') { if (action) tryPeck(); }
    else if (inDialog()) { if (action && G.sceneT > (G.scene === 'intro' ? 0.3 : 1.0)) advanceDialog(); }
    else if (G.scene === 'result') { if (action && G.sceneT > 0.6) startGame(); if (k === 'escape') toTitle(); }
  });
  window.addEventListener('keyup', e => { G.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { G.keys = {}; ptrs.clear(); });

  // ---------------------------------------------------------------- update
  function update(dt) {
    G.t += dt; G.sceneT += dt;
    G.shake = Math.max(0, G.shake - dt); G.flash = Math.max(0, G.flash - dt * 2.6); G.btnFlash = Math.max(0, G.btnFlash - dt);
    for (const f of G.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; f.vx *= 0.98; }
    G.fx = G.fx.filter(f => f.t < f.life);
    for (const p of G.texts) p.t += dt;
    G.texts = G.texts.filter(p => p.t < 1);
    if (G.bubble) { G.bubble.t += dt; if (G.bubble.t > G.bubble.dur) G.bubble = null; }
    if (G.scene === 'play') updatePlay(dt);
    else if (inDialog()) updateDialog(dt);
    else if (G.scene === 'result') { G.yu.y = BASE_Y + Math.sin(G.t * 1.3) * 8; followBird(dt); }
  }

  function updateDialog(dt) {
    const yu = G.yu;
    yu.x = lerp(yu.x, 360, Math.min(1, dt * 1.5)); yu.y = BASE_Y + Math.sin(G.t * 1.3) * 8; yu.hitT = 0;
    G.gold = lerp(G.gold, 0, Math.min(1, dt * 1.5));
    if (G.volKey) G.volT += dt;
    G.lineT += dt;
    const l = G.dialog[G.lineIdx];
    if (G.lineT > Math.max(l.d, lineLen(l) / CPS + 1.6)) advanceDialog();
    if (inDialog()) followBird(dt);
  }
  function followBird(dt) {
    const b = G.bird, yu = G.yu;
    if (!b) return;
    let tx, ty;
    if (G.scene === 'intro') { tx = 300; ty = 1000; b.dir = 1; }
    else if (G.won) { tx = yu.x + PERCH.dx; ty = yu.y + PERCH.dy; }
    else { tx = yu.x + HAND.dx; ty = yu.y + HAND.dy; }
    const d = Math.hypot(tx - b.x, ty - b.y);
    if (G.scene !== 'intro' && d > 4) b.dir = tx >= b.x ? 1 : -1;
    if (b.perched || d < 5) { b.perched = G.scene !== 'intro'; b.x = tx; b.y = ty; if (b.perched) b.dir = G.won ? 1 : -1; }
    else { const k = Math.min(1, dt * 3.2); b.x = lerp(b.x, tx, k); b.y = lerp(b.y, ty, k); }
  }

  function updatePlay(dt) {
    const yu = G.yu, b = G.bird;
    G.stats.time += dt;
    yu.x = 360 + Math.sin(G.t * 0.7) * 40; yu.y = BASE_Y + Math.sin(G.t * 1.3) * 10;
    // phase changes
    const ph = yu.comp > 66 ? 1 : yu.comp > 33 ? 2 : 3;
    if (ph !== yu.phase) {
      yu.phase = ph; yu.phaseCycle = 0; yu.spiral = 0;
      G.bullets = []; G.beams = []; G.rings = []; G.freeze = 0;
      sfx('phase', 1);
      popText(`PHASE ${ph}`, 360, 690, ph === 3 ? '#FFB020' : '#FF5C8D', 84);
      if (ph === 2) say('やるじゃん。\nじゃあ、ちょっとだけ本気ね♪', 2.4);
      if (ph === 3) { say('……マジで来るじゃん', 2.0); G.flash = 0.7; }
      beginAttack(0.9);
    }
    G.gold = lerp(G.gold, ph === 3 ? 1 : 0, Math.min(1, dt * 1.5));
    // attack windows and openings
    yu.modeT += dt;
    if (yu.mode === 'attack') {
      yu.barrier = Math.min(1, yu.barrier + dt * 4);
      while (yu.scriptI < yu.script.length && yu.modeT >= yu.script[yu.scriptI][0]) { yu.script[yu.scriptI][1](); yu.scriptI++; }
      if (yu.poseT <= 0) {
        const m = Math.max(0, yu.modeT);
        yu.pose = ph === 3 ? (m % 1.6 < 0.8 ? 'dragonCast' : 'dragon') : (m % 2 < 0.9 ? 'cast' : ph === 2 ? 'beam' : 'idle');
      }
      if (yu.spiral > 0) {
        yu.spiral -= dt; yu.spT += dt;
        while (yu.spT > 0.09) {
          yu.spT -= 0.09;
          const a = G.t * 2.6, c = chestPos();
          heartShot(c.x, c.y, a, 210, '#FFC44D', 13); heartShot(c.x, c.y, a + Math.PI, 210, '#FFC44D', 13);
        }
      }
      if (yu.modeT >= ATTACK_LEN[ph]) beginOpen();
    } else {
      yu.barrier = Math.max(0, yu.barrier - dt * 5);
      if (yu.poseT <= 0) yu.pose = ph === 3 ? 'dragon' : ph === 2 ? 'idle' : 'taunt';
      if (ph > 1 && yu.modeT >= 1.0 && yu.modeT - dt < 1.0) fan(ph === 2 ? 3 : 5, 0.6, ph === 2 ? 210 : 230);
      if (yu.modeT >= OPEN_LEN[ph]) { yu.cycle++; yu.phaseCycle++; beginAttack(0); }
    }
    yu.poseT -= dt; yu.hitT = Math.max(0, yu.hitT - dt);

    // the bird
    if (b.dashing) {
      b.dashT += dt;
      const p = Math.min(1, b.dashT / b.dashDur), e = 1 - (1 - p) * (1 - p);
      b.x = lerp(b.from.x, b.to.x, e); b.y = lerp(b.from.y, b.to.y, e);
      if (Math.random() < 0.6) G.fx.push({ kind: 'trail', x: b.x, y: b.y, vx: 0, vy: 0, t: 0, life: 0.22, dir: b.dir });
      const s = shieldPos();
      if (yu.mode === 'attack' && yu.barrier > 0.5 && Math.hypot(b.x - s.x, b.y - s.y) < s.r + 12) endDash('bounce');
      else if (p >= 1) endDash(b.toHead ? 'arrive' : 'short');
    } else if (b.knock > 0) {
      const k = clamp(b.knock / 0.4, 0, 1);
      b.knock -= dt;
      b.x = clamp(b.x + b.kvx * dt * k, LEFT, RIGHT); b.y = clamp(b.y + b.kvy * dt * k, 120, BOTTOM);
    } else {
      const k = G.keys;
      let mx = 0, my = 0;
      if (k.arrowleft || k.a) mx -= 1;
      if (k.arrowright || k.d) mx += 1;
      if (k.arrowup || k.w) my -= 1;
      if (k.arrowdown || k.s) my += 1;
      if (mx || my) { const l = Math.hypot(mx, my); moveBird(mx / l * 520 * dt, my / l * 520 * dt); }
      if (b.y < TOP) b.y = Math.min(TOP, b.y + (260 + (TOP - b.y) * 5) * dt); // drift back down after a peck
    }
    b.dashCd = Math.max(0, b.dashCd - dt); b.inv = Math.max(0, b.inv - dt); b.hurtT = Math.max(0, b.hurtT - dt);

    // the wave can't stop a living bird, but it still shoves
    for (const r of G.rings) {
      r.r += r.v * dt;
      const d = Math.hypot(b.x - r.x, b.y - r.y) || 1;
      if (Math.abs(d - r.r) < 30 && !b.dashing) moveBird((b.x - r.x) / d * 300 * dt, (b.y - r.y) / d * 300 * dt);
    }
    G.rings = G.rings.filter(r => r.r < 1500);
    // hearts (stasis freezes them, then they all turn toward the bird)
    if (G.freeze > 0) {
      G.freeze -= dt;
      if (G.freeze <= 0) {
        for (const q of G.bullets) { const a = Math.atan2(b.y - q.y, b.x - q.x) + rnd(-0.1, 0.1); q.vx = Math.cos(a) * 240; q.vy = Math.sin(a) * 240; }
        sfx('shot', 1, 0.8);
      }
    } else {
      for (const q of G.bullets) { q.x += q.vx * dt; q.y += q.vy * dt; q.rot += dt * 3; }
    }
    G.bullets = G.bullets.filter(q => q.x > -60 && q.x < W + 60 && q.y > -60 && q.y < H + 60);
    for (const q of G.bullets) if (!q.dead && Math.hypot(q.x - b.x, q.y - b.y) < q.r + 15 && hurtBird()) q.dead = true;
    G.bullets = G.bullets.filter(q => !q.dead);
    // beams
    for (const bm of G.beams) {
      bm.t += dt;
      const live = bm.t > bm.warn && bm.t < bm.warn + 0.45;
      if (bm.spin && live) bm.a += bm.spin * 1.2 * dt;
      if (bm.t > bm.warn && !bm.fired) { bm.fired = true; sfx('beam', 0.8); G.shake = Math.max(G.shake, 0.15); }
      if (live) {
        const ux = Math.cos(bm.a), uy = Math.sin(bm.a), px = b.x - bm.x, py = b.y - bm.y;
        if (px * ux + py * uy > 0 && Math.abs(-px * uy + py * ux) < bm.w / 2 + 12) hurtBird();
      }
    }
    G.beams = G.beams.filter(bm => bm.t < bm.warn + 0.55);
    // millet sprays heal one feather
    G.itemT -= dt;
    if (G.itemT <= 0) { G.itemT = 18; G.items.push({ x: rnd(100, 620), y: rnd(720, 1100), t: 0 }); }
    for (const it of G.items) {
      it.t += dt;
      if (Math.hypot(it.x - b.x, it.y - b.y) < 50) {
        it.got = true; if (b.hp < 5) b.hp++;
        sfx('heal', 0.9); sfx('chirp', 0.7, 1.15); popText('ちゅん♪', it.x, it.y - 34, '#5E9E2E', 44);
      }
    }
    G.items = G.items.filter(it => !it.got && it.t < 9);
    if (G.scene === 'play' && yu.comp <= 0) endBattle(true);
  }

  // ---------------------------------------------------------------- drawing helpers
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function text(str, x, y, size, col, align = 'center', weight = 700, family = FONT, stroke = null, sw = 0) {
    ctx.font = `${weight} ${size}px ${family}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (stroke) { ctx.lineWidth = sw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
    ctx.fillStyle = col; ctx.fillText(str, x, y);
  }
  function heartPath(x, y, s, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, -0.22); ctx.bezierCurveTo(0, -0.52, -0.5, -0.55, -0.5, -0.18); ctx.bezierCurveTo(-0.5, 0.12, -0.18, 0.3, 0, 0.5); ctx.bezierCurveTo(0.18, 0.3, 0.5, 0.12, 0.5, -0.18); ctx.bezierCurveTo(0.5, -0.55, 0, -0.52, 0, -0.22); ctx.closePath();
    ctx.restore();
  }
  // speech bubble; the tail points at (tx,ty); below=true puts the box under that point
  function bubble(str, who, tx, ty, below) {
    const lines = str.split('\n');
    ctx.font = `700 30px ${FONT}`;
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 52, h = lines.length * 42 + 28;
    const x = clamp(tx - w / 2, 16, W - 16 - w), y = below ? ty + 24 : ty - 24 - h;
    const col = who === 'vol' ? '#79AEE0' : '#F0AE34';
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    rr(x, y, w, h, 24); ctx.fill(); ctx.stroke();
    const bx = clamp(tx, x + 34, x + w - 34), edge = below ? y : y + h, inner = below ? y + 4 : y + h - 4;
    ctx.beginPath(); ctx.moveTo(bx - 15, inner); ctx.lineTo(tx, ty); ctx.lineTo(bx + 15, inner); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 15, edge); ctx.lineTo(tx, ty); ctx.lineTo(bx + 15, edge); ctx.stroke();
    lines.forEach((l, i) => text(l, x + w / 2, y + 35 + i * 42, 30, INK));
  }

  // ---------------------------------------------------------------- scene pieces
  function drawSky() {
    const k = G.gold;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, mix('#8FCBFF', '#2A1E5C', k)); g.addColorStop(0.55, mix('#CFE8FF', '#7A4FA8', k)); g.addColorStop(1, mix('#FFF2F6', '#F2B45A', k));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1 - k * 0.85;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 220 + G.t * (12 + i * 4)) % (W + 300)) - 150, y = 520 + i * 150;
      for (const [dx, dy, r] of [[0, 0, 42], [40, -16, 50], [86, 0, 40], [44, 12, 46]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (k > 0.02) { // phase 3: the lattice of her true form turning behind her
      ctx.save(); ctx.globalAlpha = k * 0.45; ctx.translate(360, 330); ctx.rotate(G.t * 0.15); ctx.strokeStyle = '#FFE6A0'; ctx.lineWidth = 3;
      for (let rg = 1; rg <= 3; rg++) { ctx.beginPath(); for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2, r = rg * 170; if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.stroke(); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 510, Math.sin(a) * 510); ctx.stroke(); }
      ctx.restore();
      for (let i = 0; i < 26; i++) { const x = (i * 97) % W, y = (i * 173 + G.t * 30) % H; ctx.fillStyle = `rgba(255,236,170,${(0.25 + 0.5 * Math.abs(Math.sin(G.t * 2 + i))) * k})`; ctx.fillRect(x, y, 3, 3); }
    }
  }
  function drawYuria() {
    const yu = G.yu;
    if (!yu) return;
    let key = yu.pose;
    if ((key === 'idle' || key === 'cast' || key === 'beam') && (G.t % 3.7) < 0.13) key = 'blink';
    const im = SPR[key] || SPR.idle;
    // soft glow under her floating feet
    const fx = yu.x, fy = yu.y + SP.ry + 8;
    const g = ctx.createRadialGradient(fx, fy, 4, fx, fy, 130);
    g.addColorStop(0, G.gold > 0.5 ? 'rgba(255,214,107,.6)' : 'rgba(150,215,255,.55)'); g.addColorStop(1, 'rgba(150,215,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(fx, fy, 130, 34, 0, 0, Math.PI * 2); ctx.fill();
    if (G.gold > 0.02) {
      const c = chestPos(), a = ctx.createRadialGradient(c.x, c.y - 120, 40, c.x, c.y - 120, 330);
      a.addColorStop(0, `rgba(255,214,107,${0.5 * G.gold})`); a.addColorStop(1, 'rgba(255,214,107,0)');
      ctx.fillStyle = a; ctx.beginPath(); ctx.arc(c.x, c.y - 120, 330, 0, Math.PI * 2); ctx.fill();
    }
    if (!im) return;
    const sx = yu.hitT > 0 ? Math.sin(G.t * 80) * 8 * (yu.hitT / 0.35) : 0;
    ctx.drawImage(im, yu.x - SP.rx + sx, yu.y);
  }
  function drawBarrier() {
    const yu = G.yu;
    if (!yu || yu.barrier <= 0.01 || G.scene !== 'play') return;
    const s = shieldPos();
    ctx.save(); ctx.globalAlpha = yu.barrier;
    const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.5, s.x, s.y, s.r);
    g.addColorStop(0, 'rgba(160,230,255,0)'); g.addColorStop(0.85, 'rgba(160,230,255,.16)'); g.addColorStop(1, 'rgba(200,245,255,.5)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = G.gold > 0.5 ? 'rgba(255,226,150,.85)' : 'rgba(190,240,255,.85)'; ctx.lineWidth = 4;
    ctx.setLineDash([18, 14]); ctx.lineDashOffset = -G.t * 40; ctx.beginPath(); ctx.arc(s.x, s.y, s.r - 2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  function drawVulnerable() {
    const yu = G.yu;
    if (!yu || yu.mode !== 'open' || G.scene !== 'play') return;
    const h = headPos(), p = (G.t * 2) % 1, b = G.bird;
    const inRange = Math.hypot(h.x - b.x, h.y - b.y) - 64 <= RANGE;
    ctx.strokeStyle = `rgba(255,92,141,${(inRange ? 0.85 : 0.35) * (1 - p)})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(h.x, h.y, 120 + p * 40, 0, Math.PI * 2); ctx.stroke();
  }
  function drawShots() {
    for (const r of G.rings) {
      ctx.strokeStyle = G.gold > 0.5 ? 'rgba(255,214,107,.8)' : 'rgba(127,227,255,.8)'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    }
    for (const bm of G.beams) {
      const L = 1700, ex = bm.x + Math.cos(bm.a) * L, ey = bm.y + Math.sin(bm.a) * L;
      if (bm.t < bm.warn) {
        if (bm.spin) { // show the whole sweep
          const a1 = bm.a + bm.spin * 1.2 * 0.45;
          ctx.fillStyle = 'rgba(255,90,110,.12)'; ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.arc(bm.x, bm.y, L, bm.a, a1); ctx.closePath(); ctx.fill();
        }
        ctx.setLineDash([24, 18]); ctx.lineDashOffset = -G.t * 120;
        ctx.strokeStyle = `rgba(255,70,100,${0.45 + 0.4 * Math.abs(Math.sin(G.t * 18))})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
      } else if (bm.t < bm.warn + 0.45) {
        const a = 1 - (bm.t - bm.warn) / 0.55;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(255,214,107,${a * 0.55})`; ctx.lineWidth = bm.w * 2.2; ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = `rgba(255,252,236,${a})`; ctx.lineWidth = bm.w * 0.6; ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }
    for (const q of G.bullets) {
      heartPath(q.x, q.y, q.r * 2.3, Math.sin(q.rot) * 0.3); ctx.fillStyle = q.col; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
      if (G.freeze > 0) { ctx.strokeStyle = 'rgba(255,200,80,.95)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q.x, q.y, q.r + 8, 0, Math.PI * 2); ctx.stroke(); }
    }
  }
  function drawItems() {
    for (const it of G.items) {
      const y = it.y + Math.sin(G.t * 4 + it.x) * 8;
      ctx.globalAlpha = it.t > 7 && Math.floor(it.t * 8) % 2 ? 0.3 : 1;
      const g = ctx.createRadialGradient(it.x, y, 4, it.x, y, 56); g.addColorStop(0, 'rgba(255,246,190,.85)'); g.addColorStop(1, 'rgba(255,246,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(it.x, y, 56, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7A9A3A'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(it.x, y + 34); ctx.quadraticCurveTo(it.x + 6, y, it.x - 4, y - 36); ctx.stroke();
      ctx.fillStyle = '#E8C45A'; ctx.strokeStyle = '#B8902C'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(it.x - 3 + (i % 2 ? 9 : -9), y - 30 + i * 7, 7, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }
  function drawFx() {
    for (const f of G.fx) {
      const a = 1 - f.t / f.life;
      if (f.kind === 'heart') { heartPath(f.x, f.y, 26, f.r); ctx.fillStyle = `rgba(255,111,156,${a})`; ctx.fill(); }
      else if (f.kind === 'spark') { ctx.globalAlpha = a; ctx.fillStyle = f.col || '#FFFFFF'; ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
      else if (f.kind === 'feather') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r + f.t * 4); ctx.globalAlpha = a; ctx.fillStyle = f.col; ctx.strokeStyle = 'rgba(61,52,86,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1; }
      else if (f.kind === 'trail') { ctx.globalAlpha = a * 0.35; drawBird(f.x, f.y, f.dir, G.t, { flap: 0.6 }); ctx.globalAlpha = 1; }
    }
  }
  function drawPops() {
    for (const p of G.texts) {
      ctx.globalAlpha = Math.min(1, (1 - p.t) * 3);
      text(p.text, p.x, p.y - p.t * 60, p.size, p.col, 'center', 900, FONT, '#FFFFFF', 10);
    }
    ctx.globalAlpha = 1;
  }
  function drawTheBird() {
    const b = G.bird;
    if (!b) return;
    if (b.inv > 0 && G.scene === 'play' && Math.floor(G.t * 16) % 2 === 0) return;
    const o = { hurt: b.hurtT > 0, happy: G.won && G.scene !== 'play', blush: G.won && G.scene !== 'play', feet: b.perched };
    if (b.dashing) { o.sx = 1.25; o.sy = 0.85; o.tilt = Math.atan2(b.to.y - b.from.y, Math.abs(b.to.x - b.from.x) || 1) * 0.6 * b.dir; o.flap = 0.9; }
    if (b.perched) o.flap = -0.35;
    const bob = b.perched || b.dashing ? 0 : Math.sin(G.t * 5) * 4;
    drawBird(b.x, b.y + bob, b.dir, G.t, o);
  }
  function drawVol() {
    const im = SPR[G.volKey];
    if (!im) return;
    const p = easeOut(Math.min(1, G.volT / 0.7)), k = 0.86;
    const x = 540 - SP.rx * k, y = 880 + (1 - p) * 460;
    ctx.drawImage(im, x, y, SP.w * k, SP.h * k);
  }
  function drawBubble() {
    const bb = G.bubble;
    if (!bb) return;
    ctx.globalAlpha = clamp(Math.min(bb.t * 6, (bb.dur - bb.t) * 6), 0, 1);
    bubble(bb.text, 'yuria', G.yu.x + 6, G.yu.y + HEAD_DY + 96, true);
    ctx.globalAlpha = 1;
  }
  function drawWorld() {
    const sh = G.shake > 0 ? 14 * G.shake : 0;
    ctx.save();
    if (sh) ctx.translate(rnd(-sh, sh), rnd(-sh, sh));
    drawSky();
    drawYuria();
    drawBarrier();
    if (G.bubble) drawBubble(); // under the hearts so they stay visible
    drawVulnerable();
    drawItems();
    drawShots();
    drawFx();
    drawTheBird();
    drawPops();
    if (G.scene === 'winSeq' && G.volKey) drawVol();
    ctx.restore();
    if (G.freeze > 0) { ctx.fillStyle = 'rgba(255,230,160,.16)'; ctx.fillRect(0, 0, W, H); }
  }
  function drawHUD() {
    const yu = G.yu, b = G.bird;
    text('ユリアのよゆー', 40, 36, 28, INK, 'left', 900, FONT, '#FFFFFF', 8);
    const pl = ['', 'PHASE 1　よゆー', 'PHASE 2　ちょい本気', 'PHASE 3　竜眼'][yu.phase];
    text(pl, 680, 36, 24, yu.phase === 3 ? '#FFD36B' : INK, 'right', 900, FONT, yu.phase === 3 ? '#3A2A5A' : '#FFFFFF', 7);
    ctx.fillStyle = 'rgba(61,52,86,.35)'; rr(40, 60, 640, 30, 15); ctx.fill();
    const w = 640 * yu.comp / 100;
    if (w > 0) {
      const g = ctx.createLinearGradient(40, 0, 680, 0);
      g.addColorStop(0, '#FF8FB1'); g.addColorStop(1, yu.phase === 3 ? '#FFC44D' : '#FF5C8D');
      ctx.fillStyle = g; rr(40, 60, Math.max(30, w), 30, 15); ctx.fill();
    }
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; rr(40, 60, 640, 30, 15); ctx.stroke();
    for (const m of [66, 33]) { const x = 40 + 640 * m / 100; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x, 86); ctx.stroke(); }
    // feathers (life)
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(54 + i * 50, 1216); ctx.rotate(-0.6);
      ctx.fillStyle = i < b.hp ? BIRDS[G.color].body : 'rgba(61,52,86,.25)'; ctx.strokeStyle = i < b.hp ? INK : '#FFFFFF'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(26, 0); ctx.stroke();
      ctx.restore();
    }
    text(fmtTime(G.stats.time), 372, 1216, 30, INK, 'center', 900, FONT, '#FFFFFF', 7);
    // peck button
    const ready = !b.dashing && b.dashCd <= 0 && b.knock <= 0;
    const h = headPos(), far = Math.hypot(h.x - b.x, h.y - b.y) - 64 > RANGE;
    const open = yu.mode === 'open';
    ctx.fillStyle = !ready ? 'rgba(255,143,177,.55)' : open && !far ? '#FF4F86' : '#FF8FB1';
    ctx.beginPath(); ctx.arc(BTN.x, BTN.y, BTN.r * (1 + G.btnFlash), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 6; ctx.stroke();
    if (b.dashCd > 0) { ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(BTN.x, BTN.y, BTN.r - 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - b.dashCd / 0.8)); ctx.stroke(); }
    text(far ? 'とおい' : 'つつく', BTN.x, BTN.y + 2, 34, '#FFFFFF', 'center', 900);
  }
  function button(label, x, y, w, h, fn, primary = true) {
    ctx.fillStyle = primary ? '#FF5C8D' : '#FFFFFF'; ctx.strokeStyle = primary ? '#FFFFFF' : '#FF8FB1'; ctx.lineWidth = 6;
    rr(x, y, w, h, h / 2); ctx.fill(); ctx.stroke();
    text(label, x + w / 2, y + h / 2 + 2, h > 90 ? 42 : 36, primary ? '#FFFFFF' : '#E2557F', 'center', 900);
    UI.push({ x, y, w, h, fn });
  }

  function drawTitle() {
    if (!G.yu) G.yu = newYuria();
    const yu = G.yu;
    yu.x = 360 + Math.sin(G.t * 0.7) * 16; yu.y = 4 + Math.sin(G.t * 1.3) * 8; yu.pose = 'taunt';
    G.gold = 0;
    drawSky(); drawYuria();
    if (G.best) {
      ctx.fillStyle = 'rgba(255,255,255,.82)'; rr(24, 22, 300, 52, 26); ctx.fill();
      text(`ベスト ${fmtTime(G.best.time)}　ランク ${G.best.rank}`, 174, 49, 24, INK, 'center', 900);
    }
    ctx.save(); ctx.translate(360, 700); ctx.rotate(-0.03);
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 6; rr(-300, -92, 600, 184, 40); ctx.fill(); ctx.stroke();
    text('文鳥', -180, -4, 84, INK, 'center', 400, DISPLAY);
    text('vs', -44, 10, 50, '#FF5C8D', 'center', 400, DISPLAY);
    text('ユリア', 132, -4, 84, '#F0AE34', 'center', 400, DISPLAY, INK, 4);
    ctx.restore();
    text('外神竜のギャルに、くちばしひとつで挑め。', 360, 828, 30, INK, 'center', 900, FONT, '#FFFFFF', 9);
    Object.keys(BIRDS).forEach((k, i) => {
      const x = 150 + i * 210, y = 958, sel = G.color === k;
      ctx.fillStyle = sel ? '#FFFFFF' : 'rgba(255,255,255,.6)'; ctx.strokeStyle = sel ? '#FF5C8D' : 'rgba(61,52,86,.25)'; ctx.lineWidth = sel ? 7 : 3;
      rr(x - 92, y - 80, 184, 172, 28); ctx.fill(); ctx.stroke();
      drawBird(x + 4, y - 14 + (sel ? Math.sin(G.t * 6) * 4 : 0), 1, G.t + i, { color: k, s: 1.05, flap: sel ? Math.sin(G.t * 18) * 0.6 : 0.2, happy: sel });
      text(BIRDS[k].name, x, y + 62, 25, INK, 'center', 900);
      UI.push({ x: x - 92, y: y - 80, w: 184, h: 172, fn: () => { G.color = k; store.set('color', k); sfx('select', 0.7); sfx('chirp', 0.6, 1 + i * 0.08); } });
    });
    button('あそぶ', 190, 1074, 340, 100, startGame);
    text('ドラッグで移動・タップでつつく', 360, 1212, 26, INK, 'center', 900, FONT, '#FFFFFF', 7);
    text('キーボード：矢印キーで移動・スペースでつつく', 360, 1250, 21, '#5C4F86', 'center', 700, FONT, '#FFFFFF', 6);
  }
  function drawPlay() {
    drawWorld();
    if (G.scene === 'play' || G.scene === 'intro') drawHUD();
    if (inDialog()) drawDialogBox();
    if (G.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, G.flash)})`; ctx.fillRect(0, 0, W, H); }
  }
  function drawDialogBox() {
    const l = G.dialog[G.lineIdx];
    if (!l) return;
    const who = l.who || 'yuria', col = who === 'vol' ? '#5D97D3' : '#E39A12';
    const x = 36, y = 762, w = 648, h = 152;
    ctx.globalAlpha = Math.min(1, G.sceneT * 5);
    ctx.fillStyle = 'rgba(255,255,255,.96)'; ctx.strokeStyle = INK; ctx.lineWidth = 5; rr(x, y, w, h, 26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; rr(x + 24, y - 24, 150, 46, 23); ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4; ctx.stroke();
    text(who === 'vol' ? 'ヴォル' : 'ユリア', x + 99, y - 0.5, 26, '#FFFFFF', 'center', 900);
    let n = Math.floor(G.lineT * CPS);
    l.text.split('\n').forEach((ln, i) => {
      const chars = [...ln], shown = chars.slice(0, Math.max(0, n)).join('');
      n -= chars.length;
      if (shown) text(shown, x + 34, y + 50 + i * 44, 30, INK, 'left', 700);
    });
    if (G.lineT * CPS >= lineLen(l)) {
      const bob = Math.sin(G.t * 6) * 3;
      text('タップで次へ ▼', x + w - 22, y + h - 17 + bob, 20, '#8C7AB8', 'right', 900);
    }
    ctx.globalAlpha = 1;
  }
  function drawResult() {
    drawWorld();
    const won = G.won, s = G.stats, a = Math.min(1, G.sceneT * 4);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(42,35,64,.5)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 6; rr(70, 384, 580, 566, 40); ctx.fill(); ctx.stroke();
    text(won ? 'CLEAR!' : 'GAME OVER', 360, 464, won ? 88 : 60, won ? '#FF5C8D' : '#6A5B98', 'center', 400, DISPLAY);
    text(won ? 'ユリアのよゆーを崩した！' : 'つかまっちゃった……', 360, 538, 32, INK, 'center', 900);
    const rows = [['タイム', fmtTime(s.time)], ['つついた回数', `${s.pecks}回`], ['被弾', `${s.hits}回`]];
    rows.forEach(([k, v], i) => {
      const y = 612 + i * 66;
      text(k, 130, y, 32, '#6A5B98', 'left', 700); text(v, 590, y, 38, INK, 'right', 900);
      ctx.strokeStyle = 'rgba(61,52,86,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(130, y + 33); ctx.lineTo(590, y + 33); ctx.stroke();
    });
    if (won) {
      text('ランク', 130, 820, 32, '#6A5B98', 'left', 700); text(s.rank, 590, 824, 76, s.rank === 'S' ? '#F0AE34' : '#FF5C8D', 'right', 400, DISPLAY);
      if (s.newBest) text('ベスト更新！', 360, 900, 30, '#E39A12', 'center', 900);
    } else {
      text('ヒント', 360, 818, 26, '#6A5B98', 'center', 900);
      G.tip.split('\n').forEach((ln, i) => text(ln, 360, 862 + i * 38, 26, INK, 'center', 700));
    }
    button('もう一回', 120, 990, 480, 100, startGame);
    button('タイトルへ', 170, 1112, 380, 84, toTitle, false);
    ctx.globalAlpha = 1;
  }
  // ---------------------------------------------------------------- main loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000)); last = now;
    update(dt);
    UI.length = 0;
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (G.scene === 'title') drawTitle();
    else if (G.scene === 'result') drawResult();
    else drawPlay();
    requestAnimationFrame(frame);
  }
  // hooks for automated checks
  window.__bvy = { G, SPR, startGame, endBattle, tryPeck, beginOpen, step: sec => { for (let i = 0; i < Math.round(sec * 60); i++) update(1 / 60); } };

  function start(data) {
    data = data || {};
    if (data.color && BIRDS[data.color]) G.color = data.color;
    if (data.battle && typeof data.battle.comp === 'number') { // carry an in-progress fight across a page update
      resetBattle();
      G.yu.comp = clamp(data.battle.comp, 1, 100); G.yu.phase = G.yu.comp > 66 ? 1 : G.yu.comp > 33 ? 2 : 3;
      G.bird.hp = clamp(data.battle.hp | 0, 1, 5); Object.assign(G.stats, data.battle.stats || {});
      G.scene = 'play'; G.sceneT = 0; beginAttack(1.2); popText('つづきから', 360, 690, '#FF5C8D', 60);
    }
    fit();
    if (document.fonts) {
      document.fonts.load(`900 32px ${FONT}`, 'ユリアのよゆー文鳥').catch(() => {});
      document.fonts.load(`400 90px ${DISPLAY}`, '文鳥vsユリアCLEAR!GAMEOVER').catch(() => {});
    }
    loadSprites().then(() => stage.classList.add('ready'));
    requestAnimationFrame(t => { last = t; frame(t); });
  }
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ color: G.color, battle: G.scene === 'play' && G.yu ? { comp: G.yu.comp, hp: G.bird.hp, stats: G.stats } : null }));
  if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
