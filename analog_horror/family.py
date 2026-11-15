"""家族の人影（砂嵐の中のシルエット）。

髪型・差し色・瞳の色は、設定資料と、ユーザーから受け取った参考画像（髪の形と色だけ）による。
顔や体は描かない。黒い人影に、差し色の筋と、光る目だけが浮かぶ。
"""
from __future__ import annotations

import math
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 640, 480
XX = np.arange(W)[None, :].repeat(H, 0).astype(np.float32)
YY = np.arange(H)[:, None].repeat(W, 1).astype(np.float32)

# 名前: (差し色, 瞳の色, 字幕の色)
MEMBER = {
    "ユリア": ((1.00, 0.86, 0.22), (1.00, 0.76, 0.28), (1.00, 0.86, 0.22)),
    "ヴォル": ((0.62, 0.84, 1.00), (0.62, 0.86, 1.00), (0.66, 0.86, 1.00)),
    "ミリア": ((0.72, 0.95, 0.30), (0.74, 1.00, 0.32), (0.76, 1.00, 0.38)),
    "燐": ((0.25, 0.92, 0.64), (0.78, 0.62, 1.00), (0.44, 0.96, 0.72)),
    "ルリカ": ((0.45, 0.40, 1.00), (0.76, 0.72, 0.95), (0.66, 0.64, 1.00)),
    "レウネ": ((0.10, 0.88, 0.62), (0.30, 0.92, 0.84), (0.34, 0.95, 0.80)),
    "テルエス": ((1.00, 0.55, 0.15), (1.00, 0.80, 0.42), (1.00, 0.70, 0.36)),
}
VOICE_MEMBER = {"Y": "ユリア", "V": "ヴォル", "M": "ミリア", "S": "燐", "L": "ルリカ", "R": "レウネ", "X": "テルエス"}


def _blob(d: ImageDraw.ImageDraw, pts, widths):
    for (x0, y0), (x1, y1), wd in zip(pts[:-1], pts[1:], widths):
        d.line([(x0, y0), (x1, y1)], fill=255, width=int(wd))
        d.ellipse([x1 - wd / 2, y1 - wd / 2, x1 + wd / 2, y1 + wd / 2], fill=255)


