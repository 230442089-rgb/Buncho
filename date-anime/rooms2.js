// rooms2.js — extra interiors/props for the "lifetime" comparison. Panel space 1080 x 930.
R.flame = (x, y, t, s = 1) => {
  const f = 1 + 0.15 * Math.sin(t * 23 + x) + 0.08 * Math.sin(t * 37);
  return `<g ${U.tr(x, y, s)}><circle cx="0" cy="-10" r="26" fill="#FFD98A" opacity=".35" filter="url(#fBlur8)"/><path transform="scale(1 ${U.f(f * 100) / 100})" d="M0,-26 C10,-14 9,-2 0,2 C-9,-2 -10,-14 0,-26 Z" fill="#FFB547"/><path transform="scale(1 ${U.f(f * 100) / 100})" d="M0,-16 C5,-9 4,-2 0,0 C-4,-2 -5,-9 0,-16 Z" fill="#FFF3C4"/></g>`;
};
R.candle = (x, y, t, lit, col = '#FF9DBB') => `<rect x="${x - 4}" y="${y - 40}" width="8" height="40" rx="3" fill="${col}" stroke="#00000022" stroke-width="2"/><path d="M${x},${y - 40} l0,-6" stroke="#333" stroke-width="2"/>` + (lit ? R.flame(x, y - 46, t, 0.8) : '');
R.cakeSlice = (x, y, t, lit) => `<g transform="translate(${x} ${y}) scale(1.7)"><rect x="-80" y="-14" width="160" height="30" rx="8" fill="#FFFFFF" opacity=".5" stroke="#B9B5C6" stroke-width="3"/><path d="M-50,0 L50,0 L30,-56 Z" fill="#FFF6E8" stroke="#C9BFAE" stroke-width="3"/><path d="M-44,-14 L44,-14 M-36,-30 L36,-30" stroke="#FFD3DC" stroke-width="6"/><circle cx="20" cy="-58" r="9" fill="#E8574F"/></g>` + R.candle(x - 10, y - 82, t, lit, '#C9C3D6');
R.cakeBig = (x, y, t, lit) => {
  let s = `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="6" rx="170" ry="34" fill="#FFFFFF" stroke="#D9CFE6" stroke-width="4"/><path d="M-130,-90 L-130,0 C-130,24 130,24 130,0 L130,-90 Z" fill="#FFF6EE" stroke="#E5C9B7" stroke-width="4"/><ellipse cx="0" cy="-90" rx="130" ry="28" fill="#FFFFFF" stroke="#E5C9B7" stroke-width="4"/><path d="M-130,-50 C-80,-30 80,-30 130,-50" stroke="#FFC4D3" stroke-width="12" fill="none"/>`;
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, cx = Math.cos(a) * 100, cy = -90 + Math.sin(a) * 18; s += `<path transform="translate(${U.f(cx)} ${U.f(cy - 6)})" d="M0,-12 C12,-12 13,3 0,13 C-13,3 -12,-12 0,-12 Z" fill="#FF6B7F" stroke="#D9485F" stroke-width="2"/>`; }
  s += `<rect x="-38" y="-112" width="76" height="34" rx="8" fill="#7A4E3A"/><text x="0" y="-86" text-anchor="middle" font-size="28" font-weight="700" fill="#FFF6E8">${R._age || ''}</text></g>`;
  for (const [dx, c] of [[-60, '#FF9DBB'], [0, '#9FD8FF'], [60, '#FFE08A']]) s += R.candle(x + dx, y - 110, t, lit, c);
  return s;
};
R.partyDeco = (t) => {
  let s = `<path d="M60,40 Q540,150 1020,40" fill="none" stroke="#B9A6DA" stroke-width="4"/>`;
  const letters = 'HAPPY BIRTHDAY';
  for (let i = 0; i < letters.length; i++) {
    const u = (i + 0.5) / letters.length, x = 60 + u * 960, y = 40 + 4 * u * (1 - u) * 110;
    if (letters[i] === ' ') continue;
    s += `<path d="M${U.f(x - 26)},${U.f(y)} L${U.f(x + 26)},${U.f(y)} L${U.f(x)},${U.f(y + 60)} Z" fill="${['#FF9DBB', '#FFE08A', '#9FD8C2', '#B9A2F0'][i % 4]}"/><text x="${U.f(x)}" y="${U.f(y + 30)}" text-anchor="middle" font-size="22" font-weight="700" fill="#FFFFFF">${letters[i]}</text>`;
  }
  for (const [bx, by, c] of [[960, 260, '#FF9DBB'], [1010, 300, '#9FD8FF'], [920, 320, '#FFE08A']]) s += `<path d="M${bx},${by + 50} q-6,40 6,80" stroke="#B9A6DA" stroke-width="2" fill="none"/><ellipse cx="${bx}" cy="${U.f(by + Math.sin(t * 2 + bx) * 6)}" rx="34" ry="42" fill="${c}"/><ellipse cx="${bx - 10}" cy="${U.f(by - 14 + Math.sin(t * 2 + bx) * 6)}" rx="8" ry="12" fill="#fff" opacity=".6"/>`;
  return s;
};
R.confetti = (t, t0, x, y) => {
  const p = (t - t0) / 1.8; if (p < 0 || p > 1) return '';
  let s = '';
  for (let i = 0; i < 40; i++) {
    const a = -Math.PI / 2 + (U.hash(i * 2.1) - 0.5) * 2.2, v = 300 + U.hash(i * 3.3) * 400;
    const px = x + Math.cos(a) * v * p, py = y + Math.sin(a) * v * p + 500 * p * p;
    s += `<rect x="${U.f(px)}" y="${U.f(py)}" width="12" height="7" fill="${['#FF9DBB', '#FFE08A', '#9FD8C2', '#B9A2F0', '#FF8C8C'][i % 5]}" transform="rotate(${U.f(t * 400 + i * 40)} ${U.f(px)} ${U.f(py)})" opacity="${U.f((1 - p) * 100) / 100}"/>`;
  }
  return s;
};

