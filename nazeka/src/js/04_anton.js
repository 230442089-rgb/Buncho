// ───────── アントン・シガー ─────────
// 理由は分からない。全力で走ってくる。こちらより速い。離れているほど、さらに速い。
// 姿が見えているか、足音が聞こえているあいだは、まっすぐ追ってくる（chase）。
// 角を曲がられて姿を見失うと、最後に見た場所まで走ってきて、立ち止まって見回す（look）。
//   見回して姿があれば、また追う。なければ、ありそうな方へ探しに走る（search）。
// 速いぶん、角では大きく膨らんで遅くなる。だから、角を曲がるたびに、間が開く。
const Anton = (() => {
  const A = { J: null, x: 0, z: 0, yaw: 0, st: 'stand', t: 0, ph: 0, v: 0, speed: 0, guess: 0, lkp: { x: 0, z: 0 }, lkpT: 0, blind: 0, lost: false, F: null, ft: -1, tgt: null, sees: false, d: 99, stuck: 0 };
  const ts = PRM.tile, cx = t => (t + 0.5) * ts;
  // 暗い道でも姿が分かるように、彼の少し前の上から、うすい光を当てつづける
  function init(scene) { A.J = Body.mk(Body.ANTON); scene.add(A.J.root); A.light = new THREE.PointLight(C3(0xffe6c8), PRM.antonLight, 8, 1.5); scene.add(A.light); }
  function reset(day) {
    const s = Town.antonStart; A.x = cx(s.tx); A.z = cx(s.tz); A.st = 'stand'; A.t = 0; A.ph = 0; A.v = 0; A.lkpT = 0; A.blind = 0; A.lost = false; A.F = null; A.ft = -1; A.tgt = null; A.stuck = 0; A.px = cx(Town.start.tx); A.pz = cx(Town.start.tz);
    A.speed = PRM.antonRun * (1 + PRM.antonDay * (day - 1));
    A.guess = Math.min(0.85, PRM.guess + PRM.guessDay * (day - 1));
    A.J.root.visible = true; A.J.root.rotation.set(0, 0, 0); if (A.J.bolt) A.J.bolt.scale.y = 0.01;
  }
  // 行き先の区画までの道のりを出しておく（行き先が変わったときだけ）
  function fieldTo(tx, tz) { const k = Town.idx(tx, tz); if (k !== A.ft) { A.ft = k; A.F = Town.bfs(tx, tz); } return A.F; }
  // (x, z) へ向かうとき、いま目指す点。同じ区画か、見通せるなら直接。そうでなければ道なりに、つぎの区画の中央
  function waypoint(x, z) {
    const tx = Town.tileOf(x), tz = Town.tileOf(z), ax = Town.tileOf(A.x), az = Town.tileOf(A.z);
    if ((tx === ax && tz === az) || Town.los(A.x, A.z, x, z)) return { x, z };
    const F = fieldTo(tx, tz); let best = null, bd = F[Town.idx(ax, az)]; if (bd < 0) bd = 1e9;
    for (const v of Town.D4) { const nx = ax + v[0], nz = az + v[1]; if (!Town.road(nx, nz)) continue; const d = F[Town.idx(nx, nz)]; if (d >= 0 && d < bd) { bd = d; best = { x: cx(nx), z: cx(nz) }; } }
    return best || { x: cx(ax), z: cx(az) };
  }
  function found(P) { A.lkp.x = P.x; A.lkp.z = P.z; A.lkpT = 0; A.blind = 0; A.st = 'chase'; if (A.lost) { A.lost = false; Game.onFound(); } }
  function update(dt, P) {
    const J = A.J, dx = P.x - A.x, dz = P.z - A.z, d = Math.hypot(dx, dz);
    A.d = d;
    const los = d < PRM.see && Town.los(A.x, A.z, P.x, P.z);
    const hears = (P.running && d < PRM.hearRun) || (P.moving && d < PRM.hearWalk);
    if (A.st === 'stand') {   // 街灯の下に立って、こちらを見ている。少しして、走りだす
      A.sees = los; A.yaw = Math.atan2(dx, dz); A.t += dt; Body.stand(J, A.t);
      if (A.t >= PRM.stand || d < 13 || Math.hypot(P.x - A.px, P.z - A.pz) > PRM.standMove) { A.st = 'chase'; A.lkp.x = P.x; A.lkp.z = P.z; A.blind = 0; Snd.sfx('sting'); Game.onRun(); }
      place(); return;
    }
    // 夜なので、いちど姿を見失うと、最後に見た場所で見回すまでは、遠くの姿には気づかない。近ければ気づく。探して走っているあいだは、見えれば気づく
    A.sees = los && (d < PRM.near || A.st === 'search' || (A.st === 'chase' && A.blind < PRM.lose));
    if (A.sees || hears) found(P);
    else { A.blind += dt; A.lkpT += dt; if (A.lkpT >= PRM.ping) { A.lkpT = 0; A.lkp.x = P.x; A.lkp.z = P.z; A.st = 'chase'; } }   // 見失ったままでも、やがて気配に気づいて、そこへ来る
    let want = 0, goal = null;
    if (A.st === 'chase') {
      goal = waypoint(A.lkp.x, A.lkp.z); want = A.speed * (1 + PRM.antonFar * smooth((d - 14) / 20));
      if (!A.sees && !hears && Math.hypot(A.lkp.x - A.x, A.lkp.z - A.z) < 1.5) { A.st = 'look'; A.t = 0; }
    } else if (A.st === 'look') {
      // 立ち止まって見回す。姿があれば、また追う。なければ、ありそうな道を選ぶ（こちらが実際に行った方を選ぶことが多い）
      A.t += dt; A.yaw += Math.sin(A.t * 9) * 3.2 * dt;
      if (A.t >= PRM.lookPause) {
        if (los) found(P);
        else {
          const ax = Town.tileOf(A.x), az = Town.tileOf(A.z), opts = Town.D4.filter(v => Town.road(ax + v[0], az + v[1]));
          let pickV = null;
          if (Math.random() < A.guess) { let bs = -1e9; for (const v of opts) { const sc = v[0] * (P.x - A.x) + v[1] * (P.z - A.z); if (sc > bs) { bs = sc; pickV = v; } } }
          if (!pickV) pickV = pick(opts.length ? opts : [[0, 1]]);
          let k = 1; while (k < 4 && Town.road(ax + pickV[0] * (k + 1), az + pickV[1] * (k + 1))) k++;
          A.tgt = { x: cx(ax + pickV[0] * k), z: cx(az + pickV[1] * k) }; A.st = 'search';
          if (!A.lost) { A.lost = true; Game.onLost(); }
        }
      }
    } else if (A.st === 'search') {
      goal = waypoint(A.tgt.x, A.tgt.z); want = PRM.antonSearch;
      if (Math.hypot(A.tgt.x - A.x, A.tgt.z - A.z) < 1.3) { A.st = 'look'; A.t = 0; }
    }
    // 向きを変えながら前へ走る。向きが合っていないほど遅い（＝角で膨らんで遅くなる）
    if (goal) {
      const wantYaw = Math.atan2(goal.x - A.x, goal.z - A.z), df = angDiff(wantYaw, A.yaw), turn = PRM.antonTurn * dt;
      A.yaw += clamp(df, -turn, turn);
      want *= 0.42 + 0.58 * Math.max(0, Math.cos(df));
    }
    A.v += (want - A.v) * Math.min(1, dt * (want > A.v ? 3.2 : 7));
    const ox = A.x, oz = A.z;
    A.x += Math.sin(A.yaw) * A.v * dt; A.z += Math.cos(A.yaw) * A.v * dt; Town.collide(A, 0.34);
    // 壁に引っかかって進めていないときは、いまいる区画の中央へ寄る
    const moved = Math.hypot(A.x - ox, A.z - oz);
    if (want > 1 && moved < A.v * dt * 0.35) { A.stuck += dt; if (A.stuck > 0.3) { const qx = cx(Town.tileOf(A.x)), qz = cx(Town.tileOf(A.z)); A.x += (qx - A.x) * Math.min(1, dt * 4); A.z += (qz - A.z) * Math.min(1, dt * 4); } } else A.stuck = 0;
    // 走る姿と、足音
    const amt = clamp(A.v / 7, 0, 1.08), p0 = A.ph; A.ph += dt * (2.2 + A.v * 1.25);
    if (A.v > 0.4) Body.run(J, A.ph, amt, true); else Body.stand(J, A.t + A.ph);
    if (A.v > 1 && Math.floor(A.ph / Math.PI) !== Math.floor(p0 / Math.PI) && d < 40) {
      const rel = angDiff(Math.atan2(A.x - P.x, A.z - P.z), P.yaw);
      Snd.sfx('astep', { v: Math.pow(clamp(1.15 - d / 34, 0.03, 1), 1.6), pan: clamp(-Math.sin(rel) * 0.9, -1, 1) });   // 近づくほど、はっきり大きくなる
    }
    place();
    if (d < PRM.catchDist && los) Game.caught();
  }
  function place() { const r = A.J.root; r.position.set(A.x, 0, A.z); r.rotation.y = A.yaw; Body.hose(A.J); A.light.position.set(A.x + Math.sin(A.yaw) * 1.2, 2.5, A.z + Math.cos(A.yaw) * 1.2); }
  return Object.assign(A, { init, reset, update, place });
})();
