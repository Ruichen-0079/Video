// 五 · 散（33.5–41 小节）：她独自走过的几百年
//
// 又回到长卷，但卷走得越来越快——时间在加速。
// 河水从马远的波纹，渐渐变成直线、格线：明朝的资本、近代化、工业。
// 她以各种身份活动，从不宣布真实身份：「才女」「废奴」「军官」，各用一种字体。
// 许多短线靠近她，又离开；她的线始终只有一条。伤一直跟着她。
// 他在卷底沉睡：一行很淡的虚点。
// 重逢之后，镜头退远：近代考古把散落的身份连成一条线。

import { bar, BAR } from '../timeline.js';
import { brush, C } from '../draw.js';
import { hash, noise2, fbm2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { inkWrite, seal, drawText, drawVText, FONTS } from '../fx.js';

const T0 = bar(33.5);
// 速度：从 150 加速到 620（设计像素/秒），用解析积分得到卷上位置
const V0 = 150, V1 = 620, TA = bar(33.5), TB = bar(38.6);
function uAt(t) {
  const d = Math.min(t, TB) - TA;
  const D = TB - TA;
  // v(t) = V0 + (V1-V0) * (d/D)^2  →  积分
  let u = V0 * d + (V1 - V0) * Math.pow(Math.max(0, d), 3) / (3 * D * D);
  if (t > TB) {
    // 重逢之后慢下来
    const e = t - TB;
    u += V1 * 2.0 * (1 - Math.exp(-e / 2.0));
  }
  return u;
}
const HEAD = 0.36;
const yZi = (u) => 560 + 36 * Math.sin(u * 0.0011 + 0.4) + 14 * noise2(u * 0.002, 5.3);
const yMing = (u) => 905;

const E = {
  ming: 34.1, xiucai: 34.7, modern: 35.3, abolish: 35.9, navy: 36.5, officer: 37.1, wake: 38.4, meet: 39.0,
  zoomA: 39.5, zoomB: 40.4, note: 40.0, exit: 40.75,
};
const U = Object.fromEntries(Object.entries(E).map(([k, v]) => [k, uAt(bar(v))]));

// 靠近又离开的线
const SUITORS = [];
{
  const r = rng(1776);
  for (let i = 0; i < 9; i++) {
    const b = 34.0 + i * 0.5 + r() * 0.3;
    SUITORS.push({ a: uAt(bar(b)), b: uAt(bar(b + 0.55 + r() * 0.3)), side: r() < 0.5 ? -1 : 1, seed: r() * 50 });
  }
}
// 众生（更密、更短：近代人口）
const LIVES = [];
{
  const r = rng(1840);
  for (let u = -400; u < U.exit + 3000; u += 6 + r() * 7) LIVES.push({ u, len: 40 + r() * 70, y: 380 + r() * 460, curve: (r() - 0.5) * 24, dark: 0.2 + r() * 0.45, seed: r() * 100 });
}

export default {
  name: 'ages',
  start: bar(33.3), end: bar(41.2), post: 0,
  render(f) {
    const { t, W, H, S, I, ink, post } = f;
    // 退远（考古）：缩小并平移，让散落的身份同时出现在画面里
    const zu = easeInOut(clamp((t - bar(E.zoomA)) / (bar(E.zoomB) - bar(E.zoomA))));
    const zoom = lerp(1, 0.3, zu);
    const cyz = H * 0.52;
    const uh = uAt(t);
    const hx = W * HEAD;
    const uc = lerp(uh - (W * 0.5 - hx) / S, (U.xiucai + uh) / 2 - 150, zu);   // 画面中心对应的卷上位置
    const X = (u) => W * 0.5 + (uc - u) * S * zoom;
    const Y = (y) => cyz + (y * S - cyz) * zoom;
    const uAtX = (x) => uc - (x - W * 0.5) / (S * zoom);
    const uL = uAtX(W + 40) - 60, uR = uAtX(-40) + 60;
    const zs = zoom * S;
    const ls = Math.max(zoom, 0.6) * S;       // 文字在退远时不缩得太小

    // 从「沉睡」的光中翻出纸：白边的光烧
    const opening = t < bar(34.4);
    post.paper = opening ? 0 : 1;
    if (opening) {
      post.burn = Math.pow(clamp((t - bar(33.6)) / (bar(34.4) - bar(33.6))), 1.4) * 1.6 - 0.02;
      post.burnMode = 2;
      post.burnC = [0.5 * W / H, 0.22];
      post.inkSel = 1; post.lightSel = -1;
    }
    post.exposure = 0.86;
    post.paperCol = [0.86, 0.79, 0.64];
    post.vignette = 0.7;

    const modern = smooth(bar(35.0), bar(37.2), t);
    // ── 水 → 直线 → 格
    const nW = 30, TOP = 360, BOT = 880;
    for (let i = 0; i < nW; i++) {
      const base = TOP + (i + 0.5) * (BOT - TOP) / nW;
      const pts = [];
      for (let x = -40; x <= W + 40; x += 8 * S) {
        const u = uAtX(x);
        const loc = modern * smooth(uAt(bar(35.0)), uAt(bar(37.2)), u);   // 近代只出现在卷上较晚的部分
        const amp = (6 + 5 * noise2(u * 0.002, i * 0.7)) * (1 - loc);
        const y = base + amp * Math.sin(u * 0.018 + hash(i * 3.3) * 6.28 + t * 1.1);
        pts.push(x, Y(y));
      }
      brush(I, pts, 1.4 * zs, C.inkBlack, 0.24 + 0.1 * hash(i), i * 7.1, { taper: 0.02, dry: 0.15 * (1 - modern) });
    }
    // 竖格线：只在近代的部分
    if (modern > 0) {
      const uM = uAt(bar(35.6));
      const step = 46;
      const k0 = Math.ceil(Math.max(uL, uM) / step), k1 = Math.floor(uR / step);
      for (let k = k0; k <= k1; k++) {
        const u = k * step;
        const a = 0.18 * smooth(uM, uM + 600, u);
        if (a <= 0.01) continue;
        brush(I, [X(u), Y(TOP), X(u), Y(BOT)], 1.0 * zs, C.inkBlack, a, k, { taper: 0.0, dry: 0 });
      }
    }
    // 岸
    for (const yb of [TOP - 18, BOT + 16]) {
      const pts = [];
      for (let x = -40; x <= W + 40; x += 12 * S) { const u = uAtX(x); pts.push(x, Y(yb + 8 * fbm2(u * 0.004, yb) * (1 - modern))); }
      brush(I, pts, 2.6 * zs, C.inkBlack, 0.35, yb, { taper: 0.01, dry: 0.4 });
    }

    // ── 众生
    for (const l of LIVES) {
      if (l.u > uh || l.u + l.len < uL || l.u > uR) continue;
      const e = Math.min(l.u + l.len, uh);
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const u = l.u + (e - l.u) * (k / 6);
        const s = (u - l.u) / l.len;
        pts.push(X(u), Y(l.y + Math.sin(s * Math.PI) * l.curve * (1 - modern * 0.7)));
      }
      brush(I, pts, 2.6 * zs, C.inkBlack, l.dark * 1.2, l.seed, { taper: 0.25, dry: 0.3 });
    }

    // ── 她
    {
      const pts = [], sp = [];
      const a = uL, b = Math.min(uR, uh);
      for (let u = b; u >= a; u -= 6) { pts.push(X(u), Y(yZi(u))); sp.push(X(u), Y(yZi(u) - 6)); }
      brush(I, pts, 4.0 * zs, C.inkBlue, 1.0, 5.5, { taper: 0.0, dry: 0.35 });
      brush(I, sp, 2.2 * zs, C.inkRed, 0.9, 8.8, { taper: 0.0, dry: 0.2 });
      I.dot(X(uh), Y(yZi(uh)), 5 * zs, ...C.inkBlue, 1.0);
    }
    // 靠近又离开的线
    for (const s of SUITORS) {
      if (uh < s.a) continue;
      const e = Math.min(uh, s.b);
      const pts = [];
      for (let u = s.a; u <= e; u += 6) {
        const q = (u - s.a) / (s.b - s.a);
        const d = 150 * Math.pow(1 - Math.sin(q * Math.PI), 1.6) + 14;
        pts.push(X(u), Y(yZi(u) + s.side * d));
      }
      if (pts.length > 3) brush(I, pts, 2.4 * zs, C.inkBlack, 0.6, s.seed, { taper: 0.2, dry: 0.3 });
    }

    // ── 他：卷底的一行虚点（沉睡），在重逢前醒来，升起，与她并行
    {
      const pts = [];
      const a = uL, b = Math.min(uR, uh);
      const wakeU = U.wake, meetU = U.meet;
      for (let u = a; u <= b; u += 4) {
        if (u < wakeU) {
          // 虚点：每 26 个单位一点，随呼吸明暗
          if (Math.abs((u % 26)) < 4) I.dot(X(u), Y(yMing(u)), 2.0 * zs, ...C.inkBlack, 0.3 + 0.15 * Math.sin(t * 1.2));
        }
      }
      if (uh > wakeU) {
        const e = Math.min(uh, uR);
        for (let u = Math.max(wakeU, uL); u <= e; u += 5) {
          const q = easeInOut(clamp((u - wakeU) / (meetU - wakeU)));
          pts.push(X(u), Y(lerp(yMing(u), yZi(u) + 16, q)));
        }
        if (pts.length > 3) brush(I, pts, 4.0 * zs, C.inkBlack, 1.0, 3.0, { taper: 0.0, dry: 0.35 });
        I.dot(X(Math.min(uh, uR)), Y(lerp(yMing(uh), yZi(uh) + 16, easeInOut(clamp((uh - wakeU) / (meetU - wakeU))))), 5 * zs, ...C.inkBlack, 1.0);
      }
    }

    // ── 时代的标记
    const sealA = (b0) => smooth(bar(b0) - 0.2, bar(b0) + 0.25, t);
    seal(f, '明', X(U.ming), Y(960), 66 * zs, sealA(E.ming), 0.02);
    const note = (str, u, b0, y = 960) => drawText(ink, str, X(u) - 46 * zs, Y(y), { font: FONTS.serif, size: 21 * zs, color: 'rgb(60,52,44)', align: 'left', alpha: smooth(bar(b0), bar(b0 + 0.4), t) * 0.9, spacing: 0.12 });
    note('资本', U.ming + 20, E.ming + 0.2, 960);
    drawText(ink, '近 代 化', X(U.modern), Y(960), { font: FONTS.serif, size: 22 * zs, color: 'rgb(50,44,38)', align: 'center', alpha: smooth(bar(E.modern), bar(E.modern + 0.3), t) * 0.9 });
    drawText(ink, '工业 · 海军', X(U.navy), Y(960), { font: FONTS.serifB, size: 22 * zs, color: 'rgb(40,36,32)', align: 'center', alpha: smooth(bar(E.navy), bar(E.navy + 0.3), t) * 0.9 });

    // ── 她的身份：每一个都用不同的字
    const idA = (b0) => clamp((t - bar(b0)) / 1.0);
    const ziC = [0.06, 0.16, 0.36];
    inkWrite(f, '才女', X(U.xiucai), Y(130), 52 * ls, idA(E.xiucai), { vertical: true, align: 'top', color: ziC });
    drawVText(ink, '废奴', X(U.abolish), Y(130), { font: FONTS.serifB, size: 52 * ls, color: 'rgb(16,42,92)', reveal: (t - bar(E.abolish)) * 4 });
    drawVText(ink, '军官', X(U.officer), Y(130), { font: FONTS.serif, size: 52 * ls, color: 'rgb(16,42,92)', reveal: (t - bar(E.officer)) * 4 });
    drawText(ink, '美利坚', X(U.officer) + 34 * ls, Y(150), { font: FONTS.serif, size: 18 * ls, color: 'rgb(60,52,44)', align: 'left', alpha: smooth(bar(E.officer + 0.2), bar(E.officer + 0.5), t) * 0.9 });

    // ── 考古：朱笔圈出散落的身份，连成一条线
    const arch = smooth(bar(E.note - 0.2), bar(E.note + 0.6), t);
    if (arch > 0) {
      const ids = [U.xiucai, U.abolish, U.officer].map((u) => [X(u), Y(130) + 56 * ls]);
      ink.save();
      ink.strokeStyle = `rgba(190,40,30,${0.85 * arch})`;
      ink.lineWidth = 2.2 * S;
      ink.setLineDash([7 * S, 6 * S]);
      ids.forEach(([x, y], i) => {
        ink.beginPath();
        ink.ellipse(x, y, 50 * ls, 80 * ls, 0.05 * (i - 1), -1.6, -1.6 + 6.283 * clamp(arch * 1.4 - i * 0.15));
        ink.stroke();
      });
      // 连线：沿着圈与圈之间
      const k = clamp(arch * 1.3 - 0.2) * (ids.length - 1);
      ink.beginPath();
      for (let i = 0; i < ids.length - 1; i++) {
        if (k <= i) break;
        const q = Math.min(1, k - i);
        const [x0, y0] = ids[i], [x1, y1] = ids[i + 1];
        const a = x0 - 52 * ls, b = x1 + 52 * ls;
        ink.moveTo(a, y0); ink.lineTo(lerp(a, b, q), lerp(y0, y1, q));
      }
      ink.stroke();
      ink.restore();
      drawText(ink, '注：以上诸人，或为同一人。—— 近代考古', W * 0.5, H * 0.9, { font: FONTS.serif, size: 26 * S, color: 'rgb(150,36,28)', align: 'center', alpha: smooth(bar(E.note + 0.3), bar(E.note + 0.7), t), spacing: 0.08 });
    }

    // ── 出：光从两条线交汇处烧穿纸，进入城市的夜
    if (t > bar(E.exit)) {
      post.burn = Math.pow((t - bar(E.exit)) / (bar(41.15) - bar(E.exit)), 1.3) * 1.6 - 0.02;
      post.burnMode = 2;
      const p = [X(U.meet + 120), Y(yZi(U.meet))];
      post.burnC = [p[0] / H, 1 - p[1] / H];
      post.inkSel = -1; post.lightSel = 1;
    }
  },
};
