"""タコくん（正面）。参考画像をそのまま使わず、コードで描き起こした立ち絵。

骨格（肩・ひじ・腰・ひざ）の角度と、表情・小物を変えられるので、
立つ・驚く・走ってくる・のぞく・飛び出す・縛られる、を同じ絵柄で描ける。

単位：全身の高さをおよそ 1000 として描き（内部では SS 倍の解像度）、最後に縮める。
"""
from __future__ import annotations

import math
from functools import lru_cache

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SS = 2  # 描くときの倍率（縮めたときに線がなめらかになる）
CW, CH = 560, 1040  # 単位での画布の大きさ
CX = 280  # 体の中心

# ---- 色
LINE = (38, 22, 18, 255)
SKIN = (152, 94, 64, 255)
SKIN_SH = (118, 68, 46, 255)
SKIN_HI = (178, 118, 84, 255)
HAIR = (255, 104, 28, 255)
HAIR_SH = (214, 66, 18, 255)
HAIR_DK = (168, 44, 14, 255)
HAIR_HI = (255, 156, 70, 255)
HAIR_TIP = (255, 214, 176, 255)
HAIR_TIP2 = (255, 236, 214, 255)
IRIS = (128, 96, 236, 255)
IRIS_DK = (70, 44, 150, 255)
IRIS_LT = (190, 170, 255, 255)
WHITE = (250, 250, 248, 255)
SHIRT = (246, 246, 250, 255)
SHIRT_SH = (206, 208, 222, 255)
PANTS = (40, 36, 46, 255)
PANTS_SH = (26, 23, 30, 255)
PANTS_HI = (64, 58, 74, 255)
STRIPE = (104, 98, 116, 255)
BOOT = (216, 182, 140, 255)
BOOT_SH = (170, 130, 92, 255)
SOLE = (96, 76, 60, 255)
LACE = (250, 238, 214, 255)
PHONE = (28, 28, 32, 255)
PHONE_GR = (128, 132, 140, 255)
PHONE_LT = (186, 190, 198, 255)
SILVER = (206, 210, 216, 255)
MOUTH = (90, 24, 30, 255)
TONGUE = (206, 92, 96, 255)
TEETH = (252, 250, 244, 255)
SWEAT = (196, 230, 255, 230)
JADE = (64, 235, 164, 255)
JADE_DK = (24, 140, 96, 255)

F_BRUSH = "/usr/share/fonts/truetype/kouzan-mouhitsu/kouzan-mouhitsu-gyosho.ttf"


# =============================================================== 幾何の部品
def _rot(p, c, ang):
    """点 p を c のまわりに ang 度まわす（時計回りが正）。"""
    a = math.radians(ang)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(a) - y * math.sin(a), c[1] + x * math.sin(a) + y * math.cos(a))


def _limb(p0, ang, length):
    """p0 から、真下を 0 度として ang 度（正は画面の右）の向きに length 進んだ点。"""
    a = math.radians(ang)
    return (p0[0] + length * math.sin(a), p0[1] + length * math.cos(a))


