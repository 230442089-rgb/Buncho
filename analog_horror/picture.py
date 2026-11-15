"""映像。各場面の絵を描き、VHSテープらしい劣化をかける。

すべての場面は「時刻 t の純粋な関数」として描く（前のフレームの状態を持たない）ので、
フレーム単位で並列に描ける。
"""
from __future__ import annotations

import math
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy.ndimage import gaussian_filter, uniform_filter1d

from timeline import DISTRICTS_FAST, DISTRICTS_SLOW

W, H, FPS = 640, 480, 30
XX = np.arange(W)[None, :].repeat(H, 0)
YY = np.arange(H)[:, None].repeat(W, 1)

F_BLACK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
F_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
F_MARU = "/usr/share/fonts/truetype/motoya-l-maruberi/MTLmr3m.ttf"
F_MIN_BLACK = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Black.ttc"
F_MIN_BOLD = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
F_PIX = "/usr/share/fonts/opentype/unifont/unifont_jp.otf"

GREEN = np.array([0.18, 1.0, 0.55], np.float32)  # 緑の文字
AMBER = np.array([1.0, 0.72, 0.18], np.float32)  # 空の光・信号
YELLOW = np.array([1.0, 0.86, 0.22], np.float32)  # 黄色の文字


@lru_cache(maxsize=None)
def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def to_pil(a: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def to_f(img: Image.Image) -> np.ndarray:
    return np.asarray(img, dtype=np.float32) / 255.0


def smooth(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def ramp(t: float, t0: float, t1: float) -> float:
    if t1 <= t0:
        return 1.0 if t >= t0 else 0.0
    return min(1.0, max(0.0, (t - t0) / (t1 - t0)))


# =============================================================== 文字
@lru_cache(maxsize=4096)
def pix_mask(text: str, scale: int = 2) -> np.ndarray:
    """16ドットのビットマップ文字（アンチエイリアスなし）を拡大したマスク。"""
    fnt = font(F_PIX, 16)
    w = max(1, int(math.ceil(fnt.getlength(text))))
    img = Image.new("L", (w, 16), 0)
    d = ImageDraw.Draw(img)
    d.fontmode = "1"
    d.text((0, 0), text, 255, font=fnt)
    m = (np.asarray(img) > 127).astype(np.float32)
    return np.repeat(np.repeat(m, scale, 0), scale, 1)


def blit_mask(a: np.ndarray, m: np.ndarray, x: int, y: int, color, alpha: float = 1.0) -> None:
    h, w = m.shape
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    mm = m[y0 - y : y1 - y, x0 - x : x1 - x, None] * alpha
    a[y0:y1, x0:x1] = a[y0:y1, x0:x1] * (1 - mm) + np.asarray(color, np.float32) * mm


def pix_text(a: np.ndarray, text: str, x: int, y: int, color=(1, 1, 1), scale: int = 2, shadow: bool = True) -> None:
    m = pix_mask(text, scale)
    if shadow:
        blit_mask(a, m, x + scale, y + scale, (0, 0, 0), 0.8)
    blit_mask(a, m, x, y, color)


def telop_text(d: ImageDraw.ImageDraw, xy, text: str, fnt, fill, stroke: int = 3,
               stroke_fill=(8, 10, 24), anchor: str = "lm", shadow: int = 2) -> None:
    x, y = xy
    if shadow:
        d.text((x + shadow, y + shadow), text, font=fnt, fill=(0, 0, 0), anchor=anchor,
               stroke_width=stroke, stroke_fill=(0, 0, 0))
    d.text((x, y), text, font=fnt, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=stroke_fill)


def band(a: np.ndarray, x0: int, y0: int, x1: int, y1: int, color, alpha: float) -> None:
    a[y0:y1, x0:x1] = a[y0:y1, x0:x1] * (1 - alpha) + np.asarray(color, np.float32) * alpha


def add_glow(a: np.ndarray, x: float, y: float, sx: float, sy: float, color, gain: float) -> None:
    """ガウス形の光をその場に足す。"""
    rx, ry = int(sx * 3.5) + 1, int(sy * 3.5) + 1
    x0, x1 = max(0, int(x) - rx), min(W, int(x) + rx + 1)
    y0, y1 = max(0, int(y) - ry), min(H, int(y) + ry + 1)
    if x1 <= x0 or y1 <= y0:
        return
    gx = np.exp(-0.5 * ((np.arange(x0, x1) - x) / sx) ** 2)
    gy = np.exp(-0.5 * ((np.arange(y0, y1) - y) / sy) ** 2)
    g = (gy[:, None] * gx[None, :]).astype(np.float32) * gain
    a[y0:y1, x0:x1] += g[..., None] * np.asarray(color, np.float32)


# =============================================================== VHS
FX0 = dict(
    noise=0.055, line_noise=0.006, cnoise=0.030, cblur=13, cshift=3, ring=0.35,
    jitter=0.35, wobble=0.7, headswitch=9, flag=0.0, dropout=0.22, bands=(),
    roll=0.0, sat=0.92, bloom=0.55, contrast=1.0, bright=0.0, seed=None, hue=0.0,
)

import os as _os

NOISE_HOLD = int(_os.environ.get("NOISE_HOLD", "2"))
NOISE_GAIN = float(_os.environ.get("NOISE_GAIN", "0.7"))
NOISE_GRAIN = int(_os.environ.get("NOISE_GRAIN", "2"))

_rr = np.hypot((XX - W / 2) / (W / 2), (YY - H / 2) / (H / 2)) / math.sqrt(2)
VIGNETTE = (1 - 0.30 * _rr ** 2.2).astype(np.float32)[..., None]
ROWS = np.arange(H)


def vhs(img: np.ndarray, t: float, fx: dict, frame_index: int) -> np.ndarray:
    p = dict(FX0)
    p.update(fx)
    seed = frame_index if p["seed"] is None else p["seed"]
    # 揺れも NOISE_HOLD フレーム単位で進める。止まっている間は揺れも止める
    tt = (frame_index // NOISE_HOLD) * NOISE_HOLD / FPS if p["seed"] is None else 0.0
    # 粒ノイズは NOISE_HOLD フレームごとに入れ替える（毎フレーム変えると動画が極端に重くなる）
    rng = np.random.default_rng(7919 * ((seed // NOISE_HOLD) * NOISE_HOLD + 11))
    rng_ev = np.random.default_rng(104729 * (seed + 3))  # すじ・乱れなど、1コマだけの出来事

    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    i = 0.596 * r - 0.274 * g - 0.322 * b
    q = 0.211 * r - 0.523 * g + 0.312 * b

    # 輝度は少し甘く、輪郭に縁（リンギング）が出る。色はもっと甘く、右へずれる
    y = uniform_filter1d(y, 3, axis=1, mode="nearest")
    y = y + p["ring"] * (y - uniform_filter1d(y, 11, axis=1, mode="nearest"))
    cb = int(p["cblur"])
    i = uniform_filter1d(uniform_filter1d(i, cb, axis=1, mode="nearest"), 3, axis=0, mode="nearest")
    q = uniform_filter1d(uniform_filter1d(q, cb, axis=1, mode="nearest"), 3, axis=0, mode="nearest")
    if p["cshift"]:
        i = np.roll(i, p["cshift"], axis=1)
        q = np.roll(q, p["cshift"], axis=1)
    # 色相のゆらぎ
    ang = p["hue"] + 0.05 * np.sin(ROWS / 41.0 + tt * 2.3) + 0.03 * math.sin(tt * 0.7)
    ca, sa = np.cos(ang)[:, None].astype(np.float32), np.sin(ang)[:, None].astype(np.float32)
    i, q = (i * ca - q * sa) * p["sat"], (i * sa + q * ca) * p["sat"]

    # ノイズ（横に伸びた粒）
    n = rng.standard_normal((H // 2, W // NOISE_GRAIN + 2), dtype=np.float32)
    n = uniform_filter1d(np.repeat(np.repeat(n, 2, axis=0), NOISE_GRAIN, axis=1)[:, :W], 3, axis=1)
    y = y + p["noise"] * NOISE_GAIN * n + p["line_noise"] * rng.standard_normal((H, 1), dtype=np.float32)
    cn = rng.standard_normal((2, H // 2, W // 16 + 1), dtype=np.float32)
    cn = uniform_filter1d(np.repeat(np.repeat(cn, 2, axis=1), 16, axis=2)[:, :, :W], 9, axis=2)
    i = i + p["cnoise"] * cn[0]
    q = q + p["cnoise"] * cn[1]

    # 走査線ごとの横ずれ
    dx = p["wobble"] * np.sin(ROWS / H * 8.2 + tt * 2.1) + p["jitter"] * rng.standard_normal(H)
    for yc, hh, amp in p["bands"]:  # トラッキングの乱れ
        w = np.exp(-0.5 * ((ROWS - yc) / max(1.0, hh / 2.2)) ** 2)
        dx += amp * w * (0.6 + 0.8 * rng_ev.standard_normal(H))
        k = w > 0.25
        nk = int(k.sum())
        if nk:
            streak = uniform_filter1d(rng_ev.standard_normal((nk, W), dtype=np.float32), 25, axis=1) * 4.0
            y[k] = y[k] * 0.55 + 0.25 + 0.5 * np.clip(streak, -0.5, 1.0) * min(1.0, abs(amp) / 20.0)
            i[k] *= 0.3
            q[k] *= 0.3
    hs = int(p["headswitch"])
    if hs:  # 画面最下部のヘッド切り替えノイズ
        dx[H - hs:] += np.linspace(6, 34, hs) + 5 * rng.standard_normal(hs)
        y[H - hs:] += 0.10 * rng.standard_normal((hs, W), dtype=np.float32) + 0.05
    if p["flag"]:
        dx += p["flag"] * np.exp(-ROWS / 14.0)
    idx = np.clip(XX - np.round(dx).astype(np.int64)[:, None], 0, W - 1)
    y = np.take_along_axis(y, idx, axis=1)
    i = np.take_along_axis(i, idx, axis=1)
    q = np.take_along_axis(q, idx, axis=1)

    # ドロップアウト（白い横すじ）
    for _ in range(int(rng_ev.poisson(p["dropout"]))):
        row = int(rng_ev.integers(0, H - 1))
        x0 = int(rng_ev.integers(0, W - 20))
        ln = int(rng_ev.integers(14, 150))
        x1 = min(W, x0 + ln)
        tail = np.linspace(1.0, 0.25, x1 - x0, dtype=np.float32)
        y[row, x0:x1] = np.maximum(y[row, x0:x1], 0.95 * tail)
        y[row + 1, x0:x1] = np.maximum(y[row + 1, x0:x1], 0.45 * tail)

    if p["roll"]:  # 垂直同期の流れ
        sh = int(p["roll"] * H) % H
        if sh:
            y, i, q = np.roll(y, sh, axis=0), np.roll(i, sh, axis=0), np.roll(q, sh, axis=0)
            b0, b1 = max(0, sh - 10), min(H, sh + 10)
            y[b0:b1] = 0.02
            i[b0:b1] = 0
            q[b0:b1] = 0
            if sh + 2 < H:
                y[sh : sh + 2] = 0.8

    out = np.stack([y + 0.956 * i + 0.621 * q, y - 0.272 * i - 0.647 * q, y - 1.106 * i + 1.703 * q], axis=-1)

    if p["bloom"]:  # 明るい所のにじみ
        hi = np.clip(out[::4, ::4] - 0.60, 0, 1)
        hi = gaussian_filter(hi, sigma=(2.4, 3.2, 0))
        hi = np.repeat(np.repeat(hi, 4, axis=0), 4, axis=1)[:H, :W]
        out = out + p["bloom"] * uniform_filter1d(uniform_filter1d(hi, 5, axis=0), 5, axis=1)

    out = (out - 0.5) * p["contrast"] + 0.5 + p["bright"]
    out = out * VIGNETTE
    return np.clip(out * 0.955 + 0.035, 0, 1)


# =============================================================== 小さな場面
def scene_blue(tl, sc, t):
    a = np.zeros((H, W, 3), np.float32)
    lt = t - sc["t0"]
    if sc["args"]["osd"] == "play" and lt < 0.35:
        return a, dict(noise=0.25, dropout=4, bands=((H * lt / 0.35, 90, 40),))
    a[:] = (0.03, 0.06, 0.78)
    if sc["args"]["osd"] == "play":
        pix_text(a, "ビデオ", 44, 36)
        pix_text(a, "再生 ▶", 44, 76)
        pix_text(a, "SP", 44, 410)
        pix_text(a, "0:00:%02d" % int(lt), 470, 410)
    else:
        pix_text(a, "停止 ■", 44, 36)
        pix_text(a, "SP", 44, 410)
        pix_text(a, "0:04:11", 470, 410)
    return a, dict(noise=0.02, cnoise=0.012, dropout=0.03, jitter=0.15, wobble=0.2)


LABEL_LINES = [
    (0.3, "資料映像"),
    (1.0, "家庭用ビデオテープより複製"),
    (1.6, "録画日時　不明"),
    (2.0, "放送局　　不明"),
    (2.9, "※一部に映像・音声の"),
    (2.9, "　乱れがあります"),
]


def scene_label(tl, sc, t):
    a = np.zeros((H, W, 3), np.float32)
    a[:] = (0.012, 0.012, 0.016)
    lt = t - sc["t0"]
    ys = [70, 150, 190, 230, 310, 350]
    for (t0, text), y in zip(LABEL_LINES, ys):
        if lt >= t0:
            pix_text(a, text, 64, y, (0.82, 0.82, 0.80), shadow=False)
    return a, dict(noise=0.03, dropout=0.1)


@lru_cache(maxsize=None)
def bars_base() -> np.ndarray:
    a = np.zeros((H, W, 3), np.float32)
    cols = [(0.75, 0.75, 0.75), (0.75, 0.75, 0), (0, 0.75, 0.75), (0, 0.75, 0), (0.75, 0, 0.75), (0.75, 0, 0), (0, 0, 0.75)]
    bw = W / 7
    for k, c in enumerate(cols):
        a[: int(H * 0.67), int(k * bw) : int((k + 1) * bw)] = c
    rev = [(0, 0, 0.75), (0.07, 0.07, 0.07), (0.75, 0, 0.75), (0.07, 0.07, 0.07), (0, 0.75, 0.75), (0.07, 0.07, 0.07), (0.75, 0.75, 0.75)]
    for k, c in enumerate(rev):
        a[int(H * 0.67) : int(H * 0.75), int(k * bw) : int((k + 1) * bw)] = c
    bot = [(0, 0.13, 0.30), (1, 1, 1), (0.20, 0, 0.42), (0.07, 0.07, 0.07), (0.03, 0.03, 0.03), (0.07, 0.07, 0.07), (0.11, 0.11, 0.11), (0.07, 0.07, 0.07)]
    xs = [0, 114, 228, 342, 456, 486, 516, 546, 640]
    for k, c in enumerate(bot):
        a[int(H * 0.75) :, xs[k] : xs[k + 1]] = c
    a[196:244, 176:464] = (0.02, 0.02, 0.02)
    m = pix_mask("なぎはまテレビ", 2)
    blit_mask(a, m, 320 - m.shape[1] // 2, 204, (0.9, 0.9, 0.9))
    return a


def scene_bars(tl, sc, t):
    return bars_base().copy(), dict(noise=0.035, cnoise=0.04, sat=1.0)


def scene_snow(tl, sc, t):
    fi = int(round(t * FPS))
    rng = np.random.default_rng(31337 + fi)
    n = rng.random((H // 2, W // 2), dtype=np.float32)
    n = np.repeat(np.repeat(n, 2, 0), 2, 1)
    rows = uniform_filter1d(rng.standard_normal(H).astype(np.float32), 9)[:, None]
    a = np.clip(0.12 + 0.75 * n ** 1.6 + 0.35 * rows, 0, 1)
    return np.repeat(a[..., None], 3, 2), dict(noise=0.10, dropout=3.0, sat=0.0, cnoise=0.08, jitter=1.5,
                                               bands=((float(rng.integers(0, H)), 50, 12),))


def scene_black(tl, sc, t):
    return np.zeros((H, W, 3), np.float32), dict(noise=0.03, dropout=0.4)


# =============================================================== 放送終了
@lru_cache(maxsize=None)
def closing_base() -> np.ndarray:
    rng = np.random.default_rng(5)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    top, hor = np.array([0.012, 0.03, 0.10], np.float32), np.array([0.10, 0.17, 0.36], np.float32)
    a = np.broadcast_to(top + (hor - top) * np.clip(yy / 0.62, 0, 1) ** 1.6, (H, W, 3)).copy()
    for _ in range(170):  # 星
        x, y = int(rng.integers(0, W)), int(rng.integers(0, 250))
        a[y, x] += float(rng.uniform(0.15, 0.7))
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    hz = 300
    # 遠い岬と丘
    d.polygon([(0, hz), (0, 262), (70, 248), (150, 262), (230, 284), (300, hz)], fill=(7, 12, 30))
    d.polygon([(380, hz), (450, 282), (520, 262), (585, 270), (640, 255), (640, hz)], fill=(6, 10, 26))
    # 町並み
    x = 20
    while x < 300:
        w, h = int(rng.integers(8, 22)), int(rng.integers(6, 26))
        d.rectangle([x, hz - h, x + w, hz], fill=(5, 8, 20))
        for _ in range(int(rng.integers(0, 3))):
            wx, wy = x + int(rng.integers(1, max(2, w - 2))), hz - int(rng.integers(2, max(3, h - 1)))
            d.point((wx, wy), fill=(235, 200, 120))
        x += w + int(rng.integers(0, 4))
    # 灯台
    d.polygon([(556, 268), (552, 222), (566, 222), (562, 268)], fill=(150, 156, 170))
    d.rectangle([550, 214, 568, 222], fill=(40, 46, 66))
    d.polygon([(552, 214), (559, 204), (566, 214)], fill=(30, 36, 54))
    # 月
    d.ellipse([486, 64, 514, 92], fill=(236, 232, 205))
    d.ellipse([477, 59, 505, 87], fill=(7, 15, 47))
    # 海
    sea = to_f(img)
    sy = np.linspace(0, 1, H - hz, dtype=np.float32)[:, None, None]
    sea[hz:] = np.array([0.070, 0.125, 0.285], np.float32) * (1 - sy) + np.array([0.012, 0.03, 0.085], np.float32) * sy
    for _ in range(420):
        y = int(rng.integers(hz + 1, H))
        k = (y - hz) / 180.0
        if rng.random() < 0.55:  # 月の道
            x0 = int(500 + rng.normal(0, 10 + 34 * k))
            ln = int(rng.integers(4, 18) * (0.6 + k))
            sea[y, max(0, x0) : max(0, x0) + ln] += float(rng.uniform(0.10, 0.34))
        else:
            x0 = int(rng.integers(0, W))
            ln = int(rng.integers(6, 40) * (0.5 + k))
            sea[y, x0 : x0 + ln] += float(rng.uniform(0.015, 0.06))
    add_glow(sea, 500, 78, 26, 26, (0.75, 0.8, 1.0), 0.10)
    return sea


def scene_closing(tl, sc, t):
    lt = t - sc["t0"]
    a = closing_base().copy()
    # 灯台の光
    ph = 0.5 + 0.5 * math.sin(lt * 1.4)
    add_glow(a, 559, 218, 4 + 10 * ph, 3 + 5 * ph, (1.0, 0.95, 0.75), 0.5 + 0.9 * ph)
    add_glow(a, 559, 330, 5, 40, (1.0, 0.95, 0.75), 0.10 * ph)
    rain = sc["args"].get("rain")
    if rain:
        rng = np.random.default_rng(99)
        n = 420
        x = rng.uniform(0, W, n)
        y = (rng.uniform(0, H, n) + lt * rng.uniform(420, 620, n)) % H
        img = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(img)
        for k in range(n):
            d.line([(x[k], y[k]), (x[k] - 2, y[k] + 13)], fill=int(rng.integers(30, 80)))
        a += to_f(img)[..., None] * np.array([0.7, 0.8, 1.0], np.float32)
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    # 局のマーク
    cx, cy = 320, 92
    d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], outline=(235, 235, 240), width=3)
    for k in range(3):
        yy = cy - 8 + k * 8
        d.line([(cx - 14 + dx, yy + 3 * math.sin((dx + k * 5) / 4.5)) for dx in range(0, 29, 2)], fill=(235, 235, 240), width=2)
    telop_text(d, (320, 136), "なぎはまテレビ", font(F_MARU, 25), (235, 235, 240), stroke=1, stroke_fill=(235, 235, 240), anchor="mm", shadow=0)
    alpha = smooth(ramp(lt, 0.8, 2.2))
    if alpha > 0:
        c = int(240 * alpha)
        d.text((320, 372), "本日の放送は終了しました", font=font(F_MIN_BOLD, 33), fill=(c, c, c), anchor="mm")
        c2 = int(190 * alpha)
        d.text((320, 414), "おやすみなさい", font=font(F_MIN_BOLD, 20), fill=(c2, c2, int(c2 * 1.05)), anchor="mm")
    return to_f(img), dict(noise=0.05)


# =============================================================== 臨時ニュースのカード
@lru_cache(maxsize=None)
def card_base(kind: str) -> np.ndarray:
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    c0, c1 = np.array([0.07, 0.20, 0.66], np.float32), np.array([0.02, 0.07, 0.34], np.float32)
    a = np.broadcast_to(c0 + (c1 - c0) * yy, (H, W, 3)).copy()
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    if kind == "rinji":
        d.rectangle([60, 150, 580, 154], fill=(240, 240, 240))
        d.rectangle([60, 318, 580, 322], fill=(240, 240, 240))
        telop_text(d, (320, 234), "臨時ニュース", font(F_BLACK, 76), (250, 250, 250), stroke=0, anchor="mm", shadow=4)
        telop_text(d, (320, 356), "なぎはまテレビ", font(F_MARU, 22), (220, 225, 240), stroke=0, anchor="mm", shadow=0)
    else:  # studio
        d.rectangle([0, 60, 640, 108], fill=(150, 20, 26))
        telop_text(d, (320, 83), "臨時ニュース", font(F_BLACK, 32), (250, 250, 250), stroke=0, anchor="mm", shadow=2)
        telop_text(d, (320, 208), "音声のみでお伝えしています", font(F_BOLD, 31), (245, 245, 245), stroke=0, anchor="mm", shadow=2)
        d.rectangle([110, 262, 530, 264], fill=(200, 205, 225))
        telop_text(d, (320, 304), "凪浜市全域", font(F_BLACK, 28), (255, 226, 40), stroke=2, anchor="mm")
        telop_text(d, (320, 346), "屋外に出ないでください", font(F_BLACK, 28), (255, 226, 40), stroke=2, anchor="mm")
    return to_f(img)


def draw_clock(d: ImageDraw.ImageDraw, text: str) -> None:
    telop_text(d, (44, 50), text, font(F_BLACK, 34), (250, 250, 250), stroke=3, stroke_fill=(10, 14, 40))


def scene_rinji(tl, sc, t):
    img = to_pil(card_base("rinji"))
    draw_clock(ImageDraw.Draw(img), sc["args"]["clock"])
    return to_f(img), dict(noise=0.05)


def scene_studio(tl, sc, t):
    img = to_pil(card_base("studio"))
    draw_clock(ImageDraw.Draw(img), sc["args"]["clock"])
    lt = t - sc["t0"]
    g = smooth(ramp(t, sc["t1"] - 2.5, sc["t1"]))  # 終わりに向けて乱れはじめる
    return to_f(img), dict(noise=0.05 + 0.05 * g, wobble=0.7 + 3 * g, cnoise=0.03 + 0.05 * g,
                           bands=((H * ((lt * 0.37) % 1.0), 40, 10 * g),) if g > 0 else ())


# =============================================================== 街（駅前カメラ）
VIEWS = {
    # 名前: (焦点距離, 画面中心x, 地平線y, カメラの高さ)
    "wide": (520.0, 320.0, 190.0, 4.5),
    "tele": (1250.0, 278.0, 129.0, 4.5),
}
LAMP1 = (3.0, 6.35, 15.0)
LAMP2 = (-3.0, 6.35, 34.0)
LAMP3 = (3.0, 6.35, 58.0)
VEND = (-4.45, 1.3, 13.5)
SIGNAL = (-1.5, 5.6, 26.0)
C_LAMP = np.array([0.80, 1.0, 0.88], np.float32)
C_VEND = np.array([0.75, 0.88, 1.0], np.float32)


class Street:
    """駅前通り。建物・電柱・街灯などの動かない部分をまとめて描いておく。"""

    def __init__(self, view: str):
        self.view = view
        self.f, self.ox, self.oy, self.ch = VIEWS[view]
        self.bg = self._background()
        self.blink = self._blink_layer()
        self.beads, self.beads_blink, self.beads_sky = self._beads()
        self.rain = self._rain_seed()

    def P(self, X, Y, Z):
        return self.ox + self.f * X / Z, self.oy - self.f * (Y - self.ch) / Z

    def quad(self, d, pts, fill):
        d.polygon([self.P(*p) for p in pts], fill=fill)

    def _background(self) -> np.ndarray:
        rng = np.random.default_rng(20)
        P = self.P
        yy = np.arange(H, dtype=np.float32)[:, None, None]
        sky_top, sky_hor = np.array([0.030, 0.036, 0.075], np.float32), np.array([0.105, 0.105, 0.165], np.float32)
        a = np.broadcast_to(sky_top + (sky_hor - sky_top) * np.clip(yy / max(60.0, self.oy), 0, 1) ** 2, (H, W, 3)).copy()
        img = to_pil(a)
        d = ImageDraw.Draw(img)

        # 路面と歩道
        zn, zf = 5.0, 400.0
        self.quad(d, [(-30, 0, zn), (30, 0, zn), (30, 0, zf), (-30, 0, zf)], (30, 32, 40))
        self.quad(d, [(-3.5, 0, zn), (3.5, 0, zn), (3.5, 0, zf), (-3.5, 0, zf)], (17, 19, 26))
        for s in (-1, 1):
            self.quad(d, [(s * 3.5, 0, zn), (s * 3.62, 0, zn), (s * 3.62, 0, zf), (s * 3.5, 0, zf)], (62, 64, 72))
        z = 6.0
        while z < 120:  # センターライン
            self.quad(d, [(-0.07, 0, z), (0.07, 0, z), (0.07, 0, z + 3), (-0.07, 0, z + 3)], (104, 104, 92))
            z += 7.0
        for k in range(8):  # 横断歩道
            x0 = -3.1 + k * 0.8
            self.quad(d, [(x0, 0, 27.5), (x0 + 0.45, 0, 27.5), (x0 + 0.45, 0, 31), (x0, 0, 31)], (98, 98, 90))

        # 建物（遠い順）
        blds = []
        for s in (-1, 1):
            z = 5.5
            while z < 170:
                dep = float(rng.uniform(7, 15))
                h = float(rng.uniform(7, 23))
                blds.append((s, z, z + dep, h, int(rng.integers(0, 10 ** 6))))
                z += dep + (1.2 if rng.random() < 0.25 else 0.0)
        for s, z0, z1, h, sd in sorted(blds, key=lambda b: -b[1]):
            r2 = np.random.default_rng(sd)
            base = int(r2.integers(24, 40))
            wall = (base, base + 2, base + 9)
            front = (base + 8, base + 10, base + 19)
            xw = s * 5.5
            self.quad(d, [(xw, 0, z0), (xw, h, z0), (xw, h, z1), (xw, 0, z1)], wall)
            self.quad(d, [(xw, 0, z0), (xw, h, z0), (xw + s * 14, h, z0), (xw + s * 14, 0, z0)], front)
            if z0 < 115:
                zi = z0 + 1.0
                while zi < z1 - 1.6:
                    yk = 3.7
                    while yk < h - 1.4:
                        lit = r2.random()
                        col = (236, 196, 110) if (lit < 0.035 and zi > 22) else (120, 160, 205) if (lit < 0.055 and zi > 22) else (base - 12, base - 9, base + 2)
                        self.quad(d, [(xw, yk, zi), (xw, yk + 1.25, zi), (xw, yk + 1.25, zi + 1.35), (xw, yk, zi + 1.35)], col)
                        yk += 3.0
                    zi += 2.6
                xi = 1.0
                while xi < 12:
                    yk = 3.7
                    while yk < h - 1.4:
                        lit = r2.random()
                        col = (236, 196, 110) if (lit < 0.03 and z0 > 22) else (base - 6, base - 3, base + 10)
                        xa = xw + s * xi
                        self.quad(d, [(xa, yk, z0), (xa, yk + 1.25, z0), (xa + s * 1.35, yk + 1.25, z0), (xa + s * 1.35, yk, z0)], col)
                        yk += 3.0
                    xi += 2.6
                # 1階のシャッター
                self.quad(d, [(xw, 0, z0 + 0.4), (xw, 2.9, z0 + 0.4), (xw, 2.9, z1 - 0.4), (xw, 0, z1 - 0.4)], (base + 12, base + 13, base + 18))

        # そで看板
        self.signs = []
        for s, zs, col in [(1, 12.0, (170, 34, 44)), (-1, 20.0, (30, 130, 140)), (1, 31.0, (170, 160, 120)), (-1, 46.0, (160, 44, 100))]:
            xa, xb = s * 5.5, s * 4.65
            self.quad(d, [(xa, 4.2, zs), (xa, 7.6, zs), (xb, 7.6, zs), (xb, 4.2, zs)], col)
            for k in range(5):
                yk = 4.55 + k * 0.6
                self.quad(d, [(xa - s * 0.2, yk, zs), (xa - s * 0.2, yk + 0.3, zs), (xb + s * 0.2, yk + 0.3, zs), (xb + s * 0.2, yk, zs)], tuple(int(c * 0.35) for c in col))
            self.signs.append(((s * 5.07, 5.9, zs), np.array(col, np.float32) / 255.0))

        # 自動販売機
        vx, vz = -5.0, 13.0
        self.quad(d, [(vx, 0, vz), (vx, 1.85, vz), (vx + 0.75, 1.85, vz), (vx + 0.75, 0, vz)], (150, 165, 180))
        self.quad(d, [(vx + 0.75, 0, vz), (vx + 0.75, 1.85, vz), (vx + 0.75, 1.85, vz + 1.0), (vx + 0.75, 0, vz + 1.0)], (225, 238, 250))
        self.quad(d, [(vx + 0.75, 0.75, vz), (vx + 0.75, 1.0, vz), (vx + 0.75, 1.0, vz + 1.0), (vx + 0.75, 0.75, vz + 1.0)], (120, 30, 30))

        # 電柱と電線
        poles = [(-4.3, 11.0), (-4.3, 28.0), (-4.3, 50.0), (-4.3, 80.0), (4.4, 42.0), (4.4, 70.0)]
        dark = (3, 4, 7)

        def wire(p0, p1, sag, wdt):
            pts = []
            for k in range(25):
                u = k / 24
                X = p0[0] + (p1[0] - p0[0]) * u
                Y = p0[1] + (p1[1] - p0[1]) * u - sag * 4 * u * (1 - u)
                Z = p0[2] + (p1[2] - p0[2]) * u
                pts.append(P(X, Y, Z))
            d.line(pts, fill=dark, width=wdt)

        for (xa, za), (xb, zb) in zip(poles[:3], poles[1:4]):
            for off, hh in [(-0.75, 9.5), (0.0, 9.5), (0.75, 9.5), (-0.5, 8.6), (0.5, 8.6)]:
                wire((xa + off, hh, za), (xb + off, hh, zb), 0.55, 2 if za < 15 else 1)
        wire((-4.3, 8.6, 11.0), (5.5, 6.2, 16.0), 0.5, 2)
        wire((-4.3, 8.6, 28.0), (5.5, 7.0, 24.0), 0.5, 1)
        wire((-4.3, 9.5, 50.0), (4.4, 9.5, 42.0), 0.5, 1)
        wire((-4.3, 9.5, 50.0), (4.4, 9.5, 70.0), 0.5, 1)
        for xp, zp in poles:
            wd = max(1, int(round(0.30 * self.f / zp)))
            x0, y0 = P(xp, 0, zp)
            x1, y1 = P(xp, 10.2, zp)
            d.line([(x0, y0), (x1, y1)], fill=dark, width=wd)
            for hh, half in [(9.5, 0.85), (8.6, 0.6)]:
                d.line([P(xp - half, hh, zp), P(xp + half, hh, zp)], fill=dark, width=max(1, wd // 2))
            if zp == 28.0:
                self.quad(d, [(xp + 0.25, 7.0, zp), (xp + 0.25, 7.9, zp), (xp + 0.8, 7.9, zp), (xp + 0.8, 7.0, zp)], (10, 11, 14))

        # 街灯
        for (lx, ly, lz), sgn in [(LAMP1, 1), (LAMP2, -1), (LAMP3, 1)]:
            px = lx + sgn * 1.3
            wd = max(1, int(round(0.16 * self.f / lz)))
            d.line([P(px, 0, lz), P(px, ly + 0.25, lz)], fill=(12, 13, 16), width=wd)
            d.line([P(px, ly + 0.25, lz), P(lx - sgn * 0.3, ly + 0.2, lz)], fill=(12, 13, 16), width=wd)
            hx, hy = P(lx, ly, lz)
            rr = max(1.5, 0.28 * self.f / lz)
            d.ellipse([hx - rr * 1.5, hy - rr * 0.6, hx + rr * 1.5, hy + rr * 0.6], fill=(235, 255, 240))

        # 信号機（横型。中央の黄だけが点滅する）
        sx, sy, sz = SIGNAL
        wd = max(1, int(round(0.18 * self.f / sz)))
        d.line([P(-4.4, 0, sz), P(-4.4, sy + 0.4, sz)], fill=(12, 13, 16), width=wd)
        d.line([P(-4.4, sy + 0.3, sz), P(sx + 0.4, sy + 0.3, sz)], fill=(12, 13, 16), width=wd)
        self.quad(d, [(sx - 0.65, sy - 0.25, sz), (sx - 0.65, sy + 0.25, sz), (sx + 0.65, sy + 0.25, sz), (sx + 0.65, sy - 0.25, sz)], (16, 18, 20))
        for k in (-1, 1):
            cx, cy = P(sx + k * 0.42, sy, sz)
            rr = max(1.0, 0.15 * self.f / sz)
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(26, 30, 30))

        a = to_f(img)

        # 光：街灯の輪・路面の明るみ・濡れた路面の映りこみ
        for (lx, ly, lz), col, gain in [(LAMP1, C_LAMP, 1.0), (LAMP2, C_LAMP, 1.0), (LAMP3, C_LAMP, 1.0), (VEND, C_VEND, 0.55)]:
            hx, hy = P(lx, ly, lz)
            s = self.f / lz
            add_glow(a, hx, hy, 0.5 * s, 0.4 * s, col, 0.9 * gain)
            add_glow(a, hx, hy, 2.6 * s, 2.2 * s, col, 0.16 * gain)
            add_glow(a, hx, hy + 2.5 * s, 8.0 * s, 7.0 * s, col, (0.085 if self.view == "wide" else 0.03) * gain)
            gx, gy = P(lx, 0, lz)
            vr = self.f * self.ch * (1 / (lz - 4.5) - 1 / (lz + 4.5)) / 2
            add_glow(a, gx, gy, 3.6 * s, max(2.0, vr * 0.8), col, 0.20 * gain)
            mx, my = P(lx, -ly, lz)
            add_glow(a, mx, my, 0.45 * s, 2.6 * s, col, 0.28 * gain)
        for (px, py, pz), col in self.signs:
            hx, hy = P(px, py, pz)
            s = self.f / pz
            add_glow(a, hx, hy, 1.2 * s, 2.2 * s, col, 0.18)
            mx, my = P(px, -py, pz)
            add_glow(a, mx, my, 0.5 * s, 2.4 * s, col, 0.10)
        return a

    def _blink_layer(self) -> np.ndarray:
        """信号の黄色（点滅で足し引きする分）。"""
        a = np.zeros((H, W, 3), np.float32)
        sx, sy, sz = SIGNAL
        s = self.f / sz
        hx, hy = self.P(sx, sy, sz)
        add_glow(a, hx, hy, 0.22 * s, 0.22 * s, (1.0, 0.85, 0.4), 1.6)
        add_glow(a, hx, hy, 1.6 * s, 1.5 * s, AMBER, 0.35)
        add_glow(a, hx, hy, 6.0 * s, 5.0 * s, AMBER, 0.05)
        mx, my = self.P(sx, -sy, sz)
        add_glow(a, mx, my, 0.5 * s, 3.2 * s, AMBER, 0.30)
        return a

    def _light(self, X, Y, Z, lights):
        out = np.zeros((len(X), 3), np.float32)
        for (lx, ly, lz), col, inten in lights:
            d2 = (X - lx) ** 2 + (Y - ly) ** 2 + (Z - lz) ** 2
            out += (inten / (d2 + 2.0))[:, None].astype(np.float32) * col
        return out

    def _splat(self, px, py, val) -> np.ndarray:
        a = np.zeros((H, W, 3), np.float32)
        x0, y0 = np.floor(px).astype(int), np.floor(py).astype(int)
        fx, fy = (px - x0).astype(np.float32), (py - y0).astype(np.float32)
        for dx_, dy_, wgt in [(0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)]:
            xi, yi = x0 + dx_, y0 + dy_
            ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H)
            np.add.at(a, (yi[ok], xi[ok]), val[ok] * wgt[ok, None])
        return a

    STATIC_LIGHTS = [(LAMP1, C_LAMP, 15.0), (LAMP2, C_LAMP, 15.0), (LAMP3, C_LAMP, 15.0), (VEND, C_VEND, 4.0)]

    def _beads(self):
        """空中で止まった雨粒。"""
        rng = np.random.default_rng(77)
        n = 8500 if self.view == "wide" else 16000
        X = rng.uniform(-5.3, 5.3, n)
        Y = rng.uniform(0.05, 17.0, n)
        Z = rng.uniform(5.0, 85.0, n)
        px, py = self.P(X, Y, Z)
        size = np.clip(0.75 * self.f / 520.0 * 22.0 / Z, 0.4, 2.6).astype(np.float32)[:, None]
        tw = rng.uniform(0.4, 1.3, n).astype(np.float32)[:, None]
        lights = self.STATIC_LIGHTS + [(pos, col, 2.5) for pos, col in self.signs]
        st = self._splat(px, py, np.clip(self._light(X, Y, Z, lights), 0, 1.8) * size * tw)
        bl = self._splat(px, py, np.clip(self._light(X, Y, Z, [(SIGNAL, AMBER, 9.0)]), 0, 1.8) * size * tw)
        sky = self._splat(px, py, (0.11 + 0.13 * np.clip((Y - 2) / 12, 0, 1))[:, None].astype(np.float32) * AMBER * size * tw)
        near = Z < 20
        soft = self._splat(px[near], py[near], (np.clip(self._light(X[near], Y[near], Z[near], lights), 0, 1.4) + 0.10 * AMBER) * tw[near])
        st += 1.1 * gaussian_filter(soft, sigma=(1.5, 1.5, 0))
        # カメラのすぐ前に浮かぶ粒（ピントの外で、大きくぼける）
        m = 70
        nx, ny = rng.uniform(0, W, m), rng.uniform(0, 380, m)
        for k in range(m):
            rad = float(rng.uniform(1.6, 4.2))
            add_glow(sky, nx[k], ny[k], rad, rad, (1.0, 0.86, 0.5), float(rng.uniform(0.10, 0.30)))
        return st, bl, sky

    def _rain_seed(self):
        rng = np.random.default_rng(78)
        n = 1300 if self.view == "wide" else 1700
        return (rng.uniform(-5.3, 5.3, n), rng.uniform(0, 17.0, n), rng.uniform(5.0, 70.0, n), rng.uniform(0.85, 1.15, n))

    def rain_layer(self, lt: float) -> np.ndarray:
        X, Y0, Z, sp = self.rain
        v = 8.5 * sp
        Y = (Y0 - v * lt) % 17.0
        ln = v / 40.0
        x0, y0 = self.P(X + 0.02, Y + ln, Z)
        x1, y1 = self.P(X, Y, Z)
        lit = self._light(X, Y, Z, self.STATIC_LIGHTS + [(SIGNAL, AMBER, 8.0 * self.blink_amt(lt))]) + 0.05
        lum = np.clip(lit.max(axis=1) * 0.9, 0, 1)
        col = lit / (lit.max(axis=1, keepdims=True) + 1e-6)
        img = Image.new("RGB", (W, H), 0)
        d = ImageDraw.Draw(img)
        c8 = (np.clip(col * lum[:, None] + 0.03 * (1 - lum[:, None]), 0, 1) * 255).astype(np.uint8)
        for k in range(len(X)):
            if lum[k] > 0.075:
                d.line([(x0[k], y0[k]), (x1[k], y1[k])], fill=tuple(int(c) for c in c8[k]), width=2 if Z[k] < 12 else 1)
        return to_f(img)

    @staticmethod
    def blink_amt(lt: float) -> float:
        ph = lt % 1.1
        return smooth(ramp(ph, 0.0, 0.05)) * (1 - smooth(ramp(ph, 0.5, 0.58)))


@lru_cache(maxsize=None)
def street(view: str) -> Street:
    return Street(view)


def broadcast_overlay(tl, sc, t, a: np.ndarray, live: bool = True) -> np.ndarray:
    """局が重ねる文字：時刻・中継の表示・テロップ・流れる文字。"""
    heads = [x for x in tl["telops"] if x["kind"] == "head" and x["t0"] <= t < x["t1"]]
    warns = [x for x in tl["telops"] if x["kind"] == "warn" and x["t0"] <= t < x["t1"]]
    bous = [x for x in tl["telops"] if x["kind"] == "bousai" and x["t0"] <= t < x["t1"]]
    tick = next((x for x in tl["tickers"] if x["t0"] <= t < x["t1"]), None)
    if heads:
        band(a, 40, 378, 600, 418, (0.02, 0.05, 0.22), 0.80)
        band(a, 40, 378, 600, 380, (0.9, 0.9, 0.95), 0.9)
        band(a, 40, 378, 58, 418, (0.72, 0.08, 0.10), 1.0)
    if bous:
        n = bous[-1]["text"].count("\n") + 1
        y0 = 296 if n == 2 else 312
        band(a, 70, y0, 570, 368, (0.01, 0.03, 0.05), 0.72)
        band(a, 70, y0 - 24, 172, y0, (0.05, 0.36, 0.20), 0.95)
    if tick:
        band(a, 0, 428, W, 458, (0.02, 0.02, 0.05), 0.85)
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    if tick:
        fnt = font(F_BOLD, 21)
        text = "　　◆　　".join(tick["items"]) + "　　◆　　"
        tw = fnt.getlength(text)
        x = W - (t - tick["t0"]) * 92.0
        while x + tw < 150:
            x += tw
        while x < W:
            d.text((x, 443), text, font=fnt, fill=(240, 240, 240), anchor="lm")
            x += tw
        d.rectangle([0, 428, 150, 458], fill=(110, 14, 20))
        d.text((75, 443), "各地の情報", font=font(F_BLACK, 21), fill=(255, 230, 60), anchor="mm")
    if heads:
        telop_text(d, (72, 397), heads[-1]["text"], font(F_BLACK, 25), (250, 250, 250), stroke=2, shadow=0)
    for wn in warns[-1:]:
        if ((t - wn["t0"]) % 1.3) < 1.05:
            telop_text(d, (320, 344), wn["text"], font(F_BLACK, 29), (255, 226, 30), stroke=3, anchor="mm")
    if bous:
        b = bous[-1]
        lines = b["text"].split("\n")
        y0 = 296 if len(lines) == 2 else 312
        d.text((121, y0 - 13), "防災無線", font=font(F_BOLD, 18), fill=(240, 250, 240), anchor="mm")
        yc = (y0 + 368) / 2 - (len(lines) - 1) * 15
        for k, ln in enumerate(lines):
            telop_text(d, (320, yc + k * 30), ln, font(F_MARU, 24), (245, 245, 245), stroke=1, stroke_fill=(245, 245, 245), anchor="mm", shadow=0)
    if sc["args"].get("clock"):
        draw_clock(d, sc["args"]["clock"])
    if live and sc["args"].get("cam"):
        d.rectangle([452, 34, 506, 58], fill=(190, 20, 24))
        d.text((479, 46), "LIVE", font=font(F_BLACK, 19), fill=(250, 250, 250), anchor="mm")
        telop_text(d, (596, 78), sc["args"]["cam"], font(F_BOLD, 20), (245, 245, 245), stroke=2, anchor="rm", shadow=0)
    return to_f(img)


def scene_street(tl, sc, t):
    lt = t - sc["t0"]
    st = street("wide")
    a = st.bg.copy()
    bl = st.blink_amt(lt)
    if sc["args"]["mode"] == "frozen":
        a += AMBER * (0.085 * np.exp(-YY / 150.0))[..., None]  # 画面の外、上空からの光
        a += st.beads + st.beads_sky + bl * (st.beads_blink + st.blink)
        # 街灯のまわりを飛ぶ蛾（生き物は止まらない）
        mx = LAMP1[0] + 0.55 * math.sin(2.3 * lt) + 0.25 * math.sin(5.9 * lt + 1.0)
        my = LAMP1[1] - 0.45 + 0.40 * math.sin(3.1 * lt + 2.0) + 0.15 * math.sin(7.7 * lt)
        mz = LAMP1[2] + 0.5 * math.cos(2.7 * lt)
        px, py = st.P(mx, my, mz)
        add_glow(a, px, py, 1.3, 1.1, (1.0, 1.0, 0.9), 0.55 + 0.4 * math.sin(lt * 61.0))
    else:
        a += bl * st.blink
        a += st.rain_layer(lt)
        # 路面のゆらぎ
        rng = np.random.default_rng(int(lt * 15))
        rip = np.repeat(np.repeat(rng.random((H // 4, W // 8), dtype=np.float32), 4, 0), 8, 1)
        a[240:] *= (0.93 + 0.14 * rip[240:])[..., None]
    a = broadcast_overlay(tl, sc, t, a)
    return a, dict(noise=0.05, bloom=0.75)


# 傘の列。後ろ姿なので、見えるのは傘の色と白い髪だけ。
# (横位置X, 奥行きZ, 背丈, 傘の色, 髪型, 歩調のずれ)
WALKERS = [
    (-0.25, 27.0, 1.66, (236, 232, 222), "short", 0.0),
    (0.95, 28.2, 1.63, (240, 205, 40), "sideup", 1.1),
    (1.60, 28.4, 1.62, (150, 205, 240), "pony", 2.3),
    (2.75, 29.7, 1.79, (120, 22, 30), "bob", 0.6),
    (-0.10, 30.0, 1.53, (92, 80, 200), "bob", 1.7),
    (-0.80, 30.3, 1.45, (176, 230, 70), "twin", 2.9),
    (0.60, 30.4, 1.68, (245, 180, 200), "long", 0.3),
    (-1.70, 31.3, 1.47, (40, 170, 130), "tie", 1.4),
    (1.75, 31.7, 1.58, (240, 140, 40), "short", 2.0),
    (2.35, 31.9, 1.65, (30, 190, 120), "short", 0.9),
    (0.20, 33.8, 1.50, (150, 80, 200), "messy", 2.6),
]


def draw_walkers(st: Street, a: np.ndarray, lt: float, alpha: float) -> np.ndarray:
    img = to_pil(a)
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for X, Z0, hgt, ucol, hair, ph in sorted(WALKERS, key=lambda w: -w[1]):
        Z = Z0 + 0.36 * lt
        s = st.f / Z
        step = math.sin(2 * math.pi * 1.55 * lt + ph)
        bob = 0.025 * abs(step) * (2.2 if hair == "messy" else 1.0)
        gx, gy = st.P(X, 0, Z)
        lit = 0.35 + 0.65 * min(1.0, 60.0 / ((X - LAMP2[0]) ** 2 + (Z - LAMP2[2]) ** 2 + 30.0))

        def pt(dx, y):
            return gx + dx * s, gy - (y + bob) * s

        body = (int(13 + 14 * lit), int(13 + 14 * lit), int(17 + 16 * lit), 255)
        # 脚
        for sg in (-1, 1):
            d.line([pt(sg * 0.07, 0.80), pt(sg * 0.07 + sg * 0.05 * step, 0.0)], fill=body, width=max(1, int(0.11 * s)))
        # 胴
        d.polygon([pt(-0.20, 0.72), pt(-0.23, hgt - 0.36), pt(0.23, hgt - 0.36), pt(0.20, 0.72)], fill=body)
        # 髪（白）
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
        # 傘
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


def scene_umbrella(tl, sc, t):
    lt = t - sc["t0"]
    st = street("tele")
    a = st.bg.copy()
    a += st.blink_amt(lt) * st.blink
    a = draw_walkers(st, a, lt, smooth(ramp(lt, 0.0, 1.2)))
    a += st.rain_layer(lt)
    rng = np.random.default_rng(int(lt * 15) + 5)
    rip = np.repeat(np.repeat(rng.random((H // 4, W // 8), dtype=np.float32), 4, 0), 8, 1)
    a *= (0.94 + 0.12 * rip)[..., None]
    a = broadcast_overlay(tl, sc, t, a)
    return a, dict(noise=0.075, bloom=0.75)


# =============================================================== 空の光
def _rot(v: np.ndarray, i: int, j: int, ang: float) -> np.ndarray:
    c, s = math.cos(ang), math.sin(ang)
    out = v.copy()
    out[:, i] = c * v[:, i] - s * v[:, j]
    out[:, j] = s * v[:, i] + c * v[:, j]
    return out


_TV = np.array([[(k >> b & 1) * 2 - 1 for b in range(4)] for k in range(16)], np.float64)
_TE = [(a, b) for a in range(16) for b in range(a + 1, 16) if bin(a ^ b).count("1") == 1]


def draw_light(a: np.ndarray, cx: float, cy: float, size: float, t: float, power: float = 1.0) -> None:
    """ゆっくり自転する、多次元の光の結晶。size はおよその半径（ピクセル）。"""
    v = _rot(_rot(_rot(_rot(_TV, 0, 3, 0.31 * t + 0.4), 1, 2, 0.23 * t), 0, 1, 0.13 * t + 1.0), 2, 3, 0.19 * t)
    w4 = 1.0 / (2.6 - v[:, 3])
    v3 = v[:, :3] * w4[:, None]
    w3 = 1.0 / (2.4 - v3[:, 2])
    p2 = v3[:, :2] * w3[:, None] * size * 2.9
    r = int(size * 1.25) + 8
    n = 2 * r + 1
    lay = Image.new("L", (n * 2, n * 2), 0)  # 2倍で描いて縮める
    d = ImageDraw.Draw(lay)
    lw = max(2, int(round(size / 9.0)))
    for i, j in _TE:
        br = int(150 + 160 * (w4[i] + w4[j] - 0.62))
        d.line([(2 * (r + p2[i, 0]), 2 * (r + p2[i, 1])), (2 * (r + p2[j, 0]), 2 * (r + p2[j, 1]))], fill=max(90, min(255, br)), width=lw)
    for k in range(16):
        rr = lw * 1.3
        d.ellipse([2 * (r + p2[k, 0]) - rr, 2 * (r + p2[k, 1]) - rr, 2 * (r + p2[k, 0]) + rr, 2 * (r + p2[k, 1]) + rr], fill=255)
    lay = lay.resize((n, n), Image.BILINEAR)
    e = np.asarray(lay, np.float32) / 255.0
    e = 1.25 * e + 0.8 * gaussian_filter(e, max(1.2, size / 14.0))
    x0, y0 = int(round(cx)) - r, int(round(cy)) - r
    xa, ya = max(0, x0), max(0, y0)
    xb, yb = min(W, x0 + n), min(H, y0 + n)
    if xb > xa and yb > ya:
        a[ya:yb, xa:xb] += e[ya - y0 : yb - y0, xa - x0 : xb - x0, None] * np.array([1.0, 0.95, 0.74], np.float32) * power
    fl = 1.0 + 0.05 * math.sin(t * 9.0)
    core = max(3.0, size * 0.16)
    add_glow(a, cx, cy, core, core, (1.0, 1.0, 0.92), 1.3 * power * fl)
    add_glow(a, cx, cy, size * 0.8 + 6, size * 0.8 + 6, (1.0, 0.84, 0.45), 0.30 * power)
    add_glow(a, cx, cy, size * 2.4 + 30, size * 2.4 + 30, AMBER, 0.14 * power)
    # CCDカメラの縦すじ（スミア）
    gx = np.exp(-0.5 * ((np.arange(W) - cx) / max(1.5, core * 0.6)) ** 2).astype(np.float32)
    a += (0.10 * power) * gx[None, :, None] * np.array([1.0, 0.9, 0.7], np.float32)


@lru_cache(maxsize=None)
def sky_base() -> np.ndarray:
    rng = np.random.default_rng(41)
    a = np.zeros((H, W, 3), np.float32)
    a[:] = (0.040, 0.046, 0.085)
    cl = gaussian_filter(rng.standard_normal((H // 8, W // 8)).astype(np.float32), 3.0)
    cl = np.repeat(np.repeat(cl, 8, 0), 8, 1)
    cl = gaussian_filter(cl, 6.0)
    cl = (cl - cl.min()) / (cl.max() - cl.min())
    d2 = ((XX - 330) ** 2 + (YY - 180) ** 2) / (260.0 ** 2)
    a += (cl * 0.07)[..., None] * np.array([0.7, 0.75, 1.0], np.float32)
    a += ((0.05 + cl * 0.17) * np.exp(-d2))[..., None] * AMBER
    # 止まった雨粒
    n = 9000
    px, py = rng.uniform(0, W, n), rng.uniform(0, H, n)
    dd = np.hypot(px - 330, py - 180)
    br = (0.16 + 0.95 * np.exp(-dd / 120.0)) * rng.uniform(0.25, 1.0, n) ** 1.5
    beads = np.zeros((H, W), np.float32)
    np.add.at(beads, (py.astype(int), px.astype(int)), br.astype(np.float32))
    beads = beads + 0.7 * gaussian_filter(beads, 0.9)
    a += beads[..., None] * np.array([1.0, 0.86, 0.55], np.float32)
    # 屋上：手すり、給水タンク、テレビアンテナ、電線
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    k = (3, 4, 7)
    d.polygon([(0, 480), (0, 430), (190, 418), (190, 480)], fill=k)
    d.polygon([(410, 480), (410, 436), (640, 424), (640, 480)], fill=k)
    d.rectangle([40, 372, 120, 424], fill=k)
    d.ellipse([40, 360, 120, 386], fill=k)
    d.line([(56, 424), (56, 440)], fill=k, width=3)
    d.line([(104, 424), (104, 440)], fill=k, width=3)
    d.line([(520, 430), (520, 318)], fill=k, width=3)  # アンテナの柱
    for kk, half in enumerate([34, 28, 23, 19, 15, 12]):
        y = 322 + kk * 9
        d.line([(520 - half, y - kk * 0.6), (520 + half, y - kk * 0.6)], fill=k, width=2)
    d.line([(488, 348), (552, 344)], fill=k, width=2)
    d.line([(0, 402), (640, 384)], fill=k, width=1)
    d.line([(0, 412), (640, 399)], fill=k, width=1)
    return to_f(img)


def zoom(a: np.ndarray, s: float, cx: float, cy: float) -> np.ndarray:
    if abs(s - 1.0) < 1e-3:
        return a.copy()
    img = to_pil(a).transform((W, H), Image.AFFINE, (1 / s, 0, cx * (1 - 1 / s), 0, 1 / s, cy * (1 - 1 / s)), resample=Image.BILINEAR)
    return to_f(img)


def thrown_things(a: np.ndarray, cx: float, cy: float, s: float) -> np.ndarray:
    """光に向かって投げられ、落ちてこなかった物。小さな影として浮いている。"""
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    k = (9, 7, 5)

    def at(dx, dy):
        return cx + dx * s, cy + dy * s

    x, y = at(-41, 37)  # ボール
    d.ellipse([x - 2.6 * s, y - 2.6 * s, x + 2.6 * s, y + 2.6 * s], fill=k)
    x, y = at(14, 66)  # 石
    d.polygon([(x - 2.2 * s, y), (x - 0.6 * s, y - 1.8 * s), (x + 2.0 * s, y - 0.9 * s), (x + 1.6 * s, y + 1.5 * s), (x - 1.2 * s, y + 1.7 * s)], fill=k)
    x, y = at(34, 47)  # びん
    ca, sa = math.cos(0.55), math.sin(0.55)

    def rot(px, py):
        return x + (px * ca - py * sa) * s, y + (px * sa + py * ca) * s

    d.polygon([rot(-1.3, -2.5), rot(1.3, -2.5), rot(1.3, 4.0), rot(-1.3, 4.0)], fill=k)
    d.polygon([rot(-0.6, -5.2), rot(0.6, -5.2), rot(0.6, -2.5), rot(-0.6, -2.5)], fill=k)
    x, y = at(57, -9)  # 靴
    d.polygon([(x - 3.6 * s, y - 1.6 * s), (x - 1.0 * s, y - 1.8 * s), (x + 0.4 * s, y - 0.2 * s), (x + 3.4 * s, y + 0.3 * s),
               (x + 3.6 * s, y + 1.6 * s), (x - 3.6 * s, y + 1.6 * s)], fill=k)
    x, y = at(-62, -16)  # たたんだ傘
    d.line([(x - 5.0 * s, y + 5.5 * s), (x + 5.0 * s, y - 5.5 * s)], fill=k, width=max(1, int(round(1.5 * s))))
    d.arc([x - 7.4 * s, y + 4.6 * s, x - 4.6 * s, y + 7.4 * s], 20, 230, fill=k, width=max(1, int(round(0.7 * s))))
    return to_f(img)


def scene_sky(tl, sc, t):
    lt = t - sc["t0"]
    dur = sc["t1"] - sc["t0"]
    s = 1.0 + 2.1 * smooth(ramp(lt, 4.0, dur - 3.5))  # カメラがゆっくり寄る
    cx, cy = 330.0, 180.0
    a = zoom(sky_base(), s, cx, cy)
    draw_light(a, cx, cy, 20.0 * s, lt)
    a = thrown_things(a, cx, cy, s)
    a = broadcast_overlay(tl, sc, t, a)
    return a, dict(noise=0.055, bloom=0.9)


# =============================================================== 防災無線
BOUSAI_LIGHT = (462.0, 176.0)
@lru_cache(maxsize=None)
def bousai_base() -> np.ndarray:
    rng = np.random.default_rng(43)
    a = np.zeros((H, W, 3), np.float32)
    a[:] = (0.060, 0.068, 0.120)
    lx, ly = BOUSAI_LIGHT
    cl = gaussian_filter(rng.standard_normal((H // 8, W // 8)).astype(np.float32), 3.0)
    cl = gaussian_filter(np.repeat(np.repeat(cl, 8, 0), 8, 1), 6.0)
    cl = (cl - cl.min()) / (cl.max() - cl.min())
    d2 = ((XX - lx) ** 2 + (YY - ly) ** 2) / (270.0 ** 2)
    a += (cl * 0.06)[..., None] * np.array([0.7, 0.75, 1.0], np.float32)
    a += ((0.10 + cl * 0.16) * np.exp(-d2))[..., None] * AMBER
    n = 7000
    px, py = rng.uniform(0, W, n), rng.uniform(0, H, n)
    dd = np.hypot(px - lx, py - ly)
    br = (0.16 + 0.95 * np.exp(-dd / 130.0)) * rng.uniform(0.25, 1.0, n) ** 1.5
    beads = np.zeros((H, W), np.float32)
    np.add.at(beads, (py.astype(int), px.astype(int)), br.astype(np.float32))
    beads = beads + 0.7 * gaussian_filter(beads, 0.9)
    a += beads[..., None] * np.array([1.0, 0.86, 0.55], np.float32)
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    k, rim = (2, 3, 5), (170, 120, 46)
    # 柱（下から見上げる）
    d.polygon([(192, 480), (224, 84), (240, 84), (248, 480)], fill=k)
    d.line([(240, 84), (248, 480)], fill=rim, width=2)
    d.line([(232, 84), (232, 26)], fill=k, width=3)  # アンテナ
    d.rectangle([202, 286, 254, 372], fill=k)  # 受信機の箱
    d.line([(254, 288), (254, 372)], fill=rim, width=2)
    d.line([(140, 132), (330, 132)], fill=k, width=7)
    d.line([(150, 194), (320, 194)], fill=k, width=7)

    def horn(x, y, dirx, tilt):
        # ラッパ形のスピーカー
        x2 = x + dirx * 84
        d.polygon([(x, y - 9), (x2, y - 36 + tilt), (x2, y + 36 + tilt), (x, y + 9)], fill=k)
        d.rectangle([min(x, x - dirx * 20), y - 11, max(x, x - dirx * 20), y + 11], fill=k)
        if dirx > 0:
            d.ellipse([x2 - 13, y - 37 + tilt, x2 + 13, y + 37 + tilt], fill=(12, 12, 16), outline=rim, width=2)
            d.line([(x, y - 9), (x2, y - 36 + tilt)], fill=rim, width=2)
        else:
            d.ellipse([x2 - 13, y - 37 + tilt, x2 + 13, y + 37 + tilt], fill=k)

    horn(196, 132, -1, -6)
    horn(268, 132, 1, -6)
    horn(204, 194, -1, 8)
    horn(262, 194, 1, 8)
    d.line([(0, 262), (640, 236)], fill=k, width=2)
    d.line([(0, 276), (640, 254)], fill=k, width=1)
    return to_f(img)


def scene_bousai(tl, sc, t):
    lt = t - sc["t0"]
    a = bousai_base().copy()
    draw_light(a, BOUSAI_LIGHT[0], BOUSAI_LIGHT[1], 17.0, lt + 30.0, power=0.9)
    a = broadcast_overlay(tl, sc, t, a)
    return a, dict(noise=0.05, bloom=0.85)


# =============================================================== 電波ジャック
def grid_layer(items) -> np.ndarray:
    """20桁×15行の文字画面（1文字16ドット）を2倍にしたマスク。items: (桁, 行, 文字列)"""
    img = Image.new("L", (320, 240), 0)
    d = ImageDraw.Draw(img)
    d.fontmode = "1"
    fnt = font(F_PIX, 16)
    for col, row, text in items:
        if text:
            d.text((col * 16, row * 16), text, 255, font=fnt)
    m = (np.asarray(img) > 127).astype(np.float32)
    return np.repeat(np.repeat(m, 2, 0), 2, 1)


def typed(text: str, t: float, t0: float, cps: float) -> str:
    if t < t0:
        return ""
    return text[: int((t - t0) * cps) + 1]


def put_glow_text(a: np.ndarray, m: np.ndarray, color: np.ndarray, strength: float = 1.0) -> None:
    g = gaussian_filter(m[::2, ::2], 2.2)
    g = np.repeat(np.repeat(g, 2, 0), 2, 1)
    a *= (1 - 0.8 * m * strength)[..., None]
    a += (m * strength)[..., None] * color + (0.55 * g * strength)[..., None] * color


def hijack_rows(mk: dict, t: float):
    """地区名の一覧。(文字列のリスト)を返す。新しい行ほど下。"""
    rows = []
    for k, name in enumerate(DISTRICTS_SLOW):
        t0 = mk["hj_rows0"] + k * 1.05
        if t >= t0:
            s = typed(name + "　……", t, t0, 16)
            if t >= t0 + 0.62:
                s = name + "　……　いない"
            rows.append(s)
    if t >= mk["hj_fast0"]:
        n = int((t - mk["hj_fast0"]) / 0.085) + 1
        for k in range(n):
            rows.append(DISTRICTS_FAST[k % len(DISTRICTS_FAST)] + "　……　いない")
    return rows


@lru_cache(maxsize=None)
def silhouette() -> tuple[np.ndarray, np.ndarray]:
    """止まった砂嵐の中の人影（ワンサイドアップ）と、髪の黄色い筋。"""
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    d.ellipse([320 - 250, 372, 320 + 250, 640], fill=255)  # 肩
    d.rectangle([286, 300, 354, 400], fill=255)  # 首
    d.ellipse([320 - 122, 48, 320 + 122, 338], fill=255)  # 頭と髪
    d.polygon([(205, 190), (196, 330), (236, 352), (250, 250)], fill=255)  # 横髪
    d.polygon([(435, 190), (444, 330), (404, 352), (390, 250)], fill=255)
    # 片側の高い位置で結んだ髪
    pts = [(418, 92), (452, 70), (486, 86), (502, 130), (500, 200), (486, 270), (470, 318)]
    for (x0, y0), (x1, y1), wd in zip(pts[:-1], pts[1:], [34, 38, 38, 34, 28, 20]):
        d.line([(x0, y0), (x1, y1)], fill=255, width=wd)
        d.ellipse([x1 - wd / 2, y1 - wd / 2, x1 + wd / 2, y1 + wd / 2], fill=255)
    d.ellipse([404, 78, 440, 114], fill=255)
    sil = np.asarray(img.filter(ImageFilter.GaussianBlur(5)), np.float32) / 255.0
    st = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(st)
    d.line([(300, 62), (262, 120), (240, 200), (236, 300)], fill=255, width=5)
    d.line([(352, 60), (392, 110), (412, 190)], fill=200, width=4)
    d.line([(462, 80), (490, 140), (484, 250)], fill=255, width=5)
    streak = np.asarray(st.filter(ImageFilter.GaussianBlur(2.5)), np.float32) / 255.0
    return sil, streak


def eyes_layer(a: np.ndarray, open_amt: float, look: float, slit: float, power: float) -> None:
    """金色の、縦に割れた瞳。"""
    if open_amt <= 0.02 or power <= 0.0:
        return
    y0, y1 = 150, 290
    xs = XX[y0:y1].astype(np.float32)
    ys = YY[y0:y1].astype(np.float32)
    reg = a[y0:y1]
    for side in (-1, 1):
        cx, cy = 320 + side * 62, 222
        ang = side * math.radians(-7)
        X, Y = xs - cx, ys - cy
        xr = X * math.cos(ang) + Y * math.sin(ang)
        yr = -X * math.sin(ang) + Y * math.cos(ang)
        aa = 44.0
        u = np.clip(1 - (xr / aa) ** 2, 0, 1)
        upper = -24.0 * open_amt * u ** 0.75
        lower = 13.0 * open_amt * u ** 0.9
        m = np.clip(np.minimum(yr - upper, lower - yr) / 1.6, 0, 1) * (np.abs(xr) < aa)
        ix, iy = look, -3.0
        rr = np.hypot(xr - ix, yr - iy)
        R = 21.0
        iris = np.clip((R - rr) / 1.4, 0, 1)
        tt = np.clip(rr / R, 0, 1)[..., None]
        c0, c1, c2 = np.array([1.0, 0.95, 0.60], np.float32), np.array([1.0, 0.68, 0.12], np.float32), np.array([0.62, 0.26, 0.03], np.float32)
        col = np.where(tt < 0.55, c0 + (c1 - c0) * (tt / 0.55), c1 + (c2 - c1) * ((tt - 0.55) / 0.45))
        th = np.arctan2(yr - iy, xr - ix)
        col = col * (0.84 + 0.16 * np.sin(th * 23.0 + 1.3) * np.sin(th * 7.0))[..., None]
        col = col * (1 - 0.55 * np.exp(-((rr - R * 0.94) / 2.0) ** 2))[..., None]
        pup = np.clip((1 - ((xr - ix) / slit) ** 2 - ((yr - iy) / (R * 0.88)) ** 2) * 5.0, 0, 1)[..., None]
        col = col * (1 - pup)
        eye = np.array([0.20, 0.17, 0.13], np.float32) * (1 - iris[..., None]) + col * iris[..., None]
        eye = eye * (1 - 0.6 * np.clip(1 - (yr - upper) / 8.0, 0, 1))[..., None]
        mm = (m * power)[..., None]
        reg[:] = reg * (1 - mm) + eye * mm
        glow = np.exp(-(rr ** 2) / (2 * 38.0 ** 2)) * 0.20 * power * open_amt
        reg += glow[..., None] * AMBER


def scene_hijack(tl, sc, t):
    mk = tl["marks"]
    f0, r0 = mk["freeze0"], mk["release0"]
    frozen = f0 <= t < r0
    te = f0 if frozen else t  # 止まっている間、放送の絵は f0 のまま

    # ---- 放送の絵（カード＋緑の文字）
    found = te >= mk["hj_found"]
    if found:
        a = np.zeros((H, W, 3), np.float32)
        a[:] = (0.0, 0.012, 0.008)
    else:
        img = to_pil(card_base("studio"))
        draw_clock(ImageDraw.Draw(img), sc["args"]["clock"])
        a = to_f(img)
        dim = 0.20 + 0.80 * (1 - smooth(ramp(te, mk["hijack0"], mk["hijack0"] + 1.6)))
        gray = a.mean(axis=2, keepdims=True)
        a = (a * dim + gray * (1 - dim)) * dim  # 色が抜けて、暗く沈む
        a[..., 1] += 0.012 * (1 - dim)
    items = []
    if not found:
        items.append((4, 1, typed("＊＊　たずね人　＊＊", te, mk["hj_title"], 14)))
        items.append((2, 3, typed("白い髪の子を", te, mk["hj_ask1"], 9)))
        items.append((2, 4, typed("さがしています", te, mk["hj_ask2"], 9)))
        rows = hijack_rows(mk, te)
        for k, s in enumerate(rows[-6:]):
            items.append((2, 6 + k, s))
        if te >= mk["hj_here"]:
            s = typed("このテレビの前　……", te, mk["hj_here"], 9)
            if te >= r0 + 0.45:
                s = "このテレビの前　……　いない"
            if te < mk["hj_fast0"]:
                if int(te * 3) % 2 == 0 and te < r0 + 0.45 and not frozen:
                    s += "■"
                items.append((2, 13, s))
    if items:
        put_glow_text(a, grid_layer(items), GREEN)
    if found and te < mk["hj_clear"]:
        m = pix_mask("みつけた", 5)
        big = np.zeros((H, W), np.float32)
        x0, y0 = 320 - m.shape[1] // 2, 150
        big[y0 : y0 + m.shape[0], x0 : x0 + m.shape[1]] = m
        put_glow_text(a, big, GREEN, smooth(ramp(te, mk["hj_found"], mk["hj_found"] + 0.15)))
        s = typed("はい、おしまい", te, mk["hj_bye"], 8)
        if s:
            put_glow_text(a, grid_layer([(6, 10, s)]), GREEN, 0.8)

    fx = dict(noise=0.09, cnoise=0.06, wobble=2.2, jitter=0.8, dropout=1.2)
    lt = t - sc["t0"]
    if t < mk["stop0"] and not found:
        fx["bands"] = ((H * ((lt * 0.31) % 1.0), 46, 14), (H * ((lt * 0.53 + 0.4) % 1.0), 24, -9))
    if found:
        fx = dict(noise=0.04, cnoise=0.03, wobble=0.4, jitter=0.2, dropout=0.1)

    # ---- テープが止まっていく
    if mk["stop0"] <= t < f0:
        k = (t - mk["stop0"]) / (f0 - mk["stop0"])
        hold = 1 + int(k * 9)
        fi = int(round(t * FPS))
        fx.update(seed=900000 + (fi // hold) * hold, wobble=2.2 + 10 * k, noise=0.09 + 0.08 * k,
                  bands=((H * (0.2 + 0.6 * k), 60, 30 * k),))

    # ---- 完全に止まっている
    if frozen:
        ft = t - f0
        sil, streak = silhouette()
        mix = smooth(ramp(ft, 1.4, 4.4))
        sm = sil * mix
        gray = np.full((H, W, 3), 0.30, np.float32)
        b = a * (1 - mix) + gray * mix
        b *= (1 - 0.80 * sm)[..., None]
        b += (streak * sm * 0.30)[..., None] * YELLOW
        op = smooth(ramp(t, mk["fz_eyes_open"], mk["fz_eyes_open"] + 0.9)) * (1 - smooth(ramp(t, mk["fz_eyes_close"], mk["fz_eyes_close"] + 0.55)))
        look = (-12.0 * smooth(ramp(t, mk["fz_look1"], mk["fz_look1"] + 0.3))
                + 24.0 * smooth(ramp(t, mk["fz_look2"], mk["fz_look2"] + 0.35))
                - 12.0 * smooth(ramp(t, mk["fz_look3"], mk["fz_look3"] + 0.3)))
        slit = 4.6 - 2.6 * smooth(ramp(t, mk["fz_look3"] + 0.2, mk["fz_look3"] + 0.8))
        eyes_layer(b, op, look, slit, mix)
        # 黄色い文字
        if t < mk["fz_text2"] - 0.5:
            s = typed("ごめんね。ちょっとだけ、うごかないで", t, mk["fz_text1"], 6.5)
        else:
            s = typed("……ちがうか", t, mk["fz_text2"], 5)
        if s:
            m = pix_mask(s, 2)
            big = np.zeros((H, W), np.float32)
            x0 = 320 - pix_mask("ごめんね。ちょっとだけ、うごかないで" if t < mk["fz_text2"] - 0.5 else "……ちがうか", 2).shape[1] // 2
            big[392 : 392 + m.shape[0], x0 : x0 + m.shape[1]] = m
            put_glow_text(b, big, YELLOW)
        a = b
        fx = dict(seed=424242, noise=0.07 + 0.075 * mix, cnoise=0.03, wobble=0.0, jitter=0.0, dropout=0.0,
                  headswitch=9, bloom=0.7, sat=1.0)
    elif r0 <= t < r0 + 0.4:
        k = 1 - (t - r0) / 0.4
        a = a + 0.5 * k
        fx.update(noise=0.09 + 0.5 * k, dropout=14 * k, roll=0.22 * k, bands=((H * (1 - k), 120, 70 * k),))
    return a, fx


# =============================================================== おわり
def scene_endcard(tl, sc, t):
    lt = t - sc["t0"]
    a = np.zeros((H, W, 3), np.float32)
    a[:] = (0.008, 0.008, 0.012)
    img = to_pil(a)
    d = ImageDraw.Draw(img)
    c = int(235 * smooth(ramp(lt, 0.6, 2.2)))
    d.text((320, 148), "停　波", font=font(F_MIN_BLACK, 84), fill=(c, c, c), anchor="mm")
    c2 = int(170 * smooth(ramp(lt, 2.2, 3.4)))
    d.text((320, 232), "外神竜一族　深層の見本", font=font(F_MIN_BOLD, 22), fill=(c2, c2, c2), anchor="mm")
    c3 = int(150 * smooth(ramp(lt, 3.6, 4.8)))
    for k, s in enumerate([
        "この映像はフィクションです。",
        "実在の人物・団体・放送局・災害とは関係ありません。",
        "",
        "音声合成　Open JTalk",
        "HTS voice「tohoku-f01」(c) 東北大学 伊藤・能勢研究室　CC BY 4.0",
        "HTS voice「nitech_jp_atr503_m001」(c) 名古屋工業大学　CC BY 3.0",
    ]):
        d.text((320, 300 + k * 24), s, font=font(F_BOLD, 15), fill=(c3, c3, c3), anchor="mm")
    return to_f(img), dict(noise=0.03, dropout=0.08, wobble=0.3)


SCENES = {
    "blue": scene_blue, "label": scene_label, "closing": scene_closing, "bars": scene_bars,
    "snow": scene_snow, "black": scene_black, "rinji": scene_rinji, "studio": scene_studio,
    "street": scene_street, "umbrella": scene_umbrella, "sky": scene_sky, "bousai": scene_bousai,
    "hijack": scene_hijack, "endcard": scene_endcard,
}


def render(tl: dict, frame_index: int) -> np.ndarray:
    t = frame_index / FPS
    sc = next((s for s in tl["scenes"] if s["t0"] <= t < s["t1"]), tl["scenes"][-1])
    a, fx = SCENES[sc["name"]](tl, sc, t)
    fx = dict(fx)
    # テープの継ぎ目の乱れ
    for c in tl["cuts"]:
        if -0.1 <= t - c < 0.7 and fx.get("seed") is None:
            g = math.exp(-max(0.0, t - c) / 0.2) if t >= c else 0.5
            fx["noise"] = fx.get("noise", FX0["noise"]) + 0.3 * g
            fx["dropout"] = fx.get("dropout", FX0["dropout"]) + 9 * g
            fx["bands"] = tuple(fx.get("bands", ())) + ((H * min(1.0, max(0.0, (t - c) / 0.5)), 80, 60 * g),)
            fx["flag"] = 34 * g
            fx["sat"] = FX0["sat"] * (1 - 0.7 * g)
            fx["roll"] = 0.12 * g * math.sin((t - c) * 30) if t >= c else 0.0
    out = vhs(a, t, fx, frame_index)
    return (out * 255).astype(np.uint8)
