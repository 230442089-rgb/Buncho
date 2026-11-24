#!/usr/bin/env python3
"""tools/mama_audio.py — 「ふたりとも、おいでぇ♡」に音を付ける。

  python3 tools/mama_audio.py build/mama/silent.mp4 futaritomo-oide.mp4
  python3 tools/mama_audio.py --wav build/mama/audio/mix.wav        # 音だけ（確認用）

音の材料（どれも CC0）:
  音楽   "Slice of Life" Bryan Teoh（FreePD）。72.5 BPM、1 小節 3.3104 秒（小節の頭は 0.26 + 3.3104 n 秒）。
           映像の小節 0〜9 = 曲の 0〜9 小節、10〜11 = 曲の 8〜9、12〜17 = 曲の 4〜9（最初の旋律をもう一度）、
           18〜21 = 曲の終わりの 4 小節（37〜40）。最後の和音（映像 72.2 秒）で題が出る。
           つなぎ目は小節の頭の少し手前で、40 ミリ秒かけて入れ替える。どこも同じ調（ニ長調）の中でつないでいる。
  効果音 SFX Kit by Wyzowl（ポン、ぽふっ、布のこすれる音、きらきら、時計 など）
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'build', 'mama', 'audio')
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
DUR = 76.9 if wav_only else ss.probe_duration(video)
SR = ss.SR; N = ss.secs(DUR)

# ---- 映像と同じ時間割（mama/src/core.js と同じ数字）
BAR = 3.3104
B = lambda n: 0.26 + BAR * n
T = dict(door=B(2), help=B(3), excuse=B(4), plan=B(5), mama=B(6), oide=B(7), loose=B(8), pofu=B(9), reply=B(10), vol=B(11), hug=B(12), yuria=B(13), pat=B(14),
         kawaii=B(15), motto=B(16), tired=B(17), stay=B(18), eve=B(19), narr=B(20), ruri=B(21), card=B(19) + 9.06)

def bus(): return np.zeros((N, 2))
def put(dst, y, t, gain_db=0.0, pan=0.0):
    y = ss.to_st(np.asarray(y, float), pan); i = int(round(t * SR))
    if i < 0: y, i = y[-i:], 0
    j = min(N, i + len(y))
    if j > i: dst[i:j] += y[:j - i] * ss.dbg(gain_db)
def fade(y, fin=0.0, fout=0.0):
    y = np.array(y, float)
    if fin > 0: k = min(len(y), ss.secs(fin)); y[:k] *= np.linspace(0, 1, k)[:, None]
    if fout > 0: k = min(len(y), ss.secs(fout)); y[-k:] *= np.linspace(1, 0, k)[:, None]
    return y
def env(points):
    """[(秒, 値), ...] を全体の長さの包絡に"""
    t = np.arange(N) / SR; xs, ys = zip(*points)
    return np.interp(t, xs, ys)[:, None]
def norm(y, lufs_m): l = ss.lufs(y, True); return y * ss.dbg(lufs_m - l) if l > -70 else y

music, sfx = bus(), bus()

# ------------------------------------------------------------ 音楽
song = ss.to_st(ss.read_audio(ss.lib_path('freepd:Slice of Life')))
XF, LEAD = 0.04, 0.08          # 入れ替えにかける時間と、小節の頭より手前で入れ替えを始める時間
LATE = 0.025                   # 曲の拍は小節の目盛りより 0.03 秒ほど早く鳴るので、そのぶん遅らせて絵の切り替わりに合わせる
def seg(s0, s1, f0, first=False, last=False):
    """曲の s0〜s1 秒を、映像の f0 秒から置く（前後のつなぎ目は小節の頭の手前で入れ替える）"""
    a = 0.0 if first else s0 - LEAD; b = len(song) / SR if last else s1 - LEAD + XF
    y = fade(song[ss.secs(a):ss.secs(b)], 0.015 if first else XF, 0.0 if last else XF)
    put(music, y, f0 - (s0 - a) + LATE)
seg(0, B(10), 0, first=True)            # 映像の小節 0〜9
seg(B(8), B(10), B(10))                 # 10〜11
seg(B(4), B(10), B(12))                 # 12〜17（最初の旋律をもう一度）
seg(B(37), 0, B(18), last=True)         # 18〜（終わりの 4 小節と、最後の和音）
music *= env([(0, 1), (T['eve'] - 0.5, 1), (T['eve'] + 1.0, 0.84), (DUR, 0.84)])      # 夕方は少し控えめに

# ------------------------------------------------------------ 効果音（SFX Kit）
_kit = {}
def kit(sid, t, gain_db=0.0, rate=1.0, pan=0.0, lufs_m=-18.0, dur=None):
    key = (sid, round(rate, 3))
    if key not in _kit:
        y, s, r = ss.kit_sound(sid, rate); _kit[key] = (norm(y, lufs_m), s['sync']['at'] / r)
    y, sync = _kit[key]
    if dur: y = fade(y[:ss.secs(dur)], 0, 0.15)
    put(sfx, y, t - sync, gain_db, pan)
pop = lambda t, g=-6, pan=0.0: kit('pop-medium-in', t, g - 4, pan=pan)       # 吹き出しの出る音は控えめに
pip = lambda t, g=-8, pan=0.0: kit('pop-small-in', t, g - 4, pan=pan)
rub = lambda t, g=-11, pan=0.0: kit('foley-fabric-slide', t, g, pan=pan)
PAT = np.pi / 7                         # 撫でる手の往復（映像の pat = 0.5 − 0.5 cos(7t) と同じ）

# つかまって 3 時間目
pop(0.45, -5); pip(1.2); pip(4.1); kit('notification-message-in-soft', 4.9, -13)
for t in (4.65, 5.62, 6.58): rub(t, -8, -0.15)
# ママが帰ってくる
kit('mechanical-latch-heavy', T['door'], -7, pan=-0.6); kit('whoosh-fast-soft', T['door'] + 0.08, -8, pan=-0.6)
kit('move-spring', T['door'] + 0.4, -11, pan=-0.1); kit('shimmer-short-sparkle', T['door'] + 0.62, -9, pan=0.3)
pop(T['door'] + 0.77, -5, -0.4); pip(T['door'] + 1.62, -6, 0.4)
# たすけてぇ
kit('pop-large-in', T['help'] + 0.05, -6)
for i in range(2): kit('whoosh-fast-soft', T['help'] + 0.06 + i * 0.16, -7, pan=(-1) ** i * 0.5)
kit('move-bounce', T['help'] + 0.3, -7, pan=0.3)
for t in (0.85, 1.35, 2.2, 2.8): rub(T['help'] + t, -10, 0.3)
pop(T['help'] + 1.7, -4)
# 妙に整った説明と、計画表
pip(T['excuse'] + 0.08, -7, -0.3)
kit('whoosh-fast-soft', T['plan'] + 0.08, -8, pan=-0.5); kit('appear-flip-quick', T['plan'] + 0.42, -6, pan=-0.5); pip(T['plan'] + 0.1, -8, 0.2)
for i in range(3): kit('writing-pen-tick', T['plan'] + 0.42 + i * 0.3, -11, pan=-0.5)
kit('notification-failure-thud', T['plan'] + 1.3, -6, pan=-0.5)
kit('impact-deep-soft', T['plan'] + 1.6, -5, pan=0.3); kit('faller-1s-soft', T['plan'] + 1.62, -9, pan=0.3)
# フルルは気づいている → おいで
kit('pop-medium-bubble', T['mama'] + 0.25, -6, pan=-0.3)
kit('whoosh-slow-soft', T['oide'], -8); kit('shimmer-long-sparkle', T['oide'] + 0.02, -8); kit('shimmer-medium-soft', T['oide'] + 0.2, -9); kit('pop-large-in', T['oide'] + 0.12, -7, pan=0.3)
# ほどける → 走る
FREE, RUN = T['loose'] + 0.8, T['loose'] + 1.15
kit('transform-deflate', T['loose'] + 0.05, -14, pan=0.3)
kit('pop-large-bubble', FREE, -5, pan=0.3); kit('appear-poof', FREE + 0.02, -8, pan=0.3); kit('pop-large-in', FREE, -8, pan=0.3)
kit('whoosh-fast-medium', RUN, -6, pan=0.2); pop(RUN + 0.1, -4, 0.2); kit('pop-small-out', FREE + 0.5, -8, pan=-0.1)
t = RUN + 0.06; i = 0
while t < T['pofu'] - 0.25:
    u = (t - RUN) / (T['pofu'] - RUN); kit('impact-light-firm', t, -14 + (i % 2), rate=1.1 + 0.06 * (i % 3), pan=0.3 - 0.6 * u); t += 0.19; i += 1
# ぽふっ（ユリア）
def pofu(t, g=0.0):
    kit('impact-medium-soft', t, g - 3); kit('impact-deep-soft', t, g - 7); kit('foley-fabric-touch', t + 0.02, g - 4); kit('shimmer-short-soft', t + 0.06, g - 9)
pofu(T['pofu'])
pip(T['pofu'] + 1.03, -7, 0.3)
pop(T['reply'] + 0.08, -6, -0.2); pip(T['reply'] + 1.55, -7, 0.2)
pop(T['vol'] + 0.08, -6, 0.3); kit('shimmer-short-sparkle', T['vol'] + 0.14, -10, pan=0.3)
kit('move-spring', T['vol'] + 1.85, -9, pan=0.2); kit('whoosh-medium-soft', T['vol'] + 2.6, -7)
# ぽふっ（ヴォル）。三人
pofu(T['hug']); kit('shimmer-medium-sparkle', T['hug'] + 0.05, -6); kit('pop-large-bubble', T['hug'] + 0.03, -5)
M0 = T['hug'] + 0.9                     # メロメロ度
pop(M0, -6, -0.5); kit('data-countup-medium', M0 + 0.4, -9, pan=-0.5); kit('data-countup-medium', M0 + 0.95, -10, rate=0.92, pan=-0.5)
kit('foley-fabric-touch', T['hug'] + 1.0, -8, pan=-0.5); kit('foley-fabric-touch', T['hug'] + 1.7, -9, pan=0.5)
# ここ借りる（ユリアの頭をなでる）
pip(T['yuria'] + 0.12, -8, 0.3)
k = int(np.ceil((T['yuria'] + 0.15) / PAT))
while k * PAT < T['pat'] - 0.2: rub(k * PAT, -8, 0.3); k += 1
for i in range(3): kit('foley-fabric-touch', T['yuria'] + 1.3 + i * 0.25, -12, pan=0.6)
# 撫でていてください（ヴォルの頭をなでる）
pip(T['pat'] + 0.12, -8, -0.3)
for i in range(3): kit('transform-stretch', T['pat'] + 0.25 + i * 0.15, -15, rate=0.9 + 0.05 * i, pan=-0.6)
k = int(np.ceil((T['pat'] + 0.05) / PAT))
while k * PAT < T['kawaii'] - 0.05: rub(k * PAT, -8, -0.35); k += 1
# 可愛いねぇ（メロメロ度が振り切れる）
kit('shimmer-long-sparkle', T['kawaii'], -8); kit('pop-large-bubble', T['kawaii'] + 0.02, -6); kit('data-countup-short', T['kawaii'] + 0.03, -8, pan=-0.5)
pop(T['kawaii'] + 0.12, -6, 0.3); kit('impact-light-firm', T['kawaii'] + 0.35, -10, pan=-0.4); pop(T['kawaii'] + 0.36, -6, -0.4)
kit('faller-1s-soft', T['kawaii'] + 0.3, -8, pan=-0.4); kit('faller-1s-soft', T['kawaii'] + 0.8, -10, rate=1.15, pan=0.4)
# ママも、もうちょっと
pop(T['motto'] + 0.12, -6, 0.3)
for t in (0.6, 1.25, 1.9, 2.55): rub(T['motto'] + t, -8, -0.1)
# 落ち着きますねぇ / 疲れたかも / ここにいよっか
pip(T['tired'] + 0.12, -9, -0.3); kit('pop-small-out', T['tired'] + 1.68, -9, pan=0.3); pip(T['stay'] + 0.12, -8, -0.2)
kit('whoosh-slow-soft', T['eve'] - 0.1, -10)
# 夕方（時計の音だけ）
t = T['eve'] + 0.55
while t < T['card'] - 0.6: kit('time-clock', t, -18, pan=-0.3, dur=min(3.0, T['card'] - 0.3 - t)); t += 3.0
kit('shimmer-short-soft', T['narr'] + 0.05, -14)
pip(T['ruri'] + 0.1, -9, -0.6); rub(T['ruri'] + 0.6, -8, 0.3); kit('foley-fabric-touch', T['ruri'] + 1.35, -9, pan=0.3)
kit('shimmer-medium-soft', T['card'] + 0.1, -7)

mix = music * ss.dbg(-6.0) + sfx * ss.dbg(4.0)          # 効果音が音楽に埋もれないように
if os.environ.get('MAMA_DUMP'):
    ss.write_audio(os.path.join(WORK, 'bus_music.wav'), music / max(1.0, np.abs(music).max())); ss.write_audio(os.path.join(WORK, 'bus_sfx.wav'), sfx / max(1.0, np.abs(sfx).max()))
y = ss.master(mix, -15.8, -2.4)          # AAC にすると山が少し伸びるので、余裕を持たせる
y[-ss.secs(0.5):] *= np.linspace(1, 0, ss.secs(0.5))[:, None]
print(f'buses (LUFS): music {ss.lufs(music):.1f}  sfx {ss.lufs(sfx):.1f}  →  mix {ss.lufs(y):.1f}, peak {20 * np.log10(np.abs(y).max()):.1f} dBFS')
WAV = out if wav_only else os.path.join(WORK, 'mix.wav')
ss.write_audio(WAV, y)
if not wav_only:
    tmp = out[:-4] + '.part.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', WAV, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out)
    print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
