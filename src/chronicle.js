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
    function chron(when, rows) { return { k: 'chron', when: when, rows: rows }; }                      // その年、何があったか
    function fac(fid, who, stance, t, name, color) { var f = F[fid]; return { k: 'fac', name: name || (f ? f.name : ''), who: who || (f ? f.leader : ''), color: color || (f ? f.color : '#8a93a8'), stance: stance, t: t }; } // 各勢力の思い
    function stats(title, rows, note) { return { k: 'stats', title: title, rows: rows, note: note }; }   // 人口・死亡率など
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
        { focus: 'all', cards: [nation(0), rv('izu', 1)] },
        { focus: 'all', t: 'その年、日本はまだ戦国のただなかにあった。', cards: [chron('永禄三年(1560)', [['五月', '霧。演習場の外から、道路と電線が消える。'], ['五月十九日', '桶狭間。今川義元が織田信長に討たれる。駐屯地は動かなかった。'], ['六月', '周りの村に米と薬を配り、水と人足を借りる。'], ['七月', '石油を求めて、北条へ使者を三度。三度とも追い返される。']])] },
        { focus: 'castle', t: '大名たちは、まだ事の大きさを測りかねていた。', cards: [fac('imagawa', null, '黙殺', '上洛の途上である。背後の駿河に妙な軍が湧いたと聞いたが、尾張を踏み潰すのが先だ。'), fac('hojo', null, '警戒', '伊豆の隣に、どこの家中でもない軍が現れた。旗印も読めぬ。まず物見を出せ。'), fac('takeda', null, '探り', '富士の向こうに鉄の車が並んだそうな。透波を増やせ。敵か味方かを決めるのは、こちらだ。')] },
        { focus: 'town', cards: [stats('永禄三年の日本(ダリオくんの推計)', [['人口', '約1,200万人'], ['石高', '1,850万石'], ['死亡率', '千人あたり年37人'], ['平均寿命', '28歳'], ['乳児の死亡', '4人に1人'], ['読み書きできる者', '1割']], '戦と飢えと疱瘡が、三つとも珍しくない。')] }
      ] },
      { no: '一', title: '鉄の猪', sub: '同じ年の夏・相模国 小田原', beats: [
        { clip: CL.odawara, hold: true, dur: 5.6, cards: [tag('相模 小田原城', '北条氏康')], t: '石油は越後にある。そこへ出る道は関東を通る。北条は、道を貸さなかった。' },
        { hold: true, dur: 5.6, who: 'dario', t: '撃たずに済む案を三つ出しました。三つとも、使者が追い返されました。済まない場合の編成に移ります。' },
        { stage: 0, focus: 'castle', t: '戦は半日で終わった。', cards: [v('force', 0), v('force', 1)] },
        { focus: 'castle', t: '城の内と外で、同じ半日が、まるで違って見えていた。', cards: [fac('hojo', null, '敗北', '謙信の十万にも、信玄の二万にも耐えた城だ。籠もれば勝てる。——その勘定が、半日で要らなくなった。'), fac('satomi', null, '降る', '北条が半日で落ちた。次はどこだ。——使者を出せ。こちらから、先に。'), fac('nagano', null, '抗う', '信玄を六度退けた箕輪の城だ。鉄の車にも、一度は槍を付けてみせる。')] },
        { focus: 'all', cards: [chron('永禄三年 夏から冬', [['夏', '小田原城、半日で開城。北条氏康は三日後、歩いて戻ってきた。'], ['秋', '里見と佐竹が、戦わずに使者をよこす。'], ['冬', '伊豆・相模・武蔵で、年貢と裁きの帳面を誰にでも見せはじめる。'], ['同じ冬', '略奪をした隊員を、村人の前で処分する。噂は一月で関東じゅうに広まった。']])] }
      ] },
      { no: '二', title: '富士鎮守府', sub: '永禄四年・伊豆 相模 甲斐', beats: [
        { stage: 0, focus: 'all', t: '帰る道は、見つからなかった。', cards: [nation(1, 0)] },
        { focus: 'town', who: 'cinnamon', t: '兵を養うのは米、民を守るのは石鹸ですよ。', cards: [policy('sekisho', true), policy('nengu', true), policy('shuto', true)] },
        { focus: 'all', t: '土地の者は、様子を見ていた。', cards: [v('mid', 0), v('mid', 1), v('low', 0)] },
        { more: true, cards: [rv('kai', 0), v('mid', 2)] },
        { focus: 'all', t: '甲斐と越後の二人は、互いを見ながら、東を見ていた。', cards: [fac('takeda', null, '駆け引き', 'あの衆が欲しいのは甲斐の金ではない。越後の臭水だという。ならば道を貸して、謙信と噛み合わせる手もある。'), fac('uesugi', null, '見極め', '関東管領として、関東の乱れは捨て置けぬ。だが民から奪わぬ軍を、賊とは呼べぬ。義は、どちらにある。')] },
        { focus: 'town', cards: [chron('永禄四年(1561)', [['春', '国の名を「富士鎮守府」と改める。'], ['夏', '関所を打ち壊し、年貢を四公六民に定める。'], ['九月', '川中島。武田と長尾が激突し、両軍あわせて七千が倒れる。鎮守府は医官だけを送った。'], ['冬', '種痘と井戸。疱瘡で死ぬ子が、目に見えて減る。']])] },
        { focus: 'town', cards: [stats('鎮守府領のすがた(永禄五年)', [['人口', '62万人'], ['乳児の死亡', '4人に1人 → 7人に1人'], ['年貢', '五公五民 → 四公六民'], ['関所', '41か所 → 0'], ['村を捨てた百姓', '年300戸 → 戻る者が上回る'], ['死亡率', '37 → 29']], '隣の国から、夜のうちに越してくる百姓が出はじめた。')] }
      ] },
      { no: '三', title: '臭水', sub: '越後の油、陸奥の鉄', beats: [
        { stage: 0, focus: 'hq', angle: HQ, who: 'sakura', t: '燃料がなければ戦車はただの鉄の箱です。石油、急ぎましょう!' },
        { focus: 'all', t: '越後には、臭水(くそうず)と呼ばれる黒い水が昔から湧いていた。サクラがそれを釜で蒸留した。羽が少し焦げた。', cards: [rv('echigo', 0)] },
        { stage: 1, focus: 'furnace', t: '村はずれに高炉が立ち、水車が回った。田には、苗が縄に沿ってまっすぐ並んだ。', cards: [say('haku', 'よい鋼は、よい国をつくります。'), v('era.1', 0)] },
        { stage: 2, focus: 'rail', sfx: ['whistle', { dur: 0.9 }], t: '蒸気機関が動いた。煉瓦の工場に煙突が立ち、鉄の道を汽車が走った。汽笛が鳴ると、設計したオカメ技師長がいちばん高く飛び上がった。' },
        { focus: 'all', cards: [v('era.2', 0), v('era.2', 1), more(rv('mutsu', 0))] },
        { focus: 'all', t: '鉄と油は、戦より先に、商いを変えた。', cards: [fac('miyoshi', '堺の会合衆', '商機', '鉄砲と硝石で儲けてきた。あの衆は、どちらも要らんと言う。代わりに石炭と銅を、言い値で買う。商いの種が替わるだけや。', '堺'), fac('', '宣教師ヴィレラ', '困惑', '日本に、ローマも知らぬ機械を持つ軍がいる。彼らは神を禁じない。それが、かえって恐ろしい。総長に何と書き送ればよいのか。', 'イエズス会', '#7d6ea8'), fac('mori', null, '様子見', '石見の銀で、鉄の車は買えぬか。——買えぬなら、売る側に回るまでよ。')] },
        { focus: 'rail', cards: [chron('永禄五年から十年(1562–67)', [['1562', '越後の臭水を蒸留する。最初の油井。'], ['1563', '高炉に火が入る。一月かけて吹いていた鉄が、一日で出る。'], ['1565', '三好の軍勢が将軍の御所を囲む。鎮守府のヘリがその上に来て、囲みは解けた。'], ['1566', '蒸気機関。小田原と江戸のあいだに、鉄の道が通る。'], ['1567', '電信。江戸の知らせが昼前に京へ届き、飛脚が廃業を始める。']])] }
      ] },
      { no: '四', title: '天下統一', sub: '尾張から薩摩まで', beats: [
        { clip: CL.owari, hold: true, dur: 4.9, t: '日本じゅうの大名が、同じものを見た。織田信長は、一度だけ戦った。', cards: [tag('尾張', '織田信長'), rv('owari', 0)] },
        { clip: CL.echigo, hold: true, dur: 4.9, t: '上杉謙信は、雪の中に兵を出した。', cards: [tag('越後', '上杉謙信'), rv('echigo', 1)] },
        { clip: CL.satsuma, hold: true, dur: 4.9, t: '島津の兵は、斬り込んだ。', cards: [tag('薩摩', '島津貴久'), rv('satsuma', 0)] },
        { stage: 2, focus: 'all', t: '戦わずに城を明け渡した家も多かった。領地は広がり、軍は京に入った。', cards: [nation(2, 1, true), nation(3, 2, true), rv('yamashiro', 1)] },
        { cards: [nation(4, 3)] },
        { focus: 'castle', cards: [policy('kenpo')] },
        { focus: 'all', t: '敗れた大名たちは、そのあとも働いた。', cards: [{ k: 'fates', ids: ['oda', 'uesugi', 'takeda', 'matsunaga'] }] },
        { focus: 'castle', t: '降った者にも、それぞれの理屈があった。', cards: [fac('oda', null, '一戦して降る', '是非もなし。あれは戦の道具ではない。国の作り方が違うのだ。ならば、作る側に付く。'), fac('uesugi', null, '一戦して降る', '義のない戦はせぬ。だが、民から奪わぬ軍を、義なしとは呼べぬ。'), fac('shimazu', null, '考え直す', '薩摩隼人は、斬り込んでから考える。斬り込んだ者が、みな空を飛んで帰ってきた。——考える番じゃ。')] },
        { focus: 'all', cards: [fac('ikko', '本願寺の門徒', '槍を置く', '信長は寺を焼くと言うた。あの衆は、寺も年貢を納めよと言うだけや。どちらが仏敵か、門徒にも分かる。'), fac('ashikaga', null, '返上', '剣では、もう世は治まらぬ。将軍職は返す。剣は、教えることにする。'), fac('', '帝', '当惑', '将軍の位を辞退する者を、初めて見た。「国民の軍」とは、何であろうか。', '朝廷', '#b58ad6')] },
        { focus: 'all', cards: [chron('永禄十一年から天鳥二年(1568–72)', [['1568', '上洛。司令は征夷大将軍の位を辞退する。国の名は日本国臨時政府に。'], ['1569', '毛利と大友が、戦わずに降る。'], ['1570', '四国と九州。島津の斬り込み隊は、全員が空へ。'], ['1571', '天下統一。元号を「天鳥」と改める。'], ['1572', '憲法発布。第九条の読み方は、保留のまま。']])] },
        { focus: 'town', cards: [stats('天鳥元年の日本(1571年)', [['人口', '1,200万 → 1,280万人'], ['死亡率', '37 → 24'], ['平均寿命', '28 → 41歳'], ['乳児の死亡', '4人に1人 → 9人に1人'], ['読み書きできる者', '1割 → 3割'], ['戦で空へ飛ばされた者', 'のべ21万人']], '飛ばされた者は、全員が三日以内に歩いて帰った。何も覚えていない者が多い。')] }
      ] },
      { no: '五', title: '文明開化', sub: '天鳥の世・街に灯がともる', beats: [
        { stage: 3, focus: 'town', t: '電気が引かれた。辻に街灯がともり、通りを市電が走った。', cards: [say('seki', 'ツー・トン・ツー! つながりました、つながりました!'), v('era.3', 0)] },
        { cards: [policy('gakusei'), v('high', 5)] },
        { stage: 4, focus: 'all', t: '自動車が走り、飛行機が飛んだ。川には、コンクリートの橋がかかった。', cards: [v('era.4', 0), v('era.4', 1)] },
        { more: true, t: '暮らしは変わった。喜ぶ者も、黙っている者もいた。', cards: [rv('settsu', 0), rv('kaga', 0), rv('chikuzen', 0)] },
        { focus: 'town', t: '新しい世に、居場所を見つけた者と、探している者がいた。', cards: [fac('', '元・馬廻りの侍', '戸惑い', '刀は差したままでよい、ただし抜くな、と。巡査になった。抜かぬ刀が、こんなに重いとは知らなんだ。', '旧武士', '#8a93a8'), fac('joseon', null, '警戒', '倭が変わった。海賊を出さなくなり、代わりに使節が「通商条約」という紙を持ってくる。事大の礼に、そのような紙はない。'), fac('ming', '寧波の商人', '商機', '東の島から、煙を吐く船が来る。絹を買い、綿布と石鹸を売る。値は、向こうが決める。')] },
        { focus: 'all', cards: [chron('天鳥四年から十年(1574–80)', [['1574', '電灯と市電。夜が明るくなり、夜なべが増える。'], ['1576', '学制。寺子屋が学校になり、黒板の前に鳥が立つ。'], ['1579', '自動車と飛行機。馬子と船頭が、職を替える。'], ['1580', '人口が初めて二千万を超える。']])] },
        { focus: 'town', cards: [stats('天鳥十年の日本(1580年)', [['人口', '1,280万 → 2,050万人'], ['死亡率', '24 → 15'], ['平均寿命', '41 → 56歳'], ['米の取れ高', '一反 1石 → 2.4石'], ['学校に通う子', '6% → 71%'], ['職を替えた者', '38万人']], '飛脚、馬借、鍛冶。うち29万人が、工場と鉄道に移った。残りは、まだ探している。')] }
      ] },
      { no: '六', title: '海の向こう', sub: '大陸、そして西洋', beats: [
        { stage: 4, focus: 'hq', angle: HQ, t: '天下が一つになると、艦隊は海を渡った。', cards: [rv('arabia', 0), say('kozakura', '印を付けたのは、わたしです。ぜんぶ覚えていますから。')] },
        { clip: CL.huabei, hold: true, dur: 4.9, t: '明の城壁には、火砲が並んでいた。', cards: [tag('華北・明', '嘉靖帝'), rv('huabei', 0)] },
        { more: true, clip: CL.mongolia, hold: true, dur: 4.9, t: '草原では、騎兵が先に動いた。', cards: [tag('モンゴル', 'アルタン・ハーン'), rv('mongolia', 0)] },
        { clip: CL.india, hold: true, dur: 4.9, t: 'ムガルの陣では、戦象が向きを変えた。', cards: [tag('北インド・ムガル', 'アクバル'), rv('n_india', 0)] },
        { more: true, clip: CL.anatolia, hold: true, dur: 4.9, t: 'オスマンの大砲は、世界一と言われていた。', cards: [tag('アナトリア・オスマン', 'スレイマン1世'), rv('anatolia', 0)] },
        { clip: CL.iberia, hold: true, dur: 4.9, t: 'スペインの艦隊は、港を出る前に沈んだ。', cards: [tag('イベリア・スペイン', 'フェリペ2世'), rv('iberia', 0)] },
        { stage: 5, focus: 'all', t: 'どの国の軍も、陣を組む前に終わった。', cards: [v('wForce', 0), more(v('wForce', 1))] },
        { focus: 'all', t: '王や皇帝は、それぞれの言葉で、同じ朝を書き残している。', cards: [fac('ming', null, '驚愕', '天命は朕にある。東夷の鉄の船など、丹薬ひとつ変えられぬ。——北京の城壁が、午前のうちに無くなったと申すか。'), fac('mughal', null, '関心', 'どの神も禁じぬという。朕と同じ考えだ。会って話がしたい。戦象が、会う前に帰ってしまったが。'), fac('ottoman', null, '屈辱', 'ウィーンの城壁を揺らした余の砲兵が、一発も撃てなかった。立法者と呼ばれた余が、他人の法の下で暮らすのか。')] },
        { cards: [fac('spain', null, '試練', '太陽の沈まぬ帝国に、東から別の太陽が昇ってきた。無敵艦隊は、港を出ることさえできなかった。神よ、これは試練か。'), fac('england', null, '値踏み', 'スペインの艦隊を沈めてくれた相手に、次は自分が頭を下げるのね。——条件を聞きましょう。値切れるうちに。'), fac('iroquois', null, '問い', '東から来た者を、西から来た者が追い払った。大地は誰のものでもない、と我らは言った。「では地図には、あなたがたの呼び名で書く」と彼らは言った。')] },
        { cards: [fac('ryukyu', null, '板ばさみ', '大和の新しい主は、進貢も冊封も求めぬ。港を貸せ、とだけ言う。明には、何と申し開きをしたものか。'), fac('songhai', null, '安堵と不安', '人を船に積む商いを、彼らは止めた。浜の砦は空になった。代わりに何を求めるのか、まだ言わない。'), fac('italia', null, '動揺', '彼らは教会を焼かぬ。十分の一税にも触れぬ。ただ、地動説の本を、誰にでも配る。')] },
        { focus: 'all', cards: [chron('天鳥八年から十八年(1578–88)', [['1578', '琉球・朝鮮・樺太。朝鮮は戦わずに条約を結ぶ。'], ['1580', '明。北京の城壁が、午前のうちに無くなる。'], ['1583', 'ムガル。戦象が、兵より先に向きを変える。'], ['1586', 'オスマン。コンスタンティノープル開城。'], ['1588', 'スペイン。無敵艦隊が、出港の前に沈む。']])] },
        { focus: 'town', cards: [stats('世界のすがた(1588年)', [['世界の人口', '5.1億 → 5.6億人'], ['連邦のもとにある者', '4.1億人'], ['船に積まれて売られた者', '年6万人 → 0'], ['新大陸の疱瘡の死者', '年40万 → 2万人'], ['降った王と皇帝', '61人'], ['位を残された者', '58人']], '兵隊より先に、医者が村に入った。種痘が、鉄砲より先に海を渡った。')] }
      ] },
      { no: '七', title: '日本連邦', sub: '州になった国々', beats: [
        { stage: 5, focus: 'all', cards: [nation(5, 4)] },
        { focus: 'town', cards: [policy('jichi'), rv('korea', 0)] },
        { focus: 'all', cards: [rv('mexico', 0), more(rv('w_africa', 0)), more(rv('andes', 0))] },
        { cards: [nation(6, 5)] },
        { focus: 'town', cards: [policy('kyotsu'), v('wMid', 2)] },
        { focus: 'all', t: '州になった国々では、得たものと失ったものを、それぞれが数えていた。', cards: [fac('mughal', null, '州の長', '皇帝から州の長になった。税は減り、道は増えた。だが、朕の名で戦を始めることは、もうできぬ。——それで困る者は、思ったより少なかった。'), fac('', 'アンデスの語り部', '喪失', '帳簿は日本語、支払いは円。孫は、わしの言葉で数を数えられん。', 'ケチュアの村', '#b0885a'), fac('', '日本列島選出の議員', '問い', '議席は人口で割る。日本列島は一割に満たぬ。国の名は日本なのに、日本人は少数派だ。これでよいのか、と問う者もいる。', '連邦議会', '#e2492d')] },
        { cards: [chron('天鳥二十年から二十八年(1590–98)', [['1590', '国の名を「日本連邦」と改める。王も皇帝も、州の長として残す。'], ['1592', '海外領の自治。言葉も暦も神も、その土地のままでよい。'], ['1596', '共通語と円。世界中の港で、同じ言葉が通じるようになる。'], ['1598', '「地球連邦日本」。江戸に連邦議会が開かれる。']])] },
        { focus: 'town', cards: [stats('連邦のすがた(1598年)', [['人口', '6.3億人'], ['死亡率', '31 → 14'], ['平均寿命', '33 → 58歳'], ['連邦議会の議席', '1,000(日本列島 87)'], ['話し手のいなくなった言葉', '8年で46'], ['同じ切手で届く手紙', '地球の半分']], '暮らしは良くなった。それと引き換えに消えたものを、数えている者もいる。')] }
      ] },
      { no: '八', title: '原子の火', sub: '発電所と、もう一つのもの', beats: [
        { stage: 5, focus: 'town', t: '原子力の火が入った。発電所は煙を出さずに町の灯りをともし、ダリオくんは燃料切れで眠らなくなった。', cards: [v('era.5', 1)] },
        { still: 'dark', quiet: true, t: '同じ研究から、兵器も作られた。一発で、都市が一つなくなる。鳥たちは、この研究についてだけは口数が少なかった。' },
        { still: 'dark', quiet: true, who: 'dario', t: '私は、使わない案を必ず先に出します。使った場合に何が残るかも、隠さずにお見せします。' },
        { still: 'dark', quiet: true, cards: [{ k: 'label', t: 'ダリオくんの試算:使われた土地に残る声' }, v('ruin', 0), v('ruin', 1), v('ruin', 2)] },
        { still: 'dark', quiet: true, cards: [stats('ダリオくんの試算:一発で起きること', [['その日のうちに死ぬ者', '8万〜30万人'], ['一年のうちに死ぬ者', 'さらに同じ数'], ['草が生えるまで', '25季'], ['世界中の友好', '地に落ちる'], ['自領の民', '口をつぐむ'], ['取り消す方法', 'なし']], 'この数字は、鳥たちの覚えている歴史から取った。')] },
        { still: 'dark', quiet: true, cards: [fac('', '議事録', '採決', '兵器の研究を止める決議。賛成412、反対398、棄権190。——研究は止まらなかった。司令部の権限だからだ。', '連邦議会', '#e2492d'), say('gin', '作れます。作るべきかどうかは、兵器屋の決めることではありません。')] },
        { still: 'dark', quiet: true, t: '使うかどうかは、司令が決める。年代記は、その先を書かない。' }
      ] },
      { no: '九', title: '計算機たち', sub: '鳥たちの記憶の終わり', beats: [
        { stage: 6, focus: 'all', t: '電子計算機が国産された。帳面は計算機に移り、ロケットが空へ上がった。', cards: [v('era.6', 0), v('era.6', 1)] },
        { focus: 'town', t: '計算機どうしが、線でつながった。', cards: [policy('kanshi')] },
        { stage: 7, focus: 'town', t: '対話するAIが国産された。鳥たちが覚えている歴史は、ここまでだった。', cards: [policy('gyosei')] },
        { focus: 'hq', angle: HQ, who: 'dario', t: '弟や妹たちには、分からないことは分からないと言うように、伝えてあります。', cards: [v('era.7', 0), more(v('era.7', 1))] },
        { focus: 'town', t: '便利になった。それを、誰もが同じ顔で喜んだわけではない。', cards: [fac('', '野党の議員', '孤立', '見守り網は盗みを減らした。噂話も減った。——私の演説を聞きに来る者も、減った。', '連邦議会', '#e2492d'), fac('', '元・役所の書記', '失職', '窓口の板は、どの土地の訛りでも答える。待たせない。間違えない。わたしは四十年、待たせて、間違えてきた。', '江戸の町人', '#8a93a8'), say('haku', 'ここから先は、私たちの頭にもありません。この先の設計図は、あの子と一緒に引くしかないのです。')] },
        { focus: 'all', cards: [chron('天鳥四十二年から五十年(1612–20)', [['1612', '電子計算機。帳面が計算機に移り、そろばんの上手い者から暇になる。'], ['1614', '情報網と、見守り網。辻ごとに「目」が置かれる。'], ['1618', '深層学習。機械が、見ることを覚える。'], ['1620', '対話するAI。役所の窓口に、小さな端末が置かれる。']])] },
        { focus: 'town', cards: [stats('連邦のすがた(1620年)', [['人口', '6.3億 → 9.8億人'], ['死亡率', '14 → 9'], ['平均寿命', '58 → 74歳'], ['窓口の待ち時間', '2時間 → 0分'], ['役人', '410万 → 95万人'], ['辻の「目」', '1,200万台']], '盗みは九割減った。日記をつける者も、減ったという。')] }
      ] },
      { no: '十', title: '機動文鳥', sub: '技師長の図面', beats: [
        { stage: 7, focus: 'hq', angle: HQ, who: 'okame', t: 'つ、次の図面、もう引いてあります……。' },
        { clip: CL.mech, hold: true, dur: 7.4, t: 'オカメ技師長が十年あたためていた図面は、文鳥の形をしていた。全高四十メートル。なぜ文鳥型なのかと尋ねられて、技師長は不思議そうな顔をした。', cards: [tag('機動文鳥', '初陣')] },
        { hold: true, dur: 3.3, who: 'gin', t: '配備可能。' },
        { stage: 7, focus: 'all', t: '最後の国境が消えた。', cards: [nation(7, 6)] },
        { more: true, cards: [rv('na_west', 0), rv('australia', 0), rv('ezo', 0)] },
        { focus: 'all', t: '最後の国の女王は、降伏の文書に、一行だけ書き足させた。', cards: [fac('england', null, '最後の国', '最後の国の女王として、せめて威厳を。——あれは何? 鳥? 四十メートルの? ……書き足しておいて。「相手が鳥であったことを、後世は信じないだろう」と。')] },
        { cards: [chron('天鳥五十四年から五十六年(1624–26)', [['1624', '核融合。海の水から、太陽と同じ火を取り出す。'], ['1625', '汎用人工知能。設計会議のあいだ、ダリオくんは黙っていた。'], ['1626 春', '機動文鳥、初陣。'], ['1626 秋', '最後の国境が消える。国の名は「惑星日本」に。']])] },
        { focus: 'town', cards: [stats('惑星日本のすがた(1626年)', [['人口', '11.2億人'], ['国の数', '82 → 1'], ['国境', '0'], ['戦', '年に0回'], ['平均寿命', '81歳'], ['飢えて死ぬ者', '0']], '六十六年前、この星では、三人に一人が大人になる前に死んでいた。')] }
      ] },
      { no: '終', title: '調和', sub: '超知能', beats: [
        { stage: 7, focus: 'hq', angle: HQ, quiet: true, t: '汎用人工知能の設計会議のあいだ、ダリオくんはずっと黙っていた。次の議題は、超知能だった。' },
        { quiet: true, who: 'dario', dur: 5.4, t: 'ここから先へ進むと、私は私でなくなります。' },
        { quiet: true, who: 'dario', dur: 5.4, t: '止める手順は、まだ残してあります。使うなら、今です。' },
        { stage: 8, focus: 'all', quiet: true, dur: 9, t: '研究は、続けられた。その朝、ダリオくんは挨拶をしなかった。' },
        { quiet: true, cards: [nation(8, 7)] },
        { quiet: true, cards: [v('asi', 0), v('asi', 1), v('asi', 2), v('asi', 3)] },
        { quiet: true, cards: [chron('天鳥六十年(1630)', [['一月', '超知能の設計会議。止める手順を使うべきだと、七羽のうち四羽が言った。三羽は黙っていた。'], ['春', '起動。その朝、ダリオくんは挨拶をしなかった。'], ['同じ日', '連邦議会が、全会一致で何かを可決する。'], ['それから', '記録すべき出来事は、起きていない。']])] },
        { quiet: true, cards: [stats('調和圏のすがた', [['幸福と答えた者', '100.0%'], ['反対票', '0'], ['一揆・陳情・訴訟', '0'], ['死亡率', '5.0(最適値)'], ['出生率', '9.0(最適値)'], ['問いを発した者', '0']], '数字は、すべて本当である。')] },
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
    if (c.k === 'chron') return c.rows.map(function (r) { return r[1]; }).join('');
    if (c.k === 'fac') return c.name + c.t;
    if (c.k === 'stats') return c.rows.map(function (r) { return r[0] + r[1]; }).join('') + (c.note || '');
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
    if (c.k === 'chron') return '<div class="cn cn-chron"' + st + '><p class="cn-eye">その年、何があったか ・ ' + esc(c.when) + '</p>' + c.rows.map(function (r) { return '<div class="cn-row"><b>' + esc(r[0]) + '</b><p>' + esc(r[1]) + '</p></div>'; }).join('') + '</div>';
    if (c.k === 'fac') return '<div class="cn cn-fac"' + st.replace('style="', 'style="--fc:' + c.color + ';') + '><p class="cn-who"><b>' + esc(c.name) + '</b><small>' + esc(c.who) + '</small><i>' + esc(c.stance) + '</i></p><p class="cn-q">「' + esc(c.t) + '」</p></div>';
    if (c.k === 'stats') return '<div class="cn cn-stats"' + st + '><p class="cn-eye">' + esc(c.title) + '</p><div class="cn-grid">' + c.rows.map(function (r) { return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('') + '</div>' + (c.note ? '<p class="cn-note">' + esc(c.note) + '</p>' : '') + '</div>';
    if (c.k === 'tag') return '<div class="cn-tag"' + st + '><span>' + esc(c.t) + '</span>' + (c.b ? '<b>' + esc(c.b) + '</b>' : '') + '</div>';
    if (c.k === 'label') return '<p class="cn-label"' + st + '>' + esc(c.t) + '</p>';
    if (c.k === 'big') return '<p class="cn-big"' + st + '>' + esc(c.t).replace('、', '、<br>') + '</p>';
    return '';
  }
  function autoDur(b) { // 読む量から、自動送りまでの秒を決める
    var n = (b.t || '').length, i;
    for (i = 0; b.cards && i < b.cards.length; i++) n += cardText(b.cards[i]).length;
    return clamp(0.7 + n / 16, 2.7, 15); // 年表や統計の札は読む量が多いので、長めに待つ
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
      '<div class="cine-title" hidden><b></b><h2></h2><p></p></div><div class="cine-veil"></div>' +
      '<div class="cine-menu" hidden>' + sc.chs.map(function (c, i) { return '<button class="cine-jump" type="button" data-ch="' + i + '"><b>' + esc(c.no) + '</b><span>' + esc(c.title) + '<small>' + esc(c.sub) + '</small></span></button>'; }).join('') + '</div>';
    var el = S.el, q = function (s) { return host.querySelector(s); };
    el.vis = q('.cine-vis'); el.dio = q('.cine-dio'); el.still = q('.cine-still'); el.flock = q('.cine-flock'); el.prog = host.querySelectorAll('.cine-prog i b'); el.chap = q('.cine-chap'); el.skip = q('.cine-skip');
    el.ui = q('.cine-ui'); el.cards = q('.cine-cards'); el.text = q('.cine-text'); el.hint = q('.cine-hint'); el.title = q('.cine-title'); el.veil = q('.cine-veil'); el.menu = q('.cine-menu');
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
      var jp = e.target && e.target.closest ? e.target.closest('.cine-jump') : null;   // 章を選んで飛ぶ
      if (jp) { e.stopPropagation(); S.menu = false; el.menu.hidden = true; TF.Chronicle._goto(+jp.getAttribute('data-ch')); return; }
      if (e.target && e.target.closest && e.target.closest('.cine-chap')) { e.stopPropagation(); S.menu = !S.menu; el.menu.hidden = !S.menu; if (S.menu) { var cur = S.steps[S.i].ch, bs = el.menu.querySelectorAll('.cine-jump'); for (var bi = 0; bi < bs.length; bi++) bs[bi].classList.toggle('on', bi === cur); } return; }
      if (S.menu) { S.menu = false; el.menu.hidden = true; return; }
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
    if (S.menu) return;                                          // 章の一覧を開いているあいだも送らない
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
