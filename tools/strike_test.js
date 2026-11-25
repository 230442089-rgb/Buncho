#!/usr/bin/env node
// tools/strike_test.js — 迎撃ゲーム「B.U.N 襲来」の動作確認（ヘッドレス Chromium）。
//   node tools/strike_test.js            … strike/dist/index.html を開いて、操作・当たり・旗艦・画面の切り替えを順に確かめる
//   ゲームの時間は __flight.step() で決まった刻みずつ進める（描画の速さに左右されない）。
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const file = path.resolve(process.env.FLIGHT_FILE || path.join(__dirname, '../strike/dist/index.html'));      // FLIGHT_FILE=… で別のビルドを試せる
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const W = 960, H = 540;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + file + '?q=low&sync&manual&fixed');
  await page.waitForFunction(() => window.__flight && (window.__flight.state === 'ready' || window.__flight.state === 'error'), null, { timeout: 180000 });
  let fail = 0;
  const ok = (name, cond, info = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!cond) fail++; };
  const ev = (f, a) => page.evaluate(f, a);
  const step = (n, draw = false) => ev(([n, draw]) => window.__flight.step(n, 1 / 60, draw), [n, draw]);
  const S = () => ev(() => { const G = window.__flight.game, P = G.P; return { mode: G.mode, paused: G.paused, tm: G.tm, nx: P.nx, ny: P.ny, tx: P.tx, ty: P.ty, shield: P.shield, lance: P.lance, lanceT: P.lanceT, waves: P.waves, bul: G.bul.length, en: G.en.length, kills: G.kills, hits: G.hits, routed: G.routed, score: G.score, cont: G.cont, orbit: G.orbit, boss: G.boss ? { t: G.boss.t, z: G.boss.z, phase: G.boss.phase, hp: G.bossHP() } : null, turn: P.turnTo, shots: G.shots.length, U: G.U }; });
  const vis = (id) => ev((id) => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length > 0; }, id);
  const clear = () => ev(() => { const G = window.__flight.game; G.en.length = 0; G.bul.length = 0; G.shots.length = 0; G.P.shield = 5; G.P.inv = 0; });
  const orbs = () => ev(() => window.__flight.game.bul.filter((u) => u.kind === 'orb').length);
  const f2 = (v) => v.toFixed(3);

  ok('起動する', (await ev(() => window.__flight.state)) === 'ready');
  ok('題の画面', (await vis('title')) && !(await vis('hud')));
  await step(60 * 9, false); await step(1, true);
  let a = await S();
  ok('題の画面で、見本の戦いが進んでいる', a.mode === 'title' && a.kills > 0 && a.shield === 5, `kills=${a.kills}`);
  await page.click('#btnHow');
  await ev(() => { const G = window.__flight.game; G.reset('title'); });                  // 見本が一巡して最初に戻る
  ok('題の画面で開いた「あそびかた・設定」は、見本が一巡しても閉じない', await vis('panel'));
  await page.click('#btnResume');
  ok('「とじる」で閉じる', !(await vis('panel')) && (await vis('title')));

  // ---- 3D モデル
  const models = await ev(() => Object.keys(window.__flight.figs.models));
  ok('3D モデルが読みこまれている', ['yuria', 'yuria_lo', 'buncho', 'buncho_lo', 'buncho_far', 'jetpack', 'bazooka', 'gatling', 'chute', 'round', 'slug', 'bullet', 'rocket', 'missile', 'mine', 'gem', 'arrow'].every((n) => models.includes(n)) && (await ev(() => window.__flight.cast.ok)), `${models.length} 種`);
  const names = () => ev(() => window.__flight.figs.queue.map((q) => q.pose.m.h.name));
  await step(1, true); let fg = await names();
  ok('題の画面に、3D のユリアがいる（手前の大きな姿と、見本のうしろ姿）', fg.includes('yuria') && fg.includes('yuria_lo'), fg.join(' '));
  const nan = await ev(() => { const F = window.__flight, p = F.figs.pose('yuria'); let bad = 0; for (const o of [{ t: 1.3 }, { t: 2, sway: 1, power: 1, aim: [-0.5, 0.4, 0.76] }, { t: 3, turn: 1, wave: 1 }, { t: 4, turn: 0.5, hurt: 1, thrust: 1, aim: [0, 0, 1] }]) { F.poseYuria(p, o).update(); for (const v of p.skin) if (!Number.isFinite(v)) bad++; } return bad; });
  ok('ユリアの姿勢は、どの場面でも数として壊れない', nan === 0, `壊れた数 ${nan}`);
  await page.click('#btnGallery'); await step(3, true);
  let gl0 = await ev(() => ({ mode: window.__flight.game.mode, name: document.getElementById('galName').textContent, count: document.getElementById('galCount').textContent, yaw: window.__flight.game.gal.yaw }));
  ok('「3D モデルを見る」で、鑑賞の画面になる', gl0.mode === 'gallery' && (await vis('gallery')) && !(await vis('title')) && gl0.name.includes('ユリア') && gl0.count === '1 / 8', JSON.stringify(gl0));
  const seen = [], drawn = [];
  for (let i = 0; i < 8; i++) { await step(2, true); seen.push(await ev(() => document.getElementById('galName').textContent)); drawn.push(await names()); await page.click('#btnGalNext'); }
  await step(2, true);
  ok('8 つのモデルを順に見られる（一巡して最初にもどる）', new Set(seen).size === 8 && drawn.every((d) => d.length > 0) && drawn[2].includes('buncho') && drawn[4].includes('gatling') && drawn[6].includes('chute') && drawn[7].includes('missile') && (await ev(() => window.__flight.game.gal.i)) === 0, seen.join('・'));
  await page.mouse.move(W * 0.5, H * 0.5); await page.mouse.down(); await page.mouse.move(W * 0.5 + 120, H * 0.5, { steps: 4 }); await page.mouse.up();
  const gl1 = await ev(() => window.__flight.game.gal.yaw);
  ok('ドラッグで回せる', Math.abs(gl1 - 0.45 - 120 * 0.012) < 0.2, `yaw ${f2(gl1)}`);
  await page.click('#btnGalBack'); await step(3, true);
  ok('題にもどれる', (await S()).mode === 'title' && (await vis('title')) && !(await vis('gallery')));

  // ---- はじめる
  await page.click('#btnStart');
  a = await S();
  ok('出撃すると戦闘が始まる', a.mode === 'play' && (await vis('hud')) && !(await vis('title')) && a.kills === 0);
  // ここからしばらくは、台本の敵と旗艦を止めて、ひとつずつ確かめる
  const bossAt = await ev(() => { const G = window.__flight.game, t = G.bossAt; G.si = 999; G.bossAt = 1e9; return t; });
  ok('音の準備ができる（曲 2 本・風・効果音）', await ev(async () => { const s = window.__flight.sound; await s.unlock(); await new Promise((r) => setTimeout(r, 900)); return s.on && Object.keys(s.buf).length >= 20 && !!s.tr.music && !!s.tr.boss; }));

  // ---- マウス: ユリアがポインタについてくる（視点は動かない）
  await page.focus('#view');
  const cam0 = await ev(() => window.__flight.game.fdir.slice());
  await page.mouse.move(W * 0.75, H * 0.35); await step(30);
  a = await S();
  ok('マウスの位置へユリアが来る', Math.abs(a.nx - 0.5) < 0.02 && Math.abs(a.ny - 0.3) < 0.02, `n=(${f2(a.nx)}, ${f2(a.ny)})`);
  await page.mouse.move(W * 0.2, H * 0.8); await step(30);
  const cam1 = await ev(() => window.__flight.game.fdir.slice());
  // 1 秒で道なりに向きが変わるぶん（わずか）しか動かない。操作では視点が動かないことの確認
  ok('操作しても視点は動かない', Math.hypot(cam1[0] - cam0[0], cam1[1] - cam0[1], cam1[2] - cam0[2]) < 0.12, `Δ=${Math.hypot(cam1[0] - cam0[0], cam1[1] - cam0[1], cam1[2] - cam0[2]).toFixed(3)}`);

  // ---- キー
  await page.keyboard.down('ArrowRight'); await step(2); a = await S(); await step(30); let b = await S(); await page.keyboard.up('ArrowRight');
  const fast = (b.tx - a.tx) * 0.762;                                                 // 世界の単位での動き（画面の半分の幅 = 0.762）
  ok('→ キーで右へ動く', b.tx - a.tx > 0.4, `Δ=${f2(b.tx - a.tx)}`);
  await page.keyboard.down('Shift'); await page.keyboard.down('ArrowUp'); await step(2); a = await S(); await step(30); let c = await S(); await page.keyboard.up('ArrowUp'); await page.keyboard.up('Shift');
  const slow = (c.ty - a.ty) * 0.4286;
  ok('Shift でゆっくり動く', slow > 0.1 && slow < fast * 0.6, `ふつう ${f2(fast)} / ゆっくり ${f2(slow)}`);

  // ---- タッチ: 指をすべらせたぶんだけ動く（画面の上で同じ距離）
  const touch = (type, id, x, y) => ev(([type, id, x, y]) => document.getElementById('view').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: true })), [type, id, x, y]);
  await ev(() => { const P = window.__flight.game.P; P.tx = P.nx = 0; P.ty = P.ny = -0.3; });
  await touch('pointerdown', 11, 300, 400); await step(2); a = await S();
  await touch('pointermove', 11, 396, 346); await step(20); b = await S();
  ok('指を右へ 96px・上へ 54px すべらせると、ユリアも同じだけ動く', Math.abs((b.nx - a.nx) * W / 2 - 96) < 3 && Math.abs((b.ny - a.ny) * H / 2 - 54) < 3, `Δ=(${((b.nx - a.nx) * W / 2).toFixed(1)}px, ${((b.ny - a.ny) * H / 2).toFixed(1)}px)`);
  await step(30); c = await S();
  ok('指を止めると、ユリアも止まる', Math.abs(c.nx - b.nx) < 0.004 && Math.abs(c.ny - b.ny) < 0.004);
  await touch('pointerup', 11, 396, 346);
  await touch('pointerdown', 12, 700, 200); await step(2); c = await S();
  ok('さわり直しても、ユリアは飛ばない（さわった場所へ動かない）', Math.abs(c.nx - b.nx) < 0.004 && Math.abs(c.ny - b.ny) < 0.004);
  await ev(() => { window.__flight.ui.set('sens', 1.35); });
  a = await S(); await touch('pointermove', 12, 600, 200); await step(20); b = await S(); await touch('pointerup', 12, 600, 200);
  ok('感度の設定が効く（きびん = 1.35 倍）', Math.abs((b.nx - a.nx) * W / 2 + 135) < 4, `Δx=${((b.nx - a.nx) * W / 2).toFixed(1)}px`);
  ok('設定が保存される', await ev(() => JSON.parse(localStorage.getItem('yuria-strike:v1')).sens === 1.35));
  await ev(() => { window.__flight.ui.set('sens', 1); });

  // ---- 光の矢: ねらいの近くの敵へ飛んでいって落とす
  await clear();
  await ev(() => { const G = window.__flight.game; G.P.tx = G.P.nx = 0; G.P.ty = G.P.ny = -0.3; G.input.useMouse = false; G.spawn('trooper', 'hover', { from: [0.3, 0.2], at: [0.3, 0.2], z: 6.5, hold: 30, strafe: 0 }); });
  const k0 = (await S()).kills; let locked = false, shot = false;
  for (let i = 0; i < 12 && !(locked && shot); i++) { await step(10); const q = await S(); shot = shot || q.shots > 0; locked = locked || (await ev(() => !!window.__flight.game.lock)); }
  a = await S(); a.kills = k0;
  ok('近くの敵をつかまえて撃つ', locked && shot);
  await step(200); b = await S();
  ok('敵を落とすと、文鳥は脱出する（帰した数が増える）', b.kills === a.kills + 1 && b.routed === a.routed + 1 && b.en === 0, `kills ${a.kills}→${b.kills}`);
  await ev(() => { const G = window.__flight.game; G.spawn('trooper', 'hover', { from: [-0.8, 0.6], at: [-0.8, 0.6], z: 6.5, hold: 30, strafe: 0 }); });
  await step(150); c = await S();
  ok('遠くの敵は撃てない（近づく必要がある）', c.kills === b.kills && !(await ev(() => !!window.__flight.game.lock)));

  // ---- 弾と赤い印: 止まっていると当たる。印の外へ出れば当たらない
  await clear();
  const fireAt = () => ev(() => { const G = window.__flight.game; const e = { X: 0.5, Y: 1.2, z: 8 }; G.bullet({ from: e, speed: 8 }); const u = G.bul[G.bul.length - 1]; return { X: u.X + u.vX * 1, Y: u.Y + u.vY * 1, hit: u.hit }; });
  await ev(() => { const G = window.__flight.game; G.P.inv = 0; });
  a = await S(); await fireAt(); await step(75); b = await S();
  ok('弾が着く場所にいると、まもりが 1 つ減る', b.shield === a.shield - 1 && b.hits === a.hits + 1);
  await ev(() => { const G = window.__flight.game; G.P.inv = 0; });
  await fireAt(); await step(20);
  await ev(() => { const G = window.__flight.game; G.P.tx += 0.2; }); await step(55); c = await S();
  ok('赤い印の外へ出れば当たらない', c.shield === b.shield && c.bul === 0);

  // ---- 波: 弾を消し、機械を止める（文鳥が身につけた武器は止まらない）
  await clear();
  await ev(() => { const G = window.__flight.game; G.P.inv = 0; G.spawn('drone', 'pass', { from: [0.2, 0.3], to: [0.2, 0.3], z0: 30, speed: 2 }); G.spawn('trooper', 'hover', { from: [-0.8, 0.7], at: [-0.8, 0.7], z: 6.5, hold: 30, strafe: 0 }); G.noFire = true; });
  await step(100); for (let i = 0; i < 5; i++) await fireAt();
  a = await S(); const o0 = await orbs(); await page.keyboard.press('x'); await step(3); b = await S(); const o1 = await orbs();
  const st = await ev(() => window.__flight.game.en.map((e) => [e.type, e.stun > 0]));
  ok('X で波: 弾が消える', o0 >= 5 && o1 === 0 && b.waves === a.waves - 1, `弾 ${o0}→${o1}`);
  ok('波で機械は止まり、文鳥は止まらない', st.some(([t, s]) => t === 'drone' && s) && st.some(([t, s]) => t === 'trooper' && !s), JSON.stringify(st));
  await step(70);
  await page.dispatchEvent('#btnWave', 'pointerdown', { pointerId: 5, pointerType: 'touch', isPrimary: true }); await page.dispatchEvent('#btnWave', 'pointerup', { pointerId: 5, pointerType: 'touch' }); await step(5); c = await S();
  ok('波のボタンでも使える', c.waves === b.waves - 1);

  // ---- 槍: たまったら放てる。通り道の敵をまとめて落とす
  await clear();
  await ev(() => { const G = window.__flight.game; G.noFire = false; G.P.tx = G.P.nx = 0; G.P.ty = G.P.ny = -0.3; G.P.lance = 0.2; for (const x of [-0.12, 0.12]) G.spawn('gunner', 'hover', { from: [x, 0.05], at: [x, 0.05], z: 6.5, hold: 30, strafe: 0 }); G.P.fireT = 99; });
  await step(90); await page.keyboard.down('z'); await step(10); a = await S();
  ok('たまっていない槍は放てない', a.lanceT <= 0);
  await ev(() => { window.__flight.game.P.lance = 1; }); await step(4); b = await S();
  ok('Z で槍を放つ', b.lanceT > 0 && b.lance < 0.1);
  await step(100); await page.keyboard.up('z'); c = await S();
  ok('槍は、つかまえた相手を次々に落とす', c.kills >= a.kills + 2, `kills ${a.kills}→${c.kills}`);
  await ev(() => { const G = window.__flight.game; G.P.lance = 1; G.P.lanceT = 0; G.spawn('gunner', 'hover', { from: [0, 0.05], at: [0, 0.05], z: 6.5, hold: 30, strafe: 0 }); G.P.fireT = 99; });
  await step(90); await page.dispatchEvent('#btnLance', 'pointerdown', { pointerId: 6, pointerType: 'touch', isPrimary: true }); await step(4); b = await S(); await page.dispatchEvent('#btnLance', 'pointerup', { pointerId: 6, pointerType: 'touch' });
  ok('槍のボタンでも放てる', b.lanceT > 0);
  await step(120);
  await ev(() => { const G = window.__flight.game; G.P.lance = 1; G.P.lanceT = 0; G.spawn('gunner', 'hover', { from: [0, 0.05], at: [0, 0.05], z: 6.5, hold: 30, strafe: 0 }); G.P.fireT = 99; });
  await step(90); await page.dispatchEvent('#btnLance', 'pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true }); await page.dispatchEvent('#btnLance', 'pointerup', { pointerId: 7, pointerType: 'touch' }); await step(4); b = await S();
  ok('槍のボタンを一瞬だけ押しても放てる', b.lanceT > 0);
  await step(120);

  // ---- 一時停止
  await clear();
  await page.keyboard.press('p'); await step(5); a = await S();
  ok('P で一時停止（板が出る）', a.paused && (await vis('panel')));
  await step(60); b = await S();
  ok('止まっているあいだ、戦いは進まない', b.tm === a.tm);
  await page.click('#btnResume'); await step(5); b = await S();
  ok('つづける', !b.paused && !(await vis('panel')));
  await ev(() => window.dispatchEvent(new Event('blur'))); a = await S();
  ok('画面を離れると自動で止まる', a.paused);
  await page.click('#btnResume');

  // ---- 力つきる → その場から続ける
  await ev(() => { const G = window.__flight.game; G.P.shield = 1; G.P.inv = 0; G.damage(); });
  await step(10); a = await S();
  ok('まもりが尽きると、続けるかどうかの板が出る', a.mode === 'down' && (await vis('down')));
  await page.click('#btnContinue'); await step(5); b = await S();
  ok('その場から続けられる（まもりは元にもどる）', b.mode === 'play' && b.shield === 5 && b.cont === 1 && !(await vis('down')));

  // ---- 画面の座標: 画面の決まった場所に置いた敵は、道が曲がっていても、そこに見える
  const proj = () => ev(() => {
    const F = window.__flight, G = F.game; G.en.length = 0;
    const e = G.spawn('drone', 'hover', { from: [0.5, 0.2], at: [0.5, 0.2], z: 10, hold: 99, strafe: 0 }); e.t = 5; e.ph = 0;
    F.step(2, 1 / 60, true);
    const w = e.w, V = F.R.VP, cx = V[0] * w[0] + V[4] * w[1] + V[8] * w[2] + V[12], cy = V[1] * w[0] + V[5] * w[1] + V[9] * w[2] + V[13], cw = V[3] * w[0] + V[7] * w[1] + V[11] * w[2] + V[15];
    G.en.length = 0; return [cx / cw, cy / cw, e.lift];
  });
  let pr = await proj();
  ok('画面の (0.5, 0.2) に置いた敵が、そこに見える', Math.abs(pr[0] - 0.5) < 0.03 && Math.abs(pr[1] - (0.2 + 0.2 * Math.sin(0)) ) < 0.2, `ndc=(${f2(pr[0])}, ${f2(pr[1])}) lift=${f2(pr[2])}`);

  // ---- 旗艦: 道が湖の周回に入ると現れ、湖のまん中を向いたまま回る
  await ev(() => { const G = window.__flight.game; G.auto = true; G.noFire = true; });
  const until = (cond, maxSec) => ev(([c, maxSec]) => { const F = window.__flight, G = F.game, f = new Function('G', 'return ' + c); let n = 0; while (!f(G) && n < maxSec * 30) { F.step(1, 1 / 30, false); n++; if (G.mode === 'down') G.resume(); } return n / 30; }, [cond, maxSec]);
  await ev((t) => { const G = window.__flight.game; G.bossAt = t; G.tm = G.bossAt - 5; G.s = 0.5 + 1.8 * G.tm; G.si = 999; G.setFrame(0, true); }, bossAt);
  await until('G.warned', 5); await step(2, true);
  ok('旗艦が近づくと警報が出る', await vis('warn'));
  await until('G.boss && G.boss.t > 6.5', 20); await step(2, true); a = await S();
  ok('旗艦が現れる（決戦）', a.mode === 'boss' && (await vis('boss')) && a.boss.hp === 1);
  const c0 = await ev(() => { const G = window.__flight.game, F = G.fr, c = G.rail.loopCenter, d = [c[0] - F.p[0], c[1] - F.p[2]], l = Math.hypot(d[0], d[1]); return { dot: (F.f[0] * d[0] + F.f[2] * d[1]) / l, D: l, z: G.boss.z }; });
  ok('湖のまん中を向いて回っている', a.orbit === 1 && c0.dot > 0.995, `dot=${c0.dot.toFixed(4)}`);
  ok('旗艦は湖のまん中あたりにいる', Math.abs(c0.z - c0.D) < 1.5, `z=${c0.z.toFixed(1)} D=${c0.D.toFixed(1)}`);
  pr = await proj();
  ok('回っているあいだも、画面の座標はずれない', Math.abs(pr[0] - 0.5) < 0.03, `ndc.x=${f2(pr[0])}`);

  // ---- 主砲: 赤い輪の中にいると当たる
  await ev(() => { const G = window.__flight.game; G.auto = false; G.bul.length = 0; G.P.inv = 0; G.boss.parts.forEach((p) => { p.ft = 99; }); G.boss.cannon = { st: 'charge', t: 0.3, X: G.P.X, Y: G.P.Y }; });
  a = await S(); await step(40); b = await S();
  ok('主砲の輪の中にいると当たる', b.shield === a.shield - 1);
  await ev(() => { const G = window.__flight.game; G.P.inv = 0; G.boss.parts.forEach((p) => { p.ft = 99; }); G.boss.cannon = { st: 'charge', t: 0.3, X: G.P.X + 0.4 * G.U, Y: G.P.Y }; });
  await step(80); c = await S();
  ok('輪の外にいれば当たらない', c.shield === b.shield);

  // ---- 砲塔をすべて落とすと芯が出る → 芯を落とすと竜の決め技 → 結果
  await ev(() => { const G = window.__flight.game; G.noFire = false; G.auto = true; });
  a = await S();
  await ev(() => { const G = window.__flight.game; G.hurt(G.boss.parts[7], 50); });
  ok('装甲があるうちは、芯に効かない', (await S()).boss.hp === a.boss.hp);
  const t1 = await until('G.boss.phase === 2', 90); b = await S();
  ok('砲塔をすべて落とすと、芯がむき出しになる', b.boss.phase === 2, `${t1.toFixed(0)} 秒`);
  const t2 = await until('G.fin', 120); c = await S();
  ok('芯を落とすと決め技が始まる', c.mode === 'fin', `${t2.toFixed(0)} 秒`);
  await until('G.fin.t > 3', 10); await step(2, true);
  ok('決め技のあいだは、もう当たらない', await ev(() => { const G = window.__flight.game, s = G.P.shield; G.P.inv = 0; G.damage(); return G.P.shield === s; }));
  await until('G.mode === "result"', 20); await step(2, true); a = await S();
  ok('結果が出る', a.mode === 'result' && (await vis('result')) && a.turn === 1);
  const res = await ev(() => ({ rank: document.getElementById('rRank').textContent, score: document.getElementById('rScore').textContent, routed: document.getElementById('rRouted').textContent, best: JSON.parse(localStorage.getItem('yuria-strike:v1')).best }));
  ok('旗艦の文鳥たちも、みんな脱出している', a.routed >= 17, `帰した文鳥 ${a.routed}`);
  ok('評価と得点が出て、いちばんの得点が保存される', /^[SAB]$/.test(res.rank) && res.best > 10000 && res.best <= a.score, JSON.stringify(res));

  // ---- 題にもどる・もういちど
  await page.click('#btnHome'); await step(5); a = await S();
  ok('題にもどる', a.mode === 'title' && (await vis('title')) && !(await vis('result')));
  await page.keyboard.press('Enter'); await step(5); a = await S();
  ok('Enter でも出撃できる', a.mode === 'play' && a.score === 0 && a.shield === 5);

  // ---- 通し: 自動操縦で、はじめから結果まで（道中の台本ぜんぶ）
  await ev(() => { const G = window.__flight.game; G.auto = true; });
  const t3 = await until('G.mode === "result"', 400); await step(2, true); a = await S();
  ok('はじめから結果まで通る', a.mode === 'result' && a.kills >= 60, `${t3.toFixed(0)} 秒・落とした数 ${a.kills}・帰した文鳥 ${a.routed}・受けた数 ${a.hits}`);

  // ---- 戦いの中の 3D モデル（文鳥・装備・弾）
  await page.click('#btnHome'); await step(5); await page.keyboard.press('Enter'); await step(5);
  await ev(() => { const G = window.__flight.game; G.si = 999; G.bossAt = 1e9; G.P.inv = 1e9; G.P.fireT = 99; G.spawn('gunner', 'hover', { from: [0.35, 0.25], at: [0.35, 0.25], z: 6.0, hold: 30, strafe: 0 }); G.spawn('trooper', 'hover', { from: [-0.5, 0.35], at: [-0.5, 0.35], z: 6.5, hold: 30, strafe: 0 }); });
  await until('G.bul.some((u) => u.kind === "needle") && G.bul.some((u) => u.kind === "shell")', 12); await step(1, true); fg = await names();
  ok('文鳥と装備と弾が、3D で描かれている', ['yuria_lo', 'buncho_lo', 'jetpack_lo', 'bazooka_lo', 'gatling_lo', 'bullet', 'rocket'].every((n) => fg.includes(n)), [...new Set(fg)].join(' '));
  const tip = await ev(() => { const G = window.__flight.game, a = G.tipL(); G.P.power = 1; const b = G.tipL(), d = G.lanceDir(), A = G.aimL(), g = G.gripL(), l = Math.hypot(A[0] - g[0], A[1] - g[1], A[2] - g[2]); G.P.power = 0; return { a, b, dot: (d[0] * (A[0] - g[0]) + d[1] * (A[1] - g[1]) + d[2] * (A[2] - g[2])) / l }; });
  ok('槍はふだん右ななめ前を向き、放つときは、ねらいの先を向く', tip.a.every(Number.isFinite) && tip.a[2] > 0.05 && tip.a[0] > tip.b[0] + 0.03 && tip.dot > 0.999, `ふだん (${tip.a.map(f2)}) 放つとき (${tip.b.map(f2)}) dot=${tip.dot.toFixed(4)}`);
  await ev(() => { const G = window.__flight.game; for (const e of G.en) G.kill(e); });
  await until('G.fly.some((f) => f.age > 1.5)', 6); await step(1, true); fg = await names();
  ok('落とされた文鳥は、3D の落下傘で降りていく', fg.includes('buncho_far') && fg.includes('chute'), [...new Set(fg)].join(' '));

  ok('エラーが出ていない', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fail ? `\n${fail} 件の失敗` : '\nすべて通った');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
