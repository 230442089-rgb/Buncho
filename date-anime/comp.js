// comp.js — "with / without Yuria & Vol" split-screen comparison. Entry: window.renderFrame(t)
const SW = 1080, SH = 1920, PANEL = 930, BAND = 60, BOTY = PANEL + BAND; // top 0..930, band, bottom 990..1920

// ------------------------------------------------------------------ speech bubbles (panel coords)
// panel: top | bot | full ; who: yuria | vol | man | cap ; [x,y] = bubble centre ; tail = point near the mouth
const BUBS = [
  // wake 0-12
  { t0: 4.0, t1: 5.8, panel: 'top', who: 'man', text: '……あと5分', x: 640, y: 270, tail: [430, 420] },
  { t0: 7.5, t1: 9.3, panel: 'top', who: 'man', text: '……やば', x: 640, y: 170, tail: [440, 290] },
  { t0: 3.6, t1: 5.7, panel: 'bot', who: 'yuria', text: 'おっはよー！　朝だよ〜♡', x: 700, y: 150, tail: [880, 330] },
  { t0: 6.0, t1: 8.5, panel: 'bot', who: 'vol', text: 'おはようございます。\n朝ごはん、できてますよ', x: 470, y: 160, tail: [150, 330] },
  { t0: 9.6, t1: 11.6, panel: 'bot', who: 'man', text: '……おはよ', x: 660, y: 170, tail: [450, 300] },
  // breakfast 12-20.5
  { t0: 13.5, t1: 20.2, panel: 'top', who: 'cap', text: '朝ごはん：エナドリ1本', x: 540, y: 80 },
  { t0: 12.8, t1: 14.9, panel: 'bot', who: 'vol', text: '卵焼き、甘めにしておきました', x: 450, y: 150, tail: [250, 300] },
  { t0: 15.1, t1: 17.3, panel: 'bot', who: 'yuria', text: 'うまっ！　ヴォルの卵焼き、\n最強じゃん♡', x: 700, y: 110, tail: [840, 230] },
  { t0: 17.5, t1: 20.2, panel: 'bot', who: 'vol', text: '……ゆり姉の分は、\nもっと甘くしてあります♡', x: 500, y: 130, tail: [260, 300] },
  // commute 20.5-28.5
  { t0: 22.0, t1: 24.2, panel: 'top', who: 'man', text: '……はぁ', x: 780, y: 230, tail: [600, 330] },
  { t0: 25.0, t1: 28.2, panel: 'top', who: 'cap', text: '今日も満員電車', x: 540, y: 70 },
  { t0: 21.1, t1: 23.2, panel: 'bot', who: 'vol', text: 'お弁当、持ちましたか？', x: 470, y: 200, tail: [500, 330] },
  { t0: 24.6, t1: 26.6, panel: 'bot', who: 'yuria', text: 'いってら〜！　がんばれ♡', x: 330, y: 200, tail: [220, 330] },
  { t0: 26.6, t1: 28.3, panel: 'bot', who: 'man', text: 'いってきます', x: 790, y: 200, tail: [800, 330] },
  // lunch 28.5-36.5
  { t0: 29.3, t1: 36.2, panel: 'top', who: 'cap', text: 'スマホの通知：0件', x: 540, y: 70 },
  { t0: 33.2, t1: 35.4, panel: 'bot', who: 'man', text: '……うまい', x: 280, y: 160, tail: [460, 280] },
  // home 36.5-46.5
  { t0: 39.2, t1: 41.0, panel: 'top', who: 'man', text: '……ただいま', x: 360, y: 200, tail: [560, 340] },
  { t0: 41.4, t1: 46.2, panel: 'top', who: 'cap', text: '（返事はない）', x: 540, y: 70 },
  { t0: 38.9, t1: 41.1, panel: 'bot', who: 'yuria', text: 'おかえり〜！　おそかったじゃん', x: 450, y: 170, tail: [420, 330] },
  { t0: 41.5, t1: 44.0, panel: 'bot', who: 'vol', text: 'おかえりなさい。\nお風呂、沸いてますよ', x: 300, y: 160, tail: [180, 330] },
  { t0: 44.3, t1: 46.3, panel: 'bot', who: 'man', text: '……ただいま', x: 840, y: 180, tail: [700, 330] },
  // dinner 46.5-55.5
  { t0: 47.4, t1: 55.2, panel: 'top', who: 'cap', text: '今日の会話：0回', x: 540, y: 70 },
  { t0: 47.3, t1: 49.2, panel: 'bot', who: 'yuria', text: 'ヴォル、あーん♡', x: 820, y: 100, tail: [860, 230] },
  { t0: 49.8, t1: 52.2, panel: 'bot', who: 'vol', text: '……人前ですよ、ゆり姉♡', x: 520, y: 100, tail: [580, 230] },
  { t0: 52.6, t1: 55.0, panel: 'bot', who: 'yuria', text: 'ほら、どんどん食べな？', x: 700, y: 100, tail: [840, 230] },
  // night 55.5-64
  { t0: 56.4, t1: 63.7, panel: 'top', who: 'cap', text: 'AM 1:30　まだスマホ', x: 540, y: 70 },
  { t0: 57.6, t1: 60.2, panel: 'bot', who: 'yuria', text: '今日もおつかれ。えらいじゃん', x: 640, y: 130, tail: [800, 250] },
  { t0: 60.6, t1: 62.8, panel: 'bot', who: 'vol', text: '……おやすみなさい', x: 300, y: 140, tail: [270, 250] },
  // ending 64-77
  { t0: 65.0, t1: 67.6, panel: 'bot', who: 'yuria', text: 'ほら、そっちも。おいで♡', x: 560, y: 140, tail: [740, 250] },
  { t0: 70.0, t1: 72.2, panel: 'full', who: 'vol', text: '席、空けてありますよ', x: 330, y: 780, tail: [330, 920] },
  { t0: 72.4, t1: 74.0, panel: 'full', who: 'man', text: '……ただいま', x: 540, y: 760, tail: [540, 900] },
  { t0: 74.1, t1: 76.4, panel: 'full', who: 'yuria', text: 'おかえり〜♡', x: 800, y: 740, tail: [800, 900] },
  { t0: 74.3, t1: 76.4, panel: 'full', who: 'vol', text: 'おかえりなさい♡', x: 290, y: 760, tail: [320, 900] },
];
const COL = { yuria: '#F0AE34', vol: '#79AEE0', man: '#9A96AE' };
function tw(str, fs) { let w = 0; for (const ch of str) w += /[\x00-\x7F]/.test(ch) ? 0.58 : 1.0; return w * fs; }
function bubbleSVG(b, t) {
  const pin = U.inv(b.t0, b.t0 + 0.18, t), pout = 1 - U.inv(b.t1 - 0.16, b.t1, t), a = Math.min(pin, pout);
  if (a <= 0) return '';
  const cap = b.who === 'cap';
  const fs = cap ? 36 : 40, lines = b.text.split('\n'), lh = fs * 1.35;
  const w = Math.max(...lines.map(l => tw(l, fs))) + (cap ? 70 : 64), h = lines.length * lh + (cap ? 30 : 34);
  const sc = 0.85 + 0.15 * U.ease.outBack(pin);
  let g = '';
  if (cap) {
    g += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="#2E2B3E" opacity=".78"/>`;
  } else {
    const c = COL[b.who];
    if (b.tail) {
      const tx = b.tail[0] - b.x, ty = b.tail[1] - b.y, bx = U.clamp(tx * 0.35, -w / 2 + 40, w / 2 - 40), by = ty > 0 ? h / 2 - 4 : -h / 2 + 4;
      g += `<path d="M${U.f(bx - 18)},${U.f(by)} L${U.f(tx * 0.8)},${U.f(ty * 0.8)} L${U.f(bx + 18)},${U.f(by)} Z" fill="#fff" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`;
    }
    g += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="30" fill="#fff" stroke="${c}" stroke-width="5"/>`;
    if (b.tail) { const tx = b.tail[0] - b.x, ty = b.tail[1] - b.y, bx = U.clamp(tx * 0.35, -w / 2 + 40, w / 2 - 40), by = ty > 0 ? h / 2 - 4 : -h / 2 + 4; g += `<path d="M${U.f(bx - 14)},${U.f(by)} L${U.f(bx + 14)},${U.f(by)}" stroke="#fff" stroke-width="9"/>`; }
  }
  lines.forEach((l, i) => {
    const ty = -h / 2 + (cap ? 15 : 17) + lh * (i + 0.5) + fs * 0.35;
    g += `<text x="0" y="${U.f(ty)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${cap ? '#FFFFFF' : '#3D3456'}">${U.esc(l)}</text>`;
  });
  let bx = b.x;
  if (b.panel !== 'full' && bx - w / 2 < 250 && b.y - h / 2 < 104) bx += 250 - (bx - w / 2);
  return `<g transform="translate(${U.f(bx)} ${b.y}) scale(${U.f(sc * 1000) / 1000})" opacity="${U.f(a * 100) / 100}">${g}</g>`;
}
const bubbles = (panel, t) => BUBS.filter(b => b.panel === panel && t >= b.t0 && t <= b.t1).map(b => bubbleSVG(b, t)).join('');
function speakingC(t, who, panel) { for (const b of BUBS) if (b.who === who && b.panel === panel && t > b.t0 + 0.05 && t < b.t1 - 0.25) return true; return false; }
function mouthC(t, who, panel, base = 'smile', open = 'open') {
  if (!speakingC(t, who, panel)) return base;
  return U.hash(Math.floor(t * 9) + (who === 'vol' ? 50 : who === 'man' ? 90 : 0)) > 0.45 ? open : base;
}

