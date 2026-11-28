/* 天下布鳥 — 効果音。音源ファイルは使わず、Web Audio でその場で合成する。
 * TF.sfx.play('boom', { size: 1.4 }) のように呼ぶ。最初のタップで unlock() しておく。 */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};
  var AC = root.AudioContext || root.webkitAudioContext;
  var ctx = null, master = null, noiseBuf = null, revIn = null, enabled = true, VOL = 0.9;
  var pending = [], lastErr = '', played = 0;
  // iPhone はマナーモードだと Web Audio が鳴らない。音を「メディア」として扱わせると鳴る
  var IOS = /iP(hone|ad|od)/.test(root.navigator ? navigator.userAgent : '') || (root.navigator && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var bypass = true, keep = null, keepState = 'off', keepUrl = null;

  function build(c) { // 出口と、ノイズの素を作る
    // 既製のコンプレッサは短い音を極端に小さくしたり大きくしたりするので使わない。
    // 音量をそろえたあと、大きすぎるところだけをなだらかに抑えて出す。
    var m = c.createGain(), pre = c.createGain(), sh = c.createWaveShaper(), n = 1024, curve = new Float32Array(n), k = Math.tanh(2.2);
    for (var j = 0; j < n; j++) { var x = j / (n - 1) * 2 - 1; curve[j] = Math.tanh(2.2 * x) / k * 0.98; }
    sh.curve = curve; try { sh.oversample = '2x'; } catch (e) { /* 無くてもよい */ }
    pre.gain.value = 0.6; m.connect(pre); pre.connect(sh); sh.connect(c.destination);
    var len = Math.floor(c.sampleRate * 2), nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // 残響:小さな板の間くらいの、短い部屋鳴り。操作音をやわらかく包む(どれだけ送るかは、音ごとに rev で決める)
    var rin = null;
    try {
      var cv = c.createConvolver(), rout = c.createGain(), rl = Math.floor(c.sampleRate * 1.3), ir = c.createBuffer(1, rl, c.sampleRate), rd = ir.getChannelData(0), lpv = 0;
      for (var r = 0; r < rl; r++) { var kk = r / rl; lpv += ((Math.random() * 2 - 1) * Math.pow(1 - kk, 2.6) - lpv) * (0.55 - 0.4 * kk); rd[r] = lpv; }   // 尾へ行くほど暗く、静かに
      cv.buffer = ir; rin = c.createGain(); rin.connect(cv); cv.connect(rout); rout.gain.value = 0.9; rout.connect(m);
    } catch (e) { rin = null; }
    return { master: m, noise: nb, out: sh, rev: rin };
  }
  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { lastErr = String(e); ctx = null; return null; }
      var g = build(ctx); master = g.master; noiseBuf = g.noise; revIn = g.rev; master.gain.value = enabled ? VOL : 0;
      try { ctx.onstatechange = flush; } catch (e) { /* 古い環境 */ }
    }
    return ctx;
  }
  function wake(c) { try { var p = c.resume(); if (p && p.then) p.then(flush, function (e) { lastErr = 'resume: ' + e; }); } catch (e) { lastErr = 'resume: ' + e; } }
  // 利用者の操作(指を離した瞬間・クリック・キー)の中で呼ぶ。ブラウザはそのときだけ音の開始を許す
  function unlock() {
    var c = ensure(); if (!c) return;
    if (c.state !== 'running') {
      wake(c);
      try { var s = c.createBufferSource(); s.buffer = c.createBuffer(1, 1, c.sampleRate); s.connect(c.destination); s.start(0); } catch (e) { /* 無音を一発。古い iOS はこれで目を覚ます */ }
    }
    if (enabled && bypass) mediaOn();
  }
  function flush() { // 止まっていたあいだに頼まれた音を、動き出したら鳴らす(古すぎるものは捨てる)
    if (!ctx || ctx.state !== 'running') return;
    musicSync();
    if (!pending.length) return;
    var now = Date.now(), q = pending; pending = [];
    q.forEach(function (it) { if (now - it.at < 700) fire(it.name, it.opts); });
  }
  function fire(name, opts) {
    try { SOUNDS[name](ctx.currentTime + ((opts && opts.delay) || 0) + 0.01, opts || {}); played++; } catch (e) { lastErr = name + ': ' + e; }
  }

  // ── マナーモード対策(iPhone) ──
  function silentWav(rate) { // 0.5秒の無音。音質が落ちないよう、本体と同じ標本化周波数・16bit で作る
    var n = Math.floor(rate / 2), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    return buf;
  }
  function mediaOn() {
    try { if (navigator.audioSession) { navigator.audioSession.type = 'playback'; keepState = 'session'; return; } } catch (e) { /* 使えなければ下の方法で */ }
    if (!IOS || keepState === 'failed') return;
    try {
      if (!keep) {
        keep = document.createElement('audio');
        keep.setAttribute('playsinline', ''); keep.setAttribute('x-webkit-airplay', 'deny'); keep.loop = true; keep.preload = 'auto'; keep.controls = false;
        try { keep.disableRemotePlayback = true; } catch (e) { /* 無くてもよい */ }
        var buf = silentWav(ctx ? ctx.sampleRate : 44100), dataUrl = function () { var b = new Uint8Array(buf), t = ''; for (var i = 0; i < b.length; i++) t += String.fromCharCode(b[i]); return 'data:audio/wav;base64,' + btoa(t); };
        try { keepUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); } catch (e) { keepUrl = null; }
        var triedData = !keepUrl; if (!keepUrl) keepUrl = dataUrl();
        keep.addEventListener('error', function () { // 置き場所(blob)が許されていなければ、埋め込み(data)でもう一度だけ
          if (triedData) { keepState = 'failed'; return; }
          triedData = true; keep.src = dataUrl(); keepState = 'retry';
        });
        keep.src = keepUrl;
      }
      if (keep.paused) { var p = keep.play(); if (p && p.then) p.then(function () { keepState = 'on'; }, function () { if (keepState !== 'failed') keepState = 'blocked'; }); else keepState = 'on'; }
    } catch (e) { keepState = 'failed'; }
  }
  function mediaOff() {
    try { if (navigator.audioSession && keepState === 'session') navigator.audioSession.type = 'auto'; } catch (e) { /* そのまま */ }
    try { if (keep) keep.pause(); } catch (e) { /* そのまま */ }
    if (keepState !== 'failed') keepState = 'off';
  }
  if (root.document) document.addEventListener('visibilitychange', function () { // 画面を離れたら無音の再生も止める
    if (document.hidden) { try { if (keep) keep.pause(); } catch (e) { /* そのまま */ } }
  });

  function rnd(a, b) { return a + Math.random() * (b - a); }

  // ── 部品 ──
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function wet(g, amount) { if (!amount || !revIn) return; var sg = ctx.createGain(); sg.gain.value = amount; g.connect(sg); sg.connect(revIn); }
  function tone(t, o) { // 単音。f0→f1 へ音程を動かせる
    var osc = ctx.createOscillator(), g = ctx.createGain(), a = o.attack || 0.004, node = osc;
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || o.dur));
    env(g, t, a, o.gain || 0.2, o.dur);
    if (o.lp) { var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(master); wet(g, o.rev);
    osc.start(t); osc.stop(t + a + o.dur + 0.05);
  }
  function noise(t, o) { // ノイズをフィルタに通す。爆発・銃声・風切り音の素
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), a = o.attack || 0.002;
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.7;
    f.frequency.setValueAtTime(o.f0 || 1000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + a + o.dur);
    env(g, t, a, o.gain || 0.3, o.dur);
    src.connect(f); f.connect(g); g.connect(master); wet(g, o.rev);
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
  // 操作音の部品。音程はすべてニの陽音階(レ・ミ・ソ・ラ・シ)から取るので、続けて鳴っても濁らない
  var YO = [587.33, 659.25, 783.99, 880, 987.77, 1174.66, 1318.51, 1567.98, 1760];
  function koto(t, f, gain, rev) { // やわらかい撥弦:芯の音に、すぐ消える倍音を重ねる
    tone(t, { type: 'triangle', f0: f, dur: 0.42, gain: gain, attack: 0.003, rev: rev });
    tone(t, { f0: f * 2.01, dur: 0.14, gain: gain * 0.35, attack: 0.002, rev: rev });
    tone(t, { f0: f * 3, dur: 0.06, gain: gain * 0.18, attack: 0.001 });
    noise(t, { type: 'bandpass', f0: 2600, q: 1.5, dur: 0.012, gain: gain * 0.35 });
  }
  function tick(t, f, gain, rev) { // 木を軽く打つ
    noise(t, { type: 'bandpass', f0: f, q: 4, dur: 0.018, gain: gain, rev: rev });
    tone(t, { f0: f * 0.5, f1: f * 0.42, dur: 0.035, gain: gain * 0.6, attack: 0.001 });
  }
  // 太鼓。低い胴鳴りはスマホの小さなスピーカーでは出ないので、中域の打音を重ねる
  function taiko(t, gain) {
    tone(t, { f0: 150, f1: 52, dur: 0.34, gain: gain, attack: 0.002 });
    tone(t, { type: 'triangle', f0: 340, f1: 170, dur: 0.17, gain: gain * 0.8, attack: 0.002 });
    noise(t, { type: 'bandpass', f0: 800, q: 1.2, dur: 0.07, gain: gain * 1.2 });
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
  // 爆発。腹に来る低音に、小さなスピーカーでも聞こえる中域の「バン」と高域の破裂を重ねる
  function boom(t, size, gain) {
    size = size || 1; gain = (gain || 0.6) * Math.min(1.25, 0.75 + size * 0.25);
    noise(t, { f0: 2800 * size, f1: 200, dur: 0.6 * size, gain: gain * 1.3, attack: 0.003 });
    noise(t, { type: 'bandpass', f0: 950, f1: 330, q: 0.8, dur: 0.38 * size, gain: gain * 1.2 });
    tone(t, { f0: 95, f1: 27, dur: 0.75 * size, gain: gain, attack: 0.003 });
    tone(t, { type: 'triangle', f0: 250, f1: 70, dur: 0.32 * size, gain: gain * 0.7, attack: 0.002 });
    noise(t, { type: 'highpass', f0: 2600, dur: 0.07, gain: gain * 0.4 });
  }
  function gun(t, gain) {
    noise(t, { type: 'bandpass', f0: rnd(1300, 1900), q: 1.1, dur: 0.05, gain: gain });
    noise(t, { type: 'highpass', f0: 3200, dur: 0.018, gain: gain * 0.6 });
  }

  var N = { D3: 146.83, F3: 174.61, G3: 196, A3: 220, D4: 293.66, 'F#4': 369.99, G4: 392, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, 'F#5': 739.99, G5: 783.99, A5: 880, D6: 1174.66 };

  // ── 効果音の一覧 ──
  var SOUNDS = {
    // ── 操作の音:小さく、丸く、短い余韻 ──
    click: function (t) { tick(t, 1700, 0.34); },                                                    // 木の「コッ」
    select: function (t) { koto(t, YO[0], 0.24, 0.3); },                                             // 地域を選ぶ:琴の一音
    open: function (t) { koto(t, YO[0], 0.17, 0.2); koto(t + 0.07, YO[3], 0.2, 0.3); },              // 開く:五度上へ
    close: function (t) { koto(t, YO[3], 0.15, 0.2); koto(t + 0.06, YO[0], 0.16, 0.25); },           // 閉じる:五度下へ
    tab: function (t) { noise(t, { type: 'bandpass', f0: 1300, f1: 2800, q: 0.8, dur: 0.08, gain: 0.2, attack: 0.02 }); koto(t + 0.03, YO[2], 0.16, 0.25); },  // 紙をめくって、一音
    pick: function (t, o) { // 部隊を選ぶ:選ぶたびに音階を一つ上る。外すときは低く短く
      if (o.off) { tick(t, 950, 0.3); koto(t, YO[0] / 2, 0.14, 0.15); return; }
      var i = Math.max(0, Math.min(YO.length - 1, (o.n || 1) - 1));
      tick(t, 2100, 0.2); koto(t + 0.005, YO[i], 0.22, 0.3);
    },
    deny: function (t) { tone(t, { type: 'triangle', f0: 392, f1: 294, dur: 0.11, gain: 0.22, lp: 1500 }); tone(t + 0.09, { type: 'triangle', f0: 294, f1: 220, dur: 0.15, gain: 0.22, lp: 1300 }); },  // できない:低く下がる二音
    build: function (t) { tick(t, 760, 0.6); tick(t + 0.13, 680, 0.55); tick(t + 0.26, 760, 0.5); koto(t + 0.4, YO[2], 0.2, 0.35); },      // 槌が三つ、棟上げの一音
    recruit: function (t) { taiko(t, 0.36); taiko(t + 0.15, 0.28); koto(t + 0.3, YO[0], 0.16, 0.3); },
    coin: function (t) { tone(t, { f0: 1318.5, dur: 0.12, gain: 0.2, rev: 0.3 }); tone(t + 0.06, { f0: 1760, dur: 0.24, gain: 0.2, rev: 0.35 }); },
    move: function (t) { // 移動:風を切って、着いて、二音
      noise(t, { type: 'bandpass', f0: 420, f1: 2300, q: 1, dur: 0.2, gain: 0.3, attack: 0.06 });
      taiko(t + 0.13, 0.24); koto(t + 0.2, YO[0], 0.18, 0.3); koto(t + 0.28, YO[3], 0.2, 0.4);
    },
    undo: function (t) { // 移動を戻す:同じ二音を逆に
      noise(t, { type: 'bandpass', f0: 2300, f1: 420, q: 1, dur: 0.18, gain: 0.26, attack: 0.03 });
      koto(t + 0.1, YO[3], 0.18, 0.3); koto(t + 0.18, YO[0], 0.2, 0.4);
    },
    chirp: function (t, o) { // ピヨピヨ
      var n = o.n || 2;
      for (var i = 0; i < n; i++) { var f = rnd(2500, 3300), tt = t + i * rnd(0.09, 0.13); tone(tt, { f0: f, f1: f * 1.55, dur: 0.05, gain: 0.26 }); tone(tt + 0.045, { f0: f * 1.5, f1: f * 1.05, dur: 0.05, gain: 0.19 }); }
    },
    tech: function (t) { // 研究完了:鳥たちのさえずりと上行の音
      SOUNDS.chirp(t, { n: 3 });
      [N.D5, N['F#5'], N.A5, N.D6].forEach(function (f, i) { tone(t + 0.3 + i * 0.085, { type: 'triangle', f0: f, dur: 0.3, gain: 0.28 }); });
      SOUNDS.chirp(t + 0.75, { n: 2 });
    },
    dario: function (t) { [880, 1174.66, 1567.98].forEach(function (f, i) { tone(t + i * 0.055, { f0: f, dur: 0.06, gain: 0.2 }); }); },
    turn: function (t) { // 拍子木「チョン、チョン」
      [0, 0.17].forEach(function (d) { noise(t + d, { type: 'highpass', f0: 2200, dur: 0.02, gain: 0.5 }); tone(t + d, { f0: 1500, f1: 1150, dur: 0.045, gain: 0.36 }); });
      taiko(t + 0.34, 0.28);
      tone(t + 0.34, { f0: 146.83, dur: 1.1, gain: 0.12, attack: 0.02, rev: 0.5 }); koto(t + 0.36, YO[0], 0.12, 0.45);   // 遠くで鳴る鐘のような余韻
    },
    launch: function (t) { taiko(t, 0.5); taiko(t + 0.14, 0.4); noise(t + 0.05, { type: 'bandpass', f0: 280, f1: 3200, q: 0.8, dur: 0.4, gain: 0.4, attack: 0.1 }); },
    taiko: function (t, o) { taiko(t, o.gain || 0.42); },
    horagai: function (t, o) { horagai(t, o.dur || 1.5, o.gain || 0.3); },
    roar: function (t, o) { // 鬨の声
      var d = o.dur || 1.3;
      noise(t, { type: 'bandpass', f0: 560, f1: 760, q: 1.1, dur: d, gain: 0.55, attack: 0.35 });
      noise(t + 0.05, { type: 'bandpass', f0: 1050, f1: 1250, q: 1.4, dur: d * 0.9, gain: 0.3, attack: 0.4 });
    },
    gun: function (t, o) { gun(t, o.gain || 0.3); },
    mg: function (t, o) { var n = o.n || 6; for (var i = 0; i < n; i++) gun(t + i * (o.gap || 0.065), (o.gain || 0.26) * rnd(0.8, 1.1)); },
    volley: function (t) { for (var i = 0; i < 7; i++) { var d = rnd(0, 0.16); noise(t + d, { f0: 1500, f1: 300, dur: 0.12, gain: 0.3 }); tone(t + d, { type: 'triangle', f0: 240, f1: 90, dur: 0.1, gain: 0.14 }); } }, // 火縄銃の斉射
    cannon: function (t, o) {
      var g = o.gain || 0.55;
      noise(t, { f0: 3400, f1: 220, dur: 0.3, gain: g * 1.2 }); tone(t, { f0: 115, f1: 36, dur: 0.55, gain: g });
      tone(t, { type: 'triangle', f0: 270, f1: 80, dur: 0.2, gain: g * 0.6, attack: 0.002 });
    },
    boom: function (t, o) { boom(t, o.size || 1, o.gain); },
    whistle: function (t, o) { tone(t, { f0: 2300, f1: 650, dur: o.dur || 0.45, gain: 0.11, attack: 0.03 }); },
    rocket: function (t) { noise(t, { type: 'bandpass', f0: 1400, f1: 320, q: 1.2, dur: 0.4, gain: 0.45, attack: 0.02 }); },
    jet: function (t, o) { // 頭上を通過する轟音
      var d = o.dur || 1.5, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.Q.value = 0.9;
      f.frequency.setValueAtTime(420, t); f.frequency.exponentialRampToValueAtTime(2800, t + d * 0.45); f.frequency.exponentialRampToValueAtTime(260, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + d * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + d + 0.05);
      tone(t, { f0: 70, f1: 45, dur: d, gain: 0.25, attack: d * 0.4 });
    },
    twinkle: function (t) { tone(t, { f0: 2637, dur: 0.22, gain: 0.17 }); tone(t + 0.06, { f0: 3520, dur: 0.3, gain: 0.14 }); tone(t + 0.11, { type: 'triangle', f0: 5274, dur: 0.28, gain: 0.07 }); },
    stamp: function (t) { // 「制圧」の判子:ドン、シャキーン
      taiko(t, 0.55);
      noise(t + 0.02, { type: 'highpass', f0: 5200, dur: 0.14, gain: 0.2 });
      tone(t + 0.03, { type: 'triangle', f0: 1975.5, dur: 0.5, gain: 0.2 }); tone(t + 0.03, { f0: 2960, dur: 0.7, gain: 0.1 });
    },
    victory: function (t) { // 勝利:太鼓と金管
      taiko(t, 0.45); taiko(t + 0.13, 0.35);
      [[N.D4, 0.02, 0.13], [N.G4, 0.16, 0.13], [N.A4, 0.3, 0.13], [N.D5, 0.44, 0.75]].forEach(function (n) { brass(t + n[1], n[0], n[2], 0.2); });
      brass(t + 0.44, N['F#4'], 0.75, 0.12); brass(t + 0.44, N.A4, 0.75, 0.12);
      taiko(t + 0.44, 0.5);
      SOUNDS.chirp(t + 1.05, { n: 3 });
    },
    bigwin: function (t) { // 天下統一・地球統一
      horagai(t, 1.6, 0.28);
      for (var i = 0; i < 9; i++) taiko(t + 1.2 + i * (0.2 - i * 0.012), 0.25 + i * 0.03);
      var s = t + 2.75;
      [[N.D4, 0, 0.16], [N['F#4'], 0.18, 0.16], [N.A4, 0.36, 0.16], [N.D5, 0.54, 0.3], [N.B4, 0.88, 0.16], [N.D5, 1.06, 0.16], [N['F#5'], 1.24, 1.3]].forEach(function (n) { brass(s + n[1], n[0], n[2], 0.2); });
      brass(s + 1.24, N.A4, 1.3, 0.12); brass(s + 1.24, N.D5, 1.3, 0.12); brass(s + 1.24, N.D3, 1.3, 0.14);
      taiko(s + 1.24, 0.55); boom(s + 1.3, 1.3, 0.3);
      SOUNDS.chirp(s + 2.2, { n: 4 });
    },
    defeat: function (t) { [[N.A3, 0, 0.3], [N.F3, 0.32, 0.3], [N.D3, 0.64, 0.8]].forEach(function (n) { brass(t + n[1], n[0], n[2], 0.22); }); taiko(t + 0.64, 0.35); },
    submit: function (t) { [N.D4, N.G4, N.A4, N.D5, N.G5].forEach(function (f, i) { pluck(t + i * 0.07, f, 0.26); }); SOUNDS.chirp(t + 0.5, { n: 2 }); },
    refuse: function (t) { pluck(t, N.A3 * 2, 0.26); pluck(t + 0.16, N.F3 * 2.12, 0.26); taiko(t + 0.3, 0.26); },
    warn: function (t) { taiko(t, 0.42); taiko(t + 0.22, 0.42); horagai(t + 0.1, 0.9, 0.16); },
    // ── 地下壕の場面 ──
    slam: function (t) { taiko(t, 0.5); noise(t + 0.005, { type: 'bandpass', f0: 900, q: 1.2, dur: 0.08, gain: 0.55 }); tone(t, { type: 'triangle', f0: 170, f1: 70, dur: 0.16, gain: 0.45 }); }, // 机を叩く
    rant: function (t, o) { // 怒鳴り声(言葉にはならない)。n: 音節の数 / muffled: 扉ごし
      var n = o.n || 6, lp = o.muffled ? 420 : 1500, g = o.muffled ? 0.3 : 0.34, i, f;
      for (i = 0; i < n; i++) {
        f = 170 + rnd(0, 110) + (i % 3 === 0 ? 60 : 0);
        tone(t + i * 0.13, { type: 'sawtooth', f0: f, f1: f * rnd(0.72, 0.95), dur: rnd(0.07, 0.11), gain: g, lp: lp, attack: 0.01 });
        if (!o.muffled) noise(t + i * 0.13, { type: 'bandpass', f0: rnd(1400, 2400), q: 2.5, dur: 0.05, gain: 0.22 });
      }
    },
    firework: function (t) { tone(t, { f0: 500, f1: 1500, dur: 0.3, gain: 0.08, attack: 0.05 }); boom(t + 0.32, 0.7, 0.36); for (var i = 0; i < 5; i++) noise(t + 0.4 + rnd(0, 0.35), { type: 'highpass', f0: 4000, dur: 0.03, gain: 0.16 }); },
    // ── 未来の兵装と、その先 ──
    drone: function (t, o) { // 無人機の群れ:羽音のような唸りが近づいてくる
      var d = o.dur || 1.4;
      [182, 207, 233, 261].forEach(function (f, i) { tone(t + i * 0.05, { type: 'sawtooth', f0: f, f1: f * 1.18, dur: d, gain: 0.09, attack: d * 0.35, lp: 1800 }); });
      noise(t, { type: 'bandpass', f0: 900, f1: 1500, q: 3, dur: d, gain: 0.3, attack: d * 0.4 });
    },
    laser: function (t, o) { // 光学兵器:唸りが駆け上がって、抜ける
      var d = o.dur || 0.9;
      tone(t, { type: 'sawtooth', f0: 320, f1: 2400, dur: d, gain: 0.16, attack: 0.03, lp: 5000 });
      tone(t, { f0: 640, f1: 4800, dur: d, gain: 0.12, attack: 0.03 });
      noise(t + d * 0.15, { type: 'bandpass', f0: 3000, f1: 6000, q: 2, dur: d * 0.85, gain: 0.25, attack: 0.05 });
    },
    stomp: function (t, o) { // 機動文鳥の足音
      var g = o.gain || 0.6;
      tone(t, { f0: 80, f1: 30, dur: 0.5, gain: g, attack: 0.004 });
      tone(t, { type: 'triangle', f0: 210, f1: 80, dur: 0.22, gain: g * 0.7, attack: 0.003 });
      noise(t, { f0: 900, f1: 160, dur: 0.35, gain: g * 0.9 });
      noise(t + 0.02, { type: 'bandpass', f0: 1200, q: 1, dur: 0.06, gain: g * 0.5 });
    },
    bigchirp: function (t) { // 機動文鳥の「ピッ」。機械なので少し低く、長い
      [1250, 1500].forEach(function (f, i) { var tt = t + i * 0.2; tone(tt, { type: 'square', f0: f, f1: f * 1.5, dur: 0.12, gain: 0.16, lp: 4200 }); tone(tt + 0.1, { type: 'square', f0: f * 1.45, f1: f * 1.02, dur: 0.12, gain: 0.12, lp: 4200 }); });
    },
    nuke: function (t) { // 核。音楽はない。遅れて届く、長い地鳴りだけ
      noise(t, { type: 'highpass', f0: 3000, dur: 0.12, gain: 0.5 });
      noise(t + 0.15, { f0: 2400, f1: 90, dur: 5.5, gain: 0.9, attack: 0.25 });
      noise(t + 0.3, { type: 'bandpass', f0: 520, f1: 160, q: 0.7, dur: 5.0, gain: 0.6, attack: 0.5 });
      tone(t + 0.15, { f0: 62, f1: 24, dur: 6, gain: 0.6, attack: 0.3 });
      tone(t + 0.2, { type: 'triangle', f0: 170, f1: 55, dur: 3.5, gain: 0.3, attack: 0.3 });
    },
    flock: function (t) { // B.U.N society:数えきれない鳥が、だんだん集まって鳴く。最後に一羽だけ「ぴ」
      for (var i = 0; i < 26; i++) {
        var tt = t + Math.pow(i / 26, 0.7) * 1.5 + rnd(0, 0.06), f = rnd(2100, 3900), g = 0.08 + 0.13 * (i / 26);
        tone(tt, { f0: f, f1: f * rnd(1.3, 1.6), dur: 0.05, gain: g, rev: 0.25 }); tone(tt + 0.045, { f0: f * 1.45, f1: f * 1.05, dur: 0.05, gain: g * 0.7 });
      }
      [N.D4, N.A4, N.D5, N['F#5']].forEach(function (f, i) { koto(t + 1.55 + i * 0.09, f, 0.24, 0.4); });
      tone(t + 2.05, { f0: 2900, f1: 4300, dur: 0.07, gain: 0.3 });
    },
    asi: function (t) { // 超知能:濁りのない、冷たい和音
      [293.66, 440, 587.33, 880, 1174.66].forEach(function (f, i) { tone(t + i * 0.02, { f0: f, dur: 3.2, gain: 0.1, attack: 0.9 }); });
      tone(t + 0.4, { f0: 2349.32, dur: 2.6, gain: 0.04, attack: 1.0 });
    },
    policy: function (t) { // 布告:拍子木を一つ、太鼓、琴
      noise(t, { type: 'highpass', f0: 2200, dur: 0.02, gain: 0.5 }); tone(t, { f0: 1500, f1: 1150, dur: 0.045, gain: 0.36 });
      taiko(t + 0.16, 0.4); pluck(t + 0.32, N.D4, 0.24); pluck(t + 0.42, N.A4, 0.24); pluck(t + 0.52, N.D5, 0.24);
    }
  };

  function play(name, opts) {
    if (!enabled || !SOUNDS[name]) return;
    var c = ensure(); if (!c) return;
    if (c.state === 'running') { fire(name, opts); return; }
    // まだ動き出していない:頼まれた音を少しだけ覚えておき、動き出したら鳴らす
    if (pending.length < 10) pending.push({ name: name, opts: opts, at: Date.now() });
    wake(c);
  }
  // 鳴りつづける音(ヘリのローター)。止める関数を返す
  function loop(name) {
    if (!enabled) return function () {};
    var c = ensure(); if (!c || c.state !== 'running') return function () {};
    try {
      var t = c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), out = c.createGain();
      src.buffer = noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = name === 'heli' ? 750 : 900;
      lfo.type = 'square'; lfo.frequency.value = 13; lg.gain.value = 0.5; g.gain.value = 0.5;
      lfo.connect(lg); lg.connect(g.gain);
      out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.5, t + 0.5);
      src.connect(f); f.connect(g); g.connect(out); out.connect(master); src.start(t); lfo.start(t);
      var stopped = false;
      return function () {
        if (stopped) return; stopped = true;
        var now = c.currentTime;
        try { out.gain.cancelScheduledValues(now); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now); out.gain.exponentialRampToValueAtTime(0.0001, now + 0.5); src.stop(now + 0.55); lfo.stop(now + 0.55); } catch (e) { /* すでに止まっている */ }
      };
    } catch (e) { return function () {}; }
  }

  // ───────────────────────── BGM ─────────────────────────
  // 時代ごとに一曲。音符の並びを文字で書いておき、少し先の分だけを時計に合わせて置いていく。
  // 楽器は効果音の部品をそのまま使う(出口だけ、BGM 用の音量つまみに差し替える)。
  var MVOL = 0.45, MU = { want: null, on: true, duck: 1, vol: 1, cur: null, timer: null, bus: null, busCtx: null };
  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(n) { var m = /^([A-G])([#b]?)(\d)$/.exec(n); if (!m) throw new Error('音名が読めません: ' + n); return 440 * Math.pow(2, (SEMI[m[1]] + (m[2] === '#' ? 1 : (m[2] === 'b' ? -1 : 0)) + (+m[3] + 1) * 12 - 69) / 12); }
  var INST = {
    koto: function (t, f, d, g) { pluck(t, f, g); },
    flute: function (t, f, d, g) { tone(t, { f0: f, dur: d * 1.1, gain: g, attack: 0.07 }); tone(t, { type: 'triangle', f0: f * 2, dur: d * 0.8, gain: g * 0.12, attack: 0.08 }); noise(t, { type: 'bandpass', f0: f * 2, q: 3, dur: Math.min(0.25, d), gain: g * 0.22, attack: 0.03 }); },
    reed: function (t, f, d, g) { tone(t, { type: 'square', f0: f, dur: d * 1.05, gain: g * 0.5, attack: 0.03, lp: 1900 }); tone(t, { type: 'square', f0: f * 1.007, dur: d * 1.05, gain: g * 0.4, attack: 0.03, lp: 1900 }); },
    ep: function (t, f, d, g) { tone(t, { f0: f, dur: d * 1.3 + 0.25, gain: g, attack: 0.005 }); tone(t, { f0: f * 4, dur: 0.12, gain: g * 0.16, attack: 0.003 }); tone(t, { type: 'triangle', f0: f * 2, dur: d + 0.1, gain: g * 0.2 }); },
    sq: function (t, f, d, g) { tone(t, { type: 'square', f0: f, dur: Math.max(0.08, d * 0.9), gain: g * 0.45, attack: 0.004, lp: 3400 }); },
    pad: function (t, f, d, g) { [1, 1.006, 0.994].forEach(function (k) { tone(t, { type: 'sawtooth', f0: f * k, dur: d * 1.25, gain: g * 0.3, attack: Math.min(0.6, d * 0.35), lp: 1150 }); }); },
    sine: function (t, f, d, g) { tone(t, { f0: f, dur: d * 1.3, gain: g, attack: Math.min(1.2, d * 0.4) }); },
    bass: function (t, f, d, g) { tone(t, { type: 'triangle', f0: f, dur: Math.max(0.14, d * 0.9), gain: g, attack: 0.005 }); tone(t, { type: 'triangle', f0: f * 2, dur: Math.max(0.1, d * 0.5), gain: g * 0.35, attack: 0.005 }); },
    sbass: function (t, f, d, g) { tone(t, { type: 'sawtooth', f0: f, dur: Math.max(0.1, d * 0.8), gain: g * 0.8, attack: 0.004, lp: 750 }); tone(t, { type: 'triangle', f0: f * 2, dur: Math.max(0.08, d * 0.5), gain: g * 0.25, attack: 0.004 }); },
    brass: function (t, f, d, g) { brass(t, f, Math.max(0.09, d * 0.85), g * 0.55); },
    // 鳥が、その音で鳴く(音が低ければ、鳴ける高さまで上げる)
    bird: function (t, f, d, g) { var F = f; while (F < 1500) F *= 2; tone(t, { f0: F, f1: F * 1.5, dur: 0.06, gain: g * 1.1 }); tone(t + 0.05, { f0: F * 1.45, f1: F * 1.02, dur: 0.07, gain: g * 0.8 }); },
    // 太い声のかけ声「ブン!」
    grunt: function (t, f, d, g) { tone(t, { type: 'sawtooth', f0: f * 1.5, f1: f, glide: 0.07, dur: 0.17, gain: g, attack: 0.008, lp: 1100 }); tone(t, { type: 'square', f0: f * 0.75, f1: f * 0.5, glide: 0.08, dur: 0.17, gain: g * 0.5, attack: 0.008, lp: 700 }); noise(t, { type: 'bandpass', f0: 500, q: 1.2, dur: 0.06, gain: g * 0.35 }); }
  };
  var DRUM = {
    k: function (t, g) { tone(t, { f0: 130, f1: 45, dur: 0.16, gain: g, attack: 0.002 }); tone(t, { type: 'triangle', f0: 300, f1: 120, dur: 0.05, gain: g * 0.6, attack: 0.002 }); },
    s: function (t, g) { noise(t, { type: 'bandpass', f0: 1800, q: 0.8, dur: 0.11, gain: g }); tone(t, { type: 'triangle', f0: 220, f1: 160, dur: 0.06, gain: g * 0.4 }); },
    h: function (t, g) { noise(t, { type: 'highpass', f0: 6000, dur: 0.03, gain: g * 0.7 }); },
    t: function (t, g) { taiko(t, g); },
    r: function (t, g) { noise(t, { type: 'bandpass', f0: 2600, q: 4, dur: 0.02, gain: g }); tone(t, { f0: 1500, f1: 1100, dur: 0.04, gain: g * 0.6 }); },
    w: function (t, g) { [0, 0.045, 0.09, 0.135, 0.18].forEach(function (d, i) { tone(t + d, { type: 'square', f0: i % 2 ? 2950 : 2750, dur: 0.05, gain: g, lp: 5200 }); }); },   // 審判の笛
    c: function (t, g) { noise(t, { type: 'bandpass', f0: 900, q: 0.6, dur: 1.3, gain: g, attack: 0.35 }); noise(t + 0.2, { type: 'bandpass', f0: 2200, q: 0.8, dur: 1.0, gain: g * 0.5, attack: 0.4 }); }   // 客席のどよめき
  };
  function rp(str, n) { var o = []; for (var i = 0; i < n; i++) o.push(str); return o.join(' | '); }
  function chordBar(pat, ch) { return pat.replace(/X/g, ch); } // 型の X を和音に置きかえる
  var SONGS = {
    // 戦国の世:琴と尺八、ときどき太鼓。陰旋法
    era0: { name: '霧の裾野', bpm: 66, div: 2, bar: 8, tracks: [
      { i: 'koto', g: 0.3, p: 'D4 . A4 . Bb4 A4 G4 . | A4 . . . D5 . . . | Bb4 A4 G4 . Eb4 . D4 . | G4 . A4 . . . - - | D5 . Bb4 . A4 G4 A4 . | Eb5 . D5 . Bb4 . A4 . | G4 A4 Bb4 A4 G4 Eb4 D4 . | D4 . . . - - - -' },
      { i: 'koto', g: 0.2, p: 'D3 . . . A3 . . . | D3 . . . G3 . . . | Eb3 . . . D3 . . . | G3 . . . A3 . . .' },
      { i: 'flute', g: 0.13, p: 'A4 . . . . . . . | - - - - D5 . . . | . . . . Bb4 . A4 . | . . . . - - - - | G4 . . . . . A4 . | . . . . . . - -' }],
      drums: [{ d: 't', g: 0.2, p: 'x....... ........ ....x... x.......' }] },
    // 殖産の世:陽旋法で明るく、祭囃子のように
    era1: { name: '高炉と水車', bpm: 88, div: 2, bar: 8, tracks: [
      { i: 'koto', g: 0.28, p: 'D4 E4 G4 . A4 . G4 E4 | D4 . E4 G4 A4 . . . | B4 A4 G4 . A4 B4 D5 . | B4 . A4 . G4 . . . | D5 . B4 A4 G4 . A4 B4 | A4 . G4 E4 D4 . . . | E4 G4 A4 . B4 A4 G4 E4 | D4 . . . D4 . - -' },
      { i: 'koto', g: 0.2, p: 'D3 . A3 . D3 . A3 . | D3 . A3 . D3 . A3 . | G3 . D3 . G3 . D3 . | A3 . E3 . A3 . E3 . | D3 . A3 . D3 . A3 . | G3 . D3 . G3 . D3 . | A3 . E3 . A3 . E3 . | D3 . A3 . D3 . - .' },
      { i: 'flute', g: 0.12, p: '- - - - - - - - | A5 . . . . . G5 . | - - - - - - - - | D5 . . . E5 . . . | - - - - - - - - | B5 . A5 . G5 . . . | - - - - - - - - | A5 . . . . . - -' }],
      drums: [{ d: 't', g: 0.2, p: 'x..x..x. x.x..x..' }, { d: 'r', g: 0.1, p: '..x...x. ..x...x.' }] },
    // 蒸気の世:文明開化の行進曲
    era2: { name: '汽笛一声', bpm: 108, div: 2, bar: 8, tracks: [
      { i: 'brass', g: 0.26, p: 'F4 . F4 A4 C5 . C5 . | D5 . C5 A4 F4 . . . | G4 . G4 Bb4 D5 . C5 Bb4 | A4 . G4 . C5 . . . | C5 . C5 D5 E5 . F5 . | D5 . Bb4 . G4 . . . | A4 Bb4 C5 . E4 . G4 . | F4 . . . F4 . - -' },
      { i: 'bass', g: 0.3, p: 'F2 . C3 . F2 . C3 . | F2 . C3 . F2 . C3 . | Bb2 . F3 . Bb2 . F3 . | C3 . G3 . C3 . G3 . | F2 . C3 . A2 . C3 . | Bb2 . F3 . Bb2 . F3 . | C3 . G3 . C3 . E3 . | F2 . C3 . F2 . - .' },
      { i: 'reed', g: 0.1, p: [rp(chordBar('- . X . - . X .', 'A3+C4+F4'), 2), chordBar('- . X . - . X .', 'Bb3+D4+F4'), chordBar('- . X . - . X .', 'G3+C4+E4'), chordBar('- . X . - . X .', 'A3+C4+F4'), chordBar('- . X . - . X .', 'Bb3+D4+F4'), chordBar('- . X . - . X .', 'G3+C4+E4'), chordBar('- . X . - . - .', 'A3+C4+F4')].join(' | ') }],
      drums: [{ d: 'k', g: 0.3, p: 'x...x...' }, { d: 's', g: 0.15, p: '..x...xx' }] },
    // 電気の世:街灯とワルツ
    era3: { name: '街灯のワルツ', bpm: 138, div: 2, bar: 6, tracks: [
      { i: 'reed', g: 0.24, p: 'D5 . . . Bb4 . | A4 . G4 . . . | Bb4 . . . D5 . | C5 . . . . . | Eb5 . . . D5 . | C5 . Bb4 . A4 . | G4 . A4 . F#4 . | G4 . . . . .' },
      { i: 'bass', g: 0.3, p: 'G2 . . . . . | G2 . . . . . | Bb2 . . . . . | F2 . . . . . | C3 . . . . . | D3 . . . . . | D3 . . . . . | G2 . . . . .' },
      { i: 'ep', g: 0.12, p: [rp(chordBar('- . X . X .', 'Bb3+D4'), 2), chordBar('- . X . X .', 'D4+F4'), chordBar('- . X . X .', 'A3+C4'), chordBar('- . X . X .', 'Eb4+G4'), rp(chordBar('- . X . X .', 'C4+F#4'), 2), chordBar('- . X . X .', 'Bb3+D4')].join(' | ') }],
      drums: [{ d: 'k', g: 0.22, p: 'x.....' }, { d: 'h', g: 0.1, p: '..x.x.' }] },
    // 機械の世:スウィング
    era4: { name: '銀翼スウィング', bpm: 132, div: 2, bar: 8, swing: 0.22, tracks: [
      { i: 'brass', g: 0.24, p: 'C5 . E5 . G5 . E5 . | A5 . G5 . E5 . - . | F5 . A5 . G5 . E5 . | D5 . . . - . G4 . | C5 . E5 . G5 . A5 . | G5 . E5 . C5 . - . | D5 . F5 . E5 . D5 . | C5 . . . - . - .' },
      { i: 'bass', g: 0.3, p: 'C3 . E3 . G3 . A3 . | A2 . C3 . E3 . G3 . | F2 . A2 . C3 . D3 . | G2 . B2 . D3 . F3 . | C3 . E3 . G3 . A3 . | A2 . C3 . E3 . G3 . | D3 . F3 . G2 . B2 . | C3 . G2 . C3 . - .' },
      { i: 'reed', g: 0.09, p: [chordBar('- . X . - . X .', 'E4+G4+C5'), chordBar('- . X . - . X .', 'E4+G4+A4'), chordBar('- . X . - . X .', 'F4+A4+C5'), chordBar('- . X . - . X .', 'F4+G4+B4'), chordBar('- . X . - . X .', 'E4+G4+C5'), chordBar('- . X . - . X .', 'E4+G4+A4'), '- . F4+A4+C5 . - . F4+G4+B4 .', chordBar('- . X . - . - .', 'E4+G4+C5')].join(' | ') }],
      drums: [{ d: 'k', g: 0.24, p: 'x...x...' }, { d: 's', g: 0.12, p: '..x...x.' }, { d: 'h', g: 0.09, p: 'x.xxx.xx' }] },
    // 現代:夜の高速道路
    era5: { name: '首都高、午前二時', bpm: 100, div: 4, bar: 16, tracks: [
      { i: 'ep', g: 0.17, p: '- . . . A4 . . . C5 . . . E5 . . . | D5 . . . B4 . . . G4 . . . . . . . | - . . . F4 . . . A4 . . . C5 . . . | B4 . . . G4 . . . E4 . . . . . . . | - . . . A4 . . . C5 . . . E5 . G5 . | E5 . . . D5 . . . B4 . . . . . . . | C5 . . . A4 . . . F4 . . . A4 . . . | G4 . . . . . . . - . . . . . . .' },
      { i: 'ep', g: 0.11, p: ['A3+C4+E4', 'G3+B3+D4', 'F3+A3+C4', 'E3+G3+B3'].map(function (c) { return chordBar('X . . . . . X . . . X . . . . .', c); }).join(' | ') },
      { i: 'sbass', g: 0.26, p: 'F2 . . . . . F2 . . . F3 . . . F2 . | E2 . . . . . E2 . . . E3 . . . E2 . | D2 . . . . . D2 . . . D3 . . . D2 . | C2 . . . . . C2 . . . C3 . . . G2 .' }],
      drums: [{ d: 'k', g: 0.26, p: 'x.........x.....' }, { d: 's', g: 0.14, p: '....x.......x...' }, { d: 'h', g: 0.07, p: 'x.x.x.x.x.x.x.x.' }] },
    // 情報の世:8ビットの計算機
    era6: { name: '計算機の館', bpm: 132, div: 4, bar: 16, tracks: [
      { i: 'sq', g: 0.16, p: 'E5 . . . . . D5 . C5 . . . A4 . . . | C5 . . . . . A4 . F4 . . . . . . . | E5 . . . G5 . . . E5 . . . C5 . . . | D5 . . . . . . . B4 . . . G4 . . . | A5 . . . . . G5 . E5 . . . C5 . . . | F5 . . . E5 . . . C5 . . . A4 . . . | G5 . . . E5 . . . C5 . . . E5 . . . | D5 . . . . . . . - . . . . . . .' },
      { i: 'sq', g: 0.08, p: 'A3 . C4 . E4 . A4 . E4 . C4 . A3 . C4 . | F3 . A3 . C4 . F4 . C4 . A3 . F3 . A3 . | C4 . E4 . G4 . C5 . G4 . E4 . C4 . E4 . | G3 . B3 . D4 . G4 . D4 . B3 . G3 . B3 .' },
      { i: 'bass', g: 0.26, p: 'A2 . . . A2 . . . A2 . . . A2 . E2 . | F2 . . . F2 . . . F2 . . . F2 . C3 . | C3 . . . C3 . . . C3 . . . C3 . G2 . | G2 . . . G2 . . . G2 . . . G2 . B2 .' }],
      drums: [{ d: 'k', g: 0.24, p: 'x...x...x...x...' }, { d: 's', g: 0.12, p: '....x.......x...' }, { d: 'h', g: 0.06, p: '..x...x...x...x.' }] },
    // 人工知能の世:静かな電子音
    era7: { name: '窓口の小さな端末', bpm: 84, div: 4, bar: 16, tracks: [
      { i: 'sine', g: 0.13, p: 'A4 . . . . . . . F#4 . . . . . . . | E4 . . . . . . . . . . . A4 . . . | B4 . . . . . . . F#4 . . . . . . . | G4 . . . . . . . . . . . - . . . | D5 . . . . . . . A4 . . . . . . . | C#5 . . . . . . . . . . . E4 . . . | F#4 . . . . . . . D4 . . . . . . . | D4 . . . . . . . . . . . - . . .' },
      { i: 'pad', g: 0.11, p: ['D3+A3+F#4', 'C#3+A3+E4', 'B2+F#3+D4', 'G2+D3+B3'].map(function (c) { return c + ' . . . . . . . . . . . . . . .'; }).join(' | ') },
      { i: 'ep', g: 0.08, p: 'F#5 . . A5 . . D6 . . A5 . . F#5 . E5 . | E5 . . A5 . . C#6 . . A5 . . E5 . C#5 . | D5 . . F#5 . . B5 . . F#5 . . D5 . C#5 . | B4 . . D5 . . G5 . . D5 . . B4 . A4 .' },
      { i: 'bass', g: 0.22, p: 'D3 . . . . . . . . . . . . . . . | C#3 . . . . . . . . . . . . . . . | B2 . . . . . . . . . . . . . . . | G2 . . . . . . . . . . . . . . .' }],
      drums: [{ d: 'k', g: 0.18, p: 'x.........x.....' }, { d: 'r', g: 0.05, p: '....x.......x.x.' }] },
    // 調和:何も起こらない和音
    era8: { name: '調和', bpm: 60, div: 1, bar: 8, tracks: [
      { i: 'sine', g: 0.1, p: 'D3+A3+D4+F#4+A4 . . . . . . .' },
      { i: 'sine', g: 0.05, p: 'A5 . . . A5 . . .' },
      { i: 'sine', g: 0.03, p: '- . D6 . - . D6 .' }], drums: [] },
    // B.U.N society:闘技場の応援歌。金管と太鼓に、かけ声と笛とさえずり。ゆがめて鳴らす(WARP 2)
    bun: { name: 'G.A.C.H.I Fight のテーマ', bpm: 150, div: 2, bar: 8, tracks: [
      { i: 'brass', g: 0.3, p: 'C5 . C5 G4 A4 . G4 . | C5 . C5 G4 A4 . G4 . | E5 . D5 C5 D5 . E5 . | D5 . . . G4 . . . | C5 . C5 G4 A4 . G4 . | F5 . E5 D5 E5 . C5 . | D5 . D5 E5 D5 . B4 . | C5 . . . C5 . - -' },
      { i: 'sbass', g: 0.3, p: 'C2 . G2 . C2 . G2 . | C2 . G2 . C2 . G2 . | A2 . E3 . A2 . E3 . | G2 . D3 . G2 . D3 . | C2 . G2 . C2 . G2 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . B2 . | C2 . G2 . C2 . - .' },
      { i: 'sq', g: 0.11, p: [rp(chordBar('- . X . - . X .', 'E4+G4+C5'), 2), chordBar('- . X . - . X .', 'E4+A4+C5'), chordBar('- . X . - . X .', 'D4+G4+B4'), chordBar('- . X . - . X .', 'E4+G4+C5'), chordBar('- . X . - . X .', 'F4+A4+C5'), chordBar('- . X . - . X .', 'D4+G4+B4'), chordBar('- . X . - . - .', 'E4+G4+C5')].join(' | ') },
      { i: 'grunt', g: 0.3, p: rp('- . C3 . - . C3 C3', 8) },
      { i: 'bird', g: 0.16, p: '- - - - - - C6 C6 | - - - - - - G5 G5 | - - - - - - E6 E6 | - - G5 . G5 . G5 . | - - - - - - C6 C6 | - - - - - - F6 F6 | - - - - - - D6 D6 | - - C6 C6 C6 . - -' }],
      drums: [{ d: 'k', g: 0.34, p: 'x.x.x.x.' }, { d: 's', g: 0.17, p: '..x...x.' }, { d: 'h', g: 0.07, p: 'xxxxxxxx' }, { d: 't', g: 0.26, p: '........ ......xx' },
        { d: 'w', g: 0.1, p: 'x....... ........ ........ ........' }, { d: 'c', g: 0.1, p: '........ ........ ........ ....x...' }] }
  };
  function compile(song) { // 文字の並びを、刻みごとの音にしておく
    if (song._c) return song._c;
    var cs = { sp: 60 / song.bpm / song.div, swing: song.swing || 0, bar: song.bar, tracks: [], drums: [] };
    song.tracks.forEach(function (tr) {
      var tok = tr.p.split(/\s+/).filter(function (x) { return x && x !== '|'; }), steps = [];
      if (tok.length % song.bar) throw new Error('小節の長さが合いません(' + tok.length + ' / ' + song.bar + '): ' + tr.p.slice(0, 40));
      tok.forEach(function (x, i) {
        if (x === '-' || x === '.') { steps.push(null); return; }
        var len = 1; while (i + len < tok.length && tok[i + len] === '.') len++;
        steps.push({ f: x.split('+').map(hz), len: len });
      });
      cs.tracks.push({ fn: INST[tr.i], g: tr.g, steps: steps });
    });
    (song.drums || []).forEach(function (dr) {
      var ch = dr.p.replace(/\s+/g, '').split('');
      if (ch.length % song.bar) throw new Error('太鼓の小節の長さが合いません: ' + dr.p);
      cs.drums.push({ fn: DRUM[dr.d], g: dr.g, steps: ch.map(function (c) { return c === 'x' ? 1 : 0; }) });
    });
    return (song._c = cs);
  }
  // BGM のゆがみ。0: ふつう/1: 音程がふらつき、ときどき外れ、鳥が旋律に割りこむ(鳥化手術のあと)/2: もっとひどい(ブンーチョウ手術のあと)
  var WARP = 0;
  function schedStep(cs, n, t, out) { // n 番目の刻みを、時刻 t に置く
    var saved = master, i, j, W = WARP; master = out;
    if (W) t += Math.sin(n * 1.3) * 0.011 * W;   // 拍も、少しよれる
    try {
      for (i = 0; i < cs.tracks.length; i++) {
        var tr = cs.tracks[i], st = tr.steps[n % tr.steps.length]; if (!st) continue;
        var fn = tr.fn, bend = 1;
        if (W) {
          if (i === 0 && fn !== INST.bird && (n * 7 + 3) % (W > 1 ? 3 : 5) === 0) fn = INST.bird;   // 鳥が、旋律を横取りする
          bend = Math.pow(2, (Math.sin(t * 0.83 + i * 1.7) * (W > 1 ? 0.45 : 0.3) + Math.sin(t * 6.1 + i) * 0.07 + ((n * 13 + i * 5) % 11 === 0 ? (W > 1 ? 1 : 0.5) : 0)) / 12);
        }
        for (j = 0; j < st.f.length; j++) fn(t, st.f[j] * bend, st.len * cs.sp, tr.g);
      }
      for (i = 0; i < cs.drums.length; i++) { var dr = cs.drums[i]; if (dr.steps[n % dr.steps.length]) dr.fn(t, dr.g); }
      if (W && n % cs.bar === cs.bar - 1 && Math.floor(n / cs.bar) % 2 === 0) SOUNDS.chirp(t, { n: W > 1 ? 4 : 2 });   // 小節の終わりに、さえずり
    } finally { master = saved; }
  }
  function musicBus() {
    if (!MU.bus || MU.busCtx !== ctx) { MU.bus = ctx.createGain(); MU.bus.gain.value = MU.on ? MVOL * MU.vol * MU.duck : 0; MU.bus.connect(master); MU.busCtx = ctx; }
    return MU.bus;
  }
  function musicTick() {
    var c = MU.cur; if (!c || !ctx || ctx.state !== 'running' || (root.document && document.hidden)) return;
    var now = ctx.currentTime;
    if (c.next < now - 0.2) c.next = now + 0.05; // 止まっていたあとは、たまった分をまとめて鳴らさない
    WARP = MU.warp || 0;
    while (c.next < now + 0.35) { try { schedStep(c.cs, c.n, c.next + (c.n % 2 ? c.cs.swing * c.cs.sp : 0), c.gain); } catch (e) { lastErr = 'bgm: ' + e; } c.n++; c.next += c.cs.sp; }
    WARP = 0;
  }
  function musicSync() { // 鳴らしたい曲と、いま鳴っている曲を合わせる。曲が変わるときは、前の曲を絞りながら入れ替える
    if (!ctx || ctx.state !== 'running') return;
    var want = MU.on && enabled && SONGS[MU.want] ? MU.want : null, now = ctx.currentTime;
    if ((MU.cur ? MU.cur.name : null) === want) return;
    if (MU.cur) { var old = MU.cur; MU.cur = null; try { old.gain.gain.cancelScheduledValues(now); old.gain.gain.setTargetAtTime(0, now, 0.3); } catch (e) { /* そのまま */ } setTimeout(function () { try { old.gain.disconnect(); } catch (e) { /* 済み */ } }, 2500); }
    if (want) {
      var g = ctx.createGain(), cs;
      try { cs = compile(SONGS[want]); } catch (e) { lastErr = 'bgm: ' + e; return; }
      g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(1, now + 1.0); g.connect(musicBus());
      MU.cur = { name: want, cs: cs, gain: g, n: 0, next: now + 0.15 };
    }
    if (MU.cur && !MU.timer) MU.timer = setInterval(musicTick, 90);
    if (!MU.cur && MU.timer) { clearInterval(MU.timer); MU.timer = null; }
  }
  // 検査用:曲を画面外で数秒ぶん合成して、波形の大きさを返す
  function renderSong(name, sec, hp, warp) {
    var OC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OC) return Promise.reject(new Error('OfflineAudioContext がありません'));
    var rate = 44100, oc = new OC(1, Math.ceil(rate * sec), rate), saved = [ctx, master, noiseBuf, revIn], g = build(oc), err = null, notes = 0;
    if (hp) { var f1 = oc.createBiquadFilter(), f2 = oc.createBiquadFilter(); f1.type = f2.type = 'highpass'; f1.frequency.value = f2.frequency.value = hp; g.out.disconnect(); g.out.connect(f1); f1.connect(f2); f2.connect(oc.destination); }
    ctx = oc; master = g.master; noiseBuf = g.noise; revIn = g.rev; master.gain.value = VOL;
    WARP = warp || 0;
    try { var cs = compile(SONGS[name]), bus = oc.createGain(); bus.gain.value = MVOL; bus.connect(master); for (var n = 0, t = 0.05; t < sec - 0.4; n++, t += cs.sp) { schedStep(cs, n, t + (n % 2 ? cs.swing * cs.sp : 0), bus); notes++; } } catch (e) { err = e; }
    WARP = 0;
    ctx = saved[0]; master = saved[1]; noiseBuf = saved[2]; revIn = saved[3];
    if (err) return Promise.reject(err);
    return oc.startRendering().then(function (buf) {
      var d = buf.getChannelData(0), peak = 0, sum = 0, a;
      for (var i = 0; i < d.length; i++) { a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
      return { peak: peak, rms: Math.sqrt(sum / d.length), steps: notes };
    });
  }

  // 検査用:音を画面外で合成して、ちゃんと波形が出ているかを数値で返す
  function render(name, opts, sec, hp) { // hp を指定すると、その周波数より下を切って測る(スマホのスピーカーを想定)
    var OC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OC) return Promise.reject(new Error('OfflineAudioContext がありません'));
    var rate = 44100, oc = new OC(1, Math.ceil(rate * (sec || 2)), rate), saved = [ctx, master, noiseBuf, revIn], g = build(oc), err = null;
    if (hp) { var f1 = oc.createBiquadFilter(), f2 = oc.createBiquadFilter(); f1.type = f2.type = 'highpass'; f1.frequency.value = f2.frequency.value = hp; g.out.disconnect(); g.out.connect(f1); f1.connect(f2); f2.connect(oc.destination); }
    ctx = oc; master = g.master; noiseBuf = g.noise; revIn = g.rev; master.gain.value = VOL;
    try { SOUNDS[name](0.02, opts || {}); } catch (e) { err = e; }
    ctx = saved[0]; master = saved[1]; noiseBuf = saved[2]; revIn = saved[3];
    if (err) return Promise.reject(err);
    return oc.startRendering().then(function (buf) {
      var d = buf.getChannelData(0), peak = 0, sum = 0, a;
      for (var i = 0; i < d.length; i++) { a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
      return { peak: peak, rms: Math.sqrt(sum / d.length) };
    });
  }

  TF.sfx = {
    play: play, loop: loop, unlock: unlock,
    setEnabled: function (on) {
      enabled = !!on;
      if (master && ctx) master.gain.setTargetAtTime(enabled ? VOL : 0, ctx.currentTime, 0.03);
      if (!enabled) { pending = []; mediaOff(); }
      musicSync();
    },
    // BGM。name は 'era0'〜'era8'(null で止める)。まだ音を出せない状態なら、出せるようになったときに始まる
    music: function (name) { MU.want = name || null; if (ensure()) musicSync(); },
    // BGM のゆがみ(0〜2)。曲はそのまま、次の刻みから音が外れはじめる
    warp: function (n) { MU.warp = Math.max(0, Math.min(2, n | 0)); },
    setMusic: function (on, vol) { MU.on = !!on; if (vol != null) MU.vol = vol; if (ctx) { musicBus().gain.setTargetAtTime(MU.on ? MVOL * MU.vol * MU.duck : 0, ctx.currentTime, 0.1); musicSync(); } },
    duck: function (k) { MU.duck = k; if (ctx && MU.bus) MU.bus.gain.setTargetAtTime(MU.on ? MVOL * MU.vol * k : 0, ctx.currentTime, 0.25); }, // 戦闘のあいだは小さく
    songs: function () { return Object.keys(SONGS).map(function (k) { return { id: k, name: SONGS[k].name }; }); },
    musicState: function () { return { want: MU.want, playing: MU.cur ? MU.cur.name : null, on: MU.on, duck: MU.duck, warp: MU.warp || 0 }; },
    _renderSong: renderSong,
    isEnabled: function () { return enabled; },
    setBypass: function (on) { bypass = !!on; if (!bypass) mediaOff(); },
    supported: function () { return !!AC; },
    ios: function () { return !!IOS; },
    names: function () { return Object.keys(SOUNDS); },
    // いまの状態(メニューの「音を試す」で表示する)
    status: function () { return { supported: !!AC, state: ctx ? ctx.state : 'none', rate: ctx ? ctx.sampleRate : 0, time: ctx ? ctx.currentTime : 0, media: keepState, played: played, waiting: pending.length, err: lastErr }; },
    _render: render
  };
})(typeof window !== 'undefined' ? window : globalThis);
