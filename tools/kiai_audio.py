#!/usr/bin/env python3
"""tools/kiai_audio.py — 「気合い」に音を付ける。

  python3 tools/kiai_audio.py build/kiai/silent.mp4 kiai.master.mp4
  python3 tools/kiai_audio.py --wav build/kiai/audio/mix.wav        # 音だけ（確認用）

音の材料:
  音楽   "Rulers of Our Lands" Rafael Krux／夜明けに "Infinite Peace" Kevin MacLeod（どちらも FreePD, CC0）… 映像はこの曲の 4 秒ごとのフレーズに合わせて組んである。
           曲の 28.05〜80 秒（静かな低音 → 積み上がり）を 0:10〜1:02 に、84.04 秒からの全合奏を 1:17 からに置く。
           あいだ（二度目の事故）は音楽なし。
  声     tools/kiai_voice.py の叫び（合成音声 Open JTalk + HTS voice "NIT ATR503 M001" を WORLD で加工）
  効果音 SFX Kit by Wyzowl（CC0）   環境音 Blanket の birds / stream / wind / fireplace（CC0・パブリックドメイン）
線量計の「カチカチ」は、SFX Kit の短いクリックを乱数の間隔で並べたもの。
最後の絶叫では、全体の音を「スピーカーが割れて、途切れる」ように加工し、和音の一撃で戻す。
"""
import math, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'build', 'kiai', 'audio')
os.makedirs(WORK, exist_ok=True)

# ---- sound_studio.py を用意する（video-making-custom-sound スキルの SKILL.md から取り出す）
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
sys.path.insert(0, WORK); sys.path.insert(0, os.path.join(ROOT, 'tools'))
import numpy as np
from scipy import signal
import sound_studio as ss
import kiai_voice as kv

args = sys.argv[1:]
wav_only = args[0] == '--wav'
video, out = (None, args[1]) if wav_only else (args[0], args[1])
DUR = 152.0 if wav_only else ss.probe_duration(video)
SR = ss.SR; N = ss.secs(DUR)
TARGET_LUFS = -14.0

# ---- 映像と同じ時間割（kiai/src/core.js と同じ数字）
P = lambda i: 10.0 + 4.0 * i
Q = lambda i: 77.01 + 4.0 * i
T = dict(flash1=8.0, inside=P(1), dna1=P(3), decide=P(4), kiai1=P(5), hold=P(6), kiai1b=P(10), cells1=P(11), lull=P(12), flash2=P(13), vomit=67.0, shatter=71.0,
         dark=75.4, kiai2=Q(0), soulCells=Q(2), soulDna=Q(4), tug=Q(5), bullets=Q(6), walk=Q(8), last=Q(10), spk=Q(11), stop=Q(12), dawn=130.0, epi=137.6, title=143.6)
STAGE = [(0, T['inside']), (T['decide'], T['hold']), (T['kiai1b'], T['cells1']), (T['lull'], T['shatter']), (T['dark'], T['soulCells']), (T['bullets'], DUR + 1)]
in_stage = lambda t: any(a <= t < b for a, b in STAGE)
hash1 = lambda n: (lambda s: s - math.floor(s))(math.sin(n * 127.1 + 311.7) * 43758.5453)
rng = np.random.default_rng(20261124)

def bus(): return np.zeros((N, 2))
def put(dst, y, t, gain_db=0.0, pan=0.0):
    y = ss.to_st(np.asarray(y, float), pan); i = int(round(t * SR))
    if i < 0: y, i = y[-i:], 0
    j = min(N, i + len(y))
    if j > i: dst[i:j] += y[:j - i] * ss.dbg(gain_db)
def fade(y, fin=0.0, fout=0.0):
    y = np.array(y, float)
    if fin > 0: k = min(len(y), ss.secs(fin)); y[:k] *= (np.linspace(0, 1, k) ** 1.5)[:, None]
    if fout > 0: k = min(len(y), ss.secs(fout)); y[-k:] *= (np.linspace(1, 0, k) ** 1.5)[:, None]
    return y