// ------------------------------------------------------------------ helpers
function hearts(tl, t0, cx, cy, n, seed, spread = 140, dur = 1.5, size = 36) {
  const p = (tl - t0) / dur; if (p < 0 || p > 1) return '';
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (U.hash(seed + i) - 0.5) * 2.4, r = spread * (0.5 + U.hash(seed + i * 3) * 0.6) * U.ease.out(p);
    s += U.heart(cx + Math.cos(a) * r, cy + Math.sin(a) * r - p * 50, size * (0.6 + U.hash(seed + i * 5) * 0.6), ['#FF7FA6', '#FF9DBB', '#FFB8CF'][i % 3], 1 - U.inv(0.6, 1, p), Math.sin(i * 2 + tl * 3) * 14);
  }
  return s;
}
function floaters(tl, t0, t1, x, y, seed, every = 0.4, size = 30) {
  let s = '';
  for (let k = 0; ; k++) {
    const ts = t0 + k * every; if (ts > t1) break;
    const p = (tl - ts) / 1.8; if (p < 0 || p > 1) continue;
    s += U.heart(x + (U.hash(seed + k) - 0.5) * 160 + Math.sin(p * 6 + k) * 14, y - p * 200, size * (0.7 + U.hash(seed + k * 2) * 0.5), ['#FF8FB1', '#FFB3CB', '#FF6F9C'][k % 3], Math.min(1, p * 6) * (1 - U.inv(0.6, 1, p)), Math.sin(tl * 4 + k) * 12);
  }
  return s;
}
const lyingY = 852, sittingY = 700;
// man in bed: up = 0 lying (head on pillow), 1 sitting
function manInBed(tl, o, up) {
  return charSVG('man', Object.assign({ x: 380, y: U.lerp(lyingY, sittingY, up), s: 1.0, t: tl, upperOnly: true, outfit: 'pajama', bedhair: true, noArmL: true, noArmR: true, tilt: (1 - up) * -8 }, o));
}

