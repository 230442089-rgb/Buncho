// test.js — static test sheets for checking drawings
window.testFrame = function (name, t = 1.0) {
  U.resetUid();
  const el = document.getElementById('content');
  let s = '<rect width="1080" height="1920" fill="#F3F0FA"/>';
  if (name === 'chars') {
    s += charSVG('vol', { x: 300, y: 820, s: 1.2, t, blinkSeed: 99, look: [0.3, 0], eyes: 'open', mouth: 'smile', blush: 0.3, itemL: 'cup', armL: -25 });
    s += charSVG('yuria', { x: 780, y: 820, s: 1.2, t, blinkSeed: 98, look: [-0.3, 0], eyes: 'open', mouth: 'grin', blush: 0.4, armR: 150 });
    s += charSVG('vol', { x: 180, y: 1820, s: 0.95, t, eyes: 'half', mouth: 'small', blush: 0.9, hiddenEye: 1 });
    s += charSVG('yuria', { x: 430, y: 1820, s: 0.95, t, eyes: 'wink', winkSide: -1, mouth: 'tongue', blush: 0.7, itemL: 'crepeY', armL: -20 });
    s += charSVG('vol', { x: 680, y: 1820, s: 0.95, t, eyes: 'closed', mouth: 'oSmall', blush: 0.4, walk: 0.25 });
    s += charSVG('yuria', { x: 920, y: 1820, s: 0.95, t, eyes: 'open', dragon: 1, mouth: 'flat', brows: 'angry', walk: 0.75, armR: 70 });
  }
  if (name === 'faces') {
    s += charSVG('yuria', { x: 300, y: 1500, s: 2.4, t, eyes: 'open', mouth: 'smile', blush: 0.35, look: [0.2, 0], upperOnly: true });
    s += charSVG('vol', { x: 800, y: 1500, s: 2.4, t, eyes: 'open', mouth: 'smile', blush: 0.35, look: [-0.2, 0], upperOnly: true });
  }
  el.innerHTML = s;
};
window.testBg = function (name, t = 2) {
  U.resetUid();
  const el = document.getElementById('content');
  let s = `<defs>${B.defs}</defs>`;
  if (name === 'station') s += B.station(t, 9 * 60 + 40) + charSVG('vol', { x: 420, y: 1700, s: 1.25, t, itemL: 'cup', itemR: 'cupY', armL: -28, armR: -28, look: [0.3, 0] }) + charSVG('yuria', { x: 740, y: 1700, s: 1.25, t, armR: 150, mouth: 'grin' });
  if (name === 'street') s += B.street(t, 900) + charSVG('vol', { x: 410, y: 1730, s: 1.25, t, walk: 0.2 }) + charSVG('yuria', { x: 700, y: 1730, s: 1.25, t, walk: 0.7 }) + B.streetFront(t, 900);
  if (name === 'crepe') s += B.crepe(t) + charSVG('vol', { x: 330, y: 2290, s: 2.2, t, itemR: 'crepeV', armR: -40, upperOnly: true }) + charSVG('yuria', { x: 760, y: 2290, s: 2.2, t, itemL: 'crepeY', armL: -40, upperOnly: true, mouth: 'grin' });
  if (name === 'park') s += B.park(t) + charSVG('vol', { x: 420, y: 1720, s: 1.2, t }) + charSVG('yuria', { x: 700, y: 1720, s: 1.2, t, armL: 100, dragon: 1 });
  if (name === 'wheel') s += B.wheel(t, 20, 1);
  if (name === 'gondola') s += B.gondola(t) + charSVG('vol', { x: 360, y: 2330, s: 2.3, t, upperOnly: true, filter: 'url(#fWarm)', eyes: 'half', blush: .6 }) + charSVG('yuria', { x: 730, y: 2330, s: 2.3, t, upperOnly: true, filter: 'url(#fWarm)', blush: .5 });
  if (name === 'train') s += B.train(t) + charSVG('yuria', { x: 680, y: 2330, s: 2.3, t, upperOnly: true, filter: 'url(#fNight)' }) + charSVG('vol', { x: 400, y: 2380, s: 2.3, t, upperOnly: true, filter: 'url(#fNight)', eyes: 'closed', tilt: 16, lean: 6 });
  if (name === 'end') s += B.end(t);
  el.innerHTML = s;
};
