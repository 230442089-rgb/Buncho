#!/usr/bin/env bash
# tools/sigil_export.sh — ロゴ単体を logos/ に書き出す: SVG（明るい地・暗い地）、一覧の PNG、ひとりずつの札（PNG）
set -euo pipefail
cd "$(dirname "$0")/.."
node tools/sigil_export.mjs logos/svg
T=build/sigil/export; rm -rf "$T"; mkdir -p "$T" logos/cards
for mode in light dark; do node tools/frame.js --film sigil --out "$T" --query "sheet=$mode" --png f0 > /dev/null; mv "$T/f00000.png" "logos/sheet-$mode.png"; done
for id in yuria vol zaina rurika miria rin nirume reune telues edel asera fururu; do node tools/frame.js --film sigil --out "$T" --query "sheet=light&id=$id" --png f0 > /dev/null; mv "$T/f00000.png" "logos/cards/$id.png"; done
ls -la logos logos/svg | head -40
