// rooms.js — interiors for the comparison video. Panel space: 1080 x 930.
const R = {};
const PW = 1080, PH = 930;
R.defs = `
<linearGradient id="rgDaySky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FCBFF"/><stop offset="1" stop-color="#E4F3FF"/></linearGradient>
<linearGradient id="rgNightSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121A45"/><stop offset="1" stop-color="#3A3B7A"/></linearGradient>
<linearGradient id="rgDusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5D6290"/><stop offset="1" stop-color="#A9A7C6"/></linearGradient>
<radialGradient id="rgSunbeam" cx=".85" cy=".1" r="1"><stop offset="0" stop-color="#FFF4C8" stop-opacity=".75"/><stop offset=".6" stop-color="#FFF4C8" stop-opacity="0"/></radialGradient>
<radialGradient id="rgLamp"><stop offset="0" stop-color="#FFD9A0" stop-opacity=".7"/><stop offset="1" stop-color="#FFD9A0" stop-opacity="0"/></radialGradient>
<radialGradient id="rgScreen"><stop offset="0" stop-color="#9FD0FF" stop-opacity=".55"/><stop offset="1" stop-color="#9FD0FF" stop-opacity="0"/></radialGradient>
<linearGradient id="rgWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8C9A6"/><stop offset="1" stop-color="#D3AE86"/></linearGradient>
`;
// ---------------------------------------------------------------- shared pieces
R.wall = (col, h = 620, stripe = null) => {
  let s = `<rect x="0" y="0" width="${PW}" height="${h}" fill="${col}"/>`;
  if (stripe) for (let x = 0; x < PW; x += 60) s += `<rect x="${x}" y="0" width="30" height="${h}" fill="${stripe}" opacity=".35"/>`;
  return s + `<rect x="0" y="${h - 22}" width="${PW}" height="22" fill="#FFFFFF" opacity=".55"/>`;
};
R.floor = (col, y = 620, line = '#00000014') => {
  let s = `<rect x="0" y="${y}" width="${PW}" height="${PH - y}" fill="${col}"/>`;
  for (let k = 1; k < 6; k++) { const yy = y + Math.pow(k / 5, 1.6) * (PH - y); s += `<path d="M0,${U.f(yy)} L${PW},${U.f(yy)}" stroke="${line}" stroke-width="3"/>`; }
  return s;
};
R.window = (x, y, w, h, mode, t = 0, curtain = 1, curtainCol = '#F6B8C8') => {
  const sky = mode === 'day' ? 'url(#rgDaySky)' : mode === 'dusk' ? 'url(#rgDusk)' : 'url(#rgNightSky)';
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${sky}" stroke="#FFFFFF" stroke-width="16"/>`;
  if (mode === 'day') s += B.cloud(x + 40 + (t * 6) % 80, y + 90, 0.55, 0.95);
  if (mode === 'night') {
    s += `<circle cx="${x + w * 0.72}" cy="${y + h * 0.28}" r="30" fill="#FFF8DC"/><circle cx="${x + w * 0.72 + 12}" cy="${y + h * 0.28 - 6}" r="27" fill="#1A2152"/>`;
    for (let i = 0; i < 14; i++) s += `<circle cx="${U.f(x + 20 + U.hash(i + x) * (w - 40))}" cy="${U.f(y + 20 + U.hash(i * 3 + y) * h * 0.6)}" r="2" fill="#fff" opacity="${U.f(0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)))}"/>`;
    for (let i = 0; i < 6; i++) { const bx = x + i * (w / 6), bh = 40 + U.hash(i + 9) * 90; s += `<rect x="${U.f(bx)}" y="${U.f(y + h - bh)}" width="${U.f(w / 6 - 6)}" height="${U.f(bh)}" fill="#2A2E66"/>`; if (U.hash(i) > 0.3) s += `<rect x="${U.f(bx + 10)}" y="${U.f(y + h - bh + 14)}" width="8" height="10" fill="#FFD98A"/>`; }
  }
  s += `<path d="M${x + w / 2},${y} L${x + w / 2},${y + h} M${x},${y + h / 2} L${x + w},${y + h / 2}" stroke="#FFFFFF" stroke-width="10"/>`;
  // curtains: curtain = 1 closed, 0 open
  const cw = 20 + (w / 2) * curtain;
  s += `<path d="M${x - 30},${y - 30} L${x - 30 + cw},${y - 30} Q${x - 20 + cw},${y + h / 2} ${x - 30 + cw},${y + h + 40} L${x - 30},${y + h + 40} Z" fill="${curtainCol}" stroke="#00000022" stroke-width="3"/>`;
  s += `<path d="M${x + w + 30},${y - 30} L${x + w + 30 - cw},${y - 30} Q${x + w + 20 - cw},${y + h / 2} ${x + w + 30 - cw},${y + h + 40} L${x + w + 30},${y + h + 40} Z" fill="${curtainCol}" stroke="#00000022" stroke-width="3"/>`;
  for (let k = 1; k < 4; k++) s += `<path d="M${U.f(x - 30 + cw * k / 4)},${y - 20} L${U.f(x - 30 + cw * k / 4)},${y + h + 30} M${U.f(x + w + 30 - cw * k / 4)},${y - 20} L${U.f(x + w + 30 - cw * k / 4)},${y + h + 30}" stroke="#00000018" stroke-width="4"/>`;
  s += `<rect x="${x - 50}" y="${y - 44}" width="${w + 100}" height="14" rx="7" fill="#A89FC2"/>`;
  return s;
};
R.clockBox = (x, y, text, shake = 0, glow = false) => `<g transform="translate(${U.f(x + shake)} ${y})"><rect x="-58" y="-34" width="116" height="62" rx="14" fill="#4E4A68" stroke="#2E2B40" stroke-width="3"/><rect x="-48" y="-25" width="96" height="44" rx="8" fill="${glow ? '#FFE3A0' : '#BFE9D9'}"/><text x="0" y="10" text-anchor="middle" font-size="34" font-weight="700" fill="#2E2B40">${text}</text></g>`;
R.plant = (x, y, s = 1) => `<g ${U.tr(x, y, s)}><path d="M-34,0 L34,0 L26,70 L-26,70 Z" fill="#E7B9A2" stroke="#B98A74" stroke-width="3"/><path d="M0,0 C-30,-60 -70,-70 -80,-40 C-50,-50 -20,-30 0,0 M0,0 C20,-80 60,-90 70,-60 C40,-60 20,-40 0,0 M0,0 C-6,-70 10,-110 30,-120 C20,-80 14,-40 0,0" fill="#8FCB98" stroke="#5E9E6C" stroke-width="3"/></g>`;
R.frame = (x, y, w, h, col = '#FFB8CC') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#FFFFFF" stroke="#B9AED0" stroke-width="5"/><rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${h - 24}" rx="4" fill="${col}" opacity=".8"/>${U.heart(x + w / 2, y + h / 2, Math.min(w, h) * 0.4, '#FFFFFF', 0.85)}`;
R.steam = (x, y, t, n = 3, h = 70, col = '#FFFFFF') => {
  let s = '';
  for (let k = 0; k < n; k++) { const ph = (t * 0.7 + k / n) % 1; s += `<path d="M${x + (k - 1) * 22},${y - ph * h} q-10,-14 0,-28 q10,-14 0,-28" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" opacity="${U.f(Math.sin(ph * Math.PI) * 80) / 100}"/>`; }
  return s;
};

