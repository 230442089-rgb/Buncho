// scenes.js — timeline, subtitles, effects, transitions. Entry point: window.renderFrame(t)
const W = 1080, H = 1920;

// ------------------------------------------------------------------ dialogue
// who: yuria / vol / sleep (vol talking in her sleep)
const SUBS = [
  // S1 station (0-13)
  { t0: 3.2, t1: 5.0, who: 'yuria', text: 'ヴォルー！　おまたせっ！' },
  { t0: 5.3, t1: 7.3, who: 'yuria', text: '……てか、何分前からいたの？' },
  { t0: 7.5, t1: 9.4, who: 'vol', text: '三十分ほど前から♡' },
  { t0: 9.5, t1: 10.6, who: 'yuria', text: 'はやっ！' },
  { t0: 10.8, t1: 13.1, who: 'vol', text: 'はい、ゆり姉の分です。\nちょうど飲みごろですよ♡' },
  // S2 street (13-24.5)
  { t0: 15.0, t1: 16.9, who: 'yuria', text: 'ん。手、つなご♡' },
  { t0: 17.2, t1: 19.5, who: 'vol', text: '……つなぐだけ、ですか？' },
  { t0: 19.8, t1: 21.6, who: 'yuria', text: '……じゃ、こう♡' },
  // S3 crepe (24.5-36.5)
  { t0: 26.9, t1: 28.4, who: 'yuria', text: 'ん〜っ、うまっ♡' },
  { t0: 28.7, t1: 30.5, who: 'vol', text: 'ゆり姉、ついてますよ' },
  { t0: 30.6, t1: 31.7, who: 'yuria', text: 'え、どこ？' },
  { t0: 32.7, t1: 34.6, who: 'vol', text: '……ふふ。甘いですね♡' },
  { t0: 34.7, t1: 36.6, who: 'yuria', text: 'ちょ……それ、ずるいって♡' },
  // S4 park (36.5-48)
  { t0: 41.0, t1: 42.6, who: 'yuria', text: '気をつけてねー！' },
  { t0: 42.9, t1: 45.3, who: 'vol', text: '……ゆり姉。\n今の、もう一回見たいです♡' },
  { t0: 45.5, t1: 47.2, who: 'yuria', text: 'う〜ん、やだ♡' },
  // S5 gondola (53-67)
  { t0: 55.6, t1: 57.1, who: 'yuria', text: '……ねえ、ヴォル' },
  { t0: 57.3, t1: 59.0, who: 'yuria', text: '今日、楽しかった？' },
  { t0: 59.3, t1: 62.0, who: 'vol', text: 'はい。\n……でも、まだ帰りたくないです' },
  { t0: 62.2, t1: 63.6, who: 'yuria', text: '……あーしも♡' },
  // S6 train (67-79)
  { t0: 70.0, t1: 72.2, who: 'sleep', text: '……ゆり、ねぇ……♡', pos: 'top' },
  { t0: 72.6, t1: 74.6, who: 'yuria', text: '……寝顔、かわいすぎ', pos: 'top' },
  { t0: 76.2, t1: 78.6, who: 'yuria', text: 'また来よーね。……ヴォル♡', pos: 'top' },
];
const CHIPS = [
  { t0: 0.5, t1: 3.4, text: '星見駅前　10:00 待ち合わせ' },
  { t0: 13.9, t1: 16.6, text: 'AM 10:40　商店街' },
  { t0: 25.3, t1: 28.0, text: 'PM 1:20　クレープ屋さん' },
  { t0: 37.3, t1: 40.0, text: 'PM 3:30　星見公園' },
  { t0: 48.6, t1: 52.4, text: 'PM 5:02　観覧車' },
  { t0: 68.2, t1: 71.0, text: 'PM 7:48　帰りの電車', y: 236 },
];

function speaking(t, who) {
  for (const s of SUBS) if (s.who === who && t >= s.t0 + 0.05 && t <= s.t1 - 0.25) return true;
  return false;
}
// mouth flaps while a line is on screen
function talk(t, who, base = 'smile', open = 'open') {
  if (!speaking(t, who)) return base;
  const k = Math.floor(t * 9);
  return U.hash(k + (who === 'vol' ? 50 : 0)) > 0.45 ? open : base;
}

function textWidth(str, fs) {
  let w = 0;
  for (const ch of str) w += /[\x00-\x7F]/.test(ch) ? 0.58 : 1.0;
  return w * fs;
}