class Pen:
    def __init__(self):
        self.img = Image.new("RGBA", (CW * SS, CH * SS), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)
        self.T = lambda p: p  # 体の傾きなどの座標変換

    def P(self, p):
        q = self.T(p)
        return (q[0] * SS, q[1] * SS)

    def poly(self, pts, fill, line=LINE, w=3.2):
        q = [self.P(p) for p in pts]
        self.d.polygon(q, fill=fill)
        if line is not None and w > 0:
            self.d.line(q + [q[0]], fill=line, width=max(1, int(w * SS)), joint="curve")

    def ell(self, c, rx, ry, fill, line=LINE, w=3.0):
        x, y = self.P(c)
        self.d.ellipse([x - rx * SS, y - ry * SS, x + rx * SS, y + ry * SS], fill=fill,
                       outline=line if (line is not None and w > 0) else None, width=max(1, int(w * SS)) if line else 0)

    def line(self, pts, fill=LINE, w=3.0):
        self.d.line([self.P(p) for p in pts], fill=fill, width=max(1, int(w * SS)), joint="curve")

    def tube(self, pts, widths, fill, line=LINE, w=3.2, cap=True):
        """太さの変わる管（腕・脚）。widths は各点での半径。"""
        n = len(pts)
        left, right = [], []
        for i in range(n):
            if i == 0:
                dx, dy = pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]
            elif i == n - 1:
                dx, dy = pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]
            else:
                dx, dy = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
            L = math.hypot(dx, dy) or 1.0
            nx, ny = -dy / L, dx / L
            left.append((pts[i][0] + nx * widths[i], pts[i][1] + ny * widths[i]))
            right.append((pts[i][0] - nx * widths[i], pts[i][1] - ny * widths[i]))
        poly = left + right[::-1]
        if cap:
            self.ell(pts[0], widths[0], widths[0], fill, line, w)
            self.ell(pts[-1], widths[-1], widths[-1], fill, line, w)
        self.poly(poly, fill, line, w)
        if cap:  # つなぎ目の線を消す
            self.ell(pts[0], widths[0] - w * 0.9, widths[0] - w * 0.9, fill, None)
            self.ell(pts[-1], widths[-1] - w * 0.9, widths[-1] - w * 0.9, fill, None)

    def sleeve(self, pts, widths, fill, line=LINE, w=3.2):
        """両側の線と先の縁だけを描く管（袖）。根もとには線を引かない。"""
        n = len(pts)
        left, right = [], []
        for i in range(n):
            j0, j1 = max(0, i - 1), min(n - 1, i + 1)
            dx, dy = pts[j1][0] - pts[j0][0], pts[j1][1] - pts[j0][1]
            L = math.hypot(dx, dy) or 1.0
            nx, ny = -dy / L, dx / L
            left.append((pts[i][0] + nx * widths[i], pts[i][1] + ny * widths[i]))
            right.append((pts[i][0] - nx * widths[i], pts[i][1] - ny * widths[i]))
        self.poly(left + right[::-1], fill, None)
        self.line(left, line, w)
        self.line(right, line, w)
        self.line([left[-1], right[-1]], line, w)

    def layer(self):
        q = Pen()
        q.T = self.T
        return q

    def text(self, xy, s, size, fill, rot=0.0):
        f = ImageFont.truetype(F_BRUSH, int(size * SS))
        tw = int(f.getlength(s)) + 8
        lay = Image.new("RGBA", (tw, int(size * SS * 1.5)), (0, 0, 0, 0))
        ImageDraw.Draw(lay).text((4, 0), s, font=f, fill=fill)
        lay = lay.rotate(rot, expand=True, resample=Image.BICUBIC)
        x, y = self.P(xy)
        self.img.alpha_composite(lay, (int(x - lay.width / 2), int(y - lay.height / 2)))


# =============================================================== ポーズ
POSES = {
    # 右腕・左腕は「画面の右・左」。(肩の角度, ひじの角度)。真下が 0、正が画面の右。
    "stand": dict(arm_r=(6, -40), arm_l=(-6, 40), hand_r="pocket", hand_l="pocket", leg_r=(5, 0), leg_l=(-5, 0), face="smug"),
    "can": dict(arm_r=(12, 156), arm_l=(-6, 40), hand_r="can", hand_l="pocket", leg_r=(5, 0), leg_l=(-6, 0), face="smug", tilt=4),
    "startle": dict(arm_r=(30, 128), arm_l=(-30, -128), hand_r="open", hand_l="open", leg_r=(8, 0), leg_l=(-8, 0), face="startle", sweat=0.6),
    "run1": dict(arm_r=(24, 108), arm_l=(-14, -36), hand_r="fist", hand_l="fist", leg_r=(10, -8), leg_l=(-5, 0), lift_r=95, face="panic", sweat=1.0),
    "run2": dict(arm_r=(14, 36), arm_l=(-24, -108), hand_r="fist", hand_l="fist", leg_r=(5, 0), leg_l=(-10, 8), lift_l=95, face="panic", sweat=1.0),
    "fear": dict(arm_r=(18, 140), arm_l=(-18, -140), hand_r="fist", hand_l="fist", leg_r=(6, 0), leg_l=(-6, 0), face="fear", sweat=1.0),
    "flail": dict(arm_r=(140, 25), arm_l=(-140, -25), hand_r="open", hand_l="open", leg_r=(14, 0), leg_l=(-14, 0), face="scream", sweat=1.0),
    "down": dict(arm_r=(6, 0), arm_l=(-6, 0), hand_r="fist", hand_l="fist", leg_r=(3, 0), leg_l=(-3, 0), face="scream", sweat=1.0),
    "bound": dict(arm_r=(6, 0), arm_l=(-6, 0), hand_r="fist", hand_l="fist", leg_r=(2, 0), leg_l=(-2, 0), face="scream", sweat=1.0, bound=1.0),
    "bound_grit": dict(arm_r=(6, 0), arm_l=(-6, 0), hand_r="fist", hand_l="fist", leg_r=(2, 0), leg_l=(-2, 0), face="grit", sweat=1.0, bound=1.0),
}


