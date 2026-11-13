#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""事象のアトリエ: src/ を 1 枚の HTML にまとめる。

  python3 tools/build.py                  -> index.html（そのまま開ける完成品）
  python3 tools/build.py --artifact PATH  -> Claude の Artifact 用（head なしの断片）も書き出す
  python3 tools/build.py --game callit    -> callit/src/ から callit/index.html を作る（別のゲーム）

フォントは assets/font/DotGothic16-Regular.ttf から、使っている文字だけを抜き出して埋め込む。
そのとき、文字ごとの半ピクセルのずれを直して、16px でドットが画素にぴったり乗るようにする。
fonttools が無い環境では、前回つくった src/font.gen.css をそのまま使う。
"""
import argparse
import base64
import collections
import io
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
FONT = ROOT / 'assets' / 'font' / 'DotGothic16-Regular.ttf'
FONT_CSS = SRC / 'font.gen.css'
PORTRAIT = ROOT / 'assets' / 'portrait'   # tools/make_portraits.py が元絵から作った減色画像
TITLE = '事象のアトリエ'
FAMILY = 'AtelierDot'   # DotGothic16 を位置合わせしたもの。別物なので名前を変えてある
CELL = 62.5             # 1000 / 16


def read(p):
    return p.read_text(encoding='utf-8')


def base_chars():
    s = set(chr(c) for c in range(0x20, 0x7f))
    for a, b in ((0x3000, 0x303f), (0x3041, 0x3096), (0x3099, 0x30ff), (0xff01, 0xff9f)):
        s.update(chr(c) for c in range(a, b + 1))
    s.update('■□●○◎◇◆△▽▲▼★☆♡♥♪※→←↑↓×÷…‥―─━│┃┌┐└┘├┤┬┴┼')
    return s


def align(font):
    """ドットの格子を画素に合わせる。

    元のフォントは文字を 1 文字ずつ中央に置いているので、幅が奇数ドットの文字は
    横に半ドット、ほとんどの文字は縦に 0.43 ドットずれている。辺の位置から文字ごとに判定して寄せる。
    """
    from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates
    glyf = font['glyf']
    for name in font.getGlyphOrder():
        g = glyf[name]
        if g.isComposite() or g.numberOfContours <= 0:
            continue
        co = list(g.coordinates)
        px, py = collections.Counter(), collections.Counter()
        start = 0
        for end in g.endPtsOfContours:
            pts = co[start:end + 1]
            start = end + 1
            for i, a in enumerate(pts):
                b = pts[(i + 1) % len(pts)]
                if a[0] == b[0] and abs(a[1] - b[1]) > 30:
                    px['half' if 15 < (a[0] % CELL) < 47 else 'int'] += 1
                if a[1] == b[1] and abs(a[0] - b[0]) > 30:
                    py['half' if 15 < (a[1] % CELL) < 47 else 'int'] += 1
        if not px:
            xmin = min(x for x, _ in co)
            px['half' if 15 < (xmin % CELL) < 47 else 'int'] += 1
        if not py:
            ymin = min(y for _, y in co)
            py['half' if 15 < (ymin % CELL) < 47 else 'int'] += 1
        dx = -31 if px['half'] > px['int'] else 0
        dy = 27 if py['half'] > py['int'] else 0
        if dx or dy:
            g.coordinates = GlyphCoordinates([(x + dx, y + dy) for x, y in co])
            g.recalcBounds(glyf)


def font_css(chars, cache=FONT_CSS):
    try:
        from fontTools import subset
    except ImportError:
        if cache.exists():
            print('fonttools が無いので、前回の font.gen.css を使います', file=sys.stderr)
            return read(cache)
        raise SystemExit('fonttools が必要です: pip install fonttools brotli')
    try:
        import brotli  # noqa: F401
        flavor, fmt, mime = 'woff2', 'woff2', 'font/woff2'
    except ImportError:
        flavor, fmt, mime = 'woff', 'woff', 'font/woff'
    opt = subset.Options()
    opt.flavor = flavor
    opt.layout_features = []
    opt.hinting = False
    opt.notdef_outline = True
    opt.name_IDs = [1, 2]
    opt.drop_tables += ['GSUB', 'GPOS', 'BASE', 'vhea', 'vmtx']
    font = subset.load_font(str(FONT), opt)
    sub = subset.Subsetter(opt)
    sub.populate(unicodes=sorted(ord(c) for c in chars))
    sub.subset(font)
    have = font.getBestCmap()
    missing = sorted(c for c in chars if ord(c) not in have)
    if missing:
        print('フォントに無い文字:', ''.join(missing), file=sys.stderr)
    align(font)
    for rec in font['name'].names:
        if rec.nameID == 1:
            rec.string = FAMILY
    buf = io.BytesIO()
    subset.save_font(font, buf, opt)
    data = buf.getvalue()
    css = ('@font-face{font-family:"%s";font-style:normal;font-weight:400;font-display:block;'
           'src:url(data:%s;base64,%s) format("%s")}\n') % (FAMILY, mime, base64.b64encode(data).decode('ascii'), fmt)
    cache.write_text(css, encoding='utf-8')
    print('フォント: %d 文字 / %.1f KB' % (len(have), len(data) / 1024))
    return css


def images_js():
    """減色画像を data URI にして、JS の定数 IMG として埋め込む。"""
    items = []
    for key, name in (('edelSplash', 'edel_splash.png'), ('edelBust', 'edel_bust.png'), ('aseraFace', 'asera_face.png')):
        data = (PORTRAIT / name).read_bytes()
        items.append("%s: 'data:image/png;base64,%s'" % (key, base64.b64encode(data).decode('ascii')))
    return '// ── 元絵から作った減色画像 ──\nconst IMG = { ' + ', '.join(items) + ' };\n'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--artifact', help='Artifact 用の断片を書き出す先')
    ap.add_argument('--game', help='別のゲームの入っているフォルダ名（例: callit）。省くと「事象のアトリエ」')
    args = ap.parse_args()

    src = ROOT / args.game / 'src' if args.game else SRC
    out_html = ROOT / args.game / 'index.html' if args.game else ROOT / 'index.html'
    title_file = src / 'title.txt'
    page_title = read(title_file).strip() if title_file.exists() else TITLE
    css = read(src / 'style.css')
    body = read(src / 'page.html')
    files = sorted((src / 'js').glob('*.js'))
    js = ('' if args.game else images_js()) + '\n'.join('// ── %s ──\n%s' % (p.name, read(p)) for p in files)
    if '</script' in js.lower():
        raise SystemExit('JS の中に </script> があります')

    chars = base_chars() | set(c for c in css + body + js if ord(c) >= 0x80 and not c.isspace())
    fcss = font_css(chars, src / 'font.gen.css')

    title = '<title>%s</title>\n' % page_title
    style = '<style>\n' + fcss + css + '\n</style>\n'
    script = '<script>\n(function(){\n"use strict";\n' + js + '\n})();\n</script>\n'

    full = ('<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + title + style + '</head>\n<body>\n' + body + '\n' + script + '</body>\n</html>\n')
    out_html.write_text(full, encoding='utf-8')
    print('%s: %.1f KB' % (out_html.relative_to(ROOT), len(full.encode('utf-8')) / 1024))

    if args.artifact:
        frag = (title + '<meta name="claude:viewport-fit-sides" content="cover">\n'
                + style + body + '\n' + script)
        out = pathlib.Path(args.artifact)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(frag, encoding='utf-8')
        print('%s: %.1f KB' % (out, len(frag.encode('utf-8')) / 1024))


if __name__ == '__main__':
    main()
