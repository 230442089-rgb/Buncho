#!/usr/bin/env bash
# tools/kiai_concat.sh — 場面ごとのファイルを再エンコードなしでつなぎ（build/kiai/silent.mp4）、音を付けて完成させる
set -euo pipefail
cd "$(dirname "$0")/.."
ls build/kiai/chunks/0*.mp4 | sort | sed "s|^|file '$PWD/|; s|$|'|" > build/kiai/chunks/list.txt
ffmpeg -y -v error -f concat -safe 0 -i build/kiai/chunks/list.txt -c copy -movflags +faststart build/kiai/silent.part.mp4
mv build/kiai/silent.part.mp4 build/kiai/silent.mp4
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 build/kiai/silent.mp4
python3 tools/kiai_audio.py build/kiai/silent.mp4 "${1:-kiai.master.mp4}"