// ---------------------------------------------------------------- night office + boss
R.officeNight = (t) => {
  let s = `<rect width="${PW}" height="${PH}" fill="#2B2A3C"/>`;
  s += `<rect x="560" y="50" width="480" height="320" rx="6" fill="#121A45" stroke="#3E3D55" stroke-width="12"/>`;
  for (let i = 0; i < 8; i++) { const h = 80 + U.hash(i + 4) * 160; s += `<rect x="${574 + i * 58}" y="${U.f(370 - h)}" width="50" height="${U.f(h)}" fill="#1E2558"/>`; for (let k = 0; k < 4; k++) if (U.hash(i * 9 + k) > 0.6) s += `<rect x="${586 + i * 58}" y="${U.f(380 - h + 20 + k * 30)}" width="8" height="10" fill="#FFD98A" opacity=".7"/>`; }
  s += `<g transform="translate(940 210)"><circle r="56" fill="#3E3D55"/><circle r="46" fill="#E8E6F0"/><path d="M0,0 L0,-30 M0,0 L24,10" stroke="#2B2A3C" stroke-width="6" stroke-linecap="round"/></g>`;
  for (let k = 0; k < 4; k++) s += `<rect x="${40 + k * 130}" y="${440 - k * 10}" width="110" height="70" rx="6" fill="#36354A"/>`;
  s += `<rect x="0" y="560" width="${PW}" height="370" fill="#232233"/>`;
  return s;
};
R.officeNightDesk = (t, pile = 6) => {
  let s = `<circle cx="760" cy="560" r="260" fill="#FFE7B0" opacity=".16" filter="url(#fBlur20)"/>`;
  s += `<rect x="-20" y="630" width="1120" height="60" rx="12" fill="#4A4862" stroke="#2E2D40" stroke-width="5"/><rect x="-20" y="686" width="1120" height="260" fill="#38364C"/>`;
  s += `<g transform="translate(880 600)"><path d="M0,30 L0,-90 L-70,-130" stroke="#6E6A82" stroke-width="10" fill="none"/><path d="M-110,-150 L-40,-150 L-60,-110 L-96,-110 Z" fill="#8E8AA0"/><circle cx="-78" cy="-100" r="70" fill="#FFE7B0" opacity=".25" filter="url(#fBlur8)"/></g>`;
  for (let k = 0; k < pile; k++) s += `<rect x="${170 + (k % 2) * 6}" y="${600 - k * 18}" width="170" height="16" fill="#E8E6F0" stroke="#B9B5C6" stroke-width="2"/>`;
  return s;
};
R.boss = (x, y, t, s = 1.15) => `<g ${U.tr(x, y + Math.sin(t * 1.4) * 4, s)}><path d="M-150,560 C-150,300 -110,220 0,220 C110,220 150,300 150,560 Z" fill="#141320"/><circle cx="0" cy="90" r="130" fill="#141320"/><path d="M-70,80 L-24,96 M70,80 L24,96" stroke="#FF5A5A" stroke-width="10" stroke-linecap="round"/><circle cx="-46" cy="104" r="9" fill="#FF7A7A"/><circle cx="46" cy="104" r="9" fill="#FF7A7A"/><path d="M-30,160 L30,160" stroke="#FF5A5A" stroke-width="6" stroke-linecap="round" opacity=".8"/></g>`;

