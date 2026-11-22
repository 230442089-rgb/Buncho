// bgs.js — backgrounds. All in screen space 1080x1920 (before camera).
const B = {};
B.defs = `
<linearGradient id="gSkyMorning" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FCBFF"/><stop offset=".45" stop-color="#C9E6FF"/><stop offset=".75" stop-color="#FFEFF5"/><stop offset="1" stop-color="#FFF6EC"/></linearGradient>
<linearGradient id="gSkyDay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7EC3FF"/><stop offset=".5" stop-color="#BFE2FF"/><stop offset="1" stop-color="#F2F8FF"/></linearGradient>
<linearGradient id="gSkyAfternoon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86C6FA"/><stop offset=".55" stop-color="#CFE7FB"/><stop offset="1" stop-color="#FFF3E2"/></linearGradient>
<linearGradient id="gSkySunset" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3E3383"/><stop offset=".28" stop-color="#8C59A6"/><stop offset=".52" stop-color="#EE8AA0"/><stop offset=".72" stop-color="#FFB27A"/><stop offset=".86" stop-color="#FFD9A0"/><stop offset="1" stop-color="#FFE9C2"/></linearGradient>
<linearGradient id="gSkyNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0D1236"/><stop offset=".6" stop-color="#232A63"/><stop offset="1" stop-color="#3F3C7E"/></linearGradient>
<radialGradient id="gSunGlow"><stop offset="0" stop-color="#FFFBEA" stop-opacity="1"/><stop offset=".35" stop-color="#FFF3C9" stop-opacity=".7"/><stop offset="1" stop-color="#FFF3C9" stop-opacity="0"/></radialGradient>
<radialGradient id="gSunsetGlow"><stop offset="0" stop-color="#FFF6D6" stop-opacity="1"/><stop offset=".25" stop-color="#FFD18A" stop-opacity=".85"/><stop offset="1" stop-color="#FF9A7A" stop-opacity="0"/></radialGradient>
<radialGradient id="gWarmLight"><stop offset="0" stop-color="#FFC98A" stop-opacity=".55"/><stop offset="1" stop-color="#FFC98A" stop-opacity="0"/></radialGradient>
<radialGradient id="gVignette" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2A1E4A" stop-opacity=".35"/></radialGradient>
<linearGradient id="gPlaza" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EFE3E6"/><stop offset="1" stop-color="#FBF4EE"/></linearGradient>
<linearGradient id="gWalk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9DDE3"/><stop offset="1" stop-color="#F8EFEA"/></linearGradient>
<linearGradient id="gGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A9DDA0"/><stop offset="1" stop-color="#7EC78A"/></linearGradient>
<linearGradient id="gGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D8F0FF"/><stop offset="1" stop-color="#A9CFEF"/></linearGradient>
<linearGradient id="gTrainWin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121A45"/><stop offset=".7" stop-color="#2A3170"/><stop offset="1" stop-color="#4A3F86"/></linearGradient>
<linearGradient id="gTrainWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8E4F0"/><stop offset="1" stop-color="#CFC8DF"/></linearGradient>
<linearGradient id="gSeat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5BA6A0"/><stop offset="1" stop-color="#3E7F80"/></linearGradient>
<linearGradient id="gEnd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE7F1"/><stop offset=".5" stop-color="#FFF6DF"/><stop offset="1" stop-color="#E3F1FF"/></linearGradient>
<linearGradient id="gGondolaWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9B8"/><stop offset="1" stop-color="#E9A98F"/></linearGradient>
`;

