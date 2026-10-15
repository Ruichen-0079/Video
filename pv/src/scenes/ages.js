// 八 · 散（32.25–38 小节）：她独自走过的几百年
//
// 又回到长卷，卷越走越快——时间在加速。河水的波纹渐渐变成直线、格线。
// 她以各种身份活动，卷的上沿留下她的墨影：
//   书案前执笔的女子（诗书）；
//   三角帽、长外套、肩章，身后是帆船的桅杆（美利坚的军衔）。
// 许多短线靠近她的线，又离开；她的线始终只有一条，朱砂的伤一直跟着。
// 他在卷底沉睡：一行很淡的虚点。后来虚点连成线，升起来，与她并行。

import { bar, BAR } from '../timeline.js';
import { brush, C } from '../draw.js';
import { hash, noise2, fbm2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { beginMask, figure, smoothMask, maskToInk, STAND, study, ship } from '../silhouette.js';

const V0 = 140, V1 = 330, TA = bar(32.25), TB = bar(37.2);
function uAt(t) {
  const d = Math.min(t, TB) - TA;
  const D = TB - TA;
  let u = V0 * d + (V1 - V0) * Math.pow(Math.max(0, d), 3) / (3 * D * D);
  if (t > TB) { const e = t - TB; u += V1 * 1.6 * (1 - Math.exp(-e / 1.6)); }
  return u;
}
const HEAD = 0.36;
const RIVER_TOP = 500, RIVER_BOT = 900, BANK = RIVER_TOP - 18;
const yZi = (u) => 680 + 34 * Math.sin(u * 0.0011 + 0.4) + 12 * noise2(u * 0.002, 5.3);
const yMing = () => 905;

const E = { study: 32.95, america: 34.7, modernA: 34.2, modernB: 35.8, wake: 36.6, meet: 37.35, exit: 37.45 };
const U = Object.fromEntries(Object.entries(E).map(([k, v]) => [k, uAt(bar(v))]));

const SUITORS = [];
{
  const r = rng(1776);
  for (let i = 0; i < 7; i++) {
    const b = 32.9 + i * 0.55 + r() * 0.25;
    SUITORS.push({ a: uAt(bar(b)), b: uAt(bar(b + 0.5 + r() * 0.25)), side: r() < 0.5 ? -1 : 1, seed: r() * 50 });
  }
}
const LIVES = [];
{
  const r = rng(1840);
  for (let u = -400; u < 5200; u += 6 + r() * 7) LIVES.push({ u, len: 40 + r() * 70, y: RIVER_TOP + 30 + r() * (RIVER_BOT - RIVER_TOP - 60), curve: (r() - 0.5) * 24, dark: 0.2 + r() * 0.45, seed: r() * 100 });
}

export default {
  name: 'ages',
  start: bar(32.0), end: bar(38.2), post: 0,
  render(f) {
    const { t, W, H, S, I, post } = f;
    const uh = uAt(t);
    const hx = W * HEAD;
    const X = (u) => hx + (uh - u) * S;
    const uL = uh - (W - hx) / S - 60, uR = uh + hx / S + 60;

    // 从黄泉门前的那一点光烧穿到纸上
    const opening = t < bar(32.85);
    post.paper = opening ? 0 : 1;
    if (opening) {
      post.burn = Math.pow(clamp((t - bar(32.15)) / (bar(32.85) - bar(32.15))), 1.4) * 1.6 - 0.02;
      post.burnMode = 2;
      post.burnC = [0.5 * W / H, 0.4];
      post.inkSel = 1; post.lightSel = -1;
    } else { post.burn = -1; post.inkSel = 0; post.lightSel = 0; }
    post.exposure = 0.86;
    post.paperCol = [0.86, 0.79, 0.64];
    post.vignette = 0.7;

    // ── 水 → 直线 → 格线（只出现在卷上较晚的部分）
    const nW = 24;
    for (let i = 0; i < nW; i++) {
      const base = RIVER_TOP + (i + 0.5) * (RIVER_BOT - RIVER_TOP) / nW;
      const pts = [];
      for (let x = -40; x <= W + 40; x += 8 * S) {
        const u = uh - (x - hx) / S;
        const loc = smooth(U.modernA, U.modernB, u);
        const amp = (6 + 5 * noise2(u * 0.002, i * 0.7)) * (1 - loc);
        pts.push(x, (base + amp * Math.sin(u * 0.018 + hash(i * 3.3) * 6.28 + t * 1.1)) * S);
      }
      brush(I, pts, 1.4 * S, C.inkBlack, 0.24 + 0.1 * hash(i), i * 7.1, { taper: 0.02, dry: 0.15 });
    }
    {
      const step = 46;
      const k0 = Math.ceil(Math.max(uL, U.modernB) / step), k1 = Math.floor(uR / step);
      for (let k = k0; k <= k1; k++) {
        const u = k * step;
        const a = 0.17 * smooth(U.modernB, U.modernB + 500, u);
        if (a > 0.01) brush(I, [X(u), RIVER_TOP * S, X(u), RIVER_BOT * S], 1.0 * S, C.inkBlack, a, k, { taper: 0, dry: 0 });
      }
    }
    for (const yb of [BANK, RIVER_BOT + 16]) {
      const pts = [];
      for (let x = -40; x <= W + 40; x += 12 * S) { const u = uh - (x - hx) / S; pts.push(x, (yb + 7 * fbm2(u * 0.004, yb) * (1 - smooth(U.modernA, U.modernB, u))) * S); }
      brush(I, pts, 2.8 * S, C.inkBlack, 0.36, yb, { taper: 0.01, dry: 0.4 });
    }

    // ── 众生
    for (const l of LIVES) {
      if (l.u > uh || l.u + l.len < uL || l.u > uR) continue;
      const e = Math.min(l.u + l.len, uh);
      const pts = [];
      for (let k = 0; k <= 6; k++) { const u = l.u + (e - l.u) * (k / 6); const s = (u - l.u) / l.len; pts.push(X(u), (l.y + Math.sin(s * Math.PI) * l.curve) * S); }
      brush(I, pts, 2.6 * S, C.inkBlack, l.dark * 1.2, l.seed, { taper: 0.25, dry: 0.3 });
    }

    // ── 她的线与伤
    {
      const pts = [], sp = [];
      for (let u = Math.min(uR, uh); u >= uL; u -= 6) { pts.push(X(u), yZi(u) * S); sp.push(X(u), (yZi(u) - 6) * S); }
      brush(I, pts, 4.0 * S, C.inkBlue, 1.0, 5.5, { taper: 0.0, dry: 0.35 });
      brush(I, sp, 2.2 * S, C.inkRed, 0.9, 8.8, { taper: 0.0, dry: 0.2 });
      I.dot(X(uh), yZi(uh) * S, 5 * S, ...C.inkBlue, 1.0);
    }
    for (const s of SUITORS) {
      if (uh < s.a) continue;
      const e = Math.min(uh, s.b);
      const pts = [];
      for (let u = s.a; u <= e; u += 6) { const q = (u - s.a) / (s.b - s.a); pts.push(X(u), (yZi(u) + s.side * (130 * Math.pow(1 - Math.sin(q * Math.PI), 1.6) + 14)) * S); }
      if (pts.length > 3) brush(I, pts, 2.4 * S, C.inkBlack, 0.6, s.seed, { taper: 0.2, dry: 0.3 });
    }

    // ── 他：卷底的虚点；醒来，升起，与她并行
    for (let u = Math.ceil(uL / 26) * 26; u <= Math.min(uR, uh, U.wake); u += 26) I.dot(X(u), yMing() * S, 2.0 * S, ...C.inkBlack, 0.3 + 0.15 * Math.sin(t * 1.2));
    if (uh > U.wake) {
      const pts = [];
      for (let u = Math.max(U.wake, uL); u <= Math.min(uh, uR); u += 5) pts.push(X(u), lerp(yMing(), yZi(u) + 16, easeInOut(clamp((u - U.wake) / (U.meet - U.wake)))) * S);
      if (pts.length > 3) brush(I, pts, 4.0 * S, C.inkBlack, 1.0, 3.0, { taper: 0.0, dry: 0.35 });
    }

    // ── 墨影：她以各种身份
    const m = beginMask(W, H);
    const gy = BANK * S, hs = 340 * S;
    // 诗书：书案前执笔
    const sA = smooth(U.study - 20, U.study + 60, uh);
    if (sA > 0 && X(U.study) > -400 * S) {
      const x = X(U.study);
      study(m, x + 60 * S, gy, 330 * S, t);
      figure(m, { x: x - 70 * S, y: gy - hs * 0.2, s: hs, dir: 1, kind: 'woman', t, wind: 0.1,
        pose: { ...STAND, crouch: 1.0, torso: 0.28, head: 0.3, legF: [1.5, -1.45], legB: [1.45, -1.5], armF: [1.25, 0.55], armB: [0.6, 0.9] } });
    }
    // 美利坚：三角帽、长外套、肩章；身后帆船与一排持枪的人
    const aA = smooth(U.america - 20, U.america + 60, uh);
    if (aA > 0 && X(U.america) > -500 * S) {
      const x = X(U.america);
      ship(m, x + 250 * S, gy - 4 * S, 300 * S, t);
      ship(m, x + 520 * S, gy - 10 * S, 220 * S, t + 1);
      for (let k = 0; k < 6; k++) figure(m, { x: x + (110 + k * 46) * S, y: gy - hs * 0.55 * 0.47, s: hs * 0.55, dir: -1, kind: 'soldier', hair: 'tricorn', robe: 0, sleeve: 0, t: t + k, wind: 0.2, pose: { ...STAND }, props: [{ type: 'spear', angle: Math.PI * 0.97, len: 0.75 }] });
      figure(m, { x: x - 40 * S, y: gy - hs * 0.47, s: hs, dir: 1, kind: 'woman', hair: 'tricorn', robe: 0, sleeve: 0, hairLen: 0.4, t, wind: 0.3,
        pose: { ...STAND, armF: [2.45, 2.3], armB: [0.05, 0.1] }, props: [{ type: 'coat' }, { type: 'sword', hand: 'B', angle: 0.45, len: 0.42 }] });
    }
    smoothMask(W, H, 1.3, S);
    maskToInk(f, 'rgb(20,17,14)', 0.88, 1.2);
    // 肩章上的一点金（墨层里用金色的吸收率）
    if (aA > 0 && X(U.america) > -500 * S) {
      const x = X(U.america) - 40 * S;
      I.dot(x + 4 * S, gy - hs * 0.8, 6 * S, 0.3, 0.6, 1.6, 0.9 * aA);
    }

    // ── 出：光从两线交汇处烧穿纸，进入城市的夜
    if (t > bar(E.exit)) {
      post.burn = Math.pow((t - bar(E.exit)) / (bar(38.1) - bar(E.exit)), 1.3) * 1.6 - 0.02;
      post.burnMode = 2;
      post.burnC = [X(U.meet + 80) / H, 1 - yZi(U.meet) * S / H];
      post.inkSel = -1; post.lightSel = 1;
    }
  },
};
