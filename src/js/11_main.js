// ───────── 起動 ─────────
function bootAll() {
  Store.load();
  buildSprites();
  Shell.init();
  Game.run();
  Shell.launch(true);   // 開いたときからタイトル画面が見えるようにしておく。音は最初の操作から。
  if (DEBUG) window.ATL = { Game, Asera, Shell, Store, Snd, PRM, Input, ROOMS, Picture };
}
const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('16px AtelierDot', '事象のアトリエ').catch(() => {}) : Promise.resolve();
Promise.race([fontReady, wait(2500)]).then(() => { Text.clear(); bootAll(); });
