// ───────── 音 ─────────
// 音楽はない。夜の住宅街の虫の声と、足音と、心臓の音。彼の足音は、近いほど大きく、いる方向から聞こえる。
// すべてその場で合成する。
const Snd = (() => {
  let ac = null, master, sfxB, ambB, nbuf = null, muted = false, bugT = 0, on = false;
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { ac = null; return false; }
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.85;
    sfxB = ac.createGain(); sfxB.gain.value = 0.9; ambB = ac.createGain(); ambB.gain.value = on ? 1 : 0;
    sfxB.connect(master); ambB.connect(master);
    // 音が重なっても割れないように、大きすぎる山だけ丸める（半分の大きさまでは、そのまま通す）
    const pre = ac.createGain(), sh = ac.createWaveShaper(), cv = new Float32Array(2048);
    for (let i = 0; i < cv.length; i++) { const x = (i / (cv.length - 1) * 2 - 1) * 3, m = Math.abs(x); cv[i] = Math.sign(x) * (m <= 0.5 ? m : 0.5 + 0.5 * Math.tanh((m - 0.5) / 0.5)); }
    pre.gain.value = 1 / 3; sh.curve = cv; master.connect(pre); pre.connect(sh); sh.connect(ac.destination);
    const n = ac.sampleRate * 2; nbuf = ac.createBuffer(1, n, ac.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // 遠くの街の、低いうなり
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 320; g.gain.value = 0.42; s.connect(f); f.connect(g); g.connect(ambB); s.start();
    return true;
  }
  function unlock() { if (!init()) return; if (ac.state !== 'running') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); } }
  const now = () => ac.currentTime, at = s => now() + s;
  function out(g, o) {
    let node = g;
    if (o.pan != null && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); node = p; }
    node.connect(o.bus || sfxB);
  }
  // o: { t 開始, type 波形, to 終わりの高さ, v 大きさ, a 立ち上がり, hold のびる, pan 左右 }
  function tone(f, d, o) {
    o = o || {};
    const t = o.t || now(), os = ac.createOscillator(), g = ac.createGain();
    os.type = o.type || 'sine'; os.frequency.setValueAtTime(f, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + d);
    const v = o.v == null ? 0.2 : o.v, a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a);
    if (o.hold) { g.gain.setValueAtTime(v, t + Math.max(a, d * 0.6)); g.gain.linearRampToValueAtTime(0.0001, t + d); } else g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    os.connect(g); out(g, o); os.start(t); os.stop(t + d + 0.03);
  }
  function noise(d, o) {
    o = o || {};
    const t = o.t || now(), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nbuf; s.loop = true; f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + d);
    f.Q.value = o.q || 1;
    const v = o.v == null ? 0.2 : o.v;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.a || 0.003)); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); out(g, o); s.start(t, Math.random() * 1.9); s.stop(t + d + 0.03);
  }
  // 低い音だけだと、スマホのスピーカーでは聞こえない。どの音にも、中くらいの高さの成分を入れてある
  const SFX = {
    step(o) { noise(0.045, { v: 0.42 * o.v, f: 1100 + Math.random() * 400, q: 1.6 }); },                                  // 自分の足音（アスファルト）
    astep(o) {                                                                                                            // 彼の足音。重い靴が、路面を叩く
      const v = o.v, pan = o.pan, j = 0.9 + Math.random() * 0.2;
      noise(0.08, { v: 1.5 * v, f: 250, q: 0.8, ft: 'lowpass', pan }); noise(0.05, { v: 2.6 * v, f: 820 * j, q: 1.3, pan }); noise(0.028, { v: 0.9 * v, f: 2500 * j, q: 2, pan });
    },
    pant(o) { noise(0.28, { v: 0.3 * o.v, f: 1500, fto: 700, q: 0.7, a: 0.08 }); },                                       // 息が切れる
    heart(o) {
      tone(58, 0.14, { v: 0.42 * o.v, to: 40 }); tone(52, 0.16, { t: at(0.17), v: 0.3 * o.v, to: 38 });
      tone(132, 0.09, { v: 0.16 * o.v, to: 80 }); tone(120, 0.1, { t: at(0.17), v: 0.11 * o.v, to: 74 });
    },
    sting(o) { for (const f of [98, 104, 147, 294]) tone(f, 1.6 * o.v, { v: (f > 200 ? 0.07 : 0.17) * o.v, type: 'sawtooth', a: 0.02 }); noise(0.9 * o.v, { v: 0.5 * o.v, f: 300, q: 0.5, ft: 'lowpass' }); },   // 走りだす・見つかる
    grab() { noise(0.12, { v: 0.9, f: 500, q: 0.7 }); tone(110, 0.18, { v: 0.3, to: 60 }); },
    hiss() { noise(0.9, { v: 0.32, f: 5200, q: 0.8, a: 0.25 }); },                                                        // 圧縮空気
    bolt() { noise(0.05, { v: 1.4, f: 900, q: 0.8 }); tone(95, 0.35, { to: 42, v: 0.5 }); tone(190, 0.12, { to: 90, v: 0.3, type: 'square' }); noise(0.3, { t: at(0.03), v: 0.7, f: 3000, fto: 700, q: 1 }); },
    wet() { noise(0.4, { v: 1.0, f: 420, fto: 160, q: 0.9 }); noise(0.18, { t: at(0.05), v: 0.6, f: 1900, fto: 700, q: 2 }); },
    crack() { noise(0.035, { v: 1.4, f: 1700 + Math.random() * 600, q: 3 }); tone(210, 0.07, { v: 0.3, to: 120, type: 'square' }); },
    thud() { tone(88, 0.22, { to: 44, v: 0.5 }); noise(0.14, { v: 1.2, f: 240, ft: 'lowpass' }); noise(0.06, { v: 0.6, f: 700, q: 1 }); },
    key() { for (let i = 0; i < 3; i++) noise(0.02, { t: at(i * 0.07 + Math.random() * 0.03), v: 0.55, f: 3200 + Math.random() * 1600, q: 5 }); },
    door() { noise(0.1, { v: 1.1, f: 500, q: 1.2 }); tone(150, 0.1, { v: 0.2 }); noise(0.05, { t: at(0.5), v: 0.9, f: 900, q: 2 }); },
    card() { tone(55, 1.6, { v: 0.2 }); tone(82.5, 1.6, { v: 0.09 }); tone(110, 1.6, { v: 0.06 }); },
    ui() { noise(0.012, { v: 0.5, f: 3000, q: 2 }); },
  };
  function sfx(n, o) { if (!ac || muted || ac.state !== 'running') return; try { SFX[n](Object.assign({ v: 1 }, o || {})); } catch (e) { if (DEBUG) console.warn('音', n, e); } }
  // 夜の虫（リーリーリー）。毎フレーム呼ぶ
  function tick(dt) {
    if (!ac || muted || ac.state !== 'running' || !on) return;
    bugT -= dt;
    if (bugT <= 0) { bugT = 0.9 + Math.random() * 2.2; const f = 4100 + Math.random() * 500, n = 4 + Math.floor(Math.random() * 6), p = Math.random() * 1.6 - 0.8; for (let i = 0; i < n; i++) tone(f, 0.03, { t: at(i * 0.055), v: 0.024, bus: ambB, pan: p }); }
  }
  function ambient(b) { on = !!b; if (ac) ambB.gain.setTargetAtTime(b ? 1 : 0, now(), 0.5); }
  function mute(b) { muted = !!b; if (ac) master.gain.setTargetAtTime(muted ? 0 : 0.85, now(), 0.03); }
  function pause(b) { if (!ac) return; if (b) { if (ac.state === 'running') ac.suspend(); } else if (ac.state === 'suspended') ac.resume(); }
  return { unlock, sfx, tick, ambient, mute, pause, get muted() { return muted; }, dbg: DEBUG ? { SFX } : null };
})();