@lru_cache(maxsize=None)
def member_shape(name: str):
    """(人影, 差し色の筋, 目の設定) を返す。"""
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    st = Image.new("L", (W, H), 0)
    s = ImageDraw.Draw(st)
    # 共通：肩・首・頭
    d.ellipse([320 - 250, 372, 320 + 250, 640], fill=255)
    d.rectangle([286, 300, 354, 400], fill=255)
    d.ellipse([320 - 122, 48, 320 + 122, 338], fill=255)
    eyes = dict(both=True, open=1.0, half=0.0, tilt=0.0, grin=False, fan=False, tear=False, hide_right=False)
    if name == "ユリア":
        d.polygon([(205, 190), (196, 330), (236, 352), (250, 250)], fill=255)
        d.polygon([(435, 190), (444, 330), (404, 352), (390, 250)], fill=255)
        _blob(d, [(418, 92), (452, 70), (486, 86), (502, 130), (500, 200), (486, 270), (470, 318)], [34, 38, 38, 34, 28, 20])
        d.ellipse([404, 78, 440, 114], fill=255)
        for pts, w in [([(300, 62), (262, 120), (240, 200), (236, 300)], 5), ([(462, 80), (490, 140), (484, 250)], 5)]:
            s.line(pts, fill=255, width=w)
        eyes.update(tilt=-7)
    elif name == "ヴォル":
        # 高いポニーテール（頭の後ろから右へ流れる）と、右目を隠す長い前髪
        _blob(d, [(360, 70), (420, 40), (470, 60), (500, 120), (506, 210), (492, 300), (470, 380)], [60, 56, 50, 46, 40, 32])
        d.polygon([(330, 70), (450, 150), (430, 300), (360, 270), (330, 180)], fill=255)  # 前髪
        d.polygon([(206, 170), (198, 340), (236, 360), (246, 240)], fill=255)
        s.line([(452, 64), (494, 130), (498, 230), (482, 320)], fill=255, width=6)
        s.line([(360, 100), (418, 190), (416, 270)], fill=210, width=5)
        eyes.update(hide_right=True, open=0.8, tilt=4)
    elif name == "ミリア":
        # 大きなツインテール
        for sg in (-1, 1):  # 頭の高い位置から、外へふくらんで垂れる
            d.ellipse([320 + sg * 112 - 26, 74, 320 + sg * 112 + 26, 126], fill=255)
            _blob(d, [(320 + sg * 118, 100), (320 + sg * 158, 150), (320 + sg * 182, 230), (320 + sg * 188, 320),
                      (320 + sg * 176, 400), (320 + sg * 150, 460)], [56, 76, 86, 80, 64, 40])
            s.line([(320 + sg * 150, 140), (320 + sg * 178, 230), (320 + sg * 180, 330), (320 + sg * 160, 420)], fill=255, width=7)
        s.line([(300, 60), (280, 130), (276, 190)], fill=230, width=6)
        eyes.update(tilt=-10, grin=True)
    elif name == "燐":
        # 高い位置の一つ結び（翡翠の組紐と房）、切りそろえた前髪、扇子
        _blob(d, [(330, 48), (372, 20), (420, 30), (450, 80), (452, 150), (440, 220)], [54, 50, 44, 38, 30, 22])
        d.polygon([(204, 140), (196, 360), (240, 380), (248, 220)], fill=255)
        d.polygon([(436, 140), (446, 360), (402, 380), (394, 220)], fill=255)
        s.line([(378, 22), (396, 38), (404, 70), (404, 120)], fill=255, width=7)  # 組紐
        s.ellipse([394, 118, 414, 160], fill=255)  # 房
        eyes.update(open=0.62, tilt=-5, fan=True)
    elif name == "ルリカ":
        # ボブと、両側の短い結び髪。濃い青紫のメッシュ
        d.polygon([(196, 150), (190, 330), (450, 330), (444, 150)], fill=255)
        for sg in (-1, 1):
            _blob(d, [(320 + sg * 128, 300), (320 + sg * 150, 340), (320 + sg * 152, 380)], [40, 34, 24])
        s.line([(356, 60), (392, 120), (410, 220), (414, 320)], fill=255, width=9)
        eyes.update(open=1.05, tilt=6)
    elif name == "レウネ":
        # 非対称の短いボブ。片側だけ長いエメラルドの毛束
        d.polygon([(196, 120), (186, 300), (240, 320), (250, 200)], fill=255)
        d.polygon([(436, 120), (446, 250), (410, 270), (394, 180)], fill=255)
        _blob(d, [(232, 150), (222, 260), (226, 360), (240, 440)], [30, 26, 22, 16])
        s.line([(232, 150), (222, 260), (226, 360), (240, 440)], fill=255, width=14)
        eyes.update(half=0.55, tilt=0)
    elif name == "テルエス":
        # 短いボブ。毛先が橙
        d.polygon([(198, 140), (194, 316), (446, 316), (442, 140)], fill=255)
        rng = np.random.default_rng(5)
        for x in range(196, 446, 18):  # 不ぞろいな毛先
            dy = float(rng.uniform(18, 46))
            d.polygon([(x, 300), (x + 9 + rng.uniform(-4, 4), 316 + dy), (x + 20, 300)], fill=255)
            s.polygon([(x + 3, 316), (x + 9, 312 + dy), (x + 17, 316)], fill=255)
        s.rectangle([196, 300, 446, 318], fill=150)
        eyes.update(open=0.9, tilt=8, tear=True)
    sil = np.asarray(img.filter(ImageFilter.GaussianBlur(5)), np.float32) / 255.0
    streak = np.asarray(st.filter(ImageFilter.GaussianBlur(2.5)), np.float32) / 255.0
    return sil, streak, eyes