# =============================================================== 描画
def _gradient_tips(layer: "Pen", y0: float, y1: float) -> None:
    """髪の層の毛先を、オレンジから淡い桃色へ。線の色は残す。"""
    a = np.asarray(layer.img, np.float32).copy()
    al = a[..., 3] > 0
    lum = a[..., :3].sum(axis=2)
    fillm = al & (lum > 260)
    yy = (np.arange(a.shape[0], dtype=np.float32) / SS)[:, None]
    t = np.clip((yy - y0) / (y1 - y0), 0, 1) ** 1.2
    t = np.broadcast_to(t, fillm.shape)
    base = np.array(HAIR[:3], np.float32)
    tip = np.array(HAIR_TIP2[:3], np.float32)
    rel = a[..., :3] / base  # 影の濃さを保つ
    tgt = np.clip(rel * tip, 0, 255)
    for c in range(3):
        a[..., c] = np.where(fillm, a[..., c] * (1 - t) + tgt[..., c] * t, a[..., c])
    layer.img = Image.fromarray(a.astype(np.uint8))


def _wavy_outline(cx, cy, rx, ry, a0, a1, n, amp, freq, bottom_y):
    pts = []
    for k in range(n + 1):
        th = math.radians(a0 + (a1 - a0) * k / n)
        r = 1 + amp * math.sin(freq * th * 2) ** 2
        x = cx + rx * r * math.sin(th)
        y = cy - ry * r * math.cos(th)
        pts.append((x, min(y, bottom_y + amp * 30 * math.sin(k * 1.7))))
    return pts


def _hair_back(pen: Pen, hy: float):
    lay = pen.layer()
    # 後ろの髪のかたまり：輪郭が波打つ
    outline = _wavy_outline(CX, hy + 20, 142, 160, -128, 128, 64, 0.06, 4.0, hy + 168)
    lay.poly(outline, HAIR_SH, LINE, 3.4)
    # うねる房（外へはねる）
    for sg in (-1, 1):
        for k, (x0, y0, x1, y1, x2, y2, w) in enumerate([(78, -10, 128, 70, 150, 150, 30), (92, 20, 116, 110, 132, 178, 26),
                                                           (70, 40, 92, 120, 100, 186, 22), (100, -40, 146, 30, 160, 96, 24)]):
            pts = [(CX + sg * x0, hy + y0), (CX + sg * x1, hy + y1), (CX + sg * x2, hy + y2), (CX + sg * (x2 + 18), hy + y2 + 10)]
            lay.tube(pts, [w, w * 1.05, w * 0.8, w * 0.35], HAIR_SH if k % 2 else HAIR, LINE, 3.0)
    _gradient_tips(lay, hy + 70, hy + 190)
    pen.img.alpha_composite(lay.img)