def window(t0, t1, fin=0.3, fout=0.3):
    """t0〜t1 で 1 になる包絡（全体の長さ N）"""
    t = np.arange(N) / SR
    return (np.clip((t - t0) / max(fin, 1e-3), 0, 1) * np.clip((t1 - t) / max(fout, 1e-3), 0, 1))[:, None]
def norm(y, lufs_m): l = ss.lufs(y, True); return y * ss.dbg(lufs_m - l) if l > -70 else y

music, voice, sfx, amb = bus(), bus(), bus(), bus()

# ------------------------------------------------------------ 音楽
rool = ss.read_audio(ss.lib_path('freepd:Rulers of Our Lands'))
seg1 = fade(rool[ss.secs(28.05):ss.secs(80.33)], 2.6, 0.28)           # 0:10 → 1:02（二度目の閃光の一撃で切る）
put(music, seg1, 10.0, +3.0)
seg2 = fade(rool[ss.secs(82.85):], 0.7, 0.0)                           # 1:15.8 →（曲の 84.04 秒が 1:17.01）
put(music, seg2, 82.85 - 7.03, -2.0)
# 夜明け: "Infinite Peace"（Kevin MacLeod）。低く伸びる音の上に、木琴のような音がぽつぽつ鳴る
peace = ss.read_audio(ss.lib_path('freepd:Infinite Peace'))
put(music, fade(peace[ss.secs(0.6):ss.secs(0.6 + 13.4)], 1.6, 2.2), 130.2, +9.0)

# ------------------------------------------------------------ 声
def say(y, t, gain_db=0.0, room=1.6, wet=0.22, lufs_m=-9.5, lp=None):
    y = kv.finish(y, ss, room, wet)
    if lp: y = ss.filt(y, 'lp', lp, 2)
    put(voice, norm(y, lufs_m), t, gain_db)
say(kv.guaa(0.95, seed=5), 8.22, -3)
say(kv.uooo(3.7, seed=3, peak=318, power=0.8), 30.0, -1)
say(kv.uooo(3.5, seed=8, peak=342, power=1.0), 50.0, 0)
say(kv.guaa(2.2, seed=9), 63.0, -1, room=2.2, wet=0.3)
say(kv.madada(), 76.1, -6, room=2.0, wet=0.3, lufs_m=-14)
for i in range(10):
    inner = 2 <= i <= 5                                                   # 身体の中の場面では、こもって聞こえる
    y = kv.kiaida(3.4 if i == 9 else 3.3, seed=20 + i * 3, peak=328 + 8 * i, power=0.8 + 0.06 * i, n=5 if i >= 6 else 3)
    say(y, Q(i) - 0.52, (-4.5 if inner else 0.5 * min(i, 4) - 1.0), room=2.4 if inner else 1.7, wet=0.5 if inner else 0.22, lp=1500 if inner else None)
say(kv.kiaida(8.3, seed=77, peak=405, power=1.5, n=5, last=True), Q(10) - 0.52, +1.5, room=2.0, wet=0.26)
say(kv.whisper_kiai(), 141.9, 0, room=1.2, wet=0.15, lufs_m=-27)

# ------------------------------------------------------------ 効果音（SFX Kit）
_kit = {}
def kit(sid, t, gain_db=0.0, rate=1.0, pan=0.0, dst=None, lufs_m=-16.0):
    key = (sid, round(rate, 3))
    if key not in _kit:
        y, s, r = ss.kit_sound(sid, rate); _kit[key] = (norm(y, lufs_m), s['sync']['at'] / r)
    y, sync = _kit[key]
    put(sfx if dst is None else dst, y, t - sync, gain_db, pan)

# いつもの点検（紙をめくる音、ペンの音）
kit('props-page-turn', 2.4, -7); kit('click-latch-soft', 4.5, -8); kit('props-page-turn', 6.3, -8)
# 一度目の閃光
for sid, g in [('cinematic-thunder-big', -1), ('boom-hit-strong', 0), ('bass-sub-drop-medium', -2)]: kit(sid, T['flash1'], g)
# 警報（舞台の場面だけ。気合いが始まってからは遠くで鳴る）
breach, _, _ = ss.kit_sound('digital-breach'); breach = ss.wet(norm(breach, -16), 1.4, 0.5, 0.35)
t = 8.7
while t < T['stop'] + 0.2:
    if in_stage(t) and in_stage(t + 0.9) and not (61.0 < t < 64.5): put(sfx, breach, t, -13 if t < 30 else -21, 0.25)
    t += 1.45