function subtitleSVG(t) {
  let out = '';
  for (const sub of SUBS) {
    if (t < sub.t0 || t > sub.t1) continue;
    const pin = U.inv(sub.t0, sub.t0 + 0.2, t), pout = 1 - U.inv(sub.t1 - 0.18, sub.t1, t);
    const a = Math.min(pin, pout);
    const sc = 0.86 + 0.14 * U.ease.outBack(pin);
    const lines = sub.text.split('\n');
    const sleep = sub.who === 'sleep';
    const fs = sleep ? 44 : 50;
    const tw = Math.max(...lines.map(l => textWidth(l, fs)));
    const bw = Math.max(360, tw + 110), lh = fs * 1.42, bh = lines.length * lh + 58;
    const by = (sub.pos === 'top' ? 640 : 1665) - bh / 2;
    const col = sub.who === 'yuria' ? '#F0AE34' : '#79AEE0';
    const name = sub.who === 'yuria' ? 'ユリア' : 'ヴォル';
    let g = '';
    g += `<rect x="${-bw / 2}" y="${-bh / 2 + 6}" width="${bw}" height="${bh}" rx="38" fill="#5A4A8A" opacity=".18"/>`;
    g += `<rect x="${-bw / 2}" y="${-bh / 2}" width="${bw}" height="${bh}" rx="38" fill="${sleep ? '#F3F0FF' : '#FFFFFF'}" opacity=".96" stroke="${col}" stroke-width="5" ${sleep ? 'stroke-dasharray="14 10"' : ''}/>`;
    const nx = -bw / 2 + 34, ny = -bh / 2 - 28;
    g += `<rect x="${nx}" y="${ny}" width="164" height="54" rx="27" fill="${col}"/>`;
    g += `<text x="${nx + 82}" y="${ny + 38}" text-anchor="middle" font-size="32" font-weight="700" fill="#fff">${name}</text>`;
    lines.forEach((l, i) => {
      const ty = -bh / 2 + 29 + lh * (i + 0.5) + fs * 0.35;
      g += `<text x="0" y="${U.f(ty)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${sleep ? '#7A6CA8' : '#3D3456'}">${U.esc(l)}</text>`;
    });
    if (sleep) g += `<text x="${bw / 2 - 40}" y="${-bh / 2 + 6}" font-size="40" font-weight="700" fill="#9C8FD0">z</text><text x="${bw / 2 - 12}" y="${-bh / 2 - 22}" font-size="30" font-weight="700" fill="#9C8FD0">z</text>`;
    out += `<g transform="translate(540 ${U.f(by + bh / 2)}) scale(${U.f(sc * 1000) / 1000})" opacity="${U.f(a * 100) / 100}">${g}</g>`;
  }
  return out;
}

function chipSVG(t) {
  let out = '';
  for (const c of CHIPS) {
    if (t < c.t0 || t > c.t1) continue;
    const pin = U.seg(t, c.t0, c.t0 + 0.45, 'out'), pout = 1 - U.inv(c.t1 - 0.35, c.t1, t);
    const a = Math.min(pin, pout);
    const fs = 34, w = textWidth(c.text, fs) + 110;
    const x = 44 - (1 - pin) * 60;
    out += `<g transform="translate(${U.f(x)} ${c.y || 96})" opacity="${U.f(a * 100) / 100}">
      <rect x="0" y="4" width="${w}" height="68" rx="34" fill="#5A4A8A" opacity=".15"/>
      <rect x="0" y="0" width="${w}" height="68" rx="34" fill="#fff" opacity=".93" stroke="#C7B6EE" stroke-width="3"/>
      <g transform="translate(40 34)"><path d="M0,-18 C-12,-18 -16,-6 -12,2 L0,20 L12,2 C16,-6 12,-18 0,-18 Z" fill="#FF8FB1"/><circle cx="0" cy="-6" r="5" fill="#fff"/></g>
      <text x="70" y="46" font-size="${fs}" font-weight="700" fill="#6A5B98">${U.esc(c.text)}</text></g>`;
  }
  return out;
}

// ------------------------------------------------------------------ effects
function heartBurst(tl, t0, cx, cy, n, seed, spread = 160, dur = 1.5, size = 46) {
  const p = (tl - t0) / dur;
  if (p < 0 || p > 1) return '';
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (U.hash(seed + i) - 0.5) * 2.4;
    const r = spread * (0.5 + U.hash(seed + i * 3) * 0.6) * U.ease.out(p);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r - p * 60;
    const sz = size * (0.6 + U.hash(seed + i * 5) * 0.6) * (p < 0.15 ? U.ease.outBack(p / 0.15) : 1);
    const col = ['#FF7FA6', '#FF9DBB', '#FFB8CF', '#FF6B97'][i % 4];
    s += U.heart(x, y, sz, col, 1 - U.inv(0.6, 1, p), Math.sin(i * 2 + tl * 3) * 14);
  }
  return s;
}
function floatHearts(tl, t0, t1, x, y, seed, every = 0.35, size = 34) {
  let s = '';
  for (let k = 0; ; k++) {
    const ts = t0 + k * every; if (ts > t1) break;
    const p = (tl - ts) / 1.8; if (p < 0 || p > 1) continue;
    const hx = x + (U.hash(seed + k) - 0.5) * 120 + Math.sin(p * 6 + k) * 16, hy = y - p * 220;
    s += U.heart(hx, hy, size * (0.7 + U.hash(seed + k * 2) * 0.5), ['#FF8FB1', '#FFB3CB', '#FF6F9C'][k % 3], Math.min(1, p * 6) * (1 - U.inv(0.6, 1, p)), Math.sin(tl * 4 + k) * 12);
  }
  return s;
}
function sparkles(tl, x, y, w, h, n, seed, col = '#FFFFFF') {
  let s = '';
  for (let i = 0; i < n; i++) {
    const ph = (tl * (0.6 + U.hash(seed + i) * 0.8) + U.hash(seed + i * 9)) % 1;
    const a = Math.sin(ph * Math.PI);
    s += U.sparkle(x + U.hash(seed + i * 2) * w, y + U.hash(seed + i * 4) * h, 10 + 16 * a, col, a * 0.95, ph * 90);
  }
  return s;
}
function steam(tl, t0, x, y, seed) {
  let s = '';
  for (let k = 0; k < 5; k++) {
    const p = (tl - t0 - k * 0.22) / 1.1; if (p < 0 || p > 1) continue;
    const sx = x + (k % 2 ? 1 : -1) * (30 + k * 14) + Math.sin(p * 5) * 10, sy = y - p * 140;
    s += `<g opacity="${U.f((1 - p) * 90) / 100}"><circle cx="${U.f(sx)}" cy="${U.f(sy)}" r="${U.f(16 + p * 18)}" fill="#fff" stroke="#E3D9F3" stroke-width="3"/><circle cx="${U.f(sx + 14)}" cy="${U.f(sy - 8)}" r="${U.f(11 + p * 12)}" fill="#fff"/></g>`;
  }
  return s;
}
function zzz(tl, x, y) {
  let s = '';
  for (let k = 0; k < 3; k++) {
    const p = ((tl * 0.5 + k / 3) % 1);
    s += `<text x="${U.f(x + p * 50 + k * 6)}" y="${U.f(y - p * 120)}" font-size="${U.f(34 + p * 22)}" font-weight="700" fill="#B5A8E6" opacity="${U.f(Math.sin(p * Math.PI) * 90) / 100}">z</text>`;
  }
  return s;
}
function ripple(tl, t0, x, y, col = '#FFE08A') {
  let s = '';
  for (let k = 0; k < 4; k++) {
    const p = (tl - t0 - k * 0.12) / 0.8; if (p < 0 || p > 1) continue;
    s += `<ellipse cx="${x}" cy="${y}" rx="${U.f(30 + p * 260)}" ry="${U.f(30 + p * 260)}" fill="none" stroke="${col}" stroke-width="${U.f(14 * (1 - p) + 2)}" opacity="${U.f((1 - p) * 90) / 100}"/>`;
  }
  return s;
}
function speedLines(cx, cy, n, r0, r1, seed, col = '#fff', op = 0.8) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = U.hash(seed + i) * Math.PI * 2, w = 3 + U.hash(seed + i * 3) * 9, rr = r0 + U.hash(seed + i * 7) * 120;
    const x0 = cx + Math.cos(a) * rr, y0 = cy + Math.sin(a) * rr, x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
    const nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
    s += `<path d="M${U.f(x0)},${U.f(y0)} L${U.f(x1 + nx)},${U.f(y1 + ny)} L${U.f(x1 - nx)},${U.f(y1 - ny)} Z" fill="${col}" opacity="${op}"/>`;
  }
  return s;
}
const cam = (x, y, z) => ({ x, y, z });
const camTr = c => `translate(540 960) scale(${U.f(c.z * 1000) / 1000}) translate(${U.f(-c.x)} ${U.f(-c.y)})`;

