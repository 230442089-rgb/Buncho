#!/usr/bin/env python3
"""tools/chase_audio.py — 「ゆり姉、まってぇ♡」に音を付ける。

  python3 tools/chase_audio.py build/chase/silent.mp4 nigete-yuria.master.mp4
  python3 tools/chase_audio.py --wav build/chase/audio/mix.wav        # 音だけ（確認用）

音の材料（どれも CC0）:
  音楽   "Creepy Comedy" Rafael Krux（FreePD）。110 BPM。8.727 秒ごとの低い打音に、場面の変わり目を合わせてある。
           「つかまえた」（1:08.8）で、曲の終わりの 1 フレーズ（121.17 秒〜）へ飛ぶ。
           ユリアの想像の場面では、音楽をこもらせる（低い音だけ残す）。ヤンデレ化の瞬間は音楽を引っこめる。
  効果音 SFX Kit by Wyzowl（ポン、ぼよん、のびる音、きらきら など）
"""
import math, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'build', 'chase', 'audio')
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
DUR = 83.6 if wav_only else ss.probe_duration(video)
SR = ss.SR; N = ss.secs(DUR)
rng = np.random.default_rng(1110)

# ---- 映像と同じ時間割（chase/src/core.js と同じ数字）
BEAT = 0.5455; BAR = BEAT * 4
G = lambda n: 7.713 + 8.727 * n
T = dict(chill=4.45, vol=G(0), turn=G(1), dark=G(1) + BAR * 1.5, dash=G(2), run=G(2) + 1.1, imagine=G(3), no=G(4), wave=G(4) + BAR * 1.75,
         esc=G(5), home=G(6), caught=G(7), last=G(8), card=80.0)
SONG_JUMP = 121.17                    # 「つかまえた」のあと、曲のここへ飛ぶ

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
song = ss.read_audio(ss.lib_path('freepd:Creepy Comedy'))
put(music, fade(song[:ss.secs(T['caught'] + 0.03)], 0.03, 0.04), 0.0)
put(music, fade(song[ss.secs(SONG_JUMP - 0.01):], 0.03, 0.0), T['caught'] - 0.01)
# 想像の場面: こもらせる（もとの音と、低い音だけの音を入れ替える）
muf = (ss.filt(music, 'lp', 900, 2) * 1.25 + ss.reverb(ss.filt(music, 'lp', 1400, 2), 2.2, 0.6) * 0.35) * 0.55
k = env([(0, 0), (T['imagine'], 0), (T['imagine'] + 0.35, 1), (41.2, 1), (41.5, 0), (DUR, 0)])
music = music * (1 - k) + muf * k
# ヤンデレ化の瞬間と、最後の一言の前は、音楽を引っこめる
music *= env([(0, 1), (T['dark'] - 0.12, 1), (T['dark'], 0.4), (22.3, 0.4), (22.6, 0.8), (T['dash'] - 0.3, 0.8), (T['dash'], 1),
              (76.5, 1), (76.7, 0.55), (T['last'] - 0.05, 0.55), (T['last'], 1), (DUR, 1)])

# ------------------------------------------------------------ 効果音（SFX Kit）
_kit = {}
def kit(sid, t, gain_db=0.0, rate=1.0, pan=0.0, lufs_m=-18.0):
    key = (sid, round(rate, 3))
    if key not in _kit:
        y, s, r = ss.kit_sound(sid, rate); _kit[key] = (norm(y, lufs_m), s['sync']['at'] / r)
    y, sync = _kit[key]
    put(sfx, y, t - sync, gain_db, pan)
pop = lambda t, g=-4, big=False: kit('pop-medium-in' if not big else 'pop-large-in', t, g)