def _face(pen: Pen, hy: float, face: str, sweat: float, look: float = 0.0):
    # 首
    pen.poly([(CX - 21, hy + 60), (CX + 21, hy + 60), (CX + 24, hy + 112), (CX - 24, hy + 112)], SKIN, LINE, 3.0)
    pen.poly([(CX - 21, hy + 62), (CX + 21, hy + 62), (CX + 18, hy + 84), (CX - 18, hy + 78)], SKIN_SH, None)
    # 耳（ヘッドホンの下からわずかに見える）
    for sg in (-1, 1):
        pen.ell((CX + sg * 66, hy + 12), 11, 17, SKIN, LINE, 2.6)
    # 輪郭
    jaw = [(CX - 66, hy - 40), (CX - 68, hy + 4), (CX - 60, hy + 40), (CX - 38, hy + 70), (CX, hy + 86),
           (CX + 38, hy + 70), (CX + 60, hy + 40), (CX + 68, hy + 4), (CX + 66, hy - 40), (CX, hy - 72)]
    pen.poly(jaw, SKIN, LINE, 3.4)
    pen.poly([(CX - 64, hy - 10), (CX - 58, hy + 30), (CX - 40, hy + 60), (CX - 52, hy + 20)], SKIN_SH, None)

    # ---- 目
    ey = hy + 4
    open_ = {"smug": 0.72, "startle": 1.18, "panic": 1.12, "fear": 1.2, "scream": 0.95, "grit": 0.55}[face]
    pupil = {"smug": 1.0, "startle": 0.55, "panic": 0.6, "fear": 0.45, "scream": 0.5, "grit": 0.8}[face]
    for sg in (-1, 1):
        ex = CX + sg * 31
        w, h = 25, 15 * open_
        tilt = -7 * sg if face in ("smug", "grit") else 3 * sg
        # 白目
        eye = [(ex - w, ey + tilt * 0.2), (ex - w * 0.4, ey - h + tilt * 0.5), (ex + w * 0.5, ey - h - tilt * 0.4),
               (ex + w, ey - tilt * 0.3), (ex + w * 0.4, ey + h * 0.75), (ex - w * 0.5, ey + h * 0.8)]
        if sg < 0:
            eye = [(2 * ex - x, y) for (x, y) in eye]
        pen.poly(eye, WHITE, None)
        # 瞳
        ir = 11.5 * (0.9 + 0.25 * min(1, open_))
        ix = ex + look * 6 - sg * 1.5
        iy = ey - 1
        pen.ell((ix, iy), ir * 0.92, min(ir * 1.12, h * 1.05 + 2), IRIS, None)
        pen.ell((ix, iy - ir * 0.3), ir * 0.85, ir * 0.55, IRIS_DK, None)
        pen.ell((ix, iy + ir * 0.45), ir * 0.6, ir * 0.35, IRIS_LT, None)
        pr = ir * 0.42 * pupil
        pen.ell((ix, iy), pr, pr * 1.15, (24, 14, 46, 255), None)
        pen.ell((ix - ir * 0.35, iy - ir * 0.4), ir * 0.24, ir * 0.24, WHITE, None)
        if face not in ("fear", "startle"):
            pen.ell((ix + ir * 0.3, iy + ir * 0.35), ir * 0.12, ir * 0.12, WHITE, None)
        # 上まつ毛（太い線）と下まぶた
        top = [eye[0], eye[1], eye[2], eye[3]]
        pen.line(top, LINE, 5.2)
        pen.line([eye[0], (eye[0][0] - sg * 5, eye[0][1] - 4)], LINE, 4.0)
        pen.line([eye[3], eye[4], eye[5]], (80, 40, 30, 255), 1.8)
        # 眉
        by = ey - 30 - 6 * (open_ - 0.8)
        if face == "smug":
            brow = [(ex - sg * 22, by + 4), (ex + sg * 20, by - 2)]
        elif face == "grit":
            brow = [(ex - sg * 22, by - 4), (ex + sg * 18, by + 8)]
        else:  # 困り眉：内側が上がる
            brow = [(ex + sg * 22, by + 6), (ex - sg * 16, by - 8)]
        pen.line(brow, (120, 42, 16, 255), 4.0)

    # 鼻
    pen.line([(CX + 2, hy + 26), (CX - 3, hy + 34)], (96, 52, 36, 255), 2.2)
    # ---- 口
    my = hy + 52
    if face == "smug":
        pen.line([(CX - 22, my - 2), (CX - 4, my + 4), (CX + 16, my + 2), (CX + 26, my - 6)], LINE, 3.0)
        pen.poly([(CX - 14, my + 1), (CX - 8, my + 2), (CX - 11, my + 9)], TEETH, LINE, 1.4)  # 八重歯
        pen.poly([(CX + 8, my + 3), (CX + 14, my + 2), (CX + 11, my + 9)], TEETH, LINE, 1.4)
    elif face == "startle":
        pen.ell((CX, my + 4), 9, 11, MOUTH, LINE, 2.6)
    elif face == "panic":
        pen.poly([(CX - 20, my - 4), (CX + 20, my - 4), (CX + 15, my + 16), (CX, my + 22), (CX - 15, my + 16)], MOUTH, LINE, 2.8)
        pen.poly([(CX - 17, my - 3), (CX + 17, my - 3), (CX + 15, my + 3), (CX - 15, my + 3)], TEETH, None)
    elif face == "fear":
        pts = [(CX - 18 + 6 * k, my + 4 + (3 if k % 2 else -3)) for k in range(7)]  # 震える口
        pen.line(pts, LINE, 2.8)
    elif face == "scream":
        pen.poly([(CX - 24, my - 8), (CX + 24, my - 8), (CX + 20, my + 24), (CX, my + 34), (CX - 20, my + 24)], MOUTH, LINE, 3.0)
        pen.poly([(CX - 21, my - 7), (CX + 21, my - 7), (CX + 18, my - 1), (CX - 18, my - 1)], TEETH, None)
        pen.poly([(CX - 12, my + 22), (CX + 12, my + 22), (CX + 8, my + 30), (CX - 8, my + 30)], TONGUE, None)
    elif face == "grit":
        pen.poly([(CX - 22, my - 2), (CX + 22, my - 4), (CX + 20, my + 10), (CX - 20, my + 10)], TEETH, LINE, 2.8)
        pen.line([(CX - 21, my + 4), (CX + 21, my + 3)], LINE, 1.6)
        for k in (-12, -4, 4, 12):
            pen.line([(CX + k, my - 2), (CX + k, my + 9)], LINE, 1.2)

    # 恐怖の縦線と汗
    if face in ("fear", "panic", "scream", "startle"):
        for k in range(6):
            x = CX - 40 + k * 16
            pen.line([(x, hy - 30), (x, hy - 12 + 4 * (k % 2))], (70, 70, 140, 150), 2.0)
    if sweat > 0:
        for k, (dx, dy, s) in enumerate([(-64, -20, 1.0), (60, -8, 0.9), (-50, 30, 0.8), (70, 26, 0.7)]):
            if k / 4 < sweat:
                x, y = CX + dx, hy + dy
                pen.poly([(x, y - 11 * s), (x + 6 * s, y + 3 * s), (x, y + 8 * s), (x - 6 * s, y + 3 * s)], SWEAT, (90, 140, 200, 255), 1.6)