// ------------------------------------------------------------------ S1 station
function sStation(tl) {
  const clock = tl < 2.8 ? U.lerp(9 * 60 + 30, 9 * 60 + 59, U.seg(tl, 0.2, 2.8)) : 9 * 60 + 59 + U.inv(2.8, 13, tl);
  let s = B.station(tl, clock);
  // Vol
  const vLook = tl < 2.6 ? [Math.sin(tl * 1.6) * 0.7, 0] : tl < 4.8 ? [0.8, 0] : [0.6, 0];
  const vEyes = U.step(tl, [[0, 'open'], [4.7, 'smile'], [6.0, 'open'], [7.5, 'smile'], [9.3, 'open']]);
  const giveR = U.kf(tl, [[10.9, -18], [11.5, 62], [12.3, 62], [12.8, -10]]);
  const vol = charSVG('vol', {
    x: 370, y: 1700, s: 1.25, t: tl, blinkSeed: 11, look: vLook, eyes: vEyes, turn: tl > 3 ? 0.4 : 0,
    mouth: talk(tl + 0, 'vol', tl > 4.7 ? 'smile' : 'small'), blush: tl > 4.6 ? 0.45 : 0.15,
    itemL: 'cup', itemR: tl < 12.25 ? 'cupY' : null, armL: -14, armR: giveR, bob: tl > 4.7 && tl < 5.2 ? -U.ease.out(1 - Math.abs(tl - 4.95) / 0.25) * 14 : 0,
    brows: tl > 4.7 ? 'happy' : 'neutral',
  });
  // Yuria runs in
  const yx = tl < 3.0 ? 1320 : U.lerp(1320, 720, U.seg(tl, 3.0, 4.6, 'out'));
  const running = tl > 3.0 && tl < 4.5;
  const yEyes = U.step(tl, [[0, 'open'], [9.5, 'wide'], [10.6, 'open'], [12.3, 'smile']]);
  const yMouth = tl < 9.5 ? talk(tl + 3.0 - 3.0, 'yuria', 'grin', 'grin') : tl < 10.6 ? 'open' : tl < 12.3 ? 'smile' : 'cat';
  const yu = charSVG('yuria', {
    x: yx, y: 1700, s: 1.25, t: tl, blinkSeed: 12, walk: running ? tl * 2.6 : null, run: running, lean: running ? -6 : 0,
    look: [-0.7, 0], turn: -0.4, eyes: yEyes, mouth: speaking(tl, 'yuria') && tl < 9.5 ? talk(tl, 'yuria', 'grin', 'open') : yMouth,
    armR: running ? 150 + Math.sin(tl * 16) * 18 : tl < 5.0 ? U.lerp(150, 10, U.seg(tl, 4.5, 5.0)) : 10,
    armL: U.kf(tl, [[11.6, 10], [12.1, 64], [12.5, 64], [12.9, -14]]), itemL: tl >= 12.25 ? 'cupY' : null,
    blush: tl > 12.2 ? 0.65 : 0.3, sweat: tl > 9.5 && tl < 10.8, brows: tl > 5.3 && tl < 7.3 ? 'up' : 'neutral',
    bob: tl > 9.5 && tl < 10.1 ? -Math.sin(U.inv(9.5, 10.1, tl) * Math.PI) * 26 : 0,
  });
  s += vol + yu;
  // effects
  if (running) s += speedLines(yx + 200, 1400, 10, 60, 260, 5, '#FFFFFF', 0.6).replace(/<path /g, '<path transform="scale(1 0.4) translate(0 2100)" ');
  s += heartBurst(tl, 4.75, 370, 1010, 6, 3);
  s += heartBurst(tl, 7.6, 370, 1010, 5, 9);
  s += heartBurst(tl, 12.35, 720, 1000, 5, 17, 130);
  if (tl > 9.5 && tl < 10.4) s += `<text x="${yx + 80}" y="1000" font-size="90" font-weight="700" fill="#FF8FB1" transform="rotate(12 ${yx + 80} 1000)">!</text>`;
  const c = tl < 3.3 ? cam(U.lerp(250, 540, U.seg(tl, 0.0, 3.3)), U.lerp(820, 1150, U.seg(tl, 0.0, 3.3)), U.lerp(1.65, 1.18, U.seg(tl, 0.0, 3.3))) : cam(540, 1150, 1.18 + U.seg(tl, 3.3, 13, 'sine') * 0.05);
  return { s, cam: c };
}

