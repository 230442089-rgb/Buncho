#!/usr/bin/env python3
"""kiai_voice.py — 「気合い」の叫び声をつくる。

合成音声（Open JTalk + HTS voice "NIT ATR503 M001"）で読ませた短いことばを、
WORLD（pyworld）でいったん 高さ・声道の形・息の成分 に分けてから、叫び声に作り替える:
  ・母音を何秒でも伸ばす（同じ瞬間を止めて伸ばすと機械の音になるので、母音の中をゆっくり行き来させる）
  ・高さを叫びの高さまで上げ、ふるえ・裏返りを足す
  ・口を大きく開けた形に寄せる（フォルマントを上へ）、高い成分を持ち上げる（力んだ声）
  ・声帯が割れる感じ（周期が 2 倍・3 倍になる揺れ）と、歪み、重ね録り、残響

  python3 tools/kiai_voice.py preview out.mp3     # 試聴用
使うのは numpy / scipy / pyworld / open_jtalk。
"""
import os, re, subprocess, sys, tempfile
import numpy as np
import pyworld as pw
from scipy import signal
from scipy.io import wavfile

DIC = '/var/lib/mecab/dic/open-jtalk/naist-jdic'
VOICE = '/usr/share/hts-voice/nitech-jp-atr503-m001/nitech_jp_atr503_m001.htsvoice'
FS = 48000
FP = 5.0  # 分析の刻み（ミリ秒）
VOWELS = set('aiueoN')

_cache = {}


def tts(text):
    """→ (波形, [(音素, 開始秒, 終了秒)])"""
    if text in _cache:
        return _cache[text]
    with tempfile.TemporaryDirectory() as d:
        wav, tr = os.path.join(d, 'a.wav'), os.path.join(d, 'a.trace')
        subprocess.run(['open_jtalk', '-x', DIC, '-m', VOICE, '-ow', wav, '-ot', tr, '-r', '1.0'], input=text.encode(), check=True)
        fs, x = wavfile.read(wav)
        assert fs == FS
        x = x.astype(np.float64) / 32768.0
        segs, on = [], False
        for line in open(tr, encoding='utf-8', errors='ignore'):
            if line.startswith('[Output label]'):
                on = True; continue
            if on:
                m = re.match(r'(\d+) (\d+) \S*?-(.+?)\+', line)
                if not m:
                    break
                segs.append((m.group(3), int(m.group(1)) * 1e-7, int(m.group(2)) * 1e-7))
    k = (len(x) / FS) / segs[-1][2]  # ラベルの時刻を波形の長さに合わせる
    segs = [(p, a * k, b * k) for p, a, b in segs]
    _cache[text] = (x, segs)
    return _cache[text]


_ana = {}


def analyze(text):
    if text not in _ana:
        x, segs = tts(text)
        f0, t = pw.harvest(x, FS, f0_floor=70, f0_ceil=500, frame_period=FP)
        sp = pw.cheaptrick(x, f0, t, FS)
        ap = pw.d4c(x, f0, t, FS)
        _ana[text] = (f0, sp, ap, segs)
    return _ana[text]


def smooth_noise(rng, n, fc, fs):
    """帯域を絞った乱数（−1〜1 くらい）"""
    w = rng.standard_normal(n + 2000)
    sos = signal.butter(2, fc, 'low', fs=fs, output='sos')
    y = signal.sosfilt(sos, w)[2000:]
    return y / (np.std(y) + 1e-9)


def keys(t, pts):
    """[(秒, 値), ...] をなめらかに補間"""
    xs, ys = zip(*pts)
    return np.interp(t, xs, ys)