// ---------------------------------------------------------------- fireworks in a window region
R.fireworks = (t, x, y, w, h) => {
  let s = '';
  for (let k = 0; k < 4; k++) {
    const period = 2.2, ph = ((t + k * 0.55) % period) / period;
    if (ph > 0.75) continue;
    const cx = x + w * (0.2 + 0.6 * U.hash(k * 7 + Math.floor((t + k * 0.55) / period))), cy = y + h * (0.25 + 0.35 * U.hash(k * 3 + Math.floor((t + k * 0.55) / period)));
    const r = U.ease.out(ph / 0.75) * 110 * (0.7 + U.hash(k) * 0.5), op = 1 - ph / 0.75;
    const col = ['#FF9DBB', '#FFE08A', '#9FD8FF', '#C9A8F2'][k % 4];
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; s += `<circle cx="${U.f(cx + Math.cos(a) * r)}" cy="${U.f(cy + Math.sin(a) * r + ph * 30)}" r="${U.f(5 * op + 1)}" fill="${col}" opacity="${U.f(op * 100) / 100}"/>`; }
    s += `<circle cx="${U.f(cx)}" cy="${U.f(cy)}" r="${U.f(r * 0.8)}" fill="${col}" opacity="${U.f(op * 18) / 100}" filter="url(#fBlur8)"/>`;
  }
  return s;
};
R.livingFireworks = (t) => {
  let s = R.living(t);
  s += `<clipPath id="fwClip"><rect x="700" y="70" width="280" height="240" rx="10"/></clipPath><g clip-path="url(#fwClip)">${R.fireworks(t, 700, 70, 280, 240)}</g>`;
  return s;
};

// ---------------------------------------------------------------- layoff: office exit, rejection mails
R.exitHall = (t) => {
  let s = `<rect width="${PW}" height="${PH}" fill="#C9CCD8"/><rect x="0" y="620" width="${PW}" height="310" fill="#9EA3B4"/>`;
  s += `<rect x="560" y="80" width="440" height="560" fill="#B9D3EE" stroke="#8E95A8" stroke-width="14"/><path d="M780,80 L780,640" stroke="#8E95A8" stroke-width="10"/>`;
  s += `<rect x="70" y="160" width="300" height="70" rx="8" fill="#8E95A8"/><text x="220" y="207" text-anchor="middle" font-size="34" font-weight="700" fill="#E8E8F0">株式会社 ○○</text>`;
  for (let i = 0; i < 4; i++) s += `<rect x="${600 + (i % 2) * 220}" y="${120 + Math.floor(i / 2) * 260}" width="160" height="200" fill="#D9E6F5" opacity=".5"/>`;
  return s;
};
R.box = (x, y) => `<g transform="translate(${x} ${y})"><path d="M-70,-20 L70,-20 L62,60 L-62,60 Z" fill="#C9A47A" stroke="#8E6E4A" stroke-width="4"/><path d="M-70,-20 L-90,-44 L50,-44 L70,-20" fill="#D9B88E" stroke="#8E6E4A" stroke-width="4"/>${R.plant(-30, -26, 0.4)}<rect x="10" y="-60" width="34" height="40" rx="6" fill="#FFFFFF" stroke="#B9B5C6" stroke-width="3"/></g>`;
R.laptopMails = (t, count) => {
  let s = `<g transform="translate(300 520)"><path d="M-220,110 L220,110 L250,150 L-250,150 Z" fill="#8E8AA0" stroke="#6E6A82" stroke-width="4"/><rect x="-200" y="-200" width="400" height="300" rx="14" fill="#3A3650" stroke="#24212F" stroke-width="6"/><rect x="-186" y="-186" width="372" height="272" rx="8" fill="#F4F2F8"/>`;
  const n = Math.min(6, count);
  for (let i = 0; i < n; i++) {
    const y = -170 + i * 42;
    s += `<rect x="-176" y="${y}" width="352" height="36" rx="6" fill="${i === 0 ? '#FFE3E3' : '#FFFFFF'}" stroke="#D9D5E3" stroke-width="2"/><circle cx="-156" cy="${y + 18}" r="6" fill="#E8574F"/><text x="-140" y="${y + 26}" font-size="20" font-weight="700" fill="#5E5A70">【選考結果】不採用のお知らせ</text>`;
  }
  return s + `</g>`;
};

