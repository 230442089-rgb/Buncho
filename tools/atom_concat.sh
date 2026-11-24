#!/usr/bin/env bash
# tools/atom_concat.sh — 場面ごとのファイルを再エンコードなしでつなぎ（build/atom/silent.mp4）、音を付けて完成させる
set -euo pipefail
cd "$(dirname "$0")/.."
ls build/atom/chunks/0*.mp4 | sort | sed "s|^|file '$PWD/|; s|$|'|" > build/atom/chunks/list.txt
ffmpeg -y -v error -f concat -safe 0 -i build/atom/chunks/list.txt -c copy -movflags +faststart build/atom/silent.part.mp4
mv build/atom/silent.part.mp4 build/atom/silent.mp4
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 build/atom/silent.mp4
python3 tools/atom_audio.py build/atom/silent.mp4 "${1:-invisible-fire.master.mp4}"