def _hair_front(pen: Pen, hy: float, face: str):
    lay = pen.layer()
    # 頭頂のかたまり
    lay.poly([(CX - 100, hy - 14), (CX - 96, hy - 74), (CX - 54, hy - 112), (CX, hy - 122), (CX + 58, hy - 110),
              (CX + 98, hy - 72), (CX + 102, hy - 12), (CX + 72, hy - 42), (CX, hy - 58), (CX - 72, hy - 42)], HAIR, LINE, 3.4)
    # 前髪：右から左へ流れる、とがった房
    strands = [
        [(CX + 92, hy - 76), (CX + 104, hy + 2), (CX + 76, hy - 40)],
        [(CX + 60, hy - 96), (CX + 74, hy - 6), (CX + 48, hy - 50)],
        [(CX + 30, hy - 106), (CX + 34, hy - 16), (CX + 12, hy - 58)],
        [(CX + 4, hy - 110), (CX - 14, hy - 4), (CX - 20, hy - 60)],
        [(CX - 26, hy - 104), (CX - 54, hy - 10), (CX - 50, hy - 62)],
        [(CX - 54, hy - 94), (CX - 92, hy + 6), (CX - 80, hy - 52)],
        [(CX - 80, hy - 80), (CX - 108, hy + 26), (CX - 98, hy - 30)],
    ]
    for st in strands:
        lay.poly(st, HAIR, LINE, 3.0)
    for a, b in [((CX - 40, hy - 86), (CX - 58, hy - 48)), ((CX + 34, hy - 92), (CX + 26, hy - 56)), ((CX - 2, hy - 100), (CX - 10, hy - 66))]:
        lay.line([a, b], HAIR_HI, 4.5)
    # 顔の横の巻き毛（肩まで）
    for sg in (-1, 1):
        for (x0, y0, x1, y1, x2, y2, x3, y3, w) in [(66, -20, 84, 50, 72, 110, 96, 150, 20), (84, -30, 108, 40, 104, 104, 128, 136, 22)]:
            pts = [(CX + sg * x0, hy + y0), (CX + sg * x1, hy + y1), (CX + sg * x2, hy + y2), (CX + sg * x3, hy + y3)]
            lay.tube(pts, [w * 0.8, w, w * 0.9, w * 0.4], HAIR, LINE, 3.0)
    _gradient_tips(lay, hy + 60, hy + 160)
    pen.img.alpha_composite(lay.img)


def _headphones(pen: Pen, hy: float):
    # バンド
    pen.line([(CX - 98, hy - 2), (CX - 104, hy - 70), (CX - 66, hy - 120), (CX, hy - 134), (CX + 66, hy - 120),
              (CX + 104, hy - 70), (CX + 98, hy - 2)], LINE, 16)
    pen.line([(CX - 98, hy - 2), (CX - 104, hy - 70), (CX - 66, hy - 120), (CX, hy - 134), (CX + 66, hy - 120),
              (CX + 104, hy - 70), (CX + 98, hy - 2)], PHONE, 11)
    for sg in (-1, 1):
        pen.poly([(CX + sg * 94, hy - 62), (CX + sg * 112, hy - 62), (CX + sg * 112, hy - 20), (CX + sg * 94, hy - 20)], PHONE_LT, LINE, 2.6)
        pen.line([(CX + sg * 98, hy - 54), (CX + sg * 108, hy - 54)], PHONE_GR, 2.4)
        pen.line([(CX + sg * 98, hy - 40), (CX + sg * 108, hy - 40)], PHONE_GR, 2.4)
        # カップ
        cx, cy = CX + sg * 98, hy + 14
        pen.poly([(cx - 24, cy - 44), (cx + 24, cy - 44), (cx + 30, cy - 30), (cx + 30, cy + 32), (cx + 24, cy + 46),
                  (cx - 24, cy + 46), (cx - 30, cy + 32), (cx - 30, cy - 30)], PHONE, LINE, 3.0)
        pen.ell((cx + sg * 4, cy + 1), 21, 30, PHONE_GR, LINE, 2.4)
        pen.ell((cx + sg * 4, cy + 1), 14, 20, PHONE, None)
        pen.line([(cx + sg * 4 - 7, cy + 1), (cx + sg * 4 + 7, cy + 1)], PHONE_LT, 2.6)
        pen.line([(cx + sg * 4, cy - 8), (cx + sg * 4, cy + 10)], PHONE_LT, 2.6)
        pen.line([(cx - 22, cy - 38), (cx + 22, cy - 38)], (70, 72, 80, 255), 2.0)