// ---------------------------------------------------------------- small props
B.cloud = (x, y, s, op = 1, tint = '#FFFFFF', shade = '#DCE3F7') => {
  const parts = [[0, 0, 56], [52, -28, 66], [114, -8, 54], [162, 10, 40], [-48, 12, 40], [62, 16, 58]];
  let c = `<ellipse cx="58" cy="44" rx="150" ry="24" fill="${shade}"/>`;
  for (const [cx, cy, r] of parts) c += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${shade}"/>`;
  for (const [cx, cy, r] of parts) c += `<circle cx="${cx}" cy="${cy - 6}" r="${r - 4}" fill="${tint}"/>`;
  return `<g ${U.tr(x, y, s)} opacity="${op}">${c}</g>`;
};
B.tree = (x, y, s, c1 = '#94D3A2', c2 = '#6FB98A', hi = '#C2EBC4', trunk = '#B88E6E') => {
  let g = `<path d="M-14,0 L-10,-120 L10,-120 L14,0 Z" fill="${trunk}" stroke="#8A6A52" stroke-width="3"/>`;
  const blobs = [[0, -190, 92], [-70, -140, 66], [70, -140, 70], [-36, -250, 66], [44, -246, 62], [0, -120, 60]];
  for (const [cx, cy, r] of blobs) g += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c2}"/>`;
  for (const [cx, cy, r] of blobs) g += `<circle cx="${cx - 6}" cy="${cy - 8}" r="${r - 8}" fill="${c1}"/>`;
  g += `<circle cx="-40" cy="-260" r="22" fill="${hi}" opacity=".8"/><circle cx="-80" cy="-160" r="16" fill="${hi}" opacity=".7"/><circle cx="20" cy="-214" r="14" fill="${hi}" opacity=".7"/>`;
  return `<g ${U.tr(x, y, s)}>${g}</g>`;
};
B.flowers = (x, y, n, seed, w = 220) => {
  let g = '';
  for (let i = 0; i < n; i++) {
    const fx = x + U.hash(seed + i) * w, fy = y + U.hash(seed + i * 3.1) * 40;
    const col = ['#FF9DBB', '#FFD36B', '#FFFFFF', '#C9A8F2', '#FF8C8C'][Math.floor(U.hash(seed + i * 7) * 5)];
    g += `<g transform="translate(${U.f(fx)} ${U.f(fy)})"><path d="M0,0 L0,30" stroke="#5FAE6E" stroke-width="3"/>`;
    for (let k = 0; k < 5; k++) g += `<circle cx="${U.f(Math.cos(k * 1.256) * 8)}" cy="${U.f(Math.sin(k * 1.256) * 8)}" r="6.5" fill="${col}"/>`;
    g += `<circle r="4.5" fill="#FFE88A"/></g>`;
  }
  return g;
};
B.lamp = (x, y, s = 1, glow = 0) => `<g ${U.tr(x, y, s)}><path d="M-6,0 L-4,-330 L4,-330 L6,0 Z" fill="#6E6890"/><path d="M-26,-330 L26,-330 L18,-380 L-18,-380 Z" fill="#7E78A2"/><rect x="-16" y="-376" width="32" height="40" rx="6" fill="#FFF3C4" opacity=".95"/>${glow ? `<circle cx="0" cy="-356" r="70" fill="#FFE7A0" opacity="${glow}" filter="url(#fBlur20)"/>` : ''}<path d="M-20,-386 Q0,-404 20,-386 Z" fill="#6E6890"/><rect x="-18" y="-12" width="36" height="12" rx="4" fill="#6E6890"/></g>`;
B.bird = (x, y, s, flap, col = '#5C4E7A') => `<path ${U.tr(x, y, s)} d="M-20,${U.f(-8 * flap)} Q-10,-4 0,2 Q10,-4 20,${U.f(-8 * flap)}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`;

// ---------------------------------------------------------------- 1. station plaza (morning)
B.station = (t, clockMin) => {
  let s = `<rect width="1080" height="1920" fill="url(#gSkyMorning)"/>`;
  s += `<circle cx="880" cy="250" r="330" fill="url(#gSunGlow)"/>`;
  s += B.cloud(-60 + t * 9, 210, 1.1) + B.cloud(560 + t * 6, 120, 0.8, 0.95) + B.cloud(820 + t * 11, 430, 0.7, 0.9);
  // distant skyline
  let sky = '';
  for (let i = 0; i < 12; i++) {
    const bx = i * 98 - 20, bh = 120 + U.hash(i + 4) * 200, bw = 80 + U.hash(i + 9) * 40;
    sky += `<rect x="${U.f(bx)}" y="${U.f(1060 - bh)}" width="${U.f(bw)}" height="${U.f(bh + 40)}" fill="#D6D3EE"/>`;
    for (let wy = 1060 - bh + 18; wy < 1080; wy += 30) for (let wx = bx + 12; wx < bx + bw - 14; wx += 22) sky += `<rect x="${U.f(wx)}" y="${U.f(wy)}" width="9" height="13" fill="#EDEBFA"/>`;
  }
  s += `<g opacity=".8">${sky}</g>`;
  // station building
  s += `<rect x="-40" y="860" width="1160" height="420" fill="#FFF6EA" stroke="#C9B9D9" stroke-width="4"/>`;
  s += `<rect x="-40" y="840" width="1160" height="46" fill="#E7D8F1" stroke="#C9B9D9" stroke-width="4"/>`;
  s += `<path d="M-40,840 L1120,840 L1120,820 L-40,820 Z" fill="#CDB8E6"/>`;
  for (let i = 0; i < 6; i++) {
    const wx = 20 + i * 180;
    if (i === 2 || i === 3) continue;
    s += `<path d="M${wx},1200 L${wx},990 Q${wx + 60},920 ${wx + 120},990 L${wx + 120},1200 Z" fill="url(#gGlass)" stroke="#B7A8D0" stroke-width="4"/>`;
    s += `<path d="M${wx + 60},940 L${wx + 60},1200 M${wx},1080 L${wx + 120},1080" stroke="#C9BDE0" stroke-width="3"/>`;
    s += `<path d="M${wx + 16},1000 L${wx + 50},1180" stroke="#fff" stroke-width="8" opacity=".55"/>`;
  }
  // entrance + sign
  s += `<path d="M380,1280 L380,1010 Q540,880 700,1010 L700,1280 Z" fill="#F0E6F6" stroke="#B7A8D0" stroke-width="4"/>`;
  s += `<path d="M410,1280 L410,1030 Q540,930 670,1030 L670,1280 Z" fill="#7D74A6" opacity=".55"/>`;
  s += `<rect x="410" y="900" width="260" height="74" rx="37" fill="#FFFFFF" stroke="#B7A8D0" stroke-width="4"/>`;
  s += `<text x="540" y="952" text-anchor="middle" font-size="44" font-weight="700" fill="#6E5E9A">星見駅</text>`;
  s += U.sparkle(448, 936, 12, '#F2C44E') + U.sparkle(632, 936, 12, '#F2C44E');
  // ground
  s += `<rect x="0" y="1270" width="1080" height="650" fill="url(#gPlaza)"/>`;
  let tiles = '';
  for (let i = -8; i <= 8; i++) tiles += `<path d="M${540 + i * 70},1270 L${540 + i * 260},1920" stroke="#E2D2DA" stroke-width="3"/>`;
  for (let k = 0; k < 9; k++) { const yy = 1270 + Math.pow(k / 8, 1.7) * 650; tiles += `<path d="M0,${U.f(yy)} L1080,${U.f(yy)}" stroke="#E2D2DA" stroke-width="3"/>`; }
  s += tiles;
  // clock tower (left)
  s += `<g transform="translate(200 0)"><rect x="-22" y="820" width="44" height="560" fill="#8C84B4" stroke="#6E6696" stroke-width="4"/><rect x="-46" y="1360" width="92" height="30" rx="8" fill="#7E76A6"/>`;
  s += `<circle cx="0" cy="740" r="118" fill="#8C84B4"/><circle cx="0" cy="740" r="102" fill="#FFFDF6" stroke="#6E6696" stroke-width="6"/>`;
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; s += `<circle cx="${U.f(Math.sin(a) * 84)}" cy="${U.f(740 - Math.cos(a) * 84)}" r="${k % 3 === 0 ? 7 : 4}" fill="#6E6696"/>`; }
  const mins = clockMin, hA = ((mins / 60) % 12) * 30, mA = (mins % 60) * 6;
  s += `<path d="M0,740 L0,690" stroke="#4C4470" stroke-width="10" stroke-linecap="round" transform="rotate(${U.f(hA)} 0 740)"/>`;
  s += `<path d="M0,740 L0,660" stroke="#4C4470" stroke-width="6" stroke-linecap="round" transform="rotate(${U.f(mA)} 0 740)"/>`;
  s += `<circle cx="0" cy="740" r="9" fill="#F2B64A"/>${U.heart(0, 612, 34, '#FF8FB1', 1)}</g>`;
  // trees & planters
  s += B.tree(1010, 1330, 1.15) + B.tree(-10, 1360, 1.0, '#9DD9A8', '#74BE8C');
  s += `<rect x="760" y="1320" width="300" height="70" rx="18" fill="#D7C7EC" stroke="#B3A1D6" stroke-width="4"/>` + B.flowers(770, 1290, 14, 3, 270);
  s += `<rect x="-20" y="1350" width="190" height="70" rx="18" fill="#D7C7EC" stroke="#B3A1D6" stroke-width="4"/>` + B.flowers(-10, 1320, 9, 11, 170);
  // birds on the ground
  const hop = Math.abs(Math.sin(t * 5)) * 6;
  s += `<g transform="translate(880 ${U.f(1560 - hop)})"><ellipse cx="0" cy="0" rx="20" ry="15" fill="#B8B2CC"/><circle cx="16" cy="-12" r="10" fill="#B8B2CC"/><path d="M25,-12 l8,3 l-8,2 Z" fill="#F2B64A"/><circle cx="19" cy="-14" r="2" fill="#333"/></g>`;
  return s;
};

