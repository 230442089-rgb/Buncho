# -*- coding: utf-8 -*-
"""曲データの入れ物 (Section / Song) と、ステム (チャンネル別音声) のレンダリング。"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from . import mml
from .mml import Ev, PPQ, WHOLE
from .synth import ISR, SR, Inst, render_note

CHANNELS = ["P1", "P2", "TRI", "NOI", "DMC", "V1", "V2", "SAW"]


class Section:
    """曲の 1 区間。拍子・移調・テンポを区間ごとに持てる。"""

    def __init__(self, name, bars, meter=(4, 4), shift=0, bpm=None, label=None, key=""):
        self.name = name
        self.label = label or name
        self.key = key                # 表示用の調の名前
        self.bars = bars
        self.meter = meter
        self.bar_ticks = meter[0] * WHOLE // meter[1]
        self.ticks = bars * self.bar_ticks
        self.shift = shift            # 移調 (半音)
        self.bpm = bpm                # None / 数値 / [(tick, bpm), ...] (線形補間)
        self.tracks: dict[str, list[Ev]] = {}
        self.lyric_lines: list[tuple[str, list[str]]] = []
        self.chords: list[tuple[int, int, str]] = []   # (tick, 長さ, コード名) 解析用

    # -- トラックの追加 ----------------------------------------------------
    def mml(self, ch: str, text: str, shift: int | None = None) -> list[Ev]:
        """MML でトラックを書く。小節線と全体の長さを検査する。"""
        evs = mml.parse(
            text,
            bar_ticks=self.bar_ticks,
            total_ticks=self.ticks,
            transpose=self.shift if shift is None else shift,
            name="%s/%s" % (self.name, ch),
        )
        self.tracks.setdefault(ch, []).extend(evs)
        return evs

    def add(self, ch: str, events: list[Ev]) -> None:
        for e in events:
            if not (0 <= e.tick < self.ticks):
                raise ValueError("%s/%s: event at tick %d is outside the section" % (self.name, ch, e.tick))
        self.tracks.setdefault(ch, []).extend(events)

    def lyrics(self, lines: list[tuple[str, str]]) -> None:
        """歌詞。各行は (表示用テキスト, モーラを空白で区切ったかな)。P1 の音符と 1:1 対応。"""
        self.lyric_lines = [(disp, kana.split()) for disp, kana in lines]


@dataclass
class Channel:
    gain: float = 1.0
    pan: float = 0.0          # -1 (左) .. +1 (右)
    delay: float = 0.0        # ディレイへの送り量
    reverb: float = 0.0       # リバーブへの送り量


class Song:
    def __init__(self, title: str, artist: str, bpm: float, insts: dict[str, Inst], mix: dict[str, Channel]):
        self.title = title
        self.artist = artist
        self.bpm = bpm
        self.insts = insts
        self.mix = mix
        self.sections: list[tuple[Section, int]] = []
        self.total_ticks = 0
        self.fx: list[tuple] = []         # ("名前", 引数...) 時刻は tick で持つ
        self._tick_time: np.ndarray | None = None

    def append(self, sec: Section) -> int:
        """区間を末尾に追加し、その開始 tick を返す。"""
        start = self.total_ticks
        self.sections.append((sec, start))
        self.total_ticks += sec.ticks
        self._tick_time = None
        return start

    # -- 時間 ----------------------------------------------------------------
    def _build_time(self) -> np.ndarray:
        dts = []
        for sec, _ in self.sections:
            bpm = sec.bpm if sec.bpm is not None else self.bpm
            ticks = np.arange(sec.ticks)
            if isinstance(bpm, (int, float)):
                b = np.full(sec.ticks, float(bpm))
            else:
                xs = [p[0] for p in bpm]
                ys = [p[1] for p in bpm]
                b = np.interp(ticks, xs, ys)
            dts.append(60.0 / (b * PPQ))
        return np.concatenate([[0.0], np.cumsum(np.concatenate(dts))])

    def time(self, tick) -> float:
        """tick → 秒。曲の終わりより後ろは最後のテンポで外挿する。"""
        if self._tick_time is None:
            self._tick_time = self._build_time()
        tt = self._tick_time
        if tick <= self.total_ticks:
            lo = int(np.floor(tick))
            fr = tick - lo
            if fr == 0 or lo >= self.total_ticks:
                return float(tt[lo])
            return float(tt[lo] + fr * (tt[lo + 1] - tt[lo]))
        return float(tt[-1] + (tick - self.total_ticks) * (tt[-1] - tt[-2]))

    @property
    def duration(self) -> float:
        return self.time(self.total_ticks)

    # -- イベント ------------------------------------------------------------
    def channel_events(self, ch: str) -> list[Ev]:
        """曲全体を通した、あるチャンネルのイベント列 (tick は曲頭から)。"""
        out: list[Ev] = []
        for sec, start in self.sections:
            for e in sec.tracks.get(ch, []):
                out.append(Ev(e.tick + start, e.dur, e.gate, e.pitch, e.vol, e.inst, e.slide, e.lyric))
        out.sort(key=lambda e: e.tick)
        for a, b in zip(out, out[1:]):
            if a.tick == b.tick:
                raise ValueError("channel %s: two notes start at tick %d" % (ch, a.tick))
        return out

    def bar_starts(self) -> list[tuple[int, int, Section]]:
        """(開始 tick, 小節の長さ, 区間) を全小節ぶん返す。"""
        out = []
        for sec, start in self.sections:
            for b in range(sec.bars):
                out.append((start + b * sec.bar_ticks, sec.bar_ticks, sec))
        return out

    # -- レンダリング --------------------------------------------------------
    def render_stems(self, tail: float = 3.0, verbose: bool = True) -> dict[str, np.ndarray]:
        """各チャンネルを内部レートでレンダリングし、SR に落として返す。"""
        from .fx import decimate

        n = int((self.duration + tail) * ISR)
        stems: dict[str, np.ndarray] = {}
        for ch in CHANNELS:
            evs = self.channel_events(ch)
            buf = np.zeros(n, dtype=np.float32)
            prev_pitch = None
            for i, e in enumerate(evs):
                if e.inst not in self.insts:
                    raise KeyError("channel %s: unknown instrument %r" % (ch, e.inst))
                t_on = self.time(e.tick)
                t_off = self.time(e.tick + e.gate)
                t_next = self.time(evs[i + 1].tick) if i + 1 < len(evs) else t_on + 30.0
                y = render_note(
                    self.insts[e.inst],
                    e.pitch,
                    e.vol,
                    t_off - t_on,
                    t_next - t_on,
                    prev_pitch if e.slide else None,
                )
                i0 = int(round(t_on * ISR))
                m = min(len(y), n - i0)
                if m > 0:
                    buf[i0: i0 + m] += y[:m]
                prev_pitch = e.pitch
            stems[ch] = decimate(buf, ISR // SR)
            if verbose:
                rms = float(np.sqrt(np.mean(stems[ch] ** 2)))
                print("  %-3s %5d notes  rms %.4f  peak %.3f" % (ch, len(evs), rms, float(np.max(np.abs(stems[ch])))))
        return stems

    # -- 書き出し用の情報 ------------------------------------------------------
    def timeline(self) -> dict:
        """プレイヤー/解析用に、秒単位のノート・歌詞・区間情報をまとめる。"""
        notes = {}
        for ch in CHANNELS:
            notes[ch] = [
                [round(self.time(e.tick), 4), round(self.time(e.tick + e.gate) - self.time(e.tick), 4), e.pitch, e.vol]
                for e in self.channel_events(ch)
            ]
        sections = []
        lyrics = []
        for sec, start in self.sections:
            sections.append(
                {
                    "name": sec.name,
                    "label": sec.label,
                    "t0": round(self.time(start), 4),
                    "t1": round(self.time(start + sec.ticks), 4),
                    "meter": "%d/%d" % sec.meter,
                    "shift": sec.shift,
                    "key": sec.key,
                    "bars": sec.bars,
                }
            )
            if not sec.lyric_lines:
                continue
            lead = sorted(sec.tracks.get("P1", []), key=lambda e: e.tick)
            need = sum(len(k) for _, k in sec.lyric_lines)
            if need != len(lead):
                raise ValueError(
                    "%s: lyrics have %d morae but the lead has %d notes" % (sec.name, need, len(lead))
                )
            i = 0
            for disp, kana in sec.lyric_lines:
                evs = lead[i: i + len(kana)]
                i += len(kana)
                lyrics.append(
                    {
                        "text": disp,
                        "t0": round(self.time(start + evs[0].tick), 4),
                        "t1": round(self.time(start + evs[-1].tick + evs[-1].gate), 4),
                        "kana": [[round(self.time(start + e.tick), 4), k] for e, k in zip(evs, kana)],
                    }
                )
        bars = [round(self.time(t), 4) for t, _, _ in self.bar_starts()]
        fx = []
        for name, *args in self.fx:
            if name == "stutter":
                t0, t1 = args[2], args[2] + args[1] * args[3]
            elif name == "only_after":
                t0, t1 = args[0], self.total_ticks
            else:
                t0, t1 = args[0], args[1]
            fx.append({"type": name, "t0": round(self.time(t0), 4), "t1": round(self.time(t1), 4)})
        return {
            "title": self.title,
            "artist": self.artist,
            "bpm": self.bpm,
            "duration": round(self.duration, 4),
            "sections": sections,
            "bars": bars,
            "fx": fx,
            "lyrics": lyrics,
            "notes": notes,
        }