# 身体の中へ・外へ（場面の切り替え）
for tc in [T['inside'], T['dna1'], T['hold'], T['cells1'], T['soulCells'], T['soulDna'], T['tug']]: kit('whoosh-fast-medium', tc, -7); kit('boom-hit-soft', tc, -8)
for tc in [T['decide'], T['lull'], T['bullets']]: kit('boom-hit-soft', tc, -7)
# DNA が切れる（最初の被曝）
for tc in [22.5, 23.4, 24.5, 25.2]: kit('impact-medium-hard', tc, -6); kit('digital-glitch-clear', tc + 0.02, -10)
# 決意 → 最初の絶叫
kit('shimmer-short-bright', 28.7, -9); kit('riser-1s-strong', T['kiai1'], -6)
kit('cinematic-drum-big', T['kiai1'], -1); kit('whoosh-fast-hard', T['kiai1'], -6)
kit('shimmer-medium-bright', 34.2, -10)
# 中性子が当たる（細かい音は乱数、要所は映像と同じ時刻）
t = 35.6
while t < 49.6:
    kit(['click-tap-firm', 'data-tick', 'click-tap-medium'][int(rng.integers(3))], t, -15 + 3 * rng.random(), rate=0.9 + 0.3 * rng.random(), pan=rng.uniform(-0.6, 0.6))
    t += (0.42 if t < 38 else 0.2 if t < 46 else 0.13) * (0.6 + 0.8 * rng.random())
kit('impact-deep-hard', P(7), -3); kit('cinematic-drum-big', P(8), -2); kit('impact-deep-hard', P(8), -4)                # 耐える・耐える
kit('cinematic-metal-big', 46.0, -3); kit('digital-glitch-clear', 46.02, -8); kit('shimmer-short-sparkle', 48.85, -8); kit('notification-success-sparkle', 48.9, -14)
kit('riser-2s-strong', T['kiai1b'], -7); kit('cinematic-drum-big', T['kiai1b'], -1)
# 二度目の閃光
kit('reverse-whoosh-long-soft', T['flash2'], -6)
for sid, g in [('cinematic-slam-massive', +2), ('cinematic-thunder-massive', 0), ('boom-drop-strong', 0), ('bass-sub-drop-long', -2)]: kit(sid, T['flash2'], g)
# 血が噴き出す・吐く
for r_, g in [(0.85, -3), (1.0, -4), (1.15, -6)]: kit('props-splash', 63.0 + 0.03 * r_, g, rate=r_, pan=(r_ - 1) * 2)
kit('impact-heavy-soft', 63.0, -4)
t = 63.5
while t < 70.5: kit('props-splash', t, -12 + 2 * rng.random(), rate=0.85 + 0.3 * rng.random(), pan=rng.uniform(-0.5, 0.5)); t += 0.38 + 0.2 * rng.random()
for k in range(5): kit('transform-empty', 67.15 + 0.62 * k, -5, rate=0.85 + 0.06 * k)
kit('props-splash', 67.2, -3, rate=0.85)
# 心臓の音（音楽のない場面の拍。だんだん遅く、弱く）
for k, tb in enumerate([64.6, 65.6, 66.6, 67.7, 68.8, 69.9, 71.1, 72.4, 73.8, 75.5]):
    kit('impact-deep-soft', tb, -7 - 0.9 * k, rate=0.9); kit('impact-deep-soft', tb + 0.24, -11 - 0.9 * k, rate=0.85)
