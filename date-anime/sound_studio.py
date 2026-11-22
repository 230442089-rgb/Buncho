#!/usr/bin/env python3
"""sound_studio.py - 動画用の BGM・効果音をその場で合成し、手持ちの音源と混ぜて動画に付ける。
必要なもの: python3 + numpy + scipy + ffmpeg（音源ファイルもネット接続も不要）

  python3 sound_studio.py list                                   # プリセット一覧
  python3 sound_studio.py bgm lofi -d 30 -o bgm.wav [--seed 2 --bpm 84 --key D --prog "Am F C G"]
  python3 sound_studio.py bgm my_recipe.json -d 30 -o bgm.wav    # 自作レシピ
  python3 sound_studio.py sfx whoosh -o w.wav [--pitch -2 --length 1.2 --seed 3]
  python3 sound_studio.py mix --video in.mp4 --bgm lofi --cue whoosh@4.8 --cue pop@6.2:-4 -o out.mp4
  python3 sound_studio.py demo -o previews/                     # 全プリセットの試聴ファイル
  python3 sound_studio.py kit whoosh soft                       # フリー効果音（SFX Kit, CC0）を探す
  python3 sound_studio.py music calm                            # フリー BGM（FreePD, CC0）の一覧
  python3 sound_studio.py mix --video in.mp4 --bgm music:study-and-relax --amb amb:birds --cue kit:pop-small-in@2.4 -o out.mp4
"""
import argparse, hashlib, json, math, os, re, subprocess, sys, tempfile, zlib
from functools import lru_cache, partial
from urllib.parse import quote
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d, minimum_filter1d, uniform_filter1d

SR = 44100
TAU = 2 * np.pi

def secs(x): return max(0, int(round(x * SR)))
def tt(n): return np.arange(n) / SR
def hz(m): return 440.0 * 2.0 ** ((m - 69) / 12.0)
def dbg(d): return 10.0 ** (d / 20.0)
def seed_of(*a): return zlib.crc32(repr(a).encode())

# ------------------------------------------------------------------ DSP の部品
@lru_cache(maxsize=None)
def _sos(kind, f, order):
    ny = SR * 0.45
    if kind == 'bp':
        lo, hi = max(20.0, f[0]), min(f[1], ny)
        return signal.butter(order, [lo, max(hi, lo * 1.05)], 'band', fs=SR, output='sos')
    return signal.butter(order, min(max(f, 10.0), ny), 'low' if kind == 'lp' else 'high', fs=SR, output='sos')

def filt(x, kind, f, order=2):
    """kind: 'lp' / 'hp' / 'bp'（f は (low, high)）。モノラルでもステレオでも可"""
    f = tuple(float(v) for v in f) if isinstance(f, (tuple, list)) else float(f)
    return signal.sosfilt(_sos(kind, f, order), x, axis=0)

def sat(x, drive=1.5): return np.tanh(x * drive) / np.tanh(drive)

def ramp_in(y, sec=0.002):
    k = min(len(y), secs(sec))
    if k > 1:
        r = np.linspace(0, 1, k)
        y[:k] *= r[:, None] if y.ndim == 2 else r
    return y

def tail_fade(y, sec=0.012):
    """音の終わりを短くフェードしてプツッというノイズを防ぐ"""
    y = np.array(y, float); k = min(len(y), secs(sec))
    if k > 1:
        r = np.linspace(1, 0, k)
        y[-k:] *= r[:, None] if y.ndim == 2 else r
    return y

def env_adsr(n, gate, a=0.01, d=0.3, s=0.7, r=0.3):
    t = tt(n)
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    g = min(n, secs(gate))
    if g < n:
        lv = e[g - 1] if g > 0 else 0.0
        e[g:] = lv * np.exp(-(t[g:] - t[g]) * 4.6 / max(r, 1e-3))
    return e

def _blep(ph, dt):
    y = np.zeros_like(ph)
    m = ph < dt; x = ph[m] / dt[m]; y[m] = x + x - x * x - 1
    m = ph > 1 - dt; x = (ph[m] - 1) / dt[m]; y[m] = x * x + x + x + 1
    return y

def _phase(f, n, ph0=0.0):
    dt = np.ascontiguousarray(np.broadcast_to(np.asarray(f, float) / SR, (n,)))
    return (ph0 + np.cumsum(dt) - dt) % 1.0, dt

def saw(f, n, ph0=0.0):
    """帯域制限ノコギリ波（PolyBLEP）。f は数値でも配列でも可"""
    ph, dt = _phase(f, n, ph0)
    return 2 * ph - 1 - _blep(ph, dt)

def pulse(f, n, duty=0.5, ph0=0.0):
    ph, dt = _phase(f, n, ph0)
    y = np.where(ph < duty, 1.0, -1.0) + _blep(ph, dt) - _blep((ph + 1 - duty) % 1.0, dt)
    return y - (2 * duty - 1)

def sine(f, n, ph0=0.0):
    ph, _ = _phase(f, n, ph0)
    return np.sin(TAU * ph)

def to_st(x, pan=0.0):
    """モノラル→ステレオ（等パワーパン, pan -1..1）。ステレオならバランス調整"""
    a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    w = np.array([np.cos(a), np.sin(a)]) * np.sqrt(2)
    if x.ndim == 2:
        return x if pan == 0 else x * w
    return x[:, None] * w

def place(buf, x, t0, gain=1.0, pan=0.0):
    """buf（ステレオ）の t0 秒の位置に x を足す"""
    x = to_st(np.asarray(x, float), pan)
    i = int(round(t0 * SR))
    if i < 0:
        x, i = x[-i:], 0
    j = min(len(buf), i + len(x))
    if j > i:
        buf[i:j] += x[:j - i] * gain

_IR = {}

def reverb_ir(size=2.0, damp=0.5, seed=11):
    key = (round(size, 2), round(damp, 2), seed)
    if key not in _IR:
        rng = np.random.default_rng(seed)
        n = secs(size * 1.15); t = tt(n); ir = np.zeros((n, 2))
        for c in range(2):
            w = rng.standard_normal(n)
            ir[:, c] = (filt(w, 'lp', 800) * np.exp(-6.9 * t / size)
                        + 0.8 * filt(w, 'bp', (800, 4000)) * np.exp(-6.9 * t / (size * 0.7))
                        + 0.5 * filt(w, 'hp', 4000) * np.exp(-6.9 * t / (size * (0.55 - 0.4 * damp))))
        on = secs(0.04); ir[:on] *= (np.linspace(0, 1, on) ** 2)[:, None]
        ir = np.concatenate([np.zeros((secs(0.015), 2)), ir])
        _IR[key] = ir / np.sqrt((ir ** 2).sum() / 2)
    return _IR[key]

def reverb(x, size=2.0, damp=0.5, tail=False):
    """size = 残響時間（秒）, damp = 高域の減衰 0..1。戻り値はウェットのみ"""
    x = to_st(np.asarray(x, float)); ir = reverb_ir(size, damp)
    y = np.stack([signal.oaconvolve(x[:, c], ir[:, c]) for c in range(2)], 1)
    return y if tail else y[:len(x)]

def wet(y, size, damp, mix):
    """y の後ろに残響のしっぽを足して返す（効果音向け）"""
    y = np.concatenate([to_st(np.asarray(y, float)), np.zeros((secs(size), 2))])
    return y + reverb(y, size, damp) * mix

def _sum(*ys):
    out = np.zeros((max(len(y) for y in ys), 2))
    for y in ys:
        y = to_st(np.asarray(y, float)); out[:len(y)] += y
    return out

def _seq(items):
    """[(開始秒, 音, パン)] を、全部が収まる長さのバッファに並べる"""
    n = max(secs(t0) + len(y) for t0, y, _ in items)
    out = np.zeros((n, 2))
    for t0, y, pan in items: place(out, y, t0, 1.0, pan)
    return out

def delay(x, time, fb=0.35, taps=5, pingpong=True, lp=3500):
    x = to_st(np.asarray(x, float)); d = secs(time); out = np.zeros_like(x); src = filt(x, 'lp', lp)
    for k in range(1, taps + 1):
        s = d * k
        if s <= 0 or s >= len(x): break
        y = src[:-s] * fb ** k
        out[s:] += y[:, ::-1] if (pingpong and k % 2) else y
    return out

def chorus(x, mix=0.5, rate=0.7, depth=0.0025, base=0.012):
    x = to_st(np.asarray(x, float)); n = len(x); t = tt(n); idx = np.arange(n); out = np.empty_like(x)
    for c in range(2):
        d = (base + depth * np.sin(TAU * rate * t + c * np.pi / 2)) * SR
        out[:, c] = np.interp(idx - d, idx, x[:, c], left=0)
    return x * (1 - mix * 0.5) + out * mix * 0.5

def wobble(x, depth=0.0012, rate=0.45):
    """テープのゆらぎ（ワウ・フラッター）"""
    n = len(x); t = tt(n); idx = np.arange(n)
    d = depth * SR * (1.2 + np.sin(TAU * rate * t) + 0.3 * np.sin(TAU * rate * 2.7 * t + 1))
    return np.stack([np.interp(idx - d, idx, x[:, c], left=0) for c in range(2)], 1)

