#!/usr/bin/env python3
# 断偽文鳥門 入門CM（dangi-ad.mp4）の書き出し用ページを作る。本編 shuken/index.html の写しに core.js と scenes.js を差し込む（本編は書き換えない）。
# 手順（このフォルダで）:
#   1. python3 buildad.py /tmp/dangi_render.html
#   2. PAGE=/tmp/dangi_render.html THREE_JS=<three.js r128 の three.min.js> FONT_DIR=<フォントの ttf を置いたフォルダ> node render.js u1 out/u1.mp4   （u1〜u6）
#      フォント: Shippori Mincho B1 (SemiBold/ExtraBold), Zen Kaku Gothic New (Medium/Bold/Black), Dela Gothic One, Zen Old Mincho Black, Yuji Syuku（いずれも OFL）
#   3. out/u1〜u6.mp4 を ffmpeg の concat（-c copy）で silent.mp4 にする
#   4. AD_WORK=<silent.mp4 のあるフォルダ> SOUND_STUDIO_DIR=<sound_studio.py のあるフォルダ> python3 make_audio.py final.mp4
#      sound_studio.py は動画づくりのスキル（video-making-custom-sound）に入っている。音は FreePD と SFX Kit の CC0 素材。
import sys, subprocess, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get('SHUKEN', os.path.join(HERE, '..', '..', 'shuken', 'index.html'))
ANCHOR = '// ================= 第一章の台本 ================='
src = open(SRC, encoding='utf-8').read()
assert src.count(ANCHOR) == 1, 'anchor'
mod = ''.join(open(os.path.join(HERE, f), encoding='utf-8').read() + '\n' for f in ['core.js', 'scenes.js'])
out = src.replace(ANCHOR, mod + '\n' + ANCHOR)
import tempfile
dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'dangi_render.html')
open(dst, 'w', encoding='utf-8').write(out)
# 構文の確認：差し込んだ script をまるごと node で読む
import re
m = [s for s in re.findall(r'<script>([\s\S]*?)</script>', out) if 'window.__ad' in s]
assert m, 'no ad script'
tmp = os.path.join(tempfile.gettempdir(), 'dangi_syntax_check.js'); open(tmp, 'w', encoding='utf-8').write(m[0])
r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
print('SYNTAX_OK' if r.returncode == 0 else 'SYNTAX_ERR\n' + r.stderr[-1500:]); print('bytes', len(out.encode('utf-8')), '->', dst)
