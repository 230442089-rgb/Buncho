#!/usr/bin/env bash
# tools/kiai_render_all.sh — 「気合い」の全編を場面ごとのファイルに描き出す（3 本の列で並行）。終わったら tools/kiai_concat.sh でつなぐ。
#   場面の境目はカットの位置（フレーム番号 = ceil(秒 × 30 − 0.5)。kiai/src/core.js の時刻と合わせてある）
set -u
cd "$(dirname "$0")/.."
OUT=build/kiai/chunks; mkdir -p "$OUT" build/kiai/logs
node tools/stats.js kiai
run() { # name from to
  local name=$1 from=$2 to=$3
  [ -f "$OUT/$name.mp4" ] && { echo "skip $name"; return; }
  node tools/render.js --film kiai --from "f$from" --to "f$to" --out "$OUT/$name.mp4" > "build/kiai/logs/$name.log" 2>&1 || echo "FAILED $name"
}
#  0:00 平常・閃光 | 0:14 身体の中・決意・絶叫 | 0:34 結合が耐える | 0:50 絶叫・細胞・100 グレイ | 1:11 砕ける・魂の火 | 1:25 魂が呼び戻す | 1:41 弾丸・前進 | 1:57 最後の絶叫 | 2:10 夜明け・題
( run 01_routine_flash 0 420;  run 04_second_flash 1500 2130; run 07_bullets_walk 3030 3510 ) &
( run 02_inside_decide 420 1020; run 05_shatter_soul 2130 2550; run 08_last_scream 3510 3900 ) &
( run 03_dna_holds 1020 1500;  run 06_soul_repair 2550 3030;  run 09_dawn_title 3900 4560 ) &
wait
ls -la "$OUT"
