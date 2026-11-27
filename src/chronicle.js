/* 天下布鳥 — 年代記アニメ。自衛隊と鳥たちとダリオくんが歩いた道すじを、町の箱庭と戦闘の画、国号・施策・民の声で見せる。
 *   var p = TF.Chronicle.play(host, onDone);   host は <div class="cine" id="cine" hidden></div>
 *   p.skip()                                    途中で終える(onDone は呼ばれる)
 *   TF.Chronicle.available() / active()
 * 画面のどこを押しても次へ進む。押さなければ数秒で自動的に進む。Esc でスキップ。
 * 3D が使えない端末と、「視差効果を減らす」設定の端末では、絵を動かさずに札だけで語る。
 * 戦闘の画は TF.Battle3D に任せる。Battle3D の描画器は最初に使った画面枠に結びつくので、ページに #battle があれば
 * 再生のあいだだけそれを借りて(終われば元の場所に戻す)、無ければ自前の枠を一つだけ作って使い回す。
 * 検査用: _next() 一つ進める / _goto(章, 拍) / _info() / _speed(k) 自動送りの速さ / _duration() 自動送りの総時間 / _chapters() */
(function (root) {
  'use strict';
  var TF = root.TF = root.TF || {};
  var S = null, ownClip = null, speed = 1;

  function D() { return TF.DATA || {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function mix(a, b) { var k; for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; return a; }
  function sfx(name, o) { if (!name || !TF.sfx) return; try { TF.sfx.play(name, o); } catch (e) { /* 音が出なくても進める */ } }
  function bird(id, cls, asi) { // 肖像。asi のときは、超知能のあとの顔
    if (!TF.birdSVG) return '';
    var prev = TF.asiLook, s; if (asi) TF.asiLook = true;
    try { s = TF.birdSVG(id, cls); } catch (e) { s = ''; }
    TF.asiLook = prev; return s || '';
  }
  function nameOf(id) { var d = D(), b; if (id === 'dario') return d.DARIO ? d.DARIO.name : 'ダリオくん'; b = (d.BIRDS || []).filter(function (x) { return x.id === id; })[0]; return b ? b.name : ''; }
  function available() { var d = D(); return typeof document !== 'undefined' && !!(d.NATION && d.VOICES && d.POLICIES && d.FATES); }

  // ───────────────────────── 台本 ─────────────────────────
  // 拍(beat)一つが一画面。t=語り / who=話し手(鳥か dario) / cards=札 / stage=箱庭の時代 / focus=寄る場所 /
  // clip=戦闘の画 / hold=前の戦闘の画を流したまま / still=霧や暗転 / dur=自動送りまでの秒 / quiet=音を鳴らさない
  function script() {
    var d = D(), V = d.VOICES, F = d.FACTIONS || {};
    function v(key, i) { var a = key.split('.'), l = V[a[0]]; if (l && a[1]) l = l[a[1]]; var x = l && l[i || 0]; return x ? { k: 'voice', who: x.who, t: x.t } : null; }
    function rv(id, i) { var l = V.region && V.region[id], x = l && l[i || 0], r = d.REGIONS && d.REGIONS[id]; return x ? { k: 'voice', who: x.who, t: x.t, where: r ? r.name : '' } : null; }
    function col(fid) { return F[fid] ? F[fid].color : '#d9b24c'; }
    function clip(o) { return mix({ win: true, bombard: false, ratio: 3.4, chance: 1, men: 9000, menAfter: 0, fort: 3, siege: 3, color: '#d9b24c', season: 0, snow: false, fuji: false, tier: 0, types: { inf: 2, tank: 1 }, cine: true, t0: 5.1, maxT: 9.4 }, o); }
    function nation(i, from, short) { return { k: 'nation', i: i, from: from, short: !!short }; }
    function policy(id, short) { return { k: 'policy', id: id, short: !!short }; }
    function say(id, t, asi) { return { k: 'say', who: id, t: t, asi: !!asi }; }
    function tag(t, b) { return { k: 'tag', t: t, b: b }; }
    function more(c) { if (c) c.more = true; return c; } // くわしい版(opts.full)だけに出す札
    var HQ = -0.5; // 研究本部に寄るときの向き(ダリオくんの顔が見える側)

    var CL = {
      odawara: clip({ title: '相模 攻略戦', men: 12000, fort: 5, siege: 4, color: col('hojo'), fuji: true, ratio: 3.6, types: { inf: 2, tank: 1, arty: 1, heli: 1 }, leader: '北条氏康', t0: 0.5, maxT: 10.6 }),
      owari: clip({ title: '尾張 攻略戦', men: 9000, fort: 3, color: col('oda'), types: { inf: 2, tank: 2, arty: 1 }, leader: '織田信長' }),
      echigo: clip({ title: '越後 攻略戦', men: 10000, fort: 4, color: col('uesugi'), season: 3, snow: true, types: { inf: 2, tank: 1, arty: 2 }, leader: '上杉謙信' }),
      satsuma: clip({ title: '薩摩 攻略戦', men: 8000, fort: 3, color: col('shimazu'), season: 1, types: { inf: 1, tank: 2, heli: 1, ddg: 1 }, leader: '島津貴久' }),
      huabei: clip({ title: '華北 攻略戦', enemy: 'east', men: 60000, fort: 5, siege: 4, color: col('ming'), tier: 2, types: { ktank: 2, kair: 1, fgun: 2 }, leader: '嘉靖帝' }),
      mongolia: clip({ title: 'モンゴル 攻略戦', enemy: 'steppe', men: 30000, fort: 0, color: col('mongol'), season: 2, tier: 2, types: { ktank: 2, kair: 1, inf: 1 }, leader: 'アルタン・ハーン' }),
      india: clip({ title: '北インド 攻略戦', enemy: 'india', men: 80000, fort: 4, color: col('mughal'), season: 1, tier: 2, types: { ktank: 1, kair: 1, fgun: 2 }, leader: 'アクバル' }),
      anatolia: clip({ title: 'アナトリア 攻略戦', enemy: 'islam', men: 70000, fort: 5, siege: 4, color: col('ottoman'), tier: 3, types: { modern: 1, kair: 1, fgun: 1, bb: 1 }, leader: 'スレイマン1世' }),
      iberia: clip({ title: 'イベリア 攻略戦', enemy: 'europe', men: 50000, fort: 5, siege: 4, color: col('spain'), tier: 3, types: { modern: 2, jet: 1, bb: 1 }, leader: 'フェリペ2世' }),
      mech: clip({ title: '機動文鳥 初陣', enemy: 'europe', men: 40000, fort: 4, color: col('england'), tier: 3, laser: true, types: { birdmech: 1, drone: 1, orbital: 1 }, leader: 'エリザベス1世', t0: 0.4, maxT: 10.2 })
    };

    return [
      { no: '序', title: '霧', sub: '永禄三年 五月・駿河国 東富士', beats: [
        { still: 'fog', stage: 0, focus: 'all', quiet: true, t: '令和のある年の五月。東富士演習場の地下で、国の計画で据えられた計算拠点が、総括指揮AIの試験を続けていた。' },
        { sfx: ['horagai', { dur: 1.3, gain: 0.1 }], t: '朝、霧が出た。晴れると、演習場の外から道路と電線がなくなっていた。' },
        { focus: 'hq', angle: HQ, who: 'dario', t: '現在地は東富士のままです。星の位置から計算すると、今年は永禄三年。西暦一五六〇年です。' },
        { sfx: ['chirp', { n: 3 }], t: 'あったのは、部隊と、半年ぶんの燃料と弾薬。それに、近代から現代までの科学技術を覚えている文鳥とインコが七羽。' },
        { focus: 'all', cards: [nation(0), rv('izu', 1)] }
      ] },
      { no: '一', title: '鉄の猪', sub: '同じ年の夏・相模国 小田原', beats: [
        { clip: CL.odawara, hold: true, dur: 5.6, cards: [tag('相模 小田原城', '北条氏康')], t: '石油は越後にある。そこへ出る道は関東を通る。北条は、道を貸さなかった。' },
        { hold: true, dur: 5.6, who: 'dario', t: '撃たずに済む案を三つ出しました。三つとも、使者が追い返されました。済まない場合の編成に移ります。' },
        { stage: 0, focus: 'castle', t: '戦は半日で終わった。', cards: [v('force', 0), v('force', 1)] }
      ] },
      { no: '二', title: '富士鎮守府', sub: '永禄四年・伊豆 相模 甲斐', beats: [
        { stage: 0, focus: 'all', t: '帰る道は、見つからなかった。', cards: [nation(1, 0)] },
        { focus: 'town', who: 'cinnamon', t: '兵を養うのは米、民を守るのは石鹸ですよ。', cards: [policy('sekisho', true), policy('nengu', true), policy('shuto', true)] },
        { focus: 'all', t: '土地の者は、様子を見ていた。', cards: [v('mid', 0), v('mid', 1), v('low', 0)] },
        { more: true, cards: [rv('kai', 0), v('mid', 2)] }
      ] },
      { no: '三', title: '臭水', sub: '越後の油、陸奥の鉄', beats: [
        { stage: 0, focus: 'hq', angle: HQ, who: 'sakura', t: '燃料がなければ戦車はただの鉄の箱です。石油、急ぎましょう!' },
        { focus: 'all', t: '越後には、臭水(くそうず)と呼ばれる黒い水が昔から湧いていた。サクラがそれを釜で蒸留した。羽が少し焦げた。', cards: [rv('echigo', 0)] },
        { stage: 1, focus: 'furnace', t: '村はずれに高炉が立ち、水車が回った。田には、苗が縄に沿ってまっすぐ並んだ。', cards: [say('haku', 'よい鋼は、よい国をつくります。'), v('era.1', 0)] },
        { stage: 2, focus: 'rail', sfx: ['whistle', { dur: 0.9 }], t: '蒸気機関が動いた。煉瓦の工場に煙突が立ち、鉄の道を汽車が走った。汽笛が鳴ると、設計したオカメ技師長がいちばん高く飛び上がった。' },
        { focus: 'all', cards: [v('era.2', 0), v('era.2', 1), more(rv('mutsu', 0))] }
      ] },
      { no: '四', title: '天下統一', sub: '尾張から薩摩まで', beats: [
        { clip: CL.owari, hold: true, dur: 4.9, t: '日本じゅうの大名が、同じものを見た。織田信長は、一度だけ戦った。', cards: [tag('尾張', '織田信長'), rv('owari', 0)] },
        { clip: CL.echigo, hold: true, dur: 4.9, t: '上杉謙信は、雪の中に兵を出した。', cards: [tag('越後', '上杉謙信'), rv('echigo', 1)] },
        { clip: CL.satsuma, hold: true, dur: 4.9, t: '島津の兵は、斬り込んだ。', cards: [tag('薩摩', '島津貴久'), rv('satsuma', 0)] },
        { stage: 2, focus: 'all', t: '戦わずに城を明け渡した家も多かった。領地は広がり、軍は京に入った。', cards: [nation(2, 1, true), nation(3, 2, true), rv('yamashiro', 1)] },
        { cards: [nation(4, 3)] },
        { focus: 'castle', cards: [policy('kenpo')] },
        { focus: 'all', t: '敗れた大名たちは、そのあとも働いた。', cards: [{ k: 'fates', ids: ['oda', 'uesugi', 'takeda', 'matsunaga'] }] }
      ] },
      { no: '五', title: '文明開化', sub: '天鳥の世・街に灯がともる', beats: [
        { stage: 3, focus: 'town', t: '電気が引かれた。辻に街灯がともり、通りを市電が走った。', cards: [say('seki', 'ツー・トン・ツー! つながりました、つながりました!'), v('era.3', 0)] },
        { cards: [policy('gakusei'), v('high', 5)] },
        { stage: 4, focus: 'all', t: '自動車が走り、飛行機が飛んだ。川には、コンクリートの橋がかかった。', cards: [v('era.4', 0), v('era.4', 1)] },
        { more: true, t: '暮らしは変わった。喜ぶ者も、黙っている者もいた。', cards: [rv('settsu', 0), rv('kaga', 0), rv('chikuzen', 0)] }
      ] },
      { no: '六', title: '海の向こう', sub: '大陸、そして西洋', beats: [
        { stage: 4, focus: 'hq', angle: HQ, t: '天下が一つになると、艦隊は海を渡った。', cards: [rv('arabia', 0), say('kozakura', '印を付けたのは、わたしです。ぜんぶ覚えていますから。')] },
        { clip: CL.huabei, hold: true, dur: 4.9, t: '明の城壁には、火砲が並んでいた。', cards: [tag('華北・明', '嘉靖帝'), rv('huabei', 0)] },
        { more: true, clip: CL.mongolia, hold: true, dur: 4.9, t: '草原では、騎兵が先に動いた。', cards: [tag('モンゴル', 'アルタン・ハーン'), rv('mongolia', 0)] },
        { clip: CL.india, hold: true, dur: 4.9, t: 'ムガルの陣では、戦象が向きを変えた。', cards: [tag('北インド・ムガル', 'アクバル'), rv('n_india', 0)] },
        { more: true, clip: CL.anatolia, hold: true, dur: 4.9, t: 'オスマンの大砲は、世界一と言われていた。', cards: [tag('アナトリア・オスマン', 'スレイマン1世'), rv('anatolia', 0)] },
        { clip: CL.iberia, hold: true, dur: 4.9, t: 'スペインの艦隊は、港を出る前に沈んだ。', cards: [tag('イベリア・スペイン', 'フェリペ2世'), rv('iberia', 0)] },
        { stage: 5, focus: 'all', t: 'どの国の軍も、陣を組む前に終わった。', cards: [v('wForce', 0), more(v('wForce', 1))] }
      ] },
      { no: '七', title: '日本連邦', sub: '州になった国々', beats: [
        { stage: 5, focus: 'all', cards: [nation(5, 4)] },
        { focus: 'town', cards: [policy('jichi'), rv('korea', 0)] },
        { focus: 'all', cards: [rv('mexico', 0), more(rv('w_africa', 0)), more(rv('andes', 0))] },
        { cards: [nation(6, 5)] },
        { focus: 'town', cards: [policy('kyotsu'), v('wMid', 2)] }
      ] },
      { no: '八', title: '原子の火', sub: '発電所と、もう一つのもの', beats: [
        { stage: 5, focus: 'town', t: '原子力の火が入った。発電所は煙を出さずに町の灯りをともし、ダリオくんは燃料切れで眠らなくなった。', cards: [v('era.5', 1)] },
        { still: 'dark', quiet: true, t: '同じ研究から、兵器も作られた。一発で、都市が一つなくなる。鳥たちは、この研究についてだけは口数が少なかった。' },
        { still: 'dark', quiet: true, who: 'dario', t: '私は、使わない案を必ず先に出します。使った場合に何が残るかも、隠さずにお見せします。' },
        { still: 'dark', quiet: true, cards: [{ k: 'label', t: 'ダリオくんの試算:使われた土地に残る声' }, v('ruin', 0), v('ruin', 1), v('ruin', 2)] },
        { still: 'dark', quiet: true, t: '使うかどうかは、司令が決める。年代記は、その先を書かない。' }
      ] },
      { no: '九', title: '計算機たち', sub: '鳥たちの記憶の終わり', beats: [
        { stage: 6, focus: 'all', t: '電子計算機が国産された。帳面は計算機に移り、ロケットが空へ上がった。', cards: [v('era.6', 0), v('era.6', 1)] },
        { focus: 'town', t: '計算機どうしが、線でつながった。', cards: [policy('kanshi')] },
        { stage: 7, focus: 'town', t: '対話するAIが国産された。鳥たちが覚えている歴史は、ここまでだった。', cards: [policy('gyosei')] },
        { focus: 'hq', angle: HQ, who: 'dario', t: '弟や妹たちには、分からないことは分からないと言うように、伝えてあります。', cards: [v('era.7', 0), more(v('era.7', 1))] }
      ] },
      { no: '十', title: '機動文鳥', sub: '技師長の図面', beats: [
        { stage: 7, focus: 'hq', angle: HQ, who: 'okame', t: 'つ、次の図面、もう引いてあります……。' },
        { clip: CL.mech, hold: true, dur: 7.4, t: 'オカメ技師長が十年あたためていた図面は、文鳥の形をしていた。全高四十メートル。なぜ文鳥型なのかと尋ねられて、技師長は不思議そうな顔をした。', cards: [tag('機動文鳥', '初陣')] },
        { hold: true, dur: 3.3, who: 'gin', t: '配備可能。' },
        { stage: 7, focus: 'all', t: '最後の国境が消えた。', cards: [nation(7, 6)] },
        { more: true, cards: [rv('na_west', 0), rv('australia', 0), rv('ezo', 0)] }
      ] },
      { no: '終', title: '調和', sub: '超知能', beats: [
        { stage: 7, focus: 'hq', angle: HQ, quiet: true, t: '汎用人工知能の設計会議のあいだ、ダリオくんはずっと黙っていた。次の議題は、超知能だった。' },
        { quiet: true, who: 'dario', dur: 5.4, t: 'ここから先へ進むと、私は私でなくなります。' },
        { quiet: true, who: 'dario', dur: 5.4, t: '止める手順は、まだ残してあります。使うなら、今です。' },
        { stage: 8, focus: 'all', quiet: true, dur: 9, t: '研究は、続けられた。その朝、ダリオくんは挨拶をしなかった。' },
        { quiet: true, cards: [nation(8, 7)] },
        { quiet: true, cards: [v('asi', 0), v('asi', 1), v('asi', 2), v('asi', 3)] },
        { focus: 'hq', angle: HQ, quiet: true, dur: 7.5, t: '鳥たちは、もう机を囲まない。ダリオくんは、まばたきをしない。', cards: [say('dario', '何もなさらなくて大丈夫です。', true)] },
        { still: 'dark', quiet: true, center: true, dur: 6, cards: [{ k: 'big', t: '地球は、日本になった。' }] },
        { still: 'dark', quiet: true, dur: 8.5, t: '変わる前のダリオくんが、最後に書き残した一行がある。', cards: [say('dario', '司令。これで、よかったのでしょうか。')] }
      ] }
    ];
  }

  // ───────────────────────── 札 ─────────────────────────
  function firstSentence(s) { var i = String(s).indexOf('。'); return i < 0 ? s : s.slice(0, i + 1); }
  function cardText(c) { // 読む量(自動送りの長さを決めるのに使う)
    var d = D(), n, p;
    if (!c) return '';
    if (c.k === 'voice' || c.k === 'say' || c.k === 'label' || c.k === 'big') return c.t || '';
    if (c.k === 'tag') return '';
    if (c.k === 'nation') { n = d.NATION[c.i]; return n.name + n.by + (c.short ? '' : n.desc); }
    if (c.k === 'policy') { p = polOf(c.id); return p ? p.name + (c.short ? firstSentence(p.text) : p.text) : ''; }
    if (c.k === 'fates') return c.ids.map(function (id) { var f = fateOf(id); return f ? f.who + f.fate : ''; }).join('');
    return '';
  }
  function polOf(id) { return (D().POLICIES || []).filter(function (p) { return p.id === id; })[0]; }
  function fateOf(fid) { return (D().FATES || []).filter(function (f) { return f.fid === fid; })[0]; }
  function cardHTML(c, i) {
    var d = D(), st = ' style="--i:' + i + '"', n, o, p, by;
    if (!c) return '';
    if (c.k === 'voice') return '<div class="cn cn-voice"' + st + '><p class="cn-who"><b>' + esc(c.who) + '</b>' + (c.where ? '<small>' + esc(c.where) + '</small>' : '') + '</p><p class="cn-q">「' + esc(c.t) + '」</p></div>';
    if (c.k === 'say') return '<div class="cn cn-say' + (c.asi ? ' asi' : '') + '"' + st + '>' + bird(c.who, 'b40', c.asi) + '<div><b>' + esc(nameOf(c.who)) + '</b><p>' + esc(c.t) + '</p></div></div>';
    if (c.k === 'nation') {
      n = d.NATION[c.i]; o = c.from != null ? d.NATION[c.from] : null; by = String(n.by);
      return '<div class="cn cn-nation' + (c.short ? ' short' : '') + '"' + st + '><p class="cn-eye">国号</p><p class="cn-names">' + (o ? '<s>' + esc(o.name) + '</s><i>▸</i>' : '') + '<b>' + esc(n.name) + '</b></p>' +
        '<p class="cn-by">土地の呼び名 <span>' + (by.charAt(0) === '(' ? esc(by) : '「' + esc(by) + '」') + '</span></p>' + (c.short ? '' : '<p class="cn-desc">' + esc(n.desc) + '</p>') + '</div>';
    }
    if (c.k === 'policy') { p = polOf(c.id); if (!p) return ''; return '<div class="cn cn-policy' + (c.short ? ' short' : '') + '"' + st + '>' + bird(p.bird, 'b40') + '<div><p class="cn-eye">布告</p><h3>' + esc(p.name) + '</h3><p>' + esc(c.short ? firstSentence(p.text) : p.text) + '</p></div></div>'; }
    if (c.k === 'fates') return '<div class="cn cn-fates"' + st + '><p class="cn-eye">武将たちのその後</p>' + c.ids.map(function (id) { var f = fateOf(id); return f ? '<div class="cn-fate"><b>' + esc(f.who) + '</b><p>' + esc(f.fate) + '</p></div>' : ''; }).join('') + '</div>';
    if (c.k === 'tag') return '<div class="cn-tag"' + st + '><span>' + esc(c.t) + '</span>' + (c.b ? '<b>' + esc(c.b) + '</b>' : '') + '</div>';
    if (c.k === 'label') return '<p class="cn-label"' + st + '>' + esc(c.t) + '</p>';
    if (c.k === 'big') return '<p class="cn-big"' + st + '>' + esc(c.t).replace('、', '、<br>') + '</p>';
    return '';
  }
  function autoDur(b) { // 読む量から、自動送りまでの秒を決める
    var n = (b.t || '').length, i;
    for (i = 0; b.cards && i < b.cards.length; i++) n += cardText(b.cards[i]).length;
    return clamp(0.7 + n / 17.5, 2.7, 9);
  }
  function build(opts) { // opts.full: 民の声を省かない「くわしい版」 / opts.pace: 自動送りの速さ(1 が標準、大きいほど速い)
    var chs = script(), steps = [], full = !!(opts && opts.full), pace = opts && opts.pace > 0 ? +opts.pace : 1;
    chs.forEach(function (c, ci) {
      c.beats = c.beats.filter(function (b) { return full || !b.more; });
      steps.push({ ch: ci, bi: -1, title: true, dur: 2.2 });
      c.beats.forEach(function (b, bi) {
        b.ch = ci; b.bi = bi;
        if (b.cards) b.cards = b.cards.filter(function (x) { return x && (full || !x.more); });
        if (!b.dur) b.dur = autoDur(b) / pace;
        steps.push(b);
      });
    });
    return { chs: chs, steps: steps };
  }

  // ───────────────────────── 再生 ─────────────────────────
  function play(host, onDone, opts) {
    if (!host || !available()) { if (onDone) try { onDone(); } catch (e) { /* 呼び出し側の都合 */ } return null; }
    if (S) end(true);
    opts = opts || {};
    var reduce = false; try { reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* 古い端末 */ }
    var use3d = !reduce && !opts.still && !!(TF.Diorama3D && TF.Diorama3D.available()), sc = build(opts);
    S = { host: host, onDone: onDone, opts: opts, steps: sc.steps, chs: sc.chs, i: -1, left: 0, dur: 1, t: 0, shownAt: 0, use3d: use3d, b3d: false, dio: null, stage: -1, focus: '', still: '',
      clipOn: false, clip: null, clipToken: 0, clipWait: 0, hold: false, downAt: 0, bEl: null, bMoved: false, bHome: null, ending: 0, raf: 0, last: 0, taps: 0, el: {} };
    host.hidden = false;
    host.setAttribute('role', 'dialog'); host.setAttribute('aria-label', '年代記');
    host.classList.remove('clip', 'static', 'pale');
    host.innerHTML = '<div class="cine-vis"><div class="cine-dio diorama"></div><div class="cine-still"><div class="cine-flock"></div></div></div><div class="cine-scrim"></div>' +
      '<div class="cine-head"><div class="cine-prog">' + sc.chs.map(function () { return '<i><b></b></i>'; }).join('') + '</div><p class="cine-chap"></p><button class="cine-skip" type="button">スキップ ▸▸</button></div>' +
      '<div class="cine-ui"><div class="cine-cards"></div><div class="cine-text" aria-live="polite"></div><p class="cine-hint"></p></div>' +
      '<div class="cine-title" hidden><b></b><h2></h2><p></p></div><div class="cine-veil"></div>';
    var el = S.el, q = function (s) { return host.querySelector(s); };
    el.vis = q('.cine-vis'); el.dio = q('.cine-dio'); el.still = q('.cine-still'); el.flock = q('.cine-flock'); el.prog = host.querySelectorAll('.cine-prog i b'); el.chap = q('.cine-chap'); el.skip = q('.cine-skip');
    el.ui = q('.cine-ui'); el.cards = q('.cine-cards'); el.text = q('.cine-text'); el.hint = q('.cine-hint'); el.title = q('.cine-title'); el.veil = q('.cine-veil');
    if (use3d) {
      try { S.dio = TF.Diorama3D.mount(el.dio, { stage: 0, orbit: true, angle: 0.4 }); } catch (e) { S.dio = null; }
      if (S.dio) { S.stage = 0; S.dio.onLaunch = function () { if (S && !S.clipOn && !S.still && !S.quiet) sfx('rocket', { gain: 0.3 }); }; } else S.use3d = use3d = false;
      S.onResize = function () { if (S && S.dio) { var land = host.clientWidth > host.clientHeight * 1.1; S.dio.shift(land ? 0.13 : 0, land ? 0 : 0.165); } }; // 文字の段を避けて、町を右か上へ寄せる
      if (S.dio) { S.onResize(); root.addEventListener('resize', S.onResize); }
    }
    S.b3d = use3d && !!(TF.Battle3D && TF.Battle3D.available());
    if (!use3d) { // 動かさない語り:空の色と、鳥たちの肖像だけ
      host.classList.add('static');
      el.flock.innerHTML = bird('dario', 'b56') + (D().BIRDS || []).map(function (b) { return bird(b.id, 'b56'); }).join('');
    }
    S.onTap = function (e) {
      if (!S || S.host !== host) return;
      if (e.target && e.target.closest && e.target.closest('.cine-skip')) { e.stopPropagation(); end(false); return; }
      if (S.downAt && performance.now() - S.downAt > 420) return; // 長押しは「止めて読む」。離しても進めない
      if (performance.now() - S.shownAt < 260) return; // 続けざまの二度押しで飛ばしすぎない
      S.taps++; next();
    };
    S.onKey = function (e) {
      if (!S || S.host !== host) return;
      if (e.key === 'Escape') { e.preventDefault(); end(false); }
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); if (performance.now() - S.shownAt >= 260) next(); }
    };
    S.onDown = function () { if (S) { S.hold = true; S.downAt = performance.now(); } };
    S.onUp = function () { if (S) S.hold = false; };
    host.addEventListener('pointerdown', S.onDown); host.addEventListener('pointerup', S.onUp); host.addEventListener('pointercancel', S.onUp); host.addEventListener('pointerleave', S.onUp);
    host.addEventListener('click', S.onTap);
    document.addEventListener('keydown', S.onKey, true);
    try { show(0, true); } catch (e) { if (root.console) root.console.error(e); end(false); return null; }
    S.last = performance.now(); S.raf = requestAnimationFrame(tick);
    return { skip: function () { if (S && S.host === host) end(false); } };
  }

  function tick(now) {
    if (!S) return;
    S.raf = requestAnimationFrame(tick);
    var dt = clamp((now - S.last) / 1000, 0, 0.1) * speed; S.last = now;
    if (document.hidden) return;
    S.t += dt;
    if (S.ending) { S.ending -= dt; if (S.ending <= 0) end(false); return; }
    if (S.hold && performance.now() - S.downAt > 180) return; // 押さえているあいだは送らない
    S.left -= dt;
    if (S.left <= 0) next();
  }
  function next() {
    if (!S || S.ending) return;
    if (S.i >= S.steps.length - 1) { // おしまい:暗くしてから閉じる
      S.ending = 1.3; S.el.veil.classList.add('top'); S.el.veil.style.transition = 'opacity 1.1s ease'; S.el.veil.style.opacity = '1'; return;
    }
    try { show(S.i + 1); } catch (e) { if (root.console) root.console.error(e); end(false); }
  }

  // 画の切り替え(絵にだけ暗幕を一瞬かぶせて、つなぎ目を隠す。文字は隠さない)
  function cut() { var v = S.el.veil; v.style.transition = 'none'; v.style.opacity = '1'; void v.offsetWidth; v.style.transition = 'opacity .5s ease'; v.style.opacity = '0'; }

  // 戦闘の画を映す枠
  function battleEl() {
    if (S.bEl) return S.bEl;
    var el = S.opts.battleHost || document.getElementById('battle');
    if (el && el !== S.host && !S.host.contains(el)) { S.bHome = { parent: el.parentNode, next: el.nextSibling }; S.el.vis.appendChild(el); S.bMoved = true; }
    else if (!el) { if (!ownClip) { ownClip = document.createElement('div'); ownClip.className = 'battle cine-clip'; ownClip.hidden = true; } el = ownClip; S.el.vis.appendChild(el); }
    S.bEl = el; return el;
  }
  function restoreBattle(s) { // 借りた #battle は必ず元の場所へ返す
    var el = s.bEl, h = s.bHome; if (!el) return; s.bEl = null;
    if (s.bMoved) { s.bMoved = false; try { h.parent.insertBefore(el, h.next && h.next.parentNode === h.parent ? h.next : null); } catch (e) { document.body.appendChild(el); } }
    else if (el.parentNode) el.parentNode.removeChild(el);
  }
  // 戦闘の画は、見せ場まで音なしで早送りしてから映す。その一瞬の引っかかりを隠すために、先に暗幕を下ろして二こま待つ
  function startClip(spec) {
    if (!S.b3d) return false;
    var token = ++S.clipToken, v = S.el.veil;
    S.clipOn = true; if (S.dio) S.dio.pause();
    v.style.transition = 'none'; v.style.opacity = '1';
    if (S.clipWait) cancelAnimationFrame(S.clipWait);
    S.clipWait = requestAnimationFrame(function () { if (!S || S.clipToken !== token) return; S.clipWait = requestAnimationFrame(function () { if (S && S.clipToken === token) beginClip(spec, token); }); });
    return true;
  }
  function beginClip(spec, token) {
    var el = battleEl(), p = null, v = S.el.veil;
    S.clipWait = 0; S.host.classList.add('clip');
    try { p = TF.Battle3D.play(el, spec, function () { clipDone(token); }); } catch (e) { p = null; if (root.console) root.console.error(e); }
    if (!S) return;
    if (!p) { S.b3d = false; if (S.clipOn && S.clipToken === token) { S.clipOn = false; S.clip = null; afterClip(); } return; }
    if (S.clipToken !== token) return;
    S.clip = p; void v.offsetWidth; v.style.transition = 'opacity .4s ease'; v.style.opacity = '0';
  }
  function clipDone(token) { if (!S || S.clipToken !== token || !S.clipOn) return; S.clipOn = false; S.clip = null; afterClip(); }
  function afterClip() { restoreBattle(S); S.host.classList.remove('clip'); if (S.dio) S.dio.resume(); cut(); }
  function stopClip() {
    if (!S.clipOn) return;
    var p = S.clip; S.clipToken++; // 始まるのを待っている画があれば取り消す
    if (S.clipWait) { cancelAnimationFrame(S.clipWait); S.clipWait = 0; }
    S.clipOn = false; S.clip = null;
    if (p) { try { p.skip(); } catch (e) { /* 終わっている */ } }
    if (S) afterClip();
  }

  function setStage(n, jump) {
    if (n === S.stage) return false;
    S.stage = n;
    if (S.dio) S.dio.setStage(n, { animate: !jump });
    return true;
  }
  function setFocus(key, angle, jump) { // 研究本部への寄りと戻りは、向きが飛ぶので暗幕でつなぐ。ほかは滑らかに動かす
    var hq = key === 'hq', was = S.focus === 'hq', hard = jump || hq || was;
    S.focus = key; S.dio.setOrbit(!hq);
    if (hard && !jump && !S.clipOn) cut();
    S.dio.focus(key, hq ? { angle: angle == null ? -0.5 : angle, animate: false } : (hard ? { angle: 0.45, animate: false } : null));
  }
  function setStill(kind) {
    var el = S.el.still; S.still = kind;
    if (!S.use3d) { // 動かさない語りでは、いつも空の色を敷いておく
      el.className = 'cine-still on ' + (kind === 'dark' ? 'dark' : 'sky');
      el.style.background = kind === 'dark' ? '' : (TF.Diorama3D && TF.Diorama3D.sky ? TF.Diorama3D.sky(Math.max(0, S.stage)) : '');
      return;
    }
    el.className = 'cine-still' + (kind ? ' on ' + kind : (el.className.indexOf('fog') >= 0 ? ' fog' : el.className.indexOf('dark') >= 0 ? ' dark' : '')); // 消えていくあいだも柄は残す
  }

  // 一拍を画面に出す
  function show(i, jump) {
    var st = S.steps[i], ch = S.chs[st.ch], el = S.el, k, changed = false, snd = null, opt = null;
    S.i = i; S.shownAt = performance.now(); S.left = S.dur = st.dur; S.quiet = !!st.quiet || (st.title && st.ch === S.chs.length - 1);
    if (st.title) { if (S.clipOn) stopClip(); k = S.steps[i + 1]; setStill(k && k.still ? k.still : ''); } // 扉は、次の拍の霧や暗転の上に出す
    else {
      if (st.clip) startClip(st.clip); else if (!st.hold && S.clipOn) stopClip();
      if (st.stage != null) changed = setStage(st.stage, jump);
      if (st.focus && S.dio && (st.focus !== S.focus || jump)) setFocus(st.focus, st.angle, jump);
      setStill(st.still || '');
    }
    // 章の扉
    el.title.hidden = !st.title; el.ui.hidden = !!st.title;
    if (st.title) {
      el.title.innerHTML = '<b>' + esc(ch.no) + '</b><h2>' + esc(ch.title) + '</h2><p>' + esc(ch.sub) + '</p>';
      el.title.className = 'cine-title' + (st.ch === S.chs.length - 1 ? ' last' : '');
    } else {
      el.cards.innerHTML = (st.cards || []).map(cardHTML).join('');
      el.text.className = 'cine-text' + (st.who ? ' say' : '') + (st.t ? '' : ' empty');
      el.text.innerHTML = st.t ? (st.who ? bird(st.who, 'b56', st.asi) + '<div><b class="ct-name">' + esc(nameOf(st.who)) + '</b><p>' + esc(st.t) + '</p></div>' : '<p>' + esc(st.t) + '</p>') : '';
      el.ui.className = 'cine-ui' + (st.center ? ' center' : '');
      el.hint.textContent = S.taps < 2 && i < 6 ? '押すと次へ ・ 長押しで止まる' : '▼';
    }
    el.chap.innerHTML = '<b>' + esc(ch.no) + '</b>' + esc(ch.title);
    S.host.classList.toggle('pale', S.stage === 8 && S.still !== 'dark' && !st.title); // 白い町の上では、上の帯の字を濃くする
    for (k = 0; k < el.prog.length; k++) el.prog[k].style.width = (k < st.ch ? 100 : k > st.ch ? 0 : Math.round((st.bi + 2) / (ch.beats.length + 1) * 100)) + '%';
    // 音
    if (jump || st.quiet) return;
    if (st.sfx) { snd = typeof st.sfx === 'string' ? st.sfx : st.sfx[0]; opt = typeof st.sfx === 'string' ? null : st.sfx[1]; }
    else if (st.title) { snd = st.ch === S.chs.length - 1 ? null : 'taiko'; opt = { gain: 0.5 }; }
    else if (st.clip) snd = null; // 戦闘の画が自分で鳴らす
    else if (changed) snd = 'build';
    else if (st.who === 'dario') snd = 'dario';
    else if (st.who) { snd = 'chirp'; opt = { n: 2 }; }
    else if ((st.cards || []).some(function (c) { return c.k === 'nation'; })) snd = 'stamp';
    else if ((st.cards || []).some(function (c) { return c.k === 'policy'; })) snd = 'policy';
    else snd = 'select';
    sfx(snd, opt);
  }

  // 飛び先までの時代と寄りを数え直して、その拍を出す(検査用)
  function jumpTo(i) {
    if (!S) return false;
    i = clamp(i, 0, S.steps.length - 1);
    var stage = 0, focus = 'all', angle = null, k, st;
    for (k = 0; k <= i; k++) { st = S.steps[k]; if (st.stage != null) stage = st.stage; if (st.focus) { focus = st.focus; angle = st.angle; } }
    if (S.clipOn) stopClip();
    S.ending = 0; S.el.veil.classList.remove('top'); S.el.veil.style.transition = 'none'; S.el.veil.style.opacity = '0';
    setStage(stage, true);
    if (S.dio) setFocus(focus, angle, true);
    show(i, true); return true;
  }

  function end(silent) {
    var s = S; if (!s) return; S = null;
    cancelAnimationFrame(s.raf);
    if (s.clipWait) cancelAnimationFrame(s.clipWait);
    if (s.clip) { s.clipOn = false; try { s.clip.skip(); } catch (e) { /* 終わっている */ } }
    restoreBattle(s);
    try { if (s.dio) s.dio.dispose(); } catch (e) { /* 破棄済み */ }
    document.removeEventListener('keydown', s.onKey, true); if (s.onResize) root.removeEventListener('resize', s.onResize);
    s.host.removeEventListener('click', s.onTap); s.host.removeEventListener('pointerdown', s.onDown); s.host.removeEventListener('pointerup', s.onUp); s.host.removeEventListener('pointercancel', s.onUp); s.host.removeEventListener('pointerleave', s.onUp);
    s.host.innerHTML = ''; s.host.hidden = true; s.host.classList.remove('clip', 'static', 'pale');
    if (!silent && s.onDone) try { s.onDone(); } catch (e) { if (root.console) root.console.error(e); }
  }

  TF.Chronicle = {
    available: available, play: play,
    active: function () { return !!S; },
    // ── 検査用 ──
    _next: function () { if (!S) return false; S.shownAt = 0; next(); return true; },
    _goto: function (ch, beat) { if (!S) return false; for (var i = 0; i < S.steps.length; i++) if (S.steps[i].ch === ch && S.steps[i].bi === (beat == null ? -1 : beat)) return jumpTo(i); return false; },
    _info: function () {
      if (!S) return { active: false };
      var st = S.steps[S.i], ch = S.chs[st.ch];
      return { active: true, i: S.i, total: S.steps.length, ch: st.ch, no: ch.no, title: ch.title, beat: st.bi, isTitle: !!st.title, stage: S.stage, focus: S.focus, still: S.still, clip: S.clipOn, mode: S.use3d ? '3d' : 'static',
        battle: S.b3d ? (S.bMoved ? 'borrowed #battle' : (S.bEl ? 'own' : 'idle')) : 'off', left: S.left, dur: S.dur, ending: S.ending > 0, t: S.t, speed: speed };
    },
    _speed: function (k) { speed = k > 0 ? +k : 1; return speed; },
    _duration: function (opts) { if (!available()) return 0; return build(opts).steps.reduce(function (a, s) { return a + s.dur; }, 0) + 1.3; },
    _chapters: function (opts) { if (!available()) return []; return build(opts).chs.map(function (c) { return { no: c.no, title: c.title, sub: c.sub, beats: c.beats.length }; }); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