// ------------------------------------------------------------------ beats (each returns {top, bot} in panel coords)
function bWake(tl) {
  // ---- top: alone
  const ring = tl > 3.3 && tl < 5.1;
  const upT = U.seg(tl, 7.1, 7.5, 'outBack');
  let top = R.bedroom(tl, { light: 'dark', curtain: 1, clock: tl < 6.4 ? '7:00' : '7:48', clockShake: ring ? Math.sin(tl * 90) * 5 : 0, clockGlow: tl > 6.4 && tl < 7.4, mess: true });
  top += manInBed(tl, { tired: true, eyes: tl < 7.1 ? 'closed' : tl < 9.4 ? 'wide' : 'half', mouth: tl < 7.1 ? mouthC(tl, 'man', 'top', 'small', 'oSmall') : tl < 9.4 ? mouthC(tl, 'man', 'top', 'o', 'o') : 'flat', brows: tl > 7.1 ? 'worry' : 'neutral', sweat: tl > 7.3 && tl < 9.6 }, upT);
  top += R.blanket({ light: 'dark', top: U.lerp(480, 560, upT) });
  if (tl > 4.4 && tl < 5.3) top += `<path d="M590,520 C620,500 650,480 680,470" stroke="${C.pj}" stroke-width="34" stroke-linecap="round"/><circle cx="690" cy="466" r="17" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.6"/>`;
  if (ring) top += `<text x="790" y="380" font-size="40" font-weight="700" fill="#FFFFFF" transform="rotate(10 790 380)" opacity=".9">ジリリリ</text><path d="M650,410 l-20,-20 M770,410 l20,-20 M712,392 l0,-26" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`;
  if (tl > 6.4 && tl < 7.3) top += `<text x="800" y="420" font-size="80" font-weight="700" fill="#FFFFFF">!</text>`;
  // ---- bottom: with them
  const up = U.seg(tl, 8.6, 9.3, 'outBack');
  const curtain = 1 - U.seg(tl, 3.3, 4.2);
  let bot = R.bedroom(tl, { light: curtain < 0.5 ? 'day' : 'dark', curtain, clock: '7:00' });
  if (curtain >= 0.5) bot += `<rect width="${SW}" height="${PANEL}" fill="#FFFFFF" opacity="${U.f((1 - curtain) * 40) / 100}"/>`;
  bot += manInBed(tl, { tired: false, eyes: tl < 6.4 ? 'closed' : tl < 9.4 ? 'sleepy' : 'smile', mouth: mouthC(tl, 'man', 'bot', tl > 9.4 ? 'smile' : 'small', 'oSmall'), blush: tl > 9.4 ? 0.35 : 0.1, look: [0.4, 0] }, up);
  bot += R.blanket({ light: 'day', top: U.lerp(480, 560, up) });
  bot += charSVG('vol', { x: 120, y: 905, s: 0.92, t: tl, blinkSeed: 201, look: [0.7, 0], turn: 0.3, mouth: mouthC(tl, 'vol', 'bot'), blush: 0.3, itemR: null });
  bot += charSVG('yuria', { x: 900, y: 905, s: 0.92, t: tl, blinkSeed: 202, look: tl < 4.3 ? [0.5, -0.3] : [-0.7, 0], turn: -0.3, mouth: mouthC(tl, 'yuria', 'bot', 'grin', 'open'), blush: 0.3,
    armL: U.kf(tl, [[2.9, 10], [3.3, 140], [4.2, 140], [4.6, 10]]), armR: tl > 9.6 && tl < 11.4 ? 150 + Math.sin(tl * 14) * 15 : null, eyes: tl > 9.6 ? 'smile' : 'open' });
  bot += hearts(tl, 9.8, 380, 200, 6, 11);
  return { top, bot };
}

function bBreakfast(tl) {
  // ---- top: energy drink at the counter
  const drink = U.kf(tl, [[0.6, -20], [1.3, -150], [3.4, -150], [4.0, -24], [6.0, -24], [6.5, -150], [7.6, -150], [8.1, -24]]);
  const tilting = drink < -100;
  let top = R.kitchen(tl);
  top += charSVG('man', { x: 520, y: 770, s: 1.05, t: tl, blinkSeed: 211, upperOnly: true, outfit: 'suit', tieLoose: true, bedhair: true, tired: true, eyes: tilting ? 'closed' : 'half', mouth: 'flat', brows: 'worry', itemR: 'can', armR: drink, itemL: 'phoneLit', armL: -34, tilt: tilting ? -12 : 4, look: [-0.3, 0.5] });
  top += R.kitchenFront();
  // ---- bottom: breakfast together
  let bot = R.dining(tl, { mode: 'morning' });
  const rootY = 805, s = 1.05;
  bot += charSVG('vol', { x: 240, y: rootY, s, t: tl, blinkSeed: 212, upperOnly: true, look: tl > 3 && tl < 5.4 ? [0.8, 0] : [0.5, 0.2], turn: 0.3, mouth: mouthC(tl + 12, 'vol', 'bot'), blush: tl > 5.4 ? 0.8 : 0.3, eyes: tl > 5.4 ? 'half' : 'open', armR: U.kf(tl, [[0.4, 10], [0.9, 58], [2.5, 58], [3.0, 10]]), brows: tl > 5.4 ? 'soft' : 'neutral' });
  bot += charSVG('yuria', { x: 850, y: rootY, s, t: tl, blinkSeed: 213, upperOnly: true, look: [-0.7, 0], turn: -0.3, mouth: tl > 2.6 && tl < 3.2 ? 'chew' : mouthC(tl + 12, 'yuria', 'bot', 'grin', 'open'), eyes: tl > 3.0 && tl < 5.4 ? 'smile' : 'open', blush: 0.35 });
  bot += charSVG('man', { x: 545, y: rootY, s, t: tl, blinkSeed: 214, upperOnly: true, outfit: 'hoodie', tired: false, look: tl < 3 ? [-0.6, 0.3] : tl < 5.4 ? [0.6, 0] : [-0.6, 0], eyes: Math.floor(tl * 2) % 3 === 0 ? 'smile' : 'open', mouth: Math.floor(tl * 4) % 2 ? 'chew' : 'smile', blush: 0.25 });
  bot += R.table(tl, { dishes: 'breakfast' });
  bot += floaters(tl, 5.5, 8.2, 240, 200, 21, 0.4, 28);
  return { top, bot };
}

