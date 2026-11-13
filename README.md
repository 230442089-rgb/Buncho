# 事象のアトリエ（ATELIER.EXE）

エデルが主人公の、weirdcore な散策ゲームです。2000年代のフリーソフトふうの窓の中で動きます。

- エデルは何も話しません。アトリエと、額縁の先の 5 つの層を歩いて、作品「無題」の素材を 7 つ集めます。
- ときどき、偏愛でおかしくなったアセラが入ってきます。そのあいだ世界の運動は奪われて止まります。
- 止まっているものは見つかりません。動くと見つかり、つかまると**強制終了**します。保存していない素材は失われます。

## あそぶ

`index.html` をブラウザで開くだけで動きます（1 ファイルに全部入っています）。

| 操作 | キーボード | タッチ |
|---|---|---|
| あるく | 方向キー / WASD | 十字ボタン |
| 決定・しらべる・スケッチ（押しつづける） | Z / Enter / Space | Ａボタン |
| メニュー | 窓の上のメニューバー | 同じ |

## つくり

```
src/page.html      デスクトップと十字ボタンの骨組み
src/style.css      窓まわりの見た目
src/js/00_core.js  調整用の数値（PRM）、保存、入力
src/js/02_gfx.js   ドット絵の道具、文字、減色ディザ
src/js/03_audio.js 音（すべてその場で合成）
src/js/04_sprites.js エデルとアセラのドット絵
src/js/05_world.js 素材、作品「無題」、部屋の描き方
src/js/06_objects.js 置いてあるもの
src/js/07_rooms.js 部屋の地図
src/js/08_asera.js アセラの動き
src/js/09_game.js  ゲーム本体
src/js/10_shell.js 窓・メニュー・強制終了の演出
tools/build.py     src/ を index.html にまとめる
```

直したら `python3 tools/build.py` で `index.html` を作り直します（フォントの埋めこみに `pip install fonttools brotli` が要ります）。
手ごたえの調整は `src/js/00_core.js` の `PRM` にまとめてあります。アドレスの最後に `#debug` を付けて開くと、F2 で来訪、F3 で視界の表示、F4 で素材が全部手に入ります。

## フォント

文字は [DotGothic16](https://github.com/fontworks-fonts/DotGothic16)（SIL Open Font License 1.1）を、16px でドットが画素にそろうように位置合わせして、使う文字だけ埋めこんでいます。ライセンスは `assets/font/OFL.txt` にあります。