// ---------------------------------------------------------------- funeral (kujiramaku stripes, altar, photo)
R.funeral = (t, o = {}) => {
  let s = '';
  for (let x = 0; x < PW; x += 90) s += `<rect x="${x}" y="0" width="45" height="560" fill="#1C1B22"/><rect x="${x + 45}" y="0" width="45" height="560" fill="#F4F3F7"/>`;
  s += `<rect x="0" y="560" width="${PW}" height="370" fill="#B9AE92"/>`;
  for (let y = 600; y < PH; y += 80) s += `<path d="M0,${y} L${PW},${y}" stroke="#A39878" stroke-width="3"/>`;
  // altar
  s += `<rect x="260" y="250" width="560" height="320" fill="#F4F3F7" stroke="#C9C6D3" stroke-width="4"/><rect x="230" y="540" width="620" height="40" fill="#E2DFEA"/>`;
  for (let i = 0; i < 18; i++) { const fx = 280 + (i % 9) * 64, fy = 300 + Math.floor(i / 9) * 190; s += `<g transform="translate(${fx} ${fy})">${[0, 1, 2, 3, 4, 5].map(k => `<ellipse cx="${U.f(Math.cos(k * 1.05) * 10)}" cy="${U.f(Math.sin(k * 1.05) * 10)}" rx="12" ry="7" transform="rotate(${k * 60})" fill="#FFFFFF" stroke="#D8D5E2" stroke-width="1.5"/>`).join('')}<circle r="6" fill="#F2E7A6"/></g>`; }
  // portrait with black ribbon
  s += `<g transform="translate(540 360)"><rect x="-80" y="-100" width="160" height="200" fill="#2A2830"/><rect x="-66" y="-86" width="132" height="172" fill="#D9D5E2"/><circle cx="0" cy="-20" r="36" fill="#A9A4B8"/><path d="M-50,86 C-50,30 50,30 50,86 Z" fill="#A9A4B8"/><path d="M-80,-100 L-30,-100 L-80,-50 Z M80,-100 L30,-100 L80,-50 Z" fill="#111"/></g>`;
  // incense
  s += `<g transform="translate(540 600)"><rect x="-60" y="-24" width="120" height="30" rx="6" fill="#6E6A82"/><ellipse cx="0" cy="-30" rx="40" ry="12" fill="#8E8AA0"/><path d="M0,-30 L0,-60" stroke="#C9A47A" stroke-width="3"/></g>`;
  for (let k = 0; k < 3; k++) { const ph = (t * 0.4 + k / 3) % 1; s += `<path d="M540,-${0}" fill="none"/><path d="M${U.f(540 + Math.sin(ph * 6 + k) * 18)},${U.f(536 - ph * 160)} q-14,-20 0,-40 q14,-20 0,-40" fill="none" stroke="#E8E6F0" stroke-width="5" stroke-linecap="round" opacity="${U.f(Math.sin(ph * Math.PI) * 60) / 100}"/>`; }
  return s;
};
R.chairRow = (y, xs, s = 1, col = '#5E5A70') => xs.map(x => `<g ${U.tr(x, y, s)}><rect x="-50" y="-120" width="100" height="16" rx="6" fill="${col}"/><rect x="-46" y="-104" width="92" height="64" rx="10" fill="${col}"/><rect x="-54" y="-40" width="108" height="20" rx="8" fill="${col}"/><path d="M-40,-20 L-44,60 M40,-20 L44,60" stroke="${col}" stroke-width="8"/></g>`).join('');