def fades(x, fin=0.02, fout=0.0):
    n = len(x)
    k = min(n, secs(fin))
    if k > 1: x[:k] *= (np.sin(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    k = min(n, secs(fout))
    if k > 1:
        u = np.linspace(0, 1, k)
        x[n - k:] *= (10 ** (-2.5 * u) * (1 - u))[:, None]
    return x

# ------------------------------------------------------------ ラウドネス・マスタリング
def _kw_sos():
    A = 10 ** (4.0 / 40); w0 = TAU * 1500.0 / SR; al = np.sin(w0) / (2 / np.sqrt(2)); c = np.cos(w0); sA = np.sqrt(A)
    b1 = [A * ((A + 1) + (A - 1) * c + 2 * sA * al), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - 2 * sA * al)]
    a1 = [(A + 1) - (A - 1) * c + 2 * sA * al, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - 2 * sA * al]
    w0 = TAU * 38.0 / SR; al = np.sin(w0) / (2 * 0.5); c = np.cos(w0)
    b2 = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; a2 = [1 + al, -2 * c, 1 - al]
    return np.array([np.r_[b1, a1] / a1[0], np.r_[b2, a2] / a2[0]])

KW = _kw_sos()

def lufs(x, momentary=False):
    """ITU-R BS.1770 の積分ラウドネス（momentary=True なら 400ms 窓の最大値）"""
    x = to_st(np.asarray(x, float))
    y = signal.sosfilt(KW, x, axis=0)
    B, H = secs(0.4), secs(0.1)
    if len(y) < B: y = np.pad(y, ((0, B - len(y)), (0, 0)))
    p = np.concatenate([np.zeros((1, 2)), np.cumsum(y ** 2, axis=0)])
    st = np.arange(0, len(y) - B + 1, H)
    z = ((p[st + B] - p[st]) / B).sum(1)
    l = -0.691 + 10 * np.log10(z + 1e-12)
    if momentary: return float(l.max())
    g = z[l > -70]
    if not len(g): return -70.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g = z[(l > -70) & (l > rel)]
    return float(-0.691 + 10 * np.log10(g.mean()))

def limit(x, ceil_db=-1.0, look=0.008):
    """先読みピークリミッター（ceil_db を超えない）"""
    a = np.abs(x).max(1) if x.ndim == 2 else np.abs(x)
    L = max(1, secs(look))
    need = np.minimum(1.0, dbg(ceil_db) / np.maximum(a, 1e-9))
    g = uniform_filter1d(minimum_filter1d(need, 2 * L + 1), 2 * L + 1)
    return x * (g[:, None] if x.ndim == 2 else g)

def master(x, target=-16.0, ceil_db=-1.0):
    x = filt(x, 'hp', 35)  # スマホのスピーカーで鳴らない超低音を整理
    l = lufs(x)
    if l > -69: x = x * dbg(target - l)
    for _ in range(2): x = limit(x, ceil_db)
    return x

# ------------------------------------------------------------------ 楽器
def gate_release(e, gate, r):
    g = secs(gate)
    if g < len(e): e[g:] *= np.exp(-np.arange(len(e) - g) / SR * 4.6 / r)
    return e

def i_epiano(f, dur, vel, rng):
    """FM エレピ（ローズ風）"""
    n = secs(dur + 0.5 + 1.2 * (220 / f) ** 0.5); t = tt(n)
    amp = gate_release(np.exp(-t / (1.5 * (220 / f) ** 0.4)), dur, 0.35)
    I1 = (0.4 + 1.8 * vel) * np.exp(-t / 0.35) + 0.35
    y = np.sin(TAU * f * t + I1 * np.sin(TAU * f * t + rng.uniform(0, TAU)))
    I2 = (0.4 + 1.0 * vel) * np.exp(-t / 0.02)
    y2 = np.sin(TAU * f * t + I2 * np.sin(TAU * 14 * f * t)) * np.exp(-t / 0.25)
    return ramp_in(amp * (0.8 * y + 0.3 * vel * y2)) * (0.35 + 0.65 * vel)

def i_marimba(f, dur, vel, rng):
    tau = 0.09 + 0.32 * (262 / f) ** 0.9
    n = secs(tau * 7 + 0.05); t = tt(n); y = np.zeros(n)
    for r, a, d in ((1.0, 1.0, 1.0), (3.93, 0.35 * vel + 0.08, 0.32), (9.2, 0.12 * vel, 0.12)):
        if f * r < SR * 0.45: y += a * np.sin(TAU * f * r * t) * np.exp(-t / (tau * d))
    k = secs(0.006)
    y[:k] += filt(rng.standard_normal(k), 'lp', 1200 + 2500 * vel) * np.linspace(1, 0, k) * 0.35 * vel
    return ramp_in(y, 0.0012) * (0.3 + 0.7 * vel)

def i_glock(f, dur, vel, rng):
    tau = 0.25 + 0.5 * (1047 / f) ** 0.7
    n = secs(tau * 6); t = tt(n); y = np.zeros(n)
    for r, a, d in ((1, 1, 1), (2.756, 0.32, 0.35), (5.404, 0.12, 0.15), (8.933, 0.05, 0.08)):
        if f * r < SR * 0.45: y += a * np.sin(TAU * f * r * t) * np.exp(-t / (tau * d))
    return ramp_in(y, 0.001) * (0.3 + 0.7 * vel)

def i_musicbox(f, dur, vel, rng):
    tau = 0.22 + 0.55 * (523 / f) ** 0.8
    n = secs(tau * 6.5); t = tt(n); y = np.zeros(n)
    for r, a, d in ((1, 1, 1), (2.0, 0.06, 0.5), (6.267, 0.28, 0.13), (17.55, 0.07, 0.04)):
        if f * r < SR * 0.45: y += a * np.sin(TAU * f * r * t + rng.uniform(0, 0.3)) * np.exp(-t / (tau * d))
    k = secs(0.002); y[:k] += filt(rng.standard_normal(k), 'hp', 3000) * 0.15
    return ramp_in(y, 0.0008) * (0.3 + 0.7 * vel)

def i_bell(f, dur, vel, rng):
    """FM ベル"""
    tau = 0.5 + 1.0 * (523 / f) ** 0.6
    n = secs(tau * 6); t = tt(n)
    I = (1.2 + 2.0 * vel) * np.exp(-t / (tau * 0.4))
    y = np.sin(TAU * f * t + I * np.sin(TAU * 3.5 * f * t)) * np.exp(-t / tau)
    return ramp_in(y, 0.001) * (0.3 + 0.7 * vel)

def ks(f, vel, rng, t60=2.0, bright=0.5, pick=0.18, maxlen=5.0):
    """Karplus-Strong の撥弦（ギター・琴など）"""
    n = secs(min(maxlen, t60 * 1.1) + 0.05)
    P = max(2, int(SR / f - 0.5)); fa = SR / (P + 0.5)
    exc = rng.uniform(-1, 1, P)
    c = float(np.clip(0.08 + 0.85 * bright * (0.5 + 0.5 * vel), 0.02, 0.98))
    exc = signal.lfilter([c], [1, c - 1], exc)
    exc = exc - np.roll(exc, max(1, int(pick * P)))
    exc = (exc - exc.mean()) / (np.abs(exc).max() + 1e-9)
    g = 10 ** (-3.0 / (t60 * fa))
    nb = n // P + 3
    out = np.empty((nb, P)); out[0] = exc; last = 0.0; sh = np.empty(P)
    for b in range(1, nb):
        prev = out[b - 1]
        sh[0] = last; sh[1:] = prev[:-1]
        out[b] = (prev + sh) * (0.5 * g)
        last = prev[-1]
    y = out.ravel(); r = f / fa
    y = np.interp(np.arange(int((len(y) - 1) / r)) * r, np.arange(len(y)), y)[:n]
    return ramp_in(y, 0.0005) * (0.3 + 0.7 * vel)

def i_guitar(f, dur, vel, rng):
    y = ks(f, vel, rng, t60=2.4 * (196 / f) ** 0.4, bright=0.3, pick=0.2)
    return filt(y, 'lp', 4200) + 0.5 * filt(y, 'bp', (90, 280))

def i_koto(f, dur, vel, rng):
    y = ks(f, vel, rng, t60=2.2 * (294 / f) ** 0.5, bright=0.75, pick=0.11)
    k = secs(0.004); y[:k] += filt(rng.standard_normal(k), 'hp', 2500) * 0.2 * vel
    return filt(y, 'lp', 6000) + 0.25 * filt(y, 'bp', (150, 500))

def i_pad(f, dur, vel, rng, voices=5, cents=14, a=0.9, r=1.6, lp=2000):
    """デチューンしたノコギリ波を重ねたシンセパッド（ステレオ）"""
    n = secs(dur + r); out = np.zeros((n, 2))
    for c in range(2):
        for d in np.linspace(-cents, cents, voices) + rng.normal(0, 2, voices):
            out[:, c] += saw(f * 2 ** (d / 1200), n, rng.uniform())
    out = filt(out / np.sqrt(voices), 'lp', lp, 2)
    return out * env_adsr(n, dur, a, 1.2, 0.8, r)[:, None] * (0.4 + 0.6 * vel)

def i_strings(f, dur, vel, rng):
    n = secs(dur + 0.8); t = tt(n); out = np.zeros((n, 2))
    vib = 1 + 0.004 * np.sin(TAU * 5.2 * t + rng.uniform(0, TAU)) * np.clip(t / 0.6, 0, 1)
    for c in range(2):
        for d in (-9, 0, 8):
            out[:, c] += saw(f * vib * 2 ** ((d + rng.normal(0, 2)) / 1200), n, rng.uniform())
    out = filt(out / 1.7, 'lp', 1600 + 1600 * vel, 2)
    return out * env_adsr(n, dur, 0.28, 0.6, 0.85, 0.7)[:, None] * (0.35 + 0.65 * vel)

def i_stacc(f, dur, vel, rng):
    """短く刻むストリングス"""
    g = min(dur, 0.3); n = secs(g + 0.25); t = tt(n); y = np.zeros(n)
    for d in (-7, 0, 6): y += saw(f * 2 ** ((d + rng.normal(0, 2)) / 1200), n, rng.uniform())
    br, dk = filt(y, 'lp', 2600), filt(y, 'lp', 700)
    y = dk + (br - dk) * np.exp(-t / 0.07)
    return y * env_adsr(n, g, 0.006, 0.12, 0.35, 0.12) * (0.35 + 0.65 * vel) / 1.7

def i_stab(f, dur, vel, rng):
    """弾むスーパーソウのプラック（ステレオ）"""
    n = secs(dur + 0.3); t = tt(n); out = np.zeros((n, 2))
    for c in range(2):
        for d in np.linspace(-18, 18, 5) + rng.normal(0, 3, 5):
            out[:, c] += saw(f * 2 ** (d / 1200), n, rng.uniform())
    out /= np.sqrt(5)
    br, dk = filt(out, 'lp', 5200), filt(out, 'lp', 650)
    y = dk + (br - dk) * np.exp(-t / 0.11)[:, None]
    return y * env_adsr(n, dur, 0.003, 0.25, 0.45, 0.15)[:, None] * (0.35 + 0.65 * vel)

def i_synthpluck(f, dur, vel, rng):
    n = secs(dur + 0.25); t = tt(n)
    y = saw(f, n, rng.uniform()) * 0.7 + pulse(f * 1.003, n, 0.5, rng.uniform()) * 0.4
    br, dk = filt(y, 'lp', 4500), filt(y, 'lp', 500)
    y = dk + (br - dk) * np.exp(-t / 0.08)
    return y * env_adsr(n, dur, 0.002, 0.18, 0.3, 0.12) * (0.35 + 0.65 * vel)

def i_square(f, dur, vel, rng, duty=0.25):
    """8ビットの矩形波（ビブラート付き）"""
    n = secs(dur + 0.04); t = tt(n)
    vib = 1 + 0.006 * np.sin(TAU * 5.5 * t) * np.clip((t - 0.15) / 0.1, 0, 1)
    return pulse(f * vib, n, duty) * env_adsr(n, dur, 0.002, 0.12, 0.75, 0.03) * (0.3 + 0.7 * vel) * 0.5

def i_tri(f, dur, vel, rng):
    """ファミコン風の段々三角波"""
    n = secs(dur + 0.02); ph, _ = _phase(f, n)
    y = np.round((2 * np.abs(2 * ph - 1)) * 7.5) / 7.5 - 1
    return y * env_adsr(n, dur, 0.002, 1, 1, 0.015) * 0.8

def i_sub(f, dur, vel, rng):
    n = secs(dur + 0.15); t = tt(n)
    y = np.sin(TAU * f * t) + 0.18 * np.sin(TAU * 2 * f * t) + 0.06 * np.sin(TAU * 3 * f * t)
    return sat(y * env_adsr(n, dur, 0.006, 0.5, 0.75, 0.08), 1.3) * (0.4 + 0.6 * vel)

def i_bass(f, dur, vel, rng):
    n = secs(dur + 0.1); t = tt(n)
    raw = saw(f, n, rng.uniform()) * 0.6 + np.sin(TAU * f * t)
    br, dk = filt(raw, 'lp', 1400), filt(raw, 'lp', 260)
    return (dk + (br - dk) * np.exp(-t / 0.06)) * env_adsr(n, dur, 0.003, 0.2, 0.7, 0.05) * (0.4 + 0.6 * vel)

def i_drone(f, dur, vel, rng):
    n = secs(dur + 2.0); t = tt(n)
    y = sum(a * np.sin(TAU * f * h * (1 + rng.normal(0, 0.0007)) * t) for h, a in ((1, 1), (2, 0.35), (3, 0.12)))
    return y * (1 + 0.15 * np.sin(TAU * 0.13 * t + rng.uniform(0, TAU))) * env_adsr(n, dur, 1.5, 1, 1, 2.0) * 0.5

INST = dict(epiano=i_epiano, marimba=i_marimba, glock=i_glock, musicbox=i_musicbox, bell=i_bell, guitar=i_guitar,
            koto=i_koto, pad=i_pad, strings=i_strings, stacc=i_stacc, stab=i_stab, synthpluck=i_synthpluck,
            square=i_square, square50=partial(i_square, duty=0.5), square12=partial(i_square, duty=0.125),
            tri=i_tri, sub=i_sub, bass=i_bass, drone=i_drone)

# ------------------------------------------------------------------ 打楽器
def dr_kick(rng, tone=52, decay=0.16, click=0.15):
    n = secs(decay * 6 + 0.05); t = tt(n)
    y = sine(tone * (1 + 2.8 * np.exp(-t / 0.028)), n) * np.exp(-t / decay)
    y += filt(rng.standard_normal(n), 'bp', (1500, 6000)) * np.exp(-t / 0.004) * click
    return sat(ramp_in(y, 0.001), 1.2)

def dr_snare(rng, tone=190, decay=0.12, snap=1.0):
    n = secs(0.6); t = tt(n)
    body = sine(tone * (1 + 0.6 * np.exp(-t / 0.02)), n) * np.exp(-t / 0.05) * 0.6
    return ramp_in(body + filt(rng.standard_normal(n), 'bp', (1200, 9000)) * np.exp(-t / decay) * snap, 0.001)

def dr_hat(rng, open_=False):
    n = secs(0.6 if open_ else 0.12); t = tt(n)
    y = sum(np.sign(np.sin(TAU * fr * t + rng.uniform(0, TAU))) for fr in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0))
    y = filt(y, 'hp', 7000) + 0.5 * filt(rng.standard_normal(n), 'hp', 8000)
    return ramp_in(y * np.exp(-t / (0.13 if open_ else 0.022)), 0.0005)

def dr_clap(rng):
    n = secs(0.4); t = tt(n); env = np.zeros(n)
    for k, d in enumerate((0, 0.011, 0.022, 0.034)):
        i = secs(d); env[i:] += np.exp(-(t[i:] - t[i]) / (0.006 if k < 3 else 0.09))
    return filt(rng.standard_normal(n), 'bp', (900, 5000)) * env

def dr_shaker(rng):
    n = secs(0.12); t = tt(n)
    return filt(rng.standard_normal(n), 'bp', (3000, 9000)) * (1 - np.exp(-t / 0.006)) * np.exp(-t / 0.035)

def dr_rim(rng):
    n = secs(0.15); t = tt(n)
    y = np.sin(TAU * 1700 * t) * np.exp(-t / 0.012) + 0.6 * np.sin(TAU * 820 * t) * np.exp(-t / 0.02)
    return ramp_in(y + filt(rng.standard_normal(n), 'hp', 3000) * np.exp(-t / 0.002) * 0.5, 0.0005)

def dr_taiko(rng, tone=78, decay=0.4):
    n = secs(2.2); t = tt(n)
    f = tone * (1 + 0.5 * np.exp(-t / 0.05))
    y = sine(f, n) * np.exp(-t / decay) + 0.45 * sine(f * 2.3, n) * np.exp(-t / (decay * 0.35))
    y += 0.25 * sine(f * 3.6, n) * np.exp(-t / (decay * 0.15))
    y += filt(rng.standard_normal(n), 'bp', (120, 1600)) * np.exp(-t / 0.035) * 0.9
    return sat(ramp_in(y, 0.001), 1.3)

