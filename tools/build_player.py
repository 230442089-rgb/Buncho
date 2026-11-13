#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""player/template.html にタイムライン (dist/kago.json) を埋め込んで再生ページを作る。

    python3 tools/build_player.py                       # player/index.html (単体で開けるページ)
    python3 tools/build_player.py --fragment out.html   # <html> などを持たない中身だけ (埋め込み用)
"""
from __future__ import annotations

import argparse
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SHELL = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
__PAGE__
</body>
</html>
"""


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--song", default="kago")
    ap.add_argument("--audio", default=None, help="ページから見た音声ファイルの場所")
    ap.add_argument("--fragment", default=None, help="中身だけをこのパスに書き出す")
    args = ap.parse_args()

    with open(os.path.join(ROOT, "dist", args.song + ".json"), encoding="utf-8") as f:
        timeline = json.load(f)
    with open(os.path.join(ROOT, "player", "template.html"), encoding="utf-8") as f:
        page = f.read()
    data = json.dumps(timeline, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    if args.fragment:
        out = args.fragment
        body = page.replace("__AUDIO__", args.audio or (args.song + ".mp3")).replace("__TIMELINE__", data)
    else:
        out = os.path.join(ROOT, "player", "index.html")
        page = page.replace("__AUDIO__", args.audio or ("../dist/%s.mp3" % args.song)).replace("__TIMELINE__", data)
        body = SHELL.replace("__PAGE__", page)
    with open(out, "w", encoding="utf-8") as f:
        f.write(body)
    print("wrote %s (%.0f KB)" % (out, len(body.encode("utf-8")) / 1024))


if __name__ == "__main__":
    main()
