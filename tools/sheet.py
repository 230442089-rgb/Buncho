#!/usr/bin/env python3
"""tools/sheet.py — 静止画を並べて、時刻・小節つきのコンタクトシートにする（確認用）
  python3 tools/sheet.py out.jpg f00100.jpg f00200.jpg ... [--cols 4] [--w 640] [--plain]（--plain は小節を出さず 分:秒 だけ）
"""
import re, sys
from PIL import Image, ImageDraw, ImageFont

FPS, BPM, T0 = 30, 72.5, 0.034
BAR = 240 / BPM

def main():
    args = sys.argv[1:]
    cols, w, plain = 4, 640, False
    files = []
    i = 0
    while i < len(args):
        if args[i] == '--cols': cols = int(args[i + 1]); i += 2
        elif args[i] == '--plain': plain = True; i += 1
        elif args[i] == '--w': w = int(args[i + 1]); i += 2
        else: files.append(args[i]); i += 1
    out, files = files[0], files[1:]
    cols = min(cols, len(files))
    ims = [Image.open(f).convert('RGB') for f in files]
    h = round(w * ims[0].height / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * w, rows * h), (0, 0, 0))
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', max(12, w // 40))
    d = ImageDraw.Draw(sheet)
    for k, (im, f) in enumerate(zip(ims, files)):
        x, y = (k % cols) * w, (k // cols) * h
        sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
        m = re.search(r'f(\d+)\.', f)
        if m:
            fr = int(m.group(1)); t = fr / FPS; b = (t - T0) / BAR
            label = f'f{fr} {int(t // 60)}:{t % 60:05.2f}' if plain else f'f{fr} {t:.2f}s bar{b:.2f}'
            tw = d.textlength(label, font=font)
            d.rectangle([x + 4, y + 4, x + tw + 12, y + font.size + 10], fill=(0, 0, 0))
            d.text((x + 8, y + 6), label, fill=(255, 220, 90), font=font)
    sheet.save(out, quality=90)
    print(out, sheet.size)

if __name__ == '__main__':
    main()
