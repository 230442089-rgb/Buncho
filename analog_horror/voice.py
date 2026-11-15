"""ナレーション原稿と音声合成（VOICEVOX）。

VOICEVOX ENGINE を http://127.0.0.1:50021 で起動しておくこと。
配役：
  A  アナウンサー      VOICEVOX:No.7（アナウンス）
  B  防災無線          VOICEVOX:剣崎雌雄
  Y  ユリア            VOICEVOX:春日部つむぎ
  T  タコくん          VOICEVOX:玄野武宏
  C  さがしている家族の声（遠くの呼び声・ささやき）
     VOICEVOX:四国めたん / 九州そら / 冥鳴ひまり / 雨晴はう / 波音リツ
"""
from __future__ import annotations

import io
import json
import os
import urllib.parse
import urllib.request

import numpy as np
import soundfile as sf

SR = 48000
VOICEVOX_URL = os.environ.get("VOICEVOX_URL", "http://127.0.0.1:50021")

# 話者ID
NO7_ANNOUNCE, KENZAKI, TSUMUGI = 30, 21, 8
TAKE, TAKE_JOY, TAKE_ANGRY, TAKE_SAD = 11, 39, 40, 41  # 玄野武宏：ノーマル／喜び／ツンギレ／悲しみ
METAN_SWEET, METAN_TSUN, METAN_HISO = 0, 6, 37
SORA_SWEET, SORA_WHISPER, HIMARI, HAU, RITSU = 15, 19, 14, 10, 9

# 声ごとの基本の調子
TUNE = {
    "A": dict(speaker=NO7_ANNOUNCE, speedScale=0.96, pitchScale=-0.02, intonationScale=0.9),
    "B": dict(speaker=KENZAKI, speedScale=0.86, pitchScale=-0.04, intonationScale=0.8),
    "Y": dict(speaker=TSUMUGI, speedScale=0.98, pitchScale=0.0, intonationScale=1.2),
    "T": dict(speaker=TAKE, speedScale=1.08, pitchScale=0.0, intonationScale=1.25),
    "C": dict(speaker=SORA_WHISPER, speedScale=0.9, pitchScale=0.0, intonationScale=1.0),
}

