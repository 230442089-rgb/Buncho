// comp2.js — "lifetime" edition: without them (top) sinks from 25 to a lonely death at 72; with them (bottom).
const SW = 1080, SH = 1920, PANEL = 930, BAND = 60, BOTY = PANEL + BAND;

// ------------------------------------------------------------------ bubbles (panel coords)
const BUBS = [
  // 25 — morning (0-8)
  { t0: 1.9, t1: 3.6, panel: 'top', who: 'man', text: '……あと5分', x: 640, y: 270, tail: [430, 420] },
  { t0: 5.2, t1: 6.9, panel: 'top', who: 'man', text: '……やば', x: 640, y: 170, tail: [440, 290] },
  { t0: 1.6, t1: 3.6, panel: 'bot', who: 'yuria', text: 'おっはよー！　朝だよ〜♡', x: 700, y: 150, tail: [880, 330] },
  { t0: 3.8, t1: 5.7, panel: 'bot', who: 'vol', text: '朝ごはん、できてますよ', x: 470, y: 160, tail: [150, 330] },
  { t0: 6.3, t1: 7.8, panel: 'bot', who: 'man', text: '……おはよ', x: 660, y: 170, tail: [450, 300] },
  // 32 — birthday (8-17)
  { t0: 8.4, t1: 12.2, panel: 'top', who: 'cap', text: '32歳の誕生日', x: 540, y: 74 },
  { t0: 12.4, t1: 16.8, panel: 'top', who: 'cap', text: 'おめでとうメッセージ：0件', x: 540, y: 74 },
  { t0: 13.6, t1: 15.6, panel: 'top', who: 'man', text: '……おめでと、俺', x: 780, y: 250, tail: [600, 380] },
  { t0: 8.9, t1: 10.9, panel: 'bot', who: 'yuria', text: '32歳、おめでと〜♡', x: 760, y: 110, tail: [850, 230] },
  { t0: 11.3, t1: 13.5, panel: 'bot', who: 'vol', text: 'ケーキ、ちゃんと甘めにしましたよ', x: 470, y: 150, tail: [250, 300] },
  { t0: 14.4, t1: 16.4, panel: 'bot', who: 'man', text: '……ありがとな', x: 760, y: 140, tail: [560, 260] },
  // 38 — overtime / fireworks (17-26)
  { t0: 17.8, t1: 20.2, panel: 'top', who: 'boss', text: 'やり直し。朝までにな', x: 420, y: 120, tail: [250, 230] },
  { t0: 20.4, t1: 22.0, panel: 'top', who: 'man', text: '……すみません', x: 860, y: 200, tail: [700, 330] },
  { t0: 22.2, t1: 25.8, panel: 'top', who: 'cap', text: '残業：月120時間', x: 540, y: 74 },
  { t0: 18.0, t1: 19.6, panel: 'bot', who: 'yuria', text: 'たまや〜！', x: 760, y: 130, tail: [790, 250] },
  { t0: 20.2, t1: 22.8, panel: 'bot', who: 'vol', text: '……来年も、三人で見ましょうね', x: 470, y: 150, tail: [300, 260] },
  // 45 — layoff (26-35.5)
  { t0: 26.4, t1: 30.0, panel: 'top', who: 'cap', text: '45歳　リストラ', x: 540, y: 74 },
  { t0: 31.0, t1: 35.2, panel: 'top', who: 'cap', text: '再就職　不採用48社', x: 540, y: 74 },
  { t0: 32.8, t1: 34.8, panel: 'top', who: 'man', text: '……また、ダメか', x: 800, y: 220, tail: [700, 330] },
  { t0: 27.0, t1: 29.2, panel: 'bot', who: 'yuria', text: 'いいじゃん、ちょっと休みな？', x: 700, y: 110, tail: [850, 230] },
  { t0: 29.6, t1: 32.0, panel: 'bot', who: 'vol', text: '次のことは、一緒に考えましょう', x: 470, y: 150, tail: [250, 300] },
  { t0: 32.6, t1: 34.6, panel: 'bot', who: 'man', text: '……そうだな', x: 760, y: 140, tail: [560, 260] },
  // 52 — mother's funeral (35.5-45.5)
  { t0: 35.9, t1: 39.5, panel: 'top', who: 'cap', text: '52歳　母が亡くなる', x: 540, y: 74 },
  { t0: 39.7, t1: 45.2, panel: 'top', who: 'cap', text: '参列者：1人', x: 540, y: 74 },
  { t0: 40.6, t1: 42.6, panel: 'top', who: 'man', text: '……母さん', x: 780, y: 300, tail: [600, 420] },
  { t0: 37.5, t1: 39.9, panel: 'bot', who: 'vol', text: '……泣いて、いいんですよ', x: 400, y: 180, tail: [300, 330] },
  { t0: 40.5, t1: 41.9, panel: 'bot', who: 'man', text: '……うん', x: 640, y: 180, tail: [560, 330] },
  { t0: 42.4, t1: 45.0, panel: 'bot', who: 'yuria', text: '……あーしら、ここにいるから', x: 700, y: 180, tail: [780, 330] },
  // 60 — alone among the bags / cherry blossoms (45.5-54.5)
  { t0: 46.0, t1: 54.2, panel: 'top', who: 'cap', text: '最後に人と話したのは、41日前', x: 540, y: 74 },
  { t0: 49.5, t1: 52.0, panel: 'top', who: 'man', text: '……今日、何曜日だっけ', x: 760, y: 260, tail: [560, 390] },
  { t0: 46.5, t1: 49.3, panel: 'bot', who: 'yuria', text: '白髪、増えたじゃん。\n……似合ってるけど♡', x: 760, y: 140, tail: [790, 290] },
  { t0: 49.7, t1: 52.2, panel: 'bot', who: 'vol', text: '来年の桜も、予約しておきますね', x: 470, y: 160, tail: [300, 300] },
  // 68 — collapse / nursing (54.5-64.5)
  { t0: 54.9, t1: 58.1, panel: 'top', who: 'cap', text: '68歳　夜中に倒れる', x: 540, y: 74 },
  { t0: 58.3, t1: 61.3, panel: 'top', who: 'cap', text: 'スマホに、手が届かない', x: 540, y: 74 },
  { t0: 61.5, t1: 64.3, panel: 'top', who: 'cap', text: '朝まで、誰も来なかった', x: 540, y: 74 },
  { t0: 56.6, t1: 58.6, panel: 'top', who: 'man', text: '……だれ、か……', x: 420, y: 560, tail: [380, 700] },
  { t0: 55.5, t1: 57.9, panel: 'bot', who: 'vol', text: 'お薬、作っておきました', x: 400, y: 150, tail: [150, 330] },
  { t0: 58.3, t1: 61.1, panel: 'bot', who: 'yuria', text: '早く治しなって。\n……心配すんじゃん', x: 700, y: 140, tail: [880, 330] },
  { t0: 61.6, t1: 63.2, panel: 'bot', who: 'man', text: '……悪いな', x: 650, y: 170, tail: [450, 300] },
  // 72 — the last night (64.5-82)
  { t0: 64.9, t1: 68.1, panel: 'top', who: 'cap', text: '72歳　冬の夜', x: 540, y: 74 },
  { t0: 69.3, t1: 71.5, panel: 'top', who: 'man', text: '……ひとり、か', x: 760, y: 420, tail: [560, 540] },
  { t0: 73.5, t1: 76.6, panel: 'top', who: 'cap', text: '享年72', x: 540, y: 74 },
  { t0: 79.3, t1: 81.8, panel: 'top', who: 'other', text: 'すみませーん、\nいらっしゃいますかー？', x: 790, y: 210, tail: [980, 330] },
  { t0: 66.5, t1: 68.7, panel: 'bot', who: 'man', text: '……ありがと、な', x: 600, y: 200, tail: [430, 380] },
  { t0: 69.3, t1: 72.1, panel: 'bot', who: 'yuria', text: '……おつかれ。\nずっと、えらかったじゃん', x: 690, y: 150, tail: [880, 330] },
  { t0: 72.7, t1: 75.5, panel: 'bot', who: 'vol', text: 'おやすみなさい。\n……ずっと、隣にいますから', x: 430, y: 150, tail: [150, 330] },
];
const COL = { yuria: '#F0AE34', vol: '#79AEE0', man: '#9A96AE', boss: '#B23A3A', other: '#8A8698' };
function tw(str, fs) { let w = 0; for (const ch of str) w += /[\x00-\x7F]/.test(ch) ? 0.58 : 1.0; return w * fs; }
function bubbleSVG(b, t) {
  const pin = U.inv(b.t0, b.t0 + 0.18, t), pout = 1 - U.inv(b.t1 - 0.16, b.t1, t), a = Math.min(pin, pout);
  if (a <= 0) return '';
  const cap = b.who === 'cap';
  const fs = cap ? 38 : 40, lines = b.text.split('\n'), lh = fs * 1.35;
  const w = Math.max(...lines.map(l => tw(l, fs))) + (cap ? 76 : 64), h = lines.length * lh + (cap ? 32 : 34);
  const sc = 0.85 + 0.15 * U.ease.outBack(pin);
  let g = '';
  if (cap) g += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="#16141F" opacity=".82"/>`;
  else {
    const c = COL[b.who], dark = b.who === 'boss';
    const fill = dark ? '#2A1E24' : '#fff';
    if (b.tail) {
      const tx = b.tail[0] - b.x, ty = b.tail[1] - b.y, bx = U.clamp(tx * 0.35, -w / 2 + 40, w / 2 - 40), by = ty > 0 ? h / 2 - 4 : -h / 2 + 4;
      g += `<path d="M${U.f(bx - 18)},${U.f(by)} L${U.f(tx * 0.8)},${U.f(ty * 0.8)} L${U.f(bx + 18)},${U.f(by)} Z" fill="${fill}" stroke="${c}" stroke-width="5" stroke-linejoin="round"/>`;
      g += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${dark ? 8 : 30}" fill="${fill}" stroke="${c}" stroke-width="5"/>`;
      g += `<path d="M${U.f(bx - 14)},${U.f(by)} L${U.f(bx + 14)},${U.f(by)}" stroke="${fill}" stroke-width="9"/>`;
    } else g += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="30" fill="${fill}" stroke="${c}" stroke-width="5"/>`;
  }
  lines.forEach((l, i) => {
    const ty = -h / 2 + (cap ? 16 : 17) + lh * (i + 0.5) + fs * 0.35;
    g += `<text x="0" y="${U.f(ty)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="${cap ? '#FFFFFF' : b.who === 'boss' ? '#FF9A9A' : '#3D3456'}">${U.esc(l)}</text>`;
  });
  let bx = b.x;
  if (bx - w / 2 < 250 && b.y - h / 2 < 104) bx += 250 - (bx - w / 2);
  return `<g transform="translate(${U.f(bx)} ${b.y}) scale(${U.f(sc * 1000) / 1000})" opacity="${U.f(a * 100) / 100}">${g}</g>`;
}
const bubbles = (panel, t) => BUBS.filter(b => b.panel === panel && t >= b.t0 && t <= b.t1).map(b => bubbleSVG(b, t)).join('');
function speakingC(t, who, panel) { for (const b of BUBS) if (b.who === who && b.panel === panel && t > b.t0 + 0.05 && t < b.t1 - 0.25) return true; return false; }
function mouthC(t, who, panel, base = 'smile', open = 'open') {
  if (!speakingC(t, who, panel)) return base;
  return U.hash(Math.floor(t * 9) + (who === 'vol' ? 50 : who === 'man' ? 90 : 0)) > 0.45 ? open : base;
}
function capBox(text, x, y, a = 1) { return bubbleSVG({ t0: -1e9, t1: 1e9, who: 'cap', text, x, y }, 0).replace(/opacity="1"/, `opacity="${U.f(a * 100) / 100}"`); }
function hearts(tl, t0, cx, cy, n, seed, spread = 140, dur = 1.5, size = 36) {
  const p = (tl - t0) / dur; if (p < 0 || p > 1) return '';
  let s = '';
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (U.hash(seed + i) - 0.5) * 2.4, r = spread * (0.5 + U.hash(seed + i * 3) * 0.6) * U.ease.out(p); s += U.heart(cx + Math.cos(a) * r, cy + Math.sin(a) * r - p * 50, size * (0.6 + U.hash(seed + i * 5) * 0.6), ['#FF7FA6', '#FF9DBB', '#FFB8CF'][i % 3], 1 - U.inv(0.6, 1, p), Math.sin(i * 2 + tl * 3) * 14); }
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
function manInBed(tl, o, up) {
  return charSVG('man', Object.assign({ x: 380, y: U.lerp(lyingY, sittingY, up), s: 1.0, t: tl, upperOnly: true, outfit: 'pajama', noArmL: true, noArmR: true, tilt: (1 - up) * -8 }, o));
}
const seat3 = (y = 810) => ({ v: { x: 300, y }, m: { x: 545, y }, yu: { x: 790, y } });
const lonely = (age, extra = {}) => Object.assign({ age, tired: true, stubble: age >= 38, glasses: age >= 45, gaunt: age >= 60 }, extra);
const loved = (age, extra = {}) => Object.assign({ age, tired: false, glasses: age >= 45 }, extra);

