// 绘制辅助：三维折线（带景深）、星点、颜色
import { clamp, noise2 } from './noise.js';

const tmp = [0, 0, 0, 0];

/**
 * 三维折线。pts: 扁平数组 [x,y,z, x,y,z, ...]
 * style(i, n, depth) → [widthPx, r, g, b, a]（可返回 null 跳过该点）
 * worldWidth: 若为真，宽度按世界单位乘透视缩放
 */
export function line3(B, cam, pts, style, worldWidth = false) {
  const n = pts.length / 3;
  let open = false;
  for (let i = 0; i < n; i++) {
    const p = cam.project(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2], tmp);
    const st = p && style(i, n, p[2]);
    if (!p || !st) { if (open) { B.end(); open = false; } continue; }
    let w = worldWidth ? st[0] * p[3] : st[0];
    let a = st[4];
    const c = cam.coc(p[2]);
    if (c > 0) { const w2 = w + c * 2; a *= Math.min(1, (w + 0.6) / (w2 + 0.6)); w = w2; }
    B.p(p[0], p[1], w, st[1], st[2], st[3], a);
    open = true;
  }
  if (open) B.end();
}

export function dot3(B, cam, x, y, z, rad, r, g, b, a, worldSize = false) {
  const p = cam.project(x, y, z, tmp);
  if (!p) return;
  let R = worldSize ? rad * p[3] : rad;
  const c = cam.coc(p[2]);
  if (c > 0) { const R2 = R + c; a *= Math.min(1, ((R + 0.5) / (R2 + 0.5)) ** 2); R = R2; }
  B.dot(p[0], p[1], R, r, g, b, a);
}

// 调色板 —— 全片只有少数几种颜色
export const C = {
  moon: [0.78, 0.86, 1.0],      // 明布川：月白
  jade: [0.35, 0.95, 0.85],     // 子馥幽：青（东方龙）
  gold: [1.0, 0.72, 0.36],      // 灯火 / 老武者
  ember: [1.0, 0.45, 0.16],     // 火烬
  cinnabar: [1.0, 0.16, 0.10],  // 朱砂：伤疤、印章
  ash: [0.62, 0.66, 0.74],      // 众生：短暂的灰白
  inkBlack: [2.15, 2.25, 2.45],    // 墨（吸收率）
  inkGray: [0.9, 0.88, 0.82],   // 淡墨
  inkRed: [0.25, 1.8, 2.2],     // 朱砂（吸收绿与蓝）
  inkBlue: [2.0, 1.15, 0.5],    // 石青（吸收红）
};

export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rgba = (c, a = 1) => `rgba(${Math.round(clamp(c[0]) * 255)},${Math.round(clamp(c[1]) * 255)},${Math.round(clamp(c[2]) * 255)},${a})`;

// 毛笔线：屏幕坐标折线 pts=[x,y,...]，按 pressure(s) 变化粗细，两端收锋。
// 墨层中颜色即吸收率。
export function brush(B, pts, w, col, a, seed = 0, { taper = 0.12, dry = 0.25, pressure } = {}) {
  const n = pts.length / 2;
  if (n < 2) return;
  for (let pass = 0; pass < 2; pass++) {
    const off = pass ? w * 0.35 : 0;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      let k = Math.min(1, s / taper, (1 - s) / taper);
      k = Math.sqrt(Math.max(0, k));
      const pr = pressure ? pressure(s) : 1;
      const nz = 0.75 + 0.5 * noise2(seed * 13.1 + i * 0.07, pass * 7);
      const ww = w * k * pr * nz * (pass ? 0.45 : 1);
      // 法线方向偏移（飞白的第二道）
      const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
      let dx = pts[j1 * 2] - pts[j0 * 2], dy = pts[j1 * 2 + 1] - pts[j0 * 2 + 1];
      const L = Math.hypot(dx, dy) || 1;
      const ox = -dy / L * off, oy = dx / L * off;
      const aa = a * (pass ? dry * (0.5 + noise2(seed + i * 0.2, 3)) : 1) * (0.85 + 0.3 * nz - 0.15);
      B.p(pts[i * 2] + ox, pts[i * 2 + 1] + oy, Math.max(0.3, ww), col[0], col[1], col[2], Math.max(0, aa));
    }
    B.end();
    if (!dry) break;
  }
}

// 墨晕：径向渐变叠成的不规则墨团（画在墨层画布上）
export function inkBlot(ctx, x, y, r, a, seed = 0, n = 10) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < n; k++) {
    const h1 = Math.sin((seed + k) * 12.9898) * 43758.5453, h2 = Math.sin((seed + k) * 78.233) * 12345.678, h3 = Math.sin((seed + k) * 39.42) * 9876.54;
    const fx = h1 - Math.floor(h1), fy = h2 - Math.floor(h2), fr = h3 - Math.floor(h3);
    const ox = (fx - 0.5) * r * 1.3, oy = (fy - 0.5) * r * 0.8, rr = r * (0.35 + 0.6 * fr);
    const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
    g.addColorStop(0, `rgba(22,18,14,${a * 0.5})`);
    g.addColorStop(0.55, `rgba(22,18,14,${a * 0.28})`);
    g.addColorStop(1, 'rgba(22,18,14,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x + ox, y + oy, rr, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}
