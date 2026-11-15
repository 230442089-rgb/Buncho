"""音。台詞（VOICEVOX）以外はすべてここで合成する（既存の音源・警報音は使わない）。"""
from __future__ import annotations

import math
import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000


# =============================================================== 部品
def _n(sec: float) -> int:
    return int(round(sec * SR))


def tt(sec: float) -> np.ndarray:
    return np.arange(_n(sec), dtype=np.float64) / SR


def bp(x: np.ndarray, lo: float | None, hi: float | None, order: int = 2) -> np.ndarray:
    if lo and hi:
        sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    elif lo:
        sos = butter(order, lo, btype="high", fs=SR, output="sos")
    else:
        sos = butter(order, hi, btype="low", fs=SR, output="sos")
    return sosfilt(sos, x)


def fade(x: np.ndarray, fin: float = 0.0, fout: float = 0.0) -> np.ndarray:
    x = x.copy()
    a, b = min(len(x), _n(fin)), min(len(x), _n(fout))
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def place(buf: np.ndarray, x: np.ndarray, t0: float, gain: float = 1.0, pan: float = 0.0) -> None:
    """モノラルの音 x を、2チャンネルの buf の時刻 t0 に置く。pan は -1（左）〜1（右）。"""
    i0 = _n(t0)
    if i0 >= len(buf) or i0 + len(x) <= 0:
        return
    a = max(0, -i0)
    b = min(len(x), len(buf) - i0)
    ang = (pan + 1) * math.pi / 4
    buf[i0 + a : i0 + b, 0] += x[a:b] * gain * math.cos(ang) * math.sqrt(2)
    buf[i0 + a : i0 + b, 1] += x[a:b] * gain * math.sin(ang) * math.sqrt(2)


def put(buf: np.ndarray, x: np.ndarray, t0: float, gain: float = 1.0) -> None:
    """モノラル同士。"""
    i0 = _n(t0)
    if i0 >= len(buf) or i0 + len(x) <= 0:
        return
    a = max(0, -i0)
    b = min(len(x), len(buf) - i0)
    buf[i0 + a : i0 + b] += x[a:b] * gain


def white(sec: float, seed: int) -> np.ndarray:
    return np.random.default_rng(seed).standard_normal(_n(sec))


def decay(sec: float, tau: float) -> np.ndarray:
    return np.exp(-tt(sec) / tau)


def bell(freq: float, dur: float, dk: float = 0.9, partials=((1.0, 1.0, 1.0), (2.0, 0.45, 0.6), (3.01, 0.18, 0.35))) -> np.ndarray:
    """鐘・チャイムの音。partials: (倍率, 音量, 減衰の比)"""
    t = tt(dur)
    y = np.zeros_like(t)
    for mul, amp, d in partials:
        y += amp * np.sin(2 * np.pi * freq * mul * t) * np.exp(-t / (dk * d))
    return fade(y, 0.003, 0.02)


def musicbox_note(freq: float, dur: float = 2.2) -> np.ndarray:
    y = bell(freq, dur, 1.0, ((1.0, 1.0, 1.0), (3.0, 0.22, 0.32), (5.4, 0.10, 0.16), (8.9, 0.04, 0.08)))
    click = white(0.004, int(freq)) * np.linspace(1, 0, _n(0.004)) * 0.25
    y[: len(click)] += click
    return y


NOTE = {"E3": 164.81, "F3": 174.61, "A3": 220.0, "C4": 261.63, "D4": 293.66, "E4": 329.63, "G4": 392.0, "G#4": 415.30,
        "A4": 440.0, "B4": 493.88, "C5": 523.25, "D5": 587.33, "E5": 659.25, "F5": 698.46, "G5": 783.99, "C6": 1046.5}

# 放送終了のオルゴール（自作の旋律。イ短調・3拍子）: (拍, 音)
MELODY = [
    (0, "A4"), (1, "E5"), (2, "C5"), (3, "D5"), (5, "B4"), (6, "C5"), (7, "A4"), (8, "G4"), (9, "A4"),
    (12, "A4"), (13, "E5"), (14, "C5"), (15, "F5"), (17, "E5"), (18, "D5"), (19, "B4"), (20, "G#4"), (21, "A4"),
]
BASS = [(0, "A3"), (3, "F3"), (6, "C4"), (9, "A3"), (12, "A3"), (15, "D4"), (18, "E3"), (21, "A3")]


def reverb(x: np.ndarray, sec: float = 1.2, mix: float = 0.25, seed: int = 3, lo: float = 300, hi: float = 5000) -> np.ndarray:
    ir = white(sec, seed) * np.exp(-tt(sec) / (sec / 4.5))
    ir = bp(ir, lo, hi)
    ir /= np.sqrt((ir ** 2).sum())
    wet = fftconvolve(x, ir)[: len(x) + len(ir)]
    out = np.zeros(len(wet))
    out[: len(x)] = x
    return out + mix * wet


def wow(x: np.ndarray, depth: float, rate: float, flutter: float = 0.0, phase: float = 0.0) -> np.ndarray:
    """テープの回転むら。"""
    n = len(x)
    t = np.arange(n) / SR
    disp = depth / (2 * np.pi * rate) * np.sin(2 * np.pi * rate * t + phase)
    if flutter:
        disp += flutter / (2 * np.pi * 7.3) * np.sin(2 * np.pi * 7.3 * t)
    return np.interp(np.arange(n) + disp * SR, np.arange(n), x)


def repitch(x: np.ndarray, ratio: float) -> np.ndarray:
    return np.interp(np.arange(0, len(x) - 1, ratio), np.arange(len(x)), x)


