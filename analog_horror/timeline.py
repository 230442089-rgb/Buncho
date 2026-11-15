"""全体の時間割。ナレーションの長さから、場面・テロップ・効果音の時刻を決める。"""
from __future__ import annotations

from voice import LINES

VOICE_OF = {lid: v for lid, v, _ in LINES}

# 画面下を流れる「各地の情報」
TICKER_1 = [
    "東区　つり下げた物が　すべて同じ方向に傾く",
    "山手　地面から　脈拍に似た規則的な振動",
    "港　海水が球になって浮かぶ",
    "駅前　路面にひび割れ　けが人なし",
    "市立美術館の周辺のみ　異常の報告なし",
    "市内全域　電話・テレビが　ひとりでに起動",
]
TICKER_2 = [
    "午前４時１１分　沖の海面が　一度だけ白く光る",
    "同時刻　上空から　誰かを叱るような大きな声　窓ガラスが震える",
    "市内各戸の郵便受けに　差出人のない「おわび」と書かれた封筒",
]

# 電波ジャックの画面に並ぶ地区名
DISTRICTS_SLOW = ["北区", "港町", "駅前", "山手", "東区", "西区", "浜通り", "潮見"]
DISTRICTS_FAST = [
    "灯台前", "魚市場", "中央", "緑ヶ丘", "桜町", "汐入", "川端", "新町", "本町", "旭町",
    "松原", "沖ノ島", "寺町", "学校前", "病院前", "団地", "貯水池", "峠", "旧道", "岬",
    "防波堤", "操車場", "浄水場", "変電所", "市場通り", "弁天", "稲荷前", "三番町", "上ノ坂", "入江",
]


class TL:
    def __init__(self, durs: dict[str, float]):
        self.durs = durs
        self.t = 0.0
        self.scenes: list[dict] = []
        self.says: list[dict] = []
        self.telops: list[dict] = []
        self.marks: dict[str, float] = {}
        self.cuts: list[float] = []
        self._open: dict | None = None

    # -- 場面
    def open(self, name: str, **args) -> dict:
        assert self._open is None
        self._open = {"name": name, "t0": self.t, "args": args}
        return self._open

    def close(self) -> None:
        sc = self._open
        sc["t1"] = self.t
        self.scenes.append(sc)
        self._open = None

    def scene(self, name: str, dur: float, **args) -> dict:
        sc = self.open(name, **args)
        self.t += dur
        self.close()
        return sc

    def wait(self, dur: float) -> None:
        self.t += dur

    def cut(self) -> None:
        """テープの継ぎ目（録画の一時停止→再開）。"""
        self.cuts.append(self.t)

    def mark(self, name: str, offset: float = 0.0) -> float:
        self.marks[name] = self.t + offset
        return self.marks[name]

    # -- 音声
    def say(self, lid: str, after: float = 0.5) -> dict:
        s = {"id": lid, "voice": VOICE_OF[lid], "t0": self.t, "t1": self.t + self.durs[lid]}
        self.says.append(s)
        self.t = s["t1"] + after
        return s

    # -- テロップ
    def telop(self, kind: str, text: str, t0: float, t1: float) -> None:
        self.telops.append({"kind": kind, "text": text, "t0": t0, "t1": t1})


