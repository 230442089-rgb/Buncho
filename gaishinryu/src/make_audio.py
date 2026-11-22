#!/usr/bin/env python3
# 「外神竜に会いに行こう」（60秒）の音：曲（Inventing Flight の 60 秒編集）、場面ごとの環境音、効果音を silent.mp4 に混ぜる
# 使い方: python3 make_audio.py [出力.mp4]
#   GS_WORK          … silent.mp4 があり、途中のファイルと出力を書く場所（既定はカレントフォルダ）
#   SOUND_STUDIO_DIR … sound_studio.py のある場所（既定はこのフォルダ）
import sys, os, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get('GS_WORK', os.getcwd())
sys.path.insert(0, os.environ.get('SOUND_STUDIO_DIR', HERE))
import numpy as np, sound_studio as ss
from scipy import signal as sg
SR = ss.SR; DUR = 60.0; N = ss.secs(DUR)

def ramp(y, a, b, k0, k1):  # y の [a,b) 秒を k0→k1 に直線で
    i0, i1 = ss.secs(a), min(len(y), ss.secs(b))
    if i1 > i0: y[i0:i1] *= np.linspace(k0, k1, i1 - i0)[:, None]
    return y
def place(buf, y, t0): i = ss.secs(t0); j = min(len(buf), i + len(y)); buf[i:j] += y[:j - i]
def norm(y, target): l = ss.lufs(y); return y * ss.dbg(target - l) if l > -69 else y

# ---- 曲：Inventing Flight（Bryan Teoh、FreePD、public domain の献呈）の 60 秒編集 ----
# 曲の 0–29.80 → 0–29.80 ／ 56.28–72.83 → 29.80–46.35（29.80 に山）／ 86.07–89.38 → 46.35–49.66（低音が抜ける）／ 119.17–129.70 → 49.66–60.00
# つなぎは等パワーの重ね（40ms／40ms／0.4 秒）で、つぎの部の頭がつなぎ目にちょうど来る。57.5–60.0 で消える
SEGS = [(0.0, 29.80, 0.0), (56.28, 72.83, 0.04), (86.07, 89.38, 0.04), (119.17, 129.70, 0.4)]
def music_edit():
    src = ss.lib_path('music:inventing-flight'); full = ss.read_audio(src)
    buf = np.zeros((N + ss.secs(2), 2)); t = 0.0
    for k, (a, b, xf) in enumerate(SEGS):
        h = xf / 2; nx = SEGS[k + 1][2] / 2 if k + 1 < len(SEGS) else 0.0
        y = full[ss.secs(a - h):ss.secs(b + nx)].copy(); n = len(y); g = np.ones(n)
        if k and xf > 0: m = ss.secs(xf); g[:m] = np.sin(np.linspace(0, np.pi / 2, m))
        if k + 1 < len(SEGS) and SEGS[k + 1][2] > 0: m = ss.secs(SEGS[k + 1][2]); g[n - m:] *= np.cos(np.linspace(0, np.pi / 2, m))
        i0 = ss.secs(t - h); place(buf, y * g[:, None], i0 / SR); t += b - a
    buf = buf[:N]; a, b = ss.secs(57.5), ss.secs(60.0); buf[a:b] *= np.cos(np.linspace(0, 1, b - a) * np.pi / 2)[:, None]   # 等パワーで 57.5–60.0：画が黒へ沈む 59.6–60.0 まで曲が残る
    return buf * ss.dbg(-1.5)
bed = music_edit(); ss.write_audio(os.path.join(WORK, 'bed.wav'), np.clip(bed, -1, 1))

# ---- 環境音（場面ごと。値は曲を −18 LUFS としたときの大きさ） ----
amb = np.zeros((N, 2))
def notch(y, f0, q):  # 狭い帯だけを切る（往復で位相をずらさない）
    b, a = sg.iirnotch(f0, q, SR); return sg.filtfilt(b, a, sg.filtfilt(b, a, y, axis=0), axis=0)