function bCommute(tl) {
  // ---- top: crowded train
  const sway = Math.sin(tl * 2.4) * 6;
  let top = R.trainBack(tl);
  top += `<path d="M${U.f(660 + sway)},110 L${U.f(660 + sway)},300" stroke="#8E89A0" stroke-width="7"/><circle cx="${U.f(660 + sway)}" cy="326" r="24" fill="none" stroke="#BDB8C8" stroke-width="8"/>`;
  top += charSVG('man', { x: 540 + sway, y: 820, s: 1.05, t: tl, blinkSeed: 221, upperOnly: true, outfit: 'suit', tired: true, eyes: 'half', mouth: mouthC(tl + 20.5, 'man', 'top', 'flat', 'oSmall'), brows: 'worry', armR: 150, tilt: -3 + sway * 0.3, look: [0, 0.3] });
  top += R.trainFront(tl);
  // ---- bottom: sent off at the door
  let bot = R.genkan(tl, { light: 'morning', door: U.seg(tl, 6.8, 7.6) });
  const handOver = tl > 3.4;
  bot += charSVG('yuria', { x: 220, y: 905, s: 0.95, t: tl, blinkSeed: 222, look: [0.6, 0], turn: 0.3, mouth: mouthC(tl + 20.5, 'yuria', 'bot', 'grin', 'open'), eyes: tl > 4.0 && tl < 6.2 ? 'smile' : 'open', blush: 0.3, armR: tl > 4.0 && tl < 6.3 ? 150 + Math.sin(tl * 14) * 16 : null });
  bot += charSVG('vol', { x: 500, y: 905, s: 0.95, t: tl, blinkSeed: 223, look: [0.7, 0], turn: 0.35, mouth: mouthC(tl + 20.5, 'vol', 'bot'), blush: 0.3, itemR: handOver ? null : 'bento', armR: U.kf(tl, [[0.2, 10], [0.7, 64], [3.3, 64], [3.8, 10]]) });
  bot += charSVG('man', { x: 800, y: 905, s: 0.95, t: tl, blinkSeed: 224, outfit: 'suit', tired: false, look: [-0.6, 0], turn: -0.3, mouth: mouthC(tl + 20.5, 'man', 'bot', 'smile', 'open'), eyes: tl > 6.1 ? 'smile' : 'open', blush: 0.2, itemL: handOver ? 'bento' : null, armL: U.kf(tl, [[2.8, 10], [3.3, 56], [3.7, 56], [4.2, 10]]) });
  bot += hearts(tl, 3.5, 680, 560, 5, 31, 110);
  return { top, bot };
}

function bLunch(tl) {
  // ---- top: konbini bento, no notifications
  let top = R.office(tl);
  top += charSVG('man', { x: 540, y: 870, s: 1.1, t: tl, blinkSeed: 231, upperOnly: true, outfit: 'suit', tired: true, eyes: 'half', mouth: Math.floor(tl * 3) % 2 ? 'chew' : 'flat', look: [0.1, 0.7], tilt: 6 });
  top += R.officeDesk(tl, { lunch: 'konbini' });
  // ---- bottom: homemade bento + messages
  let bot = R.office(tl);
  bot += charSVG('man', { x: 440, y: 870, s: 1.1, t: tl, blinkSeed: 232, upperOnly: true, outfit: 'suit', tired: false, eyes: tl > 2.0 && tl < 4.4 ? 'open' : 'smile', mouth: mouthC(tl + 28.5, 'man', 'bot', Math.floor(tl * 3) % 2 ? 'chew' : 'smile', 'open'), look: tl > 1.0 && tl < 4.4 ? [0.8, 0.1] : [0, 0.6], blush: 0.3 });
  bot += R.officeDesk(tl, { lunch: 'home' });
  // phone with family chat
  const pin = U.seg(tl, 0.6, 1.1, 'outBack');
  let ph = `<g transform="translate(860 ${U.f(330 + (1 - pin) * 600)}) rotate(4)">`;
  ph += `<rect x="-160" y="-260" width="320" height="500" rx="36" fill="#3A3650" stroke="#24212F" stroke-width="6"/><rect x="-146" y="-244" width="292" height="468" rx="26" fill="#F6F3FC"/>`;
  ph += `<rect x="-136" y="-244" width="272" height="64" rx="26" fill="#E8E0F8"/><text x="0" y="-202" text-anchor="middle" font-size="28" font-weight="700" fill="#6A5B98">家族 ♡</text>`;
  const msg = (y, who, text, t0) => {
    const a = U.seg(tl, t0, t0 + 0.3, 'outBack'); if (a <= 0) return '';
    const c = who === 'yuria' ? '#F7C84E' : '#8EC3EC';
    return `<g transform="translate(0 ${y}) scale(${U.f(a * 100) / 100})" opacity="${U.f(Math.min(1, a) * 100) / 100}"><circle cx="-104" cy="0" r="22" fill="${c}"/><text x="-104" y="9" text-anchor="middle" font-size="24" font-weight="700" fill="#fff">${who === 'yuria' ? 'ユ' : 'ヴ'}</text><rect x="-74" y="-28" width="238" height="56" rx="20" fill="#FFFFFF" stroke="${c}" stroke-width="3"/><text x="45" y="8" text-anchor="middle" font-size="20" font-weight="700" fill="#3D3456">${text}</text></g>`;
  };
  ph += msg(-120, 'yuria', 'おべんと、どう？♡', 1.4);
  ph += msg(-40, 'vol', '残さず食べてくださいね', 2.6);
  if (tl > 3.6) ph += `<g transform="translate(40 60)" opacity="${U.f(U.seg(tl, 3.6, 3.9) * 100) / 100}">${U.heart(0, 0, 70, '#FF8FB1')}<text x="0" y="70" text-anchor="middle" font-size="22" fill="#9C8FC4">ユリアがスタンプを送信</text></g>`;
  ph += `</g>`;
  bot += ph;
  bot += floaters(tl, 4.4, 7.6, 440, 300, 41, 0.45, 28);
  return { top, bot };
}