def _arm_skin(pen: Pen, sh, ang, hand: str):
    s_ang, e_ang = ang
    elbow = _limb(sh, s_ang, 148)
    wrist = _limb(elbow, s_ang + e_ang, 128 if hand != "pocket" else 110)
    pen.tube([sh, elbow], [27, 22], SKIN, LINE, 3.0)
    pen.tube([elbow, wrist], [22, 17], SKIN, LINE, 3.0)
    if hand == "pocket":
        return wrist
    pen.tube([_limb(elbow, s_ang + e_ang, 100), _limb(elbow, s_ang + e_ang, 110)], [18, 18], (120, 36, 30, 255), LINE, 2.0, cap=False)
    pen.tube([_limb(elbow, s_ang + e_ang, 88), _limb(elbow, s_ang + e_ang, 95)], [18, 18], (40, 30, 30, 255), LINE, 1.6, cap=False)
    hp = _limb(wrist, s_ang + e_ang, 16)
    if hand == "fist":
        pen.ell(hp, 19, 18, SKIN, LINE, 3.0)
        pen.line([(hp[0] - 11, hp[1] - 3), (hp[0] + 11, hp[1] - 3)], SKIN_SH, 2.2)
        pen.line([(hp[0] - 11, hp[1] + 5), (hp[0] + 11, hp[1] + 5)], SKIN_SH, 2.0)
    elif hand == "open":
        for k in range(-2, 3):
            pen.tube([hp, _limb(hp, s_ang + e_ang + k * 17, 34)], [5.5, 4.2], SKIN, LINE, 2.2)
        pen.ell(hp, 17, 19, SKIN, LINE, 3.0)
    elif hand == "can":
        cx, cy = hp
        pen.poly([(cx - 14, cy - 44), (cx + 14, cy - 44), (cx + 14, cy + 16), (cx - 14, cy + 16)], (238, 74, 116, 255), LINE, 2.6)
        pen.poly([(cx - 14, cy - 12), (cx + 14, cy - 24), (cx + 14, cy + 16), (cx - 14, cy + 16)], (255, 140, 40, 255), None)
        pen.poly([(cx + 3, cy - 38), (cx - 7, cy - 12), (cx + 1, cy - 12), (cx - 5, cy + 8), (cx + 9, cy - 20), (cx + 1, cy - 20)],
                 (255, 236, 60, 255), LINE, 1.2)
        pen.ell((cx, cy - 44), 14, 4, SILVER, LINE, 2.0)
        pen.ell((cx - 2, cy + 2), 17, 12, SKIN, LINE, 3.0)
    return wrist


def _arm_sleeve(pen: Pen, sh, ang):
    s_ang = ang[0]
    a = _limb(sh, s_ang, -14)
    b = _limb(sh, s_ang, 78)
    pen.sleeve([a, b], [36, 34], SHIRT, LINE, 3.0)
    pen.line([_limb(sh, s_ang, 26), _limb(sh, s_ang, 64)], SHIRT_SH, 3.0)
    # 肩の丸み（袖のつけ根の線を消す）
    pen.ell(_limb(sh, s_ang, -8), 30, 22, SHIRT, None)