// ------------------------------------------------------------------ beats
function b25(tl) {
  const ring = tl > 1.4 && tl < 3.0;
  const upT = U.seg(tl, 4.9, 5.3, 'outBack');
  let top = R.bedroom(tl, { light: 'dark', curtain: 1, clock: tl < 4.4 ? '7:00' : '7:48', clockShake: ring ? Math.sin(tl * 90) * 5 : 0, clockGlow: tl > 4.4 && tl < 5.2, mess: true });
  top += manInBed(tl, lonely(25, { bedhair: true, eyes: tl < 4.9 ? 'closed' : tl < 7 ? 'wide' : 'half', mouth: tl < 4.9 ? mouthC(tl, 'man', 'top', 'small', 'oSmall') : mouthC(tl, 'man', 'top', 'o', 'o'), brows: tl > 4.9 ? 'worry' : 'neutral', sweat: tl > 5 && tl < 7.4 }), upT);
  top += R.blanket({ light: 'dark', top: U.lerp(480, 560, upT) });
  if (tl > 2.4 && tl < 3.2) top += `<path d="M590,520 C620,500 650,480 680,470" stroke="${C.pj}" stroke-width="34" stroke-linecap="round"/><circle cx="690" cy="466" r="17" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.6"/>`;
  if (ring) top += `<text x="790" y="380" font-size="40" font-weight="700" fill="#FFFFFF" transform="rotate(10 790 380)" opacity=".9">ジリリリ</text>`;
  const up = U.seg(tl, 5.7, 6.3, 'outBack'), curtain = 1 - U.seg(tl, 1.2, 2.0);
  let bot = R.bedroom(tl, { light: curtain < 0.5 ? 'day' : 'dark', curtain, clock: '7:00' });
  if (curtain >= 0.5) bot += `<rect width="${SW}" height="${PANEL}" fill="#FFFFFF" opacity="${U.f((1 - curtain) * 40) / 100}"/>`;
  bot += manInBed(tl, loved(25, { bedhair: true, eyes: tl < 4 ? 'closed' : tl < 6.3 ? 'sleepy' : 'smile', mouth: mouthC(tl, 'man', 'bot', 'smile', 'oSmall'), blush: 0.3, look: [0.4, 0] }), up);
  bot += R.blanket({ light: 'day', top: U.lerp(480, 560, up) });
  bot += charSVG('vol', { x: 120, y: 905, s: 0.92, t: tl, blinkSeed: 201, look: [0.7, 0], turn: 0.3, mouth: mouthC(tl, 'vol', 'bot'), blush: 0.3 });
  bot += charSVG('yuria', { x: 900, y: 905, s: 0.92, t: tl, blinkSeed: 202, look: tl < 2.1 ? [0.5, -0.3] : [-0.7, 0], turn: -0.3, mouth: mouthC(tl, 'yuria', 'bot', 'grin', 'open'), blush: 0.3, armL: U.kf(tl, [[0.8, 10], [1.2, 140], [2.0, 140], [2.4, 10]]), eyes: tl > 6.3 ? 'smile' : 'open' });
  bot += hearts(tl, 6.4, 380, 200, 6, 11);
  return { top, bot };
}

