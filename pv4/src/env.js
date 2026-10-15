// 场景构件：宫殿、回廊、民居、院墙、竹林、梅树、营帐、牌位……全部程序生成
import { Geo, box, lathe, cylinder, sphere, extrude, grid } from './mesh.js';
import { column, roof, stairs, rock, pole, lantern } from './props.js';
import { translate, rotY, rotX, rotZ, mmul, scaleM, norm, cross, sub, add, mul, lerp, rng, noise2, fbm2, clamp } from './math.js';

const T = translate;
// 殿：面阔 L、进深 D、柱高 Hc；红柱、白墙、深色屋顶；可选檐下灯笼
export function hall(L, D, Hc, { col = [0.42, 0.08, 0.06], wall = [0.62, 0.58, 0.5], roofCol = [0.1, 0.1, 0.11], bays = 7, base = 0.8, doors = true, roofH = null } = {}) {
  const g = new Geo();
  // 台基
  g.add(box(L + 2.4, base, D + 2.4, [0.5, 0.48, 0.44, 0.9]), T([0, base / 2, 0]));
  // 柱
  for (let i = 0; i <= bays; i++) for (const z of [-D / 2, D / 2]) g.add(column(Hc, 0.22, col), T([-L / 2 + (i / bays) * L, base, z]));
  // 墙（后墙与山墙）
  g.add(box(L, Hc * 0.95, 0.25, [...wall, 0.9]), T([0, base + Hc * 0.47, -D / 2 + 0.6]));
  g.add(box(0.25, Hc * 0.95, D - 1.2, [...wall, 0.9]), T([-L / 2 + 0.1, base + Hc * 0.47, 0]));
  g.add(box(0.25, Hc * 0.95, D - 1.2, [...wall, 0.9]), T([L / 2 - 0.1, base + Hc * 0.47, 0]));
  // 前面的格扇门（深色木格）
  if (doors) for (let i = 0; i < bays; i++) {
    const x = -L / 2 + ((i + 0.5) / bays) * L, w = L / bays - 0.5;
    g.add(box(w, Hc * 0.85, 0.12, [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6, 0.7]), T([x, base + Hc * 0.43, D / 2 - 0.6]));
    for (let k = 1; k < 6; k++) g.add(box(w, 0.04, 0.16, [0.06, 0.04, 0.03, 0.6]), T([x, base + Hc * 0.2 + k * Hc * 0.12, D / 2 - 0.55]));
  }
  // 额枋（梁）
  g.add(box(L + 0.6, 0.45, 0.4, [0.16, 0.24, 0.26, 0.6]), T([0, base + Hc + 0.1, D / 2]));
  g.add(box(L + 0.6, 0.45, 0.4, [0.16, 0.24, 0.26, 0.6]), T([0, base + Hc + 0.1, -D / 2]));
  // 屋顶
  g.add(roof(L + 1.0, D + 1.0, roofH || D * 0.42, { col: roofCol, eave: 1.6, curl: 0.9 }), T([0, base + Hc + 0.35, 0]));
  return g;
}
// 台：多层石阶平台（宫殿的基座）
export function terrace(w, d, levels, h, { col = [0.55, 0.53, 0.48] } = {}) {
  const g = new Geo();
  for (let i = 0; i < levels; i++) {
    const s = 1 - i * 0.18;
    g.add(box(w * s, h, d * s, [col[0] * (1 - i * 0.04), col[1] * (1 - i * 0.04), col[2] * (1 - i * 0.04), 0.9]), T([0, h * (i + 0.5), 0]));
    // 栏杆
    for (const sz of [-1, 1]) g.add(box(w * s, h * 0.35, 0.18, [0.7, 0.68, 0.62, 0.8]), T([0, h * (i + 1) + h * 0.17, sz * d * s / 2]));
  }
  // 中轴台阶
  g.add(stairs(w * 0.12, levels * 8, h / 8, 0.5, col), T([0, 0, d / 2 - 0.2]));
  return g;
}
// 回廊：一排柱子 + 天花 + 地面
export function corridor(len, w, h, { col = [0.45, 0.08, 0.06], floor = [0.18, 0.16, 0.14], ceil = [0.12, 0.08, 0.06], n = 10, wallCol = [0.13, 0.1, 0.08], panel = [0.2, 0.05, 0.04] } = {}) {
  const g = new Geo();
  g.add(box(w + 2, 0.2, len, [...floor, 0.35]), T([0, -0.1, -len / 2]));
  g.add(box(w + 2, 0.25, len, [...ceil, 0.8]), T([0, h + 0.12, -len / 2]));
  for (let i = 0; i <= n; i++) for (const sx of [-1, 1]) {
    const z = -(i / n) * len;
    g.add(column(h, 0.16, col), T([sx * w / 2, 0, z]));
    g.add(box(0.5, 0.35, 0.5, [0.15, 0.22, 0.24, 0.6]), T([sx * w / 2, h - 0.18, z]));
  }
  // 梁
  for (const sx of [-1, 1]) g.add(box(0.3, 0.4, len, [0.15, 0.22, 0.24, 0.6]), T([sx * w / 2, h - 0.2, -len / 2]));
  // 两侧的墙（远处是暗的）
  for (const sx of [-1, 1]) g.add(box(0.2, h, len, [...wallCol, 0.9]), T([sx * (w / 2 + 1.2), h / 2, -len / 2]));
  // 墙上的格窗（暗红木格）
  for (const sx of [-1, 1]) for (let i = 0; i < n; i++) g.add(box(0.06, h * 0.5, len / n * 0.6, [...panel, 0.6]), T([sx * (w / 2 + 1.08), h * 0.45, -(i + 0.5) / n * len]));
  return g;
}
// 民居：夯土墙 + 坡屋顶
export function house(w, d, h, { wall = [0.5, 0.44, 0.36], roofCol = [0.16, 0.14, 0.12], door = true } = {}) {
  const g = new Geo();
  g.add(box(w, h, d, [...wall, 0.95]), T([0, h / 2, 0]));
  g.add(roof(w + 0.3, d + 0.2, d * 0.38, { col: roofCol, eave: 0.45, curl: 0.12, nx: 10, nz: 5 }), T([0, h + 0.05, 0]));
  if (door) g.add(box(w * 0.22, h * 0.62, 0.06, [0.14, 0.1, 0.07, 0.7]), T([0, h * 0.31, d / 2 + 0.01]));
  return g;
}
// 院墙
export function wall(len, h, { col = [0.6, 0.55, 0.48], cap = [0.16, 0.14, 0.13] } = {}) {
  const g = box(len, h, 0.35, [...col, 0.95]);
  g.add(box(len + 0.2, 0.18, 0.6, [...cap, 0.6]), T([0, h / 2 + 0.06, 0]));
  return g;
}
// 竹：n 根，在 (cx,cz) 半径 r 内
export function bamboo(n, cx, cz, r, seed = 3, { h = 9, col = [0.3, 0.42, 0.2] } = {}) {
  const R = rng(seed); const g = new Geo();
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const hh = h * (0.7 + 0.5 * R()), rr = 0.035 + 0.03 * R();
    const v = 0.8 + 0.3 * R();
    const st = cylinder(rr, rr * 0.7, hh, 6, [col[0] * v, col[1] * v, col[2] * v, 0.45], undefined, false);
    // 竹节
    for (let k = 1; k < 8; k++) st.add(cylinder(rr * 1.12, rr * 1.12, 0.03, 6, [col[0] * v * 0.8, col[1] * v * 0.8, col[2] * v * 0.8, 0.5], undefined, false), T([0, (k / 8) * hh, 0]));
    const lean = (R() - 0.5) * 0.12;
    g.add(st, mmul(T([x, 0, z]), mmul(rotZ(lean), rotX((R() - 0.5) * 0.12))));
    // 叶簇（上部）
    for (let k = 0; k < 6; k++) {
      const y = hh * (0.55 + 0.45 * R());
      const leaf = box(0.5 + 0.4 * R(), 0.015, 0.09, [0.22 * v, 0.34 * v, 0.14 * v, 0.6]);
      g.add(leaf, mmul(T([x + lean * y, y, z]), mmul(rotY(R() * 6.28), mmul(rotZ(-0.4 - 0.4 * R()), T([0.25, 0, 0])))));
    }
  }
  return g;
}
// 梅树：分叉的枝 + 枝头花点（返回 {geo, blossoms:[{p, s}]})
export function plumTree(seed = 5, { h = 2.6, col = [0.12, 0.09, 0.08] } = {}) {
  const R = rng(seed); const g = new Geo(); const bl = [];
  const branch = (p, dir, l, r, depth) => {
    const e = add(p, mul(dir, l));
    const up = Math.abs(dir[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    const x = norm(cross(up, dir)), z = cross(dir, x);
    const M = [x[0], x[1], x[2], 0, dir[0], dir[1], dir[2], 0, z[0], z[1], z[2], 0, p[0], p[1], p[2], 1];
    g.add(cylinder(r, r * 0.7, l, 7, [...col, 0.8], undefined, false), M);
    if (depth >= 4 || r < 0.012) { for (let k = 0; k < 14; k++) bl.push({ p: add(e, [(R() - 0.5) * 0.25, (R() - 0.5) * 0.2, (R() - 0.5) * 0.25]), s: 0.02 + 0.015 * R() }); return; }
    const n = depth < 1 ? 2 : 2 + (R() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const nd = norm(add(dir, [(R() - 0.5) * 1.3, (R() - 0.2) * 0.6, (R() - 0.5) * 1.3]));
      branch(e, nd, l * (0.62 + 0.2 * R()), r * 0.66, depth + 1);
      if (depth > 1) for (let q = 0; q < 3; q++) bl.push({ p: add(e, mul(nd, R() * l * 0.5)), s: 0.018 + 0.012 * R() });
    }
  };
  branch([0, 0, 0], norm([0.15, 1, 0.05]), h * 0.42, 0.09, 0);
  return { geo: g, blossoms: bl };
}
// 营帐：方形帐篷（布面由调用者用布料模拟也可）
export function tent(w, d, h, col = [0.55, 0.5, 0.4]) {
  const g = new Geo();
  const P = [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, 0, d / 2], [-w / 2, 0, d / 2]], top = [0, h, 0];
  for (let i = 0; i < 4; i++) {
    const a = P[i], b = P[(i + 1) % 4];
    const n = norm(cross(sub(b, a), sub(top, a)));
    const ia = g.vert(a, n, [...col, 0.9], [0, 0.3, 0.5, 1]), ib = g.vert(b, n, [...col, 0.9], [0, 0.3, 0.5, 1]), it = g.vert(top, n, [...col, 0.9], [0, 0.3, 0.5, 1]);
    g.tri(ia, it, ib);
  }
  return g;
}
// 牌位：一排供桌上的木牌 + 蜡烛（返回烛光位置）
export function tablets(n, spacing, { col = [0.12, 0.05, 0.04], gold = [0.32, 0.22, 0.1] } = {}) {
  const g = new Geo(); const flames = [];
  g.add(box(n * spacing + 0.6, 0.85, 0.7, [0.18, 0.06, 0.05, 0.4]), T([(n - 1) * spacing / 2, 0.425, 0]));
  for (let i = 0; i < n; i++) {
    const x = i * spacing;
    g.add(box(0.24, 0.07, 0.12, [...col, 0.4]), T([x, 0.885, -0.1]));
    g.add(box(0.16, 0.5, 0.035, [...col, 0.35]), T([x, 1.17, -0.1]));
    g.add(box(0.1, 0.38, 0.04, [...gold, 0.3]), T([x, 1.17, -0.08]));
    g.add(sphere(0.085, 8, [...col, 0.4], undefined, 0.5), T([x, 1.44, -0.1]));
    // 蜡烛
    g.add(cylinder(0.018, 0.018, 0.14, 8, [0.85, 0.8, 0.7, 0.6], [0.2, 0.5, 0, 1]), T([x, 0.85, 0.18]));
    flames.push([x, 1.02, 0.18]);
  }
  return { geo: g, flames };
}
// 案：书桌
export function desk(w = 1.4, d = 0.6, h = 0.78, col = [0.2, 0.12, 0.08]) {
  const g = box(w, 0.05, d, [...col, 0.4]); g.p = g.p.map((v, i) => (i % 3 === 1 ? v + h : v));
  const out = new Geo(); out.add(g);
  for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) out.add(box(0.05, h, 0.05, [...col, 0.5]), T([x, h / 2, z]));
  return out;
}
// 地形网格（大范围）
export function terrain(size, n, Hf, colFn, x0, z0) { return grid(size, size, n, n, Hf, colFn, null, x0 ?? -size / 2, z0 ?? -size / 2); }

