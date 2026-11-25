#!/usr/bin/env python3
"""tools/flight_audio.py — 飛行ゲーム「ユリアと、空へ」の音を flight/assets/ に用意する。

  python3 tools/flight_audio.py

音の材料（どれも CC0。合成した音は使っていない）:
  音楽   "Inventing Flight" Bryan Teoh（FreePD）。1 本目の映像と同じ曲。くり返し流す。
  風     Blanket の「wind」（飛ぶ速さで強さと明るさを変える）
  効果音 SFX Kit by Wyzowl
           gate   輪をくぐる … notification-success-chime
           center ど真ん中   … shimmer-short-sparkle
           mote   光の粒     … tone-step-1（続けて取ると、ゲーム側で音の高さを上げていく）
           boost  加速       … whoosh-medium-medium
           bump   ぶつかる   … impact-medium-soft
           splash 水面       … props-splash
           finish さいごの輪 … sting-bright-long
           turn   ふり向く   … pop-medium-in
           click  ボタン     … click-tap-soft
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'build', 'flight', 'audio')
OUT = os.path.join(ROOT, 'flight', 'assets')
os.makedirs(WORK, exist_ok=True); os.makedirs(OUT, exist_ok=True)
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

def enc(name, x, kbps, mono=False, fmt='mp3'):
    """wav に書いてから ffmpeg で圧縮する。短い音は wav のまま（mp3 は頭に無音が付いて、鳴るのが遅れるため）"""
    wav = os.path.join(WORK, name + '.wav')
    ss.write_audio(wav, x)
    dst = os.path.join(OUT, name + '.' + fmt)
    ch = ['-ac', '1'] if mono else []
    if fmt == 'wav': cmd = ['ffmpeg', '-v', 'error', '-y', '-i', wav, *ch, '-ar', '32000', '-c:a', 'pcm_s16le', dst]
    else: cmd = ['ffmpeg', '-v', 'error', '-y', '-i', wav, *ch, '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', dst]
    subprocess.run(cmd, check=True)
    print(f'{name:8s} {len(x) / ss.SR:7.2f}s  {os.path.getsize(dst) / 1024:7.1f} KB  peak {20 * np.log10(np.abs(x).max() + 1e-9):6.1f} dB  {ss.lufs(x):6.1f} LUFS')

# ---- 音楽: 効果音の下で流れる大きさにそろえる
m = ss.read_audio(ss.lib_path('music:inventing-flight'))
m = ss.master(m, -19.0, -2.0)
enc('music', m, 112)

# ---- 風: 15 秒のループ素材。ゲーム側で頭と終わりを重ねて、切れ目なくくり返す
w = ss.read_audio(ss.lib_path('amb:wind'))
w = ss.filt(w, 'hp', 90)
w = w * ss.dbg(-24.0 - ss.lufs(w))
enc('wind', w[:ss.secs(14.5)], 72, mono=True)

# ---- 効果音。kit の音は動画用にかなり控えめなので、ゲームで聞こえる大きさ（音ごとの山の高さ）にそろえ直す
def kit(sid, peak_db, rate=1.0):
    y, _, _ = ss.kit_sound(sid, rate)
    y = ss.to_st(np.asarray(y, float))
    return y * (ss.dbg(peak_db) / (np.abs(y).max() + 1e-9))

enc('gate', kit('notification-success-chime', -7.0), 96)
enc('center', kit('shimmer-short-sparkle', -10.0), 96)
enc('mote', kit('tone-step-1', -10.0), 96, mono=True, fmt='wav')
enc('boost', kit('whoosh-medium-medium', -8.0), 96)
enc('bump', kit('impact-medium-soft', -6.0), 96, mono=True, fmt='wav')
enc('splash', kit('props-splash', -10.0), 96, mono=True)
enc('finish', kit('sting-bright-long', -4.5), 112)
enc('turn', kit('pop-medium-in', -9.0), 96, mono=True, fmt='wav')
enc('click', kit('click-tap-soft', -8.0), 96, mono=True, fmt='wav')
print('→', OUT)
