#!/usr/bin/env python3
"""tools/strike_audio.py — 迎撃ゲーム「B.U.N 襲来」の音を strike/assets/ に用意する。

  python3 tools/strike_audio.py

音の材料（どれも CC0。合成した音は使っていない。kit の音を重ねたものはある）:
  音楽   道中 "Action Strike"、決戦 "Epic Boss Battle"（どちらも Rafael Krux、FreePD）
  風     Blanket の「wind」
  効果音 SFX Kit by Wyzowl
           shot   光の矢         … digital-blip-subtle（高めに）
           tick   当たった       … impact-light-hard
           boom   機体が落ちる   … impact-deep-hard + appear-burst
           boomL  大きな爆発     … boom-hit-strong + appear-burst
           pew    敵の弾         … digital-blip-clear（低めに）
           launch バズーカ・ミサイル … whoosh-medium-hard
           alarm  旗艦の接近     … digital-breach × 2
           bossin 旗艦の登場     … boom-drop-strong
           lance  槍の光線       … whoosh-slow-hard + shimmer-long-bright
           wave   波             … faller-1s-strong + bass-sub-drop-medium
           hurt   受けた         … impact-heavy-hard + digital-interference
           gem    光の結晶       … tone-step-1（続けて取ると、ゲーム側で音の高さを上げていく）
           ready  槍がたまった   … notification-alert-soft
           charge 主砲のため     … riser-2s-strong
           cannon 主砲           … cinematic-thunder-big
           dragon 竜の姿         … riser-4s-strong + shimmer-long-sparkle
           finish 旗艦が光に返る … sting-bright-long
           eject  文鳥が飛ばされる … move-spring
           click  ボタン         … click-tap-soft
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'build', 'strike', 'audio')
OUT = os.path.join(ROOT, 'strike', 'assets')
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

def enc(name, x, kbps=96, mono=False, fmt='mp3'):
    """wav に書いてから ffmpeg で圧縮する。短い音は wav のまま（mp3 は頭に無音が付いて、鳴るのが遅れるため）"""
    wav = os.path.join(WORK, name + '.wav')
    ss.write_audio(wav, x)
    dst = os.path.join(OUT, name + '.' + fmt)
    ch = ['-ac', '1'] if mono else []
    if fmt == 'wav': cmd = ['ffmpeg', '-v', 'error', '-y', '-i', wav, *ch, '-ar', '32000', '-c:a', 'pcm_s16le', dst]
    else: cmd = ['ffmpeg', '-v', 'error', '-y', '-i', wav, *ch, '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', dst]
    subprocess.run(cmd, check=True)
    print(f'{name:8s} {len(x) / ss.SR:7.2f}s  {os.path.getsize(dst) / 1024:7.1f} KB  peak {20 * np.log10(np.abs(x).max() + 1e-9):6.1f} dB  {ss.lufs(x):6.1f} LUFS')

def fade_out(x, sec):
    x = np.array(x, float); k = min(len(x), ss.secs(sec)); x[-k:] *= np.linspace(1, 0, k)[:, None] ** 1.5; return x

# ---- 音楽: 効果音の下で流れる大きさにそろえる
m = ss.read_audio(ss.lib_path('freepd:Action Strike'))
enc('music', ss.master(m, -19.0, -2.0), 112)
# 決戦の曲は、区切りのいいところ（100 秒あたりの、いちばん静かになる瞬間）までを使ってくり返す
b = ss.read_audio(ss.lib_path('freepd:Epic Boss Battle'))
mono = b.mean(1); win = ss.secs(0.4); lo, hi = ss.secs(97), ss.secs(110)
e = np.array([np.sqrt(np.mean(mono[i:i + win] ** 2)) for i in range(lo, hi, ss.secs(0.05))])
cut = lo + int(np.argmin(e)) * ss.secs(0.05) + win // 2
print(f'boss: cut at {cut / ss.SR:.2f}s')
enc('boss', fade_out(ss.master(b, -19.0, -2.0)[:cut + ss.secs(0.5)], 0.7), 112)

# ---- 風: 15 秒のループ素材。ゲーム側で頭と終わりを重ねて、切れ目なくくり返す
w = ss.read_audio(ss.lib_path('amb:wind'))
w = ss.filt(w, 'hp', 90)
w = w * ss.dbg(-24.0 - ss.lufs(w))
enc('wind', w[:ss.secs(14.5)], 72, mono=True)

# ---- 効果音。kit の音は動画用にかなり控えめなので、ゲームで聞こえる大きさ（音ごとの山の高さ）にそろえ直す
def kit(sid, rate=1.0):
    y, _, _ = ss.kit_sound(sid, rate)
    return ss.to_st(np.asarray(y, float))
def norm(y, peak_db): return y * (ss.dbg(peak_db) / (np.abs(y).max() + 1e-9))
def mix(*parts):
    """parts: (音, 始まる秒, dB)。いちばん大きい音を基準に重ねる"""
    n = max(ss.secs(t0) + len(y) for y, t0, _ in parts); out = np.zeros((n, 2))
    for y, t0, db in parts:
        i = ss.secs(t0); out[i:i + len(y)] += norm(y, db)
    return out

enc('shot', norm(kit('digital-blip-subtle', 1.5), -13.0), mono=True, fmt='wav')
enc('tick', norm(kit('impact-light-hard'), -11.0), mono=True, fmt='wav')
enc('boom', norm(mix((kit('impact-deep-hard'), 0, 0), (kit('appear-burst'), 0.02, -9)), -5.0))
enc('boomL', norm(mix((kit('boom-hit-strong'), 0, 0), (kit('appear-burst'), 0.03, -7)), -3.0))
enc('pew', norm(kit('digital-blip-clear', 0.75), -12.0), mono=True, fmt='wav')
enc('launch', norm(kit('whoosh-medium-hard'), -8.0), mono=True)
a = kit('digital-breach')
enc('alarm', norm(mix((a, 0, 0), (a, len(a) / ss.SR + 0.12, 0)), -13.0), mono=True)
enc('bossin', norm(kit('boom-drop-strong'), -3.0))
enc('lance', norm(mix((kit('whoosh-slow-hard'), 0, 0), (kit('shimmer-long-bright'), 0.12, -5)), -4.0))
enc('wave', norm(mix((kit('faller-1s-strong'), 0, 0), (kit('bass-sub-drop-medium'), 0.02, -2)), -4.0))
enc('hurt', norm(mix((kit('impact-heavy-hard'), 0, 0), (kit('digital-interference'), 0.03, -9)), -4.0), mono=True)
enc('gem', norm(kit('tone-step-1'), -11.0), mono=True, fmt='wav')
enc('ready', norm(kit('notification-alert-soft'), -11.0), mono=True, fmt='wav')
enc('charge', norm(kit('riser-2s-strong', 1.16), -8.0))
enc('cannon', norm(kit('cinematic-thunder-big'), -3.0))
enc('dragon', norm(mix((kit('riser-4s-strong', 1.1), 0, 0), (kit('shimmer-long-sparkle'), 0, -4)), -4.0))
enc('finish', norm(kit('sting-bright-long'), -4.5), 112)
enc('eject', norm(kit('move-spring'), -11.0), mono=True)
enc('click', norm(kit('click-tap-soft'), -8.0), mono=True, fmt='wav')
print('→', OUT)
