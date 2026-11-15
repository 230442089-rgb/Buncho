"""ナレーション原稿と音声合成。

アナウンサー（A）と防災無線（B）の原稿を持ち、1行ずつ WAV にする。
合成エンジンは差し替えられる：
  - openjtalk : Open JTalk（pyopenjtalk-plus）＋ HTS voice。既定。
  - voicevox  : ローカルで起動している VOICEVOX ENGINE（http://127.0.0.1:50021）。
"""
from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request

import numpy as np
import soundfile as sf

SR = 48000

# (id, 声, 読み上げ原稿)
#   A = テレビのアナウンサー / B = 屋外の防災無線
#   B は「、」ごとに区切って間をあける（屋外スピーカーの読み方）
LINES: list[tuple[str, str, str]] = [
    ("A01", "A", "今日も一日、ナギハマテレビをご覧いただき、ありがとうございました。"),
    ("A02", "A", "本日の放送は、これで終了いたします。おやすみなさい。"),
    ("A03", "A", "放送終了後ですが、ここで、臨時ニュースをお伝えします。"),
    ("A04", "A", "今日、午前二時十四分ごろから、ナギハマ市の全域で、降っていた雨が、空中で止まっています。"),
    ("A05", "A", "雨粒は、地面に落ちることなく、その場にとどまっています。"),
    ("A06", "A", "市内を流れる川や、港の波も、止まっているということです。"),
    ("A07", "A", "原因は、わかっていません。"),
    ("A08", "A", "市内にお住まいの方は、屋外に出ないでください。"),
    ("A09", "A", "新しい情報です。"),
    ("A10", "A", "同じ時刻から、市の上空に、太陽に似た光が、観測されています。"),
    ("A11", "A", "光は、ゆっくりと、回転しています。"),
    ("A12", "A", "光に向かって、物を投げたり、明かりを向けたりしないでください。"),
    ("A13", "A", "投げた物は、落ちてきません。"),
    ("A14", "A", "現在の、市内の様子です。防災無線の音声が、入っています。"),
    ("B01", "B", "こちらは、防災、ナギハマ、です。"),
    ("B02", "B", "排水口や、用水路を、のぞきこまないでください。"),
    ("B03", "B", "目が合っても、声を、かけないでください。"),
    ("B04", "B", "走っていく影を、追いかけないでください。"),
    ("B05", "B", "市の外へ、出ようとしないでください。道は、もとの場所に、戻ります。"),
    ("B06", "B", "理由のない恐怖を感じても、それは、異常では、ありません。"),
    ("A15", "A", "スタジオでも、同じ恐怖を、感じています。"),
    ("A16", "A", "放送を、続けます。"),
    ("A17", "A", "ただいま、画面に、当局のものではない文字が、表示されています。"),
    ("A18", "A", "読み上げないでください。問いかけには、答えないでください。"),
    ("A19", "A", "テレビの前から、動かないでください。"),
    ("A20", "A", "お伝えします。午前四時十一分、ナギハマ市の雨は、再び、降りはじめました。"),
    ("A21", "A", "上空の光は、確認できなくなっています。"),
    ("A22", "A", "この現象による、けが人の情報は、入っていません。"),
    ("A23", "A", "ひび割れた道路や、割れた窓ガラスは、すべて、元に戻っているということです。"),
    ("A24", "A", "なお、同じ時刻、市内で、傘を差して歩く、複数の人影が、目撃されています。"),
    ("A25", "A", "人影は、いずれも、白い髪をしていた、ということです。"),
    ("A26", "A", "以上で、臨時ニュースを終わります。"),
    ("A27", "A", "おやすみなさい。"),
]

# ---------------------------------------------------------------- Open JTalk
HTS_VOICES = {
    # 声, (htsvoice のパス候補, 話速, 半音シフト)
    "A": (
        [
            os.environ.get("HTS_VOICE_A", ""),
            os.path.join(os.path.dirname(__file__), "voices", "tohoku-f01-neutral.htsvoice"),
        ],
        0.90,
        -1.5,
    ),
    "B": (
        [
            os.environ.get("HTS_VOICE_B", ""),
            os.path.join(os.path.dirname(__file__), "voices", "nitech_jp_atr503_m001.htsvoice"),
        ],
        0.80,
        -2.0,
    ),
}
_engines: dict[str, object] = {}


def _hts_engine(voice: str):
    import pyopenjtalk
    from pyopenjtalk.htsengine import HTSEngine

    if voice not in _engines:
        paths, _, _ = HTS_VOICES[voice]
        path = next((p for p in paths if p and os.path.exists(p)), pyopenjtalk.DEFAULT_HTS_VOICE)
        if isinstance(path, str):
            path = path.encode()
        _engines[voice] = HTSEngine(path)
    return _engines[voice]


