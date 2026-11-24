#!/usr/bin/env bash
# tools/mama_concat.sh — 場面ごとのファイルを再エンコードなしでつなぎ（build/mama/silent.mp4）、音を付けて完成させる
set -euo pipefail
cd "$(dirname "$0")/.."
ls build/mama/chunks/0*.mp4 | sort | sed "s|^|file '$PWD/|; s|$|'|" > build/mama/chunks/list.txt
ffmpeg -y -v error -f concat -safe 0 -i build/mama/chunks/list.txt -c copy -movflags +faststart build/mama/silent.part.mp4
mv build/mama/silent.part.mp4 build/mama/silent.mp4
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 build/mama/silent.mp4
python3 tools/mama_audio.py build/mama/silent.mp4 "${1:-futaritomo-oide.mp4}"
