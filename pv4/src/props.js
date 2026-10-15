// 道具与建筑构件（全部程序生成）
import { Geo, box, lathe, cylinder, sphere, extrude, grid } from './mesh.js';
import { translate, rotY, rotX, rotZ, mmul, scaleM, norm, cross, sub, add, mul, lerp, rng, noise2, fbm2 } from './math.js';

// 剑：沿 +y，原点在剑格处；剑柄在 -y
export function jian({ blade = 0.72, steel = [0.62, 0.64, 0.66], fitting = [0.42, 0.32, 0.16], cord = [0.12, 0.08, 0.06] } = {}) {
  const g = new Geo();
  // 刃：菱形截面，向尖收窄
  const N = 14;
  const rows = [];
  for (let j = 0; j <= N; j++) {
    const u = j / N, y = 0.02 + u * blade;
    let w = lerp(0.017, 0.0125, u);
    if (u > 0.9) w *= Math.sqrt(Math.max(0, (1 - u) / 0.1));
    const t = 0.0035 * (1 - u * 0.4);
    rows.push([[w, y, 0], [0, y, t], [-w, y, 0], [0, y, -t]]);
  }
  const sm = [...steel, 0.22], mm = [0, 0, 0, 1];
  for (let j = 0; j < N; j++) for (let k = 0; k < 4; k++) {
    const a = rows[j][k], b = rows[j][(k + 1) % 4], c = rows[j + 1][(k + 1) % 4], d = rows[j + 1][k];
    const n = norm(cross(sub(b, a), sub(d, a)));
    const ia = g.vert(a, n, sm, mm), ib = g.vert(b, n, sm, mm), ic = g.vert(c, n, sm, mm), id = g.vert(d, n, sm, mm);
    g.quad(ia, id, ic, ib);
  }
  g.add(box(0.085, 0.022, 0.03, [...fitting, 0.35]), translate([0, 0.006, 0]));
  g.add(cylinder(0.0135, 0.012, 0.17, 10, [...cord, 0.8]), translate([0, -0.175, 0]));
  g.add(sphere(0.019, 10, [...fitting, 0.35], undefined, 0.8), translate([0, -0.19, 0]));
  return g;
}
// 剑鞘
export function scabbard({ len = 0.76, col = [0.1, 0.06, 0.05] } = {}) {
  const g = cylinder(0.02, 0.016, len, 10, [...col, 0.4]);
  g.add(cylinder(0.022, 0.022, 0.03, 10, [0.42, 0.32, 0.16, 0.35]), translate([0, len - 0.03, 0]));
  return g;
}
// 纸灯笼（自发光）
export function lantern({ col = [1.0, 0.6, 0.3], glow = 6 } = {}) {
  const prof = []; for (let j = 0; j <= 10; j++) { const a = -Math.PI / 2 + (j / 10) * Math.PI; prof.push([Math.cos(a) * 0.13 + 0.002, Math.sin(a) * 0.17]); }
  const g = lathe(prof, 16, [...col, 0.9], [glow, 0, 0, 1]);
  g.add(cylinder(0.07, 0.07, 0.025, 12, [0.08, 0.05, 0.03, 0.6]), translate([0, 0.165, 0]));
  g.add(cylinder(0.07, 0.07, 0.025, 12, [0.08, 0.05, 0.03, 0.6]), translate([0, -0.19, 0]));
  return g;
}
// 柱子
export function column(h, r, col) {
  const g = cylinder(r, r * 0.92, h, 14, [...col, 0.5]);
  g.add(cylinder(r * 1.5, r * 1.4, 0.12, 14, [0.35, 0.33, 0.3, 0.8]), translate([0, -0.02, 0]));
  return g;
}
// 曲面屋顶（悬山/歇山的简化）：长 L，进深 D，高 Hh，起翘 curl
export function roof(L, D, Hh, { curl = 0.25, col = [0.12, 0.11, 0.1], eave = 0.6, nx = 24, nz = 10 } = {}) {
  const g = new Geo();
  const sideRows = (sgn) => {
    const base = g.count;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / nz;                      // v: 0 屋脊 → 1 檐口
      const x = (u - 0.5) * (L + eave * 2);
      const z = sgn * v * (D / 2 + eave);
      const ends = Math.pow(Math.abs(u - 0.5) * 2, 4);
      const y = Hh * (1 - Math.pow(v, 0.7)) + curl * ends * v + 0.12 * Math.sin(v * Math.PI) * 0;
      // 瓦垄
      const tile = 0.5 + 0.5 * Math.cos(u * nx * Math.PI * 2 / 2);
      const n = norm([0, 1, sgn * Hh * 0.9 / (D / 2)]);
      g.vert([x, y, z], n, [col[0] * (0.85 + 0.15 * tile), col[1] * (0.85 + 0.15 * tile), col[2] * (0.85 + 0.15 * tile), 0.6]);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = base + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      sgn > 0 ? g.quad(a, c, d, b) : g.quad(a, b, d, c);
    }
  };
  sideRows(1); sideRows(-1);
  g.add(box(L + eave * 2 + 0.2, 0.18, 0.22, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8, 0.6]), translate([0, Hh + 0.05, 0]));
  return g;
}
// 台阶
export function stairs(w, n, rise, run, col) {
  const g = new Geo();
  for (let i = 0; i < n; i++) g.add(box(w, rise, run * (n - i), [...col, 0.85]), translate([0, rise * (i + 0.5), run * (n - i) / 2]));
  return g;
}
// 石头（扰动的球）
export function rock(r, seed, col) {
  const R = rng(seed);
  const g = sphere(r, 14, [...col, 0.9], undefined, 0.7);
  const o1 = R() * 10, o2 = R() * 10;
  for (let k = 0; k < g.count; k++) {
    const x = g.p[k * 3], y = g.p[k * 3 + 1], z = g.p[k * 3 + 2];
    const d = 1 + 0.35 * noise2(x / r * 1.3 + o1, z / r * 1.3 + o2) + 0.15 * noise2(y / r * 3 + o2, x / r * 3);
    g.p[k * 3] = x * d; g.p[k * 3 + 1] = Math.max(y * d, -r * 0.2); g.p[k * 3 + 2] = z * d;
  }
  return g;
}
// 旗杆
export function pole(h, r = 0.025, col = [0.2, 0.13, 0.08]) { return cylinder(r, r * 0.8, h, 8, [...col, 0.6]); }

