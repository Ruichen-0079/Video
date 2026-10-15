// 六 · 笑（21.25–23.75 小节）
//
// 墨漫成夜。一个逃兵独自往前走，低着头，剑没有收起，剑尖拖在地上，划出一道青色的光——她的行迹。
// 然后是很近的侧脸：一根光线勾出的轮廓，嘴角往上牵了一下。不是哭，也不是真的笑。
// 无奈，怅惘。随后这根线散开，变成草。

import { bar, BAR } from '../timeline.js';
import { C } from '../draw.js';
import { hash, noise2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { beginMask, figure, walk, smoothMask, maskToNight, STAND, profile } from '../silhouette.js';

const DUMMY = document.createElement('canvas'); DUMMY.width = DUMMY.height = 2;
const DX = DUMMY.getContext('2d');
const STARS = [];
{
  const r = rng(213);
  for (let i = 0; i < 300; i++) STARS.push([r(), r() * 0.55, r() ** 2.5, r()]);
}

export default {
  name: 'deserter',
  start: bar(20.85), end: bar(23.75), post: 1.2,
  render(f) {
    const { t, L, S, W, H } = f;
    const GY = H * 0.74;
    const walkA = smooth(bar(21.0), bar(21.5), t) * (1 - smooth(bar(22.45), bar(22.75), t));
    // ── 走
    if (walkA > 0) {
      for (const [x, y, b, tw] of STARS) L.dot(W * x, H * y, (0.6 + b) * S, ...C.moon, (0.06 + b * 0.5) * walkA);
      L.dot(W * 0.22, H * 0.3, 40 * S, 0.8, 0.85, 1, 0.12 * walkA);       // 很淡的月
      L.p(0, GY, 1.1 * S, ...C.moon, 0.14 * walkA); L.p(W, GY, 1.1 * S, ...C.moon, 0.14 * walkA); L.end();
      const hs = H * 0.42;
      const xAt = (tt) => lerp(W * 0.78, W * 0.36, clamp((tt - bar(21.0)) / (bar(22.75) - bar(21.0))));
      const poseAt = (tt) => {
        const p = walk(tt * 2.6, 0.5, { ...STAND, torso: 0.22, head: 0.35 });
        p.armB = [-0.55, 0.05];      // 拖剑的手垂在身后
        return p;
      };
      const SL = 0.62;
      const opts = (tt) => {
        const o = { x: xAt(tt), y: GY - hs * 0.47, s: hs, dir: -1, kind: 'woman', pose: poseAt(tt), t: tt, wind: 0.45 };
        // 剑尖要刚好落在地上：按手离地的高度求剑的角度
        const hb = figure(DX, o).handB;
        const hh = (GY - hb[1]) / hs;
        o.props = [{ type: 'sword', hand: 'B', angle: -Math.acos(Math.min(0.99, hh / SL)), len: SL }];
        return o;
      };
      // 剑尖在地上拖出的光：取过去每个时刻剑尖的位置，钉在地面上
      const t0 = bar(21.0);
      if (t > t0) {
        for (let tt = t0; tt <= t; tt += 0.03) {
          const q = figure(DX, opts(tt)).tips[0];
          const age = t - tt;
          L.p(q[0], GY, (1.2 + 1.4 * Math.exp(-age * 2)) * S, ...C.jade, (0.25 + 1.2 * Math.exp(-age * 1.5)) * walkA);
        }
        L.end();
      }
      const m = beginMask(W, H);
      const me = figure(m, opts(t));
      smoothMask(W, H, 1.6, S);
      maskToNight(f, { rim: [0.6, 0.95, 0.88], rimK: 0.2, rimW: 1.1, alpha: walkA, halo: 0.02 });
      L.dot(me.tips[0][0], me.tips[0][1], 2.5 * S, ...C.jade, 2.0 * walkA);
    }
    // ── 侧脸：一笔画出，嘴角上牵
    const pA = smooth(bar(22.5), bar(22.7), t) * (1 - smooth(bar(23.55), bar(23.95), t));
    if (pA > 0) {
      const reveal = easeInOut(clamp((t - bar(22.5)) / 1.1));
      const smile = easeInOut(clamp((t - bar(22.95)) / 1.6));
      const drift = (t - bar(22.5)) * 4 * S;
      profile(L, W * 0.47 - drift, H * 0.86, H * 0.62, -1, { smile: smile * 0.95, reveal, color: C.jade, alpha: pA * 0.95, w: 2.2 * S, t });
    }
  },
};