// ---------------------------------------------------------------- bedroom
// o: {light:'dark'|'day'|'night', curtain:0..1, clock:'7:00', clockShake, clockGlow, mess}
R.bedroom = (t, o = {}) => {
  const day = o.light === 'day';
  let s = R.wall(day ? '#FFF1EA' : '#CFC9DF', 620, day ? '#FFE2E8' : null) + R.floor(day ? '#E9CDB8' : '#A9A1B9');
  s += R.window(650, 90, 300, 300, day ? 'day' : 'night', t, o.curtain != null ? o.curtain : 1, day ? '#FFC4D3' : '#7E7AA0');
  if (day) s += `<rect x="0" y="0" width="${PW}" height="${PH}" fill="url(#rgSunbeam)"/>`;
  if (day) s += R.frame(120, 120, 140, 180, '#FFD6E2') + R.plant(70, 560, 0.9);
  else s += `<rect x="110" y="140" width="150" height="190" rx="4" fill="#8E88A8" opacity=".6"/>`;
  // bed
  s += `<rect x="150" y="300" width="460" height="140" rx="30" fill="${day ? '#E7B9A2' : '#8C8299'}" stroke="#00000022" stroke-width="4"/>`;
  s += `<ellipse cx="380" cy="420" rx="150" ry="46" fill="${day ? '#FFFFFF' : '#C9C3D6'}" stroke="#00000022" stroke-width="3"/>`;
  // nightstand + clock
  s += `<rect x="640" y="470" width="150" height="160" rx="10" fill="${day ? '#E8C9A6' : '#8F87A2'}" stroke="#00000022" stroke-width="4"/><path d="M650,540 L780,540" stroke="#00000022" stroke-width="3"/>`;
  s += R.clockBox(712, 440, o.clock || '7:00', o.clockShake || 0, o.clockGlow);
  if (o.mess) s += `<g opacity=".9"><path d="M860,820 C900,780 980,790 1000,840 C960,860 890,860 860,820 Z" fill="#7E7896"/><rect x="40" y="800" width="90" height="70" rx="8" fill="#8F87A2"/><path d="M60,800 L110,780" stroke="#6E6684" stroke-width="6"/></g>`;
  return s;
};
R.blanket = (o = {}) => {
  const day = o.light === 'day';
  const c = day ? '#BFD8F2' : '#8784A6', sh = day ? '#9FC0E6' : '#6E6B8C';
  return `<path d="M150,${o.top || 480} C250,${(o.top || 480) - 20} 510,${(o.top || 480) - 20} 610,${o.top || 480} L700,${PH} L60,${PH} Z" fill="${c}" stroke="#00000022" stroke-width="4"/>
    <path d="M160,${(o.top || 480) + 30} C260,${(o.top || 480) + 12} 500,${(o.top || 480) + 12} 600,${(o.top || 480) + 30}" fill="none" stroke="#FFFFFF" stroke-width="10" opacity=".55"/>
    <path d="M250,560 C260,700 240,820 220,930 M470,560 C490,700 500,820 520,930" fill="none" stroke="${sh}" stroke-width="8" stroke-linecap="round" opacity=".8"/>`;
};