def _leg(pen: Pen, side: int, hip, ang, lift: float = 0.0):
    h_ang, k_ang = ang
    knee = _limb(hip, h_ang, 205 - lift * 0.4)
    ankle = _limb(knee, h_ang + k_ang, 198 - lift * 0.9)
    pen.tube([hip, knee, ankle], [56, 50, 40], PANTS, LINE, 3.2)
    # 外側の線（グレーのライン）
    off = side * 34
    pen.line([(hip[0] + off, hip[1] + 20), (knee[0] + side * 30, knee[1]), (ankle[0] + side * 22, ankle[1] - 20)], STRIPE, 6)
    pen.line([(hip[0] - side * 10, hip[1] + 40), (knee[0] - side * 8, knee[1] - 10)], PANTS_HI, 3.0)
    # 裾のリブ
    cuff = _limb(knee, h_ang + k_ang, 172 - lift * 0.9)
    pen.tube([cuff, ankle], [32, 32], PANTS_SH, LINE, 3.0, cap=False)
    # ブーツ
    bx, by = ankle
    w = 50
    pen.poly([(bx - w * 0.72, by - 24), (bx + w * 0.72, by - 24), (bx + w * 0.86, by + 26), (bx + w * 1.06, by + 46),
              (bx + w * 0.9, by + 58), (bx - w * 0.9, by + 58), (bx - w * 1.06, by + 46), (bx - w * 0.86, by + 26)], BOOT, LINE, 3.2)
    pen.poly([(bx - w * 0.86, by + 30), (bx + w * 0.86, by + 30), (bx + w * 1.02, by + 46), (bx + w * 0.9, by + 56),
              (bx - w * 0.9, by + 56), (bx - w * 1.02, by + 46)], BOOT_SH, None)
    pen.poly([(bx - w * 1.1, by + 54), (bx + w * 1.1, by + 54), (bx + w * 1.06, by + 74), (bx - w * 1.06, by + 74)], SOLE, LINE, 3.0)
    for k in range(-4, 5):
        pen.line([(bx + k * w * 0.22, by + 62), (bx + k * w * 0.22, by + 72)], (70, 54, 42, 255), 2.0)
    for k in range(4):  # 靴ひも
        y = by - 10 + k * 11
        pen.line([(bx - 12, y), (bx + 12, y + 6)], LACE, 3.0)
        pen.line([(bx + 12, y), (bx - 12, y + 6)], LACE, 3.0)
    pen.ell((bx, by - 22), 18, 6, (190, 160, 120, 255), LINE, 2.0)


def _torso(pen: Pen, ty: float, bound: float):
    # シャツ（すこし大きめ）
    shirt = [(CX - 96, ty + 6), (CX - 40, ty - 8), (CX, ty + 14), (CX + 40, ty - 8), (CX + 96, ty + 6),
             (CX + 82, ty + 70), (CX + 84, ty + 160), (CX + 92, ty + 262), (CX + 56, ty + 272), (CX, ty + 268),
             (CX - 56, ty + 272), (CX - 92, ty + 262), (CX - 84, ty + 160), (CX - 82, ty + 70)]
    pen.poly(shirt, SHIRT, LINE, 3.4)
    pen.poly([(CX + 56, ty + 40), (CX + 80, ty + 60), (CX + 84, ty + 250), (CX + 64, ty + 250)], SHIRT_SH, None)
    pen.poly([(CX - 40, ty - 6), (CX, ty + 16), (CX + 40, ty - 6), (CX + 30, ty - 2), (CX, ty + 8), (CX - 30, ty - 2)], SHIRT_SH, LINE, 2.0)
    for a, b in [((CX - 70, ty + 200), (CX - 40, ty + 240)), ((CX + 20, ty + 220), (CX + 50, ty + 256))]:
        pen.line([a, b], SHIRT_SH, 3.0)
    # ロゴ（黒い筆記体）と赤い四角
    pen.text((CX - 4, ty + 92), "Octo", 62, (18, 18, 22, 255), rot=8)
    pen.line([(CX - 60, ty + 126), (CX - 10, ty + 120), (CX + 56, ty + 104)], (18, 18, 22, 255), 4.0)
    pen.poly([(CX + 40, ty + 132), (CX + 58, ty + 132), (CX + 58, ty + 150), (CX + 40, ty + 150)], (214, 40, 40, 255), None)
    # ネックレスとタコのペンダント
    pen.line([(CX - 26, ty - 2), (CX - 14, ty + 40), (CX, ty + 52), (CX + 14, ty + 40), (CX + 26, ty - 2)], SILVER, 2.4)
    pen.ell((CX, ty + 60), 9, 8, SILVER, LINE, 1.8)
    for k in range(-2, 3):
        pen.line([(CX + k * 3, ty + 66), (CX + k * 6, ty + 78)], SILVER, 2.2)


def _waist(pen: Pen, wy: float):
    pen.poly([(CX - 98, wy - 10), (CX + 98, wy - 10), (CX + 100, wy + 26), (CX - 100, wy + 26)], PANTS, LINE, 3.2)
    for x in range(-90, 92, 14):
        pen.line([(CX + x, wy - 6), (CX + x, wy + 22)], PANTS_HI, 1.4)
    for sg in (-1, 1):  # ひも
        pen.line([(CX + sg * 6, wy + 10), (CX + sg * 12, wy + 58)], (238, 238, 240, 255), 3.4)
    # 財布のチェーンとタグ
    pen.line([(CX + 70, wy + 24), (CX + 84, wy + 80), (CX + 74, wy + 130), (CX + 62, wy + 150)], SILVER, 3.4)
    pen.poly([(CX + 50, wy + 150), (CX + 74, wy + 150), (CX + 74, wy + 188), (CX + 50, wy + 188)], (240, 236, 228, 255), LINE, 2.2)
    pen.ell((CX + 62, wy + 168), 7, 7, (248, 140, 40, 255), None)


