#!/usr/bin/env python3
# 「外神竜に会いに行こう」ムービー（gaishinryu-movie.mp4、60秒）の書き出し用ページを作る。本編 shuken/index.html の写しに core.js・base.js・gs.js を差し込む（本編は書き換えない）。
# 手順（このフォルダで）:
#   1. python3 buildgs.py /tmp/gaishinryu_render.html
#   2. PAGE=/tmp/gaishinryu_render.html THREE_JS=<three.js r128 の three.min.js> FONT_DIR=<フォントの ttf を置いたフォルダ> node render.js u1 out/u1.mp4   （u1〜u5）
#      フォント: Shippori Mincho B1 (SemiBold/ExtraBold), Zen Kaku Gothic New (Medium/Bold/Black)（いずれも OFL）
#      静止画で確かめるとき: node render.js u3 stills 29.8,31.5 out/stills
#   3. out/ の mp4 を u1 u2 u3 u4 u5 の順に ffmpeg の concat（-c copy）で silent.mp4 にする（1800 コマ、60.000 秒）
#      0.0 朝の駅前 / 6.633 十二の仕事場から五人 / 26.467 高蔵寺の丘（29.80 に一族十二人）/ 45.533 主家の卓袱台 / 52.967 夕方の駅前と終わりの札
#   4. GS_WORK=<silent.mp4 のあるフォルダ> SOUND_STUDIO_DIR=<sound_studio.py のあるフォルダ> python3 make_audio.py final.mp4
#      sound_studio.py は動画づくりのスキル（video-making-custom-sound）に入っている。音は FreePD（曲 Inventing Flight）・SFX Kit（効果音）・Blanket（環境音）の CC0／public domain の素材。
# storyboard.json は絵コンテ（ショットごとの画・カメラ・字の出入りのコマ・音の計画）。
import sys, subprocess, os, re, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get('SHUKEN', os.path.join(HERE, '..', '..', 'shuken', 'index.html'))
ANCHOR = '// ================= 第一章の台本 ================='
FILES = ['core.js', 'base.js', 'gs.js']   # このフォルダにある
src = open(SRC, encoding='utf-8').read()
assert src.count(ANCHOR) == 1, 'anchor'
mod = ''.join(open(os.path.join(HERE, f), encoding='utf-8').read() + '\n' for f in FILES)
out = src.replace(ANCHOR, mod + '\n' + ANCHOR)
dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'gaishinryu_render.html')
open(dst, 'w', encoding='utf-8').write(out)
m = [s for s in re.findall(r'<script>([\s\S]*?)</script>', out) if 'window.__ad' in s]
assert m, 'no ad script'
tmp = os.path.join(tempfile.gettempdir(), 'gaishinryu_check.js'); open(tmp, 'w', encoding='utf-8').write(m[0])
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
sys.stdout.write(('SYNTAX_OK' if r.returncode == 0 else 'SYNTAX_ERR\n' + r.stderr[-2000:]) + '\n')