// ---------------------------------------------------------------- kitchen counter (morning, alone)
R.kitchen = (t, o = {}) => {
  let s = R.wall('#D8D3E2', 640);
  for (let y = 300; y < 600; y += 40) for (let x = 0; x < PW; x += 60) s += `<rect x="${x + (y / 40 % 2) * 30}" y="${y}" width="56" height="36" fill="#E4E0EC" stroke="#C6C0D3" stroke-width="2"/>`;
  s += `<rect x="40" y="40" width="560" height="200" rx="10" fill="#BDB6CF" stroke="#9E97B4" stroke-width="4"/><path d="M320,40 L320,240" stroke="#9E97B4" stroke-width="4"/>`;
  s += `<rect x="800" y="120" width="230" height="520" rx="18" fill="#E6E3EE" stroke="#A9A3BC" stroke-width="5"/><path d="M800,330 L1030,330 M830,180 L830,290 M830,360 L830,440" stroke="#A9A3BC" stroke-width="6" stroke-linecap="round"/>`;
  s += `<rect x="0" y="600" width="${PW}" height="${PH - 600}" fill="#A79FB8"/><rect x="0" y="590" width="${PW}" height="34" fill="#C6BFD6"/>`;
  // empty cans on the counter
  for (const [cx, rr] of [[120, -8], [170, 6], [700, 80]]) s += `<g transform="translate(${cx} 575) rotate(${rr})"><rect x="-12" y="-44" width="24" height="46" rx="4" fill="#9ED8D1" stroke="#5E9994" stroke-width="2.4"/></g>`;
  return s;
};

