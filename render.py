#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""曲をレンダリングして WAV / MP3 / タイムライン JSON を書き出す。

    python3 render.py                 # dist/kago.wav, .mp3, .mid, .json (タイムライン)
    python3 render.py --stems         # チャンネル別の WAV も dist/stems/ に書き出す
    python3 render.py --no-mp3        # ffmpeg を使わない
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import shutil
import subprocess
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from chip import fx, midi  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("song", nargs="?", default="kago", help="songs/ 以下のモジュール名")
    ap.add_argument("-o", "--out", default=os.path.join(HERE, "dist"))
    ap.add_argument("--stems", action="store_true", help="チャンネル別の WAV も書き出す")
    ap.add_argument("--no-mp3", action="store_true")
    args = ap.parse_args()

    t0 = time.time()
    song = importlib.import_module("songs." + args.song).build()
    os.makedirs(args.out, exist_ok=True)
    base = os.path.join(args.out, args.song)

    timeline = song.timeline()
    with open(base + ".json", "w", encoding="utf-8") as f:
        json.dump(timeline, f, ensure_ascii=False, separators=(",", ":"))
    midi.write_midi(song, base + ".mid")
    print("%s / %s  %.1f 秒 (%d:%02d)" % (song.title, song.artist, song.duration, song.duration // 60, song.duration % 60))

    stems = song.render_stems()
    mix = fx.master(fx.mixdown(song, stems))
    end = int((song.duration + 2.2) * fx.SR)
    mix = mix[:end]
    fade = int(0.4 * fx.SR)
    mix[-fade:] *= np.linspace(1.0, 0.0, fade)[:, None]
    fx.write_wav(base + ".wav", mix)
    rms = float(np.sqrt(np.mean(mix ** 2)))
    print("mix: peak %.3f  rms %.3f (%.1f dBFS)" % (float(np.max(np.abs(mix))), rms, 20 * np.log10(rms)))

    if args.stems:
        d = os.path.join(args.out, "stems")
        os.makedirs(d, exist_ok=True)
        peak = max(float(np.max(np.abs(x))) for x in stems.values())
        for ch, x in stems.items():
            y = (x[:end] / peak * 0.9).astype(np.float64)
            fx.write_wav(os.path.join(d, "%s_%s.wav" % (args.song, ch)), np.stack([y, y], axis=1))

    if not args.no_mp3:
        if shutil.which("ffmpeg") is None:
            print("ffmpeg が見つからないので MP3 は作りませんでした")
        else:
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", base + ".wav",
                 "-codec:a", "libmp3lame", "-q:a", "1",
                 "-metadata", "title=" + song.title, "-metadata", "artist=" + song.artist,
                 base + ".mp3"],
                check=True,
            )
    print("done in %.1fs → %s" % (time.time() - t0, args.out))


if __name__ == "__main__":
    main()
