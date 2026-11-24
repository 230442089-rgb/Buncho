# 言葉は、世界になる。

`words-become-worlds.mp4` — 2 分 22 秒、1920×1080、30 fps のアニメーション。

「今のあなたの実力をフルに示す、アニメーションビデオを作って」という一行のプロンプトから、
映像のすべてをコードで生成しました。写真・動画・画像生成モデルの素材は使っていません。

## あらすじ

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

最初の朱い点（カーソル）は、文鳥のくちばしの色です。

## しくみ

- **映像**: 1 枚の Web ページ（`film/`）が、フレーム番号 → 絵 の純粋な関数になっています。WebGL2 のシェーダーと、文字のための DOM（KaTeX で数式）。
  ヘッドレス Chromium で 1 フレームずつ描いて撮り、ffmpeg で H.264 にします（`tools/render.js`）。
- **時間**: 音楽（72.5 BPM）の小節をものさしにして全体を組んでいます（`film/src/core.js` の `bar()`）。カットも、打鍵も、文鳥のホップも拍の上にあります。
- **音**: `tools/audio.py`。音楽・効果音・鳥の声はすべて CC0 の素材で、文鳥の歌は鳥の環境音から澄んださえずりを切り出して並べています。

```
film/index.html          ページ本体と文字のスタイル
film/src/core.js         時間のものさし・イージング・乱数
film/src/gl.js post.js   WebGL2 の薄いラッパー、HDR → ブルーム → 仕上げ
film/src/world.js        地形・空・雲・水のレイマーチング
film/src/bird.js         文鳥と枝（距離関数）    birdAct.js  演技（時刻 → ポーズ）
film/src/fluid.js rd.js flock.js lines.js   流体・反応拡散・群れ・線
film/src/scenes/         章ごとの演出
tools/                   撮影・連結・音付け
```

## つくり直す

```bash
npm install                      # KaTeX
tools/fetch-fonts.sh             # 書体（SIL OFL）を film/fonts/ に取得
tools/render_all.sh              # 9 つの場面を build/chunks/ に描き出す（GPU なしで 1〜2 時間）
tools/concat.sh                  # つないで音を付ける → words-become-worlds.mp4
node tools/frame.js b30.5 64.2   # 確認用の静止画（小節・秒・f フレーム番号で指定）
```

Playwright（Chromium）と ffmpeg、Python（numpy・scipy）が必要です。書体は Inter と JetBrains Mono も使います。
音付けは video-making-custom-sound スキルの `sound_studio.py` を呼び出します。

## 素材とライセンス

| | | |
|---|---|---|
| 音楽 | “Inventing Flight” Bryan Teoh（FreePD.com） | CC0 |
| 効果音 | SFX Kit by Wyzowl | CC0 |
| 鳥の声 | Blanket の環境音 birds | CC0 / パブリックドメイン |
| 書体 | しっぽり明朝、Noto Sans JP、Inter、JetBrains Mono、KaTeX の数式書体 | SIL Open Font License ほか |

プロンプト: あなた　／　脚本・演出・プログラム: Claude
