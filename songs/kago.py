# -*- coding: utf-8 -*-
"""「籠」 ― 全て文鳥の所為です。

界隈曲の作法 (オルゴールの導入、淡々とした 8 分の歌メロ、セクションごとの転調、
7/8 拍子の間奏とグリッチ、モールス信号、サビ終わりの名義フレーズ、唐突な終わり方) を
ファミコン + VRC6 相当の 8 チャンネルで組んだオリジナル曲。

  P1  2A03 矩形波 1   主旋律 (歌)
  P2  2A03 矩形波 2   主旋律の 1 オクターブ下 / モールス信号
  TRI 2A03 三角波     ベース / 時報
  NOI 2A03 ノイズ     ハイハット・スネア / 時計の音
  DMC 2A03 ΔPCM      キック・タム
  V1  VRC6 矩形波 1   オルゴール・分散和音
  V2  VRC6 矩形波 2   対旋律 / 高速アルペジオの和音
  SAW VRC6 ノコギリ波 ベースの補強 / 持続音 / 合いの手
"""
from __future__ import annotations

from chip import PPQ, WHOLE, Channel, Ev, Inst, Macro, Section, Song

TITLE = "籠"
ARTIST = "全て文鳥の所為です。"
BPM = 152.0

KEYS = {0: "イ短調", 3: "ハ短調", 5: "ニ短調"}

S16 = PPQ // 4          # 16 分音符 (tick)
S8 = PPQ // 2           # 8 分音符
BEAT = PPQ
M = Macro