def music(beat: float, start_beat: int = 0, end_beat: int = 24, phase: float = 0.0) -> np.ndarray:
    buf = np.zeros(_n((end_beat - start_beat) * beat + 3.0))
    for b, name in MELODY:
        if start_beat <= b < end_beat:
            put(buf, musicbox_note(NOTE[name] * 2), (b - start_beat) * beat, 0.5)
    for b, name in BASS:
        if start_beat <= b < end_beat:
            put(buf, musicbox_note(NOTE[name] * 2, 2.6), (b - start_beat) * beat, 0.3)
    return wow(reverb(bp(buf, 200, 6500), 1.4, 0.22), 0.006, 0.55, 0.0015, phase)


def chime_news(pairs: int) -> np.ndarray:
    buf = np.zeros(_n(pairs * 1.1 + 1.2))
    for k in range(pairs):
        put(buf, bell(NOTE["E5"], 1.0, 0.55), k * 1.1, 0.6)
        put(buf, bell(NOTE["C5"], 1.2, 0.65), k * 1.1 + 0.5, 0.6)
    return buf


def chime_bousai() -> np.ndarray:
    buf = np.zeros(_n(3.4))
    for k, name in enumerate(["C5", "E5", "G5", "C6"]):
        put(buf, bell(NOTE[name], 1.6, 0.8, ((1.0, 1.0, 1.0), (4.0, 0.15, 0.3))), k * 0.52, 0.55)
    return buf


def blip(freq: float, dur: float = 0.022, shape: str = "sq") -> np.ndarray:
    t = tt(dur)
    y = np.sign(np.sin(2 * np.pi * freq * t)) if shape == "sq" else np.sin(2 * np.pi * freq * t)
    return fade(y, 0.001, 0.006)


def thud(freq: float = 62.0, dur: float = 0.25) -> np.ndarray:
    t = tt(dur)
    y = np.sin(2 * np.pi * freq * t * (1 + 0.6 * np.exp(-t / 0.03))) * np.exp(-t / (dur / 4))
    y += 0.5 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / (dur / 6))
    return fade(y, 0.001, 0.02)


def swell(sec: float, lo: float, hi: float, seed: int, rising: bool = True) -> np.ndarray:
    env = np.exp(-(1 - np.linspace(0, 1, _n(sec))) * 5.0)
    x = bp(white(sec, seed), lo, hi) * env
    return x if rising else x[::-1]


def rain(sec: float, seed: int = 21) -> np.ndarray:
    rng = np.random.default_rng(seed)
    x = bp(white(sec, seed), 900, 9000) * 0.6 + bp(white(sec, seed + 1), 150, 900) * 0.35
    drops = np.zeros(_n(sec))
    for _ in range(int(sec * 55)):
        i = int(rng.integers(0, len(drops) - 400))
        f = float(rng.uniform(1800, 5200))
        n = int(rng.integers(120, 380))
        drops[i : i + n] += np.sin(2 * np.pi * f * np.arange(n) / SR) * np.exp(-np.arange(n) / (n / 4)) * float(rng.uniform(0.2, 1.0))
    return (x + 0.5 * drops) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.11 * tt(sec)))


# ---------------------------------------------------------------- 人の出す音
def breath(dur: float, rate: float, seed: int, shaky: float = 0.5, voiced: float = 0.12, swell_to: float = 1.0) -> np.ndarray:
    """息づかい。rate は1秒あたりの呼吸の回数。吸う息は高く細く、吐く息は低く太い。"""
    rng = np.random.default_rng(seed)
    n = _n(dur)
    out = np.zeros(n)
    inh = bp(rng.standard_normal(n), 1100, 5200) + 1.5 * bp(rng.standard_normal(n), 1600, 2300)
    exh = bp(rng.standard_normal(n), 350, 2600) + 1.5 * bp(rng.standard_normal(n), 700, 1100)
    t = 0.0
    while t < dur - 0.15:
        cyc = (1.0 / rate) * rng.uniform(0.8, 1.25)
        ti, te = cyc * rng.uniform(0.36, 0.46), cyc * rng.uniform(0.40, 0.50)
        g = 1.0 + (swell_to - 1.0) * (t / dur)
        i0, i1 = _n(t), min(n, _n(t + ti))
        m = i1 - i0
        if m > 10:
            e = np.sin(np.linspace(0, np.pi, m)) ** 1.5
            e *= 1 + shaky * 0.5 * np.sin(2 * np.pi * rng.uniform(9, 14) * np.arange(m) / SR + rng.uniform(0, 6))
            out[i0:i1] += inh[i0:i1] * e * rng.uniform(0.7, 1.0) * g
        j0, j1 = min(n, _n(t + ti + cyc * 0.04)), min(n, _n(t + ti + cyc * 0.04 + te))
        m = j1 - j0
        if m > 10:
            u = np.linspace(0, 1, m)
            e = np.minimum(u * 12, 1) * np.exp(-u * 2.6)
            e *= 1 + shaky * 0.6 * np.sin(2 * np.pi * rng.uniform(8, 13) * np.arange(m) / SR)
            out[j0:j1] += exh[j0:j1] * e * rng.uniform(0.8, 1.1) * g
            if rng.random() < voiced:  # 吐く息に声がもれる
                f0 = rng.uniform(170, 240)
                ph = 2 * np.pi * np.cumsum(f0 * (1 - 0.25 * u)) / SR
                out[j0:j1] += bp(np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph), 180, 1800) * e * 0.55 * g
        t += cyc
    return out * 0.5


def gasp(seed: int) -> np.ndarray:
    """息をのむ音。"""
    m = _n(0.32)
    u = np.linspace(0, 1, m)
    e = np.minimum(u * 5, 1) ** 2 * np.exp(-np.maximum(0, u - 0.7) * 9)
    x = (bp(white(0.32, seed), 1500, 6500) + 1.6 * bp(white(0.32, seed + 1), 2200, 3200)) * e
    ph = 2 * np.pi * np.cumsum(210 + 190 * u) / SR
    return (x * 0.5 + bp(np.sin(ph) + 0.5 * np.sin(2 * ph), 250, 2400) * e * 0.35)