// ---------------------------------------------------------------- dining table
// o: {mode:'morning'|'night', dishes:'breakfast'|'nabe'}
R.dining = (t, o = {}) => {
  const night = o.mode === 'night';
  let s = R.wall(night ? '#F3E2D8' : '#FFF4EA', 600, night ? '#F8E7DE' : '#FFEFE6') + R.floor('#E6C6AE', 600);
  s += R.window(80, 70, 300, 260, night ? 'night' : 'day', t, 0.05, '#FFD1DC');
  s += R.plant(960, 520, 1.0) + R.frame(470, 110, 150, 120, '#FFE2A8');
  s += `<path d="M760,0 L760,90" stroke="#B9AED0" stroke-width="5"/><path d="M700,90 L820,90 L800,140 L720,140 Z" fill="#FFD9A0" stroke="#D9A86A" stroke-width="4"/>`;
  s += `<circle cx="760" cy="150" r="${night ? 260 : 140}" fill="url(#rgLamp)" opacity="${night ? 1 : 0.5}"/>`;
  if (!night) s += `<rect x="0" y="0" width="${PW}" height="${PH}" fill="url(#rgSunbeam)" opacity=".6"/>`;
  return s;
};
R.table = (t, o = {}) => {
  let s = `<rect x="-20" y="610" width="1120" height="70" rx="16" fill="#F7E6D4" stroke="#D9B996" stroke-width="5"/><rect x="-20" y="676" width="1120" height="260" fill="#D9B48C"/>`;
  s += `<path d="M-20,640 L1100,640" stroke="#FFFFFF" stroke-width="6" opacity=".6"/>`;
  const bowl = (x, y, col = '#FFFFFF', fill = '#FFFFFF') => `<g transform="translate(${x} ${y})"><path d="M-40,-8 C-36,26 36,26 40,-8 Z" fill="${col}" stroke="#B9AED0" stroke-width="3"/><ellipse cx="0" cy="-8" rx="40" ry="10" fill="${fill}" stroke="#B9AED0" stroke-width="3"/></g>`;
  if (o.dishes === 'breakfast') {
    for (const x of [230, 540, 850]) s += bowl(x - 50, 628, '#FFFFFF', '#FFFFFF') + bowl(x + 50, 628, '#B9472F', '#C98A55');
    s += `<g transform="translate(540 600)"><ellipse rx="110" ry="26" fill="#FFFFFF" stroke="#B9AED0" stroke-width="3"/>`;
    for (let k = -2; k <= 2; k++) s += `<rect x="${k * 34 - 15}" y="-30" width="30" height="28" rx="6" fill="#FFD95E" stroke="#E0A92E" stroke-width="2.4"/><path d="M${k * 34 - 10},-18 l20,0" stroke="#E0A92E" stroke-width="2"/>`;
    s += `</g>`;
  }
  if (o.dishes === 'nabe') {
    s += `<g transform="translate(540 600)"><ellipse rx="170" ry="40" fill="#5A4E66" stroke="#3E3550" stroke-width="4"/><ellipse cx="0" cy="-10" rx="150" ry="30" fill="#F2C58A"/>`;
    for (const [x, y, c] of [[-80, -14, '#FFFFFF'], [-30, -20, '#7CC48A'], [20, -10, '#F08A6A'], [70, -18, '#FFFFFF'], [110, -8, '#E9B86C'], [-110, -6, '#C9A0E8']]) s += `<ellipse cx="${x}" cy="${y}" rx="26" ry="12" fill="${c}" stroke="#00000022" stroke-width="2"/>`;
    s += `</g>` + R.steam(540, 560, t, 4, 120);
    for (const x of [200, 880]) s += bowl(x, 640, '#FFFFFF', '#F7E9D8');
  }
  return s;
};

// ---------------------------------------------------------------- train (crowded, gray)
R.trainBack = t => {
  let s = `<rect width="${PW}" height="${PH}" fill="#CFCBD9"/><rect x="0" y="0" width="${PW}" height="110" fill="#E4E1EA"/>`;
  s += `<rect x="60" y="150" width="960" height="300" rx="20" fill="#9EA3B8" stroke="#B9B5C6" stroke-width="16"/>`;
  for (let i = 0; i < 9; i++) { const x = ((i * 140 - t * 300) % 1300 + 1300) % 1300 - 100; s += `<rect x="${U.f(x)}" y="${U.f(300 - U.hash(i) * 120)}" width="110" height="${U.f(150 + U.hash(i) * 120)}" fill="#7F8399"/>`; }
  for (let k = 0; k < 5; k++) { const x = 120 + k * 210, sw = Math.sin(t * 2 + k) * 4; s += `<g transform="rotate(${U.f(sw)} ${x} 110)"><path d="M${x},110 L${x},170" stroke="#8E89A0" stroke-width="7"/><circle cx="${x}" cy="194" r="24" fill="none" stroke="#BDB8C8" stroke-width="8"/></g>`; }
  // back row of people
  for (let i = 0; i < 7; i++) s += R.person(80 + i * 160, 560, 0.95, i);
  return s;
};
R.person = (x, y, sc, seed) => {
  const c = ['#7C7890', '#8A8699', '#6E6A82', '#938FA4'][seed % 4];
  return `<g ${U.tr(x, y, sc)}><path d="M-70,200 C-70,120 -50,80 0,80 C50,80 70,120 70,200 Z" fill="${c}"/><circle cx="0" cy="20" r="56" fill="${c}"/><circle cx="0" cy="20" r="56" fill="#000" opacity=".08"/></g>`;
};
R.trainFront = t => {
  let s = '';
  for (let i = 0; i < 5; i++) s += R.person(40 + i * 250 + (i % 2) * 30, 760, 1.4, i + 3);
  return s;
};

