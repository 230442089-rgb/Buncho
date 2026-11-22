#!/bin/bash
# usage: ./assemble.sh [scenes_dir] [bgm.wav] [cues.json] [out.mp4]
set -e
cd "$(dirname "$0")"
DIR=${1:-scenes}; BGM=${2:-bgm_custom.wav}; CUES=${3:-cues.json}; OUT=${4:-yuria_vol_date.mp4}
ls $DIR/*.mp4 | grep -v '\.tmp\.mp4$' | sort | sed "s|^|file '$(pwd)/|; s|$|'|" > concat.txt
ffmpeg -v error -y -f concat -safe 0 -i concat.txt -c copy -movflags +faststart silent_$DIR.mp4
python3 sound_studio.py mix --video silent_$DIR.mp4 --bgm $BGM --cues $CUES -o ${OUT%.mp4}.tmp.mp4
mv ${OUT%.mp4}.tmp.mp4 $OUT
ffprobe -v error -show_entries stream=codec_type,width,height,duration -of compact $OUT
ls -la $OUT
