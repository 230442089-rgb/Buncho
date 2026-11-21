#!/usr/bin/env python3
# 断偽文鳥門 入門CM（60秒）の音：BGM の床（二曲と無音）、環境音（風・篝火・鳥）、効果音の一覧を作って silent.mp4 に混ぜる
import sys, os, json, subprocess
HERE = os.environ.get('AD_WORK', os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.environ.get('SOUND_STUDIO_DIR', HERE)); sys.path.insert(0, HERE)
import numpy as np, sound_studio as ss
SR = ss.SR; DUR = 60.0; N = ss.secs(DUR)

def seg(path, start, length):
    y = ss.read_audio(path, start)[:ss.secs(length)]
    if len(y) < ss.secs(length): y = np.pad(y, ((0, ss.secs(length) - len(y)), (0, 0)))
    return y

def ramp(y, a, b, k0, k1):  # y の [a,b) 秒を k0→k1 に直線で
    i0, i1 = ss.secs(a), min(len(y), ss.secs(b))
    if i1 > i0: y[i0:i1] *= np.linspace(k0, k1, i1 - i0)[:, None]
    return y

def place(buf, y, t0): i = ss.secs(t0); j = min(len(buf), i + len(y)); buf[i:j] += y[:j - i]

def norm(y, target):
    l = ss.lufs(y); return y * ss.dbg(target - l) if l > -69 else y

# ---- BGM の床 ----
bed = np.zeros((N, 2))
A = seg(ss.lib_path('music:hidden-truth'), 5.66, 7.5)               # 0.00〜7.50
A = norm(A, -18.0); A = ramp(A, 0, 0.3, 0, 1); A = ramp(A, 7.5 - 0.005, 7.5, 1, 0)   # 斬った瞬間にブツンと切る（5ms のクリック止めだけ）
# 3.80 の曲のブームは一閃より小さく（一閃をいちばんの山にする）
g = np.ones(len(A)); i0, i1, i2, i3 = ss.secs(3.72), ss.secs(3.76), ss.secs(4.9), ss.secs(5.3); g[i0:i1] = np.linspace(1, ss.dbg(-7), i1 - i0); g[i1:i2] = ss.dbg(-7); g[i2:i3] = np.linspace(ss.dbg(-7), 1, i3 - i2); A = A * g[:, None]
place(bed, A, 0.0)
def duck(y, t_abs, depth, hold, rel, off, att=0.03):
    t0 = t_abs - off; n = len(y); g = np.ones(n); a0, a1 = ss.secs(max(0, t0 - att)), ss.secs(max(0, t0)); h1 = ss.secs(max(0, t0 + hold)); r1 = ss.secs(max(0, t0 + hold + rel)); lo = ss.dbg(-depth)
    if a1 > a0: g[a0:a1] = np.linspace(1, lo, a1 - a0)
    g[a1:min(n, h1)] = lo
    if r1 > h1: g[h1:min(n, r1)] = np.linspace(lo, 1, r1 - h1)[:max(0, min(n, r1) - h1)]
    return y * g[:, None]
EB = ss.lib_path('music:emotional-blockbuster')
B1 = seg(EB, 41.45, 21.95)                                            # 10.10〜32.05（曲の 41.55 の一打が 10.20 に来る）
B1 = norm(B1, -20.0); B1 = ramp(B1, 0, 0.02, 0, 1); B1 = ramp(B1, 21.15, 21.95, 1, 0)  # 証言のあと、教主の沈黙の前に消える
B1 = duck(B1, 11.0, 5, 2.5, 0.4, 10.1); B1 = duck(B1, 15.2, 4, 0.6, 0.3, 10.1); B1 = duck(B1, 17.1, 4, 0.5, 0.4, 10.1)
place(bed, B1, 10.1)
B2 = seg(EB, 96.12, 19.82)                                            # 40.18〜60.00（曲の 96.141 の強拍が 40.20 のカットに来る）
B2 = norm(B2, -20.0); B2 = ramp(B2, 0, 0.015, 0, 1); B2 = ramp(B2, 18.32, 19.72, 1, 0)   # 58.5〜59.9 で絵と一緒に消える
for tb in (46.18, 49.48): B2 = duck(B2, tb, 8, 0.25, 1.0, 40.18)
for tb in (47.82, 48.45): B2 = duck(B2, tb, 5, 0.2, 0.6, 40.18)
B2 = duck(B2, 52.78, 12, 20.0, 0.0, 40.18)                            # エンドカードの下では -12 dB のまま
place(bed, B2, 40.18)
ss.write_audio(os.path.join(HERE, 'bed.wav'), np.clip(bed, -1, 1))