function b32(tl) {
  const lit = tl < 7.6;
  let top = R.pcRoom(tl);
  top += charSVG('man', lonely(32, { x: 540, y: 830, s: 1.05, t: tl, blinkSeed: 211, upperOnly: true, outfit: 'sweat', eyes: tl > 7.2 && tl < 7.8 ? 'closed' : 'half', mouth: tl > 7.2 && tl < 7.7 ? 'o' : mouthC(tl + 8, 'man', 'top', 'flat', 'small'), brows: 'worry', look: [0, 0.7] }));
  top += `<rect x="-20" y="650" width="1120" height="300" fill="#3E3A55"/><rect x="200" y="630" width="680" height="40" rx="10" fill="#4E4A68"/>`;
  top += R.cakeSlice(540, 640, tl, lit);
  if (lit) top += `<circle cx="534" cy="560" r="300" fill="#FFD98A" opacity=".08" filter="url(#fBlur20)"/>`;
  else top += `<rect width="${SW}" height="${PANEL}" fill="#0B0A12" opacity="${U.f(U.seg(tl, 7.6, 8.4) * 45) / 100}"/>`;
  top += `<g transform="translate(800 630) rotate(-8)"><rect x="-44" y="-22" width="88" height="40" rx="8" fill="#3A3650"/><rect x="-38" y="-16" width="76" height="28" rx="4" fill="${tl > 3.4 ? '#BFD7F5' : '#20232F'}"/></g>`;
  if (tl > 3.4 && tl < 6.2) top += `<g opacity="${U.f(U.win(tl, 3.4, 6.2) * 100) / 100}"><rect x="610" y="470" width="400" height="96" rx="16" fill="#F4F2F8" stroke="#B9B5C6" stroke-width="3"/><text x="810" y="508" text-anchor="middle" font-size="24" font-weight="700" fill="#8E3A3A">【重要】ポイント失効の</text><text x="810" y="542" text-anchor="middle" font-size="24" font-weight="700" fill="#8E3A3A">お知らせ</text></g>`;
  // bottom: party
  R._age = '32';
  const P = seat3(805);
  let bot = R.dining(tl, { mode: 'night' }) + R.partyDeco(tl);
  bot += charSVG('vol', { x: 250, y: P.v.y, s: 1.05, t: tl, blinkSeed: 212, upperOnly: true, look: [0.6, 0.1], turn: 0.3, mouth: mouthC(tl + 8, 'vol', 'bot'), blush: 0.35 });
  bot += charSVG('yuria', { x: 840, y: P.v.y, s: 1.05, t: tl, blinkSeed: 213, upperOnly: true, look: [-0.7, 0], turn: -0.3, mouth: mouthC(tl + 8, 'yuria', 'bot', 'grin', 'open'), blush: 0.4, eyes: tl < 2.6 ? 'smile' : 'open', armR: U.kf(tl, [[0.2, 10], [0.5, 150], [1.4, 150], [1.8, 10]]) });
  bot += charSVG('man', loved(32, { x: 545, y: P.v.y, s: 1.05, t: tl, blinkSeed: 214, upperOnly: true, outfit: 'hoodie', look: [0, 0.4], eyes: tl > 6.2 ? 'smile' : 'open', mouth: tl > 5.7 && tl < 6.1 ? 'o' : mouthC(tl + 8, 'man', 'bot', 'smile', 'open'), blush: 0.45 }));
  bot += R.table(tl, {}) + R.cakeBig(545, 640, tl, tl < 5.9);
  bot += R.confetti(tl, 0.6, 900, 300);
  bot += hearts(tl, 6.1, 545, 300, 7, 21, 170);
  return { top, bot };
}

