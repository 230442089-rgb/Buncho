#!/usr/bin/env bash
# tools/sigil_concat.sh — 場面ごとのファイルを再エンコードなしでつなぎ（build/sigil/silent.mp4）、音を付けて完成させる
set -euo pipefail
cd "$(dirname "$0")/.."
ls build/sigil/chunks/0*.mp4 | sort | sed "s|^|file '$PWD/|; s|$|'|" > build/sigil/chunks/list.txt
ffmpeg -y -v error -f concat -safe 0 -i build/sigil/chunks/list.txt -c copy -movflags +faststart build/sigil/silent.part.mp4
mv build/sigil/silent.part.mp4 build/sigil/silent.mp4
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 build/sigil/silent.mp4
python3 tools/sigil_audio.py build/sigil/silent.mp4 "${1:-gaishinryu-monsho.mp4}"
