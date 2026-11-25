// audio.js — 音。曲は <audio>（長いので流しながら再生）、効果音と風は Web Audio。
//   すべて CC0 の素材（曲: FreePD / 効果音: SFX Kit / 風: Blanket）。最初の操作のあとで鳴りはじめる。
const b64 = (uri) => { const bin = atob(uri.slice(uri.indexOf(',') + 1)), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8.buffer; };

export class Sound {
  constructor(assets) { this.a = assets || {}; this.ctx = null; this.buf = {}; this.muted = false; this.el = null; this.windSrc = null; this.last = {}; this.musicLevel = 0.62; }
  get on() { return !!this.ctx; }
  async unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); if (this.el && this.el.paused && !this.muted) this.el.play().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 無い環境 */ }
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    this.windG = ctx.createGain(); this.windG.gain.value = 0;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'lowpass'; this.windF.frequency.value = 900; this.windG.connect(this.windF); this.windF.connect(this.master);
    if (this.a.music) {
      const el = this.el = new Audio(); el.loop = true; el.preload = 'auto'; el.src = this.a.music;
      try { ctx.createMediaElementSource(el).connect(this.music); } catch (e) { el.volume = 0.5; }
      if (!this.muted) el.play().catch(() => {});
      this.music.gain.setTargetAtTime(this.musicLevel, ctx.currentTime, 1.2);
    }
    const dec = (ab) => new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
    await Promise.all(Object.keys(this.a).filter((k) => k !== 'music').map(async (k) => { try { this.buf[k] = await dec(b64(this.a[k])); } catch (e) { /* その音だけ鳴らない */ } }));
    if (this.buf.wind) this.startWind();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) { this.ctx.suspend().catch(() => {}); if (this.el) this.el.pause(); }
      else { this.ctx.resume().catch(() => {}); if (this.el && !this.muted) this.el.play().catch(() => {}); }
    });
  }
  // 風: 終わりと始まりを重ねて、切れ目のないくり返しにする
  startWind() {
    const ctx = this.ctx, b = this.buf.wind, X = Math.floor(b.sampleRate * 1.2), n = b.length - X;
    if (n < X * 2) return;
    const out = ctx.createBuffer(b.numberOfChannels, n, b.sampleRate);
    for (let ch = 0; ch < b.numberOfChannels; ch++) {
      const s = b.getChannelData(ch), d = out.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = s[i];
      for (let i = 0; i < X; i++) { const u = i / X; d[i] = s[i] * Math.sqrt(u) + s[n + i] * Math.sqrt(1 - u); }
    }
    const src = this.windSrc = ctx.createBufferSource(); src.buffer = out; src.loop = true; src.connect(this.windG); src.start();
  }
  // 速さ 0..1（1 = 加速中）と高さで、風の強さと明るさを変える
  setWind(k, boost = 0) {
    if (!this.ctx || !this.windSrc) return;
    const t = this.ctx.currentTime;
    this.windG.gain.setTargetAtTime(0.10 + 0.34 * k + 0.30 * boost, t, 0.25);
    this.windF.frequency.setTargetAtTime(600 + 1500 * k + 2600 * boost, t, 0.3);
    this.windSrc.playbackRate.setTargetAtTime(0.85 + 0.25 * k + 0.25 * boost, t, 0.4);
  }
  setMusic(level, tau = 0.8) { this.musicLevel = level; if (this.ctx && this.music) this.music.gain.setTargetAtTime(level, this.ctx.currentTime, tau); }
  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
    if (this.el) { if (m) this.el.pause(); else this.el.play().catch(() => {}); }
  }
  // 効果音。o: { gain, rate, gap: 同じ音をこの秒数より短い間隔では鳴らさない, delay }
  play(name, o = {}) {
    const ctx = this.ctx, b = this.buf[name]; if (!ctx || !b || this.muted) return;
    const now = ctx.currentTime;
    if (o.gap && this.last[name] && now - this.last[name] < o.gap) return;
    this.last[name] = now;
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = o.gain ?? 1; src.connect(g); g.connect(this.sfx); src.start(now + (o.delay || 0));
  }
}
