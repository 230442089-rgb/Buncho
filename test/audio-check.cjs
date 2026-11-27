// 効果音の検査。すべての音を画面外で合成し、例外が出ないこと・無音でないこと・音割れしていないことを確かめる。
//   node test/audio-check.cjs     (Playwright の Chromium を使う)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<!doctype html><title>audio</title>');
  await p.addScriptTag({ path: path.join(__dirname, '../src/sfx.js') });
  const rows = await p.evaluate(async () => {
    const out = [];
    for (const name of TF.sfx.names()) {
      const sec = name === 'bigwin' || name === 'nuke' ? 7 : 4;
      try { const full = await TF.sfx._render(name, {}, sec), small = await TF.sfx._render(name, {}, sec, 350); out.push({ name, peak: full.peak, rms: full.rms, small: small.peak }); }
      catch (e) { out.push({ name, err: String(e) }); }
    }
    return out;
  });
  // small = 350Hz より下を切ったときの大きさ。スマホの小さなスピーカーで聞こえる成分の目安
  let bad = 0;
  console.log('音'.padEnd(8), '全帯域   スマホ想定');
  for (const r of rows) {
    const problem = r.err ? '例外: ' + r.err : (r.peak < 0.08 ? '小さすぎる' : (r.small < 0.06 ? 'スマホでは聞こえにくい' : (r.peak > 0.99 ? '音割れ' : '')));
    if (problem) bad++;
    console.log(r.name.padEnd(9), r.err ? '' : r.peak.toFixed(2).padStart(5) + '    ' + r.small.toFixed(2).padStart(5), problem ? '  ← ' + problem : '');
  }
  // BGM:各曲を12秒ぶん合成して、鳴っていること・大きすぎないことを確かめる
  const songs = await p.evaluate(async () => {
    const out = [];
    for (const s of TF.sfx.songs()) {
      try { const full = await TF.sfx._renderSong(s.id, 12), small = await TF.sfx._renderSong(s.id, 12, 350); out.push({ id: s.id, name: s.name, peak: full.peak, rms: full.rms, small: small.peak, steps: full.steps }); }
      catch (e) { out.push({ id: s.id, name: s.name, err: String(e) }); }
    }
    return out;
  });
  console.log('\nBGM      最大   平均   スマホ想定');
  for (const r of songs) {
    const problem = r.err ? '例外: ' + r.err : (r.peak < 0.05 ? '小さすぎる' : (r.small < 0.03 ? 'スマホでは聞こえにくい' : (r.peak > 0.7 ? '効果音より大きい' : '')));
    if (problem) bad++;
    console.log(r.id.padEnd(6), r.err ? '' : r.peak.toFixed(2).padStart(6) + ' ' + r.rms.toFixed(3).padStart(6) + ' ' + r.small.toFixed(2).padStart(6), ' ' + r.name, problem ? '  ← ' + problem : '');
  }
  console.log(bad ? `\n${bad} 個の音に問題があります` : `\n効果音 ${rows.length} 個と BGM ${songs.length} 曲すべてが、全帯域でもスマホ想定でも十分な大きさで出ています`);
  await b.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
