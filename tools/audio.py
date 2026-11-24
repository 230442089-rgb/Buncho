#!/usr/bin/env python3
"""tools/audio.py — 無音の映像に、音楽・環境音・効果音を付ける。

  python3 tools/audio.py build/silent.mp4 out/kotoba-wa-sekai-ni-naru.mp4

音はすべて CC0（パブリックドメイン）の素材:
  音楽   "Inventing Flight" Bryan Teoh（FreePD）… 映像はこの曲の小節（72.5 BPM）に合わせて組んである
  効果音 SFX Kit by Wyzowl（打鍵・紙・風・きらめき など）
  鳥の声 Blanket の環境音 birds（朝の場面に薄く敷き、さえずりを切り出して文鳥の歌にする）
混ぜる処理は video-making-custom-sound スキルの sound_studio.py に任せる（-16 LUFS にそろう）。
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'build', 'audio')
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

# ---- 映像と同じ時間のものさし（film/src/core.js と同じ）
BEAT = 60 / 72.5; BAR = BEAT * 4; T0 = 0.034
bar = lambda n: T0 + n * BAR
cues = []
def cue(sfx, t, gain=0.0, **kw): cues.append(dict(sfx=sfx, t=round(t, 4), gain=gain, **kw))

# ---- 序章: 1 打ごとにキーの音（かな = 文字キー、変換 = スペース、確定 = リターン）
P1 = [('いまの', '今の'), ('あなたの', 'あなたの'), ('じつりょくを', '実力を'), ('ふるに', 'フルに'), ('しめす、', '示す、'), ('あにめーしょん', 'アニメーション'), ('びでおを', 'ビデオを'), ('つくって', '作って')]
# かなを 1 打ずつ、文節の終わりに「変換」の 1 打（prologue.js の台本と同じ刻み）
k = 10
for i, (kana, conv) in enumerate(P1):
    for j, _ in enumerate(kana):
        cue('kit:keyboard-letter-' + ('medium' if (k % 3) else 'firm'), T0 + k * BEAT / 8, -3 if (k % 3) else -5); k += 1
    cue('kit:keyboard-space-medium', T0 + k * BEAT / 8, -4); k += 1
    if i == 4: k += 2
cue('kit:keyboard-return-soft', T0 + k * BEAT / 8, -5)
cue('kit:keyboard-return-firm', bar(2), -1)                      # Enter（ここで曲のベースが入る）
cue('kit:reverse-whoosh-long-soft', bar(2) + 2 * BEAT, -2)        # 文字の粒が一点に吸い込まれる

# ---- 線
cue('kit:swish-medium', bar(3) + 0.10, -4)                        # 点が走って線になる
cue('kit:writing-pen-draw', bar(4) + 0.50, -6); cue('kit:writing-pencil-draw', bar(4) + 1.55, -7)   # 一筆書き
cue('kit:shimmer-short-soft', bar(4) + 2.72, -6)                  # くちばしに朱が入る
cue('kit:whoosh-slow-soft', bar(5) + 0.45, -4)                    # 糸がほどける
cue('kit:reverse-whoosh-short-soft', bar(6) - 0.04, -5)           # 糸がぴんと張る
# ---- 面（紙がひらき、重なる）
cue('kit:whoosh-medium-soft', bar(6) + 0.16, -4)
for b in (7, 8, 9): cue('kit:foley-paper-slide', bar(b) + 0.02, -1)
# ---- 立体・時間（曲の山に向けて、息を吸うような上昇音を薄く）
cue('kit:riser-2s-soft', bar(10), -3)
cue('kit:riser-2s-soft', bar(18), -4); cue('kit:shimmer-long-sparkle', bar(18) + 0.08, -5)     # 日の出
cue('kit:riser-1s-strong', bar(22), -6)
cue('kit:riser-2s-strong', bar(26), -4); cue('kit:shimmer-long-soft', bar(26) + 0.06, -4)       # 流体が吸い込まれて、朝へ
# ---- 生命
cue('kit:transform-grow', bar(28) + 0.55, -6)                    # 枝がのびる
LAND = bar(30)
cue('kit:foley-fabric-slide', LAND - 0.42, -9)                    # 羽ばたき
cue('kit:pop-large-out', LAND, -5)                                # 着地
cue('kit:foley-fabric-slide', LAND + 0.80, -11)                   # 身ぶるい
for t in (bar(31) + 0.20, bar(31) + BEAT + 0.19, bar(32) + 0.18): cue('kit:pop-small-out', t, -8)   # ホップの着地
# ---- 言葉
SING = bar(34); ASM = SING + 12 * BEAT; OFF = bar(38) + 2 * BEAT
cue('kit:shimmer-medium-soft', ASM + 1.25, -7)                    # 文字が題に集まる
cue('kit:foley-wood-touch', ASM + 2.05, -4)                       # 落款を押す
cue('kit:foley-fabric-slide', OFF + 0.02, -6); cue('kit:whoosh-fast-soft', OFF + 0.16, -7)   # 飛び立つ
# ---- 結び: もう一度、打鍵
P2 = [('つぎは、', '次は、'), ('なにを', '何を'), ('つくりましょうか。', 'つくりましょうか。')]
k = 4
for kana, conv in P2:
    for _ in kana: cue('kit:keyboard-letter-' + ('medium' if (k % 3) else 'firm'), bar(40) + k * BEAT / 4, -3 if (k % 3) else -5); k += 1
    if conv != kana: cue('kit:keyboard-space-medium', bar(40) + k * BEAT / 4, -4); k += 1
    k += 1
cue('kit:keyboard-return-soft', bar(40) + k * BEAT / 4, -4)

# ---- 鳥の声: 環境音から、澄んださえずりを切り出して文鳥の歌にする
birds = ss.read_audio(ss.lib_path('amb:birds'))
def chirp(name, t0, d, pitch=1.0):
    a, b = int((t0 - 0.025) * SR), int((t0 + d + 0.07) * SR)
    y = ss.filt(birds[a:b], 'hp', 1700, 4)
    if pitch != 1.0: y = np.stack([np.interp(np.arange(0, len(y) - 1, pitch), np.arange(len(y)), y[:, c]) for c in range(2)], 1)
    k1, k2 = ss.secs(0.012), ss.secs(0.05)
    y[:k1] *= np.linspace(0, 1, k1)[:, None]; y[-k2:] *= np.linspace(1, 0, k2)[:, None]
    path = os.path.join(WORK, name + '.wav'); ss.write_audio(path, y / (np.abs(y).max() + 1e-9) * 0.7); return path
SHORT = [chirp('chirp_s1', 6.16, 0.22), chirp('chirp_s2', 87.91, 0.23), chirp('chirp_s3', 104.24, 0.21), chirp('chirp_s4', 57.41, 0.16)]
LONG = [chirp('chirp_l1', 63.75, 0.54), chirp('chirp_l2', 39.94, 0.49), chirp('chirp_l3', 114.89, 0.48), chirp('chirp_l4', 94.63, 0.58, 0.94)]
for b in range(3):                                                 # 1 小節に「ぴ・ぴ・ぴー」
    cue(SHORT[(2 * b) % 4], SING + b * 4 * BEAT - 0.025, -9); cue(SHORT[(2 * b + 1) % 4], SING + b * 4 * BEAT + 0.5 * BEAT - 0.025, -9.5)
    cue(LONG[b], SING + b * 4 * BEAT + BEAT - 0.025, -8)
cue(LONG[3], ASM - 0.025, -8)
# 朝の鳥たち（生命の章から、文鳥が飛び立ったあとまで）
t_in, t_out = bar(26) + 0.4, bar(40) - 0.6
seg = birds[int(8 * SR):int((8 + t_out - t_in) * SR)].copy()
fi, fo = ss.secs(4.0), ss.secs(5.0)
seg[:fi] *= np.linspace(0, 1, fi)[:, None] ** 2; seg[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
amb = np.zeros((ss.secs(DUR), 2)); i0 = ss.secs(t_in); amb[i0:i0 + len(seg)] = seg[:len(amb) - i0]
AMB = os.path.join(WORK, 'amb_birds.wav'); ss.write_audio(AMB, amb / (np.abs(amb).max() + 1e-9) * 0.5)

# ---- 音楽: 曲の終わりの和音がそのまま映像の終わりになる（ループさせないよう、後ろに無音を足しておく）
music = ss.read_audio(ss.lib_path('music:inventing-flight'))
BGM = os.path.join(WORK, 'bgm.wav'); ss.write_audio(BGM, np.concatenate([music, np.zeros((ss.secs(1.0), 2))]))

CUES = os.path.join(WORK, 'cues.json'); json.dump(cues, open(CUES, 'w'), ensure_ascii=False, indent=1)
print(f'{len(cues)} cues, video {DUR:.2f}s')
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
subprocess.run([sys.executable, STUDIO, 'mix', '--video', video, '--bgm', BGM, '--amb', AMB, '--amb-gain', '3', '--cues', CUES, '-o', out], check=True)
print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
