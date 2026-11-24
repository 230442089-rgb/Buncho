# コードで作った 2 本の映像

どちらも、一行の依頼から、映像のすべてをプログラムで生成したアニメーションです（1920×1080・30 fps・音つき）。
写真・動画・画像生成モデルの素材は使っていません。

| | 題 | 長さ | 依頼 |
|---|---|---|---|
| 1 | [言葉は、世界になる。](#1-言葉は世界になる) — `words-become-worlds.mp4` | 2 分 22 秒 | 「今のあなたの実力をフルに示す、アニメーションビデオを作って」 |
| 2 | [見えない火](#2-見えない火) — `invisible-fire.mp4` | 6 分 17 秒 | 「原子力発電を、このぐらいのクオリティでアニメーションに、そして最悪の事故、周辺の人間に与える影響も、即死からさまざまなしゅるいまで」 |

映像は 1 枚の Web ページが「フレーム番号 → 絵」の純粋な関数になっていて、ヘッドレス Chromium で 1 フレームずつ描いて撮り、ffmpeg で H.264 にしています。
エンジン（WebGL2 の薄いラッパー、HDR → ブルーム → 仕上げ、文字の層）は `film/src/` にあり、2 本目もそれを使います。

---

## 1. 言葉は、世界になる。

入力欄にプロンプトが打ち込まれ、Enter で文字が粒になって一点に集まります。そこから先は、次元をひとつずつ上がっていきます。

| 小節 | 章 | 一行 | 画面で起きていること |
|---|---|---|---|
| 0–1 | 序 | — | 実際のプロンプトを、かな漢字変換つきで打つ |
| 2 | 0 点 | はじめに、点があった。 | 文字の粒が渦を巻いてカーソルに吸い込まれ、朱の点になる |
| 3–5 | 1 線 | 点が動くと、線になる。 | 弦の定常波 → 72 個の円（フーリエ級数）が一筆書きの文鳥を描く → その糸がほどけてローレンツ・アトラクタに |
| 6–9 | 2 面 | 線が動くと、面になる。 | 和紙の上に、ボロノイ分割・数理的な墨流し・マンデルブロ集合・反応拡散（Gray–Scott） |
| 10–17 | 3 立体 | 面が動くと、立体になる。 | 反応拡散の模様が紙のレリーフとして立ち上がり、山に育ち、空と湖が現れる（レイマーチング） |
| 18–25 | 4 時間 | 立体が動くと、時間が流れる。 | 日の出から星空までの一日を 13 秒で → 流体シミュレーション（Stable Fluids）が拍に合わせて噴き上がる |
| 26–33 | 5 生命 | 時間が流れて、いのちが宿る。 | 鳥の群れ（ボイド）→ 枝がのび、文鳥がとまる（距離関数でモデリングしたキャラクター） |
| 34–39 | 6 言葉 | いのちは、言葉をうたう。 | さえずるたびに文字が生まれ、集まって題になる。文鳥は飛び立つ |
| 40– | 結び | — | 入力欄に戻る。「次は、何をつくりましょうか。」 |

最初の朱い点（カーソル）は、文鳥のくちばしの色です。時間は音楽（72.5 BPM）の小節をものさしにして組んであります（`film/src/core.js` の `bar()`）。

```
film/index.html          ページ本体と文字のスタイル
film/src/core.js         時間のものさし・イージング・乱数
film/src/gl.js post.js   WebGL2 の薄いラッパー、HDR → ブルーム → 仕上げ
film/src/world.js        地形・空・雲・水のレイマーチング
film/src/bird.js         文鳥と枝（距離関数）    birdAct.js  演技（時刻 → ポーズ）
film/src/fluid.js rd.js flock.js lines.js   流体・反応拡散・群れ・線
film/src/scenes/         章ごとの演出
```

リポジトリにある `words-become-worlds.mp4` は、原版を 2 パスで圧縮した写しです（原版との SSIM は平均 0.993）。原版は 100 MB を超えるため置いていません。

---

## 2. 見えない火

原子力発電のしくみ、冷却を失った炉がたどる道すじ、そして人への影響を、順に追います。語りはすべて画面の文字です。

| 時刻 | 章 | 画面で起きていること |
|---|---|---|
| 0:00 | 序 | 原子炉の水の底。燃料集合体のすき間が青く光る（チェレンコフ光） |
| 0:20 | 1 分裂 | ウラン 235 の原子核（核子 236 個を 1 個ずつ描画）に中性子が入り、のびて、くびれて、2 つに割れる |
| 0:38 | 2 連鎖 | 飛び出した中性子が次の核を割る。1 → 2 → 4 → …。制御棒が中性子を吸い、「1 回が次の 1 回」に落ち着く（臨界） |
| 1:15 | 3 発電 | ペレット 1 個（1 cm）から、燃料棒 → 燃料集合体 → 炉心 → 発電所全体（100 m 以上）まで、ひと続きに引いていく。熱 → 蒸気 → タービン → 復水器の循環。止める・冷やす・閉じ込める |
| 1:50 | 4 事故 | 2011 年 3 月 11 日。地震・自動停止 → 崩壊熱 → 津波・全電源喪失 → 水位低下 → 約 1,200℃ で水素発生 → 約 2,800℃ で炉心溶融 → 底が抜ける → 水素が建屋にたまる → 3 月 12 日 15 時 36 分、爆発 |
| 3:08 | 5 拡散 | 風に乗る放射性物質（パフモデル）。雨や雪の区域で地面に落ち、同心円を越えて北西へのびる。避難。政府内で検討された最悪の想定（170 km・250 km） |
| 3:44 | 6 身体 | 放射線が DNA を切る（1 本なら修復、2 本ともなら困難）。線量の梯子: 爆発 → 50 Gy → 10 Gy → 約 4 Gy → 1 Gy → 100 mSv → ふだんの 2.1 mSv/年 |
| 4:48 | 7 人々 | 急性放射線症 134 人・うち 28 人死亡（チェルノブイリ）。住民には急性障害はなく、別のかたちの害: 子どもの甲状腺がん、避難による死（福島県の震災関連死 2,350 人）、心の健康、長引く避難、将来のがん、次の世代 |
| 5:49 | 8 時間 | 半減期。セシウム 137 が半分になるまで 30 年 |
| 6:01 | 結び | 「原子の火は、スイッチでは消えない。」出典 |

色には役割があります。青は制御された火（チェレンコフ光、水の中の炉心）、琥珀から赤は手を離れた火（崩壊熱、溶けた燃料、放射性物質）。
放射線の「カチ、カチ」という音は 1 回が 1 つのできごとで、連鎖反応では核分裂の数、線量の梯子では線量に応じて密になります。

### 数字の出典

画面に出る数字は、制作時（2026 年 11 月）に次の資料で確かめました。画面の左下にも、その場面の出典を出しています。

| 内容 | 出典 |
|---|---|
| チェルノブイリ: 急性放射線症 134 人・28 人死亡、爆発直後に 2 人、線量 0.8〜16 Gy、住民に急性障害なし | [UNSCEAR / 米国立がん研究所の解説](https://dceg.cancer.gov/research/what-we-study/about-chornobyl-accident)、[ドイツ連邦放射線防護庁](https://www.bfs.de/EN/topics/ion/accident-management/emergency/chornobyl/health-effects-sovjetunion.html) |
| 甲状腺がん 約 2 万例（1991–2015 年、事故当時 18 歳未満）、約 4 分の 1 が被ばくによる | [UNSCEAR 2018 年白書（国連の発表）](https://news.un.org/en/node/1008292) |
| チェルノブイリの避難 約 11 万 6 千人、その後 20 万人以上。心の健康が最大の公衆衛生問題。がん死の推計 約 4,000 人 | [WHO（2005–2006 年）](https://www.who.int/news/item/05-09-2005-chernobyl-the-true-scale-of-the-accident)、[WHO: Health consequences](https://www.who.int/publications/m/item/health-consequences-of-the-chernobyl-nuclear-accident) |
| がん死の推計 約 1 万 6 千人（欧州全体、幅 6,700〜38,000） | [国際がん研究機関（IARC）2006 年](https://www.iarc.who.int/wp-content/uploads/2018/07/IARCBriefingChernobyl.pdf) |
| 急性放射線症の線量区分（骨髄 0.7〜10 Gy、消化管 10 Gy 以上、中枢神経・心血管 50 Gy 以上で 3 日以内に死亡、LD50/60） | [米国 CDC: Acute Radiation Syndrome](https://www.cdc.gov/radiation-emergencies/hcp/clinical-guidance/ars.html) |
| 100 mSv で生涯のがん死亡リスク約 0.5% 増、日本人の約 30% はがんで死亡 | [環境省「統一的な基礎資料」](https://www.env.go.jp/chemi/rhm/current/03-04-03.html) |
| 自然放射線 日本平均 2.1 mSv/年、胸部 X 線 0.06、胸部 CT 2.4〜12.9、東京–NY 往復 0.11〜0.16 mSv | [環境省「統一的な基礎資料」身の回りの放射線](https://www.env.go.jp/chemi/rhm/current/attach/202603mat1-02-41.pdf) |
| 福島: 被ばくによる健康影響は確認されておらず、将来も識別できる増加は考えにくい | [UNSCEAR 2020/2021 年報告（環境省による要約）](https://www.env.go.jp/en/chemi/rhm/basic-info/2024/05-02-07.html) |
| 遺伝的影響は人では確認されていない | [環境省 ポータル（原爆被爆二世の調査）](https://www.env.go.jp/chemi/rhm/portal/digest/nextgeneration/detail_003.html) |
| 福島県の震災関連死 2,350 人（2025 年 12 月 31 日現在） | [復興庁（2026 年 2 月 13 日公表）](https://www.reconstruction.go.jp/files/user/topics/main-cat2/sub-cat2-6/20260213_kanrenshi.pdf) |
| 福島県の避難者 最大 164,865 人（2012 年 5 月）、22,625 人（2026 年 5 月） | [福島県「避難者数の推移」](https://www.pref.fukushima.lg.jp/site/portal/hinansya.html) |
| 1 号機の経過（地震の約 50 分後の津波で全電源喪失、3 月 12 日 15 時 36 分に水素爆発） | [東京電力「1 号機はなぜ過酷事故に至ったか」](https://www.tepco.co.jp/nu/fukushima-np/outline/2_3-j.html) |
| 最悪の想定（170 km 圏 強制移転、250 km 圏 任意移転） | [Japan Times（2012 年 1 月。原子力委員長の 2011 年 3 月 25 日の試算について）](https://www.japantimes.co.jp/news/2012/01/06/national/tokyo-exodus-nuke-reports-worst-scenario) |
| 崩壊熱（停止直後 約 6〜7%、1 時間後 約 1.5%、1 日後 0.4%、1 週間後 0.2%） | [Decay heat（Wikipedia。出典は米エネルギー省のハンドブック）](https://en.wikipedia.org/wiki/Decay_heat) |
| 廃炉の目標 2041〜2051 年、燃料デブリの試験取り出し（2024 年 11 月 0.693 g、2025 年 4 月 約 0.2 g） | [経済産業省 廃炉・汚染水・処理水対策](https://www.meti.go.jp/earthquake/nuclear/decommissioning/committee/osensuitaisakuteam/2026/03/03/4-2.pdf) |

### 模式図であること・確かめきれなかったこと

- 図はすべて模式図です。発電所の断面は沸騰水型（マーク I 型格納容器）をおおよその実寸で描いていますが、配管や機器は大幅に省いています。
- 事故の経過は福島第一原発 1 号機をもとにしています。水位が下がってから炉心が溶けるまでの時刻は解析によって幅があるため、画面には「数時間後」とだけ出しています。
- 地図の地形は作りものです。町の方角と距離、汚染が北西へのびたことは実際にもとづきますが、汚染の濃さや範囲を正確に写したものではありません。
- 「約 1,200℃」（ジルコニウムと水蒸気の反応が激しくなる温度）、「約 2,800℃」（二酸化ウランの融点）、「ペレット 1 個で家庭の電気およそ 8 か月分」は、広く使われている概数です。今回の調べでは一次資料の該当箇所までは確認できていません（8 か月分は、燃焼度と熱効率から計算して桁が合うことだけ確かめました）。
- 線量と症状の対応は目安です。個人差があり、治療の有無でも変わります。

### ファイル

```
atom/index.html            ページ本体と文字のスタイル
atom/src/core.js           時間割（音楽から決めた合図の時刻）
atom/src/kit.js            描画部品: 2D キャンバスの層、球のインポスタ、光る点、透視投影、文字の置き方
atom/src/pool.js           水の底の炉心（序と結び）
atom/src/plantdraw.js      発電所の断面図（ペレット 1 個から全景まで、同じ関数で描く）
atom/src/scenes/           prologue fission chain plant accident fallout body people closing
tools/atom_audio.py        曲の編集・カチカチ音・効果音
```

---

## つくり直す

```bash
npm install                      # KaTeX
tools/fetch-fonts.sh             # 書体（SIL OFL）を film/fonts/ に取得

# 1 本目
tools/render_all.sh              # 9 つの場面を build/chunks/ に描き出す
tools/concat.sh words-become-worlds.master.mp4   # 再エンコードなしでつなぎ、音を付ける
tools/web-copy.sh                # GitHub に置ける大きさの写し → words-become-worlds.mp4

# 2 本目
tools/atom_render_all.sh         # 9 つの場面を build/atom/chunks/ に描き出す（GPU なしで 1 時間あまり）
tools/atom_concat.sh invisible-fire.master.mp4

# 確認用の静止画（秒・分:秒・f フレーム番号で指定。--film atom で 2 本目）
node tools/frame.js --film atom 2:59.5 f5400
```

Playwright（Chromium）と ffmpeg、Python（numpy・scipy）が必要です。書体は Inter と JetBrains Mono も使います。
音付けは video-making-custom-sound スキルの `sound_studio.py` を呼び出します。

## 素材とライセンス

| | | |
|---|---|---|
| 音楽（1 本目） | “Inventing Flight” Bryan Teoh（FreePD.com） | CC0 |
| 音楽（2 本目） | “Night Vigil” Kevin MacLeod、“Hidden Truth” Rafael Krux（FreePD.com） | CC0 |
| 効果音 | SFX Kit by Wyzowl | CC0 |
| 環境音 | Blanket の birds・stream・wind | CC0 / パブリックドメイン |
| 書体 | しっぽり明朝、Noto Sans JP、Inter、JetBrains Mono、KaTeX の数式書体 | SIL Open Font License ほか |

プロンプト: あなた　／　構成・演出・プログラム: Claude