// ---------------------------------------------------------------- 2. shopping street (scrolling)
const SHOPS = [
  { w: 380, h: 760, wall: '#FFE4EC', trim: '#E7A6BE', aw: ['#FF9DBB', '#FFFFFF'], sign: 'CAFÉ', icon: 'cup' },
  { w: 340, h: 860, wall: '#E3F3EC', trim: '#93CDB4', aw: ['#7FCCAE', '#FFFFFF'], sign: 'FLOWER', icon: 'flower' },
  { w: 400, h: 720, wall: '#F1E8FF', trim: '#B9A4E6', aw: ['#B49AF0', '#FFFFFF'], sign: 'accessory', icon: 'heart' },
  { w: 360, h: 820, wall: '#FFF2D9', trim: '#E9C27A', aw: ['#F7C15C', '#FFFFFF'], sign: 'BAKERY', icon: 'bread' },
  { w: 380, h: 780, wall: '#E6F1FF', trim: '#9DBCE8', aw: ['#86B4F0', '#FFFFFF'], sign: 'CRÊPE', icon: 'crepe' },
];
B.shopIcon = (k, x, y) => {
  if (k === 'cup') return `<g transform="translate(${x} ${y})"><path d="M-22,-16 L22,-16 L18,22 L-18,22 Z" fill="#fff" stroke="#C27B95" stroke-width="3"/><path d="M22,-8 C36,-8 36,12 20,12" fill="none" stroke="#C27B95" stroke-width="3"/><path d="M-8,-26 q-6,-8 0,-14 M6,-26 q-6,-8 0,-14" fill="none" stroke="#C27B95" stroke-width="3"/></g>`;
  if (k === 'heart') return U.heart(x, y, 54, '#FF8FB8', 1);
  if (k === 'flower') return `<g transform="translate(${x} ${y})">${[0, 1, 2, 3, 4].map(i => `<circle cx="${U.f(Math.cos(i * 1.256) * 16)}" cy="${U.f(Math.sin(i * 1.256) * 16)}" r="13" fill="#FF9DBB"/>`).join('')}<circle r="9" fill="#FFE07A"/></g>`;
  if (k === 'bread') return `<g transform="translate(${x} ${y})"><ellipse rx="30" ry="18" fill="#E8B86A" stroke="#B98A3E" stroke-width="3"/><path d="M-14,-10 l6,14 M0,-12 l6,14 M14,-10 l6,14" stroke="#B98A3E" stroke-width="3"/></g>`;
  if (k === 'crepe') return `<g transform="translate(${x} ${y})"><path d="M-22,-8 L22,-8 L0,34 Z" fill="#FFC9DA" stroke="#E58FAE" stroke-width="3"/><circle cx="-10" cy="-14" r="11" fill="#fff" stroke="#C9C0E0" stroke-width="2"/><circle cx="8" cy="-18" r="12" fill="#fff" stroke="#C9C0E0" stroke-width="2"/><circle cx="2" cy="-30" r="7" fill="#FF6B7F"/></g>`;
  return '';
};
B.shop = (sh, x, idx) => {
  const top = 1440 - sh.h;
  let s = `<g transform="translate(${U.f(x)} 0)">`;
  s += `<rect x="0" y="${top}" width="${sh.w}" height="${sh.h}" fill="${sh.wall}" stroke="${sh.trim}" stroke-width="4"/>`;
  s += `<rect x="-6" y="${top - 24}" width="${sh.w + 12}" height="30" rx="6" fill="${sh.trim}"/>`;
  // upper windows
  for (let wy = top + 40; wy < 1440 - 380; wy += 150) for (let k = 0; k < 2; k++) {
    const wx = 40 + k * (sh.w / 2);
    s += `<rect x="${wx}" y="${wy}" width="${sh.w / 2 - 80}" height="100" rx="10" fill="url(#gGlass)" stroke="${sh.trim}" stroke-width="4"/>`;
    s += `<rect x="${wx - 8}" y="${wy + 96}" width="${sh.w / 2 - 64}" height="12" rx="4" fill="${sh.trim}"/>`;
    s += B.flowers(wx, wy + 76, 4, idx * 13 + wy + k, sh.w / 2 - 90);
  }
  // awning
  const ay = 1440 - 360, n = 6, sw = sh.w / n;
  for (let k = 0; k < n; k++) {
    s += `<path d="M${U.f(k * sw)},${ay} L${U.f((k + 1) * sw)},${ay} L${U.f((k + 1) * sw + 6)},${ay + 70} L${U.f(k * sw + 6)},${ay + 70} Z" fill="${sh.aw[k % 2]}"/>`;
    s += `<path d="M${U.f(k * sw + 6)},${ay + 70} Q${U.f(k * sw + sw / 2 + 6)},${ay + 100} ${U.f((k + 1) * sw + 6)},${ay + 70}" fill="${sh.aw[k % 2]}" stroke="${sh.trim}" stroke-width="2"/>`;
  }
  s += `<path d="M0,${ay} L${sh.w},${ay}" stroke="${sh.trim}" stroke-width="5"/>`;
  // shop window + door
  s += `<rect x="24" y="${ay + 110}" width="${sh.w * 0.56}" height="220" rx="12" fill="url(#gGlass)" stroke="${sh.trim}" stroke-width="4"/>`;
  s += B.shopIcon(sh.icon, 24 + sh.w * 0.28, ay + 220);
  s += `<path d="M40,${ay + 300} L${U.f(24 + sh.w * 0.56 - 16)},${ay + 130}" stroke="#fff" stroke-width="10" opacity=".45"/>`;
  s += `<rect x="${U.f(sh.w * 0.66)}" y="${ay + 120}" width="${U.f(sh.w * 0.26)}" height="240" rx="10" fill="#FFFFFF" stroke="${sh.trim}" stroke-width="4"/>`;
  s += `<circle cx="${U.f(sh.w * 0.66 + 18)}" cy="${ay + 250}" r="5" fill="${sh.trim}"/>`;
  // sign
  s += `<rect x="${sh.w / 2 - 110}" y="${ay - 92}" width="220" height="64" rx="32" fill="#FFFFFF" stroke="${sh.trim}" stroke-width="4"/>`;
  s += `<text x="${sh.w / 2}" y="${ay - 48}" text-anchor="middle" font-size="34" font-weight="700" fill="${sh.trim}" letter-spacing="2">${sh.sign}</text>`;
  return s + '</g>';
};
B.street = (t, scroll) => {
  let s = `<rect width="1080" height="1920" fill="url(#gSkyDay)"/>`;
  s += B.cloud(100 - scroll * 0.05, 160, 0.9) + B.cloud(700 - scroll * 0.05, 280, 0.7, 0.9);
  // far row
  let far = '';
  for (let i = -1; i < 9; i++) {
    const bx = ((i * 170 - scroll * 0.3) % 1530 + 1530) % 1530 - 220;
    const bh = 380 + U.hash(i + 30) * 260;
    far += `<rect x="${U.f(bx)}" y="${U.f(1100 - bh)}" width="150" height="${U.f(bh)}" fill="#DCD8F2"/>`;
  }
  s += `<g opacity=".85">${far}</g>`;
  // shops (loop)
  const total = SHOPS.reduce((a, b) => a + b.w + 24, 0);
  let base = -((scroll % total) + total) % total;
  for (let rep = 0; rep < 3; rep++) {
    let x = base + rep * total;
    SHOPS.forEach((sh, i) => { if (x < 1100 && x + sh.w > -20) s += B.shop(sh, x, i); x += sh.w + 24; });
  }
  // sidewalk
  s += `<rect x="0" y="1440" width="1080" height="480" fill="url(#gWalk)"/>`;
  { const pw = 640, off = ((scroll * 1.0) % pw + pw) % pw; for (let x = -off - pw; x < 1200; x += pw) s += B.lamp(x + 320, 1470, 1.1); }
  s += `<rect x="0" y="1440" width="1080" height="20" fill="#D8C8D6"/>`;
  const tw = 120, off = ((scroll % tw) + tw) % tw;
  for (let x = -off; x < 1100; x += tw) s += `<path d="M${U.f(x)},1460 L${U.f(x - 60)},1920" stroke="#E0D2DC" stroke-width="3"/>`;
  s += `<path d="M0,1620 L1080,1620 M0,1800 L1080,1800" stroke="#E0D2DC" stroke-width="3"/>`;
  return s;
};
B.streetFront = (t, scroll) => {
  // bunting + lamps in front, faster parallax
  let s = '';
  const bw = 900, boff = ((scroll * 1.1) % bw + bw) % bw;
  for (let x = -boff - bw; x < 1200; x += bw) {
    s += `<path d="M${U.f(x)},300 Q${U.f(x + bw / 2)},420 ${U.f(x + bw)},300" fill="none" stroke="#9C8FC4" stroke-width="3"/>`;
    for (let k = 1; k < 12; k++) {
      const u = k / 12, fx = x + u * bw, fy = 300 + 4 * u * (1 - u) * 120;
      const col = ['#FF9DBB', '#FFD36B', '#9FD8C2', '#B9A2F0'][k % 4];
      s += `<path d="M${U.f(fx - 18)},${U.f(fy)} L${U.f(fx + 18)},${U.f(fy)} L${U.f(fx)},${U.f(fy + 44)} Z" fill="${col}"/>`;
    }
  }
  return s;
};

