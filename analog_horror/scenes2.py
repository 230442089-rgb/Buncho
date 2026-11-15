"""タコくんをめぐる場面。

防犯カメラ、たずね人、文字とノイズの嵐、潜伏先の部屋、止まった画面、捕獲、婚姻届、
「みつけた」、引きずられていく帰り道。
"""
from __future__ import annotations

import math
import os
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy.ndimage import gaussian_filter

from picture import (
    F_PIX, AMBER, F_BOLD, F_MIN_BLACK, F_MIN_BOLD, FPS, GREEN, H, LAMP1, LAMP2, W, XX, YELLOW, YY,
    add_glow, band, blit_mask, broadcast_overlay, card_base, eyes_layer, font, grid_layer, heart_text,
    pix_mask, pix_text, put_glow_text, ramp, silhouette, smooth, street, telop_text, to_f, to_pil, typed,
)
from family import MEMBER, VOICE_MEMBER, member_card
from tako import tako_front
from timeline import DISTRICTS

F_BRUSH = "/usr/share/fonts/truetype/kouzan-mouhitsu/kouzan-mouhitsu.ttf"
JADE = np.array([0.25, 0.92, 0.64], np.float32)  # 結索の糸

# 家族それぞれの色と、画面にあふれる言葉
MEMBERS = [
    (np.array([1.00, 0.86, 0.22], np.float32), ["タコくーん♡", "どこー？", "怒ってないよ♡", "大好き♡", "結婚しよ♡", "婚姻届　書いたよ♡",
                                                 "「ブス」４７回　ぜんぶ覚えてる♡", "もっと言って♡", "よゆーよゆー♪"]),
    (np.array([0.62, 0.84, 1.00], np.float32), ["もう離しませんからぁ♡", "お茶　二人分ありますからぁ♡", "印鑑は　こちらで用意しました♡", "見つけましたよぉ♡"]),
    (np.array([0.88, 0.18, 0.18], np.float32), ["……いた？", "……こっち", "……離さない"]),
    (np.array([0.52, 0.44, 1.00], np.float32), ["もう！", "お金は返しなさい！", "ごはんは食べたの？", "みんな　やりすぎ！"]),
    (np.array([0.72, 0.95, 0.30], np.float32), ["よわ～♡", "は～？　まだ逃げんの？", "逃げ足だけじゃん♡"]),
    (np.array([0.25, 0.92, 0.64], np.float32), ["逃げ道　もうあらへんよ", "ほんま　無茶しはる"]),
    (np.array([1.00, 0.60, 0.18], np.float32), ["……お金は　いい", "……帰ってきて", "……その　……好き"]),
    (np.array([0.18, 1.00, 0.55], np.float32), ["北区　いない", "めんど", "テルのお金　数百万", "カメラ　ぜんぶ見てるし"]),
    (np.array([1.00, 0.66, 0.80], np.float32), ["……にあの　となり……♡", "いっしょう　はなさない♡", "ねむい"]),
    (np.array([0.76, 0.42, 1.00], np.float32), ["みっけ！", "……ちがった", "かけっこ！　あたしの勝ち！"]),
    (np.array([0.96, 0.96, 0.92], np.float32), ["おいでぇ♡", "こわくないよぉ♡", "かわいいなぁもう♡", "おかえりぃ♡"]),
    (np.array([0.74, 0.70, 0.82], np.float32), ["……その逃げ方は　構図がいい"]),
]


def _moji(text: str) -> str:
    """文字化け（UTF-8 を Shift_JIS として読んだときの化け方）。"""
    return text.encode("utf-8").decode("cp932", errors="ignore")


MOJI = [_moji(x) for _, ls in MEMBERS for x in ls] + [
    _moji(x) for x in ["タコくんどこにいるの", "みつけたらもうはなさない", "だいすきだいすきだいすきだいすき", "結婚しよう結婚しよう結婚しよう",
                       "愛をたっぷり教えてあげる", "いないいないここにもいない", "おかえりおかえりおかえり", "ブスって言った四十七回"]
]


# =============================================================== 立ち絵（tako.py で描き起こした正面）
@lru_cache(maxsize=1024)
def tako_img(pose: str, h: int, flip: bool = False, rot: int = 0, squash: float = 1.0, crop: str = "full",
             face: str | None = None) -> np.ndarray:
    """タコくんの絵を高さ h にした RGBA 配列。crop='head' なら頭と肩だけ。"""
    arr = tako_front(pose, max(1, h), 0.0, face, crop)
    if not (flip or rot or squash != 1.0):
        return arr
    im = Image.fromarray((arr * 255).astype(np.uint8))
    if flip:
        im = ImageOps.mirror(im)
    if rot:
        im = im.rotate(rot, resample=Image.BICUBIC, expand=True)
    if squash != 1.0:
        im = im.resize((im.width, max(1, int(round(im.height * squash)))), Image.BILINEAR)
    return np.asarray(im, np.float32) / 255.0


def put_img(a: np.ndarray, arr: np.ndarray, cx: float, cy: float, anchor: str = "foot",
            bright: float = 1.0, alpha: float = 1.0, tint=None) -> None:
    h, w = arr.shape[:2]
    x0 = int(round(cx - w / 2))
    y0 = int(round(cy - h)) if anchor == "foot" else int(round(cy - h / 2))
    xa, ya, xb, yb = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if xb <= xa or yb <= ya:
        return
    src = arr[ya - y0 : yb - y0, xa - x0 : xb - x0]
    rgb = src[..., :3] * bright
    if tint is not None:
        rgb = rgb * np.asarray(tint, np.float32)
    al = src[..., 3:4] * alpha
    a[ya:yb, xa:xb] = a[ya:yb, xa:xb] * (1 - al) + rgb * al


