"""1コマを描く。場面を選び、テープの継ぎ目の乱れを足し、VHSの劣化をかける。"""
from __future__ import annotations

import math

import numpy as np

import picture
import scenes2
from picture import FPS, FX0, H

SCENES = dict(picture.SCENES)
SCENES.update(scenes2.SCENES2)


def render(tl: dict, frame_index: int) -> np.ndarray:
    t = frame_index / FPS
    sc = next((s for s in tl["scenes"] if s["t0"] <= t < s["t1"]), tl["scenes"][-1])
    a, fx = SCENES[sc["name"]](tl, sc, t)
    fx = dict(fx)
    for c in tl["cuts"]:  # テープの継ぎ目の乱れ
        if -0.1 <= t - c < 0.7 and fx.get("seed") is None:
            g = math.exp(-max(0.0, t - c) / 0.2) if t >= c else 0.5
            fx["noise"] = fx.get("noise", FX0["noise"]) + 0.3 * g
            fx["dropout"] = fx.get("dropout", FX0["dropout"]) + 9 * g
            fx["bands"] = tuple(fx.get("bands", ())) + ((H * min(1.0, max(0.0, (t - c) / 0.5)), 80, 60 * g),)
            fx["flag"] = 34 * g
            fx["sat"] = FX0["sat"] * (1 - 0.7 * g)
            fx["roll"] = 0.12 * g * math.sin((t - c) * 30) if t >= c else 0.0
    out = picture.vhs(a, t, fx, frame_index)
    return (out * 255).astype(np.uint8)
