"""映画「停波」を組み立てる。

    python3 build.py --work <作業フォルダ> --out 停波.mp4 [--backend openjtalk|voicevox]

手順：ナレーションを合成 → 長さから時間割を決める → 音を作る → 映像を描く → 1本にまとめる
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import picture  # noqa: E402
import sound  # noqa: E402
import timeline  # noqa: E402
import voice  # noqa: E402

_TL: dict = {}


def _init(tl: dict) -> None:
    global _TL
    _TL = tl


def _frame(i: int) -> bytes:
    return picture.render(_TL, i).tobytes()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--backend", default="openjtalk", choices=["openjtalk", "voicevox"])
    ap.add_argument("--reuse-voice", action="store_true", help="合成済みのナレーションを使い回す")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float, default=None)
    ap.add_argument("--scale", default="640:480")
    ap.add_argument("--crf", default="28")
    ap.add_argument("--x264", default="psy-rd=0.4,0")
    ap.add_argument("--maxrate", default="1900k")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 2)
    a = ap.parse_args()

    vdir = os.path.join(a.work, "voice")
    dj = os.path.join(vdir, "durations.json")
    if a.reuse_voice and os.path.exists(dj) and json.load(open(dj))["backend"] == a.backend:
        durs = json.load(open(dj))["durs"]
    else:
        print("ナレーションを合成しています…", flush=True)
        durs = voice.synth_all(vdir, a.backend)
    tl = timeline.build(durs)
    json.dump(tl, open(os.path.join(a.work, "timeline.json"), "w"), ensure_ascii=False, indent=1)
    print(f"長さ {tl['duration']:.1f} 秒", flush=True)

    wav = os.path.join(a.work, "audio.wav")
    print("音を作っています…", flush=True)
    sound.build(tl, vdir, wav)

    end = tl["duration"] if a.end is None else min(a.end, tl["duration"])
    f0, f1 = int(round(a.start * picture.FPS)), int(round(end * picture.FPS))
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{picture.W}x{picture.H}", "-r", str(picture.FPS), "-i", "-",
        "-ss", f"{a.start:.3f}", "-t", f"{end - a.start:.3f}", "-i", wav,
        "-vf", f"scale={a.scale}:flags=bicubic,setsar=1", "-c:v", "libx264", "-preset", "slow", "-crf", a.crf,
        *(["-x264-params", a.x264] if a.x264 else []),
        "-maxrate", a.maxrate, "-bufsize", "3800k",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", a.out,
    ]
    print(f"映像を描いています…（{f1 - f0} フレーム）", flush=True)
    t0 = time.time()
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with Pool(a.jobs, initializer=_init, initargs=(tl,)) as pool:
        for k, buf in enumerate(pool.imap(_frame, range(f0, f1), chunksize=6)):
            ff.stdin.write(buf)
            if k % 600 == 0:
                print(f"  {k}/{f1 - f0}  {time.time() - t0:.0f}s", flush=True)
    ff.stdin.close()
    ff.wait()
    print(f"できました：{a.out}（{os.path.getsize(a.out) / 1e6:.1f} MB, {time.time() - t0:.0f}s）", flush=True)


if __name__ == "__main__":
    main()