# ---- 環境音 ----
amb = np.zeros((N, 2))
wind = ss.fit(ss.read_audio(ss.lib_path('amb:wind')), ss.secs(DUR), 2.0); wind = norm(wind, -24.0)
fire = ss.fit(ss.read_audio(ss.lib_path('amb:fireplace')), ss.secs(DUR), 2.0); fire = ss.filt(fire, 'lp', 6000); fire = norm(fire, -24.0); fire = ss.limit(fire, -14.0, look=0.002)
w1 = wind[:ss.secs(3.9)].copy() * ss.dbg(-7); w1 = ramp(w1, 0, 0.3, 0, 1); w1 = ramp(w1, 3.5, 3.9, 1, 0); place(amb, w1, 0.0)
w2 = ss.filt(wind[ss.secs(4.0):ss.secs(4.0 + 2.7)].copy(), 'hp', 150) * ss.dbg(-9); w2 = ramp(w2, 0, 0.3, 0, 1); w2 = ramp(w2, 2.6, 2.7, 1, 0); place(amb, w2, 7.5)
f1 = fire[:ss.secs(3.7)].copy(); f1 = ramp(f1, 0, 0.1, 0, 1); f1 = ramp(f1, 3.7 - 0.005, 3.7, 1, 0); place(amb, f1, 3.8)
def amb_seg(src, t0, t1, db, fi=0.3, fo=0.3, src0=0.0, hp=None):
    y = src[ss.secs(src0):ss.secs(src0 + (t1 - t0))].copy()
    if hp: y = ss.filt(y, 'hp', hp)
    y = y * ss.dbg(db); y = ramp(y, 0, fi, 0, 1); y = ramp(y, (t1 - t0) - fo, t1 - t0, 1, 0); place(amb, y, t0)
birds = ss.fit(ss.read_audio(ss.lib_path('amb:birds')), ss.secs(DUR), 2.0); birds = norm(birds, -24.0)
amb_seg(fire, 406 / 30, 586 / 30, -4.0, 0.2, 0.25, 6.0)                    # 火鉢
amb_seg(fire, 17.2, 19.0, 0.0, 0.3, 0.6, 14.0)                            # 紙が燃える間は大きく
amb_seg(birds, 586 / 30, 766 / 30, -8.0, 0.4, 0.3, 3.0)                   # 夜明けの問答
amb_seg(birds, 766 / 30, 32.05, -10.0, 0.3, 0.3, 6.0)                      # 証言
amb_seg(wind, 966 / 30, 1206 / 30, -11.0, 0.4, 0.3, 2.0, hp=120)          # 沈黙と叫び：夜の風
amb_seg(fire, 966 / 30, 1206 / 30, -10.0, 0.4, 0.3, 9.0)                  # 夜の篝火
amb_seg(birds, 1206 / 30, 43.0, -2.0, 0.3, 0.2, 12.0); amb_seg(birds, 43.0, 46.05, -7.0, 0.2, 0.2, 14.8)   # 入門の朝
f2 = fire[ss.secs(4.0):ss.secs(4.0 + 6.6)].copy(); f2 = ramp(f2, 0, 0.3, 0, 1); f2 = ramp(f2, 6.4, 6.6, 1, 0); place(amb, f2, 46.2)   # 呼びかけの夜
ss.write_audio(os.path.join(HERE, 'amb.wav'), np.clip(amb, -1, 1))

