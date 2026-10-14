// 四 · 万花洲（21–31 小节）＋ 黄泉（31–33.5）
//
// 「子馥幽在远离城镇的辽阔草原上仰面睡觉。明布川经过，主动与她交谈。」
// 草是光的白描。她不被画出来：草地上压出一片空缺，空缺里有一点很淡的青光。
// 他走来，身后的草被拨开——行迹。
// 她说自己「忘记了想象力」；而这个以想象建成的世界，偏偏在此刻开满了花。
// 万花洲与黄泉相连：花海边缘，有一条黑色的河。

import { bar, BAR } from '../timeline.js';
import { line3, dot3, C, mixc } from '../draw.js';
import { hash, noise2, smooth, clamp, rng, easeInOut, easeOut, lerp } from '../noise.js';
import { lightWrite } from '../fx.js';
import { drawText, FONTS } from '../text.js';

const HER = [0.6, 0, 7.0];
const RIVER_Z = 15.5, RIVER_W = 2.6;          // 黄泉：横贯花海远端的一条黑河
const GATE = [-26, 0, RIVER_Z];

const BLADES = [];
{
  const r = rng(21);
  const N = 21000;
  for (let i = 0; i < N; i++) {
    // 以她为中心的径向分布：近处密，远处稀
    const rr = 0.4 + Math.pow(r(), 1.2) * 95;
    const a = r() * 6.283;
    const x = HER[0] + Math.cos(a) * rr * 1.25, z = HER[2] + Math.sin(a) * rr;
    if (z < -12) continue;
    if (Math.abs(z - RIVER_Z) < RIVER_W * 0.5 + 0.2) continue;   // 河里不长草
    const dx = (x - HER[0]) / 0.95, dz = (z - HER[2]) / 0.38;
    const inBody = dx * dx + dz * dz;                            // 她躺着的地方
    const hue = r();
    BLADES.push({ x, z, h: 0.12 + r() * 0.22, ph: r() * 6.283, lean: (r() - 0.5) * 0.5, body: inBody, rr, hue, fl: r(), sz: r() });
  }
}
const STARS = [];
{
  const r = rng(77);
  for (let i = 0; i < 600; i++) STARS.push([r() * 6.283, 0.02 + Math.pow(r(), 0.8) * 1.3, r() ** 3, r()]);
}
// 花色：柔和，不艳
const FLOWER = [[1.0, 0.62, 0.72], [1.0, 0.82, 0.45], [0.78, 0.66, 1.0], [0.95, 0.95, 1.0], [0.5, 0.9, 1.0], [1.0, 0.5, 0.42]];

// 明布川走来的路线
const W0 = bar(22.4), W1 = bar(24.0);
function himAt(t) {
  const u = easeInOut(clamp((t - W0) / (W1 - W0)));
  const x = lerp(-11, HER[0] - 1.25, u) + Math.sin(u * 5) * 0.6 * (1 - u);
  const z = lerp(22, HER[2] + 0.55, u) ;
  return [x, z, u];
}

// 镜头关键帧（小节, eye, target, fov）
const CAMK = [
  [21.0, [0.2, 1.05, -2.5], [0.4, 0.2, 14], 50],
  [24.6, [0.0, 1.0, 1.6], [0.2, 0.15, 12], 48],
  [25.4, [0.0, 1.3, 1.0], [0.2, 0.3, 14], 52],
  [28.6, [0.5, 8.5, -9], [0.4, 0.0, 22], 56],
  [30.2, [-2.6, 1.7, 2.6], [0.4, 0.45, 9.5], 46],
  [31.4, [2.5, 1.5, 9.5], [-8, 0.2, RIVER_Z], 50],
  [33.6, [-4.0, 1.2, 11.5], [GATE[0], 1.0, GATE[2]], 44],
];
function camAt(t) {
  const b = t / BAR;
  let i = 0;
  while (i < CAMK.length - 2 && b > CAMK[i + 1][0]) i++;
  const [b0, e0, t0, f0] = CAMK[i], [b1, e1, t1, f1] = CAMK[i + 1];
  const u = easeInOut(clamp((b - b0) / (b1 - b0)));
  const L = (a, c) => a.map((v, k) => lerp(v, c[k], u));
  return [L(e0, e1), L(t0, t1), lerp(f0, f1, u)];
}

