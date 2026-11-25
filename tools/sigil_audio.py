#!/usr/bin/env python3
"""tools/sigil_audio.py — 「外神竜一族 十二の紋章」に音を付ける。

  python3 tools/sigil_audio.py build/sigil/silent.mp4 gaishinryu-monsho.mp4
  python3 tools/sigil_audio.py --wav build/sigil/audio/mix.wav        # 音だけ（確認用）

音の材料（どれも CC0）:
  音楽   "Arpent" Kevin MacLeod（FreePD）。120 BPM。編集せずに頭から終わりまで使う（拍は 0.5 秒ごと。曲の拍が 0.02 秒
           遅れて鳴るので、そのぶんだけ前へずらして、絵の切り替わりにぴったり合わせる）。
           8 秒（4 小節）にひとり。112〜128 秒は曲が静まる → フルル。128 秒で曲が戻る → 家族の紋。
  効果音 SFX Kit by Wyzowl（ひとりずつ、その人の原理に合う音: 波・変形・打撃と鼓動・はめこむ音・ひと振り・結ぶ音・
           落ちてくる星・情報の粒・並べ替え・紙とガラス・跳ね返り）
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'build', 'sigil', 'audio')
os.makedirs(WORK, exist_ok=True)
STUDIO = os.path.join(WORK, 'sound_studio.py')
if not os.path.exists(STUDIO):
    found = subprocess.run("find /root/.claude/skills ~/.claude/skills /mnt/skills -path '*/video-making-custom-sound/SKILL.md' 2>/dev/null | head -1",
                           shell=True, capture_output=True, text=True).stdout.strip()
    if not found: sys.exit('sound_studio.py が見つかりません（video-making-custom-sound スキルが必要です）')
    out, on = [], False
    for line in open(found, encoding='utf-8'):
        if line.startswith('```python sound_studio.py'): on = True; continue
        if on and line.startswith('```'): break
        if on: out.append(line)
    open(STUDIO, 'w', encoding='utf-8').write(''.join(out))
sys.path.insert(0, WORK)
import numpy as np
import sound_studio as ss

args = sys.argv[1:]
wav_only = args[0] == '--wav'
video, out = (None, args[1]) if wav_only else (args[0], args[1])
DUR = 162.0 if wav_only else ss.probe_duration(video)
SR = ss.SR; N = ss.secs(DUR)

# ---- 映像と同じ時間割（sigil/src/core.js と同じ数字）
ORDER = ['yuria', 'vol', 'zaina', 'rurika', 'miria', 'rin', 'nirume', 'reune', 'telues', 'edel', 'asera']
SLOT, HIT = 8.0, 4.0
T = dict(title=0.0, first=8.0, gather=96.0, sea=112.0, home=128.0)
S0 = {k: T['first'] + i * SLOT for i, k in enumerate(ORDER)}

def bus(): return np.zeros((N, 2))
def put(dst, y, t, gain_db=0.0, pan=0.0):
    y = ss.to_st(np.asarray(y, float), pan); i = int(round(t * SR))
    if i < 0: y, i = y[-i:], 0
    j = min(N, i + len(y))
    if j > i: dst[i:j] += y[:j - i] * ss.dbg(gain_db)
def env(points):
    t = np.arange(N) / SR; xs, ys = zip(*points)
    return np.interp(t, xs, ys)[:, None]
def norm(y, lufs_m): l = ss.lufs(y, True); return y * ss.dbg(lufs_m - l) if l > -70 else y

music, sfx = bus(), bus()

# ------------------------------------------------------------ 音楽（頭の 0.02 秒を落として、拍を絵に合わせる）
song = ss.to_st(ss.read_audio(ss.lib_path('freepd:Arpent')))[ss.secs(0.02):]
song[:ss.secs(0.004)] *= np.linspace(0, 1, ss.secs(0.004))[:, None]
put(music, song, 0.0)

# ------------------------------------------------------------ 効果音（SFX Kit）
_kit = {}
def kit(sid, t, gain_db=0.0, rate=1.0, pan=0.0, lufs_m=-18.0):
    key = (sid, round(rate, 3))
    if key not in _kit:
        y, s, r = ss.kit_sound(sid, rate); _kit[key] = (norm(y, lufs_m), s['sync']['at'] / r)
    y, sync = _kit[key]
    put(sfx, y, t - sync, gain_db, pan)

# 題: 宇宙の外から十二の光
for i in range(12): kit('pop-small-in', 0.2 + 0.13 * i + 1.0, -13, rate=0.85 + 0.04 * i, pan=np.sin(i * 0.52) * 0.6)
kit('shimmer-long-soft', 0.3, -11); kit('whoosh-slow-medium', 2.0, -7); kit('impact-deep-soft', 2.0, -6); kit('swish-soft', 4.0, -10)
kit('reverse-whoosh-medium-soft', 8.0, -6)

# ひとりずつ。共通: 組み上がる瞬間（4 秒目）の重み、名前が出る音、次へ移る音
def common(s0):
    kit('boom-hit-soft', s0 + HIT, -7); kit('swish-soft', s0 + HIT + 0.08, -11); kit('whoosh-fast-soft', s0 + 7.55, -9)
for k in ORDER: common(S0[k])

s = S0['yuria']       # 波の輪が三つ → 止まる → 光の槍
for i, t in enumerate((1.0, 1.5, 2.0)): kit('whoosh-medium-soft', s + t + 0.12, -8, rate=1.0 + 0.06 * i)
kit('shimmer-short-soft', s + 1.7, -11); kit('zip-in-hard', s + 3.2, -6); kit('shimmer-medium-bright', s + HIT, -6); kit('impact-medium-firm', s + HIT, -7)
s = S0['vol']         # かたちが変わる → 眷属 → ハート → 目がひらく
for t, r in ((0.5, 1.0), (1.0, 1.1), (1.5, 0.92), (2.0, 1.06)): kit('transform-morph', s + t, -10, rate=r)
for i in range(3): kit('pop-small-bubble', s + 0.85 + 0.15 * i, -10, rate=1.0 + 0.1 * i, pan=-0.4 + 0.4 * i)
kit('transform-stretch', s + 2.5, -8); kit('pop-medium-bubble', s + 3.25, -8); kit('pop-small-in', s + 3.82, -9, pan=-0.2); kit('shimmer-medium-soft', s + HIT, -8)
for t in (5.33, 5.78): kit('click-hover-soft', s + t, -18)
s = S0['zaina']       # 受け止める盾 → 脈
kit('swish-medium', s + 0.5, -10)
for t, p in ((1.25, -0.5), (1.75, 0.5), (2.25, -0.3)): kit('whoosh-fast-hard', s + t - 0.02, -9, pan=p); kit('impact-medium-firm', s + t, -6, pan=p * 0.6); kit('click-clap-soft', s + t + 0.42, -16)
kit('transform-grow', s + 3.15, -9); kit('impact-heavy-soft', s + HIT, -4)
for b in range(4): kit('impact-deep-soft', s + 4 + b, -9 if b else -30, rate=1.15); kit('impact-light-soft', s + 4.22 + b, -12, rate=0.9)
s = S0['rurika']      # 審理（走査）→ 判決 → 執行（九つの辺がはまる）
kit('digital-scan-subtle', s + 0.5, -9); kit('data-tick', s + 0.9, -10); kit('data-tick', s + 1.2, -10)
for i in range(9): kit('click-latch-medium', s + 2.0 + 0.105 * i + 0.22, -12, rate=0.9 + 0.035 * i, pan=-0.4 + 0.1 * i)
kit('mechanical-slider-light', s + 3.95, -8); kit('click-clip-firm', s + HIT, -10); kit('shimmer-short-bright', s + HIT + 0.02, -9)
s = S0['miria']       # 軌跡の先へ跳ぶ → 駆け上がる → ひと振り → 怖さ
kit('zip-out-medium', s + 1.21, -8); kit('zip-out-medium', s + 2.01, -8, rate=1.12); kit('riser-1s-soft', s + 3.3, -10)
kit('swish-hard', s + 3.5, -3); kit('whoosh-fast-hard', s + 3.5, -6); kit('pop-small-in', s + 3.86, -9, pan=0.3)
kit('bass-sub-drop-short', s + HIT, -6); kit('reverse-whoosh-short-soft', s + HIT, -10)
s = S0['rin']         # 紐が張られる → 結ばれる → 結界
for i in range(4): kit('swish-medium', s + 0.25 + 0.3 * i + 0.25, -8, rate=0.9 + 0.07 * i, pan=(-1) ** i * 0.5)
kit('transform-stretch', s + 2.3, -9); kit('foley-fabric-slide', s + 2.9, -8); kit('click-latch-firm', s + 3.55, -11); kit('pop-small-in', s + 3.65, -10)
kit('shimmer-medium-soft', s + HIT, -7); kit('whoosh-medium-soft', s + HIT + 0.15, -10)
for i in range(4): kit('pop-small-out', s + 5.3 + 0.37 * i, -15, pan=np.cos(i * 1.6) * 0.5)
s = S0['nirume']      # 落ちてくる星 → 宝石 → やわらかい引力
kit('faller-2s-soft', s + 0.7, -9); kit('reverse-whoosh-long-soft', s + 3.55, -9)
for i, t in enumerate((3.0, 3.3, 3.58)): kit('shimmer-short-sparkle', s + t, -10, rate=0.92 + 0.1 * i, pan=-0.3 + 0.3 * i)
kit('impact-deep-soft', s + HIT, -6); kit('shimmer-long-soft', s + HIT, -8)
s = S0['reune']       # 情報の雨 → 目がひらく → 書きこまれる
kit('digital-process-subtle', s + 0.2, -11); kit('digital-process-subtle', s + 1.35, -12, rate=1.1); kit('swipe-slow-soft', s + 1.2, -9); kit('mechanical-slider-light', s + 2.55, -9)
for i in range(6): kit('data-tick', s + 2.96 + 0.083 * i, -9)
for i in range(4): kit('digital-blip-subtle', s + 3.25 + 0.15 * i + 0.2, -9, rate=1.0 + 0.06 * i, pan=0.35)
kit('digital-blip-clear', s + HIT, -8); kit('shimmer-short-soft', s + HIT + 0.03, -10)
s = S0['telues']      # 三つの理 → 並べ替え ×2 → 一点に畳む → 噴流
for i in range(3): kit('swipe-medium-soft', s + 0.2 + 0.12 * i, -11, rate=1.0 + 0.08 * i)
kit('whoosh-medium-medium', s + 1.25, -6); kit('click-rocker-firm', s + 1.5, -8); kit('whoosh-medium-medium', s + 2.1, -6, rate=1.1); kit('click-rocker-firm', s + 2.35, -8, rate=1.1)
kit('reverse-whoosh-short-soft', s + 2.95, -7); kit('zip-out-hard', s + 3.3, -7); kit('shimmer-medium-bright', s + HIT, -6)
s = S0['edel']        # 筆 → 額縁が運ばれてくる → 感情が宝石に
kit('writing-marker-draw', s + 0.3, -9)
for i, (a, b) in enumerate(((1.35, 2.2), (1.75, 2.6), (2.15, 3.0))): kit('foley-paper-slide', s + a + 0.2, -9, rate=1.0 - 0.06 * i); kit('foley-wood-touch', s + b, -7, rate=0.9 + 0.08 * i)
kit('shimmer-short-sparkle', s + 3.25, -11); kit('foley-glass-touch', s + 3.62, -5); kit('shimmer-short-bright', s + HIT + 0.2, -10)
kit('foley-wood-slide', s + 5.55, -11); kit('foley-wood-slide', s + 6.55, -12, rate=1.1)
s = S0['asera']       # 飛んでくる → 触れて止める → 逆へ放つ ×3 → 最後の一本
for t, p in ((0.72, 0.5), (1.22, -0.6), (1.72, 0.6)): kit('whoosh-fast-hard', s + t - 0.08, -8, pan=p); kit('impact-light-firm', s + t, -5, pan=p * 0.7); kit('zip-out-medium', s + t + 0.14, -8, rate=1.15, pan=p * 0.5)
kit('whoosh-fast-hard', s + 3.1, -5); kit('impact-medium-firm', s + 3.2, -4); kit('riser-1s-soft', s + 3.42, -13); kit('zip-out-hard', s + 3.44, -6); kit('impact-medium-hard', s + HIT, -9)

# 十一の原理が並ぶ → まん中へ落ちていく
g = T['gather']
for i in range(11): kit('pop-medium-in', g + 0.25 + 0.5 * i + 1.1, -9, rate=0.84 + 0.035 * i, pan=np.sin(i * 0.571) * 0.6)
kit('shimmer-long-sparkle', g + 8.0, -10); kit('reverse-whoosh-long-strong', g + 16.0, -5); kit('faller-2s-soft', g + 14.0, -9)
# フルル: 静かな海
z = T['sea']
kit('boom-drop-soft', z, -4); kit('shimmer-long-soft', z + 1.2, -10)
for i in range(11): kit('pop-small-bubble', z + 2.0 + (i >> 1) * 2.0 + (i & 1) * 0.55, -8, rate=0.9 + 0.03 * i, pan=np.cos(i * 0.6) * 0.4); kit('shimmer-short-soft', z + 2.02 + (i >> 1) * 2.0 + (i & 1) * 0.55, -13)
kit('swish-soft', z + 7.95, -10); kit('swish-soft', z + 12.1, -11); kit('riser-2s-soft', z + 16.0, -6); kit('reverse-whoosh-medium-soft', z + 16.0, -7)
# 家: 家族の紋 → 一覧 → 暗い地 → 結び
h = T['home']
kit('impact-medium-soft', h, -4); kit('shimmer-medium-sparkle', h + 0.02, -6)
for i in range(11): kit('pop-small-in', h + 1.0 + 0.25 * i + 0.3, -9, rate=0.9 + 0.03 * i, pan=np.sin(i * 0.571) * 0.5)
kit('swish-soft', h + 1.7, -10)
kit('whoosh-medium-medium', h + 8.35, -6)
for i in range(12): kit('pop-medium-in', h + 8.85 + 0.035 * i, -10, rate=0.9 + 0.025 * i, pan=-0.75 + 0.3 * (i % 6))
kit('whoosh-medium-hard', h + 16.2, -5); kit('boom-hit-soft', h + 16.0, -6)
for i in range(12): kit('pop-small-in', h + 16.5 + 0.375 * i, -15, rate=0.9 + 0.025 * i, pan=-0.75 + 0.3 * (i % 6))
kit('whoosh-medium-soft', h + 24.2, -6); kit('shimmer-long-sparkle', h + 24.0, -7); kit('impact-medium-soft', h + 24.0, -6)
kit('swish-soft', h + 24.85, -10); kit('swish-soft', h + 26.05, -11)

mix = music * ss.dbg(-3.5) + sfx * ss.dbg(3.0)
if os.environ.get('SIGIL_DUMP'):
    ss.write_audio(os.path.join(WORK, 'bus_music.wav'), music / max(1.0, np.abs(music).max())); ss.write_audio(os.path.join(WORK, 'bus_sfx.wav'), sfx / max(1.0, np.abs(sfx).max()))
y = ss.master(mix, -15.6, -2.4)          # AAC にすると山が少し伸びるので、余裕を持たせる
y[-ss.secs(0.4):] *= np.linspace(1, 0, ss.secs(0.4))[:, None]
print(f'buses (LUFS): music {ss.lufs(music):.1f}  sfx {ss.lufs(sfx):.1f}  →  mix {ss.lufs(y):.1f}, peak {20 * np.log10(np.abs(y).max()):.1f} dBFS;  sfx peak before master {20 * np.log10(np.abs(sfx).max() * ss.dbg(3.0)):.1f} dBFS')
WAV = out if wav_only else os.path.join(WORK, 'mix.wav')
ss.write_audio(WAV, y)
if not wav_only:
    tmp = out[:-4] + '.part.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', WAV, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out)
    print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