# ---- 効果音（時刻は画の動きが決まる瞬間。kit は同期点がその秒に来る） ----
C = []
def cue(sid, t, gain=0.0, **kw): C.append(dict(sfx='kit:' + sid, t=round(t, 4), gain=gain, **kw))
# 加工した音（ファイル）：kit と同じ大きさになるよう、kit の最大の短時間ラウドネスに合わせて gain を決める（ファイルの cue は -15 LUFS にそろえて置かれる）
def kitfile(sid, name, proc, rate=1.0):
    y, sp, r = ss.kit_sound(sid, rate); m0 = ss.lufs(y, True); z = proc(y.copy()); path = os.path.join(HERE, name); ss.write_audio(path, np.clip(z, -1, 1)); return path, m0, sp['sync']['at'] / r
def cuef(path_m0_sync, t, gain): path, m0, sync = path_m0_sync; C.append(dict(sfx=path, t=round(t - sync, 4), gain=round(m0 + gain + 15.0, 2)))
def fadeout(y, a, b): return ramp(y, a, b, 1, 0) if len(y) > ss.secs(a) else y
DRUM = kitfile('cinematic-drum-massive', 'sfx_drum.wav', lambda y: fadeout(ss.filt(y, 'hp', 30), 0.8, 1.5)[:ss.secs(1.5)])
BOOM = kitfile('boom-drop-strong', 'sfx_boom.wav', lambda y: fadeout(ss.filt(y, 'hp', 45), 1.0, 2.0)[:ss.secs(2.0)])
def bellp(y):
    z = ss.filt(y, 'hp', 130, order=4); z = ss.wet(z, 3.0, 0.4, 0.35); return z
BELL = kitfile('cinematic-metal-massive', 'sfx_bell.wav', bellp, rate=0.85)
cue('whoosh-slow-soft', 0.75, -14)
cue('reverse-whoosh-medium-soft', 3.80, -8)
cue('cinematic-drum-big', 3.80, -9)
cue('whoosh-fast-medium', 4.18, -16)
cue('boom-hit-medium', 4.93, -8)
cue('cinematic-metal-big', 6.00, -8, rate=0.85)
cue('shimmer-short-bright', 6.40, -14)
cue('whoosh-medium-hard', 6.65, -6)
cue('riser-2s-strong', 7.45, -15)
cue('reverse-whoosh-medium-strong', 7.45, -8)
cue('swish-hard', 7.49, 3)
cuef(DRUM, 7.50, 5)
cue('impact-deep-hard', 7.50, 6)
cuef(BOOM, 7.50, -3)
cue('swish-hard', 7.61, -4)
CLANG = kitfile('cinematic-metal-big', 'sfx_clang.wav', lambda y: ss.filt(y, 'hp', 260, order=4))
cuef(CLANG, 7.50, 0)
cue('swish-soft', 8.60, -14)
for t, g in ((8.65, -10), (8.73, -11), (8.81, -12), (8.89, -13)): cue('foley-fabric-touch', t, g)
cue('foley-paper-slide', 10.30, -8)
cue('impact-medium-firm', 331 / 30, -8); cue('props-splash', 11.10, -8)
cue('impact-medium-firm', 356 / 30, -8)
for f, g in ((359, -10), (368, -10), (377, -10)): cue('swish-soft', f / 30 - 0.03, g)
for f, g in ((359, -6), (368, -7), (377, -8)): cue('impact-heavy-firm', f / 30 + 0.07, g)
cue('impact-medium-firm', 12.70, -8); cue('foley-paper-touch', 12.78, -6)
cue('impact-heavy-firm', 13.10, -3); cue('foley-paper-touch', 13.10, -9)
# rate を燃やす朝
cue('foley-paper-touch', 13.75, -6); cue('foley-paper-touch', 15.05, -2); cue('foley-paper-slide', 15.30, 2); cue('foley-paper-touch', 15.70, 2); cue('swish-soft', 486 / 30, -14); cue('whoosh-slow-medium', 17.25, 0)
# 夜明けの問答
cue('swish-soft', 666 / 30, -14)
# 証言
cue('whoosh-fast-medium', 25.70, -14)
# 沈黙と叫び
cue('swish-soft', 1068 / 30, -12); cue('reverse-whoosh-medium-strong', 35.80, -4); cue('impact-deep-hard', 35.80, 5); cue('cinematic-drum-big', 35.80, 0); cue('boom-hit-medium', 35.80, -4); cuef(DRUM, 35.80, 3); cuef(CLANG, 35.80, 5)
for k, t in enumerate((37.45, 37.52, 37.60, 37.69, 37.80, 37.88, 37.99, 38.08, 38.20, 38.29, 38.41, 38.52, 38.66, 38.77, 38.90)): cue('foley-fabric-touch', t, round(2 - k * 1.0, 1))
cue('foley-fabric-slide', 37.50, 4); cue('foley-fabric-slide', 37.75, 1); cue('whoosh-fast-soft', 37.60, -6); cue('whoosh-fast-soft', 37.90, -6)
# 新米の入門
cue('swish-soft', 1290 / 30, -14); cue('whoosh-fast-medium', 43.15, -14)
# 呼びかけ（30 秒版の 18.5〜 を 27.7 秒あとへ）
cuef(BELL, 46.20, 4)
cue('whoosh-medium-hard', 46.60, -8)
cue('cinematic-drum-big', (604 + 831) / 30, -4); cue('foley-fabric-slide', 47.85, -4)
cue('cinematic-slam-massive', 48.55, -3); cue('cinematic-drum-big', (623 + 831) / 30, -6); cue('impact-deep-hard', (623 + 831) / 30, -6)
cuef(BELL, 49.50, 5)
cue('boom-hit-soft', (704 + 831) / 30, -10)
cuef(BELL, 52.80, 7); cue('boom-hit-soft', 52.80, -10); cuef(BELL, 54.30, 0)
json.dump(C, open(os.path.join(HERE, 'cues.json'), 'w'), ensure_ascii=False, indent=0)

