# -*- coding: utf-8 -*-
"""小さな MML (Music Macro Language) パーサ。

対応コマンド:
  c d e f g a b   音符。直後に + / # (シャープ)、- (フラット)、長さ、付点
  r               休符
  ^<len>          直前の音符/休符を伸ばす (タイ)。小節線をまたいでもよい
  o<n>  >  <      オクターブ指定 / 上げる / 下げる  (o4 の a = 440Hz)
  l<len>          既定の音長
  v<n>            音量 0..15
  q<n>            ゲート 1..8 (8 でレガート)
  @name           音色
  k<n>            移調 (半音。k-12 で 1 オクターブ下)
  _               次の音符へポルタメント
  [ ... ]n        n 回繰り返し
  |               小節線 (位置が小節の頭でなければエラー)
"""
from __future__ import annotations

import re
from dataclasses import dataclass

PPQ = 48                      # 4 分音符あたりの tick 数
WHOLE = PPQ * 4
MAX_GAP = 9                   # ゲートで切る長さの上限 (tick)

_NOTE_OFFSET = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}

_TOKEN = re.compile(
    r"""
    (?P<inst>@[A-Za-z_][A-Za-z0-9_]*)
  | (?P<note>[a-gr][+\#-]?)(?P<nlen>\d*)(?P<ndots>\.*)
  | (?P<tie>\^)(?P<tlen>\d*)(?P<tdots>\.*)
  | (?P<cmd>[olvqk])(?P<arg>[+-]?\d+)(?P<cdots>\.*)
  | (?P<up>>)
  | (?P<down><)
  | (?P<bar>\|)
  | (?P<slide>_)
    """,
    re.X,
)


@dataclass
class Ev:
    """1 つの発音イベント (tick 単位)。"""

    tick: int
    dur: int                 # 音符の長さ
    gate: int                # キーオンしている長さ
    pitch: float             # MIDI ノート番号 (noise は 0..15 の高さ)
    vol: int
    inst: str
    slide: bool = False
    lyric: str | None = None


def _expand_repeats(text: str) -> str:
    """[ ... ]n を展開する (入れ子可)。"""
    while True:
        m = re.search(r"\[([^\[\]]*)\](\d+)", text)
        if not m:
            if "[" in text or "]" in text:
                raise ValueError("unbalanced repeat brackets")
            return text
        text = text[: m.start()] + (m.group(1) + " ") * int(m.group(2)) + text[m.end():]


def _length(num: str, dots: str, default: int) -> int:
    if num:
        n = int(num)
        if WHOLE % n:
            raise ValueError("unsupported note length: %d" % n)
        base = WHOLE // n
    else:
        base = default
    total, add = base, base
    for _ in dots:
        add //= 2
        total += add
    return total


def parse(
    text: str,
    bar_ticks: int | None = None,
    total_ticks: int | None = None,
    transpose: int = 0,
    name: str = "",
) -> list[Ev]:
    """MML 文字列をイベント列に変換する。"""
    text = _expand_repeats(text)
    text = re.sub(r";[^\n]*", "", text)          # ; 以降はコメント
    pos = 0
    octave, deflen, vol, gate_q, inst, shift = 4, PPQ, 12, 7, "", 0
    slide_next = False
    events: list[Ev] = []
    last: Ev | None = None          # 直前の音符 (タイ用)
    last_end = 0
    i = 0
    while i < len(text):
        if text[i].isspace():
            i += 1
            continue
        m = _TOKEN.match(text, i)
        if not m:
            raise ValueError("%s: MML syntax error near %r" % (name, text[i: i + 24]))
        i = m.end()
        if m.group("inst"):
            inst = m.group("inst")[1:]
        elif m.group("note"):
            tok = m.group("note")
            dur = _length(m.group("nlen"), m.group("ndots"), deflen)
            if tok[0] == "r":
                last = None
            else:
                p = 12 * (octave + 1) + _NOTE_OFFSET[tok[0]]
                if len(tok) > 1:
                    p += 1 if tok[1] in "+#" else -1
                ev = Ev(pos, dur, 0, float(p + shift + transpose), vol, inst, slide_next)
                ev._q = gate_q                   # type: ignore[attr-defined]
                events.append(ev)
                last = ev
                slide_next = False
            pos += dur
            last_end = pos
        elif m.group("tie"):
            dur = _length(m.group("tlen"), m.group("tdots"), deflen)
            if last is not None and last_end == pos:
                last.dur += dur
            pos += dur
            last_end = pos
        elif m.group("cmd"):
            c, arg = m.group("cmd"), int(m.group("arg"))
            if c == "o":
                octave = arg
            elif c == "l":
                deflen = _length(str(arg), m.group("cdots"), deflen)
            elif c == "v":
                vol = max(0, min(15, arg))
            elif c == "q":
                gate_q = max(1, min(8, arg))
            elif c == "k":
                shift = arg
        elif m.group("up"):
            octave += 1
        elif m.group("down"):
            octave -= 1
        elif m.group("slide"):
            slide_next = True
        elif m.group("bar"):
            if bar_ticks and pos % bar_ticks:
                raise ValueError(
                    "%s: bar line at tick %d is %d ticks past bar %d"
                    % (name, pos, pos % bar_ticks, pos // bar_ticks + 1)
                )
    if total_ticks is not None and pos != total_ticks:
        raise ValueError(
            "%s: length is %d ticks (%.2f bars), expected %d"
            % (name, pos, pos / (bar_ticks or WHOLE), total_ticks)
        )
    for ev in events:
        q = ev._q                                # type: ignore[attr-defined]
        cut = 0 if q >= 8 else min(ev.dur * (8 - q) // 8, MAX_GAP * (8 - q))
        ev.gate = max(1, ev.dur - cut)
        del ev._q                                # type: ignore[attr-defined]
    return events
