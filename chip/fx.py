# -*- coding: utf-8 -*-
"""ミックスダウンとエフェクト (ディレイ / リバーブ / グリッチ / マスタリング)。numpy のみ。"""
from __future__ import annotations

import wave

import numpy as np

from .synth import SR


def _fast_len(n: int) -> int:
    return 1 << (int(n) - 1).bit_length()


# --------------------------------------------------------------------------
# 基本的な信号処理
# --------------------------------------------------------------------------
def decimate(x: np.ndarray, factor: int) -> np.ndarray:
    """FFT でスペクトルを切り詰めてサンプルレートを 1/factor にする。"""
    if factor == 1:
        return x.astype(np.float32)
    n = len(x)
    n2 = _fast_len(n)
    spec = np.fft.rfft(x, n2)
    m = n2 // factor
    keep = spec[: m // 2 + 1].copy()
    k = len(keep)
    edge = int(k * 0.92)                        # 上端 8% をなだらかに落とす
    keep[edge:] *= 0.5 * (1.0 + np.cos(np.linspace(0.0, np.pi, k - edge)))
    y = np.fft.irfft(keep, m) / factor
    return y[: n // factor].astype(np.float32)


def filt(x: np.ndarray, lo: float | None = None, hi: float | None = None, order: int = 2) -> np.ndarray:
    """ゼロ位相のバターワース風フィルタ (lo 以上を通す / hi 以下を通す)。x は (N,) か (N,2)。"""
    n = x.shape[0]
    n2 = _fast_len(n)
    f = np.fft.rfftfreq(n2, 1.0 / SR)
    h = np.ones_like(f)
    if lo:
        h *= 1.0 / np.sqrt(1.0 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    if hi:
        h *= 1.0 / np.sqrt(1.0 + (f / hi) ** (2 * order))
    if x.ndim == 1:
        return np.fft.irfft(np.fft.rfft(x, n2) * h, n2)[:n]
    return np.stack([np.fft.irfft(np.fft.rfft(x[:, c], n2) * h, n2)[:n] for c in range(x.shape[1])], axis=1)


def pan_gains(pan: float) -> tuple[float, float]:
    a = (pan + 1.0) * np.pi / 4.0
    return float(np.cos(a)), float(np.sin(a))


def pingpong(x: np.ndarray, delay_s: float, feedback: float = 0.45, taps: int = 7) -> np.ndarray:
    """左右に跳ねるディレイのウェット成分 (N,2) を返す。"""
    d = int(round(delay_s * SR))
    wet = np.zeros((len(x), 2))
    src = filt(x, lo=300.0, hi=3800.0, order=1)
    g = 1.0
    for k in range(1, taps + 1):
        off = k * d
        if off >= len(x):
            break
        wet[off:, (k + 1) % 2] += g * src[: len(x) - off]
        g *= feedback
    return wet


def make_ir(rt60: float = 1.3, seed: int = 11) -> np.ndarray:
    """指数減衰ノイズで作る簡易ルームの IR (N,2)。"""
    n = int(SR * rt60 * 1.15)
    t = np.arange(n) / SR
    rng = np.random.default_rng(seed)
    ir = rng.standard_normal((n, 2)) * (10.0 ** (-3.0 * t / rt60))[:, None]
    ir[: int(SR * 0.004)] *= np.linspace(0.0, 1.0, int(SR * 0.004))[:, None]
    ir = filt(ir, lo=350.0, hi=5200.0, order=1)
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    return ir


def convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    """モノラル x とステレオ IR の畳み込み。出力長は x と同じ。"""
    n = len(x)
    n2 = _fast_len(n + len(ir))
    spec = np.fft.rfft(x, n2)
    return np.stack([np.fft.irfft(spec * np.fft.rfft(ir[:, c], n2), n2)[:n] for c in range(2)], axis=1)


# --------------------------------------------------------------------------
# グリッチ系 (ミックス後のステレオ (N,2) を直接書き換える)
# --------------------------------------------------------------------------
def tape_stop(mix: np.ndarray, t0: float, t1: float, curve: float = 1.7) -> None:
    """t0..t1 でテープが止まるように減速・ピッチダウンさせ、t1 で無音にする。"""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    n = i1 - i0
    u = np.arange(n) / n
    speed = (1.0 - u) ** curve
    pos = np.cumsum(speed) - speed
    src = mix[i0: i1 + 2].copy()
    xs = np.arange(len(src))
    fade = 1.0 - u ** 6
    for c in range(2):
        mix[i0:i1, c] = np.interp(pos, xs, src[:, c]) * fade


def stutter(mix: np.ndarray, t_src: float, slice_s: float, t_dst: float, count: int, gain: float = 1.0, decay: float = 1.0) -> None:
    """t_src から slice_s 秒ぶんを切り出し、t_dst から count 回並べて上書きする。"""
    n = int(slice_s * SR)
    s0 = int(t_src * SR)
    piece = mix[s0: s0 + n].copy()
    f = min(int(SR * 0.002), n // 4)
    piece[:f] *= np.linspace(0.0, 1.0, f)[:, None]
    piece[-f:] *= np.linspace(1.0, 0.0, f)[:, None]
    d0 = int(t_dst * SR)
    g = gain
    for k in range(count):
        a = d0 + k * n
        mix[a: a + n] = piece[: max(0, min(n, len(mix) - a))] * g
        g *= decay


def bitcrush(mix: np.ndarray, t0: float, t1: float, bits: int = 5, hold: int = 6, ref: float = 1.0) -> None:
    """t0..t1 をサンプル&ホールド + 量子化で荒らす。"""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    seg = mix[i0:i1]
    idx = (np.arange(len(seg)) // hold) * hold
    q = (2 ** (bits - 1)) / ref
    mix[i0:i1] = np.round(seg[idx] * q) / q


def tape(mix: np.ndarray, t0: float, t1: float, wow_cents: float = 9.0, flutter_cents: float = 2.5,
         hiss: float = 0.0, seed: int = 3) -> None:
    """t0..t1 を古いテープのように揺らし (ワウ・フラッター)、ヒスノイズを足す。"""
    i0, i1 = int(t0 * SR), min(int(t1 * SR), len(mix) - 2)
    n = i1 - i0
    t = np.arange(n) / SR
    edge = np.clip(np.minimum(t, t[-1] - t) / 0.35, 0.0, 1.0)      # 両端では揺れを 0 に戻す
    off = np.zeros(n)
    for cents, rate, ph in ((wow_cents, 0.57, 0.3), (wow_cents * 0.45, 1.31, 1.9), (flutter_cents, 6.7, 0.0)):
        ratio = 2.0 ** (cents / 1200.0) - 1.0
        off += ratio * SR / (2 * np.pi * rate) * np.sin(2 * np.pi * rate * t + ph)
    pos = np.arange(n) + off * edge
    src = mix[i0: i1 + 1].copy()
    xs = np.arange(len(src))
    for c in range(2):
        mix[i0:i1, c] = np.interp(pos, xs, src[:, c])
    if hiss:
        rng = np.random.default_rng(seed)
        nz = filt(rng.standard_normal((n, 2)), lo=1800.0, hi=9000.0, order=1)
        nz *= hiss / float(np.sqrt(np.mean(nz ** 2)))
        fade = np.clip(np.minimum(t / 0.25, (t[-1] - t) / 0.02), 0.0, 1.0)
        mix[i0:i1] += nz * fade[:, None]


def mute(mix: np.ndarray, t0: float, t1: float, fade: float = 0.003) -> None:
    """t0..t1 を無音にする (前後に短いフェード)。"""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    f = int(fade * SR)
    mix[i0 - f: i0] *= np.linspace(1.0, 0.0, f)[:, None]
    mix[i0:i1] = 0.0
    mix[i1: i1 + f] *= np.linspace(0.0, 1.0, f)[:, None]


# --------------------------------------------------------------------------
# ミックスダウン / マスタリング
# --------------------------------------------------------------------------
def mixdown(song, stems: dict[str, np.ndarray]) -> np.ndarray:
    """ステムを定位・ディレイ・リバーブつきでステレオにまとめ、グリッチを掛ける。"""
    n = len(next(iter(stems.values())))
    mix = np.zeros((n, 2))
    dly = np.zeros(n)
    rev = np.zeros(n)
    for ch, x in stems.items():
        c = song.mix[ch]
        x = x.astype(np.float64) * c.gain
        gl, gr = pan_gains(c.pan)
        mix[:, 0] += x * gl
        mix[:, 1] += x * gr
        if c.delay:
            dly += x * c.delay
        if c.reverb:
            rev += x * c.reverb
    beat = 60.0 / song.bpm
    wet = pingpong(dly, beat * 0.75)
    mix += wet
    rev += 0.5 * (wet[:, 0] + wet[:, 1])
    mix += convolve(rev, make_ir())

    ref = float(np.percentile(np.abs(mix), 99.9))
    for name, *args in song.fx:
        if name == "tape_stop":
            tape_stop(mix, song.time(args[0]), song.time(args[1]))
        elif name == "stutter":
            src, sl, dst, count, gain, decay = args
            stutter(mix, song.time(src), song.time(src + sl) - song.time(src), song.time(dst), count, gain, decay)
        elif name == "bitcrush":
            bitcrush(mix, song.time(args[0]), song.time(args[1]), args[2], args[3], ref)
        elif name == "tape":
            tape(mix, song.time(args[0]), song.time(args[1]), hiss=ref * args[2])
        elif name == "mute":
            mute(mix, song.time(args[0]), song.time(args[1]))
        elif name == "only_after":
            # テープが止まったあと: 残響も含めて全部消し、指定チャンネルだけを素のまま残す
            i0 = int(song.time(args[0]) * SR)
            mix[i0:] = 0.0
            for ch in args[1]:
                c = song.mix[ch]
                gl, gr = pan_gains(c.pan)
                x = stems[ch][i0:].astype(np.float64) * c.gain
                mix[i0:, 0] += x * gl
                mix[i0:, 1] += x * gr
        else:
            raise ValueError("unknown fx: %s" % name)
    return mix


def master(mix: np.ndarray, ceiling: float = 0.94, knee: float = 0.72) -> np.ndarray:
    """サブソニック除去 → ソフトクリップ → ピーク合わせ。"""
    mix = filt(filt(mix, lo=24.0, order=2), hi=10500.0, order=1)
    ref = float(np.percentile(np.abs(mix), 99.7))
    x = mix * (knee / ref)
    a = np.abs(x)
    over = a > knee
    y = x.copy()
    y[over] = np.sign(x[over]) * (knee + (1.0 - knee) * np.tanh((a[over] - knee) / (1.0 - knee)))
    return y * (ceiling / float(np.max(np.abs(y))))


def write_wav(path: str, mix: np.ndarray) -> None:
    """16bit ステレオ WAV (TPDF ディザつき)。"""
    rng = np.random.default_rng(1)
    d = (rng.random(mix.shape) - rng.random(mix.shape)) / 32768.0
    pcm = np.clip(np.round((mix + d) * 32767.0), -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
