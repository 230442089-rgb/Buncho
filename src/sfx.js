/* 天下布鳥 — 効果音。音源ファイルは使わず、Web Audio でその場で合成する。
 * TF.sfx.play('boom', { size: 1.4 }) のように呼ぶ。最初のタップで unlock() しておく。 */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};
  var AC = root.AudioContext || root.webkitAudioContext;
  var ctx = null, master = null, noiseBuf = null, enabled = true, VOL = 0.85, loops = {};

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { return null; }
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 7; comp.attack.value = 0.003; comp.release.value = 0.22;
      master = ctx.createGain(); master.gain.value = enabled ? VOL : 0;
      master.connect(comp); comp.connect(ctx.destination);
      var len = Math.floor(ctx.sampleRate * 2), d;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* 次のタップで */ } }
    return ctx;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ── 部品 ──
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(t, o) { // 単音。f0→f1 へ音程を動かせる
    var osc = ctx.createOscillator(), g = ctx.createGain(), a = o.attack || 0.004, node = osc;
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || o.dur));
    env(g, t, a, o.gain || 0.2, o.dur);
    if (o.lp) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + a + o.dur + 0.05);
  }
  function noise(t, o) { // ノイズをフィルタに通す。爆発・銃声・風切り音の素
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), a = o.attack || 0.002;
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.7;
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + a + o.dur);
    env(g, t, a, o.gain || 0.3, o.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 1.5); src.stop(t + a + o.dur + 0.05);
  }
  function brass(t, f, dur, gain) { // 金管ふうの和音用
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = o2.type = 'sawtooth'; o1.frequency.value = f; o2.frequency.value = f * 1.006;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(600, t); lp.frequency.linearRampToValueAtTime(2400, t + 0.06); lp.frequency.linearRampToValueAtTime(1200, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.03);
    g.gain.setValueAtTime(gain, t + Math.max(0.04, dur - 0.1)); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.06);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function pluck(t, f, gain) { // 琴・三味線ふうの撥弦
    tone(t, { type: 'triangle', f0: f, dur: 0.55, gain: gain, attack: 0.002 });
    tone(t, { type: 'sine', f0: f * 2, dur: 0.18, gain: gain * 0.4, attack: 0.002 });
    noise(t, { type: 'highpass', f0: 3000, dur: 0.015, gain: gain * 0.5 });
  }
  function taiko(t, gain) {
    tone(t, { f0: 150, f1: 52, dur: 0.34, gain: gain, attack: 0.002 });
    noise(t, { f0: 900, f1: 200, dur: 0.05, gain: gain * 0.7 });
  }
  function horagai(t, dur, gain) { // 法螺貝。低く始まり、途中で四度はね上がる
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'square';
    [[o1, 1], [o2, 0.5]].forEach(function (p) {
      var f = p[0].frequency, k = p[1];
      f.setValueAtTime(150 * k, t); f.linearRampToValueAtTime(185 * k, t + 0.3);
      f.setValueAtTime(185 * k, t + dur * 0.6); f.linearRampToValueAtTime(247 * k, t + dur * 0.68);
    });
    vib.frequency.value = 5.5; vg.gain.value = 3; vib.connect(vg); vg.connect(o1.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 680; lp.Q.value = 2.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.28);
    g.gain.setValueAtTime(gain, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    [o1, o2, vib].forEach(function (o) { o.start(t); o.stop(t + dur + 0.05); });
  }
  function boom(t, size, gain) {
    size = size || 1; gain = (gain || 0.6) * Math.min(1.25, 0.75 + size * 0.25);
    noise(t, { f0: 1100 * size, f1: 55, dur: 0.55 * size, gain: gain * 0.9, attack: 0.003 });
    tone(t, { f0: 95, f1: 27, dur: 0.75 * size, gain: gain, attack: 0.003 });
    noise(t, { type: 'highpass', f0: 2600, dur: 0.07, gain: gain * 0.28 });
  }
  function gun(t, gain) {
    noise(t, { type: 'bandpass', f0: rnd(1300, 1900), q: 1.1, dur: 0.05, gain: gain });
    noise(t, { type: 'highpass', f0: 3200, dur: 0.018, gain: gain * 0.6 });
  }

  var N = { D3: 146.83, F3: 174.61, G3: 196, A3: 220, D4: 293.66, 'F#4': 369.99, G4: 392, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, 'F#5': 739.99, G5: 783.99, A5: 880, D6: 1174.66 };

  // ── 効果音の一覧 ──
  var SOUNDS = {
    click: function (t) { tone(t, { f0: 720, f1: 940, dur: 0.035, gain: 0.07 }); },
    select: function (t) { tone(t, { type: 'triangle', f0: 520, f1: 800, dur: 0.07, gain: 0.11 }); },
    open: function (t) { tone(t, { type: 'triangle', f0: 400, f1: 620, dur: 0.09, gain: 0.08 }); },
    deny: function (t) { tone(t, { type: 'square', f0: 170, f1: 120, dur: 0.12, gain: 0.07, lp: 900 }); },
    build: function (t) { [0, 0.13, 0.26].forEach(function (d, i) { noise(t + d, { type: 'bandpass', f0: 1300 - i * 150, q: 5, dur: 0.035, gain: 0.3 }); tone(t + d, { type: 'triangle', f0: 320, f1: 210, dur: 0.05, gain: 0.12 }); }); },
    recruit: function (t) { taiko(t, 0.35); taiko(t + 0.16, 0.25); },
    coin: function (t) { tone(t, { f0: 1318, dur: 0.12, gain: 0.09 }); tone(t + 0.06, { f0: 1760, dur: 0.22, gain: 0.09 }); },
    move: function (t) { noise(t, { type: 'bandpass', f0: 300, f1: 1400, q: 0.9, dur: 0.22, gain: 0.16, attack: 0.05 }); taiko(t + 0.04, 0.2); },
    chirp: function (t, o) { // ピヨピヨ
      var n = o.n || 2;
      for (var i = 0; i < n; i++) { var f = rnd(2500, 3300), tt = t + i * rnd(0.09, 0.13); tone(tt, { f0: f, f1: f * 1.55, dur: 0.05, gain: 0.1 }); tone(tt + 0.045, { f0: f * 1.5, f1: f * 1.05, dur: 0.05, gain: 0.07 }); }
    },
    tech: function (t) { // 研究完了:鳥たちのさえずりと上行の音
      SOUNDS.chirp(t, { n: 3 });
      [N.D5, N['F#5'], N.A5, N.D6].forEach(function (f, i) { tone(t + 0.3 + i * 0.085, { type: 'triangle', f0: f, dur: 0.3, gain: 0.12 }); });
      SOUNDS.chirp(t + 0.75, { n: 2 });
    },
    dario: function (t) { [880, 1174.66, 1567.98].forEach(function (f, i) { tone(t + i * 0.055, { f0: f, dur: 0.06, gain: 0.055 }); }); },
    turn: function (t) { // 拍子木「チョン、チョン」
      [0, 0.17].forEach(function (d) { noise(t + d, { type: 'highpass', f0: 2200, dur: 0.02, gain: 0.25 }); tone(t + d, { f0: 1500, f1: 1150, dur: 0.045, gain: 0.16 }); });
      taiko(t + 0.34, 0.22);
    },
    launch: function (t) { taiko(t, 0.6); taiko(t + 0.14, 0.45); noise(t + 0.05, { type: 'bandpass', f0: 280, f1: 3200, q: 0.8, dur: 0.4, gain: 0.2, attack: 0.1 }); },
    taiko: function (t, o) { taiko(t, o.gain || 0.5); },
    horagai: function (t, o) { horagai(t, o.dur || 1.5, o.gain || 0.16); },
    roar: function (t, o) { // 鬨の声
      var d = o.dur || 1.3;
      noise(t, { type: 'bandpass', f0: 560, f1: 760, q: 1.1, dur: d, gain: 0.2, attack: 0.35 });
      noise(t + 0.05, { type: 'bandpass', f0: 1050, f1: 1250, q: 1.4, dur: d * 0.9, gain: 0.1, attack: 0.4 });
    },
    gun: function (t, o) { gun(t, o.gain || 0.22); },
    mg: function (t, o) { var n = o.n || 6; for (var i = 0; i < n; i++) gun(t + i * (o.gap || 0.065), (o.gain || 0.2) * rnd(0.8, 1.1)); },
    volley: function (t) { for (var i = 0; i < 7; i++) { var d = rnd(0, 0.16); noise(t + d, { f0: 1500, f1: 300, dur: 0.12, gain: 0.16 }); tone(t + d, { f0: 140, f1: 60, dur: 0.1, gain: 0.1 }); } }, // 火縄銃の斉射
    cannon: function (t, o) { var g = o.gain || 0.55; noise(t, { f0: 3200, f1: 180, dur: 0.3, gain: g * 0.8 }); tone(t, { f0: 115, f1: 36, dur: 0.55, gain: g }); },
    boom: function (t, o) { boom(t, o.size || 1, o.gain); },
    whistle: function (t, o) { tone(t, { f0: 2300, f1: 650, dur: o.dur || 0.45, gain: 0.06, attack: 0.03 }); },
    rocket: function (t) { noise(t, { type: 'bandpass', f0: 1400, f1: 320, q: 1.2, dur: 0.4, gain: 0.2, attack: 0.02 }); },
    jet: function (t, o) { // 頭上を通過する轟音
      var d = o.dur || 1.5, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.Q.value = 0.9;
      f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(2800, t + d * 0.45); f.frequency.exponentialRampToValueAtTime(260, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + d * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + d + 0.05);
      tone(t, { f0: 70, f1: 45, dur: d, gain: 0.25, attack: d * 0.4 });
    },
    twinkle: function (t) { tone(t, { f0: 2637, dur: 0.22, gain: 0.07 }); tone(t + 0.06, { f0: 3520, dur: 0.3, gain: 0.06 }); tone(t + 0.11, { type: 'triangle', f0: 5274, dur: 0.28, gain: 0.03 }); },
    stamp: function (t) { // 「制圧」の判子:ドン、シャキーン
      taiko(t, 0.7);
      noise(t + 0.02, { type: 'highpass', f0: 5200, dur: 0.14, gain: 0.07 });
      tone(t + 0.03, { type: 'triangle', f0: 1975.5, dur: 0.5, gain: 0.07 }); tone(t + 0.03, { f0: 2960, dur: 0.7, gain: 0.04 });
    },
    victory: function (t) { // 勝利:太鼓と金管
      taiko(t, 0.6); taiko(t + 0.13, 0.45);
      [[N.D4, 0.02, 0.13], [N.G4, 0.16, 0.13], [N.A4, 0.3, 0.13], [N.D5, 0.44, 0.75]].forEach(function (n) { brass(t + n[1], n[0], n[2], 0.11); });
      brass(t + 0.44, N['F#4'], 0.75, 0.07); brass(t + 0.44, N.A4, 0.75, 0.07);
      taiko(t + 0.44, 0.7);
      SOUNDS.chirp(t + 1.05, { n: 3 });
    },
    bigwin: function (t) { // 天下統一・地球統一
      horagai(t, 1.6, 0.15);
      for (var i = 0; i < 9; i++) taiko(t + 1.2 + i * (0.2 - i * 0.012), 0.35 + i * 0.04);
      var s = t + 2.75;
      [[N.D4, 0, 0.16], [N['F#4'], 0.18, 0.16], [N.A4, 0.36, 0.16], [N.D5, 0.54, 0.3], [N.B4, 0.88, 0.16], [N.D5, 1.06, 0.16], [N['F#5'], 1.24, 1.3]].forEach(function (n) { brass(s + n[1], n[0], n[2], 0.11); });
      brass(s + 1.24, N.A4, 1.3, 0.08); brass(s + 1.24, N.D5, 1.3, 0.08); brass(s + 1.24, N.D3, 1.3, 0.1);
      taiko(s + 1.24, 0.8); boom(s + 1.3, 1.3, 0.3);
      SOUNDS.chirp(s + 2.2, { n: 4 });
    },
    defeat: function (t) { [[N.A3, 0, 0.3], [N.F3, 0.32, 0.3], [N.D3, 0.64, 0.8]].forEach(function (n) { brass(t + n[1], n[0], n[2], 0.1); }); taiko(t + 0.64, 0.4); },
    submit: function (t) { [N.D4, N.G4, N.A4, N.D5, N.G5].forEach(function (f, i) { pluck(t + i * 0.07, f, 0.16); }); SOUNDS.chirp(t + 0.5, { n: 2 }); },
    refuse: function (t) { pluck(t, N.A3, 0.16); pluck(t + 0.16, N.F3 * 1.06, 0.16); taiko(t + 0.3, 0.25); },
    warn: function (t) { taiko(t, 0.45); taiko(t + 0.22, 0.45); horagai(t + 0.1, 0.9, 0.08); },
    firework: function (t) { tone(t, { f0: 500, f1: 1500, dur: 0.3, gain: 0.03, attack: 0.05 }); boom(t + 0.32, 0.7, 0.3); for (var i = 0; i < 5; i++) noise(t + 0.4 + rnd(0, 0.35), { type: 'highpass', f0: 4000, dur: 0.03, gain: 0.06 }); }
  };

  function play(name, opts) {
    if (!enabled || !SOUNDS[name]) return;
    var c = ensure(); if (!c || c.state !== 'running') return;
    try { SOUNDS[name](c.currentTime + ((opts && opts.delay) || 0) + 0.005, opts || {}); } catch (e) { /* 音が出なくても遊べる */ }
  }
  // 鳴りつづける音(ヘリのローター)。止める関数を返す
  function loop(name) {
    if (!enabled) return function () {};
    var c = ensure(); if (!c || c.state !== 'running') return function () {};
    try {
      var t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), out = c.createGain();
      src.buffer = noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = name === 'heli' ? 420 : 900;
      lfo.type = 'square'; lfo.frequency.value = 13; lg.gain.value = 0.5; g.gain.value = 0.5;
      lfo.connect(lg); lg.connect(g.gain);
      out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.32, t + 0.5);
      src.connect(f); f.connect(g); g.connect(out); out.connect(master); src.start(t); lfo.start(t);
      var stopped = false;
      return function () {
        if (stopped) return; stopped = true;
        var now = c.currentTime;
        try { out.gain.cancelScheduledValues(now); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now); out.gain.exponentialRampToValueAtTime(0.0001, now + 0.5); src.stop(now + 0.55); lfo.stop(now + 0.55); } catch (e) { /* すでに止まっている */ }
      };
    } catch (e) { return function () {}; }
  }

  TF.sfx = {
    play: play, loop: loop,
    unlock: function () { ensure(); },
    setEnabled: function (on) { enabled = !!on; if (master && ctx) master.gain.setTargetAtTime(enabled ? VOL : 0, ctx.currentTime, 0.03); },
    isEnabled: function () { return enabled; },
    supported: function () { return !!AC; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
