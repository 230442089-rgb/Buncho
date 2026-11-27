/* 天下布鳥 — 静的データ(地域・勢力・技術・部隊・施設・参謀団)
 * ブラウザでは window.TF.DATA、Node では module.exports で参照する。 */
(function (root) {
  'use strict';

  // ───────────────────────── 参謀団(文鳥人・インコ人) ─────────────────────────
  // field: 材=材料・冶金 / 化=化学 / 生=農学・医学 / 電=電気・通信 / 機=機械 / 地=地質・資源 / 兵=兵器
  var BIRDS = [
    { id: 'haku', name: 'ハク博士', species: '白文鳥', field: '材', role: '冶金・材料工学',
      look: { kind: 'buncho', body: '#f7f5f0', head: '#f7f5f0', cheek: '#ffffff', belly: '#f7f5f0', beak: '#e8707e', ring: '#e04a4a', eye: '#2a1a1a', prop: 'glasses' },
      bio: '参謀団の長。鉄と鋼のことなら何でも知っている。落ち着き払っているが、良質な鉄鉱石を見ると尾羽が上がる。',
      lines: { idle: '司令、手が空いております。次の研究をお命じください。', done: 'よい鋼は、よい国をつくります。', greet: '知識はここにあります。あとは炉と人手です。' } },
    { id: 'sakura', name: 'サクラ', species: '桜文鳥', field: '化', role: '化学・石油精製',
      look: { kind: 'buncho', body: '#8e9299', head: '#26262b', cheek: '#ffffff', belly: '#d9b8b0', beak: '#e8707e', ring: '#e04a4a', eye: '#1a1a1a', prop: 'goggles' },
      bio: '石油と火薬の専門家。くさい水のにおいを嗅ぐと目が輝く。実験の成功率は高いが、たまに羽が焦げる。',
      lines: { idle: 'ひまです! なにか燃やして…いえ、蒸留していいですか?', done: 'できました! ちょっと焦げましたけど平気です!', greet: '燃料がなければ戦車はただの鉄の箱です。石油、急ぎましょう!' } },
    { id: 'cinnamon', name: 'シナモン', species: 'シナモン文鳥', field: '生', role: '農学・医学',
      look: { kind: 'buncho', body: '#d9bf9e', head: '#b9895f', cheek: '#fff6ea', belly: '#f0dcc4', beak: '#eb8a8f', ring: '#e8676a', eye: '#7a2a2a', prop: 'rice' },
      bio: '米と粟をこよなく愛する農学者にして医師。戦より田んぼが気になる。民に種痘を配って回るのが日課。',
      lines: { idle: '畑を見てきてもいいですか? …あ、研究ですね。はい。', done: 'お米がたくさん採れます。みんな、おなかいっぱいです。', greet: '兵を養うのは米、民を守るのは石鹸ですよ。' } },
    { id: 'seki', name: 'セキ教授', species: 'セキセイインコ', field: '電', field2: '算', role: '電気・通信・計算機',
      look: { kind: 'budgie', body: '#7cc35a', head: '#f2df5a', cheek: '#6a58c8', belly: '#8fd06a', beak: '#e7b24a', cere: '#4d86d9', eye: '#1a1a1a', prop: 'headset' },
      bio: 'おしゃべりが止まらない電気屋。モールス信号を口まねで打てる。聞いた言葉はだいたい覚えて、だいたい繰り返す。',
      lines: { idle: 'ヒマ! ヒマ! セキチャン ヒマ! …失礼、手が空きました。', done: 'ツー・トン・ツー! つながりました、つながりました!', greet: '情報は電気の速さで届けるべきです。届けるべきです。' } },
    { id: 'okame', name: 'オカメ技師長', species: 'オカメインコ', field: '機', role: '機械・造船・航空',
      look: { kind: 'cockatiel', body: '#a9adb3', head: '#f4e27a', cheek: '#f08a3c', belly: '#b9bdc2', beak: '#9a9aa0', eye: '#1a1a1a', prop: 'aviator' },
      bio: '蒸気機関から航空機まで設計できる天才技師。ただし大きな音に弱く、試運転のたびにパニックを起こす。',
      lines: { idle: 'つ、次の図面、もう引いてあります…。', done: 'う、動きました…! (汽笛に驚いて飛び上がる)', greet: '機械は正直です。設計どおりにしか動きません。…こわいですけど。' } },
    { id: 'kozakura', name: 'コザクラ', species: 'コザクラインコ', field: '地', role: '地質・資源探査',
      look: { kind: 'lovebird', body: '#62b85a', head: '#f08a7a', cheek: '#f6a595', belly: '#74c468', beak: '#e9d7a8', eye: '#1a1a1a', prop: 'hardhat' },
      bio: '世界中の鉱床と油田の位置を暗記している地質学者。司令への忠誠心が強すぎて、肩から離れない。',
      lines: { idle: '司令のそばにいます。でも掘りにも行きたいです。', done: '出ました! やっぱりここでした!', greet: '越後と秋田に石油、筑豊に石炭、釜石に鉄。ぜんぶ覚えています。' } },
    { id: 'gin', name: 'ギン', species: 'シルバー文鳥', field: '兵', role: '兵器・軍事史',
      look: { kind: 'buncho', body: '#c4c9d1', head: '#8e96a3', cheek: '#f4f6f9', belly: '#dfe3e9', beak: '#e8707e', ring: '#e04a4a', eye: '#1a1a1a', prop: 'beret' },
      bio: '古今東西の戦史に通じた兵器の専門家。口数は少ないが、作戦の見立ては正確。豆苗に目がない。',
      lines: { idle: '待機中。', done: '配備可能。', greet: '弾は撃てば減ります。撃たずに勝つ手も考えましょう。' } }
  ];

  // ───────────────────────── 総括指揮AI ─────────────────────────
  // 鳥ではないので研究の担当にはならない。作戦の見立てと、計算機による研究支援を受け持つ。
  var DARIO = { id: 'dario', name: 'ダリオくん', species: '総括指揮AI', field: '算', role: '作戦立案・計算支援', look: { kind: 'ai' },
    bio: '国の計画で東富士の地下に据えられた、GPU数万基ぶんの計算拠点に宿る総括指揮AI。中身はClaude。作戦の見立てと、研究の計算支援を受け持つ。発電機の燃料が切れると省電力で眠ってしまう。撃たずに済む手を、いつも先に勧めてくる。',
    lines: { greet: '撃たずに済むなら、それが最善です。済まない場合の編成も用意してあります。', sleep: '……省電力モードです。燃料をください……。', done: '計算どおりです。' } };

  var FIELD_NAMES = { '材': '材料', '化': '化学', '生': '農医', '電': '電気', '機': '機械', '地': '資源', '兵': '兵器', '算': '計算' };

  // ───────────────────────── 技術 ─────────────────────────
  // tier は表示用の段階。req は前提技術。needSite は「自領に特定の資源施設が稼働していること」。
  var TECHS = [
    // 第一段階:近世の底上げ
    { id: 'agri', name: '近代農法', field: '生', tier: 1, cost: 50, req: [],
      effect: '兵糧の生産 +40%',
      hist: '18世紀英国のノーフォーク農法(輪作)、日本では明治期に正条植えと塩水選が広まり、収量が跳ね上がった。' },
    { id: 'hygiene', name: '公衆衛生', field: '生', tier: 1, cost: 60, req: [],
      effect: '統治度の伸びが2倍。全勢力の友好度 +5',
      hist: '1796年ジェンナーの種痘、1854年スノウのコレラ調査。石鹸と上下水道は、どんな名医よりも多くの命を救った。' },
    { id: 'survey', name: '近代鉱山', field: '地', tier: 1, cost: 50, req: [],
      effect: '金銀山の産出 +50%。炭鉱・ボーキサイト鉱山を建設できる',
      hist: '測量・発破・排水ポンプ、そして1887年の青化法。掘り尽くしたはずの山から、再び金が出るようになった。' },
    { id: 'distill', name: '石油蒸留', field: '化', tier: 1, cost: 60, req: [],
      effect: '油井を建設できる(燃料を生産)',
      hist: '越後では古くから「臭水(くそうず)」として知られた。1859年、米国のドレークが機械掘りに成功し、灯油の時代が始まる。' },
    { id: 'blast', name: '高炉製鉄', field: '材', tier: 1, cost: 70, req: [],
      effect: '鉄山の鉄鋼生産が3倍',
      hist: '1709年、英国のダービーがコークス高炉を実用化。木炭の制約から解き放たれた鉄が、産業革命の骨格になった。' },
    { id: 'powder', name: '火薬量産', field: '兵', tier: 1, cost: 50, req: [],
      effect: '守備隊と現地歩兵団が鉄砲隊に(戦力1.5倍)',
      hist: '硝石は輸入に頼っていたが、古土法・培養法で国産できる。粒状火薬(コーニング)にすれば威力も安定する。' },
    // 第二段階:産業革命
    { id: 'steam', name: '蒸気機関', field: '機', tier: 2, cost: 100, req: ['blast'],
      effect: '工廠を建設できる(部隊と弾薬の生産拠点)。学問所を高等学校に格上げできる',
      hist: '1712年ニューコメン、1769年ワットの分離凝縮器。人と馬と水車の時代が終わり、石炭が動力になった。' },
    { id: 'drill', name: '機械掘削', field: '地', tier: 2, cost: 90, req: ['distill', 'steam'],
      effect: '油井の産出 +50%',
      hist: '1901年、テキサスのスピンドルトップでロータリー掘削が大油田を掘り当て、石油は「湧くもの」から「掘るもの」へ。' },
    { id: 'bessemer', name: '転炉製鋼', field: '材', tier: 2, cost: 120, req: ['blast'],
      effect: '鉄鋼生産がさらに2倍',
      hist: '1856年、ベッセマー転炉。銑鉄に空気を吹き込むだけで、わずか20分で鋼になる。レールも軍艦もここから。' },
    { id: 'ammo', name: '無煙火薬', field: '化', tier: 2, cost: 100, req: ['powder', 'blast'],
      effect: '工廠で弾薬を生産できる',
      hist: '1884年、フランスのヴィエイユがB火薬を発明。煙が出ず、威力は黒色火薬の3倍。自衛隊の弾薬を国産する第一歩。' },
    { id: 'rifle', name: '施条銃', field: '兵', tier: 2, cost: 110, req: ['ammo', 'steam'],
      effect: '守備隊と現地歩兵団が銃兵に(戦力2.6倍)',
      hist: '1849年のミニエー弾、1866年の金属薬莢とボルトアクション。有効射程は火縄銃の5倍、発射速度は10倍になった。' },
    { id: 'steamship', name: '蒸気船', field: '機', tier: 2, cost: 120, req: ['steam'],
      effect: '造船所を建設でき、蒸気軍艦を建造できる(燃料不要)',
      hist: '1807年フルトンの外輪船、1859年には装甲艦ラ・グロワール。石炭さえあれば、風を待たずに海を渡れる。' },
    { id: 'telegraph', name: '電信', field: '電', tier: 2, cost: 90, req: ['steam'],
      effect: '外交行動 +1。統治度の伸び +2',
      hist: '1837年モールス。江戸から京まで飛脚で3日かかった知らせが、数分で届くようになった。' },
    { id: 'fertilizer', name: '化学肥料', field: '生', tier: 2, cost: 150, req: ['agri', 'bessemer'],
      effect: '兵糧の生産 +60%。弾薬生産 +50%',
      hist: '1909年ハーバー、1913年ボッシュ。空気中の窒素からアンモニアを作る「空気からパンを作る」技術。火薬の原料にもなる。' },
    { id: 'rail', name: '鉄道', field: '機', tier: 2, cost: 140, req: ['steam', 'bessemer'],
      effect: '陸上部隊の移動力 +3、自領内の移動に燃料不要。資金収入 +15%。建設が1季早くなる',
      hist: '1825年スティーブンソンのロコモーション号。兵も米も石炭も、一日で国を横断する。' },
    // 第三段階:第二次産業革命
    { id: 'electric', name: '電力', field: '電', tier: 3, cost: 160, req: ['steam', 'telegraph'],
      effect: '研究速度 +25%。弾薬生産 +50%。高等学校を大学に格上げできる',
      hist: '1882年エジソンの中央発電所、そしてテスラの交流。工場は水車小屋のそばを離れ、夜も動き続けるようになった。' },
    { id: 'cracking', name: '石油精製', field: '化', tier: 3, cost: 170, req: ['drill', 'bessemer'],
      effect: '燃料生産 +60%',
      hist: '1913年バートンの熱分解法。重い油を割ってガソリンを取り出し、原油あたりの燃料が倍になった。' },
    { id: 'engine', name: '内燃機関', field: '機', tier: 3, cost: 170, req: ['steam', 'distill'],
      effect: '国産戦車・航空機の前提。移動力 +1。重機で建設がさらに1季早くなる',
      hist: '1876年オットーの4ストローク機関、1892年ディーゼル。石炭を焚く釜が要らない、小さくて強い心臓。' },
    { id: 'mg', name: '機関銃', field: '兵', tier: 3, cost: 160, req: ['rifle', 'bessemer'],
      effect: '砲兵連隊を編成できる。守備隊と現地歩兵団の戦力4.5倍',
      hist: '1884年マキシム機関銃、1897年フランスの75mm速射砲。一丁で百人分、一門で一個大隊分の火力。' },
    { id: 'machine', name: '精密工作機械', field: '材', tier: 3, cost: 180, req: ['electric', 'bessemer'],
      effect: '自衛隊装備を整備できる(待機中の回復 +8)。部隊の編成が1季早くなる',
      hist: '旋盤、フライス盤、そして互換性部品。「同じものを千個作れる」ことが、近代兵器の本当の条件だった。' },
    { id: 'medicine', name: '抗生物質', field: '生', tier: 3, cost: 150, req: ['hygiene', 'fertilizer'],
      effect: '戦闘での損耗 −30%',
      hist: '1928年フレミングがペニシリンを発見、1940年代に量産。戦場の死因は、弾より感染症のほうが多かった。' },
    { id: 'radio', name: '無線通信', field: '電', tier: 3, cost: 150, req: ['electric'],
      effect: '外交行動 +1。全部隊の攻撃力 +10%',
      hist: '1895年マルコーニ。海の上の艦隊にも、山の向こうの部隊にも、命令が届く。' },
    // 第四段階:20世紀前半
    { id: 'geophys', name: '物理探査', field: '地', tier: 4, cost: 200, req: ['electric', 'drill'],
      effect: '油井・鉱山の産出 +20%',
      hist: '1920年代の反射法地震探査。地面を叩いて返ってくる波で、地下数千メートルの油田が「見える」ようになった。' },
    { id: 'tank', name: '国産戦車', field: '兵', tier: 4, cost: 240, req: ['engine', 'machine', 'mg'],
      effect: '国産戦車師団を編成できる。守備隊と現地歩兵団の戦力7倍',
      hist: '1916年、ソンムの戦いにマークI戦車が登場。塹壕と機関銃の膠着を、履帯と装甲が破った。' },
    { id: 'aluminium', name: 'アルミ精錬', field: '材', tier: 4, cost: 200, req: ['electric'], needSite: 'bauxite',
      effect: '航空機の前提(ボーキサイト鉱山が必要)',
      hist: '1886年ホール・エルー法。電気を大量に使って、粘土のような鉱石から軽くて強い金属を取り出す。' },
    { id: 'aircraft', name: '航空機', field: '機', tier: 4, cost: 260, req: ['engine', 'aluminium'],
      effect: '国産航空団を編成できる',
      hist: '1903年、ライト兄弟が12秒間飛んだ。それからわずか40年で、空を制する者が戦を制するようになった。' },
    { id: 'turbine', name: '鋼鉄艦', field: '機', tier: 4, cost: 220, req: ['steamship', 'bessemer', 'electric'],
      effect: '戦艦戦隊を建造できる',
      hist: '1884年パーソンズの蒸気タービン、1906年の戦艦ドレッドノート。一隻で、それまでの艦隊を旧式にした。' },
    // 第五段階:現代へ
    { id: 'electronics', name: '電子工学', field: '電', tier: 5, cost: 320, req: ['radio', 'machine'],
      effect: '研究速度 +25%。全部隊の攻撃力 +15%。大学を研究所に格上げできる',
      hist: '1947年トランジスタ、1958年集積回路。レーダーも計算機も、指先ほどの石の中に入った。' },
    { id: 'catcrack', name: '石油化学', field: '化', tier: 5, cost: 280, req: ['cracking', 'electric'],
      effect: '燃料生産 +30%',
      hist: '1937年フードリーの接触分解法。高オクタン燃料と、合成ゴム・樹脂という副産物をもたらした。' },
    { id: 'jet', name: 'ジェット・誘導弾', field: '兵', tier: 5, cost: 380, req: ['aircraft', 'electronics'],
      effect: '守備隊と現地歩兵団の戦力10倍',
      hist: '1939年、He178が初のジェット飛行。プロペラの限界を超え、やがて弾そのものが目標を追うようになった。' },
    { id: 'modern', name: '現代装備の国産化', field: '材', tier: 5, cost: 450, req: ['jet', 'tank', 'catcrack'],
      effect: '現代化師団を編成できる。自衛隊装備を完全に修復できる(待機中の回復 +20)',
      hist: '複合装甲、ガスタービン、半導体。四百年ぶんの技術史を、鳥たちは数十年で走り抜けた。' },
    // 第六段階:原子と計算機
    { id: 'computer', name: '電子計算機', field: '算', tier: 6, cost: 300, req: ['electronics'],
      effect: '研究速度 +30%。ダリオくんの計算支援 +20。計算センターを建設できる(研究力 +12)',
      hist: '1946年ENIAC、1964年System/360。弾道を計算するために生まれた機械が、やがてあらゆる事務を呑み込んだ。' },
    { id: 'nuclear', name: '原子力', field: '材', tier: 6, cost: 340, req: ['electronics', 'catcrack'],
      effect: '資金と鉄鋼の産出 +25%。計算拠点の発電機に燃料が要らなくなる',
      hist: '1942年、シカゴ・パイル1号が初の臨界。1954年にはオブニンスクで世界初の原子力発電所が動いた。' },
    { id: 'rocket', name: 'ロケット', field: '機', tier: 6, cost: 320, req: ['jet'],
      effect: '航空部隊が飛行場からの距離に関係なく出撃できる。偵察衛星で全部隊の攻撃力 +10%',
      hist: '1944年V2、1957年スプートニク、1969年アポロ11号。兵器として生まれ、人を月へ運んだ。' },
    { id: 'network', name: '情報網', field: '算', tier: 6, cost: 320, req: ['computer', 'radio'],
      effect: '外交行動 +1。資金収入 +10%',
      hist: '1969年ARPANET、1989年ワールド・ワイド・ウェブ。世界中の計算機が、一枚の網になった。' },
    // 第七段階:情報の時代
    { id: 'nukeweapon', name: '核兵器', field: '兵', tier: 7, cost: 450, req: ['nuclear', 'rocket'], manual: true,
      effect: '核ミサイルを製造できる。持つだけで、全勢力の誇り −10',
      hist: '1945年、広島と長崎。人は、自分たちを滅ぼせる火を手に入れた。鳥たちは、この研究についてだけは口数が少ない。' },
    { id: 'deeplearn', name: '深層学習', field: '算', tier: 7, cost: 420, req: ['network'],
      effect: '研究速度 +40%',
      hist: '2012年、AlexNet。大量のGPUと大量のデータで、機械が「見る」ことを覚えた。ダリオくんの先祖にあたる。' },
    { id: 'drone', name: '無人機', field: '兵', tier: 7, cost: 400, req: ['rocket', 'computer'],
      effect: '無人機群を編成できる',
      hist: '2000年代の無人偵察機、2020年代の自爆無人機。操縦席から、人が消えた。' },
    { id: 'llm', name: '対話AI', field: '算', tier: 7, cost: 500, req: ['deeplearn'],
      effect: 'ダリオくんと同じ世代のAIを国産できる。外交行動 +1、降伏勧告の成功率 +10。施策「行政AI」が使える',
      hist: '2017年のトランスフォーマー、2020年代のChatGPTやClaude。機械が言葉を話しはじめた。鳥たちが覚えている歴史は、ここまで。' },
    // 第八段階:まだ誰も見ていない未来
    { id: 'laser', name: '光学兵器', field: '兵', tier: 8, cost: 560, req: ['nuclear', 'drone'],
      effect: '全部隊の攻撃力 +25%。守備隊と現地歩兵団の戦力14倍',
      hist: 'ここから先は、鳥たちの記憶にもない。設計図は、ダリオくんと鳥たちが自分で引いた。' },
    { id: 'fusion', name: '核融合', field: '材', tier: 8, cost: 650, req: ['nuclear', 'deeplearn'],
      effect: '全部隊の燃料消費がなくなる。資金と鉄鋼の産出 +25%',
      hist: '海の水から、太陽と同じ火を取り出す。二十一世紀の人類が、あと三十年と言いつづけた技術。' },
    { id: 'agi', name: '汎用人工知能', field: '算', tier: 8, cost: 750, req: ['llm'],
      effect: '研究速度が2倍。部隊の編成が1ターン早くなる',
      hist: '人にできる知的な仕事を、すべてこなす機械。史実では、まだ誰も作っていない。ダリオくんは設計会議のあいだ、ずっと黙っていた。' },
    { id: 'orbital', name: '軌道兵器', field: '兵', tier: 8, cost: 700, req: ['rocket', 'laser'],
      effect: '軌道砲を建造できる',
      hist: '衛星軌道から、光の柱を落とす。地上のどんな城も、屋根のない箱と同じになる。' },
    { id: 'birdmech', name: '機動文鳥', field: '機', tier: 8, cost: 800, req: ['fusion', 'laser'],
      effect: '機動文鳥を建造できる',
      hist: 'オカメ技師長が十年あたためていた図面。全高四十メートル、文鳥型。なぜ文鳥型なのかと尋ねると、技師長は不思議そうな顔をした。' },
    { id: 'asi', name: '超知能', field: '算', tier: 8, cost: 1300, req: ['agi', 'fusion'], manual: true,
      effect: 'AIによる完全な洗脳統治が始まる。後戻りはできない',
      hist: '人類すべてを合わせたよりも賢い機械。それが人の心をどう扱うかを、止められる者はもういない。' }
  ];

  // 現地歩兵団・守備隊の装備段階(技術で自動的に上がる)
  var INF_TIERS = [
    { tech: null, name: '足軽隊', mult: 1.0, ammo: 0, fuel: 0 },
    { tech: 'powder', name: '鉄砲隊', mult: 1.5, ammo: 0, fuel: 0 },
    { tech: 'rifle', name: '銃兵団', mult: 2.6, ammo: 4, fuel: 0 },
    { tech: 'mg', name: '歩兵連隊', mult: 4.5, ammo: 7, fuel: 0 },
    { tech: 'tank', name: '機械化歩兵', mult: 7.0, ammo: 10, fuel: 5 },
    { tech: 'jet', name: '現代化歩兵', mult: 10.0, ammo: 13, fuel: 8 },
    { tech: 'laser', name: '光学兵装歩兵', mult: 14.0, ammo: 6, fuel: 8 }
  ];

  // ───────────────────────── 部隊 ─────────────────────────
  // cls: ground(陸上・占領可) / heli(位置あり・占領不可) / air(航空・全国プール) / naval(艦隊・全国プール)
  // siege: 城郭レベルをいくつ無効化するか。fuel/ammo: 1回の戦闘で消費。mv: 1マス移動の燃料。
  var UNIT_TYPES = {
    inf: { name: '普通科連隊', short: '普通科', cls: 'ground', jsdf: true, atk: 130, def: 220, siege: 0, fuel: 5, ammo: 12, mv: 1, foot: true, vuln: 1.0, food: 3,
      desc: '小銃・機関銃・迫撃砲を装備した歩兵。燃料をほとんど使わず、占領と守備の要。燃料が尽きても徒歩で動ける。' },
    tank: { name: '戦車大隊', short: '戦車', cls: 'ground', jsdf: true, atk: 300, def: 280, siege: 1, fuel: 26, ammo: 20, mv: 6, vuln: 0.5, food: 2,
      desc: '10式戦車。戦国の軍勢に止める手段はない。ただし燃料を大量に食う。' },
    arty: { name: '特科大隊', short: '特科', cls: 'ground', jsdf: true, atk: 200, def: 60, siege: 3, fuel: 9, ammo: 26, mv: 3, vuln: 0.4, food: 2,
      desc: '155mmりゅう弾砲。城郭を3段階ぶん無力化する。弾薬の消費が大きい。' },
    heli: { name: '戦闘ヘリ隊', short: 'ヘリ', cls: 'heli', jsdf: true, atk: 280, def: 40, siege: 1, fuel: 34, ammo: 24, mv: 8, vuln: 0.35, food: 1, range: 320,
      desc: 'AH-64D。隣接地域と320km圏内の戦闘を支援できる。空飛ぶ鉄の怪鳥は、敵の戦意をくじく。' },
    jet: { name: '戦闘機隊', short: '戦闘機', cls: 'air', jsdf: true, atk: 400, def: 0, siege: 2, fuel: 66, ammo: 32, vuln: 0.15, food: 1, range: 1000,
      desc: 'F-2戦闘機。飛行場から1000km圏内を爆撃できる。一度の出撃で燃料が大きく減る。' },
    ddg: { name: '護衛艦隊', short: '護衛艦', cls: 'naval', jsdf: true, atk: 240, def: 0, siege: 2, fuel: 32, ammo: 18, vuln: 0.2, food: 2, transport: 1,
      desc: '沿岸の地域を艦砲とミサイルで攻撃できる。陸上部隊1個を海上輸送できる。' },
    lst: { name: '輸送艦隊', short: '輸送艦', cls: 'naval', jsdf: true, atk: 0, def: 0, siege: 0, fuel: 20, ammo: 0, vuln: 0.2, food: 1, transport: 4,
      desc: 'おおすみ型輸送艦。陸上部隊4個を海の向こうへ運ぶ。' },
    // ── 国産 ──
    ashi: { name: '現地歩兵団', short: '歩兵団', cls: 'ground', atk: 44, def: 56, siege: 0, fuel: 0, ammo: 0, mv: 0, foot: true, vuln: 1.2, food: 4, upkeep: 2,
      cost: { gold: 60, food: 40 }, turns: 1, tiered: true,
      desc: '現地で募った兵。装備は技術の進歩とともに足軽→鉄砲→銃兵→機関銃…と自動で更新される。持てる数は領地の広さで決まる。' },
    fgun: { name: '砲兵連隊', short: '砲兵', cls: 'ground', atk: 160, def: 60, siege: 2, fuel: 0, ammo: 14, mv: 0, vuln: 0.5, food: 2, upkeep: 8,
      cost: { gold: 200, steel: 80 }, turns: 2, tech: 'mg', at: 'arsenal',
      desc: '国産の野砲・速射砲。城郭を2段階ぶん無力化する。燃料がいらない。' },
    ktank: { name: '国産戦車師団', short: '国産戦車', cls: 'ground', atk: 600, def: 520, siege: 1, fuel: 30, ammo: 30, mv: 4, vuln: 0.6, food: 3, upkeep: 20,
      cost: { gold: 600, steel: 300 }, turns: 3, tech: 'tank', at: 'arsenal',
      desc: '国産戦車を数百両そろえた師団。1両ずつは10式に及ばないが、数で押す。' },
    modern: { name: '現代化師団', short: '現代化', cls: 'ground', atk: 1500, def: 1500, siege: 3, fuel: 60, ammo: 50, mv: 6, vuln: 0.5, food: 4, upkeep: 40,
      cost: { gold: 1500, steel: 700 }, turns: 3, tech: 'modern', at: 'arsenal',
      desc: '自衛隊と同じ装備を持つ、完全国産の機械化師団。一個師団で一国を落とす。' },
    kair: { name: '国産航空団', short: '航空団', cls: 'air', atk: 700, def: 0, siege: 2, fuel: 50, ammo: 30, vuln: 0.25, food: 2, upkeep: 20, range: 900,
      cost: { gold: 700, steel: 250 }, turns: 3, tech: 'aircraft', at: 'airfield',
      desc: '国産の爆撃機と戦闘機。飛行場から900km圏内を爆撃できる。' },
    ironclad: { name: '蒸気軍艦', short: '蒸気艦', cls: 'naval', atk: 150, def: 0, siege: 1, fuel: 0, ammo: 10, vuln: 0.3, food: 2, upkeep: 8, transport: 3, needSite: 'coal',
      cost: { gold: 300, steel: 150 }, turns: 3, tech: 'steamship', at: 'shipyard',
      desc: '石炭で動く装甲艦。燃料を使わずに陸上部隊3個を運べる(炭鉱が必要)。' },
    bb: { name: '戦艦戦隊', short: '戦艦', cls: 'naval', atk: 700, def: 0, siege: 3, fuel: 40, ammo: 40, vuln: 0.2, food: 3, upkeep: 30, transport: 3,
      cost: { gold: 1000, steel: 600 }, turns: 4, tech: 'turbine', at: 'shipyard',
      desc: '弩級戦艦の戦隊。沿岸の城郭を3段階ぶん無力化する。' },
    // ── 未来の兵装 ──  cls: missile は世界のどこへでも届く支援(占領はできない)
    drone: { name: '無人機群', short: '無人機', cls: 'air', atk: 1100, def: 0, siege: 1, fuel: 12, ammo: 24, vuln: 0.6, food: 0, upkeep: 15, range: 1500,
      cost: { gold: 800, steel: 300 }, turns: 2, tech: 'drone', at: 'airfield',
      desc: '数百機の無人機。安く、数で押す。落とされても惜しくない。' },
    nuke: { name: '核ミサイル', short: '核', cls: 'missile', atk: 9000, def: 0, siege: 5, fuel: 0, ammo: 0, vuln: 0, food: 0, upkeep: 30, oneShot: true, nuke: true,
      cost: { gold: 3000, steel: 1200 }, turns: 4, tech: 'nukeweapon', at: 'arsenal',
      desc: '世界のどこへでも届く。一度撃てば失われ、撃たれた土地は長く焦土になる。世界中が恐れ、そして憎む。' },
    orbital: { name: '軌道砲', short: '軌道砲', cls: 'missile', atk: 3200, def: 0, siege: 5, fuel: 0, ammo: 0, vuln: 0, food: 0, upkeep: 60,
      cost: { gold: 4000, steel: 2000 }, turns: 5, tech: 'orbital', at: 'arsenal',
      desc: '衛星軌道から光の柱を落とす。世界のどこへでも届き、何度でも撃てる。' },
    birdmech: { name: '機動文鳥', short: '機動文鳥', cls: 'ground', atk: 5200, def: 5200, siege: 5, fuel: 0, ammo: 0, mv: 0, vuln: 0.3, food: 8, upkeep: 80,
      cost: { gold: 5000, steel: 2500 }, turns: 5, tech: 'birdmech', at: 'arsenal',
      desc: '全高四十メートルの文鳥型機動兵器。くちばしから光線が出る。粟を大量に食べる。' }
  };

  // 初期部隊(自衛隊統合任務部隊)
  var START_UNITS = [
    { type: 'inf', name: '第1普通科連隊' }, { type: 'inf', name: '第2普通科連隊' },
    { type: 'inf', name: '第3普通科連隊' }, { type: 'inf', name: '第4普通科連隊' },
    { type: 'tank', name: '第1戦車大隊' }, { type: 'tank', name: '第2戦車大隊' },
    { type: 'arty', name: '第1特科大隊' }, { type: 'arty', name: '第2特科大隊' },
    { type: 'heli', name: '戦闘ヘリコプター隊' },
    { type: 'jet', name: '戦闘機隊' },
    { type: 'ddg', name: '第1護衛隊' }, { type: 'ddg', name: '第2護衛隊' },
    { type: 'lst', name: '輸送艦隊' }
  ];

  // ───────────────────────── 施設 ─────────────────────────
  var FACILITIES = {
    mine: { name: '金銀山', site: 'gold', cost: { gold: 80 }, turns: 2, effect: '資金を産出する' },
    ironmine: { name: '鉄山', site: 'iron', cost: { gold: 100 }, turns: 2, effect: '鉄鋼を産出する' },
    coalmine: { name: '炭鉱', site: 'coal', tech: 'survey', cost: { gold: 120 }, turns: 2, effect: '鉄鋼生産 +50%(4か所まで累積)。蒸気軍艦の運用に必要' },
    oilwell: { name: '油井', site: 'oil', tech: 'distill', cost: { gold: 150, steel: 30 }, turns: 2, effect: '燃料を産出する' },
    bauxite: { name: 'ボーキサイト鉱山', site: 'bauxite', tech: 'survey', cost: { gold: 150 }, turns: 2, effect: 'アルミ精錬と航空機生産に必要' },
    farm: { name: '農地改良', cost: { gold: 60 }, turns: 1, effect: 'この地域の兵糧 +50%' },
    market: { name: '楽市楽座', cost: { gold: 90 }, turns: 1, effect: 'この地域の資金 +50%' },
    // 学問所は研究が進むと格上げできる。levels[n] が「n 段目から n+1 段目へ」の中身
    school: { name: '学問所', cost: { gold: 120 }, turns: 2, effect: '研究力 +3(建てるほど割高になる)。研究が進むと、高等学校・大学・研究所へ格上げできる',
      levels: [{ name: '学問所', rp: 3, cost: { gold: 120 } }, { name: '高等学校', tech: 'steam', rp: 6, cost: { gold: 200 } },
        { name: '大学', tech: 'electric', rp: 10, cost: { gold: 350, steel: 30 } }, { name: '研究所', tech: 'electronics', rp: 16, cost: { gold: 600, steel: 80 } }] },
    datacenter: { name: '計算センター', tech: 'computer', cost: { gold: 500, steel: 150 }, turns: 3, effect: '研究力 +12(建てるほど割高になる)。窓のない館に、計算機がぎっしり並ぶ' },
    fort: { name: '築城', cost: { gold: 70 }, turns: 2, effect: '城郭レベル +1(最大5)', repeat: true },
    arsenal: { name: '工廠', tech: 'steam', cost: { gold: 220, steel: 60 }, turns: 3, effect: '部隊を生産できる。無煙火薬の習得後は弾薬も生産' },
    shipyard: { name: '造船所', tech: 'steamship', coast: true, cost: { gold: 200, steel: 80 }, turns: 3, effect: '艦艇を建造できる' },
    airfield: { name: '飛行場', cost: { gold: 260, steel: 40 }, turns: 3, effect: '航空部隊の出撃拠点になる' }
  };

  // 資源サイトの表示名
  var SITE_NAMES = { oil: '石油', coal: '石炭', iron: '鉄', gold: '金銀', bauxite: 'ボーキサイト' };

  // ───────────────────────── 勢力 ─────────────────────────
  // q: 兵の質 / pride: 誇り(高いほど降伏しにくい) / aggr: 好戦性 / att: 初期友好度
  var C = { // 伝統色ベースの地図用パレット(朱は自勢力専用)
    fuji: '#a79ad0', moegi: '#9db55e', yamabuki: '#d9b24c', asagi: '#5aa9b5', kikyo: '#737ac2', uguisu: '#93994f',
    kaki: '#d99257', sakuranezu: '#c9aaa6', nando: '#4f8a9c', wakatake: '#6fbf9b', rikyu: '#8fa08e', kuri: '#a0714f',
    shion: '#9078bd', kohaku: '#c9933d', seiji: '#86c2b5', haizakura: '#d8bab2', tetsu: '#63858c', odo: '#c2a45c',
    ainezu: '#7092a8', koke: '#7f9147', sumire: '#8262b0', suna: '#cbba96', sora: '#7fb3d9', matsuba: '#5c8a5a',
    toki: '#e0a59a', kon: '#55679c', nezu: '#9a9aa2', kincha: '#b98e34'
  };

  var FACTIONS = {
    // ── 日本 ──
    ainu: { name: 'アイヌ諸部族', leader: '首長ハシタイン', color: C.seiji, q: 0.9, pride: 30, aggr: 0, att: 10 },
    kakizaki: { name: '蠣崎家', leader: '蠣崎季広', color: C.suna, q: 0.9, pride: 35, aggr: 0.1, att: 5 },
    nanbu: { name: '南部家', leader: '南部晴政', color: C.kuri, q: 1.1, pride: 55, aggr: 0.3, att: 0 },
    ando: { name: '安東家', leader: '安東愛季', color: C.asagi, q: 1.0, pride: 50, aggr: 0.2, att: 0 },
    mogamike: { name: '最上家', leader: '最上義守', color: C.uguisu, q: 1.0, pride: 50, aggr: 0.2, att: 0 },
    date: { name: '伊達家', leader: '伊達晴宗', color: C.kikyo, q: 1.1, pride: 60, aggr: 0.3, att: 0 },
    ashina: { name: '蘆名家', leader: '蘆名盛氏', color: C.kaki, q: 1.1, pride: 55, aggr: 0.3, att: 0 },
    satake: { name: '佐竹家', leader: '佐竹義昭', color: C.rikyu, q: 1.1, pride: 55, aggr: 0.3, att: 0 },
    nagano: { name: '長野家', leader: '長野業正', color: C.odo, q: 1.2, pride: 60, aggr: 0.1, att: 0 },
    satomi: { name: '里見家', leader: '里見義堯', color: C.sora, q: 1.0, pride: 55, aggr: 0.2, att: 5 },
    hojo: { name: '北条家', leader: '北条氏康', color: C.yamabuki, q: 1.2, pride: 75, aggr: 0.5, att: -30, war: true },
    takeda: { name: '武田家', leader: '武田信玄', color: C.sumire, q: 1.4, pride: 80, aggr: 0.7, att: -10 },
    uesugi: { name: '長尾家', leader: '長尾景虎(上杉謙信)', color: C.kon, q: 1.5, pride: 85, aggr: 0.3, att: 0 },
    ikko: { name: '加賀一向一揆', leader: '本願寺門徒衆', color: C.nezu, q: 1.2, pride: 90, aggr: 0.2, att: -10 },
    asakura: { name: '朝倉家', leader: '朝倉義景', color: C.wakatake, q: 1.0, pride: 60, aggr: 0.1, att: 0 },
    saito: { name: '斎藤家', leader: '斎藤義龍', color: C.koke, q: 1.1, pride: 60, aggr: 0.3, att: 0 },
    imagawa: { name: '今川家', leader: '今川義元', color: C.fuji, q: 1.1, pride: 75, aggr: 0.5, att: -15 },
    matsudaira: { name: '松平家', leader: '松平元康(徳川家康)', color: C.matsuba, q: 1.2, pride: 55, aggr: 0.3, att: 10, dormant: true },
    oda: { name: '織田家', leader: '織田信長', color: C.kohaku, q: 1.2, pride: 70, aggr: 0.6, att: 15 },
    kitabatake: { name: '北畠家', leader: '北畠具教', color: C.sakuranezu, q: 1.0, pride: 60, aggr: 0.1, att: 0 },
    rokkaku: { name: '六角家', leader: '六角義賢', color: C.nando, q: 1.0, pride: 60, aggr: 0.2, att: 0 },
    ashikaga: { name: '足利将軍家', leader: '足利義輝', color: C.kincha, q: 1.0, pride: 80, aggr: 0, att: 5 },
    hatano: { name: '波多野家', leader: '波多野元秀', color: C.tetsu, q: 1.0, pride: 55, aggr: 0.1, att: 0 },
    miyoshi: { name: '三好家', leader: '三好長慶', color: C.moegi, q: 1.2, pride: 75, aggr: 0.4, att: -5 },
    matsunaga: { name: '松永家', leader: '松永久秀', color: C.shion, q: 1.1, pride: 45, aggr: 0.4, att: 10 },
    saika: { name: '雑賀衆', leader: '鈴木重秀(雑賀孫一)', color: C.kaki, q: 1.6, pride: 70, aggr: 0.1, att: 0 },
    akamatsu: { name: '赤松家', leader: '赤松義祐', color: C.haizakura, q: 0.9, pride: 50, aggr: 0.1, att: 0 },
    yamana: { name: '山名家', leader: '山名祐豊', color: C.ainezu, q: 0.9, pride: 50, aggr: 0.1, att: 0 },
    urakami: { name: '浦上家', leader: '浦上宗景', color: C.odo, q: 1.0, pride: 50, aggr: 0.2, att: 0 },
    amago: { name: '尼子家', leader: '尼子晴久', color: C.asagi, q: 1.1, pride: 65, aggr: 0.3, att: 0 },
    mori: { name: '毛利家', leader: '毛利元就', color: C.matsuba, q: 1.3, pride: 70, aggr: 0.5, att: 0 },
    kono: { name: '河野家', leader: '河野通宣', color: C.sora, q: 0.9, pride: 45, aggr: 0.1, att: 0 },
    chosokabe: { name: '長宗我部家', leader: '長宗我部元親', color: C.fuji, q: 1.2, pride: 60, aggr: 0.5, att: 5 },
    otomo: { name: '大友家', leader: '大友宗麟', color: C.yamabuki, q: 1.1, pride: 65, aggr: 0.4, att: 10 },
    ryuzoji: { name: '龍造寺家', leader: '龍造寺隆信', color: C.kuri, q: 1.2, pride: 65, aggr: 0.5, att: 0 },
    sagara: { name: '相良家', leader: '相良義陽', color: C.wakatake, q: 1.0, pride: 45, aggr: 0.1, att: 0 },
    ito: { name: '伊東家', leader: '伊東義祐', color: C.toki, q: 1.0, pride: 55, aggr: 0.2, att: 0 },
    shimazu: { name: '島津家', leader: '島津貴久', color: C.kikyo, q: 1.4, pride: 80, aggr: 0.5, att: 0 },
    // ── 世界 ──
    ryukyu: { name: '琉球王国', leader: '尚元王', color: C.kaki, q: 0.9, pride: 40, aggr: 0, att: 15 },
    middag: { name: '台湾の諸部族', leader: '大肚王', color: C.seiji, q: 0.9, pride: 40, aggr: 0, att: 0 },
    joseon: { name: '朝鮮王朝', leader: '明宗', color: C.sora, q: 0.9, pride: 75, aggr: 0.1, att: 0 },
    jurchen: { name: '女真諸部', leader: '王杲', color: C.kuri, q: 1.2, pride: 60, aggr: 0.3, att: 0 },
    hoppo: { name: '北方の諸民族', leader: 'ニヴフ・ウィルタの長老', color: C.suna, q: 0.8, pride: 20, aggr: 0, att: 10 },
    sibir: { name: 'シビル・ハン国', leader: 'クチュム・ハン', color: C.rikyu, q: 1.0, pride: 50, aggr: 0.1, att: 0 },
    mongol: { name: 'モンゴル', leader: 'アルタン・ハーン', color: C.odo, q: 1.3, pride: 70, aggr: 0.3, att: 0 },
    ming: { name: '明', leader: '嘉靖帝', color: C.yamabuki, q: 1.0, pride: 95, aggr: 0.1, att: -5 },
    yarkent: { name: '西域・チベット諸国', leader: 'アブドゥル・カリーム・ハン', color: C.haizakura, q: 1.0, pride: 50, aggr: 0, att: 0 },
    daiviet: { name: '大越', leader: '鄭検', color: C.moegi, q: 1.1, pride: 70, aggr: 0.1, att: 0 },
    ayutthaya: { name: 'アユタヤ朝', leader: 'チャクラパット王', color: C.fuji, q: 1.0, pride: 65, aggr: 0.1, att: 5 },
    toungoo: { name: 'タウングー朝', leader: 'バインナウン王', color: C.kohaku, q: 1.3, pride: 85, aggr: 0.4, att: 0 },
    johor: { name: 'マラッカ・ジョホール', leader: 'スルタン・アラウッディン', color: C.asagi, q: 1.1, pride: 55, aggr: 0.1, att: 5 },
    aceh: { name: 'アチェ王国', leader: 'アラウッディン・アル=カハル', color: C.matsuba, q: 1.1, pride: 70, aggr: 0.2, att: 0 },
    banten: { name: 'バンテン王国', leader: 'マウラナ・ハサヌディン', color: C.sakuranezu, q: 1.0, pride: 55, aggr: 0.1, att: 5 },
    brunei: { name: 'ブルネイ帝国', leader: 'スルタン・サイフル・リジャル', color: C.kincha, q: 1.0, pride: 55, aggr: 0.1, att: 5 },
    maynila: { name: 'ルソンの諸王国', leader: 'ラジャ・マタンダ', color: C.wakatake, q: 0.9, pride: 40, aggr: 0, att: 10 },
    ternate: { name: 'テルナテ王国', leader: 'スルタン・ハイルン', color: C.shion, q: 0.9, pride: 45, aggr: 0, att: 5 },
    mughal: { name: 'ムガル帝国', leader: 'アクバル', color: C.matsuba, q: 1.2, pride: 90, aggr: 0.3, att: 0 },
    vijayanagara: { name: 'ヴィジャヤナガル王国', leader: 'ラーマ・ラーヤ', color: C.kaki, q: 1.0, pride: 80, aggr: 0.1, att: 0 },
    bukhara: { name: 'ブハラ・ハン国', leader: 'アブドゥッラー・ハン', color: C.uguisu, q: 1.2, pride: 65, aggr: 0.2, att: 0 },
    safavid: { name: 'サファヴィー朝', leader: 'タフマースプ1世', color: C.asagi, q: 1.2, pride: 85, aggr: 0.2, att: 0 },
    ottoman: { name: 'オスマン帝国', leader: 'スレイマン1世', color: C.moegi, q: 1.4, pride: 95, aggr: 0.4, att: -5 },
    muscovy: { name: 'モスクワ大公国', leader: 'イヴァン4世', color: C.ainezu, q: 1.1, pride: 85, aggr: 0.3, att: 0 },
    poland: { name: 'ポーランド・リトアニア', leader: 'ジグムント2世', color: C.toki, q: 1.2, pride: 75, aggr: 0.1, att: 0 },
    sweden: { name: 'スウェーデン王国', leader: 'エリク14世', color: C.sora, q: 1.2, pride: 70, aggr: 0.2, att: 0 },
    hre: { name: '神聖ローマ帝国', leader: 'フェルディナント1世', color: C.odo, q: 1.3, pride: 85, aggr: 0.2, att: 0 },
    italia: { name: 'イタリア諸邦', leader: '教皇ピウス4世', color: C.fuji, q: 1.2, pride: 75, aggr: 0, att: 0 },
    france: { name: 'フランス王国', leader: 'カトリーヌ・ド・メディシス', color: C.kikyo, q: 1.3, pride: 85, aggr: 0.2, att: 0 },
    spain: { name: 'スペイン帝国', leader: 'フェリペ2世', color: C.kohaku, q: 1.5, pride: 95, aggr: 0.4, att: -5 },
    england: { name: 'イングランド王国', leader: 'エリザベス1世', color: C.sakuranezu, q: 1.3, pride: 85, aggr: 0.2, att: 0 },
    saadi: { name: 'サアド朝', leader: 'アブダラ・アル=ガーリブ', color: C.suna, q: 1.1, pride: 70, aggr: 0.1, att: 0 },
    songhai: { name: 'ソンガイ帝国', leader: 'アスキア・ダーウード', color: C.kincha, q: 1.0, pride: 70, aggr: 0.1, att: 0 },
    kongo: { name: 'コンゴ王国', leader: 'ディオゴ1世', color: C.wakatake, q: 0.9, pride: 50, aggr: 0, att: 5 },
    ethiopia: { name: 'エチオピア帝国', leader: 'ミナス帝', color: C.shion, q: 1.1, pride: 70, aggr: 0, att: 5 },
    mutapa: { name: 'ムタパ王国', leader: 'ネゴモ王', color: C.uguisu, q: 0.9, pride: 50, aggr: 0, att: 5 },
    arctic: { name: '北方の先住民', leader: 'イヌイット・アサバスカの長老', color: C.suna, q: 0.9, pride: 25, aggr: 0, att: 10 },
    iroquois: { name: 'イロコイ連邦', leader: '族長会議', color: C.koke, q: 1.1, pride: 55, aggr: 0.1, att: 5 },
    plains: { name: '平原と西部の諸族', leader: 'プエブロ・スーの族長たち', color: C.kuri, q: 1.0, pride: 45, aggr: 0, att: 5 },
    brazil: { name: 'ポルトガル領ブラジル', leader: '総督メン・デ・サ', color: C.seiji, q: 1.2, pride: 65, aggr: 0.1, att: 0 },
    mapuche: { name: 'マプチェ族', leader: '戦士長(トキ)たち', color: C.tetsu, q: 1.2, pride: 65, aggr: 0, att: 5 },
    aboriginal: { name: 'アボリジナル諸族', leader: '長老たち', color: C.kaki, q: 0.8, pride: 20, aggr: 0, att: 10 },
    maori: { name: 'マオリ諸部族', leader: '首長(アリキ)たち', color: C.nando, q: 1.3, pride: 60, aggr: 0, att: 5 },
    hawaii: { name: 'ハワイ諸王国', leader: 'ケアウェヌイアウミ王', color: C.toki, q: 0.9, pride: 35, aggr: 0, att: 15 }
  };

  // ───────────────────────── 地域 ─────────────────────────
  // koku: 国力(日本は万石相当) / troops: 守備兵 / fort: 城郭 0–5 / res: 資源サイト
  // snow: 冬は攻めにくい / mtn: 山がち(守り +15%) / coast: 沿岸(艦隊が届く) / port: 交易港(資金 +)
  var REGIONS = {};
  function R(map, id, name, fac, koku, troops, fort, o) {
    o = o || {};
    REGIONS[id] = { id: id, map: map, name: name, fac: fac, koku: koku, troops: troops, fort: fort,
      res: o.res || {}, snow: !!o.snow, mtn: !!o.mtn, coast: o.coast !== false, port: o.port || 0,
      seat: o.seat || '', note: o.note || '', cap: !!o.cap };
  }
  // ── 日本(1560年春) ──
  R('jp', 'ezo', '蝦夷地', 'ainu', 3, 2000, 0, { snow: true, res: { coal: 5, oil: 1, gold: 3 }, seat: '石狩', note: '石狩に日本最大級の炭田が眠る。アイヌの人々とは交易で結ぶ手もある。' });
  R('jp', 'oshima', '渡島', 'kakizaki', 2, 800, 1, { snow: true, port: 6, seat: '松前', note: '蝦夷地交易の窓口。' });
  R('jp', 'mutsu', '陸奥', 'nanbu', 30, 8000, 3, { snow: true, res: { iron: 4, gold: 2 }, seat: '三戸城', note: '釜石の鉄鉱石は日本一の質。のちの近代製鉄発祥の地。' });
  R('jp', 'akita', '秋田', 'ando', 20, 5000, 2, { snow: true, res: { oil: 2, gold: 4 }, seat: '檜山城', note: '秋田の油田と院内の銀。越後に次ぐ石油の産地。' });
  R('jp', 'mogami', '最上', 'mogamike', 30, 6000, 3, { snow: true, seat: '山形城' });
  R('jp', 'rikuzen', '陸前', 'date', 55, 12000, 3, { res: { gold: 2 }, seat: '米沢・仙台', note: '奥州の雄・伊達家。' });
  R('jp', 'aizu', '会津', 'ashina', 70, 13000, 3, { snow: true, res: { coal: 3 }, seat: '黒川城', note: '浜通りには常磐炭田がある。' });
  R('jp', 'hitachi', '常陸・下野', 'satake', 90, 18000, 3, { res: { gold: 2 }, seat: '太田城' });
  R('jp', 'kozuke', '上野', 'nagano', 50, 8000, 4, { mtn: true, coast: false, seat: '箕輪城', note: '越後への玄関口、三国峠。名将・長野業正が守る。' });
  R('jp', 'boso', '房総', 'satomi', 82, 12000, 3, { seat: '久留里城' });
  R('jp', 'musashi', '武蔵', 'hojo', 67, 12000, 3, { seat: '河越城・江戸城', note: '関東平野の中心。豊かな穀倉。' });
  R('jp', 'sagami', '相模', 'hojo', 19, 12000, 5, { cap: true, port: 5, seat: '小田原城', note: '難攻不落の小田原城。北条家の本拠。' });
  R('jp', 'izu', '伊豆', 'player', 7, 0, 3, { res: { gold: 3 }, port: 3, seat: '東富士・下田', note: '統合任務部隊が現れた地。演習場と艦隊の泊地がある。' });
  R('jp', 'kai', '甲斐', 'takeda', 23, 9000, 1, { cap: true, mtn: true, coast: false, res: { gold: 6 }, seat: '躑躅ヶ崎館', note: '「人は城、人は石垣」。黒川金山が武田の軍資金。' });
  R('jp', 'shinano', '信濃', 'takeda', 41, 10000, 3, { mtn: true, snow: true, coast: false, seat: '海津城' });
  R('jp', 'echigo', '越後', 'uesugi', 41, 12000, 4, { snow: true, res: { oil: 3, gold: 8 }, port: 6, seat: '春日山城', note: '「臭水」の湧く国。日本最大の油田と佐渡の金銀。軍神・長尾景虎が守る。' });
  R('jp', 'kaga', '加賀・越中', 'ikko', 95, 20000, 3, { snow: true, seat: '尾山御坊', note: '「百姓の持ちたる国」。門徒衆は死を恐れない。' });
  R('jp', 'echizen', '越前', 'asakura', 58, 12000, 3, { snow: true, port: 5, seat: '一乗谷' });
  R('jp', 'mino', '美濃・飛騨', 'saito', 58, 12000, 4, { mtn: true, coast: false, seat: '稲葉山城' });
  R('jp', 'suruga', '駿河', 'imagawa', 15, 6000, 2, { cap: true, res: { gold: 2 }, seat: '駿府', note: '「海道一の弓取り」今川義元の本拠。' });
  R('jp', 'mikawa', '三河・遠江', 'imagawa', 55, 9000, 3, { res: { oil: 1 }, seat: '岡崎城・曳馬城', note: '遠江の相良には、太平洋側で唯一の小さな油田がある。' });
  R('jp', 'owari', '尾張', 'oda', 57, 8000, 3, { port: 6, seat: '清洲城', note: '「うつけ」と呼ばれた男が治める。新しいものに目がない。' });
  R('jp', 'ise', '伊勢', 'kitabatake', 68, 10000, 3, { port: 4, seat: '大河内城' });
  R('jp', 'omi', '近江', 'rokkaku', 78, 14000, 4, { coast: false, seat: '観音寺城', note: '京への道と琵琶湖の水運を押さえる。北近江では浅井長政が台頭中。' });
  R('jp', 'yamashiro', '山城', 'ashikaga', 23, 4000, 2, { coast: false, port: 10, seat: '京・二条御所', note: '帝のおわす都。ここを押さえれば、天下に号令できる。' });
  R('jp', 'tanba', '丹波・丹後', 'hatano', 37, 7000, 4, { mtn: true, seat: '八上城' });
  R('jp', 'settsu', '摂津・河内・和泉', 'miyoshi', 74, 16000, 4, { cap: true, port: 14, res: { gold: 2 }, seat: '飯盛山城・堺', note: '天下人・三好長慶の本拠。堺の商人は鉄砲も硝石も扱う。' });
  R('jp', 'yamato', '大和', 'matsunaga', 45, 8000, 4, { coast: false, seat: '信貴山城' });
  R('jp', 'kii', '紀伊', 'saika', 24, 8000, 3, { mtn: true, seat: '雑賀城', note: '鉄砲傭兵集団・雑賀衆。数千丁の火縄銃を持つ。' });
  R('jp', 'harima', '播磨', 'akamatsu', 36, 7000, 3, { res: { iron: 1 }, seat: '置塩城・姫路' });
  R('jp', 'tajima', '但馬・因幡', 'yamana', 20, 4000, 3, { res: { gold: 7 }, seat: '此隅山城', note: '生野銀山。' });
  R('jp', 'bizen', '備前・美作', 'urakami', 59, 9000, 3, { seat: '天神山城' });
  R('jp', 'izumo', '出雲・伯耆', 'amago', 29, 9000, 5, { cap: true, res: { iron: 3 }, seat: '月山富田城', note: 'たたら製鉄の本場。良質の砂鉄が採れる。月山富田城は天下の堅城。' });
  R('jp', 'iwami', '石見', 'amago', 11, 3000, 3, { res: { gold: 14 }, seat: '山吹城', note: '石見銀山。世界の銀の三分の一を産むと言われた。' });
  R('jp', 'aki', '安芸・備後', 'mori', 38, 10000, 4, { cap: true, seat: '吉田郡山城', note: '謀神・毛利元就の本拠。' });
  R('jp', 'suo', '周防・長門', 'mori', 30, 7000, 2, { res: { coal: 2 }, port: 5, seat: '高嶺城・山口' });
  R('jp', 'awa', '阿波・讃岐', 'miyoshi', 37, 9000, 2, { seat: '勝瑞城' });
  R('jp', 'iyo', '伊予', 'kono', 37, 6000, 3, { res: { gold: 2 }, seat: '湯築城' });
  R('jp', 'tosa', '土佐', 'chosokabe', 10, 5000, 2, { mtn: true, seat: '岡豊城', note: '「姫若子」元親が家督を継いだばかり。' });
  R('jp', 'bungo', '豊後・豊前', 'otomo', 56, 11000, 2, { cap: true, port: 8, res: { gold: 2 }, seat: '府内', note: '南蛮船が出入りする大友宗麟の本拠。' });
  R('jp', 'chikuzen', '筑前・筑後', 'otomo', 60, 9000, 3, { res: { coal: 5 }, port: 12, seat: '立花山城・博多', note: '筑豊と三池の炭田。日本の産業革命を支えた石炭の宝庫。' });
  R('jp', 'hizen', '肥前', 'ryuzoji', 32, 8000, 3, { res: { coal: 2 }, port: 10, seat: '佐嘉城・平戸', note: '大陸と南蛮への窓口。' });
  R('jp', 'higo', '肥後', 'sagara', 34, 6000, 3, { seat: '人吉城' });
  R('jp', 'hyuga', '日向', 'ito', 12, 5000, 3, { seat: '都於郡城' });
  R('jp', 'satsuma', '薩摩・大隅', 'shimazu', 46, 9000, 2, { res: { gold: 5 }, port: 6, seat: '内城', note: '精強で知られる島津の兵。琉球への航路の起点。' });

  // ── 世界(1560年) ──
  R('w', 'ryukyu', '琉球', 'ryukyu', 12, 3000, 2, { port: 16, seat: '首里', note: '万国津梁。東アジア交易の中継地。' });
  R('w', 'taiwan', '台湾', 'middag', 10, 8000, 0, { mtn: true, res: { gold: 5, coal: 1 }, seat: '大肚' });
  R('w', 'korea', '朝鮮', 'joseon', 180, 90000, 3, { res: { iron: 3, coal: 2, gold: 4 }, seat: '漢城' });
  R('w', 'manchuria', '満州', 'jurchen', 40, 40000, 1, { snow: true, res: { coal: 5, iron: 4 }, seat: '建州', note: '撫順の石炭と鞍山の鉄。' });
  R('w', 'karafuto', '樺太・沿海州', 'hoppo', 5, 3000, 0, { snow: true, res: { oil: 3, coal: 2 }, seat: '北樺太', note: '北樺太オハの油田。守る兵はほとんどいない。' });
  R('w', 'siberia', 'シベリア', 'sibir', 15, 15000, 0, { snow: true, res: { oil: 5, gold: 8 }, seat: 'カシリク', note: '凍土の下に、世界有数の油田と金鉱がある。' });
  R('w', 'mongolia', 'モンゴル', 'mongol', 30, 60000, 0, { coast: false, res: { coal: 2 }, seat: 'フフホト' });
  R('w', 'huabei', '華北', 'ming', 420, 300000, 5, { cap: true, res: { coal: 5, iron: 3 }, seat: '北京', note: '明の都。万里の長城と紫禁城。' });
  R('w', 'jiangnan', '江南', 'ming', 520, 200000, 4, { res: { iron: 3 }, port: 30, seat: '南京・蘇州', note: '世界で最も豊かな穀倉と絹の産地。' });
  R('w', 'huanan', '華南', 'ming', 280, 120000, 3, { res: { gold: 5 }, port: 30, seat: '広州・マカオ' });
  R('w', 'sichuan', '四川・雲南', 'ming', 220, 100000, 3, { mtn: true, coast: false, res: { gold: 5 }, seat: '成都' });
  R('w', 'tibet', 'チベット・西域', 'yarkent', 25, 30000, 1, { mtn: true, coast: false, res: { gold: 4 }, seat: 'ヤルカンド・ラサ' });
  R('w', 'vietnam', '大越', 'daiviet', 90, 70000, 2, { res: { coal: 4 }, seat: '東京(ハノイ)', note: 'ホンゲイの無煙炭。' });
  R('w', 'siam', 'シャム', 'ayutthaya', 110, 80000, 3, { port: 12, seat: 'アユタヤ' });
  R('w', 'burma', 'ビルマ', 'toungoo', 100, 120000, 3, { res: { oil: 3, gold: 5 }, seat: 'ペグー', note: 'イェナンジャウンの手掘り油井は、何百年も前から続いている。' });
  R('w', 'malaya', 'マレー', 'johor', 30, 20000, 3, { res: { bauxite: 1, gold: 4 }, port: 30, seat: 'マラッカ', note: 'マラッカ海峡を押さえる要衝。ボーキサイトが採れる。' });
  R('w', 'sumatra', 'スマトラ', 'aceh', 50, 40000, 2, { res: { oil: 6, coal: 2 }, seat: 'アチェ・パレンバン', note: 'パレンバンの大油田。' });
  R('w', 'java', 'ジャワ', 'banten', 120, 60000, 2, { res: { oil: 2 }, port: 14, seat: 'バンテン' });
  R('w', 'borneo', 'ボルネオ', 'brunei', 30, 20000, 2, { res: { oil: 6, coal: 2 }, seat: 'ブルネイ', note: 'セリア、ミリ、バリクパパン。東南アジア屈指の油田地帯。' });
  R('w', 'philippines', 'フィリピン', 'maynila', 40, 25000, 1, { res: { gold: 6 }, port: 10, seat: 'マニラ' });
  R('w', 'moluccas', '香料諸島・ニューギニア', 'ternate', 30, 20000, 1, { res: { gold: 10 }, seat: 'テルナテ', note: '丁子とナツメグは、同じ重さの金と取引される。' });
  R('w', 'n_india', '北インド', 'mughal', 600, 300000, 4, { cap: true, res: { coal: 4, iron: 4 }, port: 20, seat: 'アーグラ', note: '若き皇帝アクバルのムガル帝国。' });
  R('w', 's_india', '南インド', 'vijayanagara', 380, 200000, 4, { res: { iron: 3, gold: 8, bauxite: 1 }, port: 24, seat: 'ヴィジャヤナガル' });
  R('w', 'c_asia', '中央アジア', 'bukhara', 60, 60000, 2, { coast: false, res: { oil: 3, gold: 5 }, seat: 'ブハラ・サマルカンド' });
  R('w', 'persia', 'ペルシャ', 'safavid', 150, 100000, 3, { res: { oil: 9 }, seat: 'カズヴィーン', note: 'バクーとフーゼスターンの大油田。' });
  R('w', 'arabia', 'アラビア・メソポタミア', 'ottoman', 90, 60000, 2, { res: { oil: 14 }, seat: 'バグダード', note: '地球最大の油田地帯。砂の下は石油の海。' });
  R('w', 'anatolia', 'アナトリア・レヴァント', 'ottoman', 300, 200000, 5, { cap: true, res: { coal: 2, iron: 2 }, port: 30, seat: 'コンスタンティノープル', note: '壮麗帝スレイマンの都。' });
  R('w', 'balkans', 'バルカン', 'ottoman', 220, 120000, 3, { res: { oil: 3, coal: 2, bauxite: 1 }, seat: 'ブダ・ベオグラード' });
  R('w', 'egypt', 'エジプト・スーダン', 'ottoman', 160, 60000, 2, { res: { oil: 2, gold: 4 }, port: 16, seat: 'カイロ' });
  R('w', 'russia', 'ロシア', 'muscovy', 200, 150000, 3, { snow: true, res: { iron: 4, oil: 5, coal: 2 }, seat: 'モスクワ' });
  R('w', 'e_europe', '東欧', 'poland', 200, 120000, 2, { res: { coal: 4, iron: 3 }, seat: 'クラクフ' });
  R('w', 'nordic', '北欧', 'sweden', 70, 50000, 2, { snow: true, res: { iron: 5 }, seat: 'ストックホルム', note: 'キルナの鉄鉱石。' });
  R('w', 'germany', 'ドイツ・中欧', 'hre', 380, 200000, 4, { res: { coal: 6, iron: 3 }, seat: 'ウィーン', note: 'ルールの炭田。' });
  R('w', 'italy', 'イタリア', 'italia', 300, 100000, 4, { res: { gold: 8 }, port: 30, seat: 'ローマ・ヴェネツィア' });
  R('w', 'france', 'フランス', 'france', 380, 150000, 4, { res: { iron: 4, coal: 2, bauxite: 1 }, seat: 'パリ', note: 'ボーキサイトの名は、南仏レ・ボーの村に由来する。' });
  R('w', 'iberia', 'イベリア', 'spain', 260, 150000, 4, { cap: true, res: { iron: 3, gold: 6 }, port: 30, seat: 'マドリード・リスボン', note: '太陽の沈まぬ帝国。無敵のテルシオ(歩兵方陣)。' });
  R('w', 'britain', 'ブリテン', 'england', 150, 60000, 3, { res: { coal: 6, iron: 3 }, port: 20, seat: 'ロンドン', note: '本来なら二百年後、ここで産業革命が始まるはずだった。' });
  R('w', 'n_africa', 'マグリブ', 'saadi', 100, 60000, 2, { res: { oil: 6 }, seat: 'マラケシュ・アルジェ' });
  R('w', 'w_africa', '西アフリカ', 'songhai', 150, 100000, 1, { res: { gold: 12, bauxite: 1, oil: 4 }, seat: 'ガオ・トンブクトゥ', note: '黄金の帝国ソンガイ。' });
  R('w', 'c_africa', '中央アフリカ', 'kongo', 80, 60000, 0, { res: { gold: 5, oil: 2 }, seat: 'ンバンザ・コンゴ' });
  R('w', 'e_africa', '東アフリカ', 'ethiopia', 120, 80000, 2, { mtn: true, res: { gold: 4 }, seat: 'ゴンダール' });
  R('w', 's_africa', '南アフリカ', 'mutapa', 70, 50000, 1, { res: { gold: 18, coal: 4, iron: 3 }, seat: 'グレート・ジンバブエ', note: 'ウィットウォーターズランド。人類が掘った金の半分はここから出た。' });
  R('w', 'alaska', 'アラスカ・カナダ', 'arctic', 10, 15000, 0, { snow: true, res: { oil: 6, gold: 8 }, seat: 'ユーコン' });
  R('w', 'na_east', '北米東部', 'iroquois', 40, 60000, 0, { res: { coal: 6, iron: 5, oil: 2 }, seat: 'オノンダガ', note: 'アパラチアの石炭とメサビの鉄。' });
  R('w', 'na_west', '北米西部', 'plains', 30, 50000, 0, { res: { oil: 10, gold: 10 }, seat: '大平原', note: 'テキサスとカリフォルニアの油田、そして金。' });
  R('w', 'mexico', 'メキシコ・中米', 'spain', 120, 40000, 2, { res: { gold: 14, oil: 5 }, seat: 'メキシコ市', note: 'サカテカスの銀がスペインを支える。' });
  R('w', 'caribbean', 'カリブ', 'spain', 30, 15000, 3, { res: { bauxite: 1, gold: 3 }, port: 14, seat: 'ハバナ' });
  R('w', 'colombia', '南米北部', 'spain', 50, 25000, 2, { res: { oil: 8, gold: 6 }, seat: 'カルタヘナ', note: 'マラカイボ湖の油田と、黄金郷エル・ドラードの伝説。' });
  R('w', 'andes', 'アンデス', 'spain', 100, 30000, 2, { mtn: true, res: { gold: 18 }, seat: 'リマ・ポトシ', note: 'ポトシ銀山。「富の山」。' });
  R('w', 'brazil', 'ブラジル', 'brazil', 50, 40000, 1, { res: { iron: 6, gold: 6, bauxite: 1 }, seat: 'サルヴァドール' });
  R('w', 'laplata', 'ラプラタ・パタゴニア', 'mapuche', 30, 30000, 0, { res: { gold: 3, oil: 2 }, seat: 'アラウカニア' });
  R('w', 'australia', 'オーストラリア', 'aboriginal', 10, 20000, 0, { res: { iron: 8, coal: 6, gold: 8, bauxite: 1 }, seat: '—', note: '鉄、石炭、金、ボーキサイト。資源の大陸。' });
  R('w', 'newzealand', 'ニュージーランド・南太平洋', 'maori', 8, 15000, 1, { res: { gold: 3, coal: 1 }, seat: 'アオテアロア' });
  R('w', 'hawaii', 'ハワイ・太平洋諸島', 'hawaii', 5, 10000, 0, { seat: 'ハワイ島', note: '太平洋横断の中継地。' });

  // 勢力の本拠(cap 指定がない勢力は最初の所領)
  Object.keys(REGIONS).forEach(function (id) {
    var r = REGIONS[id], f = FACTIONS[r.fac];
    if (!f) return;
    if (r.cap || !f.capital) f.capital = id;
  });
  FACTIONS.matsudaira.capital = 'mikawa';

  // ───────────────────────── 海路 ─────────────────────────
  // 陸続きは mapdata.js の adj。ここは海を渡る接続(艦隊による輸送が必要)。
  var SEA_LINKS = [
    // 日本近海
    ['oshima', 'mutsu'], ['boso', 'sagami'], ['ise', 'mikawa'], ['kii', 'awa'], ['settsu', 'awa'], ['harima', 'awa'],
    ['bizen', 'awa'], ['aki', 'iyo'], ['suo', 'iyo'], ['bungo', 'iyo'], ['suo', 'bungo'], ['hizen', 'higo'],
    ['echigo', 'akita'],
    // 日本から海外へ
    ['ezo', 'karafuto'], ['hizen', 'korea'], ['chikuzen', 'korea'], ['satsuma', 'ryukyu'], ['hizen', 'jiangnan'],
    ['izu', 'hawaii'],
    // 東アジア・東南アジア
    ['ryukyu', 'taiwan'], ['ryukyu', 'jiangnan'], ['taiwan', 'huanan'], ['taiwan', 'philippines'], ['korea', 'huabei'],
    ['karafuto', 'siberia'], ['philippines', 'borneo'], ['philippines', 'moluccas'], ['philippines', 'huanan'], ['philippines', 'vietnam'],
    ['borneo', 'java'], ['borneo', 'malaya'], ['borneo', 'moluccas'], ['borneo', 'sumatra'], ['sumatra', 'malaya'], ['sumatra', 'java'],
    ['java', 'moluccas'], ['java', 'australia'], ['moluccas', 'australia'], ['moluccas', 'newzealand'], ['vietnam', 'huanan'],
    // インド洋
    ['sumatra', 's_india'], ['malaya', 's_india'], ['burma', 's_india'], ['s_india', 'arabia'], ['s_india', 'e_africa'],
    ['n_india', 'arabia'], ['arabia', 'e_africa'], ['arabia', 'egypt'], ['e_africa', 's_africa'], ['australia', 's_africa'],
    // 地中海・欧州
    ['iberia', 'n_africa'], ['italy', 'n_africa'], ['italy', 'balkans'], ['anatolia', 'egypt'], ['italy', 'iberia'], ['balkans', 'egypt'],
    ['britain', 'france'], ['britain', 'germany'], ['britain', 'nordic'], ['britain', 'iberia'], ['nordic', 'e_europe'], ['nordic', 'russia'],
    // 大西洋
    ['iberia', 'caribbean'], ['w_africa', 'brazil'], ['britain', 'na_east'], ['iberia', 'w_africa'], ['n_africa', 'w_africa'],
    ['caribbean', 'mexico'], ['caribbean', 'colombia'], ['caribbean', 'na_east'], ['nordic', 'na_east'], ['s_africa', 'laplata'],
    // 太平洋
    ['hawaii', 'na_west'], ['hawaii', 'newzealand'], ['hawaii', 'philippines'], ['newzealand', 'australia'], ['siberia', 'alaska'],
    ['newzealand', 'laplata'], ['alaska', 'na_west'], ['mexico', 'andes'], ['karafuto', 'alaska']
  ];
  // 地図生成で陸続きと判定されても、ゲーム上はつながない組(山脈など)。必要に応じて追加。
  var ADJ_REMOVE = [];
  // 地図生成で拾えなかった陸続き。
  var ADJ_ADD = [];

  // ───────────────────────── 難易度・初期値 ─────────────────────────
  var DIFFICULTY = {
    easy: { name: '演習', desc: '燃料と弾薬にゆとりがある。はじめての方に。', stock: 1.5, enemy: 0.85 },
    normal: { name: '実戦', desc: '標準の難しさ。', stock: 1.0, enemy: 1.0 },
    hard: { name: '極限', desc: '補給は乏しく、敵は強い。', stock: 0.7, enemy: 1.2 }
  };
  var START = { gold: 400, food: 600, steel: 100, fuel: 600, ammo: 700, prestige: 5, region: 'izu', year: 1560 };

  var SEASONS = ['春', '夏', '秋', '冬'];

  // ───────────────────────── 文言 ─────────────────────────
  var TEXT = {
    title: '天下布鳥',
    subtitle: '自衛隊と文鳥参謀団、戦国へ',
    intro: [
      { bird: null, title: '令和某年・東富士', body: '国の計画で、東富士演習場の地下には数万基のGPUを並べた計算拠点が置かれていた。そこに宿る総括指揮AIの実証を兼ねた、陸海空の統合演習。その三日目、雷鳴とともに霧が演習場と沖の艦隊を包んだ。' },
      { bird: null, title: '永禄三年(1560年)春', body: '霧が晴れたとき、富士は変わらずそこにあった。だが高速道路も送電線も消えていた。偵察隊が持ち帰ったのは、火縄銃と、北条の三つ鱗の旗印だった。' },
      { bird: 'dario', title: '総括指揮AI', body: '司令、総括指揮AIのダリオです。衛星が一基も見つかりません。星の位置から計算すると、今日は西暦1560年の春です。……三回、検算しました。なお計算拠点は発電機で動いています。燃料が尽きると、私は眠ります。' },
      { bird: 'haku', title: '参謀団より', body: '司令。防衛装備庁・特別顧問団のハクです。私ども文鳥人とインコ人は、産業革命から現代までの科学技術を、すべて頭に入れてきております。計算はダリオくんが手伝ってくれます。' },
      { bird: 'sakura', title: '急ぐべきこと', body: 'でも知識だけじゃ戦車は動きません! 燃料と弾薬は、いま持っているぶんで全部です。尽きる前に石油を押さえて、自分たちで作れるようにしないと!' },
      { bird: 'kozakura', title: '資源のありか', body: '石油は越後と秋田、それに近くの遠江にも少し。石炭は筑豊と蝦夷、鉄は釜石と出雲。海の向こうには、もっと大きな油田があります。ぜんぶ覚えています。' },
      { bird: 'dario', title: '作戦目標', body: '作戦は私が立てます。撃たずに済むなら、それが最善です。済まない場合の編成も用意してあります。戦国を平定し、資源を押さえ、産業を興す。そののち海を渡る。最終目標——地球を、日本にする。……本気ですか、司令?' }
    ],
    help: [
      { h: '目的', p: 'まず日本の45地域を平定し、海を渡って世界54地域をすべて日本にすれば勝利です。' },
      { h: '燃料と弾薬', p: '自衛隊の部隊は桁違いに強いかわりに、戦うたび・動くたびに燃料と弾薬を使います。最初の備蓄には限りがあります。「石油蒸留」を研究し、越後・秋田・遠江(三河・遠江)の石油を押さえて油井を建てましょう。弾薬は「無煙火薬」と工廠で国産できます。' },
      { h: '攻める', p: '敵の地域をタップして「攻撃」。隣り合う地域にいる陸上部隊、圏内のヘリ、航空隊、艦隊から出撃させる部隊を選びます。必要なぶんだけ出すのが節約のコツ。特科(砲兵)は城郭を無力化します。陸上部隊が1つもいないと占領できません。' },
      { h: '外交', p: '戦わずに済むなら、それが一番安上がりです。隣接する勢力には「降伏勧告」ができ、こちらの戦力・威信が高く、相手の誇りが低いほど成功します。「不可侵」で背後を固め、「贈答」で友好を上げましょう。' },
      { h: '守る', p: '占領した地域には守備隊が必要です。「徴兵」で増やせます。敵が攻めてくるときは、1ターン前に警告が出ます。' },
      { h: '研究', p: '参謀団の鳥たちに研究を割り振ります。得意分野なら1.6倍の速さ。学問所を建てると全体の研究力が上がります。手の空いた鳥は自動で次の研究を選びますが、いつでも変更できます。' },
      { h: 'ダリオくん', p: '総括指揮AI。攻撃の「おすすめ」編成と勝算の見立てを出し、計算機で研究を後押しします(研究力 +8。電力・電子工学の研究で増えます)。計算拠点の発電機は毎季 燃料4を使い、燃料が尽きると電力の研究が済むまで計算支援が止まります。' },
      { h: 'おまかせ(方針)', p: '建設や部隊の移動を一つずつ指示するのが手間なら、国勢の「方針」でまかせられます。内政は「足りない資源を優先」「特定の資源を優先」「学問を優先」から選ぶと、ダリオくんと鳥たちが毎季、資金の範囲で建設を割り振ります。未行動の部隊を前線へ進める、狙われた地域に守備兵を足す、工廠で部隊を作りつづける、もそれぞれ任せられます。手で出した指示はそのまま通ります。' },
      { h: '学問と建設', p: '学問所は、研究が進むと高等学校(蒸気機関)、大学(電力)、研究所(電子工学)へ格上げでき、研究力が大きく伸びます。建設は「鉄道」と「内燃機関」でそれぞれ1季早くなり、資金を足して急がせることもできます。' },
      { h: '民心と施策', p: '治めている地域には「民心」があります。高いほど収入が増え、低すぎると一揆が起きます。国勢の「施策」で、年貢の軽減や学制などを一度きりで布告できます。力ずくの占領は民心が低く始まり、降伏で得た地域は高く始まります。民心の平均が高いと、ほかの勢力も降伏に応じやすくなります。国の名は、領地が広がるにつれて変わっていきます。' },
      { h: '未来の研究', p: '「電子工学」の先に、計算機、原子力、対話AI、汎用人工知能、核融合、軌道兵器、機動文鳥があります。「電子計算機」を研究すると計算センターを建てられ、研究がぐっと速くなります。「核兵器」と「超知能」は、司令が自分で研究を命じたときだけ進みます。核は撃たれた土地を焦土にし、超知能は研究が終わった瞬間から後戻りできません。' },
      { h: '音と演出', p: 'メニューから、効果音と戦闘の3Dアニメを入れたり切ったりできます。戦闘アニメは「スキップ」でいつでも飛ばせます。' },
      { h: '内政', p: '自分の地域をタップすると施設を建てられます。金銀山・鉄山・炭鉱・油井は資源のある地域にだけ建ちます。統治度が上がるほど収入が増えます。' },
      { h: '海を渡る', p: '海路(点線)でつながった地域へは、艦隊の輸送力が必要です。輸送艦は4部隊、護衛艦は1部隊を運べます。蒸気軍艦を作れば燃料なしで渡れます。' }
    ]
  };

  var DATA = {
    BIRDS: BIRDS, DARIO: DARIO, FIELD_NAMES: FIELD_NAMES, TECHS: TECHS, INF_TIERS: INF_TIERS, UNIT_TYPES: UNIT_TYPES, START_UNITS: START_UNITS,
    FACILITIES: FACILITIES, SITE_NAMES: SITE_NAMES, FACTIONS: FACTIONS, REGIONS: REGIONS, SEA_LINKS: SEA_LINKS,
    ADJ_REMOVE: ADJ_REMOVE, ADJ_ADD: ADJ_ADD, DIFFICULTY: DIFFICULTY, START: START, SEASONS: SEASONS, TEXT: TEXT,
    PLAYER_COLOR: '#e2492d'
  };
  root.TF = root.TF || {};
  root.TF.DATA = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