function b38(tl) {
  let top = R.officeNight(tl);
  top += R.boss(170, 110, tl);
  top += charSVG('man', lonely(38, { x: 660, y: 870, s: 1.05, t: tl, blinkSeed: 221, upperOnly: true, outfit: 'suit', tieLoose: true, eyes: 'half', mouth: mouthC(tl + 17, 'man', 'top', 'flat', 'oSmall'), brows: 'worry', look: tl < 3.4 ? [-0.8, 0] : [0, 0.7], tilt: tl > 3.4 ? 6 : 0 }));
  top += R.officeNightDesk(tl, 9);
  // bottom: fireworks at home
  let bot = R.livingFireworks(tl);
  const fw = 0.12 + 0.1 * Math.max(0, Math.sin(tl * 2.85));
  bot += charSVG('vol', { x: 300, y: 810, s: 1.0, t: tl, blinkSeed: 222, upperOnly: true, look: [0.7, -0.4], turn: 0.3, mouth: mouthC(tl + 17, 'vol', 'bot'), blush: 0.45 });
  bot += charSVG('yuria', { x: 790, y: 810, s: 1.0, t: tl, blinkSeed: 223, upperOnly: true, look: [0.3, -0.7], turn: 0.2, mouth: mouthC(tl + 17, 'yuria', 'bot', 'grin', 'open'), blush: 0.4, armR: tl > 0.8 && tl < 2.8 ? 160 : null });
  bot += charSVG('man', loved(38, { x: 545, y: 822, s: 1.0, t: tl, blinkSeed: 224, upperOnly: true, outfit: 'hoodie', look: [0.4, -0.6], mouth: 'smile', eyes: tl > 6 ? 'smile' : 'open', blush: 0.3 }));
  bot += R.sofaFront(tl);
  bot += `<rect width="${SW}" height="${PANEL}" fill="#FFD9F0" opacity="${U.f(fw * 100) / 100}"/>`;
  bot += floaters(tl, 3.4, 8.4, 540, 260, 31, 0.5, 26);
  return { top, bot };
}

function b45(tl) {
  let top;
  if (tl < 4.6) {
    const x = U.lerp(900, 380, U.seg(tl, 0.2, 4.4, 'lin'));
    top = R.exitHall(tl);
    top += charSVG('man', lonely(45, { x, y: 900, s: 0.95, t: tl, blinkSeed: 231, outfit: 'suit', tieLoose: true, walk: tl * 1.1, eyes: 'half', mouth: 'flat', brows: 'worry', noArmL: true, noArmR: true, look: [-0.4, 0.5], tilt: 6 }));
    top += R.box(x, 900 - 230 * 0.95);
  } else {
    const k = tl - 4.6;
    top = R.pcRoom(tl);
    top += charSVG('man', lonely(45, { x: 740, y: 860, s: 1.05, t: tl, blinkSeed: 232, upperOnly: true, outfit: 'sweat', eyes: 'half', mouth: mouthC(tl + 26, 'man', 'top', 'flat', 'oSmall'), brows: 'worry', look: [-0.8, 0.3], tilt: k > 3.4 ? 10 : 2, lean: k > 3.4 ? 5 : 0 }));
    top += `<rect x="-20" y="650" width="1120" height="300" fill="#3E3A55"/>`;
    top += R.laptopMails(tl, Math.floor(1 + U.seg(k, 0.2, 2.4, 'lin') * 5));
    top += `<rect width="${SW}" height="${PANEL}" fill="#000" opacity="${U.f((1 - U.seg(tl, 4.6, 5.0)) * 100) / 100}"/>`;
  }
  let bot = R.dining(tl, { mode: 'night' });
  bot += charSVG('vol', { x: 250, y: 805, s: 1.05, t: tl, blinkSeed: 233, upperOnly: true, look: [0.6, 0.1], turn: 0.3, mouth: mouthC(tl + 26, 'vol', 'bot'), blush: 0.3, brows: 'soft' });
  bot += charSVG('yuria', { x: 840, y: 805, s: 1.05, t: tl, blinkSeed: 234, upperOnly: true, look: [-0.7, 0], turn: -0.3, mouth: mouthC(tl + 26, 'yuria', 'bot', 'grin', 'open'), blush: 0.35, armL: U.kf(tl, [[0.8, 10], [1.3, 64], [3.0, 64], [3.4, 10]]), lean: tl > 0.8 && tl < 3.4 ? -6 : 0 });
  bot += charSVG('man', loved(45, { x: 545, y: 805, s: 1.05, t: tl, blinkSeed: 235, upperOnly: true, outfit: 'suit', tieLoose: true, look: tl < 6 ? [0, 0.6] : [0.5, 0], eyes: tl < 6.4 ? 'half' : 'smile', mouth: tl < 6.4 ? 'flat' : mouthC(tl + 26, 'man', 'bot', 'smile', 'open'), brows: tl < 6.4 ? 'worry' : 'soft', blush: 0.2 }));
  bot += R.table(tl, { dishes: 'nabe' });
  bot += hearts(tl, 6.6, 545, 260, 5, 41, 130);
  return { top, bot };
}

