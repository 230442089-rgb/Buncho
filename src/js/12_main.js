// ───────── 起動 ─────────
function bootAll() {
  Store.load();
  Input.setKeys(Store.d.opt.keys);
  buildSprites();
  Shell.init();
  Game.run();
  Shell.launch(null, true);   // 開いたら、そのままソフトが立ち上がる。音は最初の操作から。
  if (DEBUG) window.ATL = { Game, Asera, Shell, Store, Snd, PRM, Input, World, Picture, BIOMES, Sprites };
}
const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('16px AtelierDot', '事象のアトリエ').catch(() => {}) : Promise.resolve();
Promise.race([fontReady, wait(2500)]).then(() => { Text.clear(); bootAll(); });