// ---------------------------------------------------------------- trash room (60s, alone)
R.trashRoom = (t, o = {}) => {
  let s = R.wall('#6E6A7E', 600) + R.floor('#57536A', 600);
  s += `<rect x="700" y="80" width="300" height="260" fill="#8E8AA0"/><rect x="712" y="92" width="276" height="236" fill="#A49B86"/><path d="M712,92 L988,328 M988,92 L712,328" stroke="#8E8471" stroke-width="5"/>`;
  s += `<g transform="translate(140 160)"><rect x="0" y="0" width="160" height="190" fill="#E8E6F0" opacity=".85"/><rect x="0" y="0" width="160" height="34" fill="#C26A6A"/>`;
  for (let i = 0; i < 28; i++) { const x = 12 + (i % 7) * 21, y = 48 + Math.floor(i / 7) * 34; s += `<path d="M${x},${y} l14,16 M${x + 14},${y} l-14,16" stroke="#8E5A5A" stroke-width="2.4"/>`; }
  s += `</g>`;
  // TV with static
  s += `<g transform="translate(860 520)"><rect x="-120" y="-120" width="240" height="170" rx="16" fill="#3A3650" stroke="#24212F" stroke-width="6"/><rect x="-104" y="-104" width="208" height="138" rx="8" fill="#B9B6C6"/>`;
  for (let i = 0; i < 18; i++) s += `<rect x="-104" y="${U.f(-104 + U.hash(i + Math.floor(t * 20) * 3.1) * 130)}" width="208" height="${U.f(2 + U.hash(i * 7 + Math.floor(t * 20)) * 6)}" fill="${U.hash(i * 3 + Math.floor(t * 20)) > 0.5 ? '#FFFFFF' : '#6E6A82'}" opacity=".7"/>`;
  s += `<rect x="-60" y="50" width="120" height="60" fill="#3A3650"/><circle cx="0" cy="-34" r="140" fill="#E8F0FF" opacity=".12" filter="url(#fBlur20)"/></g>`;
  // garbage bags
  const bags = o.bags || 10;
  for (let i = 0; i < bags; i++) {
    const x = (i * 127) % 1000 + 30, y = 640 + (i % 3) * 70 + U.hash(i) * 30, sc = 0.8 + U.hash(i * 3) * 0.6;
    s += `<g transform="translate(${x} ${U.f(y)}) scale(${U.f(sc * 100) / 100})"><path d="M-60,40 C-70,-10 -40,-50 0,-52 C40,-50 70,-10 60,40 C40,56 -40,56 -60,40 Z" fill="${['#4E4A5E', '#5A566C', '#45415A'][i % 3]}"/><path d="M-10,-52 L0,-70 L12,-52" fill="#3A3650"/><path d="M-30,-20 C-20,0 -20,20 -26,34" stroke="#6E6A82" stroke-width="4" fill="none"/></g>`;
  }
  for (const [x, y] of [[420, 760], [470, 780], [520, 770], [600, 800]]) s += `<g transform="translate(${x} ${y})"><path d="M-22,-30 L22,-30 L18,10 L-18,10 Z" fill="#D9D5E2"/><path d="M-22,-20 L22,-20" stroke="#B9473F" stroke-width="5"/></g>`;
  return s;
};