def dr_pon(rng, tone=330, decay=0.16):
    """鼓（つづみ）風"""
    n = secs(0.9); t = tt(n)
    y = sine(tone * (1 - 0.3 * (1 - np.exp(-t / 0.08))), n) * np.exp(-t / decay)
    y += 0.25 * sine(tone * 1.6, n) * np.exp(-t / (decay * 0.4))
    y += filt(rng.standard_normal(n), 'bp', (800, 4000)) * np.exp(-t / 0.004) * 0.4
    return ramp_in(y, 0.0008)

def dr_wood(rng):
    """拍子木風"""
    n = secs(0.25); t = tt(n)
    y = np.sin(TAU * 1250 * t) * np.exp(-t / 0.025) + 0.5 * np.sin(TAU * 2900 * t) * np.exp(-t / 0.01)
    return ramp_in(y + filt(rng.standard_normal(n), 'hp', 2000) * np.exp(-t / 0.0015), 0.0005)

def sh_noise(rng, n, rate):
    step = max(1, int(SR / rate))
    return np.repeat(rng.uniform(-1, 1, n // step + 1), step)[:n]

def dr_ckick(rng):
    n = secs(0.12); t = tt(n); ph, _ = _phase(150 * np.exp(-t / 0.035) + 45, n)
    return (np.round((2 * np.abs(2 * ph - 1)) * 7.5) / 7.5 - 1) * np.clip(1 - t / 0.11, 0, 1)

def dr_csnare(rng):
    n = secs(0.2); t = tt(n)
    return sh_noise(rng, n, 9000) * np.exp(-t / 0.06)

def dr_chat(rng):
    n = secs(0.06); t = tt(n)
    return sh_noise(rng, n, 22000) * np.exp(-t / 0.015)

def dr_crash(rng):
    n = secs(2.5); t = tt(n)
    y = sum(np.sign(np.sin(TAU * fr * 1.7 * t + rng.uniform(0, TAU))) for fr in (205.3, 304.4, 369.6, 522.7, 540.0, 800.0))
    y = filt(y, 'hp', 4000) * 0.3 + filt(rng.standard_normal(n), 'hp', 3500)
    return ramp_in(y * np.exp(-t / 0.55), 0.001)

DRUMS = dict(kick=dr_kick, kick_soft=partial(dr_kick, tone=58, decay=0.11, click=0.05), snare=dr_snare,
             snare_lofi=partial(dr_snare, tone=180, decay=0.09, snap=0.6), hat=dr_hat, ohat=partial(dr_hat, open_=True),
             clap=dr_clap, shaker=dr_shaker, rim=dr_rim, taiko=dr_taiko, taiko_big=partial(dr_taiko, tone=60, decay=0.6),
             pon=dr_pon, pon_hi=partial(dr_pon, tone=470, decay=0.1), wood=dr_wood, ckick=dr_ckick, csnare=dr_csnare,
             chat=dr_chat, crash=dr_crash)
DRUM_TRIM = dict(kick=0, kick_soft=-3, snare=-1, snare_lofi=-2, hat=-5, ohat=-7, clap=-2, shaker=-10, rim=-4, taiko=-1,
                 taiko_big=0, pon=-2, pon_hi=-4, wood=-5, ckick=0, csnare=-2, chat=-6, crash=-8)
DRUM_PAN = dict(hat=0.25, ohat=0.25, shaker=-0.3, rim=0.1, taiko=-0.15, taiko_big=0.1, pon=-0.2, pon_hi=0.25, wood=0.35,
                chat=0.2, crash=-0.2)

def kit_pattern(kit, bar, rng, beats):
    """1小節分の打楽器パターン [(拍位置, 音名, 強さ)]"""
    P = []
    if kit == 'lofi':
        P += [(0, 'kick', 0.95), (2.5, 'kick', 0.8), (1, 'snare_lofi', 0.85), (3, 'snare_lofi', 0.9)]
        if rng.random() < 0.35: P.append((1.75, 'kick', 0.55))
        if rng.random() < 0.25: P.append((3.75, 'snare_lofi', 0.3))
        P += [(k * 0.5, 'hat', (0.6 if k % 2 == 0 else 0.4) + rng.uniform(-0.08, 0.08)) for k in range(8)]
        if bar % 4 == 3: P.append((3.5, 'ohat', 0.4))
    elif kit == 'pop4':
        P += [(b, 'kick', 1.0) for b in range(4)] + [(1, 'clap', 0.9), (3, 'clap', 0.9)]
        P += [(b + 0.5, 'ohat', 0.5) for b in range(4)]
        P += [(k * 0.25, 'hat', 0.3 + 0.12 * (k % 2 == 0)) for k in range(16) if k % 4 != 2]
    elif kit == 'soft':
        P += [(0, 'kick_soft', 0.8), (2, 'kick_soft', 0.65), (1, 'rim', 0.6), (3, 'rim', 0.65)]
        P += [(k * 0.25, 'shaker', (0.6, 0.3, 0.45, 0.3)[k % 4]) for k in range(16)]
    elif kit == 'shaker':
        P += [(k * 0.5, 'shaker', 0.65 if k % 2 else 0.45) for k in range(2 * beats)]
        if rng.random() < 0.3: P.append((beats - 0.25, 'shaker', 0.35))
    elif kit == 'chip':
        P += [(0, 'ckick', 1), (2, 'ckick', 0.9), (1, 'csnare', 0.9), (3, 'csnare', 0.9)]
        if rng.random() < 0.4: P.append((2.5, 'ckick', 0.7))
        P += [(k * 0.5, 'chat', 0.5 if k % 2 else 0.7) for k in range(8)]
    elif kit == 'taiko':
        if bar % 4 == 3:
            P += [(0, 'taiko_big', 1.0), (0.75, 'taiko', 0.45), (1.5, 'taiko', 0.6), (2, 'taiko_big', 0.8), (3, 'taiko', 0.65),
                  (3.25, 'taiko', 0.55), (3.5, 'taiko', 0.7), (3.75, 'taiko', 0.85)]
        else:
            P += [(0, 'taiko_big', 1.0), (1.5, 'taiko', 0.55), (2, 'taiko', 0.75), (3, 'taiko', 0.6), (3.5, 'taiko', 0.5)]
    elif kit == 'wa':
        P.append((0, 'pon', 0.8))
        if bar % 2: P.append((2.5, 'pon_hi', 0.6))
        if bar % 4 == 3: P += [(3, 'wood', 0.6), (3.5, 'wood', 0.75)]
    elif kit == 'waltz':
        P += [(0, 'kick_soft', 0.5), (1, 'shaker', 0.45), (2, 'shaker', 0.4)]
    return [(b, nm, v) for b, nm, v in P if b < beats]

# ------------------------------------------------------------------ 和音・旋律
SCALES = {'major': [0, 2, 4, 5, 7, 9, 11], 'minor': [0, 2, 3, 5, 7, 8, 10], 'dorian': [0, 2, 3, 5, 7, 9, 10],
          'penta': [0, 2, 4, 7, 9], 'mpenta': [0, 3, 5, 7, 10], 'in': [0, 1, 5, 7, 8], 'yo': [0, 2, 5, 7, 9]}
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
        'm9': [0, 3, 7, 10, 14], 'maj9': [0, 4, 7, 11, 14], '9': [0, 4, 7, 10, 14], 'add9': [0, 4, 7, 14],
        'madd9': [0, 3, 7, 14], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7], '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9],
        '69': [0, 4, 7, 9, 14], 'm11': [0, 3, 7, 10, 14, 17], '13': [0, 4, 7, 10, 14, 21], 'dim': [0, 3, 6],
        'm7b5': [0, 3, 6, 10], 'aug': [0, 4, 8], '5': [0, 7]}
_PC = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}

def pc(name):
    m = re.fullmatch(r'([A-Ga-g])([#b]?)', name.strip())
    if not m: raise SystemExit(f'キー名が読めません: {name}（例: C, F#, Bb）')
    return (_PC[m[1].upper()] + {'#': 1, 'b': -1, '': 0}[m[2]]) % 12

def parse_chord(tok, shift=0):
    m = re.fullmatch(r'([A-G][#b]?)([^/]*)(?:/([A-G][#b]?))?', tok)
    if not m or m[2] not in QUAL:
        raise SystemExit(f'コード名が読めません: {tok}（使える種類: {" ".join(k or "(メジャー)" for k in QUAL)}）')
    r = (pc(m[1]) + shift) % 12
    return dict(name=tok, root=r, pcs=list(dict.fromkeys((r + i) % 12 for i in QUAL[m[2]])),
                bass=(pc(m[3]) + shift) % 12 if m[3] else r)

def voicing(ch, lo, hi, center, nmax=None):
    """lo..hi に収まる密集配置。中心に近く、半音のぶつかりと低音域の濁りを避ける形を選ぶ"""
    pcs = list(ch['pcs'])
    if nmax and len(pcs) > nmax:
        for d in ((ch['root'] + 7) % 12, ch['root']):
            if len(pcs) > nmax and len(pcs) > 3 and d in pcs: pcs.remove(d)
        pcs = pcs[:nmax]
    pcs.sort(key=lambda p: (p - ch['root']) % 12)
    best, bd = None, 1e9
    for r in range(len(pcs)):
        order = pcs[r:] + pcs[:r]
        for base in range(lo, hi + 1):
            if base % 12 != order[0]: continue
            notes = [base]
            for p in order[1:]:
                m = notes[-1] + 1
                while m % 12 != p: m += 1
                notes.append(m)
            if notes[-1] > hi: break
            gaps = np.diff(notes)
            d = abs(sum(notes) / len(notes) - center) + 8 * int(np.sum(gaps == 1))
            if len(gaps) and gaps[-1] == 1: d += 4
            if len(gaps) and notes[0] < 53 and gaps[0] < 5: d += 4
            if d < bd: best, bd = notes, d
    return best or sorted(lo + (p - lo) % 12 for p in pcs)

def bass_note(ch, lo): return lo + (ch['bass'] - lo) % 12

def fifth_of(ch, r, top):
    """低音 r の少し上にあるコードの5度（分数コードでもコード音になる）"""
    p = (ch['root'] + 7) % 12
    m = next((x for x in range(r + 3, r + 10) if x % 12 == p), r + 7)
    return m - 12 if m > top else m

class Ctx:
    def __init__(s, spec, dur, seed=1, bpm=None, key=None, prog=None):
        s.spec, s.seed = spec, seed
        s.rng = np.random.default_rng(seed_of('bgm', seed))
        s.bpm = float(bpm or spec['bpm']); s.beats = int(spec.get('beats', 4))
        s.beat = 60.0 / s.bpm; s.bar = s.beat * s.beats
        s.swing = float(spec.get('swing', 0.5))
        shift = 0 if not key else ((pc(key) - pc(spec['key']) + 6) % 12) - 6
        s.key_pc = (pc(spec['key']) + shift) % 12
        s.scale = SCALES[spec.get('scale', 'major')]
        progs = [spec['prog']] + list(spec.get('alt', []))
        if prog:
            chords = [parse_chord(c) for c in prog.split()]
            minor = s.scale[2] == 3
            end = dict(name='tonic', root=s.key_pc, pcs=[s.key_pc, (s.key_pc + (3 if minor else 4)) % 12, (s.key_pc + 7) % 12], bass=s.key_pc)
        else:
            chords = [parse_chord(c, shift) for c in progs[(seed - 1) % len(progs)].split()]
            end = parse_chord(spec['end'], shift) if spec.get('end') else chords[0]
        s.n_bars = max(2, int(math.floor((dur - 1.6) / s.bar)) + 1)
        s.chords = [chords[i % len(chords)] for i in range(s.n_bars - 1)] + [end]
        s._picks = {}

    def time(s, pos):
        if s.swing > 0.5:
            f = pos % 1.0
            if abs(f - 0.5) < 1e-6: pos += s.swing - 0.5
            elif abs(f - 0.25) < 1e-6 or abs(f - 0.75) < 1e-6: pos += (s.swing - 0.5) * 0.5
        return pos * s.beat

    def pick(s, key, n):
        if key not in s._picks: s._picks[key] = int(s.rng.integers(n))
        return s._picks[key]

    def scale_notes(s, lo, hi): return [m for m in range(lo, hi + 1) if (m - s.key_pc) % 12 in s.scale]

def _near(lst, m): return min(lst, key=lambda x: abs(x - m))