// 营帐（墙帐）：三面墙 + 前墙中间开口 + 人字顶；布面半透光
export function wallTent(w, d, hw, hr, col = [0.45, 0.38, 0.28], open = 1.4) {
  const g = new Geo(); const m = [0, 0.45, 0.6, 1]; const c = [...col, 0.9];
  const th = 0.03;
  g.add(box(w, hw, th, c, m), T([0, hw / 2, -d / 2]));
  g.add(box(th, hw, d, c, m), T([-w / 2, hw / 2, 0])); g.add(box(th, hw, d, c, m), T([w / 2, hw / 2, 0]));
  const side = (w - open) / 2;
  g.add(box(side, hw, th, c, m), T([-w / 2 + side / 2, hw / 2, d / 2])); g.add(box(side, hw, th, c, m), T([w / 2 - side / 2, hw / 2, d / 2]));
  g.add(box(open, 0.35, th, c, m), T([0, hw - 0.17, d / 2]));
  const L = Math.hypot(w / 2, hr);
  const a = Math.atan2(hr, w / 2);
  g.add(box(L + 0.1, th, d + 0.2, c, m), mmul(T([-w / 4, hw + hr / 2, 0]), rotZ(a)));
  g.add(box(L + 0.1, th, d + 0.2, c, m), mmul(T([w / 4, hw + hr / 2, 0]), rotZ(-a)));
  return g;
}