# (id, 声, 読み上げ原稿, 上書きする設定)
LINES: list[tuple[str, str, str, dict]] = [
    # ---- アナウンサー
    ("A01", "A", "今日も一日、ナギハマテレビをご覧いただき、ありがとうございました。", {}),
    ("A02", "A", "本日の放送は、これで終了いたします。おやすみなさい。", {}),
    ("A03", "A", "放送終了後ですが、ここで、臨時ニュースをお伝えします。", {}),
    ("A04", "A", "今日、午前二時十四分ごろから、ナギハマ市の全域で、降っていた雨が、空中で止まっています。", {}),
    ("A05", "A", "雨粒は、地面に落ちることなく、その場にとどまっています。", {}),
    ("A06", "A", "市内を流れる川や、港の波も、止まっているということです。", {}),
    ("A07", "A", "原因は、わかっていません。", {}),
    ("A08", "A", "市内にお住まいのかたは、屋外に出ないでください。", {}),
    ("A09", "A", "新しい情報です。", {}),
    ("A10", "A", "同じ時刻から、市の上空に、太陽に似た光が、観測されています。", {}),
    ("A11", "A", "光は、ゆっくりと、回転しています。", {}),
    ("A12", "A", "光に向かって、物を投げたり、明かりを向けたりしないでください。", {}),
    ("A13", "A", "投げた物は、落ちてきません。", {}),
    ("A14", "A", "現在の、市内の様子です。防災無線の音声が、入っています。", {}),
    ("A15", "A", "スタジオでも、同じ恐怖を、感じています。", {}),
    ("A16", "A", "放送を、続けます。", {}),
    ("A17", "A", "ただいま、画面に、当局のものではない文字が、表示されています。", {}),
    ("A18", "A", "読み上げないでください。", {}),
    ("A19", "A", "読み上げ、ないで。オレンジいろの髪。ヘッドホンをした、若い男性を、見かけたかたわ", dict(speedScale=0.9, intonationScale=0.6)),
    ("A20", "A", "お伝えします。午前四時十一分、ナギハマ市の雨は、再び、降りはじめました。", {}),
    ("A22", "A", "この現象による、けが人の情報は、入っていません。", {}),
    ("A24", "A", "なお、同じ時刻、市内で、傘を差した複数の人影に、若い男性が、引きずられていくのが、目撃されています。", {}),
    ("A25", "A", "人影は、いずれも、白い髪をしていた、ということです。", {}),
    ("A26", "A", "男性は、最後まで、何かを叫んでいたということです。", {}),
    # ---- 防災無線（「、」ごとに区切って間をあける）
    ("B01", "B", "こちらは、防災、ナギハマ、です。", {}),
    ("B02", "B", "排水口や、用水路を、のぞきこまないでください。", {}),
    ("B04", "B", "走っていく影を、追いかけないでください。", {}),
    ("B05", "B", "市の外へ、出ようとしないでください。道は、もとの場所に、戻ります。", {}),
    ("B06", "B", "理由のない恐怖を感じても、それは、異常では、ありません。", {}),
    # ---- ユリア
    ("Y01", "Y", "教えてね", {}),
    ("Y02", "Y", "タコくーん。どこー？", dict(speedScale=0.85)),
    ("Y03", "Y", "怒ってないよー。あーしら、タコくんのこと、大好きだからさー", dict(speedScale=0.9)),
    ("Y04", "Y", "タコくん。そこー？", dict(speedScale=0.88)),
    ("Y05", "Y", "みーつけた", dict(speedScale=0.8, intonationScale=1.35)),
    ("Y06", "Y", "ブスって言ったの、四十七回。あーし、ぜんぶ覚えてるよ", dict(speedScale=0.94)),
    ("Y07", "Y", "そういう生意気なとこ、ほんと、たまんない", dict(speedScale=0.9)),
    ("Y08", "Y", "余裕余裕。はい、つかまえた", {}),
    ("Y09", "Y", "婚姻届、もう書いてあるから。あとは、タコくんのハンコだけ", dict(speedScale=0.96)),
    ("Y10", "Y", "うんうん。そういうとこも、大好き。帰ろ", dict(speedScale=0.94)),
    ("Y11", "Y", "あーしらの愛、たっぷり、教えてあげるからね", dict(speedScale=0.88)),
    # ---- タコくん（一人称は「俺」。ぶっきらぼう）
    ("T01", "T", "へっ。ラーメンは食い放題、エナドリも買い放題。あのブスどものカネ、最高だな", dict(speaker=TAKE_JOY, speedScale=1.05)),
    ("T02", "T", "はあ？　うそだろ。もう来たのかよ", dict(speaker=TAKE_SAD, speedScale=1.12, pitchScale=0.03)),
    ("T03", "T", "なんでだよ。なんで、俺が映ってんだよ", dict(speaker=TAKE_SAD, speedScale=1.0, volumeScale=0.8, pitchScale=0.02)),
    ("T04", "T", "うわああああああああああ", dict(speaker=TAKE_ANGRY, scream=True)),
    ("T05", "T", "はなせ！　はなせって！　くんな！", dict(speaker=TAKE_ANGRY, speedScale=1.22, intonationScale=1.6, pitchScale=0.07)),
    ("T06", "T", "誰が結婚なんかするか！　ブス！　ブスども！", dict(speaker=TAKE_ANGRY, speedScale=1.15, intonationScale=1.6, pitchScale=0.08)),
    ("T07", "T", "ブスどもおおおおおお", dict(speaker=TAKE_ANGRY, scream=True, scream_shift=1.28)),
    ("T08", "T", "やめろ、やめろって", dict(speaker=TAKE_SAD, speedScale=1.3, intonationScale=1.5, pitchScale=0.07)),
    # ---- さがしている家族の声
    ("C01", "C", "お茶、二人分、用意してありますからぁ。もう、離しませんよぉ", dict(speaker=METAN_SWEET)),
    ("C02", "C", "おいでぇ。こわくないよぉ", dict(speaker=SORA_SWEET, speedScale=0.82)),
    ("C03", "C", "にあの、となり。ずっと", dict(speaker=HIMARI, speedScale=0.72)),
    ("C04", "C", "もう！　お金は、ちゃんと返しなさい！", dict(speaker=HAU, speedScale=1.05, intonationScale=1.3)),
    ("C05", "C", "いた？", dict(speaker=RITSU, speedScale=0.85)),
    ("C06", "C", "よわーい。逃げ足だけじゃん", dict(speaker=METAN_TSUN, speedScale=1.0, intonationScale=1.3)),
    ("C07", "C", "タコくん。どこ。どこにいるの", dict(speaker=SORA_WHISPER, speedScale=0.8)),
    ("C08", "C", "いない。いない。ここにも、いない", dict(speaker=METAN_HISO, speedScale=0.85)),
    ("C09", "C", "お金は、いい。帰ってきて", dict(speaker=RITSU, speedScale=0.82)),
    ("C10", "C", "かけっこ？　あたしの勝ち！", dict(speaker=HAU, speedScale=1.1, pitchScale=0.04, intonationScale=1.4)),
    ("C11", "C", "だいすき。だいすき。だいすき", dict(speaker=SORA_WHISPER, speedScale=0.85)),
    ("C12", "C", "結婚しよ。ね。結婚しよ", dict(speaker=METAN_HISO, speedScale=0.9)),
]
VOICE_OF = {lid: v for lid, v, _, _ in LINES}