def ev_chords(ctx, lay, bars):
    pat = lay.get('pat', 'pad'); lo, hi = lay.get('rng', (55, 76)); nmax = lay.get('notes'); B = ctx.beats
    center = (lo + hi) / 2; prev = center; ev = []
    i = 0
    while i < len(bars):
        b = bars[i]; ch = ctx.chords[b]
        v = voicing(ch, lo, hi, 0.5 * prev + 0.5 * center, nmax); prev = sum(v) / len(v); base = b * B
        if pat == 'pad':  # 同じコードが続く小節はつなげる
            j = i
            while j + 1 < len(bars) and bars[j + 1] == bars[j] + 1 and ctx.chords[bars[j + 1]]['name'] == ch['name']: j += 1
            ev += [(base, (j - i + 1) * B + 0.25, m, 0.6) for m in v]; i = j + 1; continue
        if pat == 'comp':
            opts = [[(0, 1.4), (1.5, 0.9), (2.75, 1.2)], [(0, 2.3), (2.5, 1.4)], [(0.5, 1.3), (2, 0.4), (2.5, 1.4)], [(0, 1.2), (1.5, 2.3)]]
            for k, (p, d) in enumerate(opts[ctx.pick(('comp', b // 2), len(opts))]):
                vel = 0.5 + 0.12 * (k == 0) + ctx.rng.uniform(-0.05, 0.05)
                ev += [(base + p, d, m, vel, j * 0.022) for j, m in enumerate(v)]
        elif pat == 'stab332':
            ev += [(base + p, 0.35, m, 0.75 if p == 0 else 0.65) for p in (0, 1.5, 3) for m in v]
        elif pat == 'strum':
            for p, down, vel in ((0, 1, 0.8), (1, 1, 0.6), (1.5, 0, 0.45), (2.5, 0, 0.5), (3, 1, 0.65), (3.5, 0, 0.45)):
                vv = v if down else v[::-1]
                ev += [(base + p, 1.0, m, vel, j * (0.012 if down else 0.008)) for j, m in enumerate(vv)]
        elif pat == 'waltz':
            ev += [(base + p, 0.8, m, 0.5) for p in range(1, B) for m in v[1:]]
        i += 1
    return ev

ARPS = {'up8': ([0, 1, 2, 3, 4, 5, 6, 7], 0.5), 'updown8': ([0, 1, 2, 3, 4, 3, 2, 1], 0.5),
        'alberti': ([0, 2, 1, 2, 0, 2, 1, 2], 0.5), 'mar': ([0, 2, 1, 3, 2, 4, 3, 1], 0.5),
        'arp16': ([0, 1, 2, 3, 4, 3, 2, 1], 0.25), 'chip': ([0, 1, 2], 0.125)}

def ev_arp(ctx, lay, bars):
    seq, step = ARPS[lay.get('pat', 'up8')]; lo, hi = lay.get('rng', (60, 79)); B = ctx.beats
    center = (lo + hi) / 2; ev = []
    for b in bars:
        v = voicing(ctx.chords[b], lo, min(hi, lo + 14), center - 4, lay.get('notes', 3))
        for k in range(int(round(B / step))):
            i = seq[k % len(seq)]; m = v[i % len(v)] + 12 * (i // len(v))
            vel = (0.72 if (k * step) % 1 == 0 else 0.55) + ctx.rng.uniform(-0.06, 0.06)
            ev.append((b * B + k * step, step * lay.get('legato', 1.6), m, vel))
    return ev

def ev_travis(ctx, lay, bars):
    """ギターのフィンガーピッキング（低音の交互弾き＋高音）"""
    lo, hi = lay.get('rng', (55, 72)); B = ctx.beats; ev = []
    for b in bars:
        ch = ctx.chords[b]; v = voicing(ch, lo, hi, (lo + hi) / 2, 3)
        r = bass_note(ch, 40); alt = fifth_of(ch, r, 55); base = b * B
        ev += [(base + p, d, m, vel) for p, m, vel, d in (
            (0, r, 0.85, 2.0), (0, v[2], 0.6, 1.5), (0.5, v[1], 0.5, 1.0), (1, alt, 0.7, 2.0), (1.5, v[2], 0.5, 1.0),
            (2, r, 0.8, 2.0), (2.5, v[0], 0.5, 1.0), (3, alt, 0.7, 2.0), (3.5, v[1], 0.55, 1.0)) if p < B]
    return ev

def ev_waltz(ctx, lay, bars):
    lo = lay.get('lo', 48); ev = ev_chords(ctx, dict(lay, pat='waltz'), bars)
    return ev + [(b * ctx.beats, 1.0, bass_note(ctx.chords[b], lo), 0.7) for b in bars]

def ev_bass(ctx, lay, bars):
    lo = lay.get('lo', 36); pat = lay.get('pat', 'whole'); B = ctx.beats; ev = []
    i = 0
    while i < len(bars):
        b = bars[i]; ch = ctx.chords[b]; r = bass_note(ch, lo); fifth = fifth_of(ch, r, lo + 14); base = b * B
        if pat == 'whole':
            j = i
            while j + 1 < len(bars) and bars[j + 1] == bars[j] + 1 and ctx.chords[bars[j + 1]]['name'] == ch['name']: j += 1
            ev.append((base, (j - i + 1) * B, r, 0.8)); i = j + 1; continue
        if pat == 'lofi': ev += [(base, 1.6, r, 0.85), (base + 2.5, 1.2, r if ctx.rng.random() < 0.6 else fifth, 0.7)]
        elif pat == 'half': ev += [(base, 1.8, r, 0.8), (base + 2, 1.8, r, 0.7)]
        elif pat == 'pop': ev += [(base, 1.4, r, 0.85), (base + 1.5, 0.45, r, 0.6), (base + 2, 1.4, r, 0.8), (base + 3.5, 0.45, fifth, 0.6)]
        elif pat == 'offbeat': ev += [(base + k + 0.5, 0.42, r, 0.8) for k in range(B)]
        elif pat == 'octave8': ev += [(base + k * 0.5, 0.42, r + 12 * (k % 2), 0.8 - 0.15 * (k % 2)) for k in range(2 * B)]
        elif pat == 'ostinato':
            for k in range(2 * B):
                vel = 0.95 if k in (0, 3, 6) else 0.6
                ev += [(base + k * 0.5, 0.45, r, vel), (base + k * 0.5, 0.45, r + 12, vel * 0.7)]
        i += 1
    return [e for e in ev if e[0] < (bars[-1] + 1) * B] if bars else ev

RHY = {4: [[(0, 1), (1, .5), (1.5, .5), (2, 1), (3, 1)], [(0, .5), (.5, .5), (1, 1), (2, 1.5), (3.5, .5)],
           [(0, 1.5), (1.5, .5), (2, 1), (3, .5), (3.5, .5)], [(0, .75), (.75, .75), (1.5, .5), (2, 2)],
           [(0, 1), (1, 1), (2, .5), (2.5, .5), (3, 1)], [(.5, .5), (1, .5), (1.5, 1), (2.5, .5), (3, 1)]],
       3: [[(0, 1), (1, 1), (2, 1)], [(0, 1.5), (1.5, .5), (2, 1)], [(0, 2), (2, 1)], [(0, .5), (.5, .5), (1, 1), (2, 1)],
           [(0, 1), (1, .5), (1.5, .5), (2, 1)]]}
CAD = {4: [(0, 1), (1, 1), (2, 2)], 3: [(0, 1), (1, 1), (2, 1)]}
CONTOURS = [[1, 1, 2, -1, -2], [2, -1, 2, -1, -1], [-1, -1, -2, 1, 2], [1, 2, 1, -2, -1], [3, -1, -1, -1, 1],
            [-2, 1, 1, 2, -1], [0, 2, -1, -1, 2]]

def ev_melody(ctx, lay, bars):
    """2小節のモチーフ（リズム＋音の動き）を繰り返し、4小節目で終止。8小節ごとに別のモチーフに"""
    lo, hi = lay.get('rng', (67, 84)); sc = ctx.scale_notes(lo, hi); B = ctx.beats
    if not sc: return []
    rng = np.random.default_rng(seed_of('mel', ctx.seed, lay.get('inst')))
    R = RHY.get(B, RHY[4]); cad_rh = CAD.get(B, CAD[4])
    mot = [(R[rng.integers(len(R))], CONTOURS[rng.integers(len(CONTOURS))]) for _ in range(4)]
    every = lay.get('every', 1); center = (lo + hi) / 2; cur = _near(sc, center); ev = []
    for b in bars:
        if (b // 2) % every: continue
        ct = [m for m in range(lo, hi + 1) if m % 12 in ctx.chords[b]['pcs']] or sc
        cad = b % 4 == 3
        rh, st = (cad_rh, [0] + [-1] * (len(cad_rh) - 1)) if cad else mot[(b % 2) + 2 * ((b // 8) % 2)]
        for k, (p, d) in enumerate(rh):
            step = st[k % len(st)]
            i = sc.index(_near(sc, cur)); i = int(np.clip(i + step, 0, len(sc) - 1))
            if sc[i] > center + 6: i, step = max(0, i - 3), -1
            if sc[i] < center - 6: i, step = min(len(sc) - 1, i + 3), 1
            cur = sc[i]
            strong = (p % 2 == 0) if B == 4 else (p == 0)
            if cad or strong or d >= 1.5: cur = _snap(ct, cur, step)  # 強拍・長い音・終止はコード音に
            ev.append((b * B + p, d * lay.get('legato', 0.9), cur, (0.75 if strong else 0.58) + ctx.rng.uniform(-0.05, 0.05)))
    return ev

def _snap(ct, m, direction):
    """動いてきた向きに沿って一番近いコード音へ"""
    if direction > 0:
        c = [x for x in ct if x >= m]; return min(c) if c else max(ct)
    if direction < 0:
        c = [x for x in ct if x <= m]; return max(c) if c else min(ct)
    return _near(ct, m)

def ev_sparkle(ctx, lay, bars):
    lo, hi = lay.get('rng', (79, 96)); sc = ctx.scale_notes(lo, hi); B = ctx.beats; ev = []
    for b in bars:
        ct = [m for m in sc if m % 12 in ctx.chords[b]['pcs']]
        for _ in range(ctx.rng.poisson(lay.get('dens', 0.6) * ctx.bar)):
            p = round((b * B + ctx.rng.uniform(0, B)) * 4) / 4
            m = ctx.rng.choice(ct if (ct and ctx.rng.random() < 0.7) else sc)
            ev.append((p, 2.0, int(m), float(ctx.rng.uniform(0.25, 0.6))))
    return ev

def ev_koto(ctx, lay, bars):
    """琴らしいフレーズ（さらりん＝グリッサンド、合わせ爪＝オクターブ、下降の走句）"""
    lo, hi = lay.get('rng', (64, 88)); sc = ctx.scale_notes(lo, hi); B = ctx.beats; rng = ctx.rng
    center = (lo + hi) / 2; ev = []; n = len(sc)
    def idx(m): return sc.index(_near(sc, m))
    for b in bars:
        base = b * B; ct = [m for m in sc if m % 12 in ctx.chords[b]['pcs']] or sc; r = rng.random()
        if b % 4 == 0 and r < 0.55:
            i0 = int(rng.integers(0, max(1, n - 9)))
            run = sc[i0:i0 + 8]
            ev += [(base, 1.2, m, 0.45 + 0.04 * j, j * 0.045) for j, m in enumerate(run)]
            land = _near(ct, run[-1] - 3)
            ev += [(base + 1, 2.0, land, 0.85), (base + 2.5, 0.5, sc[max(0, idx(land) - 1)], 0.6), (base + 3, 1.0, land, 0.7)]
        elif r < 0.4:
            top = int(rng.integers(n // 2, n))
            ev += [(base + j * 0.5, 0.6, sc[max(0, top - j)], 0.72 - 0.05 * j) for j in range(4)]
            ev.append((base + 2, 2.0, _near(ct, sc[max(0, top - 4)]), 0.8))
        elif r < 0.7:
            m = _near(ct, center); i = idx(m)
            ev += [(base, 1.5, m, 0.85), (base, 1.5, m + 12 if m + 12 <= hi + 5 else m - 12, 0.6),
                   (base + 1.5, 0.5, sc[min(n - 1, i + 1)], 0.6), (base + 2, 0.5, sc[min(n - 1, i + 2)], 0.65),
                   (base + 2.5, 1.5, sc[min(n - 1, i + 1)], 0.7)]
        else:
            m = _near(ct, center + 2); i = idx(m)
            ev += [(base, 0.5, m, 0.75), (base + 0.5, 0.5, sc[max(0, i - 1)], 0.6), (base + 1, 2.0, sc[max(0, i - 2)], 0.7)]
    return [e for e in ev if e[0] < B * ctx.n_bars]

PATTERNS = dict(chords=ev_chords, arp=ev_arp, travis=ev_travis, waltz=ev_waltz, bass=ev_bass, melody=ev_melody,
                sparkle=ev_sparkle, koto=ev_koto)

# ------------------------------------------------------------------ BGM プリセット
PRESETS = {
    'lofi': dict(ja='ローファイ・チル', desc='エレピのジャズっぽい和音＋ゆるいビート＋レコードのノイズ。解説・作業・落ち着いた紹介に',
                 bpm=78, key='C', scale='major', swing=0.6, prog='Fmaj7 Em7 Dm7 Cmaj7',
                 alt=['Dm9 G9 Cmaj9 Am9', 'Am9 Dm9 Fmaj7 E7'], end='Cmaj9',
                 layers=[dict(role='chords', inst='epiano', pat='comp', rng=(52, 74), notes=4, lv=0, rev=0.25, ch=0.35),
                         dict(role='bass', inst='sub', pat='lofi', lo=36, lv=-3),
                         dict(role='drums', kit='lofi', lv=-2, enter=1, brk=True, lp=7000, rev=0.08)],
                 fx=dict(room=(1.4, 0.7), vinyl=True, wob=0.0012, lp=9500)),
    'marimba': dict(ja='マリンバ・ポップ', desc='明るく軽快なマリンバ。サービス紹介・ハウツー・企業向けに',
                    bpm=112, key='C', scale='major', prog='C G Am F', alt=['F G Em Am', 'Am F C G'], end='C',
                    layers=[dict(role='arp', inst='marimba', pat='mar', rng=(60, 79), lv=0, rev=0.18, spread=0.25),
                            dict(role='melody', inst='marimba', rng=(72, 88), lv=-3, enter=2, rev=0.2, pan=0.15),
                            dict(role='bass', inst='marimba', pat='pop', lo=40, lv=-4),
                            dict(role='drums', kit='soft', lv=-5, enter=1, brk=True, rev=0.1)],
                    fx=dict(room=(1.2, 0.5))),
    'guitar': dict(ja='アコギ・フィンガーピッキング', desc='あたたかいアコースティックギター。日常・暮らし・ストーリーに',
                   bpm=92, key='G', scale='major', prog='G D/F# Em C', alt=['C G/B Am F', 'G Em C D'], end='G',
                   layers=[dict(role='travis', inst='guitar', rng=(55, 72), lv=0, rev=0.2, spread=0.2),
                           dict(role='drums', kit='shaker', lv=-12, enter=2, brk=True)],
                   fx=dict(room=(1.3, 0.6))),
    'ambient': dict(ja='アンビエント・パッド', desc='ふわっと広がるシンセときらめく音。テック・コンセプト・静かな場面に',
                    bpm=64, key='C', scale='major', prog='Cmaj9 Cmaj9 Am9 Am9 Fmaj9 Fmaj9 G6 G6',
                    alt=['Fmaj9 Fmaj9 G6 G6 Em7 Em7 Am9 Am9'], end='Cmaj9',
                    layers=[dict(role='chords', inst='pad', pat='pad', rng=(52, 76), lv=0, rev=0.55, ch=0.4, sweep=0.05),
                            dict(role='bass', inst='sub', pat='whole', lo=36, lv=-6, rev=0.1),
                            dict(role='sparkle', inst='glock', rng=(79, 96), lv=-7, rev=0.7, spread=0.7, dens=0.5, enter=1)],
                    fx=dict(room=(4.0, 0.4))),
    'chiptune': dict(ja='8ビット', desc='ファミコン風のピコピコ音。ゲーム・遊び心のある動画に',
                     bpm=140, key='C', scale='major', prog='C Am F G', alt=['F G C Am', 'Am F G C'], end='C',
                     layers=[dict(role='melody', inst='square', rng=(67, 86), lv=0, enter=1, legato=0.85, pan=0.2, human=0, dl=(0.75, 0.3, 0.25)),
                             dict(role='arp', inst='square50', pat='chip', rng=(60, 76), lv=-6, pan=-0.35, legato=0.9, human=0),
                             dict(role='bass', inst='tri', pat='octave8', lo=36, lv=-3, human=0),
                             dict(role='drums', kit='chip', lv=-5, enter=1, brk=True)],
                     fx=dict(room=(0.6, 0.6))),
    'musicbox': dict(ja='オルゴール（ワルツ）', desc='かわいいオルゴールの3拍子。子ども向け・思い出・やさしい場面に',
                     bpm=100, beats=3, key='F', scale='major', prog='F Dm Bb C', alt=['F Bb C F', 'Dm Bb F C'], end='F',
                     layers=[dict(role='waltz', inst='musicbox', rng=(60, 76), lo=48, lv=0, rev=0.3),
                             dict(role='melody', inst='musicbox', rng=(72, 91), lv=-1, rev=0.3, enter=1)],
                     fx=dict(room=(1.6, 0.4))),
    'wa': dict(ja='和風（琴）', desc='琴の旋律と鼓。日本の文化・旅・季節ものに',
               bpm=76, key='E', scale='in', prog='E5 A5 E5 F5', alt=['A5 E5 F5 E5'], end='E5',
               layers=[dict(role='koto', inst='koto', rng=(64, 88), lv=0, rev=0.3, spread=0.2),
                       dict(role='bass', inst='koto', pat='whole', lo=40, lv=-5, rev=0.2),
                       dict(role='chords', inst='drone', pat='pad', rng=(40, 59), notes=2, lv=-10, rev=0.3),
                       dict(role='drums', kit='wa', lv=-7, enter=1, rev=0.25)],
               fx=dict(room=(2.4, 0.5))),
    'electro': dict(ja='アップビート・エレクトロ', desc='四つ打ちのビートと弾むシンセ。新商品・告知・勢いのある場面に',
                    bpm=122, key='A', scale='minor', prog='Am F C G', alt=['F G Am Am', 'Am G F G'], end='Am',
                    layers=[dict(role='chords', inst='stab', pat='stab332', rng=(57, 76), lv=-1, rev=0.2, pump=True, ch=0.2),
                            dict(role='bass', inst='bass', pat='offbeat', lo=33, lv=-2, pump=True),
                            dict(role='melody', inst='synthpluck', rng=(69, 84), lv=-6, enter=4, every=2, dl=(0.75, 0.35, 0.3), rev=0.2),
                            dict(role='drums', kit='pop4', lv=-1, enter=2, brk=True, crash=True)],
                    fx=dict(room=(1.5, 0.5), pump=0.55)),
    'cinematic': dict(ja='シネマティック', desc='低音ストリングスの刻みと太鼓。予告・発表・ドラマチックな場面に',
                      bpm=92, key='D', scale='minor', prog='Dm Bb F C', alt=['Dm Bb Gm A', 'Dm F C Bb'], end='Dm',
                      layers=[dict(role='bass', inst='stacc', pat='ostinato', lo=38, lv=0, rev=0.2, human=0.002),
                              dict(role='chords', inst='strings', pat='pad', rng=(57, 77), lv=-3, rev=0.4, enter=1),
                              dict(role='drums', kit='taiko', lv=-1, enter=2, brk=True, rev=0.35)],
                      fx=dict(room=(2.8, 0.55), end_hit=True)),
}

def vinyl_noise(n, rng):
    y = np.zeros(n); k = rng.poisson(14 * n / SR)
    y[rng.integers(0, n, k)] = rng.uniform(0.05, 1, k) ** 3 * rng.choice([-1, 1], k)
    y = filt(y, 'bp', (900, 7000)) * 3 + filt(rng.standard_normal(n), 'bp', (2000, 9000)) * 0.02
    return np.stack([y, np.roll(y, 37)], 1)

def render_notes(ctx, ev, inst, N, lay):
    fn = INST[inst]; buf = np.zeros((N, 2)); cache = {}
    pan, spread, human = lay.get('pan', 0.0), lay.get('spread', 0.0), lay.get('human', 0.004)
    for e in ev:
        pos, d, midi, vel = e[:4]; off = e[4] if len(e) > 4 else 0.0
        dur = d * ctx.beat
        key = (inst, int(midi), round(float(vel), 1), round(dur, 2), int(ctx.rng.integers(3)))
        if key not in cache: cache[key] = tail_fade(fn(hz(midi), dur, float(vel), np.random.default_rng(seed_of(*key))))
        place(buf, cache[key], max(0.0, ctx.time(pos) + off + ctx.rng.normal(0, human)), 1.0,
              pan + spread * ctx.rng.uniform(-1, 1))
    return buf

def render_drums(ctx, lay, bars, N):
    buf = np.zeros((N, 2)); cache = {}
    for b in bars:
        for pos, nm, vel in kit_pattern(lay['kit'], b, ctx.rng, ctx.beats):
            key = (nm, int(ctx.rng.integers(4)))
            if key not in cache:
                y = tail_fade(DRUMS[nm](np.random.default_rng(seed_of(*key))))
                lm = lufs(y, True); cache[key] = y * dbg(-14 - lm) if lm > -70 else y
            g = dbg(DRUM_TRIM.get(nm, 0)) * float(np.clip(vel, 0.05, 1.2)) ** 1.6
            place(buf, cache[key], ctx.time(b * ctx.beats + pos) + ctx.rng.normal(0, 0.003), g, DRUM_PAN.get(nm, 0))
    if lay.get('crash') and bars:
        place(buf, DRUMS['crash'](np.random.default_rng(5)), bars[0] * ctx.bar, dbg(-10))
    return buf

def render_bgm(spec, dur, seed=1, bpm=None, key=None, prog=None, target=-16.0, debug=False):
    """spec（プリセット/レシピの dict）から dur 秒のステレオ BGM を作る"""
    ctx = Ctx(spec, dur, seed, bpm, key, prog)
    nb = ctx.n_bars; last = nb - 1; B = ctx.beats
    N = secs(nb * ctx.bar + 4.0)
    fx = spec.get('fx', {})
    mix = np.zeros((N, 2)); rev = np.zeros((N, 2))
    brk = set()
    if nb >= 20:
        b0 = (nb // 2) // 4 * 4; brk = {b0, b0 + 1}
    t = tt(N)
    pump = None
    if fx.get('pump'):
        ph = (t / ctx.beat) % 1.0
        pump = uniform_filter1d(1 - fx['pump'] * np.clip(1 - ph / 0.55, 0, 1) ** 2, secs(0.006))[:, None]
    for lay in spec['layers']:
        role = lay['role']
        enter = min(lay.get('enter', 0), max(0, (nb - 2) // 3))
        bars = [b for b in range(enter, last) if not (lay.get('brk') and b in brk)]
        if role == 'drums':
            buf = render_drums(ctx, lay, bars, N)
        else:
            ev = PATTERNS[role](ctx, lay, bars) if bars else []
            if lay.get('end', True):  # 最後の小節は主和音をのばして終わる
                ch = ctx.chords[last]; lo, hi = lay.get('rng', (55, 76)); end = last * B
                if role in ('chords', 'waltz'):
                    ev += [(end, B * 1.6, m, 0.55) for m in voicing(ch, lo, hi, (lo + hi) / 2, lay.get('notes'))]
                if role in ('bass', 'waltz', 'travis'):
                    ev.append((end, B * 1.6, bass_note(ch, lay.get('lo', 40)), 0.7))
                if role in ('arp', 'koto', 'travis'):
                    ev += [(end, B * 1.6, m, 0.5, j * 0.03) for j, m in enumerate(voicing(ch, lo, hi, (lo + hi) / 2, 3))]
            buf = render_notes(ctx, ev, lay['inst'], N, lay)
        if lay.get('lp'): buf = filt(buf, 'lp', lay['lp'])
        if lay.get('hp'): buf = filt(buf, 'hp', lay['hp'])
        if lay.get('sweep'):
            lfo = (0.5 - 0.5 * np.cos(TAU * lay['sweep'] * t))[:, None]
            dk = filt(buf, 'lp', 650); buf = dk + (buf - dk) * (0.35 + 0.65 * lfo)
        if lay.get('ch'): buf = chorus(buf, lay['ch'])
        if lay.get('dl'):
            tb, fb, m = lay['dl']; buf = buf + m * delay(buf, tb * ctx.beat, fb)
        if lay.get('pump') and pump is not None: buf = buf * pump
        lv = lufs(buf)
        if lv <= -69: continue
        buf *= dbg(-20 + lay.get('lv', 0) - lv)
        if debug: print(f'  {role:8s} {lay.get("inst", lay.get("kit")):10s} {lv:6.1f} LUFS -> {-20 + lay.get("lv", 0):6.1f}', file=sys.stderr)
        mix += buf; rev += buf * lay.get('rev', 0)
    size, damp = fx.get('room', (1.6, 0.5))
    mix += reverb(rev, size, damp)
    if fx.get('end_hit'):  # 最後の小節の頭に大太鼓＋シンバル
        hit = np.zeros((N, 2)); r2 = np.random.default_rng(9)
        for nm, g in (('taiko_big', 0.0), ('crash', -9.0)):
            y = DRUMS[nm](r2); place(hit, y * dbg(-14 - lufs(y, True) + g), last * ctx.bar)
        hit *= dbg(lufs(mix) + 2 + 14)
        mix += hit + reverb(hit, 2.5, 0.5) * 0.3
    if fx.get('vinyl'):
        v = vinyl_noise(N, np.random.default_rng(3)); mix += v * dbg(lufs(mix) - 24 - lufs(v))
    if fx.get('wob'): mix = wobble(mix, fx['wob'])
    if fx.get('lp'): mix = filt(mix, 'lp', fx['lp'])
    out = mix[:secs(dur)].copy()
    end_at = last * ctx.bar
    out = fades(out, 0.02, max(0.3, min(2.5, 0.15 * dur, dur - end_at)))
    return master(out, target)

def load_spec(name):
    if name in PRESETS: return PRESETS[name]
    if name.endswith('.json') and os.path.exists(name):
        with open(name, encoding='utf-8') as f: return json.load(f)
    raise SystemExit(f'BGM が見つかりません: {name}（プリセット: {", ".join(PRESETS)} / レシピ .json / 音声ファイル）')

# ------------------------------------------------------------------ 効果音
def _bank(x, fc_path, width=0.45):
    """ノイズを、時間とともに中心周波数が動くバンドパスに通す（フィルタバンクのクロスフェード）"""
    out = np.zeros_like(x)
    for c in 150 * 2 ** np.arange(0, 7.2, 0.5):
        if c > SR * 0.4: break
        w = np.exp(-0.5 * (np.log2(fc_path / c) / width) ** 2)
        if w.max() < 1e-3: continue
        out += filt(x, 'bp', (c / 2 ** 0.35, c * 2 ** 0.35)) * w
    return out

def _pan_sweep(x, a, b):
    p = np.linspace(a, b, len(x)); ang = (p + 1) * np.pi / 4
    return np.stack([x * np.cos(ang), x * np.sin(ang)], 1) * np.sqrt(2)

def sfx_whoosh(rng, length=0.9, pitch=0.0, hi=7.0):
    n = secs(length); t = tt(n); p = t / length
    shape = np.sin(np.pi * np.clip(p / 1.2, 0, 1)) ** 1.5
    x = _bank(rng.standard_normal(n), 330 * 2 ** (pitch / 12) * (1 + hi * shape))
    x *= (p ** 1.6 * (1 - p) ** 0.9); x /= np.abs(x).max() + 1e-9
    return wet(_pan_sweep(x, -0.7, 0.7), 0.7, 0.6, 0.15)

def sfx_swish(rng, length=0.35, pitch=0.0):
    return sfx_whoosh(rng, length, pitch + 7, hi=9.0)

def sfx_pop(rng, pitch=0.0, length=None):
    n = secs(0.25); t = tt(n); f0 = 420 * 2 ** (pitch / 12)
    y = sine(f0 * (1 + 1.6 * (1 - np.exp(-t / 0.018))), n) * np.exp(-t / 0.035)
    y += filt(rng.standard_normal(n), 'hp', 2000) * np.exp(-t / 0.0015) * 0.3
    return wet(ramp_in(y, 0.0015), 0.5, 0.5, 0.1)

def sfx_drop(rng, pitch=0.0, length=None):
    n = secs(0.6); t = tt(n); y = np.zeros(n)
    for t0, k, a in ((0.0, 1.0, 1.0), (0.11, 1.35, 0.35)):
        i = secs(t0); tl = t[:n - i]
        f = np.minimum(650 * k * 2 ** (pitch / 12) * np.exp(tl / 0.045), 4000)
        y[i:] += a * sine(f, n - i) * np.exp(-tl / 0.05) * (1 - np.exp(-tl / 0.002))
    return wet(y, 0.9, 0.5, 0.2)

def sfx_click(rng, pitch=0.0, length=None):
    n = secs(0.06); t = tt(n)
    y = filt(rng.standard_normal(n), 'bp', (1800, 7000)) * np.exp(-t / 0.0025)
    y += np.sin(TAU * 2600 * 2 ** (pitch / 12) * t) * np.exp(-t / 0.006) * 0.5
    return to_st(ramp_in(y, 0.0003))

def sfx_tick(rng, pitch=0.0, length=None):
    n = secs(0.12); t = tt(n); k = 2 ** (pitch / 12)
    y = np.sin(TAU * 3200 * k * t) * np.exp(-t / 0.004) + 0.5 * np.sin(TAU * 1250 * k * t) * np.exp(-t / 0.012)
    y += filt(rng.standard_normal(n), 'hp', 3000) * np.exp(-t / 0.001) * 0.4
    return to_st(ramp_in(y, 0.0003))

def sfx_typing(rng, length=1.6, pitch=0.0):
    items = []; t0 = 0.0
    while t0 < length:
        vel = rng.uniform(0.6, 1.0); space = rng.random() < 0.12
        m = secs(0.12); t = tt(m)
        y = filt(rng.standard_normal(m), 'bp', (1000, 6000)) * np.exp(-t / 0.003)
        fz = (190 if space else rng.uniform(280, 480)) * 2 ** (pitch / 12)
        y = ramp_in(y + np.sin(TAU * fz * t) * np.exp(-t / (0.03 if space else 0.015)) * 0.6, 0.0003)
        items += [(t0, y * vel, rng.uniform(-0.15, 0.15)), (t0 + rng.uniform(0.04, 0.07), tail_fade(y[:secs(0.02)]) * 0.25 * vel, 0.0)]
        t0 += max(0.05, rng.gamma(4, 0.028))
    return _seq(items)

def sfx_chime(rng, pitch=0.0, length=None):
    f = 1046.5 * 2 ** (pitch / 12)
    return wet(_sum(i_glock(f, 1, 0.9, rng) * 0.8, i_bell(f, 1, 0.6, rng) * 0.35), 1.8, 0.4, 0.3)

def sfx_success(rng, pitch=0.0, length=None):
    items = []
    for t0, m, v in ((0.0, 84, 0.75), (0.12, 88, 0.9)):
        f = hz(m) * 2 ** (pitch / 12)
        items.append((t0, _sum(i_glock(f, 1, v, rng) * 0.7, i_marimba(f, 1, v, rng) * 0.5), 0.0))
    return wet(_seq(items), 1.2, 0.5, 0.25)

def sfx_sparkle(rng, pitch=0.0, length=0.6):
    notes = [84, 86, 88, 91, 93, 96, 98, 100, 103]
    items = [(j * length / len(notes), i_glock(hz(m) * 2 ** (pitch / 12), 1, rng.uniform(0.4, 0.8), rng) * 0.5,
              -0.6 + 1.2 * j / len(notes)) for j, m in enumerate(notes)]
    return wet(_seq(items), 2.2, 0.3, 0.45)

def sfx_riser(rng, length=2.0, pitch=0.0):
    n = secs(length); t = tt(n); p = t / length
    out = np.zeros((n, 2))
    for c in range(2):
        out[:, c] = _bank(rng.standard_normal(n), 300 * (8000 / 300) ** p, 0.6)
    tone = filt(saw(220 * 2 ** (pitch / 12) * 2 ** (2 * p), n), 'lp', 3000) * 0.25
    out = (out / (np.abs(out).max() + 1e-9) + tone[:, None]) * (p ** 2)[:, None]
    k = secs(0.03); out[-k:] *= np.linspace(1, 0, k)[:, None]
    return out

def sfx_impact(rng, pitch=0.0, length=None):
    n = secs(3.0); t = tt(n)
    boom = sine(52 * 2 ** (pitch / 12) * (1 + 1.5 * np.exp(-t / 0.06)), n) * np.exp(-t / 0.45)
    crack = filt(rng.standard_normal(n), 'bp', (150, 3500)) * np.exp(-t / 0.04)
    crack += filt(rng.standard_normal(n), 'lp', 400) * np.exp(-t / 0.2) * 0.4
    y = tail_fade(sat(ramp_in(boom + crack * 1.1, 0.001), 1.6), 0.3)
    return _sum(y, wet(filt(crack, 'hp', 200), 2.2, 0.6, 0.5) * 0.6)

SFX = {  # 名前: (関数, 表示名, 使いどころ, cue の合わせ方 peak=音の山 / start=鳴り始め)
    'whoosh': (sfx_whoosh, 'シュッ（場面転換）', '画面が切り替わる時に。音の山が切り替えの瞬間に来る', 'peak'),
    'swish': (sfx_swish, 'ヒュッ（短い切り替え）', 'テキストや画像がすべり込む時に', 'peak'),
    'pop': (sfx_pop, 'ポン（出現）', 'アイコン・吹き出し・要素がポンと出る時に', 'start'),
    'drop': (sfx_drop, 'ポチャ（しずく）', 'やわらかい出現、通知、かわいい場面に', 'start'),
    'click': (sfx_click, 'カチッ（クリック）', '画面操作・ボタンを押す動きに', 'start'),
    'tick': (sfx_tick, 'チッ（秒針）', 'カウントダウンや時間の経過に（くり返して使う）', 'start'),
    'typing': (sfx_typing, 'カタカタ（タイピング）', '文字が打ち込まれていく場面に（長さを変えられる）', 'start'),
    'chime': (sfx_chime, 'チーン（ベル）', '区切り・ひらめき・お知らせに', 'start'),
    'success': (sfx_success, 'ピロン（完了）', '成功・完了・正解の瞬間に', 'start'),
    'sparkle': (sfx_sparkle, 'キラキラ', 'ロゴや商品の登場、魔法のような変化に', 'start'),
    'riser': (sfx_riser, 'ライザー（盛り上げ）', '大事な発表の直前に。盛り上がりの頂点を見せたい瞬間に合わせる', 'peak'),
    'impact': (sfx_impact, 'ドーン（インパクト）', 'タイトルや数字がドンと出る時に', 'start'),
}

def make_sfx(name, seed=1, pitch=0.0, length=None):
    fn = SFX[name][0]; kw = dict(pitch=float(pitch))
    if length is not None: kw['length'] = float(length)
    y = to_st(np.asarray(fn(np.random.default_rng(seed_of('sfx', name, seed)), **kw), float))
    a = np.abs(y).max(1); keep = np.nonzero(a > a.max() * dbg(-55))[0]  # 無音のしっぽを切る
    y = fades(y[:keep[-1] + secs(0.05)].copy(), 0.0, 0.03)
    lm = lufs(y, True); y = y * dbg(-14 - lm) if lm > -70 else y
    pk = np.abs(y).max()
    return y * min(1.0, dbg(-3) / pk) if pk > 0 else y

def hit_point(y, align='peak'):
    """cue の時刻に合わせる位置（秒）。peak=音の山, start=鳴り始め"""
    e = uniform_filter1d(np.abs(y).max(1), secs(0.01))
    if align == 'start': return float(np.argmax(e > e.max() * 0.1)) / SR
    return float(np.argmax(e)) / SR

# ------------------------------------------------------------------ フリー素材（GitHub から取得。すべて CC0 / パブリックドメイン、クレジット不要）
CACHE = os.environ.get('SOUND_CACHE', os.path.join(os.path.expanduser('~'), '.cache', 'sound_studio'))
KIT = 'https://raw.githubusercontent.com/wyzowl/sfx-kit/92780e7ab0cdfb557497a988089c47f46e8c7412/'
FREEPD = 'https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/655388f987eacf6d08d73080fcc3e727f267bfde/freepd.com/'
BLANKET = 'https://raw.githubusercontent.com/rafaelmardojai/blanket/2eaca9ba5a1b624adf90b6ccee1008efc46f0273/data/resources/sounds/'
GROUPS = {'bright': '明るい・元気', 'hope': '前向き・感動', 'calm': '落ち着き・作業', 'piano': 'ピアノ・しっとり',
          'acoustic': 'アコースティック・暮らし', 'cute': 'かわいい・コミカル', 'jazz': 'ジャズ・おしゃれ',
          'tech': 'テック・エレクトロ', 'epic': '壮大・シネマティック', 'mystery': 'ミステリー・ホラー',
          'game': 'ゲーム・レトロ', 'world': '世界・旅', 'season': '冬・クリスマス'}
MUSIC = {  # id: (グループ, FreePD の曲名, 作曲者, 長さ秒, sha256 の先頭16桁)
    'funshine': ('bright', 'Funshine', 'Kevin MacLeod', 165, 'b98b226927367a97'),
    'celebration': ('bright', 'Celebration', 'Alexander Nakarada', 143, '60947088034b356b'),
    'energizing': ('bright', 'Energizing', 'Kevin MacLeod', 133, '6b6f002c9721debb'),
    'keep-on-movin': ('bright', 'Gotta Keep On Movin', 'Bryan Teoh', 144, '0844e8cb7f10adcf'),
    'take-the-ride': ('bright', 'Take the Ride', 'Bryan Teoh', 262, 'f33874ce6030f2b9'),
    'journey-of-hope': ('hope', 'Journey of Hope', 'Alexander Nakarada', 349, '4beec7dac7b90aee'),
    'inventing-flight': ('hope', 'Inventing Flight', 'Bryan Teoh', 142, '916e736efa3caed4'),
    'hopeful': ('hope', 'Hopeful', 'Rafael Krux', 114, 'cbd585a3c26795a9'),
    'inspiration': ('hope', 'Inspiration', '', 138, 'a254227da398809c'),
    'study-and-relax': ('calm', 'Study and Relax', 'Kevin MacLeod', 223, '9cba2a3c2d1c9d36'),
    'be-chillin': ('calm', 'Be Chillin', 'Alexander Nakarada', 203, '1abaa9455ced505f'),
    'meditating-beat': ('calm', 'Meditating Beat', 'Kevin MacLeod', 157, 'e498c2015a413e6c'),
    'joeys-song': ('calm', "Joey's Song", 'Kevin MacLeod', 207, '575b5756451cbbdc'),
    'kalimba': ('calm', 'Kalimba Relaxation Music', 'Kevin MacLeod', 428, '96e24b49f4da2956'),
    'wisdom-in-the-sun': ('calm', 'Wisdom in the Sun', 'Kevin MacLeod', 155, '07ac4ab1f6d54893'),
    'lovely-piano': ('piano', 'Lovely Piano Song', '', 96, '4c8e8fbda8f2e6cb'),
    'nostalgic-piano': ('piano', 'Nostalgic Piano', '', 196, '5d932737a07dc1f0'),
    'minuet-piano': ('piano', 'The Celebrated Minuet for Piano', 'Rafael Krux', 216, '88244d4b968f5712'),
    'romantic-inspiration': ('piano', 'Romantic Inspiration', '', 150, '5d96bd468d1edde0'),
    'whistling-ukulele': ('acoustic', 'Happy Whistling Ukulele', '', 123, 'ed4059c8fba8673d'),
    'ukulele-song': ('acoustic', 'Ukulele Song', '', 139, 'ad54684b7dffd48d'),
    'slice-of-life': ('acoustic', 'Slice of Life', 'Bryan Teoh', 141, '39e0543fbeb06ced'),
    'champ-de-tournesol': ('acoustic', 'Champ de tournesol', 'Komiku', 118, '999bd6b98ffd4a74'),
    'giant-bunny': ('cute', 'My Giant Bunny Friend', 'Bryan Teoh', 165, '696d1e335debd934'),
    'hippety-hop': ('cute', 'Hippety Hop', 'Alexander Nakarada', 117, '9e7fafd519e1280f'),
    'spring-chicken': ('cute', 'Spring Chicken', 'Bryan Teoh', 167, 'cb6e536674d7cade'),
    'silly-boy': ('cute', 'Silly Boy', 'Rafael Krux', 96, 'c6b4f91b7fe6c2e6'),
    'bass-meant-jazz': ('jazz', 'Bass Meant Jazz', 'Kevin MacLeod', 280, 'c876b42602e23df4'),
    'lucky-break': ('jazz', 'Lucky Break', 'Bryan Teoh', 286, 'ff0ffc4c4c559748'),
    'flutey-jazz': ('jazz', 'Flutey Jazz', 'Kevin MacLeod', 247, '3f215025780c179b'),
    'downtown-boogie': ('jazz', 'Downtown Boogie', 'Bryan Teoh', 147, 'fac095f68050e9f9'),
    'funky-energy': ('tech', 'Funky Energy Loop', 'Kevin MacLeod', 202, 'b7990b4287cc345b'),
    'blippy-trance': ('tech', 'Blippy Trance', 'Kevin MacLeod', 120, '68ab5625f1b723d7'),
    'arpent': ('tech', 'Arpent', 'Kevin MacLeod', 162, 'ef06d8b524c196a3'),
    'screen-saver': ('tech', 'Screen Saver', 'Kevin MacLeod', 182, 'b37bded5c858af62'),
    'space-ambience': ('tech', 'Space Ambience', 'Alexander Nakarada', 276, '7b65926a73b259da'),
    'epic-blockbuster': ('epic', 'Epic Blockbuster 2', 'Rafael Krux', 160, '092be72a6750f669'),
    'emotional-blockbuster': ('epic', 'Emotional Blockbuster 2', 'Rafael Krux', 132, 'c852ba17efb6ea49'),
    'rulers-of-our-lands': ('epic', 'Rulers of Our Lands', 'Rafael Krux', 139, 'f235254a60bf99b6'),
    'honor-bound': ('epic', 'Honor Bound', 'Bryan Teoh', 171, 'd9d592d5bc2b1bb7'),
    'hidden-truth': ('mystery', 'Hidden Truth', 'Rafael Krux', 99, '39af66accc2de04c'),
    'asking-questions': ('mystery', 'Asking Questions', 'Rafael Krux', 104, '73d9a8c8342ece8e'),
    'creepy-hallow': ('mystery', 'Creepy Hallow', 'Alexander Nakarada', 120, '93235d505340e1e9'),
    'bit-bit-loop': ('game', 'Bit Bit Loop', 'Kevin MacLeod', 77, '9316e9f2a0180411'),
    'comic-game-loop': ('game', 'Comic Game Loop - Mischief', 'Kevin MacLeod', 43, 'e90b8f67d668f2e5'),
    'the-entertainer': ('game', 'The Entertainer', 'Kevin MacLeod', 193, 'a7297aacdb0702ca'),
    'bollywood-groove': ('world', 'Bollywood Groove', 'Kevin MacLeod', 150, '3b4249f3027222d4'),
    'cumbish': ('world', 'Cumbish', 'Kevin MacLeod', 192, 'd8b688a0e2f26ae6'),
    'night-in-venice': ('world', 'Night in Venice', 'Kevin MacLeod', 218, 'c61435f6f86853b5'),
    'sunny-rasta': ('world', 'Sunny Rasta', 'Alexander Nakarada', 140, '88e1a20549701be2'),
    'deck-the-halls': ('season', 'Deck the Halls', '', 107, '740ad6c54698bfe7'),
    'merry-christmas': ('season', 'We Wish You a Merry Christmas', '', 87, 'd2759dbd923086e2'),
    'icicles-melting': ('season', 'Icicles Melting', 'Kevin MacLeod', 178, '88e18af61d663b2b'),
}
AMBIENCE = {  # id: (ファイル, 内容, 長さ秒, sha256 の先頭16桁)  アプリ Blanket の CC0 / パブリックドメインの環境音
    'birds': ('birds.ogg', '鳥のさえずり', 130, 'e59b19c2a377d583'),
    'stream': ('stream.ogg', '小川のせせらぎ', 146, 'ce372c5db5611686'),
    'wind': ('wind.ogg', '風', 15, 'cfdc81be69cd5f43'),
    'boat': ('boat.ogg', '水辺のボートのきしみと水音', 42, 'e6f3565750e2d3dd'),
    'coffee-shop': ('coffee-shop.ogg', 'カフェのざわめき', 17, '397b5d95f06df69b'),
    'fireplace': ('fireplace.ogg', '暖炉の薪がはぜる音', 26, 'a6395379a32c2dc3'),
    'summer-night': ('summer-night.ogg', '夏の夜の虫の声', 49, '2eb2efb8f5c6733e'),
}

def fetch(url, sha=None):
    """GitHub から取ってキャッシュし、チェックサムを確かめてパスを返す"""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest()[:16] + os.path.splitext(url)[1])
    if not os.path.exists(path):
        r = subprocess.run(['curl', '-sSfL', '--retry', '2', '-o', path + '.part', url], capture_output=True, text=True)
        if r.returncode != 0: raise SystemExit(f'ダウンロードできません（ネット接続を確認）: {url}\n{r.stderr[-300:]}')
        os.replace(path + '.part', path)
    if sha:
        with open(path, 'rb') as f: ok = hashlib.sha256(f.read()).hexdigest().startswith(sha)
        if not ok: os.remove(path); raise SystemExit(f'チェックサムが一致しません: {url}')
    return path

_KIT = {}

def kit_index():
    """SFX Kit の全 320 音の情報（sounds.json）"""
    if not _KIT:
        with open(fetch(KIT + 'sounds.json'), encoding='utf-8') as f: _KIT.update({s['id']: s for s in json.load(f)['sounds']})
    return _KIT

def kit_sound(sid, rate=1.0):
    """SFX Kit の音（ステレオ配列）と情報と実際の速さ。rate で速さと高さを変える（範囲は adapt.rate）"""
    s = kit_index().get(sid)
    if not s: raise SystemExit(f'SFX Kit に「{sid}」はありません（python3 sound_studio.py kit 単語 で探す）')
    y = read_audio(fetch(KIT + s['file'], s['sha256'][:16]))
    lo, hi = s.get('adapt', {}).get('rate', [1, 1]); rate = float(np.clip(rate, lo, hi))
    if rate != 1.0:
        y = np.stack([np.interp(np.arange(0, len(y) - 1, rate), np.arange(len(y)), y[:, c]) for c in range(2)], 1)
    return y, s, rate

def lib_path(name):
    """music:<id> / freepd:<曲名> / amb:<id> を取ってきてパスを返す（それ以外は None）"""
    kind, _, key = name.partition(':')
    if kind == 'music':
        if key not in MUSIC: raise SystemExit(f'music:{key} はありません（python3 sound_studio.py music で一覧）')
        m = MUSIC[key]; return fetch(FREEPD + quote(m[1] + '.mp3'), m[4])
    if kind == 'freepd':
        return fetch(FREEPD + quote(key if key.endswith('.mp3') else key + '.mp3'))
    if kind == 'amb':
        if key not in AMBIENCE: raise SystemExit(f'amb:{key} はありません（python3 sound_studio.py amb で一覧）')
        a = AMBIENCE[key]; return fetch(BLANKET + a[0], a[3])
    return None

# ------------------------------------------------------------------ 入出力
def read_audio(path, start=0.0):
    """どんな音声・動画ファイルでも 44.1kHz ステレオの配列に（ffmpeg で読む）"""
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start), '-i', path, '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-']
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0: raise SystemExit(f'音声を読めません: {path}\n{r.stderr.decode(errors="ignore")[-400:]}')
    return np.frombuffer(r.stdout, np.float32).reshape(-1, 2).astype(np.float64)

def probe_duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except ValueError: raise SystemExit(f'長さが取れません: {path}')

def write_audio(path, x):
    x = np.clip(np.asarray(x, float), -1, 1)
    pcm = np.round(x * 32767).astype(np.int16)
    ext = os.path.splitext(path)[1].lower()
    if ext == '.wav': wavfile.write(path, SR, pcm); return path
    codec = {'.mp3': ['-c:a', 'libmp3lame', '-b:a', '160k'], '.m4a': ['-c:a', 'aac', '-b:a', '192k'],
             '.aac': ['-c:a', 'aac', '-b:a', '192k'], '.ogg': ['-c:a', 'libvorbis', '-q:a', '5'], '.flac': ['-c:a', 'flac']}
    if ext not in codec: raise SystemExit(f'この拡張子には書き出せません: {ext}（wav/mp3/m4a/aac/ogg/flac）')
    fd, tmp = tempfile.mkstemp(suffix='.wav'); os.close(fd)
    wavfile.write(tmp, SR, pcm)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', tmp] + codec[ext] + [path], check=True)
    os.unlink(tmp)
    return path

def fit(x, n, xf=1.5):
    """手持ちの音源を n サンプルに合わせる（短ければクロスフェードでループ、長ければ切る）"""
    if len(x) >= n: return x[:n].copy()
    k = min(secs(xf), len(x) // 3)
    if k < 2: return np.tile(x, (n // max(1, len(x)) + 1, 1))[:n]
    u = np.linspace(0, np.pi / 2, k)[:, None]; out = x.copy()
    while len(out) < n:
        out = np.concatenate([out[:-k], out[-k:] * np.cos(u) + x[:k] * np.sin(u), x[k:]])
    return out[:n]

def voice_activity(voice, thr=-42.0):
    """声が出ているところを 0..1 で（前後を少し広げてなめらかに）"""
    a = np.abs(voice).max(1)
    rms = np.sqrt(uniform_filter1d(a ** 2, secs(0.05)) + 1e-12)
    act = (20 * np.log10(rms) > thr).astype(float)
    return uniform_filter1d(maximum_filter1d(act, secs(0.3)), secs(0.2))

def duck_gain(voice, depth=9.0, thr=-42.0):
    """ナレーションが鳴っている間だけ BGM を depth dB 下げるゲイン"""
    return (1 - (1 - dbg(-depth)) * voice_activity(voice, thr))[:, None]

def parse_cue(s):
    """'名前@秒[:dB][:pitch=2][:length=1.2][:rate=1.1]'。名前は kit:<id>・効果音プリセット・音声ファイル"""
    name, _, rest = s.rpartition('@')
    if not name: raise SystemExit(f'cue の書き方: 名前@秒[:dB]（例 whoosh@3.2:-4）: {s}')
    parts = rest.split(':'); cue = dict(sfx=name, t=float(parts[0]))
    for p in parts[1:]:
        if '=' in p: k, v = p.split('=', 1); cue[k] = float(v) if k != 'align' else v
        elif p: cue['gain'] = float(p)
    return cue

def build_mix(dur, bgm=None, cues=(), voice=None, seed=1, bpm=None, key=None, prog=None, bgm_start=0.0,
              bgm_gain=0.0, duck=9.0, sfx_lufs=-15.0, target=-16.0, amb=(), amb_gain=0.0, kit_gain=0.0):
    n = secs(dur); out = np.zeros((n, 2)); has_bed = False
    if bgm and bgm != 'none':
        if bgm in PRESETS or bgm.endswith('.json'):
            b = render_bgm(load_spec(bgm), dur, seed, bpm, key, prog, target=-18.0)
        else:
            b = read_audio(lib_path(bgm) or bgm, bgm_start)
            if not len(b): raise SystemExit(f'音が入っていません: {bgm}')
            b = fades(fit(b, n), 0.05, min(2.5, 0.15 * dur))
            b = b * dbg(-18 - lufs(b))
        b = b[:n] * dbg(bgm_gain)
        out[:len(b)] += b; has_bed = True
    for a in amb or ():  # 環境音は BGM の下にうっすら敷く
        y = read_audio(lib_path(a) or a)
        if not len(y): continue
        y = fades(fit(y, n, 2.0), min(1.0, 0.1 * dur), min(2.0, 0.15 * dur))
        out[:len(y)] += y * dbg(-27 + amb_gain - lufs(y)); has_bed = True
    act = None
    if voice:
        v = read_audio(voice)[:n]; v = np.pad(v, ((0, n - len(v)), (0, 0)))
        lv = lufs(v)
        if lv > -69:
            v = v * dbg(-16 - lv); act = voice_activity(v)
            out = out * (1 - (1 - dbg(-duck)) * act)[:, None] + v
        has_bed = True
    for c in cues:
        c = dict(c); name = c['sfx']; t = float(c.get('t', 0)); gdb = float(c.get('gain', 0))
        if name.startswith('kit:'):  # SFX Kit: 音量はそろえてあるのでそのまま、同期点を時刻に合わせる
            y, s, rate = kit_sound(name[4:], float(c.get('rate', 1.0)))
            start = t - s['sync']['at'] / rate
            if act is not None:  # 声と重なるときは決められた分だけ下げる
                i0, i1 = secs(max(0.0, start + s['timing']['onset'] / rate)), secs(max(0.0, start + s['timing']['body_end'] / rate))
                if act[min(i0, n):min(max(i1, i0 + 1), n)].max(initial=0) > 0.5: gdb += s.get('under_voiceover_db', 0)
            place(out, y, start, dbg(gdb + kit_gain)); continue
        if name in SFX:
            y = make_sfx(name, int(c.get('seed', seed)), c.get('pitch', 0.0), c.get('length'))
            y = y * dbg(sfx_lufs + 14)
            start = t - hit_point(y, c.get('align', SFX[name][3]))
        else:
            y = read_audio(name)
            lm = lufs(y, True); y = y * dbg(sfx_lufs - lm) if lm > -70 else y
            start = t
        place(out, y, start, dbg(gdb))
    if has_bed:
        return master(out, target)
    return limit(out, -1.0)

def mux(video, wav, out):
    r = subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', wav, '-map', '0:v:0', '-map', '1:a:0',
                        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out],
                       capture_output=True, text=True)
    if r.returncode != 0: raise SystemExit(f'ffmpeg でエラー:\n{r.stderr[-600:]}')
    return out

# ------------------------------------------------------------------ コマンド
def cmd_list(a):
    print('■ BGM（--seed を変えるとコード進行やフレーズが変わる）')
    for k, p in PRESETS.items():
        print(f'  {k:10s} {p["ja"]} — {p["desc"]}  [{p["bpm"]}bpm, {p["key"]} {p.get("scale", "major")}]')
    print('■ 効果音（cue の時刻 = シュッ系・ライザーは音の山、ほかは鳴り始め）')
    for k, (_, ja, desc, _a) in SFX.items():
        print(f'  {k:10s} {ja} — {desc}')
    print(f'■ 楽器: {", ".join(INST)}\n■ 打楽器キット: lofi pop4 soft shaker chip taiko wa waltz\n■ 和音コードの種類: {" ".join(k or "(major)" for k in QUAL)}')
    print('■ フリー素材（CC0）: kit 単語（効果音 320 種）/ music（BGM）/ amb（環境音）')

def cmd_bgm(a):
    spec = load_spec(a.preset)
    y = render_bgm(spec, a.duration, a.seed, a.bpm, a.key, a.prog, a.lufs, a.debug)
    print(write_audio(a.output, y), f'{len(y) / SR:.2f}s  {lufs(y):.1f} LUFS')

def cmd_sfx(a):
    if a.name not in SFX: raise SystemExit(f'効果音が見つかりません: {a.name}（{", ".join(SFX)}）')
    y = make_sfx(a.name, a.seed, a.pitch, a.length)
    print(write_audio(a.output, y), f'{len(y) / SR:.2f}s  合わせ位置={hit_point(y, SFX[a.name][3]):.2f}s')

def cmd_mix(a):
    if a.video: dur = probe_duration(a.video)
    elif a.duration: dur = a.duration
    else: raise SystemExit('--video か --duration が必要です')
    cues = [parse_cue(c) for c in (a.cue or [])]
    if a.cues:
        with open(a.cues, encoding='utf-8') as f: cues += json.load(f)
    if a.cuts:
        cues += [dict(sfx=a.cut_sfx, t=float(x), gain=a.cut_gain) for x in a.cuts.split(',') if x.strip()]
    y = build_mix(dur, a.bgm, cues, a.voice, a.seed, a.bpm, a.key, a.prog, a.bgm_start, a.bgm_gain, a.duck,
                  a.sfx_lufs, a.lufs, a.amb or (), a.amb_gain, a.kit_gain)
    if a.output.lower().endswith(('.mp4', '.mov', '.m4v')):
        if not a.video: raise SystemExit('動画に付けるには --video が必要です')
        fd, tmp = tempfile.mkstemp(suffix='.wav'); os.close(fd)
        write_audio(tmp, y); mux(a.video, tmp, a.output); os.unlink(tmp)
        print(a.output, f'{dur:.2f}s  {lufs(y):.1f} LUFS')
    else:
        print(write_audio(a.output, y), f'{dur:.2f}s  {lufs(y):.1f} LUFS')

def cmd_demo(a):
    os.makedirs(a.output, exist_ok=True); cat = []
    for k, p in PRESETS.items():
        f = os.path.join(a.output, f'bgm_{k}.mp3')
        write_audio(f, render_bgm(p, a.duration, a.seed)); cat.append(dict(id=k, kind='bgm', ja=p['ja'], desc=p['desc'], file=os.path.basename(f)))
        print(f, file=sys.stderr)
    for k, (_, ja, desc, _a) in SFX.items():
        f = os.path.join(a.output, f'sfx_{k}.mp3')
        y = make_sfx(k, a.seed)
        y = np.concatenate([np.zeros((secs(0.15), 2)), y, np.zeros((secs(0.3), 2))])
        write_audio(f, y); cat.append(dict(id=k, kind='sfx', ja=ja, desc=desc, file=os.path.basename(f)))
    with open(os.path.join(a.output, 'catalog.json'), 'w', encoding='utf-8') as fp:
        json.dump(cat, fp, ensure_ascii=False, indent=1)
    print(os.path.join(a.output, 'catalog.json'))

def cmd_kit(a):
    idx = kit_index()
    if len(a.words) == 1 and a.words[0] in idx:
        s = idx[a.words[0]]
        if a.output:
            y, _, _ = kit_sound(s['id']); print(write_audio(a.output, y)); return
        keys = ('id', 'name', 'description', 'use_for', 'avoid_for', 'duration', 'sync', 'timing', 'level', 'under_voiceover_db', 'adapt')
        print(json.dumps({k: s[k] for k in keys if k in s}, ensure_ascii=False, indent=1)); return
    words = [w.lower() for w in a.words]; res = []
    for s in idx.values():
        hay = ' '.join([s['id'], s.get('name', ''), s['category'], s.get('description', ''),
                        ' '.join(s.get('tags', [])), ' '.join(s.get('use_for', []))]).lower()
        sc = sum(hay.count(w) + 3 * (w in s['id']) for w in words) if words else 1
        if sc: res.append((sc, s))
    res.sort(key=lambda x: (-x[0], x[1]['id']))
    for sc, s in res[:a.n]:
        print(f"kit:{s['id']:34s} {s['duration']:5.2f}s 合わせ={s['sync']['at']:.3f}s {s['level']['tier']:7s} {s.get('description', '')[:80]}")
    print(f'（{len(res)} 件。詳しく: kit <id> / 書き出し: kit <id> -o x.wav）')

def cmd_music(a):
    if a.id in MUSIC:
        path = lib_path('music:' + a.id)
        if a.output:
            y = read_audio(path, a.start)[:secs(a.duration)].copy()
            y = fades(y, 0.05, min(2.0, 0.2 * a.duration)); y = y * dbg(-16 - lufs(y))
            print(write_audio(a.output, limit(y, -1.0))); return
        print(path); return
    for g, label in GROUPS.items():
        if a.id and a.id != g: continue
        print(f'■ {label}（{g}）')
        for k, (gg, title, comp, sec, _) in MUSIC.items():
            if gg == g: print(f'  music:{k:22s} {title}（{comp or "作曲者表記なし"}, {sec // 60}:{sec % 60:02d}）')
    print('FreePD の曲はすべて CC0（クレジット不要）。ほかの FreePD 曲も freepd:<曲名> で使える')

def cmd_amb(a):
    for k, (f, ja, sec, _) in AMBIENCE.items(): print(f'  amb:{k:14s} {ja}（{sec}秒のループ）')

def main(argv=None):
    ap = argparse.ArgumentParser(description='動画用の BGM・効果音をつくる / 混ぜる / 動画に付ける')
    sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('list', help='プリセット一覧').set_defaults(fn=cmd_list)
    p = sp.add_parser('bgm', help='BGM を作る'); p.set_defaults(fn=cmd_bgm)
    p.add_argument('preset', help='プリセット名 または レシピ .json')
    p.add_argument('-d', '--duration', type=float, required=True); p.add_argument('-o', '--output', required=True)
    p.add_argument('--seed', type=int, default=1); p.add_argument('--bpm', type=float); p.add_argument('--key')
    p.add_argument('--prog', help='コード進行（1小節1コード, 例 "Am F C G"）'); p.add_argument('--lufs', type=float, default=-16.0)
    p.add_argument('--debug', action='store_true')
    p = sp.add_parser('sfx', help='効果音を作る'); p.set_defaults(fn=cmd_sfx)
    p.add_argument('name'); p.add_argument('-o', '--output', required=True)
    p.add_argument('--seed', type=int, default=1); p.add_argument('--pitch', type=float, default=0.0); p.add_argument('--length', type=float)
    p = sp.add_parser('mix', help='BGM・効果音・ナレーションを混ぜる（動画にも付けられる）'); p.set_defaults(fn=cmd_mix)
    p.add_argument('--video'); p.add_argument('--duration', type=float); p.add_argument('-o', '--output', required=True)
    p.add_argument('--bgm', help='music:<id> / freepd:<曲名> / プリセット名 / レシピ .json / 音声ファイル / none')
    p.add_argument('--seed', type=int, default=1); p.add_argument('--bpm', type=float); p.add_argument('--key'); p.add_argument('--prog')
    p.add_argument('--bgm-start', type=float, default=0.0, help='手持ち音源の使い始め（秒）')
    p.add_argument('--bgm-gain', type=float, default=0.0, help='BGM の音量補正 dB')
    p.add_argument('--cue', action='append', help='名前@秒[:dB][:pitch=n][:length=s][:rate=r]（名前は kit:<id> / 効果音プリセット / ファイル。くり返し指定可）')
    p.add_argument('--amb', action='append', help='環境音 amb:<id> か音声ファイル（BGM の下に敷く。くり返し指定可）')
    p.add_argument('--amb-gain', type=float, default=0.0); p.add_argument('--kit-gain', type=float, default=0.0)
    p.add_argument('--cues', help='cue の JSON ファイル [{"sfx":"pop","t":3.2,"gain":-3}]')
    p.add_argument('--cuts', help='場面の切り替え時刻（カンマ区切り）'); p.add_argument('--cut-sfx', default='kit:whoosh-slow-medium')
    p.add_argument('--cut-gain', type=float, default=-3.0)
    p.add_argument('--voice', help='ナレーション（音声/動画ファイル）。鳴っている間は BGM を下げる')
    p.add_argument('--duck', type=float, default=9.0); p.add_argument('--sfx-lufs', type=float, default=-15.0)
    p.add_argument('--lufs', type=float, default=-16.0)
    p = sp.add_parser('kit', help='SFX Kit（CC0 の効果音 320 種）を探す・書き出す'); p.set_defaults(fn=cmd_kit)
    p.add_argument('words', nargs='*', help='探す単語（英語: whoosh, pop, click, success...）。id ならその詳しい情報')
    p.add_argument('-o', '--output', help='id を1つ指定して書き出す'); p.add_argument('-n', type=int, default=15)
    p = sp.add_parser('music', help='フリー BGM（FreePD, CC0）の一覧・試聴ファイル'); p.set_defaults(fn=cmd_music)
    p.add_argument('id', nargs='?', help='グループ名（calm など）で絞る、または曲 id')
    p.add_argument('-o', '--output', help='曲 id の試聴ファイルを書き出す'); p.add_argument('-d', '--duration', type=float, default=30.0)
    p.add_argument('--start', type=float, default=0.0)
    p = sp.add_parser('amb', help='環境音（CC0 / パブリックドメイン）の一覧'); p.set_defaults(fn=cmd_amb)
    p = sp.add_parser('demo', help='全プリセットの試聴ファイルを書き出す'); p.set_defaults(fn=cmd_demo)
    p.add_argument('-o', '--output', required=True); p.add_argument('-d', '--duration', type=float, default=16.0)
    p.add_argument('--seed', type=int, default=1)
    a = ap.parse_args(argv); a.fn(a)

if __name__ == '__main__':
    main()