# 居間
pop(1.1); kit('notification-success-pluck', 1.3, -12)
kit('whoosh-slow-soft', T['chill'], -5); kit('bass-sub-drop-short', T['chill'], -6); kit('shimmer-short-soft', T['chill'] + 0.05, -12)
kit('pop-small-in', 5.9, -6)
kit('transform-grow', T['vol'] + 0.05, +4, pan=-0.4); kit('pop-large-bubble', T['vol'] + 0.5, -1, pan=-0.4)
kit('pop-medium-bubble', 9.95, -3); kit('shimmer-short-sparkle', 10.0, -9)
kit('move-spring', 11.25, -3, pan=0.4); kit('transform-stretch', 11.3, -8, pan=-0.3)
pop(12.0, -6)
for i, tc in enumerate([13.6, 13.85, 14.05]): kit('transform-grow', tc, -7, rate=1.0 + 0.08 * i, pan=-0.5 + 0.4 * i)
kit('foley-glass-touch', 14.2, -6, pan=-0.5); pop(14.6, -6)
pop(17.0, -5); kit('pop-large-in', 17.7, -1); kit('shimmer-short-sparkle', 17.75, -8); kit('notification-success-pluck', 18.55, -6); kit('foley-fabric-slide', 19.05, -8, pan=0.4)
# ヤンデレ化
kit('reverse-whoosh-long-soft', T['dark'], -4); kit('boom-drop-soft', T['dark'], 0); kit('bass-rumble-medium', T['dark'] + 0.1, -5)
for i in range(6): kit('transform-stretch', T['dark'] + 0.45 + i * 0.14, -8, rate=0.9 + 0.05 * i, pan=-0.6 + 0.2 * i)
kit('pop-large-out', T['dark'] + 0.5, -3); kit('impact-deep-soft', 22.5, -4); kit('pop-large-out', 22.5, -4)
for i in range(4): kit('mechanical-ratchet-light', 22.65 + i * 0.36, -10, rate=1.1, pan=0.5)
kit('pop-small-in', 23.5, -4, pan=0.5); kit('transform-shrink', 24.3, -6, pan=0.4)
# 逃走・題
kit('zip-in-hard', T['dash'], -1); kit('whoosh-fast-hard', T['dash'], -2); kit('appear-poof', T['dash'] + 0.1, -4); kit('impact-medium-firm', T['dash'] + 0.05, -3)
kit('whoosh-fast-medium', T['run'], -5)
t = T['run'] + 0.15
while t < T['imagine'] - 0.2: kit('impact-light-firm', t, -13 + rng.random() * 2, rate=0.95 + 0.15 * rng.random(), pan=0.3 + 0.2 * rng.random()); t += BEAT / 2
kit('pop-medium-in', 27.0, -3); kit('transform-morph', 28.4, -7, pan=-0.5); kit('pop-large-out', 29.2, -3); kit('transform-morph', 29.9, -8, pan=-0.5); kit('pop-medium-in', 31.4, -3)
# 想像
kit('move-zoom-in', T['imagine'] + 0.1, -4); kit('shimmer-long-sparkle', T['imagine'] + 0.1, -5); kit('shimmer-long-soft', T['imagine'] + 0.4, -8)
for tc in [34.5, 36.4, 38.2, 39.9]: kit('appear-flip-quick', tc, -4, pan=-0.6)
for i, tc in enumerate([35.0, 35.9, 36.9, 37.5, 38.7, 39.3, 40.3, 40.75]): kit('pop-medium-bubble', tc, -3, rate=1.0 + 0.04 * (i % 3)); kit('notification-message-in-soft', tc + 0.02, -12)
kit('transform-deflate', 38.25, -6, pan=0.3); kit('notification-success-sparkle', 39.95, -6)
kit('move-zoom-out', 41.25, -4); kit('pop-large-out', 41.3, -4); kit('pop-small-in', 41.45, -6)
# いやいやいや → 波
for i in range(4): kit('whoosh-fast-soft', T['no'] + 0.05 + i * 0.16, -6, pan=(-1) ** i * 0.5)
kit('pop-large-in', T['no'] + 0.05, -2); pop(44.35, -3)
kit('whoosh-medium-hard', T['wave'], -2); kit('shimmer-short-bright', T['wave'] + 0.05, -7); kit('boom-hit-soft', T['wave'], -5)
kit('mechanical-latch-heavy', T['wave'] + 0.4, -2); kit('click-latch-firm', T['wave'] + 0.42, -4)
kit('impact-light-soft', 47.75, -5, pan=-0.2); kit('impact-light-soft', 47.95, -6, pan=0.2)
pop(48.3, -6)
for i in range(7): kit('transform-stretch', 49.78 + i * 0.1, -6, rate=0.88 + 0.045 * i, pan=-0.7 + 0.2 * i)
kit('transform-grow', 49.8, -4, pan=-0.4)
kit('move-spring', 50.05, -5, pan=0.5); kit('pop-medium-in', 50.05, -3); kit('zip-in-hard', 50.6, -3, pan=0.5); kit('appear-poof', 50.65, -6, pan=0.5)
# 町内 → 地球 → 月
A = T['esc']; B = A + 2.9; C = B + 2.9
kit('impact-deep-firm', A + 0.12, -2, pan=-0.6); kit('whoosh-fast-hard', A + 0.2, -4); pop(A + 0.15, -5)
kit('whoosh-medium-medium', B, -4); pop(B + 0.1, -5); kit('whoosh-medium-medium', C, -4); pop(C + 0.1, -5)
t = A + 0.3
while t < T['home'] - 0.1: kit('impact-light-firm', t, -15 + rng.random() * 2, rate=1.05 + 0.15 * rng.random(), pan=rng.uniform(-0.5, 0.5)); t += BEAT / 2
for i in range(2): kit('data-tick', B + 0.25 + (i + 1) / 0.62, -6)
kit('transform-inflate', C + 0.9, -5); kit('shimmer-medium-sparkle', C + 1.5, -7); kit('pop-medium-in', C + 0.4, -4); kit('pop-medium-in', C + 2.0, -4)
# 帰宅
kit('foley-wood-slide', T['home'] + 0.1, -1, pan=0.4); kit('appear-poof', T['home'] + 0.45, -5, pan=0.4)
pop(61.7, -5); pop(63.8, -5); kit('notification-success-pluck', 64.0, -10)
kit('transform-morph', 65.95, -3, pan=-0.3); kit('pop-small-bubble', 66.3, -5, pan=-0.2)
for i, tc in enumerate([66.75, 67.2, 67.75]): kit('transform-stretch', tc, -7, rate=0.9 + 0.06 * i, pan=-0.5 + 0.5 * i)
kit('pop-large-out', 67.3, -3)
for i in range(3): kit('mechanical-ratchet-heavy', 67.72 + i * 0.34, -7, rate=0.9, pan=0.5)
# つかまえた → 結末
kit('celebration-popper', T['caught'], -1); kit('whoosh-fast-hard', T['caught'], -3); kit('impact-medium-firm', T['caught'] + 0.02, -3); kit('shimmer-medium-sparkle', T['caught'] + 0.1, -6)
for i, tc in enumerate([70.3, 71.4, 72.4]): kit('pop-medium-bubble', tc, -2, rate=1.0 + 0.05 * i); kit('notification-message-in-soft', tc + 0.02, -10)
kit('transform-deflate', 69.9, -8, pan=0.3)
pop(72.95, -6); pop(74.8, -5); kit('pop-small-out', 76.6, -4)
kit('move-spring', T['last'], -2, pan=0.4); kit('impact-medium-firm', T['last'], -3); kit('pop-large-in', T['last'], -2)
kit('move-bounce', T['last'] + 0.35, -5, pan=0.4); kit('foley-fabric-slide', T['last'] + 0.5, -6, pan=0.4); kit('foley-fabric-slide', T['last'] + 1.0, -7, pan=0.3)
kit('click-snap-firm', 78.3, -3, pan=-0.6); pop(78.32, -4)
kit('sting-playful-short', T['card'] + 0.25, -5)

mix = music * ss.dbg(-4.0) + sfx * ss.dbg(5.0)          # 効果音が音楽に埋もれないように
if os.environ.get('CHASE_DUMP'):
    ss.write_audio(os.path.join(WORK, 'bus_music.wav'), music / max(1.0, np.abs(music).max())); ss.write_audio(os.path.join(WORK, 'bus_sfx.wav'), sfx / max(1.0, np.abs(sfx).max()))
y = ss.master(mix, -15.1, -2.4)          # AAC にすると山が少し伸びるので、余裕を持たせる
y[-ss.secs(0.5):] *= np.linspace(1, 0, ss.secs(0.5))[:, None]
print(f'buses (LUFS): music {ss.lufs(music):.1f}  sfx {ss.lufs(sfx):.1f}  →  mix {ss.lufs(y):.1f}, peak {20 * np.log10(np.abs(y).max()):.1f} dBFS')
WAV = out if wav_only else os.path.join(WORK, 'mix.wav')
ss.write_audio(WAV, y)
if not wav_only:
    tmp = out[:-4] + '.part.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', WAV, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out)
    print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
