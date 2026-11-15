"""音。ナレーション以外はすべてここで合成する（既存の音源・警報音は使わない）。"""
from __future__ import annotations

import os

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, sosfilt

from timeline import DISTRICTS_SLOW

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


def place(buf: np.ndarray, x: np.ndarray, t0: float, gain: float = 1.0) -> None:
    i0 = _n(t0)
    if i0 >= len(buf) or i0 + len(x) <= 0:
        return
    a = max(0, -i0)
    b = min(len(x), len(buf) - i0)
    buf[i0 + a : i0 + b] += x[a:b] * gain


def white(sec: float, seed: int) -> np.ndarray:
    return np.random.default_rng(seed).standard_normal(_n(sec))


def bell(freq: float, dur: float, decay: float = 0.9, partials=((1.0, 1.0, 1.0), (2.0, 0.45, 0.6), (3.01, 0.18, 0.35))) -> np.ndarray:
    """鐘・チャイムの音。partials: (倍率, 音量, 減衰の比)"""
    t = tt(dur)
    y = np.zeros_like(t)
    for mul, amp, dk in partials:
        y += amp * np.sin(2 * np.pi * freq * mul * t) * np.exp(-t / (decay * dk))
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


def reverb(x: np.ndarray, sec: float = 1.2, mix: float = 0.25, seed: int = 3) -> np.ndarray:
    ir = white(sec, seed) * np.exp(-tt(sec) / (sec / 4.5))
    ir = bp(ir, 300, 5000)
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


def music(beat: float, start_beat: int = 0, end_beat: int = 24, seed_phase: float = 0.0) -> np.ndarray:
    total = (end_beat - start_beat) * beat + 3.0
    buf = np.zeros(_n(total))
    for b, name in MELODY:
        if start_beat <= b < end_beat:
            place(buf, musicbox_note(NOTE[name] * 2), (b - start_beat) * beat, 0.5)
    for b, name in BASS:
        if start_beat <= b < end_beat:
            place(buf, musicbox_note(NOTE[name] * 2, 2.6), (b - start_beat) * beat, 0.3)
    buf = reverb(bp(buf, 200, 6500), 1.4, 0.22)
    return wow(buf, 0.006, 0.55, 0.0015, seed_phase)


def chime_news(pairs: int) -> np.ndarray:
    buf = np.zeros(_n(pairs * 1.1 + 1.2))
    for k in range(pairs):
        place(buf, bell(NOTE["E5"], 1.0, 0.55), k * 1.1, 0.6)
        place(buf, bell(NOTE["C5"], 1.2, 0.65), k * 1.1 + 0.5, 0.6)
    return buf


def chime_bousai() -> np.ndarray:
    buf = np.zeros(_n(3.4))
    for k, name in enumerate(["C5", "E5", "G5", "C6"]):
        place(buf, bell(NOTE[name], 1.6, 0.8, ((1.0, 1.0, 1.0), (4.0, 0.15, 0.3))), k * 0.52, 0.55)
    return buf


def outdoor(x: np.ndarray) -> np.ndarray:
    """屋外のラッパ形スピーカー。遠くの塔からも遅れて届くので、何重にもこだまする。"""
    x = np.tanh(bp(x, 380, 3000, 3) * 3.0) * 0.5
    taps = [(0.0, 1.0, 3000), (0.37, 0.58, 2200), (0.83, 0.40, 1700), (1.42, 0.26, 1300), (2.10, 0.16, 1000)]
    out = np.zeros(len(x) + _n(2.6))
    for delay, gain, lp in taps:
        place(out, bp(x, None, lp), delay, gain)
    return reverb(out, 1.0, 0.15, seed=9)


def tv_voice(x: np.ndarray) -> np.ndarray:
    """テレビのスピーカーから出るアナウンサーの声。"""
    return np.tanh(bp(x, 130, 7000) * 1.6) * 0.62


def blip(freq: float, dur: float = 0.022, shape: str = "sq") -> np.ndarray:
    t = tt(dur)
    y = np.sign(np.sin(2 * np.pi * freq * t)) if shape == "sq" else np.sin(2 * np.pi * freq * t)
    return fade(y, 0.001, 0.006)


def rain(sec: float, seed: int = 21) -> np.ndarray:
    rng = np.random.default_rng(seed)
    x = bp(white(sec, seed), 900, 9000) * 0.6 + bp(white(sec, seed + 1), 150, 900) * 0.35
    drops = np.zeros(_n(sec))
    for _ in range(int(sec * 55)):  # 近くに落ちる粒
        i = int(rng.integers(0, len(drops) - 400))
        f = float(rng.uniform(1800, 5200))
        n = int(rng.integers(120, 380))
        drops[i : i + n] += np.sin(2 * np.pi * f * np.arange(n) / SR) * np.exp(-np.arange(n) / (n / 4)) * float(rng.uniform(0.2, 1.0))
    slow = 0.85 + 0.15 * np.sin(2 * np.pi * 0.11 * tt(sec))
    return (x + 0.5 * drops) * slow


