#!/usr/bin/env bash
# tools/atom_render_all.sh — 「見えない火」の全編を場面ごとのファイルに描き出す（3 本の列で並行）。終わったら tools/atom_concat.sh でつなぐ。
#   場面の境目は章の替わり目（フレーム番号 = ceil(秒 × 30 − 0.5)。atom/src/core.js の時刻と合わせてある）
set -u
cd "$(dirname "$0")/.."
OUT=build/atom/chunks; mkdir -p "$OUT" build/atom/logs
node tools/stats.js atom
run() { # name from to only
  local name=$1 from=$2 to=$3 only=$4
  [ -f "$OUT/$name.mp4" ] && { echo "skip $name"; return; }
  node tools/render.js --film atom --from "f$from" --to "f$to" --out "$OUT/$name.mp4" --only "$only" > "build/atom/logs/$name.log" 2>&1 || echo "FAILED $name"
}
#  0:00 序・分裂 | 0:38 連鎖 | 1:15 発電 | 1:50 事故(前) | 2:25 事故(後) | 3:08 拡散 | 3:44 身体 | 4:48 人々 | 5:49 時間・結び
( run 01_prologue_fission 0 1147 prologue,fission; run 04_accident_a 3303 4350 plant,accident; run 07_body 6717 8649 body ) &
( run 02_chain 1147 2248 chain; run 05_accident_b 4350 5640 plant,accident; run 08_people 8649 10472 body,people ) &
( run 03_plant 2248 3303 plant,accident; run 06_fallout 5640 6717 fallout; run 09_time_closing 10472 11310 closing ) &
wait
ls -la "$OUT"
