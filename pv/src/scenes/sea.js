// 三 · 海（11.75–14.25 小节）
// 【画面】年幼的她在海边遇见一位老人，老人伸手摸了摸她的头。这一幕后来出现在她的梦中。
// 月亮很低，压在海平线上，月光铺成一条路，把岸上的两个人照成剪影：
// 一个坐着的小孩，一个慢慢走来的老人。手落在头上，停一会儿，再收回。

import { bar, BAR } from '../timeline.js';
import { C, mixc } from '../draw.js';
import { hash, noise2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { beginMask, figure, walk, smoothMask, maskToNight, STAND, mixPose } from '../silhouette.js';

const DUMMY = document.createElement('canvas'); DUMMY.width = DUMMY.height = 2;
const STARS = [];
{
  const r = rng(18);
  for (let i = 0; i < 380; i++) STARS.push([r(), r() * 0.5, r() ** 2.5, r()]);
}

export default {
  name: 'sea',
  start: bar(11.2), end: bar(14.25), post: 0.9,
  render(f) {
    const { t, L, S, W, H } = f;
    const inA = smooth(bar(11.3), bar(11.9), t);
    const out = 1 - smooth(bar(14.0), bar(14.5), t);
    const A = inA * out;
    const HZ = H * 0.5;                   // 海平线
    const MX = W * 0.6;                   // 月亮
    const drift = (t - bar(11.75)) * 2 * S;

    // 星
    for (const [x, y, b, tw] of STARS) {
      const tw2 = 0.75 + 0.25 * Math.sin(t * (1 + tw * 3) + tw * 50);
      L.dot(W * x, HZ - (0.03 + y) * H, (0.7 + b * 1.2) * S, ...C.moon, (0.1 + b * 0.7) * tw2 * A);
    }
    // 月：压在海平线上的半个
    const mr = 70 * S;
    for (let k = 0; k < 40; k++) {
      const yy = HZ - mr + k * (mr / 40) * 1.0;
      if (yy > HZ) break;
      const hw = Math.sqrt(Math.max(0, mr * mr - (yy - HZ) ** 2));
      L.p(MX - hw, yy, 2.2 * S, 1, 0.95, 0.85, 0.5 * A); L.p(MX + hw, yy, 2.2 * S, 1, 0.95, 0.85, 0.5 * A); L.end();
    }
    L.dot(MX, HZ - mr * 0.3, mr * 1.6, 1, 0.9, 0.75, 0.18 * A);
    L.dot(MX, HZ, mr * 5, 0.8, 0.8, 1, 0.05 * A);
    // 海平线
    L.p(0, HZ, 1.3 * S, ...C.moon, 0.35 * A); L.p(W, HZ, 1.3 * S, ...C.moon, 0.35 * A); L.end();

    // 浪：越近越疏，月光的路上闪光
    const NL = 46;
    for (let i = 0; i < NL; i++) {
      const u = ((i + (t * 0.12) % 1) / NL);
      const y = HZ + Math.pow(u, 1.8) * (H * 0.36);
      const persp = 0.15 + u * 1.2;
      const n = 70;
      for (let k = 0; k <= n; k++) {
        const x = (k / n) * W;
        const dx = (x - MX) / (W * (0.05 + u * 0.25));
        const path = Math.exp(-dx * dx);
        const glint = Math.max(0, noise2(x * 0.02 / persp + i * 13.7, t * 0.7 + i)) ** 1.4;
        const yy = y + Math.sin(x * 0.01 / persp + i + t) * 2 * S * persp;
        L.p(x, yy, (0.9 + u) * S, 0.85, 0.88, 1.0, (0.03 + 0.5 * glint * path + 0.08 * glint) * A * (0.5 + u));
      }
      L.end();
    }
    // 岸：湿沙上的一道亮边，与退去的浪花
    const SH = H * 0.86;
    const wash = Math.sin(t * 0.9) * 6 * S;
    for (let k = 0; k <= 80; k++) {
      const x = (k / 80) * W;
      L.p(x, SH + wash + Math.sin(x * 0.006 + 1) * 8 * S, 1.4 * S, ...C.moon, (0.12 + 0.2 * Math.max(0, noise2(k * 0.15, t * 0.5))) * A);
    }
    L.end();

    // ── 剪影
    const m = beginMask(W, H);
    const hs = H * 0.5;                   // 老人身高
    // 小孩：坐在岸上，面朝大海（朝右）
    const cx = W * 0.5, cy = SH - 2 * S;
    const touch = smooth(bar(13.05), bar(13.3), t) * (1 - smooth(bar(13.85), bar(14.1), t));
    const childPose = { ...STAND, crouch: 1.0, legF: [1.45, -1.25], legB: [1.35, -1.35], torso: 0.08 - touch * 0.12, head: -0.15 - touch * 0.25, armF: [0.7, 0.9], armB: [0.5, 0.9] };
    const kid = figure(m, { x: cx, y: cy - hs * 0.62 * 0.36, s: hs * 0.62, dir: 1, kind: 'child', pose: childPose, t, wind: 0.35 });
    const headTop = [kid.head[0] - 4 * S, kid.head[1] - hs * 0.62 * 0.07];
    // 老人：从左边慢慢走来
    const w = easeInOut(clamp((t - bar(11.9)) / (bar(13.0) - bar(11.9))));
    const ox = lerp(W * 0.12, cx - hs * 0.3, w);
    let pose = walk(t * 3.2, 0.55 * (1 - smooth(0.85, 1, w)), { ...STAND, torso: 0.18 });
    // 找一个手臂角度，让手正好落在孩子头顶；再水平挪动老人站的位置
    const dummy = DUMMY.getContext('2d');
    let best = 0.8, bestE = 1e9;
    for (let a = 0.2; a <= 1.6; a += 0.05) {
      const q = figure(dummy, { x: 0, y: 0, s: hs, dir: 1, kind: 'old', pose: { ...STAND, torso: 0.38, head: 0.25, armF: [a, 0.3] } });
      const e = Math.abs(q.hand[1] - (headTop[1] - (SH - hs * 0.47)));
      if (e < bestE) { bestE = e; best = a; }
    }
    const tp = { ...STAND, torso: 0.38, head: 0.25, armF: [best, 0.3], armB: [0.15, 0.3] };
    const hq = figure(dummy, { x: 0, y: 0, s: hs, dir: 1, kind: 'old', pose: tp });
    const stopX = headTop[0] - hq.hand[0];
    const ox2 = lerp(W * 0.12, stopX, w);
    pose = mixPose(pose, tp, touch);
    figure(m, { x: ox2, y: SH - hs * 0.47, s: hs, dir: 1, kind: 'old', pose, t, wind: 0.35 });
    smoothMask(W, H, 1.8, S);
    maskToNight(f, { rim: [0.95, 0.9, 0.8], rimK: 0.3, rimW: 1.2, alpha: A, halo: 0.03 });
  },
};