// ---------------------------------------------------------------- entrance (genkan)
// o: {light:'dark'|'warm'|'morning', door:0..1 open, roomLight:0..1}
R.genkan = (t, o = {}) => {
  const L = o.light || 'warm';
  const dark = L === 'dark';
  let s = R.wall(dark ? '#5E5A70' : '#FFF1E6', 640, dark ? null : '#FFE9DD') + R.floor(dark ? '#4E4A60' : '#E3C3A8', 640);
  if (dark && o.roomLight) s += `<rect width="${PW}" height="${PH}" fill="#E9E4D6" opacity="${U.f(o.roomLight * 45) / 100}"/>`;
  // door frame + door
  const dx = 640, dy = 110, dw = 260, dh = 650;
  const outside = L === 'morning' ? '#CFE9FF' : dark ? '#C9B98A' : '#FFE3B0';
  s += `<rect x="${dx - 16}" y="${dy - 16}" width="${dw + 32}" height="${dh + 16}" fill="${dark ? '#45415A' : '#E2C9B5'}"/>`;
  s += `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" fill="${outside}"/>`;
  if (L === 'morning') s += `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" fill="url(#rgSunbeam)"/>`;
  const open = o.door || 0, w = dw * (1 - 0.82 * open);
  s += `<path d="M${dx},${dy} L${U.f(dx + w)},${U.f(dy - 18 * open)} L${U.f(dx + w)},${U.f(dy + dh + 18 * open)} L${dx},${dy + dh} Z" fill="${dark ? '#6A6680' : '#C9A88C'}" stroke="#00000033" stroke-width="4"/>`;
  s += `<circle cx="${U.f(dx + w - 26 * (1 - open))}" cy="${dy + dh / 2}" r="10" fill="#E9C46A"/>`;
  if (open > 0.05 && (dark || L === 'warm')) s += `<path d="M${dx},${dy + dh} L${dx + dw},${dy + dh} L${dx + dw + 140},${PH} L${dx - 140},${PH} Z" fill="${outside}" opacity="${U.f(open * 35) / 100}"/>`;
  // shoe shelf, mat, light switch
  s += `<rect x="60" y="420" width="300" height="240" rx="10" fill="${dark ? '#6E6A82' : '#E8C9A6'}" stroke="#00000022" stroke-width="4"/><path d="M60,540 L360,540" stroke="#00000022" stroke-width="4"/>`;
  if (!dark) s += R.plant(210, 420, 0.7) + R.frame(120, 140, 160, 130, '#FFE2A8');
  s += `<rect x="560" y="420" width="30" height="46" rx="6" fill="${dark ? '#8C88A0' : '#FFFFFF'}" stroke="#00000033" stroke-width="3"/>`;
  s += `<ellipse cx="770" cy="800" rx="220" ry="40" fill="${dark ? '#55516A' : '#F6B8C8'}" opacity=".9"/>`;
  if (dark && o.mess) s += `<g opacity=".95"><path d="M60,860 C80,800 170,800 190,860 Z" fill="#3E3A52"/><path d="M200,880 C230,820 320,830 330,890 Z" fill="#474360"/><rect x="380" y="820" width="110" height="80" rx="8" fill="#5E5A74"/></g>`;
  if (!dark) s += `<circle cx="300" cy="120" r="260" fill="url(#rgLamp)" opacity=".8"/>`;
  return s;
};