def _threads(pen: Pen, top: float, bot: float, amount: float):
    """燐の結索：体にぐるぐる巻きついた翡翠色の糸。"""
    n = int(4 + 9 * amount)
    for k in range(n):
        y = top + (bot - top) * k / max(1, n - 1)
        sl = 18 if k % 2 == 0 else -18
        pen.line([(CX - 120, y - sl), (CX + 120, y + sl)], JADE_DK, 8.0)
        pen.line([(CX - 120, y - sl), (CX + 120, y + sl)], JADE, 4.0)


def _render(pose_name: str, look: float, face_override: str | None) -> Image.Image:
    p = dict(POSES[pose_name])
    face = face_override or p["face"]
    pen = Pen()
    hy = 150  # 顔の中心
    ty = 262  # 肩の高さ
    wy = 520  # 腰
    hip_r, hip_l = (CX + 48, wy + 30), (CX - 48, wy + 30)
    sh_r, sh_l = (CX + 104, ty + 22), (CX - 104, ty + 22)
    tilt = p.get("tilt", 0.0)
    _hair_back(pen, hy)
    # 脚：上げた脚は奥なので先に描く
    legs = [(1, hip_r, p["leg_r"], p.get("lift_r", 0.0)), (-1, hip_l, p["leg_l"], p.get("lift_l", 0.0))]
    legs.sort(key=lambda L: -L[3])
    for side, hip, ang, lift in legs:
        _leg(pen, side, hip, ang, lift)
    _waist(pen, wy)
    arms = [(sh_r, p["arm_r"], p["hand_r"]), (sh_l, p["arm_l"], p["hand_l"])]
    _torso(pen, ty, p.get("bound", 0.0))
    for sh, ang, hand in arms:
        _arm_skin(pen, sh, ang, hand)
    for sh, ang, hand in arms:
        _arm_sleeve(pen, sh, ang)
        if hand == "pocket":  # 手首から先はポケットの中
            w = _limb(_limb(sh, ang[0], 148), ang[0] + ang[1], 110)
            pen.poly([(w[0] - 26, w[1] - 4), (w[0] + 26, w[1] - 12), (w[0] + 30, w[1] + 22), (w[0] - 24, w[1] + 26)], PANTS, None)
            pen.line([(w[0] - 26, w[1] - 4), (w[0] + 26, w[1] - 12)], LINE, 3.0)
            pen.line([(w[0] - 20, w[1] + 2), (w[0] + 20, w[1] - 6)], PANTS_HI, 2.0)
    # 頭（少し傾ける）
    pen.T = (lambda c, a: (lambda q: _rot(q, c, a)))((CX, hy + 90), tilt)
    _face(pen, hy, face, p.get("sweat", 0.0), look)
    _hair_front(pen, hy, face)
    _headphones(pen, hy)
    pen.T = lambda q: q
    if p.get("bound"):
        _threads(pen, ty + 30, 900, p["bound"])
    return pen.img


@lru_cache(maxsize=512)
def tako_front(pose: str, height: int, look: float = 0.0, face: str | None = None, crop: str = "full") -> np.ndarray:
    """RGBA の配列（0〜1）。crop='head' なら頭と肩だけ。"""
    im = _render(pose, look, face)
    if crop == "head":
        im = im.crop((0, 0, CW * SS, 420 * SS))
        tgt_h = height
    else:
        im = im.crop((0, 0, CW * SS, CH * SS))
        tgt_h = height
    bb = im.getchannel("A").getbbox()
    if bb:
        im = im.crop((bb[0], 0, bb[2], im.height if crop == "head" else bb[3]))
    w = max(1, round(im.width * tgt_h / im.height))
    im = im.resize((w, max(1, tgt_h)), Image.LANCZOS)
    return np.asarray(im, np.float32) / 255.0


if __name__ == "__main__":
    import sys

    out = sys.argv[1]
    names = sys.argv[2:] or list(POSES)
    tiles = [Image.fromarray((tako_front(n, 480) * 255).astype(np.uint8)) for n in names]
    W = sum(t.width for t in tiles) + 20 * len(tiles)
    sheet = Image.new("RGBA", (W, 500), (90, 96, 110, 255))
    x = 10
    for t in tiles:
        sheet.alpha_composite(t, (x, 10))
        x += t.width + 20
    sheet.save(out)
