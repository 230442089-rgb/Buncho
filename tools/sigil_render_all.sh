#!/usr/bin/env bash
# tools/sigil_render_all.sh — 「外神竜一族 十二の紋章」の全編を場面ごとのファイルに描き出す。終わったら tools/sigil_concat.sh でつなぐ。
#   場面の境目は 8 秒ごと（240 フレームごと）。sigil/src/core.js の時刻と合わせてある
set -u
cd "$(dirname "$0")/.."
OUT=build/sigil/chunks; mkdir -p "$OUT" build/sigil/logs
node tools/stats.js sigil
run() { local name=$1 from=$2 to=$3
  [ -f "$OUT/$name.mp4" ] && { echo "skip $name"; return; }
  node tools/render.js --film sigil --from "f$from" --to "f$to" --out "$OUT/$name.mp4" > "build/sigil/logs/$name.log" 2>&1 || echo "FAILED $name"; }
#  0:00 題 | 0:08 ユリア・ヴォル・ザイナ | 0:32 ルリカ・ミリア・燐 | 0:56 ニルメ・レウネ・テルエス | 1:20 エデル・アセラ | 1:36 十一の原理 | 1:52 フルル | 2:08 家
( run 02_yuria_vol_zaina 240 960; run 06_gather 2880 3360; run 01_title 0 240 ) &
( run 03_rurika_miria_rin 960 1680; run 07_sea 3360 3840; run 05_edel_asera 2400 2880 ) &
( run 04_nirume_reune_telues 1680 2400; run 08_home 3840 4860 ) &
wait
ls -la "$OUT"
