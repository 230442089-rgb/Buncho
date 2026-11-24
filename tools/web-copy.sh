#!/usr/bin/env bash
# tools/web-copy.sh — 完成した原版（約 108 MB）から、GitHub に置ける大きさ（100 MB 未満）の写しを 2 パスで作る
set -euo pipefail
cd "$(dirname "$0")/.."
IN="${1:-words-become-worlds.master.mp4}"; OUT="${2:-words-become-worlds.mp4}"
X="-c:v libx264 -preset slow -b:v 4300k -maxrate 9M -bufsize 18M -pix_fmt yuv420p -profile:v high -level 4.2 -g 60 -bf 2 -x264-params aq-mode=3:aq-strength=0.9:deblock=-1,-1 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
ffmpeg -y -v error -i "$IN" $X -pass 1 -passlogfile build/x264pass -an -f mp4 /dev/null
ffmpeg -y -v error -i "$IN" $X -pass 2 -passlogfile build/x264pass -c:a copy -movflags +faststart build/web.part.mp4
mv build/web.part.mp4 "$OUT"
ls -la "$IN" "$OUT"
