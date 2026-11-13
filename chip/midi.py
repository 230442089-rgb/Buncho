# -*- coding: utf-8 -*-
"""曲を Standard MIDI File (フォーマット 1) に書き出す。

DAW や歌声合成ソフトに持ち込むためのもの。音色はチップ音源そのものではなく
GM の近い楽器に置き換え、主旋律 (P1) には歌詞を 1 モーラずつリリックイベントで付ける。
"""
from __future__ import annotations

import struct

from .mml import PPQ
from .song import CHANNELS

RES = 480                      # 書き出す MIDI の分解能
SCALE = RES // PPQ

# チャンネル → (MIDI チャンネル, GM プログラム番号, トラック名)
_MELODIC = {
    "P1": (0, 80, "P1 lead (square)"),
    "P2": (1, 80, "P2 octave below / morse"),
    "TRI": (2, 38, "TRI bass (triangle)"),
    "V1": (3, 10, "V1 music box / arpeggio"),
    "V2": (4, 79, "V2 counter melody / chords"),
    "SAW": (5, 81, "SAW"),
}
# ドラムは GM のチャンネル 10 に寄せる
_DRUM_NOTE = {
    "kick": 36, "snr": 40, "snare": 38, "hat": 42, "ohat": 46, "crash": 49,
    "tomh": 50, "tomm": 47, "toml": 45, "tick": 37, "tock": 76, "click": 39, "riser": 55,
}


def _vlq(n: int) -> bytes:
    out = [n & 0x7F]
    n >>= 7
    while n:
        out.append((n & 0x7F) | 0x80)
        n >>= 7
    return bytes(reversed(out))


def _track(events: list[tuple[int, int, bytes]]) -> bytes:
    """(tick, 並び順, データ) のリストを 1 トラックにまとめる。"""
    events.sort(key=lambda e: (e[0], e[1]))
    body = bytearray()
    last = 0
    for tick, _, data in events:
        body += _vlq(tick - last) + data
        last = tick
    body += b"\x00\xff\x2f\x00"
    return b"MTrk" + struct.pack(">I", len(body)) + bytes(body)


def _meta(kind: int, data: bytes) -> bytes:
    return bytes([0xFF, kind]) + _vlq(len(data)) + data


def write_midi(song, path: str) -> None:
    tracks = []

    # ---- テンポと拍子 ----
    cond = [(0, 0, _meta(0x03, song.title.encode("utf-8")))]
    for sec, start in song.sections:
        bpm = sec.bpm if isinstance(sec.bpm, (int, float)) else song.bpm
        tempo = int(round(60_000_000 / bpm))
        cond.append((start * SCALE, 1, _meta(0x51, struct.pack(">I", tempo)[1:])))
        num, den = sec.meter
        cond.append((start * SCALE, 2, _meta(0x58, bytes([num, den.bit_length() - 1, 24, 8]))))
        cond.append((start * SCALE, 3, _meta(0x06, sec.label.encode("utf-8"))))
    tracks.append(_track(cond))

    # ---- 歌詞の割り当て (P1 の音符と 1:1) ----
    lyric_at: dict[int, str] = {}
    for sec, start in song.sections:
        if not sec.lyric_lines:
            continue
        lead = sorted(sec.tracks.get("P1", []), key=lambda e: e.tick)
        morae = [m for _, kana in sec.lyric_lines for m in kana]
        for e, m in zip(lead, morae):
            lyric_at[start + e.tick] = m

    # ---- 旋律のチャンネル ----
    for ch in CHANNELS:
        if ch not in _MELODIC:
            continue
        mch, prog, name = _MELODIC[ch]
        evs = [(0, 0, _meta(0x03, name.encode("utf-8"))), (0, 1, bytes([0xC0 | mch, prog]))]
        for e in song.channel_events(ch):
            inst = song.insts[e.inst]
            pitches = [int(round(e.pitch))]
            if inst.arp is not None and inst.arp.loop is not None:      # 高速アルペジオは和音として書く
                pitches = [int(round(e.pitch + a)) for a in sorted(set(inst.arp.body.tolist()))]
            vel = max(1, min(127, 30 + e.vol * 6))
            t0, t1 = e.tick * SCALE, (e.tick + e.gate) * SCALE
            if ch == "P1" and e.tick in lyric_at:
                evs.append((t0, 2, _meta(0x05, lyric_at[e.tick].encode("utf-8"))))
            for p in pitches:
                evs.append((t0, 3, bytes([0x90 | mch, p, vel])))
                evs.append((t1, 0, bytes([0x80 | mch, p, 0])))
        tracks.append(_track(evs))

    # ---- ドラム ----
    evs = [(0, 0, _meta(0x03, b"NOI + DMC (drums)"))]
    for ch in ("NOI", "DMC"):
        for e in song.channel_events(ch):
            note = _DRUM_NOTE.get(e.inst)
            if note is None:
                continue
            t0 = e.tick * SCALE
            evs.append((t0, 3, bytes([0x99, note, max(1, min(127, 30 + e.vol * 6))])))
            evs.append((t0 + RES // 8, 0, bytes([0x89, note, 0])))
    tracks.append(_track(evs))

    with open(path, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), RES))
        for t in tracks:
            f.write(t)
