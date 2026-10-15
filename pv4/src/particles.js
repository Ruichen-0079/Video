// 粒子：烟、火、火星、雨、雪、尘、花瓣、灰烬。CPU 推进，实例化面片渲染。
import { gl, mesh } from './gl.js';
import { rng } from './math.js';

export const KIND = { smoke: 0, fire: 1, spark: 2, rain: 3, snow: 4, dust: 5, petal: 6, ember: 7, mist: 8, blood: 9 };

export class Particles {
  constructor(max, kind, seed = 1, { additive = null } = {}) {
    this.max = max; this.kind = KIND[kind] ?? kind; this.R = rng(seed); this.n = 0;
    this.additive = additive ?? (this.kind === KIND.fire || this.kind === KIND.spark || this.kind === KIND.ember);
    this.P = []; // {p:[3], v:[3], age, life, size, grow, col:[4], rot, spin, seed}
    this.A = new Float32Array(max * 4); this.Bf = new Float32Array(max * 4); this.Cf = new Float32Array(max * 4);
    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.mesh = mesh(['q', 'iA', 'iB', 'iC'], {
      q: { data: quad, size: 2 },
      iA: { data: this.A, size: 4, divisor: 1 }, iB: { data: this.Bf, size: 4, divisor: 1 }, iC: { data: this.Cf, size: 4, divisor: 1 },
    }, null, { dynamic: true });
    this.mesh.count = 4;
  }
  emit(init) {
    if (this.P.length >= this.max) return;
    const p = { p: [0, 0, 0], v: [0, 0, 0], age: 0, life: 1, size: 0.1, grow: 0, col: [1, 1, 1, 1], rot: 0, spin: 0, seed: this.R(), drag: 0, buoy: 0, grav: 0 };
    init(p, this.R);
    this.P.push(p);
  }
  // rate：每秒发射数；init(p, R) 设定初值
  spawn(dt, rate, init) {
    this.acc = (this.acc || 0) + rate * dt;
    while (this.acc >= 1) { this.acc -= 1; this.emit(init); }
  }
  step(dt, force = null) {
    const keep = [];
    for (const q of this.P) {
      q.age += dt;
      if (q.age >= q.life) continue;
      let a = [0, q.grav + q.buoy, 0];
      if (force) { const f = force(q.p, q); a = [a[0] + f[0], a[1] + f[1], a[2] + f[2]]; }
      for (let c = 0; c < 3; c++) { q.v[c] += a[c] * dt; q.v[c] *= Math.exp(-q.drag * dt); q.p[c] += q.v[c] * dt; }
      q.rot += q.spin * dt;
      if (q.floor !== undefined && q.p[1] < q.floor) { q.p[1] = q.floor; q.v[1] *= -0.2; q.v[0] *= 0.5; q.v[2] *= 0.5; if (q.stick) { q.v = [0, 0, 0]; q.spin = 0; } }
      keep.push(q);
    }
    this.P = keep;
  }
  upload() {
    const n = Math.min(this.P.length, this.max);
    for (let k = 0; k < n; k++) {
      const q = this.P[k]; const u = q.age / q.life;
      this.A.set([q.p[0], q.p[1], q.p[2], q.size * (1 + q.grow * u)], k * 4);
      this.Bf.set(q.col, k * 4);
      this.Cf.set([q.v[0], q.v[1], q.v[2], u + Math.floor(q.seed * 1000)], k * 4);
    }
    this.n = n;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.bufs.iA); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.A.subarray(0, n * 4));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.bufs.iB); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.Bf.subarray(0, n * 4));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh.bufs.iC); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.Cf.subarray(0, n * 4));
  }
}