function b52(tl) {
  let top = R.funeral(tl);
  top += charSVG('man', lonely(52, { x: 540, y: 960, s: 1.0, t: tl, blinkSeed: 241, upperOnly: true, mourning: true, eyes: tl > 4.6 ? 'closed' : 'half', mouth: mouthC(tl + 35.5, 'man', 'top', 'flat', 'oSmall'), brows: 'worry', look: [0, 0.6], tilt: tl > 4.6 ? 8 : 3, tear: tl > 4.4 }));
  top += R.chairRow(930, [110, 280, 800, 970], 1.0, '#3E3C4C');
  top += `<rect width="${SW}" height="${PANEL}" fill="#0C0B12" opacity=".2"/>`;
  let bot = R.funeral(tl);
  const lean = U.seg(tl, 6.4, 7.4);
  bot += charSVG('vol', { x: 300, y: 960, s: 1.0, t: tl, blinkSeed: 242, upperOnly: true, mourning: true, look: [0.7, 0.2], turn: 0.3, mouth: mouthC(tl + 35.5, 'vol', 'bot', 'small', 'oSmall'), blush: 0.2, brows: 'worry', armR: U.kf(tl, [[1.0, 10], [1.5, 30]]) });
  bot += charSVG('man', loved(52, { x: 540, y: 960, s: 1.0, t: tl, blinkSeed: 243, upperOnly: true, mourning: true, eyes: tl > 2.4 ? 'closed' : 'half', mouth: mouthC(tl + 35.5, 'man', 'bot', 'flat', 'oSmall'), brows: 'worry', tear: tl > 2.4, tilt: 4 }));
  bot += charSVG('yuria', { x: 780 - lean * 30, y: 960, s: 1.0, t: tl, blinkSeed: 244, upperOnly: true, mourning: true, look: [-0.7, 0.2], turn: -0.3, mouth: mouthC(tl + 35.5, 'yuria', 'bot', 'small', 'oSmall'), blush: 0.2, brows: 'worry', armL: 34, tilt: -lean * 12, lean: -lean * 4, eyes: tl > 7.4 ? 'half' : 'open' });
  bot += R.chairRow(930, [110, 970], 1.0, '#3E3C4C');
  bot += `<rect width="${SW}" height="${PANEL}" fill="#FFE9D6" opacity=".12"/>`;
  return { top, bot };
}

function b60(tl) {
  let top = R.trashRoom(tl, { bags: 13 });
  top += charSVG('man', lonely(60, { x: 470, y: 1010, s: 1.05, t: tl, blinkSeed: 251, upperOnly: true, outfit: 'sweat', eyes: 'half', mouth: Math.floor(tl * 2) % 3 ? 'flat' : 'chew', brows: 'worry', look: [0.9, 0], turn: 0.35, tilt: 4 }));
  top += `<g transform="translate(470 860)"><path d="M-50,-70 L50,-70 L40,10 L-40,10 Z" fill="#E8E6F0" stroke="#9E9AAE" stroke-width="4"/><path d="M-48,-44 L48,-44 L46,-20 L-46,-20 Z" fill="#B9473F"/><path d="M-20,-74 L30,-120 M-12,-72 L38,-114" stroke="#C9A06E" stroke-width="5" stroke-linecap="round"/></g>` + R.steam(470, 780, tl, 2, 60, '#B9B5C6');
  top += `<rect width="${SW}" height="${PANEL}" fill="#0C0B12" opacity=".08"/>`;
  let bot = R.sakura(tl);
  bot += charSVG('vol', { x: 300, y: 840, s: 1.0, t: tl, blinkSeed: 252, upperOnly: true, look: [0.6, -0.1], turn: 0.3, mouth: mouthC(tl + 45.5, 'vol', 'bot'), blush: 0.35 });
  bot += charSVG('yuria', { x: 790, y: 840, s: 1.0, t: tl, blinkSeed: 253, upperOnly: true, look: [-0.7, -0.1], turn: -0.3, mouth: mouthC(tl + 45.5, 'yuria', 'bot', 'grin', 'open'), blush: 0.45, eyes: tl > 3.0 && tl < 4.0 ? 'wink' : 'open', winkSide: 1 });
  bot += charSVG('man', loved(60, { x: 545, y: 852, s: 1.0, t: tl, blinkSeed: 254, upperOnly: true, outfit: 'cardigan', look: [0.4, 0], eyes: tl > 3.6 ? 'smile' : 'open', mouth: tl > 3.6 ? 'grin' : 'smile', blush: 0.4 }));
  bot += R.picnicFront();
  bot += floaters(tl, 3.6, 8.6, 545, 300, 61, 0.5, 26);
  return { top, bot };
}