def build(durs: dict[str, float]) -> dict:
    tl = TL(durs)

    # ---------------------------------------------------------------- S0 テープ頭
    tl.scene("blue", 2.6, osd="play")
    tl.scene("label", 4.6)
    tl.cut()

    # ---------------------------------------------------------------- S1 放送終了
    tl.open("closing", rain=False)
    tl.mark("music1")
    tl.wait(2.4)
    tl.say("A01", 0.5)
    tl.say("A02", 2.2)
    tl.close()
    tl.mark("bars1")
    tl.scene("bars", 2.4)
    tl.mark("snow1")
    tl.scene("snow", 1.0)
    tl.cut()

    # ---------------------------------------------------------------- S2 臨時ニュース：雨
    tl.open("rinji", clock="2:21")
    tl.mark("chime_news1", 0.25)
    tl.wait(2.5)
    tl.say("A03", 0.6)
    tl.close()

    tl.open("street", clock="2:21", mode="frozen", cam="駅前カメラ")
    h0 = tl.t + 0.4
    tl.wait(0.9)
    tl.say("A04", 0.6)
    tl.say("A05", 0.6)
    tl.say("A06", 0.7)
    tl.say("A07", 0.9)
    w0 = tl.t
    tl.say("A08", 1.4)
    tl.telop("head", "凪浜市全域　降っていた雨が空中で静止", h0, tl.t)
    tl.telop("warn", "屋外に出ないでください", w0 - 0.2, tl.t)
    tl.close()
    tl.cut()

    # ---------------------------------------------------------------- S3 続報：空の光
    tl.open("rinji", clock="2:38")
    tl.mark("chime_news2", 0.2)
    tl.wait(1.5)
    tl.say("A09", 0.5)
    tl.close()

    tl.open("sky", clock="2:38", cam="屋上カメラ")
    tl.mark("sky0")
    h0 = tl.t + 0.4
    tl.wait(1.0)
    tl.say("A10", 0.7)
    tl.say("A11", 0.9)
    w0 = tl.t
    tl.say("A12", 1.0)
    w1 = tl.t - 0.4
    tl.say("A13", 2.4)
    tl.telop("head", "凪浜市の上空に「太陽に似た光」", h0, tl.t)
    tl.telop("warn", "光に向かって物を投げないでください", w0 - 0.2, w1)
    tl.telop("warn", "投げた物は　落ちてきません", w1 + 0.3, tl.t)
    tl.mark("sky1")
    tl.close()
    tl.cut()

    # ---------------------------------------------------------------- S4 防災無線
    tl.open("bousai", clock="3:05", cam="市役所前カメラ")
    tl.mark("bousai0")
    h0 = tl.t + 0.4
    tl.wait(0.8)
    tl.say("A14", 0.5)
    tl.mark("chime_bousai")
    tl.wait(3.0)
    b_text = {
        "B01": "こちらは　防災なぎはま　です",
        "B02": "排水口や用水路を　のぞきこまないでください",
        "B03": "目が合っても　声をかけないでください",
        "B04": "走っていく影を　追いかけないでください",
        "B05": "市の外へ出ようとしないでください\n道は　もとの場所に戻ります",
        "B06": "理由のない恐怖を感じても\nそれは　異常ではありません",
    }
    for lid in ["B01", "B02", "B03", "B04", "B05", "B06"]:
        s = tl.say(lid, 1.3)
        tl.telop("bousai", b_text[lid], s["t0"] - 0.1, s["t1"] + 0.9)
    tl.wait(0.6)
    tl.telop("head", "凪浜市が防災無線で呼びかけ", h0, tl.t)
    tl.mark("bousai1")
    tl.close()

    # ---------------------------------------------------------------- S5 スタジオ→電波ジャック
    tl.open("studio", clock="3:07")
    tl.mark("studio0")
    tl.wait(0.9)
    tl.say("A15", 1.0)
    tl.say("A16", 0.5)
    tl.close()

    tl.open("hijack", clock="3:07")
    hj = tl.mark("hijack0")
    # 緑の文字：タイトル→たずね人→地区の一覧
    tl.marks["hj_title"] = hj + 0.3
    tl.marks["hj_ask1"] = hj + 1.9
    tl.marks["hj_ask2"] = hj + 3.1
    tl.wait(1.2)
    tl.say("A17", 0.7)
    rows0 = hj + 4.6
    tl.marks["hj_rows0"] = rows0
    tl.say("A18", 0.9)
    # 「このテレビの前」
    tl.marks["hj_here"] = tl.t - 0.5
    s19 = tl.say("A19", 0.0)
    stop0 = s19["t0"] + 0.60 * (s19["t1"] - s19["t0"])
    tl.marks["stop0"] = stop0  # テープが止まりはじめる
    f0 = stop0 + 1.35
    tl.marks["freeze0"] = f0  # 完全に止まる
    tl.marks["fz_text1"] = f0 + 2.2  # 「ごめんね。…」
    tl.marks["fz_eyes_open"] = f0 + 5.6
    tl.marks["fz_look1"] = f0 + 6.9
    tl.marks["fz_look2"] = f0 + 8.2
    tl.marks["fz_look3"] = f0 + 9.4
    tl.marks["fz_text2"] = f0 + 10.4  # 「……ちがうか」
    tl.marks["fz_eyes_close"] = f0 + 11.9
    r0 = f0 + 13.0
    tl.marks["release0"] = r0  # 動きだす
    tl.marks["hj_fast0"] = r0 + 1.0
    tl.marks["hj_found"] = r0 + 4.0  # 「みつけた」
    tl.marks["hj_bye"] = r0 + 6.6  # 「はい、おしまい」
    tl.marks["hj_clear"] = r0 + 8.6
    tl.t = r0 + 9.0
    tl.close()
    tl.scene("black", 0.9)
    tl.cut()

    # ---------------------------------------------------------------- S6 雨
    tl.open("street", clock="4:11", mode="rain", cam="駅前カメラ")
    tl.mark("rain0")
    h0 = tl.t + 1.4
    tl.wait(3.4)
    tl.say("A20", 0.6)
    tl.say("A21", 0.6)
    tl.say("A22", 0.7)
    tl.say("A23", 1.0)
    tl.telop("head", "凪浜市の雨　ふたたび降りはじめる", h0, tl.t)
    tl.close()

    tl.open("umbrella", clock="4:16", cam="駅前カメラ")
    tl.mark("umb0")
    h0 = tl.t + 0.4
    tl.wait(0.9)
    tl.say("A24", 1.4)
    tl.say("A25", 1.4)
    tl.say("A26", 1.3)
    tl.telop("head", "市内で　傘を差して歩く複数の人影", h0, tl.t)
    tl.mark("rain1")
    tl.close()
    tl.cut()

    # ---------------------------------------------------------------- S7 ふたたび放送終了
    tl.open("closing", rain=True)
    tl.mark("music2", -1.2)  # オルゴールは少し早く、前の場面の終わりから鳴りはじめる
    tl.wait(2.2)
    tl.say("A27", 4.6)
    tl.close()
    tl.mark("bars2")
    tl.scene("bars", 1.5)
    tl.mark("snow2")
    tl.scene("snow", 0.9)
    tl.mark("vcr_stop")
    tl.scene("blue", 2.8, osd="stop")
    tl.mark("end0")
    tl.scene("endcard", 11.0)

    # 「各地の情報」は防災無線の場面から、電波ジャックの手前まで流す
    m = tl.marks
    return {
        "duration": tl.t,
        "scenes": tl.scenes,
        "says": tl.says,
        "telops": tl.telops,
        "marks": m,
        "cuts": tl.cuts,
        "tickers": [
            {"t0": m["bousai0"] + 9.0, "t1": m["hijack0"] + 0.5, "items": TICKER_1},
            {"t0": m["rain0"] + 5.0, "t1": m["rain1"], "items": TICKER_2},
        ],
    }


if __name__ == "__main__":
    import json
    import sys

    d = json.load(open(sys.argv[1]))["durs"]
    tl = build(d)
    for sc in tl["scenes"]:
        print(f"{sc['t0']:7.2f} {sc['t1']:7.2f}  {sc['name']:9s} {sc['args']}")
    print("duration", round(tl["duration"], 1))
    for k, v in sorted(tl["marks"].items(), key=lambda kv: kv[1]):
        print(f"  {v:7.2f} {k}")