// ------------------------------------------------------------------ S2 street
function sStreet(tl) {
  const scroll = 700 + tl * 150;
  let s = B.street(tl, scroll);
  const ph = tl * 1.55;
  const close = U.seg(tl, 6.9, 7.8);
  const vx = U.lerp(390, 430, close), yx = U.lerp(700, 640, close);
  const holding = tl > 3.0;
  const vol = charSVG('vol', {
    x: vx, y: 1735, s: 1.25, t: tl, blinkSeed: 21, walk: ph + 0.5, look: tl > 2 ? [0.7, 0] : [0.5, -0.1], turn: 0.35,
    eyes: tl > 4.2 && tl < 7 ? 'half' : tl > 7.7 ? 'half' : 'open', mouth: talk(tl + 13, 'vol', tl > 7.7 ? 'cat' : 'small', 'o'),
    blush: tl > 4.0 ? (tl > 7.7 ? 1.0 : 0.75) : 0.3, itemL: 'cup', armL: -10,
    armR: holding ? U.lerp(12, 36, U.seg(tl, 3.6, 4.2)) : null, brows: tl > 4 ? 'soft' : 'neutral',
  });
  const yu = charSVG('yuria', {
    x: yx, y: 1735, s: 1.25, t: tl, blinkSeed: 22, walk: ph, look: [-0.6, 0], turn: -0.35,
    eyes: tl > 7.0 && tl < 9.0 ? 'wink' : 'open', winkSide: 1, mouth: talk(tl + 13, 'yuria', 'grin', 'open'),
    blush: tl > 6.8 ? 0.6 : 0.35, itemR: 'cupY', armR: -10,
    armL: holding ? U.lerp(10, tl > 6.8 ? 40 : 52, U.seg(tl, 2.0, 2.6)) : null,
  });
  s += vol + yu;
  if (tl > 7.4) s += floatHearts(tl, 7.6, 11.6, 540, 1080, 31, 0.3, 40);
  s += heartBurst(tl, 7.4, 540, 1100, 8, 41, 220, 1.6, 54);
  s += B.streetFront(tl, scroll);
  return { s, cam: cam(540, 1160 + Math.sin(tl * 3.1) * 3, 1.17) };
}

// ------------------------------------------------------------------ S3 crepe
function sCrepe(tl) {
  let s = B.crepe(tl);
  const bite = tl > 1.85 ? 1 : 0;
  // Yuria (right): bite, cream on cheek, then flustered
  const yArmR = U.kf(tl, [[0.3, -38], [1.5, -146], [2.1, -146], [2.8, -38]]);
  const lean = U.kf(tl, [[6.9, 0], [7.7, 9], [8.2, 9], [8.7, 0]]);
  const vShift = U.kf(tl, [[6.9, 0], [7.7, 104], [8.2, 104], [8.7, 0]]);
  const vArmR = U.kf(tl, [[6.9, 14], [7.6, 166], [8.15, 166], [8.6, -150], [9.6, -150], [10.2, 14]]);
  const yEyes = U.step(tl, [[0, 'open'], [1.5, 'smile'], [3.9, 'open'], [6.1, 'wide'], [7.3, 'open'], [8.0, 'wide'], [10.2, 'shut']]);
  const yMouth = tl > 1.5 && tl < 2.4 ? 'chew' : tl > 10.2 ? talk(tl + 24.5, 'yuria', 'wavy', 'wavy') : talk(tl + 24.5, 'yuria', tl > 6 ? 'o' : 'grin', 'open');
  const yu = charSVG('yuria', {
    x: 790, y: 2290, s: 2.0, t: tl, blinkSeed: 31, upperOnly: true, look: tl > 6.1 && tl < 7.3 ? [Math.sin(tl * 9) * 0.8, 0] : [-0.5, 0], turn: -0.3,
    eyes: yEyes, mouth: yMouth, blush: tl > 8.0 ? 1.0 : 0.35, itemR: 'crepeY', bite, armR: yArmR, armL: 6, lean: tl > 8 ? -3 : 0,
    brows: tl > 10.2 ? 'worry' : 'neutral',
  });
  const vo = {
    x: 300 + vShift, y: 2290, s: 2.0, t: tl, blinkSeed: 32, upperOnly: true, look: [0.6, 0], turn: 0.3, lean,
    eyes: tl > 8.6 ? 'half' : 'open', mouth: tl > 8.6 && tl < 9.4 ? 'lick' : talk(tl + 24.5, 'vol', 'smile', 'open'),
    blush: tl > 8.6 ? 0.7 : 0.3, itemL: 'crepeV', armL: -32, armR: vArmR, brows: tl > 8.6 ? 'soft' : 'neutral',
  };
  s += charSVG('vol', Object.assign({ part: 'back' }, vo)) + yu + charSVG('vol', Object.assign({ part: 'front' }, vo));
  // cream on Yuria's cheek (head-local -66,58 at scale 2.0, root 790,2290)
  if (tl > 1.9 && tl < 7.95) {
    const cx = 790 + (-66 - 0.3 * 7) * 2.0, cy = 2290 + (-452 + 58) * 2.0;
    s += `<g transform="translate(${U.f(cx)} ${U.f(cy)}) scale(2.0)"><circle cx="0" cy="0" r="7" fill="#fff" stroke="#CFC6E6" stroke-width="1.6"/><circle cx="7" cy="3" r="4.5" fill="#fff" stroke="#CFC6E6" stroke-width="1.4"/></g>`;
  }
  if (tl > 8.0 && tl < 8.7) s += U.sparkle(650, 1500, 22, '#fff', 0.9);
  s += steam(tl, 10.3, 790, 1120, 3) + steam(tl, 11.0, 790, 1120, 7);
  s += floatHearts(tl, 8.8, 11.6, 300, 1160, 51, 0.4, 36);
  if (tl > 1.85 && tl < 2.6) s += sparkles(tl, 660, 1220, 280, 160, 4, 61, '#FFE6F0');
  const z = 1.0 + U.seg(tl, 6.5, 8.5) * 0.12 - U.seg(tl, 9.5, 11) * 0.06;
  return { s, cam: cam(540 + U.seg(tl, 6.5, 8.5) * 20, 1050 - U.seg(tl, 6.5, 8.5) * 20, z) };
}