function b68(tl) {
  // top: collapsed on the kitchen floor at night, phone out of reach
  let top = R.kitchenFloor(tl);
  const reach = 150 + Math.sin(tl * 1.3) * 8 * (1 - U.inv(6, 9, tl));
  top += R.phoneFloor(150, 830, tl);
  top += `<g transform="translate(820 790) rotate(-86)">` + charSVG('man', lonely(68, { x: 0, y: 0, s: 1.0, t: tl, outfit: 'cardigan', eyes: tl > 7 ? 'closed' : 'half', mouth: mouthC(tl + 54.5, 'man', 'top', 'o', 'oSmall'), brows: 'worry', armR: reach, armL: -20, noShadow: true, blink: 0 })) + `</g>`;
  top += `<rect width="${SW}" height="${PANEL}" fill="#05040A" opacity="${U.f((0.05 + U.seg(tl, 6.8, 9.8) * 0.4) * 100) / 100}"/>`;
  if (tl > 6.8) top += `<rect width="${SW}" height="${PANEL}" fill="#AFC6E8" opacity="${U.f(U.seg(tl, 8.4, 9.8) * 18) / 100}"/>`;
  // bottom: nursed in bed
  let bot = R.bedroom(tl, { light: 'day', curtain: 0.2, clock: '10:00' });
  bot += manInBed(tl, loved(68, { glasses: false, eyes: tl > 8 ? 'smile' : 'half', mouth: mouthC(tl + 54.5, 'man', 'bot', 'smile', 'oSmall'), blush: 0.6, look: [0.3, 0], brows: 'soft' }), 0.55);
  bot += `<g transform="translate(380 ${U.f(U.lerp(lyingY, sittingY, 0.55) - 452 - 70)})"><rect x="-60" y="-14" width="120" height="30" rx="8" fill="#FFFFFF" stroke="#B9D3EE" stroke-width="3"/></g>`;
  bot += R.blanket({ light: 'day', top: U.lerp(480, 560, 0.55) });
  bot += charSVG('vol', { x: 120, y: 905, s: 0.92, t: tl, blinkSeed: 262, look: [0.7, 0], turn: 0.3, mouth: mouthC(tl + 54.5, 'vol', 'bot'), blush: 0.3, brows: 'soft', itemR: 'cup', armR: U.kf(tl, [[0.6, 10], [1.0, 50], [3.4, 50], [3.8, 10]]) });
  bot += charSVG('yuria', { x: 900, y: 905, s: 0.92, t: tl, blinkSeed: 263, look: [-0.7, 0], turn: -0.3, mouth: mouthC(tl + 54.5, 'yuria', 'bot', 'small', 'open'), blush: 0.5, brows: tl < 6 ? 'worry' : 'soft', armL: 58 });
  bot += hearts(tl, 8.0, 380, 200, 5, 71, 120);
  return { top, bot };
}

function b72(tl) {
  let top;
  if (tl < 9.8) {
    const dying = U.inv(5.0, 8.8, tl);
    const breath = tl < 8.8 ? Math.sin(tl * (2.4 - dying * 1.4)) * (1 - dying) : 0;
    top = R.tatami(tl) + R.futonBase();
    top += `<ellipse cx="480" cy="580" rx="150" ry="44" fill="#F2EEE2" stroke="#B9B09A" stroke-width="3"/>`;
    top += charSVG('man', lonely(72, { x: 480, y: 990, s: 1.0, t: tl, upperOnly: true, outfit: 'pajama', glasses: false, eyes: tl > 7.6 ? 'closed' : 'half', mouth: mouthC(tl + 64.5, 'man', 'top', 'flat', 'oSmall'), brows: 'worry', look: tl > 4.0 && tl < 7.6 ? [-0.8, 0] : [0, -0.4], tilt: tl > 4.0 ? -10 : -4, noArmL: true, noArmR: true, blink: 0 }));
    top += R.futon({ breath });
    top += `<g transform="translate(290 640) rotate(-6)"><rect x="-40" y="-20" width="80" height="40" rx="8" fill="#3A3650"/><rect x="-34" y="-14" width="68" height="28" rx="4" fill="#20232F"/></g>`;
    top += `<rect width="${SW}" height="${PANEL}" fill="#05040A" opacity="${U.f((0.25 + U.seg(tl, 7.6, 9.6) * 0.5) * 100) / 100}"/>`;
  } else {
    const k = tl - 9.8;
    const days = Math.max(1, Math.round(U.lerp(1, 26, U.seg(k, 0.6, 4.4, 'in'))));
    top = R.doorMail(tl, days);
    top += capBox(`発見まで　${days}日`, 540, 74, U.seg(k, 0.4, 0.8));
    if (k > 4.9 && k < 6.6) top += `<text x="760" y="${U.f(380 + Math.sin(k * 20) * 2)}" font-size="46" font-weight="700" fill="#E8E6F0" opacity=".9">コン　コン</text>`;
    top += `<rect width="${SW}" height="${PANEL}" fill="#000" opacity="${U.f((1 - U.seg(tl, 9.8, 10.4)) * 100) / 100}"/>`;
    top += `<rect width="${SW}" height="${PANEL}" fill="#05040A" opacity=".25"/>`;
  }
  // bottom: the same night, held by both of them
  const dawn = U.seg(tl, 11.0, 17.0);
  let bot = R.bedroom(tl, { light: 'day', curtain: 0.75, clock: '3:12' });
  bot += `<rect width="${SW}" height="${PANEL}" fill="#2A2050" opacity="${U.f((0.42 - dawn * 0.32) * 100) / 100}"/>`;
  bot += `<circle cx="720" cy="430" r="300" fill="#FFD9A0" opacity="${U.f((0.25 + dawn * 0.25) * 100) / 100}" filter="url(#fBlur20)"/>`;
  bot += manInBed(tl, loved(72, { glasses: false, eyes: tl > 8.6 ? 'closed' : 'half', mouth: tl > 8.6 ? 'smile' : mouthC(tl + 64.5, 'man', 'bot', 'smile', 'oSmall'), blush: 0.35, look: tl < 4.6 ? [0, -0.2] : [0.6, 0], brows: 'soft', blink: 0 }), 0.12);
  bot += R.blanket({ light: 'day', top: U.lerp(480, 560, 0.12) });
  const rest = U.seg(tl, 11.0, 13.0);
  bot += charSVG('vol', { x: 150, y: 905, s: 0.92, t: tl, blinkSeed: 272, look: [0.7, 0.2], turn: 0.3, mouth: mouthC(tl + 64.5, 'vol', 'bot', 'small', 'oSmall'), blush: 0.4, brows: 'worry', armR: 56, tear: tl > 7.2, eyes: tl > 11 ? 'closed' : 'open', tilt: rest * 10 });
  bot += charSVG('yuria', { x: 880, y: 905, s: 0.92, t: tl, blinkSeed: 273, look: [-0.7, 0.2], turn: -0.3, mouth: mouthC(tl + 64.5, 'yuria', 'bot', 'small', 'open'), blush: 0.45, brows: 'worry', armL: 58, tear: tl > 4.6, eyes: tl > 11 ? 'closed' : 'open', tilt: -rest * 10 });
  bot += floaters(tl, 9.0, 17.0, 400, 300, 81, 0.6, 26);
  return { top, bot };
}

