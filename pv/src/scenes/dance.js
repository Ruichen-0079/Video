// 四 · 剑舞与覆灭（14.25–17.75 小节）
//
// 海边的老人独自舞剑。剑尖在长曝光里留下金色的光迹，一招一式都还留在空中。
// 最后一剑斩下（第 16 小节）——光迹烧成火：
// 宫殿在火里只剩剪影，龙旗倒下；人类的军队举着长矛与旗从前景走过，领头的人高举着剑。

import { bar, BAR } from '../timeline.js';
import { C } from '../draw.js';
import { hash, noise2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { beginMask, figure, walk, smoothMask, maskToNight, STAND, mixPose, palace } from '../silhouette.js';

const DUMMY = document.createElement('canvas'); DUMMY.width = DUMMY.height = 2;
const DX = DUMMY.getContext('2d');

// 舞剑的关键姿势：[姿势, 剑角]
const KEYS = [
  [{ ...STAND, torso: 0.15, armF: [0.3, 0.2], armB: [0.2, 0.3] }, 0.35],
  [{ ...STAND, torso: -0.05, armF: [2.9, 0.2], armB: [-0.6, 0.5], legF: [0.45, -0.25], legB: [-0.35, -0.05] }, 3.05],
  [{ ...STAND, torso: 0.45, armF: [1.55, 0.05], armB: [-1.2, 0.4], legF: [0.85, -0.8], legB: [-0.7, -0.05], crouch: 0.45 }, 1.6],
  [{ ...STAND, torso: -0.25, head: -0.2, armF: [2.3, 0.6], armB: [0.8, 0.8], legF: [0.2, -0.6], legB: [-0.4, -0.2] }, 2.4],
  [{ ...STAND, torso: 0.35, armF: [1.2, 0.2], armB: [-0.9, 0.3], legF: [1.1, -1.4], legB: [-0.6, -0.9], crouch: 0.8 }, 1.25],
  [{ ...STAND, torso: 0.0, armF: [3.0, 0.1], armB: [1.4, 0.6], legF: [1.2, -1.6], legB: [0.0, -0.02] }, 3.1],
  [{ ...STAND, torso: 0.5, armF: [0.95, 0.0], armB: [-1.5, 0.3], legF: [0.9, -0.7], legB: [-0.8, -0.05], crouch: 0.5 }, 0.75],
];
const D0 = bar(14.35), D1 = bar(16.0);
function danceAt(t) {
  const u = clamp((t - D0) / (D1 - D0)) * (KEYS.length - 1);
  const i = Math.min(KEYS.length - 2, Math.floor(u));
  const k = easeInOut(u - i);
  return { pose: mixPose(KEYS[i][0], KEYS[i + 1][0], k), sword: lerp(KEYS[i][1], KEYS[i + 1][1], k) };
}

const EMB = [];
{
  const r = rng(907);
  for (let i = 0; i < 260; i++) EMB.push([r(), r(), r(), r()]);
}

export default {
  name: 'dance',
  start: bar(14.0), end: bar(17.75), post: 0.8,
  render(f) {
    const { t, L, S, W, H, post } = f;
    const GY = H * 0.82;
    const hs = H * 0.52;
    const OX = W * 0.46;
    const inA = smooth(bar(14.0), bar(14.4), t);
    const fireT = smooth(bar(15.95), bar(16.1), t);    // 斩下 → 火
    const flash = Math.exp(-Math.pow((t - bar(16.0)) / 0.18, 2));

    if (fireT < 1) {
      const A = inA * (1 - fireT);
      // 远处一点月的余光与地面
      L.dot(W * 0.62, H * 0.45, 260 * S, 0.8, 0.82, 1.0, 0.07 * A);
      L.p(0, GY, 1.2 * S, ...C.moon, 0.18 * A); L.p(W, GY, 1.2 * S, ...C.moon, 0.18 * A); L.end();
      // 剑的光迹：整段舞留在空中（长曝光），最近的一段最亮
      const tipAt = (tt) => {
        const d = danceAt(tt);
        const q = figure(DX, { x: OX, y: GY - hs * 0.47, s: hs, dir: 1, kind: 'old', pose: d.pose, props: [{ type: 'sword', angle: d.sword, len: 0.55 }] });
        return q.tips[0];
      };
      if (t > D0) {
        const step = 0.035;
        const t1 = Math.min(t, D1 + 0.05);
        for (let tt = D0; tt <= t1; tt += step) {
          const p = tipAt(tt);
          const age = t - tt;
          const a = (0.12 + 1.6 * Math.exp(-age * 2.5)) * A;
          L.p(p[0], p[1], (1.4 + 2.5 * Math.exp(-age * 3)) * S, 1.0, 0.78, 0.42, a);
        }
        L.end();
        const p = tipAt(Math.min(t, D1));
        L.dot(p[0], p[1], 3 * S, 1, 0.9, 0.7, 2.5 * A);
      }
      // 老人
      const m = beginMask(W, H);
      const d = danceAt(t);
      figure(m, { x: OX, y: GY - hs * 0.47, s: hs, dir: 1, kind: 'old', pose: d.pose, props: [{ type: 'sword', angle: d.sword, len: 0.55 }], t, wind: 0.6 });
      smoothMask(W, H, 1.6, S);
      maskToNight(f, { rim: [1.0, 0.8, 0.5], rimK: 0.22, rimW: 1.1, alpha: A, halo: 0.03 });
    }
    // 斩下的一瞬：金光横扫全画面
    if (flash > 0.01) {
      for (let k = 0; k < 5; k++) {
        const y = H * (0.35 + k * 0.08);
        L.p(0, y + (W * 0.1) * 0.3, (6 - k) * S, 1, 0.75, 0.4, flash * (0.9 - k * 0.15));
        L.p(W, y - (W * 0.1) * 0.3, (6 - k) * S, 1, 0.75, 0.4, flash * (0.9 - k * 0.15));
        L.end();
      }
      L.dot(W * 0.5, H * 0.45, W * 0.4, 1, 0.7, 0.35, flash * 0.5);
    }

    // ── 火：宫殿、龙旗、军队
    if (fireT > 0) {
      const A = fireT;
      const ft = t - bar(16.0);
      const fl = (k) => 0.75 + 0.25 * noise2(t * 3 + k, k * 7.1);
      // 火：沿屋脊一排向上舔的火舌（细长的渐变），后面一层暗红的天光
      const Lc = f.light;
      Lc.save();
      Lc.globalCompositeOperation = 'lighter';
      {
        const g = Lc.createRadialGradient(W * 0.5, H * 0.62, 0, W * 0.5, H * 0.62, W * 0.55);
        g.addColorStop(0, `rgba(190,60,18,${0.32 * A})`); g.addColorStop(0.5, `rgba(110,26,8,${0.16 * A})`); g.addColorStop(1, 'rgba(40,8,2,0)');
        Lc.fillStyle = g; Lc.fillRect(0, 0, W, H);
      }
      for (let k = 0; k < 46; k++) {
        const u = k / 45;
        const x = W * (0.2 + 0.6 * u) + noise2(k * 1.7, t * 0.5) * 20 * S;
        const base = H * (0.5 + 0.1 * Math.abs(u - 0.5));
        const hgt = (90 + 160 * Math.max(0, noise2(k * 0.9, t * 2.2 + k))) * S * (1 - 0.6 * Math.abs(u - 0.5));
        const w2 = (14 + 16 * hash(k)) * S;
        Lc.save();
        Lc.translate(x, base);
        Lc.scale(1, hgt / w2);
        const g = Lc.createRadialGradient(0, 0, 0, 0, 0, w2);
        g.addColorStop(0, `rgba(255,${Math.round(150 + 70 * hash(k * 5))},70,${0.75 * A})`);
        g.addColorStop(0.5, `rgba(230,80,20,${0.22 * A})`);
        g.addColorStop(1, 'rgba(120,20,0,0)');
        Lc.fillStyle = g; Lc.beginPath(); Lc.arc(0, -w2 * 0.5, w2, 0, 6.283); Lc.fill();
        Lc.restore();
      }
      Lc.restore();
      // 余烬上升
      for (const [a, b, c, d] of EMB) {
        const life = 2 + 3 * a;
        const ph = ((ft + b * life) % life) / life;
        const x = W * (0.2 + 0.6 * c) + Math.sin(ph * 6 + d * 9) * 30 * S;
        const y = H * 0.6 - ph * H * 0.7;
        L.dot(x, y, (1 + 1.6 * d) * S, 1.0, 0.5, 0.15, 1.4 * Math.sin(ph * Math.PI) * A);
      }
      // 剪影
      const m = beginMask(W, H);
      palace(m, W * 0.5, H * 0.62, W * 0.5, { tiers: 2, flagFall: easeInOut(clamp((t - bar(17.0)) / 0.7)), t });
      // 后排：小、密
      const march = ft * 0.07 * W;
      for (let i = 0; i < 16; i++) {
        const x = ((i * 0.075 * W + march * 0.6) % (W * 1.2)) - W * 0.1;
        const s = H * 0.2;
        figure(m, { x, y: H * 0.8 - s * 0.47, s, dir: 1, kind: 'soldier', pose: walk(ft * 5 + i * 1.3, 0.8), t: t + i, wind: 0.5, props: [i % 4 === 2 ? { type: 'banner', len: 1.2, w: 0.5, ph: i } : { type: 'spear', angle: Math.PI * 0.94 }] });
      }
      // 前排：大、疏
      for (let i = 0; i < 4; i++) {
        const x = ((i * 0.31 * W + march + W * 0.12) % (W * 1.3)) - W * 0.15;
        const s = H * 0.38;
        figure(m, { x, y: H * 0.98 - s * 0.47, s, dir: 1, kind: 'soldier', pose: walk(ft * 4 + i * 2.1, 0.9), t: t + i, wind: 0.5, props: [{ type: 'spear', angle: Math.PI * 0.9 }] });
      }
      // 领头的人：高举着剑
      {
        const s = H * 0.56;
        const x = W * 0.2 + ft * 0.035 * W;
        figure(m, { x, y: H * 1.02 - s * 0.47, s, dir: 1, kind: 'man', robe: 0.85, pose: { ...walk(ft * 3, 0.6), torso: 0.05, armF: [2.85, 0.15] }, props: [{ type: 'sword', angle: 3.05, len: 0.5 }], t, wind: 0.7 });
      }
      smoothMask(W, H, 1.2, S);
      maskToNight(f, { rim: [1.0, 0.55, 0.2], rimK: 0.12, rimW: 1.0, alpha: A, halo: 0.0, body: 'rgb(6,3,2)' });
    }

    // 火烧穿夜 → 纸
    if (t > bar(17.35)) {
      post.burn = Math.pow((t - bar(17.35)) / (bar(17.95) - bar(17.35)), 1.5) * 1.6 - 0.02;
      post.burnMode = 0;
      post.burnC = [0.5 * W / H, 0.45];
      post.inkSel = 1; post.lightSel = -1;
      post.paper = 0;
    }
  },
};
