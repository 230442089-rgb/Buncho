"""全体の時間割。台詞の長さから、場面・テロップ・字幕・効果音の時刻を決める。"""
from __future__ import annotations

from voice import VOICE_OF

# 画面下を流れる「各地の情報」
TICKER_1 = [
    "東区　つり下げた物が　すべて同じ方向に傾く",
    "市内の飲食店・自動販売機で　高額紙幣の使用が相次ぐ",
    "山手　地面から　脈拍に似た規則的な振動",
    "港　海水が球になって浮かぶ",
    "駅前　路面にひび割れ　けが人なし",
    "市立美術館の周辺のみ　異常の報告なし",
    "市内全域　電話・テレビが　ひとりでに起動",
]
TICKER_2 = [
    "午前４時１１分　沖の海面が　一度だけ白く光る",
    "同時刻　上空から　誰かを叱るような大きな声　窓ガラスが震える",
    "市役所の窓口に　記入済みの婚姻届が　多数届く",
    "市内各戸の郵便受けに　差出人のない「おわび」と書かれた封筒",
]

# 電波ジャックの画面に並ぶ地区名
DISTRICTS = [
    "北区", "港町", "駅前", "山手", "東区", "西区", "浜通り", "潮見",
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
        self.caps: list[dict] = []
        self.marks: dict[str, float] = {}
        self.cuts: list[float] = []
        self._open: dict | None = None

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
        """テープの継ぎ目。"""
        self.cuts.append(self.t)

    def mark(self, name: str, offset: float = 0.0) -> float:
        self.marks[name] = self.t + offset
        return self.marks[name]

    def say(self, lid: str, after: float = 0.5, cap: str | None = None, hold: float = 0.6) -> dict:
        s = {"id": lid, "voice": VOICE_OF[lid], "t0": self.t, "t1": self.t + self.durs[lid]}
        self.says.append(s)
        if cap:
            self.caps.append({"who": s["voice"], "text": cap, "t0": s["t0"] - 0.05, "t1": s["t1"] + hold})
        self.t = s["t1"] + after
        return s

    def telop(self, kind: str, text: str, t0: float, t1: float) -> None:
        self.telops.append({"kind": kind, "text": text, "t0": t0, "t1": t1})


def build(durs: dict[str, float]) -> dict:
    tl = TL(durs)
    m = tl.marks

    # ---------------------------------------------------------------- S0 テープ頭
    tl.scene("blue", 2.6, osd="play")
    tl.scene("label", 4.8)
    tl.cut()

    # ---------------------------------------------------------------- S1 放送終了
    tl.open("closing", rain=False)
    tl.mark("music1")
    tl.wait(2.4)
    tl.say("A01", 0.45)
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
    tl.mark("street0")
    h0 = tl.t + 0.4
    tl.wait(0.9)
    tl.say("A04", 0.55)
    tl.say("A05", 0.55)
    tl.say("A06", 0.6)
    tl.say("A07", 0.8)
    w0 = tl.t
    tl.say("A08", 1.3)
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

    # ---------------------------------------------------------------- S4 防犯カメラ：自販機コーナーのタコくん
    tl.open("vend", stamp="02:41", cam="CAM 03　自販機コーナー")
    tl.mark("vend0")
    tl.wait(2.0)
    tl.say("T01", 1.0, cap="へっ。ラーメンは食い放題、エナドリも買い放題。\nあのブスどものカネ、最高だな")
    s = tl.say("Y02", 0.9, cap="タコくーん♡　どこー？", hold=1.0)
    m["vend_hear"] = s["t0"] + 0.5
    tl.say("T02", 0.35, cap="……は？　うそだろ。もう来たのかよ", hold=0.3)
    tl.mark("vend_run")
    tl.wait(1.6)
    tl.mark("vend1")
    tl.close()
    tl.cut()

    # ---------------------------------------------------------------- S5 防災無線
    tl.open("bousai", clock="3:05", cam="市役所前カメラ")
    tl.mark("bousai0")
    h0 = tl.t + 0.4
    tl.wait(0.8)
    tl.say("A14", 0.5)
    tl.mark("chime_bousai")
    tl.wait(3.0)
    b_text = {
        "B01": "こちらは　防災なぎはま　です",
        "B02": "市内全域で　雨が空中で止まる\n現象が　発生しています",
        "B03": "けが人などの情報は　入っていません\n落ち着いて　行動してください",
        "B04": "不要不急の外出を控え\n建物の中に　とどまってください",
        "B05": "外へ出たり　窓を開けたりしないでください\n外にいる方は　近くの建物へ",
        "B06": "新しい情報が入りしだい\nまたお知らせします",
    }
    for lid in ["B01", "B02", "B03", "B04", "B05", "B06"]:
        s = tl.say(lid, 0.85)
        tl.telop("bousai", b_text[lid], s["t0"] - 0.1, s["t1"] + 0.6)
    tl.mark("bousai_hj")  # スピーカーが乗っ取られる
    tl.wait(1.3)
    s = tl.say("Y03", 2.0)
    tl.telop("bousai_y", "怒ってないよー♡\nタコくんのこと　大好きだからさー♡", s["t0"] - 0.1, s["t1"] + 1.6)
    tl.telop("head", "凪浜市が防災無線で呼びかけ", h0, m["bousai_hj"] + 0.4)
    tl.mark("bousai1")
    tl.close()

    # ---------------------------------------------------------------- S6 スタジオ
    tl.open("studio", clock="3:07")
    tl.mark("studio0")
    tl.wait(0.9)
    tl.say("A15", 1.0)
    tl.say("A16", 0.5)
    tl.close()

    # ---------------------------------------------------------------- S7 電波ジャック：たずね人
    tl.open("notice", clock="3:07")
    hj = tl.mark("hijack0")
    tl.wait(1.2)
    tl.say("A17", 0.6)
    tl.say("A18", 0.7)
    s19 = tl.say("A19", -0.1)  # 読まされている。語尾をユリアが引き取る
    m["a19_0"], m["a19_1"] = s19["t0"], s19["t1"]
    tl.say("Y01", 0.45, cap="教えてね♡", hold=0.5)
    tl.close()

    # ---------------------------------------------------------------- S8 さがしている（文字とノイズの嵐）
    tl.open("storm", clock="3:07")
    st = tl.mark("storm0")
    tl.wait(17.0)
    tl.mark("storm1")
    for k, off in enumerate([3.4, 7.2, 11.0]):  # 街頭カメラが一瞬だけ彼をとらえる
        m[f"flash{k}"] = st + off
    m["form_flash"] = st + 13.6
    tl.close()

    # ---------------------------------------------------------------- S7b ご利用明細
    tl.open("statement", clock="3:08")
    tl.mark("statement0")
    tl.wait(0.5)
    m["st_head"] = tl.t
    tl.say("R01", 0.5, cap="はい、明細ね。テルの口座から、３１８万円。\n……ぜんぶ、追えてるし")
    m["st_ramen"] = tl.t - 0.2
    tl.say("R02", 0.35, cap="１３日、夜１０時４１分。麺屋なぎ　駅前店。\n味噌バターコーン、大盛り、全部のせ。\n麺かため、味こいめ、油多め。ライスおかわり２回")
    tl.say("V01", 0.3, cap="味噌バターコーン、全部のせ、麺かため、ですね♡\n……覚えましたからぁ♡\nおうちで毎日、作ってさしあげますねぇ♡")
    tl.say("L01", 0.5, cap="もう！　油多めで、ライスおかわり２回！？\n体こわすでしょ！　……胃薬、出しとくからね")
    m["st_drink1"] = tl.t - 0.2
    tl.say("R03", 0.35, cap="１１時５８分。港町２丁目、コインランドリー横の\n自販機で、ギガボルトのトロピカル、１２本。\n……日付が変わって、汐入公園で、ゼロ８本、ブルーハワイ４本")
    tl.say("M01", 0.5, cap="はぁ？　一晩で２４本とか、バカじゃん♡\nあたしが心臓マッサージ、してあげよっか？♡")
    m["st_more"] = tl.t - 0.2
    tl.say("R04", 0.35, cap="１４日。お昼は、らーめん潮騒。塩とんこつ、背脂こってり、\nバリカタ、煮卵２個、替え玉２回。\n夜は、中華そば灯台。チャーシュー麺、特盛、ねぎ抜き")
    tl.say("S01", 0.5, cap="タクシーで３回、市の外へ。\n……３回とも、ここに戻ってきはったなぁ。\nうちが結んだ街やさかい、出られへんよ")
    m["st_big"] = tl.t - 0.2
    tl.say("R05", 0.35, cap="ホテルのスイート、２泊。で、ネットカフェ、３泊。\nヘッドホンも、買い替えてるし。６万４８００円。\n……スマホのガチャ、１２８万円")
    tl.say("X01", 0.6, cap="……ガチャ、１２８万……。\nその、僕に言ってくれたら……\n全部、買ってあげたのに")
    m["st_last"] = tl.t - 0.2
    s6 = tl.say("R06", 0.8, cap="残り、４２円。\n……で、今いるの、港町２丁目のアパート、\n２０３号室。テレビの前っしょ")
    m["st_room"] = s6["t0"] + 4.5
    tl.close()

    # ---------------------------------------------------------------- S9 このテレビの前
    tl.open("room")
    tl.mark("here0")
    tl.wait(1.9)
    tl.mark("room0")
    tl.wait(2.6)
    tl.say("T03", 1.5, cap="なんでだよ……。なんで、俺が映ってんだよ……", hold=0.4)
    s = tl.say("Y04", 0.0, cap="タコくん♡　そこー？", hold=0.8)
    m["hold0"] = s["t1"] + 0.05  # 名前を呼ばれたあとで、息を止める
    tl.wait(3.0)
    tl.mark("room_found")  # 「……いた」
    tl.wait(0.8)
    tl.mark("stop0")  # 世界が止まりはじめる
    tl.wait(1.1)
    tl.close()

    # ---------------------------------------------------------------- S10 止まった画面
    tl.open("freeze")
    f0 = tl.mark("freeze0")
    m["fz_text1"] = f0 + 1.6
    m["fz_eyes_open"] = f0 + 4.7
    m["fz_look3"] = f0 + 6.0
    tl.t = f0 + 6.9
    s = tl.say("Y05", 1.0)
    m["y05"] = s["t0"]
    s = tl.say("Y06", 0.5)
    m["y06"] = s["t0"]
    s = tl.say("Y07", 0.25)
    m["y07"], m["y07_1"] = s["t0"], s["t1"]
    s = tl.say("T04", 0.0)
    m["scream0"] = s["t0"]
    r0 = m["release0"] = s["t0"] + 0.45
    tl.t = r0 + 0.45
    tl.close()

    # ---------------------------------------------------------------- S10b 部屋を飛び出す
    tl.open("bolt")
    b0 = tl.mark("bolt0")
    m["bolt_door"] = b0 + 0.9  # ドアがはね開く
    m["bolt_out"] = b0 + 1.0
    m["bolt_gone"] = b0 + 3.0  # 外階段へ消える
    tl.t = b0 + 1.2
    tl.say("T09", 0.4, cap="くそっ、くそっ！　なんで部屋までバレてんだよ！\nあのブスども！", hold=0.3)
    tl.t = max(tl.t, m["bolt_gone"] + 0.6)
    tl.close()
    tl.cut()

    tl.open("burst", clock="3:11", cam="駅前カメラ")
    tl.mark("burst0")
    tl.wait(0.6)
    tl.say("M02", 0.1, cap="あはっ、逃げた逃げた♡　いいよ、走りなよ。\nどこ行っても、あたしの前に出るけどね♡", hold=0.3)
    tl.say("S02", 0.25, cap="……そっちは、行き止まりやで", hold=0.3)
    tl.say("R07", 0.25, cap="次の角、右。……はい、ルリカ。そこ", hold=0.3)
    tl.say("L02", 0.25, cap="もう！　走らないの！　転んだら危ないでしょ！\n……ヴォル姉様、お願い！", hold=0.3)
    tl.say("V02", 0.2, cap="承知しました♡　では、おうちへ、お連れしますねぇ♡", hold=0.2)
    tl.close()
    tl.cut()

    # ---------------------------------------------------------------- S11 防犯カメラ：つかまる
    tl.open("capture", stamp="03:12", cam="CAM 07　駅前通り")
    c0 = tl.mark("capture0")
    m["cap_hit"] = c0 + 3.3  # 糸がとどく
    m["cap_fall"] = c0 + 3.6
    tl.t = c0 + 3.9
    tl.say("T08", 0.2, cap="やめろ、やめろって！", hold=0.2)
    tl.say("Y08", 0.25, cap="よゆーよゆー♪　はい、つかまえた♡", hold=0.4)
    s = tl.say("T05", 0.3, cap="はなせ！　はなせって！　来んな！", hold=0.5)
    m["drag0"] = s["t0"] + 0.3
    tl.t = max(tl.t, m["drag0"] + 4.8)
    tl.mark("drag1")
    tl.wait(3.0)  # 路上に残ったヘッドホン
    tl.mark("capture1")
    tl.close()

    # ---------------------------------------------------------------- S12 婚姻届
    tl.open("form")
    tl.mark("form0")
    tl.wait(1.0)
    tl.say("Y09", 1.5, cap="婚姻届、もう書いてあるから♡\nあとは、タコくんのハンコだけ♡", hold=1.0)
    tl.close()

    # ---------------------------------------------------------------- S13 「みつけた」
    tl.open("found")
    f = tl.mark("hj_found")
    m["hj_bye"] = f + 2.5
    m["hj_clear"] = f + 4.3
    tl.wait(4.7)
    tl.close()
    tl.scene("black", 0.8)
    tl.cut()

    # ---------------------------------------------------------------- S14 雨。引きずられていく
    tl.open("umbrella", clock="4:11", cam="駅前カメラ")
    tl.mark("rain0")
    h0 = tl.t + 1.4
    tl.wait(2.8)
    tl.say("A20", 0.6)
    tl.say("A22", 0.7)
    tl.say("A24", 0.9)
    tl.say("A25", 1.0)
    tl.say("A26", 0.5)
    tl.say("T06", 0.3, cap="誰が結婚なんかするか！　ブス！　ブスども！", hold=0.2)
    tl.say("Y10", 0.15, cap="うんうん♡　そういうとこも、大好き♡\n帰ろ♡", hold=0.2)
    s = tl.say("T07", 0.0, cap="ブスどもォォォォッ！！", hold=0.0)
    tl.t = s["t0"] + 1.9
    tl.say("Y11", 2.4, cap="あーしらの愛、たっぷり\n教えてあげるからね♡", hold=1.6)
    tl.telop("head", "傘の人影が　若い男性を連れ去る", h0, tl.t)
    tl.mark("rain1")
    tl.close()
    tl.cut()

    # ---------------------------------------------------------------- S15 おわり
    tl.mark("snow2")
    tl.scene("snow", 0.9)
    tl.mark("vcr_stop")
    tl.scene("blue", 2.8, osd="stop")
    tl.mark("end0")
    tl.scene("endcard", 12.0)

    return {
        "duration": tl.t,
        "scenes": tl.scenes,
        "says": tl.says,
        "telops": tl.telops,
        "caps": tl.caps,
        "marks": m,
        "cuts": tl.cuts,
        "tickers": [
            {"t0": m["bousai0"] + 8.0, "t1": m["bousai_hj"] + 0.4, "items": TICKER_1},
            {"t0": m["rain0"] + 4.0, "t1": m["rain1"], "items": TICKER_2},
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