// ---------------------------------------------------------------- office desk
// o: {lunch:'konbini'|'home'}
R.office = (t, o = {}) => {
  let s = R.wall('#E6EAF2', 600) + R.floor('#B9C0CF', 600);
  s += `<rect x="620" y="60" width="400" height="300" rx="8" fill="url(#rgDaySky)" stroke="#FFFFFF" stroke-width="14"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="${640 + i * 64}" y="${U.f(220 - U.hash(i + 2) * 80)}" width="54" height="${U.f(140 + U.hash(i + 2) * 80)}" fill="#B9C6DD"/>`;
  s += `<rect x="0" y="380" width="${PW}" height="40" fill="#C9CFDC"/><rect x="40" y="200" width="420" height="190" rx="8" fill="#D6DBE6" stroke="#B2B9C9" stroke-width="4"/>`;
  s += `<rect x="70" y="236" width="140" height="18" rx="4" fill="#B2B9C9"/><rect x="70" y="270" width="320" height="14" rx="4" fill="#C2C8D6"/><rect x="70" y="296" width="260" height="14" rx="4" fill="#C2C8D6"/>`;
  return s;
};
R.officeDesk = (t, o = {}) => {
  let s = `<rect x="-20" y="620" width="1120" height="60" rx="12" fill="#EEF0F5" stroke="#B9BFCD" stroke-width="5"/><rect x="-20" y="676" width="1120" height="260" fill="#C9CEDA"/>`;
  // monitor at the side
  s += `<g transform="translate(150 470)"><rect x="-110" y="-120" width="220" height="150" rx="10" fill="#3E4256" stroke="#2A2D3C" stroke-width="5"/><rect x="-98" y="-108" width="196" height="126" rx="6" fill="#BFD3EE"/><rect x="-14" y="30" width="28" height="90" fill="#9EA4B6"/><rect x="-60" y="116" width="120" height="16" rx="6" fill="#9EA4B6"/></g>`;
  if (o.lunch === 'konbini') {
    s += `<g transform="translate(540 640)"><rect x="-120" y="-40" width="240" height="56" rx="10" fill="#FFFFFF" opacity=".7" stroke="#B9BFCD" stroke-width="3"/><rect x="-110" y="-34" width="110" height="44" rx="6" fill="#F4F1EA"/><rect x="6" y="-34" width="50" height="20" rx="4" fill="#C9A07A"/><rect x="6" y="-10" width="50" height="20" rx="4" fill="#9CCB8A"/><rect x="62" y="-34" width="48" height="44" rx="4" fill="#E9C46A"/></g>`;
    s += `<g transform="translate(850 650) rotate(-8)"><rect x="-50" y="-26" width="100" height="44" rx="8" fill="#3E4256"/><rect x="-44" y="-20" width="88" height="32" rx="4" fill="#20232F"/></g>`;
  }
  if (o.lunch === 'home') {
    s += `<g transform="translate(540 636)"><rect x="-130" y="-46" width="260" height="66" rx="16" fill="#C9B6EE" stroke="#8C78C0" stroke-width="4"/><rect x="-118" y="-38" width="236" height="50" rx="10" fill="#FFFFFF"/>`;
    s += `<rect x="-112" y="-34" width="110" height="42" rx="8" fill="#FFFDF6"/>${U.heart(-57, -14, 26, '#FF8FA8')}`;
    for (const [x, c] of [[18, '#FFD95E'], [52, '#F08A6A'], [86, '#8FCB98']]) s += `<circle cx="${x}" cy="-14" r="15" fill="${c}" stroke="#00000022" stroke-width="2"/>`;
    s += `</g>`;
  }
  return s;
};

