#!/usr/bin/env bash
# tools/render_all.sh — 全編を場面ごとのファイルに描き出す（3 本の列で並行）。終わったら tools/concat.sh でつなぐ。
#   場面の境目は小節の頭（フレーム番号は main.js の「フレーム中央の時刻」に合わせてある）
set -u
cd "$(dirname "$0")/.."
OUT=build/chunks; mkdir -p "$OUT" build/logs
node tools/stats.js
run() { # name from to only
  local name=$1 from=$2 to=$3 only=$4
  [ -f "$OUT/$name.mp4" ] && { echo "skip $name"; return; }
  node tools/render.js --from "f$from" --to "f$to" --out "$OUT/$name.mp4" --only "$only" > "build/logs/$name.log" 2>&1 || echo "FAILED $name"
}
( run 03_solid 994 1789 solid ) &
( run 04_timelapse 1789 2186 solid,time; run 05_fluid 2186 2583 time; run 06_life 2583 2980 solid,life ) &
( run 01_prologue_line 0 597 prologue,line; run 02_plane 597 994 plane; run 07_bird 2980 3378 solid,life; run 08_words 3378 3973 prologue,solid,life,words; run 09_ending 3973 4260 prologue,solid,life,words ) &
wait
ls -la "$OUT"