export default {
  name: 'isle',
  start: bar(20.8), end: bar(33.6), post: 1.0,
  render(f) {
    const { t, cam, L, S, W, H, post } = f;
    const [eye, tgt, fov] = camAt(t);
    const sway = 0.04 * Math.sin(t * 0.3);
    cam.set([eye[0] + sway, eye[1], eye[2]], tgt, fov, 0.0);
    cam.focus = Math.hypot(tgt[0] - eye[0], tgt[2] - eye[2]) * 0.6 + 2;
    cam.aperture = 0.006;

    const inA = smooth(bar(20.8), bar(21.8), t);          // 从海过渡：草从远处推来
    const front = lerp(150, -20, easeOut(clamp((t - bar(20.8)) / (BAR * 1.2))));
    const bloom = t - bar(25);                             // 万花：花从她身边向外开
    const bloomR = bloom > 0 ? bloom * 9 + bloom * bloom * 1.2 : -1;
    const dusk = smooth(bar(30.0), bar(31.2), t);          // 花海渐暗，黄泉显现
    const under = smooth(bar(31.0), bar(31.8), t);
    const [hx, hz, hu] = himAt(t);
    const himA = smooth(W0 - 0.5, W0 + 0.5, t);

    // ── 星空（球面，与镜头一起转）
    for (const [az, el, b, tw] of STARS) {
      const R = 400;
      const x = Math.cos(az) * Math.cos(el) * R, y = Math.sin(el) * R, z = Math.sin(az) * Math.cos(el) * R + eye[2];
      const p = cam.project(x + eye[0], y, z);
      if (!p) continue;
      const tw2 = 0.75 + 0.25 * Math.sin(t * (1 + tw * 3) + tw * 50);
      L.dot(p[0], p[1], (0.7 + b * 1.3) * S, ...C.moon, (0.1 + b * 0.8) * tw2 * inA * (1 - 0.5 * under));
    }

    // ── 草
    const pts = new Array(12);
    const wind = (x, z) => noise2(x * 0.07 - t * 0.55, z * 0.07 + t * 0.12) * 0.8 + noise2(x * 0.25 - t * 1.4, z * 0.25) * 0.25;
    const fl = [];
    for (let i = 0; i < BLADES.length; i++) {
      const B = BLADES[i];
      if (B.z < front) continue;
      // 视锥粗剔除
      const vx = B.x - eye[0], vz = B.z - eye[2];
      const fz = vx * cam.f[0] + vz * cam.f[2];
      if (fz < 1.2) continue;
      if (Math.abs(vx * cam.r[0] + vz * cam.r[2]) > fz * 1.2 + 2) continue;
      let h = B.h, bx = 0.55 + 0.7 * wind(B.x, B.z) + B.lean * 0.8, bz = 0.35 * Math.sin(B.ph + t * 0.7) + B.lean * 0.5;
      // 她躺下的地方：草被压平、向外倒
      if (B.body < 2.2) {
        const k = smooth(2.2, 0.6, B.body);
        h *= 1 - 0.8 * k;
        const ox = B.x - HER[0], oz = B.z - HER[2];
        const ol = Math.hypot(ox, oz * 2.4) || 1;
        bx = lerp(bx, (ox / ol) * 1.4, k); bz = lerp(bz, (oz / ol) * 1.4, k);
      }
      // 他走过的地方：草被拨开，过一会儿才慢慢立起来
      if (himA > 0) {
        for (let s = 0; s < 6; s++) {
          const tt = t - s * 0.9;
          if (tt < W0) break;
          const [px, pz] = himAt(tt);
          const dx = B.x - px, dz = B.z - pz;
          const d2 = dx * dx + dz * dz;
          if (d2 < 0.5) {
            const k = (1 - d2 / 0.5) * (1 - s / 6);
            const dl = Math.sqrt(d2) || 1;
            bx += (dx / dl) * 1.1 * k; bz += (dz / dl) * 1.1 * k; h *= 1 - 0.35 * k;
          }
        }
      }
      // 四点折线
      for (let k = 0; k < 4; k++) {
        const s = k / 3;
        const bend = s * s;
        pts[k * 3] = B.x + bx * bend * h;
        pts[k * 3 + 1] = h * s * (1 - 0.3 * bend * Math.min(1, Math.abs(bx)));
        pts[k * 3 + 2] = B.z + bz * bend * h;
      }
      const near = Math.exp(-B.rr * 0.03);
      const dens = Math.min(1, (B.rr + 2) / 14);
      const lit = (0.09 + 0.1 * B.sz) * dens * inA * (1 - 0.75 * dusk);
      // 她的青光照亮周围的草尖
      const dh = Math.hypot(B.x - HER[0], B.z - HER[2]);
      const glow = 0.18 * Math.exp(-dh * dh * 0.8) * (1 - smooth(bar(25), bar(26), t) * 0.6);
      const col = mixc([0.55, 0.72, 0.70], C.jade, Math.min(1, glow * 1.5));
      line3(L, cam, pts, (k, n, d) => [0.9 * S, ...col, (lit + glow * 0.4) * (0.15 + 0.85 * k / 3) * Math.exp(-d * 0.018)]);
      // 花：波前经过之后开放
      if (bloomR > 0 && B.fl < 0.42) {
        const e = clamp((bloomR - B.rr) / 3);
        if (e > 0) fl.push(i, e, pts[9], pts[10], pts[11]);
      }
    }
    // 花朵：五瓣，开放时从中心长出
    for (let k = 0; k < fl.length; k += 5) {
      const B = BLADES[fl[k]], e = easeOut(fl[k + 1]);
      const x = fl[k + 2], y = fl[k + 3], z = fl[k + 4];
      const c = FLOWER[Math.floor(B.hue * FLOWER.length)];
      const p = cam.project(x, y, z);
      if (!p) continue;
      const fog = Math.exp(-p[2] * 0.012);
      const sz = Math.min(6 * S, (0.035 + 0.03 * B.sz) * p[3]) * e;
      const a = (0.18 + 0.2 * B.sz) * Math.min(1, (B.rr + 1.5) / 16) * fog * (1 - 0.8 * dusk);
      // 花瓣漂起：晚些时候一部分花瓣离开枝头，升向星空
      const rise = clamp((t - bar(27) - B.fl * 12) / 6);
      if (rise > 0 && B.sz > 0.7) {
        const yy = y + rise * rise * (3 + B.hue * 4), xx = x + Math.sin(rise * 4 + B.ph) * 0.4;
        dot3(L, cam, xx, yy, z, 1.4 * S, ...c, a * 0.9 * (1 - rise));
      }
      if (sz < 0.6) { L.dot(p[0], p[1], Math.max(0.7, sz * 1.3), ...c, a); continue; }
      for (let q = 0; q < 5; q++) {
        const ang = q * 1.2566 + B.ph;
        L.dot(p[0] + Math.cos(ang) * sz, p[1] + Math.sin(ang) * sz * 0.6, sz * 0.55, ...c, a * 0.6);
      }
      L.dot(p[0], p[1], sz * 0.35, 1, 0.95, 0.8, a * 0.8);
    }
    // 波前：一圈很淡的光
    if (bloomR > 0 && bloomR < 140) {
      const ring = [];
      for (let k = 0; k <= 160; k++) { const a = k / 160 * 6.283; ring.push(HER[0] + Math.cos(a) * bloomR * 1.25, 0.05, HER[2] + Math.sin(a) * bloomR); }
      line3(L, cam, ring, (k, n, d) => [1.2 * S, 1, 0.9, 0.8, 0.25 * Math.exp(-bloom * 0.35) * Math.exp(-d * 0.01)]);
    }

    // ── 她：躺着的一点青光
    const herA = inA * (1 - 0.3 * under);
    const breathe = 0.85 + 0.15 * Math.sin(t * 1.4);
    const hb = [];
    for (let k = 0; k <= 10; k++) hb.push(HER[0] - 0.8 + k * 0.16, 0.07, HER[2] + 0.02 * Math.sin(k));
    const sit = smooth(bar(29.6), bar(30.4), t);             // 后来，她坐起来
    const herY = 0.08 + sit * 0.55;
    line3(L, cam, hb, (k) => [3.0 * S, ...C.jade, 0.22 * herA * (1 - sit) * (k === 2 ? 1.5 : 1)]);
    dot3(L, cam, HER[0] - 0.45, herY, HER[2], 2.2 * S, ...C.jade, 1.5 * herA * breathe);
    dot3(L, cam, HER[0] - 0.45, herY, HER[2], 26 * S, ...C.jade, 0.12 * herA);

    // ── 他：月白的一点光，走来
    let mx = hx, my = 1.35, mz = hz;
    // 29–31：两点光靠近，绕着彼此缓缓转（不必说明的亲密）
    const orbit = smooth(bar(29.2), bar(30.2), t) * (1 - smooth(bar(31.0), bar(31.6), t));
    if (orbit > 0) {
      const a = (t - bar(29.2)) * 0.9;
      const cx = HER[0] - 0.75, cz = HER[2] + 0.2;
      mx = lerp(mx, cx + Math.cos(a) * 0.32, orbit); mz = lerp(mz, cz + Math.sin(a) * 0.32, orbit); my = lerp(my, 0.75 + 0.05 * Math.sin(a * 2), orbit);
    }
    // 31–33：他走向黄泉，沿着黑河走向远处的门
    const go = easeInOut(clamp((t - bar(31.3)) / (bar(32.9) - bar(31.3))));
    if (go > 0) {
      mx = lerp(mx, GATE[0] + 1.6, go);
      mz = lerp(mz, RIVER_Z + Math.sin(go * 3) * 0.3, Math.min(1, go * 3));
      my = lerp(my, 0.9, Math.min(1, go * 2));
    }
    const flare = Math.exp(-Math.pow((t - bar(33)) / 0.35, 2)) * (t < bar(33) ? 0.6 : 1);
    const sleep = smooth(bar(33.05), bar(33.5), t);
    const mA = himA * (1 - 0.85 * sleep) * (sleep > 0 ? 0.6 + 0.4 * Math.sin(t * 1.2) : 1);
    dot3(L, cam, mx, my, mz, 2.4 * S, ...C.moon, 1.8 * mA + flare * 6);
    dot3(L, cam, mx, my, mz, 24 * S, ...C.moon, 0.14 * mA + flare * 0.8);
    if (flare > 0.02) dot3(L, cam, mx, my, mz, 160 * S, ...C.moon, flare * 0.25);
    // 足迹
    if (himA > 0) {
      for (let s = 0; s < 40; s++) {
        const tt = W0 + (s / 40) * (W1 - W0);
        if (tt > t) break;
        const [px, pz] = himAt(tt);
        dot3(L, cam, px + (s % 2 ? 0.08 : -0.08), 0.02, pz, 1.4 * S, ...C.moon, 0.3 * himA * (1 - dusk * 0.7));
      }
    }

    // ── 黄泉：黑色的河，倒映着暗下去的星与花；远处一道门
    const riverA = dusk;
    if (riverA > 0) {
      for (const side of [-1, 1]) {
        const bank = [];
        for (let k = 0; k < 90; k++) { const x = -60 + k * 1.4; bank.push(x, 0.0, RIVER_Z + side * (RIVER_W * 0.5 + 0.15 * Math.sin(x * 0.4 + side))); }
        line3(L, cam, bank, (k, n, d) => [1.0 * S, 0.75, 0.6, 0.5, 0.14 * riverA * Math.exp(-d * 0.02)]);
      }
      // 河面上缓慢流向门的暗光
      for (let k = 0; k < 60; k++) {
        const lane = (hash(k * 3.1) - 0.5) * RIVER_W * 0.8;
        const sp = 0.6 + hash(k) * 0.6;
        const x0 = 30 - ((t * sp * 2 + hash(k * 7) * 90) % 90);
        const fl2 = [];
        for (let q = 0; q < 6; q++) fl2.push(x0 + q * 0.5, 0.0, RIVER_Z + lane);
        line3(L, cam, fl2, (q, n, d) => [1 * S, 0.7, 0.62, 0.9, 0.12 * riverA * (q / n) * Math.exp(-d * 0.02)]);
      }
      // 门：两根柱，一道楣，只是光的轮廓
      const gA = smooth(bar(31.2), bar(32.2), t);
      if (gA > 0) {
        const [gx, , gz] = GATE;
        const col = [0.95, 0.85, 0.7];
        const seg = (a, b) => { const p = []; for (let q = 0; q <= 12; q++) p.push(lerp(a[0], b[0], q / 12), lerp(a[1], b[1], q / 12), lerp(a[2], b[2], q / 12)); line3(L, cam, p, () => [1.5 * S, ...col, 0.7 * gA * (1 - 0.6 * sleep)]); };
        seg([gx, 0, gz - 1.0], [gx, 9, gz - 1.0]);
        seg([gx, 0, gz + 1.0], [gx, 9, gz + 1.0]);
        // 门后：一点很暗的金色（巫女）
        dot3(L, cam, gx - 4, 0.9, gz, 1.6 * S, ...C.gold, 0.8 * gA * (0.7 + 0.3 * Math.sin(t * 2)));
      }
    }

    // ── 字
    const tx = [0.82, 0.78, 0.7];
    const tA = 1 - smooth(bar(22.4), bar(22.9), t);
    lightWrite(f, '万花洲', W * 0.5, H * 0.24, 92 * S, clamp((t - bar(21.0)) / 2.6), { color: [0.92, 0.88, 0.8], alpha: tA * inA, gap: 0.35 });
    const sA = smooth(bar(22.4), bar(22.6), t) * (1 - smooth(bar(24.0), bar(24.4), t));
    lightWrite(f, '在草原上睡觉', W * 0.86, H * 0.18, 34 * S, clamp((t - bar(22.5)) / 2.4), { vertical: true, color: tx, alpha: sA, align: 'top', tipK: 0.7 });
    // 他的名字（跟着他在画面上的位置）
    const pm = cam.project(mx, my + 0.55, mz);
    const nA = smooth(bar(23.7), bar(23.9), t) * (1 - smooth(bar(25.1), bar(25.5), t));
    if (pm && nA > 0) {
      lightWrite(f, '明布川', pm[0], pm[1] - 70 * S, 34 * S, clamp((t - bar(23.7)) / 1.4), { vertical: true, color: [0.85, 0.88, 0.95], alpha: nA, tipK: 0.6 });
      // 朱批：她的嘲笑
      const cA = smooth(bar(24.35), bar(24.55), t) * nA;
      if (cA > 0) {
        drawText(f.light, '听起来像狗的名字', pm[0] + 36 * S, pm[1] - 70 * S, { font: FONTS.kai, size: 22 * S, color: 'rgb(210,90,70)', align: 'left', alpha: cA * 0.9, spacing: 0.05 });
      }
    }
    const qA = smooth(bar(24.3), bar(24.5), t) * (1 - smooth(bar(26.2), bar(26.8), t));
    lightWrite(f, '「忘记了想象力」', W * 0.15, H * 0.2, 46 * S, clamp((t - bar(24.4)) / 2.6), { vertical: true, color: [0.6, 0.95, 0.88], alpha: qA, align: 'top' });

    const yA = smooth(bar(31.4), bar(31.8), t) * (1 - smooth(bar(32.8), bar(33.1), t));
    lightWrite(f, '黄泉', W * 0.84, H * 0.2, 54 * S, clamp((t - bar(31.4)) / 1.6), { vertical: true, color: [0.85, 0.78, 0.68], alpha: yA, align: 'top' });
    const zA = smooth(bar(33.2), bar(33.4), t);
    lightWrite(f, '沉睡', W * 0.5, H * 0.78, 40 * S, clamp((t - bar(33.2)) / 1.4), { color: [0.75, 0.8, 0.9], alpha: zA * (1 - smooth(bar(34.1), bar(34.4), t)), gap: 0.6, tipK: 0.5 });
  },
};
