#!/usr/bin/env bash
# tools/fetch-fonts.sh — 日本語の書体（SIL Open Font License）を Google Fonts のリポジトリから film/fonts/ に取ってくる
set -euo pipefail
cd "$(dirname "$0")/../film/fonts"
base="https://raw.githubusercontent.com/google/fonts/main"
for w in Regular Medium SemiBold Bold ExtraBold; do
  [ -f "ShipporiMincho-$w.ttf" ] || curl -sSfL --retry 3 -o "ShipporiMincho-$w.ttf" "$base/ofl/shipporimincho/ShipporiMincho-$w.ttf"
done
[ -f NotoSansJP-VF.ttf ] || curl -sSfL --retry 3 -o NotoSansJP-VF.ttf "$base/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"
ls -la