# =============================================================== 字幕・防犯カメラの表示
def captions(a: np.ndarray, tl: dict, t: float, y_bottom: int = 452) -> np.ndarray:
    """ユリアの言葉は黄色い文字、タコくんの言葉は白い字幕。"""
    act = [c for c in tl["caps"] if c["t0"] <= t < c["t1"]]
    if not act:
        return a
    c = act[-1]
    lines = c["text"].split("\n")
    if c["who"] == "Y":
        for k, ln in enumerate(lines):
            m = pix_mask(ln, 2)
            w = min(m.shape[1], W)
            x0 = max(0, 320 - w // 2)
            y0 = y_bottom - (len(lines) - k) * 38
            band(a, max(0, x0 - 10), y0 - 3, min(W, x0 + w + 10), y0 + 35, (0, 0, 0), 0.5)
            big = np.zeros((H, W), np.float32)
            big[y0 : y0 + m.shape[0], x0 : x0 + w] = m[:, :w]
            put_glow_text(a, big, YELLOW)
        return a
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    name = VOICE_MEMBER.get(c["who"])
    col = tuple(int(255 * v) for v in MEMBER[name][2]) if name else (245, 245, 245)
    fs = 22 if max(font(F_BOLD, 22).getlength(ln) for ln in lines) < 600 else 19
    for k, ln in enumerate(lines):
        telop_text(d, (320, y_bottom - (len(lines) - k) * 30 + 12), ln, font(F_BOLD, fs), col,
                   stroke=3, stroke_fill=(0, 0, 0), anchor="mm", shadow=0)
    if name:  # 名前の札
        y = y_bottom - len(lines) * 30 - 14
        w = font(F_BOLD, 15).getlength(name) + 14
        d.rectangle([320 - w / 2, y - 10, 320 + w / 2, y + 10], fill=col)
        d.text((320, y), name, font=font(F_BOLD, 15), fill=(10, 10, 14), anchor="mm")
    return to_f(img)


def cctv_grade(a: np.ndarray, sat: float = 0.55) -> np.ndarray:
    g = a.mean(axis=2, keepdims=True)
    return (g + (a - g) * sat) * np.array([0.95, 1.0, 0.93], np.float32)


def cctv_overlay(a: np.ndarray, cam: str, stamp: str, lt: float, sec0: int = 7) -> None:
    pix_text(a, cam, 28, 24, (0.92, 0.92, 0.9))
    pix_text(a, f"{stamp}:{(sec0 + int(max(0.0, lt))) % 60:02d}", 484, 24, (0.92, 0.92, 0.9))
    if int(lt * 1.5) % 2 == 0:
        a[62:72, 30:40] = (0.85, 0.08, 0.08)
    pix_text(a, "REC", 46, 58, (0.92, 0.92, 0.9), 1)


def reticle(a: np.ndarray, x0: int, y0: int, x1: int, y1: int, col, ln: int = 16, wd: int = 2) -> None:
    c = np.asarray(col, np.float32)
    for (xa, ya, sx, sy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        xs = slice(max(0, min(xa, xa + sx * ln)), max(0, max(xa, xa + sx * ln)))
        ys = slice(max(0, min(ya, ya + sy * wd)), max(0, max(ya, ya + sy * wd)))
        a[ys, xs] = c
        xs = slice(max(0, min(xa, xa + sx * wd)), max(0, max(xa, xa + sx * wd)))
        ys = slice(max(0, min(ya, ya + sy * ln)), max(0, max(ya, ya + sy * ln)))
        a[ys, xs] = c


# =============================================================== 防犯カメラ：自販機コーナー
CAN_COLS = [(120, 200, 60), (30, 30, 34), (200, 205, 215), (40, 110, 220), (235, 200, 40), (220, 60, 50)]


def _can(d: ImageDraw.ImageDraw, x: float, y: float, col, lying: bool = False, s: float = 1.0) -> None:
    if lying:
        d.rectangle([x - 12 * s, y - 5 * s, x + 12 * s, y + 5 * s], fill=col)
        d.ellipse([x + 9 * s, y - 5 * s, x + 15 * s, y + 5 * s], fill=(170, 172, 178))
    else:
        d.rectangle([x - 5 * s, y - 21 * s, x + 5 * s, y], fill=col)
        d.ellipse([x - 5 * s, y - 24 * s, x + 5 * s, y - 18 * s], fill=(170, 172, 178))


@lru_cache(maxsize=None)
def vend_base() -> np.ndarray:
    rng = np.random.default_rng(61)
    a = np.zeros((H, W, 3), np.float32)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    a[:] = np.array([0.12, 0.13, 0.15], np.float32) * (1.0 - 0.3 * yy)
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    d.polygon([(0, 372), (640, 372), (640, 480), (0, 480)], fill=(46, 46, 48))  # 床
    for x in range(-200, 900, 90):
        d.line([(320 + (x - 320) * 0.55, 372), (x, 480)], fill=(36, 36, 38), width=1)
    d.rectangle([0, 40, 250, 372], fill=(6, 7, 12))  # 通りに開いた側
    d.rectangle([0, 0, 640, 40], fill=(22, 23, 26))
    d.rectangle([250, 40, 262, 372], fill=(62, 64, 68))
    specs = [(300, (214, 219, 228)), (408, (36, 70, 170)), (516, (186, 30, 34))]
    for x0, col in specs:  # 自動販売機
        d.rectangle([x0, 96, x0 + 100, 372], fill=col)
        d.rectangle([x0 + 8, 108, x0 + 92, 236], fill=(236, 242, 250))
        for r in range(3):
            for c in range(5):
                d.rectangle([x0 + 13 + c * 15, 114 + r * 40, x0 + 23 + c * 15, 142 + r * 40], fill=CAN_COLS[int(rng.integers(0, 6))])
                d.rectangle([x0 + 14 + c * 15, 145 + r * 40, x0 + 22 + c * 15, 148 + r * 40], fill=(60, 140, 240))
        d.rectangle([x0 + 62, 250, x0 + 90, 268], fill=(20, 22, 26))
        d.rectangle([x0 + 12, 252, x0 + 50, 262], fill=(240, 240, 220))
        d.rectangle([x0 + 10, 318, x0 + 90, 352], fill=(16, 17, 20))
    d.rectangle([266, 300, 296, 372], fill=(72, 76, 82))  # 空き缶入れ
    d.ellipse([272, 308, 290, 322], fill=(10, 10, 12))
    # 足もとに転がる缶と、札
    for x, y, lying in [(70, 402, 0), (88, 420, 1), (104, 398, 0), (118, 436, 1), (132, 404, 0), (56, 440, 1), (252, 404, 0),
                        (268, 426, 1), (284, 398, 0), (246, 446, 1), (150, 452, 0), (226, 458, 0), (96, 458, 1), (300, 444, 0)]:
        _can(d, x, y, CAN_COLS[int(rng.integers(0, 6))], bool(lying))
    for x, y, r in [(170, 440, -12), (214, 444, 8), (120, 464, 20)]:  # 丸めたレシート
        bill = Image.new("RGBA", (16, 26), (232, 230, 222, 255))
        for k in range(4):
            ImageDraw.Draw(bill).line([(3, 5 + 5 * k), (12, 5 + 5 * k)], fill=(150, 150, 150, 255))
        bill = bill.rotate(r, expand=True)
        img.paste(bill, (x, y), bill)
    a = to_f(img)
    add_glow(a, 120, 110, 70, 60, (0.8, 1.0, 0.88), 0.08)  # 通りの街灯
    px, py = rng.uniform(4, 246, 420), rng.uniform(44, 368, 420)  # 空中で止まった雨粒
    br = rng.uniform(0.15, 0.9, 420) ** 2
    for k in range(420):
        a[int(py[k]), int(px[k])] += br[k] * np.array([1.0, 0.86, 0.5], np.float32)
    for x0, _ in specs:
        add_glow(a, x0 + 50, 172, 70, 80, (0.8, 0.88, 1.0), 0.15)
        add_glow(a, x0 + 50, 404, 90, 30, (0.8, 0.88, 1.0), 0.10)
    return a


def scene_vend(tl, sc, t):
    mk = tl["marks"]
    tq = math.floor(t * 6) / 6  # 防犯カメラはコマ送り
    lt = max(0.0, tq - sc["t0"])
    a = vend_base().copy()
    hear, run = mk["vend_hear"], mk["vend_run"]
    fl = 1.0 + 0.03 * math.sin(tq * 31.0)
    if tq < hear:
        pose, flip, cx = ("can" if tq < hear - 0.8 or int(tq * 6) % 9 else "stand"), False, 214.0
    elif tq < run:
        pose, flip, cx = ("startle" if tq < hear + 1.2 else "fear"), False, 214.0
    else:
        u = (tq - run) / 1.3
        pose, flip, cx = ("run1" if int(tq * 6) % 2 else "run2"), False, 214.0 - 760.0 * u ** 1.4
        img = to_pil(a)
        d = ImageDraw.Draw(img)
        for k, (x, y) in enumerate([(150, 452), (226, 458), (132, 404)]):  # 蹴とばされた缶
            _can(d, x - (60 + 30 * k) * min(1.0, u * 1.5), y + 6 * k, CAN_COLS[k], True)
        a = to_f(img)
    a[420:440, max(0, int(cx) - 70) : max(0, int(cx) + 70)] *= 0.72  # 足もとの影
    if tq >= run:
        for off, al in [(130, 0.16), (65, 0.34)]:
            put_img(a, tako_img(pose, 290, flip), cx + off, 436, bright=1.0, alpha=al)
    put_img(a, tako_img(pose, 290, flip), cx, 436, bright=1.08 * fl)
    a = cctv_grade(a, 0.7)
    cctv_overlay(a, sc["args"]["cam"], sc["args"]["stamp"], lt)
    a = captions(a, tl, t, 456)
    return a, dict(noise=0.065, wobble=0.5, jitter=0.3, dropout=0.5, bloom=0.6)


# =============================================================== 電波ジャック：たずね人
NOTICE_ROWS = [
    (3, "オレンジの髪", 1.6), (4, "ヘッドホン", 2.3), (5, "口がわるい", 3.0),
    (7, "「ブス」　４７回", 4.8), (8, "持ち出し　数百万円", 5.8), (9, "ラーメン", 6.8), (10, "エナジードリンク", 7.4),
    (12, "さがしています", 9.0), (13, "みんなで", 10.2),
]


def notice_frame(tl: dict, te: float, rows: bool = True, extra=()) -> np.ndarray:
    hj = tl["marks"]["hijack0"]
    a = card_base("studio").copy()
    dim = 0.16 + 0.84 * (1 - smooth(ramp(te, hj, hj + 1.4)))
    gray = a.mean(axis=2, keepdims=True)
    a = (a * dim + gray * (1 - dim)) * dim
    items = [(1, 1, typed("＊＊　たずね人　＊＊", te, hj + 0.3, 14))]
    if rows:
        for row, text, off in NOTICE_ROWS:
            items.append((1, row, typed(text, te, hj + off, 12)))
    items.extend(extra)
    put_glow_text(a, grid_layer(items), GREEN)
    pk = smooth(ramp(te, hj + 1.0, hj + 2.4))
    if pk > 0:  # 写真
        x0, y0, x1, y1 = 404, 92, 604, 396
        tmp = a.copy()
        band(tmp, x0, y0, x1, y1, (0.0, 0.06, 0.035), 0.9)
        put_img(tmp, tako_img("stand", 290), (x0 + x1) / 2, y1 - 6, bright=0.92)
        tmp[y0:y1:2, x0:x1] *= 0.74
        yr = int(y0 + (y1 - y0) * pk)
        a[y0:yr, x0:x1] = tmp[y0:yr, x0:x1]
        for xa, ya, xb, yb in [(x0, y0, x1, y0 + 2), (x0, y1 - 2, x1, y1), (x0, y0, x0 + 2, y1), (x1 - 2, y0, x1, y1)]:
            a[ya:yb, xa:xb] = GREEN * 0.9
        if te >= hj + 2.8:
            m = pix_mask("タコくん", 2)
            big = np.zeros((H, W), np.float32)
            big[402:434, 440 : 440 + m.shape[1]] = m
            put_glow_text(a, big, GREEN)
    return a


def scene_notice(tl, sc, t):
    mk = tl["marks"]
    lt = t - sc["t0"]
    a = notice_frame(tl, t)
    if mk["a19_0"] + 2.2 <= t < mk["a19_1"]:  # 読まされている行が明るくなる
        row = 3 if t < mk["a19_0"] + 3.6 else 4
        if int(t * 6) % 2 == 0:
            a[row * 32 - 2 : row * 32 + 34, 24:392] *= 1.6
    a = captions(a, tl, t, 470)
    g = smooth(ramp(t, mk["a19_0"], mk["a19_1"]))
    return a, dict(noise=0.08 + 0.03 * g, cnoise=0.06, wobble=2.0 + 2.0 * g, jitter=0.8, dropout=1.0 + 2 * g,
                   bands=((H * ((lt * 0.31) % 1.0), 46, 14), (H * ((lt * 0.53 + 0.4) % 1.0), 24, -9)))


# =============================================================== ご利用明細（レウネが読み上げる）
# (区切りの印, 行の文字列)。印の行に来たら、その段落を表示する。区切りの印は timeline の marks。
STATEMENT = [
    ("st_head", ["＊＊　ご利用明細　＊＊　　口座名義　テルエス",
                 "９日　１４：０２　引き出し　　　　３,１８０,０００円"]),
    ("st_ramen", ["１３日　２２：４１　麺屋なぎ　駅前店",
                  "　味噌バターコーン　大盛り　全部のせ",
                  "　麺かため　味こいめ　油多め",
                  "　ライスおかわり×２　　　　　　　　　２,４８０"]),
    ("st_drink1", ["１３日　２３：５８　自販機　港町２丁目",
                   "　コインランドリー横",
                   "　ギガボルト　トロピカル×１２　　　２,６４０",
                   "１４日　００：３１　自販機　汐入公園入口",
                   "　ギガボルト　ゼロ×８　ブルーハワイ×４　２,６４０"]),
    ("st_more", ["１４日　１３：０５　らーめん潮騒　港町店",
                 "　塩とんこつ　背脂こってり　バリカタ",
                 "　煮卵×２　替え玉×２　　　　１,９５０",
                 "１４日　１９：２０　中華そば灯台　本店",
                 "　チャーシュー麺　特盛　ねぎ抜き　１,３８０",
                 "タクシー×３　市外へ（全部戻る）１８,４００"]),
    ("st_big", ["ホテル　スイート×２泊　　６８０,０００",
                "ネットカフェ　個室×３泊　　　７,２００",
                "服・靴　４１２,０００　腕時計　４４０,０００",
                "ヘッドホン　６４,８００　焼肉　３８,６００",
                "寿司　５２,０００　ゲーセン　９６,０００",
                "コンビニ×４１回　　　　　４２,０６８",
                "スマホゲーム　課金　　１,２８０,０００"]),
    ("st_last", ["１４日　１５：００　ウィークリーアパート",
                 "　港町２丁目　２０３号室　７泊前払い　３１,５００",
                 "１４日　１６：１０　ドラッグ　ハマナス　港町店",
                 "　ギガボルト　トロピカル　２４本ケース　４,９８０",
                 "１５日　０２：４１　自販機　港町２丁目",
                 "　ギガボルト　トロピカル×６　　　　１,３２０",
                 "残り　　　　　　　　　　　　　　　　　　４２円"]),
]


def statement_frame(tl: dict, t: float) -> np.ndarray:
    mk = tl["marks"]
    a = np.zeros((H, W, 3), np.float32)
    a[:] = (0.0, 0.018, 0.012)
    # 今の段落と、ひとつ前の段落（薄く）
    cur = None
    for k, (mark, _) in enumerate(STATEMENT):
        if t >= mk[mark]:
            cur = k
    if cur is None:
        return a
    items = []
    row = 0
    shown = [0, cur] if cur > 0 else [0]
    for k in shown:
        mark, lines = STATEMENT[k]
        if k == 0:
            items.append((0, 0, typed(lines[0], t, mk[mark], 30)))
            items.append((0, 1, typed(lines[1], t, mk[mark] + 0.4, 30)))
            row = 3
            continue
        for j, ln in enumerate(lines):
            items.append((0, row + j, typed(ln, t, mk[mark] + 0.12 * j, 34)))
    m = np.zeros((H, W), np.float32)
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    d.fontmode = "1"
    f = font(F_PIX, 16)
    for col, rw, text in items:
        if text:
            d.text((24 + col * 16, 30 + rw * 30), text, 255, font=f)  # 1行30px
    m = (np.asarray(img) > 127).astype(np.float32)
    put_glow_text(a, m, GREEN)
    # 区切りの線
    a[30 + 2 * 30 + 10 : 30 + 2 * 30 + 12, 24:616] = GREEN * 0.6
    if cur == len(STATEMENT) - 1:
        if t >= mk["st_last"] + 1.2 and int(t * 4) % 2 == 0:  # 残りがまたたく
            y = 30 + (3 + 6) * 30
            a[y - 4 : y + 22, 20:620] = a[y - 4 : y + 22, 20:620] * 0.3 + GREEN * 0.5
        if t >= mk["st_room"]:  # 部屋番号の行を囲む
            y = 30 + (3 + 1) * 30
            k = 1.0 if int(t * 6) % 2 == 0 else 0.6
            for ya, yb in [(y - 6, y - 4), (y + 22, y + 24)]:
                a[ya:yb, 20:620] = YELLOW * k
            for xa, xb in [(20, 22), (618, 620)]:
                a[y - 6 : y + 24, xa:xb] = YELLOW * k
    return a


def member_inset(a: np.ndarray, name: str, appear: float) -> np.ndarray:
    """右下に、話している家族の人影を小さく出す。"""
    if appear <= 0.01:
        return a
    card = member_card(name, 0.0, 1.0)
    im = Image.fromarray((card * 255).astype(np.uint8)).resize((176, 132), Image.BILINEAR)
    c = np.asarray(im, np.float32) / 255.0
    x0, y0 = W - 196, 236
    reg = a[y0 : y0 + 132, x0 : x0 + 176]
    reg[:] = reg * (1 - appear) + c * appear
    col = np.asarray(MEMBER[name][2], np.float32)
    for xa, ya, xb, yb in [(x0 - 2, y0 - 2, x0 + 178, y0), (x0 - 2, y0 + 132, x0 + 178, y0 + 134),
                           (x0 - 2, y0, x0, y0 + 132), (x0 + 176, y0, x0 + 178, y0 + 132)]:
        a[ya:yb, xa:xb] = col * appear
    pix_text(a, name, x0 + 6, y0 + 136, col * appear, 1)
    return a


def speaking_member(tl: dict, t: float) -> tuple[str | None, float]:
    for sy in tl["says"]:
        if sy["voice"] in VOICE_MEMBER and sy["t0"] - 0.2 <= t < sy["t1"] + 0.4:
            k = min(1.0, (t - sy["t0"] + 0.2) / 0.25, (sy["t1"] + 0.4 - t) / 0.25)
            return VOICE_MEMBER[sy["voice"]], max(0.0, k)
    return None, 0.0


def scene_statement(tl, sc, t):
    a = statement_frame(tl, t)
    name, k = speaking_member(tl, t)
    if name and name != "レウネ":
        a = member_inset(a, name, k)
    a = captions(a, tl, t, 470)
    lt = t - sc["t0"]
    fx = dict(noise=0.07, cnoise=0.05, wobble=1.4, jitter=0.6, dropout=0.8, bloom=0.6,
              bands=((H * ((lt * 0.23) % 1.0), 30, 10),))
    if lt < 0.4:
        k = 1 - lt / 0.4
        fx.update(noise=0.07 + 0.3 * k, dropout=10 * k, bands=((H * (1 - k), 90, 50 * k),))
    return a, fx


# =============================================================== さがしている：文字とノイズの嵐
BIG = [  # (時刻, 長さ, 文字, 誰の色, 大きさ)
    (2.2, 0.16, "どこ", 0, 7), (4.6, 0.14, "タコくん", 10, 5), (6.3, 0.16, "どこ", 8, 8), (8.6, 0.20, "大好き♡", 0, 6),
    (9.9, 0.20, "結婚しよ♡", 0, 4), (12.4, 0.16, "どこ", 7, 9), (13.0, 0.14, "いない", 7, 6), (14.9, 0.20, "タコくん♡", 0, 4),
    (15.6, 0.22, "愛♡", 8, 11), (16.5, 0.40, "どこ", 0, 12),
]
# 嵐の中で一瞬だけ映る、少し前の録画（自販機から逃げて、港町のアパートへ戻っていく）
FLASH = [("CAM 07　駅前通り", "02:44", False, "cctv"), ("CAM 11　港町", "02:49", False, "wide"), ("CAM 05　港町２丁目", "02:55", True, "wide")]


def _over(a: np.ndarray, m: np.ndarray, x: int, y: int, col) -> None:
    blit_mask(a, m, x + 2, y + 2, (0, 0, 0), 0.7)
    blit_mask(a, m, x, y, col)


def storm_flash(tl, sc, t, i):
    """街頭のカメラが、逃げる彼を一瞬だけとらえる。"""
    f = tl["marks"][f"flash{i}"]
    tq = max(0.0, math.floor((t - f) * 8) / 8)
    u = tq / 0.95
    cam, stamp, mirror, view = FLASH[i]
    st = street(view)
    a = st.bg.copy()
    a += AMBER * (0.085 * np.exp(-YY / 150.0))[..., None]
    a += st.beads + st.beads_sky + st.blink_amt(t) * (st.beads_blink + st.blink)
    X, Z = [(-3.2 + 6.0 * u, 30.0 - 2.0 * u), (-1.2 + 0.6 * u, 38.0 - 9.0 * u), (0.5 + 4.6 * u, 18.0 - 2.5 * u)][i]
    px, py = st.P(X, 0.0, Z)
    h = max(14, int(1.72 * st.f / Z))
    put_img(a, tako_img(["run1", "run2"][int(tq * 8) % 2], h), px, py + 2, bright=0.95)
    if mirror:
        a = a[:, ::-1].copy()
        px = W - px
    bx = max(22, h // 2 + 12)
    reticle(a, int(px - bx), int(py - h - 12), int(px + bx), int(py + 10), GREEN)
    pix_text(a, ["照合中……", "一致　９１％", "追跡　港町２丁目"][i], int(px - bx), int(py + 14), GREEN, 1)
    a = cctv_grade(a, 0.7)
    cctv_overlay(a, cam, stamp, tq, 31 + 9 * i)
    return a, dict(noise=0.08, wobble=1.2, jitter=0.5, dropout=2.0, bloom=0.75,
                   bands=((H * (0.84 + 0.08 * u), 30, 14),))


def storm_text(a: np.ndarray, u: float, k: float) -> None:
    """文字化けの雨と、家族それぞれの色の言葉。"""
    for i in range(int(3 + 40 * k)):
        per = 0.30 - 0.16 * k + 0.05 * (i % 3)
        gen = int((u + i * 0.137) / per)
        r = np.random.default_rng((i + 1) * 7919 + gen * 104729)
        txt = MOJI[int(r.integers(0, len(MOJI)))]
        o = int(r.integers(0, max(1, len(txt) - 6)))
        txt = txt[o : o + int(r.integers(6, 24))]
        col = (MEMBERS[int(r.integers(0, len(MEMBERS)))][0] * 0.55 + 0.3) * float(r.uniform(0.5, 0.95))
        blit_mask(a, pix_mask(txt, 1), int(r.integers(-6, 34)) * 16, int(r.integers(0, 29)) * 16, col)
    for j in range(int(1 + 15 * k)):
        per = 1.1 - 0.55 * k + 0.07 * (j % 4)
        ph = j * 0.291
        gen = int((u + ph) / per)
        age = (u + ph) - gen * per
        r = np.random.default_rng((j + 1) * 15485863 + gen * 32452843)
        col, lines = MEMBERS[int(r.integers(0, len(MEMBERS)))]
        txt = lines[int(r.integers(0, len(lines)))][: int(age * 30) + 1]
        m = pix_mask(txt, 3 if r.random() < 0.18 + 0.15 * k else 2)
        x = int(r.integers(0, max(1, (W - min(W, m.shape[1])) // 16 + 1))) * 16
        _over(a, m, x, int(r.integers(1, 26)) * 16, col * 0.62 + 0.38)


def storm_glitch(a: np.ndarray, rng: np.random.Generator, k: float, burst: bool = False) -> np.ndarray:
    d = int(1 + (9 if burst else 2.5) * k * rng.random())
    a[..., 0] = np.roll(a[..., 0], -d, axis=1)
    a[..., 2] = np.roll(a[..., 2], d, axis=1)
    for _ in range(int(rng.integers(0, 2 + int((8 if burst else 2) * k)))):
        bw, bh = int(rng.integers(40, 300)), int(rng.integers(8, 70))
        x0, y0 = int(rng.integers(0, W - bw)), int(rng.integers(0, H - bh))
        a[y0 : y0 + bh, x0 : x0 + bw] = np.roll(a[y0 : y0 + bh], int(rng.integers(-80, 80)), axis=1)[:, x0 : x0 + bw]
    if burst and rng.random() < 0.12 * k:
        a = 1.0 - a
    return a


def scene_storm(tl, sc, t):
    mk = tl["marks"]
    u = t - mk["storm0"]
    fi = int(round(t * FPS))
    k = smooth(ramp(u, 0.0, 11.0))
    rng = np.random.default_rng(9000 + fi // 2)
    for i in range(3):
        if mk[f"flash{i}"] <= t < mk[f"flash{i}"] + 0.95:
            return storm_flash(tl, sc, t, i)
    if mk["form_flash"] <= t < mk["form_flash"] + 0.8:  # 一瞬だけ映る婚姻届
        a = form_frame(1.12 + 0.2 * (t - mk["form_flash"]))
        return storm_glitch(a, rng, 0.5), dict(noise=0.10, wobble=3, jitter=0.6, dropout=4, bands=((H * (0.05 + 0.1 * rng.random()), 40, 24),))
    for t0, t1 in [(9.4, 9.52), (15.95, 16.08)]:  # 砂嵐の奥の目
        if t0 <= u < t1:
            sil, _ = silhouette()
            a = np.full((H, W, 3), 0.30, np.float32) * (1 - 0.8 * sil)[..., None]
            eyes_layer(a, 1.0, 0.0, 3.0, 1.0)
            return a, dict(noise=0.22, wobble=3, jitter=1.5, dropout=4, sat=1.0, bloom=0.7)

    n = int(u / 0.09)
    rows = [(1, 3 + j, DISTRICTS[(n + j) % len(DISTRICTS)] + "　…　いない") for j in range(8)]
    a = notice_frame(tl, mk["storm0"], rows=False, extra=rows)
    a *= 1 - 0.6 * k
    # 排水口の目
    ne = int(30 * smooth(ramp(u, 4.0, 6.0)) * (1 - smooth(ramp(u, 9.0, 10.2))))
    for e in range(ne):
        r = np.random.default_rng(555 + e)
        x, y = float(r.uniform(30, 380)), float(r.uniform(120, 460))
        if np.random.default_rng(777 + e * 31 + int(u / 0.4)).random() < 0.72:
            for dx in (-9, 9):
                add_glow(a, x + dx, y, 4.6, 2.3, MEMBERS[1][0], 0.9)
                a[int(y) - 3 : int(y) + 4, int(x + dx)] *= 0.15
    storm_text(a, u, k)
    for t0, dur, text, who, scale in BIG:
        if t0 <= u < t0 + dur:
            m = pix_mask(text, scale)
            a *= 0.35
            _over(a, m, 320 - m.shape[1] // 2 + int(rng.integers(-24, 24)), 240 - m.shape[0] // 2 + int(rng.integers(-30, 30)), MEMBERS[who][0])
    # ときどき、短く激しく壊れる。そのあいだ以外は、文字が読める程度の乱れにとどめる
    burst = np.random.default_rng(31 + int(u / 0.2)).random() < 0.10 + 0.22 * k
    a = storm_glitch(a, rng, k, burst)
    if burst:
        fx = dict(noise=0.14 + 0.10 * k, cnoise=0.10, wobble=4 + 8 * k, jitter=1.2 + 2.0 * k, dropout=4 + 8 * k, bloom=0.7,
                  bands=((H * ((u * 0.31) % 1.0), 60, 20 + 24 * k), (H * ((u * 0.53 + 0.4) % 1.0), 30, -12 - 16 * k)))
        if rng.random() < 0.3:
            fx["roll"] = float(rng.uniform(0.05, 0.5))
    else:
        fx = dict(noise=0.07 + 0.04 * k, cnoise=0.04 + 0.03 * k, wobble=1.2 + 1.6 * k, jitter=0.4 + 0.3 * k, dropout=0.8 + 2.5 * k, bloom=0.7,
                  bands=((H * ((u * 0.31) % 1.0), 30, 9 + 5 * k),))
    return a, fx


# =============================================================== このテレビの前（潜伏先の部屋）
@lru_cache(maxsize=None)
def room_static():
    rng = np.random.default_rng(71)
    img = Image.new("RGB", (W, H), (16, 18, 26))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 640, 262], fill=(36, 39, 56))  # 壁
    d.rectangle([0, 0, 640, 22], fill=(20, 22, 30))
    d.rectangle([44, 58, 168, 206], fill=(8, 9, 14))  # 窓
    d.rectangle([98, 62, 112, 202], fill=(120, 86, 30))
    for _ in range(30):
        d.point((int(rng.integers(98, 112)), int(rng.integers(62, 202))), fill=(255, 224, 150))
    d.rectangle([44, 58, 98, 206], fill=(44, 50, 80))  # カーテン
    d.rectangle([112, 58, 168, 206], fill=(44, 50, 80))
    for x in list(range(48, 98, 9)) + list(range(116, 168, 9)):
        d.line([(x, 60), (x, 204)], fill=(30, 35, 58))
    d.rectangle([236, 70, 300, 150], fill=(58, 58, 66))  # 壁の貼り紙
    d.rectangle([242, 76, 294, 104], fill=(96, 64, 48))
    d.rectangle([452, 36, 640, 262], fill=(56, 52, 48))  # 押入れ
    d.line([(546, 36), (546, 262)], fill=(20, 18, 16), width=3)
    d.rectangle([452, 36, 640, 44], fill=(28, 25, 22))
    d.ellipse([536, 150, 544, 158], fill=(8, 8, 8))
    d.ellipse([550, 150, 558, 158], fill=(8, 8, 8))
    d.polygon([(0, 262), (640, 262), (640, 480), (0, 480)], fill=(48, 55, 38))  # 畳
    for x in (-260, 60, 380, 700, 1020):
        d.line([(320 + (x - 320) * 0.42, 262), (x, 480)], fill=(24, 28, 20), width=3)
    d.line([(0, 300), (640, 300)], fill=(32, 37, 26), width=2)
    back = to_f(img)
    add_glow(back, 320, 330, 300, 190, (0.45, 0.6, 1.0), 0.16)  # テレビの明かり

    front = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(front)
    d.polygon([(132, 332), (508, 332), (588, 410), (52, 410)], fill=(70, 48, 30, 255))  # ちゃぶ台
    d.polygon([(52, 410), (588, 410), (588, 428), (52, 428)], fill=(42, 28, 18, 255))
    d.rectangle([84, 428, 104, 480], fill=(30, 20, 13, 255))
    d.rectangle([536, 428, 556, 480], fill=(30, 20, 13, 255))
    for x, y in [(206, 380), (236, 372), (236, 346)]:  # カップ麺
        d.polygon([(x - 14, y - 26), (x + 14, y - 26), (x + 10, y), (x - 10, y)], fill=(226, 224, 214, 255))
        d.rectangle([x - 13, y - 20, x + 13, y - 12], fill=(190, 50, 40, 255))
        d.ellipse([x - 14, y - 30, x + 14, y - 22], fill=(240, 238, 230, 255))
    d.polygon([(420, 388), (446, 376), (454, 394), (430, 404)], fill=(226, 224, 214, 255))
    d.line([(200, 398), (252, 392)], fill=(170, 140, 90, 255), width=2)  # 箸
    for k, (x, y, lying) in enumerate([(300, 384, 0), (318, 378, 0), (338, 388, 0), (358, 376, 0), (384, 398, 1),
                                        (276, 402, 1), (470, 400, 1), (152, 372, 0), (492, 378, 0)]):
        _can(d, x, y, CAN_COLS[k % 6] + (255,), bool(lying), 1.15)
    for x, y, r in [(146, 398, -8), (512, 400, 12), (530, 386, -20), (470, 412, 5)]:  # レシートの山と、からの財布
        d.rectangle([x - 9, y - 14, x + 9, y + 14], fill=(236, 234, 226, 255), outline=(150, 150, 150, 255))
    d.rectangle([118, 404, 160, 420], fill=(60, 44, 34, 255), outline=(30, 22, 16, 255))
    d.line([(122, 412), (156, 412)], fill=(90, 70, 50, 255), width=2)
    return back, np.asarray(front, np.float32) / 255.0


def room_frame(tl: dict, te: float, show_found: bool = True) -> np.ndarray:
    mk = tl["marks"]
    back, front = room_static()
    a = back.copy()
    r = np.random.default_rng(int(te * 12) + 5)
    duck = 15.0 * smooth(ramp(te, mk["hold0"], mk["hold0"] + 0.35))
    hx = 330.0 + float(r.integers(-1, 2))
    face = "panic" if te >= mk["room_found"] else "fear"
    put_img(a, tako_img("fear", 178, crop="head", face=face), hx, 268.0 + duck, anchor="center", bright=1.0, tint=(0.94, 0.97, 1.06))
    a = a * (1 - front[..., 3:4]) + front[..., :3] * front[..., 3:4]
    for x in (hx - 96, hx + 96):  # ちゃぶ台のふちをつかむ手
        add_glow(a, x, 331 + duck * 0.2, 10, 6, (0.50, 0.31, 0.19), 0.9)
    a *= 0.86 + 0.14 * float(np.random.default_rng(int(te * 15)).random())  # テレビの明かりのちらつき
    a = cctv_grade(a, 0.7) * np.array([0.92, 0.97, 1.1], np.float32)
    # 緑の文字
    pix_text(a, "このテレビの前", 30, 28, GREEN)
    pix_text(a, "受像機　４４７１", 32, 66, GREEN * 0.8, 1)
    found = te >= mk["room_found"]
    col = YELLOW if found else GREEN
    reticle(a, 222, int(206 + duck), 438, int(346 + duck * 0.3), col, 22, 3)
    t03 = next(s for s in tl["says"] if s["id"] == "T03")
    label = "照合中……" if te < t03["t0"] + 1.4 else "一致　９７％"
    pix_text(a, label, 224, int(184 + duck), col, 1)
    if found and show_found:
        m = pix_mask("……いた", 3)
        big = np.zeros((H, W), np.float32)
        big[398:446, 30 : 30 + m.shape[1]] = m
        put_glow_text(a, big, GREEN)
    return a


def scene_room(tl, sc, t):
    mk = tl["marks"]
    if t < mk["room0"]:  # 嵐がやんで、文字が一行だけ
        a = np.zeros((H, W, 3), np.float32)
        a[:] = (0.0, 0.012, 0.008)
        s = typed("このテレビの前　……", t, mk["here0"] + 0.25, 9)
        if int(t * 3) % 2 == 0:
            s += "■"
        put_glow_text(a, grid_layer([(2, 7, s)]), GREEN)
        return a, dict(noise=0.04, cnoise=0.03, wobble=0.4, jitter=0.2, dropout=0.1)
    a = room_frame(tl, t)
    a = captions(a, tl, t, 470)
    fx = dict(noise=0.06, cnoise=0.04, wobble=0.8, jitter=0.4, dropout=0.6, bloom=0.5)
    if t < mk["room0"] + 0.35:
        k = 1 - (t - mk["room0"]) / 0.35
        a = a + 0.4 * k
        fx.update(noise=0.085 + 0.4 * k, dropout=10 * k, bands=((H * (1 - k), 100, 50 * k),))
    if t >= mk["stop0"]:  # 止まっていく
        k = (t - mk["stop0"]) / (mk["freeze0"] - mk["stop0"])
        hold = 1 + int(k * 9)
        fi = int(round(t * FPS))
        fx.update(seed=900000 + (fi // hold) * hold, wobble=0.8 + 9 * k, noise=0.085 + 0.07 * k, bands=((H * (0.2 + 0.6 * k), 60, 28 * k),))
    return a, fx


# =============================================================== 飛び出す（部屋 → 廊下 → 外階段 → 通り）
@lru_cache(maxsize=None)
def hall_base() -> np.ndarray:
    """古いアパートの外廊下。奥が外階段。手すりの向こうに、止まった雨。"""
    rng = np.random.default_rng(91)
    a = np.zeros((H, W, 3), np.float32)
    a[:] = (0.05, 0.055, 0.075)
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    vx, vy = 330, 210  # 消失点
    d.polygon([(0, 0), (640, 0), (vx + 40, vy - 40), (vx - 40, vy - 40)], fill=(24, 25, 30))  # 天井
    d.polygon([(0, 480), (640, 480), (vx + 40, vy + 30), (vx - 40, vy + 30)], fill=(44, 44, 48))  # 床
    d.polygon([(0, 0), (vx - 40, vy - 40), (vx - 40, vy + 30), (0, 480)], fill=(58, 56, 52))  # 壁（ドアの側）
    d.polygon([(640, 0), (vx + 40, vy - 40), (vx + 40, vy + 30), (640, 480)], fill=(12, 14, 22))  # 外（手すり側）
    for k in range(5):  # ドア
        u0, u1 = 0.08 + k * 0.17, 0.08 + k * 0.17 + 0.08
        x0, x1 = (vx - 40) * u0, (vx - 40) * u1
        top0, bot0 = vy - 40 - (vy - 40) * (1 - u0) + 40 * u0, vy + 30 + (480 - vy - 30) * (1 - u0)
        top1, bot1 = vy - 40 - (vy - 40) * (1 - u1) + 40 * u1, vy + 30 + (480 - vy - 30) * (1 - u1)
        top0, top1 = top0 * 0.55 + 70 * u0, top1 * 0.55 + 70 * u1
        d.polygon([(x0, top0 + 40), (x1, top1 + 40), (x1, bot1 - 10), (x0, bot0 - 10)], fill=(92, 84, 70), outline=(30, 28, 24))
    for k in range(9):  # 手すり
        x = 640 - k * 34
        y0_, y1_ = 220 + k * 2, 480 - k * 30
        d.line([(x, y0_), (x - 4, y1_)], fill=(30, 30, 34), width=max(1, 6 - k // 2))
    d.line([(640, 236), (vx + 40, vy + 4)], fill=(36, 36, 40), width=8)
    for k in range(4):  # 天井の蛍光灯
        u = 0.15 + k * 0.22
        x = 640 * (1 - u) * 0.5 + vx * u * 0.5 + (1 - u) * 160
        y = 40 * (1 - u) + (vy - 40) * u
        d.rectangle([x - 34 * (1 - u) - 4, y, x + 34 * (1 - u) + 4, y + 6 * (1 - u) + 2], fill=(232, 240, 236))
    a = to_f(img)
    for k in range(4):
        u = 0.15 + k * 0.22
        x = 640 * (1 - u) * 0.5 + vx * u * 0.5 + (1 - u) * 160
        y = 40 * (1 - u) + (vy - 40) * u
        add_glow(a, x, y + 4, 90 * (1 - u) + 10, 50 * (1 - u) + 6, (0.85, 1.0, 0.9), 0.12)
    n = 900  # 手すりの向こうの止まった雨
    px, py = rng.uniform(vx + 50, 640, n), rng.uniform(0, 470, n)
    br = rng.uniform(0.1, 0.7, n) ** 2
    for k in range(n):
        if py[k] < 480 - (640 - px[k]) * 0.2:
            a[int(py[k]), int(px[k])] += br[k] * np.array([1.0, 0.86, 0.5], np.float32)
    return a


def scene_bolt(tl, sc, t):
    """「みーつけた」から逃げて、２０３号室を飛び出す（外廊下の防犯カメラ・コマ送り）。

    カメラは外階段の上から廊下を見ている。ドアは廊下の中ほど。彼はカメラへ向かって走り、
    すぐ横の階段へ消える。
    """
    mk = tl["marks"]
    tq = math.floor(t * 8) / 8
    lt = max(0.0, tq - sc["t0"])
    door, gone = mk["bolt_door"] - sc["t0"], mk["bolt_gone"] - sc["t0"]
    a = hall_base().copy()
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    # ２０３号室のドア（廊下の中ほど、左の壁）。内側へ勢いよく開く
    dl, dr, dt, db = 158, 214, 150, 318
    op = smooth(ramp(lt, door, door + 0.25))
    d.polygon([(dl, dt), (dr, dt + 12), (dr, db - 8), (dl, db)], fill=(10, 10, 14))  # 開いた戸口の暗がり
    dx = (dr - dl) * (1 - 0.85 * op)
    d.polygon([(dl, dt), (dl + dx, dt + 12 - 6 * op), (dl + dx, db - 8 + 8 * op), (dl, db)], fill=(104, 94, 76), outline=(30, 28, 24))
    if op < 0.5:
        d.ellipse([dl + dx - 12, 232, dl + dx - 5, 239], fill=(190, 190, 180))
    d.rectangle([dl + 8, dt - 22, dl + 44, dt - 6], fill=(220, 216, 200))
    d.text((dl + 26, dt - 14), "203", font=font(F_BOLD, 12), fill=(30, 30, 30), anchor="mm")
    a = to_f(img)
    if lt >= door:
        add_glow(a, (dl + dr) / 2, 240, 30, 70, (0.55, 0.7, 1.0), 0.22 * op)  # 部屋のテレビの明かりがもれる
    # ドアから飛び出して、カメラのほうへ（だんだん大きく）→ 右下へ外れて、外階段へ
    if door + 0.05 <= lt < gone:
        u = (lt - (door + 0.05)) / (gone - door - 0.05)
        x = 200 + 420 * u ** 1.6
        y = 322 + 230 * u ** 1.3
        h = int(150 + 330 * u ** 1.3)
        pose = ["run1", "run2"][int(tq * 8) % 2]
        put_img(a, tako_img(pose, h), x, y - 5 * (int(tq * 8) % 2), bright=0.95)
    a = cctv_grade(a, 0.66)
    cctv_overlay(a, "CAM 01　あおば荘　２階廊下", "03:09", lt, 42)
    a = captions(a, tl, t, 456)
    fx = dict(noise=0.07, wobble=0.6, jitter=0.4, dropout=0.6, bloom=0.6)
    if lt < 0.35:  # 動きだした直後の乱れ
        k = 1 - lt / 0.35
        fx.update(noise=0.07 + 0.4 * k, dropout=12 * k, roll=0.2 * k, bands=((H * (1 - k), 120, 70 * k),))
    if door - 0.2 <= lt < door - 0.05:  # ドアが開く直前に一度だけ乱れる
        fx.update(dropout=5, bands=((420, 60, 24),))
    return a, fx


def scene_burst(tl, sc, t):
    """駅前カメラ：止まった雨の中を走ってくる → 見えない壁にぶつかる → 右の路地へ。"""
    mk = tl["marks"]
    say = {x["id"]: x for x in tl["says"]}
    tq = math.floor(t * 10) / 10
    lt = max(0.0, tq - sc["t0"])
    st = street("wide")
    a = st.bg.copy()
    a += AMBER * (0.085 * np.exp(-YY / 150.0))[..., None]
    a += st.beads + st.beads_sky + st.blink_amt(tq) * (st.beads_blink + st.blink)
    t_hit = say["S02"]["t0"] + 0.7 - sc["t0"]  # 「行き止まり」で、壁にぶつかる
    t_turn = say["R07"]["t0"] + 1.0 - sc["t0"]  # 「次の角、右」で、右へ
    t_gone = say["R07"]["t1"] + 0.6 - sc["t0"]
    flip, pose, face = False, ["run1", "run2"][int(tq * 10) % 2], None
    if lt < t_hit:
        u = smooth(min(1.0, lt / t_hit)) * 0.85 + 0.15 * min(1.0, lt / t_hit)
        X, Z = -5.0 + 5.4 * min(1.0, u * 1.6), 34.0 - 21.0 * u
    elif lt < t_turn:
        k = min(1.0, (lt - t_hit) / 0.5)
        X, Z = 0.4, 13.0 + 2.0 * math.sin(k * math.pi / 2)
        pose = "fear" if lt - t_hit > 0.4 else "startle"
        face = "panic"
    else:
        u = min(1.0, (lt - t_turn) / max(0.1, t_gone - t_turn))
        X, Z = 0.4 + 7.5 * u ** 1.3, 15.0 + 1.0 * u
        flip = True
    if lt < t_gone:
        px, py = st.P(X, 0.0, Z)
        h = int(1.72 * st.f / Z)
        put_img(a, tako_img(pose, h, flip, face=face), px, py + 2, bright=1.0)
        for k in range(8):  # 体に当たった雨粒がはじける
            r = np.random.default_rng(int(tq * 10) * 31 + k)
            add_glow(a, px + r.normal(0, h * 0.18), py - h * r.uniform(0.2, 0.9), 2.0, 2.0, (1.0, 0.9, 0.6), 0.6)
    # 燐の結界：ぶつかった所に、翡翠色の波紋が広がる
    if lt >= t_hit - 0.05:
        k = lt - t_hit
        wx, wy = st.P(0.4, 0.9, 12.0)
        lay = Image.new("L", (W, H), 0)
        ld = ImageDraw.Draw(lay)
        for ring in range(3):
            r = 18 + 80 * max(0.0, k - ring * 0.25)
            g = math.exp(-max(0.0, k - ring * 0.25) * 1.1)
            if r > 18 and g > 0.03:
                ld.ellipse([wx - r, wy - r * 0.7, wx + r, wy + r * 0.7], outline=int(255 * g), width=3)
        rip = np.asarray(lay.filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255.0
        a += rip[..., None] * JADE * 0.9
        sh = 0.05 + 0.04 * math.sin(lt * 7.0)  # 道をふさぐ、うっすらとした壁
        x0, _ = st.P(-3.5, 0, 12.0)
        x1, _ = st.P(3.5, 0, 12.0)
        _, y0 = st.P(0, 6.0, 12.0)
        _, y1 = st.P(0, 0, 12.0)
        a[int(max(0, y0)) : int(min(H, y1)), int(max(0, x0)) : int(min(W, x1))] += JADE * sh
    a = broadcast_overlay(tl, sc, t, a)
    a = captions(a, tl, t, 456)
    fx = dict(noise=0.07, bloom=0.75, wobble=0.8)
    if lt < 0.3:
        k = 1 - lt / 0.3
        fx.update(noise=0.07 + 0.3 * k, dropout=8 * k, bands=((H * (1 - k), 90, 40 * k),))
    if abs(lt - t_hit) < 0.2:
        fx.update(dropout=6, jitter=2.0, bands=((H * 0.6, 60, 30),))
    return a, fx


# =============================================================== 止まった画面
FZ1 = "ごめんね。ちょっとだけ、うごかないで"


def scene_freeze(tl, sc, t):
    mk = tl["marks"]
    f0, r0 = mk["freeze0"], mk["release0"]
    ft = t - f0
    if t >= r0:  # 動きだす
        k = max(0.0, 1 - (t - r0) / 0.45)
        a = np.full((H, W, 3), 0.25 + 0.6 * k, np.float32)
        return a, dict(noise=0.3 + 0.4 * k, dropout=14, roll=0.3 * k, sat=0.0, bands=((H * (1 - k), 120, 70),))
    sil, streak = silhouette()
    mix = smooth(ramp(ft, 1.0, 3.6))
    b = room_frame(tl, f0, show_found=ft < 0.6) * (1 - mix) + np.full((H, W, 3), 0.30, np.float32) * mix
    sm = sil * mix
    b *= (1 - 0.80 * sm)[..., None]
    b += (streak * sm * 0.30)[..., None] * YELLOW
    op = smooth(ramp(t, mk["fz_eyes_open"], mk["fz_eyes_open"] + 0.9))
    slit = 4.6 - 2.4 * smooth(ramp(t, mk["fz_look3"], mk["fz_look3"] + 0.6)) + 4.6 * smooth(ramp(t, mk["y07"], mk["y07"] + 0.5))
    smile = 0.62 * smooth(ramp(t, mk["y05"] - 0.1, mk["y05"] + 0.35))
    eyes_layer(b, op * (1 + 0.12 * smooth(ramp(t, mk["y07"], mk["y07"] + 0.5))), 0.0, slit, mix, smile)

    def line(text: str, y: int, scale: int = 2) -> None:
        if not text:
            return
        m = pix_mask(text, scale)
        w = min(W, m.shape[1])
        x0 = max(0, 320 - w // 2)
        big = np.zeros((H, W), np.float32)
        big[y : y + m.shape[0], x0 : x0 + w] = m[:, :w]
        put_glow_text(b, big, YELLOW)

    if t < mk["y05"] - 0.25:
        s = typed(FZ1, t, mk["fz_text1"], 6.5)
        if s:
            m = pix_mask(s, 2)
            big = np.zeros((H, W), np.float32)
            x0 = 320 - pix_mask(FZ1, 2).shape[1] // 2
            big[392 : 392 + m.shape[0], x0 : x0 + m.shape[1]] = m
            put_glow_text(b, big, YELLOW)
    elif t < mk["y06"] - 0.1:
        line(typed("みーつけた♡", t, mk["y05"], 9), 372, 4)
    elif t < mk["y07"] - 0.1:
        line(typed("「ブス」って言ったの　４７回♡", t, mk["y06"], 8), 366)
        line(typed("あーし、ぜんぶ覚えてるよ♡", t, mk["y06"] + 2.7, 8), 410)
    else:
        line(typed("そういう生意気なとこ", t, mk["y07"], 8), 366)
        line(typed("ほんと、たまんない♡", t, mk["y07"] + 1.9, 8), 410)
    fx = dict(seed=424242, noise=0.07 + 0.075 * mix, cnoise=0.03, wobble=0.0, jitter=0.0, dropout=0.0, bloom=0.7, sat=1.0)
    if t >= mk["scream0"]:  # 悲鳴。画面が暴れだす
        k = (t - mk["scream0"]) / (r0 - mk["scream0"])
        fx = dict(noise=0.15 + 0.2 * k, wobble=10 * k, jitter=3 * k, dropout=8 * k, roll=0.15 * k, bloom=0.7, sat=1.0)
    return b, fx


# =============================================================== 防犯カメラ：つかまる
# 通りの奥の暗がりで光る目（x, y, 間隔, 瞳の色）。色は設定資料 2-2 の瞳の色。
# 瞳の色が未設定の家族（ザイナ・燐・ニルメ）は、色を決めないように、くすんだ白にする。
# フルルは前髪で目が隠れているので、ここには出さない。
EYE_UNSET = (0.80, 0.78, 0.72)
EYES = [
    (318, 168, 12, (1.00, 0.76, 0.28)),  # ユリア　琥珀金
    (262, 178, 9, (0.62, 0.85, 1.00)),  # ヴォル　淡青
    (378, 176, 9, EYE_UNSET),  # ニルメ
    (226, 194, 8, (0.74, 0.70, 0.95)),  # ルリカ　淡い紫〜青灰
    (414, 192, 8, (1.00, 0.86, 0.48)),  # テルエス　淡い金〜琥珀
    (292, 146, 7, EYE_UNSET),  # 燐
    (184, 208, 7, (0.70, 1.00, 0.30)),  # ミリア　黄緑
    (458, 206, 7, (1.00, 0.42, 0.16)),  # アセラ　赤橙
    (136, 226, 6, EYE_UNSET),  # ザイナ
]


def _bound(d: ImageDraw.ImageDraw, cx: float, cy: float, w: float, hh: float, n: int, wd: int) -> None:
    """体に巻きついた糸。"""
    jade = tuple(int(c * 255) for c in JADE)
    for k in range(n):
        y = cy - hh * 0.36 + k * hh * 0.72 / max(1, n - 1) if n > 1 else cy
        sl = 3 if k % 2 == 0 else -3
        d.line([(cx - w, y - sl), (cx + w, y + sl)], fill=jade, width=wd)


def _headphones(d: ImageDraw.ImageDraw, x: float, y: float, s: float) -> None:
    d.arc([x - 9 * s, y - 12 * s, x + 9 * s, y + 6 * s], 180, 360, fill=(14, 14, 16), width=max(2, int(2.4 * s)))
    for sg in (-1, 1):
        d.rectangle([x + sg * 9 * s - 4 * s, y - 4 * s, x + sg * 9 * s + 4 * s, y + 5 * s], fill=(120, 124, 130))
        d.rectangle([x + sg * 9 * s - 2 * s, y - 2 * s, x + sg * 9 * s + 2 * s, y + 3 * s], fill=(24, 24, 28))


def scene_capture(tl, sc, t):
    mk = tl["marks"]
    c0 = mk["capture0"]
    tq = math.floor(t * 8) / 8
    lt = max(0.0, tq - c0)
    hit, fall, d0, d1 = mk["cap_hit"] - c0, mk["cap_fall"] - c0, mk["drag0"] - c0, mk["drag1"] - c0
    st = street("cctv")
    a = st.bg.copy()
    a += AMBER * (0.085 * np.exp(-YY / 150.0))[..., None]
    a += st.beads + st.beads_sky + st.blink_amt(tq) * (st.beads_blink + st.blink)

    # 位置
    if lt < fall:
        Z = 44.0 - 26.0 * min(1.0, lt / hit) ** 0.9
        X = 0.9 + 0.45 * math.sin(lt * 3.0)
    elif lt < d0:
        Z, X = 18.0, 1.0
    else:
        u = min(1.0, (lt - d0) / (d1 - d0))
        Z, X = 18.0 + 46.0 * u ** 1.6, 1.0 - 0.7 * u
    px, py = st.P(X, 0.0, Z)
    h = max(10, int(1.72 * st.f / Z))
    gone = lt >= d1

    img = to_pil(a)
    d = ImageDraw.Draw(img)
    if lt >= d0:  # 引きずられた跡
        zs = np.linspace(18.3, Z if not gone else 64.0, 30)
        for off in (-0.16, 0.16):
            pts = [st.P(1.0 - 0.7 * min(1.0, ((z - 18.0) / 46.0) ** (1 / 1.6)) + off, 0.0, z) for z in zs]
            d.line(pts, fill=(5, 5, 7), width=2)
    if lt >= fall:  # 落ちたヘッドホン
        hx, hy = st.P(2.0, 0.0, 17.2)
        _headphones(d, hx, hy - 4, 1.5)
    a = to_f(img)

    # 暗がりの目
    for k, (ex, ey, gap, col) in enumerate(EYES):
        on = smooth(ramp(lt, fall + 0.5 + 0.22 * k, fall + 1.1 + 0.22 * k)) * (1 - smooth(ramp(lt, d1 + 0.5 + 0.12 * k, d1 + 1.0 + 0.12 * k)))
        if on > 0.01:
            g = 1.3 if col is not EYE_UNSET else 0.8
            for sg in (-1, 1):
                add_glow(a, ex + sg * gap / 2, ey, gap * 0.28, gap * 0.2, col, g * on)

    # 体の中心と高さ（糸と光を、絵の上の体に合わせるため）
    body_cy, body_h = py - h * 0.5, float(h)
    if not gone:
        lit = 0.55 + 0.45 * min(1.0, 40.0 / ((X - LAMP1[0]) ** 2 + (Z - LAMP1[2]) ** 2 + 20.0))
        if lt < fall:  # 走ってくる
            pose = ["run1", "run2"][int(lt * 8) % 2]
            put_img(a, tako_img(pose, h), px, py + 2 - 3 * (int(lt * 8) % 2), bright=lit)
        else:  # 倒れている／引きずられる（足が奥、頭が手前）
            rot = int(180 * smooth(ramp(lt, fall, fall + 0.25))) + int(np.random.default_rng(int(lt * 8)).integers(-6, 7))
            sp = tako_img("down", int(h * 1.1), False, rot, 0.6, face=("grit" if int(lt * 4) % 2 else None))
            body_cy, body_h = py + sp.shape[0] * 0.25, float(sp.shape[0])
            put_img(a, sp, px, body_cy, anchor="center", bright=min(1.15, lit * 1.2))
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    jade = tuple(int(c * 255) for c in JADE)
    if lt >= hit - 0.25 and not gone:  # 糸
        p = smooth(ramp(lt, hit - 0.25, hit))
        srcs = [st.P(-5.5, 3.0, 62.0), st.P(5.5, 4.0, 56.0), st.P(0.2, 9.0, 80.0), st.P(-2.0, 0.3, 50.0), st.P(2.4, 0.3, 66.0)]
        for k, (sx, sy) in enumerate(srcs):
            tx, ty = px + (k - 2) * h * 0.07, body_cy + (k - 2) * body_h * 0.15
            jit = float(np.random.default_rng(int(lt * 8) * 7 + k).normal(0, 1.2))
            d.line([(sx, sy), (sx + (tx - sx) * p + jit, sy + (ty - sy) * p)], fill=jade, width=1 if Z > 30 else 2)
        if lt >= fall:  # 体に巻きつく
            n = int(1 + 5 * smooth(ramp(lt, fall, fall + 1.6)))
            _bound(d, px, body_cy, h * 0.26, body_h, n, max(1, h // 30))
    a = to_f(img)
    if lt >= hit - 0.25 and not gone:
        add_glow(a, px, body_cy, h * 0.4, body_h * 0.3, JADE, 0.12)
    a = cctv_grade(a, 0.72)
    cctv_overlay(a, sc["args"]["cam"], sc["args"]["stamp"], lt, 21)
    a = captions(a, tl, t, 456)
    fx = dict(noise=0.07, wobble=0.8, jitter=0.4, dropout=0.8, bloom=0.75)
    if t - c0 < 0.4:
        k = 1 - (t - c0) / 0.4
        fx.update(noise=0.07 + 0.3 * k, dropout=9 * k, bands=((H * (1 - k), 90, 50 * k),))
    if abs(lt - hit) < 0.3:
        fx.update(dropout=5, bands=((py - h * 0.5, 50, 26),))
    return a, fx


# =============================================================== 婚姻届
@lru_cache(maxsize=None)
def form_paper() -> Image.Image:
    rng = np.random.default_rng(88)
    pw, ph = 560, 400
    p = Image.new("RGBA", (pw, ph), (226, 218, 196, 255))
    d = ImageDraw.Draw(p)
    ink = (36, 34, 40, 255)
    d.rectangle([14, 14, pw - 15, ph - 15], outline=(120, 90, 70, 255), width=2)
    d.text((pw // 2, 46), "婚　姻　届", font=font(F_MIN_BLACK, 40), fill=(96, 54, 44, 255), anchor="mm")
    d.text((pw - 30, 82), "届出日　　　年　　月　　日", font=font(F_MIN_BOLD, 14), fill=ink, anchor="rm")
    x0, x1, xm, xl = 30, pw - 30, 300, 120
    rows = [100, 136, 226, 276, 330]
    for y in rows + [ph - 34]:
        d.line([(x0, y), (x1, y)], fill=ink, width=2)
    for x in (x0, xl, xm, x1):
        d.line([(x, rows[0]), (x, ph - 34)], fill=ink, width=2)
    f14 = font(F_MIN_BOLD, 16)
    d.text(((xl + xm) // 2, 118), "夫になる人", font=f14, fill=ink, anchor="mm")
    d.text(((xm + x1) // 2, 118), "妻になる人", font=f14, fill=ink, anchor="mm")
    for y, s in [(181, "氏　名"), (251, "住　所"), (303, "証　人"), (348, "印")]:
        d.text(((x0 + xl) // 2, y), s, font=f14, fill=ink, anchor="mm")
    br = font(F_BRUSH, 46)
    d.text(((xl + xm) // 2, 181), "タコくん", font=br, fill=(30, 30, 44, 255), anchor="mm")
    # 妻の欄：何人もの名前が重ね書きされている。読めるのは一つだけ
    for col in [(120, 170, 230), (236, 150, 180), (40, 170, 110), (140, 90, 220), (200, 60, 50), (230, 140, 40)]:
        for _ in range(5):
            xa, ya = int(rng.integers(xm + 14, x1 - 50)), int(rng.integers(144, 216))
            d.line([(xa, ya), (xa + int(rng.integers(20, 60)), ya + int(rng.integers(-18, 18)))], fill=col + (200,), width=int(rng.integers(2, 5)))
    d.text(((xm + x1) // 2, 181), "ユリア", font=font(F_BRUSH, 56), fill=(150, 84, 0, 255), anchor="mm",
           stroke_width=2, stroke_fill=(150, 84, 0, 255))
    d.text(((xl + xm) // 2, 251), "（逃走中）", font=font(F_BRUSH, 28), fill=(30, 30, 44, 255), anchor="mm")
    d.text(((xm + x1) // 2, 251), "うちゅうの外", font=font(F_BRUSH, 28), fill=(150, 84, 0, 255), anchor="mm")
    heart_text(d, ((xl + x1) // 2, 303), "ママ　♡", font(F_BRUSH, 30), (120, 110, 110, 255), heart_font=font(F_MIN_BOLD, 26))
    for _ in range(11):  # 妻の側の印は、もう押してある
        cx, cy = int(rng.integers(xm + 30, x1 - 30)), int(rng.integers(340, 356))
        d.ellipse([cx - 13, cy - 13, cx + 13, cy + 13], outline=(196, 40, 36, 230), width=3)
    cx, cy = xm - 26, 348  # 夫の側は空欄
    for k in range(12):
        d.arc([cx - 14, cy - 14, cx + 14, cy + 14], k * 30, k * 30 + 16, fill=(150, 60, 50, 255), width=2)
    note = Image.new("RGBA", (124, 30), (250, 226, 90, 255))
    heart_text(ImageDraw.Draw(note), (62, 15), "ここにハンコ♡", font(F_BRUSH, 18), (60, 40, 10, 255), heart_font=font(F_MIN_BOLD, 16))
    note = note.rotate(4, expand=True)
    p.paste(note, (xl + 6, 330), note)
    return p


def form_frame(zoom: float = 1.0) -> np.ndarray:
    rng = np.random.default_rng(89)
    a = np.zeros((H, W, 3), np.float32)
    a[:] = (0.07, 0.05, 0.04)
    for _ in range(60):
        y = int(rng.integers(0, H))
        a[y : y + 1, :] *= float(rng.uniform(0.6, 1.3))
    img = to_pil(a)
    p = form_paper().rotate(-4, resample=Image.BICUBIC, expand=True)
    w, h = int(p.width * zoom), int(p.height * zoom)
    p = p.resize((w, h), Image.BILINEAR)
    img.paste(p, (320 - w // 2, 206 - h // 2), p)
    out = to_f(img)
    return out * (0.9 - 0.25 * (np.hypot((XX - 320) / 320, (YY - 240) / 240) ** 2))[..., None]


def scene_form(tl, sc, t):
    lt = t - sc["t0"]
    a = form_frame(1.0 + 0.02 * lt)
    a = captions(a, tl, t, 474)
    fx = dict(noise=0.05, wobble=0.6, dropout=0.4, bloom=0.4)
    if lt < 0.35:
        k = 1 - lt / 0.35
        fx.update(noise=0.05 + 0.3 * k, dropout=8 * k, bands=((H * (1 - k), 90, 40 * k),))
    return a, fx


# =============================================================== 「みつけた」
def scene_found(tl, sc, t):
    mk = tl["marks"]
    a = np.zeros((H, W, 3), np.float32)
    a[:] = (0.0, 0.012, 0.008)
    if t < mk["hj_clear"]:
        m = pix_mask("みつけた", 5)
        big = np.zeros((H, W), np.float32)
        x0, y0 = 320 - m.shape[1] // 2, 150
        big[y0 : y0 + m.shape[0], x0 : x0 + m.shape[1]] = m
        put_glow_text(a, big, GREEN, smooth(ramp(t, mk["hj_found"], mk["hj_found"] + 0.15)))
        s = typed("はい、おしまい", t, mk["hj_bye"], 8)
        if s:
            put_glow_text(a, grid_layer([(6, 10, s)]), GREEN, 0.8)
    return a, dict(noise=0.04, cnoise=0.03, wobble=0.4, jitter=0.2, dropout=0.1)


# =============================================================== 雨。引きずられていく
# 傘の列。後ろ姿なので、見えるのは傘の色と白い髪だけ。
# (横位置X, 奥行きZ, 背丈, 傘の色, 髪型, 歩調のずれ)
WALKERS = [
    (-0.25, 27.6, 1.66, (236, 232, 222), "short", 0.0),
    (0.95, 28.4, 1.63, (240, 205, 40), "sideup", 1.1),
    (1.60, 28.6, 1.62, (150, 205, 240), "pony", 2.3),
    (2.75, 29.7, 1.79, (120, 22, 30), "bob", 0.6),
    (-0.10, 30.0, 1.53, (92, 80, 200), "bob", 1.7),
    (-0.80, 30.3, 1.45, (176, 230, 70), "twin", 2.9),
    (0.60, 30.4, 1.68, (245, 180, 200), "long", 0.3),
    (-1.70, 31.3, 1.47, (40, 170, 130), "tie", 1.4),
    (1.75, 31.7, 1.58, (240, 140, 40), "short", 2.0),
    (0.20, 33.8, 1.50, (150, 80, 200), "messy", 2.6),
]
WALK_SPEED = 0.23


def draw_walkers(st, a: np.ndarray, lt: float, alpha: float) -> np.ndarray:
    img = to_pil(a)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for X, Z0, hgt, ucol, hair, ph in sorted(WALKERS, key=lambda w: -w[1]):
        Z = Z0 + WALK_SPEED * lt
        s = st.f / Z
        step = math.sin(2 * math.pi * 1.3 * lt + ph)
        bob = 0.025 * abs(step) * (2.2 if hair == "messy" else 1.0)
        gx, gy = st.P(X, 0, Z)
        lit = 0.35 + 0.65 * min(1.0, 60.0 / ((X - LAMP2[0]) ** 2 + (Z - LAMP2[2]) ** 2 + 30.0))

        def pt(dx, y):
            return gx + dx * s, gy - (y + bob) * s

        body = (int(13 + 14 * lit), int(13 + 14 * lit), int(17 + 16 * lit), 255)
        for sg in (-1, 1):
            d.line([pt(sg * 0.07, 0.80), pt(sg * 0.07 + sg * 0.05 * step, 0.0)], fill=body, width=max(1, int(0.11 * s)))
        d.polygon([pt(-0.20, 0.72), pt(-0.23, hgt - 0.36), pt(0.23, hgt - 0.36), pt(0.20, 0.72)], fill=body)
        hc = (int(200 * lit + 25), int(200 * lit + 25), int(208 * lit + 28), 255)
        cx, cy = pt(0, hgt - 0.14)
        r = 0.125 * s
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hc)
        if hair == "long":
            d.polygon([pt(-0.14, hgt - 0.16), pt(-0.17, hgt - 0.85), pt(0.17, hgt - 0.85), pt(0.14, hgt - 0.16)], fill=hc)
        elif hair == "bob":
            d.rectangle([cx - r * 1.15, cy - r * 0.2, cx + r * 1.15, cy + r * 1.15], fill=hc)
        elif hair == "twin":
            for sg in (-1, 1):
                d.polygon([pt(sg * 0.10, hgt - 0.08), pt(sg * 0.30, hgt - 0.30), pt(sg * 0.27, hgt - 0.78), pt(sg * 0.15, hgt - 0.40)], fill=hc)
        elif hair == "pony":
            d.polygon([pt(-0.05, hgt - 0.10), pt(-0.07, hgt - 0.62), pt(0.07, hgt - 0.62), pt(0.05, hgt - 0.10)], fill=hc)
        elif hair == "tie":
            d.polygon([pt(-0.04, hgt + 0.02), pt(-0.06, hgt - 0.50), pt(0.06, hgt - 0.50), pt(0.04, hgt + 0.02)], fill=hc)
        elif hair == "sideup":
            d.polygon([pt(0.08, hgt - 0.02), pt(0.25, hgt - 0.12), pt(0.24, hgt - 0.58), pt(0.13, hgt - 0.30)], fill=hc)
        elif hair == "messy":
            d.line([pt(0, hgt - 0.03), pt(0.05, hgt + 0.10)], fill=hc, width=max(1, int(0.04 * s)))
        uc = tuple(int(c * (0.30 + 0.60 * lit)) for c in ucol) + (255,)
        ut = tuple(min(255, int(c * (0.55 + 0.75 * lit))) for c in ucol) + (255,)
        ux, uy = pt(0.04, hgt + 0.02)
        rw, rh = 0.50 * s, 0.34 * s
        d.pieslice([ux - rw, uy - rh, ux + rw, uy + rh], 180, 360, fill=uc)
        d.pieslice([ux - rw * 0.55, uy - rh, ux + rw * 0.55, uy + rh * 0.3], 180, 360, fill=ut)
        d.line([(ux, uy - rh), (ux, uy - rh - 0.06 * s)], fill=uc, width=1)
    if alpha < 1:
        lay.putalpha(lay.getchannel("A").point(lambda v: int(v * alpha)))
    img.paste(lay, (0, 0), lay)
    return to_f(img)


def draw_dragged(st, a: np.ndarray, lt: float) -> np.ndarray:
    """糸でぐるぐる巻きにされ、列の後ろを引きずられていくタコくん。"""
    Z = 25.2 + WALK_SPEED * lt
    X = 0.7
    px, py = st.P(X, 0.0, Z)
    h = int(1.72 * st.f / Z)
    r = np.random.default_rng(int(lt * 10))
    rot = 180 + int(r.integers(-9, 10))
    sp = tako_img("bound" if int(lt * 3) % 3 else "bound_grit", int(h * 1.1), False, rot, 0.6)
    hh = sp.shape[0]
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    for off in (-0.17, 0.17):  # 引きずった跡
        d.line([st.P(X + off, 0.0, z) for z in np.linspace(max(12.0, Z - 14.0), Z - 0.3, 14)], fill=(8, 8, 10), width=2)
    a = to_f(img)
    lit = 0.5 + 0.5 * min(1.0, 60.0 / ((X - LAMP2[0]) ** 2 + (Z - LAMP2[2]) ** 2 + 30.0))
    cx = px + float(r.integers(-2, 3))
    cy = py - hh * 0.32
    put_img(a, sp, cx, cy, anchor="center", bright=min(1.15, lit * 1.25))
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    jade = tuple(int(c * 255) for c in JADE)
    _bound(d, cx, cy, h * 0.26, hh, 6, max(1, h // 30))  # 巻きついた糸
    for wi in (1, 3, 7):  # 列の手もとへのびる糸
        X2, Z0, hgt = WALKERS[wi][0], WALKERS[wi][1], WALKERS[wi][2]
        Z2 = Z0 + WALK_SPEED * lt
        gx, gy = st.P(X2 + 0.25, 0.0, Z2)
        d.line([(cx, cy - hh * 0.42), (gx, gy - (hgt - 0.7) * st.f / Z2)], fill=jade, width=1)
    a = to_f(img)
    add_glow(a, cx, cy, h * 0.3, h * 0.22, JADE, 0.08)
    return a


def scene_umbrella(tl, sc, t):
    lt = math.floor(t * 15) / 15 - sc["t0"]  # 雨と人影は1秒15コマで動かす（動画が軽くなる）
    st = street("tele")
    a = st.bg.copy()
    a += st.blink_amt(lt) * st.blink
    a = draw_walkers(st, a, lt, 1.0)
    a = draw_dragged(st, a, lt)
    a += st.rain_layer(lt)
    rng = np.random.default_rng(int(lt * 15) + 5)
    rip = np.repeat(np.repeat(rng.random((H // 4, W // 8), dtype=np.float32), 4, 0), 8, 1)
    a *= (0.94 + 0.12 * rip)[..., None]
    a = broadcast_overlay(tl, sc, t, a)
    a = captions(a, tl, t, 372)
    fx = dict(noise=0.07, bloom=0.75)
    if lt < 0.4:
        k = 1 - lt / 0.4
        fx.update(noise=0.075 + 0.3 * k, dropout=8 * k)
    return a, fx


SCENES2 = {
    "bolt": scene_bolt, "burst": scene_burst, "statement": scene_statement,
    "vend": scene_vend, "notice": scene_notice, "storm": scene_storm, "room": scene_room, "freeze": scene_freeze,
    "capture": scene_capture, "form": scene_form, "found": scene_found, "umbrella": scene_umbrella,
}