def heartbeat(dur: float, p0: float, p1: float) -> np.ndarray:
    buf = np.zeros(_n(dur))
    t = 0.0
    while t < dur - 0.4:
        p = p0 + (p1 - p0) * t / dur
        put(buf, thud(64, 0.16), t, 1.0)
        put(buf, thud(52, 0.14), t + p * 0.3, 0.7)
        t += p
    return buf + 0.35 * bp(buf, 100, 400)


def footstep(seed: int, wet: bool = True) -> np.ndarray:
    x = np.zeros(_n(0.16))
    put(x, thud(95, 0.07), 0, 0.8)
    put(x, bp(white(0.05, seed), 1500, 6000) * decay(0.05, 0.012), 0, 0.5)
    if wet:
        put(x, bp(white(0.14, seed + 1), 800, 3500) * decay(0.14, 0.04), 0.01, 0.3)
    return x


def whip(seed: int) -> np.ndarray:
    """糸が空を切る音。"""
    m = _n(0.2)
    u = np.linspace(0, 1, m)
    hi = bp(white(0.2, seed), 4000, 9500) * (1 - u) ** 2
    mid = bp(white(0.2, seed + 1), 900, 3200) * u * (1 - u) * 4
    ph = 2 * np.pi * np.cumsum(1500 - 1050 * u) / SR
    return (hi + 0.8 * mid) * np.minimum(u * 40, 1) + 0.25 * np.sin(ph) * np.exp(-u * 6)


def scrape(dur: float, seed: int) -> np.ndarray:
    """濡れた路面を引きずる音。"""
    rng = np.random.default_rng(seed)
    n = _n(dur)
    env = np.interp(np.arange(n), np.linspace(0, n, int(dur * 9) + 2), rng.uniform(0.25, 1.0, int(dur * 9) + 2))
    x = bp(rng.standard_normal(n), 180, 1600) * env
    grit = bp(rng.standard_normal(n), 1500, 5000) * (rng.random(n) > 0.9993).astype(float)
    grit = np.convolve(grit, decay(0.03, 0.006), mode="same")
    return x + 2.5 * grit


def ping(freq: float, seed: int = 0) -> np.ndarray:
    """空き缶など、小さな金属の音。"""
    return bell(freq, 0.3, 0.07, ((1.0, 1.0, 1.0), (2.31, 0.6, 0.7), (3.9, 0.35, 0.5))) + 0.4 * np.pad(
        bp(white(0.01, seed), 3000, 9000), (0, _n(0.29)))[: _n(0.3)]


def tinny_music(dur: float) -> np.ndarray:
    """路上に落ちたヘッドホンから、小さくもれている音楽。"""
    beat = 60 / 132
    buf = np.zeros(_n(dur))
    k = 0
    while k * beat / 2 < dur - 0.3:
        t = k * beat / 2
        put(buf, bp(white(0.03, k), 6000, 11000) * decay(0.03, 0.008), t, 0.5)
        if k % 4 == 0:
            put(buf, thud(110, 0.1), t, 0.9)
        if k % 8 == 4:
            put(buf, bp(white(0.09, 900 + k), 1500, 5000) * decay(0.09, 0.025), t, 0.6)
        if k % 2 == 0:
            f = [220, 220, 262, 196][(k // 2) % 4] * 2
            tn = tt(beat * 0.45)
            put(buf, np.sign(np.sin(2 * np.pi * f * tn)) * np.exp(-tn / 0.08), t, 0.3)
        k += 1
    return bp(buf, 1800, 7000)


# ---------------------------------------------------------------- 声の通り道
def tv_voice(x: np.ndarray) -> np.ndarray:
    """テレビから聞こえるアナウンサーの声。"""
    return np.tanh(bp(x, 130, 7000) * 1.6) * 0.62


def outdoor(x: np.ndarray) -> np.ndarray:
    """屋外のラッパ形スピーカー。遠くの塔からも遅れて届くので、何重にもこだまする。"""
    x = np.tanh(bp(x, 380, 3000, 3) * 3.0) * 0.5
    out = np.zeros(len(x) + _n(2.6))
    for delay, gain, lp in [(0.0, 1.0, 3000), (0.37, 0.58, 2200), (0.83, 0.40, 1700), (1.42, 0.26, 1300), (2.10, 0.16, 1000)]:
        put(out, bp(x, None, lp), delay, gain)
    return reverb(out, 1.0, 0.15, seed=9)


def distant(x: np.ndarray) -> np.ndarray:
    """静まりかえった街の、遠くから届く呼び声。"""
    x = bp(x, 400, 3600)
    out = np.zeros(len(x) + _n(1.4))
    for delay, gain in [(0.0, 1.0), (0.29, 0.5), (0.71, 0.3), (1.2, 0.16)]:
        put(out, x, delay, gain)
    return reverb(out, 2.6, 0.9, seed=12, lo=300, hi=3200)


def small_speaker(x: np.ndarray) -> np.ndarray:
    """部屋のテレビの、小さなスピーカー。"""
    return np.tanh(bp(x, 450, 3800, 3) * 2.6) * 0.5


def close(x: np.ndarray) -> np.ndarray:
    """耳もとの声。"""
    return reverb(bp(x, 110, 9500), 0.5, 0.06, seed=14)


def street_mic(x: np.ndarray, far: float = 0.0) -> np.ndarray:
    """街頭カメラのマイク。far が大きいほど遠い。"""
    y = np.tanh(bp(x, 280, 4800 - 2600 * far) * (2.2 - 1.2 * far)) * 0.55
    return reverb(y, 1.6, 0.25 + 0.9 * far, seed=16, lo=250, hi=3500)


def scream_fx(x: np.ndarray) -> np.ndarray:
    """悲鳴。声をふるわせ、ざらつかせ、マイクが割れるまで歪ませる。"""
    t = np.arange(len(x)) / SR
    x = wow(x, 0.022, 5.5, 0.009)
    rough = 1 - 0.42 * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (66 + 9 * np.sin(2 * np.pi * 3.1 * t)) * t)))
    x = np.tanh(x * rough * 7.0)
    return np.clip(bp(x, 260, 6500) * 1.4, -0.85, 0.85)


