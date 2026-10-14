// 一 · 书海（0–8 小节）
// 序：「夜深了。乾隆巡行在无穷无尽的书架中。」
// 两面书架如黑色城墙，向上、向远处无尽延伸。只有一盏灯。
// 人不画出来——只有灯，和灯把人影投在书架上。
// 最后一小节：「古书如溪流向京都汇聚」——书脊离开书架，顺流而去；火烧穿夜，露出纸。

import { bar } from '../timeline.js';
import { line3, dot3, C } from '../draw.js';
import { hash, noise2, smooth, clamp, rng, win, easeInOut } from '../noise.js';
import { lightWrite } from '../fx.js';

const AISLE = 1.55;          // 过道半宽
const ROW = 0.42;            // 每层书架高
const ROWS = 70;
const BAY = 2.4;             // 每一架的宽度（立柱间距）
const Z0 = -4, Z1 = 140;

// 书脊：按（侧, 层, 架内序号）确定性生成
function spine(side, row, k) {
  const h = hash(side * 7919 + row * 131 + k * 17.3);
  return { h: ROW * (0.55 + 0.38 * h), lean: (hash(k * 3.1 + row) - 0.5) * 0.04 * (h > 0.92 ? 4 : 1), w: 0.05 + 0.05 * hash(k + row * 9 + side) };
}

// 人：四人一组，乾隆与三位学士；只用来投影
function figures(t) {
  const z = 9.5 - t * 0.06;               // 慢慢走近
  const sway = Math.sin(t * 1.7) * 0.02;
  return {
    lamp: [0.35 + sway, 1.05 + Math.sin(t * 2.3) * 0.015, z - 0.35],
    people: [[0.55, z], [-0.25, z + 0.35], [0.05, z + 0.9], [-0.55, z - 0.15]],
  };
}

// 光照：灯 + 遮挡（人影）
function lampLight(P, F, t) {
  const L = F.lamp;
  const dx = P[0] - L[0], dy = P[1] - L[1], dz = P[2] - L[2];
  const d2 = dx * dx + dy * dy + dz * dz;
  let I = 1.3 * Math.exp(-d2 / 7) + 0.05 / (1 + 0.12 * d2);
  // 人影：从灯到点的线段（xz 平面）是否穿过人的圆柱
  for (const [px, pz] of F.people) {
    // 参数化最近点
    const ex = P[0] - L[0], ez = P[2] - L[2];
    const fx = px - L[0], fz = pz - L[2];
    const ee = ex * ex + ez * ez;
    const s = clamp((fx * ex + fz * ez) / (ee || 1));
    const cx = L[0] + ex * s - px, cz = L[2] + ez * s - pz;
    const dist = Math.sqrt(cx * cx + cz * cz);
    const yAt = L[1] + dy * s;
    if (s > 0.02 && yAt < 1.75 && yAt > 0) I *= 0.12 + 0.88 * smooth(0.16, 0.26, dist);
  }
  return I;
}