# ==========================================================================
# 音色
# ==========================================================================
def instruments() -> dict[str, Inst]:
    ins: dict[str, Inst] = {}

    # ---- 矩形波 ----
    ins["lead"] = Inst(                       # 歌。25% 矩形、遅れて掛かるビブラート
        "pulse", vol=M("13 15 14 13 | 12 / 9 6 4 2 1 0"), duty=M("0.25"),
        vib_depth=13, vib_rate=5.6, vib_delay=0.26, vib_fade=0.2,
    )
    ins["low"] = Inst(                        # 歌の 1 オクターブ下。細く、少しだけ高く外す
        "pulse", vol=M("11 12 | 11 / 8 5 3 1 0"), duty=M("0.125"), detune=6,
        vib_depth=13, vib_rate=5.6, vib_delay=0.26, vib_fade=0.2,
    )
    ins["riff"] = Inst(                       # 器楽リード。頭だけ細いデューティで弾く
        "pulse", vol=M("15 14 13 12 | 11 / 8 5 3 1 0"), duty=M("0.125 0.125 0.25"),
        vib_depth=10, vib_rate=6.0, vib_delay=0.22, vib_fade=0.15,
    )
    ins["bell"] = Inst(                       # オルゴール。頭 1 フレームだけ 1 オクターブ上
        "pulse", vol=M("15 13 11 10 9 8 7 6 6 5 5 4 4 4 3 3 3 2 2 2 2 1 1 1 1 1 0"),
        duty=M("0.125"), arp=M("12 0"),
    )
    ins["bell_sour"] = Inst(                  # 調子の外れたオルゴール
        "pulse", vol=M("15 13 11 10 9 8 7 6 6 5 5 4 4 4 3 3 3 2 2 2 2 1 1 1 1 1 0"),
        duty=M("0.125"), arp=M("12 0"), detune=-38,
    )
    ins["bell_fall"] = Inst(                  # ぜんまいが切れて音程が落ちていく
        "pulse", vol=M("15 13 12 11 10 10 9 9 8 8 7 7 6 6 6 5 5 5 4 4 4 3 3 3 3 2 2 2 2 2 1 1 1 1 1 1 0"),
        duty=M("0.125"),
        pit=M(" ".join(str(-int(0.9 * i ** 1.75)) for i in range(40))),
    )
    ins["pluck"] = Inst("pulse", vol=M("12 10 8 7 6 5 4 4 3 3 2 2 1 0"), duty=M("0.25"))
    ins["guide"] = Inst(                      # 対旋律。50% 矩形の笛のような音
        "pulse", vol=M("3 4 5 6 | 6 / 4 3 2 1 0"), duty=M("0.5"),
        vib_depth=10, vib_rate=5.2, vib_delay=0.35, vib_fade=0.3,
    )
    ins["morse"] = Inst("pulse", vol=M("10"), duty=M("0.5"))

    # ---- 三角波 / ノコギリ波 ----
    ins["tri"] = Inst("tri", vol=M("15"))
    ins["sawbass"] = Inst("saw", vol=M("12 11 10 9 8 7 | 6"))  # 三角波ベースに重ねる (倍音の補強)
    ins["drone"] = Inst("saw", vol=M("1 1 2 2 3 3 4 4 5 5 6 6 7 7 8 8 9 9 | 10 / 8 6 5 4 3 2 1 0"))
    ins["sawpluck"] = Inst("saw", vol=M("9 8 7 6 5 4 4 3 3 2 2 1 1 0"))

    # ---- ノイズ ----
    ins["hat"] = Inst("noise", vol=M("9 4 1 0"))
    ins["ohat"] = Inst("noise", vol=M("9 8 7 6 6 5 5 4 4 3 3 2 2 1 1 0"))
    ins["snare"] = Inst("noise", vol=M("15 14 12 10 8 7 6 5 4 3 3 2 2 1 1 0"), arp=M("-1 1 2"))
    ins["crash"] = Inst(
        "noise",
        vol=M("14 13 12 11 10 10 9 9 8 8 7 7 6 6 6 5 5 5 4 4 4 3 3 3 3 2 2 2 2 2 1 1 1 1 1 1 0"),
        arp=M("1 0"),
    )
    ins["tick"] = Inst("noise", vol=M("15 8 3 1 0"))
    ins["tock"] = Inst("noise", vol=M("15 8 3 1 0"))
    ins["click"] = Inst("noise", vol=M("13 9 4 2 0"), arp=M("0 4 -2"))      # 再生ボタン
    ins["riser"] = Inst(
        "noise",
        vol=M(" ".join(str(1 + i * 11 // 46) for i in range(47))),
        arp=M(" ".join(str(i * 9 // 46) for i in range(47))),
    )

    # ---- DMC ----
    for name, sample in (("kick", "kick"), ("snr", "snare"), ("tomh", "tom_h"), ("tomm", "tom_m"), ("toml", "tom_l")):
        ins[name] = Inst("dmc", sample=sample)
    return ins


MIX = {
    "P1": Channel(gain=1.00, pan=0.00, delay=0.16, reverb=0.10),
    "P2": Channel(gain=0.90, pan=0.14, delay=0.08, reverb=0.10),
    "TRI": Channel(gain=1.15, pan=0.00),
    "NOI": Channel(gain=0.85, pan=0.08, reverb=0.05),
    "DMC": Channel(gain=2.10, pan=0.00, reverb=0.03),
    "V1": Channel(gain=1.20, pan=-0.42, delay=0.30, reverb=0.18),
    "V2": Channel(gain=0.90, pan=0.42, delay=0.12, reverb=0.18),
    "SAW": Channel(gain=0.80, pan=0.00, reverb=0.05),
}


# ==========================================================================
# 和声まわりの道具
# ==========================================================================
_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
_QUAL = {
    "": (0, 4, 7), "m": (0, 3, 7), "7": (0, 4, 7, 10), "m7": (0, 3, 7, 10),
    "maj7": (0, 4, 7, 11), "mM7": (0, 3, 7, 11), "m6": (0, 3, 7, 9),
    "m7b5": (0, 3, 6, 10), "7sus4": (0, 5, 7, 10), "sus4": (0, 5, 7),
    "dim": (0, 3, 6), "aug": (0, 4, 8),
}


def chord(name: str, shift: int = 0) -> tuple[int, tuple[int, ...]]:
    """コード名 → (根音のピッチクラス, 構成音の音程)。"""
    root = _PC[name[0]]
    rest = name[1:]
    if rest[:1] == "b":
        root, rest = root - 1, rest[1:]
    elif rest[:1] == "#":
        root, rest = root + 1, rest[1:]
    return (root + shift) % 12, _QUAL[rest]


def harmony(spec: str, bar_ticks: int, shift: int = 0):
    """ "Am | Dm | Ab Bb | G7" → [(tick, 長さ, 根音, 音程, 名前)]。1 小節内は等分。"""
    out = []
    for b, bar in enumerate(spec.split("|")):
        names = bar.split()
        seg = bar_ticks // len(names)
        for i, nm in enumerate(names):
            root, ivs = chord(nm, shift)
            out.append((b * bar_ticks + i * seg, seg, root, ivs, nm))
    return out


def chord_at(harm, tick):
    for h in harm:
        if h[0] <= tick < h[0] + h[1]:
            return h
    raise ValueError("no chord at tick %d" % tick)


def tones(root: int, ivs, lo: int, n: int = 6) -> list[int]:
    """lo 以上でいちばん低い構成音から、上へ n 音。"""
    pcs = {(root + i) % 12 for i in ivs}
    out, p = [], lo
    while len(out) < n:
        if p % 12 in pcs:
            out.append(p)
        p += 1
    return out


def _rubs(p, tick, step, melody):
    """p が、同時に鳴っている旋律の音と (1 オクターブ程度の範囲で) 半音でぶつかるか。"""
    for e in melody:
        if e.tick < tick + step and e.tick + e.gate > tick:
            d = abs(p - e.pitch)
            if d <= 13 and d % 12 in (1, 11):
                return True
    return False


def arp(harm, bar_ticks, patterns, lo, inst, vol, step=S8, gate=None, melody=()):
    """分散和音。patterns は小節ごとの「構成音の番号 (None は休み)」のリスト。

    melody を渡すと、旋律と半音でぶつかる音は隣の構成音に差し替える
    (長7度や♭9 を歌っているあいだ、伴奏が根音を鳴らして濁るのを避ける)。
    """
    evs = []
    for b, pat in enumerate(patterns):
        if pat is None:
            continue
        for i, idx in enumerate(pat):
            if idx is None:
                continue
            tick = b * bar_ticks + i * step
            _, _, root, ivs, _ = chord_at(harm, tick)
            ts = tones(root, ivs, lo, 8)
            p = ts[idx]
            if melody and _rubs(p, tick, step, melody):
                for alt in (idx + 1, idx - 1, idx + 2, idx - 2):
                    if 0 <= alt < len(ts) and not _rubs(ts[alt], tick, step, melody):
                        p = ts[alt]
                        break
            v = vol[b] if isinstance(vol, (list, tuple)) else vol
            evs.append(Ev(tick, step, gate or step, float(p), v, inst))
    return evs


def bass(harm, bar_ticks, patterns, lo=36, step=S8, gate=None, inst="tri"):
    """ベース。R=根音 O=オクターブ上 5=5度上 a=次の根音に近い 5度 -=伸ばす .=休み。"""
    evs: list[Ev] = []
    for b, pat in enumerate(patterns):
        if pat is None:
            continue
        for i, tok in enumerate(pat.split()):
            tick = b * bar_ticks + i * step
            if tok == ".":
                continue
            if tok == "-":
                evs[-1].dur += step
                evs[-1].gate += step
                continue
            _, _, root, ivs, _ = chord_at(harm, tick)
            p = lo + (root - lo) % 12
            fifth = 6 if 6 in ivs else (8 if 8 in ivs else 7)
            if tok == "a":
                nxt = [h for h in harm if h[0] > tick]
                target = lo + (nxt[0][2] - lo) % 12 if nxt else p + fifth
                p = min((p + fifth + o for o in (-24, -12, 0, 12)), key=lambda c: abs(c - target))
            else:
                p += {"R": 0, "O": 12, "5": fifth}[tok]
            evs.append(Ev(tick, step, gate or step, float(p), 15, inst))
    return evs


def pads(ins, harm, lo, vol, bars=None, bar_ticks=WHOLE):
    """1 フレームごとに構成音を巡回する「チップチューンの和音」。"""
    evs = []
    for tick, length, root, ivs, _ in harm:
        b = tick // bar_ticks
        if bars is not None and b not in bars:
            continue
        name = "pad_" + "_".join(str(i) for i in ivs)
        if name not in ins:
            ins[name] = Inst(
                "pulse", vol=M("3 4 | 5 / 3 2 1 0"), duty=M("0.125"),
                arp=M("| " + " ".join(str(i) for i in ivs)),
            )
        p = lo + (root - lo) % 12
        v = vol[b] if isinstance(vol, (list, tuple)) else vol
        evs.append(Ev(tick, length, length - 6, float(p), v, name))
    return evs


# ---- ドラム -------------------------------------------------------------
_NOI = {
    "h": ("hat", 14, 9), "H": ("hat", 14, 12), "o": ("ohat", 14, 10),
    "s": ("snare", 9, 12), "S": ("snare", 9, 15), "g": ("snare", 9, 6),
    "c": ("crash", 12, 13), "x": ("tick", 13, 12), "y": ("tock", 11, 8), "p": ("click", 7, 12),
}
_DMC = {"k": ("kick", 15), "n": ("snr", 12), "t": ("tomh", 14), "m": ("tomm", 14), "l": ("toml", 14)}


def noise(patterns, bar_ticks, vscale=1.0, step=S16):
    evs = []
    for b, pat in enumerate(patterns):
        if pat is None:
            continue
        for i, c in enumerate(pat):
            if c == ".":
                continue
            tick = b * bar_ticks + i * step
            if c.isdigit():                       # 数字はスネアの音量 (ロール用)
                inst, pitch, v = "snare", 9, 4 + int(c)
            else:
                inst, pitch, v = _NOI[c]
                v = max(1, int(round(v * vscale)))
            evs.append(Ev(tick, BEAT * 2, BEAT * 2, float(pitch), v, inst))
    return evs


def dmc(patterns, bar_ticks, vscale=1.0, step=S16):
    evs = []
    for b, pat in enumerate(patterns):
        if pat is None:
            continue
        for i, c in enumerate(pat):
            if c == ".":
                continue
            inst, v = _DMC[c]
            evs.append(Ev(b * bar_ticks + i * step, BEAT, BEAT, 0.0, max(1, int(round(v * vscale))), inst))
    return evs


def clock(total_ticks, start=0, period=BEAT * 2, phase=0):
    """時計の音。2 拍ごとに「チッ」「タッ」を交互に鳴らす。"""
    evs = []
    k = phase
    for tick in range(start, total_ticks, period):
        inst, pitch, v = _NOI["x" if k % 2 == 0 else "y"]
        evs.append(Ev(tick, period, period, float(pitch), v, inst))
        k += 1
    return evs


_MORSE = {
    "A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", "F": "..-.", "G": "--.", "H": "....",
    "I": "..", "J": ".---", "K": "-.-", "L": ".-..", "M": "--", "N": "-.", "O": "---", "P": ".--.",
    "Q": "--.-", "R": ".-.", "S": "...", "T": "-", "U": "..-", "V": "...-", "W": ".--", "X": "-..-",
    "Y": "-.--", "Z": "--..",
}


def morse(text, start, unit, pitch, vol, inst="morse"):
    """欧文モールス。短点 = unit、長点 = 3 unit、文字間 = 3 unit、語間 = 7 unit。"""
    evs = []
    t = start
    for ch in text.upper():
        if ch == " ":
            t += 4 * unit
            continue
        for sym in _MORSE[ch]:
            n = unit if sym == "." else 3 * unit
            evs.append(Ev(t, n, n, float(pitch), vol, inst))
            t += n + unit
        t += 2 * unit
    return evs, t


# ==========================================================================
# 旋律 (すべてイ短調で書き、サビは区間ごとに移調する)
# ==========================================================================
# ---- サビ / リフの主題 --------------------------------------------------
THEME_1 = """l8
o4 e e a b >c4 <b a | a4. g f4 r4 |
o4 d d g a b4 a g   | g4. f e4 r4 |
o4 a a >c d e4 d c  | d4. c <b4 r4 |
o4 b b >c d e2      | f4 e4 r2 |
"""
THEME_2 = """l8
o4 e e a b >c4 <b a | a4. g f4 r4 |
o4 d d g a b4 a g   | g4. f e4 r4 |
o4 a a >c d e4 a g  | f4. e d4 r4 |
o4 b b b4 >c c <b a | b4 >d c <b2 |
"""
TAG_2BAR = "o4 a1 | ^2 r2 |"
TAG_1BAR = "o4 a2 r2 |"

RIFF = """l8
o5 e e a b >c4 <b a | a4. g f4 l16 d f a >d< l8 |
o5 d d g a b4 a g   | g4. f e4 l16 c e g >c< l8 |
o5 a a >c d e4 d c  | d4. c <b4 l16 b a f d l8 |
o5 b b >c d e2      | f4 e4 l16 e d c <b a g+ f e l8 |
"""
RIFF_78 = """l8
o5 e e a b >c4 <b | a4. g f4 l16 d a l8 |
o5 d d g a b4 a   | g4. f e4 l16 c g l8 |
o5 a a >c d e4 d  | d4. c <b4 l16 b f l8 |
o5 b b >c d e4.   | f4 e2 ^8 |
"""

# ---- A メロ (陰旋法: ラ シ ド ミ ファ) ----------------------------------
VERSE_HEAD = """l8
o4 a a b >c <b a f e    | e2 r2 |
o4 a a b >c e e c <b    | >c2 r2 |
o5 f f e c <b >c e c    | <b2 r2 |
"""
VERSE_OPEN = "o4 e e a b >c <b a a | g+2 r2 |"        # 半終止
VERSE_CLOSE = "o4 e e a b >c <b g+ b | a2 r2 |"       # 全終止

VERSE_ARP_HEAD = """l8
o4 a >e c e a e c e | <a >e c e g+ e c e | <a >e c e g e c e | <a >e c e f+ e c e |
o4 f >c <a >c f c <a >c | <f >d <b >d f d <b >d |
"""
VERSE_ARP_OPEN = "o4 e b a b >e <b a b | e b g+ b >e <b g+ b |"
VERSE_ARP_CLOSE = "o4 e b a b >e <b g+ b | a >e c e a e c e |"
VERSE_CHORDS_OPEN = "Am | AmM7 | Am7 | Am6 | Fmaj7 | Dm6 | E7sus4 | E7"
VERSE_CHORDS_CLOSE = "Am | AmM7 | Am7 | Am6 | Fmaj7 | Dm6 | E7sus4 E7 | Am"

# ---- B メロ -------------------------------------------------------------
PRE = """l8
o5 c4 c d c4. <a | >d4 d e d4. <b | >e4 e g e4. <b | >c4 <b a a2 |
o5 d4 d e f4. d  | f4 f g f4. d   | e-4 e- e- f4 f f | g2 r2 |
"""
PRE_CHORDS = "F | G | Em | Am | Dm | G7 | Ab Bb | G7"

# ---- C メロ (3/4、都節: ラ シ♭ レ ミ ファ) ------------------------------
BRIDGE = """l8
o4 a4 a b- a4 | a4 f e f4 | e4 f a b-4 | a2. |
o5 d4 d <b- a4 | b-4 a f e4 | f4 e d e4 | e2. |
"""

# ---- 落ちサビ (名義フレーズを倍の長さで) --------------------------------
OCHI = "o4 b4 b4 b2 | >c4 c4 <b4 a4 | b2 >d4 c4 | <b1 | a1 |"

CHORUS_CHORDS = (
    "Am | Dm | G | C | F | Bm7b5 | E7sus4 | E7 | "
    "Am | Dm | G | C | F | Bb | E7 | E7 | Am | Am"
)
RIFF_CHORDS = "Am | Dm | G | C | F | Bm7b5 | E7sus4 | E7"

# ==========================================================================
# 歌詞 (表示用, モーラ区切り)
# ==========================================================================
TITLE_LINE = ("全て文鳥の所為です。", "す べ て ぶ ん ちょ う の せ い で す")

LYR_VERSE1 = [
    ("錆び付いた扉の", "さ び つ い た と び ら の"),
    ("内側で啼くのは", "う ち が わ で な く の は"),
    ("夜明け前 忘れた", "よ あ け ま え わ す れ た"),
    ("名も知らぬ囀り", "な も し ら ぬ さ え ず り"),
    ("止まり木に残され", "と ま り ぎ に の こ さ れ"),
    ("白い羽 ひとひら", "し ろ い は ね ひ と ひ ら"),
    ("数えても足りない", "か ぞ え て も た り な い"),
    ("指先が冷たい", "ゆ び さ き が つ め た い"),
]
LYR_PRE1 = [
    ("目を閉じて 耳澄ます", "め を と じ て み み す ま す"),
    ("風の音 ではない", "か ぜ の お と で は な い"),
    ("籠の中 覗いたら", "か ご の な か の ぞ い た ら"),
    ("此方を見てた", "こ ち ら を み て た"),
]
LYR_CHORUS1 = [
    ("夜明けの晩に 啼いた", "よ あ け の ば ん に な い た"),
    ("後ろの声は だあれ", "う し ろ の こ え は だ あ れ"),
    ("振り向く度に 増える", "ふ り む く た び に ふ え る"),
    ("白い影たち", "し ろ い か げ た ち"),
    ("鍵を掛けても 無駄と", "か ぎ を か け て も む だ と"),
    ("囀る声が 嗤う", "さ え ず る こ え が わ ら う"),
    ("朝が来ぬのは 屹度", "あ さ が こ ぬ の は き っ と"),
    TITLE_LINE,
]
LYR_VERSE2 = [
    ("水入れの水面に", "み ず い れ の み な も に"),
    ("映るのは誰の目", "う つ る の は だ れ の め"),
    ("赤い縁 瞬き", "あ か い ふ ち ま ば た き"),
    ("一つずつ消えてく", "ひ と つ ず つ き え て く"),
]
LYR_PRE2 = [
    ("手を伸ばす 指の先", "て を の ば す ゆ び の さ き"),
    ("啄むのは だあれ", "つ い ば む の は だ あ れ"),
    ("扉には 鍵が無い", "と び ら に は か ぎ が な い"),
    ("初めから無い", "は じ め か ら な い"),
]
LYR_CHORUS2 = [
    ("夜明けの晩に 啼いた", "よ あ け の ば ん に な い た"),
    ("籠の中身は だあれ", "か ご の な か み は だ あ れ"),
    ("数える度に 増える", "か ぞ え る た び に ふ え る"),
    ("赤い目の群れ", "あ か い め の む れ"),
    ("窓を閉じても 無駄と", "ま ど を と じ て も む だ と"),
    ("羽搏く音が 嗤う", "は ば た く お と が わ ら う"),
    ("朝が来ぬのは 屹度", "あ さ が こ ぬ の は き っ と"),
    TITLE_LINE,
]
LYR_BRIDGE = [
    ("籠の中の鳥は 何時出る", "か ご の な か の と り は い つ で る"),
    ("出られぬのは 何方でしょうか", "で ら れ ぬ の は ど ち ら で しょ う か"),
]

# 分散和音の基本形 (構成音の番号)
ARP8 = [0, 2, 1, 2, 3, 2, 1, 2]
ARP16 = [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 3, 2, 4, 2]
ARP7 = [0, 2, 1, 2, 3, 2, 1]


# ==========================================================================
# 各区間
# ==========================================================================
def shifted(events, ticks):
    return [Ev(e.tick + ticks, e.dur, e.gate, e.pitch, e.vol, e.inst, e.slide) for e in events]


def doubled(events, inst, vol, start=0):
    """同じ音を別の音色でなぞる (三角波ベースにノコギリ波を重ねて、小さいスピーカーでも聞こえるように)。"""
    return [Ev(e.tick, e.dur, e.gate, e.pitch, vol, inst) for e in events if e.tick >= start]


def leader() -> Section:
    """再生ボタンを押す音と、テープのヒスだけの 2 拍。"""
    s = Section("leader", 1, meter=(2, 4), label="再生", key="")
    s.add("NOI", noise(["p......."], 2 * BEAT))
    return s


def intro_box() -> Section:
    """オルゴールと時計だけの導入 (4 小節)。上の声部が半音ずつ下がっていく。"""
    s = Section("intro1", 4, label="導入", key="イ短調")
    s.chords = harmony("Am | AmM7 | Am7 | Am6", WHOLE)
    s.mml("V1", "@bell v14 q8 l8 o4 a >e c e a e c e | <a >e c e g+ e c e |"
                " <a >e c e g e c e | <a >e c e f+ e c <b |")
    s.mml("V2", "@bell v8 q8 o6 r2 a2 | r2 g+2 | r2 g2 | r2 f+2 |")
    s.mml("P2", "@bell v9 q8 o3 a1 | a1 | a1 | a1 |")
    s.add("NOI", clock(3 * WHOLE + BEAT * 2))
    s.add("NOI", [Ev(3 * WHOLE + 2 * BEAT, 2 * BEAT, 2 * BEAT, 3.0, 11, "riser")])
    return s


def intro_band(ins) -> Section:
    """主題をそのまま器楽で鳴らす前奏 (8 小節)。"""
    s = Section("intro2", 8, label="前奏", key="イ短調")
    h = s.chords = harmony(RIFF_CHORDS, WHOLE)
    s.mml("P1", "@riff v12 q7 " + RIFF)
    s.mml("P2", "@riff v7 q7 k-12 " + RIFF)
    s.add("V1", arp(h, WHOLE, [ARP8] * 8, 69, "pluck", 7, melody=s.tracks["P1"] + s.tracks["P2"]))
    s.add("V2", pads(ins, h, 57, 9))
    s.add("TRI", bass(h, WHOLE, ["R R O R R R O a"] * 7 + ["R R O R R O 5 O"], gate=18))
    s.add("SAW", doubled(s.tracks["TRI"], "sawbass", 13))
    s.add("DMC", dmc(["k...n...k.k.n..."] * 3 + ["k...n...k.k.n.tm"]
                     + ["k...n...k.k.n..."] * 3 + ["k...n...k.ttmmll"], WHOLE))
    s.add("NOI", noise(["c.h.s.h.h.h.s.h."] + ["h.h.s.h.h.h.s.o."] + ["h.h.s.h.h.h.s.h."]
                       + ["h.h.s.h.h.h.s..."] + ["h.h.s.h.h.h.s.h."] + ["h.h.s.h.h.h.s.o."]
                       + ["h.h.s.h.h.h.s.h."] + ["h.h.s.h.s.s.4679"], WHOLE))
    return s


def verse(name, stanzas, lyrics) -> Section:
    """A メロ。stanzas=2 なら 16 小節 (1 番: 前半は時計とオルゴールだけ)、1 なら 8 小節 (2 番)。"""
    s = Section(name, 8 * stanzas, label="Aメロ", key="イ短調")
    spec = VERSE_CHORDS_OPEN if stanzas == 1 else VERSE_CHORDS_OPEN + " | " + VERSE_CHORDS_CLOSE
    s.chords = harmony(spec, WHOLE)
    if stanzas == 2:
        mel = VERSE_HEAD + VERSE_OPEN + VERSE_HEAD + VERSE_CLOSE
        acc = VERSE_ARP_HEAD + VERSE_ARP_OPEN + VERSE_ARP_HEAD + VERSE_ARP_CLOSE
    else:
        mel = VERSE_HEAD + VERSE_OPEN
        acc = VERSE_ARP_HEAD + VERSE_ARP_OPEN
    s.mml("P1", "@lead v9 q7 " + mel)
    s.mml("P2", "@low v7 q7 k-12 " + mel)
    s.mml("V1", "@bell v6 q8 " + acc)
    s.lyrics(lyrics)

    rest8 = "r1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |"
    quiet = "@tri q8 o2 a2 r2 | a2 r2 | a2 r2 | a2 r2 | f2 r2 | f2 r2 | e2 r2 | e2 r2 |"
    walk_open = ("@tri q6 l8 o2 a4. a4. a >e< | a4. a4. a >e< | a4. a4. a >e< | a4. a4. a >e< |"
                 " f4. f4. f >c< | f4. f4. f >c< | e4. e4. e b | e4. e4. e g+ |")
    walk_close = ("@tri q6 l8 o2 a4. a4. a >e< | a4. a4. a >e< | a4. a4. a >e< | a4. a4. a >e< |"
                  " f4. f4. f >c< | f4. f4. f >c< | e4. e4. e g+ | a4. a4. a4 |")
    line = "@guide v4 q8 o5 a1 | g+1 | g1 | f+1 | f1 | ^1 | e1 | ^1 |"     # 半音で下がる内声
    beat_d = ["k...n...k.k.n..."] * 7 + ["k...n...k.k.n.tm"]
    beat_n = ["h.h.s.h.h.h.s.h."] * 3 + ["h.h.s.h.h.h.s.o."] + ["h.h.s.h.h.h.s.h."] * 3 + ["h.h.s.h.h.s.s.s."]
    if stanzas == 2:
        s.mml("TRI", quiet + walk_close)
        s.mml("V2", rest8 + line)
        s.add("NOI", clock(8 * WHOLE))
        s.add("NOI", shifted(noise(beat_n, WHOLE, 0.75), 8 * WHOLE))
        s.add("DMC", shifted(dmc(beat_d, WHOLE, 0.8), 8 * WHOLE))
    else:
        s.mml("TRI", walk_open)
        s.mml("V2", line)
        # 2 番は歌の切れ目にノコギリ波が小さく応える
        s.mml("SAW", "@sawpluck v11 q8 l8 r1 | r2 o3 e a >c e | r1 | r2 o3 e a >c e |"
                     " r1 | r2 o3 f a >d f | r1 | r2 o3 e g+ b >e |")
        s.add("NOI", noise(beat_n, WHOLE, 0.75))
        s.add("DMC", dmc(beat_d, WHOLE, 0.8))
    return s


def pre(name, ins, lyrics) -> Section:
    """B メロ。最後に変イ→変ロ→ト7 と進み、2 拍の無音を挟んでハ短調のサビへ抜ける。"""
    s = Section(name, 8, label="Bメロ", key="イ短調")
    h = s.chords = harmony(PRE_CHORDS, WHOLE)
    s.mml("P1", "@lead v11 q7 " + PRE)
    s.mml("P2", "@low v8 q7 k-12 " + PRE)
    s.lyrics(lyrics)
    s.add("V1", arp(h, WHOLE, [ARP8] * 7 + [[2, None, None, None, None, None, None, None]], 64, "pluck",
                    [5, 5, 5, 5, 6, 7, 8, 9], melody=s.tracks["P1"] + s.tracks["P2"]))
    s.add("V2", pads(ins, h, 60, [0, 0, 0, 0, 6, 8, 10, 12], bars={4, 5, 6}))
    s.mml("TRI", "@tri q6 l4 o2 f f f f | g g g g | e e e e | a a a a |"
                 " l8 >d d d d d d d d< | g g g g g g g g | a- a- a- a- b- b- b- b- | q4 g4 r4 r2 |")
    s.add("SAW", doubled(s.tracks["TRI"], "sawbass", 10, start=4 * WHOLE))
    s.add("DMC", dmc(["k.......k...n..."] * 4 + ["k...k...k...k..."] * 2 + ["k.k.k.k.k.k.k.k."] + ["k..............."], WHOLE))
    s.add("NOI", noise(["h.h.h.h.h.h.s.h."] * 4 + ["h.h.s.h.h.h.s.h."] * 2 + ["0011223344556789"] + ["S..............."], WHOLE))
    return s


def chorus(name, ins, shift, lyrics, tag_bars=2, guide_from=0, big=False) -> Section:
    """サビ。主題 16 小節 + 名義フレーズのあとの着地 (1〜2 小節)。"""
    bars = 16 + tag_bars
    s = Section(name, bars, shift=shift, label="サビ", key=KEYS[shift])
    spec = CHORUS_CHORDS if tag_bars == 2 else CHORUS_CHORDS.rsplit(" | ", 1)[0]
    h = s.chords = harmony(spec, WHOLE, shift)
    tag = TAG_2BAR if tag_bars == 2 else TAG_1BAR
    mel = THEME_1 + THEME_2 + tag
    s.mml("P1", "@lead v14 q7 " + mel)
    s.mml("P2", "@low v10 q7 k-12 " + mel)
    s.lyrics(lyrics)

    # 対旋律: 3度→7度→3度…と 2 小節ごとに順次下がるガイドトーン。
    # 終わりはナポリの和音を挟んで ラ→シ♭→ソ♯→ラ と主音を上下から挟み込む
    g = ["o6 c1", "^1", "o5 b1", "^1", "o5 a1", "^1", "o5 a1", "o5 g+1",
         "o6 c1", "^1", "o5 b1", "^1", "o5 a1", "o5 b-1", "o5 g+1", "^1"]
    g += ["o5 a1", "^1"] if tag_bars == 2 else ["o5 a2 r2"]
    g[:guide_from] = ["r1"] * guide_from
    s.mml("V2", "@guide v5 q8 " + " | ".join(g) + " |")

    # 分散和音・ベース・ドラム (15〜16 小節目は全員で 4 分のキメ)
    voices = s.tracks["P1"] + s.tracks["P2"]
    hit4 = [3, None, 3, None, 3, None, 3, None]
    hit2 = [3, None, 3, None, None, None, None, None]
    if big:
        pats = [ARP16] * 14 + [[3, None, None, None] * 4, [3, None, None, None] * 2 + [None] * 8]
        pats += [ARP16] * tag_bars if tag_bars == 2 else [[3] + [None] * 15]
        s.add("V1", arp(h, WHOLE, pats, 67, "pluck", 8, step=S16, melody=voices))
    else:
        pats = [ARP8] * 14 + [hit4, hit2]
        pats += [ARP8] * tag_bars if tag_bars == 2 else [[3] + [None] * 7]
        s.add("V1", arp(h, WHOLE, pats, 67, "pluck", 8, melody=voices))

    drive = "R O R O R O R a" if big else "R R O R R R O a"
    bp = [drive] * 14 + ["R . R . R . R .", "R . R . . . . ."]
    bp += [drive.replace("a", "O"), "R R O R R O 5 O"] if tag_bars == 2 else ["R . . . . . . ."]
    s.add("TRI", bass(h, WHOLE, bp, gate=18))
    s.add("SAW", doubled(s.tracks["TRI"], "sawbass", 14 if big else 13))

    kick = "k...k...k...k..." if big else "k...n...k.k.n..."
    kick2 = "k...k...k...k.k." if big else "k...n.k.k.k.n..."
    dp = [kick, kick2, kick, kick2, kick, kick2, kick, "k...n...k.ttmmll"]
    dp += [kick, kick2, kick, kick2, kick, kick2, "k...k...k...k...", "k...k..........."]
    dp += [kick, "k...n...k.ttmmll"] if tag_bars == 2 else ["k..............."]
    s.add("DMC", dmc(dp, WHOLE))

    if big:
        hat, hat2 = "h.o.s.o.h.o.s.o.", "h.o.s.o.h.o.s.oo"
    else:
        hat, hat2 = "h.h.s.h.h.h.s.h.", "h.h.s.h.h.h.s.o."
    np_ = ["c" + hat[1:], hat2, hat, hat2, hat, hat2, hat, "h.h.s.h.s.s.4679"]
    np_ += ["c" + hat[1:], hat2, hat, hat2, hat, hat2, "S...S...S...S...", "S...S...23456789"]
    np_ += ["c" + hat[1:], "h.h.s.h.s.s.4679"] if tag_bars == 2 else ["c..............."]
    s.add("NOI", noise(np_, WHOLE))
    return s


def interlude(ins) -> Section:
    """7/8 拍子の間奏。主題が 8 分ひとつぶん欠けて足を引きずる。"""
    bt = 7 * S8
    s = Section("interlude", 8, meter=(7, 8), label="間奏", key="イ短調")
    h = s.chords = harmony("Am | Dm | G | C | F | Bm7b5 | E7sus4 | E7", bt)
    s.mml("P1", "@riff v12 q7 " + RIFF_78)
    s.mml("P2", "@riff v7 q7 k-12 " + RIFF_78)
    s.add("V1", arp(h, bt, [ARP7] * 8, 69, "pluck", 7, melody=s.tracks["P1"] + s.tracks["P2"]))
    s.add("V2", pads(ins, h, 57, 9, bar_ticks=bt))
    s.add("TRI", bass(h, bt, ["R R O R R O a"] * 7 + ["R - - - - - -"], gate=18))
    s.add("SAW", doubled(s.tracks["TRI"], "sawbass", 13))
    s.add("DMC", dmc(["k...n...k.k.n."] * 7 + ["k............."], bt))
    s.add("NOI", noise(["c.h.s.h.h.h.s."] + ["h.h.s.h.h.h.s."] * 6 + ["c............."], bt))
    return s


def bridge() -> Section:
    """C メロ。3/4、オルゴールとわらべうた風の旋律、裏でモールス信号。"""
    bt = 3 * BEAT
    s = Section("bridge", 12, meter=(3, 4), label="Cメロ", key="イの都節")
    s.chords = harmony("Asus4 | Asus4 | Bb | Bb | Asus4 | Asus4 | Bb | Asus4 | Asus4 | Asus4 | Asus4 | Asus4", bt)
    rest4 = " r2. | r2. | r2. | r2. |"
    s.mml("P1", "@lead v10 q7 " + BRIDGE + rest4)
    s.lyrics(LYR_BRIDGE)
    s.mml("V1", "@bell v8 q8 k12 " + BRIDGE
                + " @bell v11 l8 o4 a4 a b- a4 | a4 f e f4 | @bell_fall o4 a2. | r2. |")
    s.mml("V2", "@bell v5 q8 l8 r2. | r2. | r2. | r4 o5 e f a4 | r2. | r2. | r2. | r4 o5 a f e4 |" + rest4)
    s.mml("SAW", "@drone v8 q8 o2 a2. | ^2. | ^2. | ^2. | ^2. | ^2. | ^2. | ^2. | ^2. | ^2. | r2. | r2. |")
    # 「うしろ」 … 1 行目の終わりから 2 行目にかけて。都節のどの音とも半音でぶつからないレで打つ
    code, end = morse("USHIRO", 3 * bt, S16, 86, 4)
    assert end <= 8 * bt + S16 * 3, end
    s.add("P2", code)
    sour = [Ev(e.tick, e.dur, e.gate, e.pitch, 6, "bell_sour") for e in s.tracks["V1"] if 8 * bt <= e.tick < 10 * bt]
    s.add("P2", sour)
    s.add("NOI", clock(12 * bt))
    return s


def signal() -> Section:
    """時報。ピッ、ピッ、ピッ、ポーン。"""
    s = Section("signal", 2, label="時報", key="440Hz")
    s.mml("TRI", "@tri q8 l16 o4 a r8. r4 a r8. r4 | a r8. r4 >a2 |")
    s.add("NOI", noise([None, "............2468"], WHOLE))
    return s


def ochi(shift) -> Section:
    """落ちサビ。名義フレーズだけを、倍の長さで、オルゴールと時計だけで。"""
    s = Section("ochi", 5, shift=shift, label="落ちサビ", key=KEYS[shift])
    h = s.chords = harmony("E7sus4 | Fmaj7 | E7 | E7 | Am", WHOLE, shift)
    s.mml("P1", "@lead v9 q7 " + OCHI)
    s.mml("P2", "@low v6 q7 k-12 " + OCHI)
    s.lyrics([TITLE_LINE])
    s.add("V1", arp(h, WHOLE, [ARP8] * 4 + [[0, 1, 2, 3, 4, 5, None, None]], 67, "bell", 8,
                    melody=s.tracks["P1"] + s.tracks["P2"]))
    s.add("NOI", clock(5 * WHOLE))
    return s


def outro(shift) -> Section:
    """後奏。導入のオルゴールが戻ってきて、テープごと止まる。最後に時報がひとつ。"""
    s = Section("outro", 4, shift=shift, label="後奏", key=KEYS[shift])
    s.chords = harmony("Am | AmM7 | Am7 | Am7", WHOLE, shift)
    # 導入より 1 オクターブ低く (移調ぶんを差し引いて、ぜんまいが緩んだように)
    s.mml("V1", "@bell v12 q8 l8 k-12 o4 a >e c e a e c e | <a >e c e g+ e c e |"
                " <a >e c e g e c e | r1 |")
    s.mml("V2", "@bell v7 q8 o4 r2 a2 | r2 g+2 | r2 g2 | r1 |")
    s.add("NOI", clock(3 * WHOLE))
    s.mml("TRI", "@tri q8 l16 r1 | r1 | r1 | r2 o4 a r8. r4 |", shift=0)
    return s


# ==========================================================================
# 曲の組み立て
# ==========================================================================
HISS = 0.006        # テープのヒスの量 (ミックスの基準レベル比)


def build() -> Song:
    ins = instruments()
    song = Song(TITLE, ARTIST, BPM, ins, MIX)

    # 導入: 古いテープの中のオルゴール
    song.append(leader())
    song.append(intro_box())
    song.fx.append(("tape", 0, song.total_ticks, HISS))

    song.append(intro_band(ins))
    song.append(verse("verse1", 2, LYR_VERSE1))
    song.append(pre("pre1", ins, LYR_PRE1))
    song.append(chorus("chorus1", ins, 3, LYR_CHORUS1, tag_bars=2, guide_from=8))

    t = song.append(interlude(ins))
    bt = 7 * S8
    b4 = t + 3 * bt                       # 4 小節目の終わりで針が飛ぶ
    song.fx.append(("stutter", b4 + 8 * S16, S16, b4 + 10 * S16, 2, 1.0, 1.0))
    song.fx.append(("stutter", b4 + 8 * S16, S16 // 2, b4 + 12 * S16, 4, 1.0, 0.9))
    song.fx.append(("bitcrush", b4 + 10 * S16, b4 + 14 * S16, 5, 5))
    song.fx.append(("tape_stop", t + 7 * bt, t + 8 * bt))      # 8 小節目でテープが止まる

    song.append(verse("verse2", 1, LYR_VERSE2))
    song.append(pre("pre2", ins, LYR_PRE2))
    song.append(chorus("chorus2", ins, 3, LYR_CHORUS2, tag_bars=1))

    t = song.append(bridge())
    song.fx.append(("tape", t, song.total_ticks, HISS))

    song.append(signal())
    song.append(chorus("chorus3", ins, 5, LYR_CHORUS1, tag_bars=2, big=True))

    t = song.append(ochi(5))
    t2 = song.append(outro(5))
    song.fx.append(("tape", t, t2 + 3 * WHOLE, HISS))
    song.fx.append(("tape_stop", t2 + 2 * WHOLE, t2 + 3 * WHOLE))
    song.fx.append(("only_after", t2 + 3 * WHOLE, ["TRI"]))     # 止まったあとに鳴るのは時報だけ
    return song