function bHome(tl) {
  // ---- top: dark, no answer
  const light = U.seg(tl, 5.6, 5.8);
  let top = R.genkan(tl, { light: 'dark', door: U.seg(tl, 0.3, 1.1) * (1 - U.seg(tl, 3.0, 3.6)), roomLight: light, mess: true });
  const mxT = U.lerp(780, 590, U.seg(tl, 1.0, 2.6));
  top += charSVG('man', { x: mxT, y: 905, s: 0.95, t: tl, blinkSeed: 241, outfit: 'suit', tieLoose: true, tired: true, walk: tl > 1.0 && tl < 2.6 ? tl * 1.2 : null, eyes: 'half', mouth: mouthC(tl + 36.5, 'man', 'top', 'flat', 'oSmall'), brows: 'worry', look: [-0.3, 0.3], armL: tl > 5.2 && tl < 6.2 ? 96 : null, lean: tl > 6.5 ? 4 : 0 });
  if (light <= 0) top += `<rect width="${SW}" height="${PANEL}" fill="#0E0C1A" opacity=".35"/>`;
  // ---- bottom: welcomed home
  let bot = R.genkan(tl, { light: 'warm', door: U.seg(tl, 0.3, 1.1) * (1 - U.seg(tl, 3.0, 3.6)) });
  const mxB = U.lerp(800, 700, U.seg(tl, 1.0, 2.4));
  const yx = tl < 1.2 ? -160 : U.lerp(-160, 420, U.seg(tl, 1.2, 2.2, 'out')) + U.seg(tl, 4.4, 5.0) * 110;
  const vx = tl < 2.0 ? -160 : U.lerp(-160, 190, U.seg(tl, 2.0, 3.2, 'out'));
  const cling = tl > 4.6;
  bot += charSVG('vol', { x: vx, y: 905, s: 0.95, t: tl, blinkSeed: 242, walk: tl > 2.0 && tl < 3.2 ? tl * 1.6 : null, look: [0.7, 0], turn: 0.35, mouth: mouthC(tl + 36.5, 'vol', 'bot'), blush: 0.35 });
  const mo = { x: mxB, y: 905, s: 0.95, t: tl, blinkSeed: 243, outfit: 'suit', tired: false, walk: tl > 1.0 && tl < 2.4 ? tl * 1.4 : null, eyes: tl > 7.6 ? 'smile' : 'open', look: [-0.6, 0], turn: -0.3, mouth: mouthC(tl + 36.5, 'man', 'bot', tl > 5 ? 'smile' : 'small', 'open'), blush: cling ? 0.6 : 0.2, sweat: tl > 4.8 && tl < 6.0 };
  const yo = { x: yx, y: 905, s: 0.95, t: tl, blinkSeed: 244, run: tl > 1.2 && tl < 2.2, walk: tl > 1.2 && tl < 2.2 ? tl * 2.4 : null, look: [0.7, 0], turn: 0.35, mouth: mouthC(tl + 36.5, 'yuria', 'bot', 'grin', 'open'), eyes: cling ? 'smile' : 'open', blush: cling ? 0.7 : 0.35, armR: cling ? 74 : null, lean: cling ? 6 : 0 };
  bot += layered([['yuria', yo, 'back'], ['man', mo, 'back'], ['yuria', yo, 'body'], ['man', mo, 'body'], ['yuria', yo, 'head'], ['man', mo, 'head']]);
  bot += hearts(tl, 4.9, 620, 380, 7, 51, 150);
  return { top, bot };
}

function bDinner(tl) {
  // ---- top: cup ramen at the PC
  const eat = U.kf(tl, [[1.0, -30], [1.5, -150], [2.6, -150], [3.1, -30], [5.0, -30], [5.5, -150], [6.6, -150], [7.1, -30]]);
  let top = R.pcRoom(tl);
  top += charSVG('man', { x: 620, y: 880, s: 1.1, t: tl, blinkSeed: 251, upperOnly: true, outfit: 'hoodie', tired: true, eyes: 'half', mouth: eat < -100 ? 'chew' : 'flat', look: [-0.8, 0], turn: -0.3, itemR: 'chop', armR: eat, brows: 'worry' });
  top += R.pcDesk(tl);
  top += `<rect width="${SW}" height="${PANEL}" fill="#7FB6F0" opacity=".08"/>`;
  // ---- bottom: nabe with them
  const feed = U.kf(tl, [[0.6, 10], [1.2, 96], [3.0, 96], [3.5, 10]]);
  const vLean = U.kf(tl, [[2.0, 0], [2.5, 10], [3.0, 10], [3.4, 0]]);
  let bot = R.dining(tl, { mode: 'night' });
  bot += charSVG('man', { x: 210, y: 805, s: 1.05, t: tl, blinkSeed: 252, upperOnly: true, outfit: 'hoodie', tired: false, look: tl < 6.2 ? [0.8, 0] : [0.8, 0], turn: 0.3, eyes: tl > 6.2 ? 'smile' : 'open', mouth: tl > 6.2 ? 'grin' : 'smile', blush: 0.35 });
  bot += charSVG('vol', { x: 580, y: 805, s: 1.05, t: tl, blinkSeed: 253, upperOnly: true, look: [0.7, 0], turn: 0.3, lean: vLean, eyes: tl > 2.4 ? 'half' : 'open', mouth: tl > 2.3 && tl < 3.4 ? 'chew' : mouthC(tl + 46.5, 'vol', 'bot', 'smile', 'open'), blush: tl > 2.4 ? 0.85 : 0.4, brows: 'soft' });
  bot += charSVG('yuria', { x: 870, y: 805, s: 1.05, t: tl, blinkSeed: 254, upperOnly: true, look: tl > 6.0 ? [-0.9, 0] : [-0.7, 0], turn: -0.35, eyes: tl > 3.4 && tl < 6.0 ? 'smile' : 'open', mouth: mouthC(tl + 46.5, 'yuria', 'bot', 'grin', 'open'), blush: 0.5, itemL: tl < 3.0 ? 'chopL' : null, armL: feed });
  bot += R.table(tl, { dishes: 'nabe' });
  bot += hearts(tl, 2.5, 640, 260, 6, 61, 120);
  bot += floaters(tl, 3.0, 5.6, 600, 200, 63, 0.4, 26);
  return { top, bot };
}

