// 程序化几何：基本体、车削、挤出、地形网格，以及从有向距离场生成光滑网格（surface nets）
import { gl, mesh } from './gl.js';
import { xform, xdir, norm, cross, sub, len } from './math.js';

// 几何体在 JS 端的表示：p 位置, n 法线, c 颜色+粗糙度(4), m 材质参数(4: 自发光, 次表面, 布料光泽, 遮蔽)
export class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.m = []; this.i = []; this.extra = {}; }
  get count() { return this.p.length / 3; }
  vert(p, n, c, m = [0, 0, 0, 1]) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.c.push(c[0], c[1], c[2], c[3] ?? 0.7); this.m.push(m[0], m[1], m[2], m[3]); return this.count - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  add(g, M = null) {
    const o = this.count;
    for (let k = 0; k < g.count; k++) {
      const p = [g.p[k * 3], g.p[k * 3 + 1], g.p[k * 3 + 2]], n = [g.n[k * 3], g.n[k * 3 + 1], g.n[k * 3 + 2]];
      const pp = M ? xform(M, p) : p, nn = M ? norm(xdir(M, n)) : n;
      this.p.push(pp[0], pp[1], pp[2]); this.n.push(nn[0], nn[1], nn[2]);
    }
    for (let k = 0; k < g.c.length; k++) this.c.push(g.c[k]);
    for (let k = 0; k < g.m.length; k++) this.m.push(g.m[k]);
    for (const k in g.extra) { const dst = (this.extra[k] = this.extra[k] || []); for (const v of g.extra[k]) dst.push(v); }
    for (const x of g.i) this.i.push(x + o);
    return this;
  }
  recolor(c, m) { for (let k = 0; k < this.count; k++) { if (c) for (let j = 0; j < 4; j++) this.c[k * 4 + j] = c[j] ?? this.c[k * 4 + j]; if (m) for (let j = 0; j < 4; j++) this.m[k * 4 + j] = m[j] ?? this.m[k * 4 + j]; } return this; }
  upload() {
    return mesh(['p', 'n', 'c', 'm'], {
      p: { data: new Float32Array(this.p), size: 3 }, n: { data: new Float32Array(this.n), size: 3 },
      c: { data: new Float32Array(this.c), size: 4 }, m: { data: new Float32Array(this.m), size: 4 },
    }, new Uint32Array(this.i));
  }
}

