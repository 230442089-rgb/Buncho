#!/usr/bin/env node
// tools/flight_test.js — 飛行ゲームの動作確認（ヘッドレス Chromium）。
//   node tools/flight_test.js            … flight/dist/index.html を開いて、操作・コース・画面の切り替えを順に確かめる
//   ゲームの時間は __flight.step() で決まった刻みずつ進める（描画の速さに左右されない）。
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const file = path.resolve(__dirname, '../flight/dist/index.html');
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + file + '?q=low&sync&manual&fixed');
  await page.waitForFunction(() => window.__flight && (window.__flight.state === 'ready' || window.__flight.state === 'error'), null, { timeout: 180000 });
  let fail = 0;
  const ok = (name, cond, info = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!cond) fail++; };
  const ev = (f, a) => page.evaluate(f, a);
  const step = (n, draw = false) => ev(([n, draw]) => window.__flight.step(n, 1 / 60, draw), [n, draw]);
  const Y = () => ev(() => { const g = window.__flight.game, y = g.y; return { yaw: y.yaw, pitch: y.pitch, speed: y.speed, gauge: y.gauge, pos: y.pos.slice(), mode: g.mode, paused: g.paused, turnTo: y.turnTo, bumps: g.bumps, next: g.next, lights: g.lights, day: g.day }; });
  const vis = (id) => ev((id) => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length > 0; }, id);

  ok('起動する', (await ev(() => window.__flight.state)) === 'ready');
  ok('題の画面', (await vis('title')) && !(await vis('hud')));
  await step(30, true);
  ok('題の画面で見本が飛んでいる', (await Y()).mode === 'title');

  // ---- はじめる
  await page.click('#btnCourse');
  let a = await Y();
  ok('紋章めぐりが始まる', a.mode === 'course' && (await vis('hud')) && !(await vis('title')));
  ok('音の準備ができる', await ev(async () => { const s = window.__flight.sound; await s.unlock(); await new Promise((r) => setTimeout(r, 600)); return s.on && Object.keys(s.buf).length >= 9; }));

  // ---- キー
  await page.focus('#view');
  await step(10); a = await Y();
  await page.keyboard.down('ArrowRight'); await step(40); let b = await Y(); await page.keyboard.up('ArrowRight');
  ok('→ キーで右へ曲がる', b.yaw - a.yaw > 0.3, `Δyaw=${(b.yaw - a.yaw).toFixed(2)}`);
  await step(30); a = await Y();
  await page.keyboard.down('ArrowUp'); await step(50); b = await Y(); await page.keyboard.up('ArrowUp');
  ok('↑ キーで上昇する', b.pitch > 0.4 && b.pos[1] > a.pos[1] + 0.2, `pitch=${b.pitch.toFixed(2)} Δy=${(b.pos[1] - a.pos[1]).toFixed(2)}`);
  await step(90); b = await Y();
  ok('手を離すと水平に戻る', Math.abs(b.pitch) < 0.08, `pitch=${b.pitch.toFixed(3)}`);
  a = await Y();
  await page.keyboard.down('Space'); await step(60); b = await Y(); await page.keyboard.up('Space');
  ok('スペースで加速する', b.speed > a.speed + 0.8 && b.gauge < a.gauge, `speed ${a.speed.toFixed(2)}→${b.speed.toFixed(2)} gauge ${b.gauge.toFixed(2)}`);
  await step(120);

  // ---- マウス
  a = await Y();
  await page.mouse.move(900, 270); await step(40); b = await Y();
  ok('マウスを右へ寄せると右へ曲がる', b.yaw - a.yaw > 0.3, `Δyaw=${(b.yaw - a.yaw).toFixed(2)}`);
  await page.mouse.move(480, 60); await step(40); b = await Y();
  ok('マウスを上へ寄せると上昇する', b.pitch > 0.3, `pitch=${b.pitch.toFixed(2)}`);
  await page.mouse.move(480, 270); await step(60);

  // ---- タッチ（指をずらした向きへ）
  const touch = (type, id, x, y) => ev(([type, id, x, y]) => document.getElementById('view').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 11 })), [type, id, x, y]);
  a = await Y();
  await touch('pointerdown', 11, 300, 300); await touch('pointermove', 11, 240, 300); await step(40); b = await Y();
  ok('指を左へずらすと左へ曲がる', b.yaw - a.yaw < -0.3, `Δyaw=${(b.yaw - a.yaw).toFixed(2)}`);
  ok('さわった場所に目印が出る', await ev(() => +getComputedStyle(document.getElementById('stick')).opacity > 0.5 || document.getElementById('stick').style.opacity === '1'));
  const g0 = (await Y()).gauge;
  await touch('pointerdown', 12, 700, 300); await step(30); b = await Y();
  ok('2 本目の指で加速する', b.gauge < g0 - 0.02, `gauge ${g0.toFixed(2)}→${b.gauge.toFixed(2)}`);
  await touch('pointerup', 12, 700, 300); await touch('pointerup', 11, 240, 300); await step(60);
  ok('指を離すとまっすぐ', await ev(() => { const i = window.__flight.input.get(); return i.x === 0 && !i.boost; }));

  // ---- 一時停止・音・ふり向き
  await page.keyboard.press('p'); a = await Y();
  ok('P で一時停止', a.paused && (await vis('panel')));
  const p0 = a.pos.slice(); await step(30); b = await Y();
  ok('止まっているあいだは進まない', Math.abs(b.pos[2] - p0[2]) < 1e-6 && Math.abs(b.pos[0] - p0[0]) < 1e-6);
  await page.click('#segInvert button[data-v="1"]');
  await page.click('#btnResume'); a = await Y();
  ok('つづける', !a.paused && !(await vis('panel')));
  await page.keyboard.down('ArrowUp'); await step(50); b = await Y(); await page.keyboard.up('ArrowUp');
  ok('上下反転の設定が効く', b.pitch < -0.02 || b.pos[1] <= a.pos[1] + 0.01, `pitch=${b.pitch.toFixed(2)}`);
  await page.keyboard.press('p'); await page.click('#segInvert button[data-v="0"]'); await page.click('#btnResume'); await step(60);
  await page.keyboard.press('m');
  ok('M で音を切る', await ev(() => window.__flight.ui.settings.sound === false && window.__flight.sound.muted === true));
  await page.keyboard.press('m');
  await page.keyboard.press('r'); await step(20); b = await Y();
  ok('R でユリアがふり向く', b.turnTo === 1 && (await ev(() => window.__flight.game.y.turn > 0.5)));
  await step(180); b = await Y();
  ok('しばらくすると前を向く', b.turnTo === 0);

  // ---- 地形: ぶつかっても終わらない／水面より下へ行かない／世界の端で戻る
  const res = await ev(() => {
    const F = window.__flight, G = F.game, T = F.T, y = G.y; const out = {};
    // 西の岸壁へまっすぐ
    y.pos = [-6.0, 1.2, 0.0]; y.yaw = -Math.PI / 2; y.pitch = 0; y.speed = 3.5; G.prev = y.pos.slice(); const b0 = G.bumps; let minC = 9, nan = false;
    for (let i = 0; i < 240; i++) { G.auto = false; F.input.keys.clear(); G.update(1 / 60); const c = y.pos[1] - T.surfaceAt(y.pos[0], y.pos[2]); if (c < minC) minC = c; if (!isFinite(y.pos[0] + y.pos[1] + y.pos[2] + y.yaw + y.pitch)) nan = true; }
    out.wall = { bumps: G.bumps - b0, minC, nan, mode: G.mode };
    // 湖へ急降下
    y.pos = [0, 1.0, 40]; y.yaw = 0; y.pitch = -0.9; G.prev = y.pos.slice(); F.input.keys.add('ArrowDown'); let minW = 9;
    for (let i = 0; i < 200; i++) { G.update(1 / 60); minW = Math.min(minW, y.pos[1] - (-0.02)); }
    F.input.keys.clear(); out.water = { minW, ripples: F.R.ripN };
    // 世界の外へ
    y.pos = [90, 3, 30]; y.yaw = Math.PI / 2; y.pitch = 0; G.prev = y.pos.slice();
    for (let i = 0; i < 600; i++) G.update(1 / 60);
    out.edge = { x: y.pos[0], yaw: y.yaw };
    // 天井
    y.pos = [0, 7.5, 40]; y.yaw = 0; F.input.keys.add('ArrowUp'); let maxY = 0;
    for (let i = 0; i < 400; i++) { G.update(1 / 60); maxY = Math.max(maxY, y.pos[1]); }
    F.input.keys.clear(); out.ceil = { maxY };
    return out;
  });
  ok('岸壁に当たっても続く', res.wall.mode === 'course' && !res.wall.nan && res.wall.minC > 0.02, JSON.stringify(res.wall));
  ok('水面より下へ行かない', res.water.minW > 0.02 && res.water.ripples > 0, JSON.stringify(res.water));
  ok('世界の端で向きが戻る', res.edge.x < 110, JSON.stringify(res.edge));
  ok('雲の下で止まる', res.ceil.maxY <= 8.31, JSON.stringify(res.ceil));

  // ---- コースを最後まで（自動操縦）→ 結果 → もういちど
  await page.keyboard.press('p'); await page.click('#btnRetry');
  const run = await ev(() => { const F = window.__flight, G = F.game; G.auto = true; G.started = true; let t = 0; while (G.mode === 'course' && t < 400) { G.update(1 / 60); t += 1 / 60; } for (let i = 0; i < 240; i++) G.update(1 / 60); G.auto = false; return { mode: G.mode, time: G.time, next: G.next, lights: G.lights, bumps: G.bumps, shown: G.finShown, day: G.day }; });
  ok('自動操縦で 12 の輪をくぐりきる', run.mode === 'finish' && run.next === 12, JSON.stringify(run));
  ok('ぶつからずに飛べる道になっている', run.bumps === 0);
  ok('夜になっている', run.day > 0.97);
  await step(1, true);
  ok('結果が出る', (await vis('result')) && /\d:\d\d\.\d/.test(await ev(() => document.getElementById('rTime').textContent)));
  ok('12 の紋章がそろう', await ev(() => window.__flight.game.course.gates.every((g) => g.passed)));
  await page.click('#btnAgain'); a = await Y();
  ok('もういちど', a.mode === 'course' && a.next === 0 && !(await vis('result')));

  // ---- おさんぽ
  await page.keyboard.press('p'); await page.click('#btnQuit');
  ok('題にもどる', (await Y()).mode === 'title' && (await vis('title')));
  await page.click('#btnFree'); a = await Y();
  ok('おさんぽが始まる', a.mode === 'free' && (await vis('freeBar')));
  await ev(() => { const r = document.getElementById('dayRange'); r.value = 95; r.dispatchEvent(new Event('input', { bubbles: true })); });
  await step(200); b = await Y();
  ok('時刻を動かすと夜になる', b.day > 0.9, `day=${b.day.toFixed(2)}`);

  // ---- 画質の切りかえ（描き直しても壊れない）
  await page.keyboard.press('p');
  await page.click('#segQuality button[data-v="high"]'); await page.click('#btnResume'); await step(2, true);
  ok('画質「きれい」に切りかわる', await ev(() => window.__flight.R.quality === 'high'));
  await page.keyboard.press('p'); await page.click('#segQuality button[data-v="auto"]'); await page.click('#btnResume'); await step(2, true);

  ok('ページのエラーなし', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ev(() => { try { localStorage.removeItem('yuria-sky:v1'); } catch (e) { /* なし */ } });
  await browser.close();
  console.log(fail ? `\n${fail} 件の失敗` : '\nすべて通った');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
