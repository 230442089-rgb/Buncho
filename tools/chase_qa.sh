#!/usr/bin/env bash
# tools/chase_qa.sh — 仕上がった動画の点検: 長さ・フレーム数・音の有無・全フレームのデコード・音量・場面のつなぎ目の前後の絵
#   tools/chase_qa.sh nigete-yuria.master.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
F="${1:-nigete-yuria.master.mp4}"; Q=build/chase/qa_final; rm -rf "$Q"; mkdir -p "$Q"
echo "== streams"; ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,duration,nb_frames,bit_rate -of default=nw=1 "$F" | paste -sd' ' -
echo "== size"; ls -la "$F"
echo "== decode every frame"; ffmpeg -v error -i "$F" -f null - 2>&1 | tail -3; echo "decode exit: $?"
echo "== frames"; ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$F"
echo "== loudness"; ffmpeg -hide_banner -nostats -i "$F" -vn -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|LRA:|Peak:" | tail -3
# つなぎ目（フレーム番号）の 1 枚前と当のフレーム
for f in 755 1540 2064; do
  for d in -1 0; do n=$((f + d)); ffmpeg -y -v error -ss $(python3 -c "print(($n - 0.25) / 30)") -i "$F" -frames:v 1 -q:v 3 "$Q/join_$(printf %05d $n).jpg"; done
done
ls "$Q" | wc -l
