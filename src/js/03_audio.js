// ───────── 音 ─────────
// 音源はすべてその場で合成する。むかしの MIDI 音源のオルゴールのような音。
// アセラが運動を奪うと、テンポが落ち、音程が沈み、こもって、止まる。
const Snd = (() => {
  let ac = null, master, lp, mus, sfxB, dly, fbk, det = null, nbuf = null;
  let on = true, motion = 1, lastM = -1, song = null, stepI = 0, nextT = 0;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { ac = null; return false; }
    master = ac.createGain(); master.gain.value = on ? 0.8 : 0;
    lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 12000; lp.Q.value = 0.3;
    mus = ac.createGain(); mus.gain.value = 0.55;
    sfxB = ac.createGain(); sfxB.gain.value = 0.9;
    dly = ac.createDelay(1.0); dly.delayTime.value = 0.36;
    fbk = ac.createGain(); fbk.gain.value = 0.3;
    mus.connect(lp); mus.connect(dly); dly.connect(fbk); fbk.connect(dly); dly.connect(lp);
    lp.connect(master); sfxB.connect(master); master.connect(ac.destination);
    if (ac.createConstantSource) { det = ac.createConstantSource(); det.offset.value = 0; det.start(); }
    const n = ac.sampleRate; nbuf = ac.createBuffer(1, n, n);
    const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function unlock() { if (!init()) return; if (ac.state !== 'running') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } }
  const now = () => ac.currentTime;

  function tone(f, d, o) {
    o = o || {};
    const t = o.t || now(), os = ac.createOscillator(), g = ac.createGain();
    os.type = o.type || 'sine';
    os.frequency.setValueAtTime(f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + d);
    if (o.bend && det) det.connect(os.detune);
    const v = o.v == null ? 0.2 : o.v, a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (o.hold) { g.gain.setValueAtTime(v, t + Math.max(a, d - (o.rel || 0.05))); g.gain.linearRampToValueAtTime(0.0001, t + d); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    os.connect(g); g.connect(o.bus || sfxB);
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
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(o.bus || sfxB);
    s.start(t, Math.random() * 0.9); s.stop(t + d + 0.03);
  }

  // 楽器
  function inst(kind, m, t, v, d) {
    const f = mtof(m);
    if (kind === 'bell') { tone(f, d, { t, v, bus: mus, bend: 1 }); tone(f * 3.01, d * 0.3, { t, v: v * 0.2, bus: mus, bend: 1 }); }
    else if (kind === 'ep') { tone(f, d, { t, v, type: 'triangle', bus: mus, bend: 1 }); tone(f * 2, d * 0.5, { t, v: v * 0.18, bus: mus, bend: 1 }); }
    else if (kind === 'glass') { tone(f, d * 1.3, { t, v: v * 0.9, bus: mus, bend: 1 }); tone(f * 4.16, d * 0.22, { t, v: v * 0.12, bus: mus, bend: 1 }); }
    else if (kind === 'chip') { tone(f, d * 0.35, { t, v: v * 0.4, type: 'square', bus: mus, bend: 1 }); }
  }
  function pad(notes, t, d, v) {
    for (const m of notes) tone(mtof(m), d, { t, v, type: 'triangle', a: d * 0.35, hold: 1, rel: d * 0.4, bus: mus, bend: 1 });
  }

  // 曲。主旋律は 1 つだけで、部屋ごとに音階・楽器・速さを変えて使い回す。
  const SC = { ion: [0, 2, 4, 5, 7, 9, 11], lyd: [0, 2, 4, 6, 7, 9, 11], dor: [0, 2, 3, 5, 7, 9, 10], aeo: [0, 2, 3, 5, 7, 8, 10], mix: [0, 2, 4, 5, 7, 9, 10] };
  const MOTIF = [2, -1, 4, -1, 5, -1, 2, -1, 1, -1, -1, 0, 1, -1, -1, -1, 2, -1, 4, -1, 7, -1, 6, -1, 5, -1, -1, -1, 4, -1, -1, -1];
  const ROOTS = [0, 5, 3, 4];
  const SONGS = {
    title:   { bpm: 72, key: 60, sc: 'ion', lead: 'bell',  oct: 12, drop: 0.0,  padV: 0.04,  arp: 0.4 },
    atelier: { bpm: 70, key: 60, sc: 'ion', lead: 'bell',  oct: 12, drop: 0.08, padV: 0.035, arp: 0.3 },
    hall:    { bpm: 60, key: 58, sc: 'lyd', lead: 'glass', oct: 12, drop: 0.3,  padV: 0.03,  arp: 0.1 },
    sky:     { bpm: 84, key: 65, sc: 'lyd', lead: 'bell',  oct: 12, drop: 0.15, padV: 0.04,  arp: 0.6 },
    street:  { bpm: 54, key: 57, sc: 'aeo', lead: 'ep',    oct: 0,  drop: 0.35, padV: 0.03,  arp: 0.0, amb: 'bugs' },
    gogo:    { bpm: 64, key: 62, sc: 'mix', lead: 'ep',    oct: 12, drop: 0.2,  padV: 0.035, arp: 0.2, amb: 'semi' },
    water:   { bpm: 58, key: 56, sc: 'dor', lead: 'glass', oct: 12, drop: 0.4,  padV: 0.03,  arp: 0.15 },
    cons:    { bpm: 96, key: 61, sc: 'ion', lead: 'chip',  oct: 12, drop: 0.45, padV: 0,     arp: 0.5, amb: 'modem', broken: 1 },
  };
  const deg = (s, d) => s.key + SC[s.sc][((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
  function ambient(k, t) {
    if (k === 'bugs') { for (let i = 0; i < 9; i++) tone(4300 + Math.random() * 60, 0.03, { t: t + i * 0.055, v: 0.016, bus: mus, bend: 1 }); }
    else if (k === 'semi') {
      for (let i = 0; i < 24; i++) noise(0.035, { t: t + i * 0.045, v: 0.018, f: 5200, q: 6, bus: mus });
      if (Math.random() < 0.4) inst('glass', 96 + pick([0, 4, 7]), t + 0.3, 0.05, 1.8);
    } else if (k === 'modem') {
      let tt = t;
      for (let i = 0; i < 6; i++) { tone(pick([1200, 2100, 1650, 980, 2400]), 0.07, { t: tt, v: 0.022, type: 'square', bus: mus, bend: 1 }); tt += 0.08; }
      noise(0.3, { t: tt, v: 0.018, f: 2200, q: 2, bus: mus });
    }
  }
  function schedule(s, i, t, sd) {
    const bar = (i >> 3) & 3, st = i & 7, root = ROOTS[bar];
    if (st === 0) {
      if (s.padV) pad([deg(s, root) - 12, deg(s, root + 2) - 12, deg(s, root + 4) - 12, deg(s, root + 6) - 12], t, sd * 8, s.padV);
      tone(mtof(deg(s, root) - 24), sd * 6, { t, v: 0.085, bus: mus, bend: 1 });
    }
    const m = MOTIF[i & 31];
    if (m >= 0 && Math.random() >= s.drop) {
      let note = deg(s, m) + s.oct;
      if (s.broken && Math.random() < 0.2) note += pick([-1, 1, 6]);
      inst(s.lead, note, t, 0.15, 1.6);
    } else if (Math.random() < s.arp * 0.5) {
      inst(s.lead, deg(s, root + pick([0, 2, 4, 6])) + s.oct, t, 0.055, 1.0);
    }
    if (s.amb && st === 4 && Math.random() < 0.5) ambient(s.amb, t);
  }
  function tick() {
    if (!ac || ac.state !== 'running') return;
    if (Math.abs(motion - lastM) > 0.01) {
      lastM = motion; const t = now();
      if (det) det.offset.setTargetAtTime(-1400 * Math.pow(1 - motion, 1.3), t, 0.05);
      lp.frequency.setTargetAtTime(350 + motion * motion * 11650, t, 0.05);
      mus.gain.setTargetAtTime(0.55 * (0.2 + 0.8 * motion), t, 0.05);
    }
    if (!song) return;
    const t = now();
    if (nextT < t - 0.3) nextT = t + 0.05;
    if (motion < 0.12) { nextT = Math.max(nextT, t + 0.05); return; }
    while (nextT < t + 0.14) {
      const sd = 30 / song.bpm / Math.max(0.35, motion);
      try { schedule(song, stepI, nextT, sd); } catch (e) { if (DEBUG) console.warn('音', e); }
      nextT += sd; stepI++;
    }
  }
  function music(id) {
    const s = id ? SONGS[id] || null : null;
    if (s === song) return;
    song = s; stepI = 0;
    if (ac) nextT = now() + 0.3;
  }

  const SFX = {
    step() { noise(0.035, { v: 0.045, f: 900 + Math.random() * 500, q: 1.5 }); },
    wade() { noise(0.16, { v: 0.08, f: 700 + Math.random() * 300, fto: 300, q: 0.8 }); },
    blip() { tone(880, 0.06, { type: 'square', v: 0.05 }); },
    look() { tone(660, 0.05, { type: 'square', v: 0.045 }); tone(990, 0.06, { type: 'square', v: 0.04, t: now() + 0.05 }); },
    scratch() { noise(0.05, { v: 0.05, f: 2500 + Math.random() * 2500, q: 2.5 }); },
    get() { [72, 76, 79, 84].forEach((m, i) => tone(mtof(m), 0.5, { t: now() + i * 0.07, v: 0.13 })); noise(0.4, { v: 0.035, f: 7000, q: 1 }); },
    save() {
      for (let i = 0; i < 7; i++) noise(0.03, { t: now() + i * 0.06 + Math.random() * 0.02, v: 0.07, f: 300 + Math.random() * 900, q: 3 });
      [67, 72, 76].forEach((m, i) => tone(mtof(m), 0.4, { t: now() + 0.5 + i * 0.09, v: 0.12, type: 'triangle' }));
    },
    door() { noise(0.25, { v: 0.09, f: 300, fto: 1800, q: 0.7 }); },
    omen(o) { const d = (o && o.d) || 2.5; tone(520, d, { to: 60, v: 0.06, type: 'triangle' }); noise(d, { v: 0.045, f: 3000, fto: 200, q: 0.6 }); },
    whoosh() { noise(0.35, { v: 0.13, f: 500, fto: 2600, q: 1.2 }); },
    dash() { for (let i = 0; i < 6; i++) noise(0.025, { t: now() + i * 0.045, v: 0.09, f: 1700 + i * 120, q: 2 }); },
    voice() { for (let i = 0; i < 3; i++) tone(1040 + Math.random() * 240, 0.045, { t: now() + i * 0.06, v: 0.045, type: 'square' }); },
    tick() { tone(1900, 0.02, { v: 0.05, type: 'square' }); },
    found() { [61, 62, 68, 73].forEach(m => tone(mtof(m + 12), 0.9, { v: 0.09, type: 'sawtooth' })); noise(0.5, { v: 0.14, f: 1200, q: 0.5 }); },
    catch() { tone(110, 0.5, { to: 40, v: 0.28, type: 'square' }); noise(0.4, { v: 0.22, f: 200, q: 0.5 }); },
    err() { tone(mtof(79), 0.18, { v: 0.15, type: 'triangle' }); tone(mtof(72), 0.5, { v: 0.15, type: 'triangle', t: now() + 0.13 }); },
    ding() { tone(mtof(84), 0.5, { v: 0.11 }); tone(mtof(88), 0.6, { v: 0.09, t: now() + 0.08 }); },
    open() { tone(mtof(72), 0.08, { v: 0.06, type: 'square' }); tone(mtof(79), 0.1, { v: 0.06, type: 'square', t: now() + 0.07 }); },
    close() { tone(mtof(79), 0.08, { v: 0.06, type: 'square' }); tone(mtof(72), 0.1, { v: 0.06, type: 'square', t: now() + 0.07 }); },
    boot() {
      for (let i = 0; i < 10; i++) noise(0.02, { t: now() + i * 0.05 + Math.random() * 0.03, v: 0.06, f: 500 + Math.random() * 1500, q: 4 });
      [60, 67, 72, 76].forEach((m, i) => tone(mtof(m), 0.7, { t: now() + 0.55 + i * 0.11, v: 0.1 }));
    },
    drip() { tone(1500, 0.12, { to: 500, v: 0.08 }); tone(700, 0.2, { to: 900, v: 0.045, t: now() + 0.06 }); },
    stutter() { for (let i = 0; i < 14; i++) { tone(233, 0.045, { t: now() + i * 0.05, v: 0.15, type: 'square' }); tone(311, 0.045, { t: now() + i * 0.05, v: 0.11, type: 'square' }); } },
    end() { [72, 76, 79, 84, 88].forEach((m, i) => tone(mtof(m), 1.4, { t: now() + i * 0.16, v: 0.11 })); },
  };
  function sfx(n, o) {
    if (!ac || !on || ac.state !== 'running') return;
    const f = SFX[n];
    if (f) try { f(o); } catch (e) { if (DEBUG) console.warn('音', n, e); }
  }
  function mute(b) { on = !b; if (ac) master.gain.setTargetAtTime(on ? 0.8 : 0, now(), 0.02); }
  function setMotion(m) { motion = m; }
  function pause(b) { if (!ac) return; if (b) { if (ac.state === 'running') ac.suspend(); } else if (ac.state === 'suspended') ac.resume(); }
  return { unlock, tick, music, sfx, mute, setMotion, pause, get on() { return on; } };
})();
