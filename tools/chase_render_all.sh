#!/usr/bin/env bash
# tools/chase_render_all.sh — 「ゆり姉、まってぇ♡」の全編を場面ごとのファイルに描き出す。終わったら tools/chase_concat.sh でつなぐ。
#   場面の境目はフレーズの頭（フレーム番号 = ceil(秒 × 30 − 0.5)。chase/src/core.js の時刻と合わせてある）
set -u
cd "$(dirname "$0")/.."
OUT=build/chase/chunks; mkdir -p "$OUT" build/chase/logs
node tools/stats.js chase
run() { local name=$1 from=$2 to=$3
  [ -f "$OUT/$name.mp4" ] && { echo "skip $name"; return; }
  node tools/render.js --film chase --from "f$from" --to "f$to" --out "$OUT/$name.mp4" > "build/chase/logs/$name.log" 2>&1 || echo "FAILED $name"; }
#  0:00 居間 | 0:25 題・廊下・想像・波 | 0:51 町内・地球・月・帰宅 | 1:09 つかまえた・結末・札
( run 01_living 0 755; run 03_escalate_home 1540 2064 ) &
( run 02_chase_dream_wave 755 1540; run 04_ending 2064 2508 ) &
wait
ls -la "$OUT"