def seg(src, t0, t1, src0, target, fi=0.3, fo=0.3, lp=None, hp=None, whine=False, hum=None):
    y = src[ss.secs(src0):ss.secs(src0 + (t1 - t0))].copy()
    if whine: y = notch(y, 4840.0, 30.0)   # 鳥の録音にずっと入っている 4.84 kHz の虫の音のような鳴りを切る
    if hum: y = notch(y, hum, 8.0)          # 録音のうなり
    if lp: y = ss.filt(y, 'lp', lp)
    if hp: y = ss.filt(y, 'hp', hp)
    y = norm(y, target); y = ramp(y, 0, fi, 0, 1); y = ramp(y, (t1 - t0) - fo, t1 - t0, 1, 0); return y
birds = ss.read_audio(ss.lib_path('amb:birds')); cafe = ss.read_audio(ss.lib_path('amb:coffee-shop')); wind = ss.read_audio(ss.lib_path('amb:wind'))
place(amb, seg(cafe, 0.0, 6.90, 0.0, -36.0, 0.5, 0.6, lp=2500), 0.0)            # A1 朝の駅前のざわめき（遠く。曲の前奏は静かなので、その下に）
place(amb, seg(birds, 0.0, 6.90, 8.0, -36.0, 0.5, 0.6, whine=True), 0.0)        # A2 朝の鳥
place(amb, seg(cafe, 23.17, 26.47, 6.7, -27.0, 0.2, 0.3, lp=2500), 23.17)       # A3 会場のざわめき（ネムリア。夕方の A7 と同じ箇所を使わない）
# A4 丘の風：ファイルの突風の山（4–5 秒）が曲の息つぎ（28.6–29.6）に重なる位置から。15 秒で一周するので二周目は 6.0 から重ねてつなぐ
w1 = seg(wind, 26.47, 39.44, 1.87, -27.0, 0.4, 0.6, hp=150); w2 = seg(wind, 38.84, 45.53, 6.0, -27.0, 0.6, 0.33, hp=150)
place(amb, w1, 26.47); place(amb, w2, 38.84)
# A5 夜明けの鳥：大きな一声（ファイルの 27.0）が s11 への切り替え 33.10 に来るように
b5 = seg(birds, 26.47, 45.53, 20.37, -32.0, 0.4, 0.33, whine=True); place(amb, b5, 26.47)
# 29.80（曲の山）から：風 −4dB、鳥 −6dB（33.10 で戻す）
env = np.ones(N); i0, i1, i2 = ss.secs(29.80), ss.secs(29.95), ss.secs(45.53)
env[i0:i1] = np.linspace(1, ss.dbg(-4), i1 - i0); env[i1:i2] = ss.dbg(-4)
envb = np.ones(N); j0, j1, j2, j3 = ss.secs(29.80), ss.secs(29.95), ss.secs(33.00), ss.secs(33.10)
envb[j0:j1] = np.linspace(1, ss.dbg(-6), j1 - j0); envb[j1:j2] = ss.dbg(-6); envb[j2:j3] = np.linspace(ss.dbg(-6), 1, j3 - j2)
hill = np.zeros((N, 2)); place(hill, w1, 26.47); place(hill, w2, 38.84); amb -= hill; amb += hill * env[:, None]
hb = np.zeros((N, 2)); place(hb, b5, 26.47); amb -= hb; amb += hb * envb[:, None]
place(amb, seg(birds, 45.53, 52.97, 48.0, -37.0, 0.37, 0.3, hp=300, lp=6000, whine=True), 45.53)   # A6 主家の窓の外の鳥（遠く。低いうなりと高いざらつきは切る）
place(amb, seg(cafe, 52.97, 59.60, 10.0, -35.0, 0.4, 1.6, lp=2500, hp=200, hum=112.0), 52.97)   # A7 夕方の駅前のざわめき（朝と同じ箇所を使わない。112 Hz のうなりは切る。画と一緒に 59.6 で消える）
ss.write_audio(os.path.join(WORK, 'amb.wav'), np.clip(amb, -1, 1))
# mix は環境音のファイル全体を −27+amb_gain LUFS にそろえる（1 秒／2 秒のフェードのあとで測る）ので、そのままの大きさで入るように gain を返す

