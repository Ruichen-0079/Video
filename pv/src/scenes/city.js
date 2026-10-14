// 六 · 城（41–48 小节，及尾声）
// 序的后半：「楼下稀疏的车流驶过……望向写字桌上她留下的信纸……
// 车灯的暖光划开城市的冷淡，不眠不休。我看见时间尾随其后，从街的这边驶来，那一边逝去。」
// 两根线变成车流里的两道光，并行一段；青色的那一道转向远处，没有熄灭，只是走远了。
// 结尾不替作者决定她的结局。

import { bar, BAR } from '../timeline.js';
import { line3, dot3, C, mixc, rgba } from '../draw.js';
import { hash, noise2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { lightWrite } from '../fx.js';
import { drawText, FONTS } from '../text.js';
import { TITLE } from '../config.js';

// 路：从左下到右上斜穿画面
const ROAD = (s, off) => [s + off * 0.33, 0, 46 + 0.33 * s - off];
const CARS = [];
{
  const r = rng(2026);
  const lanes = [[-5.4, 1], [-2.0, 1], [2.0, -1], [5.4, -1]];
  for (let i = 0; i < 46; i++) {
    const [off, dir] = lanes[i % 4];
    CARS.push({ off: off + (r() - 0.5) * 0.4, dir, v: 9 + r() * 7, s0: r() * 320, w: 0.75 + r() * 0.2 });
  }
}
const BUILD = [];
{
  const r = rng(1773);
  let s = -160;
  while (s < 160) {
    const w = 8 + r() * 16, h = 10 + r() * 40, d = 6 + r() * 4;
    BUILD.push({ s, w, h, d, seed: r() * 1000 });
    s += w + 1 + r() * 3;
  }
}

export default {
  name: 'city',
  start: bar(40.7), end: bar(48) + 6.4, post: 0,
  render(f) {
    const { t, cam, L, S, W, H, post } = f;
    const lt = t - bar(41);
    const push = easeInOut(clamp((t - bar(41)) / (bar(48) - bar(41))));
    cam.set([-6 + push * 2, 22 - push * 2, -6 + push * 6], [10, 0, 52], 46 - push * 6, 0.0);
    cam.focus = 50; cam.aperture = 0.0;
    post.nightB = [0.045, 0.032, 0.03];     // 城市的天光，偏暖
    post.nightA = [0.010, 0.012, 0.022];
    const inA = smooth(bar(40.75), bar(41.3), t);
    const endA = 1 - smooth(bar(47.0), bar(47.8), t) * 0.55;   // 标题出现时城市退暗

    // ── 对街的楼：轮廓与零星亮着的窗
    for (const b of BUILD) {
      const base = ROAD(b.s, -13);
      const x0 = base[0], z0 = base[2];
      const dx = 1, dz = 0.33;
      const L0 = Math.hypot(dx, dz);
      const ex = dx / L0 * b.w, ez = dz / L0 * b.w;
      const edge = [x0, 0, z0, x0, b.h, z0, x0 + ex, b.h, z0 + ez, x0 + ex, 0, z0 + ez];
      line3(L, cam, edge, (k, n, d) => [1.0 * S, 0.7, 0.72, 0.85, 0.07 * inA * endA * Math.exp(-d * 0.006)]);
      // 窗
      const cols = Math.floor(b.w / 2.2), rows = Math.floor(b.h / 3.2);
      for (let i = 0; i < cols; i++) for (let j = 1; j < rows; j++) {
        const hsh = hash(b.seed + i * 31.7 + j * 7.3);
        if (hsh > 0.16) continue;
        const flick = hash(b.seed + i + j * 3 + Math.floor((t + hsh * 40) / 9)) < 0.08 ? 0 : 1;   // 偶尔有窗熄灭
        const u = (i + 0.5) / cols;
        const col = hsh < 0.04 ? [0.75, 0.85, 1.0] : [1.0, 0.78, 0.5];
        dot3(L, cam, x0 + ex * u, j * 3.2, z0 + ez * u - 0.05, 1.6 * S, ...col, (0.35 + 0.4 * hash(hsh * 99)) * flick * inA * endA);
      }
    }
    // 路沿与路灯
    for (const off of [-7.5, 7.5]) {
      const pts = [];
      for (let k = 0; k <= 60; k++) pts.push(...ROAD(-160 + k * 5.33, off));
      line3(L, cam, pts, (k, n, d) => [1.1 * S, 0.8, 0.75, 0.7, 0.12 * inA * endA * Math.exp(-d * 0.006)]);
      for (let k = -14; k <= 14; k++) {
        const p = ROAD(k * 11 + (off > 0 ? 5 : 0), off * 1.05);
        dot3(L, cam, p[0], 6, p[2], 1.8 * S, 1.0, 0.75, 0.45, 0.8 * inA * endA);
        dot3(L, cam, p[0], 6, p[2], 14 * S, 1.0, 0.7, 0.4, 0.07 * inA * endA);
        dot3(L, cam, p[0], 0.05, p[2], 30 * S, 1.0, 0.7, 0.4, 0.025 * inA * endA);
      }
    }

    // ── 车流：长曝光的光迹
    const EXPO = 1.1;
    for (const c of CARS) {
      const span = 320;
      const sAt = (tt) => (((c.s0 + c.dir * c.v * tt) % span) + span) % span - 160;
      const s1 = sAt(t);
      const col = c.dir > 0 ? [1.0, 0.86, 0.62] : [1.0, 0.16, 0.1];
      for (const side of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 10; k++) {
          const s = s1 - c.dir * c.v * EXPO * (k / 10);
          if (Math.abs(s) > 160) break;
          pts.push(...ROAD(s, c.off + side * c.w * 0.5));
        }
        if (pts.length >= 6) line3(L, cam, pts, (k, n, d) => [1.5 * S, ...col, (k === 0 ? 1.4 : 0.55 * (1 - k / n)) * inA * endA * Math.exp(-d * 0.004)]);
      }
    }

    // ── 两道光：明布川（月白）与子馥幽（青），在车流中并行
    const braid = smooth(bar(40.8), bar(41.4), t);
    const part = smooth(bar(43.0), bar(44.6), t);         // 她转向远处
    if (braid > 0) {
      const head = lerp(-60, 30, easeOut(clamp((t - bar(40.8)) / (BAR * 2.4)))) + Math.max(0, t - bar(43.2)) * 0.6;
      for (const who of [0, 1]) {
        const pts = [];
        const n = 90;
        const col = who ? C.jade : C.moon;
        for (let k = 0; k <= n; k++) {
          const s = head - k * 1.2;
          if (s < -160) break;
          const ph = s * 0.35 + t * 2 + who * Math.PI;
          let off = Math.sin(ph) * 1.1 * (1 - part * (who ? 0 : 0.6));
          let y = 0.6 + Math.cos(ph) * 0.5;
          let p = ROAD(s, off);
          if (who === 1 && part > 0) {
            // 她：继续沿路向远处，越来越远，不熄灭
            const go = part * 140;
            p = ROAD(s + go, off - part * 3);
          }
          if (who === 0 && part > 0) {
            // 他：留下来，渐渐升向窗口
            y += part * part * 8 * clamp(1 - k / 20);
          }
          pts.push(p[0], p[1] + y, p[2]);
        }
        line3(L, cam, pts, (k, nn, d) => [2.2 * S, ...col, (k === 0 ? 2.5 : 1.1 * Math.pow(1 - k / nn, 1.5)) * braid * Math.exp(-d * 0.003) * endA * (who ? 1 : 1 - smooth(bar(45.2), bar(46.6), t))]);
      }
    }

    // ── 屋内：窗框、书桌、信纸、一杯热水（屏幕空间）
    const room = inA;
    const fr = (x0, y0, x1, y1, a = 0.1, col = [0.8, 0.8, 0.9]) => { L.p(x0, y0, 1.6 * S, ...col, a * room); L.p(x1, y1, 1.6 * S, ...col, a * room); L.end(); };
    fr(W * 0.06, H * 0.05, W * 0.06, H * 0.8, 0.12);
    fr(W * 0.94, H * 0.05, W * 0.94, H * 0.8, 0.12);
    fr(W * 0.06, H * 0.05, W * 0.94, H * 0.05, 0.12);
    fr(W * 0.06, H * 0.8, W * 0.94, H * 0.8, 0.16);
    fr(W * 0.62, H * 0.05, W * 0.62, H * 0.8, 0.09);
    // 桌沿
    fr(0, H * 0.88, W, H * 0.86, 0.10, [1, 0.8, 0.6]);
    // 信纸：一张斜放的纸，上面几列看不清的字
    const lp = [[W * 0.18, H * 0.905], [W * 0.31, H * 0.895], [W * 0.335, H * 0.975], [W * 0.195, H * 0.99]];
    const la = 0.22 * room * (0.85 + 0.15 * Math.sin(t * 0.7));
    for (let k = 0; k < 4; k++) { const a = lp[k], b = lp[(k + 1) % 4]; L.p(a[0], a[1], 1.4 * S, 1, 0.95, 0.85, la); L.p(b[0], b[1], 1.4 * S, 1, 0.95, 0.85, la); L.end(); }
    for (let c = 0; c < 9; c++) {
      const u = 0.12 + c * 0.095;
      const top = [lerp(lp[1][0], lp[0][0], u), lerp(lp[1][1], lp[0][1], u)];
      const bot = [lerp(lp[2][0], lp[3][0], u), lerp(lp[2][1], lp[3][1], u)];
      const len = 0.55 + 0.4 * hash(c * 3.7);
      for (let q = 0; q < 6; q++) {
        const s = 0.1 + q * 0.13 * len;
        if (hash(c * 11 + q) < 0.15) continue;
        const x = lerp(top[0], bot[0], s), y = lerp(top[1], bot[1], s);
        L.p(x, y, 1.2 * S, 0.9, 0.85, 0.8, la * 0.5); L.p(x + (bot[0] - top[0]) * 0.08, y + (bot[1] - top[1]) * 0.08, 1.2 * S, 0.9, 0.85, 0.8, la * 0.5); L.end();
      }
    }
    // 一杯热水：杯口一个椭圆，热气缓缓升起
    const cx = W * 0.42, cy = H * 0.9;
    for (let k = 0; k <= 32; k++) { const a = k / 32 * 6.283; L.p(cx + Math.cos(a) * 26 * S, cy + Math.sin(a) * 7 * S, 1.3 * S, 1, 0.9, 0.8, 0.2 * room); }
    L.end();
    L.p(cx - 26 * S, cy, 1.3 * S, 1, 0.9, 0.8, 0.15 * room); L.p(cx - 22 * S, cy + 46 * S, 1.3 * S, 1, 0.9, 0.8, 0.12 * room); L.end();
    L.p(cx + 26 * S, cy, 1.3 * S, 1, 0.9, 0.8, 0.15 * room); L.p(cx + 22 * S, cy + 46 * S, 1.3 * S, 1, 0.9, 0.8, 0.12 * room); L.end();
    for (let w = 0; w < 3; w++) {
      for (let k = 0; k <= 30; k++) {
        const s = k / 30;
        const x = cx + (w - 1) * 9 * S + Math.sin(s * 6 + t * 1.3 + w * 2) * 8 * S * s + noise2(s * 3, t * 0.4 + w) * 10 * S * s;
        const y = cy - 8 * S - s * 130 * S;
        L.p(x, y, 1.4 * S, 1, 0.95, 0.9, 0.12 * Math.sin(s * Math.PI) * room);
      }
      L.end();
    }

    // ── 字（序，作者原文）
    const tx = [0.86, 0.82, 0.74];
    const a1 = smooth(bar(43.0), bar(43.2), t) * (1 - smooth(bar(45.3), bar(45.8), t));
    lightWrite(f, '我看见时间尾随其后，', W * 0.86, H * 0.12, 36 * S, clamp((t - bar(43.0)) / 3.6), { vertical: true, color: tx, alpha: a1, align: 'top', tipK: 0.7 });
    lightWrite(f, '从街的这边驶来，那一边逝去。', W * 0.80, H * 0.12, 36 * S, clamp((t - bar(44.0)) / 4.6), { vertical: true, color: tx, alpha: a1, align: 'top', tipK: 0.7 });
    const a2 = smooth(bar(45.6), bar(45.8), t) * (1 - smooth(bar(46.8), bar(47.2), t));
    lightWrite(f, '真是他妈的，逝者如斯夫。', W * 0.5, H * 0.42, 44 * S, clamp((t - bar(45.6)) / 3.4), { color: [0.9, 0.86, 0.78], alpha: a2, gap: 0.18 });

    // ── 标题
    const ta = smooth(bar(47.0), bar(47.2), t);
    if (ta > 0) {
      lightWrite(f, TITLE, W * 0.5, H * 0.43, 124 * S, clamp((t - bar(47.0)) / 4.2), { color: [0.95, 0.91, 0.84], alpha: ta, gap: 0.3, overlap: 0.25 });
      // 朱印（光层）
      const sa = smooth(bar(48.2), bar(48.5), t);
      if (sa > 0) {
        const ctx = f.light;
        const sx = W * 0.5 + 124 * S * 2.45, sy = H * 0.43 + 30 * S, sz = 44 * S;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = sa * 0.5;
        ctx.fillStyle = 'rgb(120,22,16)';
        ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.font = `${sz * 0.42}px ${FONTS.brush}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        const tc = [...TITLE];   // 四字印：右列先读
        ctx.fillText(tc[0], sx + sz * 0.21, sy - sz * 0.2); ctx.fillText(tc[1], sx + sz * 0.21, sy + sz * 0.22);
        ctx.fillText(tc[2], sx - sz * 0.21, sy - sz * 0.2); ctx.fillText(tc[3], sx - sz * 0.21, sy + sz * 0.22);
        ctx.restore();
      }
    }
  },
};