def thud(freq: float = 62.0, dur: float = 0.25) -> np.ndarray:
    t = tt(dur)
    y = np.sin(2 * np.pi * freq * t * (1 + 0.6 * np.exp(-t / 0.03))) * np.exp(-t / (dur / 4))
    y += 0.5 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t / (dur / 6))
    return fade(y, 0.001, 0.02)


def swell(sec: float, lo: float, hi: float, seed: int, rising: bool = True) -> np.ndarray:
    env = np.exp(-(1 - np.linspace(0, 1, _n(sec))) * 5.0)
    x = bp(white(sec, seed), lo, hi) * env
    return x if rising else x[::-1]


# =============================================================== 本体
def build(tl: dict, voice_dir: str, out_wav: str) -> None:
    mk = tl["marks"]
    dur = tl["duration"]
    n = _n(dur + 1.0)
    main = np.zeros(n)  # 放送の音＋テープの音。テープが止まると一緒に止まる
    over = np.zeros(n)  # 止まっている間だけ聞こえる音
    sc = {}
    for s in tl["scenes"]:
        sc.setdefault(s["name"], []).append(s)

    # ---- テープのヒスとハム（再生している間ずっと）
    t_all = np.arange(n) / SR
    hiss = bp(white(n / SR, 1), 2000, 12000) * 0.010 + white(n / SR, 2) * 0.0025
    hum = 0.006 * np.sin(2 * np.pi * 60 * t_all) + 0.003 * np.sin(2 * np.pi * 120 * t_all) + 0.0015 * np.sin(2 * np.pi * 180 * t_all)
    tape_on = np.zeros(n)
    tape_on[_n(0.35) : _n(mk["vcr_stop"])] = 1.0
    main += (hiss + hum) * tape_on
    place(main, thud(58, 0.3) + 0.4 * np.pad(white(0.05, 5), (0, _n(0.25)))[: _n(0.3)], 0.05, 0.35)  # 再生ボタン

    # ---- ナレーション
    for s in tl["says"]:
        wav, sr = sf.read(os.path.join(voice_dir, s["id"] + ".wav"), dtype="float64")
        assert sr == SR
        if s["voice"] == "B":
            place(main, outdoor(wav), s["t0"], 0.55)
        elif s["id"] in ("A17", "A18", "A19"):
            # 妨害を受けて、声がとぎれ、にごる
            rng = np.random.default_rng(int(s["id"][1:]))
            gate = np.repeat((rng.random(len(wav) // 2400 + 1) > 0.22).astype(float), 2400)[: len(wav)]
            gate = np.convolve(gate, np.ones(480) / 480, mode="same")
            v = tv_voice(wav)
            ring = v * (0.55 + 0.45 * np.sin(2 * np.pi * 47 * np.arange(len(v)) / SR))
            buzz = bp(np.sign(np.sin(2 * np.pi * 60 * np.arange(len(v)) / SR)), 300, 3500) * 0.05
            place(main, ring * (0.25 + 0.75 * gate) + buzz * (1 - gate), s["t0"], 0.95)
        else:
            place(main, tv_voice(wav), s["t0"], 1.0)

    # ---- 放送終了のオルゴール
    place(main, music(0.652), mk["music1"], 0.30)
    m2 = music(0.74, 12, 24, 1.3)
    place(main, fade(m2, 1.5, 0.0), mk["music2"], 0.26)

    # ---- カラーバーの1kHz、砂嵐
    for name, d in (("bars1", sc["bars"][0]), ("bars2", sc["bars"][1])):
        place(main, fade(np.sin(2 * np.pi * 1000 * tt(d["t1"] - d["t0"])), 0.002, 0.002), d["t0"], 0.16)
    for k, d in enumerate(sc["snow"]):
        place(main, fade(bp(white(d["t1"] - d["t0"], 30 + k), 200, 10000), 0.002, 0.002), d["t0"], 0.30)
    for c in tl["cuts"]:  # テープの継ぎ目
        place(main, fade(bp(white(0.35, int(c * 10)), 300, 9000), 0.002, 0.25), c, 0.22)
        place(main, thud(70, 0.12), c, 0.12)

    # ---- 臨時ニュースのチャイム
    place(main, reverb(chime_news(2), 0.8, 0.12), mk["chime_news1"], 0.42)
    place(main, reverb(chime_news(1), 0.8, 0.12), mk["chime_news2"], 0.42)

    # ---- 不穏な低音（雨が止まってから、見つかるまで）と、空の光の音
    d0, d1 = sc["street"][0]["t0"], mk["stop0"] + 2.0
    seg = tt(d1 - d0)
    drone = np.zeros_like(seg)
    for f, a in [(46.2, 1.0), (69.5, 0.7), (92.9, 0.6), (138.0, 0.6), (146.0, 0.5), (277.0, 0.2), (293.0, 0.17)]:
        drone += a * np.sin(2 * np.pi * f * seg + 3 * np.sin(2 * np.pi * 0.07 * seg + f))
    drone *= 0.5 + 0.5 * np.sin(2 * np.pi * 0.045 * seg) ** 2
    env = np.interp(seg + d0, [d0, d0 + 8, mk["sky0"], mk["sky1"], mk["bousai1"], mk["hijack0"], mk["stop0"]],
                    [0.0, 0.35, 0.45, 0.8, 0.65, 0.9, 1.2])
    place(main, fade(drone * env, 0.0, 0.05), d0, 0.026)

    light = np.zeros_like(seg)
    for f, a in [(1046.5, 1.0), (1049.6, 1.0), (1567.0, 0.5), (1571.5, 0.5), (2093.0, 0.22)]:
        light += a * np.sin(2 * np.pi * f * seg)
    light *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.31 * seg)
    env = np.interp(seg + d0, [d0, d0 + 6, mk["sky0"], mk["sky0"] + 6, mk["sky1"] - 2, mk["sky1"], mk["bousai0"] + 2, mk["hijack0"], mk["stop0"]],
                    [0.0, 0.10, 0.12, 0.45, 1.0, 0.8, 0.25, 0.18, 0.30])
    place(main, fade(light * env, 0.0, 0.05), d0, 0.016)

    # ---- 防災無線：チャイムと、地面からの脈拍
    place(main, outdoor(chime_bousai()), mk["chime_bousai"], 0.5)
    t = mk["bousai0"] + 12.0
    while t < mk["bousai1"] - 1.0:
        g = 0.10 * min(1.0, (t - mk["bousai0"] - 12.0) / 10.0 + 0.3)
        place(main, thud(55, 0.30), t, g)
        place(main, thud(49, 0.26), t + 0.27, g * 0.6)
        t += 1.18

    # ---- 電波ジャック
    hj = mk["hijack0"]
    buzz = bp(np.sign(np.sin(2 * np.pi * 60 * tt(0.5))), 200, 4000)
    place(main, fade(buzz, 0.002, 0.3), hj, 0.16)
    place(main, fade(bp(white(0.5, 61), 500, 8000), 0.002, 0.35), hj, 0.25)
    carrier = bp(np.sign(np.sin(2 * np.pi * 60 * tt(mk["stop0"] + 1.5 - hj))), 150, 2500)
    place(main, fade(carrier, 1.0, 0.05), hj, 0.022)  # ずっと鳴っている同期のうなり

    def type_blips(text_len: int, t0: float, cps: float, freq: float, gain: float = 0.05, buf=main, shape="sq"):
        for k in range(text_len):
            place(buf, blip(freq * (1.0 if k % 2 == 0 else 1.5), 0.022, shape), t0 + k / cps, gain)

    type_blips(10, mk["hj_title"], 14, 1568)
    type_blips(6, mk["hj_ask1"], 9, 1175)
    type_blips(7, mk["hj_ask2"], 9, 1175)
    for k, name in enumerate(DISTRICTS_SLOW):
        t0 = mk["hj_rows0"] + k * 1.05
        type_blips(len(name) + 3, t0, 16, 1319, 0.04)
        place(main, blip(392, 0.07), t0 + 0.62, 0.05)
    type_blips(10, mk["hj_here"], 9, 988)

    # ---- 止まっている間（over）
    f0, r0 = mk["freeze0"], mk["release0"]
    seg = tt(r0 - f0 - 1.2)
    sub = np.zeros_like(seg)
    for f, a in [(41.0, 1.0), (82.5, 0.8), (123.4, 0.55), (165.0, 0.25)]:
        sub += a * np.sin(2 * np.pi * f * seg)
    sub *= 0.8 + 0.2 * np.sin(2 * np.pi * 0.4 * seg)
    env = np.interp(seg, [0, 4.0, len(seg) / SR - 1.5, len(seg) / SR], [0.0, 0.7, 1.0, 1.0])
    place(over, sub * env, f0 + 1.2, 0.05)
    tick = bp(white(0.012, 71), 300, 2500) * np.linspace(1, 0, _n(0.012))
    for k in range(18):
        place(over, tick, mk["fz_text1"] + k / 6.5, 0.20)
        place(over, thud(180, 0.05), mk["fz_text1"] + k / 6.5, 0.035)
    for k in range(6):
        place(over, tick, mk["fz_text2"] + k / 5.0, 0.20)
        place(over, thud(180, 0.05), mk["fz_text2"] + k / 5.0, 0.035)
    place(over, swell(1.3, 250, 2400, 72), mk["fz_eyes_open"] - 0.4, 0.16)
    place(over, bell(1760, 3.5, 2.2, ((1.0, 1.0, 1.0), (2.005, 0.4, 0.7))), mk["fz_eyes_open"] + 0.9, 0.035)
    for name in ("fz_look1", "fz_look2", "fz_look3"):
        place(over, fade(bp(white(0.09, 73), 120, 700), 0.01, 0.06), mk[name], 0.20)
    sweep_t = tt(1.0)
    sweep = np.sin(2 * np.pi * (2200 * sweep_t + 450 * sweep_t ** 2)) * np.linspace(0, 1, len(sweep_t)) ** 2
    place(over, fade(sweep, 0.0, 0.05), mk["fz_look3"] + 0.2, 0.016)
    place(over, swell(0.8, 200, 1800, 74, rising=False), mk["fz_eyes_close"], 0.10)

    # ---- 動きだす
    crash = bp(white(0.9, 81), 150, 10000) * np.exp(-tt(0.9) / 0.22)
    place(over, crash, r0, 0.55)
    place(over, thud(50, 0.4), r0, 0.4)
    place(main, blip(392, 0.07), r0 + 0.45, 0.05)
    k = 0
    t = mk["hj_fast0"]
    while t < mk["hj_found"] - 0.02:
        place(main, blip(900 + 500 * (t - mk["hj_fast0"]), 0.018), t, 0.045)
        t += 0.085
        k += 1
    place(main, reverb(bell(880, 4.0, 2.4, ((1.0, 1.0, 1.0), (2.0, 0.3, 0.5), (3.0, 0.08, 0.3))), 1.6, 0.3), mk["hj_found"], 0.30)
    type_blips(7, mk["hj_bye"], 8, 660, 0.06, shape="sine")
    for k in range(5):
        place(main, blip(880 / (1 + 0.25 * k), 0.03, "sine"), mk["hj_clear"] + k * 0.05, 0.06)

    # ---- 雨
    r_a, r_b = mk["rain0"], sc["bars"][1]["t0"]
    rr = rain(r_b - r_a)
    env = np.interp(tt(r_b - r_a) + r_a, [r_a, r_a + 0.6, mk["rain1"] - 0.5, mk["rain1"] + 1.5, r_b], [0.0, 1.0, 1.0, 0.35, 0.3])
    place(main, rr * env, r_a, 0.085)

    # ---- 停止ボタン
    place(over, thud(55, 0.3), mk["vcr_stop"], 0.3)
    place(over, fade(white(0.04, 91), 0.0, 0.03), mk["vcr_stop"] + 0.02, 0.12)

    # ---- 無音にする区間：放送が終わった後の「何もない」ところ
    def gate(buf, t0, t1, fo=0.01):
        i0, i1 = _n(t0), _n(t1)
        k = _n(fo)
        buf[i0 : i0 + k] *= np.linspace(1, 0, k)
        buf[i0 + k : i1] = 0.0

    # 「みつけた」の瞬間、うなりが消える（鐘とヒスだけが残る）
    # テープが止まる：stop0 から速度が落ち、freeze0 で完全に止まる
    i0, i1 = _n(mk["stop0"]), _n(f0)
    m = i1 - i0
    rate = (1 - np.arange(m) / m) ** 1.3
    pos = np.cumsum(rate)
    src = main[i0 : i0 + int(pos[-1]) + 3].copy()
    main[i0:i1] = np.interp(pos, np.arange(len(src)), src) * (0.3 + 0.7 * rate)
    gate(main, f0, r0, 0.002)
    main[_n(r0) : _n(r0) + _n(0.3)] *= np.linspace(0, 1, _n(0.3))
    gate(main, mk["vcr_stop"], dur + 1.0)

    # ---- 仕上げ：帯域を狭め、回転むらを付け、頭打ちにする
    mix = main + over
    mix = bp(mix, 70, 10500)
    mix = wow(mix, 0.0012, 0.47, 0.0004)
    mix = np.tanh(mix * 1.5) / 1.5
    mix *= 0.89 / np.abs(mix).max()
    sf.write(out_wav, np.stack([mix, mix], axis=1)[: _n(dur)].astype(np.float32), SR, subtype="PCM_16")


if __name__ == "__main__":
    import json
    import sys

    import timeline

    vd = sys.argv[1]
    tl = timeline.build(json.load(open(os.path.join(vd, "durations.json")))["durs"])
    build(tl, vd, sys.argv[2])
    x, _ = sf.read(sys.argv[2])
    print("audio", len(x) / SR, "s  peak", float(np.abs(x).max()))