// ---------------------------------------------------------------- 3. crepe stand
B.crepe = t => {
  let s = `<rect width="1080" height="1920" fill="url(#gSkyAfternoon)"/>`;
  s += B.cloud(620 + t * 6, 170, 0.8) + B.cloud(-80 + t * 8, 330, 0.65, 0.9);
  s += `<g filter="url(#fBlur3)">` + B.tree(80, 1240, 1.4, '#A6DDB0', '#82C796') + B.tree(1000, 1200, 1.5, '#A6DDB0', '#82C796') + `</g>`;
  s += `<rect x="0" y="1180" width="1080" height="740" fill="#F6ECE6"/>`;
  // kiosk
  s += `<g transform="translate(540 0)">`;
  s += `<rect x="-420" y="560" width="840" height="640" rx="40" fill="#FFF7FA" stroke="#E5A8C0" stroke-width="6"/>`;
  for (let k = 0; k < 10; k++) {
    const x0 = -440 + k * 88;
    s += `<path d="M${x0},500 L${x0 + 88},500 L${x0 + 92},600 L${x0 + 4},600 Z" fill="${k % 2 ? '#FFFFFF' : '#FF9DBB'}"/>`;
    s += `<path d="M${x0 + 4},600 Q${x0 + 48},640 ${x0 + 92},600" fill="${k % 2 ? '#FFFFFF' : '#FF9DBB'}" stroke="#E5A8C0" stroke-width="2"/>`;
  }
  s += `<rect x="-460" y="480" width="920" height="26" rx="10" fill="#E5A8C0"/>`;
  s += `<rect x="-160" y="380" width="320" height="96" rx="48" fill="#FFFFFF" stroke="#E5A8C0" stroke-width="6"/>`;
  s += `<text x="0" y="444" text-anchor="middle" font-size="52" font-weight="700" fill="#E27FA3" letter-spacing="4">CRÊPE</text>`;
  s += U.heart(-190, 428, 40, '#FFB3CB') + U.heart(190, 428, 40, '#FFB3CB');
  // window with menu
  s += `<rect x="-360" y="680" width="420" height="300" rx="20" fill="url(#gGlass)" stroke="#E5A8C0" stroke-width="5"/>`;
  s += `<rect x="110" y="660" width="250" height="360" rx="20" fill="#5B4E7A" stroke="#E5A8C0" stroke-width="5"/>`;
  s += `<text x="235" y="720" text-anchor="middle" font-size="34" font-weight="700" fill="#FFF3C4">MENU</text>`;
  const items = [['いちご', '#FF8FA8'], ['チョコ', '#C79A7A'], ['バナナ', '#FFE07A'], ['抹茶', '#9FD39A']];
  items.forEach(([nm, c], i) => { s += `<circle cx="150" cy="${770 + i * 60}" r="14" fill="${c}"/><text x="176" y="${782 + i * 60}" font-size="30" font-weight="500" fill="#FFFFFF">${nm}</text>`; });
  s += `<rect x="-400" y="1000" width="800" height="70" rx="16" fill="#FFD3E2" stroke="#E5A8C0" stroke-width="5"/>`;
  s += B.shopIcon('crepe', -150, 840) + B.shopIcon('cup', -270, 860);
  s += `</g>`;
  // table edge in front
  s += `<rect x="-20" y="1700" width="1120" height="260" fill="#FFFFFF" opacity=".0"/>`;
  return s;
};

