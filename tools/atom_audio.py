#!/usr/bin/env python3
"""tools/atom_audio.py — 「見えない火」に音を付ける。

  python3 tools/atom_audio.py build/atom/silent.mp4 invisible-fire.master.mp4

音はすべて CC0（パブリックドメイン）の素材:
  音楽   "Night Vigil" Kevin MacLeod（FreePD）… 映像はこの曲の和音の替わり目に合わせて組んである。
           地震の瞬間（曲の 110.1 秒、息を継ぐところ）で止め、爆発のあと同じ場所から再開する。
         "Hidden Truth" Rafael Krux（FreePD）… 事故の章。8.73 秒ごとの低い打音が、事故の一段ずつにあたる。
  効果音 SFX Kit by Wyzowl
  環境音 Blanket の stream（低い音だけ残して水の底の響きに）と wind
放射線の「カチ、カチ」は、SFX Kit の短いクリック音を乱数の間隔で並べたもの（1 回 = 1 つのできごと。
連鎖反応では核分裂の数、線量の梯子では線量の大きさに合わせて密になる）。
混ぜる処理は video-making-custom-sound スキルの sound_studio.py に任せる（-16 LUFS にそろう）。
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'build', 'atom', 'audio')
os.makedirs(WORK, exist_ok=True)

# ---- sound_studio.py を用意する（スキルの SKILL.md から取り出す）
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

video, out = sys.argv[1], sys.argv[2]
DUR = ss.probe_duration(video)
SR = ss.SR
N = ss.secs(DUR)

# ---- 映像と同じ時間割（atom/src/core.js と同じ数字）
NV_CUT = 110.1                         # Night Vigil を止める／再開する位置（曲の中の秒）
NV2 = 77.9                             # 再開後: 曲の秒 + NV2 = 映像の秒
HT_HIT = 18.18                         # Hidden Truth の、地震にあてる打音の位置
Q = [110.10, 118.80, 127.55, 136.27, 145.00, 153.71, 162.46, 171.17, 179.90]
nv = lambda s: s + NV2
T = dict(title=10.99, nucleus=19.84, split=28.42, chain=38.25, grow=47.71, control=57.45, s2end=74.45, fuel=74.95, plant=88.27,
         principle=101.15, resume=nv(110.1), evac=nv(125.84), worst=nv(135.41), invisible=nv(146.0), dna=nv(150.0), ladder=nv(172.07),
         ladderEnd=nv(209.3), people=nv(210.4), resident=nv(216.96), thyroid=nv(222.48), evacDeath=nv(233.98), mind=nv(247.0),
         cancer=nv(259.90), time=nv(271.16), closing=nv(283.0), endcard=368.6)
TIER = [nv(172.07), nv(177.5), nv(183.10), nv(188.5), nv(195.19), nv(200.7), nv(204.7)]
T_BLACK = Q[2] + 3.6

def fade(y, fin=0.0, fout=0.0):
    y = y.copy()
    if fin > 0: k = min(len(y), ss.secs(fin)); y[:k] *= np.linspace(0, 1, k)[:, None] ** 1.5
    if fout > 0: k = min(len(y), ss.secs(fout)); y[-k:] *= np.linspace(1, 0, k)[:, None] ** 1.5
    return y
def put(dst, y, t, gain=1.0):
    i = ss.secs(t)
    if i < 0: y = y[-i:]; i = 0
    y = y[:max(0, len(dst) - i)]
    dst[i:i + len(y)] += y * gain

# ================= 音楽: 2 曲を、映像の時間割どおりに並べる
nvig = ss.read_audio(ss.lib_path('freepd:Night Vigil'))
hid = ss.read_audio(ss.lib_path('music:hidden-truth'))
l_nv, l_ht = ss.lufs(nvig), ss.lufs(hid)
print(f'Night Vigil {len(nvig) / SR:.1f}s {l_nv:.1f} LUFS / Hidden Truth {len(hid) / SR:.1f}s {l_ht:.1f} LUFS')
g_nv = ss.dbg(-17.0 - l_nv); g_ht = ss.dbg(-18.5 - l_ht)
# Night Vigil は静かな独奏の部分（曲の 210〜247 秒）がとても小さい。小さな画面のスピーカーでも聞こえるよう、そこだけ持ち上げる
RIDE = [(0, 2.0), (36, 2.0), (39, 0.0), (209.0, 0.0), (210.6, 8.0), (246.4, 8.0), (247.6, 3.0), (300, 3.0)]
env = np.interp(np.arange(len(nvig)) / SR, [k[0] for k in RIDE], [k[1] for k in RIDE])
nvig = nvig * (10 ** (env / 20))[:, None]
music = np.zeros((N, 2))
put(music, fade(nvig[:ss.secs(NV_CUT)], 0, 0.30), 0.0, g_nv)                                       # 第 1 幕
put(music, fade(hid[ss.secs(HT_HIT - 0.03):], 0.012, 0), Q[0] - 0.03, g_ht)                         # 事故
put(music, fade(nvig[ss.secs(NV_CUT):], 0.35, 0), T['resume'], g_nv)                               # 第 3 幕
# 結び: 曲の冒頭の和音が、もう一度だけ戻ってくる（はじめの水の底の場面と同じ響きで終わる）
CODA = T['closing'] - 2.1
put(music, fade(nvig[:ss.secs(DUR - CODA)], 0, 6.0), CODA, g_nv)

# ================= 放射線の「カチ」: SFX Kit の短いクリックを、ポアソン過程で並べる
rng = np.random.default_rng(20110311)
CLICK = []
for sid in ('click-tap-firm', 'click-tap-medium', 'data-tick', 'click-button-firm'):
    y, _, _ = ss.kit_sound(sid); y = y / (np.abs(y).max() + 1e-9)
    for rate in (0.94, 1.0, 1.07):
        CLICK.append(np.stack([np.interp(np.arange(0, len(y) - 1, rate), np.arange(len(y)), y[:, c]) for c in range(2)], 1))
ticks = np.zeros((N, 2))
def crackle(t0, t1, rate, amp, pan=0.5):
    """t0〜t1 のあいだ、毎秒 rate(t) 回の頻度でクリックを置く。rate と amp は数か t の関数"""
    rf = rate if callable(rate) else (lambda t: rate); af = amp if callable(amp) else (lambda t: amp)
    t = t0
    while True:
        r = max(rf(t), 1e-3); t += rng.exponential(1.0 / r) if r > 0.02 else 0.5
        if t >= t1: break
        if rf(t) <= 0.02: continue
        y = CLICK[rng.integers(len(CLICK))]; a = af(t) * rng.uniform(0.55, 1.0); p = np.clip(pan + rng.uniform(-0.35, 0.35), 0, 1)
        i = ss.secs(t)
        if i + len(y) < N: ticks[i:i + len(y), 0] += y[:, 0] * a * (1 - p) * 1.4; ticks[i:i + len(y), 1] += y[:, 1] * a * p * 1.4
lerp = lambda a, b, u: a + (b - a) * min(1, max(0, u))
crackle(0.6, T['nucleus'] - 1.5, 0.75, 0.035)                                                       # 序: 暗がりの中の、まばらな音
GEN = [40.6, 43.0, 45.0, 46.8, 48.4, 49.8, 51.0]
def chain_rate(t):                                                                                  # 連鎖: 核分裂の数だけ鳴る
    if t < GEN[0]: return 0
    for i in range(len(GEN) - 1):
        if t < GEN[i + 1]: return (2 ** i) / (GEN[i + 1] - GEN[i]) * 1.2
    if t < T['control'] + 0.6: return lerp(55, 80, (t - 51) / 6)
    return lerp(80, 16, (t - T['control'] - 0.6) / 4.6)
crackle(GEN[0] - 0.02, T['s2end'], chain_rate, lambda t: lerp(0.10, 0.055, (t - 46) / 8) * (1 - 0.6 * max(0, min(1, (t - 73.2) / 1.2))))
crackle(Q[5], Q[8], lambda t: lerp(1.5, 11, (t - Q[5]) / (Q[8] - Q[5])), 0.05)                      # 炉心溶融から爆発まで
crackle(Q[8] + 0.6, T['resume'] + 3, lambda t: lerp(26, 12, (t - Q[8]) / 8), lambda t: lerp(0.11, 0.07, (t - Q[8]) / 8))   # 爆発のあとの静けさに
crackle(T['resume'] + 3, T['worst'], lambda t: 9 + 9 * np.sin((t - T['resume']) * 0.5) ** 2, 0.042)  # 拡散
crackle(T['worst'], T['invisible'], lambda t: lerp(8, 3, (t - T['worst']) / 9), 0.04)
crackle(T['invisible'] + 0.2, T['dna'] + 0.5, 3.2, 0.10)                                             # 「音もない」: 測る道具だけが鳴っている
crackle(T['dna'] + 0.5, T['ladder'], 1.4, 0.04)
DOSE_RATE = [38, 34, 22, 14, 7, 2.6, 0.7]                                                           # 線量の梯子: 線量が大きいほど密に
for i, r in enumerate(DOSE_RATE):
    t1 = TIER[i + 1] if i + 1 < len(TIER) else T['ladderEnd']
    crackle(TIER[i] + 0.25, t1, (lambda r_: (lambda t: r_))(r), 0.060 if i < 5 else 0.07)
crackle(T['people'], T['time'], 0.8, 0.035)
crackle(T['time'], T['closing'], lambda t: 9 * 0.5 ** ((t - T['time'] - 1.0) / 1.6), 0.05)          # 時間: 半分、また半分
crackle(T['closing'], DUR - 3.5, 0.55, 0.045)

# ================= 環境音: 水の底の響きと、風
bed = np.zeros((N, 2))
stream = ss.filt(ss.read_audio(ss.lib_path('amb:stream')), 'lp', 230, 4); stream = stream / (np.abs(stream).max() + 1e-9)
wind = ss.read_audio(ss.lib_path('amb:wind')); wind = ss.fit(wind, ss.secs(60), 2.0); wind = ss.filt(ss.filt(wind, 'hp', 130, 2), 'lp', 2600, 2); wind = wind / (np.abs(wind).max() + 1e-9)
put(bed, fade(stream[:ss.secs(21.5)], 2.5, 3.0), 0.0, 0.50)
put(bed, fade(stream[ss.secs(30):ss.secs(30 + DUR - T['closing'] + 0.5)], 3.0, 3.5), T['closing'] - 0.5, 0.42)
put(bed, fade(wind[:ss.secs(12.5)], 1.2, 4.0), Q[8] + 0.9, 0.16)
put(bed, fade(wind[ss.secs(14):ss.secs(14 + T['invisible'] - T['resume'] - 2)], 4.0, 4.0), T['resume'] + 1, 0.05)
put(bed, fade(wind[ss.secs(4):ss.secs(4 + 15.5)], 3.0, 4.0), T['evacDeath'] - 0.5, 0.07)

BED = os.path.join(WORK, 'bed.wav')
mix = music + ticks + bed
ss.write_audio(BED, mix / max(1.0, np.abs(mix).max() / 0.98))
print(f'bed: music {ss.lufs(music):.1f} LUFS, ticks peak {np.abs(ticks).max():.2f}, ambience peak {np.abs(bed).max():.2f}')

# ================= 効果音
cues = []
def cue(sfx, t, gain=0.0, **kw): cues.append(dict(sfx=sfx, t=round(t, 3), gain=gain, **kw))
# 序・分裂
cue('kit:bass-sub-drop-long', 0.7, -9)
cue('kit:shimmer-long-soft', T['title'] + 0.25, -10)
cue('kit:riser-2s-soft', T['nucleus'], -9); cue('kit:whoosh-medium-soft', T['nucleus'] + 0.05, -9)
cue('kit:whoosh-slow-soft', 26.2, -12)                                                              # 中性子が近づく
cue('kit:pop-large-in', 27.25, -6)                                                                  # 吸いこまれる
cue('kit:riser-1s-soft', T['split'], -7)                                                            # ふるえて、のびて
cue('kit:boom-hit-medium', T['split'], -2); cue('kit:shimmer-short-bright', T['split'] + 0.05, -9); cue('kit:whoosh-fast-soft', T['split'] + 0.12, -8)
# 連鎖
cue('kit:whoosh-medium-soft', T['chain'] + 0.2, -11)
cue('kit:riser-4s-strong', T['control'] + 0.3, -8)                                                  # 暴走の高まり
cue('kit:mechanical-slider-heavy', T['control'] + 0.7, -5); cue('kit:faller-2s-soft', T['control'] + 1.0, -9); cue('kit:mechanical-lock-heavy', T['control'] + 3.0, -7)
# 発電
for t in (79.5, 82.6, 85.8, 89.6): cue('kit:whoosh-slow-soft', t, -11)                              # 引いていく
cue('kit:digital-power-up', 90.6, -13)
for t in (104.6, 106.3, 108.1): cue('kit:click-toggle-on-firm', t, -4)
# 事故
cue('kit:bass-rumble-long', Q[0], 1); cue('kit:cinematic-thunder-big', Q[0] + 0.1, -7); cue('kit:bass-rumble-long', Q[0] + 1.9, -3)
cue('kit:digital-power-down', Q[0] + 0.35, -8)
cue('kit:mechanical-slider-heavy', Q[0] + 0.9, -4); cue('kit:mechanical-lock-heavy', Q[0] + 2.2, -4); cue('kit:click-toggle-on-firm', Q[0] + 2.6, -4)
cue('kit:bass-rumble-long', Q[2] + 0.5, -2); cue('kit:whoosh-slow-hard', Q[2] + 2.3, -2); cue('kit:props-splash', Q[2] + 2.45, -6)
cue('kit:bass-sub-drop-long', Q[2] + 2.4, -4); cue('kit:whoosh-slow-medium', Q[2] + 3.4, -6)
cue('kit:digital-power-down', T_BLACK, -1); cue('kit:click-toggle-off-firm', T_BLACK + 0.4, -3)
t = Q[3] + 0.8
while t < Q[5]:                                                                                     # 沸きつづける水
    cue('kit:pop-small-bubble' if rng.random() < 0.7 else 'kit:pop-medium-bubble', t, float(rng.uniform(-17, -12))); t += float(rng.exponential(0.42)) + 0.08
cue('kit:bass-sub-drop-long', Q[5], -4); cue('kit:props-drip', Q[5] + 3.3, -11); cue('kit:props-drip', Q[5] + 6.1, -11)
cue('kit:impact-deep-hard', Q[6] + 0.3, -4); cue('kit:bass-sub-drop-medium', Q[6] + 0.45, -7)
cue('kit:riser-4s-soft', Q[8], -5)
cue('kit:cinematic-slam-massive', Q[8], 2); cue('kit:cinematic-thunder-massive', Q[8] + 0.05, -1); cue('kit:boom-drop-strong', Q[8] + 0.1, -2)
cue('kit:bass-rumble-long', Q[8] + 0.5, -2); cue('kit:cinematic-metal-big', Q[8] + 0.9, -9); cue('kit:click-toggle-off-firm', Q[8] + 0.3, -3)
# 拡散
for i in range(4): cue('kit:click-rocker-soft', T['evac'] + 0.35 + i * 0.6, -7)
cue('kit:whoosh-slow-soft', T['worst'] + 1.4, -9); cue('kit:impact-deep-soft', T['worst'] + 5.7, -5)
# 身体
for tt in (234.2, 239.6, 240.3, 240.9, 241.5, 242.3, 242.9, 243.6): cue('kit:zip-in-soft', tt, -11)
cue('kit:click-snap-soft', 234.2, -6); cue('kit:shimmer-short-soft', 236.6, -10); cue('kit:click-snap-firm', 240.3, -3); cue('kit:click-snap-firm', 242.3, -4)
for i, (s, gdb) in enumerate([('kit:boom-hit-medium', -3), ('kit:impact-deep-firm', -5), ('kit:impact-deep-firm', -6), ('kit:impact-deep-soft', -6), ('kit:impact-deep-soft', -9), ('kit:impact-light-soft', -7), ('kit:shimmer-short-soft', -12)]):
    cue(s, TIER[i] + 0.05, gdb)
# 人々
cue('kit:shimmer-short-soft', T['resident'] + 0.6, -12)
for i in range(4): cue('kit:pop-small-in', T['thyroid'] + 0.45 + i * 0.45, -9)
cue('kit:whoosh-slow-soft', T['evacDeath'] + 0.6, -12)
cue('kit:shimmer-long-soft', T['closing'] + 1.3, -12)

CUES = os.path.join(WORK, 'cues.json'); json.dump(cues, open(CUES, 'w'), ensure_ascii=False, indent=1)
print(f'{len(cues)} cues, video {DUR:.2f}s')
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
subprocess.run([sys.executable, STUDIO, 'mix', '--video', video, '--bgm', BED, '--cues', CUES, '-o', out], check=True)
print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
