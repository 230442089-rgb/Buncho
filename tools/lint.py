#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""譜面の点検。耳で確かめられない環境でも、和声上の事故を機械的に見つける。

  1. 主旋律の「拍頭にある・長い」音がコードの構成音かどうか
  2. 同時に鳴っている音どうしの半音/短9度のぶつかり (長く重なるものだけ)
  3. 各チャンネルの音域
"""
from __future__ import annotations

import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chip import PPQ  # noqa: E402

NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
PITCHED = ["P1", "P2", "TRI", "V1", "V2", "SAW"]


def nn(p: float) -> str:
    p = int(round(p))
    return "%s%d" % (NAMES[p % 12], p // 12 - 1)


def main() -> None:
    song = importlib.import_module("songs." + (sys.argv[1] if len(sys.argv) > 1 else "kago")).build()
    insts = song.insts

    print("== 音域 ==")
    for ch in PITCHED:
        ps = [e.pitch for e in song.channel_events(ch)]
        if ps:
            print("  %-3s %s .. %s  (%d notes)" % (ch, nn(min(ps)), nn(max(ps)), len(ps)))

    print("== 主旋律とコード (拍頭にある 4 分以上の非和声音) ==")
    for sec, start in song.sections:
        if not sec.chords:
            continue
        for e in sorted(sec.tracks.get("P1", []), key=lambda e: e.tick):
            if e.dur < PPQ or e.tick % PPQ:
                continue
            for tick, length, root, ivs, name in sec.chords:
                if tick <= e.tick < tick + length:
                    pcs = {(root + i) % 12 for i in ivs}
                    if int(e.pitch) % 12 not in pcs:
                        bar = e.tick // sec.bar_ticks + 1
                        print("  %-9s bar %2d  %-4s over %-7s (dur %d)" % (sec.name, bar, nn(e.pitch), name, e.dur))

    thr = int(sys.argv[2]) if len(sys.argv) > 2 else PPQ // 2
    print("== 半音のぶつかり (%d tick 以上重なるもの) ==" % thr)
    seen = 0
    for sec, start in song.sections:
        notes = []
        for ch in PITCHED:
            for e in sec.tracks.get(ch, []):
                inst = insts[e.inst]
                arps = sorted(set(inst.arp.body.tolist())) if (inst.arp is not None and inst.arp.loop is not None) else [0.0]
                for a in arps:
                    notes.append((e.tick, e.tick + e.gate, e.pitch + a, ch))
        notes.sort()
        for i, a in enumerate(notes):
            for b in notes[i + 1:]:
                if b[0] >= a[1]:
                    break
                if a[3] == b[3]:
                    continue
                ov = min(a[1], b[1]) - b[0]
                d = abs(a[2] - b[2])
                if ov >= thr and d % 12 in (1, 11):
                    bar = b[0] // sec.bar_ticks + 1
                    beat = (b[0] % sec.bar_ticks) / PPQ + 1
                    print("  %-9s bar %2d beat %.2f  %s:%s x %s:%s  (%d ticks)"
                          % (sec.name, bar, beat, a[3], nn(a[2]), b[3], nn(b[2]), ov))
                    seen += 1
    print("  計 %d 件" % seen)


if __name__ == "__main__":
    main()