def _post(path: str, data: bytes | None = None, headers: dict | None = None) -> bytes:
    req = urllib.request.Request(VOICEVOX_URL + path, data=data, headers=headers or {}, method="POST")
    return urllib.request.urlopen(req, timeout=300).read()


def _query(text: str, speaker: int) -> dict:
    q = urllib.parse.urlencode({"text": text, "speaker": speaker})
    return json.loads(_post(f"/audio_query?{q}"))


def _synth(query: dict, speaker: int) -> np.ndarray:
    query["outputSamplingRate"] = SR
    query["outputStereo"] = False
    raw = _post(f"/synthesis?speaker={speaker}", json.dumps(query).encode(), {"Content-Type": "application/json"})
    wav, sr = sf.read(io.BytesIO(raw), dtype="float32")
    assert sr == SR
    return wav if wav.ndim == 1 else wav.mean(axis=1)


def _trim(x: np.ndarray, thresh: float = 0.004, pad: float = 0.03) -> np.ndarray:
    idx = np.flatnonzero(np.abs(x) > thresh)
    if len(idx) == 0:
        return x
    p = int(pad * SR)
    return x[max(0, idx[0] - p) : min(len(x), idx[-1] + p)]


def _norm(x: np.ndarray, peak: float = 0.8) -> np.ndarray:
    m = float(np.abs(x).max())
    return x * (peak / m) if m > 0 else x


def _say(text: str, voice: str, over: dict) -> tuple[np.ndarray, str]:
    p = dict(TUNE[voice])
    p.update(over)
    speaker = p.pop("speaker")
    scream = p.pop("scream", False)
    s_len, s_top, s_shift = p.pop("scream_len", 0.2), p.pop("scream_top", 5.6), p.pop("scream_shift", 1.35)
    q = _query(text, speaker)
    q.update(p)
    q["prePhonemeLength"], q["postPhonemeLength"] = 0.05, 0.05
    if scream:
        # 悲鳴：短い母音をいくつも並べて伸ばす（一つの母音を長く伸ばすと、合成が途中でくずれる）。
        # 高さは最初の3拍で上げきって、あとは保つ
        moras = [m for ph in q["accent_phrases"] for m in ph["moras"]]
        for k, m in enumerate(moras):
            m["pitch"] = 5.45 + (s_top - 5.45) * min(1.0, k / 3)
            m["vowel_length"] = s_len * (0.6 if k == 0 else 1.0)
        q.update(speedScale=1.0, intonationScale=1.0, pitchScale=0.0, volumeScale=1.6)
        # 合成で出せる高さには限りがある（上げすぎると声がかすれる）ので、出したあとで全体を引き上げる
        wav = _synth(q, speaker)
        return np.interp(np.arange(0, len(wav) - 1, s_shift), np.arange(len(wav)), wav).astype(np.float32), q["kana"]
    return _synth(q, speaker), q["kana"]


def synth_line(text: str, voice: str, over: dict) -> tuple[np.ndarray, str]:
    if voice == "B":
        # 屋外スピーカー：句ごとに区切り、長めの間を入れる
        gap = np.zeros(int(0.5 * SR), dtype=np.float32)
        long_gap = np.zeros(int(0.95 * SR), dtype=np.float32)
        out: list[np.ndarray] = []
        kana: list[str] = []
        sentences = [s for s in text.split("。") if s]
        for si, sent in enumerate(sentences):
            phrases = [p for p in sent.split("、") if p]
            for pi, ph in enumerate(phrases):
                w, k = _say(ph + "。", voice, over)
                out.append(_norm(_trim(w)))
                kana.append(k)
                if pi < len(phrases) - 1:
                    out.append(gap)
            if si < len(sentences) - 1:
                out.append(long_gap)
        return np.concatenate(out), " / ".join(kana)
    w, k = _say(text, voice, over)
    return _norm(_trim(w)), k


def synth_all(out_dir: str, backend: str = "voicevox") -> dict[str, float]:
    """全行を out_dir/<id>.wav に書き出し、{id: 秒数} を返す。"""
    os.makedirs(out_dir, exist_ok=True)
    durs: dict[str, float] = {}
    kana: dict[str, str] = {}
    for lid, voice, text, over in LINES:
        wav, kana[lid] = synth_line(text, voice, over)
        sf.write(os.path.join(out_dir, f"{lid}.wav"), wav, SR, subtype="PCM_16")
        durs[lid] = len(wav) / SR
    with open(os.path.join(out_dir, "durations.json"), "w") as f:
        json.dump({"backend": backend, "durs": durs, "kana": kana}, f, ensure_ascii=False, indent=1)
    return durs


if __name__ == "__main__":
    import sys

    d = synth_all(sys.argv[1])
    kana = json.load(open(os.path.join(sys.argv[1], "durations.json")))["kana"]
    for k, v in d.items():
        print(k, round(v, 2), kana[k])
    print("total", round(sum(d.values()), 1))
