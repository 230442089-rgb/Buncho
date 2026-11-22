// chars.js — SD (chibi) renderers for Yuria and Vol, drawn as SVG strings.
// Root of a character = centre between the feet (0,0). Head centre sits at (0,-452).
const C = {
  skin: '#FFF1EB', skinShade: '#F6D2CA', skinLine: '#C98E8A',
  hair: '#FCFBFF', hairShade: '#E5E0F5', hairShade2: '#CFC7EA', hairLine: '#9B90C6',
  eyeLine: '#3A3250', blush: '#FF8DA6', blushLine: '#EE7290',
  mouth: '#8C3D4E', tongue: '#F38BA2', brow: '#ABA1C8',
  yYellow: '#F8D160', yYellowShade: '#E4AF3A',
  card: '#F2B64A', cardShade: '#D99A35', cardLine: '#A9742C', cardHi: '#F9CF77',
  skirt: '#7B4243', skirtShade: '#5F3134', skirtLine: '#4A2528',
  jog: '#69657D', jogShade: '#524E66', jogLine: '#3E3A50',
  tee: '#FFFFFF', teeShade: '#E8E4F6', teeLine: '#9E96C2',
  bag: '#CFC0EC', bagShade: '#AF9DD8', bagLine: '#8C7AB8', mesh: '#B7DEF6',
  shoeLine: '#A49CC4', gold: '#E9B949',
};
let __uid = 0;
U.uid = () => 'u' + (++__uid);
U.resetUid = () => { __uid = 0; };

// ---------------------------------------------------------------- eyes
const EYE_WHITE = 'M-23,-2 C-22,-26 18,-31 25,-10 C28,6 22,28 1,29 C-17,29 -24,14 -23,-2 Z';
const EYE_LASH = 'M-26,0 C-24,-27 18,-35 29,-13 L35,-18 C34,-12 32,-8 28,-4 C22,-21 -10,-25 -21,1 Z';

