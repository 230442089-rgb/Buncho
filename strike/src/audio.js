// audio.js — 音。曲は <audio>（長いので流しながら再生。道中と決戦の 2 曲を切りかえる）、効果音と風は Web Audio。
//   すべて CC0 の素材（曲: FreePD / 効果音: SFX Kit / 風: Blanket）。最初の操作のあとで鳴りはじめる。
const b64 = (uri) => { const bin = atob(uri.slice(uri.indexOf(',') + 1)), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8.buffer; };
const TRACKS = ['music', 'boss'];

export class Sound {
  constructor(assets) { this.a = assets || {}; this.ctx = null; this.buf = {}; this.muted = false; this.tr = {}; this.cur = 'music'; this.level = 0.5; this.windSrc = null; this.last = {}; }
  get on() { return !!this.ctx; }
  async unlock() {
    // 2 回目以降: 止まっていたら起こす（iOS では電話や画面の切りかえのあと 'interrupted' になる）
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); const t = this.tr[this.cur]; if (t && t.el.paused && !this.muted && !document.hidden) t.el.play().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* 無い環境 */ }
    const ctx = this.ctx = new AC();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.windG = ctx.createGain(); this.windG.gain.value = 0;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'lowpass'; this.windF.frequency.value = 1400; this.windG.connect(this.windF); this.windF.connect(this.master);
    for (const name of TRACKS) {
      if (!this.a[name]) continue;
      const el = new Audio(); el.loop = true; el.preload = 'auto'; el.src = this.a[name];
      const g = ctx.createGain(); g.gain.value = 0; g.connect(this.master);
      try { ctx.createMediaElementSource(el).connect(g); } catch (e) { el.volume = 0.5; }
      this.tr[name] = { el, g };
      // どの曲も、最初の操作のなかで一度鳴らしておく（あとから切りかえても鳴るように）。いま使わない曲はすぐ止める
      if (!this.muted) { const p = el.play(); if (name !== this.cur && p && p.then) p.then(() => { if (this.cur !== name) el.pause(); }).catch(() => {}); else if (p && p.catch) p.catch(() => {}); }
    }
    const t = this.tr[this.cur]; if (t) t.g.gain.setTargetAtTime(this.level, ctx.currentTime, 1.0);
    const dec = (ab) => new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
    await Promise.all(Object.keys(this.a).filter((k) => !TRACKS.includes(k) && this.a[k].startsWith('data:audio')).map(async (k) => { try { this.buf[k] = await dec(b64(this.a[k])); } catch (e) { /* その音だけ鳴らない */ } }));
    if (this.buf.wind) this.startWind();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      const c = this.tr[this.cur];
      if (document.hidden) { this.ctx.suspend().catch(() => {}); if (c) c.el.pause(); }
      else { this.ctx.resume().catch(() => {}); if (c && !this.muted) c.el.play().catch(() => {}); }
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
    this.windG.gain.setTargetAtTime(0.16, ctx.currentTime, 0.8);
  }
  setWind(k) { if (this.ctx && this.windSrc) this.windG.gain.setTargetAtTime(k, this.ctx.currentTime, 0.4); }
  // 曲を切りかえる（前の曲はしぼって止め、次の曲は頭から）
  setTrack(name, level = this.level, tau = 0.6) {
    this.level = level;
    if (!this.tr[name]) name = 'music';
    const prev = this.cur; this.cur = name;
    if (!this.ctx) return;
    const now = this.ctx.currentTime, t = this.tr[name];
    if (prev !== name) {
      const p = this.tr[prev];
      if (p) { p.g.gain.cancelScheduledValues(now); p.g.gain.setTargetAtTime(0, now, 0.35); setTimeout(() => { if (this.cur !== prev) p.el.pause(); }, 1600); }
      if (t) { try { t.el.currentTime = 0; } catch (e) { /* まだ読みこみ中 */ } }
    }
    if (t) { if (t.el.paused && !this.muted && !document.hidden) t.el.play().catch(() => {}); t.g.gain.cancelScheduledValues(now); t.g.gain.setTargetAtTime(level, now, tau); }
  }
  setMusic(level, tau = 0.8) { this.level = level; const t = this.tr[this.cur]; if (this.ctx && t) t.g.gain.setTargetAtTime(level, this.ctx.currentTime, tau); }
  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
    const t = this.tr[this.cur]; if (t) { if (m) t.el.pause(); else t.el.play().catch(() => {}); }
  }
  // 効果音。o: { gain, rate, gap: 同じ音をこの秒数より短い間隔では鳴らさない, delay }
  play(name, o = {}) {
    const ctx = this.ctx, b = this.buf[name]; if (!ctx || !b || this.muted || this.quiet) return;
    const now = ctx.currentTime;
    if (o.gap && this.last[name] && now - this.last[name] < o.gap) return;
    this.last[name] = now;
    const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = o.rate || 1;
    const g = ctx.createGain(); g.gain.value = o.gain ?? 1; src.connect(g); g.connect(this.sfx); src.start(now + (o.delay || 0));
  }
}