// ------------------------------------------------------------------ S4 park
function sPark(tl) {
  let s = B.park(tl);
  const walking = tl < 2.2;
  const vx = U.lerp(150, 400, U.seg(tl, 0, 2.2, 'out')), yx = U.lerp(420, 690, U.seg(tl, 0, 2.2, 'out'));
  // ball
  let ball = '';
  const bT0 = 2.3, bStop = 2.95, bDrop = 3.8;
  let bx, by, rot = tl * 720;
  if (tl > bT0 && tl < bStop) { const p = U.inv(bT0, bStop, tl); bx = U.lerp(1180, 860, p); by = U.lerp(980, 1130, p) - Math.sin(p * Math.PI) * 60; }
  else if (tl >= bStop && tl < bDrop) { bx = 860 + Math.sin(tl * 60) * (tl < 3.3 ? 5 : 2); by = 1130; rot = 0; }
  else if (tl >= bDrop && tl < 4.9) { const p = U.inv(bDrop, 4.9, tl); bx = 860 + p * 30; const g = Math.abs(Math.cos(p * Math.PI * 2.2)) * (1 - p); by = 1680 - g * 480; rot = p * 300; }
  else if (tl >= 4.9 && tl < 6.0) { const p = U.inv(4.9, 6.0, tl); bx = U.lerp(890, 1250, p); by = 1680 - Math.sin(p * Math.PI) * 420; rot = p * 600; }
  if (bx != null) {
    const frozen = tl >= bStop && tl < bDrop;
    if (!frozen && tl < bStop) s += `<path d="M${U.f(bx + 40)},${U.f(by - 20)} L${U.f(bx + 170)},${U.f(by - 70)} M${U.f(bx + 44)},${U.f(by + 10)} L${U.f(bx + 190)},${U.f(by - 30)}" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/>`;
    ball = `<g transform="translate(${U.f(bx)} ${U.f(by)}) rotate(${U.f(rot)})">${frozen ? `<circle r="70" fill="#FFE08A" opacity=".5" filter="url(#fBlur8)"/>` : ''}<circle r="40" fill="#fff" stroke="#6E6696" stroke-width="4"/><path d="M0,-14 L13,-4 L8,12 L-8,12 L-13,-4 Z" fill="#4C4470"/><path d="M0,-14 L0,-40 M13,-4 L37,-12 M8,12 L22,32 M-8,12 L-22,32 M-13,-4 L-37,-12" stroke="#4C4470" stroke-width="3.5"/></g>`;
  }
  const guard = tl > 2.45 && tl < 4.1;
  const yEyes = U.step(tl, [[0, 'open'], [9.0, 'wink']]);
  const yu = charSVG('yuria', {
    x: yx + (guard ? 30 : 0), y: 1720, s: 1.2, t: tl, blinkSeed: 41, walk: walking ? tl * 1.6 : null, look: guard ? [0.9, 0] : tl > 6.2 ? [-0.6, 0] : [-0.3, 0], turn: guard ? 0.3 : -0.3,
    eyes: yEyes, winkSide: 1, dragon: U.inv(2.7, 2.85, tl) * (1 - U.inv(3.7, 3.9, tl)), brows: guard ? 'angry' : 'neutral',
    mouth: tl > 9.0 ? 'tongue' : guard ? 'flat' : talk(tl + 36.5, 'yuria', 'grin', 'open'),
    armR: guard ? U.lerp(10, 96, U.seg(tl, 2.45, 2.75)) : tl > 4.6 && tl < 5.2 ? U.kf(tl, [[4.6, 10], [4.85, 120], [5.2, 10]]) : (tl > 10.0 ? 64 : null),
    armL: tl > 9.2 ? -40 : null, lean: guard ? 5 : 0, blush: tl > 9 ? 0.6 : 0.3,
  });
  const vSwoon = U.inv(6.0, 6.8, tl);
  const vol = charSVG('vol', {
    x: vx + (tl > 10.0 ? U.seg(tl, 10.0, 11.5) * 60 : 0), y: 1720, s: 1.2, t: tl, blinkSeed: 42, walk: walking ? tl * 1.6 + 0.5 : null, look: [0.7, 0], turn: 0.3,
    eyes: tl > 2.5 && tl < 3.9 ? 'wide' : tl > 6.3 ? 'heart' : 'open', hiddenEye: vSwoon * (1 - U.inv(9.2, 9.8, tl)),
    mouth: talk(tl + 36.5, 'vol', tl > 6 ? 'cat' : 'small', 'o'), blush: 0.3 + vSwoon * 0.7, brows: tl > 6 ? 'soft' : 'neutral',
    armR: tl > 10.0 ? 50 : null,
  });
  s += vol + yu + ball;
  if (tl > 2.8 && tl < 3.9) s += ripple(tl, 2.85, 830, 1130) + ripple(tl, 3.2, 830, 1130, '#FFFFFF');
  s += floatHearts(tl, 6.5, 9.4, 400, 1060, 71, 0.28, 38);
  if (tl > 9.0 && tl < 11.0) {
    const a = U.win(tl, 9.0, 11.0, 0.2, 0.3);
    s += `<g transform="translate(${yx + 150} 980) rotate(-8)" opacity="${U.f(a * 100) / 100}"><text x="0" y="0" font-size="58" font-weight="700" fill="#FF7FA6" stroke="#fff" stroke-width="10" paint-order="stroke">てへっ</text>${U.heart(170, -20, 40, '#FF7FA6')}</g>`;
  }
  // shake on impact
  const shake = tl > 2.95 && tl < 3.3 ? Math.sin(tl * 90) * 8 * (1 - U.inv(2.95, 3.3, tl)) : 0;
  let c = cam(540 + shake, 1170, 1.2);
  if (tl > 2.4 && tl < 4.2) c = cam(U.lerp(540, 700, U.seg(tl, 2.4, 2.9)) - U.seg(tl, 3.8, 4.2) * 160 + shake, U.lerp(1170, 1170, U.seg(tl, 2.4, 2.9)), U.lerp(1.2, 1.42, U.seg(tl, 2.4, 2.9)) - U.seg(tl, 3.8, 4.2) * 0.22);
  return { s, cam: c, overlay: cutIn(tl) };
}
// dragon-eye cut-in panel (screen space)
function cutIn(tl) {
  const a = U.win(tl, 3.0, 3.75, 0.12, 0.15);
  if (a <= 0) return '';
  const slide = (1 - U.seg(tl, 3.0, 3.15, 'out')) * 1200;
  let s = `<g opacity="${U.f(a * 100) / 100}"><clipPath id="cutClip"><path d="M-40,600 L1120,520 L1120,860 L-40,940 Z"/></clipPath>`;
  s += `<path d="M-40,590 L1120,510 L1120,870 L-40,950 Z" fill="#fff"/>`;
  s += `<g clip-path="url(#cutClip)"><rect x="-40" y="480" width="1200" height="500" fill="#2D2450"/>`;
  s += speedLines(540, 730, 40, 260, 900, 81, '#FFE08A', 0.5);
  s += `<g transform="translate(${U.f(slide)} 0)">` + charSVG('yuria', { x: 540, y: 730 + 452 * 4.2 - 22 * 4.2, s: 4.2, t: tl, upperOnly: true, eyes: 'open', dragon: 1, brows: 'angry', mouth: 'flat', look: [0.2, 0], noShadow: true }) + `</g>`;
  s += `</g></g>`;
  return s;
}