def shout(text, durs, f0k, *, warp=((0, 1.0),), tilt=5.0, rasp=0.35, growl=0.5, jitter=0.02, crack=(), amp=((0, 1.0),),
          seed=1, f0mul=1.0, whisper=False, tail=0.12, rough=0.35):
    """text を読ませ、音素ごとの長さ durs（秒。None は元の長さ）で並べ直して叫ばせる。
    f0k: 出力の時刻 → 高さ(Hz) のキー。warp: フォルマントを上げる倍率のキー。tilt: 高域の持ち上げ（4 kHz で約 2.5×tilt dB）。
    rasp: 息・かすれ。growl: 声の割れ（0〜1）。crack: 裏返る瞬間 [(時刻, 長さ, 倍率)]。amp: 音量のキー。"""
    f0s, sp, ap, segs = analyze(text)
    rng = np.random.default_rng(seed)
    body = [s for s in segs if s[0] not in ('sil', 'pau')]
    assert len(durs) == len(body), (text, [s[0] for s in body])
    nfr = len(f0s)
    pos = []  # 出力の各フレームが、元のどのフレームを見るか
    for (ph, a, b), d in zip(body, durs):
        src = b - a
        d = src if d is None else d
        n = max(1, int(round(d * 1000 / FP)))
        fa, fb = a * 1000 / FP, b * 1000 / FP
        if ph in VOWELS and d > src * 1.6:
            edge = min(0.045, src * 0.3) * 1000 / FP
            nh = int(round(edge))
            head = np.linspace(fa, fa + edge, nh, endpoint=False)
            tailp = np.linspace(fb - edge, fb, nh, endpoint=False)
            m = n - 2 * nh
            lo, hi = fa + edge, fb - edge
            u = np.arange(m) * FP / 1000
            wander = 0.5 + 0.38 * np.sin(2 * np.pi * (0.55 + 0.2 * rng.random()) * u + rng.random() * 6.28) + 0.10 * smooth_noise(rng, m, 3.0, 1000 / FP)
            mid = lo + (hi - lo) * np.clip(wander, 0.02, 0.98)
            # 行き来のつなぎ目をなめらかに
            k = min(nh, m // 2)
            if k > 0:
                r = np.linspace(0, 1, k)
                mid[:k] = (fa + edge) * (1 - r) + mid[:k] * r
                mid[-k:] = mid[-k:] * (1 - r) + (fb - edge) * r
            pos += [head, mid, tailp]
        else:
            pos.append(np.linspace(fa, fb, n, endpoint=False))
    pos = np.clip(np.concatenate(pos), 0, nfr - 1.001)
    N = len(pos)
    t = np.arange(N) * FP / 1000
    i0 = np.floor(pos).astype(int); fr = (pos - i0)[:, None]
    lsp = np.log(sp + 1e-16)
    L = lsp[i0] * (1 - fr) + lsp[i0 + 1] * fr
    A = ap[i0] * (1 - fr) + ap[i0 + 1] * fr
    voiced = (f0s[i0] > 0) | (f0s[i0 + 1] > 0)

    # フォルマントを上へ（口を大きく開ける）・高域を持ち上げる（力む）
    nb = L.shape[1]
    fbin = np.arange(nb) * (FS / 2) / (nb - 1)
    al = keys(t, warp)
    for j in range(N):
        if abs(al[j] - 1) > 1e-3:
            L[j] = np.interp(fbin / al[j], fbin, L[j])
            A[j] = np.interp(fbin / al[j], fbin, A[j])
    gdb = tilt * np.clip(np.log2(np.maximum(fbin, 1) / 700.0), 0, 2.5)
    L += (gdb / 10 * np.log(10))[None, :] * voiced[:, None]
    # かすれ（高い帯域ほど息の成分を増やす）
    w = np.clip((fbin - 900) / 3000, 0, 1) ** 0.8
    rs = rasp * (1 + 0.35 * smooth_noise(rng, N, 6.0, 1000 / FP))
    A = 1 - (1 - A) * (1 - np.clip(rs, 0, 0.95)[:, None] * w[None, :])

    # 高さ: キー + ゆらぎ + 力みのふるえ + 裏返り
    f0 = keys(t, f0k) * f0mul
    f0 *= np.exp(jitter * 1.4 * smooth_noise(rng, N, 2.5, 1000 / FP) + jitter * 0.6 * smooth_noise(rng, N, 14.0, 1000 / FP)
                 + 0.014 * np.sin(2 * np.pi * (5.5 + rng.random()) * t + rng.random() * 6) * np.clip(t / 0.5, 0, 1))
    for (tc, dc, mc) in crack:
        up = np.clip((t - tc) / 0.015, 0, 1) * np.clip((tc + dc - t) / 0.03, 0, 1)
        f0 *= 1 + (mc - 1) * up
        A = 1 - (1 - A) * (1 - 0.5 * up[:, None])
    f0 = np.clip(f0, 60, 900)
    f0v = np.where(voiced & (not whisper), f0, 0.0)
    if whisper:
        A[:] = 1.0
    y = pw.synthesize(f0v.astype(np.float64), np.ascontiguousarray(np.exp(L)), np.ascontiguousarray(np.clip(A, 0, 1)), FS, FP)
    n = len(y); ts = np.arange(n) / FS
    f0s_ = np.interp(ts, t, f0)

    # 声の割れ: 周期が 2 倍・3 倍になる揺れ + 不規則な揺れ
    if growl > 0 and not whisper:
        ph = 2 * np.pi * np.cumsum(f0s_) / FS
        gk = growl * np.clip(0.75 + 0.45 * smooth_noise(rng, n, 2.5, FS), 0.15, 1.3)
        am = 1 + gk * (0.55 * np.cos(ph / 2 + 1.0) + 0.3 * np.cos(ph / 3 + 2.0)) + gk * 0.3 * smooth_noise(rng, n, 70.0, FS) + gk * rough * smooth_noise(rng, n, 220.0, FS)
        y = y * np.clip(am, 0.05, None)
    y *= keys(ts, amp)
    k = int(tail * FS)
    if k > 1 and k < n:
        y[-k:] *= np.linspace(1, 0, k) ** 1.5
    k = int(0.004 * FS); y[:k] *= np.linspace(0, 1, k)
    return y / (np.max(np.abs(y)) + 1e-9)


def drive(y, d=3.0, asym=0.2, mix=0.8):
    """歪ませる（真空管ふう）。d が大きいほど荒れる"""
    y = y / (np.sqrt(np.mean(y ** 2)) + 1e-9) * 0.22
    z = np.tanh(d * (y + asym * y * y)) / np.tanh(d)
    z = z - np.mean(z)
    return mix * z + (1 - mix) * y * 2.0


def eq(y, hp=110, lp=9500, pres=(2800, 4.0), fs=FS):
    y = signal.sosfilt(signal.butter(2, hp, 'high', fs=fs, output='sos'), y)
    y = signal.sosfilt(signal.butter(2, lp, 'low', fs=fs, output='sos'), y)
    f, g = pres
    b = signal.sosfilt(signal.butter(2, [f / 1.5, f * 1.5], 'band', fs=fs, output='sos'), y)
    return y + b * (10 ** (g / 20) - 1)


def stack(fn, n=3, spread=0.018, seed=10):
    """同じ叫びを少しずつ違えて重ねる（→ ステレオ）。fn(seed, f0mul) → モノラル"""
    rng = np.random.default_rng(seed)
    takes = [fn(seed, 1.0)] + [fn(seed + 7 * i, 1.0 + (0.006 if i % 2 else -0.007) * ((i + 1) // 2)) for i in range(1, n)]
    L = max(len(x) for x in takes) + int(0.1 * FS)
    out = np.zeros((L, 2))
    pans = [0.0, -0.75, 0.75, -0.4, 0.4]
    gains = [1.0, 0.6, 0.6, 0.45, 0.45]
    for i, x in enumerate(takes):
        off = 0 if i == 0 else int(abs(rng.normal(0, spread)) * FS)
        a = (pans[i] + 1) * np.pi / 4
        out[off:off + len(x), 0] += x * np.cos(a) * gains[i] * 1.414
        out[off:off + len(x), 1] += x * np.sin(a) * gains[i] * 1.414
    return out


def resample(y, to=44100):
    return signal.resample_poly(y, 147, 160, axis=0) if to == 44100 else y


# ------------------------------------------------------------ この映像で使う叫び
def uooo(dur=3.6, seed=3, peak=335, power=1.0):
    """「うおおおおおっ！！」 低く入って、せり上がる"""
    def one(sd, mul):
        y = shout('うおお', [0.22, dur - 0.22 - 0.2, 0.2],
                  [(0, 150), (0.2, 185), (0.55, peak * 0.84), (dur * 0.45, peak * 0.96), (dur - 0.45, peak * 1.07), (dur, peak * 0.92)],
                  warp=[(0, 1.02), (0.5, 1.10), (dur * 0.6, 1.17), (dur, 1.12)], tilt=4.5 + power, rasp=0.32, growl=0.5 + 0.2 * power, jitter=0.022,
                  crack=[(dur * 0.78, 0.13, 1.33)] if power > 0.8 else [], amp=[(0, 0.5), (0.4, 0.85), (1.0, 1.0), (dur - 0.25, 1.0), (dur, 0.6)], seed=sd, f0mul=mul)
        return eq(drive(y, 2.6 + power, 0.25))
    return stack(one, 3 if power > 0.8 else 1, seed=seed)


def guaa(dur=1.5, seed=5):
    """「ぐあああっ！」 撃たれた声。高く跳ねて落ちる"""
    def one(sd, mul):
        y = shout('ぐああ', [0.045, 0.06, dur - 0.105 - 0.2, 0.2],
                  [(0, 210), (0.12, 390), (0.4, 350), (dur - 0.3, 270), (dur, 170)],
                  warp=[(0, 1.05), (0.2, 1.2), (dur, 1.08)], tilt=6.0, rasp=0.45, growl=0.75, jitter=0.03,
                  crack=[(0.1, 0.12, 1.25)], amp=[(0, 1.0), (dur * 0.5, 0.9), (dur, 0.35)], seed=sd, f0mul=mul)
        return eq(drive(y, 3.6, 0.3))
    return stack(one, 1, seed=seed)


def kiaida(dur=2.6, seed=7, peak=350, power=1.0, n=3, last=False):
    """「気合いだぁぁぁぁぁ！！」 き・あ・い を短く切って、だぁー で振り切る"""
    hold = dur - 0.60
    t3 = 0.52
    def one(sd, mul):
        f0k = [(0, 250), (0.12, 285), (0.42, 300), (t3, peak * 0.9), (t3 + 0.25, peak * 0.97), (dur - 0.6, peak * 1.08), (dur - 0.15, peak * (1.14 if last else 1.02)), (dur, peak * 0.85)]
        cr = [(t3 + hold * 0.62, 0.12, 1.3)] + ([(t3 + hold * 0.3, 0.1, 1.22), (t3 + hold * 0.86, 0.16, 1.4)] if last else [])
        y = shout('きあいだあ', [0.10, 0.10, 0.17, 0.13, 0.055, hold - 0.2, 0.2],
                  f0k, warp=[(0, 1.04), (0.3, 1.1), (t3, 1.14), (t3 + 0.4, 1.2), (dur, 1.15)], tilt=5.0 + 1.5 * power, rasp=0.36 + 0.08 * power,
                  growl=0.55 + 0.3 * power, jitter=0.024, crack=cr, rough=0.3 + 0.25 * power,
                  amp=[(0, 0.95), (t3 - 0.03, 0.9), (t3 + 0.06, 1.0), (dur - 0.2, 1.0), (dur, 0.7)], seed=sd, f0mul=mul)
        return eq(drive(y, 2.8 + 1.4 * power, 0.25))
    return stack(one, n, seed=seed)


def whisper_kiai(seed=2):
    """最後の、声にならない「……気合いだ」"""
    y = shout('きあいだ', [0.13, 0.13, 0.2, 0.17, 0.07, 0.3], [(0, 120), (1, 110)], tilt=1.5, rasp=0.2, growl=0, whisper=True, seed=seed, tail=0.2)
    y = signal.sosfilt(signal.butter(2, 300, 'high', fs=FS, output='sos'), y)
    return np.stack([y, y], 1) * 0.5


def speaker_break(x, t_on, t_dead=None, seed=4, fs=FS):
    """スピーカーが耐えきれなくなる音。t_on（秒）から割れはじめ、t_dead で音が途切れる"""
    rng = np.random.default_rng(seed)
    n = len(x); ts = np.arange(n) / fs
    k = np.clip((ts - t_on) / max(0.4, (t_dead or ts[-1]) - t_on), 0, 1)
    m = x.mean(1)
    # 振動板が歪む: 片側だけ潰れる + 低い桁へ落とす + 帯域が狭まる
    crush = np.round(np.clip(m * (2.5 + 6 * k), -1, 1) * (6 - 4 * k)) / (6 - 4 * k)
    hold = np.maximum(1, (1 + 10 * k)).astype(int)
    idx = (np.arange(n) // hold) * hold
    crush = crush[np.minimum(idx, n - 1)]
    crush = signal.sosfilt(signal.butter(2, [350, 3600], 'band', fs=fs, output='sos'), crush)
    # 接触不良: ぷつぷつ途切れる
    gate = (smooth_noise(rng, n, 28.0, fs) > (1.2 - 2.2 * k)).astype(float)
    gate = signal.sosfilt(signal.butter(1, 900, 'low', fs=fs, output='sos'), gate)
    wet = crush * (1 - 0.85 * gate * (k > 0.02))
    out = x * (1 - k)[:, None] + (wet * 1.3)[:, None] * k[:, None]
    if t_dead is not None:
        d = np.clip(1 - (ts - t_dead) / 0.05, 0, 1)
        out *= d[:, None]
    return out


def finish(x, ss, room=1.5, wetmix=0.2, damp=0.45):
    """44.1 kHz にして、部屋の響きを足す"""
    y = resample(x)
    return y + ss.reverb(np.concatenate([y, np.zeros((int(room * 44100), 2))]), room, damp)[:len(y)] * wetmix if False else _wet(y, ss, room, damp, wetmix)


def _wet(y, ss, room, damp, wetmix):
    y = np.concatenate([y, np.zeros((int(room * 44100), 2))])
    return y + ss.reverb(y, room, damp) * wetmix


def main():
    sys.path.insert(0, os.environ.get('SOUND_STUDIO', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'build')))
    import sound_studio as ss
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    if cmd == 'preview':
        out = sys.argv[2]
        parts = [(0.3, uooo(3.4, power=1.0)), (4.4, kiaida(2.3, seed=7, peak=335, power=0.7)), (7.1, kiaida(2.5, seed=11, peak=360, power=1.0)),
                 (10.0, kiaida(4.6, seed=13, peak=385, power=1.4, n=5, last=True))]
        L = int(15.4 * FS); buf = np.zeros((L, 2))
        for t0, y in parts:
            i = int(t0 * FS); j = min(L, i + len(y)); buf[i:j] += y[:j - i]
        buf /= np.max(np.abs(buf)) + 1e-9
        wavfile.write(out + '.dry.wav', FS, (buf * 0.9 * 32767).astype(np.int16))
        y = finish(buf, ss)
        y = ss.limit(y * ss.dbg(-14.0 - ss.lufs(y)), -1.0)
        ss.write_audio(out, y)
        print('written', out, 'LUFS %.1f' % ss.lufs(y), 'peak %.2f' % np.abs(y).max())


if __name__ == '__main__':
    main()
