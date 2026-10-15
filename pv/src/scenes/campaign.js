// 五 · 旗与逃（17.75–21.25 小节）
//
// 火烧穿夜，露出纸：一幅水墨。远山，山脊上站着一个举旗的女子，长发与旗一起被风扯向一边；
// 山下是一排排持矛的人。她被推到最高处，像一面旗。
// 然后是逃：她在纸上奔跑，身后两个人举着刀。朱砂一笔，从背后划过——那道伤从此留下。

import { bar, BAR } from '../timeline.js';
import { brush, C } from '../draw.js';
import { hash, noise2, fbm2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { beginMask, figure, walk, run, smoothMask, maskToInk, STAND, mixPose } from '../silhouette.js';

// 水墨远山：带雾的山形（顶部浓，往下淡入纸色）
function mountain(ctx, S, x0, x1, base, peak, seed, a) {
  const g = ctx.createLinearGradient(0, base - peak, 0, base);
  g.addColorStop(0, `rgba(40,36,32,${a})`);
  g.addColorStop(0.55, `rgba(70,64,58,${a * 0.45})`);
  g.addColorStop(1, 'rgba(90,84,76,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.filter = `blur(${2 * S}px)`;
  ctx.beginPath();
  ctx.moveTo(x0, base);
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = lerp(x0, x1, u);
    const env = Math.pow(Math.sin(u * Math.PI), 0.8);
    const y = base - peak * env * (0.7 + 0.3 * fbm2(u * 4 + seed, seed)) - peak * 0.15 * fbm2(u * 14 + seed * 3, 2);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(x1, base);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export default {
  name: 'campaign',
  start: bar(17.3), end: bar(21.25), post: 0.6,
  render(f) {
    const { t, W, H, S, I, ink, post } = f;
    if (t >= bar(17.95)) { post.paper = 1; post.burn = -1; post.inkSel = 0; post.lightSel = 0; }
    post.exposure = 0.86;
    post.paperCol = [0.86, 0.79, 0.64];
    post.vignette = 0.7;
    const tabA = 1 - smooth(bar(19.0), bar(19.35), t);
    const escA = smooth(bar(19.1), bar(19.4), t);
    const push = 1 + 0.06 * clamp((t - bar(17.75)) / (bar(19.3) - bar(17.75)));

    // ── 山脊上的旗
    if (tabA > 0) {
      ink.save();
      ink.globalAlpha = tabA;
      ink.translate(W * 0.6, H * 0.5); ink.scale(push, push); ink.translate(-W * 0.6, -H * 0.5);
      mountain(ink, S, -W * 0.1, W * 0.55, H * 0.7, H * 0.32, 1.3, 0.35);
      mountain(ink, S, W * 0.3, W * 1.1, H * 0.74, H * 0.24, 4.1, 0.28);
      // 近处的山脊：一笔浓墨
      const ridge = [];
      const ry = (x) => H * 0.74 - H * 0.16 * Math.exp(-Math.pow((x - W * 0.64) / (W * 0.2), 2)) + noise2(x * 0.01, 3) * 8 * S;
      for (let x = W * 0.25; x <= W * 1.05; x += 6 * S) ridge.push(x, ry(x));
      ink.restore();
      const tr = (x, y) => [W * 0.6 + (x - W * 0.6) * push, H * 0.5 + (y - H * 0.5) * push];
      const rp = [];
      for (let i = 0; i < ridge.length; i += 2) rp.push(...tr(ridge[i], ridge[i + 1]));
      brush(I, rp, 11 * S * push, C.inkBlack, 0.9 * tabA, 12, { taper: 0.1, dry: 0.7 });
      // 山脊下的淡墨
      ink.save();
      ink.globalAlpha = tabA * 0.5;
      ink.filter = `blur(${10 * S}px)`;
      ink.fillStyle = 'rgba(60,54,48,0.35)';
      ink.beginPath(); ink.moveTo(rp[0], rp[1]);
      for (let i = 0; i < rp.length; i += 2) ink.lineTo(rp[i], rp[i + 1] + 40 * S);
      ink.lineTo(W, H); ink.lineTo(rp[0], H); ink.closePath(); ink.fill();
      ink.restore();

      const m = beginMask(W, H);
      // 她：站在最高处
      const top = tr(W * 0.64, ry(W * 0.64));
      const hs = H * 0.29 * push;
      figure(m, { x: top[0], y: top[1] - hs * 0.47, s: hs, dir: -1, kind: 'woman', wind: 1.0, t,
        pose: { ...STAND, torso: 0.05, armF: [2.75, 0.15], armB: [0.35, 0.3], legF: [0.25, -0.1], legB: [-0.2, -0.02] },
        props: [{ type: 'banner', len: 0.85, w: 0.8, h: 0.42 }, { type: 'sword', hand: 'B', angle: 0.4, len: 0.45 }] });
      // 山下的军队：一排排矛
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 14; i++) {
          const x = W * (0.01 + i * 0.036 + row * 0.018) + noise2(i * 1.7, row) * 14 * S;
          const s = H * (0.075 + row * 0.025) * push * (0.92 + 0.16 * hash(i + row * 20));
          const y = H * (0.84 + row * 0.055);
          const p = tr(x, y);
          figure(m, { x: p[0], y: p[1] - s * 0.47, s, dir: 1, kind: 'soldier', pose: { ...STAND, torso: 0.05 * Math.sin(i * 2.3 + row), armF: [0.6, 0.6] }, t: t + i, wind: 0.6, props: [(i + row) % 6 === 3 ? { type: 'banner', len: 1.1, w: 0.5, h: 0.3, ph: i } : { type: 'spear', angle: Math.PI * (0.95 + 0.04 * Math.sin(i * 3.1 + row)) }] });
        }
      }
      smoothMask(W, H, 1.4, S);
      maskToInk(f, 'rgb(20,17,14)', 0.9 * tabA, 1.3);
    }

    // ── 逃
    if (escA > 0) {
      const GY = H * 0.78;
      // 地面：一笔
      const gl = [];
      for (let x = -10; x <= W + 10; x += 8 * S) gl.push(x, GY + noise2(x * 0.004, 7) * 6 * S);
      brush(I, gl, 3 * S, C.inkBlack, 0.55 * escA, 31, { taper: 0.05, dry: 0.6 });
      const cutT = bar(20.25);
      const u = clamp((t - bar(19.2)) / (bar(21.0) - bar(19.2)));
      const hs = H * 0.42;
      const hx = lerp(W * 0.86, W * 0.24, u);
      const hurt = smooth(cutT, cutT + 0.25, t);
      const m = beginMask(W, H);
      const pose = run(t * 9.5);
      pose.torso = lerp(0.35, 0.55, hurt);
      figure(m, { x: hx, y: GY - hs * 0.47, s: hs, dir: -1, kind: 'woman', pose, t, wind: 1.0, props: [{ type: 'sword', hand: 'B', angle: 0.9, len: 0.42 }] });
      // 追的人：举着刀，砍完之后停下
      const stop = smooth(cutT + 0.1, cutT + 0.6, t);
      for (let k = 0; k < 2; k++) {
        const px = hx + hs * (0.55 + k * 0.45) + stop * (t - cutT) * W * 0.25;
        const raise = smooth(cutT - 0.5, cutT - 0.15, t) * (1 - smooth(cutT, cutT + 0.15, t));
        let pp = run(t * 9 + k * 2);
        pp = mixPose(pp, { ...STAND, torso: 0.1, armF: [lerp(2.9, 0.8, smooth(cutT - 0.05, cutT + 0.05, t)), 0.2] }, k === 0 ? Math.max(raise, smooth(cutT - 0.05, cutT + 0.1, t)) : 0);
        pp = mixPose(pp, STAND, stop);
        figure(m, { x: px, y: GY - hs * 0.95 * 0.47, s: hs * 0.95, dir: -1, kind: 'soldier', robe: 0.6, pose: pp, t: t + k, wind: 0.6, props: [{ type: 'sword', angle: k === 0 ? lerp(2.9, 0.9, smooth(cutT - 0.05, cutT + 0.08, t)) : 2.6, len: 0.5 }] });
      }
      smoothMask(W, H, 1.4, S);
      maskToInk(f, 'rgb(20,17,14)', 0.9 * escA, 1.3);
      // 朱砂一笔：从背后划过（落在纸上，留下来）
      const ct = clamp((t - cutT) / 0.14);
      if (ct > 0) {
        const cx = lerp(W * 0.86, W * 0.24, clamp((cutT - bar(19.2)) / (bar(21.0) - bar(19.2)))) - hs * 0.02;
        const cy = GY - hs * 0.68;
        const pts = [];
        for (let k = 0; k <= 12; k++) { const s = (k / 12) * ct; pts.push(cx + hs * 0.25 - s * hs * 0.5, cy - hs * 0.22 + s * hs * 0.5); }
        brush(I, pts, 8 * S, C.inkRed, 0.95, 88, { taper: 0.25, dry: 0.45 });
        const r = rng(9);
        for (let k = 0; k < 50; k++) {
          const a = Math.PI * (0.6 + r() * 0.8), d = r() * hs * 0.5 * easeOut(ct);
          I.dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.5 + d * 0.4, (1 + r() * 3.5) * S, ...C.inkRed, 0.7);
        }
      }
      // 洇：墨从她身上漫开，入夜
      if (t > bar(20.75)) {
        post.burn = Math.pow((t - bar(20.75)) / (BAR * 0.5), 1.3) * 1.6 - 0.02;
        post.burnMode = 1;
        post.burnC = [hx / H, 1 - (GY - hs * 0.5) / H];
        post.inkSel = -1; post.lightSel = 1;
      }
    }
  },
};