B.miniWheel = (x, y, t) => {
  let g = `<g transform="translate(${x} ${y})" opacity=".75"><path d="M-10,0 L-70,170 M10,0 L70,170" stroke="#A58FC9" stroke-width="7"/><g transform="rotate(${U.f(t * 6)})"><circle r="130" fill="none" stroke="#A58FC9" stroke-width="6"/>`;
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; g += `<path d="M0,0 L${U.f(Math.cos(a) * 130)},${U.f(Math.sin(a) * 130)}" stroke="#B9A6DA" stroke-width="2.5"/>`; }
  g += `</g>`;
  for (let k = 0; k < 8; k++) { const a = (t * 6 + k * 45) * Math.PI / 180; g += `<rect x="${U.f(Math.cos(a) * 130 - 12)}" y="${U.f(Math.sin(a) * 130)}" width="24" height="20" rx="6" fill="${['#FFB3CB', '#FFE08A', '#BFE0FF', '#D9C6FF'][k % 4]}"/>`; }
  return g + `<circle r="12" fill="#A58FC9"/></g>`;
};
// ---------------------------------------------------------------- 4. park
B.park = t => {
  let s = `<rect width="1080" height="1920" fill="url(#gSkyDay)"/>`;
  s += B.cloud(80 + t * 10, 220, 1.0) + B.cloud(640 + t * 7, 360, 0.75, 0.95);
  // hills
  s += `<path d="M0,1080 C200,980 420,1000 600,1060 C760,1000 920,960 1080,1020 L1080,1300 L0,1300 Z" fill="#BFE6C0"/>`;
  s += `<path d="M0,1160 C260,1080 520,1120 760,1160 C900,1120 1000,1110 1080,1130 L1080,1300 L0,1300 Z" fill="#A9DDA8"/>`;
  s += B.tree(130, 1230, 0.9, '#9DD9A8', '#74BE8C') + B.tree(960, 1210, 1.0);
  // fountain
  s += B.miniWheel(230, 1010, t);
  s += `<g transform="translate(880 1250) scale(.8)"><ellipse cx="0" cy="40" rx="230" ry="46" fill="#C9E7F7" stroke="#9CC6E0" stroke-width="5"/><ellipse cx="0" cy="34" rx="200" ry="34" fill="#E8F7FF"/><rect x="-20" y="-120" width="40" height="150" fill="#E2DCF2" stroke="#B5ABD4" stroke-width="4"/><ellipse cx="0" cy="-120" rx="80" ry="18" fill="#E2DCF2" stroke="#B5ABD4" stroke-width="4"/>`;
  for (let k = 0; k < 7; k++) {
    const a = -1.2 + k * 0.4, ph = (t * 1.2 + k * 0.13) % 1;
    s += `<path d="M0,-150 Q${U.f(Math.sin(a) * 90)},-260 ${U.f(Math.sin(a) * 160)},-110" fill="none" stroke="#BDE6FF" stroke-width="6" stroke-linecap="round" opacity=".85" stroke-dasharray="30 22" stroke-dashoffset="${U.f(-ph * 52)}"/>`;
  }
  s += `</g>`;
  // grass foreground
  s += `<rect x="0" y="1300" width="1080" height="620" fill="url(#gGrass)"/>`;
  s += `<path d="M380,1300 C420,1500 360,1700 300,1920 L780,1920 C720,1700 660,1500 700,1300 Z" fill="#F3E6D6"/>`;
  for (let i = 0; i < 40; i++) {
    const gx = U.hash(i * 2.3) * 1080, gy = 1320 + U.hash(i * 5.1) * 600;
    if (gx > 280 && gx < 800 && gy > 1350) continue;
    s += `<path d="M${U.f(gx)},${U.f(gy)} l-6,-16 M${U.f(gx)},${U.f(gy)} l0,-20 M${U.f(gx)},${U.f(gy)} l6,-16" stroke="#6BB57C" stroke-width="3" stroke-linecap="round"/>`;
  }
  s += B.flowers(40, 1420, 8, 21, 200) + B.flowers(840, 1460, 8, 41, 200);
  return s;
};

