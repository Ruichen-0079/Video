// 三 · 海（18–21 小节）
// 【画面】年幼的子馥幽在海边遇见老武者，老武者伸手摸了摸她的头。这一幕后来出现在她的梦中。
// 人仍然只是光：一点很小的青光，一点暖金色的光。
// 最后，暖光从她身边牵出一根线，越过海面，系向远处的一点月白——命运联系。

import { bar, BAR } from '../timeline.js';
import { line3, dot3, C, mixc } from '../draw.js';
import { hash, noise2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { lightWrite } from '../fx.js';

const STARS = [];
{
  const r = rng(18);
  for (let i = 0; i < 420; i++) STARS.push([(r() - 0.5) * 2.4, r() * 0.62, r() ** 2.5, r()]);
}
const CHILD = [-0.55, 0.22, 2.2];

export default {
  name: 'sea',
  start: bar(17), end: bar(21), post: 2.4,
  render(f) {
    const { t, cam, L, S, W, H } = f;
    const lt = t - bar(18);
    const out = 1 - smooth(bar(20.9), bar(21.7), t);   // 让位给草原
    cam.set([0.3 + lt * 0.015, 1.7, -1.6 + lt * 0.03], [-0.15, 0.1, 9], 48, 0.0);
    cam.focus = 4.6; cam.aperture = 0.006;

    // ── 星：不受景深影响
    for (const [sx, sy, b, tw] of STARS) {
      const tw2 = 0.75 + 0.25 * Math.sin(t * (1 + tw * 3) + tw * 50);
      L.dot(W * (0.5 + sx * 0.5), H * (0.2 - sy * 0.4), (0.7 + b * 1.3) * S, ...C.moon, (0.12 + b * 0.8) * tw2 * out);
    }
    // 远方地平线
    const hz = [];
    for (let i = 0; i < 60; i++) hz.push(-400 + i * 13.6, 0, 300);
    line3(L, cam, hz, () => [1.2 * S, ...C.moon, 0.25 * out]);

    // ── 浪：一道道向岸推来的波峰（马远的水，换成光）
    const NL = 64;
    const pts = [];
    // 前景过渡：草原从远处推过来时，海从远处开始消失
    const sweep = smooth(bar(20.8), bar(21.8), t);
    for (let i = 0; i < NL; i++) {
      const ph = (i / NL + lt * 0.012) % 1;
      const z = 2.9 + Math.pow(1 - ph, 2.0) * 120;
      if (z > (1 - sweep) * 170 + 1.5 && sweep > 0) continue;
      pts.length = 0;
      const span = 4 + z * 1.3;
      const nP = 90;
      for (let k = 0; k < nP; k++) {
        const x = -span + (2 * span * k) / (nP - 1);
        const y = 0.04 * Math.sin(x * 0.7 + i * 1.7 + lt * 0.8) + 0.025 * Math.sin(x * 2.1 - lt * 1.3 + i);
        pts.push(x, y, z + 0.25 * Math.sin(x * 0.35 + i));
      }
      const near = smooth(12, 2.9, z);
      line3(L, cam, pts, (k, n, d) => {
        const x = pts[k * 3];
        // 闪烁：沿浪线的高光
        const glint = Math.max(0, noise2(x * 0.9 + i * 13.3, lt * 0.6 + i)) ** 1.5 * 2.2;
        const path = Math.exp(-((x + 0.2) ** 2) / (2 * (0.5 + z * 0.12) ** 2)); // 远处有一道微弱的反光
        const fog = Math.exp(-d * 0.028);
        const a = (0.025 + 0.4 * glint * glint + 0.3 * path * glint) * fog * (0.6 - 0.3 * near) * out;
        return [(0.9 + near * 0.5) * S, ...mixc(C.moon, [0.6, 0.75, 1], 0.4), a];
      });
    }
    // 近岸的浪花：短的亮线
    for (let i = 0; i < 140; i++) {
      const s = hash(i * 7.7), life = 2.5 + 2 * hash(i * 3.1);
      const ph = ((lt + s * 20) % life) / life;
      const x = (hash(i * 1.3) - 0.5) * 9, z = 2.9 + hash(i * 9.1) * 1.4 - ph * 0.5;
      const len = 0.3 + hash(i) * 0.6;
      line3(L, cam, [x - len, 0.02, z, x, 0.03, z - 0.05, x + len, 0.02, z], (k) => [1.3 * S, ...C.moon, Math.sin(ph * Math.PI) * 0.18 * out * (k === 1 ? 1 : 0.2)]);
    }

    // ── 沙滩：几道很淡的沙纹，和湿沙上的一条岸线
    for (let i = 0; i < 14; i++) {
      const z = 0.4 + i * 0.18;
      const bp = [];
      for (let k = 0; k < 50; k++) { const x = -6 + k * 0.25; bp.push(x, 0, z + 0.06 * Math.sin(x * 1.3 + i * 2.1)); }
      line3(L, cam, bp, () => [0.9 * S, ...C.gold, 0.05 * out]);
    }
    {
      const sl = [];
      const wash = 0.25 * Math.sin(lt * 0.9);
      for (let k = 0; k < 80; k++) { const x = -8 + k * 0.2; sl.push(x, 0.01, 2.85 + wash + 0.12 * Math.sin(x * 0.8 + 1)); }
      line3(L, cam, sl, (k) => [1.1 * S, ...C.moon, (0.08 + 0.12 * Math.max(0, noise2(k * 0.15, lt * 0.5))) * out]);
    }

    // ── 她：很小的一点青光（年幼）
    const touch = smooth(bar(19.4), bar(19.75), t) * (1 - smooth(bar(20.15), bar(20.6), t));
    const cA = smooth(bar(18), bar(18.5), t) * out;
    const breathe = 0.9 + 0.1 * Math.sin(t * 2.2);
    dot3(L, cam, ...CHILD, 2.0 * S, ...C.jade, (1.4 + touch * 1.4) * cA * breathe);
    dot3(L, cam, ...CHILD, 16 * S, ...C.jade, (0.18 + touch * 0.25) * cA);
    // 倒影
    

    // ── 他：暖金色的光，从右边走来，停在她身旁
    const walk = easeInOut(clamp((t - bar(18.3)) / (bar(19.3) - bar(18.3))));
    const ox = lerp(2.6, -0.05, walk), oz = lerp(3.2, 2.35, walk);
    const bob = Math.abs(Math.sin(walk * 18)) * 0.03 * (walk < 1 ? 1 : 0);
    const oy = 0.92 + bob;
    const oA = smooth(bar(18.2), bar(18.5), t) * out;
    dot3(L, cam, ox, oy, oz, 2.4 * S, ...C.gold, 1.8 * oA);
    dot3(L, cam, ox, oy, oz, 20 * S, ...C.gold, 0.16 * oA);
    
    // 走过的地方：沙滩上的足迹（很淡的点）
    for (let k = 0; k < 14; k++) {
      const w = k / 14;
      if (w > walk) break;
      const fx = lerp(2.6, -0.05, w), fz = lerp(3.2, 2.35, w) + (k % 2 ? 0.05 : -0.05);
      dot3(L, cam, fx, 0.0, fz, 1.6 * S, ...C.gold, 0.25 * oA * (0.4 + 0.6 * w));
    }
    // 摸头：一道温柔的弧，从他落到她头顶
    if (touch > 0) {
      const arc = [];
      const top = [CHILD[0] + 0.01, CHILD[1] + 0.07, CHILD[2]];
      for (let k = 0; k <= 24; k++) {
        const s = k / 24 * touch;
        const x = lerp(ox, top[0], s), z = lerp(oz, top[2], s);
        const y = lerp(oy - 0.25, top[1], s) + Math.sin(s * Math.PI) * 0.12;
        arc.push(x, y, z);
      }
      line3(L, cam, arc, (k, n) => [1.8 * S, ...C.gold, 0.9 * touch * (0.4 + 0.6 * k / n)]);
      // 水面的一圈涟漪
      const rp = clamp((t - bar(19.6)) / 3);
      if (rp > 0 && rp < 1) {
        const ring = [];
        for (let k = 0; k <= 64; k++) { const a = k / 64 * 6.283; ring.push(CHILD[0] + Math.cos(a) * rp * 1.6, 0.0, CHILD[2] + Math.sin(a) * rp * 0.8); }
        line3(L, cam, ring, () => [1.0 * S, ...C.jade, 0.3 * (1 - rp) * out]);
      }
    }

    // ── 命运之线：从她牵出，越过海面，系向远方一点月白
    const th = easeInOut(clamp((t - bar(20.2)) / (bar(21.0) - bar(20.2))));
    const far = [6, 0.55, 120];
    const farA = smooth(bar(20.0), bar(20.6), t);
    if (farA > 0) {
      dot3(L, cam, ...far, 2.0 * S, ...C.moon, 1.6 * farA);
      dot3(L, cam, ...far, 18 * S, ...C.moon, 0.15 * farA);
    }
    if (th > 0) {
      const thr = [];
      const n = 120;
      for (let k = 0; k <= n; k++) {
        const s = k / n;
        if (s > th) break;
        const e = Math.pow(s, 0.55);
        const x = lerp(CHILD[0], far[0], e) + Math.sin(s * 9 + t) * 0.1 * (1 - s);
        const y = lerp(CHILD[1], far[1], s) + Math.sin(s * Math.PI) * 0.5;
        const z = lerp(CHILD[2], far[2], e * e);
        thr.push(x, y, z);
      }
      line3(L, cam, thr, (k, nn) => {
        const s = k / n;
        const c = mixc(C.jade, C.moon, s);
        return [1.6 * S, ...c, (0.5 + 0.8 * Math.exp(-(th - s) * 20)) * out];
      });
      // 老武者的暖光沿线送出一点
      const kp = clamp(th * 1.1);
      const e = Math.pow(kp, 0.55);
      dot3(L, cam, lerp(CHILD[0], far[0], e), lerp(CHILD[1], far[1], kp) + Math.sin(kp * Math.PI) * 0.5, lerp(CHILD[2], far[2], e * e), 2.2 * S, ...C.gold, 1.5 * (1 - kp) * out);
    }

    // ── 字（整体气质中，作者举出的三个寻常画面之一）
    const ta = smooth(bar(19.4), bar(19.8), t) * (1 - smooth(bar(20.6), bar(21.0), t));
    lightWrite(f, '在海边，摸一摸谁的头', W * 0.82, H * 0.16, 34 * S, clamp((t - bar(19.45)) / 3.0), { vertical: true, color: [0.78, 0.74, 0.66], alpha: ta, align: 'top', tipK: 0.7 });
  },
};