function eyeSVG(cx, cy, side, o) {
  const st = o.eyes || 'open';
  const lx = (o.look ? o.look[0] : 0) * side, ly = o.look ? o.look[1] : 0;
  const blink = o.blink || 0;
  const g = c => `<g transform="translate(${U.f(cx)} ${U.f(cy)}) scale(${side} 1)">${c}</g>`;
  const L = C.eyeLine;
  if (st === 'smile' || (st === 'wink' && side === o.winkSide)) {
    return g(`<path d="M-24,12 Q1,-16 27,9" fill="none" stroke="${L}" stroke-width="6.5" stroke-linecap="round"/>
      <path d="M24,8 l8,-3" stroke="${L}" stroke-width="4" stroke-linecap="round"/>`);
  }
  if (st === 'closed' || blink > 0.86) {
    return g(`<path d="M-23,6 Q1,20 27,4" fill="none" stroke="${L}" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M-9,13 l-3,7 M3,15 l0,7 M15,12 l3,7" stroke="${L}" stroke-width="2.6" stroke-linecap="round"/>`);
  }
  if (st === 'shut') { // squeezed shut (> <)
    return g(`<path d="M-20,-6 L18,6 L-20,18" fill="none" stroke="${L}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  const dragon = o.dragon || 0;
  const wide = st === 'wide';
  const irx = wide ? 14 : 17, iry = wide ? 19 : 22;
  const ix = lx * 5, iy = 5 + ly * 3;
  const cid = U.uid();
  const iris = dragon > 0.5 ? (o.dragonIris || 'gIrisGold') : o.iris;
  let s = `<clipPath id="${cid}"><path d="${EYE_WHITE}"/></clipPath>`;
  if (dragon > 0) s += `<ellipse cx="0" cy="2" rx="40" ry="34" fill="${o.dragonGlow || '#FFD25A'}" opacity="${U.f(dragon * 55) / 100}" filter="url(#fGlow)"/>`;
  s += `<path d="${EYE_WHITE}" fill="#fff"/>`;
  s += `<g clip-path="url(#${cid})">`;
  if (st === 'heart') {
    s += `<ellipse cx="${ix}" cy="${iy}" rx="${irx}" ry="${iry}" fill="#FFB3C9"/>`;
    s += U.heart(ix, iy + 1, 30, '#FF5C8D', 1, 0);
  } else {
    s += `<ellipse cx="${ix}" cy="${iy}" rx="${irx}" ry="${iry}" fill="url(#${iris})"/>`;
    s += `<ellipse cx="${ix}" cy="${iy}" rx="${irx}" ry="${iry}" fill="none" stroke="${dragon > 0.5 ? '#7A4A00' : '#34497A'}" stroke-width="2.2" opacity=".7"/>`;
    if (dragon > 0.5) s += `<ellipse cx="${ix}" cy="${iy + 1}" rx="2.8" ry="17" fill="#2A1A05"/>`;
    else s += `<ellipse cx="${ix}" cy="${iy + 2}" rx="${wide ? 5.5 : 7.5}" ry="${wide ? 8 : 11}" fill="#1F2742"/>`;
    s += `<ellipse cx="${ix}" cy="${iy + 13}" rx="11" ry="6" fill="#fff" opacity=".28"/>`;
    s += `<circle cx="${ix - 6}" cy="${iy - 9}" r="${wide ? 7.5 : 6.5}" fill="#fff"/>`;
    s += `<circle cx="${ix + 6.5}" cy="${iy + 9}" r="3" fill="#fff" opacity=".95"/>`;
    if (o.sparkleEye) s += U.sparkle(ix + 5, iy - 2, 6, '#fff', 0.95);
  }
  s += `<path d="M-30,-36 L32,-36 L32,-8 C16,-17 -10,-17 -27,-1 Z" fill="#B9AED6" opacity=".45"/>`;
  s += `</g>`;
  // lids (half-closed / blinking)
  let lid = st === 'half' ? 0.42 : st === 'sleepy' ? 0.6 : 0;
  lid = Math.max(lid, blink);
  if (lid > 0.02) {
    const ly2 = U.lerp(-26, 24, lid);
    s += `<path d="M-32,-44 L36,-44 L36,${U.f(ly2 - 8)} C20,${U.f(ly2 - 3)} -14,${U.f(ly2 - 3)} -29,${U.f(ly2 + 3)} Z" fill="${o.skinCol || C.skin}"/>`;
    s += `<path d="M-28,${U.f(ly2 + 3)} C-14,${U.f(ly2 - 3)} 20,${U.f(ly2 - 3)} 34,${U.f(ly2 - 8)}" fill="none" stroke="${L}" stroke-width="6.5" stroke-linecap="round"/>`;
    s += `<path d="M31,${U.f(ly2 - 8)} l6,-4" stroke="${L}" stroke-width="3.5" stroke-linecap="round"/>`;
  } else {
    s += `<path d="${EYE_LASH}" fill="${L}"/>`;
    s += `<path d="M-23,1 q-3,5 -1,9" fill="none" stroke="${L}" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  s += `<path d="M-12,29.5 Q6,33 20,22" fill="none" stroke="#857898" stroke-width="2.4" stroke-linecap="round"/>`;
  s += `<path d="M-17,-26 Q6,-38 25,-24" fill="none" stroke="#D7AEB0" stroke-width="1.8" opacity=".75"/>`;
  if (o.tear) s += `<path d="M-6,31 q2,8 6,12" fill="none" stroke="#BFE7FF" stroke-width="3" opacity=".9"/>`;
  return g(s);
}

function browSVG(cx, cy, side, mood, op = 0.85) {
  let d = 'M-18,-50 Q4,-58 24,-50';
  if (mood === 'happy') d = 'M-18,-56 Q4,-64 24,-55';
  if (mood === 'worry') d = 'M-18,-58 Q2,-58 24,-48';
  if (mood === 'up') d = 'M-18,-62 Q4,-70 24,-60';
  if (mood === 'angry') d = 'M-18,-46 Q4,-52 24,-56';
  if (mood === 'soft') d = 'M-18,-52 Q4,-58 24,-49';
  return `<path transform="translate(${U.f(cx)} ${U.f(cy)}) scale(${side} 1)" d="${d}" fill="none" stroke="${C.brow}" stroke-width="4.5" stroke-linecap="round" opacity="${op}"/>`;
}

function mouthSVG(m, x = 0, y = 0) {
  const M = C.mouth;
  const w = c => `<g transform="translate(${U.f(x)} ${U.f(y)})">${c}</g>`;
  switch (m) {
    case 'open': return w(`<path d="M-16,60 Q0,63 16,60 Q14,80 0,82 Q-14,80 -16,60 Z" fill="${M}"/><path d="M-9,76 Q0,70 9,76 Q6,82 0,82 Q-6,82 -9,76 Z" fill="${C.tongue}"/>`);
    case 'grin': return w(`<path d="M-22,58 Q0,62 22,58 Q18,88 0,90 Q-18,88 -22,58 Z" fill="${M}"/><path d="M-19,59.5 Q0,63 19,59.5 L18,65 Q0,68 -18,65 Z" fill="#fff"/><path d="M-11,82 Q0,74 11,82 Q7,89 0,89.5 Q-7,89 -11,82 Z" fill="${C.tongue}"/>`);
    case 'tongue': return w(`<path d="M-15,60 Q0,64 15,60 Q12,76 0,78 Q-12,76 -15,60 Z" fill="${M}"/><path d="M-9,70 Q0,66 9,70 L9,84 Q0,96 -9,84 Z" fill="${C.tongue}" stroke="#D86A84" stroke-width="1.6"/><path d="M0,72 L0,86" stroke="#D86A84" stroke-width="1.6"/>`);
    case 'o': return w(`<ellipse cx="0" cy="69" rx="7" ry="9" fill="${M}"/>`);
    case 'oSmall': return w(`<ellipse cx="0" cy="69" rx="4.5" ry="5.5" fill="${M}"/>`);
    case 'cat': return w(`<path d="M-13,64 Q-6.5,72 0,64 Q6.5,72 13,64" fill="none" stroke="${M}" stroke-width="3.2" stroke-linecap="round"/>`);
    case 'wavy': return w(`<path d="M-15,67 Q-7.5,61 0,67 Q7.5,73 15,67" fill="none" stroke="${M}" stroke-width="3.2" stroke-linecap="round"/>`);
    case 'flat': return w(`<path d="M-9,67 L9,67" stroke="${M}" stroke-width="3.2" stroke-linecap="round"/>`);
    case 'small': return w(`<path d="M-7,66 Q0,70 7,66" fill="none" stroke="${M}" stroke-width="3.2" stroke-linecap="round"/>`);
    case 'pout': return w(`<path d="M-6,62 Q3,64 -1,68 Q4,71 -5,74" fill="none" stroke="${M}" stroke-width="3" stroke-linecap="round"/>`);
    case 'chew': return w(`<path d="M-12,66 Q-4,62 0,67 Q4,62 12,66" fill="none" stroke="${M}" stroke-width="3.2" stroke-linecap="round"/>`);
    case 'lick': return w(`<path d="M-12,62 Q0,66 12,62 Q10,74 0,75 Q-10,74 -12,62 Z" fill="${M}"/><path d="M-2,68 Q6,66 12,70 Q10,77 3,76 Z" fill="${C.tongue}"/>`);
    default: return w(`<path d="M-13,64 Q0,74 13,64" fill="none" stroke="${M}" stroke-width="3.4" stroke-linecap="round"/>`);
  }
}

// ---------------------------------------------------------------- hair (head-local coords)
const HAIR = {
  yuriaBack: 'M0,-124 C74,-126 116,-74 114,0 C112,54 124,110 112,160 C106,190 84,206 62,196 C40,208 -40,208 -62,196 C-86,206 -110,188 -114,156 C-126,104 -116,50 -116,0 C-118,-74 -74,-126 0,-124 Z',
  volBack: 'M0,-124 C74,-126 114,-74 112,0 C110,44 102,86 88,110 C60,124 -60,124 -88,110 C-102,86 -110,44 -112,0 C-114,-74 -74,-126 0,-124 Z',
  yuriaBangs: 'M-106,-6 C-112,-78 -64,-128 2,-128 C68,-128 110,-82 106,-10 C102,6 97,18 92,28 C88,6 82,-14 74,-26 C72,-8 68,4 61,13 C57,-8 51,-22 42,-31 C38,-16 30,-4 20,5 C16,-14 10,-28 2,-37 C0,-14 -3,8 -7,28 C-11,6 -18,-13 -26,-26 C-32,-13 -40,-3 -52,3 C-56,-14 -62,-26 -70,-33 C-76,-14 -84,1 -97,12 C-101,5 -105,0 -106,-6 Z',
  volBangs: 'M-106,-4 C-112,-78 -64,-128 2,-128 C68,-128 110,-82 106,-10 C103,8 99,20 94,31 C90,8 84,-12 76,-22 C74,-4 70,8 63,17 C59,-6 53,-20 44,-28 C40,-14 34,-2 26,7 C22,-10 16,-24 8,-33 C-4,-2 -15,30 -35,60 C-48,77 -68,82 -86,72 C-98,63 -104,42 -106,22 C-107,12 -107,4 -106,-4 Z',
  yuriaLockL: 'M-101,-30 C-115,20 -111,72 -101,112 C-95,138 -103,162 -93,180 C-86,171 -80,151 -82,128 C-84,96 -82,50 -78,6 C-84,-8 -92,-20 -101,-30 Z',
  yuriaLockR: 'M101,-30 C113,16 111,60 103,96 C99,114 97,126 88,134 C86,112 84,82 80,42 C80,14 84,-10 93,-24 Z',
  volLockL: 'M-101,-26 C-115,30 -111,92 -101,142 C-97,158 -89,162 -82,154 C-86,122 -86,72 -82,30 Z',
  volLockR: 'M101,-26 C113,20 109,70 99,112 C95,128 89,138 82,140 C84,110 82,70 80,30 C80,6 86,-14 94,-24 Z',
  // side ponytail (Yuria), attach point = 0,0
  yuriaTail: 'M-6,-10 C42,-34 90,-4 90,50 C90,96 76,124 86,164 C92,192 76,220 52,222 C62,202 60,180 50,164 C36,142 46,102 42,72 C38,42 22,18 -2,10 Z',
  yuriaTailYellow: 'M52,8 C74,40 74,84 64,116 C56,146 68,176 64,204 C54,186 50,164 48,144 C44,112 60,72 46,30 Z',
  // high ponytail (Vol), attach point = 0,0
  volTail: 'M-16,8 C8,-52 74,-74 112,-28 C142,8 138,66 128,108 C120,148 138,196 118,232 C108,250 88,248 84,232 C98,206 86,166 88,130 C90,90 94,50 76,20 C58,-8 28,-4 14,18 Z',
  volTailShade: 'M76,20 C94,50 90,90 88,130 C86,166 98,206 84,232 C96,214 104,180 104,140 C104,96 112,56 96,24 Z',
};

function hairCommon() {
  return `<path d="M-80,-60 C-42,-86 42,-88 82,-58" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" opacity=".9"/>
  <path d="M-82,-50 C-42,-76 42,-78 84,-48" fill="none" stroke="${C.hairShade2}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
}

// ---------------------------------------------------------------- heads
function headBack(who, o) {
  const shift = (o.turn || 0) * -4;
  const d = who === 'yuria' ? HAIR.yuriaBack : HAIR.volBack;
  let s = `<g transform="translate(${shift} 0)"><path d="${d}" fill="${C.hairShade}" stroke="${C.hairLine}" stroke-width="3"/>`;
  s += `<path d="M-70,120 C-40,150 40,150 70,120 L60,60 L-60,60 Z" fill="${C.hairShade2}" opacity=".7"/>`;
  if (who === 'yuria') s += `<path d="M104,90 C110,130 104,160 92,180 C96,150 98,120 96,96 Z" fill="${C.yYellow}" opacity=".9"/>`;
  return s + '</g>';
}

function headFront(who, o) {
  const turn = o.turn || 0, fx = turn * 7;
  let s = '';
  // face
  s += `<path d="M-93,-30 C-96,24 -80,68 -44,90 C-26,100 -12,104 0,104 C12,104 26,100 44,90 C80,68 96,24 93,-30 C88,-96 -88,-96 -93,-30 Z" fill="${o.skinCol || C.skin}" stroke="${C.skinLine}" stroke-width="3"/>`;
  s += `<path d="M-93,-30 C-62,-2 62,-2 93,-30 L93,-70 L-93,-70 Z" fill="${C.skinShade}" opacity=".55"/>`;
  // ears hint
  s += `<path d="M-92,18 C-104,14 -106,36 -94,44" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.5"/>`;
  s += `<path d="M92,18 C104,14 106,36 94,44" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.5"/>`;
  // blush
  const b = o.blush || 0;
  if (b > 0) {
    s += `<g opacity="${U.f(Math.min(1, b) * 100) / 100}"><ellipse cx="${-52 + fx}" cy="52" rx="26" ry="13" fill="${C.blush}" opacity=".55" filter="url(#fSoft)"/><ellipse cx="${52 + fx}" cy="52" rx="26" ry="13" fill="${C.blush}" opacity=".55" filter="url(#fSoft)"/></g>`;
    if (b > 0.45) {
      const op = U.f(U.inv(0.45, 0.9, b) * 100) / 100;
      for (const sx of [-52, 52]) s += `<path d="M${sx - 12 + fx},44 l-5,11 M${sx + fx},44 l-5,11 M${sx + 12 + fx},44 l-5,11" stroke="${C.blushLine}" stroke-width="2.6" stroke-linecap="round" opacity="${op}"/>`;
    }
  }
  // eyes
  const eo = Object.assign({}, o, { iris: who === 'yuria' ? 'gIrisY' : 'gIrisV' });
  const ex = 42, ey = 22;
  if (who === 'vol') {
    s += eyeSVG(ex + fx, ey, 1, eo);
  } else {
    s += eyeSVG(-ex + fx, ey, -1, eo);
    s += eyeSVG(ex + fx, ey, 1, eo);
  }
  // nose, mouth
  s += `<path d="M${3 + fx},47 q-2,4 -5,5" fill="none" stroke="#D29A9A" stroke-width="2.2" stroke-linecap="round"/>`;
  s += mouthSVG(o.mouth || 'smile', fx * 0.9, 0);
  if (who === 'yuria') s += `<circle cx="${-63 + fx}" cy="61" r="2.7" fill="#6A5870"/>`;
  // hair front
  const hx = turn * 4;
  s += `<g transform="translate(${U.f(hx)} 0)">`;
  if (who === 'yuria') {
    s += `<path d="${HAIR.yuriaLockL}" fill="${C.hair}" stroke="${C.hairLine}" stroke-width="3"/>`;
    s += `<path d="M-96,40 C-100,80 -96,120 -94,150" fill="none" stroke="${C.hairShade2}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<path d="${HAIR.yuriaLockR}" fill="${C.hair}" stroke="${C.hairLine}" stroke-width="3"/>`;
    s += `<path d="M97,24 C101,54 99,84 92,116 C90,94 90,64 92,34 Z" fill="${C.yYellow}"/>`;
    s += `<path d="${HAIR.yuriaBangs}" fill="${C.hair}" stroke="${C.hairLine}" stroke-width="3" stroke-linejoin="round"/>`;
    s += `<path d="M-70,-33 C-66,-52 -60,-70 -50,-86 M-26,-26 C-22,-50 -16,-70 -6,-90 M2,-37 C6,-60 12,-80 22,-96 M42,-31 C48,-56 56,-74 66,-88 M74,-26 C80,-46 86,-62 94,-72" fill="none" stroke="${C.hairShade2}" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
    s += hairCommon();
    // ahoge
    s += `<path d="M-6,-124 C-20,-156 10,-170 12,-142 C2,-150 -2,-138 -6,-124 Z" fill="${C.hair}" stroke="${C.hairLine}" stroke-width="2.6"/>`;
    // stitched hair clip (viewer's left)
    s += `<g transform="translate(-60 -52) rotate(-16)"><rect x="-26" y="-4.5" width="52" height="9" rx="4.5" fill="#2B2833"/>`;
    for (const k of [-17, -6, 5, 16]) s += `<path d="M${k},-10 L${k},10" stroke="#2B2833" stroke-width="5" stroke-linecap="round"/>`;
    s += `<rect x="-22" y="-2" width="44" height="2" rx="1" fill="#6A6478" opacity=".6"/></g>`;
  } else {
    s += `<path d="${HAIR.volLockL}" fill="${C.hair}" stroke="${C.hairLine}" stroke-width="3"/>`;
    s += `<path d="${HAIR.volLockR}" fill="${C.hair}" stroke="${C.hairLine}" stroke-width="3"/>`;
    s += `<path d="M94,30 C98,60 96,90 90,118" fill="none" stroke="${C.hairShade2}" stroke-width="3" stroke-linecap="round"/>`;
    s += `<g>`;
    s += `<path d="${HAIR.volBangs}" fill="${C.hair}" stroke="${C.hairLine}" stroke-width="3" stroke-linejoin="round"/>`;
    s += `<path d="M-2,-62 C-16,-20 -32,22 -60,60 C-50,30 -32,-8 -14,-58 Z" fill="${C.mesh}" opacity=".95"/>`;
    s += `<path d="M18,-70 C6,-30 -12,14 -40,52 M-30,-74 C-44,-30 -64,10 -92,46 M-60,-60 C-74,-20 -90,10 -102,24 M44,-28 C50,-52 58,-70 68,-84 M76,-22 C82,-42 88,-58 96,-68" fill="none" stroke="${C.hairShade2}" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
    s += `</g>`;
    s += hairCommon();
    const he = o.hiddenEye || 0;
    if (he > 0) {
      s += `<ellipse cx="-42" cy="24" rx="54" ry="44" fill="#9BE6FF" opacity="${U.f(he * 50) / 100}" filter="url(#fGlow)"/>`;
      s += `<g opacity="${U.f(he * 88) / 100}">${eyeSVG(-ex, ey, -1, Object.assign({}, eo, { dragon: 1, dragonIris: 'gIrisDragonV', dragonGlow: '#8FE3FF', eyes: 'open', blink: 0, look: [0.4, 0] }))}</g>`;
      s += `<path d="M-14,-30 C-22,0 -30,22 -46,52 M-30,-26 C-40,4 -52,26 -70,48" fill="none" stroke="${C.hair}" stroke-width="5" stroke-linecap="round" opacity="${U.f(he * 80) / 100}"/>`;
    }
  }
  s += `</g>`;
  // brows (drawn over bangs, slightly translucent)
  const mood = o.brows || 'neutral';
  if (who === 'yuria') { s += browSVG(-ex + fx, ey, -1, mood, 0.75); s += browSVG(ex + fx, ey, 1, mood, 0.75); }
  else s += browSVG(ex + fx, ey, 1, mood, 0.75);
  // sweat drop
  if (o.sweat) s += `<path d="M${84 + fx},-26 C${76 + fx},-8 ${78 + fx},4 ${86 + fx},4 C${94 + fx},4 ${96 + fx},-8 ${84 + fx},-26 Z" fill="#CDEBFF" stroke="#7DB7E0" stroke-width="2.4"/>`;
  return s;
}

// ---------------------------------------------------------------- held items (drawn at the hand, upright)
function itemSVG(item, bite = 0) {
  if (!item) return '';
  if (item === 'cup' || item === 'cupY') {
    return `<g transform="translate(0 4) scale(1.25)"><path d="M-15,-30 L15,-30 L12,16 L-12,16 Z" fill="#FFFDF8" stroke="#A69CC2" stroke-width="2.4"/>
      <path d="M-14,-16 L14,-16 L13,2 L-13,2 Z" fill="${item === 'cupY' ? '#F5C863' : '#C8A4E8'}" stroke="#A69CC2" stroke-width="2"/>
      ${U.heart(0, -7, 12, '#fff', 0.95)}
      <path d="M-18,-38 L18,-38 L16,-29 L-16,-29 Z" fill="#F4F1FA" stroke="#A69CC2" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M-10,-38 Q0,-46 10,-38" fill="#F4F1FA" stroke="#A69CC2" stroke-width="2.2"/></g>`;
  }
  if (item === 'crepeY' || item === 'crepeV') {
    const y = item === 'crepeY';
    let s = `<g transform="translate(0 -30)">`;
    // cream & toppings
    const puffs = bite > 0.5 ? [[-8, -24, 11], [10, -22, 10], [18, -12, 9]] : [[-16, -16, 12], [-2, -26, 13], [14, -20, 12], [22, -10, 9], [-22, -6, 9]];
    for (const [px, py, r] of puffs) s += `<circle cx="${px}" cy="${py}" r="${r}" fill="#fff" stroke="#BDB4D8" stroke-width="2"/>`;
    if (y) {
      for (const [px, py, rr] of (bite > 0.5 ? [[0, -32, -10]] : [[-8, -34, -20], [10, -36, 15], [24, -24, 30]])) s += `<path transform="translate(${px} ${py}) rotate(${rr})" d="M0,-9 C9,-9 10,2 0,10 C-10,2 -9,-9 0,-9 Z" fill="#FF6B7F" stroke="#D9485F" stroke-width="1.6"/><path transform="translate(${px} ${py - 9}) rotate(${rr})" d="M-5,0 L0,-4 L5,0" fill="none" stroke="#5FBF6E" stroke-width="2.4"/>`;
    } else {
      s += `<path d="M-22,-22 C-12,-30 -4,-18 6,-28 C14,-34 20,-24 26,-26" fill="none" stroke="#6B4130" stroke-width="5" stroke-linecap="round"/>`;
      for (const [px, py] of [[-12, -30], [12, -34]]) s += `<ellipse cx="${px}" cy="${py}" rx="9" ry="7" fill="#FFF1B8" stroke="#D9C27A" stroke-width="1.8"/>`;
    }
    // crepe and wrapper
    s += `<path d="M-30,-8 Q0,4 30,-8 L24,0 Q0,12 -24,0 Z" fill="#F2D29B" stroke="#C9A66A" stroke-width="2"/>`;
    s += `<path d="M-26,-2 Q0,10 26,-2 L2,58 L-2,58 Z" fill="${y ? '#FFC9DA' : '#D9CCF5'}" stroke="${y ? '#E58FAE' : '#A794D6'}" stroke-width="2.4" stroke-linejoin="round"/>`;
    s += `<path d="M-16,8 L-4,44 M2,10 L2,52 M16,8 L6,44" stroke="#fff" stroke-width="2.4" opacity=".7"/>`;
    return s + '</g>';
  }
  if (item === 'phone') return `<rect x="-13" y="-48" width="26" height="42" rx="6" fill="#E7DDF8" stroke="#9E92C6" stroke-width="2.4"/><rect x="-9" y="-44" width="18" height="30" rx="3" fill="#BFD7F5"/>`;
  if (item === 'bagShop') return `<g transform="translate(0 6)"><path d="M-22,0 L22,0 L26,44 L-26,44 Z" fill="#FFE3EC" stroke="#D493AE" stroke-width="2.4"/><path d="M-10,0 C-10,-18 10,-18 10,0" fill="none" stroke="#D493AE" stroke-width="3"/>${U.heart(0, 22, 16, '#FF86AE', 1)}</g>`;
  return '';
}

// ---------------------------------------------------------------- arms
// ang: 0 = hanging down, + = outward (away from body), - = across the body
function armSVG(who, side, ang, item, o) {
  const yu = who === 'yuria';
  const px = side * (yu ? 52 : 50), py = yu ? -294 : -296;
  const rot = side < 0 ? ang : -ang;
  const handY = yu ? 112 : 106;
  let s = `<g transform="translate(${px} ${py}) rotate(${U.f(rot)})">`;
  const it = item ? `<g transform="translate(0 ${handY}) rotate(${U.f(-rot - (o.lean || 0))})">${itemSVG(item, o.bite || 0)}</g>` : '';
  const hand = `<path d="M-13,${handY - 12} C-17,${handY + 2} -12,${handY + 14} 0,${handY + 14} C12,${handY + 14} 17,${handY + 2} 13,${handY - 12} Z" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.6"/>`;
  if (yu) {
    s += hand + it;
    s += `<path d="M-20,0 C-23,36 -27,74 -28,98 C-12,106 12,106 28,98 C27,74 23,36 20,0 C12,-22 -12,-22 -20,0 Z" fill="${C.card}" stroke="${C.cardLine}" stroke-width="2.8"/>`;
    s += `<path d="M${side * 8},10 C${side * 10},40 ${side * 12},70 ${side * 14},94" fill="none" stroke="${C.cardShade}" stroke-width="5" stroke-linecap="round" opacity=".55"/>`;
    s += `<path d="M-28,90 C-12,98 12,98 28,90 L29,101 C12,110 -12,110 -29,101 Z" fill="${C.cardShade}" stroke="${C.cardLine}" stroke-width="2.4"/>`;
    for (const k of [-20, -10, 0, 10, 20]) s += `<path d="M${k},${93 + Math.abs(k) * -0.06} L${k},${105 - Math.abs(k) * 0.12}" stroke="${C.cardLine}" stroke-width="1.6" opacity=".6"/>`;
  } else {
    s += `<path d="M-11,40 L-10,${handY - 6} L10,${handY - 6} L11,40 Z" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.6"/>`;
    s += hand + it;
    s += `<path d="M-24,2 C-27,18 -28,36 -26,52 C-10,58 10,58 26,52 C28,36 27,18 24,2 C14,-20 -14,-20 -24,2 Z" fill="${C.tee}" stroke="${C.teeLine}" stroke-width="2.8"/>`;
    s += `<path d="M-26,42 C-10,49 10,49 26,42" fill="none" stroke="${C.teeLine}" stroke-width="2.2"/>`;
    s += `<path d="M${side * -6},6 C${side * -8},20 ${side * -10},32 ${side * -10},44" fill="none" stroke="${C.teeShade}" stroke-width="6" stroke-linecap="round"/>`;
  }
  return s + '</g>';
}

// ---------------------------------------------------------------- legs
function legSVG(who, side, ang) {
  const yu = who === 'yuria';
  const px = side * (yu ? 20 : 22), py = yu ? -160 : -166;
  let s = `<g transform="translate(${px} ${py}) rotate(${U.f(ang)})">`;
  if (yu) {
    s += `<path d="M-13,0 C-14,50 -11,100 -9,130 L10,130 C12,100 15,50 14,0 Z" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.6"/>`;
    s += `<path d="M-10,112 L11,112 L11,134 L-10,134 Z" fill="#fff" stroke="${C.shoeLine}" stroke-width="2.2"/>`;
    s += `<path d="M-20,128 C-22,142 -18,152 -6,153 L8,153 C20,152 23,142 21,128 C12,121 -12,121 -20,128 Z" fill="#fff" stroke="${C.shoeLine}" stroke-width="2.6"/>`;
    s += `<path d="M-21,144 C-14,150 14,150 22,144 L22,152 C14,159 -14,159 -21,152 Z" fill="${C.yYellow}" stroke="${C.cardLine}" stroke-width="2"/>`;
  } else {
    s += `<path d="M-23,0 C-25,48 -21,92 -15,118 L15,118 C21,92 25,48 23,0 Z" fill="${C.jog}" stroke="${C.jogLine}" stroke-width="2.6"/>`;
    s += `<path d="M${side * 8},10 C${side * 9},50 ${side * 7},90 ${side * 5},112" fill="none" stroke="${C.jogShade}" stroke-width="6" stroke-linecap="round" opacity=".7"/>`;
    s += `<path d="M-15,112 L15,112 L14,128 L-14,128 Z" fill="${C.jogShade}" stroke="${C.jogLine}" stroke-width="2.2"/>`;
    s += `<path d="M-9,114 l0,12 M-3,114 l0,12 M3,114 l0,12 M9,114 l0,12" stroke="${C.jogLine}" stroke-width="1.4" opacity=".6"/>`;
    s += `<path d="M-8,127 L8,127 L8,134 L-8,134 Z" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2"/>`;
    s += `<path d="M-20,130 C-22,144 -18,154 -6,155 L8,155 C20,154 23,144 21,130 C12,123 -12,123 -20,130 Z" fill="#fff" stroke="${C.shoeLine}" stroke-width="2.6"/>`;
    s += `<path d="M-21,146 C-14,152 14,152 22,146 L22,154 C14,161 -14,161 -21,154 Z" fill="#ECE8F6" stroke="${C.shoeLine}" stroke-width="2"/>`;
    s += `<path d="M-8,134 l16,0 M-9,139 l18,0" stroke="${C.shoeLine}" stroke-width="1.6"/>`;
  }
  return s + '</g>';
}

// ---------------------------------------------------------------- torsos
function torsoYuria(o) {
  let s = '';
  // neck
  s += `<path d="M-17,-374 L17,-374 L18,-316 L-18,-316 Z" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.4"/>`;
  s += `<path d="M-18,-352 Q0,-336 18,-352 L18,-374 L-18,-374 Z" fill="${C.skinShade}"/>`;
  {
    // skirt
    s += `<path d="M-46,-226 L46,-226 C58,-202 74,-172 84,-148 C40,-137 -40,-137 -84,-148 C-74,-172 -58,-202 -46,-226 Z" fill="${C.skirt}" stroke="${C.skirtLine}" stroke-width="2.6"/>`;
    s += `<path d="M-14,-224 L-22,-141 M14,-224 L22,-141 M-34,-220 L-54,-145 M34,-220 L54,-145 M0,-224 L0,-139" stroke="${C.skirtShade}" stroke-width="3" opacity=".85"/>`;
  }
  // tee
  s += `<path d="M-50,-306 C-58,-282 -58,-246 -48,-222 L48,-222 C58,-246 58,-282 50,-306 C28,-322 -28,-322 -50,-306 Z" fill="${C.tee}" stroke="${C.teeLine}" stroke-width="2.6"/>`;
  s += `<path d="M-20,-318 Q0,-300 20,-318" fill="none" stroke="${C.teeLine}" stroke-width="2.4"/>`;
  s += `<path d="M-30,-270 C-20,-262 20,-262 30,-270" fill="none" stroke="${C.teeShade}" stroke-width="7" stroke-linecap="round" opacity=".8"/>`;
  // necklace
  s += `<path d="M-18,-317 Q0,-290 18,-317" fill="none" stroke="${C.gold}" stroke-width="2.2"/>`;
  s += U.heart(0, -289, 13, C.gold, 1);
  // cardigan panels
  for (const sd of [-1, 1]) {
    s += `<g transform="scale(${sd} 1)"><path d="M-52,-312 C-68,-288 -76,-230 -80,-176 C-82,-160 -84,-150 -82,-140 L-32,-140 C-32,-172 -28,-240 -22,-308 C-32,-314 -44,-316 -52,-312 Z" fill="${C.card}" stroke="${C.cardLine}" stroke-width="2.6"/>`;
    s += `<path d="M-30,-300 C-34,-240 -36,-180 -36,-144" fill="none" stroke="${C.cardHi}" stroke-width="7" opacity=".9"/>`;
    s += `<path d="M-62,-270 C-68,-230 -70,-190 -72,-150" fill="none" stroke="${C.cardShade}" stroke-width="7" stroke-linecap="round" opacity=".55"/>`;
    s += `<path d="M-82,-152 L-32,-152 L-32,-140 L-82,-140 Z" fill="${C.cardShade}" stroke="${C.cardLine}" stroke-width="2"/>`;
    for (let k = -78; k < -34; k += 7) s += `<path d="M${k},-151 l0,10" stroke="${C.cardLine}" stroke-width="1.4" opacity=".55"/>`;
    for (const by of [-280, -240, -200]) s += `<circle cx="-29" cy="${by}" r="3.6" fill="#8C5A2A"/>`;
    s += `</g>`;
  }
  return s;
}

function torsoVol(o) {
  let s = '';
  s += `<path d="M-17,-374 L17,-374 L18,-316 L-18,-316 Z" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="2.4"/>`;
  s += `<path d="M-18,-352 Q0,-336 18,-352 L18,-374 L-18,-374 Z" fill="${C.skinShade}"/>`;
  {
    s += `<path d="M-52,-228 C-60,-206 -64,-184 -58,-160 L58,-160 C64,-184 60,-206 52,-228 Z" fill="${C.jog}" stroke="${C.jogLine}" stroke-width="2.6"/>`;
    s += `<path d="M0,-200 L0,-160" stroke="${C.jogShade}" stroke-width="3"/>`;
  }
  // tee (oversized)
  s += `<path d="M-56,-308 C-66,-274 -68,-232 -62,-196 C-40,-186 40,-186 62,-196 C68,-232 66,-274 56,-308 C32,-324 -32,-324 -56,-308 Z" fill="${C.tee}" stroke="${C.teeLine}" stroke-width="2.6"/>`;
  s += `<path d="M-20,-320 Q0,-302 20,-320" fill="none" stroke="${C.teeLine}" stroke-width="2.4"/>`;
  s += `<path d="M-40,-262 C-34,-236 -38,-214 -44,-200 M30,-276 C40,-250 42,-226 36,-204" fill="none" stroke="${C.teeShade}" stroke-width="6" stroke-linecap="round"/>`;
  // knot at the hip
  s += `<path d="M-48,-206 C-42,-218 -26,-216 -22,-204 C-26,-192 -42,-190 -48,-206 Z" fill="${C.tee}" stroke="${C.teeLine}" stroke-width="2.4"/>`;
  s += `<path d="M-40,-196 C-44,-186 -46,-178 -44,-170 M-30,-196 C-28,-186 -26,-180 -28,-172" fill="none" stroke="${C.teeLine}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (!o.upperOnly) {
    s += `<path d="M-6,-190 L-9,-166 M6,-190 L9,-166" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`;
  }
  // crossbody bag
  s += `<path d="M-40,-312 L48,-212" stroke="${C.bag}" stroke-width="8" stroke-linecap="round"/>`;
  s += `<path d="M-40,-312 L48,-212" stroke="${C.bagLine}" stroke-width="1.6" stroke-dasharray="4 5" opacity=".7"/>`;
  s += `<g transform="translate(58 -200)"><rect x="-24" y="-16" width="48" height="36" rx="10" fill="${C.bag}" stroke="${C.bagLine}" stroke-width="2.4"/><path d="M-24,-6 C-12,6 12,6 24,-6" fill="${C.bagShade}" stroke="${C.bagLine}" stroke-width="2"/><circle cx="0" cy="3" r="3.2" fill="${C.gold}"/></g>`;
  return s;
}

// ---------------------------------------------------------------- full character
// o: {x,y,s,t, walk(phase), run, lean, tilt, turn, look, eyes, mouth, blush, brows, armL, armR, itemL, itemR,
//     sway, upperOnly, dragon, hiddenEye, sweat, blinkSeed, filter, sil, armBehind:'L'|'R'}
function charSVG(who, o) {
  const t = o.t || 0;
  const yu = who === 'yuria';
  let legL = 0, legR = 0, bob = 0, swing = 0;
  if (o.walk != null) {
    const ph = o.walk * 2 * Math.PI;
    const amp = o.run ? 24 : 12;
    legL = Math.sin(ph) * amp; legR = -legL;
    bob = -Math.abs(Math.sin(ph)) * (o.run ? 18 : 9);
    swing = Math.sin(ph) * (o.run ? 34 : 14);
  }
  bob += (o.bob || 0);
  const breathe = Math.sin(t * 2.2 + (yu ? 0 : 1.3)) * 1.6;
  const blink = o.blinkSeed != null ? U.blink(t, o.blinkSeed) : (o.blink || 0);
  const oo = Object.assign({}, o, { blink });
  const lean = o.lean || 0, tilt = o.tilt || 0;
  const headTr = `rotate(${U.f(tilt)} 0 -360) translate(0 ${U.f(-452 + breathe * 0.5)})`;
  const sway = o.sway != null ? o.sway : Math.sin(t * 1.8 + (yu ? 0.5 : 2)) * 3 + swing * 0.25;
  const armL = (o.armL != null ? o.armL : 10) + (o.armL == null ? swing : 0);
  const armR = (o.armR != null ? o.armR : 10) + (o.armR == null ? -swing : 0);

  let s = '', back = '';
  if (!o.upperOnly && !o.noShadow) s += `<ellipse cx="0" cy="0" rx="78" ry="14" fill="#5A4A80" opacity=".16"/>`;
  // --- behind: back hair, ponytail
  back += `<g transform="translate(0 ${U.f(bob)}) rotate(${U.f(lean)} 0 -170)">`;
  if (!yu) {
    back += `<g transform="${headTr}"><g transform="translate(46 -112) rotate(${U.f(sway)})"><path d="${HAIR.volTail}" fill="${C.hair}" stroke="${C.hairLine}" stroke-width="3"/><path d="${HAIR.volTailShade}" fill="${C.hairShade}"/><path d="M40,-30 C70,-30 92,0 100,40 M20,10 C40,4 60,20 66,60" fill="none" stroke="${C.hairShade2}" stroke-width="3" stroke-linecap="round"/><path d="M98,40 C110,80 104,120 106,170" fill="none" stroke="${C.mesh}" stroke-width="6" stroke-linecap="round" opacity=".9"/></g></g>`;
  }
  back += `<g transform="${headTr}">${headBack(who, oo)}</g>`;
  back += `</g>`;
  s += `<g transform="translate(0 ${U.f(bob)})">`;
  // --- legs
  if (!o.upperOnly) s += legSVG(who, -1, legL) + legSVG(who, 1, legR);
  // --- upper body
  s += `<g transform="rotate(${U.f(lean)} 0 -170)">`;
  if (o.armBehind === 'L') s += armSVG(who, -1, armL, o.itemL, oo);
  if (o.armBehind === 'R') s += armSVG(who, 1, armR, o.itemR, oo);
  s += `<g transform="translate(0 ${U.f(breathe * 0.3)})">${yu ? torsoYuria(oo) : torsoVol(oo)}</g>`;
  if (o.armBehind !== 'L' && !o.noArmL) s += armSVG(who, -1, armL, o.itemL, oo);
  if (o.armBehind !== 'R' && !o.noArmR) s += armSVG(who, 1, armR, o.itemR, oo);
  // side ponytail (Yuria)
  if (yu) {
    s += `<g transform="${headTr}"><g transform="translate(98 -70) rotate(${U.f(sway)})"><path d="${HAIR.yuriaTail}" fill="${C.hair}" stroke="${C.hairLine}" stroke-width="3"/><path d="${HAIR.yuriaTailYellow}" fill="${C.yYellow}"/><path d="M20,0 C46,20 56,60 54,100 M12,30 C26,60 28,100 22,140" fill="none" stroke="${C.hairShade2}" stroke-width="3" stroke-linecap="round" opacity=".8"/><path d="M58,30 C70,60 68,100 62,130" fill="none" stroke="${C.yYellowShade}" stroke-width="3" stroke-linecap="round" opacity=".8"/><ellipse cx="2" cy="2" rx="15" ry="20" transform="rotate(28 2 2)" fill="#2D2935"/><path d="M-6,-12 C2,-6 4,8 -2,16 M6,-14 C12,-4 12,10 6,18" fill="none" stroke="#55505F" stroke-width="2.4"/></g></g>`;
  } else {
    s += `<g transform="${headTr}"><g transform="translate(46 -112)"><ellipse cx="0" cy="0" rx="17" ry="13" transform="rotate(-32)" fill="#2D2935"/><path d="M-8,-6 C-2,0 2,6 4,10" fill="none" stroke="#55505F" stroke-width="2.4"/></g></g>`;
  }
  // head (kept separate so scenes can layer heads independently)
  const headStr = `<g transform="${headTr}">${headFront(who, oo)}</g>`;
  s += '%%HEAD%%';
  s += `</g></g>`;
  const part = o.part || 'all';
  const body = part === 'back' ? back
    : part === 'body' ? s.replace('%%HEAD%%', '')
    : part === 'head' ? `<g transform="translate(0 ${U.f(bob)})"><g transform="rotate(${U.f(lean)} 0 -170)">${headStr}</g></g>`
    : part === 'front' ? s.replace('%%HEAD%%', headStr)
    : back + s.replace('%%HEAD%%', headStr);
  let out = `<g transform="translate(${U.f(o.x)} ${U.f(o.y)}) scale(${o.s || 1})">${body}</g>`;
  if (o.filter) out = `<g filter="${o.filter}">${out}</g>`;
  if (o.sil) out = `<g>${out}<g filter="url(#fSil)" opacity="${U.f(o.sil * 100) / 100}">${out}</g></g>`;
  return out;
}

// layers: array of [who, opts, part] drawn in order
function layered(list) { return list.map(([who, o, part]) => charSVG(who, Object.assign({}, o, { part }))).join(''); }