# ---- 効果音（SFX Kit、CC0。時刻は同期点） ----
C = []
def cue(sid, t, gain=0.0, **kw): C.append(dict(sfx='kit:' + sid, t=round(t, 4), gain=gain, **kw))
cue('whoosh-medium-soft', 0.25, -8, rate=1.1)       # 広告の画面が点く
cue('whoosh-slow-soft', 6.62, -4)                   # 曲に帯が入る：本社前へ
cue('shimmer-long-soft', 17.39, -8)                 # 結電工の網が光る
cue('whoosh-medium-soft', 21.55, -8, rate=0.9)      # アセラの後ろを白い壁が横切る
cue('boom-drop-soft', 29.80, -2, rate=0.9)          # 山：丘の肩を越えて十二人
cue('reverse-whoosh-long-soft', 29.80, -4)
cue('shimmer-long-soft', 29.85, -6)
cue('whoosh-slow-medium', 30.10, -6, rate=0.85)
cue('whoosh-slow-soft', 33.10, -12)                 # 名前の順送りへ
cue('whoosh-slow-medium', 41.90, -9, rate=0.85)     # 一族の上へ昇る
cue('foley-wood-touch', 46.37, 6)                   # ユリアが現れる（低音が抜けるのと同時）
cue('foley-card-touch', 46.37, -2)                  # 同じ瞬間に高い輪郭を足す（曲の強拍の低音に埋もれないように）
cue('foley-fabric-touch', 47.17, -6)                # 座る衣ずれ（1・2・3・4 人）
cue('foley-fabric-touch', 48.00, -5)
cue('foley-fabric-touch', 48.83, -4)
cue('sting-airy-long', 56.27, -4)                   # 終わりの札
json.dump(C, open(os.path.join(WORK, 'cues.json'), 'w'), ensure_ascii=False, indent=0)

# ---- 混ぜて付ける ----
# sound_studio の mix と同じ並べ方（曲は −18 LUFS、kit は同期点を時刻に、全体を −16 LUFS に）。ただし mix が曲の終わりに足す 2.5 秒のフェードはかけない（曲は自分で 57–60 に消える）
silent = os.path.join(WORK, 'silent.mp4'); out = os.path.join(WORK, sys.argv[1] if len(sys.argv) > 1 else 'final.mp4'); mixw = os.path.join(WORK, 'mix.wav')
mix = np.zeros((N, 2)); b = bed.copy(); m = ss.secs(0.005); b[:m] *= np.linspace(0, 1, m)[:, None]
mix += b * ss.dbg(-18.0 - ss.lufs(b)); mix += amb
for c in C:
    y, sp, r = ss.kit_sound(c['sfx'][4:], float(c.get('rate', 1.0))); ss.place(mix, y, c['t'] - sp['sync']['at'] / r, ss.dbg(c['gain']))
x = ss.master(mix, -16.0)
# AAC で山が越えないよう、4 倍に上げた波形の上で先読みリミッターをかけて −1.5 dBTP に抑える
pk = np.abs(sg.resample_poly(x, 4, 1, axis=0)).max(); lim = ss.dbg(-1.5)
for _ in range(3):
    up = sg.resample_poly(x, 4, 1, axis=0)
    if np.abs(up).max() <= lim: break
    x = sg.resample_poly(ss.limit(up, -1.7, look=0.002), 1, 4, axis=0)[:len(x)]
x = x * min(1.0, lim / max(1e-9, np.abs(sg.resample_poly(x, 4, 1, axis=0)).max()))
ss.write_audio(mixw, x)
print('true-ish peak before', round(20 * np.log10(pk), 2), 'after', round(20 * np.log10(np.abs(sg.resample_poly(x, 4, 1, axis=0)).max()), 2), 'LUFS', round(ss.lufs(x), 2))
for a in (0.25, 6.62, 17.39, 29.80, 33.10, 46.35, 49.66, 56.27, 58.0, 59.0): print('  momentary @', a, round(ss.lufs(x[ss.secs(a):ss.secs(a + 0.8)], True), 1))
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', silent, '-i', mixw, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], check=True)
print(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,duration', '-of', 'compact', out], capture_output=True, text=True).stdout)