// 把单位圆柱（半径 1、沿 +y 高 1）摆成从 a 到 b、半径 r 的一段
export function segModel(a, b, r) {
  const d = sub(b, a); const L = Math.hypot(d[0], d[1], d[2]) || 1e-6; const y = mul(d, 1 / L);
  const up = Math.abs(y[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const x = norm(cross(up, y)), z = cross(x, y);
  return [x[0] * r, x[1] * r, x[2] * r, 0, y[0] * L, y[1] * L, y[2] * L, 0, z[0] * r, z[1] * r, z[2] * r, 0, a[0], a[1], a[2], 1];
}
export const unitCyl = (col, m) => cylinder(1, 1, 1, 8, col, m, false);
// 矛：杆 + 刃，沿 +y，原点在握处
export function spear(len = 2.4, col = [0.22, 0.15, 0.1]) {
  const g = cylinder(0.018, 0.016, len, 6, [...col, 0.6]); g.p = g.p.map((v, i) => (i % 3 === 1 ? v - len * 0.35 : v));
  const out = new Geo(); out.add(g);
  out.add(lathe([[0.0, 0], [0.028, 0.06], [0.0, 0.32]], 4, [0.6, 0.6, 0.62, 0.25]), translate([0, len * 0.65, 0]));
  return out;
}
// 火把：杆 + 头（火焰用粒子）
export function torch(col = [0.2, 0.13, 0.08]) {
  const g = cylinder(0.02, 0.016, 0.9, 6, [...col, 0.7]); g.p = g.p.map((v, i) => (i % 3 === 1 ? v - 0.6 : v));
  const out = new Geo(); out.add(g);
  out.add(cylinder(0.04, 0.035, 0.14, 8, [0.12, 0.08, 0.05, 0.9], [0.4, 0, 0, 1]), translate([0, 0.28, 0]));
  return out;
}
// 轿子
export function palanquin(col = [0.22, 0.035, 0.03], gold = [0.55, 0.4, 0.18]) {
  const g = box(1.1, 1.2, 1.5, [...col, 0.5]); g.p = g.p.map((v, i) => (i % 3 === 1 ? v + 0.6 : v));
  const out = new Geo(); out.add(g);
  out.add(roof(1.2, 1.6, 0.4, { col: [0.1, 0.08, 0.07], eave: 0.25, curl: 0.2, nx: 8, nz: 4 }), translate([0, 1.22, 0]));
  out.add(box(0.7, 0.6, 0.02, [0.12, 0.02, 0.02, 0.8]), translate([0.0, 0.7, 0.76]));
  out.add(box(1.14, 0.08, 1.54, [...gold, 0.4]), translate([0, 1.18, 0]));
  // 格窗与金边
  for (const sx of [-1, 1]) { for (let k = 0; k < 5; k++) out.add(box(0.02, 0.5, 0.02, [...gold, 0.4]), translate([sx * 0.56, 0.75, -0.4 + k * 0.2])); out.add(box(0.02, 0.02, 0.9, [...gold, 0.4]), translate([sx * 0.56, 0.75, 0])); out.add(box(0.02, 0.02, 0.9, [...gold, 0.4]), translate([sx * 0.56, 1.0, 0])); }
  out.add(box(1.16, 0.06, 1.56, [...gold, 0.4]), translate([0, 0.03, 0]));
  return out;
}