def _openjtalk(text: str, voice: str) -> np.ndarray:
    import pyopenjtalk

    _, speed, half_tone = HTS_VOICES[voice]
    eng = _hts_engine(voice)
    eng.set_speed(speed)
    eng.add_half_tone(half_tone)
    labels = pyopenjtalk.extract_fullcontext(text)
    wav = np.asarray(eng.synthesize(labels), dtype=np.float64) / 32768.0
    sr = eng.get_sampling_frequency()
    if sr != SR:
        from scipy.signal import resample_poly

        wav = resample_poly(wav, SR, sr)
    return wav.astype(np.float32)


# ---------------------------------------------------------------- VOICEVOX
VOICEVOX_URL = os.environ.get("VOICEVOX_URL", "http://127.0.0.1:50021")
VOICEVOX_SPEAKER = {
    "A": int(os.environ.get("VOICEVOX_SPEAKER_A", "30")),  # No.7（アナウンス）
    "B": int(os.environ.get("VOICEVOX_SPEAKER_B", "21")),  # 剣崎雌雄
}
VOICEVOX_TUNE = {
    "A": dict(speedScale=0.93, pitchScale=-0.03, intonationScale=0.85),
    "B": dict(speedScale=0.82, pitchScale=-0.05, intonationScale=0.80),
}


def _voicevox(text: str, voice: str) -> np.ndarray:
    import io

    spk = VOICEVOX_SPEAKER[voice]
    q = urllib.parse.urlencode({"text": text, "speaker": spk})
    req = urllib.request.Request(f"{VOICEVOX_URL}/audio_query?{q}", method="POST")
    query = json.load(urllib.request.urlopen(req, timeout=60))
    query.update(VOICEVOX_TUNE[voice])
    query["outputSamplingRate"] = SR
    query["prePhonemeLength"] = 0.05
    query["postPhonemeLength"] = 0.05
    req = urllib.request.Request(
        f"{VOICEVOX_URL}/synthesis?speaker={spk}",
        data=json.dumps(query).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    wav, sr = sf.read(io.BytesIO(urllib.request.urlopen(req, timeout=300).read()), dtype="float32")
    if wav.ndim > 1:
        wav = wav.mean(axis=1)
    assert sr == SR
    return wav


# ---------------------------------------------------------------- 共通
def _trim(x: np.ndarray, thresh: float = 0.004, pad: float = 0.03) -> np.ndarray:
    """前後の無音を落とす。"""
    idx = np.flatnonzero(np.abs(x) > thresh)
    if len(idx) == 0:
        return x
    p = int(pad * SR)
    return x[max(0, idx[0] - p) : min(len(x), idx[-1] + p)]


def _norm(x: np.ndarray, peak: float = 0.8) -> np.ndarray:
    m = float(np.abs(x).max())
    return x * (peak / m) if m > 0 else x


def synth_line(text: str, voice: str, backend: str) -> np.ndarray:
    fn = _voicevox if backend == "voicevox" else _openjtalk
    if voice == "B":
        # 屋外スピーカー：句ごとに区切り、長めの間を入れる
        gap = np.zeros(int(0.62 * SR), dtype=np.float32)
        long_gap = np.zeros(int(1.25 * SR), dtype=np.float32)
        out: list[np.ndarray] = []
        sentences = [s for s in text.split("。") if s]
        for si, sent in enumerate(sentences):
            phrases = [p for p in sent.split("、") if p]
            for pi, ph in enumerate(phrases):
                out.append(_norm(_trim(fn(ph + "。", voice))))
                if pi < len(phrases) - 1:
                    out.append(gap)
            if si < len(sentences) - 1:
                out.append(long_gap)
        return np.concatenate(out)
    return _norm(_trim(fn(text, voice)))


def synth_all(out_dir: str, backend: str = "openjtalk") -> dict[str, float]:
    """全行を out_dir/<id>.wav に書き出し、{id: 秒数} を返す。"""
    os.makedirs(out_dir, exist_ok=True)
    durs: dict[str, float] = {}
    for lid, voice, text in LINES:
        wav = synth_line(text, voice, backend)
        sf.write(os.path.join(out_dir, f"{lid}.wav"), wav, SR, subtype="PCM_16")
        durs[lid] = len(wav) / SR
    with open(os.path.join(out_dir, "durations.json"), "w") as f:
        json.dump({"backend": backend, "durs": durs}, f, ensure_ascii=False, indent=1)
    return durs


if __name__ == "__main__":
    import sys

    d = synth_all(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "openjtalk")
    for k, v in d.items():
        print(k, round(v, 2))
    print("total", round(sum(d.values()), 1))