kit('cinematic-drum-big', 71.12, -2); kit('digital-corrupt', 71.14, -9); kit('shimmer-short-bright', 71.2, -12)                # 細胞が砕ける
kit('cinematic-metal-big', 73.32, -4); kit('digital-signal-drop', 73.34, -10)                                                    # 遺伝子がちぎれる
kit('bass-rumble-long', 75.5, -8)
kit('shimmer-short-soft', 76.05, -9)                                                                                                # 魂の火
# 「気合いだ」（一発ごとに）
kit('cinematic-drum-massive', Q(0), +1); kit('boom-hit-strong', Q(0), -2)
for i in range(1, 11): kit('impact-deep-hard' if i % 2 else 'cinematic-drum-big', Q(i), -7 if 2 <= i <= 5 else -4); kit('whoosh-fast-hard', Q(i), -9)
# 魂が細胞を呼び戻す
kit('shimmer-long-sparkle', 85.2, -9); kit('shimmer-long-bright', 85.3, -12)
for ci in range(9): kit('shimmer-short-sparkle', 89.05 + hash1(ci * 6.1) * 1.3 + 1.37, -10, rate=0.9 + 0.03 * ci, pan=(ci % 3 - 1) * 0.5); kit('impact-light-soft', 89.05 + hash1(ci * 6.1) * 1.3 + 1.37, -12)
for g_ in range(16): kit('click-latch-firm', 93.45 + (g_ / 16) * 2.1 + 0.42, -8, rate=0.9 + 0.016 * g_, pan=-0.6 + 1.2 * g_ / 15)   # 遺伝子がつながっていく
kit('sting-bright-short', 96.3, -10)
for k in range(4): kit('impact-medium-hard', 97.05 + k, -8); kit('shimmer-short-sparkle', 97.05 + k + 0.76, -11)                 # 壊される・直す
# 弾丸のような吐瀉物（映像と同じ発射時刻）
shots = []
for a, b in [(101.45, 103.5), (104.3, 106.4), (107.0, 108.7)]:
    s_ = a
    while s_ < b: shots.append(s_ + 0.03 * hash1(s_ * 7.7)); s_ += 0.085
for k, ts in enumerate(shots):
    kit('impact-light-hard', ts, -9 + 2 * rng.random(), rate=0.92 + 0.18 * rng.random(), pan=-0.2)
    if k % 3 == 0: kit('props-splash', ts + 0.24, -15, rate=1.15, pan=0.6)
    if k % 4 == 1: kit('impact-medium-hard', ts + 0.24, -15, pan=0.6)
# 一歩、また一歩
for k in range(8): kit('impact-heavy-firm', T['walk'] + k + 0.7, -2, rate=0.92); kit('boom-hit-soft', T['walk'] + k + 0.7, -9)
kit('mechanical-latch-heavy', 116.95, -4)
for tc in [118.6, 119.9, 120.7]: kit('mechanical-ratchet-heavy', tc, -10, rate=0.9)
# 止まる
for sid, g in [('cinematic-slam-massive', +3), ('cinematic-metal-massive', +1), ('boom-drop-strong', 0)]: kit(sid, T['stop'], g)
kit('faller-4s-soft', T['stop'] + 0.3, -10)
for tc in [127.3, 128.6, 131.4]: kit('props-drip', tc, -15)
# 後日談・題
kit('whoosh-slow-soft', 137.9, -14); kit('whoosh-slow-soft', 140.8, -14)
kit('cinematic-drum-massive', T['title'] + 0.25, -1); kit('sting-bold-short', T['title'] + 0.25, -6)

# ------------------------------------------------------------ 環境音
clicks = []
for sid in ['click-tap-firm', 'click-tap-medium', 'data-tick', 'click-button-firm']:
    y, _, _ = ss.kit_sound(sid); clicks.append(y / (np.abs(y).max() + 1e-9))
def crackle(t0, t1, rate, amp):
    """線量計の音: 1 回 = 1 カウント。rate は 1 秒あたりの回数（関数でも可）"""
    t = t0
    while t < t1:
        r = rate(t) if callable(rate) else rate
        t += rng.exponential(1.0 / max(r, 0.05))
        if t < t1: put(amb, clicks[int(rng.integers(len(clicks)))], t, 20 * math.log10(amp * (0.5 + 0.5 * rng.random())), rng.uniform(-0.7, 0.7))
crackle(0.5, T['flash1'], 1.7, 0.11)
for a, b in STAGE:
    a2, b2 = max(a, T['flash1']), min(b, T['stop'])
    if b2 > a2: crackle(a2, b2, lambda t: 70 if t < T['flash2'] else 260 * math.exp(-(t - T['flash2']) / 2.5) + 130, 0.045)