function bNight(tl) {
  // ---- top: awake with the phone at 1:30
  let top = R.bedroom(tl, { light: 'dark', curtain: 1, clock: '1:30', mess: true });
  top += manInBed(tl, { tired: true, eyes: 'half', mouth: 'flat', look: [0, -0.6], brows: 'worry' }, 0);
  top += R.blanket({ light: 'dark', top: 480 });
  top += `<circle cx="380" cy="400" r="170" fill="#BFE0FF" opacity=".22" filter="url(#fBlur20)"/><g transform="translate(430 250) rotate(-8) scale(1.5)"><rect x="-18" y="-32" width="36" height="62" rx="7" fill="#3A3650" stroke="#24212F" stroke-width="2.4"/><circle cx="8" cy="-22" r="3" fill="#6E6A82"/></g><path d="M420,300 C440,330 450,360 440,400" stroke="${C.pj}" stroke-width="26" stroke-linecap="round"/><circle cx="428" cy="292" r="14" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.4"/>`;
  top += `<rect width="${SW}" height="${PANEL}" fill="#0E0C1A" opacity=".38"/>`;
  // ---- bottom: dozing on the sofa, blanket from Vol
  const dim = U.seg(tl, 6.4, 8.2) * 0.22;
  let bot = R.living(tl);
  const bl = U.seg(tl, 0.8, 2.0);
  bot += charSVG('vol', { x: 290, y: 810, s: 1.0, t: tl, blinkSeed: 261, upperOnly: true, look: [0.7, 0.2], turn: 0.3, mouth: mouthC(tl + 55.5, 'vol', 'bot', 'smile', 'oSmall'), blush: 0.4, armR: U.kf(tl, [[0.6, 10], [1.0, 60], [2.0, 60], [2.4, 10]]), brows: 'soft' });
  bot += charSVG('yuria', { x: 800, y: 810, s: 1.0, t: tl, blinkSeed: 262, upperOnly: true, look: [-0.8, 0.2], turn: -0.35, mouth: mouthC(tl + 55.5, 'yuria', 'bot', 'smile', 'oSmall'), eyes: tl > 4.4 ? 'smile' : 'half', blush: 0.5, lean: -4, brows: 'soft' });
  bot += charSVG('man', { x: 545, y: 822, s: 1.0, t: tl, upperOnly: true, outfit: 'hoodie', tired: false, eyes: 'closed', mouth: 'oSmall', tilt: 14, lean: 3, blush: 0.25, blink: 0 });
  bot += R.sofaFront(tl);
  if (bl > 0) bot += `<path d="M${U.f(U.lerp(330, 400, bl))},560 C${U.f(U.lerp(380, 450, bl))},520 ${U.f(U.lerp(420, 650, bl))},520 ${U.f(U.lerp(440, 700, bl))},560 L${U.f(U.lerp(440, 720, bl))},700 L${U.f(U.lerp(330, 380, bl))},700 Z" fill="#FFC4D3" stroke="#E58FAE" stroke-width="4"/>`;
  bot += `<text x="${U.f(600 + (tl * 20) % 40)}" y="${U.f(260 - (tl * 30) % 60)}" font-size="38" font-weight="700" fill="#B5A8E6" opacity=".8">z</text>`;
  bot += floaters(tl, 3.0, 7.6, 545, 260, 71, 0.5, 24);
  if (dim) bot += `<rect width="${SW}" height="${PANEL}" fill="#2A2050" opacity="${U.f(dim * 100) / 100}"/>`;
  return { top, bot };
}

// ending (split part): the man alone above, Yuria reaching up from below
function bEndSplit(tl) {
  let top = R.bedroom(tl, { light: 'dark', curtain: 1, clock: '1:42', mess: true });
  const lookDown = tl > 2.6;
  top += manInBed(tl, { tired: true, eyes: tl > 3.0 ? 'wide' : 'half', mouth: tl > 3.0 ? 'o' : 'flat', look: lookDown ? [0.5, 0.9] : [0, 0.6], brows: 'worry', noArmL: false, noArmR: false, armL: -30, itemL: 'phoneLit', armR: tl > 4.0 ? 40 : 10 }, 1);
  top += R.blanket({ light: 'dark', top: 560 });
  top += `<rect width="${SW}" height="${PANEL}" fill="#0E0C1A" opacity=".3"/>`;
  let bot = R.living(tl);
  bot += charSVG('vol', { x: 290, y: 810, s: 1.0, t: tl, blinkSeed: 271, upperOnly: true, look: tl > 1.4 ? [0.3, -0.9] : [0.7, 0], turn: 0.3, mouth: 'smile', blush: 0.4, brows: 'soft' });
  bot += charSVG('yuria', { x: 790, y: 810, s: 1.0, t: tl, blinkSeed: 272, upperOnly: true, look: tl > 0.6 ? [-0.2, -1] : [-0.7, 0], turn: -0.2, mouth: mouthC(tl + 64, 'yuria', 'bot', 'smile', 'open'), blush: 0.45, armL: U.kf(tl, [[2.4, 10], [2.9, 172]]), brows: 'soft' });
  bot += `<rect x="470" y="540" width="140" height="70" rx="20" fill="#E6CFF4" opacity=".8"/>`;
  bot += R.sofaFront(tl);
  return { top, bot };
}
// ending (merged): everyone on the sofa, full screen
function sEndFull(tl) {
  const k = 1.45, ox = -243, oy = SH - 930 * k;
  let s = `<rect width="${SW}" height="${SH}" fill="#F6E2DA"/>`;
  for (let x = 0; x < SW; x += 60) s += `<rect x="${x}" y="0" width="30" height="${SH}" fill="#FAE9E2" opacity=".35"/>`;
  // garland
  s += `<path d="M-20,140 Q270,260 540,150 Q810,260 1100,140" fill="none" stroke="#C9B6EE" stroke-width="4"/>`;
  for (let i = 1; i < 12; i++) { const u = i / 12, x = -20 + u * 1120, y = 140 + Math.sin(u * Math.PI * 2) ** 2 * 70 + 20; s += i % 2 ? U.heart(x, y + 16, 40, ['#FFB3CB', '#FFE08A', '#BFE0FF'][i % 3]) : U.sparkle(x, y + 10, 16, '#F2C44E'); }
  s += `<g transform="translate(${ox} ${oy}) scale(${k})">`;
  s += R.living(tl + 64);
  const vo = { x: 300, y: 812, s: 1.0, t: tl, blinkSeed: 281, upperOnly: true, look: [0.6, 0], turn: 0.3, mouth: mouthC(tl + 64, 'vol', 'full', 'smile', 'open'), blush: 0.5, brows: 'soft', eyes: tl > 9 ? 'smile' : 'open' };
  const yo = { x: 780, y: 812, s: 1.0, t: tl, blinkSeed: 282, upperOnly: true, look: [-0.6, 0], turn: -0.3, mouth: mouthC(tl + 64, 'yuria', 'full', 'grin', 'open'), blush: 0.5, eyes: tl > 9.2 ? 'smile' : 'open' };
  const mo = { x: 540, y: 812, s: 1.0, t: tl, blinkSeed: 283, upperOnly: true, outfit: 'pajama', tired: false, look: [0, 0.1], mouth: mouthC(tl + 64, 'man', 'full', 'smile', 'open'), blush: 0.6, eyes: tl > 9.8 ? 'smile' : 'open', tear: tl > 7.6 && tl < 9.8 };
  s += layered([['vol', vo, 'back'], ['yuria', yo, 'back'], ['man', mo, 'back'], ['vol', vo, 'front'], ['yuria', yo, 'front'], ['man', mo, 'front']]);
  s += R.sofaFront(tl);
  s += `</g>`;
  s += floaters(tl, 6.0, 12.6, 540, 1250, 81, 0.35, 40);
  s += hearts(tl, 10.1, 540, 1000, 10, 83, 300, 1.8, 60);
  // final title
  const a = U.seg(tl, 10.4, 11.2);
  if (a > 0) {
    s += `<g opacity="${U.f(a * 100) / 100}" transform="translate(0 ${U.f((1 - a) * 30)})">`;
    s += `<text x="540" y="400" text-anchor="middle" font-size="64" font-weight="700" fill="#7A6AB0" stroke="#fff" stroke-width="12" paint-order="stroke">ユリアとヴォルが</text>`;
    s += `<text x="540" y="530" text-anchor="middle" font-size="120" font-weight="700" fill="#FF7FA6" stroke="#fff" stroke-width="18" paint-order="stroke" letter-spacing="8">いる生活</text>`;
    s += U.heart(220, 490, 60, '#FFB3CB') + U.heart(860, 490, 60, '#FFB3CB') + `</g>`;
  }
  return s;
}