// ------------------------------------------------------------------ closing card
function polaroid(x, y, rot, age, tl, seed) {
  let s = `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-150" y="-170" width="300" height="350" rx="10" fill="#000" opacity=".15" transform="translate(6 8)"/><rect x="-150" y="-170" width="300" height="350" rx="10" fill="#FFFFFF" stroke="#E6DDF6" stroke-width="3"/>`;
  s += `<clipPath id="pc${seed}"><rect x="-130" y="-150" width="260" height="260" rx="6"/></clipPath><g clip-path="url(#pc${seed})"><rect x="-130" y="-150" width="260" height="260" fill="#FFE3EE"/>`;
  const vo = { x: -82, y: 236, s: 0.48, t: tl, upperOnly: true, eyes: 'smile', mouth: 'cat', blush: 0.6, tilt: 8, noArmR: true, blinkSeed: seed };
  const mo = Object.assign(loved(age, { x: 0, y: 246, s: 0.48, t: tl, upperOnly: true, outfit: age > 55 ? 'cardigan' : 'hoodie', eyes: 'smile', mouth: 'grin', blush: 0.4, blinkSeed: seed + 1 }));
  const yo = { x: 82, y: 236, s: 0.48, t: tl, upperOnly: true, eyes: 'wink', winkSide: 1, mouth: 'grin', blush: 0.6, tilt: -8, blinkSeed: seed + 2 };
  s += layered([['vol', vo, 'back'], ['yuria', yo, 'back'], ['man', mo, 'back'], ['vol', vo, 'front'], ['yuria', yo, 'front'], ['man', mo, 'front']]);
  s += `</g><text x="0" y="158" text-anchor="middle" font-size="30" font-weight="700" fill="#8E7FBE">${age}歳</text></g>`;
  return s;
}
function finalCard(tl) {
  const a1 = U.seg(tl, 0.4, 1.4), a2 = U.seg(tl, 1.0, 2.0);
  let top = R.tatami(tl + 82) + `<rect width="${SW}" height="${PANEL}" fill="#05040A" opacity=".62"/>`;
  top += `<g opacity="${U.f(a1 * 100) / 100}"><text x="540" y="470" text-anchor="middle" font-size="92" font-weight="700" fill="#E8E6F0" letter-spacing="6">ひとりで72年</text></g>`;
  let bot = `<rect width="${SW}" height="${PANEL}" fill="url(#gEnd)"/>`;
  for (let i = 0; i < 14; i++) { const x = U.hash(i * 1.9) * 1080, y = ((U.hash(i * 2.7) * 1000 - tl * 50) % 1000 + 1000) % 1000 - 40; bot += U.heart(x, y, 26 + U.hash(i * 5) * 24, ['#FFB3CB', '#FFE08A', '#BFE0FF', '#D9C6FF'][i % 4], 0.7); }
  const d = U.seg(tl, 0.2, 1.0, 'outBack');
  bot += `<g opacity="${U.f(Math.min(1, d) * 100) / 100}">` + polaroid(220, 380 + (1 - d) * 60, -8, 25, tl, 301) + polaroid(540, 360 + (1 - d) * 80, 3, 45, tl, 311) + polaroid(860, 380 + (1 - d) * 60, 8, 72, tl, 321) + `</g>`;
  bot += `<g opacity="${U.f(a2 * 100) / 100}"><text x="540" y="790" text-anchor="middle" font-size="92" font-weight="700" fill="#FF7FA6" stroke="#fff" stroke-width="14" paint-order="stroke" letter-spacing="6">ふたりと47年</text></g>`;
  return { top, bot };
}

// ------------------------------------------------------------------ timeline
const BEATS = [
  { id: 'a25', start: 0, dur: 8, age: '25歳', label: '朝', fn: b25, sat: 0.38 },
  { id: 'a32', start: 8, dur: 9, age: '32歳', label: '誕生日', fn: b32, sat: 0.3 },
  { id: 'a38', start: 17, dur: 9, age: '38歳', label: '夜', fn: b38, sat: 0.24 },
  { id: 'a45', start: 26, dur: 9.5, age: '45歳', label: '仕事', fn: b45, sat: 0.18 },
  { id: 'a52', start: 35.5, dur: 10, age: '52歳', label: '母', fn: b52, sat: 0.12 },
  { id: 'a60', start: 45.5, dur: 9, age: '60歳', label: '春', fn: b60, sat: 0.08 },
  { id: 'a68', start: 54.5, dur: 10, age: '68歳', label: '病', fn: b68, sat: 0.04 },
  { id: 'a72', start: 64.5, dur: 17.5, age: '72歳', label: '最期', fn: b72, sat: 0.0 },
  { id: 'card', start: 82, dur: 7, age: '', label: '', fn: finalCard, sat: 0.0 },
];
const DURATION = 89;
const SLIDE = 0.5;

