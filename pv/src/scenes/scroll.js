// 二 · 流（8–18 小节）：历史是一幅长卷
//
// 长卷自右向左展开，时间向左流。画面中有一个固定的「笔尖」位置，
// 纸从它下面向右移动——每一个生命都在笔尖处被写下：
// 众生是一道道短笔；明布川是一根不断的线；后来又有了子馥幽。
// 河水用马远《水图》式的白描线。朝代以朱印标出。

import { bar, BAR } from '../timeline.js';
import { brush, inkBlot, C } from '../draw.js';
import { hash, noise2, fbm2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { inkWrite, seal, drawText, drawVText, FONTS } from '../fx.js';

const T0 = bar(8);
const SPEED = 118;                 // 纸的移动速度（设计像素/秒）
const uAt = (t) => (t - T0) * SPEED;            // 时间 → 卷上位置
const HEAD = 0.36;                 // 笔尖在屏幕上的横向位置（比例）

// 河道（设计坐标，1080 高）
const RIVER_TOP = 360, RIVER_BOT = 880;
const yMing = (u) => 560 + 40 * Math.sin(u * 0.0021 + 1.2) + 12 * noise2(u * 0.004, 1.7);
const yZi = (u) => 700 + 30 * Math.sin(u * 0.0026 + 0.4) + 10 * noise2(u * 0.004, 5.3);

// 众生：短笔
const LIVES = [];
{
  const r = rng(2026);
  for (let u = -600; u < 4400; u += 5 + r() * 8) {
    LIVES.push({ u, len: 40 + r() * 90, y: RIVER_TOP + 25 + r() * (RIVER_BOT - RIVER_TOP - 50), curve: (r() - 0.5) * 30, dark: 0.25 + r() * 0.5, seed: r() * 100 });
  }
}

// 事件（以小节计）
const E = {
  xia: 8.5, mingBorn: 8.75, shang: 10.5, zhou: 11.5,
  loveA: 9.6, loveB: 10.9,
  geniusA: 11.55, cut: 12.5, branchEnd: 13.6, purge: 13.65, recluseA: 13.7, recluseB: 14.8,
  turbA: 14.0, turbB: 16.6, ziBorn: 14.25, fall: 15.25, scar: 16.0, flood: 17.0,
};
const U = Object.fromEntries(Object.entries(E).map(([k, v]) => [k, uAt(bar(v))]));

export default {
  name: 'scroll',
  start: bar(8) - 1.0, end: bar(18), post: 0.5,
  render(f) {
    const { t, W, H, S, I, ink, post } = f;
    const uh = uAt(t);
    const hx = W * HEAD;
    const sx = (u) => hx + (uh - u) * S;           // 卷上位置 → 屏幕 x
    const uL = uh - (W - hx) / S - 40, uR = uh + hx / S + 40; // 可见范围（右边是过去）
    // 卷首：书海场景的火正在烧穿夜（paper=0，烧穿处显示纸）
    const opening = t < bar(8) + 0.85;
    post.paper = opening ? 0 : 1;
    post.exposure = 0.86;
    post.paperCol = [0.86, 0.79, 0.64];
    post.vignette = 0.7;
    const turb = smooth(bar(E.turbA), bar(E.turbA + 0.6), t) * (1 - smooth(bar(E.turbB - 0.6), bar(E.turbB), t));

    // ── 河水：马远式的水纹，画在纸上（随纸移动），同时缓缓流动
    const nW = 30;
    for (let i = 0; i < nW; i++) {
      const base = RIVER_TOP + (i + 0.5) * (RIVER_BOT - RIVER_TOP) / nW;
      const pts = [];
      const phase = hash(i * 3.3) * 6.28;
      for (let x = -20 * S; x <= W + 20 * S; x += 7 * S) {
        const u = uh - (x - hx) / S;
        const amp = 6 + 5 * noise2(u * 0.002, i * 0.7) + turb * (10 + 14 * noise2(u * 0.004 + t * 0.3, i));
        const y = base + amp * Math.sin(u * (0.018 + 0.004 * Math.sin(i)) + phase + t * 1.1)
          + 4 * Math.sin(u * 0.051 + phase * 2 - t * 0.7) * (0.6 + turb);
        pts.push(x, y * S);
      }
      const edge = Math.min(i, nW - 1 - i) / 3;
      brush(I, pts, 1.5 * S, C.inkBlack, (0.26 + 0.14 * hash(i)) * Math.min(1, 0.45 + edge), i * 7.1, { taper: 0.02, dry: 0.2 });
    }
    // 河岸：两道粗一些的干笔
    for (const [yb, sd] of [[RIVER_TOP - 18, 1], [RIVER_BOT + 16, 2]]) {
      for (let k = 0; k < 3; k++) {
        const pts = [];
        for (let x = -20 * S; x <= W + 20 * S; x += 10 * S) {
          const u = uh - (x - hx) / S;
          pts.push(x, (yb + 9 * fbm2(u * 0.004, sd * 3 + k) + k * 5) * S);
        }
        brush(I, pts, (3.2 - k) * S, C.inkBlack, 0.35 - k * 0.09, sd * 11 + k, { taper: 0.01, dry: 0.5 });
      }
    }

    // ── 众生：只写到笔尖为止
    for (const l of LIVES) {
      if (l.u > uh || l.u + l.len < uL || l.u > uR) continue;
      const e = Math.min(l.u + l.len, uh);
      const pts = [];
      const n = 8;
      for (let k = 0; k <= n; k++) {
        const u = l.u + (e - l.u) * (k / n);
        const s = (u - l.u) / l.len;
        pts.push(sx(u), (l.y + Math.sin(s * Math.PI) * l.curve - s * 6 + turb * 8 * Math.sin(u * 0.03)) * S);
      }
      const fresh = 1 - smooth(0, 900, uh - l.u);   // 旧的笔迹慢慢淡去
      brush(I, pts, 3.0 * S, C.inkBlack, Math.min(1, l.dark * (0.5 + 0.5 * fresh) * 1.6), l.seed, { taper: 0.25, dry: 0.3 });
    }

    // ── 明布川：不断的线
    if (uh > U.mingBorn) {
      const pts = [];
      const a = Math.max(uL, U.mingBorn), b = Math.min(uR, uh);
      for (let u = b; u >= a; u -= 5) pts.push(sx(u), yMing(u) * S);
      const recl = (u) => 1 - 0.7 * smooth(U.recluseA - 30, U.recluseA + 60, u) * (1 - smooth(U.recluseB - 60, U.recluseB + 30, u));
      // 压力随卷上位置变化（隐居时变细变淡）
      const u0 = b, du = b - a;
      brush(I, pts, 4.0 * S, C.inkBlack, 1.0, 3.0, { taper: 0.0, dry: 0.35, pressure: (s) => recl(u0 - s * du) });
      // 出生的一点
      if (U.mingBorn > uL) I.dot(sx(U.mingBorn), yMing(U.mingBorn) * S, 4 * S, ...C.inkBlack, 0.9);
      // 笔尖
      I.dot(hx, yMing(uh) * S, 5 * S, ...C.inkBlack, 1.0);
    }

    // 早年的恋情：一条并行一段又离开的线
    if (uh > U.loveA) {
      const pts = [];
      const e = Math.min(uh, U.loveB);
      for (let u = U.loveA; u <= e; u += 5) {
        const s = (u - U.loveA) / (U.loveB - U.loveA);
        pts.push(sx(u), (yMing(u) - 14 - 120 * Math.pow(s, 2.2)) * S);
      }
      if (pts.length > 3) brush(I, pts, 2.8 * S, C.inkBlack, 0.7, 9.2, { taper: 0.25, dry: 0.3, pressure: (s) => 1 - s * 0.6 });
    }

    // ── 周：天才、斩、流派、清洗
    if (uh > U.geniusA) {
      const pts = [];
      const e = Math.min(uh, U.cut);
      for (let u = U.geniusA; u <= e; u += 5) {
        const s = clamp((u - U.geniusA) / 160);
        pts.push(sx(u), (yMing(u) + 70 - 52 * easeOut(s)) * S);
      }
      if (pts.length > 3) brush(I, pts, 3.2 * S, C.inkBlack, 0.9, 4.4, { taper: 0.15, dry: 0.3 });
    }
    // 断臂之后：许多僵直的线（负伤流派），上手快，却彼此一样
    if (uh > U.cut) {
      const cy = yMing(U.cut) + 18;
      const e = Math.min(uh, U.branchEnd);
      for (let k = 0; k < 13; k++) {
        const ang = (k / 12 - 0.5) * 1.1;
        const pts = [];
        for (let u = U.cut; u <= e; u += 8) {
          const d = u - U.cut;
          pts.push(sx(u), (cy + Math.tan(ang) * d * 0.55 + 40) * S);
        }
        if (pts.length > 2) brush(I, pts, 2.2 * S, C.inkBlack, 0.75, 20 + k, { taper: 0.04, dry: 0 });
      }
    }
    // 清洗：一片墨晕盖住它们
    const purge = smooth(bar(E.purge), bar(E.purge + 0.5), t);
    if (purge > 0) {
      const cu = (U.cut + U.branchEnd) / 2, cy = yMing(U.cut) + 60;
      const x = sx(cu), y = cy * S;
      ink.save();
      ink.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 14; k++) {
        const ox = (hash(k * 1.3) - 0.5) * 260 * S, oy = (hash(k * 2.9) - 0.5) * 130 * S;
        const rr = (90 + 120 * hash(k * 5.1)) * S * (0.4 + 0.6 * easeOut(purge));
        const g = ink.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
        g.addColorStop(0, `rgba(20,18,16,${0.22 * purge})`);
        g.addColorStop(0.7, `rgba(20,18,16,${0.12 * purge})`);
        g.addColorStop(1, 'rgba(20,18,16,0)');
        ink.fillStyle = g;
        ink.beginPath(); ink.arc(x + ox, y + oy, rr, 0, 6.283); ink.fill();
      }
      ink.restore();
    }
    // 朱砂一笔：斩
    const cutT = clamp((t - bar(E.cut)) / 0.18);
    if (cutT > 0) {
      const x = sx(U.cut), y = (yMing(U.cut) + 22) * S;
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const s = (k / 12) * cutT;
        pts.push(x - 70 * S + s * 150 * S, y - 95 * S + s * 190 * S + Math.sin(s * 3) * 6 * S);
      }
      brush(I, pts, 7 * S, C.inkRed, 0.95, 77, { taper: 0.25, dry: 0.4 });
    }

    // ── 末代亚人王朝：浪起，墨溅
    const fallT = smooth(bar(E.fall), bar(E.fall) + 0.6, t);
    if (fallT > 0) {
      const r = rng(311);
      const cx = sx(U.fall), cy = 640 * S;
      // 大块的墨团 + 甩出的墨点与墨线
      inkBlot(ink, cx + 20 * S, cy, 55 * S * easeOut(fallT), 1.0, 57, 5);
      for (let k = 0; k < 120; k++) {
        const ang = r() * 6.283, dist = (30 + Math.pow(r(), 0.7) * 330) * S * easeOut(fallT);
        const x = cx + Math.cos(ang) * dist * 1.5, y = cy + Math.sin(ang) * dist * 0.6;
        const rad = (1.5 + r() * r() * 7) * S;
        I.dot(x, y, rad, ...C.inkBlack, 0.6 + 0.4 * r());
        if (r() < 0.45) brush(I, [x, y, x + Math.cos(ang) * 60 * S, y + Math.sin(ang) * 24 * S], rad * 1.4, C.inkBlack, 0.6, k, { taper: 0.5, dry: 0 });
      }
    }

    // ── 子馥幽：石青的线，更晚出生，生长很慢
    if (uh > U.ziBorn) {
      const pts = [];
      const a = Math.max(uL, U.ziBorn), b = Math.min(uR, uh);
      for (let u = b; u >= a; u -= 5) pts.push(sx(u), yZi(u) * S);
      const grow = (u) => 0.35 + 0.65 * smooth(U.ziBorn, U.ziBorn + 500, u);
      const u0 = b, du = b - a;
      brush(I, pts, 4.0 * S, C.inkBlue, 1.0, 5.5, { taper: 0.0, dry: 0.35, pressure: (s) => grow(u0 - s * du) });
      if (U.ziBorn > uL) I.dot(sx(U.ziBorn), yZi(U.ziBorn) * S, 3.5 * S, ...C.inkBlue, 0.9);
      I.dot(hx, yZi(uh) * S, 5 * S, ...C.inkBlue, 1.0);
      // 伤：朱砂一道，此后一直伴随着她的线
      if (uh > U.scar) {
        const sp = [];
        const e = Math.min(uR, uh);
        for (let u = e; u >= Math.max(uL, U.scar); u -= 5) sp.push(sx(u), (yZi(u) - 6) * S);
        if (sp.length > 3) brush(I, sp, 2.2 * S, C.inkRed, 0.9, 8.8, { taper: 0.0, dry: 0.2 });
        const st = clamp((t - bar(E.scar)) / 0.15);
        const x = sx(U.scar), y = yZi(U.scar) * S;
        const p2 = [];
        for (let k = 0; k <= 10; k++) { const s = (k / 10) * st; p2.push(x + 40 * S - s * 80 * S, y - 60 * S + s * 120 * S); }
        brush(I, p2, 5 * S, C.inkRed, 0.9, 66, { taper: 0.3, dry: 0.4 });
      }
    }

    // ── 文字与印
    const lab = (str, u, y, size, p, opt = {}) => inkWrite(f, str, sx(u), y * S, size * S, p, { vertical: true, align: 'top', ...opt });
    const wp = (b0, dur) => clamp((t - bar(b0)) / dur);
    lab('明布川', U.mingBorn - 70, 90, 54, wp(9.0, 2.2));
    lab('最像亚人的人类', U.mingBorn - 135, 98, 26, wp(9.6, 2.6), { color: [0.25, 0.23, 0.2] });
    lab('子馥幽', U.ziBorn - 70, 90, 54, wp(14.5, 2.2), { color: [0.10, 0.22, 0.42] });
    lab('最像人的亚人', U.ziBorn - 135, 98, 26, wp(15.1, 2.6), { color: [0.2, 0.28, 0.42] });
    // 朝代：朱印
    const sealAt = (ch, u, b0) => seal(f, ch, sx(u), 960 * S, 66 * S, smooth(bar(b0) - 0.2, bar(b0) + 0.25, t), (hash(u) - 0.5) * 0.06);
    sealAt('夏', U.xia, E.xia);
    sealAt('商', U.shang, E.shang);
    sealAt('周', U.zhou, E.zhou);
    const na = smooth(bar(E.xia + 0.3), bar(E.xia + 0.9), t);
    drawText(ink, '夏、商、周，皆为后世史官所加之名', sx(U.xia) - 56 * S, 960 * S, { font: FONTS.serif, size: 21 * S, color: 'rgb(60,52,44)', align: 'left', alpha: na * 0.85, spacing: 0.15 });
    // 王朝覆灭的记载
    drawVText(ink, '末代亚人王朝覆灭', sx(U.fall) - 30 * S, 90 * S, { font: FONTS.serif, size: 24 * S, color: 'rgb(50,44,38)', reveal: (t - bar(E.fall)) * 8, alpha: 0.85 });

    // ── 洇：墨漫过纸，夜回来
    if (t > bar(E.flood)) {
      post.burn = Math.pow((t - bar(E.flood)) / BAR, 1.3) * 1.6 - 0.02;
      post.burnMode = 1;
      post.burnC = [hx / H, 1 - yZi(uh) / 1080];
      post.inkSel = -1;
      post.lightSel = 1;
    }
  },
};
