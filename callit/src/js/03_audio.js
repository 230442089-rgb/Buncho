// ───────── 音 ─────────
// 音楽はない。風か部屋の鳴りと、足音と、彼の受信機の音だけ。すべてその場で合成する。
// 雑音を絞って作る音は思ったより小さくなるので、大きさは計算機の中で鳴らして測って決めてある。
const Snd = (() => {
  let ac = null, master, sfxB, ambB, echoIn, nbuf = null, muted = false, amb = null;
  const L = {};
  const AMB = {   // 場所の鳴り: wind 風、room 部屋の空気（こもり Hz と大きさ）、hum 電気のうなり
    desert: { wind: 0.22, room: [500, 0.03], hum: 0.008 },
    hotel: { wind: 0, room: [420, 0.16], hum: 0.03 },
    river: { wind: 0.16, room: [900, 0.1], hum: 0 },
  };
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { ac = null; return false; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8;
    sfxB = ac.createGain(); sfxB.gain.value = 0.9;
    ambB = ac.createGain(); ambB.gain.value = 1.3;
    sfxB.connect(master); ambB.connect(master); master.connect(ac.destination);
    echoIn = ac.createGain();
    const dl = ac.createDelay(1.0), fb = ac.createGain(), lp = ac.createBiquadFilter();
    dl.delayTime.value = 0.21; fb.gain.value = 0.36; lp.type = 'lowpass'; lp.frequency.value = 1800;
    echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master);
    const n = ac.sampleRate * 2; nbuf = ac.createBuffer(1, n, ac.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const nsrc = () => { const s = ac.createBufferSource(); s.buffer = nbuf; s.loop = true; s.start(0, Math.random()); return s; };
    const gain = v => { const g = ac.createGain(); g.gain.value = v; return g; };
    const filt = (type, f, q) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const osc = (type, f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
    // 風: ゆっくり強まっては弱まる
    const wf = filt('bandpass', 480, 0.7), w1 = gain(0.55), wl = gain(0.45); L.wind = gain(0);
    nsrc().connect(wf); wf.connect(w1); osc('sine', 0.09).connect(wl); wl.connect(w1.gain); w1.connect(L.wind); L.wind.connect(ambB);
    L.roomF = filt('lowpass', 500, 0.4); L.room = gain(0); nsrc().connect(L.roomF); L.roomF.connect(L.room); L.room.connect(ambB);
    L.hum = gain(0); for (const [f, v] of [[60, 1], [120, 0.6], [180, 0.3]]) { const g = gain(v); osc('sine', f).connect(g); g.connect(L.hum); } L.hum.connect(ambB);
    applyAmb();
    return true;
  }
  function unlock() { if (!init()) return; if (ac.state !== 'running') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } }
  const now = () => ac.currentTime;
  function out(g, o) { g.connect(o.bus || sfxB); if (o.echo) { const s = ac.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(echoIn); } }
  // o: { t, type, to, v, a, hold, rel, echo }
  function tone(f, d, o) {
    o = o || {};
    const t = o.t || now(), os = ac.createOscillator(), g = ac.createGain();
    os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + d);
    const v = o.v == null ? 0.2 : o.v, a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    if (o.hold) { g.gain.setValueAtTime(v, t + Math.max(a, d - (o.rel || 0.05))); g.gain.linearRampToValueAtTime(0.0001, t + d); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    os.connect(g); out(g, o); os.start(t); os.stop(t + d + 0.03);
  }
  function noise(d, o) {
    o = o || {};
    const t = o.t || now(), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true;
    f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + d);
    f.Q.value = o.q || 1;
    const v = o.v == null ? 0.2 : o.v, a = o.a || 0.003;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); out(g, o); s.start(t, Math.random() * 1.9); s.stop(t + d + 0.03);
  }
  const at = s => now() + s;
  const STEP = {   // 足音。地面ごと
    sand(r) { noise(0.07, { v: 0.34, f: 1100 + r * 500, q: 0.7 }); },
    road(r) { noise(0.04, { v: 0.5, f: 1200 + r * 300, q: 2 }); },
    carpet(r) { noise(0.06, { v: 0.8, f: 300 + r * 90, q: 0.7, ft: 'lowpass' }); },
    tile(r) { noise(0.028, { v: 0.42, f: 1900 + r * 500, q: 3, echo: 0.3 }); },
    deck(r) { noise(0.035, { v: 0.5, f: 800 + r * 200, q: 2, echo: 0.3 }); tone(120 + r * 30, 0.06, { v: 0.07 }); },
    mud(r) { noise(0.09, { v: 0.4, f: 500 + r * 200, q: 0.6 }); },
  };
  const SFX = {
    // 彼の受信機。近いほど大きい
    beep(o) { const k = o && o.v != null ? o.v : 1; tone(2850, 0.06, { v: 0.05 + 0.1 * k, type: 'square' }); },
    astep(o) { const k = o && o.v != null ? o.v : 1; noise(0.07, { v: 0.15 + 0.75 * k, f: 210, q: 0.8, ft: 'lowpass' }); },   // 彼の足音。ゆっくり、同じ間隔で
    door() { noise(0.09, { v: 0.6, f: 500, q: 1.2 }); tone(140, 0.08, { v: 0.1 }); },
    lock() { noise(0.02, { v: 0.5, f: 2400, q: 4 }); noise(0.025, { t: at(0.07), v: 0.6, f: 1500, q: 4 }); },
    unlock() { noise(0.025, { v: 0.5, f: 1500, q: 4 }); noise(0.02, { t: at(0.09), v: 0.4, f: 2400, q: 4 }); },
    hiss() { noise(PRM.boltTime, { v: 0.16, f: 5200, q: 0.8, a: 0.3 }); },                 // 圧縮空気のボンベ
    bolt() { noise(0.05, { v: 0.7, f: 900, q: 0.8 }); tone(95, 0.3, { to: 45, v: 0.3 }); noise(0.3, { t: at(0.03), v: 0.4, f: 3000, fto: 800, q: 1, echo: 0.4 }); },
    cyl() { tone(2400, 0.3, { to: 900, v: 0.08, echo: 0.5 }); },
    raise() { noise(0.03, { v: 0.5, f: 1800, q: 3 }); noise(0.03, { t: at(0.13), v: 0.45, f: 1300, q: 3 }); },
    shot() { noise(0.12, { v: 0.7, f: 700, q: 0.6 }); noise(0.3, { t: at(0.02), v: 0.45, f: 2500, fto: 600, q: 0.8, echo: 0.5 }); tone(72, 0.22, { to: 40, v: 0.35 }); },   // 消音器つき
    pump() { noise(0.04, { v: 0.5, f: 1500, q: 2 }); noise(0.05, { t: at(0.15), v: 0.55, f: 1100, q: 2 }); },
    hit() { tone(180, 0.28, { to: 60, v: 0.3, type: 'square' }); noise(0.2, { v: 0.6, f: 400, q: 0.7 }); },
    coin() { for (let i = 0; i < 11; i++) tone(4200 + (i % 2) * 700, 0.09, { t: at(i * 0.1), v: 0.13, echo: 0.3 }); },
    slap() { noise(0.03, { v: 0.7, f: 1200, q: 1 }); tone(300, 0.06, { v: 0.12 }); },
    pick() { noise(0.05, { v: 0.5, f: 900, q: 1 }); tone(660, 0.08, { v: 0.08 }); },
    drop() { noise(0.09, { v: 0.9, f: 300, q: 0.7, ft: 'lowpass' }); },
    key() { tone(3100, 0.05, { v: 0.12 }); tone(3900, 0.08, { t: at(0.06), v: 0.1 }); },
    task() { tone(880, 0.03, { v: 0.08, type: 'square' }); },
    gulp() { tone(170 + Math.random() * 70, 0.08, { to: 110, v: 0.14 }); },
    crank() { noise(0.03, { v: 0.5, f: 800 + Math.random() * 300, q: 3 }); },
    done() { tone(660, 0.09, { v: 0.1, type: 'triangle' }); tone(990, 0.16, { t: at(0.09), v: 0.1, type: 'triangle' }); },
    engine() { noise(1.8, { v: 0.9, f: 130, fto: 320, q: 0.6, ft: 'lowpass', a: 0.3 }); tone(55, 1.8, { to: 100, v: 0.22, type: 'sawtooth' }); },
    car() { noise(2.4, { v: 0.7, f: 240, fto: 90, q: 0.5, ft: 'lowpass', a: 1.0 }); },        // 彼の車が着く
    ring() { for (let i = 0; i < 14; i++) tone(440, 0.04, { t: at(i * 0.06), v: 0.1 }); },
    horn() { tone(392, 0.3, { v: 0.1, type: 'square', echo: 0.4 }); tone(494, 0.3, { v: 0.08, type: 'square' }); },
    thud() { tone(100, 0.16, { to: 50, v: 0.3 }); noise(0.1, { v: 0.9, f: 250, ft: 'lowpass' }); },
    card() { tone(55, 1.4, { v: 0.22 }); tone(82.5, 1.4, { v: 0.1 }); },
    dead() { noise(0.1, { v: 0.7, f: 600, q: 0.5 }); tone(60, 0.7, { to: 35, v: 0.3 }); },
    spare() { tone(1320, 0.7, { v: 0.12, echo: 0.5 }); },
    ui() { noise(0.012, { v: 0.2, f: 3000, q: 2 }); },
    empty() { noise(0.01, { v: 0.2, f: 2000, q: 3 }); },
  };
  function sfx(n, o) {
    if (!ac || muted || ac.state !== 'running') return;
    const f = SFX[n];
    if (f) try { f(o); } catch (e) { if (DEBUG) console.warn('音', n, e); }
  }
  let stepN = 0;
  function step(kind) {
    if (!ac || muted || ac.state !== 'running') return;
    try { (STEP[kind] || STEP.road)(((stepN++ & 1) ? 0.2 : 0.7) + Math.random() * 0.3); } catch (e) { if (DEBUG) console.warn('音', e); }
  }
  function applyAmb() {
    if (!ac) return;
    const s = amb ? AMB[amb] : null, t = now(), set = (p, v) => p.setTargetAtTime(v, t, 0.6);
    set(L.wind.gain, s ? s.wind : 0); set(L.room.gain, s ? s.room[1] : 0); if (s) set(L.roomF.frequency, s.room[0]); set(L.hum.gain, s ? s.hum : 0);
  }
  function setAmb(k) { if (k === amb) return; amb = k; applyAmb(); }
  function mute(b) { muted = !!b; if (ac) master.gain.setTargetAtTime(muted ? 0 : 0.8, now(), 0.03); }
  function pause(b) { if (!ac) return; if (b) { if (ac.state === 'running') ac.suspend(); } else if (ac.state === 'suspended') ac.resume(); }
  return { unlock, sfx, step, setAmb, mute, pause, get muted() { return muted; }, dbg: DEBUG ? { SFX, STEP, AMB } : null };
})();