function gloomFilter(sat, dark) {
  return `<filter id="fGloom" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${U.f(sat * 100) / 100}"/><feComponentTransfer>
    <feFuncR type="linear" slope="${U.f((0.86 - dark * 0.14) * 100) / 100}" intercept="0.02"/><feFuncG type="linear" slope="${U.f((0.88 - dark * 0.14) * 100) / 100}" intercept="0.03"/><feFuncB type="linear" slope="${U.f((0.95 - dark * 0.1) * 100) / 100}" intercept="0.06"/></feComponentTransfer></filter>`;
}
function label(which) {
  const without = which === 'top';
  const txt = without ? 'いない生活' : 'いる生活', fs = 36, w = tw(txt, fs) + 96;
  return `<g transform="translate(24 24)"><rect x="0" y="0" width="${w}" height="62" rx="31" fill="${without ? '#4A4858' : '#FF7FA6'}" stroke="#fff" stroke-width="4"/>
    ${without ? `<g transform="translate(40 32)"><path d="${U.heartD}" transform="scale(36)" fill="#8C88A0"/><path d="M-2,-11 L4,-2 L-3,5 L2,14" fill="none" stroke="#4A4858" stroke-width="4"/></g>` : U.heart(40, 32, 36, '#FFFFFF')}
    <text x="70" y="44" font-size="${fs}" font-weight="700" fill="#fff">${txt}</text></g>`;
}
function bandSVG(beat, tl) {
  const pop = U.ease.outBack(U.inv(0, 0.35, tl));
  const txt = beat.id === 'card' ? 'ユリアとヴォルが　いない生活／いる生活' : `${beat.age}　${beat.label}`;
  const fs = beat.id === 'card' ? 32 : 38, w = tw(txt, fs) + 90;
  return `<rect x="0" y="${PANEL}" width="${SW}" height="${BAND}" fill="#FFFFFF"/><rect x="0" y="${PANEL}" width="${SW}" height="6" fill="#B9B5C6"/><rect x="0" y="${BOTY - 6}" width="${SW}" height="6" fill="#FFD3E2"/>
    <g transform="translate(540 ${PANEL + BAND / 2}) scale(${U.f((0.7 + 0.3 * pop) * 1000) / 1000})"><rect x="${-w / 2}" y="-36" width="${w}" height="72" rx="36" fill="#FFFFFF" stroke="#C9B6EE" stroke-width="5"/>
    <text x="0" y="13" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#6A5B98">${txt}</text></g>`;
}

window.renderFrame = function (t) {
  U.resetUid();
  let i = 0;
  for (let k = 0; k < BEATS.length; k++) if (t >= BEATS[k].start) i = k;
  const beat = BEATS[i], tl = t - beat.start;
  const prevSat = i > 0 ? BEATS[i - 1].sat : beat.sat;
  const sat = U.lerp(prevSat, beat.sat, U.inv(0, 1.2, tl));
  const dark = 1 - sat / 0.38;
  let out = `<defs>${B.defs}${R.defs}${gloomFilter(sat, dark)}<clipPath id="clipTop"><rect x="0" y="0" width="${SW}" height="${PANEL}"/></clipPath><clipPath id="clipBot"><rect x="0" y="0" width="${SW}" height="${PANEL}"/></clipPath></defs>`;
  let top, bot;
  if (i > 0 && tl < SLIDE) {
    const p = U.ease.inOut(tl / SLIDE), prev = BEATS[i - 1];
    const A = prev.fn(prev.dur - 0.01), Bp = beat.fn(tl);
    top = `<g transform="translate(${U.f(-SW * p)} 0)">${A.top}</g><g transform="translate(${U.f(SW * (1 - p))} 0)">${Bp.top}</g>`;
    bot = `<g transform="translate(${U.f(SW * p)} 0)">${A.bot}</g><g transform="translate(${U.f(-SW * (1 - p))} 0)">${Bp.bot}</g>`;
  } else { const P = beat.fn(tl); top = P.top; bot = P.bot; }
  // vignette grows on the lonely side
  const vig = `<rect width="${SW}" height="${PANEL}" fill="url(#gVignette)" opacity="${U.f(Math.min(1, 0.3 + dark) * 100) / 100}"/>`;
  out += `<g clip-path="url(#clipTop)"><g filter="url(#fGloom)">${top}</g>${vig}${bubbles('top', t)}${label('top')}</g>`;
  out += `<g transform="translate(0 ${BOTY})"><g clip-path="url(#clipBot)">${bot}${bubbles('bot', t)}${label('bot')}</g></g>`;
  out += bandSVG(beat, tl);
  // opening title
  if (t < 3.4) {
    const a = Math.min(U.seg(t, 0.15, 0.55, 'out'), 1 - U.inv(2.9, 3.4, t));
    out += `<g opacity="${U.f(a * 100) / 100}" transform="translate(540 960) scale(${U.f((0.9 + 0.1 * U.ease.outBack(U.inv(0.15, 0.6, t))) * 1000) / 1000})">
      <rect x="-470" y="-190" width="940" height="380" rx="48" fill="#000" opacity=".18" transform="translate(0 10)"/><rect x="-470" y="-190" width="940" height="380" rx="48" fill="#FFFFFF" stroke="#C9B6EE" stroke-width="6"/>
      <text x="0" y="-82" text-anchor="middle" font-size="60" font-weight="700" fill="#7A6AB0">ユリアとヴォルが</text>
      <text x="-215" y="60" text-anchor="middle" font-size="84" font-weight="700" fill="#6E6A82">いない</text><text x="0" y="52" text-anchor="middle" font-size="52" font-weight="700" fill="#B9AED0">と</text><text x="215" y="60" text-anchor="middle" font-size="84" font-weight="700" fill="#FF7FA6">いる</text>
      <text x="0" y="148" text-anchor="middle" font-size="54" font-weight="700" fill="#7A6AB0">一生</text></g>`;
  }
  if (t < 0.4) out += `<rect width="${SW}" height="${SH}" fill="#FFFFFF" opacity="${U.f((1 - t / 0.4) * 100) / 100}"/>`;
  if (t > DURATION - 1.2) out += `<rect width="${SW}" height="${SH}" fill="#000" opacity="${U.f(U.inv(DURATION - 1.2, DURATION, t) * 100) / 100}"/>`;
  document.getElementById('content').innerHTML = out;
};
window.DURATION = DURATION;
window.SCENES = BEATS.map(b => ({ id: b.id, start: b.start, dur: b.dur }));
window.ALL_TEXT = BUBS.map(b => b.text).join('') + BEATS.map(b => b.age + b.label).join('') + 'ユリアとヴォルがいないといる一生生活発見まで日0123456789コンひとりで72年ふたりと47年歳ユリアとヴォルが　いない生活／いる生活【重要】ポイント失効のお知らせ株式会社○○【選考結果】不採用のお知らせ家賃滞納のお知らせ203HAPPYBIRTHDAY32';