// ------------------------------------------------------------------ S5a wheel (wide)
function sWheel(tl) {
  const rot = U.lerp(-155, -96, U.seg(tl, 0, 5.4, 'sine'));
  let s = B.wheel(tl, rot, U.inv(2.5, 5, tl));
  const z = U.lerp(1.0, 1.9, U.seg(tl, 1.0, 5.6));
  const gy = 860 - 430 + 60;
  return { s, cam: cam(540, U.lerp(960, gy + 40, U.seg(tl, 1.0, 5.6)), z) };
}

// ------------------------------------------------------------------ S5b gondola
function sGondola(tl) {
  if (tl > 12.3) { // exterior at the top
    const rot = -90;
    let s = B.wheel(tl + 5, rot, 1);
    const gx = 540, gy = 860 - 430;
    s += heartBurst(tl, 12.5, gx, gy + 40, 9, 91, 260, 1.8, 70);
    s += sparkles(tl, gx - 300, gy - 200, 600, 400, 10, 93, '#FFF4C9');
    return { s, cam: cam(gx, gy + 60 - U.seg(tl, 12.3, 14) * 40, U.lerp(2.4, 2.1, U.seg(tl, 12.3, 14))) };
  }
  let s = B.gondola(tl, 1 + U.seg(tl, 10.4, 11.6) * 0.8);
  const lean = U.seg(tl, 10.2, 11.2);
  const filt = 'url(#fWarm)';
  const vo = {
    x: 320 + lean * 28, y: 2330, s: 2.05, t: tl, blinkSeed: 51, upperOnly: true, filter: filt,
    look: tl < 5.6 ? [-0.5, -0.6] : [0.7, 0], turn: tl < 5.6 ? -0.2 : 0.35, lean: lean * 5, tilt: lean * 9,
    eyes: tl > 10.6 ? 'closed' : tl > 8.8 ? 'half' : 'open', mouth: talk(tl + 53, 'vol', 'small', 'o'),
    blush: tl > 6 ? 0.75 : 0.4, brows: tl > 6 ? 'soft' : 'neutral',
  };
  const yo = {
    x: 760 - lean * 28, y: 2330, s: 2.05, t: tl, blinkSeed: 52, upperOnly: true, filter: filt,
    look: [-0.7, tl < 5 ? 0.05 : 0], turn: -0.35, lean: -lean * 5, tilt: -lean * 9,
    eyes: tl > 10.6 ? 'closed' : tl > 9.0 ? 'half' : 'open', mouth: talk(tl + 53, 'yuria', 'smile', 'open'),
    blush: tl > 9 ? 0.85 : 0.45, brows: 'soft',
  };
  s += layered([['vol', vo, 'back'], ['yuria', yo, 'back'], ['vol', vo, 'front'], ['yuria', yo, 'front']]);
  if (tl > 10.8) s += `<circle cx="540" cy="1330" r="${U.f(120 + U.seg(tl, 10.8, 12.3) * 900)}" fill="#FFF4D8" opacity="${U.f(U.seg(tl, 10.8, 12.0) * 92) / 100}" filter="url(#fBlur20)"/>`;
  s += heartBurst(tl, 11.0, 540, 1300, 10, 97, 320, 1.6, 64);
  s += sparkles(tl, 100, 300, 880, 900, 6, 99, '#FFF1C9');
  return { s, cam: cam(540, 1000 - U.seg(tl, 0, 10) * 20 + U.seg(tl, 10.2, 12) * 120, 1.0 + U.seg(tl, 0, 10) * 0.06 + U.seg(tl, 10.2, 12.2) * 0.14) };
}