// ---------------------------------------------------------------- 5. Ferris wheel at sunset
B.wheel = (t, rot, highlight = 0) => {
  let s = `<rect width="1080" height="1920" fill="url(#gSkySunset)"/>`;
  s += `<circle cx="760" cy="1290" r="420" fill="url(#gSunsetGlow)"/><circle cx="760" cy="1290" r="96" fill="#FFF4D6"/>`;
  s += B.cloud(-40 + t * 6, 420, 1.0, 0.85, '#FFD0C4', '#E99AB2') + B.cloud(640 + t * 4, 600, 0.8, 0.8, '#FFD7B8', '#EBA0A8');
  for (let i = 0; i < 4; i++) s += B.bird(200 + i * 46 + t * 30, 360 + (i % 2) * 26, 1, Math.sin(t * 8 + i));
  // wheel
  const cx = 540, cy = 860, R = 430;
  let w = `<g transform="translate(${cx} ${cy})">`;
  w += `<path d="M-40,40 L-260,760 M40,40 L260,760 M-40,40 L-150,760 M40,40 L150,760" stroke="#5A3F7A" stroke-width="16" stroke-linecap="round"/>`;
  w += `<g transform="rotate(${U.f(rot)})">`;
  w += `<circle r="${R}" fill="none" stroke="#6B4B8C" stroke-width="14"/><circle r="${R - 40}" fill="none" stroke="#6B4B8C" stroke-width="6"/>`;
  for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; w += `<path d="M0,0 L${U.f(Math.cos(a) * R)},${U.f(Math.sin(a) * R)}" stroke="#7A5A9A" stroke-width="4"/>`; }
  for (let k = 0; k < 48; k++) { const a = k * Math.PI / 24; w += `<circle cx="${U.f(Math.cos(a) * (R - 20))}" cy="${U.f(Math.sin(a) * (R - 20))}" r="4" fill="#FFE9A8"/>`; }
  w += `</g><circle r="44" fill="#6B4B8C"/><circle r="22" fill="#FFD27A"/>`;
  // gondolas (stay upright)
  const cols = ['#FF9DBB', '#FFD36B', '#9FD8C2', '#B9A2F0', '#8FC7F2', '#FFB38A'];
  for (let k = 0; k < 12; k++) {
    const a = (rot + k * 30) * Math.PI / 180;
    const gx = Math.cos(a) * R, gy = Math.sin(a) * R;
    const ours = k === 0;
    w += `<g transform="translate(${U.f(gx)} ${U.f(gy)})"><path d="M0,0 L0,26" stroke="#6B4B8C" stroke-width="5"/>`;
    w += `<rect x="-38" y="24" width="76" height="70" rx="22" fill="${cols[k % 6]}" stroke="#5A3F7A" stroke-width="4"/>`;
    w += `<rect x="-26" y="36" width="52" height="30" rx="8" fill="#FFF3D6" opacity=".9"/>`;
    if (ours) w += `${U.heart(0, 2, 34, '#FF5C8D', 0.4 + highlight * 0.6)}<circle cx="0" cy="58" r="${U.f(60 + highlight * 30)}" fill="#FFF1C9" opacity="${U.f(highlight * 40) / 100}" filter="url(#fBlur8)"/>`;
    w += `</g>`;
  }
  w += `</g>`;
  s += w;
  // city silhouette
  let city = '';
  for (let i = 0; i < 16; i++) {
    const bx = i * 72 - 30, bh = 110 + U.hash(i + 51) * 200, bw = 64 + U.hash(i + 2) * 30;
    city += `<rect x="${U.f(bx)}" y="${U.f(1720 - bh)}" width="${U.f(bw)}" height="${U.f(bh + 320)}" fill="#3B2A5E"/>`;
    for (let wy = 1720 - bh + 20; wy < 1880; wy += 34) for (let wx = bx + 10; wx < bx + bw - 12; wx += 20) if (U.hash(wx * 3.1 + wy) > 0.55) city += `<rect x="${U.f(wx)}" y="${U.f(wy)}" width="9" height="13" fill="#FFD98A" opacity=".85"/>`;
  }
  s += city + `<rect x="0" y="1860" width="1080" height="60" fill="#2E2150"/>`;
  return s;
};

