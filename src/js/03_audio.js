// ───────── 音 ─────────
// 音楽は流さない。あるのは場所の鳴り（空調、蛍光灯、風、水）と、遠くで ときどき鳴る何か、それと足音だけ。
// 音源はすべてその場で合成する。
// アセラが運動を奪うと、鳴りは沈み、こもって、止まる。無音になる。
const Snd = (() => {
  let ac = null, master, ambB, ambLP, ambG, sfxB, echoIn, det = null, nbuf = null;
  let vol = 0.8, sfxOn = true, ambOn = true, muted = false, motion = 1, lastM = -1, cur = null, evs = [], stepN = 0;
  const L = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const AMB_V = 1.4;   // 【環境音の大きさ】

  // 場所ごとの鳴り。air: [こもり具合 Hz, 大きさ]、ev: [名前, 平均の間隔 秒, ゆらぎ 0〜1, …]
  const SB = {
    atelier: { air: [700, 0.09], hum: 0.012, echo: 0.05, ev: [['clock', 1, 0], ['note', 14, 0.5, [60, 64, 67, 71, 72, 76], 0.05]] },
    hall:    { air: [420, 0.16], hum: 0.03, buzz: 0.12, echo: 0.3, ev: [['note', 16, 0.5, [57, 60, 64, 65, 69], 0.05], ['knock', 34, 0.6]] },
    office:  { air: [1100, 0.13], hum: 0.025, buzz: 0.16, echo: 0.1, ev: [['hdd', 11, 0.6], ['phone', 50, 0.4]] },
    under:   { air: [320, 0.2], hum: 0.035, buzz: 0.2, echo: 0.6, ev: [['drip', 5, 0.7], ['note', 19, 0.5, [50, 53, 57, 60], 0.05]] },
    street:  { air: [900, 0.05], hum: 0.03, wind: 0.1, echo: 0.12, ev: [['bugs', 1.7, 0.5], ['note', 21, 0.5, [57, 60, 62, 64, 69], 0.04]] },
    tatami:  { air: [500, 0.12], echo: 0.03, ev: [['clock', 1, 0], ['furin', 13, 0.7]] },
    school:  { air: [600, 0.13], hum: 0.012, echo: 0.35, ev: [['chime', 55, 0.25], ['knock', 28, 0.6]] },
    pool:    { air: [900, 0.1], water: 0.24, echo: 0.7, ev: [['drip', 3.2, 0.7]] },
    parking: { air: [260, 0.26], hum: 0.04, buzz: 0.1, echo: 0.65, ev: [['drip', 9, 0.6], ['clank', 24, 0.6]] },
    station: { air: [380, 0.18], hum: 0.03, buzz: 0.12, echo: 0.5, ev: [['pa', 38, 0.4], ['rumble', 47, 0.4]] },
    danchi:  { air: [800, 0.07], wind: 0.16, echo: 0.25, ev: [['musen', 52, 0.3], ['bugs', 4, 0.6]] },
    fields:  { air: [900, 0.06], wind: 0.2, echo: 0.05, ev: [['frog', 0.55, 0.7], ['bugs', 2.4, 0.5]] },
    mall:    { air: [600, 0.12], hum: 0.02, echo: 0.45, ev: [['muzak', 4.6, 0.1]] },
    clinic:  { air: [560, 0.1], hum: 0.02, buzz: 0.14, echo: 0.2, ev: [['clock', 1, 0], ['pingpong', 41, 0.4]] },
    blank:   { air: [2600, 0.04], echo: 0.3, ev: [['modem', 9, 0.6]] },
  };

  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { ac = null; return false; }
    master = ac.createGain(); master.gain.value = muted ? 0 : vol;
    sfxB = ac.createGain(); sfxB.gain.value = sfxOn ? 0.9 : 0;
    ambB = ac.createGain(); ambB.gain.value = 1;
    ambLP = ac.createBiquadFilter(); ambLP.type = 'lowpass'; ambLP.frequency.value = 13000; ambLP.Q.value = 0.3;
    ambG = ac.createGain(); ambG.gain.value = ambOn ? AMB_V : 0;
    ambB.connect(ambLP); ambLP.connect(ambG); ambG.connect(master); sfxB.connect(master); master.connect(ac.destination);
    // 広い場所の残響（遅れて返ってくる音）
    echoIn = ac.createGain();
    const dl = ac.createDelay(1.0), fb = ac.createGain(), elp = ac.createBiquadFilter();
    dl.delayTime.value = 0.23; fb.gain.value = 0.42; elp.type = 'lowpass'; elp.frequency.value = 1700;
    echoIn.connect(dl); dl.connect(elp); elp.connect(fb); fb.connect(dl); elp.connect(master);
    if (ac.createConstantSource) { det = ac.createConstantSource(); det.offset.value = 0; det.start(); }
    const n = ac.sampleRate * 2; nbuf = ac.createBuffer(1, n, ac.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // 鳴りつづける層
    const nsrc = () => { const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true; if (det && s.detune) det.connect(s.detune); s.start(0, Math.random()); return s; };
    const gain = v => { const g = ac.createGain(); g.gain.value = v; return g; };
    const filt = (type, f, q) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; if (det) det.connect(o.detune); o.start(); return o; };
    L.airF = filt('lowpass', 500, 0.4); L.airG = gain(0); nsrc().connect(L.airF); L.airF.connect(L.airG); L.airG.connect(ambB);
    L.humG = gain(0); for (const [f, v] of [[50, 1], [100, 0.7], [150, 0.35], [200, 0.2]]) { const g = gain(v); osc('sine', f).connect(g); g.connect(L.humG); } L.humG.connect(ambB);
    L.buzzG = gain(0); const bz = filt('bandpass', 2900, 7); osc('sawtooth', 100).connect(bz); bz.connect(L.buzzG); L.buzzG.connect(ambB);
    const swell = (f, q, rate) => {   // ゆっくり寄せては返す雑音（風、水）
      const bf = filt('bandpass', f, q), g1 = gain(0.55), lg = gain(0.45), g2 = gain(0);
      nsrc().connect(bf); bf.connect(g1); osc('sine', rate).connect(lg); lg.connect(g1.gain); g1.connect(g2); g2.connect(ambB);
      return g2;
    };
    L.windG = swell(520, 0.7, 0.11); L.waterG = swell(760, 0.8, 0.29);
    applyAmb();
    return true;
  }
  function unlock() { if (!init()) return; if (ac.state !== 'running') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } }
  const now = () => ac.currentTime;

  // o: { t, type, to, v, a, hold, rel, bus, bend, echo }
  function out(g, o) { g.connect(o.bus || sfxB); if (o.echo) { const s = ac.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(echoIn); } }
  function tone(f, d, o) {
    o = o || {};
    const t = o.t || now(), os = ac.createOscillator(), g = ac.createGain();
    os.type = o.type || 'sine';
    os.frequency.setValueAtTime(f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + d);
    if (o.cents) os.detune.setValueAtTime(o.cents, t);
    if (o.bend && det) det.connect(os.detune);
    const v = o.v == null ? 0.2 : o.v, a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (o.hold) { g.gain.setValueAtTime(v, t + Math.max(a, d - (o.rel || 0.05))); g.gain.linearRampToValueAtTime(0.0001, t + d); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    os.connect(g); out(g, o);
    os.start(t); os.stop(t + d + 0.03);
  }
  function noise(d, o) {
    o = o || {};
    const t = o.t || now(), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true;
    f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + d);
    f.Q.value = o.q || 1;
    const v = o.v == null ? 0.2 : o.v;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.a || 0.003));
    if (o.hold) { g.gain.setValueAtTime(v, t + Math.max(o.a || 0.003, d - (o.rel || 0.05))); g.gain.linearRampToValueAtTime(0.0001, t + d); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); out(g, o);
    s.start(t, Math.random() * 1.9); s.stop(t + d + 0.03);
  }

  // 遠くで ときどき鳴るもの。どれも小さく、少し音程がずれている。
  const far = (m, t, v, d, e) => { const c = -28 + Math.random() * 16; tone(mtof(m), d, { t, v, cents: c, bus: ambB, bend: 1, echo: e }); tone(mtof(m) * 2, d * 0.4, { t, v: v * 0.2, cents: c, type: 'triangle', bus: ambB, bend: 1, echo: e }); };
  const EV = {
    clock(t, e) { const k = (Math.round(t) & 1); noise(0.018, { t, v: 0.26, f: k ? 2300 : 1800, q: 5, bus: ambB, echo: e }); },
    note(t, e, sc, v) { far(pick(sc), t, v, 3.2, 0.7); },
    drip(t, e) { tone(1500 + Math.random() * 300, 0.12, { t, to: 520, v: 0.05, bus: ambB, echo: e }); tone(720, 0.2, { t: t + 0.06, to: 900, v: 0.028, bus: ambB, echo: e }); },
    bugs(t) { const f = 4200 + Math.random() * 500, n = irnd(5, 9); for (let i = 0; i < n; i++) tone(f + Math.random() * 40, 0.03, { t: t + i * 0.055, v: 0.031, bus: ambB, bend: 1 }); },
    frog(t) { const f = pick([330, 392, 440, 523]), n = irnd(2, 5); for (let i = 0; i < n; i++) tone(f, 0.05, { t: t + i * 0.1, v: 0.026, type: 'square', bus: ambB, bend: 1, echo: 0.2 }); },
    hdd(t) { let tt = t; const n = irnd(4, 9); for (let i = 0; i < n; i++) { noise(0.018, { t: tt, v: 0.14, f: 1800 + Math.random() * 1400, q: 6, bus: ambB }); tt += 0.03 + Math.random() * 0.06; } },
    phone(t, e) { for (let r = 0; r < 3; r++) for (let i = 0; i < 16; i++) tone(410, 0.04, { t: t + r * 3 + i * 0.0625, v: 0.032, bus: ambB, bend: 1, echo: 0.5 }); },   // 誰も出ない電話
    knock(t, e) { noise(0.3, { t, v: 0.35, f: 170, q: 0.7, ft: 'lowpass', bus: ambB, echo: 0.6 }); },   // どこかで戸が閉まる
    chime(t) { [64, 60, 62, 55, -1, 55, 62, 64, 60].forEach((m, i) => { if (m > 0) far(m, t + i * 0.85, 0.038, 2.4, 0.6); }); },
    pa(t) { [60, 64, 67, 72].forEach((m, i) => far(m, t + i * 0.55, 0.03, 1.8, 0.7)); },   // 案内のチャイムだけが鳴る。案内は流れない
    rumble(t) { noise(5.5, { t, v: 0.48, f: 90, q: 0.5, ft: 'lowpass', a: 2.5, bus: ambB }); },   // 来ない電車
    furin(t) { const n = irnd(2, 4); for (let i = 0; i < n; i++) tone(2100 + Math.random() * 1100, 1.3, { t: t + i * (0.12 + Math.random() * 0.25), v: 0.025, bus: ambB, bend: 1 }); },
    musen(t) { let d = irnd(1, 4); const sc = [57, 60, 62, 64, 67, 69, 72]; for (let i = 0; i < 7; i++) { far(sc[d], t + i * 1.05, 0.038, 2.2, 0.8); d = clamp(d + pick([-2, -1, -1, 1, 1, 2]), 0, sc.length - 1); } },
    muzak(t) { const ch = pick([[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]]); for (const m of ch) tone(mtof(m + 12), 5.2, { t, v: 0.01, type: 'triangle', a: 1.6, hold: 1, rel: 2.2, cents: -35 + Math.random() * 20, bus: ambB, bend: 1, echo: 0.5 }); },
    pingpong(t) { far(76, t, 0.042, 1.4, 0.4); far(72, t + 0.6, 0.042, 1.8, 0.4); },
    clank(t) { for (const f of [523, 1187, 1873]) tone(f, 0.5, { t, v: 0.014, bus: ambB, bend: 1, echo: 0.8 }); },
    modem(t) { let tt = t; for (let i = 0; i < 6; i++) { tone(pick([1200, 2100, 1650, 980, 2400]), 0.07, { t: tt, v: 0.028, type: 'square', bus: ambB, bend: 1 }); tt += 0.08; } noise(0.3, { t: tt, v: 0.04, f: 2200, q: 2, bus: ambB }); },
  };

  function applyAmb() {
    if (!ac) return;
    const s = cur ? SB[cur] || SB.hall : null, t = now(), set = (p, v) => p.setTargetAtTime(v, t, 0.7);
    set(L.airG.gain, s ? s.air[1] : 0); if (s) set(L.airF.frequency, s.air[0]);
    set(L.humG.gain, s ? s.hum || 0 : 0); set(L.buzzG.gain, s ? s.buzz || 0 : 0); set(L.windG.gain, s ? s.wind || 0 : 0); set(L.waterG.gain, s ? s.water || 0 : 0);
    evs = s ? s.ev.map(e => ({ e, next: t + (e[2] ? e[1] * (0.25 + Math.random() * 0.8) : e[1]) })) : [];
  }
  // b: 空間の種類（07_biomes の BIOMES の 1 つ）。null で無音。
  function amb(b) { const id = b ? b.id : null; if (id === cur) return; cur = id; applyAmb(); }
  function tick() {
    if (!ac || ac.state !== 'running') return;
    const t = now();
    if (Math.abs(motion - lastM) > 0.01) {
      lastM = motion;
      if (det) det.offset.setTargetAtTime(-1700 * Math.pow(1 - motion, 1.3), t, 0.05);
      ambLP.frequency.setTargetAtTime(110 + motion * motion * 12900, t, 0.05);
      ambB.gain.setTargetAtTime(motion * motion, t, 0.05);
    }
    const s = cur ? SB[cur] : null;
    for (const v of evs) {
      if (t < v.next) continue;
      if (motion > 0.6 && ambOn && !muted) { try { EV[v.e[0]](t + 0.03, s ? s.echo : 0, v.e[3], v.e[4]); } catch (e) { if (DEBUG) console.warn('音', v.e[0], e); } }
      v.next = v.e[2] ? t + v.e[1] * (1 + (Math.random() * 2 - 1) * v.e[2]) : Math.max(v.next + v.e[1], t);
    }
  }

  // 足音。床の種類で変わる。
  const STEP = {
    carpet(r, e) { noise(0.06, { v: 0.9, f: 300 + r * 90, q: 0.7, ft: 'lowpass', echo: e * 0.4 }); },
    tile(r, e) { noise(0.028, { v: 0.43, f: 1900 + r * 500, q: 3, echo: e }); noise(0.02, { t: now() + 0.04, v: 0.17, f: 2700, q: 4, echo: e }); },
    wood(r, e) { noise(0.04, { v: 0.4, f: 700 + r * 200, q: 2, echo: e }); tone(150 + r * 30, 0.06, { v: 0.12, echo: e }); },
    tatami(r, e) { noise(0.07, { v: 0.22, f: 900 + r * 300, q: 0.6, echo: e }); },
    asphalt(r, e) { noise(0.065, { v: 0.37, f: 1300 + r * 500, q: 0.9, echo: e }); },
    concrete(r, e) { noise(0.035, { v: 0.6, f: 1100 + r * 300, q: 2, echo: e }); },
    lino(r, e) { noise(0.03, { v: 0.6, f: 800, q: 1.5, echo: e }); if (r < 0.3) tone(2300 + r * 900, 0.05, { v: 0.02, to: 2700, echo: e }); },
    water(r, e) { noise(0.17, { v: 0.38, f: 700 + r * 300, fto: 300, q: 0.8, echo: e }); },
  };
  function step(kind) {
    if (!ac || muted || !sfxOn || ac.state !== 'running') return;
    const s = cur ? SB[cur] : null, f = STEP[kind] || STEP.tile;
    try { f(((stepN++ & 1) ? 0.25 : 0.75) + Math.random() * 0.25, s ? s.echo * 0.8 : 0); } catch (e) { if (DEBUG) console.warn('音', e); }
  }

  const SFX = {
    blip() { noise(0.012, { v: 0.15, f: 3200, q: 2 }); },
    empty() { noise(0.01, { v: 0.09, f: 2000, q: 3 }); },
    // 世界が動きだす: 蛍光灯が点きなおす音
    resume() { noise(0.02, { v: 0.3, f: 3400, q: 6 }); noise(0.02, { t: now() + 0.09, v: 0.22, f: 3900, q: 6 }); tone(90, 0.3, { v: 0.1 }); },
    scratch() { noise(0.05, { v: 0.2, f: 2500 + Math.random() * 2500, q: 2.5 }); },
    // 取り込み: シャッターと、巻き上げ
    get() { noise(0.012, { v: 0.45, f: 4200, q: 1 }); noise(0.03, { t: now() + 0.055, v: 0.3, f: 1700, q: 1.2 }); tone(170, 0.28, { t: now() + 0.1, to: 250, v: 0.03, type: 'sawtooth' }); tone(mtof(76), 1.1, { t: now() + 0.1, v: 0.11, echo: 0.6 }); },
    // 保存: 円盤の読み書き
    save() { for (let i = 0; i < 9; i++) noise(0.03, { t: now() + i * 0.055 + Math.random() * 0.02, v: 0.28, f: 300 + Math.random() * 900, q: 3 }); tone(mtof(72), 0.9, { t: now() + 0.62, v: 0.12, type: 'triangle', echo: 0.4 }); },
    door() { noise(0.25, { v: 0.65, f: 300, fto: 1800, q: 0.7 }); },
    omen(o) { const d = (o && o.d) || 2.5; tone(520, d, { to: 60, v: 0.12, type: 'triangle' }); noise(d, { v: 0.2, f: 3000, fto: 200, q: 0.6 }); },
    whoosh() { noise(0.35, { v: 0.8, f: 500, fto: 2600, q: 1.2 }); },
    dash() { for (let i = 0; i < 6; i++) noise(0.025, { t: now() + i * 0.045, v: 0.63, f: 1700 + i * 120, q: 2 }); },
    voice() { for (let i = 0; i < 3; i++) tone(1040 + Math.random() * 240, 0.045, { t: now() + i * 0.06, v: 0.13, type: 'square' }); },
    tick() { tone(1900, 0.02, { v: 0.115, type: 'square' }); },
    found() { [61, 62, 68, 73].forEach(m => tone(mtof(m + 12), 0.9, { v: 0.09, type: 'sawtooth' })); noise(0.5, { v: 0.14, f: 1200, q: 0.5 }); },
    catch() { tone(110, 0.5, { to: 40, v: 0.28, type: 'square' }); noise(0.4, { v: 0.22, f: 200, q: 0.5 }); },
    err() { tone(mtof(79), 0.18, { v: 0.18, type: 'triangle' }); tone(mtof(72), 0.5, { v: 0.18, type: 'triangle', t: now() + 0.13 }); },
    ding() { tone(mtof(84), 0.6, { v: 0.155 }); },
    open() { noise(0.015, { v: 0.2, f: 2400, q: 2 }); noise(0.015, { t: now() + 0.05, v: 0.16, f: 3200, q: 2 }); },
    close() { noise(0.015, { v: 0.2, f: 3200, q: 2 }); noise(0.015, { t: now() + 0.05, v: 0.16, f: 2400, q: 2 }); },
    // 起動: 円盤が回りだす音と、低い和音がひとつ
    boot() {
      noise(1.1, { v: 0.25, f: 200, fto: 1300, q: 0.8, a: 0.5 });
      for (let i = 0; i < 10; i++) noise(0.02, { t: now() + 0.3 + i * 0.07 + Math.random() * 0.04, v: 0.2, f: 500 + Math.random() * 1500, q: 4 });
      [48, 55, 62].forEach(m => tone(mtof(m), 2.6, { t: now() + 0.9, v: 0.07, a: 0.5, hold: 1, rel: 1.6, type: 'triangle', echo: 0.5 }));
    },
    shut() { [62, 55, 48].forEach((m, i) => tone(mtof(m), 1.2, { t: now() + i * 0.22, v: 0.1, type: 'triangle', echo: 0.5 })); },
    update() { EV.modem(now()); },
    drip() { EV.drip(now(), cur && SB[cur] ? SB[cur].echo : 0); },
    stutter() { for (let i = 0; i < 14; i++) { tone(233, 0.045, { t: now() + i * 0.05, v: 0.15, type: 'square' }); tone(311, 0.045, { t: now() + i * 0.05, v: 0.11, type: 'square' }); } },
  };
  function sfx(n, o) {
    if (!ac || muted || ac.state !== 'running') return;
    const f = SFX[n];
    if (f) try { f(o); } catch (e) { if (DEBUG) console.warn('音', n, e); }
  }
  const ramp = (p, v) => { if (ac) p.setTargetAtTime(v, now(), 0.03); };
  // v: 0〜100
  function setVol(v) { vol = clamp(v, 0, 100) / 100; if (ac) ramp(master.gain, muted ? 0 : vol); }
  function mute(b) { muted = !!b; if (ac) ramp(master.gain, muted ? 0 : vol); }
  function setSfx(b) { sfxOn = !!b; if (ac) ramp(sfxB.gain, sfxOn ? 0.9 : 0); }
  function setAmb(b) { ambOn = !!b; if (ac) ramp(ambG.gain, ambOn ? AMB_V : 0); }
  function setMotion(m) { motion = m; }
  function pause(b) { if (!ac) return; if (b) { if (ac.state === 'running') ac.suspend(); } else if (ac.state === 'suspended') ac.resume(); }
  return { unlock, tick, amb, step, sfx, mute, setVol, setSfx, setAmb, setMotion, pause, get muted() { return muted; }, get ready() { return !!ac && ac.state === 'running'; },
    dbg: DEBUG ? { EV, SFX, STEP, SB } : null };   // 試験用（#debug のときだけ）
})();