// ------------------------------------------------------------------ S6 train
function sTrain(tl) {
  const sway = Math.sin(tl * 7.3) * 2 + Math.sin(tl * 2.1) * 1.5;
  let s = B.train(tl);
  const yTilt = U.seg(tl, 7.8, 9.0) * -9;
  const filt = 'url(#fNight)';
  const yo = {
    x: 700, y: 2170 + sway, s: 2.2, t: tl, blinkSeed: 61, upperOnly: true, filter: filt,
    look: tl > 5.4 ? [-0.6, 0.5] : [-0.2, 0.1], turn: -0.3, tilt: yTilt,
    eyes: tl > 8.4 ? 'smile' : tl > 5.4 ? 'half' : 'open', mouth: talk(tl + 67, 'yuria', 'smile', 'oSmall'),
    blush: 0.5, brows: 'soft',
  };
  const vo = {
    x: 300, y: 2390 + sway, s: 2.2, t: tl, upperOnly: true, filter: filt, blink: 0,
    eyes: 'closed', mouth: speaking(tl + 67, 'sleep') && U.hash(Math.floor(tl * 5)) > 0.5 ? 'oSmall' : 'small', tilt: 20, lean: 7, turn: 0.4,
    blush: 0.45, brows: 'soft', noArmR: true,
  };
  s += layered([['vol', vo, 'back'], ['yuria', yo, 'back'], ['yuria', yo, 'body'], ['vol', vo, 'front'], ['yuria', yo, 'head']]);
  s += zzz(tl, 300, 1240);
  // shooting star
  if (tl > 8.9 && tl < 10.0) {
    const p = U.inv(8.9, 9.6, tl), a = 1 - U.inv(9.6, 10.0, tl);
    const x = U.lerp(900, 380, p), y = U.lerp(380, 560, p);
    s += `<g opacity="${U.f(a * 100) / 100}"><path d="M${U.f(x)},${U.f(y)} L${U.f(x + 220)},${U.f(y - 76)}" stroke="#FFF3C4" stroke-width="5" stroke-linecap="round" opacity=".6"/>${U.sparkle(x, y, 20, '#FFF6D6')}</g>`;
  }
  s += floatHearts(tl, 9.6, 11.8, 560, 1120, 111, 0.45, 30);
  return { s, cam: cam(540, 980, 1.0 + U.seg(tl, 0, 12) * 0.05) };
}

// ------------------------------------------------------------------ S7 end card
function sEnd(tl) {
  let s = B.end(tl);
  const p = U.seg(tl, 0.2, 1.1, 'outBack');
  const drop = (1 - p) * -900;
  // polaroid
  let pol = `<g transform="translate(540 ${U.f(860 + drop)}) rotate(${U.f(-4 + (1 - p) * -10)})">`;
  pol += `<rect x="-380" y="-430" width="760" height="900" rx="18" fill="#5A4A8A" opacity=".18" transform="translate(10 16)"/>`;
  pol += `<rect x="-380" y="-430" width="760" height="900" rx="18" fill="#FFFFFF" stroke="#E6DDF6" stroke-width="4"/>`;
  pol += `<clipPath id="polClip"><rect x="-340" y="-390" width="680" height="680" rx="8"/></clipPath><g clip-path="url(#polClip)">`;
  pol += `<rect x="-340" y="-390" width="680" height="680" fill="#FFE3EE"/>`;
  for (let i = 0; i < 14; i++) pol += U.heart(-340 + U.hash(i * 3.3) * 680, -390 + U.hash(i * 5.1) * 680, 40 + U.hash(i) * 30, '#FFC4D8', 0.8, U.hash(i * 7) * 40 - 20);
  const pv = { x: -150, y: 700, s: 1.55, t: tl, blinkSeed: 71, upperOnly: true, eyes: 'smile', mouth: 'cat', blush: 0.8, tilt: 7, lean: 3, look: [0.4, 0], turn: 0.3, noArmR: true };
  const py = { x: 150, y: 700, s: 1.55, t: tl, blinkSeed: 72, upperOnly: true, eyes: 'wink', winkSide: 1, mouth: 'grin', blush: 0.6, tilt: -7, lean: -3, armR: 150, turn: -0.3 };
  pol += layered([['vol', pv, 'back'], ['yuria', py, 'back'], ['vol', pv, 'front'], ['yuria', py, 'front']]);
  // peace sign at Yuria's raised hand
  pol += `<g transform="translate(330 140) rotate(-12)" opacity="0"><path d="M-10,0 L-18,-56 M10,0 L18,-56" stroke="#FFF1EB" stroke-width="16" stroke-linecap="round"/><path d="M-10,0 L-18,-56 M10,0 L18,-56" stroke="#C98E8A" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".0"/></g>`;
  pol += `<text x="-300" y="-320" font-size="58" font-weight="700" fill="#FF7FA6" stroke="#fff" stroke-width="10" paint-order="stroke" transform="rotate(-8 -300 -320)">ゆり♡ヴォル</text>`;
  pol += `<text x="150" y="250" font-size="44" font-weight="700" fill="#8A73D6" stroke="#fff" stroke-width="9" paint-order="stroke">ずっといっしょ</text>`;
  pol += U.sparkle(-260, 200, 22, '#FFE08A') + U.sparkle(280, -300, 18, '#FFE08A') + U.sparkle(220, -220, 12, '#fff');
  pol += `</g>`;
  pol += `<text x="0" y="380" text-anchor="middle" font-size="48" font-weight="700" fill="#8E7FBE" letter-spacing="2">2026.11.22</text>`;
  pol += `</g>`;
  s += pol;
  const a = U.seg(tl, 1.3, 2.0);
  s += `<g opacity="${U.f(a * 100) / 100}" transform="translate(0 ${U.f((1 - a) * 30)})">`;
  s += `<text x="540" y="1530" text-anchor="middle" font-size="96" font-weight="700" fill="#FF7FA6" stroke="#fff" stroke-width="16" paint-order="stroke" letter-spacing="6">DATE</text>`;
  s += `<text x="540" y="1620" text-anchor="middle" font-size="50" font-weight="700" fill="#7A6AB0" stroke="#fff" stroke-width="10" paint-order="stroke">ユリア × ヴォル</text>`;
  s += U.heart(300, 1500, 50, '#FFB3CB') + U.heart(780, 1500, 50, '#FFB3CB');
  s += `</g>`;
  s += sparkles(tl, 80, 200, 920, 1500, 10, 131, '#FFFFFF');
  return { s, cam: cam(540, 960, 1.0) };
}