# 部屋の空気
wind = ss.read_audio(ss.lib_path('amb:wind')); wind = ss.fit(wind, N, 2.0)
room = ss.filt(wind, 'lp', 420, 2); room /= np.abs(room).max() + 1e-9
amb += room * 0.11 * window(0, T['flash1'], 0.8, 0.1) + room * 0.07 * window(T['stop'] + 0.5, T['dawn'], 1.0, 0.5)
# 身体の中: 低い水の響き
stream = ss.read_audio(ss.lib_path('amb:stream')); stream = ss.fit(stream, N, 2.0)
deep = ss.filt(stream, 'lp', 230, 4); deep /= np.abs(deep).max() + 1e-9
for a, b in [(T['inside'], T['decide']), (T['hold'], T['kiai1b']), (T['cells1'], T['lull']), (T['shatter'], T['dark']), (T['soulCells'], T['bullets'])]: amb += deep * 0.2 * window(a, b, 0.15, 0.15)
# 吐血: 水の流れる音
pour = ss.filt(stream, 'hp', 350, 2); pour /= np.abs(pour).max() + 1e-9
amb += pour * 0.5 * window(67.15, 70.4, 0.12, 0.4)
# 気合いのオーラ: 炎と風のうなり
fire = ss.read_audio(ss.lib_path('amb:fireplace')); fire = ss.fit(fire, N, 2.0); fire /= np.abs(fire).max() + 1e-9
roar = ss.filt(ss.filt(wind, 'hp', 90, 2), 'lp', 1400, 2); roar /= np.abs(roar).max() + 1e-9
aura = np.zeros((N, 1))
for a, b, g in [(29.95, 34.0, 1.0), (50.0, 54.0, 1.0), (58.0, 62.0, 0.5), (76.95, 85.0, 1.0), (101.0, T['stop'], 1.0)]: aura += g * window(a, b, 0.25, 0.25)
amb += (fire * 0.32 + roar * 0.3) * aura
# 夜明けの鳥
birds = ss.read_audio(ss.lib_path('amb:birds')); birds = ss.fit(birds, N, 2.0); birds /= np.abs(birds).max() + 1e-9
amb += birds * 0.42 * window(129.6, DUR - 0.2, 2.5, 1.6)

# ------------------------------------------------------------ 混ぜる
mix = music + voice + sfx + amb
# スピーカーが壊れる（2:01 → 2:05）。歪み、ぶつぶつ途切れ、音が消える。和音の一撃で戻る
i0, i1 = ss.secs(T['spk'] - 0.1), ss.secs(T['stop'] - 0.03)
seg = mix[i0:i1].copy()
seg = kv.speaker_break(seg / (np.abs(seg).max() + 1e-9), 0.25, 1.75, fs=SR) * np.abs(mix[i0:i1]).max() * 0.9
k = ss.secs(0.03); seg[:k] = mix[i0:i0 + k] * np.linspace(1, 0, k)[:, None] + seg[:k] * np.linspace(0, 1, k)[:, None]
mix[i0:i1] = seg
post = bus()
for sid, tc, g in [('digital-interference', 121.25, -8), ('digital-static', 121.8, -9), ('digital-corrupt', 122.2, -9), ('digital-signal-drop', 122.55, -6)]: kit(sid, tc, g, dst=post)
for tc in [123.5, 124.2, 124.7]: kit('click-tap-soft', tc, -22, dst=post)
mix += post

y = ss.master(mix, TARGET_LUFS, -1.0)
print(f'buses (LUFS): music {ss.lufs(music):.1f}  voice {ss.lufs(voice):.1f}  sfx {ss.lufs(sfx):.1f}  amb {ss.lufs(amb):.1f}  →  mix {ss.lufs(y):.1f}, peak {20 * np.log10(np.abs(y).max()):.1f} dBFS')
WAV = out if wav_only else os.path.join(WORK, 'mix.wav')
ss.write_audio(WAV, y)
if not wav_only:
    tmp = out[:-4] + '.part.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', WAV, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', tmp], check=True)
    os.replace(tmp, out)
    print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