export default {
  name: 'library',
  start: 0, end: bar(8), post: 0.85,
  render(f) {
    const { t, cam, L, S, post } = f;
    const F = figures(t);
    const flick = 0.92 + 0.08 * noise2(t * 6, 0.3) + 0.04 * Math.sin(t * 23);
    // 镜头：沿过道缓缓前推，略微仰视
    const push = easeInOut(clamp(t / bar(8)));
    const ez = -1.2 + push * 4.2;
    const tilt = 0.22 + 0.06 * Math.sin(t * 0.12);
    // 最后一小节：抬头，看书脊离开
    const up = smooth(bar(6.5), bar(8), t);
    cam.set([0.12 * Math.sin(t * 0.07), 1.35 + up * 0.4, ez], [0.0, 1.35 + tilt * 8 + up * 9, ez + 8], 58 - up * 6, 0.004);
    cam.focus = 7; cam.aperture = 0.03;

    const intro = smooth(0.4, 4.5, t);          // 灯亮起
    const stream = smooth(bar(7), bar(8) + 1.0, t); // 古书如溪流
    const ambient = 0.012 * intro;
    const lampK = 1.1 * intro * flick;
    const gold = C.gold, moon = C.moon;
    const pts = [];

    // ── 层板：长线，沿 z 方向
    for (const side of [-1, 1]) {
      const x = side * AISLE;
      for (let r = 0; r < ROWS; r++) {
        const y = r * ROW;
        pts.length = 0;
        const n = 90;
        for (let i = 0; i < n; i++) {
          const z = Z0 + (Z1 - Z0) * Math.pow(i / (n - 1), 2.2);
          pts.push(x, y, z);
        }
        line3(L, cam, pts, (i, nn, d) => {
          const P = [x, y, pts[i * 3 + 2]];
          const I = lampLight(P, F, t) * lampK;
          const fog = Math.exp(-d * 0.035);
          const a = (ambient + I * 0.55) * fog;
          const c = I > ambient * 3 ? gold : moon;
          return [1.0 * S, c[0], c[1], c[2], a];
        });
      }
      // 立柱
      for (let b = 0; b < 40; b++) {
        const z = Z0 + b * BAY;
        pts.length = 0;
        for (let i = 0; i < 24; i++) pts.push(x, i * ROW * 3, z);
        line3(L, cam, pts, (i, nn, d) => {
          const I = lampLight([x, i * ROW * 3, z], F, t) * lampK;
          return [1.2 * S, gold[0], gold[1], gold[2], (ambient * 1.4 + I * 0.6) * Math.exp(-d * 0.035)];
        });
      }
    }

    // ── 书脊：只在灯光够亮处画（黑暗吞没其余）
    const lz = F.lamp[2];
    for (const side of [-1, 1]) {
      const x = side * AISLE;
      for (let r = 0; r < 26; r++) {
        const y = r * ROW;
        const zs = Math.max(Z0, lz - 9), ze = lz + 9 + stream * 30;
        const k0 = Math.floor(zs / 0.085), k1 = Math.floor(ze / 0.085);
        for (let k = k0; k < k1; k++) {
          const sp = spine(side, r, k);
          const z = k * 0.085 + sp.w * 0.3;
          const mid = [x, y + sp.h * 0.5, z];
          let I = lampLight(mid, F, t) * lampK;
          // 溪流：书脊脱离书架，飘向过道中央并向前流去
          const sid = hash(k * 1.7 + r * 3.3 + side);
          const go = clamp(stream * 1.6 - sid * 0.9 - r * 0.012);
          if (I < 0.03 && go <= 0) continue;
          const a0 = Math.min(1.2, I) * 0.9 + 0.02;
          if (go <= 0) {
            line3(L, cam, [x, y + 0.01, z, x + sp.lean * 0.1, y + sp.h * 0.5, z + sp.lean * 0.5, x, y + sp.h, z + sp.lean], (i, n, d) => {
              const fog = Math.exp(-d * 0.03);
              return [0.9 * S, gold[0], gold[1] * (0.85 + 0.15 * sid), gold[2] * (0.7 + 0.3 * sid), a0 * fog * (0.5 + 0.5 * sid)];
            });
          } else {
            // 漂流：沿一条流线向前（+z）并向过道中心收拢，留下拖尾
            const e = easeInOut(go);
            const flowP = (s) => {
              const tt = e - s * 0.08;
              const px = x * (1 - tt * 0.7) + Math.sin(tt * 5 + sid * 10) * 0.35 * tt;
              const py = y + sp.h * 0.5 + tt * tt * (9 + sid * 9) + Math.sin(tt * 3 + sid * 7) * 0.3 * tt;
              const pz = z + tt * (2 + sid * 3) + Math.cos(tt * 4 + sid * 5) * 0.3 * tt;
              return [px, py, pz];
            };
            const tr = [];
            for (let s = 0; s < 10; s++) tr.push(...flowP(s / 9 * 1.5));
            const c = sid > 0.7 ? C.ember : gold;
            line3(L, cam, tr, (i, n, d) => [1.1 * S, c[0], c[1], c[2], (0.25 + a0 * 0.6) * (1 - i / n) * (1 - smooth(0.8, 1, go)) * Math.exp(-d * 0.03)]);
          }
        }
      }
    }

    // ── 地面：几条暗线
    for (let i = -3; i <= 3; i++) {
      pts.length = 0;
      for (let k = 0; k < 40; k++) pts.push(i * 0.45, 0, Z0 + k * k * 0.09);
      line3(L, cam, pts, (k, n, d) => {
        const I = lampLight([i * 0.45, 0, pts[k * 3 + 2]], F, t) * lampK;
        return [1 * S, gold[0], gold[1], gold[2], (ambient * 0.6 + I * 0.25) * Math.exp(-d * 0.05)];
      });
    }

    // ── 灯
    const [lx, ly, lzz] = F.lamp;
    dot3(L, cam, lx, ly, lzz, 2.2 * S, 1.0, 0.85, 0.6, 3.0 * intro * flick);
    dot3(L, cam, lx, ly, lzz, 14 * S, ...gold, 0.35 * intro * flick);
    dot3(L, cam, lx, ly, lzz, 60 * S, ...gold, 0.06 * intro * flick);

    // ── 余烬：最后一小节，火从灯处起
    const fire = smooth(bar(7), bar(8), t);
    if (fire > 0) {
      const r = rng(99);
      for (let i = 0; i < 260; i++) {
        const s0 = r(), s1 = r(), s2 = r(), s3 = r();
        const life = 2.5 + s0 * 2;
        const ph = ((t - bar(7) + s1 * life) % life) / life;
        const px = lx + (s2 - 0.5) * 2 + Math.sin(ph * 5 + s3 * 9) * 0.3;
        const py = ly + ph * (3 + s3 * 5);
        const pz = lzz + (s3 - 0.5) * 2 - ph * 1.5;
        dot3(L, cam, px, py, pz, (1.0 + s0 * 1.4) * S, ...C.ember, fire * 1.6 * Math.sin(ph * Math.PI));
      }
    }

    // ── 文字（作者原文）
    const W = f.W, H = f.H;
    const txt = [0.80, 0.74, 0.64];
    const a1 = 1 - smooth(bar(5), bar(5.6), t);
    lightWrite(f, '夜深了。', W * 0.86, H * 0.2, 46 * S, clamp((t - bar(1)) / 2.4), { vertical: true, color: txt, alpha: a1 * 0.9, align: 'top' });
    lightWrite(f, '乾隆巡行在无穷无尽的书架中。', W * 0.80, H * 0.2, 30 * S, clamp((t - bar(2.5)) / 5.0), { vertical: true, color: txt, alpha: a1 * 0.7, align: 'top', tipK: 0.6, overlap: 0.5 });
    const a2 = 1 - smooth(bar(7.6), bar(8.2), t);
    lightWrite(f, '逝者如斯夫，', W * 0.52, H * 0.16, 64 * S, clamp((t - bar(5.8)) / 3.6), { vertical: true, color: txt, alpha: a2, align: 'top' });
    lightWrite(f, '陛下。', W * 0.44, H * 0.16 + 64 * S * 1.12 * 3, 64 * S, clamp((t - bar(6.9)) / 1.6), { vertical: true, color: txt, alpha: a2, align: 'top' });

    // 火烧穿夜：从灯的位置起
    const pl = cam.project(lx, ly, lzz);
    if (t > bar(7.5)) {
      post.burn = Math.pow((t - bar(7.5)) / (bar(8.25) - bar(7.5)), 1.6) * 1.6 - 0.02;
      post.burnMode = 0;
      post.burnC = [0.52 * W / H, 0.12];
      post.inkSel = 1;      // 新世界（纸上的墨）只在烧穿处出现
      post.lightSel = -1;   // 旧世界（夜里的光）在烧穿处消失
      post.paper = 0;
    }
  },
};
