/* 天下布鳥 — 鳥たちの肖像と小さなアイコン(すべてインラインSVG)。 */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};

  function eye(x, y, col, ring, r) {
    r = r || 4.3;
    return (ring ? '<circle cx="' + x + '" cy="' + y + '" r="' + (r + 2.1) + '" fill="none" stroke="' + ring + '" stroke-width="1.9"/>' : '') +
      '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + col + '"/>' +
      '<circle cx="' + (x - 1.3) + '" cy="' + (y - 1.4) + '" r="1.25" fill="#fff" opacity=".9"/>';
  }
  var INK = '#2b2622';

  function prop(kind) {
    switch (kind) {
      case 'glasses':
        return '<g fill="none" stroke="' + INK + '" stroke-width="1.8"><circle cx="31" cy="41" r="8.6"/><circle cx="69" cy="41" r="8.6"/><path d="M39.6 40.5q10.4-5 20.8 0"/></g>';
      case 'goggles':
        return '<path d="M20.5 30q29.5-17 59 0" fill="none" stroke="#5a4a3a" stroke-width="3.4" stroke-linecap="round"/>' +
          '<g stroke="#5a4a3a" stroke-width="1.8"><ellipse cx="38" cy="23.5" rx="9.2" ry="6.6" fill="#bfe6f2"/><ellipse cx="62" cy="23.5" rx="9.2" ry="6.6" fill="#bfe6f2"/></g>' +
          '<path d="M33 21.5q3-2.6 7-1.6M57 21.5q3-2.6 7-1.6" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".85"/>';
      case 'rice':
        return '<g stroke="#b9912c" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M88 99q0-22-9-36"/></g>' +
          '<g fill="#e8c24a" stroke="#b9912c" stroke-width=".7">' +
          '<ellipse cx="78" cy="61" rx="2.4" ry="4.2" transform="rotate(-28 78 61)"/><ellipse cx="74.2" cy="66" rx="2.4" ry="4.2" transform="rotate(-50 74.2 66)"/>' +
          '<ellipse cx="82.8" cy="66.5" rx="2.4" ry="4.2" transform="rotate(8 82.8 66.5)"/><ellipse cx="77.5" cy="72" rx="2.4" ry="4.2" transform="rotate(-46 77.5 72)"/>' +
          '<ellipse cx="85.6" cy="73" rx="2.4" ry="4.2" transform="rotate(12 85.6 73)"/><ellipse cx="80.6" cy="78.6" rx="2.4" ry="4.2" transform="rotate(-40 80.6 78.6)"/></g>';
      case 'headset':
        return '<path d="M18.5 45Q50 -4 81.5 45" fill="none" stroke="#2f3338" stroke-width="3.6" stroke-linecap="round"/>' +
          '<rect x="12.5" y="39" width="9" height="15" rx="4" fill="#2f3338"/><rect x="78.5" y="39" width="9" height="15" rx="4" fill="#2f3338"/>' +
          '<path d="M16.5 54q1 13 19 12.5" fill="none" stroke="#2f3338" stroke-width="2" stroke-linecap="round"/><circle cx="36.5" cy="66.4" r="2.9" fill="#2f3338"/>';
      case 'aviator':
        return '<path d="M21 39.5q29-9 58 0" fill="none" stroke="#6b4a2c" stroke-width="3.4" stroke-linecap="round"/>' +
          '<g stroke="#6b4a2c" stroke-width="2.1"><circle cx="37.5" cy="35.5" r="7.6" fill="#cfe8ee"/><circle cx="62.5" cy="35.5" r="7.6" fill="#cfe8ee"/></g>' +
          '<path d="M45.1 35.5h9.8" stroke="#6b4a2c" stroke-width="2.1"/><path d="M33.5 33.5q2.4-2.6 5.6-2M58.5 33.5q2.4-2.6 5.6-2" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".9"/>';
      case 'hardhat':
        return '<path d="M23 33.5Q24.5 7.5 50 7.5T77 33.5z" fill="#f2c230" stroke="#b98a12" stroke-width="1.5" stroke-linejoin="round"/>' +
          '<path d="M46.5 8.2h7v24h-7z" fill="#f7d657" stroke="#b98a12" stroke-width="1.1"/>' +
          '<rect x="17.5" y="31" width="65" height="6.2" rx="3.1" fill="#f2c230" stroke="#b98a12" stroke-width="1.5"/>';
      case 'beret':
        return '<path d="M21.5 30.5Q22 9.5 51 9.5t32 16.5q1.5 6.5-5.5 5.5-26-7-56-1z" fill="#2f5d3a" stroke="#1d3b24" stroke-width="1.5" stroke-linejoin="round"/>' +
          '<path d="M52 9.8q1.2-4.4 4-4.6" fill="none" stroke="#1d3b24" stroke-width="2" stroke-linecap="round"/>' +
          '<circle cx="37.5" cy="21.5" r="3.4" fill="#e3bd48" stroke="#9c7a1c" stroke-width=".9"/>';
    }
    return '';
  }

  function buncho(L) {
    var s = '';
    s += '<ellipse cx="50" cy="96" rx="35" ry="27" fill="' + L.body + '"/>';
    s += '<ellipse cx="50" cy="101" rx="23" ry="21" fill="' + L.belly + '"/>';
    s += '<ellipse cx="50" cy="46" rx="31" ry="29.5" fill="' + L.head + '"/>';
    if (L.cheek !== L.head) s += '<ellipse cx="30.5" cy="52.5" rx="13.5" ry="12.5" fill="' + L.cheek + '"/><ellipse cx="69.5" cy="52.5" rx="13.5" ry="12.5" fill="' + L.cheek + '"/>';
    // 太いくちばし(正面)
    s += '<path d="M36.5 46.5Q50 35.5 63.5 46.5Q61.5 61 50 68.5Q38.5 61 36.5 46.5z" fill="' + L.beak + '"/>';
    s += '<path d="M42.5 58.5Q50 66.5 57.5 58.5Q50 71.5 42.5 58.5z" fill="#fbe3e4" opacity=".85"/>';
    s += '<path d="M39.5 53.5Q50 58.5 60.5 53.5" fill="none" stroke="#b9485a" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>';
    s += '<path d="M43.5 43.5q6.5-4 13 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>';
    s += eye(30.5, 40.5, L.eye, L.ring) + eye(69.5, 40.5, L.eye, L.ring);
    return s;
  }
  function budgie(L) {
    var s = '';
    s += '<ellipse cx="50" cy="96" rx="34" ry="27" fill="' + L.body + '"/>';
    s += '<path d="M19 86q7 4 11 13M81 86q-7 4-11 13M24 79q6 3 10 10M76 79q-6 3-10 10" fill="none" stroke="#2f4a22" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>';
    s += '<ellipse cx="50" cy="73" rx="22" ry="15" fill="' + L.head + '"/>';
    s += '<ellipse cx="50" cy="45" rx="29.5" ry="29" fill="' + L.head + '"/>';
    s += '<path d="M25 30q6-5 9-12M33 24q5-4 8-10M75 30q-6-5-9-12M67 24q-5-4-8-10" fill="none" stroke="#3a3a30" stroke-width="1.7" stroke-linecap="round" opacity=".5"/>';
    s += '<ellipse cx="28.5" cy="60" rx="5.2" ry="4.2" fill="' + L.cheek + '"/><ellipse cx="71.5" cy="60" rx="5.2" ry="4.2" fill="' + L.cheek + '"/>';
    s += '<circle cx="39.5" cy="74" r="2.5" fill="#22221e"/><circle cx="50" cy="76.5" r="2.5" fill="#22221e"/><circle cx="60.5" cy="74" r="2.5" fill="#22221e"/>';
    s += '<path d="M42.8 55.5Q50 51.5 57.2 55.5Q56 63.5 50 67.5Q44 63.5 42.8 55.5z" fill="' + L.beak + '"/>';
    s += '<path d="M46.5 60.5q3.5 2.6 7 0" fill="none" stroke="#a9792a" stroke-width="1" stroke-linecap="round"/>';
    s += '<ellipse cx="50" cy="51.8" rx="9.4" ry="5.4" fill="' + L.cere + '"/><circle cx="46.2" cy="52.3" r="1.25" fill="#274a80"/><circle cx="53.8" cy="52.3" r="1.25" fill="#274a80"/>';
    s += eye(30, 42.5, L.eye, '#ffffff', 4) + eye(70, 42.5, L.eye, '#ffffff', 4);
    return s;
  }
  function cockatiel(L) {
    var s = '';
    // 冠羽
    s += '<path d="M47 27Q36 9 43 -3Q51 9 53 27z" fill="' + L.head + '"/><path d="M51 27Q49 6 60 -5Q61 11 57 28z" fill="#e9d35e"/><path d="M55 29Q59 12 71 4Q68 19 60 31z" fill="' + L.body + '"/>';
    s += '<ellipse cx="50" cy="98" rx="34" ry="26" fill="' + L.body + '"/>';
    s += '<ellipse cx="50" cy="103" rx="22" ry="20" fill="' + L.belly + '"/>';
    s += '<ellipse cx="50" cy="52" rx="29.5" ry="28.5" fill="' + L.head + '"/>';
    s += '<circle cx="27.5" cy="60" r="8.6" fill="' + L.cheek + '"/><circle cx="72.5" cy="60" r="8.6" fill="' + L.cheek + '"/>';
    s += '<path d="M42.8 55.5Q50 51 57.2 55.5Q56 65 50 69.5Q44 65 42.8 55.5z" fill="' + L.beak + '"/>';
    s += '<path d="M46.4 61.5q3.6 2.6 7.2 0" fill="none" stroke="#6c6c72" stroke-width="1" stroke-linecap="round"/><circle cx="47" cy="56.3" r="1" fill="#6c6c72"/><circle cx="53" cy="56.3" r="1" fill="#6c6c72"/>';
    s += eye(31.5, 48.5, L.eye, null, 4.4) + eye(68.5, 48.5, L.eye, null, 4.4);
    return s;
  }
  function lovebird(L) {
    var s = '';
    s += '<ellipse cx="50" cy="96" rx="35" ry="27" fill="' + L.body + '"/>';
    s += '<ellipse cx="50" cy="101" rx="23" ry="21" fill="' + L.belly + '"/>';
    s += '<ellipse cx="50" cy="46" rx="31" ry="29.5" fill="' + L.body + '"/>';
    s += '<ellipse cx="50" cy="51" rx="25.5" ry="24.5" fill="' + L.cheek + '"/>';
    s += '<ellipse cx="50" cy="72" rx="19" ry="13" fill="' + L.cheek + '"/>';
    s += '<path d="M25.5 44Q28 20 50 20T74.5 44Q50 33 25.5 44z" fill="' + L.head + '"/>';
    s += '<path d="M40 49Q50 42.5 60 49Q58.5 63.5 50 68.5Q41.5 63.5 40 49z" fill="' + L.beak + '"/>';
    s += '<path d="M44.5 56.5q5.5 3.4 11 0" fill="none" stroke="#b39a5c" stroke-width="1.1" stroke-linecap="round"/><path d="M45 47.5q5-2.6 10 0" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>';
    s += eye(31.5, 45, L.eye, '#fbf6ee', 4.1) + eye(68.5, 45, L.eye, '#fbf6ee', 4.1);
    return s;
  }

  // 総括指揮AI:琥珀色の顔が映る端末と、その下の計算機ラック
  function ai() {
    var s = '';
    s += '<rect x="19" y="72" width="62" height="40" rx="7" fill="#3b475c"/><rect x="26" y="80" width="48" height="5" rx="2.5" fill="#2a3446"/>';
    s += '<circle cx="31" cy="92" r="2.4" fill="#6fe08a"/><circle cx="39" cy="92" r="2.4" fill="#ffb86b"/><circle cx="47" cy="92" r="2.4" fill="#6fe08a"/><rect x="56" y="89.5" width="16" height="5" rx="2.5" fill="#2a3446"/>';
    s += '<rect x="43" y="64" width="14" height="10" fill="#8791a3"/>';
    s += '<path d="M50 17V8" stroke="#8791a3" stroke-width="2.6" stroke-linecap="round"/><circle cx="50" cy="6.5" r="3.6" fill="#e2492d"/>';
    s += '<rect x="15" y="15" width="70" height="52" rx="11" fill="#efe8da" stroke="#cbbfa8" stroke-width="1.5"/><rect x="22" y="22" width="56" height="38" rx="7" fill="#14213a"/>';
    s += '<rect x="34.5" y="31" width="7.5" height="12" rx="3.75" fill="#ffb86b"/><rect x="58" y="31" width="7.5" height="12" rx="3.75" fill="#ffb86b"/>';
    s += '<path d="M42.5 49.5q7.5 5.5 15 0" fill="none" stroke="#ffb86b" stroke-width="2.8" stroke-linecap="round"/>';
    s += '<circle cx="30" cy="47.5" r="3" fill="#ff8f6b" opacity=".55"/><circle cx="70" cy="47.5" r="3" fill="#ff8f6b" opacity=".55"/>';
    s += '<path d="M27 27.5h13" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".2"/>';
    return s;
  }

  var DRAW = { buncho: buncho, budgie: budgie, cockatiel: cockatiel, lovebird: lovebird, ai: ai };

  // 鳥(と総括指揮AI)の肖像。bird は DATA.BIRDS の要素か id。
  function birdSVG(bird, cls) {
    if (typeof bird === 'string') bird = bird === 'dario' ? TF.DATA.DARIO : (TF.DATA.BIRDS.filter(function (b) { return b.id === bird; })[0]);
    if (!bird) return '';
    var L = bird.look, id = 'bc-' + bird.id + '-' + (birdSVG.n = (birdSVG.n || 0) + 1);
    return '<svg class="bird ' + (cls || '') + '" viewBox="0 0 100 100" role="img" aria-label="' + bird.name + '(' + bird.species + ')">' +
      '<defs><clipPath id="' + id + '"><circle cx="50" cy="50" r="50"/></clipPath></defs>' +
      '<circle cx="50" cy="50" r="50" class="bird-bg"/>' +
      '<g clip-path="url(#' + id + ')">' + DRAW[L.kind](L) + prop(L.prop) + '</g></svg>';
  }

  // 単色アイコン(currentColor)
  var P = {
    gold: 'M12 2.5c3.6 0 6.5 4.3 6.5 9.5s-2.9 9.5-6.5 9.5S5.5 17.2 5.5 12 8.4 2.5 12 2.5zM9 8v1.5h6V8zM9 14.5V16h6v-1.5z',
    food: 'M12 3.2c1.100 0 2 .600 2.600 1.500l6 9.700c1.400 2.200-.200 5.100-2.800 5.100H6.200c-2.600 0-4.200-2.900-2.800-5.100l6-9.700c.600-.900 1.500-1.500 2.600-1.500zM9.200 13.200v6.300h5.600v-6.300z',
    steel: 'M5 5h14v3.2h-5.2v7.6H19V19H5v-3.2h5.2V8.2H5z',
    fuel: 'M12 2.5c3.3 4.3 6.2 7.5 6.2 11.2a6.2 6.2 0 0 1-12.4 0c0-3.7 2.9-6.9 6.2-11.2z',
    ammo: 'M9 21.5v-9.3c0-4 1.2-7.6 3-9.7 1.8 2.1 3 5.700 3 9.7v9.300zM9 17.200v1.300h6v-1.300z',
    prestige: 'M12 2.5l2.9 6 6.600.900-4.800 4.600 1.200 6.500-5.900-3.100-5.900 3.100 1.200-6.500-4.800-4.600 6.600-.900z',
    rp: 'M9.5 3h5v1.600h-1V9l5 9.200c.6 1.200-.2 2.300-1.500 2.300H7c-1.300 0-2.100-1.100-1.500-2.300l5-9.200V4.600h-1zM8.400 16l-1 1.900h9.200l-1-1.900z',
    inf: 'M4 15c0-5.200 3.600-9.200 8-9.200s8 4 8 9.200v.800H4zM2.800 17h18.400v1.700H2.800z',
    tank: 'M2.500 14h19l-1.700 5H4.200zM6.500 9.800h8.500V14H6.500zM15 10.900h7v1.700h-7z',
    arty: 'M4.300 12.700l13.200-7.200 1.100 2-13.200 7.200zM9.500 13.300a3.600 3.600 0 1 0 0 7.200 3.600 3.600 0 0 0 0-7.200zM13 17.300l8 2.200v1.500l-8.300-1.700z',
    heli: 'M2.500 5.500h19V7h-19zM11.200 7h1.600v2.500h-1.600zM6 9.500h7.500c2.500 0 4.500 2 4.500 4.500v1.500H9.500C7 15.500 5 13.700 5 11.500v-1c0-.6.400-1 1-1zM18 12.800l4-2.800v1.900l-3.300 2.600zM8 17h9v1.500H8z',
    jet: 'M12 2l1.700 6.600L21 14v2.100l-7.200-2 .4 4.400 2.400 1.800V22l-4.600-1.200L7.400 22v-1.700l2.400-1.800.4-4.400-7.200 2V14l7.300-5.400z',
    kair: 'M12 3c.9 0 1.400 1.500 1.400 3.500V9H21v2.600l-7.600 1.200-.4 5.200 2.600 1.600V21H8.400v-1.400l2.600-1.600-.4-5.200L3 11.600V9h7.600V6.500C10.600 4.500 11.100 3 12 3z',
    ddg: 'M2 15h20l-2.600 4.700H4.600zM7 11.200h8V15H7zM10 7.200h3v4h-3zM15.800 12.800h3.700V15h-3.700zM11 3.500h1v3.700h-1z',
    lst: 'M2 15h20l-2.200 4.700H4.200zM3.800 11.500h9.400V15H3.800zM14.600 8.600h3.800V15h-3.800z',
    ironclad: 'M2 15h20l-2.600 4.700H4.600zM8 8.800h2.600V15H8zM12.400 8.800H15V15h-2.600zM5.500 12.600h13V15h-13zM7.500 5.200c1-1.400 2.400-.2 3.500-1.200.3 1.800-1.600 1.600-2.200 2.600z',
    bb: 'M1.500 15h21l-2.600 4.700H4.100zM9 9.500h6V15H9zM11 5.500h2v4h-2zM3.500 12.700h5.500v1.500H3.500zM15 12.700h5.500v1.500H15z',
    ashi: 'M2.500 14.500l9.500-8.500 9.500 8.500zM7 16h10v1.700H7z',
    fort: 'M4 21v-5.500h2.200V13L4.500 12 12 7.700 19.500 12l-1.700 1v2.500H20V21zM7.800 7.900L12 4.200l4.200 3.700-1.300.2L12 6.300 9.100 8.100zM10.500 21v-3.500h3V21z',
    coal: 'M5.500 9.500l3.500-5h6l3.500 5-2 9.500h-9z',
    iron: 'M3 7.500h12.500L21 10.700h-6.300v2c0 1.600 1 2.800 2.300 3.300v2.500H7v-2.500c1.300-.5 2.300-1.700 2.300-3.300v-2C6 10.700 4 9.500 3 7.500z',
    bauxite: 'M12 2.800l7 8.200-7 10.200-7-10.200z',
    oil: 'M11 2h2l5 19.500h-2.100l-.9-3.500H9l-.9 3.500H6zM9.500 16h5l-.9-3.500h-3.200zM10.900 10.500h2.200L12.500 8h-1z',
    sword: 'M19.500 3l1.500 1.500-9.500 9.500 1.500 1.500-1.400 1.400-1.800-1.800-3.300 3.300-1.400-1.400 3.300-3.300L6.600 12 8 10.600l1.500 1.500z',
    scroll: 'M6 3.500h11.500c1.400 0 2.500 1.100 2.500 2.500v1.500h-3V19c0 1-.9 1.800-2 1.800H6.500c-1.400 0-2.500-1.100-2.500-2.500V17h9.500v1.300c0 .5 1 .5 1 0V5.500H7.500V15H6zM8.800 8h4.400v1.300H8.800zM8.800 10.800h4.400v1.300H8.800z',
    flag: 'M5 3h1.700v18H5zM7.500 4h11l-2.700 4 2.700 4h-11z',
    map: 'M3 5.500l5.500-2 7 2 5.500-2V18.500l-5.500 2-7-2-5.500 2zM9 5.300v11.900l6 1.700V7z',
    gear: 'M10.300 2.500h3.400l.5 2.500 1.500.6 2.100-1.400 2.400 2.400-1.400 2.100.6 1.500 2.500.5v3.400l-2.500.5-.6 1.500 1.400 2.100-2.400 2.400-2.100-1.400-1.500.6-.5 2.500h-3.400l-.5-2.500-1.500-.6-2.100 1.400-2.400-2.400 1.400-2.100-.6-1.500-2.500-.5v-3.400l2.500-.5.6-1.500L3.800 6.600l2.400-2.400 2.100 1.400 1.500-.6zM12 8.500a3.500 3.500 0 1 0 0 7 3.500 3.500 0 0 0 0-7z',
    sound: 'M4 9.500h3.500L12.500 5v14l-5-4.500H4zM15 8.800c1.500 1.600 1.500 4.800 0 6.400l-1-1c.9-1.100.9-3.300 0-4.400zM17.500 6.300c2.900 3 2.900 8.400 0 11.400l-1-1c2.300-2.500 2.300-6.900 0-9.400z',
    mute: 'M4 9.500h3.500L12.500 5v14l-5-4.500H4zM14.600 9.300l1.100-1.100 2 2 2-2 1.100 1.100-2 2 2 2-1.100 1.100-2-2-2 2-1.100-1.100 2-2z',
    film: 'M3 5h18v14H3zM5 7v2h2V7zM5 11v2h2v-2zM5 15v2h2v-2zM17 7v2h2V7zM17 11v2h2v-2zM17 15v2h2v-2zM10 9v6l5-3z',
    chip: 'M9 2h1.500v3h3V2H15v3h1.500A2.500 2.500 0 0 1 19 7.500V9h3v1.500h-3v3h3V15h-3v1.500a2.500 2.500 0 0 1-2.500 2.500H15v3h-1.500v-3h-3v3H9v-3H7.500A2.500 2.500 0 0 1 5 16.500V15H2v-1.500h3v-3H2V9h3V7.500A2.500 2.500 0 0 1 7.500 5H9zM9 9v6h6V9z',
    anchor: 'M12 2.500a2.500 2.500 0 0 1 .9 4.800v1.700h3V10.700h-3v7.500c2.200-.4 3.900-2 4.400-4.200l-1.600.3 2.500-3.300L20.500 15l-1.500-.5c-.8 3.500-3.600 6-7 6s-6.200-2.500-7-6L3.500 15l2.300-4 2.500 3.300-1.600-.3c.5 2.200 2.200 3.800 4.400 4.200v-7.500h-3V9h3V7.300a2.500 2.500 0 0 1 .9-4.800z'
  };
  function icon(name, cls) {
    var d = P[name] || P.flag;
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="' + d + '"/></svg>';
  }
  var UNIT_ICON = { inf: 'inf', tank: 'tank', arty: 'arty', heli: 'heli', jet: 'jet', ddg: 'ddg', lst: 'lst', ashi: 'ashi', fgun: 'arty', ktank: 'tank', modern: 'tank', kair: 'kair', ironclad: 'ironclad', bb: 'bb' };
  var SITE_ICON = { oil: 'fuel', coal: 'coal', iron: 'iron', gold: 'gold', bauxite: 'bauxite' };

  TF.birdSVG = birdSVG;
  TF.icon = icon;
  TF.iconPath = function (name) { return P[name] || P.flag; };
  TF.UNIT_ICON = UNIT_ICON;
  TF.SITE_ICON = SITE_ICON;
})(typeof window !== 'undefined' ? window : globalThis);