// ------------------------------------------------------------------ timeline
const BEATS = [
  { id: 'wake', start: 0, dur: 12, time: 'AM 7:00', label: '起床', fn: bWake },
  { id: 'breakfast', start: 12, dur: 8.5, time: 'AM 7:30', label: '朝ごはん', fn: bBreakfast },
  { id: 'commute', start: 20.5, dur: 8, time: 'AM 8:10', label: '出勤', fn: bCommute },
  { id: 'lunch', start: 28.5, dur: 8, time: 'PM 12:30', label: '昼休み', fn: bLunch },
  { id: 'home', start: 36.5, dur: 10, time: 'PM 9:40', label: '帰宅', fn: bHome },
  { id: 'dinner', start: 46.5, dur: 9, time: 'PM 10:15', label: '夕ごはん', fn: bDinner },
  { id: 'night', start: 55.5, dur: 8.5, time: 'AM 1:00', label: '夜', fn: bNight },
  { id: 'ending', start: 64, dur: 13, time: 'AM 1:42', label: '', fn: bEndSplit },
];
const DURATION = 77;
const SLIDE = 0.45;

function gloomFilter(sat) {
  const k = 1 - sat; // 0 = normal, 1 = gloomy
  return `<filter id="fGloom" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${U.f((1 - 0.85 * k) * 100) / 100}"/><feComponentTransfer>
    <feFuncR type="linear" slope="${U.f((1 - 0.2 * k) * 100) / 100}" intercept="${U.f(0.02 * k * 100) / 100}"/>
    <feFuncG type="linear" slope="${U.f((1 - 0.18 * k) * 100) / 100}" intercept="${U.f(0.03 * k * 100) / 100}"/>
    <feFuncB type="linear" slope="${U.f((1 - 0.1 * k) * 100) / 100}" intercept="${U.f(0.07 * k * 100) / 100}"/></feComponentTransfer></filter>`;
}
function label(which, a = 1) {
  const without = which === 'top';
  const txt = without ? 'いない生活' : 'いる生活', fs = 40, w = tw(txt, fs) + 104;
  return `<g transform="translate(26 26)" opacity="${a}"><rect x="0" y="4" width="${w}" height="70" rx="35" fill="#000" opacity=".15"/><rect x="0" y="0" width="${w}" height="70" rx="35" fill="${without ? '#5E5B70' : '#FF7FA6'}" stroke="#fff" stroke-width="4"/>
    ${without ? `<g transform="translate(44 36)"><path d="${U.heartD}" transform="scale(40)" fill="#9C98B0"/><path d="M-2,-12 L4,-2 L-3,6 L2,16" fill="none" stroke="#5E5B70" stroke-width="4"/></g>` : U.heart(44, 36, 40, '#FFFFFF')}
    <text x="76" y="49" font-size="${fs}" font-weight="700" fill="#fff">${txt}</text></g>`;
}
function bandSVG(beat, tl, a = 1) {
  const pop = U.ease.outBack(U.inv(0, 0.35, tl));
  const txt = beat.label ? `${beat.time}　${beat.label}` : beat.time;
  const w = tw(txt, 38) + 90;
  return `<g opacity="${a}"><rect x="0" y="${PANEL}" width="${SW}" height="${BAND}" fill="#FFFFFF"/><rect x="0" y="${PANEL}" width="${SW}" height="6" fill="#E6DDF6"/><rect x="0" y="${BOTY - 6}" width="${SW}" height="6" fill="#FFD3E2"/>
    <g transform="translate(540 ${PANEL + BAND / 2}) scale(${U.f((0.7 + 0.3 * pop) * 1000) / 1000})"><rect x="${-w / 2}" y="-36" width="${w}" height="72" rx="36" fill="#FFFFFF" stroke="#C9B6EE" stroke-width="5"/>
    <text x="0" y="13" text-anchor="middle" font-size="38" font-weight="700" fill="#6A5B98">${txt}</text></g></g>`;
}
function panelPair(i, tl) { return BEATS[i].fn(tl); }

