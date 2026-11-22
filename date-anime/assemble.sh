#!/bin/bash
# concat scene files -> silent.mp4, then add music + sound effects -> yuria_vol_date.mp4
set -e
cd "$(dirname "$0")"
ls scenes/*.mp4 | grep -v '\.tmp\.mp4$' | sort | sed "s|^|file '$(pwd)/|; s|$|'|" > concat.txt
ffmpeg -v error -y -f concat -safe 0 -i concat.txt -c copy -movflags +faststart silent.mp4
python3 sound_studio.py mix --video silent.mp4 --bgm bgm_custom.wav --cues cues.json -o yuria_vol_date.tmp.mp4
mv yuria_vol_date.tmp.mp4 yuria_vol_date.mp4
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,duration -of compact yuria_vol_date.mp4
ls -la yuria_vol_date.mp4
