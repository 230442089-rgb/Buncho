#!/usr/bin/env bash
# tools/chase_concat.sh — 場面ごとのファイルを再エンコードなしでつなぎ（build/chase/silent.mp4）、音を付けて完成させる
set -euo pipefail
cd "$(dirname "$0")/.."
ls build/chase/chunks/0*.mp4 | sort | sed "s|^|file '$PWD/|; s|$|'|" > build/chase/chunks/list.txt
ffmpeg -y -v error -f concat -safe 0 -i build/chase/chunks/list.txt -c copy -movflags +faststart build/chase/silent.part.mp4
mv build/chase/silent.part.mp4 build/chase/silent.mp4
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 build/chase/silent.mp4
python3 tools/chase_audio.py build/chase/silent.mp4 "${1:-nigete-yuria.master.mp4}"