window.renderFrame = function (t) {
  U.resetUid();
  let i = 0;
  for (let k = 0; k < BEATS.length; k++) if (t >= BEATS[k].start) i = k;
  const beat = BEATS[i], tl = t - beat.start;
  const ending = beat.id === 'ending';
  let out = `<defs>${B.defs}${R.defs}`;
  // gloom amount (top panel) — lifts during the merge
  const lift = ending ? U.seg(tl, 4.4, 5.4) : 0;
  out += gloomFilter(lift) + `<clipPath id="clipTop"><rect x="0" y="0" width="${SW}" height="${PANEL}"/></clipPath><clipPath id="clipBot"><rect x="0" y="0" width="${SW}" height="${PANEL}"/></clipPath></defs>`;
  const full = ending && tl >= 5.0;
  if (!full) {
    // panels (with a horizontal slide between beats)
    let top, bot;
    if (i > 0 && tl < SLIDE) {
      const p = U.ease.inOut(tl / SLIDE), prev = BEATS[i - 1];
      const A = panelPair(i - 1, prev.dur - 0.01), Bp = panelPair(i, tl);
      top = `<g transform="translate(${U.f(-SW * p)} 0)">${A.top}</g><g transform="translate(${U.f(SW * (1 - p))} 0)">${Bp.top}</g>`;
      bot = `<g transform="translate(${U.f(SW * p)} 0)">${A.bot}</g><g transform="translate(${U.f(-SW * (1 - p))} 0)">${Bp.bot}</g>`;
    } else {
      const P = panelPair(i, tl); top = P.top; bot = P.bot;
    }
    out += `<g clip-path="url(#clipTop)"><g filter="url(#fGloom)">${top}</g>${bubbles('top', t)}${label('top', U.f((1 - lift) * 100) / 100)}</g>`;
    out += `<g transform="translate(0 ${BOTY})"><g clip-path="url(#clipBot)">${bot}${bubbles('bot', t)}${label('bot')}</g></g>`;
    out += bandSVG(beat, tl, U.f((1 - lift) * 100) / 100);
    // the reach across the divider
    if (ending && tl > 2.6) {
      const r = U.seg(tl, 2.6, 4.2);
      const x0 = 790 - 52 + 0, y0 = BOTY + 810 - 296 - 112;
      const y1 = U.lerp(y0, 520, r);
      out += `<path d="M${x0 + 20},${y0} C${x0 + 20},${U.f(y0 - 80)} ${U.f(U.lerp(x0, 520, r))},${U.f(y1 + 120)} ${U.f(U.lerp(x0, 520, r))},${U.f(y1)}" fill="none" stroke="#FFF1C9" stroke-width="${U.f(10 + r * 6)}" stroke-linecap="round" opacity=".9" filter="url(#fBlur3)"/>`;
      out += `<circle cx="${U.f(U.lerp(x0, 520, r))}" cy="${U.f(y1)}" r="${U.f(26 + r * 10)}" fill="#FFF6D6" opacity=".95" filter="url(#fBlur3)"/>` + U.heart(U.lerp(x0, 520, r), y1, 40, '#FF8FB1', 1);
      if (tl > 4.0) out += hearts(tl, 4.1, 520, 520, 10, 91, 220, 1.4, 50) + sparkles2(tl, 320, 360, 400, 300, 8, 93);
    }
    if (ending && tl > 4.2) out += `<rect width="${SW}" height="${SH}" fill="#FFFFFF" opacity="${U.f(U.seg(tl, 4.2, 5.0) * 100) / 100}"/>`;
  } else {
    out += sEndFull(tl);
    out += bubbles('full', t);
    if (tl < 5.8) out += `<rect width="${SW}" height="${SH}" fill="#FFFFFF" opacity="${U.f((1 - U.seg(tl, 5.0, 5.8)) * 100) / 100}"/>`;
  }
  // title card at the very beginning
  if (t < 3.6) {
    const a = Math.min(U.seg(t, 0.15, 0.55, 'out'), 1 - U.inv(3.1, 3.6, t));
    out += `<g opacity="${U.f(a * 100) / 100}" transform="translate(540 960) scale(${U.f((0.9 + 0.1 * U.ease.outBack(U.inv(0.15, 0.6, t))) * 1000) / 1000})">
      <rect x="-470" y="-190" width="940" height="380" rx="48" fill="#000" opacity=".18" transform="translate(0 10)"/><rect x="-470" y="-190" width="940" height="380" rx="48" fill="#FFFFFF" stroke="#C9B6EE" stroke-width="6"/>
      <text x="0" y="-82" text-anchor="middle" font-size="60" font-weight="700" fill="#7A6AB0">ユリアとヴォルが</text>
      <text x="-215" y="60" text-anchor="middle" font-size="84" font-weight="700" fill="#6E6A82">いない</text><text x="0" y="52" text-anchor="middle" font-size="52" font-weight="700" fill="#B9AED0">と</text><text x="215" y="60" text-anchor="middle" font-size="84" font-weight="700" fill="#FF7FA6">いる</text>
      <text x="0" y="148" text-anchor="middle" font-size="54" font-weight="700" fill="#7A6AB0">生活</text>${U.heart(380, 40, 56, '#FFB3CB')}</g>`;
  }
  if (t > DURATION - 0.9) out += `<rect width="${SW}" height="${SH}" fill="#FFFFFF" opacity="${U.f(U.inv(DURATION - 0.9, DURATION, t) * 100) / 100}"/>`;
  if (t < 0.4) out += `<rect width="${SW}" height="${SH}" fill="#FFFFFF" opacity="${U.f((1 - t / 0.4) * 100) / 100}"/>`;
  document.getElementById('content').innerHTML = out;
};
function sparkles2(tl, x, y, w, h, n, seed) {
  let s = '';
  for (let i = 0; i < n; i++) { const ph = (tl * (0.6 + U.hash(seed + i) * 0.8) + U.hash(seed + i * 9)) % 1, a = Math.sin(ph * Math.PI); s += U.sparkle(x + U.hash(seed + i * 2) * w, y + U.hash(seed + i * 4) * h, 10 + 16 * a, '#FFF6D6', a * 0.95, ph * 90); }
  return s;
}
window.DURATION = DURATION;
window.SCENES = BEATS.map(b => ({ id: b.id, start: b.start, dur: b.dur }));
window.ALL_TEXT = BUBS.map(b => b.text).join('') + BEATS.map(b => b.time + b.label).join('') + 'ユリアとヴォルがいないといる生活家族♡おべんと、どう？残さず食べてねユリアがスタンプを送信ジリリリ!★0123456789:AMPM';