def ghost(x: np.ndarray, seed: int, rev: bool = False, ratio: float = 1.0) -> np.ndarray:
    """さがしている家族の声。あちこちから、にじんで届く。"""
    y = reverb(bp(repitch(x, ratio), 250, 5200), 1.9, 0.7, seed=seed, lo=300, hi=4500)
    return y[::-1].copy() if rev else y


# =============================================================== 本体
def build(tl: dict, voice_dir: str, out_wav: str) -> None:
    mk = tl["marks"]
    dur = tl["duration"]
    n = _n(dur + 1.0)
    main = np.zeros((n, 2))  # 放送・録画の音。世界が止まると一緒に止まる
    over = np.zeros((n, 2))  # 止まっているあいだも聞こえる音（タコくんの息、心音、ユリアの声）
    sc: dict[str, list] = {}
    for s in tl["scenes"]:
        sc.setdefault(s["name"], []).append(s)
    say = {s["id"]: s for s in tl["says"]}

    def load(lid: str) -> np.ndarray:
        wav, sr = sf.read(os.path.join(voice_dir, lid + ".wav"), dtype="float64")
        assert sr == SR
        return wav

    # ---- テープのヒスとハム（再生している間ずっと）
    t_all = np.arange(n) / SR
    hiss = bp(white(n / SR, 1), 2000, 12000) * 0.010 + white(n / SR, 2) * 0.0025
    hum = 0.006 * np.sin(2 * np.pi * 60 * t_all) + 0.003 * np.sin(2 * np.pi * 120 * t_all) + 0.0015 * np.sin(2 * np.pi * 180 * t_all)
    on = np.zeros(n)
    on[_n(0.35) : _n(mk["vcr_stop"])] = 1.0
    main += ((hiss + hum) * on)[:, None]
    place(main, thud(58, 0.3) + 0.4 * np.pad(white(0.05, 5), (0, _n(0.25)))[: _n(0.3)], 0.05, 0.35)  # 再生ボタン

    # ---- アナウンサーと防災無線
    for s in tl["says"]:
        lid = s["id"]
        if s["voice"] == "B":
            place(main, outdoor(load(lid)), s["t0"], 0.55)
        elif s["voice"] == "A" and lid in ("A17", "A18"):
            wav = load(lid)  # 妨害を受けて、声がとぎれ、にごる
            rng = np.random.default_rng(int(lid[1:]))
            gate = np.repeat((rng.random(len(wav) // 2400 + 1) > 0.22).astype(float), 2400)[: len(wav)]
            gate = np.convolve(gate, np.ones(480) / 480, mode="same")
            v = tv_voice(wav)
            ring = v * (0.55 + 0.45 * np.sin(2 * np.pi * 47 * np.arange(len(v)) / SR))
            buzz = bp(np.sign(np.sin(2 * np.pi * 60 * np.arange(len(v)) / SR)), 300, 3500) * 0.05
            place(main, ring * (0.25 + 0.75 * gate) + buzz * (1 - gate), s["t0"], 0.95)
        elif lid == "A19":
            v = tv_voice(load(lid))  # 読まされている。しだいに自分の声でなくなり、ユリアの声に引き取られる
            u = np.linspace(0, 1, len(v))
            v = v * (1 - 0.5 * u * (0.5 + 0.5 * np.sin(2 * np.pi * 31 * np.arange(len(v)) / SR)))
            dbl = np.zeros(len(v) + _n(0.03))
            put(dbl, v, 0.0, 1.0)
            put(dbl, v * u, 0.024, 0.6)
            place(main, fade(dbl, 0.0, 0.25), s["t0"], 0.95)
        elif s["voice"] == "A":
            place(main, tv_voice(load(lid)), s["t0"], 1.0)

    # ---- ユリアとタコくん
    y01 = tv_voice(load("Y01"))
    dbl = np.zeros(len(y01) + _n(0.03))
    put(dbl, y01, 0.0, 1.0)
    put(dbl, y01, 0.017, 0.5)
    place(main, dbl, say["Y01"]["t0"], 1.05)
    place(main, distant(load("Y02")), say["Y02"]["t0"], 0.26, -0.35)
    place(main, outdoor(load("Y03")), say["Y03"]["t0"], 0.62)
    place(main, small_speaker(load("Y04")), say["Y04"]["t0"], 0.85)
    for lid, g in [("Y05", 1.0), ("Y06", 0.9), ("Y07", 0.9)]:
        place(over, close(load(lid)), say[lid]["t0"], g)
    place(over, swell(0.7, 300, 2500, 75), say["Y05"]["t0"] - 0.7, 0.10)
    place(main, street_mic(load("Y08"), 0.25), say["Y08"]["t0"], 0.95)
    place(main, close(load("Y09")), say["Y09"]["t0"], 0.95)
    place(main, street_mic(load("Y10"), 0.35), say["Y10"]["t0"], 0.85)
    place(main, close(load("Y11")), say["Y11"]["t0"], 1.05)

    alcove = lambda x: reverb(bp(x, 200, 6000), 0.45, 0.18, seed=18)  # noqa: E731
    place(main, alcove(load("T01")), say["T01"]["t0"], 1.40)
    place(main, alcove(load("T02")), say["T02"]["t0"], 1.15)
    t03 = load("T03")
    place(over, close(t03 * 0.6 + 0.25 * bp(white(len(t03) / SR, 33), 900, 4500)[: len(t03)] * np.abs(t03)), say["T03"]["t0"], 0.75)
    place(over, scream_fx(load("T04")), say["T04"]["t0"], 0.85)
    place(main, street_mic(load("T08"), 0.1), say["T08"]["t0"], 1.0)
    place(main, street_mic(scream_fx(load("T05")) * 0.9, 0.2), say["T05"]["t0"], 1.0)
    place(main, street_mic(load("T06"), 0.55), say["T06"]["t0"], 0.85)
    t07 = street_mic(scream_fx(load("T07")), 0.6)
    place(main, t07 * np.linspace(1.0, 0.25, len(t07)), say["T07"]["t0"], 0.5)

    # ---- 放送終了のオルゴール、カラーバー、砂嵐、テープの継ぎ目
    place(main, music(0.652), mk["music1"], 0.30)
    d = sc["bars"][0]
    place(main, fade(np.sin(2 * np.pi * 1000 * tt(d["t1"] - d["t0"])), 0.002, 0.002), d["t0"], 0.16)
    for k, d in enumerate(sc["snow"]):
        place(main, fade(bp(white(d["t1"] - d["t0"], 30 + k), 200, 10000), 0.002, 0.002), d["t0"], 0.30)
    for c in tl["cuts"]:
        place(main, fade(bp(white(0.35, int(c * 10)), 300, 9000), 0.002, 0.25), c, 0.22)
        place(main, thud(70, 0.12), c, 0.12)

    # ---- 臨時ニュースのチャイム
    place(main, reverb(chime_news(2), 0.8, 0.12), mk["chime_news1"], 0.42)
    place(main, reverb(chime_news(1), 0.8, 0.12), mk["chime_news2"], 0.42)

    # ---- 不穏な低音と、空の光の音（雨が止まってから、世界が止まるまで）
    d0, d1 = mk["street0"], mk["stop0"] + 2.0
    seg = tt(d1 - d0)
    drone = np.zeros_like(seg)
    for f, a in [(46.2, 1.0), (69.5, 0.7), (92.9, 0.6), (138.0, 0.6), (146.0, 0.5), (277.0, 0.2), (293.0, 0.17)]:
        drone += a * np.sin(2 * np.pi * f * seg + 3 * np.sin(2 * np.pi * 0.07 * seg + f))
    drone *= 0.5 + 0.5 * np.sin(2 * np.pi * 0.045 * seg) ** 2
    env = np.interp(seg + d0, [d0, d0 + 8, mk["sky0"], mk["sky1"], mk["vend0"], mk["bousai0"], mk["hijack0"], mk["storm0"], mk["storm1"], mk["stop0"]],
                    [0.0, 0.35, 0.45, 0.8, 0.3, 0.65, 0.9, 1.3, 0.5, 1.0])
    place(main, fade(drone * env, 0.0, 0.05), d0, 0.026)
    light = np.zeros_like(seg)
    for f, a in [(1046.5, 1.0), (1049.6, 1.0), (1567.0, 0.5), (1571.5, 0.5), (2093.0, 0.22)]:
        light += a * np.sin(2 * np.pi * f * seg)
    light *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.31 * seg)
    env = np.interp(seg + d0, [d0, d0 + 6, mk["sky0"], mk["sky0"] + 6, mk["sky1"] - 2, mk["sky1"], mk["vend0"] + 0.1, mk["bousai0"], mk["bousai0"] + 2, mk["hijack0"], mk["storm0"], mk["storm1"]],
                    [0.0, 0.10, 0.12, 0.45, 1.0, 0.8, 0.0, 0.0, 0.25, 0.18, 0.30, 0.0])
    place(main, fade(light * env, 0.0, 0.05), d0, 0.016)

    # ---- 防犯カメラ：自販機コーナー
    v0, v1 = mk["vend0"], mk["vend1"]
    seg = tt(v1 - v0)
    vh = (np.sin(2 * np.pi * 100 * seg) + 0.5 * np.sin(2 * np.pi * 200 * seg) + 0.3 * np.sin(2 * np.pi * 300 * seg)) * (0.9 + 0.1 * np.sin(2 * np.pi * 0.8 * seg))
    place(main, fade(vh * 0.02 + bp(white(v1 - v0, 41), 200, 1200) * 0.012, 0.05, 0.05), v0, 1.0)
    place(main, thud(85, 0.14), v0 + 0.7, 0.30)  # 缶が落ちてくる
    place(main, thud(120, 0.10), v0 + 0.79, 0.22)
    place(main, ping(2200, 42), v0 + 0.80, 0.10)
    for k in range(7):  # 逃げる足音
        place(main, footstep(50 + k, wet=False), mk["vend_run"] + 0.05 + k * 0.17, 0.30 - 0.03 * k, -0.2 - 0.1 * k)
    rng = np.random.default_rng(43)
    for k in range(9):  # 蹴とばされた缶
        place(main, ping(float(rng.uniform(1700, 4300)), 60 + k), mk["vend_run"] + 0.2 + float(rng.uniform(0, 0.9)), float(rng.uniform(0.05, 0.14)), float(rng.uniform(-0.6, 0.3)))

    # ---- 防災無線：チャイム、地面からの脈拍、そして乗っ取り
    place(main, outdoor(chime_bousai()), mk["chime_bousai"], 0.5)
    t = mk["bousai0"] + 12.0
    while t < mk["bousai_hj"] - 1.0:
        g = 0.10 * min(1.0, (t - mk["bousai0"] - 12.0) / 10.0 + 0.3)
        place(main, thud(55, 0.30), t, g)
        place(main, thud(49, 0.26), t + 0.27, g * 0.6)
        t += 1.18
    hjb = mk["bousai_hj"]
    place(main, outdoor(fade(bp(white(0.5, 46), 500, 3000), 0.0, 0.3)), hjb, 0.35)
    sq = tt(0.9)
    place(main, outdoor(fade(np.sin(2 * np.pi * (2300 * sq + 500 * sq ** 2)) * np.minimum(sq * 4, 1), 0.0, 0.25)), hjb + 0.25, 0.10)

    # ---- 電波ジャック：たずね人
    hj = mk["hijack0"]
    buzz = bp(np.sign(np.sin(2 * np.pi * 60 * tt(0.5))), 200, 4000)
    place(main, fade(buzz, 0.002, 0.3), hj, 0.16)
    place(main, fade(bp(white(0.5, 61), 500, 8000), 0.002, 0.35), hj, 0.25)
    carrier = bp(np.sign(np.sin(2 * np.pi * 60 * tt(mk["storm1"] - hj))), 150, 2500)
    place(main, fade(carrier, 1.0, 0.02), hj, 0.022)

    def type_blips(count: int, t0: float, cps: float, freq: float, gain: float = 0.05, buf=main, shape="sq") -> None:
        for k in range(count):
            place(buf, blip(freq * (1.0 if k % 2 == 0 else 1.5), 0.022, shape), t0 + k / cps, gain)

    type_blips(10, hj + 0.3, 14, 1568)
    for cnt, off in [(6, 1.6), (5, 2.3), (5, 3.0), (8, 4.8), (9, 5.8), (4, 6.8), (8, 7.4), (7, 9.0), (4, 10.2)]:
        type_blips(cnt, hj + off, 12, 1175, 0.045)
    place(main, swell(0.35, 800, 6000, 62), hj + 0.9, 0.12)  # 写真が出る

    # ---- さがしている：ノイズと声の嵐
    st0, st1 = mk["storm0"], mk["storm1"]
    sd = st1 - st0
    seg = tt(sd)
    k_env = np.clip(seg / 11.0, 0, 1) ** 1.2
    rng = np.random.default_rng(71)
    steps = rng.random(int(sd * 12) + 2)
    gate = np.interp(np.arange(len(seg)), np.linspace(0, len(seg), len(steps)), steps) ** 2
    bed = bp(white(sd, 72), 250, 9000) * gate * (0.05 + 0.12 * k_env)
    rise = np.zeros_like(seg)
    for f in (110, 147, 196, 220, 277, 330):
        ph = 2 * np.pi * np.cumsum(f * np.exp(seg / sd * math.log(2.3))) / SR
        rise += np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)
    rise = bp(rise, None, 3200) * (0.6 + 0.4 * np.sin(2 * np.pi * 6 * seg)) * (0.012 + 0.03 * k_env)
    storm = np.stack([bed + rise, np.roll(bed, 2400) + rise], axis=1)
    tb = st0
    while tb < st1 - 0.05:  # 地区を一つずつ消していく音
        place(storm, blip(900 + 60 * (tb - st0), 0.016), tb - st0, 0.035)
        tb += 0.09
    C = {k: load(k) for k in ["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10", "C11", "C12"]}
    y02 = load("Y02")
    chorus = [  # (声, 時刻, 音量, 左右, 逆再生, 高さ)
        ("C07", 0.2, 0.5, -0.8, False, 1.0), ("C08", 1.0, 0.5, 0.8, False, 1.0), ("Y", 1.7, 0.45, 0.0, False, 1.0),
        ("C05", 2.7, 0.7, 0.6, False, 1.0), ("C10", 4.3, 0.55, -0.6, False, 1.0), ("C06", 5.2, 0.6, 0.5, False, 1.0),
        ("C04", 6.1, 0.6, -0.3, False, 1.0), ("C05", 6.6, 0.7, -0.7, False, 0.9), ("C01", 8.1, 0.6, 0.4, False, 1.0),
        ("C11", 8.3, 0.5, -0.9, False, 1.0), ("C09", 9.0, 0.6, -0.5, False, 1.0), ("C03", 9.7, 0.65, 0.7, False, 1.0),
        ("C02", 12.0, 0.7, 0.0, False, 1.0), ("C12", 12.1, 0.55, 0.9, False, 1.0), ("C05", 12.9, 0.7, 0.2, False, 1.1),
        ("Y", 14.4, 0.7, 0.0, False, 1.0), ("C06", 14.6, 0.5, -0.8, False, 1.12), ("C04", 15.2, 0.5, 0.8, False, 0.92),
        ("C01", 3.0, 0.3, 0.9, True, 0.8), ("C02", 6.0, 0.3, -0.9, True, 1.2), ("C11", 13.0, 0.35, 0.6, True, 0.85),
        ("C12", 14.9, 0.4, -0.6, True, 1.0), ("C07", 10.4, 0.4, 0.3, True, 1.15), ("C08", 15.4, 0.45, 0.0, False, 1.25),
    ]
    for k, (cid, t0, g, pan, rev, ratio) in enumerate(chorus):
        src = y02 if cid == "Y" else C[cid]
        place(storm, ghost(src, 100 + k, rev, ratio), t0, g * 0.5, pan)
    from scenes2 import BIG  # 画面いっぱいの文字が出る瞬間

    for t0, dd, _, _, scale in BIG:
        place(storm, thud(48, 0.3), t0, 0.35)
        place(storm, fade(bp(white(dd, int(t0 * 10)), 200, 7000), 0.002, dd * 0.7), t0, 0.22)
    for t0 in (9.4, 15.95):  # 砂嵐の奥の目
        sw = tt(0.14)
        place(storm, fade(np.sin(2 * np.pi * (2400 + 3000 * sw) * sw), 0.002, 0.05), t0, 0.16)
        place(storm, thud(40, 0.4), t0, 0.5)
    # 街頭カメラの一瞬：嵐が遠のき、走る足音と息だけになる。婚姻届の一瞬は鐘
    duck = np.ones(len(seg))
    for i in range(3):
        f0 = mk[f"flash{i}"] - st0
        duck[_n(f0) : _n(f0 + 0.95)] = 0.18
    ff = mk["form_flash"] - st0
    duck[_n(ff) : _n(ff + 0.8)] = 0.3
    storm[: len(duck)] *= np.convolve(duck, np.ones(240) / 240, mode="same")[:, None]
    for i in range(3):
        f0 = mk[f"flash{i}"] - st0
        for j in range(6):
            place(storm, footstep(200 + i * 10 + j), f0 + 0.04 + j * 0.155, 0.32, (-0.6 + 0.24 * j) * (1 if i != 1 else -1))
        place(storm, breath(0.95, 3.2, 210 + i, 0.6, 0.3), f0, 0.55)
    place(storm, bell(1318.5, 1.2, 0.5), ff, 0.22)
    place(storm, bell(1046.5, 1.2, 0.5), ff + 0.22, 0.22)
    storm *= np.minimum(1.0, (sd - seg) / 0.03)[:, None]  # ぷつりと切れる
    i0 = _n(st0)
    main[i0 : i0 + len(storm)] += 1.3 * storm[: max(0, n - i0)]

    # ---- このテレビの前：部屋
    he, r0m = mk["here0"], mk["room0"]
    type_blips(10, he + 0.25, 9, 988, 0.05)
    place(main, fade(bp(white(0.4, 81), 300, 9000), 0.002, 0.3), r0m, 0.28)
    seg = tt(mk["stop0"] - r0m)
    place(main, (np.sin(2 * np.pi * 100 * seg) * 0.006 + bp(white(len(seg) / SR, 82), 150, 900) * 0.006), r0m, 1.0)
    hold0, found = mk["hold0"], mk["room_found"]
    b1 = breath(hold0 - (r0m + 0.3), 1.9, 300, 0.8, 0.10, swell_to=1.5)
    t3 = say["T03"]
    env = np.ones(len(b1))
    a, b = _n(t3["t0"] - (r0m + 0.3) - 0.1), _n(t3["t1"] - (r0m + 0.3) + 0.1)
    env[max(0, a) : b] = 0.25
    place(over, fade(b1 * np.convolve(env, np.ones(2400) / 2400, mode="same"), 0.3, 0.02), r0m + 0.3, 0.55)
    place(over, gasp(301), hold0 - 0.25, 0.5)  # 息をのんで、止める
    place(main, blip(330, 0.09), found, 0.07)
    place(main, blip(247, 0.14), found + 0.12, 0.07)
    place(over, gasp(302), found + 0.25, 0.75)
    f0, y05, y06, y07, sc0, rel = mk["freeze0"], mk["y05"], mk["y06"], mk["y07"], mk["scream0"], mk["release0"]
    b2 = breath(y05 - (found + 0.6), 2.9, 303, 0.9, 0.22, swell_to=1.3)
    place(over, fade(b2, 0.0, 0.05), found + 0.6, 0.70)
    place(over, gasp(304), y05 + 0.55, 0.6)
    b3 = breath(sc0 - (y06 - 0.3), 3.3, 305, 1.0, 0.45, swell_to=1.6)
    place(over, fade(b3, 0.2, 0.0), y06 - 0.3, 0.50)
    hb = heartbeat(sc0 - hold0, 0.56, 0.36)
    place(over, hb * np.linspace(0.5, 1.0, len(hb)), hold0, 0.16)

    # ---- 世界が止まる
    sweep_t = tt(mk["freeze0"] - mk["stop0"])
    u = sweep_t / sweep_t[-1]
    place(over, fade(np.sin(2 * np.pi * np.cumsum(420 * (1 - u) ** 2 + 30) / SR), 0.02, 0.1), mk["stop0"], 0.07)
    tick = bp(white(0.012, 71), 300, 2500) * np.linspace(1, 0, _n(0.012))
    for k in range(18):
        place(over, tick, mk["fz_text1"] + k / 6.5, 0.20)
        place(over, thud(180, 0.05), mk["fz_text1"] + k / 6.5, 0.035)
    place(over, swell(1.3, 250, 2400, 72), mk["fz_eyes_open"] - 0.4, 0.16)
    place(over, bell(1760, 3.5, 2.2, ((1.0, 1.0, 1.0), (2.005, 0.4, 0.7))), mk["fz_eyes_open"] + 0.9, 0.035)
    sw = tt(1.0)
    place(over, fade(np.sin(2 * np.pi * (2200 * sw + 450 * sw ** 2)) * np.linspace(0, 1, len(sw)) ** 2, 0.0, 0.05), mk["fz_look3"], 0.014)
    seg = tt(sc0 - (f0 + 1.0))
    sub = np.zeros_like(seg)
    for f, a in [(41.0, 1.0), (82.5, 0.8), (123.4, 0.55), (165.0, 0.25)]:
        sub += a * np.sin(2 * np.pi * f * seg)
    place(over, sub * np.interp(seg, [0, 4.0, seg[-1]], [0.0, 0.7, 1.0]) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.4 * seg)), f0 + 1.0, 0.05)

    # ---- 悲鳴とともに動きだす
    crash = bp(white(0.9, 81), 150, 10000) * decay(0.9, 0.22)
    place(over, crash, rel, 0.5)
    place(over, thud(50, 0.4), rel, 0.4)

    # ---- 防犯カメラ：つかまる
    c0, hit, fall, dg0, dg1, c1 = mk["capture0"], mk["cap_hit"], mk["cap_fall"], mk["drag0"], mk["drag1"], mk["capture1"]
    t = c0 + 0.1
    k = 0
    while t < hit:  # 走ってくる足音。だんだん近く
        u = (t - c0) / (hit - c0)
        place(main, footstep(400 + k), t, 0.12 + 0.28 * u, 0.3 - 0.2 * u)
        t += 0.172 * (1 + 0.06 * math.sin(k * 1.7))
        k += 1
    br = breath(hit - c0, 3.1, 401, 0.7, 0.3, swell_to=2.2)
    place(main, street_mic(br, 0.2), c0, 0.40)
    for j in range(5):  # 糸
        place(main, whip(410 + j), hit - 0.22 + j * 0.05, 0.38, -0.8 + 0.4 * j)
    place(main, thud(70, 0.3), fall, 0.55)
    place(main, bp(white(0.12, 420), 300, 3000) * decay(0.12, 0.03), fall, 0.3)
    place(main, street_mic(gasp(421) * 1.5, 0.1), fall + 0.02, 0.6)
    place(main, ping(1500, 422), fall + 0.12, 0.10, 0.4)  # ヘッドホンが落ちる
    place(main, ping(2400, 423), fall + 0.26, 0.06, 0.45)
    br = breath(dg0 - (fall + 0.3), 3.4, 424, 1.0, 0.5)
    place(main, street_mic(br, 0.15), fall + 0.3, 0.45)
    for j in range(5):  # 巻きつく糸
        place(main, whip(430 + j), fall + 0.3 + j * 0.28, 0.16, 0.5 - 0.25 * j)
    sd2 = dg1 - dg0
    scr = scrape(sd2, 440)
    u = np.linspace(0, 1, len(scr))
    place(main, bp(scr, None, 2600) * (1 - 0.75 * u) + 0.0 * scr, dg0, 0.16, 0.1)
    place(main, bp(reverb(scr * u * (1 - u) * 2, 1.6, 0.8, seed=19), None, 1400)[: len(scr)], dg0, 0.10)
    place(main, fade(tinny_music(c1 - dg1 + 0.6), 0.6, 0.02), dg1 - 0.4, 0.14, 0.35)  # 路上のヘッドホン

    # ---- 婚姻届
    fm = mk["form0"]
    place(main, fade(bp(white(0.5, 450), 1500, 7000), 0.1, 0.3), fm + 0.05, 0.06)  # 紙の音
    y9 = say["Y09"]
    place(main, reverb(musicbox_note(NOTE["E5"] * 2, 1.6), 1.0, 0.25), y9["t1"] + 0.25, 0.10)
    place(main, reverb(musicbox_note(NOTE["A4"] * 4, 2.0), 1.0, 0.25), y9["t1"] + 0.55, 0.10)

    # ---- 「みつけた」
    place(main, reverb(bell(880, 4.0, 2.4, ((1.0, 1.0, 1.0), (2.0, 0.3, 0.5), (3.0, 0.08, 0.3))), 1.6, 0.3), mk["hj_found"], 0.30)
    type_blips(7, mk["hj_bye"], 8, 660, 0.06, shape="sine")
    for k in range(5):
        place(main, blip(880 / (1 + 0.25 * k), 0.03, "sine"), mk["hj_clear"] + k * 0.05, 0.06)

    # ---- 雨。引きずられていく
    r_a, r_b = mk["rain0"], mk["snow2"]
    rr = rain(r_b - r_a)
    env = np.interp(tt(r_b - r_a) + r_a, [r_a, r_a + 0.6, r_b], [0.0, 1.0, 1.0])
    place(main, rr * env, r_a, 0.085)
    scr = scrape(r_b - r_a, 460)
    env = np.interp(tt(r_b - r_a) + r_a, [r_a, r_a + 1.0, r_b - 6.0, r_b], [0.0, 1.0, 0.7, 0.45])
    place(main, bp(scr, None, 1500) * env, r_a, 0.05, 0.1)
    brd = breath(say["T06"]["t0"] - (r_a + 1.0), 2.6, 461, 1.0, 0.6)
    place(main, street_mic(brd, 0.5), r_a + 1.0, 0.16)

    # ---- 停止ボタン
    place(over, thud(55, 0.3), mk["vcr_stop"], 0.3)
    place(over, fade(white(0.04, 91), 0.0, 0.03), mk["vcr_stop"] + 0.02, 0.12)

    # ---- 世界が止まる：stop0 から速度が落ち、freeze0 で完全に止まる。release0 まで無音
    def gate_main(t0: float, t1: float, fo: float = 0.01) -> None:
        i0, i1 = _n(t0), _n(t1)
        k = _n(fo)
        main[i0 : i0 + k] *= np.linspace(1, 0, k)[:, None]
        main[i0 + k : i1] = 0.0

    i0, i1 = _n(mk["stop0"]), _n(f0)
    m = i1 - i0
    rate = (1 - np.arange(m) / m) ** 1.3
    pos = np.cumsum(rate)
    for ch in (0, 1):
        src = main[i0 : i0 + int(pos[-1]) + 3, ch].copy()
        main[i0:i1, ch] = np.interp(pos, np.arange(len(src)), src) * (0.3 + 0.7 * rate)
    gate_main(f0, rel, 0.002)
    k = _n(0.3)
    main[_n(rel) : _n(rel) + k] *= np.linspace(0, 1, k)[:, None]
    gate_main(mk["vcr_stop"], dur + 1.0)

    # ---- 仕上げ：帯域を狭め、回転むらを付け、頭打ちにする
    mix = main + over
    out = np.zeros_like(mix)
    for ch in (0, 1):
        x = bp(mix[:, ch], 70, 10500)
        x = wow(x, 0.0012, 0.47, 0.0004)
        out[:, ch] = np.tanh(x * 1.5) / 1.5
    out *= 0.89 / np.abs(out).max()
    sf.write(out_wav, out[: _n(dur)].astype(np.float32), SR, subtype="PCM_16")


if __name__ == "__main__":
    import json
    import sys

    import timeline

    vd = sys.argv[1]
    tl = timeline.build(json.load(open(os.path.join(vd, "durations.json")))["durs"])
    build(tl, vd, sys.argv[2])
    x, _ = sf.read(sys.argv[2])
    print("audio", len(x) / SR, "s  peak", float(np.abs(x).max()))
