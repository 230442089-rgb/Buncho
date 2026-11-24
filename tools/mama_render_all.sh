#!/usr/bin/env bash
# tools/mama_render_all.sh — 「ふたりとも、おいでぇ♡」の全編を場面ごとのファイルに描き出す。終わったら tools/mama_concat.sh でつなぐ。
#   場面の境目は小節の頭（フレーム番号 = ceil(秒 × 30 − 0.5)。mama/src/core.js の時刻と合わせてある）
set -u
cd "$(dirname "$0")/.."
OUT=build/mama/chunks; mkdir -p "$OUT" build/mama/logs
node tools/stats.js mama
run() { local name=$1 from=$2 to=$3
  [ -f "$OUT/$name.mp4" ] && { echo "skip $name"; return; }
  node tools/render.js --film mama --from "f$from" --to "f$to" --out "$OUT/$name.mp4" > "build/mama/logs/$name.log" 2>&1 || echo "FAILED $name"; }
#  0:00 つかまって 3 時間目・ママの帰宅 | 0:20 おいで | 0:40 ふかふか | 1:03 夕方・札
( run 01_home 0 604; run 03_hug 1200 1895 ) &
( run 02_oide 604 1200; run 04_evening_card 1895 2307 ) &
wait
ls -la "$OUT"
