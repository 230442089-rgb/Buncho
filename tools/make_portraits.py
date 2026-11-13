#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""元絵から、ゲームに埋めこむ小さな減色画像を作る。

  python3 tools/make_portraits.py エデルの絵.png アセラの絵.png

昔の 256 色時代の取りこみ画像のように、16 色に減らしてディザをかける。
できた画像は assets/portrait/ に入り、tools/build.py がゲームに埋めこむ。
"""
import pathlib
import sys
from PIL import Image

OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'portrait'


def make(src, box, size, name, colors=16):
    im = Image.open(src).convert('RGB').crop(box).resize(size, Image.LANCZOS)
    q = im.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG)
    q.save(OUT / name, optimize=True)
    print(name, size, (OUT / name).stat().st_size, 'bytes')


def main():
    edel, asera = sys.argv[1], sys.argv[2]
    OUT.mkdir(parents=True, exist_ok=True)
    make(edel, (320, 0, 800, 760), (144, 228), 'edel_splash.png')     # 起動画面（ひざ上）
    make(edel, (410, 10, 710, 310), (96, 96), 'edel_bust.png')         # バージョン情報（顔）
    make(asera, (400, 150, 720, 390), (160, 120), 'asera_face.png')    # つかまる瞬間（顔）


if __name__ == '__main__':
    main()
