#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""譜面と音声を画像にして確認するための道具。

    python3 tools/view.py roll  out.png [t0 t1]     # ピアノロール
    python3 tools/view.py spec  out.png [t0 t1]     # スペクトログラム (dist/kago.wav)
"""
from __future__ import annotations

import importlib
import os
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

COLORS = {
    "P1": (255, 90, 90), "P2": (255, 170, 90), "TRI": (90, 140, 255), "V1": (90, 220, 150),
    "V2": (200, 120, 255), "SAW": (240, 220, 80), "NOI": (150, 150, 150), "DMC": (255, 255, 255),
}
NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def roll(path: str, t0: float | None, t1: float | None, song_name: str = "kago") -> None:
    song = importlib.import_module("songs." + song_name).build()
    tl = song.timeline()
    t0 = 0.0 if t0 is None else t0
    t1 = tl["duration"] if t1 is None else t1
    row_s = 16.0                                # 1 段あたりの秒数
    rows = int(np.ceil((t1 - t0) / row_s))
    px = 100                                    # 1 秒あたりのピクセル
    lo, hi = 33, 100
    nh = 6                                      # 1 半音の高さ
    row_h = (hi - lo + 1) * nh + 46
    img = Image.new("RGB", (int(row_s * px) + 60, rows * row_h), (16, 16, 20))
    d = ImageDraw.Draw(img)
    for r in range(rows):
        a = t0 + r * row_s
        y0 = r * row_h + 16
        for p in range(lo, hi + 1):
            y = y0 + (hi - p) * nh
            if p % 12 == 0:
                d.line([(50, y + nh), (img.width, y + nh)], fill=(50, 50, 60))
                d.text((4, y - 3), "C%d" % (p // 12 - 1), fill=(120, 120, 130))
            elif p % 12 in (1, 3, 6, 8, 10):
                d.rectangle([50, y, img.width, y + nh - 1], fill=(22, 22, 28))
        for i, bt in enumerate(tl["bars"]):
            if a <= bt < a + row_s:
                x = 50 + (bt - a) * px
                d.line([(x, y0), (x, y0 + (hi - lo + 1) * nh)], fill=(70, 70, 85))
        for sec in tl["sections"]:
            if a <= sec["t0"] < a + row_s:
                x = 50 + (sec["t0"] - a) * px
                d.line([(x, y0 - 14), (x, y0 + (hi - lo + 1) * nh)], fill=(230, 230, 120))
                d.text((x + 3, y0 - 14), "%s %s +%d (%.1fs)" % (sec["name"], sec["meter"], sec["shift"], sec["t0"]), fill=(230, 230, 120))
        for ch in ("TRI", "SAW", "V2", "V1", "P2", "P1"):
            for t, dur, p, v in tl["notes"][ch]:
                if t + dur < a or t > a + row_s:
                    continue
                x0 = 50 + (t - a) * px
                x1 = 50 + (t + dur - a) * px
                y = y0 + (hi - p) * nh
                c = COLORS[ch]
                d.rectangle([x0, y, max(x0 + 1, x1 - 1), y + nh - 2], fill=c)
        yb = y0 + (hi - lo + 1) * nh + 4
        for ch, off in (("NOI", 0), ("DMC", 9)):
            for t, dur, p, v in tl["notes"][ch]:
                if a <= t < a + row_s:
                    x0 = 50 + (t - a) * px
                    h = 2 + int(v / 15 * 5)
                    d.rectangle([x0, yb + off + (7 - h), x0 + 3, yb + off + 7], fill=COLORS[ch])
        for ly in tl["lyrics"]:
            if a <= ly["t0"] < a + row_s:
                d.text((50 + (ly["t0"] - a) * px, yb + 18), "|" + str(len(ly["kana"])), fill=(200, 200, 200))
    img.save(path)
    print("wrote", path, img.size)


def spec(path: str, t0: float | None, t1: float | None, wav: str | None = None) -> None:
    wav = wav or os.path.join(ROOT, "dist", "kago.wav")
    with wave.open(wav, "rb") as w:
        sr = w.getframerate()
        nch = w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, nch).mean(axis=1) / 32768.0
    t0 = 0.0 if t0 is None else t0
    t1 = len(x) / sr if t1 is None else t1
    x = x[int(t0 * sr): int(t1 * sr)]
    nfft = 4096
    width = 1500
    hop = max(1, (len(x) - nfft) // width)
    win = np.hanning(nfft)
    frames = np.stack([x[i * hop: i * hop + nfft] * win for i in range(width)])
    mag = np.abs(np.fft.rfft(frames, axis=1))
    db = 20 * np.log10(mag / (nfft / 4) + 1e-9)
    freqs = np.fft.rfftfreq(nfft, 1 / sr)
    height = 600
    fy = np.geomspace(40, 20000, height)[::-1]
    idx = np.clip(np.searchsorted(freqs, fy), 0, len(freqs) - 1)
    im = db[:, idx].T                           # (height, width)
    im = np.clip((im + 90) / 80, 0, 1)
    rgb = np.stack([np.clip(im * 3, 0, 1), np.clip(im * 3 - 1, 0, 1), np.clip(im * 3 - 2, 0, 1)], axis=2)
    img = Image.fromarray((rgb * 255).astype(np.uint8))
    canvas = Image.new("RGB", (width + 60, height + 20), (0, 0, 0))
    canvas.paste(img, (60, 0))
    d = ImageDraw.Draw(canvas)
    for f in (50, 100, 200, 440, 880, 1760, 3520, 7040, 14080):
        y = int(np.argmin(np.abs(fy - f)))
        d.line([(55, y), (60, y)], fill=(255, 255, 255))
        d.text((2, y - 5), str(f), fill=(255, 255, 255))
    for k in range(11):
        t = t0 + (t1 - t0) * k / 10
        d.text((60 + width * k // 10 - (20 if k == 10 else 0), height + 4), "%.1f" % t, fill=(255, 255, 255))
    canvas.save(path)
    print("wrote", path, canvas.size)


if __name__ == "__main__":
    mode, out = sys.argv[1], sys.argv[2]
    a = float(sys.argv[3]) if len(sys.argv) > 3 else None
    b = float(sys.argv[4]) if len(sys.argv) > 4 else None
    (roll if mode == "roll" else spec)(out, a, b)