export function box(sx, sy, sz, c, m) {
  const g = new Geo(); const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const F = [[[1, 0, 0], [0, 1, 0]], [[-1, 0, 0], [0, 1, 0]], [[0, 1, 0], [0, 0, 1]], [[0, -1, 0], [0, 0, 1]], [[0, 0, 1], [0, 1, 0]], [[0, 0, -1], [0, 1, 0]]];
  for (const [n, u] of F) {
    const v = cross(n, u);
    const P = (a, b) => [n[0] * hx + u[0] * a * hx + v[0] * b * hx, n[1] * hy + u[1] * a * hy + v[1] * b * hy, n[2] * hz + u[2] * a * hz + v[2] * b * hz];
    const k = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => g.vert(P(a, b), n, c, m));
    g.quad(k[0], k[1], k[2], k[3]);
  }
  return g;
}
// 车削：profile = [[r, y], ...]，绕 y 轴
export function lathe(profile, seg, c, m, { cap0 = false, cap1 = false } = {}) {
  const g = new Geo();
  const rows = profile.length;
  for (let j = 0; j < rows; j++) {
    const [r, y] = profile[j];
    const pa = profile[Math.max(0, j - 1)], pb = profile[Math.min(rows - 1, j + 1)];
    const dr = pb[0] - pa[0], dy = pb[1] - pa[1];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const n = norm([dy * ca, -dr, dy * sa]);
      g.vert([r * ca, y, r * sa], n, typeof c === 'function' ? c(j / (rows - 1), i / seg) : c, m);
    }
  }
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < seg; i++) {
    const a = j * (seg + 1) + i, b = a + 1, cc = a + seg + 1, d = cc + 1;
    g.quad(a, cc, d, b);
  }
  const capAt = (j, up) => {
    const [r, y] = profile[j]; const ctr = g.vert([0, y, 0], [0, up, 0], typeof c === 'function' ? c(j / (rows - 1), 0) : c, m);
    const s = g.count;
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; g.vert([r * Math.cos(a), y, r * Math.sin(a)], [0, up, 0], typeof c === 'function' ? c(j / (rows - 1), 0) : c, m); }
    for (let i = 0; i < seg; i++) up > 0 ? g.tri(ctr, s + i + 1, s + i) : g.tri(ctr, s + i, s + i + 1);
  };
  if (cap0) capAt(0, -1);
  if (cap1) capAt(rows - 1, 1);
  return g;
}
export const cylinder = (r0, r1, h, seg, c, m, caps = true) => lathe([[r0, 0], [r1, h]], seg, c, m, { cap0: caps, cap1: caps });
export function sphere(r, seg, c, m, sy = 1) {
  const prof = []; const rows = Math.max(4, seg >> 1);
  for (let j = 0; j <= rows; j++) { const a = -Math.PI / 2 + (j / rows) * Math.PI; prof.push([Math.cos(a) * r + 1e-5, Math.sin(a) * r * sy]); }
  return lathe(prof, seg, c, m);
}
// 网格平面（地面、地形）：heightFn(x,z) → y；colorFn(x,z,y,n) → [r,g,b,rough]
export function grid(w, d, nx, nz, heightFn = () => 0, colorFn = () => [0.5, 0.5, 0.5, 0.9], mFn = null, x0 = -w / 2, z0 = -d / 2) {
  const g = new Geo(); const e = Math.min(w / nx, d / nz) * 0.5;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + (i / nx) * w, z = z0 + (j / nz) * d, y = heightFn(x, z);
    const n = norm([heightFn(x - e, z) - heightFn(x + e, z), 2 * e, heightFn(x, z - e) - heightFn(x, z + e)]);
    g.vert([x, y, z], n, colorFn(x, z, y, n), mFn ? mFn(x, z, y, n) : [0, 0, 0, 1]);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, dd = c + 1;
    g.quad(a, c, dd, b);
  }
  return g;
}
// 挤出：二维多边形（xz 平面，逆时针）沿 y 挤出 h
export function extrude(poly, h, c, m) {
  const g = new Geo(); const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const nn = norm([b[1] - a[1], 0, -(b[0] - a[0])]);
    const k0 = g.vert([a[0], 0, a[1]], nn, c, m), k1 = g.vert([b[0], 0, b[1]], nn, c, m), k2 = g.vert([b[0], h, b[1]], nn, c, m), k3 = g.vert([a[0], h, a[1]], nn, c, m);
    g.quad(k0, k1, k2, k3);
  }
  const top = poly.map((q) => g.vert([q[0], h, q[1]], [0, 1, 0], c, m));
  for (let i = 1; i < n - 1; i++) g.tri(top[0], top[i + 1], top[i]);
  return g;
}

