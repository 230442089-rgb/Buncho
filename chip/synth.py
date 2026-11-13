# -*- coding: utf-8 -*-
"""ファミコン (2A03) + VRC6 相当のチップ音源シンセサイザ。

依存は numpy のみ。発音はすべて「1 チャンネル = 単音」で、音量は 4bit、
エンベロープ類は 60Hz のフレーム単位で更新する (FamiTracker のマクロと同じ考え方)。

波形はエイリアシングを避けるため 2 倍オーバーサンプリング + polyBLEP で生成する。
  - pulse : 矩形波 (デューティ比可変)
  - tri   : 2A03 の 32 段・4bit 階段三角波 (音量制御なし)
  - saw   : VRC6 の 7 段階段ノコギリ波
  - noise : 2A03 の 15bit LFSR ノイズ (長周期 / 短周期)
  - dmc   : 1bit ΔPCM (33.1kHz) でエンコードした合成ドラム
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

SR = 44100                 # 出力サンプルレート
OS = 2                     # 内部オーバーサンプリング倍率
ISR = SR * OS              # 内部サンプルレート
FPS = 60.0                 # マクロ更新レート (NTSC の 1 フレーム)
CPU_CLOCK = 1789772.7      # NTSC 2A03 の CPU クロック
DMC_RATE = CPU_CLOCK / 54  # DMC 最高レート (約 33.1kHz)

# 2A03 ノイズの周期テーブル (CPU サイクル)。index 0 が最も高い音。
NOISE_PERIODS = np.array(
    [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068],
    dtype=np.float64,
)

SMOOTH_N = int(ISR * 0.0012)   # 音量段差をならす長さ (約 1.2ms)


# --------------------------------------------------------------------------
# マクロ (フレーム単位のエンベロープ)
# --------------------------------------------------------------------------
class Macro:
    """FamiTracker 風マクロ。

    "15 12 10 | 8 7 / 5 3 1 0" のように書く。
      |  … ループ開始位置 (キーオン中、末尾まで来たらここへ戻る)
      /  … リリース開始位置 (キーオフでここへ飛び、末尾の値で止まる)
    ループ指定がなければ最後の値を保持する。
    """

    def __init__(self, spec: str | list[float]):
        vals: list[float] = []
        self.loop: int | None = None
        rel: int | None = None
        toks = spec.split() if isinstance(spec, str) else list(spec)
        for tok in toks:
            if tok == "|":
                self.loop = len(vals)
            elif tok == "/":
                rel = len(vals)
            else:
                vals.append(float(tok))
        if rel is None:
            self.body = np.array(vals, dtype=np.float64)
            self.tail = np.zeros(0, dtype=np.float64)
        else:
            self.body = np.array(vals[:rel], dtype=np.float64)
            self.tail = np.array(vals[rel:], dtype=np.float64)
        if len(self.body) == 0:
            raise ValueError("macro body is empty: %r" % (spec,))
        if self.loop is not None and self.loop >= len(self.body):
            self.loop = None

    @property
    def release_len(self) -> int:
        return len(self.tail)

    def on(self, n: int) -> np.ndarray:
        """キーオン中のフレーム 0..n-1 の値。"""
        idx = np.arange(n)
        length = len(self.body)
        if self.loop is not None:
            span = length - self.loop
            idx = np.where(idx < length, idx, self.loop + (idx - self.loop) % span)
        else:
            idx = np.minimum(idx, length - 1)
        return self.body[idx]

    def off(self, n: int) -> np.ndarray:
        """キーオフ後のフレーム 0..n-1 の値 (リリース指定がなければ 0)。"""
        if len(self.tail) == 0:
            return np.zeros(n)
        idx = np.minimum(np.arange(n), len(self.tail) - 1)
        return self.tail[idx]


# --------------------------------------------------------------------------
# 音色
# --------------------------------------------------------------------------
@dataclass
class Inst:
    wave: str = "pulse"                 # pulse / tri / saw / noise / dmc
    vol: Macro = field(default_factory=lambda: Macro("15"))
    duty: Macro | None = None           # デューティ比 (0.125 など) のマクロ
    arp: Macro | None = None            # 半音単位のオフセット (noise では周期 index)
    pit: Macro | None = None            # セント単位のオフセット
    vib_depth: float = 0.0              # ビブラートの深さ (セント)
    vib_rate: float = 6.0               # ビブラートの速さ (Hz)
    vib_delay: float = 0.2              # ビブラートが掛かり始めるまで (秒)
    vib_fade: float = 0.15              # ビブラートが最大になるまで (秒)
    detune: float = 0.0                 # セント
    slide_time: float = 0.05            # ポルタメント時間 (秒)
    short_noise: bool = False           # noise: 短周期 (金属的) モード
    sample: str | None = None           # dmc: サンプル名


def hz(p):
    """MIDI ノート番号 → 周波数。"""
    return 440.0 * np.power(2.0, (np.asarray(p, dtype=np.float64) - 69.0) / 12.0)


# --------------------------------------------------------------------------
# オシレータ
# --------------------------------------------------------------------------
def _blep(t: np.ndarray, dt: np.ndarray) -> np.ndarray:
    """単位段差 (0→1) に対する 2 点 polyBLEP 残差。

    t は段差位置から測った位相 [0,1)、dt は 1 サンプルあたりの位相増分。
    """
    out = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    out[m] = -0.5 * (1.0 - x) ** 2
    m = t > 1.0 - dt
    x = (t[m] - 1.0) / dt[m]
    out[m] = 0.5 * (1.0 + x) ** 2
    return out


def osc_pulse(freq: np.ndarray, duty: np.ndarray | float, sr: float = ISR) -> np.ndarray:
    """帯域制限つき矩形波 (DC 成分は除去済み)。"""
    dt = freq / sr
    ph = np.cumsum(dt) - dt
    t = ph - np.floor(ph)
    y = np.where(t < duty, 1.0, -1.0)
    y += 2.0 * _blep(t, dt)                 # 立ち上がり (位相 0)
    t2 = t - duty
    t2 -= np.floor(t2)
    y -= 2.0 * _blep(t2, dt)                # 立ち下がり (位相 duty)
    y -= 2.0 * duty - 1.0
    return y


def osc_stair(freq: np.ndarray, table: np.ndarray, sr: float = ISR) -> np.ndarray:
    """階段波 (table を 1 周期として読む)。各段差に polyBLEP を掛ける。"""
    k_steps = len(table)
    jump = table - np.roll(table, 1)        # jump[k] = step k の頭での段差
    dt = freq / sr
    ph = np.cumsum(dt) - dt
    s = (ph - np.floor(ph)) * k_steps
    k = np.minimum(s.astype(np.int64), k_steps - 1)
    fr = s - k
    y = table[k].astype(np.float64)
    ds = np.minimum(dt * k_steps, 0.999)
    m = fr < ds
    x = fr[m] / ds[m]
    y[m] += jump[k[m]] * (-0.5 * (1.0 - x) ** 2)
    m = fr > 1.0 - ds
    x = (fr[m] - 1.0) / ds[m]
    y[m] += jump[(k[m] + 1) % k_steps] * (0.5 * (1.0 + x) ** 2)
    return y


# 2A03 三角波: 15,14,…,0,0,1,…,15 の 32 段
_tri_seq = np.concatenate([np.arange(15, -1, -1), np.arange(0, 16)]).astype(np.float64)
TRI_TABLE = (_tri_seq - 7.5) / 7.5
# VRC6 ノコギリ波: アキュムレータが 6 回加算されて 7 回目でリセットされる 7 段
SAW_TABLE = (np.arange(7, dtype=np.float64) / 6.0) * 2.0 - 1.0


def _lfsr(short: bool) -> np.ndarray:
    """2A03 ノイズの LFSR 出力列 (1 周期ぶん)。値は ±1。"""
    reg = 1
    tap = 6 if short else 1
    n = 93 if short else 32767
    out = np.empty(n, dtype=np.float64)
    for i in range(n):
        out[i] = -1.0 if (reg & 1) else 1.0
        fb = (reg ^ (reg >> tap)) & 1
        reg = (reg >> 1) | (fb << 14)
    return out


_NOISE_SEQ = {False: _lfsr(False), True: _lfsr(True)}
_NOISE_CUM = {k: np.concatenate([[0.0], np.cumsum(v)]) for k, v in _NOISE_SEQ.items()}


def _held_integral(seq: np.ndarray, cum: np.ndarray, x: np.ndarray) -> np.ndarray:
    """周期的な区分定数列 seq の 0..x の積分。"""
    n = len(seq)
    k = np.floor(x)
    fr = x - k
    k = k.astype(np.int64)
    cyc, idx = np.divmod(k, n)
    return cyc * cum[n] + cum[idx] + fr * seq[idx]


def osc_noise(rate: np.ndarray, short: bool = False, sr: float = ISR) -> np.ndarray:
    """LFSR ノイズ。1 出力サンプルの区間で箱型平均してエイリアシングを抑える。"""
    seq, cum = _NOISE_SEQ[short], _NOISE_CUM[short]
    inc = rate / sr
    x1 = np.cumsum(inc)
    x0 = x1 - inc
    return (_held_integral(seq, cum, x1) - _held_integral(seq, cum, x0)) / inc


def noise_rate(index) -> np.ndarray:
    """ノイズの「高さ」0..15 (15 が最も高い) → LFSR のクロック周波数。"""
    idx = np.clip(np.rint(index), 0, 15).astype(np.int64)
    return CPU_CLOCK / NOISE_PERIODS[15 - idx]


# --------------------------------------------------------------------------
# DMC (1bit ΔPCM) ドラム
# --------------------------------------------------------------------------
def _dpcm(x: np.ndarray) -> np.ndarray:
    """±1 の波形を 2A03 DMC と同じ 1bit ΔPCM (7bit カウンタ ±2) に通す。"""
    level = 64
    out = np.empty(len(x), dtype=np.float64)
    target = 64.0 + 63.0 * np.clip(x, -1.0, 1.0)
    for i in range(len(x)):
        if target[i] > level:
            if level <= 125:
                level += 2
        else:
            if level >= 2:
                level -= 2
        out[i] = level
    return (out - 64.0) / 64.0


def _drum_source(name: str) -> np.ndarray:
    """DMC に通す前の原音 (DMC_RATE で合成)。"""
    rng = np.random.default_rng(20261113)
    if name == "kick":
        t = np.arange(int(DMC_RATE * 0.21)) / DMC_RATE
        f = 46.0 + 150.0 * np.exp(-t / 0.026)
        x = np.sin(2 * np.pi * np.cumsum(f) / DMC_RATE) * np.exp(-t / 0.085)
    elif name in ("tom_h", "tom_m", "tom_l"):
        f0 = {"tom_h": 300.0, "tom_m": 220.0, "tom_l": 160.0}[name]
        t = np.arange(int(DMC_RATE * 0.17)) / DMC_RATE
        f = f0 * (0.55 + 0.45 * np.exp(-t / 0.05))
        x = np.sin(2 * np.pi * np.cumsum(f) / DMC_RATE) * np.exp(-t / 0.07)
    elif name == "snare":
        t = np.arange(int(DMC_RATE * 0.12)) / DMC_RATE
        f = 170.0 + 90.0 * np.exp(-t / 0.012)
        body = np.sin(2 * np.pi * np.cumsum(f) / DMC_RATE) * np.exp(-t / 0.045)
        x = 0.8 * body + 0.25 * rng.uniform(-1, 1, len(t)) * np.exp(-t / 0.03)
    else:
        raise KeyError(name)
    fade = int(DMC_RATE * 0.01)
    x[-fade:] *= np.linspace(1.0, 0.0, fade)
    return x


_DMC_CACHE: dict[tuple[str, int], np.ndarray] = {}


def dmc_sample(name: str, vol: int) -> np.ndarray:
    """DMC サンプルを内部レートの波形として返す (vol 0..15 は原音の振幅)。"""
    key = (name, vol)
    if key not in _DMC_CACHE:
        dec = _dpcm(_drum_source(name) * (vol / 15.0) * 0.98)
        cum = np.concatenate([[0.0], np.cumsum(dec)])
        n_out = int(len(dec) / DMC_RATE * ISR)
        x1 = (np.arange(n_out) + 1) * (DMC_RATE / ISR)
        x1 = np.minimum(x1, len(dec))
        x0 = np.concatenate([[0.0], x1[:-1]])
        k1 = np.floor(x1).astype(np.int64)
        k0 = np.floor(x0).astype(np.int64)
        dec_pad = np.concatenate([dec, [dec[-1]]])
        c1 = cum[k1] + (x1 - k1) * dec_pad[k1]
        c0 = cum[k0] + (x0 - k0) * dec_pad[k0]
        y = (c1 - c0) / np.maximum(x1 - x0, 1e-9)
        fade = int(ISR * 0.004)
        y[-fade:] *= np.linspace(1.0, 0.0, fade)
        _DMC_CACHE[key] = y.astype(np.float32)
    return _DMC_CACHE[key]


# --------------------------------------------------------------------------
# 1 音ぶんのレンダリング
# --------------------------------------------------------------------------
def _smooth(a: np.ndarray, w: int) -> np.ndarray:
    """長さ w の因果的な移動平均 (音量の段差をならす)。"""
    c = np.cumsum(np.concatenate([np.zeros(w), a]))
    return (c[w:] - c[:-w]) / w


def render_note(
    inst: Inst,
    pitch: float,
    vol: int,
    gate_s: float,
    max_s: float,
    slide_from: float | None = None,
) -> np.ndarray:
    """1 音を内部レートでレンダリングして返す。

    gate_s … キーオンしている長さ (秒)
    max_s  … 同じチャンネルの次の音までの長さ (秒)。リリースはここで打ち切る。
    """
    if inst.wave == "dmc":
        y = dmc_sample(inst.sample, vol)
        n = min(len(y), int(max_s * ISR))
        y = y[:n].copy()
        if n < len(_DMC_CACHE[(inst.sample, vol)]) and n > 64:
            y[-64:] *= np.linspace(1.0, 0.0, 64, dtype=np.float32)
        return y

    total = min(gate_s + inst.vol.release_len / FPS, max_s)
    n = int(math.floor(total * ISR))
    if n < 16:
        return np.zeros(0, dtype=np.float32)
    t = np.arange(n) / ISR
    fr = (t * FPS).astype(np.int64)
    nfr = int(fr[-1]) + 1

    # ---- 音量 (4bit) ----
    lv = inst.vol.on(nfr)[fr]
    k0 = int(math.ceil(gate_s * ISR))
    if k0 < n:
        fo = ((t[k0:] - gate_s) * FPS).astype(np.int64)
        lv[k0:] = inst.vol.off(int(fo[-1]) + 1)[fo]
    if inst.wave == "tri":
        amp = (lv > 0).astype(np.float64)       # 三角波チャンネルに音量はない
    else:
        q = np.floor(lv * vol / 15.0)
        q[(q < 1) & (lv > 0) & (vol > 0)] = 1.0
        amp = q / 15.0
    amp = _smooth(amp, SMOOTH_N)
    w = min(SMOOTH_N, n)
    amp[-w:] *= np.linspace(1.0, 0.0, w)

    # ---- 波形 ----
    if inst.wave == "noise":
        idx = np.full(n, float(pitch))
        if inst.arp is not None:
            idx = idx + inst.arp.on(nfr)[fr]
        y = osc_noise(noise_rate(idx), inst.short_noise)
    else:
        p = np.full(n, pitch + inst.detune / 100.0)
        if inst.arp is not None:
            p += inst.arp.on(nfr)[fr]
        if inst.pit is not None:
            p += inst.pit.on(nfr)[fr] / 100.0
        if inst.vib_depth:
            tt = t - inst.vib_delay
            p += (
                np.sin(2 * np.pi * inst.vib_rate * tt)
                * np.clip(tt / inst.vib_fade, 0.0, 1.0)
                * (inst.vib_depth / 100.0)
            )
        if slide_from is not None:
            p += (slide_from - pitch) * np.clip(1.0 - t / inst.slide_time, 0.0, 1.0)
        f = hz(p)
        if inst.wave == "pulse":
            duty = inst.duty.on(nfr)[fr] if inst.duty is not None else 0.5
            y = osc_pulse(f, duty)
        elif inst.wave == "tri":
            y = osc_stair(f, TRI_TABLE)
        elif inst.wave == "saw":
            y = osc_stair(f, SAW_TABLE)
        else:
            raise ValueError("unknown wave: %s" % inst.wave)
    return (y * amp).astype(np.float32)