// ---------------------------------------------------------------- 6. inside the gondola
B.gondola = (t, glow = 1) => {
  let s = `<rect width="1080" height="1920" fill="url(#gGondolaWall)"/>`;
  // window
  s += `<g><rect x="70" y="250" width="940" height="1050" rx="120" fill="url(#gSkySunset)"/>`;
  s += `<clipPath id="winClip"><rect x="70" y="250" width="940" height="1050" rx="120"/></clipPath><g clip-path="url(#winClip)">`;
  s += `<circle cx="760" cy="1060" r="420" fill="url(#gSunsetGlow)"/><circle cx="760" cy="1080" r="90" fill="#FFF4D6"/>`;
  s += B.cloud(140 + t * 5, 520, 0.9, 0.85, '#FFD0C4', '#E99AB2');
  let city = '';
  for (let i = 0; i < 26; i++) {
    const bx = 40 + i * 40, bh = 80 + U.hash(i + 70) * 160;
    city += `<rect x="${bx}" y="${U.f(1300 - bh)}" width="36" height="${U.f(bh)}" fill="#4A356E"/>`;
    for (let wy = 1300 - bh + 12; wy < 1290; wy += 22) if (U.hash(i * 7 + wy) > 0.5) city += `<rect x="${bx + 8}" y="${U.f(wy)}" width="6" height="9" fill="#FFD98A"/><rect x="${bx + 22}" y="${U.f(wy)}" width="6" height="9" fill="#FFD98A" opacity="${U.hash(wy) > 0.5 ? 1 : 0.3}"/>`;
  }
  s += city + `</g>`;
  s += `<rect x="70" y="250" width="940" height="1050" rx="120" fill="none" stroke="#FFF1E2" stroke-width="34"/>`;
  s += `<path d="M540,250 L540,1300 M70,760 L1010,760" stroke="#FFF1E2" stroke-width="18"/>`;
  s += `<path d="M160,330 L380,330 M150,380 L300,380" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".5"/></g>`;
  // seat back
  s += `<rect x="20" y="1340" width="1040" height="700" rx="70" fill="#C9708A"/><rect x="50" y="1370" width="980" height="640" rx="60" fill="#DA8AA0"/>`;
  s += `<circle cx="760" cy="1060" r="700" fill="url(#gWarmLight)" opacity="${glow}"/>`;
  return s;
};