// ---------------------------------------------------------------- PC desk at night (alone)
R.pcRoom = (t, o = {}) => {
  let s = R.wall('#3E3A55', 620) + R.floor('#34304A', 620);
  s += R.window(720, 90, 260, 240, 'night', t, 0.6, '#4E4A68');
  s += `<rect x="70" y="140" width="170" height="220" rx="4" fill="#4A4664"/>`;
  return s;
};
R.pcDesk = (t, o = {}) => {
  const fl = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 3.3);
  let s = `<circle cx="300" cy="420" r="420" fill="url(#rgScreen)" opacity="${U.f(fl * 100) / 100}"/>`;
  s += `<rect x="-20" y="630" width="1120" height="50" rx="10" fill="#57526E" stroke="#3E3A55" stroke-width="5"/><rect x="-20" y="676" width="1120" height="260" fill="#46415E"/>`;
  s += `<g transform="translate(190 470)"><rect x="-150" y="-150" width="300" height="190" rx="10" fill="#22202E" stroke="#15141D" stroke-width="6"/><rect x="-136" y="-136" width="272" height="162" rx="6" fill="#9FD0FF" opacity="${U.f(fl * 100) / 100}"/>`;
  s += `<rect x="-110" y="-112" width="60" height="80" rx="6" fill="#FFFFFF" opacity=".7"/><rect x="-36" y="-112" width="60" height="80" rx="6" fill="#FFFFFF" opacity=".7"/><rect x="38" y="-112" width="60" height="80" rx="6" fill="#FFFFFF" opacity=".7"/>`;
  s += `<text x="-80" y="-56" text-anchor="middle" font-size="26" fill="#8A86A0">★</text><text x="-6" y="-56" text-anchor="middle" font-size="26" fill="#8A86A0">★</text><text x="68" y="-56" text-anchor="middle" font-size="26" fill="#8A86A0">★</text>`;
  s += `<rect x="-20" y="40" width="40" height="80" fill="#2E2B3C"/></g>`;
  // cup ramen
  s += `<g transform="translate(700 650)"><path d="M-56,-70 L56,-70 L44,10 L-44,10 Z" fill="#FFFFFF" stroke="#B9B4C8" stroke-width="4"/><path d="M-52,-44 L52,-44 L49,-20 L-49,-20 Z" fill="#E8574F"/><ellipse cx="0" cy="-70" rx="58" ry="12" fill="#F2D29B" stroke="#B9B4C8" stroke-width="3"/><path d="M-30,-74 L40,-118 M-22,-72 L48,-112" stroke="#C9A06E" stroke-width="5" stroke-linecap="round"/></g>`;
  s += R.steam(700, 560, t, 3, 70, '#E7E3F0');
  return s;
};

// ---------------------------------------------------------------- living room (night, warm)
R.living = (t, o = {}) => {
  let s = R.wall('#F6E2DA', 600, '#FAE9E2') + R.floor('#E0BFA6', 600);
  s += R.window(700, 70, 280, 240, 'night', t, 0.15, '#F7C6D2');
  s += `<g transform="translate(100 600)"><path d="M0,0 L0,-360" stroke="#8C7A9C" stroke-width="8"/><path d="M-50,-360 L50,-360 L36,-430 L-36,-430 Z" fill="#FFE3B0" stroke="#D9A86A" stroke-width="4"/><circle cx="0" cy="-390" r="230" fill="url(#rgLamp)"/></g>`;
  s += R.frame(330, 120, 200, 140, '#FFD6E2');
  // sofa
  s += `<rect x="150" y="360" width="780" height="260" rx="60" fill="#C9A8E0" stroke="#9C7CBC" stroke-width="5"/>`;
  s += `<rect x="110" y="470" width="110" height="230" rx="40" fill="#BF9CD8" stroke="#9C7CBC" stroke-width="5"/><rect x="860" y="470" width="110" height="230" rx="40" fill="#BF9CD8" stroke="#9C7CBC" stroke-width="5"/>`;
  return s;
};
R.sofaFront = (t, o = {}) => `<rect x="190" y="600" width="700" height="120" rx="30" fill="#D9BCEC" stroke="#9C7CBC" stroke-width="5"/><rect x="300" y="760" width="480" height="40" rx="12" fill="#E8C9A6" stroke="#C49C78" stroke-width="4"/><rect x="330" y="800" width="20" height="130" fill="#C49C78"/><rect x="730" y="800" width="20" height="130" fill="#C49C78"/>`;
R.kitchenFront = () => `<rect x="0" y="600" width="${PW}" height="${PH - 600}" fill="#A79FB8"/><rect x="0" y="590" width="${PW}" height="34" fill="#C6BFD6"/><path d="M0,700 L${PW},700" stroke="#968EAA" stroke-width="4"/><rect x="120" y="730" width="300" height="160" rx="10" fill="#B3ACC4" stroke="#968EAA" stroke-width="4"/><rect x="660" y="730" width="300" height="160" rx="10" fill="#B3ACC4" stroke="#968EAA" stroke-width="4"/>`;