// ───────────────────────── 有向距离场 → 网格（surface nets）
// sdf(x,y,z) → 距离；matFn(x,y,z) → {c:[r,g,b,rough], m:[...] , extra}
export function sdfMesh(sdf, matFn, bmin, bmax, cell) {
  const nx = Math.ceil((bmax[0] - bmin[0]) / cell) + 1, ny = Math.ceil((bmax[1] - bmin[1]) / cell) + 1, nz = Math.ceil((bmax[2] - bmin[2]) / cell) + 1;
  const F = new Float32Array(nx * ny * nz);
  const id = (i, j, k) => (k * ny + j) * nx + i;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[id(i, j, k)] = sdf(bmin[0] + i * cell, bmin[1] + j * cell, bmin[2] + k * cell);
  const vid = new Int32Array(nx * ny * nz).fill(-1);
  const g = new Geo();
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const e = cell * 0.5;
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = corners.map(([a, b, c]) => F[id(i + a, j + b, k + c)]);
    let mask = 0; for (let q = 0; q < 8; q++) if (v[q] < 0) mask |= 1 << q;
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of edges) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      const A = corners[a], B = corners[b];
      sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; cnt++;
    }
    let p = [bmin[0] + (i + sx / cnt) * cell, bmin[1] + (j + sy / cnt) * cell, bmin[2] + (k + sz / cnt) * cell];
    // 向表面投影一步，并用梯度求法线
    let n = norm([sdf(p[0] + e, p[1], p[2]) - sdf(p[0] - e, p[1], p[2]), sdf(p[0], p[1] + e, p[2]) - sdf(p[0], p[1] - e, p[2]), sdf(p[0], p[1], p[2] + e) - sdf(p[0], p[1], p[2] - e)]);
    const d0 = sdf(p[0], p[1], p[2]);
    p = [p[0] - n[0] * d0, p[1] - n[1] * d0, p[2] - n[2] * d0];
    const mt = matFn(p[0], p[1], p[2]);
    vid[id(i, j, k)] = g.vert(p, n, mt.c, mt.m);
    if (mt.extra) for (const key in mt.extra) (g.extra[key] = g.extra[key] || []).push(...mt.extra[key]);
  }
  // 每条穿过表面的格边生成一个四边形
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[id(i, j, k)] < 0;
    // x 方向边 (i,j,k)-(i+1,j,k)：共享的四个格子在 (i, j-1..j, k-1..k)
    if (i < nx - 1 && a !== (F[id(i + 1, j, k)] < 0)) {
      const q = [vid[id(i, j - 1, k - 1)], vid[id(i, j, k - 1)], vid[id(i, j, k)], vid[id(i, j - 1, k)]];
      if (q.every((x) => x >= 0)) a ? g.quad(q[0], q[1], q[2], q[3]) : g.quad(q[0], q[3], q[2], q[1]);
    }
    if (j < ny - 1 && a !== (F[id(i, j + 1, k)] < 0)) {
      const q = [vid[id(i - 1, j, k - 1)], vid[id(i - 1, j, k)], vid[id(i, j, k)], vid[id(i, j, k - 1)]];
      if (q.every((x) => x >= 0)) a ? g.quad(q[0], q[1], q[2], q[3]) : g.quad(q[0], q[3], q[2], q[1]);
    }
    if (k < nz - 1 && a !== (F[id(i, j, k + 1)] < 0)) {
      const q = [vid[id(i - 1, j - 1, k)], vid[id(i, j - 1, k)], vid[id(i, j, k)], vid[id(i - 1, j, k)]];
      if (q.every((x) => x >= 0)) a ? g.quad(q[0], q[1], q[2], q[3]) : g.quad(q[0], q[3], q[2], q[1]);
    }
  }
  return g;
}

// ── SDF 基本体
export const sdSphere = (p, c, r) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r;
export function sdCapsule(p, a, b, ra, rb = ra) {
  const pa = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const bb = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
  const h = Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / (bb || 1)));
  return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - (ra + (rb - ra) * h);
}
export function sdEllipsoid(p, c, r) {
  const x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2];
  const k0 = Math.hypot(x, y, z), k1 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  return (k0 * (k0 - 1)) / (k1 || 1e-6);
}
export function sdBox(p, c, b, r = 0) {
  const q = [Math.abs(p[0] - c[0]) - b[0] + r, Math.abs(p[1] - c[1]) - b[1] + r, Math.abs(p[2] - c[2]) - b[2] + r];
  return Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)) + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0) - r;
}
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const smax = (a, b, k) => -smin(-a, -b, k);