# ---- 混ぜて付ける ----
silent = os.path.join(HERE, 'silent.mp4'); out = os.path.join(HERE, sys.argv[1] if len(sys.argv) > 1 else 'final.mp4')
mixw = os.path.join(HERE, 'mix.wav')
cmd = ['python3', os.path.join(os.environ.get('SOUND_STUDIO_DIR', HERE), 'sound_studio.py'), 'mix', '--video', silent, '--bgm', os.path.join(HERE, 'bed.wav'), '--amb', os.path.join(HERE, 'amb.wav'), '--amb-gain', '3', '--cues', os.path.join(HERE, 'cues.json'), '-o', mixw]
subprocess.run(cmd, check=True, cwd=HERE)
# AAC にしたときの山の超えを避けるため、4 倍に上げた波形で山を見て -2 dBFS に抑える
from scipy import signal as _sg
x = ss.read_audio(mixw); pk = np.abs(_sg.resample_poly(x, 4, 1, axis=0)).max(); lim = ss.dbg(-1.5)
for _ in range(3):  # 4 倍に上げた波形の上で先読みリミッターをかけて戻す（音量は保ったまま山だけ抑える）
    up = _sg.resample_poly(x, 4, 1, axis=0); tp = np.abs(up).max()
    if tp <= lim: break
    x = _sg.resample_poly(ss.limit(up, -1.7, look=0.002), 1, 4, axis=0)[:len(x)]
x = x * min(1.0, lim / max(1e-9, np.abs(_sg.resample_poly(x, 4, 1, axis=0)).max()))
ss.write_audio(mixw, x); print('true-ish peak before', round(20 * np.log10(pk), 2), 'after', round(20 * np.log10(np.abs(_sg.resample_poly(x, 4, 1, axis=0)).max()), 2), 'LUFS', round(ss.lufs(x), 2))
for a in (3.8, 7.5, 18.5, 20.77, 25.1): print('  momentary @', a, round(ss.lufs(x[ss.secs(a):ss.secs(a + 0.8)], True), 1))
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', silent, '-i', mixw, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], check=True)
print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,duration', '-of', 'compact', out], capture_output=True, text=True).stdout)