// ------------------------------------------------------------------ timeline
const SCENES = [
  { id: 'station', start: 0, dur: 13.0, fn: sStation },
  { id: 'street', start: 13.0, dur: 11.5, fn: sStreet, tin: { type: 'heart', d: 0.9 } },
  { id: 'crepe', start: 24.5, dur: 12.0, fn: sCrepe, tin: { type: 'heart', d: 0.9 } },
  { id: 'park', start: 36.5, dur: 11.5, fn: sPark, tin: { type: 'heart', d: 0.9 } },
  { id: 'wheel', start: 48.0, dur: 5.0, fn: sWheel, tin: { type: 'fade', d: 1.2 } },
  { id: 'gondola', start: 53.0, dur: 14.0, fn: sGondola, tin: { type: 'white', d: 0.7 } },
  { id: 'train', start: 67.0, dur: 12.0, fn: sTrain, tin: { type: 'dark', d: 1.4 } },
  { id: 'end', start: 79.0, dur: 6.0, fn: sEnd, tin: { type: 'white', d: 1.0 } },
];
const DURATION = 85.0;

function drawScene(sc, tl) {
  const r = sc.fn(tl);
  return `<g transform="${camTr(r.cam)}">${r.s}</g>${r.overlay || ''}`;
}

window.renderFrame = function (t) {
  U.resetUid();
  let i = 0;
  for (let k = 0; k < SCENES.length; k++) if (t >= SCENES[k].start) i = k;
  const cur = SCENES[i];
  const tl = t - cur.start;
  let body;
  if (cur.tin && i > 0 && tl < cur.tin.d) {
    const prev = SCENES[i - 1], p = tl / cur.tin.d;
    const A = drawScene(prev, t - prev.start), Bs = drawScene(cur, tl);
    if (cur.tin.type === 'heart') {
      const S = U.ease.in(p) * 3600;
      body = A + `<clipPath id="hwClip"><path d="${U.heartD}" transform="translate(540 1000) scale(${U.f(S)})"/></clipPath><g clip-path="url(#hwClip)">${Bs}</g>`;
      body += `<path d="${U.heartD}" transform="translate(540 1000) scale(${U.f(S)})" fill="none" stroke="#FFB3CB" stroke-width="${U.f(14 / Math.max(S, 1))}" opacity="${U.f((1 - p) * 100) / 100}"/>`;
    } else if (cur.tin.type === 'fade') {
      body = A + `<g opacity="${U.f(U.ease.inOut(p) * 100) / 100}">${Bs}</g>`;
    } else {
      const col = cur.tin.type === 'white' ? '#FFFFFF' : '#151338';
      body = p < 0.5 ? A + `<rect width="${W}" height="${H}" fill="${col}" opacity="${U.f(U.ease.inOut(p * 2) * 100) / 100}"/>`
        : Bs + `<rect width="${W}" height="${H}" fill="${col}" opacity="${U.f(U.ease.inOut((1 - p) * 2) * 100) / 100}"/>`;
    }
  } else {
    body = drawScene(cur, tl);
  }
  // fade in at start, fade out at end
  let fade = '';
  if (t < 0.6) fade = `<rect width="${W}" height="${H}" fill="#FFFFFF" opacity="${U.f((1 - t / 0.6) * 100) / 100}"/>`;
  if (t > DURATION - 0.8) fade = `<rect width="${W}" height="${H}" fill="#FFFFFF" opacity="${U.f(U.inv(DURATION - 0.8, DURATION, t) * 100) / 100}"/>`;
  document.getElementById('content').innerHTML = `<defs>${B.defs}</defs>${body}${chipSVG(t)}${subtitleSVG(t)}${fade}`;
};
window.DURATION = DURATION;
window.SCENES = SCENES;
window.SUBS = SUBS;
window.CHIPS = CHIPS;
window.ALL_TEXT = SUBS.map(x => x.text).join('') + CHIPS.map(x => x.text).join('') + '星見駅CRÊPEMENUいちごチョコバナナ抹茶星見遊園地next▶ほしみてへっゆり♡ヴォルずっといっしょ2026.11.22DATEユリア×ヴォルz!FLOWERaccessoryBAKERYCAFÉ0123456789:';
