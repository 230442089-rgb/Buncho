// ================= 「外神竜に会いに行こう」：時刻・カメラ・小さな道具 =================
const ADF = s => Math.round(s * 30);   // 秒 → コマ
const EZ = { ios: x => 0.5 - 0.5 * Math.cos(Math.PI * adClamp(x)), oc: x => 1 - Math.pow(1 - adClamp(x), 3), lin: x => adClamp(x) };
const adK = (t, a, b, ez = EZ.lin) => ez((t - a) / (b - a));
const adV3 = (p0, p1, k) => [0, 1, 2].map(i => adLerp(p0[i], p1[i], k));
function adFov(v) { if (Math.abs(camera.fov - v) > 1e-6) { camera.fov = v; camera.updateProjectionMatrix(); } }
function adCamK(k, p0, l0, p1, l1, fov0, fov1) { adCam(adV3(p0, p1, k), adV3(l0, l1, k)); if (fov0) adFov(adLerp(fov0, fov1 ?? fov0, k)); }
// 区域の毎コマの処理のあとに、光などを上書きする
function adTickPost(a, fn) { if (!a.adTk0) a.adTk0 = a.tick || null; a.tick = (a2, dt) => { if (a.adTk0) a.adTk0(a2, dt); fn(a2, dt); }; }
function adFill(c, col, a = 1) { if (a <= 0) return; c.save(); c.globalAlpha = adClamp(a); c.fillStyle = col; c.fillRect(0, 0, 1920, 1080); c.restore(); }
// くの字の鳥の影（羽ばたき）
function adBird(c, x, y, w, ang, col) { c.save(); c.translate(x, y); c.strokeStyle = col; c.lineWidth = Math.max(3, w * 0.18); c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-w / 2, -Math.sin(ang) * w * 0.35); c.lineTo(0, w * 0.08); c.lineTo(w / 2, -Math.sin(ang) * w * 0.35); c.stroke(); c.restore(); }
