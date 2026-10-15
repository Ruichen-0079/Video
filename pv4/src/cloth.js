// 布料：Verlet 网格（裙摆、长发、旗、帐篷、尾巴）
import { gl, mesh, updateAttr } from './gl.js';
import { add, sub, mul, len, norm, cross, dot, clamp } from './math.js';

export class Cloth {
  // nx × ny 个质点；init(i,j) → 位置；wrap: 横向首尾相接（筒）
  constructor(nx, ny, init, { wrap = false, color = [0.5, 0.5, 0.5, 0.85], color2 = null, mat = [0, 0, 0.7, 1], stiff = 1, bend = 0.25, damping = 0.985, colorFn = null } = {}) {
    this.nx = nx; this.ny = ny; this.wrap = wrap; this.damping = damping;
    const N = nx * ny;
    this.x = new Float32Array(N * 3); this.o = new Float32Array(N * 3); this.pin = new Uint8Array(N); this.pinPos = new Float32Array(N * 3);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const p = init(i, j), k = (j * nx + i) * 3; this.x.set(p, k); this.o.set(p, k); }
    // 约束：结构、剪切、弯曲
    const C = [];
    const idx = (i, j) => j * nx + (wrap ? ((i % nx) + nx) % nx : i);
    const okI = (i) => wrap || (i >= 0 && i < nx);
    const link = (a, b, k) => { const pa = this.x.subarray(a * 3, a * 3 + 3), pb = this.x.subarray(b * 3, b * 3 + 3); C.push([a, b, len(sub(pa, pb)), k]); };
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = idx(i, j);
      if (okI(i + 1) && (wrap || i + 1 < nx)) link(a, idx(i + 1, j), stiff);
      if (j + 1 < ny) link(a, idx(i, j + 1), stiff);
      if (j + 1 < ny && okI(i + 1) && (wrap || i + 1 < nx)) { link(a, idx(i + 1, j + 1), stiff * 0.6); link(idx(i + 1, j), idx(i, j + 1), stiff * 0.6); }
      if (okI(i + 2) && (wrap || i + 2 < nx)) link(a, idx(i + 2, j), bend);
      if (j + 2 < ny) link(a, idx(i, j + 2), bend);
    }
    this.C = C;
    // 网格（双面渲染）
    const ii = [];
    const cols = wrap ? nx : nx - 1;
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < cols; i++) { const a = idx(i, j), b = idx(i + 1, j), c = idx(i, j + 1), d = idx(i + 1, j + 1); ii.push(a, c, d, a, d, b); }
    const cc = new Float32Array(N * 4), mm = new Float32Array(N * 4);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const c = colorFn ? colorFn(i / Math.max(1, nx - 1), j / Math.max(1, ny - 1)) : color;
      cc.set([c[0], c[1], c[2], c[3] ?? 0.85], k * 4); mm.set(mat, k * 4);
    }
    this.nrm = new Float32Array(N * 3);
    this.mesh = mesh(['p', 'n', 'c', 'm'], { p: { data: this.x, size: 3 }, n: { data: this.nrm, size: 3 }, c: { data: cc, size: 4 }, m: { data: mm, size: 4 } }, new Uint32Array(ii), { dynamic: true });
    this.tris = ii;
    this.idx = idx;
  }
  setPin(i, j, p) { const k = j * this.nx + i; this.pin[k] = 1; this.pinPos.set(p, k * 3); }
  unpin(i, j) { this.pin[j * this.nx + i] = 0; }
  // 一步：dt 秒；force(p, k) → 加速度；colliders: [{a,b,r}] 胶囊或 {c,r} 球；ground: y
  step(dt, { gravity = -9.8, force = null, colliders = [], ground = -1e9, iters = 10, sub = 2 } = {}) {
    const h = dt / sub; const N = this.nx * this.ny;
    for (let s = 0; s < sub; s++) {
      for (let k = 0; k < N; k++) {
        const o = k * 3;
        if (this.pin[k]) { this.o[o] = this.x[o]; this.o[o + 1] = this.x[o + 1]; this.o[o + 2] = this.x[o + 2]; this.x.set(this.pinPos.subarray(o, o + 3), o); continue; }
        let ax = 0, ay = gravity, az = 0;
        if (force) { const f = force([this.x[o], this.x[o + 1], this.x[o + 2]], k); ax += f[0]; ay += f[1]; az += f[2]; }
        for (let c = 0; c < 3; c++) {
          const v = (this.x[o + c] - this.o[o + c]) * this.damping;
          this.o[o + c] = this.x[o + c];
          this.x[o + c] += v + [ax, ay, az][c] * h * h;
        }
      }
      for (let it = 0; it < iters; it++) {
        for (const [a, b, rl, kk] of this.C) {
          const oa = a * 3, ob = b * 3;
          const dx = this.x[ob] - this.x[oa], dy = this.x[ob + 1] - this.x[oa + 1], dz = this.x[ob + 2] - this.x[oa + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-9;
          const diff = ((d - rl) / d) * 0.5 * kk;
          const wa = this.pin[a] ? 0 : 1, wb = this.pin[b] ? 0 : 1;
          const ws = wa + wb; if (!ws) continue;
          const fa = (2 * wa) / ws, fb = (2 * wb) / ws;
          this.x[oa] += dx * diff * fa; this.x[oa + 1] += dy * diff * fa; this.x[oa + 2] += dz * diff * fa;
          this.x[ob] -= dx * diff * fb; this.x[ob + 1] -= dy * diff * fb; this.x[ob + 2] -= dz * diff * fb;
        }
        if (it % 3 === 2 || it === iters - 1) this.collide(colliders, ground);
      }
    }
  }
  collide(colliders, ground) {
    const N = this.nx * this.ny;
    for (let k = 0; k < N; k++) {
      if (this.pin[k]) continue;
      const o = k * 3; let p = [this.x[o], this.x[o + 1], this.x[o + 2]];
      for (const c of colliders) {
        let q, r;
        if (c.c) { q = c.c; r = c.r; }
        else { const ab = sub(c.b, c.a), t = clamp(dot(sub(p, c.a), ab) / (dot(ab, ab) || 1)); q = add(c.a, mul(ab, t)); r = c.r + (c.r2 !== undefined ? (c.r2 - c.r) * t : 0); }
        const d = sub(p, q), dl = len(d);
        if (dl < r && dl > 1e-6) p = add(q, mul(d, r / dl));
      }
      if (p[1] < ground) p[1] = ground;
      this.x[o] = p[0]; this.x[o + 1] = p[1]; this.x[o + 2] = p[2];
    }
  }
  upload() {
    // 法线
    this.nrm.fill(0);
    const t = this.tris, x = this.x;
    for (let k = 0; k < t.length; k += 3) {
      const a = t[k] * 3, b = t[k + 1] * 3, c = t[k + 2] * 3;
      const e1 = [x[b] - x[a], x[b + 1] - x[a + 1], x[b + 2] - x[a + 2]], e2 = [x[c] - x[a], x[c + 1] - x[a + 1], x[c + 2] - x[a + 2]];
      const n = cross(e1, e2);
      for (const v of [a, b, c]) { this.nrm[v] += n[0]; this.nrm[v + 1] += n[1]; this.nrm[v + 2] += n[2]; }
    }
    for (let k = 0; k < this.nrm.length; k += 3) { const l = Math.hypot(this.nrm[k], this.nrm[k + 1], this.nrm[k + 2]) || 1; this.nrm[k] /= l; this.nrm[k + 1] /= l; this.nrm[k + 2] /= l; }
    updateAttr(this.mesh, 'p', this.x); updateAttr(this.mesh, 'n', this.nrm);
  }
  get(i, j) { const k = (j * this.nx + i) * 3; return [this.x[k], this.x[k + 1], this.x[k + 2]]; }
}

// 风：缓慢变化的阵风 + 细碎的抖动
export function windField(base, gust = 0.5, t = 0, seed = 0) {
  return (p) => {
    const g = 1 + gust * Math.sin(t * 0.9 + p[0] * 0.7 + seed) * Math.sin(t * 0.37 + p[2] * 0.5);
    const fl = Math.sin(t * 7.1 + p[1] * 9 + p[0] * 5 + seed) * 0.3;
    return [base[0] * g + fl * base[2] * 0.3, base[1] + fl * 0.3, base[2] * g - fl * base[0] * 0.3];
  };
}
