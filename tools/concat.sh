#!/usr/bin/env bash
# tools/concat.sh — 場面ごとのファイルを再エンコードなしでつなぎ（build/silent.mp4）、音を付けて完成させる
set -euo pipefail
cd "$(dirname "$0")/.."
ls build/chunks/0*.mp4 | sort | sed "s|^|file '$PWD/|; s|$|'|" > build/chunks/list.txt
ffmpeg -y -v error -f concat -safe 0 -i build/chunks/list.txt -c copy -movflags +faststart build/silent.part.mp4
mv build/silent.part.mp4 build/silent.mp4
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 build/silent.mp4
python3 tools/audio.py build/silent.mp4 "${1:-words-become-worlds.mp4}"