// ---------------------------------------------------------------- sakura picnic
R.sakura = (t) => {
  let s = `<rect width="${PW}" height="${PH}" fill="url(#rgDaySky)"/>`;
  s += B.cloud(100 + t * 8, 120, 0.7) + B.cloud(700 + t * 6, 200, 0.55, 0.9);
  s += `<path d="M0,560 C260,500 520,520 760,560 C900,540 1000,530 1080,540 L1080,${PH} L0,${PH} Z" fill="#B9E3B2"/>`;
  for (const [x, y, sc] of [[120, 560, 1.3], [940, 540, 1.4], [540, 500, 0.9]]) s += B.tree(x, y, sc, '#FFC9DA', '#F7A8C2', '#FFE3EC', '#9E7A64');
  s += `<rect x="0" y="640" width="${PW}" height="${PH - 640}" fill="#A6DA9F"/>`;
  s += `<path d="M120,700 L960,700 L1020,${PH} L60,${PH} Z" fill="#7FB8E6" opacity=".95"/><path d="M120,700 L960,700" stroke="#5E98C6" stroke-width="5"/>`;
  for (let i = 0; i < 26; i++) { const ph = (t * 0.25 + U.hash(i)) % 1, x = (U.hash(i * 3) * 1200 + t * 40) % 1100 - 10, y = ph * 960 - 20; s += `<ellipse cx="${U.f(x + Math.sin(ph * 12 + i) * 20)}" cy="${U.f(y)}" rx="8" ry="5" fill="#FFC4D6" transform="rotate(${U.f(ph * 360 + i * 20)} ${U.f(x)} ${U.f(y)})"/>`; }
  return s;
};
R.picnicFront = () => `<g transform="translate(540 760)"><rect x="-150" y="-40" width="300" height="80" rx="12" fill="#FFFFFF" stroke="#C9B6EE" stroke-width="5"/><rect x="-140" y="-32" width="135" height="64" rx="8" fill="#FFF6E8"/><rect x="5" y="-32" width="135" height="64" rx="8" fill="#FFF6E8"/>${[[-110, -10, '#FFD95E'], [-70, 8, '#F08A6A'], [-40, -12, '#8FCB98'], [40, -6, '#FFFFFF'], [80, 6, '#FFC4D3'], [110, -10, '#FFFFFF']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="16" fill="${c}" stroke="#00000022" stroke-width="2"/>`).join('')}</g>`;

// ---------------------------------------------------------------- dark kitchen floor (68, alone)
R.kitchenFloor = (t) => {
  let s = `<rect width="${PW}" height="${PH}" fill="#1E1C28"/>`;
  s += `<rect x="0" y="420" width="${PW}" height="510" fill="#2B2938"/>`;
  for (let x = -200; x < 1300; x += 120) s += `<path d="M${x},420 L${x - 200},${PH}" stroke="#35334A" stroke-width="3"/>`;
  for (let y = 480; y < PH; y += 90) s += `<path d="M0,${y} L${PW},${y}" stroke="#35334A" stroke-width="3"/>`;
  // fridge door ajar (light spill)
  s += `<rect x="760" y="40" width="240" height="400" rx="12" fill="#3E3C50"/><path d="M760,40 L640,80 L640,420 L760,440 Z" fill="#4A4862"/><path d="M760,60 L1000,60 L1000,430 L760,430 Z" fill="#FFF6D6" opacity=".55"/>`;
  s += `<path d="M760,430 L1000,430 L1080,${PH} L560,${PH} Z" fill="#FFF6D6" opacity=".12"/>`;
  return s;
};
R.phoneFloor = (x, y, t) => `<g transform="translate(${x} ${y}) rotate(-12)"><rect x="-34" y="-18" width="68" height="36" rx="8" fill="#3A3650" stroke="#24212F" stroke-width="3"/><rect x="-28" y="-12" width="56" height="24" rx="4" fill="#9FD0FF" opacity="${U.f((0.5 + 0.5 * Math.sin(t * 2)) * 100) / 100}"/></g>`;

// ---------------------------------------------------------------- tatami room with futon (72, alone)
R.tatami = (t, o = {}) => {
  let s = `<rect width="${PW}" height="${PH}" fill="#2A2834"/>`;
  s += `<rect x="0" y="0" width="${PW}" height="470" fill="#3A3746"/>`;
  s += `<rect x="640" y="70" width="300" height="270" fill="#0E1230" stroke="#4E4A60" stroke-width="12"/><path d="M790,70 L790,340" stroke="#4E4A60" stroke-width="8"/>`;
  for (let i = 0; i < 20; i++) { const ph = (t * 0.12 + U.hash(i)) % 1; s += `<circle cx="${U.f(650 + U.hash(i * 7) * 280)}" cy="${U.f(80 + ph * 250)}" r="3" fill="#FFFFFF" opacity=".7"/>`; }
  s += `<g transform="translate(250 170)"><circle r="56" fill="#4E4A60"/><circle r="46" fill="#D9D5E2"/><path d="M0,0 L0,-30 M0,0 L${U.f(Math.sin(t * 6.283) * 26)},${U.f(-Math.cos(t * 6.283) * 26)}" stroke="#2A2834" stroke-width="5" stroke-linecap="round"/></g>`;
  s += `<rect x="0" y="470" width="${PW}" height="460" fill="#7E7656"/>`;
  for (let x = 0; x < PW; x += 270) s += `<rect x="${x}" y="470" width="270" height="460" fill="none" stroke="#6A6248" stroke-width="5"/>`;
  s += `<rect x="40" y="420" width="220" height="140" rx="10" fill="#4E4A60"/><rect x="60" y="440" width="180" height="100" rx="6" fill="#2A2834"/>`;
  return s;
};
R.futonBase = () => `<path d="M200,520 L760,520 L830,${PH} L130,${PH} Z" fill="#E8E2D2" stroke="#B9B09A" stroke-width="4"/>`;
R.futon = (o = {}) => {
  const rise = o.breath || 0;
  return `<path d="M210,${U.f(668 - rise * 8)} C380,${U.f(640 - rise * 10)} 600,${U.f(640 - rise * 10)} 770,${U.f(668 - rise * 8)} L840,${PH} L120,${PH} Z" fill="#7F7FA0" stroke="#5E5E80" stroke-width="4"/>
    <path d="M220,${U.f(690 - rise * 8)} C380,${U.f(664 - rise * 10)} 600,${U.f(664 - rise * 10)} 760,${U.f(690 - rise * 8)}" fill="none" stroke="#E8E2D2" stroke-width="12" opacity=".8"/>
    <path d="M300,760 C320,840 300,890 280,930 M600,760 C620,840 640,890 660,930" stroke="#6A6A8C" stroke-width="8" fill="none" stroke-linecap="round"/>`;
};
// ---------------------------------------------------------------- the apartment door with mail piling up
R.doorMail = (t, days) => {
  let s = `<rect width="${PW}" height="${PH}" fill="#4A4858"/><rect x="0" y="720" width="${PW}" height="210" fill="#3A3846"/>`;
  s += `<rect x="40" y="60" width="160" height="40" fill="#FFF6D6" opacity=".25"/>`;
  s += `<rect x="330" y="60" width="420" height="660" fill="#6E6A82" stroke="#2E2C38" stroke-width="10"/><rect x="360" y="90" width="360" height="600" fill="#5E5A70"/>`;
  s += `<circle cx="680" cy="420" r="14" fill="#B9A66A"/><text x="540" y="150" text-anchor="middle" font-size="34" font-weight="700" fill="#D9D5E2">203</text>`;
  s += `<rect x="460" y="470" width="160" height="34" rx="4" fill="#2E2C38"/>`;
  const n = Math.min(30, Math.floor(days * 1.2));
  for (let i = 0; i < n; i++) { const x = 360 + (i * 47) % 360, y = 700 - Math.floor(i / 7) * 16 - U.hash(i) * 10; s += `<rect x="${U.f(x)}" y="${U.f(y)}" width="90" height="22" rx="3" fill="${['#E8E6F0', '#D9D5E2', '#F4E3C9'][i % 3]}" transform="rotate(${U.f((U.hash(i * 3) - 0.5) * 30)} ${U.f(x + 45)} ${U.f(y + 11)})"/>`; }
  for (let i = 0; i < Math.min(6, days / 4); i++) s += `<rect x="${470 + i * 4}" y="${474 - i * 3}" width="140" height="10" fill="#E8E6F0" transform="rotate(${-4 + i * 2} 540 480)"/>`;
  if (days > 8) s += `<g transform="translate(560 300) rotate(-3)"><rect x="-110" y="-60" width="220" height="120" fill="#F4F2F8"/><text x="0" y="-14" text-anchor="middle" font-size="26" font-weight="700" fill="#8E3A3A">家賃滞納の</text><text x="0" y="22" text-anchor="middle" font-size="26" font-weight="700" fill="#8E3A3A">お知らせ</text></g>`;
  return s;
};