def _eye(a: np.ndarray, cx: float, cy: float, col, open_amt: float, half: float, tilt: float, slit: bool, power: float):
    y0, y1 = int(cy - 40), int(cy + 40)
    x0, x1 = int(cx - 60), int(cx + 60)
    xs, ys = XX[y0:y1, x0:x1] - cx, YY[y0:y1, x0:x1] - cy
    ang = math.radians(tilt)
    xr = xs * math.cos(ang) + ys * math.sin(ang)
    yr = -xs * math.sin(ang) + ys * math.cos(ang)
    aa = 42.0
    u = np.clip(1 - (xr / aa) ** 2, 0, 1)
    upper = -22.0 * open_amt * (1 - half) * u ** 0.75
    lower = 12.0 * open_amt * u ** 0.9
    m = np.clip(np.minimum(yr - upper, lower - yr) / 1.6, 0, 1) * (np.abs(xr) < aa)
    rr = np.hypot(xr, yr + 2)
    R = 19.0
    iris = np.clip((R - rr) / 1.4, 0, 1)
    c = np.asarray(col, np.float32)
    shade = (0.55 + 0.45 * np.clip(1 - rr / R, 0, 1))[..., None]
    ic = c * shade * (1 - 0.5 * np.exp(-((rr - R * 0.94) / 2.0) ** 2))[..., None]
    if slit:
        pup = np.clip((1 - (xr / 3.0) ** 2 - ((yr + 2) / (R * 0.88)) ** 2) * 5.0, 0, 1)[..., None]
    else:
        pup = np.clip((1 - (rr / 7.0) ** 2) * 4.0, 0, 1)[..., None]
    ic = ic * (1 - pup)
    eye = np.array([0.20, 0.18, 0.16], np.float32) * (1 - iris[..., None]) + ic * iris[..., None]
    hl = np.exp(-((xr + 6) ** 2 + (yr + 8) ** 2) / 8.0)[..., None]
    eye = eye + 0.8 * hl
    reg = a[y0:y1, x0:x1]
    mm = (m * power)[..., None]
    reg[:] = reg * (1 - mm) + eye * mm
    glow = np.exp(-(rr ** 2) / (2 * 13.0 ** 2)) * 0.22 * power * open_amt
    reg += glow[..., None] * c


def member_card(name: str, t: float, appear: float = 1.0) -> np.ndarray:
    """砂嵐の中の人影。appear は 0〜1（にじみ出てくる度合い）。"""
    sil, streak, ey = member_shape(name)
    accent, eyecol, _ = MEMBER[name]
    a = np.full((H, W, 3), 0.30, np.float32)
    sm = sil * appear
    a *= (1 - 0.82 * sm)[..., None]
    a += (streak * sm * 0.45)[..., None] * np.asarray(accent, np.float32)
    slit = name == "ユリア"
    for side in (-1, 1):
        if side == 1 and ey["hide_right"]:
            continue
        _eye(a, 320 + side * 60, 222, eyecol, ey["open"], ey["half"], side * ey["tilt"], slit, appear)
    if ey["hide_right"]:  # 前髪の下から、竜眼がわずかにのぞく
        _eye(a, 380, 226, eyecol, 0.35, 0.0, -4, True, appear * 0.55)
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(img)
    if ey["grin"]:  # 八重歯の笑い
        d.chord([268, 264, 372, 314], 10, 170, fill=(int(230 * appear),) * 3)
        d.polygon([(290, 280), (298, 280), (294, 296)], fill=(30, 30, 30))
    if ey["fan"]:  # 扇子で口もとを隠す
        fan = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fan)
        fd.pieslice([220, 250, 420, 450], 200, 340, fill=(214, 206, 222, int(235 * appear)))
        for k in range(3):
            r = 52 + k * 20
            fd.arc([320 - r, 350 - r, 320 + r, 350 + r], 205, 335, fill=(160, 130, 200, int(220 * appear)), width=3)
        for k in range(9):
            th = math.radians(200 + k * 17.5)
            fd.line([(320, 350), (320 + 100 * math.cos(th), 350 + 100 * math.sin(th))], fill=(90, 70, 60, int(200 * appear)), width=2)
        img.paste(fan, (0, 0), fan)
    if ey["tear"]:
        d.line([(356, 236), (360, 262)], fill=(200, 230, 255), width=3)
    return np.asarray(img, np.float32) / 255.0


if __name__ == "__main__":
    import sys

    tiles = [member_card(n, 0.0) for n in MEMBER]
    sheet = Image.new("RGB", (W * 4 // 2, H * 2 // 2))
    for k, tl in enumerate(tiles):
        im = Image.fromarray((tl * 255).astype(np.uint8)).resize((W // 2, H // 2))
        sheet.paste(im, ((k % 4) * W // 2, (k // 4) * H // 2))
    sheet.save(sys.argv[1])