// ---------------------------------------------------------------- 7. night train
B.train = (t, speed = 1) => {
  let s = `<rect width="1080" height="1920" fill="url(#gTrainWall)"/>`;
  // ceiling & ads
  s += `<rect x="0" y="0" width="1080" height="210" fill="#F4F1F8"/><rect x="0" y="200" width="1080" height="16" fill="#B9B0D0"/>`;
  s += `<rect x="60" y="40" width="430" height="120" rx="12" fill="#FFE3EC" stroke="#D9B5C8" stroke-width="4"/><text x="275" y="116" text-anchor="middle" font-size="40" font-weight="700" fill="#D97FA2">星見遊園地</text>`;
  s += `<rect x="590" y="40" width="430" height="120" rx="12" fill="#E3EEFF" stroke="#B7C6E6" stroke-width="4"/><text x="805" y="116" text-anchor="middle" font-size="36" font-weight="700" fill="#6E8FC8">next ▶ ほしみ</text>`;
  // window
  s += `<rect x="40" y="330" width="1000" height="760" rx="40" fill="url(#gTrainWin)"/>`;
  s += `<clipPath id="trainWin"><rect x="40" y="330" width="1000" height="760" rx="40"/></clipPath><g clip-path="url(#trainWin)">`;
  for (let i = 0; i < 60; i++) { const sx = U.hash(i * 1.7) * 1100, sy = 340 + U.hash(i * 3.3) * 380; s += `<circle cx="${U.f(sx)}" cy="${U.f(sy)}" r="${U.f(1 + U.hash(i) * 2.2)}" fill="#fff" opacity="${U.f(0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)))}"/>`; }
  s += `<circle cx="860" cy="450" r="50" fill="#FFF8DC"/><circle cx="880" cy="440" r="46" fill="#1A2152"/>`;
  // far city lights (slow), near poles (fast)
  const sc = t * 260 * speed;
  for (let i = 0; i < 30; i++) {
    const x = ((i * 90 - sc * 0.35) % 2700 + 2700) % 2700 - 300, h = 60 + U.hash(i + 3) * 200;
    s += `<rect x="${U.f(x)}" y="${U.f(1090 - h)}" width="70" height="${U.f(h)}" fill="#2B2E66"/>`;
    for (let wy = 1090 - h + 14; wy < 1080; wy += 26) if (U.hash(i * 11 + wy) > 0.5) s += `<rect x="${U.f(x + 12)}" y="${U.f(wy)}" width="9" height="11" fill="#FFD98A" opacity=".9"/>`;
  }
  for (let i = 0; i < 14; i++) {
    const x = ((i * 160 - sc * 1.4) % 2240 + 2240) % 2240 - 200, y = 780 + U.hash(i * 4) * 200;
    s += `<circle cx="${U.f(x)}" cy="${U.f(y)}" r="${U.f(14 + U.hash(i) * 16)}" fill="${['#FFC97A', '#FF9DBB', '#9FD8FF'][i % 3]}" opacity=".55" filter="url(#fBlur8)"/>`;
  }
  s += `</g>`;
  s += `<rect x="40" y="330" width="1000" height="760" rx="40" fill="none" stroke="#B9B0D0" stroke-width="24"/>`;
  s += `<path d="M540,330 L540,1090" stroke="#B9B0D0" stroke-width="16"/>`;
  s += `<path d="M110,400 L300,400 M110,440 L220,440" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".18"/>`;
  // straps
  for (let k = 0; k < 4; k++) {
    const x = 140 + k * 270, sw = Math.sin(t * 1.6 + k * 0.7) * 6;
    s += `<g transform="rotate(${U.f(sw)} ${x} 216)"><path d="M${x},216 L${x},280" stroke="#9E96BE" stroke-width="8"/><circle cx="${x}" cy="306" r="26" fill="none" stroke="#F2B64A" stroke-width="9"/></g>`;
  }
  // seat
  s += `<rect x="0" y="1380" width="1080" height="560" rx="40" fill="url(#gSeat)"/><rect x="0" y="1380" width="1080" height="30" fill="#7CC2BB" opacity=".6"/>`;
  return s;
};

// ---------------------------------------------------------------- 8. end card
B.end = t => {
  let s = `<rect width="1080" height="1920" fill="url(#gEnd)"/>`;
  for (let i = 0; i < 26; i++) {
    const x = U.hash(i * 1.9) * 1080, y = ((U.hash(i * 2.7) * 2100 - t * (40 + U.hash(i) * 60)) % 2100 + 2100) % 2100 - 100;
    const c = ['#FFB3CB', '#FFE08A', '#BFE0FF', '#D9C6FF'][i % 4];
    s += i % 3 ? U.heart(x, y, 26 + U.hash(i * 5) * 30, c, 0.75, Math.sin(t + i) * 20) : U.sparkle(x, y, 14 + U.hash(i) * 12, c, 0.9);
  }
  return s;
};
